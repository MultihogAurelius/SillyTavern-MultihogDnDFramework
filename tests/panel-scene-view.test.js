import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSceneViewController } from '../src/ui/panel/panel-scene-view.js';
import { captureDungeonMapViewport, restoreDungeonMapViewport } from '../src/ui/panel/dungeon-map-panel.js';
import { runtimeState } from '../src/app/runtime-state.js';

afterEach(() => {
    delete globalThis._rpgRefreshImmersionView;
    delete globalThis._rpgCheckRealtimeSceneArt;
    delete globalThis._rpgSyncAgentImmersionUi;
    runtimeState.hasActiveDungeonMap = false;
});

function mountController(settings, extra = {}) {
    const immersion = { style: {} };
    const manifest = { style: {} };
    const records = { classList: { toggle: () => {} }, setAttribute: () => {} };
    const visualization = { classList: { toggle: () => {} }, setAttribute: () => {} };
    const switcher = { style: {} };
    const title = { style: {} };
    const elements = new Map([
        ['#rt-agent-immersion-view', immersion],
        ['#rt-agent-manifest-list', manifest],
        ['#rt-agent-view-mode-records', records],
        ['#rt-agent-view-mode-visualization', visualization],
        ['#rt-agent-view-mode-switch', switcher],
        ['#rt-agent-campaign-header-title', title],
    ]);
    const controller = createSceneViewController({
        agentPanel: { querySelector: (selector) => elements.get(selector) || null, style: {} },
        buildImmersionSceneState: async () => ({}),
        getSettings: () => settings,
        loadLocationEntryByPath: async () => null,
        loadNpcEntryByKey: async () => null,
        maybeAutoGenerateImmersionSceneArt: () => {},
        renderImmersionViewHtml: () => '',
        runRealtimeSceneArtCheck: async () => {},
        showLocationImageSettingsMenu: async () => {},
        ...extra,
    });
    return { controller, immersion, manifest, switcher, title };
}

describe('Scene View controller', () => {
    it('opens location image controls directly from the Visuals/Map hero image', () => {
        const source = readFileSync(new URL('../src/ui/panel/panel-scene-view.js', import.meta.url), 'utf8');
        const heroStart = source.indexOf("const hero = root.querySelector('.rt-immersion-hero-wrap')");
        const npcStart = source.indexOf("root.querySelectorAll('.rt-immersion-npc-tile')", heroStart);
        const heroHandler = source.slice(heroStart, npcStart);
        expect(heroHandler).toContain('await showLocationImageSettingsMenu(');
        expect(heroHandler).not.toContain('_rpgAgentOpenLocationDetail');
    });

    it('restores a map graph viewport after the refresh replaces its scroll container', () => {
        const original = { scrollLeft: 284, scrollTop: 96 };
        const replacement = { scrollLeft: 0, scrollTop: 0 };
        const beforeRefresh = {
            querySelectorAll: () => [original],
        };
        const afterRefresh = {
            querySelectorAll: () => [replacement],
        };

        const viewport = captureDungeonMapViewport(beforeRefresh);
        restoreDungeonMapViewport(afterRefresh, viewport);

        expect(replacement.scrollLeft).toBe(284);
        expect(replacement.scrollTop).toBe(96);
    });

    it('keeps the Records view visible when location images are disabled and no map is active', () => {
        const settings = { locationImages: false, agentImmersionMode: true };
        const { controller, immersion, manifest, switcher, title } = mountController(settings);

        controller.syncAgentImmersionUi();

        expect(settings.agentImmersionMode).toBe(true);
        expect(immersion.style.display).toBe('none');
        expect(manifest.style.display).toBe('flex');
        expect(switcher.style.display).toBe('none');
        expect(title.style.display).toBe('block');
    });

    it('shows Visuals/Map when a mapped site is active even without location images', () => {
        runtimeState.hasActiveDungeonMap = true;
        const settings = { locationImages: false, agentImmersionMode: true };
        const { controller, immersion, manifest, switcher, title } = mountController(settings);

        controller.syncAgentImmersionUi();

        expect(immersion.style.display).toBe('flex');
        expect(manifest.style.display).toBe('none');
        expect(switcher.style.display).toBe('');
        expect(title.style.display).toBe('none');
    });
});
