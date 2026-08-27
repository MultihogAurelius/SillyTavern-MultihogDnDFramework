import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPortraitStoryContext, portraitStoryLookbackCount } from '../src/state/portrait-story-lookback.js';

describe('portrait story lookback', () => {
    it('builds recent chat context from the configured lookback count', () => {
        const ctx = {
            chat: [
                { is_system: true, mes: 'hidden' },
                { name: 'User', mes: 'First' },
                { name: 'Narrator', mes: 'Second' },
                { name: 'User', mes: 'Third' },
            ],
        };
        expect(buildPortraitStoryContext(ctx, 2)).toContain('Second');
        expect(buildPortraitStoryContext(ctx, 2)).toContain('Third');
        expect(buildPortraitStoryContext(ctx, 2)).not.toContain('First');
        expect(buildPortraitStoryContext(ctx, 0)).toBe('');
        expect(portraitStoryLookbackCount({ portraitStoryLookback: 8 })).toBe(8);
        expect(portraitStoryLookbackCount({})).toBe(5);
    });

    it('exposes portrait story lookback controls in the Portraits drawer', () => {
        const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
        const portraitsStart = settingsMarkup.indexOf('<b>Portraits and Location Images</b>');
        const developerStart = settingsMarkup.indexOf('Developer &amp; Reset');
        const portraitsMarkup = settingsMarkup.slice(portraitsStart, developerStart);

        expect(portraitsMarkup).toContain('id="rpg_tracker_portrait_use_story_lookback"');
        expect(portraitsMarkup).toContain('Use Story Lookback When Generating Portraits');
        expect(portraitsMarkup).toContain('id="rpg_tracker_portrait_story_lookback"');
        expect(portraitsMarkup).toContain('id="rpg_tracker_portrait_story_lookback_row"');
        expect(portraitsMarkup).toContain('Location images always include recent story context');
    });

    it('keeps location image prompts on story lookback regardless of the portrait toggle', () => {
        const source = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');
        const start = source.indexOf('export async function generateLocationImagePrompt');
        expect(start).toBeGreaterThanOrEqual(0);
        const nextExport = source.indexOf('\nexport ', start + 1);
        const fn = source.slice(start, nextExport === -1 ? undefined : nextExport);
        expect(fn).toContain('formatRecentNarratorOutputs');
        expect(fn).not.toContain('portraitUseStoryLookback');
        expect(source.slice(source.indexOf('export async function generatePortraitPrompt'), source.indexOf('export async function generateNpcPortraitPrompt')))
            .toContain('portraitUseStoryLookback');
    });

    it('uses the linked Player Card as the portrait target and excludes unrelated narrator cards', () => {
        const source = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');
        const fn = source.slice(
            source.indexOf('export async function generatePortraitPrompt'),
            source.indexOf('export async function generateNpcPortraitPrompt'),
        );

        expect(fn).toContain('Player Character Lorebook Entry (PRIMARY TARGET');
        expect(fn).toContain('The Player Character Lorebook Entry is the primary source of truth');
        expect(fn).toContain("normalizeCharacterLabel(charData.name) === normalizeCharacterLabel(entityName)");
        expect(fn).not.toContain('contextParts.push(`Character Card Description:');
    });
});
