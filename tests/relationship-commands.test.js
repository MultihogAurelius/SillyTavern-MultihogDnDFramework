import { describe, expect, it } from 'vitest';
import { extractStateTrackerRelationshipCommands } from '../src/state/relationship-commands.js';

describe('State Tracker relationship commands', () => {
    it('extracts relationship commands while leaving the State Memo intact', () => {
        const result = extractStateTrackerRelationshipCommands(`[TIME]Day 3[/TIME]
[RELATIONS]
Friendship +4 Marcus Thorne
Affection -2 Elena Brightforge
Affection+3 Tamsin Vale
[/RELATIONS]`);

        expect(result).toEqual({
            memo: '[TIME]Day 3[/TIME]',
            commands: [
                { type: 'relationship_delta', npc: 'Marcus Thorne', field: 'friendship', delta: 4 },
                { type: 'relationship_delta', npc: 'Elena Brightforge', field: 'affection', delta: -2 },
                { type: 'relationship_delta', npc: 'Tamsin Vale', field: 'affection', delta: 3 },
            ],
        });
    });

    it('rejects malformed commands and leaves plain State Memo output unchanged', () => {
        expect(extractStateTrackerRelationshipCommands(`[RELATIONS]
Friendship +0 Elena
Affection hello Marcus
Trust +2 Tamsin
[/RELATIONS]`)).toEqual({ memo: '', commands: [] });
        expect(extractStateTrackerRelationshipCommands('[TIME]Day 3[/TIME]')).toEqual({ memo: '[TIME]Day 3[/TIME]', commands: [] });
    });
});
