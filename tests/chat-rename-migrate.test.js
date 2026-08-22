import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSettings, saveChatState } from '../state-manager.js';
import { runtimeState } from '../src/app/runtime-state.js';
import {
    onChatRenamedMigrate,
    partitionHasCampaignSubstance,
    partitionLooksEmpty,
    stripChatFileExtension,
} from '../src/features/chat/chat-rename-migrate.js';
import {
    COMPANION_BY_CHAT_KEY,
    MEMO_RECOVERY_KEY,
    moveLocalChatMapEntry,
} from '../src/features/chat/local-chat-map.js';
import { testExtensionSettings } from './setup.js';

function readLocalMap(key) {
    return JSON.parse(localStorage.getItem(key) || '{}');
}

function markRenameReset() {
    runtimeState.pendingUnseenChatReset = {
        oldId: 'Old Chat',
        newId: 'Renamed Chat',
        preexistingLocalMapKeys: [],
    };
}

describe('chat rename migration helpers', () => {
    beforeEach(() => {
        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
        localStorage.clear();
    });

    it('strips .jsonl from ST rename filenames', () => {
        expect(stripChatFileExtension('My Chat.jsonl')).toBe('My Chat');
        expect(stripChatFileExtension('plain')).toBe('plain');
    });

    it('records the exact unseen-chat reset in the CHAT_CHANGED path', () => {
        const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        const handlerStart = source.indexOf('function onChatChanged(newChatId) {');
        const handlerEnd = source.indexOf('function updateChatLinkUI()', handlerStart);
        const handler = source.slice(handlerStart, handlerEnd);
        const resetCall = handler.indexOf('resetUnseenChatState(s);');
        const localProbe = handler.indexOf('localChatMapHasEntry(key, resolvedId)');
        const markerWrite = handler.indexOf('runtimeState.pendingUnseenChatReset = {');

        expect(handlerStart).toBeGreaterThan(-1);
        expect(handlerEnd).toBeGreaterThan(handlerStart);
        expect(resetCall).toBeGreaterThan(-1);
        expect(localProbe).toBeGreaterThan(-1);
        expect(localProbe).toBeLessThan(resetCall);
        expect(markerWrite).toBeGreaterThan(resetCall);
    });

    it('treats a full setup-only save shell as empty campaign state', () => {
        const setupOnly = {
            currentMemo: '',
            combatDefeatedUi: [],
            memoPersistedAt: Date.now(),
            memoPersistedBy: 'browser-id',
            quests: [],
            memoHistory: [],
            campaignBooks: [],
            customPortraits: {},
            customLocationImages: {},
            activeRouterKeys: [],
            activeWorldKeys: [],
            keywordActivatedKeys: [],
            routerLog: [],
            routerCampaignPrefix: 'Renamed_Chat',
            historyIndex: -1,
            worldProgressionLastFiredAtMinutes: -1,
            adventureCompanion: { lookback: 5, lookbackAll: false, history: [] },
            setup: {
                version: 3,
                syspromptModules: { loot: true },
                customFieldStates: {},
            },
        };
        expect(partitionLooksEmpty(setupOnly)).toBe(true);
        expect(partitionHasCampaignSubstance(setupOnly)).toBe(false);
    });

    it('recognizes the current saveChatState output for an unseen chat as a shell', () => {
        const s = getSettings();
        s.currentMemo = '';
        s.combatDefeatedUi = [];
        s.memoHistory = [];
        s.lastDelta = '';
        s.quests = [];
        s.activeRouterKeys = [];
        s.activeWorldKeys = [];
        s.keywordActivatedKeys = [];
        s.routerLog = [];
        s.customPortraits = {};
        s.customLocationImages = {};
        s.worldProgressionLastFiredAtMinutes = -1;
        s.worldProgressionLastFiredPeriodLabel = '';
        s.worldProgressionSkeletonAtmosphereSummary = '';
        s.chatSetupLinkEnabled = true;

        saveChatState('Unseen Chat', { skipDiskWrite: true });

        expect(partitionLooksEmpty(s.chatStates['Unseen Chat'])).toBe(true);
    });

    it.each([
        ['memo', { currentMemo: '[CHARACTER]Hero[/CHARACTER]' }],
        ['player character', { playerCharacter: {} }],
        ['quest', { quests: [{ id: 'q1' }] }],
        ['portrait', { customPortraits: { Hero: 'hero.png' } }],
        ['location image', { customLocationImages: { Camp: 'camp.png' } }],
        ['dungeon reality', { dungeonReality: { sites: { crypt: { mapChunks: ['Area: Gate'] } } } }],
        ['companion history', { adventureCompanion: { lookback: 5, history: [{ role: 'user', content: 'Plan' }] } }],
        ['relationship values', { npcRelationshipValues: { 'Eldoria_NPCs::1': { friendship: 12, affection: 4 } } }],
        ['relationship log', { npcRelationshipLog: { 'Eldoria_NPCs::1': [{ field: 'friendship', delta: 2 }] } }],
        ['world progression timer', { worldProgressionLastFiredAtMinutes: 60 }],
        ['world progression location rotation', { worldProgressionLocationLastAdvanced: { morrowfen: 'Day 2, 08:00' } }],
        ['map report application', { mapEvolutionWorldReportApplications: { morrowfen: { 'World::1': { status: 'considered' } } } }],
        ['map evolution backlog', { mapEvolutionBacklogBySite: { morrowfen: [{ kind: 'quiet', elapsedMinutes: 15 }] } }],
        ['map evolution threads', { mapEvolutionThreadsBySite: { morrowfen: [{ id: 'kill:0', cause: 'Killed by the party.', actor: 'party' }] } }],
        ['future schema field', { futureCampaignPayload: {} }],
    ])('treats %s data as campaign substance', (_label, partition) => {
        expect(partitionHasCampaignSubstance(partition)).toBe(true);
        expect(partitionLooksEmpty(partition)).toBe(false);
    });

    it('never deletes either browser-local entry on collision', () => {
        localStorage.setItem(COMPANION_BY_CHAT_KEY, JSON.stringify({
            'Old Chat': { history: [{ content: 'old' }] },
            'Renamed Chat': { history: [{ content: 'new' }] },
        }));

        expect(moveLocalChatMapEntry(COMPANION_BY_CHAT_KEY, 'Old Chat', 'Renamed Chat')).toBe('collision');
        expect(readLocalMap(COMPANION_BY_CHAT_KEY)).toEqual({
            'Old Chat': { history: [{ content: 'old' }] },
            'Renamed Chat': { history: [{ content: 'new' }] },
        });
    });
});

describe('onChatRenamedMigrate', () => {
    beforeEach(() => {
        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
        localStorage.clear();
        runtimeState.currentChatId = null;
        runtimeState.pendingUnseenChatReset = null;
        runtimeState.loreRedoStack = [];
        globalThis.toastr = { warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn() };
        const base = SillyTavern.getContext();
        SillyTavern.getContext = () => ({
            ...base,
            chatId: 'Renamed Chat',
            getCurrentChatId: () => 'Renamed Chat',
        });
    });

    it('pins the prior lorebook prefix so rename does not split the campaign stack', async () => {
        const s = getSettings();
        s.chatStates = {
            'Old Chat': {
                currentMemo: 'alive',
                campaignBooks: ['Old_Chat_NPCs', 'Old_Chat_Locations'],
                routerCampaignPrefix: 'Old_Chat',
                activeRouterKeys: ['Old_Chat_NPCs::0'],
                playerCharacter: { name: 'Ada' },
            },
        };
        runtimeState.currentChatId = 'Old Chat';

        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState: vi.fn(() => true) },
        );

        expect(s.routerCampaignPrefixOverride).toBe('Old_Chat');
        expect(s.routerCampaignPrefixOverrideAnchorChatId).toBe('Renamed Chat');
        expect(s.routerCampaignPrefix).toBe('Old_Chat');
        expect(s.chatStates['Renamed Chat']?.campaignBooks).toEqual([
            'Old_Chat_NPCs',
            'Old_Chat_Locations',
        ]);
    });

    it('moves a partition and browser-local state when the destination is unused', async () => {
        const s = getSettings();
        s.chatStates = {
            'Old Chat': { currentMemo: 'alive', playerCharacter: { name: 'Ada' } },
        };
        s.routerHistory = [
            { chatId: 'Other Chat', campaignPrefix: 'Other' },
            { chatId: 'Old Chat', campaignPrefix: 'Old_Chat' },
        ];
        runtimeState.loreRedoStack = [{
            prePassSnapshot: { chatId: 'Old Chat', campaignPrefix: 'Old_Chat' },
            postPassState: { chatId: 'Old Chat', campaignPrefix: 'Old_Chat' },
        }];
        localStorage.setItem(COMPANION_BY_CHAT_KEY, JSON.stringify({
            'Old Chat': { history: [{ content: 'old plan' }] },
        }));
        localStorage.setItem(MEMO_RECOVERY_KEY, JSON.stringify({
            'Old Chat': { currentMemo: 'alive' },
        }));
        runtimeState.currentChatId = 'Old Chat';

        const loadChatState = vi.fn(() => true);
        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState },
        );

        expect(s.chatStates['Renamed Chat']?.currentMemo).toBe('alive');
        expect(s.chatStates['Old Chat']).toBeUndefined();
        expect(readLocalMap(COMPANION_BY_CHAT_KEY)['Renamed Chat']?.history).toHaveLength(1);
        expect(readLocalMap(COMPANION_BY_CHAT_KEY)['Old Chat']).toBeUndefined();
        expect(readLocalMap(MEMO_RECOVERY_KEY)['Renamed Chat']?.currentMemo).toBe('alive');
        expect(loadChatState).toHaveBeenCalledWith('Renamed Chat');
        expect(runtimeState.currentChatId).toBe('Renamed Chat');
        expect(s.routerHistory.map(entry => entry.chatId)).toEqual(['Other Chat', 'Renamed Chat']);
        expect(runtimeState.loreRedoStack[0].prePassSnapshot.chatId).toBe('Renamed Chat');
        expect(runtimeState.loreRedoStack[0].postPassState.chatId).toBe('Renamed Chat');
    });

    it('replaces the exact setup-only shell marked by CHAT_CHANGED', async () => {
        const s = getSettings();
        s.chatStates = {
            'Old Chat': {
                currentMemo: '[CHARACTER]Keeper[/CHARACTER]',
                quests: [{ id: 'quest-a', title: 'Escort' }],
                campaignBooks: ['Old_Chat', 'Old_Chat_Events'],
                playerCharacter: { name: 'Keeper' },
            },
            'Renamed Chat': {
                currentMemo: '',
                quests: [],
                campaignBooks: [],
                customPortraits: {},
                customLocationImages: {},
                routerCampaignPrefix: 'Renamed_Chat',
                setup: { version: 3, syspromptModules: { loot: true } },
            },
        };
        runtimeState.currentChatId = 'Renamed Chat';
        markRenameReset();

        const loadChatState = vi.fn(() => true);
        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState },
        );

        expect(s.chatStates['Renamed Chat']?.currentMemo).toBe('[CHARACTER]Keeper[/CHARACTER]');
        expect(s.chatStates['Renamed Chat']?.playerCharacter?.name).toBe('Keeper');
        expect(s.chatStates['Old Chat']).toBeUndefined();
        expect(loadChatState).toHaveBeenCalledWith('Renamed Chat');
        expect(globalThis.toastr.warning).not.toHaveBeenCalled();
        expect(runtimeState.pendingUnseenChatReset).toBeNull();
    });

    it('replaces browser-local shells seeded after the marked rename reset', async () => {
        const s = getSettings();
        s.chatStates = {
            'Old Chat': { currentMemo: 'old campaign' },
            'Renamed Chat': { currentMemo: '', routerLastRunAt: 1787331050916 },
        };
        localStorage.setItem(COMPANION_BY_CHAT_KEY, JSON.stringify({
            'Old Chat': { history: [{ content: 'old plan' }] },
            'Renamed Chat': { history: [] },
        }));
        localStorage.setItem(MEMO_RECOVERY_KEY, JSON.stringify({
            'Old Chat': { currentMemo: 'old campaign', ts: 1 },
            'Renamed Chat': { currentMemo: '', ts: 2 },
        }));
        markRenameReset();

        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState: vi.fn(() => true) },
        );

        expect(readLocalMap(COMPANION_BY_CHAT_KEY)).toEqual({
            'Renamed Chat': { history: [{ content: 'old plan' }] },
        });
        expect(readLocalMap(MEMO_RECOVERY_KEY)).toEqual({
            'Renamed Chat': { currentMemo: 'old campaign', ts: 1 },
        });
        expect(globalThis.toastr.warning).not.toHaveBeenCalled();
    });

    it('preserves browser-local destination data that existed before the rename reset', async () => {
        const s = getSettings();
        s.chatStates = {
            'Old Chat': { currentMemo: 'old campaign' },
            'Renamed Chat': { currentMemo: '' },
        };
        localStorage.setItem(COMPANION_BY_CHAT_KEY, JSON.stringify({
            'Old Chat': { history: [{ content: 'old plan' }] },
            'Renamed Chat': { history: [{ content: 'pre-existing plan' }] },
        }));
        markRenameReset();
        runtimeState.pendingUnseenChatReset.preexistingLocalMapKeys = [COMPANION_BY_CHAT_KEY];

        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState: vi.fn(() => true) },
        );

        expect(readLocalMap(COMPANION_BY_CHAT_KEY)['Old Chat'].history[0].content).toBe('old plan');
        expect(readLocalMap(COMPANION_BY_CHAT_KEY)['Renamed Chat'].history[0].content).toBe('pre-existing plan');
        expect(globalThis.toastr.warning).toHaveBeenCalledOnce();
    });

    it('moves portrait-only campaign state over a marked setup shell', async () => {
        const s = getSettings();
        s.chatStates = {
            'Old Chat': { customPortraits: { Keeper: 'keeper.png' } },
            'Renamed Chat': { setup: { version: 3 }, customPortraits: {} },
        };
        markRenameReset();

        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState: vi.fn() },
        );

        expect(s.chatStates['Renamed Chat'].customPortraits).toEqual({ Keeper: 'keeper.png' });
        expect(s.chatStates['Old Chat']).toBeUndefined();
    });

    it('replaces a marked rename shell even when it inherited substantive run metadata', async () => {
        const s = getSettings();
        s.chatStates = {
            'Old Chat': { currentMemo: 'old campaign', quests: [{ id: 'old' }] },
            'Renamed Chat': {
                currentMemo: '',
                routerLastRunAt: 1787331050916,
                mapUpdaterLastRunAt: 1787331050916,
                setup: { version: 3 },
            },
        };
        markRenameReset();

        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState: vi.fn() },
        );

        expect(s.chatStates['Renamed Chat'].currentMemo).toBe('old campaign');
        expect(s.chatStates['Renamed Chat'].quests).toEqual([{ id: 'old' }]);
        expect(s.chatStates['Old Chat']).toBeUndefined();
        expect(globalThis.toastr.warning).not.toHaveBeenCalled();
    });

    it('moves setup-only chat status over its exact marked rename shell', async () => {
        const s = getSettings();
        s.chatStates = {
            'Old Chat': { setup: { version: 3, narrativePacing: 'high_agency' } },
            'Renamed Chat': {
                setup: { version: 3, narrativePacing: 'normal' },
                routerLastRunAt: 1787331050916,
            },
        };
        markRenameReset();

        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState: vi.fn(() => true) },
        );

        expect(s.chatStates['Renamed Chat'].setup.narrativePacing).toBe('high_agency');
        expect(s.chatStates['Old Chat']).toBeUndefined();
        expect(globalThis.toastr.warning).not.toHaveBeenCalled();
    });

    it('preserves an unmarked setup-only destination because the collision is ambiguous', async () => {
        const s = getSettings();
        const destination = { setup: { version: 3, narrativePacing: 'custom' } };
        s.chatStates = {
            'Old Chat': { currentMemo: 'old campaign' },
            'Renamed Chat': destination,
        };

        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState: vi.fn() },
        );

        expect(s.chatStates['Renamed Chat']).toBe(destination);
        expect(s.chatStates['Old Chat'].currentMemo).toBe('old campaign');
    });

    it('leaves browser-local entries untouched when chat partitions collide', async () => {
        const s = getSettings();
        s.chatStates = {
            'Old Chat': { currentMemo: 'old campaign' },
            'Renamed Chat': { currentMemo: 'destination campaign' },
        };
        localStorage.setItem(COMPANION_BY_CHAT_KEY, JSON.stringify({
            'Old Chat': { history: [{ content: 'old' }] },
        }));

        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState: vi.fn() },
        );

        expect(readLocalMap(COMPANION_BY_CHAT_KEY)['Old Chat']?.history).toHaveLength(1);
        expect(readLocalMap(COMPANION_BY_CHAT_KEY)['Renamed Chat']).toBeUndefined();
    });

    it('preserves both browser-local entries when only their keys collide', async () => {
        const s = getSettings();
        s.chatStates = { 'Old Chat': { currentMemo: 'old campaign' } };
        localStorage.setItem(COMPANION_BY_CHAT_KEY, JSON.stringify({
            'Old Chat': { history: [{ content: 'old' }] },
            'Renamed Chat': { history: [{ content: 'new' }] },
        }));

        await onChatRenamedMigrate(
            { oldFileName: 'Old Chat.jsonl', newFileName: 'Renamed Chat.jsonl' },
            { saveSettings: vi.fn(), loadChatState: vi.fn() },
        );

        expect(readLocalMap(COMPANION_BY_CHAT_KEY)['Old Chat']?.history[0].content).toBe('old');
        expect(readLocalMap(COMPANION_BY_CHAT_KEY)['Renamed Chat']?.history[0].content).toBe('new');
        expect(globalThis.toastr.warning).toHaveBeenCalled();
    });
});
