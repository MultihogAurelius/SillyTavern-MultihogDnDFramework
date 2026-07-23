/**
 * Chat-linked persistence, tombstones, and module-schema WAL.
 */

import { BLOCK_ORDER } from '../../constants.js';
import { getNpcRelationshipMax } from './relationship-math.js';
import { getSettings, stripChatStateGlobalUiPrefs } from './settings.js';
import { snapshotStockPromptsForProfile } from './profiles.js';

// Kept only so legacy recovery code can be re-enabled deliberately. Normal tracker
// operation must not create or consume a browser-local recovery copy.
const LEGACY_BROWSER_SCHEMA_BACKUP_ENABLED = false;

/** Active chat id — prefer tracker-tracked id over raw ST context. */
export function getActiveChatId() {
    const ctx = SillyTavern.getContext();
    const tracked = typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : null;
    return tracked || ctx.getCurrentChatId?.() || ctx.chatId || null;
}

/**
 * When Chat Link is on, restore the WP timer label from chatStates if the live
 * field was cleared (e.g. after debounced settings reload) but the partition still has it.
 * @returns {boolean} true if a label was hydrated
 */
export function hydrateWorldProgressionFromChatState() {
    const s = getSettings();
    if (!s.chatLinkEnabled) return false;
    const chatId = getActiveChatId();
    if (!chatId) return false;
    const stored = s.chatStates?.[chatId];
    if (!stored?.worldProgressionLastFiredPeriodLabel) return false;
    if (s.worldProgressionLastFiredPeriodLabel) return false;
    s.worldProgressionLastFiredPeriodLabel = stored.worldProgressionLastFiredPeriodLabel;
    return true;
}

/** Persist the WP timer to the active chat partition or global settings. */
export function persistWorldProgressionTimer() {
    const s = getSettings();
    const chatId = getActiveChatId();
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    } else {
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/** Persist the Lorebook Agent "since last run" chat-length watermark. */
export function persistRouterLastRunWatermark(length) {
    const s = getSettings();
    s.routerLastRunChatLength = length;
    const chatId = getActiveChatId();
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    } else {
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/** Persist the Lorebook Agent "last ran at" timestamp (display only — separate from the indexing watermark). */
export function persistRouterLastRunTimestamp(epochMs = Date.now()) {
    const s = getSettings();
    s.routerLastRunAt = epochMs;
    const chatId = getActiveChatId();
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    } else {
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/**
 * Sync localStorage write-ahead log for module schema (customFields / blockOrder / modules).
 * Survives F5 when the async /api/settings/save fetch is cancelled mid-reload (common when
 * editing extension code then refreshing before ST's save completes).
 */
const MODULE_SCHEMA_BACKUP_KEY = 'rpg_tracker_module_schema_backup';
/** Sync tombstones for deleted custom module tags — survives cancelled settings saves even when WAL is missing. */
const DELETED_CUSTOM_TAGS_KEY = 'rpg_tracker_deleted_custom_tags';

/**
 * @returns {string[]}
 */
function readDeletedCustomTagTombstones() {
    try {
        const raw = localStorage.getItem(DELETED_CUSTOM_TAGS_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.map(t => String(t).toUpperCase()).filter(Boolean) : [];
    } catch {
        return [];
    }
}

/**
 * @param {string[]} tags
 */
function writeDeletedCustomTagTombstones(tags) {
    try {
        const uniq = [...new Set((tags || []).map(t => String(t).toUpperCase()).filter(Boolean))];
        if (uniq.length === 0) localStorage.removeItem(DELETED_CUSTOM_TAGS_KEY);
        else localStorage.setItem(DELETED_CUSTOM_TAGS_KEY, JSON.stringify(uniq));
    } catch (err) {
        console.warn('[RPG Tracker] Deleted-custom-tag tombstone write failed:', err);
    }
}

/**
 * Record custom module tags as intentionally deleted (sync localStorage).
 * @param {string|string[]} tags
 */
export function recordDeletedCustomTags(tags) {
    const add = (Array.isArray(tags) ? tags : [tags]).map(t => String(t || '').toUpperCase()).filter(Boolean);
    if (!add.length) return;
    const merged = new Set([...readDeletedCustomTagTombstones(), ...add]);
    writeDeletedCustomTagTombstones([...merged]);
}

/**
 * Clear tombstones when the user intentionally re-adds a custom tag.
 * @param {string|string[]} tags
 */
export function clearDeletedCustomTagTombstones(tags) {
    const remove = new Set((Array.isArray(tags) ? tags : [tags]).map(t => String(t || '').toUpperCase()).filter(Boolean));
    if (!remove.size) return;
    writeDeletedCustomTagTombstones(readDeletedCustomTagTombstones().filter(t => !remove.has(t)));
}

/**
 * Strip tombstoned custom modules from live settings and all chatStates partitions.
 * Call on boot before loadChatState.
 * @returns {boolean} true if anything was removed
 */
export function applyDeletedCustomTagTombstones() {
    const banned = new Set(readDeletedCustomTagTombstones());
    if (!banned.size) return false;
    const s = getSettings();
    let changed = false;

    const stripFields = (fields) => {
        if (!Array.isArray(fields)) return fields;
        const next = fields.filter(f => !banned.has(String(f?.tag || '').toUpperCase()));
        if (next.length !== fields.length) changed = true;
        return next;
    };
    const stripOrder = (order) => {
        if (!Array.isArray(order)) return order;
        const next = order.filter(t => !banned.has(String(t || '').toUpperCase()));
        if (next.length !== order.length) changed = true;
        return next;
    };

    s.customFields = stripFields(s.customFields || []);
    s.blockOrder = stripOrder(s.blockOrder || []);

    if (s.chatStates && typeof s.chatStates === 'object') {
        for (const chatId of Object.keys(s.chatStates)) {
            const part = s.chatStates[chatId];
            if (!part || typeof part !== 'object') continue;
            if (part.customFields) part.customFields = stripFields(part.customFields);
            if (part.blockOrder) part.blockOrder = stripOrder(part.blockOrder);
        }
    }

    return changed;
}

/**
 * @param {string|null|undefined} chatId
 */
export function writeModuleSchemaBackup(chatId) {
    if (!LEGACY_BROWSER_SCHEMA_BACKUP_ENABLED) return;
    try {
        const s = getSettings();
        const payload = {
            ts: Date.now(),
            chatId: chatId || null,
            customFields: JSON.parse(JSON.stringify(s.customFields || [])),
            blockOrder: JSON.parse(JSON.stringify(s.blockOrder || BLOCK_ORDER)),
            modules: JSON.parse(JSON.stringify(s.modules || {})),
            // Same race as customFields/blockOrder: a reload (code edit, extension
            // update, plain F5) fired before the debounced disk write landed reverts
            // these to whatever was last actually on disk. Mirror them too so edited
            // stock prompts / narrator toggles self-heal on the next boot.
            stockPrompts: JSON.parse(JSON.stringify(s.stockPrompts || {})),
            syspromptModules: JSON.parse(JSON.stringify(s.syspromptModules || {})),
            narrativePacing: s.narrativePacing || 'normal',
            cyoaConfig: JSON.parse(JSON.stringify(s.cyoaConfig || {})),
        };
        localStorage.setItem(MODULE_SCHEMA_BACKUP_KEY, JSON.stringify(payload));
    } catch (err) {
        console.warn('[RPG Tracker] Module schema backup write failed:', err);
    }
}

/**
 * Returns a local configuration backup only when it differs from disk-loaded settings.
 * The caller must ask the user before applying it.
 * @returns {object|null}
 */
export function getPendingModuleSchemaBackup() {
    if (!LEGACY_BROWSER_SCHEMA_BACKUP_ENABLED) return null;
    try {
        const raw = localStorage.getItem(MODULE_SCHEMA_BACKUP_KEY);
        if (!raw) return null;
        const backup = JSON.parse(raw);
        if (!backup || !Array.isArray(backup.customFields) || !Array.isArray(backup.blockOrder)) return null;

        const s = getSettings();
        const liveTags = JSON.stringify((s.customFields || []).map(f => f.tag));
        const backupTags = JSON.stringify(backup.customFields.map(f => f.tag));
        const liveOrder = JSON.stringify(s.blockOrder || []);
        const backupOrder = JSON.stringify(backup.blockOrder);
        const liveStockPrompts = JSON.stringify(s.stockPrompts || {});
        const backupStockPrompts = JSON.stringify(backup.stockPrompts || {});
        const liveSyspromptModules = JSON.stringify(s.syspromptModules || {});
        const backupSyspromptModules = JSON.stringify(backup.syspromptModules || {});
        const liveNarrativePacing = s.narrativePacing || 'normal';
        const backupNarrativePacing = backup.narrativePacing || 'normal';
        const liveCyoaConfig = JSON.stringify(s.cyoaConfig || {});
        const backupCyoaConfig = JSON.stringify(backup.cyoaConfig || {});
        const alreadyMatched = liveTags === backupTags && liveOrder === backupOrder
            && (!backup.stockPrompts || liveStockPrompts === backupStockPrompts)
            && (!backup.syspromptModules || liveSyspromptModules === backupSyspromptModules)
            && liveNarrativePacing === backupNarrativePacing
            && (!backup.cyoaConfig || liveCyoaConfig === backupCyoaConfig);
        return alreadyMatched ? null : backup;
    } catch (err) {
        console.warn('[RPG Tracker] Module schema backup inspection failed:', err);
        return null;
    }
}

/**
 * Apply a previously inspected local configuration backup only after the user
 * explicitly approves restoring it over disk-loaded settings.
 * @param {string|null|undefined} preferredChatId
 * @param {object|null} backupOverride
 * @returns {boolean} true if a backup was applied
 */
export function applyModuleSchemaBackup(preferredChatId, backupOverride = null) {
    if (!LEGACY_BROWSER_SCHEMA_BACKUP_ENABLED) return false;
    try {
        const backup = backupOverride || getPendingModuleSchemaBackup();
        if (!backup) return false;

        const s = getSettings();
        const backupNarrativePacing = backup.narrativePacing || 'normal';

        // Always restore live schema from the last known-good in-memory snapshot.
        // If the async disk write completed, this matches disk. If it was cancelled on
        // F5, this heals the resurrection of deleted modules from a stale settings.js.
        s.customFields = JSON.parse(JSON.stringify(backup.customFields));
        s.blockOrder = JSON.parse(JSON.stringify(backup.blockOrder));
        if (backup.modules && typeof backup.modules === 'object') {
            s.modules = { ...s.modules, ...JSON.parse(JSON.stringify(backup.modules)) };
        }
        if (backup.stockPrompts && typeof backup.stockPrompts === 'object') {
            s.stockPrompts = { ...s.stockPrompts, ...JSON.parse(JSON.stringify(backup.stockPrompts)) };
        }
        if (backup.syspromptModules && typeof backup.syspromptModules === 'object') {
            s.syspromptModules = { ...s.syspromptModules, ...JSON.parse(JSON.stringify(backup.syspromptModules)) };
        }
        s.narrativePacing = backupNarrativePacing;
        if (backup.cyoaConfig && typeof backup.cyoaConfig === 'object') {
            s.cyoaConfig = JSON.parse(JSON.stringify(backup.cyoaConfig));
        }

        // Custom tracker definitions are global. Do not reintroduce a per-chat
        // copy while recovering a write-ahead backup.
        void preferredChatId;

        return true;
    } catch (err) {
        console.warn('[RPG Tracker] Module schema backup apply failed:', err);
        return false;
    }
}

export function saveChatState(chatId, opts = {}) {
    if (!chatId) return;
    if (typeof globalThis._rpgPortraitMigrationLocked === 'function' && globalThis._rpgPortraitMigrationLocked()) {
        return;
    }
    // Flush pending raw-textarea edits into settings.currentMemo before snapshotting.
    // The flush must NOT call saveChatState/saveSettings (re-entrancy).
    if (typeof globalThis._rpgFlushRawMemoChanges === 'function') {
        globalThis._rpgFlushRawMemoChanges();
    }
    const s = getSettings();
    if (!s.chatStates) s.chatStates = {};
    // This stamp belongs to the specific chat snapshot. The top-level timestamp is
    // shared by every chat, so it cannot safely decide whether this chat's disk memo
    // is newer than a browser-local recovery snapshot.
    const memoPersistedAt = Date.now();
    s.memoPersistedAt = memoPersistedAt;
    // Preserve fields that are written outside the normal save cycle (e.g. campaignBooks)
    const existing = s.chatStates[chatId] || {};
    s.chatStates[chatId] = {
        currentMemo:  s.currentMemo,
        memoPersistedAt,
        memoPersistedBy: s.memoPersistedBy || null,
        memoHistory:  JSON.parse(JSON.stringify(s.memoHistory)),
        lastDelta:    s.lastDelta || '',
        customPortraits: JSON.parse(JSON.stringify(s.customPortraits || {})),
        customLocationImages: JSON.parse(JSON.stringify(s.customLocationImages || {})),
        modules:      JSON.parse(JSON.stringify(s.modules)),
        blockOrder:   JSON.parse(JSON.stringify(s.blockOrder  || BLOCK_ORDER)),
        stockPrompts: snapshotStockPromptsForProfile(s.stockPrompts),
        quests:       JSON.parse(JSON.stringify(s.quests || [])), // persist full array (incl. completed) for cross-session UI display
        historyIndex: s.historyIndex ?? -1,
        activeRouterKeys: JSON.parse(JSON.stringify(s.activeRouterKeys || [])),
        activeWorldKeys:  JSON.parse(JSON.stringify(s.activeWorldKeys || [])),
        keywordActivatedKeys: JSON.parse(JSON.stringify(s.keywordActivatedKeys || [])),
        routerLog:    JSON.parse(JSON.stringify(s.routerLog || [])),
        routerCampaignPrefix: s.routerCampaignPrefix || '',
        routerLookback: s.routerLookback || 4,
        routerLastRunChatLength: s.routerLastRunChatLength ?? 0,
        routerLastRunAt: s.routerLastRunAt ?? 0,
        routerDirectPrompt: s.routerDirectPrompt || '',
        routerDirectLookback: s.routerDirectLookback || 10,
        routerDefaultPosition: s.routerDefaultPosition ?? 4,
        routerDefaultDepth: s.routerDefaultDepth ?? 4,
        routerDefaultOrder: s.routerDefaultOrder ?? 100,
        routerDefaultRole: s.routerDefaultRole ?? 0,
        loreInjectionPosition: s.loreInjectionPosition ?? 4,
        loreInjectionDepth: s.loreInjectionDepth ?? 4,
        loreInjectionRole: s.loreInjectionRole ?? 0,
        worldProgressionLookback: s.worldProgressionLookback ?? 20,
        worldProgressionHistoryLookback: s.worldProgressionHistoryLookback ?? 0,
        worldProgressionInjectionPosition: s.worldProgressionInjectionPosition ?? 4,
        worldProgressionInjectionDepth: s.worldProgressionInjectionDepth ?? 3,
        worldProgressionInjectionRole: s.worldProgressionInjectionRole ?? 0,
        worldProgressionRandomizeNPCs: s.worldProgressionRandomizeNPCs ?? false,
        worldProgressionRandomSkeletonNPCCount: s.worldProgressionRandomSkeletonNPCCount ?? 2,
        worldProgressionRandomNarrativeNPCCount: s.worldProgressionRandomNarrativeNPCCount ?? 3,
        worldProgressionRandomizeLocations: s.worldProgressionRandomizeLocations ?? false,
        worldProgressionRandomSkeletonLocationCount: s.worldProgressionRandomSkeletonLocationCount ?? 2,
        worldProgressionRandomNarrativeLocationCount: s.worldProgressionRandomNarrativeLocationCount ?? 2,
        worldProgressionRandomizeFactions: s.worldProgressionRandomizeFactions ?? false,
        worldProgressionRandomSkeletonFactionCount: s.worldProgressionRandomSkeletonFactionCount ?? 2,
        worldProgressionRandomNarrativeFactionCount: s.worldProgressionRandomNarrativeFactionCount ?? 2,
        worldProgressionRandomizeConflicts: s.worldProgressionRandomizeConflicts ?? false,
        worldProgressionRandomConflictCount: s.worldProgressionRandomConflictCount ?? 3,
        worldProgressionSkeletonFactions: s.worldProgressionSkeletonFactions ?? 4,
        worldProgressionSkeletonLocations: s.worldProgressionSkeletonLocations ?? 4,
        worldProgressionSkeletonNPCs: s.worldProgressionSkeletonNPCs ?? 0,
        worldProgressionSkeletonConflicts: s.worldProgressionSkeletonConflicts ?? 3,
        // World Progression per-chat time tracking
        worldProgressionLastFiredAtMinutes: s.worldProgressionLastFiredAtMinutes ?? -1,
        worldProgressionLastFiredPeriodLabel: s.worldProgressionLastFiredPeriodLabel || '',
        worldProgressionSkeletonAtmosphereSummary: s.worldProgressionSkeletonAtmosphereSummary || '',
        worldProgressionSkeletonAtmosphereLookback: s.worldProgressionSkeletonAtmosphereLookback ?? 30,
        worldProgressionSkeletonUseExisting: s.worldProgressionSkeletonUseExisting ?? true,
        worldProgressionConsolidateEnabled: s.worldProgressionConsolidateEnabled ?? false,
        worldProgressionConsolidateInterval: s.worldProgressionConsolidateInterval ?? 7,
        worldProgressionExclusionList: s.worldProgressionExclusionList || '',

        // Per-chat time/date formatting (24h clock, DD/MM/YYYY vs Day N, initial anchor)
        use24hTime: !!s.use24hTime,
        useDdMmYyFormat: !!s.useDdMmYyFormat,
        initialDate: s.initialDate || 'Day 1',
        npcRelationshipMax: getNpcRelationshipMax(s),

        // Preserve lorebook stack link — written by Link button and router, not by normal state saves
        campaignBooks: existing.campaignBooks || [],

        // Real-Time Mode: last scene location we generated art for (survives F5)
        lastImmersionSceneArtPath: existing.lastImmersionSceneArtPath || null,
        // Chat length at last Real-Time scene-art generation (for every-N-outputs mode)
        lastImmersionSceneArtChatLen: existing.lastImmersionSceneArtChatLen ?? null,

        // Preserve Player Character pseudo-persona which is injected into the chat state
        playerCharacter: existing.playerCharacter,
    };

    // Sync WAL before the async disk write — survives F5 if /api/settings/save is cancelled.
    writeModuleSchemaBackup(chatId);
    // Drop any legacy global-UI keys copied into older partitions.
    stripChatStateGlobalUiPrefs(s);
    
    // Use a synchronous save so data is not lost if the page is closed before
    // a debounced timer fires (the root cause of the PC/state/relationship loss bug).
    // saveChatState is always called with an explicit chatId so there is no
    // cross-chat leakage risk from this call itself.
    // When called from our saveSettings(), skipDiskWrite avoids a duplicate in-flight save.
    if (opts.skipDiskWrite) return;
    const ctx = SillyTavern.getContext();
    if (typeof ctx.saveSettings === 'function') {
        ctx.saveSettings();
    } else if (typeof ctx.saveSettingsDebounced === 'function') {
        ctx.saveSettingsDebounced();
    }
}
