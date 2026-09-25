/**
 * Keep dungeon-map occupancy snapshots aligned with State Tracker memoHistory.
 * Viewing a previous [ LIVE ] stone overlays that occupancy; restoring it as
 * LIVE writes the matching [MAP] section back to the Locations lorebook.
 */

export const MEMO_HISTORY_LIMIT = 25;

/** Keep recent memo/map pairs, retaining an older LIVE pair in the final slot. */
export function trimMemoAndMapHistory(settings, max = MEMO_HISTORY_LIMIT) {
    if (!Array.isArray(settings?.memoHistory)) return false;
    const limit = Number.isInteger(max) && max > 0 ? max : MEMO_HISTORY_LIMIT;
    if (settings.memoHistory.length <= limit) return false;
    const liveIndex = getLiveHistoryIndex(settings);
    const maps = Array.isArray(settings.dungeonMapHistory) ? settings.dungeonMapHistory : [];
    const indices = Array.from({ length: limit }, (_, index) => index);
    if (liveIndex >= limit) indices[limit - 1] = liveIndex;
    settings.memoHistory = indices.map(index => settings.memoHistory[index]);
    settings.dungeonMapHistory = indices.map(index => maps[index] ?? null);
    settings.historyIndex = liveIndex < 0 ? -1 : Math.min(liveIndex, limit - 1);
    return true;
}

export function ensureDungeonMapHistory(settings) {
    if (!settings || typeof settings !== 'object') return [];
    if (!Array.isArray(settings.dungeonMapHistory)) settings.dungeonMapHistory = [];
    const memoLen = Array.isArray(settings.memoHistory) ? settings.memoHistory.length : 0;
    while (settings.dungeonMapHistory.length < memoLen) settings.dungeonMapHistory.push(null);
    if (settings.dungeonMapHistory.length > memoLen) settings.dungeonMapHistory.length = memoLen;
    return settings.dungeonMapHistory;
}

export function sliceMemoAndMapHistory(settings, fromIndex) {
    const start = Math.max(0, Number(fromIndex) || 0);
    ensureDungeonMapHistory(settings);
    settings.memoHistory = (settings.memoHistory || []).slice(start);
    settings.dungeonMapHistory = (settings.dungeonMapHistory || []).slice(start);
    // LIVE is now at slot 0. Leaving a stale historyIndex > length-1 makes
    // getLiveHistoryIndex() return -1 until a later writer fixes the pointer.
    if (Number.isInteger(settings.historyIndex) && settings.historyIndex >= 0) {
        settings.historyIndex = settings.memoHistory.length ? 0 : -1;
    }
}

export function unshiftMemoAndMapHistory(settings, memo, mapSnapshot, { max = MEMO_HISTORY_LIMIT, preserveLive = false } = {}) {
    if (!Array.isArray(settings.memoHistory)) settings.memoHistory = [];
    const liveIndex = getLiveHistoryIndex(settings);
    ensureDungeonMapHistory(settings);
    settings.memoHistory.unshift(memo);
    settings.dungeonMapHistory.unshift(mapSnapshot ?? null);
    // Conflict archives insert before LIVE; ordinary tracker commits instead
    // make the new result LIVE and reset the pointer in their caller.
    if (preserveLive) {
        settings.historyIndex = liveIndex < 0 ? -1 : liveIndex + 1;
        trimMemoAndMapHistory(settings, max);
        return;
    }
    if (settings.memoHistory.length > max) {
        settings.memoHistory.length = max;
        settings.dungeonMapHistory.length = max;
    }
}

export function shiftMemoAndMapHistory(settings) {
    if (!Array.isArray(settings.memoHistory)) settings.memoHistory = [];
    ensureDungeonMapHistory(settings);
    settings.memoHistory.shift();
    settings.dungeonMapHistory.shift();
}

export function clearMemoAndMapHistory(settings) {
    settings.memoHistory = [];
    settings.dungeonMapHistory = [];
}

export function getDungeonMapHistoryEntry(settings, index) {
    ensureDungeonMapHistory(settings);
    if (index == null || index < 0) return null;
    return settings.dungeonMapHistory[index] ?? null;
}

/** Valid LIVE Linear Stone index, or -1 when LIVE is outside history. */
export function getLiveHistoryIndex(settings) {
    if (!settings || !Array.isArray(settings.memoHistory)) return -1;
    const liveIndex = Number.isInteger(settings.historyIndex) ? settings.historyIndex : -1;
    if (liveIndex < 0 || liveIndex >= settings.memoHistory.length) return -1;
    return liveIndex;
}

/**
 * Map occupancy to pair with a previousMemo archive after an optional
 * sliceMemoAndMapHistory(historyIndex). When LIVE was in-history, the slice
 * (or a no-op slice at 0) leaves that map at slot 0 — prefer it over a fresh
 * capture so a failed capture cannot drop occupancy. Chat Link archives leave
 * historyIndex > 0; treating only === 0 as LIVE skipped the stored map.
 */
export function previousMapForHistoryArchive(settings, mapSnapshot) {
    const liveIndex = Number.isInteger(settings?.historyIndex) ? settings.historyIndex : -1;
    if (liveIndex >= 0) {
        return settings.dungeonMapHistory?.[0] ?? mapSnapshot;
    }
    return mapSnapshot;
}

/**
 * After a State Tracker swipe restores currentMemo, keep the LIVE Linear Stone
 * text aligned. LIVE follows historyIndex — Chat Link conflict archiving and
 * "restore as LIVE" leave it off index 0. Writing memoHistory[0] corrupted the
 * archived/newest stone and desynced the real LIVE slot.
 */
export function syncLiveMemoHistoryAfterSwipe(settings, targetMemo, baseMemo) {
    if (!settings || !Array.isArray(settings.memoHistory)) return;
    const liveIdx = getLiveHistoryIndex(settings);
    if (liveIdx < 0) return;

    // Remove the abandoned result together with its map when the following
    // stone is the saved base. Chat Link may have inserted archives before it.
    if (targetMemo === baseMemo && settings.memoHistory[liveIdx] !== baseMemo) {
        ensureDungeonMapHistory(settings);
        if (settings.memoHistory[liveIdx + 1] === baseMemo) {
            settings.memoHistory.splice(liveIdx, 1);
            settings.dungeonMapHistory.splice(liveIdx, 1);
        } else {
            // No saved base stone: do not promote an unrelated older memo, or
            // claim the abandoned result's occupancy belongs to the base memo.
            settings.memoHistory[liveIdx] = targetMemo;
            settings.dungeonMapHistory[liveIdx] = null;
        }
        return;
    }

    settings.memoHistory[liveIdx] = targetMemo;
}

/** After a live [MAP] mutation, keep the current LIVE history slot in sync. */
export function recordLiveDungeonMapSnapshot(settings, mapSnapshot) {
    if (!settings || mapSnapshot == null) return;
    ensureDungeonMapHistory(settings);
    // LIVE is not always at index 0 — Chat Link conflict archiving (and other
    // unshifts) bump historyIndex so the LIVE pointer follows its memo. Writing
    // only slot 0 left the real LIVE map stale after exploration.
    const liveIndex = getLiveHistoryIndex(settings);
    if (liveIndex >= 0) {
        settings.dungeonMapHistory[liveIndex] = mapSnapshot;
    }
}
