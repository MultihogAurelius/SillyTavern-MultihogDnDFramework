import { EXAMPLES, COLOR_EXAMPLES, DEFAULT_STOCK_PROMPTS, RT_PROMPTS, BLOCK_ICONS, BLOCK_ORDER, PAGE_SIZE, NO_PAGINATE, buildOnboardingXpHint, buildOnboardingTimeHint, buildStartingGearHint, buildOnboardingActiveBlocks, buildCombatAndSkillScalingHint, resolveTimePromptKey, resolveTimePromptDisplayTag, buildCyoaPrompt, DEFAULT_CYOA_SLOTS, refreshCyoaConfigToShipped } from './constants.js';
import { MODULE_NAME, DEFAULT_MODULES, getSettings, getBarBackground, migrateCustomFields, saveChatState, writeModuleSchemaBackup, getPendingModuleSchemaBackup, applyModuleSchemaBackup, applyDeletedCustomTagTombstones, recordDeletedCustomTags, clearDeletedCustomTagTombstones, saveProfile, deleteProfile, getEffectiveRouterCampaignPrefix, sanitizeCampaignPrefixString, buildNpcInstruction, loadStockPromptsFromProfile, getNpcRelationshipMax, getNpcRelationshipMaxDefault, clampRelationshipValue, relationshipBarPct, getFriendshipTier, getAffectionTier, getRelTierBadgeStyle, getRelTierDetailedStyle, getRelTierDetailedLabelStyle, applyRelTierBadgeElement, sanitizeRouterState, rebuildAllModuleInstructions, adjustAllStoredTemplatesForTimeFormat, DEFAULT_NPC_SECTIONS, DEFAULT_PC_SECTIONS, computeBundledPromptsFingerprint, computeBundledPromptsFingerprintForSnapshot, normalizeBundledPromptsSnapshot, buildBundledPromptsSnapshot, getSnapshotCategoryBlocks, getPromptCategoryImpactBadge, PROMPT_DEFAULTS_CATEGORIES, PROMPT_DEFAULTS_CATEGORY_LABELS, getDefaultPortraitLocationSystemPrompt, isShippedPortraitLocationSystemPrompt, applyFactoryReset, clearExtensionLocalStorageUiState, stripChatStateGlobalUiPrefs, buildStateTrackerRelationshipCommandInstruction, extractStateTrackerRelationshipCommands, getRelationshipUpdateMode, RELATIONSHIP_UPDATE_MODES } from './state-manager.js';
import { diffTextLines, diffHasChanges } from './prompt-diff.js';
import { sendStateRequest, fetchOllamaModels, fetchOpenAIModels, testOpenAIConnection, getConnectionProfiles, getCurrentCompletionPreset, setCompletionPreset, syncCombatProfile, resetCombatProfileOverride, isCombatActive } from './llm-client.js';
import { getDiceToolName, getDiceCommandName, getDiceCommandAliases, doDiceRoll, registerDiceFunctionTool, syncDiceFunctionToolForRngContext, registerDiceSlashCommand, installInterceptor, getNarrativeBlocks, onGenerationStarted, onGenerationEnded, handleRelationshipSwipeChange, applyStateTrackerRelationshipCommands, resetRouterTick, getRouterTick, resetRouterAutoTick, getRouterSchedulerInternals, makeRngQueue, buildRngBlock, RNG_QUEUE_LEN } from './narrative-hooks.js';
import { deduplicateMemo, mergeMemo, computeDelta, escapeHtml, escapeRegex, highlightParens, cleanToolCallMessage, cleanMessageContent, getLastUserAction, buildLorebookContext, buildModulesInstructionText, buildModuleFormatInstruction, parseQuestsFromMemo, syncQuestsFromMemo, syncQuestsToMemo, writeQuestsToMemo, getQuestMood, extractCurrentTimeStr, stripArchivedQuestsFromMemo, stripCompletedQuestsFromMemo, applyQuestSyncAndStripMemo, isArchivedQuestStatus, removeArchivedQuest, parseInWorldTime, formatInWorldTime, sanitizeLorebookRecordContent, memoForTrackerContext, memoForGmContext } from './memo-processor.js';
import { renderSubFieldByRule, tryRenderMarker, renderCustomBlockLine, stripMemoHtml, escapeHtmlWithColor, parseMemoBlocks, getPageSize, loadCollapsed, saveCollapsed, loadDetached, saveDetached, blockToItems, renderMemoAsCards, renderTabModeView, renderQuestLog, renderLorebookTerminal, loadActiveTab, saveActiveTab, getTimeOfDayInfo, renderDayNightBadge, MARKER_TYPE_MAP, getMarkerLibraryKeys, loadBenchedExpanded, saveBenchedExpanded } from './renderer.js';
import { unregisterLogQuestTool, checkQuestDeadlines, renderQuestsAsPlainText } from './quests.js';
import { initializeDebugViewer, toggleDebugViewer } from './debug-viewer.js';
import { installSwipeSchedulerDebug } from './swipe-scheduler-debug.js';
import { runRouterPass, rollbackRouterPass, reapplyRouterPass, getLorebookManifest, deleteLorebookEntry, updateLorebookEntry, disableManagedEntries, isRouterRunning, stopRouterPass, purgeWorldHistoryForChat } from './router.js';
import { getRequestHeaders } from '../../../../script.js';
import { fileToDataUrl, scaleImageTo512Square, scaleImageToLandscape, applyPortraitData, applyLocationImageData, renamePortraitEntity, reconcileMemoPortraitRenames, generatePortraitPrompt, generateNpcPortraitPrompt, generateLocationImagePrompt, showPortraitPromptPopup, generatePortraitDirect, autoGeneratePartyPortraits, removeAllPortraits, checkAndTriggerAutoGenerations, autoGenerateEnemyPortraits, forceCheckAutoGenerations, resetAutoGenerationTracking, resolveLocationImageWithMeta, normalizeLocationPath, buildLocationPath, getLinkedPlayerCharacter, resolvePortraitSrcForPlayerCharacter, imageGenToast } from './portraits.js';
import { buildImmersionSceneState, renderImmersionViewHtml, getCurrentLocationText, loadLocationEntryByPath, loadNpcEntryByKey, maybeAutoGenerateImmersionSceneArt, runRealtimeSceneArtCheck, resetImmersionSceneArtTracking, hydrateImmersionSceneArtPath } from './immersion.js';
import { migrateAllEmbeddedPortraits, countEmbeddedPortraitDataUrls, purgeAllPortraitData, resolvePortraitDisplaySrc, lookupCustomPortraitSrc, collectAllPortraitRefs, isManagedPortraitPath, isPortraitMigrationLocked, setPortraitMigrationLocked, PORTRAIT_STORAGE_FOLDER } from './portrait-storage.js';
import { loadPanelGeometry, loadDeltaHeight, makeDraggable, makeResizableTR, makeResizableBR, makeResizableBL, setupResizeObserver, setupDeltaResize, canResizePanels, jqueryToggleSlide } from './ui-geometry.js';
import { applyCustomTheme, openThemeWizard, refreshSavedThemesList, handleRecolor, undoThemeChange } from './theme-manager.js';
import { showCharacterRollPanel, showPcImportPanel, handleCharacterCreatorGenerate, generatePersonaBio, showPersonaConfirmOverlay, extractCharNameFromMemo } from './character-creator.js';
import { bindQuickStartEvents } from './quickstart.js';
import { handleCategorySettings, openCustomFieldEditor, openPromptEditor, refreshOrderList, exportModules, importModulesFromJson, openNpcSectionEditor, openPcSectionEditor } from './ui-editors.js';
import { openGameSystemWizard, openManageGameSystems, openSystemPromptControlRoom, syncAllNarratorTogglesForUnlockState, extractTopLevelSections, normalizeSectionOrder, getSectionRowDescriptor, transformBaseSectionContent, isBlankSectionContent, isSectionUnlocked } from './game-systems.js';
import { openManageGameCartridges, promptAndSaveCurrentAsCartridge } from './game-cartridges.js';
import { RENDERING_TAGS_LIBRARY, sectionPages, configureRuntimeActions } from './src/app/runtime-bridge.js';
import { bindRenderedCardEvents } from './src/ui/panel/card-events.js';
import { createDetachedPanel } from './src/ui/panel/detached-panel.js';
import { scalePanelBackgroundImage, getPanelBgConfig, applyPanelBackgroundToDom, applyTrackerThemeToDom, PANEL_BG_TRACKER_KEYS, PANEL_BG_AGENT_KEYS } from './src/ui/panel/panel-appearance.js';
import { createMemoRecoveryManager } from './src/features/recovery/memo-recovery.js';
import { runtimeState } from './src/app/runtime-state.js';
import { createPanel as buildPanel } from './src/ui/panel/panel-builder.js';
import { createChatStateLoader } from './src/features/chat/chat-state-loader.js';
import { restoreEscapedCyoaChoiceMarkup } from './src/ui/panel/cyoa-markup.js';

export { RENDERING_TAGS_LIBRARY };
export { bindRenderedCardEvents };
export { applyPanelBackgroundToDom, applyTrackerThemeToDom };
RENDERING_TAGS_LIBRARY.push(...getMarkerLibraryKeys().map(key => `((${key})) ${MARKER_TYPE_MAP[key].example}`));

// Capture the folder name dynamically from the module URL so it works regardless of what the user names the folder
export const FOLDER_NAME = (function () {
    try {
        const urlObj = new URL(import.meta.url);
        const parts = urlObj.pathname.split('/');
        const idx = parts.indexOf('third-party');
        if (idx !== -1 && idx + 1 < parts.length) {
            return decodeURIComponent(parts[idx + 1]);
        }
    } catch (e) { }
    return 'SillyTavern-MultihogDnDFramework';
})();

let _prefixDeriveTimer = null; // Pending CHAT_CHANGED → prefix-derivation timer
/** Set during init BOOTSTRAP so the immediate CHAT_CHANGED does not repeat /world scans. */
let _sessionBootstrapChatId = null;
let _bootstrapSyncPromise = null;

// Legacy browser-local recovery remains in the source tree for possible future use,
// but is deliberately inactive. It must never compare, restore, or override the disk
// state during normal operation.
const LEGACY_LOCAL_RECOVERY_ENABLED = false;
const memoRecovery = LEGACY_LOCAL_RECOVERY_ENABLED ? createMemoRecoveryManager({
    getSettings,
    saveSettings: (...args) => saveSettings(...args),
    updateUIMemo: (...args) => updateUIMemo(...args),
    refreshRenderedView: (...args) => refreshRenderedView(...args),
    syncMemoView: (...args) => syncMemoView(...args),
    escapeHtml,
}) : null;
const snapshotMemoToLocalStorage = (...args) => memoRecovery?.snapshotMemoToLocalStorage(...args);
const ensureLocalMemoRecovery = (...args) => memoRecovery?.ensureLocalMemoRecovery(...args);
const confirmLocalSettingsRecovery = (...args) => memoRecovery?.confirmLocalSettingsRecovery(...args);
const markMemoPersistedByCurrentBrowser = (...args) => memoRecovery?.markMemoPersistedByCurrentBrowser(...args);

let _pillDeselectHandler = null;
globalThis._rpgRenderRouterUI = () => { if (typeof runtimeState.renderRouterUI === 'function') runtimeState.renderRouterUI(); };
/** Rebuilds CAMPAIGN RECORDS; assigned in createPanel when the agent panel is wired. */
globalThis._rpgRefreshImmersionView = () => { void runtimeState.refreshImmersionView(); };
globalThis._rpgCheckRealtimeSceneArt = () => { void runRealtimeSceneArtCheck().catch(() => {}); };
globalThis._rpgRefreshAgentManifest = async () => { if (typeof runtimeState.refreshAgentManifest === 'function') await runtimeState.refreshAgentManifest(); };
/** Refreshes the NPC card grid; assigned in createPanel so module-level code can call it. */

// Combined refresh: updates both the tracker panel and the Lorebook Terminal NPC grid.
// Used as the refresh callback for NPC-aware auto-generation.
const refreshAll = () => {
    refreshRenderedView();
    if (typeof runtimeState.refreshNpcManifest === 'function') {
        void runtimeState.refreshNpcManifest().catch(() => { });
    }
};

/** Compact colored tier badge (e.g. "FRIENDLY") — hint shown as a tooltip. Used in NPC grid cards. */
function renderRelTierBadge(type, value, max) {
    const tier = type === 'friendship' ? getFriendshipTier(value, max) : getAffectionTier(value, max);
    return `<span class="rt-npc-tier-badge ${type}" style="${getRelTierBadgeStyle(type, value, max)}" title="${escapeHtml(tier.hint)}">${escapeHtml(tier.label)}</span>`;
}

/** Row of both tier badges (friendship + affection) for the NPC grid card. */
function renderRelTierRow(friendshipVal, affectionVal, max) {
    return `<div class="rt-npc-tier-row">${renderRelTierBadge('friendship', friendshipVal, max)}${renderRelTierBadge('affection', affectionVal, max)}</div>`;
}

/** Full "Friendship tier: FRIENDLY — genuine warmth..." block with visible hint text. Used in the NPC detail popup. */
function renderRelTierDetailed(type, value, max) {
    const tier = type === 'friendship' ? getFriendshipTier(value, max) : getAffectionTier(value, max);
    const axisLabel = type === 'friendship' ? 'Friendship' : 'Affection';
    return `<div class="rt-npc-tier-detailed ${type}" style="${getRelTierDetailedStyle(type, value, max)}">
        <span class="rt-npc-tier-detailed-label" style="${getRelTierDetailedLabelStyle(type, value, max)}">${axisLabel} tier: ${escapeHtml(tier.label)}</span>
        <span class="rt-npc-tier-detailed-hint">— ${escapeHtml(tier.hint)}</span>
    </div>`;
}

function isAgentPanelVisible() {
    const el = document.getElementById('rpg-tracker-agent');
    if (!el) return false;
    const isDetached = localStorage.getItem('rpg_tracker_agent_detached') === 'true';
    if (isDetached) return el.style.display !== 'none';
    const s = getSettings();
    return s.trackerContentMode === 'agent';
}

function scheduleDeferred(fn) {
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => { void fn(); }, { timeout: 2500 });
    } else {
        setTimeout(() => { void fn(); }, 0);
    }
}

/** Refresh CAMPAIGN RECORDS only when the Lorebook Agent panel is open (avoids heavy load on F5). */
function scheduleAgentManifestRefresh(force = false) {
    if (!force && !isAgentPanelVisible()) return;
    void runtimeState.refreshAgentManifest().catch(() => { });
}

/** Reload CAMPAIGN RECORDS / Scene View — safe from settings UI outside createPanel(). */
export async function refreshAgentManifestNow() {
    await refreshLorebookAgentViewsNow();
}


/** Confirms then wipes World/Skeleton lorebooks + per-chat WP timer state for the active prefix. */
async function confirmAndPurgeWorldHistory() {
    const ctx = SillyTavern.getContext();
    const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
    const worldBook = prefix ? `${prefix}_World` : 'World';
    const skeletonBook = prefix ? `${prefix}_Skeleton` : 'World_Skeleton';
    const { Popup } = SillyTavern.getContext();
    const body = `
        <div style="text-align:left; font-size:13px; line-height:1.5;">
            <p>This permanently deletes World Progression data tied to the <b>current campaign prefix</b> (<code>${escapeHtml(prefix || 'none')}</code>):</p>
            <ul style="margin:8px 0; padding-left:20px;">
                <li>All reports in <code>${escapeHtml(worldBook)}</code></li>
                <li>All skeleton entities in <code>${escapeHtml(skeletonBook)}</code> (removes stale DESIGNATED ENTITIES from prior stories)</li>
                <li>Per-chat timer state and active world report keys for this chat</li>
                <li>Saved atmosphere summary for this chat</li>
            </ul>
            <p style="opacity:0.85;"><b>Note:</b> Lorebooks are stored per campaign prefix, not per chat file. If another chat shares this prefix, it will also lose this World/Skeleton data.</p>
        </div>`;
    const choice = await Popup.show.confirm('Purge World History for this Chat?', body, { okButton: 'Purge', cancelButton: 'Cancel' });
    if (choice !== 1) return;
    try {
        const result = await purgeWorldHistoryForChat({ includeSkeleton: true });
        if (typeof runtimeState.updateWorldProgressionLastFiredDisplayRef === 'function') {
            runtimeState.updateWorldProgressionLastFiredDisplayRef();
        }
        if (typeof runtimeState.updateAgentWorldStatusRef === 'function') runtimeState.updateAgentWorldStatusRef();
        if (typeof globalThis._rpgUpdateSkeletonStatus === 'function') {
            await globalThis._rpgUpdateSkeletonStatus().catch(() => { });
        }
        scheduleAgentManifestRefresh(true);
        toastr['success'](`Purged ${result.worldCleared} report(s) and ${result.skeletonCleared} skeleton entries.`, 'World Progression');
    } catch (e) {
        toastr['error'](`Purge failed: ${e.message}`, 'World Progression');
    }
}

/** Last lorebook /world sync diagnostics (JSON-serializable). */
let _loreActivationDebugLast = /** @type {Record<string, any>|null} */ (null);

/**
 * Updates the Lorebook Agent debug <pre> if the panel exists.
 */
function renderLoreActivationDebugPanel() {
    const pre = document.getElementById('rpg_tracker_lore_activation_debug_pre');
    if (!pre) return;
    if (!_loreActivationDebugLast) {
        pre.textContent = '(no data yet — use Capture now in Extension Settings > Lorebook Agent, or switch chats / Activate Books.)';
        return;
    }
    try {
        pre.textContent = JSON.stringify(_loreActivationDebugLast, null, 2);
    } catch (_) {
        pre.textContent = String(_loreActivationDebugLast);
    }
}

function sleepMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST /api/settings/get — returns world_names from JSON (diagnostic + fallback when ST client cache is empty).
 */
async function probeSettingsWorldNamesApi() {
    try {
        const result = await fetch('/api/settings/get', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({}),
        });
        const status = result.status;
        const ok = result.ok;
        let names = [];
        if (ok) {
            try {
                const data = await result.json();
                if (Array.isArray(data?.world_names)) names = [...data.world_names];
            } catch (_) { /* ignore */ }
        }
        return { ok, status, count: names.length, names };
    } catch (e) {
        return { ok: false, status: 0, count: 0, names: [], fetchError: String(e?.message || e) };
    }
}

/**
 * Retries updateWorldInfoList, then compares client getWorldInfoNames vs API world_names.
 * @param {{ maxAttempts?: number, delayMs?: number }} [opts]
 */
async function refreshWorldInfoRegistry(opts = {}) {
    const maxAttempts = opts.maxAttempts ?? 1;
    const delayMs = opts.delayMs ?? 160;
    const ctx = SillyTavern.getContext();
    const attempts = [];
    let clientCount = 0;
    for (let i = 0; i < maxAttempts; i++) {
        let stError = null;
        if (typeof ctx.updateWorldInfoList === 'function') {
            try {
                await ctx.updateWorldInfoList();
            } catch (e) {
                stError = String(e?.message || e);
            }
        } else {
            stError = 'updateWorldInfoList missing';
        }
        let lastNames = [];
        if (typeof ctx.getWorldInfoNames === 'function') {
            try {
                lastNames = ctx.getWorldInfoNames();
            } catch (e) {
                stError = stError || String(e?.message || e);
            }
        }
        clientCount = Array.isArray(lastNames) ? lastNames.length : 0;
        attempts.push({ attempt: i + 1, clientWorldNameCount: clientCount, stError });
        if (clientCount > 0) break;
        if (i < maxAttempts - 1) await sleepMs(delayMs);
    }
    const apiProbe = await probeSettingsWorldNamesApi();
    const usedApiNameFallback = clientCount === 0 && apiProbe.ok && apiProbe.count > 0 && Array.isArray(apiProbe.names) && apiProbe.names.length > 0;
    return {
        clientWorldNameCount: clientCount,
        attempts,
        apiProbe,
        usedApiNameFallback,
    };
}

/**
 * @param {any} ctx
 * @param {{ clientWorldNameCount: number, apiProbe: { ok: boolean, names: string[] }, usedApiNameFallback: boolean }} reg
 */
function resolveAllWorldNames(ctx, reg) {
    if (reg.clientWorldNameCount > 0 && typeof ctx.getWorldInfoNames === 'function') {
        const n = ctx.getWorldInfoNames();
        return Array.isArray(n) ? [...n] : [];
    }
    if (reg.usedApiNameFallback && Array.isArray(reg.apiProbe.names)) return [...reg.apiProbe.names];
    if (typeof ctx.getWorldInfoNames === 'function') {
        const n = ctx.getWorldInfoNames();
        return Array.isArray(n) ? [...n] : [];
    }
    return [];
}

/**
 * @param {string[]} allNames
 * @param {string} currentPrefix
 * @param {string[]} bookNames
 * @param {Record<string, any>} s
 * @returns {{ toDeactivate: string[], otherPrefixes: string[], managedOffCount: number, crossChatMatchCount: number }}
 */
function computeWorldsToDeactivate(allNames, currentPrefix, bookNames, s) {
    const currentSet = new Set(bookNames);
    const allKnownManagedBooks = new Set(
        Object.values(s.chatStates || {}).flatMap(cs => cs.campaignBooks || [])
    );
    const managedOff = [...allKnownManagedBooks].filter(n => !currentSet.has(n));

    const otherPrefixes = [...new Set(
        Object.keys(s.chatStates || {})
            .map(cid => getEffectiveRouterCampaignPrefix(cid))
            .filter(p => p && p !== currentPrefix)
    )];
    const otherSet = new Set(otherPrefixes);
    const crossChatOff = allNames.filter(n =>
        [...otherSet].some(op => bookBelongsToPrefix(n, op))
    );
    const combined = [...managedOff, ...crossChatOff].filter(n => !currentSet.has(n));
    const toDeactivate = [...new Set(combined)];
    const managedSet = new Set(managedOff);
    const crossChatOnlyCount = crossChatOff.filter(n => !managedSet.has(n)).length;
    return {
        toDeactivate,
        otherPrefixes,
        managedOffCount: managedOff.length,
        crossChatMatchCount: crossChatOnlyCount,
    };
}

/**
 * Read-only snapshot of chat id, prefixes, ST APIs, and which books would match (no slash commands).
 * @param {string} source
 * @returns {Promise<Record<string, any>>}
 */
async function readLoreActivationDebugSnapshot(source) {
    const ctx = SillyTavern.getContext();
    const s = getSettings();
    const paramChatId = runtimeState.currentChatId || ctx.chatId || '';
    const ctxChatId = ctx.chatId || '';
    const derivedFromChatOnly = sanitizeCampaignPrefixString(paramChatId);
    const overrideRaw = (s.routerCampaignPrefixOverride || '').trim();
    const effectivePrefix = getEffectiveRouterCampaignPrefix(paramChatId);
    const storedPrefix = (s.routerCampaignPrefix || '').trim();

    const reg = await refreshWorldInfoRegistry();
    const allNames = resolveAllWorldNames(ctx, reg);

    const matchingEffective = effectivePrefix ? allNames.filter(n => bookBelongsToPrefix(n, effectivePrefix)) : [];
    const matchingForStored = storedPrefix ? allNames.filter(n => bookBelongsToPrefix(n, storedPrefix)) : [];
    const matchingDerivedOnly = derivedFromChatOnly ? allNames.filter(n => bookBelongsToPrefix(n, derivedFromChatOnly)) : [];
    const allKnownManagedBooks = new Set(
        Object.values(s.chatStates || {}).flatMap(cs => cs.campaignBooks || [])
    );
    const toDeactivateForStored = storedPrefix
        ? [...allKnownManagedBooks].filter(n => !matchingForStored.includes(n))
        : [...allKnownManagedBooks];
    return {
        ts: new Date().toISOString(),
        source,
        routerEnabled: !!s.routerEnabled,
        chatLinkEnabled: !!s.chatLinkEnabled,
        paramChatId,
        ctxChatId,
        chatIdMismatch: paramChatId !== ctxChatId,
        overrideRaw: overrideRaw || '(none)',
        derivedFromChatIdOnly: derivedFromChatOnly || '(empty)',
        effectivePrefix: effectivePrefix || '(empty)',
        storedPrefix: storedPrefix || '(empty)',
        bookMatchRule: 'Book matches if name === prefix OR name === prefix + "_" + single segment (no extra underscores in suffix).',
        apis: {
            executeSlashCommandsWithOptions: typeof ctx.executeSlashCommandsWithOptions,
            updateWorldInfoList: typeof ctx.updateWorldInfoList,
            getWorldInfoNames: typeof ctx.getWorldInfoNames,
            addPromptManagerInterceptor: typeof ctx.addPromptManagerInterceptor,
        },
        worldRegistry: reg,
        allWorldNamesCount: allNames.length,
        matchingForEffectivePrefix: matchingEffective,
        matchingForStoredPrefix: matchingForStored,
        matchingForDerivedFromChatOnly: matchingDerivedOnly,
        managedBooksInChatStates: [...allKnownManagedBooks],
        wouldDeactivateForStoredPrefix: toDeactivateForStored,
        priorSlashLog: _loreActivationDebugLast?.slashLog ?? null,
    };
}

/**
 * Re-runs the same prefix + chatStates + /world pipeline as CHAT_CHANGED (debounced handler),
 * without waiting 800ms. For troubleshooting ST worlds not toggling.
 * @param {string} newChatId
 * @param {string} source
 */
async function syncCampaignPrefixAndWorldsForChat(newChatId, source) {
    const s2 = getSettings();
    if (!newChatId) {
        _loreActivationDebugLast = {
            ts: new Date().toISOString(),
            source,
            stopped: 'empty chat id',
        };
        renderLoreActivationDebugPanel();
        return;
    }
    if (!s2.routerEnabled) {
        _loreActivationDebugLast = {
            ts: new Date().toISOString(),
            source,
            newChatId,
            stopped: 'routerDisabled (Lorebook Agent off - no prefix/world sync)',
        };
        renderLoreActivationDebugPanel();
        return;
    }
    const prefix = getEffectiveRouterCampaignPrefix(newChatId);
    if (!prefix) {
        s2.routerCampaignPrefix = '';
        syncRouterPrefixDisplays('');
        void scheduleAgentManifestRefresh();
        _loreActivationDebugLast = {
            ts: new Date().toISOString(),
            source,
            newChatId,
            stopped: 'noPrefixFromChatId (transient rename or empty derive)',
            derivedPrefix: '',
        };
        renderLoreActivationDebugPanel();
        return;
    }
    s2.routerCampaignPrefix = prefix;
    syncRouterPrefixDisplays(prefix);

    const ctx = SillyTavern.getContext();
    const reg = await refreshWorldInfoRegistry();
    const allNames = resolveAllWorldNames(ctx, reg);
    const worldBookName = prefix ? `${prefix}_World` : 'World';
    let matchingBooks = allNames.filter(n => bookBelongsToPrefix(n, prefix));
    if (s2.worldProgressionEnabled) {
        if (allNames.includes(worldBookName) && !matchingBooks.includes(worldBookName)) {
            matchingBooks.push(worldBookName);
        }
        try {
            const worldBook = await ctx.loadWorldInfo(worldBookName);
            if (worldBook?.entries) {
                const sorted = Object.entries(worldBook.entries)
                    .sort(([a], [b]) => Number(a) - Number(b));
                const allWorldIds = sorted.map(([uid]) => `${worldBookName}::${uid}`);
                const keepActive = s2.worldProgressionKeepActive || 1;
                s2.activeWorldKeys = allWorldIds.slice(-keepActive);
            } else {
                s2.activeWorldKeys = [];
            }
        } catch (_) {
            s2.activeWorldKeys = [];
        }
    } else {
        matchingBooks = matchingBooks.filter(n => n !== worldBookName);
        s2.activeWorldKeys = [];
    }

    if (!s2.chatStates) s2.chatStates = {};
    if (!s2.chatStates[newChatId]) s2.chatStates[newChatId] = {};
    s2.chatStates[newChatId].campaignBooks = matchingBooks;
    saveSettings();
    if (s2.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
    try {
        await activateCampaignBooks({
            debugSource: source,
            syncMeta: { newChatId, matchingBooksCount: matchingBooks.length },
            registry: reg,
            allNames,
        });
    } catch (e) {
        _loreActivationDebugLast = {
            ...(_loreActivationDebugLast || {}),
            ts: new Date().toISOString(),
            source,
            syncError: String(e?.message || e),
        };
        renderLoreActivationDebugPanel();
    }
    // If ST's in-memory world list was empty but the server had names, run one silent follow-up
    // so updateWorldInfoList can repopulate the client after our /world pass (avoids needing manual resync).
    if (reg.usedApiNameFallback && reg.clientWorldNameCount === 0 && matchingBooks.length > 0 && !String(source).includes('registry-followup')) {
        setTimeout(() => {
            if (newChatId !== runtimeState.currentChatId) return;
            void syncCampaignPrefixAndWorldsForChat(newChatId, `${source}(registry-followup)`).catch(() => { });
        }, 450);
    }
    void scheduleAgentManifestRefresh();
}

/**
 * Centralized save helper that handles both global settings and
 * the Chat-Linked State for the active chat.
 */
let _saveSettingsTimer = null;
/** Re-entrancy guard: saveSettings → saveChatState must not call saveSettings again. */
let _saveSettingsInFlight = false;
/** If a save is requested while one is in flight, run again after (keeps deletes durable). */
let _saveSettingsPending = false;
let _saveSettingsPendingForce = false;
/** Cached core ST saveSettings (not on getContext — only saveSettingsDebounced is). */
let _coreSaveSettingsFn = null;

/**
 * Resolve SillyTavern's immediate (non-debounced) saveSettings().
 * Context only exposes saveSettingsDebounced; import core script when needed.
 * @returns {Promise<((loopCounter?: number) => Promise<void>)|null>}
 */
async function resolveCoreSaveSettings() {
    const ctx = SillyTavern.getContext();
    if (typeof ctx.saveSettings === 'function') {
        return ctx.saveSettings.bind(ctx);
    }
    if (typeof _coreSaveSettingsFn === 'function') return _coreSaveSettingsFn;
    try {
        const mod = await import(new URL('../../../../script.js', import.meta.url).href);
        if (typeof mod.saveSettings === 'function') {
            _coreSaveSettingsFn = mod.saveSettings;
            return _coreSaveSettingsFn;
        }
    } catch (err) {
        console.warn('[RPG Tracker] Could not import core saveSettings:', err);
    }
    return null;
}

/**
 * Force-write settings.json to disk and refresh the local memo recovery backup.
 * Must be awaited while the tab stays open (unlike unload flush races).
 * @returns {Promise<void>}
 */
async function forceDiskCheckpoint() {
    if (typeof globalThis._rpgFlushRawMemoChanges === 'function') {
        globalThis._rpgFlushRawMemoChanges();
    }
    const s = getSettings();
    markMemoPersistedByCurrentBrowser(s);
    const chatId = runtimeState.currentChatId || SillyTavern.getContext()?.chatId || null;
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId, { skipDiskWrite: true });
    }
    snapshotMemoToLocalStorage(chatId, { force: true });
    s.memoPersistedAt = Date.now();
    const saveFn = await resolveCoreSaveSettings();
    if (!saveFn) {
        throw new Error('Core saveSettings() could not be loaded');
    }
    await saveFn();
    snapshotMemoToLocalStorage(chatId, { force: true });
}

/**
 * @param {boolean} force Skip the debounce and save immediately.
 * @param {number} delay Debounce delay in ms when not forcing (default 0 = immediate).
 * @returns {Promise<void>|void}
 */
export function saveSettings(force = false, delay = 0) {
    // Keep UI synchronization immediate so toggle checkboxes and forms respond instantly
    syncOnboardingUI();

    // Always mirror module schema to sync localStorage first — even if a disk save is
    // already in flight (delete/add must not be dropped by the re-entrancy guard).
    try {
        const s0 = getSettings();
        const chatId0 = runtimeState.currentChatId || SillyTavern.getContext()?.chatId || null;
        writeModuleSchemaBackup(chatId0);
        if (s0.chatLinkEnabled && chatId0 && !isPortraitMigrationLocked()) {
            // Keep the per-chat module presentation aligned without nesting saveSettings.
            // Custom tracker definitions themselves are global and are intentionally
            // not copied into a chat snapshot.
            const existing = s0.chatStates?.[chatId0];
            if (existing) {
                existing.blockOrder = JSON.parse(JSON.stringify(s0.blockOrder || []));
                existing.modules = JSON.parse(JSON.stringify(s0.modules || {}));
            }
        }
    } catch (_) { /* non-fatal */ }

    const doSave = async (forceWrite) => {
        _saveSettingsTimer = null;
        if (_saveSettingsInFlight) {
            _saveSettingsPending = true;
            _saveSettingsPendingForce = _saveSettingsPendingForce || !!forceWrite;
            return;
        }
        _saveSettingsInFlight = true;
        try {
            do {
                _saveSettingsPending = false;
                const pendingForce = _saveSettingsPendingForce;
                _saveSettingsPendingForce = false;
                const useForce = !!forceWrite || pendingForce;

                const s = getSettings();
                markMemoPersistedByCurrentBrowser(s);
                const ctx = SillyTavern.getContext();
                const activeChatId = runtimeState.currentChatId || ctx.chatId;
                // Snapshot chat-linked state into extension settings before persisting to disk.
                if (s.chatLinkEnabled && activeChatId && !isPortraitMigrationLocked()) {
                    saveChatState(activeChatId, { skipDiskWrite: true });
                } else {
                    writeModuleSchemaBackup(activeChatId);
                }
                // Mirror the live memo into localStorage on every save cycle — regardless of
                // chatLinkEnabled — so a lost/raced disk write is recoverable at next boot.
                snapshotMemoToLocalStorage(activeChatId);
                // Stamp before the write so a successful disk save carries its own time;
                // if the write races/aborts, boot still sees the older stamp from disk.
                s.memoPersistedAt = Date.now();
                if (useForce) {
                    const saveFn = await resolveCoreSaveSettings();
                    if (saveFn) await saveFn();
                    else ctx.saveSettingsDebounced();
                } else {
                    ctx.saveSettingsDebounced();
                }
                forceWrite = false;
            } while (_saveSettingsPending);
        } finally {
            _saveSettingsInFlight = false;
        }
    };

    if (force || delay <= 0) {
        if (_saveSettingsTimer) clearTimeout(_saveSettingsTimer);
        _saveSettingsTimer = null;
        return doSave(force);
    }

    if (_saveSettingsTimer) clearTimeout(_saveSettingsTimer);
    _saveSettingsTimer = setTimeout(() => { void doSave(false); }, delay);
}

/** When NPC portraits are disabled, turn off NPC auto-generation and sync dependent UI. */
function applyNpcPortraitSetting(settings, enabled) {
    settings.npcPortraits = !!enabled;
    if (!settings.npcPortraits) {
        settings.portraitAutoGenerateNpcs = false;
    }
    syncNpcPortraitDependentUi(settings);
}

/** When location images are disabled, turn off location auto-generation and sync dependent UI. */
function applyLocationImageSetting(settings, enabled) {
    settings.locationImages = !!enabled;
    if (!settings.locationImages) {
        settings.portraitAutoGenerateLocations = false;
        settings.portraitAutoGenerateSceneView = false;
        settings.portraitRegenerateVisitedLocations = false;
        settings.portraitLocationIncludePresentNpcs = false;
        settings.agentImmersionMode = false;
    }
    syncLocationImageDependentUi(settings);
}

/**
 * Real-Time Mode enables a fixed bundle of location portrait options.
 * Regenerate-on-revisit is always on while Real-Time Mode is active (no separate toggle).
 * @param {object} settings
 */
function applyRealTimeModeBundle(settings) {
    settings.portraitAutoGenerateSceneView = true;
    settings.portraitAutoGenerateLocations = false;
    settings.portraitRegenerateVisitedLocations = true;
    settings.locationImages = true;
    settings.portraitLocationIncludePresentNpcs = true;
}

/**
 * Real-Time Mode (portraitAutoGenerateSceneView) and Lorebook Locations auto-gen
 * are mutually exclusive — arrival-based art must not be overwritten by agent passes.
 */
function applyLocationImageAutoMode(settings, { realTimeMode, lorebookLocations } = {}) {
    if (realTimeMode !== undefined) {
        if (realTimeMode) {
            applyRealTimeModeBundle(settings);
            syncPortraitLocationPromptForNpcToggle(settings, true, { force: true });
        } else {
            settings.portraitAutoGenerateSceneView = false;
            settings.portraitRegenerateVisitedLocations = false;
        }
    }
    if (lorebookLocations !== undefined) {
        settings.portraitAutoGenerateLocations = !!lorebookLocations;
        if (settings.portraitAutoGenerateLocations) {
            settings.locationImages = true;
            settings.portraitAutoGenerateSceneView = false;
            settings.portraitRegenerateVisitedLocations = false;
        }
    }
    syncLocationImageDependentUi(settings);
}

/** Sync NPC portrait toggle and disable auto-generate-NPCs when portraits are off. */
export function syncNpcPortraitDependentUi(settings) {
    const enabled = settings.npcPortraits !== false;
    const mainCb = document.getElementById('rpg_tracker_npc_portraits');
    if (mainCb) mainCb.checked = enabled;
    $('#rpg_tracker_npc_portraits').prop('checked', enabled);

    const autoNpcCb = document.getElementById('rpg_tracker_portrait_auto_npcs');
    if (autoNpcCb) {
        autoNpcCb.disabled = !enabled;
        autoNpcCb.checked = enabled ? !!settings.portraitAutoGenerateNpcs : false;
    }
    $('#rpg_tracker_portrait_auto_npcs').prop('disabled', !enabled);
    if (!enabled) {
        $('#rpg_tracker_portrait_auto_npcs').prop('checked', false);
    } else {
        $('#rpg_tracker_portrait_auto_npcs').prop('checked', !!settings.portraitAutoGenerateNpcs);
    }
}

/** Sync location image toggle and mutually exclusive auto-gen modes when images are off/on. */
export function syncLocationImageDependentUi(settings) {
    const realTimeOn = !!settings.portraitAutoGenerateSceneView;
    if (realTimeOn) {
        applyRealTimeModeBundle(settings);
    } else {
        settings.portraitRegenerateVisitedLocations = false;
        if (!settings.locationImages) {
            settings.portraitLocationIncludePresentNpcs = false;
        }
        // Lorebook Locations auto-gen implies Lorebook Locations master toggle (same as Real-Time Mode).
        if (settings.portraitAutoGenerateLocations) {
            settings.locationImages = true;
        }
    }

    const imagesEnabled = !!settings.locationImages;
    const mainCb = document.getElementById('rpg_tracker_location_images');
    if (mainCb) mainCb.checked = imagesEnabled;
    $('#rpg_tracker_location_images').prop('checked', imagesEnabled);

    if (settings.portraitAutoGenerateSceneView && settings.portraitAutoGenerateLocations) {
        settings.portraitAutoGenerateLocations = false;
    }

    const lorebookAutoOn = !!settings.portraitAutoGenerateLocations;

    const syncCheckbox = (id, checked, disabled) => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = !!disabled;
            el.checked = !!checked;
        }
        const $el = $(`#${id}`);
        $el.prop('disabled', !!disabled);
        $el.prop('checked', !!checked);
    };

    // Auto-gen locations requires Show Location Images; RT mode is always toggleable (enables location images when turned on).
    syncCheckbox('rpg_tracker_portrait_auto_locations', lorebookAutoOn, !imagesEnabled || realTimeOn);
    syncCheckbox('rpg_tracker_portrait_auto_scene_view', realTimeOn, false);
    syncCheckbox('rpg_tracker_location_images', imagesEnabled, realTimeOn);
    syncCheckbox('rpg_portrait_location_include_present_npcs', realTimeOn || !!settings.portraitLocationIncludePresentNpcs, !imagesEnabled || realTimeOn);

    const triggerMode = settings.portraitRealtimeTriggerMode || 'location_change';
    const everyN = Math.max(1, Number(settings.portraitRealtimeEveryNOutputs) || 1);
    const triggerSelect = document.getElementById('rpg_tracker_portrait_realtime_trigger');
    if (triggerSelect) triggerSelect.value = triggerMode;
    $('#rpg_tracker_portrait_realtime_trigger').val(triggerMode);
    const everyNInput = document.getElementById('rpg_tracker_portrait_realtime_every_n');
    if (everyNInput) everyNInput.value = String(everyN);
    $('#rpg_tracker_portrait_realtime_every_n').val(String(everyN));

    const triggerGroup = document.getElementById('rpg_loc_realtime_trigger_group');
    const everyNWrap = document.getElementById('rpg_loc_realtime_every_n_wrap');
    if (triggerGroup) triggerGroup.style.display = realTimeOn ? '' : 'none';
    if (everyNWrap) everyNWrap.style.display = realTimeOn && triggerMode === 'every_n_outputs' ? 'flex' : 'none';

    const standardCore = document.getElementById('rpg_loc_images_standard_core');
    const realtimeGroup = document.getElementById('rpg_loc_images_realtime_group');
    const realtimeNote = document.getElementById('rpg_loc_realtime_active_note');
    const realtimeBadge = document.getElementById('rpg_loc_realtime_badge');
    if (standardCore) standardCore.style.display = realTimeOn ? 'none' : '';
    if (realtimeBadge) realtimeBadge.style.display = realTimeOn ? 'inline-flex' : 'none';
    if (realtimeNote) {
        realtimeNote.style.display = realTimeOn ? 'block' : 'none';
        if (realTimeOn) {
            const notes = {
                location_enter: 'Generate once when entering a place that has no scene image yet. Open Visualization Mode in the Lorebook Agent to view scene art.',
                location_change: 'Regenerate whenever the location changes (including revisits). Open Visualization Mode in the Lorebook Agent to view scene art.',
                every_n_outputs: `Regenerate on location change, and also every ${everyN} chat output${everyN === 1 ? '' : 's'}. Open Visualization Mode in the Lorebook Agent to view scene art.`,
            };
            realtimeNote.textContent = notes[triggerMode] || notes.location_change;
        }
    }
    if (realtimeGroup) realtimeGroup.classList.toggle('rt-loc-realtime-active', realTimeOn);

    if (typeof globalThis._rpgSyncAgentImmersionUi === 'function') {
        globalThis._rpgSyncAgentImmersionUi();
    }
}

/** Push the Location Scene Prompt textarea to match settings (if present in DOM). */
function setPortraitLocationPromptTextarea(text) {
    const el = document.getElementById('rpg_portrait_location_system_prompt');
    if (el) el.value = text;
    $('#rpg_portrait_location_system_prompt').val(text);
}

/**
 * When the present-NPC toggle changes, swap Location Scene Prompt to the matching factory default
 * if settings or the open textarea still match a shipped/legacy default.
 * @param {object} settings
 * @param {boolean} includePresentNpcs
 * @param {{ force?: boolean }} [opts] force=true always overwrites (used by the toggle itself).
 */
function syncPortraitLocationPromptForNpcToggle(settings, includePresentNpcs, opts = {}) {
    const fromSettings = settings.portraitLocationSystemPrompt || '';
    const fromTextarea = String($('#rpg_portrait_location_system_prompt').val() || '');
    const shouldSwap = !!opts.force
        || !fromSettings.trim()
        || isShippedPortraitLocationSystemPrompt(fromSettings)
        || isShippedPortraitLocationSystemPrompt(fromTextarea);
    if (!shouldSwap) return;
    settings.portraitLocationSystemPrompt = getDefaultPortraitLocationSystemPrompt(includePresentNpcs);
    setPortraitLocationPromptTextarea(settings.portraitLocationSystemPrompt);
}

/**
 * Sync portrait-related extension checkboxes, then refresh the open Lorebook Agent view.
 * @param {{ forceLayoutRefresh?: boolean }} [opts] When true, rebuild catalog records from scratch (layout toggles).
 */
export async function refreshLorebookAgentViewsNow(opts = {}) {
    const s = getSettings();
    syncNpcPortraitDependentUi(s);
    syncLocationImageDependentUi(s);
    if (typeof globalThis._rpgSyncAgentImmersionUi === 'function') {
        globalThis._rpgSyncAgentImmersionUi();
    }
    if (!isAgentPanelVisible()) return;
    const source = opts.forceLayoutRefresh ? 'layout-toggle' : 'auto';
    await runtimeState.refreshAgentManifest(source);
}

globalThis._rpgRefreshLorebookAgentViews = refreshLorebookAgentViewsNow;

/**
 * Sync every time/date format control across the whole extension (Modules &
 * Order pills, Extension Settings checkbox, Character Creator) with the
 * live settings values. This is the single place that pushes state out to the
 * UI, so no surface can ever show a stale or contradicting value.
 * @param {object} s
 */
export function syncTimeFormatSettingsUi(s) {
    const timeDdMmyyCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_time_ddmmyy_toggle'));
    if (timeDdMmyyCb) timeDdMmyyCb.checked = !!s.useDdMmYyFormat;
    const time24hCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_time_24h_toggle'));
    if (time24hCb) time24hCb.checked = !!s.use24hTime;
    syncOnboardingUI();
    if (typeof runtimeState.updateWorldProgressionLastFiredDisplayRef === 'function') {
        runtimeState.updateWorldProgressionLastFiredDisplayRef();
    }
}

/** Persist time/date format fields into the current chat snapshot when chat linking is on. */
function persistChatTimeFormatIfLinked() {
    const s = getSettings();
    if (s.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
}

export function rebuildNpcInstructionIfNeeded() {
    const s = getSettings();
    rebuildAllModuleInstructions(s);
}

/** Apply default or saved per-chat relationship max into live settings. */
function applyChatNpcRelMaxSettings(saved) {
    const s = getSettings();
    s.npcRelationshipMax = saved?.npcRelationshipMax ?? getNpcRelationshipMaxDefault(s);
    rebuildNpcInstructionIfNeeded();
    scheduleAutoApply();
}

function persistChatNpcRelMaxIfLinked() {
    const s = getSettings();
    if (s.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
}

/** Update this chat's relationship scale (not the global new-chat default). */
function setNpcRelationshipMaxForCurrentChat(val) {
    const s = getSettings();
    s.npcRelationshipMax = getNpcRelationshipMax({ npcRelationshipMax: val });
    saveSettings();
    persistChatNpcRelMaxIfLinked();
    rebuildNpcInstructionIfNeeded();
    scheduleAutoApply();
}

/** Update the global default applied when opening chats with no saved value. */
function setNpcRelationshipMaxDefault(val) {
    const s = getSettings();
    s.npcRelationshipMaxDefault = getNpcRelationshipMax({ npcRelationshipMax: val });
    saveSettings();
    const defaultEl = document.getElementById('rpg_tracker_npc_rel_max_default');
    if (defaultEl) defaultEl.value = String(s.npcRelationshipMaxDefault);
}

/** Apply default or saved per-chat time/date format settings. */
function applyChatTimeFormatSettings(saved) {
    const s = getSettings();
    s.use24hTime = saved?.use24hTime ?? false;
    s.useDdMmYyFormat = saved?.useDdMmYyFormat ?? false;
    s.initialDate = saved?.initialDate ?? 'Day 1';
    if (s.routerModules?.npc) {
        s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
    }
    syncTimeFormatSettingsUi(s);
}

/**
 * Single source-of-truth setter for the Day N vs DD/MM/YYYY calendar format.
 * Every control that toggles this setting (Modules & Order, Extension
 * Settings, Character Creator) MUST call this instead of writing
 * `useDdMmYyFormat` directly, so the value and its dependent UI can never
 * drift apart between the different places it's exposed.
 * @param {boolean} isDate
 */
export function setUseDdMmYyFormat(isDate) {
    const s = getSettings();
    s.useDdMmYyFormat = !!isDate;
    if (isDate) {
        if (s.initialDate === "Day 1" || !s.initialDate) s.initialDate = "01/01/2026";
    } else if (!s.initialDate || s.initialDate === "01/01/2026" || s.initialDate === "01/01/26") {
        s.initialDate = "Day 1";
    }
    rebuildAllModuleInstructions(s);
    adjustAllStoredTemplatesForTimeFormat(s);
    $('#rpg_tracker_router_prompt').val(s.routerSystemPromptTemplate);
    $('#rpg_tracker_router_modular_prompt').val(s.routerModularPromptTemplate);
    refreshOrderList();
    if (typeof globalThis._rpgRenderAgentModules === 'function') {
        globalThis._rpgRenderAgentModules();
    }
    saveSettings();
    persistChatTimeFormatIfLinked();
    syncTimeFormatSettingsUi(s);
    scheduleAutoApply();
}

/**
 * Single source-of-truth setter for the 12h vs 24h clock format.
 * See {@link setUseDdMmYyFormat} for why every toggle must funnel through here.
 * @param {boolean} is24h
 */
export function setUse24hTime(is24h) {
    const s = getSettings();
    s.use24hTime = !!is24h;
    rebuildAllModuleInstructions(s);
    adjustAllStoredTemplatesForTimeFormat(s);
    $('#rpg_tracker_router_prompt').val(s.routerSystemPromptTemplate);
    $('#rpg_tracker_router_modular_prompt').val(s.routerModularPromptTemplate);
    refreshOrderList();
    if (typeof globalThis._rpgRenderAgentModules === 'function') {
        globalThis._rpgRenderAgentModules();
    }
    saveSettings();
    persistChatTimeFormatIfLinked();
    syncTimeFormatSettingsUi(s);
    scheduleAutoApply();
}

/**
 * Single source-of-truth setter for the initial date/day anchor text.
 * Keeps Character Creator and onboarding drawer start-date inputs in sync
 * without stealing focus from whichever input the user is typing into.
 * @param {string} val
 * @param {HTMLInputElement|null} [sourceInput] - the input the user is typing into; left untouched.
 */
function setInitialDateValue(val, sourceInput = null) {
    getSettings().initialDate = val;
    saveSettings();
    persistChatTimeFormatIfLinked();
    document.querySelectorAll('#rt-cr-start-date, #rt-onboarding-start-date').forEach(input => {
        if (input !== sourceInput) /** @type {HTMLInputElement} */ (input).value = val;
    });
}

/**
 * Synchronizes the onboarding UI elements with the current settings state.
 * This is called whenever a setting is saved to ensure both the main sidebar
 * and the tracker's onboarding screen stay perfectly in sync.
 */
function syncOnboardingUI() {
    const s = getSettings();
    const onboarding = document.querySelector('.rt-empty');
    if (!onboarding) return;

    // RNG Mode Sync
    const rngHybrid = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_rng_hybrid'));
    const rngLegacy = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_rng_legacy'));
    const rngNone = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_rng_none'));
    if (rngHybrid && rngLegacy && rngNone) {
        rngHybrid.checked = s.rngEnabled && !!s.diceFunctionTool;
        rngLegacy.checked = s.rngEnabled && !s.diceFunctionTool;
        rngNone.checked = !s.rngEnabled;
    }

    const narrativePacing = ['normal', 'high_agency', 'downtime'].includes(s.narrativePacing) ? s.narrativePacing : 'normal';
    onboarding.querySelectorAll('input[name="rt_onboarding_narrative_pacing"]').forEach(input => {
        input.checked = input.value === narrativePacing;
    });
    document.querySelectorAll('input[name="rpg_narrative_pacing"]').forEach(input => {
        input.checked = input.value === narrativePacing;
    });

    // Quests Enabled Sync
    const questsEnabled = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_enabled'));
    if (questsEnabled) {
        const isEnabled = s.syspromptModules?.quests !== false;
        questsEnabled.checked = isEnabled;
        const optionsDiv = /** @type {HTMLElement|null} */ (onboarding.querySelector('#rt_onboarding_quest_options'));
        if (optionsDiv) optionsDiv.style.display = isEnabled ? 'flex' : 'none';
    }

    // Deadlines Sync
    const deadlines = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_deadlines'));
    if (deadlines) deadlines.checked = !!s.syspromptModules?.questsDeadlines;
    const frustrationWrapOnb = /** @type {HTMLElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_frustration_wrap'));
    if (frustrationWrapOnb) frustrationWrapOnb.style.display = deadlines?.checked ? '' : 'none';

    // Frustration levels Sync
    const frustration = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_frustration'));
    if (frustration) frustration.checked = !!s.syspromptModules?.questsFrustration;

    const showArchiveOnb = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_show_archive'));
    if (showArchiveOnb) showArchiveOnb.checked = s.syspromptModules?.questsShowArchive !== false;


    // Optional Components Sync
    const mods = { 'loot': '#rt_onboarding_mod_loot', 'random_events': '#rt_onboarding_mod_random_events', 'resting': '#rt_onboarding_mod_resting', 'party_bench': '#rt_onboarding_mod_party_bench', 'CYOA_mode': '#rt_onboarding_mod_cyoa_mode' };
    for (const [key, id] of Object.entries(mods)) {
        const cb = /** @type {HTMLInputElement|null} */ (onboarding.querySelector(id));
        if (cb) cb.checked = key === 'CYOA_mode' ? s.syspromptModules?.CYOA_mode === true : !!s.syspromptModules?.[key];
    }

    // Time & Date sync — Character Creator + "Other ways to begin" drawer
    syncSegToggle(onboarding.querySelector('#rt-cr-date-seg'), s.useDdMmYyFormat ? 'date' : 'day');
    syncSegToggle(onboarding.querySelector('#rt-cr-clock-seg'), s.use24hTime ? '24' : '12');
    syncSegToggle(onboarding.querySelector('#rt-onboarding-date-seg'), s.useDdMmYyFormat ? 'date' : 'day');
    syncSegToggle(onboarding.querySelector('#rt-onboarding-clock-seg'), s.use24hTime ? '24' : '12');
    const creatorStartDate = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt-cr-start-date'));
    const drawerStartDate = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt-onboarding-start-date'));
    const startDateVal = s.initialDate && s.initialDate !== 'Day 1' ? s.initialDate : '01/01/2026';
    if (creatorStartDate) {
        creatorStartDate.value = startDateVal;
        creatorStartDate.style.display = s.useDdMmYyFormat ? 'inline-block' : 'none';
    }
    if (drawerStartDate) {
        drawerStartDate.value = startDateVal;
        drawerStartDate.style.display = s.useDdMmYyFormat ? 'inline-block' : 'none';
    }
    const gearTier = s.onboardingGearTier || 'auto';
    onboarding.querySelectorAll('#rt-onboarding-gear-tier, #rt-cr-gear-tier').forEach(sel => {
        if (sel instanceof HTMLSelectElement && sel.value !== gearTier) sel.value = gearTier;
    });

    const personaCbSync = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt-onboarding-persona-cb'));
    if (personaCbSync) personaCbSync.checked = !!s.onboardingCreatePersona;
    const personaWordsSync = /** @type {HTMLSelectElement|null} */ (onboarding.querySelector('#rt-onboarding-persona-words'));
    const personaWordsCustomSync = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt-onboarding-persona-words-custom'));
    if (personaWordsSync) personaWordsSync.value = s.onboardingPersonaWords || '150';
    if (personaWordsCustomSync) {
        personaWordsCustomSync.value = s.onboardingPersonaWordsCustom || '';
        personaWordsCustomSync.style.display = (personaWordsSync?.value === 'other') ? 'inline-block' : 'none';
    }
}

/**
 * Marks the button matching `activeValue` as active within a `.rt-seg-toggle`
 * group and clears the rest. Used to keep every Day/Date and 12h/24h control
 * across the onboarding screen visually in sync with the underlying setting.
 * @param {Element|null} segEl
 * @param {string} activeValue
 */
function syncSegToggle(segEl, activeValue) {
    if (!segEl) return;
    segEl.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === activeValue);
    });
}
// ── Renderer / navigation state ──
export const _sectionPages = sectionPages;

// ── Lorebook Agent nav state ──
/** @type {Array<{prePassSnapshot: object, postPassState: object}>} */

/**
 * Returns true if `bookName` belongs to the given `prefix`.
 * A book belongs when it is EITHER the prefix itself OR exactly
 * `prefix + '_' + <single-word suffix>` — the suffix must contain
 * no underscores so that "Assistant" never accidentally matches
 * "Assistant_2026_05_13_NPCs" (which belongs to a different, longer prefix).
 * @param {string} bookName
 * @param {string} prefix
 */
function bookBelongsToPrefix(bookName, prefix) {
    if (!prefix) return false;
    if (bookName === prefix) return true;
    const rest = bookName.startsWith(prefix + '_') ? bookName.slice(prefix.length + 1) : null;
    return rest !== null && !rest.includes('_');
}

/**
 * Activates every lorebook that belongs to the current campaign in SillyTavern's
 * world-info system (equivalent to toggling them ON in the World Info panel).
 * Uses the full ST lorebook registry filtered by campaign prefix, so keyless
 * lorebooks that never appear in activeRouterKeys are still caught.
 * @param {{ debugSource?: string, syncMeta?: Record<string, any>, registry?: object, allNames?: string[] }} [opts]
 * @returns {Promise<number>} Count of books turned on.
 */
async function activateCampaignBooks(opts = {}) {
    const debugSource = opts.debugSource || 'activateCampaignBooks';
    const s = getSettings();
    const ctx = SillyTavern.getContext();
    const baseDebug = {
        ts: new Date().toISOString(),
        source: debugSource,
        ctxChatId: ctx.chatId || '',
        trackedChatId: runtimeState.currentChatId,
        routerEnabled: !!s.routerEnabled,
        syncMeta: opts.syncMeta || null,
    };

    if (typeof ctx.executeSlashCommandsWithOptions !== 'function') {
        _loreActivationDebugLast = {
            ...baseDebug,
            stopped: 'executeSlashCommandsWithOptions missing on SillyTavern context',
            apis: {
                executeSlashCommandsWithOptions: 'undefined',
                updateWorldInfoList: typeof ctx.updateWorldInfoList,
                getWorldInfoNames: typeof ctx.getWorldInfoNames,
            },
        };
        renderLoreActivationDebugPanel();
        return 0;
    }

    const prefix = s.routerCampaignPrefix || '';
    if (!prefix) {
        if (typeof ctx.executeSlashCommandsWithOptions === 'function') {
            const reg = await refreshWorldInfoRegistry();
            const allNames = resolveAllWorldNames(ctx, reg);
            if (allNames.includes('World')) {
                if (s.worldProgressionEnabled) {
                    await ctx.executeSlashCommandsWithOptions('/world state=on silent=true "World"').catch(() => { });
                } else {
                    await ctx.executeSlashCommandsWithOptions('/world state=off silent=true "World"').catch(() => { });
                }
            }
        }
        _loreActivationDebugLast = {
            ...baseDebug,
            stopped: 'no routerCampaignPrefix (derive failed earlier or chat id empty)',
            storedPrefix: '',
        };
        renderLoreActivationDebugPanel();
        return 0;
    }

    const reg = opts.registry || await refreshWorldInfoRegistry();
    const allNames = opts.allNames || resolveAllWorldNames(ctx, reg);

    const worldBookName = prefix ? `${prefix}_World` : 'World';
    let bookNames = allNames.filter(n => bookBelongsToPrefix(n, prefix));
    // Exclude world progression books from native activation.
    bookNames = bookNames.filter(n => {
        const isWorld = n.toLowerCase().endsWith('_world') || n.toLowerCase() === 'world';
        return !isWorld;
    });

    const deact = computeWorldsToDeactivate(allNames, prefix, bookNames, s);
    const toDeactivate = deact.toDeactivate;
    if (allNames.includes(worldBookName) && !toDeactivate.includes(worldBookName)) {
        toDeactivate.push(worldBookName);
    }
    const allKnownManagedBooks = new Set(
        Object.values(s.chatStates || {}).flatMap(cs => cs.campaignBooks || [])
    );

    /** @type {{ cmd: string, ok?: boolean, isError?: boolean, errorMessage?: string, isAborted?: boolean, abortReason?: string, thrown?: string }[]} */
    const slashLog = [];

    const runWorldCmd = async (cmd) => {
        try {
            const result = await ctx.executeSlashCommandsWithOptions(cmd, {
                handleParserErrors: true,
                handleExecutionErrors: true,
            });
            const row = { cmd };
            if (!result) {
                row.ok = true;
                row.note = 'null result';
            } else {
                row.isError = !!result.isError;
                row.errorMessage = result.errorMessage || undefined;
                row.isAborted = !!result.isAborted;
                row.abortReason = result.abortReason || undefined;
                row.ok = !result.isError && !result.isAborted;
            }
            slashLog.push(row);
        } catch (e) {
            slashLog.push({ cmd, ok: false, thrown: String(e?.message || e) });
        }
    };

    for (const name of toDeactivate) {
        await runWorldCmd(`/world state=off silent=true "${name}"`);
    }

    for (const name of bookNames) {
        await runWorldCmd(`/world state=on silent=true "${name}"`);
    }

    _loreActivationDebugLast = {
        ...baseDebug,
        storedPrefix: prefix,
        worldRegistry: reg,
        allWorldNamesCount: allNames.length,
        matchingBookNames: bookNames,
        matchingCount: bookNames.length,
        managedBooksUnion: [...allKnownManagedBooks],
        deactivateDetail: {
            otherChatPrefixes: deact.otherPrefixes,
            managedOffCount: deact.managedOffCount,
            crossChatMatchCount: deact.crossChatMatchCount,
        },
        toDeactivate,
        slashCommandsRun: slashLog.length,
        slashLog,
    };
    renderLoreActivationDebugPanel();
    return bookNames.length;
}

/**
 * Duplicates every lorebook in the current campaign stack under a new prefix.
 * Each book like `OldPrefix_NPCs` becomes `NewPrefix_NPCs`.
 * If the book name IS the prefix (the root book), it becomes `NewPrefix`.
 * @returns {Promise<void>}
 */
async function cloneCampaignStack() {
    const s = getSettings();
    const ctx = SillyTavern.getContext();

    // 1. Determine current prefix
    const currentPrefix = s.routerCampaignPrefix || '';
    if (!currentPrefix) {
        toastr['warning']('No campaign prefix is active. Activate the Lorebook Agent and load a chat first.', 'Clone Stack');
        return;
    }

    // 2. Ask user for the new prefix
    let newPrefixRaw = '';
    try {
        newPrefixRaw = await ctx.Popup.show.input(
            'Clone Lorebook Stack',
            `<p>All lorebooks under prefix <strong>${currentPrefix}</strong> will be duplicated.</p>` +
            `<p>Enter the new prefix for the cloned stack (e.g. <code>Eldoria_Branch1</code>).<br>` +
            `<small>After cloning, create your branch chat using the same name so the framework links automatically.</small></p>`,
            ''
        );
    } catch (_) {
        // User cancelled
        return;
    }

    if (!newPrefixRaw && newPrefixRaw !== 0) return; // cancelled
    const newPrefix = sanitizeCampaignPrefixString(String(newPrefixRaw).trim());
    if (!newPrefix) {
        toastr['warning']('New prefix cannot be empty or contain only special characters.', 'Clone Stack');
        return;
    }
    if (newPrefix === currentPrefix) {
        toastr['warning']('New prefix is the same as the current prefix. Please choose a different name.', 'Clone Stack');
        return;
    }

    // 3. Discover all books that belong to the current prefix
    const reg = await refreshWorldInfoRegistry();
    const allNames = resolveAllWorldNames(ctx, reg);
    const matchingBooks = allNames.filter(n => bookBelongsToPrefix(n, currentPrefix));

    if (matchingBooks.length === 0) {
        toastr['warning'](`No lorebooks found for prefix "${currentPrefix}". Nothing to clone.`, 'Clone Stack');
        return;
    }

    toastr['info'](`Cloning ${matchingBooks.length} lorebook(s) to prefix "${newPrefix}"…`, 'Clone Stack');

    // 4. Clone each book under the new prefix name
    let cloned = 0;
    const errors = [];

    for (const bookName of matchingBooks) {
        // Derive new name: replace the old prefix at the start of the book name
        let newBookName;
        if (bookName === currentPrefix) {
            // Root book: OldPrefix → NewPrefix
            newBookName = newPrefix;
        } else {
            // Suffixed book: OldPrefix_Suffix → NewPrefix_Suffix
            const suffix = bookName.slice(currentPrefix.length); // includes leading '_'
            newBookName = newPrefix + suffix;
        }

        // Load existing book data
        let bookData = null;
        try {
            bookData = await ctx.loadWorldInfo(bookName);
        } catch (e) {
            errors.push(`Failed to load "${bookName}": ${e?.message || e}`);
            continue;
        }

        if (!bookData) {
            errors.push(`Could not read "${bookName}" — skipping.`);
            continue;
        }

        // Deep clone and update name
        const cloneData = JSON.parse(JSON.stringify(bookData));
        cloneData.name = newBookName;

        // Write to disk via the raw API (same pattern as router.js)
        try {
            const res = await fetch('/api/worldinfo/edit', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ name: newBookName, data: cloneData }),
            });
            if (!res.ok) {
                errors.push(`HTTP ${res.status} saving "${newBookName}"`);
                continue;
            }
            // Sync ST in-memory cache
            if (typeof ctx.saveWorldInfo === 'function') {
                try { await ctx.saveWorldInfo(newBookName, cloneData); } catch (_) { /* non-fatal */ }
            }
            cloned++;
        } catch (e) {
            errors.push(`Failed to write "${newBookName}": ${e?.message || e}`);
        }
    }

    // 5. Refresh ST's world-info list so the new books appear immediately
    if (typeof ctx.updateWorldInfoList === 'function') {
        try { await ctx.updateWorldInfoList(); } catch (_) { /* non-fatal */ }
    }

    // 6. Report result
    if (errors.length === 0) {
        toastr['success'](
            `Cloned ${cloned} lorebook${cloned === 1 ? '' : 's'} → prefix "${newPrefix}".\n` +
            `Now create a branch named "${newPrefix}" (or set the prefix override to "${newPrefix}") to link it.`,
            'Clone Stack',
            { timeOut: 8000 }
        );
    } else {
        toastr['warning'](
            `Cloned ${cloned}/${matchingBooks.length} books. Errors:\n${errors.join('\n')}`,
            'Clone Stack',
            { timeOut: 10000 }
        );
    }
}


// ── Chat-Linked State (deferred from state-manager.js — touches DOM + runtimeState.historyViewIndex) ──

export function refreshQuestPrompt(s) {
    let prompt = DEFAULT_STOCK_PROMPTS.quests;
    if (!s.syspromptModules?.questsDeadlines) {
        prompt = prompt.replace(/  DEADLINE:.*\n/g, '');
        prompt = prompt.replace(/- DEADLINE.*\n/g, '');
        prompt = prompt.replace(/- DEADLINE \/ FRUSTRATION_COEFF:.*\n/g, '');
        prompt = prompt.replace(/- Only use DEADLINE if the quest has a time limit\.\n/g, '');
    }
    if (!s.syspromptModules?.questsFrustration) {
        prompt = prompt.replace(/  FRUSTRATION_COEFF:.*\n/g, '');
        prompt = prompt.replace(/- On quest creation, set FRUSTRATION_COEFF.*\n/g, '');
        prompt = prompt.replace(/- For NPC-given quests only[^\n]*\n/g, '');
        prompt = prompt.replace(/- Omit FRUSTRATION_COEFF for emergent\/self-imposed quests[^\n]*\n/g, '');
        // Older combined emergent line → keep TYPE marker only
        prompt = prompt.replace(/- For emergent\/self-imposed quests: set TYPE: emergent, use GIVER: Self @ —, and omit FRUSTRATION_COEFF entirely \(no NPC expects completion\)\.\n/g, '- For emergent/self-imposed quests: set TYPE: emergent and use GIVER: Self @ —.\n');
    }
    if (!s.stockPrompts) s.stockPrompts = {};
    s.stockPrompts.quests = prompt;
}

/**
 * Restore a previously saved chat state into the live settings.
 * Returns true if a saved state was found, false if no state existed (clean slate).
 * @param {string} chatId
 * @returns {boolean}
 */
const loadChatState = createChatStateLoader({
    applyChatNpcRelMaxSettings,
    applyChatTimeFormatSettings,
    applyQuestSyncAndStripMemo,
    disableManagedEntries,
    extractCurrentTimeStr,
    formatInWorldTime,
    getSettings,
    hydrateImmersionSceneArtPath,
    isAgentPanelVisible,
    loadStockPromptsFromProfile,
    parseInWorldTime,
    refreshOrderList,
    resetAutoGenerationTracking,
    sanitizeRouterState,
    scheduleAgentManifestRefresh,
    scheduleAutoApply,
    scheduleDeferred,
    syncLocationImageDependentUi,
    syncMemoView,
    syncNpcPortraitDependentUi,
});

/** Reset live per-chat state when Chat Link reaches a chat with no saved snapshot. */
function resetUnseenChatState(s) {
    s.currentMemo = '';
    s.prevMemo1 = '';
    s.prevMemo2 = '';
    s.memoHistory = [];
    s.lastDelta = '';
    s.historyIndex = -1;
    s.quests = [];
    s.activeRouterKeys = [];
    s.activeWorldKeys = [];
    s.keywordActivatedKeys = [];
    s.routerLog = [];
    s.customPortraits = {};
    s.customLocationImages = {};
    s.worldProgressionLastFiredAtMinutes = -1;
    s.worldProgressionLastFiredPeriodLabel = '';
    s.worldProgressionSkeletonAtmosphereSummary = '';
    s.agentImmersionMode = false;
    resetImmersionSceneArtTracking();
    applyChatTimeFormatSettings(null);
    applyChatNpcRelMaxSettings(null);
    runtimeState.historyViewIndex = -1;

    refreshOrderList();
    scheduleAutoApply();
    const deltaPanel = document.getElementById('rpg-tracker-delta-content');
    if (deltaPanel) deltaPanel.innerHTML = '<span class="delta-empty">No changes yet.</span>';
    updateUIMemo('');
    refreshRenderedView();
    if (typeof runtimeState.renderRouterUI === 'function') runtimeState.renderRouterUI();
    if (typeof globalThis._rpgSyncAgentImmersionUi === 'function') globalThis._rpgSyncAgentImmersionUi();
}

/**
 * Installs a transient prompt interceptor to inject active lore keys
 * into the main narrator's prompt. This is non-mutating and clean.
 */
/**
 * Updates the persistent SillyTavern extension prompt with the currently active lore.
 * This is the preferred method for older/stable ST versions.
 */
async function refreshExtensionPrompt() {
    const ctx = SillyTavern.getContext();
    const { setExtensionPrompt } = ctx;
    if (typeof setExtensionPrompt !== 'function') return;

    const s = getSettings();
    if (!s.routerEnabled || (!s.activeRouterKeys?.length && !s.activeWorldKeys?.length)) {
        setExtensionPrompt('rpg_tracker_lore', '', 0, 0); // Clear if disabled
        return;
    }

    try {
        let injectedContext = "";
        const books = {};
        for (const k of s.activeRouterKeys) {
            const [bookName] = k.split('::');
            const isWorld = bookName.toLowerCase().endsWith('_world') || bookName.toLowerCase() === 'world';
            if (isWorld) continue;
            if (!books[bookName]) books[bookName] = await ctx.loadWorldInfo(bookName);
        }

        for (const k of s.activeRouterKeys) {
            const [bookName, uid] = k.split('::');
            const isWorld = bookName.toLowerCase().endsWith('_world') || bookName.toLowerCase() === 'world';
            if (isWorld) continue;
            const entry = books[bookName]?.entries?.[uid];
            if (entry && entry.content) {
                injectedContext += `### [${entry.key?.[0] || entry.comment || uid}]\n${entry.content}\n\n`;
            }
        }

        let worldBlock = "";
        if (s.worldProgressionEnabled && s.activeWorldKeys?.length) {
            const worldBooks = {};
            for (const k of s.activeWorldKeys) {
                const [bookName] = k.split('::');
                if (!worldBooks[bookName]) worldBooks[bookName] = await ctx.loadWorldInfo(bookName);
            }
            const sortedKeys = [...s.activeWorldKeys].sort((a, b) => {
                const [, uidA] = a.split('::');
                const [, uidB] = b.split('::');
                return Number(uidA) - Number(uidB);
            });
            for (const k of sortedKeys) {
                const [bookName, uid] = k.split('::');
                const entry = worldBooks[bookName]?.entries?.[uid];
                if (entry && entry.content) {
                    worldBlock += `### [${entry.key?.[0] || entry.comment || 'World Report'}]\n${entry.content}\n\n`;
                }
            }
        }

        if (injectedContext || worldBlock) {
            let routerBlock = "";
            if (injectedContext) {
                routerBlock += `## ROUTER ACTIVE LORE\n${injectedContext.trim()}\n\n`;
            }
            if (worldBlock) {
                routerBlock += `## WORLD PROGRESSION REPORTS\n${worldBlock.trim()}\n\n`;
            }
            routerBlock = routerBlock.trim();
            // Set as an extension prompt using default active lore injection position and depth
            const position = s.loreInjectionPosition ?? 0;
            const depth = s.loreInjectionDepth ?? 0;
            setExtensionPrompt('rpg_tracker_lore', routerBlock, position, depth);
        } else {
            setExtensionPrompt('rpg_tracker_lore', '', 0, 0);
        }
    } catch (e) {
        console.error("[Router Agent] Failed to update extension prompt:", e);
    }
}

function installRouterInterceptor() {
    const ctx = SillyTavern.getContext();
    const { addPromptManagerInterceptor, addChatInterceptor, addInterceptor } = ctx;

    // DISABLED: The addPromptManagerInterceptor path was a SECOND injection that
    // duplicated the work already handled by rpgTrackerInterceptor in narrative-hooks.js
    // (the manifest generate_interceptor). Having both active caused:
    //   1. Double-injection of RNG/MEMO/LORE into the prompt
    //   2. Cache breakage — this path used routerDefaultDepth (sliding), while
    //      narrative-hooks.js uses a fixed depth=1 for prefix-cache protection
    // All injection is now exclusively handled by narrative-hooks.js.
    // Clear any stale extension prompt from previous runs.
    const { setExtensionPrompt } = ctx;
    if (typeof setExtensionPrompt === 'function') {
        setExtensionPrompt('rpg_tracker_lore', '', 0, 0);
    }
    console.debug('[RPG Tracker] Lore injection handled exclusively by rpgTrackerInterceptor (narrative-hooks.js). setExtensionPrompt cleared.');
}

/**
 * Sanitizes a ST chat ID into a filesystem/lorebook-safe prefix.
 * The chat ID is already unique per session, so it's used verbatim
 * with only unsafe characters replaced.
 * @param {string} chatId
 * @returns {string}
 */
function derivePrefixFromChatId(chatId) {
    return sanitizeCampaignPrefixString(chatId);
}

/**
 * Updates the campaign prefix readout in Extension settings and the Lorebook Agent panel.
 * @param {string} [raw] - Prefix string, or empty / whitespace for "—".
 */
function syncRouterPrefixDisplays(raw) {
    const label = (raw && String(raw).trim()) ? String(raw).trim() : '—';
    const settingsEl = document.getElementById('rpg_tracker_router_prefix_display');
    if (settingsEl) settingsEl.textContent = label;
    const agentEl = document.getElementById('rt-agent-router-prefix-display');
    if (agentEl) agentEl.textContent = label;
}

/**
 * Called on CHAT_CHANGED. Saves the departing chat's state,
 * then loads the arriving chat's state — or resets the memo if
 * this is a new/unseen chat (no saved state).
 * @param {string} newChatId
 */
function onChatChanged(newChatId) {
    const s = getSettings();
    const ctx = SillyTavern.getContext();

    // ST always emits CHAT_CHANGED(getCurrentChatId()). Some extensions (notably ST-Copilot
    // after applying chat edits) emit bare CHAT_CHANGED() as a DOM-refresh signal.
    // Treating a missing id as "switched to no chat" used to wipe currentMemo/memoHistory
    // and World Progression timers, then a later save persisted the empty snapshot.
    const emitHadId = newChatId != null && String(newChatId).length > 0;
    const resolvedId = emitHadId
        ? String(newChatId)
        : (ctx.chatId || ctx.getCurrentChatId?.() || runtimeState.currentChatId || null);

    if (!resolvedId) {
        updateChatLinkUI();
        return;
    }

    const oldChatId = runtimeState.currentChatId;

    // Same-chat refresh (bare emit, F5, Copilot apply, etc.): keep live tracker state.
    if (!emitHadId || oldChatId === resolvedId) {
        runtimeState.currentChatId = resolvedId;
        void ensureLocalMemoRecovery(resolvedId);
        updateChatLinkUI();
        return;
    }

    runtimeState.currentChatId = resolvedId;

    // Snapshot the departing chat's state BEFORE resetRouterTick mutates shared pools.
    // resetRouterTick(true) zeroes keywordActivatedKeys in-place; if saveChatState ran
    // after that, the yellow-pill keyword state for the departing chat would be lost.
    // Guard matches the later chatLinkEnabled block so we only persist when linking is on.
    if (s.chatLinkEnabled && oldChatId) saveChatState(oldChatId);

    // Reset the run-every tick so the agent fires promptly on the first generation of each chat.
    // Only clear keyword-activated lore when actually switching to a different chat.
    // Same-chat reloads (swipe, regenerate) must preserve the keyword pool.
    void syncActivePersonaDescriptionFromAvatar();
    resetRouterTick(true);
    void resetCombatProfileOverride(s);

    // Auto-activate and prefix logic run regardless of chatLinkEnabled.
    // Always re-derive the prefix from the chat ID so stale saved data never
    // causes the wrong session's lorebooks to activate.
    const prefix = getEffectiveRouterCampaignPrefix(resolvedId);
    s.routerCampaignPrefix = prefix || '';
    syncRouterPrefixDisplays(prefix || '');

    // ── INSTANT UI REFRESH ──
    // Now that runtimeState.currentChatId AND routerCampaignPrefix are both correct,
    // fire an immediate manifest refresh. The PC card is already in chatStates
    // memory so it renders in <1ms. force=true bypasses isAgentPanelVisible().
    scheduleAgentManifestRefresh(true);

    // Init BOOTSTRAP may have just finished activation for this chat — skip duplicate /world pass.
    if (resolvedId === _sessionBootstrapChatId) {
        _sessionBootstrapChatId = null;
        updateChatLinkUI();
        return;
    }

    const chatBooks = s.chatStates?.[resolvedId]?.campaignBooks;

    if (chatBooks?.length) {
        // Fast Path: This chat has a linked stack already recorded.
        // Swap stacks instantly without the 800ms delay or the slow registry scan.
        if (typeof SillyTavern.getContext().executeSlashCommandsWithOptions === 'function') {
            (async () => {
                const ctx = SillyTavern.getContext();
                // 1. Turn OFF departing chat's books
                const oldBooks = s.chatStates?.[oldChatId]?.campaignBooks || [];
                for (const name of oldBooks) {
                    await ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${name}"`).catch(() => { });
                }
                // Also turn off departing chat's world book explicitly
                const oldPrefix = getEffectiveRouterCampaignPrefix(oldChatId);
                const oldWorldBookName = oldPrefix ? `${oldPrefix}_World` : 'World';
                await ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${oldWorldBookName}"`).catch(() => { });

                // 2. Turn ON arriving chat's books
                for (const name of chatBooks) {
                    await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${name}"`).catch(() => { });
                }
                // Turn ON arriving chat's world book explicitly if World Progression is enabled
                const newWorldBookName = prefix ? `${prefix}_World` : 'World';
                if (s.worldProgressionEnabled) {
                    await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${newWorldBookName}"`).catch(() => { });
                } else {
                    await ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${newWorldBookName}"`).catch(() => { });
                }
                // Re-render folder counts and active dots once the /world transitions complete
                scheduleAgentManifestRefresh(true);
            })();
        }
    } else if (s.routerEnabled && resolvedId) {
        // No linked stack yet for the arriving chat.
        // Capture the departing chat's book list NOW (before any async gap).
        const _oldBooksDeferred = s.chatStates?.[oldChatId]?.campaignBooks || [];

        // Helper: turn off the old books using only the known list — no registry scan.
        const _deactivateOldBooks = async () => {
            const _ctx = SillyTavern.getContext();
            if (typeof _ctx.executeSlashCommandsWithOptions !== 'function') return;
            if (_oldBooksDeferred.length) {
                for (const name of _oldBooksDeferred) {
                    await _ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${name}"`).catch(() => { });
                }
            }
            // Also explicitly turn off departing chat's world book
            const oldPrefix = getEffectiveRouterCampaignPrefix(oldChatId);
            const oldWorldBookName = oldPrefix ? `${oldPrefix}_World` : 'World';
            await _ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${oldWorldBookName}"`).catch(() => { });
        };

        // Cancel any pending derivation from a previous CHAT_CHANGED.
        if (_prefixDeriveTimer) clearTimeout(_prefixDeriveTimer);
        _prefixDeriveTimer = setTimeout(async () => {
            _prefixDeriveTimer = null;
            if (resolvedId !== runtimeState.currentChatId) return;

            // If init BOOTSTRAP is still running the registry scan, wait for it instead of duplicating.
            if (_bootstrapSyncPromise) {
                try { await _bootstrapSyncPromise; } catch (_) { }
                if (getSettings().chatStates?.[resolvedId]?.campaignBooks?.length) {
                    await _deactivateOldBooks();
                    return;
                }
            }

            // Pass 1 (~800ms): deactivate before the registry scan so books vanish fast.
            await _deactivateOldBooks();

            // Discover if the new chat actually has any linked books (needs registry scan).
            await syncCampaignPrefixAndWorldsForChat(resolvedId, 'CHAT_CHANGED(debounced)');

            // Pass 2 (~after scan): ST's deferred world-info state restoration can re-pin
            // globally active books AFTER our first pass. A follow-up sweep catches this
            // without needing another registry scan — just direct /world state=off commands.
            if (resolvedId === runtimeState.currentChatId) {
                await _deactivateOldBooks();
            }
        }, 800);
    }

    if (!s.chatLinkEnabled) {
        // World Progression "last fired" is operational per-chat state and must never bleed
        // between scenarios regardless of chatLinkEnabled. Reset it unconditionally on actual switch.
        s.worldProgressionLastFiredAtMinutes = -1;
        s.worldProgressionLastFiredPeriodLabel = '';
        s.worldProgressionSkeletonAtmosphereSummary = '';
        s.activeWorldKeys = [];
        s.quests = [];
        refreshRenderedView();
        updateChatLinkUI();
        return;
    }

    // saveChatState(oldChatId) already called above, before resetRouterTick.

    const found = loadChatState(resolvedId);
    if (!found && !s.chatStates?.[resolvedId]) resetUnseenChatState(s);

    scheduleAgentManifestRefresh();
    updateChatLinkUI();
    void syncCombatProfile(s.currentMemo, s);
    void syncDynamicRngPrompt(s.currentMemo, s);
}







/**
 * Syncs the 🔗/🔓 icon in the panel header and the settings checkbox
 * to reflect the current chatLinkEnabled state.
 */
function updateChatLinkUI() {
    const s = getSettings();
    const on = s.chatLinkEnabled;

    const btn = document.getElementById('rpg-tracker-chat-link-btn');
    const footerBtn = document.getElementById('rpg-tracker-chat-link-footer-btn');
    const linkTitle = on
        ? `Chat Link ON — state is bound to the active chat\n(Click to unlock / use global state)`
        : `Chat Link OFF — using global state\n(Click to re-lock to current chat)`;
    const linkLabel = on ? '🔗 Link' : '🔓 Unlinked';

    if (btn) {
        btn.textContent = on ? '🔗' : '🔓';
        btn.title = linkTitle;
    }
    if (footerBtn) {
        footerBtn.textContent = linkLabel;
        footerBtn.title = linkTitle;
    }

    const cb = document.getElementById('rpg_tracker_chat_link_enabled');
    if (cb instanceof HTMLInputElement) cb.checked = on;
}

/**
 * Update the visual status of the panel (active, running, paused, disabled)
 */
function updatePanelStatus() {
    const settings = getSettings();
    const panel = document.getElementById('rpg-tracker-panel');
    const indicator = document.getElementById('rpg-tracker-status');
    const pauseBtn = document.getElementById('rpg-tracker-pause-btn');
    const pauseBanner = document.getElementById('rpg-tracker-pause-banner');
    const enableBtn = /** @type {HTMLElement|null} */ (document.getElementById('rpg-tracker-enable-btn'));

    if (!panel || !indicator || !pauseBtn) return;

    // Keep in-panel power button in sync
    if (enableBtn) {
        enableBtn.style.opacity = settings.enabled ? '' : '0.35';
        enableBtn.title = settings.enabled ? 'Disable State Tracker' : 'Enable State Tracker';
    }
    // Keep settings sidebar checkbox in sync
    const sidebarEnableCheck = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_enabled'));
    if (sidebarEnableCheck) sidebarEnableCheck.checked = !!settings.enabled;

    if (!settings.enabled) {
        // Fully disabled — transparent panel, no banner
        panel.classList.add('is-disabled');
        panel.classList.remove('is-paused');
        indicator.classList.remove('active');
        // Always keep the header clickable so the user can re-enable (belt-and-suspenders over the CSS rule)
        const header = panel.querySelector('.rpg-tracker-header');
        if (header) /** @type {HTMLElement} */ (header).style.pointerEvents = 'auto';
        pauseBtn.textContent = '▶';
        pauseBtn.title = 'Resume Tracker';
        if (pauseBanner) pauseBanner.textContent = '';
    } else if (settings.paused) {
        // Paused — visible panel, pause banner shown
        panel.classList.remove('is-disabled');
        panel.classList.add('is-paused');
        indicator.classList.add('active');
        pauseBtn.textContent = '▶';
        pauseBtn.title = 'Resume Tracker';
        if (pauseBanner) pauseBanner.textContent = 'TRACKER UPDATES PAUSED';
    } else {
        // Active
        panel.classList.remove('is-disabled');
        panel.classList.remove('is-paused');
        indicator.classList.add('active');
        pauseBtn.textContent = '⏸';
        pauseBtn.title = 'Pause Tracker';
        if (pauseBanner) pauseBanner.textContent = '';
    }

    if (runtimeState.stateModelRunning) {
        indicator.classList.add('running');
    } else {
        indicator.classList.remove('running');
    }
}

/**
 * The State Model pass: Extract state changes from the narrative.
 * @param {string} narrativeOutput The last narrative message to parse.
 * @param {boolean} isFullContext Whether to perform a long-horizon audit of the entire chat.
 */
async function runStateModelPass(narrativeOutput, isFullContext = false, overrideLookback = null) {
    const settings = getSettings();

    // Deterministic logic: Auto-fail quests past deadline (if not using frustration)
    checkQuestDeadlines();

    const { generateRaw } = SillyTavern.getContext();

    if (!generateRaw) {
        console.error("[RPG Tracker] generateRaw not found in context.");
        return;
    }

    try {
        runtimeState.stateModelRunning = true;
        updateStatusIndicator('running');

        // Abort previous if any
        if (runtimeState.stateController) runtimeState.stateController.abort();
        runtimeState.stateController = new AbortController();
        const signal = runtimeState.stateController.signal;

        const modulesText = buildModulesInstructionText(settings);
        let systemPrompt = settings.systemPromptTemplate.replace('{{modulesText}}', modulesText);
        if (settings.npcRelationshipBars && getRelationshipUpdateMode(settings) === RELATIONSHIP_UPDATE_MODES.STATE_TRACKER) {
            systemPrompt += `\n\n${buildStateTrackerRelationshipCommandInstruction(
                getNpcRelationshipMax(settings),
                isFullContext,
                settings.npcRelationshipStateTrackerPrompt,
            )}`;
        }
        if (settings.useDdMmYyFormat) {
            systemPrompt = systemPrompt
                .replace(/\[Day\s+X,\s+HH:MM\]/g, '[DD/MM/YYYY, HH:MM]')
                .replace(/Day\s+3,\s+14:00/g, '03/01/2026, 14:00')
                .replace(/Day\s+1,\s+11:52/g, '01/01/2026, 11:52')
                .replace(/Day\s+1/g, '01/01/2026')
                .replace(/Day\s+2/g, '02/01/2026')
                .replace(/Day\s+3/g, '03/01/2026')
                .replace(/Day\s+4/g, '04/01/2026')
                .replace(/Day\s+6/g, '06/01/2026')
                .replace(/Day\s+N/g, 'DD/MM/YYYY')
                .replace(/Day\s+X/g, 'DD/MM/YYYY');
        }
        if (isFullContext) {
            systemPrompt = systemPrompt
                .replace(/Only output sections that actually changed/gi, 'Perform a full audit of the narrative history and output the COMPLETE state for all enabled modules')
                .replace(/Omit unchanged sections entirely/gi, 'Do NOT omit any section; output a complete, verified state memo');
        }


        const worldLore = await buildLorebookContext();
        const worldLoreSection = worldLore ? worldLore + '\n\n' : '';

        const { chat } = SillyTavern.getContext();
        let chunks = [];

        if (isFullContext) {
            const maxContextLimit = SillyTavern.getContext().contextSize || settings.fullAuditMaxTokens || 32000;
            const tokenBuffer = 3000;
            const chunkTokenLimit = Math.max(1000, maxContextLimit - tokenBuffer);

            let currentChunk = [];
            let currentTokens = 0;

            for (const m of chat) {
                const name = m.is_user ? 'Player' : (m.name || 'Narrator');
                const content = cleanToolCallMessage(m.mes || m['content'] || '');
                if (content === null) continue;
                const line = `${name}: ${content}`;
                const lineTokens = Math.ceil(line.length / 4);

                if (currentTokens + lineTokens > chunkTokenLimit && currentChunk.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = [];
                    currentTokens = 0;
                }
                currentChunk.push(line);
                currentTokens += lineTokens;
            }
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
            }
        } else {
            const sinceLastUser = settings.lookbackSinceLastUser !== false; // default true
            let startIdx;
            if (sinceLastUser) {
                // Walk backward to find the most recent user message, then include it
                // and everything after it — this captures full turns even when tool calls
                // produce multiple intermediate messages between user and final response.
                startIdx = chat.length - 1;
                while (startIdx > 0 && !chat[startIdx].is_user) {
                    startIdx--;
                }
                // If no user message was found (all-AI chat) fall back to last 2
                if (startIdx === 0 && !chat[0]?.is_user) {
                    startIdx = Math.max(0, chat.length - 2);
                }
            } else {
                const N = overrideLookback !== null ? overrideLookback : (settings.lookbackMessages !== undefined ? settings.lookbackMessages : 2);
                startIdx = Math.max(0, chat.length - N);
            }
            const recentChat = chat.slice(startIdx);
            const chatLogLines = recentChat.map(m => {
                const name = m.is_user ? 'Player' : (m.name || 'Narrator');
                const content = cleanToolCallMessage(m.mes || m['content'] || '');
                if (content === null) return null;
                return `${name}: ${content}`;
            }).filter(line => line !== null);
            chunks.push(chatLogLines);
        }

        let priorMemoText = `## TRACKER STATE 0 (Current)\n${stripMemoHtml(memoForTrackerContext(settings.currentMemo))}\n\n`;
        const historyCount = (settings.trackerHistoryCount || 1) - 1;
        if (historyCount > 0 && settings.memoHistory && settings.memoHistory.length > 0) {
            const historyToInclude = settings.memoHistory.slice(0, historyCount).reverse();
            const historyString = historyToInclude.map((memo, i) => {
                const offset = -(historyToInclude.length - i);
                return `## TRACKER STATE ${offset}\n${stripMemoHtml(memoForTrackerContext(memo))}`;
            }).join('\n\n');
            priorMemoText = historyString + '\n\n' + priorMemoText;
        }

        // ── Per-chunk commit helper ──
        // Treats each chunk result as a full "turn": commits to settings, archives history,
        // updates UI, and saves — so the next chunk sees the committed state.
        function commitChunkResult(merged, previousMemoSnapshot) {
            const delta = computeDelta(previousMemoSnapshot, merged);

            // Linear Stone History Logic
            if (settings.historyIndex !== undefined && settings.historyIndex !== -1) {
                if (settings.debugMode) console.log(`[RPG Tracker] Splicing history at index ${settings.historyIndex} due to new update.`);
                settings.memoHistory = settings.memoHistory.slice(settings.historyIndex);
            }
            if (settings.memoHistory[0] !== previousMemoSnapshot) {
                settings.memoHistory.unshift(previousMemoSnapshot);
            }
            settings.memoHistory.unshift(merged);
            if (settings.memoHistory.length > 1000) settings.memoHistory.length = 1000;
            settings.historyIndex = 0;
            runtimeState.historyViewIndex = -1;

            // Persist delta and update panel
            settings.lastDelta = delta;
            const deltaPanel = document.getElementById('rpg-tracker-delta-content');
            if (deltaPanel) deltaPanel.innerHTML = delta;

            // Commit to settings
            settings.prevMemo2 = settings.prevMemo1;
            settings.prevMemo1 = previousMemoSnapshot;
            settings.currentMemo = applyQuestSyncAndStripMemo(merged);
            updateUIMemo(settings.currentMemo);
            syncMemoView();
            refreshRenderedView();
            saveSettings();
            // Keep chatStates in sync immediately so a same-session reload (F5) can never
            // resurrect a stale/empty per-chat snapshot over this freshly-committed memo.
            if (settings.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);

            if (/LEVEL_UP=true/i.test(merged)) {
                handleLevelUp();
            }

            return delta;
        }

        let lastDelta = '';

        for (let i = 0; i < chunks.length; i++) {
            if (signal.aborted) break;

            // Snapshot the memo BEFORE this chunk processes, so delta/history is per-chunk
            const memoBeforeThisChunk = settings.currentMemo.replace(/<\/?memo>/gi, '').trim();

            if (isFullContext && chunks.length > 1) {
                toastr.info(`Running Full Audit: Chunk ${i + 1} of ${chunks.length}...`, "RPG Tracker", { timeOut: 5000 });
                updateStatusIndicator('running', `Chunk ${i + 1}/${chunks.length}`);
            }

            const chatLog = chunks[i].join('\n\n');
            let userPrompt = "";

            if (isFullContext) {
                // For full audit, always read the LIVE committed memo for the prior
                userPrompt =
                    worldLoreSection +
                    `## PRIOR MEMO\n${stripMemoHtml(memoForTrackerContext(settings.currentMemo)) || '(empty)'}\n\n` +
                    `## NARRATIVE HISTORY (Chunk ${i + 1} of ${chunks.length})\n${chatLog}\n\n` +
                    `## TASK\nAnalyze the narrative chunk provided above. Rebuild the State Memo to ensure every detail is perfectly accurate to this point in the story. Correct any errors or omissions found in the Prior Memo.\n\n` +
                    `## OUTPUT THE COMPLETE VERIFIED STATE MEMO:`;
            } else {
                userPrompt =
                    worldLoreSection +
                    priorMemoText +
                    `## NARRATIVE HISTORY (Last ${chunks[i].length} messages)\n${chatLog}\n\n` +
                    (settings.userPromptSuffix || `## OUTPUT ONLY CHANGED SECTIONS:`);
            }

            const result = await sendStateRequest(settings, systemPrompt, userPrompt);

            if (result && typeof result === 'string') {
                if (settings.debugMode) console.log(`[RPG Tracker] Raw Result (Chunk ${i + 1}):`, result);

                const relationshipResult = getRelationshipUpdateMode(settings) === RELATIONSHIP_UPDATE_MODES.STATE_TRACKER
                    ? extractStateTrackerRelationshipCommands(result)
                    : { memo: result, commands: [] };
                const relationshipCommands = relationshipResult.commands;
                let cleanedOutput = relationshipResult.memo;
                const memoBlocks = [...cleanedOutput.matchAll(/<memo>([\s\S]*?)<\/memo>/gi)];
                if (memoBlocks.length > 0) {
                    cleanedOutput = memoBlocks[memoBlocks.length - 1][1].trim();
                } else {
                    cleanedOutput = cleanedOutput.replace(/<\/?memo>/gi, '').trim();
                }

                const merged = mergeMemo(memoBeforeThisChunk, cleanedOutput);

                if (settings.debugMode) {
                    console.log(`[RPG Tracker] Memo ${merged !== memoBeforeThisChunk ? 'updated' : 'unchanged'} after chunk ${i + 1}.`);
                }

                // ── FULL COMMIT: treat this chunk as a completed turn ──
                lastDelta = commitChunkResult(merged, memoBeforeThisChunk);
                if (relationshipCommands.length) {
                    await applyStateTrackerRelationshipCommands(relationshipCommands);
                }

                // Stamp the pre-commit memo snapshot and result on the message for swipe rollback/restore
                if (getSettings().stateTrackerSwipeRollback !== false) {
                    const { chat: _sc } = SillyTavern.getContext();
                    const _lastAi = _sc ? [..._sc].reverse().find(m => !m.is_user) : null;
                    if (_lastAi) {
                        _lastAi.extra = _lastAi.extra || {};
                        const _sid = _lastAi.swipe_id ?? 0;
                        _lastAi.extra.rpgMemoRollback = _lastAi.extra.rpgMemoRollback || {};
                        _lastAi.extra.rpgMemoRollback[_sid] = memoBeforeThisChunk;
                        _lastAi.extra.rpgMemoResult = _lastAi.extra.rpgMemoResult || {};
                        _lastAi.extra.rpgMemoResult[_sid] = merged;
                        _lastAi.extra.rpgMemoActiveSwipe = _sid;
                    }
                }

                if (settings.debugMode) console.log(`[RPG Tracker] Chunk ${i + 1}/${chunks.length} committed.`);
            }
        }

        if (settings.debugMode) console.log("[RPG Tracker] State Model pass complete.");
        return lastDelta;
    } catch (error) {
        if (error.name === 'AbortError') {
            if (settings.debugMode) console.log("[RPG Tracker] State Model pass aborted by user.");
            return;
        }
        console.error("[RPG Tracker] State Model pass failed:", error);
    } finally {
        runtimeState.stateModelRunning = false;
        runtimeState.stateController = null;
        updateStatusIndicator('active');
    }
}

// ── Phase-5 bridge: exposes runStateModelPass for narrative-hooks.js/onGenerationEnded ──
// Removed when memo-processor.js is created in Phase 5.
globalThis._rpgRunStateModelPass = runStateModelPass;
globalThis._rpgStateModelRunning = () => runtimeState.stateModelRunning;
globalThis._rpgCurrentChatId = () => runtimeState.currentChatId;
globalThis._rpgResetRouterAutoTick = resetRouterAutoTick;
// Expose live prefix derivation for any module that needs the current prefix.
globalThis._rpgGetCurrentPrefix = () => getEffectiveRouterCampaignPrefix(SillyTavern.getContext().chatId || '');
globalThis._rpgUpdateUIMemo = (text) => {
    if (typeof updateUIMemo === 'function') updateUIMemo(text);
    if (typeof syncMemoView === 'function') syncMemoView();
    if (typeof refreshRenderedView === 'function') refreshRenderedView();
};

function handleLevelUp() {
    const { sendSystemMessage } = SillyTavern.getContext();
    toastr['success']("Level Up Detected! System prompt injected.", "RPG Tracker");

    if (sendSystemMessage) {
        sendSystemMessage('generic', "SYSTEM: Level Up Detected! The character has gained a level. Acknowledge this immediately and prompt the user to make their level-up choices or grant them their logical boons.");
    }
}



/**
 * Resolve the active SillyTavern persona from user_avatar, not the global
 * power_user.persona_description cache (which can stay stale when the avatar
 * is already selected but selectCurrentPersona was never re-run).
 * @returns {Promise<{ name: string, description: string }|null>}
 */
async function resolveActivePersonaDescription() {
    try {
        const [{ user_avatar }, { power_user }] = await Promise.all([
            import('../../../personas.js'),
            import('../../../power-user.js'),
        ]);
        if (!user_avatar) return null;

        const descriptor = power_user.persona_descriptions?.[user_avatar];
        const description = (descriptor?.description ?? power_user.persona_description ?? '').trim();
        const name = (power_user.personas?.[user_avatar] ?? '').trim();
        if (!description) return null;

        if (descriptor && power_user.persona_description !== descriptor.description) {
            power_user.persona_description = descriptor.description ?? '';
        }

        return { name, description };
    } catch (e) {
        console.warn('[RPG Tracker] Could not resolve active persona:', e);
        return null;
    }
}

/** Re-sync global persona_description from the currently selected avatar. */
async function syncActivePersonaDescriptionFromAvatar() {
    await resolveActivePersonaDescription();
}

/**
 * Send a direct instruction to the State Model bypassing the narrative pipeline.
 * Used for initial character setup and manual corrections.
 */
export async function sendDirectPrompt(message) {
    if (runtimeState.stateModelRunning) {
        toastr['info']('State Model is already running. Please wait.', 'RPG Tracker');
        return;
    }

    const settings = getSettings();
    const { generateRaw } = SillyTavern.getContext();
    if (!generateRaw) {
        toastr['warning']('Text generation is not available. Connect an API in SillyTavern settings.', 'RPG Tracker');
        return;
    }

    try {
        runtimeState.stateModelRunning = true;
        updateStatusIndicator('running');

        // Abort previous if any
        if (runtimeState.stateController) runtimeState.stateController.abort();
        runtimeState.stateController = new AbortController();
        const signal = runtimeState.stateController.signal;
        const worldLore = await buildLorebookContext();
        const worldLoreSection = worldLore ? worldLore + '\n\n' : '';

        const modulesText = buildModulesInstructionText(settings);
        let systemPrompt = settings.systemPromptTemplate.replace('{{modulesText}}', modulesText);
        if (settings.useDdMmYyFormat) {
            systemPrompt = systemPrompt
                .replace(/\[Day\s+X,\s+HH:MM\]/g, '[DD/MM/YYYY, HH:MM]')
                .replace(/Day\s+3,\s+14:00/g, '03/01/2026, 14:00')
                .replace(/Day\s+1,\s+11:52/g, '01/01/2026, 11:52')
                .replace(/Day\s+1/g, '01/01/2026')
                .replace(/Day\s+2/g, '02/01/2026')
                .replace(/Day\s+3/g, '03/01/2026')
                .replace(/Day\s+4/g, '04/01/2026')
                .replace(/Day\s+6/g, '06/01/2026')
                .replace(/Day\s+N/g, 'DD/MM/YYYY')
                .replace(/Day\s+X/g, 'DD/MM/YYYY');
        }

        const sanitizedCurrentFull = stripMemoHtml(settings.currentMemo.replace(/<\/?memo>/gi, '').trim());
        const sanitizedCurrentForPrompt = stripMemoHtml(memoForTrackerContext(sanitizedCurrentFull));

        const { chat } = SillyTavern.getContext();
        const N = settings.directPromptContext !== undefined ? settings.directPromptContext : 5;
        let chatLog = '';
        if (N > 0 && chat && chat.length > 0) {
            const recentChat = chat.slice(-N);
            chatLog = `## NARRATIVE HISTORY (Last ${recentChat.length} messages)\n` +
                recentChat
                    .map(m => {
                        const name = m.is_user ? 'Player' : (m.name || 'Narrator');
                        // Returns null for tool-call messages — excluded from state model context
                        const content = cleanToolCallMessage(m.mes || m['content'] || '');
                        if (content === null) return null;
                        return `${name}: ${content}`;
                    })
                    .filter(line => line !== null)
                    .join('\n\n') + '\n\n';
        }

        const userPrompt =
            worldLoreSection +
            chatLog +
            `## PRIOR MEMO\n${sanitizedCurrentForPrompt || '(empty — this is the initial setup)'}\n\n` +
            `## USER INSTRUCTION\n${message}\n\n` +
            `## OUTPUT ONLY CHANGED OR NEW SECTIONS:`;

        const result = await sendStateRequest(settings, systemPrompt, userPrompt);

        if (result && typeof result === 'string') {
            let cleanedOutput = result;
            const memoBlocks = [...result.matchAll(/<memo>([\s\S]*?)<\/memo>/gi)];
            if (memoBlocks.length > 0) {
                cleanedOutput = memoBlocks[memoBlocks.length - 1][1].trim();
            } else {
                cleanedOutput = result.replace(/<\/?memo>/gi, '').trim();
            }

            const merged = mergeMemo(sanitizedCurrentFull, cleanedOutput);

            if (merged !== sanitizedCurrentFull) {
                const delta = computeDelta(sanitizedCurrentFull, merged);
                settings.lastDelta = delta;

                // Linear Stone History Logic
                if (settings.historyIndex !== undefined && settings.historyIndex !== -1) {
                    settings.memoHistory = settings.memoHistory.slice(settings.historyIndex);
                }
                if (settings.memoHistory[0] !== sanitizedCurrentFull) {
                    settings.memoHistory.unshift(sanitizedCurrentFull);
                }
                settings.memoHistory.unshift(merged);
                if (settings.memoHistory.length > 1000) settings.memoHistory.length = 1000;
                settings.historyIndex = 0;
                runtimeState.historyViewIndex = -1;

                const dp = document.getElementById('rpg-tracker-delta-content');
                if (dp) dp.innerHTML = delta;

                settings.prevMemo2 = settings.prevMemo1;
                settings.prevMemo1 = sanitizedCurrentFull;
                settings.currentMemo = merged;

                updateUIMemo(merged);
                syncMemoView();
                refreshRenderedView();
                saveSettings();
                if (settings.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
                toastr['success']('Tracker updated.', 'RPG Tracker');
            } else {
                toastr['info']('No changes were made.', 'RPG Tracker');
            }
        } else {
            toastr['warning']('State Model returned no output. Check your API connection and State Model settings.', 'RPG Tracker');
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            if (settings.debugMode) console.log("[RPG Tracker] Direct prompt aborted by user.");
            return;
        }
        console.error('[RPG Tracker] Direct prompt failed:', err);
        toastr['error']('Direct prompt failed. Check console.', 'RPG Tracker');
    } finally {
        runtimeState.stateModelRunning = false;
        runtimeState.stateController = null;
        updateStatusIndicator('active');
    }
}




/** Profile system — load a named profile into live settings. */
function loadProfile(name) {
    const s = getSettings();
    const p = s.profiles?.[name];
    if (!p) return;
    s.currentMemo = p.currentMemo ?? '';
    s.memoHistory = p.memoHistory ?? [];
    s.modules = p.modules ? JSON.parse(JSON.stringify(p.modules)) : s.modules;
    s.blockOrder = p.blockOrder ? JSON.parse(JSON.stringify(p.blockOrder)) : s.blockOrder;
    s.stockPrompts = loadStockPromptsFromProfile(p.stockPrompts);
    s.modulePageSizes = p.modulePageSizes ? JSON.parse(JSON.stringify(p.modulePageSizes)) : {};
    s.customFields = p.customFields ? JSON.parse(JSON.stringify(p.customFields)) : [];
    // quests are always derived from currentMemo — never from the profile snapshot
    s.quests = [];
    s.currentMemo = applyQuestSyncAndStripMemo(s.currentMemo);
    s.lastDelta = p.lastDelta ?? '';
    s.routerLookback = p.routerLookback || 4;
    s.routerDirectPrompt = p.routerDirectPrompt || '';
    s.worldProgressionLookback = p.worldProgressionLookback ?? 20;
    s.worldProgressionHistoryLookback = p.worldProgressionHistoryLookback ?? 0;
    s.worldProgressionRandomizeNPCs = p.worldProgressionRandomizeNPCs ?? false;
    s.worldProgressionRandomSkeletonNPCCount = p.worldProgressionRandomSkeletonNPCCount ?? 2;
    s.worldProgressionRandomNarrativeNPCCount = p.worldProgressionRandomNarrativeNPCCount ?? 3;
    s.worldProgressionRandomizeLocations = p.worldProgressionRandomizeLocations ?? false;
    s.worldProgressionRandomSkeletonLocationCount = p.worldProgressionRandomSkeletonLocationCount ?? 2;
    s.worldProgressionRandomNarrativeLocationCount = p.worldProgressionRandomNarrativeLocationCount ?? 2;
    s.worldProgressionRandomizeFactions = p.worldProgressionRandomizeFactions ?? false;
    s.worldProgressionRandomSkeletonFactionCount = p.worldProgressionRandomSkeletonFactionCount ?? 2;
    s.worldProgressionRandomNarrativeFactionCount = p.worldProgressionRandomNarrativeFactionCount ?? 2;
    s.worldProgressionRandomizeConflicts = p.worldProgressionRandomizeConflicts ?? false;
    s.worldProgressionRandomConflictCount = p.worldProgressionRandomConflictCount ?? 3;
    s.worldProgressionSkeletonFactions = p.worldProgressionSkeletonFactions ?? 4;
    s.worldProgressionSkeletonLocations = p.worldProgressionSkeletonLocations ?? 4;
    s.worldProgressionSkeletonNPCs = p.worldProgressionSkeletonNPCs ?? 0;
    s.worldProgressionSkeletonConflicts = p.worldProgressionSkeletonConflicts ?? 3;
    s.worldProgressionLastFiredAtMinutes = p.worldProgressionLastFiredAtMinutes ?? -1;
    s.worldProgressionLastFiredPeriodLabel = p.worldProgressionLastFiredPeriodLabel || '';
    s.worldProgressionExclusionList = p.worldProgressionExclusionList ?? '';

    s.portraitGeneratorSource = p.portraitGeneratorSource ?? "native";
    s.portraitSkipPromptDialog = p.portraitSkipPromptDialog ?? false;
    s.hideImageGenToasts = p.hideImageGenToasts ?? false;
    s.portraitAutoGenerateParty = p.portraitAutoGenerateParty ?? false;
    s.portraitAutoGeneratePlayer = p.portraitAutoGeneratePlayer ?? false;
    s.portraitAutoGenerateEnemies = p.portraitAutoGenerateEnemies ?? false;
    s.portraitAutoGenerateNpcs = p.portraitAutoGenerateNpcs ?? false;
    s.portraitAutoGenerateLocations = p.portraitAutoGenerateLocations ?? false;
    s.portraitAutoGenerateSceneView = p.portraitAutoGenerateSceneView ?? false;
    s.portraitRealtimeTriggerMode = ['location_enter', 'location_change', 'every_n_outputs'].includes(p.portraitRealtimeTriggerMode)
        ? p.portraitRealtimeTriggerMode
        : 'location_change';
    s.portraitRealtimeEveryNOutputs = Math.max(1, Number(p.portraitRealtimeEveryNOutputs) || 1);
    s.portraitRegenerateVisitedLocations = !!s.portraitAutoGenerateSceneView;
    s.locationImages = !!p.locationImages;
    s.portraitConnectionSource = p.portraitConnectionSource ?? "default";
    s.portraitConnectionProfileId = p.portraitConnectionProfileId || "";
    s.portraitCompletionPresetId = p.portraitCompletionPresetId || "";
    s.portraitOllamaUrl = p.portraitOllamaUrl || "http://localhost:11434";
    s.portraitOllamaModel = p.portraitOllamaModel || "";
    s.portraitOpenaiUrl = p.portraitOpenaiUrl || "";
    s.portraitOpenaiKey = p.portraitOpenaiKey || "";
    s.portraitOpenaiModel = p.portraitOpenaiModel || "";

    s.worldConnectionSource = p.worldConnectionSource ?? "default";
    s.worldConnectionProfileId = p.worldConnectionProfileId || "";
    s.worldCompletionPresetId = p.worldCompletionPresetId || "";
    s.worldOllamaUrl = p.worldOllamaUrl || "http://localhost:11434";
    s.worldOllamaModel = p.worldOllamaModel || "";
    s.worldOpenaiUrl = p.worldOpenaiUrl || "";
    s.worldOpenaiKey = p.worldOpenaiKey || "";
    s.worldOpenaiModel = p.worldOpenaiModel || "";

    s.gameSystemWizardConnectionSource = p.gameSystemWizardConnectionSource ?? "default";
    s.gameSystemWizardConnectionProfileId = p.gameSystemWizardConnectionProfileId || "";
    s.gameSystemWizardCompletionPresetId = p.gameSystemWizardCompletionPresetId || "";
    s.gameSystemWizardOllamaUrl = p.gameSystemWizardOllamaUrl || "http://localhost:11434";
    s.gameSystemWizardOllamaModel = p.gameSystemWizardOllamaModel || "";
    s.gameSystemWizardOpenaiUrl = p.gameSystemWizardOpenaiUrl || "";
    s.gameSystemWizardOpenaiKey = p.gameSystemWizardOpenaiKey || "";
    s.gameSystemWizardOpenaiModel = p.gameSystemWizardOpenaiModel || "";
    s.gameSystemWizardSystemPrompt = p.gameSystemWizardSystemPrompt || "";

    // Update settings UI inputs if rendered
    $('#rpg_world_progression_randomize_npcs').prop('checked', !!s.worldProgressionRandomizeNPCs);
    $('#rpg_world_progression_random_skeleton_npc_count').val(s.worldProgressionRandomSkeletonNPCCount ?? 2);
    $('#rpg_world_progression_random_narrative_npc_count').val(s.worldProgressionRandomNarrativeNPCCount ?? 3);
    $('#rpg_world_progression_randomize_locations').prop('checked', !!s.worldProgressionRandomizeLocations);
    $('#rpg_world_progression_random_skeleton_location_count').val(s.worldProgressionRandomSkeletonLocationCount ?? 2);
    $('#rpg_world_progression_random_narrative_location_count').val(s.worldProgressionRandomNarrativeLocationCount ?? 2);
    $('#rpg_world_progression_randomize_factions').prop('checked', !!s.worldProgressionRandomizeFactions);
    $('#rpg_world_progression_random_skeleton_faction_count').val(s.worldProgressionRandomSkeletonFactionCount ?? 2);
    $('#rpg_world_progression_random_narrative_faction_count').val(s.worldProgressionRandomNarrativeFactionCount ?? 2);

    $('#rpg_world_progression_skeleton_factions').val(s.worldProgressionSkeletonFactions ?? 4);
    $('#rpg_world_progression_skeleton_locations').val(s.worldProgressionSkeletonLocations ?? 4);
    $('#rpg_world_progression_skeleton_npcs').val(s.worldProgressionSkeletonNPCs ?? 0);
    $('#rpg_world_progression_skeleton_conflicts').val(s.worldProgressionSkeletonConflicts ?? 3);
    $('#rpg_world_progression_exclusion_list').val(s.worldProgressionExclusionList);

    // Sync portrait connection settings UI
    $('#rpg_portrait_generator_source').val(s.portraitGeneratorSource || 'native');
    $('#rpg_tracker_pollinations_group').toggle((s.portraitGeneratorSource || 'native') === 'pollinations');
    $('#rpg_tracker_portrait_skip_prompt').prop('checked', !!s.portraitSkipPromptDialog);
    $('#rpg_tracker_hide_image_gen_toasts').prop('checked', !!s.hideImageGenToasts);
    $('#rpg_tracker_portrait_auto_party').prop('checked', !!s.portraitAutoGenerateParty);
    $('#rpg_tracker_portrait_auto_player').prop('checked', !!s.portraitAutoGeneratePlayer);
    $('#rpg_tracker_portrait_auto_enemies').prop('checked', !!s.portraitAutoGenerateEnemies);
    $('#rpg_tracker_portrait_auto_npcs').prop('checked', !!s.portraitAutoGenerateNpcs);
    $('#rpg_tracker_portrait_auto_locations').prop('checked', !!s.portraitAutoGenerateLocations);
    $('#rpg_tracker_portrait_auto_scene_view').prop('checked', !!s.portraitAutoGenerateSceneView);
    $('#rpg_tracker_location_images').prop('checked', !!s.locationImages);
    syncNpcPortraitDependentUi(s);
    syncLocationImageDependentUi(s);
    $('#rpg_portrait_connection_source').val(s.portraitConnectionSource || 'default');
    $('#rpg_portrait_connection_profile').val(s.portraitConnectionProfileId || '');
    $('#rpg_portrait_completion_preset').val(s.portraitCompletionPresetId || '');
    $('#rpg_portrait_ollama_url').val(s.portraitOllamaUrl || 'http://localhost:11434');
    $('#rpg_portrait_ollama_model').val(s.portraitOllamaModel || '');
    $('#rpg_portrait_openai_url').val(s.portraitOpenaiUrl || '');
    $('#rpg_portrait_openai_key').val(s.portraitOpenaiKey || '');
    $('#rpg_portrait_openai_model').val(s.portraitOpenaiModel || '');
    $('#rpg_portrait_openai_model_manual').val(s.portraitOpenaiModel || '');

    // Sync world progression connection settings UI
    $('#rpg_world_connection_source').val(s.worldConnectionSource || 'default');
    $('#rpg_world_connection_profile').val(s.worldConnectionProfileId || '');
    $('#rpg_world_completion_preset').val(s.worldCompletionPresetId || '');
    $('#rpg_world_ollama_url').val(s.worldOllamaUrl || 'http://localhost:11434');
    $('#rpg_world_ollama_model').val(s.worldOllamaModel || '');
    $('#rpg_world_openai_url').val(s.worldOpenaiUrl || '');
    $('#rpg_world_openai_key').val(s.worldOpenaiKey || '');
    $('#rpg_world_openai_model').val(s.worldOpenaiModel || '');
    $('#rpg_world_openai_model_manual').val(s.worldOpenaiModel || '');

    $('#rpg_gs_wizard_connection_source').val(s.gameSystemWizardConnectionSource || 'default');
    $('#rpg_gs_wizard_connection_profile').val(s.gameSystemWizardConnectionProfileId || '');
    $('#rpg_gs_wizard_completion_preset').val(s.gameSystemWizardCompletionPresetId || '');
    $('#rpg_gs_wizard_ollama_url').val(s.gameSystemWizardOllamaUrl || 'http://localhost:11434');
    $('#rpg_gs_wizard_ollama_model').val(s.gameSystemWizardOllamaModel || '');
    $('#rpg_gs_wizard_openai_url').val(s.gameSystemWizardOpenaiUrl || '');
    $('#rpg_gs_wizard_openai_key').val(s.gameSystemWizardOpenaiKey || '');
    $('#rpg_gs_wizard_openai_model').val(s.gameSystemWizardOpenaiModel || '');
    $('#rpg_gs_wizard_openai_model_manual').val(s.gameSystemWizardOpenaiModel || '');

    // Toggle container visibilities
    $('#rpg_portrait_profile_group').toggle(s.portraitConnectionSource === 'profile');
    $('#rpg_portrait_ollama_group').toggle(s.portraitConnectionSource === 'ollama');
    $('#rpg_portrait_openai_group').toggle(s.portraitConnectionSource === 'openai');
    $('#rpg_world_profile_group').toggle(s.worldConnectionSource === 'profile');
    $('#rpg_world_ollama_group').toggle(s.worldConnectionSource === 'ollama');
    $('#rpg_world_openai_group').toggle(s.worldConnectionSource === 'openai');
    $('#rpg_gs_wizard_profile_group').toggle(s.gameSystemWizardConnectionSource === 'profile');
    $('#rpg_gs_wizard_ollama_group').toggle(s.gameSystemWizardConnectionSource === 'ollama');
    $('#rpg_gs_wizard_openai_group').toggle(s.gameSystemWizardConnectionSource === 'openai');

    // Toggle container visibilities
    if (s.worldProgressionRandomizeNPCs) $('#rpg_world_progression_random_npc_count_container').show();
    else $('#rpg_world_progression_random_npc_count_container').hide();
    if (s.worldProgressionRandomizeLocations) $('#rpg_world_progression_random_location_count_container').show();
    else $('#rpg_world_progression_random_location_count_container').hide();
    if (s.worldProgressionRandomizeFactions) $('#rpg_world_progression_random_faction_count_container').show();
    else $('#rpg_world_progression_random_faction_count_container').hide();

    s.activeProfile = name;
    runtimeState.historyViewIndex = -1;

    saveSettings();
    // Refresh UI
    refreshOrderList();
    // Refresh delta panel
    const dp = document.getElementById('rpg-tracker-delta-content');
    if (dp) dp.innerHTML = s.lastDelta || '<span class="delta-empty">No changes yet.</span>';
    syncMemoView();
}

function refreshProfileDropdown() {
    const s = getSettings();
    const sel = document.getElementById('rpg_tracker_profile_select');
    if (!sel) return;
    const names = Object.keys(s.profiles || {});
    sel.innerHTML = '<option value="">-- No Profile --</option>' +
        names.map(n => `<option value="${escapeHtml(n)}"${n === s.activeProfile ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('');
}

/** Shared Popup options for long help/docs dialogs (scrollable on mobile). */
const RT_HELP_POPUP_OPTS = { okButton: 'Got it', cancelButton: false, allowVerticalScrolling: true };

async function showRngExplanation() {
    const { Popup } = SillyTavern.getContext();
    const card = (icon, title, body) => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; text-align: left;">
                <div style="font-size: 1em; font-weight: bold; margin-bottom: 6px;">${icon} ${title}</div>
                <div style="font-size: 0.9em; line-height: 1.5; opacity: 0.88;">${body}</div>
            </div>`;
    const popupBody = `
            <div style="font-size: 0.9em; line-height: 1.5; max-width: 480px; text-align: left;">
                ${card('🎲', 'Pre-Seeded RNG Queue',
        `Generates a list of pre-rolled dice and injects them directly into the story context. The AI uses the next roll in the queue until it reaches the last one, then wraps about to the start again. Each input injects a fresh set of numbers.<br><br>
                    This is a highly efficient and robust system that works well for both combat and narrative checks. Because it does not require additional tool-calling roundtrips, it reduces token costs, minimizes latency, and is highly reliable due to its reduced structural complexity.<br><br>
                    The only potential weakness is that the AI sees the numbers beforehand, theoretically making it possible for it to 'game' the system by fitting the check to the roll rather than the other way around, but in my experience this never happens. Rolls are failed all the time.<br><br>
                    This potential weakness, however, is completely eliminated in combat because it works on a deterministic, turn-based grid.`
    )}
                ${card('🔧', 'Tool Call RNG',
        `A reactive system where the AI proactively calls a dice tool for a specific narrative action (e.g., picking a lock, persuading a guard). The AI must declare a <b>Difficulty Class (DC)</b> before seeing the result. This ensures it can't "game the system" by lowering the DC to fit a roll or skipping the roll entirely. While Tool Calls guarantee that gaming the roll is technically impossible, they add slightly more latency and structure compared to the queue.`
    )}
                <div style="background: rgba(255,200,50,0.08); border: 1px solid rgba(255,200,50,0.25); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 0.88em; text-align: left;">
                    <b style="color: #ffcc33;">⚠ Important:</b> Tool Call RNG requires <b>"Enable function calling"</b> to be enabled in SillyTavern's AI Response Configuration.
                </div>
                ${card('📋', 'Which system should I use?',
        `<ul style="margin: 4px 0 0 0; padding-left: 20px; text-align: left; list-style-position: outside;">
                        <li style="margin-bottom: 4px;"><b>Pre-Seeded + Tool Calls (recommended without CYOA):</b> Automatically switches by context: outside combat the model sees only <b>RollTheDice</b>; during an active combat round it sees only the <b>RNG Queue</b>. The prompt and available tool schema switch together, so it never sees both RNG systems at once.</li>
                        <li><b>Pre-Seeded Only:</b> Queue-only. Use if your model doesn't support function/tool calling or you prefer the simpler setup. It works just as well for the vast majority of cases.</li>
                    </ul>`
    )}
            </div>`;
    await Popup.show.confirm('🎲 RNG Systems Explained', popupBody, RT_HELP_POPUP_OPTS);
}

/**
 * Renders and shows the Quests Hardcore systems explanation popup.
 */
async function showNarrativePacingExplanation() {
    const { Popup } = SillyTavern.getContext();
    const card = (title, body) => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; text-align: left;">
                <div style="font-size: 1em; font-weight: bold; margin-bottom: 6px;">${title}</div>
                <div style="font-size: 0.9em; line-height: 1.5; opacity: 0.88;">${body}</div>
            </div>`;
    const popupBody = `
            <div style="font-size: 0.9em; line-height: 1.5; max-width: 480px; text-align: left;">
                ${card('Normal', 'Balanced narration. The narrator may lightly paraphrase or expand your dialogue and actions when it fits your character.')}
                ${card('High-Agency Mode', 'Keeps outputs short to moderate in length, leaving more room for you to respond and direct the scene.')}
                ${card('Downtime/Slice of Life Mode', 'Uses a relaxed pace and avoids forcing action-heavy or “save the world” plots. Best for everyday life, character moments, and low-stakes roleplay.')}
            </div>`;
    await Popup.show.confirm('Narrative Pacing Explained', popupBody, RT_HELP_POPUP_OPTS);
}

async function showQuestsHardcoreExplanation() {
    const { Popup } = SillyTavern.getContext();
    const card = (icon, title, body, sub = false) => `
            <div style="background: rgba(255,255,255,${sub ? '0.03' : '0.05'}); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; text-align: left; ${sub ? 'margin-left: 16px;' : ''}">
                <div style="font-size: 1em; font-weight: bold; margin-bottom: 6px;">${icon} ${title}</div>
                <div style="font-size: 0.9em; line-height: 1.5; opacity: 0.88;">${body}</div>
            </div>`;
    const popupBody = `
            <div style="font-size: 0.9em; line-height: 1.5; max-width: 480px; text-align: left;">
                ${card('⏳', 'Deadlines',
        `Adds time-sensitive constraints to quests. The system prompt instructs NPCs to attach deadlines to tasks they give you. If the deadline passes without turning in the quest, it auto-fails. Forces you to prioritise — you can't just accept every task and grind at your leisure.`
    )}
                ${card('🎭', 'Frustration', `Requires Deadlines. A sub-mode where quests <em>don't</em> auto-fail at the deadline. Instead, each quest giver has an NPC happiness level that starts high and quickly drops the longer you leave it past due. The rate of decline depends on the NPC's personality, which the model infers from their archetype and tone. You can still turn the quest in late — but the reception won't be warm.`, true)}
            </div>`;
    await Popup.show.confirm('📋 Quest Mechanics Explained', popupBody, RT_HELP_POPUP_OPTS);
}

async function showComponentsExplanation() {
    const { Popup } = SillyTavern.getContext();
    const card = (icon, title, body) => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; text-align: left;">
                <div style="font-size: 1em; font-weight: bold; margin-bottom: 6px;">${icon} ${title}</div>
                <div style="font-size: 0.9em; line-height: 1.5; opacity: 0.88;">${body}</div>
            </div>`;
    const popupBody = `
            <div style="font-size: 0.9em; line-height: 1.5; max-width: 480px; text-align: left;">
                ${card('🎲', 'Loot',
        `When loot is received, dice rolls are made to determine its quality — whether something is a battered common item or a rare find. Adds meaningful variance to rewards.`
    )}
                ${card('🌍', 'Events',
        `Random events are rolled when time skips or travel occurs. A chance encounter, a weather shift, an ambush — things that happen without the player initiating them. Keeps the world feeling alive.`
    )}
                ${card('💤', 'Resting',
        `Resting is limited to once every 9 hours of in-game time. Prevents exploiting rest as a free heal between every fight, and reflects the reality that you can't just nap on demand.`
    )}
                ${card('🏕️', 'Benched Party',
        `Tracks party members who are temporarily away from you — hospitalized, scouting ahead, captured, sent on a side task, etc. — in a separate [BENCHED PARTY] roster while reunion remains plausible. The GM is told what this means so it won't narrate them back at your side until the story brings them back on-screen. Benched members become eligible for off-screen simulation updates via World Reports (🌍), allowing the simulator to advance their individual subplots in the background. Turn off if you don't want temporary separations tracked separately from your active party.`
    )}
                ${card('🧭', 'CYOA Mode',
        `Choose-your-own-adventure style: the narrator ends outputs with numbered courses of action and fitting emojis so you can pick what to do next.`
    )}
                ${card('💞', 'Relationship System',
        `Tracks friendship, affection, or general reputation deltas between the user and NPCs. Automatically calculates shifts from the chat tone/actions, and visualizes them using custom tracking bars.`
    )}
            </div>`;
    await Popup.show.confirm('🧩 Components Explained', popupBody, RT_HELP_POPUP_OPTS);
}

/**
 * Shows a settings help icon's title text in a popup (mobile-friendly tap/click).
 * Desktop hover still uses the native title tooltip.
 */
async function showSettingsHelpPopup(message, title = 'ℹ️ Help') {
    const text = String(message || '').trim();
    if (!text) return;
    const { Popup } = SillyTavern.getContext();
    const popupBody = `<div style="font-size: 0.92em; line-height: 1.55; max-width: 480px; text-align: left;">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
    await Popup.show.confirm(title, popupBody, RT_HELP_POPUP_OPTS);
}

/** Wire tap/click on settings ? icons; prevents accidental checkbox toggles inside labels. */
function bindSettingsHelpIcons() {
    const container = document.querySelector('.rpg-tracker-settings');
    if (!container || container.dataset.rtSettingsHelpBound === '1') return;
    container.dataset.rtSettingsHelpBound = '1';

    const selector = '.fa-circle-question[title]';
    container.querySelectorAll(selector).forEach(icon => {
        icon.setAttribute('role', 'button');
        icon.setAttribute('tabindex', '0');
        icon.setAttribute('aria-label', 'Show help');
    });

    const openHelp = (icon) => {
        const msg = icon.getAttribute('title');
        if (msg) void showSettingsHelpPopup(msg);
    };

    container.addEventListener('pointerdown', (e) => {
        const icon = e.target.closest(selector);
        if (!icon) return;
        e.preventDefault();
        e.stopPropagation();
    }, true);

    container.addEventListener('click', (e) => {
        const icon = e.target.closest(selector);
        if (!icon) return;
        e.preventDefault();
        e.stopPropagation();
        openHelp(icon);
    }, true);

    container.addEventListener('keydown', (e) => {
        const icon = e.target.closest(selector);
        if (!icon) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        openHelp(icon);
    }, true);
}

/**
 * Renders and shows the Lorebook Agent documentation popup.
 */
async function showLorebookAgentDocumentation() {
    const { Popup } = SillyTavern.getContext();
    const content = `
                        <div style="text-align: left; font-size: 13px; line-height: 1.5; padding-right: 8px;">
                            <h3 style="margin-top: 0; color: var(--rt-custom-accent, #3498db);">The Lorebook Agent</h3>
                            <p>An autonomous narrative librarian. It scans your recent chat, decides what has changed, and writes new or updated entries directly into your SillyTavern lorebooks — no manual data entry needed.</p>

                            <h4 style="margin-bottom: 5px;">⏱️ How Often to Run Lorebook Agent?</h4>
                            <p>By default, the Agent runs every 3 messages, but there are tradeoffs to consider:</p>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Pros of running less often:</b> It can make more coherent entries without excess granularity (though the cleanup tool can retroactively fix this).</li>
                                <li><b>Cons of running less often:</b> Activations will rely more on keywords and might not be quite as pinpoint.</li>
                            </ul>
                            <p style="margin-top:4px;">The recommended range is every <b>1-3</b> messages.</p>

                            <h4 style="margin-bottom: 5px;">🤖 Operating Modes</h4>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Basic Mode (Tags)</b> — The model outputs structured tags the Agent parses directly:<br>
                                    <code style="font-size:11px;">[[NPC: Name | Description | keyword1, keyword2]]</code><br>
                                    Supported types: <code>NPC</code>, <code>LOC</code>, <code>FAC</code>, <code>QUEST</code>, <code>EVENT</code>, plus <code>[[ACTIVATE: name]]</code>, <code>[[DEACTIVATE: name]]</code>, <code>[[DELETE: name]]</code>.<br>
                                    Ideal for smaller/local models (Mistral Small, Gemma, Qwen, etc.).</li>
                                <li style="margin-top:8px;"><b>Advanced Mode (Tools)</b> — Multi-turn ReAct loop: the model reasons (<i>Thought</i>), calls a tool (<i>Action</i>), receives a result (<i>Observation</i>), and repeats until it calls <code>finish</code> or hits Max Turns. Tools include <code>record</code>, <code>update</code>, <code>activate</code>, <code>deactivate</code>, <code>delete</code>, and <code>search</code>. Gemini 3.5 Flash-Lite is highly recommended as it is 100% reliable and very low cost. GPT-5x Mini or even Nano can also be good.</li>
                            </ul>

                            <h4 style="margin-bottom: 5px;">🧠 Attention-Based Memory</h4>
                            <p>The Agent sees two tiers of lorebook content:</p>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Active entries</b> — full content is visible in the Agent's context. Keyword-triggered by SillyTavern and managed via <b>Active Lore Keys</b>.</li>
                                <li><b>Inactive entries</b> — listed only by name and keywords (no content). The Agent must activate them first to read or update their body.</li>
                            </ul>
                            <p style="margin-top:4px;"><b>Max Active</b> caps how many entries can be active simultaneously (FIFO pruning keeps token cost predictable).</p>

                            <h4 style="margin-bottom: 5px;">📂 Campaign Records</h4>
                            <p>The Agent writes directly into SillyTavern's native Lorebook system, creating namespaced campaign books for the current story (e.g. <i>Eldoria_NPCs</i>, <i>Eldoria_Locations</i>, <i>Eldoria_Factions</i>). All books for the active campaign are shown here, grouped by type. Click any folder to expand it; click any entry to read its full content. Books are automatically activated and deactivated based on the current chat — no manual action needed. This includes the <b>World Section</b> (<code>{prefix}_World</code>) created by the World Progression engine, which houses off-screen progression reports.</p>
                            <p style="margin-top:4px;">When <b>Show Location Images</b> is enabled (see below), the panel header switches between <b>Campaign Records</b> and <b>Visualization Mode</b>. With Location Images off, only the standard Campaign Records tree is shown.</p>

                            <h4 style="margin-bottom: 5px;">🗺️ Location Images &amp; Visualization Mode</h4>
                            <p>Location scene art and Visualization Mode are <b>opt-in</b> and <b>off by default</b>. Enable them from <b>Extension Settings → Portraits → Location Images &amp; Visualization</b>.</p>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Show Location Images</b> — Master toggle. When on, the Locations book gains hierarchical scene art: thumbnails on the location tree, wide 16:9 images in detail view, drag-and-drop upload, and the <b>Campaign Records / Visualization Mode</b> switch in this panel. Also turns on automatically if you enable Real-Time Visualization Mode or Auto-Generate Locations.</li>
                                <li><b>Auto-Generate Locations</b> — Background scene art for new location lorebook entries that do not already have an image. Mutually exclusive with Real-Time Visualization Mode.</li>
                                <li><b>Include Present NPCs in Location Scene Prompts</b> — Injects NPCs named in the latest narrator output (Present-Now name scanner: first/last name only, not Lorebook Agent keys) plus the linked Player Character into location image prompts. Locked on while Real-Time Visualization Mode is active.</li>
                                                <li><b>Real-Time Visualization Mode</b> — Generates location images in Visualization Mode from current chat context and characters present. Choose a trigger: <b>On location enter</b> (once per place with no image), <b>On location change</b> (fresh image on each path change including revisits), or <b>Every N outputs</b> (still regenerates on location change, plus every N chat outputs — set N to 1 for every output). Enables Show Location Images and present-NPC prompts as a locked bundle; disables Auto-Generate Locations. Can be turned on without Show Location Images already being enabled first.</li>
                            </ul>
                            <p style="margin-top:8px;"><b>Visualization Mode</b> (agent panel) shows a scene layout driven by your current location from the state memo: a wide location hero image, breadcrumb path, and tiles for characters present (active Lorebook NPCs plus the linked Player Character). Click the hero or a tile to open the full location or character card. Scene art is generated according to your Location Images settings — either on lorebook entry creation (Auto-Generate Locations) or on arrival (Real-Time Visualization Mode).</p>
                            <p style="margin-top:4px;"><i>Tip: With Real-Time Visualization Mode on, use Visualization Mode in the Lorebook Agent to see scene art as you move through the story (trigger depends on your Real-Time settings).</i></p>

                            <h4 style="margin-bottom: 5px;">🧹 Cleanup & Compression</h4>
                            <p>To keep context sizes optimized, the framework uses a two-fold cleanup system:</p>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Active Key Pruning:</b> When the active entry count exceeds the configured limit, the oldest activated entries are automatically deactivated (pruned) to make room for new ones.</li>
                                <li><b>Archivist Compression:</b> You can trigger a cleanup pass globally (via the broom button in the agent header) or on a targeted entry. The <b>Lorebook Archivist</b> will compress bloated entries and consolidate duplicates to save tokens while keeping unique facts and timelines intact.</li>
                            </ul>
                            <p style="margin-top:4px;"><i>Note: Standard Agent passes and standard cleanup/pruning do not process the World book reports. Those are managed independently via World Progression settings.</i></p>

                            <h4 style="margin-bottom: 5px;">↩ History Navigation</h4>
                            <p>The <b>← [ LIVE ] →</b> bar at the bottom lets you step back through lorebook snapshots and redo steps you've undone — just like the State Tracker's memo history. Each agent pass is snapshotted before it runs (up to 5 saved). A new pass clears the redo stack.</p>

                            <h4 style="margin-bottom: 5px;">🛠️ Modular Repertoire</h4>
                            <p>Toggle which entity types the Agent tracks (NPCs, Locations, Factions, Quests, Events) and add <b>Custom Tags</b> for anything world-specific. Every module's system prompt snippet is editable so you control exactly how the AI records data.</p>

                            <h4 style="margin-bottom: 5px;">🕹️ Controls Reference</h4>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Main Lookback</b>: Messages the Agent scans during automatic post-generation runs.</li>
                                <li><b>Max Turns</b>: Maximum ReAct loop iterations before the Agent is forced to finish (Advanced Mode).</li>
                                <li><b>Max Active</b>: Maximum simultaneously active lore entries.</li>
                                <li><b>Direct Command</b>: Runs a one-off agent pass with a custom instruction and its own lookback window — useful for targeted research or corrections.</li>
                            </ul>
                        </div>
                    `;
    await Popup.show.confirm('📖 Lorebook Agent Documentation', content, RT_HELP_POPUP_OPTS);
}

function refreshPortraitPromptPresetsList() {
    const settings = getSettings();
    const container = document.getElementById('rpg_portrait_prompt_presets_container');
    const list = document.getElementById('rpg_portrait_prompt_presets_list');
    if (!container || !list) return;

    const entries = Object.entries(settings.savedPortraitPromptPresets || {});
    if (entries.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    list.innerHTML = '';

    entries.forEach(([name, preset]) => {
        const row = document.createElement('div');
        row.className = 'flex-container alignitemscenter gap-1';
        row.style.background = 'rgba(255,255,255,0.05)';
        row.style.padding = '4px 8px';
        row.style.borderRadius = '4px';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.style.flex = '1';
        nameSpan.style.fontSize = '0.85em';
        nameSpan.style.cursor = 'pointer';
        nameSpan.className = 'interactable';
        nameSpan.title = 'Click to load this portrait prompt setup';
        nameSpan.addEventListener('click', () => {
            settings.portraitNpcSystemPrompt = preset.npcSystemPrompt || '';
            settings.portraitCharacterSystemPrompt = preset.characterSystemPrompt || '';
            if (preset.wordTarget !== undefined) {
                settings.portraitPromptWordTarget = preset.wordTarget;
            }
            saveSettings();

            $('#rpg_portrait_npc_system_prompt').val(settings.portraitNpcSystemPrompt);
            $('#rpg_portrait_character_system_prompt').val(settings.portraitCharacterSystemPrompt);
            if (preset.wordTarget !== undefined) {
                $('#rpg_portrait_prompt_word_target').val(settings.portraitPromptWordTarget);
            }

            toastr['success'](`Loaded portrait prompt setup: ${name}`, 'Portrait Prompt Library');
        });

        const delBtn = document.createElement('i');
        delBtn.className = 'fa-solid fa-trash-can interactable';
        delBtn.style.fontSize = '0.8em';
        delBtn.style.opacity = '0.5';
        delBtn.title = 'Delete setup';
        delBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete the portrait prompt setup "${name}"?`)) {
                delete settings.savedPortraitPromptPresets[name];
                saveSettings();
                refreshPortraitPromptPresetsList();
                toastr['info'](`Deleted setup: ${name}`, 'Portrait Prompt Library');
            }
        });

        row.appendChild(nameSpan);
        row.appendChild(delBtn);
        list.appendChild(row);
    });
}

async function showPortraitSettingsMenu(entityName, onRefresh, npcContent = null) {
    const refresh = onRefresh || refreshRenderedView;
    const s = getSettings();
    const currentSrc = lookupCustomPortraitSrc(s, entityName);
    const zoomWrapperId = `rt-portrait-zoom-wrap-${Date.now()}`;
    const zoomImgId     = `rt-portrait-zoom-img-${Date.now()}`;
    const zoomBadgeId   = `rt-portrait-zoom-badge-${Date.now()}`;
    const previewHtml = currentSrc
        ? `<div id="${zoomWrapperId}" style="position:relative;overflow:hidden;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.4);cursor:zoom-in;user-select:none;margin:0 auto 12px;line-height:0;"><img id="${zoomImgId}" src="${currentSrc}" style="position:absolute;top:0;left:0;display:block;max-width:none;max-height:none;transform-origin:0 0;will-change:transform;"/><div id="${zoomBadgeId}" style="position:absolute;bottom:8px;right:10px;background:rgba(0,0,0,0.55);color:#fff;font-size:11px;padding:2px 7px;border-radius:10px;pointer-events:none;opacity:0;transition:opacity 0.3s;">100%</div></div>`
        : `<div style="text-align:center;opacity:0.5;margin-bottom:10px;">No portrait set</div>`;
    const inputId = `rt-portrait-url-${Date.now()}`;
    const fileId = `rt-portrait-file-${Date.now()}`;
    const browseBtnId = `rt-portrait-browse-${Date.now()}`;
    const popupContent = `<div style="padding:10px;box-sizing:border-box;width:100%;">
            <b style="display:block;margin-bottom:8px;">Set Portrait — ${entityName}</b>
            ${previewHtml}
            <label style="display:block;margin-bottom:4px;font-size:0.85em;opacity:0.8;">Image URL (https://…)</label>
            <div style="display:flex;gap:6px;align-items:center;">
                <input id="${inputId}" type="text" class="text_pole" placeholder="Paste an image URL…" value="${currentSrc.startsWith('http') ? currentSrc : ''}" style="flex:1;box-sizing:border-box;"/>
                <button id="${browseBtnId}" class="menu_button" style="white-space:nowrap;flex-shrink:0;">Browse…</button>
            </div>
            <input id="${fileId}" type="file" accept="image/*" style="display:none"/>
            <div style="font-size:0.78em;opacity:0.55;margin-top:5px;">Or drag &amp; drop onto the portrait box / paste (Ctrl+V) anywhere on this screen.</div>
        </div>`;
    const ctx = SillyTavern.getContext();
    if (!ctx.callGenericPopup) { toastr['warning']('Popup API not available.', 'RPG Tracker'); return; }
    const popupOpts = {
        okButton: 'Apply', cancelButton: 'Cancel', wide: !!currentSrc,
        customButtons: [
            { text: '🤖 AI Generate', result: 4, classes: ['menu_button'] },
        ],
    };
    if (currentSrc) {
        popupOpts.customButtons.push({ text: '✂️ Crop Existing', result: 5, classes: ['menu_button'] });
        popupOpts.customButtons.push({ text: '🗑 Clear Portrait', result: 2, classes: ['menu_button'] });
    }

    const localApply = async (src) => {
        await applyPortraitData(entityName, src);
        refresh();
        void runtimeState.refreshNpcManifest().catch(() => { });
    };

    let capturedUrl = currentSrc.startsWith('http') ? currentSrc : '';
    let capturedRawUrl = '';

    const popupPasteHandler = async (ev) => {
        const file = ev.clipboardData?.files?.[0];
        if (file && file.type.startsWith('image/')) {
            ev.preventDefault();
            ev.stopPropagation();
            try {
                capturedRawUrl = await fileToDataUrl(file);
                capturedUrl = '';
                const urlInput = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));
                if (urlInput) urlInput.value = '(image pasted — click Apply to crop ✔)';
            } catch (err) {
                console.error(err);
                toastr['warning']('Could not read image from clipboard.', 'RPG Tracker');
            }
        }
    };

    setTimeout(() => {
        const fileInput = /** @type {HTMLInputElement|null} */ (document.getElementById(fileId));
        const browseBtn = document.getElementById(browseBtnId);
        const urlInput = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));

        if (urlInput) {
            urlInput.addEventListener('input', () => {
                capturedUrl = urlInput.value.trim();
                capturedRawUrl = '';
            });
        }

        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                fileInput.click();
            });
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files?.[0];
                if (!file) return;
                try {
                    capturedRawUrl = await fileToDataUrl(file);
                    capturedUrl = '';
                    if (urlInput) urlInput.value = '(file selected — click Apply to crop ✔)';
                } catch (err) {
                    console.error(err);
                    toastr['warning']('Could not read image file.', 'RPG Tracker');
                }
            });
        }

        document.addEventListener('paste', popupPasteHandler);

        // ── Zoom & Pan for portrait preview ──────────────────────────────────
        if (currentSrc) {
            const wrap  = document.getElementById(zoomWrapperId);
            const img   = document.getElementById(zoomImgId);
            const badge = document.getElementById(zoomBadgeId);
            if (wrap && img && badge) {
                // panX/panY = image top-left position in wrapper coords.
                // At scale=1 with no pan, image is at (0,0) and wrapper is sized to match.
                let scale    = 1;
                let panX     = 0;
                let panY     = 0;
                let natW     = 0;   // image display width at scale=1
                let natH     = 0;   // image display height at scale=1
                let isDragging  = false;
                let didDrag     = false;
                let dragStartX  = 0, dragStartY  = 0;
                let dragStartPX = 0, dragStartPY = 0;
                let badgeTimer  = null;
                let maxW = 800; // will be set in initView
                let maxH = 600; // will be set in initView
                const MIN_SCALE = 1;
                const MAX_SCALE = 8;

                /** Apply the current transform and cursor style. */
                function applyTransform(animated) {
                    img.style.transition = animated ? 'transform 0.22s ease' : 'none';
                    img.style.transform  = `translate(${panX}px,${panY}px) scale(${scale})`;
                    wrap.style.cursor    = scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in';
                }

                function showBadge() {
                    badge.textContent  = Math.round(scale * 100) + '%';
                    badge.style.opacity = '1';
                    clearTimeout(badgeTimer);
                    badgeTimer = setTimeout(() => { badge.style.opacity = '0'; }, 1400);
                }

                /**
                 * Clamp panX/panY so:
                 * - if the scaled image is wider/taller than the wrapper: keep it filling the wrapper
                 *   (pan range = 0 .. wrapSize - scaledSize, i.e. the full image is reachable)
                 * - if smaller: center it
                 */
                function clampPan(newPX, newPY, wrapW, wrapH) {
                    const scaledW = natW * scale;
                    const scaledH = natH * scale;
                    wrapW = wrapW ?? wrap.offsetWidth;
                    wrapH = wrapH ?? wrap.offsetHeight;
                    let x = newPX, y = newPY;
                    if (scaledW >= wrapW) {
                        x = Math.min(0, Math.max(wrapW - scaledW, x));
                    } else {
                        x = (wrapW - scaledW) / 2;
                    }
                    if (scaledH >= wrapH) {
                        y = Math.min(0, Math.max(wrapH - scaledH, y));
                    } else {
                        y = (wrapH - scaledH) / 2;
                    }
                    return [x, y];
                }

                /**
                 * Zoom to newScale keeping the wrapper-space point (cx, cy) fixed.
                 * Also resizes the wrapper to match the zoom up to maxW/maxH, 
                 * and compensates for the popup re-centering layout shift.
                 */
                function zoomAt(cx, cy, newScale) {
                    const oldW = wrap.offsetWidth;
                    const oldH = wrap.offsetHeight;
                    
                    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
                    const sf = newScale / scale;
                    scale    = newScale;
                    
                    const newW = Math.min(maxW, Math.round(natW * scale));
                    const newH = Math.min(maxH, Math.round(natH * scale));
                    wrap.style.width  = newW + 'px';
                    wrap.style.height = newH + 'px';
                    
                    // The popup is centered, so expanding it shifts its top-left corner
                    const shiftX = (newW - oldW) / 2;
                    const shiftY = (newH - oldH) / 2;
                    
                    // Compensate the anchor point and current pan for the coordinate system shift
                    const adjCx = cx + shiftX;
                    const adjCy = cy + shiftY;
                    const adjPanX = panX + shiftX;
                    const adjPanY = panY + shiftY;
                    
                    [panX, panY] = clampPan(
                        adjCx - sf * (adjCx - adjPanX),
                        adjCy - sf * (adjCy - adjPanY),
                        newW, newH
                    );
                    
                    if (scale <= MIN_SCALE) { panX = 0; panY = 0; }
                }

                function resetZoom(animated) {
                    scale = 1; panX = 0; panY = 0;
                    wrap.style.width  = natW + 'px';
                    wrap.style.height = natH + 'px';
                    applyTransform(animated);
                    showBadge();
                }

                /** Size the wrapper and image to the constrained display dimensions, then init pan. */
                function initView() {
                    if (!img.naturalWidth) return;
                    const parentW = wrap.parentElement ? wrap.parentElement.offsetWidth - 20 : window.innerWidth * 0.85;
                    maxW = Math.min(window.innerWidth * 0.85, parentW);
                    maxH = window.innerHeight * 0.80;
                    const ratio   = img.naturalWidth / img.naturalHeight;
                    let dispW     = img.naturalWidth;
                    let dispH     = img.naturalHeight;
                    if (dispW > maxW) { dispW = maxW; dispH = dispW / ratio; }
                    if (dispH > maxH) { dispH = maxH; dispW = dispH * ratio; }
                    natW = Math.round(dispW);
                    natH = Math.round(dispH);
                    // Lock the image's pixel size so transforms don't fight CSS constraints
                    img.style.width  = natW + 'px';
                    img.style.height = natH + 'px';
                    // Size the wrapper to exactly match — panX=0,panY=0 means image fills wrapper
                    wrap.style.width  = natW + 'px';
                    wrap.style.height = natH + 'px';
                    panX = 0; panY = 0;
                    applyTransform(false);
                }

                img.addEventListener('load', initView);
                if (img.complete && img.naturalWidth) initView();

                // ── Scroll to zoom, cursor-anchored ──
                wrap.addEventListener('wheel', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const rect = wrap.getBoundingClientRect();
                    const cx   = ev.clientX - rect.left;
                    const cy   = ev.clientY - rect.top;
                    zoomAt(cx, cy, scale * (ev.deltaY > 0 ? 0.88 : 1.12));
                    applyTransform(false);
                    showBadge();
                }, { passive: false });

                // ── Click to zoom in at cursor, or reset if already zoomed ──
                wrap.addEventListener('click', (ev) => {
                    if (didDrag) { didDrag = false; return; }
                    const rect = wrap.getBoundingClientRect();
                    const cx   = ev.clientX - rect.left;
                    const cy   = ev.clientY - rect.top;
                    if (scale <= MIN_SCALE) {
                        zoomAt(cx, cy, 2.5);
                        applyTransform(true);
                    } else {
                        resetZoom(true);
                    }
                    showBadge();
                });

                // ── Double-click to reset ──
                wrap.addEventListener('dblclick', (ev) => {
                    ev.stopPropagation();
                    resetZoom(true);
                });

                // ── Drag to pan ──
                wrap.addEventListener('mousedown', (ev) => {
                    if (scale <= 1) return;
                    isDragging   = true;
                    didDrag      = false;
                    dragStartX   = ev.clientX;
                    dragStartY   = ev.clientY;
                    dragStartPX  = panX;
                    dragStartPY  = panY;
                    applyTransform(false);
                    ev.preventDefault();
                });

                const onMouseMove = (ev) => {
                    if (!isDragging) return;
                    const dx = ev.clientX - dragStartX;
                    const dy = ev.clientY - dragStartY;
                    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag = true;
                    [panX, panY] = clampPan(dragStartPX + dx, dragStartPY + dy);
                    applyTransform(false);
                };

                const onMouseUp = () => {
                    if (!isDragging) return;
                    isDragging = false;
                    applyTransform(false);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup',   onMouseUp);

                // ── Pinch-to-zoom (touch) ──
                let lastPinchDist = null;
                wrap.addEventListener('touchstart', (ev) => {
                    if (ev.touches.length === 2) {
                        const dx = ev.touches[0].clientX - ev.touches[1].clientX;
                        const dy = ev.touches[0].clientY - ev.touches[1].clientY;
                        lastPinchDist = Math.hypot(dx, dy);
                    }
                }, { passive: true });

                wrap.addEventListener('touchmove', (ev) => {
                    if (ev.touches.length === 2 && lastPinchDist !== null) {
                        ev.preventDefault();
                        const dx   = ev.touches[0].clientX - ev.touches[1].clientX;
                        const dy   = ev.touches[0].clientY - ev.touches[1].clientY;
                        const dist = Math.hypot(dx, dy);
                        const rect  = wrap.getBoundingClientRect();
                        const midX  = (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - rect.left;
                        const midY  = (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - rect.top;
                        zoomAt(midX, midY, scale * (dist / lastPinchDist));
                        applyTransform(false);
                        showBadge();
                        lastPinchDist = dist;
                    }
                }, { passive: false });

                wrap.addEventListener('touchend', () => { lastPinchDist = null; }, { passive: true });

                // ── Cleanup when popup is dismissed ──
                const origPopupCleanup = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup',   onMouseUp);
                    clearTimeout(badgeTimer);
                };
                setTimeout(() => {
                    const popup = wrap.closest('.popup, .dialogue_popup, [class*="popup"]');
                    if (popup) {
                        const closeBtn = popup.querySelector('.popup-close, .menu_button[data-result="0"], button[data-result]');
                        if (closeBtn) closeBtn.addEventListener('click', origPopupCleanup, { once: true });
                    }
                    const observer = new MutationObserver(() => {
                        if (!document.contains(wrap)) { origPopupCleanup(); observer.disconnect(); }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }, 50);
            }
        }
        // ─────────────────────────────────────────────────────────────────────
    }, 0);

    const result = await ctx.callGenericPopup(popupContent, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', popupOpts);

    document.removeEventListener('paste', popupPasteHandler);

    if (result === 2) {
        await localApply(null);
    } else if (result === 5) {
        try {
            const cropped = await ctx.callGenericPopup(
                'Set the crop position of the portrait',
                ctx.POPUP_TYPE?.CROP ?? 4,
                '',
                { cropImage: currentSrc, cropAspect: 1 }
            );
            if (cropped) {
                const scaled = await scaleImageTo512Square(cropped);
                await localApply(scaled);
            }
        } catch (err) {
            console.error(err);
            toastr['warning']('Could not crop existing image.', 'RPG Tracker');
        }
    } else if (result === 4) {
        try {
            if (s.portraitSkipPromptDialog) {
                imageGenToast('info', `Generating portrait for ${entityName} in background…`, 'RPG Tracker');
                const aiPrompt = npcContent !== null
                    ? await generateNpcPortraitPrompt(entityName, npcContent)
                    : await generatePortraitPrompt(entityName);
                if (!aiPrompt) {
                    toastr['warning']('Could not generate prompt — no context found.', 'RPG Tracker');
                    return;
                }
                imageGenToast('info', `Generating image for ${entityName}…`, 'RPG Tracker');
                const dataUrl = await generatePortraitDirect(aiPrompt, entityName);
                const scaled = await scaleImageTo512Square(dataUrl);
                await localApply(scaled);
                imageGenToast('success', `Portrait auto-generated and applied for ${entityName}!`, 'RPG Tracker');
            } else {
                imageGenToast('info', 'Generating portrait prompt…', 'RPG Tracker');
                const aiPrompt = npcContent !== null
                    ? await generateNpcPortraitPrompt(entityName, npcContent)
                    : await generatePortraitPrompt(entityName);
                if (aiPrompt) {
                    await showPortraitPromptPopup(aiPrompt, entityName, localApply, refresh);
                } else {
                    toastr['warning']('Could not generate prompt — no context found.', 'RPG Tracker');
                }
            }
        } catch (err) {
            console.error('[RPG Tracker] AI portrait error:', err);
            toastr['error']('AI portrait generation failed: ' + (err.message || err), 'RPG Tracker');
        }
    } else if (result) {
        if (capturedRawUrl) {
            try {
                const cropped = await ctx.callGenericPopup(
                    'Set the crop position of the portrait',
                    ctx.POPUP_TYPE?.CROP ?? 4,
                    '',
                    { cropImage: capturedRawUrl, cropAspect: 1 }
                );
                if (cropped) {
                    const scaled = await scaleImageTo512Square(cropped);
                    await localApply(scaled);
                }
            } catch (err) {
                console.error(err);
                toastr['warning']('Could not crop image.', 'RPG Tracker');
            }
        } else if (capturedUrl && (capturedUrl.startsWith('data:image/') || /^https?:\/\//i.test(capturedUrl))) {
            await localApply(capturedUrl);
        } else if (capturedUrl) {
            toastr['warning']('Please enter a valid https:// URL or use the Browse button.', 'RPG Tracker');
        }
    }
}

async function showLocationImageSettingsMenu(locationPath, onRefresh, locContent = '') {
    const refresh = onRefresh || refreshRenderedView;
    const s = getSettings();
    const normPath = normalizeLocationPath(locationPath);
    const imageMeta = resolveLocationImageWithMeta(normPath);
    const currentSrc = imageMeta.src;
    const previewHtml = currentSrc
        ? `<img src="${escapeHtml(currentSrc)}" style="max-width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;display:block;margin:0 auto 10px;"/>`
        : `<div style="text-align:center;opacity:0.5;margin-bottom:10px;">No location image set</div>`;
    const inputId = `rt-loc-image-url-${Date.now()}`;
    const fileId = `rt-loc-image-file-${Date.now()}`;
    const browseBtnId = `rt-loc-image-browse-${Date.now()}`;
    const popupContent = `<div style="padding:10px;min-width:300px;">
            <b style="display:block;margin-bottom:8px;">Set Location Image</b>
            <div style="font-size:0.78em;opacity:0.65;margin-bottom:8px;">${escapeHtml(normPath)}</div>
            ${previewHtml}
            <label style="display:block;margin-bottom:4px;font-size:0.85em;opacity:0.8;">Image URL (https://…)</label>
            <div style="display:flex;gap:6px;align-items:center;">
                <input id="${inputId}" type="text" class="text_pole" placeholder="Paste an image URL…" value="${currentSrc.startsWith('http') ? escapeHtml(currentSrc) : ''}" style="flex:1;box-sizing:border-box;"/>
                <button id="${browseBtnId}" class="menu_button" style="white-space:nowrap;flex-shrink:0;">Browse…</button>
            </div>
            <input id="${fileId}" type="file" accept="image/*" style="display:none"/>
            <div style="font-size:0.78em;opacity:0.55;margin-top:5px;">Or drag &amp; drop onto the image / paste (Ctrl+V) on this screen.</div>
        </div>`;
    const ctx = SillyTavern.getContext();
    if (!ctx.callGenericPopup) { toastr['warning']('Popup API not available.', 'RPG Tracker'); return; }
    const popupOpts = {
        okButton: 'Apply', cancelButton: 'Cancel', wide: false,
        customButtons: [
            { text: '🤖 AI Generate', result: 4, classes: ['menu_button'] },
        ],
    };
    if (currentSrc) {
        popupOpts.customButtons.push({ text: '✂️ Crop Existing', result: 5, classes: ['menu_button'] });
        popupOpts.customButtons.push({ text: '🗑 Clear Image', result: 2, classes: ['menu_button'] });
    }

    const localApply = async (src) => {
        let finalSrc = src;
        if (src && typeof src === 'string' && src.startsWith('data:image/')) {
            finalSrc = await scaleImageToLandscape(src);
        }
        await applyLocationImageData(normPath, finalSrc);
        refresh();
        void runtimeState.refreshNpcManifest().catch(() => { });
    };

    let capturedUrl = currentSrc.startsWith('http') ? currentSrc : '';
    let capturedRawUrl = '';

    const popupPasteHandler = async (ev) => {
        const file = ev.clipboardData?.files?.[0];
        if (file && file.type.startsWith('image/')) {
            ev.preventDefault();
            ev.stopPropagation();
            try {
                capturedRawUrl = await fileToDataUrl(file);
                capturedUrl = '';
                const urlInput = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));
                if (urlInput) urlInput.value = '(image pasted — click Apply to crop ✔)';
            } catch (err) {
                console.error(err);
                toastr['warning']('Could not read image from clipboard.', 'RPG Tracker');
            }
        }
    };

    setTimeout(() => {
        const fileInput = /** @type {HTMLInputElement|null} */ (document.getElementById(fileId));
        const browseBtn = document.getElementById(browseBtnId);
        const urlInput = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));

        if (urlInput) {
            urlInput.addEventListener('input', () => {
                capturedUrl = urlInput.value.trim();
                capturedRawUrl = '';
            });
        }

        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                fileInput.click();
            });
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files?.[0];
                if (!file) return;
                try {
                    capturedRawUrl = await fileToDataUrl(file);
                    capturedUrl = '';
                    if (urlInput) urlInput.value = '(file selected — click Apply to crop ✔)';
                } catch (err) {
                    console.error(err);
                    toastr['warning']('Could not read image file.', 'RPG Tracker');
                }
            });
        }

        document.addEventListener('paste', popupPasteHandler);
    }, 0);

    const result = await ctx.callGenericPopup(popupContent, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', popupOpts);
    document.removeEventListener('paste', popupPasteHandler);

    if (result === 2) {
        await localApply(null);
    } else if (result === 5) {
        try {
            const cropped = await ctx.callGenericPopup(
                'Set the crop position of the location image',
                ctx.POPUP_TYPE?.CROP ?? 4,
                '',
                { cropImage: currentSrc, cropAspect: 16 / 9 }
            );
            if (cropped) {
                const scaled = await scaleImageToLandscape(cropped);
                await localApply(scaled);
            }
        } catch (err) {
            console.error(err);
            toastr['warning']('Could not crop existing image.', 'RPG Tracker');
        }
    } else if (result === 4) {
        try {
            if (s.portraitSkipPromptDialog) {
                imageGenToast('info', `Generating location image for ${normPath} in background…`, 'RPG Tracker');
                const aiPrompt = await generateLocationImagePrompt(normPath, locContent || '');
                if (!aiPrompt) {
                    toastr['warning']('Could not generate prompt — no context found.', 'RPG Tracker');
                    return;
                }
                const dataUrl = await generatePortraitDirect(aiPrompt, normPath);
                const scaled = await scaleImageToLandscape(dataUrl);
                await localApply(scaled);
                imageGenToast('success', `Location image generated for ${normPath}!`, 'RPG Tracker');
            } else {
                imageGenToast('info', 'Generating location image prompt…', 'RPG Tracker');
                const aiPrompt = await generateLocationImagePrompt(normPath, locContent || '');
                if (aiPrompt) {
                    await showPortraitPromptPopup(aiPrompt, normPath, localApply, refresh);
                } else {
                    toastr['warning']('Could not generate prompt — no context found.', 'RPG Tracker');
                }
            }
        } catch (err) {
            console.error('[RPG Tracker] AI location image error:', err);
            toastr['error']('AI location image generation failed: ' + (err.message || err), 'RPG Tracker');
        }
    } else if (result) {
        if (capturedRawUrl) {
            try {
                const cropped = await ctx.callGenericPopup(
                    'Set the crop position of the location image',
                    ctx.POPUP_TYPE?.CROP ?? 4,
                    '',
                    { cropImage: capturedRawUrl, cropAspect: 16 / 9 }
                );
                if (cropped) {
                    const scaled = await scaleImageToLandscape(cropped);
                    await localApply(scaled);
                }
            } catch (err) {
                console.error(err);
                toastr['warning']('Could not crop image.', 'RPG Tracker');
            }
        } else if (capturedUrl && (capturedUrl.startsWith('data:image/') || /^https?:\/\//i.test(capturedUrl))) {
            await localApply(capturedUrl);
        } else if (capturedUrl) {
            toastr['warning']('Please enter a valid https:// URL or use the Browse button.', 'RPG Tracker');
        }
    }
}

/** Sync Create Persona prefs from the onboarding DOM into settings (call before sendDirectPrompt). */
function syncOnboardingPersonaPrefsFromDom(el) {
    if (!el) return;
    const cb = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-onboarding-persona-cb'));
    const wordsSelect = /** @type {HTMLSelectElement|null} */ (el.querySelector('#rt-onboarding-persona-words'));
    const wordsCustom = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-onboarding-persona-words-custom'));
    const s = getSettings();
    if (cb) s.onboardingCreatePersona = !!cb.checked;
    if (wordsSelect) s.onboardingPersonaWords = wordsSelect.value || '150';
    if (wordsCustom) s.onboardingPersonaWordsCustom = wordsCustom.value || '';
    saveSettings();
}

/**
 * After a quick onboarding generate, optionally write a persona bio.
 * Uses settings (not DOM) because sendDirectPrompt → refreshRenderedView removes the onboarding UI.
 */
async function maybeCreateOnboardingPersona(extraHints = '') {
    const s = getSettings();
    if (!s.onboardingCreatePersona) return;
    const wordsRaw = s.onboardingPersonaWords === 'other'
        ? s.onboardingPersonaWordsCustom
        : s.onboardingPersonaWords;
    const wordCount = parseInt(String(wordsRaw || '150'), 10) || 150;
    const charName = extractCharNameFromMemo(s.currentMemo) || 'My Character';
    toastr['info'](`Generating persona bio for "${charName}"…`, 'RPG Tracker');
    const bio = await generatePersonaBio(charName, wordCount, extraHints);
    if (bio) {
        showPersonaConfirmOverlay(bio, charName, wordCount, extraHints);
    } else {
        toastr['warning']('Character created, but persona bio generation failed.', 'RPG Tracker');
    }
}



/**
 * Quests for UI display: active quests from memo; archived from settings.quests when enabled.
 * @param {string} memoText
 * @returns {any[]}
 */
function getDisplayQuests(memoText) {
    const s = getSettings();
    const showArchive = s.syspromptModules?.questsShowArchive !== false;
    const memoQuests = parseQuestsFromMemo(memoText);
    const activeFromMemo = memoQuests.filter(q => !isArchivedQuestStatus(q.status));

    if (!showArchive) {
        return activeFromMemo;
    }

    const memoIds = new Set(memoQuests.map(q => q.id));
    const archivedFromSettings = (s.quests || []).filter(q =>
        isArchivedQuestStatus(q.status) && !memoIds.has(q.id)
    );
    // Include archived rows still in memo until the next strip pass
    const archivedFromMemo = memoQuests.filter(q => isArchivedQuestStatus(q.status));

    const seen = new Set();
    /** @type {any[]} */
    const deduped = [];
    for (const q of [...activeFromMemo, ...archivedFromMemo, ...archivedFromSettings]) {
        if (!q?.id || seen.has(q.id)) continue;
        seen.add(q.id);
        deduped.push(q);
    }

    if (memoQuests.length > 0 || /\[QUESTS\]/i.test(memoText || '')) {
        return deduped;
    }
    if (runtimeState.historyViewIndex === -1 && s.quests && s.quests.length > 0) {
        return s.quests;
    }
    return activeFromMemo;
}

export function refreshRenderedView() {
    if (!runtimeState.renderedViewActive) return;
    // Before rendering cards: if Raw View renamed an entity, move the portrait key first
    // so the container is not empty and auto-gen does not treat it as a new character.
    reconcileMemoPortraitRenames();
    const s = getSettings();
    const memo = runtimeState.historyViewIndex === -1
        ? s.currentMemo
        : (s.memoHistory[runtimeState.historyViewIndex] ?? '');

    const collapsed = loadCollapsed();
    const detached = loadDetached();

    // Extract world time from THIS snapshot for frustration computation
    const timeMatch = (memo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    const currentTime = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';

    const el = document.getElementById('rpg-tracker-render');
    if (el) {
        const questsEnabled = s.syspromptModules?.quests !== false && !!(memo && memo.trim());
        let html;

        if (s.panelLayoutMode === 'tabs') {
            const questsCtx = questsEnabled ? { quests: getDisplayQuests(memo), currentTime } : null;
            html = renderTabModeView(memo, _sectionPages, questsCtx);
        } else {
            html = renderMemoAsCards(memo, null, _sectionPages);
            // Append quest log section if module is enabled and we are not on the onboarding screen
            if (questsEnabled) {
                html += renderQuestLog(getDisplayQuests(memo), currentTime, collapsed, detached);
            }
        }

        el.innerHTML = html;
        bindRenderedCardEvents(el, memo, false);

        // Restore Character Creator panel if it was open before the DOM swap (onboarding screen only)
        if (!memo || !memo.trim()) {
            const emptyEl = el.querySelector('.rt-empty');
            if (emptyEl && s.characterCreatorPanelOpen) {
                showCharacterRollPanel(emptyEl);
            }
        }

        // Update footer location: try parsing from recent chat status footer first, fallback to memo
        const ctx = SillyTavern.getContext();
        const locText = getCurrentLocationText(memo, ctx);
        const locLabel = locText || 'Unknown Location';
        const locTitle = locText ? `Location: ${locText}` : 'Unknown Location';
        document.querySelectorAll('#rt-footer-location, #rt-agent-footer-location').forEach((el) => {
            el.textContent = locLabel;
            el.title = locTitle;
        });

        // In Tab Mode, surface the current in-world time in the footer so it stays
        // glanceable without needing to open the Time tab.
        const footerTime = document.getElementById('rt-footer-time');
        if (footerTime) {
            if (s.panelLayoutMode === 'tabs' && currentTime) {
                const { emoji, color } = getTimeOfDayInfo(currentTime);
                footerTime.style.display = 'inline-flex';
                footerTime.style.color = color !== 'inherit' ? color : '';
                footerTime.textContent = emoji ? `${emoji} ${currentTime}` : currentTime;
                footerTime.title = `Current Time: ${currentTime}`;
            } else {
                footerTime.style.display = 'none';
            }
        }
    }

    // Update any detached panels
    detached.forEach(tag => {
        const panel = document.getElementById(`rt-detached-panel-${tag}`);
        if (panel) {
            const body = panel.querySelector('.rpg-tracker-detached-body');
            if (body) {
                if (tag === 'QUESTS') {
                    body.innerHTML = renderQuestLog(getDisplayQuests(memo), currentTime, collapsed, detached, 'QUESTS');
                } else {
                    body.innerHTML = renderMemoAsCards(memo, tag, _sectionPages);
                }
                bindRenderedCardEvents(body, memo, true);
            }
        } else {
            // Panel missing, recreate it
            createDetachedPanel(tag);
        }
    });

    if (runtimeState.historyViewIndex === -1) {
        scheduleDeferred(() => checkAndTriggerAutoGenerations(refreshAll));
    }

    void globalThis._rpgRefreshAgentManifest().catch(() => { });
}







/**
 * UI Implementation
 */
function createPanel() {
    return buildPanel({
        DEFAULT_MODULES,
        DEFAULT_NPC_SECTIONS,
        DEFAULT_PC_SECTIONS,
        activateCampaignBooks,
        applyLocationImageData,
        applyLocationImageSetting,
        applyNpcPortraitSetting,
        applyPanelBackgroundToDom,
        applyPortraitData,
        applyQuestSyncAndStripMemo,
        applyRelTierBadgeElement,
        autoGenerateEnemyPortraits,
        autoGeneratePartyPortraits,
        buildImmersionSceneState,
        buildLocationPath,
        buildNpcInstruction,
        canResizePanels,
        checkAndTriggerAutoGenerations,
        clampRelationshipValue,
        confirmAndPurgeWorldHistory,
        deleteLorebookEntry,
        escapeHtml,
        extractCurrentTimeStr,
        fileToDataUrl,
        formatInWorldTime,
        getLorebookManifest,
        getNarrativeBlocks,
        getNpcRelationshipMax,
        getNpcRelationshipMaxDefault,
        getRequestHeaders,
        getRouterTick,
        getSettings,
        handleTrackerEnabledChange,
        isRouterRunning,
        loadChatState,
        loadDeltaHeight,
        loadLocationEntryByPath,
        loadNpcEntryByKey,
        loadPanelGeometry,
        lookupCustomPortraitSrc,
        makeDraggable,
        makeResizableBL,
        makeResizableBR,
        makeResizableTR,
        maybeAutoGenerateImmersionSceneArt,
        memoForGmContext,
        navigateSnapshot,
        normalizeLocationPath,
        openNpcSectionEditor,
        parseInWorldTime,
        reapplyRouterPass,
        refreshAgentManifestNow,
        refreshAll,
        refreshDayNightCycleFromMemo,
        refreshLorebookAgentViewsNow,
        refreshRenderedView,
        relationshipBarPct,
        removeAllPortraits,
        renamePortraitEntity,
        renderImmersionViewHtml,
        renderLorebookTerminal,
        renderRelTierDetailed,
        renderRelTierRow,
        resolveLocationImageWithMeta,
        resolvePortraitSrcForPlayerCharacter,
        rollbackRouterPass,
        runRealtimeSceneArtCheck,
        runRouterPass,
        runStateModelPass,
        sanitizeLorebookRecordContent,
        saveChatState,
        saveSettings,
        scaleImageTo512Square,
        scaleImageToLandscape,
        sendDirectPrompt,
        sendStateRequest,
        setNpcRelationshipMaxForCurrentChat,
        setupDeltaResize,
        setupResizeObserver,
        showLocationImageSettingsMenu,
        showLorebookAgentDocumentation,
        showPortraitSettingsMenu,
        stopRouterPass,
        syncCampaignPrefixAndWorldsForChat,
        syncMemoView,
        syncRouterPrefixDisplays,
        toggleDebugViewer,
        updateAgentStatusIndicator,
        updateChatLinkUI,
        updateLorebookEntry,
        updatePanelStatus,
    });
}

function navigateSnapshot(direction) {
    const s = getSettings();
    const L = s.historyIndex === undefined ? -1 : s.historyIndex;
    const maxIndex = s.memoHistory.length - 1;
    const maxPos = L === -1 ? maxIndex + 1 : maxIndex;

    let pos = L === -1
        ? (runtimeState.historyViewIndex === -1 ? 0 : runtimeState.historyViewIndex + 1)
        : (runtimeState.historyViewIndex === -1 ? L : runtimeState.historyViewIndex);

    pos += direction;

    if (pos < 0) pos = 0;
    if (pos > maxPos) pos = maxPos;

    runtimeState.historyViewIndex = L === -1
        ? (pos === 0 ? -1 : pos - 1)
        : (pos === L ? -1 : pos);

    syncMemoView();
}

/** CSS class suffixes for each day/night phase (paired with rt-phase-* on panels). */
const DAYNIGHT_PHASE_CLASSES = [
    'rt-phase-lateNight', 'rt-phase-dawn', 'rt-phase-morning', 'rt-phase-midday',
    'rt-phase-afternoon', 'rt-phase-sunset', 'rt-phase-night',
];

/**
 * Applies day/night cycle styling to all tracker panels: phase CSS vars + header badge.
 * @param {object} settings
 * @param {string} memoText
 */
function applyDayNightCycleUI(settings, memoText) {
    const timeMatch = (memoText || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    const currentTimeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
    const phase = currentTimeStr ? getTimeOfDayInfo(currentTimeStr).phase : '';
    const cycleActive = !!(settings.dayNightCycleEnabled && phase);
    const bgNightPhase = phase === 'night' || phase === 'lateNight';

    for (const panel of document.querySelectorAll('.rpg-tracker-panel')) {
        panel.classList.toggle('rt-daynight-active', cycleActive);
        panel.classList.toggle('rt-bg-night-phase', bgNightPhase);
        for (const cls of DAYNIGHT_PHASE_CLASSES) panel.classList.remove(cls);
        if (cycleActive) panel.classList.add(`rt-phase-${phase}`);
    }

    const daynightSlot = document.getElementById('rt-daynight-badge-slot');
    if (daynightSlot) {
        if (cycleActive) {
            daynightSlot.innerHTML = currentTimeStr ? renderDayNightBadge(currentTimeStr) : '';
        } else {
            daynightSlot.innerHTML = '';
        }
    }
}

/** Re-reads [TIME] from memo text and applies day/night panel tint + header badge. */
function refreshDayNightCycleFromMemo(memoText) {
    applyDayNightCycleUI(getSettings(), memoText || '');
}

/** Re-applies day/night cycle from the live memo textarea (or saved memo). */
function refreshDayNightCycleFromCurrentMemo() {
    const settings = getSettings();
    const ta = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('rpg-tracker-memo'));
    refreshDayNightCycleFromMemo(ta ? ta.value : settings.currentMemo || '');
}

/**
 * Compresses a panel backdrop for settings storage (max edge 1280px, JPEG).
 * @param {string} dataUrl
 * @param {number} [maxDim=1280]
 * @returns {Promise<string>}
 */


export function syncMemoView() {
    const s = getSettings();
    const textarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('rpg-tracker-memo'));
    const navLabel = document.getElementById('rpg-tracker-nav-label');
    const btnBack = /** @type {HTMLButtonElement|null} */ (document.getElementById('rpg-tracker-nav-back'));
    const btnFwd = /** @type {HTMLButtonElement|null} */ (document.getElementById('rpg-tracker-nav-fwd'));
    const counter = document.getElementById('rpg-tracker-count');
    if (!textarea || !navLabel) return;

    const histLen = s.memoHistory.length;
    const L = s.historyIndex === undefined ? -1 : s.historyIndex;
    const livePos = L === -1 ? 0 : L;
    const currentPos = L === -1
        ? (runtimeState.historyViewIndex === -1 ? 0 : runtimeState.historyViewIndex + 1)
        : (runtimeState.historyViewIndex === -1 ? L : runtimeState.historyViewIndex);

    const maxPos = L === -1 ? histLen : histLen - 1;

    if (runtimeState.historyViewIndex === -1) {
        // LIVE stone
        textarea.value = s.currentMemo;
        textarea.readOnly = false;
        navLabel.classList.remove('clickable');
        navLabel.title = 'Current Live State';
    } else {
        // Snapshot stone
        const snapshot = s.memoHistory[runtimeState.historyViewIndex];
        textarea.value = snapshot ?? '';
        textarea.readOnly = true;
        navLabel.classList.add('clickable');
        navLabel.title = 'Click to RESTORE this state as LIVE';
    }

    const distance = currentPos - livePos;
    if (distance === 0) {
        navLabel.textContent = '[ LIVE ]';
    } else if (distance > 0) {
        navLabel.textContent = `[ -${distance} 🔄 ]`;
    } else {
        navLabel.textContent = `[ +${Math.abs(distance)} 🔄 ]`;
    }

    btnBack.disabled = currentPos >= maxPos;
    btnFwd.disabled = currentPos <= 0;

    if (counter) {
        counter.textContent = `~${Math.round(textarea.value.length / 2.62)} tokens`;
    }

    // Update delta panel: always show the diff that created the currently-viewed state
    const deltaPanel = document.getElementById('rpg-tracker-delta-content');
    if (deltaPanel) {
        let deltaHtml = '';
        const activeIdx = (runtimeState.historyViewIndex === -1) ? L : runtimeState.historyViewIndex;

        if (activeIdx === -1) {
            deltaHtml = s.lastDelta || '<span class="delta-empty">No changes yet.</span>';
        } else {
            const current = s.memoHistory[activeIdx];
            const previous = s.memoHistory[activeIdx + 1] || '';
            deltaHtml = computeDelta(previous, current);
        }
        deltaPanel.innerHTML = deltaHtml;
    }

    // Keep settings.quests aligned with the live memo (rollback/restore only updates currentMemo).
    if (runtimeState.historyViewIndex === -1) {
        const stripped = applyQuestSyncAndStripMemo(s.currentMemo);
        if (stripped !== s.currentMemo) {
            s.currentMemo = stripped;
            updateUIMemo(stripped);
        }
        void syncCombatProfile(s.currentMemo, s);
        void syncDynamicRngPrompt(s.currentMemo, s);
    }

    // Day/Night Cycle — tint all tracker panels + header sky badge from [TIME].
    refreshDayNightCycleFromMemo(textarea.value || '');
    applyPanelBackgroundToDom();

    refreshRenderedView();
}

function updateUIMemo(text) {
    if (runtimeState.historyViewIndex !== -1) return; // don't clobber snapshot view
    const textarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('rpg-tracker-memo'));
    if (textarea) textarea.value = text;
    const counter = document.getElementById('rpg-tracker-count');
    if (counter) counter.textContent = `~${Math.round(text.length / 2.62)} tokens`;
}

function updateAgentStatusIndicator(running) {
    const stopBtn = /** @type {HTMLElement} */ (document.getElementById('rt-agent-stop-btn'));
    const playBtn = /** @type {HTMLElement} */ (document.getElementById('rt-agent-router-manual-run'));
    if (stopBtn) stopBtn.style.display = running ? 'flex' : 'none';
    if (playBtn) playBtn.style.opacity = running ? '0.3' : '';
}

export function updateStatusIndicator(state) {
    const indicator = document.getElementById('rpg-tracker-status');
    const stopBtn = /** @type {HTMLElement} */ (document.getElementById('rpg-tracker-stop-btn'));
    if (!indicator) return;

    indicator.className = 'rpg-tracker-status-indicator ' + state;
    if (stopBtn) {
        stopBtn.style.display = (state === 'running') ? 'flex' : 'none';
    }
}

const RENDER_HINTS = {
    CHARACTER: {
        label: 'Entity Rows — HP Bars (Characters)',
        description: 'Each entity is one row with an HP bar. First line: "Name (Race/Class): cur/max HP". Sub-lines: Combat (BAB), Gear, Attr, Saves, Skills, Traits, Abilities, HD, Status.',
        example: 'Korgath Iron-Hide (Dwarven Warrior): 32/32 HP\nCombat: BAB: +2 | Ranged (1 attack): +3 | Melee (1 attack): +5\nGear: Volcanic Mace (+1 / 2d6+3), AC: 13 (Furs)\nAttr: STR 16 (+3), DEX 12 (+1), CON 16 (+3), INT 8 (-1), WIS 16 (+3), CHA 6 (-2)\nSaves: Fort +6 | Ref +1 | Will +1\nSkills: Athletics +5, Intimidation +4\nTraits: Darkvision (60 ft)\nAbilities: Second Wind (1/1), Action Surge (1/1)\nHD: d10 (2/2)\nStatus: Healthy'
    },
    COMBAT: {
        label: 'Entity Rows — HP Bars (Enemies)',
        description: 'Entity rows with COMBAT ROUND header. Martial: weapon Att/def. Caster: Spell Atk + Spell DC + backup weapon, then Cantrips/Level N Spells lines (same rendering as PARTY).',
        example: 'COMBAT ROUND 1\nCultist Acolyte: 15/15 HP\nAtt/def: Spell Atk +4 | Spell DC 14 | Dagger (1 attack, +1 / 1d4-1 P) | Robes (AC: 11)\nSaves: Fort +1, Ref +2, Will +3\nAbilities: Spellcasting\nSpells: Cantrips: Fire Bolt, Prestidigitation\nSpells: Level 1 (2/2): Magic Missile, Shield\nOther: Soldier Tier Spellcaster\nStatus: Healthy\n\nElite Enforcer: 42/42 HP\nAtt/def: Warhammer (2 attacks, +9/+4 / 1d10+4 B) | Plate Armor (AC: 17)\nSaves: Fort +5, Ref +3, Will +4\nAbilities: Brutal Strike\nOther: Elite Tier\nStatus: Healthy'
    },
    SPELLS: {
        label: 'Spell Pips — Slot Tracker',
        description: 'One line per spell level. Cantrips: comma-separated names. Slots: "Level N (available/max): Spell1, Spell2".',
        example: 'Cantrips: Guidance, Resistance\nLevel 1 (2/2): Cure Wounds, Shield of Faith\nLevel 2 (1/3): Hold Person, Silence'
    },
    INVENTORY: {
        label: 'Bullet Points — Item List',
        description: 'One item per line. Leading "- " dashes are stripped. Supports <font color=...> tags for rarity/class coloring.',
        example: '- <font color=#ff8000>Volcanic Mace (+1 / 2d6+3 Fire)</font>\n- <font color=#a335ee>Cloak of Displacement</font>\n- <font color=#0070dd>Healing Potion (Greater)</font> x2\n- <font color=#1eff00>Iron Buckler (AC +2)</font>\n- <font color=#aaaaaa>Rope (50 ft)</font>\n- 80 gold pieces'
    },
    ABILITIES: {
        label: 'Oval Pills — Trait Tags',
        description: 'Each line becomes a clickable pill. Text in parentheses (e.g. 10/15) is tracked as a resource. Supports <font color=...> tags.',
        example: '- Lay on Hands (10/15, Heal 1 HP per point)\n- Divine Sense (3/4, Detect celestials/fiends/undead)\n- <font color=#ffaa00>Hasted (Double speed, +2 AC)</font>\n- <font color=#ff5555>Poisoned (Disadvantage on attacks)</font>'
    }
};

// Row type options shared by both the custom field editor and the global sub-field rules list
const ROW_TYPE_OPTIONS = [
    ['pills', 'Pills (comma-separated chips)'],
    ['badge', 'Badge (single chip)'],
    ['highlight', 'Highlight (paren emphasis)'],
    ['hp_bar', 'HP Bar (X/Y progress)'],
    ['xp_bar', 'XP Bar (X/Y with optional level)'],
    ['kv', 'Key / Value pair'],
    ['text', 'Plain Text'],
];


/**
 * Rebuilds the system prompt by stripping out XML blocks that are
 * disabled in settings.syspromptModules.
 * @param {string} rawText
 * @returns {string}
 */
/**
 * Fetches the raw (unprocessed) base sysprompt text — either sysprompt.txt or
 * sysprompt_legacy.txt depending on settings — falling back to the bundled
 * RT_PROMPTS copy if the live file can't be fetched.
 * @param {Record<string, any>} [settingsOverride]
 * @returns {Promise<string>}
 */
export async function fetchBaseSyspromptRaw(settingsOverride = null) {
    const s = settingsOverride || getSettings();
    const fileName = s.diceFunctionTool ? 'sysprompt.txt' : 'sysprompt_legacy.txt';
    let content;
    try {
        const response = await fetch(`/scripts/extensions/third-party/${FOLDER_NAME}/${fileName}`);
        if (response.ok) {
            content = await response.text();
        } else {
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (err) {
        console.warn(`[Multihog Framework] fetchBaseSyspromptRaw: could not fetch ${fileName}, using fallback:`, err);
        content = RT_PROMPTS[fileName];
    }
    return content || '';
}

function getMainSyspromptTextarea() {
    return /** @type {HTMLTextAreaElement|null} */ (document.getElementById('main_prompt_quick_edit_textarea'));
}

function isMainSyspromptBackupEnabled(settings) {
    return settings.mainSyspromptBackupEnabled !== false;
}

/** Snapshot Quick Prompt Main before the framework overwrites it (once per tracker-on period). */
function armMainSyspromptStash(settings, force = false, { manual = false } = {}) {
    if (!isMainSyspromptBackupEnabled(settings)) return false;
    if (!manual && (settings.customSysprompt || !settings.enabled)) return false;
    if (settings.syspromptStashArmed && !force) return true;
    const ta = getMainSyspromptTextarea();
    if (!ta) return false;
    settings.stashedMainSysprompt = ta.value;
    settings.syspromptStashArmed = true;
    saveSettings();
    updateMainSyspromptBackupStatusUi(settings);
    return true;
}

/** Restore stashed Quick Prompt Main when the tracker is turned off (or manually from settings). */
function restoreMainSyspromptStash(settings, { manual = false } = {}) {
    if (!isMainSyspromptBackupEnabled(settings) || !settings.syspromptStashArmed) return false;
    if (!manual && settings.customSysprompt) return false;
    const ta = getMainSyspromptTextarea();
    if (!ta) return false;
    ta.value = settings.stashedMainSysprompt ?? '';
    ta.dispatchEvent(new Event('blur', { bubbles: true }));
    if (!manual) {
        settings.syspromptStashArmed = false;
        saveSettings();
    }
    updateMainSyspromptBackupStatusUi(settings);
    return true;
}

function updateMainSyspromptBackupStatusUi(settings = getSettings()) {
    const statusEl = document.getElementById('rpg_main_sysprompt_backup_status');
    const controlsEl = document.getElementById('rpg_main_sysprompt_backup_controls');
    const enabledCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_main_sysprompt_backup_enabled'));
    const backupOn = isMainSyspromptBackupEnabled(settings);

    if (enabledCb) enabledCb.checked = backupOn;
    if (controlsEl) {
        controlsEl.style.opacity = backupOn ? '1' : '0.55';
        controlsEl.style.pointerEvents = backupOn ? '' : 'none';
    }
    if (!statusEl) return;

    if (!backupOn) {
        statusEl.textContent = 'Backup is disabled — enable above to save or restore.';
        return;
    }
    if (!settings.syspromptStashArmed) {
        statusEl.textContent = 'No backup saved yet. It is created automatically before the framework overwrites Main, or use Save above.';
        return;
    }
    const len = (settings.stashedMainSysprompt ?? '').length;
    statusEl.textContent = len
        ? `Backup saved (${len.toLocaleString()} characters).`
        : 'Backup saved (empty Main prompt).';
}

function syncMainSyspromptBackupControlsUi() {
    updateMainSyspromptBackupStatusUi(getSettings());
}

async function handleTrackerEnabledChange(settings, enabled) {
    settings.enabled = !!enabled;
    saveSettings();
    updatePanelStatus();
    if (settings.enabled) {
        armMainSyspromptStash(settings, true);
        await autoApplySysprompt(true);
    } else {
        restoreMainSyspromptStash(settings);
        void resetCombatProfileOverride(settings);
    }
}

let _autoApplyTimer = null;
let _stashDeferCount = 0;
const MAX_STASH_DEFER = 25;
let _lastDynamicRngCombatState = null;

export async function autoApplySysprompt(force = false) {
    const s = getSettings();
    if (s.customSysprompt) return;
    if (!force && !s.enabled) return;

    if (s.enabled && isMainSyspromptBackupEnabled(s)) {
        const armed = armMainSyspromptStash(s);
        if (!armed && !s.syspromptStashArmed) {
            if (_stashDeferCount < MAX_STASH_DEFER) {
                _stashDeferCount++;
                scheduleAutoApply();
                return;
            }
        }
    }
    _stashDeferCount = 0;

    const content = await fetchBaseSyspromptRaw(s);
    if (!content) return;

    const built = buildSysprompt(content);
    const mainTextarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('main_prompt_quick_edit_textarea'));
    if (mainTextarea) {
        mainTextarea.value = built;
        mainTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
    }
}

/**
 * Rebuild the managed narrator prompt only when hybrid RNG crosses the same
 * [COMBAT] boundary used by Combat API Override. Unlocked/custom prompts are
 * intentionally left entirely under the user's control.
 */
export async function syncDynamicRngPrompt(memo, settings = getSettings()) {
    const canManage = settings.enabled
        && !settings.paused
        && !settings.customSysprompt
        && settings.rngEnabled
        && settings.diceFunctionTool
        && !isSectionUnlocked(settings, 'rng_system');
    if (!canManage) {
        if (_lastDynamicRngCombatState !== null) {
            syncDiceFunctionToolForRngContext(memo, false);
        }
        _lastDynamicRngCombatState = null;
        return;
    }

    const combatActive = isCombatActive(memo);
    if (_lastDynamicRngCombatState === combatActive) return;
    _lastDynamicRngCombatState = combatActive;
    syncDiceFunctionToolForRngContext(memo, true);
    await autoApplySysprompt(true);
}

globalThis._rpgSyncDynamicRngPrompt = syncDynamicRngPrompt;

function scheduleAutoApply() {
    const s = getSettings();
    if (!s.enabled || s.customSysprompt) return;
    if (_autoApplyTimer) clearTimeout(_autoApplyTimer);
    _autoApplyTimer = setTimeout(() => { _autoApplyTimer = null; autoApplySysprompt(); }, 400);
}

/**
 * Assembles the complete final sysprompt in one deterministic pass: extracts the
 * built-in tags from `rawText`, reconciles them with the System Prompt Control
 * Room's row order (built-in + custom/unlocked/wizard library entries), then
 * resolves and joins every enabled row's content in that order. See
 * normalizeSectionOrder()/getSectionRowDescriptor()/transformBaseSectionContent()
 * in game-systems.js for the row-level logic this builds on.
 */
export function buildSysprompt(rawText) {
    if (!rawText) return "";
    const s = getSettings();
    const baseSections = extractTopLevelSections(rawText);
    const baseSectionMap = new Map(baseSections.map(sec => [sec.tag, sec.content]));
    const order = normalizeSectionOrder(s, baseSections);

    const pieces = order.map(key => {
        const row = getSectionRowDescriptor(key, s, baseSectionMap);
        if (!row || !row.enabled) return '';
        if (row.kind === 'base') {
            return transformBaseSectionContent(row.tag, row.content, s);
        }
        // unlocked / custom / wizard rows already carry their full <tag>...</tag> content.
        return isBlankSectionContent(row.content) ? '' : row.content;
    }).filter(Boolean);

    let content = pieces.join('\n\n');

    // Legacy placeholder substitution — kept for backward compatibility with any
    // custom prompt still using it; current sysprompt.txt no longer contains it.
    const modulesText = buildModulesInstructionText(s);
    content = content.replace("{{modulesText}}", modulesText);

    if (!s.rngEnabled) {
        content = content
            .replace(/.*RollTheDice(?:D100)?.*\n?/gi, '')
            .replace(/.*\[RNG_QUEUE(?:_d100)?\s+v[\d.]+[^\]]*\].*\n?/gi, '');
    }

    return content
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * Binds a Connection Manager profile dropdown when the element and extension are available.
 * @param {string} selector
 * @param {string} initialProfileId
 * @param {(profileId: string) => void} onProfileIdChange
 * @returns {boolean}
 */
function tryBindConnectionProfileDropdown(selector, initialProfileId, onProfileIdChange) {
    if (!$(selector).length) {
        console.warn(`[RPG Tracker] Connection profile dropdown not found: ${selector}`);
        return false;
    }
    const ctx = SillyTavern.getContext();
    const svc = ctx.ConnectionManagerRequestService;
    const cmDisabled = ctx.extensionSettings?.disabledExtensions?.includes('connection-manager');
    if (!svc?.handleDropdown || cmDisabled) return false;
    try {
        svc.handleDropdown(
            selector,
            initialProfileId || '',
            (profile) => onProfileIdChange(profile?.id || ''),
        );
        return true;
    } catch (e) {
        console.warn(`[RPG Tracker] Could not bind connection profile dropdown ${selector}:`, e);
        return false;
    }
}

let _portraitMigrationDone = false;

/** One-time migration of legacy base64 portraits to disk. Runs after chat bootstrap. */
async function runPortraitMigrationIfNeeded() {
    if (_portraitMigrationDone) return;

    const portraitSettings = getSettings();
    const embeddedPortraitCount = countEmbeddedPortraitDataUrls(portraitSettings);
    if (embeddedPortraitCount === 0) {
        if (!portraitSettings.portraitsFileStorageVersion) {
            portraitSettings.portraitsFileStorageVersion = 1;
        }
        _portraitMigrationDone = true;
        return;
    }

    toastr['info'](
        `Migrating ${embeddedPortraitCount} embedded portrait(s) to disk… This may take a minute.`,
        'RPG Tracker',
        { timeOut: 15000 },
    );

    setPortraitMigrationLocked(true);
    try {
        const stats = await migrateAllEmbeddedPortraits(portraitSettings);
        await saveSettings(true);

        const remaining = countEmbeddedPortraitDataUrls(getSettings());
        if (remaining === 0) {
            _portraitMigrationDone = true;
            if (stats.migrated > 0) {
                toastr['success'](
                    `Migrated ${stats.migrated} portrait(s) to user/images/${PORTRAIT_STORAGE_FOLDER}/. Your settings file should be much smaller now.`,
                    'RPG Tracker',
                    { timeOut: 10000 },
                );
            }
        } else {
            console.warn(`[RPG Tracker] Portrait migration finished but ${remaining} embedded portrait(s) remain.`);
            if (stats.failed > 0) {
                toastr['warning'](
                    `${stats.failed} portrait(s) could not be migrated. Use Emergency: Purge All Portraits if problems persist.`,
                    'RPG Tracker',
                );
            }
        }
    } catch (err) {
        console.error('[RPG Tracker] Portrait migration failed:', err);
        toastr['error']('Portrait migration failed — see browser console.', 'RPG Tracker');
    } finally {
        setPortraitMigrationLocked(false);
    }
}

/**
 * Initialization
 */
(async function init() {
    // Guard against double-init (e.g. browser serving a cached copy of this script
    // while the fresh copy also loads). Remove any stale panel/settings first.
    document.getElementById('rpg-tracker-panel')?.remove();
    document.querySelectorAll('.rpg-tracker-settings').forEach(el => el.remove());

    const ctx = SillyTavern.getContext();
    const { eventSource, event_types, renderExtensionTemplateAsync } = ctx;
    const pm = ctx.getPresetManager ? ctx.getPresetManager() : null;

    configureRuntimeActions({
        saveSettings,
        refreshRenderedView,
        refreshDayNightCycleFromCurrentMemo,
        autoApplySysprompt,
        fetchBaseSyspromptRaw,
        sendDirectPrompt,
        refreshAgentManifestNow,
        syncTimeFormatSettingsUi,
        applyTrackerThemeToDom,
        setUse24hTime,
        setUseDdMmYyFormat,
        updateStatusIndicator,
        syncNpcPortraitDependentUi,
        syncLocationImageDependentUi,
        refreshQuestPrompt,
        syncMemoView,
        bindRenderedCardEvents,
        rebuildNpcInstructionIfNeeded,
        applyPortraitData,
        bindQuickStartEvents,
        blockToItems,
        buildCombatAndSkillScalingHint,
        buildNpcInstruction,
        buildOnboardingActiveBlocks,
        buildOnboardingTimeHint,
        buildOnboardingXpHint,
        buildStartingGearHint,
        createDetachedPanel,
        extractCharNameFromMemo,
        fileToDataUrl,
        generatePersonaBio,
        getPageSize,
        getSettings,
        handleCategorySettings,
        handleCharacterCreatorGenerate,
        handleRecolor,
        loadBenchedExpanded,
        loadCollapsed,
        loadDetached,
        maybeCreateOnboardingPersona,
        parseMemoBlocks,
        refreshAgentManifest: (...args) => runtimeState.refreshAgentManifest(...args),
        refreshNpcManifest: (...args) => runtimeState.refreshNpcManifest(...args),
        registerDiceFunctionTool,
        removeArchivedQuest,
        resolveActivePersonaDescription,
        saveActiveTab,
        saveBenchedExpanded,
        saveCollapsed,
        saveDetached,
        scaleImageTo512Square,
        scheduleAutoApply,
        setInitialDateValue,
        showCharacterRollPanel,
        showLorebookAgentDocumentation,
        showNarrativePacingExplanation,
        showPcImportPanel,
        showPersonaConfirmOverlay,
        showPortraitSettingsMenu,
        showQuestsHardcoreExplanation,
        showRngExplanation,
        showSettingsHelpPopup,
        syncOnboardingPersonaPrefsFromDom,
        syncOnboardingUI,
        getPillDeselectHandler: () => _pillDeselectHandler,
        setPillDeselectHandler: (handler) => { _pillDeselectHandler = handler; },
    });

    getSettings();
    // Recover BEFORE any init saveSettings can clobber the localStorage backup.
    {
        const earlyChatId = ctx.chatId || ctx.getCurrentChatId?.() || null;
        if (earlyChatId) await ensureLocalMemoRecovery(earlyChatId);
    }
    migrateCustomFields();
    createPanel();

    try {
        // Load Settings UI using the dynamic folder name
        // Use a cache-busting parameter to ensure we get the fresh file from the server
        const html = await renderExtensionTemplateAsync(`third-party/${FOLDER_NAME}`, 'settings', { v: Date.now() });
        // Third-party plugins should go to extensions_settings2 (right column) if available
        if ($('#extensions_settings2').length) {
            $('#extensions_settings2').append(html);
        } else {
            $('#extensions_settings').append(html);
        }

        // Bind drawer toggles ONLY for our own content to avoid global conflicts
        $('.rpg-tracker-settings').on('click', '.inline-drawer-toggle', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const drawer = $(this).closest('.inline-drawer');
            const content = drawer.find('> .inline-drawer-content');
            drawer.toggleClass('open');
            jqueryToggleSlide(content, drawer.hasClass('open'));
            $(this).find('.inline-drawer-icon').toggleClass('down');
        });

        const settings = getSettings();


        /**
         * Categories whose shipped defaults differ between two snapshots.
         * @param {ReturnType<typeof buildBundledPromptsSnapshot>|null|undefined} oldSnap
         * @param {ReturnType<typeof buildBundledPromptsSnapshot>} newSnap
         * @returns {Set<string>}
         */

        function hasPendingPromptDefaultsUpdate(settings = getSettings()) {
            const fp = settings.lastSeenPromptDefaultsFingerprint || '';
            if (!fp) return false;
            return fp !== computeBundledPromptsFingerprint();
        }

        /** @param {any} popup */
        function stylePromptDefaultsUpgradePopup(popup) {
            popup?.okButton?.classList?.add('rt-prompt-upgrade-ok');
        }

        function syncPromptDefaultsUpgradeButton() {
            const btn = document.getElementById('rpg_tracker_btn_upgrade_changed_prompts');
            if (!btn) return;
            const pending = hasPendingPromptDefaultsUpdate();
            btn.style.display = pending ? '' : 'none';
            btn.classList.toggle('rt-prompt-upgrade-pending', pending);
            btn.setAttribute('aria-hidden', pending ? 'false' : 'true');
        }

        function getChangedPromptDefaultCategories(oldSnap, newSnap) {
            /** @type {Set<string>} */
            const changed = new Set();
            if (!oldSnap || !newSnap) {
                // No prior snapshot — treat every category as changed so "Update Changed"
                // still has a sensible target (all of them).
                for (const cat of PROMPT_DEFAULTS_CATEGORIES) changed.add(cat);
                return changed;
            }
            for (const cat of PROMPT_DEFAULTS_CATEGORIES) {
                const oldBlocks = getSnapshotCategoryBlocks(oldSnap, cat);
                const newBlocks = getSnapshotCategoryBlocks(newSnap, cat);
                const labels = new Set([
                    ...oldBlocks.map((b) => b.label),
                    ...newBlocks.map((b) => b.label),
                ]);
                for (const label of labels) {
                    const oldText = oldBlocks.find((b) => b.label === label)?.text ?? '';
                    const newText = newBlocks.find((b) => b.label === label)?.text ?? '';
                    if (oldText === newText) continue;
                    if (diffHasChanges(diffTextLines(oldText, newText))) {
                        changed.add(cat);
                        break;
                    }
                }
            }
            return changed;
        }

        /**
         * Build collapsible shipped-defaults diff HTML for the Prompt Defaults Updated dialog.
         * @param {ReturnType<typeof buildBundledPromptsSnapshot>|null} oldSnap
         * @param {ReturnType<typeof buildBundledPromptsSnapshot>} newSnap
         * @param {Record<string, any>} liveSettings
         * @param {string} mainSyspromptText
         */
        function buildPromptDefaultsDiffSectionHtml(oldSnap, newSnap, liveSettings, mainSyspromptText = '') {
            const badgeStyles = {
                customized: 'background:rgba(234,179,8,0.2);color:#fbbf24;border:1px solid rgba(234,179,8,0.35);',
                'matches new': 'background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.3);',
                'matches old': 'background:rgba(148,163,184,0.15);color:#cbd5e1;border:1px solid rgba(148,163,184,0.3);',
                unknown: 'background:rgba(148,163,184,0.1);color:#94a3b8;border:1px solid rgba(148,163,184,0.2);',
            };
            const badgeLabel = {
                customized: 'your copy differs',
                'matches new': 'matches new',
                'matches old': 'matches old',
                unknown: 'impact unknown',
            };

            if (!oldSnap) {
                return `
                                    <details style="margin-top:4px;background:rgba(0,0,0,0.12);padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);">
                                        <summary style="cursor:pointer;user-select:none;font-weight:600;">What changed</summary>
                                        <div style="margin-top:8px;opacity:0.85;font-size:12px;">Diff available after this acknowledge — a snapshot of today's shipped defaults will be saved so the next update can show a line-by-line changelog.</div>
                                    </details>`;
            }

            const opts = { mainSyspromptText };
            /** @type {string[]} */
            const categoryHtml = [];

            for (const cat of PROMPT_DEFAULTS_CATEGORIES) {
                const oldBlocks = getSnapshotCategoryBlocks(oldSnap, cat);
                const newBlocks = getSnapshotCategoryBlocks(newSnap, cat);
                const labels = new Set([
                    ...oldBlocks.map((b) => b.label),
                    ...newBlocks.map((b) => b.label),
                ]);
                let additions = 0;
                let deletions = 0;
                /** @type {string[]} */
                const hunkHtml = [];

                for (const label of [...labels].sort()) {
                    const oldText = oldBlocks.find((b) => b.label === label)?.text ?? '';
                    const newText = newBlocks.find((b) => b.label === label)?.text ?? '';
                    if (oldText === newText) continue;
                    const diff = diffTextLines(oldText, newText);
                    if (!diffHasChanges(diff)) continue;
                    additions += diff.additions;
                    deletions += diff.deletions;
                    const linesHtml = diff.lines.map((line) => {
                        const color = line.type === 'add' ? '#86efac'
                            : line.type === 'del' ? '#fca5a5'
                            : 'rgba(255,255,255,0.45)';
                        const prefix = line.type === 'add' ? '+'
                            : line.type === 'del' ? '\u2212'
                            : ' ';
                        return `<div style="color:${color};white-space:pre-wrap;word-break:break-word;">${prefix} ${escapeHtml(line.text)}</div>`;
                    }).join('');
                    hunkHtml.push(`
                                            <div style="margin:8px 0 4px;font-size:11px;opacity:0.75;font-weight:600;">${escapeHtml(label)}</div>
                                            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.35;background:rgba(0,0,0,0.25);padding:6px 8px;border-radius:4px;max-height:220px;overflow:auto;">${linesHtml}</div>`);
                }

                const impact = getPromptCategoryImpactBadge(oldSnap, newSnap, liveSettings, cat, opts);
                const label = PROMPT_DEFAULTS_CATEGORY_LABELS[cat] || cat;
                if (!hunkHtml.length) continue;

                categoryHtml.push(`
                                        <details style="margin:0;">
                                            <summary style="cursor:pointer;user-select:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                                <span>${escapeHtml(label)} — ${additions} insertion${additions === 1 ? '' : 's'}, ${deletions} deletion${deletions === 1 ? '' : 's'}</span>
                                                <span style="font-size:10px;padding:1px 6px;border-radius:999px;${badgeStyles[impact] || badgeStyles.unknown}">${escapeHtml(badgeLabel[impact] || impact)}</span>
                                            </summary>
                                            <div style="margin-top:6px;">${hunkHtml.join('')}</div>
                                        </details>`);
            }

            if (!categoryHtml.length) {
                return `
                                    <details style="margin-top:4px;background:rgba(0,0,0,0.12);padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);">
                                        <summary style="cursor:pointer;user-select:none;font-weight:600;">What changed</summary>
                                        <div style="margin-top:8px;opacity:0.85;font-size:12px;">No text changes detected between the last acknowledged defaults and the current shipped defaults.</div>
                                    </details>`;
            }

            return `
                                    <details open style="margin-top:4px;background:rgba(0,0,0,0.12);padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);">
                                        <summary style="cursor:pointer;user-select:none;font-weight:600;">What changed</summary>
                                        <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px;">${categoryHtml.join('')}</div>
                                    </details>`;
        }

        let _runPromptDefaultsDialog = null;

        // --- Version Upgrade Prompt Reset Dialog ---
        {
            let currentVersion = '4.8.10'; // Fallback
            try {
                const manifestUrl = new URL('./manifest.json', import.meta.url);
                const response = await fetch(manifestUrl);
                const manifest = await response.json();
                if (manifest && manifest.version) {
                    currentVersion = manifest.version;
                }
            } catch (e) {
                console.warn('[RPG Tracker] Could not fetch manifest.json for version check', e);
            }

            const currentFingerprint = computeBundledPromptsFingerprint();
            const currentSnapshot = buildBundledPromptsSnapshot();
            const rawStoredSnapshot = settings.lastSeenPromptDefaultsSnapshot || null;
            const storedSnapshot = rawStoredSnapshot
                ? normalizeBundledPromptsSnapshot(rawStoredSnapshot)
                : null;
            const storedFingerprint = storedSnapshot
                ? computeBundledPromptsFingerprintForSnapshot(storedSnapshot)
                : (settings.lastSeenPromptDefaultsFingerprint || '');

            const persistPromptDefaultsAck = (target) => {
                target.lastResetVersion = currentVersion;
                target.lastSeenPromptDefaultsFingerprint = currentFingerprint;
                target.lastSeenPromptDefaultsSnapshot = currentSnapshot;
            };

            if (!settings.lastResetVersion) {
                // Fresh install — record version and defaults fingerprint silently.
                persistPromptDefaultsAck(settings);
                saveSettings();
            } else if (!storedFingerprint) {
                // Existing install before fingerprint tracking — adopt current defaults without prompting.
                persistPromptDefaultsAck(settings);
                saveSettings();
            } else if (storedFingerprint === currentFingerprint
                && settings.lastSeenPromptDefaultsFingerprint !== currentFingerprint) {
                // Pre-format-neutral snapshots can contain user-selected calendar/clock
                // examples. They represent the same shipped defaults, so upgrade the
                // acknowledgement silently instead of showing a false update prompt.
                persistPromptDefaultsAck(settings);
                saveSettings();
            } else if (storedFingerprint !== currentFingerprint) {
                syncPromptDefaultsUpgradeButton();
                const acknowledgePromptDefaults = (fresh) => {
                    persistPromptDefaultsAck(fresh);
                    saveSettings();
                };

                if (settings.autoResetPromptsOnUpdate) {
                    // Silently reset everything automatically
                    (async () => {
                        const { extensionSettings } = SillyTavern.getContext();
                        const fresh = getSettings();

                        // 1. Main System Prompt
                        fresh.customSysprompt = false;
                        const customSyspromptCb = document.getElementById('rpg_tracker_custom_sysprompt');
                        if (customSyspromptCb) {
                            customSyspromptCb.checked = false;
                            const narratorConfigBlock = document.getElementById('rpg_narrator_config_block');
                            if (narratorConfigBlock) narratorConfigBlock.style.display = '';
                        }
                        if (!fresh.cyoaConfig) fresh.cyoaConfig = {};
                        refreshCyoaConfigToShipped(fresh.cyoaConfig, { resetSlots: true });
                        await autoApplySysprompt(true);

                        // 2. State Tracker
                        if (extensionSettings[MODULE_NAME]) {
                            delete extensionSettings[MODULE_NAME].systemPromptTemplate;
                            delete extensionSettings[MODULE_NAME].userPromptSuffix;
                        }
                        const sTempTracker = getSettings();
                        sTempTracker.stockPrompts = JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS));
                        const $corePromptEl = $('#rpg_tracker_core_prompt');
                        if ($corePromptEl.length) {
                            $corePromptEl.val(sTempTracker.systemPromptTemplate);
                        }
                        const $suffixPromptEl = $('#rpg_tracker_user_prompt_suffix');
                        if ($suffixPromptEl.length) {
                            $suffixPromptEl.val(sTempTracker.userPromptSuffix);
                        }
                        $('#rpg_tracker_npc_major_words').val(sTempTracker.npcMajorWords ?? 25);
                        $('#rpg_tracker_npc_minor_words').val(sTempTracker.npcMinorWords ?? 15);
                        $('#rpg_tracker_npc_rel_max_default').val(getNpcRelationshipMaxDefault(sTempTracker));
                        $('#rpg_tracker_npc_portraits').prop('checked', sTempTracker.npcPortraits !== false);
                        syncNpcPortraitDependentUi(sTempTracker);
                        $('#rpg_tracker_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                        $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                        $('#rpg_tracker_npc_card_import').prop('checked', !!sTempTracker.experimentalNpcImport);
                        $('#rpg_tracker_ignore_npc_limits').prop('checked', !!sTempTracker.ignoreNpcImportLimits);
                        if (typeof refreshOrderList === 'function') refreshOrderList();

                        // 3. Lorebook Agent
                        if (extensionSettings[MODULE_NAME]) {
                            delete extensionSettings[MODULE_NAME].routerSystemPromptTemplate;
                            delete extensionSettings[MODULE_NAME].routerModularPromptTemplate;
                        }
                        for (const [id, def] of Object.entries(DEFAULT_MODULES)) {
                            if (fresh.routerModules && fresh.routerModules[id]) {
                                if (id === 'npc') {
                                    fresh.routerModules[id].instruction = buildNpcInstruction(fresh.npcMajorWords, fresh.npcMinorWords, false);
                                } else {
                                    fresh.routerModules[id].instruction = def.instruction;
                                }
                                fresh.routerModules[id].format = def.format;
                            }
                        }
                        if (typeof globalThis._rpgRenderAgentModules === 'function') {
                            globalThis._rpgRenderAgentModules();
                        }
                        const sTemp = getSettings();
                        const $promptEl = $('#rpg_tracker_router_prompt');
                        if ($promptEl.length) {
                            $promptEl.val(sTemp.routerSystemPromptTemplate).trigger('input');
                            if (typeof (/** @type {any} */ ($promptEl)).trigger === 'function') {
                                (/** @type {any} */ ($promptEl)).trigger('autosize.resize');
                            }
                        }
                        const $modularEl = $('#rpg_tracker_router_modular_prompt');
                        if ($modularEl.length) {
                            $modularEl.val(sTemp.routerModularPromptTemplate).trigger('input');
                            if (typeof (/** @type {any} */ ($modularEl)).trigger === 'function') {
                                (/** @type {any} */ ($modularEl)).trigger('autosize.resize');
                            }
                        }

                        // 4. World Progression
                        if (extensionSettings[MODULE_NAME]) {
                            delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
                            delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;
                        }
                        const $wpPromptEl = $('#rpg_world_progression_system_prompt');
                        if ($wpPromptEl.length) {
                            $wpPromptEl.val(sTemp.worldProgressionSystemPrompt).trigger('input');
                        }
                        const $wpSkelPromptEl = $('#rpg_world_progression_skeleton_system_prompt');
                        if ($wpSkelPromptEl.length) {
                            $wpSkelPromptEl.val(sTemp.worldProgressionSkeletonSystemPrompt).trigger('input');
                        }

                        acknowledgePromptDefaults(fresh);
                        toastr['info'](`Prompts auto-updated to latest defaults (v${currentVersion}).`, 'RPG Tracker');
                        console.log(`[RPG Tracker] Automatically reset all prompts to defaults for version ${currentVersion}.`);
                    })();
                } else {
                    const { Popup } = SillyTavern.getContext();
                    if (Popup && Popup.show && Popup.show.confirm) {
                        // Run asynchronously so main extension init/loading is not blocked
                        _runPromptDefaultsDialog = async () => {
                            // Wait a short moment for the UI to be fully drawn
                            await sleepMs(500);

                            const mainTa = getMainSyspromptTextarea();
                            const mainSyspromptText = mainTa ? mainTa.value : '';
                            const changedCats = getChangedPromptDefaultCategories(storedSnapshot, currentSnapshot);
                            const hasSnapshot = !!storedSnapshot;
                            const changedLabels = [...changedCats]
                                .map((c) => PROMPT_DEFAULTS_CATEGORY_LABELS[c] || c);
                            const changedSummary = changedLabels.length
                                ? changedLabels.join(', ')
                                : 'none detected';
                            const diffSectionHtml = buildPromptDefaultsDiffSectionHtml(
                                storedSnapshot,
                                currentSnapshot,
                                getSettings(),
                                mainSyspromptText,
                            );

                            const chk = (cat) => (changedCats.has(cat) ? 'checked' : '');
                            const allChangedChecked = PROMPT_DEFAULTS_CATEGORIES.every((c) => changedCats.has(c));

                            const primaryHint = hasSnapshot
                                ? `The main action <b>Update Changed Prompts</b> replaces only categories with shipped text changes: <b>${escapeHtml(changedSummary)}</b>. Unchanged categories stay as-is.`
                                : `No prior defaults snapshot yet — <b>Update Changed Prompts</b> will update <b>all</b> categories below. After you acknowledge, future updates can target only what changed.`;

                            const popupHtml = `
                                <div style="display:flex; flex-direction:column; gap:12px; text-align:left; font-size:13px; line-height:1.4; width:100%; box-sizing:border-box;">
                                    <div>Shipped default prompts have changed in v<b>${escapeHtml(currentVersion)}</b>.</div>
                                    <div class="rt-prompt-upgrade-callout">
                                        <div style="font-size:14px; font-weight:700; margin-bottom:6px;">Recommended: Update Changed Prompts</div>
                                        <div style="opacity:0.92; font-size:12.5px;">${primaryHint}</div>
                                        <div style="margin-top:8px; font-size:11.5px; opacity:0.75;">Use the primary button below. Other actions are secondary.</div>
                                    </div>
                                    <div style="opacity:0.9;">Or manually select categories, then use <b>Update Selected</b>. <b>Keep Custom — leave prompts untouched</b> makes no prompt changes at all (only acknowledges this update). Use <b>Save as Cartridge &amp; Update All</b> to back up first, then replace every category.</div>
                                    <div style="margin-left: 10px; display:flex; flex-direction:column; gap:8px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0;">
                                            <input type="checkbox" id="rt-reset-sysprompt" ${chk('sysprompt')} style="cursor:pointer;">
                                            <span>Main System Prompt${changedCats.has('sysprompt') ? ' <span class="rt-prompt-cat-changed">changed</span>' : ''}</span>
                                        </label>
                                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0;">
                                            <input type="checkbox" id="rt-reset-tracker" ${chk('tracker')} style="cursor:pointer;">
                                            <span>State Tracker Prompts${changedCats.has('tracker') ? ' <span class="rt-prompt-cat-changed">changed</span>' : ''}</span>
                                        </label>
                                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0;">
                                            <input type="checkbox" id="rt-reset-lorebook" ${chk('lorebook')} style="cursor:pointer;">
                                            <span>Lorebook Agent Prompts${changedCats.has('lorebook') ? ' <span class="rt-prompt-cat-changed">changed</span>' : ''}</span>
                                        </label>
                                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0;">
                                            <input type="checkbox" id="rt-reset-world" ${chk('world')} style="cursor:pointer;">
                                            <span>World Progression Prompts${changedCats.has('world') ? ' <span class="rt-prompt-cat-changed">changed</span>' : ''}</span>
                                        </label>
                                    </div>
                                    <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin: 2px 0;">
                                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; font-weight:bold; margin: 0;">
                                        <input type="checkbox" id="rt-reset-all" ${allChangedChecked ? 'checked' : ''} style="cursor:pointer;">
                                        <span>Select All Categories</span>
                                    </label>
                                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0; opacity: 0.85;">
                                        <input type="checkbox" id="rt-reset-always-auto" style="cursor:pointer;">
                                        <span>Always update everything automatically / Don't ask again</span>
                                    </label>
                                    ${diffSectionHtml}
                                </div>
                            `;

                            // Synchronize checkbox toggles in the DOM
                            let sysReset = changedCats.has('sysprompt');
                            let trackerReset = changedCats.has('tracker');
                            let loreReset = changedCats.has('lorebook');
                            let worldReset = changedCats.has('world');
                            let alwaysAuto = false;

                            setTimeout(() => {
                                const allCb = document.getElementById('rt-reset-all');
                                const sysCb = document.getElementById('rt-reset-sysprompt');
                                const trackerCb = document.getElementById('rt-reset-tracker');
                                const loreCb = document.getElementById('rt-reset-lorebook');
                                const worldCb = document.getElementById('rt-reset-world');
                                const alwaysCb = document.getElementById('rt-reset-always-auto');
                                const cbs = [sysCb, trackerCb, loreCb, worldCb];

                                if (sysCb) sysCb.addEventListener('change', () => { sysReset = sysCb.checked; });
                                if (trackerCb) trackerCb.addEventListener('change', () => { trackerReset = trackerCb.checked; });
                                if (loreCb) loreCb.addEventListener('change', () => { loreReset = loreCb.checked; });
                                if (worldCb) worldCb.addEventListener('change', () => { worldReset = worldCb.checked; });
                                if (alwaysCb) alwaysCb.addEventListener('change', () => { alwaysAuto = alwaysCb.checked; });

                                if (allCb) {
                                    allCb.addEventListener('change', () => {
                                        const val = allCb.checked;
                                        cbs.forEach(cb => { if (cb) cb.checked = val; });
                                        sysReset = val;
                                        trackerReset = val;
                                        loreReset = val;
                                        worldReset = val;
                                    });
                                }

                                cbs.forEach(cb => {
                                    if (cb) {
                                        cb.addEventListener('change', () => {
                                            if (allCb) {
                                                allCb.checked = cbs.every(c => c && c.checked);
                                            }
                                        });
                                    }
                                });
                            }, 150);

                            const { POPUP_RESULT } = SillyTavern.getContext();
                            const confirmResult = await Popup.show.confirm('✨ Prompt Defaults Updated', popupHtml, {
                                okButton: 'Update Changed Prompts',
                                cancelButton: 'Keep Custom — leave prompts untouched',
                                customButtons: [
                                    {
                                        text: 'Update Selected',
                                        result: POPUP_RESULT.CUSTOM2,
                                    },
                                    {
                                        text: 'Save as Cartridge & Update All',
                                        result: POPUP_RESULT.CUSTOM1,
                                    },
                                ],
                                wide: true,
                                onOpen: stylePromptDefaultsUpgradePopup,
                            });

                            const fresh = getSettings();
                            if (alwaysAuto) {
                                fresh.autoResetPromptsOnUpdate = true;
                                const stCb = document.getElementById('rpg_tracker_auto_reset_prompts');
                                if (stCb) stCb.checked = true;
                            }

                            // AFFIRMATIVE = update only categories with shipped diffs.
                            if (confirmResult === POPUP_RESULT.AFFIRMATIVE) {
                                sysReset = changedCats.has('sysprompt');
                                trackerReset = changedCats.has('tracker');
                                loreReset = changedCats.has('lorebook');
                                worldReset = changedCats.has('world');
                            }

                            // CUSTOM1 = snapshot current config as a named Game Cartridge, then update everything.
                            let cartridgeBackupName = '';
                            if (confirmResult === POPUP_RESULT.CUSTOM1) {
                                const saved = await promptAndSaveCurrentAsCartridge({
                                    title: '💾 Save Current Config as Game Cartridge',
                                    okButton: 'Save & Update',
                                    initialName: `Pre-update backup (v${currentVersion})`,
                                });
                                if (!saved) {
                                    toastr['info']('Cartridge save cancelled — prompts left unchanged. You\'ll be asked again next load.', 'RPG Tracker');
                                    return; // do NOT acknowledge fingerprint — ask again next time
                                }
                                cartridgeBackupName = saved.name || '';
                                sysReset = true;
                                trackerReset = true;
                                loreReset = true;
                                worldReset = true;
                            }

                            // AFFIRMATIVE / CUSTOM1 / CUSTOM2 update prompts; Keep Custom is 0/false.
                            const shouldUpgrade = confirmResult === POPUP_RESULT.AFFIRMATIVE
                                || confirmResult === POPUP_RESULT.CUSTOM1
                                || confirmResult === POPUP_RESULT.CUSTOM2;
                            if (shouldUpgrade) {
                                let resetCount = 0;

                                const { extensionSettings } = SillyTavern.getContext();

                                if (sysReset) {
                                    fresh.customSysprompt = false;
                                    const customSyspromptCb = document.getElementById('rpg_tracker_custom_sysprompt');
                                    if (customSyspromptCb) {
                                        customSyspromptCb.checked = false;
                                        const narratorConfigBlock = document.getElementById('rpg_narrator_config_block');
                                        if (narratorConfigBlock) narratorConfigBlock.style.display = '';
                                    }
                                    // CYOA_mode is injected from cyoaConfig at apply-time; refresh shipped
                                    // slots + clear sticky customPromptText so Main System Prompt updates
                                    // actually replace the CYOA section.
                                    if (!fresh.cyoaConfig) fresh.cyoaConfig = {};
                                    refreshCyoaConfigToShipped(fresh.cyoaConfig, { resetSlots: true });
                                    await autoApplySysprompt(true);
                                    resetCount++;
                                    console.log('[RPG Tracker] Main system prompt reset to defaults.');
                                }

                                if (trackerReset) {
                                    if (extensionSettings[MODULE_NAME]) {
                                        delete extensionSettings[MODULE_NAME].systemPromptTemplate;
                                        delete extensionSettings[MODULE_NAME].userPromptSuffix;
                                    }
                                    const sTempTracker = getSettings();
                                    sTempTracker.stockPrompts = JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS));
                                    const $corePromptEl = $('#rpg_tracker_core_prompt');
                                    if ($corePromptEl.length) {
                                        $corePromptEl.val(sTempTracker.systemPromptTemplate);
                                    }
                                    const $suffixPromptEl = $('#rpg_tracker_user_prompt_suffix');
                                    if ($suffixPromptEl.length) {
                                        $suffixPromptEl.val(sTempTracker.userPromptSuffix);
                                    }
                                    $('#rpg_tracker_npc_major_words').val(sTempTracker.npcMajorWords ?? 25);
                                    $('#rpg_tracker_npc_minor_words').val(sTempTracker.npcMinorWords ?? 15);
                                    $('#rpg_tracker_npc_rel_max_default').val(getNpcRelationshipMaxDefault(sTempTracker));
                                    $('#rpg_tracker_npc_portraits').prop('checked', sTempTracker.npcPortraits !== false);
                                    syncNpcPortraitDependentUi(sTempTracker);
                                    $('#rpg_tracker_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                                    $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                                    $('#rpg_tracker_npc_card_import').prop('checked', !!sTempTracker.experimentalNpcImport);
                                    $('#rpg_tracker_ignore_npc_limits').prop('checked', !!sTempTracker.ignoreNpcImportLimits);
                                    if (typeof refreshOrderList === 'function') refreshOrderList();
                                    resetCount++;
                                    console.log('[RPG Tracker] State tracker prompts reset to defaults.');
                                }

                                if (loreReset) {
                                    if (extensionSettings[MODULE_NAME]) {
                                        delete extensionSettings[MODULE_NAME].routerSystemPromptTemplate;
                                        delete extensionSettings[MODULE_NAME].routerModularPromptTemplate;
                                    }
                                    for (const [id, def] of Object.entries(DEFAULT_MODULES)) {
                                        if (fresh.routerModules && fresh.routerModules[id]) {
                                            if (id === 'npc') {
                                                fresh.routerModules[id].instruction = buildNpcInstruction(fresh.npcMajorWords, fresh.npcMinorWords, false);
                                            } else {
                                                fresh.routerModules[id].instruction = def.instruction;
                                            }
                                            fresh.routerModules[id].format = def.format;
                                        }
                                    }
                                    if (typeof globalThis._rpgRenderAgentModules === 'function') {
                                        globalThis._rpgRenderAgentModules();
                                    }
                                    const sTemp = getSettings();
                                    const $promptEl = $('#rpg_tracker_router_prompt');
                                    if ($promptEl.length) {
                                        $promptEl.val(sTemp.routerSystemPromptTemplate).trigger('input');
                                        if (typeof (/** @type {any} */ ($promptEl)).trigger === 'function') {
                                            (/** @type {any} */ ($promptEl)).trigger('autosize.resize');
                                        }
                                    }
                                    const $modularEl = $('#rpg_tracker_router_modular_prompt');
                                    if ($modularEl.length) {
                                        $modularEl.val(sTemp.routerModularPromptTemplate).trigger('input');
                                        if (typeof (/** @type {any} */ ($modularEl)).trigger === 'function') {
                                            (/** @type {any} */ ($modularEl)).trigger('autosize.resize');
                                        }
                                    }
                                    resetCount++;
                                    console.log('[RPG Tracker] Lorebook Agent prompts reset to defaults.');
                                }

                                if (worldReset) {
                                    if (extensionSettings[MODULE_NAME]) {
                                        delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
                                        delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;
                                    }
                                    const sTemp = getSettings();
                                    const $wpPromptEl = $('#rpg_world_progression_system_prompt');
                                    if ($wpPromptEl.length) {
                                        $wpPromptEl.val(sTemp.worldProgressionSystemPrompt).trigger('input');
                                    }
                                    const $wpSkelPromptEl = $('#rpg_world_progression_skeleton_system_prompt');
                                    if ($wpSkelPromptEl.length) {
                                        $wpSkelPromptEl.val(sTemp.worldProgressionSkeletonSystemPrompt).trigger('input');
                                    }
                                    resetCount++;
                                    console.log('[RPG Tracker] World progression prompts reset to defaults.');
                                }

                                acknowledgePromptDefaults(fresh);
                                syncPromptDefaultsUpgradeButton();

                                if (resetCount > 0) {
                                    toastr['success'](`Successfully reset ${resetCount} prompt category/categories to defaults.`, 'RPG Tracker');
                                } else {
                                    toastr['info']('No prompts were selected for reset.', 'RPG Tracker');
                                }
                            } else {
                                acknowledgePromptDefaults(fresh);
                                syncPromptDefaultsUpgradeButton();
                                toastr['info']('Kept custom — no prompts were changed.', 'RPG Tracker');
                            }
                            syncPromptDefaultsUpgradeButton();
                        };
                        void _runPromptDefaultsDialog();
                    } else {
                        acknowledgePromptDefaults(getSettings());
                    }
                }
            } else if (settings.lastResetVersion !== currentVersion) {
                // Version-only bump — bundled defaults unchanged, no prompt dialog.
                settings.lastResetVersion = currentVersion;
                saveSettings();
            }
        }

        // --- Stock prompts bootstrap (NO sniff-and-replace on every load) ---
        // Prompt content upgrades happen ONLY via the post-update "Prompt Defaults Updated"
        // dialog (or Auto-Update Prompts on Upgrade). Silent sniff migrations wiped themed
        // customs (e.g. Warhammer COMBAT) every time the editor reopened.
        if (!settings.stockPrompts) settings.stockPrompts = { ...DEFAULT_STOCK_PROMPTS };
        {
            let changed = false;

            // One-shot structural leftovers only (keys / dead formats — not content sniffing).
            if (settings.stockPrompts.quests?.includes('"updates"')) {
                // Old JSON/LogQuest format → plain-text quests prompt (one-time format break).
                const migratedPrompt = (settings.stockPrompts.quests_legacy?.includes('OBJ_ACTIVE'))
                    ? settings.stockPrompts.quests_legacy
                    : DEFAULT_STOCK_PROMPTS.quests;
                settings.stockPrompts.quests = migratedPrompt;
                changed = true;
            }
            if (settings.stockPrompts.quests_legacy) {
                delete settings.stockPrompts.quests_legacy;
                changed = true;
            }
            if (settings.questLegacyMode !== undefined) {
                delete settings.questLegacyMode;
                changed = true;
            }
            if (settings.syspromptModules?.questsDifficulty !== undefined) {
                delete settings.syspromptModules.questsDifficulty;
                changed = true;
            }

            if (changed) {
                saveSettings();
            }

            unregisterLogQuestTool();

            // Retroactive Log Cleanup: replace generic messages with more descriptive ones
            if (settings.routerLog && settings.routerLog.length > 0) {
                let cleaned = false;
                settings.routerLog.forEach(entry => {
                    if (entry.reason === "Tag-based update.") {
                        entry.reason = "Processed narrative entities (Legacy Log).";
                        cleaned = true;
                    }
                });
                if (cleaned) saveSettings();
            }
        }

        $('#rpg_tracker_enabled').prop('checked', settings.enabled).on('change', function () {
            void handleTrackerEnabledChange(settings, !!$(this).prop('checked'));
        });

        bindSettingsHelpIcons();

        $('#rpg_tracker_debug').prop('checked', settings.debugMode).on('change', function () {
            settings.debugMode = !!$(this).prop('checked');
            saveSettings();
        });

        $('#rpg_main_sysprompt_backup_enabled').prop('checked', isMainSyspromptBackupEnabled(settings)).on('change', function () {
            const fresh = getSettings();
            fresh.mainSyspromptBackupEnabled = !!$(this).prop('checked');
            saveSettings();
            syncMainSyspromptBackupControlsUi();
        });

        $('#rpg_main_sysprompt_backup_stash').on('click', function () {
            const fresh = getSettings();
            if (!isMainSyspromptBackupEnabled(fresh)) {
                return toastr['warning']('Main prompt backup is disabled. Enable it above first.', 'RPG Tracker');
            }
            if (armMainSyspromptStash(fresh, true, { manual: true })) {
                toastr['success']('Current Quick Prompt Main saved to backup.', 'RPG Tracker');
            } else if (!getMainSyspromptTextarea()) {
                toastr['warning']('Quick Prompt Main is not open — open Quick Prompt first, then try again.', 'RPG Tracker');
            } else {
                toastr['error']('Could not save backup.', 'RPG Tracker');
            }
        });

        $('#rpg_main_sysprompt_backup_restore').on('click', function () {
            const fresh = getSettings();
            if (!isMainSyspromptBackupEnabled(fresh)) {
                return toastr['warning']('Main prompt backup is disabled. Enable it above first.', 'RPG Tracker');
            }
            if (!fresh.syspromptStashArmed) {
                return toastr['info']('No backup saved yet. Use Save current Main to backup first.', 'RPG Tracker');
            }
            if (restoreMainSyspromptStash(fresh, { manual: true })) {
                const note = fresh.enabled && !fresh.customSysprompt
                    ? ' Click ⏻ on the tracker panel to keep it — the framework may overwrite Main again while the tracker is on.'
                    : '';
                toastr['success'](`Backed-up Main prompt restored.${note}`, 'RPG Tracker');
            } else if (!getMainSyspromptTextarea()) {
                toastr['warning']('Quick Prompt Main is not open — open Quick Prompt first, then try again.', 'RPG Tracker');
            } else {
                toastr['error']('Could not restore backup.', 'RPG Tracker');
            }
        });

        syncMainSyspromptBackupControlsUi();

        $('#rpg_tracker_daynight_cycle').prop('checked', !!settings.dayNightCycleEnabled).on('change', function () {
            settings.dayNightCycleEnabled = !!$(this).prop('checked');
            saveSettings();
            const ta = document.getElementById('rpg-tracker-memo');
            refreshDayNightCycleFromMemo(ta ? ta.value : settings.currentMemo || '');
            applyPanelBackgroundToDom();
            refreshRenderedView();
        });

        // Panel background images (State Tracker + detached Lorebook Agent)
        /** @param {string} idPrefix @param {{ dayKey: string, nightKey: string, strengthKey: string }} keys */
        const wirePanelBgControls = (idPrefix, keys, dayToast, nightToast) => {
            const syncUi = () => {
                const cfg = getPanelBgConfig(settings, keys);
                const dayPreview = /** @type {HTMLElement|null} */ (document.getElementById(`${idPrefix}_preview`));
                const nightPreview = /** @type {HTMLElement|null} */ (document.getElementById(`${idPrefix}_night_preview`));
                const overlayInp = /** @type {HTMLInputElement|null} */ (document.getElementById(`${idPrefix}_overlay`));
                const overlayVal = document.getElementById(`${idPrefix}_overlay_val`);
                const urlInp = /** @type {HTMLInputElement|null} */ (document.getElementById(`${idPrefix}_url`));
                if (dayPreview) dayPreview.style.backgroundImage = cfg.daySrc ? `url(${JSON.stringify(cfg.daySrc)})` : 'none';
                if (nightPreview) nightPreview.style.backgroundImage = cfg.nightSrc ? `url(${JSON.stringify(cfg.nightSrc)})` : 'none';
                if (overlayInp) overlayInp.value = String(Math.round(cfg.strength * 100));
                if (overlayVal) overlayVal.textContent = `${Math.round(cfg.strength * 100)}%`;
                if (urlInp && cfg.daySrc.startsWith('http')) urlInp.value = cfg.daySrc;
                else if (urlInp && !cfg.daySrc) urlInp.value = '';
            };
            syncUi();

            const persist = async (/** @type {'day'|'night'} */ which, /** @type {string} */ src) => {
                let stored = (src || '').trim();
                if (stored.startsWith('data:image/')) {
                    try {
                        stored = await scalePanelBackgroundImage(stored);
                    } catch (err) {
                        console.error(err);
                        toastr['warning']('Could not process that image.', 'RPG Tracker');
                        return;
                    }
                } else if (stored && !/^https?:\/\//i.test(stored) && !stored.startsWith('data:')) {
                    toastr['warning']('Use an https image URL or upload a file.', 'RPG Tracker');
                    return;
                }
                settings[which === 'day' ? keys.dayKey : keys.nightKey] = stored;
                saveSettings();
                syncUi();
                applyPanelBackgroundToDom();
            };

            const uploadBtn = document.getElementById(`${idPrefix}_upload`);
            const fileInp = /** @type {HTMLInputElement|null} */ (document.getElementById(`${idPrefix}_file`));
            if (uploadBtn && fileInp) {
                uploadBtn.addEventListener('click', () => fileInp.click());
                fileInp.addEventListener('change', async () => {
                    const file = fileInp.files?.[0];
                    fileInp.value = '';
                    if (!file) return;
                    try {
                        await persist('day', String(await fileToDataUrl(file)));
                        toastr['success'](dayToast, 'RPG Tracker');
                    } catch (err) {
                        console.error(err);
                        toastr['warning']('Could not read that file.', 'RPG Tracker');
                    }
                });
            }

            const nightUploadBtn = document.getElementById(`${idPrefix}_night_upload`);
            const nightFileInp = /** @type {HTMLInputElement|null} */ (document.getElementById(`${idPrefix}_night_file`));
            if (nightUploadBtn && nightFileInp) {
                nightUploadBtn.addEventListener('click', () => nightFileInp.click());
                nightFileInp.addEventListener('change', async () => {
                    const file = nightFileInp.files?.[0];
                    nightFileInp.value = '';
                    if (!file) return;
                    try {
                        await persist('night', String(await fileToDataUrl(file)));
                        toastr['success'](nightToast, 'RPG Tracker');
                    } catch (err) {
                        console.error(err);
                        toastr['warning']('Could not read that file.', 'RPG Tracker');
                    }
                });
            }

            document.getElementById(`${idPrefix}_clear`)?.addEventListener('click', () => {
                settings[keys.dayKey] = '';
                saveSettings();
                syncUi();
                applyPanelBackgroundToDom();
            });
            document.getElementById(`${idPrefix}_night_clear`)?.addEventListener('click', () => {
                settings[keys.nightKey] = '';
                saveSettings();
                syncUi();
                applyPanelBackgroundToDom();
            });

            const urlInp = /** @type {HTMLInputElement|null} */ (document.getElementById(`${idPrefix}_url`));
            urlInp?.addEventListener('change', async () => {
                const url = urlInp.value.trim();
                if (!url) {
                    settings[keys.dayKey] = '';
                    saveSettings();
                    syncUi();
                    applyPanelBackgroundToDom();
                    return;
                }
                await persist('day', url);
            });

            const overlayInp = /** @type {HTMLInputElement|null} */ (document.getElementById(`${idPrefix}_overlay`));
            overlayInp?.addEventListener('input', () => {
                const val = Math.max(0, Math.min(100, parseInt(overlayInp.value, 10) || 0));
                settings[keys.strengthKey] = val;
                const overlayVal = document.getElementById(`${idPrefix}_overlay_val`);
                if (overlayVal) overlayVal.textContent = `${val}%`;
                applyPanelBackgroundToDom();
            });
            overlayInp?.addEventListener('change', () => saveSettings());

            return syncUi;
        };

        const syncTrackerPanelBgUi = wirePanelBgControls(
            'rpg_tracker_panel_bg',
            PANEL_BG_TRACKER_KEYS,
            'State Tracker background set.',
            'State Tracker night background set.',
        );
        const syncAgentPanelBgUi = wirePanelBgControls(
            'rpg_agent_panel_bg',
            PANEL_BG_AGENT_KEYS,
            'Lorebook Agent background set.',
            'Lorebook Agent night background set.',
        );
        globalThis._rpgSyncPanelBgSettingsUi = () => {
            syncTrackerPanelBgUi();
            syncAgentPanelBgUi();
        };

        $('#rpg_tracker_auto_reset_prompts').prop('checked', !!settings.autoResetPromptsOnUpdate).on('change', function () {
            settings.autoResetPromptsOnUpdate = !!$(this).prop('checked');
            saveSettings();
        });

        $('#rpg_tracker_enable_portraits').prop('checked', settings.enablePortraits !== false).on('change', async function () {
            settings.enablePortraits = !!$(this).prop('checked');
            saveSettings();
            refreshRenderedView();
            await refreshLorebookAgentViewsNow({ forceLayoutRefresh: true });
        });

        $('#rpg_portrait_generator_source').val(settings.portraitGeneratorSource || 'native').on('change', function () {
            settings.portraitGeneratorSource = String($(this).val());
            saveSettings();
            $('#rpg_tracker_pollinations_group').toggle(settings.portraitGeneratorSource === 'pollinations');
        });
        $('#rpg_tracker_pollinations_group').toggle((settings.portraitGeneratorSource || 'native') === 'pollinations');

        $('#rpg_tracker_portrait_skip_prompt').prop('checked', !!settings.portraitSkipPromptDialog).on('change', function () {
            settings.portraitSkipPromptDialog = !!$(this).prop('checked');
            saveSettings();
        });

        $('#rpg_tracker_hide_image_gen_toasts').prop('checked', !!settings.hideImageGenToasts).on('change', function () {
            settings.hideImageGenToasts = !!$(this).prop('checked');
            saveSettings();
        });

        $('#rpg_tracker_portrait_auto_player').prop('checked', !!settings.portraitAutoGeneratePlayer).on('change', function () {
            settings.portraitAutoGeneratePlayer = !!$(this).prop('checked');
            saveSettings();
            if (settings.portraitAutoGeneratePlayer) {
                forceCheckAutoGenerations(refreshAll);
            }
        });

        $('#rpg_tracker_portrait_auto_party').prop('checked', !!settings.portraitAutoGenerateParty).on('change', function () {
            settings.portraitAutoGenerateParty = !!$(this).prop('checked');
            saveSettings();
            if (settings.portraitAutoGenerateParty) {
                forceCheckAutoGenerations(refreshAll);
            }
        });

        $('#rpg_tracker_portrait_auto_enemies').prop('checked', !!settings.portraitAutoGenerateEnemies).on('change', function () {
            settings.portraitAutoGenerateEnemies = !!$(this).prop('checked');
            saveSettings();
            if (settings.portraitAutoGenerateEnemies) {
                forceCheckAutoGenerations(refreshAll);
            }
        });

        $('#rpg_tracker_portrait_auto_npcs').prop('checked', !!settings.portraitAutoGenerateNpcs).on('change', function () {
            if (settings.npcPortraits === false) return;
            settings.portraitAutoGenerateNpcs = !!$(this).prop('checked');
            saveSettings();
            if (settings.portraitAutoGenerateNpcs) {
                forceCheckAutoGenerations(refreshAll);
            }
        });

        $('#rpg_tracker_portrait_auto_locations').prop('checked', !!settings.portraitAutoGenerateLocations).on('change', function () {
            if (settings.portraitAutoGenerateSceneView) return;
            applyLocationImageAutoMode(settings, { lorebookLocations: !!$(this).prop('checked') });
            saveSettings();
            if (settings.portraitAutoGenerateLocations) {
                forceCheckAutoGenerations(refreshAll);
            }
        });

        $('#rpg_tracker_portrait_auto_scene_view').prop('checked', !!settings.portraitAutoGenerateSceneView).on('change', function () {
            applyLocationImageAutoMode(settings, { realTimeMode: !!$(this).prop('checked') });
            saveSettings();
            void refreshLorebookAgentViewsNow({ forceLayoutRefresh: true });
        });

        $('#rpg_tracker_portrait_realtime_trigger').val(settings.portraitRealtimeTriggerMode || 'location_change').on('change', function () {
            const mode = String($(this).val() || 'location_change');
            settings.portraitRealtimeTriggerMode = ['location_enter', 'location_change', 'every_n_outputs'].includes(mode)
                ? mode
                : 'location_change';
            syncLocationImageDependentUi(settings);
            saveSettings();
        });

        $('#rpg_tracker_portrait_realtime_every_n').val(Math.max(1, Number(settings.portraitRealtimeEveryNOutputs) || 1)).on('change input', function () {
            settings.portraitRealtimeEveryNOutputs = Math.max(1, Math.floor(Number($(this).val()) || 1));
            $(this).val(String(settings.portraitRealtimeEveryNOutputs));
            syncLocationImageDependentUi(settings);
            saveSettings();
        });

        syncLocationImageDependentUi(settings);

        $('#rpg_tracker_pollinations_key').val(settings.pollinationsApiKey || '').on('change', function () {
            settings.pollinationsApiKey = String($(this).val()).trim();
            saveSettings();
        });

        $('#rpg_tracker_inventory_worth_mode').val(settings.inventoryWorthMode || 'hover').on('change', function () {
            settings.inventoryWorthMode = String($(this).val());
            saveSettings();
            refreshRenderedView();
        });

        $('#rpg_tracker_show_total_value').prop('checked', settings.showTotalInventoryValue !== false).on('change', function () {
            settings.showTotalInventoryValue = !!$(this).prop('checked');
            saveSettings();
            refreshRenderedView();
        });

        const combatProfileSelect = $('#rpg_combat_connection_profile');
        const combatProfileGroup = $('#rpg_combat_profile_group');

        function updateCombatProfilePanel() {
            combatProfileGroup.toggle(!!settings.combatProfileAutoSwitch);
        }

        $('#rpg_tracker_combat_profile_auto_switch').prop('checked', !!settings.combatProfileAutoSwitch).on('change', async function () {
            settings.combatProfileAutoSwitch = !!$(this).prop('checked');
            updateCombatProfilePanel();
            saveSettings();
            if (!settings.combatProfileAutoSwitch) {
                await resetCombatProfileOverride(settings);
            } else {
                await syncCombatProfile(settings.currentMemo, settings);
            }
        });
        updateCombatProfilePanel();

        if (!tryBindConnectionProfileDropdown('#rpg_combat_connection_profile', settings.combatConnectionProfileId, (id) => {
            settings.combatConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                combatProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => combatProfileSelect.append($('<option></option>').val(p).text(p)));
                combatProfileSelect.val(settings.combatConnectionProfileId || '');
            });
            combatProfileSelect.on('change', function () {
                settings.combatConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        const combatPresetSelect = $('#rpg_combat_completion_preset');
        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            combatPresetSelect.empty().append('<option value="">-- Use Profile Preset --</option>');
            presets.forEach(p => combatPresetSelect.append($('<option></option>').val(p).text(p)));
            combatPresetSelect.val(settings.combatCompletionPresetId || '');
        } else {
            combatPresetSelect.empty().append('<option value="">-- Use Profile Preset --</option>');
            if (settings.combatCompletionPresetId) {
                combatPresetSelect.append($('<option></option>').val(settings.combatCompletionPresetId).text(settings.combatCompletionPresetId));
                combatPresetSelect.val(settings.combatCompletionPresetId);
            }
        }
        combatPresetSelect.on('change', function () {
            settings.combatCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });

        // RNG Help Popup Trigger (Settings)
        $('.rt-rng-help-icon').on('click', (e) => {
            e.stopPropagation();
            showRngExplanation();
        });
        $('.rt-narrative-pacing-help').on('click', (e) => {
            e.stopPropagation();
            showNarrativePacingExplanation();
        });

        $('#rpg_tracker_router_docs_btn').on('click', (e) => {
            e.stopPropagation();
            showLorebookAgentDocumentation();
        });

        $('#rpg_tracker_legacy_dice').prop('checked', settings.legacyDiceNaming).on('change', function () {
            settings.legacyDiceNaming = !!$(this).prop('checked');
            saveSettings();
            registerDiceFunctionTool();
            registerDiceSlashCommand();
            toastr['info']("Dice logic updated.", "RPG Tracker");
        });

        $('#rpg_tracker_dice_d100_mode').prop('checked', !!settings.diceD100Mode).on('change', function () {
            settings.diceD100Mode = !!$(this).prop('checked');
            autoSelectRngToolsFromMode(settings);
            saveSettings();
            registerDiceFunctionTool();
            registerDiceSlashCommand();
            scheduleAutoApply();
            toastr['info'](settings.diceD100Mode ? '🎲 d100 Mode enabled.' : '🎲 d100 Mode disabled — reverted to d20.', 'RPG Tracker');
        });

        $('#rpg_rng_tool_d20').prop('checked', !!settings.rngToolD20).on('change', function () {
            settings.rngToolD20 = !!$(this).prop('checked');
            updateD100ToggleState(settings);
            saveSettings();
            registerDiceFunctionTool();
            scheduleAutoApply();
        });

        $('#rpg_rng_tool_d100').prop('checked', !!settings.rngToolD100).on('change', function () {
            settings.rngToolD100 = !!$(this).prop('checked');
            updateD100ToggleState(settings);
            saveSettings();
            registerDiceFunctionTool();
            scheduleAutoApply();
        });

        $('#rpg_rng_queue_d20').prop('checked', !!settings.rngQueueD20).on('change', function () {
            settings.rngQueueD20 = !!$(this).prop('checked');
            updateD100ToggleState(settings);
            saveSettings();
            scheduleAutoApply();
        });

        $('#rpg_rng_queue_d100').prop('checked', !!settings.rngQueueD100).on('change', function () {
            settings.rngQueueD100 = !!$(this).prop('checked');
            updateD100ToggleState(settings);
            saveSettings();
            scheduleAutoApply();
        });

        $('#rpg_tracker_dice_function_tool').prop('checked', settings.diceFunctionTool).on('change', function () {
            settings.diceFunctionTool = !!$(this).prop('checked');
            saveSettings();
            registerDiceFunctionTool();
        });

        $('#rpg_tracker_chat_link_enabled').prop('checked', !!settings.chatLinkEnabled).on('change', function () {
            const s = getSettings();
            const turningOn = !!$(this).prop('checked');

            // If we're turning it on from the settings menu, just simulate the button click logic
            // but keep it simple here. The panel button is the primary toggle.
            s.chatLinkEnabled = turningOn;
            saveSettings();
            updateChatLinkUI();

            if (turningOn && runtimeState.currentChatId) {
                const saved = s.chatStates?.[runtimeState.currentChatId];
                if (saved && saved.currentMemo && s.currentMemo && s.currentMemo !== saved.currentMemo) {
                    // In settings we'll just do the safe silent restore if they checked the box
                    // because async confirms in jQuery 'change' events can be janky.
                    // The panel button handles the explicit decision better.
                    loadChatState(runtimeState.currentChatId);
                } else {
                    const found = loadChatState(runtimeState.currentChatId);
                    if (!found) saveChatState(runtimeState.currentChatId);
                }
            }
        });

        updateChatLinkUI();

        $('#rpg_tracker_clear_chat_states').on('click', function () {
            const s = getSettings();
            const count = Object.keys(s.chatStates || {}).length;
            if (count === 0) return toastr['info']('No saved chat states to clear.', 'RPG Tracker');
            if (confirm(`Clear ALL ${count} saved chat state(s)?\n\nThis removes the auto-saved tracker data for every chat. Your current live state is unaffected.\n\nProceed?`)) {
                s.chatStates = {};
                saveSettings();
                toastr['success'](`Cleared ${count} chat state(s).`, 'RPG Tracker');
            }
        });

        $('#rpg_tracker_purge_all_portraits').on('click', async function () {
            const s = getSettings();
            const embedded = countEmbeddedPortraitDataUrls(s);
            const fileRefs = [...collectAllPortraitRefs(s)].filter(isManagedPortraitPath).length;
            const totalMaps = Object.keys(s.customPortraits || {}).length
                + Object.keys(s.customLocationImages || {}).length
                + Object.values(s.chatStates || {}).reduce((n, cs) => n + Object.keys(cs.customPortraits || {}).length + Object.keys(cs.customLocationImages || {}).length, 0);
            if (totalMaps === 0 && embedded === 0 && fileRefs === 0) {
                return toastr['info']('No portraits to purge.', 'RPG Tracker');
            }
            const msg = [
                'Purge ALL Multihog portraits?',
                '',
                `• ${totalMaps} portrait reference(s) across live state + chat links`,
                embedded > 0 ? `• ${embedded} still embedded in settings (will be removed)` : null,
                fileRefs > 0 ? `• ${fileRefs} file(s) under user/images/${PORTRAIT_STORAGE_FOLDER}/` : null,
                '',
                'Memos, lorebooks, and chat history are not affected.',
                'This cannot be undone.',
            ].filter(Boolean).join('\n');
            if (!confirm(msg)) return;
            try {
                await purgeAllPortraitData(s);
                s.portraitsFileStorageVersion = 1;
                await saveSettings(true);
                refreshRenderedView();
                toastr['success']('All portraits purged. Restart SillyTavern if the UI still feels sluggish.', 'RPG Tracker');
            } catch (err) {
                console.error('[RPG Tracker] Portrait purge failed:', err);
                toastr['error']('Portrait purge failed — see console.', 'RPG Tracker');
            }
        });

        // ─── Event Hooks ───
        eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
        eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
        eventSource.on(event_types.GENERATION_STOPPED, onGenerationEnded);
        if (event_types.MESSAGE_EDITED) eventSource.on(event_types.MESSAGE_EDITED, handleRelationshipSwipeChange);
        if (event_types.MESSAGE_SWIPED) eventSource.on(event_types.MESSAGE_SWIPED, handleRelationshipSwipeChange);

        // ─── Chat Link ───
        // Bootstrap: restore state for whichever chat is already open (before CHAT_CHANGED can fire).
        sanitizeRouterState(settings);
        const bootChatId = ctx.chatId || ctx.getCurrentChatId?.() || null;
        runtimeState.currentChatId = bootChatId;
        // Strip intentionally-deleted custom modules before loadChatState.
        // A browser-local configuration backup is never applied automatically: it may
        // be a genuine interrupted save or simply an older browser's cache.
        // Also strip global UI prefs from chat partitions so loadChatState cannot clobber
        // auto-image-gen / immersion / connection settings from a stale snapshot.
        const strippedTombstones = applyDeletedCustomTagTombstones();
        const strippedGlobalUi = stripChatStateGlobalUiPrefs(settings);
        const pendingSettingsBackup = LEGACY_LOCAL_RECOVERY_ENABLED ? getPendingModuleSchemaBackup() : null;
        const healedFromBackup = pendingSettingsBackup && await confirmLocalSettingsRecovery(pendingSettingsBackup)
            ? applyModuleSchemaBackup(bootChatId, pendingSettingsBackup)
            : false;
        if ((strippedTombstones || healedFromBackup || strippedGlobalUi) && settings.debugMode) {
            console.log('[RPG Tracker] Healed module schema before chat-state load.', {
                strippedTombstones, healedFromBackup, strippedGlobalUi,
            });
        }
        if (healedFromBackup) {
            toastr['info']('Restored the browser-local tracker configuration you selected.', 'RPG Tracker', { timeOut: 6000 });
        }
        eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
        if (bootChatId && settings.chatLinkEnabled) {
            const restoredBootChat = loadChatState(bootChatId);
            if (!restoredBootChat && !settings.chatStates?.[bootChatId]) resetUnseenChatState(settings);
            // loadChatState can reintroduce tombstoned tags from a stale partition — strip again.
            applyDeletedCustomTagTombstones();
        }
        // Compare the just-loaded (disk) memo against this browser's last-seen live copy
        // BEFORE any boot-time save can mirror the (possibly stale) disk memo over the
        // recovery evidence. Runs regardless of chatLinkEnabled — the top-level currentMemo
        // can go stale from a lost disk write either way.
        if (LEGACY_LOCAL_RECOVERY_ENABLED && bootChatId) {
            await ensureLocalMemoRecovery(bootChatId);
        } else if (LEGACY_LOCAL_RECOVERY_ENABLED) {
            console.warn('[RPG Tracker] Memo recovery deferred: no boot chatId');
            setTimeout(() => {
                if (!memoRecovery?.isBootCheckDone()) {
                    console.warn('[RPG Tracker] Memo recovery gate opened after timeout (no chat yet)');
                    memoRecovery?.markBootCheckDone();
                }
            }, 20000);
        }
        // Baseline WAL after boot so the next cancelled save still has a sync snapshot.
        writeModuleSchemaBackup(bootChatId);
        // If we healed from WAL/tombstones, push the repaired schema to disk so settings.js catches up.
        if ((strippedTombstones || healedFromBackup || strippedGlobalUi)) {
            void saveSettings(true);
        }

        // Migrate legacy base64 portraits after chat state is loaded so loadChatState
        // cannot overwrite freshly migrated paths before the synchronous disk flush.
        await runPortraitMigrationIfNeeded();

        // ─── Flush-on-unload / tab-hide safety net ───
        // saveSettings() debounces disk writes by ~2s, and ST's saveSettings() is async
        // (fetch). Reloading for a code update before the write lands resurrects the last
        // flushed snapshot — looks like settings "reset to a particular point."
        // Chat Link makes memo/modules worse: boot runs loadChatState() from chatStates.
        // Global UI prefs (auto-image-gen, immersion, connections, panel backgrounds) are
        // intentionally NOT stored in chatStates anymore — only campaign/memo state is.
        //
        // Order matters: snapshot chatStates FIRST, then write.
        // Also flush on visibility hidden so the async save usually finishes before reload.
        let _flushInFlight = false;
        const flushPendingSettingsToDisk = (reason = 'flush') => {
            if (_flushInFlight) return;
            _flushInFlight = true;
            try {
                if (typeof globalThis._rpgFlushRawMemoChanges === 'function') {
                    globalThis._rpgFlushRawMemoChanges();
                }
                if (_saveSettingsTimer) {
                    clearTimeout(_saveSettingsTimer);
                    _saveSettingsTimer = null;
                }
                const s = getSettings();
                // Do this FIRST and unconditionally — localStorage.setItem is synchronous
                // and cannot be cancelled by the unload that's about to happen, unlike the
                // disk write below. This is the actual safety net; everything after is best-effort.
                snapshotMemoToLocalStorage(runtimeState.currentChatId);
                // Snapshot chat-linked fields first so loadChatState() on next boot
                // cannot overwrite live settings with a stale per-chat copy.
                if (s.chatLinkEnabled && runtimeState.currentChatId) {
                    saveChatState(runtimeState.currentChatId);
                }
                // Always force a disk write. saveChatState already calls saveSettings when
                // it runs, but it can no-op (portrait migration lock) — so flush anyway.
                const flushCtx = SillyTavern.getContext();
                if (typeof flushCtx.saveSettings === 'function') void flushCtx.saveSettings();
                else flushCtx.saveSettingsDebounced?.();
                if (s.debugMode) console.log(`[RPG Tracker] Settings flushed (${reason}).`);
            } catch (err) {
                console.warn('[RPG Tracker] Settings flush failed:', err);
            } finally {
                // Allow another flush after this tick (e.g. hide then unload).
                setTimeout(() => { _flushInFlight = false; }, 0);
            }
        };
        window.addEventListener('beforeunload', () => flushPendingSettingsToDisk('beforeunload'));
        window.addEventListener('pagehide', () => flushPendingSettingsToDisk('pagehide'));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flushPendingSettingsToDisk('visibilityhidden');
        });
        // Always run activation when routerEnabled — regardless of chatLinkEnabled —
        // so the correct lorebook stack is live from the very first message.
        if (settings.routerEnabled && bootChatId) {
            _sessionBootstrapChatId = bootChatId;
            const bootBooks = settings.chatStates?.[bootChatId]?.campaignBooks;
            if (bootBooks?.length && typeof ctx.executeSlashCommandsWithOptions === 'function') {
                // Fast path: exact book list known — skip the slow registry scan.
                (async () => {
                    for (const name of bootBooks) {
                        await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${name}"`).catch(() => { });
                    }
                    const bootPrefix = getEffectiveRouterCampaignPrefix(bootChatId);
                    const worldBookName = bootPrefix ? `${bootPrefix}_World` : 'World';
                    if (settings.worldProgressionEnabled) {
                        await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${worldBookName}"`).catch(() => { });
                    } else {
                        await ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${worldBookName}"`).catch(() => { });
                    }
                })();
            } else {
                // Fallback for first-time chats where no saved book list exists yet.
                _bootstrapSyncPromise = syncCampaignPrefixAndWorldsForChat(bootChatId, 'BOOTSTRAP')
                    .finally(() => { _bootstrapSyncPromise = null; });
            }
        }

        // ─── Dice System ───
        installInterceptor();
        installRouterInterceptor();

        // Ensure managed lorebook entries have disable:true so ST's native keyword
        // scanner never injects them. Deferred so F5 startup stays responsive.
        const s = getSettings();
        if (s.routerEnabled) {
            scheduleDeferred(() => {
                disableManagedEntries().catch(e => console.warn('[RPG Tracker] disableManagedEntries on init failed:', e));
            });
        }

        registerDiceFunctionTool();
        registerDiceSlashCommand();

        // ─── Quest System ───
        import('./quests.js').then(({ unregisterLogQuestTool, installQuestDebugTools, computeFrustration }) => {
            unregisterLogQuestTool();
            installQuestDebugTools();
            // Expose for renderQuestLog (renderer can't import dynamically)
            // getQuestMood is from memo-processor.js (no circular dep)
            globalThis.__rpgQuestUtils = { computeFrustration, getQuestMood };
        }).catch(e => console.error('[RPG Tracker] quests.js failed to load:', e));

        initializeDebugViewer();
        installSwipeSchedulerDebug({ getInternals: getRouterSchedulerInternals });

        // Connection Settings
        const sourceSelect = $('#rpg_tracker_connection_source');
        const profileGroup = $('#rpg_tracker_profile_group');
        const profileSelect = $('#rpg_tracker_connection_profile');
        const ollamaGroup = $('#rpg_tracker_ollama_group');
        const openaiGroup = $('#rpg_tracker_openai_group');


        function updateConnectionPanels() {
            const source = sourceSelect.val();
            profileGroup.toggle(source === 'profile');
            ollamaGroup.toggle(source === 'ollama');
            openaiGroup.toggle(source === 'openai');
        }

        sourceSelect.val(settings.connectionSource).on('change', function () {
            settings.connectionSource = $(this).val();
            updateConnectionPanels();
            saveSettings();
        });
        updateConnectionPanels();

        // Ollama
        $('#rpg_tracker_ollama_url').val(settings.ollamaUrl).on('input', function () {
            settings.ollamaUrl = $(this).val();
            saveSettings();
        });
        const ollamaModelSelect = $('#rpg_tracker_ollama_model');
        ollamaModelSelect.val(settings.ollamaModel).on('change', function () {
            settings.ollamaModel = $(this).val();
            saveSettings();
        });

        async function refreshOllamaModelsList() {
            const url = $('#rpg_tracker_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                ollamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    ollamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                ollamaModelSelect.val(settings.ollamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                console.error("[RPG Tracker] Ollama fetch failed:", e);
                toastr['error']("Failed to fetch Ollama models. Check console.");
            }
        }
        $('#rpg_tracker_ollama_refresh').on('click', refreshOllamaModelsList);

        // OpenAI
        $('#rpg_tracker_openai_url').val(settings.openaiUrl).on('input', function () {
            settings.openaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_tracker_openai_key').val(settings.openaiKey).on('input', function () {
            settings.openaiKey = $(this).val();
            saveSettings();
        });

        const openaiModelSelect = $('#rpg_tracker_openai_model');
        const openaiModelManual = $('#rpg_tracker_openai_model_manual');

        // The effective model is: manual input (if filled) > dropdown selection
        function getOpenAIModel() {
            const manual = String(openaiModelManual.val() || '').trim();
            return manual || String(openaiModelSelect.val() || '') || '';
        }

        // Initialize: if saved model isn't in dropdown yet, show it in the manual field
        openaiModelManual.val(settings.openaiModel || '');
        openaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                // Dropdown selected — clear manual, save selection
                openaiModelManual.val('');
                settings.openaiModel = val;
            } else {
                settings.openaiModel = String(openaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        openaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) {
                // Manual overrides dropdown — deselect it visually
                openaiModelSelect.val('');
            }
            settings.openaiModel = manual || openaiModelSelect.val() || '';
            saveSettings();
        });

        async function refreshOpenAIModelsList() {
            const url = $('#rpg_tracker_openai_url').val();
            const key = $('#rpg_tracker_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models from endpoint...");
                const models = await fetchOpenAIModels(url, key);
                openaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) openaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                // Restore saved selection
                const saved = settings.openaiModel;
                if (saved && openaiModelSelect.find(`option[value="${saved}"]`).length) {
                    openaiModelSelect.val(saved);
                    openaiModelManual.val('');
                }
                toastr['success'](`${models.length} model(s) found.`);
            } catch (e) {
                console.error("[RPG Tracker] OpenAI fetch failed:", e);
                // Show a short toast; full details logged to console
                toastr['warning'](
                    "Cannot auto-detect models (CORS). Type the model name manually below, or enable enableCorsProxy: true in ST's config.yaml.",
                    "Model Sniffing Unavailable",
                    { timeOut: 8000 }
                );
            }
        }
        $('#rpg_tracker_openai_refresh').on('click', refreshOpenAIModelsList);

        $('#rpg_tracker_openai_test').on('click', async function () {
            const url = $('#rpg_tracker_openai_url').val();
            const key = $('#rpg_tracker_openai_key').val();
            const model = getOpenAIModel();
            if (!url) return toastr['info']("Enter the Endpoint URL first.");
            if (!model) return toastr['info']("Enter or select a model name first.");
            toastr['info']("Testing OpenAI connection...");
            const result = await testOpenAIConnection(url, key, model);
            if (result.success) {
                toastr['success'](result.message);
                await refreshOpenAIModelsList();
            } else {
                toastr['error'](result.message);
            }
        });



        // ── Portrait Connection Settings UI Bindings ──
        const portraitSourceSelect = $('#rpg_portrait_connection_source');
        const portraitProfileGroup = $('#rpg_portrait_profile_group');
        const portraitProfileSelect = $('#rpg_portrait_connection_profile');
        const portraitOllamaGroup = $('#rpg_portrait_ollama_group');
        const portraitOpenaiGroup = $('#rpg_portrait_openai_group');

        function updatePortraitConnectionPanels() {
            const source = portraitSourceSelect.val();
            portraitProfileGroup.toggle(source === 'profile');
            portraitOllamaGroup.toggle(source === 'ollama');
            portraitOpenaiGroup.toggle(source === 'openai');
        }

        portraitSourceSelect.val(settings.portraitConnectionSource || 'default').on('change', function () {
            settings.portraitConnectionSource = $(this).val();
            updatePortraitConnectionPanels();
            saveSettings();
        });
        updatePortraitConnectionPanels();

        // Ollama URL / Model
        $('#rpg_portrait_ollama_url').val(settings.portraitOllamaUrl || 'http://localhost:11434').on('input', function () {
            settings.portraitOllamaUrl = $(this).val();
            saveSettings();
        });
        const portraitOllamaModelSelect = $('#rpg_portrait_ollama_model');
        portraitOllamaModelSelect.val(settings.portraitOllamaModel).on('change', function () {
            settings.portraitOllamaModel = $(this).val();
            saveSettings();
        });
        $('#rpg_portrait_ollama_refresh').on('click', async function () {
            const url = $('#rpg_portrait_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                portraitOllamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    portraitOllamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                portraitOllamaModelSelect.val(settings.portraitOllamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                toastr['error']("Failed to fetch Ollama models.");
            }
        });

        // OpenAI URL / Key / Model
        $('#rpg_portrait_openai_url').val(settings.portraitOpenaiUrl).on('input', function () {
            settings.portraitOpenaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_portrait_openai_key').val(settings.portraitOpenaiKey).on('input', function () {
            settings.portraitOpenaiKey = $(this).val();
            saveSettings();
        });
        const portraitOpenaiModelSelect = $('#rpg_portrait_openai_model');
        const portraitOpenaiModelManual = $('#rpg_portrait_openai_model_manual');
        portraitOpenaiModelManual.val(settings.portraitOpenaiModel || '');
        portraitOpenaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                portraitOpenaiModelManual.val('');
                settings.portraitOpenaiModel = String(val);
            } else {
                settings.portraitOpenaiModel = String(portraitOpenaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        portraitOpenaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) portraitOpenaiModelSelect.val('');
            settings.portraitOpenaiModel = manual || String(portraitOpenaiModelSelect.val() || '') || '';
            saveSettings();
        });
        $('#rpg_portrait_openai_refresh').on('click', async function () {
            const url = $('#rpg_portrait_openai_url').val();
            const key = $('#rpg_portrait_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models...");
                const models = await fetchOpenAIModels(url, key);
                portraitOpenaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) portraitOpenaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                portraitOpenaiModelSelect.val(settings.portraitOpenaiModel);
                toastr['success']("Models updated.");
            } catch (e) {
                toastr['warning']("Cannot auto-detect models. Type manually.");
            }
        });

        // Profiles / Presets
        const portraitPresetSelect = $('#rpg_portrait_completion_preset');
        if (!tryBindConnectionProfileDropdown('#rpg_portrait_connection_profile', settings.portraitConnectionProfileId, (id) => {
            settings.portraitConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                portraitProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => portraitProfileSelect.append($('<option></option>').val(p).text(p)));
                portraitProfileSelect.val(settings.portraitConnectionProfileId || "");
            });
            portraitProfileSelect.on('change', function () {
                settings.portraitConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            portraitPresetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => portraitPresetSelect.append($('<option></option>').val(p).text(p)));
            portraitPresetSelect.val(settings.portraitCompletionPresetId || '');
        }
        portraitPresetSelect.on('change', function () {
            settings.portraitCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });

        // ── Portrait Prompt Templates ──
        $('#rpg_portrait_prompt_word_target').val(settings.portraitPromptWordTarget ?? 200).on('input', function () {
            const raw = parseInt(String($(this).val() || ''), 10);
            settings.portraitPromptWordTarget = isNaN(raw) ? 200 : Math.max(1, Math.min(2000, raw));
            saveSettings();
        });

        $('#rpg_portrait_npc_system_prompt').val(settings.portraitNpcSystemPrompt).on('input', function () {
            settings.portraitNpcSystemPrompt = String($(this).val() || '');
            saveSettings();
        });

        $('#rpg_portrait_character_system_prompt').val(settings.portraitCharacterSystemPrompt).on('input', function () {
            settings.portraitCharacterSystemPrompt = String($(this).val() || '');
            saveSettings();
        });

        $('#rpg_portrait_location_system_prompt').val(settings.portraitLocationSystemPrompt || '').on('input', function () {
            settings.portraitLocationSystemPrompt = String($(this).val() || '');
            saveSettings();
        });

        $('#rpg_portrait_location_include_present_npcs').prop('checked', !!settings.portraitLocationIncludePresentNpcs).on('change', function () {
            const s = getSettings();
            if (s.portraitAutoGenerateSceneView) {
                syncLocationImageDependentUi(s);
                return;
            }
            const enabled = !!$(this).prop('checked');
            s.portraitLocationIncludePresentNpcs = enabled;
            // Always swap the Location Scene Prompt with the matching factory default —
            // this toggle exists to change character-inclusion wording in that prompt.
            syncPortraitLocationPromptForNpcToggle(s, enabled, { force: true });
            saveSettings(true);
        });
        // Align any leftover legacy factory prompt with the current toggle on load.
        syncPortraitLocationPromptForNpcToggle(settings, !!settings.portraitLocationIncludePresentNpcs);

        $('#rpg_portrait_npc_btn_reset_prompt').on('click', function () {
            if (!confirm('Reset NPC/PC Portrait Prompt to default?')) return;

            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].portraitNpcSystemPrompt;
            }
            const freshDefault = getSettings().portraitNpcSystemPrompt;

            const s = getSettings();
            s.portraitNpcSystemPrompt = freshDefault;

            $('#rpg_portrait_npc_system_prompt').val(freshDefault);
            saveSettings();
            toastr['success']('NPC/PC Portrait Prompt reset to default.', 'RPG Tracker');
        });

        $('#rpg_portrait_character_btn_reset_prompt').on('click', function () {
            if (!confirm('Reset Character/Party/Combat Portrait Prompt to default?')) return;

            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].portraitCharacterSystemPrompt;
            }
            const freshDefault = getSettings().portraitCharacterSystemPrompt;

            const s = getSettings();
            s.portraitCharacterSystemPrompt = freshDefault;

            $('#rpg_portrait_character_system_prompt').val(freshDefault);
            saveSettings();
            toastr['success']('Character/Party/Combat Portrait Prompt reset to default.', 'RPG Tracker');
        });

        $('#rpg_portrait_location_btn_reset_prompt').on('click', function () {
            if (!confirm('Reset Location Scene Prompt to default?')) return;

            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].portraitLocationSystemPrompt;
            }

            const s = getSettings();
            const freshDefault = getDefaultPortraitLocationSystemPrompt(!!s.portraitLocationIncludePresentNpcs);
            s.portraitLocationSystemPrompt = freshDefault;

            setPortraitLocationPromptTextarea(freshDefault);
            saveSettings();
            toastr['success']('Location Scene Prompt reset to default.', 'RPG Tracker');
        });

        $('#rpg_portrait_prompt_preset_save_btn').on('click', function () {
            const name = prompt('Enter a name for this portrait prompt setup:', 'My Portrait Prompts');
            if (!name || !name.trim()) return;
            const trimmedName = name.trim();
            if (settings.savedPortraitPromptPresets && settings.savedPortraitPromptPresets[trimmedName]) {
                if (!confirm(`A setup named "${trimmedName}" already exists. Overwrite?`)) return;
            }
            if (!settings.savedPortraitPromptPresets) settings.savedPortraitPromptPresets = {};
            settings.savedPortraitPromptPresets[trimmedName] = {
                npcSystemPrompt: settings.portraitNpcSystemPrompt,
                characterSystemPrompt: settings.portraitCharacterSystemPrompt,
                wordTarget: settings.portraitPromptWordTarget,
            };
            saveSettings();
            refreshPortraitPromptPresetsList();
            toastr['success'](`Saved "${trimmedName}" to library.`, 'Portrait Prompt Library');
        });

        refreshPortraitPromptPresetsList();

        // ── World Progression Connection Settings UI Bindings ──
        const worldSourceSelect = $('#rpg_world_connection_source');
        const worldProfileGroup = $('#rpg_world_profile_group');
        const worldProfileSelect = $('#rpg_world_connection_profile');
        const worldOllamaGroup = $('#rpg_world_ollama_group');
        const worldOpenaiGroup = $('#rpg_world_openai_group');

        function updateWorldConnectionPanels() {
            const source = worldSourceSelect.val();
            worldProfileGroup.toggle(source === 'profile');
            worldOllamaGroup.toggle(source === 'ollama');
            worldOpenaiGroup.toggle(source === 'openai');
        }

        worldSourceSelect.val(settings.worldConnectionSource || 'default').on('change', function () {
            settings.worldConnectionSource = $(this).val();
            updateWorldConnectionPanels();
            saveSettings();
        });
        updateWorldConnectionPanels();

        // Ollama URL / Model
        $('#rpg_world_ollama_url').val(settings.worldOllamaUrl || 'http://localhost:11434').on('input', function () {
            settings.worldOllamaUrl = $(this).val();
            saveSettings();
        });
        const worldOllamaModelSelect = $('#rpg_world_ollama_model');
        worldOllamaModelSelect.val(settings.worldOllamaModel).on('change', function () {
            settings.worldOllamaModel = $(this).val();
            saveSettings();
        });
        $('#rpg_world_ollama_refresh').on('click', async function () {
            const url = $('#rpg_world_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                worldOllamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    worldOllamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                worldOllamaModelSelect.val(settings.worldOllamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                toastr['error']("Failed to fetch Ollama models.");
            }
        });

        // OpenAI URL / Key / Model
        $('#rpg_world_openai_url').val(settings.worldOpenaiUrl).on('input', function () {
            settings.worldOpenaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_world_openai_key').val(settings.worldOpenaiKey).on('input', function () {
            settings.worldOpenaiKey = $(this).val();
            saveSettings();
        });
        const worldOpenaiModelSelect = $('#rpg_world_openai_model');
        const worldOpenaiModelManual = $('#rpg_world_openai_model_manual');
        worldOpenaiModelManual.val(settings.worldOpenaiModel || '');
        worldOpenaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                worldOpenaiModelManual.val('');
                settings.worldOpenaiModel = String(val);
            } else {
                settings.worldOpenaiModel = String(worldOpenaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        worldOpenaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) worldOpenaiModelSelect.val('');
            settings.worldOpenaiModel = manual || String(worldOpenaiModelSelect.val() || '') || '';
            saveSettings();
        });
        $('#rpg_world_openai_refresh').on('click', async function () {
            const url = $('#rpg_world_openai_url').val();
            const key = $('#rpg_world_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models...");
                const models = await fetchOpenAIModels(url, key);
                worldOpenaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) worldOpenaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                worldOpenaiModelSelect.val(settings.worldOpenaiModel);
                toastr['success']("Models updated.");
            } catch (e) {
                toastr['warning']("Cannot auto-detect models. Type manually.");
            }
        });

        // Profiles / Presets
        const worldPresetSelect = $('#rpg_world_completion_preset');
        if (!tryBindConnectionProfileDropdown('#rpg_world_connection_profile', settings.worldConnectionProfileId, (id) => {
            settings.worldConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                worldProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => worldProfileSelect.append($('<option></option>').val(p).text(p)));
                worldProfileSelect.val(settings.worldConnectionProfileId || "");
            });
            worldProfileSelect.on('change', function () {
                settings.worldConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            worldPresetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => worldPresetSelect.append($('<option></option>').val(p).text(p)));
            worldPresetSelect.val(settings.worldCompletionPresetId || '');
        }
        worldPresetSelect.on('change', function () {
            settings.worldCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });

        // ── Game System Wizard Connection Settings UI Bindings ──
        const gsWizardSourceSelect = $('#rpg_gs_wizard_connection_source');
        const gsWizardProfileGroup = $('#rpg_gs_wizard_profile_group');
        const gsWizardProfileSelect = $('#rpg_gs_wizard_connection_profile');
        const gsWizardOllamaGroup = $('#rpg_gs_wizard_ollama_group');
        const gsWizardOpenaiGroup = $('#rpg_gs_wizard_openai_group');

        function updateGsWizardConnectionPanels() {
            const source = gsWizardSourceSelect.val();
            gsWizardProfileGroup.toggle(source === 'profile');
            gsWizardOllamaGroup.toggle(source === 'ollama');
            gsWizardOpenaiGroup.toggle(source === 'openai');
        }

        gsWizardSourceSelect.val(settings.gameSystemWizardConnectionSource || 'default').on('change', function () {
            settings.gameSystemWizardConnectionSource = $(this).val();
            updateGsWizardConnectionPanels();
            saveSettings();
        });
        updateGsWizardConnectionPanels();

        $('#rpg_gs_wizard_ollama_url').val(settings.gameSystemWizardOllamaUrl || 'http://localhost:11434').on('input', function () {
            settings.gameSystemWizardOllamaUrl = $(this).val();
            saveSettings();
        });
        const gsWizardOllamaModelSelect = $('#rpg_gs_wizard_ollama_model');
        gsWizardOllamaModelSelect.val(settings.gameSystemWizardOllamaModel).on('change', function () {
            settings.gameSystemWizardOllamaModel = $(this).val();
            saveSettings();
        });
        $('#rpg_gs_wizard_ollama_refresh').on('click', async function () {
            const url = $('#rpg_gs_wizard_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                gsWizardOllamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    gsWizardOllamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                gsWizardOllamaModelSelect.val(settings.gameSystemWizardOllamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                toastr['error']("Failed to fetch Ollama models.");
            }
        });

        $('#rpg_gs_wizard_openai_url').val(settings.gameSystemWizardOpenaiUrl).on('input', function () {
            settings.gameSystemWizardOpenaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_gs_wizard_openai_key').val(settings.gameSystemWizardOpenaiKey).on('input', function () {
            settings.gameSystemWizardOpenaiKey = $(this).val();
            saveSettings();
        });
        const gsWizardOpenaiModelSelect = $('#rpg_gs_wizard_openai_model');
        const gsWizardOpenaiModelManual = $('#rpg_gs_wizard_openai_model_manual');
        gsWizardOpenaiModelManual.val(settings.gameSystemWizardOpenaiModel || '');
        gsWizardOpenaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                gsWizardOpenaiModelManual.val('');
                settings.gameSystemWizardOpenaiModel = String(val);
            } else {
                settings.gameSystemWizardOpenaiModel = String(gsWizardOpenaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        gsWizardOpenaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) gsWizardOpenaiModelSelect.val('');
            settings.gameSystemWizardOpenaiModel = manual || String(gsWizardOpenaiModelSelect.val() || '') || '';
            saveSettings();
        });
        $('#rpg_gs_wizard_openai_refresh').on('click', async function () {
            const url = $('#rpg_gs_wizard_openai_url').val();
            const key = $('#rpg_gs_wizard_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models...");
                const models = await fetchOpenAIModels(url, key);
                gsWizardOpenaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) gsWizardOpenaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                gsWizardOpenaiModelSelect.val(settings.gameSystemWizardOpenaiModel);
                toastr['success']("Models updated.");
            } catch (e) {
                toastr['warning']("Cannot auto-detect models. Type manually.");
            }
        });

        const gsWizardPresetSelect = $('#rpg_gs_wizard_completion_preset');
        if (!tryBindConnectionProfileDropdown('#rpg_gs_wizard_connection_profile', settings.gameSystemWizardConnectionProfileId, (id) => {
            settings.gameSystemWizardConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                gsWizardProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => gsWizardProfileSelect.append($('<option></option>').val(p).text(p)));
                gsWizardProfileSelect.val(settings.gameSystemWizardConnectionProfileId || "");
            });
            gsWizardProfileSelect.on('change', function () {
                settings.gameSystemWizardConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            gsWizardPresetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => gsWizardPresetSelect.append($('<option></option>').val(p).text(p)));
            gsWizardPresetSelect.val(settings.gameSystemWizardCompletionPresetId || '');
        }
        gsWizardPresetSelect.on('change', function () {
            settings.gameSystemWizardCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });

        // Advanced Options
        const sinceLastUserChk = $('#rpg_tracker_lookback_since_last_user');
        const lookbackNumericRow = $('#rpg_tracker_lookback_numeric_row');
        const lookbackInput = $('#rpg_tracker_lookback_messages');

        const applySinceLastUserUI = (enabled) => {
            lookbackNumericRow.css({ opacity: enabled ? '0.35' : '1', 'pointer-events': enabled ? 'none' : 'auto' });
        };

        if (sinceLastUserChk.length) {
            const isEnabled = settings.lookbackSinceLastUser !== false; // default true
            sinceLastUserChk.prop('checked', isEnabled);
            applySinceLastUserUI(isEnabled);
            sinceLastUserChk.on('change', function () {
                settings.lookbackSinceLastUser = !!$(this).prop('checked');
                applySinceLastUserUI(settings.lookbackSinceLastUser);
                saveSettings();
            });
        }
        if (lookbackInput.length) {
            lookbackInput.val(settings.lookbackMessages !== undefined ? settings.lookbackMessages : 2).on('input', function () {
                settings.lookbackMessages = parseInt(/** @type {string} */($(this).val())) || 2;
                saveSettings();
            });
        }
        const historyCountInput = $('#rpg_tracker_history_count');
        if (historyCountInput.length) {
            historyCountInput.val(settings.trackerHistoryCount !== undefined ? settings.trackerHistoryCount : 1).on('input', function () {
                settings.trackerHistoryCount = parseInt(/** @type {string} */($(this).val())) || 1;
                saveSettings();
            });
        }
        const fullAuditMaxTokensInput = $('#rpg_tracker_full_audit_max_tokens');
        if (fullAuditMaxTokensInput.length) {
            fullAuditMaxTokensInput.val(settings.fullAuditMaxTokens !== undefined ? settings.fullAuditMaxTokens : 32000).on('input', function () {
                settings.fullAuditMaxTokens = parseInt(/** @type {string} */($(this).val())) || 32000;
                saveSettings();
            });
        }
        const stateRunEveryInput = $('#rpg_tracker_state_run_every');
        if (stateRunEveryInput.length) {
            stateRunEveryInput.val(settings.stateTrackerRunEvery !== undefined ? settings.stateTrackerRunEvery : 1).on('input', function () {
                settings.stateTrackerRunEvery = Math.max(1, parseInt(/** @type {string} */($(this).val())) || 1);
                saveSettings();
            });
        }
        const stateSwipeRollbackCb = $('#rpg_tracker_state_swipe_rollback');
        if (stateSwipeRollbackCb.length) {
            stateSwipeRollbackCb.prop('checked', settings.stateTrackerSwipeRollback !== false).on('change', function () {
                settings.stateTrackerSwipeRollback = $(this).prop('checked');
                saveSettings();
            });
        }



        // ── Lorebook Context UI ──
        async function refreshLorebookList() {
            const $container = $('#rpg_tracker_lorebook_list');
            $container.empty();
            const stCtx = SillyTavern.getContext();
            let worldNames = [];
            try {
                worldNames = stCtx.getWorldInfoNames?.() ?? [];

                // If empty, the in-memory world_names may not be populated yet.
                // Force a backend refresh and retry.
                if (!worldNames.length && stCtx.updateWorldInfoList) {
                    if (settings.debugMode) console.log('[RPG Tracker] world_names empty — forcing backend refresh…');
                    await stCtx.updateWorldInfoList();
                    worldNames = stCtx.getWorldInfoNames?.() ?? [];
                }

                // Final fallback: direct backend fetch (covers edge cases and older ST versions)
                if (!worldNames.length) {
                    if (settings.debugMode) console.log('[RPG Tracker] world_names still empty — falling back to direct API fetch…');
                    try {
                        const resp = await fetch('/api/settings/get', {
                            method: 'POST',
                            headers: stCtx.getRequestHeaders(),
                            body: JSON.stringify({}),
                        });
                        if (resp.ok) {
                            const data = await resp.json();
                            worldNames = data.world_names ?? [];
                        }
                    } catch (fetchErr) {
                        console.warn('[RPG Tracker] Direct world_names fetch failed:', fetchErr);
                    }
                }
            } catch (e) {
                console.warn('[RPG Tracker] getWorldInfoNames() failed:', e);
            }

            if (!worldNames || worldNames.length === 0) {
                $container.append('<i style="opacity:0.6;">No lorebooks found.</i>');
                return;
            }

            const currentFilter = settings.lorebookFilter || [];
            const sortedBooks = [...worldNames].sort();

            sortedBooks.forEach(bookName => {
                const isChecked = currentFilter.includes(bookName);
                const $item = $(`<label class="checkbox_label" style="font-size: 0.9em;">
                        <input type="checkbox" data-book="${bookName}" ${isChecked ? 'checked' : ''} />
                        <span>${bookName}</span>
                    </label>`);

                $item.find('input').on('change', function () {
                    const book = $(this).data('book');
                    if (!Array.isArray(settings.lorebookFilter)) settings.lorebookFilter = [];
                    if ($(this).prop('checked')) {
                        if (!settings.lorebookFilter.includes(book)) {
                            settings.lorebookFilter.push(book);
                        }
                    } else {
                        settings.lorebookFilter = settings.lorebookFilter.filter(b => b !== book);
                    }
                    saveSettings();
                });
                $container.append($item);
            });
        }

        $('#rpg_tracker_ctx_worldinfo').prop('checked', settings.ctxWorldInfo ?? false).on('change', async function () {
            settings.ctxWorldInfo = !!$(this).prop('checked');
            if (settings.ctxWorldInfo) await refreshLorebookList();
            $('#rpg_tracker_lorebook_filter_group').toggle(settings.ctxWorldInfo);
            saveSettings();
        }).trigger('change');

        $('#rpg_tracker_lorebook_list_refresh').on('click', async function () {
            await refreshLorebookList();
        });

        // Panel Layout Mode (Stacked vs Tab Mode)
        const layoutModeSeg = document.getElementById('rpg_tracker_layout_mode_seg');
        if (layoutModeSeg) {
            syncSegToggle(layoutModeSeg, settings.panelLayoutMode || 'stack');
            layoutModeSeg.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    settings.panelLayoutMode = btn.dataset.value;
                    saveSettings();
                    syncSegToggle(layoutModeSeg, settings.panelLayoutMode);
                    refreshRenderedView();
                });
            });
        }

        // Theme Select + Wizard
        const themeSelect = $('#rpg_tracker_theme_select');
        themeSelect.val(settings.trackerTheme || 'rt-theme-native');

        const wizardBlock = document.getElementById('rpg_tracker_theme_wizard_block');
        const showHideWizard = (theme) => {
            if (wizardBlock) wizardBlock.style.display = theme === 'rt-theme-custom' ? 'block' : 'none';
        };
        showHideWizard(settings.trackerTheme || 'rt-theme-native');

        // Theme Wizard buttons
        document.getElementById('rpg_tracker_theme_generate')?.addEventListener('click', () => {
            openThemeWizard(false);
        });
        document.getElementById('rpg_tracker_theme_iterate')?.addEventListener('click', () => {
            if (!settings.customTheme) {
                toastr['info']('No custom theme to iterate on. Generating a new one instead.', 'Theme Wizard');
                openThemeWizard(false);
            } else {
                openThemeWizard(true);
            }
        });

        // Restore saved custom theme on settings load
        if (settings.customTheme) applyCustomTheme(settings.customTheme);

        themeSelect.on('change', function () {
            const newTheme = String($(this).val());
            settings.trackerTheme = newTheme;
            saveSettings();
            showHideWizard(newTheme);
            applyTrackerThemeToDom(newTheme);
        });

        document.getElementById('rpg_tracker_theme_save')?.addEventListener('click', () => {
            if (!settings.customTheme) {
                toastr['warning']('No custom theme to save. Generate one first!', 'Theme Wizard');
                return;
            }
            const name = prompt('Enter a name for this theme:', 'My Custom Theme');
            if (name && name.trim()) {
                const trimmedName = name.trim();
                if (settings.savedThemes && settings.savedThemes[trimmedName]) {
                    if (!confirm(`A theme named "${trimmedName}" already exists. Overwrite?`)) return;
                }
                if (!settings.savedThemes) settings.savedThemes = {};
                settings.savedThemes[trimmedName] = JSON.parse(JSON.stringify(settings.customTheme));
                saveSettings();
                refreshSavedThemesList();
                toastr['success'](`Saved "${name}" to library.`, 'Theme Library');
            }
        });
        document.getElementById('rpg_tracker_theme_wizard_undo')?.addEventListener('click', () => {
            undoThemeChange(settings);
        });

        refreshSavedThemesList();

        const fontSizeInput = $('#rpg_tracker_font_size');
        const fontSizeVal = $('#rpg_tracker_font_size_val');
        fontSizeInput.val(settings.fontSize || 13);
        if (fontSizeVal.length) fontSizeVal.text((settings.fontSize || 13) + 'px');

        fontSizeInput.on('input', function () {
            const val = parseInt(String($(this).val()));
            if (isNaN(val) || val < 8 || val > 32) return;
            if (fontSizeVal.length) fontSizeVal.text(val + 'px');
            settings.fontSize = val;
            saveSettings();
            updateTrackerFontSize(val);
        });

        const agentFontSizeInput = $('#rpg_agent_font_size');
        const agentFontSizeVal = $('#rpg_agent_font_size_val');
        agentFontSizeInput.val(settings.agentFontSize || 13);
        if (agentFontSizeVal.length) agentFontSizeVal.text((settings.agentFontSize || 13) + 'px');

        agentFontSizeInput.on('input', function () {
            const val = parseInt(String($(this).val()));
            if (isNaN(val) || val < 8 || val > 32) return;
            if (agentFontSizeVal.length) agentFontSizeVal.text(val + 'px');
            settings.agentFontSize = val;
            saveSettings();
            updateAgentFontSize(val);
        });

        // Populate profiles using handleDropdown (fills real internal IDs, not names)
        if (!tryBindConnectionProfileDropdown('#rpg_tracker_connection_profile', settings.connectionProfileId, (id) => {
            settings.connectionProfileId = id;
            saveSettings();
        })) {
            // Fallback for older ST: /profile-list returns names only
            const profiles = await getConnectionProfiles();
            profileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
            profiles.forEach(p => {
                profileSelect.append($('<option></option>').val(p).text(p));
            });
            profileSelect.val(settings.connectionProfileId);
            profileSelect.on('change', function () {
                settings.connectionProfileId = $(this).val();
                saveSettings();
            });
        }

        // Populate presets
        const presetSelect = $('#rpg_tracker_completion_preset');
        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            presetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => {
                presetSelect.append($('<option></option>').val(p).text(p));
            });
            presetSelect.val(settings.completionPresetId || '');
        } else {
            presetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            if (settings.completionPresetId) {
                presetSelect.append($('<option></option>').val(settings.completionPresetId).text(settings.completionPresetId));
                presetSelect.val(settings.completionPresetId);
            }
        }
        presetSelect.on('change', function () {
            settings.completionPresetId = $(this).val();
            saveSettings();
        });

        // Initial order list refresh
        refreshOrderList();

        $('#rpg_tracker_add_custom_field').on('click', function () {
            const settings = getSettings();
            if (!settings.customFields) settings.customFields = [];

            let newTag = 'NEW_FIELD';
            let counter = 1;
            const isTagTaken = (tag) => BLOCK_ORDER.includes(tag) || settings.customFields.some(f => f.tag.toUpperCase() === tag);

            while (isTagTaken(counter === 1 ? newTag : `${newTag}_${counter}`)) {
                counter++;
            }
            if (counter > 1) newTag = `${newTag}_${counter}`;

            settings.customFields.push({
                tag: newTag, label: 'New Field', icon: '📝',
                prompt: '',
                template: EXAMPLES + '\n\n' + COLOR_EXAMPLES,
                enabled: true
            });
            clearDeletedCustomTagTombstones(newTag);
            refreshOrderList();
            saveSettings(true);
        });

        // ── AI Custom Field Creator ──
        $('#rpg_tracker_add_custom_field_ai').on('click', async function () {
            const { Popup, POPUP_TYPE } = SillyTavern.getContext();
            const settings = getSettings();
            if (!settings.customFields) settings.customFields = [];

            const inputContent = `
                    <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box;">
                        <div style="font-size:13px; opacity:0.9; font-weight:bold;">🪄 AI Custom Field Creator</div>
                        <div style="font-size:11px; opacity:0.7; line-height:1.4;">
                            Describe what you want to track in plain language. The AI will generate a field name, icon, prompt instruction, and rendering template.
                        </div>
                        <textarea id="rt_ai_field_desc" rows="4" class="text_pole"
                            style="font-size:12px; resize:vertical; width:100%;"
                            placeholder="Example: A corruption tracker that goes up when the player does evil acts. Show it as a bar out of 100 and list corruption effects as pills."></textarea>
                    </div>
                `;

            let description = '';
            setTimeout(() => {
                const textarea = document.getElementById('rt_ai_field_desc');
                if (textarea) {
                    textarea.addEventListener('input', () => { description = textarea.value.trim(); });
                }
            }, 100);

            const inputResult = await Popup.show.confirm('Describe Your Custom Field', inputContent, { okButton: 'Generate', cancelButton: 'Cancel' });
            if (!inputResult) return;

            if (!description) {
                toastr['warning']('Please describe what you want to track.', 'AI Field Creator');
                return;
            }

            const existingTags = BLOCK_ORDER.concat((settings.customFields || []).map(f => f.tag.toUpperCase()));

            let existingFieldsContext = "";
            BLOCK_ORDER.forEach(tag => {
                if (tag === 'QUESTS' && settings.syspromptModules?.quests === false) return;
                if (!settings.modules || settings.modules[tag] !== false) {
                    const modLower = tag === 'TIME' ? resolveTimePromptKey(settings) : tag.toLowerCase();
                    const promptContent = (settings.stockPrompts && settings.stockPrompts[modLower])
                        ? settings.stockPrompts[modLower]
                        : DEFAULT_STOCK_PROMPTS[modLower] || '';
                    existingFieldsContext += `[${tag}] (Stock Module)\nPrompt: ${promptContent}\n\n`;
                }
            });
            if (settings.customFields) {
                settings.customFields.forEach(f => {
                    if (!settings.modules || settings.modules[f.tag.toUpperCase()] !== false) {
                        existingFieldsContext += `[${f.tag}] (Custom Field: ${f.label})\nPrompt: ${f.prompt}\nTemplate: ${f.template}\n\n`;
                    }
                });
            }

            const aiPrompt = `You are a configuration generator for a game state tracker extension.

The user's current system prompt is provided below for reference. If the user's requested tracking field relates to an existing mechanic in this system prompt, base your instructions off that system. If it doesn't, proceed as usual:
<current_prompt>
${document.getElementById('main_prompt_quick_edit_textarea')?.value || settings.systemPromptTemplate || ''}
</current_prompt>

Here are ALL the user's currently enabled tracking fields (both stock and custom), including their exact instructions and formatting. Use these for inspiration on depth and style. Ensure your new field complements them without duplicating functionality. DO NOT use any of these existing Field IDs for your new field:
<existing_fields>
${existingFieldsContext.trim()}
</existing_fields>

The user wants to create a new custom tracking field. Their description:
"${description}"

Available rendering tags (MUST use at least one in the template). Tags can be placed inline (e.g., 'Health: ((BAR)) 50/100'). Pill tags optionally support parenthesis text for descriptions (e.g. 'Status: ((PILLS)) Sleeping (Unconscious)'). Any tag can use a named-color suffix (e.g. 'Status: ((PILLPINK)) Smitten' or 'Health: ((BARRED)) 50/100') or an inline override (e.g. 'Status: ((PILLS - #E5FFCC)) Sleeping'). Use custom colors only when the field benefits from them:
${RENDERING_TAGS_LIBRARY.map(t => '- ' + t).join('\n')}

Return ONLY a valid JSON object with these fields:
{
  "tag": "UPPERCASE_FIELD_ID",
  "label": "Human Readable Label",
  "icon": "single emoji",
  "prompt": "Instruction text telling the AI model what to track and exactly how to format it. MUST include a newline, then a literal 'FORMAT:' section, then a newline, then an 'EXAMPLE:' section.",
  "template": "Example output showing rendering markers. MUST use at least one ((MARKER)) tag. Show realistic example data."
}

RULES:
- 'tag' (the field ID) must be UPPERCASE, no spaces, use underscores
- 'tag' (the field ID) must NOT conflict with any of the field tags listed in <existing_fields>
- NEVER use asterisks (*) anywhere. Do not use them in the tag, prompt, template, or anywhere else. The * symbol is completely BANNED as it breaks rendering. Use ((HIGHLIGHT)) instead if you need emphasis.
- For comma-separated lists of pills (like ((PILLS)) or ((PILLRED))), place the tag ONLY at the very beginning of the list/line (e.g., 'Status: ((PILLS)) Sleeping, Poisoned'). NEVER repeat the tag on every item in the list (e.g., NEVER write '((PILLS)) Sleeping, ((PILLS)) Poisoned').
- You are ENCOURAGED to use any of the available rendering tags, even if they are used by other fields
- icon must be a single emoji
- prompt should start with 1-3 sentences of clear and specific instructions
- prompt MUST include a newline, then 'FORMAT:', then the required layout with rendering markers
- prompt MUST include a newline, then 'EXAMPLE:', then a realistic made up example of how it should look
- The AI during gameplay only sees 'prompt', it does NOT see 'template'
- template MUST use rendering tags — this is just the UI preview for the user. It should match the EXAMPLE you provided in the prompt.
- Return ONLY the JSON. No explanation, no markdown fences.`;

            toastr['info']('Generating custom field with AI...', 'AI Field Creator', { timeOut: 3000 });
            try {
                const result = await sendStateRequest(settings, 'You are a JSON configuration generator. Return ONLY valid JSON.', aiPrompt);
                if (!result) throw new Error('No response from AI');

                // Extract JSON from the response (handle markdown fences)
                let jsonStr = result.trim();
                const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (fenceMatch) jsonStr = fenceMatch[1].trim();

                const parsed = JSON.parse(jsonStr);
                if (!parsed.tag || !parsed.label || !parsed.icon || !parsed.prompt || !parsed.template) {
                    throw new Error('AI returned incomplete field config');
                }

                // Validate tag doesn't conflict
                const normalTag = parsed.tag.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                if (existingTags.includes(normalTag)) {
                    parsed.tag = normalTag + '_' + Date.now().toString(36).slice(-3).toUpperCase();
                } else {
                    parsed.tag = normalTag;
                }

                // Show preview for approval
                const previewContent = `
                        <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box; max-height:80vh;">
                            <div style="font-size:13px; font-weight:bold;">🪄 AI Generated Custom Field</div>
                            <div style="border: 1px solid rgba(255,255,255,0.15); border-radius:8px; padding:12px; background:rgba(255,255,255,0.03); overflow-y:auto;">
                                <div><b>Tag:</b> [${escapeHtml(parsed.tag)}]</div>
                                <div><b>Label:</b> ${escapeHtml(parsed.icon)} ${escapeHtml(parsed.label)}</div>
                                <div style="margin-top:6px;"><b>AI Prompt:</b></div>
                                <div style="font-size:11px; opacity:0.8; white-space:pre-wrap; padding:6px 8px; background:rgba(0,0,0,0.2); border-radius:4px; margin-top:2px;">${escapeHtml(parsed.prompt)}</div>
                                <div style="margin-top:6px;"><b>Example Template:</b></div>
                                <div style="font-size:11px; opacity:0.8; white-space:pre-wrap; padding:6px 8px; background:rgba(0,0,0,0.2); border-radius:4px; margin-top:2px; font-family:monospace;">${escapeHtml(parsed.template)}</div>
                                <div style="margin-top:12px; font-weight:bold; font-size:12px;">Live Preview:</div>
                                <div id="rt_ai_cfe_preview_view" class="rpg-tracker-render-view" style="margin-top:4px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; background:rgba(0,0,0,0.2); padding:4px;"></div>
                            </div>
                        </div>
                    `;

                setTimeout(() => {
                    const renderView = document.getElementById('rt_ai_cfe_preview_view');
                    if (!renderView) return;

                    const previewTag = parsed.tag;
                    const fakeMemo = `[${previewTag}]\n${parsed.template}\n[/${previewTag}]`;
                    const ghostField = {
                        tag: previewTag,
                        label: parsed.label,
                        icon: parsed.icon,
                        template: parsed.template,
                        prompt: '',
                        enabled: true
                    };
                    const savedCustomFields = settings.customFields;
                    settings.customFields = [...savedCustomFields, ghostField];
                    try {
                        // We use an empty object for pagination state since this is just a quick preview
                        renderView.innerHTML = renderMemoAsCards(fakeMemo, previewTag, {});
                        bindRenderedCardEvents(renderView, fakeMemo, true, null);
                    } finally {
                        settings.customFields = savedCustomFields;
                    }
                }, 150);

                const approved = await Popup.show.confirm('Accept Custom Field?', previewContent);
                if (!approved) {
                    toastr['info']('Custom field creation cancelled.', 'AI Field Creator');
                    return;
                }

                settings.customFields.push({
                    tag: parsed.tag,
                    label: parsed.label,
                    icon: parsed.icon,
                    prompt: parsed.prompt,
                    template: parsed.template,
                    enabled: true
                });
                clearDeletedCustomTagTombstones(parsed.tag);
                refreshOrderList();
                saveSettings(true);
                toastr['success'](`Custom field "${parsed.label}" created!`, 'AI Field Creator');
            } catch (err) {
                console.error('[RPG Tracker] AI Field Creator error:', err);
                toastr['error'](`Failed to create field: ${err.message}`, 'AI Field Creator');
            }
        });

        $('#rpg_tracker_export_all_modules').on('click', () => {
            const s = getSettings();
            if (!s.customFields || s.customFields.length === 0) {
                toastr['info']('No custom modules to export.', 'Multihog Framework');
                return;
            }
            exportModules(s.customFields);
        });

        $('#rpg_tracker_import_modules').on('click', async () => {
            const { Popup } = SillyTavern.getContext();
            let pastedValue = '';

            // Attach the file input directly to body so the OS file picker
            // doesn't steal focus away from the popup and trigger its "outside click" dismiss.
            const fileInput = /** @type {HTMLInputElement} */ (document.createElement('input'));
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
            document.body.appendChild(fileInput);

            const content = `
                    <div style="display:flex; flex-direction:column; gap:8px; width:100%; box-sizing:border-box;">
                        <p style="margin:0; font-size:12px; opacity:0.7;">
                            Paste the module export code (JSON) below or load it from a file.
                        </p>
                        <textarea id="rt_import_blob" rows="12" class="text_pole"
                            style="font-family:monospace; font-size:11px; resize:vertical; width:100%;"
                            placeholder='{"format": "multihog-custom-module", ...}'
                        ></textarea>
                        <button id="rt_import_file_btn" class="menu_button interactable" style="width:100%;">
                            <i class="fa-solid fa-file-upload"></i> Load from File
                        </button>
                    </div>
                `;

            setTimeout(() => {
                const fileBtn = document.getElementById('rt_import_file_btn');
                const textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_import_blob'));

                if (textarea) {
                    textarea.addEventListener('input', () => {
                        pastedValue = textarea.value;
                    });
                }

                if (fileBtn) {
                    fileBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        fileInput.click();
                    });
                }

                fileInput.addEventListener('change', () => {
                    const file = fileInput.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const text = String(ev.target?.result || '');
                        pastedValue = text;
                        if (textarea) textarea.value = text;
                    };
                    reader.readAsText(file);
                    fileInput.value = ''; // allow re-selecting same file
                });
            }, 100);

            const result = await Popup.show.confirm('📥 Import Custom Module(s)', content, { okButton: 'Import', cancelButton: 'Cancel' });
            document.body.removeChild(fileInput);

            if (result && pastedValue.trim()) {
                await importModulesFromJson(pastedValue);
            }
        });

        $('#rpg_tracker_delete_all_custom_modules').on('click', function () {
            const s = getSettings();
            if (!s.customFields || s.customFields.length === 0) return toastr['info']('No custom modules to delete.', 'RPG Tracker');

            if (confirm(`Delete ALL (${s.customFields.length}) custom modules?\n\nThis will also remove their data from the current tracker state. Stock modules (COMBAT, CHARACTER, etc.) will not be touched.\n\nProceed?`)) {
                const customTags = new Set(s.customFields.map(f => f.tag.toUpperCase()));
                recordDeletedCustomTags([...customTags]);

                // Clear fields
                s.customFields = [];

                // Clean block order
                if (s.blockOrder) {
                    s.blockOrder = s.blockOrder.filter(tag => !customTags.has(tag.toUpperCase()));
                }

                // Clean current memo
                const memoBlocks = parseMemoBlocks(s.currentMemo || '');
                let changed = false;
                for (const tag of customTags) {
                    if (memoBlocks[tag] !== undefined) {
                        delete memoBlocks[tag];
                        changed = true;
                    }
                }

                if (changed) {
                    s.currentMemo = Object.entries(memoBlocks)
                        .map(([k, v]) => `[${k}]\n${v}\n[/${k}]`)
                        .join('\n\n');
                    updateUIMemo(s.currentMemo);
                }

                saveSettings();
                refreshOrderList();
                syncMemoView();
                toastr['success']('All custom modules deleted.', 'RPG Tracker');
            }
        });

        $('#rt_btn_tag_library').on('click', async function () {
            const { Popup } = SillyTavern.getContext();
            const { tryRenderMarker } = await import('./renderer.js');

            const escapeHtml = (unsafe) => (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

            const panel = document.getElementById('rpg_tracker_memo_panel');
            const themeClass = panel ? Array.from(panel.classList).find(c => c.startsWith('rt-theme-')) || 'rt-theme-native' : 'rt-theme-native';

            let html = `<div class="rpg-tracker-panel ${themeClass}" style="display:flex; flex-direction:column; gap:8px; max-height:60vh; overflow-y:auto; padding-right:10px; position:relative; top:auto; right:auto; width:100%; height:auto; background:transparent; border:none; box-shadow:none; resize:none;">`;
            html += `<div style="font-size:0.85em; opacity:0.85; padding:6px 8px; border:1px solid rgba(255,221,136,0.3); border-radius:6px; background:rgba(255,221,136,0.06);">
                💡 Color any tag with a named-color suffix, e.g. <code>((PILLPINK))</code>, <code>((BARRED))</code>, or <code>((PROGRESSGOLDENROD))</code>. For an exact named or hex color, use <code>((TAG - COLOR))</code> (e.g. <code>((PILLS - rebeccapurple))</code> or <code>((PLS - #E5FFCC))</code>). Bar-type tags (<code>((BAR))</code>, <code>((XPBAR))</code>, <code>((PROGRESS))</code>) additionally support a two-color gradient: <code>((BAR - #E5FFCC #003300))</code>.
            </div>`;
            for (let i = 0; i < RENDERING_TAGS_LIBRARY.length; i++) {
                const item = RENDERING_TAGS_LIBRARY[i];
                // Pass a unique per-item line index so preview entries that share
                // a default label (e.g. no colon in the example text) don't all
                // resolve to the same barId and recolor together.
                const rendered = tryRenderMarker(item, 'TAGLIB', '', i) || `<i>(Failed to render)</i>`;
                html += `<div style="border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.2);">
                    <div style="font-family:monospace; font-size:11px; opacity:0.8; margin-bottom:6px; color:#ffdd88;">${escapeHtml(item)}</div>
                    <div>${rendered}</div>
                </div>`;
            }
            html += '</div>';

            await Popup.show.confirm('🎨 Rendering Tags Library', html, { okButton: 'Close', cancelButton: false });
        });

        $('#rpg_tracker_core_prompt').val(settings.systemPromptTemplate).on('input', function () {
            settings.systemPromptTemplate = $(this).val();
            saveSettings();
        });

        $('#rpg_tracker_user_prompt_suffix').val(settings.userPromptSuffix || '').on('input', function () {
            settings.userPromptSuffix = $(this).val();
            saveSettings();
        });

        $('#rpg_tracker_btn_reset_prompt').on('click', function () {
            if (!confirm('Reset the State Model prompt and user prompt suffix to the built-in defaults?')) return;
            // Re-read the default from the defaults object by temporarily clearing the stored value
            const { extensionSettings } = SillyTavern.getContext();
            delete extensionSettings[MODULE_NAME].systemPromptTemplate;
            delete extensionSettings[MODULE_NAME].userPromptSuffix;
            const freshSettings = getSettings(); // re-merges defaults
            $('#rpg_tracker_core_prompt').val(freshSettings.systemPromptTemplate);
            $('#rpg_tracker_user_prompt_suffix').val(freshSettings.userPromptSuffix);
            saveSettings();
            toastr['success']('Core prompt and user prompt suffix reset to defaults.', 'RPG Tracker');
        });

        $('#rpg_tracker_btn_update_sysprompt_general').on('click', async function () {
            const fileName = getSettings().diceFunctionTool ? 'sysprompt.txt' : 'sysprompt_legacy.txt';
            let content;
            try {
                const response = await fetch(`/scripts/extensions/third-party/${FOLDER_NAME}/${fileName}`);
                if (response.ok) {
                    content = await response.text();
                } else {
                    throw new Error(`Server returned ${response.status}`);
                }
            } catch (err) {
                console.warn(`[Multihog Framework] Could not fetch ${fileName}, using hardcoded fallback:`, err);
                content = RT_PROMPTS[fileName];
            }

            if (!content) {
                toastr['error'](`Could not load ${fileName}. Main prompt was NOT updated.`, 'RPG Tracker');
                return;
            }

            content = buildSysprompt(content);

            const mainTextarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('main_prompt_quick_edit_textarea'));
            if (mainTextarea) {
                mainTextarea.value = content;
                mainTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
                toastr['success'](`Main sysprompt updated (${getSettings().diceFunctionTool ? 'Normal' : 'Legacy'} mode)! ✅`, 'RPG Tracker');
            } else {
                await navigator.clipboard.writeText(content).catch(() => { });
                toastr['info']('Quick-edit textarea not found. Sysprompt copied to clipboard — paste it manually into your Main prompt.', 'RPG Tracker');
            }
        });

        $('#rpg_tracker_btn_reset_all_prompts').on('click', function () {
            if (!confirm('This will reset the Module Prompts, Active Modules, and Module Order to their factory defaults. Custom modules will be moved to the bottom of the list. Your Core Prompt will not be affected. Proceed?')) return;
            const { extensionSettings } = SillyTavern.getContext();
            delete extensionSettings[MODULE_NAME].stockPrompts;
            delete extensionSettings[MODULE_NAME].blockOrder;
            delete extensionSettings[MODULE_NAME].modules;
            refreshOrderList();
            saveSettings();
            toastr['success']('Stock modules, order, and prompts reset to factory defaults.', 'RPG Tracker');
        });

        $('#rpg_tracker_btn_edit_npc_sections').on('click', function () {
            openNpcSectionEditor();
        });

        $('#rpg_tracker_btn_edit_pc_sections').on('click', function () {
            openPcSectionEditor();
        });

        // ── Game Systems (Wizard / Manage / System Prompt Control Room) ──
        // Heavy logic lives in game-systems.js; these are thin bindings only.
        $('#rpg_tracker_btn_game_system_wizard').on('click', () => openGameSystemWizard());
        $('#rpg_tracker_btn_manage_game_systems').on('click', () => openManageGameSystems());
        $('#rpg_tracker_btn_control_room').on('click', () => openSystemPromptControlRoom());

        // ── Game Cartridges (save/load/export/import full configuration) ──
        // Heavy logic lives in game-cartridges.js; this is a thin binding only.
        $('#rpg_tracker_btn_manage_cartridges').on('click', () => openManageGameCartridges());

        $('#rpg_tracker_btn_upgrade_changed_prompts').on('click', function () {
            if (typeof _runPromptDefaultsDialog === 'function') {
                void _runPromptDefaultsDialog();
                return;
            }
            toastr['warning']('No pending prompt-default update dialog is loaded. Reload the page.', 'RPG Tracker');
        });

        $('#rpg_tracker_btn_reset_and_apply_sysprompt').on('click', async function () {
            if (!confirm('This will:\n\n1. Reset the Core State Model prompt to built-in default\n2. Reset all Stock Module prompts, Active Modules, and Module Order to factory defaults\n3. Reset all Lorebook Agent prompts and World Progression prompts to factory defaults\n4. Fetch the latest sysprompt.txt and write it directly into your Quick Prompt "Main" box\n5. Automatically re-enable any custom sysprompt sections that were already enabled\n\nYour custom modules will NOT be affected. Proceed?')) return;

            const { extensionSettings } = SillyTavern.getContext();

            // 1. Reset Core prompt and user prompt suffix
            delete extensionSettings[MODULE_NAME].systemPromptTemplate;
            delete extensionSettings[MODULE_NAME].userPromptSuffix;
            const freshSettings = getSettings();
            $('#rpg_tracker_core_prompt').val(freshSettings.systemPromptTemplate);
            $('#rpg_tracker_user_prompt_suffix').val(freshSettings.userPromptSuffix);

            // 2. Reset stock modules, order, active modules
            delete extensionSettings[MODULE_NAME].stockPrompts;
            delete extensionSettings[MODULE_NAME].blockOrder;
            delete extensionSettings[MODULE_NAME].modules;

            // 3. Reset Lorebook Agent prompts and World Progression prompts
            delete extensionSettings[MODULE_NAME].routerSystemPromptTemplate;
            delete extensionSettings[MODULE_NAME].routerModularPromptTemplate;
            delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
            delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;

            // Re-merge defaults
            const finalSettings = getSettings();

            // Update UI elements for Lorebook Agent prompts
            const $routerPrompt = $('#rpg_tracker_router_prompt');
            $routerPrompt.val(finalSettings.routerSystemPromptTemplate);
            if (typeof (/** @type {any} */ ($routerPrompt)).trigger === 'function') {
                (/** @type {any} */ ($routerPrompt)).trigger('autosize.resize');
            }

            const $routerModularPrompt = $('#rpg_tracker_router_modular_prompt');
            $routerModularPrompt.val(finalSettings.routerModularPromptTemplate);
            if (typeof (/** @type {any} */ ($routerModularPrompt)).trigger === 'function') {
                (/** @type {any} */ ($routerModularPrompt)).trigger('autosize.resize');
            }

            // Update UI elements for World Progression prompts
            const $wpPrompt = $('#rpg_world_progression_system_prompt');
            $wpPrompt.val(finalSettings.worldProgressionSystemPrompt);
            if (typeof (/** @type {any} */ ($wpPrompt)).trigger === 'function') {
                (/** @type {any} */ ($wpPrompt)).trigger('autosize.resize');
            }

            // If legacy mode is on, the prompt is applied at runtime by buildModulesInstructionText
            // (no explicit call needed)

            refreshOrderList();
            saveSettings();

            // 4. Fetch sysprompt and apply to ST Quick Prompt "Main"
            const fileName = getSettings().diceFunctionTool ? 'sysprompt.txt' : 'sysprompt_legacy.txt';
            let content;
            try {
                const response = await fetch(`/scripts/extensions/third-party/${FOLDER_NAME}/${fileName}`);
                if (response.ok) {
                    content = await response.text();
                    console.log(`[Multihog Framework] Loaded ${fileName} from live file for auto-apply.`);
                } else {
                    throw new Error(`Server returned ${response.status}`);
                }
            } catch (err) {
                console.warn(`[Multihog Framework] Could not fetch ${fileName}, using hardcoded fallback:`, err);
                content = RT_PROMPTS[fileName];
            }

            if (!content) {
                toastr['error']('Could not load sysprompt.txt. Reset completed but Main prompt was NOT updated.', 'RPG Tracker');
                return;
            }

            // buildSysprompt() already assembles the complete final prompt — base sections
            // plus every enabled custom/unlocked/wizard section, in Control Room order.
            content = buildSysprompt(content);

            const mainTextarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('main_prompt_quick_edit_textarea'));
            if (mainTextarea) {
                mainTextarea.value = content;
                // Fire blur to trigger ST's handleQuickEditSave listener
                mainTextarea.dispatchEvent(new Event('blur', { bubbles: true }));

                toastr['success']('All prompts reset & Main sysprompt applied! \u2705', 'RPG Tracker');
            } else {
                // Fallback: ST might not be in OpenAI mode, so the quick-edit textarea may not exist.
                // Copy to clipboard as a graceful fallback.
                const ta = document.createElement('textarea');
                ta.value = content;
                ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try {
                    document.execCommand('copy');
                    toastr['warning']('All prompts reset. Quick Prompt "Main" textarea not found. Sysprompt copied to clipboard — paste it manually and enable function calls in the completion preset!', 'RPG Tracker');
                } catch (e) {
                    toastr['warning']('All prompts reset. Quick Prompt "Main" textarea not found and clipboard copy failed. Use the SYSPROMPT button to copy manually.', 'RPG Tracker');
                } finally {
                    document.body.removeChild(ta);
                }
            }
        });


        // ── CYOA Clickable Choice Engine ──────────────────────────────────────────
        // Scans .mes_text blocks for <button> elements inside <choices> and makes
        // them send their text content as a user message when clicked.
        // Replicated from st-clickable-inputs approach — no external extension needed.

        function parseCyoaHexColor(hex, fallback = '#ffffff') {
            const s = String(hex || '').trim();
            return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
        }

        function cyoaHexToRgba(hex, alpha) {
            const h = parseCyoaHexColor(hex, '#ffffff');
            const r = parseInt(h.slice(1, 3), 16);
            const g = parseInt(h.slice(3, 5), 16);
            const b = parseInt(h.slice(5, 7), 16);
            return `rgba(${r},${g},${b},${alpha})`;
        }

        /** @param {Record<string, any>|undefined|null} cfg */
        function readCyoaStyleSettings(cfg) {
            const buttonHex = parseCyoaHexColor(cfg?.buttonColor, '#120a28');
            const buttonOpacity = cfg?.buttonOpacity ?? 0.9;
            const br = parseInt(buttonHex.slice(1, 3), 16);
            const bg = parseInt(buttonHex.slice(3, 5), 16);
            const bb = parseInt(buttonHex.slice(5, 7), 16);
            const mechHex = parseCyoaHexColor(cfg?.mechColor, '#ffc966');
            const mechAccentHex = parseCyoaHexColor(cfg?.mechAccentColor || cfg?.mechColor, '#ffb43c');
            const textColor = (cfg?.buttonTextColor && /^#[0-9a-f]{6}$/i.test(cfg.buttonTextColor))
                ? cfg.buttonTextColor
                : 'var(--SmartThemeBodyColor, #e8e8e8)';
            const borderColor = (cfg?.buttonBorderColor && /^#[0-9a-f]{6}$/i.test(cfg.buttonBorderColor))
                ? cyoaHexToRgba(cfg.buttonBorderColor, 0.55)
                : 'rgba(120, 80, 220, 0.4)';
            const borderHover = (cfg?.buttonBorderColor && /^#[0-9a-f]{6}$/i.test(cfg.buttonBorderColor))
                ? cyoaHexToRgba(cfg.buttonBorderColor, 0.75)
                : 'rgba(120, 80, 220, 0.7)';
            const choiceAccent = (cfg?.choiceAccentColor && /^#[0-9a-f]{6}$/i.test(cfg.choiceAccentColor))
                ? cyoaHexToRgba(cfg.choiceAccentColor, 0.45)
                : 'rgba(120, 80, 220, 0.35)';
            return {
                bg: `rgba(${br},${bg},${bb},${buttonOpacity})`,
                bgHv: `rgba(${Math.min(br + 40, 255)},${Math.min(bg + 20, 255)},${Math.min(bb + 60, 255)},${Math.min(buttonOpacity + 0.05, 1)})`,
                bgAc: `rgba(${Math.min(br + 60, 255)},${Math.min(bg + 30, 255)},${Math.min(bb + 80, 255)},${Math.min(buttonOpacity + 0.1, 1)})`,
                textColor,
                borderColor,
                borderHover,
                choiceAccent,
                mechColor: mechHex,
                mechBg: cyoaHexToRgba(mechHex, cfg?.mechBgOpacity ?? 0.14),
                dcColor: parseCyoaHexColor(cfg?.dcColor, '#ff9f6b'),
                modColor: parseCyoaHexColor(cfg?.modColor, '#9fd4ff'),
                tagColor: parseCyoaHexColor(cfg?.tagColor, '#c9b0ff'),
                mechAccent: cyoaHexToRgba(mechAccentHex, 0.45),
            };
        }

        function updateCyoaStyle() {
            const s = getSettings();
            if (!s.cyoaConfig) return;
            const st = readCyoaStyleSettings(s.cyoaConfig);
            const css = `
                .mes_text .rt-cyoa-choices,
                .mes_text choices {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 5px !important;
                    margin: 14px 0 4px !important;
                    padding: 0 0 0 8px !important;
                    border-left: 2px solid ${st.choiceAccent} !important;
                }
                .mes_text .rt-cyoa-choices > p,
                .mes_text .rt-cyoa-choices > div,
                .mes_text choices > p,
                .mes_text choices > div {
                    margin: 0 !important;
                    padding: 0 !important;
                    line-height: 0 !important;
                    font-size: 0 !important;
                }
                .mes_text .rt-cyoa-choices > br,
                .mes_text choices > br,
                .mes_text .rt-cyoa-choices > p > br,
                .mes_text choices > p > br {
                    display: none !important;
                }
                .mes_text p:has(> button:only-child) {
                    margin: 0 !important;
                    padding: 0 !important;
                    line-height: 0 !important;
                }
                .mes_text p:has(> button:nth-of-type(2)) {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 5px !important;
                    margin: 14px 0 4px !important;
                    padding: 0 0 0 8px !important;
                    border-left: 2px solid ${st.choiceAccent} !important;
                    line-height: 0 !important;
                    font-size: 0 !important;
                }
                .mes_text p:has(> button:nth-of-type(2)) > br {
                    display: none !important;
                }
                .mes_text p:has(> button:nth-of-type(2)) > button {
                    margin: 0 !important;
                    font-size: 0.9rem !important;
                    line-height: 1.4 !important;
                }
                .mes_text p:empty {
                    display: none !important;
                }
                /* rem (not em): wrappers use font-size:0 to kill gaps; em collapses text to nothing mid-stream */
                .mes_text button:not([class]),
                .mes_text button[data-cyoa-bound] {
                    display: block !important;
                    width: 100% !important;
                    text-align: left !important;
                    -webkit-appearance: none !important;
                    appearance: none !important;
                    background-color: ${st.bg} !important;
                    background-image: none !important;
                    border: 1px solid ${st.borderColor} !important;
                    border-radius: 5px !important;
                    color: ${st.textColor} !important;
                    font-size: 0.9rem !important;
                    padding: 6px 10px !important;
                    margin: 0 !important;
                    cursor: pointer !important;
                    transition: background-color 0.15s, border-color 0.15s, transform 0.1s !important;
                    line-height: 1.4 !important;
                    font-family: inherit !important;
                    box-shadow: none !important;
                    outline: none !important;
                    box-sizing: border-box !important;
                }
                .mes_text button:not([class]):empty,
                .mes_text button[data-cyoa-bound]:empty,
                .mes_text button.rt-cyoa-incomplete {
                    display: none !important;
                }
                .mes_text button:not([class]):hover,
                .mes_text button[data-cyoa-bound]:hover {
                    background-color: ${st.bgHv} !important;
                    border-color: ${st.borderHover} !important;
                    transform: translateX(2px) !important;
                }
                .mes_text button:not([class]):active,
                .mes_text button[data-cyoa-bound]:active {
                    background-color: ${st.bgAc} !important;
                    transform: translateX(1px) !important;
                }
                .mes_text button[data-cyoa-bound] .rt-cyoa-mech {
                    color: ${st.mechColor} !important;
                    background: ${st.mechBg} !important;
                    border-radius: 3px !important;
                    padding: 0 4px !important;
                    font-family: var(--rt-font-mono, ui-monospace, monospace) !important;
                    font-size: 0.92em !important;
                    white-space: nowrap !important;
                }
                .mes_text button[data-cyoa-bound] .rt-cyoa-dc {
                    color: ${st.dcColor} !important;
                    font-weight: 600 !important;
                }
                .mes_text button[data-cyoa-bound] .rt-cyoa-mod {
                    color: ${st.modColor} !important;
                }
                .mes_text button[data-cyoa-bound] .rt-cyoa-tag {
                    color: ${st.tagColor} !important;
                    font-weight: 600 !important;
                }
                .mes_text button[data-cyoa-bound]:has(.rt-cyoa-mech) {
                    border-left: 3px solid ${st.mechAccent} !important;
                }
            `;
            let style = document.getElementById('cyoa-dynamic-style');
            if (!style) {
                style = document.createElement('style');
                style.id = 'cyoa-dynamic-style';
                document.head.appendChild(style);
            }
            style.textContent = css;
        }

        function escapeCyoaHtml(s) {
            return String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        function isCyoaMechanicalBracket(inner) {
            return /\bDC\s*\d+|vs\s*AC|AC\s*\d+|\(\s*[+\-]?\d|GP\b|per\s+(short|long)\s+rest|untrained|timeskip|hour|\d+\s*\/\s*\d+/i.test(inner);
        }

        function formatCyoaMechanicalBracket(inner) {
            let body = escapeCyoaHtml(inner);
            body = body.replace(/\b(vs\s*AC\s*\d+)/gi, '<span class="rt-cyoa-dc">$1</span>');
            body = body.replace(/\b(DC\s*\d+)/gi, '<span class="rt-cyoa-dc">$1</span>');
            body = body.replace(/(\(\s*[+\-]?\d[^)]*\))/g, '<span class="rt-cyoa-mod">$1</span>');
            return body;
        }

        /** @param {HTMLButtonElement} btn */
        function decorateCyoaMechanicsInButton(btn) {
            if (btn.dataset.cyoaDecorated === 'true' && btn.querySelector('.rt-cyoa-mech, .rt-cyoa-tag')) {
                return;
            }
            if (btn.dataset.cyoaDecorated === 'true' && !btn.querySelector('.rt-cyoa-mech, .rt-cyoa-tag')) {
                delete btn.dataset.cyoaDecorated;
            }
            const raw = (btn.textContent || '').trim();
            btn.dataset.cyoaRaw = raw;
            if (!raw || !raw.includes('[')) return;

            const html = raw.replace(/\[([^\]]+)\]/g, (match, inner, offset) => {
                if (isCyoaMechanicalBracket(inner)) {
                    return `<span class="rt-cyoa-mech">[${formatCyoaMechanicalBracket(inner)}]</span>`;
                }
                if (offset < 24 && inner.length <= 40 && !/\bDC\b|vs\s*AC/i.test(inner)) {
                    return `<span class="rt-cyoa-tag">[${escapeCyoaHtml(inner)}]</span>`;
                }
                return `<span class="rt-cyoa-mech">[${formatCyoaMechanicalBracket(inner)}]</span>`;
            });
            if (html !== raw) {
                btn.innerHTML = html;
                btn.dataset.cyoaDecorated = 'true';
            }
        }

        /**
         * Chromium treats non-hyphenated tags like <choices> as HTMLUnknownElement and
         * often leaves huge block/inline gaps between nested <button>s (Firefox does not).
         * Normalize every choice group into a real <div class="rt-cyoa-choices"> with
         * buttons as direct children — that layout is consistent across engines.
         * @param {ParentNode} root
         */
        function createCyoaChoicesWrap() {
            const wrap = document.createElement('div');
            wrap.className = 'rt-cyoa-choices';
            return wrap;
        }

        /** @param {Element|null} el */
        function isCyoaChoicesWrap(el) {
            return !!(el && (
                el.tagName === 'CHOICES'
                || (el.tagName === 'DIV' && el.classList.contains('rt-cyoa-choices'))
            ));
        }

        /**
         * @param {HTMLElement} source
         * @param {HTMLButtonElement[]} buttons
         */
        function replaceWithFlatCyoaWrap(source, buttons) {
            const wrap = createCyoaChoicesWrap();
            source.parentNode?.insertBefore(wrap, source);
            buttons.forEach((btn) => wrap.appendChild(btn));
            if (source.isConnected) source.remove();
            return wrap;
        }

        /**
         * @param {ParentNode} root
         */
        function flattenCyoaChoiceBlocks(root) {
            // Some ST renderers/sanitizers show custom XML-like tags as literal
            // `&lt;choices&gt;` / `&lt;button&gt;` text. Restore only complete multi-choice
            // blocks, then continue through the normal DOM-button path below.
            if (root instanceof HTMLElement) {
                const restoredHtml = restoreEscapedCyoaChoiceMarkup(root.innerHTML);
                if (restoredHtml !== root.innerHTML) root.innerHTML = restoredHtml;
            }

            // 1) Convert any <choices>…</choices> into <div class="rt-cyoa-choices">.
            root.querySelectorAll('choices').forEach((choicesEl) => {
                const buttons = Array.from(choicesEl.querySelectorAll('button'));
                if (!buttons.length) {
                    choicesEl.remove();
                    return;
                }
                replaceWithFlatCyoaWrap(/** @type {HTMLElement} */ (choicesEl), buttons);
            });

            // 1b) ST often renders all choices in one <p> with <br> between buttons.
            root.querySelectorAll('p, div').forEach((host) => {
                if (host.closest('.rt-cyoa-choices, choices')) return;
                if (host.classList?.contains('rt-cyoa-choices')) return;
                const buttons = Array.from(host.querySelectorAll(':scope > button'));
                if (buttons.length < 2) return;
                const isChoiceBlock = Array.from(host.childNodes).every((n) => {
                    if (n.nodeType === Node.TEXT_NODE) return !String(n.textContent || '').trim();
                    if (n.nodeType !== Node.ELEMENT_NODE) return false;
                    const tag = /** @type {Element} */ (n).tagName;
                    return tag === 'BUTTON' || tag === 'BR';
                });
                if (!isChoiceBlock) return;
                replaceWithFlatCyoaWrap(/** @type {HTMLElement} */ (host), buttons);
            });

            // 1c) Re-flatten already-normalized wraps that got re-wrapped by ST re-render.
            root.querySelectorAll('div.rt-cyoa-choices').forEach((choicesEl) => {
                const buttons = Array.from(choicesEl.querySelectorAll('button'));
                if (!buttons.length) return;
                const alreadyFlat = buttons.every((btn) => btn.parentElement === choicesEl)
                    && Array.from(choicesEl.childNodes).every((n) =>
                        n.nodeType === Node.ELEMENT_NODE && /** @type {Element} */ (n).tagName === 'BUTTON');
                if (alreadyFlat) return;
                while (choicesEl.firstChild) choicesEl.removeChild(choicesEl.firstChild);
                buttons.forEach((btn) => choicesEl.appendChild(btn));
            });

            // 2) If ST stripped <choices>, gather consecutive <p><button> hosts into one wrap.
            const kids = Array.from(root.childNodes);
            /** @type {HTMLElement[]} */
            let run = [];
            const flush = () => {
                if (run.length < 2) { run = []; return; }
                /** @type {HTMLButtonElement[]} */
                const buttons = [];
                for (const el of run) {
                    if (el.tagName === 'BUTTON') buttons.push(/** @type {HTMLButtonElement} */ (el));
                    else buttons.push(.../** @type {NodeListOf<HTMLButtonElement>} */ (el.querySelectorAll('button')));
                }
                if (buttons.length < 2) { run = []; return; }
                if (buttons.every((b) => b.closest('.rt-cyoa-choices, choices'))) { run = []; return; }
                const wrap = createCyoaChoicesWrap();
                const first = run[0];
                first.parentNode?.insertBefore(wrap, first);
                buttons.forEach((btn) => wrap.appendChild(btn));
                for (const el of run) {
                    if (el.isConnected && el !== wrap && !wrap.contains(el)) {
                        if (!el.querySelector?.('button') && el.tagName !== 'BUTTON') el.remove();
                        else if (el.tagName === 'P' && !el.textContent?.trim()) el.remove();
                    }
                }
                run = [];
            };

            const isCyoaButtonHost = (/** @type {ChildNode} */ node) => {
                if (node.nodeType !== Node.ELEMENT_NODE) return false;
                const el = /** @type {HTMLElement} */ (node);
                if (isCyoaChoicesWrap(el)) return false;
                if (el.tagName === 'BUTTON') return true;
                if (el.tagName === 'P' || el.tagName === 'DIV') {
                    const buttons = el.querySelectorAll(':scope > button');
                    return buttons.length === 1 && el.childElementCount === 1;
                }
                return false;
            };
            const isGapJunk = (/** @type {ChildNode} */ node) => {
                if (node.nodeType === Node.TEXT_NODE) return !String(node.textContent || '').trim();
                if (node.nodeType !== Node.ELEMENT_NODE) return false;
                const el = /** @type {HTMLElement} */ (node);
                if (el.tagName === 'BR') return true;
                if ((el.tagName === 'P' || el.tagName === 'DIV') && !el.textContent?.trim() && !el.querySelector('button')) return true;
                return false;
            };

            for (const node of kids) {
                if (isCyoaButtonHost(node)) {
                    run.push(/** @type {HTMLElement} */ (node));
                    continue;
                }
                if (run.length && isGapJunk(node)) {
                    node.parentNode?.removeChild(node);
                    continue;
                }
                flush();
            }
            flush();
        }

        let _cyoaGenerating = false;

        /** Mark empty / still-streaming choice buttons so CSS can hide them. */
        function syncCyoaStreamingPlaceholders(root = document) {
            const scope = root === document || root === document.documentElement
                ? document.querySelectorAll('#chat .mes_text button')
                : root.querySelectorAll('button');
            scope.forEach((btn) => {
                if (!(btn instanceof HTMLButtonElement)) return;
                // Ignore unrelated buttons inside message chrome if any leak through
                if (btn.closest('.mes_block') && !btn.closest('.mes_text')) return;
                const text = (btn.textContent || '').trim();
                if (!text) btn.classList.add('rt-cyoa-incomplete');
                else btn.classList.remove('rt-cyoa-incomplete');
            });
        }

        function setCyoaGenerating(active) {
            _cyoaGenerating = !!active;
            document.documentElement.classList.toggle('rt-cyoa-streaming', _cyoaGenerating);
            if (_cyoaGenerating) syncCyoaStreamingPlaceholders();
        }

        function cyoaBindChoiceButtons({ allowFlatten = true } = {}) {
            const s = getSettings();
            if (!s.cyoaConfig?.useButtonTags) return;
            if (!s.syspromptModules?.CYOA_mode) return;
            document.querySelectorAll('#chat .mes_text').forEach(block => {
                // Flattening mid-stream fights ST's live HTML updates and leaves empty shells.
                if (allowFlatten && !_cyoaGenerating) flattenCyoaChoiceBlocks(block);
                syncCyoaStreamingPlaceholders(block);
                block.querySelectorAll('button').forEach(btn => {
                    const text = (btn.textContent || '').trim();
                    if (!text) return; // still streaming / empty shell
                    // Don't rewrite button HTML or bind clicks until the stream finishes —
                    // decorate() uses innerHTML and fights live streaming updates.
                    if (_cyoaGenerating) return;
                    decorateCyoaMechanicsInButton(btn);
                    if (btn.getAttribute('data-cyoa-bound') === 'true') return;

                    btn.setAttribute('data-cyoa-bound', 'true');

                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const clickText = (btn.dataset.cyoaRaw || btn.textContent || '').trim();
                        if (!clickText) return;
                        const textarea = document.getElementById('send_textarea');
                        const sendBtn  = document.getElementById('send_but');
                        if (!textarea || !sendBtn) return;
                        textarea.value = clickText;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        sendBtn.click();
                    });
                });
            });
        }

        function scheduleCyoaBind(delayMs = 0, opts = {}) {
            setTimeout(() => {
                updateCyoaStyle();
                cyoaBindChoiceButtons(opts);
            }, delayMs);
        }

        // The State Tracker's async GENERATION_ENDED handler is registered before
        // this UI listener. Expose the DOM-only finalizer so it can run before the
        // tracker starts its network pass, rather than making CYOA styling wait for it.
        function finalizeCyoaNarratorRender({ stopped = false } = {}) {
            setCyoaGenerating(false);
            scheduleCyoaBind(0);
            scheduleCyoaBind(250);
            if (!stopped) scheduleCyoaBind(800);
        }
        globalThis._rpgFinalizeCyoaNarratorRender = finalizeCyoaNarratorRender;

        if (event_types.GENERATION_STARTED) {
            eventSource.on(event_types.GENERATION_STARTED, (...args) => {
                // ST passes dryRun as the last arg — ignore prompt-build dry runs
                const dryRun = args.length ? args[args.length - 1] : false;
                if (dryRun === true) return;
                setCyoaGenerating(true);
            });
        }
        // Re-bind after every generation (ST may re-render HTML slightly later)
        eventSource.on(event_types.GENERATION_ENDED, () => {
            finalizeCyoaNarratorRender();
        });
        eventSource.on(event_types.GENERATION_STOPPED, () => {
            finalizeCyoaNarratorRender({ stopped: true });
        });
        // Also bind on chat load / message swipe
        eventSource.on(event_types.CHAT_CHANGED, () => scheduleCyoaBind(300));
        if (event_types.MESSAGE_SWIPED) eventSource.on(event_types.MESSAGE_SWIPED, () => scheduleCyoaBind(100));
        if (event_types.MESSAGE_EDITED) eventSource.on(event_types.MESSAGE_EDITED, () => scheduleCyoaBind(100));
        // During stream: refresh placeholder visibility only (no flatten)
        if (event_types.MESSAGE_RECEIVED) eventSource.on(event_types.MESSAGE_RECEIVED, () => scheduleCyoaBind(50));
        if (event_types.MESSAGE_UPDATED) eventSource.on(event_types.MESSAGE_UPDATED, () => scheduleCyoaBind(30));
        if (event_types.MORE_MESSAGES_LOADED) eventSource.on(event_types.MORE_MESSAGES_LOADED, () => scheduleCyoaBind(100));
        if (event_types.STREAM_TOKEN_RECEIVED) {
            let _cyoaStreamTimer = null;
            eventSource.on(event_types.STREAM_TOKEN_RECEIVED, () => {
                if (_cyoaStreamTimer) clearTimeout(_cyoaStreamTimer);
                _cyoaStreamTimer = setTimeout(() => syncCyoaStreamingPlaceholders(), 40);
            });
        }
        // ST re-renders .mes_text from stored HTML and can undo flatten; watch for br-separated buttons.
        let _cyoaMutTimer = null;
        const _cyoaChatRoot = document.getElementById('chat');
        if (_cyoaChatRoot) {
            new MutationObserver(() => {
                if (_cyoaGenerating) {
                    syncCyoaStreamingPlaceholders();
                    return;
                }
                if (_cyoaMutTimer) clearTimeout(_cyoaMutTimer);
                _cyoaMutTimer = setTimeout(() => {
                    if (document.querySelector('#chat .mes_text p:has(> button + br + button)')) {
                        scheduleCyoaBind(0);
                    }
                }, 100);
            }).observe(_cyoaChatRoot, { childList: true, subtree: true, characterData: true });
        }
        // Initial bind for existing chat history
        scheduleCyoaBind(500);
        scheduleCyoaBind(1500);

        // ── CYOA Settings Popup ───────────────────────────────────────────────────

        function escapeCyoaSlotAttribute(value) {
            return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function buildCyoaSlotInput(type, slot = {}) {
            if (type === 'custom') {
                const text = slot.text || [slot.left, slot.right].filter(Boolean).join(' ');
                return `<input type="text" class="text_pole cyoa-slot-custom-text" placeholder="Entire choice text…" value="${escapeCyoaSlotAttribute(text)}" style="width:100%;font-size:11px;height:24px;padding:2px 6px;box-sizing:border-box;" />`;
            }
            const placeholder = type === 'trait' ? 'Ability name (e.g. Illithid) — optional'
                : type === 'prefix' ? 'Label (e.g. [Attack] or [Timeskip])' : '';
            return `<input type="text" class="text_pole cyoa-slot-label" placeholder="${placeholder}" value="${escapeCyoaSlotAttribute(slot.label)}" style="width:100%;font-size:11px;height:24px;padding:2px 6px;box-sizing:border-box;" />`;
        }

        function buildCyoaSlotRow(slot, idx) {
            const slotType = slot.type === 'roll' ? 'narrative' : slot.type;
            const typeOpts = [
                ['narrative', '🌀 Narrative-Decided'],
                ['normal',    '💬 Normal'],
                ['trait',     '⚡ Trait/Ability'],
                ['prefix',    '🏷️ Prefix'],
                ['custom',    'User-defined'],
            ].map(([v, l]) => `<option value="${v}"${slotType === v ? ' selected' : ''}>${l}</option>`).join('');

            const hasInput = slotType === 'trait' || slotType === 'prefix' || slotType === 'custom';

            return `<div class="cyoa-slot-row" data-idx="${idx}" style="display:flex;align-items:center;gap:5px;margin-bottom:5px;">
                <span style="width:20px;text-align:right;font-size:11px;opacity:0.5;flex-shrink:0;">${idx + 1}.</span>
                <select class="text_pole cyoa-slot-type" style="width:145px;font-size:11px;height:24px;padding:2px 4px;flex-shrink:0;">${typeOpts}</select>
                <div class="cyoa-slot-input" style="flex:1;display:${hasInput ? 'block' : 'none'}">
                    ${buildCyoaSlotInput(slotType, slot)}
                </div>
                <button class="cyoa-slot-del" style="background:rgba(200,50,50,0.15);border:1px solid rgba(200,50,50,0.4);border-radius:4px;color:rgba(255,120,120,0.9);font-size:11px;padding:1px 7px;cursor:pointer;flex-shrink:0;" title="Remove slot">×</button>
            </div>`;
        }

        function readSlotsFromPopup(container) {
            return Array.from(container.querySelectorAll('.cyoa-slot-row')).map(row => {
                let type  = row.querySelector('.cyoa-slot-type').value;
                if (type === 'roll') type = 'narrative';
                if (type === 'custom') {
                    const text = row.querySelector('.cyoa-slot-custom-text')?.value?.trim() || '';
                    return { type, ...(text ? { text } : {}) };
                }
                const label = row.querySelector('.cyoa-slot-label')?.value?.trim() || '';
                return { type, ...(label ? { label } : {}) };
            });
        }

        function readConfigFromPopup(popupEl) {
            return {
                slots:        readSlotsFromPopup(popupEl),
                useEmojis:    !!popupEl.querySelector('#cyoa-use-emojis')?.checked,
                useXmlTag:    !!popupEl.querySelector('#cyoa-use-xml')?.checked,
                useButtonTags: !!popupEl.querySelector('#cyoa-use-buttons')?.checked,
            };
        }

        function regeneratePromptPreview(popupEl) {
            const ta = popupEl.querySelector('#cyoa-prompt-textarea');
            if (!ta) return;
            ta.value = buildCyoaPrompt(readConfigFromPopup(popupEl));
        }



        /** @param {Record<string, any>} cfg */
        function buildCyoaStylePreviewHtml(cfg) {
            const st = readCyoaStyleSettings(cfg);
            return `<button type="button" style="display:block;width:100%;text-align:left;padding:6px 10px;border-radius:5px;border:1px solid ${st.borderColor};background:${st.bg};color:${st.textColor};font-size:12px;line-height:1.4;cursor:default;">
                3. Slip along the hull's shadows — <span style="color:${st.mechColor};background:${st.mechBg};border-radius:3px;padding:0 4px;font-family:ui-monospace,monospace;">[Stealth (<span style="color:${st.modColor};">(+6)</span> <span style="color:${st.dcColor};">DC 14</span>)]</span>
            </button>
            <div style="margin-top:5px;font-size:11px;opacity:0.75;">1. <span style="color:${st.tagColor};font-weight:600;">[Attack]</span> Swing the sword</div>`;
        }

        /** @param {ParentNode} dlg */
        function readCyoaStyleFromDialog(dlg) {
            const useThemeText = !!dlg.querySelector('#cyoa-text-theme')?.checked;
            const borderCustom = !!dlg.querySelector('#cyoa-border-custom')?.checked;
            const accentCustom = !!dlg.querySelector('#cyoa-accent-custom')?.checked;
            const mechAccentCustom = !!dlg.querySelector('#cyoa-mech-accent-custom')?.checked;
            return {
                buttonColor: dlg.querySelector('#cyoa-btn-color')?.value || '#120a28',
                buttonOpacity: (parseInt(dlg.querySelector('#cyoa-btn-opacity')?.value ?? '90', 10) / 100),
                buttonTextColor: useThemeText ? '' : (dlg.querySelector('#cyoa-text-color')?.value || ''),
                buttonBorderColor: borderCustom ? (dlg.querySelector('#cyoa-border-color')?.value || '') : '',
                choiceAccentColor: accentCustom ? (dlg.querySelector('#cyoa-accent-color')?.value || '') : '',
                mechColor: dlg.querySelector('#cyoa-mech-color')?.value || '#ffc966',
                mechBgOpacity: (parseInt(dlg.querySelector('#cyoa-mech-bg-opacity')?.value ?? '14', 10) / 100),
                dcColor: dlg.querySelector('#cyoa-dc-color')?.value || '#ff9f6b',
                modColor: dlg.querySelector('#cyoa-mod-color')?.value || '#9fd4ff',
                tagColor: dlg.querySelector('#cyoa-tag-color')?.value || '#c9b0ff',
                mechAccentColor: mechAccentCustom ? (dlg.querySelector('#cyoa-mech-accent-color')?.value || '') : '',
            };
        }

        /** @param {ParentNode} dlg */
        function refreshCyoaStylePreview(dlg) {
            const preview = dlg.querySelector('#cyoa-style-preview');
            if (!preview) return;
            preview.innerHTML = buildCyoaStylePreviewHtml(readCyoaStyleFromDialog(dlg));
            const hex = dlg.querySelector('#cyoa-btn-color')?.value || '#120a28';
            const pct = parseInt(dlg.querySelector('#cyoa-btn-opacity')?.value ?? '90', 10);
            const label = dlg.querySelector('#cyoa-btn-opacity-label');
            const swatch = dlg.querySelector('#cyoa-btn-preview');
            if (label) label.textContent = `${pct}%`;
            if (swatch) swatch.style.background = hex + Math.round(pct / 100 * 255).toString(16).padStart(2, '0');
        }

        const CYOA_PRESET_EXPORT_FORMAT = 'multihog-cyoa-preset';

        function escapeCyoaPresetHtml(value) {
            return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function refreshCyoaPresetSelect(dlg, selectedName = '') {
            const select = dlg?.querySelector('#cyoa-preset-select');
            if (!select) return;
            const presets = getSettings().cyoaConfig?.presets || {};
            select.innerHTML = '<option value="">-- Select Preset --</option>'
                + Object.keys(presets).map(name => `<option value="${escapeCyoaPresetHtml(name)}" ${name === selectedName ? 'selected' : ''}>${escapeCyoaPresetHtml(name)}</option>`).join('');
        }

        function showCyoaPresetExportPopup(presetName, visibleSlots = null) {
            const presets = getSettings().cyoaConfig?.presets || {};
            // Export the rows currently visible in the editor. This includes unsaved
            // Prefix/Trait text, rather than exporting an older stored snapshot.
            const slots = Array.isArray(visibleSlots) ? visibleSlots : presets[presetName];
            if (!presetName || !Array.isArray(slots)) {
                toastr.warning('Select a preset to export first.', 'CYOA');
                return;
            }
            const json = JSON.stringify({
                format: CYOA_PRESET_EXPORT_FORMAT,
                version: 1,
                exportedAt: new Date().toISOString(),
                name: presetName,
                slots,
            }, null, 2);
            const escapedJson = escapeCyoaPresetHtml(json);
            const { Popup } = SillyTavern.getContext();
            Popup.show.confirm('📤 Export CYOA Presets', `
                <div style="display:flex;flex-direction:column;gap:8px;min-width:360px;">
                    <div style="font-size:12px;opacity:0.75;">This exports the selected preset, “${escapeCyoaPresetHtml(presetName)}”. Share the JSON or import it on another installation.</div>
                    <textarea id="cyoa-preset-export-json" readonly rows="12" class="text_pole" style="font-family:monospace;font-size:11px;resize:vertical;width:100%;">${escapedJson}</textarea>
                    <div style="display:flex;gap:8px;">
                        <button id="cyoa-preset-export-copy" class="menu_button interactable" style="flex:1;"><i class="fa-solid fa-copy"></i> Copy to Clipboard</button>
                        <button id="cyoa-preset-export-download" class="menu_button interactable" style="flex:1;"><i class="fa-solid fa-file-download"></i> Export .json</button>
                    </div>
                </div>`, { okButton: 'Done', cancelButton: false });
            setTimeout(() => {
                document.getElementById('cyoa-preset-export-copy')?.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(json);
                        toastr.success(`CYOA preset "${presetName}" copied to clipboard!`, 'CYOA');
                    } catch (err) {
                        console.error('[RPG Tracker] CYOA preset clipboard copy failed:', err);
                        toastr.error('Could not copy automatically. Please select the text manually.', 'CYOA');
                    }
                });
                document.getElementById('cyoa-preset-export-download')?.addEventListener('click', () => {
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const safeName = presetName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'preset';
                    link.href = url;
                    link.download = `multihog_cyoa_preset_${safeName}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                });
            }, 50);
        }

        async function importCyoaPresets() {
            const { Popup } = SillyTavern.getContext();
            let value = '';
            const content = `
                <div style="display:flex;flex-direction:column;gap:8px;min-width:360px;">
                    <div style="font-size:12px;opacity:0.75;">Paste one exported CYOA preset. It will be added without overwriting an existing preset.</div>
                    <textarea id="cyoa-preset-import-json" rows="12" class="text_pole" style="font-family:monospace;font-size:11px;resize:vertical;width:100%;" placeholder='{"format":"multihog-cyoa-preset", ...}'></textarea>
                </div>`;
            setTimeout(() => {
                document.getElementById('cyoa-preset-import-json')?.addEventListener('input', (event) => { value = event.target.value; });
            }, 50);
            const result = await Popup.show.confirm('📥 Import CYOA Presets', content, { okButton: 'Import', cancelButton: 'Cancel' });
            if (!result || !value.trim()) return null;

            let parsed;
            try { parsed = JSON.parse(value); } catch (_) {
                toastr.error('Could not parse that as JSON.', 'CYOA');
                return null;
            }
            if (parsed?.format !== CYOA_PRESET_EXPORT_FORMAT || typeof parsed.name !== 'string' || !Array.isArray(parsed.slots)) {
                toastr.error('That is not a recognized CYOA preset export.', 'CYOA');
                return null;
            }

            const config = getSettings().cyoaConfig || (getSettings().cyoaConfig = {});
            if (!config.presets || typeof config.presets !== 'object') config.presets = {};
            const baseName = parsed.name.trim().slice(0, 100) || 'Imported Preset';
            let name = baseName;
            let suffix = 2;
            while (Object.prototype.hasOwnProperty.call(config.presets, name)) name = `${baseName} (${suffix++})`;
            // Keep the full slot object intact: label and custom text are part of
            // the preset's definition and must round-trip exactly through export/import.
            config.presets[name] = parsed.slots.map(slot => slot?.type === 'roll' ? { ...slot, type: 'narrative' } : { ...slot });
            saveSettings();
            toastr.success(`CYOA preset "${name}" imported!`, 'CYOA');
            return { name, slots: config.presets[name] };
        }

        function showCyoaSettingsPopup() {
            const s = getSettings();
            if (!s.cyoaConfig) s.cyoaConfig = {};
            const cfg = s.cyoaConfig;

            const slots = (Array.isArray(cfg.slots) && cfg.slots.length ? cfg.slots : DEFAULT_CYOA_SLOTS)
                .map((sl) => (sl?.type === 'roll' ? { ...sl, type: 'narrative' } : sl));
            const checked = (v) => v !== false ? 'checked' : '';
            const { Popup, POPUP_TYPE, POPUP_RESULT: PR } = SillyTavern.getContext();

            const initialPrompt = (cfg.useCustomPrompt && cfg.customPromptText?.trim())
                ? cfg.customPromptText.trim()
                : buildCyoaPrompt(cfg);

            const currentSlotsStr = JSON.stringify(slots);
            const presetMatches = Object.entries(cfg.presets || {}).find(([k, v]) => JSON.stringify(v) === currentSlotsStr);
            const activePreset = presetMatches ? presetMatches[0] : '';

            const html = `
            <div style="font-family:inherit;max-width:560px;min-width:380px;max-height:80vh;overflow-y:auto;overflow-x:hidden;padding-right:4px;box-sizing:border-box;">
                <div style="font-size:15px;font-weight:bold;margin-bottom:10px;color:var(--SmartThemeBodyColor, #eee);">⚙️ CYOA Mode Settings</div>
                <div style="margin-bottom:14px;padding:8px 10px;border-radius:6px;background:rgba(120,80,220,0.12);border:1px solid rgba(120,80,220,0.35);font-size:11.5px;line-height:1.45;color:var(--SmartThemeBodyColor,#eee);">
                    <div style="font-weight:600;margin-bottom:4px;">Recommended: Pre-Seeded RNG (RNG Queue)</div>
                    <div style="opacity:0.9;">In Narrator Configuration, prefer <b>Pre-Seeded RNG</b> / the RNG Queue for CYOA mode. <b>RollTheDice</b> tool calls mostly add cost and latency here — choice DCs are already pre-committed in the buttons, so there is no sycophancy risk to solve with live tool rolls.</div>
                </div>

                <div style="font-size:11px;font-weight:bold;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Presets</div>
                <div style="display:flex;gap:5px;margin-bottom:12px;align-items:center;">
                    <button id="cyoa-reset-slots" style="background:rgba(200,150,50,0.15);border:1px solid rgba(200,150,50,0.4);border-radius:4px;color:var(--SmartThemeBodyColor,#eee);padding:2px 8px;cursor:pointer;font-size:11px;" title="Reset all slots to default configuration">↺</button>
                    <select id="cyoa-preset-select" class="text_pole" style="flex:1;font-size:11px;height:24px;">
                        <option value="">-- Select Preset --</option>
                        ${Object.keys(cfg.presets || {}).map(k => `<option value="${k}" ${k === activePreset ? 'selected' : ''}>${k}</option>`).join('')}
                    </select>
                    <button id="cyoa-preset-save" style="background:rgba(120,80,220,0.15);border:1px solid rgba(120,80,220,0.4);border-radius:4px;color:var(--SmartThemeBodyColor,#eee);padding:2px 8px;cursor:pointer;font-size:11px;" title="Save over the selected preset">💾 Save</button>
                    <button id="cyoa-preset-save-as" style="background:rgba(120,80,220,0.15);border:1px solid rgba(120,80,220,0.4);border-radius:4px;color:var(--SmartThemeBodyColor,#eee);padding:2px 8px;cursor:pointer;font-size:11px;" title="Save current slots as a new preset">Save As…</button>
                    <button id="cyoa-preset-export" style="background:rgba(70,150,220,0.15);border:1px solid rgba(70,150,220,0.4);border-radius:4px;color:var(--SmartThemeBodyColor,#eee);padding:2px 8px;cursor:pointer;font-size:11px;" title="Export selected CYOA preset">📤</button>
                    <button id="cyoa-preset-import" style="background:rgba(70,150,220,0.15);border:1px solid rgba(70,150,220,0.4);border-radius:4px;color:var(--SmartThemeBodyColor,#eee);padding:2px 8px;cursor:pointer;font-size:11px;" title="Import one CYOA preset">📥</button>
                    <button id="cyoa-preset-del" style="background:rgba(200,50,50,0.15);border:1px solid rgba(200,50,50,0.4);border-radius:4px;color:rgba(255,120,120,0.9);padding:2px 8px;cursor:pointer;font-size:11px;" title="Delete selected preset">🗑️ Del</button>
                </div>

                <div style="font-size:11px;font-weight:bold;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Choice Slots</div>
                <div id="cyoa-slot-list" style="max-height:230px;overflow-y:auto;padding-right:4px;">
                    ${slots.map((sl, i) => buildCyoaSlotRow(sl, i)).join('')}
                </div>
                <button id="cyoa-add-slot" style="margin-top:6px;width:100%;background:rgba(120,80,220,0.15);border:1px dashed rgba(120,80,220,0.5);border-radius:5px;color:var(--SmartThemeBodyColor,#eee);padding:4px 0;cursor:pointer;font-size:12px;">+ Add Choice</button>

                <div style="margin-top:14px;font-size:11px;font-weight:bold;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Format Options</div>
                <div style="display:flex;flex-direction:column;gap:5px;padding-left:4px;">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;">
                        <input type="checkbox" id="cyoa-use-emojis" ${checked(cfg.useEmojis)} /> Use fitting emojis
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;">
                        <input type="checkbox" id="cyoa-use-xml" ${checked(cfg.useXmlTag)} /> <span>Wrap in &lt;choices&gt; XML tag <span title="Allows you to apply custom CSS styling to change how your choices block looks if you prefer" class="fa-solid fa-circle-question" style="opacity:0.5;cursor:help;margin-left:4px;"></span></span>
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;">
                        <input type="checkbox" id="cyoa-use-buttons" ${checked(cfg.useButtonTags)} /> <span>Clickable Choices <span title="Click choices to automatically send them using &lt;button&gt; functions" class="fa-solid fa-circle-question" style="opacity:0.5;cursor:help;margin-left:4px;"></span></span>
                    </label>
                </div>

                <div style="margin-top:14px;font-size:11px;font-weight:bold;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Button Appearance</div>
                <div style="display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:6px;background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);">
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap;">
                        <span style="min-width:92px;opacity:0.85;">Background</span>
                        <input type="color" id="cyoa-btn-color" value="${cfg.buttonColor || '#120a28'}" style="width:32px;height:22px;padding:1px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:none;cursor:pointer;" />
                        <input type="range" id="cyoa-btn-opacity" min="0" max="100" value="${Math.round((cfg.buttonOpacity ?? 0.9) * 100)}" style="flex:1;min-width:70px;max-width:110px;accent-color:rgba(120,80,220,0.8);" />
                        <span id="cyoa-btn-opacity-label" style="font-size:10px;opacity:0.6;min-width:28px;">${Math.round((cfg.buttonOpacity ?? 0.9) * 100)}%</span>
                        <span id="cyoa-btn-preview" style="display:inline-block;width:24px;height:18px;border-radius:3px;border:1px solid rgba(255,255,255,0.25);background:${cfg.buttonColor || '#120a28'};"></span>
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap;">
                        <span style="min-width:92px;opacity:0.85;">Text colour</span>
                        <input type="color" id="cyoa-text-color" value="${cfg.buttonTextColor || '#e8e8e8'}" style="width:32px;height:22px;padding:1px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:none;cursor:pointer;" ${cfg.buttonTextColor ? '' : 'disabled'} />
                        <label style="display:flex;align-items:center;gap:4px;font-size:11px;opacity:0.8;cursor:pointer;"><input type="checkbox" id="cyoa-text-theme" ${cfg.buttonTextColor ? '' : 'checked'} /> Theme default</label>
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap;">
                        <span style="min-width:92px;opacity:0.85;">Border</span>
                        <input type="checkbox" id="cyoa-border-custom" ${cfg.buttonBorderColor ? 'checked' : ''} />
                        <input type="color" id="cyoa-border-color" value="${cfg.buttonBorderColor || '#7850dc'}" style="width:32px;height:22px;padding:1px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:none;cursor:pointer;" ${cfg.buttonBorderColor ? '' : 'disabled'} />
                        <span style="font-size:10px;opacity:0.55;">Custom border colour</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap;">
                        <span style="min-width:92px;opacity:0.85;">Choice stripe</span>
                        <input type="checkbox" id="cyoa-accent-custom" ${cfg.choiceAccentColor ? 'checked' : ''} />
                        <input type="color" id="cyoa-accent-color" value="${cfg.choiceAccentColor || '#7850dc'}" style="width:32px;height:22px;padding:1px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:none;cursor:pointer;" ${cfg.choiceAccentColor ? '' : 'disabled'} />
                        <span style="font-size:10px;opacity:0.55;">Left accent on choice block</span>
                    </label>
                </div>

                <div style="margin-top:14px;font-size:11px;font-weight:bold;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Bracket Highlights</div>
                <div style="display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:6px;background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);">
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;"><span style="min-width:92px;opacity:0.85;">Mechanics</span><input type="color" id="cyoa-mech-color" value="${cfg.mechColor || '#ffc966'}" style="width:32px;height:22px;padding:1px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:none;cursor:pointer;" /></label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;"><span style="min-width:92px;opacity:0.85;">Mech background</span><input type="range" id="cyoa-mech-bg-opacity" min="0" max="100" value="${Math.round((cfg.mechBgOpacity ?? 0.14) * 100)}" style="flex:1;max-width:120px;accent-color:rgba(255,180,60,0.85);" /><span id="cyoa-mech-bg-opacity-label" style="font-size:10px;opacity:0.6;min-width:28px;">${Math.round((cfg.mechBgOpacity ?? 0.14) * 100)}%</span></label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;"><span style="min-width:92px;opacity:0.85;">DC / vs AC</span><input type="color" id="cyoa-dc-color" value="${cfg.dcColor || '#ff9f6b'}" style="width:32px;height:22px;padding:1px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:none;cursor:pointer;" /></label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;"><span style="min-width:92px;opacity:0.85;">Modifiers</span><input type="color" id="cyoa-mod-color" value="${cfg.modColor || '#9fd4ff'}" style="width:32px;height:22px;padding:1px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:none;cursor:pointer;" /></label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;"><span style="min-width:92px;opacity:0.85;">Prefix / trait</span><input type="color" id="cyoa-tag-color" value="${cfg.tagColor || '#c9b0ff'}" style="width:32px;height:22px;padding:1px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:none;cursor:pointer;" /></label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap;"><span style="min-width:92px;opacity:0.85;">Roll accent</span><input type="checkbox" id="cyoa-mech-accent-custom" ${cfg.mechAccentColor ? 'checked' : ''} /><input type="color" id="cyoa-mech-accent-color" value="${cfg.mechAccentColor || cfg.mechColor || '#ffb43c'}" style="width:32px;height:22px;padding:1px 2px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:none;cursor:pointer;" ${cfg.mechAccentColor ? '' : 'disabled'} /><span style="font-size:10px;opacity:0.55;">Left stripe on roll choices</span></label>
                    <div style="display:flex;justify-content:flex-end;margin-top:2px;"><button type="button" id="cyoa-colors-reset" style="font-size:10px;background:none;border:1px solid rgba(255,255,255,0.18);border-radius:4px;color:inherit;padding:2px 8px;cursor:pointer;opacity:0.75;">Reset colours to default</button></div>
                </div>

                <div style="margin-top:10px;">
                    <div style="font-size:10px;opacity:0.55;margin-bottom:4px;">Live preview</div>
                    <div id="cyoa-style-preview"></div>
                </div>

                <div style="margin-top:14px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                        <span style="font-size:11px;font-weight:bold;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;">CYOA Prompt</span>
                        <button id="cyoa-reset-prompt" style="font-size:11px;background:none;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:inherit;padding:2px 10px;cursor:pointer;opacity:0.7;" title="Regenerate from slots above">↺ Regenerate</button>
                    </div>
                    <div style="font-size:10px;opacity:0.5;margin-bottom:5px;">Live preview — edits are saved on Apply. Changing slots/format auto-regenerates.</div>
                    <textarea id="cyoa-prompt-textarea" class="text_pole" rows="10" style="width:100%;font-size:11px;font-family:monospace;resize:vertical;background:rgba(0,0,0,0.3);box-sizing:border-box;">${initialPrompt}</textarea>
                </div>
            </div>`;

            const popup = new Popup(html, POPUP_TYPE.CONFIRM, '', { okButton: 'Apply', cancelButton: 'Cancel' });

            // popup.dlg is the actual <dialog> element — available immediately after construction,
            // persists on the object even after ST removes the element from the document.
            const dlg = popup.dlg;
            refreshCyoaStylePreview(dlg);

            // Wire up all interactivity directly on dlg — no requestAnimationFrame needed
            if (dlg) {
                dlg.addEventListener('change', (e) => {
                    if (e.target.classList.contains('cyoa-slot-type')) {
                        const row = e.target.closest('.cyoa-slot-row');
                        if (!row) return;
                        const t = e.target.value;
                        const hasInput = t === 'trait' || t === 'prefix' || t === 'custom';
                        const inputDiv = row.querySelector('.cyoa-slot-input');
                        inputDiv.style.display = hasInput ? 'block' : 'none';
                        if (hasInput) inputDiv.innerHTML = buildCyoaSlotInput(t);
                        regeneratePromptPreview(dlg);
                    }
                    if (e.target.id === 'cyoa-text-theme') {
                        const inp = dlg.querySelector('#cyoa-text-color');
                        if (inp) inp.disabled = e.target.checked;
                        refreshCyoaStylePreview(dlg);
                    }
                    if (e.target.id === 'cyoa-border-custom') {
                        const inp = dlg.querySelector('#cyoa-border-color');
                        if (inp) inp.disabled = !e.target.checked;
                        refreshCyoaStylePreview(dlg);
                    }
                    if (e.target.id === 'cyoa-accent-custom') {
                        const inp = dlg.querySelector('#cyoa-accent-color');
                        if (inp) inp.disabled = !e.target.checked;
                        refreshCyoaStylePreview(dlg);
                    }
                    if (e.target.id === 'cyoa-mech-accent-custom') {
                        const inp = dlg.querySelector('#cyoa-mech-accent-color');
                        if (inp) inp.disabled = !e.target.checked;
                        refreshCyoaStylePreview(dlg);
                    }
                    if (e.target.matches('#cyoa-use-emojis, #cyoa-use-xml, #cyoa-use-buttons')) {
                        regeneratePromptPreview(dlg);
                    }
                    if (e.target.id === 'cyoa-preset-select') {
                        const name = e.target.value;
                        if (!name) return;
                        const freshS = getSettings();
                        const pSlots = freshS.cyoaConfig.presets?.[name];
                        if (!pSlots) return;
                        const list = dlg.querySelector('#cyoa-slot-list');
                        list.innerHTML = pSlots.map((sl, i) => buildCyoaSlotRow(sl, i)).join('');
                        regeneratePromptPreview(dlg);
                    }
                });

                dlg.addEventListener('input', (e) => {
                    if (e.target.classList.contains('cyoa-slot-label')
                        || e.target.classList.contains('cyoa-slot-custom-text')) {
                        regeneratePromptPreview(dlg);
                    }
                    // Live colour preview
                    const styleInputIds = new Set([
                        'cyoa-btn-color', 'cyoa-btn-opacity', 'cyoa-text-color', 'cyoa-border-color',
                        'cyoa-accent-color', 'cyoa-mech-color', 'cyoa-mech-bg-opacity', 'cyoa-dc-color',
                        'cyoa-mod-color', 'cyoa-tag-color', 'cyoa-mech-accent-color',
                    ]);
                    if (styleInputIds.has(e.target.id)) {
                        if (e.target.id === 'cyoa-mech-bg-opacity') {
                            const lbl = dlg.querySelector('#cyoa-mech-bg-opacity-label');
                            if (lbl) lbl.textContent = `${e.target.value}%`;
                        }
                        refreshCyoaStylePreview(dlg);
                    }
                });

                dlg.addEventListener('click', (e) => {
                    if (e.target.id === 'cyoa-colors-reset') {
                        const setVal = (sel, val) => { const el = dlg.querySelector(sel); if (el) el.value = val; };
                        const setChk = (sel, val) => { const el = dlg.querySelector(sel); if (el) el.checked = val; };
                        setVal('#cyoa-text-color', '#e8e8e8');
                        setChk('#cyoa-text-theme', true);
                        setChk('#cyoa-border-custom', false);
                        setVal('#cyoa-border-color', '#7850dc');
                        setChk('#cyoa-accent-custom', false);
                        setVal('#cyoa-accent-color', '#7850dc');
                        setVal('#cyoa-mech-color', '#ffc966');
                        setVal('#cyoa-mech-bg-opacity', '14');
                        setVal('#cyoa-dc-color', '#ff9f6b');
                        setVal('#cyoa-mod-color', '#9fd4ff');
                        setVal('#cyoa-tag-color', '#c9b0ff');
                        setChk('#cyoa-mech-accent-custom', false);
                        setVal('#cyoa-mech-accent-color', '#ffb43c');
                        dlg.querySelector('#cyoa-text-color').disabled = true;
                        dlg.querySelector('#cyoa-border-color').disabled = true;
                        dlg.querySelector('#cyoa-accent-color').disabled = true;
                        dlg.querySelector('#cyoa-mech-accent-color').disabled = true;
                        refreshCyoaStylePreview(dlg);
                        return;
                    }
                    if (e.target.classList.contains('cyoa-slot-del')) {
                        const list = dlg.querySelector('#cyoa-slot-list');
                        if (list.querySelectorAll('.cyoa-slot-row').length <= 1) return;
                        e.target.closest('.cyoa-slot-row').remove();
                        list.querySelectorAll('.cyoa-slot-row').forEach((r, i) => {
                            r.dataset.idx = i;
                            r.querySelector('span').textContent = `${i + 1}.`;
                        });
                        regeneratePromptPreview(dlg);
                    }
                    if (e.target.id === 'cyoa-add-slot') {
                        const list = dlg.querySelector('#cyoa-slot-list');
                        list.insertAdjacentHTML('beforeend', buildCyoaSlotRow({ type: 'narrative' }, list.querySelectorAll('.cyoa-slot-row').length));
                        regeneratePromptPreview(dlg);
                    }
                    if (e.target.id === 'cyoa-reset-slots') {
                        if (!confirm('Reset all choice slots to the default configuration?')) return;
                        const list = dlg.querySelector('#cyoa-slot-list');
                        list.innerHTML = DEFAULT_CYOA_SLOTS.map((sl, i) => buildCyoaSlotRow(sl, i)).join('');
                        regeneratePromptPreview(dlg);
                        const sel = dlg.querySelector('#cyoa-preset-select');
                        if (sel) sel.value = '';
                    }
                    if (e.target.id === 'cyoa-reset-prompt') {
                        regeneratePromptPreview(dlg);
                    }
                    if (e.target.id === 'cyoa-preset-save') {
                        const name = dlg.querySelector('#cyoa-preset-select')?.value;
                        if (!name) {
                            toastr.warning('Select a preset to save, or use Save As… to create one.', 'CYOA');
                            return;
                        }
                        const freshS = getSettings();
                        if (!freshS.cyoaConfig.presets) freshS.cyoaConfig.presets = {};
                        freshS.cyoaConfig.presets[name] = readSlotsFromPopup(dlg);
                        saveSettings();
                        toastr.success(`Preset "${name}" updated!`, 'CYOA');
                        refreshCyoaPresetSelect(dlg, name);
                    }
                    if (e.target.id === 'cyoa-preset-save-as') {
                        const name = prompt('Enter a name for this preset:')?.trim();
                        if (!name) return;
                        const freshS = getSettings();
                        if (!freshS.cyoaConfig.presets) freshS.cyoaConfig.presets = {};
                        if (freshS.cyoaConfig.presets[name] && !confirm(`Overwrite preset "${name}"?`)) return;
                        freshS.cyoaConfig.presets[name] = readSlotsFromPopup(dlg);
                        saveSettings();
                        toastr.success(`Preset "${name}" saved!`, 'CYOA');
                        refreshCyoaPresetSelect(dlg, name);
                    }
                    if (e.target.id === 'cyoa-preset-export') {
                        showCyoaPresetExportPopup(
                            dlg.querySelector('#cyoa-preset-select')?.value,
                            readSlotsFromPopup(dlg),
                        );
                    }
                    if (e.target.id === 'cyoa-preset-import') {
                        void importCyoaPresets().then((imported) => {
                            if (!imported) return;
                            refreshCyoaPresetSelect(dlg, imported.name);
                            const list = dlg.querySelector('#cyoa-slot-list');
                            if (list) list.innerHTML = imported.slots.map((slot, index) => buildCyoaSlotRow(slot, index)).join('');
                            regeneratePromptPreview(dlg);
                        });
                    }
                    if (e.target.id === 'cyoa-preset-del') {
                        const sel = dlg.querySelector('#cyoa-preset-select');
                        const name = sel?.value;
                        if (!name) return;
                        if (!confirm(`Delete preset "${name}"?`)) return;
                        const freshS = getSettings();
                        if (freshS.cyoaConfig.presets) {
                            delete freshS.cyoaConfig.presets[name];
                            saveSettings();
                            toastr.success(`Preset "${name}" deleted!`, 'CYOA');
                            sel.innerHTML = '<option value="">-- Select Preset --</option>' + Object.keys(freshS.cyoaConfig.presets).map(k => `<option value="${k}">${k}</option>`).join('');
                        }
                    }
                });
            }

            popup.show().then((result) => {
                if (result !== PR.YES && result !== 1) return;

                // dlg is still valid (ST keeps the object alive) — read directly from it
                const freshS = getSettings();
                if (!freshS.cyoaConfig) freshS.cyoaConfig = {};
                freshS.cyoaConfig.slots          = readSlotsFromPopup(dlg);
                freshS.cyoaConfig.useEmojis      = !!dlg.querySelector('#cyoa-use-emojis')?.checked;
                freshS.cyoaConfig.useXmlTag      = !!dlg.querySelector('#cyoa-use-xml')?.checked;
                freshS.cyoaConfig.useButtonTags  = !!dlg.querySelector('#cyoa-use-buttons')?.checked;
                const styleCfg = readCyoaStyleFromDialog(dlg);
                Object.assign(freshS.cyoaConfig, styleCfg);
                const promptTa = dlg.querySelector('#cyoa-prompt-textarea')?.value?.trim() || '';
                const generated = buildCyoaPrompt(freshS.cyoaConfig);
                if (promptTa && promptTa !== generated) {
                    freshS.cyoaConfig.useCustomPrompt = true;
                    freshS.cyoaConfig.customPromptText = promptTa;
                } else {
                    freshS.cyoaConfig.useCustomPrompt = false;
                    freshS.cyoaConfig.customPromptText = '';
                }

                saveSettings();
                updateCyoaStyle();
                scheduleAutoApply();
            });
        }

        // ── Sysprompt Section Toggles ──
        const _syspromptModDefs = [
            { key: 'loot', id: 'rpg_sysprompt_mod_loot' },
            { key: 'random_events', id: 'rpg_sysprompt_mod_random_events' },
            { key: 'resting', id: 'rpg_sysprompt_mod_resting' },
            { key: 'party_bench', id: 'rpg_sysprompt_mod_party_bench' },
            { key: 'CYOA_mode', id: 'rpg_sysprompt_mod_cyoa_mode' },
            { key: 'quests', id: 'rpg_sysprompt_mod_quests' },
        ];
        _syspromptModDefs.forEach(({ key, id }) => {
            const s = getSettings();
            const val = key === 'CYOA_mode'
                ? (s.syspromptModules?.CYOA_mode === true)
                : (s.syspromptModules?.[key] ?? true);
            $(`#${id}`).prop('checked', val).on('change', function () {
                const fresh = getSettings();
                if (!fresh.syspromptModules) fresh.syspromptModules = {};
                fresh.syspromptModules[key] = !!$(this).prop('checked');

                if (key === 'quests') {
                    $('#rpg_quests_options').toggle(!!$(this).prop('checked'));
                    refreshOrderList();
                }
                if (key === 'party_bench') {
                    if (!fresh.modules) fresh.modules = {};
                    fresh.modules['benched party'] = !!$(this).prop('checked');
                    if ($(this).prop('checked')) fresh.modules.party = true;
                    refreshOrderList();
                }

                saveSettings();
                scheduleAutoApply();
                refreshRenderedView();
            });

            if (key === 'quests') {
                $('#rpg_quests_options').toggle(val);
            }
        });

        // ── Narrative pacing ──────────────────────────────────────────────────
        const validNarrativePacing = new Set(['normal', 'high_agency', 'downtime']);
        const syncNarrativePacingUi = () => {
            const mode = validNarrativePacing.has(getSettings().narrativePacing)
                ? getSettings().narrativePacing
                : 'normal';
            $(`input[name="rpg_narrative_pacing"][value="${mode}"]`).prop('checked', true);
        };
        syncNarrativePacingUi();
        $('input[name="rpg_narrative_pacing"]').on('change', function () {
            const mode = String($(this).val());
            if (!validNarrativePacing.has(mode)) return;
            getSettings().narrativePacing = mode;
            saveSettings();
            scheduleAutoApply();
            refreshRenderedView();
        });
        // Disable any toggle whose section is currently unlocked for Game Systems customization.
        syncAllNarratorTogglesForUnlockState();

        // ── CYOA Settings Cog Buttons ──
        globalThis._rpgOpenCyoaSettings = showCyoaSettingsPopup;
        document.getElementById('rpg_cyoa_settings_btn')?.addEventListener('click', () => showCyoaSettingsPopup());
        document.getElementById('rt_onboarding_cyoa_settings_btn')?.addEventListener('click', () => showCyoaSettingsPopup());

        async function showRelationshipSettingsPopup() {
            const settings = getSettings();
            const mode = getRelationshipUpdateMode(settings);
            const configuredPrompt = typeof settings.npcRelationshipStateTrackerPrompt === 'string'
                ? settings.npcRelationshipStateTrackerPrompt
                : '';
            const builtInPrompt = buildStateTrackerRelationshipCommandInstruction(
                getNpcRelationshipMax(settings),
                false,
            );
            const displayedPrompt = configuredPrompt || builtInPrompt;
            const { Popup, POPUP_TYPE, POPUP_RESULT: PR } = SillyTavern.getContext();
            const html = `<div style="min-width:360px;padding:4px 2px;">
                <div style="font-size:15px;font-weight:700;margin-bottom:8px;">Relationship Update Method</div>
                <div style="font-size:12px;opacity:.75;margin-bottom:14px;">Select one method. The inactive method receives no instructions and does not run.</div>
                <label style="display:block;padding:10px;margin-bottom:8px;border:1px solid rgba(255,255,255,.16);border-radius:7px;cursor:pointer;">
                    <input type="radio" name="rpg_relationship_update_mode" value="regex" ${mode === RELATIONSHIP_UPDATE_MODES.REGEX ? 'checked' : ''}>
                    <strong> Narrator Regex</strong>
                    <div style="font-size:11px;opacity:.7;margin:5px 0 0 23px;">Parses <code>(Friendship: Name +X)</code> annotations from the narrator output.</div>
                </label>
                <label style="display:block;padding:10px;border:1px solid rgba(255,255,255,.16);border-radius:7px;cursor:pointer;">
                    <input type="radio" name="rpg_relationship_update_mode" value="state_tracker" ${mode === RELATIONSHIP_UPDATE_MODES.STATE_TRACKER ? 'checked' : ''}>
                    <strong> State Tracker Tags</strong>
                    <div style="font-size:11px;opacity:.7;margin:5px 0 0 23px;">State Tracker emits a temporary <code>[RELATIONS]</code> block and code applies its lines.</div>
                </label>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:14px;">
                    <label style="font-size:12px;font-weight:700;">State Tracker relationship instruction</label>
                    <button id="rpg_relationship_state_tracker_prompt_reset" type="button" class="menu_button interactable" style="padding:2px 7px;font-size:11px;width:auto !important;min-width:max-content;white-space:nowrap;line-height:1.2;flex:0 0 auto;">Reset to built-in</button>
                </div>
                <div style="font-size:11px;opacity:.7;margin:4px 0 6px;">Used only with State Tracker Tags. Edit what the tracker should expect and output. Optional placeholders: <code>{{max}}</code> and <code>{{full_audit_rule}}</code>.</div>
                <textarea id="rpg_relationship_state_tracker_prompt" rows="13" style="width:100%;resize:vertical;box-sizing:border-box;font-family:var(--mainFontFamily, monospace);font-size:11px;line-height:1.35;">${escapeHtml(displayedPrompt)}</textarea>
            </div>`;
            const popup = new Popup(html, POPUP_TYPE.CONFIRM, '', { okButton: 'Apply', cancelButton: 'Cancel' });
            const promptField = popup.dlg?.querySelector('#rpg_relationship_state_tracker_prompt');
            popup.dlg?.querySelector('#rpg_relationship_state_tracker_prompt_reset')?.addEventListener('click', () => {
                if (!promptField) return;
                promptField.value = builtInPrompt;
                promptField.focus();
            });
            const result = await popup.show();
            if (result !== PR.YES && result !== 1) return;
            const selected = popup.dlg?.querySelector('input[name="rpg_relationship_update_mode"]:checked')?.value;
            settings.npcRelationshipUpdateMode = selected === RELATIONSHIP_UPDATE_MODES.STATE_TRACKER
                ? RELATIONSHIP_UPDATE_MODES.STATE_TRACKER
                : RELATIONSHIP_UPDATE_MODES.REGEX;
            settings.npcRelationshipStateTrackerPrompt = promptField?.value.trim() || '';
            saveSettings();
            scheduleAutoApply();
        }
        document.getElementById('rpg_relationship_settings_btn')?.addEventListener('click', () => void showRelationshipSettingsPopup());

        // Deadlines Toggle
        const deadlinesCb = /** @type {HTMLInputElement} */ (document.getElementById('rpg_quests_deadlines'));
        const frustrationWrap = document.getElementById('rpg_quests_frustration_wrap');
        const syncFrustrationVisibility = () => {
            if (frustrationWrap) frustrationWrap.style.display = deadlinesCb?.checked ? '' : 'none';
        };
        if (deadlinesCb) {
            deadlinesCb.checked = !!getSettings().syspromptModules?.questsDeadlines;
            syncFrustrationVisibility();
            deadlinesCb.addEventListener('change', function () {
                const fresh = getSettings();
                if (!fresh.syspromptModules) fresh.syspromptModules = {};
                fresh.syspromptModules.questsDeadlines = !!this.checked;
                // If deadlines disabled, also uncheck frustration
                if (!this.checked) {
                    fresh.syspromptModules.questsFrustration = false;
                    const fCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_frustration'));
                    if (fCb) fCb.checked = false;
                }
                syncFrustrationVisibility();
                refreshQuestPrompt(fresh);
                refreshOrderList();
                saveSettings();
                scheduleAutoApply();
                refreshRenderedView();
            });
        }

        // Frustration Toggle
        const frustrationCb = /** @type {HTMLInputElement} */ (document.getElementById('rpg_quests_frustration'));
        if (frustrationCb) {
            frustrationCb.checked = !!getSettings().syspromptModules?.questsFrustration;
            frustrationCb.addEventListener('change', function () {
                const fresh = getSettings();
                if (!fresh.syspromptModules) fresh.syspromptModules = {};
                fresh.syspromptModules.questsFrustration = !!this.checked;
                refreshQuestPrompt(fresh);
                refreshOrderList();
                saveSettings();
                scheduleAutoApply();
                refreshRenderedView();
            });
        }


        const showArchiveCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_show_archive'));
        if (showArchiveCb) {
            showArchiveCb.checked = getSettings().syspromptModules?.questsShowArchive !== false;
            showArchiveCb.addEventListener('change', function () {
                const fresh = getSettings();
                if (!fresh.syspromptModules) fresh.syspromptModules = {};
                fresh.syspromptModules.questsShowArchive = !!this.checked;
                saveSettings();
                refreshRenderedView();
            });
        }

        // Quests Help Trigger
        $('#rt_quests_hardcore_help').on('click', (e) => {
            e.stopPropagation();
            showQuestsHardcoreExplanation();
        });

        // Components Help Trigger
        $('#rt_components_help').on('click', (e) => {
            e.stopPropagation();
            showComponentsExplanation();
        });



        // Quests Help Trigger
        const rngModeRadios = document.querySelectorAll('input[name="rpg_sysprompt_rng_mode"]');
        if (rngModeRadios.length) {
            const s = getSettings();
            let currentRngMode = 'hybrid';
            if (!s.rngEnabled) {
                currentRngMode = 'none';
            } else if (s.diceFunctionTool === false) {
                currentRngMode = 'legacy';
            }
            $(`input[name="rpg_sysprompt_rng_mode"][value="${currentRngMode}"]`).prop('checked', true);

            $('input[name="rpg_sysprompt_rng_mode"]').on('change', function () {
                const fresh = getSettings();
                const val = $(this).val();
                if (val === 'hybrid') {
                    fresh.rngEnabled = true;
                    fresh.diceFunctionTool = true;
                } else if (val === 'legacy') {
                    fresh.rngEnabled = true;
                    fresh.diceFunctionTool = false;
                } else {
                    fresh.rngEnabled = false;
                    fresh.diceFunctionTool = false;
                }
                autoSelectRngToolsFromMode(fresh);
                registerDiceFunctionTool();
                saveSettings();
                scheduleAutoApply();
            });
        }

        // Router Agent Settings
        $('#rpg_tracker_router_enabled').prop('checked', settings.routerEnabled).on('change', function () {
            settings.routerEnabled = !!$(this).prop('checked');
            saveSettings();
            // Sync in-panel enable checkbox
            const inPanelCheck = /** @type {HTMLInputElement|null} */ (document.getElementById('rt-agent-router-enable'));
            if (inPanelCheck) inPanelCheck.checked = settings.routerEnabled;
            // Apply disabled state to agent panel
            const ap = document.getElementById('rpg-tracker-agent');
            if (ap) {
                if (settings.routerEnabled) ap.classList.remove('is-agent-disabled');
                else ap.classList.add('is-agent-disabled');
            }
        });

        const routerSourceSelect = $('#rpg_tracker_router_source');
        const routerProfileGroup = $('#rpg_tracker_router_profile_group');
        const routerProfileSelect = $('#rpg_tracker_router_connection_profile');
        const routerOllamaGroup = $('#rpg_tracker_router_ollama_group');
        const routerOpenaiGroup = $('#rpg_tracker_router_openai_group');


        function updateRouterConnectionPanels() {
            const source = routerSourceSelect.val();
            routerProfileGroup.toggle(source === 'profile');
            routerOllamaGroup.toggle(source === 'ollama');
            routerOpenaiGroup.toggle(source === 'openai');
        }

        routerSourceSelect.val(settings.routerConnectionSource || 'default').on('change', function () {
            settings.routerConnectionSource = $(this).val();
            updateRouterConnectionPanels();
            saveSettings();
        });
        setTimeout(updateRouterConnectionPanels, 100); // Ensure DOM is ready for toggle

        // Prefix display: effective value (override or chat id), not only last saved routerCampaignPrefix
        function updateSettingsLorePrefixReadout() {
            const ctx = SillyTavern.getContext();
            const el = document.getElementById('rpg_tracker_router_prefix_display');
            if (el) {
                const eff = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
                el.textContent = eff || '—';
            }
        }
        updateSettingsLorePrefixReadout();

        $('#rpg_tracker_router_prefix_override').val(settings.routerCampaignPrefixOverride || '').on('input', function () {
            settings.routerCampaignPrefixOverride = String($(this).val() || '');
            saveSettings();
            updateSettingsLorePrefixReadout();
        });

        $('#rpg_tracker_activate_books_btn').on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true);
            try {
                const count = await activateCampaignBooks({ debugSource: 'manual:settings-activate-books' });
                toastr['success'](`Activated ${count} campaign lorebook${count === 1 ? '' : 's'}.`);
                await refreshAgentManifestNow();
            } catch (e) {
                toastr['error']('Failed to activate campaign lorebooks.');
            } finally {
                btn.prop('disabled', false);
            }
        });

        $('#rpg_tracker_clone_stack_btn').on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true);
            try {
                await cloneCampaignStack();
            } finally {
                btn.prop('disabled', false);
            }
        });

        $('#rt-agent-router-full-audit, #rt-agent-router-full-audit-panel').on('click', async function () {
            const { Popup } = SillyTavern.getContext();
            const confirmHtml = `
                    <div style="text-align: left; font-size: 0.9em; line-height: 1.5;">
                        <p>You are about to run a <b>Full Audit</b> of the entire chat history through the Lorebook Agent.</p>
                        <p style="margin-top: 8px;">⏳ This may take <b>several minutes</b> depending on the size of your chat. The agent will process the history in chunks, rebuilding and updating your lorebooks sequentially.</p>
                        <p style="margin-top: 8px; color: #ffa500;">⚠️ <b>Do not send messages to the AI while the audit is running.</b></p>
                    </div>
                `;
            const confirmed = await Popup.show.confirm('📚 Lorebook Agent Full Audit', confirmHtml, {
                okButton: 'Start Full Audit',
                cancelButton: 'Cancel'
            });
            if (!confirmed) return;

            const btn = $(this);
            btn.prop('disabled', true);
            // Also disable the other button (settings vs panel)
            $('#rt-agent-router-full-audit, #rt-agent-router-full-audit-panel').prop('disabled', true);
            try {
                const ctx = SillyTavern.getContext();
                const { chat } = ctx;

                const maxContextLimit = ctx.contextSize || settings.fullAuditMaxTokens || 32000;
                const tokenBuffer = 3000;
                const chunkTokenLimit = Math.max(1000, maxContextLimit - tokenBuffer);

                let chunks = [];
                let currentChunk = [];
                let currentTokens = 0;

                for (const m of chat) {
                    const name = m.is_user ? 'Player' : (m.name || 'Narrator');
                    const cleaned = cleanMessageContent(m);
                    if (!cleaned || cleaned.includes('```json\n[') || cleaned.includes('```json\n{')) continue;

                    const line = `${name}: ${cleaned}`;
                    const lineTokens = Math.ceil(line.length / 4);

                    if (currentTokens + lineTokens > chunkTokenLimit && currentChunk.length > 0) {
                        chunks.push(currentChunk);
                        currentChunk = [];
                        currentTokens = 0;
                    }
                    currentChunk.push(line);
                    currentTokens += lineTokens;
                }
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                }

                if (chunks.length === 0) {
                    toastr.info("No chat history to audit.");
                    return;
                }

                console.log(`[RPG Tracker] Agent Full Audit: ${chunks.length} chunk(s) queued.`);

                for (let i = 0; i < chunks.length; i++) {
                    toastr.info(`Agent Full Audit: Chunk ${i + 1} of ${chunks.length}...`, "Lorebook Agent", { timeOut: 8000 });
                    console.log(`[RPG Tracker] Agent Full Audit: Starting chunk ${i + 1}/${chunks.length} (${chunks[i].length} messages)`);

                    // Wait for any lingering router pass to finish (e.g. auto-cleanup from prior chunk)
                    let waitCount = 0;
                    while (isRouterRunning() && waitCount < 60) {
                        await new Promise(r => setTimeout(r, 500));
                        waitCount++;
                    }
                    if (isRouterRunning()) {
                        console.warn(`[RPG Tracker] Agent Full Audit: Chunk ${i + 1} skipped — router still busy after 30s.`);
                        toastr.warning(`Chunk ${i + 1} skipped — agent was still busy.`, "Lorebook Agent");
                        continue;
                    }

                    const overrideChatLog = chunks[i].join('\n\n');
                    const chunkResult = await runRouterPass(null, null, null, true, [], overrideChatLog);
                    console.log(`[RPG Tracker] Agent Full Audit: Chunk ${i + 1}/${chunks.length} finished. Result: ${chunkResult}`);

                    // Yield to the event loop so the UI can repaint with the agent panel updates
                    await new Promise(r => setTimeout(r, 100));
                }

                toastr.success(`Agent Full Audit complete (${chunks.length} chunk${chunks.length > 1 ? 's' : ''}).`, "Lorebook Agent");
            } catch (e) {
                console.error("[RPG Tracker] Agent Full Audit failed:", e);
                toastr.error("Agent Full Audit failed.");
            } finally {
                $('#rt-agent-router-full-audit, #rt-agent-router-full-audit-panel').prop('disabled', false);
            }
        });

        $('#rpg_tracker_lore_debug_capture').on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true);
            try {
                _loreActivationDebugLast = await readLoreActivationDebugSnapshot('manual:capture-settings');
                renderLoreActivationDebugPanel();
                toastr['info']('Lore debug snapshot captured (read-only, no /world commands).');
            } catch (_) {
                toastr['error']('Capture failed.');
            } finally {
                btn.prop('disabled', false);
            }
        });
        $('#rpg_tracker_lore_debug_resync').on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true);
            try {
                const ctx = SillyTavern.getContext();
                const id = ctx.chatId || runtimeState.currentChatId || '';
                await syncCampaignPrefixAndWorldsForChat(id, 'manual:re-sync-settings');
                toastr['info']('Re-sync finished; see JSON in Lore activation debug below.');
            } catch (_) {
                toastr['error']('Re-sync failed.');
            } finally {
                btn.prop('disabled', false);
            }
        });

        // Router Ollama
        $('#rpg_tracker_router_ollama_url').val(settings.routerOllamaUrl).on('input', function () {
            settings.routerOllamaUrl = $(this).val();
            saveSettings();
        });
        const routerOllamaModelSelect = $('#rpg_tracker_router_ollama_model');
        routerOllamaModelSelect.val(settings.routerOllamaModel).on('change', function () {
            settings.routerOllamaModel = $(this).val();
            saveSettings();
        });
        $('#rpg_tracker_router_ollama_refresh').on('click', async function () {
            const url = $('#rpg_tracker_router_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                routerOllamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    routerOllamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                routerOllamaModelSelect.val(settings.routerOllamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                toastr['error']("Failed to fetch Ollama models.");
            }
        });

        // Router OpenAI
        $('#rpg_tracker_router_openai_url').val(settings.routerOpenaiUrl).on('input', function () {
            settings.routerOpenaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_tracker_router_openai_key').val(settings.routerOpenaiKey).on('input', function () {
            settings.routerOpenaiKey = $(this).val();
            saveSettings();
        });
        const routerOpenaiModelSelect = $('#rpg_tracker_router_openai_model');
        const routerOpenaiModelManual = $('#rpg_tracker_router_openai_model_manual');
        routerOpenaiModelManual.val(settings.routerOpenaiModel || '');
        routerOpenaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                routerOpenaiModelManual.val('');
                settings.routerOpenaiModel = String(val);
            } else {
                settings.routerOpenaiModel = String(routerOpenaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        routerOpenaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) routerOpenaiModelSelect.val('');
            settings.routerOpenaiModel = manual || String(routerOpenaiModelSelect.val() || '') || '';
            saveSettings();
        });
        $('#rpg_tracker_router_openai_refresh').on('click', async function () {
            const url = $('#rpg_tracker_router_openai_url').val();
            const key = $('#rpg_tracker_router_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models...");
                const models = await fetchOpenAIModels(url, key);
                routerOpenaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) routerOpenaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                routerOpenaiModelSelect.val(settings.routerOpenaiModel);
                toastr['success']("Models updated.");
            } catch (e) {
                toastr['warning']("Cannot auto-detect models. Type manually.");
            }
        });

        // Router Profiles & Presets Population
        const routerPresetSelect = $('#rpg_tracker_router_completion_preset');
        if (!tryBindConnectionProfileDropdown('#rpg_tracker_router_connection_profile', settings.routerConnectionProfileId, (id) => {
            settings.routerConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                routerProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => routerProfileSelect.append($('<option></option>').val(p).text(p)));
                routerProfileSelect.val(settings.routerConnectionProfileId || "");
            });
            routerProfileSelect.on('change', function () {
                settings.routerConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            routerPresetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => routerPresetSelect.append($('<option></option>').val(p).text(p)));
            routerPresetSelect.val(settings.routerCompletionPresetId || '');
        }
        routerPresetSelect.on('change', function () {
            settings.routerCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });


        $('#rpg_tracker_router_basic_mode').prop('checked', settings.routerBasicMode).on('change', function () {
            settings.routerBasicMode = $(this).prop('checked');
            $('#rt-agent-router-basic').prop('checked', settings.routerBasicMode);
            saveSettings();
        });
        $('#rpg_tracker_router_native_keyword_activation').prop('checked', settings.routerNativeKeywordActivation).on('change', function () {
            settings.routerNativeKeywordActivation = $(this).prop('checked');
            $('#rt-agent-router-native-kw').prop('checked', settings.routerNativeKeywordActivation);
            saveSettings();
        });
        $('#rpg_tracker_router_include_hidden').prop('checked', settings.routerIncludeHidden).on('change', function () {
            settings.routerIncludeHidden = $(this).prop('checked');
            $('#rt-agent-router-include-hidden').prop('checked', settings.routerIncludeHidden);
            saveSettings();
        });
        $('#rpg_tracker_router_swipe_rollback').prop('checked', settings.routerSwipeRollback !== false).on('change', function () {
            settings.routerSwipeRollback = $(this).prop('checked');
            $('#rt-agent-router-swipe-rollback').prop('checked', settings.routerSwipeRollback);
            saveSettings();
        });
        // Lorebook Agent lookback mode — three-option radio group
        const routerLookbackNumericRow = $('#rpg_tracker_router_lookback_numeric_row');
        const applyDrawerLookbackUI = (mode) => {
            const isFixed = mode === 'fixed';
            routerLookbackNumericRow.css({ opacity: isFixed ? '1' : '0.35', 'pointer-events': isFixed ? 'auto' : 'none' });
        };

        // Determine current mode from settings
        const currentLookbackMode = settings.routerLookbackSinceLastRun !== false ? 'since_last_run'
            : settings.routerLookbackSinceLastUser === true ? 'since_last_user' : 'fixed';

        // Init radio selection and numeric row state
        $(`#rpg_tracker_router_lookback_since_last_run`).prop('checked', currentLookbackMode === 'since_last_run');
        $(`#rpg_tracker_router_lookback_since_last_user`).prop('checked', currentLookbackMode === 'since_last_user');
        $(`#rpg_tracker_router_lookback_fixed`).prop('checked', currentLookbackMode === 'fixed');
        applyDrawerLookbackUI(currentLookbackMode);

        $('input[name="router_lookback_mode"]').on('change', function () {
            const mode = String($(this).val());
            settings.routerLookbackSinceLastRun = mode === 'since_last_run';
            settings.routerLookbackSinceLastUser = mode === 'since_last_user';
            applyDrawerLookbackUI(mode);

            // Sync the agent panel radio group if present
            const panelRadio = $(`#rt-agent-lookback-mode-${mode === 'since_last_run' ? 'run' : mode === 'since_last_user' ? 'user' : 'fixed'}`);
            if (panelRadio.length) panelRadio.prop('checked', true);
            const panelContainer = $('#rt-agent-router-lookback-container');
            if (panelContainer.length) {
                panelContainer.css({ opacity: mode === 'fixed' ? '1' : '0.35', 'pointer-events': mode === 'fixed' ? 'auto' : 'none' });
            }
            saveSettings();
        });

        $('#rpg_tracker_router_lookback').val(settings.routerLookback).on('input', function () {
            settings.routerLookback = parseInt(String($(this).val() || '')) || 4;
            $('#rt-agent-router-lookback').val(settings.routerLookback);
            saveSettings();
        });
        $('#rpg_tracker_router_run_every').val(settings.routerRunEvery || 3).on('input', function () {
            settings.routerRunEvery = parseInt(String($(this).val() || '')) || 3;
            $('#rt-agent-router-run-every').val(settings.routerRunEvery);
            saveSettings();
        });
        $('#rpg_tracker_router_max_turns').val(settings.routerMaxTurns).on('input', function () {
            settings.routerMaxTurns = parseInt(String($(this).val() || '')) || 5;
            $('#rt-agent-router-max-turns').val(settings.routerMaxTurns);
            saveSettings();
        });
        $('#rpg_tracker_router_max_activations').val(settings.routerMaxActivations).on('input', function () {
            settings.routerMaxActivations = parseInt(String($(this).val() || '')) || 8;
            $('#rt-agent-router-max-activations').val(settings.routerMaxActivations);
            saveSettings();
        });
        $('#rpg_tracker_router_max_keyword_overflow').val(settings.routerMaxKeywordOverflow ?? 0).on('input', function () {
            settings.routerMaxKeywordOverflow = parseInt(String($(this).val() || '')) || 0;
            $('#rt-agent-router-kw-overflow-cap').val(settings.routerMaxKeywordOverflow);
            saveSettings();
        });

        // NPC Settings Bindings — delegated so toggles stay live if settings HTML is re-injected.
        $(document).off('change.rpgPortraitDisplay', '#rpg_tracker_npc_portraits, #rpg_tracker_location_images');
        $(document).on('change.rpgPortraitDisplay', '#rpg_tracker_npc_portraits', async function () {
            const s = getSettings();
            applyNpcPortraitSetting(s, !!$(this).prop('checked'));
            saveSettings();
            await refreshLorebookAgentViewsNow({ forceLayoutRefresh: true });
        });
        $(document).on('change.rpgPortraitDisplay', '#rpg_tracker_location_images', async function () {
            const s = getSettings();
            if (s.portraitAutoGenerateSceneView && !$(this).prop('checked')) {
                syncLocationImageDependentUi(s);
                return;
            }
            applyLocationImageSetting(s, !!$(this).prop('checked'));
            saveSettings();
            await refreshLorebookAgentViewsNow({ forceLayoutRefresh: true });
        });
        $('#rpg_tracker_npc_portraits').prop('checked', settings.npcPortraits !== false);
        syncNpcPortraitDependentUi(settings);

        $('#rpg_tracker_location_images').prop('checked', !!settings.locationImages);
        syncLocationImageDependentUi(settings);

        $('#rpg_tracker_npc_major_words').val(settings.npcMajorWords ?? 25).on('change', function () {
            // Use 'change' instead of 'input' to only save once the user is done editing.
            // Fall back to the current saved value (not a hardcoded default) if the field is empty.
            const raw = parseInt(String($(this).val() || ''), 10);
            const val = isNaN(raw) ? (settings.npcMajorWords ?? 25) : raw;
            settings.npcMajorWords = Math.max(1, Math.min(1000, val));
            $(this).val(settings.npcMajorWords); // update display with clamped value
            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
            }
            saveSettings();
            if (typeof globalThis._rpgRenderAgentModules === 'function') {
                globalThis._rpgRenderAgentModules();
            }
        });
        $('#rpg_tracker_npc_minor_words').val(settings.npcMinorWords ?? 15).on('change', function () {
            const raw = parseInt(String($(this).val() || ''), 10);
            const val = isNaN(raw) ? (settings.npcMinorWords ?? 15) : raw;
            settings.npcMinorWords = Math.max(1, Math.min(1000, val));
            $(this).val(settings.npcMinorWords); // update display with clamped value
            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
            }
            saveSettings();
            if (typeof globalThis._rpgRenderAgentModules === 'function') {
                globalThis._rpgRenderAgentModules();
            }
        });
        const handleRelBarsChange = (val) => {
            settings.npcRelationshipBars = val;
            $('#rpg_tracker_npc_rel_bars').prop('checked', val);
            $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', val);

            const onbRel = document.getElementById('rt_onboarding_mod_npc_rel_bars');
            if (onbRel) onbRel.checked = val;

            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
            }
            saveSettings();
            scheduleAutoApply();
            setTimeout(() => {
                if (typeof globalThis._rpgRenderAgentModules === 'function') {
                    globalThis._rpgRenderAgentModules();
                }
                if (typeof runtimeState.refreshAgentManifest === 'function') {
                    void runtimeState.refreshAgentManifest().catch(() => { });
                }
                refreshRenderedView();
            }, 1);
        };

        $('#rpg_tracker_npc_rel_bars').prop('checked', !!settings.npcRelationshipBars).on('change', function () {
            handleRelBarsChange($(this).prop('checked'));
        });

        $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!settings.npcRelationshipBars).on('change', function () {
            handleRelBarsChange($(this).prop('checked'));
        });
        $('#rpg_tracker_npc_rel_toast').prop('checked', settings.npcRelationshipToast !== false).on('change', function () {
            settings.npcRelationshipToast = $(this).prop('checked');
            saveSettings();
        });
        $('#rpg_tracker_npc_rel_max_default').val(getNpcRelationshipMaxDefault(settings)).on('change', function () {
            const raw = parseInt(String($(this).val() || ''), 10);
            const val = isNaN(raw) ? getNpcRelationshipMaxDefault(settings) : raw;
            setNpcRelationshipMaxDefault(val);
        });
        // Note: experimentalNpcImport removed — NPC Creator button is always visible.
        $('#rpg_tracker_ignore_npc_limits').prop('checked', !!settings.ignoreNpcImportLimits).on('change', function () {
            settings.ignoreNpcImportLimits = $(this).prop('checked');
            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
            }

            saveSettings();
            if (typeof globalThis._rpgRenderAgentModules === 'function') {
                globalThis._rpgRenderAgentModules();
            }
        });

        // "Add as is" Import Mode — main settings panel radios
        // Set initial checked state from saved setting
        const _currentAddAsIsMode = settings.npcAddAsIsMode ?? 'ai_review';
        $(`input[name="rpg_npc_add_as_is_mode_main"][value="${_currentAddAsIsMode}"]`).prop('checked', true);
        // On change: save to settings and mirror to the quick-popup radios (if open)
        $('input[name="rpg_npc_add_as_is_mode_main"]').on('change', function () {
            if (!$(this).prop('checked')) return;
            const newMode = $(this).val();
            settings.npcAddAsIsMode = newMode;
            saveSettings();
            // Sync quick-popup radios (name="rt-npc-add-as-is-mode") if they exist in the DOM
            $(`input[name="rt-npc-add-as-is-mode"][value="${newMode}"]`).prop('checked', true);
        });

        // New Entry Settings Bindings
        const defPosSelect = $('#rpg_tracker_router_default_position');
        const defaultPosition = settings.routerDefaultPosition ?? 4;
        const defaultRole = settings.routerDefaultRole ?? 0;
        const roleAttr = defaultPosition === 4 ? String(defaultRole) : '';
        defPosSelect.find(`option[value="${defaultPosition}"][data-role="${roleAttr}"]`).prop('selected', true);

        $('#rpg_tracker_router_default_depth').val(settings.routerDefaultDepth ?? 4);
        $('#rpg_tracker_router_default_order').val(settings.routerDefaultOrder ?? 100);

        function updateDefaultPositionFieldsVisibility() {
            const posVal = parseInt(String(defPosSelect.val() || '4'));
            jqueryToggleSlide($('#rpg_tracker_router_default_depth_container'), posVal === 4);
        }
        updateDefaultPositionFieldsVisibility();

        defPosSelect.on('change', function () {
            const selectedOpt = $(this).find(':selected');
            const pos = parseInt(String(selectedOpt.val() || '4'));
            const roleVal = selectedOpt.data('role');
            settings.routerDefaultPosition = isNaN(pos) ? 4 : pos;
            settings.routerDefaultRole = roleVal !== undefined && roleVal !== '' ? parseInt(String(roleVal)) : 0;
            saveSettings();
            updateDefaultPositionFieldsVisibility();
        });

        $('#rpg_tracker_router_default_depth').on('input', function () {
            settings.routerDefaultDepth = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $('#rpg_tracker_router_default_order').on('input', function () {
            settings.routerDefaultOrder = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        // Active Lore Injection Settings Bindings
        const lorePosSelect = $('#rpg_tracker_lore_injection_position');
        const lorePosition = settings.loreInjectionPosition ?? 4;
        const loreRole = settings.loreInjectionRole ?? 0;
        const loreRoleAttr = lorePosition === 4 ? String(loreRole) : '';
        lorePosSelect.find(`option[value="${lorePosition}"][data-role="${loreRoleAttr}"]`).prop('selected', true);

        $('#rpg_tracker_lore_injection_depth').val(settings.loreInjectionDepth ?? 4);

        function updateLorePositionFieldsVisibility() {
            const posVal = parseInt(String(lorePosSelect.val() || '4'));
            jqueryToggleSlide($('#rpg_tracker_lore_injection_depth_container'), posVal === 4);
        }
        updateLorePositionFieldsVisibility();

        lorePosSelect.on('change', function () {
            const selectedOpt = $(this).find(':selected');
            const pos = parseInt(String(selectedOpt.val() || '4'));
            const roleVal = selectedOpt.data('role');
            settings.loreInjectionPosition = isNaN(pos) ? 4 : pos;
            settings.loreInjectionRole = roleVal !== undefined && roleVal !== '' ? parseInt(String(roleVal)) : 0;
            saveSettings();
            updateLorePositionFieldsVisibility();
        });

        $('#rpg_tracker_lore_injection_depth').on('input', function () {
            settings.loreInjectionDepth = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $('#rpg_tracker_router_prompt').val(settings.routerSystemPromptTemplate).on('input', function () {
            settings.routerSystemPromptTemplate = String($(this).val() || '');
            saveSettings();
        });

        $('#rpg_tracker_router_modular_prompt').val(settings.routerModularPromptTemplate).on('input', function () {
            settings.routerModularPromptTemplate = String($(this).val() || '');
            saveSettings();
        });
        $('#rpg_tracker_router_btn_reset_prompt').on('click', function () {
            if (!confirm('Reset Router Agent prompt to default?')) return;

            // Delete the stored key so getSettings() falls back to the canonical default in state-manager.js
            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].routerSystemPromptTemplate;
            }
            const freshDefault = getSettings().routerSystemPromptTemplate;

            const s = getSettings();
            s.routerSystemPromptTemplate = freshDefault;

            const $el = $('#rpg_tracker_router_prompt');
            $el.val(freshDefault);
            $el.trigger('input');

            if (typeof (/** @type {any} */ ($el)).trigger === 'function') {
                (/** @type {any} */ ($el)).trigger('autosize.resize');
            }

            saveSettings();
            toastr['success']('Router prompt reset to default.', 'RPG Tracker');
        });

        $('#rpg_tracker_router_btn_reset_modular_prompt').on('click', function () {
            if (!confirm('Reset Modular Agent instruction to default?')) return;

            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].routerModularPromptTemplate;
            }
            const freshDefault = getSettings().routerModularPromptTemplate;

            const s = getSettings();
            s.routerModularPromptTemplate = freshDefault;

            const $el = $('#rpg_tracker_router_modular_prompt');
            $el.val(freshDefault);
            $el.trigger('input');

            if (typeof (/** @type {any} */ ($el)).trigger === 'function') {
                (/** @type {any} */ ($el)).trigger('autosize.resize');
            }

            saveSettings();
            toastr['success']('Modular instructions reset to default.', 'RPG Tracker');
        });

        // ── World Progression settings ─────────────────────────────────────────
        const $wpEnabled = $('#rpg_world_progression_enabled');
        const $wpInterval = $('#rpg_world_progression_interval');
        const $wpKeepActive = $('#rpg_world_progression_keep_active');
        const $wpHistoryLookback = $('#rpg_world_progression_history_lookback');
        const $wpRandomizeNPCs = $('#rpg_world_progression_randomize_npcs');
        const $wpRandomSkeletonNPCCount = $('#rpg_world_progression_random_skeleton_npc_count');
        const $wpRandomNarrativeNPCCount = $('#rpg_world_progression_random_narrative_npc_count');
        const $wpRandomNPCCountContainer = $('#rpg_world_progression_random_npc_count_container');
        const $wpRandomizeLocations = $('#rpg_world_progression_randomize_locations');
        const $wpRandomSkeletonLocationCount = $('#rpg_world_progression_random_skeleton_location_count');
        const $wpRandomNarrativeLocationCount = $('#rpg_world_progression_random_narrative_location_count');
        const $wpRandomLocationCountContainer = $('#rpg_world_progression_random_location_count_container');
        const $wpRandomizeFactions = $('#rpg_world_progression_randomize_factions');
        const $wpRandomSkeletonFactionCount = $('#rpg_world_progression_random_skeleton_faction_count');
        const $wpRandomNarrativeFactionCount = $('#rpg_world_progression_random_narrative_faction_count');
        const $wpRandomFactionCountContainer = $('#rpg_world_progression_random_faction_count_container');

        const $wpLookback = $('#rpg_world_progression_lookback');
        const $wpSystemPrompt = $('#rpg_world_progression_system_prompt');
        const $wpResetPrompt = $('#rpg_world_progression_btn_reset_prompt');
        const $wpLastFired = $('#rpg_world_progression_last_fired');
        const $wpLastReportVal = $('#rpg_world_progression_last_report_val');
        const $wpNextReportVal = $('#rpg_world_progression_next_report_val');
        const $wpGenerateNow = $('#rpg_world_progression_generate_now');

        /** Refreshes the "Last generated:" read-only display. */
        function updateWorldProgressionLastFiredDisplay() {
            const s = getSettings();
            const label = s.worldProgressionLastFiredPeriodLabel || '';
            const mins = label ? (parseInWorldTime(label) ?? -1) : -1;

            const lastReportText = label || 'Never';
            $wpLastFired.text(lastReportText);
            $wpLastReportVal.text(lastReportText);

            const intervalHours = s.worldProgressionIntervalHours || 24;
            const intervalMinutes = intervalHours * 60;

            let nextMins = -1;
            if (mins >= 0) {
                nextMins = mins + intervalMinutes;
            } else {
                const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
                const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
                const currentMins = timeStr ? (parseInWorldTime(timeStr) ?? -1) : -1;
                if (currentMins >= 0) {
                    nextMins = currentMins + intervalMinutes;
                }
            }
            $wpNextReportVal.text(nextMins >= 0 ? formatInWorldTime(nextMins) : '—');
            if (typeof runtimeState.updateAgentWorldStatusRef === 'function') {
                runtimeState.updateAgentWorldStatusRef();
            }
        }
        runtimeState.updateWorldProgressionLastFiredDisplayRef = updateWorldProgressionLastFiredDisplay;

        $wpEnabled.prop('checked', !!settings.worldProgressionEnabled).on('change', async function () {
            getSettings().worldProgressionEnabled = !!$(this).prop('checked');
            saveSettings();
            if (typeof runtimeState.updateAgentWorldStatusRef === 'function') {
                runtimeState.updateAgentWorldStatusRef();
            }
            if (runtimeState.currentChatId) {
                await syncCampaignPrefixAndWorldsForChat(runtimeState.currentChatId, 'toggle-world-progression');
            }
        });
        $wpInterval.val(settings.worldProgressionIntervalHours || 24).on('input', function () {
            getSettings().worldProgressionIntervalHours = parseInt(String($(this).val() || '')) || 24;
            saveSettings();
            updateWorldProgressionLastFiredDisplay();
        });

        $wpKeepActive.val(settings.worldProgressionKeepActive || 1).on('input', function () {
            getSettings().worldProgressionKeepActive = parseInt(String($(this).val() || '')) || 1;
            saveSettings();
        });
        $wpHistoryLookback.val(settings.worldProgressionHistoryLookback ?? 0).on('input', function () {
            getSettings().worldProgressionHistoryLookback = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        const $wpConsolidateEnabled = $('#rpg_world_progression_consolidate_enabled');
        const $wpConsolidateInterval = $('#rpg_world_progression_consolidate_interval');
        const $wpConsolidateIntervalContainer = $('#rpg_world_progression_consolidate_interval_container');

        function updateConsolidateVisibility() {
            if ($wpConsolidateEnabled.prop('checked')) {
                $wpConsolidateIntervalContainer.show();
            } else {
                $wpConsolidateIntervalContainer.hide();
            }
        }

        $wpConsolidateEnabled.prop('checked', !!settings.worldProgressionConsolidateEnabled).on('change', function () {
            getSettings().worldProgressionConsolidateEnabled = !!$(this).prop('checked');
            saveSettings();
            updateConsolidateVisibility();
        });
        $wpConsolidateInterval.val(settings.worldProgressionConsolidateInterval ?? 7).on('input', function () {
            getSettings().worldProgressionConsolidateInterval = parseInt(String($(this).val() || '')) || 7;
            saveSettings();
        });
        updateConsolidateVisibility();

        function updateRandomizersVisibility() {
            if ($wpRandomizeNPCs.prop('checked')) {
                $wpRandomNPCCountContainer.show();
            } else {
                $wpRandomNPCCountContainer.hide();
            }
            if ($wpRandomizeLocations.prop('checked')) {
                $wpRandomLocationCountContainer.show();
            } else {
                $wpRandomLocationCountContainer.hide();
            }
            if ($wpRandomizeFactions.prop('checked')) {
                $wpRandomFactionCountContainer.show();
            } else {
                $wpRandomFactionCountContainer.hide();
            }

        }

        $wpRandomizeNPCs.prop('checked', !!settings.worldProgressionRandomizeNPCs).on('change', function () {
            getSettings().worldProgressionRandomizeNPCs = !!$(this).prop('checked');
            saveSettings();
            updateRandomizersVisibility();
        });

        $wpRandomSkeletonNPCCount.val(settings.worldProgressionRandomSkeletonNPCCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomSkeletonNPCCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomNarrativeNPCCount.val(settings.worldProgressionRandomNarrativeNPCCount ?? 3).on('input', function () {
            getSettings().worldProgressionRandomNarrativeNPCCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomizeLocations.prop('checked', !!settings.worldProgressionRandomizeLocations).on('change', function () {
            getSettings().worldProgressionRandomizeLocations = !!$(this).prop('checked');
            saveSettings();
            updateRandomizersVisibility();
        });

        $wpRandomSkeletonLocationCount.val(settings.worldProgressionRandomSkeletonLocationCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomSkeletonLocationCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomNarrativeLocationCount.val(settings.worldProgressionRandomNarrativeLocationCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomNarrativeLocationCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomizeFactions.prop('checked', !!settings.worldProgressionRandomizeFactions).on('change', function () {
            getSettings().worldProgressionRandomizeFactions = !!$(this).prop('checked');
            saveSettings();
            updateRandomizersVisibility();
        });

        $wpRandomSkeletonFactionCount.val(settings.worldProgressionRandomSkeletonFactionCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomSkeletonFactionCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomNarrativeFactionCount.val(settings.worldProgressionRandomNarrativeFactionCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomNarrativeFactionCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });



        updateRandomizersVisibility();

        $wpLookback.val(settings.worldProgressionLookback ?? 0).on('input', function () {
            getSettings().worldProgressionLookback = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });
        const $wpExclusionList = $('#rpg_world_progression_exclusion_list');
        $wpExclusionList.val(settings.worldProgressionExclusionList || '').on('input', function () {
            getSettings().worldProgressionExclusionList = String($(this).val() || '');
            saveSettings();
        });
        $wpSystemPrompt.val(settings.worldProgressionSystemPrompt || '').on('input', function () {
            getSettings().worldProgressionSystemPrompt = String($(this).val() || '');
            saveSettings();
        });
        $wpResetPrompt.on('click', function () {
            if (!confirm('Reset World Progression system prompt to default?')) return;
            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
            }
            const freshDefault = getSettings().worldProgressionSystemPrompt;
            getSettings().worldProgressionSystemPrompt = freshDefault;
            $wpSystemPrompt.val(freshDefault);
            saveSettings();
            toastr['success']('World Progression prompt reset to default.', 'World Progression');
        });
        const $wpInjectionPosition = $('#rpg_world_progression_injection_position');
        const $wpInjectionDepth = $('#rpg_world_progression_injection_depth');
        const $wpInjectionDepthContainer = $('#rpg_world_progression_injection_depth_container');

        const wpPositionVal = settings.worldProgressionInjectionPosition ?? 4;
        const wpRoleVal = settings.worldProgressionInjectionRole ?? 0;
        const wpRoleAttrVal = wpPositionVal === 4 ? String(wpRoleVal) : '';
        $wpInjectionPosition.find(`option[value="${wpPositionVal}"][data-role="${wpRoleAttrVal}"]`).prop('selected', true);

        $wpInjectionDepth.val(settings.worldProgressionInjectionDepth ?? 3);

        function updateWpPositionFieldsVisibility() {
            const posVal = parseInt(String($wpInjectionPosition.val() || '4'));
            jqueryToggleSlide($wpInjectionDepthContainer, posVal === 4);
        }
        updateWpPositionFieldsVisibility();

        $wpInjectionPosition.on('change', function () {
            const selectedOpt = $(this).find(':selected');
            const pos = parseInt(String(selectedOpt.val() || '4'));
            const roleVal = selectedOpt.data('role');
            settings.worldProgressionInjectionPosition = isNaN(pos) ? 4 : pos;
            settings.worldProgressionInjectionRole = roleVal !== undefined && roleVal !== '' ? parseInt(String(roleVal)) : 0;
            saveSettings();
            updateWpPositionFieldsVisibility();
        });

        $wpInjectionDepth.on('input', function () {
            settings.worldProgressionInjectionDepth = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        updateWorldProgressionLastFiredDisplay();

        // ── Override Next Report button ──────────────────────────────────────────
        $('#rpg_world_progression_btn_override_next').on('click', function () {
            const s = getSettings();
            const intervalHours = s.worldProgressionIntervalHours || 24;
            const intervalMinutes = intervalHours * 60;
            const currentLastMins = s.worldProgressionLastFiredAtMinutes ?? -1;
            const currentNextMins = currentLastMins >= 0 ? currentLastMins + intervalMinutes : intervalMinutes;

            function fmtHint(totalMins) {
                if (totalMins < 0) return s.useDdMmYyFormat ? '01/01/2026, 08:00 AM' : (s.use24hTime ? 'Day 1, 00:00' : 'Day 1, 12:00 AM');
                return formatInWorldTime(totalMins);
            }

            const acceptedFormats = s.useDdMmYyFormat
                ? 'Accepted formats: "06/01/2026, 08:00 AM", "06/01/2026, 08:00", "06/01/2026"'
                : 'Accepted formats: "Day 6, 08:00 AM", "Day 6, 08:00", "Day 6"';

            const userInput = window.prompt(
                'Enter the in-world time for the NEXT report.\n' + acceptedFormats,
                fmtHint(currentNextMins)
            );
            if (userInput === null) return; // cancelled

            const parsedNextMins = parseInWorldTime(userInput.trim());
            if (parsedNextMins == null || parsedNextMins <= 0) {
                const errorFormat = s.useDdMmYyFormat
                    ? 'Could not parse the entered time. Please use a format like "06/01/26, 08:00 AM".'
                    : 'Could not parse the entered time. Please use a format like "Day 6, 08:00 AM".';
                toastr['warning'](errorFormat, 'World Progression');
                return;
            }

            // Back-calculate: set label to what the period-end date would be at nextMins - interval
            const lastFiredMins = parsedNextMins - intervalMinutes;
            s.worldProgressionLastFiredPeriodLabel = formatInWorldTime(lastFiredMins);
            saveSettings();
            updateWorldProgressionLastFiredDisplay();
            toastr['success'](`Next report set to ${fmtHint(parsedNextMins)}.`, 'World Progression');
        });

        $wpGenerateNow.on('click', async function () {
            const { parseInWorldMinutes: piw, runWorldProgressionPass: rwp } = await import('./router.js');
            const s = getSettings();
            const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
            const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
            const currentMinutes = piw(timeStr);
            if (currentMinutes < 0) {
                toastr['warning']('Cannot parse in-world time from State Memo. Make sure the State Tracker has run at least once.', 'World Progression');
                return;
            }
            // Force fire by temporarily clearing lastFiredAtMinutes so it picks up the current period
            const savedLast = s.worldProgressionLastFiredAtMinutes;
            s.worldProgressionLastFiredAtMinutes = -1;
            $wpGenerateNow.prop('disabled', true).text('Generating…');
            try {
                await rwp(timeStr, currentMinutes);
                updateWorldProgressionLastFiredDisplay();
                toastr['success']('World Progression report generated.', 'World Progression');
            } catch (e) {
                toastr['error'](`World Progression error: ${e.message}`, 'World Progression');
                s.worldProgressionLastFiredAtMinutes = savedLast;
            } finally {
                $wpGenerateNow.prop('disabled', false).html('<i class="fa-solid fa-globe"></i> Generate Now (current period)');
            }
        });

        const $wpFireWithInstructions = $('#rpg_world_progression_fire_with_instructions');
        $wpFireWithInstructions.on('click', async function () {
            const { parseInWorldMinutes: piw, runWorldProgressionPass: rwp } = await import('./router.js');
            const s = getSettings();
            const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
            const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
            const currentMinutes = piw(timeStr);
            if (currentMinutes < 0) {
                toastr['warning']('Cannot parse in-world time from State Memo. Make sure the State Tracker has run at least once.', 'World Progression');
                return;
            }

            const popupBody = `
                <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box;">
                    <div style="font-size:13px; opacity:0.9; font-weight:bold;">🌍 Fire with Extra Instructions</div>
                    <div style="font-size:11px; opacity:0.7; line-height:1.4;">
                        Enter extra instructions to append to the World Progression system prompt for this run only (e.g., "make things pick up", "get more chaotic").
                    </div>
                    <textarea id="rt_wp_extra_instructions_settings" rows="4" class="text_pole"
                        style="font-size:12px; resize:vertical; width:100%;"
                        placeholder="e.g. Make the factions more aggressive, increase conflicts, or introduce a major weather event."></textarea>
                </div>
            `;

            let extraInstructions = '';
            setTimeout(() => {
                const textarea = document.getElementById('rt_wp_extra_instructions_settings');
                if (textarea) {
                    textarea.addEventListener('input', () => { extraInstructions = textarea.value.trim(); });
                }
            }, 100);

            const { Popup } = SillyTavern.getContext();
            const choice = await Popup.show.confirm('World Progression', popupBody, { okButton: 'Fire', cancelButton: 'Cancel' });
            if (!choice) return;

            // Force fire by temporarily clearing lastFiredAtMinutes so it picks up the current period
            const savedLast = s.worldProgressionLastFiredAtMinutes;
            s.worldProgressionLastFiredAtMinutes = -1;
            $wpFireWithInstructions.prop('disabled', true).text('Generating…');
            try {
                await rwp(timeStr, currentMinutes, extraInstructions);
                updateWorldProgressionLastFiredDisplay();
                toastr['success']('World Progression report generated.', 'World Progression');
            } catch (e) {
                toastr['error'](`World Progression error: ${e.message}`, 'World Progression');
                s.worldProgressionLastFiredAtMinutes = savedLast;
            } finally {
                $wpFireWithInstructions.prop('disabled', false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> Fire with Extra Instructions');
            }
        });

        // ── World Progression Reset Timeline ──
        const $wpResetTimeline = $('#rpg_world_progression_reset_timeline');
        $wpResetTimeline.on('click', function () {
            const s = getSettings();
            s.worldProgressionLastFiredAtMinutes = -1;
            s.worldProgressionLastFiredPeriodLabel = '';
            saveSettings();
            if (s.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
            updateWorldProgressionLastFiredDisplay();
            if (typeof runtimeState.updateAgentWorldStatusRef === 'function') runtimeState.updateAgentWorldStatusRef();
            toastr['info']('World Progression timeline reset. Next report will start from the current time.', 'World Progression');
        });

        $('#rpg_world_progression_purge_history').on('click', () => { void confirmAndPurgeWorldHistory(); });

        const $wpConsolidateCount = $('#rpg_world_progression_consolidate_count');
        const $wpConsolidateNow = $('#rpg_world_progression_btn_consolidate_now');

        $wpConsolidateNow.on('click', async function () {
            const count = parseInt(String($wpConsolidateCount.val() || '')) || 7;
            if (count < 2) {
                toastr['warning']('Please enter a count of at least 2 reports to consolidate.', 'World Progression');
                return;
            }
            if (!confirm(`Are you sure you want to consolidate the oldest ${count} raw reports right now?`)) {
                return;
            }

            const { runWorldProgressionConsolidationPass } = await import('./router.js');
            $wpConsolidateNow.prop('disabled', true).text('Consolidating…');
            try {
                const label = await runWorldProgressionConsolidationPass(count);
                toastr['success'](`Consolidated into "${label}".`, 'World Progression');
            } catch (e) {
                toastr['error'](`Consolidation error: ${e.message}`, 'World Progression');
            } finally {
                $wpConsolidateNow.prop('disabled', false).html('<i class="fa-solid fa-compress"></i> Consolidate Now');
            }
        });

        // ── World Skeleton wiring ───────────────────────────────────────────────
        const $wpSkeletonAtmosphere = $('#rpg_world_progression_skeleton_atmosphere');
        const $wpSkeletonAtmosphereLookback = $('#rpg_world_progression_skeleton_atmosphere_lookback');
        const $wpGenerateAtmosphere = $('#rpg_world_progression_btn_generate_atmosphere');
        const $wpSkeletonUseExisting = $('#rpg_world_progression_skeleton_use_existing');
        const $wpSkeletonFactions = $('#rpg_world_progression_skeleton_factions');
        const $wpSkeletonLocations = $('#rpg_world_progression_skeleton_locations');
        const $wpSkeletonNPCs = $('#rpg_world_progression_skeleton_npcs');
        const $wpSkeletonConflicts = $('#rpg_world_progression_skeleton_conflicts');
        const $wpSkeletonPrompt = $('#rpg_world_progression_skeleton_system_prompt');
        const $wpResetSkeletonPrompt = $('#rpg_world_progression_btn_reset_skeleton_prompt');
        const $wpGenerateSkeleton = $('#rpg_world_progression_btn_generate_skeleton');
        const $wpAddSkeleton = $('#rpg_world_progression_btn_add_skeleton');
        const $wpSkeletonStatus = $('#rpg_world_progression_skeleton_status');

        /** Refreshes the skeleton entry count label from the _Skeleton lorebook. */
        async function updateSkeletonStatus() {
            const ctx = SillyTavern.getContext();
            const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
            const skeletonBookName = prefix ? `${prefix}_Skeleton` : 'World_Skeleton';
            try {
                const book = await ctx.loadWorldInfo(skeletonBookName);
                const entries = book?.entries ? Object.values(book.entries) : [];
                const count = entries.length;

                // Per-category counts for pool display
                const npcCount = entries.filter(e => e.extensions?.rpgCategory === 'NPC').length;
                const locCount = entries.filter(e => e.extensions?.rpgCategory === 'LOC').length;
                const facCount = entries.filter(e => e.extensions?.rpgCategory === 'FAC').length;

                $wpSkeletonStatus.text(count > 0
                    ? `${count} skeleton entries in "${skeletonBookName}" (NPC: ${npcCount}, LOC: ${locCount}, FAC: ${facCount})`
                    : 'No skeleton generated.');

                // Update pool-count spans in the Focus Randomization section
                $('#rpg_world_progression_skeleton_npc_pool_count').text(npcCount);
                $('#rpg_world_progression_skeleton_location_pool_count').text(locCount);
                $('#rpg_world_progression_skeleton_faction_pool_count').text(facCount);
            } catch (_) {
                $wpSkeletonStatus.text('No skeleton generated.');
                $('#rpg_world_progression_skeleton_npc_pool_count').text('0');
                $('#rpg_world_progression_skeleton_location_pool_count').text('0');
                $('#rpg_world_progression_skeleton_faction_pool_count').text('0');
            }
        }


        $wpSkeletonAtmosphere.val(settings.worldProgressionSkeletonAtmosphereSummary || '').on('input', function () {
            getSettings().worldProgressionSkeletonAtmosphereSummary = String($(this).val() || '');
            saveSettings();
        });

        $wpSkeletonAtmosphereLookback.val(settings.worldProgressionSkeletonAtmosphereLookback ?? 30).on('input', function () {
            getSettings().worldProgressionSkeletonAtmosphereLookback = parseInt(String($(this).val() || '')) || 30;
            saveSettings();
        });

        $wpSkeletonUseExisting.prop('checked', !!settings.worldProgressionSkeletonUseExisting).on('change', function () {
            getSettings().worldProgressionSkeletonUseExisting = !!$(this).prop('checked');
            saveSettings();
        });

        $wpGenerateAtmosphere.on('click', async function () {
            const ctx = SillyTavern.getContext();
            if (!ctx.chat || ctx.chat.length === 0) {
                toastr['warning']('No chat history available. Please type some messages first.', 'World Skeleton');
                return;
            }
            const lookback = parseInt(String($wpSkeletonAtmosphereLookback.val() || '')) || 30;
            $wpGenerateAtmosphere.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Generating…');
            try {
                const { runAtmosphereGenerationPass } = await import('./router.js');
                const summary = await runAtmosphereGenerationPass(lookback);
                getSettings().worldProgressionSkeletonAtmosphereSummary = summary;
                $wpSkeletonAtmosphere.val(summary);
                saveSettings();
                toastr['success']('Atmosphere Summary auto-generated successfully.', 'World Skeleton');
            } catch (e) {
                toastr['error'](`Failed to generate Atmosphere Summary: ${e.message}`, 'World Skeleton');
            } finally {
                $wpGenerateAtmosphere.prop('disabled', false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Generate');
            }
        });

        $wpSkeletonFactions.val(settings.worldProgressionSkeletonFactions ?? 4).on('input', function () {
            getSettings().worldProgressionSkeletonFactions = parseInt(String($(this).val() || '')) || 4;
            saveSettings();
        });

        $wpSkeletonLocations.val(settings.worldProgressionSkeletonLocations ?? 4).on('input', function () {
            getSettings().worldProgressionSkeletonLocations = parseInt(String($(this).val() || '')) || 4;
            saveSettings();
        });

        $wpSkeletonNPCs.val(settings.worldProgressionSkeletonNPCs ?? 0).on('input', function () {
            getSettings().worldProgressionSkeletonNPCs = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpSkeletonConflicts.val(settings.worldProgressionSkeletonConflicts ?? 3).on('input', function () {
            getSettings().worldProgressionSkeletonConflicts = parseInt(String($(this).val() || '')) || 3;
            saveSettings();
        });

        $wpSkeletonPrompt.val(settings.worldProgressionSkeletonSystemPrompt || '').on('input', function () {
            getSettings().worldProgressionSkeletonSystemPrompt = String($(this).val() || '');
            saveSettings();
        });

        $wpResetSkeletonPrompt.on('click', function () {
            if (!confirm('Reset World Skeleton system prompt to default?')) return;
            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;
            }
            const freshDefault = getSettings().worldProgressionSkeletonSystemPrompt;
            getSettings().worldProgressionSkeletonSystemPrompt = freshDefault;
            $wpSkeletonPrompt.val(freshDefault);
            saveSettings();
            toastr['success']('World Skeleton prompt reset to default.', 'World Skeleton');
        });

        $wpGenerateSkeleton.on('click', async function () {
            const atmosphere = String($wpSkeletonAtmosphere.val() || '').trim();
            if (!atmosphere) {
                toastr['warning']('Please enter an atmosphere summary before generating.', 'World Skeleton');
                return;
            }
            const ctx = SillyTavern.getContext();
            const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
            if (!prefix) {
                toastr['warning']('No campaign prefix set. Set a prefix or open a chat in SillyTavern first.', 'World Skeleton');
                return;
            }
            $wpGenerateSkeleton.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Generating…');
            try {
                const { runSkeletonGenerationPass } = await import('./router.js');
                const count = await runSkeletonGenerationPass(atmosphere, false);
                await updateSkeletonStatus();
                toastr['success'](`World Skeleton generated: ${count} entries created.`, 'World Skeleton');
            } catch (e) {
                toastr['error'](`World Skeleton error: ${e.message}`, 'World Skeleton');
            } finally {
                $wpGenerateSkeleton.prop('disabled', false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Skeleton');
            }
        });

        $wpAddSkeleton.on('click', async function () {
            const atmosphere = String($wpSkeletonAtmosphere.val() || '').trim();
            const useExisting = !!$wpSkeletonUseExisting.prop('checked');
            if (!useExisting && !atmosphere) {
                toastr['warning']('Please enter an atmosphere summary to provide context if not using existing entries.', 'World Skeleton');
                return;
            }
            const ctx = SillyTavern.getContext();
            const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
            if (!prefix) {
                toastr['warning']('No campaign prefix set. Set a prefix or open a chat in SillyTavern first.', 'World Skeleton');
                return;
            }
            $wpAddSkeleton.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Adding…');
            try {
                const { runSkeletonGenerationPass } = await import('./router.js');
                const count = await runSkeletonGenerationPass(atmosphere, true, useExisting);
                await updateSkeletonStatus();
                toastr['success'](`World Skeleton updated: ${count} additional entries added.`, 'World Skeleton');
            } catch (e) {
                toastr['error'](`World Skeleton error: ${e.message}`, 'World Skeleton');
            } finally {
                $wpAddSkeleton.prop('disabled', false).html('<i class="fa-solid fa-plus"></i> Add to Skeleton');
            }
        });

        // Populate status on load
        updateSkeletonStatus();
        // Expose globally so router.js auto-generation can trigger a UI refresh
        globalThis._rpgUpdateSkeletonStatus = updateSkeletonStatus;
        // ── End World Progression settings ─────────────────────────────────────


        // Custom Sysprompt Mode toggle
        const customSyspromptCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_custom_sysprompt'));
        const narratorConfigBlock = document.getElementById('rpg_narrator_config_block');
        const syncNarratorBlockVisibility = () => {
            if (narratorConfigBlock) narratorConfigBlock.style.display = customSyspromptCb?.checked ? 'none' : '';
        };
        if (customSyspromptCb) {
            customSyspromptCb.checked = !!getSettings().customSysprompt;
            syncNarratorBlockVisibility();
            customSyspromptCb.addEventListener('change', function () {
                const fresh = getSettings();
                fresh.customSysprompt = !!this.checked;
                saveSettings();
                syncNarratorBlockVisibility();
                if (!fresh.customSysprompt) {
                    autoApplySysprompt();
                }
            });
        }

        $('#rpg_tracker_btn_update').on('click', async function () {
            const { chat } = SillyTavern.getContext();
            if (!chat || chat.length === 0) return toastr['info']("No chat history found.", "RPG Tracker");

            let lastAssistantMsg = "";
            for (let i = chat.length - 1; i >= 0; i--) {
                // Look for any message that isn't the user and isn't empty.
                // We include 'system' messages because some Narrator extensions/prompts
                // might mark their output as system, and we still want to track state from them.
                if (!chat[i].is_user && chat[i].mes && chat[i].mes.trim()) {
                    lastAssistantMsg = chat[i].mes;
                    break;
                }
            }
            if (!lastAssistantMsg) return toastr['info']("No assistant message with content found.", "RPG Tracker");

            toastr['info']("Triggering manual State Update...", "RPG Tracker");
            await runStateModelPass(lastAssistantMsg);
        });

        $('#rpg_tracker_btn_clear').on('click', function () {
            if (confirm("Are you sure you want to clear the memory history and wipe the tracker?")) {
                settings.currentMemo = "";
                settings.prevMemo1 = "";
                settings.prevMemo2 = "";
                settings.memoHistory = [];
                settings.lastDelta = "";
                settings.quests = [];
                settings.historyIndex = -1;
                runtimeState.historyViewIndex = -1;
                saveSettings();
                if (settings.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
                updateUIMemo("");
                refreshRenderedView();
                const dp = document.getElementById('rpg-tracker-delta-content');
                if (dp) dp.innerHTML = '<span class="delta-empty">Log cleared.</span>';
                toastr['success']("RPG Tracker logic wiped.", "RPG Tracker");
            }
        });

        $('#rpg_tracker_btn_force_checkpoint').on('click', async function () {
            const btn = /** @type {HTMLButtonElement} */ (this);
            if (btn.disabled) return;
            const prevHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Writing checkpoint…';
            try {
                await forceDiskCheckpoint();
                toastr['success']('Disk checkpoint written. Future rollbacks should land on this state.', 'RPG Tracker');
            } catch (err) {
                console.error('[RPG Tracker] Force disk checkpoint failed:', err);
                toastr['error'](`Checkpoint failed: ${err?.message || err}. Keep this tab open and try again.`, 'RPG Tracker');
            } finally {
                btn.disabled = false;
                btn.innerHTML = prevHtml;
            }
        });

        $('#rpg_tracker_btn_factory_reset').on('click', async function () {
            if (!confirm("⚠️ NUCLEAR OPTION ⚠️\n\nThis will wipe EVERYTHING and restore factory defaults:\n\n• All custom fields, game systems, and saved cartridges\n• All profiles and per-chat linked state (memos, portraits, location images)\n• All custom portraits and location scene art files\n• All prompt and configuration changes\n\nYour SillyTavern Quick Prompt Main box is not changed. Proceed?")) return;

            setPortraitMigrationLocked(true);
            try {
                const { extensionSettings } = SillyTavern.getContext();
                await purgeAllPortraitData(getSettings());
                clearExtensionLocalStorageUiState();
                applyFactoryReset(extensionSettings);
                getSettings();
                updateUIMemo('');
                resetAutoGenerationTracking();
                resetImmersionSceneArtTracking();
                await saveSettings(true);
                toastr['success']('Framework reset to factory defaults. Reloading in 2 seconds…', 'RPG Tracker');
                setTimeout(() => location.reload(), 2000);
            } catch (err) {
                console.error('[RPG Tracker] Factory reset failed:', err);
                toastr['error'](`Factory reset failed: ${err.message || err}`, 'RPG Tracker');
                setPortraitMigrationLocked(false);
            }
        });

        // ── Profile System ──
        refreshProfileDropdown();

        $('#rpg_tracker_profile_save').on('click', function () {
            const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_profile_select'));
            const name = sel.value;
            if (!name) return toastr['info']('No profile selected to overwrite. Use "Save As" for new profiles.', 'RPG Tracker');
            saveProfile(name);
            toastr['success'](`Profile "${name}" overwritten.`, 'RPG Tracker');
        });

        $('#rpg_tracker_profile_save_as').on('click', async function () {
            const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_profile_select'));
            const existing = sel.value;
            const { Popup } = SillyTavern.getContext();

            let name = null;
            if (Popup && Popup.show && Popup.show.input) {
                name = await Popup.show.input('Save Profile', 'Save profile as:', existing || '');
            } else {
                name = prompt('Save profile as:', existing || '');
            }

            name = name?.trim();
            if (!name) return;
            saveProfile(name);
            refreshProfileDropdown();
            toastr['success'](`Profile "${name}" saved.`, 'RPG Tracker');
        });

        $('#rpg_tracker_profile_load').on('click', function () {
            const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_profile_select'));
            const name = sel.value;
            if (!name) return toastr['info']('No profile selected.', 'RPG Tracker');
            loadProfile(name);
            toastr['success'](`Profile "${name}" loaded.`, 'RPG Tracker');
        });

        $('#rpg_tracker_profile_delete').on('click', async function () {
            const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_profile_select'));
            const name = sel.value;
            if (!name) return toastr['info']('No profile selected.', 'RPG Tracker');

            const { Popup, POPUP_RESULT } = SillyTavern.getContext();
            if (Popup && Popup.show && Popup.show.confirm) {
                const confirmResult = await Popup.show.confirm('Delete Profile', `Delete profile "${name}"?`);
                if (confirmResult !== POPUP_RESULT.AFFIRMATIVE) return;
            } else {
                if (!confirm(`Delete profile "${name}"?`)) return;
            }

            deleteProfile(name);
            refreshProfileDropdown();
            toastr['success'](`Profile "${name}" deleted.`, 'RPG Tracker');
        });

        function syncRngToolsUi(s) {
            $('#rpg_rng_tool_d20').prop('checked', !!s.rngToolD20);
            $('#rpg_rng_tool_d100').prop('checked', !!s.rngToolD100);
            $('#rpg_rng_queue_d20').prop('checked', !!s.rngQueueD20);
            $('#rpg_rng_queue_d100').prop('checked', !!s.rngQueueD100);
        }

        function updateD100ToggleState(s) {
            const hasD100 = !!(s.rngToolD100 || s.rngQueueD100);
            s.diceD100Mode = hasD100;
            $('#rpg_tracker_dice_d100_mode').prop('checked', hasD100);
        }

        function autoSelectRngToolsFromMode(s) {
            if (!s.rngEnabled) {
                s.rngToolD20 = false;
                s.rngToolD100 = false;
                s.rngQueueD20 = false;
                s.rngQueueD100 = false;
            } else if (s.diceFunctionTool === false) {
                if (s.diceD100Mode) {
                    s.rngToolD20 = false;
                    s.rngToolD100 = false;
                    s.rngQueueD20 = false;
                    s.rngQueueD100 = true;
                } else {
                    s.rngToolD20 = false;
                    s.rngToolD100 = false;
                    s.rngQueueD20 = true;
                    s.rngQueueD100 = false;
                }
            } else {
                if (s.diceD100Mode) {
                    s.rngToolD20 = false;
                    s.rngToolD100 = true;
                    s.rngQueueD20 = false;
                    s.rngQueueD100 = true;
                } else {
                    s.rngToolD20 = true;
                    s.rngToolD100 = false;
                    s.rngQueueD20 = true;
                    s.rngQueueD100 = false;
                }
            }
            syncRngToolsUi(s);
        }

        function syncSettingsUi() {
            const s = getSettings();

            // RNG toggles
            let currentRngMode = 'hybrid';
            if (!s.rngEnabled) {
                currentRngMode = 'none';
            } else if (s.diceFunctionTool === false) {
                currentRngMode = 'legacy';
            }
            $(`input[name="rpg_sysprompt_rng_mode"][value="${currentRngMode}"]`).prop('checked', true);
            syncRngToolsUi(s);
            const narrativePacing = ['normal', 'high_agency', 'downtime'].includes(s.narrativePacing)
                ? s.narrativePacing
                : 'normal';
            $(`input[name="rpg_narrative_pacing"][value="${narrativePacing}"]`).prop('checked', true);

            // General toggles
            $('#rpg_tracker_enabled').prop('checked', !!s.enabled);
            $('#rpg_tracker_chat_link_enabled').prop('checked', !!s.chatLinkEnabled);
            $('#rpg_tracker_debug').prop('checked', !!s.debugMode);
            $('#rpg_tracker_daynight_cycle').prop('checked', !!s.dayNightCycleEnabled);
            if (typeof globalThis._rpgSyncPanelBgSettingsUi === 'function') {
                globalThis._rpgSyncPanelBgSettingsUi();
            } else {
                applyPanelBackgroundToDom();
            }
            $('#rpg_tracker_auto_reset_prompts').prop('checked', !!s.autoResetPromptsOnUpdate);
            $('#rpg_main_sysprompt_backup_enabled').prop('checked', isMainSyspromptBackupEnabled(s));
            syncMainSyspromptBackupControlsUi();
            $('#rpg_tracker_legacy_dice').prop('checked', !!s.legacyDiceNaming);
            $('#rpg_tracker_dice_d100_mode').prop('checked', !!s.diceD100Mode);
            $('#rpg_tracker_enable_portraits').prop('checked', s.enablePortraits !== false);
            $('#rpg_portrait_generator_source').val(s.portraitGeneratorSource || 'native');
            $('#rpg_tracker_pollinations_group').toggle((s.portraitGeneratorSource || 'native') === 'pollinations');
            $('#rpg_tracker_portrait_skip_prompt').prop('checked', !!s.portraitSkipPromptDialog);
    $('#rpg_tracker_hide_image_gen_toasts').prop('checked', !!s.hideImageGenToasts);
            $('#rpg_tracker_portrait_auto_party').prop('checked', !!s.portraitAutoGenerateParty);
            $('#rpg_tracker_portrait_auto_player').prop('checked', !!s.portraitAutoGeneratePlayer);
            $('#rpg_tracker_portrait_auto_enemies').prop('checked', !!s.portraitAutoGenerateEnemies);
            $('#rpg_tracker_portrait_auto_npcs').prop('checked', !!s.portraitAutoGenerateNpcs);
            $('#rpg_tracker_portrait_auto_locations').prop('checked', !!s.portraitAutoGenerateLocations);
            $('#rpg_tracker_portrait_auto_scene_view').prop('checked', !!s.portraitAutoGenerateSceneView);
            $('#rpg_tracker_location_images').prop('checked', !!s.locationImages);
            syncLocationImageDependentUi(s);
            syncNpcPortraitDependentUi(s);
            $('#rpg_tracker_pollinations_key').val(s.pollinationsApiKey || '');

            $('#rpg_portrait_connection_source').val(s.portraitConnectionSource || 'default');
            $('#rpg_portrait_connection_profile').val(s.portraitConnectionProfileId || '');
            $('#rpg_portrait_completion_preset').val(s.portraitCompletionPresetId || '');
            $('#rpg_portrait_ollama_url').val(s.portraitOllamaUrl || 'http://localhost:11434');
            $('#rpg_portrait_ollama_model').val(s.portraitOllamaModel || '');
            $('#rpg_portrait_openai_url').val(s.portraitOpenaiUrl || '');
            $('#rpg_portrait_openai_key').val(s.portraitOpenaiKey || '');
            $('#rpg_portrait_openai_model').val(s.portraitOpenaiModel || '');
            $('#rpg_portrait_openai_model_manual').val(s.portraitOpenaiModel || '');
            $('#rpg_portrait_profile_group').toggle(s.portraitConnectionSource === 'profile');
            $('#rpg_portrait_ollama_group').toggle(s.portraitConnectionSource === 'ollama');
            $('#rpg_portrait_openai_group').toggle(s.portraitConnectionSource === 'openai');
            $('#rpg_portrait_location_include_present_npcs').prop('checked', !!s.portraitLocationIncludePresentNpcs);
            $('#rpg_portrait_location_system_prompt').val(s.portraitLocationSystemPrompt || getDefaultPortraitLocationSystemPrompt(!!s.portraitLocationIncludePresentNpcs));

            // Inventory/Core Prompt
            $('#rpg_tracker_inventory_worth_mode').val(s.inventoryWorthMode || 'hover');
            $('#rpg_tracker_show_total_value').prop('checked', s.showTotalInventoryValue !== false);
            $('#rpg_tracker_core_prompt').val(s.systemPromptTemplate || '');
            $('#rpg_tracker_user_prompt_suffix').val(s.userPromptSuffix || '');

            // Router Agent
            $('#rpg_tracker_router_enabled').prop('checked', !!s.routerEnabled);
            const inPanelCheck = (document.getElementById('rt-agent-router-enable'));
            if (inPanelCheck) inPanelCheck.checked = !!s.routerEnabled;
            const ap = document.getElementById('rpg-tracker-agent');
            if (ap) {
                if (s.routerEnabled) ap.classList.remove('is-agent-disabled');
                else ap.classList.add('is-agent-disabled');
            }
            $('#rpg_tracker_router_basic_mode').prop('checked', !!s.routerBasicMode);
            $('#rt-agent-router-basic').prop('checked', !!s.routerBasicMode);
            $('#rpg_tracker_router_native_keyword_activation').prop('checked', !!s.routerNativeKeywordActivation);
            $('#rt-agent-router-native-kw').prop('checked', !!s.routerNativeKeywordActivation);
            $('#rpg_tracker_router_include_hidden').prop('checked', !!s.routerIncludeHidden);
            $('#rt-agent-router-include-hidden').prop('checked', !!s.routerIncludeHidden);
            $('#rpg_tracker_router_swipe_rollback').prop('checked', s.routerSwipeRollback !== false);
            $('#rt-agent-router-swipe-rollback').prop('checked', s.routerSwipeRollback !== false);

            $('#rpg_tracker_router_source').val(s.routerConnectionSource || 'default');
            updateRouterConnectionPanels();
            updateSettingsLorePrefixReadout();
            $('#rpg_tracker_router_prefix_override').val(s.routerCampaignPrefixOverride || '');
            $('#rpg_tracker_router_connection_profile').val(s.routerConnectionProfileId || '');
            $('#rpg_tracker_router_completion_preset').val(s.routerCompletionPresetId || '');

            // NPC Relationship & Time Settings
            $('#rpg_tracker_npc_portraits').prop('checked', s.npcPortraits !== false);
            $('#rpg_tracker_npc_rel_bars').prop('checked', !!s.npcRelationshipBars);
            $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!s.npcRelationshipBars);
            $('#rpg_tracker_npc_card_import').prop('checked', !!s.experimentalNpcImport);
            $('#rpg_tracker_ignore_npc_limits').prop('checked', !!s.ignoreNpcImportLimits);

            // World Progression
            $('#rpg_world_progression_enabled').prop('checked', !!s.worldProgressionEnabled);
            $('#rpg_world_progression_randomize_npcs').prop('checked', !!s.worldProgressionRandomizeNPCs);
            $('#rpg_world_progression_randomize_locations').prop('checked', !!s.worldProgressionRandomizeLocations);
            $('#rpg_world_progression_randomize_factions').prop('checked', !!s.worldProgressionRandomizeFactions);
            $('#rpg_world_progression_skeleton_use_existing').prop('checked', !!s.worldProgressionSkeletonUseExisting);
            $('#rpg_world_progression_consolidate_enabled').prop('checked', !!s.worldProgressionConsolidateEnabled);

            // Textareas (Agent prompt templates)
            $('#rpg_tracker_router_prompt').val(s.routerSystemPromptTemplate || '');
            $('#rpg_tracker_router_modular_prompt').val(s.routerModularPromptTemplate || '');
            $('#rpg_world_progression_system_prompt').val(s.worldProgressionSystemPrompt || '');
            $('#rpg_world_progression_skeleton_system_prompt').val(s.worldProgressionSkeletonSystemPrompt || '');

            // Refresh Agent modules & custom tags list in the UI if present
            if (typeof globalThis._rpgRenderAgentModules === 'function') {
                globalThis._rpgRenderAgentModules();
            }
            if (typeof globalThis._rpgRenderAgentCustomTags === 'function') {
                globalThis._rpgRenderAgentCustomTags();
            }
            // Cartridges can replace the CYOA setup, including its visual theme.
            // Rebuild the live style block so loaded button colours apply immediately.
            updateCyoaStyle();
        }
        globalThis._rpgSyncSettingsUi = syncSettingsUi;

    } catch (e) {
        console.error("[RPG Tracker] Failed to build settings UI", e);
    }

    // Fresh installs default to tracker on — schedule first apply so Main is stashed then overwritten.
    {
        const s = getSettings();
        if (s.enabled && !s.customSysprompt) scheduleAutoApply();
    }

    // Add wand button to toggle panel visibility
    addWandButton();

    function updateTrackerFontSize(size) {
        const panel = document.getElementById('rpg-tracker-panel');
        if (!panel) return;
        const s = size || getSettings().fontSize || 13;
        panel.style.setProperty('--rt-base-size', s + 'px');

        // Also update CFE preview if open
        const cfe = document.getElementById('rt_cfe_preview');
        if (cfe) cfe.style.setProperty('--rt-base-size', s + 'px');
    }

    function updateAgentFontSize(size) {
        const s = size || getSettings().agentFontSize || 13;
        // Agent may be embedded in the main panel or detached to body
        for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#rpg-tracker-agent'))) {
            el.style.setProperty('--rt-base-size', s + 'px');
        }
    }

    function addWandButton() {
        const wandContainer = document.getElementById('extensionsMenu');
        if (!wandContainer) return;

        const btn = document.createElement('div');
        btn.id = 'toggle_rpg_tracker_wand_button';
        btn.classList.add('list-group-item', 'flex-container', 'flexGap5');

        btn.innerHTML = `
            <div class="fa-solid fa-clipboard-list extensionsMenuExtensionButton"></div>
            <span>Multihog D&D Framework</span>
        `;

        btn.addEventListener('click', () => {
            const panel = document.getElementById('rpg-tracker-panel');
            if (panel) {
                const isHidden = panel.style.display === 'none';
                panel.style.display = isHidden ? 'flex' : 'none';
                localStorage.setItem('rpg_tracker_visible', isHidden ? 'true' : 'false');
            }
        });

        wandContainer.appendChild(btn);
    }

    // ── Debug harness (safe to leave in — only runs when called manually) ──
    // Usage from DevTools console:
    //   window.rpgDebug.testCleanToolCall(someMessage)
    //   window.rpgDebug.testCleanToolCall()   <- uses last assistant message from chat
    const _dbgWin = /** @type {any} */ (window);
    _dbgWin.rpgDebug = _dbgWin.rpgDebug || {};
    _dbgWin.rpgDebug.testCleanToolCall = function (text) {
        if (text === undefined) {
            // Auto-grab the last non-user message from the current chat
            const { chat } = SillyTavern.getContext();
            const last = chat && [...chat].reverse().find(m => !m.is_user && m['role'] !== 'user');
            text = last ? (last.mes || last['content'] || '') : '';
            if (!text) { console.warn('[rpgDebug] No assistant message found in chat.'); return; }
        }
        const result = cleanToolCallMessage(text);
        const saved = text.length - result.length;
        console.group('%c[rpgDebug] cleanToolCallMessage', 'font-weight:bold;color:#7c4dff');
        console.log('%cINPUT  (%d chars)', 'color:#aaa', text.length, text);
        console.log('%cOUTPUT (%d chars)', 'color:#4caf50', result.length, result);
        console.log(
            saved > 0
                ? `%c✅ Stripped ${saved} chars (~${Math.round(saved / 4)} tokens)`
                : '%c⚠️  Nothing stripped — not a tool-call JSON (original returned unchanged)',
            `font-weight:bold;color:${saved > 0 ? '#4caf50' : '#f44336'}`
        );
        console.groupEnd();
        return result;
    };

})();

/**
 * Renders the debug info into the Agent panel's debug drawer.
 */

