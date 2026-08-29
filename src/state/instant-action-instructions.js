export const MAX_INSTANT_ACTION_INSTRUCTION_LENGTH = 1000;
export const DEFAULT_INSTANT_ACTION_PLAYER_CARD_WORDS = 150;

/** Normalize one-time Instant Action guidance without persisting it into later turns. */
export function normalizeInstantActionInstructions(value) {
    return String(value || '').trim().slice(0, MAX_INSTANT_ACTION_INSTRUCTION_LENGTH);
}

/** Resolve the Instant Action Player Card length, including the custom option. */
export function resolveInstantActionPlayerCardWords(selection, customValue) {
    const rawValue = selection === 'other' ? customValue : selection;
    const parsed = Number.parseInt(String(rawValue || ''), 10);
    if (!Number.isFinite(parsed)) return DEFAULT_INSTANT_ACTION_PLAYER_CARD_WORDS;
    return Math.max(50, Math.min(5000, parsed));
}

/** Pull an explicit character level (1–20) out of Instant Action Initial Setup. */
export function extractInstantActionLevel(value) {
    const instructions = normalizeInstantActionInstructions(value);
    if (!instructions) return null;
    const patterns = [
        /\blevel\s*[:=]?\s*(\d{1,2})\b/i,
        /\blv(?:l)?\.?\s*[:=]?\s*(\d{1,2})\b/i,
        /\b(\d{1,2})(?:st|nd|rd|th)[-\s]+level\b/i,
    ];
    for (const pattern of patterns) {
        const match = instructions.match(pattern);
        if (!match) continue;
        const parsed = Number.parseInt(match[1], 10);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 20) return parsed;
    }
    return null;
}

const INSTANT_ACTION_LEVEL_MIN = 1;
const INSTANT_ACTION_LEVEL_MAX = 10;

/**
 * Roll a random starting level for Instant Action (1–10 inclusive).
 * Instant Action does not use the Other Ways level dropdown — only Initial Setup
 * can override this roll when it names an explicit level.
 * @param {() => number} [random] 0..1 RNG for tests
 * @returns {number}
 */
export function rollInstantActionLevel(random = Math.random) {
    const r = random();
    const span = INSTANT_ACTION_LEVEL_MAX - INSTANT_ACTION_LEVEL_MIN + 1;
    return INSTANT_ACTION_LEVEL_MIN + Math.floor(r * span);
}

/**
 * Instant Action starts at Level 1 unless Random Level is on (then 1–10).
 * Systems set to N/A — No Levels stay level-free. Initial Setup can still
 * override a numeric level later when it names one.
 * @param {{ noLevel?: boolean, randomLevel?: boolean, random?: () => number }} [opts]
 * @returns {number|null}
 */
export function resolveInstantActionStartingLevel({
    noLevel = false,
    randomLevel = false,
    random = Math.random,
} = {}) {
    if (noLevel) return null;
    if (randomLevel) return rollInstantActionLevel(random);
    return 1;
}

/** @returns {{ min: number, max: number }} */
export function getInstantActionLevelRange() {
    return { min: INSTANT_ACTION_LEVEL_MIN, max: INSTANT_ACTION_LEVEL_MAX };
}

/** Prompt section shared with Instant Action character generation. */
export function buildInstantActionPromptSection(value) {
    const instructions = normalizeInstantActionInstructions(value);
    if (!instructions) return '';
    return `

--- INITIAL SETUP: ---
${instructions}
Follow these instructions for the character, starting setting, premise, tone, or any other requested details. Where they conflict with randomly rolled defaults — including class, level, name, and starting situation — these instructions win. Preserve all required output formatting.`;
}

/** Opening user message that grounds the narrator in the same one-time guidance. */
export function buildInstantActionOpeningMessage(value) {
    const instructions = normalizeInstantActionInstructions(value);
    if (!instructions) return 'Begin the adventure';
    return `Begin the adventure.\n\nInitial Setup:\n${instructions}`;
}
