/**
 * Runtime bridge for UI modules.
 *
 * Feature modules must not import index.js: index is the application entry point
 * and importing it from a feature creates an ESM cycle.  The entry point installs
 * its runtime actions during startup; feature modules call these small wrappers.
 */
/** Filled by the entry point, which owns renderer initialization. */
export const RENDERING_TAGS_LIBRARY = [];

export const sectionPages = {};

let actions = Object.create(null);

export function configureRuntimeActions(nextActions) {
    actions = { ...actions, ...nextActions };
}

function invoke(name, args) {
    const action = actions[name];
    if (typeof action !== 'function') {
        throw new Error(`[RPG Tracker] Runtime action "${name}" was used before initialization.`);
    }
    return action(...args);
}

/**
 * Returns lazily-bound actions for modules with a larger, temporary surface.
 * New modules should prefer named exports above; this adapter keeps a large
 * legacy extraction from recreating an index.js import cycle.
 */
export function getRuntimeActions() {
    return new Proxy(Object.create(null), {
        get(_target, name) {
            return (...args) => invoke(String(name), args);
        },
    });
}

export const saveSettings = (...args) => invoke('saveSettings', args);
export const refreshRenderedView = (...args) => invoke('refreshRenderedView', args);
export const autoApplySysprompt = (...args) => invoke('autoApplySysprompt', args);
export const fetchBaseSyspromptRaw = (...args) => invoke('fetchBaseSyspromptRaw', args);
export const sendDirectPrompt = (...args) => invoke('sendDirectPrompt', args);
export const refreshAgentManifestNow = (...args) => invoke('refreshAgentManifestNow', args);
export const syncTimeFormatSettingsUi = (...args) => invoke('syncTimeFormatSettingsUi', args);
export const applyTrackerThemeToDom = (...args) => invoke('applyTrackerThemeToDom', args);
export const setUse24hTime = (...args) => invoke('setUse24hTime', args);
export const setUseDdMmYyFormat = (...args) => invoke('setUseDdMmYyFormat', args);
export const updateStatusIndicator = (...args) => invoke('updateStatusIndicator', args);
export const syncNpcPortraitDependentUi = (...args) => invoke('syncNpcPortraitDependentUi', args);
export const syncLocationImageDependentUi = (...args) => invoke('syncLocationImageDependentUi', args);
export const refreshQuestPrompt = (...args) => invoke('refreshQuestPrompt', args);
export const syncMemoView = (...args) => invoke('syncMemoView', args);
export const bindRenderedCardEvents = (...args) => invoke('bindRenderedCardEvents', args);
export const rebuildNpcInstructionIfNeeded = (...args) => invoke('rebuildNpcInstructionIfNeeded', args);
