import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanMessageContent } from '../memo-processor.js';

describe('Lorebook Agent dungeon-map filtering', () => {
    it('removes private map payloads while preserving visible narration', () => {
        const cleaned = cleanMessageContent({
            mes: `The chamber smells of dust.
<div hidden data-dungeon-map>
Dungeon Site: Varnholde Crypts
Area: Secret Reliquary
A shade guards an undiscovered key.
</div hidden>
The altar is visibly scorched.`,
        });

        expect(cleaned).toContain('The chamber smells of dust.');
        expect(cleaned).toContain('The altar is visibly scorched.');
        expect(cleaned).not.toContain('Secret Reliquary');
        expect(cleaned).not.toContain('undiscovered key');
    });

    it('keeps [MAP] out of Lorebook Agent context and defers occupancy to Map Updater', () => {
        const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
        const hookSource = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
        const immersionSource = readFileSync(new URL('../immersion.js', import.meta.url), 'utf8');
        const defaultsSource = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');
        const updaterSource = readFileSync(new URL('../map-updater.js', import.meta.url), 'utf8');
        const updaterPrompt = readFileSync(new URL('../map-updater-prompt.js', import.meta.url), 'utf8');
        expect(routerSource).toContain('getDungeonMapAttachment(entry)');
        expect(routerSource).toContain('stripDungeonMapSection(entry.content)');
        expect(routerSource).not.toContain("name: 'inspect_map'");
        expect(routerSource).not.toContain('commitProperties.map');
        expect(routerSource).toContain('formatMappedSiteAgentNote');
        expect(routerSource).toContain('Map occupancy (areas, assets, routes, interiors) is maintained by the Map Updater');
        expect(routerSource).toContain('LOCATION_FOOTER_LAG_NOTE');
        expect(hookSource).toContain('syncDungeonLoreAgentActivation');
        expect(hookSource).toContain('buildMappedSitesInjection');
        expect(hookSource).toContain('stripDungeonRealityBlocksFromPrompt');
        expect(hookSource).toContain('runMapUpdaterPass');
        expect(routerSource).toContain('const dungeonRealityEnabled = isLocationMappingEnabled');
        expect(immersionSource).toContain('isLocationMappingEnabled(s)');
        expect(defaultsSource).toContain('private \\`[MAP]...[/MAP]\\`');
        expect(defaultsSource).toContain('maintained by the Map Updater');
        expect(updaterSource).toContain('MAX_CORRECTION_ATTEMPTS = 2');
        expect(updaterSource).toContain('applyActiveDungeonMapCommit');
        expect(updaterPrompt).toContain('ADD_ASSET kind BUILDING, knowledge KNOWN');
        expect(updaterPrompt).toContain('Never write transient combat into asset.detail or chronicles');
        expect(updaterPrompt).toContain('{"noop":true}');
        expect(updaterPrompt).toContain('People are CREATURE or GROUP, never kind NPC');
        expect(defaultsSource).not.toContain('KNOWN OBJECT asset in that district');
    });
});
