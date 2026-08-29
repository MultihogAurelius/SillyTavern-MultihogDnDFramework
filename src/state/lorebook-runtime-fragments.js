/**
 * Editable Lorebook Agent runtime prompt fragments.
 *
 * These used to be hardcoded string literals inside router.js / relationship-prompts.js.
 * Selection logic (which variant applies this pass) stays in code; the wording lives in
 * settings-backed templates the user can edit from the Lorebook Agent prompt UI.
 */

import { getNpcRelationshipMax, relPctOfMax } from './relationship-math.js';

/** Local expand helper — avoids a defaults ↔ fragments ↔ lorebook-prompt-templates cycle. */
function expandFragmentTemplate(template, values = {}) {
    let result = String(template || '');
    for (const [key, value] of Object.entries(values)) {
        result = result.replaceAll(`{{${key}}}`, String(value ?? ''));
    }
    return result;
}

export const LOREBOOK_RUNTIME_FRAGMENT_KEYS = Object.freeze([
    'routerCombatProfileGuidanceBasicTemplate',
    'routerCombatProfileGuidanceAgentTemplate',
    'routerAutoPassRestrictionTemplate',
    'routerManualPassRestrictionTemplate',
    'routerExistingNpcNudgeTemplate',
    'routerRelSectionBasicTemplate',
    'routerRelSectionAgentTemplate',
]);

/** Fragment keys reset together with Basic Mode prompts. */
export const LOREBOOK_BASIC_FRAGMENT_KEYS = Object.freeze([
    'routerCombatProfileGuidanceBasicTemplate',
    'routerRelSectionBasicTemplate',
    'routerAutoPassRestrictionTemplate',
    'routerManualPassRestrictionTemplate',
    'routerExistingNpcNudgeTemplate',
]);

/** Fragment keys reset together with Agent Mode prompts. */
export const LOREBOOK_AGENT_FRAGMENT_KEYS = Object.freeze([
    'routerCombatProfileGuidanceAgentTemplate',
    'routerRelSectionAgentTemplate',
    'routerAutoPassRestrictionTemplate',
    'routerManualPassRestrictionTemplate',
    'routerExistingNpcNudgeTemplate',
]);

const COMBAT_SCOPE_RULE = `- CRITICAL — ONE COMBATANT PER PROFILE: a Combat Profile is ONLY that single combatant's own stat block — their "Name: HP" line through their "Status:" line, nothing more. NEVER copy the "COMBAT ROUND N" header, the ENEMIES:/NON-PARTY ALLIES: section headers, or any *other* combatant's block into it. If you are updating Schwarzenegev, the Combat Profile content contains Schwarzenegev's block alone — Schwarzenegger's stats (or anyone else's) do NOT belong in it, even though they appear in the same [COMBAT] section.`;

export const DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_BASIC = `
## COMBAT PROFILE (mechanical stats provided this turn)
- Canonical sources, in priority order:
  1. ## ACTIVE COMBAT STATE — for combatants listed in [COMBAT], copy that combatant's own block verbatim.
  2. ## PARTY MECHANICAL STATE — for named [PARTY] members who ALREADY have a Combat Profile in ACTIVE MEMORY, patch lasting combat stats (max HP, BAB/APR, attack totals, AC, saves, attributes, HD, new class features/abilities) so they match the [PARTY] sheet. Typical trigger: PARTY LEVEL SYNC / level-up. Keep the existing Combat Profile block shape; do not replace it with a raw [PARTY] sheet. Do NOT create a Combat Profile from [PARTY] if none exists. Do NOT rewrite a profile solely because current HP, temp HP, status, or spell-slot ticks changed.
- **Existing NPCs** (in ACTIVE MEMORY or ARCHIVE): output \`[[UPDATE_CORE: NPC Name | Combat Profile | updated stats]]\` — NOT a full \`[[NPC:...]]\` re-record.
- **Brand-new combatants** with no existing entry: include \`Combat Profile:\` inside \`[CORE]\` in a new \`[[NPC:...]]\` record, and only from ACTIVE COMBAT STATE — never from [PARTY].
- Never invent numbers from GM prose. PARTY LEVEL SYNC in the narrative is a cue to read ## PARTY MECHANICAL STATE.
${COMBAT_SCOPE_RULE}
- Example: \`[[UPDATE_CORE: Marcus Thorne | Combat Profile | Marcus Thorne: 12/12 HP\\nAtt/def: Longsword (1 attack, +5 / 1d8+2 Slashing) | Chainmail (AC: 15)\\nSaves: Fort +4, Ref +2, Will +1\\nAbilities: None declared\\nStatus: Healthy]]\``;

export const DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_AGENT = `
## COMBAT PROFILE (mechanical stats provided this turn)
- Canonical sources, in priority order:
  1. ## ACTIVE COMBAT STATE — for combatants listed in [COMBAT], copy that combatant's own block verbatim.
  2. ## PARTY MECHANICAL STATE — for named [PARTY] members who ALREADY have a Combat Profile in ACTIVE MEMORY, patch lasting combat stats (max HP, BAB/APR, attack totals, AC, saves, attributes, HD, new class features/abilities) so they match the [PARTY] sheet. Typical trigger: PARTY LEVEL SYNC / level-up. Keep the existing Combat Profile block shape; do not replace it with a raw [PARTY] sheet. Do NOT create a Combat Profile from [PARTY] if none exists. Do NOT rewrite a profile solely because current HP, temp HP, status, or spell-slot ticks changed.
- **Existing NPCs** (listed in ACTIVE MEMORY with an ID): use \`commit({"core": [{"id": "Book::UID or NPC Name", "field": "Combat Profile", "content": "updated stats"}]})\`. Do NOT re-record the full NPC via \`record\` or embed a new \`[CORE]\` block in \`update\`.
- **Brand-new combatants** with no lorebook entry yet: include \`Combat Profile:\` inside \`[CORE]\` in a \`record\` item, and only from ACTIVE COMBAT STATE — never from [PARTY].
- Never invent numbers from GM prose. PARTY LEVEL SYNC in the narrative is a cue to read ## PARTY MECHANICAL STATE.
${COMBAT_SCOPE_RULE}
- Example (updating only "Schwarzenegev", ignoring every other combatant listed alongside it): \`commit({"core": [{"id": "Schwarzenegev", "field": "Combat Profile", "content": "Schwarzenegev: 40/45 HP\\nAtt/def: Argument Ender (1 attack, +8 / 2d10+4 Piercing) | Armor (AC: 16)\\nSaves: Fort unknown, Ref unknown, Will unknown\\nAbilities: None declared\\nOther: Temporary allied combatant\\nStatus: (-) Wounded (until healed), Active (this combat)"}]})\``;

export const DEFAULT_ROUTER_AUTO_PASS_RESTRICTION = `- AUTOMATIC PASS RESTRICTION: Combat Profile is the only [CORE] field you may update this pass via UPDATE_CORE / commit.core. Do not modify Species, Personality, Background, Habits, Strengths, or Flaws unless the user gave an explicit instruction this turn (Direct Prompt). Body/Worn Equipment changes use UPDATE_APPEARANCE / UPDATE_EQUIPMENT instead.`;

export const DEFAULT_ROUTER_MANUAL_PASS_RESTRICTION = `- DIRECT PROMPT PASS: you may update any eligible [CORE] identity field ({{eligibleCoreFields}}) when the user's instruction warrants it. Body/Worn Equipment still use UPDATE_APPEARANCE / UPDATE_EQUIPMENT. Preserve <font color=#RRGGBB>text</font> and hex color codes; write unquoted hex attributes (never color="#RRGGBB") so JSON tool calls stay valid.`;

export const DEFAULT_ROUTER_EXISTING_NPC_NUDGE = `- For notable existing-NPC moments that do not change any [CORE] field, still append a timestamped chronicle/EVENT line so the beat is not lost.`;

export const DEFAULT_ROUTER_REL_SECTION_BASIC = `## NPC INITIAL RELATIONSHIP VALUES
When you record a NEW NPC, you MUST set their starting relationship values using [[REL:]] tags based on narrative context. This is ONLY for initial values when first recording an NPC — ongoing relationship changes are tracked automatically by the system. Valid range: -{{max}} to +{{max}}. Examples:
  [[REL: NameOrUID | friendship | +{{p30}}]]
  [[REL: NameOrUID | affection | {{n05}}]]
Starting value guidelines:
- Long-time friends, regular companions, mentors, or close partners: set a strong starting friendship (e.g., +{{p30}} to +{{p60}}).
- Casual friends, helpful acquaintances, or positive encounters: set a minor starting friendship (e.g., +{{p10}} to +{{p25}}).
- Romantically interested or close loved ones: set starting affection and/or friendship (e.g., +{{p20}} to +{{p50}}).
- Minor foes, hostile rivals, or unfriendly targets: set a minor negative starting friendship (e.g., {{n05}} to {{n15}}).
- Direct enemies, antagonist figures, or deadly threats: set a strong negative starting friendship (e.g., {{n20}} to {{n60}}).
- Unknown/neutral: default to 0 (no delta).`;

export const DEFAULT_ROUTER_REL_SECTION_AGENT = `## NPC RELATIONSHIPS
When recording a NEW NPC, set their starting relationship values using the \`rel\` parameter in your commit call. Infer appropriate starting deltas from the narrative context. Valid range: -{{max}} to +{{max}}.
- Long-time friends, regular companions, mentors, or close partners: set a strong starting friendship (e.g., +{{p30}} to +{{p60}}).
- Casual friends, helpful acquaintances, or positive encounters: set a minor starting friendship (e.g., +{{p10}} to +{{p25}}).
- Romantically interested or close loved ones: set starting affection and/or friendship (e.g., +{{p20}} to +{{p50}}).
- Minor foes, hostile rivals, or unfriendly targets: set a minor negative starting friendship (e.g., {{n05}} to {{n15}}).
- Direct enemies, antagonist figures, or deadly threats: set a strong negative starting friendship (e.g., {{n20}} to {{n60}}).
- Unknown/neutral: default to 0 (no delta).
Ongoing relationship changes are tracked automatically by the system from the narrative output. Do NOT emit relationship deltas for existing NPCs.`;

/**
 * Expand relationship templates that use {{max}} / {{p30}} / {{n05}} style placeholders.
 * @param {string} template
 * @param {number} [max]
 * @returns {string}
 */
export function expandRelationshipPctPlaceholders(template, max) {
    const m = max ?? getNpcRelationshipMax();
    const p = (f) => relPctOfMax(f, m);
    return expandFragmentTemplate(template, {
        max: m,
        p10: p(0.10),
        p20: p(0.20),
        p25: p(0.25),
        p30: p(0.30),
        p50: p(0.50),
        p60: p(0.60),
        n05: p(-0.05),
        n15: p(-0.15),
        n20: p(-0.20),
        n60: p(-0.60),
    });
}

/**
 * @param {Record<string, any>} settings
 * @param {boolean} hasMechanicalStats — true when [COMBAT] and/or [PARTY] is available this pass
 * @param {'basic'|'agent'} [mode]
 * @returns {string}
 */
export function resolveCombatProfileGuidance(settings, hasMechanicalStats, mode = 'basic') {
    if (!hasMechanicalStats) return '';
    const key = mode === 'agent'
        ? 'routerCombatProfileGuidanceAgentTemplate'
        : 'routerCombatProfileGuidanceBasicTemplate';
    const fallback = mode === 'agent'
        ? DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_AGENT
        : DEFAULT_ROUTER_COMBAT_PROFILE_GUIDANCE_BASIC;
    return String(settings?.[key] || fallback);
}

/**
 * @param {Record<string, any>} settings
 * @param {boolean} isManual
 * @param {string} eligibleCoreFieldsList
 * @returns {string}
 */
export function resolveAutoPassRestriction(settings, isManual, eligibleCoreFieldsList) {
    if (!isManual) {
        return String(settings?.routerAutoPassRestrictionTemplate || DEFAULT_ROUTER_AUTO_PASS_RESTRICTION);
    }
    return expandFragmentTemplate(
        String(settings?.routerManualPassRestrictionTemplate || DEFAULT_ROUTER_MANUAL_PASS_RESTRICTION),
        { eligibleCoreFields: eligibleCoreFieldsList },
    );
}

/**
 * @param {Record<string, any>} settings
 * @returns {string}
 */
export function resolveExistingNpcNudge(settings) {
    return String(settings?.routerExistingNpcNudgeTemplate || DEFAULT_ROUTER_EXISTING_NPC_NUDGE);
}

/**
 * @param {Record<string, any>} settings
 * @param {'basic'|'agent'} mode
 * @param {number} [max]
 * @returns {string}
 */
export function resolveRelSection(settings, mode, max) {
    if (!settings?.npcRelationshipBars) return '';
    const key = mode === 'agent' ? 'routerRelSectionAgentTemplate' : 'routerRelSectionBasicTemplate';
    const fallback = mode === 'agent' ? DEFAULT_ROUTER_REL_SECTION_AGENT : DEFAULT_ROUTER_REL_SECTION_BASIC;
    const template = String(settings?.[key] || fallback);
    return expandRelationshipPctPlaceholders(template, max ?? getNpcRelationshipMax(settings)).trim();
}
