/** Wire per-tab Terminal/Direct Prompt send bars in the Lorebook Agent panel. */

import { AGENT_TERMINAL_TAB_IDS } from './agent-terminal.js';

const DRAFT_KEYS = {
    state_tracker: 'stateTrackerDirectPrompt',
    lorebook_agent: 'routerDirectPrompt',
    map_updater: 'mapUpdaterDirectPrompt',
    map_evolution: 'mapEvolutionDirectPrompt',
    map_architect: 'mapArchitectDirectPrompt',
};

const LOOKBACK_KEYS = {
    state_tracker: 'directPromptContext',
    lorebook_agent: 'routerDirectLookback',
    map_updater: 'mapUpdaterDirectLookback',
    map_evolution: 'mapEvolutionDirectLookback',
    map_architect: 'mapArchitectDirectLookback',
};

function parseLookback(raw, fallback = 10) {
    const n = parseInt(String(raw ?? ''), 10);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

/** Extract an explicit Map Architect creation target from a natural direct command. */
export function parseMapArchitectCreateDirective(value) {
    const text = String(value || '').trim();
    const match = text.match(/\bcreate\s+(?:an?\s+)?(SETTLEMENT|DUNGEON|INTERIOR)\s+map\s+for\s+(?:"([^"]+)"|'([^']+)'|([^:\r\n]+?))\s*(?::|$)/i);
    if (!match) return null;
    const site = String(match[2] || match[3] || match[4] || '').trim();
    if (!site) return null;
    return { kind: match[1].toUpperCase(), site };
}

/**
 * @param {object} options
 * @param {HTMLElement} options.agentPanel
 * @param {() => object} options.getSettings
 * @param {() => void} options.saveSettings
 * @param {() => boolean} options.agentsBusy
 * @param {(chat: any[], lookback: number, includeHidden?: boolean) => string} options.getNarrativeBlocks
 * @param {(narrative: string, manualPrompt: string|null, lookback: number|null, isManual: boolean) => Promise<any>} options.runRouterPass
 * @param {(msg: string, options?: object) => Promise<any>} options.sendDirectPrompt
 * @param {(opts: object) => Promise<any>} options.runMapUpdaterPass
 * @param {(opts: object) => Promise<any>} options.runMapEvolutionPass
 * @param {() => Promise<Array<{siteRoot: string, kind: string, current?: boolean}>>} options.listMappedEvolutionSites
 * @param {(sites: any[], escapeHtml: Function) => Promise<string[]|null>} options.promptMappedEvolutionSites
 * @param {(args: object) => Promise<any>} options.runMapArchitect
 * @param {(args: object) => Promise<object>} options.inferMapArchitectArgs
 * @param {(s: string) => string} options.escapeHtml
 * @param {(running?: boolean) => void} [options.updateAgentStatusIndicator]
 * @param {() => boolean} [options.isRouterRunning]
 */
export function wireAgentTerminalDirectPrompts({
    agentPanel,
    getSettings,
    saveSettings,
    agentsBusy,
    getNarrativeBlocks,
    runRouterPass,
    sendDirectPrompt,
    runMapUpdaterPass,
    runMapEvolutionPass,
    listMappedEvolutionSites,
    promptMappedEvolutionSites,
    runMapArchitect,
    inferMapArchitectArgs,
    escapeHtml,
    updateAgentStatusIndicator,
    isRouterRunning,
}) {
    if (!agentPanel) return;

    const persistDraft = (tabId, value) => {
        const key = DRAFT_KEYS[tabId];
        if (!key) return;
        const s = getSettings();
        s[key] = value;
        saveSettings();
    };

    const persistLookback = (tabId, value) => {
        const key = LOOKBACK_KEYS[tabId];
        if (!key) return;
        const s = getSettings();
        s[key] = value;
        saveSettings();
    };

    const readLookback = (tabId) => {
        const input = agentPanel.querySelector(`#rt-terminal-direct-lookback-${tabId}`);
        const s = getSettings();
        const fallback = Number(s[LOOKBACK_KEYS[tabId]]) || 10;
        return input ? parseLookback(input.value, fallback) : fallback;
    };

    const clearDraft = (tabId) => {
        const input = /** @type {HTMLTextAreaElement|null} */ (agentPanel.querySelector(`#rt-terminal-direct-${tabId}`));
        if (input) input.value = '';
        persistDraft(tabId, '');
    };

    const summarizeMapUpdater = (result) => {
        const skipped = result?.skipped;
        if (skipped === 'location_mapping_off' || skipped === 'dungeon_reality_off') {
            return { kind: 'warning', message: 'Persistent Maps is off.' };
        }
        if (skipped === 'no_active_map') return { kind: 'warning', message: 'No active dungeon or settlement map.' };
        if (skipped === 'no_such_map') return { kind: 'warning', message: 'That mapped site could not be loaded.' };
        if (skipped === 'disabled') return { kind: 'warning', message: 'Map Updater is disabled.' };
        if (skipped === 'busy') return { kind: 'warning', message: 'Another agent is already running.' };
        if (skipped === 'stopped') return { kind: 'info', message: 'Stopped.' };
        if (result?.ok && result?.noop) return { kind: 'info', message: 'Nothing durable changed.' };
        if (result?.ok) return { kind: 'success', message: 'Occupancy update applied.' };
        return { kind: 'error', message: 'Could not apply a valid occupancy update.' };
    };

    const summarizeMapEvolution = (result) => {
        const skipped = result?.skipped;
        if (skipped === 'location_mapping_off') return { kind: 'warning', message: 'Persistent Maps is off.' };
        if (skipped === 'no_maps' || skipped === 'no_matching_sites') return { kind: 'warning', message: 'No mapped site to evolve.' };
        if (skipped === 'disabled') return { kind: 'warning', message: 'Map Evolution is disabled.' };
        if (skipped === 'busy') return { kind: 'warning', message: 'Another agent is already running.' };
        if (result?.ok && result?.baseline) return { kind: 'info', message: 'Baseline stamps only — nothing to evolve yet.' };
        if (result?.ok) return { kind: 'success', message: 'Map Evolution pass complete.' };
        return { kind: 'error', message: 'Map Evolution could not complete.' };
    };

    const resolveCurrentSiteRoot = async () => {
        const sites = typeof listMappedEvolutionSites === 'function'
            ? await listMappedEvolutionSites().catch(() => [])
            : [];
        const current = sites.find(site => site.current);
        if (current?.siteRoot) return current.siteRoot;
        if (sites.length === 1) return sites[0].siteRoot;
        return '';
    };

    const runForTab = async (tabId) => {
        const input = /** @type {HTMLTextAreaElement|null} */ (agentPanel.querySelector(`#rt-terminal-direct-${tabId}`));
        if (!input) return;
        const msg = String(input.value || '').trim();
        if (!msg) return;

        const lookback = readLookback(tabId);
        const lookbackInput = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector(`#rt-terminal-direct-lookback-${tabId}`));
        if (lookbackInput) {
            lookbackInput.value = String(lookback);
            persistLookback(tabId, lookback);
        }

        if (tabId !== 'state_tracker' && typeof agentsBusy === 'function' && agentsBusy()) {
            toastr.warning('An agent is already running.', 'Terminal/Direct Prompt');
            return;
        }

        clearDraft(tabId);

        if (tabId === 'state_tracker') {
            const s = getSettings();
            s.directPromptContext = lookback;
            saveSettings();
            toastr['info']('Running State Tracker with specific command...');
            await sendDirectPrompt(msg);
            return;
        }

        if (tabId === 'lorebook_agent') {
            const s = getSettings();
            const { chat } = SillyTavern.getContext();
            const combinedNarrative = getNarrativeBlocks(chat, -1, !!s.routerIncludeHidden);
            toastr['info']('Running Lorebook Agent with specific command...');
            await runRouterPass(combinedNarrative, msg, lookback, true);
            return;
        }

        if (tabId === 'map_updater') {
            toastr['info']('Running Map Updater with specific command...');
            if (typeof updateAgentStatusIndicator === 'function' && typeof isRouterRunning === 'function') {
                updateAgentStatusIndicator(isRouterRunning());
            }
            const result = await runMapUpdaterPass({
                isManual: true,
                lookback,
                directInstruction: msg,
            });
            if (typeof updateAgentStatusIndicator === 'function' && typeof isRouterRunning === 'function') {
                updateAgentStatusIndicator(isRouterRunning());
            }
            const summary = summarizeMapUpdater(result);
            toastr[summary.kind === 'success' ? 'success' : summary.kind === 'warning' ? 'warning' : summary.kind === 'error' ? 'error' : 'info'](
                summary.message,
                'Map Updater',
            );
            return;
        }

        if (tabId === 'map_evolution') {
            const sites = typeof listMappedEvolutionSites === 'function'
                ? await listMappedEvolutionSites()
                : [];
            if (!sites.length) {
                toastr.warning('No mapped site to evolve.', 'Map Evolution');
                return;
            }
            let siteRoots = sites.filter(site => site.current).map(site => site.siteRoot);
            if (!siteRoots.length) {
                siteRoots = await promptMappedEvolutionSites(sites, escapeHtml);
                if (!siteRoots) return;
                if (!siteRoots.length) {
                    toastr.warning('Check at least one mapped site.', 'Map Evolution');
                    return;
                }
            }
            toastr['info']('Running Map Evolution with specific command...');
            if (typeof updateAgentStatusIndicator === 'function' && typeof isRouterRunning === 'function') {
                updateAgentStatusIndicator(isRouterRunning());
            }
            const result = await runMapEvolutionPass({
                trigger: 'manual',
                isManual: true,
                siteRoots,
                directInstruction: msg,
            });
            if (typeof updateAgentStatusIndicator === 'function' && typeof isRouterRunning === 'function') {
                updateAgentStatusIndicator(isRouterRunning());
            }
            const summary = summarizeMapEvolution(result);
            toastr[summary.kind === 'success' ? 'success' : summary.kind === 'warning' ? 'warning' : summary.kind === 'error' ? 'error' : 'info'](
                summary.message,
                'Map Evolution',
            );
            return;
        }

        if (tabId === 'map_architect') {
            const directive = parseMapArchitectCreateDirective(msg);
            const activeSiteRoot = await resolveCurrentSiteRoot();
            const siteRoot = directive?.site || activeSiteRoot;
            if (!siteRoot) {
                toastr.warning('Name a site with “Create INTERIOR/DUNGEON/SETTLEMENT map for \"Site Name\"”, or open a mapped location first.', 'Map Architect');
                return;
            }
            toastr['info'](`Running Map Architect for ${siteRoot}...`);
            try {
                const args = await inferMapArchitectArgs({
                    site: siteRoot,
                    userBrief: msg,
                    lookback,
                });
                if (directive) args.kind = directive.kind;
                await runMapArchitect(args);
                toastr['success'](`Map Architect finished for ${siteRoot}.`, 'Map Architect');
            } catch (error) {
                console.error('[RPG Tracker] Map Architect direct prompt failed:', error);
                toastr.error(String(error?.message || error), 'Map Architect');
            }
        }
    };

    AGENT_TERMINAL_TAB_IDS.forEach(tabId => {
        const input = agentPanel.querySelector(`#rt-terminal-direct-${tabId}`);
        const lookbackInput = agentPanel.querySelector(`#rt-terminal-direct-lookback-${tabId}`);
        const runBtn = agentPanel.querySelector(`.rt-agent-terminal-direct-run[data-terminal-tab="${tabId}"]`);

        if (input) {
            const grow = () => {
                const line = parseFloat(getComputedStyle(input).lineHeight) || 16;
                const max = line * 5;
                input.style.height = 'auto';
                input.style.overflowY = 'hidden';
                const next = Math.min(max, Math.max(line, input.scrollHeight));
                input.style.height = `${next}px`;
                input.style.overflowY = input.scrollHeight > max + 1 ? 'auto' : 'hidden';
            };
            grow();
            input.addEventListener('input', () => {
                grow();
                persistDraft(tabId, /** @type {HTMLTextAreaElement} */ (input).value);
            });
            input.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void runForTab(tabId);
                }
            });
        }
        if (lookbackInput) {
            lookbackInput.addEventListener('change', () => {
                const value = parseLookback(/** @type {HTMLInputElement} */ (lookbackInput).value, 10);
                /** @type {HTMLInputElement} */ (lookbackInput).value = String(value);
                persistLookback(tabId, value);
            });
        }
        if (runBtn) {
            runBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                void runForTab(tabId);
            });
        }
    });
}
