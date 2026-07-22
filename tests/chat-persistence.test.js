import { describe, expect, it, beforeEach } from 'vitest';
import { getSettings, saveChatState, snapshotStockPromptsForProfile } from '../state-manager.js';
import { testExtensionSettings } from './setup.js';

describe('saveChatState', () => {
    beforeEach(() => {
        for (const key of Object.keys(testExtensionSettings)) {
            delete testExtensionSettings[key];
        }
    });

    it('snapshots stock prompts via snapshotStockPromptsForProfile without throwing', () => {
        const s = getSettings();
        s.chatLinkEnabled = true;
        s.currentMemo = 'test-memo';
        s.modules = { character: true };
        s.stockPrompts = { character: 'custom prompt' };

        expect(() => saveChatState('vitest-chat', { skipDiskWrite: true })).not.toThrow();

        const part = getSettings().chatStates['vitest-chat'];
        expect(part.currentMemo).toBe('test-memo');
        expect(part.stockPrompts.character).toBe('custom prompt');
        // merged with defaults — more keys than the one override
        expect(Object.keys(part.stockPrompts).length).toBeGreaterThan(1);
        expect(snapshotStockPromptsForProfile({ character: 'x' }).character).toBe('x');
    });
});
