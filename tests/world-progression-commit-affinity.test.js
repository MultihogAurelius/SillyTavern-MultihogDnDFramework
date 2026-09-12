import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

describe('World Progression action commit ownership', () => {
    it.each(['load', 'save', 'cache', 'registry', 'activate', 'unchanged'])('guards the %s phase of a WORLD record commit', async phase => {
        let ownsChat = true;
        const gate = deferred(), entered = deferred();
        const book = { entries: {} };
        const settings = { activeRouterKeys: [], activeWorldKeys: [], routerLog: [] };
        const wait = (at, value) => {
            if (phase !== at) return Promise.resolve(value);
            entered.resolve();
            return gate.promise.then(() => value);
        };
        const load = vi.fn(() => wait('load', book));
        const save = vi.fn(() => wait('save', { ok: true }));
        const cache = vi.fn(() => wait('cache'));
        const activate = vi.fn(() => wait('activate'));
        const persist = vi.fn();
        const context = createContext({
            getSettings: () => settings,
            SillyTavern: { getContext: () => ({ loadWorldInfo: load, saveWorldInfo: cache,
                updateWorldInfoList: () => wait('registry'), executeSlashCommandsWithOptions: activate }) },
            getLinkedPlayerCharacter: () => null, getLivePrefix: () => 'A',
            buildRouterCategoryMap: () => ({ NPC: 'NPCs' }), resolveRecordCategoryTag: () => ({ tag: 'WORLD' }),
            isSkeletonBookName: () => false, isSkeletonEntryId: () => false,
            getRequestHeaders: () => ({}), fetch: save, saveSettings: persist,
            document: { dispatchEvent() {} }, CustomEvent: class {}, _rpgCurrentChatId: () => ownsChat ? 'A' : 'B',
        });
        const start = source.indexOf('async function applyAction(');
        runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
        const pending = context.applyAction({ record: [{ category: 'WORLD', label: 'Day 1', content: 'Quiet streets.' }] }, {}, '', '', false, { canCommit: () => ownsChat });
        if (phase !== 'unchanged') {
            await entered.promise;
            ownsChat = false;
            settings.activeWorldKeys = ['B_World::1'];
            gate.resolve();
        }
        const result = await pending;
        if (phase === 'unchanged') {
            expect(result.success).toBe(true);
            expect(settings.activeWorldKeys).toEqual(['A_World::0']);
            expect(persist).toHaveBeenCalled();
        } else {
            expect(result.status).toBe('chat_changed');
            expect(settings.activeWorldKeys).toEqual(['B_World::1']);
            expect(settings.routerLog).toEqual([]);
            expect(settings.chatStates?.B).toBeUndefined();
            expect(persist).not.toHaveBeenCalled();
            if (phase === 'load') expect(save).not.toHaveBeenCalled();
            if (phase === 'load' || phase === 'save') expect(cache).not.toHaveBeenCalled();
            if (phase === 'registry') expect(activate).not.toHaveBeenCalled();
        }
    });
});
