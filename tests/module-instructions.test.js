import { describe, expect, it } from 'vitest';
import {
    buildNpcInstruction,
    buildLocInstruction,
    buildFacInstruction,
    DEFAULT_MODULES,
    getSettings,
    FACTORY_SETTINGS_VERSION,
    computeBundledPromptsFingerprint,
    computeBundledPromptsFingerprintForSnapshot,
    buildBundledPromptsSnapshot,
    adjustPromptTimestamps,
} from '../state-manager.js';
import { testExtensionSettings } from './setup.js';
import { DEFAULT_STOCK_PROMPTS } from '../constants.js';

describe('module instruction builders', () => {
    it('keeps CHARACTER and PARTY blocks free of biography fields', () => {
        expect(DEFAULT_STOCK_PROMPTS.character).toContain(
            'MECHANICS ONLY: Never include Identity, Background, Appearance, personality, biography, or other narrative/lore fields in [CHARACTER].',
        );
        expect(DEFAULT_STOCK_PROMPTS.party).toContain(
            'MECHANICS ONLY: Never include Identity, Background, Appearance, personality, biography, or other narrative/lore fields in [PARTY].',
        );
    });

    it('includes the multi-level SPELLS block example in the stock prompt', () => {
        expect(DEFAULT_STOCK_PROMPTS.spells).toContain('[SPELLS]');
        expect(DEFAULT_STOCK_PROMPTS.spells).toContain("Level 1 (4/4): Hunter's Mark, Longstrider, Detect Magic");
        expect(DEFAULT_STOCK_PROMPTS.spells).toContain('Level 2 (3/3): Pass Without Trace, Lesser Restoration');
        expect(DEFAULT_STOCK_PROMPTS.spells).toContain('[/SPELLS]');
    });

    it('ends the PARTY prompt with spell-slot and ability-use tracking guidance', () => {
        expect(DEFAULT_STOCK_PROMPTS.party.trim().endsWith(
            'SPELL AND ABILITY USE: track PARTY spell slots and ability use accurately.',
        )).toBe(true);
    });

    it('ends the COMBAT prompt with spell-slot and ability-use tracking guidance', () => {
        expect(DEFAULT_STOCK_PROMPTS.combat.trim().endsWith(
            'SPELL AND ABILITY USE: track COMBAT spell slots and ability use accurately.',
        )).toBe(true);
    });

    it('gives both elite combat examples concrete ability rules and usage counters', () => {
        expect(DEFAULT_STOCK_PROMPTS.combat).toContain(
            'Brutal Strike (On a Warhammer hit, deal +1d10 Bludgeoning damage and force a Fort DC 16 save or knock the target prone; 2/2)',
        );
        expect(DEFAULT_STOCK_PROMPTS.combat).toContain(
            'Dual Strike (When both a primary-hand and offhand attack hit the same target in one turn, deal +1d6 Piercing damage; 2/2)',
        );
        expect(DEFAULT_STOCK_PROMPTS.combat).not.toContain('2/2 per combat');
    });

    it('buildNpcInstruction includes CORE_FORMAT and {{user}} rules', () => {
        const text = buildNpcInstruction(225, 135, true);
        expect(text).toContain('<CORE_FORMAT — NPC only>');
        expect(text).toContain('{{user}}');
        expect(text).toContain('[CORE]');
        expect(text).toContain('COLOR MARKUP');
        expect(text).toContain('<font color=#RRGGBB>');
    });

    it('buildNpcInstruction uses overall exactly-N-words targets', () => {
        const text = buildNpcInstruction(225, 135, false);
        expect(text).toContain('total exactly 225 words');
        expect(text).toContain('total exactly 135 words');
        expect(text).toContain('Distribute freely across sections');
        expect(text).not.toContain('per each section');
        expect(text).not.toContain('Expand/extrapolate thematically');
    });

    it('buildLocInstruction and buildFacInstruction use plain CORE blocks', () => {
        expect(buildLocInstruction()).toContain('<CORE_FORMAT — LOC only>');
        expect(buildFacInstruction()).toContain('<CORE_FORMAT — FAC only>');
        expect(buildLocInstruction()).toContain('Do NOT use NPC field headers');
    });

    it('omits the CHARACTER schema when the CHARACTER module is disabled', async () => {
        const { buildModulesInstructionText } = await import('../memo-processor.js');
        const settings = {
            modules: {},
            stockPrompts: { ...DEFAULT_STOCK_PROMPTS },
        };

        const text = buildModulesInstructionText(settings);

        expect(text).not.toContain('- [CHARACTER]:');
        expect(text).not.toContain('- [ABILITIES]:');
        expect(text).not.toContain('- [INVENTORY]:');
        expect(text).not.toContain('- [SPELLS]:');
    });

    it('emits the CHARACTER schema when the CHARACTER module is enabled', async () => {
        const { buildModulesInstructionText } = await import('../memo-processor.js');
        const settings = {
            modules: { character: true },
            stockPrompts: { ...DEFAULT_STOCK_PROMPTS },
        };

        const text = buildModulesInstructionText(settings);

        expect(text).toContain('- [CHARACTER]:');
    });
});

describe('DEFAULT_MODULES lazy instructions', () => {
    it('exposes npc/loc/fac instructions via getters without hanging', () => {
        expect(DEFAULT_MODULES.npc.tag).toBe('NPC');
        expect(DEFAULT_MODULES.npc.instruction).toContain('[CORE]');
        expect(DEFAULT_MODULES.loc.instruction).toContain('LOC only');
        expect(DEFAULT_MODULES.fac.instruction).toContain('FAC only');
        expect(DEFAULT_MODULES.quest.instruction).toContain('quest');
    });

    it('JSON.stringify bakes getter instructions into plain objects', () => {
        const copy = JSON.parse(JSON.stringify(DEFAULT_MODULES));
        expect(typeof copy.npc.instruction).toBe('string');
        expect(copy.npc.instruction.length).toBeGreaterThan(50);
    });
});

describe('getSettings fresh install', () => {
    it('merges defaults and sets settingsVersion without stack overflow', () => {
        for (const key of Object.keys(testExtensionSettings)) {
            delete testExtensionSettings[key];
        }
        const s = getSettings();
        expect(s.settingsVersion).toBe(FACTORY_SETTINGS_VERSION);
        expect(s.routerModules?.npc?.tag).toBe('NPC');
        expect(typeof s.routerModules?.npc?.instruction).toBe('string');
        expect(s.mapEvolutionIntervalHours).toBe(8);
        expect(s.mapEvolutionOnSiteIntervalHours).toBe(1);
        expect(s.mapEvolutionOnSiteIntervalMinutes).toBe(0);
        expect(s.mapEvolutionOnSitePreset).toBe('dynamic');
    });

    it('migrates only the untouched legacy Map Evolution cadence', () => {
        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
        testExtensionSettings.rpg_tracker = {
            settingsVersion: '2026.8.35',
            mapEvolutionIntervalHours: 8,
            mapEvolutionOnSiteIntervalHours: 8,
        };
        const migrated = getSettings();
        expect(migrated.mapEvolutionIntervalHours).toBe(8);
        expect(migrated.mapEvolutionOnSiteIntervalHours).toBe(1);
        expect(migrated.mapEvolutionOnSiteIntervalMinutes).toBe(0);

        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
        testExtensionSettings.rpg_tracker = {
            settingsVersion: '2026.8.35',
            mapEvolutionIntervalHours: 8,
            mapEvolutionOnSiteIntervalHours: 4,
        };
        const customized = getSettings();
        expect(customized.mapEvolutionIntervalHours).toBe(8);
        expect(customized.mapEvolutionOnSiteIntervalHours).toBe(4);
        expect(customized.mapEvolutionOnSiteIntervalMinutes).toBe(0);
    });

    it('migrates the shipped 12h other-maps interval to 8h without rewriting custom cadences', () => {
        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
        testExtensionSettings.rpg_tracker = {
            settingsVersion: '2026.8.72',
            mapEvolutionIntervalHours: 12,
            mapEvolutionOnSiteIntervalHours: 1,
            mapEvolutionOnSiteIntervalMinutes: 0,
        };
        const migrated = getSettings();
        expect(migrated.mapEvolutionIntervalHours).toBe(8);
        expect(migrated.mapEvolutionOnSiteIntervalHours).toBe(1);
        expect(migrated.mapEvolutionOnSiteIntervalMinutes).toBe(0);
        expect(migrated.mapEvolutionOtherMapsInterval8Applied).toBe(true);
        expect(migrated.settingsVersion).toBe(FACTORY_SETTINGS_VERSION);

        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
        testExtensionSettings.rpg_tracker = {
            settingsVersion: '2026.8.72',
            mapEvolutionIntervalHours: 12,
            mapEvolutionOnSiteIntervalHours: 4,
            mapEvolutionOnSiteIntervalMinutes: 0,
        };
        const customized = getSettings();
        expect(customized.mapEvolutionIntervalHours).toBe(12);
        expect(customized.mapEvolutionOnSiteIntervalHours).toBe(4);
        expect(customized.mapEvolutionOtherMapsInterval8Applied).toBe(true);

        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
        testExtensionSettings.rpg_tracker = {
            settingsVersion: '2026.8.72',
            mapEvolutionIntervalHours: 12,
            mapEvolutionOnSiteIntervalHours: 1,
            mapEvolutionOnSiteIntervalMinutes: 0,
            mapEvolutionOtherMapsInterval8Applied: true,
        };
        const kept = getSettings();
        expect(kept.mapEvolutionIntervalHours).toBe(12);
    });

    it('migrates shipped Map Evolution leave guidance without deleting customized cadences', () => {
        for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
        testExtensionSettings.rpg_tracker = {
            settingsVersion: '2026.8.49.1',
            mapEvolutionLookback: 10,
            mapEvolutionSystemPrompt: 'Keep this wrapper.\n- Leaving this site: SET_ASSET state FLEEING or REMOVE_ASSET, with detail naming the destination in prose. You cannot MOVE_ASSET to another map.\n- REMOVE_ASSET deletes the record and its causal history. Use it only for mistaken clutter or when nothing of that identity should be remembered. Never REMOVE_ASSET a departure, visit, or flight that later ticks should continue.\nEnd.',
            mapUpdaterSystemPrompt: 'REMOVE vs DESTROYED (both valid — choose by lasting occupancy)\n- Default.\n- REMOVE_ASSET is additional, not a substitute for DESTROYED. Delete the record only when narration establishes nothing map-worthy remains: body disintegrated or was hauled away and gone, mistaken/retracted asset, NPC left the site permanently, summon dismissed into nothing.',
        };
        const migrated = getSettings();
        expect(migrated.mapEvolutionLookback).toBe(20);
        expect(migrated.mapEvolutionSystemPrompt).toContain('SET_ASSET state LEFT');
        expect(migrated.mapEvolutionSystemPrompt).toContain('stale ACTIVE occupancy contradicted by RECENT STORY');
        expect(migrated.mapEvolutionSystemPrompt).not.toContain('Leaving this site: SET_ASSET state FLEEING or REMOVE_ASSET');
        expect(migrated.mapEvolutionSystemPrompt).toContain('Keep this wrapper.');
        expect(migrated.mapUpdaterSystemPrompt).toContain('SET_ASSET state LEFT when a living CREATURE/GROUP departed');
        expect(migrated.mapUpdaterSystemPrompt).not.toContain('NPC left the site permanently');
        expect(migrated.settingsVersion).toBe(FACTORY_SETTINGS_VERSION);
    });

    it('includes implicit spell-slot and resource accounting in the State Tracker core prompt', () => {
        for (const key of Object.keys(testExtensionSettings)) {
            delete testExtensionSettings[key];
        }
        expect(getSettings().systemPromptTemplate).toContain(
            "8. Decrement/increment resources such as spell slots if they clearly are spent or gained even if the narrator doesn't explicitly mention that a slot/resource was expended.",
        );
    });

    it('ships a compact State Tracker core prompt without blank spacer lines', () => {
        for (const key of Object.keys(testExtensionSettings)) {
            delete testExtensionSettings[key];
        }
        expect(getSettings().systemPromptTemplate).not.toMatch(/\n[\t ]*\n/);
    });
});

describe('shipped prompt fingerprint', () => {
    it('ignores the user-selected date and clock display format', () => {
        for (const key of Object.keys(testExtensionSettings)) {
            delete testExtensionSettings[key];
        }
        const settings = getSettings();
        settings.useDdMmYyFormat = false;
        settings.use24hTime = false;
        const fingerprint = computeBundledPromptsFingerprint();

        settings.useDdMmYyFormat = true;
        expect(computeBundledPromptsFingerprint()).toBe(fingerprint);

        settings.use24hTime = true;
        expect(computeBundledPromptsFingerprint()).toBe(fingerprint);

        const legacyCalendarSnapshot = structuredClone(buildBundledPromptsSnapshot());
        legacyCalendarSnapshot.lorebook.modules.npc.instruction = legacyCalendarSnapshot.lorebook.modules.npc.instruction
            .replace('Day 1', '01/01/2026')
            .replaceAll('Day N', 'DD/MM/YYYY');
        expect(computeBundledPromptsFingerprintForSnapshot(legacyCalendarSnapshot)).toBe(fingerprint);

        const legacyClockSnapshot = structuredClone(buildBundledPromptsSnapshot());
        legacyClockSnapshot.tracker.stockPrompts.time = legacyClockSnapshot.tracker.stockPrompts.time
            .replaceAll('HH:MM AM/PM', 'HH:MM AM/PM AM/PM AM/PM');
        expect(computeBundledPromptsFingerprintForSnapshot(legacyClockSnapshot)).toBe(fingerprint);
    });

    it('ignores live user toggles and custom CORE sections', () => {
        for (const key of Object.keys(testExtensionSettings)) {
            delete testExtensionSettings[key];
        }
        const settings = getSettings();
        settings.npcRelationshipBars = true;
        settings.npcCoreSections = [
            { id: 'custom', name: 'CustomField', description: 'User-only section', icon: 'fa-star', color: '#fff' },
        ];
        const fingerprint = computeBundledPromptsFingerprint();

        settings.npcRelationshipBars = false;
        settings.npcCoreSections = [];
        expect(computeBundledPromptsFingerprint()).toBe(fingerprint);

        // Unbound / empty settings bag must not change the shipped fingerprint either.
        delete testExtensionSettings.rpg_tracker;
        expect(computeBundledPromptsFingerprint()).toBe(fingerprint);
    });

    it('repairs repeated AM/PM placeholders when changing time format', () => {
        const legacy = 'Current Time: HH:MM AM/PM AM/PM AM/PM, Day N';
        expect(adjustPromptTimestamps(legacy, { useDdMmYyFormat: false, use24hTime: false }))
            .toBe('Current Time: HH:MM AM/PM, Day N');
        expect(adjustPromptTimestamps(legacy, { useDdMmYyFormat: false, use24hTime: true }))
            .toBe('Current Time: HH:MM, Day N');
    });

    it('does not append a second meridiem when normalizing concrete example times', () => {
        const canonical = 'Examples: 10:42 AM, 10:44 AM, and HH:MM AM/PM.';
        const format = { useDdMmYyFormat: false, use24hTime: false };

        expect(adjustPromptTimestamps(adjustPromptTimestamps(canonical, format), format))
            .toBe(canonical);
    });
});

describe('5.5.17 lorebook prompt / word-target migration', () => {
    it('strips {{example}}, seeds runtime fragments, and rescales per-section word targets', () => {
        for (const key of Object.keys(testExtensionSettings)) {
            delete testExtensionSettings[key];
        }
        testExtensionSettings.rpg_tracker = {
            settingsVersion: '5.5.16',
            npcMajorWords: 25,
            npcMinorWords: 15,
            routerBasicSystemPromptTemplate: 'Rules end here.\n{{example}}',
            routerModules: {
                npc: { enabled: true, tag: 'NPC', format: 'Name | Description | Keywords', instruction: 'old' },
            },
        };

        const s = getSettings();
        expect(s.settingsVersion).toBe(FACTORY_SETTINGS_VERSION);
        expect(s.routerBasicSystemPromptTemplate).toBe('Rules end here.');
        expect(s.routerBasicSystemPromptTemplate).not.toContain('{{example}}');
        expect(s.npcMajorWords).toBe(25 * 9);
        expect(s.npcMinorWords).toBe(15 * 9);
        expect(s.routerCombatProfileGuidanceBasicTemplate).toContain('COMBAT PROFILE');
        expect(s.routerAutoPassRestrictionTemplate).toContain('AUTOMATIC PASS RESTRICTION');
        expect(s.routerModules.npc.instruction).toContain('total exactly 225 words');
        expect(s.npcWordTargetRescaleNotice).toEqual({
            fromMajor: 25,
            fromMinor: 15,
            toMajor: 225,
            toMinor: 135,
            sectionCount: 9,
        });
    });

    it('includes runtime fragments in the lorebook fingerprint snapshot', () => {
        const snap = buildBundledPromptsSnapshot();
        expect(snap.lorebook.routerCombatProfileGuidanceBasicTemplate).toContain('COMBAT PROFILE');
        expect(snap.lorebook.routerRelSectionAgentTemplate).toContain('{{max}}');
        expect(snap.lorebook.routerExistingNpcNudgeTemplate).toContain('existing-NPC');
    });
});
