import { describe, expect, it } from 'vitest';
import {
    configureRuntimeActions,
    saveSettings,
    sectionPages,
} from '../runtime-bridge.js';
import { bindRenderedCardEvents } from '../card-events.js';
import { createDetachedPanel } from '../detached-panel.js';

describe('runtime bridge', () => {
    it('loads extracted UI modules without loading the application entry point', () => {
        expect(typeof bindRenderedCardEvents).toBe('function');
        expect(typeof createDetachedPanel).toBe('function');
    });

    it('binds the card-event module through configured runtime actions', () => {
        const calls = [];
        configureRuntimeActions({
            bindQuickStartEvents: (element) => calls.push(element),
            getPillDeselectHandler: () => null,
            setPillDeselectHandler: () => {},
            getSettings: () => ({}),
        });
        const root = {
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            contains: () => false,
        };

        globalThis.document = { addEventListener: () => {} };
        bindRenderedCardEvents(root, '');
        expect(calls).toEqual([root]);
        delete globalThis.document;
    });

    it('delegates feature-module actions to the configured application action', () => {
        const calls = [];
        configureRuntimeActions({
            saveSettings: (...args) => {
                calls.push(args);
                return 'saved';
            },
        });

        expect(saveSettings(true, 250)).toBe('saved');
        expect(calls).toEqual([[true, 250]]);
    });

    it('provides one shared page-state object for rendered-card views', () => {
        sectionPages.testPage = 3;
        expect(sectionPages.testPage).toBe(3);
        delete sectionPages.testPage;
    });
});
