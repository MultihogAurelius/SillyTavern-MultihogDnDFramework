import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testExtensionSettings } from './setup.js';

let activeChatId = 'alpha';

beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
    activeChatId = 'alpha';
    globalThis.SillyTavern.getContext = () => ({
        extensionSettings: testExtensionSettings,
        chatId: activeChatId,
        getCurrentChatId: () => activeChatId,
        saveSettingsDebounced: () => {},
    });
});

describe('Adventure Companion chat partitions', () => {
    it('starts an unseen chat with empty history while keeping global lookback prefs', async () => {
        localStorage.setItem('rpg_tracker_chat_prefs_v1', JSON.stringify({
            tutorialMode: false,
            injectLore: false,
            injectMemo: false,
            companion: { lookback: 5, lookbackAll: true, history: [] },
        }));

        const { runtimeState } = await import('../src/app/runtime-state.js');
        const companion = await import('../adventure-companion.js');

        runtimeState.currentChatId = 'alpha';
        companion.applyAdventureCompanionSnapshot({
            lookback: 99,
            lookbackAll: false,
            history: [{ role: 'user', content: 'Alpha-only conversation' }],
        });

        // Chat-linked snaps must not clobber the global All toggle.
        expect(companion.getAdventureCompanionSnapshot()).toEqual({
            lookback: 5,
            lookbackAll: true,
            history: [{ role: 'user', content: 'Alpha-only conversation' }],
        });

        activeChatId = 'beta';
        runtimeState.currentChatId = 'beta';
        companion.loadAdventureCompanionForChat('beta');

        expect(companion.getAdventureCompanionSnapshot()).toEqual({
            lookback: 5,
            lookbackAll: true,
            history: [],
        });
    });

    it('defaults lookbackAll to false for a fresh install', async () => {
        const companion = await import('../adventure-companion.js');
        expect(companion.getAdventureCompanionSnapshot()).toEqual({
            lookback: 5,
            lookbackAll: false,
            history: [],
        });
    });

    it('keeps lookbackAll=true across reload even when a chat-linked snap omits it', async () => {
        localStorage.setItem('rpg_tracker_chat_prefs_v1', JSON.stringify({
            tutorialMode: false,
            injectLore: false,
            injectMemo: false,
            companion: { lookback: 5, lookbackAll: true, history: [] },
        }));
        localStorage.setItem('rpg_tracker_companion_by_chat_v1', JSON.stringify({
            alpha: { lookback: 5, lookbackAll: true, history: [{ role: 'user', content: 'hi' }] },
        }));

        const { runtimeState } = await import('../src/app/runtime-state.js');
        runtimeState.currentChatId = 'alpha';
        testExtensionSettings.rpg_tracker = {
            chatLinkEnabled: true,
            chatStates: {
                alpha: {
                    currentMemo: '',
                    // Stale / incomplete snap — missing lookbackAll used to force All off.
                    adventureCompanion: { lookback: 5, history: [{ role: 'user', content: 'hi' }] },
                },
            },
        };

        const companion = await import('../adventure-companion.js');
        expect(companion.getAdventureCompanionSnapshot().lookbackAll).toBe(true);
        expect(companion.getAdventureCompanionSnapshot().history).toEqual([
            { role: 'user', content: 'hi' },
        ]);

        companion.applyAdventureCompanionSnapshot({ lookback: 5, history: [{ role: 'user', content: 'hi' }] });
        expect(companion.getAdventureCompanionSnapshot().lookbackAll).toBe(true);
    });

    it('migrates the selected legacy help conversation into Tutorial Mode', async () => {
        localStorage.setItem('rpg_tracker_chat_prefs_v1', JSON.stringify({
            mode: 'tutorial',
            tutorial: {
                lookback: 7,
                lookbackAll: false,
                history: [{ role: 'user', content: 'How does RNG work?' }],
            },
            companion: {
                lookback: 5,
                lookbackAll: true,
                history: [],
            },
        }));

        const companion = await import('../adventure-companion.js');

        expect(companion.isTutorialModeEnabled()).toBe(true);
        expect(companion.getAdventureCompanionSnapshot()).toEqual({
            lookback: 7,
            lookbackAll: false,
            history: [{ role: 'user', content: 'How does RNG work?' }],
        });
    });
});

describe('Adventure Companion settings', () => {
    it('maps its dedicated connection without inheriting the State Tracker connection', async () => {
        const companion = await import('../adventure-companion.js');
        const requestSettings = companion.getAdventureCompanionRequestSettings({
            connectionSource: 'profile',
            connectionProfileId: 'state-profile',
            completionPresetId: 'state-preset',
            ollamaUrl: 'http://state-ollama',
            openaiModel: 'state-model',
            adventureCompanionConnectionSource: 'openai',
            adventureCompanionConnectionProfileId: 'companion-profile',
            adventureCompanionCompletionPresetId: 'companion-preset',
            adventureCompanionOllamaUrl: 'http://companion-ollama',
            adventureCompanionOllamaModel: 'companion-ollama-model',
            adventureCompanionOpenaiUrl: 'https://companion.example/v1',
            adventureCompanionOpenaiKey: 'companion-key',
            adventureCompanionOpenaiModel: 'companion-model',
            adventureCompanionMaxTokens: 1234,
        });

        expect(requestSettings).toMatchObject({
            connectionSource: 'openai',
            connectionProfileId: 'companion-profile',
            completionPresetId: 'companion-preset',
            ollamaUrl: 'http://companion-ollama',
            ollamaModel: 'companion-ollama-model',
            openaiUrl: 'https://companion.example/v1',
            openaiKey: 'companion-key',
            openaiModel: 'companion-model',
            maxTokens: 1234,
        });
    });

    it('persists settings-drawer changes to the same preferences used by CHAT', async () => {
        const companion = await import('../adventure-companion.js');
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: async () => '# Multihog',
        });
        try {
            companion.updateAdventureCompanionPreferences({
                tutorialMode: true,
                injectLore: true,
                injectMemo: true,
                injectMap: true,
                lookback: 17,
                lookbackAll: true,
            });

            expect(companion.getAdventureCompanionPreferences()).toEqual({
                tutorialMode: true,
                injectLore: true,
                injectMemo: true,
                injectMap: true,
                lookback: 17,
                lookbackAll: true,
            });
            expect(JSON.parse(localStorage.getItem('rpg_tracker_chat_prefs_v1'))).toMatchObject({
                tutorialMode: true,
                injectLore: true,
                injectMemo: true,
                injectMap: true,
                companion: { lookback: 17, lookbackAll: true },
            });
        } finally {
            fetchSpy.mockRestore();
        }
    });

    it('wires current site map injection into CHAT and settings', async () => {
        const { readFileSync } = await import('node:fs');
        const source = readFileSync(new URL('../adventure-companion.js', import.meta.url), 'utf8');
        expect(source).toContain("id=\"rt-chat-inject-map\"");
        expect(source).toContain('Inject current site map');
        expect(source).toContain('formatDungeonMapForPlayer');
        expect(source).toContain('stripDungeonMapSection');
        expect(source).toContain("await import('./router.js')");
        expect(source).toContain('loadActiveDungeonMapContext');
        expect(source).toContain('--- ACTIVE SITE MAP ---');
        expect(source).toContain("bindCheckbox('rpg_adventure_companion_inject_map', 'injectMap')");
    });

    it('aborts in-flight companion work on chat switch and pins action affinity', async () => {
        const { readFileSync } = await import('node:fs');
        const companionSource = readFileSync(new URL('../adventure-companion.js', import.meta.url), 'utf8');
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

        expect(companionSource).toContain("import { canCommitPassForChat } from './src/state/pass-affinity.js';");
        expect(companionSource).toContain('export function abortAdventureCompanionInFlight()');
        expect(companionSource).toContain('abortAdventureCompanionInFlight()');
        expect(companionSource).toContain('globalThis._rpgAbortAdventureCompanionInFlight = abortAdventureCompanionInFlight');
        expect(companionSource).toContain('await executeCompanionAction(nativeAction, passChatId)');
        expect(companionSource).toContain("status: 'chat_changed'");
        expect(companionSource).toContain('Active chat changed; Adventure Companion action was skipped.');

        const handlerStart = indexSource.indexOf('function onChatChanged(newChatId)');
        expect(handlerStart).toBeGreaterThanOrEqual(0);
        const handlerSlice = indexSource.slice(handlerStart, handlerStart + 4500);
        expect(handlerSlice).toContain('_rpgAbortAdventureCompanionInFlight');
        expect(handlerSlice.indexOf('_rpgAbortAdventureCompanionInFlight'))
            .toBeLessThan(handlerSlice.indexOf('_rpgFlushAdventureCompanionForChat'));
    });

    it('aborts an in-flight companion controller when switching chats', async () => {
        const { runtimeState } = await import('../src/app/runtime-state.js');
        const companion = await import('../adventure-companion.js');
        runtimeState.currentChatId = 'alpha';

        expect(typeof globalThis._rpgAbortAdventureCompanionInFlight).toBe('function');
        expect(() => companion.abortAdventureCompanionInFlight()).not.toThrow();
        expect(() => companion.onChatChangedForAdventureCompanion('alpha', 'beta')).not.toThrow();
        expect(() => globalThis._rpgAbortAdventureCompanionInFlight()).not.toThrow();
    });
});
