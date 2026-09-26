/**
 * Pure helpers for Branch Campaign partition copy (no SillyTavern I/O).
 */

/**
 * Remap a `book::uid` (or bare book) key using a book rename map.
 * @param {string} key
 * @param {Record<string, string>} bookRenameMap
 */
export function remapBookKeyedKey(key, bookRenameMap) {
    const k = String(key || '');
    if (!bookRenameMap || !Object.keys(bookRenameMap).length) return k;
    const idx = k.indexOf('::');
    if (idx < 0) return bookRenameMap[k] || k;
    const book = k.slice(0, idx);
    const rest = k.slice(idx);
    const newBook = bookRenameMap[book];
    return newBook ? newBook + rest : k;
}

/**
 * Remap `book::uid` style keys using a book rename map.
 * @param {string[]} list
 * @param {Record<string, string>} bookRenameMap
 */
export function remapBookKeyedList(list, bookRenameMap) {
    if (!Array.isArray(list)) return [];
    return list.map((k) => remapBookKeyedKey(k, bookRenameMap));
}

/**
 * Remap a `book::uid`-keyed object (relationship values/log) onto cloned book names.
 * @param {Record<string, any>|null|undefined} map
 * @param {Record<string, string>} bookRenameMap
 */
export function remapBookKeyedMap(map, bookRenameMap) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
    const out = {};
    for (const [k, v] of Object.entries(map)) {
        out[remapBookKeyedKey(k, bookRenameMap)] = JSON.parse(JSON.stringify(v));
    }
    return out;
}

/**
 * @param {any[]} log
 * @param {Record<string, string>} bookRenameMap
 */
function remapRouterLog(log, bookRenameMap) {
    if (!Array.isArray(log) || !bookRenameMap || !Object.keys(bookRenameMap).length) {
        return Array.isArray(log) ? JSON.parse(JSON.stringify(log)) : [];
    }
    const keyFields = ['activate', 'deactivate', 'record', 'delete', 'rewrite', 'consolidate', 'rename'];
    return log.map((entry) => {
        const copy = { ...entry };
        for (const f of keyFields) {
            if (Array.isArray(copy[f])) copy[f] = remapBookKeyedList(copy[f], bookRenameMap);
        }
        return copy;
    });
}

/**
 * Deep-copy Multihog chatStates[oldId] → chatStates[newId], remapping lorebook names.
 * Never mutates the source partition.
 * @param {object} s
 * @param {string} oldId
 * @param {string} newId
 * @param {string} newPrefix
 * @param {Record<string, string>} bookRenameMap
 */
export function copyChatStatePartition(s, oldId, newId, newPrefix, bookRenameMap = {}) {
    if (!s.chatStates) s.chatStates = {};
    const source = s.chatStates[oldId];
    if (!source) {
        throw new Error(`No Multihog chat state found for "${oldId}".`);
    }
    const copy = JSON.parse(JSON.stringify(source));
    // File-backed arrays are non-enumerable in settings, but a new branch must
    // start with the source's actual history rather than an empty projection.
    if (Array.isArray(source.memoHistory)) copy.memoHistory = JSON.parse(JSON.stringify(source.memoHistory));
    if (Array.isArray(source.dungeonMapHistory)) copy.dungeonMapHistory = JSON.parse(JSON.stringify(source.dungeonMapHistory));
    // Branches own newly cloned books, so the source's rename pin must not follow.
    delete copy.renamedCampaignPrefix;
    if (newPrefix) copy.routerCampaignPrefix = newPrefix;

    if (Array.isArray(copy.campaignBooks) && Object.keys(bookRenameMap).length) {
        copy.campaignBooks = copy.campaignBooks.map((n) => bookRenameMap[n] || n);
    }
    copy.activeRouterKeys = remapBookKeyedList(copy.activeRouterKeys, bookRenameMap);
    copy.activeWorldKeys = remapBookKeyedList(copy.activeWorldKeys, bookRenameMap);
    copy.keywordActivatedKeys = remapBookKeyedList(copy.keywordActivatedKeys, bookRenameMap);
    copy.routerLog = remapRouterLog(copy.routerLog, bookRenameMap);

    // Relationship stats are keyed by Book::UID. Cloned lorebooks get new names, so
    // the maps must follow the rename or the branch renders every NPC at 0/0.
    const relValuesSource = Object.prototype.hasOwnProperty.call(copy, 'npcRelationshipValues')
        ? copy.npcRelationshipValues
        : (s.npcRelationshipValues || {});
    const relLogSource = Object.prototype.hasOwnProperty.call(copy, 'npcRelationshipLog')
        ? copy.npcRelationshipLog
        : (s.npcRelationshipLog || {});
    copy.npcRelationshipValues = remapBookKeyedMap(relValuesSource, bookRenameMap);
    copy.npcRelationshipLog = remapBookKeyedMap(relLogSource, bookRenameMap);

    s.chatStates[newId] = copy;
    return copy;
}
