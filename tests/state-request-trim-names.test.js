import { describe, expect, it, afterEach } from 'vitest';
import { resolveStateRequestMaxTokens, sendAgentTurn, sendStateRequest } from '../llm-client.js';

const originalGetContext = globalThis.SillyTavern.getContext;

afterEach(() => {
    globalThis.SillyTavern.getContext = originalGetContext;
});

describe('sendStateRequest default (generateRaw) mode disables trimNames', () => {
    it('inherits the live SillyTavern response length when maxTokens is zero', async () => {
        let capturedOptions = null;
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            mainApi: 'openai',
            chatCompletionSettings: { openai_max_tokens: 4096 },
            generateRaw: async (opts) => {
                capturedOptions = opts;
                return 'complete response';
            },
        });

        await sendStateRequest(
            { connectionSource: 'default', maxTokens: 0 },
            'system prompt',
            'user prompt',
        );

        expect(capturedOptions.responseLength).toBe(4096);
    });

    it('keeps an explicit extension token limit authoritative', () => {
        expect(resolveStateRequestMaxTokens(
            { maxTokens: 2048 },
            { mainApi: 'openai', chatCompletionSettings: { openai_max_tokens: 8192 } },
        )).toBe(2048);
    });

    it('inherits the response length from a selected completion preset', () => {
        expect(resolveStateRequestMaxTokens(
            { maxTokens: 0, completionPresetId: 'Creator' },
            {
                getPresetManager: () => ({
                    getCompletionPresetByName: name => name === 'Creator' ? { genamt: 7168 } : null,
                }),
            },
        )).toBe(7168);
    });

    it('also inherits the live response length in agent-turn generateRaw fallback', async () => {
        let capturedOptions = null;
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            mainApi: 'openai',
            chatCompletionSettings: { openai_max_tokens: 3072 },
            generateRaw: async (opts) => {
                capturedOptions = opts;
                return 'agent response';
            },
        });

        const result = await sendAgentTurn(
            { connectionSource: 'default', maxTokens: 0 },
            [{ role: 'system', content: 'system' }, { role: 'user', content: 'user' }],
        );

        expect(capturedOptions.responseLength).toBe(3072);
        expect(result.content).toBe('agent response');
    });

    it('passes trimNames: false to generateRaw so ST never silently deletes a structured response', async () => {
        let capturedOptions = null;
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            generateRaw: async (opts) => {
                capturedOptions = opts;
                // Simulate a character-sheet response that happens to start with the
                // persona's own name followed by a colon — exactly the shape ST's
                // cleanUpMessage(trimWrongNames: true) would otherwise wipe entirely.
                return 'Hyperion Blackwood: a grim mercenary...';
            },
        });

        const result = await sendStateRequest(
            { connectionSource: 'default' },
            'system prompt',
            'user prompt',
        );

        expect(capturedOptions).toBeTruthy();
        expect(capturedOptions.trimNames).toBe(false);
        expect(result).toBe('Hyperion Blackwood: a grim mercenary...');
    });

    it('reads raw Main API data for structured requests without sending provider-level schema', async () => {
        let capturedOptions = null;
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            mainApi: 'openai',
            generateRaw: async () => {
                throw new Error('generateRaw cleanup path must not be used');
            },
            generateRawData: async (opts) => {
                capturedOptions = opts;
                return { choices: [{ message: { content: '{"ok":true}' } }] };
            },
            extractMessageFromData: raw => raw.choices[0].message.content,
        });
        const jsonSchema = { name: 'test', value: { type: 'object' }, returnInvalid: true };

        const result = await sendStateRequest(
            { connectionSource: 'default' },
            'system prompt',
            'user prompt',
            null,
            { jsonSchema },
        );

        expect(capturedOptions.jsonSchema).toBeNull();
        expect(result).toBe('{"ok":true}');
    });

    it('recovers reasoning-only raw responses for downstream parsing and validation', async () => {
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            mainApi: 'openai',
            generateRawData: async () => ({
                choices: [{ message: { content: '', reasoning_content: '{"version":3}' } }],
            }),
            extractMessageFromData: () => '',
        });

        const result = await sendStateRequest(
            { connectionSource: 'default' },
            'system prompt',
            'user prompt',
            null,
            { jsonSchema: { name: 'test', value: { type: 'object' } } },
        );

        expect(result).toBe('{"version":3}');
    });

    it('does not send JSON schema to profile requests; callers parse the text themselves', async () => {
        let capturedOverride = null;
        const jsonSchema = { name: 'test', value: { type: 'object' } };
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            ConnectionManagerRequestService: {
                getProfile: () => ({ preset: '' }),
                sendRequest: async (_profileId, _messages, _maxTokens, _options, override) => {
                    capturedOverride = override;
                    return { content: { ok: true }, reasoning: '' };
                },
            },
        });

        const result = await sendStateRequest(
            { connectionSource: 'profile', connectionProfileId: 'profile-1' },
            'system prompt',
            'user prompt',
            null,
            { jsonSchema },
        );

        expect(capturedOverride).toEqual({});
        expect(result).toBe('{"ok":true}');
    });

    it('uses the live ST preset when the profile preset is Use Current Settings', async () => {
        const profile = { preset: '' };
        let capturedPreset = null;
        let capturedIncludePreset = null;
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            executeSlashCommandsWithOptions: async () => ({ pipe: 'Live CC' }),
            getPresetManager: (type) => (type && type !== 'openai' ? null : {
                getCompletionPresetByName: name => (name === 'Live CC' ? { openai_max_tokens: 2048 } : null),
            }),
            ConnectionManagerRequestService: {
                getProfile: () => profile,
                sendRequest: async (_profileId, _messages, _maxTokens, options) => {
                    capturedPreset = profile.preset;
                    capturedIncludePreset = options.includePreset;
                    return { content: '{"ok":true}', reasoning: '' };
                },
            },
        });

        await sendStateRequest(
            { connectionSource: 'profile', connectionProfileId: 'profile-1', completionPresetId: '' },
            'system prompt',
            'user prompt',
        );

        expect(capturedIncludePreset).toBe(true);
        expect(capturedPreset).toBe('Live CC');
        expect(profile.preset).toBe('');
    });

    it('fills the live Custom OpenAI URL when no completion preset can be attached', async () => {
        let capturedOverride = null;
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            executeSlashCommandsWithOptions: async () => ({ pipe: '' }),
            chatCompletionSettings: { custom_url: 'http://127.0.0.1:1234/v1' },
            ConnectionManagerRequestService: {
                getProfile: () => ({ preset: '' }),
                sendRequest: async (_profileId, _messages, _maxTokens, options, override) => {
                    capturedOverride = override;
                    return { content: '{"ok":true}', reasoning: '' };
                },
            },
        });

        await sendStateRequest(
            { connectionSource: 'profile', connectionProfileId: 'profile-1' },
            'system prompt',
            'user prompt',
        );

        expect(capturedOverride.custom_url).toBe('http://127.0.0.1:1234/v1');
    });

    it('keeps live OpenRouter routing authoritative when applying a completion preset', async () => {
        let effectivePayload = null;
        const profile = {
            api: 'openrouter',
            model: 'openai/gpt-5.6-luna',
            preset: 'Default',
        };
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            chatCompletionSettings: {
                openrouter_providers: ['OpenAI'],
                openrouter_quantizations: [],
                openrouter_allow_fallbacks: true,
                openrouter_use_fallback: false,
                openrouter_middleout: 'off',
            },
            getPresetManager: (type) => (type && type !== 'openai' ? null : {
                getCompletionPresetByName: name => (name === 'Default' ? {
                    openrouter_providers: ['DeepSeek'],
                    openrouter_allow_fallbacks: false,
                } : null),
            }),
            ConnectionManagerRequestService: {
                getProfile: () => profile,
                sendRequest: async (_profileId, _messages, _maxTokens, _options, override) => {
                    // Mirrors ChatCompletionService's final merge order: the
                    // request override is applied after the completion preset.
                    effectivePayload = {
                        provider: ['DeepSeek'],
                        allow_fallbacks: false,
                        ...override,
                    };
                    return { content: '{"ok":true}', reasoning: '' };
                },
            },
        });

        await sendStateRequest(
            { connectionSource: 'profile', connectionProfileId: 'profile-1', completionPresetId: 'Default' },
            'system prompt',
            'user prompt',
        );

        expect(effectivePayload).toMatchObject({
            provider: ['OpenAI'],
            quantizations: [],
            allow_fallbacks: true,
            use_fallback: false,
            middleout: 'off',
        });
    });

    it('streams keep-alive jobs so provider idle timeouts cannot drop a finished reply', async () => {
        let capturedOptions = null;
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            ConnectionManagerRequestService: {
                getProfile: () => ({ preset: '' }),
                sendRequest: async (_profileId, _messages, _maxTokens, options) => {
                    capturedOptions = options;
                    return async function* () {
                        yield { text: 'Hel' };
                        yield { text: 'Hello map' };
                    };
                },
            },
        });

        const result = await sendStateRequest(
            { connectionSource: 'profile', connectionProfileId: 'profile-1' },
            'system prompt',
            'user prompt',
            null,
            { stream: true },
        );

        expect(capturedOptions.stream).toBe(true);
        expect(result).toBe('Hello map');
    });

    it('streams Main API Chat Completion instead of quiet generateRaw when asked', async () => {
        let usedRaw = false;
        let capturedMaxTokens = null;
        globalThis.SillyTavern.getContext = () => ({
            ...originalGetContext(),
            mainApi: 'openai',
            chatCompletionSettings: { chat_completion_source: 'nanogpt', nanogpt_model: 'gemini-pro', openai_max_tokens: 6144 },
            generateRaw: async () => {
                usedRaw = true;
                throw new Error('quiet generateRaw must not be used for keep-alive jobs');
            },
            ChatCompletionService: {
                processRequest: async (data) => {
                    expect(data.stream).toBe(true);
                    expect(data.model).toBe('gemini-pro');
                    capturedMaxTokens = data.max_tokens;
                    return async function* () {
                        yield { text: '{"ok":true}' };
                    };
                },
            },
        });

        const result = await sendStateRequest(
            { connectionSource: 'default' },
            'system prompt',
            'user prompt',
            null,
            { stream: true },
        );

        expect(usedRaw).toBe(false);
        expect(capturedMaxTokens).toBe(6144);
        expect(result).toBe('{"ok":true}');
    });
});
