import { afterEach, describe, expect, it } from 'vitest';
import {
    CHAT_COMPLETION_API,
    RECOMMENDED_OUTPUT_LENGTH,
    buildOverlayHtml,
    describeMainApi,
    getApiSetupStatuses,
    getSillyTavernMainApi,
    isChatCompletionApi,
    isFunctionCallingEnabled,
    isMaxContextUnlocked,
    isOutputLengthRecommended,
    shouldShowApiSetupGate,
} from '../src/ui/api-setup-gate.js';

describe('API setup checklist', () => {
    afterEach(() => {
        delete globalThis.SillyTavern;
    });

    it('treats only openai as Chat Completion', () => {
        expect(isChatCompletionApi('openai')).toBe(true);
        expect(isChatCompletionApi('textgenerationwebui')).toBe(false);
        expect(isChatCompletionApi('kobold')).toBe(false);
        expect(isChatCompletionApi('koboldhorde')).toBe(false);
        expect(isChatCompletionApi('novel')).toBe(false);
        expect(CHAT_COMPLETION_API).toBe('openai');
    });

    it('labels Text Completion vs Chat Completion for the overlay', () => {
        expect(describeMainApi('openai')).toBe('Chat Completion');
        expect(describeMainApi('textgenerationwebui')).toBe('Text Completion');
        expect(describeMainApi('')).toBe('not set');
    });

    it('reads the live API from SillyTavern context', () => {
        globalThis.SillyTavern = { getContext: () => ({ mainApi: 'textgenerationwebui' }) };
        expect(getSillyTavernMainApi()).toBe('textgenerationwebui');
        expect(isChatCompletionApi()).toBe(false);
        globalThis.SillyTavern = { getContext: () => ({ mainApi: 'openai' }) };
        expect(isChatCompletionApi()).toBe(true);
    });

    it('reads function calling, unlocked context, and output length from Chat Completion settings', () => {
        const ready = {
            function_calling: true,
            max_context_unlocked: true,
            openai_max_tokens: RECOMMENDED_OUTPUT_LENGTH,
        };
        expect(isFunctionCallingEnabled(ready)).toBe(true);
        expect(isMaxContextUnlocked(ready)).toBe(true);
        expect(isOutputLengthRecommended(ready)).toBe(true);

        const stale = {
            function_calling: false,
            max_context_unlocked: false,
            openai_max_tokens: 300,
        };
        expect(isFunctionCallingEnabled(stale)).toBe(false);
        expect(isMaxContextUnlocked(stale)).toBe(false);
        expect(isOutputLengthRecommended(stale)).toBe(false);
        expect(isOutputLengthRecommended({ openai_max_tokens: 99999 })).toBe(false);
        expect(isOutputLengthRecommended({ openai_max_tokens: 128000 })).toBe(true);
    });

    it('collects all four live statuses independently', () => {
        globalThis.SillyTavern = {
            getContext: () => ({
                mainApi: 'openai',
                chatCompletionSettings: {
                    function_calling: false,
                    max_context_unlocked: true,
                    openai_max_tokens: 4096,
                },
            }),
        };
        expect(getApiSetupStatuses()).toEqual({
            chatCompletion: true,
            functionCalling: false,
            maxContextUnlocked: true,
            outputLength: false,
        });
    });

    it('is a first-run checklist, not a hard gate on Chat Completion', () => {
        expect(shouldShowApiSetupGate(false)).toBe(true);
        expect(shouldShowApiSetupGate(true)).toBe(false);
        expect(RECOMMENDED_OUTPUT_LENGTH).toBe(100000);
    });

    it('keeps Continue enabled and renders the Anti-Museum Tour copy', () => {
        const html = buildOverlayHtml({
            chatCompletion: false,
            functionCalling: false,
            maxContextUnlocked: false,
            outputLength: false,
        });
        expect(html).toContain('id="rt-api-setup-continue"');
        expect(html).not.toMatch(/id="rt-api-setup-continue"[^>]*disabled/);
        expect(html).toContain('Anti-Museum Tour');
        expect(html).toContain('People get JSON syntax errors and other stuff, and it turns out it&apos;s because ST makes their maximum output like 2000 out of the box.');
        expect(html).toContain('Chat Completion is enabled');
        expect(html).toContain('Text Completion is a legacy API that was relevant before ChatGPT came out. It being offered as the default in 2026 makes absolutely no sense. It functions as a landmine, and I constantly see users step into it.');
        expect(html).toContain('Even with Chat Completion, however, you still have to configure your API settings manually. OpenRouter or NanoGPT are what I would recommend.');
        expect(html).toContain('Function calling is enabled');
        expect(html).toContain('This is crucial to use the more effective version of tools in Multihog D&amp;D, though there is a MacGyver cope path available if you can\'t use tools for whatever reason.');
        expect(html).toContain('Maximum context size is unlimited');
        expect(html).toContain('It\'s quite clear the last time the ST devs looked at these was in 2021-2022 because the numbers match that era perfectly.');
        expect(html).toContain('There is no reason to limit this today, and in fact there are reasons not to.');
        expect(html).toContain('Imposing an artificial context limit does nothing but destroy your cache hits, which means you pay more.');
        expect(html).toContain('Output length is set to 100,000');
        expect(html).toContain('truncating the JSON and giving a schema/syntax error.');
        expect(html).toContain('Why has it never changed? Who knows, but I know the results are disastrous.');
        expect(html).toContain('Setup should be correct by default, wrong by user intervention. It\'s the exact opposite here.');
        expect(html).toContain('href="https://github.com/Lodactio/Extension-Summaryception"');
        expect(html).toContain('>summarizer</a>');
        expect(html).toContain('id="rt-api-setup-gm-name"');
        expect(html).toContain('value="Game Master"');
        expect(html).toContain('id="rt-api-setup-create-gm"');
        expect(html).toContain('Multihog doesn&apos;t use a one-on-one chat format but uses a format written like a book, that seamlessly allows for multiple characters. The messages are attributed to a narrator, not a single character.');
        expect(html.match(/type="checkbox"/g)?.length).toBe(4);
        expect(html).not.toContain('These live checkmarks reflect your current SillyTavern settings');
    });
});
