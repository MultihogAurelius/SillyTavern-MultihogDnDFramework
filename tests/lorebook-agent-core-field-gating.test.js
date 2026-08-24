import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    getEligibleCoreFieldNames,
    isCombatProfileField,
    isAppearanceField,
    isEquipmentField,
} from '../src/state/router-utils.js';
import { DEFAULT_NPC_SECTIONS } from '../src/state/schema-sections.js';

const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
const fragmentSource = readFileSync(new URL('../src/state/lorebook-runtime-fragments.js', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../src/state/schema-sections.js', import.meta.url), 'utf8');
const moduleInstrSource = readFileSync(new URL('../src/state/module-instructions.js', import.meta.url), 'utf8');

describe('getEligibleCoreFieldNames', () => {
    it('automatic passes expose only Combat Profile', () => {
        expect(getEligibleCoreFieldNames(DEFAULT_NPC_SECTIONS, false)).toEqual(['Combat Profile']);
    });

    it('manual/Direct Prompt passes expose identity fields (including Species) but not Body/Equipment', () => {
        const fields = getEligibleCoreFieldNames(DEFAULT_NPC_SECTIONS, true);
        expect(fields).toContain('Species');
        expect(fields).toContain('Personality');
        expect(fields).toContain('Brief Background');
        expect(fields).toContain('Habits/Behaviors');
        expect(fields).toContain('Strengths');
        expect(fields).toContain('Flaws');
        expect(fields).toContain('Combat Profile');
        expect(fields.some(isCombatProfileField)).toBe(true);
        expect(fields).not.toContain('Body');
        expect(fields).not.toContain('Equipment');
        expect(fields).not.toContain('Worn Equipment');
        expect(fields.every(f => !/^body$|^equipment$|appearance/i.test(f))).toBe(true);
        expect(fields.every(f => !isEquipmentField(f))).toBe(true);
    });

    it('manual passes expose custom hex/color NPC sections', () => {
        const sections = [...DEFAULT_NPC_SECTIONS, { name: 'Color Code' }];
        expect(getEligibleCoreFieldNames(sections, true)).toContain('Color Code');
        expect(getEligibleCoreFieldNames(sections, false)).toEqual(['Combat Profile']);
    });

    it('falls back to Combat Profile when sections are empty on automatic passes', () => {
        expect(getEligibleCoreFieldNames([], false)).toEqual(['Combat Profile']);
    });
});

describe('router.js core-field gating wiring', () => {
    it('threads isManual into applyAction', () => {
        expect(routerSource).toContain('async function applyAction(action, allBooks = {}, currentTime = \'\', breadcrumb = \'\', isManual = false)');
        expect(routerSource).toContain('await applyAction(basicAction, archiveBooks, currentTime, breadcrumb, isManual)');
        expect(routerSource).toContain('const commitResult = await applyAction(args, archiveBooks, currentTime, breadcrumb, isManual)');
    });

    it('hard-rejects non-Combat-Profile core updates on automatic passes', () => {
        expect(routerSource).toContain('if (!isManual && !isAppearanceField(field) && !isEquipmentField(field) && !isCombatProfileField(field))');
        expect(routerSource).toContain('Automatic pass rejected core update');
    });

    it('commit.core enum uses eligibleCoreFields (not the full section list)', () => {
        expect(routerSource).toContain('const eligibleCoreFields = getEligibleCoreFieldNames(coreSections, isManual)');
        expect(routerSource).toContain("field:   { type: 'string', enum: eligibleCoreFields, description: 'The exact eligible [CORE] field to update this pass.' }");
        expect(fragmentSource).toContain('AUTOMATIC PASS RESTRICTION: Combat Profile is the only [CORE] field');
        expect(routerSource).toContain('resolveAutoPassRestriction(settings, isManual, eligibleCoreFieldsList)');
    });

    it('Body/Species/Worn Equipment sections exist with clear, non-overlapping descriptions', () => {
        const names = DEFAULT_NPC_SECTIONS.map(s => s.name);
        expect(names).toEqual(expect.arrayContaining(['Species', 'Body', 'Worn Equipment']));
        expect(schemaSource).toContain('Not a transient outfit-of-the-scene');
        expect(schemaSource).toContain('Do NOT describe worn gear here — see Worn Equipment.');
        const species = DEFAULT_NPC_SECTIONS.find(s => s.id === 'sec_species');
        expect(species?.description).toMatch(/gender/i);
    });

    it('prompts nudge chronicle entries for notable existing-NPC moments', () => {
        expect(fragmentSource).toContain('For notable existing-NPC moments that do not change any [CORE] field');
        expect(routerSource).toContain('resolveExistingNpcNudge(settings)');
        expect(moduleInstrSource).toContain('For notable existing-NPC moments that do not change any [CORE] field');
    });
});
