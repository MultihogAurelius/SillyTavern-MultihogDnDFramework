import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractCharacterBlock, extractPartyBlock } from '../src/state/router-utils.js';

const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
const defaultsSource = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');
const persistenceSource = readFileSync(new URL('../src/state/chat-persistence.js', import.meta.url), 'utf8');
const loaderSource = readFileSync(new URL('../src/features/chat/chat-state-loader.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const characterCreatorSource = readFileSync(new URL('../character-creator.js', import.meta.url), 'utf8');

describe('extractCharacterBlock', () => {
    it('extracts a [CHARACTER] block from the memo', () => {
        const memo = '[TIME]Day 1[/TIME]\n[CHARACTER]\nHero: 10/10 HP\nGear: Sword [E]\n[/CHARACTER]\n[XP]1[/XP]';
        expect(extractCharacterBlock(memo)).toBe('[CHARACTER]Hero: 10/10 HP\nGear: Sword [E][/CHARACTER]');
    });

    it('returns null when the block is missing', () => {
        expect(extractCharacterBlock('[TIME]Day 1[/TIME]')).toBeNull();
        expect(extractCharacterBlock('')).toBeNull();
        expect(extractCharacterBlock(null)).toBeNull();
    });
});

describe('extractPartyBlock', () => {
    it('extracts a [PARTY] block from the memo', () => {
        const memo = '[CHARACTER]Hero[/CHARACTER]\n[PARTY]\nElara (Ranger): 26/45 HP\nCombat: BAB: +3\n[/PARTY]\n[XP]1[/XP]';
        expect(extractPartyBlock(memo)).toBe('[PARTY]Elara (Ranger): 26/45 HP\nCombat: BAB: +3[/PARTY]');
    });

    it('returns null when the block is missing', () => {
        expect(extractPartyBlock('[CHARACTER]Hero[/CHARACTER]')).toBeNull();
        expect(extractPartyBlock('')).toBeNull();
        expect(extractPartyBlock(null)).toBeNull();
    });
});

describe('cold-start PC [CHARACTER] seed wiring', () => {
    it('defaults pcCharacterBlockSeeded to false', () => {
        expect(defaultsSource).toContain('pcCharacterBlockSeeded: false');
    });

    it('persists and restores the flag per chat', () => {
        expect(persistenceSource).toContain('pcCharacterBlockSeeded: !!s.pcCharacterBlockSeeded');
        expect(loaderSource).toContain('s.pcCharacterBlockSeeded = !!saved.pcCharacterBlockSeeded');
        expect(indexSource).toContain('s.pcCharacterBlockSeeded = false');
    });

    it('injects the CHARACTER block once on the first runRouterPass into both prompts', () => {
        expect(routerSource).toContain('if (!settings.pcCharacterBlockSeeded)');
        expect(routerSource).toContain('## PLAYER CHARACTER SHEET (initial reference — one-time)');
        expect(routerSource).toContain('settings.pcCharacterBlockSeeded = true');
        expect(routerSource).toContain('${pcCharacterSeedSection}${activeCombatSection}${partyMechanicalSection}## NARRATIVE');
        // Both basic and agent user prompts include the seed section placeholder.
        const seedUsages = routerSource.match(/\$\{pcCharacterSeedSection\}/g) || [];
        expect(seedUsages.length).toBeGreaterThanOrEqual(2);
    });
});

describe('Player Card approval responsiveness', () => {
    it('does not block approval on the Campaign Records refresh', () => {
        expect(characterCreatorSource).toContain('void refreshAgentManifestNow().catch(error =>');
        expect(characterCreatorSource).not.toContain('await refreshAgentManifestNow();');
    });
});
