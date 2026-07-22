import { describe, expect, it } from 'vitest';
import { buildPanelMarkup } from '../panel-markup.js';

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

        expect(markup).toContain('id="rpg-tracker-memo"');
        expect(markup).toContain('Saved memo');
        expect(markup).toContain('id="rpg-tracker-agent"');
        expect(markup).toContain('rt-panel-collapsed');
    });
});
