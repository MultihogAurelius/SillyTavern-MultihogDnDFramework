import { getSettings, getEffectiveRouterCampaignPrefix, saveChatState } from './state-manager.js';
import { escapeHtml } from './memo-processor.js';
import { normalizeLocationPath, resolveLocationImageWithMeta, triggerBackgroundLocationGeneration, hasLocationImage, getLinkedPlayerCharacter, isLocationImageGenerating, resolvePortraitSrcForPlayerCharacter } from './portraits.js';
import { resolvePortraitDisplaySrc, lookupCustomPortraitSrc } from './portrait-storage.js';
import { resolveCurrentLocationPath, formatLocationBreadcrumb } from './location-resolver.js';
import { scanRecentOutputForPresentNpcs } from './router.js';

/**
 * Parse current location from recent chat status footer, then memo [TIME] block.
 * @param {string} [memo]
 * @param {object} [ctx] SillyTavern context
 * @returns {string}
 */
export function getCurrentLocationText(memo, ctx) {
    const chatCtx = ctx || SillyTavern.getContext();
    if (chatCtx?.chat?.length) {
        for (let i = chatCtx.chat.length - 1; i >= 0; i--) {
            const msgContent = chatCtx.chat[i]?.mes || chatCtx.chat[i]?.['content'] || '';
            const m = msgContent.match(/\(Location:\s*([^)]+)\)/i);
            if (m) return m[1].trim();
        }
    }
    const locMatch = (memo || '').match(/Location:\s*([^)\n]+)/i);
    return locMatch ? locMatch[1].trim() : '';
}

/**
 * @param {object} ctx
 * @param {object} settings
 * @returns {Promise<string[]>}
 */
export async function loadAllLocationPaths(ctx, settings) {
    const s = settings || getSettings();
    const chatId = ctx?.chatId;
    if (!chatId) return [];

    const prefix = getEffectiveRouterCampaignPrefix(chatId);
    const bookName = prefix ? `${prefix}_Locations` : 'Locations';

    try {
        if (typeof ctx.updateWorldInfoList === 'function') {
            await ctx.updateWorldInfoList();
        }
        const book = await ctx.loadWorldInfo(bookName);
        if (!book?.entries) return [];
        return Object.values(book.entries)
            .map(e => normalizeLocationPath((e.comment || '').trim()))
            .filter(Boolean);
    } catch (err) {
        console.error('[RPG Tracker] loadAllLocationPaths error:', err);
        return [];
    }
}

/**
 * Present Now NPCs from a name scan of the most recent narrator output only.
 * Matches NPC entry labels (first/last name); ignores lorebook key[] keywords.
 * Independent of Lorebook Agent activeRouterKeys (avoids stale characters).
 * @param {object} settings
 * @param {object} ctx
 * @returns {Promise<Array<{ id: string, label: string, portraitSrc: string, entryId: string, content?: string }>>}
 */
export async function loadActiveSceneNpcs(settings, ctx) {
    const s = settings || getSettings();
    const matched = await scanRecentOutputForPresentNpcs();
    return matched.map(m => ({
        id: m.id,
        entryId: m.id,
        label: m.label,
        content: m.content || '',
        portraitSrc: lookupCustomPortraitSrc(s, m.label),
    }));
}

/** @param {string} label */
function normalizeSceneCharacterLabel(label) {
    return String(label || '').replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
}

/**
 * Player Character is always present in Scene View when linked to the chat.
 * @param {Array<{ id: string, label: string, portraitSrc: string, entryId: string, content?: string, isPlayerCharacter?: boolean }>} npcs
 * @param {object} settings
 * @param {object} ctx
 */
function prependPlayerCharacterToSceneNpcs(npcs, settings, ctx) {
    const s = settings || getSettings();
    const pc = getLinkedPlayerCharacter(s, ctx);
    if (!pc) return npcs;
    const pcNorm = normalizeSceneCharacterLabel(pc.name);
    const rest = npcs.filter(n => normalizeSceneCharacterLabel(n.label) !== pcNorm);
    const portraitSrc = resolvePortraitSrcForPlayerCharacter(s, pc.name);
    return [{
        id: 'player-character',
        entryId: '',
        label: pc.name,
        portraitSrc,
        content: pc.bio || '',
        isPlayerCharacter: true,
    }, ...rest];
}

/**
 * @param {string} path
 * @param {object} [settings]
 * @returns {Promise<object|null>}
 */
export async function loadLocationEntryByPath(path, settings) {
    const normPath = normalizeLocationPath(path);
    if (!normPath) return null;

    const s = settings || getSettings();
    const ctx = SillyTavern.getContext();
    const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId);
    const bookName = prefix ? `${prefix}_Locations` : 'Locations';

    try {
        const book = await ctx.loadWorldInfo(bookName);
        if (!book?.entries) return null;
        for (const [uid, entry] of Object.entries(book.entries)) {
            const label = normalizeLocationPath((entry.comment || '').trim());
            if (label !== normPath) continue;
            const fullId = `${bookName}::${uid}`;
            return {
                id: fullId,
                label: entry.comment || label,
                content: entry.content || '',
                keys: entry.key,
                is_active: (s.activeRouterKeys || []).includes(fullId),
                book: bookName,
            };
        }
    } catch (err) {
        console.error('[RPG Tracker] loadLocationEntryByPath error:', err);
    }
    return null;
}

/**
 * @param {string} entryId Book::uid
 * @param {object} [settings]
 * @returns {Promise<object|null>}
 */
export async function loadNpcEntryByKey(entryId, settings) {
    if (!entryId) return null;
    const s = settings || getSettings();
    const ctx = SillyTavern.getContext();
    const [bookName, uid] = entryId.split('::');
    if (!bookName || !uid) return null;

    try {
        const book = await ctx.loadWorldInfo(bookName);
        const entry = book?.entries?.[uid];
        if (!entry) return null;
        return {
            id: entryId,
            label: entry.comment || entry.key?.[0] || uid,
            content: entry.content || '',
            keys: entry.key,
            is_active: (s.activeRouterKeys || []).includes(entryId),
            book: bookName,
        };
    } catch (err) {
        console.error('[RPG Tracker] loadNpcEntryByKey error:', err);
        return null;
    }
}

/**
 * @param {string} memo
 * @param {object} [settings]
 * @returns {Promise<object>}
 */
export async function buildImmersionSceneState(memo, settings) {
    const s = settings || getSettings();
    const ctx = SillyTavern.getContext();

    const rawLocationText = getCurrentLocationText(memo ?? s.currentMemo, ctx);
    const allLocationPaths = await loadAllLocationPaths(ctx, s);

    const activeLocLabels = [];
    const locBooks = {};
    for (const k of s.activeRouterKeys || []) {
        const [bookName, uid] = k.split('::');
        const lower = (bookName || '').toLowerCase();
        if (!lower.endsWith('_locations') && !lower.endsWith('_location') && lower !== 'locations' && lower !== 'location') continue;
        if (!locBooks[bookName]) {
            try {
                locBooks[bookName] = await ctx.loadWorldInfo(bookName);
            } catch {
                locBooks[bookName] = null;
            }
        }
        const entry = locBooks[bookName]?.entries?.[uid];
        const label = normalizeLocationPath((entry?.comment || '').trim());
        if (label) activeLocLabels.push(label);
    }

    const resolvedPath = resolveCurrentLocationPath(rawLocationText, allLocationPaths, {
        activeLocPaths: activeLocLabels,
    });

    const storagePath = resolvedPath || (rawLocationText ? normalizeLocationPath(rawLocationText) : '');

    let locationContent = '';
    if (resolvedPath) {
        const entry = await loadLocationEntryByPath(resolvedPath, s);
        locationContent = entry?.content || '';
    }

    const locationImage = storagePath ? resolveLocationImageWithMeta(storagePath).src : '';
    const locationBreadcrumb = resolvedPath ? formatLocationBreadcrumb(resolvedPath) : '';
    const locationLeaf = resolvedPath ? resolvedPath.split(' :: ').pop() : rawLocationText;

    let npcs = await loadActiveSceneNpcs(s, ctx);
    npcs = prependPlayerCharacterToSceneNpcs(npcs, s, ctx);

    return {
        rawLocationText,
        resolvedPath,
        storagePath,
        locationContent,
        locationImage,
        locationBreadcrumb,
        locationLeaf,
        npcs,
        locationImagesEnabled: !!s.locationImages,
        npcPortraitsEnabled: s.npcPortraits !== false,
        isLocationGenerating: storagePath ? isLocationImageGenerating(storagePath) : false,
    };
}

/**
 * @param {object} scene
 * @returns {string}
 */
export function renderImmersionViewHtml(scene) {
    const {
        rawLocationText,
        resolvedPath,
        locationImage,
        locationBreadcrumb,
        locationLeaf,
        npcs,
        locationImagesEnabled,
        npcPortraitsEnabled,
        isLocationGenerating,
    } = scene;

    const heroInner = locationImage
        ? `<img src="${escapeHtml(locationImage)}" alt="${escapeHtml(locationLeaf || 'Location')}">`
        : `<div class="rt-immersion-hero-placeholder">🗺️</div>`;

    const generatingOverlay = isLocationGenerating
        ? `<div class="rt-immersion-hero-loading" aria-live="polite">
            <i class="fa-solid fa-spinner fa-spin rt-immersion-hero-spinner" aria-hidden="true"></i>
            <span>Generating scene…</span>
        </div>`
        : '';

    const locTitle = resolvedPath
        ? escapeHtml(locationLeaf || resolvedPath)
        : escapeHtml(rawLocationText || 'Unknown Location');

    const breadcrumbHtml = resolvedPath && locationBreadcrumb
        ? `<div class="rt-immersion-breadcrumb">${escapeHtml(locationBreadcrumb)}</div>`
        : (rawLocationText
            ? `<div class="rt-immersion-breadcrumb rt-immersion-breadcrumb-unresolved" title="No matching lore path">${escapeHtml(rawLocationText)}</div>`
            : '');

    const locDataAttrs = scene.storagePath
        ? `data-loc-path="${escapeHtml(scene.storagePath)}"`
        : `data-loc-raw="${escapeHtml(rawLocationText || '')}"`;

    const npcTiles = npcs.length > 0
        ? npcs.map(npc => {
            const thumb = (npcPortraitsEnabled && npc.portraitSrc)
                ? `<img src="${escapeHtml(npc.portraitSrc)}" alt="">`
                : `<span class="rt-immersion-npc-placeholder">👤</span>`;
            const pcClass = npc.isPlayerCharacter ? ' rt-immersion-npc-tile-pc' : '';
            const dataAttrs = npc.isPlayerCharacter
                ? 'data-is-pc="1"'
                : `data-npc-entry-id="${escapeHtml(npc.entryId)}"`;
            return `<button type="button" class="rt-immersion-npc-tile${pcClass}" ${dataAttrs} title="${escapeHtml(npc.label)}${npc.isPlayerCharacter ? ' (Player Character)' : ''}">
                <div class="rt-immersion-npc-thumb">${thumb}</div>
                <div class="rt-immersion-npc-name">${escapeHtml(npc.label)}</div>
            </button>`;
        }).join('')
        : `<div class="rt-immersion-empty">No player character linked and no NPCs named in the latest narrator output.</div>`;

    return `<div class="rt-immersion-root">
        ${locationImagesEnabled ? `
        <div class="rt-immersion-hero-wrap${isLocationGenerating ? ' rt-immersion-hero-generating' : ''}" ${locDataAttrs} role="button" tabindex="0" title="${isLocationGenerating ? 'Generating scene art…' : (locationImage ? 'View location' : 'Set location image')}">
            ${heroInner}
            ${generatingOverlay}
            <div class="rt-immersion-hero-overlay">
                <div class="rt-immersion-hero-title">${locTitle}</div>
                ${breadcrumbHtml}
            </div>
        </div>` : `
        <div class="rt-immersion-loc-text-only">
            <div class="rt-immersion-hero-title">${locTitle}</div>
            ${breadcrumbHtml}
        </div>`}
        <div class="rt-immersion-section-label">Present now</div>
        <div class="rt-immersion-npc-grid">${npcTiles}</div>
    </div>`;
}

/**
 * Real-Time Mode: auto-generate a hero image when arriving at the current scene location.
 * Skipped when Real-Time Mode (portraitAutoGenerateSceneView) is off.
 * @param {object} scene From buildImmersionSceneState
 * @param {() => void} [refresh]
 */
let _lastImmersionSceneArtPath = null;

const _lastLocSessionKey = (chatId) => `rpg_rt_last_loc_${chatId || 'default'}`;

function getActiveChatId() {
    return typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : null;
}

function readPersistedImmersionSceneArtPath(chatId) {
    if (!chatId) return null;
    const fromChat = getSettings().chatStates?.[chatId]?.lastImmersionSceneArtPath;
    if (fromChat) return fromChat;
    try {
        return sessionStorage.getItem(_lastLocSessionKey(chatId));
    } catch {
        return null;
    }
}

function persistImmersionSceneArtPath(chatId, path) {
    if (!chatId) return;
    const s = getSettings();
    if (!s.chatStates) s.chatStates = {};
    if (!s.chatStates[chatId]) s.chatStates[chatId] = {};
    if (path) {
        s.chatStates[chatId].lastImmersionSceneArtPath = path;
    } else {
        delete s.chatStates[chatId].lastImmersionSceneArtPath;
    }
    try {
        if (path) sessionStorage.setItem(_lastLocSessionKey(chatId), path);
        else sessionStorage.removeItem(_lastLocSessionKey(chatId));
    } catch { /* ignore */ }
    if (s.chatLinkEnabled) saveChatState(chatId);
}

function getLastImmersionSceneArtPath() {
    if (_lastImmersionSceneArtPath) return _lastImmersionSceneArtPath;
    return readPersistedImmersionSceneArtPath(getActiveChatId());
}

function rememberImmersionSceneArtPath(storagePath) {
    if (!storagePath || _lastImmersionSceneArtPath === storagePath) return;
    _lastImmersionSceneArtPath = storagePath;
    persistImmersionSceneArtPath(getActiveChatId(), storagePath);
}

/** Restore visit tracking after F5 / loadChatState (avoids treating reload as a new arrival). */
export function hydrateImmersionSceneArtPath(chatId) {
    _lastImmersionSceneArtPath = readPersistedImmersionSceneArtPath(chatId) || null;
}

/** Clear visit tracking when switching to a chat with no saved state. */
export function resetImmersionSceneArtTracking() {
    _lastImmersionSceneArtPath = null;
}

export function maybeAutoGenerateImmersionSceneArt(scene, refresh) {
    const s = getSettings();
    if (!s.portraitAutoGenerateSceneView) return;
    if (!s.locationImages || s.enablePortraits === false) return;

    const storagePath = scene?.storagePath;
    if (!storagePath) return;

    const lastPath = getLastImmersionSceneArtPath();
    const locationChanged = storagePath !== lastPath;
    const hasImage = !!(scene.locationImage || hasLocationImage(storagePath));

    // Real-Time Mode always regenerates on arrival (including revisits to the same path).
    if (!locationChanged && hasImage) {
        return;
    }

    rememberImmersionSceneArtPath(storagePath);
    triggerBackgroundLocationGeneration(storagePath, refresh, scene.locationContent || '', {
        realtimeArrival: true,
        forceReplace: hasLocationImage(storagePath),
    });
}
