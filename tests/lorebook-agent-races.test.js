import * as chatAffinity from '../src/state/pass-affinity.js';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { canCommitPassForChat } from '../src/state/pass-affinity.js';
import { LOREBOOK_ROLLBACK_LIMIT } from '../src/state/history-retention.js';

const source = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
function functionSource(name, text = source) {
    const start = text.search(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));
    if (start < 0) throw new Error(`Missing ${name}`);
    return text.slice(start, text.indexOf('\n}', start) + 2).replace(/^export /, '');
}
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

// Run the production agent loop with controlled external I/O. The commit helper
// itself is covered by world-progression-commit-affinity.test.js.
function harness({ basic = true, pause = 'llm', cleanupEvery = 0 } = {}) {
    let chatId = 'A';
    const gate = deferred();
    const entered = deferred();
    const timers = new Map();
    let nextTimer = 0;
    const books = { A_NPCs: { entries: { 0: { content: 'Long chronicle', comment: 'Ada' } } } };
    const settings = { routerBasicMode: basic, activeRouterKeys: [], routerHistory: [],
        routerCleanupEvery: cleanupEvery, pcCharacterBlockSeeded: true, npcCoreSections: [{ name: 'Body' }] };
    const chat = [{ is_user: false, mes: 'A narrative.' }];
    const wait = async (phase, value) => {
        if (phase === pause) { entered.resolve(); await gate.promise; }
        return value;
    };
    const apply = vi.fn(async (_action, _books, _time, _location, _manual, options) => {
        await wait('commit');
        return options.canCommit()
            ? { success: true, errors: [], recordedIds: [] }
            : { status: 'chat_changed' };
    });
    const watermark = vi.fn();
    const timestamp = vi.fn();
    const persist = vi.fn();
    const llm = vi.fn(() => wait('llm', basic ? 'A response' : {
        toolCall: { name: 'commit', args: { activate: ['A_NPCs::0'] }, id: 'tool1' },
    }));
    const noop = () => {};
    const empty = () => '';
    const action = () => ({ record: [], update: [], activate: ['A_NPCs::0'], deactivate: [],
        rewrite: [{ id: 'A_NPCs::0', content: 'Short chronicle' }], consolidate: [] });
    const context = createContext({
        ...chatAffinity,
        AbortController, console, canCommitPassForChat, LOREBOOK_ROLLBACK_LIMIT, LORE_EXISTENCE_RULE: '',
        getActiveChatId: () => chatId, getLivePrefix: () => chatId,
        getSettings: () => settings, isLocationMappingEnabled: () => false,
        isLorebookAgentRuntimeActive: () => true,
        SillyTavern: { getContext: () => ({ chatId, chat, generateRaw: noop }) },
        broadcastStep: noop, stripSkeletonFromRouterPools: () => false,
        fetchRouterArchiveBooks: () => wait('archive', books),
        buildRouterLoreState: () => ({ bookSnapshots: {}, chatId, campaignPrefix: chatId, routerLastRunChatLength: 0 }),
        getRouterChatId: () => chatId, recordSchedulerEvent: noop, saveSettings: persist,
        getWorldInfoNamesSafe: () => wait('history', ['A_NPCs']),
        getLorebookSnapshotNames: () => [], bookBelongsToPrefix: (name, prefix) => name.startsWith(`${prefix}_`),
        isSkeletonBookName: () => false, buildKeyringText: empty,
        formatAgentChatLogFromIndex: empty, extractFooterLocation: empty, findLatestDungeonLocation: empty,
        extractCurrentTimeStr: empty, computeUnpinnedActiveCount: () => 0,
        extractActiveCombatBlock: empty, extractPartyBlock: empty,
        resolveCombatProfileGuidance: empty, getEnabledRouterCategoryTags: () => [],
        adjustPromptTimestamps: text => text, getEligibleCoreFieldNames: () => [],
        resolveAutoPassRestriction: empty, resolveExistingNpcNudge: empty,
        expandLorebookPromptTemplate: text => text, stripStaticDungeonAgentGuidance: text => text,
        formatMappedSiteAgentNote: empty, formatArchiveIndexSection: empty, formatCurrentLocationSection: empty,
        sendStateRequest: llm, sendAgentTurn: llm, parseBasicTags: action, applyAction: apply,
        persistRouterLastRunWatermark: watermark, persistRouterLastRunTimestamp: timestamp,
        document: { dispatchEvent: noop }, CustomEvent: class {},
        estimateTokens: () => 400, stripDungeonMapSection: text => text,
        countRedundantPairs: () => 0,
        setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
        clearTimeout: id => timers.delete(id),
    });
    runInContext(`let _routerRunning = false, _routerController = null, _routerCleanupTimer = null, _routerNormalRunCount = 0;
        ${functionSource('stopRouterPass')}
        ${functionSource('finalizeRouterHistorySnapshot')}
        ${functionSource('runRouterPass')}`, context);
    return { context, settings, apply, watermark, timestamp, persist, llm, timers, entered,
        switchChat: id => { chatId = id; }, release: gate.resolve };
}

describe('Lorebook Agent async ownership', () => {
    it.each([[true, false], [false, false], [true, true], [false, true]])('discards a late LLM response (basic=%s, cleanup=%s)', async (basic, cleanup) => {
        const h = harness({ basic });
        const pending = h.context.runRouterPass('Narrative', cleanup ? '__CLEANUP__' : null, null, cleanup);
        await h.entered.promise;
        h.switchChat('B');
        h.release();
        expect(await pending).toBe(false);
        expect(h.apply).not.toHaveBeenCalled();
        expect(h.watermark).not.toHaveBeenCalled();
        expect(h.timestamp).not.toHaveBeenCalled();
    });

    it.each(['archive', 'commit'])('stops after switching during %s', async pause => {
        const h = harness({ pause });
        const pending = h.context.runRouterPass('Narrative');
        await h.entered.promise;
        h.switchChat('B');
        h.release();
        expect(await pending).toBe(false);
        expect(h.watermark).not.toHaveBeenCalled();
        if (pause === 'archive') expect(h.settings.routerHistory).toEqual([]);
    });

    it('keeps a cancelled pass invalid when the user returns to its chat', async () => {
        const h = harness();
        const pending = h.context.runRouterPass('Narrative');
        await h.entered.promise;
        h.context.stopRouterPass();
        h.switchChat('B');
        h.switchChat('A');
        h.release();
        expect(await pending).toBe(false);
        expect(h.apply).not.toHaveBeenCalled();
    });

    it('does not finalize history after a switch during registry lookup', async () => {
        const h = harness({ pause: 'history' });
        const pending = h.context.runRouterPass('Narrative');
        await h.entered.promise;
        const snapshot = h.settings.routerHistory[0];
        h.persist.mockClear();
        h.switchChat('B');
        h.release();
        expect(await pending).toBe(false);
        expect(snapshot.createdBookNames).toBeUndefined();
        expect(h.persist).not.toHaveBeenCalled();
    });

    it.each(['same', 'switch', 'roundtrip'])('owns its scheduled cleanup (%s chat)', async change => {
        const h = harness({ pause: null, cleanupEvery: 1 });
        expect(await h.context.runRouterPass('Narrative')).toBe(true);
        expect(h.watermark).toHaveBeenCalledWith(1);
        expect(h.timers.size).toBe(1);
        if (change !== 'same') h.switchChat('B');
        if (change === 'roundtrip') {
            h.context.stopRouterPass();
            h.switchChat('A');
            expect(h.timers.size).toBe(0);
        }
        const run = vi.fn();
        h.context.runRouterPass = run;
        for (const callback of h.timers.values()) callback();
        if (change === 'same') expect(run).toHaveBeenCalledWith(null, '__CLEANUP__', null, true);
        else expect(run).not.toHaveBeenCalled();
    });

    it('does not save arriving-chat settings after awaiting portrait file cleanup', async () => {
        const portraitSource = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');
        let owns = true;
        const gate = deferred();
        const save = vi.fn();
        const context = createContext({
        ...chatAffinity,
            migratePortraitMapKey: () => ({ moved: true, displaced: 'old.png' }),
            getSettings: () => ({}), getActiveChatId: () => 'A', isManagedPortraitPath: () => true,
            countPortraitPathRefs: () => 0, deletePortraitFile: () => gate.promise, saveSettings: save,
        });
        runInContext(functionSource('renamePortraitEntity', portraitSource), context);
        const pending = context.renamePortraitEntity('Ada', 'Adele', { canCommit: () => owns });
        owns = false;
        gate.resolve();
        expect(await pending).toBe(false);
        expect(save).not.toHaveBeenCalled();
    });
});
