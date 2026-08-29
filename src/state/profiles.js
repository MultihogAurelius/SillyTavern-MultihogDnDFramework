/**
 * Profile snapshot / save / delete helpers.
 */

import { DEFAULT_STOCK_PROMPTS, BLOCK_ORDER } from '../../constants.js';
import { getSettings } from './settings.js';
import { saveSettings } from '../app/runtime-bridge.js';

export function snapshotStockPromptsForProfile(stockPrompts) {
    return {
        ...JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS)),
        ...JSON.parse(JSON.stringify(stockPrompts || {})),
    };
}

/**
 * Restores stock module prompts from a profile snapshot, filling any keys
 * missing in older profiles from current defaults.
 * @param {Record<string, string>|null|undefined} profileStockPrompts
 * @returns {Record<string, string>}
 */
export function loadStockPromptsFromProfile(profileStockPrompts) {
    if (!profileStockPrompts) {
        return JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS));
    }
    return {
        ...JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS)),
        ...JSON.parse(JSON.stringify(profileStockPrompts)),
    };
}

/**
 * Saves the current tracker state into a named profile slot.
 * @param {string} name
 */
export function saveProfile(name) {
    const s = getSettings();
    if (!name) return;
    if (!s.profiles) s.profiles = {};
    s.profiles[name] = {
        currentMemo: s.currentMemo,
        memoHistory: JSON.parse(JSON.stringify(s.memoHistory)),
        dungeonMapHistory: JSON.parse(JSON.stringify(s.dungeonMapHistory || [])),
        modules: JSON.parse(JSON.stringify(s.modules)),
        blockOrder: JSON.parse(JSON.stringify(s.blockOrder || BLOCK_ORDER)),
        stockPrompts: snapshotStockPromptsForProfile(s.stockPrompts),
        modulePageSizes: JSON.parse(JSON.stringify(s.modulePageSizes || {})),
        customFields: JSON.parse(JSON.stringify(s.customFields || [])),
        // quests are derived from currentMemo on load — not persisted separately
        lastDelta: s.lastDelta || '',
        historyIndex: s.historyIndex ?? -1,
        activeRouterKeys: JSON.parse(JSON.stringify(s.activeRouterKeys || [])),
        activeWorldKeys:  JSON.parse(JSON.stringify(s.activeWorldKeys || [])),
        routerLog:    JSON.parse(JSON.stringify(s.routerLog || [])),
        routerCampaignPrefix: s.routerCampaignPrefix || '',
        routerLookback: s.routerLookback || 4,
        routerLastRunChatLength: s.routerLastRunChatLength ?? 0,
        routerLastRunAt: s.routerLastRunAt ?? 0,
        mapUpdaterLastRunChatLength: s.mapUpdaterLastRunChatLength ?? 0,
        mapUpdaterLastRunAt: s.mapUpdaterLastRunAt ?? 0,
        mapUpdaterLastSiteRoot: s.mapUpdaterLastSiteRoot || '',
        mapUpdaterPendingExitRoot: s.mapUpdaterPendingExitRoot || '',
        mapEvolutionEnabled: s.mapEvolutionEnabled !== false,
        mapEvolutionIntervalHours: s.mapEvolutionIntervalHours ?? 8,
        mapEvolutionOnSiteIntervalHours: s.mapEvolutionOnSiteIntervalHours ?? 1,
        mapEvolutionOnSiteIntervalMinutes: s.mapEvolutionOnSiteIntervalMinutes ?? 0,
        mapEvolutionOnSitePreset: s.mapEvolutionOnSitePreset === 'standard' ? 'standard' : 'dynamic',
        mapEvolutionIntervalHoursBySite: JSON.parse(JSON.stringify(s.mapEvolutionIntervalHoursBySite || {})),
        mapEvolutionLookback: s.mapEvolutionLookback ?? 20,
        mapEvolutionMaxTokens: s.mapEvolutionMaxTokens ?? 25000,
        mapEvolutionCompressEnabled: s.mapEvolutionCompressEnabled !== false,
        mapEvolutionCompressThreshold: s.mapEvolutionCompressThreshold ?? 10000,
        mapEvolutionNarratorCommitTokens: s.mapEvolutionNarratorCommitTokens ?? 2000,
        mapEvolutionCompressSystemPrompt: s.mapEvolutionCompressSystemPrompt || "",
        mapEvolutionTickScope: s.mapEvolutionTickScope || "all",
        mapEvolutionTickCount: s.mapEvolutionTickCount ?? 1,
        mapEvolutionTickRandomize: s.mapEvolutionTickRandomize !== false,
        mapEvolutionSelectedRoots: JSON.parse(JSON.stringify(s.mapEvolutionSelectedRoots || [])),
        mapEvolutionSystemPrompt: s.mapEvolutionSystemPrompt || "",
        mapEvolutionLastFiredBySite: JSON.parse(JSON.stringify(s.mapEvolutionLastFiredBySite || {})),
        mapEvolutionBacklogBySite: JSON.parse(JSON.stringify(s.mapEvolutionBacklogBySite || {})),
        mapEvolutionThreadsBySite: JSON.parse(JSON.stringify(s.mapEvolutionThreadsBySite || {})),
        dungeonMapRevealAll: !!s.dungeonMapRevealAll,
        mapEvolutionLastSiteRoot: s.mapEvolutionLastSiteRoot || '',
        mapEvolutionWorldReportLookback: s.mapEvolutionWorldReportLookback ?? 5,
        mapEvolutionWorldReportApplications: JSON.parse(JSON.stringify(s.mapEvolutionWorldReportApplications || {})),
        routerDirectPrompt: s.routerDirectPrompt || '',
        stateTrackerDirectPrompt: s.stateTrackerDirectPrompt || '',
        mapUpdaterDirectPrompt: s.mapUpdaterDirectPrompt || '',
        mapUpdaterDirectLookback: s.mapUpdaterDirectLookback ?? s.routerLookback ?? 10,
        mapUpdaterDirectPromptOpen: !!s.mapUpdaterDirectPromptOpen,
        mapEvolutionDirectPrompt: s.mapEvolutionDirectPrompt || '',
        mapEvolutionDirectLookback: s.mapEvolutionDirectLookback ?? 10,
        mapArchitectDirectPrompt: s.mapArchitectDirectPrompt || '',
        mapArchitectDirectLookback: s.mapArchitectDirectLookback ?? 10,
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
        worldProgressionLocationsPerReport: s.worldProgressionLocationsPerReport ?? 3,
        worldProgressionLocationRandomize: s.worldProgressionLocationRandomize !== false,
        worldProgressionLocationLastAdvanced: JSON.parse(JSON.stringify(s.worldProgressionLocationLastAdvanced || {})),
        worldProgressionSkeletonFactions: s.worldProgressionSkeletonFactions ?? 4,
        worldProgressionSkeletonLocations: s.worldProgressionSkeletonLocations ?? 4,
        worldProgressionSkeletonConflicts: s.worldProgressionSkeletonConflicts ?? 3,
        worldProgressionLastFiredAtMinutes: s.worldProgressionLastFiredAtMinutes ?? -1,
        worldProgressionLastFiredPeriodLabel: s.worldProgressionLastFiredPeriodLabel || '',
        worldProgressionConsolidateEnabled: s.worldProgressionConsolidateEnabled ?? false,
        worldProgressionConsolidateInterval: s.worldProgressionConsolidateInterval ?? 7,
        worldProgressionSkeletonAtmosphereSummary: s.worldProgressionSkeletonAtmosphereSummary || '',
        worldProgressionSkeletonAtmosphereLookback: s.worldProgressionSkeletonAtmosphereLookback ?? 30,
        worldProgressionSkeletonUseExisting: s.worldProgressionSkeletonUseExisting ?? true,

        worldProgressionSkeletonUseLorebooks: s.worldProgressionSkeletonUseLorebooks ?? false,

        worldProgressionSkeletonLorebookFilter: JSON.parse(JSON.stringify(s.worldProgressionSkeletonLorebookFilter || [])),

        worldProgressionSkeletonLorebookOnly: s.worldProgressionSkeletonLorebookOnly ?? false,
        worldProgressionExclusionList: s.worldProgressionExclusionList || '',

        portraitGeneratorSource: s.portraitGeneratorSource ?? "native",
        portraitSkipPromptDialog: s.portraitSkipPromptDialog ?? false,
        hideImageGenToasts: s.hideImageGenToasts ?? false,
        portraitAutoGenerateParty: s.portraitAutoGenerateParty ?? false,
        portraitAutoGeneratePlayer: s.portraitAutoGeneratePlayer ?? false,
        portraitAutoGenerateEnemies: s.portraitAutoGenerateEnemies ?? false,
        portraitAutoGenerateNpcs: s.portraitAutoGenerateNpcs ?? false,
        portraitAutoGenerateLocations: s.portraitAutoGenerateLocations ?? false,
        portraitAutoGenerateSceneView: s.portraitAutoGenerateSceneView ?? false,
        portraitRealtimeTriggerMode: s.portraitRealtimeTriggerMode || 'location_change',
        portraitRealtimeEveryNOutputs: Math.max(1, Number(s.portraitRealtimeEveryNOutputs) || 1),
        portraitRegenerateVisitedLocations: s.portraitRegenerateVisitedLocations ?? false,
        locationImages: !!s.locationImages,
        portraitConnectionSource: s.portraitConnectionSource ?? "default",
        portraitConnectionProfileId: s.portraitConnectionProfileId || "",
        portraitCompletionPresetId: s.portraitCompletionPresetId || "",
        portraitOllamaUrl: s.portraitOllamaUrl || "http://localhost:11434",
        portraitOllamaModel: s.portraitOllamaModel || "",
        portraitOpenaiUrl: s.portraitOpenaiUrl || "",
        portraitOpenaiKey: s.portraitOpenaiKey || "",
        portraitOpenaiModel: s.portraitOpenaiModel || "",
        mapArchitectLookback: s.mapArchitectLookback ?? 12,
        mapArchitectMaxTokens: s.mapArchitectMaxTokens ?? 25000,
        mapArchitectOpener: s.mapArchitectOpener || 'tool',
        mapArchitectSystemPrompt: s.mapArchitectSystemPrompt || "",
        mapArchitectConnectionSource: s.mapArchitectConnectionSource ?? "default",
        mapArchitectConnectionProfileId: s.mapArchitectConnectionProfileId || "",
        mapArchitectCompletionPresetId: s.mapArchitectCompletionPresetId || "",
        mapArchitectOllamaUrl: s.mapArchitectOllamaUrl || "http://localhost:11434",
        mapArchitectOllamaModel: s.mapArchitectOllamaModel || "",
        mapArchitectOpenaiUrl: s.mapArchitectOpenaiUrl || "",
        mapArchitectOpenaiKey: s.mapArchitectOpenaiKey || "",
        mapArchitectOpenaiModel: s.mapArchitectOpenaiModel || "",
        mapRuntimeConnectionSource: s.mapRuntimeConnectionSource ?? "default",
        mapRuntimeConnectionProfileId: s.mapRuntimeConnectionProfileId || "",
        mapRuntimeCompletionPresetId: s.mapRuntimeCompletionPresetId || "",
        mapRuntimeOllamaUrl: s.mapRuntimeOllamaUrl || "http://localhost:11434",
        mapRuntimeOllamaModel: s.mapRuntimeOllamaModel || "",
        mapRuntimeOpenaiUrl: s.mapRuntimeOpenaiUrl || "",
        mapRuntimeOpenaiKey: s.mapRuntimeOpenaiKey || "",
        mapRuntimeOpenaiModel: s.mapRuntimeOpenaiModel || "",
        mapEvolutionConnectionSource: s.mapEvolutionConnectionSource ?? "default",
        mapEvolutionConnectionProfileId: s.mapEvolutionConnectionProfileId || "",
        mapEvolutionCompletionPresetId: s.mapEvolutionCompletionPresetId || "",
        mapEvolutionOllamaUrl: s.mapEvolutionOllamaUrl || "http://localhost:11434",
        mapEvolutionOllamaModel: s.mapEvolutionOllamaModel || "",
        mapEvolutionOpenaiUrl: s.mapEvolutionOpenaiUrl || "",
        mapEvolutionOpenaiKey: s.mapEvolutionOpenaiKey || "",
        mapEvolutionOpenaiModel: s.mapEvolutionOpenaiModel || "",
        mapUpdaterEnabled: s.mapUpdaterEnabled !== false,
        mapUpdaterRunEvery: s.mapUpdaterRunEvery ?? 1,
        mapUpdaterMaxTokens: s.mapUpdaterMaxTokens ?? 25000,
        mapUpdaterSystemPrompt: s.mapUpdaterSystemPrompt || "",

        worldConnectionSource: s.worldConnectionSource ?? "default",
        worldConnectionProfileId: s.worldConnectionProfileId || "",
        worldCompletionPresetId: s.worldCompletionPresetId || "",
        worldOllamaUrl: s.worldOllamaUrl || "http://localhost:11434",
        worldOllamaModel: s.worldOllamaModel || "",
        worldOpenaiUrl: s.worldOpenaiUrl || "",
        worldOpenaiKey: s.worldOpenaiKey || "",
        worldOpenaiModel: s.worldOpenaiModel || "",
        gameSystemWizardConnectionSource: s.gameSystemWizardConnectionSource ?? "default",
        gameSystemWizardConnectionProfileId: s.gameSystemWizardConnectionProfileId || "",
        gameSystemWizardCompletionPresetId: s.gameSystemWizardCompletionPresetId || "",
        gameSystemWizardOllamaUrl: s.gameSystemWizardOllamaUrl || "http://localhost:11434",
        gameSystemWizardOllamaModel: s.gameSystemWizardOllamaModel || "",
        gameSystemWizardOpenaiUrl: s.gameSystemWizardOpenaiUrl || "",
        gameSystemWizardOpenaiKey: s.gameSystemWizardOpenaiKey || "",
        gameSystemWizardOpenaiModel: s.gameSystemWizardOpenaiModel || "",

        characterCreationConnectionSource: s.characterCreationConnectionSource ?? "default",

        characterCreationConnectionProfileId: s.characterCreationConnectionProfileId || "",

        characterCreationCompletionPresetId: s.characterCreationCompletionPresetId || "",

        characterCreationOllamaUrl: s.characterCreationOllamaUrl || "http://localhost:11434",

        characterCreationOllamaModel: s.characterCreationOllamaModel || "",

        characterCreationOpenaiUrl: s.characterCreationOpenaiUrl || "",

        characterCreationOpenaiKey: s.characterCreationOpenaiKey || "",

        characterCreationOpenaiModel: s.characterCreationOpenaiModel || "",
        gameSystemWizardSystemPrompt: s.gameSystemWizardSystemPrompt || "",
    };
    s.activeProfile = name;
    void saveSettings();
}

/**
 * Deletes a named profile slot.
 * @param {string} name
 */
export function deleteProfile(name) {
    const s = getSettings();
    if (!s.profiles?.[name]) return;
    delete s.profiles[name];
    if (s.activeProfile === name) s.activeProfile = '';
    void saveSettings();
}

/**
 * Safely sanitizes router state arrays to prevent crashes from dirty/malformed data.
 * @param {Record<string, any>} s - The settings object to sanitize.
 */
