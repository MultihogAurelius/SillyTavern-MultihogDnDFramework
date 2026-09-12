import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { canCommitPassForChat } from '../src/state/pass-affinity.js';

const source = readFileSync(new URL('../router.js', import.meta.url), 'utf8');

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

/**
 * Extract runWorldProgressionPass with its local abort helpers so we can simulate
 * a mid-await chat switch without booting SillyTavern.
 */
function installWorldProgression(context) {
    const start = source.indexOf('export async function runWorldProgressionPass');
    if (start < 0) throw new Error('Missing runWorldProgressionPass');
    // Include module-level controller helpers that the pass closes over.
    const helperStart = source.indexOf('let _worldProgressionController = null');
    const stopFn = source.slice(
        source.indexOf('export function stopWorldProgressionPass'),
        source.indexOf('\n}', source.indexOf('export function stopWorldProgressionPass')) + 2,
    ).replace(/^export /, '');
    const controllerDecl = 'let _worldProgressionController = null;\n';
    const endMarker = '\n// -- World Skeleton';
    const end = source.indexOf(endMarker, start);
    if (end < 0) throw new Error('Missing World Skeleton marker after WP pass');
    const fnBody = source.slice(start, end).replace(/^export /, '');
    runInContext(`${controllerDecl}\n${stopFn}\n${fnBody}`, context);
    return {
        run: context.runWorldProgressionPass,
        stop: context.stopWorldProgressionPass,
    };
}

describe('World Progression chat ownership', () => {
    it('does not persist the WP timer or apply a report after a mid-LLM chat switch', async () => {
        let chatId = 'ChatA';
        const gate = deferred();
        const persist = vi.fn();
        const apply = vi.fn();
        const broadcast = vi.fn();
        const context = createContext({
            console: { log() {}, warn() {}, error() {} },
            AbortController,
            canCommitPassForChat,
            getActiveChatId: () => chatId,
            getSettings: () => ({
                worldProgressionIntervalHours: 24,
                worldProgressionKeepActive: 1,
                worldProgressionLastFiredPeriodLabel: '',
                worldProgressionLocationLastAdvanced: {},
                worldProgressionConsolidateEnabled: false,
                worldProgressionHistoryLookback: 0,
                worldProgressionLookback: 0,
                worldProgressionLocationsPerReport: 1,
                worldProgressionLocationRandomize: false,
                worldProgressionExclusionList: '',
                worldProgressionSystemPrompt: 'Write {periodLabel} ({wordTarget})',
                useDdMmYyFormat: false,
                worldConnectionSource: 'default',
            }),
            getLivePrefix: () => 'CampaignA',
            parseInWorldMinutes: () => null,
            computePeriodLabel: () => 'Day 1',
            broadcastStep: broadcast,
            getWorldInfoNamesSafe: async () => [],
            bookBelongsToPrefix: () => true,
            SillyTavern: { getContext: () => ({ chat: [], loadWorldInfo: async () => null, saveWorldInfo: async () => {} }) },
            buildWorldProgressionLocationDossiers: () => ({ dossiers: [], globalContext: '' }),
            selectWorldProgressionLocations: () => [],
            stampLocationAdvancement: (_prev, locs, label) => ({ [locs?.[0] || 'x']: label }),
            normalizeWorldReportMetadata: () => ({ reportId: '', selectedLocations: [] }),
            sendStateRequest: () => gate.promise,
            applyAction: apply,
            persistWorldProgressionTimer: persist,
            WORLD_REPORT_METADATA_KEY: 'rpgWorldReport',
            getRequestHeaders: () => ({}),
            fetch: async () => ({ ok: true, json: async () => ({}) }),
        });
        // Provide the private helper that production code defines in-module.
        runInContext('function getLivePrefix() { return globalThis.__wpPrefix || "CampaignA"; }', context);
        context.__wpPrefix = 'CampaignA';
        // Override getLivePrefix reference used inside the extracted function via assignment
        // after install — the extracted source calls getLivePrefix() from closure scope.
        const { run } = installWorldProgression(Object.assign(context, {
            getLivePrefix() { return 'CampaignA'; },
        }));

        const pending = run('Day 1 00:00', 24 * 60);
        // Switch while the main report LLM is in flight.
        await Promise.resolve();
        // Allow book-load path to finish; sendStateRequest is the gated await.
        // Drain microtasks until the LLM gate is awaited.
        for (let i = 0; i < 20; i++) await Promise.resolve();
        chatId = 'ChatB';
        gate.resolve('## Town\nQuiet streets.\n\n## Wider Currents\nTrade slows.');
        const result = await pending;

        expect(result).toEqual({ ok: false, error: 'chat_changed' });
        expect(apply).not.toHaveBeenCalled();
        expect(persist).not.toHaveBeenCalled();
        expect(broadcast).toHaveBeenCalledWith(
            'thought',
            expect.stringContaining('active chat changed'),
        );
    });

    it('stopWorldProgressionPass aborts an in-flight generation', async () => {
        let chatId = 'ChatA';
        const gate = deferred();
        const persist = vi.fn();
        const apply = vi.fn();
        const context = createContext({
            console: { log() {}, warn() {}, error() {} },
            AbortController,
            canCommitPassForChat,
            getActiveChatId: () => chatId,
            getSettings: () => ({
                worldProgressionIntervalHours: 24,
                worldProgressionKeepActive: 1,
                worldProgressionLastFiredPeriodLabel: '',
                worldProgressionLocationLastAdvanced: {},
                worldProgressionConsolidateEnabled: false,
                worldProgressionHistoryLookback: 0,
                worldProgressionLookback: 0,
                worldProgressionLocationsPerReport: 1,
                worldProgressionLocationRandomize: false,
                worldProgressionExclusionList: '',
                worldProgressionSystemPrompt: 'Write {periodLabel}',
                useDdMmYyFormat: false,
                worldConnectionSource: 'default',
            }),
            parseInWorldMinutes: () => null,
            computePeriodLabel: () => 'Day 1',
            broadcastStep() {},
            getWorldInfoNamesSafe: async () => [],
            bookBelongsToPrefix: () => true,
            SillyTavern: { getContext: () => ({ chat: [], loadWorldInfo: async () => null, saveWorldInfo: async () => {} }) },
            buildWorldProgressionLocationDossiers: () => ({ dossiers: [], globalContext: '' }),
            selectWorldProgressionLocations: () => [],
            stampLocationAdvancement: (prev) => prev || {},
            normalizeWorldReportMetadata: () => ({ reportId: '', selectedLocations: [] }),
            sendStateRequest: (_a, _b, _c, signal) => new Promise((resolve, reject) => {
                const onAbort = () => {
                    const err = new Error('aborted');
                    err.name = 'AbortError';
                    reject(err);
                };
                if (signal?.aborted) return onAbort();
                signal?.addEventListener('abort', onAbort, { once: true });
                gate.promise.then(resolve, reject);
            }),
            applyAction: apply,
            persistWorldProgressionTimer: persist,
            WORLD_REPORT_METADATA_KEY: 'rpgWorldReport',
            getRequestHeaders: () => ({}),
            fetch: async () => ({ ok: true, json: async () => ({}) }),
            getLivePrefix() { return 'CampaignA'; },
        });
        const { run, stop } = installWorldProgression(context);
        const pending = run('Day 1 00:00', 24 * 60);
        for (let i = 0; i < 20; i++) await Promise.resolve();
        stop();
        const result = await pending;
        expect(result).toEqual({ ok: false, error: 'chat_changed' });
        expect(apply).not.toHaveBeenCalled();
        expect(persist).not.toHaveBeenCalled();
    });
});
