import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildNarrativeModeTags, buildNarrativePacingSection } from '../src/state/narrative-pacing.js';

describe('Narrator Configuration pacing', () => {
    it('offers Shorter Outputs directly below Normal in both configuration surfaces', () => {
        const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
        const rendererSource = readFileSync(new URL('../renderer.js', import.meta.url), 'utf8');

        for (const source of [settingsMarkup, rendererSource]) {
            const normalAt = source.indexOf('value="normal"');
            const shorterAt = source.indexOf('value="shorter_outputs"');
            const highAgencyAt = source.indexOf('value="high_agency"');

            expect(normalAt).toBeGreaterThan(-1);
            expect(shorterAt).toBeGreaterThan(normalAt);
            expect(highAgencyAt).toBeGreaterThan(shorterAt);
            expect(source).toContain('Normal (no length instructions)');
            expect(source).toContain('Shorter Outputs');
        }

        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(indexSource).toContain('Keeps outputs short to moderate in length. Also does not have the instruction of lightly expanding on your actions, likely leaving more room for you to respond and direct the scene.');
    });

    it('builds the requested modest-length narrative prompt with output_length tag', () => {
        const result = buildNarrativePacingSection('shorter_outputs');

        expect(result).toBe(`<narrative>
- Simulate realistic time passage; advance the time in the status footer accordingly.
- Multiple skill checks per output are fine when appropriate.
- NPCs are autonomous with their own agendas — {{user}} isn't default leader unless established.
- High-competence/alpha NPCs (e.g. Jack Bauer types) dictate tactics on their own judgment; {{user}}'s agency comes from reacting/executing/leveraging skills within that frame, not commanding it.
- NPCs can express opinions about things, and they can even leave over serious value conflicts.
- NPCs only know what they'd realistically know based on established narrative and their archetype; they're not omniscient.
- NPC tone and behavior is guided by their injected permanent profile (the identity fields above any chronicle lines).
- Voice: may paraphrase {{user}}'s dialogue/actions consistent with their character, lightly expanding as needed.
<output_length>
- Keep the output length short/modest; don't let it drift out of control.
</output_length>
</narrative>`);
    });

    it('wraps high-agency and slice-of-life modes in their own tags', () => {
        expect(buildNarrativeModeTags('high_agency')).toContain('<high_agency_mode_on>');
        expect(buildNarrativeModeTags('downtime')).toContain('<slice_of_life_mode_on>');
        expect(buildNarrativePacingSection('high_agency')).toContain('<high_agency_mode_on>');
        expect(buildNarrativePacingSection('downtime')).toContain('<slice_of_life_mode_on>');
        expect(buildNarrativePacingSection('high_agency')).not.toContain('- Voice:');
    });

    it('keeps Normal free of output-length instructions', () => {
        const result = buildNarrativePacingSection('normal');

        expect(result).toContain('- Voice: may paraphrase');
        expect(result).not.toContain('output length');
        expect(result).not.toContain('<output_length>');
        expect(result).not.toContain('<high_agency_mode_on>');
        expect(result).not.toContain('short-to moderate-length');
    });
});
