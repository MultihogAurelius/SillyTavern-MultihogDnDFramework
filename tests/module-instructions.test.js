import { describe, expect, it } from 'vitest';
import {
    buildNpcInstruction,
    buildLocInstruction,
    buildFacInstruction,
    DEFAULT_MODULES,
    getSettings,
    FACTORY_SETTINGS_VERSION,
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
