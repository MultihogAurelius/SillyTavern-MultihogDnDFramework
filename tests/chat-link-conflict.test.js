import { describe, expect, it, vi } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { parseAst } from 'rollup/parseAst';
import * as affinity from '../src/state/pass-affinity.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { archiveDisplacedChatLinkMemo, repairChatLinkMemoHistory } from '../src/features/chat/chat-link-conflict.js';
import { getSettings } from '../src/state/settings.js';
import { MODULE_NAME } from '../src/state/schema-sections.js';
import { testExtensionSettings } from './setup.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(path.join(root, '..', 'index.js'), 'utf8');

describe('archiveDisplacedChatLinkMemo', () => {
    it('moves the LIVE pointer with its memo when inserting before it', () => {
        const target = { currentMemo: 'live', memoHistory: ['live', 'older'], historyIndex: 0 };
        archiveDisplacedChatLinkMemo(target, 'displaced');
        expect(target.historyIndex).toBe(1);
        expect(target.memoHistory[target.historyIndex]).toBe(target.currentMemo);
    });

    it('keeps later LIVE map captures on the moved LIVE slot after conflict archive', async () => {
        const { recordLiveDungeonMapSnapshot } = await import('../src/state/dungeon-map-history.js');
        const target = {
            currentMemo: 'live',
            memoHistory: ['live'],
            dungeonMapHistory: [{ bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'before' }] }],
            historyIndex: 0,
        };
        archiveDisplacedChatLinkMemo(target, 'displaced');
        expect(target.historyIndex).toBe(1);
        const explored = { bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'after explore' }] };
        recordLiveDungeonMapSnapshot(target, explored);
        expect(target.dungeonMapHistory[0]).toBeNull();
        expect(target.dungeonMapHistory[1]).toEqual(explored);
    });

    it('preserves the LIVE pair when conflict insertion exceeds retention', () => {
        const liveMap = { maps: ['live map'] };
        const target = { currentMemo: 'live', memoHistory: ['newer', 'live'], dungeonMapHistory: [null, liveMap], historyIndex: 1 };
        archiveDisplacedChatLinkMemo(target, 'displaced', { max: 2 });
        expect(target.historyIndex).toBe(1);
        expect(target.memoHistory).toEqual(['displaced', 'live']);
        expect(target.dungeonMapHistory).toEqual([null, liveMap]);
        expect(target.currentMemo).toBe('live');
    });
    it('archives a string memo and keeps dungeonMapHistory paired', () => {
        const target = {
            memoHistory: ['older'],
            dungeonMapHistory: [{ maps: [{ uid: '1' }] }],
        };
        expect(archiveDisplacedChatLinkMemo(target, '[TIME]\nDay 2\n[/TIME]')).toBe(true);
        expect(target.memoHistory).toEqual(['[TIME]\nDay 2\n[/TIME]', 'older']);
        expect(target.dungeonMapHistory).toEqual([null, { maps: [{ uid: '1' }] }]);
        expect(typeof target.memoHistory[0]).toBe('string');
    });

    it('refuses object stones that would poison Linear Stone History', () => {
        const target = { memoHistory: [], dungeonMapHistory: [] };
        expect(archiveDisplacedChatLinkMemo(target, {
            memo: '[TIME]\nDay 2\n[/TIME]',
            delta: 'x',
            timestamp: 1,
            label: 'Global Edit (Pre-Link)',
        })).toBe(false);
        expect(target.memoHistory).toEqual([]);
        expect(target.dungeonMapHistory).toEqual([]);
    });

    it('caps history length at 50 by default', () => {
        const target = {
            memoHistory: Array.from({ length: 50 }, (_, i) => `m${i}`),
            dungeonMapHistory: Array.from({ length: 50 }, () => null),
        };
        archiveDisplacedChatLinkMemo(target, 'newest');
        expect(target.memoHistory).toHaveLength(50);
        expect(target.memoHistory[0]).toBe('newest');
        expect(target.dungeonMapHistory).toHaveLength(50);
    });
});

describe('legacy Chat Link history repair', () => {
    const stone = memo => ({ memo, delta: 'delta', timestamp: 1, label: 'Global Edit (Pre-Link)' });

    it('unwraps old RESTORE stones, repairs map alignment, and preserves the LIVE memo', () => {
        const maps = [{ maps: ['live map'] }, { maps: ['old map'] }, null];
        const target = { currentMemo: 'live', memoHistory: [stone('displaced'), 'live', 'old'], dungeonMapHistory: maps, historyIndex: 0 };
        expect(repairChatLinkMemoHistory(target)).toBe(true);
        expect(target.memoHistory).toEqual(['displaced', 'live', 'old']);
        expect(target.dungeonMapHistory).toEqual([null, maps[0], maps[1]]);
        expect(target.historyIndex).toBe(1);
        expect(repairChatLinkMemoHistory(target)).toBe(false);
    });

    it('recovers a legacy object already committed as LIVE', () => {
        const target = { currentMemo: stone('recoverable text'), memoHistory: [stone('recoverable text'), 'old'], historyIndex: 0 };
        repairChatLinkMemoHistory(target);
        expect(target.currentMemo).toBe('recoverable text');
        expect(target.historyIndex).toBe(0);
        expect(target.dungeonMapHistory).toEqual([null, null]);
    });

    it('repairs saved partitions and profiles on settings load', () => {
        testExtensionSettings[MODULE_NAME] = {
            currentMemo: stone('live text'),
            chatStates: { A: { memoHistory: [stone('saved text')] } },
            profiles: { legacy: { currentMemo: stone('profile text') } },
        };
        const settings = getSettings();
        expect(settings.currentMemo).toBe('live text');
        expect(settings.chatStates.A.memoHistory).toEqual(['saved text']);
        expect(settings.profiles.legacy.currentMemo).toBe('profile text');
        delete testExtensionSettings[MODULE_NAME];
    });

    it('leaves unrecognized history records untouched', () => {
        const target = { memoHistory: [{ memo: 'foreign record' }] };
        expect(repairChatLinkMemoHistory(target)).toBe(false);
        expect(target.memoHistory).toEqual([{ memo: 'foreign record' }]);
    });
});

describe('Chat Link conflict completion', () => {
    it.each([1, 0].flatMap(choice => [false, true].map(switched => ({ choice, switched }))))
    ('retains data and ownership (choice=$choice, switched=$switched)', async ({ choice, switched }) => {
        let finish;
        const popup = new Promise(resolve => { finish = resolve; });
        const settings = { currentMemo: 'live', memoHistory: ['live'], historyIndex: 0, activeRouterKeys: [],
            chatStates: { A: { currentMemo: 'saved', memoHistory: ['saved'], historyIndex: 0 } } };
        const runtime = { currentChatId: 'A' };
        const save = vi.fn(), load = vi.fn(() => Object.assign(settings, settings.chatStates.A));
        const ctx = createContext({
            ...affinity, archiveDisplacedChatLinkMemo, getSettings: () => settings, getActiveChatId: () => runtime.currentChatId,
            runtimeState: runtime, saveChatState: save, loadChatState: load, saveSettings: vi.fn(), updateChatLinkUI() {},
            SillyTavern: { getContext: () => ({ Popup: { show: { confirm: () => popup } }, POPUP_RESULT: { AFFIRMATIVE: 1, NEGATIVE: 0 } }) },
            toastr: { success() {}, info() {} },
        });
        const node = parseAst(indexSource).body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'applyChatLinkToggle');
        runInContext(indexSource.slice(node.start, node.end), ctx);
        const pending = ctx.applyChatLinkToggle(true);
        if (switched) {
            affinity.invalidateChatCommitGuards();
            affinity.invalidateChatCommitGuards();
            settings.currentMemo = 'arriving text';
        }
        const before = JSON.stringify(settings);
        finish(choice);
        expect(await pending).toBe(!switched);
        if (switched) {
            expect(JSON.stringify(settings)).toBe(before);
            expect(save).not.toHaveBeenCalled();
            expect(load).not.toHaveBeenCalled();
        } else {
            expect(settings.currentMemo).toBe(choice === 1 ? 'saved' : 'live');
            expect(settings.memoHistory).toEqual(choice === 1 ? ['live', 'saved'] : ['saved', 'live']);
            expect(settings.historyIndex).toBe(1);
            expect(settings.dungeonMapHistory).toEqual([null, null]);
        }
    });
});

describe('Chat Link conflict wiring', () => {
    it('uses archiveDisplacedChatLinkMemo for RESTORE and OVERWRITE', () => {
        const toggleStart = indexSource.indexOf('async function applyChatLinkToggle');
        const toggleEnd = indexSource.indexOf('function updatePanelStatus', toggleStart);
        const slice = indexSource.slice(toggleStart, toggleEnd);
        expect(slice).toContain('archiveDisplacedChatLinkMemo(saved, s.currentMemo)');
        expect(slice).toContain('archiveDisplacedChatLinkMemo(s, saved.currentMemo)');
        expect(slice).not.toContain("label: 'Global Edit (Pre-Link)'");
        expect(slice).not.toMatch(/memoHistory\.unshift\(\s*\{/);
    });
});
