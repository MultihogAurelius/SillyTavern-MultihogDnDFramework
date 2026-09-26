import { trimMemoAndMapHistory } from './dungeon-map-history.js';

export const HISTORY_ENTRY_LIMIT = 20;
export const LOREBOOK_ROLLBACK_LIMIT = 5;

/** Bound memo/map snapshots and recent activity logs stored in settings. */
export function trimStoredHistories(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    let changed = trimMemoAndMapHistory(snapshot);
    for (const key of ['routerLog', 'routerHistory']) {
        const limit = key === 'routerHistory' ? LOREBOOK_ROLLBACK_LIMIT : HISTORY_ENTRY_LIMIT;
        if (Array.isArray(snapshot[key]) && snapshot[key].length > limit) {
            snapshot[key].length = limit;
            changed = true;
        }
    }
    for (const log of Object.values(snapshot.npcRelationshipLog || {})) {
        if (Array.isArray(log) && log.length > HISTORY_ENTRY_LIMIT) {
            log.length = HISTORY_ENTRY_LIMIT;
            changed = true;
        }
    }
    const companionHistory = snapshot.adventureCompanion?.history;
    if (Array.isArray(companionHistory) && companionHistory.length > HISTORY_ENTRY_LIMIT) {
        companionHistory.splice(0, companionHistory.length - HISTORY_ENTRY_LIMIT);
        changed = true;
    }
    return changed;
}
