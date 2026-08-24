import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDefaultSettings } from '../src/state/defaults.js';
import {
    buildInstantActionOpeningMessage,
    buildInstantActionPromptSection,
    extractInstantActionLevel,
    getInstantActionLevelRange,
    MAX_INSTANT_ACTION_INSTRUCTION_LENGTH,
    normalizeInstantActionInstructions,
    resolveInstantActionPlayerCardWords,
    rollInstantActionLevel,
} from '../src/state/instant-action-instructions.js';

const quickStartSource = readFileSync(new URL('../quickstart.js', import.meta.url), 'utf8');
const creatorSource = readFileSync(new URL('../character-creator.js', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../renderer.js', import.meta.url), 'utf8');

describe('Instant Action instructions', () => {
    it('preserves the original opening message when the optional box is empty', () => {
        expect(buildInstantActionOpeningMessage('   ')).toBe('Begin the adventure');
    });

    it('sends the same guidance with the opening adventure message', () => {
        expect(buildInstantActionOpeningMessage('A storm-battered frontier town')).toBe(
            'Begin the adventure.\n\nInitial Setup:\nA storm-battered frontier town',
        );
    });

    it('marks guidance as higher priority than randomized character defaults', () => {
        const section = buildInstantActionPromptSection('A 28-year-old female ranger with a crossbow');
        expect(section).toContain('INITIAL SETUP:');
        expect(section).toContain('A 28-year-old female ranger with a crossbow');
        expect(section).toContain('these instructions win');
    });

    it('trims and bounds one-time guidance', () => {
        const oversized = `  ${'x'.repeat(MAX_INSTANT_ACTION_INSTRUCTION_LENGTH + 50)}  `;
        expect(normalizeInstantActionInstructions(oversized)).toHaveLength(MAX_INSTANT_ACTION_INSTRUCTION_LENGTH);
    });

    it('supports preset and custom Player Card lengths with safe bounds', () => {
        expect(resolveInstantActionPlayerCardWords('400', '')).toBe(400);
        expect(resolveInstantActionPlayerCardWords('other', '850')).toBe(850);
        expect(resolveInstantActionPlayerCardWords('other', '')).toBe(150);
        expect(resolveInstantActionPlayerCardWords('other', '9000')).toBe(5000);
    });

    it('wires Initial Setup into character, Player Card, and narrator generation', () => {
        expect(rendererSource).toContain('id="rt-quickstart-instructions"');
        expect(quickStartSource).toMatch(/instructionsInput\?\.value \|\| ''/);
        expect(quickStartSource).toMatch(/generateQuickStartCharacter\(\{[\s\S]*?instantActionInstructions,/);
        expect(quickStartSource).toMatch(/generatePersonaBio\([\s\S]*?buildInstantActionPromptSection\(instantActionInstructions\)/);
        expect(quickStartSource).toContain('buildInstantActionOpeningMessage(instantActionInstructions)');
        expect(creatorSource).toContain('instantActionInstructions: opts.instantActionInstructions');
        expect(creatorSource).toContain('If the Initial Setup specifies');
        expect(creatorSource).toContain('extractInstantActionLevel(instantActionInstructions)');
    });

    it('lets Initial Setup override the rolled Instant Action level', () => {
        expect(extractInstantActionLevel('A level 7 ranger.')).toBe(7);
        expect(extractInstantActionLevel('lvl 3 wizard')).toBe(3);
        expect(extractInstantActionLevel('a 7th-level ranger with a crossbow')).toBe(7);
        expect(extractInstantActionLevel('A 28-year-old female ranger with a crossbow')).toBeNull();
        expect(extractInstantActionLevel('')).toBeNull();
        expect(creatorSource).toContain('extractedLevel ?? (opts.level || 1)');
        expect(creatorSource).toContain('STARTING LEVEL: ${level} (mandatory — the character MUST be exactly Level ${level}).');
    });

    it('rolls a random level between 1 and 10 for Instant Action instead of using Other Ways', () => {
        const { min, max } = getInstantActionLevelRange();
        expect(min).toBe(1);
        expect(max).toBe(10);
        expect(rollInstantActionLevel(() => 0)).toBe(1);
        expect(rollInstantActionLevel(() => 0.999)).toBe(10);
        expect(rollInstantActionLevel(() => 0.5)).toBe(6);
        expect(quickStartSource).toContain('rollInstantActionLevel(secureRandom)');
        expect(quickStartSource).not.toMatch(/onboardingLevel \|\| 1\)/);
    });

    it('exposes a selectable Player Card word count in Instant Action', () => {
        expect(rendererSource).toContain('id="rt-quickstart-persona-words"');
        expect(rendererSource).toContain('id="rt-quickstart-persona-words-custom"');
        expect(quickStartSource).toContain('resolveInstantActionPlayerCardWords(');
    });

    it('makes the Instant Action starter message optional and on by default', () => {
        expect(buildDefaultSettings().onboardingSendStarterMessage).toBe(true);
        expect(rendererSource).toContain('id="rt-quickstart-send-starter"');
        expect(rendererSource).toContain('Send Starter Message?');
        expect(rendererSource).toContain('If this is checked, the AI automatically starts the campaign as soon as the rolled character is ready.');
        expect(rendererSource).toContain("obSettings.onboardingSendStarterMessage !== false ? 'checked' : ''");
        expect(quickStartSource).toMatch(/if \(s\.onboardingSendStarterMessage !== false\)/);
        expect(quickStartSource).toMatch(/sendStarterCheckbox\?\.addEventListener\('change', persistQuickStartOptions\)/);
        expect(quickStartSource).toContain('Type your first action.');
    });
});
