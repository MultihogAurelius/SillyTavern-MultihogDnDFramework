import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testExtensionSettings } from './setup.js';

vi.mock('../llm-client.js', () => ({
    sendAgentTurn: vi.fn(),
}));

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
});

afterEach(() => {
    delete globalThis.document;
    delete globalThis.Event;
    delete globalThis.HTMLButtonElement;
});

describe('Adventure Companion fallback actions', () => {
    it('treats natural requests and underspecified demos as action intent', async () => {
        const { COMPANION_PERSONA, COMPANION_ACTION_TOOLS } = await import('../adventure-companion.js');

        expect(COMPANION_PERSONA).toContain('Actions — these four ONLY (hard limit):');
        expect(COMPANION_PERSONA).toContain('Map Updater');
        expect(COMPANION_PERSONA).toContain('You have no other action surface.');
        expect(COMPANION_PERSONA).toContain('never invent a UI workflow');
        expect(COMPANION_PERSONA).toContain('They do not need exact wording, command syntax, magic phrases');
        expect(COMPANION_PERSONA).toContain('A request to demonstrate or test your action capability is authorization.');
        expect(COMPANION_PERSONA).toContain('choose one small, harmless, clearly labeled demo addition');
        expect(COMPANION_PERSONA).toContain('Brainstorming, theories, casual possibilities');
        expect(COMPANION_ACTION_TOOLS[0].function.description).toContain('ordinary conversational language');
        expect(COMPANION_ACTION_TOOLS[1].function.description).toContain('ordinary conversational language');
        expect(COMPANION_ACTION_TOOLS[2].function.name).toBe('command_map_updater');
        expect(COMPANION_ACTION_TOOLS[3].function.name).toBe('act_for_user');
        expect(COMPANION_ACTION_TOOLS).toHaveLength(4);
    });

    it('extracts Map Updater commands from fallback tags', async () => {
        const { parseCompanionFallbackActions } = await import('../adventure-companion.js');
        const parsed = parseCompanionFallbackActions(
            '<companion_action type="map_updater">REMOVE_ASSET the tipped chair clutter asset.</companion_action>',
        );
        expect(parsed.actions).toEqual([{
            name: 'command_map_updater',
            instruction: 'REMOVE_ASSET the tipped chair clutter asset.',
        }]);
    });

    it('extracts State Tracker and Lorebook Agent commands in order', async () => {
        const { parseCompanionFallbackActions } = await import('../adventure-companion.js');
        const parsed = parseCompanionFallbackActions(`
I can take care of both.
<companion_action type="state_tracker">Set the player's gold to 40.</companion_action>
<companion_action type='lorebook_agent'>Record the masked woman as an important NPC.</companion_action>
        `);

        expect(parsed.actions).toEqual([
            {
                name: 'command_state_tracker',
                instruction: "Set the player's gold to 40.",
            },
            {
                name: 'command_lorebook_agent',
                instruction: 'Record the masked woman as an important NPC.',
            },
        ]);
        expect(parsed.visibleText).toBe('I can take care of both.');
    });

    it('does not turn ordinary brainstorming into an action', async () => {
        const { parseCompanionFallbackActions } = await import('../adventure-companion.js');
        const parsed = parseCompanionFallbackActions('Maybe the masked woman is secretly royalty.');

        expect(parsed.actions).toEqual([]);
        expect(parsed.visibleText).toBe('Maybe the masked woman is secretly royalty.');
    });

    it('ignores empty action instructions', async () => {
        const { parseCompanionFallbackActions } = await import('../adventure-companion.js');
        const parsed = parseCompanionFallbackActions('<companion_action type="state_tracker">   </companion_action>');

        expect(parsed.actions).toEqual([]);
        expect(parsed.visibleText).toBe('');
    });

    it('parses fallback act-for-user actions', async () => {
        const { parseCompanionFallbackActions } = await import('../adventure-companion.js');
        const parsed = parseCompanionFallbackActions(
            '<companion_action type="act_for_user">{"choice_index":2}</companion_action>',
        );

        expect(parsed.actions).toEqual([{
            name: 'act_for_user',
            choice_index: 2,
            action_text: '',
        }]);
        expect(parsed.visibleText).toBe('');
    });

    it('executes a fallback State Tracker command before returning the final reply', async () => {
        const { sendAgentTurn } = await import('../llm-client.js');
        const { configureRuntimeActions } = await import('../src/app/runtime-bridge.js');
        const sendDirectPrompt = vi.fn().mockResolvedValue({
            success: true,
            status: 'changed',
            changed: true,
            message: 'State Tracker updated.',
        });
        configureRuntimeActions({
            sendDirectPrompt,
            runRouterPass: vi.fn(),
            isRouterRunning: vi.fn().mockReturnValue(false),
        });
        sendAgentTurn
            .mockResolvedValueOnce({
                content: '<companion_action type="state_tracker">Set gold to 40.</companion_action>',
                toolCall: null,
            })
            .mockResolvedValueOnce({
                content: 'Done — the State Tracker updated your gold.',
                toolCall: null,
            });
        const { runCompanionAgentLoop } = await import('../adventure-companion.js');

        const reply = await runCompanionAgentLoop([
            { role: 'system', content: 'Companion test' },
            { role: 'user', content: 'Set my gold to 40.' },
        ], new AbortController().signal);

        expect(sendDirectPrompt).toHaveBeenCalledWith('Set gold to 40.');
        expect(sendAgentTurn).toHaveBeenCalledTimes(2);
        const followUpMessages = sendAgentTurn.mock.calls[1][1];
        expect(followUpMessages.at(-1)).toMatchObject({
            role: 'user',
        });
        expect(followUpMessages.at(-1).content).toContain('EXTENSION ACTION RESULTS');
        expect(reply).toBe('Done — the State Tracker updated your gold.');
    });

    it('keeps a successful action receipt when follow-up summary generation fails', async () => {
        const { sendAgentTurn } = await import('../llm-client.js');
        const { configureRuntimeActions } = await import('../src/app/runtime-bridge.js');
        const sendDirectPrompt = vi.fn().mockResolvedValue({
            success: true,
            status: 'changed',
            changed: true,
            message: 'State Tracker updated.',
        });
        configureRuntimeActions({
            sendDirectPrompt,
            runRouterPass: vi.fn(),
            isRouterRunning: vi.fn().mockReturnValue(false),
        });
        sendAgentTurn
            .mockResolvedValueOnce({
                content: '<companion_action type="state_tracker">Add the shiny pebble.</companion_action>',
                toolCall: null,
            })
            .mockRejectedValueOnce(new Error('API request failed'));
        const { runCompanionAgentLoop } = await import('../adventure-companion.js');

        const reply = await runCompanionAgentLoop([
            { role: 'system', content: 'Companion test' },
            { role: 'user', content: 'Add the shiny pebble.' },
        ], new AbortController().signal);

        expect(sendDirectPrompt).toHaveBeenCalledWith('Add the shiny pebble.');
        expect(reply).toContain('✓ State Tracker: State Tracker updated.');
        expect(reply).toContain('The action result above is authoritative.');
        expect(reply).not.toContain('Check State Tracker connection settings');
    });

    it('can execute both native actions sequentially', async () => {
        testExtensionSettings['rpg_tracker'] = { routerEnabled: true };
        const { sendAgentTurn } = await import('../llm-client.js');
        const { configureRuntimeActions } = await import('../src/app/runtime-bridge.js');
        const sendDirectPrompt = vi.fn().mockResolvedValue({
            success: true,
            status: 'changed',
            changed: true,
            message: 'State Tracker updated.',
        });
        const runRouterPass = vi.fn().mockResolvedValue(true);
        configureRuntimeActions({
            sendDirectPrompt,
            runRouterPass,
            isRouterRunning: vi.fn().mockReturnValue(false),
        });
        sendAgentTurn
            .mockResolvedValueOnce({
                content: '',
                toolCall: {
                    name: 'command_state_tracker',
                    args: { instruction: 'Set gold to 40.' },
                    id: 'call-state',
                },
            })
            .mockResolvedValueOnce({
                content: '',
                toolCall: {
                    name: 'command_lorebook_agent',
                    args: { instruction: 'Record the masked woman.' },
                    id: 'call-lore',
                },
            })
            .mockResolvedValueOnce({
                content: 'Both updates completed.',
                toolCall: null,
            });
        const { runCompanionAgentLoop } = await import('../adventure-companion.js');

        const reply = await runCompanionAgentLoop([
            { role: 'system', content: 'Companion test' },
            { role: 'user', content: 'Make both updates.' },
        ], new AbortController().signal);

        expect(sendDirectPrompt).toHaveBeenCalledWith('Set gold to 40.');
        expect(runRouterPass).toHaveBeenCalledWith(null, 'Record the masked woman.', null, true);
        expect(sendAgentTurn).toHaveBeenCalledTimes(3);
        expect(reply).toBe('Both updates completed.');
    });

    it('executes a Map Updater command via fallback tags', async () => {
        testExtensionSettings['rpg_tracker'] = {
            locationMappingEnabled: true,
            mapUpdaterEnabled: true,
            mapUpdaterDirectLookback: 8,
        };
        const { sendAgentTurn } = await import('../llm-client.js');
        const { runtimeState } = await import('../src/app/runtime-state.js');
        const runMapUpdaterPass = vi.fn().mockResolvedValue({ ok: true });
        runtimeState.runMapUpdaterPassRef = runMapUpdaterPass;
        runtimeState.isLoreOrMapAgentBusyRef = () => false;
        const { configureRuntimeActions } = await import('../src/app/runtime-bridge.js');
        configureRuntimeActions({
            sendDirectPrompt: vi.fn(),
            runRouterPass: vi.fn(),
            isRouterRunning: vi.fn().mockReturnValue(false),
        });
        sendAgentTurn
            .mockResolvedValueOnce({
                content: '<companion_action type="map_updater">Remove asset diner-tipped-chair from the map.</companion_action>',
                toolCall: null,
            })
            .mockResolvedValueOnce({
                content: 'Removed the clutter asset from the map.',
                toolCall: null,
            });
        const { runCompanionAgentLoop } = await import('../adventure-companion.js');

        const reply = await runCompanionAgentLoop([
            { role: 'system', content: 'Companion test' },
            { role: 'user', content: 'Remove that mistaken chair asset from the map.' },
        ], new AbortController().signal);

        expect(runMapUpdaterPass).toHaveBeenCalledWith({
            isManual: true,
            lookback: 8,
            directInstruction: 'Remove asset diner-tipped-chair from the map.',
        });
        expect(reply).toBe('Removed the clutter asset from the map.');
    });

    it('submits a normal chat action and ends the Companion loop when CYOA is off', async () => {
        testExtensionSettings['rpg_tracker'] = {
            syspromptModules: { CYOA_mode: false },
        };
        const { sendAgentTurn } = await import('../llm-client.js');
        const inputEvents = [];
        const textarea = {
            value: '',
            dispatchEvent: vi.fn((event) => inputEvents.push(event.type)),
        };
        const sendButton = {
            disabled: false,
            click: vi.fn(),
        };
        globalThis.Event = class {
            constructor(type) {
                this.type = type;
            }
        };
        globalThis.document = {
            getElementById(id) {
                if (id === 'send_textarea') return textarea;
                if (id === 'send_but') return sendButton;
                return null;
            },
        };
        sendAgentTurn.mockResolvedValueOnce({
            content: '',
            toolCall: {
                name: 'act_for_user',
                args: {
                    action_text: 'I cautiously open the iron door.',
                    commentary: 'Nothing says “good idea” like volunteering to meet whatever is behind the ominous door.',
                },
                id: 'call-act',
            },
        });
        const { runCompanionAgentLoop } = await import('../adventure-companion.js');

        const reply = await runCompanionAgentLoop([
            { role: 'system', content: 'Companion test' },
            { role: 'user', content: 'Take my turn.' },
        ], new AbortController().signal);

        expect(textarea.value).toBe('I cautiously open the iron door.');
        expect(inputEvents).toEqual(['input']);
        expect(sendButton.click).toHaveBeenCalledOnce();
        expect(sendAgentTurn).toHaveBeenCalledOnce();
        expect(reply).toBe('Nothing says “good idea” like volunteering to meet whatever is behind the ominous door.');
        expect(reply).not.toContain('Submitted player action');
    });

    it('clicks the selected current CYOA button and ends the Companion loop', async () => {
        testExtensionSettings['rpg_tracker'] = {
            syspromptModules: { CYOA_mode: true },
        };
        const { sendAgentTurn } = await import('../llm-client.js');
        globalThis.HTMLButtonElement = class {
            constructor(text) {
                this.disabled = false;
                this.dataset = { cyoaRaw: text };
                this.textContent = text;
                this.click = vi.fn();
            }
        };
        const firstChoice = new globalThis.HTMLButtonElement('1. Knock on the door');
        const secondChoice = new globalThis.HTMLButtonElement('2. Search for another entrance');
        const choiceBlock = {
            querySelectorAll: vi.fn(() => [firstChoice, secondChoice]),
        };
        globalThis.document = {
            querySelectorAll: vi.fn(() => [choiceBlock]),
        };
        sendAgentTurn.mockResolvedValueOnce({
            content: '',
            toolCall: {
                name: 'act_for_user',
                args: {
                    choice_index: 2,
                    commentary: 'The front door seemed far too emotionally available anyway.',
                },
                id: 'call-choice',
            },
        });
        const { runCompanionAgentLoop } = await import('../adventure-companion.js');

        const reply = await runCompanionAgentLoop([
            { role: 'system', content: 'Companion test' },
            { role: 'user', content: 'Choose for me.' },
        ], new AbortController().signal);

        expect(firstChoice.click).not.toHaveBeenCalled();
        expect(secondChoice.click).toHaveBeenCalledOnce();
        expect(sendAgentTurn).toHaveBeenCalledOnce();
        expect(reply).toBe('The front door seemed far too emotionally available anyway.');
        expect(reply).not.toContain('Submitted CYOA choice');
    });

    it('submits a typed player action in CYOA mode when requested', async () => {
        testExtensionSettings['rpg_tracker'] = {
            syspromptModules: { CYOA_mode: true },
        };
        const { sendAgentTurn } = await import('../llm-client.js');
        const inputEvents = [];
        const textarea = {
            value: '',
            dispatchEvent: vi.fn((event) => inputEvents.push(event.type)),
        };
        const sendButton = {
            disabled: false,
            click: vi.fn(),
        };
        globalThis.Event = class {
            constructor(type) {
                this.type = type;
            }
        };
        globalThis.document = {
            getElementById(id) {
                if (id === 'send_textarea') return textarea;
                if (id === 'send_but') return sendButton;
                return null;
            },
        };
        sendAgentTurn.mockResolvedValueOnce({
            content: '',
            toolCall: {
                name: 'act_for_user',
                args: {
                    action_text: 'I ignore the menu and call out for the innkeeper.',
                    commentary: 'Menus are temporary. Making yourself the innkeeper’s problem is forever.',
                },
                id: 'call-cyoa-text',
            },
        });
        const { runCompanionAgentLoop } = await import('../adventure-companion.js');

        const reply = await runCompanionAgentLoop([
            { role: 'system', content: 'Companion test' },
            { role: 'user', content: 'Type my action instead.' },
        ], new AbortController().signal);

        expect(textarea.value).toBe('I ignore the menu and call out for the innkeeper.');
        expect(inputEvents).toEqual(['input']);
        expect(sendButton.click).toHaveBeenCalledOnce();
        expect(sendAgentTurn).toHaveBeenCalledOnce();
        expect(reply).toBe('Menus are temporary. Making yourself the innkeeper’s problem is forever.');
        expect(reply).not.toContain('Submitted player action');
    });

    it('replaces a dry player-turn receipt with organic local commentary', async () => {
        const { formatPlayerTurnCommentary } = await import('../adventure-companion.js');

        const reply = formatPlayerTurnCommentary(
            { name: 'act_for_user', action_text: 'Silas kicks the door open and levels his gun.' },
            'Submitted player action: Silas kicks the door open and levels his gun.',
            [{ action: 'Player Turn', success: true, status: 'submitted', message: 'Submitted player action.', terminal: true }],
        );

        expect(reply).toBe('Subtlety has officially left the building. Let’s see who flinches first.');
        expect(reply).not.toContain('Submitted');
        expect(reply).not.toContain('✓');
    });
});
