import { runtimeState } from '../../app/runtime-state.js';
import { applyChatSetup, resetChatSetupToStock } from '../../state/chat-setup.js';
import { ensureDungeonMapHistory } from '../../state/dungeon-map-history.js';
import { summarizeMapEvolutionSchedule } from '../../../map-evolution-lib.js';

/** Restores one chat-linked tracker snapshot and synchronizes dependent UI. */
export function createChatStateLoader({
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
}) {
    return function loadChatState(chatId) {
    if (!chatId) return false;
    if (typeof globalThis._rpgPortraitMigrationLocked === 'function' && globalThis._rpgPortraitMigrationLocked()) {
        return false;
    }
    resetAutoGenerationTracking();
    const s = getSettings();
    const saved = s.chatStates?.[chatId];
    if (!saved) return false;

    if (s.chatSetupLinkEnabled) {
        if (!applyChatSetup(s, saved.setup)) resetChatSetupToStock(s);
    }

    s.currentMemo = saved.currentMemo ?? '';
    s.combatDefeatedUi = JSON.parse(JSON.stringify(saved.combatDefeatedUi || []));
    if (!/\[COMBAT\][\s\S]*?\[\/COMBAT\]/i.test(s.currentMemo)) {
        s.combatDefeatedUi = [];
    }
    s.memoHistory = saved.memoHistory ?? [];
    s.dungeonMapHistory = saved.dungeonMapHistory ?? [];
    ensureDungeonMapHistory(s);
    s.lastDelta = saved.lastDelta ?? '';
    // Legacy Chat Link keeps these presentation fields at the partition root.
    // Under setup lock the dedicated setup snapshot is authoritative, including
    // for old partitions where a missing setup intentionally means factory stock.
    if (!s.chatSetupLinkEnabled) {
        if (saved.modules) s.modules = { ...s.modules, ...saved.modules };
        if (saved.blockOrder) s.blockOrder = JSON.parse(JSON.stringify(saved.blockOrder));
        if (saved.stockPrompts) s.stockPrompts = loadStockPromptsFromProfile(saved.stockPrompts);
    }
    // Custom tracker definitions remain global under legacy Chat Link. When setup
    // lock is enabled, the chat-specific definitions were restored above.
    s.customPortraits = JSON.parse(JSON.stringify(saved.customPortraits || {}));
    s.customLocationImages = JSON.parse(JSON.stringify(saved.customLocationImages || {}));
    // Restore persisted quests (incl. completed) so the UI can display them
    s.quests = JSON.parse(JSON.stringify(saved.quests || []));
    s.historyIndex = saved.historyIndex ?? -1;

    s.activeRouterKeys = JSON.parse(JSON.stringify(saved.activeRouterKeys || []));
    s.activeWorldKeys = JSON.parse(JSON.stringify(saved.activeWorldKeys || []));
    s.keywordActivatedKeys = JSON.parse(JSON.stringify(saved.keywordActivatedKeys || []));
    s.routerLog = JSON.parse(JSON.stringify(saved.routerLog || []));
    sanitizeRouterState(s);
    s.routerLookback = saved.routerLookback || 4;
    s.routerLastRunChatLength = saved.routerLastRunChatLength ?? 0;
    s.routerLastRunAt = saved.routerLastRunAt ?? 0;
    s.mapUpdaterLastRunChatLength = saved.mapUpdaterLastRunChatLength ?? 0;
    s.mapUpdaterLastRunAt = saved.mapUpdaterLastRunAt ?? 0;
    s.mapEvolutionLastFiredBySite = JSON.parse(JSON.stringify(saved.mapEvolutionLastFiredBySite || {}));
    s.mapEvolutionBacklogBySite = JSON.parse(JSON.stringify(saved.mapEvolutionBacklogBySite || {}));
    s.mapEvolutionThreadsBySite = JSON.parse(JSON.stringify(saved.mapEvolutionThreadsBySite || {}));
    s.dungeonMapRevealAll = !!saved.dungeonMapRevealAll;
    s.mapEvolutionLastSiteRoot = saved.mapEvolutionLastSiteRoot || '';
    s.mapEvolutionPendingExitRoot = saved.mapEvolutionPendingExitRoot || '';
    s.mapEvolutionTickScope = saved.mapEvolutionTickScope || 'all';
    s.mapEvolutionTickCount = saved.mapEvolutionTickCount ?? 1;
    s.mapEvolutionTickRandomize = saved.mapEvolutionTickRandomize !== false;
    s.mapEvolutionSelectedRoots = JSON.parse(JSON.stringify(saved.mapEvolutionSelectedRoots || []));
    s.mapEvolutionIntervalHoursBySite = JSON.parse(JSON.stringify(saved.mapEvolutionIntervalHoursBySite || {}));
    s.mapEvolutionWorldReportLookback = saved.mapEvolutionWorldReportLookback ?? 5;
    s.mapEvolutionWorldReportApplications = JSON.parse(JSON.stringify(saved.mapEvolutionWorldReportApplications || {}));
    s.pcCharacterBlockSeeded = !!saved.pcCharacterBlockSeeded;
    s.routerDirectPrompt = saved.routerDirectPrompt || '';
    s.mapUpdaterDirectPrompt = saved.mapUpdaterDirectPrompt || '';
    s.mapUpdaterDirectLookback = saved.mapUpdaterDirectLookback ?? saved.routerLookback ?? 10;
    s.mapUpdaterDirectPromptOpen = !!saved.mapUpdaterDirectPromptOpen;
    s.worldProgressionLookback = saved.worldProgressionLookback ?? 20;
    s.worldProgressionHistoryLookback = saved.worldProgressionHistoryLookback ?? 0;
    s.worldProgressionInjectionPosition = saved.worldProgressionInjectionPosition ?? 4;
    s.worldProgressionInjectionDepth = saved.worldProgressionInjectionDepth ?? 4;
    s.worldProgressionInjectionRole = saved.worldProgressionInjectionRole ?? 0;
    s.worldProgressionLocationsPerReport = saved.worldProgressionLocationsPerReport ?? 3;
    s.worldProgressionLocationRandomize = saved.worldProgressionLocationRandomize !== false;
    s.worldProgressionLocationLastAdvanced = JSON.parse(JSON.stringify(saved.worldProgressionLocationLastAdvanced || {}));
    s.worldProgressionSkeletonFactions = saved.worldProgressionSkeletonFactions ?? 4;
    s.worldProgressionSkeletonLocations = saved.worldProgressionSkeletonLocations ?? 4;
    s.worldProgressionSkeletonConflicts = saved.worldProgressionSkeletonConflicts ?? 3;
    s.worldProgressionSkeletonAtmosphereSummary = saved.worldProgressionSkeletonAtmosphereSummary ?? '';
    s.worldProgressionSkeletonAtmosphereLookback = saved.worldProgressionSkeletonAtmosphereLookback ?? 30;
    s.worldProgressionSkeletonUseExisting = saved.worldProgressionSkeletonUseExisting ?? true;
    s.worldProgressionSkeletonUseLorebooks = saved.worldProgressionSkeletonUseLorebooks ?? false;
    s.worldProgressionSkeletonLorebookFilter = JSON.parse(JSON.stringify(saved.worldProgressionSkeletonLorebookFilter || []));
    s.worldProgressionSkeletonLorebookOnly = saved.worldProgressionSkeletonLorebookOnly ?? false;
    s.worldProgressionExclusionList = saved.worldProgressionExclusionList ?? '';
    s.worldProgressionLastFiredAtMinutes = saved.worldProgressionLastFiredAtMinutes ?? -1;
    s.worldProgressionLastFiredPeriodLabel = saved.worldProgressionLastFiredPeriodLabel || '';
    s.worldProgressionConsolidateEnabled = saved.worldProgressionConsolidateEnabled ?? false;
    s.worldProgressionConsolidateInterval = saved.worldProgressionConsolidateInterval ?? 7;

    // Global UI / connection / auto-image prefs are NOT restored from chatStates —
    // they stay on live top-level settings so Chat Link cannot clobber them on F5.

    applyChatTimeFormatSettings(saved);
    applyChatNpcRelMaxSettings(saved);

    // Legacy partitions predate per-chat relationship maps. Leave live values
    // alone so the next saveChatState can adopt them instead of wiping to 0.
    if (Object.prototype.hasOwnProperty.call(saved, 'npcRelationshipValues')) {
        s.npcRelationshipValues = JSON.parse(JSON.stringify(saved.npcRelationshipValues || {}));
    }
    if (Object.prototype.hasOwnProperty.call(saved, 'npcRelationshipLog')) {
        s.npcRelationshipLog = JSON.parse(JSON.stringify(saved.npcRelationshipLog || {}));
    }

    // Update settings UI inputs if rendered
    $('#rpg_world_progression_skeleton_factions').val(s.worldProgressionSkeletonFactions ?? 4);
    $('#rpg_world_progression_skeleton_locations').val(s.worldProgressionSkeletonLocations ?? 4);
    $('#rpg_world_progression_skeleton_conflicts').val(s.worldProgressionSkeletonConflicts ?? 3);
    $('#rpg_world_progression_skeleton_atmosphere').val(s.worldProgressionSkeletonAtmosphereSummary);
    $('#rpg_world_progression_skeleton_atmosphere_lookback').val(s.worldProgressionSkeletonAtmosphereLookback);
    $('#rpg_world_progression_skeleton_use_existing').prop('checked', !!s.worldProgressionSkeletonUseExisting);
    $('#rpg_world_progression_skeleton_use_lorebooks').prop('checked', !!s.worldProgressionSkeletonUseLorebooks);
    $('#rpg_world_progression_skeleton_lorebook_filter_group').toggle(!!s.worldProgressionSkeletonUseLorebooks);
    $('#rpg_world_progression_skeleton_lorebook_only').prop('checked', !!s.worldProgressionSkeletonLorebookOnly);
    $('#rpg_world_progression_skeleton_lorebook_only').prop('disabled', !s.worldProgressionSkeletonUseLorebooks);
    $('#rpg_world_progression_skeleton_lorebook_only_row').css({
        opacity: s.worldProgressionSkeletonUseLorebooks ? '1' : '0.45',
        pointerEvents: s.worldProgressionSkeletonUseLorebooks ? 'auto' : 'none',
    });
    const lorebookOnlyActive = !!s.worldProgressionSkeletonUseLorebooks && !!s.worldProgressionSkeletonLorebookOnly;
    $('#rpg_world_progression_skeleton_counts').css({
        opacity: lorebookOnlyActive ? '0.4' : '1',
        pointerEvents: lorebookOnlyActive ? 'none' : 'auto',
    }).find('input').prop('disabled', lorebookOnlyActive);
    if (s.worldProgressionSkeletonUseLorebooks && typeof globalThis._rpgRefreshSkeletonLorebookList === 'function') {
        void globalThis._rpgRefreshSkeletonLorebookList();
    }
    $('#rpg_world_progression_exclusion_list').val(s.worldProgressionExclusionList);
    $('#rpg_world_progression_locations_per_report').val(s.worldProgressionLocationsPerReport ?? 3);
    $('#rt-agent-world-locations').val(s.worldProgressionLocationsPerReport ?? 3);
    $('#rpg_world_progression_location_randomize').prop('checked', s.worldProgressionLocationRandomize !== false);
    $('#rpg_map_evolution_world_report_lookback').val(s.mapEvolutionWorldReportLookback ?? 5);
    if (typeof runtimeState.updateAgentMapEvolutionStatusRef === 'function') {
        runtimeState.updateAgentMapEvolutionStatusRef();
    }

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
    $('#rpg_tracker_show_total_value').prop('checked', s.showTotalInventoryValue !== false);
    $('#rpg_tracker_inventory_worth_mode').val(s.inventoryWorthMode || 'hover');
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

    const wpPosSelect = $('#rpg_world_progression_injection_position');
    const wpPosition = s.worldProgressionInjectionPosition ?? 4;
    const wpRole = s.worldProgressionInjectionRole ?? 0;
    const wpRoleAttr = wpPosition === 4 ? String(wpRole) : '';
    wpPosSelect.find(`option[value="${wpPosition}"][data-role="${wpRoleAttr}"]`).prop('selected', true);

    $('#rpg_world_progression_injection_depth').val(s.worldProgressionInjectionDepth ?? 3);

    if (wpPosition === 4) {
        $('#rpg_world_progression_injection_depth_container').show();
    } else {
        $('#rpg_world_progression_injection_depth_container').hide();
    }

    // Toggle container visibilities
    // Sync World Progression timing readouts for this chat
    {
        function _fmtWpMins(totalMins) {
            return formatInWorldTime(totalMins);
        }
        const label = s.worldProgressionLastFiredPeriodLabel || '';
        const labelMins = label ? (parseInWorldTime(label) ?? -1) : -1;
        const lastText = label || 'Never';
        $('#rpg_world_progression_last_fired').text(lastText);
        $('#rpg_world_progression_last_report_val').text(lastText);
        const intervalMinutes = (s.worldProgressionIntervalHours || 24) * 60;
        let nextMins = -1;
        if (labelMins >= 0) {
            nextMins = labelMins + intervalMinutes;
        } else {
            const tMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
            const tStr = tMatch ? extractCurrentTimeStr(tMatch[1]) : '';
            const tMins = tStr ? (parseInWorldTime(tStr) ?? -1) : -1;
            if (tMins >= 0) nextMins = tMins + intervalMinutes;
        }
        $('#rpg_world_progression_next_report_val').text(nextMins >= 0 ? _fmtWpMins(nextMins) : '—');

        const evoSchedule = summarizeMapEvolutionSchedule(s.mapEvolutionLastFiredBySite, {
            intervalHours: s.mapEvolutionIntervalHours,
            currentMinutes: (() => {
                const tMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
                const tStr = tMatch ? extractCurrentTimeStr(tMatch[1]) : '';
                return tStr ? (parseInWorldTime(tStr) ?? -1) : -1;
            })(),
        });
        const evoLast = evoSchedule.lastMins >= 0 ? formatInWorldTime(evoSchedule.lastMins) : 'Never';
        $('#rpg_map_evolution_last_fired').text(evoLast);
        $('#rpg_map_evolution_last_report_val').text(evoLast);
        $('#rpg_map_evolution_next_report_val').text(evoSchedule.nextMins >= 0 ? formatInWorldTime(evoSchedule.nextMins) : '—');

        // Sync consolidation fields
        $('#rpg_world_progression_consolidate_enabled').prop('checked', !!s.worldProgressionConsolidateEnabled);
        $('#rpg_world_progression_consolidate_interval').val(s.worldProgressionConsolidateInterval ?? 7);
        if (s.worldProgressionConsolidateEnabled) {
            $('#rpg_world_progression_consolidate_interval_container').show();
        } else {
            $('#rpg_world_progression_consolidate_interval_container').hide();
        }
    }

    // Don't restore routerCampaignPrefix from per-chat saved state — the prefix
    // is fully derivable from the chat ID and must be re-derived live by
    // onChatChanged. Restoring a stale value (e.g. a bare "Assistant" from
    // a previous buggy run) would cause greedy lorebook matching.

    runtimeState.historyViewIndex = -1;

    // Derive settings.quests from memo and strip archived quests from stored memo text.
    s.currentMemo = applyQuestSyncAndStripMemo(s.currentMemo);

    const dp = document.getElementById('rpg-tracker-delta-content');
    if (dp) dp.innerHTML = s.lastDelta || '<span class="delta-empty">No changes yet.</span>';

    refreshOrderList();
    syncMemoView();
    if (s.chatSetupLinkEnabled && typeof globalThis._rpgSyncSettingsUi === 'function') {
        globalThis._rpgSyncSettingsUi();
    }
    scheduleAutoApply();

    // Refresh Lorebook Agent UI
    if (typeof runtimeState.renderRouterUI === 'function') {
        runtimeState.renderRouterUI();
    }
    scheduleAgentManifestRefresh();

    if (typeof runtimeState.refreshImmersionView === 'function') {
        void runtimeState.refreshImmersionView().catch(() => {});
    }
    if (typeof globalThis._rpgSyncAgentImmersionUi === 'function') {
        globalThis._rpgSyncAgentImmersionUi();
    }
    if (isAgentPanelVisible() && typeof globalThis._rpgRefreshLorebookAgentViews === 'function') {
        void globalThis._rpgRefreshLorebookAgentViews();
    }

    // Patch any managed entries that don't yet have disable:true so ST's
    // native keyword scanner cannot inject them on user-message send.
    if (s.routerEnabled) {
        scheduleDeferred(() => {
            disableManagedEntries().catch(e => console.warn('[RPG Tracker] disableManagedEntries on chat change failed:', e));
        });
    }

    if (typeof globalThis._rpgUpdateSkeletonStatus === 'function') {
        globalThis._rpgUpdateSkeletonStatus();
    }

    hydrateImmersionSceneArtPath(chatId);

    // Adventure Companion session is per-chat when Chat Link is on.
    // Legacy partitions without the field fall back to the local per-chat map (do not wipe).
    if (saved.adventureCompanion != null && typeof globalThis._rpgApplyAdventureCompanionSnapshot === 'function') {
        globalThis._rpgApplyAdventureCompanionSnapshot(saved.adventureCompanion);
    } else if (typeof globalThis._rpgLoadAdventureCompanionForChat === 'function') {
        globalThis._rpgLoadAdventureCompanionForChat(chatId);
    }

    return true;

    };
}
