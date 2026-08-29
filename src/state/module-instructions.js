/**
 * NPC / LOC / FAC module instruction builders + rebuild helper.
 */

import { getSettings } from './settings-ref.js';
import { DEFAULT_NPC_SECTIONS } from './schema-sections.js';
import { getNpcRelationshipMax } from './relationship-math.js';
import { buildNpcRelationshipInstruction } from './relationship-prompts.js';

/** Passed as the Lorebook Agent Direct Prompt during Full Audit so color markup survives CORE rewrites. */
export const LOREBOOK_FULL_AUDIT_INSTRUCTION = 'FULL AUDIT: Reconstruct lore from this history chunk. Preserve existing <font color=...> tags and hex color codes already stored in [CORE] (including custom color sections). When writing color markup, use unquoted hex only: <font color=#RRGGBB>text</font> — never color="#RRGGBB" (quoted attributes break JSON tool calls). Do not strip color markup down to plain text.';

export function buildNpcInstruction(majorWords = 225, minorWords = 135, ignoreLimits = false, passedSettings = null) {
    let settings = passedSettings || {};
    if (!passedSettings) {
        try {
            settings = getSettings() || {};
        } catch (_) {}
    }
    let useDdMmYy = !!settings.useDdMmYyFormat;
    
    let coreSections = settings.npcCoreSections;
    if (!coreSections || !Array.isArray(coreSections) || coreSections.length === 0) {
        coreSections = DEFAULT_NPC_SECTIONS;
    }
    const sectionsList = coreSections.map(s => s.name).join(', ');
    const sectionsTemplate = coreSections.map(s => `${s.name}: ${s.description}`).join('\n');

    let instruction = `Significant named characters the party interacts with (do NOT record every random enemy or nameless bartender, only characters who are significant). A creature's class/tier label (e.g. "Skeleton," "Bandit," "Guard Captain") is not itself a name, and having [COMBAT] stats or being the party's current opponent is not, by itself, evidence of significance — that comes from being treated as a recurring individual with motive, backstory, or a stake the story cares about.
Do NOT create an NPC entry for the player character (controlled by the user) under any circumstances.
In the chat history, the player character is the speaker labeled "Player" (and prompt replacement "{{user}}"). Analyze the dialogue to identify what in-character roleplay name(s) or alias(es) other characters use when addressing or referring to the "Player" (for example, if they call the Player "Dave Davidson" or "Dave", then "Dave Davidson" is the player character).
Under no circumstances should you create an NPC entry for the player character, regardless of whether they are referred to as "Player", "{{user}}", or by their actual in-character name/alias (like "Dave Davidson").
Always use the exact macro string \`{{user}}\` when referring to the player character in EVENT, QUEST, or NPC relationship descriptions; do NOT write the plain word "user" or "player" or their actual character name in entry contents.
You MAY update the Player Character's own Body via [[UPDATE_APPEARANCE: {{user}} | new body text]] (or commit.appearance with id "{{user}}") when their signature look permanently changes, and their Worn Equipment via [[UPDATE_EQUIPMENT: {{user}} | new worn gear text]] (or commit.equipment) whenever their visibly worn/carried gear changes — never create a PC lorebook entry, and never edit the PC's Species/Personality/Background/Habits/Strengths/Flaws.

<CORE_FORMAT — NPC only>
IMPORTANT: The Description field inside the [[ ]] tags MUST start directly with the [CORE] tag. Do NOT prepend any timestamps, dates, or other text before the [CORE] tag under any circumstances (e.g. do NOT write "[4:47 PM, ${useDdMmYy ? '01/01/2026' : 'Day 1'}] [CORE]" or "[${useDdMmYy ? 'DD/MM/YYYY' : 'Day X'}, HH:MM] [CORE]"). The very first character of the Description MUST be the "[" of the "[CORE]" tag. Wrap the identity sections (${sectionsList}) inside a single \`[CORE]\` and \`[/CORE]\` tag block.

CRITICAL — [CORE] is permanent identity, still true after this arc ends. Extrapolate enduring traits from behavior; never recap this turn, voyage, or crisis.
BANNED in [CORE]: momentary actions/states; plot progress ("increasingly…", "first to notice…", "this voyage"); roles defined by ongoing events ("crewman on X who became unhinged by Y"). Scene facts go in timestamped lines after [/CORE] only.

[CORE]
${sectionsTemplate}
[/CORE]

After the [/CORE] block, append timestamped narrative updates as usual ([${useDdMmYy ? 'DD/MM/YYYY' : 'Day X'}, HH:MM] ...).
</CORE_FORMAT>
## CORE IDENTITY UPDATES
- Body: use [[UPDATE_APPEARANCE: Book::UID or Name | new body text]] (or commit.appearance). Body is the character's signature/default physical look — not a transient outfit-of-the-scene.
- Worn Equipment: use [[UPDATE_EQUIPMENT: Book::UID or Name | new worn gear text]] (or commit.equipment) whenever the narrative explicitly shows a change to what they're wearing/wielding. Worn Equipment is visibly worn/carried gear only — not coins, loot piles, or inventory lists.
- Combat Profile: use [[UPDATE_CORE: Book::UID or Name | Combat Profile | new text]] when ## ACTIVE COMBAT STATE provides updated combatant stats, or when ## PARTY MECHANICAL STATE shows lasting progression (level-up) for a party NPC who already has a Combat Profile.
- Species, Personality, Brief Background, Habits/Behaviors, Strengths, Flaws: do NOT spontaneously rewrite these on an automatic pass. Only update them when the user gave an explicit Direct Prompt / instruction this turn (they require broader context than a two-message window provides). Species in particular should almost never change after an NPC is first recorded.
Do NOT log core updates as normal event/update entries.
For notable existing-NPC moments that do not change any [CORE] field, still append a timestamped chronicle/EVENT line so the beat is not lost.
COLOR MARKUP: If a [CORE] field uses <font color=#RRGGBB>text</font> or a dedicated hex/color section, preserve those tags exactly. Write unquoted hex attributes only (<font color=#RRGGBB>, never color="#RRGGBB"). Never strip color markup down to plain text.`;

    let enableRelBars = !!settings.npcRelationshipBars;

    if (enableRelBars) {
        instruction += `\n\n${buildNpcRelationshipInstruction(getNpcRelationshipMax(settings))}`;
    }

    instruction += `\n\nBe concise and functional — every word should serve gameplay or characterization. Avoid adjective dumps and purple prose.`;

    if (!ignoreLimits) {
        instruction += `\n\n<CORE LENGTH TARGETS>
Major NPCs (recurring, plot-important): the [CORE] block's sections must together total exactly ${majorWords} words. Distribute freely across sections based on what each NPC needs — do not pad every section to match the longest one.
Minor NPCs (shopkeepers, guards, one-off encounters): the [CORE] block's sections must together total exactly ${minorWords} words. Distribute freely across sections based on what each NPC needs — do not pad every section to match the longest one.
</CORE_LENGTH TARGETS>`;
    }


    instruction += `\n\n<COMBAT_GRANULARITY>
Do NOT record per-round combat updates (e.g., creature HP changes, turn-by-turn action lists, temporary conditions mid-fight). For long combats, limit updates to the initiation of combat (e.g., when they became hostile and attacked {{user}}), a high-level progress update every ~5 rounds (to capture major shifts or stalemates), and the final resolved outcome once it concludes.
</COMBAT_GRANULARITY>

<COMBAT_PROFILE_PERSISTENCE>
TRIGGER — Combat Profile is a HIDDEN field. Write or patch it from mechanical blocks only, never from GM prose:
- \`## ACTIVE COMBAT STATE\` with a \`[COMBAT]\` block for this NPC → create or fully replace the Combat Profile with that combatant's own stat block, verbatim.
- \`## PARTY MECHANICAL STATE\` with a \`[PARTY]\` sheet for this NPC → only if a Combat Profile already exists in [CORE], patch lasting combat stats (max HP, BAB/APR, attack totals, AC, saves, attributes, HD, new class features/abilities) to match the sheet. Typical trigger: PARTY LEVEL SYNC / level-up. Keep the existing Combat Profile block shape. Do NOT create a Combat Profile from [PARTY] if none exists. Do NOT rewrite a profile solely because current HP, temp HP, status, or spell-slot ticks changed.
If neither mechanical section applies to this NPC, leave Combat Profile absent / unchanged.

CONTENT — When a [COMBAT] block IS present, transcribe it completely and verbatim into \`Combat Profile:\` inside [CORE]. Include every declared stat: HP, AC, attack bonus, damage, saves, weapons, abilities, special traits — everything the [COMBAT] block lists. Do NOT condense, summarize, or hand-pick a subset. The goal is a faithful copy, not an interpretation.

UPDATE — If a Combat Profile already exists in [CORE] and a mechanical source for the same NPC appears with updated lasting stats, patch the Combat Profile line in place. Do not touch any other [CORE] field. For an EXISTING lorebook NPC, use [[UPDATE_CORE: NPC Name | Combat Profile | ...]] (basic mode) or commit core (agent mode) — do NOT re-emit a full [[NPC:...]] record or embed a new [CORE] block in a chronicle update.

PLACEMENT — Combat Profile is IDENTITY data, not a chronicle event. It belongs as its own labeled line inside [CORE] (e.g. immediately before the closing [/CORE] tag) — never as a timestamped delta line, and never appended after [/CORE].
</COMBAT_PROFILE_PERSISTENCE>`;
    return instruction;
}

/**
 * Builds the LOC module instruction string (plain [CORE] for places — no NPC field headers).
 * @param {object} [passedSettings]
 * @returns {string}
 */
export function buildLocInstruction(passedSettings = null) {
    let settings = passedSettings || {};
    if (!passedSettings) {
        try {
            settings = getSettings() || {};
        } catch (_) {}
    }
    let useDdMmYy = !!settings.useDdMmYyFormat;
    let coreSections = DEFAULT_NPC_SECTIONS;
    if (settings.npcCoreSections && Array.isArray(settings.npcCoreSections) && settings.npcCoreSections.length > 0) {
        coreSections = settings.npcCoreSections;
    }
    const sectionsList = coreSections.map(s => s.name).join(', ');

    return `Named places and sub-locations. The Name MUST be the full hierarchical path using " :: " as the separator (e.g. "Khelt :: Rust-Lantern District :: Marrow-Deep Mines Office"). Include each ancestor name as a keyword (e.g. "Khelt", "Rust-Lantern District", "mines").

<CORE_FORMAT — LOC only>
When FIRST recording a location, wrap a short permanent description (1–2 sentences: what the place is, notable features, typical atmosphere) inside a plain \`[CORE]\` … \`[/CORE]\` block. Do NOT use NPC field headers (${sectionsList}) — those structured sections are NPC-only.

Correct:
[CORE]
A well-worn dusty track through Mulgore's golden savannah, lined with sparse trees; the main trade route to Thunder Bluff.
[/CORE]

Wrong:
[CORE]
${coreSections[0] ? coreSections[0].name : 'Appearance'}: A dusty track...
${coreSections[1] ? coreSections[1].name : 'Personality'}: A vital artery...
[/CORE]

The Description MUST start directly with \`[CORE]\`. Do NOT prepend timestamps before the opening tag (e.g. do NOT write "[${useDdMmYy ? '01/01/2026' : 'Day 1'}, 08:00] [CORE]").
After \`[/CORE]\`, append timestamped deltas when the place changes ([${useDdMmYy ? 'DD/MM/YYYY' : 'Day X'}, HH:MM] ...).
</CORE_FORMAT>`;
}

/**
 * Builds the FAC module instruction string (plain [CORE] for factions — no NPC field headers).
 * @param {object} [passedSettings]
 * @returns {string}
 */
export function buildFacInstruction(passedSettings = null) {
    let settings = passedSettings || {};
    if (!passedSettings) {
        try {
            settings = getSettings() || {};
        } catch (_) {}
    }
    let useDdMmYy = !!settings.useDdMmYyFormat;
    let coreSections = DEFAULT_NPC_SECTIONS;
    if (settings.npcCoreSections && Array.isArray(settings.npcCoreSections) && settings.npcCoreSections.length > 0) {
        coreSections = settings.npcCoreSections;
    }
    const sectionsList = coreSections.map(s => s.name).join(', ');

    return `Named factions, guilds, organisations. **Status**: short current-state line (standing with the party, active conflicts, what changed recently). **Description**: permanent history, ideology, schemes, and notable members.

<CORE_FORMAT — FAC only>
When FIRST recording a faction, wrap the permanent description (history, ideology, schemes, and notable members) inside a plain \`[CORE]\` … \`[/CORE]\` block. Do NOT use NPC field headers (${sectionsList}) — those structured sections are NPC-only.

Correct:
[CORE]
A consulting group based out of Lower Manhattan, operating professional, climate-controlled server environments and dealing with highly sensitive data.
[/CORE]

Wrong:
[CORE]
${coreSections[0] ? coreSections[0].name : 'Appearance'}: A consulting group...
${coreSections[1] ? coreSections[1].name : 'Personality'}: Operating professional...
[/CORE]

The Description MUST start directly with \`[CORE]\`. Do NOT prepend timestamps before the opening tag (e.g. do NOT write "[${useDdMmYy ? '01/01/2026' : 'Day 1'}, 08:00] [CORE]").
After \`[/CORE]\`, append timestamped chronicle updates/developments ([${useDdMmYy ? 'DD/MM/YYYY' : 'Day X'}, HH:MM] ...).
</CORE_FORMAT>`;
}


// ── Default module definitions (single source of truth for reset logic) ─────────

/**
 * Rebuilds the core default module instructions (NPC & LOC) so their formatting instructions
 * dynamically align with the active date/time selection.
 * @param {object} settings
 */
export function rebuildAllModuleInstructions(settings) {
    if (!settings.routerModules) return;
    if (settings.routerModules.npc) {
        settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false, settings);
    }
    if (settings.routerModules.loc) {
        settings.routerModules.loc.instruction = buildLocInstruction(settings);
    }
    if (settings.routerModules.fac) {
        settings.routerModules.fac.instruction = buildFacInstruction(settings);
    }
}
