import { describe, expect, it } from 'vitest';
import {
    sanitizeCampaignPrefixString,
    isShippedPortraitLocationSystemPrompt,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_WITHOUT_NPCS,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_LEGACY,
    stripChatStateGlobalUiPrefs,
    CHAT_STATE_GLOBAL_UI_KEYS,
} from '../state-manager.js';

describe('sanitizeCampaignPrefixString', () => {
    it('returns empty for falsy input', () => {
        expect(sanitizeCampaignPrefixString('')).toBe('');
        expect(sanitizeCampaignPrefixString(null)).toBe('');
    });

    it('replaces non-alphanumerics and trims underscores', () => {
        expect(sanitizeCampaignPrefixString('My Campaign!')).toBe('My_Campaign');
        expect(sanitizeCampaignPrefixString('__hello--world__')).toBe('hello_world');
        expect(sanitizeCampaignPrefixString('abc123')).toBe('abc123');
    });
});

describe('isShippedPortraitLocationSystemPrompt', () => {
    it('recognizes current and legacy shipped prompts', () => {
        expect(isShippedPortraitLocationSystemPrompt(PORTRAIT_LOCATION_SYSTEM_PROMPT_WITHOUT_NPCS)).toBe(true);
        expect(isShippedPortraitLocationSystemPrompt(PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS)).toBe(true);
        expect(isShippedPortraitLocationSystemPrompt(PORTRAIT_LOCATION_SYSTEM_PROMPT_LEGACY)).toBe(true);
    });

    it('normalizes CRLF and surrounding whitespace', () => {
        const crlf = PORTRAIT_LOCATION_SYSTEM_PROMPT_WITHOUT_NPCS.replace(/\n/g, '\r\n');
        expect(isShippedPortraitLocationSystemPrompt(`\n${crlf}\n`)).toBe(true);
    });

    it('rejects custom edits', () => {
        expect(isShippedPortraitLocationSystemPrompt('custom user prompt')).toBe(false);
        expect(isShippedPortraitLocationSystemPrompt(PORTRAIT_LOCATION_SYSTEM_PROMPT_WITHOUT_NPCS + '\nextra')).toBe(false);
    });
});

describe('stripChatStateGlobalUiPrefs', () => {
    it('returns false when chatStates missing', () => {
        expect(stripChatStateGlobalUiPrefs({})).toBe(false);
        expect(stripChatStateGlobalUiPrefs(null)).toBe(false);
    });

    it('removes known global UI keys from partitions', () => {
        const settings = {
            chatStates: {
                chatA: {
                    currentMemo: 'keep-me',
                    agentImmersionMode: true,
                    portraitGeneratorSource: 'local',
                },
                chatB: {
                    currentMemo: 'also-keep',
                },
            },
        };
        expect(stripChatStateGlobalUiPrefs(settings)).toBe(true);
        expect(settings.chatStates.chatA.currentMemo).toBe('keep-me');
        expect(settings.chatStates.chatA.agentImmersionMode).toBeUndefined();
        expect(settings.chatStates.chatA.portraitGeneratorSource).toBeUndefined();
        expect(settings.chatStates.chatB.currentMemo).toBe('also-keep');
    });

    it('CHAT_STATE_GLOBAL_UI_KEYS includes immersion and portrait prefs', () => {
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('agentImmersionMode');
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('portraitGeneratorSource');
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('dayNightCycleEnabled');
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('xpBarAtBottom');
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('mapTheme');
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('savedMapThemePresets');
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('activeMapThemePresetId');
    });
});
