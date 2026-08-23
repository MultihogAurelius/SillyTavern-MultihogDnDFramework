import { describe, expect, it } from 'vitest';
import {
    DEFAULT_PORTRAIT_PROMPT_PRESET_ID,
    FACTORY_PORTRAIT_PROMPT_PRESETS,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_WITHOUT_NPCS,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_LEGACY,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS_V1,
    buildLocationPortraitSystemPrompt,
    findShippedPortraitLocationPresetId,
    getDefaultPortraitCharacterSystemPrompt,
    getDefaultPortraitLocationSystemPrompt,
    getDefaultPortraitNpcSystemPrompt,
    getFactoryPortraitPromptPresetNameSet,
    isShippedPortraitLocationSystemPrompt,
    resolveFactoryPortraitPromptBundle,
} from '../src/state/portrait-prompts.js';

describe('factory portrait prompt presets', () => {
    it('ships Fantasy as the default preset id', () => {
        expect(DEFAULT_PORTRAIT_PROMPT_PRESET_ID).toBe('fantasy');
        expect(FACTORY_PORTRAIT_PROMPT_PRESETS[0].id).toBe('fantasy');
        expect(FACTORY_PORTRAIT_PROMPT_PRESETS.length).toBeGreaterThanOrEqual(5);
    });

    it('builds default prompts that match the fantasy art-style lines', () => {
        expect(getDefaultPortraitNpcSystemPrompt()).toContain('high-quality fantasy portrait, dramatic lighting, detailed');
        expect(getDefaultPortraitCharacterSystemPrompt()).toContain('high-quality fantasy portrait, dramatic lighting, detailed');
        expect(getDefaultPortraitLocationSystemPrompt(false)).toBe(PORTRAIT_LOCATION_SYSTEM_PROMPT_WITHOUT_NPCS);
        expect(getDefaultPortraitLocationSystemPrompt(true)).toBe(PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS);
    });

    it('resolves non-default styles with distinct art-style lines', () => {
        const anime = resolveFactoryPortraitPromptBundle('anime', false);
        expect(anime.npcSystemPrompt).toContain('anime style portrait');
        expect(anime.characterSystemPrompt).toContain('anime style portrait');
        expect(anime.locationSystemPrompt).toContain('anime style scene');
        expect(anime.locationSystemPrompt).not.toContain('Characters:');
    });

    it('keeps present-NPC location variant when resolving a style', () => {
        const dark = resolveFactoryPortraitPromptBundle('dark_fantasy', true);
        expect(dark.locationSystemPrompt).toContain('Characters:');
        expect(dark.locationSystemPrompt).toContain('dark fantasy scene');
    });

    it('recognizes all factory location prompts as shipped', () => {
        for (const preset of FACTORY_PORTRAIT_PROMPT_PRESETS) {
            const without = buildLocationPortraitSystemPrompt(preset.sceneArtStyle, false);
            const withNpcs = buildLocationPortraitSystemPrompt(preset.sceneArtStyle, true);
            expect(isShippedPortraitLocationSystemPrompt(without)).toBe(true);
            expect(isShippedPortraitLocationSystemPrompt(withNpcs)).toBe(true);
            expect(findShippedPortraitLocationPresetId(without)).toBe(preset.id);
            expect(findShippedPortraitLocationPresetId(withNpcs)).toBe(preset.id);
        }
        expect(findShippedPortraitLocationPresetId(PORTRAIT_LOCATION_SYSTEM_PROMPT_LEGACY)).toBe('fantasy');
        expect(findShippedPortraitLocationPresetId(PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS_V1)).toBe('fantasy');
    });

    it('reserves factory display names so user saves cannot collide', () => {
        const names = getFactoryPortraitPromptPresetNameSet();
        expect(names.has('fantasy (default)')).toBe(true);
        expect(names.has('anime')).toBe(true);
        expect(names.has('my custom setup')).toBe(false);
    });
});
