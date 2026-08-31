import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { testExtensionSettings } from './setup.js';

vi.mock('../portrait-storage.js', () => ({
    lookupCustomPortraitSrc: () => '',
}));

import { getSettings } from '../state-manager.js';
import { loadPartyCompact, renderMemoAsCards, savePartyCompact } from '../renderer.js';

const PARTY_MEMO = `[PARTY]
Elara (Ranger): 26/45 HP | AC: 15
Att/def: Longbow
Status: Healthy
Kael: 40/40 HP
Saves: Fort +4, Ref +2, Will +1
[/PARTY]`;

const CASTER_PARTY_MEMO = `[PARTY]
Perrin (Mage Apprentice): 10/13 HP
Spells: Cantrips: Fire Bolt, Light
Spells: Level 1 (3/3): Magic Missile, Shield, Burning Hands
Corwin Vale (Ex-Stormwind Footman): 25/28 HP
[/PARTY]`;

beforeEach(() => {
    for (const key of Object.keys(testExtensionSettings)) delete testExtensionSettings[key];
    localStorage.clear();
});

describe('PARTY compact mode', () => {
    it('puts a Compact Mode toggle on the PARTY module header', () => {
        const html = renderMemoAsCards(PARTY_MEMO, null, {});
        expect(html).toContain('class="rt-party-compact-btn"');
        expect(html).toContain('Compact Mode</button>');
        expect(html).toContain('data-tag="PARTY"');
        expect(html).toContain('aria-pressed="false"');
        expect(html).toContain('Compact mode: portrait, name, and HP only');
        expect(html).not.toContain('rt-section-card rt-party-compact');
        expect(html).toContain('rt-entity-name');
        expect(html).toContain('rt-hp-bar');
        expect(html).toContain('rt-hp-label');
        expect(html).toContain('rt-entity-sub-line');
        expect(html).toContain('rt-entity-portrait-container');
    });

    it('marks the PARTY card compact and persists the choice', () => {
        savePartyCompact(true);
        expect(loadPartyCompact()).toBe(true);
        const html = renderMemoAsCards(PARTY_MEMO, null, {});
        expect(html).toContain('rt-section-card rt-party-compact');
        expect(html).toContain('class="rt-party-compact-btn active"');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('Show full party details');
        expect(html).toContain('Elara (Ranger)');
        expect(html).toContain('Kael');
        expect(html).toContain('rt-hp-bar');
        expect(html).toContain('rt-entity-sub-line');
    });

    it('still emits spell rows in compact HTML so CSS can hide them', () => {
        savePartyCompact(true);
        const html = renderMemoAsCards(CASTER_PARTY_MEMO, null, {});
        expect(html).toContain('rt-section-card rt-party-compact');
        expect(html).toContain('rt-spell-row');
        expect(html).toContain('rt-spell-level');
        expect(html).toContain('Fire Bolt');
        expect(html).toContain('Magic Missile');
        expect(html).toContain('rt-hp-bar');
        expect(html).toContain('Perrin (Mage Apprentice)');
    });

    it('puts Compact Mode on a Display Group host that contains PARTY', () => {
        const settings = getSettings();
        settings.blockOrder = ['PARTY', 'TIME'];
        settings.displayGroupsEnabled = true;
        settings.displayGroups = [{
            id: 'roster',
            name: 'Roster',
            icon: '👥',
            enabled: true,
            members: ['PARTY'],
        }];
        savePartyCompact(true);

        const html = renderMemoAsCards(PARTY_MEMO, null, {});
        expect(html).toContain('rt-display-group-card');
        expect(html).toContain('class="rt-party-compact-btn active"');
        expect(html).toContain('rt-display-group-member rt-party-compact');
        expect(html).not.toContain('rt-section-card rt-party-compact');
    });

    it('hides extra party lines in CSS while keeping portrait, name, and HP', () => {
        const styles = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        expect(styles).toContain('.rt-party-compact .rt-entity-sub-line');
        expect(styles).toContain('.rt-party-compact .rt-spell-row');
        expect(styles).toContain('.rt-party-compact .rt-multi-marker-row');
        expect(styles).toContain('.rt-party-compact .rt-card-item');
        expect(styles).toContain('.rt-party-compact .rt-card-kv');
        expect(styles).toContain('.rt-party-compact .rt-benched-panel');
        expect(styles).toContain('.rt-entity-name');
        expect(styles).toContain('.rt-hp-bar');
        expect(styles).toContain('.rt-entity-portrait-container');
    });

    it('binds the header button to persist compact mode', () => {
        const source = readFileSync(new URL('../src/ui/panel/card-events.js', import.meta.url), 'utf8');
        expect(source).toContain("el.querySelectorAll('.rt-party-compact-btn')");
        expect(source).toContain('savePartyCompact(!loadPartyCompact())');
    });
});
