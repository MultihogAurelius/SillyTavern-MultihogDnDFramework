import { describe, expect, it } from 'vitest';
import {
    parseCreateAreaMapCommand,
    stripCreateAreaMapCommand,
    createAreaMapCommandIsComplete,
    isMapArchitectTextOpener,
    normalizeMapArchitectOpener,
    MAP_ARCHITECT_TEXT_OPENER_RULES,
    MAP_ARCHITECT_TEXT_OPENER_CYOA_CAVEAT,
    MAP_ARCHITECT_OPENER_RADIO_NAMES,
    applyMapArchitectTextOpenerCyoaCaveat,
    buildMapArchitectContinueBrief,
    seedMapArchitectContinueText,
    clearAssistantReasoning,
} from '../map-architect-opener.js';

describe('Map Architect text opener', () => {
    it('parses keyed CREATE_AREA_MAP fences and discards prose after the block', () => {
        const parsed = parseCreateAreaMapCommand(`The doors of the abbey wait.

[CREATE_AREA_MAP]
site: Abbey Undercroft
entrance: Cellar Landing
kind: DUNGEON
scale: medium
premise: Abandoned crypt. Ghouls. Do not contradict the cracked west stair.
[/CREATE_AREA_MAP]

You step into a made-up throne room.`);

        expect(parsed.preamble).toBe('The doors of the abbey wait.');
        expect(parsed.args).toEqual({
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
            kind: 'DUNGEON',
            scale: 'MEDIUM',
            threat: 'HIGH',
            prompt: 'Abandoned crypt. Ghouls. Do not contradict the cracked west stair.',
            brief_description: 'Abandoned crypt.',
        });
        expect(createAreaMapCommandIsComplete(parsed.args)).toBe(true);

        const stripped = stripCreateAreaMapCommand(parsed.raw ? `The doors of the abbey wait.

[CREATE_AREA_MAP]
site: Abbey Undercroft
entrance: Cellar Landing
kind: DUNGEON
scale: MEDIUM
premise: Abandoned crypt. Ghouls. Do not contradict the cracked west stair.
[/CREATE_AREA_MAP]

You step into a made-up throne room.` : '');
        expect(stripped.text).toBe('The doors of the abbey wait.');
        expect(stripped.command.args.site).toBe('Abbey Undercroft');
    });

    it('accepts legacy JSON and multiline prompts', () => {
        const parsed = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
{"site":"Riverford","entrance":"North Gate","kind":"SETTLEMENT","scale":"LARGE","premise":"River town."}
[/CREATE_AREA_MAP]`);
        expect(parsed.args.kind).toBe('SETTLEMENT');
        expect(parsed.args.scale).toBe('LARGE');
        expect(parsed.args.site).toBe('Riverford');
        expect(parsed.args.threat).toBe('MODERATE');

        const multi = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
site: Riverford
entrance: Docks
kind: SETTLEMENT
premise: Line one
Line two
[/CREATE_AREA_MAP]`);
        expect(multi.args.prompt).toBe('Line one\nLine two');
        expect(multi.args.brief_description).toBe('Line one\nLine two');
        expect(stripCreateAreaMapCommand('[CREATE_AREA_MAP]\nsite: X\n[/CREATE_AREA_MAP]').text).toBe('\u200b');
    });

    it('accepts name/footer_root aliases and prose scale from a typical narrator fence', () => {
        const parsed = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
kind: DUNGEON
name: The Sunken Vault
footer_root: Rustmire Expanse, Salvage Ward, Buried Access Hatch 7
entrance: A rust-sealed circular hatch set into a cracked synthcrete apron; the shaft below drops into darkness.
scale: Small-to-medium buried pre-Fall installation, roughly 8–12 connected chambers over two levels.
premise: Local rumor claims an untouched cache of lost technology and salvage lies below, but the hatch has been shunned for cycles due to unstable structure, toxic seepage, and rumors of automated defenses.
[/CREATE_AREA_MAP]

(Status: 54/54 HP) | (XP: 0/23,000) | (Location: Rustmire Expanse, Salvage Ward, Buried Access Hatch 7)
Level 6 | 08:00 AM, Day 1`);

        expect(parsed.args).toEqual({
            site: 'Rustmire Expanse, Salvage Ward, Buried Access Hatch 7',
            entrance: 'A rust-sealed circular hatch set into a cracked synthcrete apron; the shaft below drops into darkness.',
            kind: 'DUNGEON',
            scale: 'MEDIUM',
            threat: 'HIGH',
            prompt: 'The Sunken Vault. Local rumor claims an untouched cache of lost technology and salvage lies below, but the hatch has been shunned for cycles due to unstable structure, toxic seepage, and rumors of automated defenses.',
            brief_description: 'The Sunken Vault.',
        });
        expect(createAreaMapCommandIsComplete(parsed.args)).toBe(true);
        expect(stripCreateAreaMapCommand(parsed.raw + '\n\nfooter').text).toBe('\u200b');
    });

    it('keeps the full generation prompt separate from the stored brief description', () => {
        const parsed = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
site: Ancestor Barrow
entrance: Sealed Western Passage
kind: DUNGEON
scale: LARGE
threat: DEADLY
prompt: The detailed private design can be as long as needed.
It includes history, inhabitants, hazards, routes, tone, and intended progression.
brief_description: An ancient barrow built around a sealed evil.
[/CREATE_AREA_MAP]`);

        expect(parsed.args.prompt).toBe('The detailed private design can be as long as needed.\nIt includes history, inhabitants, hazards, routes, tone, and intended progression.');
        expect(parsed.args.brief_description).toBe('An ancient barrow built around a sealed evil.');
        expect(createAreaMapCommandIsComplete(parsed.args)).toBe(true);
    });

    it('treats tool as the default opener and keeps text-mode prompt rules distinct', () => {
        expect(isMapArchitectTextOpener({})).toBe(false);
        expect(isMapArchitectTextOpener({ mapArchitectOpener: 'text' })).toBe(true);
        expect(normalizeMapArchitectOpener('TEXT')).toBe('text');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('threat (NONE, LOW, MODERATE, HIGH, or DEADLY)');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('Scale is geographic size');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('Use these exact field names');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('SETTLEMENT is the city/town/village as a whole');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('soft map editor');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('attach_to_site');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('without moving the player or first creating a BUILDING');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('places between mapped sites are not mapped');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('[MAPPED_SITES — INTERNAL]');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('three mapped levels');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('CYOA Mode');
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain(MAP_ARCHITECT_TEXT_OPENER_CYOA_CAVEAT);
        expect(MAP_ARCHITECT_TEXT_OPENER_RULES).toContain('runtime creates/promotes SUB*');
        expect(MAP_ARCHITECT_OPENER_RADIO_NAMES).toEqual([
            'rpg_map_architect_opener',
            'rpg_map_architect_opener_components',
            'rt_onboarding_map_architect_opener',
        ]);
        const wrapped = applyMapArchitectTextOpenerCyoaCaveat('<CYOA_mode>\nYou MUST ALWAYS end your response with exactly 5 choices.\n</CYOA_mode>');
        expect(wrapped.startsWith('<CYOA_mode>\n[MAP OPENER EXCEPTION]\n')).toBe(true);
        expect(wrapped).toContain(MAP_ARCHITECT_TEXT_OPENER_CYOA_CAVEAT);
        expect(wrapped).toContain('You MUST ALWAYS end your response with exactly 5 choices.');
        expect(applyMapArchitectTextOpenerCyoaCaveat(wrapped)).toBe(wrapped);
    });

    it('parses settlement include arrays and INTERIOR defaults in text mode', () => {
        const settlement = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
site: Rustport
entrance: Dock Gate
kind: SETTLEMENT
scale: MEDIUM
include: ["Flooded Sewers", "Guild Headquarters"]
premise: Coastal trade city.
[/CREATE_AREA_MAP]`);
        expect(settlement.args.include).toEqual(['Flooded Sewers', 'Guild Headquarters']);
        expect(settlement.args.threat).toBe('MODERATE');

        const interior = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
site: Guild Headquarters
entrance: Reception Hall
kind: INTERIOR
scale: SMALL
premise: A significant peaceful guild complex.
[/CREATE_AREA_MAP]`);
        expect(interior.args.kind).toBe('INTERIOR');
        expect(interior.args.threat).toBe('LOW');
    });

    it('parses an explicit offsite parent-map attachment', () => {
        const parsed = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
site: Cellar Crypt Dungeon
entrance: Crypt Threshold
kind: DUNGEON
scale: SMALL
threat: HIGH
attach_to_site: Malarkey Monument
attach_to_cell: Cellar Crypt
premise: A funerary complex extends beyond the western seal.
[/CREATE_AREA_MAP]`);
        expect(parsed.args.attachTo).toEqual({ site: 'Malarkey Monument', cell: 'Cellar Crypt' });
        expect(parsed.args.site).toBe('Cellar Crypt Dungeon');
    });

    it('parses a regenerate-turn fence with footer after the close tag', () => {
        const parsed = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
site: The Sunken Hatch
entrance: Rusty Hatch Cover
kind: DUNGEON
scale: MEDIUM
premise: Abandoned underground vault, rumored pre-Fall salvage; entry through a corroded hatch.
[/CREATE_AREA_MAP]

*(Status: 54/54) | (XP: 0/23,000) | (Location: Outer Verge, Rustmire Flats, The Sunken Hatch)*
*Level 6 | 08:05 AM, Day 1*`);
        expect(parsed.args.site).toBe('The Sunken Hatch');
        expect(parsed.args.entrance).toBe('Rusty Hatch Cover');
        expect(parsed.args.threat).toBe('HIGH');
        expect(createAreaMapCommandIsComplete(parsed.args)).toBe(true);
        expect(stripCreateAreaMapCommand(parsed.raw + '\n\nfooter').text).toBe('\u200b');
    });

    it('accepts danger/risk aliases and still treats omitted threat as optional', () => {
        const deadly = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
site: The Pit
entrance: Mouth
kind: DUNGEON
scale: SMALL
danger: deadly
premise: A meat-grinder vault.
[/CREATE_AREA_MAP]`);
        expect(deadly.args.threat).toBe('DEADLY');
        expect(createAreaMapCommandIsComplete(deadly.args)).toBe(true);

        const omitted = parseCreateAreaMapCommand(`[CREATE_AREA_MAP]
site: Quiet Ruin
entrance: Door
kind: DUNGEON
scale: LARGE
premise: Vast empty halls.
[/CREATE_AREA_MAP]`);
        expect(omitted.args.threat).toBe('HIGH');
        expect(createAreaMapCommandIsComplete(omitted.args)).toBe(true);
    });

    it('seeds a continue stub and clears leftover reasoning so ST cannot resume CoT', () => {
        expect(seedMapArchitectContinueText('\u200b', 'Rusty Hatch Cover')).toBe('The way through Rusty Hatch Cover is open.');
        expect(seedMapArchitectContinueText('<think>plan the dungeon</think>\n', 'Cellar Landing')).toBe('The way through Cellar Landing is open.');
        expect(seedMapArchitectContinueText('The doors wait.', 'Cellar Landing')).toBe('The doors wait.');
        const brief = buildMapArchitectContinueBrief({ entrance: 'Rusty Hatch Cover' });
        expect(brief).toContain('Rusty Hatch Cover');
        expect(brief).toContain('Do not write chain-of-thought');
        expect(brief).toContain('copy the exact CreateAreaMap site name into the Location footer');
        const message = {
            extra: { reasoning: 'long hidden plan', reasoning_duration: 12, reasoning_type: 'model', reasoning_signature: 'sig' },
            swipe_id: 0,
            swipe_info: [{ extra: { reasoning: 'swipe plan', reasoning_type: 'model' } }],
        };
        clearAssistantReasoning(message);
        expect(message.extra.reasoning).toBe('');
        expect(message.extra.reasoning_type).toBeUndefined();
        expect(message.swipe_info[0].extra.reasoning).toBe('');
    });
});
