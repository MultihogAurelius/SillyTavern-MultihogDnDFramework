import { getSettings, getEffectiveRouterCampaignPrefix, persistWorldProgressionTimer, persistRouterLastRunWatermark, persistRouterLastRunTimestamp, persistMapEvolutionState, getNpcRelationshipMax, clampRelationshipValue, buildRouterRelationshipInstruction, sanitizeRouterState, adjustPromptTimestamps, DEFAULT_NPC_SECTIONS, saveChatState, computeUnpinnedActiveCount, extractCharacterBlock, isPcCoreTarget, isAppearanceField, isEquipmentField, isCombatProfileField, getEligibleCoreFieldNames, patchLabeledSection, mergePreservedColorMarkup, expandLorebookPromptTemplate, resolveRecordCategoryTag, getEnabledRouterCategoryTags, getRouterCategoryBookSuffix, buildRouterCategoryMap } from './state-manager.js';
import { sendStateRequest, sendAgentTurn } from './llm-client.js';
import { getRequestHeaders } from '../../../../script.js';
import { extractCurrentTimeStr, cleanMessageContent, parseInWorldTime, formatInWorldTime, findNthUserMessageStartIdx, formatAgentChatLogFromIndex, sanitizeLorebookRecordContent, parseJsonWithColorRepair } from './memo-processor.js';
import { recordSchedulerEvent } from './swipe-scheduler-debug.js';
import { saveSettings } from './src/app/runtime-bridge.js';
import { isLorebookAgentRuntimeActive, isLocationMappingEnabled } from './src/state/section-enabled.js';
import { buildSkeletonLorebookSourceContext } from './src/features/world-progression/skeleton-lorebooks.js';
import { buildNpcRelationshipInstruction } from './src/state/relationship-prompts.js';
import {
    resolveAutoPassRestriction,
    resolveCombatProfileGuidance,
    resolveExistingNpcNudge,
} from './src/state/lorebook-runtime-fragments.js';
import {
    bookBelongsToCampaignPrefix as bookBelongsToPrefix,
    getCreatedLorebookNames,
    getLorebookSnapshotNames,
    isLoreHistoryEntryForChat,
    isLoreRedoEntryForChat,
    trimLoreHistoryForRollback,
} from './src/state/lorebook-history.js';
import { buildKeyringText, grepLoreInBooks, isSkeletonBookName, resolveBooksToScan } from './src/state/lorebook-keyring.js';
import { findMostRecentNarratorMessage, stripCyoaChoiceBlocks } from './src/state/present-now.js';
import {
    applyDungeonMapTransaction,
    attachDungeonMapToLocationEntry,
    detachDungeonMapFromLocationEntry,
    buildDungeonSitesFromLocationEntries,
    collectDungeonMapCandidates,
    dungeonLabelIdentitiesMatch,
    dungeonLabelsMatch,
    dungeonSiteRootsMatch,
    normalizeDungeonLabel,
    normalizeMapSiteKind,
    extractDungeonMapSection,
    extractFooterLocation,
    findLatestDungeonLocation,
    locationContainsSiteRoot,
    getDungeonMapAttachment,
    listMappedSiteDocuments,
    migrateDungeonMapAttachmentToContent,
    parseDungeonMapDocument,
    reconcileDungeonMapAreaKnowledge,
    replaceDungeonMapSection,
    resolveActiveDungeonSite,
    resolveCurrentMapPlacement,
    serializeDungeonMapDocument,
    stripDungeonMapSection,
    collectDungeonMapHistorySnapshot,
    applyDungeonMapHistorySnapshotToBook,
    DUNGEON_MAP_OPERATION_IDS_KEY,
} from './dungeon-reality.js';
import { recordLiveDungeonMapSnapshot } from './src/state/dungeon-map-history.js';
import { buildHostedPeerSitePath, ensureHostCoreMirror, MAX_HOSTED_MAP_DEPTH, reparentHostedLocationEntries, stampHostedPeerDocument } from './map-hosting.js';
import { clearEvolutionHistoryForSite, setSiteEvolutionIntervalOverride } from './map-evolution-lib.js';
import {
    buildWorldProgressionLocationDossiers,
    normalizeWorldReportMetadata,
    selectWorldProgressionLocations,
    stampLocationAdvancement,
    WORLD_REPORT_METADATA_KEY,
} from './world-progression-lib.js';

let _routerRunning = false;
let _routerNormalRunCount = 0; // tracks completed normal (non-cleanup) passes for auto-cleanup interval
let _routerController = null; // AbortController for the active router pass

/** Returns true while a router pass is actively running. */
export function isRouterRunning() { return _routerRunning; }

/**
 * Aborts the currently-running Lorebook Agent pass, if any.
 * Equivalent to the State Tracker's stop button: kills the in-flight LLM request.
 */
export function stopRouterPass() {
    if (_routerController) {
        _routerController.abort();
        _routerController = null;
    }
}

/**
 * Returns the current campaign prefix (user override in settings, else chat id).
 * Returns '' only if there is no usable prefix.
 */
function getLivePrefix() {
    const ctx = SillyTavern.getContext();
    return getEffectiveRouterCampaignPrefix(ctx.chatId || '');
}

function isSkeletonEntryId(entryId) {
    if (!entryId || typeof entryId !== 'string' || !entryId.includes('::')) return false;
    return isSkeletonBookName(entryId.split('::')[0]);
}

/** Extract canonical [COMBAT] block from the current memo, if present. */
function extractActiveCombatBlock(memo) {
    const match = memo?.match(/\[COMBAT\]([\s\S]*?)\[\/COMBAT\]/i);
    return match ? `[COMBAT]${match[1].trim()}[/COMBAT]` : null;
}

/** Resolve the linked Player Character card for the active chat, if any. */
function getLinkedPlayerCharacter() {
    try {
        const settings = getSettings();
        const chatId = SillyTavern.getContext()?.chatId;
        if (!chatId || !settings.chatStates?.[chatId]?.playerCharacter) return null;
        return settings.chatStates[chatId].playerCharacter;
    } catch (_) {
        return null;
    }
}

/**
 * Apply a Body or Worn Equipment (only) patch to the linked PC card's flat bio string.
 * Species/Personality/Background/etc. are never mutable by the Lorebook Agent for
 * the PC — those are the player's own, set at character creation.
 * @returns {{ ok: boolean, error?: string }}
 */
function applyPcCoreUpdate(pc, field, content) {
    if (!pc) return { ok: false, error: 'No Player Character card linked' };
    if (!isAppearanceField(field) && !isEquipmentField(field)) {
        return { ok: false, error: 'PC updates are limited to Body and Worn Equipment' };
    }
    const targetField = isEquipmentField(field) ? 'Worn Equipment' : 'Body';
    const result = patchLabeledSection(pc.bio || '', targetField, content, { isPc: true });
    if (!result.ok) return { ok: false, error: result.error || 'Failed to patch PC bio' };
    pc.bio = result.text;
    pc.timestamp = Date.now();
    try {
        const chatId = SillyTavern.getContext()?.chatId;
        if (chatId) saveChatState(chatId);
        else void saveSettings();
    } catch (_) {
        void saveSettings();
    }
    try {
        if (typeof globalThis._rpgRefreshLorebookAgentViews === 'function') {
            void globalThis._rpgRefreshLorebookAgentViews();
        } else if (typeof globalThis._rpgRenderRouterUI === 'function') {
            globalThis._rpgRenderRouterUI();
        }
    } catch (_) {}
    return { ok: true };
}

/** Router guidance when ACTIVE COMBAT STATE is injected this turn. */
/**
 * Resolve Book::UID or plain NPC label to a full lore entry id.
 * @returns {Promise<string|null>}
 */
async function resolveLoreEntryId(id, allBooks, newlyCreatedMap = {}) {
    if (!id || typeof id !== 'string') return null;
    if (id.includes('::')) return id;

    const cleanId = id.toLowerCase().trim();
    if (newlyCreatedMap[cleanId]) return newlyCreatedMap[cleanId];

    const prefix = getLivePrefix();
    const npcBookName = prefix ? `${prefix}_NPCs` : 'NPCs';
    let npcBook = null;
    try {
        npcBook = await SillyTavern.getContext().loadWorldInfo(npcBookName);
    } catch (_) {}

    if (npcBook?.entries) {
        for (const [uid, entry] of Object.entries(npcBook.entries)) {
            const label = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
            if (label === cleanId) return `${npcBookName}::${uid}`;
        }
    }

    for (const [bookName, bookData] of Object.entries(allBooks || {})) {
        if (!bookData?.entries) continue;
        for (const [uid, entry] of Object.entries(bookData.entries)) {
            const label = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
            if (label === cleanId) return `${bookName}::${uid}`;
        }
    }

    return null;
}

/** Remove any skeleton IDs that leaked into Lorebook Agent active pools. @returns {boolean} */
function stripSkeletonFromRouterPools() {
    const settings = getSettings();
    const strip = (arr) => (arr || []).filter(id => !isSkeletonEntryId(id));
    const beforeRouter = JSON.stringify(settings.activeRouterKeys || []);
    const beforeKw = JSON.stringify(settings.keywordActivatedKeys || []);
    const beforePinned = JSON.stringify(settings.pinnedRouterKeys || []);
    settings.activeRouterKeys = strip(settings.activeRouterKeys);
    settings.keywordActivatedKeys = strip(settings.keywordActivatedKeys);
    settings.pinnedRouterKeys = strip(settings.pinnedRouterKeys);
    return beforeRouter !== JSON.stringify(settings.activeRouterKeys)
        || beforeKw !== JSON.stringify(settings.keywordActivatedKeys)
        || beforePinned !== JSON.stringify(settings.pinnedRouterKeys);
}

/**
 * Lorebook Agent archive fetch — excludes World Skeleton books.
 * @param {string} prefix
 * @param {object} ctx
 */
async function fetchRouterArchiveBooks(prefix, ctx) {
    const settings = getSettings();
    const chatId = getRouterChatId(ctx);
    const ownedNames = chatId ? (settings.chatStates?.[chatId]?.campaignBooks || []) : [];
    // The per-chat ownership list is the hot path. Union the already-loaded ST
    // registry for newly linked/legacy books, but never enumerate every lorebook
    // on disk during an automatic Lorebook Agent pass.
    const registryNames = await getWorldInfoNamesSafe({ fullProbe: false });
    const allBookNames = [...new Set([...ownedNames, ...registryNames])];
    const inScope = (n) => !prefix || bookBelongsToPrefix(n, prefix);
    const scoped = new Set(prefix ? allBookNames.filter(inScope) : allBookNames);

    const books = {};
    const loaded = await Promise.all([...scoped].map(async (n) => {
        const b = await loadWorldInfoFresh(n, ctx);
        if (!b?.entries) throw new Error(`Cannot safely load campaign lorebook "${n}".`);
        return [n, b];
    }));
    for (const row of loaded) {
        if (row) books[row[0]] = row[1];
    }
    return books;
}

/**
 * Parses a single Action: toolname({...}) call from a text response.
 * Used as a fallback for profile/default connections that don't support native tool calling.
 * Safe because the caller always passes a single-turn response (multi-turn messages mean
 * the model never echoes prior turns, so only one action appears in the text).
 *
 * @param {string} text
 * @returns {{name: string, args: object, id: string} | null}
 */
function parseTextAction(text) {
    // Find the last "Action:" line to be safe, then extract the balanced JSON argument.
    // Tolerates markdown formatting like **Action:**, *Action:*, ### Action, - Action: etc.
    const parts = ('\n' + text).split(/\n(?:\*\*|\*|__|_|###|##|#|-|\s)*Action\b(?:\*\*|\*|__|_|:|\s)*\s*/i);
    if (parts.length < 2) return null;
    const lastPart = parts[parts.length - 1].trim();

    // Extract the tool name
    const nameMatch = lastPart.match(/^(\w+)\s*\(/);
    if (!nameMatch) return null;
    const name = nameMatch[1].toLowerCase();

    // Extract balanced-paren args starting after the tool name
    const parenStart = lastPart.indexOf('(');
    if (parenStart === -1) return null;
    let depth = 0, end = -1;
    for (let i = parenStart; i < lastPart.length; i++) {
        if (lastPart[i] === '(') depth++;
        else if (lastPart[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    const rawArgs = end !== -1 ? lastPart.slice(parenStart + 1, end) : lastPart.slice(parenStart + 1);

    // For tools that take a bare string (grep_lore, inspect_book, read_entry), wrap in object
    let args;
    try {
        // Try JSON first
        let cleaned = rawArgs.trim();
        if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
            // Bare string argument like grep_lore("Iron Syndicate")
            cleaned = cleaned.replace(/^['"]|['"]$/g, '');
            const argNames = { grep_lore: 'query', inspect_book: 'book_name', read_entry: 'uid' };
            args = { [argNames[name] || 'value']: cleaned };
        } else {
            cleaned = cleaned.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
            const parsed = parseJsonWithColorRepair(cleaned);
            if (!parsed.ok) throw new Error(parsed.error || 'Invalid JSON');
            args = parsed.value;
        }
    } catch (_) {
        return null;
    }

    return { name, args, id: `text_${Date.now()}` };
}

/**
 * Broadcasts an agent step to the UI for the Terminal view.
 */
function broadcastStep(type, content, metadata = {}) {
    document.dispatchEvent(new CustomEvent('rt_lore_agent_step', {
        detail: { type, content, metadata: { source: 'lorebook_agent', ...metadata }, timestamp: Date.now() }
    }));
}

/**
 * Compatibility helper for older SillyTavern versions.
 * Uses the frontend registry for the normal path and the dedicated backend
 * lorebook-list endpoint for a disk-authoritative refresh.
 *
 * Do not use /api/settings/get here. That endpoint returns the user's complete
 * settings payload, which can be hundreds of megabytes on long-running
 * Multihog installs. Parsing it during every manifest refresh was the main
 * Persistent Maps slowdown.
 */
async function getWorldInfoNamesSafe(options = {}) {
    const fullProbe = options.fullProbe !== false;
    const ctx = SillyTavern.getContext();
    const frontendNames = new Set();
    
    // 1. Check frontend registry (may be stale or incomplete if books aren't linked yet)
    try {
        if (typeof ctx.getWorldInfoNames === 'function') {
            const res = await ctx.getWorldInfoNames();
            if (Array.isArray(res)) res.forEach(n => frontendNames.add(n));
        } else if (typeof ctx.getLorebookList === 'function') {
            const res = await ctx.getLorebookList();
            if (Array.isArray(res)) res.forEach(n => frontendNames.add(n));
        }
    } catch (_) {}

    if (!fullProbe) {
        return [...frontendNames];
    }

    // 2. Probe the dedicated backend list endpoint. Once it answers, its result
    // is authoritative: unioning it with the frontend registry would resurrect
    // deleted lorebooks that still exist only in SillyTavern's in-memory cache.
    const backendNames = new Set();
    let backendResponded = false;
    try {
        const r = await fetch('/api/worldinfo/list', { method: 'POST', headers: getRequestHeaders() });
        if (r.ok) {
            const j = await r.json();
            if (Array.isArray(j)) {
                backendResponded = true;
                j.forEach(entry => { if (entry?.file_id) backendNames.add(entry.file_id); });
            }
        }
    } catch (_) {}

    return backendResponded ? [...backendNames] : [...frontendNames];
}

/**
 * Cheap existence guard for passive reads. SillyTavern's /worldinfo/get returns
 * an empty dummy for a missing file and logs an error, so probing a generated
 * `<prefix>_Locations` name on every map/UI refresh creates an error storm.
 * The already-loaded frontend registry is authoritative when available.
 */
export async function isWorldInfoBookKnown(bookName, ctx = SillyTavern.getContext()) {
    const wanted = String(bookName || '').trim().toLowerCase();
    if (!wanted) return false;

    try {
        const getter = typeof ctx?.getWorldInfoNames === 'function'
            ? ctx.getWorldInfoNames.bind(ctx)
            : (typeof ctx?.getLorebookList === 'function' ? ctx.getLorebookList.bind(ctx) : null);
        if (getter) {
            const names = await getter();
            if (Array.isArray(names)) {
                return names.some(name => String(name || '').toLowerCase() === wanted);
            }
        }
    } catch (_) {
        // Fall through to the per-chat ownership list on older ST versions.
    }

    const settings = getSettings();
    const chatId = getRouterChatId(ctx);
    const knownBooks = chatId ? settings.chatStates?.[chatId]?.campaignBooks : [];
    return (knownBooks || []).some(name => String(name || '').toLowerCase() === wanted);
}

function cloneRouterValue(value, fallback) {
    return JSON.parse(JSON.stringify(value ?? fallback));
}

function getRouterChatId(ctx = SillyTavern.getContext()) {
    return (typeof globalThis._rpgCurrentChatId === 'function' && globalThis._rpgCurrentChatId())
        || ctx?.chatId
        || null;
}

/**
 * Record a lorebook on the active chat's campaignBooks list so boot / chat-switch
 * `/world state=on` and the keyword scanner's fast path can find it. Newly created
 * NPCs books were previously omitted here, so ST native WI and the scanner both
 * skipped them until a manual Activate Campaign Lorebooks.
 * @param {string} bookName
 * @param {object} [settings]
 * @returns {boolean} true when the list changed
 */
export function rememberCampaignBook(bookName, settings = getSettings()) {
    if (!bookName) return false;
    const chatId = getRouterChatId();
    if (!chatId) return false;
    settings.chatStates = settings.chatStates || {};
    settings.chatStates[chatId] = settings.chatStates[chatId] || {};
    const existing = new Set(settings.chatStates[chatId].campaignBooks || []);
    const before = existing.size;
    existing.add(bookName);
    settings.chatStates[chatId].campaignBooks = [...existing];
    return existing.size !== before;
}

function buildRouterLoreState(settings, { prefix, chatId, bookSnapshots }) {
    const chatState = chatId ? settings.chatStates?.[chatId] : null;
    return {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        campaignPrefix: prefix || '',
        chatId,
        campaignBookNames: Object.keys(bookSnapshots || {}),
        campaignBooks: cloneRouterValue(chatState?.campaignBooks, []),
        activeRouterKeys: cloneRouterValue(settings.activeRouterKeys, []),
        activeWorldKeys: cloneRouterValue(settings.activeWorldKeys, []),
        keywordActivatedKeys: cloneRouterValue(settings.keywordActivatedKeys, []),
        pinnedRouterKeys: cloneRouterValue(settings.pinnedRouterKeys, []),
        routerLog: cloneRouterValue(settings.routerLog, []),
        pcCharacterBlockSeeded: !!settings.pcCharacterBlockSeeded,
        routerLastRunChatLength: settings.routerLastRunChatLength ?? 0,
        routerLastRunAt: settings.routerLastRunAt ?? 0,
        bookSnapshots: cloneRouterValue(bookSnapshots, {}),
    };
}

/** Loads current disk data, bypassing SillyTavern's worldInfoCache. */
async function loadWorldInfoFresh(bookName, ctx = SillyTavern.getContext()) {
    try {
        const response = await fetch('/api/worldinfo/get', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name: bookName }),
        });
        // A completed backend response is authoritative, including "not found".
        if (!response.ok) return null;
        const data = await response.json();
        return data && typeof data === 'object' && data.entries ? data : null;
    } catch (_) {
        // Compatibility fallback for old builds where the direct endpoint is unavailable.
        try {
            const data = await ctx.loadWorldInfo(bookName);
            return data?.entries ? data : null;
        } catch (_) {
            return null;
        }
    }
}

async function evictWorldInfoCache(bookName) {
    try {
        const { worldInfoCache } = await import('../../../world-info.js');
        worldInfoCache?.delete?.(bookName);
    } catch (_) {
        // The direct, authoritative reads below still keep the Agent UI correct on old builds.
    }
}

export async function updateWorldInfoCache(bookName, bookData) {
    try {
        const { worldInfoCache } = await import('../../../world-info.js');
        if (typeof worldInfoCache?.set !== 'function') return false;
        worldInfoCache.set(bookName, bookData);
        return true;
    } catch (_) {
        return false;
    }
}

async function deleteWorldInfoFresh(bookName) {
    const response = await fetch('/api/worldinfo/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: bookName }),
    });
    if (!response.ok) {
        throw new Error(`Failed to delete ${bookName}: HTTP ${response.status}`);
    }
    await evictWorldInfoCache(bookName);
}

async function saveWorldInfoSnapshot(bookName, bookData, ctx, operationLabel) {
    const response = await fetch('/api/worldinfo/edit', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: bookName, data: bookData }),
    });
    if (!response.ok) {
        throw new Error(`${operationLabel}: failed to restore ${bookName}: HTTP ${response.status}`);
    }
    const cacheUpdated = await updateWorldInfoCache(bookName, bookData);
    if (!cacheUpdated && typeof ctx.saveWorldInfo === 'function') {
        try { await ctx.saveWorldInfo(bookName, bookData); } catch (_) { /* backend write already succeeded */ }
    }
}

/**
 * Persist the GM's one-time hidden map on a real root Location entry, then
 * return every attached site with its descendant Location records. The map is
 * stored in entry extension metadata so normal lorebook views never reveal it.
 */
export async function syncDungeonMapsToLocationLorebook(chat, { capture = true } = {}) {
    const ctx = SillyTavern.getContext();
    const prefix = getLivePrefix();
    if (!prefix) return { sites: {}, changed: false, capturedMaps: 0, errors: ['no campaign prefix is available'] };

    const bookName = `${prefix}_Locations`;
    const collected = capture ? collectDungeonMapCandidates(chat) : { maps: [], errors: [] };
    const bookKnown = await isWorldInfoBookKnown(bookName, ctx);
    let bookData = bookKnown ? await loadWorldInfoFresh(bookName, ctx) : null;
    if (!bookData) {
        if (!collected.maps.length) {
            return { bookName, sites: {}, changed: false, capturedMaps: 0, errors: collected.errors };
        }
        if (bookKnown) {
            throw new Error(`Refusing to replace existing Locations lorebook "${bookName}" because it could not be loaded.`);
        }
        bookData = {
            entries: {},
            name: bookName,
            scan_depth: 4,
            token_budget: 400,
            recursive: false,
            extensions: {},
        };
    }

    let changed = false;
    let capturedMaps = 0;
    for (const entry of Object.values(bookData.entries || {})) {
        if (migrateDungeonMapAttachmentToContent(entry)) changed = true;
        if (getDungeonMapAttachment(entry) && entry.disable !== true) {
            entry.disable = true;
            changed = true;
        }
    }

    for (const entry of Object.values(bookData.entries || {})) {
        if (getDungeonMapAttachment(entry) && reconcileDungeonMapAreaKnowledge(entry, bookData.entries)) changed = true;
    }
    for (const map of collected.maps) {
        let rootEntry = Object.values(bookData.entries || {}).find(entry => {
            const label = String(entry?.comment || '').trim();
            return label && !label.includes('::') && dungeonSiteRootsMatch(label, map.siteRoot);
        });

        if (!rootEntry) {
            const uids = Object.keys(bookData.entries || {}).map(Number).filter(Number.isFinite);
            const nextUid = uids.length ? Math.max(...uids) + 1 : 0;
            rootEntry = {
                uid: nextUid,
                key: [map.siteRoot],
                keysecondary: [],
                comment: map.siteRoot,
                content: `[CORE]\n${map.siteRoot} is a mapped site. Its private map stores current objective reality; child Location entries preserve player-observable history.\n[/CORE]`,
                constant: false,
                selective: false,
                selectiveLogic: 0,
                addMemo: true,
                order: getSettings().routerDefaultOrder ?? 100,
                position: getSettings().routerDefaultPosition ?? 0,
                disable: true,
                probability: 100,
                useProbability: false,
                depth: getSettings().routerDefaultDepth ?? 4,
                group: '',
                groupOverride: false,
                groupWeight: 100,
                extensions: {},
            };
            bookData.entries[nextUid] = rootEntry;
            changed = true;
        }

        if (attachDungeonMapToLocationEntry(rootEntry, map)) {
            rootEntry.disable = true;
            capturedMaps++;
            changed = true;
        }
    }

    // A map captured during this pass did not exist during the reconciliation
    // above. Reconcile once more so pre-existing child Locations immediately mark
    // its areas VISITED instead of requiring a second Lorebook Agent pass.
    for (const entry of Object.values(bookData.entries || {})) {
        if (getDungeonMapAttachment(entry) && reconcileDungeonMapAreaKnowledge(entry, bookData.entries)) changed = true;
    }

    if (changed) {
        await saveWorldInfoSnapshot(bookName, bookData, ctx, 'Dungeon map persistence');
        recordLiveDungeonMapSnapshot(getSettings(), collectDungeonMapHistorySnapshot(bookData.entries, bookName));
        if (!bookKnown && typeof ctx.updateWorldInfoList === 'function') {
            try { await ctx.updateWorldInfoList(); } catch (_) {}
        }
        if (typeof ctx.reloadWorldInfoEditor === 'function') ctx.reloadWorldInfoEditor(bookName);
        document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));
    }

    return {
        bookName,
        sites: buildDungeonSitesFromLocationEntries(bookData.entries, bookName),
        bookData,
        changed,
        capturedMaps,
        errors: collected.errors,
    };
}

function rootEntryByExactSite(entries, site) {
    return Object.values(entries || {}).find(entry => {
        const label = String(entry?.comment || '').trim();
        return label && !label.includes('::') && label === site;
    }) || null;
}

function entryUidFromCompositeId(entryId) {
    const value = String(entryId || '');
    const separator = value.lastIndexOf('::');
    return separator >= 0 ? value.slice(separator + 2) : value;
}

function allocateHostedAssetId(document, name) {
    const used = new Set((document.assets || []).map(asset => asset.id));
    const base = `subsite-${mapTransactionSignature(String(name || '')).slice(0, 8)}`;
    if (!used.has(base)) return base;
    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix++;
    return `${base}-${suffix}`;
}

function promoteHostedPeerAsset(hostDocument, site, expectedKind, areaId, briefDescription, { hidden = false } = {}) {
    if (!['SETTLEMENT', 'DUNGEON', 'INTERIOR'].includes(normalizeMapSiteKind(hostDocument.kind))) {
        throw new Error(`Host "${hostDocument.site}" is not a supported mapped site.`);
    }
    const area = (hostDocument.areas || []).find(item => item.id === areaId);
    if (!area) throw new Error(`Could not resolve the host map cell for "${site}".`);
    const matches = (hostDocument.assets || []).filter(asset => dungeonLabelIdentitiesMatch(asset.name, site) && asset.state !== 'REMOVED' && asset.state !== 'LEFT');
    if (matches.length > 1) throw new Error(`Host map contains more than one active asset named "${site}".`);
    let asset = matches[0] || null;
    if (asset) {
        if (![expectedKind, 'BUILDING', 'OBJECT'].includes(asset.kind)) {
            throw new Error(`Host-map asset "${site}" is ${asset.kind}; expected ${expectedKind}.`);
        }
        asset.kind = expectedKind;
        asset.location = area.id;
    } else {
        asset = {
            id: allocateHostedAssetId(hostDocument, site),
            kind: expectedKind,
            name: site,
            location: area.id,
            state: 'ACTIVE',
            knowledge: hidden ? 'UNREVEALED' : 'KNOWN',
            detail: String(briefDescription || '').trim(),
            origin: 'NARRATOR_ESTABLISHED',
        };
        hostDocument.assets.push(asset);
    }
    return asset;
}

function findArchitectMapEntry(entries, canonicalSite, requestedSite, hostContext) {
    const rows = Object.values(entries || {});
    const mapped = rows.filter(entry => getDungeonMapAttachment(entry));
    const canonical = mapped.find(entry => {
        const attachment = getDungeonMapAttachment(entry);
        return dungeonSiteRootsMatch(attachment.siteRoot, canonicalSite);
    });
    if (canonical) return canonical;
    if (hostContext) {
        const compatibleLegacy = mapped.find(entry => {
            const attachment = getDungeonMapAttachment(entry);
            if (!dungeonSiteRootsMatch(attachment.siteRoot, requestedSite)) return false;
            const document = parseDungeonMapDocument(attachment.content, attachment.siteRoot).document;
            return !document.hostSite || document.hostSite === hostContext.hostSite;
        });
        if (compatibleLegacy) return compatibleLegacy;
        return rows.find(entry => String(entry?.comment || '').trim() === canonicalSite) || null;
    }
    return rows.find(entry => {
        const label = String(entry?.comment || '').trim();
        return label && !label.includes('::') && dungeonSiteRootsMatch(label, canonicalSite);
    }) || null;
}

/**
 * Atomically attach a validated Map Architect document to its root Location.
 * Existing maps always win: concurrent/repeated tool calls never overwrite canon.
 */
export async function persistArchitectDungeonMap(siteRoot, mapDocument, {
    requireNew = false,
    locationKeys = null,
    locationCore = '',
    includeManifest = [],
    hostContext = null,
    campaignPrefix = null,
    chatId = null,
} = {}) {
    const ctx = SillyTavern.getContext();
    const settings = getSettings();
    // Prefer the originating-pass prefix/chat. Re-reading getLivePrefix() after a
    // long LLM await can target another campaign if the user switched chats.
    const prefix = String(campaignPrefix || getLivePrefix() || '').trim();
    const requestedSite = String(siteRoot || '').trim();
    const site = String(hostContext?.peerSite || requestedSite).trim();
    if (!prefix) throw new Error('No campaign prefix is available for the Locations lorebook.');
    if (!requestedSite || !site) throw new Error('Map Architect requires an exact site root.');
    if (hostContext && Number(hostContext.peerDepth) > MAX_HOSTED_MAP_DEPTH) {
        throw new Error(`Nested maps are limited to ${MAX_HOSTED_MAP_DEPTH} mapped levels.`);
    }

    const bookName = `${prefix}_Locations`;
    const bookKnown = await isWorldInfoBookKnown(bookName, ctx);
    let bookData = bookKnown ? await loadWorldInfoFresh(bookName, ctx) : null;
    // Work on a detached snapshot so validation or a failed backend save cannot
    // leak partial host/promotion edits through an old cache-backed loader.
    if (bookData) bookData = cloneRouterValue(bookData, null);
    if (!bookData) {
        if (bookKnown) {
            throw new Error(`Refusing to replace existing Locations lorebook "${bookName}" because it could not be loaded.`);
        }
        bookData = {
            entries: {},
            name: bookName,
            scan_depth: 4,
            token_budget: 400,
            recursive: false,
            extensions: {},
        };
    }

    let rootEntry = findArchitectMapEntry(bookData.entries, site, requestedSite, hostContext);
    const existingAttachment = rootEntry ? getDungeonMapAttachment(rootEntry) : null;
    if (existingAttachment) {
        if (requireNew) {
            throw new Error(`A mapped location named "${site}" already exists.`);
        }
        if (Array.isArray(includeManifest) && includeManifest.length) {
            throw new Error('include[] cannot modify a settlement that already has a stored map.');
        }
        if (!hostContext) {
            return {
                bookName,
                entryId: `${bookName}::${rootEntry.uid}`,
                created: false,
                existing: true,
                document: parseDungeonMapDocument(existingAttachment.content, existingAttachment.siteRoot).document,
            };
        }
    }

    if (requireNew && rootEntry) {
        throw new Error(`A location named "${site}" already exists. Use + MAP on that root instead.`);
    }

    if (!rootEntry) {
        const uids = Object.keys(bookData.entries || {}).map(Number).filter(Number.isFinite);
        const nextUid = uids.length ? Math.max(...uids) + 1 : 0;
        const coreBody = String(locationCore || '').trim();
        const coreContent = /\[CORE\]/i.test(coreBody)
            ? coreBody
            : `[CORE]\n${coreBody || `${requestedSite} is a mapped site. Its private map stores current objective reality; child Location entries preserve player-observable history.`}\n[/CORE]`;
        rootEntry = {
            uid: nextUid,
            key: locationKeysForNewRoot(requestedSite, [
                site,
                ...(Array.isArray(locationKeys) ? locationKeys : String(locationKeys || '').split(/[,;\n]/)),
            ]),
            keysecondary: [],
            comment: site,
            content: coreContent,
            constant: false,
            selective: false,
            selectiveLogic: 0,
            addMemo: true,
            order: settings.routerDefaultOrder ?? 100,
            position: settings.routerDefaultPosition ?? 0,
            disable: true,
            probability: 100,
            useProbability: false,
            depth: settings.routerDefaultDepth ?? 4,
            group: '',
            groupOverride: false,
            groupWeight: 100,
            extensions: {},
        };
        bookData.entries[nextUid] = rootEntry;
    }

    let persistedDocument = existingAttachment
        ? parseDungeonMapDocument(existingAttachment.content, existingAttachment.siteRoot).document
        : JSON.parse(JSON.stringify(mapDocument));

    if (hostContext) {
        const hostUid = entryUidFromCompositeId(hostContext.hostEntryId);
        const hostEntry = bookData.entries?.[hostUid];
        const hostAttachment = getDungeonMapAttachment(hostEntry);
        if (!hostEntry || !hostAttachment || String(hostEntry.comment || '').trim() !== hostContext.hostSite) {
            throw new Error(`Host map "${hostContext.hostSite}" changed before the peer could be saved.`);
        }
        const hostDocument = parseDungeonMapDocument(hostAttachment.content, hostContext.hostSite).document;
        const hostAsset = promoteHostedPeerAsset(
            hostDocument,
            requestedSite,
            hostContext.expectedAssetKind,
            hostContext.hostAreaId,
            hostContext.briefDescription,
            { hidden: !!hostContext.explicit },
        );
        const livePeerSite = buildHostedPeerSitePath(hostDocument, hostAsset);
        if (livePeerSite !== site) {
            throw new Error(`Host path for "${requestedSite}" changed before the peer could be saved.`);
        }
        const peerKind = normalizeMapSiteKind(persistedDocument.kind);
        const expectedPeerKind = hostContext.expectedAssetKind === 'SUBINTERIOR' ? 'INTERIOR' : 'DUNGEON';
        if (peerKind !== expectedPeerKind) {
            throw new Error(`${hostContext.expectedAssetKind} requires a ${expectedPeerKind} peer map, received ${peerKind}.`);
        }
        persistedDocument.site = site;
        persistedDocument = stampHostedPeerDocument(persistedDocument, hostDocument, hostAsset);
        reparentHostedLocationEntries(bookData.entries, rootEntry, site, requestedSite);
        hostEntry.content = replaceDungeonMapSection(hostEntry.content, serializeDungeonMapDocument(hostDocument));
        hostEntry.disable = true;
    }

    if (existingAttachment) {
        rootEntry.content = ensureHostCoreMirror(rootEntry.content, persistedDocument.hostSite, persistedDocument.hostBrief);
        rootEntry.content = replaceDungeonMapSection(rootEntry.content, serializeDungeonMapDocument(persistedDocument));
    } else {
        if (persistedDocument.hostSite && persistedDocument.hostBrief) {
            rootEntry.content = ensureHostCoreMirror(rootEntry.content, persistedDocument.hostSite, persistedDocument.hostBrief);
        }
        if (!attachDungeonMapToLocationEntry(rootEntry, {
            siteRoot: site,
            content: serializeDungeonMapDocument(persistedDocument),
        })) {
            throw new Error(`Could not attach the generated map to "${site}".`);
        }
    }

    const includes = Array.isArray(includeManifest) ? includeManifest : [];
    if (includes.length && normalizeMapSiteKind(persistedDocument.kind) !== 'SETTLEMENT') {
        throw new Error('include[] is valid only for a new SETTLEMENT map.');
    }
    for (const included of includes) {
        const peerEntry = rootEntryByExactSite(bookData.entries, String(included.site || '').trim());
        const lockedUid = entryUidFromCompositeId(included.entryId);
        if (!peerEntry || String(peerEntry.uid) !== String(lockedUid)) {
            throw new Error(`Included peer "${included.site}" changed identity before the settlement could be saved.`);
        }
        const peerAttachment = getDungeonMapAttachment(peerEntry);
        if (!peerAttachment) throw new Error(`Included peer "${included.site}" no longer exists.`);
        const peerDocument = parseDungeonMapDocument(peerAttachment.content, included.site).document;
        if (peerDocument.kind !== included.kind || !['DUNGEON', 'INTERIOR'].includes(peerDocument.kind)) {
            throw new Error(`Included peer "${included.site}" changed kind before the settlement could be saved.`);
        }
        const matchingAssets = (persistedDocument.assets || []).filter(asset => asset.name === included.site && asset.kind === included.assetKind);
        if (matchingAssets.length !== 1) {
            throw new Error(`Settlement must contain exactly one ${included.assetKind} asset named "${included.site}".`);
        }
        const hostedSite = buildHostedPeerSitePath(persistedDocument, matchingAssets[0]);
        const stamped = stampHostedPeerDocument(peerDocument, persistedDocument, matchingAssets[0]);
        stamped.site = hostedSite;
        reparentHostedLocationEntries(bookData.entries, peerEntry, hostedSite, included.site);
        peerEntry.content = ensureHostCoreMirror(peerEntry.content, stamped.hostSite, stamped.hostBrief);
        peerEntry.content = replaceDungeonMapSection(peerEntry.content, serializeDungeonMapDocument(stamped));
        peerEntry.disable = true;
    }
    rootEntry.disable = true;
    await saveWorldInfoSnapshot(bookName, bookData, ctx, 'Map Architect persistence');
    recordLiveDungeonMapSnapshot(settings, collectDungeonMapHistorySnapshot(bookData.entries, bookName));

    const resolvedChatId = chatId
        || ctx.chatId
        || (typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : '');
    if (resolvedChatId) {
        settings.chatStates = settings.chatStates || {};
        settings.chatStates[resolvedChatId] = settings.chatStates[resolvedChatId] || {};
        const campaignBooks = new Set(settings.chatStates[resolvedChatId].campaignBooks || []);
        campaignBooks.add(bookName);
        settings.chatStates[resolvedChatId].campaignBooks = [...campaignBooks];
        void saveSettings();
    }
    if (!bookKnown && typeof ctx.updateWorldInfoList === 'function') {
        try { await ctx.updateWorldInfoList(); } catch (_) {}
    }
    if (typeof ctx.reloadWorldInfoEditor === 'function') ctx.reloadWorldInfoEditor(bookName);
    document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));

    return {
        bookName,
        entryId: `${bookName}::${rootEntry.uid}`,
        created: !existingAttachment,
        existing: !!existingAttachment,
        document: persistedDocument,
    };
}

/**
 * Replace the root Location's [MAP] from manual JSON editing in the map inspector.
 * Does not create new roots or overwrite a site that lost its map attachment.
 */
export async function persistManualDungeonMapDocument(siteRoot, mapDocument) {
    const ctx = SillyTavern.getContext();
    const settings = getSettings();
    const prefix = getLivePrefix();
    const site = String(siteRoot || '').trim();
    if (!prefix) throw new Error('No campaign prefix is available for the Locations lorebook.');
    if (!site) throw new Error('Site root is required.');
    if (!mapDocument || typeof mapDocument !== 'object') throw new Error('Map document is required.');

    const bookName = `${prefix}_Locations`;
    const bookData = await loadWorldInfoFresh(bookName, ctx);
    if (!bookData?.entries) {
        throw new Error(`Locations lorebook "${bookName}" could not be loaded.`);
    }

    const rootEntry = Object.values(bookData.entries).find(entry => {
        const attachment = getDungeonMapAttachment(entry);
        return attachment && dungeonSiteRootsMatch(attachment.siteRoot, site);
    });
    if (!rootEntry) throw new Error(`No Location root found for "${site}".`);
    const existingAttachment = getDungeonMapAttachment(rootEntry);
    if (!existingAttachment) throw new Error(`"${site}" has no private map to edit.`);
    const existingDocument = parseDungeonMapDocument(existingAttachment.content, existingAttachment.siteRoot).document;
    const oldHost = String(existingDocument.hostSite || '').trim();
    const newHost = String(mapDocument.hostSite || '').trim();
    const oldBrief = String(existingDocument.hostBrief || '').trim();
    const newBrief = String(mapDocument.hostBrief || '').trim();
    if (oldHost !== newHost || oldBrief !== newBrief) {
        throw new Error('hostSite/hostBrief are runtime-owned and cannot be added, removed, edited, or re-hosted in the manual JSON editor.');
    }

    if (migrateDungeonMapAttachmentToContent(rootEntry)) {
        // legacy extension blob upgraded to [MAP] in content
    }
    rootEntry.content = replaceDungeonMapSection(
        rootEntry.content,
        serializeDungeonMapDocument(mapDocument),
    );
    reconcileDungeonMapAreaKnowledge(rootEntry, bookData.entries);
    rootEntry.disable = true;

    await saveWorldInfoSnapshot(bookName, bookData, ctx, 'Manual map JSON edit');
    recordLiveDungeonMapSnapshot(settings, collectDungeonMapHistorySnapshot(bookData.entries, bookName));

    const chatId = ctx.chatId || (typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : '');
    if (chatId) {
        settings.chatStates = settings.chatStates || {};
        settings.chatStates[chatId] = settings.chatStates[chatId] || {};
        const campaignBooks = new Set(settings.chatStates[chatId].campaignBooks || []);
        campaignBooks.add(bookName);
        settings.chatStates[chatId].campaignBooks = [...campaignBooks];
        void saveSettings();
    }
    if (typeof ctx.reloadWorldInfoEditor === 'function') ctx.reloadWorldInfoEditor(bookName);
    document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));

    return {
        bookName,
        entryId: `${bookName}::${rootEntry.uid}`,
        document: mapDocument,
    };
}

/** True when a Location root with this site name already exists. */
export async function locationRootExists(siteRoot) {
    const site = String(siteRoot || '').trim();
    const prefix = getLivePrefix();
    if (!site || !prefix) return false;
    const ctx = SillyTavern.getContext();
    const bookName = `${prefix}_Locations`;
    if (!await isWorldInfoBookKnown(bookName, ctx)) return false;
    const bookData = await loadWorldInfoFresh(bookName, ctx);
    if (!bookData?.entries) return false;
    return Object.values(bookData.entries).some(entry => {
        const label = String(entry?.comment || '').trim();
        return label && !label.includes('::') && dungeonSiteRootsMatch(label, site);
    });
}

/**
 * Remove the private [MAP] from a Locations entry without deleting the lore record.
 * CORE/chronicles stay. Evolution trajectory for that site is dropped so a later
 * map is not biased by the deleted occupancy clock.
 */
export async function deleteDungeonMapFromLocationEntry(id) {
    const raw = String(id || '');
    const splitAt = raw.indexOf('::');
    const bookName = splitAt >= 0 ? raw.slice(0, splitAt) : '';
    const uid = splitAt >= 0 ? raw.slice(splitAt + 2) : '';
    if (!bookName || !uid) return { ok: false, error: 'Invalid lorebook entry id.' };

    const ctx = SillyTavern.getContext();
    const bookData = await loadWorldInfoFresh(bookName, ctx);
    const rootEntry = bookData?.entries?.[uid];
    if (!rootEntry) return { ok: false, error: 'Location entry was not found.' };
    if (!getDungeonMapAttachment(rootEntry)) return { ok: false, error: 'That Location has no private map.' };

    const siteRoot = String(rootEntry.comment || '').trim();
    if (!detachDungeonMapFromLocationEntry(rootEntry)) {
        return { ok: false, error: 'Could not remove the private map.' };
    }
    rootEntry.disable = false;

    await saveWorldInfoSnapshot(bookName, bookData, ctx, 'Dungeon map removal');
    recordLiveDungeonMapSnapshot(
        getSettings(),
        collectDungeonMapHistorySnapshot(bookData.entries, bookName) || { bookName, maps: [] },
    );

    const settings = getSettings();
    const siteKey = normalizeDungeonLabel(siteRoot);
    const cleared = clearEvolutionHistoryForSite({
        backlogBySite: settings.mapEvolutionBacklogBySite,
        threadsBySite: settings.mapEvolutionThreadsBySite,
        reportApplicationsBySite: settings.mapEvolutionWorldReportApplications,
    }, siteRoot);
    if (cleared.cleared) {
        settings.mapEvolutionBacklogBySite = cleared.backlogBySite;
        settings.mapEvolutionThreadsBySite = cleared.threadsBySite;
        settings.mapEvolutionWorldReportApplications = cleared.reportApplicationsBySite;
    }
    if (siteKey) {
        settings.mapEvolutionIntervalHoursBySite = setSiteEvolutionIntervalOverride(
            settings.mapEvolutionIntervalHoursBySite,
            siteRoot,
            null,
        );
        if (settings.mapEvolutionLastFiredBySite && typeof settings.mapEvolutionLastFiredBySite === 'object') {
            delete settings.mapEvolutionLastFiredBySite[siteKey];
        }
        if (normalizeDungeonLabel(settings.mapEvolutionLastSiteRoot) === siteKey) {
            settings.mapEvolutionLastSiteRoot = '';
        }
        if (normalizeDungeonLabel(settings.mapEvolutionPendingExitRoot) === siteKey) {
            settings.mapEvolutionPendingExitRoot = '';
        }
        if (Array.isArray(settings.mapEvolutionSelectedRoots)) {
            settings.mapEvolutionSelectedRoots = settings.mapEvolutionSelectedRoots.filter(
                root => normalizeDungeonLabel(root) !== siteKey,
            );
        }
    }
    persistMapEvolutionState();

    if (typeof ctx.reloadWorldInfoEditor === 'function') ctx.reloadWorldInfoEditor(bookName);
    document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));
    return { ok: true, bookName, entryId: raw, siteRoot };
}

/** Captures the complete current campaign state for lossless redo. */
export async function captureRouterLoreState() {
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const prefix = getLivePrefix();
    const chatId = getRouterChatId(ctx);
    const names = prefix
        ? (await getWorldInfoNamesSafe()).filter(name => bookBelongsToPrefix(name, prefix) && !isSkeletonBookName(name))
        : [];
    const bookSnapshots = {};
    for (const name of names) {
        const book = await loadWorldInfoFresh(name, ctx);
        if (!book) {
            throw new Error(`Cannot safely snapshot current lorebook "${name}".`);
        }
        bookSnapshots[name] = book;
    }
    return buildRouterLoreState(settings, { prefix, chatId, bookSnapshots });
}

/** Snapshot every attached [MAP] in the campaign Locations book. */
export async function captureActiveDungeonMapHistory(ctx = SillyTavern.getContext()) {
    const prefix = getLivePrefix();
    if (!prefix) return null;
    const bookName = `${prefix}_Locations`;
    if (!await isWorldInfoBookKnown(bookName, ctx)) return null;
    const book = await loadWorldInfoFresh(bookName, ctx);
    if (!book?.entries) return null;
    return collectDungeonMapHistorySnapshot(book.entries, bookName);
}

/** Persist a memo-history map snapshot onto the live Locations lorebook. */
export async function restoreActiveDungeonMapHistory(snapshot, ctx = SillyTavern.getContext()) {
    if (!snapshot?.maps?.length || !snapshot.bookName) return false;
    const book = await loadWorldInfoFresh(snapshot.bookName, ctx);
    if (!book?.entries) return false;
    if (!applyDungeonMapHistorySnapshotToBook(book, snapshot)) return false;
    await evictWorldInfoCache(snapshot.bookName);
    await saveWorldInfoSnapshot(snapshot.bookName, book, ctx, 'Dungeon map history restore');
    if (typeof ctx.reloadWorldInfoEditor === 'function') ctx.reloadWorldInfoEditor(snapshot.bookName);
    document.dispatchEvent(new CustomEvent('rt_lore_agent_updated', { detail: { source: 'map-history-restore' } }));
    return true;
}

/** Load the Locations book plus the active mapped-site context, if any. */
export async function loadActiveDungeonMapContext() {
    const ctx = SillyTavern.getContext();
    const prefix = getLivePrefix();
    if (!prefix) return null;
    const currentLocation = findLatestDungeonLocation(ctx.chat || []);
    const synced = await syncDungeonMapsToLocationLorebook(ctx.chat || [], { capture: false });
    if (!synced.bookName) return { prefix, books: {}, context: null, currentLocation };
    const book = synced.bookData;
    if (!book?.entries) return { prefix, books: {}, context: null, currentLocation };
    const books = { [synced.bookName]: book };
    return {
        prefix,
        books,
        context: resolveActiveDungeonContext(books, prefix, currentLocation),
        currentLocation,
    };
}

/** Load every attached [MAP] in the campaign Locations book. */
export async function loadAllMappedSiteContexts() {
    const ctx = SillyTavern.getContext();
    const prefix = getLivePrefix();
    if (!prefix) return null;
    const currentLocation = findLatestDungeonLocation(ctx.chat || []);
    const synced = await syncDungeonMapsToLocationLorebook(ctx.chat || [], { capture: false });
    if (!synced.bookName) return { prefix, books: {}, sites: [], currentLocation };
    const book = synced.bookData;
    if (!book?.entries) return { prefix, books: {}, sites: [], currentLocation };
    const books = { [synced.bookName]: book };
    const sites = listMappedSiteDocuments(book.entries, synced.bookName).map(site => ({
        ...site,
        prefix,
        bookName: synced.bookName,
        currentLocation,
    }));
    return { prefix, books, sites, currentLocation };
}

/**
 * Load one mapped site by root label for manual Map Updater / inspector passes.
 * @param {string} siteRoot
 */
export async function loadDungeonMapContextForSite(siteRoot) {
    const wanted = normalizeDungeonLabel(siteRoot);
    if (!wanted) return null;
    const loaded = await loadAllMappedSiteContexts();
    if (!loaded) return null;
    const site = (loaded.sites || []).find(candidate => normalizeDungeonLabel(candidate.siteRoot) === wanted);
    if (!site) return null;
    const footer = loaded.currentLocation || '';
    const isActiveSite = locationContainsSiteRoot(footer, site.siteRoot);
    return {
        prefix: loaded.prefix,
        books: loaded.books,
        currentLocation: footer,
        isActiveSite,
        context: {
            prefix: loaded.prefix,
            bookName: site.bookName,
            uid: site.uid,
            entryId: site.entryId,
            siteRoot: site.siteRoot,
            currentLocation: footer,
            document: site.document,
        },
    };
}

/** Deep-clone the campaign Locations book for Map Updater swipe restore. */
export async function snapshotCampaignLocationsBook(ctx = SillyTavern.getContext()) {
    const prefix = getLivePrefix();
    if (!prefix) return null;
    const bookName = `${prefix}_Locations`;
    if (!await isWorldInfoBookKnown(bookName, ctx)) return null;
    const book = await loadWorldInfoFresh(bookName, ctx);
    if (!book) return null;
    return { bookName, book: JSON.parse(JSON.stringify(book)) };
}

/** Replace the live Locations book with a prior snapshot. */
export async function restoreCampaignLocationsBook(snapshot, ctx = SillyTavern.getContext()) {
    if (!snapshot?.bookName || !snapshot?.book) return false;
    await evictWorldInfoCache(snapshot.bookName);
    await saveWorldInfoSnapshot(snapshot.bookName, snapshot.book, ctx, 'Map Updater swipe restore');
    if (typeof ctx.reloadWorldInfoEditor === 'function') ctx.reloadWorldInfoEditor(snapshot.bookName);
    document.dispatchEvent(new CustomEvent('rt_lore_agent_updated', { detail: { source: 'map-updater-swipe-restore' } }));
    return true;
}

async function finalizeRouterHistorySnapshot(runId) {
    if (!runId) return;
    const settings = getSettings();
    const snapshot = (settings.routerHistory || []).find(entry => entry?.runId === runId);
    if (!snapshot) return;
    const prefix = snapshot.campaignPrefix || getLivePrefix();
    if (!prefix) {
        snapshot.createdBookNames = [];
        snapshot.deletedBookNames = [];
        return;
    }
    const chatId = snapshot.chatId || getRouterChatId();
    const ownedNames = chatId ? (settings.chatStates?.[chatId]?.campaignBooks || []) : [];
    const registryNames = await getWorldInfoNamesSafe({ fullProbe: false });
    const currentNames = [...new Set([...ownedNames, ...registryNames])]
        .filter(name => bookBelongsToPrefix(name, prefix) && !isSkeletonBookName(name));
    const before = new Set(getLorebookSnapshotNames(snapshot));
    const after = new Set(currentNames);
    snapshot.createdBookNames = currentNames.filter(name => !before.has(name));
    snapshot.deletedBookNames = [...before].filter(name => !after.has(name));
    void saveSettings();
}

export function resolveActiveDungeonContext(allBooks, prefix, currentLocation) {
    if (!prefix || !currentLocation) return null;
    const wantedBookName = `${prefix}_Locations`;
    const bookName = Object.keys(allBooks || {}).find(name => name.toLowerCase() === wantedBookName.toLowerCase());
    const book = bookName ? allBooks[bookName] : null;
    if (!book?.entries) return null;
    const state = { version: 3, sites: buildDungeonSitesFromLocationEntries(book.entries, bookName) };
    const site = resolveActiveDungeonSite(state, currentLocation);
    if (!site?.entryId) return null;
    const separator = site.entryId.lastIndexOf('::');
    const uid = separator >= 0 ? site.entryId.slice(separator + 2) : '';
    const rootEntry = book.entries[uid];
    const mapBody = extractDungeonMapSection(rootEntry?.content);
    if (!rootEntry || !mapBody) return null;
    return {
        prefix,
        bookName,
        uid,
        entryId: site.entryId,
        siteRoot: site.siteRoot,
        currentLocation,
        document: parseDungeonMapDocument(mapBody, site.siteRoot).document,
    };
}

function stripStaticDungeonAgentGuidance(prompt) {
    return String(prompt || '')
        .replace(/\n?## DUNGEON LOCATION OWNERSHIP\s*\n[\s\S]*?(?=\n## |$)/gi, '\n')
        .replace(/^\s*\*\*DUNGEON LOCATION OWNERSHIP:\*\*[^\n]*(?:\n|$)/gim, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

const LOCATION_FOOTER_LAG_NOTE = 'Parsed from the narrator status footer and may lag. If the latest narration clearly entered a named interior (chapel, inn, shop, house, alley) that this line omitted, treat the narration as authoritative — do not wait for the footer.';

function formatCurrentLocationSection(hierarchy) {
    return `## CURRENT LOCATION\n${hierarchy || 'Unknown'}\n${LOCATION_FOOTER_LAG_NOTE}`;
}

function formatArchiveIndexSection(keyringText) {
    return `## ARCHIVE INDEX\nComplete catalog of inactive entries (Book::UID, label, keywords). If a name is not here, in ACTIVE MEMORY, or in NEWLY ACTIVATED, it does not exist — do not grep to confirm.\n${keyringText || 'Empty.'}`;
}

const LORE_EXISTENCE_RULE = 'ACTIVE MEMORY, NEWLY ACTIVATED THIS TURN, and ARCHIVE INDEX together are the complete catalog of existing entries. ARCHIVE INDEX lists Book::UID, label, and keywords for every inactive entry. If a name is not in that catalog, it does not exist — record it. Do not call grep_lore, inspect_book, or read_entry to check whether an entry exists. Use read_entry only when you need the full body of an archived entry already identified on ARCHIVE INDEX. Use grep_lore only to search entry bodies for a fact that labels/keywords do not answer, with one short query per call.';

function formatMappedSiteAgentNote(context) {
    if (!context) return '';
    return `\n\n## MAPPED SITE\nThe party is inside mapped site "${context.siteRoot}". Map occupancy (areas, assets, routes, interiors) is maintained by the Map Updater. Do not emit [MAP_COMMIT], commit.map, inspect_map, or rewrite [MAP]. Record NPCs, factions, quests, events, and readable location lore as usual.`;
}

function createMappedChildLocationEntry(uid, rootLabel, areaName, chronicle, settings) {
    return {
        uid,
        key: cleanKeys([areaName, rootLabel]),
        keysecondary: [],
        comment: `${rootLabel} :: ${areaName}`,
        content: `[CORE]\n${areaName} is a location within ${rootLabel}; its permanent details are established through play.\n[/CORE]\n${chronicle}`,
        constant: false,
        selective: false,
        selectiveLogic: 0,
        addMemo: true,
        order: settings.routerDefaultOrder ?? 100,
        position: settings.routerDefaultPosition ?? 0,
        disable: !settings.routerNativeKeywordActivation,
        probability: 100,
        useProbability: false,
        depth: settings.routerDefaultDepth ?? 4,
        group: '',
        groupOverride: false,
        groupWeight: 100,
    };
}

function findMappedChildEntry(entries, rootLabel, areaName) {
    return Object.values(entries || {}).find(entry => {
        const label = String(entry?.comment || '').trim();
        const segments = label.split(/\s*::\s*/).filter(Boolean);
        if (segments.length > 1) {
            return locationContainsSiteRoot(label, rootLabel)
                && dungeonLabelsMatch(segments.at(-1), areaName);
        }
        const keys = Array.isArray(entry?.key) ? entry.key : [];
        return dungeonLabelsMatch(label, areaName) && keys.some(key => dungeonSiteRootsMatch(key, rootLabel));
    }) || null;
}

function mapTransactionSignature(value) {
    const canonicalize = item => {
        if (Array.isArray(item)) return item.map(canonicalize);
        if (item && typeof item === 'object') {
            return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonicalize(item[key])]));
        }
        return item;
    };
    const source = JSON.stringify(canonicalize(value));
    let hash = 0x811c9dc5;
    for (let index = 0; index < source.length; index++) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function resolveDungeonContextByUid(book, expectedContext) {
    const rootEntry = book?.entries?.[expectedContext?.uid];
    const mapBody = extractDungeonMapSection(rootEntry?.content);
    if (!rootEntry || !mapBody) return null;
    return {
        prefix: expectedContext.prefix,
        bookName: expectedContext.bookName,
        uid: expectedContext.uid,
        entryId: expectedContext.entryId,
        siteRoot: expectedContext.siteRoot,
        currentLocation: expectedContext.currentLocation,
        document: parseDungeonMapDocument(mapBody, expectedContext.siteRoot).document,
    };
}

/** Save current [MAP] plus observable child chronicles in one Locations-book write. */
export async function applyDungeonMapCommit(transaction, expectedContext, allBooks, currentTime, options = {}) {
    const requireActive = options.requireActive !== false;
    const frozenAreaIds = Array.isArray(options.frozenAreaIds) ? options.frozenAreaIds : [];
    if (!expectedContext) {
        return { ok: false, retryable: false, errors: [{ code: 'MAP_NOT_ACTIVE', path: 'map', received: transaction, hint: 'Map commands are unavailable because no mapped site is currently active.' }] };
    }
    const ctx = SillyTavern.getContext();
    const freshBook = await loadWorldInfoFresh(expectedContext.bookName, ctx);
    if (!freshBook?.entries) {
        return { ok: false, retryable: false, errors: [{ code: 'MAP_CONTEXT_CHANGED', path: 'map', received: expectedContext.siteRoot, hint: 'The mapped site could not be reloaded. Do not retry this map mutation.' }] };
    }

    let liveContext;
    if (requireActive) {
        const latestLocation = findLatestDungeonLocation(ctx.chat || []) || expectedContext.currentLocation;
        liveContext = resolveActiveDungeonContext({ [expectedContext.bookName]: freshBook }, expectedContext.prefix, latestLocation);
        if (!liveContext || liveContext.entryId !== expectedContext.entryId) {
            return { ok: false, retryable: false, errors: [{ code: 'MAP_CONTEXT_CHANGED', path: 'map', received: latestLocation, hint: 'The active mapped site changed during this pass. Do not retry this map mutation.' }] };
        }
    } else {
        liveContext = resolveDungeonContextByUid(freshBook, expectedContext);
        if (!liveContext) {
            return { ok: false, retryable: false, errors: [{ code: 'MAP_ENTRY_MISSING', path: 'map', received: expectedContext.siteRoot, hint: 'The mapped root was removed during this pass. Do not retry this map mutation.' }] };
        }
    }

    const rootEntry = freshBook.entries[liveContext.uid];
    const priorOperations = Array.isArray(rootEntry?.extensions?.[DUNGEON_MAP_OPERATION_IDS_KEY])
        ? rootEntry.extensions[DUNGEON_MAP_OPERATION_IDS_KEY]
        : [];
    const operationId = String(transaction?.operation_id || '').trim();
    const signature = mapTransactionSignature(transaction);
    const priorOperation = priorOperations.find(item => (typeof item === 'string' ? item : item?.id) === operationId);
    if (operationId && priorOperation) {
        if (typeof priorOperation === 'string' || priorOperation.signature === signature) {
            return { ok: true, alreadyApplied: true, operationId, createdAssets: [], createdAreas: [], chronicles: [] };
        }
        return { ok: false, retryable: true, errors: [{ code: 'OPERATION_ID_CONFLICT', path: 'map.operation_id', received: operationId, hint: 'This ID already belongs to a different successful transaction. Retry this new change with a new operation_id.' }] };
    }

    const mapBody = extractDungeonMapSection(rootEntry.content);
    const parsed = parseDungeonMapDocument(mapBody, liveContext.siteRoot);
    const applied = applyDungeonMapTransaction(parsed.document, transaction, { frozenAreaIds, currentTime });
    if (!applied.ok) return applied;

    const timestampRegex = /(?:\[Day\s+\d+|\[\d{1,2}\/\d{1,2}\/\d+)\b/i;
    const timePrefix = currentTime ? `[${currentTime}] ` : '';
    for (const chronicle of applied.chronicles) {
        let text = sanitizeLorebookRecordContent(chronicle.text).trim();
        if (text && timePrefix && !timestampRegex.test(text)) text = `${timePrefix}${text}`;
        if (!text) continue;
        const area = applied.document.areas.find(item => item.id === chronicle.areaId);
        if (area) area.knowledge = 'VISITED';
        let child = findMappedChildEntry(freshBook.entries, liveContext.siteRoot, chronicle.areaName);
        if (!child) {
            const uids = Object.keys(freshBook.entries || {}).map(Number).filter(Number.isFinite);
            const nextUid = uids.length ? Math.max(...uids) + 1 : 0;
            child = createMappedChildLocationEntry(nextUid, liveContext.siteRoot, chronicle.areaName, text, getSettings());
            freshBook.entries[nextUid] = child;
        } else {
            const existing = String(child.content || '').trimEnd();
            const delta = deduplicateContent(existing, text);
            if (delta) child.content = existing ? `${existing}\n${delta}` : delta;
        }
    }

    rootEntry.content = replaceDungeonMapSection(rootEntry.content, serializeDungeonMapDocument(applied.document));
    rootEntry.extensions = rootEntry.extensions || {};
    rootEntry.extensions[DUNGEON_MAP_OPERATION_IDS_KEY] = [...priorOperations, { id: applied.operationId, signature }].slice(-100);
    rootEntry.disable = true;
    await saveWorldInfoSnapshot(expectedContext.bookName, freshBook, ctx, 'Dungeon map transaction');
    allBooks[expectedContext.bookName] = freshBook;
    recordLiveDungeonMapSnapshot(getSettings(), collectDungeonMapHistorySnapshot(freshBook.entries, expectedContext.bookName));
    if (typeof ctx.reloadWorldInfoEditor === 'function') ctx.reloadWorldInfoEditor(expectedContext.bookName);
    document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));
    return { ...applied, document: undefined };
}

/** Occupancy commits require the party to still be inside the mapped site. */
export async function applyActiveDungeonMapCommit(transaction, expectedContext, allBooks, currentTime) {
    return applyDungeonMapCommit(transaction, expectedContext, allBooks, currentTime, { requireActive: true });
}

/**
 * The core Researcher Agent loop.
 */
export async function runRouterPass(narrativeOutput, manualPrompt = null, customLookback = null, isManual = false, newlyTriggeredIds = [], overrideChatLog = null) {
    const settings = getSettings();
    const dungeonRealityEnabled = isLocationMappingEnabled(settings);
    if (!isLorebookAgentRuntimeActive(settings) || _routerRunning) return;
    // routerPaused blocks auto-runs only; manual UI runs always go through
    if (settings.routerPaused && !isManual) return;

    const ctx = SillyTavern.getContext();
    if (!ctx.generateRaw) return;

    try {
        _routerRunning = true;
        if (_routerController) _routerController.abort();
        _routerController = new AbortController();
        const _routerSignal = _routerController.signal;
        broadcastStep('start', 'Initializing Lorebook Agent...');

        const startTime = Date.now();
        const prefix = getLivePrefix();
        if (!prefix) {
            broadcastStep('error', 'Cannot run: no campaign prefix available. The chat name may not have loaded yet ? try again in a moment.');
            _routerRunning = false;
            return;
        }
        let basicSummary = '';

        if (stripSkeletonFromRouterPools()) {
            void saveSettings();
        }

        async function fetchArchiveBooks() {
            return fetchRouterArchiveBooks(prefix, ctx);
        }

        let archiveBooks = await fetchArchiveBooks();
        let _routerTriggerMsg = null;
        let _routerSnapshotRunId = null;
        let _routerPrePassWatermark = 0;

        // ?? Snapshot state BEFORE this pass (for rollback) ??????????????????
        {
            const snapshot = buildRouterLoreState(settings, {
                prefix,
                chatId: getRouterChatId(ctx),
                bookSnapshots: archiveBooks,
            });
            snapshot.runId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            _routerSnapshotRunId = snapshot.runId;
            _routerPrePassWatermark = snapshot.routerLastRunChatLength;
            _routerTriggerMsg = [...(ctx.chat || [])].reverse().find(m => !m.is_user && !m.is_system);
            for (const [name, book] of Object.entries(archiveBooks)) {
                snapshot.bookSnapshots[name] = JSON.parse(JSON.stringify(book));
            }
            if (!settings.routerHistory) settings.routerHistory = [];
            settings.routerHistory.unshift(snapshot);
            if (settings.routerHistory.length > 5) settings.routerHistory.length = 5;
            recordSchedulerEvent('la_pass_snapshot', {
                runId: snapshot.runId,
                preWm: _routerPrePassWatermark,
                historyLen: settings.routerHistory.length,
                isManual,
            });
            void saveSettings();
        }
        let activeEntriesFull = [];
        let newlyTriggeredFull = [];
        let activeDungeonEntryId = '';
        let activeDungeonContext = null;

        const triggeredSet = new Set(newlyTriggeredIds);

        function updateActiveEntries() {
            activeEntriesFull = [];
            newlyTriggeredFull = [];
            const relValues = settings.npcRelationshipValues || {};
            for (const [name, book] of Object.entries(archiveBooks)) {
                if (isSkeletonBookName(name)) continue;
                for (const [uid, entry] of Object.entries(book.entries)) {
                    const fullId = `${name}::${uid}`;
                    if (settings.activeRouterKeys?.includes(fullId)) {
                        const label = entry.comment || entry.key?.[0] || fullId;
                        const entryContent = getDungeonMapAttachment(entry)
                            ? stripDungeonMapSection(entry.content)
                            : entry.content;
                        let block = `### [ACTIVE] ${label}\nID: ${fullId}\nContent: ${entryContent}`;
                        // Append cap-constraint hints for NPC relationship values.
                        // Totals are intentionally hidden so the agent awards deltas from
                        // a consistent baseline, uncorrupted by the existing pool size.
                        // Only inject a hint when a value is near the cap (within 15 points)
                        // so the agent knows further movement in that direction is futile.
                        const rel = relValues[fullId];
                        if (rel !== undefined) {
                            const relMax = getNpcRelationshipMax(settings);
                            const fVal = rel.friendship ?? 0;
                            const aVal = rel.affection  ?? 0;
                            // Always inject current totals so the agent can calibrate delta magnitude
                            block += `\n[Current Relations: Friendship ${fVal >= 0 ? '+' : ''}${fVal}, Affection ${aVal >= 0 ? '+' : ''}${aVal} (range ±${relMax})]`;
                            // Cap-constraint hints (only when at limit)
                            const hints = [];
                            if (fVal >= relMax)  hints.push('Friendship is at maximum — do not award further positive increments');
                            if (fVal <= -relMax) hints.push('Friendship is at minimum — do not award further negative increments');
                            if (aVal >= relMax)  hints.push('Affection is at maximum — do not award further positive increments');
                            if (aVal <= -relMax) hints.push('Affection is at minimum — do not award further negative increments');
                            if (hints.length > 0) block += `\n⚠ Relationship constraint: ${hints.join('; ')}.`;
                        }
                        if (triggeredSet.has(fullId)) {
                            newlyTriggeredFull.push(block);
                        } else {
                            activeEntriesFull.push(block);
                        }
                    }
                }
            }
        }
        updateActiveEntries();

        let keyringText = buildKeyringText(archiveBooks, settings.activeRouterKeys);
        const { chat } = ctx;
        
        let recentChatString = "";
        if (overrideChatLog) {
            recentChatString = overrideChatLog;
        } else {
            // Three-way lookback priority (only applies to auto-passes; Direct Prompt always passes customLookback).
            // Since-last-run uses a chat-length watermark (every array slot, including tool-call messages).
            // Fixed/direct lookback counts user turns, not raw message slots — tool calls can inflate the latter.
            const sinceLastRun  = customLookback === null && settings.routerLookbackSinceLastRun !== false;
            const sinceLastUser = customLookback === null && !sinceLastRun && settings.routerLookbackSinceLastUser === true;
            let startIdx;
            if (sinceLastRun) {
                let lastLen = settings.routerLastRunChatLength || 0;
                if (lastLen > chat.length) {
                    lastLen = 0;
                    persistRouterLastRunWatermark(0);
                }
                if (lastLen > 0 && lastLen < chat.length) {
                    startIdx = lastLen;
                } else if (lastLen === 0) {
                    startIdx = 0;
                } else {
                    startIdx = chat.length;
                }
            } else if (sinceLastUser) {
                startIdx = findNthUserMessageStartIdx(chat, 1);
            } else {
                const turnCount = customLookback !== null ? customLookback : (settings.routerLookback || 4);
                startIdx = findNthUserMessageStartIdx(chat, Math.max(1, turnCount));
            }
            recentChatString = formatAgentChatLogFromIndex(
                chat,
                startIdx,
                !!settings.routerIncludeHidden,
                sinceLastRun
            );
        }



        // Extract Current Context (Time & Location)
        const timeRegex = /(\d{1,2}:\d{2}\s*(?:AM|PM)?,\s*(?:Day\s*\d+|\d{1,2}\/\d{1,2}\/\d+))/i;
        const narrativeTimeMatch = recentChatString.match(timeRegex);
        const memoTimeMatch = settings.currentMemo?.match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
        const cleanMemoTime = memoTimeMatch ? extractCurrentTimeStr(memoTimeMatch[1]) : '';
        const currentTime = narrativeTimeMatch ? narrativeTimeMatch[1] : cleanMemoTime;

        const currentHierarchy = extractFooterLocation(recentChatString) || findLatestDungeonLocation(chat);
        const breadcrumb = currentHierarchy ? currentHierarchy.replace(/,\s*/g, ' :: ') : '';
        activeDungeonContext = dungeonRealityEnabled
            ? resolveActiveDungeonContext(archiveBooks, prefix, currentHierarchy)
            : null;
        activeDungeonEntryId = activeDungeonContext?.entryId || '';
        // Rebuild after authoritative location resolution so [MAP] is present only
        // while its own site is active, even if a mapped root happens to be pinned.
        updateActiveEntries();

        // 2. The Loop
        let turns = 0;
        const maxTurns = settings.routerMaxTurns || 5;
        let basicSummaryText = '';

        const routerSettings = {
            ...settings,
            connectionSource: settings.routerConnectionSource || 'default',
            connectionProfileId: settings.routerConnectionProfileId,
            completionPresetId: settings.routerCompletionPresetId,
            ollamaUrl: settings.routerOllamaUrl,
            ollamaModel: settings.routerOllamaModel,
            openaiUrl: settings.routerOpenaiUrl,
            openaiKey: settings.routerOpenaiKey,
            openaiModel: settings.routerOpenaiModel,
            maxTokens: (settings.routerMaxTokens !== undefined && settings.routerMaxTokens !== null && settings.routerMaxTokens !== '') ? Number(settings.routerMaxTokens) : 1000,
        };

        // Budget status — computed once and reused in both basic and agent context.
        // Pinned entries are excluded so user pins never trigger BUDGET VIOLATION
        // or consume the agent's activation slots.
        const budgetActiveKeys = (settings.activeRouterKeys || []).filter(id => id !== activeDungeonEntryId);
        const activeCount = computeUnpinnedActiveCount(budgetActiveKeys, settings.pinnedRouterKeys);
        const maxActive = settings.routerMaxActivations || 12;
        const overflow = activeCount - maxActive;
        const budgetLine = `Active entries: ${activeCount} / ${maxActive}`;
        const curationInstruction =
            `\nCONTEXT OWNERSHIP: You decide the active set. Keyword / NEWLY ACTIVATED hits are provisional, not locks. ` +
            `Scene and narrative relevance is paramount regardless of what is currently active. ` +
            `If ARCHIVE INDEX has a more important entry for this scene, deactivate a weaker active entry ` +
            `(including a recent keyword hit) and activate the better one in this same pass — even when already at the cap. ` +
            `Do not lazy-prune to the cap and stop.`;
        const overflowInstruction = overflow > 0
            ? `\nBUDGET VIOLATION: ${activeCount} entr${activeCount !== 1 ? 'ies' : 'y'} active, limit is ${maxActive}. ` +
              `You MUST deactivate at least ${overflow} entr${overflow > 1 ? 'ies' : 'y'} ` +
              `before this pass ends so the count is legal. That is the floor, not the whole job: ` +
              `if ARCHIVE INDEX has higher-priority scene-relevant entries still inactive, deactivate extra low-value actives ` +
              `(keyword hits are not protected) and activate those missing entries in this same pass. ` +
              `Narrative relevance beats whatever is currently active. Justify each deactivation.`
            : '';

        const activeCombatBlock = extractActiveCombatBlock(settings.currentMemo);
        const activeCombatSection = activeCombatBlock
            ? `## ACTIVE COMBAT STATE (canonical mechanical stats — use this as the source for NPC Combat Profiles, not the GM prose)\n${activeCombatBlock}\n\n`
            : '';
        const combatProfileGuidanceBasic = resolveCombatProfileGuidance(settings, !!activeCombatBlock, 'basic');
        const combatProfileGuidanceAgent = resolveCombatProfileGuidance(settings, !!activeCombatBlock, 'agent');

        // Cold-start: once per chat, seed the LA prompt with the PC [CHARACTER] block so
        // Equipment updates can be grounded in actual equipped gear/mechanics. Later passes
        // rely on narrative cues only — no repeated CHARACTER/INVENTORY injection.
        let pcCharacterSeedSection = '';
        if (!settings.pcCharacterBlockSeeded) {
            const characterBlock = extractCharacterBlock(settings.currentMemo);
            if (characterBlock) {
                pcCharacterSeedSection =
                    `## PLAYER CHARACTER SHEET (initial reference — one-time)\n` +
                    `This is the Player Character's mechanical sheet from chargen / the CHARACTER module. ` +
                    `Use it as ground truth for what is currently equipped when judging Equipment updates. ` +
                    `It will NOT be re-injected on later passes — after this, infer gear/look changes from the narrative only.\n` +
                    `${characterBlock}\n\n`;
            }
            settings.pcCharacterBlockSeeded = true;
            try {
                const seedChatId = ctx.chatId || SillyTavern.getContext()?.chatId;
                if (seedChatId) saveChatState(seedChatId);
                else void saveSettings();
            } catch (_) {
                void saveSettings();
            }
        }

        // One authoritative runtime list drives schemas, text-mode instructions,
        // routing, and diagnostics. Disabled stock modules must not leak into a
        // custom-only setup merely because their category names are built in.
        const categoryEnum = getEnabledRouterCategoryTags(settings);
        const categoryChoiceText = categoryEnum.map(tag => `"${tag}"`).join(' | ');
        const categoryExampleValue = JSON.stringify(categoryEnum[0] || '');
        const categoryRouteText = categoryEnum
            .map(tag => `"${tag}" -> "${prefix ? `${prefix}_` : ''}${getRouterCategoryBookSuffix(tag)}"`)
            .join(', ');
        const recordCategoryGuidance = categoryEnum.length
            ? `## AVAILABLE RECORD CATEGORIES (AUTHORITATIVE FOR THIS PASS)\nThe only valid \`record[].category\` values are: ${categoryChoiceText}.\nRoutes: ${categoryRouteText}.\nUse one of these exact values for every new record. Categories not listed here are disabled and must not be used.`
            : `## AVAILABLE RECORD CATEGORIES (AUTHORITATIVE FOR THIS PASS)\nNo record categories are enabled. Do not create new records this pass.`;

        const sysTemplate = adjustPromptTimestamps(settings.routerSystemPromptTemplate || 'You are the Lorebook Agent. Maintain narrative consistency and manage lorebooks.', settings);
        const basePrompt = sysTemplate
            .replace(/\{\{campaignRoot\}\}/g, prefix || 'World Chronicle')
            .replace(/\{\{user\}\}/g, ctx.name1 || 'User');

        // ── Cleanup Mode ─────────────────────────────────────────────────────
        // Triggered by the UI broom button via runRouterPass(null, '__CLEANUP__', null, true).
        // ── Cleanup Mode ─────────────────────────────────────────────────────
        // Triggered by the UI broom button or Clean per-entry buttons.
        // Bypasses all normal research logic; uses stripped prompts and rewrite/consolidate only.
        const isCleanupPass = isManual && (manualPrompt || '').startsWith('__CLEANUP__');
        const CLEANUP_TOKEN_THRESHOLD = settings.routerCleanupTokenThreshold || 300; // ~1200 chars — entries larger than this are flagged

        if (isCleanupPass) {
            let targetEntryId = null;
            let customInstructions = null;

            // Format parser:
            // __CLEANUP__::[BookName]::[UID]::[Instructions]
            // Or: __CLEANUP__::::[Instructions]
            const cleanupParts = manualPrompt.split('::');
            if (cleanupParts.length > 1) {
                const b = cleanupParts[1]?.trim();
                const u = cleanupParts[2]?.trim();
                if (b && u) {
                    targetEntryId = `${b}::${u}`;
                }
                // Custom instructions is everything after target, or after double colon
                if (b && u && cleanupParts.length >= 4) {
                    customInstructions = cleanupParts.slice(3).join('::').trim();
                } else if (!b && !u && cleanupParts.length >= 3) {
                    customInstructions = cleanupParts.slice(2).join('::').trim();
                }
            }

            if (targetEntryId) {
                broadcastStep('thought', `Cleanup mode: targeted compression for "${targetEntryId}"...`);
            } else {
                broadcastStep('thought', 'Cleanup mode: scanning for bloated entries...');
            }

            const flagged = [];
            for (const [bookName, book] of Object.entries(archiveBooks)) {
                if (!book?.entries) continue;
                const nameLower = bookName.toLowerCase();
                const isWorldBook = nameLower.endsWith('_world') || nameLower === 'world';
                if (isWorldBook) continue;

                for (const [uid, entry] of Object.entries(book.entries)) {
                    const fullId = `${bookName}::${uid}`;
                    const tokens = estimateTokens(stripDungeonMapSection(entry.content));
                    const useThreshold = settings.routerCleanupUseThreshold !== false;
                    const isTarget = targetEntryId && fullId === targetEntryId;
                    const overThreshold = !useThreshold || tokens >= CLEANUP_TOKEN_THRESHOLD;

                    if (isTarget || (!targetEntryId && overThreshold)) {
                        const lines = (entry.content || '').split('\n').filter(Boolean).length;
                        const pairs = countRedundantPairs(entry.content);
                        const label = entry.comment || entry.key?.[0] || uid;
                        flagged.push({ id: fullId, tokens, lines, pairs, label, content: entry.content });
                    }
                }
            }

            if (flagged.length === 0) {
                const noFoundMsg = targetEntryId
                    ? `Cleanup: targeted entry "${targetEntryId}" not found.`
                    : settings.routerCleanupUseThreshold !== false
                        ? `Cleanup: no entries exceed the token threshold (${CLEANUP_TOKEN_THRESHOLD}t). Nothing to do.`
                        : `Cleanup: no entries found in the campaign lorebook. Nothing to do.`;
                broadcastStep('finish', noFoundMsg);
                _routerRunning = false;
                return;
            }

            // Sort worst-first so the model prioritises high-impact entries
            flagged.sort((a, b) => b.tokens - a.tokens);
            if (targetEntryId) {
                broadcastStep('thought', `Cleanup: compressing target entry "${flagged[0].label}"...`);
            } else {
                broadcastStep('thought', `Cleanup: ${flagged.length} bloated entr${flagged.length === 1 ? 'y' : 'ies'} found. Requesting compression...`);
            }

            // Build context: metadata list + full content of flagged entries
            const cleanupContext =
                `## ENTRIES FLAGGED FOR CONSOLIDATION\n` +
                flagged.map(e =>
                    `- ${e.id} | "${e.label}" | ~${e.tokens} tokens | ${e.lines} lines` +
                    (e.pairs > 0 ? ` | ⚠ ${e.pairs} redundant line pairs` : ` | ✓ low redundancy`)
                ).join('\n') +
                `\n\n## ENTRY CONTENTS\n` +
                flagged.map(e => `### ${e.id} — "${e.label}"\n${e.content}`).join('\n\n');

            let basicInstructionPrompt = `You are the Lorebook Archivist. Consolidate the bloated entries shown below.

## AVAILABLE TAGS
- [[REWRITE: BookName::UID | new canonical content]]
  Replace a single entry's content with a compressed version.

- [[CONSOLIDATE: TargetID1, TargetID2 | SurvivorID | merged content]]
  Merge two or more duplicate entries into one. All targets are deleted.

## RULES
1. Merge all timestamped updates into a single coherent, present-tense description.
2. Preserve plot-significant changes as brief dated notes (e.g. "Burned down on Day 12").
3. Always retain temporal context. Every rewritten entry MUST include at least one in-world time anchor (e.g. "[Day 2]" or "[Day 2, 11:42]"). You may collapse many timestamps into one, but never remove all temporal markers from an entry.
4. Remove redundant observations — if six updates repeat the same fact, write it once.
5. Preserve every unique fact. When in doubt, keep it. Never replace detailed facts with generic summary text (e.g., writing "Merged details" or "Merged workshop data" is invalid content).
6. Target 30–60% of the original token count.
7. Do NOT activate, deactivate, record, or delete entries except via CONSOLIDATE targets.
8. Do NOT consolidate entries of different categories (e.g., do NOT merge an NPC or Location into a Quest or Event). Consolidation is strictly for true duplicates representing the exact same entity or concept (e.g., two entries for the same NPC).
9. Do NOT merge multiple distinct chronological events into a single entry to "reduce fragmentation". Each distinct event must remain as a separate entry so it triggers on its own keywords.
10. NEVER modify, shorten, or delete content within \`[CORE] ... [/CORE]\` blocks under any circumstances. Keep the tags and their inner content completely unchanged. The system programmatically overwrites any modifications to the CORE block with the original, so editing it is useless.
11. For legacy NPC entries lacking these tags, identify their persistent sections (Species, Body, Equipment, Appearance/Species, Appearance, Personality, Brief Background, Habits/Behaviors) and wrap them inside a \`[CORE] ... [/CORE]\` block to protect them from future passes. Do not include Relationship, Friendship/Rapport, or Affection/Interest lines inside the block.
12. Compress turn-by-turn or granular combat status logs (e.g., creature HP changes, turn-by-turn action lists, temporary conditions mid-fight) into high-level updates: for long combats, preserve the initiation (who/what attacked {{user}}), a progress summary every ~5 rounds (capturing major shifts or stalemates), and the final outcome.
13. Output your reasoning first, then the tags.`;

            let agentInstructionPrompt = `You are the Lorebook Archivist. Consolidate bloated lorebook entries using the tools provided.

## YOUR TASK
For each flagged entry:
1. Decide whether to rewrite in place (rewrite) or merge with a duplicate (consolidate).
2. You MUST call read_entry to inspect the full content of any entry BEFORE you rewrite or consolidate it. Do NOT modify or merge any entry that you have not loaded and read.
3. When done, call commit once with all rewrite and consolidate operations.

## RULES
1. Merge timestamped updates into a single coherent, present-tense description.
2. Preserve plot-significant changes as brief dated notes (e.g. "Burned down on Day 12").
3. Always retain temporal context. Every rewritten entry MUST include at least one in-world time anchor (e.g. "[Day 2]" or "[Day 2, 11:42]"). You may collapse many timestamps into one, but never remove all temporal markers from an entry.
4. Remove redundant observations. Preserve every unique fact. Never replace detailed facts with generic summary text (e.g., writing "Merged Pumping Station data." is a severe failure). The survivor must compile and retain the detailed facts of all targets.
5. Target 30–60% of the original token count per entry.
6. Do NOT activate, deactivate, record, or create new entries.
7. Do NOT consolidate entries of different categories (e.g., do NOT merge an NPC or Location into a Quest or Event). Consolidation is strictly for true duplicates representing the exact same entity (e.g., two entries for the same NPC).
8. Do NOT merge multiple distinct chronological events into a single entry to "reduce fragmentation". Each distinct historical event must remain as its own entry so it triggers on its specific keywords.
9. NEVER modify, shorten, or delete content within \`[CORE] ... [/CORE]\` blocks under any circumstances. Keep the tags and their inner content completely unchanged. The system programmatically overwrites any modifications to the CORE block with the original, so editing it is useless.
10. For legacy NPC entries lacking these tags, identify their persistent sections (Species, Body, Equipment, Appearance/Species, Appearance, Personality, Brief Background, Habits/Behaviors) and wrap them inside a \`[CORE] ... [/CORE]\` block to protect them from future passes. Do not include Relationship, Friendship/Rapport, or Affection/Interest lines inside the block.
11. Compress turn-by-turn or granular combat status logs (e.g., creature HP changes, turn-by-turn action lists, temporary conditions mid-fight) into high-level updates: for long combats, preserve the initiation (who/what attacked {{user}}), a progress summary every ~5 rounds (capturing major shifts or stalemates), and the final outcome.
12. Call commit exactly once at the end. Do not call it per-entry.`;

            if (customInstructions) {
                const overrideText = `\n\n## USER CUSTOM REQUIREMENTS\nYou MUST adhere strictly to these custom compression instructions:\n- ${customInstructions}`;
                basicInstructionPrompt += overrideText;
                agentInstructionPrompt += overrideText;
            }

            // Determine routing mode here so we can shape the cleanup system prompt accordingly.
            // Profile/default connections don't support native tool schemas; use text-format actions.
            const usesNativeToolsForCleanup = ['openai', 'ollama'].includes(routerSettings.connectionSource);

            const cleanupSystemPrompt = settings.routerBasicMode
                ? basicInstructionPrompt
                : (usesNativeToolsForCleanup
                    // Native tool-call path — model receives JSON schemas via the API
                    ? agentInstructionPrompt
                    // Text-format path for profile/default — model must output Action: lines
                    : agentInstructionPrompt + `

## ACTIONS
You do NOT have access to native function calling. Output exactly ONE action per turn in plain text (do NOT use markdown bold/italic formatting on the 'Action:' or 'Thought:' labels, write them as plain text):
  Action: toolname({"arg": "value"})

Available actions:
- read_entry({"uid": "Book::0"}) — read the full content of an entry
- commit({"rewrite": [...], "consolidate": [...]}) — write all cleanup changes and finish

commit rewrite items: {"id": "Book::UID", "content": "compressed content"}
commit consolidate items: {"targets": ["Book::UID1"], "survivor": "Book::UID2", "content": "merged content"}

## EXAMPLE
Thought: The entry is verbose. I will rewrite it with the key facts.
Action: commit({"rewrite": [{"id": "Eldoria_Events::3", "content": "Compressed version of the entry."}]})`
                );

            if (settings.routerBasicMode) {
                const cleanupUserPrompt = cleanupContext;
                broadcastStep('thought', 'Thinking...');
                const basicResp = await sendStateRequest(routerSettings, cleanupSystemPrompt, cleanupUserPrompt, _routerSignal);
                const thoughtMatchC = basicResp.match(/(?:Thought|Reasoning):\s*([\s\S]*?)(?=\[\[|$)/i);
                if (thoughtMatchC) broadcastStep('thought', thoughtMatchC[1].trim().substring(0, 300));
                broadcastStep('thought', 'Parsing cleanup tags...');
                const cleanupAction = parseBasicTags(basicResp, archiveBooks);
                cleanupAction.reason = targetEntryId ? `Targeted cleanup: ${targetEntryId}.` : 'Cleanup pass (basic mode).';
                if (cleanupAction.rewrite.length > 0 || cleanupAction.consolidate.length > 0) {
                    await applyAction(cleanupAction, archiveBooks, currentTime, breadcrumb, isManual);
                    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                    broadcastStep('finish', `Cleanup done in ${totalTime}s — ${cleanupAction.rewrite.length} rewritten, ${cleanupAction.consolidate.length} consolidated.`);
                } else {
                    broadcastStep('finish', 'Cleanup: agent found nothing to compress.');
                }
                _routerRunning = false;
                return;
            }

            // Agent mode: lean context (metadata only) — agent uses read_entry per-entry
            const agentCleanupContext = `## ENTRIES FLAGGED FOR CLEANUP\n` +
                flagged.map(e =>
                    `- ${e.id} | "${e.label}" | ~${e.tokens} tokens | ${e.lines} lines` +
                    (e.pairs > 0 ? ` | ⚠ ${e.pairs} redundant pairs` : '')
                ).join('\n');

            const usesNativeTools = usesNativeToolsForCleanup;
            // Text-format connections get full entry content upfront (one-shot commit, no read_entry turn needed).
            // Native tool connections get lean metadata and can use read_entry to pull content on demand.
            const cleanupMessages = [
                { role: 'system', content: cleanupSystemPrompt },
                { role: 'user',   content: usesNativeTools ? agentCleanupContext : cleanupContext }
            ];

            /** @type {Array<object>} */
            const cleanupAgentTools = [
                {
                    type: 'function',
                    function: {
                        name: 'grep_lore',
                        description: `Search all lorebooks in scope ("${prefix || 'All'}") for entries whose content or label contains the query.`,
                        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'inspect_book',
                        description: 'List all entry labels and UIDs in a specific lorebook.',
                        parameters: { type: 'object', properties: { book_name: { type: 'string' } }, required: ['book_name'] }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'read_entry',
                        description: 'Read the full content of a lorebook entry.',
                        parameters: { type: 'object', properties: { uid: { type: 'string', description: 'Entry UID in "BookName::0" format.' } }, required: ['uid'] }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'commit',
                        description: 'Write all cleanup changes and finish. Call exactly once at the end.',
                        parameters: {
                            type: 'object',
                            properties: {
                                rewrite: {
                                    type: 'array',
                                    description: 'Full content replacements for bloated entries. Do NOT rewrite an entry unless you called read_entry to inspect it first.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id:      { type: 'string', description: 'Book::UID of the entry to rewrite.' },
                                            content: { type: 'string', description: 'New canonical content. Replaces the entire entry.' }
                                        },
                                        required: ['id', 'content']
                                    }
                                },
                                consolidate: {
                                    type: 'array',
                                    description: 'Merge multiple entries of the SAME category into one (e.g. duplicate NPCs). Targets are deleted. Do NOT merge different categories (e.g. do NOT merge NPC into Quest). Do NOT merge distinct chronological events to reduce fragmentation. Use rename in the same commit to give the survivor a new canonical label/keys after merging.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            targets:  { type: 'array', items: { type: 'string' }, description: 'Book::UID IDs to delete after merging. Must be the same category as survivor.' },
                                            survivor: { type: 'string', description: 'Book::UID to keep.' },
                                            content:  { type: 'string', description: 'Merged content for survivor. You MUST compile and preserve all unique facts/details from the targets. Generic placeholders (e.g. "Merged data") are forbidden.' }
                                        },
                                        required: ['targets', 'survivor', 'content']
                                    }
                                },
                                rename: {
                                    type: 'array',
                                    description: 'Change the display label and/or keyword list of an existing entry without modifying its content. Use when an entity is revealed, renamed, or destroyed, or to give a consolidation survivor a canonical label. Max 6 keywords per entry.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id:    { type: 'string', description: 'Book::UID of the entry to rename.' },
                                            label: { type: 'string', description: 'New display label. Omit to keep the current label.' },
                                            keys:  { type: 'array', items: { type: 'string' }, description: 'Full replacement keyword list (max 6). Omit to keep current keywords.' }
                                        },
                                        required: ['id']
                                    }
                                }
                            }
                        }
                    }
                }
            ];

            let cleanupTurns = 0;
            let cleanupRetries = 0;
            const MAX_CLEANUP_RETRIES = 2;
            while (cleanupTurns < maxTurns) {
                cleanupTurns++;
                broadcastStep('thought', `Cleanup thinking (Turn ${cleanupTurns}/${maxTurns})...`);
                const result = await sendAgentTurn(routerSettings, cleanupMessages, usesNativeTools ? cleanupAgentTools : null, _routerSignal);

                if (result.content) {
                    const thoughtLine = result.content.match(/(?:Thought|Reasoning):\s*(.*)/i)?.[1]?.trim()
                        || result.content.trim().split('\n')[0];
                    if (thoughtLine) broadcastStep('thought', thoughtLine.substring(0, 200));
                }

                let resolvedToolCall = result.toolCall;
                if (!resolvedToolCall && result.content) {
                    resolvedToolCall = parseTextAction(result.content);
                }
                if (!resolvedToolCall) {
                    if (cleanupRetries < MAX_CLEANUP_RETRIES) {
                        cleanupRetries++;
                        cleanupTurns--; // don't charge this against the turn budget
                        const isEmpty = !result.content || !result.content.trim();
                        if (isEmpty) {
                            // Empty/null content means the API returned an incomplete response
                            // (e.g. reasoning-model cut-off with finish_reason: null).
                            // Retry with the same message history — no history change needed.
                            broadcastStep('thought', `Incomplete API response (retry ${cleanupRetries}/${MAX_CLEANUP_RETRIES})...`);
                        } else {
                            // Model produced content but no parseable Action: line.
                            // Nudge it to output its action and retry.
                            broadcastStep('thought', `No action in response, nudging model (retry ${cleanupRetries}/${MAX_CLEANUP_RETRIES})...`);
                            cleanupMessages.push({ role: 'assistant', content: result.content });
                            cleanupMessages.push({ role: 'user', content: 'Please output your Action now. Remember: Action: toolname({...})' });
                        }
                        continue;
                    }
                    break;
                }
                cleanupRetries = 0; // reset on a successful action

                const { name: toolName, args } = resolvedToolCall;
                const callId = /** @type {any} */ (resolvedToolCall).id || `call_cleanup_${Date.now()}_${cleanupTurns}`;
                broadcastStep('tool', `${toolName}(...)`);

                const _asstCleanup = {
                    role: 'assistant',
                    content: result.content || null,
                    tool_calls: [{ id: callId, type: 'function', function: { name: toolName, arguments: JSON.stringify(args) } }]
                };
                if (result.reasoning) _asstCleanup.reasoning_content = result.reasoning;
                cleanupMessages.push(_asstCleanup);

                let observation = '';
                if (toolName === 'commit') {
                    args.reason = targetEntryId ? `Targeted cleanup: ${targetEntryId}.` : 'Cleanup pass (agent mode).';
                    const commitResult = await applyAction(args, archiveBooks, currentTime, breadcrumb, isManual);
                    archiveBooks = await fetchArchiveBooks();
                    if (commitResult.errors.length > 0) {
                        observation = `Committed with warnings: ${commitResult.errors.join(', ')}`;
                    } else {
                        const details = [];
                        if (args.rewrite?.length)     details.push(`Rewritten: ${args.rewrite.length}`);
                        if (args.consolidate?.length) details.push(`Consolidated: ${args.consolidate.length}`);
                        observation = `Committed successfully. ${details.join(' | ')}`;
                    }
                } else if (toolName === 'read_entry') {
                    const uid = args.uid || '';
                    if (isSkeletonEntryId(uid)) {
                        observation = 'World Skeleton entries are not accessible to the Lorebook Agent.';
                    } else {
                        const [bookName, id] = uid.split('::');
                        const book = await ctx.loadWorldInfo(bookName);
                        observation = book?.entries?.[id] ? book.entries[id].content : `Entry "${uid}" not found.`;
                    }
                } else if (toolName === 'grep_lore') {
                    const hits = grepLoreInBooks(archiveBooks, args.query);
                    observation = hits.length > 0 ? hits.join('\n') : `No entries found for "${args.query}".`;
                } else if (toolName === 'inspect_book') {
                    const bookName = args.book_name || '';
                    if (isSkeletonBookName(bookName)) {
                        observation = 'World Skeleton lorebooks are not accessible to the Lorebook Agent.';
                    } else if (archiveBooks[bookName]) {
                        observation = Object.entries(archiveBooks[bookName].entries)
                            .map(([uid, e]) => `${bookName}::${uid} -- ${e.comment || e.key?.[0] || uid}`)
                            .join('\n');
                    } else {
                        observation = `Book "${bookName}" not found.`;
                    }
                } else {
                    observation = `Unknown tool: ${toolName}`;
                }

                broadcastStep('result', observation.substring(0, 200) + (observation.length > 200 ? '...' : ''));
                cleanupMessages.push({
                    role: 'tool',
                    tool_call_id: cleanupMessages[cleanupMessages.length - 1].tool_calls[0].id,
                    content: observation
                });

                if (toolName === 'commit') break;
            }

            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            broadcastStep('finish', `Cleanup done in ${totalTime}s.`);
            _routerRunning = false;
            return;
        }
        // ── End Cleanup Mode ──────────────────────────────────────────────────

        // -- Section Names List Setup ------------------------------------------
        let coreSections = settings.npcCoreSections;
        if (!coreSections || !Array.isArray(coreSections) || coreSections.length === 0) {
            coreSections = DEFAULT_NPC_SECTIONS;
        }
        const sectionNamesList = coreSections.map(s => s.name).join(', ');
        // Body and Worn Equipment are exclusive to their dedicated tools; automatic passes may
        // only additionally touch Combat Profile via commit.core / UPDATE_CORE. Species and
        // the other identity fields (Personality, Background, Habits, Strengths, Flaws) only
        // unlock on a manual/Direct Prompt pass.
        const eligibleCoreFields = getEligibleCoreFieldNames(coreSections, isManual);
        const eligibleCoreFieldsList = eligibleCoreFields.join(', ');
        const autoPassCoreRestriction = resolveAutoPassRestriction(settings, isManual, eligibleCoreFieldsList);
        const pcAppearanceGuidance = `
- You may update the Player Character's own Body via \`[[UPDATE_APPEARANCE: {{user}} | new body text]]\` (basic) or \`commit.appearance\` with id \`{{user}}\` / \`player\` / \`pc\` / the PC's name when their signature look permanently changes.
- You may update the Player Character's own Worn Equipment via \`[[UPDATE_EQUIPMENT: {{user}} | new worn gear text]]\` (basic) or \`commit.equipment\` the same way, whenever their visibly worn/carried gear changes.
- Never touch the PC's Species/Personality/Background/Habits/Strengths/Flaws, and never create a new PC lorebook entry.
- Body means signature/default physical look (build, face, hair, features) — not a transient pose. Worn Equipment means currently worn/carried gear only — not Body, coins, loot piles, or inventory lists.`;
        const existingNpcChronicleNudge = resolveExistingNpcNudge(settings);

        // -- Basic Mode (tag-based, one-shot, no tool calling) -----------------
        if (settings.routerBasicMode) {

            const modules = settings.routerModules || {};
            const customTags = settings.routerCustomTags || [];
            const formatLines = [];
            for (const config of Object.values(modules)) {
                if (config.enabled) formatLines.push(`- [[${config.tag}: ${config.format}]] (${config.instruction})`);
            }
            for (const custom of customTags) {
                formatLines.push(`- [[${custom.tag}: ${custom.format || 'Name | Description | Keywords'}]] (${custom.instruction})`);
            }
            formatLines.push(`- [[ACTIVATE: Name]] (Bring entry to active memory)`);
            formatLines.push(`- [[DEACTIVATE: Name]] (Remove from active memory)`);
            formatLines.push(`- [[DELETE: Name]] (Permanently remove an entry)`);

            const formatLinesStr = formatLines.join('\n');
            let modularPrompt = settings.routerModularPromptTemplate || '';
            modularPrompt = modularPrompt.replace(/\{\{formatLines\}\}/g, formatLinesStr);

            // World Progression is now a standalone deterministic pass — strip any leftover
            // {{#if_world}} blocks from user-edited templates (default no longer contains them).
            modularPrompt = modularPrompt.replace(/\{\{#if_world\}\}[\s\S]*?\{\{\/if_world\}\}/g, '');
            modularPrompt = modularPrompt.replace(/\{\{#if_world\}\}|\{\{\/if_world\}\}|\{\{dayStr\}\}|\{\{prevDay\}\}/g, '');

            const relSection = settings.npcRelationshipBars
                ? buildRouterRelationshipInstruction(getNpcRelationshipMax(settings), settings).trim()
                : '';

            // Resolve the Basic Mode system prompt from the editable template.
            // Runtime-dependent fragments (combat guidance, pass restrictions, etc.) are
            // expanded from editable settings templates — see defaults.js.
            const basicRawTemplate = settings.routerBasicSystemPromptTemplate || '';
            const maxActNum = settings.routerMaxActivations || 12;
            const basicSystemPrompt = adjustPromptTimestamps(
                expandLorebookPromptTemplate(
                    basicRawTemplate
                    .replace(/You are limited to \*\*\d+ active entries\*\*/gi, `You are limited to **${maxActNum} active entries**`)
                    .replace(/Maximum Active Entities:\s*\*\*\d+\*\*/gi, `Maximum Active Entities: **${maxActNum}**`),
                    {
                        modularPrompt,
                        formatLines: formatLinesStr,
                        maxActivations: maxActNum,
                        sectionNames: sectionNamesList,
                        relSection,
                        pcAppearanceGuidance,
                        eligibleCoreFields: eligibleCoreFieldsList,
                        autoPassRestriction: autoPassCoreRestriction,
                        existingNpcNudge: existingNpcChronicleNudge,
                        combatProfileGuidance: combatProfileGuidanceBasic.trim(),
                    },
                ),
                settings
            );

            const finalBasicSystemPrompt = `${stripStaticDungeonAgentGuidance(basicSystemPrompt)}${formatMappedSiteAgentNote(activeDungeonContext)}`;

            const questMatchB = settings.currentMemo?.match(/\[QUESTS\]([\s\S]*?)\[\/QUESTS\]/i);
            const questBlockB = questMatchB ? `[QUESTS]${questMatchB[1].trim()}[/QUESTS]` : 'None';
            const basicUserPrompt = `## BUDGET STATUS\n${budgetLine}${curationInstruction}${overflowInstruction}\n\n## NEWLY ACTIVATED THIS TURN\n${newlyTriggeredFull.join('\n\n') || 'None.'}\n\n## ACTIVE MEMORY (Lore)\n${activeEntriesFull.join('\n\n') || 'None.'}\n\n${formatArchiveIndexSection(keyringText)}\n\n${formatCurrentLocationSection(currentHierarchy)}${formatMappedSiteAgentNote(activeDungeonContext)}\n\n## ACTIVE QUESTS\n${questBlockB}\n\n${pcCharacterSeedSection}${activeCombatSection}## NARRATIVE\n${recentChatString}\n\n${manualPrompt ? `## INSTRUCTION\n${manualPrompt}\n\n` : ''}`;

            broadcastStep('thought', 'Thinking...');
            const basicResp = await sendStateRequest(routerSettings, finalBasicSystemPrompt, basicUserPrompt, _routerSignal);

            const thoughtMatchB = basicResp.match(/Thought:\s*([\s\S]*?)(?=\[\[|$)/i);
            if (thoughtMatchB) broadcastStep('thought', thoughtMatchB[1].trim());
            broadcastStep('thought', 'Parsing tags...');
            const basicAction = parseBasicTags(basicResp, archiveBooks);

            const hasOrdinaryActions = basicAction.record.length > 0 || basicAction.update.length > 0 || basicAction.activate.length > 0 || basicAction.deactivate.length > 0 || basicAction.delete_ids?.length > 0 || basicAction.rel?.length > 0 || basicAction.appearance?.length > 0 || basicAction.equipment?.length > 0 || basicAction.core?.length > 0;
            if (hasOrdinaryActions) {
                const summaries = [];
                if (basicAction.record.length) summaries.push(`New: ${basicAction.record.length}`);
                if (basicAction.update.length) summaries.push(`Updates: ${basicAction.update.length}`);
                if (basicAction.activate.length) summaries.push(`Activations: ${basicAction.activate.length}`);
                if (basicAction.deactivate.length) summaries.push(`Deactivations: ${basicAction.deactivate.length}`);
                if (basicAction.core?.length || basicAction.appearance?.length || basicAction.equipment?.length) summaries.push(`Core: ${(basicAction.core?.length || 0) + (basicAction.appearance?.length || 0) + (basicAction.equipment?.length || 0)}`);
                basicAction.reason = (thoughtMatchB ? thoughtMatchB[1].trim() : 'Tag-based update.') + ` (${summaries.join(', ')})`;
                await applyAction(basicAction, archiveBooks, currentTime, breadcrumb, isManual);
                basicSummaryText = summaries.join(', ');
            } else {
                broadcastStep('finish', 'Basic Mode: No tags found.');
            }

        } else {
            // -- Agent Mode (native tool calling, multi-turn messages) ----------

            // Dynamically build the commit tool parameters based on settings
            const commitProperties = {
                ...(categoryEnum.length ? { record: {
                    type: 'array',
                    description: 'Creates a BRAND-NEW entry only. Never use this for a name that already appears in ACTIVE MEMORY, NEWLY ACTIVATED THIS TURN, or the ARCHIVE INDEX — that would duplicate their [CORE] block. For an existing entity, use "core" (identity/Combat Profile fields) or "update" (chronicle text) instead.',
                    items: {
                        type: 'object',
                        properties: {
                            label: { type: 'string', description: 'Entity name only. NO tag prefix (e.g. "Iron Syndicate", NOT "FAC: Iron Syndicate"). Do NOT record the player character under any name (including "Player" or their roleplay character name/alias like "Dave Davidson").' },
                            keys:  { type: 'array', items: { type: 'string' }, description: 'Search keywords. Include the entity name/title itself (without timestamps like "[Day 1]") as a keyword, plus any ancestor location names.' },
                            content:  { type: 'string', description: `Full entry body. Follow the FIELD INSTRUCTIONS for the selected enabled category. Stock-category formatting, when enabled: NPC uses structured [CORE] with ${sectionNamesList}; LOC/FAC use plain [CORE]; QUEST/EVENT use chronicle format.` },
                            category: { type: 'string', enum: categoryEnum, description: `REQUIRED. Use exactly one category enabled for this pass: ${categoryChoiceText || '(none)'}. ${categoryRouteText ? `Routes: ${categoryRouteText}. ` : ''}Labels and "::" paths do not choose the book.` }
                        },
                        required: ['label', 'keys', 'content', 'category']
                    }
                } } : {}),
                update: {
                    type: 'array',
                    description: 'Append new information to existing entries.',
                    items: {
                        type: 'object',
                        properties: {
                            id:      { type: 'string', description: 'Book::UID format (e.g. "Eldoria_NPCs::0").' },
                            content: { type: 'string', description: 'New information to append.' }
                        },
                        required: ['id', 'content']
                    }
                },
                activate:   { type: 'array', items: { type: 'string' }, description: 'Book::UID IDs to move into active context.' },
                deactivate: { type: 'array', items: { type: 'string' }, description: 'Book::UID IDs to remove from active context.' },
                delete_ids: { type: 'array', items: { type: 'string' }, description: 'Book::UID IDs to permanently delete.' },
                rewrite: {
                    type: 'array',
                    description: 'Replace the entire content of existing entries. Use for compressing bloated entries.',
                    items: {
                        type: 'object',
                        properties: {
                            id:      { type: 'string', description: 'Book::UID of the entry to rewrite.' },
                            content: { type: 'string', description: 'New canonical content. Replaces everything.' }
                        },
                        required: ['id', 'content']
                    }
                },
                consolidate: {
                    type: 'array',
                    description: 'Merge multiple entries into one. All targets are deleted; the survivor gets the new content. Use rename in the same commit to give the survivor a canonical label/keys after merging.',
                    items: {
                        type: 'object',
                        properties: {
                            targets:  {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'One or more Book::UID IDs to delete after merging.'
                            },
                            survivor: { type: 'string', description: 'Book::UID of the entry to keep, with merged content.' },
                            content:  { type: 'string', description: 'Full merged canonical content for the survivor.' }
                        },
                        required: ['targets', 'survivor', 'content']
                    }
                },
                rename: {
                    type: 'array',
                    description: 'Change the display label and/or keyword list of an existing entry without modifying its content. Use when an entity is revealed, renamed, or destroyed, or to give a consolidation survivor a canonical label. Max 6 keywords per entry — choose only the most essential trigger words.',
                    items: {
                        type: 'object',
                        properties: {
                            id:    { type: 'string', description: 'Book::UID of the entry to rename/rekey.' },
                            label: { type: 'string', description: 'New display label. Omit to keep the current label.' },
                            keys:  { type: 'array', items: { type: 'string' }, description: 'Full replacement keyword list (max 6). Replaces existing keywords entirely. Omit to keep current keywords.' }
                        },
                        required: ['id']
                    }
                }
            };

            if (settings.npcRelationshipBars) {
                const relMax = getNpcRelationshipMax(settings);
                commitProperties.rel = {
                    type: 'array',
                    description: `Set INITIAL/STARTING relationship values for NEWLY RECORDED NPCs only. When you record a new NPC, infer an appropriate starting delta from narrative context (see NPC relationship guidelines — values scale to ±${relMax}). Do NOT use this for ongoing relationship changes — those are tracked automatically by the system from the narrative output. Output only the delta, not the total.`,
                    items: {
                        type: 'object',
                        properties: {
                            id:    { type: 'string', description: 'Book::UID or plain NPC name.' },
                            field: { type: 'string', enum: ['friendship', 'affection'], description: 'Which relationship axis to update.' },
                            delta: { type: 'integer', description: `Signed integer delta (e.g. 15 or -20). Range: -${relMax} to +${relMax}.` }
                        },
                        required: ['id', 'field', 'delta']
                    }
                };
            }

            commitProperties.appearance = {
                type: 'array',
                description: 'Surgically update Body (signature/default physical look) for an NPC [CORE] or the linked Player Character card. Not for worn gear — use commit.equipment for that. For the PC, set id to "{{user}}", "player", "pc", or the PC\'s name.',
                items: {
                    type: 'object',
                    properties: {
                        id:      { type: 'string', description: 'Book::UID / NPC name, or "{{user}}" / "player" / "pc" / PC name for the Player Character card.' },
                        content: { type: 'string', description: 'New Body text. Replaces only the Body field.' }
                    },
                    required: ['id', 'content']
                }
            };

            commitProperties.equipment = {
                type: 'array',
                description: 'Surgically update Equipment (currently worn/carried gear) for an NPC [CORE] or the linked Player Character card. Use whenever the narrative explicitly shows their equipped weapons/armor/clothing changing. For the PC, set id to "{{user}}", "player", "pc", or the PC\'s name.',
                items: {
                    type: 'object',
                    properties: {
                        id:      { type: 'string', description: 'Book::UID / NPC name, or "{{user}}" / "player" / "pc" / PC name for the Player Character card.' },
                        content: { type: 'string', description: 'New Equipment text. Replaces only the Equipment field.' }
                    },
                    required: ['id', 'content']
                }
            };

            commitProperties.core = {
                type: 'array',
                description: `Surgically update an eligible [CORE] field on an NPC (${eligibleCoreFieldsList}). Body/Equipment use commit.appearance/commit.equipment instead. ${!isManual ? 'AUTOMATIC PASS: Combat Profile only.' : 'DIRECT PROMPT PASS: identity fields (including Species) unlocked when the user instruction warrants it.'}`,
                items: {
                    type: 'object',
                    properties: {
                        id:      { type: 'string', description: 'Book::UID or plain NPC name from ACTIVE MEMORY, NEWLY ACTIVATED, or ARCHIVE INDEX. Not used for the Player Character — PC Body/Equipment use commit.appearance/commit.equipment.' },
                        field:   { type: 'string', enum: eligibleCoreFields, description: 'The exact eligible [CORE] field to update this pass.' },
                        content: { type: 'string', description: 'New field content. To color text, write <font color=#RRGGBB>text</font> with an UNQUOTED hex (never color="#RRGGBB" — quotes break JSON). Preserve existing font/hex color markup.' }
                    },
                    required: ['id', 'field', 'content']
                }
            };

            /** @type {Array<object>} */
            const agentTools = [
                {
                    type: 'function',
                    function: {
                        name: 'grep_lore',
                        description: `Search entry bodies in scope ("${prefix || 'All'}") for one keyword or phrase. Do not use this to check whether a named entity exists — scan ARCHIVE INDEX instead.`,
                        parameters: {
                            type: 'object',
                            properties: { query: { type: 'string', description: 'One keyword or short phrase. Not a list of names.' } },
                            required: ['query']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'inspect_book',
                        description: 'List UIDs in one lorebook. Usually unnecessary: ARCHIVE INDEX already lists every inactive entry as Book::UID.',
                        parameters: {
                            type: 'object',
                            properties: { book_name: { type: 'string', description: 'Exact lorebook name (e.g. "Eldoria_Factions").' } },
                            required: ['book_name']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'read_entry',
                        description: 'Read the full body of an archived entry using Book::UID from ARCHIVE INDEX. Not for existence checks.',
                        parameters: {
                            type: 'object',
                            properties: { uid: { type: 'string', description: 'Entry UID in "BookName::0" format from ARCHIVE INDEX.' } },
                            required: ['uid']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'commit',
                        description: 'Write all changes to the lorebook and finish the research pass. The ONLY way to persist data.',
                        parameters: {
                            type: 'object',
                            properties: commitProperties
                        }
                    }
                }
            ];

            // Native tool calling is only reliable for direct openai/ollama connections.
            // For profile/default the ConnectionManagerRequestService may not forward tools
            // correctly, causing MALFORMED_FUNCTION_CALL errors. Those connections get a
            // text-format (Action:/Observation:) system prompt and text-based parsing instead.
            const usesNativeTools = ['openai', 'ollama'].includes(routerSettings.connectionSource);

            // Build field instructions for the {{fieldInstructions}} token
            const fieldInstructionLines = [
                ...Object.values(settings.routerModules || {}).filter(m => m.enabled).map(m => `- ${m.tag}: ${m.instruction}`),
                ...((settings.routerCustomTags || []).length
                    ? ['', '### CUSTOM CATEGORIES', ...(settings.routerCustomTags || []).map(m => `- ${m.tag.toUpperCase()}: ${m.instruction}`)]
                    : []),
            ].join('\n');

            // Resolve the Agent Mode shared context from the editable template.
            // All previously-hardcoded sharedContext sections now live in
            // routerAgentSharedContextTemplate (see defaults.js).
            const agentRawTemplate = settings.routerAgentSharedContextTemplate || '';
            const agentRelSection = settings.npcRelationshipBars
                ? buildNpcRelationshipInstruction(getNpcRelationshipMax(settings), settings).trim()
                : '';
            const maxActNumAgent = settings.routerMaxActivations || 12;
            const sharedContext = adjustPromptTimestamps(
                expandLorebookPromptTemplate(
                    agentRawTemplate
                    .replace(/Maximum Active Entities:\s*\*\*\d+\*\*/gi, `Maximum Active Entities: **${maxActNumAgent}**`)
                    .replace(/You are limited to \*\*\d+ active entries\*\*/gi, `You are limited to **${maxActNumAgent} active entries**`),
                    {
                        maxActivations: maxActNumAgent,
                        pcAppearanceGuidance,
                        eligibleCoreFields: eligibleCoreFieldsList,
                        autoPassRestriction: autoPassCoreRestriction,
                        existingNpcNudge: existingNpcChronicleNudge,
                        campaignRoot: prefix || 'World Archive',
                        campaignNpcBook: prefix ? `${prefix}_NPCs` : 'NPCs',
                        campaignLocBook: prefix ? `${prefix}_Locations` : 'Locations',
                        fieldInstructions: fieldInstructionLines,
                        combatProfileGuidance: combatProfileGuidanceAgent.trim(),
                        relSection: agentRelSection,
                    },
                ),
                settings
            );

            const commitFieldNames = [
                ...(categoryEnum.length ? ['"record": [...]'] : []),
                '"update": [...]', '"rename": [...]', '"activate": [...]',
                '"deactivate": [...]', '"delete_ids": [...]',
                ...(settings.npcRelationshipBars ? ['"rel": [...]'] : []),
                '"appearance": [...]', '"equipment": [...]', '"core": [...]',
            ].join(', ');

            const commitRelDescription = settings.npcRelationshipBars
                ? `\ncommit rel items: {"id": "Book::UID or NPC Name", "field": "friendship"|"affection", "delta": ±N} — set INITIAL relationship values for newly recorded NPCs only (signed integer delta)`
                : ``;

            const adjustedSharedContext = `${stripStaticDungeonAgentGuidance(sharedContext)}${formatMappedSiteAgentNote(activeDungeonContext)}`;

            const agentSystemPrompt = usesNativeTools
                // Clean prompt for native tool calling ? model gets schemas via the API
                ? `${basePrompt}

## YOUR ROLE
You are a lorebook research agent. Maintain the campaign lorebook using the provided tools.
${LORE_EXISTENCE_RULE}
When research is complete, call commit once to write all changes. Stop immediately after.
${adjustedSharedContext}
${recordCategoryGuidance}`
                // Text-format prompt for profile/default ? model outputs Action:/Observation: text
                : `${basePrompt}

## YOUR ROLE
You are a lorebook research agent. Maintain the campaign lorebook using the actions below.
${LORE_EXISTENCE_RULE}
When research is complete, output commit once to write all changes, then stop.

## ACTIONS
Output exactly ONE action per turn in this format (do NOT use markdown bold/italic formatting on the 'Action:' or 'Thought:' labels, write them as plain text):
  Action: toolname({"arg": "value"})

Available actions:
- grep_lore({"query": "..."}) — search entry bodies for one keyword/phrase; not an existence check
- inspect_book({"book_name": "..."}) — list UIDs in a lorebook (usually unnecessary; ARCHIVE INDEX has Book::UID)
- read_entry({"uid": "Book::0"}) — read full body of an archived entry already on ARCHIVE INDEX
- commit({${commitFieldNames}}) ? write all changes and finish

${categoryEnum.length
    ? `commit record items: {"label": "Name only (NO tag prefix)", "keys": ["kw1","kw2"], "content": "...", "category": ${categoryExampleValue}} — category is REQUIRED and must use one of these enabled values: ${categoryChoiceText}.`
    : `commit record items: unavailable because no record categories are enabled.`}
commit update items: {"id": "Book::UID", "content": "new text to append"}
commit rename items: {"id": "Book::UID", "label": "New Name (optional)", "keys": ["kw1","kw2"] (optional, max 6)}${commitRelDescription}
commit appearance items: {"id": "Book::UID or NPC Name or {{user}}", "content": "new body text"} — surgically updates Body (NPC [CORE] or linked PC card)
commit equipment items: {"id": "Book::UID or NPC Name or {{user}}", "content": "new equipment text"} — surgically updates Equipment (NPC [CORE] or linked PC card)
commit core items: {"id": "Book::UID or NPC Name", "field": "${eligibleCoreFields.join('|')}", "content": "new field content"} — surgically updates an eligible [CORE] field on NPC entries only (Body/Equipment use commit.appearance/commit.equipment; automatic passes = Combat Profile only)

## EXAMPLE
${categoryEnum.length
    ? `Thought: New Entity is not in ACTIVE MEMORY or ARCHIVE INDEX, so it does not exist yet. I will record it with an enabled category.\nAction: commit({"record": [{"label": "New Entity", "keys": ["New Entity"], "content": "Persistent details about the entity.", "category": "${categoryEnum[0]}"}]})`
    : `Thought: No record categories are enabled, so I will not create a record.\nAction: commit({})`}
${adjustedSharedContext}
${recordCategoryGuidance}`;

            const questMatchA = settings.currentMemo?.match(/\[QUESTS\]([\s\S]*?)\[\/QUESTS\]/i);
            const questBlockA = questMatchA ? `[QUESTS]${questMatchA[1].trim()}[/QUESTS]` : 'None';
            const contextMessage = `## BUDGET STATUS\n${budgetLine}${curationInstruction}${overflowInstruction}\n\n## NEWLY ACTIVATED THIS TURN\n${newlyTriggeredFull.join('\n\n') || 'None.'}\n\n## ACTIVE MEMORY (Lore)\n${activeEntriesFull.join('\n\n') || 'None yet.'}\n\n${formatArchiveIndexSection(keyringText)}\n\n${formatCurrentLocationSection(currentHierarchy)}${formatMappedSiteAgentNote(activeDungeonContext)}\n\n## ACTIVE QUESTS\n${questBlockA}\n\n${pcCharacterSeedSection}${activeCombatSection}## NARRATIVE\n${recentChatString}${manualPrompt ? `\n\n## INSTRUCTION\n${manualPrompt}` : ''}`;

            /** @type {Array<{role:string, content:string|null, tool_calls?:any[], tool_call_id?:string}>} */
            const messages = [
                { role: 'system', content: agentSystemPrompt },
                { role: 'user',   content: contextMessage }
            ];

            let agentRetries = 0;
            const MAX_AGENT_RETRIES = 2;
            let jsonCorrectionRetries = 0;
            const MAX_JSON_CORRECTION_RETRIES = 2;
            let terminalCommitRejection = '';
            while (turns < maxTurns) {
                turns++;
                broadcastStep('thought', `Thinking (Turn ${turns}/${maxTurns})...`);

                // Only pass tool schemas to connections that support native tool calling.
                // Profile/default connections ignore or mishandle the tools parameter.
                const result = await sendAgentTurn(routerSettings, messages, usesNativeTools ? agentTools : null, _routerSignal);

                // Show any inline thought the model included alongside the tool call
                if (result.content) {
                    const thoughtLine = result.content.match(/Thought:\s*(.*)/i)?.[1]?.trim()
                        || result.content.trim().split('\n')[0];
                    if (thoughtLine) broadcastStep('thought', thoughtLine.substring(0, 200));
                }

                // For profile/default connections the model outputs text. Parse a single
                // Action: call from the current turn response (safe since it's single-turn).
                let resolvedToolCall = result.toolCall;
                if (!resolvedToolCall && result.content) {
                    resolvedToolCall = parseTextAction(result.content);
                }

                if (!resolvedToolCall) {
                    if (agentRetries < MAX_AGENT_RETRIES) {
                        agentRetries++;
                        turns--; // don't charge this against the turn budget
                        const isEmpty = !result.content || !result.content.trim();
                        if (isEmpty) {
                            // Empty/null content — incomplete API response (e.g. reasoning cut-off).
                            // Retry with unchanged history.
                            broadcastStep('thought', `Incomplete API response (retry ${agentRetries}/${MAX_AGENT_RETRIES})...`);
                        } else {
                            // Model produced text but no parseable Action — nudge it.
                            broadcastStep('thought', `No action in response, nudging model (retry ${agentRetries}/${MAX_AGENT_RETRIES})...`);
                            messages.push({ role: 'assistant', content: result.content });
                            const jsonHint = /\bAction\s*:/i.test(result.content)
                                ? 'Your Action JSON could not be parsed. Output one corrected action using strict JSON with double-quoted keys/strings and no trailing commas: Action: toolname({...})'
                                : 'Please output your Action now. Remember: Action: toolname({...})';
                            messages.push({ role: 'user', content: jsonHint });
                        }
                        continue;
                    }
                    // No tool call and no parseable action after retries — model is done
                    if (result.content && /\bAction\s*:/i.test(result.content)) {
                        throw new Error('Lorebook Agent repeatedly returned malformed Action JSON. Nothing was written.');
                    }
                    break;
                }
                agentRetries = 0; // reset on a successful action

                const { name: toolName, args: parsedArgs, argumentError } = resolvedToolCall;
                const argsAreObject = parsedArgs && typeof parsedArgs === 'object' && !Array.isArray(parsedArgs);
                const args = argsAreObject ? parsedArgs : {};
                const effectiveArgumentError = argumentError || (!argsAreObject ? 'Tool arguments must be a JSON object.' : null);
                const callId = /** @type {any} */ (resolvedToolCall).id || `call_${Date.now()}_${turns}`;
                broadcastStep('tool', `${toolName}(...)`);

                // Append the assistant turn (with tool_calls) to the conversation.
                // DeepSeek thinking models require reasoning_content to be passed back.
                const _asstMsg = {
                    role: 'assistant',
                    content: result.content || null,
                    tool_calls: [{
                        id:   callId || `call_${Date.now()}_${turns}`,
                        type: 'function',
                        function: { name: toolName, arguments: JSON.stringify(args) }
                    }]
                };
                if (result.reasoning) _asstMsg.reasoning_content = result.reasoning;
                messages.push(_asstMsg);

                let observation = '';
                let commitAccepted = false;
                let retryRejectedJson = false;

                if (effectiveArgumentError) {
                    jsonCorrectionRetries++;
                    observation = JSON.stringify({
                        ok: false,
                        retryable: jsonCorrectionRetries <= MAX_JSON_CORRECTION_RETRIES,
                        code: 'MALFORMED_JSON',
                        path: `${toolName}.arguments`,
                        received: effectiveArgumentError,
                        hint: 'Retry the same action with strict JSON: double-quoted keys/strings, no comments, and no trailing commas. For color markup write <font color=#RRGGBB>text</font> with UNQUOTED hex — never color="#RRGGBB". Nothing was written.',
                    }, null, 2);
                    retryRejectedJson = jsonCorrectionRetries <= MAX_JSON_CORRECTION_RETRIES;
                } else if (toolName === 'commit') {
                    const ordinaryAction = { ...args };
                    delete ordinaryAction.map;
                    const commitResult = await applyAction(ordinaryAction, archiveBooks, currentTime, breadcrumb, isManual);
                    commitAccepted = true;
                    jsonCorrectionRetries = 0;
                    const details = [];
                    if (commitResult.recordedIds?.length > 0) details.push(`Recorded/Updated: ${commitResult.recordedIds.join(', ')}`);
                    if (args.activate?.length > 0) details.push(`Activated: ${args.activate.join(', ')}`);
                    observation = commitResult.errors.length > 0
                        ? `Committed with warnings: ${commitResult.errors.join(', ')}${details.length ? ` | ${details.join(' | ')}` : ''}`
                        : `Committed successfully. ${details.join(' | ')}`;
                    archiveBooks = await fetchArchiveBooks();
                    keyringText = buildKeyringText(archiveBooks, settings.activeRouterKeys);
                    activeDungeonContext = dungeonRealityEnabled
                        ? resolveActiveDungeonContext(archiveBooks, prefix, currentHierarchy)
                        : null;
                    activeDungeonEntryId = activeDungeonContext?.entryId || '';
                    updateActiveEntries();
                } else if (toolName === 'grep_lore') {
                    const hits = grepLoreInBooks(archiveBooks, args.query);
                    observation = hits.length > 0 ? hits.join('\n') : `No entries found for "${args.query}".`;
                } else if (toolName === 'inspect_book') {
                    const bookName = args.book_name || '';
                    if (isSkeletonBookName(bookName)) {
                        observation = 'World Skeleton lorebooks are not accessible to the Lorebook Agent.';
                    } else if (archiveBooks[bookName]) {
                        observation = Object.entries(archiveBooks[bookName].entries)
                            .map(([uid, e]) => `${bookName}::${uid} -- ${e.comment || e.key?.[0] || uid}`)
                            .join('\n');
                    } else {
                        observation = `Book "${bookName}" not found. Available: ${Object.keys(archiveBooks).join(', ') || 'none'}`;
                    }
                } else if (toolName === 'read_entry') {
                    const uid = args.uid || '';
                    if (isSkeletonEntryId(uid)) {
                        observation = 'World Skeleton entries are not accessible to the Lorebook Agent.';
                    } else {
                        const [bookName, id] = uid.split('::');
                        const book = await ctx.loadWorldInfo(bookName);
                        observation = book?.entries?.[id] ? book.entries[id].content : `Entry "${uid}" not found.`;
                    }
                } else {
                    observation = `Unknown tool: ${toolName}`;
                }

                broadcastStep('result', observation.substring(0, 200) + (observation.length > 200 ? '...' : ''));

                // Append the tool result so the model sees it on the next turn
                messages.push({
                    role: 'tool',
                    tool_call_id: messages[messages.length - 1].tool_calls[0].id,
                    content: observation
                });

                if (effectiveArgumentError || (toolName === 'commit' && !commitAccepted)) {
                    if (retryRejectedJson) {
                        broadcastStep('thought', `Invalid JSON, nudging model (retry ${jsonCorrectionRetries}/${MAX_JSON_CORRECTION_RETRIES})...`);
                        continue;
                    }
                    terminalCommitRejection = 'Lorebook Agent correction limit reached. The rejected action wrote nothing.';
                    break;
                }
                // A validated commit ends the research pass. Rejected commits do not.
                if (toolName === 'commit' && commitAccepted) break;
            }
            if (terminalCommitRejection) throw new Error(terminalCommitRejection);
        } // end agent mode

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        const finishMsg = basicSummaryText ? `Finished in ${totalTime}s -- ${basicSummaryText}` : `Finished in ${totalTime}s`;
        broadcastStep('finish', finishMsg, { time: totalTime, turns });

        // Advance the "since last run" watermark only when this pass actually used that lookback mode.
        // Aborted/errored passes never reach here (they go to catch), so the watermark is safe.
        const usedSinceLastRun = !overrideChatLog && customLookback === null && settings.routerLookbackSinceLastRun !== false;
        if (!isManual && manualPrompt !== '__CLEANUP__' && usedSinceLastRun) {
            persistRouterLastRunWatermark(ctx.chat.length);
        }

        // Stamp the triggering AI message only after a successful pass so swipe-rollback
        // can match this run to routerHistory and rewind the watermark if the user swipes
        // away from the generation that triggered the agent.
        if (manualPrompt !== '__CLEANUP__' && _routerTriggerMsg && _routerSnapshotRunId) {
            const postWm = ctx.chat.length;
            _routerTriggerMsg.extra = _routerTriggerMsg.extra || {};
            _routerTriggerMsg.extra.rpgRouterRunId = _routerSnapshotRunId;
            _routerTriggerMsg.extra.rpgRouterRanForSwipe = _routerTriggerMsg.swipe_id ?? 0;
            _routerTriggerMsg.extra.rpgRouterPrePassWatermark = _routerPrePassWatermark;
            _routerTriggerMsg.extra.rpgRouterPostPassWatermark = postWm;
            if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
            recordSchedulerEvent('la_pass_stamped_message', {
                runId: _routerSnapshotRunId,
                swipeId: _routerTriggerMsg.swipe_id ?? 0,
                preWm: _routerPrePassWatermark,
                postWm,
                isManual,
            });
        }

        // "Last ran at" display timestamp — updates for any completed pass (manual or auto).
        // Cleanup passes never reach this line (they return earlier), so no extra guard is needed.
        persistRouterLastRunTimestamp();

        // Record the exact book-level delta while the pass is still the newest action.
        // Rollback can then remove only books proven to have been created by this pass.
        await finalizeRouterHistorySnapshot(_routerSnapshotRunId);

        // Manual passes don't go through onGenerationEnded's throttle reset — treat like an auto run.
        if (typeof globalThis._rpgResetRouterAutoTick === 'function') {
            globalThis._rpgResetRouterAutoTick('lore_agent_pass_complete');
        }
        document.dispatchEvent(new CustomEvent('rt_generation_tick'));
        recordSchedulerEvent('la_pass_complete', {
            runId: _routerSnapshotRunId,
            isManual,
            usedSinceLastRun,
            chatLength: ctx.chat.length,
            watermark: settings.routerLastRunChatLength ?? 0,
        });

        // Non-blocking bloat hint and auto-cleanup check
        {
            const CLEANUP_TOKEN_THRESHOLD = settings.routerCleanupTokenThreshold || 300;
            const bloatedCount = Object.values(archiveBooks)
                .flatMap(b => Object.values(b.entries || {}))
                .filter(e => estimateTokens(stripDungeonMapSection(e.content)) >= CLEANUP_TOKEN_THRESHOLD).length;

            _routerNormalRunCount++;
            const cleanupEvery = settings.routerCleanupEvery || 0;
            const shouldAutoCleanup = cleanupEvery > 0 && (_routerNormalRunCount % cleanupEvery === 0) && bloatedCount > 0;

            if (shouldAutoCleanup) {
                broadcastStep('thought', `🧹 Auto-cleanup: ${bloatedCount} bloated entr${bloatedCount > 1 ? 'ies' : 'y'} found. Scheduling cleanup pass...`);
                // Queue non-blockingly so the current pass finishes cleanly first
                setTimeout(() => runRouterPass(null, '__CLEANUP__', null, true), 200);
            } else if (bloatedCount > 0) {
                broadcastStep('thought', `💡 ${bloatedCount} entr${bloatedCount > 1 ? 'ies' : 'y'} may benefit from cleanup (>${CLEANUP_TOKEN_THRESHOLD} tokens). Use the 🧹 button to compress.`);
            }
        }

        return true;
    } catch (e) {
        if (e?.name === 'AbortError') {
            console.log('[Lorebook Agent] Pass aborted by user.');
            broadcastStep('error', 'Stopped by user.');
        } else {
            console.error("[Lorebook Agent] Run failed:", e);
            broadcastStep('error', e.message);
        }
        return false;
    } finally {
        _routerRunning = false;
        _routerController = null;
    }
}

/**
 * Applies the agent's final decision to settings and lorebooks.
 * @param {object} action - The action to apply.
 * @param {object} allBooks - The cached archive books for verification.
 * @param {string} [currentTime=''] - The current time string for timestamping.
 * @param {string} [breadcrumb=''] - The current location hierarchy string (Main :: Sub).
 * @returns {Promise<{success: boolean, errors: string[], recordedIds: string[]}>}
 */
async function applyAction(action, allBooks = {}, currentTime = '', breadcrumb = '', isManual = false) {
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    let changed = false;
    const errors = [];
    const allBookNames = Object.keys(allBooks);
    const TIMESTAMP_REGEX = /(?:\[Day\s+\d+|\[\d{1,2}\/\d{1,2}\/\d+)\b/i;
    const linkedPc = getLinkedPlayerCharacter();
    const linkedPcName = linkedPc?.name || '';

    const timePrefix = currentTime ? `[${currentTime}] ` : '';

    // 1. Activate/Deactivate
    const activate = action.activate || [];
    const deactivate = action.deactivate || [];
    let newActive = [...(settings.activeRouterKeys || [])];
    let newWorldActive = [...(settings.activeWorldKeys || [])];
    const pinnedSet = new Set(settings.pinnedRouterKeys || []);
    
    // Remove deactivations — pinned entries are immune (silent no-op)
    newActive = newActive.filter(k => !deactivate.includes(k) || pinnedSet.has(k));
    newWorldActive = newWorldActive.filter(k => !deactivate.includes(k) || pinnedSet.has(k));
    
    // Add activations
    for (const k of activate) {
        if (typeof k !== 'string' || !k.includes('::')) {
            errors.push(`Invalid ID format: ${k}`);
            continue;
        }
        if (isSkeletonEntryId(k)) {
            errors.push(`Cannot activate World Skeleton entry (hidden from Lorebook Agent): ${k}`);
            continue;
        }
        const [bookName, uid] = k.split('::');
        const exists = allBooks[bookName]?.entries?.[uid];
        
        if (exists) {
            const isWorld = bookName.toLowerCase().endsWith('_world') || bookName.toLowerCase() === 'world';
            if (isWorld) {
                if (!newWorldActive.includes(k)) {
                    newWorldActive.push(k);
                    changed = true;
                }
            } else {
                if (!newActive.includes(k)) {
                    newActive.push(k);
                    changed = true;
                }
            }
        } else {
            errors.push(`Entity not found: ${k}`);
        }
    }
    if (deactivate.length > 0) changed = true;

    // World books do not use physical activation on disk anymore.

    // Sync keywordActivatedKeys: agent ownership trumps keyword-auto tracking.
    // - Explicitly activated: agent owns it now, no longer auto-expires.
    // - Explicitly deactivated: remove from both pools.
    if ((activate.length > 0 || deactivate.length > 0) && Array.isArray(settings.keywordActivatedKeys)) {
        const activateSet = new Set(activate);
        const deactivateSet = new Set(deactivate);
        settings.keywordActivatedKeys = settings.keywordActivatedKeys.filter(k =>
            !activateSet.has(k) && !deactivateSet.has(k)
        );
    }

    // 2. Update existing
    const updates = action.update || [];
    for (const up of updates) {
        if (!up || typeof up !== 'object') continue;
        if (typeof up.id !== 'string' || !up.id.includes('::')) {
            errors.push(`Invalid update ID format: ${up ? up.id : 'undefined'}`);
            continue;
        }
        if (isSkeletonEntryId(up.id)) {
            errors.push(`Cannot update World Skeleton entry: ${up.id}`);
            continue;
        }
        const [bookName, uid] = up.id.split('::');
        const book = await ctx.loadWorldInfo(bookName);
        if (book?.entries?.[uid]) {
            // Strip [ID:] stamp from anywhere in the delta (model sometimes echoes it)
            let delta = (up.content || '').replace(/\[ID:[^\]]+\]\n?/gi, '').trim();
            delta = sanitizeLorebookRecordContent(delta);
            // Ensure each [Day X,...] or [DD/MM/YY,...] timestamp begins on its own line
            delta = delta.replace(/(.)\s+(\[(?:Day\s+\d+|\d{1,2}\/\d{1,2}\/\d+))/gi, '$1\n$2');
            // Append delta to the existing chronicle
            const existing = (book.entries[uid].content || '').replace(/^\[ID:[^\]]+\]\n?/i, '').trimEnd();
            delta = deduplicateContent(existing, delta);
            if (delta && timePrefix && !TIMESTAMP_REGEX.test(delta)) {
                delta = timePrefix.trim() + ' ' + delta;
            }
            book.entries[uid].content = existing && delta ? `${existing}\n${delta}` : (existing || delta);
            await ctx.saveWorldInfo(bookName, book);
            changed = true;
        }
    }

    // 2b. Rewrite (full content replacement — no append, no dedup)
    const rewriteIds = [];
    for (const rw of (action.rewrite || [])) {
        if (!rw || typeof rw !== 'object') continue;
        if (typeof rw.id !== 'string' || !rw.id.includes('::')) {
            errors.push(`Invalid rewrite ID format: ${rw ? rw.id : 'undefined'}`);
            continue;
        }
        if (isSkeletonEntryId(rw.id)) {
            errors.push(`Cannot rewrite World Skeleton entry: ${rw.id}`);
            continue;
        }
        const [bookName, uid] = rw.id.split('::');
        const book = await ctx.loadWorldInfo(bookName);
        if (book?.entries?.[uid]) {
            const originalContent = book.entries[uid].content || '';
            book.entries[uid].content = protectCoreBlock(originalContent, rw.content);
            await ctx.saveWorldInfo(bookName, book);
            rewriteIds.push(rw.id);
            changed = true;
        } else {
            errors.push(`Rewrite target not found: ${rw.id}`);
        }
    }

    // 2c. Rename (label and/or keyword list update — no content change)
    const renameIds = [];
    for (const rn of (action.rename || [])) {
        if (!rn || typeof rn !== 'object') continue;
        if (typeof rn.id !== 'string' || !rn.id.includes('::')) {
            errors.push(`Invalid rename ID format: ${rn ? rn.id : 'undefined'}`);
            continue;
        }
        if (isSkeletonEntryId(rn.id)) {
            errors.push(`Cannot rename World Skeleton entry: ${rn.id}`);
            continue;
        }
        const [bookName, uid] = rn.id.split('::');
        const book = await ctx.loadWorldInfo(bookName);
        if (book?.entries?.[uid]) {
            const oldLabel = book.entries[uid].comment || '';
            if (rn.label !== undefined) book.entries[uid].comment = rn.label;
            if (rn.keys  !== undefined) book.entries[uid].key = cleanKeys(rn.keys);
            await ctx.saveWorldInfo(bookName, book);
            if (rn.label !== undefined && oldLabel && rn.label !== oldLabel) {
                // Dynamic import avoids a static cycle (index → router → portraits → index).
                const { renamePortraitEntity } = await import('./portraits.js');
                await renamePortraitEntity(oldLabel, rn.label);
            }
            renameIds.push(rn.id);
            changed = true;
        } else {
            errors.push(`Rename target not found: ${rn.id}`);
        }
    }

    // 2d. Consolidate (many-to-one merge with deletion)
    const consolidateIds = [];
    for (const op of (action.consolidate || [])) {
        if (!op || typeof op !== 'object') continue;
        if (typeof op.survivor !== 'string' || !op.survivor.includes('::')) {
            errors.push(`Invalid survivor ID format: ${op ? op.survivor : 'undefined'}`);
            continue;
        }
        if (isSkeletonEntryId(op.survivor) || (op.targets || []).some(isSkeletonEntryId)) {
            errors.push('Cannot consolidate World Skeleton entries.');
            continue;
        }
        // Update the survivor with merged content
        const [sBook, sUid] = op.survivor.split('::');
        const sBookData = await ctx.loadWorldInfo(sBook);
        if (sBookData?.entries?.[sUid]) {
            const originalContent = sBookData.entries[sUid].content || '';
            sBookData.entries[sUid].content = protectCoreBlock(originalContent, op.content);
            await ctx.saveWorldInfo(sBook, sBookData);
            consolidateIds.push(op.survivor);
        } else {
            errors.push(`Consolidate survivor not found: ${op.survivor}`);
            continue;
        }

        // Delete each target and scrub from active/keyword key lists
        for (const targetId of (op.targets || [])) {
            if (targetId === op.survivor) continue; // Do not delete the survivor entry!
            if (typeof targetId !== 'string' || !targetId.includes('::')) continue;
            const [tBook, tUid] = targetId.split('::');
            const tBookData = await ctx.loadWorldInfo(tBook);
            if (tBookData?.entries?.[tUid]) {
                delete tBookData.entries[tUid];
                await ctx.saveWorldInfo(tBook, tBookData);
            } else {
                errors.push(`Consolidate target not found: ${targetId}`);
            }
            settings.activeRouterKeys = (settings.activeRouterKeys || [])
                .filter(k => k !== targetId);
            settings.activeWorldKeys = (settings.activeWorldKeys || [])
                .filter(k => k !== targetId);
            settings.pinnedRouterKeys = (settings.pinnedRouterKeys || [])
                .filter(k => k !== targetId);
            newActive = newActive.filter(k => k !== targetId);
            newWorldActive = newWorldActive.filter(k => k !== targetId);
            if (Array.isArray(settings.keywordActivatedKeys)) {
                settings.keywordActivatedKeys = settings.keywordActivatedKeys
                    .filter(k => k !== targetId);
            }
        }
        changed = true;
    }

    // 3. Record new (with Deduplication)
    const newlyCreatedMap = {};
    // Group entries by target book and commit once per book to avoid UID collisions
    const records = action.record || [];
    const prefix = getLivePrefix();
    const recordedIds = [];

    // -- Phase A: Route each record to its target book --
    const writableCategoryMap = buildRouterCategoryMap(settings);
    // WORLD is an internal World Progression target, not an implicit Agent category.
    const catMap = { ...writableCategoryMap, WORLD: 'World' };
    /** @type {Map<string, Array>} */
    const bookQueue = new Map();

    const knownBookNames = Object.keys(allBooks);
    const knownCatTags = Object.keys(catMap);
    const writableCatTags = Object.keys(writableCategoryMap);
    const unambiguousFallbackTag = writableCatTags.length === 1 ? writableCatTags[0] : null;
    for (const rec of records) {
        const resolved = resolveRecordCategoryTag(rec, knownCatTags, unambiguousFallbackTag);
        if (!resolved.tag) {
            const who = rec.label || '(untitled)';
            const expected = writableCatTags.length ? writableCatTags.join('|') : '(no record categories enabled)';
            errors.push(`Skipped record "${who}": missing or unrecognized category. Expected ${expected}. Re-commit with "category" set.`);
            continue;
        }
        if (resolved.inferred) {
            rec.category = resolved.tag;
        }
        const cat = resolved.tag;
        const catName = cat;
        const idealTargetBook = prefix ? `${prefix}_${catMap[catName]}` : catMap[catName];
        
        let targetBook = idealTargetBook;
        const idealLower = idealTargetBook.toLowerCase();
        for (const known of knownBookNames) {
            if (known.toLowerCase() === idealLower) {
                targetBook = known;
                break;
            }
        }
        if (isSkeletonBookName(targetBook)) {
            errors.push(`Cannot record to World Skeleton lorebook: ${targetBook}`);
            continue;
        }

        // Strip any accidental "TAG: " prefix the model may have included in the label
        // e.g. "FAC: Iron Syndicate" ? "Iron Syndicate", "STATS: Thalric Thorne" ? "Thalric Thorne"
        if (rec.label) {
            rec.label = rec.label.replace(/^[A-Z_]{2,10}:\s+/i, '').trim();
        }

        // Breadcrumb enrichment is intentionally omitted: the model is instructed in the system
        // prompt to include the full hierarchy in the label itself (e.g. "Khelt :: Section 4").
        // Auto-prepending the current breadcrumb causes corruption when recording parent/sibling
        // locations that are not children of the current scene.

        const isWorld = targetBook.toLowerCase().endsWith('_world') || targetBook.toLowerCase() === 'world';

        if (cat.includes('EVENT')) {
            if (currentTime && !TIMESTAMP_REGEX.test(rec.label)) {
                rec.label = `[${currentTime}] ${rec.label}`;
            }
        }

        if (isWorld) {
            if (rec.label && !TIMESTAMP_REGEX.test(rec.content) && !rec.content.startsWith('[')) {
                rec.content = `[${rec.label}] ` + rec.content;
            }
            rec.keys = [];
        } else {
            rec.content = sanitizeLorebookRecordContent(rec.content || '');
            // Add location hierarchy keywords (plain fragments, no 'In:' prefix)
            // Matches status footer tokens for native ST keyword triggering.
            {
                const parts = (breadcrumb || '').split(' :: ').filter(Boolean);
                rec.keys = rec.keys || [];
                for (const part of parts) {
                    if (!rec.keys.includes(part)) rec.keys.push(part);
                }
            }
            rec.keys = cleanKeys(rec.keys || []);
        }

        if (!bookQueue.has(targetBook)) bookQueue.set(targetBook, []);
        bookQueue.get(targetBook).push(rec);
    }


    // -- Phase B: For each book, load existing entries, append new ones, save to disk via HTTP API --
    /** @type {Set<string>} books written this pass that need activation */
    const booksWritten = new Set();
    for (const [targetBook, recs] of bookQueue.entries()) {
        if (settings.debugMode) console.log(`[RPG Tracker] Writing ${recs.length} entries to: ${targetBook}`);

        // Attempt to load existing book directly from backend (prevents wiping un-cached books)
        let bookData = null;
        try {
            bookData = await ctx.loadWorldInfo(targetBook);
        } catch (_) { }

        if (!bookData) {
            try {
                const res = await fetch('/api/worldinfo/get', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ name: targetBook })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data === 'object' && data.entries) {
                        bookData = data;
                    }
                }
            } catch (_) {}
        }

        if (!bookData) {
            bookData = { entries: {}, name: targetBook, scan_depth: 4, token_budget: 400, recursive: false, extensions: {} };
        }

        for (const rec of recs) {
            // Deduplication: skip if an entry with this label already exists
            const cleanLabel = (rec.label || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
            let existingUid = null;
            for (const [uid, entry] of Object.entries(bookData.entries)) {
                const entryLabel = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
                if (entryLabel === cleanLabel) { existingUid = uid; break; }
            }

            const isWorldBook = targetBook.toLowerCase().endsWith('_world') || targetBook.toLowerCase() === 'world';
            if (existingUid) {
                const fullId = `${targetBook}::${existingUid}`;
                // Strip [ID:] stamp from anywhere in the delta (model sometimes echoes it)
                let delta = (rec.content || '').replace(/\[ID:[^\]]+\]\n?/gi, '').trim();
                
                if (isWorldBook) {
                    // Overwrite instead of appending for World Progression reports
                    bookData.entries[existingUid].content = delta;
                    bookData.entries[existingUid].key = [];
                    bookData.entries[existingUid].constant = false;
                    bookData.entries[existingUid].disable = true;
                } else {
                    // Append delta to existing chronicle (dedup path)
                    let existing = (bookData.entries[existingUid].content || '').replace(/^\[ID:[^\]]+\]\n?/i, '').trimEnd();

                    // Safety net: the model sometimes re-records an entity that already has a
                    // [CORE] block instead of using UPDATE_CORE/commit core. Blindly appending
                    // would leave two [CORE]...[/CORE] blocks in the same entry. If the new
                    // delta ALSO contains a full [CORE] block, replace the old one in place
                    // (last write wins) rather than duplicating it, and only append whatever
                    // chronicle text (if any) remains outside that block.
                    const newCoreMatch = delta.match(/\[CORE\]([\s\S]*?)\[\/CORE\]/i);
                    const existingHasCore = /\[CORE\][\s\S]*?\[\/CORE\]/i.test(existing);
                    if (newCoreMatch && existingHasCore) {
                        const oldCoreMatch = existing.match(/\[CORE\]([\s\S]*?)\[\/CORE\]/i);
                        const newCoreInner = newCoreMatch[1];
                        const oldCoreInner = oldCoreMatch ? oldCoreMatch[1] : '';
                        let extraHeaders = [];
                        try {
                            const coreSecs = (settings.npcCoreSections && Array.isArray(settings.npcCoreSections) && settings.npcCoreSections.length > 0)
                                ? settings.npcCoreSections
                                : DEFAULT_NPC_SECTIONS;
                            extraHeaders = coreSecs.map(sec => sec.name).filter(Boolean);
                        } catch (_) {}
                        const mergedInner = mergePreservedColorMarkup(oldCoreInner, newCoreInner, { extraHeaders });
                        existing = existing.replace(/\[CORE\][\s\S]*?\[\/CORE\]/i, `[CORE]${mergedInner}[/CORE]`);
                        delta = delta.replace(newCoreMatch[0], '').trim();
                        if (settings.debugMode) console.warn(`[RPG Tracker] Record targeted existing entry "${rec.label}" with a full [CORE] block — replaced in place instead of duplicating (agent should have used UPDATE_CORE/commit core).`);
                    }

                    // Ensure each [Day X,...] or [DD/MM/YY,...] timestamp begins on its own line
                    delta = delta.replace(/(.)\s+(\[(?:Day\s+\d+|\d{1,2}\/\d{1,2}\/\d+))/gi, '$1\n$2');
                    delta = deduplicateContent(existing, delta);
                    bookData.entries[existingUid].content = existing && delta ? `${existing}\n${delta}` : (existing || delta);

                    const keys = bookData.entries[existingUid].key || [];
                    (rec.keys || []).forEach(k => { if (!keys.includes(k)) keys.push(k); });
                    bookData.entries[existingUid].key = cleanKeys(keys);
                }

                // Update comment/title to the latest label (keeps event timestamps up-to-date)
                if (rec.label) {
                    bookData.entries[existingUid].comment = rec.label;
                }
                
                if (isWorldBook) {
                    if (!newWorldActive.includes(fullId)) newWorldActive.push(fullId);
                } else {
                    if (!newActive.includes(fullId)) newActive.push(fullId);
                }
                recordedIds.push(`${fullId} (updated)`);
                newlyCreatedMap[rec.label.toLowerCase().trim()] = fullId;
            } else {
                // Append new entry with the next sequential UID
                const uids = Object.keys(bookData.entries).map(Number).filter(n => !isNaN(n));
                const nextUid = uids.length > 0 ? Math.max(...uids) + 1 : 0;
                const fullId = `${targetBook}::${nextUid}`;
                bookData.entries[nextUid] = {
                    uid: nextUid,
                    key: isWorldBook ? [] : (rec.keys || [rec.label]),
                    keysecondary: [],
                    comment: rec.label || 'LORE_GEN',
                    content: rec.content || '',
                    constant: false,
                    selective: false, selectiveLogic: 0, addMemo: true,
                    order: settings.routerDefaultOrder ?? 100,
                    position: settings.routerDefaultPosition ?? 0,
                    disable: isWorldBook ? true : !settings.routerNativeKeywordActivation,
                    probability: 100, useProbability: false,
                    depth: settings.routerDefaultDepth ?? 4,
                    role: (settings.routerDefaultPosition === 4) ? (settings.routerDefaultRole ?? 0) : null,
                    group: '', groupOverride: false, groupWeight: 100,
                };
                if (isWorldBook) {
                    if (!newWorldActive.includes(fullId)) newWorldActive.push(fullId);
                } else {
                    if (!newActive.includes(fullId)) newActive.push(fullId);
                }
                recordedIds.push(fullId);
                newlyCreatedMap[rec.label.toLowerCase().trim()] = fullId;
            }
            changed = true;
        }

        // Always use the raw HTTP API to guarantee disk persistence.
        // ctx.saveWorldInfo only flushes books already in ST's in-memory registry,
        // silently dropping any new (unregistered) books. The /api/worldinfo/edit
        // endpoint writes directly to disk with no registry requirement.
        const saveRes = await fetch('/api/worldinfo/edit', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name: targetBook, data: bookData })
        });
        if (!saveRes.ok) {
            console.error(`[RPG Tracker] Failed to save ${targetBook}: HTTP ${saveRes.status}`);
        } else {
            if (settings.debugMode) console.log(`[RPG Tracker] Saved ${recs.length} entries to ${targetBook}`);
            // Cache bust: write bookData into ST's in-memory registry so that the
            // subsequent renderRouterUI -> loadWorldInfo call sees fresh entries immediately
            // (the raw HTTP API bypasses the in-memory cache; this syncs them up).
            if (typeof ctx.saveWorldInfo === 'function') {
                try { await ctx.saveWorldInfo(targetBook, bookData); } catch (_) { /* non-fatal */ }
            }
            booksWritten.add(targetBook);
        }
    }

    // Bulk-activate all written books after all disk writes are done.
    // Re-index only if this pass actually created a new book. Re-indexing an
    // already-known book downloads the complete settings payload for no benefit.
    if (booksWritten.size > 0 && typeof ctx.executeSlashCommandsWithOptions === 'function') {
        const knownBefore = new Set(allBookNames.map(name => String(name || '').toLowerCase()));
        const createdNewBook = [...booksWritten].some(name => !knownBefore.has(String(name || '').toLowerCase()));
        if (createdNewBook && typeof ctx.updateWorldInfoList === 'function') {
            await ctx.updateWorldInfoList();
        }
        for (const bookName of booksWritten) {
            await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${bookName}"`);
        }
        if (settings.debugMode) console.log(`[RPG Tracker] Activated books: ${[...booksWritten].join(', ')}`);
    }

    // Budget enforcement is handled by the agent via overflow instruction in context.
    // No FIFO pruning here — the agent must explicitly deactivate entries.
    settings.activeRouterKeys = newActive;
    settings.activeWorldKeys = newWorldActive;

    // 4. Delete
    const deleteIds = action.delete_ids || [];
    for (const id of deleteIds) {
        if (isSkeletonEntryId(id)) {
            errors.push(`Cannot delete World Skeleton entry: ${id}`);
            continue;
        }
        const parts = id.split('::');
        if (parts.length < 2) continue;
        const [bookName, uid] = parts;
        const book = await ctx.loadWorldInfo(bookName);
        if (book?.entries?.[uid]) {
            delete book.entries[uid];
            await ctx.saveWorldInfo(bookName, book);
            // Also remove from active keys if present
            settings.activeRouterKeys = settings.activeRouterKeys.filter(k => k !== id);
            settings.activeWorldKeys = (settings.activeWorldKeys || []).filter(k => k !== id);
            settings.pinnedRouterKeys = (settings.pinnedRouterKeys || []).filter(k => k !== id);
            changed = true;
        }
    }

    if (changed) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        settings.routerLog.unshift({
            time: timestamp,
            activate: activate,
            deactivate: deactivate,
            record: recordedIds,
            delete: deleteIds,
            rewrite: rewriteIds,
            consolidate: consolidateIds,
            rename: renameIds,
            reason: action.reason || (settings.routerBasicMode ? "Tag-based update." : "Agent tool update.")
        });
        if (settings.routerLog.length > 50) settings.routerLog.length = 50;

        // Track campaign lorebooks per chat_id so they auto-activate on chat switch
        if (booksWritten.size > 0) {
            const chatId = typeof globalThis._rpgCurrentChatId === 'function'
                ? globalThis._rpgCurrentChatId()
                : null;
            if (chatId) {
                if (!settings.chatStates) settings.chatStates = {};
                if (!settings.chatStates[chatId]) settings.chatStates[chatId] = {};
                const existing = new Set(settings.chatStates[chatId].campaignBooks || []);
                for (const b of booksWritten) existing.add(b);
                settings.chatStates[chatId].campaignBooks = [...existing];
            }
        }

        void saveSettings();
        document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));
    }

    // 5. Relationship deltas
    // Track a rollback record on the last AI message for each applied delta, mirroring
    // parseAndApplyNarrativeRelTags() in narrative-hooks.js. Without this, swipe rollback
    // only undoes inline "(Friendship: Name +X)" narrative tags — Lorebook Agent-driven
    // [[REL: ...]] deltas would silently survive a swipe since they're never recorded.
    const relChat = ctx.chat;
    const relLastAiMsg = relChat ? [...relChat].reverse().find(m => !m.is_user && !m.is_system) : null;
    let relSwipeId = 0;
    if (relLastAiMsg) {
        relLastAiMsg.extra = relLastAiMsg.extra || {};
        relSwipeId = relLastAiMsg.swipe_id ?? 0;
        relLastAiMsg.extra.rpgRollbackData = relLastAiMsg.extra.rpgRollbackData || {};
        relLastAiMsg.extra.rpgRollbackData[relSwipeId] = relLastAiMsg.extra.rpgRollbackData[relSwipeId] || [];
    }
    for (const item of (action.rel || [])) {
        const { id, field, delta } = item;
        if (!id || !field || typeof delta !== 'number') {
            errors.push(`Invalid rel item: ${JSON.stringify(item)}`);
            continue;
        }
        if (isSkeletonEntryId(id)) {
            errors.push(`Cannot update relationship on World Skeleton entry: ${id}`);
            continue;
        }
        const f = field.toLowerCase();
        if (f !== 'friendship' && f !== 'affection') {
            errors.push(`Unknown relationship field "${field}" for ${id}`);
            continue;
        }

        let resolvedId = id;
        if (!resolvedId.includes('::')) {
            const cleanId = resolvedId.toLowerCase().trim();
            if (newlyCreatedMap[cleanId]) {
                resolvedId = newlyCreatedMap[cleanId];
            } else {
                const prefix = getLivePrefix();
                const npcBookName = prefix ? `${prefix}_NPCs` : 'NPCs';
                let npcBook = null;
                try {
                    npcBook = await ctx.loadWorldInfo(npcBookName);
                } catch (_) {}
                
                let foundUid = null;
                if (npcBook && npcBook.entries) {
                    for (const [uid, entry] of Object.entries(npcBook.entries)) {
                        const label = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
                        if (label === cleanId) {
                            foundUid = uid;
                            break;
                        }
                    }
                }
                if (foundUid !== null) {
                    resolvedId = `${npcBookName}::${foundUid}`;
                } else {
                    let fallbackFound = null;
                    for (const [bookName, bookData] of Object.entries(allBooks)) {
                        if (!bookData || !bookData.entries) continue;
                        for (const [uid, entry] of Object.entries(bookData.entries)) {
                            const label = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
                            if (label === cleanId) {
                                fallbackFound = `${bookName}::${uid}`;
                                break;
                            }
                        }
                        if (fallbackFound) break;
                    }
                    if (fallbackFound) {
                        resolvedId = fallbackFound;
                    } else {
                        errors.push(`Could not resolve NPC name "${id}" to a Book::UID`);
                        continue;
                    }
                }
            }
        }

        if (!settings.npcRelationshipValues) settings.npcRelationshipValues = {};
        if (!settings.npcRelationshipValues[resolvedId]) settings.npcRelationshipValues[resolvedId] = { friendship: 0, affection: 0 };
        const current = settings.npcRelationshipValues[resolvedId][f] ?? 0;
        const relMax = getNpcRelationshipMax(settings);
        const newValue = clampRelationshipValue(current + delta, relMax);
        settings.npcRelationshipValues[resolvedId][f] = newValue;
        // Append to relationship change log (capped at 50 entries per NPC)
        if (!settings.npcRelationshipLog) settings.npcRelationshipLog = {};
        if (!settings.npcRelationshipLog[resolvedId]) settings.npcRelationshipLog[resolvedId] = [];
        const relLogTimestamp = Date.now();
        settings.npcRelationshipLog[resolvedId].unshift({ timestamp: relLogTimestamp, field: f, delta, newValue, source: 'agent' });
        if (settings.npcRelationshipLog[resolvedId].length > 50) settings.npcRelationshipLog[resolvedId].length = 50;
        changed = true;

        // Record rollback data so a swipe on this AI message can undo this delta (see comment above).
        if (relLastAiMsg) {
            relLastAiMsg.extra.rpgRollbackData[relSwipeId].push({
                npcId: resolvedId,
                field: f,
                actualAppliedDelta: newValue - current,
                expectedValue: newValue,
                logTimestamp: relLogTimestamp
            });
        }
    }

    // 6. Core identity updates — surgical replacement of specified fields inside [CORE]
    //    (or the linked Player Character card for Body/Equipment only).
    const coreUpdates = [
        ...(action.appearance || []).map(item => ({ id: item.id, field: 'Body', content: item.content })),
        ...(action.equipment || []).map(item => ({ id: item.id, field: 'Worn Equipment', content: item.content })),
        ...(action.core || [])
    ];

    for (const item of coreUpdates) {
        const { id, field, content: newContent } = item;
        if (!id || !field || !newContent) {
            errors.push(`Invalid core update item: ${JSON.stringify(item)}`);
            continue;
        }

        // PC sentinel — Body/Equipment only, patches chatStates[chatId].playerCharacter.bio
        if (isPcCoreTarget(id, linkedPcName)) {
            const pcResult = applyPcCoreUpdate(linkedPc, field, newContent);
            if (!pcResult.ok) {
                errors.push(`PC core update failed for "${id}": ${pcResult.error}`);
            } else {
                changed = true;
            }
            continue;
        }

        // Automatic passes may only mutate Combat Profile via commit.core / UPDATE_CORE.
        // Body/Equipment arrive via action.appearance/action.equipment (mapped above) and are always allowed.
        if (!isManual && !isAppearanceField(field) && !isEquipmentField(field) && !isCombatProfileField(field)) {
            errors.push(`Automatic pass rejected core update of "${field}" on "${id}" — only Combat Profile (and Body/Equipment via their dedicated tools) are allowed without a Direct Prompt.`);
            continue;
        }

        const resolvedId = await resolveLoreEntryId(id, allBooks, newlyCreatedMap);
        if (!resolvedId) {
            errors.push(`Could not resolve core update target "${id}" to a Book::UID`);
            continue;
        }
        if (isSkeletonEntryId(resolvedId)) {
            errors.push(`Cannot update core on World Skeleton entry: ${resolvedId}`);
            continue;
        }
        const [bookName, uid] = resolvedId.split('::');
        const book = await ctx.loadWorldInfo(bookName);
        if (!book?.entries?.[uid]) {
            errors.push(`Core update target not found: ${resolvedId}`);
            continue;
        }
        const entryContent = book.entries[uid].content || '';

        // Match the [CORE]...[/CORE] block
        const coreMatch = entryContent.match(/\[CORE\]([\s\S]*?)\[\/CORE\]/i);
        if (!coreMatch) {
            errors.push(`[CORE] block not found for ${id} — no update made.`);
            continue;
        }

        const coreBody = coreMatch[1];
        let extraHeaders = [];
        try {
            const s = getSettings();
            const coreSecs = (s.npcCoreSections && Array.isArray(s.npcCoreSections) && s.npcCoreSections.length > 0) ? s.npcCoreSections : DEFAULT_NPC_SECTIONS;
            extraHeaders = coreSecs.map(sec => sec.name).filter(Boolean);
        } catch (_) {}

        const patched = patchLabeledSection(coreBody, field, newContent, { extraHeaders });
        if (!patched.ok) {
            errors.push(`Core field patch failed for ${id}: ${patched.error || 'unknown error'}`);
            continue;
        }

        book.entries[uid].content = entryContent.replace(coreMatch[0], `[CORE]${patched.text}[/CORE]`);
        await ctx.saveWorldInfo(bookName, book);
        changed = true;
    }

    return { success: true, errors, recordedIds };
}

function restoreRouterLoreMetadata(settings, snapshot, removedBookNames = []) {
    const has = key => Object.prototype.hasOwnProperty.call(snapshot || {}, key);
    const restore = (key, fallback) => {
        if (has(key)) settings[key] = cloneRouterValue(snapshot[key], fallback);
    };

    restore('activeRouterKeys', []);
    restore('activeWorldKeys', []);
    restore('keywordActivatedKeys', []);
    restore('pinnedRouterKeys', []);
    restore('routerLog', []);
    if (has('pcCharacterBlockSeeded')) settings.pcCharacterBlockSeeded = !!snapshot.pcCharacterBlockSeeded;
    if (has('routerLastRunAt')) settings.routerLastRunAt = snapshot.routerLastRunAt ?? 0;

    const chatId = snapshot.chatId || getRouterChatId();
    if (chatId) {
        if (!settings.chatStates) settings.chatStates = {};
        if (!settings.chatStates[chatId]) settings.chatStates[chatId] = {};
        const chatState = settings.chatStates[chatId];
        const removed = new Set(removedBookNames);
        const priorOwnership = has('campaignBooks')
            ? cloneRouterValue(snapshot.campaignBooks, [])
            : getLorebookSnapshotNames(snapshot);
        chatState.campaignBooks = [...new Set([
            ...(chatState.campaignBooks || []).filter(name => !removed.has(name)),
            ...priorOwnership,
        ])];
    }
}

async function recoverRouterLoreState(recoveryState, attemptedState, originalHistory, settings, ctx) {
    if (!recoveryState) return;
    const prefix = recoveryState.campaignPrefix || attemptedState?.campaignPrefix || getLivePrefix();
    const recoveryNames = new Set(Object.keys(recoveryState.bookSnapshots || {}));

    // A failed restore may have recreated a book that did not exist in the state
    // being recovered. Only those attempted snapshot names are eligible for deletion.
    for (const name of Object.keys(attemptedState?.bookSnapshots || {})) {
        if (recoveryNames.has(name)) continue;
        if (!prefix || !bookBelongsToPrefix(name, prefix) || isSkeletonBookName(name)) continue;
        const currentNames = await getWorldInfoNamesSafe();
        if (currentNames.includes(name)) await deleteWorldInfoFresh(name);
    }

    for (const [name, book] of Object.entries(recoveryState.bookSnapshots || {})) {
        await saveWorldInfoSnapshot(name, book, ctx, 'Rollback recovery');
    }
    restoreRouterLoreMetadata(settings, recoveryState);
    const chatId = recoveryState.chatId || getRouterChatId(ctx);
    if (chatId && Object.prototype.hasOwnProperty.call(recoveryState, 'campaignBooks')) {
        if (!settings.chatStates) settings.chatStates = {};
        if (!settings.chatStates[chatId]) settings.chatStates[chatId] = {};
        settings.chatStates[chatId].campaignBooks = cloneRouterValue(recoveryState.campaignBooks, []);
    }
    settings.routerHistory = originalHistory;
    if (recoveryState.routerLastRunChatLength !== undefined) {
        settings.routerLastRunChatLength = recoveryState.routerLastRunChatLength;
    }
    if (typeof ctx.updateWorldInfoList === 'function') {
        try { await ctx.updateWorldInfoList(); } catch (_) {}
    }
    void saveSettings();
}

/**
 * Restores a past lorebook snapshot from routerHistory.
 * - Deletes any lorebook that was CREATED during the pass (wasn't in snapshot).
 * - Overwrites any lorebook that was MODIFIED during the pass back to its pre-pass content.
 * @param {number} index - 0 = most recent pre-pass snapshot.
 * @param {object|null} recoveryState - Optional caller-captured post-pass state.
 * @returns {Promise<boolean>}
 */
export async function rollbackRouterPass(index = 0, recoveryState = null) {
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const history = settings.routerHistory || [];

    if (index < 0 || index >= history.length) {
        console.warn('[RPG Tracker] Rollback: invalid index', index);
        return false;
    }

    const snapshot = history[index];
    if (!snapshot) return false;
    const activeChatId = getRouterChatId(ctx);
    const livePrefix = getLivePrefix();
    if (!isLoreHistoryEntryForChat(snapshot, { chatId: activeChatId, campaignPrefix: livePrefix })) {
        console.warn('[RPG Tracker] Rollback refused: history entry belongs to a different chat/campaign.', {
            entryChatId: snapshot.chatId ?? null,
            activeChatId,
            entryPrefix: snapshot.campaignPrefix || '',
            livePrefix,
        });
        return false;
    }
    let safeRecoveryState = recoveryState;

    try {
        const prefix = snapshot.campaignPrefix || livePrefix;

        // -- Step 1: Delete lorebooks proven to be CREATED during the pass ------
        // The stored campaign prefix and exact modern delta keep unrelated books
        // out of scope. Legacy snapshots use recorded entry IDs conservatively.
        const allCurrentNames = await getWorldInfoNamesSafe();
        const createdBookNames = prefix
            ? getCreatedLorebookNames({
                snapshot,
                currentNames: allCurrentNames,
                currentRouterLog: settings.routerLog || [],
                historyIndex: index,
                prefix,
            }).filter(name => !isSkeletonBookName(name))
            : [];
        if (!prefix && allCurrentNames.length) {
            console.warn('[RPG Tracker] Rollback: no campaign prefix; no lorebooks will be deleted.');
        }

        // Take a complete disk-backed recovery copy before the first mutation.
        safeRecoveryState = safeRecoveryState || await captureRouterLoreState();

        for (const bookName of createdBookNames) {
            await deleteWorldInfoFresh(bookName);
        }

        // Re-index so ST knows about deletions before we start restoring
        if (typeof ctx.updateWorldInfoList === 'function') {
            try { await ctx.updateWorldInfoList(); } catch (_) {}
        }

        // -- Step 2: Restore pre-pass lorebooks to their snapshotted state -----
        for (const [bookName, bookData] of Object.entries(snapshot.bookSnapshots || {})) {
            await evictWorldInfoCache(bookName);
            await saveWorldInfoSnapshot(bookName, bookData, ctx, 'Rollback');
        }

        // -- Step 3: Restore all Lorebook Agent-owned state --------------------
        if (!Object.prototype.hasOwnProperty.call(snapshot, 'routerLog') && createdBookNames.length > 0) {
            // Compatibility for pre-7.10.5 snapshots. Removing the pass log is
            // essential because old UI fast paths used it as a book-name fallback.
            settings.routerLog = (settings.routerLog || []).slice(Math.max(1, index + 1));
        }
        restoreRouterLoreMetadata(settings, snapshot, createdBookNames);

        // -- Step 4: Restore "since last run" watermark and trim history --------
        settings.routerHistory = trimLoreHistoryForRollback(history, index);
        if (snapshot.routerLastRunChatLength !== undefined) {
            persistRouterLastRunWatermark(snapshot.routerLastRunChatLength);
        } else {
            void saveSettings();
        }

        recordLiveDungeonMapSnapshot(settings, await captureActiveDungeonMapHistory(ctx));
        document.dispatchEvent(new CustomEvent('rt_lore_agent_updated', { detail: { source: 'rollback' } }));
        return true;
    } catch (e) {
        console.error('[RPG Tracker] Rollback failed:', e);
        try {
            await recoverRouterLoreState(safeRecoveryState, snapshot, [...history], settings, ctx);
        } catch (recoveryError) {
            console.error('[RPG Tracker] Rollback recovery also failed:', recoveryError);
        }
        return false;
    }
}

/**
 * Re-applies a previously undone agent pass (redo).
 * Pushes prePassSnapshot back onto routerHistory and restores lorebooks to postPassState.
 * @param {{ timestamp: string, activeRouterKeys: string[], bookSnapshots: Record<string, any> }} prePassSnapshot
 * @param {{ timestamp: string, activeRouterKeys: string[], bookSnapshots: Record<string, any> }} postPassState
 * @returns {Promise<boolean>}
 */
export async function reapplyRouterPass(prePassSnapshot, postPassState) {
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const originalHistory = [...(settings.routerHistory || [])];
    let safeRecoveryState = null;
    const activeChatId = getRouterChatId(ctx);
    const livePrefix = getLivePrefix();
    const redoEntry = { prePassSnapshot, postPassState };
    if (!isLoreRedoEntryForChat(redoEntry, { chatId: activeChatId, campaignPrefix: livePrefix })) {
        console.warn('[RPG Tracker] Redo refused: history entry belongs to a different chat/campaign.', {
            prePassChatId: prePassSnapshot?.chatId ?? null,
            postPassChatId: postPassState?.chatId ?? null,
            activeChatId,
            prePassPrefix: prePassSnapshot?.campaignPrefix || '',
            postPassPrefix: postPassState?.campaignPrefix || '',
            livePrefix,
        });
        return false;
    }

    try {
        safeRecoveryState = await captureRouterLoreState();
        // Step 1: Put the pre-pass snapshot back so the user can undo again
        if (!settings.routerHistory) settings.routerHistory = [];
        settings.routerHistory.unshift(prePassSnapshot);
        if (settings.routerHistory.length > 5) settings.routerHistory.length = 5;

        // Re-delete only books the original pass is known to have deleted.
        const prefix = postPassState.campaignPrefix || prePassSnapshot.campaignPrefix || livePrefix;
        const deletedBookNames = Array.isArray(prePassSnapshot.deletedBookNames)
            ? prePassSnapshot.deletedBookNames.filter(name => prefix && bookBelongsToPrefix(name, prefix) && !isSkeletonBookName(name))
            : [];
        const currentNames = new Set(await getWorldInfoNamesSafe());
        for (const bookName of deletedBookNames) {
            if (currentNames.has(bookName)) await deleteWorldInfoFresh(bookName);
        }

        // Step 2: Restore lorebooks to the post-pass state
        for (const [bookName, bookData] of Object.entries(postPassState.bookSnapshots || {})) {
            await evictWorldInfoCache(bookName);
            await saveWorldInfoSnapshot(bookName, bookData, ctx, 'Redo');
        }

        if (typeof ctx.updateWorldInfoList === 'function') {
            try { await ctx.updateWorldInfoList(); } catch (_) {}
        }

        // Step 3: Restore all Agent-owned metadata to the post-pass state.
        restoreRouterLoreMetadata(settings, postPassState, deletedBookNames);

        if (postPassState.routerLastRunChatLength !== undefined) {
            persistRouterLastRunWatermark(postPassState.routerLastRunChatLength);
        } else {
            void saveSettings();
        }

        recordLiveDungeonMapSnapshot(settings, await captureActiveDungeonMapHistory(ctx));
        document.dispatchEvent(new CustomEvent('rt_lore_agent_updated', { detail: { source: 'redo' } }));
        return true;
    } catch (e) {
        console.error('[RPG Tracker] Redo failed:', e);
        try {
            await recoverRouterLoreState(safeRecoveryState, postPassState, originalHistory, settings, ctx);
        } catch (recoveryError) {
            console.error('[RPG Tracker] Redo recovery also failed:', recoveryError);
        }
        return false;
    }
}


/**
 * Parses basic narrative tags [[TAG: ...]]
 */
function parseBasicTags(text, archiveBooks) {
    const action = { record: [], update: [], activate: [], deactivate: [], delete_ids: [], rewrite: [], consolidate: [], rel: [], appearance: [], equipment: [], core: [] };
    const settings = getSettings();

    // REWRITE tag parser
    const rewriteRegex = /\[\[REWRITE:\s*([^|]+)\|([\s\S]*?)\]\]/gi;
    let rw;
    while ((rw = rewriteRegex.exec(text)) !== null) {
        const id      = rw[1].trim();
        const content = rw[2].trim();
        action.rewrite.push({ id, content });
    }

    // CONSOLIDATE tag parser
    const consolidateRegex = /\[\[CONSOLIDATE:\s*([^|]+)\|([^|]+)\|([\s\S]*?)\]\]/gi;
    let cm;
    while ((cm = consolidateRegex.exec(text)) !== null) {
        const targets  = cm[1].split(',').map(s => s.trim()).filter(Boolean);
        const survivor = cm[2].trim();
        const content  = cm[3].trim();
        action.consolidate.push({ targets, survivor, content });
    }

    // REL tag parser: [[REL: Book::UID | Friendship | +15]]
    const relRegex = /\[\[REL:\s*([^|]+)\|\s*(friendship|affection)\s*\|\s*([+-]?\d+)\s*\]\]/gi;
    let rm;
    while ((rm = relRegex.exec(text)) !== null) {
        const id    = rm[1].trim();
        const field = rm[2].trim().toLowerCase();
        const delta = parseInt(rm[3], 10);
        if (id && field && !isNaN(delta)) {
            action.rel.push({ id, field, delta });
        }
    }

    // UPDATE_APPEARANCE tag parser: [[UPDATE_APPEARANCE: Book::UID | new appearance text]] (patches Body)
    const appearRegex = /\[\[UPDATE_APPEARANCE:\s*([^|]+)\|([\s\S]*?)\]\]/gi;
    let am;
    while ((am = appearRegex.exec(text)) !== null) {
        const id      = am[1].trim();
        const content = am[2].trim();
        if (id && content) {
            action.appearance.push({ id, content });
        }
    }

    // UPDATE_EQUIPMENT tag parser: [[UPDATE_EQUIPMENT: Book::UID | new worn gear text]] (patches Worn Equipment)
    const equipRegex = /\[\[UPDATE_EQUIPMENT:\s*([^|]+)\|([\s\S]*?)\]\]/gi;
    let eqm;
    while ((eqm = equipRegex.exec(text)) !== null) {
        const id      = eqm[1].trim();
        const content = eqm[2].trim();
        if (id && content) {
            action.equipment.push({ id, content });
        }
    }

    // UPDATE_CORE tag parser: [[UPDATE_CORE: Book::UID | field | new content]]
    const coreRegex = /\[\[UPDATE_CORE:\s*([^|]+)\|\s*([^|]+)\|\s*([\s\S]*?)\]\]/gi;
    let co;
    while ((co = coreRegex.exec(text)) !== null) {
        const id      = co[1].trim();
        const field   = co[2].trim();
        const content = co[3].trim();
        if (id && field && content) {
            action.core.push({ id, field, content });
        }
    }

    const processMatch = (name, content, keywords, category) => {
        name = name.trim().replace(/^[A-Z_]{2,10}:\s+/i, '').trim();
        content = content.trim();
        const keys = (keywords || '').split(',').map(k => k.trim());

        // Check for existing by name (stripping bracketed prefixes to match applyAction's matching logic)
        let existingId = null;
        const cleanName = name.replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
        for (const [bookName, book] of Object.entries(archiveBooks)) {
            for (const [uid, entry] of Object.entries(book.entries)) {
                const entryComment = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
                if (entryComment === cleanName) {
                    existingId = `${bookName}::${uid}`;
                    break;
                }
            }
            if (existingId) break;
        }

        if (existingId) {
            action.update.push({ id: existingId, content });
        } else {
            action.record.push({ label: name, content, keys, category });
        }
    };

    // Generic tag parser: [[TAG: ...]]
    const tagRegex = /\[\[(\w+):\s*([\s\S]*?)\]\]/gi;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
        const tagName = match[1].toUpperCase();
        if (tagName === 'REWRITE' || tagName === 'CONSOLIDATE' || tagName === 'REL' || tagName === 'UPDATE_APPEARANCE' || tagName === 'UPDATE_EQUIPMENT' || tagName === 'UPDATE_CORE') continue; // Collision protection

        const inner = match[2];
        const parts = inner.split('|').map(p => p.trim());

        if ((tagName === 'ACTIVATE' || tagName === 'DEACTIVATE' || tagName === 'DELETE') && parts.length >= 1) {
            const name = inner.trim().toLowerCase();
            let targetList = [];
            if (tagName === 'ACTIVATE') targetList = action.activate;
            else if (tagName === 'DEACTIVATE') targetList = action.deactivate;
            else if (tagName === 'DELETE') targetList = action.delete_ids;

            for (const [bookName, book] of Object.entries(archiveBooks)) {
                for (const [uid, entry] of Object.entries(book.entries)) {
                    if ((entry.comment || '').toLowerCase() === name) {
                        targetList.push(`${bookName}::${uid}`);
                        break;
                    }
                }
            }
        } else if (parts.length >= 3) {
            // Generic: first = name, last = keywords, everything in between = body (joined with blank line).
            // Supports any number of middle slots so renaming or adding slots in the UI works automatically.
            const name = parts[0];
            const keywords = parts[parts.length - 1];
            const body = parts.slice(1, -1).filter(Boolean).join('\n\n');
            processMatch(name, body, keywords, tagName);
        }
    }

    return action;
}

/**
 * Shared helper to add an entry to a specific lorebook.
 */
async function addLorebookEntry(lorebookName, entryData, allNames) {
    const ctx = SillyTavern.getContext();
    if (!allNames) allNames = await getWorldInfoNamesSafe();
    
    let bookData = null;
    if (allNames.includes(lorebookName)) {
        try { bookData = await ctx.loadWorldInfo(lorebookName); } catch (_) {}
    }
    
    if (!bookData) {
        try {
            const res = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ name: lorebookName })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data === 'object' && data.entries) {
                    bookData = data;
                }
            }
        } catch (_) {}
    }

    if (!bookData) {
        if (getSettings().debugMode) console.log(`[RPG Tracker] Initializing new lorebook: ${lorebookName}`);
        bookData = { 
            entries: {},
            name: lorebookName,
            scan_depth: 4,
            token_budget: 400,
            recursive: false,
            extensions: {}
        };
    }

    // Always reload fresh from disk to get accurate existing UIDs
    // (avoids uid:0 collision when multiple entries are written to a new book in one pass)
    const freshData = bookData;
    const existingUids = Object.keys(freshData?.entries || {}).map(Number).filter(n => !isNaN(n));
    const nextUid = existingUids.length > 0 ? Math.max(...existingUids) + 1 : 0;
    
    const writeTarget = freshData || bookData;
    writeTarget.entries[nextUid] = {
        uid: nextUid,
        key: entryData.keys || [entryData.label || entryData.id],
        keysecondary: [],
        comment: entryData.label || entryData.id || entryData.category || entryData.comment || 'LORE_GEN',
        content: entryData.content,
        constant: false,
        selective: false,
        selectiveLogic: 0,
        addMemo: true,
        order: 100,
        position: 0,
        disable: false,
        probability: 100,
        useProbability: false,
        depth: 4,
        group: '',
        groupOverride: false,
        groupWeight: 100,
    };
    
    await ctx.saveWorldInfo(lorebookName, writeTarget);
    
    // Update allNames cache so subsequent calls know this book now exists
    if (!allNames.includes(lorebookName)) allNames.push(lorebookName);
    
    // Trigger SillyTavern UI/Internal refresh
    if (ctx.reloadWorldInfoEditor) ctx.reloadWorldInfoEditor(lorebookName);
    if (ctx.eventSource && ctx.event_types) {
        ctx.eventSource.emit(ctx.event_types.WORLD_INFO_UPDATED, lorebookName);
    }
    
    return `${lorebookName}::${nextUid}`;
}

/**
 * Manual scene archiving tool.
 */
export async function saveSceneToLorebook(hint = "") {
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    if (!ctx.generateRaw) return;

    try {
        (/** @type {any} */ (toastr)).info("Saving scene...", "Lorebook Agent");
        
        const { chat } = ctx;
        const filteredChat = (chat || []).filter(m => !m.is_system && m.mes && m.mes.trim());
        const recentChat = filteredChat.slice(-5).map(m => `${(/** @type {any} */ (m)).is_user ? 'Player' : ((/** @type {any} */ (m)).name || 'Narrator')}: ${cleanMessageContent(m)}`).join('\n\n');

        const systemPrompt = `You are the Scene Archiver. Based on the recent narrative, generate a Lorebook entry for this scene.
Output a JSON object:
{
  "id": "scene_unique_name",
  "desc": "Short description",
  "content": "Full summary of the event",
  "keys": ["Keyword1", "Keyword2"]
}`;

        const userPrompt = `## RECENT CHAT\n${recentChat}\n\n${hint ? `## USER HINT\n${hint}\n\n` : ""}Generate the JSON scene save.`;

        const routerSettings = {
            ...settings,
            connectionSource: settings.routerConnectionSource || "default",
            maxTokens: (settings.routerMaxTokens !== undefined && settings.routerMaxTokens !== null && settings.routerMaxTokens !== '') ? Number(settings.routerMaxTokens) : 1000,
        };

        const result = await sendStateRequest(routerSettings, systemPrompt, userPrompt);
        const match = result.match(/\{[\s\S]*\}/);
        if (match) {
            const data = JSON.parse(match[0]);
            
            const prefix = getLivePrefix();
            const lorebookName = prefix ? `${prefix}World_Chronicle` : 'World Chronicle';
            const newId = await addLorebookEntry(lorebookName, {
                id: data.id,
                keys: data.keys,
                content: data.content,
                comment: 'LORE_SCENE'
            });
            
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            settings.routerLog.unshift({
                time: timestamp,
                activate: [newId], deactivate: [],
                reason: `Saved scene: ${data.desc} -> ${lorebookName} (${data.id})`
            });
            settings.activeRouterKeys.push(newId);
            void saveSettings();
            document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));
            
            (/** @type {any} */ (toastr)).success(`Saved scene: ${data.desc}`, 'Lorebook Agent');
        }
    } catch (e) {
        console.error("[Lorebook Agent] Save scene failed:", e);
        (/** @type {any} */ (toastr)).error('Failed to save scene.', 'Lorebook Agent');
    }
}

/**
 * Fetches a manifest of all campaign-scoped lorebook entries for the UI.
 * @param {boolean} skipUpdate When true, skips backend name probes (fast path).
 */
export async function getLorebookManifest(skipUpdate = false) {
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const prefix = getLivePrefix();
    sanitizeRouterState(settings);
    
    const names = await getWorldInfoNamesSafe({ fullProbe: !skipUpdate });
    // With no prefix, show nothing ? the user hasn't set a campaign yet.
    if (!prefix) return [];
    const scopedSet = new Set(names.filter(n => bookBelongsToPrefix(n, prefix)));
    
    // The fast path may supplement a lagging frontend registry with active IDs.
    // Full refreshes use backend names only; historical fallbacks there would
    // resurrect books that rollback already deleted.
    if (skipUpdate) {
        const activeBookNames = (settings.activeRouterKeys || [])
            .map(k => k.split('::')[0])
            .filter(Boolean);
        for (const n of activeBookNames) {
            if (isSkeletonBookName(n)) continue;
            if (!scopedSet.has(n) && bookBelongsToPrefix(n, prefix)) {
                scopedSet.add(n);
            }
        }
    }

    const activeRouterSet = new Set(settings.activeRouterKeys || []);
    const activeWorldSet = new Set(settings.activeWorldKeys || []);
    const pinnedSet = new Set(settings.pinnedRouterKeys || []);

    // Reconcile pinned entries into the active pools so pins survive manual pill
    // removal, rollbacks, or any other path that drops them from activeRouterKeys.
    let pinReconciled = false;
    for (const id of pinnedSet) {
        if (isSkeletonEntryId(id)) continue;
        const [bookName] = id.split('::');
        if (!bookName) continue;
        const isWorld = bookName.toLowerCase().endsWith('_world') || bookName.toLowerCase() === 'world';
        if (isWorld) {
            if (!activeWorldSet.has(id)) {
                activeWorldSet.add(id);
                if (!settings.activeWorldKeys) settings.activeWorldKeys = [];
                if (!settings.activeWorldKeys.includes(id)) settings.activeWorldKeys.push(id);
                pinReconciled = true;
            }
        } else if (!activeRouterSet.has(id)) {
            activeRouterSet.add(id);
            if (!settings.activeRouterKeys) settings.activeRouterKeys = [];
            if (!settings.activeRouterKeys.includes(id)) settings.activeRouterKeys.push(id);
            pinReconciled = true;
        }
    }
    if (pinReconciled) void saveSettings();

    const booksToLoad = [...scopedSet].filter(n => !isSkeletonBookName(n));
    const loadedBooks = await Promise.all(booksToLoad.map(async (n) => {
        try {
            const b = skipUpdate ? await ctx.loadWorldInfo(n) : await loadWorldInfoFresh(n, ctx);
            if (!b?.entries) return null;
            // Full refreshes read disk; write that back so the interceptor's
            // ctx.loadWorldInfo() sees the same entries the Agent UI just showed.
            if (!skipUpdate) await updateWorldInfoCache(n, b);
            return { bookName: n, entries: b.entries };
        } catch (_) {
            return null;
        }
    }));

    const manifest = [];
    for (const row of loadedBooks) {
        if (!row) continue;
        const { bookName, entries } = row;
        for (const [uid, entry] of Object.entries(entries)) {
            const id = `${bookName}::${uid}`;
            manifest.push({
                id,
                book: bookName,
                uid: uid,
                label: entry.comment || (entry.key?.[0]) || uid,
                keys: entry.key || [],
                content: entry.content,
                is_active: activeRouterSet.has(id) || activeWorldSet.has(id),
                is_pinned: pinnedSet.has(id),
                has_dungeon_map: !!getDungeonMapAttachment(entry),
            });
        }
    }
    return manifest;
}

/**
 * Deletes a lorebook entry by ID (Book::UID).
 */
export async function deleteLorebookEntry(id) {
    const [bookName, uid] = id.split('::');
    if (!bookName || !uid) return false;
    
    const ctx = SillyTavern.getContext();
    const book = await ctx.loadWorldInfo(bookName);
    if (!book?.entries || !book.entries[uid]) return false;
    
    delete book.entries[uid];
    await ctx.saveWorldInfo(bookName, book);
    
    // Also remove from active/pinned lists if it was there
    const settings = getSettings();
    if (settings.activeRouterKeys?.includes(id)) {
        settings.activeRouterKeys = settings.activeRouterKeys.filter(k => k !== id);
    }
    if (settings.activeWorldKeys?.includes(id)) {
        settings.activeWorldKeys = settings.activeWorldKeys.filter(k => k !== id);
    }
    if (settings.pinnedRouterKeys?.includes(id)) {
        settings.pinnedRouterKeys = settings.pinnedRouterKeys.filter(k => k !== id);
    }
    
    return true;
}

/**
 * Pin or unpin a lorebook entry so it stays permanently active for the Lorebook Agent.
 * Pinning always activates the entry immediately. Unpinning only removes the pin —
 * it does not force-deactivate the entry.
 * @param {string} id Book::uid
 * @param {boolean} pinned
 * @returns {boolean}
 */
export function setLorebookEntryPinned(id, pinned) {
    if (typeof id !== 'string' || !id.includes('::') || isSkeletonEntryId(id)) return false;
    const settings = getSettings();
    if (!Array.isArray(settings.pinnedRouterKeys)) settings.pinnedRouterKeys = [];

    const [bookName] = id.split('::');
    const isWorld = bookName.toLowerCase().endsWith('_world') || bookName.toLowerCase() === 'world';

    if (pinned) {
        if (!settings.pinnedRouterKeys.includes(id)) {
            settings.pinnedRouterKeys.push(id);
        }
        // Pin implies active
        if (isWorld) {
            if (!Array.isArray(settings.activeWorldKeys)) settings.activeWorldKeys = [];
            if (!settings.activeWorldKeys.includes(id)) settings.activeWorldKeys.push(id);
        } else {
            if (!Array.isArray(settings.activeRouterKeys)) settings.activeRouterKeys = [];
            if (!settings.activeRouterKeys.includes(id)) settings.activeRouterKeys.push(id);
        }
        // Agent/user ownership — remove from keyword auto-expire pool
        if (Array.isArray(settings.keywordActivatedKeys)) {
            settings.keywordActivatedKeys = settings.keywordActivatedKeys.filter(k => k !== id);
        }
    } else {
        settings.pinnedRouterKeys = settings.pinnedRouterKeys.filter(k => k !== id);
    }

    void saveSettings();
    return true;
}

/**
 * Updates editable fields on a single lorebook entry in-place.
 * Reads the book first so other fields (disable, extensions, etc.) are preserved.
 * @param {string} id - "BookName::uid"
 * @param {{ content?: string, key?: string[], comment?: string }} fields
 * @returns {Promise<boolean>}
 */
export async function updateLorebookEntry(id, fields) {
    const [bookName, uid] = id.split('::');
    if (!bookName || !uid) return false;

    const ctx = SillyTavern.getContext();
    const book = await ctx.loadWorldInfo(bookName);
    if (!book?.entries || !book.entries[uid]) return false;

    const entry = book.entries[uid];
    if (fields.content  !== undefined) entry.content = fields.content;
    if (fields.comment  !== undefined) entry.comment = fields.comment;
    if (fields.key      !== undefined) entry.key     = cleanKeys(fields.key);

    try {
        await ctx.saveWorldInfo(bookName, book);
        return true;
    } catch (e) {
        console.error('[RPG Tracker] updateLorebookEntry failed:', e);
        return false;
    }
}

/**
 * Scans the assistant's narrative output for entry keywords across all scoped
 * lorebooks. Entries whose keys appear in the text are immediately added to
 * activeRouterKeys so the Lorebook Agent sees their full content this turn.
 *
 * Must be called BEFORE runRouterPass on each generation.
 *
 * @param {string} narrativeText - The assistant message that just generated.
 * @param {{ sweepEnabled?: boolean }} [opts]
 * @returns {Promise<string[]>} IDs (Book::uid) of entries newly activated this pass.
 */
export async function scanAssistantOutputForKeywords(narrativeText, opts = {}) {
    if (!narrativeText) return [];
    const sweepEnabled = opts.sweepEnabled !== false; // default true
    const settings = getSettings();
    if (!isLorebookAgentRuntimeActive(settings)) return [];

    const ctx = SillyTavern.getContext();
    const prefix = getLivePrefix();
    if (!prefix) return [];

    // Fast path: campaignBooks avoids a disk re-index on every send. Union it
    // with the in-memory registry so a newly created NPCs book that is not yet
    // on the ownership list is still scanned (the exclusive fast path used to
    // skip those books until Activate / Refresh Manifest).
    const chatId = typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : null;
    const knownBooks = chatId ? (settings.chatStates?.[chatId]?.campaignBooks || []) : [];
    const registryNames = await getWorldInfoNamesSafe({ fullProbe: knownBooks.length === 0 });
    const logBookNames = (settings.routerLog || [])
        .flatMap(e => [...(e.record || []), ...(e.activate || [])].map(id => id.split('::')[0]))
        .filter(Boolean);
    const booksToScan = resolveBooksToScan(knownBooks, registryNames, prefix, logBookNames);

    // ── Forward pass: activate entries whose keywords appear in the new narrative ──
    // ── or in the recent history window (Retroactive Lookback).            ──
    const lowerText = narrativeText.toLowerCase();
    const chat = ctx.chat || [];
    const recentMessages = chat.filter(m => !m.is_system); // exclude system messages

    const currentActive = new Set((settings.activeRouterKeys || []).filter(id => !isSkeletonEntryId(id)));
    const currentKeyword = new Set(settings.keywordActivatedKeys || []);
    const pinnedSet = new Set((settings.pinnedRouterKeys || []).filter(id => !isSkeletonEntryId(id)));
    // Ensure pinned entries stay in the active pool for the duration of this scan
    for (const id of pinnedSet) currentActive.add(id);
    const newlyTriggered = [];

    const directMatches = [];
    const historyMatches = [];

    // Cache loaded books so the reverse sweep can reuse them without re-loading.
    /** @type {Map<string, any>} */
    const bookCache = new Map();

    for (const bookName of booksToScan) {
        if (isSkeletonBookName(bookName)) continue;
        const book = await ctx.loadWorldInfo(bookName);
        if (!book?.entries) continue;
        bookCache.set(bookName, book);

        for (const [uid, entry] of Object.entries(book.entries)) {
            // Mapped roots are activated exclusively by the authoritative
            // current-location hierarchy, never by incidental keyword mentions.
            if (getDungeonMapAttachment(entry)) continue;
            const fullId = `${bookName}::${uid}`;
            const keywords = Array.isArray(entry.key) ? entry.key : [];
            if (keywords.length === 0) continue;

            // Check the current narrative text (discovery)
            const isDirectMatch = keywords.some(kw =>
                typeof kw === 'string' && kw.length > 0 &&
                lowerText.includes(kw.toLowerCase())
            );

            if (isDirectMatch) {
                directMatches.push(fullId);
            } else {
                // Only check lookback history if not matched in direct text and not already active
                if (currentActive.has(fullId)) continue;
                const depth = (typeof entry.depth === 'number' && entry.depth > 0) ? entry.depth : (book.scan_depth ?? 4);
                const window = recentMessages.slice(-depth);
                const windowText = window.map(m => (m.mes || m.content || '')).join(' ').toLowerCase();
                const isHistoryMatch = keywords.some(kw =>
                    typeof kw === 'string' && kw.length > 0 &&
                    windowText.includes(kw.toLowerCase())
                );
                if (isHistoryMatch) {
                    historyMatches.push(fullId);
                }
            }
        }
    }

    // First process history matches (lower priority)
    for (const fullId of historyMatches) {
        if (!currentActive.has(fullId)) {
            currentActive.add(fullId);
            currentKeyword.add(fullId);
            newlyTriggered.push(fullId);
        }
    }

    // Then process direct matches (highest priority)
    for (const fullId of directMatches) {
        // Move to the end of the Set to prioritize and protect from eviction/expiration
        if (currentKeyword.has(fullId)) {
            currentKeyword.delete(fullId);
        }
        currentKeyword.add(fullId);

        if (!currentActive.has(fullId)) {
            currentActive.add(fullId);
            newlyTriggered.push(fullId);
        }
    }

    // ── Keyword overflow cap ───────────────────────────────────────────────────────
    // If routerMaxKeywordOverflow > 0, evict the oldest keyword-activated entries so
    // that the total number of active entries (agent-owned + keyword) never exceeds
    // routerMaxActivations + routerMaxKeywordOverflow.
    // Agent-owned entries (not in keywordActivatedKeys) are never touched.
    {
        const kwOverflowCap = settings.routerMaxKeywordOverflow || 0;
        if (kwOverflowCap > 0) {
            const maxActive   = settings.routerMaxActivations || 12;
            const hardCeiling = maxActive + kwOverflowCap;
            const totalActive = currentActive.size;
            if (totalActive > hardCeiling) {
                const toEvict = totalActive - hardCeiling;
                // currentKeyword preserves Set insertion order (oldest first)
                let evicted = 0;
                for (const id of currentKeyword) {
                    if (evicted >= toEvict) break;
                    if (pinnedSet.has(id)) continue; // never evict user-pinned entries
                    currentActive.delete(id);
                    currentKeyword.delete(id);
                    evicted++;
                }
                if (settings.debugMode && evicted > 0) {
                    console.log(`[RPG Tracker] Keyword overflow cap: evicted ${evicted} entr${evicted !== 1 ? 'ies' : 'y'} (ceiling: ${hardCeiling}, was: ${totalActive})`);
                }
            }
        }
    }

    // ── Reverse sweep: auto-expire keyword-activated entries whose keywords ──────
    // ── are no longer present in the last `entry.depth` messages.          ──────
    // Only runs on the full onGenerationEnded pass (sweepEnabled=true), not on the
    // lightweight user-message pre-scan from the interceptor.
    if (sweepEnabled) {
        const chat = ctx.chat || [];
        const recentMessages = chat.filter(m => !m.is_system);
        const autoExpired = [];

        for (const id of currentKeyword) {
            if (newlyTriggered.includes(id)) continue;
            if (pinnedSet.has(id)) continue; // user-pinned entries never auto-expire

            const [bookName, uid] = id.split('::');
            if (!bookName || uid === undefined) { autoExpired.push(id); continue; }

            let book = bookCache.get(bookName);
            if (!book) {
                book = await ctx.loadWorldInfo(bookName);
                if (book) bookCache.set(bookName, book);
            }
            const entry = book?.entries?.[uid];
            if (!entry) { autoExpired.push(id); continue; }

            const keywords = Array.isArray(entry.key) ? entry.key : [];
            if (keywords.length === 0) continue;

            const depth = (typeof entry.depth === 'number' && entry.depth > 0) ? entry.depth : (book.scan_depth ?? 4);
            const window = recentMessages.slice(-depth);
            const windowText = window.map(m => (m.mes || m.content || '')).join(' ').toLowerCase();

            const stillPresent = keywords.some(kw =>
                typeof kw === 'string' && kw.length > 0 && windowText.includes(kw.toLowerCase())
            );

            if (!stillPresent) autoExpired.push(id);
        }

        if (autoExpired.length > 0) {
            for (const id of autoExpired) {
                currentActive.delete(id);
                currentKeyword.delete(id);
            }
            if (settings.debugMode) {
                console.log('[RPG Tracker] Keyword scanner auto-expired:', autoExpired);
            }
        }
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    // Re-assert pins in case any earlier path dropped them
    for (const id of pinnedSet) currentActive.add(id);
    settings.activeRouterKeys = [...currentActive];
    settings.keywordActivatedKeys = [...currentKeyword].filter(id => !pinnedSet.has(id));
    settings.lastKeywordTriggeredKeys = newlyTriggered;
    void saveSettings();

    if (settings.debugMode && newlyTriggered.length > 0) {
        console.log('[RPG Tracker] Keyword scanner activated:', newlyTriggered);
    }

    return newlyTriggered;
}

/** @param {string} bookName */
function isNpcBookName(bookName) {
    const lower = (bookName || '').toLowerCase();
    return lower.endsWith('_npcs') || lower.endsWith('_npc') || lower === 'npcs' || lower === 'npc';
}

/**
 * NPC entry IDs newly recorded (not updated) on the latest Lorebook Agent pass.
 * Used to tighten Present-Now matching so agent-created entries need a full-name hit.
 * @param {object} [settings]
 * @returns {Set<string>}
 */
function getRecentlyRecordedNpcIds(settings) {
    const log = (settings || getSettings()).routerLog?.[0];
    if (!log?.record?.length) return new Set();
    const ids = new Set();
    for (const item of log.record) {
        const raw = String(item || '').trim();
        if (!raw || /\(updated\)/i.test(raw)) continue;
        const id = raw.replace(/\s*\(.*\)\s*$/g, '').trim();
        if (!id.includes('::')) continue;
        const bookName = id.split('::')[0];
        if (isNpcBookName(bookName)) ids.add(id);
    }
    return ids;
}

/**
 * Most recent single assistant/narrator message only (not the whole multi-message
 * turn block, and never a user input — Present Now must not empty between replies).
 * @param {boolean} [includeHidden]
 * @returns {string}
 */
function getMostRecentNarrativeText(includeHidden = false) {
    const { chat } = SillyTavern.getContext();
    const msg = findMostRecentNarratorMessage(chat, { includeHidden });
    if (!msg) return '';
    const raw = String(msg.mes || msg.content || '');
    const withoutChoices = stripCyoaChoiceBlocks(raw);
    const mes = cleanMessageContent({ ...msg, mes: withoutChoices, content: withoutChoices });
    if (!mes) return '';
    if (mes.startsWith('[Summary') || mes.startsWith('(Summary') || mes.includes('Summary of past events:')) return '';
    return mes;
}

/**
 * Present-Now name scanner — separate from the Lorebook Agent keyword scanner.
 * Scans ONLY the latest single narrator message for NPC names (entry comment/label).
 * CYOA choice/button blocks are stripped first so hypothetical
 * names in action options do not count as scene presence.
 * User messages are never scanned: a player turn without explicit NPC names must
 * not clear Present Now. First/last name tokens are enough for established NPCs;
 * NPCs the agent just recorded this pass require a full-name match so loose
 * tokens/keys do not instantly populate Present Now. Lorebook key[] arrays are
 * never scanned.
 *
 * Call immediately before location scene image generation (and when building Present Now UI).
 *
 * @param {string} [narrativeText] Defaults to the latest assistant output.
 * @returns {Promise<Array<{ id: string, label: string, content: string }>>}
 */
export async function scanRecentOutputForPresentNpcs(narrativeText) {
    const settings = getSettings();
    const rawText = (narrativeText != null && narrativeText !== '')
        ? String(narrativeText)
        : getMostRecentNarrativeText(!!settings.routerIncludeHidden);
    const text = stripCyoaChoiceBlocks(rawText);
    if (!text.trim()) return [];

    const ctx = SillyTavern.getContext();
    const prefix = getLivePrefix();
    if (!prefix) return [];

    const chatId = typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : null;
    const knownBooks = chatId ? (settings.chatStates?.[chatId]?.campaignBooks || []) : [];
    const registryNames = await getWorldInfoNamesSafe({ fullProbe: knownBooks.length === 0 });
    const booksToScan = resolveBooksToScan(knownBooks, registryNames, prefix)
        .filter(n => isNpcBookName(n));
    if (!booksToScan.length) return [];

    const recentlyRecordedNpcIds = getRecentlyRecordedNpcIds(settings);

    /** @type {Array<{ id: string, label: string, content: string }>} */
    const matched = [];
    const seenLabels = new Set();

    for (const bookName of booksToScan) {
        let book;
        try {
            book = await ctx.loadWorldInfo(bookName);
        } catch {
            continue;
        }
        if (!book?.entries) continue;

        for (const [uid, entry] of Object.entries(book.entries)) {
            const fullId = `${bookName}::${uid}`;
            // Name-only: use the entry label (comment), never lorebook key[] keywords.
            const label = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').trim();
            if (!label) continue;

            const requireFullName = recentlyRecordedNpcIds.has(fullId);
            if (!narrativeMentionsNpcName(text, label, { requireFullName })) continue;

            const labelKey = label.replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
            if (seenLabels.has(labelKey)) continue;
            seenLabels.add(labelKey);

            matched.push({
                id: `${bookName}::${uid}`,
                label,
                content: (entry.content || '').trim(),
            });
        }
    }

    if (settings.debugMode) {
        console.log('[RPG Tracker] Present-Now name scan (latest output only):', matched.map(m => m.label));
    }
    return matched;
}

/**
 * True if narrative text mentions the NPC's full name, or any first/last name token.
 * Case-sensitive word-boundary match; ignores parenthetical suffixes and very short tokens.
 * @param {string} narrativeText
 * @param {string} npcLabel
 * @param {{ requireFullName?: boolean }} [opts] When true, only a full-name match counts (no first/last token).
 * @returns {boolean}
 */
function narrativeMentionsNpcName(narrativeText, npcLabel, opts = {}) {
    const text = String(narrativeText || '');
    const cleaned = String(npcLabel || '')
        .replace(/\s*\(.*?\)/g, '')
        .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned || text.length === 0) return false;

    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundaryRe = (phrase) => new RegExp(
        `(?:^|[^\\p{L}\\p{N}])${phrase}(?:[^\\p{L}\\p{N}]|$)`,
        'u',
    );

    if (cleaned.length >= 2) {
        const fullPattern = escapeRe(cleaned).replace(/\s+/g, '\\s+');
        if (wordBoundaryRe(fullPattern).test(text)) return true;
    }

    if (opts.requireFullName) return false;

    const tokens = cleaned.split(/\s+/).filter(t => t.length >= 2);
    for (const token of tokens) {
        if (wordBoundaryRe(escapeRe(token)).test(text)) return true;
    }
    return false;
}




/**
 * Sets disable: true on every entry in all scoped lorebooks so ST's native
 * keyword scanner never injects managed entries on user-message send.
 * Idempotent — safe to call on every init / chat-change.
 */
export async function disableManagedEntries() {
    const settings = getSettings();
    if (!isLorebookAgentRuntimeActive(settings)) return;
    // In native keyword mode, entries are left enabled for ST's keyword scanner to manage.
    if (settings.routerNativeKeywordActivation) return;
    const ctx = SillyTavern.getContext();
    const prefix = getLivePrefix();
    if (!prefix) return;

    try {
        /** @type {string[]} */
        let scoped;
        const chatId = ctx.chatId || '';
        const savedBooks = chatId && settings.chatStates?.[chatId]?.campaignBooks;
        if (savedBooks?.length) {
            scoped = savedBooks.filter(n => bookBelongsToPrefix(n, prefix) && !isSkeletonBookName(n));
        } else {
            const allNames = await getWorldInfoNamesSafe({ fullProbe: false });
            scoped = allNames.filter(n => bookBelongsToPrefix(n, prefix) && !isSkeletonBookName(n));
        }

        await Promise.all(scoped.map(async (bookName) => {
            try {
                const book = await ctx.loadWorldInfo(bookName);
                if (!book?.entries) return;
                let changed = false;
                for (const entry of Object.values(book.entries)) {
                    if (!entry.disable) {
                        entry.disable = true;
                        changed = true;
                    }
                }
                if (changed) {
                    try { await ctx.saveWorldInfo(bookName, book); } catch (_) {}
                }
            } catch (_) { /* book may not exist yet */ }
        }));
    } catch (e) {
        console.warn('[RPG Tracker] disableManagedEntries failed:', e);
    }
}

/**
 * Removes duplicates and empty strings from an array of keywords.
 */
function cleanKeys(keys) {
    if (!Array.isArray(keys)) return [];
    const unique = [...new Set(keys.map(k => k?.trim()).filter(Boolean))];
    return unique.slice(0, 6); // Hard cap: max 6 keywords per entry to prevent keyword bloat
}

/** Site name first, then user keywords, still capped at 6. */
function locationKeysForNewRoot(site, keys) {
    const extra = Array.isArray(keys) ? keys : String(keys || '').split(/[,;\n]/);
    return cleanKeys([site, ...extra]);
}

/**
 * Given existing lorebook content and a delta the model wants to append,
 * strip any sentences/lines from the delta that are already present in the
 * existing content (the model often echoes the full entry back).
 * Returns only the truly-new content, or an empty string if nothing is new.
 */
function deduplicateContent(existing, delta) {
    if (!existing || !delta) return delta || '';
    const normExisting = existing.toLowerCase();
    // Split delta on newlines; keep a line only if it's not already in existing
    const newLines = delta.split('\n').filter(line => {
        const norm = line.replace(/^\[.*?\]\s*/g, '').trim().toLowerCase();
        // Short or empty fragments are kept as-is (timestamps, separators, etc.)
        if (norm.length < 15) return true;
        return !normExisting.includes(norm);
    });
    return newLines.join('\n').trim();
}

/**
 * Ensures that if the original content had a [CORE] ... [/CORE] block,
 * that block is preserved exactly in the new/rewritten content.
 * Prevents the model from shortening, modifying, or removing the CORE block.
 * @param {string} originalContent
 * @param {string} newContent
 * @returns {string}
 */
function protectCoreBlock(originalContent, newContent) {
    if (!originalContent) return newContent;
    let protectedContent = String(newContent || '');
    const coreRegex = /\[CORE\]([\s\S]*?)\[\/CORE\]/i;
    const originalCoreMatch = originalContent.match(coreRegex);
    if (originalCoreMatch) {
        const originalCoreBlock = originalCoreMatch[0];
        const newCoreMatch = protectedContent.match(coreRegex);
        protectedContent = newCoreMatch
            ? protectedContent.replace(coreRegex, originalCoreBlock)
            : `${originalCoreBlock}${protectedContent ? `\n${protectedContent}` : ''}`;
    }

    // [MAP] is objective canon. Generic cleanup/rewrite operations may see it
    // for context but cannot touch it; only validated map transactions mutate it.
    const mapRegex = /\[MAP\]([\s\S]*?)\[\/MAP\]/i;
    const originalMapMatch = originalContent.match(mapRegex);
    if (originalMapMatch) {
        const originalMapBlock = originalMapMatch[0];
        const newMapMatch = protectedContent.match(mapRegex);
        protectedContent = newMapMatch
            ? protectedContent.replace(mapRegex, originalMapBlock)
            : `${protectedContent.trimEnd()}${protectedContent.trim() ? '\n\n' : ''}${originalMapBlock}`;
    }
    return protectedContent;
}


/**
 * Estimates token count using a ~4 chars/token heuristic.
 * Sufficient for threshold comparisons; no tokenizer dependency needed.
 */
function estimateTokens(str) {
    return Math.ceil((str || '').length / 4);
}

/**
 * Returns the set of word bigrams from a string,
 * stripping timestamp markers like [Day X, HH:MM].
 */
function getBigrams(str) {
    const words = str.toLowerCase()
        .replace(/\[[^\]]+\]/g, '')
        .trim()
        .split(/\s+/);
    const bigrams = new Set();
    for (let i = 0; i < words.length - 1; i++) {
        bigrams.add(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
}

/**
 * Jaccard similarity between two strings based on word bigrams.
 * Returns 0–1; higher = more similar.
 */
function jaccardSimilarity(a, b) {
    const ba = getBigrams(a), bb = getBigrams(b);
    const intersection = [...ba].filter(x => bb.has(x)).length;
    const union = new Set([...ba, ...bb]).size;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Counts near-duplicate line pairs within a single entry's content.
 * Used to annotate entries in the cleanup context — not passed verbatim to the LLM.
 *
 * @param {string} content
 * @param {number} threshold - Similarity threshold (default 0.6)
 * @returns {number} Count of near-duplicate pairs
 */
function countRedundantPairs(content, threshold = 0.6) {
    const lines = content.split('\n').filter(Boolean);
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
            if (jaccardSimilarity(lines[i], lines[j]) >= threshold) count++;
        }
    }
    return count;
}


// -- World Progression ---------------------------------------------------------------

/**
 * Removes all entries from a lorebook while preserving book-level metadata.
 * @param {string} bookName
 * @returns {Promise<{ existed: boolean, cleared: number }>}
 */
async function clearWorldInfoBookEntries(bookName) {
    const ctx = SillyTavern.getContext();
    let book = null;
    try {
        book = await ctx.loadWorldInfo(bookName);
    } catch (_) { /* book may not exist yet */ }

    const cleared = book?.entries ? Object.keys(book.entries).length : 0;
    if (!book && cleared === 0) {
        return { existed: false, cleared: 0 };
    }

    const emptyBook = {
        entries: {},
        name: bookName,
        scan_depth: book?.scan_depth ?? 4,
        token_budget: book?.token_budget ?? 400,
        recursive: book?.recursive ?? false,
        extensions: book?.extensions ?? {},
    };

    await fetch('/api/worldinfo/edit', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: bookName, data: emptyBook }),
    });
    if (typeof ctx.saveWorldInfo === 'function') {
        try { await ctx.saveWorldInfo(bookName, emptyBook); } catch (_) { /* non-fatal */ }
    }
    if (typeof ctx.updateWorldInfoList === 'function') {
        try { await ctx.updateWorldInfoList(); } catch (_) { /* non-fatal */ }
    }

    return { existed: true, cleared };
}

/**
 * Wipes World Progression lore + timer state for the active chat's campaign prefix.
 * Clears all reports ({prefix}_World) and skeleton seed data ({prefix}_Skeleton), resets
 * the per-chat timer, and drops active world report keys so prior chats cannot leak in.
 * @param {{ includeSkeleton?: boolean }} [opts]
 * @returns {Promise<{ prefix: string, worldBookName: string, skeletonBookName: string, worldCleared: number, skeletonCleared: number }>}
 */
export async function purgeWorldHistoryForChat(opts = {}) {
    const includeSkeleton = opts.includeSkeleton !== false;
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const chatId = ctx.chatId || '';
    const prefix = getLivePrefix();
    const worldBookName = prefix ? `${prefix}_World` : 'World';
    const skeletonBookName = prefix ? `${prefix}_Skeleton` : 'World_Skeleton';

    const worldResult = await clearWorldInfoBookEntries(worldBookName);
    let skeletonResult = { cleared: 0, existed: false };
    if (includeSkeleton) {
        skeletonResult = await clearWorldInfoBookEntries(skeletonBookName);
    }

    settings.activeWorldKeys = [];
    settings.worldProgressionLastFiredAtMinutes = -1;
    settings.worldProgressionLastFiredPeriodLabel = '';
    settings.worldProgressionSkeletonAtmosphereSummary = '';
    settings.worldProgressionLocationLastAdvanced = {};
    settings.mapEvolutionWorldReportApplications = {};

    if (settings.chatStates && chatId && settings.chatStates[chatId]) {
        const cs = settings.chatStates[chatId];
        cs.activeWorldKeys = [];
        cs.worldProgressionLastFiredAtMinutes = -1;
        cs.worldProgressionLastFiredPeriodLabel = '';
        cs.worldProgressionSkeletonAtmosphereSummary = '';
        cs.worldProgressionLocationLastAdvanced = {};
        cs.mapEvolutionWorldReportApplications = {};
    }

    persistWorldProgressionTimer();
    void saveSettings();
    if (settings.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    }

    document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));

    return {
        prefix: prefix || '(none)',
        worldBookName,
        skeletonBookName,
        worldCleared: worldResult.cleared,
        skeletonCleared: skeletonResult.cleared,
    };
}

/**
 * Parses an in-world time string (e.g. "11:52 AM, Day 3") into total minutes
 * from campaign start (Day 1, 00:00 = 0). Returns -1 if unparseable.
 * @param {string} timeStr
 * @returns {number}
 */
export function parseInWorldMinutes(timeStr) {
    if (!timeStr) return -1;
    const ddmmyyMatch = timeStr.match(/\b(\d{1,2})\/(\d{1,2})\/(\d+)\b/);
    const dayMatch = timeStr.match(/(?:Day|D)\s*(\d+)/i);
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!ddmmyyMatch && !dayMatch && !timeMatch) return -1;
    return parseInWorldTime(timeStr);
}

function computePeriodLabel(startMinutes, endMinutes, intervalHours) {
    return formatInWorldTime(endMinutes);
}

/**
 * Standalone deterministic World Progression pass.
 * Called by maybeRunWorldProgression() in narrative-hooks.js when the in-world interval
 * has elapsed. Never invoked by the Lorebook Agent itself.
 *
 * @param {string} timeStr        - Raw time string from [TIME] block (e.g. "11:52 AM, Day 3")
 * @param {number} currentMinutes - Current in-world total minutes (from parseInWorldMinutes)
 */
export async function runWorldProgressionPass(timeStr, currentMinutes, extraInstructions = null) {
    const settings = getSettings();
    const prefix = getLivePrefix();
    const worldBookName = prefix ? `${prefix}_World` : 'World';
    const intervalHours = settings.worldProgressionIntervalHours || 24;
    const keepActive = settings.worldProgressionKeepActive || 1;
    const wordTarget = 600;

    // Connection settings shared by all LLM calls within this pass
    // (consolidation pre-step + main report generation).
    const routerSettings = {
        connectionSource: settings.worldConnectionSource || 'default',
        connectionProfileId: settings.worldConnectionProfileId,
        completionPresetId: settings.worldCompletionPresetId,
        ollamaUrl: settings.worldOllamaUrl,
        ollamaModel: settings.worldOllamaModel,
        openaiUrl: settings.worldOpenaiUrl,
        openaiKey: settings.worldOpenaiKey,
        openaiModel: settings.worldOpenaiModel,
    };

    const lastFiredLabel = settings.worldProgressionLastFiredPeriodLabel || '';
    const lastFired = lastFiredLabel ? parseInWorldMinutes(lastFiredLabel) : null;
    const intervalMinutes = intervalHours * 60;

    // Determine the start of the period we're reporting on
    const periodStart = lastFired !== null ? lastFired : currentMinutes - intervalMinutes;
    const periodEnd = periodStart + intervalMinutes;
    const periodLabel = computePeriodLabel(periodStart, periodEnd, intervalHours);

    broadcastStep('thought', `\uD83C\uDF0D World Progression: Checking for "${periodLabel}" report...`);

    // 1. Load ALL campaign lorebooks once.
    //    Used for: duplicate check, full lore context, and applyAction verification.
    //    No double-fetch - archiveBooks is reused throughout the function.
    const ctx = SillyTavern.getContext();
    const allBookNames = await getWorldInfoNamesSafe();
    const archiveBooks = {};
    for (const n of allBookNames) {
        if (prefix && !bookBelongsToPrefix(n, prefix)) continue;
        try {
            const b = await ctx.loadWorldInfo(n);
            if (b?.entries) archiveBooks[n] = b;
        } catch (_) {}
    }

    // 2. Duplicate check - see if a report for this period already exists in the World book.
    const worldBook = archiveBooks[worldBookName] ?? null;
    const cleanPeriod = periodLabel.toLowerCase().trim();
    if (worldBook?.entries) {
        for (const [uid, entry] of Object.entries(worldBook.entries)) {
            const existingLabel = (entry.comment || '').toLowerCase().trim();
            if (existingLabel === cleanPeriod) {
                broadcastStep('thought', `\uD83C\uDF0D World Progression: "${periodLabel}" already exists - advancing timer.`);
                settings.worldProgressionLastFiredPeriodLabel = periodLabel;
                const metadata = normalizeWorldReportMetadata(entry, worldBookName, uid);
                settings.worldProgressionLocationLastAdvanced = stampLocationAdvancement(
                    settings.worldProgressionLocationLastAdvanced,
                    metadata.selectedLocations,
                    periodLabel,
                );
                persistWorldProgressionTimer();
                return {
                    ok: true,
                    skipped: 'duplicate',
                    periodLabel,
                    reportContent: String(entry.content || '').trim(),
                    reportId: metadata.reportId,
                    selectedLocations: metadata.selectedLocations,
                };
            }
        }
    }

    // 2b. Consolidation pre-step — fire BEFORE building lore context so the historical dump
    //     fed to the new report reflects the freshly compressed archive.
    //     This is a standalone LLM call with its OWN dedicated system prompt.
    //     It is NEVER part of the Lorebook Agent prompt and has zero per-turn token cost.
    if (settings.worldProgressionConsolidateEnabled) {
        const consolidateInterval = Math.max(2, settings.worldProgressionConsolidateInterval || 7);
        const currentWorldBook = archiveBooks[worldBookName] ?? null;
        if (currentWorldBook?.entries) {
            // Sort entries chronologically by UID (insertion order ≈ chronological)
            const allWorldEntries = Object.entries(currentWorldBook.entries)
                .sort(([a], [b]) => Number(a) - Number(b));

            // Classify entries: raw = individual period reports; consolidated = range summaries
            const isRawReport = (label) => {
                if (!/^day\s+\d+/i.test(label)) return false; // must start with "Day N"
                if (/days?\s+\d+\s*[\-\u2013\u2014]\s*\d+/i.test(label)) return false; // "Days N-M"
                if (/condensed|compressed|merged|summary/i.test(label)) return false;
                return true;
            };

            const rawEntries = allWorldEntries.filter(([, e]) =>
                isRawReport((e.comment || '').trim())
            );

            if (rawEntries.length >= consolidateInterval) {
                // Take the oldest N raw reports for consolidation
                const toConsolidate = rawEntries.slice(0, consolidateInterval);

                // Build a content dump for the LLM
                const rawDump = toConsolidate
                    .map(([, e]) => `### ${(e.comment || '').trim()}\n${(e.content || '').trim()}`)
                    .join('\n\n');

                // Determine the day range covered by these reports
                const dayNums = toConsolidate.map(([, e]) => {
                    const m = (e.comment || '').match(/Day\s+(\d+)/i);
                    return m ? parseInt(m[1], 10) : null;
                }).filter(n => n !== null);
                const minDay = dayNums.length ? Math.min(...dayNums) : 1;
                const maxDay = dayNums.length ? Math.max(...dayNums) : minDay;
                const consolidatedLabel = (minDay === maxDay)
                    ? `Day ${minDay} (Condensed)`
                    : `Days ${minDay}\u2013${maxDay}`;

                // Dedicated consolidation system prompt — never reused anywhere else
                const consolidationSystemPrompt =
`You are the World Archivist. Compress the following World Progression reports into a single, unified summary while preserving maximum narrative signal.

## RULES
1. Merge all reports into a single coherent, present-tense narrative.
2. Always retain temporal context. The summary MUST begin with the overall period label (e.g. "[${consolidatedLabel}]"). Never remove all temporal markers.
3. Preserve every unique location-scale or wider-current fact — institutional developments, location changes, economic shifts, environmental conditions, public sentiment, and causal reversals. Named entities may remain only where needed to identify historical causes; do not turn them into new simulation subjects. Never replace detailed facts with generic summaries.
4. Eliminate only true redundancies — if the same fact repeats across multiple reports, write it once.
5. Target 40–60% of the combined original token count.
6. Format: dense prose or tight bullet points, no filler, no markdown headers beyond the period label. 1–2 sentences per development.
7. Output ONLY the compressed report content. No preamble, no tags, no meta-commentary.`;

                const consolidationUserPrompt =
`Compress the following ${toConsolidate.length} World Progression reports into a single summary for the period **${consolidatedLabel}**.

${rawDump}`;

                broadcastStep('thought', `\uD83C\uDF0D World Progression: Consolidating ${toConsolidate.length} reports into \"${consolidatedLabel}\"...`);

                let consolidatedContent = null;
                try {
                    consolidatedContent = await sendStateRequest(routerSettings, consolidationSystemPrompt, consolidationUserPrompt, null, { stream: true, debugSource: 'World Progression' });
                } catch (e) {
                    broadcastStep('error', `World Progression consolidation failed: ${e.message} — continuing without consolidation.`);
                }

                if (consolidatedContent && consolidatedContent.trim()) {
                    // Reload the world book from disk for a fresh write
                    let freshBook = null;
                    try { freshBook = await ctx.loadWorldInfo(worldBookName); } catch (_) {}
                    if (!freshBook?.entries) freshBook = currentWorldBook;

                    // Add the consolidated entry
                    const allUids = Object.keys(freshBook.entries).map(Number).filter(n => !isNaN(n));
                    const nextUid = allUids.length > 0 ? Math.max(...allUids) + 1 : 0;
                    freshBook.entries[nextUid] = {
                        uid: nextUid,
                        key: [],
                        keysecondary: [],
                        comment: consolidatedLabel,
                        content: consolidatedContent.trim(),
                        constant: false,
                        selective: false, selectiveLogic: 0, addMemo: true,
                        order: settings.routerDefaultOrder ?? 100,
                        position: settings.routerDefaultPosition ?? 0,
                        disable: true,
                        probability: 100, useProbability: false,
                        depth: settings.routerDefaultDepth ?? 4,
                        role: null,
                        group: '', groupOverride: false, groupWeight: 100,
                    };

                    // Delete the raw entries that were consolidated
                    const toDeleteUids = toConsolidate.map(([uid]) => uid);
                    for (const uid of toDeleteUids) {
                        delete freshBook.entries[uid];
                        const fullId = `${worldBookName}::${uid}`;
                        settings.activeWorldKeys = (settings.activeWorldKeys || []).filter(k => k !== fullId);
                    }

                    // Persist to disk
                    await fetch('/api/worldinfo/edit', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({ name: worldBookName, data: freshBook })
                    });
                    try { await ctx.saveWorldInfo(worldBookName, freshBook); } catch (_) {}

                    // Update the in-memory archive so the lore context build step reads fresh data
                    archiveBooks[worldBookName] = freshBook;

                    broadcastStep('thought', `\uD83C\uDF0D World Progression: \"${consolidatedLabel}\" consolidated — ${toDeleteUids.length} raw reports removed.`);
                }
            }
        }
    }

    // 3. Historical macro context only. Location lore and pertinent read-only
    //    constraints are assembled below by buildWorldProgressionLocationDossiers().
    const historicalReportLines = [];
    for (const [bookName, book] of Object.entries(archiveBooks)) {
        const nameLower = String(bookName || '').toLowerCase();
        const isWorldBook = nameLower.endsWith('_world') || nameLower === 'world';
        if (!isWorldBook || !book?.entries) continue;
        let sortedEntries = Object.entries(book.entries)
            .sort(([left], [right]) => Number(left) - Number(right));
        const historyLookback = settings.worldProgressionHistoryLookback ?? 0;
        if (historyLookback > 0) sortedEntries = sortedEntries.slice(-historyLookback);
        for (const [, entry] of sortedEntries) {
            const content = String(entry?.content || '').trim();
            if (!content) continue;
            const label = String(entry?.comment || entry?.key?.[0] || 'Prior report').trim();
            historicalReportLines.push(`### ${label}\n${content}`);
        }
    }
    const historicalDump = historicalReportLines.length
        ? historicalReportLines.join('\n\n')
        : 'No prior World Progression reports.';

    // 4. Grab recent narrative blocks (for current scene context) if configured
    let recentNarrative = '';
    const wpLookback = settings.worldProgressionLookback ?? 0;
    if (wpLookback > 0) {
        const { chat } = ctx;
        const narrativeBlocks = [];
        if (Array.isArray(chat)) {
            let found = 0;
            for (const msg of [...chat].reverse()) {
                if (found >= wpLookback) break;
                if (msg.is_system || msg.is_user) continue;
                let mes = (msg.mes || '').trim()
                    .replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '')
                    .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '').trim();
                if (mes) { narrativeBlocks.unshift(mes); found++; }
            }
        }
        recentNarrative = narrativeBlocks.join('\n\n');
    }

    const locationContext = buildWorldProgressionLocationDossiers(archiveBooks, {
        prefix,
        exclusionList: settings.worldProgressionExclusionList || '',
    });
    const selectedDossiers = selectWorldProgressionLocations(locationContext.dossiers, {
        count: settings.worldProgressionLocationsPerReport ?? 3,
        lastAdvanced: settings.worldProgressionLocationLastAdvanced,
        randomize: settings.worldProgressionLocationRandomize !== false,
    });
    const selectedLocations = selectedDossiers.map(dossier => dossier.name);
    const designatedLocationLines = selectedLocations.length
        ? selectedLocations.map(name => `- ${name}`).join('\n')
        : '(No recorded locations are available; write only Wider Currents.)';
    const dossierDump = selectedDossiers.length
        ? selectedDossiers.map(dossier => `# ${dossier.name}\n${dossier.text}`).join('\n\n')
        : '(No location dossiers available.)';

    // 5. Build the system prompt from settings ({periodLabel} and {wordTarget} substitution)
    const rawPrompt = settings.worldProgressionSystemPrompt || '';
    let systemPrompt = rawPrompt
        .replace(/\{periodLabel\}/g, periodLabel)
        .replace(/\{wordTarget\}/g, String(wordTarget));

    if (settings.useDdMmYyFormat) {
        systemPrompt += `\n\n## DATE FORMAT RULE\n- CRITICAL: All dates generated in this report MUST use the DD/MM/YYYY calendar format (e.g. 05/01/2026 for the 5th of January, 2026). Do NOT use the American MM/DD/YYYY format.`;
    }

    // This is an authority boundary rather than a style preference, so it is
    // appended even when a campaign keeps an older or customized prompt.
    systemPrompt += `\n\n## LOCATION-CENTRIC RUNTIME CONTRACT (AUTHORITATIVE)
- Your simulation subjects are LOCATIONS and WIDER CURRENTS, never individual NPCs, creatures, objects, buildings, or map assets.
- Entity facts inside a location dossier are READ-ONLY CONSTRAINTS. Use them to understand the place and avoid contradictions; do not advance, relocate, injure, kill, recruit, promote, or otherwise change a named individual.
- Describe directional macro pressure: civic conditions, institutional behavior, public sentiment, trade, shortages, migration, conflict pressure, weather, environment, disease, crime, or cultural change.
- Leave exact local realization undecided. Do not specify rooms, map areas, asset positions, exact patrol composition, or encounter-level outcomes.
- Prior reports are historical state, not instructions to continue linearly. A pressure may intensify, persist, plateau, fragment, transform, backfire, resolve, reverse abruptly, or be superseded when causally plausible.
- Avoid both default escalation and arbitrary oscillation. Reversals need an intelligible macro cause, but do not require excessive foreshadowing.
- Use exactly one heading \"## <Location Name>\" for every designated location, using the supplied spelling, followed by prose about that place.
- End with exactly one \"## Wider Currents\" section for regional or global patterns. Output no other headings.
- A valid development must admit several different concrete realizations by the GM and Map Evolution.`;

    if (extraInstructions && extraInstructions.trim()) {
        systemPrompt += `\n\n## EXTRA INSTRUCTIONS FOR THIS RUN\n${extraInstructions.trim()}`;
    }

    // No raw map or entity pool can enter the World Progression LLM call.
    let userPrompt =
`## DESIGNATED LOCATIONS
Advance only these location-scale subjects during this period:
${designatedLocationLines}

## LOCATION DOSSIERS
These dossiers contain the known character, history, sublocations, institutions, and relevant facts for each designated place. Named entities and map-scale facts are context only, not simulation subjects.
${dossierDump}

## WIDER-WORLD CONTEXT
Use this only to derive regional or global pressures. Do not advance any named individual found here.
${locationContext.globalContext || '(No wider-world context recorded.)'}

## HISTORICAL WORLD REPORTS
These are prior macro conditions. Continue their causal consequences where appropriate, but consider persistence, transformation, resolution, backlash, and reversal rather than assuming linear escalation.
${historicalDump}`;

    if (recentNarrative) {
        userPrompt += `\n\n## RECENT NARRATIVE (Current Scene Context)\n${recentNarrative}`;
    }

    userPrompt += `\n\nWrite the World Progression report for **${periodLabel}**, with exactly one section for every designated location and a final Wider Currents section.`;

    // 6. Send the LLM request using the Lorebook Agent connection settings
    broadcastStep('thought', `\uD83C\uDF0D World Progression: Generating report for "${periodLabel}" (${selectedLocations.length} locations, ${historicalReportLines.length} prior reports)...`);
    let reportContent;
    try {
        reportContent = await sendStateRequest(routerSettings, systemPrompt, userPrompt, null, { stream: true, debugSource: 'World Progression' });
    } catch (e) {
        broadcastStep('error', `World Progression generation failed: ${e.message}`);
        return { ok: false, error: e.message };
    }
    if (!reportContent || !reportContent.trim()) {
        broadcastStep('error', 'World Progression: LLM returned empty response.');
        return { ok: false, error: 'empty' };
    }

    // 7. Store the entry via applyAction (routes to the _World lorebook).
    //    archiveBooks already loaded in step 1 - no re-fetch needed.
    const entryKeys = ['world progression', 'world report', periodLabel.toLowerCase()];
    const dayNum = periodLabel.match(/day\s+(\d+)/i)?.[1];
    if (dayNum) entryKeys.push(`day ${dayNum}`);

    await applyAction({
        record: [{ label: periodLabel, keys: entryKeys, content: reportContent.trim(), category: 'WORLD' }],
        reason: `World Progression: auto-generated report for ${periodLabel}`,
    }, archiveBooks, timeStr, '');

    // 8. Rolling window: keep only the N most recent WORLD entries active.
    await new Promise(r => setTimeout(r, 300));
    let freshWorldBook = null;
    let reportId = '';
    try { freshWorldBook = await ctx.loadWorldInfo(worldBookName); } catch (_) {}
    if (!freshWorldBook?.entries) {
        try {
            const r = await fetch('/api/worldinfo/get', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ name: worldBookName })
            });
            if (r.ok) { const d = await r.json(); if (d?.entries) freshWorldBook = d; }
        } catch (_) {}
    }

    if (freshWorldBook?.entries) {
        const sorted = Object.entries(freshWorldBook.entries)
            .sort(([a], [b]) => Number(a) - Number(b));
        const reportPair = [...sorted].reverse().find(([, entry]) =>
            String(entry?.comment || '').trim().toLowerCase() === cleanPeriod
        );
        if (reportPair) {
            const [uid, entry] = reportPair;
            reportId = `${worldBookName}::${uid}`;
            entry.extensions = {
                ...(entry.extensions || {}),
                [WORLD_REPORT_METADATA_KEY]: {
                    reportId,
                    periodLabel,
                    selectedLocations: [...selectedLocations],
                },
            };
            try {
                const response = await fetch('/api/worldinfo/edit', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ name: worldBookName, data: freshWorldBook }),
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
            } catch (error) {
                console.warn('[RPG Tracker] Could not persist World Report routing metadata through the API.', error);
            }
            try { await ctx.saveWorldInfo(worldBookName, freshWorldBook); } catch (_) {}
        }
        const allWorldIds = sorted.map(([uid]) => `${worldBookName}::${uid}`);
        const toActivate = allWorldIds.slice(-keepActive);
        const toDeactivate = allWorldIds.slice(0, Math.max(0, allWorldIds.length - keepActive));

        if (toActivate.length > 0 || toDeactivate.length > 0) {
            // Reload archive after the new entry was written for accurate verification
            const freshArchive = {};
            for (const n of Object.keys(archiveBooks)) {
                try { const b = await ctx.loadWorldInfo(n); if (b?.entries) freshArchive[n] = b; } catch (_) {}
            }
            freshArchive[worldBookName] = freshWorldBook;
            await applyAction({
                activate: toActivate,
                deactivate: toDeactivate,
                reason: `World Progression: rolling window (keep ${keepActive} active)`,
            }, freshArchive, timeStr, '');
        }
    }

    // 9. Advance the timer — only the period label is stored; numeric field is legacy.
    settings.worldProgressionLastFiredPeriodLabel = periodLabel;
    settings.worldProgressionLocationLastAdvanced = stampLocationAdvancement(
        settings.worldProgressionLocationLastAdvanced,
        selectedLocations,
        periodLabel,
    );
    persistWorldProgressionTimer();

    broadcastStep('finish', `\uD83C\uDF0D World Progression: "${periodLabel}" report saved.`);
    if (typeof globalThis._rpgRenderRouterUI === 'function') {
        globalThis._rpgRenderRouterUI();
    }
    return {
        ok: true,
        reportContent: reportContent.trim(),
        periodLabel,
        reportId,
        selectedLocations,
    };
}
// -- World Skeleton ------------------------------------------------------------------

/**
 * Parses the raw LLM output from the skeleton generation pass into macro
 * premise records, grouped by section header (## FACTIONS, ## LOCATIONS, etc.).
 * Returns an array of { label, content, category } objects.
 * @param {string} rawText
 * @returns {Array<{label: string, content: string, category: string}>}
 */
function parseSkeletonOutput(rawText) {
    const categoryMap = {
        'FACTIONS': 'FAC',
        'FACTION': 'FAC',
        'LOCATIONS': 'LOC',
        'LOCATION': 'LOC',
        'CONFLICTS': 'EVENT',
        'CONFLICT': 'EVENT',
        'EVENTS': 'EVENT',
    };

    const records = [];
    const lines = rawText.split('\n');
    
    let currentCategory = null;
    let currentItem = null;

    const sectionRegex = /^##\s+([A-Z]+)/i;
    const subHeaderRegex = /^###\s+(.+)/;
    const listRegexBold = /^\s*(?:[\*\-\d\.\s]*)\s*\*\*(.+?)\*\*\s*[:\-]?\s*(.*)/;
    const listRegexPlain = /^\s*(?:[\*\-\d\.\s]*)\s*([^:\-\n]+)\s*[:\-]\s*(.*)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // 1. Check for ## Section Header
        const secMatch = line.match(sectionRegex);
        if (secMatch) {
            if (currentItem) {
                records.push(currentItem);
                currentItem = null;
            }
            const key = secMatch[1].toUpperCase();
            currentCategory = categoryMap[key] || null;
            continue;
        }

        // Unknown sections — notably the retired NPC/NPCS category emitted by
        // an old custom prompt — are intentionally ignored.
        if (!currentCategory) continue;

        // 2. Check for ### Sub-header
        const subMatch = line.match(subHeaderRegex);
        if (subMatch) {
            if (currentItem) {
                records.push(currentItem);
            }
            currentItem = {
                label: subMatch[1].trim(),
                content: '',
                category: currentCategory
            };
            continue;
        }

        // 3. Bold names are explicit entry titles. A plain `Name: description`
        // line is only a title when no entry is open; otherwise it is ordinary
        // content such as `Parties involved:` or a hyphenated description.
        let listMatch = line.match(listRegexBold);
        if (!listMatch && !currentItem) {
            listMatch = line.match(listRegexPlain);
        }
        if (listMatch) {
            if (currentItem) {
                records.push(currentItem);
            }
            currentItem = {
                label: listMatch[1].trim(),
                content: listMatch[2].trim(),
                category: currentCategory
            };
            continue;
        }

        // 4. Append to existing item content
        if (currentItem) {
            if (trimmedLine) {
                if (currentItem.content) {
                    currentItem.content += ' ' + trimmedLine;
                } else {
                    currentItem.content = trimmedLine;
                }
            }
        }
    }

    if (currentItem) {
        records.push(currentItem);
    }

    // Clean up content strings (collapse multiple spaces, remove quotes)
    for (const rec of records) {
        rec.content = rec.content.replace(/\s+/g, ' ').trim();
        if (rec.content.startsWith('"') && rec.content.endsWith('"')) {
            rec.content = rec.content.slice(1, -1).trim();
        }
        if (rec.content.startsWith("'") && rec.content.endsWith("'")) {
            rec.content = rec.content.slice(1, -1).trim();
        }
    }

    return records.filter(r => r.label && r.content && ['FAC', 'LOC', 'EVENT'].includes(r.category));
}

/**
 * Generates the World Skeleton: a hidden lorebook of foundational undiscovered
 * macro premises (factions, locations, conflicts) seeded from the user's Skeleton Source.
 * Saves all entries to [CampaignPrefix]_Skeleton. Overwrites any existing skeleton.
 *
 * @param {string} atmosphereSummary - User-provided Skeleton Source material (legacy setting name retained)
 * @returns {Promise<number>} Number of skeleton entries created
 */
export async function runSkeletonGenerationPass(atmosphereSummary, append = false, useExisting = true) {
    const settings = getSettings();
    const prefix = getLivePrefix();
    const skeletonBookName = prefix ? `${prefix}_Skeleton` : 'World_Skeleton';

    broadcastStep('thought', `\uD83D\uDDE6 World Skeleton: Generating entries...`);

    const ctx = SillyTavern.getContext();
    let skeletonBook = null;
    if (append) {
        try {
            skeletonBook = await ctx.loadWorldInfo(skeletonBookName);
        } catch (_) {}
    }
    if (!skeletonBook || !skeletonBook.entries) {
        skeletonBook = { entries: {}, name: skeletonBookName, scan_depth: 4, token_budget: 400, recursive: false, extensions: {} };
    }

    const factionCount = settings.worldProgressionSkeletonFactions ?? 4;
    const locationCount = settings.worldProgressionSkeletonLocations ?? 4;
    const conflictCount = settings.worldProgressionSkeletonConflicts ?? 3;
    const atmosphere = (atmosphereSummary || settings.worldProgressionSkeletonAtmosphereSummary || '').trim();

    let systemPrompt = (settings.worldProgressionSkeletonSystemPrompt || '')
        .replace(/\{factionCount\}/g, String(factionCount))
        .replace(/\{locationCount\}/g, String(locationCount))
        .replace(/\{conflictCount\}/g, String(conflictCount));

    systemPrompt += `\n\n## MACRO-ONLY SKELETON CONTRACT (AUTHORITATIVE)
- The World Skeleton contains only FACTIONS, LOCATIONS, and CONFLICTS/EVENTS.
- Never create an NPC/NPCS section or a named-individual skeleton entry.
- Named individuals in source material are canon constraints only. Do not extract, duplicate, or transform them into skeleton entries.
- World Progression advances locations and wider currents; ordinary NPC lore is created by the GM and Lorebook Agent when an individual becomes real in play.`;

    let sourceLorebooksStr = '';
    if (settings.worldProgressionSkeletonUseLorebooks) {
        let sourceBookNames = Array.isArray(settings.worldProgressionSkeletonLorebookFilter)
            ? settings.worldProgressionSkeletonLorebookFilter
            : [];
        if (sourceBookNames.length === 0) {
            sourceBookNames = await getWorldInfoNamesSafe();
        }
        sourceLorebooksStr = await buildSkeletonLorebookSourceContext(
            sourceBookNames,
            bookName => ctx.loadWorldInfo(bookName),
            { lorebookOnly: !!settings.worldProgressionSkeletonLorebookOnly },
        );
        if (settings.worldProgressionSkeletonLorebookOnly) {
            if (!sourceLorebooksStr) {
                throw new Error('Lorebook-only mode is enabled, but the selected source lorebooks contain no usable entries.');
            }
            systemPrompt += `\n\n## LOREBOOK-ONLY MODE — OVERRIDES EXACT COUNTS
Only output factions, locations, and conflicts explicitly mentioned in the supplied lorebook source material. Do not invent, infer, or extrapolate premises. Ignore the requested category counts; output the eligible macro premises established by the source material, and omit an empty category section. Never output named individuals.`;
        }
    }

    // Gather existing entity details to avoid duplication and provide full context
    let existingEntitiesStr = '';
    if (append && useExisting && skeletonBook.entries) {
        const entries = Object.values(skeletonBook.entries)
            .filter(e => e.comment && e.content && ['FAC', 'LOC', 'EVENT'].includes(e.extensions?.rpgCategory));
        if (entries.length > 0) {
            const formattedEntries = entries.map(e => {
                const cleanContent = e.content.replace(/^\[Day 0 Baseline\]\n?/i, '').trim();
                return `### ${e.comment}\n${cleanContent}`;
            }).join('\n\n');
            existingEntitiesStr = `Avoid duplicating these or generating similar premises. Build on top of or expand this context with new, unique macro premises:\n\n${formattedEntries}`;
        }
    }

    let userPrompt = `## SKELETON SOURCE\n${atmosphere || '(No written Skeleton Source provided — use the other supplied source material.)'}\n\n`;
    if (sourceLorebooksStr) {
        userPrompt += `${sourceLorebooksStr}\n\n`;
    }
    if (existingEntitiesStr) {
        userPrompt += `## EXISTING SKELETON PREMISES\n${existingEntitiesStr}\n\n`;
    }
    userPrompt += `Generate ${append ? 'additional' : 'the'} world skeleton ${append ? 'premises' : ''} now.`;

    const routerSettings = {
        connectionSource: settings.worldConnectionSource || 'default',
        connectionProfileId: settings.worldConnectionProfileId,
        completionPresetId: settings.worldCompletionPresetId,
        ollamaUrl: settings.worldOllamaUrl,
        ollamaModel: settings.worldOllamaModel,
        openaiUrl: settings.worldOpenaiUrl,
        openaiKey: settings.worldOpenaiKey,
        openaiModel: settings.worldOpenaiModel,
    };

    let rawOutput;
    try {
        rawOutput = await sendStateRequest(routerSettings, systemPrompt, userPrompt);
    } catch (e) {
        broadcastStep('error', `World Skeleton generation failed: ${e.message}`);
        throw e;
    }
    if (!rawOutput?.trim()) {
        broadcastStep('error', 'World Skeleton: LLM returned empty response.');
        throw new Error('Empty skeleton response');
    }

    const records = parseSkeletonOutput(rawOutput);
    if (records.length === 0) {
        broadcastStep('error', 'World Skeleton: Could not parse any entries from LLM output.');
        throw new Error('No parseable skeleton entries');
    }

    // Determine starting uid for new entries
    let uid = 0;
    if (append && skeletonBook.entries) {
        const keys = Object.keys(skeletonBook.entries).map(Number);
        if (keys.length > 0) {
            uid = Math.max(...keys) + 1;
        }
    }

    for (const rec of records) {
        const prefixMap = { 'FAC': 'FACTION', 'LOC': 'LOCATION', 'EVENT': 'CONFLICT' };
        const typePrefix = prefixMap[rec.category] || 'ENTITY';
        const typePrefixedLabel = `${typePrefix}: ${rec.label}`;

        skeletonBook.entries[uid] = {
            uid,
            key: [], // No keywords to prevent narrative activation
            keysecondary: [],
            comment: typePrefixedLabel,
            content: `[Day 0 Baseline]\n${rec.content}`,
            constant: false, selective: false, selectiveLogic: 0, addMemo: true,
            order: 100, position: 0,
            disable: true, // Always disabled — never injected into narrative context
            probability: 100, useProbability: false,
            depth: 4, group: '', groupOverride: false, groupWeight: 100,
            extensions: { rpgCategory: rec.category, rpgSkeleton: true },
        };
        uid++;
    }

    const saveRes = await fetch('/api/worldinfo/edit', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: skeletonBookName, data: skeletonBook })
    });
    if (!saveRes.ok) {
        broadcastStep('error', `World Skeleton: Failed to save lorebook (HTTP ${saveRes.status})`);
        throw new Error(`Save failed: ${saveRes.status}`);
    }

    // Register book with ST's in-memory registry
    try { await ctx.saveWorldInfo(skeletonBookName, skeletonBook); } catch (_) {}

    // Register in campaignBooks if not already there
    const chatId = typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : null;
    if (chatId && settings.chatStates?.[chatId]) {
        const existing = new Set(settings.chatStates[chatId].campaignBooks || []);
        existing.add(skeletonBookName);
        settings.chatStates[chatId].campaignBooks = [...existing];
        void saveSettings();
    }

    // Refresh the SillyTavern UI so it updates immediately without F5
    if (typeof ctx.executeSlashCommandsWithOptions === 'function') {
        try {
            await new Promise(r => setTimeout(r, 300));
            if (typeof ctx.updateWorldInfoList === 'function') {
                await ctx.updateWorldInfoList();
            }
            await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${skeletonBookName}"`);
            if (typeof ctx.reloadWorldInfoEditor === 'function') {
                ctx.reloadWorldInfoEditor(skeletonBookName, true);
            }
        } catch (uiErr) {
            console.warn('[RPG Tracker] UI refresh after skeleton generation failed:', uiErr);
        }
    } else {
        setTimeout(async () => {
            try {
                if (typeof ctx.updateWorldInfoList === 'function') {
                    await ctx.updateWorldInfoList();
                }
                if (typeof ctx.reloadWorldInfoEditor === 'function') {
                    ctx.reloadWorldInfoEditor(skeletonBookName, true);
                }
            } catch (uiErr) {
                console.warn('[RPG Tracker] UI refresh after skeleton generation failed:', uiErr);
            }
        }, 200);
    }

    broadcastStep('finish', `\uD83D\uDDE6 World Skeleton: ${records.length} entries generated and saved to "${skeletonBookName}".`);
    return records.length;
}

/**
 * Manually consolidates a specific number of raw World Progression reports.
 * @param {number} targetCount - Number of raw reports to consolidate.
 * @returns {Promise<string>} - The consolidated label (e.g., "Days 1-7").
 */
export async function runWorldProgressionConsolidationPass(targetCount) {
    const settings = getSettings();
    const prefix = getLivePrefix();
    const worldBookName = prefix ? `${prefix}_World` : 'World';

    const routerSettings = {
        connectionSource: settings.worldConnectionSource || 'default',
        connectionProfileId: settings.worldConnectionProfileId,
        completionPresetId: settings.worldCompletionPresetId,
        ollamaUrl: settings.worldOllamaUrl,
        ollamaModel: settings.worldOllamaModel,
        openaiUrl: settings.worldOpenaiUrl,
        openaiKey: settings.worldOpenaiKey,
        openaiModel: settings.worldOpenaiModel,
    };

    const ctx = SillyTavern.getContext();
    const allBookNames = await getWorldInfoNamesSafe();
    const archiveBooks = {};
    for (const n of allBookNames) {
        if (prefix && !bookBelongsToPrefix(n, prefix)) continue;
        try {
            const b = await ctx.loadWorldInfo(n);
            if (b?.entries) archiveBooks[n] = b;
        } catch (_) {}
    }

    const currentWorldBook = archiveBooks[worldBookName] ?? null;
    if (!currentWorldBook?.entries) {
        throw new Error(`World lorebook "${worldBookName}" not found or empty.`);
    }

    // Sort entries chronologically by UID
    const allWorldEntries = Object.entries(currentWorldBook.entries)
        .sort(([a], [b]) => Number(a) - Number(b));

    const isRawReport = (label) => {
        if (!/^day\s+\d+/i.test(label)) return false;
        if (/days?\s+\d+\s*[\-\u2013\u2014]\s*\d+/i.test(label)) return false;
        if (/condensed|compressed|merged|summary/i.test(label)) return false;
        return true;
    };

    const rawEntries = allWorldEntries.filter(([, e]) =>
        isRawReport((e.comment || '').trim())
    );

    if (rawEntries.length < 2) {
        throw new Error(`Need at least 2 raw reports to consolidate. Found ${rawEntries.length}.`);
    }

    const countToUse = Math.max(2, Math.min(targetCount || 7, rawEntries.length));
    const toConsolidate = rawEntries.slice(0, countToUse);

    const rawDump = toConsolidate
        .map(([, e]) => `### ${(e.comment || '').trim()}\n${(e.content || '').trim()}`)
        .join('\n\n');

    const dayNums = toConsolidate.map(([, e]) => {
        const m = (e.comment || '').match(/Day\s+(\d+)/i);
        return m ? parseInt(m[1], 10) : null;
    }).filter(n => n !== null);
    const minDay = dayNums.length ? Math.min(...dayNums) : 1;
    const maxDay = dayNums.length ? Math.max(...dayNums) : minDay;
    const consolidatedLabel = (minDay === maxDay)
        ? `Day ${minDay} (Condensed)`
        : `Days ${minDay}\u2013${maxDay}`;

    const consolidationSystemPrompt =
`You are the World Archivist. Compress the following World Progression reports into a single, unified summary while preserving maximum narrative signal.

## RULES
1. Merge all reports into a single coherent, present-tense narrative.
2. Always retain temporal context. The summary MUST begin with the overall period label (e.g. "[${consolidatedLabel}]"). Never remove all temporal markers.
3. Preserve every unique fact — faction developments, NPC actions, location changes, economic shifts, and plot developments. Never replace detailed facts with generic summaries (e.g. writing "Various events occurred" is a critical failure).
4. Eliminate only true redundancies — if the same fact repeats across multiple reports, write it once.
5. Target 40–60% of the combined original token count.
6. Format: dense prose or tight bullet points, no filler, no markdown headers beyond the period label. 1–2 sentences per development.
7. Output ONLY the compressed report content. No preamble, no tags, no meta-commentary.`;

    const consolidationUserPrompt =
`Compress the following ${toConsolidate.length} World Progression reports into a single summary for the period **${consolidatedLabel}**.

${rawDump}`;

    broadcastStep('thought', `\uD83C\uDF0D World Progression: Manually consolidating ${toConsolidate.length} reports into "${consolidatedLabel}"...`);

    const consolidatedContent = await sendStateRequest(routerSettings, consolidationSystemPrompt, consolidationUserPrompt, null, { stream: true, debugSource: 'World Progression' });
    if (!consolidatedContent || !consolidatedContent.trim()) {
        throw new Error("LLM returned an empty response during consolidation.");
    }

    // Reload for fresh write
    let freshBook = null;
    try { freshBook = await ctx.loadWorldInfo(worldBookName); } catch (_) {}
    if (!freshBook?.entries) freshBook = currentWorldBook;

    const allUids = Object.keys(freshBook.entries).map(Number).filter(n => !isNaN(n));
    const nextUid = allUids.length > 0 ? Math.max(...allUids) + 1 : 0;
    freshBook.entries[nextUid] = {
        uid: nextUid,
        key: [],
        keysecondary: [],
        comment: consolidatedLabel,
        content: consolidatedContent.trim(),
        constant: false,
        selective: false, selectiveLogic: 0, addMemo: true,
        order: settings.routerDefaultOrder ?? 100,
        position: settings.routerDefaultPosition ?? 0,
        disable: true,
        probability: 100, useProbability: false,
        depth: settings.routerDefaultDepth ?? 4,
        role: null,
        group: '', groupOverride: false, groupWeight: 100,
    };

    const toDeleteUids = toConsolidate.map(([uid]) => uid);
    for (const uid of toDeleteUids) {
        delete freshBook.entries[uid];
        const fullId = `${worldBookName}::${uid}`;
        settings.activeWorldKeys = (settings.activeWorldKeys || []).filter(k => k !== fullId);
    }

    await fetch('/api/worldinfo/edit', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: worldBookName, data: freshBook })
    });
    try { await ctx.saveWorldInfo(worldBookName, freshBook); } catch (_) {}

    broadcastStep('finish', `\uD83C\uDF0D World Progression: "${consolidatedLabel}" consolidated — ${toDeleteUids.length} raw reports removed.`);
    return consolidatedLabel;
}

/**
 * Generates a generalized single-paragraph Skeleton Source based on a chat lookback.
 * Uses sendStateRequest to execute the generation call.
 * @param {number} lookbackCount
 * @returns {Promise<string>}
 */
export async function runAtmosphereGenerationPass(lookbackCount) {
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const chat = ctx.chat || [];
    if (chat.length === 0) {
        throw new Error('No chat history available to generate Skeleton Source material.');
    }

    // Grab the last lookbackCount messages
    const recentMessages = chat.slice(-lookbackCount);

    // Format them
    const lines = [];
    for (const msg of recentMessages) {
        const sender = msg.name || (msg.is_user ? 'User' : 'Assistant');
        let text = msg.mes || msg.content || '';
        if (Array.isArray(text)) {
            text = text.filter(p => p && p.type === 'text').map(p => p.text || '').join('\n');
        } else if (typeof text !== 'string') {
            text = String(text);
        }
        // Basic cleanup of tracking structures
        text = text.replace(/###\s*STATE MEMO[^]*?(?=\n\[RNG_QUEUE|\n###|\n\[(?!RNG_QUEUE)[A-Z]|$)/i, '');
        text = text.replace(/\[RNG_QUEUE(?:_d100)?\s[^\]]*\][\s\S]*?\[\/RNG_QUEUE(?:_d100)?\][ \t]*\n?/gi, '');
        text = text.replace(/\[[A-Z_]+\][\s\S]*?\[\/[A-Z_]+\]/g, '');
        text = text.replace(/###\s*CURRENT USER INPUT[^\n]*\n?/gi, '');
        text = text.replace(/\[Continue the narrative\]/gi, '');
        text = text.trim();

        if (text) {
            lines.push(`${sender}: ${text}`);
        }
    }

    if (lines.length === 0) {
        throw new Error('No readable chat messages found within the lookback window.');
    }

    const formattedChatHistory = lines.join('\n\n');

    const systemPrompt =
`You are a World Architect. Analyze the provided chat history segment and extract a concise, generalized Skeleton Source for world generation.

## Skeleton Source Definition
A single paragraph describing the world's broad social texture, environment, hierarchy, technology or magic level, recurring tensions, and thematic tone.
- Generalize from the setting rather than copying story entities verbatim.
- Do NOT name or identify player characters, party members, NPCs, factions, institutions, locations, quests, or conflicts from the chat.
- Do NOT list or summarize specific plot events.
- Never turn a party member or current story participant into Skeleton Source material.
- Do not invent facts unsupported by the chat.

Output ONLY the single-paragraph Skeleton Source. No preamble or meta-commentary.`;

    const userPrompt =
`## RECENT CHAT HISTORY
${formattedChatHistory}

Generate the Skeleton Source:`;

    const routerSettings = {
        connectionSource: settings.worldConnectionSource || 'default',
        connectionProfileId: settings.worldConnectionProfileId,
        completionPresetId: settings.worldCompletionPresetId,
        ollamaUrl: settings.worldOllamaUrl,
        ollamaModel: settings.worldOllamaModel,
        openaiUrl: settings.worldOpenaiUrl,
        openaiKey: settings.worldOpenaiKey,
        openaiModel: settings.worldOpenaiModel,
    };

    // Fall back to general settings if world specific settings are empty
    if (routerSettings.connectionSource === 'default') {
        routerSettings.connectionProfileId = settings.connectionProfileId;
        routerSettings.completionPresetId = settings.completionPresetId;
        routerSettings.ollamaUrl = settings.ollamaUrl;
        routerSettings.ollamaModel = settings.ollamaModel;
        routerSettings.openaiUrl = settings.openaiUrl;
        routerSettings.openaiKey = settings.openaiKey;
        routerSettings.openaiModel = settings.openaiModel;
    }

    const rawOutput = await sendStateRequest(routerSettings, systemPrompt, userPrompt);
    if (!rawOutput?.trim()) throw new Error('LLM returned an empty response.');

    // Clean up surrounding quotes/newlines
    let summary = rawOutput.trim();
    if (summary.startsWith('"') && summary.endsWith('"')) {
        summary = summary.slice(1, -1).trim();
    }
    if (summary.startsWith("'") && summary.endsWith("'")) {
        summary = summary.slice(1, -1).trim();
    }

    return summary;
}
