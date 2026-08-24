import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPanelMarkup } from '../src/ui/panel/panel-markup.js';

describe('panel markup', () => {
    it('includes the tracker and Agent roots with supplied setting values', () => {
        const markup = buildPanelMarkup({
            agentPanelCollapsedClass: 'rt-panel-collapsed ',
            settings: {
                enabled: true,
                currentMemo: 'Saved memo',
                lastDelta: '',
                trackerTheme: 'rt-theme-native',
            },
        });

        expect(markup).toContain('id="rpg-tracker-enable-btn"');
        expect(markup).toContain('Disable Multihog Framework');
        expect(markup).not.toContain('id="rt-agent-router-enable-btn"');
        expect(markup).toContain('id="rpg-tracker-memo"');
        expect(markup).toContain('id="rt-bottom-xp-bar"');
        expect(markup).toContain('Saved memo');
        expect(markup).toContain('id="rpg-tracker-agent"');
        expect(markup).toContain('rt-panel-collapsed');
        expect(markup).toContain('id="rpg-tracker-settings-btn"');
        expect(markup).not.toContain('rpg-tracker-debug-btn');
        expect(markup.indexOf('rpg-tracker-settings-btn')).toBeLessThan(markup.indexOf('rpg-tracker-help-btn'));
        expect(markup).toContain('id="rt-agent-router-manual-run"');
        expect(markup).toContain('id="rt-research-lorebook"');
        expect(markup).toContain('id="rt-research-map-updater"');
        expect(markup).toContain('id="rt-research-map-evolution"');
        expect(markup).toContain('<b>Map Updater</b>');
        expect(markup).toContain('<b>Map Evolution</b>');
        expect(markup).toContain('id="rt-agent-map-evo-header"');
        expect(markup).toContain('id="rt-agent-map-evo-testing-ground"');
        expect(markup).toContain('id="rt-agent-map-evo-drawer"');
        expect(markup).toContain('id="rt-agent-map-evo-tick-scope"');
        expect(markup).toContain('id="rt-agent-world-locations"');
        expect(markup.indexOf('rt-agent-map-evo-header')).toBeLessThan(markup.indexOf('rt-agent-world-header'));
        expect(markup).toContain('Visuals/Map');
        expect(markup).not.toContain('>Visualization Mode<');
        expect(markup).toContain('id="rt-agent-terminal-tabs"');
        expect(markup).toContain('id="rt-agent-terminal-lorebook_agent"');
        expect(markup).toContain('id="rt-agent-terminal-state_tracker"');
        expect(markup).toContain('id="rt-agent-terminal-map_updater"');
        expect(markup).toContain('id="rt-agent-terminal-map_evolution"');
        expect(markup).toContain('id="rt-agent-terminal-map_architect"');
        expect(markup).toContain('id="rt-agent-terminal-log-history"');
        expect(markup).toContain('Terminal/Direct Prompt');
        expect(markup).toContain('id="rt-terminal-direct-lorebook_agent"');
        expect(markup).toContain('id="rt-terminal-direct-map_evolution"');
        expect(markup).toContain('id="rt-terminal-direct-map_architect"');
        expect(markup).not.toContain('Lorebook Terminal:');
        expect(markup).not.toContain('id="rt-agent-prompt-btn"');
        expect(markup).not.toContain('id="rt-agent-prompt-bar"');
    });

    it('renders Map Evolution and World Progression agent controls from settings', () => {
        const markup = buildPanelMarkup({
            agentPanelCollapsedClass: '',
            settings: {
                enabled: true,
                currentMemo: '',
                lastDelta: '',
                agentMapEvolutionOpen: true,
                mapEvolutionEnabled: true,
                mapEvolutionIntervalHours: 6,
                mapEvolutionOnSiteIntervalHours: 2,
                mapEvolutionTickScope: 'count',
                mapEvolutionTickCount: 2,
                mapEvolutionTickRandomize: false,
                agentWorldOpen: true,
                worldProgressionEnabled: true,
                worldProgressionIntervalHours: 12,
                worldProgressionLocationsPerReport: 5,
            },
        });

        expect(markup).toContain('id="rt-agent-map-evo-interval" value="6"');
        expect(markup).toContain('id="rt-agent-map-evo-onsite-interval" value="2"');
        expect(markup).toContain('id="rt-agent-map-evo-tick-count" value="2"');
        expect(markup).toContain('option value="count" selected');
        expect(markup).toContain('id="rt-agent-map-evo-n-row" style="display:flex;');
        expect(markup).toContain('id="rt-agent-world-locations" value="5"');
        expect(markup).toContain('id="rt-agent-world-interval" value="12"');
    });

    it('opens the Context Debugger from the wand menu, not the tracker header', () => {
        const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
        expect(index).toContain("debugBtn.id = 'rpg_tracker_debug_wand_button'");
        expect(index).toContain('Multihog Context Debugger');
        expect(index).toContain('fa-screwdriver-wrench');
        expect(index).toContain('initializeDebugViewer()');
        expect(index).toContain('toggleDebugViewer()');
        expect(index.indexOf('toggle_rpg_tracker_wand_button')).toBeLessThan(index.indexOf('rpg_tracker_debug_wand_button'));
        expect(settingsMarkup).toContain('Multihog Context Debugger');
        const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        const contentRule = style.slice(style.indexOf('.rpg-debug-content {'), style.indexOf('.rpg-debug-empty'));
        expect(contentRule).toContain('min-height: 0');
        expect(contentRule).toContain('overflow-y: scroll');
        expect(style).toContain('rpg-debug-section-toggle');
    });
});
