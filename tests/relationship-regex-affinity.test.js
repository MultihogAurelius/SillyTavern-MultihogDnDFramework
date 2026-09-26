import * as chatAffinity from '../src/state/pass-affinity.js';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { canCommitPassForChat } from '../src/state/pass-affinity.js';
import { HISTORY_ENTRY_LIMIT } from '../src/state/history-retention.js';

const source = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
// Run the production handlers with deferred host I/O, without booting SillyTavern.
function install(context, name) {
    const match = source.match(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));
    if (!match) throw new Error(`Missing function ${name}`);
    runInContext(source.slice(match.index, source.indexOf('\n}', match.index) + 2).replace(/^export /, ''), context);
    return context[name];
}
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function harness() {
    const runtime = { currentChatId: 'A' };
    const settings = { npcRelationshipBars: true, npcRelationshipToast: false, npcRelationshipValues: {}, npcRelationshipLog: {} };
    const msg = { mes: '(Friendship: Alice +5)', swipe_id: 0 };
    const persist = vi.fn();
    const rollback = vi.fn();
    const resolveName = vi.fn().mockResolvedValue('A_NPCs::1');
    const context = createContext({
        ...chatAffinity,
        console: { log() {}, warn() {}, error() {} }, runtimeState: runtime, getActiveChatId: () => runtime.currentChatId, getSettings: () => settings,
        SillyTavern: { getContext: () => ({ chat: [msg] }) }, _rpgIsGenerating: false,
        getRelationshipUpdateMode: () => 'regex', RELATIONSHIP_UPDATE_MODES: { REGEX: 'regex' },
        canCommitPassForChat, HISTORY_ENTRY_LIMIT, cleanMessageContent: message => message.mes,
        getNpcRelationshipMax: () => 100, clampRelationshipValue: (value, max) => Math.max(-max, Math.min(max, value)),
        fuzzyResolveNpcName: resolveName, persistRelationshipCommandChanges: persist,
        maybeRollbackAgentsForSwipe: rollback,
    });
    install(context, 'applyRelationshipSwipeRollback');
    install(context, 'applyNarrativeRelationshipRegex');
    const run = install(context, 'handleRelationshipSwipeChange');
    return { context, runtime, settings, msg, persist, rollback, resolveName, run };
}

describe('regex relationship chat ownership', () => {
    it('applies and persists a tag once in its owning chat', async () => {
        const h = harness();
        await h.run();
        await h.run();
        expect(h.settings.npcRelationshipValues['A_NPCs::1'].friendship).toBe(5);
        expect(h.persist).toHaveBeenCalledTimes(1);
        expect(h.persist.mock.calls[0][2]).toBe('A');
    });

    it('does not apply deltas or start rollback after switching during NPC resolution', async () => {
        const h = harness(); const gate = deferred();
        h.resolveName.mockReturnValue(gate.promise);
        const pending = h.run();
        h.runtime.currentChatId = 'B';
        h.settings.npcRelationshipValues = { 'B_NPCs::1': { friendship: 20, affection: 10 } };
        gate.resolve('A_NPCs::1');
        await pending;
        expect(h.settings.npcRelationshipValues).toEqual({ 'B_NPCs::1': { friendship: 20, affection: 10 } });
        expect(h.settings.npcRelationshipLog).toEqual({});
        expect(h.msg.extra.rpgProcessedTags[0]).toEqual([]);
        expect(h.persist).not.toHaveBeenCalled();
        expect(h.rollback).not.toHaveBeenCalled();
    });

    it.each([true, false])('stops the rollback chain after a map await (rolled=%s)', async rolled => {
        const h = harness(); const gate = deferred();
        const prime = vi.fn(), evolution = vi.fn(), router = vi.fn();
        Object.assign(h.context, { maybeRollbackMapUpdaterForSwipe: () => gate.promise,
            setMapUpdaterAutoTick: prime, maybeRollbackMapEvolutionForSwipe: evolution, maybeRollbackRouterPassForSwipe: router });
        const run = install(h.context, 'maybeRollbackAgentsForSwipe');
        const pending = run(h.msg);
        h.runtime.currentChatId = 'B'; gate.resolve(rolled); await pending;
        expect(prime).not.toHaveBeenCalled();
        expect(evolution).not.toHaveBeenCalled();
        expect(router).not.toHaveBeenCalled();
    });

    it('stops before router rollback if the chat changes during evolution rollback', async () => {
        const h = harness(); const gate = deferred(); const entered = deferred(); const router = vi.fn();
        Object.assign(h.context, { maybeRollbackMapUpdaterForSwipe: async () => false,
            maybeRollbackMapEvolutionForSwipe: () => { entered.resolve(); return gate.promise; }, maybeRollbackRouterPassForSwipe: router });
        const run = install(h.context, 'maybeRollbackAgentsForSwipe');
        const pending = run(h.msg); await entered.promise;
        h.runtime.currentChatId = 'B'; gate.resolve(); await pending;
        expect(router).not.toHaveBeenCalled();
    });

    it('does not prime the arriving router after a late rollback result', async () => {
        const h = harness(); const gate = deferred(); const prime = vi.fn();
        h.msg.extra = { rpgRouterRanForSwipe: 1, rpgRouterRunId: 'run-A' };
        h.settings.routerHistory = [{ runId: 'run-A' }];
        Object.assign(h.context, { isRouterRunning: () => false, rollbackRouterPass: () => gate.promise,
            recordSchedulerEvent() {}, clearRouterSwipeMarkers: vi.fn(), setRouterAutoTick: prime });
        const run = install(h.context, 'maybeRollbackRouterPassForSwipe');
        const pending = run(h.msg); h.runtime.currentChatId = 'B'; gate.resolve(true); await pending;
        expect(prime).not.toHaveBeenCalled();
        expect(h.context.clearRouterSwipeMarkers).not.toHaveBeenCalled();
    });
});
