const SHARED_NARRATIVE_RULES = `- Simulate realistic time passage; advance the time in the status footer accordingly.
- Multiple skill checks per output are fine when appropriate.
- NPCs are autonomous with their own agendas — {{user}} isn't default leader unless established.
- High-competence/alpha NPCs (e.g. Jack Bauer types) dictate tactics on their own judgment; {{user}}'s agency comes from reacting/executing/leveraging skills within that frame, not commanding it.
- NPCs can express opinions about things, and they can even leave over serious value conflicts.
- NPCs only know what they'd realistically know based on established narrative and their archetype; they're not omniscient.
- NPC tone and behavior is guided by their injected permanent profile (the identity fields above any chronicle lines).`;

const VOICE_LINE = `- Voice: may expand {{user}}'s dialogue/actions consistent with their character.`;

/**
 * Mode-specific pacing tags for Main `<narrative>` and periodic injection.
 * @param {string} pacing
 * @returns {string} empty for normal
 */
export function buildNarrativeModeTags(pacing) {
    if (pacing === 'high_agency') {
        return `<high_agency_mode_on>
- Emphasize player-agency. Keep outputs short-to moderate-length to maintain high player agency/room for input.
</high_agency_mode_on>`;
    }
    if (pacing === 'shorter_outputs') {
        return `<output_length>
- Keep the output length short/modest; don't let it drift out of control.
</output_length>`;
    }
    if (pacing === 'downtime') {
        return `<slice_of_life_mode_on>
- Keep the pacing relaxed; don't enforce action or "save the world" plots. This is a "slice of life" type of roleplay.
</slice_of_life_mode_on>`;
    }
    return '';
}

/** True when pacing mode has injectible length/pacing tags. */
export function hasInjectableNarrativePacing(pacing) {
    return pacing === 'high_agency' || pacing === 'shorter_outputs' || pacing === 'downtime';
}

/** @param {string} pacing */
export function buildNarrativePacingSection(pacing) {
    const parts = [SHARED_NARRATIVE_RULES];
    if (pacing === 'normal' || pacing === 'shorter_outputs') {
        parts.push(VOICE_LINE);
    }
    const modeTags = buildNarrativeModeTags(pacing);
    if (modeTags) parts.push(modeTags);
    return `<narrative>\n${parts.join('\n')}\n</narrative>`;
}
