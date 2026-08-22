export const COMPANION_BY_CHAT_KEY = 'rpg_tracker_companion_by_chat_v1';
export const MEMO_RECOVERY_KEY = 'rpg_tracker_memo_recovery_v1';

/**
 * @param {string} key
 * @returns {Record<string, any>}
 */
function readLocalChatMap(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

/**
 * @param {string} key
 * @param {Record<string, any>} map
 */
function writeLocalChatMap(key, map) {
    try {
        localStorage.setItem(key, JSON.stringify(map));
    } catch (err) {
        console.warn('[RPG Tracker] Could not persist local chat map:', key, err);
    }
}

/**
 * Test whether a browser-local chat map already owns a chat key.
 * Used before CHAT_CHANGED resets an unseen destination, so rename migration
 * can distinguish pre-existing data from entries created by the reset itself.
 * @param {string} storageKey
 * @param {string} chatId
 * @returns {boolean}
 */
export function localChatMapHasEntry(storageKey, chatId) {
    if (!storageKey || !chatId) return false;
    const map = readLocalChatMap(storageKey);
    return Object.prototype.hasOwnProperty.call(map, chatId);
}

/**
 * Deep-copy a localStorage chat-keyed map entry from oldId to newId.
 * @param {string} storageKey
 * @param {string} oldId
 * @param {string} newId
 */
export function copyLocalChatMapEntry(storageKey, oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    const map = readLocalChatMap(storageKey);
    if (!Object.prototype.hasOwnProperty.call(map, oldId)) return;
    try {
        map[newId] = JSON.parse(JSON.stringify(map[oldId]));
        if (map[newId] && typeof map[newId] === 'object' && 'ts' in map[newId]) {
            map[newId].ts = Date.now();
        }
        writeLocalChatMap(storageKey, map);
    } catch (err) {
        console.warn('[RPG Tracker] Failed to copy local map entry:', storageKey, err);
    }
}

/**
 * Move a localStorage chat-keyed map entry for a rename.
 * Existing destination data is never overwritten or deleted; callers can warn
 * about the preserved collision and leave both entries recoverable.
 * @param {string} storageKey
 * @param {string} oldId
 * @param {string} newId
 * @param {{ replaceDestination?: boolean }} [opts]
 * @returns {'invalid'|'missing'|'collision'|'moved'}
 */
export function moveLocalChatMapEntry(storageKey, oldId, newId, opts = {}) {
    if (!oldId || !newId || oldId === newId) return 'invalid';
    const map = readLocalChatMap(storageKey);
    if (!Object.prototype.hasOwnProperty.call(map, oldId)) return 'missing';
    if (Object.prototype.hasOwnProperty.call(map, newId) && !opts.replaceDestination) return 'collision';
    map[newId] = map[oldId];
    delete map[oldId];
    writeLocalChatMap(storageKey, map);
    return 'moved';
}
