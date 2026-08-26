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

    it('keeps Continue enabled and uses the crude setup copy', () => {
        const html = buildOverlayHtml({
            chatCompletion: false,
            functionCalling: false,
            maxContextUnlocked: false,
            outputLength: false,
        });
        expect(html).toContain('id="rt-api-setup-continue"');
        expect(html).not.toMatch(/id="rt-api-setup-continue"[^>]*disabled/);
        expect(html).toContain('Anti-Museum Tour');
        expect(html).toContain('This menu is a result of months of taking &quot;bug reports&quot; from people and discovering 98% of the time the cause was the museum defaults of SillyTavern.');
        expect(html).toContain('I&apos;ll probably fork this trash eventually and fix all of this, but for now Multihog D&amp;D will still continue as an extension.');
        expect(html).toContain('Chat Completion is enabled');
        expect(html).toContain('Text Completion is an idiotic legacy API that was relevant before ChatGPT came out. It being offered as the default still in 2026 is an insult and shows how the ST developers don\'t give a fuck about UX and common sense.');
        expect(html).toContain('You still have to configure your API settings manually. OpenRouter or NanoGPT are recommended.');
        expect(html).toContain('Function calling is enabled');
        expect(html).toContain('This is crucial to use the more effective version of tools in Multihog D&amp;D Instead of the MacGyver makeshit cope tools path (that regardless is available if you absolutely can\'t use tool calling.)');
        expect(html).toContain('Maximum context size is unlimited');
        expect(html).toContain('Last time they cared to look at these defaults was in 2021');
        expect(html).toContain('Imposing an artificial context limit does nothing but destroy your cache hits, which means you pay more.');
        expect(html).toContain('Output length is set to 100,000');
        expect(html).toContain('Or worse: an agent is outputting a JSON object and the model hits this pathetic cap, truncating the JSON.');
        expect(html).toContain('SillyTavern is an outdated anti-user program that ships with 2021 assumptions in 2026.');
        expect(html).toContain('This truly is the perfect example of anti-user design and being completely out of touch.');
        expect(html).toContain('href="https://github.com/Lodactio/Extension-Summaryception"');
        expect(html).toContain('>summarizer</a>');
        expect(html).toContain('id="rt-api-setup-gm-name"');
        expect(html).toContain('value="Game Master"');
        expect(html).toContain('id="rt-api-setup-create-gm"');
        expect(html).toContain('Multihog doesn&apos;t use the outdated and stupid one-on-one chat format but uses a proper RP format written like a book, that involves multiple characters. The messages are attributed to a narrator, not a single character.');
        expect(html.match(/type="checkbox"/g)?.length).toBe(4);
        expect(html).not.toContain('These live checkmarks reflect your current SillyTavern settings');
    });
});
