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
        routerDirectPrompt: s.routerDirectPrompt || '',
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
        worldProgressionLastFiredAtMinutes: s.worldProgressionLastFiredAtMinutes ?? -1,
        worldProgressionLastFiredPeriodLabel: s.worldProgressionLastFiredPeriodLabel || '',
        worldProgressionConsolidateEnabled: s.worldProgressionConsolidateEnabled ?? false,
        worldProgressionConsolidateInterval: s.worldProgressionConsolidateInterval ?? 7,
        worldProgressionSkeletonAtmosphereSummary: s.worldProgressionSkeletonAtmosphereSummary || '',
        worldProgressionSkeletonAtmosphereLookback: s.worldProgressionSkeletonAtmosphereLookback ?? 30,
        worldProgressionSkeletonUseExisting: s.worldProgressionSkeletonUseExisting ?? true,
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
