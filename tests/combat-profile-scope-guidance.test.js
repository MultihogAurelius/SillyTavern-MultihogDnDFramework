import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_AGENT,
    DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_BASIC,
    resolveCombatProfileGuidance,
} from '../src/state/lorebook-runtime-fragments.js';

const fragmentSource = readFileSync(new URL('../src/state/lorebook-runtime-fragments.js', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');

describe('Combat Profile router guidance scopes to a single combatant', () => {
    it('explicitly forbids copying the COMBAT ROUND header, side headers, or other combatants into a Combat Profile', () => {
        expect(fragmentSource).toContain('CRITICAL — ONE COMBATANT PER PROFILE');
        expect(fragmentSource).toContain('NEVER copy the "COMBAT ROUND N" header, the ENEMIES:/NON-PARTY ALLIES: section headers, or any *other* combatant\'s block into it');
    });

    it('applies the same scope rule to both the agent (tool-call) and basic (text-format) guidance variants', () => {
        expect(DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_BASIC).toContain('CRITICAL — ONE COMBATANT PER PROFILE');
        expect(DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_AGENT).toContain('CRITICAL — ONE COMBATANT PER PROFILE');
        expect(DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_AGENT).toContain('Example (updating only "Schwarzenegev"');
        expect(DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_BASIC).toContain('[[UPDATE_CORE: Marcus Thorne');
        expect(routerSource).toContain('resolveCombatProfileGuidance(settings, !!(activeCombatBlock || partyMechanicalBlock), \'basic\')');
        expect(routerSource).toContain('resolveCombatProfileGuidance(settings, !!(activeCombatBlock || partyMechanicalBlock), \'agent\')');
    });

    it('replaces the old malformed comma-flattened example with one matching the real per-entity [COMBAT] stat block shape', () => {
        expect(fragmentSource).not.toContain('HP: 12, AC: 11, Fort +1, Ref +0, Will +4, weapons: ...');
        expect(fragmentSource).toContain('Marcus Thorne: 12/12 HP');
        expect(fragmentSource).toContain('Att/def: Longsword (1 attack, +5 / 1d8+2 Slashing) | Chainmail (AC: 15)');
    });

    it('injects Combat Profile guidance when combat or party mechanical stats are available', () => {
        expect(resolveCombatProfileGuidance({}, false, 'basic')).toBe('');
        expect(resolveCombatProfileGuidance({}, true, 'basic')).toContain('COMBAT PROFILE');
        expect(resolveCombatProfileGuidance({}, true, 'basic')).toContain('PARTY MECHANICAL STATE');
        expect(resolveCombatProfileGuidance({
            routerCombatProfileGuidanceBasicTemplate: 'CUSTOM BASIC COMBAT',
        }, true, 'basic')).toBe('CUSTOM BASIC COMBAT');
    });

    it('tells the agent to patch existing party Combat Profiles after level-up without inventing new ones', () => {
        expect(DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_BASIC).toContain('PARTY LEVEL SYNC');
        expect(DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_AGENT).toContain('Do NOT create a Combat Profile from [PARTY] if none exists');
        expect(routerSource).toContain('## PARTY MECHANICAL STATE');
        expect(routerSource).toContain('extractPartyBlock(settings.currentMemo)');
        expect(routerSource).toContain('${pcCharacterSeedSection}${activeCombatSection}${partyMechanicalSection}## NARRATIVE');
    });
});
