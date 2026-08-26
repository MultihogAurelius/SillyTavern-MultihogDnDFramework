import { EXAMPLES, COLOR_EXAMPLES, DEFAULT_STOCK_PROMPTS, RT_PROMPTS, BLOCK_ICONS, BLOCK_ORDER, PAGE_SIZE, NO_PAGINATE, buildOnboardingXpHint, buildOnboardingTimeHint, buildStartingGearHint, buildOnboardingActiveBlocks, buildCombatAndSkillScalingHint, resolveTimePromptKey, resolveTimePromptDisplayTag, buildCyoaPrompt, DEFAULT_CYOA_SLOTS, refreshCyoaConfigToShipped, formatTimeOfDay } from './constants.js';
import { MODULE_NAME, DEFAULT_MODULES, MODULE_BOOK_CATEGORY, FULL_REVIEW_STATE_SYSTEM_PROMPT, FULL_REVIEW_USER_PROMPT_SUFFIX, getSettings, getBarBackground, migrateCustomFields, saveChatState, getActiveChatId, shouldPreserveLiveChatStateOnBoot, writeModuleSchemaBackup, getPendingModuleSchemaBackup, applyModuleSchemaBackup, applyDeletedCustomTagTombstones, recordDeletedCustomTags, clearDeletedCustomTagTombstones, saveProfile, deleteProfile, getEffectiveRouterCampaignPrefix, sanitizeCampaignPrefixString, buildNpcInstruction, LOREBOOK_FULL_AUDIT_INSTRUCTION, loadStockPromptsFromProfile, getNpcRelationshipMax, getNpcRelationshipMaxDefault, clampRelationshipValue, relationshipBarPct, getFriendshipTier, getAffectionTier, getRelTierBadgeStyle, getRelTierDetailedStyle, getRelTierDetailedLabelStyle, applyRelTierBadgeElement, sanitizeRouterState, rebuildAllModuleInstructions, adjustAllStoredTemplatesForTimeFormat, DEFAULT_NPC_SECTIONS, DEFAULT_PC_SECTIONS, computeBundledPromptsFingerprint, computeBundledPromptsFingerprintForSnapshot, normalizeBundledPromptsSnapshot, buildBundledPromptsSnapshot, getSnapshotCategoryBlocks, getPromptCategoryImpactBadge, PROMPT_DEFAULTS_CATEGORIES, PROMPT_DEFAULTS_CATEGORY_LABELS, getDefaultPortraitLocationSystemPrompt, getDefaultPortraitNpcSystemPrompt, getDefaultPortraitCharacterSystemPrompt, isShippedPortraitLocationSystemPrompt, findShippedPortraitLocationPresetId, FACTORY_PORTRAIT_PROMPT_PRESETS, resolveFactoryPortraitPromptBundle, getFactoryPortraitPromptPresetNameSet, DEFAULT_PORTRAIT_PROMPT_PRESET_ID, applyFactoryReset, clearExtensionLocalStorageUiState, stripChatStateGlobalUiPrefs, buildStateTrackerRelationshipCommandInstruction, extractStateTrackerRelationshipCommands, getRelationshipUpdateMode, RELATIONSHIP_UPDATE_MODES, resetLorebookPromptTemplates, writeCriticalSettingsBackup, stampCriticalSettingsSynced, applyCriticalSettingsBackup, isMainSyspromptBackupEnabled, captureMainSyspromptBackup, restoreMainSyspromptStash, hydrateMainSyspromptBackup, getEffectiveBackupText, getLiveMainSyspromptText, setLiveMainSyspromptText, maybeRestoreMainIfTrackerDisabled, isMainSyspromptSourceReady } from './state-manager.js';
import { snapshotChatSetup, chatSetupsMatch, syncChatSetupCatalogs, removeChatSetupCatalogEntries, clearChatBoundActivations } from './src/state/chat-setup.js';
import { buildDirectPromptSystemPrompt, DIRECT_PROMPT_SYSTEM_MODES } from './src/state/direct-prompt-system.js';
import { diffTextLines, diffHasChanges } from './prompt-diff.js';
import { sendStateRequest, fetchOllamaModels, fetchOpenAIModels, testOpenAIConnection, getConnectionProfiles, getCurrentCompletionPreset, setCompletionPreset, syncCombatProfile, resetCombatProfileOverride, isCombatActive } from './llm-client.js';
import { getDiceToolName, getDiceCommandName, getDiceCommandAliases, doDiceRoll, registerDiceFunctionTool, syncLocationMappingRuntime, syncDiceFunctionToolForRngContext, registerDiceSlashCommand, installInterceptor, getNarrativeBlocks, onGenerationStarted, onGenerationEnded, onMapArchitectAssistantMessage, handleRelationshipSwipeChange, applyStateTrackerRelationshipCommands, resetRouterTick, getRouterTick, getMapUpdaterTick, resetRouterAutoTick, getRouterSchedulerInternals, makeRngQueue, buildRngBlock, RNG_QUEUE_LEN } from './narrative-hooks.js';
import { deduplicateMemo, mergeMemo, computeDelta, escapeHtml, escapeRegex, highlightParens, cleanToolCallMessage, cleanMessageContent, getLastUserAction, buildLorebookContext, buildModulesInstructionText, buildModuleFormatInstruction, parseQuestsFromMemo, syncQuestsFromMemo, syncQuestsToMemo, writeQuestsToMemo, getQuestMood, extractCurrentTimeStr, stripArchivedQuestsFromMemo, stripCompletedQuestsFromMemo, applyQuestSyncAndStripMemo, isArchivedQuestStatus, removeArchivedQuest, parseInWorldTime, formatInWorldTime, sanitizeLorebookRecordContent, memoForTrackerContext, memoForGmContext } from './memo-processor.js';
import { renderSubFieldByRule, tryRenderMarker, renderCustomBlockLine, stripMemoHtml, escapeHtmlWithColor, parseMemoBlocks, getPageSize, loadCollapsed, saveCollapsed, loadDetached, saveDetached, blockToItems, renderMemoAsCards, renderTabModeView, renderBottomXpBar, renderQuestLog, renderLorebookTerminal, loadActiveTab, saveActiveTab, getTimeOfDayInfo, renderDayNightBadge, MARKER_TYPE_MAP, getMarkerLibraryKeys, loadBenchedExpanded, saveBenchedExpanded } from './renderer.js';
import { unregisterLogQuestTool, checkQuestDeadlines, renderQuestsAsPlainText } from './quests.js';
import { initializeDebugViewer, toggleDebugViewer } from './debug-viewer.js';
import { installSwipeSchedulerDebug } from './swipe-scheduler-debug.js';
import { inferMapArchitectArgs, runMapArchitect } from './map-architect.js';
import { runRouterPass, rollbackRouterPass, reapplyRouterPass, captureRouterLoreState, captureActiveDungeonMapHistory, restoreActiveDungeonMapHistory, getLorebookManifest, deleteLorebookEntry, deleteDungeonMapFromLocationEntry, updateLorebookEntry, disableManagedEntries, isRouterRunning, stopRouterPass, purgeWorldHistoryForChat, setLorebookEntryPinned, rememberCampaignBook, updateWorldInfoCache } from './router.js';
import { isMapUpdaterRunning, onMapUpdaterUserMessage, runMapUpdaterPass, stopMapUpdaterPass } from './map-updater.js';
import { isMapEvolutionRunning, listMappedEvolutionSites, loadMappedEvolutionSite, runMapEvolutionPass, stopMapEvolutionPass } from './map-evolution.js';
import { summarizeMapEvolutionSchedule, stampEvolutionLastFired, evolutionIntervalHoursForSettings, setSiteEvolutionIntervalOverride, getSiteEvolutionIntervalOverride, normalizeMapEvolutionNarratorCommitTokens } from './map-evolution-lib.js';
import { getRequestHeaders } from '../../../../script.js';
import { fileToDataUrl, scaleImageTo512Square, scaleImageToLandscape, applyPortraitData, applyLocationImageData, renamePortraitEntity, reconcileMemoPortraitRenames, generatePortraitPrompt, generateNpcPortraitPrompt, generateLocationImagePrompt, showPortraitPromptPopup, generatePortraitDirect, autoGeneratePartyPortraits, removeAllPortraits, checkAndTriggerAutoGenerations, autoGenerateEnemyPortraits, forceCheckAutoGenerations, resetAutoGenerationTracking, resetRealtimeLocationGenerationFailure, stopRealtimeLocationGeneration, resolveLocationImageWithMeta, normalizeLocationPath, buildLocationPath, getLinkedPlayerCharacter, resolvePortraitSrcForPlayerCharacter, imageGenToast, triggerBackgroundPortraitGeneration } from './portraits.js';
import { buildImmersionSceneState, renderImmersionViewHtml, getCurrentLocationText, loadLocationEntryByPath, loadNpcEntryByKey, maybeAutoGenerateImmersionSceneArt, runRealtimeSceneArtCheck, resetImmersionSceneArtTracking, hydrateImmersionSceneArtPath } from './immersion.js';
import { migrateAllEmbeddedPortraits, countEmbeddedPortraitDataUrls, purgeAllPortraitData, resolvePortraitDisplaySrc, lookupCustomPortraitSrc, collectAllPortraitRefs, isManagedPortraitPath, isPortraitMigrationLocked, setPortraitMigrationLocked, PORTRAIT_STORAGE_FOLDER, snapshotPortraitMapsForChat, loadPortraitMapsForChat, migrateLegacyPortraitMapsToChat } from './portrait-storage.js';
import { loadPanelGeometry, loadDeltaHeight, makeDraggable, makeResizableTR, makeResizableBR, makeResizableBL, setupResizeObserver, setupDeltaResize, canResizePanels, jqueryToggleSlide, resolveViewportClampedGeometry, clampFloatingPanelToViewport } from './ui-geometry.js';
import { applyCustomTheme, openThemeWizard, refreshSavedThemesList, handleRecolor, undoThemeChange } from './theme-manager.js';
import { showCharacterRollPanel, showPcImportPanel, handleCharacterCreatorGenerate, generatePersonaBio, showPersonaConfirmOverlay, extractCharNameFromMemo, activateSillyTavernPersona } from './character-creator.js';
import { createOrSelectGameMasterCard, resolveNarratorCardName } from './src/ui/game-master-card.js';
import { bindCharacterCreationConnectionSettings, getCharacterCreationConnectionSettings } from './character-creation-connection.js';
import { bindQuickStartEvents } from './quickstart.js';
import { bindAdventureCompanion, bindAdventureCompanionSettingsDrawer, openAdventureCompanion, closeAdventureCompanion } from './adventure-companion.js';
import { openDisplayGroupsManager } from './display-groups.js';
import { handleCategorySettings, openCustomFieldEditor, openPromptEditor, refreshOrderList, exportModules, importModulesFromJson, openNpcSectionEditor, openPcSectionEditor } from './ui-editors.js';
import { openGameSystemWizard, openManageGameSystems, openSystemPromptControlRoom, syncAllNarratorTogglesForUnlockState, extractTopLevelSections, normalizeSectionOrder, getSectionRowDescriptor, transformBaseSectionContent, isBlankSectionContent, isSectionUnlocked, isEffectiveSectionEnabled } from './game-systems.js';
import { isCyoaEnabled, isLorebookAgentRuntimeActive, setLocationMappingEnabled, LOCATION_MAPPING_SECTION_TAG } from './src/state/section-enabled.js';
import {
    AGENT_CONNECTION_SETUPS,
    applyConnectionSetupToAll,
    findAgentConnectionSetup,
} from './src/state/connection-setups.js';
import { applyMapArchitectOpenerToUi, normalizeMapArchitectOpener, syncMapArchitectOpenerNestedVisibility } from './map-architect-opener.js';
import { openManageGameCartridges, promptAndSaveCurrentAsCartridge } from './game-cartridges.js';
import {
    deleteNpcFromLibrary,
    exportNpcToFile,
    fetchSrcAsDataUrl,
    importNpcPackages,
    saveNpcToLibrary,
} from './npc-library.js';
import { RENDERING_TAGS_LIBRARY, sectionPages, configureRuntimeActions } from './src/app/runtime-bridge.js';
import { bindRenderedCardEvents } from './src/ui/panel/card-events.js';
import { createDetachedPanel } from './src/ui/panel/detached-panel.js';
import { scalePanelBackgroundImage, getPanelBgConfig, applyPanelBackgroundToDom, applyTrackerThemeToDom, PANEL_BG_TRACKER_KEYS, PANEL_BG_AGENT_KEYS } from './src/ui/panel/panel-appearance.js';
import { createMemoRecoveryManager } from './src/features/recovery/memo-recovery.js';
import { runtimeState } from './src/app/runtime-state.js';
import {
    clearMemoAndMapHistory,
    ensureDungeonMapHistory,
    getDungeonMapHistoryEntry,
    shiftMemoAndMapHistory,
    sliceMemoAndMapHistory,
    unshiftMemoAndMapHistory,
} from './src/state/dungeon-map-history.js';
import { canCommitPassForChat } from './src/state/pass-affinity.js';
import { createPanel as buildPanel } from './src/ui/panel/panel-builder.js';
import { broadcastStateTrackerStep } from './src/ui/panel/agent-terminal.js';
import { createChatStateLoader } from './src/features/chat/chat-state-loader.js';
import { stripDungeonMapSection } from './dungeon-reality.js';
import { cloneCampaignStackToPrefix } from './src/features/chat/clone-campaign-stack.js';
import { branchCampaignChat, isBranchSeedInProgress } from './src/features/chat/branch-campaign.js';
import { onChatRenamedMigrate } from './src/features/chat/chat-rename-migrate.js';
import {
    COMPANION_BY_CHAT_KEY,
    MEMO_RECOVERY_KEY,
    localChatMapHasEntry,
} from './src/features/chat/local-chat-map.js';
import {
    initSettingsOverlay,
    openSettingsOverlay,
    closeSettingsOverlay,
    getSettingsOverlayRoot,
} from './src/ui/settings-overlay.js';
import { installApiSetupGate, showApiSetupGate, syncApiSetupGate } from './src/ui/api-setup-gate.js';
import { restoreEscapedCyoaChoiceMarkup } from './src/ui/panel/cyoa-markup.js';
import { captureXpGainAnimationState, playXpGainAnimation } from './src/ui/panel/xp-gain-animation.js';
import { captureBarChangeAnimationState, playBarChangeAnimations } from './src/ui/panel/bar-change-animation.js';
import { buildCombatDisplayMemo } from './src/state/combat-persistence.js';
import { isRealtimeVisualizationDisabled } from './src/state/realtime-visualization-guard.js';
import { normalizeActivePersonaIdentity } from './src/state/player-identity.js';
import { replacePromptArray, stripSupersededChoicesFromChatPrompt, stripSupersededChoicesFromTextPromptMessages } from './src/features/cyoa-prompt-history.js';
import { DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT } from './map-architect-prompt.js';
import { DEFAULT_MAP_UPDATER_SYSTEM_PROMPT } from './map-updater-prompt.js';
import { DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT } from './map-evolution-prompt.js';
import { DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT } from './map-evolution-compress-prompt.js';
import {
    DEFAULT_MAP_THEME,
    FACTORY_MAP_THEME_PRESETS,
    MAP_THEME_FIELDS,
    applyMapThemeToRoot,
    normalizeMapTheme,
    normalizeSavedMapThemePresets,
    resolveMapThemePreset,
} from './src/state/map-themes.js';

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
globalThis._rpgRefreshAgentManifest = async () => {
    if (!isAgentPanelVisible()) return;
    if (typeof runtimeState.refreshAgentManifest === 'function') await runtimeState.refreshAgentManifest();
};
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
/**
 * Resolve ST macros (e.g. {{user}}, {{char}}) for READ-ONLY display purposes only.
 * Storage (currentMemo, lorebook entry content) must keep macros verbatim so that
 * renaming a persona or character does not silently desync from history text —
 * only the rendered view is substituted.
 */
export function substituteDisplayMacros(text) {
    if (!text) return text;
    try {
        const substituteParams = SillyTavern.getContext()?.substituteParams;
        return typeof substituteParams === 'function' ? substituteParams(text) : text;
    } catch (_) {
        return text;
    }
}

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

function notifyMapEvolutionPassResult(result) {
    const skipped = result?.skipped;
    if (skipped === 'location_mapping_off' || skipped === 'dungeon_reality_off') toastr.warning('Persistent Maps is off.', 'Map Evolution');
    else if (skipped === 'no_maps' || skipped === 'no_active_map' || skipped === 'no_matching_sites' || skipped === 'no_selection') toastr.warning('No mapped site to evolve.', 'Map Evolution');
    else if (skipped === 'disabled') toastr.warning('Map Evolution is disabled.', 'Map Evolution');
    else if (skipped === 'busy') toastr.warning('An agent is already running.', 'Map Evolution');
    else if (skipped === 'stopped') toastr['info']('Stopped.', 'Map Evolution');
    else if (result?.baseline) toastr['info']('Interval baseline stamped. Evolution will fire after the interval elapses.', 'Map Evolution');
    else if (result?.ok && result?.applied === 0) toastr['info']('Nothing durable changed.', 'Map Evolution');
    else if (result?.ok) toastr['success']('Map Evolution applied.', 'Map Evolution');
    else toastr.error('Could not apply a valid evolution update.', 'Map Evolution');
}

function persistMapEvolutionSelectedRootsFromUi() {
    const roots = [];
    $('#rpg_map_evolution_selected_list input[type="checkbox"]:checked').each(function () {
        const root = String($(this).attr('data-site-root') || '').trim();
        if (root) roots.push(root);
    });
    const settings = getSettings();
    settings.mapEvolutionSelectedRoots = roots;
    // This discrete campaign choice must reach disk before an immediate F5 can
    // cancel SillyTavern's normal debounced settings write.
    void saveSettings(true);
    return roots;
}

function persistMapEvolutionIntervalOverrideFromUi(siteRoot, rawValue) {
    const settings = getSettings();
    settings.mapEvolutionIntervalHoursBySite = setSiteEvolutionIntervalOverride(
        settings.mapEvolutionIntervalHoursBySite,
        siteRoot,
        String(rawValue || '').trim(),
    );
    void saveSettings(true);
    if (settings.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
    updateMapEvolutionScheduleDisplay();
}

function syncMapEvolutionTickRows(settings) {
    const scope = settings?.mapEvolutionTickScope || 'all';
    $('#rpg_map_evolution_n_row').toggle(scope === 'count' || scope === 'selected');
    $('#rpg_map_evolution_interval_selected_hint').toggle(scope === 'selected');
}

function formatMapEvolutionCadence(hours) {
    const totalMinutes = Math.max(0, Math.round(Number(hours) * 60));
    if (!totalMinutes) return 'skip';
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return [wholeHours ? `${wholeHours}h` : '', minutes ? `${minutes}m` : ''].filter(Boolean).join(' ');
}

async function refreshMapEvolutionSelectedList() {
    const $list = $('#rpg_map_evolution_selected_list');
    if (!$list.length) return;
    $list.empty();
    let sites = [];
    try {
        sites = await listMappedEvolutionSites();
    } catch (error) {
        console.warn('[RPG Tracker] Failed to list mapped sites for Map Evolution:', error);
    }
    if (!sites.length) {
        $list.append($('<i>').css({ opacity: '0.6', fontSize: '0.85em' }).text('No mapped sites in this chat.'));
        $('#rpg_map_evolution_site_list_header').hide();
        updateMapEvolutionScheduleDisplay();
        return;
    }
    $('#rpg_map_evolution_site_list_header').show();
    const selected = new Set((getSettings().mapEvolutionSelectedRoots || []).map(root => String(root || '').trim().toLowerCase()));
    const settings = getSettings();
    const currentRoot = sites.find(site => site.current)?.siteRoot || '';
    const inheritedFor = evolutionIntervalHoursForSettings({
        ...settings,
        mapEvolutionIntervalHoursBySite: {},
    }, currentRoot);
    const overrides = settings.mapEvolutionIntervalHoursBySite || {};
    for (const site of sites) {
        const $input = $('<input type="checkbox">')
            .attr('data-site-root', site.siteRoot)
            .prop('checked', selected.has(String(site.siteRoot || '').trim().toLowerCase()));
        const label = site.current ? `${site.siteRoot} (current)` : site.siteRoot;
        const inherited = inheritedFor(site.siteRoot);
        const overrideHours = getSiteEvolutionIntervalOverride(overrides, site.siteRoot);
        const hasOverride = overrideHours != null;
        const inheritText = inherited === 0
            ? (site.current ? 'Automatic: skip (current map)' : 'Automatic: skip (other maps)')
            : (site.current ? `Automatic: ${formatMapEvolutionCadence(inherited)} (current map)` : `Automatic: ${formatMapEvolutionCadence(inherited)} (other maps)`);
        const $inherit = $('<div>').css({
            fontSize: '0.75em',
            opacity: hasOverride ? '0.45' : '0.65',
            lineHeight: '1.3',
            marginTop: '2px',
        }).text(hasOverride ? `Override · was ${formatMapEvolutionCadence(inherited)}` : inheritText);
        const $hours = $('<input type="text" inputmode="numeric" pattern="[0-9]*" class="text_pole">')
            .attr({
                'data-site-root': site.siteRoot,
                min: '0',
                max: '168',
                placeholder: '—',
                title: hasOverride
                    ? 'Custom automatic interval for this map. Clear the box to inherit Other maps / Current map again. 0 skips automatic ticks.'
                    : 'Leave blank to inherit Other maps / Current map. Fill only to override this map\'s automatic timer. 0 skips automatic ticks. Independent of the Run now checkbox.',
            })
            .css({ width: '56px', minWidth: '56px', fontSize: '0.85em', textAlign: 'center', boxSizing: 'border-box' })
            .val(hasOverride ? String(overrideHours) : '');
        $hours.on('change', function () {
            persistMapEvolutionIntervalOverrideFromUi(site.siteRoot, String($(this).val() || ''));
            void refreshMapEvolutionSelectedList();
        });
        const $row = $('<div>').css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '4px 0',
        });
        const $name = $('<span>').css({ flex: '1', minWidth: '0' }).append(
            $('<div>').text(label),
            $inherit,
        );
        const $item = $('<label class="checkbox_label">').css({
            fontSize: '0.9em',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            flex: '1',
            minWidth: '0',
            margin: '0',
        }).append($input.css({ marginTop: '2px' }), $name);
        $input.on('change', persistMapEvolutionSelectedRootsFromUi);
        const $interval = $('<div>').css({
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            width: '72px',
            flex: '0 0 72px',
            justifyContent: 'flex-end',
            paddingTop: '1px',
        }).append($hours, $('<span>').css({ fontSize: '0.75em', opacity: '0.55' }).text('h'));
        $row.append($item, $interval);
        $list.append($row);
    }
    updateMapEvolutionScheduleDisplay(currentRoot);
}

function currentMemoMinutes() {
    const s = getSettings();
    const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
    return timeStr ? (parseInWorldTime(timeStr) ?? -1) : -1;
}

function updateMapEvolutionScheduleDisplay(currentRoot = '') {
    const s = getSettings();
    const root = currentRoot || s.mapEvolutionLastSiteRoot || '';
    const schedule = summarizeMapEvolutionSchedule(s.mapEvolutionLastFiredBySite, {
        intervalHours: s.mapEvolutionIntervalHours,
        currentMinutes: currentMemoMinutes(),
        intervalHoursFor: evolutionIntervalHoursForSettings(s, root),
    });
    const lastText = schedule.lastMins >= 0 ? formatInWorldTime(schedule.lastMins) : 'Never';
    $('#rpg_map_evolution_last_fired').text(lastText);
    $('#rpg_map_evolution_last_report_val').text(lastText);
    $('#rpg_map_evolution_next_report_val').text(schedule.nextMins >= 0 ? formatInWorldTime(schedule.nextMins) : '—');
    if (typeof runtimeState.updateAgentMapEvolutionStatusRef === 'function') {
        runtimeState.updateAgentMapEvolutionStatusRef();
    }
}

function applyMapEvolutionTickSettingsToUi(settings) {
    const s = settings || getSettings();
    $('#rpg_map_evolution_tick_scope').val(s.mapEvolutionTickScope || 'all');
    $('#rpg_map_evolution_tick_count').val(s.mapEvolutionTickCount ?? 1);
    $('#rpg_map_evolution_tick_randomize').prop('checked', s.mapEvolutionTickRandomize !== false);
    syncMapEvolutionTickRows(s);
    void refreshMapEvolutionSelectedList();
    updateMapEvolutionScheduleDisplay();
}

runtimeState.updateMapEvolutionScheduleDisplayRef = updateMapEvolutionScheduleDisplay;
runtimeState.refreshTrackerViewRef = () => {
    const s = getSettings();
    updateUIMemo(s.currentMemo);
    refreshRenderedView();
    updateMapEvolutionScheduleDisplay();
};
runtimeState.applyMapEvolutionTickSettingsToUiRef = applyMapEvolutionTickSettingsToUi;
runtimeState.runMapEvolutionPassRef = runMapEvolutionPass;
runtimeState.runMapUpdaterPassRef = runMapUpdaterPass;
runtimeState.loadMappedEvolutionSiteRef = loadMappedEvolutionSite;
runtimeState.isLoreOrMapAgentBusyRef = () => isRouterRunning() || isMapUpdaterRunning() || isMapEvolutionRunning();

function applyMapRuntimeConnectionSettingsToUi(settings) {
    const s = settings || getSettings();
    $('#rpg_map_runtime_connection_source').val(s.mapRuntimeConnectionSource || 'default');
    $('#rpg_map_runtime_connection_profile').val(s.mapRuntimeConnectionProfileId || '');
    $('#rpg_map_runtime_completion_preset').val(s.mapRuntimeCompletionPresetId || '');
    $('#rpg_map_runtime_ollama_url').val(s.mapRuntimeOllamaUrl || 'http://localhost:11434');
    $('#rpg_map_runtime_ollama_model').val(s.mapRuntimeOllamaModel || '');
    $('#rpg_map_runtime_openai_url').val(s.mapRuntimeOpenaiUrl || '');
    $('#rpg_map_runtime_openai_key').val(s.mapRuntimeOpenaiKey || '');
    $('#rpg_map_runtime_openai_model').val(s.mapRuntimeOpenaiModel || '');
    $('#rpg_map_runtime_openai_model_manual').val(s.mapRuntimeOpenaiModel || '');
    $('#rpg_map_runtime_profile_group').toggle(s.mapRuntimeConnectionSource === 'profile');
    $('#rpg_map_runtime_ollama_group').toggle(s.mapRuntimeConnectionSource === 'ollama');
    $('#rpg_map_runtime_openai_group').toggle(s.mapRuntimeConnectionSource === 'openai');
}

/**
 * Push one agent connection setup from settings into its DOM controls.
 * @param {import('./src/state/connection-setups.js').AgentConnectionSetupDef} def
 * @param {Record<string, any>} settings
 */
function applyAgentConnectionSetupToUi(def, settings) {
    if (!def?.ui || !settings) return;
    const sourceVal = String(settings[def.settingsKeys.connectionSource] || 'default');
    const profileVal = String(settings[def.settingsKeys.connectionProfileId] || '');
    const presetVal = String(settings[def.settingsKeys.completionPresetId] || '');
    const ollamaUrl = String(settings[def.settingsKeys.ollamaUrl] || 'http://localhost:11434');
    const ollamaModel = String(settings[def.settingsKeys.ollamaModel] || '');
    const openaiUrl = String(settings[def.settingsKeys.openaiUrl] || '');
    const openaiKey = String(settings[def.settingsKeys.openaiKey] || '');
    const openaiModel = String(settings[def.settingsKeys.openaiModel] || '');

    const ensureSelectValue = (selector, value) => {
        const el = $(selector);
        if (!el.length || !value) {
            el.val(value);
            return;
        }
        if (!el.find(`option[value="${CSS.escape(value)}"]`).length) {
            el.append($('<option></option>').val(value).text(value));
        }
        el.val(value);
    };

    $(def.ui.source).val(sourceVal);
    ensureSelectValue(def.ui.profile, profileVal);
    ensureSelectValue(def.ui.preset, presetVal);
    $(def.ui.ollamaUrl).val(ollamaUrl);
    ensureSelectValue(def.ui.ollamaModel, ollamaModel);
    $(def.ui.openaiUrl).val(openaiUrl);
    $(def.ui.openaiKey).val(openaiKey);
    ensureSelectValue(def.ui.openaiModel, openaiModel);
    $(def.ui.openaiManual).val(openaiModel);

    const setGroupVisible = (selector, visible, useFlex) => {
        const el = document.querySelector(selector);
        if (el instanceof HTMLElement) {
            el.style.display = visible ? (useFlex ? 'flex' : '') : 'none';
            return;
        }
        $(selector).toggle(!!visible);
    };
    setGroupVisible(def.ui.profileGroup, sourceVal === 'profile', false);
    setGroupVisible(def.ui.ollamaGroup, sourceVal === 'ollama', true);
    setGroupVisible(def.ui.openaiGroup, sourceVal === 'openai', true);
}

/** Refresh every agent connection drawer from live settings. */
function syncAllAgentConnectionSetupsToUi(settings) {
    const s = settings || getSettings();
    for (const def of AGENT_CONNECTION_SETUPS) {
        applyAgentConnectionSetupToUi(def, s);
    }
}

function populateConnectionApplyAllSourceSelect() {
    const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('rpg_connection_apply_all_source'));
    if (!select) return;
    const previous = select.value || 'state_tracker';
    select.innerHTML = '';
    for (const def of AGENT_CONNECTION_SETUPS) {
        const option = document.createElement('option');
        option.value = def.key;
        option.textContent = def.label;
        select.appendChild(option);
    }
    select.value = findAgentConnectionSetup(previous) ? previous : 'state_tracker';
}

function bindConnectionApplyAllControls() {
    populateConnectionApplyAllSourceSelect();
    const btn = document.getElementById('rpg_connection_apply_all_btn');
    if (!btn || btn.dataset.rtBound === '1') return;
    btn.dataset.rtBound = '1';
    btn.addEventListener('click', () => {
        const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('rpg_connection_apply_all_source'));
        const sourceKey = String(select?.value || 'state_tracker');
        const settings = getSettings();
        const result = applyConnectionSetupToAll(settings, sourceKey);
        if (!result) {
            toastr['error']('Could not apply that connection setup.', 'Connections & Models');
            return;
        }
        saveSettings();
        syncAllAgentConnectionSetupsToUi(settings);
        toastr['success'](
            `Applied ${result.sourceLabel} connection to ${result.appliedCount} other features.`,
            'Connections & Models',
        );
    });
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
                <li>Saved Skeleton Source for this chat</li>
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
    if (!isLorebookAgentRuntimeActive(s2)) {
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
 * Persistence stays closed while extension bootstrap is projecting the active
 * chat partition into the live top-level settings object. Prompt/version
 * migrations and UI hydration can request saves during that window; writing
 * then can persist a half-bootstrapped or transient unseen-chat reset.
 */
let _settingsPersistenceGateOpen = false;
let _startupSavePending = false;
let _startupSavePendingForce = false;
/** Core settings and a real chat projection must both be stable before writes resume. */
let _startupCoreSettingsReady = false;
let _startupChatProjectionReady = false;
let _attemptStartupPersistenceRelease = () => {};

/** Mark the first real chat projection complete, including late post-APP_READY attachment. */
function markStartupChatProjectionReady(chatId) {
    if (!chatId) return;
    _startupChatProjectionReady = true;
    _attemptStartupPersistenceRelease();
}

/** Open persistence after Chat Link bootstrap and flush one coalesced save. */
async function openSettingsPersistenceGate() {
    if (_settingsPersistenceGateOpen) return;
    _settingsPersistenceGateOpen = true;
    if (!_startupSavePending) return;

    const force = _startupSavePendingForce;
    _startupSavePending = false;
    _startupSavePendingForce = false;
    await Promise.resolve(saveSettings(force));
}

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
    snapshotPortraitMapsForChat(s, chatId);
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
        syncChatSetupCatalogs(s0);
        const chatId0 = runtimeState.currentChatId || SillyTavern.getContext()?.chatId || null;
        snapshotPortraitMapsForChat(s0, chatId0);
        writeModuleSchemaBackup(chatId0);
        if (s0.chatLinkEnabled && chatId0 && !isPortraitMigrationLocked()) {
            // Keep legacy per-chat module presentation aligned without nesting saveSettings.
            // The optional full setup snapshot is written by saveChatState below.
            const existing = s0.chatStates?.[chatId0];
            if (existing) {
                existing.blockOrder = JSON.parse(JSON.stringify(s0.blockOrder || []));
                existing.modules = JSON.parse(JSON.stringify(s0.modules || {}));
            }
        }
    } catch (_) { /* non-fatal */ }

    // Never persist SillyTavern's whole settings blob while boot is still
    // selecting/loading the active chat. Coalesce all startup requests and
    // flush once the live chat projection is complete.
    if (!_settingsPersistenceGateOpen) {
        _startupSavePending = true;
        _startupSavePendingForce = _startupSavePendingForce || !!force;
        return;
    }

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
                snapshotPortraitMapsForChat(s, activeChatId);
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
                // Sync WAL for displayGroups / prompt-ack — survives cancelled saves on code-edit reload.
                stampCriticalSettingsSynced(s, writeCriticalSettingsBackup(s));
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

let _mapThemePreviewTimer = null;
let _mapThemeSaveTimer = null;
let _pendingMapThemeColors = {};
const MAP_THEME_PREVIEW_DELAY_MS = 90;
const MAP_THEME_SAVE_DELAY_MS = 240;

function applyMapThemePreviewNow(theme) {
    if (_mapThemePreviewTimer) clearTimeout(_mapThemePreviewTimer);
    _mapThemePreviewTimer = null;
    _pendingMapThemeColors = {};
    applyMapThemeToRoot(theme);
}

function flushPendingMapThemeColors(immediateSave = false) {
    if (_mapThemePreviewTimer) clearTimeout(_mapThemePreviewTimer);
    _mapThemePreviewTimer = null;
    const edits = _pendingMapThemeColors;
    _pendingMapThemeColors = {};
    if (!Object.keys(edits).length) return;

    const settings = getSettings();
    settings.mapTheme = normalizeMapTheme({ ...settings.mapTheme, ...edits });
    settings.activeMapThemePresetId = '';
    applyMapThemeToRoot(settings.mapTheme);
    for (const key of Object.keys(edits)) {
        document.querySelectorAll(`#rpg_map_theme_colors [data-map-theme-key="${key}"]`).forEach((input) => {
            input.value = settings.mapTheme[key];
        });
    }
    const select = document.getElementById('rpg_map_theme_preset');
    if (select) select.value = '';
    const deleteButton = document.getElementById('rpg_map_theme_delete');
    if (deleteButton) deleteButton.disabled = true;
    scheduleMapThemeSave(immediateSave);
}

function queueMapThemeColor(key, value, immediate = false) {
    _pendingMapThemeColors[key] = value;
    if (_mapThemePreviewTimer) clearTimeout(_mapThemePreviewTimer);
    _mapThemePreviewTimer = null;
    if (immediate) {
        flushPendingMapThemeColors(true);
        return;
    }
    _mapThemePreviewTimer = setTimeout(() => {
        flushPendingMapThemeColors(false);
    }, MAP_THEME_PREVIEW_DELAY_MS);
}

function scheduleMapThemeSave(immediate = false) {
    if (_mapThemeSaveTimer) clearTimeout(_mapThemeSaveTimer);
    _mapThemeSaveTimer = null;
    if (immediate) {
        saveSettings();
        return;
    }
    _mapThemeSaveTimer = setTimeout(() => {
        _mapThemeSaveTimer = null;
        saveSettings();
    }, MAP_THEME_SAVE_DELAY_MS);
}

function renderMapThemeColorControls() {
    const container = document.getElementById('rpg_map_theme_colors');
    if (!container || container.childElementCount) return;
    let currentGroup = '';
    for (const field of MAP_THEME_FIELDS) {
        if (field.group !== currentGroup) {
            currentGroup = field.group;
            const heading = document.createElement('div');
            heading.className = 'rt-map-theme-group-title';
            heading.textContent = currentGroup;
            container.appendChild(heading);
        }
        const label = document.createElement('label');
        label.className = 'rt-map-theme-color';
        label.title = `Choose the ${field.label.toLowerCase()} color`;

        const picker = document.createElement('input');
        picker.type = 'color';
        picker.dataset.mapThemeKey = field.key;
        picker.setAttribute('aria-label', `${field.label} color picker`);

        const name = document.createElement('span');
        name.textContent = field.label;

        const hex = document.createElement('input');
        hex.type = 'text';
        hex.className = 'text_pole';
        hex.maxLength = 7;
        hex.spellcheck = false;
        hex.dataset.mapThemeKey = field.key;
        hex.dataset.mapThemeHex = 'true';
        hex.setAttribute('aria-label', `${field.label} hex color`);

        label.append(picker, name, hex);
        container.appendChild(label);
    }
}

function syncMapThemePresetSelect(settings) {
    const select = document.getElementById('rpg_map_theme_preset');
    if (!select) return;
    const previous = String(settings.activeMapThemePresetId || '');
    select.replaceChildren();

    const custom = document.createElement('option');
    custom.value = '';
    custom.textContent = 'Custom (unsaved)';
    select.appendChild(custom);

    const factoryGroup = document.createElement('optgroup');
    factoryGroup.label = 'Factory themes';
    for (const preset of FACTORY_MAP_THEME_PRESETS) {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        factoryGroup.appendChild(option);
    }
    select.appendChild(factoryGroup);

    const savedEntries = Object.entries(settings.savedMapThemePresets || {});
    if (savedEntries.length) {
        const savedGroup = document.createElement('optgroup');
        savedGroup.label = 'Your presets';
        for (const [name] of savedEntries.sort(([a], [b]) => a.localeCompare(b))) {
            const option = document.createElement('option');
            option.value = `user:${name}`;
            option.textContent = name;
            savedGroup.appendChild(option);
        }
        select.appendChild(savedGroup);
    }
    select.value = [...select.options].some(option => option.value === previous) ? previous : '';
    const deleteButton = document.getElementById('rpg_map_theme_delete');
    if (deleteButton) deleteButton.disabled = !select.value.startsWith('user:');
}

function syncMapThemeImageUi(settings) {
    const theme = normalizeMapTheme(settings.mapTheme);
    const preview = document.getElementById('rpg_map_theme_bg_preview');
    const urlInput = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_map_theme_bg_url'));
    const overlayInput = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_map_theme_bg_overlay'));
    const overlayValue = document.getElementById('rpg_map_theme_bg_overlay_val');
    const strength = theme.backgroundImageStrength;
    if (preview) {
        const alpha = Math.round(strength * 2.55).toString(16).padStart(2, '0');
        preview.style.backgroundColor = theme.background;
        preview.style.backgroundImage = theme.backgroundImage
            ? `linear-gradient(${theme.background}${alpha}, ${theme.background}${alpha}), url(${JSON.stringify(theme.backgroundImage)})`
            : 'none';
    }
    if (urlInput) urlInput.value = /^https?:\/\//i.test(theme.backgroundImage) ? theme.backgroundImage : '';
    if (overlayInput) overlayInput.value = String(strength);
    if (overlayValue) overlayValue.textContent = `${strength}%`;
}

function markMapThemeCustom(settings) {
    settings.activeMapThemePresetId = '';
    const select = document.getElementById('rpg_map_theme_preset');
    if (select) select.value = '';
    const deleteButton = document.getElementById('rpg_map_theme_delete');
    if (deleteButton) deleteButton.disabled = true;
}

function syncMapThemeUi(settings = getSettings()) {
    settings.mapTheme = normalizeMapTheme(settings.mapTheme);
    settings.savedMapThemePresets = normalizeSavedMapThemePresets(settings.savedMapThemePresets);
    applyMapThemePreviewNow(settings.mapTheme);
    renderMapThemeColorControls();
    for (const { key } of MAP_THEME_FIELDS) {
        document.querySelectorAll(`#rpg_map_theme_colors [data-map-theme-key="${key}"]`).forEach((input) => {
            input.value = settings.mapTheme[key];
        });
    }
    syncMapThemeImageUi(settings);
    syncMapThemePresetSelect(settings);
}

function applySelectedMapTheme(settings, theme, activeId = '') {
    settings.mapTheme = normalizeMapTheme(theme);
    settings.activeMapThemePresetId = activeId;
    syncMapThemeUi(settings);
    scheduleMapThemeSave(true);
}

function bindMapThemeControls() {
    const $colors = $('#rpg_map_theme_colors');
    $colors.off('.rpgMapTheme');
    $colors.on('input.rpgMapTheme change.rpgMapTheme', 'input[data-map-theme-key]', function (event) {
        const key = String(this.dataset.mapThemeKey || '');
        const raw = String(this.value || '').trim();
        const valid = /^#[0-9a-f]{6}$/i.test(raw);
        if (!valid) {
            if (event.type === 'change') {
                const settings = getSettings();
                this.value = settings.mapTheme[key] || DEFAULT_MAP_THEME[key];
            }
            return;
        }
        // Keep the high-frequency native picker event nearly work-free. The
        // complete settings/UI/map update runs only after movement settles.
        queueMapThemeColor(key, raw, event.type === 'change');
    });

    $('#rpg_map_theme_preset').off('.rpgMapTheme').on('change.rpgMapTheme', function () {
        $('#rpg_map_theme_delete').prop('disabled', !String(this.value || '').startsWith('user:'));
    });
    $('#rpg_map_theme_load').off('.rpgMapTheme').on('click.rpgMapTheme', function () {
        const settings = getSettings();
        const id = String($('#rpg_map_theme_preset').val() || '');
        const theme = resolveMapThemePreset(id, settings.savedMapThemePresets);
        if (!theme) {
            toastr['warning']('Choose a saved or factory theme first.', 'Map Themes');
            return;
        }
        applySelectedMapTheme(settings, theme, id);
        const name = id.startsWith('user:') ? id.slice(5) : FACTORY_MAP_THEME_PRESETS.find(preset => preset.id === id)?.name;
        toastr['success'](`Loaded ${name || 'map theme'}.`, 'Map Themes');
    });
    $('#rpg_map_theme_save').off('.rpgMapTheme').on('click.rpgMapTheme', async function () {
        const settings = getSettings();
        const { Popup, POPUP_RESULT } = SillyTavern.getContext();
        const requested = Popup?.show?.input
            ? await Popup.show.input('Save Map Theme', 'Name this map theme preset:', 'My Map Theme')
            : prompt('Name this map theme preset:', 'My Map Theme');
        const name = String(requested || '').trim().slice(0, 80);
        if (!name) return;
        if (['__proto__', 'constructor', 'prototype'].includes(name)) {
            toastr['warning']('Please choose another preset name.', 'Map Themes');
            return;
        }
        const existingName = Object.keys(settings.savedMapThemePresets || {})
            .find(savedName => savedName.toLowerCase() === name.toLowerCase());
        if (existingName) {
            const replace = Popup?.show?.confirm
                ? await Popup.show.confirm('Replace Map Theme?', `Replace the saved map theme "${escapeHtml(existingName)}"?`)
                : confirm(`Replace the saved map theme "${existingName}"?`);
            if (Popup?.show?.confirm ? replace !== (POPUP_RESULT?.AFFIRMATIVE ?? 1) : !replace) return;
        }
        if (existingName && existingName !== name) delete settings.savedMapThemePresets[existingName];
        settings.savedMapThemePresets[name] = normalizeMapTheme(settings.mapTheme);
        settings.activeMapThemePresetId = `user:${name}`;
        syncMapThemeUi(settings);
        scheduleMapThemeSave(true);
        toastr['success'](`Saved ${name}.`, 'Map Themes');
    });
    $('#rpg_map_theme_delete').off('.rpgMapTheme').on('click.rpgMapTheme', async function () {
        const settings = getSettings();
        const id = String($('#rpg_map_theme_preset').val() || '');
        if (!id.startsWith('user:')) return;
        const name = id.slice(5);
        const { Popup, POPUP_RESULT } = SillyTavern.getContext();
        const approved = Popup?.show?.confirm
            ? await Popup.show.confirm('Delete Map Theme?', `Delete the saved map theme "${escapeHtml(name)}"?`)
            : confirm(`Delete the saved map theme "${name}"?`);
        if (Popup?.show?.confirm ? approved !== (POPUP_RESULT?.AFFIRMATIVE ?? 1) : !approved) return;
        delete settings.savedMapThemePresets[name];
        if (settings.activeMapThemePresetId === id) settings.activeMapThemePresetId = '';
        syncMapThemeUi(settings);
        scheduleMapThemeSave(true);
        toastr['info'](`Deleted ${name}.`, 'Map Themes');
    });
    $('#rpg_map_theme_reset').off('.rpgMapTheme').on('click.rpgMapTheme', function () {
        const settings = getSettings();
        applySelectedMapTheme(settings, DEFAULT_MAP_THEME, 'factory:ember');
        toastr['success']('Map theme reset to Ember.', 'Map Themes');
    });

    const persistBackgroundImage = async (source) => {
        const settings = getSettings();
        let stored = String(source || '').trim();
        if (stored.startsWith('data:image/')) {
            try {
                stored = await scalePanelBackgroundImage(stored);
            } catch (err) {
                console.error(err);
                toastr['warning']('Could not process that image.', 'Map Themes');
                return false;
            }
        } else if (stored && !/^https?:\/\//i.test(stored)) {
            toastr['warning']('Use an http(s) image URL or upload a file.', 'Map Themes');
            return false;
        }
        settings.mapTheme = normalizeMapTheme({ ...settings.mapTheme, backgroundImage: stored });
        markMapThemeCustom(settings);
        applyMapThemeToRoot(settings.mapTheme);
        syncMapThemeImageUi(settings);
        scheduleMapThemeSave(true);
        return true;
    };

    $('#rpg_map_theme_bg_upload').off('.rpgMapTheme').on('click.rpgMapTheme', function () {
        document.getElementById('rpg_map_theme_bg_file')?.click();
    });
    $('#rpg_map_theme_bg_file').off('.rpgMapTheme').on('change.rpgMapTheme', async function () {
        const file = this.files?.[0];
        this.value = '';
        if (!file) return;
        try {
            if (await persistBackgroundImage(String(await fileToDataUrl(file)))) {
                toastr['success']('Map background image set.', 'Map Themes');
            }
        } catch (err) {
            console.error(err);
            toastr['warning']('Could not read that file.', 'Map Themes');
        }
    });
    $('#rpg_map_theme_bg_url').off('.rpgMapTheme').on('change.rpgMapTheme', async function () {
        await persistBackgroundImage(this.value);
    });
    $('#rpg_map_theme_bg_clear').off('.rpgMapTheme').on('click.rpgMapTheme', async function () {
        await persistBackgroundImage('');
    });
    $('#rpg_map_theme_bg_overlay').off('.rpgMapTheme').on('input.rpgMapTheme change.rpgMapTheme', function (event) {
        const settings = getSettings();
        const strength = Math.max(0, Math.min(100, parseInt(this.value, 10) || 0));
        settings.mapTheme = normalizeMapTheme({ ...settings.mapTheme, backgroundImageStrength: strength });
        markMapThemeCustom(settings);
        applyMapThemeToRoot(settings.mapTheme);
        syncMapThemeImageUi(settings);
        if (event.type === 'change') scheduleMapThemeSave(true);
    });
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
            // Only auto-swap when still on a shipped default; keep custom Location Scene Prompts.
            syncPortraitLocationPromptForNpcToggle(settings, true);
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
    // Keep this available as an emergency kill switch. Turning location images
    // off also stops and disables any active Real-Time generation.
    syncCheckbox('rpg_tracker_location_images', imagesEnabled, false);
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
                location_enter: 'Generate once when entering a place that has no scene image yet. Open Visuals/Map in the Lorebook Agent to view scene art.',
                location_change: 'Regenerate whenever the location changes (including revisits). Open Visuals/Map in the Lorebook Agent to view scene art.',
                every_n_outputs: `Regenerate on location change, and also every ${everyN} chat output${everyN === 1 ? '' : 's'}. Open Visuals/Map in the Lorebook Agent to view scene art.`,
            };
            realtimeNote.textContent = notes[triggerMode] || notes.location_change;
        }
    }
    if (realtimeGroup) realtimeGroup.classList.toggle('rt-loc-realtime-active', realTimeOn);

    if (typeof globalThis._rpgSyncAgentImmersionUi === 'function') {
        globalThis._rpgSyncAgentImmersionUi();
    }
}

// portraits.js owns the asynchronous generation failure path and cannot import
// this controller without creating a circular dependency. Give it the same UI
// refresh used by manual toggle changes.
globalThis._rpgSyncLocationImageDependentUi = () => {
    syncLocationImageDependentUi(getSettings());
};

/** Push the Location Scene Prompt textarea to match settings (if present in DOM). */
function setPortraitLocationPromptTextarea(text) {
    const el = document.getElementById('rpg_portrait_location_system_prompt');
    if (el) el.value = text;
    $('#rpg_portrait_location_system_prompt').val(text);
}

/**
 * When the present-NPC toggle changes, swap Location Scene Prompt to the matching factory default
 * if settings or the open textarea still match a shipped/legacy default.
 * Custom Location Scene Prompts are never overwritten unless opts.force is set.
 * @param {object} settings
 * @param {boolean} includePresentNpcs
 * @param {{ force?: boolean }} [opts] force=true always overwrites (avoid for normal UI toggles).
 */
function syncPortraitLocationPromptForNpcToggle(settings, includePresentNpcs, opts = {}) {
    const fromSettings = settings.portraitLocationSystemPrompt || '';
    const fromTextarea = String($('#rpg_portrait_location_system_prompt').val() || '');
    const styleId = findShippedPortraitLocationPresetId(fromSettings)
        || findShippedPortraitLocationPresetId(fromTextarea)
        || settings.activePortraitPromptPresetId
        || DEFAULT_PORTRAIT_PROMPT_PRESET_ID;
    const shouldSwap = !!opts.force
        || !fromSettings.trim()
        || isShippedPortraitLocationSystemPrompt(fromSettings)
        || isShippedPortraitLocationSystemPrompt(fromTextarea);
    if (!shouldSwap) return;
    settings.portraitLocationSystemPrompt = getDefaultPortraitLocationSystemPrompt(includePresentNpcs, styleId);
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
    if (!isAgentPanelVisible()) {
        // Still probe the mapped site so Visuals/Map is ready on first open.
        if (typeof runtimeState.refreshImmersionView === 'function') {
            await runtimeState.refreshImmersionView().catch(() => {});
        }
        if (typeof globalThis._rpgSyncAgentImmersionUi === 'function') {
            globalThis._rpgSyncAgentImmersionUi();
        }
        return;
    }
    const source = opts.forceLayoutRefresh ? 'layout-toggle' : 'auto';
    await runtimeState.refreshAgentManifest(source);
    if (typeof globalThis._rpgSyncAgentImmersionUi === 'function') {
        globalThis._rpgSyncAgentImmersionUi();
    }
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
    s.initialTime = saved?.initialTime ?? '08:00 AM';
    if (s.routerModules?.npc) {
        s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false, s);
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
    $('#rpg_tracker_router_prompt').val(s.routerBasicMode ? s.routerBasicSystemPromptTemplate : s.routerSystemPromptTemplate);
    $('#rpg_tracker_router_modular_prompt').val(s.routerModularPromptTemplate);
    $('#rpg_tracker_router_agent_context').val(s.routerAgentSharedContextTemplate);
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
    // Reformat the stored initial-time anchor to match the new clock style so the
    // Character Creator / onboarding inputs and the [TIME] hint stay consistent.
    const parsedMins = parseInWorldTime(s.initialTime || '08:00 AM');
    if (parsedMins != null) s.initialTime = formatTimeOfDay(parsedMins, s.use24hTime);
    rebuildAllModuleInstructions(s);
    adjustAllStoredTemplatesForTimeFormat(s);
    $('#rpg_tracker_router_prompt').val(s.routerBasicMode ? s.routerBasicSystemPromptTemplate : s.routerSystemPromptTemplate);
    $('#rpg_tracker_router_modular_prompt').val(s.routerModularPromptTemplate);
    $('#rpg_tracker_router_agent_context').val(s.routerAgentSharedContextTemplate);
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
 * Single source-of-truth setter for the initial time-of-day anchor text.
 * See {@link setInitialDateValue} for why every input MUST funnel through here.
 * @param {string} val
 * @param {HTMLInputElement|null} [sourceInput] - the input the user is typing into; left untouched.
 */
function setInitialTimeValue(val, sourceInput = null) {
    getSettings().initialTime = val;
    saveSettings();
    persistChatTimeFormatIfLinked();
    document.querySelectorAll('#rt-cr-start-time, #rt-onboarding-start-time').forEach(input => {
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

    const narrativePacing = ['normal', 'shorter_outputs', 'high_agency', 'downtime'].includes(s.narrativePacing) ? s.narrativePacing : 'normal';
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
    const mods = {
        loot: '#rt_onboarding_mod_loot',
        random_events: '#rt_onboarding_mod_random_events',
        resting: '#rt_onboarding_mod_resting',
        party_bench: '#rt_onboarding_mod_party_bench',
        dungeon_reality_and_hidden_mapping: '#rt_onboarding_mod_dungeon_reality_and_hidden_mapping',
        CYOA_mode: '#rt_onboarding_mod_cyoa_mode',
    };
    for (const [key, id] of Object.entries(mods)) {
        const cb = /** @type {HTMLInputElement|null} */ (onboarding.querySelector(id));
        if (cb) {
            cb.checked = key === 'CYOA_mode'
                ? s.syspromptModules?.CYOA_mode === true
                : (s.syspromptModules?.[key] ?? true);
        }
    }
    applyMapArchitectOpenerToUi(s.mapArchitectOpener);
    syncMapArchitectOpenerNestedVisibility(s.syspromptModules?.[LOCATION_MAPPING_SECTION_TAG] ?? true);

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
    const startTimeVal = s.initialTime || '08:00 AM';
    onboarding.querySelectorAll('#rt-cr-start-time, #rt-onboarding-start-time').forEach(input => {
        if (input instanceof HTMLInputElement && input.value !== startTimeVal) input.value = startTimeVal;
    });
    const gearTier = s.onboardingGearTier || 'auto';
    onboarding.querySelectorAll('#rt-onboarding-gear-tier, #rt-cr-gear-tier').forEach(sel => {
        if (sel instanceof HTMLSelectElement && sel.value !== gearTier) sel.value = gearTier;
    });
    const levelPref = s.onboardingLevel === 'none' ? 'none' : String(s.onboardingLevel || 1);
    onboarding.querySelectorAll('#rt-starting-level, #rt-cr-level').forEach(sel => {
        if (sel instanceof HTMLSelectElement && sel.value !== levelPref) sel.value = levelPref;
    });
    const useCombatGuide = s.onboardingUseCombatScalingGuide !== false;
    onboarding.querySelectorAll('#rt-onboarding-combat-guide-cb, #rt-cr-combat-guide-cb').forEach(cb => {
        if (cb instanceof HTMLInputElement) cb.checked = useCombatGuide;
    });

    // Hide the Abilities preference field entirely when the [ABILITIES] module is
    // disabled — the prompt no longer references it either, so leaving it visible
    // would just collect input that's silently discarded.
    const abilitiesField = /** @type {HTMLElement|null} */ (onboarding.querySelector('#rt-cr-abilities'))?.closest('.rt-cr-field');
    if (abilitiesField) abilitiesField.style.display = s.modules?.abilities ? '' : 'none';

    const playerCardCbSync = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt-onboarding-player-card-cb'));
    if (playerCardCbSync) playerCardCbSync.checked = !!s.onboardingCreatePersona;
    const stPersonaCbSync = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt-onboarding-st-persona-cb'));
    if (stPersonaCbSync) stPersonaCbSync.checked = s.onboardingCreateSillyTavernPersona !== false;
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
    const liveChatId = ctx.getCurrentChatId?.() || ctx.chatId || runtimeState.currentChatId || '';

    const currentPrefix = (
        getEffectiveRouterCampaignPrefix(liveChatId)
        || s.routerCampaignPrefix
        || ''
    ).trim();
    if (!currentPrefix) {
        toastr['warning']('No campaign prefix is active. Activate the Lorebook Agent and load a chat first.', 'Clone Stack');
        return;
    }

    let newPrefixRaw = '';
    try {
        newPrefixRaw = await ctx.Popup.show.input(
            'Clone Lorebook Stack',
            `<p>All lorebooks under prefix <strong>${currentPrefix}</strong> will be duplicated.</p>` +
            `<p>Enter the new prefix for the cloned stack (e.g. <code>Eldoria_Branch1</code>).<br>` +
            `<small>Tip: use <b>General &amp; Visuals → Core &amp; Branching → Branch Campaign</b> to create the ST branch and copy Multihog data in one step.</small></p>`,
            ''
        );
    } catch (_) {
        return;
    }

    if (!newPrefixRaw && newPrefixRaw !== 0) return;
    const newPrefix = sanitizeCampaignPrefixString(String(newPrefixRaw).trim());
    if (!newPrefix) {
        toastr['warning']('New prefix cannot be empty or contain only special characters.', 'Clone Stack');
        return;
    }
    if (newPrefix.toLowerCase() === currentPrefix.toLowerCase()) {
        toastr['warning']('New prefix is the same as the current prefix. Please choose a different name.', 'Clone Stack');
        return;
    }

    toastr['info'](`Cloning lorebooks to prefix "${newPrefix}"…`, 'Clone Stack');
    const result = await cloneCampaignStackToPrefix(currentPrefix, newPrefix);

    if (result.matchingCount === 0) {
        toastr['warning'](`No lorebooks found for prefix "${currentPrefix}". Nothing to clone.`, 'Clone Stack');
        return;
    }

    if (result.collisions?.length) {
        toastr['error'](
            `Clone aborted to protect existing lorebooks:\n${result.collisions.join(', ')}\n`
            + 'Choose a different prefix, or rename/delete the conflicting books first.',
            'Clone Stack',
            { timeOut: 12000 }
        );
        return;
    }

    if (result.errors.length === 0) {
        toastr['success'](
            `Cloned ${result.cloned} lorebook${result.cloned === 1 ? '' : 's'} → prefix "${newPrefix}".\n` +
            `Use Branch Campaign, or create a branch chat whose sanitized name matches "${newPrefix}".`,
            'Clone Stack',
            { timeOut: 8000 }
        );
    } else {
        toastr['warning'](
            `Cloned ${result.cloned}/${result.matchingCount} books. Errors:\n${result.errors.join('\n')}`,
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

/**
 * Reset live story state when Chat Link reaches a chat with no saved snapshot.
 * Narrator Configuration intentionally remains untouched: the departing chat was
 * already snapshotted before this runs, so a new chat inherits that configuration
 * and receives its own independent snapshot on the next save.
 * Chat-bound Game Systems / modules / snippets start inactive; GLOBAL items keep
 * their shared enablement.
 */
function resetUnseenChatState(s) {
    s.currentMemo = '';
    s.combatDefeatedUi = [];
    s.prevMemo1 = '';
    s.prevMemo2 = '';
    s.memoHistory = [];
    s.dungeonMapHistory = [];
    s.lastDelta = '';
    s.historyIndex = -1;
    s.quests = [];
    s.activeRouterKeys = [];
    s.activeWorldKeys = [];
    s.keywordActivatedKeys = [];
    s.routerLog = [];
    s.pcCharacterBlockSeeded = false;
    s.customPortraits = {};
    s.customLocationImages = {};
    s.worldProgressionLastFiredAtMinutes = -1;
    s.worldProgressionLastFiredPeriodLabel = '';
    s.worldProgressionSkeletonAtmosphereSummary = '';
    s.worldProgressionLocationLastAdvanced = {};
    s.mapEvolutionLastFiredBySite = {};
    s.mapEvolutionBacklogBySite = {};
    s.mapEvolutionThreadsBySite = {};
    s.dungeonMapRevealAll = false;
    s.mapEvolutionLastSiteRoot = '';
    s.mapEvolutionPendingExitRoot = '';
    s.mapEvolutionWorldReportApplications = {};
    s.agentImmersionMode = false;
    resetImmersionSceneArtTracking();
    applyChatTimeFormatSettings(null);
    applyChatNpcRelMaxSettings(null);
    s.npcRelationshipValues = {};
    s.npcRelationshipLog = {};
    runtimeState.historyViewIndex = -1;
    if (typeof globalThis._rpgApplyAdventureCompanionSnapshot === 'function') {
        globalThis._rpgApplyAdventureCompanionSnapshot(null, { resetIfMissing: true });
    }

    if (s.chatSetupLinkEnabled) clearChatBoundActivations(s);

    refreshOrderList();
    if (s.chatSetupLinkEnabled && typeof globalThis._rpgSyncSettingsUi === 'function') {
        globalThis._rpgSyncSettingsUi();
    }
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
    if (!isLorebookAgentRuntimeActive(s) || (!s.activeRouterKeys?.length && !s.activeWorldKeys?.length)) {
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
                injectedContext += `### [${entry.key?.[0] || entry.comment || uid}]\n${stripDungeonMapSection(entry.content)}\n\n`;
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
    const migratedPortraitScope = migrateLegacyPortraitMapsToChat(s, oldChatId || resolvedId);

    // Same-chat refresh (bare emit, F5, Copilot apply, etc.): keep live tracker state.
    if (!emitHadId || oldChatId === resolvedId) {
        runtimeState.currentChatId = resolvedId;
        markStartupChatProjectionReady(resolvedId);
        if (migratedPortraitScope) void saveSettings(true);
        void ensureLocalMemoRecovery(resolvedId);
        updateChatLinkUI();
        return;
    }

    // SillyTavern commonly reaches APP_READY before it exposes the restored chat
    // id. In that ordering the boot guard above could not run. Preserve the live
    // projection now, before resetRouterTick or any other switch logic mutates it.
    // Owner-aware validation prevents state from a different campaign leaking in.
    const isDeferredBootAttachment = !_startupChatProjectionReady && !oldChatId;
    if (isDeferredBootAttachment
        && s.chatLinkEnabled
        && shouldPreserveLiveChatStateOnBoot(s, resolvedId)) {
        saveChatState(resolvedId, { skipDiskWrite: true });
        console.warn('[RPG Tracker] Preserved live tracker state during deferred boot chat attachment:', resolvedId);
    }

    // A later CHAT_RENAMED may prove this switch was a rename. Only the exact
    // unseen-chat reset below is safe to replace; every other collision must be
    // preserved as potentially real campaign data.
    runtimeState.pendingUnseenChatReset = null;

    // Drop in-flight State Tracker work for the departing chat. A late commit
    // would write into the arriving chat's projected settings / chatStates partition.
    if (runtimeState.stateController) {
        try { runtimeState.stateController.abort(); } catch (_) { /* ignore */ }
    }

    // Flush Adventure Companion under the departing chat BEFORE flipping currentChatId /
    // loading the arriving partition (history is per-chat, including when Chat Link is off).
    if (typeof globalThis._rpgFlushAdventureCompanionForChat === 'function' && oldChatId) {
        globalThis._rpgFlushAdventureCompanionForChat(oldChatId);
    }

    // Portraits and location images are always chat-owned, even when broader Chat Link is off.
    snapshotPortraitMapsForChat(s, oldChatId);

    // Redo stack is in-memory and chat-scoped; never replay another chat's pass here.
    runtimeState.loreRedoStack = [];

    runtimeState.currentChatId = resolvedId;
    runtimeState.hasActiveDungeonMap = false;

    // Snapshot the departing chat's state BEFORE resetRouterTick mutates shared pools.
    // resetRouterTick(true) zeroes keywordActivatedKeys in-place; if saveChatState ran
    // after that, the yellow-pill keyword state for the departing chat would be lost.
    // Guard matches the later chatLinkEnabled block so we only persist when linking is on.
    if (s.chatLinkEnabled && oldChatId) saveChatState(oldChatId, { skipDiskWrite: true });

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
        // Still swap Adventure Companion — flush already ran for the departing chat.
        if (typeof globalThis._rpgLoadAdventureCompanionForChat === 'function') {
            globalThis._rpgLoadAdventureCompanionForChat(resolvedId);
        }
        markStartupChatProjectionReady(resolvedId);
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
    } else if (isLorebookAgentRuntimeActive(s) && resolvedId) {
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
        loadPortraitMapsForChat(s, resolvedId);
        if (migratedPortraitScope) void saveSettings(true);
        // World Progression "last fired" is operational per-chat state and must never bleed
        // between scenarios regardless of chatLinkEnabled. Reset it unconditionally on actual switch.
        s.worldProgressionLastFiredAtMinutes = -1;
        s.worldProgressionLastFiredPeriodLabel = '';
        s.worldProgressionSkeletonAtmosphereSummary = '';
        s.worldProgressionLocationLastAdvanced = {};
        s.mapEvolutionLastFiredBySite = {};
        s.mapEvolutionBacklogBySite = {};
        s.mapEvolutionThreadsBySite = {};
        s.dungeonMapRevealAll = false;
        s.mapEvolutionLastSiteRoot = '';
        s.mapEvolutionPendingExitRoot = '';
        s.mapEvolutionWorldReportApplications = {};
        s.activeWorldKeys = [];
        s.quests = [];
        if (typeof globalThis._rpgLoadAdventureCompanionForChat === 'function') {
            globalThis._rpgLoadAdventureCompanionForChat(resolvedId);
        }
        refreshRenderedView();
        markStartupChatProjectionReady(resolvedId);
        updateChatLinkUI();
        return;
    }

    // saveChatState(oldChatId) already called above, before resetRouterTick.

    const found = loadChatState(resolvedId);
    if (!found && !s.chatStates?.[resolvedId]) {
        // Branch Campaign seeds the partition before open; never wipe a just-seeded branch.
        // Rename: CHAT_CHANGED may briefly reset before CHAT_RENAMED migrates old → new.
        // Record that exact reset so the migrator can replace only this known shell;
        // ambiguous or substantive destination collisions are always preserved.
        if (isBranchSeedInProgress(resolvedId)) {
            const retried = loadChatState(resolvedId);
            if (!retried && !s.chatStates?.[resolvedId]) {
                console.warn('[RPG Tracker] Branch seed guard active but partition missing for', resolvedId);
            }
        } else {
            // Capture genuine browser-local destination entries before the reset
            // writes its own empty Adventure Companion / recovery shells there.
            const preexistingLocalMapKeys = [COMPANION_BY_CHAT_KEY, MEMO_RECOVERY_KEY]
                .filter((key) => localChatMapHasEntry(key, resolvedId));
            // Establish ownership before exposing the deliberate empty projection.
            // Any other extension saving in this synchronous turn now persists an
            // identified new-chat state, never an ownerless transient snapshot.
            s.chatStateProjectionOwner = resolvedId;
            resetUnseenChatState(s);
            runtimeState.pendingUnseenChatReset = {
                oldId: oldChatId,
                newId: resolvedId,
                preexistingLocalMapKeys,
            };
        }
    } else if (!found && typeof globalThis._rpgLoadAdventureCompanionForChat === 'function') {
        // Partition missing but chatStates entry may exist empty — still hydrate companion map
        globalThis._rpgLoadAdventureCompanionForChat(resolvedId);
    }
    if (s.chatSetupLinkEnabled) syncAllNarratorTogglesForUnlockState();
    if (migratedPortraitScope) void saveSettings(true);

    // Persist only after the arriving partition has been projected. Saving the
    // departing partition above used to call ST directly while top-level state
    // still belonged to the old chat, creating a destructive startup/switch race.
    markStartupChatProjectionReady(resolvedId);
    saveSettings();

    scheduleAgentManifestRefresh();
    updateChatLinkUI();
    void syncCombatProfile(s.currentMemo, s);
    void syncDynamicRngPrompt(s.currentMemo, s);
}







/**
 * Syncs the settings checkbox to reflect the current chatLinkEnabled state.
 */
function updateChatLinkUI() {
    const s = getSettings();
    const cb = document.getElementById('rpg_tracker_chat_link_enabled');
    if (cb instanceof HTMLInputElement) cb.checked = !!s.chatLinkEnabled;
    const setupCb = document.getElementById('rpg_tracker_chat_setup_link_enabled');
    if (setupCb instanceof HTMLInputElement) setupCb.checked = !!s.chatSetupLinkEnabled;
}

/**
 * Enable/disable Chat-Linked Mode (settings toggle). Handles restore/overwrite conflicts.
 * @param {boolean} turningOn
 * @returns {Promise<boolean>} true if the new state was applied
 */
async function applyChatLinkToggle(turningOn) {
    const { Popup, POPUP_RESULT } = SillyTavern.getContext();
    const s = getSettings();

    if (turningOn && runtimeState.currentChatId) {
        const saved = s.chatStates?.[runtimeState.currentChatId];
        // Re-enabling Chat Link after carrying a setup into a legacy/unlocked chat
        // adopts that live setup instead of replacing it with factory stock.
        if (s.chatSetupLinkEnabled && saved && !saved.setup) {
            saved.setup = snapshotChatSetup(s);
        }
        const liveContent = (s.currentMemo || '').trim();
        const savedContent = (saved?.currentMemo || '').trim();

        const liveKeys = [...(s.activeRouterKeys || [])].sort();
        const savedKeys = [...(saved?.activeRouterKeys || [])].sort();
        const keysChanged = JSON.stringify(liveKeys) !== JSON.stringify(savedKeys);
        const setupChanged = !!s.chatSetupLinkEnabled && !!saved?.setup && !chatSetupsMatch(s, saved.setup);

        const hasConflict = (savedContent && liveContent && liveContent !== savedContent)
            || (savedKeys.length > 0 && liveKeys.length > 0 && keysChanged)
            || setupChanged;

        if (hasConflict && saved) {
            const body = `
                <div style="text-align: left;">
                    <p><b>Conflict Detected:</b> This chat has saved state${setupChanged ? ' or a locked Control Room/module setup' : ' (memo or lore keys)'}, but your current session differs.</p>
                    <p style="font-size: 0.9em; opacity: 0.8; margin-top: 10px;">
                        <b>RESTORE:</b> Use the chat's saved state. (Current session moved to history)<br>
                        <b>OVERWRITE:</b> Keep current session and save it to this chat. (Old chat data moved to history)
                    </p>
                </div>`;

            const choice = await Popup.show.confirm('⚠️ Chat Link Conflict', body, {
                okButton: 'RESTORE',
                cancelButton: 'OVERWRITE',
                customButtons: [
                    {
                        text: 'CANCEL',
                        result: POPUP_RESULT.CANCELLED,
                        appendAtEnd: true,
                    },
                ],
            });

            if (choice === POPUP_RESULT.AFFIRMATIVE) {
                if (s.currentMemo) {
                    saved.memoHistory = saved.memoHistory || [];
                    saved.memoHistory.unshift({
                        memo: s.currentMemo,
                        delta: s.lastDelta,
                        timestamp: Date.now(),
                        label: 'Global Edit (Pre-Link)',
                    });
                    if (saved.memoHistory.length > 50) saved.memoHistory.length = 50;
                }
                loadChatState(runtimeState.currentChatId);
                toastr['success']('Chat Link ON — restored saved state.', 'RPG Tracker');
            } else if (choice === POPUP_RESULT.NEGATIVE) {
                if (saved.currentMemo) {
                    s.memoHistory.unshift(saved.currentMemo);
                    if (s.memoHistory.length > 50) s.memoHistory.length = 50;
                }
                saveChatState(runtimeState.currentChatId);
                toastr['success']('Chat Link ON — current state saved to chat.', 'RPG Tracker');
            } else {
                return false;
            }
        } else {
            const found = loadChatState(runtimeState.currentChatId);
            if (!found) saveChatState(runtimeState.currentChatId);
            toastr['success']('Chat Link ON — state bound to this chat.', 'RPG Tracker');
        }
    } else if (turningOn) {
        toastr['success']('Chat Link ON', 'RPG Tracker');
    } else {
        toastr['info']('Chat Link OFF — using global state.', 'RPG Tracker');
    }

    s.chatLinkEnabled = turningOn;
    saveSettings();
    updateChatLinkUI();
    return true;
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
        enableBtn.title = settings.enabled ? 'Disable Multihog Framework' : 'Enable Multihog Framework';
    }
    // Keep settings sidebar checkbox in sync
    const sidebarEnableCheck = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_enabled'));
    if (sidebarEnableCheck) sidebarEnableCheck.checked = !!settings.enabled;

    // Master power also dims Lorebook Agent; preference checkbox stays as stored.
    if (typeof runtimeState.updateAgentPanelDisabledRef === 'function') {
        runtimeState.updateAgentPanelDisabledRef();
    } else {
        const ap = document.getElementById('rpg-tracker-agent');
        if (ap) {
            if (isLorebookAgentRuntimeActive(settings)) ap.classList.remove('is-agent-disabled');
            else ap.classList.add('is-agent-disabled');
        }
    }

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
    // Capture before any await: after a chat switch the shared settings object
    // belongs to a different partition and must not receive this pass's commit.
    const passChatId = runtimeState.currentChatId;

    // Deterministic logic: Auto-fail quests past deadline (if not using frustration)
    checkQuestDeadlines();

    const { generateRaw } = SillyTavern.getContext();

    if (!generateRaw) {
        console.error("[RPG Tracker] generateRaw not found in context.");
        broadcastStateTrackerStep('error', 'State Tracker unavailable: text generation is not connected.');
        return;
    }

    try {
        runtimeState.stateModelRunning = true;
        updateStatusIndicator('running');
        broadcastStateTrackerStep('start', isFullContext ? 'Initializing State Tracker full audit...' : 'Initializing State Tracker pass...');

        // Abort previous if any
        if (runtimeState.stateController) runtimeState.stateController.abort();
        runtimeState.stateController = new AbortController();
        const signal = runtimeState.stateController.signal;
        let abandonedForChatSwitch = false;

        const modulesText = buildModulesInstructionText(settings);
        const coreTemplate = settings.fullReviewStateMode ? FULL_REVIEW_STATE_SYSTEM_PROMPT : settings.systemPromptTemplate;
        let systemPrompt = coreTemplate.replace('{{modulesText}}', modulesText);
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
            // Explicit Lookback Update / slash lookback=N must win over the default
            // "since last user message" mode (same priority pattern as Lorebook Agent).
            const useFixedLookback = overrideLookback !== null
                || settings.lookbackSinceLastUser === false;
            let startIdx;
            if (useFixedLookback) {
                const N = overrideLookback !== null
                    ? overrideLookback
                    : (settings.lookbackMessages !== undefined ? settings.lookbackMessages : 2);
                startIdx = Math.max(0, chat.length - N);
            } else {
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
        function commitChunkResult(merged, previousMemoSnapshot, mapSnapshot = null) {
            if (!canCommitPassForChat(passChatId, runtimeState.currentChatId, { aborted: signal.aborted })) {
                return null;
            }
            const delta = computeDelta(previousMemoSnapshot, merged);

            // Linear Stone History Logic
            if (settings.historyIndex !== undefined && settings.historyIndex !== -1) {
                if (settings.debugMode) console.log(`[RPG Tracker] Splicing history at index ${settings.historyIndex} due to new update.`);
                sliceMemoAndMapHistory(settings, settings.historyIndex);
            }
            ensureDungeonMapHistory(settings);
            if (settings.memoHistory[0] !== previousMemoSnapshot) {
                const previousMap = settings.historyIndex === 0
                    ? (settings.dungeonMapHistory[0] ?? mapSnapshot)
                    : mapSnapshot;
                unshiftMemoAndMapHistory(settings, previousMemoSnapshot, previousMap);
            }
            unshiftMemoAndMapHistory(settings, merged, mapSnapshot);
            settings.historyIndex = 0;
            runtimeState.historyViewIndex = -1;
            runtimeState.dungeonMapHistoryOverlay = null;

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
            // Always pin to the originating chat — never the post-switch active id.
            if (settings.chatLinkEnabled && passChatId) saveChatState(passChatId);

            if (/LEVEL_UP=true/i.test(merged)) {
                handleLevelUp();
            }

            return delta;
        }

        let lastDelta = '';

        for (let i = 0; i < chunks.length; i++) {
            if (signal.aborted) break;
            if (!canCommitPassForChat(passChatId, runtimeState.currentChatId)) {
                abandonedForChatSwitch = true;
                break;
            }

            // Snapshot the memo BEFORE this chunk processes, so delta/history is per-chunk
            const memoBeforeThisChunk = settings.currentMemo.replace(/<\/?memo>/gi, '').trim();

            if (isFullContext && chunks.length > 1) {
                toastr.info(`Running Full Audit: Chunk ${i + 1} of ${chunks.length}...`, "RPG Tracker", { timeOut: 5000 });
                updateStatusIndicator('running', `Chunk ${i + 1}/${chunks.length}`);
                broadcastStateTrackerStep('thought', `Processing full-audit chunk ${i + 1} of ${chunks.length}...`);
            } else if (chunks.length > 1) {
                broadcastStateTrackerStep('thought', `Processing chunk ${i + 1} of ${chunks.length}...`);
            } else {
                broadcastStateTrackerStep('thought', isFullContext ? 'Analyzing narrative history...' : 'Analyzing recent narrative...');
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
                const suffix = settings.fullReviewStateMode
                    ? FULL_REVIEW_USER_PROMPT_SUFFIX
                    : (settings.userPromptSuffix || `## OUTPUT ONLY CHANGED SECTIONS:`);
                userPrompt =
                    worldLoreSection +
                    priorMemoText +
                    `## NARRATIVE HISTORY (Last ${chunks[i].length} messages)\n${chatLog}\n\n` +
                    suffix;
            }

            const result = await sendStateRequest(settings, systemPrompt, userPrompt, signal, { stream: true, debugSource: 'Tracker' });

            if (signal.aborted) break;
            if (!canCommitPassForChat(passChatId, runtimeState.currentChatId)) {
                abandonedForChatSwitch = true;
                break;
            }

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
                const mapSnapshot = await captureActiveDungeonMapHistory();
                if (signal.aborted) break;
                if (!canCommitPassForChat(passChatId, runtimeState.currentChatId)) {
                    abandonedForChatSwitch = true;
                    break;
                }
                lastDelta = commitChunkResult(merged, memoBeforeThisChunk, mapSnapshot);
                if (lastDelta == null) {
                    abandonedForChatSwitch = true;
                    break;
                }
                if (relationshipCommands.length) {
                    // Relationship applies await NPC resolution; refuse if the chat
                    // changed so deltas cannot land in another chatStates partition.
                    if (!canCommitPassForChat(passChatId, runtimeState.currentChatId, { aborted: signal.aborted })) {
                        abandonedForChatSwitch = true;
                        break;
                    }
                    const relResult = await applyStateTrackerRelationshipCommands(relationshipCommands, { passChatId });
                    if (!canCommitPassForChat(passChatId, runtimeState.currentChatId, { aborted: signal.aborted })
                        || relResult?.status === 'chat_changed') {
                        abandonedForChatSwitch = true;
                        break;
                    }
                }
                const changed = merged !== memoBeforeThisChunk;
                broadcastStateTrackerStep(
                    'result',
                    changed
                        ? `Memo updated after chunk ${i + 1}/${chunks.length}${relationshipCommands.length ? ` (${relationshipCommands.length} relationship command${relationshipCommands.length === 1 ? '' : 's'})` : ''}.`
                        : `Memo unchanged after chunk ${i + 1}/${chunks.length}.`,
                );

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

        if (abandonedForChatSwitch) {
            broadcastStateTrackerStep('error', 'Stopped because the active chat changed.');
        } else if (signal.aborted) {
            broadcastStateTrackerStep('error', 'Stopped by user.');
        } else {
            broadcastStateTrackerStep('finish', isFullContext ? 'State Tracker full audit complete.' : 'State Tracker pass complete.');
        }

        if (settings.debugMode) console.log("[RPG Tracker] State Model pass complete.");
        return lastDelta;
    } catch (error) {
        if (error.name === 'AbortError') {
            if (settings.debugMode) console.log("[RPG Tracker] State Model pass aborted by user.");
            broadcastStateTrackerStep('error', 'Stopped by user.');
            return;
        }
        console.error("[RPG Tracker] State Model pass failed:", error);
        broadcastStateTrackerStep('error', String(error?.message || error));
    } finally {
        runtimeState.stateModelRunning = false;
        runtimeState.stateController = null;
        updateStatusIndicator('active');
    }
}

/**
 * Emergency UI rebuild: clear stuck layout localStorage (detached agent off-screen,
 * missing Lorebook Agent tab, hidden panel) and recreate the tracker panels.
 * @param {{ quiet?: boolean }} [opts]
 * @returns {string} status message
 */
function resetTrackerUi(opts = {}) {
    const quiet = !!opts.quiet;
    try { if (typeof closeAdventureCompanion === 'function') closeAdventureCompanion(); } catch (_) {}

    // Layout / visibility keys that can leave the UI unreachable
    localStorage.removeItem('rpg_tracker_agent_detached');
    localStorage.removeItem('rpg_tracker_adventure_companion_detached');
    localStorage.removeItem('rpg_tracker_dungeon_map_detached');
    localStorage.removeItem('rpg_tracker_agent_visible');
    localStorage.setItem('rpg_tracker_content_mode', 'tracker');
    localStorage.setItem('rpg_tracker_visible', 'true');
    for (const key of [...Object.keys(localStorage)]) {
        if (key === 'rpg_tracker_geometry' || key.startsWith('rpg_tracker_geometry_')) {
            localStorage.removeItem(key);
        }
    }

    const settings = getSettings();
    settings.trackerContentMode = 'tracker';

    document.getElementById('rpg-tracker-panel')?.remove();
    document.querySelector('body > #rpg-tracker-agent')?.remove();
    document.querySelectorAll('body > .rpg-tracker-detached-panel').forEach((el) => el.remove());

    createPanel();
    if (typeof updatePanelStatus === 'function') updatePanelStatus();
    if (typeof applyPanelBackgroundToDom === 'function') applyPanelBackgroundToDom();

    const msg = 'Multihog UI reset: panels rebuilt, detached/layout state cleared.';
    if (!quiet && typeof toastr !== 'undefined') {
        toastr['success'](msg, 'RPG Tracker');
    }
    console.log('[RPG Tracker]', msg);
    return msg;
}

// ── Phase-5 bridge: exposes runStateModelPass for narrative-hooks.js/onGenerationEnded ──
// Removed when memo-processor.js is created in Phase 5.
globalThis._rpgRunStateModelPass = runStateModelPass;
globalThis._rpgStateModelRunning = () => runtimeState.stateModelRunning;
globalThis._rpgCurrentChatId = () => runtimeState.currentChatId;
globalThis._rpgResetRouterAutoTick = resetRouterAutoTick;
globalThis._rpgResetTrackerUi = resetTrackerUi;
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
        const identity = normalizeActivePersonaIdentity(name, description);
        if (!identity) return null;

        if (descriptor && power_user.persona_description !== descriptor.description) {
            power_user.persona_description = descriptor.description ?? '';
        }

        return identity;
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
 * @param {string} message
 * @param {{ systemPromptMode?: 'state_extractor'|'modules_only', connectionSettings?: object }} [options]
 */
export async function sendDirectPrompt(message, options = {}) {
    if (runtimeState.stateModelRunning) {
        toastr['info']('State Model is already running. Please wait.', 'RPG Tracker');
        return { success: false, status: 'busy', changed: false, message: 'State Tracker is already running.' };
    }

    const settings = getSettings();
    const passChatId = runtimeState.currentChatId;
    const { generateRaw } = SillyTavern.getContext();
    if (!generateRaw) {
        toastr['warning']('Text generation is not available. Connect an API in SillyTavern settings.', 'RPG Tracker');
        return { success: false, status: 'unavailable', changed: false, message: 'State Tracker connection is unavailable.' };
    }

    try {
        runtimeState.stateModelRunning = true;
        updateStatusIndicator('running');
        broadcastStateTrackerStep('start', 'Processing direct State Tracker instruction...');

        // Abort previous if any
        if (runtimeState.stateController) runtimeState.stateController.abort();
        runtimeState.stateController = new AbortController();
        const signal = runtimeState.stateController.signal;
        const worldLore = await buildLorebookContext();
        if (!canCommitPassForChat(passChatId, runtimeState.currentChatId, { aborted: signal.aborted })) {
            broadcastStateTrackerStep('error', signal.aborted ? 'Stopped by user.' : 'Stopped because the active chat changed.');
            return {
                success: false,
                status: signal.aborted ? 'cancelled' : 'chat_changed',
                changed: false,
                message: signal.aborted ? 'State Tracker command was cancelled.' : 'Active chat changed; State Tracker commit was skipped.',
            };
        }
        const worldLoreSection = worldLore ? worldLore + '\n\n' : '';

        const modulesText = buildModulesInstructionText(settings);
        let systemPrompt = buildDirectPromptSystemPrompt(
            settings,
            modulesText,
            options.systemPromptMode || DIRECT_PROMPT_SYSTEM_MODES.STATE_EXTRACTOR,
        );
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

        broadcastStateTrackerStep('thought', 'Requesting memo update from State Tracker...');
        const result = await sendStateRequest(options.connectionSettings || settings, systemPrompt, userPrompt, signal, { stream: true, debugSource: 'Tracker' });

        if (!canCommitPassForChat(passChatId, runtimeState.currentChatId, { aborted: signal.aborted })) {
            broadcastStateTrackerStep('error', signal.aborted ? 'Stopped by user.' : 'Stopped because the active chat changed.');
            return {
                success: false,
                status: signal.aborted ? 'cancelled' : 'chat_changed',
                changed: false,
                message: signal.aborted ? 'State Tracker command was cancelled.' : 'Active chat changed; State Tracker commit was skipped.',
            };
        }

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
                    sliceMemoAndMapHistory(settings, settings.historyIndex);
                }
                const mapSnapshot = await captureActiveDungeonMapHistory();
                if (!canCommitPassForChat(passChatId, runtimeState.currentChatId, { aborted: signal.aborted })) {
                    broadcastStateTrackerStep('error', signal.aborted ? 'Stopped by user.' : 'Stopped because the active chat changed.');
                    return {
                        success: false,
                        status: signal.aborted ? 'cancelled' : 'chat_changed',
                        changed: false,
                        message: signal.aborted ? 'State Tracker command was cancelled.' : 'Active chat changed; State Tracker commit was skipped.',
                    };
                }
                ensureDungeonMapHistory(settings);
                if (settings.memoHistory[0] !== sanitizedCurrentFull) {
                    const previousMap = settings.historyIndex === 0
                        ? (settings.dungeonMapHistory[0] ?? mapSnapshot)
                        : mapSnapshot;
                    unshiftMemoAndMapHistory(settings, sanitizedCurrentFull, previousMap);
                }
                unshiftMemoAndMapHistory(settings, merged, mapSnapshot);
                settings.historyIndex = 0;
                runtimeState.historyViewIndex = -1;
                runtimeState.dungeonMapHistoryOverlay = null;

                const dp = document.getElementById('rpg-tracker-delta-content');
                if (dp) dp.innerHTML = delta;

                settings.prevMemo2 = settings.prevMemo1;
                settings.prevMemo1 = sanitizedCurrentFull;
                settings.currentMemo = merged;

                updateUIMemo(merged);
                syncMemoView();
                refreshRenderedView();
                saveSettings();
                if (settings.chatLinkEnabled && passChatId) saveChatState(passChatId);
                broadcastStateTrackerStep('result', 'Memo updated from direct instruction.');
                broadcastStateTrackerStep('finish', 'Direct State Tracker instruction complete.');
                toastr['success']('Tracker updated.', 'RPG Tracker');
                return { success: true, status: 'changed', changed: true, message: 'State Tracker updated.' };
            } else {
                broadcastStateTrackerStep('finish', 'No memo changes were needed.');
                toastr['info']('No changes were made.', 'RPG Tracker');
                return { success: true, status: 'unchanged', changed: false, message: 'State Tracker made no changes.' };
            }
        } else {
            broadcastStateTrackerStep('error', 'State Tracker returned no output.');
            toastr['warning']('State Model returned no output. Check your API connection and State Model settings.', 'RPG Tracker');
            return { success: false, status: 'no_output', changed: false, message: 'State Tracker returned no output.' };
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            if (settings.debugMode) console.log("[RPG Tracker] Direct prompt aborted by user.");
            broadcastStateTrackerStep('error', 'Stopped by user.');
            return { success: false, status: 'cancelled', changed: false, message: 'State Tracker command was cancelled.' };
        }
        console.error('[RPG Tracker] Direct prompt failed:', err);
        broadcastStateTrackerStep('error', String(err?.message || err));
        toastr['error']('Direct prompt failed. Check console.', 'RPG Tracker');
        return { success: false, status: 'failed', changed: false, message: err?.message || 'State Tracker command failed.' };
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
    s.dungeonMapHistory = p.dungeonMapHistory ?? [];
    ensureDungeonMapHistory(s);
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
    s.stateTrackerDirectPrompt = p.stateTrackerDirectPrompt || '';
    s.mapUpdaterDirectPrompt = p.mapUpdaterDirectPrompt || '';
    s.mapEvolutionDirectPrompt = p.mapEvolutionDirectPrompt || '';
    s.mapArchitectDirectPrompt = p.mapArchitectDirectPrompt || '';
    s.worldProgressionLookback = p.worldProgressionLookback ?? 20;
    s.worldProgressionHistoryLookback = p.worldProgressionHistoryLookback ?? 0;
    s.worldProgressionLocationsPerReport = p.worldProgressionLocationsPerReport ?? 3;
    s.worldProgressionLocationRandomize = p.worldProgressionLocationRandomize !== false;
    s.worldProgressionLocationLastAdvanced = JSON.parse(JSON.stringify(p.worldProgressionLocationLastAdvanced || {}));
    s.worldProgressionSkeletonFactions = p.worldProgressionSkeletonFactions ?? 4;
    s.worldProgressionSkeletonLocations = p.worldProgressionSkeletonLocations ?? 4;
    s.worldProgressionSkeletonConflicts = p.worldProgressionSkeletonConflicts ?? 3;
    s.worldProgressionSkeletonUseLorebooks = p.worldProgressionSkeletonUseLorebooks ?? false;
    s.worldProgressionSkeletonLorebookFilter = JSON.parse(JSON.stringify(p.worldProgressionSkeletonLorebookFilter || []));
    s.worldProgressionSkeletonLorebookOnly = p.worldProgressionSkeletonLorebookOnly ?? false;
    s.worldProgressionLastFiredAtMinutes = p.worldProgressionLastFiredAtMinutes ?? -1;
    s.worldProgressionLastFiredPeriodLabel = p.worldProgressionLastFiredPeriodLabel || '';
    s.worldProgressionExclusionList = p.worldProgressionExclusionList ?? '';

    s.portraitGeneratorSource = p.portraitGeneratorSource ?? "native";
    s.portraitSkipPromptDialog = p.portraitSkipPromptDialog ?? false;
    s.hideImageGenToasts = p.hideImageGenToasts ?? false;
    s.portraitUseStoryLookback = p.portraitUseStoryLookback ?? false;
    s.portraitStoryLookback = Math.max(0, Math.min(100, Number(p.portraitStoryLookback) || 5));
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

    s.mapArchitectLookback = p.mapArchitectLookback ?? 12;
    s.mapArchitectMaxTokens = p.mapArchitectMaxTokens ?? 25000;
    s.mapArchitectOpener = p.mapArchitectOpener === 'text' ? 'text' : 'tool';
    s.mapArchitectSystemPrompt = p.mapArchitectSystemPrompt || DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT;
    s.mapArchitectConnectionSource = p.mapArchitectConnectionSource ?? "default";
    s.mapArchitectConnectionProfileId = p.mapArchitectConnectionProfileId || "";
    s.mapArchitectCompletionPresetId = p.mapArchitectCompletionPresetId || "";
    s.mapArchitectOllamaUrl = p.mapArchitectOllamaUrl || "http://localhost:11434";
    s.mapArchitectOllamaModel = p.mapArchitectOllamaModel || "";
    s.mapArchitectOpenaiUrl = p.mapArchitectOpenaiUrl || "";
    s.mapArchitectOpenaiKey = p.mapArchitectOpenaiKey || "";
    s.mapArchitectOpenaiModel = p.mapArchitectOpenaiModel || "";
    s.mapRuntimeConnectionSource = p.mapRuntimeConnectionSource ?? p.mapArchitectConnectionSource ?? "default";
    s.mapRuntimeConnectionProfileId = p.mapRuntimeConnectionProfileId || p.mapArchitectConnectionProfileId || "";
    s.mapRuntimeCompletionPresetId = p.mapRuntimeCompletionPresetId || p.mapArchitectCompletionPresetId || "";
    s.mapRuntimeOllamaUrl = p.mapRuntimeOllamaUrl || p.mapArchitectOllamaUrl || "http://localhost:11434";
    s.mapRuntimeOllamaModel = p.mapRuntimeOllamaModel || p.mapArchitectOllamaModel || "";
    s.mapRuntimeOpenaiUrl = p.mapRuntimeOpenaiUrl || p.mapArchitectOpenaiUrl || "";
    s.mapRuntimeOpenaiKey = p.mapRuntimeOpenaiKey || p.mapArchitectOpenaiKey || "";
    s.mapRuntimeOpenaiModel = p.mapRuntimeOpenaiModel || p.mapArchitectOpenaiModel || "";
    s.mapRuntimeConnectionSeeded = true;
    s.mapUpdaterEnabled = p.mapUpdaterEnabled !== false;
    s.mapUpdaterRunEvery = Math.max(1, Number(p.mapUpdaterRunEvery) || 1);
    s.mapUpdaterMaxTokens = p.mapUpdaterMaxTokens ?? 25000;
    s.mapUpdaterSystemPrompt = p.mapUpdaterSystemPrompt || DEFAULT_MAP_UPDATER_SYSTEM_PROMPT;
    s.mapUpdaterLastRunChatLength = p.mapUpdaterLastRunChatLength ?? 0;
    s.mapUpdaterLastRunAt = p.mapUpdaterLastRunAt ?? 0;
    s.mapUpdaterLastSiteRoot = p.mapUpdaterLastSiteRoot || '';
    s.mapUpdaterPendingExitRoot = p.mapUpdaterPendingExitRoot || '';
    s.mapEvolutionEnabled = p.mapEvolutionEnabled !== false;
    s.mapEvolutionIntervalHours = Math.max(1, Number(p.mapEvolutionIntervalHours) || 12);
    s.mapEvolutionOnSiteIntervalHours = (() => {
        const hours = Math.floor(Number(p.mapEvolutionOnSiteIntervalHours));
        if (!Number.isFinite(hours)) return 1;
        if (hours === 0) return 0;
        return Math.max(1, Math.min(168, hours));
    })();
    s.mapEvolutionOnSiteIntervalMinutes = Math.max(0, Math.min(59, Math.floor(Number(p.mapEvolutionOnSiteIntervalMinutes) || 0)));
    s.mapEvolutionOnSitePreset = p.mapEvolutionOnSitePreset === 'standard' ? 'standard' : 'dynamic';
    s.mapEvolutionIntervalHoursBySite = JSON.parse(JSON.stringify(p.mapEvolutionIntervalHoursBySite || {}));
    s.mapEvolutionMaxTokens = p.mapEvolutionMaxTokens ?? 25000;
    s.mapEvolutionCompressEnabled = p.mapEvolutionCompressEnabled !== false;
    s.mapEvolutionCompressThreshold = (() => {
        const n = Math.floor(Number(p.mapEvolutionCompressThreshold));
        return Number.isFinite(n) ? Math.max(500, Math.min(100000, n)) : 10000;
    })();
    s.mapEvolutionNarratorCommitTokens = normalizeMapEvolutionNarratorCommitTokens(p.mapEvolutionNarratorCommitTokens);
    s.mapEvolutionCompressSystemPrompt = p.mapEvolutionCompressSystemPrompt || DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT;
    s.mapEvolutionTickScope = p.mapEvolutionTickScope || 'all';
    s.mapEvolutionTickCount = (() => {
        const n = Number(p.mapEvolutionTickCount);
        return Number.isFinite(n) ? Math.max(0, Math.min(50, n)) : 1;
    })();
    s.mapEvolutionTickRandomize = p.mapEvolutionTickRandomize !== false;
    s.mapEvolutionSelectedRoots = JSON.parse(JSON.stringify(p.mapEvolutionSelectedRoots || []));
    s.mapEvolutionSystemPrompt = p.mapEvolutionSystemPrompt || DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT;
    s.mapEvolutionLastFiredBySite = JSON.parse(JSON.stringify(p.mapEvolutionLastFiredBySite || {}));
    s.mapEvolutionBacklogBySite = JSON.parse(JSON.stringify(p.mapEvolutionBacklogBySite || {}));
    s.mapEvolutionThreadsBySite = JSON.parse(JSON.stringify(p.mapEvolutionThreadsBySite || {}));
    s.dungeonMapRevealAll = !!p.dungeonMapRevealAll;
    s.mapEvolutionLastSiteRoot = p.mapEvolutionLastSiteRoot || '';
    s.mapEvolutionWorldReportLookback = p.mapEvolutionWorldReportLookback ?? 5;
    s.mapEvolutionWorldReportApplications = JSON.parse(JSON.stringify(p.mapEvolutionWorldReportApplications || {}));

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

    s.characterCreationConnectionSource = p.characterCreationConnectionSource ?? "default";
    s.characterCreationConnectionProfileId = p.characterCreationConnectionProfileId || "";
    s.characterCreationCompletionPresetId = p.characterCreationCompletionPresetId || "";
    s.characterCreationOllamaUrl = p.characterCreationOllamaUrl || "http://localhost:11434";
    s.characterCreationOllamaModel = p.characterCreationOllamaModel || "";
    s.characterCreationOpenaiUrl = p.characterCreationOpenaiUrl || "";
    s.characterCreationOpenaiKey = p.characterCreationOpenaiKey || "";
    s.characterCreationOpenaiModel = p.characterCreationOpenaiModel || "";

    // Update settings UI inputs if rendered
    $('#rpg_world_progression_skeleton_factions').val(s.worldProgressionSkeletonFactions ?? 4);
    $('#rpg_world_progression_skeleton_locations').val(s.worldProgressionSkeletonLocations ?? 4);
    $('#rpg_world_progression_skeleton_conflicts').val(s.worldProgressionSkeletonConflicts ?? 3);
    $('#rpg_world_progression_skeleton_use_lorebooks').prop('checked', !!s.worldProgressionSkeletonUseLorebooks);
    $('#rpg_world_progression_skeleton_lorebook_filter_group').toggle(!!s.worldProgressionSkeletonUseLorebooks);
    $('#rpg_world_progression_skeleton_lorebook_only').prop('checked', !!s.worldProgressionSkeletonLorebookOnly);
    $('#rpg_world_progression_skeleton_lorebook_only').prop('disabled', !s.worldProgressionSkeletonUseLorebooks);
    $('#rpg_world_progression_skeleton_lorebook_only_row').css({
        opacity: s.worldProgressionSkeletonUseLorebooks ? '1' : '0.45',
        pointerEvents: s.worldProgressionSkeletonUseLorebooks ? 'auto' : 'none',
    });
    const profileLorebookOnlyActive = !!s.worldProgressionSkeletonUseLorebooks && !!s.worldProgressionSkeletonLorebookOnly;
    $('#rpg_world_progression_skeleton_counts').css({
        opacity: profileLorebookOnlyActive ? '0.4' : '1',
        pointerEvents: profileLorebookOnlyActive ? 'none' : 'auto',
    }).find('input').prop('disabled', profileLorebookOnlyActive);
    if (s.worldProgressionSkeletonUseLorebooks && typeof globalThis._rpgRefreshSkeletonLorebookList === 'function') {
        void globalThis._rpgRefreshSkeletonLorebookList();
    }
    $('#rpg_world_progression_exclusion_list').val(s.worldProgressionExclusionList);
    $('#rpg_world_progression_locations_per_report').val(s.worldProgressionLocationsPerReport ?? 3);
    $('#rpg_world_progression_location_randomize').prop('checked', s.worldProgressionLocationRandomize !== false);

    // Sync portrait connection settings UI
    $('#rpg_portrait_generator_source').val(s.portraitGeneratorSource || 'native');
    $('#rpg_tracker_pollinations_group').toggle((s.portraitGeneratorSource || 'native') === 'pollinations');
    $('#rpg_tracker_portrait_skip_prompt').prop('checked', !!s.portraitSkipPromptDialog);
    $('#rpg_tracker_hide_image_gen_toasts').prop('checked', !!s.hideImageGenToasts);
    $('#rpg_tracker_portrait_use_story_lookback').prop('checked', !!s.portraitUseStoryLookback);
    $('#rpg_tracker_portrait_story_lookback').val(s.portraitStoryLookback ?? 5);
    $('#rpg_tracker_portrait_story_lookback_row').css({
        opacity: s.portraitUseStoryLookback ? '1' : '0.35',
        'pointer-events': s.portraitUseStoryLookback ? 'auto' : 'none',
    });
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

    // Sync Persistent Maps settings UI
    applyMapArchitectOpenerToUi(s.mapArchitectOpener);
    syncMapArchitectOpenerNestedVisibility(s.syspromptModules?.[LOCATION_MAPPING_SECTION_TAG] ?? true);
    $('#rpg_map_architect_lookback').val(s.mapArchitectLookback ?? 12);
    $('#rpg_map_architect_max_tokens').val(s.mapArchitectMaxTokens ?? 25000);
    $('#rpg_map_architect_system_prompt').val(s.mapArchitectSystemPrompt || DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT);
    $('#rpg_map_architect_connection_source').val(s.mapArchitectConnectionSource || 'default');
    $('#rpg_map_architect_connection_profile').val(s.mapArchitectConnectionProfileId || '');
    $('#rpg_map_architect_completion_preset').val(s.mapArchitectCompletionPresetId || '');
    $('#rpg_map_architect_ollama_url').val(s.mapArchitectOllamaUrl || 'http://localhost:11434');
    $('#rpg_map_architect_ollama_model').val(s.mapArchitectOllamaModel || '');
    $('#rpg_map_architect_openai_url').val(s.mapArchitectOpenaiUrl || '');
    $('#rpg_map_architect_openai_key').val(s.mapArchitectOpenaiKey || '');
    $('#rpg_map_architect_openai_model').val(s.mapArchitectOpenaiModel || '');
    $('#rpg_map_architect_openai_model_manual').val(s.mapArchitectOpenaiModel || '');
    applyMapRuntimeConnectionSettingsToUi(s);
    $('#rpg_map_updater_enabled').prop('checked', s.mapUpdaterEnabled !== false);
    $('#rpg_map_updater_run_every').val(s.mapUpdaterRunEvery ?? 1);
    $('#rpg_map_updater_max_tokens').val(s.mapUpdaterMaxTokens ?? 25000);
    $('#rpg_map_updater_system_prompt').val(s.mapUpdaterSystemPrompt || DEFAULT_MAP_UPDATER_SYSTEM_PROMPT);
    $('#rpg_map_evolution_enabled').prop('checked', s.mapEvolutionEnabled !== false);
    $('#rpg_map_evolution_interval_hours').val(s.mapEvolutionIntervalHours ?? 12);
    $('#rpg_map_evolution_onsite_interval_hours').val(s.mapEvolutionOnSiteIntervalHours ?? 1);
    $('#rpg_map_evolution_onsite_interval_minutes').val(s.mapEvolutionOnSiteIntervalMinutes ?? 0);
    $('#rpg_map_evolution_onsite_preset').val(s.mapEvolutionOnSitePreset === 'standard' ? 'standard' : 'dynamic');
    $('#rpg_map_evolution_max_tokens').val(s.mapEvolutionMaxTokens ?? 25000);
    $('#rpg_map_evolution_compress_enabled').prop('checked', s.mapEvolutionCompressEnabled !== false);
    $('#rpg_map_evolution_compress_threshold').val(s.mapEvolutionCompressThreshold ?? 10000);
    $('#rpg_map_evolution_narrator_commit_tokens').val(s.mapEvolutionNarratorCommitTokens ?? 2000);
    $('#rpg_map_evolution_world_report_lookback').val(s.mapEvolutionWorldReportLookback ?? 5);
    applyMapEvolutionTickSettingsToUi(s);
    $('#rpg_map_evolution_system_prompt').val(s.mapEvolutionSystemPrompt || DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT);
    $('#rpg_map_evolution_compress_prompt').val(s.mapEvolutionCompressSystemPrompt || DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT);
    syncMapThemeUi(s);

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
    $('#rpg_map_architect_profile_group').toggle(s.mapArchitectConnectionSource === 'profile');
    $('#rpg_map_architect_ollama_group').toggle(s.mapArchitectConnectionSource === 'ollama');
    $('#rpg_map_architect_openai_group').toggle(s.mapArchitectConnectionSource === 'openai');
    $('#rpg_world_profile_group').toggle(s.worldConnectionSource === 'profile');
    $('#rpg_world_ollama_group').toggle(s.worldConnectionSource === 'ollama');
    $('#rpg_world_openai_group').toggle(s.worldConnectionSource === 'openai');
    $('#rpg_gs_wizard_profile_group').toggle(s.gameSystemWizardConnectionSource === 'profile');
    $('#rpg_gs_wizard_ollama_group').toggle(s.gameSystemWizardConnectionSource === 'ollama');
    $('#rpg_gs_wizard_openai_group').toggle(s.gameSystemWizardConnectionSource === 'openai');

    // Toggle container visibilities
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
    const ol = (items) => `<ol style="margin: 6px 0 0 0; padding-left: 20px; text-align: left; list-style-position: outside;">${items.map(t => `<li style="margin-bottom: 4px;">${t}</li>`).join('')}</ol>`;
    const popupBody = `
            <div style="font-size: 0.9em; line-height: 1.5; max-width: 520px; text-align: left;">
                ${card('🔧', 'RollTheDice',
        `<p style="margin: 0 0 8px 0;"><b>RollTheDice</b> is called on-demand. It can inject into the context in the middle of an output. Well, not really — LLMs can't receive inputs mid-output. What happens is this:</p>
                    ${ol([
                        'LLM starts outputting its normal narrative message.',
                        'It realizes it needs a roll.',
                        'It calls the tool and <b>stops</b> outputting.',
                        'RollTheDice runs its code and produces a result, nudging the LLM to retry if it messed up the tool-call JSON.',
                        'LLM reads the result from the RollTheDice tool, sees a number and success or failure.',
                        'LLM continues narrating now with the roll result in its context.',
                    ])}
                    <p style="margin: 10px 0 0 0;"><b>Pros:</b> LLM can't know the numbers beforehand. Completely sycophancy-proof in every circumstance.</p>
                    <p style="margin: 6px 0 0 0;"><b>Cons:</b> Breaks the output into chunks; costs more because every interrupt re-sends the whole context/story (input tokens); can cause latency.</p>`
    )}
                ${card('🎲', 'RNG Queue',
        `<p style="margin: 0 0 8px 0;">How it works:</p>
                    ${ol([
                        'Numbers are pre-rolled with JavaScript. The LLM always sees numbers in context, prepended to the last user input.',
                        'The LLM only has to pick numbers from the queue in order and "slot them in."',
                    ])}
                    <p style="margin: 10px 0 0 0;"><b>Pros:</b> Any number of rolls within a single output; no breaks in output necessary; costs less.</p>
                    <p style="margin: 6px 0 0 0;"><b>Cons:</b> The LLM can <b>see</b> what number is coming up, potentially lowballing a skill-check DC so that you can pass — though this is in theory; it might not actually do that. It's just possible.</p>`
    )}
                ${card('🧭', 'CYOA Mode + combat fix the queue',
        `<p style="margin: 0 0 8px 0;"><b>CYOA Mode</b> fixes the queue's foresight problem. It forces the LLM to commit to the numbers at the end of the <b>previous</b> output, in the choice — e.g. <code>Lockpicking DC 18</code>. That DC is locked in. When it sees the roll on the next turn, the DC is already decided.</p>
                    <p style="margin: 0 0 8px 0;">Same goes for <b>combat</b>, which works on a deterministic initiative/turn grid. That also prevents sycophancy.</p>
                    <p style="margin: 0;"><b>RNG Queue only fails</b> in freeform/narrative situations <b>without</b> CYOA Mode — which is why it isn't recommended for that specifically.</p>`
    )}
                <div style="background: rgba(255,200,50,0.08); border: 1px solid rgba(255,200,50,0.25); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 0.88em; text-align: left;">
                    <b style="color: #ffcc33;">⚠ Important:</b> RollTheDice requires <b>"Enable function calling"</b> in SillyTavern's AI Response Configuration.
                </div>
                ${card('📋', 'Which system should I use?',
        `<ul style="margin: 4px 0 0 0; padding-left: 20px; text-align: left; list-style-position: outside;">
                        <li style="margin-bottom: 4px;"><b>Pre-Seeded + Tool Calls (recommended without CYOA):</b> Outside combat the model sees only <b>RollTheDice</b>; during an active combat round it sees only the <b>RNG Queue</b>. Prompt and tool schema switch together.</li>
                        <li style="margin-bottom: 4px;"><b>With CYOA Mode:</b> Prefer the <b>RNG Queue</b> — choice DCs are already committed, so foresight isn't a sycophancy risk.</li>
                        <li><b>Pre-Seeded Only:</b> Queue-only. Use if your model doesn't support function/tool calling. Fine for combat and CYOA; weaker for freeform narrative without CYOA.</li>
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
                ${card('Normal (no length instructions)', 'Balanced narration. The narrator may lightly paraphrase or expand your dialogue and actions when it fits your character, without imposing an output-length instruction.')}
                ${card('Shorter Outputs', 'Keeps the output length modest and discourages it from drifting out of control, while preserving the normal narration style.')}
                ${card('High-Agency Mode', 'Keeps outputs short to moderate in length. Also does not have the instruction of lightly expanding on your actions, likely leaving more room for you to respond and direct the scene.')}
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
                ${card('🎲', 'Loot Rolls',
        `When loot is received, dice rolls are made to determine its quality — whether something is a battered common item or a rare find. Adds meaningful variance to rewards.`
    )}
                ${card('🌍', 'Random Event Rolls',
        `Random events are rolled when time skips or travel occurs. A chance encounter, a weather shift, an ambush — things that happen without the player initiating them. Keeps the world feeling alive.`
    )}
                ${card('💤', 'Resting Restrictions (=>9h between rests)',
        `Resting is limited to once every 9 hours of in-game time. Prevents exploiting rest as a free heal between every fight, and reflects the reality that you can't just nap on demand.`
    )}
                ${card('⛺', 'Benched Party',
        `Tracks party members who are temporarily away from you — hospitalized, scouting ahead, captured, sent on a side task, etc. — in a separate [BENCHED PARTY] roster while reunion remains plausible. The GM is told what this means so it won't narrate them back at your side until the story brings them back on-screen. Benched members become eligible for off-screen simulation updates via World Reports (🌍), allowing the simulator to advance their individual subplots in the background. Turn off if you don't want temporary separations tracked separately from your active party.`
    )}
                ${card('🗺️', 'Persistent Maps (Alpha)',
        `When you enter a mapped site — dungeon, ruin, stronghold, lair, town, or city — a dedicated Map Architect builds a hidden objective map (room-scale for interiors, district-scale for settlements). The GM may invent shops and interiors against that skeleton. Alpha: expect sharp edges. Function calling must be enabled.`
    )}
                ${card('🧭', 'CYOA Mode (action choices every turn)',
        `Choose-your-own-adventure style: the narrator ends outputs with numbered courses of action and fitting emojis so you can pick what to do next.`
    )}
                ${card('💞', 'Relationship System (Friendship & Affection)',
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
                                <li style="margin-top:8px;"><b>Advanced Mode (Tools)</b> — Multi-turn ReAct loop: the model reasons (<i>Thought</i>), calls a tool (<i>Action</i>), receives a result (<i>Observation</i>), and repeats until it calls <code>finish</code> or hits Max Turns. Tools include <code>record</code>, <code>update</code>, <code>activate</code>, <code>deactivate</code>, <code>delete</code>, and <code>search</code>. I've been recommending Gemini Flash-Lite and Flash, but Deepseek V4 Flash 0731 and GPT-5.6 Luna are also very promising and seriously inexpensive. I'm not sure which is best yet, so treat these as tentative options. GPT-5x Mini or even Nano can also be good.</li>
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
                            <p style="margin-top:4px;">When <b>Show Location Images</b> is enabled or the party is inside a mapped site, the panel header switches between <b>Campaign Records</b> and <b>Visuals/Map</b>. Otherwise only the standard Campaign Records tree is shown.</p>

                            <h4 style="margin-bottom: 5px;">🗺️ Location Images &amp; Visuals/Map</h4>
                            <p>Location scene art is <b>opt-in</b> and <b>off by default</b>. Enable it from <b>Extension Settings → Portraits and Location Images → Location Images &amp; Visualization</b>.</p>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Show Location Images</b> — Master toggle. When on, the Locations book gains hierarchical scene art: thumbnails on the location tree, wide 16:9 images in detail view, drag-and-drop upload, and the <b>Campaign Records / Visuals/Map</b> switch in this panel. Also turns on automatically if you enable Real-Time Visualization Mode or Auto-Generate Locations.</li>
                                <li><b>Auto-Generate Locations</b> — Background scene art for new location lorebook entries that do not already have an image. Mutually exclusive with Real-Time Visualization Mode.</li>
                                <li><b>Include Present NPCs in Location Scene Prompts</b> — Injects NPCs named in the latest narrator output (Present-Now name scanner: first/last name only, not Lorebook Agent keys) plus the linked Player Character into location image prompts. Locked on while Real-Time Visualization Mode is active.</li>
                                                <li><b>Real-Time Visualization Mode</b> — Generates location images in Visuals/Map from current chat context and characters present. Choose a trigger: <b>On location enter</b> (once per place with no image), <b>On location change</b> (fresh image on each path change including revisits), or <b>Every N outputs</b> (still regenerates on location change, plus every N chat outputs — set N to 1 for every output). Enables Show Location Images and present-NPC prompts as a locked bundle; disables Auto-Generate Locations. Can be turned on without Show Location Images already being enabled first.</li>
                            </ul>
                            <p style="margin-top:8px;"><b>Visuals/Map</b> (agent panel) shows the current location: a wide location hero image when scene art is on, a knowledge-filtered site map while inside a mapped dungeon, and tiles for characters present (active Lorebook NPCs plus the linked Player Character). The site map can be popped out into its own window. Click the hero, a revealed room, or a tile to open the matching location or character card. On a mapped Location root, the cyan <b>MAP</b> chip opens the private GM inspector and the adjacent <b>X</b> removes only that <code>[MAP]</code> (CORE stays). Unmapped location roots show a muted <b>+ MAP</b>: Auto spends one Map Architect turn to fill entrance/kind/scale/threat, a detailed generation prompt, and a brief description from lore plus recent story, then generates the map; Manual is the same fields filled by you. The Locations header <b>Add mapped location</b> button creates a new root and its map. Auto takes a name, optional brief, and story lookback (0 = no chat); Manual is the same fields filled by you. The location name is always added as a keyword. The narrator is not involved. Scene art is generated according to your Location Images settings — either on lorebook entry creation (Auto-Generate Locations) or on arrival (Real-Time Visualization Mode).</p>
                            <p style="margin-top:4px;"><i>Tip: With Real-Time Visualization Mode on, use Visuals/Map in the Lorebook Agent to see scene art as you move through the story (trigger depends on your Real-Time settings).</i></p>

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

/**
 * Apply a portrait prompt preset bundle into settings + visible textareas.
 * @param {object} settings
 * @param {{ npcSystemPrompt?: string, characterSystemPrompt?: string, locationSystemPrompt?: string, includePresentNpcs?: boolean, wordTarget?: number }} bundle
 * @param {{ activeId?: string|null }} [meta]
 */
function applyPortraitPromptPresetBundle(settings, bundle, meta = {}) {
    if (bundle.npcSystemPrompt !== undefined) {
        settings.portraitNpcSystemPrompt = bundle.npcSystemPrompt || '';
    }
    if (bundle.characterSystemPrompt !== undefined) {
        settings.portraitCharacterSystemPrompt = bundle.characterSystemPrompt || '';
    }
    if (bundle.locationSystemPrompt !== undefined) {
        settings.portraitLocationSystemPrompt = bundle.locationSystemPrompt || '';
    }
    if (bundle.includePresentNpcs !== undefined) {
        settings.portraitLocationIncludePresentNpcs = !!bundle.includePresentNpcs;
    }
    if (bundle.wordTarget !== undefined) {
        settings.portraitPromptWordTarget = bundle.wordTarget;
    }
    if (meta.activeId !== undefined) {
        settings.activePortraitPromptPresetId = meta.activeId || '';
    }

    $('#rpg_portrait_npc_system_prompt').val(settings.portraitNpcSystemPrompt);
    $('#rpg_portrait_character_system_prompt').val(settings.portraitCharacterSystemPrompt);
    if (bundle.locationSystemPrompt !== undefined) {
        setPortraitLocationPromptTextarea(settings.portraitLocationSystemPrompt);
    }
    if (bundle.includePresentNpcs !== undefined) {
        $('#rpg_portrait_location_include_present_npcs').prop('checked', !!settings.portraitLocationIncludePresentNpcs);
    }
    if (bundle.wordTarget !== undefined) {
        $('#rpg_portrait_prompt_word_target').val(settings.portraitPromptWordTarget);
    }
    syncLocationImageDependentUi(settings);
}

function refreshPortraitPromptPresetsList() {
    const settings = getSettings();
    const container = document.getElementById('rpg_portrait_prompt_presets_container');
    const list = document.getElementById('rpg_portrait_prompt_presets_list');
    if (!container || !list) return;

    container.style.display = 'block';
    list.innerHTML = '';

    const appendSectionLabel = (label) => {
        const header = document.createElement('div');
        header.textContent = label;
        header.style.cssText = 'font-size:0.78em;font-weight:bold;opacity:0.7;margin:6px 0 2px;';
        list.appendChild(header);
    };

    const appendRow = ({ name, title, onLoad, onDelete, active }) => {
        const row = document.createElement('div');
        row.className = 'flex-container alignitemscenter gap-1';
        row.style.background = active ? 'rgba(120,180,255,0.12)' : 'rgba(255,255,255,0.05)';
        row.style.padding = '4px 8px';
        row.style.borderRadius = '4px';
        if (active) row.style.outline = '1px solid rgba(120,180,255,0.35)';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.style.flex = '1';
        nameSpan.style.fontSize = '0.85em';
        nameSpan.style.cursor = 'pointer';
        nameSpan.className = 'interactable';
        nameSpan.title = title || 'Click to load this portrait prompt setup';
        nameSpan.addEventListener('click', onLoad);

        row.appendChild(nameSpan);

        if (typeof onDelete === 'function') {
            const delBtn = document.createElement('i');
            delBtn.className = 'fa-solid fa-trash-can interactable';
            delBtn.style.fontSize = '0.8em';
            delBtn.style.opacity = '0.5';
            delBtn.title = 'Delete setup';
            delBtn.addEventListener('click', onDelete);
            row.appendChild(delBtn);
        }

        list.appendChild(row);
    };

    appendSectionLabel('Factory Art Styles');
    for (const preset of FACTORY_PORTRAIT_PROMPT_PRESETS) {
        appendRow({
            name: preset.name,
            title: preset.description || `Load factory style: ${preset.name}`,
            active: settings.activePortraitPromptPresetId === preset.id,
            onLoad: () => {
                const includeNpcs = !!settings.portraitLocationIncludePresentNpcs;
                const bundle = resolveFactoryPortraitPromptBundle(preset.id, includeNpcs);
                applyPortraitPromptPresetBundle(settings, {
                    npcSystemPrompt: bundle.npcSystemPrompt,
                    characterSystemPrompt: bundle.characterSystemPrompt,
                    locationSystemPrompt: bundle.locationSystemPrompt,
                    wordTarget: bundle.wordTarget,
                }, { activeId: preset.id });
                saveSettings();
                refreshPortraitPromptPresetsList();
                toastr['success'](`Loaded factory style: ${preset.name}`, 'Portrait Prompt Library');
            },
        });
    }

    const entries = Object.entries(settings.savedPortraitPromptPresets || {});
    appendSectionLabel(entries.length ? 'Your Saved Setups' : 'Your Saved Setups (none yet)');
    entries.forEach(([name, preset]) => {
        appendRow({
            name,
            active: settings.activePortraitPromptPresetId === `user:${name}`,
            onLoad: () => {
                applyPortraitPromptPresetBundle(settings, preset, { activeId: `user:${name}` });
                saveSettings();
                refreshPortraitPromptPresetsList();
                toastr['success'](`Loaded portrait prompt setup: ${name}`, 'Portrait Prompt Library');
            },
            onDelete: () => {
                if (confirm(`Are you sure you want to delete the portrait prompt setup "${name}"?`)) {
                    delete settings.savedPortraitPromptPresets[name];
                    if (settings.activePortraitPromptPresetId === `user:${name}`) {
                        settings.activePortraitPromptPresetId = '';
                    }
                    saveSettings();
                    refreshPortraitPromptPresetsList();
                    toastr['info'](`Deleted setup: ${name}`, 'Portrait Prompt Library');
                }
            },
        });
    });
}

async function showPortraitSettingsMenu(entityName, onRefresh, npcContent = null, options = {}) {
    const refresh = onRefresh || refreshRenderedView;
    const s = getSettings();
    const currentSrc = String(options.currentSrc || lookupCustomPortraitSrc(s, entityName) || '');
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

    const persistPortrait = typeof options.applyPortrait === 'function'
        ? options.applyPortrait
        : (src) => applyPortraitData(entityName, src);
    const localApply = async (src) => {
        await persistPortrait(src);
        refresh();
        if (typeof options.applyPortrait !== 'function') {
            void runtimeState.refreshNpcManifest().catch(() => { });
        }
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

/** Sync Player Card + name-only ST persona prefs before onboarding generation. */
function syncOnboardingPersonaPrefsFromDom(el) {
    if (!el) return;
    const playerCardCb = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-onboarding-player-card-cb'));
    const stPersonaCb = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-onboarding-st-persona-cb'));
    const wordsSelect = /** @type {HTMLSelectElement|null} */ (el.querySelector('#rt-onboarding-persona-words'));
    const wordsCustom = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-onboarding-persona-words-custom'));
    const s = getSettings();
    if (playerCardCb) s.onboardingCreatePersona = !!playerCardCb.checked;
    if (stPersonaCb) s.onboardingCreateSillyTavernPersona = !!stPersonaCb.checked;
    if (wordsSelect) s.onboardingPersonaWords = wordsSelect.value || '150';
    if (wordsCustom) s.onboardingPersonaWordsCustom = wordsCustom.value || '';
    saveSettings();
}

/**
 * After a quick onboarding generate, optionally create a Lorebook Player Card
 * and/or a name-only SillyTavern persona.
 * Persona-derived onboarding preserves the active source Persona description.
 * Uses settings (not DOM) because sendDirectPrompt → refreshRenderedView removes the onboarding UI.
 * @param {string} [extraHints]
 * @param {{ preserveActivePersona?: boolean, preferredName?: string }} [options]
 */
async function maybeCreateOnboardingPersona(extraHints = '', options = {}) {
    const s = getSettings();
    const createPlayerCard = !!s.onboardingCreatePersona;
    const createStPersona = s.onboardingCreateSillyTavernPersona !== false;
    if (!createPlayerCard && !createStPersona) return;
    const preferredName = String(options.preferredName || '').trim();
    const charName = preferredName || extractCharNameFromMemo(s.currentMemo) || 'My Character';
    if (createStPersona) {
        try {
            await activateSillyTavernPersona(charName, {
                preserveExistingDescription: !!options.preserveActivePersona,
            });
        } catch (error) {
            console.error('[RPG Tracker] Could not create name-only ST persona:', error);
            toastr['warning'](`Character created, but the ST persona for "${charName}" could not be created.`, 'RPG Tracker');
        }
    }
    if (!createPlayerCard) return;
    const wordsRaw = s.onboardingPersonaWords === 'other'
        ? s.onboardingPersonaWordsCustom
        : s.onboardingPersonaWords;
    const wordCount = parseInt(String(wordsRaw || '150'), 10) || 150;
    toastr['info'](`Generating Lorebook Agent Player Card for "${charName}"…`, 'RPG Tracker');
    const bio = await generatePersonaBio(charName, wordCount, extraHints);
    if (bio) {
        showPersonaConfirmOverlay(bio, charName, wordCount, extraHints);
    } else {
        toastr['warning']('Character created, but Player Card generation failed.', 'RPG Tracker');
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
    const displayMemo = substituteDisplayMacros(runtimeState.historyViewIndex === -1
        ? buildCombatDisplayMemo(memo, s.combatDefeatedUi)
        : memo);
    const xpAnimationContext = `${getActiveChatId() || 'global'}::${runtimeState.historyViewIndex === -1 ? 'live' : `history-${runtimeState.historyViewIndex}`}`;

    const collapsed = loadCollapsed();
    const detached = loadDetached();

    // Extract world time from THIS snapshot for frustration computation
    const timeMatch = (memo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    const currentTime = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';

    const el = document.getElementById('rpg-tracker-render');
    if (el) {
        const bottomXp = /** @type {HTMLElement|null} */ (document.getElementById('rt-bottom-xp-bar'));
        const xpAnimationHost = s.xpBarAtBottom === true ? bottomXp : el;
        const capturedXp = captureXpGainAnimationState(xpAnimationHost, xpAnimationContext);
        const capturedBars = captureBarChangeAnimationState(el, xpAnimationContext);
        const questsEnabled = s.syspromptModules?.quests !== false && !!(memo && memo.trim());
        let html;

        if (s.panelLayoutMode === 'tabs') {
            const questsCtx = questsEnabled ? { quests: getDisplayQuests(displayMemo), currentTime } : null;
            html = renderTabModeView(displayMemo, _sectionPages, questsCtx);
        } else {
            html = renderMemoAsCards(displayMemo, null, _sectionPages);
            // Append quest log section if module is enabled and we are not on the onboarding screen
            if (questsEnabled) {
                html += renderQuestLog(getDisplayQuests(displayMemo), currentTime, collapsed, detached);
            }
        }

        el.innerHTML = html;
        if (bottomXp) {
            const bottomXpHtml = s.xpBarAtBottom === true ? renderBottomXpBar(displayMemo) : '';
            bottomXp.innerHTML = bottomXpHtml;
            bottomXp.style.display = bottomXpHtml ? 'block' : 'none';
        }
        playXpGainAnimation(xpAnimationHost, capturedXp, xpAnimationContext);
        playBarChangeAnimations(el, capturedBars, xpAnimationContext);
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
                const capturedXp = captureXpGainAnimationState(body, xpAnimationContext);
                const capturedBars = captureBarChangeAnimationState(body, xpAnimationContext);
                if (tag === 'QUESTS') {
                    body.innerHTML = renderQuestLog(getDisplayQuests(displayMemo), currentTime, collapsed, detached, 'QUESTS');
                } else {
                    body.innerHTML = renderMemoAsCards(displayMemo, tag, _sectionPages);
                }
                playXpGainAnimation(body, capturedXp, xpAnimationContext);
                playBarChangeAnimations(body, capturedBars, xpAnimationContext);
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
        MODULE_BOOK_CATEGORY,
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
        captureRouterLoreState,
        restoreActiveDungeonMapHistory,
        checkAndTriggerAutoGenerations,
        clampFloatingPanelToViewport,
        resolveViewportClampedGeometry,
        clampRelationshipValue,
        confirmAndPurgeWorldHistory,
        deleteLorebookEntry,
        deleteDungeonMapFromLocationEntry,
        deleteNpcFromLibrary,
        escapeHtml,
        escapeHtmlWithColor,
        exportNpcToFile,
        extractCurrentTimeStr,
        fileToDataUrl,
        fetchSrcAsDataUrl,
        formatInWorldTime,
        getLorebookManifest,
        getNarrativeBlocks,
        getNpcRelationshipMax,
        getNpcRelationshipMaxDefault,
        getRequestHeaders,
        getRouterTick,
        getMapUpdaterTick,
        getSettings,
        handleTrackerEnabledChange,
        importNpcPackages,
        isMapUpdaterRunning,
        isMapEvolutionRunning,
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
        openPcSectionEditor,
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
        runMapArchitect,
        inferMapArchitectArgs,
        runRealtimeSceneArtCheck,
        runMapUpdaterPass,
        runMapEvolutionPass,
        listMappedEvolutionSites,
        runRouterPass,
        runStateModelPass,
        sanitizeLorebookRecordContent,
        saveChatState,
        saveNpcToLibrary,
        saveSettings,
        scaleImageTo512Square,
        scaleImageToLandscape,
        sendDirectPrompt,
        sendStateRequest,
        setLorebookEntryPinned,
        setNpcRelationshipMaxForCurrentChat,
        setupDeltaResize,
        setupResizeObserver,
        showLocationImageSettingsMenu,
        showLorebookAgentDocumentation,
        showPortraitSettingsMenu,
        stopRouterPass,
        stopMapUpdaterPass,
        stopMapEvolutionPass,
        syncCampaignPrefixAndWorldsForChat,
        syncMemoView,
        syncRouterPrefixDisplays,
        triggerBackgroundPortraitGeneration,
        updateAgentStatusIndicator,
        updateChatLinkUI,
        updateLorebookEntry,
        updateWorldInfoCache,
        rememberCampaignBook,
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
    void applyDungeonMapForHistoryView();
}

async function applyDungeonMapForHistoryView() {
    const s = getSettings();
    if (runtimeState.historyViewIndex === -1) {
        runtimeState.dungeonMapHistoryOverlay = null;
        const liveMap = runtimeState.liveDungeonMapBackup;
        runtimeState.liveDungeonMapBackup = null;
        if (liveMap) {
            try { await restoreActiveDungeonMapHistory(liveMap); } catch (error) {
                console.warn('[RPG Tracker] Could not restore live dungeon map occupancy:', error);
            }
        }
        return;
    }
    if (!runtimeState.liveDungeonMapBackup) {
        try {
            runtimeState.liveDungeonMapBackup = await captureActiveDungeonMapHistory();
        } catch (error) {
            console.warn('[RPG Tracker] Could not snapshot live dungeon map occupancy:', error);
        }
    }
    const overlay = getDungeonMapHistoryEntry(s, runtimeState.historyViewIndex);
    runtimeState.dungeonMapHistoryOverlay = overlay;
    if (overlay) {
        try { await restoreActiveDungeonMapHistory(overlay); } catch (error) {
            console.warn('[RPG Tracker] Could not roll dungeon map occupancy back to this snapshot:', error);
        }
    }
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
        runtimeState.dungeonMapHistoryOverlay = null;
    } else {
        // Snapshot stone
        const snapshot = s.memoHistory[runtimeState.historyViewIndex];
        textarea.value = snapshot ?? '';
        textarea.readOnly = true;
        navLabel.classList.add('clickable');
        navLabel.title = 'Click to RESTORE this state as LIVE';
        runtimeState.dungeonMapHistoryOverlay = getDungeonMapHistoryEntry(s, runtimeState.historyViewIndex);
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
    if (typeof runtimeState.refreshImmersionView === 'function') {
        void runtimeState.refreshImmersionView();
    }
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
    const busy = !!running || isMapUpdaterRunning() || isMapEvolutionRunning();
    if (stopBtn) stopBtn.style.display = busy ? 'flex' : 'none';
    if (playBtn) playBtn.style.opacity = busy ? '0.3' : '';
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
        example: 'COMBAT ROUND 1\nCultist Acolyte: 15/15 HP\nAtt/def: Spell Atk +4 | Spell DC 14 | Dagger (1 attack, +1 / 1d4-1 Piercing) | Robes (AC: 11)\nSaves: Fort +1, Ref +2, Will +3\nAbilities: Spellcasting\nSpells: Cantrips: Fire Bolt, Prestidigitation\nSpells: Level 1 (2/2): Magic Missile, Shield\nOther: Soldier Tier Spellcaster\nStatus: Healthy\n\nElite Enforcer: 42/42 HP\nAtt/def: Warhammer (2 attacks, +9/+4 / 1d10+4 Bludgeoning) | Plate Armor (AC: 17)\nSaves: Fort +5, Ref +3, Will +4\nAbilities: Brutal Strike (On a Warhammer hit, deal +1d10 Bludgeoning damage and force a Fort DC 16 save or knock the target prone; 2/2)\nOther: Elite Tier\nStatus: Healthy'
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

function persistMainSyspromptBackupIfChanged(result, settings) {
    if (result?.changed) saveSettings(true);
    updateMainSyspromptBackupStatusUi(settings);
}

function restoreTrackedMainSysprompt(settings, { manual = false } = {}) {
    const restored = restoreMainSyspromptStash(settings, { manual });
    if (restored) saveSettings(true);
    updateMainSyspromptBackupStatusUi(settings);
    return restored;
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
    hydrateMainSyspromptBackup(settings);
    const backupLen = getEffectiveBackupText(settings).length;
    if (!backupLen) {
        statusEl.textContent = 'No backup saved yet. It is created automatically before the framework overwrites Main, and kept in this browser even if the tracker or extension is turned off.';
        return;
    }
    statusEl.textContent = `Backup saved (${backupLen.toLocaleString()} characters). Kept if you disable the tracker or the extension.`;
}

function syncMainSyspromptBackupControlsUi() {
    updateMainSyspromptBackupStatusUi(getSettings());
}

async function handleTrackerEnabledChange(settings, enabled) {
    settings.enabled = !!enabled;
    saveSettings();
    updatePanelStatus();
    if (settings.enabled) {
        await autoApplySysprompt(true);
    } else {
        restoreTrackedMainSysprompt(settings);
        void resetCombatProfileOverride(settings);
        try { stopRouterPass(); } catch (_) { /* ignore */ }
        try { stopMapUpdaterPass(); } catch (_) { /* ignore */ }
        try { stopMapEvolutionPass(); } catch (_) { /* ignore */ }
    }
}

let _autoApplyTimer = null;
let _stashDeferCount = 0;
let _restoreDeferCount = 0;
const MAX_STASH_DEFER = 25;
let _lastDynamicRngCombatState = null;

export async function autoApplySysprompt(force = false) {
    const s = getSettings();
    // Keep CreateAreaMap / Map Updater in sync even when Custom Sysprompt Mode
    // skips rewriting Quick Prompt Main.
    syncLocationMappingRuntime();
    if (s.customSysprompt) return;
    if (!force && !s.enabled) return;

    const content = await fetchBaseSyspromptRaw(s);
    if (!content) return;

    const built = buildSysprompt(content);

    if (s.enabled && isMainSyspromptBackupEnabled(s)) {
        const result = captureMainSyspromptBackup(s, { builtFrameworkText: built });
        persistMainSyspromptBackupIfChanged(result, s);
        if (result.shouldDefer) {
            if (_stashDeferCount < MAX_STASH_DEFER) {
                _stashDeferCount++;
                scheduleAutoApply();
                return;
            }
            if (!getEffectiveBackupText(s).trim()) {
                console.warn('[RPG Tracker] Refusing to overwrite Quick Prompt Main: backup source is not ready and no durable backup exists.');
                return;
            }
        }
        if (!result.ok && !getEffectiveBackupText(s).trim()) {
            console.warn('[RPG Tracker] Refusing to overwrite Quick Prompt Main until a user backup can be saved.');
            return;
        }
    }
    _stashDeferCount = 0;

    setLiveMainSyspromptText(built);
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
    syncLocationMappingRuntime();
    const s = getSettings();
    if (!s.enabled || s.customSysprompt) return;
    if (_autoApplyTimer) clearTimeout(_autoApplyTimer);
    _autoApplyTimer = setTimeout(() => { _autoApplyTimer = null; autoApplySysprompt(); }, 400);
}

function scheduleDisabledTrackerMainRestore() {
    const s = getSettings();
    if (s.enabled || s.customSysprompt) return;
    if (maybeRestoreMainIfTrackerDisabled(s)) {
        saveSettings(true);
        updateMainSyspromptBackupStatusUi(s);
        _restoreDeferCount = 0;
        return;
    }
    if (!isMainSyspromptSourceReady() && _restoreDeferCount < MAX_STASH_DEFER) {
        _restoreDeferCount++;
        setTimeout(scheduleDisabledTrackerMainRestore, 400);
    }
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
        // CYOA is injected above the RNG queue by the generate interceptor — never into Main.
        if (row.tag === 'CYOA_mode') return '';
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

/**
 * Bind one feature-specific connection drawer to the standard request settings
 * shape without coupling that feature to the State Tracker connection.
 *
 * @param {{uiPrefix:string, keyPrefix:string, settings:Record<string, any>, presetManager:any}} options
 */
async function bindFeatureConnectionSettings(options) {
    const { uiPrefix, keyPrefix, settings, presetManager } = options;
    const source = $(`#${uiPrefix}_connection_source`);
    if (!source.length) return;

    const key = (suffix) => `${keyPrefix}${suffix}`;
    const profileGroup = $(`#${uiPrefix}_profile_group`);
    const profileSelect = $(`#${uiPrefix}_connection_profile`);
    const ollamaGroup = $(`#${uiPrefix}_ollama_group`);
    const ollamaUrl = $(`#${uiPrefix}_ollama_url`);
    const ollamaModel = $(`#${uiPrefix}_ollama_model`);
    const openaiGroup = $(`#${uiPrefix}_openai_group`);
    const openaiUrl = $(`#${uiPrefix}_openai_url`);
    const openaiKey = $(`#${uiPrefix}_openai_key`);
    const openaiModel = $(`#${uiPrefix}_openai_model`);
    const openaiManual = $(`#${uiPrefix}_openai_model_manual`);
    const presetSelect = $(`#${uiPrefix}_completion_preset`);

    const updatePanels = () => {
        const value = source.val();
        profileGroup.toggle(value === 'profile');
        ollamaGroup.toggle(value === 'ollama');
        openaiGroup.toggle(value === 'openai');
    };

    source.val(settings[key('ConnectionSource')] || 'default').on('change', function () {
        settings[key('ConnectionSource')] = String($(this).val() || 'default');
        updatePanels();
        saveSettings();
    });
    updatePanels();

    ollamaUrl.val(settings[key('OllamaUrl')] || 'http://localhost:11434').on('input', function () {
        settings[key('OllamaUrl')] = String($(this).val() || '');
        saveSettings();
    });
    const savedOllamaModel = String(settings[key('OllamaModel')] || '');
    ollamaModel.empty().append('<option value="">-- Select Model --</option>');
    if (savedOllamaModel) {
        ollamaModel.append($('<option></option>').val(savedOllamaModel).text(savedOllamaModel));
    }
    ollamaModel.val(savedOllamaModel).on('change', function () {
        settings[key('OllamaModel')] = String($(this).val() || '');
        saveSettings();
    });
    $(`#${uiPrefix}_ollama_refresh`).on('click', async function () {
        const url = String(ollamaUrl.val() || '');
        if (!url) return toastr['info']('Please enter an Ollama URL first.');
        try {
            toastr['info']('Fetching Ollama models...');
            const models = await fetchOllamaModels(url);
            ollamaModel.empty().append('<option value="">-- Select Model --</option>');
            models.forEach((model) => {
                ollamaModel.append($('<option></option>').val(model.name).text(model.name));
            });
            ollamaModel.val(settings[key('OllamaModel')] || '');
            toastr['success']('Ollama models updated.');
        } catch (error) {
            console.error(`[RPG Tracker] ${keyPrefix} Ollama fetch failed:`, error);
            toastr['error']('Failed to fetch Ollama models. Check console.');
        }
    });

    openaiUrl.val(settings[key('OpenaiUrl')] || '').on('input', function () {
        settings[key('OpenaiUrl')] = String($(this).val() || '');
        saveSettings();
    });
    openaiKey.val(settings[key('OpenaiKey')] || '').on('input', function () {
        settings[key('OpenaiKey')] = String($(this).val() || '');
        saveSettings();
    });
    openaiManual.val(settings[key('OpenaiModel')] || '');
    openaiModel.on('change', function () {
        const value = String($(this).val() || '');
        if (value) openaiManual.val('');
        settings[key('OpenaiModel')] = value || String(openaiManual.val() || '').trim();
        saveSettings();
    });
    openaiManual.on('input', function () {
        const value = String($(this).val() || '').trim();
        if (value) openaiModel.val('');
        settings[key('OpenaiModel')] = value || String(openaiModel.val() || '');
        saveSettings();
    });
    $(`#${uiPrefix}_openai_refresh`).on('click', async function () {
        const url = String(openaiUrl.val() || '');
        const apiKey = String(openaiKey.val() || '');
        if (!url) return toastr['info']('Please enter an Endpoint URL first.');
        try {
            toastr['info']('Fetching models from endpoint...');
            const models = await fetchOpenAIModels(url, apiKey);
            openaiModel.empty().append('<option value="">-- Select Model --</option>');
            models.forEach((model) => {
                const id = typeof model === 'string' ? model : (model.id || model.name);
                if (id) openaiModel.append($('<option></option>').val(id).text(id));
            });
            openaiModel.val(settings[key('OpenaiModel')] || '');
            toastr['success']('Models updated.');
        } catch (_) {
            toastr['warning']('Cannot auto-detect models. Type the model name manually.');
        }
    });

    const profileSelector = `#${uiPrefix}_connection_profile`;
    const profileKey = key('ConnectionProfileId');
    if (!tryBindConnectionProfileDropdown(profileSelector, settings[profileKey] || '', (id) => {
        settings[profileKey] = id;
        saveSettings();
    })) {
        let profiles = [];
        try {
            profiles = await getConnectionProfiles();
        } catch (error) {
            console.warn(`[RPG Tracker] Could not load ${keyPrefix} connection profiles:`, error);
        }
        profileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
        profiles.forEach((profile) => profileSelect.append($('<option></option>').val(profile).text(profile)));
        profileSelect.val(settings[profileKey] || '').on('change', function () {
            settings[profileKey] = String($(this).val() || '');
            saveSettings();
        });
    }

    presetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
    if (presetManager && typeof presetManager.getAllPresets === 'function') {
        presetManager.getAllPresets().forEach((preset) => {
            presetSelect.append($('<option></option>').val(preset).text(preset));
        });
    }
    const presetKey = key('CompletionPresetId');
    const savedPreset = String(settings[presetKey] || '');
    const hasSavedPreset = presetSelect.find('option').toArray().some((option) => option.value === savedPreset);
    if (savedPreset && !hasSavedPreset) {
        presetSelect.append($('<option></option>').val(savedPreset).text(savedPreset));
    }
    presetSelect.val(savedPreset).on('change', function () {
        settings[presetKey] = String($(this).val() || '');
        saveSettings();
    });
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

const CONNECTION_SETTINGS_UI = [
    { key: 'state_tracker', control: '#rpg_tracker_connection_source', slot: '#rpg_connection_slot_state_tracker', label: 'State Tracker', recommendation: 'I recommend a cheap mid-tier model such as GPT-5.6 Luna, Gemini Flash/Flash-Lite series, or Deepseek V4 Flash latest.' },
    { key: 'combat_override', control: '#rpg_combat_api_override', slot: '#rpg_connection_slot_combat_override', label: 'Combat API Override' },
    { key: 'lorebook_agent', control: '#rpg_tracker_router_source', slot: '#rpg_connection_slot_lorebook_agent', label: 'Lorebook Agent', recommendation: 'Same models work fine here as with the State Tracker.' },
    { key: 'adventure_companion', control: '#rpg_adventure_companion_connection_source', slot: '#rpg_connection_slot_adventure_companion', label: 'Adventure Companion' },
    { key: 'game_system_wizard', control: '#rpg_gs_wizard_connection_source', slot: '#rpg_connection_slot_game_system_wizard', label: 'Game System Wizard', recommendation: 'I recommend using a somewhat better model here such as Sonnet 5 or above for more robust and complex systems. Your mileage varies a lot here. Experiment.' },
    { key: 'map_architect', control: '#rpg_map_architect_connection_source', slot: '#rpg_connection_slot_map_architect', label: 'Map Architect', recommendation: 'A capable reasoning model is recommended for coherent topology, hidden information, and entity placement. Map Architect builds the foundation map; give it a stronger model than occupancy and evolution.' },
    { key: 'map_runtime', control: '#rpg_map_runtime_connection_source', slot: '#rpg_connection_slot_map_runtime', label: 'Map Updater & Evolution', recommendation: 'Occupancy and off-screen evolution can use a cheaper model than Map Architect. JSON discipline still helps.' },
    { key: 'world_progression', control: '#rpg_world_connection_source', slot: '#rpg_connection_slot_world_progression', label: 'World Progression' },
    { key: 'portraits', control: '#rpg_portrait_connection_source', slot: '#rpg_connection_slot_portraits', label: 'Portrait Generation', recommendation: 'A lightweight model should do fine.' },
];

function normalizeCentralConnectionDrawer(drawer, key, label, recommendation = '') {
    if (!(drawer instanceof HTMLElement)) return;
    const drawerHeader = drawer.querySelector(':scope > .inline-drawer-toggle');
    drawerHeader?.classList.add('rt-centered-drawer-header', 'rt-central-connection-header');
    drawerHeader?.querySelectorAll(':scope > i:not(.inline-drawer-icon)').forEach(icon => icon.remove());
    const title = drawerHeader?.querySelector('b');
    if (title && label) title.textContent = label;

    const chevron = drawerHeader?.querySelector('.inline-drawer-icon');
    if (chevron) {
        chevron.className = 'inline-drawer-icon fa-solid fa-circle-chevron-down rt-central-connection-chevron';
        chevron.removeAttribute('style');
    }

    drawer.classList.add('rt-central-connection-drawer');
    drawer.classList.remove('open');
    drawer.dataset.connectionKey = key;
    const content = drawer.querySelector(':scope > .inline-drawer-content');
    if (content instanceof HTMLElement) {
        content.style.display = 'none';
        if (recommendation && !content.querySelector(':scope > .rt-connection-recommendation')) {
            const note = document.createElement('div');
            note.className = 'rt-connection-recommendation';
            note.textContent = recommendation;
            content.prepend(note);
        }
    }
}

function setSettingsDrawerOpen(drawer) {
    if (!(drawer instanceof HTMLElement)) return;
    drawer.classList.add('open');
    const content = drawer.querySelector(':scope > .inline-drawer-content');
    if (content instanceof HTMLElement) content.style.display = 'block';
    drawer.querySelector(':scope > .inline-drawer-toggle .inline-drawer-icon')?.classList.add('down');
}

function openConnectionsModelsSettings(targetKey = '') {
    openSettingsOverlay('connections');

    const connectionsDrawer = document.getElementById('rpg_connections_models_drawer');
    setSettingsDrawerOpen(connectionsDrawer);

    const targetDrawer = targetKey === 'character_creation'
        ? document.getElementById('rpg_character_creation_connection_drawer')
        : document.querySelector(`#rt-settings-overlay .rt-central-connection-drawer[data-connection-key="${targetKey}"]`);
    setSettingsDrawerOpen(targetDrawer);
    setTimeout(() => (targetDrawer || connectionsDrawer)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 80);
}

function openMapThemesSettings() {
    openSettingsOverlay('maparchitect');
    const drawer = document.getElementById('rpg_map_themes_drawer');
    setSettingsDrawerOpen(drawer);
    setTimeout(() => drawer?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 80);
}

function organizeConnectionSettingsUI() {
    const settingsRoot = getSettingsOverlayRoot() || document.querySelector('.rpg-tracker-settings');
    if (!settingsRoot) return;

    for (const definition of CONNECTION_SETTINGS_UI) {
        const control = settingsRoot.querySelector(definition.control);
        const drawer = control?.closest('.inline-drawer');
        const slot = settingsRoot.querySelector(definition.slot);
        if (!(drawer instanceof HTMLElement) || !(slot instanceof HTMLElement) || drawer.parentElement === slot) continue;

        const originalParent = drawer.parentElement;
        if (originalParent && !settingsRoot.querySelector(`.rt-connection-shortcut[data-connection-key="${definition.key}"]`)) {
            const shortcut = document.createElement('div');
            shortcut.className = 'rt-connection-shortcut';
            shortcut.dataset.connectionKey = definition.key;
            shortcut.innerHTML = `<span><b>${definition.label} connection</b><small>Managed in Connections &amp; Models.</small></span><button type="button" class="menu_button interactable rt-connection-shortcut-button" data-connection-target="${definition.key}"><i class="fa-solid fa-plug"></i> Configure</button>`;
            originalParent.insertBefore(shortcut, drawer);
        }

        normalizeCentralConnectionDrawer(drawer, definition.key, definition.label, definition.recommendation);
        slot.appendChild(drawer);
    }

    normalizeCentralConnectionDrawer(
        document.getElementById('rpg_character_creation_connection_drawer'),
        'character_creation',
        'Character Creation & Starting Modes',
    );
}

/**
 * Initialization
 */
(async function init() {
    // Guard against double-init (e.g. browser serving a cached copy of this script
    // while the fresh copy also loads). Remove any stale panel/settings first.
    document.getElementById('rpg-tracker-panel')?.remove();
    document.querySelectorAll('.rpg-tracker-settings').forEach(el => el.remove());
    document.querySelectorAll('.rpg-tracker-settings-stub').forEach(el => el.remove());
    document.getElementById('rt-settings-overlay')?.remove();
    closeSettingsOverlay();

    const ctx = SillyTavern.getContext();
    const { eventSource, event_types, renderExtensionTemplateAsync } = ctx;
    const pm = ctx.getPresetManager ? ctx.getPresetManager() : null;
    let _runPromptDefaultsDialog = null;
    let _runPromptDefaultsStartupAction = null;

    configureRuntimeActions({
        saveSettings,
        refreshRenderedView,
        refreshDayNightCycleFromCurrentMemo,
        autoApplySysprompt,
        fetchBaseSyspromptRaw,
        sendDirectPrompt,
        runRouterPass,
        isRouterRunning,
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
        bindCharacterCreationConnectionSettings,
        openConnectionsModelsSettings,
        bindAdventureCompanion,
        openAdventureCompanion,
        blockToItems,
        buildCombatAndSkillScalingHint,
        buildNpcInstruction,
        buildOnboardingActiveBlocks,
        buildOnboardingTimeHint,
        buildOnboardingXpHint,
        buildStartingGearHint,
        createDetachedPanel,
        createOrSelectGameMasterCard,
        extractCharNameFromMemo,
        fileToDataUrl,
        generatePersonaBio,
        getPageSize,
        getSettings,
        getCharacterCreationConnectionSettings,
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
        setInitialTimeValue,
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

    {
        const earlySettings = getSettings();
        applyMapThemeToRoot(earlySettings.mapTheme);
        // Heal displayGroups / prompt-ack before the Prompt Defaults dialog or UI bind.
        // Disk settings.json saves (~12MB) are often cancelled when reloading after code edits;
        // this sync localStorage WAL restores the last intentional change.
        if (applyCriticalSettingsBackup(earlySettings)) {
            void saveSettings(true);
        }
        if (hydrateMainSyspromptBackup(earlySettings)) {
            void saveSettings(true);
        }
    }
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
        const cacheBust = { v: Date.now() };
        const settingsHtml = await renderExtensionTemplateAsync(`third-party/${FOLDER_NAME}`, 'settings', cacheBust);
        const stubHtml = await renderExtensionTemplateAsync(`third-party/${FOLDER_NAME}`, 'settings-stub', cacheBust);

        // Lightweight stub stays in the extensions drawer; full settings go into the floating window.
        if ($('#extensions_settings2').length) {
            $('#extensions_settings2').append(stubHtml);
        } else {
            $('#extensions_settings').append(stubHtml);
        }

        // Inject settings into the overlay BEFORE ID-based jQuery bindings below.
        initSettingsOverlay(settingsHtml, { folderName: FOLDER_NAME });

        organizeConnectionSettingsUI();
        bindConnectionApplyAllControls();

        // Bind drawer toggles ONLY for our own content to avoid global conflicts.
        // IMPORTANT: expand each comma-root before appending `.inline-drawer-toggle`.
        // `#a, #b .toggle` would make EVERY click inside `#a` match and preventDefault
        // checkboxes while flipping every chevron under the settings root.
        const settingsDrawerToggleSelector = [
            '#rt-settings-overlay .rpg-tracker-settings .inline-drawer-toggle',
            '.rpg-tracker-settings-stub .inline-drawer-toggle',
        ].join(', ');
        $(document).off('click.rpgTrackerSettingsDrawers');
        $(document).on('click.rpgTrackerSettingsDrawers', settingsDrawerToggleSelector, function (e) {
            // Never steal clicks from controls that live in a header row.
            if ($(e.target).closest('input, select, textarea, button, a, label.checkbox_label').length) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const drawer = $(this).closest('.inline-drawer');
            if (!drawer.length) return;
            const content = drawer.find('> .inline-drawer-content');
            drawer.toggleClass('open');
            jqueryToggleSlide(content, drawer.hasClass('open'));
            $(this).find('.inline-drawer-icon').toggleClass('down');
        });
        $(document).on('click.rpgTrackerSettingsDrawers', '#rt-settings-overlay .rt-connection-shortcut-button', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openConnectionsModelsSettings(String($(this).data('connectionTarget') || ''));
        });
        $(document).on('click.rpgTrackerSettingsDrawers', '#rpg_open_map_themes', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openMapThemesSettings();
        });
        $('#rpg_tracker_open_settings').off('click').on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openSettingsOverlay();
        });

        const settings = getSettings();
        syncMapThemeUi(settings);
        bindMapThemeControls();
        bindCharacterCreationConnectionSettings(getSettingsOverlayRoot() || document.querySelector('.rpg-tracker-settings'));
        bindAdventureCompanionSettingsDrawer();
        await bindFeatureConnectionSettings({
            uiPrefix: 'rpg_adventure_companion',
            keyPrefix: 'adventureCompanion',
            settings,
            presetManager: pm,
        });
        await bindFeatureConnectionSettings({
            uiPrefix: 'rpg_map_architect',
            keyPrefix: 'mapArchitect',
            settings,
            presetManager: pm,
        });
        await bindFeatureConnectionSettings({
            uiPrefix: 'rpg_map_runtime',
            keyPrefix: 'mapRuntime',
            settings,
            presetManager: pm,
        });
        applyMapArchitectOpenerToUi(settings.mapArchitectOpener);
        syncMapArchitectOpenerNestedVisibility(settings.syspromptModules?.[LOCATION_MAPPING_SECTION_TAG] ?? true);
        $('input[name="rpg_map_architect_opener"], input[name="rpg_map_architect_opener_components"]').on('change', function () {
            settings.mapArchitectOpener = normalizeMapArchitectOpener($(this).val());
            saveSettings();
            scheduleAutoApply();
            applyMapArchitectOpenerToUi(settings.mapArchitectOpener);
        });
        $('#rpg_map_architect_lookback').val(settings.mapArchitectLookback ?? 12).on('change', function () {
            settings.mapArchitectLookback = Math.max(0, Math.min(100, parseInt(String($(this).val()), 10) || 0));
            $(this).val(settings.mapArchitectLookback);
            saveSettings();
        });
        $('#rpg_map_architect_max_tokens').val(settings.mapArchitectMaxTokens ?? 25000).on('change', function () {
            settings.mapArchitectMaxTokens = Math.max(1000, Math.min(32000, parseInt(String($(this).val()), 10) || 25000));
            $(this).val(settings.mapArchitectMaxTokens);
            saveSettings();
        });
        $('#rpg_map_architect_system_prompt').val(settings.mapArchitectSystemPrompt || DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).on('input', function () {
            settings.mapArchitectSystemPrompt = String($(this).val() || '');
            saveSettings();
        });
        $('#rpg_map_architect_reset_prompt').on('click', function () {
            settings.mapArchitectSystemPrompt = DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT;
            $('#rpg_map_architect_system_prompt').val(settings.mapArchitectSystemPrompt);
            saveSettings();
            toastr['success']('Map Architect prompt reset.');
        });
        $('#rpg_map_updater_enabled').prop('checked', settings.mapUpdaterEnabled !== false).on('change', function () {
            settings.mapUpdaterEnabled = !!$(this).prop('checked');
            $('#rt-agent-map-updater-run-every').closest('div').toggle(settings.mapUpdaterEnabled !== false);
            saveSettings();
        });
        $('#rpg_map_updater_run_every').val(settings.mapUpdaterRunEvery ?? 1).on('change', function () {
            settings.mapUpdaterRunEvery = Math.max(1, Math.min(50, parseInt(String($(this).val()), 10) || 1));
            $(this).val(settings.mapUpdaterRunEvery);
            $('#rt-agent-map-updater-run-every').val(settings.mapUpdaterRunEvery);
            saveSettings();
        });
        $('#rpg_map_updater_max_tokens').val(settings.mapUpdaterMaxTokens ?? 25000).on('change', function () {
            settings.mapUpdaterMaxTokens = Math.max(1000, Math.min(32000, parseInt(String($(this).val()), 10) || 25000));
            $(this).val(settings.mapUpdaterMaxTokens);
            saveSettings();
        });
        $('#rpg_map_updater_system_prompt').val(settings.mapUpdaterSystemPrompt || DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).on('input', function () {
            settings.mapUpdaterSystemPrompt = String($(this).val() || '');
            saveSettings();
        });
        $('#rpg_map_updater_reset_prompt').on('click', function () {
            settings.mapUpdaterSystemPrompt = DEFAULT_MAP_UPDATER_SYSTEM_PROMPT;
            $('#rpg_map_updater_system_prompt').val(settings.mapUpdaterSystemPrompt);
            saveSettings();
            toastr['success']('Map Updater prompt reset.');
        });
        $('#rpg_map_evolution_enabled').prop('checked', settings.mapEvolutionEnabled !== false).on('change', function () {
            settings.mapEvolutionEnabled = !!$(this).prop('checked');
            saveSettings();
            if (typeof runtimeState.updateAgentMapEvolutionStatusRef === 'function') {
                runtimeState.updateAgentMapEvolutionStatusRef();
            }
        });
        $('#rpg_map_evolution_interval_hours').val(settings.mapEvolutionIntervalHours ?? 12).on('change', function () {
            settings.mapEvolutionIntervalHours = Math.max(1, Math.min(168, parseInt(String($(this).val()), 10) || 12));
            $(this).val(settings.mapEvolutionIntervalHours);
            saveSettings();
            updateMapEvolutionScheduleDisplay();
            $('#rt-agent-map-evo-interval').val(settings.mapEvolutionIntervalHours);
            void refreshMapEvolutionSelectedList();
        });
        $('#rpg_map_evolution_onsite_interval_hours').val(settings.mapEvolutionOnSiteIntervalHours ?? 1).on('change', function () {
            const parsed = parseInt(String($(this).val()), 10);
            settings.mapEvolutionOnSiteIntervalHours = Math.max(0, Math.min(168, Number.isFinite(parsed) ? parsed : 1));
            $(this).val(settings.mapEvolutionOnSiteIntervalHours);
            saveSettings();
            updateMapEvolutionScheduleDisplay();
            $('#rt-agent-map-evo-onsite-interval').val(settings.mapEvolutionOnSiteIntervalHours);
            void refreshMapEvolutionSelectedList();
        });
        $('#rpg_map_evolution_onsite_interval_minutes').val(settings.mapEvolutionOnSiteIntervalMinutes ?? 0).on('change', function () {
            const parsed = parseInt(String($(this).val()), 10);
            settings.mapEvolutionOnSiteIntervalMinutes = Math.max(0, Math.min(59, Number.isFinite(parsed) ? parsed : 0));
            $(this).val(settings.mapEvolutionOnSiteIntervalMinutes);
            saveSettings();
            updateMapEvolutionScheduleDisplay();
            $('#rt-agent-map-evo-onsite-minutes').val(settings.mapEvolutionOnSiteIntervalMinutes);
            void refreshMapEvolutionSelectedList();
        });
        $('#rpg_map_evolution_onsite_preset').val(settings.mapEvolutionOnSitePreset === 'standard' ? 'standard' : 'dynamic').on('change', function () {
            settings.mapEvolutionOnSitePreset = String($(this).val() || '') === 'standard' ? 'standard' : 'dynamic';
            $(this).val(settings.mapEvolutionOnSitePreset);
            saveSettings();
        });
        $('#rpg_map_evolution_max_tokens').val(settings.mapEvolutionMaxTokens ?? 25000).on('change', function () {
            settings.mapEvolutionMaxTokens = Math.max(1000, Math.min(32000, parseInt(String($(this).val()), 10) || 25000));
            $(this).val(settings.mapEvolutionMaxTokens);
            saveSettings();
        });
        $('#rpg_map_evolution_compress_enabled').prop('checked', settings.mapEvolutionCompressEnabled !== false).on('change', function () {
            settings.mapEvolutionCompressEnabled = !!$(this).prop('checked');
            saveSettings();
        });
        $('#rpg_map_evolution_compress_threshold').val(settings.mapEvolutionCompressThreshold ?? 10000).on('change', function () {
            const n = Math.floor(parseInt(String($(this).val()), 10));
            settings.mapEvolutionCompressThreshold = Number.isFinite(n) ? Math.max(500, Math.min(100000, n)) : 10000;
            $(this).val(settings.mapEvolutionCompressThreshold);
            saveSettings();
        });
        $('#rpg_map_evolution_narrator_commit_tokens').val(settings.mapEvolutionNarratorCommitTokens ?? 2000).on('change', function () {
            settings.mapEvolutionNarratorCommitTokens = normalizeMapEvolutionNarratorCommitTokens($(this).val());
            $(this).val(settings.mapEvolutionNarratorCommitTokens);
            saveSettings();
        });
        $('#rpg_map_evolution_world_report_lookback').val(settings.mapEvolutionWorldReportLookback ?? 5).on('change', function () {
            settings.mapEvolutionWorldReportLookback = Math.max(1, Math.min(20, parseInt(String($(this).val()), 10) || 5));
            $(this).val(settings.mapEvolutionWorldReportLookback);
            saveSettings();
        });
        applyMapEvolutionTickSettingsToUi(settings);
        $('#rpg_map_evolution_tick_scope').on('change', function () {
            settings.mapEvolutionTickScope = String($(this).val() || 'all');
            syncMapEvolutionTickRows(settings);
            void refreshMapEvolutionSelectedList();
            saveSettings();
            if (typeof runtimeState.updateAgentMapEvolutionStatusRef === 'function') {
                runtimeState.updateAgentMapEvolutionStatusRef();
            }
        });
        $('#rpg_map_evolution_tick_count').val(settings.mapEvolutionTickCount ?? 1).on('change', function () {
            const parsed = parseInt(String($(this).val()), 10);
            settings.mapEvolutionTickCount = Math.max(0, Math.min(50, Number.isFinite(parsed) ? parsed : 1));
            $(this).val(settings.mapEvolutionTickCount);
            saveSettings();
            $('#rt-agent-map-evo-tick-count').val(settings.mapEvolutionTickCount);
        });
        $('#rpg_map_evolution_tick_randomize').prop('checked', settings.mapEvolutionTickRandomize !== false).on('change', function () {
            settings.mapEvolutionTickRandomize = !!$(this).prop('checked');
            saveSettings();
            $('#rt-agent-map-evo-tick-randomize').prop('checked', settings.mapEvolutionTickRandomize);
        });
        $('#rpg_map_evolution_selected_refresh').on('click', function () {
            void refreshMapEvolutionSelectedList();
        });
        $('#rpg_map_evolution_selected_all').on('click', function () {
            $('#rpg_map_evolution_selected_list input[type="checkbox"]').prop('checked', true);
            persistMapEvolutionSelectedRootsFromUi();
        });
        $('#rpg_map_evolution_selected_none').on('click', function () {
            $('#rpg_map_evolution_selected_list input[type="checkbox"]').prop('checked', false);
            persistMapEvolutionSelectedRootsFromUi();
        });
        $('#rpg_map_evolution_selected_current').on('click', async function () {
            const sites = await listMappedEvolutionSites();
            const current = sites.find(site => site.current);
            if (!current) {
                toastr.info('The party is not inside a mapped site.', 'Map Evolution');
                return;
            }
            $('#rpg_map_evolution_selected_list input[type="checkbox"]').each(function () {
                $(this).prop('checked', String($(this).attr('data-site-root') || '') === current.siteRoot);
            });
            persistMapEvolutionSelectedRootsFromUi();
        });
        $('#rpg_map_evolution_evolve_now').on('click', async function () {
            const roots = persistMapEvolutionSelectedRootsFromUi();
            if (!roots.length) {
                toastr.warning('Check at least one mapped site.', 'Map Evolution');
                return;
            }
            if (isRouterRunning() || isMapUpdaterRunning() || isMapEvolutionRunning()) {
                toastr.warning('An agent is already running.', 'Map Evolution');
                return;
            }
            toastr['info']('Starting Map Evolution pass...');
            const result = await runMapEvolutionPass({ trigger: 'manual', isManual: true, siteRoots: roots });
            notifyMapEvolutionPassResult(result);
            updateMapEvolutionScheduleDisplay();
        });
        $('#rpg_map_evolution_btn_override_next').on('click', async function () {
            const s = getSettings();
            let listed = [];
            try {
                listed = await listMappedEvolutionSites();
            } catch (error) {
                console.warn('[RPG Tracker] Failed to list mapped sites for Evolution override:', error);
            }
            const currentRoot = listed.find(site => site.current)?.siteRoot || s.mapEvolutionLastSiteRoot || '';
            const hoursFor = evolutionIntervalHoursForSettings(s, currentRoot);
            const schedule = summarizeMapEvolutionSchedule(s.mapEvolutionLastFiredBySite, {
                intervalHours: s.mapEvolutionIntervalHours,
                currentMinutes: currentMemoMinutes(),
                intervalHoursFor: hoursFor,
            });
            const fallbackHours = Math.max(1, Number(s.mapEvolutionIntervalHours) || 12);
            const currentNextMins = schedule.nextMins >= 0
                ? schedule.nextMins
                : currentMemoMinutes() >= 0 ? currentMemoMinutes() + fallbackHours * 60 : fallbackHours * 60;

            function fmtHint(totalMins) {
                if (totalMins < 0) return s.useDdMmYyFormat ? '01/01/2026, 08:00 AM' : (s.use24hTime ? 'Day 1, 00:00' : 'Day 1, 12:00 AM');
                return formatInWorldTime(totalMins);
            }

            const acceptedFormats = s.useDdMmYyFormat
                ? 'Accepted formats: "06/01/2026, 08:00 AM", "06/01/2026, 08:00", "06/01/2026"'
                : 'Accepted formats: "Day 6, 08:00 AM", "Day 6, 08:00", "Day 6"';

            const userInput = window.prompt(
                'Enter the in-world time for the NEXT Map Evolution interval tick.\n' + acceptedFormats,
                fmtHint(currentNextMins)
            );
            if (userInput === null) return;

            const parsedNextMins = parseInWorldTime(userInput.trim());
            if (parsedNextMins == null || parsedNextMins <= 0) {
                const errorFormat = s.useDdMmYyFormat
                    ? 'Could not parse the entered time. Please use a format like "06/01/26, 08:00 AM".'
                    : 'Could not parse the entered time. Please use a format like "Day 6, 08:00 AM".';
                toastr['warning'](errorFormat, 'Map Evolution');
                return;
            }

            let roots = [...Object.keys(s.mapEvolutionLastFiredBySite || {}), ...listed.map(site => site.siteRoot)];
            if (!roots.length) {
                toastr.warning('No mapped sites to schedule.', 'Map Evolution');
                return;
            }
            let stamps = {};
            for (const root of roots) {
                const hours = hoursFor(root);
                if (!hours || hours <= 0) continue;
                stamps = stampEvolutionLastFired(stamps, [root], formatInWorldTime(parsedNextMins - hours * 60));
            }
            if (!Object.keys(stamps).length) {
                toastr.warning('Every mapped site is set to never auto-tick.', 'Map Evolution');
                return;
            }
            s.mapEvolutionLastFiredBySite = stamps;
            saveSettings();
            if (s.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
            updateMapEvolutionScheduleDisplay();
            toastr['success'](`Next interval tick set to ${fmtHint(parsedNextMins)}.`, 'Map Evolution');
        });
        $('#rpg_map_evolution_reset_timeline').on('click', function () {
            const s = getSettings();
            s.mapEvolutionLastFiredBySite = {};
            saveSettings();
            if (s.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
            updateMapEvolutionScheduleDisplay();
            toastr['info']('Map Evolution timeline reset. Next interval starts from the current time.', 'Map Evolution');
        });
        $('#rpg_map_evolution_testing_ground').on('click', async function () {
            const { openMapEvolutionTestingGround } = await import('./src/ui/panel/panel-map-evolution-debug.js');
            await openMapEvolutionTestingGround();
        });
        $('#rpg_map_evolution_system_prompt').val(settings.mapEvolutionSystemPrompt || DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).on('input', function () {
            settings.mapEvolutionSystemPrompt = String($(this).val() || '');
            saveSettings();
        });
        $('#rpg_map_evolution_reset_prompt').on('click', function () {
            settings.mapEvolutionSystemPrompt = DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT;
            $('#rpg_map_evolution_system_prompt').val(settings.mapEvolutionSystemPrompt);
            saveSettings();
            toastr['success']('Map Evolution prompt reset.');
        });
        $('#rpg_map_evolution_compress_prompt').val(settings.mapEvolutionCompressSystemPrompt || DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT).on('input', function () {
            settings.mapEvolutionCompressSystemPrompt = String($(this).val() || '');
            saveSettings();
        });
        $('#rpg_map_evolution_reset_compress_prompt').on('click', function () {
            settings.mapEvolutionCompressSystemPrompt = DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT;
            $('#rpg_map_evolution_compress_prompt').val(settings.mapEvolutionCompressSystemPrompt);
            saveSettings();
            toastr['success']('Map Evolution history compression prompt reset.');
        });


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
                // Sync first — reload during the 12MB disk write must not resurrect the dialog.
                stampCriticalSettingsSynced(target, writeCriticalSettingsBackup(target));
            };

            const acknowledgePromptDefaults = async (target) => {
                persistPromptDefaultsAck(target);
                // This acknowledgement controls whether the dialog reappears on
                // the next load, so persist it immediately instead of relying on
                // the host's debounced settings save.
                await saveSettings(true);
            };

            if (!settings.lastResetVersion) {
                // Fresh install — record version and defaults fingerprint silently.
                _runPromptDefaultsStartupAction = () => acknowledgePromptDefaults(getSettings());
            } else if (!storedFingerprint) {
                // Existing install before fingerprint tracking — adopt current defaults without prompting.
                _runPromptDefaultsStartupAction = () => acknowledgePromptDefaults(getSettings());
            } else if (storedFingerprint === currentFingerprint
                && settings.lastSeenPromptDefaultsFingerprint !== currentFingerprint) {
                // Pre-format-neutral snapshots can contain user-selected calendar/clock
                // examples. They represent the same shipped defaults, so upgrade the
                // acknowledgement silently instead of showing a false update prompt.
                _runPromptDefaultsStartupAction = () => acknowledgePromptDefaults(getSettings());
            } else if (storedFingerprint !== currentFingerprint) {
                syncPromptDefaultsUpgradeButton();

                if (settings.autoResetPromptsOnUpdate) {
                    // Silently reset everything automatically
                    _runPromptDefaultsStartupAction = async () => {
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
                        const $suffixPromptEl = $('#rpg_tracker_user_prompt_suffix');
                        if (sTempTracker.fullReviewStateMode) {
                            if ($corePromptEl.length) $corePromptEl.val(FULL_REVIEW_STATE_SYSTEM_PROMPT);
                            if ($suffixPromptEl.length) $suffixPromptEl.val(FULL_REVIEW_USER_PROMPT_SUFFIX);
                        } else {
                            if ($corePromptEl.length) $corePromptEl.val(sTempTracker.systemPromptTemplate);
                            if ($suffixPromptEl.length) $suffixPromptEl.val(sTempTracker.userPromptSuffix);
                        }
                        $('#rpg_tracker_npc_major_words').val(sTempTracker.npcMajorWords ?? 225);
                        $('#rpg_tracker_npc_minor_words').val(sTempTracker.npcMinorWords ?? 135);
                        $('#rpg_tracker_npc_rel_max_default').val(getNpcRelationshipMaxDefault(sTempTracker));
                        $('#rpg_tracker_npc_portraits').prop('checked', sTempTracker.npcPortraits !== false);
                        syncNpcPortraitDependentUi(sTempTracker);
                        $('#rpg_tracker_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                        $('#rpg_tracker_animate_all_custom_bars').prop('checked', !!sTempTracker.animateAllCustomBarChanges);
                        $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                        $('#rpg_tracker_npc_card_import').prop('checked', !!sTempTracker.experimentalNpcImport);
                        $('#rpg_tracker_ignore_npc_limits').prop('checked', !!sTempTracker.ignoreNpcImportLimits);
                        if (typeof refreshOrderList === 'function') refreshOrderList();

                        // 3. NPC / PC Core Sections (Edit NPC Sections / Edit PC Sections)
                        // Must run before Lorebook Agent rebuild so NPC instruction embeds the new schemas.
                        fresh.npcCoreSections = JSON.parse(JSON.stringify(DEFAULT_NPC_SECTIONS));
                        fresh.pcCoreSections = JSON.parse(JSON.stringify(DEFAULT_PC_SECTIONS));

                        // 4. Lorebook Agent
                        resetLorebookPromptTemplates(fresh, 'all');
                        for (const [id, def] of Object.entries(DEFAULT_MODULES)) {
                            if (fresh.routerModules && fresh.routerModules[id]) {
                                if (id === 'npc') {
                                    fresh.routerModules[id].instruction = buildNpcInstruction(fresh.npcMajorWords, fresh.npcMinorWords, false, fresh);
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
                        syncRouterPromptUi();

                        // 5. World Progression
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

                        await acknowledgePromptDefaults(fresh);
                        toastr['info'](`Prompts auto-updated to latest defaults (v${currentVersion}).`, 'RPG Tracker');
                        console.log(`[RPG Tracker] Automatically reset all prompts/sections to defaults for version ${currentVersion}.`);
                    };
                } else {
                    const { Popup } = SillyTavern.getContext();
                    if (Popup && Popup.show && Popup.show.confirm) {
                        // Run asynchronously so main extension init/loading is not blocked
                        _runPromptDefaultsDialog = async () => {
                            // Wait a short moment for the UI to be fully drawn
                            await sleepMs(500);

                            const mainSyspromptText = getLiveMainSyspromptText();
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
                                            <span>World &amp; Map Architect Prompts${changedCats.has('world') ? ' <span class="rt-prompt-cat-changed">changed</span>' : ''}</span>
                                        </label>
                                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0;">
                                            <input type="checkbox" id="rt-reset-sections" ${chk('sections')} style="cursor:pointer;">
                                            <span>NPC / PC Core Sections${changedCats.has('sections') ? ' <span class="rt-prompt-cat-changed">changed</span>' : ''}</span>
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
                            let sectionsReset = changedCats.has('sections');
                            let alwaysAuto = false;

                            setTimeout(() => {
                                const allCb = document.getElementById('rt-reset-all');
                                const sysCb = document.getElementById('rt-reset-sysprompt');
                                const trackerCb = document.getElementById('rt-reset-tracker');
                                const loreCb = document.getElementById('rt-reset-lorebook');
                                const worldCb = document.getElementById('rt-reset-world');
                                const sectionsCb = document.getElementById('rt-reset-sections');
                                const alwaysCb = document.getElementById('rt-reset-always-auto');
                                const cbs = [sysCb, trackerCb, loreCb, worldCb, sectionsCb];

                                if (sysCb) sysCb.addEventListener('change', () => { sysReset = sysCb.checked; });
                                if (trackerCb) trackerCb.addEventListener('change', () => { trackerReset = trackerCb.checked; });
                                if (loreCb) loreCb.addEventListener('change', () => { loreReset = loreCb.checked; });
                                if (worldCb) worldCb.addEventListener('change', () => { worldReset = worldCb.checked; });
                                if (sectionsCb) sectionsCb.addEventListener('change', () => { sectionsReset = sectionsCb.checked; });
                                if (alwaysCb) alwaysCb.addEventListener('change', () => { alwaysAuto = alwaysCb.checked; });

                                if (allCb) {
                                    allCb.addEventListener('change', () => {
                                        const val = allCb.checked;
                                        cbs.forEach(cb => { if (cb) cb.checked = val; });
                                        sysReset = val;
                                        trackerReset = val;
                                        loreReset = val;
                                        worldReset = val;
                                        sectionsReset = val;
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
                                sectionsReset = changedCats.has('sections');
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
                                sectionsReset = true;
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
                                    // CYOA lives in cyoaConfig and is user-msg injected (not Main);
                                    // refresh shipped slots + clear sticky customPromptText on sysprompt reset.
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
                                    const $suffixPromptEl = $('#rpg_tracker_user_prompt_suffix');
                                    if (sTempTracker.fullReviewStateMode) {
                                        if ($corePromptEl.length) $corePromptEl.val(FULL_REVIEW_STATE_SYSTEM_PROMPT);
                                        if ($suffixPromptEl.length) $suffixPromptEl.val(FULL_REVIEW_USER_PROMPT_SUFFIX);
                                    } else {
                                        if ($corePromptEl.length) $corePromptEl.val(sTempTracker.systemPromptTemplate);
                                        if ($suffixPromptEl.length) $suffixPromptEl.val(sTempTracker.userPromptSuffix);
                                    }
                                    $('#rpg_tracker_npc_major_words').val(sTempTracker.npcMajorWords ?? 225);
                                    $('#rpg_tracker_npc_minor_words').val(sTempTracker.npcMinorWords ?? 135);
                                    $('#rpg_tracker_npc_rel_max_default').val(getNpcRelationshipMaxDefault(sTempTracker));
                                    $('#rpg_tracker_npc_portraits').prop('checked', sTempTracker.npcPortraits !== false);
                                    syncNpcPortraitDependentUi(sTempTracker);
                                    $('#rpg_tracker_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                                    $('#rpg_tracker_animate_all_custom_bars').prop('checked', !!sTempTracker.animateAllCustomBarChanges);
                                    $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                                    $('#rpg_tracker_npc_card_import').prop('checked', !!sTempTracker.experimentalNpcImport);
                                    $('#rpg_tracker_ignore_npc_limits').prop('checked', !!sTempTracker.ignoreNpcImportLimits);
                                    if (typeof refreshOrderList === 'function') refreshOrderList();
                                    resetCount++;
                                    console.log('[RPG Tracker] State tracker prompts reset to defaults.');
                                }

                                // Core sections before Lorebook so NPC instruction rebuild sees the new schemas.
                                if (sectionsReset) {
                                    fresh.npcCoreSections = JSON.parse(JSON.stringify(DEFAULT_NPC_SECTIONS));
                                    fresh.pcCoreSections = JSON.parse(JSON.stringify(DEFAULT_PC_SECTIONS));
                                    // Keep the live Lorebook NPC instruction in sync even if lorebook wasn't selected.
                                    if (!loreReset && fresh.routerModules?.npc) {
                                        fresh.routerModules.npc.instruction = buildNpcInstruction(fresh.npcMajorWords, fresh.npcMinorWords, false, fresh);
                                    }
                                    resetCount++;
                                    console.log('[RPG Tracker] NPC/PC core sections reset to defaults.');
                                }

                                if (loreReset) {
                                    resetLorebookPromptTemplates(fresh, 'all');
                                    for (const [id, def] of Object.entries(DEFAULT_MODULES)) {
                                        if (fresh.routerModules && fresh.routerModules[id]) {
                                            if (id === 'npc') {
                                                fresh.routerModules[id].instruction = buildNpcInstruction(fresh.npcMajorWords, fresh.npcMinorWords, false, fresh);
                                            } else {
                                                fresh.routerModules[id].instruction = def.instruction;
                                            }
                                            fresh.routerModules[id].format = def.format;
                                        }
                                    }
                                    if (typeof globalThis._rpgRenderAgentModules === 'function') {
                                        globalThis._rpgRenderAgentModules();
                                    }
                                    syncRouterPromptUi();
                                    resetCount++;
                                    console.log('[RPG Tracker] Lorebook Agent prompts reset to defaults.');
                                }

                                if (worldReset) {
                                    if (extensionSettings[MODULE_NAME]) {
                                        delete extensionSettings[MODULE_NAME].mapArchitectSystemPrompt;
                                        delete extensionSettings[MODULE_NAME].mapUpdaterSystemPrompt;
                                        delete extensionSettings[MODULE_NAME].mapEvolutionSystemPrompt;
                                        delete extensionSettings[MODULE_NAME].mapEvolutionCompressSystemPrompt;
                                        delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
                                        delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;
                                    }
                                    const sTemp = getSettings();
                                    const $mapPromptEl = $('#rpg_map_architect_system_prompt');
                                    if ($mapPromptEl.length) {
                                        $mapPromptEl.val(sTemp.mapArchitectSystemPrompt).trigger('input');
                                    }
                                    const $mapUpdaterPromptEl = $('#rpg_map_updater_system_prompt');
                                    if ($mapUpdaterPromptEl.length) {
                                        $mapUpdaterPromptEl.val(sTemp.mapUpdaterSystemPrompt).trigger('input');
                                    }
                                    const $mapEvolutionPromptEl = $('#rpg_map_evolution_system_prompt');
                                    if ($mapEvolutionPromptEl.length) {
                                        $mapEvolutionPromptEl.val(sTemp.mapEvolutionSystemPrompt).trigger('input');
                                    }
                                    const $mapEvolutionCompressPromptEl = $('#rpg_map_evolution_compress_prompt');
                                    if ($mapEvolutionCompressPromptEl.length) {
                                        $mapEvolutionCompressPromptEl.val(sTemp.mapEvolutionCompressSystemPrompt).trigger('input');
                                    }
                                    const $wpPromptEl = $('#rpg_world_progression_system_prompt');
                                    if ($wpPromptEl.length) {
                                        $wpPromptEl.val(sTemp.worldProgressionSystemPrompt).trigger('input');
                                    }
                                    const $wpSkelPromptEl = $('#rpg_world_progression_skeleton_system_prompt');
                                    if ($wpSkelPromptEl.length) {
                                        $wpSkelPromptEl.val(sTemp.worldProgressionSkeletonSystemPrompt).trigger('input');
                                    }
                                    resetCount++;
                                    console.log('[RPG Tracker] World and Map Architect prompts reset to defaults.');
                                }

                                await acknowledgePromptDefaults(fresh);
                                syncPromptDefaultsUpgradeButton();

                                if (resetCount > 0) {
                                    toastr['success'](`Successfully reset ${resetCount} prompt category/categories to defaults.`, 'RPG Tracker');
                                } else {
                                    toastr['info']('No prompts were selected for reset.', 'RPG Tracker');
                                }
                            } else {
                                await acknowledgePromptDefaults(fresh);
                                syncPromptDefaultsUpgradeButton();
                                toastr['info']('Kept custom — no prompts were changed.', 'RPG Tracker');
                            }
                            syncPromptDefaultsUpgradeButton();
                        };
                        _runPromptDefaultsStartupAction = _runPromptDefaultsDialog;
                    } else {
                        _runPromptDefaultsStartupAction = () => acknowledgePromptDefaults(getSettings());
                    }
                }
            } else if (settings.lastResetVersion !== currentVersion) {
                // Version-only bump — bundled defaults unchanged, no prompt dialog.
                settings.lastResetVersion = currentVersion;
                void saveSettings(true);
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
            const result = captureMainSyspromptBackup(fresh, { manual: true });
            persistMainSyspromptBackupIfChanged(result, fresh);
            if (result.changed || result.reason === 'kept' || result.reason === 'captured') {
                toastr['success']('Current Quick Prompt Main saved to backup.', 'RPG Tracker');
            } else if (result.reason === 'empty') {
                toastr['warning']('Current Main is empty — refusing to overwrite a saved backup with nothing.', 'RPG Tracker');
            } else if (result.reason === 'already-framework') {
                toastr['warning']('Current Main looks like the framework prompt, so the existing backup was left unchanged.', 'RPG Tracker');
            } else {
                toastr['error']('Could not save backup.', 'RPG Tracker');
            }
        });

        $('#rpg_main_sysprompt_backup_restore').on('click', function () {
            const fresh = getSettings();
            if (!isMainSyspromptBackupEnabled(fresh)) {
                return toastr['warning']('Main prompt backup is disabled. Enable it above first.', 'RPG Tracker');
            }
            if (!getEffectiveBackupText(fresh).trim()) {
                return toastr['info']('No backup saved yet. Use Save current Main to backup first.', 'RPG Tracker');
            }
            if (restoreTrackedMainSysprompt(fresh, { manual: true })) {
                const note = fresh.enabled && !fresh.customSysprompt
                    ? ' Click ⏻ on the tracker panel to keep it — the framework may overwrite Main again while the tracker is on.'
                    : '';
                toastr['success'](`Backed-up Main prompt restored.${note}`, 'RPG Tracker');
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

        $('#rpg_tracker_xp_bar_bottom').prop('checked', !!settings.xpBarAtBottom).on('change', function () {
            settings.xpBarAtBottom = !!$(this).prop('checked');
            saveSettings();
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

        const portraitStoryLookbackRow = $('#rpg_tracker_portrait_story_lookback_row');
        const applyPortraitStoryLookbackUI = (enabled) => {
            portraitStoryLookbackRow.css({
                opacity: enabled ? '1' : '0.35',
                'pointer-events': enabled ? 'auto' : 'none',
            });
        };
        $('#rpg_tracker_portrait_use_story_lookback').prop('checked', !!settings.portraitUseStoryLookback).on('change', function () {
            settings.portraitUseStoryLookback = !!$(this).prop('checked');
            applyPortraitStoryLookbackUI(settings.portraitUseStoryLookback);
            saveSettings();
        });
        applyPortraitStoryLookbackUI(!!settings.portraitUseStoryLookback);
        $('#rpg_tracker_portrait_story_lookback').val(settings.portraitStoryLookback ?? 5).on('input', function () {
            settings.portraitStoryLookback = Math.max(0, Math.min(100, parseInt(String($(this).val() || ''), 10) || 0));
            $(this).val(settings.portraitStoryLookback);
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

        $('#rpg_tracker_portrait_auto_scene_view').prop('checked', !!settings.portraitAutoGenerateSceneView).on('change', async function () {
            const enabled = !!$(this).prop('checked');
            if (enabled) resetRealtimeLocationGenerationFailure();
            else stopRealtimeLocationGeneration();
            applyLocationImageAutoMode(settings, { realTimeMode: enabled });
            await saveSettings(true);
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

        $('#rpg_tracker_chat_link_enabled').prop('checked', !!settings.chatLinkEnabled).on('change', async function () {
            const turningOn = !!$(this).prop('checked');
            const applied = await applyChatLinkToggle(turningOn);
            if (!applied) {
                // Conflict cancelled — revert checkbox to previous state
                $(this).prop('checked', !turningOn);
            }
        });

        $('#rpg_tracker_chat_setup_link_enabled').prop('checked', !!settings.chatSetupLinkEnabled).on('change', function () {
            const enabled = !!$(this).prop('checked');
            settings.chatSetupLinkEnabled = enabled;
            if (enabled && settings.chatLinkEnabled && runtimeState.currentChatId) {
                saveChatState(runtimeState.currentChatId);
                toastr['success']('Per-item scopes active. Chat-bound setup saved to this chat; Global items remain shared.', 'RPG Tracker');
            } else if (enabled) {
                toastr['info']('Setup lock is ready. Turn on Chat-Linked Mode to bind the current setup.', 'RPG Tracker');
            } else {
                toastr['info']('Setup scope bypass on — the current setup will carry between chats without changing saved item scopes.', 'RPG Tracker');
            }
            saveSettings();
            updateChatLinkUI();
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

        $('#rpg_tracker_tutorial_help').on('click', function () {
            openAdventureCompanion();
        });

        $('#rpg_tracker_api_setup_checklist').on('click', function () {
            closeSettingsOverlay();
            showApiSetupGate();
        });

        $('#rpg_tracker_create_game_master_card').on('click', async function () {
            const btn = /** @type {HTMLButtonElement} */ (this);
            const name = resolveNarratorCardName($('#rpg_tracker_game_master_name').val());
            btn.disabled = true;
            try {
                await createOrSelectGameMasterCard({ name });
            } finally {
                btn.disabled = false;
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
        const shouldStripOldCyoaChoices = () => {
            const fresh = getSettings();
            // Strip superseded choice lists whenever CYOA Mode is configured on,
            // even if the master power toggle is off — leftover choices in history
            // should not keep steering the model after power-down.
            return isEffectiveSectionEnabled('CYOA_mode', fresh)
                && fresh.cyoaConfig?.stripOldChoicesFromPrompt !== false;
        };
        if (event_types.CHAT_COMPLETION_PROMPT_READY) {
            eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (eventData) => {
                if (!shouldStripOldCyoaChoices() || !Array.isArray(eventData?.chat)) return;
                replacePromptArray(eventData.chat, stripSupersededChoicesFromChatPrompt(eventData.chat));
            });
        }
        if (event_types.GENERATE_BEFORE_COMBINE_PROMPTS) {
            eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, (eventData) => {
                if (!shouldStripOldCyoaChoices() || !Array.isArray(eventData?.finalMesSend)) return;
                replacePromptArray(eventData.finalMesSend, stripSupersededChoicesFromTextPromptMessages(eventData.finalMesSend));
            });
        }
        eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
        eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
        eventSource.on(event_types.GENERATION_STOPPED, onGenerationEnded);
        if (event_types.MESSAGE_SENT) eventSource.on(event_types.MESSAGE_SENT, onMapUpdaterUserMessage);
        if (event_types.MESSAGE_RECEIVED) eventSource.on(event_types.MESSAGE_RECEIVED, onMapArchitectAssistantMessage);
        const catchUpMapArchitectFence = () => {
            setTimeout(() => { void onMapArchitectAssistantMessage(undefined, 'normal'); }, 0);
        };
        if (event_types.CHAT_CHANGED) eventSource.on(event_types.CHAT_CHANGED, catchUpMapArchitectFence);
        if (event_types.CHAT_LOADED) eventSource.on(event_types.CHAT_LOADED, catchUpMapArchitectFence);
        if (event_types.MESSAGE_EDITED) eventSource.on(event_types.MESSAGE_EDITED, handleRelationshipSwipeChange);
        if (event_types.MESSAGE_SWIPED) eventSource.on(event_types.MESSAGE_SWIPED, handleRelationshipSwipeChange);

        // ─── Chat Link ───
        // Bootstrap: restore state for whichever chat is already open (before CHAT_CHANGED can fire).
        sanitizeRouterState(settings);
        const bootChatId = ctx.chatId || ctx.getCurrentChatId?.() || null;
        runtimeState.currentChatId = bootChatId;
        const migratedPortraitScope = migrateLegacyPortraitMapsToChat(settings, bootChatId);
        if (bootChatId && !settings.chatLinkEnabled) {
            loadPortraitMapsForChat(settings, bootChatId);
        }
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
        if (event_types.CHAT_RENAMED) {
            eventSource.on(event_types.CHAT_RENAMED, (detail) => {
                void onChatRenamedMigrate(detail || {}, {
                    saveSettings,
                    loadChatState,
                });
            });
        }
        if (bootChatId && settings.chatLinkEnabled) {
            // ST and other extensions queue whole-settings saves before settingsReady.
            // Never expose an empty transient projection during that window. If the
            // active partition is missing, empty, or older/poorer than the already
            // visible live state, seed it from live memory instead of clearing it.
            const preserveLiveBootState = shouldPreserveLiveChatStateOnBoot(settings, bootChatId);
            const restoredBootChat = preserveLiveBootState ? false : loadChatState(bootChatId);
            if (preserveLiveBootState || (!restoredBootChat && !settings.chatStates?.[bootChatId])) {
                saveChatState(bootChatId, { skipDiskWrite: true });
                console.warn('[RPG Tracker] Preserved live tracker state for an unsafe boot partition:', bootChatId);
            }
            if (settings.chatSetupLinkEnabled) {
                syncSettingsUi();
                syncAllNarratorTogglesForUnlockState();
            }
            // loadChatState can reintroduce tombstoned tags from a stale partition — strip again.
            applyDeletedCustomTagTombstones();
        }
        if (bootChatId) markStartupChatProjectionReady(bootChatId);
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
        if (strippedTombstones || healedFromBackup || strippedGlobalUi || migratedPortraitScope || isRealtimeVisualizationDisabled()) {
            void saveSettings(true);
        }

        // Migrate legacy base64 portraits after chat state is loaded so loadChatState
        // cannot overwrite freshly migrated paths before the synchronous disk flush.
        await runPortraitMigrationIfNeeded();

        // Do not release extension persistence until core SillyTavern declares
        // settings ready. Before that, core saveSettings() turns every early call
        // into a delayed global retry that can outlive extension bootstrap.
        let startupPersistenceReleaseScheduled = false;
        _attemptStartupPersistenceRelease = () => {
            if (!_startupCoreSettingsReady || !_startupChatProjectionReady) return;
            if (startupPersistenceReleaseScheduled) return;
            startupPersistenceReleaseScheduled = true;
            setTimeout(() => {
                void openSettingsPersistenceGate().then(() => {
                    if (typeof _runPromptDefaultsStartupAction === 'function') {
                        const action = _runPromptDefaultsStartupAction;
                        _runPromptDefaultsStartupAction = null;
                        void action();
                    }
                });
            }, 0);
        };
        const markCoreSettingsReady = () => {
            _startupCoreSettingsReady = true;
            _attemptStartupPersistenceRelease();
        };
        eventSource.once(event_types.SETTINGS_LOADED, markCoreSettingsReady);
        // APP_READY auto-fires for extensions activated after normal startup.
        if (event_types.APP_READY) eventSource.once(event_types.APP_READY, markCoreSettingsReady);
        _attemptStartupPersistenceRelease();

        // ─── Navigation snapshot safety net ───
        // Never write SillyTavern's whole settings blob from lifecycle events. A hidden or
        // older tab may hold a stale snapshot, and visibilitychange/pagehide/beforeunload
        // would then silently replace personas, connection settings, and every extension's
        // state (last writer wins). Async unload fetches are unreliable for this ~16 MB file
        // anyway. Keep only synchronous/local recovery snapshots here; ordinary user actions
        // already schedule the normal SillyTavern save while the page is alive.
        let _navigationSnapshotInFlight = false;
        const snapshotPendingStateForNavigation = (reason = 'navigation') => {
            if (_navigationSnapshotInFlight) return;
            _navigationSnapshotInFlight = true;
            try {
                if (typeof globalThis._rpgFlushRawMemoChanges === 'function') {
                    globalThis._rpgFlushRawMemoChanges();
                }
                const s = getSettings();
                const chatId = runtimeState.currentChatId || SillyTavern.getContext()?.chatId || null;
                snapshotPortraitMapsForChat(s, chatId);
                snapshotMemoToLocalStorage(chatId, { force: true });
                stampCriticalSettingsSynced(s, writeCriticalSettingsBackup(s));
                if (s.chatLinkEnabled && chatId && !isPortraitMigrationLocked()) {
                    // Update the in-memory partition and synchronous module-schema WAL only.
                    // skipDiskWrite is essential: lifecycle events must not replace settings.json.
                    saveChatState(chatId, { skipDiskWrite: true });
                } else {
                    writeModuleSchemaBackup(chatId);
                }
                if (s.debugMode) console.log(`[RPG Tracker] Local navigation snapshot captured (${reason}); settings.json write skipped.`);
            } catch (err) {
                console.warn('[RPG Tracker] Navigation snapshot failed:', err);
            } finally {
                // Allow a later lifecycle signal (hide, pagehide, unload) to refresh the WAL.
                setTimeout(() => { _navigationSnapshotInFlight = false; }, 0);
            }
        };
        window.addEventListener('beforeunload', () => snapshotPendingStateForNavigation('beforeunload'));
        window.addEventListener('pagehide', () => snapshotPendingStateForNavigation('pagehide'));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') snapshotPendingStateForNavigation('visibilityhidden');
        });
        // Always run activation when Lorebook Agent is live — regardless of chatLinkEnabled —
        // so the correct lorebook stack is live from the very first message.
        if (isLorebookAgentRuntimeActive(settings) && bootChatId) {
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
        if (isLorebookAgentRuntimeActive(s)) {
            scheduleDeferred(() => {
                disableManagedEntries().catch(e => console.warn('[RPG Tracker] disableManagedEntries on init failed:', e));
            });
        }

        registerDiceFunctionTool();
        syncLocationMappingRuntime();
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
            settings.activePortraitPromptPresetId = '';
            saveSettings();
            refreshPortraitPromptPresetsList();
        });

        $('#rpg_portrait_character_system_prompt').val(settings.portraitCharacterSystemPrompt).on('input', function () {
            settings.portraitCharacterSystemPrompt = String($(this).val() || '');
            settings.activePortraitPromptPresetId = '';
            saveSettings();
            refreshPortraitPromptPresetsList();
        });

        $('#rpg_portrait_location_system_prompt').val(settings.portraitLocationSystemPrompt || '').on('input', function () {
            settings.portraitLocationSystemPrompt = String($(this).val() || '');
            settings.activePortraitPromptPresetId = '';
            saveSettings();
            refreshPortraitPromptPresetsList();
        });

        $('#rpg_portrait_location_include_present_npcs').prop('checked', !!settings.portraitLocationIncludePresentNpcs).on('change', function () {
            const s = getSettings();
            if (s.portraitAutoGenerateSceneView) {
                syncLocationImageDependentUi(s);
                return;
            }
            const enabled = !!$(this).prop('checked');
            s.portraitLocationIncludePresentNpcs = enabled;
            // Swap only when the current text is still a shipped factory default —
            // never overwrite a custom Location Scene Prompt.
            syncPortraitLocationPromptForNpcToggle(s, enabled);
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
            const freshDefault = getDefaultPortraitNpcSystemPrompt();

            const s = getSettings();
            s.portraitNpcSystemPrompt = freshDefault;
            s.activePortraitPromptPresetId = '';

            $('#rpg_portrait_npc_system_prompt').val(freshDefault);
            saveSettings();
            refreshPortraitPromptPresetsList();
            toastr['success']('NPC/PC Portrait Prompt reset to default.', 'RPG Tracker');
        });

        $('#rpg_portrait_character_btn_reset_prompt').on('click', function () {
            if (!confirm('Reset Character/Party/Combat Portrait Prompt to default?')) return;

            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].portraitCharacterSystemPrompt;
            }
            const freshDefault = getDefaultPortraitCharacterSystemPrompt();

            const s = getSettings();
            s.portraitCharacterSystemPrompt = freshDefault;
            s.activePortraitPromptPresetId = '';

            $('#rpg_portrait_character_system_prompt').val(freshDefault);
            saveSettings();
            refreshPortraitPromptPresetsList();
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
            s.activePortraitPromptPresetId = '';

            setPortraitLocationPromptTextarea(freshDefault);
            saveSettings();
            refreshPortraitPromptPresetsList();
            toastr['success']('Location Scene Prompt reset to default.', 'RPG Tracker');
        });

        $('#rpg_portrait_prompt_preset_save_btn').on('click', function () {
            const name = prompt('Enter a name for this portrait prompt setup:', 'My Portrait Prompts');
            if (!name || !name.trim()) return;
            const trimmedName = name.trim();
            if (getFactoryPortraitPromptPresetNameSet().has(trimmedName.toLowerCase())) {
                toastr['warning'](`"${trimmedName}" is a factory art style name. Choose a different name for your saved setup.`, 'Portrait Prompt Library');
                return;
            }
            if (settings.savedPortraitPromptPresets && settings.savedPortraitPromptPresets[trimmedName]) {
                if (!confirm(`A setup named "${trimmedName}" already exists. Overwrite?`)) return;
            }
            if (!settings.savedPortraitPromptPresets) settings.savedPortraitPromptPresets = {};
            settings.savedPortraitPromptPresets[trimmedName] = {
                npcSystemPrompt: settings.portraitNpcSystemPrompt,
                characterSystemPrompt: settings.portraitCharacterSystemPrompt,
                locationSystemPrompt: settings.portraitLocationSystemPrompt,
                includePresentNpcs: !!settings.portraitLocationIncludePresentNpcs,
                wordTarget: settings.portraitPromptWordTarget,
            };
            settings.activePortraitPromptPresetId = `user:${trimmedName}`;
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

        $('#rpg_tracker_manage_display_groups').on('click', () => openDisplayGroupsManager());

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
                enabled: true,
                scope: 'chat'
            });
            clearDeletedCustomTagTombstones(newTag);
            saveSettings(true);
            refreshOrderList();
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
                    if (f.enabled) {
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
                    enabled: true,
                    scope: 'chat'
                });
                clearDeletedCustomTagTombstones(parsed.tag);
                saveSettings(true);
                refreshOrderList();
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
                removeChatSetupCatalogEntries(s, { customFieldTags: [...customTags] });
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

        $('#rpg_tracker_animate_all_custom_bars')
            .prop('checked', !!settings.animateAllCustomBarChanges)
            .on('change', function () {
                settings.animateAllCustomBarChanges = !!$(this).prop('checked');
                saveSettings();
                refreshRenderedView();
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

        const fullReviewChk = $('#rpg_tracker_full_review_mode');
        const fullReviewNote = $('#rpg_tracker_full_review_note');
        const corePromptTextarea = $('#rpg_tracker_core_prompt');
        const suffixPromptTextarea = $('#rpg_tracker_user_prompt_suffix');
        const resetPromptBtn = $('#rpg_tracker_btn_reset_prompt');
        const applyFullReviewUI = (enabled) => {
            fullReviewNote.css('display', enabled ? 'block' : 'none');
            corePromptTextarea.prop('disabled', enabled).css('opacity', enabled ? '0.4' : '1');
            suffixPromptTextarea.prop('disabled', enabled).css('opacity', enabled ? '0.4' : '1');
            resetPromptBtn.prop('disabled', enabled).css('opacity', enabled ? '0.4' : '1');
            // Show the prompts that are actually sent while Full Review is on; the saved
            // custom Core Prompt / suffix stay in settings and are restored on disable.
            if (enabled) {
                corePromptTextarea.val(FULL_REVIEW_STATE_SYSTEM_PROMPT);
                suffixPromptTextarea.val(FULL_REVIEW_USER_PROMPT_SUFFIX);
            } else {
                corePromptTextarea.val(settings.systemPromptTemplate || '');
                suffixPromptTextarea.val(settings.userPromptSuffix || '');
            }
        };
        if (fullReviewChk.length) {
            const fullReviewEnabled = !!settings.fullReviewStateMode;
            fullReviewChk.prop('checked', fullReviewEnabled);
            applyFullReviewUI(fullReviewEnabled);
            fullReviewChk.on('change', function () {
                settings.fullReviewStateMode = !!$(this).prop('checked');
                applyFullReviewUI(settings.fullReviewStateMode);
                saveSettings();
            });
        } else {
            corePromptTextarea.val(settings.systemPromptTemplate || '');
            suffixPromptTextarea.val(settings.userPromptSuffix || '');
        }

        corePromptTextarea.on('input', function () {
            if (settings.fullReviewStateMode) return;
            settings.systemPromptTemplate = $(this).val();
            saveSettings();
        });

        suffixPromptTextarea.on('input', function () {
            if (settings.fullReviewStateMode) return;
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

        $('#rpg_tracker_btn_edit_pc_sections, #rpg_tracker_btn_edit_pc_sections_agent').on('click', function () {
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

            // 3. Reset all Lorebook Agent prompts and World Progression prompts
            resetLorebookPromptTemplates(freshSettings, 'all');
            delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
            delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;

            // Re-merge defaults
            const finalSettings = getSettings();

            // Update mode-aware Lorebook Agent prompt editors without firing input handlers.
            syncRouterPromptUi();

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
                    white-space: normal !important;
                    overflow-wrap: anywhere !important;
                    word-break: break-word !important;
                    box-decoration-break: clone !important;
                    -webkit-box-decoration-break: clone !important;
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
         * ST welcome screen (no active chat). Hosts welcomePanel + welcome_prompt
         * system messages with drawer-opener chrome buttons — never CYOA.
         * @see public/scripts/welcome-screen.js openWelcomeScreen
         */
        function isSillyTavernWelcomeScreen() {
            try {
                const ctx = SillyTavern.getContext?.();
                return ctx?.chatId === undefined || ctx?.chatId === null || ctx?.chatId === '';
            } catch (_) {
                return false;
            }
        }

        /**
         * Message DOM from ST welcome / system-UI templates (type attr from mes.extra.type).
         * @param {Element|null} el
         */
        function isSillyTavernWelcomeMesBlock(el) {
            const mes = el?.closest?.('.mes');
            if (!(mes instanceof HTMLElement)) return false;
            const type = mes.getAttribute('type') || '';
            return type === 'welcome_prompt' || type === 'welcome' || !!mes.querySelector('.welcomePanel');
        }

        /**
         * ST chrome buttons (API Connections / Character Management / Extensions, etc.).
         * Never treat as CYOA choices — they open drawers via data-target.
         * @param {Element|null} btn
         */
        function isSillyTavernChromeButton(btn) {
            if (!(btn instanceof HTMLElement) || btn.tagName !== 'BUTTON') return false;
            return btn.classList.contains('drawer-opener')
                || btn.classList.contains('menu_button')
                || btn.hasAttribute('data-target')
                || !!btn.closest('.welcomePanel, .welcomeShortcuts');
        }

        /** @param {HTMLButtonElement[]} buttons */
        function areAllSillyTavernChromeButtons(buttons) {
            return buttons.length > 0 && buttons.every(isSillyTavernChromeButton);
        }

        /**
         * Undo a mistaken CYOA wrap of ST welcome chrome (clone strips our click handlers).
         * @param {ParentNode} root
         */
        function repairHijackedSillyTavernChromeButtons(root) {
            root.querySelectorAll('div.rt-cyoa-choices').forEach((wrap) => {
                const buttons = Array.from(wrap.querySelectorAll(':scope > button'));
                if (!areAllSillyTavernChromeButtons(buttons)) return;
                const restore = document.createElement('div');
                restore.className = 'flex-container';
                buttons.forEach((btn) => {
                    const clean = /** @type {HTMLButtonElement} */ (btn.cloneNode(true));
                    clean.removeAttribute('data-cyoa-bound');
                    delete clean.dataset.cyoaRaw;
                    delete clean.dataset.cyoaDecorated;
                    clean.classList.remove('rt-cyoa-incomplete');
                    restore.appendChild(clean);
                });
                wrap.replaceWith(restore);
            });
            root.querySelectorAll('button[data-cyoa-bound="true"]').forEach((btn) => {
                if (!isSillyTavernChromeButton(btn)) return;
                const clean = /** @type {HTMLButtonElement} */ (btn.cloneNode(true));
                clean.removeAttribute('data-cyoa-bound');
                delete clean.dataset.cyoaRaw;
                delete clean.dataset.cyoaDecorated;
                clean.classList.remove('rt-cyoa-incomplete');
                btn.replaceWith(clean);
            });
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
            if (areAllSillyTavernChromeButtons(buttons)) return null;
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
                const buttons = Array.from(choicesEl.querySelectorAll('button')).filter((b) => !isSillyTavernChromeButton(b));
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
                if (host.classList?.contains('flex-container') && host.querySelector(':scope > button.drawer-opener, :scope > button.menu_button')) return;
                const buttons = Array.from(host.querySelectorAll(':scope > button'));
                if (buttons.length < 2) return;
                if (areAllSillyTavernChromeButtons(buttons)) return;
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
                if (areAllSillyTavernChromeButtons(buttons)) return;
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
                if (areAllSillyTavernChromeButtons(buttons)) { run = []; return; }
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
                if (el.tagName === 'BUTTON') return !isSillyTavernChromeButton(el);
                if (el.tagName === 'P' || el.tagName === 'DIV') {
                    const buttons = el.querySelectorAll(':scope > button');
                    if (buttons.length !== 1 || el.childElementCount !== 1) return false;
                    return !isSillyTavernChromeButton(buttons[0]);
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
            if (!isCyoaEnabled(s)) return;
            // Welcome screen (no chat) + welcome_prompt/welcome system messages host ST
            // drawer chrome — never flatten/bind those as CYOA choices.
            if (isSillyTavernWelcomeScreen()) {
                document.querySelectorAll('#chat .mes_text').forEach(repairHijackedSillyTavernChromeButtons);
                return;
            }
            document.querySelectorAll('#chat .mes_text').forEach(block => {
                if (isSillyTavernWelcomeMesBlock(block)) {
                    repairHijackedSillyTavernChromeButtons(block);
                    return;
                }
                repairHijackedSillyTavernChromeButtons(block);
                // Flattening mid-stream fights ST's live HTML updates and leaves empty shells.
                if (allowFlatten && !_cyoaGenerating) flattenCyoaChoiceBlocks(block);
                syncCyoaStreamingPlaceholders(block);
                block.querySelectorAll('button').forEach(btn => {
                    if (isSillyTavernChromeButton(btn)) return;
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
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;">
                        <input type="checkbox" id="cyoa-strip-old-prompt" ${checked(cfg.stripOldChoicesFromPrompt)} /> <span>Keep only T-1 through T-4 choices in AI context <span title="Keeps the four newest completed &lt;choices&gt; blocks as fresh examples for the AI, and removes only T-5 and older choice blocks from the outgoing prompt. Every choice remains visible and clickable in chat." class="fa-solid fa-circle-question" style="opacity:0.5;cursor:help;margin-left:4px;"></span></span>
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
                freshS.cyoaConfig.stripOldChoicesFromPrompt = !!dlg.querySelector('#cyoa-strip-old-prompt')?.checked;
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
            { key: 'dungeon_reality_and_hidden_mapping', id: 'rpg_sysprompt_mod_dungeon_reality_and_hidden_mapping' },
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
                const checked = !!$(this).prop('checked');
                if (key === LOCATION_MAPPING_SECTION_TAG) {
                    setLocationMappingEnabled(checked, fresh);
                } else {
                    if (!fresh.syspromptModules) fresh.syspromptModules = {};
                    fresh.syspromptModules[key] = checked;
                }

                if (key === 'quests') {
                    $('#rpg_quests_options').toggle(checked);
                    refreshOrderList();
                }
                if (key === LOCATION_MAPPING_SECTION_TAG) {
                    syncMapArchitectOpenerNestedVisibility(checked);
                }
                if (key === 'party_bench') {
                    if (!fresh.modules) fresh.modules = {};
                    fresh.modules['benched party'] = checked;
                    if (checked) fresh.modules.party = true;
                    refreshOrderList();
                }

                saveSettings();
                scheduleAutoApply();
                refreshRenderedView();
                if (key === LOCATION_MAPPING_SECTION_TAG) {
                    // Remove the live map surface immediately; the next scene
                    // refresh also closes any detached map window.
                    runtimeState.hasActiveDungeonMap = false;
                    globalThis._rpgSyncAgentImmersionUi?.();
                    void globalThis._rpgRefreshImmersionView?.();
                }
            });

            if (key === 'quests') {
                $('#rpg_quests_options').toggle(val);
            }
            if (key === LOCATION_MAPPING_SECTION_TAG) {
                syncMapArchitectOpenerNestedVisibility(val);
            }
        });

        // ── Narrative pacing ──────────────────────────────────────────────────
        const validNarrativePacing = new Set(['normal', 'shorter_outputs', 'high_agency', 'downtime']);
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
                    <input type="radio" name="rpg_relationship_update_mode" value="state_tracker" ${mode === RELATIONSHIP_UPDATE_MODES.STATE_TRACKER ? 'checked' : ''}>
                    <strong> State Tracker Tags</strong>
                    <div style="font-size:11px;opacity:.7;margin:5px 0 0 23px;">State Tracker emits a temporary <code>[RELATIONS]</code> block and code applies its lines.</div>
                </label>
                <label style="display:block;padding:10px;border:1px solid rgba(255,255,255,.16);border-radius:7px;cursor:pointer;">
                    <input type="radio" name="rpg_relationship_update_mode" value="regex" ${mode === RELATIONSHIP_UPDATE_MODES.REGEX ? 'checked' : ''}>
                    <strong> Narrator Regex</strong>
                    <div style="font-size:11px;opacity:.7;margin:5px 0 0 23px;">Parses <code>(Friendship: Name +X)</code> annotations from the narrator output.</div>
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
            if (typeof runtimeState.updateAgentPanelDisabledRef === 'function') {
                runtimeState.updateAgentPanelDisabledRef();
            } else {
                const ap = document.getElementById('rpg-tracker-agent');
                if (ap) {
                    if (isLorebookAgentRuntimeActive(settings)) ap.classList.remove('is-agent-disabled');
                    else ap.classList.add('is-agent-disabled');
                }
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
            const raw = String($(this).val() || '');
            settings.routerCampaignPrefixOverride = raw;
            if (raw.trim()) {
                const ctx = SillyTavern.getContext();
                settings.routerCampaignPrefixOverrideAnchorChatId = String(
                    runtimeState.currentChatId || ctx.getCurrentChatId?.() || ctx.chatId || '',
                );
            } else {
                settings.routerCampaignPrefixOverrideAnchorChatId = '';
            }
            const ctx = SillyTavern.getContext();
            const chatId = runtimeState.currentChatId || ctx.getCurrentChatId?.() || ctx.chatId || '';
            settings.routerCampaignPrefix = getEffectiveRouterCampaignPrefix(chatId);
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

        $('#rpg_tracker_branch_campaign_btn').on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true);
            try {
                await branchCampaignChat({ saveSettings });
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
                    const chunkResult = await runRouterPass(null, LOREBOOK_FULL_AUDIT_INSTRUCTION, null, true, [], overrideChatLog);
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
            if (typeof syncRouterPromptUi === 'function') syncRouterPromptUi();
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
            const val = parseInt(String($(this).val() || '')) || 12;
            settings.routerMaxActivations = val;
            $('#rt-agent-router-max-activations').val(settings.routerMaxActivations);
            saveSettings();
        });
        $('#rpg_tracker_router_max_keyword_overflow').val(settings.routerMaxKeywordOverflow ?? 6).on('input', function () {
            settings.routerMaxKeywordOverflow = parseInt(String($(this).val() || '')) || 0;
            $('#rt-agent-router-kw-overflow-cap').val(settings.routerMaxKeywordOverflow);
            saveSettings();
        });

        // NPC and PC Card Settings bindings — delegated so toggles stay live if settings HTML is re-injected.
        $(document).off('change.rpgPortraitDisplay', '#rpg_tracker_npc_portraits, #rpg_tracker_location_images');
        $(document).on('change.rpgPortraitDisplay', '#rpg_tracker_npc_portraits', async function () {
            const s = getSettings();
            applyNpcPortraitSetting(s, !!$(this).prop('checked'));
            saveSettings();
            await refreshLorebookAgentViewsNow({ forceLayoutRefresh: true });
        });
        $(document).on('change.rpgPortraitDisplay', '#rpg_tracker_location_images', async function () {
            const s = getSettings();
            const enabled = !!$(this).prop('checked');
            if (!enabled) stopRealtimeLocationGeneration();
            applyLocationImageSetting(s, enabled);
            await saveSettings(true);
            await refreshLorebookAgentViewsNow({ forceLayoutRefresh: true });
        });
        $('#rpg_tracker_npc_portraits').prop('checked', settings.npcPortraits !== false);
        syncNpcPortraitDependentUi(settings);

        $('#rpg_tracker_location_images').prop('checked', !!settings.locationImages);
        syncLocationImageDependentUi(settings);

        $('#rpg_tracker_npc_major_words').val(settings.npcMajorWords ?? 225).on('change', function () {
            // Use 'change' instead of 'input' to only save once the user is done editing.
            // Fall back to the current saved value (not a hardcoded default) if the field is empty.
            const raw = parseInt(String($(this).val() || ''), 10);
            const val = isNaN(raw) ? (settings.npcMajorWords ?? 225) : raw;
            settings.npcMajorWords = Math.max(1, Math.min(5000, val));
            $(this).val(settings.npcMajorWords); // update display with clamped value
            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false, settings);
            }
            saveSettings();
            if (typeof globalThis._rpgRenderAgentModules === 'function') {
                globalThis._rpgRenderAgentModules();
            }
        });
        $('#rpg_tracker_npc_minor_words').val(settings.npcMinorWords ?? 135).on('change', function () {
            const raw = parseInt(String($(this).val() || ''), 10);
            const val = isNaN(raw) ? (settings.npcMinorWords ?? 135) : raw;
            settings.npcMinorWords = Math.max(1, Math.min(5000, val));
            $(this).val(settings.npcMinorWords); // update display with clamped value
            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false, settings);
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

            rebuildAllModuleInstructions(settings);
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
            saveSettings();
        });
        // Note: experimentalNpcImport removed — NPC Creator button is always visible.
        $('#rpg_tracker_ignore_npc_limits').prop('checked', !!settings.ignoreNpcImportLimits).on('change', function () {
            settings.ignoreNpcImportLimits = $(this).prop('checked');
            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false, settings);
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

        let isSyncingRouterPrompt = false;
        function syncRouterPromptUi() {
            const isBasic = !!settings.routerBasicMode;
            const $prompt = $('#rpg_tracker_router_prompt');
            const $modularWrap = $('#rpg_tracker_router_modular_prompt_wrap');
            const $modular = $('#rpg_tracker_router_modular_prompt');
            const $agentContextWrap = $('#rpg_tracker_router_agent_context_wrap');
            const $agentContext = $('#rpg_tracker_router_agent_context');
            const $fragmentsBasic = $('#rpg_tracker_router_fragments_basic');
            const $fragmentsAgent = $('#rpg_tracker_router_fragments_agent');
            const $desc = $('#rpg_tracker_router_prompt_desc');
            const $btn = $('#rpg_tracker_router_btn_reset_prompt');

            isSyncingRouterPrompt = true;
            if (isBasic) {
                $desc.html('The editable <strong>Basic Mode</strong> base prompt. Its format/module template is editable below; dynamic placeholders are expanded only for each request.');
                $prompt.val(settings.routerBasicSystemPromptTemplate || '');
                $modular.val(settings.routerModularPromptTemplate || '');
                $modularWrap.show();
                $agentContextWrap.hide();
                $fragmentsBasic.show();
                $fragmentsAgent.hide();
                $btn.html('<i class="fa-solid fa-arrow-rotate-left"></i> Reset Basic Mode Prompts');
            } else {
                $desc.html('The editable <strong>Agent Mode</strong> base prompt. Shared rules are editable below; action/tool schemas are generated from enabled modules at request time.');
                $prompt.val(settings.routerSystemPromptTemplate || '');
                $modularWrap.hide();
                $agentContext.val(settings.routerAgentSharedContextTemplate || '');
                $agentContextWrap.show();
                $fragmentsBasic.hide();
                $fragmentsAgent.show();
                $btn.html('<i class="fa-solid fa-arrow-rotate-left"></i> Reset Agent Mode Prompts');
            }
            $('#rpg_tracker_router_combat_guidance_basic').val(settings.routerCombatProfileGuidanceBasicTemplate || '');
            $('#rpg_tracker_router_combat_guidance_agent').val(settings.routerCombatProfileGuidanceAgentTemplate || '');
            $('#rpg_tracker_router_rel_section_basic').val(settings.routerRelSectionBasicTemplate || '');
            $('#rpg_tracker_router_rel_section_agent').val(settings.routerRelSectionAgentTemplate || '');
            $('#rpg_tracker_router_auto_pass_restriction').val(settings.routerAutoPassRestrictionTemplate || '');
            $('#rpg_tracker_router_manual_pass_restriction').val(settings.routerManualPassRestrictionTemplate || '');
            $('#rpg_tracker_router_existing_npc_nudge').val(settings.routerExistingNpcNudgeTemplate || '');
            isSyncingRouterPrompt = false;

            if (typeof (/** @type {any} */ ($prompt)).trigger === 'function') {
                (/** @type {any} */ ($prompt)).trigger('autosize.resize');
            }
            if (typeof (/** @type {any} */ (isBasic ? $modular : $agentContext)).trigger === 'function') {
                (/** @type {any} */ (isBasic ? $modular : $agentContext)).trigger('autosize.resize');
            }
        }

        $('#rpg_tracker_router_prompt').on('input', function () {
            if (isSyncingRouterPrompt) return;
            const val = String($(this).val() || '');
            if (settings.routerBasicMode) {
                settings.routerBasicSystemPromptTemplate = val;
            } else {
                settings.routerSystemPromptTemplate = val;
            }
            // If user edited the limit in the text directly, sync back to the settings inputs!
            const limitMatch = val.match(/You are limited to \*\*(\d+) active entries\*\*/i)
                || val.match(/Maximum Active Entities:\s*\*\*(\d+)\*\*/i);
            if (limitMatch && limitMatch[1]) {
                const parsed = parseInt(limitMatch[1], 10);
                if (parsed > 0 && parsed !== settings.routerMaxActivations) {
                    settings.routerMaxActivations = parsed;
                    $('#rpg_tracker_router_max_activations').val(parsed);
                    $('#rt-agent-router-max-activations').val(parsed);
                }
            }
            saveSettings();
        });

        $('#rpg_tracker_router_agent_context').on('input', function () {
            if (isSyncingRouterPrompt || settings.routerBasicMode) return;
            settings.routerAgentSharedContextTemplate = String($(this).val() || '');
            saveSettings();
        });

        $('#rpg_tracker_router_modular_prompt').on('input', function () {
            if (isSyncingRouterPrompt || !settings.routerBasicMode) return;
            settings.routerModularPromptTemplate = String($(this).val() || '');
            saveSettings();
        });

        const routerFragmentBindings = [
            ['#rpg_tracker_router_combat_guidance_basic', 'routerCombatProfileGuidanceBasicTemplate'],
            ['#rpg_tracker_router_combat_guidance_agent', 'routerCombatProfileGuidanceAgentTemplate'],
            ['#rpg_tracker_router_rel_section_basic', 'routerRelSectionBasicTemplate'],
            ['#rpg_tracker_router_rel_section_agent', 'routerRelSectionAgentTemplate'],
            ['#rpg_tracker_router_auto_pass_restriction', 'routerAutoPassRestrictionTemplate'],
            ['#rpg_tracker_router_manual_pass_restriction', 'routerManualPassRestrictionTemplate'],
            ['#rpg_tracker_router_existing_npc_nudge', 'routerExistingNpcNudgeTemplate'],
        ];
        for (const [selector, key] of routerFragmentBindings) {
            $(selector).on('input', function () {
                if (isSyncingRouterPrompt) return;
                settings[key] = String($(this).val() || '');
                saveSettings();
            });
        }

        $('#rpg_tracker_router_btn_reset_prompt').on('click', function () {
            const isBasic = !!settings.routerBasicMode;
            const modeName = isBasic ? 'Basic Mode' : 'Agent Mode';
            const promptLabel = isBasic ? 'base, format/module, and runtime-fragment prompts' : 'base, shared-context, and runtime-fragment prompts';
            if (!confirm(`Reset ${modeName} ${promptLabel} to default?`)) return;

            resetLorebookPromptTemplates(settings, isBasic ? 'basic' : 'agent');
            syncRouterPromptUi();
            saveSettings();
            toastr['success'](`${modeName} prompts reset to default.`, 'RPG Tracker');
        });

        syncRouterPromptUi();

        // One-time notice after migrating NPC word targets from per-section to overall totals.
        if (settings.npcWordTargetRescaleNotice && typeof settings.npcWordTargetRescaleNotice === 'object') {
            const notice = settings.npcWordTargetRescaleNotice;
            delete settings.npcWordTargetRescaleNotice;
            saveSettings();
            toastr['info'](
                `NPC word targets are now overall [CORE] totals (exactly N words). ` +
                `Rescaled ${notice.fromMajor}→${notice.toMajor} major and ${notice.fromMinor}→${notice.toMinor} minor ` +
                `(×${notice.sectionCount} sections).`,
                'NPC Word Targets',
                { timeOut: 12000 },
            );
        }

        // ── World Progression settings ─────────────────────────────────────────
        const $wpEnabled = $('#rpg_world_progression_enabled');
        const $wpInterval = $('#rpg_world_progression_interval');
        const $wpKeepActive = $('#rpg_world_progression_keep_active');
        const $wpHistoryLookback = $('#rpg_world_progression_history_lookback');
        const $wpLookback = $('#rpg_world_progression_lookback');
        const $wpSystemPrompt = $('#rpg_world_progression_system_prompt');
        const $wpResetPrompt = $('#rpg_world_progression_btn_reset_prompt');
        const $wpLastFired = $('#rpg_world_progression_last_fired');
        const $wpLastReportVal = $('#rpg_world_progression_last_report_val');
        const $wpNextReportVal = $('#rpg_world_progression_next_report_val');
        const $wpGenerateNow = $('#rpg_world_progression_generate_now');
        const $wpLocationsPerReport = $('#rpg_world_progression_locations_per_report');
        const $wpLocationRandomize = $('#rpg_world_progression_location_randomize');

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
        $wpLocationsPerReport.val(settings.worldProgressionLocationsPerReport ?? 3).on('change', function () {
            getSettings().worldProgressionLocationsPerReport = Math.max(1, Math.min(12, parseInt(String($(this).val()), 10) || 3));
            $(this).val(getSettings().worldProgressionLocationsPerReport);
            saveSettings();
            $('#rt-agent-world-locations').val(getSettings().worldProgressionLocationsPerReport);
        });
        $wpLocationRandomize.prop('checked', settings.worldProgressionLocationRandomize !== false).on('change', function () {
            getSettings().worldProgressionLocationRandomize = !!$(this).prop('checked');
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
        const $wpSkeletonUseLorebooks = $('#rpg_world_progression_skeleton_use_lorebooks');
        const $wpSkeletonLorebookGroup = $('#rpg_world_progression_skeleton_lorebook_filter_group');
        const $wpSkeletonLorebookList = $('#rpg_world_progression_skeleton_lorebook_list');
        const $wpSkeletonLorebookOnly = $('#rpg_world_progression_skeleton_lorebook_only');
        const $wpSkeletonLorebookOnlyRow = $('#rpg_world_progression_skeleton_lorebook_only_row');
        const $wpSkeletonUseExisting = $('#rpg_world_progression_skeleton_use_existing');
        const $wpSkeletonFactions = $('#rpg_world_progression_skeleton_factions');
        const $wpSkeletonLocations = $('#rpg_world_progression_skeleton_locations');
        const $wpSkeletonConflicts = $('#rpg_world_progression_skeleton_conflicts');
        const $wpSkeletonPrompt = $('#rpg_world_progression_skeleton_system_prompt');
        const $wpResetSkeletonPrompt = $('#rpg_world_progression_btn_reset_skeleton_prompt');
        const $wpGenerateSkeleton = $('#rpg_world_progression_btn_generate_skeleton');
        const $wpAddSkeleton = $('#rpg_world_progression_btn_add_skeleton');
        const $wpSkeletonStatus = $('#rpg_world_progression_skeleton_status');

        function syncSkeletonLorebookOnlyAvailability() {
            const enabled = !!$wpSkeletonUseLorebooks.prop('checked');
            const lorebookOnlyActive = enabled && !!$wpSkeletonLorebookOnly.prop('checked');
            $wpSkeletonLorebookOnlyRow.css({ opacity: enabled ? '1' : '0.45', pointerEvents: enabled ? 'auto' : 'none' });
            $wpSkeletonLorebookOnly.prop('disabled', !enabled);
            $('#rpg_world_progression_skeleton_counts').css({
                opacity: lorebookOnlyActive ? '0.4' : '1',
                pointerEvents: lorebookOnlyActive ? 'none' : 'auto',
            }).find('input').prop('disabled', lorebookOnlyActive);
        }

        async function refreshSkeletonLorebookList() {
            $wpSkeletonLorebookList.empty();
            const stCtx = SillyTavern.getContext();
            let worldNames = [];
            try {
                worldNames = await Promise.resolve(stCtx.getWorldInfoNames?.() ?? []);
                if (!worldNames.length && stCtx.updateWorldInfoList) {
                    await stCtx.updateWorldInfoList();
                    worldNames = await Promise.resolve(stCtx.getWorldInfoNames?.() ?? []);
                }
                if (!worldNames.length) {
                    const response = await fetch('/api/settings/get', {
                        method: 'POST',
                        headers: stCtx.getRequestHeaders?.() || getRequestHeaders(),
                        body: JSON.stringify({}),
                    });
                    if (response.ok) {
                        const data = await response.json();
                        worldNames = data.world_names ?? [];
                    }
                }
            } catch (error) {
                console.warn('[RPG Tracker] Failed to refresh World Skeleton source lorebooks:', error);
            }

            if (!Array.isArray(worldNames)) worldNames = [];
            const sourceBooks = [...new Set(worldNames)]
                .filter(name => name && !String(name).toLowerCase().endsWith('_skeleton'))
                .sort((a, b) => String(a).localeCompare(String(b)));
            if (!sourceBooks.length) {
                $wpSkeletonLorebookList.append($('<i>').css('opacity', '0.6').text('No lorebooks found.'));
                return;
            }

            const selected = Array.isArray(getSettings().worldProgressionSkeletonLorebookFilter)
                ? getSettings().worldProgressionSkeletonLorebookFilter
                : [];
            for (const bookName of sourceBooks) {
                const $input = $('<input type="checkbox">')
                    .attr('data-book', bookName)
                    .prop('checked', selected.includes(bookName));
                const $item = $('<label class="checkbox_label">').css('font-size', '0.9em')
                    .append($input, $('<span>').text(bookName));
                $input.on('change', function () {
                    const current = new Set(getSettings().worldProgressionSkeletonLorebookFilter || []);
                    if ($(this).prop('checked')) current.add(bookName);
                    else current.delete(bookName);
                    getSettings().worldProgressionSkeletonLorebookFilter = [...current];
                    saveSettings();
                });
                $wpSkeletonLorebookList.append($item);
            }
        }

        /** Refreshes the skeleton entry count label from the _Skeleton lorebook. */
        async function updateSkeletonStatus() {
            const ctx = SillyTavern.getContext();
            const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
            const skeletonBookName = prefix ? `${prefix}_Skeleton` : 'World_Skeleton';
            try {
                const book = await ctx.loadWorldInfo(skeletonBookName);
                const entries = book?.entries ? Object.values(book.entries) : [];
                // Legacy NPC seeds remain on disk but are intentionally inert
                // and absent from the macro-skeleton status.
                const locCount = entries.filter(e => e.extensions?.rpgCategory === 'LOC').length;
                const facCount = entries.filter(e => e.extensions?.rpgCategory === 'FAC').length;
                const conflictCount = entries.filter(e => e.extensions?.rpgCategory === 'EVENT').length;
                const count = locCount + facCount + conflictCount;

                $wpSkeletonStatus.text(count > 0
                    ? `${count} macro skeleton entries in "${skeletonBookName}" (LOC: ${locCount}, FAC: ${facCount}, CONFLICT: ${conflictCount})`
                    : 'No skeleton generated.');
            } catch (_) {
                $wpSkeletonStatus.text('No skeleton generated.');
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

        $wpSkeletonUseLorebooks.prop('checked', !!settings.worldProgressionSkeletonUseLorebooks).on('change', async function () {
            getSettings().worldProgressionSkeletonUseLorebooks = !!$(this).prop('checked');
            $wpSkeletonLorebookGroup.toggle(getSettings().worldProgressionSkeletonUseLorebooks);
            syncSkeletonLorebookOnlyAvailability();
            if (getSettings().worldProgressionSkeletonUseLorebooks) await refreshSkeletonLorebookList();
            saveSettings();
        });
        $wpSkeletonLorebookOnly.prop('checked', !!settings.worldProgressionSkeletonLorebookOnly).on('change', function () {
            getSettings().worldProgressionSkeletonLorebookOnly = !!$(this).prop('checked');
            syncSkeletonLorebookOnlyAvailability();
            saveSettings();
        });
        $wpSkeletonLorebookGroup.toggle(!!settings.worldProgressionSkeletonUseLorebooks);
        syncSkeletonLorebookOnlyAvailability();
        $('#rpg_world_progression_skeleton_lorebook_refresh').on('click', refreshSkeletonLorebookList);
        if (settings.worldProgressionSkeletonUseLorebooks) void refreshSkeletonLorebookList();

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
                toastr['success']('Skeleton Source auto-generated successfully.', 'World Skeleton');
            } catch (e) {
                toastr['error'](`Failed to generate Skeleton Source: ${e.message}`, 'World Skeleton');
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
            const useLorebooks = !!$wpSkeletonUseLorebooks.prop('checked');
            if (!atmosphere && !useLorebooks) {
                toastr['warning']('Please enter a Skeleton Source or enable existing lorebook sources before generating.', 'World Skeleton');
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
            const useLorebooks = !!$wpSkeletonUseLorebooks.prop('checked');
            if (!useExisting && !useLorebooks && !atmosphere) {
                toastr['warning']('Please enter a Skeleton Source or enable an existing source before adding entries.', 'World Skeleton');
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
        globalThis._rpgRefreshSkeletonLorebookList = refreshSkeletonLorebookList;
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
                settings.dungeonMapHistory = [];
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
            const narrativePacing = ['normal', 'shorter_outputs', 'high_agency', 'downtime'].includes(s.narrativePacing)
                ? s.narrativePacing
                : 'normal';
            $(`input[name="rpg_narrative_pacing"][value="${narrativePacing}"]`).prop('checked', true);

            // General toggles
            $('#rpg_tracker_enabled').prop('checked', !!s.enabled);
            $('#rpg_tracker_chat_link_enabled').prop('checked', !!s.chatLinkEnabled);
            $('#rpg_tracker_chat_setup_link_enabled').prop('checked', !!s.chatSetupLinkEnabled);
            $('#rpg_tracker_debug').prop('checked', !!s.debugMode);
            $('#rpg_tracker_daynight_cycle').prop('checked', !!s.dayNightCycleEnabled);
            $('#rpg_tracker_xp_bar_bottom').prop('checked', !!s.xpBarAtBottom);
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
            $('#rpg_tracker_portrait_use_story_lookback').prop('checked', !!s.portraitUseStoryLookback);
            $('#rpg_tracker_portrait_story_lookback').val(s.portraitStoryLookback ?? 5);
            $('#rpg_tracker_portrait_story_lookback_row').css({
                opacity: s.portraitUseStoryLookback ? '1' : '0.35',
                'pointer-events': s.portraitUseStoryLookback ? 'auto' : 'none',
            });
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

            // Persistent Maps
            applyMapArchitectOpenerToUi(s.mapArchitectOpener);
            syncMapArchitectOpenerNestedVisibility(s.syspromptModules?.[LOCATION_MAPPING_SECTION_TAG] ?? true);
            $('#rpg_map_architect_lookback').val(s.mapArchitectLookback ?? 12);
            $('#rpg_map_architect_max_tokens').val(s.mapArchitectMaxTokens ?? 25000);
            $('#rpg_map_architect_system_prompt').val(s.mapArchitectSystemPrompt || DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT);
            $('#rpg_map_architect_connection_source').val(s.mapArchitectConnectionSource || 'default');
            $('#rpg_map_architect_connection_profile').val(s.mapArchitectConnectionProfileId || '');
            $('#rpg_map_architect_completion_preset').val(s.mapArchitectCompletionPresetId || '');
            $('#rpg_map_architect_ollama_url').val(s.mapArchitectOllamaUrl || 'http://localhost:11434');
            $('#rpg_map_architect_ollama_model').val(s.mapArchitectOllamaModel || '');
            $('#rpg_map_architect_openai_url').val(s.mapArchitectOpenaiUrl || '');
            $('#rpg_map_architect_openai_key').val(s.mapArchitectOpenaiKey || '');
            $('#rpg_map_architect_openai_model').val(s.mapArchitectOpenaiModel || '');
            $('#rpg_map_architect_openai_model_manual').val(s.mapArchitectOpenaiModel || '');
            $('#rpg_map_architect_profile_group').toggle(s.mapArchitectConnectionSource === 'profile');
            $('#rpg_map_architect_ollama_group').toggle(s.mapArchitectConnectionSource === 'ollama');
            $('#rpg_map_architect_openai_group').toggle(s.mapArchitectConnectionSource === 'openai');
            applyMapRuntimeConnectionSettingsToUi(s);
            $('#rpg_map_updater_enabled').prop('checked', s.mapUpdaterEnabled !== false);
            $('#rpg_map_updater_run_every').val(s.mapUpdaterRunEvery ?? 1);
            $('#rpg_map_updater_max_tokens').val(s.mapUpdaterMaxTokens ?? 25000);
            $('#rpg_map_updater_system_prompt').val(s.mapUpdaterSystemPrompt || DEFAULT_MAP_UPDATER_SYSTEM_PROMPT);
            $('#rpg_map_evolution_enabled').prop('checked', s.mapEvolutionEnabled !== false);
            $('#rpg_map_evolution_interval_hours').val(s.mapEvolutionIntervalHours ?? 12);
            $('#rpg_map_evolution_onsite_interval_hours').val(s.mapEvolutionOnSiteIntervalHours ?? 1);
            $('#rpg_map_evolution_onsite_interval_minutes').val(s.mapEvolutionOnSiteIntervalMinutes ?? 0);
            $('#rpg_map_evolution_onsite_preset').val(s.mapEvolutionOnSitePreset === 'standard' ? 'standard' : 'dynamic');
            $('#rpg_map_evolution_max_tokens').val(s.mapEvolutionMaxTokens ?? 25000);
            $('#rpg_map_evolution_compress_enabled').prop('checked', s.mapEvolutionCompressEnabled !== false);
            $('#rpg_map_evolution_compress_threshold').val(s.mapEvolutionCompressThreshold ?? 10000);
            $('#rpg_map_evolution_narrator_commit_tokens').val(s.mapEvolutionNarratorCommitTokens ?? 2000);
            applyMapEvolutionTickSettingsToUi(s);
            $('#rpg_map_evolution_system_prompt').val(s.mapEvolutionSystemPrompt || DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT);
            $('#rpg_map_evolution_compress_prompt').val(s.mapEvolutionCompressSystemPrompt || DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT);
            syncMapThemeUi(s);

            // Inventory/Core Prompt
            $('#rpg_tracker_inventory_worth_mode').val(s.inventoryWorthMode || 'hover');
            $('#rpg_tracker_show_total_value').prop('checked', s.showTotalInventoryValue !== false);
            $('#rpg_tracker_full_review_mode').prop('checked', !!s.fullReviewStateMode);
            if (s.fullReviewStateMode) {
                $('#rpg_tracker_full_review_note').css('display', 'block');
                $('#rpg_tracker_core_prompt').val(FULL_REVIEW_STATE_SYSTEM_PROMPT).prop('disabled', true).css('opacity', '0.4');
                $('#rpg_tracker_user_prompt_suffix').val(FULL_REVIEW_USER_PROMPT_SUFFIX).prop('disabled', true).css('opacity', '0.4');
                $('#rpg_tracker_btn_reset_prompt').prop('disabled', true).css('opacity', '0.4');
            } else {
                $('#rpg_tracker_full_review_note').css('display', 'none');
                $('#rpg_tracker_core_prompt').val(s.systemPromptTemplate || '').prop('disabled', false).css('opacity', '1');
                $('#rpg_tracker_user_prompt_suffix').val(s.userPromptSuffix || '').prop('disabled', false).css('opacity', '1');
                $('#rpg_tracker_btn_reset_prompt').prop('disabled', false).css('opacity', '1');
            }

            // Router Agent
            $('#rpg_tracker_router_enabled').prop('checked', !!s.routerEnabled);
            if (typeof runtimeState.updateAgentPanelDisabledRef === 'function') {
                runtimeState.updateAgentPanelDisabledRef();
            } else {
                const ap = document.getElementById('rpg-tracker-agent');
                if (ap) {
                    if (isLorebookAgentRuntimeActive(s)) ap.classList.remove('is-agent-disabled');
                    else ap.classList.add('is-agent-disabled');
                }
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
            $('#rpg_tracker_animate_all_custom_bars').prop('checked', !!s.animateAllCustomBarChanges);
            $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!s.npcRelationshipBars);
            $('#rpg_tracker_npc_card_import').prop('checked', !!s.experimentalNpcImport);
            $('#rpg_tracker_ignore_npc_limits').prop('checked', !!s.ignoreNpcImportLimits);

            // World Progression
            $('#rpg_world_progression_enabled').prop('checked', !!s.worldProgressionEnabled);
            $('#rpg_world_progression_locations_per_report').val(s.worldProgressionLocationsPerReport ?? 3);
            $('#rt-agent-world-locations').val(s.worldProgressionLocationsPerReport ?? 3);
            $('#rpg_world_progression_location_randomize').prop('checked', s.worldProgressionLocationRandomize !== false);
            $('#rpg_world_progression_skeleton_use_existing').prop('checked', !!s.worldProgressionSkeletonUseExisting);
            $('#rpg_world_progression_skeleton_use_lorebooks').prop('checked', !!s.worldProgressionSkeletonUseLorebooks);
            $('#rpg_world_progression_skeleton_lorebook_filter_group').toggle(!!s.worldProgressionSkeletonUseLorebooks);
            $('#rpg_world_progression_skeleton_lorebook_only').prop('checked', !!s.worldProgressionSkeletonLorebookOnly);
            syncSkeletonLorebookOnlyAvailability();
            if (s.worldProgressionSkeletonUseLorebooks) void refreshSkeletonLorebookList();
            $('#rpg_world_progression_consolidate_enabled').prop('checked', !!s.worldProgressionConsolidateEnabled);
            if (typeof runtimeState.updateAgentWorldStatusRef === 'function') runtimeState.updateAgentWorldStatusRef();
            if (typeof runtimeState.updateAgentMapEvolutionStatusRef === 'function') runtimeState.updateAgentMapEvolutionStatusRef();

            // Textareas (Agent prompt templates)
            if (typeof syncRouterPromptUi === 'function') syncRouterPromptUi();
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
        hydrateMainSyspromptBackup(s);
        if (s.enabled && !s.customSysprompt) scheduleAutoApply();
        else scheduleDisabledTrackerMainRestore();
    }

    // Add wand button to toggle panel visibility
    addWandButton();
    installApiSetupGate();

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
                if (isHidden) syncApiSetupGate();
            }
        });

        wandContainer.appendChild(btn);

        if (!document.getElementById('rpg_tracker_debug_wand_button')) {
            const debugBtn = document.createElement('div');
            debugBtn.id = 'rpg_tracker_debug_wand_button';
            debugBtn.classList.add('list-group-item', 'flex-container', 'flexGap5');
            debugBtn.innerHTML = `
            <div class="fa-solid fa-screwdriver-wrench extensionsMenuExtensionButton"></div>
            <span>Multihog Context Debugger</span>
        `;
            debugBtn.addEventListener('click', () => {
                initializeDebugViewer();
                toggleDebugViewer();
            });
            wandContainer.appendChild(debugBtn);
        }
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
