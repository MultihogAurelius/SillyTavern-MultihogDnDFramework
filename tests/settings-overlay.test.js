import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const stubMarkup = readFileSync(new URL('../settings-stub.html', import.meta.url), 'utf8');
const overlaySource = readFileSync(new URL('../src/ui/settings-overlay.js', import.meta.url), 'utf8');
const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

describe('settings overlay', () => {
    it('ships a stub entry point for the extensions drawer', () => {
        expect(stubMarkup).toContain('class="rpg-tracker-settings-stub"');
        expect(stubMarkup).toContain('id="rpg_tracker_open_settings"');
        expect(stubMarkup).toContain('Open Settings');
    });

    it('implements a floating external window rather than a fullscreen takeover', () => {
        expect(style).toContain('.rt-settings-overlay');
        expect(style).toContain('.rt-so-panel');
        expect(style).toContain('width: min(1176px, calc(100vw - 16px))');
        expect(style).toContain('height: min(984px, 94vh)');
        expect(style).toContain('height: min(984px, 94dvh)');
        expect(style).toContain('position: fixed !important');
        expect(style).toContain('env(safe-area-inset-top');
        expect(overlaySource).toContain('installPanelDrag');
        expect(overlaySource).toContain('resetSettingsPanelGeometry');
        expect(overlaySource).toContain('isCompactSettingsViewport');
        expect(overlaySource).toContain('centered panel rather than a literal fullscreen');
    });

    it('removes backdrop dimming only for an open Map Themes preview', () => {
        expect(style).toContain('.rt-so-tab-btn[data-tab="maparchitect"].rt-so-tab-active');
        expect(style).toContain(':has(#rpg_map_themes_drawer.open) .rt-so-dim');
        expect(style).toContain('background: transparent;');
    });

    it('locks Dark/Light settings chrome with a General & Visuals tab toggle', () => {
        expect(overlaySource).toContain('installAppearanceToggle');
        expect(overlaySource).toContain('settingsOverlayAppearance');
        expect(overlaySource).toContain('rt-so-mode-dark');
        expect(overlaySource).toContain('rt-so-mode-light');
        expect(style).toContain('.rt-settings-overlay.rt-so-mode-light .rt-so-panel');
        expect(style).toContain('.rt-so-appearance-bar');
        expect(style).toContain('--rt-so-fg:');
        expect(style).toContain('Lift the floor');
        const defaults = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');
        expect(defaults).toContain("settingsOverlayAppearance: 'light'");
    });

    it('maps Multihog primary sections to left-rail tabs and wires init before bindings', () => {
        [
            "id: 'general'",
            "id: 'connections'",
            "id: 'gamesystems'",
            "id: 'statetracker'",
            "id: 'agent'",
            "id: 'maparchitect'",
            "id: 'worldprog'",
            "id: 'companion'",
        ].forEach((fragment) => expect(overlaySource).toContain(fragment));

        const agentIdx = overlaySource.indexOf("id: 'agent'");
        const mapIdx = overlaySource.indexOf("id: 'maparchitect'");
        const worldIdx = overlaySource.indexOf("id: 'worldprog'");
        expect(mapIdx).toBeGreaterThan(agentIdx);
        expect(worldIdx).toBeGreaterThan(mapIdx);

        expect(overlaySource).toContain("label: 'General & Visuals'");
        expect(overlaySource).toContain("label: 'Persistent Maps'");
        expect(overlaySource).toContain('match: /Persistent Maps/i');
        expect(indexSource).toContain('initSettingsOverlay(settingsHtml');
        expect(indexSource).toContain("settings-stub");
        expect(indexSource).toContain("openSettingsOverlay('connections')");
        expect(indexSource).toContain("openSettingsOverlay('maparchitect')");
        expect(indexSource).toContain("document.getElementById('rpg_map_themes_drawer')");
        expect(indexSource).toContain("'#rpg_open_map_themes'");
        expect(indexSource).toContain('#rpg_tracker_open_settings');
    });

    it('scopes drawer-toggle delegation so checkbox clicks are not swallowed', () => {
        expect(indexSource).toContain('#rt-settings-overlay .rpg-tracker-settings .inline-drawer-toggle');
        expect(indexSource).toContain('.rpg-tracker-settings-stub .inline-drawer-toggle');
        // Guard against the broken comma-concat form that matched the whole settings root.
        expect(indexSource).not.toContain('settingsDrawerRoot} .inline-drawer-toggle');
        expect(indexSource).toContain("closest('input, select, textarea, button, a, label.checkbox_label')");
    });

    it('adds a keyword search field that filters settings across tabs', () => {
        const searchSource = readFileSync(new URL('../src/ui/settings-search.js', import.meta.url), 'utf8');
        expect(overlaySource).toContain('installSettingsSearch');
        expect(overlaySource).toContain('id="rt-so-search-input"');
        expect(overlaySource).toContain('placeholder="Search settings…');
        expect(overlaySource).toContain('handleSettingsSearchKeydown');
        expect(overlaySource).toContain('dataset.tabLabel');
        expect(overlaySource).toContain('rt-so-tab-count');
        expect(overlaySource).toContain("closest('button, input, textarea, .rt-so-search')");
        expect(searchSource).toContain('export function applySettingsSearch');
        expect(searchSource).toContain('tokenizeQuery');
        expect(searchSource).toContain('haystackFrom');
        expect(searchSource).toContain('snapshotDrawerStates');
        expect(searchSource).toContain('restoreDrawerStates');
        expect(searchSource).toContain('rtSoWasOpen');
        expect(style).toContain('attr(data-tab-label)');
        expect(style).toContain('.rt-so-search');
        expect(style).toContain('.rt-so-search-hidden');
        expect(style).toContain('.rt-so-search-hit');
        expect(style).toContain('rt-so-tab-has-match');
    });
});
