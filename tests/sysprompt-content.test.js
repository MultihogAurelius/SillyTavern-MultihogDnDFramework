import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeGmContent, unwrapManagedSectionContent } from '../src/state/sysprompt-content.js';
import { RT_PROMPTS } from '../constants.js';

describe('system-prompt section content normalization', () => {
    const tag = 'homebrew_and_custom_classes';
    const corrupted = `<homebrew_and_custom_classes>
<homebrew_and_custom_classes>
<homebrew_and_custom_classes>
Non-standard/homebrew classes use thematic BAB progression.
</homebrew_and_custom_classes>
test
</homebrew_and_custom_classes>
test
</homebrew_and_custom_classes>`;

    it('repairs repeated editor wrappers without losing appended instructions', () => {
        expect(normalizeGmContent(tag, corrupted)).toBe(`<homebrew_and_custom_classes>
Non-standard/homebrew classes use thematic BAB progression.
test
test
</homebrew_and_custom_classes>`);
    });

    it('is idempotent across repeated saves', () => {
        const normalized = normalizeGmContent(tag, corrupted);
        expect(normalizeGmContent(tag, normalized)).toBe(normalized);
    });

    it('presents only the editable body when the outer tag is managed', () => {
        expect(unwrapManagedSectionContent(tag, `<${tag}>\nAdd one rule.\n</${tag}>`)).toBe('Add one rule.');
    });

    it('requires a new action after an out-of-range attack attempt', () => {
        const expectedBlock = `<spatial_and_entity_constraints>
Out-of-range attack attempt → note {{user}} couldn't attack due to range; ask for another action. Max active [PARTY] size = 5 + {{user}} (no more added); cap doesn't apply to [BENCHED PARTY].
</spatial_and_entity_constraints>`;
        const sources = [
            RT_PROMPTS['sysprompt.txt'],
            RT_PROMPTS['sysprompt_legacy.txt'],
            readFileSync(new URL('../sysprompt.txt', import.meta.url), 'utf8'),
            readFileSync(new URL('../sysprompt_legacy.txt', import.meta.url), 'utf8'),
        ];

        for (const source of sources) expect(source.replaceAll('\r\n', '\n')).toContain(expectedBlock);
    });

    it('ships the travel random-event contract in every narrator prompt source', () => {
        const expectedBlock = `<random_events>
Travel/time-skips only, not spammed. Pop a number: ≥10 = event occurs. If event, pop again: ≤8 negative, 9–11 ambiguous, ≥12 favorable. Not used for rest interruption.

If the party is traveling through a dangerous area, you can narrate enemy encounters anyway, regardless of the random event roll. It is not the only source of enemies during travel.
</random_events>`;
        const sources = [
            RT_PROMPTS['sysprompt.txt'],
            RT_PROMPTS['sysprompt_legacy.txt'],
            readFileSync(new URL('../sysprompt.txt', import.meta.url), 'utf8'),
            readFileSync(new URL('../sysprompt_legacy.txt', import.meta.url), 'utf8'),
        ];

        for (const source of sources) {
            expect(source.replaceAll('\r\n', '\n')).toContain(expectedBlock);
            expect(source).not.toContain('Batch both RollTheDice calls together');
        }
    });

    it('spells out damage types in every shipped combat prompt example', () => {
        const sources = [
            readFileSync(new URL('../constants.js', import.meta.url), 'utf8'),
            readFileSync(new URL('../index.js', import.meta.url), 'utf8'),
            readFileSync(new URL('../sysprompt.txt', import.meta.url), 'utf8'),
            readFileSync(new URL('../sysprompt_legacy.txt', import.meta.url), 'utf8'),
        ];
        const abbreviatedDamage = /\b\d+d\d+(?:[+-]\d+)?\s*[BPS]\b/i;

        for (const source of sources) expect(source).not.toMatch(abbreviatedDamage);
    });

    it('keeps every shipped mapping module synchronized with the root source text', () => {
        const normalize = (value) => String(value).replaceAll('\r\n', '\n');
        const mappingModule = (value) => normalize(value).match(
            /<dungeon_reality_and_hidden_mapping>[\s\S]*?<\/dungeon_reality_and_hidden_mapping>/,
        )?.[0];
        const source = mappingModule(readFileSync(new URL('../dungeon_reality_and_hidden_mapping.txt', import.meta.url), 'utf8'));

        expect(mappingModule(RT_PROMPTS['sysprompt.txt'])).toBe(source);
        expect(mappingModule(RT_PROMPTS['sysprompt_legacy.txt'])).toBe(source);
        expect(mappingModule(readFileSync(new URL('../sysprompt.txt', import.meta.url), 'utf8'))).toBe(source);
        expect(mappingModule(readFileSync(new URL('../sysprompt_legacy.txt', import.meta.url), 'utf8'))).toBe(source);
    });

    it('ships the short Map Architect and external-agent ownership contract in both narrator prompts', () => {
        const sources = [
            RT_PROMPTS['sysprompt.txt'],
            RT_PROMPTS['sysprompt_legacy.txt'],
            readFileSync(new URL('../sysprompt.txt', import.meta.url), 'utf8'),
            readFileSync(new URL('../sysprompt_legacy.txt', import.meta.url), 'utf8'),
        ];

        for (const source of sources) {
            expect(source).toContain('When an unmapped site warrants a stable graph');
            expect(source).toContain('DUNGEON: high-risk room graph');
            expect(source).toContain('INTERIOR: significant lower-risk multi-room site');
            expect(source).toContain('SETTLEMENT: town/city/village as a whole, district-scale');
            expect(source).toContain('ordinary named shops, inns, chapels, and houses are BUILDING');
            expect(source).toContain('Only one map can be created at a time');
            expect(source).toContain('unmapped "transition space" between granularly mapped areas of interest');
            expect(source).toContain('A map-worthy high-risk child is a SUBDUNGEON');
            expect(source).toContain('attach a nested map from anywhere without moving the player');
            expect(source).toContain('No BUILDING, OBJECT, or pre-created SUB* asset is required');
            expect(source).toContain('limited to three mapped documents');
            expect(source).toContain('fresh chat may begin inside a standalone DUNGEON/INTERIOR');
            expect(source).toContain('include: ["Exact Current SUB* Name"]');
            expect(source).toContain('leave the child standalone');
            expect(source).toContain('runtime creates the SUBDUNGEON/SUBINTERIOR gateway');
            expect(source).toContain('Importance alone is not sufficient');
            expect(source).toContain('BUILDING interiors use lazy asset generation and are empty on initialization');
            expect(source).toContain('When the player expresses the intent to enter BUILDING');
            expect(source).toContain('an external Map Updater agent fills it out with its own asset content');
            expect(source).toContain('the map is not a strict limitation, especially in SETTLEMENT areas');
            expect(source).toContain('Successful Perception checks do not spawn new enemies');
            expect(source).toContain('perception checks only reveal them (if they exist.)');
            expect(source).toContain('rumors are canoninized by the Map Updater');
            expect(source).not.toContain('A first-entry footer remains a retry fallback');
            expect(source).not.toContain('establishes its objective hidden contents before your next narration');
            expect(source).toContain('optional settlement-only include[]');
            expect(source).toContain('creation-only for SETTLEMENT absorption');
            expect(source).toContain('BUILDING has no map unless explicitly promoted');
            expect(source).toContain('Invent `site` as this new place\'s name');
            expect(source).toContain('it does not need to already appear in the live Location footer');
            expect(source).toContain('the exact names this map will use');
            expect(source).toContain('BUILDING keeps its parent map active');
            expect(source).toContain('mapped child becomes active at the deepest complete matching footer path');
            expect(source).toContain('Hosted child reality includes a compact host brief');
            expect(source).toContain('may be four or more tiers');
            expect(source).toContain('always append the exact current mapped area after the complete site breadcrumb');
            expect(source).toContain('Never refer to unmapped BUILDINGs positionally in the footer');
            expect(source).toContain('Main Street, General Store');
            expect(source).toContain('private objective canon');
            expect(source).toContain('[DUNGEON_REALITY — INTERNAL GM CANON]');
            expect(source).toContain('[MAPPED_SITES — INTERNAL]');
            expect(source).not.toContain('<div hidden data-dungeon-map>');
            expect(source).not.toContain('one valid JSON object');
            expect(source).not.toContain('CreateDungeonMap');
            expect(source).not.toContain('Occupancy on the attached map may lag');
            expect(source).not.toContain('own cadence (often every turn)');
            expect(source).not.toContain('use the latest DUNGEON_REALITY block and do not invent catch-up facts');
            expect(source).not.toContain('Lorebook Agent');
        }
    });
});
