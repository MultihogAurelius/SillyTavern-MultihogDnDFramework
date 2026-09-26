/**
 * File-backed memo/map and Map Evolution history. Live values remain available
 * to existing callers, but are non-enumerable after a successful file write so
 * ST does not copy them into settings.json. Legacy values remain until uploaded.
 */

import { MODULE_NAME } from './schema-sections.js';

const FILE_PREFIX = 'multihog_history_';
const FORMAT_VERSION = 2;
const HISTORY_KEYS = ['memoHistory', 'dungeonMapHistory'];
const EVOLUTION_KEYS = [
    'mapEvolutionBacklogBySite',
    'mapEvolutionThreadsBySite',
    'mapEvolutionWorldReportApplications',
];
const pendingByChat = new Map();
const heldLegacyChats = new Set();
const heldLegacyProfiles = new Set();
let heldLegacyGlobal = false;
let persistenceBlocked = false;

export function blockHistoryPersistence() { persistenceBlocked = true; }
export function isHistoryPersistenceBlocked() { return persistenceBlocked; }

function headers() {
    return SillyTavern.getContext().getRequestHeaders();
}

function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

async function compressedBytes(text) {
    const bytes = new TextEncoder().encode(text);
    const wantGzip = typeof CompressionStream === 'function';
    if (!wantGzip) return { bytes, compressed: false };
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), compressed: true };
}

async function digest(text) {
    const bytes = new TextEncoder().encode(text);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
}

function evolutionRecord(part, key) {
    const value = part?.[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function historyJson(part) {
    if (!part || typeof part !== 'object') return null;
    return JSON.stringify({
        version: FORMAT_VERSION,
        memoHistory: Array.isArray(part.memoHistory) ? part.memoHistory : [],
        dungeonMapHistory: Array.isArray(part.dungeonMapHistory) ? part.dungeonMapHistory : [],
        mapEvolutionBacklogBySite: evolutionRecord(part, EVOLUTION_KEYS[0]),
        mapEvolutionThreadsBySite: evolutionRecord(part, EVOLUTION_KEYS[1]),
        mapEvolutionWorldReportApplications: evolutionRecord(part, EVOLUTION_KEYS[2]),
    });
}

function hasEvolutionData(part) {
    return EVOLUTION_KEYS.some(key => Object.keys(evolutionRecord(part, key)).length > 0);
}

function hasEmbeddedHistory(part) {
    const embeddedSnapshots = Array.isArray(part?.memoHistory)
        && !!(part.memoHistory.length || part.dungeonMapHistory?.length)
        && Object.getOwnPropertyDescriptor(part, 'memoHistory')?.enumerable === true;
    const embeddedEvolution = EVOLUTION_KEYS.some(key => Object.keys(evolutionRecord(part, key)).length > 0
        && Object.getOwnPropertyDescriptor(part, key)?.enumerable === true);
    return embeddedSnapshots || embeddedEvolution;
}

/** Hold histories found at startup until the user starts migration. New chats still use files. */
export function holdLegacyHistories(settings) {
    heldLegacyChats.clear();
    heldLegacyProfiles.clear();
    for (const [chatId, part] of Object.entries(settings?.chatStates || {})) {
        if (hasEmbeddedHistory(part)) heldLegacyChats.add(chatId);
    }
    for (const [name, profile] of Object.entries(settings?.profiles || {})) {
        if (hasEmbeddedHistory(profile)) heldLegacyProfiles.add(name);
    }
    heldLegacyGlobal = !settings?.chatLinkEnabled && hasEmbeddedHistory(settings);
}

/** Count remaining embedded histories without uploading or changing settings. */
export function countLegacyHistories(settings) {
    return Object.values(settings?.chatStates || {}).filter(hasEmbeddedHistory).length
        + Object.values(settings?.profiles || {}).filter(hasEmbeddedHistory).length
        + (!settings?.chatLinkEnabled && hasEmbeddedHistory(settings) ? 1 : 0);
}

function concealHistories(part, includeEvolution = true) {
    for (const key of [...HISTORY_KEYS, ...(includeEvolution ? EVOLUTION_KEYS : [])]) {
        if (!Object.hasOwn(part, key)) continue;
        Object.defineProperty(part, key, {
            value: part[key], writable: true, configurable: true, enumerable: false,
        });
    }
}

function exposeHistories(part) {
    for (const key of [...HISTORY_KEYS, ...EVOLUTION_KEYS]) {
        if (!Object.hasOwn(part, key)) continue;
        Object.defineProperty(part, key, {
            value: part[key], writable: true, configurable: true, enumerable: true,
        });
    }
}

function attachmentRegistry() {
    const extensionSettings = SillyTavern.getContext().extensionSettings;
    if (!Array.isArray(extensionSettings.attachments)) extensionSettings.attachments = [];
    if (!Array.isArray(extensionSettings.disabled_attachments)) extensionSettings.disabled_attachments = [];
    return extensionSettings;
}

/** Data Maid only protects uploaded files recorded as ST attachments. */
function protectFile(url) {
    const registry = attachmentRegistry();
    if (!registry.attachments.some(item => item?.url === url)) {
        registry.attachments.push({ url, name: 'Multihog internal history', created: Date.now() });
    }
    if (!registry.disabled_attachments.includes(url)) registry.disabled_attachments.push(url);
}

function isOwnFile(url) {
    return typeof url === 'string' && /^\/?user\/files\/multihog_history_[a-z0-9-]+\.json(?:\.gz)?$/i.test(url);
}

async function uploadJson(fileName, text) {
    const { bytes, compressed } = await compressedBytes(text);
    const name = `${fileName}.json${compressed ? '.gz' : ''}`;
    const response = await fetch('/api/files/upload', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ name, data: bytesToBase64(bytes) }),
    });
    if (!response.ok) throw new Error(`History upload failed (HTTP ${response.status})`);
    const result = await response.json();
    if (!isOwnFile(result?.path)) throw new Error('History upload returned an unexpected path');
    return result.path;
}

async function readJson(url) {
    if (!isOwnFile(url)) throw new Error('Invalid history file path');
    const response = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (!response.ok) throw new Error(`History download failed (HTTP ${response.status})`);
    let bytes = new Uint8Array(await response.arrayBuffer());
    if (url.endsWith('.gz')) {
        if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot read compressed history');
        bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (![1, FORMAT_VERSION].includes(parsed?.version)
        || !Array.isArray(parsed.memoHistory) || !Array.isArray(parsed.dungeonMapHistory)
        || (parsed.version === FORMAT_VERSION && EVOLUTION_KEYS.some(key => !parsed[key]
            || typeof parsed[key] !== 'object' || Array.isArray(parsed[key])))) {
        throw new Error('Invalid history file contents');
    }
    return parsed;
}

/** Read an active chat's offloaded histories before projecting its partition. */
export async function hydrateChatHistories(settings, chatId) {
    const part = settings?.chatStates?.[chatId];
    const pointer = part?.historyStorage;
    if (!pointer?.url || Array.isArray(part.memoHistory)) return true;
    try {
        const data = await readJson(pointer.url);
        const checksum = await digest(JSON.stringify(data));
        if (checksum !== pointer.sha256) throw new Error('History checksum mismatch');
        // A chat switch or migration can replace this partition while fetching.
        if (settings.chatStates?.[chatId] !== part || part.historyStorage !== pointer) return false;
        part.memoHistory = data.memoHistory;
        part.dungeonMapHistory = data.dungeonMapHistory;
        if (data.version === FORMAT_VERSION) {
            for (const key of EVOLUTION_KEYS) part[key] = data[key];
        }
        concealHistories(part, data.version === FORMAT_VERSION);
        protectFile(pointer.url);
        return true;
    } catch (error) {
        console.error('[RPG Tracker] Could not restore saved chat history:', chatId, error);
        return false;
    }
}

/** Restore the legacy global-mode history when Chat Link is disabled. */
export async function hydrateGlobalHistories(settings) {
    const pointer = settings?.globalHistoryStorage;
    if (!pointer?.url || (settings.memoHistory?.length || settings.dungeonMapHistory?.length)) return true;
    try {
        const data = await readJson(pointer.url);
        if (await digest(JSON.stringify(data)) !== pointer.sha256) throw new Error('History checksum mismatch');
        if (settings.globalHistoryStorage !== pointer) return false;
        settings.memoHistory = data.memoHistory;
        settings.dungeonMapHistory = data.dungeonMapHistory;
        if (data.version === FORMAT_VERSION) {
            for (const key of EVOLUTION_KEYS) settings[key] = data[key];
        }
        concealHistories(settings, data.version === FORMAT_VERSION);
        protectFile(pointer.url);
        return true;
    } catch (error) {
        console.error('[RPG Tracker] Could not restore global history:', error);
        return false;
    }
}

/** Store the history used while Chat Link is disabled. */
export async function persistGlobalHistories(settings) {
    if (heldLegacyGlobal) return false;
    try {
        if (settings?.globalHistoryStorage && !Array.isArray(settings.memoHistory)
            && !await hydrateGlobalHistories(settings)) return false;
        if (!settings?.globalHistoryStorage && !(settings?.memoHistory?.length || settings?.dungeonMapHistory?.length || hasEvolutionData(settings))) return false;
        const json = historyJson(settings);
        if (!json) return false;
        const sha256 = await digest(json);
        const pointer = settings.globalHistoryStorage;
        if (pointer?.sha256 === sha256 && isOwnFile(pointer.url)) {
            protectFile(pointer.url);
            concealHistories(settings);
            return false;
        }
        // Never overwrite the file named by a settings.json pointer. A reload
        // between upload and settings save must still be able to read that file.
        const url = await uploadJson(`${FILE_PREFIX}${crypto.randomUUID()}`, json);
        settings.globalHistoryStorage = { version: FORMAT_VERSION, url, sha256 };
        protectFile(url);
        if (historyJson(settings) === json) concealHistories(settings);
        return true;
    } catch (error) {
        exposeHistories(settings);
        console.error('[RPG Tracker] Global history save failed; keeping settings.json fallback:', error);
        return false;
    }
}

/** Upload one chat's arrays before omitting them from future settings saves. */
export function persistChatHistories(settings, chatId) {
    if (!chatId || !settings?.chatStates?.[chatId]) return Promise.resolve(false);
    if (heldLegacyChats.has(chatId)) return Promise.resolve(false);
    if (pendingByChat.has(chatId)) return pendingByChat.get(chatId);
    const pending = (async () => {
        let changed = false;
        for (;;) {
            const part = settings.chatStates?.[chatId];
            if (!part) return changed;
            if (part.historyStorage && !Array.isArray(part.memoHistory)) {
                if (!await hydrateChatHistories(settings, chatId)) return false;
                continue;
            }
            if (!part.historyStorage && !(part.memoHistory?.length || part.dungeonMapHistory?.length || hasEvolutionData(part))) return changed;
            const json = historyJson(part);
            if (!json) return changed;
            const sha256 = await digest(json);
            const pointer = part.historyStorage;
            const sharedFile = pointer?.url && Object.entries(settings.chatStates || {})
                .some(([otherId, other]) => otherId !== chatId && other?.historyStorage?.url === pointer.url);
            if (!sharedFile && pointer?.sha256 === sha256 && isOwnFile(pointer.url)) {
                if (pointer.owner !== chatId) {
                    part.historyStorage = { ...pointer, owner: chatId };
                    changed = true;
                }
                protectFile(pointer.url);
                concealHistories(part);
                if (settings.chatStateProjectionOwner === chatId && historyJson(settings) === json) concealHistories(settings);
                return changed;
            }
            const url = await uploadJson(`${FILE_PREFIX}${crypto.randomUUID()}`, json);
            const current = settings.chatStates?.[chatId];
            if (!current) return changed;
            current.historyStorage = { version: FORMAT_VERSION, owner: chatId, url, sha256 };
            protectFile(url);
            changed = true;
            if (historyJson(current) !== json) continue;
            concealHistories(current);
            if (settings.chatStateProjectionOwner === chatId && historyJson(settings) === json) concealHistories(settings);
            return changed;
        }
    })().catch(error => {
        const part = settings.chatStates?.[chatId];
        if (part) exposeHistories(part);
        if (settings.chatStateProjectionOwner === chatId) exposeHistories(settings);
        console.error('[RPG Tracker] History file save failed; keeping settings.json fallback:', chatId, error);
        return false;
    }).finally(() => pendingByChat.delete(chatId));
    pendingByChat.set(chatId, pending);
    return pending;
}

function profileView(settings, name) {
    const id = `profile:${name}`;
    return { id, view: { chatStates: { [id]: settings?.profiles?.[name] } } };
}

export function persistProfileHistories(settings, name) {
    if (heldLegacyProfiles.has(name)) return Promise.resolve(false);
    const { id, view } = profileView(settings, name);
    return persistChatHistories(view, id);
}

export function hydrateProfileHistories(settings, name) {
    const { id, view } = profileView(settings, name);
    return hydrateChatHistories(view, id);
}

/** Migrate only after the user opts in. Report every step and yield to keep the UI responsive. */
export async function migrateLegacyHistories(settings, onProgress = async () => {}) {
    const jobs = [
        ...Object.entries(settings?.chatStates || {}).filter(([, part]) => hasEmbeddedHistory(part))
            .map(([id]) => ({ type: 'chat', id })),
        ...Object.entries(settings?.profiles || {}).filter(([, part]) => hasEmbeddedHistory(part))
            .map(([id]) => ({ type: 'profile', id })),
        ...(!settings?.chatLinkEnabled && hasEmbeddedHistory(settings) ? [{ type: 'global' }] : []),
    ];
    let migrated = 0;
    let failed = 0;
    for (const job of jobs) {
        let part;
        if (job.type === 'chat') {
            heldLegacyChats.delete(job.id);
            part = settings.chatStates?.[job.id];
            if (part) await persistChatHistories(settings, job.id);
            part = settings.chatStates?.[job.id];
        } else if (job.type === 'profile') {
            heldLegacyProfiles.delete(job.id);
            part = settings.profiles?.[job.id];
            if (part) await persistProfileHistories(settings, job.id);
            part = settings.profiles?.[job.id];
        } else {
            heldLegacyGlobal = false;
            part = settings;
            await persistGlobalHistories(settings);
        }
        if (part && !hasEmbeddedHistory(part)) migrated++;
        else {
            failed++;
            if (job.type === 'chat') heldLegacyChats.add(job.id);
            else if (job.type === 'profile') heldLegacyProfiles.add(job.id);
            else heldLegacyGlobal = true;
        }
        await onProgress({ completed: migrated + failed, total: jobs.length, migrated, failed });
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { total: jobs.length, migrated, failed };
}

/** Remove an unreferenced history file after a deleted chat is purged. */
export async function removeUnreferencedHistoryFile(settings, url) {
    if (!isOwnFile(url)) return false;
    if (Object.values(settings?.chatStates || {}).some(part => part?.historyStorage?.url === url)) return false;
    if (Object.values(settings?.profiles || {}).some(profile => profile?.historyStorage?.url === url)) return false;
    if (settings?.globalHistoryStorage?.url === url) return false;
    const response = await fetch('/api/files/delete', {
        method: 'POST', headers: headers(), body: JSON.stringify({ path: url }),
    });
    if (!response.ok && response.status !== 404) throw new Error(`History deletion failed (HTTP ${response.status})`);
    const registry = attachmentRegistry();
    registry.attachments = registry.attachments.filter(item => item?.url !== url);
    registry.disabled_attachments = registry.disabled_attachments.filter(item => item !== url);
    return true;
}

function referencedUrls(settings) {
    return new Set([
        settings?.globalHistoryStorage?.url,
        ...Object.values(settings?.chatStates || {}).map(part => part?.historyStorage?.url),
        ...Object.values(settings?.profiles || {}).map(profile => profile?.historyStorage?.url),
    ].filter(isOwnFile));
}

/**
 * Delete superseded files only after reading the actual settings.json on disk.
 * The live and disk pointers are both protected: a cancelled settings save can
 * never make its old file disappear.
 */
export async function cleanupSupersededHistoryFiles(settings) {
    const response = await fetch('/api/settings/get', { method: 'POST', headers: headers() });
    if (!response.ok) throw new Error(`Could not verify saved settings (HTTP ${response.status})`);
    const result = await response.json();
    const disk = JSON.parse(result.settings)?.extension_settings?.[MODULE_NAME];
    if (!disk || typeof disk !== 'object') throw new Error('Saved Multihog settings are unavailable');
    const protectedUrls = new Set([...referencedUrls(disk), ...referencedUrls(settings)]);
    const registry = attachmentRegistry();
    let removed = false;
    for (const entry of [...registry.attachments]) {
        if (!isOwnFile(entry?.url) || protectedUrls.has(entry.url)) continue;
        removed = await removeUnreferencedHistoryFile(settings, entry.url) || removed;
    }
    return removed;
}
