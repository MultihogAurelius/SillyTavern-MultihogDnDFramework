import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { HISTORY_ENTRY_LIMIT } from '../src/state/history-retention.js';
import { describe, expect, it, vi } from 'vitest';
import { parseAst } from 'rollup/parseAst';
import * as affinity from '../src/state/pass-affinity.js';
import { normalizeWorldReportMetadata, WORLD_REPORT_METADATA_KEY } from '../world-progression-lib.js';

const sources = Object.fromEntries(['router', 'map-updater', 'map-evolution', 'map-architect', 'narrative-hooks']
    .map(name => [name, readFileSync(new URL(`../${name}.js`, import.meta.url), 'utf8')]));
sources.terminal = readFileSync(new URL('../src/ui/panel/agent-terminal-direct.js', import.meta.url), 'utf8');
sources.branch = readFileSync(new URL('../src/features/chat/branch-campaign.js', import.meta.url), 'utf8');
sources.index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const indexAst = parseAst(sources.index);
function installClick(context, selector) {
    let handler;
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression' && node.callee.property?.name === 'on'
            && node.callee.object?.arguments?.[0]?.value === selector) handler = node.arguments.at(-1);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        }
    }
    visit(indexAst);
    if (!handler) throw new Error(`Missing click handler ${selector}`);
    runInContext(`globalThis.runClick = ${sources.index.slice(handler.start, handler.end)};`, context);
}
function install(context, file, ...names) {
    for (const name of names) {
        const source = sources[file];
        const node = parseAst(source).body.map(n => n.declaration || n).find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
        if (!node) throw new Error(`Missing ${file}:${name}`);
        runInContext(source.slice(node.start, node.end), context);
    }
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function harness(phase) {
    let chatId = 'A';
    const gate = deferred(), entered = deferred();
    const settings = { routerLog: [], activeRouterKeys: [], dungeonMapHistory: [], currentMemo: 'A memo', chatStates: { A: {} } };
    const wait = async (at, result) => {
        if (at === phase) { entered.resolve(); await gate.promise; }
        return result;
    };
    const save = vi.fn(async (name, data) => wait('save', { name, data }));
    const history = vi.fn((s, snapshot) => { s.dungeonMapHistory = [snapshot]; });
    const persist = vi.fn();
    const book = { entries: { 0: { uid: 0, comment: 'Keep', content: '[MAP] map [/MAP]', extensions: {} } } };
    const ctx = { chatId: 'A', chat: [{ mes: 'A story' }], generateRaw() {},
        loadWorldInfo: () => wait('load', book), saveWorldInfo: save,
        reloadWorldInfoEditor: vi.fn(), updateWorldInfoList: () => wait('registry'),
    };
    const context = createContext({
        ...affinity, HISTORY_ENTRY_LIMIT, AbortController, console: { log() {}, warn() {}, error() {}, info() {} },
        getActiveChatId: () => chatId, getLivePrefix: () => chatId,
        getSettings: () => settings, SillyTavern: { getContext: () => ctx },
        toastr: { info() {}, warning() {}, success() {}, error() {} },
        document: { dispatchEvent: vi.fn() }, CustomEvent: class {}, saveSettings: persist,
        getWorldInfoNamesSafe: () => wait('names', ['A_Chronicle']),
        sendStateRequest: () => wait('llm', JSON.stringify({ id: 'scene', desc: 'A scene', keys: ['Keep'], content: 'A event' })),
        cleanMessageContent: m => m.mes,
        rememberCampaignBook: vi.fn(),
        isWorldInfoBookKnown: () => wait('known', true),
        loadWorldInfoFresh: () => wait('load', book),
        saveWorldInfoSnapshot: save,
        collectDungeonMapCandidates: () => ({ maps: [], errors: [] }),
        migrateDungeonMapAttachmentToContent: () => true,
        getDungeonMapAttachment: () => ({ siteRoot: 'Keep', content: 'map' }),
        reconcileDungeonMapAreaKnowledge: () => false,
        buildDungeonSitesFromLocationEntries: () => ({ Keep: {} }),
        collectDungeonMapHistorySnapshot: () => ({ bookName: 'A_Locations', maps: ['A map'] }),
        recordLiveDungeonMapSnapshot: history,
        normalizeDungeonLabel: s => s,
        findLatestDungeonLocation: () => 'Keep',
        resolveActiveDungeonContext: () => ({ uid: 0, entryId: 'A_Locations::0', siteRoot: 'Keep' }),
        extractDungeonMapSection: () => 'map',
        parseDungeonMapDocument: () => ({ document: { site: 'Keep', areas: [] } }),
        applyDungeonMapTransaction: () => ({ ok: true, operationId: 'op', document: { areas: [] }, chronicles: [] }),
        replaceDungeonMapSection: () => 'new map', serializeDungeonMapDocument: () => 'new map',
        mapTransactionSignature: () => 'sig', DUNGEON_MAP_OPERATION_IDS_KEY: 'ops',
        getRequestHeaders: () => ({}),
        fetch: vi.fn(() => wait('save', { ok: true })),
        updateWorldInfoCache: vi.fn(() => wait('cache', false)),
    });
    return { context, settings, save, history, persist, gate, entered, book, ctx, wait,
        switchChat(roundtrip = false) {
            chatId = 'B'; affinity.invalidateChatCommitGuards();
            if (roundtrip) { chatId = 'A'; affinity.invalidateChatCommitGuards(); }
            settings.routerLog = [{ reason: 'arriving log' }];
            settings.activeRouterKeys = ['arriving key'];
            settings.dungeonMapHistory = ['arriving map'];
            settings.currentMemo = 'arriving memo';
            return JSON.stringify(settings);
        },
    };
}

describe('chat operation lifetime', () => {
    it('suppresses only ownership cancellation at UI boundaries', async () => {
        const cancelled = affinity.ignoreChatCancellation(async () => affinity.assertChatCommit(() => false));
        await expect(cancelled()).resolves.toBeUndefined();
        const failure = new Error('I/O failed');
        await expect(affinity.ignoreChatCancellation(async () => { throw failure; })()).rejects.toBe(failure);
        const handler = affinity.ignoreChatCancellation(async function (value) { return this.prefix + value; });
        await expect(handler.call({ prefix: 'A' }, ' value')).resolves.toBe('A value');
    });
    it('composes cancellation and caller ownership and never revives after A → B → A', () => {
        let chat = 'A', parent = true;
        const controller = new AbortController();
        const guard = affinity.createChatCommitGuard('A', () => chat, { signal: controller.signal, canCommit: () => parent });
        expect(guard()).toBe(true);
        parent = false; expect(guard()).toBe(false); parent = true;
        chat = 'B'; affinity.invalidateChatCommitGuards();
        chat = 'A'; affinity.invalidateChatCommitGuards();
        expect(guard()).toBe(false);
        const next = affinity.createChatCommitGuard('A', () => chat, { signal: controller.signal });
        expect(next()).toBe(true); controller.abort(); expect(next()).toBe(false);
    });

    it('checks in the caller continuation before an awaited value can mutate live state', async () => {
        const guard = affinity.createChatCommitGuard('A', () => 'A');
        const result = deferred();
        let value = 'original';
        const operation = (async () => { value = affinity.chatCommitResult(guard, await result.promise); })();
        affinity.invalidateChatCommitGuards();
        result.resolve('stale');
        await expect(operation).rejects.toMatchObject({ name: 'AbortError' });
        expect(value).toBe('original');
    });
});

describe('/la save through the real entry writer', () => {
    it.each(['llm', 'names', 'load', 'save'].flatMap(phase => [false, true].map(roundtrip => ({ phase, roundtrip }))))
    ('stops during $phase (roundtrip=$roundtrip)', async ({ phase, roundtrip }) => {
        const h = harness(phase);
        install(h.context, 'router', 'addLorebookEntry', 'saveSceneToLorebook');
        const pending = h.context.saveSceneToLorebook();
        await h.entered.promise;
        const arriving = h.switchChat(roundtrip);
        h.gate.resolve(); await pending;
        expect(JSON.stringify(h.settings)).toBe(arriving);
        expect(h.persist).not.toHaveBeenCalled();
        expect(h.ctx.reloadWorldInfoEditor).not.toHaveBeenCalled();
        expect(h.save).toHaveBeenCalledTimes(phase === 'save' ? 1 : 0);
        if (phase === 'save') expect(h.save.mock.calls[0][0]).toBe('A_Chronicle');
    });

    it('saves and activates a campaign-scoped archive when ownership is retained', async () => {
        const h = harness();
        install(h.context, 'router', 'addLorebookEntry', 'saveSceneToLorebook');
        await h.context.saveSceneToLorebook();
        expect(h.save.mock.calls[0][0]).toBe('A_Chronicle');
        expect(h.settings.activeRouterKeys).toEqual(['A_Chronicle::1']);
        expect(h.context.rememberCampaignBook).toHaveBeenCalledWith('A_Chronicle', h.settings);
        expect(h.persist).toHaveBeenCalled();
    });
});

describe('map persistence boundaries', () => {
    it.each(['known', 'load', 'save'].flatMap(phase => [false, true].map(roundtrip => ({ phase, roundtrip }))))
    ('capture stops during $phase (roundtrip=$roundtrip)', async ({ phase, roundtrip }) => {
        const h = harness(phase);
        install(h.context, 'router', 'syncDungeonMapsToLocationLorebook');
        const pending = h.context.syncDungeonMapsToLocationLorebook(h.ctx.chat);
        const settled = pending.catch(error => error);
        await h.entered.promise;
        const arriving = h.switchChat(roundtrip); h.gate.resolve();
        expect(await settled).toMatchObject({ name: 'AbortError' });
        expect(JSON.stringify(h.settings)).toBe(arriving);
        expect(h.history).not.toHaveBeenCalled();
        expect(h.save).toHaveBeenCalledTimes(phase === 'save' ? 1 : 0);
    });

    it.each(['load', 'save'])('transactions cannot commit live history after switching during %s', async phase => {
        const h = harness(phase);
        install(h.context, 'router', 'applyDungeonMapCommit');
        const books = {};
        const pending = h.context.applyDungeonMapCommit({ operation_id: 'op' }, { bookName: 'A_Locations', prefix: 'A', entryId: 'A_Locations::0' }, books, 'Day 1').catch(e => e);
        await h.entered.promise;
        const arriving = h.switchChat(); h.gate.resolve();
        expect(await pending).toMatchObject({ name: 'AbortError' });
        expect(books).toEqual({});
        expect(JSON.stringify(h.settings)).toBe(arriving);
        expect(h.history).not.toHaveBeenCalled();
    });

    it('does not enter the fallback save after cache refresh loses ownership', async () => {
        const h = harness('cache');
        install(h.context, 'router', 'saveWorldInfoSnapshot');
        const pending = h.context.saveWorldInfoSnapshot('A_Locations', h.book, h.ctx, 'test').catch(e => e);
        await h.entered.promise; h.switchChat(); h.gate.resolve();
        expect(await pending).toMatchObject({ name: 'AbortError' });
        expect(h.save).not.toHaveBeenCalled();
    });

    it('normal map capture still records the live history', async () => {
        const h = harness();
        install(h.context, 'router', 'syncDungeonMapsToLocationLorebook');
        const result = await h.context.syncDungeonMapsToLocationLorebook(h.ctx.chat);
        expect(result.changed).toBe(true);
        expect(result.ownsChat).toBe(true);
        expect(h.history).toHaveBeenCalledTimes(1);
    });
});

describe('Map Updater lifecycle', () => {
    function updater(phase) {
        const h = harness(phase);
        const loaded = { context: { siteRoot: 'Keep', document: { kind: 'DUNGEON' } }, books: {}, currentLocation: 'Keep' };
        Object.assign(h.context, {
            isLocationMappingEnabled: () => true, isRouterRunning: () => false, isMapEvolutionRunning: () => false,
            loadActiveDungeonMapContext: () => h.wait('load', loaded),
            snapshotCampaignLocationsBook: () => h.wait('snapshot', {}),
            normalizeMapSiteKind: x => x, recentStoryContext: () => 'A story', currentTimeFrom: () => 'Day 1',
            selectMapUpdaterSystemPrompt: () => 'prompt', DEFAULT_MAP_UPDATER_SYSTEM_PROMPT: '',
            initialUserPrompt: () => 'A prompt', MAX_CORRECTION_ATTEMPTS: 0,
            requestSettings: x => x, broadcastStep() {},
            parseMapArchitectResponse: () => ({ value: { noop: true } }),
            rejectPartyMemberAssets: () => [], validatePartyMemberRemovalTransaction: () => [],
            isMapUpdaterNoop: () => true, validateBuildingPopulationTransaction: () => [],
            finishMapUpdater: vi.fn(),
        });
        runInContext('let _mapUpdaterRunning = false, _mapUpdaterStarting = false, _mapUpdaterController = null;', h.context);
        install(h.context, 'map-updater', 'runMapUpdaterPass', 'stopMapUpdaterPass', 'isMapUpdaterRunning');
        return h;
    }

    it.each(['load', 'snapshot', 'llm'])('stops after a round trip during %s', async phase => {
        const h = updater(phase);
        const pending = h.context.runMapUpdaterPass({ directInstruction: 'A instruction' });
        await h.entered.promise;
        const arriving = h.switchChat(true); h.gate.resolve();
        expect(await pending).toEqual({ skipped: 'chat_changed' });
        expect(JSON.stringify(h.settings)).toBe(arriving);
        expect(h.context.finishMapUpdater).not.toHaveBeenCalled();
    });

    it('cannot clear a replacement pass when the cancelled request settles late', async () => {
        const h = updater('llm');
        const first = h.context.runMapUpdaterPass({ directInstruction: 'old' });
        await h.entered.promise;
        h.context.stopMapUpdaterPass();
        const nextGate = deferred(), nextEntered = deferred();
        h.context.sendStateRequest = () => { nextEntered.resolve(); return nextGate.promise; };
        const second = h.context.runMapUpdaterPass({ directInstruction: 'new' });
        await nextEntered.promise;
        h.gate.resolve(); await first;
        expect(h.context.isMapUpdaterRunning()).toBe(true);
        nextGate.resolve('noop');
        expect(await second).toEqual({ ok: true, noop: true });
        expect(h.context.isMapUpdaterRunning()).toBe(false);
        expect(h.context.finishMapUpdater).toHaveBeenCalledTimes(1);
    });
});

describe('Map Evolution bookkeeping', () => {
    function evolution(phase) {
        const h = harness(phase), site = { siteRoot: 'Keep' };
        Object.assign(h.context, {
            hydrateWorldProgressionFromChatState() {}, isLocationMappingEnabled: () => true, isRouterRunning: () => false,
            loadAllMappedSiteContexts: () => h.wait('load', { sites: [site], books: {} }),
            activeSiteFrom: () => null, currentTimeFrom: () => 'Day 1', parseInWorldMinutes: () => 60,
            resolveSitesForPass: () => [site], snapshotCampaignLocationsBook: () => h.wait('snapshot', {}),
            loadRecentWorldReports: () => h.wait('reports', []), formatMapEvolutionRecentStory: () => '',
            pendingWorldReportsForSite: () => [],
            evolveOneSite: () => h.wait('evolve', { ok: true, noop: true, timeWindow: {} }),
            appendEvolutionBacklogEntry: () => ({ Keep: ['A event'] }),
            stampSiteFired: (s) => { s.mapEvolutionLastFiredBySite = { Keep: 'Day 1' }; },
            stampReportOutcomes() {}, maybeCompressSiteThreads: () => h.wait('compress'),
            persistMapEvolutionState: h.persist, runtimeState: {}, broadcastStep() {},
        });
        runInContext('let _mapEvolutionRunning = false, _mapEvolutionStarting = false, _mapEvolutionController = null;', h.context);
        install(h.context, 'map-evolution', 'runMapEvolutionPass', 'stopMapEvolutionPass');
        return h;
    }

    it.each(['load', 'snapshot', 'reports', 'evolve', 'compress'])('does not persist the arriving projection after %s', async phase => {
        const h = evolution(phase), pending = h.context.runMapEvolutionPass();
        await h.entered.promise;
        const arriving = h.switchChat(true); h.gate.resolve();
        expect(await pending).toEqual({ skipped: 'chat_changed' });
        expect(JSON.stringify(h.settings)).toBe(arriving);
        expect(h.persist).not.toHaveBeenCalled();
    });

    it('still persists already-completed site bookkeeping on same-chat cancellation', async () => {
        const h = evolution('compress'), pending = h.context.runMapEvolutionPass();
        await h.entered.promise; h.context.stopMapEvolutionPass(); h.gate.resolve();
        expect(await pending).toEqual({ skipped: 'stopped' });
        expect(h.settings.mapEvolutionLastFiredBySite).toEqual({ Keep: 'Day 1' });
        expect(h.persist).toHaveBeenCalledTimes(1);
    });

    it('feeds Map Evolution reports from the tracked campaign while the host chat id is stale', async () => {
        const h = evolution();
        h.context.getActiveChatId = () => 'B';
        h.context.getEffectiveRouterCampaignPrefix = id => `Campaign${id}`;
        h.context.WORLD_REPORT_METADATA_KEY = WORLD_REPORT_METADATA_KEY;
        h.context.normalizeWorldReportMetadata = normalizeWorldReportMetadata;
        h.ctx.loadWorldInfo = vi.fn(async book => ({ entries: { 0: {
            comment: 'Day 2', key: ['world report'],
            content: book === 'CampaignB_World' ? 'B pressure' : 'WRONG pressure',
        } } }));
        h.context.pendingWorldReportsForSite = reports => reports;
        h.context.evolveOneSite = vi.fn(async () => ({ ok: true, noop: true, timeWindow: {} }));
        install(h.context, 'map-evolution', 'loadRecentWorldReports');
        expect(await h.context.runMapEvolutionPass()).toMatchObject({ ok: true, noops: 1 });
        expect(h.ctx.chatId).toBe('A');
        expect(h.ctx.loadWorldInfo).toHaveBeenCalledExactlyOnceWith('CampaignB_World');
        expect(h.context.evolveOneSite).toHaveBeenCalledWith(expect.objectContaining({
            worldReports: [expect.objectContaining({ reportId: 'CampaignB_World::0', content: 'B pressure' })],
        }));
        expect(h.persist).toHaveBeenCalledTimes(1);
    });
});

describe('Map Architect continuation', () => {
    it('late toast cleanup cannot remove a replacement run for the same site', () => {
        const h = harness();
        const toasts = new Map(), first = {}, second = {};
        h.context.architectToasts = toasts;
        h.context.toastr.info = vi.fn().mockReturnValueOnce('first toast').mockReturnValueOnce('second toast');
        h.context.toastr.clear = vi.fn();
        h.context.toastr.error = vi.fn();
        install(h.context, 'map-architect', 'normalizeKey', 'siteToastLabel', 'startMapArchitectToast', 'finishMapArchitectToast');
        h.context.startMapArchitectToast('Keep', first);
        h.context.startMapArchitectToast('Keep', second);
        h.context.toastr.clear.mockClear();
        h.context.finishMapArchitectToast('Keep', false, first, false);
        expect(h.context.toastr.clear).not.toHaveBeenCalled();
        expect(h.context.toastr.error).not.toHaveBeenCalled();
        expect(toasts.get('keep').token).toBe(second);
    });
    it.each(['load', 'references', 'topology', 'placement', 'save'])('stops after switching during %s', async phase => {
        const h = harness(phase);
        let llmCount = 0;
        Object.assign(h.context, {
            normalizeMapSiteKind: x => x, normalizeMapSiteThreat: () => 'LOW', defaultMapSiteThreat: () => 'LOW', normalizeMapAttachment: () => null,
            broadcastStep() {}, isLocationMappingEnabled: () => true,
            syncDungeonMapsToLocationLorebook: () => h.wait('load', { sites: {}, errors: [] }),
            normalizeInclude: () => [], resolveIncludeManifest: () => [],
            resolveHostedCreationContext: () => null, findExistingArchitectSite: () => null,
            resolveLookback: () => 1, recentStoryContext: () => 'A story',
            buildMapArchitectReferenceContext: () => h.wait('references', 'A references'), currentTimeFrom: () => '',
            topologyUserPrompt: () => 'topology', requestSettings: x => x,
            sendStateRequest: vi.fn(() => h.wait(++llmCount === 1 ? 'topology' : 'placement', '{}')),
            DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT: '', MAP_ARCHITECT_TOPOLOGY_JSON_SCHEMA: {},
            DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT: '', MAP_ARCHITECT_ASSETS_JSON_SCHEMA: {}, MAX_CORRECTION_ATTEMPTS: 0,
            parseMapArchitectResponse: () => ({ value: { areas: [], assets: [] } }),
            canonicalizeReciprocalConnectionDetails() {}, envelopeErrors: () => [],
            validateDungeonMapArchitecture: () => ({ valid: true, document: { site: 'Keep', areas: [] } }),
            assetsUserPrompt: () => 'placement', lockedTopologyForPrompt: x => x, inclusionValidationErrors: () => [],
            persistArchitectDungeonMap: vi.fn(() => h.wait('save', { entryId: 'A_Locations::0', document: {} })),
            formatDungeonMapForNarrator: () => 'map',
        });
        install(h.context, 'map-architect', 'runMapArchitectOnce');
        const pending = h.context.runMapArchitectOnce({ site: 'Keep', entrance: 'Gate', prompt: 'A request', brief_description: 'Keep', kind: 'DUNGEON' }).catch(e => e);
        await h.entered.promise; const arriving = h.switchChat(true); h.gate.resolve();
        expect(await pending).toMatchObject({ name: 'AbortError' });
        expect(JSON.stringify(h.settings)).toBe(arriving);
        expect(h.context.persistArchitectDungeonMap).toHaveBeenCalledTimes(phase === 'save' ? 1 : 0);
        if (phase === 'topology') expect(h.context.sendStateRequest).toHaveBeenCalledTimes(1);
    });
});

describe('manual world generation and recovery', () => {
    it.each(['llm', 'save'])('skeleton generation stops during %s', async phase => {
        const h = harness(phase);
        Object.assign(h.context, { broadcastStep() {}, parseSkeletonOutput: () => [{ category: 'FAC', label: 'A faction', content: 'A description' }] });
        install(h.context, 'router', 'runSkeletonGenerationPass');
        const pending = h.context.runSkeletonGenerationPass('A world').catch(e => e);
        await h.entered.promise; const arriving = h.switchChat(true); h.gate.resolve();
        expect(await pending).toMatchObject({ name: 'AbortError' });
        expect(JSON.stringify(h.settings)).toBe(arriving);
        expect(h.save).not.toHaveBeenCalled();
        if (phase === 'llm') expect(h.context.fetch).not.toHaveBeenCalled();
    });

    it.each(['names', 'snapshot', 'save'])('rollback never recovers into a new chat after %s', async phase => {
        const h = harness(phase);
        h.settings.routerHistory = [{ chatId: 'A', campaignPrefix: 'A', bookSnapshots: { A_NPCs: { entries: {} } } }];
        Object.assign(h.context, {
            getRouterChatId: h.context.getActiveChatId, isLoreHistoryEntryForChat: () => true,
            getCreatedLorebookNames: () => [], captureRouterLoreState: () => h.wait('snapshot', {}),
            evictWorldInfoCache: async () => {}, restoreRouterLoreMetadata: vi.fn(), recoverRouterLoreState: vi.fn(),
        });
        install(h.context, 'router', 'rollbackRouterPass');
        const pending = h.context.rollbackRouterPass();
        await h.entered.promise; const arriving = h.switchChat(); h.gate.reject(new Error('I/O failed after switch'));
        expect(await pending).toBe(false);
        expect(JSON.stringify(h.settings)).toBe(arriving);
        expect(h.context.restoreRouterLoreMetadata).not.toHaveBeenCalled();
        expect(h.context.recoverRouterLoreState).not.toHaveBeenCalled();
    });
});

describe('persistent controls', () => {
    it.each(['confirm', 'busy', 'pass'])('stops the full audit queue after switching during %s', async phase => {
        const h = harness(phase);
        h.ctx.chat = [{ mes: 'A'.repeat(4500) }, { mes: 'B'.repeat(4500) }];
        h.ctx.contextSize = 4000;
        h.ctx.Popup = { show: { confirm: () => h.wait('confirm', true) } };
        Object.assign(h.context, {
            settings: h.settings, $: () => ({ prop() {} }), LOREBOOK_FULL_AUDIT_INSTRUCTION: 'audit',
            isRouterRunning: () => phase === 'busy',
            runRouterPass: vi.fn(() => h.wait('pass', true)),
            setTimeout: fn => { void h.wait('busy').then(fn); },
        });
        installClick(h.context, '#rt-agent-router-full-audit, #rt-agent-router-full-audit-panel');
        const pending = h.context.runClick();
        await h.entered.promise;
        h.switchChat(true); h.gate.resolve(); await pending;
        expect(h.context.runRouterPass).toHaveBeenCalledTimes(phase === 'pass' ? 1 : 0);
    });

    it('does not attach a late map-history snapshot to the arriving chat', async () => {
        const h = harness('snapshot');
        const runtime = { historyViewIndex: 1, liveDungeonMapBackup: null, dungeonMapHistoryOverlay: null };
        Object.assign(h.context, {
            runtimeState: runtime, captureActiveDungeonMapHistory: () => h.wait('snapshot', { bookName: 'A_Locations' }),
            getDungeonMapHistoryEntry: vi.fn(), restoreActiveDungeonMapHistory: vi.fn(),
        });
        install(h.context, 'index', 'applyDungeonMapForHistoryView');
        const pending = h.context.applyDungeonMapForHistoryView();
        await h.entered.promise;
        h.switchChat(); h.gate.resolve(); await pending;
        expect(runtime.liveDungeonMapBackup).toBeNull();
        expect(h.context.restoreActiveDungeonMapHistory).not.toHaveBeenCalled();
    });

    it('can run a new chat operation after switching without rewiring the panel', async () => {
        const h = harness(), done = deferred();
        const listeners = {};
        const button = { addEventListener: (event, fn) => { listeners[event] = fn; } };
        const input = { value: 'first instruction', style: {}, scrollHeight: 16, addEventListener() {} };
        const panel = { querySelector: selector => selector.startsWith('.rt-agent-terminal-direct-run') ? button : selector === '#rt-terminal-direct-state_tracker' ? input : null };
        const send = vi.fn(async () => { done.resolve(); });
        Object.assign(h.context, {
            AGENT_TERMINAL_TAB_IDS: ['state_tracker'], DRAFT_KEYS: { state_tracker: 'draft' }, LOOKBACK_KEYS: {},
            getComputedStyle: () => ({ lineHeight: '16' }),
        });
        install(h.context, 'terminal', 'parseLookback', 'wireAgentTerminalDirectPrompts');
        h.context.wireAgentTerminalDirectPrompts({ agentPanel: panel, getSettings: () => h.settings, saveSettings() {}, sendDirectPrompt: send });
        h.switchChat();
        input.value = 'B instruction';
        listeners.click({ stopPropagation() {} });
        await done.promise;
        expect(send).toHaveBeenCalledWith('B instruction');
    });
});

describe('Branch Campaign ownership', () => {
    it.each(['confirm', 'settings', 'clone', 'normal'])('handles %s without copying or navigating from an arriving chat', async phase => {
        const h = harness(phase);
        h.settings.chatLinkEnabled = true;
        h.settings.routerCampaignPrefix = 'A';
        Object.assign(h.ctx, {
            characterId: 1, Popup: { show: { confirm: () => h.wait('confirm', true) } },
            openCharacterChat: vi.fn(async () => { h.switchChat(); }),
        });
        Object.assign(h.context, {
            runtimeState: { currentChatId: 'A' }, escapeHtml: x => x, sanitizeCampaignPrefixString: x => x,
            snapshotPortraitMapsForChat: vi.fn(), saveChatState: vi.fn(),
            createBranch: vi.fn(async () => 'A-branch'), _pendingBranchSeeds: new Set(),
            cloneCampaignStackToPrefix: vi.fn(() => h.wait('clone', { matchingCount: 0 })),
            copyChatStatePartition: vi.fn((s, from, to) => { s.chatStates[to] = { ...s.chatStates[from] }; }),
            copyLocalChatMapEntry() {}, COMPANION_BY_CHAT_KEY: 'companion', MEMO_RECOVERY_KEY: 'memo',
            saveItemizedPrompts: vi.fn(), setTimeout() {},
        });
        install(h.context, 'branch', 'branchCampaignChat');
        const pending = h.context.branchCampaignChat({ saveSettings: () => h.wait('settings') });
        if (phase !== 'normal') {
            await h.entered.promise;
            h.switchChat(true);
            h.gate.resolve();
        }
        const result = await pending;
        if (phase === 'confirm' || phase === 'settings') {
            expect(result).toBeNull();
            expect(h.context.createBranch).not.toHaveBeenCalled();
            if (phase === 'confirm') expect(h.context.snapshotPortraitMapsForChat).not.toHaveBeenCalled();
        } else {
            expect(result).toBe('A-branch');
            expect(h.context.copyChatStatePartition).toHaveBeenCalledWith(h.settings, 'A', 'A-branch', 'A-branch', {});
        }
        expect(h.ctx.openCharacterChat).toHaveBeenCalledTimes(phase === 'normal' ? 1 : 0);
        expect(h.context.saveItemizedPrompts).toHaveBeenCalledTimes(phase === 'normal' ? 1 : 0);
    });
});
