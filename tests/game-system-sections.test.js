import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { findActiveUnlockedBaseOverride, isCyoaEnabled, isEffectiveSectionEnabled, isLocationMappingEnabled, setLocationMappingEnabled, LOCATION_MAPPING_SECTION_TAG } from '../src/state/section-enabled.js';

describe('effective system-prompt section state', () => {
    it('ignores an inactive override from another cartridge when resolving an unlocked base section', () => {
        const inactiveZombieFooter = {
            id: 'zombie-footer',
            origin: 'unlocked_base',
            baseTag: 'end_of_output_footer',
            content: '<end_of_output_footer>Zombie footer</end_of_output_footer>',
            enabled: false,
            _chatSetupMember: false,
        };
        const activeFreshFooter = {
            id: 'fresh-footer',
            origin: 'unlocked_base',
            baseTag: 'end_of_output_footer',
            content: '<end_of_output_footer>Factory footer</end_of_output_footer>',
            enabled: true,
            _chatSetupMember: true,
        };
        const settings = {
            customSyspromptLibrary: [inactiveZombieFooter, activeFreshFooter],
        };

        expect(findActiveUnlockedBaseOverride(settings.customSyspromptLibrary, 'end_of_output_footer'))
            .toBe(activeFreshFooter);
        expect(isEffectiveSectionEnabled('end_of_output_footer', settings)).toBe(true);
    });

    it('keeps an enabled unlocked CYOA override active when the base toggle is off', () => {
        const settings = {
            syspromptModules: { CYOA_mode: false },
            customSyspromptLibrary: [{
                origin: 'unlocked_base',
                baseTag: 'CYOA_mode',
                enabled: true,
            }],
        };

        expect(isEffectiveSectionEnabled('CYOA_mode', settings)).toBe(true);
    });

    it('respects a disabled unlocked CYOA override', () => {
        const settings = {
            syspromptModules: { CYOA_mode: true },
            customSyspromptLibrary: [{
                origin: 'unlocked_base',
                baseTag: 'CYOA_mode',
                enabled: false,
            }],
        };

        expect(isEffectiveSectionEnabled('CYOA_mode', settings)).toBe(false);
    });

    it('redirects Wizard tracker-module scope clicks to Manage Game Systems', () => {
        const editorSource = readFileSync(new URL('../ui-editors.js', import.meta.url), 'utf8');

        expect(editorSource).toContain("scopeControl.className = 'rt-module-wizard-scope'");
        expect(editorSource).toContain('Open Manage Game Systems to make the bundle GLOBAL or CHAT-BOUND.');
        expect(editorSource).toContain('scopeControl.onclick = showWizardScopeRedirect');
        expect(editorSource).toMatch(/event\.key !== 'Enter' && event\.key !== ' '/);
    });

    it('treats Persistent Maps as a kill switch even when the unlocked override disagrees', () => {
        const settings = {
            enabled: true,
            syspromptModules: { [LOCATION_MAPPING_SECTION_TAG]: false },
            customSyspromptLibrary: [{
                origin: 'unlocked_base',
                baseTag: LOCATION_MAPPING_SECTION_TAG,
                enabled: true,
            }],
        };

        expect(isEffectiveSectionEnabled(LOCATION_MAPPING_SECTION_TAG, settings)).toBe(true);
        expect(isLocationMappingEnabled({ ...settings, enabled: false })).toBe(false);

        setLocationMappingEnabled(false, settings);
        expect(settings.syspromptModules[LOCATION_MAPPING_SECTION_TAG]).toBe(false);
        expect(settings.customSyspromptLibrary[0].enabled).toBe(false);
        expect(isLocationMappingEnabled(settings)).toBe(false);

        setLocationMappingEnabled(true, settings);
        expect(settings.syspromptModules[LOCATION_MAPPING_SECTION_TAG]).toBe(true);
        expect(settings.customSyspromptLibrary[0].enabled).toBe(true);
        expect(isLocationMappingEnabled(settings)).toBe(true);
    });

    it('requires the State Tracker master toggle for CYOA injection', () => {
        const settings = {
            enabled: true,
            syspromptModules: { CYOA_mode: true },
        };

        expect(isEffectiveSectionEnabled('CYOA_mode', settings)).toBe(true);
        expect(isCyoaEnabled(settings)).toBe(true);
        expect(isCyoaEnabled({ ...settings, enabled: false })).toBe(false);
        expect(isCyoaEnabled({
            enabled: true,
            syspromptModules: { CYOA_mode: false },
        })).toBe(false);
        expect(isCyoaEnabled({
            enabled: false,
            syspromptModules: { CYOA_mode: false },
            customSyspromptLibrary: [{
                origin: 'unlocked_base',
                baseTag: 'CYOA_mode',
                enabled: true,
            }],
        })).toBe(false);
    });

    it('gates interceptor CYOA on the master power toggle', () => {
        const hooksSource = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
        expect(hooksSource).toContain('isCyoaEnabled');
        expect(hooksSource).toContain('isLocationMappingEnabled');
        expect(hooksSource).toContain('const cyoaActive = isCyoaEnabled(settings)');
        expect(hooksSource).toContain('stripLeftoverCyoaAndPacingFromPrompt(chat)');
        expect(hooksSource).not.toContain('CYOA / pacing tags can inject even when the State Tracker master toggle is off');
    });
    it('keeps the Components Persistent Maps checkbox as a live kill switch', () => {
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        const gameSystemsSource = readFileSync(new URL('../game-systems.js', import.meta.url), 'utf8');
        const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
        const onboarding = readFileSync(new URL('../renderer.js', import.meta.url), 'utf8');

        expect(settingsMarkup).toContain('Persistent Maps (Alpha)');
        expect(settingsMarkup).toContain('Text command — no function calling');
        expect(settingsMarkup).toContain('rpg_map_architect_opener');
        expect(settingsMarkup).toContain('rpg_map_architect_opener_components');
        expect(settingsMarkup).toContain('id="rpg_map_architect_opener_components"');
        expect(settingsMarkup).not.toContain('Persistent Maps (Alpha) — function calling MUST be enabled');
        expect(settingsMarkup).not.toContain('Location Mapping (Alpha)');
        expect(settingsMarkup).not.toContain('Dungeon Reality Mapping (Alpha)');
        expect(onboarding).toContain('Persistent Maps (Alpha)');
        expect(onboarding).toContain('rt_onboarding_map_architect_opener');
        expect(indexSource).toContain('setLocationMappingEnabled(checked, fresh)');
        expect(indexSource).toContain('syncMapArchitectOpenerNestedVisibility');
        expect(indexSource).toContain('syncLocationMappingRuntime()');
        expect(indexSource).toMatch(/function scheduleAutoApply\(\) \{\s*syncLocationMappingRuntime\(\);/s);
        expect(indexSource).toContain('// Keep CreateAreaMap / Map Updater in sync even when Custom Sysprompt Mode');
        expect(gameSystemsSource).toContain('MAP_ARCHITECT_TEXT_OPENER_RULES');
        expect(gameSystemsSource).toContain('isMapArchitectTextOpener(settings)');
        expect(gameSystemsSource).toContain('el.disabled = false');
        expect(gameSystemsSource).toContain('setLocationMappingEnabled(checked, settings)');
    });
});

describe('bench ETA follows the live RNG mechanic', () => {
    it('rewrites <bench_ETA_system> from diceFunctionTool and combat, not a single hard-coded roller', () => {
        const gameSystemsSource = readFileSync(new URL('../game-systems.js', import.meta.url), 'utf8');
        expect(gameSystemsSource).toContain('const useQueue = !settings.diceFunctionTool || inCombat');
        expect(gameSystemsSource).toContain('call ${toolName} to resolve task success/failure');
        expect(gameSystemsSource).toContain('pop a ${dieWord} from ${queueName} to resolve task success/failure');
    });
});
