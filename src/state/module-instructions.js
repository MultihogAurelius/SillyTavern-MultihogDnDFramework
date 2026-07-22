/**
 * NPC / LOC / FAC module instruction builders + rebuild helper.
 */

import { getSettings } from './settings-ref.js';
import { DEFAULT_NPC_SECTIONS } from './schema-sections.js';
import { getNpcRelationshipMax } from './relationship-math.js';
import { buildNpcRelationshipInstruction } from './relationship-prompts.js';

export function buildNpcInstruction(majorWords = 25, minorWords = 15, ignoreLimits = false) {
    let settings = {};
    try {
        settings = getSettings();
    } catch (_) {}
    let useDdMmYy = !!settings.useDdMmYyFormat;
    
    let coreSections = settings.npcCoreSections;
    if (!coreSections || !Array.isArray(coreSections) || coreSections.length === 0) {
        coreSections = DEFAULT_NPC_SECTIONS;
    }
    const sectionsList = coreSections.map(s => s.name).join(', ');
    const sectionsTemplate = coreSections.map(s => `${s.name}: ${s.description}`).join('\n');

    let instruction = `Significant named characters the party interacts with (do NOT record every random enemy or nameless bartender, only characters who are somehow significant). A creature's class/tier label (e.g. "Skeleton," "Bandit," "Guard Captain") is not itself a name, and having [COMBAT] stats or being the party's current opponent is not, by itself, evidence of significance — that comes from being treated as a recurring individual with motive, backstory, or a stake the story cares about.
Do NOT create an NPC entry for the player character (controlled by the user) under any circumstances.
In the chat history, the player character is the speaker labeled "Player" (and prompt replacement "{{user}}"). Analyze the dialogue to identify what in-character roleplay name(s) or alias(es) other characters use when addressing or referring to the "Player" (for example, if they call the Player "Dave Davidson" or "Dave", then "Dave Davidson" is the player character).
Under no circumstances should you create an NPC entry for the player character, regardless of whether they are referred to as "Player", "{{user}}", or by their actual in-character name/alias (like "Dave Davidson").
Always use the exact macro string \`{{user}}\` when referring to the player character in EVENT, QUEST, or NPC relationship descriptions; do NOT write the plain word "user" or "player" or their actual character name in entry contents.

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
If any field inside the permanent [CORE] block changes, is updated, or new information is revealed (${sectionsList}), output:
  [[UPDATE_CORE: Book::UID | FieldName | New field text]]
Use the exact FieldName (e.g. ${sectionsList}). Do NOT log core updates as normal event/update entries.`;

    let enableRelBars = false;
    try {
        const settings = getSettings();
        enableRelBars = !!settings.npcRelationshipBars;
    } catch (_) {}

    if (enableRelBars) {
        instruction += `\n\n${buildNpcRelationshipInstruction(getNpcRelationshipMax())}`;
    }

    instruction += `\n\nBe concise and functional — every word should serve gameplay or characterization. Avoid adjective dumps and purple prose.`;

    if (!ignoreLimits) {
        instruction += `\n\n<CORE LENGTH TARGETS>
Major NPCs (recurring, plot-important): target AT LEAST ${majorWords} words per each section of [CORE].
Minor NPCs (shopkeepers, guards, one-off encounters): target AT LEAST ${minorWords} words per each section of [CORE].

Expand/extrapolate thematically if you can't otherwise meet the specified length targets.
</CORE_LENGTH TARGETS>`;
    }


    instruction += `\n\n<COMBAT_GRANULARITY>
Do NOT record per-round combat updates (e.g., creature HP changes, turn-by-turn action lists, temporary conditions mid-fight). For long combats, limit updates to the initiation of combat (e.g., when they became hostile and attacked {{user}}), a high-level progress update every ~5 rounds (to capture major shifts or stalemates), and the final resolved outcome once it concludes.
</COMBAT_GRANULARITY>

<COMBAT_PROFILE_PERSISTENCE>
TRIGGER — Combat Profile is a HIDDEN field. Write it ONLY when a \`## ACTIVE COMBAT STATE\` section is present in your context and contains a \`[COMBAT]\` block for this specific NPC. Do NOT write it from GM prose, combat narration, or anything other than that dedicated section. If no \`## ACTIVE COMBAT STATE\` section exists, leave Combat Profile absent entirely.

CONTENT — When a [COMBAT] block IS present, transcribe it completely and verbatim into \`Combat Profile:\` inside [CORE]. Include every declared stat: HP, AC, attack bonus, damage, saves, weapons, abilities, special traits — everything the [COMBAT] block lists. Do NOT condense, summarize, or hand-pick a subset. The goal is a faithful copy, not an interpretation.

UPDATE — If a Combat Profile already exists in [CORE] and a new [COMBAT] block for the same NPC appears with updated stats, patch the Combat Profile line in place with the new values. Do not touch any other [CORE] field. For an EXISTING lorebook NPC, use [[UPDATE_CORE: NPC Name | Combat Profile | ...]] (basic mode) or commit core (agent mode) — do NOT re-emit a full [[NPC:...]] record or embed a new [CORE] block in a chronicle update.

PLACEMENT — Combat Profile is IDENTITY data, not a chronicle event. It belongs as its own labeled line inside [CORE] (e.g. immediately before the closing [/CORE] tag) — never as a timestamped delta line, and never appended after [/CORE].
</COMBAT_PROFILE_PERSISTENCE>`;
    return instruction;
}

/**
 * Builds the LOC module instruction string (plain [CORE] for places — no NPC field headers).
 * @returns {string}
 */
export function buildLocInstruction() {
    let useDdMmYy = false;
    let coreSections = DEFAULT_NPC_SECTIONS;
    try {
        const s = getSettings();
        useDdMmYy = !!s.useDdMmYyFormat;
        if (s.npcCoreSections && Array.isArray(s.npcCoreSections) && s.npcCoreSections.length > 0) {
            coreSections = s.npcCoreSections;
        }
    } catch (_) {}
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
 * @returns {string}
 */
export function buildFacInstruction() {
    let useDdMmYy = false;
    let coreSections = DEFAULT_NPC_SECTIONS;
    try {
        const s = getSettings();
        useDdMmYy = !!s.useDdMmYyFormat;
        if (s.npcCoreSections && Array.isArray(s.npcCoreSections) && s.npcCoreSections.length > 0) {
            coreSections = s.npcCoreSections;
        }
    } catch (_) {}
    const sectionsList = coreSections.map(s => s.name).join(', ');

    return `Named factions, guilds, organisations. **Status**: short current-state line (standing with the party, active conflicts, what changed recently). **Description**: permanent history, ideology, schemes, and notable members.

<CORE_FORMAT — FAC only>
When FIRST recording a faction, wrap the permanent description (history, ideology, schemes, and notable members) inside a plain \`[CORE]\` … \`[/CORE]\` block. Do NOT use NPC field headers (${sectionsList}) — those structured sections are NPC-only.

Correct:
[CORE]
A consulting group based out of Lower Manhattan, operating professional, climate-controlled server environments and dealing with highly sensitive data.
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
        settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
    }
    if (settings.routerModules.loc) {
        settings.routerModules.loc.instruction = buildLocInstruction();
    }
    if (settings.routerModules.fac) {
        settings.routerModules.fac.instruction = buildFacInstruction();
    }
}

