import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

describe('router settings during chat-open startup', () => {
    it('updates panels before the settings event bindings initialize', () => {
        const update = source.match(/function updateRouterConnectionPanels\(\) \{[\s\S]*?\n        \}/)?.[0];
        expect(update).toBeTruthy();

        const toggles = [];
        const $ = selector => ({
            val: () => 'profile',
            toggle: shown => toggles.push([selector, shown]),
        });

        // syncSettingsUi runs on a chat already open at boot. The original
        // function threw here because these const bindings were still in TDZ.
        expect(() => runInNewContext(`
            ${update}
            updateRouterConnectionPanels();
            const routerSourceSelect = $('#rpg_tracker_router_source');
            const routerProfileGroup = $('#rpg_tracker_router_profile_group');
            const routerOllamaGroup = $('#rpg_tracker_router_ollama_group');
            const routerOpenaiGroup = $('#rpg_tracker_router_openai_group');
        `, { $ })).not.toThrow();
        expect(toggles).toEqual([
            ['#rpg_tracker_router_profile_group', true],
            ['#rpg_tracker_router_ollama_group', false],
            ['#rpg_tracker_router_openai_group', false],
        ]);
    });
});
