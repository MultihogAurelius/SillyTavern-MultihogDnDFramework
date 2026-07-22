/**
 * Default router module definitions (single source of truth for reset logic).
 * npc/loc/fac `instruction` are getters so module init does not call getSettings
 * before the settings-ref bind / re-entrancy guard is ready.
 */

import { buildNpcInstruction, buildLocInstruction, buildFacInstruction } from './module-instructions.js';

export const DEFAULT_MODULES = {
    npc: {
        enabled: true,
        tag: 'NPC',
        format: 'Name | Description | Keywords',
        get instruction() { return buildNpcInstruction(); },
    },
    loc: {
        enabled: true,
        tag: 'LOC',
        format: 'Name | Description | Keywords',
        get instruction() { return buildLocInstruction(); },
    },
    fac: {
        enabled: true,
        tag: 'FAC',
        format: 'Name | Status | Description | Keywords',
        get instruction() { return buildFacInstruction(); },
    },
    quest: { enabled: true, tag: 'QUEST', format: 'Name | Location | Description | Keywords', instruction: 'ONLY record a quest if the player unambiguously begins to pursue a quest. A quest being mentioned, offered, or entertained by the player is NOT enough.' },
    event: { enabled: true, tag: 'EVENT', format: 'Name | Details | Keywords', instruction: 'Significant narrative events. The Name is a SHORT, STABLE identifier (e.g. "Siege of Ashford") — no timestamps in the name, no "Final"/"Update" suffixes. Put timestamps in the Details field. Reuse the exact same Name when adding new information — entries are chronicles that accumulate automatically. COMBAT GRANULARITY: Do NOT record turn-by-turn status, round-by-round HP changes, or granular actions. For long combats, limit updates to the initiation (e.g., when they became hostile and attacked {{user}}), a high-level progress update every ~5 rounds to capture major shifts, and the final resolution.' },
    world: { enabled: false, tag: 'WORLD', format: 'Name | Details | Keywords', instruction: 'World Progression reports tracking off-screen NPC actions and events. Name must be the time period (e.g. "Day 1", "Week 1 (Days 1-7)").' },
};
