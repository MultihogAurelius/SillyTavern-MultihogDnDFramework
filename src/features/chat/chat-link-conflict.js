/**
 * Chat Link enable conflict: archive a displaced memo as a Linear Stone.
 * memoHistory entries must be plain strings — objects break syncMemoView,
 * computeDelta, and "restore as LIVE". Keep dungeonMapHistory paired.
 */

import { ensureDungeonMapHistory, MEMO_HISTORY_LIMIT, unshiftMemoAndMapHistory } from '../../state/dungeon-map-history.js';

function isLegacyChatLinkStone(value) {
    return value?.label === 'Global Edit (Pre-Link)' && typeof value.memo === 'string';
}

/** Repair the exact object shape emitted by the old RESTORE path, without dropping memo text. */
export function repairChatLinkMemoHistory(target) {
    if (!target || typeof target !== 'object') return false;
    let changed = false;
    if (isLegacyChatLinkStone(target.currentMemo)) {
        target.currentMemo = target.currentMemo.memo;
        changed = true;
    }
    if (Array.isArray(target.memoHistory) && target.memoHistory.some(isLegacyChatLinkStone)) {
        const maps = Array.isArray(target.dungeonMapHistory) ? [...target.dungeonMapHistory] : [];
        target.memoHistory = target.memoHistory.map((stone, index) => {
            if (!isLegacyChatLinkStone(stone)) return stone;
            // RESTORE inserted the memo without inserting a map slot. Later
            // padding added nulls at the tail; insert the missing slot here.
            while (maps.length < index) maps.push(null);
            maps.splice(index, 0, null);
            return stone.memo;
        });
        target.dungeonMapHistory = maps;
        ensureDungeonMapHistory(target);
        changed = true;
    }
    if (changed && Number.isInteger(target.historyIndex) && target.historyIndex >= 0) {
        // The old unshift also failed to move the LIVE pointer. If its memo
        // isn't in history, keep LIVE outside the history instead of guessing.
        if (target.memoHistory?.[target.historyIndex] !== target.currentMemo) {
            target.historyIndex = target.memoHistory?.indexOf(target.currentMemo) ?? -1;
        }
    }
    return changed;
}

/**
 * @param {object} targetSettings Settings (or chatStates partition) receiving the stone.
 * @param {unknown} memo Displaced memo text. Non-strings are refused.
 * @param {{ max?: number }} [opts]
 * @returns {boolean} true when a stone was archived
 */
export function archiveDisplacedChatLinkMemo(targetSettings, memo, { max = MEMO_HISTORY_LIMIT } = {}) {
    if (!targetSettings || typeof memo !== 'string' || !memo) return false;
    repairChatLinkMemoHistory(targetSettings);
    unshiftMemoAndMapHistory(targetSettings, memo, null, { max, preserveLive: true });
    return true;
}
