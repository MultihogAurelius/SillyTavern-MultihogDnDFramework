import { describe, expect, it } from 'vitest';
import { assertCharacterGenerationUpdatedMemo } from '../src/state/character-generation-validation.js';

describe('Character Creator memo validation', () => {
    it('accepts a committed new CHARACTER block', () => {
        expect(() => assertCharacterGenerationUpdatedMemo(
            '',
            '[CHARACTER]\nAria: 12/12 HP\n[/CHARACTER]',
            { changed: true },
        )).not.toThrow();
    });

    it('reports an unchanged tracker result instead of continuing with stale state', () => {
        expect(() => assertCharacterGenerationUpdatedMemo(
            '[CHARACTER]\nOld: 8/8 HP\n[/CHARACTER]',
            '[CHARACTER]\nOld: 8/8 HP\n[/CHARACTER]',
            { changed: false, message: 'State Tracker made no changes.' },
        )).toThrow(/response may have been truncated/i);
    });

    it('rejects a changed memo that still has no CHARACTER block', () => {
        expect(() => assertCharacterGenerationUpdatedMemo(
            '',
            '[TIME]\nDay 1, 08:00\n[/TIME]',
            { changed: true },
        )).toThrow(/no character sheet/i);
    });
});
