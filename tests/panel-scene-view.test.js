import { afterEach, describe, expect, it } from 'vitest';
import { createSceneViewController } from '../panel-scene-view.js';

afterEach(() => {
    delete globalThis._rpgRefreshImmersionView;
    delete globalThis._rpgCheckRealtimeSceneArt;
    delete globalThis._rpgSyncAgentImmersionUi;
});

describe('Scene View controller', () => {
    it('keeps the Records view visible when location images are disabled', () => {
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
        const settings = { locationImages: false, agentImmersionMode: true };

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
        });

        controller.syncAgentImmersionUi();

        expect(settings.agentImmersionMode).toBe(false);
        expect(immersion.style.display).toBe('none');
        expect(manifest.style.display).toBe('flex');
        expect(switcher.style.display).toBe('none');
        expect(title.style.display).toBe('block');
    });
});
