import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { canCommitPassForChat } from '../src/state/pass-affinity.js';
import { mergeMemo, computeDelta } from '../memo-processor.js';
import * as history from '../src/state/dungeon-map-history.js';

const source = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
function harness() {
    let chatId = 'A';
    const settings = { currentMemo: '[TIME]\nDay 1\n[/TIME]', memoHistory: ['old'], dungeonMapHistory: [null], historyIndex: -1, chatLinkEnabled: true };
    const snapshot = vi.fn().mockResolvedValue({ map: 'A' });
    const questSync = vi.fn(x => x), saveChat = vi.fn();
    const context = createContext({
        ...history, getSettings: () => settings, getActiveChatId: () => chatId,
        canCommitPassForChat, mergeMemo, computeDelta,
        applyQuestSyncAndStripMemo: questSync, captureActiveDungeonMapHistory: snapshot,
        runtimeState: {}, document: { getElementById: () => null }, saveSettings() {}, saveChatState: saveChat,
    });
    const start = source.indexOf('        callback:', source.indexOf("name: 'set-state-memo'"));
    const end = source.indexOf('        helpString:', start);
    runInContext('globalThis.run = ' + source.slice(start, end).replace(/^\s*callback:\s*/, '').trim().replace(/,$/, ''), context);
    return { settings, snapshot, questSync, saveChat, run: context.run, switchChat: () => { chatId = 'B'; } };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

describe('state memo slash-command commits', () => {
    it('updates a block and records matching memo/map history', async () => {
        const h = harness();
        h.settings.currentMemo += '\n[CHARACTER]\nAlice\n[/CHARACTER]';
        const previous = h.settings.currentMemo;
        expect(await h.run({ block: 'TIME' }, 'Day 2')).toBe('State memo updated.');
        expect(h.settings.currentMemo).toContain('Day 2');
        expect(h.settings.currentMemo).toContain('Alice');
        expect(h.settings.memoHistory.slice(0, 2)).toEqual([h.settings.currentMemo, previous]);
        expect(h.settings.dungeonMapHistory).toHaveLength(h.settings.memoHistory.length);
        expect(h.saveChat).toHaveBeenCalledWith('A');
    });
    it.each(['chat', 'memo', 'history'])('does not commit after a concurrent %s change', async change => {
        const h = harness(), gate = deferred(); h.snapshot.mockReturnValue(gate.promise);
        const pending = h.run({}, '[TIME]\nDay 2\n[/TIME]');
        expect(h.questSync).not.toHaveBeenCalled();
        if (change === 'chat') h.switchChat();
        if (change === 'memo') h.settings.currentMemo = 'newer memo';
        if (change === 'history') h.settings.historyIndex = 0;
        const expected = structuredClone(h.settings);
        gate.resolve(null);
        expect(await pending).toContain('not updated');
        expect(h.settings).toEqual(expected);
        expect(h.questSync).not.toHaveBeenCalled();
        expect(h.saveChat).not.toHaveBeenCalled();
    });
    it('does not change state when map capture fails', async () => {
        const h = harness(), expected = structuredClone(h.settings);
        h.snapshot.mockRejectedValue(new Error('map unavailable'));
        await expect(h.run({}, 'replacement')).rejects.toThrow('map unavailable');
        expect(h.settings).toEqual(expected);
        expect(h.questSync).not.toHaveBeenCalled();
    });
});
