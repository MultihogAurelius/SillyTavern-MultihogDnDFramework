/**
 * File-backed memo/map history. The live arrays remain available to existing
 * callers, but are non-enumerable after a successful file write so ST does not
 * copy them into settings.json. Legacy arrays stay enumerable until uploaded.
 */

import { MODULE_NAME } from './schema-sections.js';

const FILE_PREFIX = 'multihog_history_';
const FORMAT_VERSION = 1;
const pendingByChat = new Map();
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

function historyJson(part) {
    if (!Array.isArray(part?.memoHistory)) return null;
    return JSON.stringify({
        version: FORMAT_VERSION,
        memoHistory: part.memoHistory,
        dungeonMapHistory: Array.isArray(part.dungeonMapHistory) ? part.dungeonMapHistory : [],
    });
}

function concealHistories(part) {
    for (const key of ['memoHistory', 'dungeonMapHistory']) {
        if (!Object.hasOwn(part, key)) continue;
        Object.defineProperty(part, key, {
            value: part[key], writable: true, configurable: true, enumerable: false,
        });
    }
}

function exposeHistories(part) {
    for (const key of ['memoHistory', 'dungeonMapHistory']) {
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
    if (parsed?.version !== FORMAT_VERSION || !Array.isArray(parsed.memoHistory) || !Array.isArray(parsed.dungeonMapHistory)) {
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
        concealHistories(part);
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
        concealHistories(settings);
        protectFile(pointer.url);
        return true;
    } catch (error) {
        console.error('[RPG Tracker] Could not restore global history:', error);
        return false;
    }
}

/** Store the history used while Chat Link is disabled. */
export async function persistGlobalHistories(settings) {
    try {
        if (!settings?.globalHistoryStorage && !(settings?.memoHistory?.length || settings?.dungeonMapHistory?.length)) return false;
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
    if (pendingByChat.has(chatId)) return pendingByChat.get(chatId);
    const pending = (async () => {
        let changed = false;
        for (;;) {
            const part = settings.chatStates?.[chatId];
            if (!part?.historyStorage && !(part?.memoHistory?.length || part?.dungeonMapHistory?.length)) return changed;
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

/** Move legacy histories gradually; every successful upload reduces settings.json. */
export async function migrateLegacyChatHistories(settings, onMigrated) {
    for (const chatId of Object.keys(settings?.chatStates || {})) {
        const part = settings.chatStates[chatId];
        if (!Array.isArray(part?.memoHistory)) continue;
        if (part.historyStorage?.sha256 && !Object.getOwnPropertyDescriptor(part, 'memoHistory')?.enumerable) continue;
        const changed = await persistChatHistories(settings, chatId);
        if (changed) await onMigrated();
    }
}

function profileView(settings, name) {
    const id = `profile:${name}`;
    return { id, view: { chatStates: { [id]: settings?.profiles?.[name] } } };
}

export function persistProfileHistories(settings, name) {
    const { id, view } = profileView(settings, name);
    return persistChatHistories(view, id);
}

export function hydrateProfileHistories(settings, name) {
    const { id, view } = profileView(settings, name);
    return hydrateChatHistories(view, id);
}

export async function migrateLegacyProfileHistories(settings, onMigrated) {
    for (const name of Object.keys(settings?.profiles || {})) {
        const profile = settings.profiles[name];
        if (!Array.isArray(profile?.memoHistory)) continue;
        if (profile.historyStorage?.sha256 && !Object.getOwnPropertyDescriptor(profile, 'memoHistory')?.enumerable) continue;
        if (await persistProfileHistories(settings, name)) await onMigrated();
    }
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
