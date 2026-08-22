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
            expect(source).toContain('A map-worthy high-risk map within a SETTLEMENT is a SUBDUNGEON');
            expect(source).toContain('fresh chat may begin inside a standalone DUNGEON/INTERIOR');
            expect(source).toContain('include: ["Exact Current SUB* Name"]');
            expect(source).toContain('leave the child standalone');
            expect(source).toContain('Promotion first reclassifies the BUILDING');
            expect(source).toContain('Importance alone is not sufficient');
            expect(source).toContain('BUILDING interiors use lazy asset generation and are empty on initialization');
            expect(source).toContain('an external Map Updater agent fills it out');
            expect(source).toContain('rumors are canoninized by the Map Updater');
            expect(source).toContain('optional settlement-only include[]');
            expect(source).toContain('creation-only for SETTLEMENT absorption');
            expect(source).toContain('BUILDING has no map unless explicitly promoted');
            expect(source).toContain('exact canonical names, never translated, expanded, or retitled');
            expect(source).toContain('BUILDING keeps the SETTLEMENT active');
            expect(source).toContain('mapped child becomes active at the deepest matching footer segment');
            expect(source).toContain('Hosted child reality includes a compact host brief');
            expect(source).toContain('may be four or more tiers');
            expect(source).toContain('Ashford, North Residential Streets, Residential House, Kitchen Passage');
            expect(source).toContain('Never stop at the mapped site name');
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
