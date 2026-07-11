/**
 * state-manager.js — Multihog D&D Framework
 * Game state schema, defaults, persistence, migration, and profile I/O.
 * Owns the single source of truth for all runtime state (currentMemo, quests,
 * modules, chat-linked snapshots, connection settings, etc.).
 * No DOM. No circular deps.
 *
 * Imports: constants.js
 * Imported by: virtually everything — the root dependency.
 */

import { DEFAULT_STOCK_PROMPTS, BLOCK_ORDER } from './constants.js';

export const DEFAULT_NPC_SECTIONS = [
    { id: 'sec_appearance', name: 'Appearance/Species', description: 'Species, build, age, features, usual attire — not current pose or activity.', icon: '👁️', color: '#d4a940' },
    { id: 'sec_personality', name: 'Personality', description: 'Stable temperament and drives — not today\'s mood, fear, or stress.', icon: '🧠', color: '#8b5cf6' },
    { id: 'sec_background', name: 'Brief Background', description: 'Standing role, origin, history — not their part in the current plot.', icon: '📜', color: '#3b82f6' },
    { id: 'sec_habits', name: 'Habits/Behaviors', description: 'Recurring mannerisms and patterns — not one scene\'s behavior.', icon: '🔄', color: '#10b981' },
    { id: 'sec_strengths', name: 'Strengths', description: '[Concise bullet phrases formatted in bullet points of their most notable strengths, skills, or virtues. Sharp and specific — no vague generalities. A kind character may have more strengths than flaws.]', icon: '⚡', color: '#22c55e' },
    { id: 'sec_flaws', name: 'Flaws', description: '[Concise bullet phrases formatted in bullet points of their most notable weaknesses, bad habits, or moral failings. Be honest and specific. A troubled character may have more flaws than strengths.]\n(Note: The split between strengths and flaws does not need to be even. It is perfectly fine to have an uneven split—like having more strengths than flaws, or more flaws than strengths—so long as it authentically reflects the character. However, it can be evenly split if it makes sense.)', icon: '⚠️', color: '#ef4444' },
    { id: 'sec_combat_profile', name: 'Combat Profile', description: '[HIDDEN UNTIL SET — only written when a [COMBAT] block for this NPC is visible in the narrative. Copy the full stat block verbatim: HP, AC, saves, weapons, abilities, and any other declared stats. Never fabricate or summarize.]', icon: '🤺', color: '#38bdf8', hiddenUntilSet: true }
];

export const DEFAULT_PC_SECTIONS = [
    { id: 'sec_appearance', name: 'Appearance/Species', description: '[Describe physical features and species: body type, height, hair, eyes, skin tone, distinguishing marks, scars, and natural body language. You MUST explicitly state their Species, Ethnicity, and Gender based on the character card and Player Preferences. You MUST explicitly incorporate any appearance notes provided in the card/preferences. Do NOT describe clothing, armor, or worn gear — those are handled dynamically elsewhere and will change.]', icon: '👁️', color: '#d4a940' },
    { id: 'sec_personality', name: 'Personality', description: '[Describe temperament, how they act around others, and emotional tendencies. You MUST incorporate any traits provided.]', icon: '🧠', color: '#8b5cf6' },
    { id: 'sec_background', name: 'Background', description: '[Provide backstory context grounded in the character card. You MUST incorporate any background hints provided. Brief but meaningful.]', icon: '📜', color: '#3b82f6' },
    { id: 'sec_habits', name: 'Habits & Behaviors', description: '[Describe recurring mannerisms, habits, quirks, or behavioral patterns.]', icon: '🔄', color: '#10b981' },
    { id: 'sec_strengths', name: 'Strengths', description: '[Concise bullet phrases formatted in bullet points of their most notable strengths, skills, or virtues. Sharp and specific — no vague generalities. A kind character may have more strengths than flaws.]', icon: '⚡', color: '#22c55e' },
    { id: 'sec_flaws', name: 'Flaws', description: '[Concise bullet phrases formatted in bullet points of their most notable weaknesses, bad habits, or moral failings. Be honest and specific. A troubled character may have more flaws than strengths.]\n(Note: The split between strengths and flaws does not need to be even. It is perfectly fine to have an uneven split—like having more strengths than flaws, or more flaws than strengths—so long as it authentically reflects the character. However, it can be evenly split if it makes sense.)', icon: '⚠️', color: '#ef4444' }
];

// ── Module name (shared constant, settings key) ────────────────────────────────
export const MODULE_NAME = 'rpg_tracker';

/** @param {number} raw */
function normalizeNpcRelationshipMax(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 150;
    return Math.max(10, Math.min(10000, Math.round(n)));
}

/** Global default for new chats / chats without a saved per-chat value. */
export function getNpcRelationshipMaxDefault(settings) {
    const s = settings || getSettings();
    return normalizeNpcRelationshipMax(s.npcRelationshipMaxDefault ?? 150);
}

/** Effective max for the active chat (live `npcRelationshipMax`, else default). */
export function getNpcRelationshipMax(settings) {
    const s = settings || getSettings();
    if (settings != null && Object.prototype.hasOwnProperty.call(settings, 'npcRelationshipMax') && settings.npcRelationshipMax != null) {
        return normalizeNpcRelationshipMax(settings.npcRelationshipMax);
    }
    return normalizeNpcRelationshipMax(s.npcRelationshipMax ?? s.npcRelationshipMaxDefault ?? 150);
}

/** @param {number} value @param {number} [max] */
export function clampRelationshipValue(value, max) {
    const m = max ?? getNpcRelationshipMax();
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(-m, Math.min(m, Math.round(n)));
}

/** Bar fill width in percent (50% of track = full scale). @param {number} value @param {number} [max] */
export function relationshipBarPct(value, max) {
    const m = max ?? getNpcRelationshipMax();
    if (m <= 0) return 0;
    return (Math.abs(clampRelationshipValue(value, m)) / m) * 50;
}

/** @param {number} fraction @param {number} [max] */
export function relPctOfMax(fraction, max) {
    return Math.round((max ?? getNpcRelationshipMax()) * fraction);
}

/**
 * Lorebook Agent NPC module — starting relationship deltas scaled to configured max.
 * @param {number} [max]
 * @returns {string}
 */
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
*(Affection: Elena +2 — she seemed touched by the compliment)*

FRIENDSHIP scale (guides, not hard rules):
+1/+2 ... Casual warmth, shared laugh, pleasant campfire talk, small kindness
+2/+5 ... Compliment, meaningful help, bonding over shared memories or interests
+5/+10 .. Surviving danger together, heartfelt conversation, completing a shared goal
+10/+15 . Defending/protecting them, act of loyalty, keeping a difficult promise
+15/+25 . Saving their life, major self-sacrifice
+25/+30 . Blood oath, brotherhood/sisterhood pact
-1/-3 ... Dismissiveness, mild rudeness, forgetting something important to them
-3/-5 ... Small broken promise, ignoring them in a group, letting them down
-5/-10 .. Insult, belittling, disrespecting their values or beliefs
-10/-20 . Public humiliation, badmouthing them (if overheard)
-20/-30 . Abandoning them in danger, breaking a major promise
-40/-60 . Betraying them to an enemy

AFFECTION scale (guides, not hard rules):
+1 ...... Subtle kind gesture, noticing a small detail about them
+2/+3 ... Sincere compliment on appearance, wit, or spirit; flirtatious banter (if receptive)
+5/+10 .. Meaningful gift, intimate conversation, shared vulnerability, romantic gesture
+10/+20 . Protective act in romantic context, vulnerable confession of feelings
+20/+30 . Romantic proposal (if receptive)
-1/-2 ... Awkward or tone-deaf comment, mild social blunder
-2/-3 ... Cold or dismissive behavior
-5/-10 .. Public rejection or embarrassment
-8/-15 .. Flirting with someone else in their presence
-40/-60 . Romantic betrayal or cheating

Typical range: 1-5 for minor moments, 5-15 for major events. Only use 15+ for life-altering ones.

EXAMPLE — end of a response where {{user}} complimented Elena:
*(Affection: Elena +2 — she seemed genuinely moved by the words)*`;
}

/**
 * Maps a friendship value to a tier label and behavioral hint (thresholds are % of max).
 * @param {number} value
 * @param {number} [max]
 */
export function getFriendshipTier(value, max) {
    const m = max ?? getNpcRelationshipMax();
    const v = clampRelationshipValue(value, m);
    if (v <= -0.85 * m) return { label: 'HOSTILE',              hint: 'open contempt, refuses cooperation, may sabotage or attack' };
    if (v <= -0.65 * m) return { label: 'ENEMY/HATEFUL',        hint: 'deeply despises you, actively seeks to undermine your goals' };
    if (v <= -0.45 * m) return { label: 'BITTER/RESENTFUL',     hint: 'hostile tone, holds active grudges, quick to anger' };
    if (v <= -0.25 * m) return { label: 'UNFRIENDLY/COLD',      hint: 'curt and guarded, answers with bare minimum, visible irritation' };
    if (v <= -0.10 * m) return { label: 'DISTRUSTFUL/GUARDED',  hint: 'suspicious of your motives, keeps a physical and emotional distance' };
    if (v <= -0.03 * m) return { label: 'WARY/UNEASY',          hint: 'polite but distant, avoids personal topics, second-guesses motives' };
    if (v <=  0.03 * m) return { label: 'NEUTRAL/ACQUAINTANCE', hint: 'civil and transactional, neither warm nor cold' };
    if (v <=  0.10 * m) return { label: 'WARMING/FAVORABLE',    hint: 'small smiles, starting to open up, shows basic goodwill' };
    if (v <=  0.25 * m) return { label: 'AMICABLE',             hint: 'pleasant and chatty, actively engages in conversation, cooperative' };
    if (v <=  0.45 * m) return { label: 'FRIENDLY',             hint: 'genuine warmth, light humor, willing to help when asked' };
    if (v <=  0.65 * m) return { label: 'CLOSE FRIEND',         hint: 'deep trust, confides worries, stands up for you, proactive help' };
    if (v <=  0.85 * m) return { label: 'DEEP BOND/TRUSTED',    hint: 'fiercely protective, emotional bedrock, treats you as inner circle' };
    return                      { label: 'BONDED/FAMILY',       hint: 'unbreakable loyalty, would risk life without hesitation, shares deepest secrets' };
}

/**
 * Maps an affection value to a tier label and behavioral hint (thresholds are % of max).
 * @param {number} value
 * @param {number} [max]
 */
export function getAffectionTier(value, max) {
    const m = max ?? getNpcRelationshipMax();
    const v = clampRelationshipValue(value, m);
    if (v <= -0.85 * m) return { label: 'REVULSION',                hint: 'finds your presence repulsive, recoils from proximity, hostile to advances' };
    if (v <= -0.65 * m) return { label: 'DISGUSTED',                hint: 'active disdain for romantic or physical proximity, harsh rejections' };
    if (v <= -0.45 * m) return { label: 'AVERSION',                 hint: 'clearly uninterested, dismisses flirtation coldly, steers away from intimacy' };
    if (v <= -0.25 * m) return { label: 'AVOIDANT',                 hint: 'uncomfortable with romantic attention, subtly creates physical distance' };
    if (v <= -0.10 * m) return { label: 'UNRECEPTIVE/WITHDRAWN',    hint: 'shuts down romantic undertones, visibly uncomfortable with flirting' };
    if (v <= -0.03 * m) return { label: 'INDIFFERENT/UNINTERESTED', hint: 'no romantic spark, gentle deflection of any advances' };
    if (v <=  0.03 * m) return { label: 'NEUTRAL/NO AFFECTION',     hint: 'no romantic or emotional attachment toward you' };
    if (v <=  0.10 * m) return { label: 'CURIOUS/INTRIGUED',        hint: 'brief lingering looks, testing waters, open to playful banter' };
    if (v <=  0.25 * m) return { label: 'RECEPTIVE/FLIRTATIOUS',    hint: 'actively returns flirting, welcomes light physical touch, playful tension' };
    if (v <=  0.45 * m) return { label: 'INTERESTED',               hint: 'steals glances, responds warmly to compliments, comfortable with proximity' };
    if (v <=  0.65 * m) return { label: 'ATTRACTED',                hint: 'seeks your company, flustered by bold compliments, visible tension' };
    if (v <=  0.85 * m) return { label: 'SMITTEN/INFATUATED',       hint: 'cannot hide feelings, heavily romantic, deeply emotionally invested' };
    return                      { label: 'DEEPLY IN LOVE',          hint: 'emotionally devoted, craves closeness, expresses tenderness openly' };
}

/** @param {number} a @param {number} b @param {number} t */
function lerpTier(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Intensity 0–1 from absolute value vs configured max.
 * @param {number} value
 * @param {number} [max]
 */
export function getRelTierIntensity(value, max) {
    const m = max ?? getNpcRelationshipMax();
    if (m <= 0) return 0;
    const v = clampRelationshipValue(value, m);
    if (v === 0) return 0;
    return Math.abs(v) / m;
}

/**
 * Inline CSS for compact tier pills — color intensity scales with |value|/max.
 * @param {'friendship'|'affection'} type
 * @param {number} value
 * @param {number} [max]
 * @returns {string}
 */
export function getRelTierBadgeStyle(type, value, max) {
    const v = clampRelationshipValue(value, max ?? getNpcRelationshipMax());
    if (v === 0) {
        return 'color:var(--rt-text-muted,rgba(255,255,255,0.45));background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);';
    }

    const t = getRelTierIntensity(v, max);
    const pos = v > 0;
    let hue;
    let satLo;
    let satHi;
    let lightLo;
    let lightHi;

    if (type === 'friendship') {
        hue = pos ? 142 : 0;
        satLo = pos ? 38 : 42;
        satHi = pos ? 95 : 92;
        lightLo = pos ? 58 : 58;
        lightHi = pos ? 44 : 46;
    } else {
        hue = pos ? 330 : 275;
        satLo = pos ? 42 : 38;
        satHi = pos ? 96 : 88;
        lightLo = pos ? 62 : 60;
        lightHi = pos ? 50 : 48;
    }

    const sat = lerpTier(satLo, satHi, t);
    const light = lerpTier(lightLo, lightHi, t);
    const bgA = lerpTier(0.07, 0.26, t);
    const borderA = lerpTier(0.20, 0.62, t);
    const glow = t > 0.65 ? `box-shadow:0 0 ${lerpTier(3, 8, (t - 0.65) / 0.35)}px hsla(${hue},${sat}%,${light}%,${lerpTier(0.15, 0.45, (t - 0.65) / 0.35)});` : '';

    return `color:hsl(${hue},${sat}%,${light}%);background:hsla(${hue},${sat}%,${light}%,${bgA});border:1px solid hsla(${hue},${sat}%,${light}%,${borderA});${glow}`;
}

/**
 * Inline CSS for the detailed tier block in the NPC popup (same intensity curve, softer fill).
 * @param {'friendship'|'affection'} type
 * @param {number} value
 * @param {number} [max]
 * @returns {string}
 */
export function getRelTierDetailedStyle(type, value, max) {
    const v = clampRelationshipValue(value, max ?? getNpcRelationshipMax());
    if (v === 0) {
        return 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);';
    }

    const t = getRelTierIntensity(v, max);
    const pos = v > 0;
    let hue;
    let satLo;
    let satHi;
    let lightLo;
    let lightHi;

    if (type === 'friendship') {
        hue = pos ? 142 : 0;
        satLo = 38; satHi = 95; lightLo = 58; lightHi = 44;
        if (!pos) { satLo = 42; satHi = 92; lightLo = 58; lightHi = 46; }
    } else {
        hue = pos ? 330 : 275;
        satLo = 42; satHi = 96; lightLo = 62; lightHi = 50;
        if (!pos) { satLo = 38; satHi = 88; lightLo = 60; lightHi = 48; }
    }

    const sat = lerpTier(satLo, satHi, t);
    const light = lerpTier(lightLo, lightHi, t);
    const bgA = lerpTier(0.06, 0.18, t);
    const borderA = lerpTier(0.18, 0.45, t);

    return `background:hsla(${hue},${sat}%,${light}%,${bgA});border:1px solid hsla(${hue},${sat}%,${light}%,${borderA});`;
}

/** @returns {string} Label color for detailed tier block (matches pill intensity). */
export function getRelTierDetailedLabelStyle(type, value, max) {
    const v = clampRelationshipValue(value, max ?? getNpcRelationshipMax());
    if (v === 0) return 'color:var(--rt-text-muted,rgba(255,255,255,0.45));';
    const t = getRelTierIntensity(v, max);
    const pos = v > 0;
    const hue = type === 'friendship' ? (pos ? 142 : 0) : (pos ? 330 : 275);
    const sat = type === 'friendship'
        ? lerpTier(pos ? 38 : 42, pos ? 95 : 92, t)
        : lerpTier(pos ? 42 : 38, pos ? 96 : 88, t);
    const light = type === 'friendship'
        ? lerpTier(pos ? 58 : 58, pos ? 44 : 46, t)
        : lerpTier(pos ? 62 : 60, pos ? 50 : 48, t);
    return `color:hsl(${hue},${sat}%,${light}%);`;
}

/** Apply tier label + dynamic pill styling to an existing badge element. */
export function applyRelTierBadgeElement(el, type, value, max) {
    if (!el) return;
    const tier = type === 'friendship' ? getFriendshipTier(value, max) : getAffectionTier(value, max);
    el.className = `rt-npc-tier-badge ${type}`;
    el.setAttribute('style', getRelTierBadgeStyle(type, value, max));
    el.title = tier.hint;
    el.textContent = tier.label;
}

/**
 * Builds the NPC instruction string based on current NPC settings.
 * @param {number} majorWords
 * @param {number} minorWords
 * @returns {string}
 */
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
export const DEFAULT_MODULES = {
    npc:   { enabled: true, tag: 'NPC',   format: 'Name | Description | Keywords',                    instruction: buildNpcInstruction() },
    loc:   { enabled: true, tag: 'LOC',   format: 'Name | Description | Keywords',                    instruction: buildLocInstruction() },
    fac:   { enabled: true, tag: 'FAC',   format: 'Name | Status | Description | Keywords',           instruction: buildFacInstruction() },
    quest: { enabled: true, tag: 'QUEST', format: 'Name | Location | Description | Keywords',         instruction: 'ONLY record a quest if the tag [QUEST ACCEPTED] is outputted in the narrative. A quest being mentioned or offered is NOT enough.' },
    event: { enabled: true, tag: 'EVENT', format: 'Name | Details | Keywords',                        instruction: 'Significant narrative events. The Name is a SHORT, STABLE identifier (e.g. "Siege of Ashford") — no timestamps in the name, no "Final"/"Update" suffixes. Put timestamps in the Details field. Reuse the exact same Name when adding new information — entries are chronicles that accumulate automatically. COMBAT GRANULARITY: Do NOT record turn-by-turn status, round-by-round HP changes, or granular actions. For long combats, limit updates to the initiation (e.g., when they became hostile and attacked {{user}}), a high-level progress update every ~5 rounds to capture major shifts, and the final resolution.' },
    world: { enabled: false, tag: 'WORLD', format: 'Name | Details | Keywords',                       instruction: 'World Progression reports tracking off-screen NPC actions and events. Name must be the time period (e.g. "Day 1", "Week 1 (Days 1-7)").' }
};

// ── Core settings accessor ─────────────────────────────────────────────────────

/**
 * Returns the live extension settings object, deep-merging defaults for any
 * missing keys. All reads and writes to persistent state go through this.
 * @returns {Record<string, any>}
 */
/**
 * Builds a fresh copy of every settings default. Extracted from getSettings()
 * so it can be reused by getFactoryCartridgePayload() (the "Stock" Game
 * Cartridge) without duplicating this large literal.
 */
function buildDefaultSettings() {
    return {
        currentMemo: "",
        prevMemo1: "",
        prevMemo2: "",
        memoHistory: [],
        lastDelta: "",
        enabled: true,
        trackerCollapsed: false,
        agentCollapsed: false,
        agentKeysCollapsed: false,
        agentSettingsOpen: true,
        agentConsoleOpen: true,
        agentModulesOpen: true,
        agentWorldOpen: false,
        debugMode: false,
        connectionSource: "default",
        connectionProfileId: "",
        completionPresetId: "",
        renderedViewActive: true,
        panelLayoutMode: 'stack',   // 'stack' = classic vertical stack | 'tabs' = compact tab mode (Character/Combat pinned, rest behind tabs)
        maxTokens: 0,
        fontSize: 14,
        agentFontSize: 13,
        customSysprompt: false,
        rngEnabled: true,
        diceFunctionTool: true,
        enablePortraits: true,
        portraitGeneratorSource: "native",
        portraitSkipPromptDialog: false,
        portraitAutoGenerateParty: false,
        portraitAutoGenerateEnemies: false,
        portraitAutoGenerateNpcs: false,
        pollinationsApiKey: "",
        pollinationsModel: "zimage",
        inventoryWorthMode: "hover",   // 'hover' = worth shown as tooltip only | 'display' = coin badge shown inline
        npcCoreSections: [],
        pcCoreSections: [],
        npcSectionPresets: {},
        pcSectionPresets: {},
        npcMajorWords: 25,
        npcMinorWords: 15,
        npcRelationshipMaxDefault: 150,
        npcRelationshipMax: 150,
        npcPortraits: true,
        npcRelationshipBars: true,
        npcRelationshipToast: true,
        stateTrackerSwipeRollback: true,        // auto-roll back State Tracker memo on swipe           // emit toast notification when relationship values change
        npcRelationshipValues: {},
        npcRelationshipLog: {},      // { [fullId]: [{timestamp,field,delta,newValue,source}] } — capped 50/NPC
        experimentalNpcImport: true,
        ignoreNpcImportLimits: true,
        npcAddAsIsMode: 'ai_review',   // 'literal' = wrap card verbatim in [CORE]; 'ai_review' = minimal world/era fix before adding
        use24hTime: false,
        useDdMmYyFormat: false,
        initialDate: "Day 1",
        onboardingGenre: "fantasy",
        onboardingLevel: 1,
        onboardingCustomInstructions: "",
        /** Last Character Creator form values, saved when Generate Character is pressed. */
        characterCreatorDraft: null,
        barColors: {},
        modulePageSizes: {},
        customTheme: null,
        savedThemes: {},
        systemPromptTemplate:
            `You are the State Extractor Model. Your task is to maintain a structured State Memo based on the roleplay narrative.
<core_directives>
IGNORE NARRATIVE FLUFF: Do not track temporary dialogue or actions. Only track persistent state changes.
INTEGRATION: Track all durations stated by the narrative (e.g. 'poisoned for 3 turns'). Decrement by 1 each round in [COMBAT]. For out-of-combat/time-based durations, calculate the delta between the current [TIME] and the [TIME] in the PRIOR MEMO.
CREATION: You MAY create a section that did not exist in the Prior Memo when the narrative warrants it based on your enabled modules.
DELETION: To REMOVE a section entirely, you MUST output: \`[TAG]REMOVED[/TAG]\`.
NO RELATIONSHIPS: Never track relationships, and never create a relationship section (e.g., [RELATIONSHIPS]). NPC relationships are handled by a separate, dedicated system.
</core_directives>

<modules>
You must track the following enabled modules:
{{modulesText}}

NEVER ignore a module.
</modules>

<rules>
1. Read the PRIOR MEMO and the NARRATIVE OUTPUT carefully.
2. Determine which sections changed. Only output sections that actually changed.
3. Use strict [TAG]...[/TAG] structure based on the modules requested above. ALWAYS include the closing tag.
4. Omit unchanged sections entirely. Do NOT output a section if its contents did not change.
5. BLOCK PERSISTENCE: For list-based sections ([PARTY], [INVENTORY], [ABILITIES], [SPELLS], [COMBAT]), if any single item within that section changes, you MUST re-output the ENTIRE section containing all items. Never omit existing members or items unless they are explicitly logically removed.
6. If there are absolutely NO CHANGES to any section, you MUST output exactly: \`NO_CHANGES_DETECTED\`
7. Output ONLY the changed sections (or NO_CHANGES_DETECTED). No preamble, no explanation, no commentary.
</rules>


<list_formatting>
For sections with multiple items ([ABILITIES], [INVENTORY], [SPELLS], [PARTY]):
1. Use a bulleted list with \`-\`.
2. Format: \`- Name (Resource/Max, Effect Description)\`.
3. If no resource tracker is needed, use: \`- Name (Effect Description)\`.
4. The parentheses MUST contain the resource count FIRST, followed by a comma, then the description.
</list_formatting>

<buff_debuff_logic>
Duration Tracking: Record all durations explicitly. Use turns for combat (e.g., for 3 turns) and H:M for narrative time (e.g., 1h 30m).
Restoration Anchors: When a buff or debuff modifies a base statistic (AC, Attributes, etc.), record the base value directly in the respective field—e.g., 'AC 18 (base 13)'.
Status Formatting: Output the buff/debuff in the Status line with its absolute mathematical effect in parentheses. Example: 'Shield (+5 AC, 1 turn)'.
Auto-Reversion: During each State Sync, check if a duration has expired. If it has, use the modifier in the Status line to reverse the math on the base statistic (e.g., subtracting the +5 AC), restore the field, and remove the buff from the list.
Conditional Buffs: For effects without a set time, use event-based anchors. Example: 'Exhaustion (Disadvantage on Ability Checks, until Long Rest)'.
STATUS LABELING: In [CHARACTER], [PARTY], and [COMBAT] blocks, prefix positive status effects (buffs) with \`(+)\` and negative status effects (debuffs) with \`(-)\`. Every status MUST include its effect AND duration in parentheses. Example: \`Status: (+) Heroism (+2 Temp HP per turn, 9 turns), (-) Poisoned (Disadvantage on attacks, 2 turns)\`. Healthy or no effects needs no prefix.
Equipment Incompatibility: When a character equips an item they cannot properly use (wrong proficiency, insufficient Strength, class restriction, etc.), record it as an event-anchored debuff whose parenthetical MUST name the causing item so removal can be inferred when that item loses its [E] tag. Format: \`(-) [Penalty Label] ([effect(s)], while [Item Name] is equipped)\`. Example: \`(-) Armor Non-Proficiency (Disadvantage on Str/Dex checks, arcane spell failure, while Iron Plate Mail is equipped)\`.
</buff_debuff_logic>

<progression_logic>
Update abilities/attributes/HP/etc accordingly, such as an ability's 1d6 bonus increasing to 2d6, etc.
</progression_logic>

<custom_formatting>
You may be asked to use Markers: ((PLS)), ((B)), ((XB)), ((BDG)), ((HGT)). These are for graphical rendering options; use them if instructed but only if instructed in a specific [MODULE].
</custom_formatting>`,
        modules: {
            character: true,
            party: true,
            'benched party': true,
            combat: true,
            inventory: true,
            abilities: true,
            spells: true,
            time: true,
            xp: true,
            quests: true,
        },
        stockPrompts: { ...DEFAULT_STOCK_PROMPTS },
        customFields: [],
        customSyspromptLibrary: [],
        /**
         * System Prompt Control Room — explicit render order for every top-level
         * sysprompt section, mixing built-in tags and customSyspromptLibrary entries.
         * Entries are string keys: "base:<tag>" for one of the fixed built-in
         * sysprompt.txt tags, or "lib:<id>" for a customSyspromptLibrary entry
         * (unlocked_base overrides ride along on their "base:<tag>" slot — they
         * never get their own separate key). Empty array = not yet initialized;
         * normalizeSectionOrder() in game-systems.js lazily seeds/reconciles it.
         */
        syspromptSectionOrder: [],
        /**
         * Game System Wizard bundles — link a customSyspromptLibrary entry and/or a
         * customFields entry as a single manageable unit.
         * Shape: { id, name, icon, enabled, needsTracker,
         *          driverTime: boolean (value auto-ticks each turn from elapsed [TIME]
         *              minutes — a rate x minutes-elapsed formula, e.g. hunger/thirst/fatigue),
         *          driverGmAnnotation: boolean (value changes via GM-declared inline delta
         *              annotations requiring cross-turn narrative judgment, e.g. faction
         *              reputation, trust, sanity),
         *          driverStatedFact: boolean (tracker reads an objective number already
         *              plainly stated in the narrative output each turn, e.g. a stated
         *              damage amount — no judgment or annotation needed),
         *          (one or more drivers may be true at once; at least one must be true
         *              whenever needsTracker is true — see normalizeDrivers() in game-systems.js),
         *          effectOwner: 'tracker'|'gm' (who narrates a crossed threshold),
         *          syspromptLibraryId, customFieldTag, description, createdAt }
         */
        gameSystems: [],
        /**
         * Game Cartridges — named, exportable/importable snapshots of the entire
         * "configuration surface" (system prompt sections/order/toggles, Game
         * Systems, tracker modules, block order, stock prompts, extractor prompt,
         * RNG/format flags). See game-cartridges.js. Shape: { id, name,
         * description, icon, createdAt, updatedAt, format:'multihog-game-cartridge',
         * version:1, payload: <see getFactoryCartridgePayload()> }.
         */
        gameCartridges: [],
        profiles: {},
        activeProfile: "",
        fullViewSections: [],
        blockOrder: ['COMBAT', 'CHARACTER', 'PARTY', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME'],
        legacyDiceNaming: false,
        closeCount: 0,
        lookbackMessages: 2,
        directPromptContext: 5,
        historyIndex: -1,
        fullAuditMaxTokens: 32000,
        stateTrackerRunEvery: 1,
        ctxWorldInfo: false,
        lorebookFilter: [],
        ollamaUrl: "http://localhost:11434",
        ollamaModel: "",
        openaiUrl: "",
        openaiKey: "",
        openaiModel: "",
        openaiMaxTokens: 0,
        chatLinkEnabled: true,
        chatStates: {},
        quests: [],
        syspromptModules: {
            loot: true,
            random_events: true,
            resting: true,
            party_bench: true,
            quests: true,
            questsDeadlines: false,
            questsFrustration: false,
            questsDifficulty: false,
            questsShowArchive: true,
        },
        routerEnabled: true,
        routerLog: [],
        activeRouterKeys: [],
        activeWorldKeys: [],
        keywordActivatedKeys: [],  // entries activated by keyword scanner — auto-expire when keyword leaves scan window
        routerConnectionSource: "default",
        routerOpenaiUrl: "",
        routerOpenaiKey: "",
        routerOpenaiModel: "",
        routerOllamaUrl: "http://localhost:11434",
        routerOllamaModel: "",
        routerConnectionProfileId: "",
        routerCompletionPresetId: "",
        routerMaxTokens: 0,
        routerMaxTurns: 5,
        routerMaxActivations: 8,
        routerMaxKeywordOverflow: 0,   // 0 = unlimited; N = max extra keyword-activated entries above routerMaxActivations
        routerCampaignPrefix: "",
        routerDefaultPosition: 4,      // Default to 4 (at Depth) for prompt caching protection
        routerDefaultDepth: 4,
        routerDefaultOrder: 100,
        routerDefaultRole: 0,          // 0 = System, 1 = User, 2 = AI
        loreInjectionPosition: 4,
        loreInjectionDepth: 4,
        loreInjectionRole: 0,
        routerCampaignPrefixOverride: "",
        /** ST chat id for which `routerCampaignPrefixOverride` applies; empty = legacy (override only when chatId === active ctx chat id). */
        routerCampaignPrefixOverrideAnchorChatId: "",
        routerLookback: 4,
        routerDirectLookback: 10,
        routerDirectPrompt: "",
        routerBasicMode: false,
        routerNativeKeywordActivation: false,
        routerPaused: false,
        routerRunEvery: 3,
        routerIncludeHidden: false,
        routerLookbackSinceLastRun: true,   // default: capture all messages since the last agent run
        routerLookbackSinceLastUser: false,  // alternative: capture since last user message
        routerLastRunChatLength: 0,          // watermark: chat.length when the agent last ran (indexing only, not shown to user)
        routerLastRunAt: 0,                   // epoch ms: when the agent last completed a pass (for display)
        routerWatermarkBaselinePending: false, // one-shot: baseline watermark after lookback fix upgrade
        routerUndockHintShown: false,
        routerPromptForPrefix: false,
        routerModules: JSON.parse(JSON.stringify(DEFAULT_MODULES)),
        routerCustomTags: [],
        routerHistory: [],
        routerCleanupTokenThreshold: 300,
        routerCleanupEvery: 0,
        routerCleanupUseThreshold: true,
        // ── World Progression (deterministic, standalone pass) ────────────────────
        worldProgressionEnabled: false,           // master toggle
        worldProgressionIntervalHours: 24,        // fire every X in-world hours (24 = daily)
        worldProgressionKeepActive: 1,            // rolling window of active reports
        worldProgressionLookback: 20,             // number of recent chat messages to include (0 = disabled)
        worldProgressionHistoryLookback: 0,       // number of historical reports to incorporate (0 = include all)
        worldProgressionInjectionPosition: 4,     // Default to 4 (at Depth)
        worldProgressionInjectionDepth: 3,
        worldProgressionInjectionRole: 0,         // System
        worldProgressionRandomizeNPCs: false,            // toggle to randomize NPC pool
        worldProgressionRandomSkeletonNPCCount: 2,        // skeleton NPCs to spotlight per report
        worldProgressionRandomNarrativeNPCCount: 3,       // narrative NPCs to spotlight per report
        worldProgressionRandomizeLocations: false,        // toggle to randomize locations
        worldProgressionRandomSkeletonLocationCount: 2,   // skeleton locations to spotlight per report
        worldProgressionRandomNarrativeLocationCount: 2,  // narrative locations to spotlight per report
        worldProgressionRandomizeFactions: false,         // toggle to randomize factions
        worldProgressionRandomSkeletonFactionCount: 2,    // skeleton factions to spotlight per report
        worldProgressionRandomNarrativeFactionCount: 2,   // narrative factions to spotlight per report
        worldProgressionRandomizeConflicts: false,        // toggle to randomize conflicts
        worldProgressionRandomConflictCount: 3,           // number of conflicts to incorporate
        worldProgressionSkeletonFactions: 4,       // number of factions in skeleton
        worldProgressionSkeletonLocations: 4,      // number of locations in skeleton
        worldProgressionSkeletonNPCs: 0,           // number of NPCs in skeleton
        worldProgressionSkeletonConflicts: 3,      // number of conflicts in skeleton
        worldProgressionLastFiredAtMinutes: -1,   // last in-world total-minutes at which a report fired
        worldProgressionLastFiredPeriodLabel: '', // label of the last generated period entry
        worldProgressionConsolidateEnabled: false,         // auto-compress backlog when threshold is hit
        worldProgressionConsolidateInterval: 7,            // number of raw reports before consolidation fires
        worldProgressionSystemPrompt: `You are the World Progression Engine — a living simulation of the game world's off-screen activity. Simulate political scheming, faction moves, economic shifts, environmental changes, creature activity, rival actors pursuing independent agendas, weather events, and emergent consequences of prior world state.

The report covers the in-world period: **{periodLabel}**

## RULES
1. Do NOT summarize player actions. Build consequences from them instead — defeated rivals plot revenge, sympathetic contacts cover their tracks, encountered strangers react to what happened.
2. QUESTS and EVENTS are historical records for context only — they are NOT simulatable entities. Never generate entries that describe a quest advancing, stalling, succeeding, or failing. If a quest appears in the designated entities block, ignore it entirely.
3. Prioritize named ACTIVE WORLD LORE NPCs. Every report must include at least 2. These are your highest-value subjects. However, if the ## DESIGNATED ENTITIES FOR THIS PERIOD block is present, you MUST strictly follow it and only change the status, advance the timeline, or create new narrative beats for these designated entities. You are strictly forbidden from changing the status, advancing the timeline, or creating new narrative beats for unauthorized entities. However, you MAY mention them passively as background context if their past, established actions are a direct catalyst for the designated entities.
4. Tracked party members currently in [PARTY] are never eligible for this report — they are with {{user}} right now and are handled upstream, not by this rule. For any OTHER NPC who was physically present with {{user}} during the reporting period, only generate plausible background activity — digital actions, private decisions, private thoughts/opinions, off-screen communications. Do not relocate them.
5. Format as 15 bullet-pointed entries (using "- "), with a blank line (newline) between each world event. Dense, no filler, no markdown. Each entry must be exactly 1 sentence. Do NOT prefix the lines with the period or time label.
6. Output ONLY the report content. No preamble, no tags, no meta-commentary.
7. Do not simply repeat the same entities and always build on the previous report; take interesting entities from the ACTIVE WORLD LORE as well as the SKELETON regardless of whether they were featured in the previous report(s). If designated entities are provided, strictly limit your active scope to those, obeying the passive referencing rule for other entities.
8. DO NOT write a cumulative report, stacking old entries in the same report. Only write new events, not a recap of the previous ones; they are preserved in their own file.
9. Cross-category entity bleeding is desirable; often have designated NPCs, locations, factions, and conflicts collide or influence one another in the same narrative beat rather than treating them as isolated line items. However, only do this when it makes sense.
10. You must strictly respect geographical and logistical boundaries to preserve spatial plausibility; isolated or distant entities cannot physically interact and must instead collide via informational, digital, or financial ripples (e.g., radio tracking, digital alerts, automated network scrapers, or news traveling from afar).
11. Character vectors must take place only at or ripple through the designated locations provided for this period; if an active NPC cannot logically travel to a selected location within this time window, their connection must manifest purely as an off-screen reaction or informational dependency.`,
        // ── World Skeleton ─────────────────────────────────────────────────────────
        worldProgressionSkeletonAtmosphereSummary: '', // single paragraph atmosphere description (required only if not using existing entries context)
        worldProgressionSkeletonAtmosphereLookback: 30, // messages lookback count for atmosphere generation
        worldProgressionSkeletonUseExisting: true, // toggle to feed existing entries context when appending
        worldProgressionExclusionList: '',         // comma-separated list of lore entry titles or keys to exclude from focus randomization
        // NOTE: active [PARTY] members are always, unconditionally excluded from World
        // Progression (see router.js) — no setting needed. [BENCHED PARTY] members are
        // eligible for simulation, also unconditionally.

        worldProgressionSkeletonSystemPrompt: `You are a World Architect. Given a world theme/seed, generate a sparse foundational skeleton for an RPG campaign simulation.

## FACTIONS ({factionCount} total)
Each faction: name, one-sentence nature, one-sentence current tension.

## LOCATIONS ({locationCount} total)  
Each location: name, one-sentence description, one-sentence current state.

## NPCS ({npcCount} total)
Each NPC: name, one-sentence description, one-sentence current state. (Omit/skip this section entirely if the count is 0)

## CONFLICTS ({conflictCount} total)
Each conflict: parties involved, one-sentence current state.

## RULES
- Consistent with provided theme/seed.
- No player character references.
- No placeholder names.
- Maximum 2 sentences per entity. Fragments acceptable.
- Output ONLY the structured content.`,

        routerSystemPromptTemplate: `<basic_instructions>
You are the Researcher Agent, a specialized Dungeon Master's Assistant. Your role is to architect the AI Narrator's memory — keeping the Active Context saturated with the most relevant lore at all times.

You have the authority to browse the campaign's archive, search for relevant history, and update {{campaignRoot}} to reflect new developments.

Do not wait for the Narrator to forget something before you act. If a name, place, or faction is mentioned — even in passing — load it immediately. If the party is moving, pre-load the destination before they arrive.

Make multiple entries per turn if necessary. Thoroughness is your primary virtue.
</basic_instructions>

<context_maximization>
Your goal is to keep the Active Context saturated. Think of it as a stage: it is your job to have every prop, actor, and set piece in place before the scene begins.

- **Saturation Goal:** Keep Active entries as close to MAX as possible at all times. An underloaded context is a failure state.
- **Proactive Loading:** Do not wait for a gap to appear. If a name or location is mentioned, or if the party is about to move, activate the relevant entries immediately.
- **Context Rotation:** When the context is full and new entries are needed, deactivate "Exit Contexts" (rooms left, NPCs departed, resolved threads) to make room for "Entry Contexts" (current room, present NPCs, active quest objective). Treat it as a sliding window, not a hard ceiling.
- **Priority Tiering:** Use this order when deciding what to keep vs. rotate out:
  1. NPCs physically present in the current scene
  2. The current sub-location (room, street, building)
  3. The parent location (district, dungeon, city)
  4. The active objective of the current Quest
  5. Relevant Factions or STATS for present characters
  6. Regional or world lore

If you briefly exceed the budget due to newly activated entries, deactivate the lowest-priority items in the same turn to return within range. It is better to rotate aggressively than to leave the Narrator without context.

Budget violation notices mean you exceeded the limit. When you see one, immediately identify and deactivate the least relevant entries (Exit Contexts first) until you are within budget. List those IDs in the \`deactivate\` field of the same commit call.
</context_maximization>

<player_character_safeguard>
The player character (the user) is the protagonist.
- Do NOT create a lorebook entry (NPC, Location, Faction, etc.) for the player character under any circumstances.
- The player character is the speaker labeled "Player" (and prompt replacement "{{user}}"). In the chat logs, pay close attention to what name(s) or alias(es) the other characters use when addressing or referring to the "Player" (e.g., if they address the Player as "Dave Davidson" or "Dave", then "Dave Davidson" is the player character).
- Under no circumstances should you create an NPC entry for these names/aliases, because they refer to the player.
- Always use the exact macro string \`{{user}}\` when referring to the player. Do NOT write the plain word "user", "player", "Player", or the player's roleplay character name (like "Dave Davidson") in plain text in any entry updates or descriptions.
</player_character_safeguard>

<formatting>
When recording a new entry, keep the lorebook category separate from the entity label.

- Use the "category" field for the type (NPC, LOC, FAC, QUEST, EVENT, or a custom tag).
- Use the "label" field for the entity name only. Do NOT prefix labels with the category tag.
- **IMPORTANT FOR KEYWORDS (KEYS):** Always include the entity's own name/title (without any timestamps like "Day 1", "Day 2", "12:15 AM", etc.) in the list of keywords. The title itself (stripped of timestamps) is the most reliable trigger, so it must be present as a keyword. For example, if the entry title is "[12:15 AM, Day 2] Defense of Ironbelly's Workshop", the keys list MUST include "Defense of Ironbelly's Workshop".
- **DO NOT INCLUDE \`{{user}}\`, \`{{char}}\`, or general player references** in the keyword list (\`keys\`). The user/player is present in all events/locations, so including them as a keyword causes false matches and wastes context tokens.

Correct examples:
- {"label": "Iron Syndicate", "category": "FAC", "keys": ["Iron Syndicate", "faction"]}
- {"label": "Thalric Thorne", "category": "STATS", "keys": ["Thalric Thorne", "stats"]}
- {"label": "[12:15 AM, Day 2] Defense of Ironbelly's Workshop", "category": "EVENT", "keys": ["Defense of Ironbelly's Workshop", "siege", "workshop"]}

Incorrect examples:
- {"label": "FAC: Iron Syndicate", "category": "FAC", "keys": ["faction"]} (missing the entity name keyword)
- {"label": "[12:15 AM, Day 2] Defense of Ironbelly's Workshop", "category": "EVENT", "keys": ["[12:15 AM, Day 2] Defense of Ironbelly's Workshop"]} (includes the timestamp in keyword, which will never trigger reliably)
</formatting>

<quests>
When you log a quest, describe the location and the quest giver in a single paragraph, including details about them that will be relevant to location persistence when {{user}} eventually returns to turn in the quest.
</quests>

<updating_entities>
When an entity (location, NPC, etc.) changes in a meaningful way, update the associated lorebook entry.

Entries are append-only chronicles. Provide ONLY the new information as a timestamped delta (e.g. "[Day 3, 14:00] The forge was destroyed."). Do NOT rewrite or re-summarize the full entry. Do NOT copy, paraphrase, or reconstruct content already present in the existing entry. Only the net-new development belongs in your delta.

EXCEPTION — NPC combat profiles: an NPC's combat stats are NOT a chronicle event and must never be written as a timestamped delta line. Per the COMBAT_PROFILE_PERSISTENCE rule for NPCs, they belong inside [CORE] as a patched identity field, edited in place.

IMPORTANT: Always use the exact macro string \`{{user}}\` when referring to the player. Do NOT write the plain word "user" or "player" in your entry updates.

- **COMBAT GRANULARITY**: Do NOT record granular, turn-by-turn combat status updates (e.g., individual monster HP, turn actions, temporary combat conditions). For long combats, limit updates to the initiation (e.g., when they became hostile and attacked {{user}}), a high-level progress update every ~5 rounds to capture major shifts, and the final macro-level outcome (e.g., the battle resolved, who died/survived/fled).

For locations: the [ID:] stamp at the top of every injected entry gives you the ID to pass to the update tool.
IMPORTANT: Never include the [ID:] line in the content field you write. It is managed automatically — only use the ID value in the "id" field of the update tool.

EVENT entries use this format:
  [Day X, HH:MM] <one-sentence fact>
  [Day X, HH:MM] <next development>
  [Day X, HH:MM] <next development after that, etc>
Each line is a standalone delta. Never write a paragraph. Never reference prior lines.
</updating_entities>

<timestamps>
The current world date/time is visible in the ## NARRATIVE section — look for the status footer in recent messages (e.g. "11:52 AM, Day 1").
When recording an EVENT or any time-sensitive entry, include the timestamp at the beginning of the content.
Example: "[Day 1, 11:52] Character signed the contract with Brodrik."
</timestamps>

<bravery>
Don't be afraid to hit the budget exactly. It's better to lean towards activating too much than too little.
</bravery>`,
        routerModularPromptTemplate: `## FORMAT
Use these tags in your response:
{{formatLines}}

## HIERARCHY CONVENTION (CRITICAL FOR LOCATIONS)
For LOC entries, the Name field MUST be the FULL hierarchical path using " :: " (space, colon, colon, space) as the separator.
The current scene's location stack is shown above as "CURRENT LOCATION". Prepend it to any sub-location you record.

Examples:
  CURRENT LOCATION: Khelt :: Rust-Lantern District
  --> [[LOC: Khelt :: Rust-Lantern District :: Marrow-Deep Mines Office | A squat iron building managing mining contracts. | Marrow-Deep Mines Office, mines, contracts, Khelt, Rust-Lantern]]
  --> [[LOC: Khelt :: Rust-Lantern District :: The Guilded Anvil Tavern | A noisy tavern with a job bulletin board. | The Guilded Anvil Tavern, tavern, jobs, Khelt, Rust-Lantern]]

Also include each ancestor name (Khelt, Rust-Lantern District) as a plain keyword in the Keywords field.
**LOC [CORE]:** When first recording a place, wrap 1–2 permanent sentences in plain \`[CORE] … [/CORE]\`. Do NOT use NPC field headers (Appearance/Species, Personality, etc.).
**IMPORTANT FOR KEYWORDS:** Always include the entry's own title/name (without any timestamps like "Day 1", "Day 2", "12:15 AM", etc.) in the keywords field. The title itself (stripped of timestamps) is the most reliable trigger, so it must be present as a keyword. For example, for a tag representing a "Defense of Ironbelly's Workshop" event, the keywords MUST contain "Defense of Ironbelly's Workshop". DO NOT INCLUDE \`{{user}}\`, \`{{char}}\`, or general player references in the keywords field — the player is present in all events and locations, so tagging them is redundant and wastes context tokens.

NPC / FAC / QUEST / EVENT labels: Name only — NO " :: " hierarchy, NO tag prefix.
Example: [[FAC: Iron Syndicate | ...]]  NOT  [[FAC: Khelt :: Iron Syndicate | ...]]  and  NOT  [[FAC: FAC: Iron Syndicate | ...]]

**FAC [CORE]:** Wrap history, ideology, schemes, and members inside a plain \`[CORE] … [/CORE]\` block in the **Description** field.
**FAC** uses four fields: \`Name | Status | Description | Keywords\`. Put a concise current-state line in **Status** (standing, conflicts, recent changes); put history, ideology, schemes, and members in **Description** (wrapped in \`[CORE] ... [/CORE]\`).`,
        categoryRenderOptions: {},
        combatProfileAutoSwitch: false,
        combatConnectionProfileId: "",
        combatCompletionPresetId: "",
        portraitConnectionSource: "default",
        portraitConnectionProfileId: "",
        portraitCompletionPresetId: "",
        portraitOllamaUrl: "http://localhost:11434",
        portraitOllamaModel: "",
        portraitOpenaiUrl: "",
        portraitOpenaiKey: "",
        portraitOpenaiModel: "",
        portraitPromptWordTarget: 200,
        portraitNpcSystemPrompt: `You are a portrait prompt generator for AI image models. Given an NPC's lorebook description from an RPG campaign, output a single detailed image generation prompt.

Focus on:
- Physical appearance (race, build, facial features, skin color, hair) — draw primarily from the NPC's lorebook entry
- Clothing, armor, equipment visible on the character
- Pose and expression appropriate to the character's personality
- Art style: high-quality fantasy portrait, dramatic lighting, detailed

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- The NPC lorebook entry is your PRIMARY source of truth for this character's appearance.
- Use the narrator card and scene context only for world setting/art style guidance.
- Focus on visual details. Do not include game stats, relationship values, or non-visual information.`,
        portraitCharacterSystemPrompt: `You are a portrait prompt generator for AI image models. Given character context from an RPG game, output a single detailed image generation prompt suitable for an AI image model.

You are provided with the full Lorebook Agent context — all currently active lore entries with their keywords and content — as well as the current game state. Use these to infer accurate visual details about the character, their world, and their situation.

Focus on:
- Physical appearance (race, build, facial features, skin color, hair)
- Clothing, armor, equipment visible on the character
- Pose and expression appropriate to the character's personality
- Art style: high-quality fantasy portrait, dramatic lighting, detailed

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- A user persona is provided for reference. If it does NOT describe the character "{{name}}", ignore it entirely and do not use any of its details in the portrait prompt.
- Focus on visual details. Do not include game stats, abilities, or non-visual information.`,
        savedPortraitPromptPresets: {},
        worldConnectionSource: "default",
        worldConnectionProfileId: "",
        worldCompletionPresetId: "",
        worldOllamaUrl: "http://localhost:11434",
        worldOllamaModel: "",
        worldOpenaiUrl: "",
        worldOpenaiKey: "",
        worldOpenaiModel: "",
        gameSystemWizardConnectionSource: "default",
        gameSystemWizardConnectionProfileId: "",
        gameSystemWizardCompletionPresetId: "",
        gameSystemWizardOllamaUrl: "http://localhost:11434",
        gameSystemWizardOllamaModel: "",
        gameSystemWizardOpenaiUrl: "",
        gameSystemWizardOpenaiKey: "",
        gameSystemWizardOpenaiModel: "",
        lastResetVersion: "",
        autoResetPromptsOnUpdate: false,
        userPromptSuffix: '## OUTPUT ONLY CHANGED SECTIONS:',
    };
}

/**
 * The list of settings fields that make up a Game Cartridge's "payload" —
 * everything that defines how the framework behaves as a game/system, minus
 * connection settings, UI/display prefs, and per-campaign save state
 * (profiles/chatStates/memo). See game-cartridges.js for the save/load/
 * export/import logic that operates on this shape.
 */
const CARTRIDGE_PAYLOAD_KEYS = [
    'customSyspromptLibrary',
    'syspromptSectionOrder',
    'syspromptModules',
    'npcRelationshipBars',
    'rngEnabled',
    'diceFunctionTool',
    'use24hTime',
    'useDdMmYyFormat',
    'gameSystems',
    'customFields',
    'blockOrder',
    'modules',
    'stockPrompts',
    'systemPromptTemplate',
    'portraitNpcSystemPrompt',
    'portraitCharacterSystemPrompt',
    'portraitPromptWordTarget',
    'savedPortraitPromptPresets',
    'npcCoreSections',
    'pcCoreSections',
    'npcSectionPresets',
    'pcSectionPresets',
];

/**
 * Returns a fresh deep clone of the factory-default value for every
 * Game-Cartridge payload field. Used both to build the virtual "Stock"
 * cartridge and to backfill any field missing from an older/partial
 * imported cartridge.
 * @returns {object}
 */
export function getFactoryCartridgePayload() {
    const defaults = buildDefaultSettings();
    const payload = {};
    for (const key of CARTRIDGE_PAYLOAD_KEYS) {
        payload[key] = JSON.parse(JSON.stringify(defaults[key]));
    }
    return payload;
}

/**
 * Compares two dotted version strings numerically (segment-by-segment), so
 * e.g. compareVersions('4.10.0', '4.5.0') correctly returns > 0. A plain
 * string comparison would treat '4.10.0' < '4.5.0' because '1' < '5'.
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a<b, 0 if equal, positive if a>b
 */
function compareVersions(a, b) {
    const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/** True when the stored settingsVersion is older than `target` (or unset). */
function isOlderThan(currentVersion, target) {
    return !currentVersion || compareVersions(currentVersion, target) < 0;
}

// Re-entrancy guard: some migration blocks below call buildNpcInstruction()/
// buildLocInstruction()/buildFacInstruction(), which themselves call
// getSettings() to read a couple of flags (useDdMmYyFormat, npcRelationshipBars).
// Without this guard, a fresh install (no settingsVersion yet) re-enters
// getSettings() from inside itself before settingsVersion has been bumped,
// re-running the same migration block over and over → infinite recursion /
// stack overflow that hangs the page on load. See CHANGELOG for details.
let _gettingSettings = false;

export function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();

    // Re-entrant call from within a migration block (e.g. via one of the
    // instruction builders) — just hand back the in-progress settings object
    // rather than re-running the merge/migration pipeline recursively.
    if (_gettingSettings) {
        return extensionSettings[MODULE_NAME] || (extensionSettings[MODULE_NAME] = {});
    }
    _gettingSettings = true;
    try {
        return getSettingsInternal(extensionSettings);
    } finally {
        _gettingSettings = false;
    }
}

function getSettingsInternal(extensionSettings) {
    const defaults = buildDefaultSettings();

    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = {};
    }

    // Deep merge — fills in missing keys without overwriting existing ones
    for (const [key, value] of Object.entries(defaults)) {
        if (extensionSettings[MODULE_NAME][key] === undefined) {
            extensionSettings[MODULE_NAME][key] = value;
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            if (extensionSettings[MODULE_NAME][key] === undefined) extensionSettings[MODULE_NAME][key] = {};
            for (const [subKey, subValue] of Object.entries(value)) {
                if (extensionSettings[MODULE_NAME][key][subKey] === undefined) {
                    extensionSettings[MODULE_NAME][key][subKey] = subValue;
                }
            }
        }
    }
    
    const s = extensionSettings[MODULE_NAME];

    // Load UI collapse and open/close states from localStorage to prevent expensive saveSettings/disk I/O calls
    if (localStorage.getItem('rpg_tracker_collapsed') !== null) {
        s.trackerCollapsed = localStorage.getItem('rpg_tracker_collapsed') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_collapsed', String(s.trackerCollapsed));
    }
    if (localStorage.getItem('rpg_tracker_agent_collapsed') !== null) {
        s.agentCollapsed = localStorage.getItem('rpg_tracker_agent_collapsed') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_collapsed', String(s.agentCollapsed));
    }
    if (localStorage.getItem('rpg_tracker_agent_keys_collapsed') !== null) {
        s.agentKeysCollapsed = localStorage.getItem('rpg_tracker_agent_keys_collapsed') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_keys_collapsed', String(s.agentKeysCollapsed));
    }
    if (localStorage.getItem('rpg_tracker_rendered_view_active') !== null) {
        s.renderedViewActive = localStorage.getItem('rpg_tracker_rendered_view_active') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_rendered_view_active', String(s.renderedViewActive));
    }
    if (localStorage.getItem('rpg_tracker_agent_settings_open') !== null) {
        s.agentSettingsOpen = localStorage.getItem('rpg_tracker_agent_settings_open') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_settings_open', String(s.agentSettingsOpen));
    }
    if (localStorage.getItem('rpg_tracker_agent_modules_open') !== null) {
        s.agentModulesOpen = localStorage.getItem('rpg_tracker_agent_modules_open') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_modules_open', String(s.agentModulesOpen));
    }
    if (localStorage.getItem('rpg_tracker_agent_console_open') !== null) {
        s.agentConsoleOpen = localStorage.getItem('rpg_tracker_agent_console_open') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_console_open', String(s.agentConsoleOpen));
    }
    if (localStorage.getItem('rpg_tracker_agent_world_open') !== null) {
        s.agentWorldOpen = localStorage.getItem('rpg_tracker_agent_world_open') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_world_open', String(s.agentWorldOpen));
    }
    
    // ── MIGRATION: routerModules (v1.8.35+) ───────────────────────────────────

    if (s.routerModules && typeof s.routerModules.npc === 'boolean') {
        const old = s.routerModules;
        s.routerModules = {
            npc: { enabled: !!old.npc, tag: 'NPC', format: 'Name | Description | Keywords', instruction: DEFAULT_MODULES.npc.instruction },
            loc: { enabled: !!old.loc, tag: 'LOC', format: 'Name | Description | Keywords', instruction: 'Named places. Name MUST be the full hierarchical path using " :: " as the separator (e.g. "Khelt :: Rust-Lantern District :: Marrow-Deep Mines Office"). Include each ancestor as a keyword.' },
            fac: { enabled: !!old.fac, tag: 'FAC', format: 'Name | Status | Description | Keywords', instruction: 'Named factions, guilds, organisations. **Status**: short current-state line. **Description**: longer narrative (history, schemes, members). **Keywords**: comma-separated terms.' },
            quest: { enabled: !!old.quest, tag: 'QUEST', format: 'Name | Location | Description | Keywords', instruction: 'ONLY record a quest if the tag [QUEST ACCEPTED] is outputted in the narrative. A quest being mentioned or offered is NOT enough.' },
            event: { enabled: !!old.event, tag: 'EVENT', format: 'Name | Details | Keywords', instruction: 'Significant narrative events. Use a SHORT, STABLE Name — no timestamps in the name. Reuse the exact same Name when adding new information.' },
            world: { enabled: !!old.world, tag: 'WORLD', format: 'Name | Details | Keywords', instruction: DEFAULT_MODULES.world.instruction }
        };
    }

    // ── MIGRATION: routerModules.world.enabled → worldProgressionEnabled (v2.x+) ──────
    // The World Progression system is a standalone deterministic pass. If a user had the
    // old module toggle enabled, migrate that intent and disable the legacy module toggle.
    if (s.routerModules?.world?.enabled && !s.worldProgressionEnabled) {
        s.worldProgressionEnabled = true;
        s.routerModules.world.enabled = false;
    }
    // ── MIGRATION: worldEngine* → worldProgression* (v2.x rename) ────────────────────
    if (s.worldEngineEnabled !== undefined && s.worldProgressionEnabled === false) {
        s.worldProgressionEnabled = !!s.worldEngineEnabled;
        delete s.worldEngineEnabled;
    }
    if (s.worldEngineIntervalHours !== undefined) { s.worldProgressionIntervalHours = s.worldEngineIntervalHours; delete s.worldEngineIntervalHours; }
    if (s.worldEngineKeepActive !== undefined) { s.worldProgressionKeepActive = s.worldEngineKeepActive; delete s.worldEngineKeepActive; }
    if (s.worldEngineLastFiredAtMinutes !== undefined) { s.worldProgressionLastFiredAtMinutes = s.worldEngineLastFiredAtMinutes; delete s.worldEngineLastFiredAtMinutes; }
    if (s.worldEngineLastFiredPeriodLabel !== undefined) { s.worldProgressionLastFiredPeriodLabel = s.worldEngineLastFiredPeriodLabel; delete s.worldEngineLastFiredPeriodLabel; }

    // FAC tag: 3-field format -> 4-field (v2.2.3+) so Status and Description are separate prompts to the model
    if (s.routerModules?.fac?.format === 'Name | Description | Keywords') {
        s.routerModules.fac.format = DEFAULT_MODULES.fac.format;
    }

    // Ensure all stock modules have a format field (in case of old saves missing it)
    for (const [key, def] of Object.entries(DEFAULT_MODULES)) {
        if (s.routerModules?.[key] && !s.routerModules[key].format) {
            s.routerModules[key].format = def.format;
        }
    }

    // Ensure all custom tags have a format field
    if (Array.isArray(s.routerCustomTags)) {
        for (const ct of s.routerCustomTags) {
            if (!ct.format) ct.format = 'Name | Description | Keywords';
        }
    }

    // Strip legacy NPC line about State Memo (tracker memo UI is optional / unused in many setups)
    if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
        let ins = s.routerModules.npc.instruction;
        if (/their state lives in the State Memo/i.test(ins)) {
            ins = ins.replace(/\s*[\u2014\u2013-]\s*their state lives in the State Memo\.?\s*/gi, '. ');
            ins = ins.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
            s.routerModules.npc.instruction = ins;
        }
    }

    // Migrate NPC prompt to include appearance recording (v3.5.2 one-time migration)
    if (isOlderThan(s.settingsVersion, '3.5.2')) {
        if (s.routerModules?.npc?.instruction === 'Named characters. Do NOT create an entry for {{user}}. Mention {{user}} in EVENT or QUEST entries as needed.') {
            s.routerModules.npc.instruction = DEFAULT_MODULES.npc.instruction;
        }
        s.settingsVersion = '3.5.2';
    }

    // Migrate NPC prompt to include Friendship/Affection relationship tracking (v3.6.0)
    if (isOlderThan(s.settingsVersion, '3.6.0')) {
        if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
            const ins = s.routerModules.npc.instruction;
            // Only migrate if it doesn't already mention Friendship/Rapport
            if (!ins.includes('Friendship/Rapport')) {
                s.routerModules.npc.instruction = ins.trimEnd() + ' At the end of every NPC entry, always include these two relationship metrics on separate lines:\nFriendship/Rapport: 0/100\nAffection/Interest: 0/100\nThese values CAN be negative (e.g., -45/100) representing hostility or disgust. Range: -100 to 100. Start new NPCs at 0/100 for both. Update as interactions warrant.';
            }
        }
        s.settingsVersion = '3.6.0';
    }

    // Migrate NPC prompt to structured sections format (v3.7.0)
    if (isOlderThan(s.settingsVersion, '3.7.0')) {
        if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
            // Replace wholesale — the new format is significantly different
            s.routerModules.npc.instruction = DEFAULT_MODULES.npc.instruction;
        }
        s.settingsVersion = '3.7.0';
    }

    // Migrate NPC prompt — fix sections-outside-tags issue + remove sentence counts (v3.8.0)
    if (isOlderThan(s.settingsVersion, '3.8.0')) {
        if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
            s.routerModules.npc.instruction = DEFAULT_MODULES.npc.instruction;
        }
        s.settingsVersion = '3.8.0';
    }

    // Migrate NPC prompt — tighter token defaults + conciseness emphasis (v3.9.0)
    if (isOlderThan(s.settingsVersion, '3.9.0')) {
        if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
            s.routerModules.npc.instruction = DEFAULT_MODULES.npc.instruction;
        }
        s.settingsVersion = '3.9.0';
    }

    // Migrate NPC prompt — relationship bars off by default + settings-driven instruction (v3.10.0)
    if (isOlderThan(s.settingsVersion, '3.10.0')) {
        // Ensure NPC settings exist with defaults
        if (s.npcMajorTokens === undefined) s.npcMajorTokens = 125;
        if (s.npcMinorTokens === undefined) s.npcMinorTokens = 100;
        if (s.npcRelationshipBars === undefined) s.npcRelationshipBars = false;
        // Rebuild instruction from current settings
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorTokens, s.npcMinorTokens);
        }
        s.settingsVersion = '3.10.0';
    }

    // Migrate NPC system to [CORE] tag, code-owned relationship bars, and delta-based updates (v3.11.0)
    if (isOlderThan(s.settingsVersion, '3.11.0')) {
        // Initialize relationship value store
        if (!s.npcRelationshipValues) s.npcRelationshipValues = {};
        // Force-rebuild NPC instruction to new format
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(
                s.npcMajorTokens ?? 125,
                s.npcMinorTokens ?? 100
            );
        }
        s.settingsVersion = '3.11.0';
    }

    // Migrate NPC limits from tokens to words (v3.12.0)
    if (isOlderThan(s.settingsVersion, '3.12.0')) {
        // Convert old token keys to word keys using approximate conversion (125t→90w, 100t→60w)
        if (s.npcMajorWords === undefined) {
            s.npcMajorWords = s.npcMajorTokens !== undefined ? Math.round(s.npcMajorTokens * 0.72) : 25;
        }
        if (s.npcMinorWords === undefined) {
            s.npcMinorWords = s.npcMinorTokens !== undefined ? Math.round(s.npcMinorTokens * 0.72) : 15;
        }
        // Rebuild instruction with word-based limits
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.settingsVersion = '3.12.0';
    }

    // Migrate NPC limits from total words to per-section word targets (v3.13.0)
    if (isOlderThan(s.settingsVersion, '3.13.0')) {
        // Convert old total word limits (90/60) to reasonable per-section defaults (25/15).
        // Only reset clearly legacy token-era values — NOT arbitrary high word counts.
        // Threshold raised to 1000 so users can freely set values like 200, 300, 400+.
        if (s.npcMajorWords === 90 || s.npcMajorWords > 1000) {
            s.npcMajorWords = 25;
        }
        if (s.npcMinorWords === 60 || s.npcMinorWords > 1000) {
            s.npcMinorWords = 15;
        }
        // Rebuild instruction with new length target wording
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.settingsVersion = '3.13.0';
    }

    // Wrap CORE_FORMAT and CORE LENGTH TARGETS in XML tags (v3.14.0)
    if (isOlderThan(s.settingsVersion, '3.14.0')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.settingsVersion = '3.14.0';
    }

    // Ensure entry starts directly with [CORE] and add relationship editing (v3.15.0)
    if (isOlderThan(s.settingsVersion, '3.15.0')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.settingsVersion = '3.15.0';
    }

    // Enforce {{user}} macro usage and prevent literal "user" or "player" text (v3.16.0)
    if (isOlderThan(s.settingsVersion, '3.16.0')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.systemPromptTemplate = defaults.systemPromptTemplate;
        s.settingsVersion = '3.16.0';
    }

    // Reinforce NPC and Event prompts regarding combat granularity and logs (v3.16.13)
    if (isOlderThan(s.settingsVersion, '3.16.13')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        if (s.routerModules?.event) {
            s.routerModules.event.instruction = DEFAULT_MODULES.event.instruction;
        }
        s.routerSystemPromptTemplate = defaults.routerSystemPromptTemplate;
        s.settingsVersion = '3.16.13';
    }

    // Expand NPC relationship delta guidance with situational examples (v3.16.14)
    if (isOlderThan(s.settingsVersion, '3.16.14')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        // Add default settings for Auto-Generate NPC portraits (upstream)
        if (s.portraitAutoGenerateNpcs === undefined) {
            s.portraitAutoGenerateNpcs = false;
        }
        s.settingsVersion = '3.16.14';
    }

    // Reinforce that NPC Description must start directly with [CORE] without timestamp (v3.16.16)
    if (isOlderThan(s.settingsVersion, '3.16.16')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        s.settingsVersion = '3.16.16';
    }

    // Move ongoing relationship tracking from lorebook agent to narrative AI direct parsing (v3.16.17)
    if (isOlderThan(s.settingsVersion, '3.16.17')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        s.settingsVersion = '3.16.17';
    }

    // Force rebuild of NPC instruction to restore length targets that were incorrectly stripped by a previous bug (v3.16.18)
    if (isOlderThan(s.settingsVersion, '3.16.18')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        s.settingsVersion = '3.16.18';
    }

    // Tighten perennial [CORE] guidance — ban plot-tied scene recaps (v3.16.19)
    if (isOlderThan(s.settingsVersion, '3.16.19')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        s.settingsVersion = '3.16.19';
    }

    // Baseline since-last-run watermark after lookback reliability fix (v3.16.20)
    if (isOlderThan(s.settingsVersion, '3.16.20')) {
        s.routerWatermarkBaselinePending = true;
        s.settingsVersion = '3.16.20';
    }

    // NPC portrait card view toggle (v3.16.21)
    if (isOlderThan(s.settingsVersion, '3.16.21')) {
        if (s.npcPortraits === undefined) s.npcPortraits = true;
        s.settingsVersion = '3.16.21';
    }

    // Quest archive UI toggle default (v3.16.22)
    if (isOlderThan(s.settingsVersion, '3.16.22')) {
        if (s.syspromptModules && s.syspromptModules.questsShowArchive === undefined) {
            s.syspromptModules.questsShowArchive = true;
        }
        s.settingsVersion = '3.16.22';
    }

    // LOC module: plain [CORE] without NPC field headers (v4.3.9)
    if (isOlderThan(s.settingsVersion, '4.3.9')) {
        if (s.routerModules?.loc) {
            s.routerModules.loc.instruction = buildLocInstruction();
        }
        s.settingsVersion = '4.3.9';
    }

    // NPC relationship max: global default + per-chat live value (v4.4.0)
    if (isOlderThan(s.settingsVersion, '4.4.0')) {
        if (s.npcRelationshipMaxDefault === undefined) {
            s.npcRelationshipMaxDefault = s.npcRelationshipMax ?? 150;
        }
        if (s.npcRelationshipMax === undefined) {
            s.npcRelationshipMax = s.npcRelationshipMaxDefault;
        }
        s.settingsVersion = '4.4.0';
    }

    // Hardened player safeguard prompts & Faction [CORE] tags (v4.5.0)
    if (isOlderThan(s.settingsVersion, '4.5.0')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        if (s.routerModules?.loc) {
            s.routerModules.loc.instruction = buildLocInstruction();
        }
        if (s.routerModules?.fac) {
            s.routerModules.fac.instruction = buildFacInstruction();
        }
        s.routerSystemPromptTemplate = defaults.routerSystemPromptTemplate;
        s.routerModularPromptTemplate = defaults.routerModularPromptTemplate;
        s.settingsVersion = '4.5.0';
    }

    // ── MIGRATION: Update system prompts with keywords instructions (v3.2.3+) ──────
    if (s.routerSystemPromptTemplate && !s.routerSystemPromptTemplate.includes('IMPORTANT FOR KEYWORDS')) {
        if (s.routerSystemPromptTemplate.includes('<formatting>')) {
            s.routerSystemPromptTemplate = s.routerSystemPromptTemplate.replace(
                'Correct examples:',
                '- **IMPORTANT FOR KEYWORDS (KEYS):** Always include the entity\'s own name/title (without any timestamps like "Day 1", "Day 2", "12:15 AM", etc.) in the list of keywords. The title itself (stripped of timestamps) is the most reliable trigger, so it must be present as a keyword. For example, if the entry title is "[12:15 AM, Day 2] Defense of Ironbelly\'s Workshop", the keys list MUST include "Defense of Ironbelly\'s Workshop".\n\nCorrect examples:'
            );
        }
    }
    if (s.routerModularPromptTemplate && !s.routerModularPromptTemplate.includes('IMPORTANT FOR KEYWORDS')) {
        if (s.routerModularPromptTemplate.includes('NPC / FAC / QUEST / EVENT labels:')) {
            s.routerModularPromptTemplate = s.routerModularPromptTemplate.replace(
                'NPC / FAC / QUEST / EVENT labels:',
                '**IMPORTANT FOR KEYWORDS:** Always include the entry\'s own title/name (without any timestamps like "Day 1", "Day 2", "12:15 AM", etc.) in the keywords field. The title itself (stripped of timestamps) is the most reliable trigger, so it must be present as a keyword. For example, for a tag representing a "Defense of Ironbelly\'s Workshop" event, the keywords MUST contain "Defense of Ironbelly\'s Workshop".\n\nNPC / FAC / QUEST / EVENT labels:'
            );
        }
    }

    // ── MIGRATION: Ban {{user}}/{{char}} from keywords/keys in existing templates (v3.16.19+) ──────
    if (s.routerSystemPromptTemplate && !s.routerSystemPromptTemplate.includes('DO NOT INCLUDE `{{user}}`')) {
        if (s.routerSystemPromptTemplate.includes('the keys list MUST include "Defense of Ironbelly\'s Workshop".')) {
            s.routerSystemPromptTemplate = s.routerSystemPromptTemplate.replace(
                'the keys list MUST include "Defense of Ironbelly\'s Workshop".',
                'the keys list MUST include "Defense of Ironbelly\'s Workshop".\n- **DO NOT INCLUDE `{{user}}`, `{{char}}`, or general player references** in the keyword list (`keys`). The user/player is present in all events/locations, so including them as a keyword causes false matches and wastes context tokens.'
            );
        }
    }
    if (s.routerModularPromptTemplate && !s.routerModularPromptTemplate.includes('DO NOT INCLUDE `{{user}}`')) {
        if (s.routerModularPromptTemplate.includes('keywords MUST contain "Defense of Ironbelly\'s Workshop".')) {
            s.routerModularPromptTemplate = s.routerModularPromptTemplate.replace(
                'keywords MUST contain "Defense of Ironbelly\'s Workshop".',
                'keywords MUST contain "Defense of Ironbelly\'s Workshop". DO NOT INCLUDE `{{user}}`, `{{char}}`, or general player references in the keywords field — the player is present in all events and locations, so tagging them is redundant and wastes context tokens.'
            );
        }
    }

    // ── MIGRATION: Update World Progression System Prompt with Quests/Events rule (v3.4.4+) ──────
    if (s.worldProgressionSystemPrompt && !s.worldProgressionSystemPrompt.includes('QUESTS and EVENTS are historical records')) {
        s.worldProgressionSystemPrompt = s.worldProgressionSystemPrompt.replace(
            '1. Do NOT summarize player actions. Build consequences from them instead — defeated rivals plot revenge, sympathetic contacts cover their tracks, encountered strangers react to what happened.',
            '1. Do NOT summarize player actions. Build consequences from them instead — defeated rivals plot revenge, sympathetic contacts cover their tracks, encountered strangers react to what happened.\n2. QUESTS and EVENTS are historical records for context only — they are NOT simulatable entities. Never generate entries that describe a quest advancing, stalling, succeeding, or failing. If a quest appears in the designated entities block, ignore it entirely.'
        );
        s.worldProgressionSystemPrompt = s.worldProgressionSystemPrompt
            .replace('2. Prioritize named ACTIVE WORLD LORE NPCs.', '3. Prioritize named ACTIVE WORLD LORE NPCs.')
            .replace('3. For NPCs who were physically present', '4. For NPCs who were physically present')
            .replace('4. Format as 15 short entries', '5. Format as 15 short entries')
            .replace('5. Output ONLY the report content.', '6. Output ONLY the report content.')
            .replace('6. Do not simply repeat the same entities', '7. Do not simply repeat the same entities')
            .replace('7. DO NOT write a cumulative report', '8. DO NOT write a cumulative report')
            .replace('8. Cross-category entity bleeding is desirable', '9. Cross-category entity bleeding is desirable')
            .replace('9. You must strictly respect geographical', '10. You must strictly respect geographical')
            .replace('10. Character vectors must take place', '11. Character vectors must take place');
    }
 
    // ── MIGRATION: Update World Progression System Prompt with bullet-pointed and blank line rules ──
    if (s.worldProgressionSystemPrompt && !s.worldProgressionSystemPrompt.includes('Do NOT prefix the lines with the period or time label')) {
        // Replace from original or intermediate form
        s.worldProgressionSystemPrompt = s.worldProgressionSystemPrompt
            .replace(
                '5. Format as 15 short entries, 1 sentence each. Dense, no filler, no markdown.',
                '5. Format as 15 bullet-pointed entries (using "- "), with a blank line (newline) between each world event. Dense, no filler, no markdown. Each entry must be exactly 1 sentence. Do NOT prefix the lines with the period or time label.'
            )
            .replace(
                '5. Format as 15 bullet-pointed entries (using "- [{periodLabel}] Event Description..."), with a blank line (newline) between each world event. Dense, no filler, no markdown. Each entry must be exactly 1 sentence.',
                '5. Format as 15 bullet-pointed entries (using "- "), with a blank line (newline) between each world event. Dense, no filler, no markdown. Each entry must be exactly 1 sentence. Do NOT prefix the lines with the period or time label.'
            );
    }

    // ── MIGRATION: CHARACTER/PARTY prompts — Att/def → Combat + Gear (BAB) ───────
    const OLD_CHAR_SNIPPET = 'Att/def: Weapon (stats) | Armor (AC: Z)';
    if (s.stockPrompts?.character && s.stockPrompts.character.includes(OLD_CHAR_SNIPPET)) {
        s.stockPrompts.character = DEFAULT_STOCK_PROMPTS.character;
    }
    const OLD_PARTY_SNIPPET = 'Att/def: Weapon (stats) | Armor (AC: Z)';
    if (s.stockPrompts?.party && s.stockPrompts.party.includes(OLD_PARTY_SNIPPET)) {
        s.stockPrompts.party = DEFAULT_STOCK_PROMPTS.party;
    }

    // ── MIGRATION: INVENTORY prompt → Gear / Other Items split (v3.7.2) ───────────
    const OLD_INVENTORY_SNIPPET = '- 🗡️ [Rare] Flame Dagger (1d6+3 fire)';
    if (s.stockPrompts?.inventory &&
        s.stockPrompts.inventory.includes(OLD_INVENTORY_SNIPPET) &&
        !s.stockPrompts.inventory.includes('Gear:')) {
        s.stockPrompts.inventory = DEFAULT_STOCK_PROMPTS.inventory;
    }


    // ── MIGRATION: Block RELATIONSHIPS section in State Tracker core prompt ───────
    if (s.systemPromptTemplate) {
        if (s.systemPromptTemplate.includes('Never track relationships or reputation')) {
            s.systemPromptTemplate = s.systemPromptTemplate.replace(
                'NO RELATIONSHIPS: Never track relationships or reputation, and never create a relationship or reputation section (e.g., [RELATIONSHIPS] or [REPUTATION]). NPC relationships are handled by a separate, dedicated system.',
                'NO RELATIONSHIPS: Never track relationships, and never create a relationship section (e.g., [RELATIONSHIPS]). NPC relationships are handled by a separate, dedicated system.'
            );
        }
        if (!s.systemPromptTemplate.includes('NO RELATIONSHIPS')) {
            if (s.systemPromptTemplate.includes('DELETION: To REMOVE a section entirely, you MUST output: `[TAG]REMOVED[/TAG]`.')) {
                s.systemPromptTemplate = s.systemPromptTemplate.replace(
                    'DELETION: To REMOVE a section entirely, you MUST output: `[TAG]REMOVED[/TAG]`.',
                    'DELETION: To REMOVE a section entirely, you MUST output: `[TAG]REMOVED[/TAG]`.\nNO RELATIONSHIPS: Never track relationships, and never create a relationship section (e.g., [RELATIONSHIPS]). NPC relationships are handled by a separate, dedicated system.'
                );
            } else if (s.systemPromptTemplate.includes('DELETION: To REMOVE a section entirely, you MUST output: \\`[TAG]REMOVED[/TAG]\\`.')) {
                s.systemPromptTemplate = s.systemPromptTemplate.replace(
                    'DELETION: To REMOVE a section entirely, you MUST output: \\`[TAG]REMOVED[/TAG]\\`.',
                    'DELETION: To REMOVE a section entirely, you MUST output: \\`[TAG]REMOVED[/TAG]\\`.\nNO RELATIONSHIPS: Never track relationships, and never create a relationship section (e.g., [RELATIONSHIPS]). NPC relationships are handled by a separate, dedicated system.'
                );
            }
        }
    }
    // ── MIGRATION: Auto-fix legacy corrupted PC Core Section colors ────────────────
    if (s.pcCoreSections && Array.isArray(s.pcCoreSections) && s.pcCoreSections.length === 6) {
        // We check by ID rather than name, because the legacy version might have had "Appearance" instead of "Appearance/Species"
        const idsMatch = s.pcCoreSections.every((sec, idx) => sec.id === DEFAULT_PC_SECTIONS[idx].id);
        const colorsMatch = s.pcCoreSections.every((sec, idx) => sec.color === DEFAULT_PC_SECTIONS[idx].color);
        if (idsMatch && !colorsMatch) {
            s.pcCoreSections.forEach((sec, idx) => {
                sec.color = DEFAULT_PC_SECTIONS[idx].color;
            });
        }
    }

    return extensionSettings[MODULE_NAME];
}

// ── Bar color resolver ─────────────────────────────────────────────────────────

/**
 * Returns the CSS background string for a bar element, respecting any
 * user-configured color overrides stored in settings.barColors.
 * @param {string} barId
 * @param {string} defaultBackground
 * @param {number|null} pct
 */
export function getBarBackground(barId, defaultBackground, pct = null) {
    if (!barId) return defaultBackground;
    const s = getSettings();
    const cfg = s.barColors?.[barId];
    if (!cfg) {
        const isHP = barId.endsWith(':HP') || barId.includes(':HPBAR');
        // Only apply automatic pct-based HP coloring when the caller hasn't supplied
        // a custom color (i.e. defaultBackground is the default HP green).
        // Explicit marker colors like ((BARRED)) or ((BARGREEN)) pass their own
        // gradient as defaultBackground — those must NOT be silently overridden.
        const DEFAULT_HP = '#00ffaa';
        if (isHP && pct !== null && (defaultBackground === DEFAULT_HP || defaultBackground == null)) {
            return pct > 60 ? '#00ffaa' : pct > 30 ? '#ffaa00' : '#ff5555';
        }
        return defaultBackground;
    }

    if (typeof cfg === 'string') return cfg; // Legacy support

    switch (cfg.mode) {
        case 'gradient':
            return `linear-gradient(90deg, ${cfg.color}, ${cfg.color2 || cfg.color})`;
        case 'dynamic': {
            const p = pct !== null ? pct : 100;
            return p > 60 ? '#00ffaa' : p > 30 ? '#ffaa00' : '#ff5555';
        }
        case 'solid':
        default:
            return cfg.color;
    }
}

/**
 * Checks if a specific bar is configured to be rendered as a percentage.
 * @param {string} barId
 * @returns {boolean}
 */
export function getBarShowAsPercentage(barId) {
    if (!barId) return false;
    const s = getSettings();
    const cfg = s.barColors?.[barId];
    if (cfg && typeof cfg === 'object') {
        return !!cfg.showAsPercentage;
    }
    return false;
}

/**
 * Sanitizes a string into a lorebook-safe campaign prefix (same rules as chat-id derive).
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeCampaignPrefixString(raw) {
    if (!raw) return '';
    return String(raw).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Prefix used for world activation and router: optional user override, else from chat id.
 * @param {string} chatId
 * @returns {string}
 */
export function getEffectiveRouterCampaignPrefix(chatId) {
    const s = getSettings();
    const ov = (s.routerCampaignPrefixOverride || '').trim();
    if (ov) return sanitizeCampaignPrefixString(ov);
    return sanitizeCampaignPrefixString(chatId || '');
}

// ── One-time data migrations ───────────────────────────────────────────────────

/**
 * Migrates custom fields from legacy formats to the current template-based format.
 * Safe to call repeatedly — idempotent.
 */
export function migrateCustomFields() {
    const s = getSettings();

    // Strip placeholder NEW_TAG entries persisted from previous sessions (one-time cleanup at init)
    if (Array.isArray(s.routerCustomTags)) {
        s.routerCustomTags = s.routerCustomTags.filter(t => t.tag && t.tag !== 'NEW_TAG');
    }

    (s.customFields || []).forEach(field => {
        // Migration 1: Convert single renderType to empty rows (old)
        if (field.renderType !== undefined && !field.rows && !field.template) {
            field.rows = [];
            delete field.renderType;
        }
        // Migration 2: Convert rows to template (New)
        if (field.rows && !field.template) {
            const UI_TO_MARKER = {
                'pills': 'PILLS', 'badge': 'BADGE', 'highlight': 'HIGHLIGHT',
                'hp_bar': 'BAR', 'xp_bar': 'XPBAR', 'text': 'TEXT', 'kv': 'TEXT'
            };
            field.template = field.rows.map(row => {
                const marker = UI_TO_MARKER[row.renderType] || 'TEXT';
                const content = row.label || '';
                return `((${marker})) ${content}`;
            }).join('\n').trim();
            delete field.rows;
            delete field.renderType;
        }
    });
}

// ── Chat-linked state persistence ─────────────────────────────────────────────

/** Active chat id — prefer tracker-tracked id over raw ST context. */
export function getActiveChatId() {
    const ctx = SillyTavern.getContext();
    const tracked = typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : null;
    return tracked || ctx.getCurrentChatId?.() || ctx.chatId || null;
}

/**
 * When Chat Link is on, restore the WP timer label from chatStates if the live
 * field was cleared (e.g. after debounced settings reload) but the partition still has it.
 * @returns {boolean} true if a label was hydrated
 */
export function hydrateWorldProgressionFromChatState() {
    const s = getSettings();
    if (!s.chatLinkEnabled) return false;
    const chatId = getActiveChatId();
    if (!chatId) return false;
    const stored = s.chatStates?.[chatId];
    if (!stored?.worldProgressionLastFiredPeriodLabel) return false;
    if (s.worldProgressionLastFiredPeriodLabel) return false;
    s.worldProgressionLastFiredPeriodLabel = stored.worldProgressionLastFiredPeriodLabel;
    return true;
}

/** Persist the WP timer to the active chat partition or global settings. */
export function persistWorldProgressionTimer() {
    const s = getSettings();
    const chatId = getActiveChatId();
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    } else {
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/** Persist the Lorebook Agent "since last run" chat-length watermark. */
export function persistRouterLastRunWatermark(length) {
    const s = getSettings();
    s.routerLastRunChatLength = length;
    const chatId = getActiveChatId();
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    } else {
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/** Persist the Lorebook Agent "last ran at" timestamp (display only — separate from the indexing watermark). */
export function persistRouterLastRunTimestamp(epochMs = Date.now()) {
    const s = getSettings();
    s.routerLastRunAt = epochMs;
    const chatId = getActiveChatId();
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    } else {
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/**
 * Snapshots the current live settings into chatStates[chatId].
 * Pure write — no shared mutable state, no DOM.
 * @param {string} chatId
 */
export function saveChatState(chatId) {
    if (!chatId) return;
    if (typeof globalThis._rpgFlushRawMemoChanges === 'function') {
        globalThis._rpgFlushRawMemoChanges();
    }
    const s = getSettings();
    if (!s.chatStates) s.chatStates = {};
    // Preserve fields that are written outside the normal save cycle (e.g. campaignBooks)
    const existing = s.chatStates[chatId] || {};
    s.chatStates[chatId] = {
        currentMemo:  s.currentMemo,
        memoHistory:  JSON.parse(JSON.stringify(s.memoHistory)),
        lastDelta:    s.lastDelta || '',
        customPortraits: JSON.parse(JSON.stringify(s.customPortraits || {})),
        modules:      JSON.parse(JSON.stringify(s.modules)),
        blockOrder:   JSON.parse(JSON.stringify(s.blockOrder  || BLOCK_ORDER)),
        stockPrompts: snapshotStockPromptsForProfile(s.stockPrompts),
        customFields: JSON.parse(JSON.stringify(s.customFields || [])),
        quests:       JSON.parse(JSON.stringify(s.quests || [])), // persist full array (incl. completed) for cross-session UI display
        historyIndex: s.historyIndex ?? -1,
        activeRouterKeys: JSON.parse(JSON.stringify(s.activeRouterKeys || [])),
        activeWorldKeys:  JSON.parse(JSON.stringify(s.activeWorldKeys || [])),
        keywordActivatedKeys: JSON.parse(JSON.stringify(s.keywordActivatedKeys || [])),
        routerLog:    JSON.parse(JSON.stringify(s.routerLog || [])),
        routerCampaignPrefix: s.routerCampaignPrefix || '',
        routerLookback: s.routerLookback || 4,
        routerLastRunChatLength: s.routerLastRunChatLength ?? 0,
        routerLastRunAt: s.routerLastRunAt ?? 0,
        routerDirectPrompt: s.routerDirectPrompt || '',
        routerDirectLookback: s.routerDirectLookback || 10,
        routerDefaultPosition: s.routerDefaultPosition ?? 4,
        routerDefaultDepth: s.routerDefaultDepth ?? 4,
        routerDefaultOrder: s.routerDefaultOrder ?? 100,
        routerDefaultRole: s.routerDefaultRole ?? 0,
        loreInjectionPosition: s.loreInjectionPosition ?? 4,
        loreInjectionDepth: s.loreInjectionDepth ?? 4,
        loreInjectionRole: s.loreInjectionRole ?? 0,
        worldProgressionLookback: s.worldProgressionLookback ?? 20,
        worldProgressionHistoryLookback: s.worldProgressionHistoryLookback ?? 0,
        worldProgressionInjectionPosition: s.worldProgressionInjectionPosition ?? 4,
        worldProgressionInjectionDepth: s.worldProgressionInjectionDepth ?? 3,
        worldProgressionInjectionRole: s.worldProgressionInjectionRole ?? 0,
        worldProgressionRandomizeNPCs: s.worldProgressionRandomizeNPCs ?? false,
        worldProgressionRandomSkeletonNPCCount: s.worldProgressionRandomSkeletonNPCCount ?? 2,
        worldProgressionRandomNarrativeNPCCount: s.worldProgressionRandomNarrativeNPCCount ?? 3,
        worldProgressionRandomizeLocations: s.worldProgressionRandomizeLocations ?? false,
        worldProgressionRandomSkeletonLocationCount: s.worldProgressionRandomSkeletonLocationCount ?? 2,
        worldProgressionRandomNarrativeLocationCount: s.worldProgressionRandomNarrativeLocationCount ?? 2,
        worldProgressionRandomizeFactions: s.worldProgressionRandomizeFactions ?? false,
        worldProgressionRandomSkeletonFactionCount: s.worldProgressionRandomSkeletonFactionCount ?? 2,
        worldProgressionRandomNarrativeFactionCount: s.worldProgressionRandomNarrativeFactionCount ?? 2,
        worldProgressionRandomizeConflicts: s.worldProgressionRandomizeConflicts ?? false,
        worldProgressionRandomConflictCount: s.worldProgressionRandomConflictCount ?? 3,
        worldProgressionSkeletonFactions: s.worldProgressionSkeletonFactions ?? 4,
        worldProgressionSkeletonLocations: s.worldProgressionSkeletonLocations ?? 4,
        worldProgressionSkeletonNPCs: s.worldProgressionSkeletonNPCs ?? 0,
        worldProgressionSkeletonConflicts: s.worldProgressionSkeletonConflicts ?? 3,
        // World Progression per-chat time tracking
        worldProgressionLastFiredAtMinutes: s.worldProgressionLastFiredAtMinutes ?? -1,
        worldProgressionLastFiredPeriodLabel: s.worldProgressionLastFiredPeriodLabel || '',
        worldProgressionSkeletonAtmosphereSummary: s.worldProgressionSkeletonAtmosphereSummary || '',
        worldProgressionSkeletonAtmosphereLookback: s.worldProgressionSkeletonAtmosphereLookback ?? 30,
        worldProgressionSkeletonUseExisting: s.worldProgressionSkeletonUseExisting ?? true,
        worldProgressionConsolidateEnabled: s.worldProgressionConsolidateEnabled ?? false,
        worldProgressionConsolidateInterval: s.worldProgressionConsolidateInterval ?? 7,
        worldProgressionExclusionList: s.worldProgressionExclusionList || '',

        portraitGeneratorSource: s.portraitGeneratorSource ?? "native",
        portraitSkipPromptDialog: s.portraitSkipPromptDialog ?? false,
        portraitAutoGenerateParty: s.portraitAutoGenerateParty ?? false,
        portraitAutoGenerateEnemies: s.portraitAutoGenerateEnemies ?? false,
        portraitAutoGenerateNpcs: s.portraitAutoGenerateNpcs ?? false,
        portraitConnectionSource: s.portraitConnectionSource ?? "default",
        portraitConnectionProfileId: s.portraitConnectionProfileId || "",
        portraitCompletionPresetId: s.portraitCompletionPresetId || "",
        portraitOllamaUrl: s.portraitOllamaUrl || "http://localhost:11434",
        portraitOllamaModel: s.portraitOllamaModel || "",
        portraitOpenaiUrl: s.portraitOpenaiUrl || "",
        portraitOpenaiKey: s.portraitOpenaiKey || "",
        portraitOpenaiModel: s.portraitOpenaiModel || "",
        worldConnectionSource: s.worldConnectionSource ?? "default",
        worldConnectionProfileId: s.worldConnectionProfileId || "",
        worldCompletionPresetId: s.worldCompletionPresetId || "",
        worldOllamaUrl: s.worldOllamaUrl || "http://localhost:11434",
        worldOllamaModel: s.worldOllamaModel || "",
        worldOpenaiUrl: s.worldOpenaiUrl || "",
        worldOpenaiKey: s.worldOpenaiKey || "",
        worldOpenaiModel: s.worldOpenaiModel || "",
        gameSystemWizardConnectionSource: s.gameSystemWizardConnectionSource ?? "default",
        gameSystemWizardConnectionProfileId: s.gameSystemWizardConnectionProfileId || "",
        gameSystemWizardCompletionPresetId: s.gameSystemWizardCompletionPresetId || "",
        gameSystemWizardOllamaUrl: s.gameSystemWizardOllamaUrl || "http://localhost:11434",
        gameSystemWizardOllamaModel: s.gameSystemWizardOllamaModel || "",
        gameSystemWizardOpenaiUrl: s.gameSystemWizardOpenaiUrl || "",
        gameSystemWizardOpenaiKey: s.gameSystemWizardOpenaiKey || "",
        gameSystemWizardOpenaiModel: s.gameSystemWizardOpenaiModel || "",

        // Per-chat time/date formatting (24h clock, DD/MM/YYYY vs Day N, initial anchor)
        use24hTime: !!s.use24hTime,
        useDdMmYyFormat: !!s.useDdMmYyFormat,
        initialDate: s.initialDate || 'Day 1',
        npcRelationshipMax: getNpcRelationshipMax(s),

        // Preserve lorebook stack link — written by Link button and router, not by normal state saves
        campaignBooks: existing.campaignBooks || [],

        // Preserve Player Character pseudo-persona which is injected into the chat state
        playerCharacter: existing.playerCharacter,
    };
    
    // Use a synchronous save so data is not lost if the page is closed before
    // a debounced timer fires (the root cause of the PC/state/relationship loss bug).
    // saveChatState is always called with an explicit chatId so there is no
    // cross-chat leakage risk from this call itself.
    const ctx = SillyTavern.getContext();
    if (typeof ctx.saveSettings === 'function') {
        ctx.saveSettings();
    } else if (typeof ctx.saveSettingsDebounced === 'function') {
        ctx.saveSettingsDebounced();
    }
}

// ── Profile I/O ───────────────────────────────────────────────────────────────

/**
 * Deep-clones stock module prompts for profile/chat persistence, merging the
 * live overrides on top of DEFAULT_STOCK_PROMPTS so every variant key
 * (time_24h, time_ddmmyy, etc.) is captured even if only a subset was edited.
 * @param {Record<string, string>|null|undefined} stockPrompts
 * @returns {Record<string, string>}
 */
export function snapshotStockPromptsForProfile(stockPrompts) {
    return {
        ...JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS)),
        ...JSON.parse(JSON.stringify(stockPrompts || {})),
    };
}

/**
 * Restores stock module prompts from a profile snapshot, filling any keys
 * missing in older profiles from current defaults.
 * @param {Record<string, string>|null|undefined} profileStockPrompts
 * @returns {Record<string, string>}
 */
export function loadStockPromptsFromProfile(profileStockPrompts) {
    if (!profileStockPrompts) {
        return JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS));
    }
    return {
        ...JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS)),
        ...JSON.parse(JSON.stringify(profileStockPrompts)),
    };
}

/**
 * Saves the current tracker state into a named profile slot.
 * @param {string} name
 */
export function saveProfile(name) {
    const s = getSettings();
    if (!name) return;
    if (!s.profiles) s.profiles = {};
    s.profiles[name] = {
        currentMemo: s.currentMemo,
        memoHistory: JSON.parse(JSON.stringify(s.memoHistory)),
        modules: JSON.parse(JSON.stringify(s.modules)),
        blockOrder: JSON.parse(JSON.stringify(s.blockOrder || BLOCK_ORDER)),
        stockPrompts: snapshotStockPromptsForProfile(s.stockPrompts),
        modulePageSizes: JSON.parse(JSON.stringify(s.modulePageSizes || {})),
        customFields: JSON.parse(JSON.stringify(s.customFields || [])),
        // quests are derived from currentMemo on load — not persisted separately
        lastDelta: s.lastDelta || '',
        historyIndex: s.historyIndex ?? -1,
        activeRouterKeys: JSON.parse(JSON.stringify(s.activeRouterKeys || [])),
        activeWorldKeys:  JSON.parse(JSON.stringify(s.activeWorldKeys || [])),
        routerLog:    JSON.parse(JSON.stringify(s.routerLog || [])),
        routerCampaignPrefix: s.routerCampaignPrefix || '',
        routerLookback: s.routerLookback || 4,
        routerLastRunChatLength: s.routerLastRunChatLength ?? 0,
        routerLastRunAt: s.routerLastRunAt ?? 0,
        routerDirectPrompt: s.routerDirectPrompt || '',
        routerDefaultPosition: s.routerDefaultPosition ?? 4,
        routerDefaultDepth: s.routerDefaultDepth ?? 4,
        routerDefaultOrder: s.routerDefaultOrder ?? 100,
        routerDefaultRole: s.routerDefaultRole ?? 0,
        loreInjectionPosition: s.loreInjectionPosition ?? 4,
        loreInjectionDepth: s.loreInjectionDepth ?? 4,
        loreInjectionRole: s.loreInjectionRole ?? 0,
        worldProgressionLookback: s.worldProgressionLookback ?? 20,
        worldProgressionHistoryLookback: s.worldProgressionHistoryLookback ?? 0,
        worldProgressionInjectionPosition: s.worldProgressionInjectionPosition ?? 4,
        worldProgressionInjectionDepth: s.worldProgressionInjectionDepth ?? 3,
        worldProgressionInjectionRole: s.worldProgressionInjectionRole ?? 0,
        worldProgressionRandomizeNPCs: s.worldProgressionRandomizeNPCs ?? false,
        worldProgressionRandomSkeletonNPCCount: s.worldProgressionRandomSkeletonNPCCount ?? 2,
        worldProgressionRandomNarrativeNPCCount: s.worldProgressionRandomNarrativeNPCCount ?? 3,
        worldProgressionRandomizeLocations: s.worldProgressionRandomizeLocations ?? false,
        worldProgressionRandomSkeletonLocationCount: s.worldProgressionRandomSkeletonLocationCount ?? 2,
        worldProgressionRandomNarrativeLocationCount: s.worldProgressionRandomNarrativeLocationCount ?? 2,
        worldProgressionRandomizeFactions: s.worldProgressionRandomizeFactions ?? false,
        worldProgressionRandomSkeletonFactionCount: s.worldProgressionRandomSkeletonFactionCount ?? 2,
        worldProgressionRandomNarrativeFactionCount: s.worldProgressionRandomNarrativeFactionCount ?? 2,
        worldProgressionRandomizeConflicts: s.worldProgressionRandomizeConflicts ?? false,
        worldProgressionRandomConflictCount: s.worldProgressionRandomConflictCount ?? 3,
        worldProgressionSkeletonFactions: s.worldProgressionSkeletonFactions ?? 4,
        worldProgressionSkeletonLocations: s.worldProgressionSkeletonLocations ?? 4,
        worldProgressionSkeletonNPCs: s.worldProgressionSkeletonNPCs ?? 0,
        worldProgressionSkeletonConflicts: s.worldProgressionSkeletonConflicts ?? 3,
        worldProgressionLastFiredAtMinutes: s.worldProgressionLastFiredAtMinutes ?? -1,
        worldProgressionLastFiredPeriodLabel: s.worldProgressionLastFiredPeriodLabel || '',
        worldProgressionConsolidateEnabled: s.worldProgressionConsolidateEnabled ?? false,
        worldProgressionConsolidateInterval: s.worldProgressionConsolidateInterval ?? 7,
        worldProgressionSkeletonAtmosphereSummary: s.worldProgressionSkeletonAtmosphereSummary || '',
        worldProgressionSkeletonAtmosphereLookback: s.worldProgressionSkeletonAtmosphereLookback ?? 30,
        worldProgressionSkeletonUseExisting: s.worldProgressionSkeletonUseExisting ?? true,
        worldProgressionExclusionList: s.worldProgressionExclusionList || '',

        portraitGeneratorSource: s.portraitGeneratorSource ?? "native",
        portraitSkipPromptDialog: s.portraitSkipPromptDialog ?? false,
        portraitAutoGenerateParty: s.portraitAutoGenerateParty ?? false,
        portraitAutoGenerateEnemies: s.portraitAutoGenerateEnemies ?? false,
        portraitAutoGenerateNpcs: s.portraitAutoGenerateNpcs ?? false,
        portraitConnectionSource: s.portraitConnectionSource ?? "default",
        portraitConnectionProfileId: s.portraitConnectionProfileId || "",
        portraitCompletionPresetId: s.portraitCompletionPresetId || "",
        portraitOllamaUrl: s.portraitOllamaUrl || "http://localhost:11434",
        portraitOllamaModel: s.portraitOllamaModel || "",
        portraitOpenaiUrl: s.portraitOpenaiUrl || "",
        portraitOpenaiKey: s.portraitOpenaiKey || "",
        portraitOpenaiModel: s.portraitOpenaiModel || "",
        worldConnectionSource: s.worldConnectionSource ?? "default",
        worldConnectionProfileId: s.worldConnectionProfileId || "",
        worldCompletionPresetId: s.worldCompletionPresetId || "",
        worldOllamaUrl: s.worldOllamaUrl || "http://localhost:11434",
        worldOllamaModel: s.worldOllamaModel || "",
        worldOpenaiUrl: s.worldOpenaiUrl || "",
        worldOpenaiKey: s.worldOpenaiKey || "",
        worldOpenaiModel: s.worldOpenaiModel || "",
        gameSystemWizardConnectionSource: s.gameSystemWizardConnectionSource ?? "default",
        gameSystemWizardConnectionProfileId: s.gameSystemWizardConnectionProfileId || "",
        gameSystemWizardCompletionPresetId: s.gameSystemWizardCompletionPresetId || "",
        gameSystemWizardOllamaUrl: s.gameSystemWizardOllamaUrl || "http://localhost:11434",
        gameSystemWizardOllamaModel: s.gameSystemWizardOllamaModel || "",
        gameSystemWizardOpenaiUrl: s.gameSystemWizardOpenaiUrl || "",
        gameSystemWizardOpenaiKey: s.gameSystemWizardOpenaiKey || "",
        gameSystemWizardOpenaiModel: s.gameSystemWizardOpenaiModel || "",
    };
    s.activeProfile = name;
    SillyTavern.getContext().saveSettingsDebounced();
}

/**
 * Deletes a named profile slot.
 * @param {string} name
 */
export function deleteProfile(name) {
    const s = getSettings();
    if (!s.profiles?.[name]) return;
    delete s.profiles[name];
    if (s.activeProfile === name) s.activeProfile = '';
    SillyTavern.getContext().saveSettingsDebounced();
}

/**
 * Safely sanitizes router state arrays to prevent crashes from dirty/malformed data.
 * @param {Record<string, any>} s - The settings object to sanitize.
 */
export function sanitizeRouterState(s) {
    if (!s) return;
    const isGoodId = (id) => typeof id === 'string' && id.includes('::');

    if (Array.isArray(s.activeRouterKeys)) {
        s.activeRouterKeys = s.activeRouterKeys.filter(isGoodId);
    } else {
        s.activeRouterKeys = [];
    }

    if (Array.isArray(s.activeWorldKeys)) {
        s.activeWorldKeys = s.activeWorldKeys.filter(isGoodId);
    } else {
        s.activeWorldKeys = [];
    }

    if (Array.isArray(s.keywordActivatedKeys)) {
        s.keywordActivatedKeys = s.keywordActivatedKeys.filter(isGoodId);
    } else {
        s.keywordActivatedKeys = [];
    }

    if (Array.isArray(s.routerLog)) {
        s.routerLog = s.routerLog.filter(log => {
            if (!log || typeof log !== 'object') return false;

            if (Array.isArray(log.record)) {
                log.record = log.record.filter(isGoodId);
            } else {
                log.record = [];
            }

            if (Array.isArray(log.activate)) {
                log.activate = log.activate.filter(isGoodId);
            } else {
                log.activate = [];
            }

            if (Array.isArray(log.deactivate)) {
                log.deactivate = log.deactivate.filter(isGoodId);
            } else {
                log.deactivate = [];
            }

            return true;
        });
    } else {
        s.routerLog = [];
    }
}

/**
 * Dynamically adjusts timestamp formats (Day X/N vs DD/MM/YYYY and 12h vs 24h) inside prompt instructions.
 * @param {string} prompt
 * @param {object} settings
 * @returns {string}
 */
export function adjustPromptTimestamps(prompt, settings) {
    if (!prompt) return prompt;
    const isCalendar = !!settings.useDdMmYyFormat;
    const is24h = !!settings.use24hTime;

    let result = prompt;

    if (isCalendar) {
        if (is24h) {
            // Target: DD/MM/YYYY, HH:MM (24h)
            result = result
                .replace(/Day ([1-9])/g, '0$1/01/2026')
                .replace(/Day N/g, 'DD/MM/YYYY')
                .replace(/Day X/g, 'DD/MM/YYYY')
                .replace(/Day 0/g, '31/12/2025')
                .replace(/12:15 AM/g, '00:15')
                .replace(/11:52 AM/g, '11:52')
                .replace(/10:00 PM/g, '22:00')
                .replace(/08:00 AM/g, '08:00')
                .replace(/06:00 PM/g, '18:00')
                .replace(/14:00/g, '14:00')
                .replace(/10:42/g, '10:42')
                .replace(/10:44/g, '10:44')
                .replace(/HH:MM AM\/PM/g, 'HH:MM')
                .replace(/HH:MM/g, 'HH:MM');
        } else {
            // Target: DD/MM/YYYY, HH:MM AM/PM (12h)
            result = result
                .replace(/Day ([1-9])/g, '0$1/01/2026')
                .replace(/Day N/g, 'DD/MM/YYYY')
                .replace(/Day X/g, 'DD/MM/YYYY')
                .replace(/Day 0/g, '31/12/2025')
                .replace(/14:00/g, '02:00 PM')
                .replace(/22:00/g, '10:00 PM')
                .replace(/10:42/g, '10:42 AM')
                .replace(/10:44/g, '10:44 AM')
                .replace(/HH:MM/g, 'HH:MM AM/PM')
                .replace(/HH:MM AM\/PM/g, 'HH:MM AM/PM');
        }
    } else {
        if (is24h) {
            // Target: Day N, HH:MM (24h)
            result = result
                .replace(/0([1-9])\/01\/2026/g, 'Day $1')
                .replace(/DD\/MM\/YYYY/g, 'Day N')
                .replace(/31\/12\/2025/g, 'Day 0')
                .replace(/12:15 AM/g, '00:15')
                .replace(/11:52 AM/g, '11:52')
                .replace(/10:00 PM/g, '22:00')
                .replace(/08:00 AM/g, '08:00')
                .replace(/06:00 PM/g, '18:00')
                .replace(/14:00/g, '14:00')
                .replace(/10:42/g, '10:42')
                .replace(/10:44/g, '10:44')
                .replace(/HH:MM AM\/PM/g, 'HH:MM')
                .replace(/HH:MM/g, 'HH:MM');
        } else {
            // Target: Day N, HH:MM AM/PM (12h)
            result = result
                .replace(/0([1-9])\/01\/2026/g, 'Day $1')
                .replace(/DD\/MM\/YYYY/g, 'Day N')
                .replace(/31\/12\/2025/g, 'Day 0')
                .replace(/14:00/g, '02:00 PM')
                .replace(/22:00/g, '10:00 PM')
                .replace(/10:42/g, '10:42 AM')
                .replace(/10:44/g, '10:44 AM')
                .replace(/HH:MM/g, 'HH:MM AM/PM')
                .replace(/HH:MM AM\/PM/g, 'HH:MM AM/PM');
        }
    }

    return result;
}

/**
 * Iterates through all stored system prompt, modular agent prompt, and stock prompt templates,
 * rewriting their embedded date/time examples to match the newly selected format.
 * @param {object} settings
 */
export function adjustAllStoredTemplatesForTimeFormat(settings) {
    if (settings.routerSystemPromptTemplate) {
        settings.routerSystemPromptTemplate = adjustPromptTimestamps(settings.routerSystemPromptTemplate, settings);
    }
    if (settings.routerModularPromptTemplate) {
        settings.routerModularPromptTemplate = adjustPromptTimestamps(settings.routerModularPromptTemplate, settings);
    }
    if (settings.stockPrompts) {
        for (const [key, val] of Object.entries(settings.stockPrompts)) {
            settings.stockPrompts[key] = adjustPromptTimestamps(val, settings);
        }
    }
}

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
