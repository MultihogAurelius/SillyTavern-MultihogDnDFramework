import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { testExtensionSettings } from './setup.js';

vi.mock('../portrait-storage.js', () => ({
    lookupCustomPortraitSrc: () => '',
}));

import { renderMemoAsCards } from '../renderer.js';

describe('onboarding Player Card and ST persona options', () => {
    beforeEach(() => {
        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
    });

    it('renders separate controls in Other Ways to Begin and Character Creator', () => {
        const html = renderMemoAsCards('', null, {});

        expect(html).toContain('id="rt-onboarding-player-card-cb"');
        expect(html).toContain('id="rt-onboarding-st-persona-cb" checked');
        expect(html).toContain('id="rt-cr-player-card-cb"');
        expect(html).toContain('id="rt-cr-st-persona-cb" checked');
        expect(html.match(/Create Player Card in Lorebook Agent \(Recommended\)/g)).toHaveLength(2);
        expect(html.match(/Create ST Persona \(Recommended\)/g)).toHaveLength(2);
        expect(html).toContain('same player name');
        expect(html).not.toContain('Create Persona (Recommended)');
    });

    it('requires a rolled name for the Other Ways Custom path', () => {
        const html = renderMemoAsCards('', null, {});

        expect(html).toContain('id="rt-onboarding-rolled-name" placeholder="Roll or enter a name"');
        expect(html).toContain('id="rt-onboarding-roll-name"');
        expect(html).toMatch(/data-archetype="custom" data-name-required="true" disabled/);
        expect(html).toMatch(/data-archetype="persona">/);
        expect(html).toMatch(/data-archetype="pc_import">/);
    });

    it('preserves the active Persona when deriving a character from it', () => {
        const cardEventsSource = readFileSync(new URL('../src/ui/panel/card-events.js', import.meta.url), 'utf8');
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

        expect(cardEventsSource).toContain("const requiresRolledName = archetype !== 'persona';");
        expect(cardEventsSource).toContain('preferredName: personaName');
        expect(indexSource).toContain(
            'preserveExistingDescription: !!options.preserveActivePersona',
        );
        expect(indexSource).toContain(
            "const charName = preferredName || extractCharNameFromMemo(s.currentMemo) || 'My Character';",
        );
    });

    it('includes numbered onboarding help with embedded video and CHAT links', () => {
        const html = renderMemoAsCards('', null, {});

        expect(html).toContain('Need help? Try these:');
        expect(html).toContain('this basic video walkthrough');
        expect(html).toContain('href="https://www.youtube.com/watch?v=82Lt9pRYFS0"');
        expect(html).toContain('id="rt-onboarding-open-chat"');
        expect(html).toContain('Adventure Companion');
        expect(html).not.toContain('discord.gg');
        expect(html).not.toContain('SillyTavern Discord');
        expect(html).not.toContain('Hell, head there anyway!');
        expect(html).not.toContain('Need help? Open');
    });

    it('keeps How It Works as system explainers, separate from Need Help', () => {
        const html = renderMemoAsCards('', null, {});
        const headingIndex = html.indexOf('<span>How It Works</span>');
        const noteIndex = html.indexOf('class="rt-onboarding-prompt-backup-note"');
        const howIndex = html.indexOf('class="rt-onboarding-how-it-works"');
        const autoIndex = html.indexOf('Auto-Tracking:');
        const mapEvoIndex = html.indexOf('Makes maps/locations dynamic');
        const helpHeadingIndex = html.indexOf('<span>Need Help</span>');
        const helpIndex = html.indexOf('class="rt-onboarding-chat-tip"');

        expect(headingIndex).toBeGreaterThanOrEqual(0);
        expect(noteIndex).toBeGreaterThan(headingIndex);
        expect(howIndex).toBeGreaterThan(noteIndex);
        expect(autoIndex).toBeGreaterThan(howIndex);
        expect(mapEvoIndex).toBeGreaterThan(autoIndex);
        expect(helpHeadingIndex).toBeGreaterThan(mapEvoIndex);
        expect(helpIndex).toBeGreaterThan(helpHeadingIndex);
        expect(html).toContain('Persistent Maps section of the settings');
        expect(html).toContain('Multihog D&amp;D Framework auto-applies its own system prompt.');
        expect(html).toContain('General &amp; Visuals -> Core -> Restore backup to Main.');
        expect(html).toContain('A summarizer is <b>mandatory</b> for this extension to compress the context.');
        expect(html).toContain('href="https://github.com/Lodactio/Extension-Summaryception"');
        expect(html).toContain('hides verbatim messages');
    });

    it('lists Function Calling first in the Setup Guide', () => {
        const html = renderMemoAsCards('', null, {});
        const setupIndex = html.indexOf('<span>Setup Guide</span>');
        const functionIndex = html.indexOf('Function Calling');
        const narratorCardIndex = html.indexOf('Leave the card content empty');
        const instantIndex = html.indexOf('Instant Action to get started quicker');

        expect(setupIndex).toBeGreaterThanOrEqual(0);
        expect(functionIndex).toBeGreaterThan(setupIndex);
        expect(narratorCardIndex).toBeGreaterThan(functionIndex);
        expect(instantIndex).toBeGreaterThan(narratorCardIndex);
        expect(html).toContain('Text command');
        expect(html).toContain('CreateAreaMap');
        expect(html).toContain('connection settings');
        expect(html).not.toContain('Leave the card fields empty');
    });

    it('links the startup welcome note to the GitHub releases page', () => {
        const html = renderMemoAsCards('', null, {});

        expect(html).toContain('Welcome to Multihog D&D Framework!');
        expect(html).toContain('href="https://github.com/MultihogAurelius/SillyTavern-MultihogDnDFramework/releases"');
        expect(html).toContain('Releases section of the GitHub page');
    });
});
