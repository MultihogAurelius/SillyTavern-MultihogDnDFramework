import { describe, expect, it } from 'vitest';
import {
    GAME_MASTER_CARD_NAME,
    buildGameMasterCharacterCreatePayload,
    findCharacterByName,
    normalizeCharacterName,
    resolveNarratorCardName,
} from '../src/ui/game-master-card-lib.js';

describe('Game Master card helper', () => {
    it('normalizes character names for lookup', () => {
        expect(normalizeCharacterName(' Game Master ')).toBe('game master');
        expect(normalizeCharacterName('')).toBe('');
    });

    it('finds an existing Game Master card case-insensitively', () => {
        const chars = [{ name: 'Hero' }, { name: 'game master', avatar: 'gm.png' }];
        expect(findCharacterByName(chars, GAME_MASTER_CARD_NAME)?.avatar).toBe('gm.png');
        expect(findCharacterByName(chars, 'Missing')).toBeNull();
    });

    it('builds an empty narrator payload named Game Master', () => {
        const payload = buildGameMasterCharacterCreatePayload();
        expect(payload.ch_name).toBe('Game Master');
        expect(payload.description).toBe('');
        expect(payload.first_mes).toBe('');
        expect(payload.personality).toBe('');
        expect(payload.scenario).toBe('');
        expect(payload.creator_notes).toBe('');
    });

    it('falls back to Game Master when the narrator name is blank', () => {
        expect(resolveNarratorCardName('')).toBe(GAME_MASTER_CARD_NAME);
        expect(resolveNarratorCardName('   ')).toBe(GAME_MASTER_CARD_NAME);
        expect(resolveNarratorCardName('Dungeon Master')).toBe('Dungeon Master');
    });
});
