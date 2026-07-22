import { describe, expect, it } from 'vitest';
import { createPanel } from '../panel-builder.js';
import { runtimeState } from '../runtime-state.js';

describe('panel builder', () => {
    it('loads independently from the application entry point', () => {
        expect(typeof createPanel).toBe('function');
        expect(runtimeState).toMatchObject({
            currentChatId: null,
            historyViewIndex: -1,
            renderedViewActive: false,
        });
    });
});
