import { describe, expect, it } from 'vitest';
import {
    PANEL_BG_AGENT_KEYS,
    PANEL_BG_TRACKER_KEYS,
    getPanelBgConfig,
} from '../panel-appearance.js';

describe('panel appearance settings', () => {
    it('uses the correct tracker and agent storage keys', () => {
        expect(PANEL_BG_TRACKER_KEYS.dayKey).toBe('panelBgImage');
        expect(PANEL_BG_AGENT_KEYS.dayKey).toBe('agentPanelBgImage');
    });

    it('falls back to one supplied image and clamps overlay strength', () => {
        const config = getPanelBgConfig({
            panelBgImage: 'day-image',
            panelBgImageNight: '',
            panelBgOverlayStrength: 150,
        }, PANEL_BG_TRACKER_KEYS);

        expect(config).toEqual({
            daySrc: 'day-image',
            nightSrc: 'day-image',
            strength: 1,
            hasImage: true,
        });
    });
});
