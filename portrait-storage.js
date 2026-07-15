import { getRequestHeaders } from '../../../../script.js';
import { getActiveChatId } from './state-manager.js';

/** Subfolder under `user/images/` for all Multihog portrait files. */
export const PORTRAIT_STORAGE_FOLDER = 'multihogframework_portraits';

/** @deprecated Pre-5.1.10 folder name — still recognized for purge/delete. */
const LEGACY_PORTRAIT_STORAGE_FOLDERS = ['rpg_tracker_portraits'];

let _portraitMigrationLocked = false;

/** True while a bulk portrait migration is running — blocks chat state load/save races. */
export function isPortraitMigrationLocked() {
    return _portraitMigrationLocked;
}

function setPortraitMigrationLocked(locked) {
    _portraitMigrationLocked = !!locked;
    globalThis._rpgPortraitMigrationLocked = () => _portraitMigrationLocked;
}

export { setPortraitMigrationLocked };

/** Strip a leading slash so stored paths match ST's relative path convention. */
function normalizeStoredPortraitPath(path) {
    if (!path) return '';
    return String(path).replace(/^\//, '');
}

function normalizeEntityName(name) {
    if (!name) return '';
    return name.replace(/\s*\(.*?\)/g, '').trim();
}

/** @returns {boolean} */
export function isPortraitDataUrl(src) {
    return typeof src === 'string' && src.startsWith('data:image/');
}

/** @returns {boolean} */
export function isManagedPortraitPath(src) {
    if (typeof src !== 'string') return false;
    const norm = src.replace(/^\//, '');
    const folders = [PORTRAIT_STORAGE_FOLDER, ...LEGACY_PORTRAIT_STORAGE_FOLDERS];
    return folders.some((folder) => norm.includes(`user/images/${folder}/`));
}

/** Normalize any stored portrait ref for use as an `<img src>`. */
export function resolvePortraitDisplaySrc(src) {
    return src || '';
}

function sanitizeStorageSegment(value, fallback = 'unknown') {
    const cleaned = String(value || '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80);
    return cleaned || fallback;
}

/** @returns {{ format: string, base64: string }} */
function dataUrlToUploadPayload(dataUrl) {
    const match = dataUrl.match(/^data:image\/([\w+.-]+);base64,(.+)$/s);
    if (!match) throw new Error('Invalid image data URL');
    let format = match[1].toLowerCase();
    if (format === 'jpeg') format = 'jpg';
    return { format, base64: match[2] };
}

/** Cheap content fingerprint so identical portraits migrate to one file. */
function fingerprintDataUrl(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    let hash = 5381;
    const step = Math.max(1, Math.floor(base64.length / 64));
    for (let i = 0; i < base64.length; i += step) {
        hash = ((hash << 5) + hash) ^ base64.charCodeAt(i);
    }
    return `${hash >>> 0}_${base64.length}`;
}

/**
 * @param {string} dataUrl
 * @param {string|null|undefined} chatId
 * @param {string} entityName
 * @param {Map<string, string>} [dedupeCache]
 * @param {boolean} [unique] When true, append a timestamp so replacements get a new URL (avoids browser cache).
 * @returns {Promise<string>}
 */
export async function uploadPortraitDataUrl(dataUrl, chatId, entityName, dedupeCache, unique = false) {
    const fingerprint = fingerprintDataUrl(dataUrl);
    if (!unique && dedupeCache?.has(fingerprint)) {
        return dedupeCache.get(fingerprint);
    }

    const { format, base64 } = dataUrlToUploadPayload(dataUrl);
    const chatSegment = sanitizeStorageSegment(chatId || '_global', '_global');
    const entitySegment = sanitizeStorageSegment(normalizeEntityName(entityName) || 'portrait', 'portrait');
    const fileName = unique
        ? `${chatSegment}__${entitySegment}__${Date.now()}`
        : `${chatSegment}__${entitySegment}`;

    const response = await fetch('/api/images/upload', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            image: base64,
            format,
            ch_name: PORTRAIT_STORAGE_FOLDER,
            filename: fileName,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload portrait');
    }

    const { path } = await response.json();
    const storedPath = normalizeStoredPortraitPath(path);
    if (!unique) dedupeCache?.set(fingerprint, storedPath);
    return storedPath;
}

/**
 * Persist a portrait source: inline data URLs become files; URLs/paths are kept as-is.
 * @param {string} src
 * @param {string|null|undefined} chatId
 * @param {string} entityName
 * @returns {Promise<string>}
 */
export async function persistPortraitSrc(src, chatId, entityName, unique = true) {
    if (!src) return '';
    if (isPortraitDataUrl(src)) {
        return uploadPortraitDataUrl(src, chatId, entityName, undefined, unique);
    }
    return src;
}

/** @param {string} path */
export async function deletePortraitFile(path) {
    if (!isManagedPortraitPath(path)) return;
    try {
        const response = await fetch('/api/images/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ path }),
        });
        if (!response.ok) {
            console.warn('[RPG Tracker] Failed to delete portrait file:', path);
        }
    } catch (err) {
        console.warn('[RPG Tracker] Portrait delete error:', path, err);
    }
}

/** @param {object} settings @param {string} targetPath */
export function countPortraitPathRefs(settings, targetPath) {
    let count = 0;
    const scan = (map) => {
        if (!map || typeof map !== 'object') return;
        for (const src of Object.values(map)) {
            if (src === targetPath) count++;
        }
    };
    scan(settings.customPortraits);
    for (const cs of Object.values(settings.chatStates || {})) {
        scan(cs.customPortraits);
    }
    return count;
}

/** @param {object} settings */
export function collectAllPortraitRefs(settings) {
    const refs = new Set();
    const scan = (map) => {
        if (!map || typeof map !== 'object') return;
        for (const src of Object.values(map)) {
            if (typeof src === 'string' && src) refs.add(src);
        }
    };
    scan(settings.customPortraits);
    for (const cs of Object.values(settings.chatStates || {})) {
        scan(cs.customPortraits);
    }
    return refs;
}

/** @param {object} settings */
export function countEmbeddedPortraitDataUrls(settings) {
    let count = 0;
    const scan = (map) => {
        if (!map || typeof map !== 'object') return;
        for (const src of Object.values(map)) {
            if (isPortraitDataUrl(src)) count++;
        }
    };
    scan(settings.customPortraits);
    for (const cs of Object.values(settings.chatStates || {})) {
        scan(cs.customPortraits);
    }
    return count;
}

/**
 * @param {Record<string, string>|undefined|null} portraits
 * @param {string|null|undefined} chatId
 * @param {{ migrated: number, failed: number, skipped: number }} stats
 * @param {Map<string, string>} dedupeCache
 */
async function migratePortraitMap(portraits, chatId, stats, dedupeCache) {
    if (!portraits || typeof portraits !== 'object') return;
    for (const [entityName, src] of Object.entries(portraits)) {
        if (!isPortraitDataUrl(src)) {
            stats.skipped++;
            continue;
        }
        try {
            portraits[entityName] = await uploadPortraitDataUrl(src, chatId, entityName, dedupeCache);
            stats.migrated++;
        } catch (err) {
            console.error('[RPG Tracker] Portrait migration failed:', chatId, entityName, err);
            stats.failed++;
        }
    }
}

/**
 * One-time migration: move all embedded base64 portraits to disk.
 * @param {object} settings
 * @returns {Promise<{ migrated: number, failed: number, skipped: number }>}
 */
export async function migrateAllEmbeddedPortraits(settings) {
    const stats = { migrated: 0, failed: 0, skipped: 0 };
    const dedupeCache = new Map();

    // Chat partitions are the source of truth — migrate those before live state.
    for (const [chatId, cs] of Object.entries(settings.chatStates || {})) {
        await migratePortraitMap(cs.customPortraits, chatId, stats, dedupeCache);
    }
    await migratePortraitMap(settings.customPortraits, getActiveChatId() || '_global', stats, dedupeCache);

    const activeChatId = getActiveChatId();
    if (settings.chatLinkEnabled && activeChatId && settings.chatStates?.[activeChatId]?.customPortraits) {
        settings.customPortraits = JSON.parse(JSON.stringify(settings.chatStates[activeChatId].customPortraits));
    }

    settings.portraitsFileStorageVersion = 1;
    return stats;
}

/**
 * Delete managed portrait files and clear all portrait maps (live + every chat state).
 * @param {object} settings
 */
export async function purgeAllPortraitData(settings) {
    const refs = collectAllPortraitRefs(settings);
    const managed = [...refs].filter(isManagedPortraitPath);
    await Promise.all(managed.map(deletePortraitFile));

    settings.customPortraits = {};
    for (const cs of Object.values(settings.chatStates || {})) {
        if (cs.customPortraits) cs.customPortraits = {};
    }
}
