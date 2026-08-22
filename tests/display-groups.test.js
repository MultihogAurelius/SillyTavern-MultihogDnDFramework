import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { testExtensionSettings } from './setup.js';

vi.mock('../portrait-storage.js', () => ({
    lookupCustomPortraitSrc: () => '',
}));

import { getSettings, CHAT_STATE_GLOBAL_UI_KEYS } from '../state-manager.js';
import { renderMemoAsCards, renderTabModeView } from '../renderer.js';
import {
    buildDisplayGroupRenderPlan,
    moveDisplayGroupInOrder,
    normalizeDisplayGroups,
} from '../src/features/display-groups.js';

const memo = `[ALPHA_STANDING]
Alpha Standing: ((BARRED)) 50/100
Status: ((PILLS)) Respected
[/ALPHA_STANDING]

[VEHICLE_FUEL]
Vehicle Fuel: ((BARRED)) 1000/1000
Status: ((PILLS)) Full
[/VEHICLE_FUEL]`;

function configureGroups(enabled = true) {
    const settings = getSettings();
    settings.blockOrder = ['ALPHA_STANDING', 'VEHICLE_FUEL'];
    settings.customFields = [
        { tag: 'ALPHA_STANDING', label: 'Alpha Standing', icon: '🐺', enabled: true },
        { tag: 'VEHICLE_FUEL', label: 'Vehicle Fuel', icon: '⛽', enabled: true },
    ];
    settings.displayGroupsEnabled = enabled;
    settings.displayGroupsShowGaps = true;
    settings.displayGroups = [{
        id: 'vehicle_systems',
        name: 'Vehicle Systems',
        icon: '🚙',
        enabled: true,
        members: ['ALPHA_STANDING', 'VEHICLE_FUEL'],
    }];
    return settings;
}

beforeEach(() => {
    for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
    localStorage.clear();
});

describe('Display Groups BETA safety and planning', () => {
    it('is off by default and returns the original flat render plan unchanged', () => {
        const settings = getSettings();
        expect(settings.displayGroupsEnabled).toBe(false);
        expect(settings.displayGroupsShowGaps).toBe(false);
        expect(settings.displayGroups).toEqual([]);
        expect(buildDisplayGroupRenderPlan(['A', 'B'], [{ id: 'g', name: 'G', members: ['A', 'B'] }], false)).toEqual([
            { kind: 'module', tag: 'A' },
            { kind: 'module', tag: 'B' },
        ]);
    });

    it('defensively rejects malformed, overlapping, and dedicated-module membership', () => {
        expect(normalizeDisplayGroups([
            { id: 'first', name: 'First', members: ['FUEL', 'CHARACTER', 'PARTY', 'COMBAT'] },
            { id: 'second', name: 'Second', members: ['FUEL', 'QUESTS', 'OXYGEN', 'BENCHED PARTY'] },
            { id: '', name: 'Broken', members: ['OTHER'] },
        ])).toEqual([
            { id: 'first', name: 'First', icon: '🗂️', enabled: true, members: ['FUEL', 'CHARACTER', 'PARTY'] },
            { id: 'second', name: 'Second', icon: '🗂️', enabled: true, members: ['OXYGEN'] },
        ]);
    });

    it('moves a Display Group as one unit while preserving unrelated module order', () => {
        expect(moveDisplayGroupInOrder(['A', 'B', 'C', 'D'], ['B', 'C'], 'down')).toEqual(['A', 'D', 'B', 'C']);
        expect(moveDisplayGroupInOrder(['A', 'B', 'C', 'D'], ['B', 'C'], 'up')).toEqual(['B', 'C', 'A', 'D']);
    });

    it('uses the saved member order inside a Display Group', () => {
        const [entry] = buildDisplayGroupRenderPlan(
            ['ALPHA', 'BETA'],
            [{ id: 'group', name: 'Group', members: ['BETA', 'ALPHA'] }],
            true,
        );
        expect(entry).toMatchObject({ kind: 'group', tags: ['BETA', 'ALPHA'] });
    });

    it('keeps definitions and the master switch global rather than chat-linked', () => {
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('displayGroupsEnabled');
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('displayGroupsShowGaps');
        expect(CHAT_STATE_GLOBAL_UI_KEYS).toContain('displayGroups');
    });
});

describe('Display Group rendering', () => {
    it('combines present members beneath one host and removes child card headers in Stack Mode', () => {
        const settings = configureGroups(true);
        settings.currentMemo = memo;
        settings.systemPromptTemplate = 'DO NOT TOUCH THIS PROMPT';
        const html = renderMemoAsCards(memo, null, {});

        expect(html).toContain('rt-display-group-card');
        expect(html).not.toContain('rt-display-group-beta');
        expect(html).toContain('🚙 Vehicle Systems');
        expect(html).toContain('data-member-tag="ALPHA_STANDING"');
        expect(html).toContain('data-member-tag="VEHICLE_FUEL"');
        expect(html).toContain('Alpha Standing:');
        expect(html).toContain('Vehicle Fuel:');
        expect(html.match(/class="rt-section-header"/g)).toHaveLength(1);
        expect(html).not.toContain('data-tag="ALPHA_STANDING"><div class="rt-section-header"');
        expect(html).not.toContain('data-tag="VEHICLE_FUEL"><div class="rt-section-header"');
        expect(settings.currentMemo).toBe(memo);
        expect(settings.systemPromptTemplate).toBe('DO NOT TOUCH THIS PROMPT');
    });

    it('falls back to the existing independent cards immediately when disabled', () => {
        configureGroups(false);
        const html = renderMemoAsCards(memo, null, {});

        expect(html).not.toContain('rt-display-group-card');
        expect(html).toContain('🐺 Alpha Standing');
        expect(html).toContain('⛽ Vehicle Fuel');
        expect(html.match(/class="rt-section-header"/g)).toHaveLength(2);
    });

    it('can render grouped modules seamlessly when gaps are disabled', () => {
        const settings = configureGroups(true);
        settings.displayGroupsShowGaps = false;
        const html = renderMemoAsCards(memo, null, {});

        expect(html).toContain('rt-display-group-body rt-display-group-body--seamless');
    });

    it('always expands grouped modules instead of inheriting pagination state', () => {
        const settings = configureGroups(true);
        settings.fullViewSections = [];
        settings.modulePageSizes = {
            ALPHA_STANDING: 1,
            VEHICLE_FUEL: 1,
        };
        const sectionPages = {
            ALPHA_STANDING: 1,
            VEHICLE_FUEL: 1,
        };

        const html = renderMemoAsCards(memo, null, sectionPages);

        expect(html).toContain('Alpha Standing:');
        expect(html).toContain('Vehicle Fuel:');
        expect(html).toContain('Respected');
        expect(html).toContain('Full');
        expect(html).not.toContain('rt-pagination');
    });

    it('uses one group tab and one combined host in Tab Mode', () => {
        configureGroups(true);
        const html = renderTabModeView(memo, {}, null);

        expect(html.match(/class="rt-tab-btn/g)).toHaveLength(1);
        expect(html).toContain('data-tag="DISPLAY_GROUP_vehicle_systems"');
        expect(html).not.toContain('class="rt-tab-btn" data-tag="ALPHA_STANDING"');
        expect(html).not.toContain('class="rt-tab-btn" data-tag="VEHICLE_FUEL"');
        expect(html).toContain('data-member-tag="ALPHA_STANDING"');
        expect(html).toContain('data-member-tag="VEHICLE_FUEL"');
    });

    it('preserves an existing detached child instead of duplicating it inside a host', () => {
        configureGroups(true);
        localStorage.setItem('rpg_tracker_detached', JSON.stringify(['VEHICLE_FUEL']));
        const html = renderMemoAsCards(memo, null, {});

        expect(html).toContain('rt-display-group-card');
        expect(html).toContain('data-member-tag="ALPHA_STANDING"');
        expect(html).not.toContain('data-member-tag="VEHICLE_FUEL"');
        expect(html).toContain('VEHICLE_FUEL is detached');
    });

    it('labels the settings and manager clearly as BETA and keeps them separate from Modules & Order', () => {
        const settingsHtml = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
        const managerSource = readFileSync(new URL('../display-groups.js', import.meta.url), 'utf8');
        const editorSource = readFileSync(new URL('../ui-editors.js', import.meta.url), 'utf8');
        expect(settingsHtml).toContain('Display Groups <small style="color:#ffc45c;">BETA</small>');
        expect(settingsHtml).not.toContain('rpg_tracker_display_groups_enabled');
        expect(settingsHtml).toContain('rpg_tracker_manage_display_groups');
        expect(settingsHtml.indexOf('rpg_tracker_manage_display_groups')).toBeGreaterThan(settingsHtml.indexOf('<b>Modules &amp; Order</b>'));
        expect(settingsHtml.indexOf('rpg_tracker_manage_display_groups')).toBeLessThan(settingsHtml.indexOf('<b>Scenario Profiles</b>'));
        expect(settingsHtml).toContain('rt-tag-library-button');
        expect(readFileSync(new URL('../style.css', import.meta.url), 'utf8')).toContain('.rt-tag-library-button {');
        expect(readFileSync(new URL('../style.css', import.meta.url), 'utf8')).toContain('width: 100%;');
        expect(managerSource).toContain('They never merge memo blocks, prompts, module activation, scope, or Wizard Game Systems.');
        expect(managerSource).toContain('Display Groups allow you to visually bundle together related modules without their headers');
        expect(managerSource).toContain('Especially useful in tab mode');
        expect(managerSource).toContain('rt-display-groups-enabled');
        expect(managerSource).toContain('rt-display-groups-show-gaps');
        expect(managerSource).toContain('Show gaps between grouped modules');
        expect(managerSource).toContain('MODULE ORDER IN THIS GROUP');
        expect(managerSource).toContain('rt-dg-member-order');
        expect(managerSource).toContain('width:100%;min-width:0;max-height:72vh');
        expect(managerSource).toContain('overflow-x:hidden');
        expect(managerSource).toContain('allowVerticalScrolling: true');
        expect(managerSource).toContain('wider: true');
        expect(managerSource).not.toContain('large: true');
        expect(managerSource).toContain("cancelButton: 'Cancel'");
        expect(managerSource).toContain('popup.result !== POPUP_RESULT.AFFIRMATIVE');
        expect(managerSource).toContain('saveOpenEditor ? saveOpenEditor() : true');
        expect(managerSource).not.toContain('rt-dg-editor-cancel');
        expect(editorSource).toContain('group.members = group.members.map');
    });
});
