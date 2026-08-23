/** Shared helpers for the tabbed Agent Console in the Lorebook Agent panel. */

export const AGENT_TERMINAL_TABS = [
    { id: 'state_tracker', label: 'State Tracker' },
    { id: 'lorebook_agent', label: 'Lorebook Agent' },
    { id: 'map_updater', label: 'Map Updater' },
    { id: 'map_evolution', label: 'Map Evolution' },
    { id: 'map_architect', label: 'Map Architect' },
];

export const AGENT_TERMINAL_TAB_IDS = AGENT_TERMINAL_TABS.map(tab => tab.id);

/** Agent sources that share the Lorebook Agent panel Stop button. */
export const AGENT_PANEL_RUNNING_SOURCES = new Set([
    'lorebook_agent',
    'map_updater',
    'map_evolution',
    'map_architect',
]);

/** Agent sources whose finish/error should refresh Campaign Records. */
export const MANIFEST_REFRESH_SOURCES = new Set([
    'lorebook_agent',
    'map_updater',
    'map_evolution',
    'map_architect',
]);

/**
 * @param {Record<string, unknown>} [metadata]
 * @returns {'state_tracker'|'lorebook_agent'|'map_updater'|'map_evolution'|'map_architect'}
 */
export function resolveTerminalSource(metadata = {}) {
    const source = metadata?.source;
    if (source === 'state_tracker') return 'state_tracker';
    if (source === 'map_updater') return 'map_updater';
    if (source === 'map_evolution') return 'map_evolution';
    if (source === 'map_architect') return 'map_architect';
    if (source === 'lorebook_agent') return 'lorebook_agent';
    return 'lorebook_agent';
}

/** @returns {Record<string, object[]>} */
export function createEmptyTerminalBuffers() {
    return Object.fromEntries(AGENT_TERMINAL_TAB_IDS.map(id => [id, []]));
}

export const AGENT_TERMINAL_EMPTY_HTML = '';

/**
 * @param {string} type
 * @param {string} content
 * @param {Record<string, unknown>} [metadata]
 */
export function broadcastAgentStep(type, content, metadata = {}) {
    document.dispatchEvent(new CustomEvent('rt_lore_agent_step', {
        detail: { type, content, metadata, timestamp: Date.now() },
    }));
}

/**
 * @param {string} type
 * @param {string} content
 * @param {Record<string, unknown>} [metadata]
 */
export function broadcastStateTrackerStep(type, content, metadata = {}) {
    broadcastAgentStep(type, content, { source: 'state_tracker', ...metadata });
}

/**
 * @param {object[]} steps
 * @param {(steps: object[]) => string} renderSteps
 * @returns {string}
 */
export function renderTerminalPane(steps, renderSteps) {
    if (!steps?.length) return AGENT_TERMINAL_EMPTY_HTML;
    return renderSteps(steps);
}

/**
 * @param {string} tabId
 * @returns {boolean}
 */
export function isValidTerminalTab(tabId) {
    return AGENT_TERMINAL_TAB_IDS.includes(tabId);
}

/**
 * @param {string | undefined | null} tabId
 * @param {string} [fallback='lorebook_agent']
 * @returns {string}
 */
export function resolveActiveTerminalTab(tabId, fallback = 'lorebook_agent') {
    return isValidTerminalTab(tabId) ? tabId : fallback;
}
