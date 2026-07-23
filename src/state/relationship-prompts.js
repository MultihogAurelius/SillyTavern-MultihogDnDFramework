/**
 * Relationship instruction / sysprompt string builders.
 */

import { getNpcRelationshipMax, relPctOfMax } from './relationship-math.js';

export const RELATIONSHIP_UPDATE_MODES = {
    REGEX: 'regex',
    STATE_TRACKER: 'state_tracker',
};

/**
 * Keeps existing campaigns on the original narrator-regex behavior unless they
 * explicitly select the State Tracker command mode.
 * @param {any} settings
 */
export function getRelationshipUpdateMode(settings) {
    return settings?.npcRelationshipUpdateMode === RELATIONSHIP_UPDATE_MODES.STATE_TRACKER
        ? RELATIONSHIP_UPDATE_MODES.STATE_TRACKER
        : RELATIONSHIP_UPDATE_MODES.REGEX;
}

export function buildNpcRelationshipInstruction(max) {
    const m = max ?? getNpcRelationshipMax();
    const p = (f) => relPctOfMax(f, m);
    return `## NPC RELATIONSHIPS
When recording a NEW NPC, set their starting relationship values using the \`rel\` parameter in your commit call. Infer appropriate starting deltas from the narrative context. Valid range: -${m} to +${m}.
- Long-time friends, regular companions, mentors, or close partners: set a strong starting friendship (e.g., +${p(0.30)} to +${p(0.60)}).
- Casual friends, helpful acquaintances, or positive encounters: set a minor starting friendship (e.g., +${p(0.10)} to +${p(0.25)}).
- Romantically interested or close loved ones: set starting affection and/or friendship (e.g., +${p(0.20)} to +${p(0.50)}).
- Minor foes, hostile rivals, or unfriendly targets: set a minor negative starting friendship (e.g., ${p(-0.05)} to ${p(-0.15)}).
- Direct enemies, antagonist figures, or deadly threats: set a strong negative starting friendship (e.g., ${p(-0.20)} to ${p(-0.60)}).
- Unknown/neutral: default to 0 (no delta).
Ongoing relationship changes are tracked automatically by the system from the narrative output. Do NOT emit relationship deltas for existing NPCs.`;
}

/**
 * Basic-mode router prompt block for [[REL:]] tags — same scaled guidelines.
 * @param {number} [max]
 * @returns {string}
 */
export function buildRouterRelationshipInstruction(max) {
    const m = max ?? getNpcRelationshipMax();
    const p = (f) => relPctOfMax(f, m);
    return `## NPC INITIAL RELATIONSHIP VALUES
When you record a NEW NPC, you MUST set their starting relationship values using [[REL:]] tags based on narrative context. This is ONLY for initial values when first recording an NPC — ongoing relationship changes are tracked automatically by the system. Valid range: -${m} to +${m}. Examples:
  [[REL: NameOrUID | friendship | +${p(0.30)}]]
  [[REL: NameOrUID | affection | ${p(-0.05)}]]
Starting value guidelines:
- Long-time friends, regular companions, mentors, or close partners: set a strong starting friendship (e.g., +${p(0.30)} to +${p(0.60)}).
- Casual friends, helpful acquaintances, or positive encounters: set a minor starting friendship (e.g., +${p(0.10)} to +${p(0.25)}).
- Romantically interested or close loved ones: set starting affection and/or friendship (e.g., +${p(0.20)} to +${p(0.50)}).
- Minor foes, hostile rivals, or unfriendly targets: set a minor negative starting friendship (e.g., ${p(-0.05)} to ${p(-0.15)}).
- Direct enemies, antagonist figures, or deadly threats: set a strong negative starting friendship (e.g., ${p(-0.20)} to ${p(-0.60)}).
- Unknown/neutral: default to 0 (no delta).`;
}

/**
 * State Tracker instruction for tag-based, code-applied relationship changes.
 * @param {number} [max]
 * @param {boolean} [isFullContext]
 * @param {string} [customPrompt]
 * @returns {string}
 */
export function buildStateTrackerRelationshipCommandInstruction(max, isFullContext = false, customPrompt = '') {
    const m = max ?? getNpcRelationshipMax();
    const fullAuditRule = isFullContext
        ? 'This is a full-history audit, so do not emit a [RELATIONS] block. Do not replay historical relationship changes.'
        : 'The GM narrator is authoritative for relationship points. Only convert its explicit relationship annotations; never infer, award, adjust, or omit a delta yourself.';

    if (typeof customPrompt === 'string' && customPrompt.trim()) {
        return customPrompt.trim()
            .replaceAll('{{max}}', String(m))
            .replaceAll('{{full_audit_rule}}', fullAuditRule);
    }

    return `## RELATIONSHIP DELTA COMMANDS
Relationship bars are enabled. Do NOT add relationship data to the memo itself. ${fullAuditRule}

Keep the normal State Memo output exactly as usual. After it, append this block only when there is at least one qualifying change:
[RELATIONS]
Friendship +5 Exact NPC Name
Affection -2 Exact NPC Name
[/RELATIONS]

Only convert annotations in this exact narrator form:
*(Friendship: Marcus +10 — saved his life in the alley)*
*(Affection: Elena +2 — she seemed touched by the compliment)*

Each command is one line: axis first (Friendship or Affection), signed whole-number delta second, then the exact NPC name. Copy the axis, NPC name, and signed delta from each annotation exactly; discard only its explanation. Do not add reasons, bullets, punctuation, or any other text inside the block. If there are no explicit annotations, do not output a [RELATIONS] block. Each command is clamped to -${m} through +${m}.`;
}

/**
 * Narrator sysprompt <relationship_tracking> block — scale line tied to configured max.
 * Delta guide magnitudes stay absolute (same point awards at any range width).
 * @param {number} [max]
 * @returns {string}
 */
export function buildRelationshipTrackingSysprompt(max) {
    const m = max ?? getNpcRelationshipMax();
    return `RELATIONSHIP TRACKING — only active when [NPC_RELATIONS] appears in context.

[NPC_RELATIONS] at the top of each turn shows current standings with active NPCs. Scale: -${m} (deep hostility) to +${m} (deep bond). Friendship = platonic trust. Affection = romantic/emotional warmth. Point changes are absolute increments clamped to ±${m}.

WHEN TO EMIT:
Be selective and natural. Only emit when {{user}} directly and meaningfully interacted with an NPC — a real moment worth noting. Magnitude MUST reflect the NPC's personality: a stoic warrior shifts less than a warm innkeeper for the same act.

DO NOT EMIT when: the interaction has no emotional weight (buying supplies, directions), the NPC is absent, or nothing meaningful happened between {{user}} and that NPC this turn.

INLINE ANNOTATION (visible — place immediately after the triggering moment):
*(Friendship: Marcus +10 — saved his life in the alley)*
*(Affection: Elena +2 — she seemed touched by the compliment)*`;
}

/**
 * Builds the NPC instruction string based on current NPC settings.
 * @param {number} majorWords
 * @param {number} minorWords
 * @returns {string}
 */
