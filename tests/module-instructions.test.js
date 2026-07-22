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

describe('module instruction builders', () => {
    it('buildNpcInstruction includes CORE_FORMAT and {{user}} rules', () => {
        const text = buildNpcInstruction(25, 15, true);
        expect(text).toContain('<CORE_FORMAT — NPC only>');
        expect(text).toContain('{{user}}');
        expect(text).toContain('[CORE]');
    });

    it('buildLocInstruction and buildFacInstruction use plain CORE blocks', () => {
        expect(buildLocInstruction()).toContain('<CORE_FORMAT — LOC only>');
        expect(buildFacInstruction()).toContain('<CORE_FORMAT — FAC only>');
        expect(buildLocInstruction()).toContain('Do NOT use NPC field headers');
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

    it('repairs repeated AM/PM placeholders when changing time format', () => {
        const legacy = 'Current Time: HH:MM AM/PM AM/PM AM/PM, Day N';
        expect(adjustPromptTimestamps(legacy, { useDdMmYyFormat: false, use24hTime: false }))
            .toBe('Current Time: HH:MM AM/PM, Day N');
        expect(adjustPromptTimestamps(legacy, { useDdMmYyFormat: false, use24hTime: true }))
            .toBe('Current Time: HH:MM, Day N');
    });
});
