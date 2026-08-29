/**
 * Default NPC/PC section schemas and the extension settings key.
 */

export const DEFAULT_NPC_SECTIONS = [
    { id: 'sec_species', name: 'Species', description: 'Species/race, any subtype, and gender — static identity that essentially never changes after the NPC is first recorded.', icon: '🧬', color: '#0ea5e9' },
    { id: 'sec_body', name: 'Body', description: 'Signature/default physical look: build, age, face, hair, eyes, skin, scars, natural body language. Not a transient outfit-of-the-scene, pose, or momentary activity — only changes that become their new lasting look. Do NOT describe worn gear here — see Worn Equipment.', icon: '👁️', color: '#d4a940' },
    { id: 'sec_equipment', name: 'Worn Equipment', description: 'Currently worn/carried gear only — weapons, armor, clothing, accessories visible on the character. NOT coins, bags of loot, inventory lists, or pocket items. Updates whenever what they visibly have equipped changes; copy from what the narrative explicitly shows them wearing/wielding.', icon: '🎽', color: '#f59e0b' },
    { id: 'sec_personality', name: 'Personality', description: 'Stable temperament and drives — not today\'s mood, fear, or stress.', icon: '🧠', color: '#8b5cf6' },
    { id: 'sec_background', name: 'Brief Background', description: 'Standing role, origin, history — not their part in the current plot.', icon: '📜', color: '#3b82f6' },
    { id: 'sec_habits', name: 'Habits/Behaviors', description: 'Recurring mannerisms and patterns — not one scene\'s behavior.', icon: '🔄', color: '#10b981' },
    { id: 'sec_strengths', name: 'Strengths', description: '[Concise bullet phrases formatted in bullet points of their most notable strengths, skills, or virtues. Sharp and specific — no vague generalities. A kind character may have more strengths than flaws.]', icon: '⚡', color: '#22c55e' },
    { id: 'sec_flaws', name: 'Flaws', description: '[Concise bullet phrases formatted in bullet points of their most notable weaknesses, bad habits, or moral failings. Be honest and specific. A troubled character may have more flaws than strengths.]\n(Note: The split between strengths and flaws does not need to be even. It is perfectly fine to have an uneven split—like having more strengths than flaws, or more flaws than strengths—so long as it authentically reflects the character. However, it can be evenly split if it makes sense.)', icon: '⚠️', color: '#ef4444' },
    { id: 'sec_combat_profile', name: 'Combat Profile', description: '[HIDDEN UNTIL SET — created from a [COMBAT] block for this NPC; once it exists, also patch lasting stats from [PARTY] after level-up. Copy the full combatant stat block: HP, AC, saves, weapons, abilities, spells. Never fabricate or summarize.]', icon: '🤺', color: '#38bdf8', hiddenUntilSet: true }
];

export const DEFAULT_PC_SECTIONS = [
    { id: 'sec_species', name: 'Species', description: '[State species, ethnicity, and gender based on the character card and Player Preferences. Weave into flowing prose — do NOT prefix with a literal "Species:", "Ethnicity:", or "Gender:" sub-label. Static identity — essentially frozen after character creation.]', icon: '🧬', color: '#0ea5e9' },
    { id: 'sec_body', name: 'Body', description: '[Describe physical features: body type, height, hair, eyes, skin tone, distinguishing marks, scars, and natural body language. You MUST explicitly incorporate any appearance notes provided in the card/preferences. Do NOT describe clothing, armor, or worn gear here — those belong in Worn Equipment.]', icon: '👁️', color: '#d4a940' },
    { id: 'sec_equipment', name: 'Worn Equipment', description: '[Describe currently worn/carried gear only — weapons, armor, clothing, accessories visible on the character. NOT coins, bags of loot, inventory lists, or pocket items. Ground in the character card\'s CHARACTER/inventory [E] equipped items if available. Updates as worn gear changes over the course of play.]', icon: '🎽', color: '#f59e0b' },
    { id: 'sec_personality', name: 'Personality', description: '[Describe temperament, how they act around others, and emotional tendencies. You MUST incorporate any traits provided.]', icon: '🧠', color: '#8b5cf6' },
    { id: 'sec_background', name: 'Background', description: '[Provide backstory context grounded in the character card. You MUST incorporate any background hints provided. Brief but meaningful.]', icon: '📜', color: '#3b82f6' },
    { id: 'sec_habits', name: 'Habits & Behaviors', description: '[Describe recurring mannerisms, habits, quirks, or behavioral patterns.]', icon: '🔄', color: '#10b981' },
    { id: 'sec_strengths', name: 'Strengths', description: '[Concise bullet phrases formatted in bullet points of their most notable strengths, skills, or virtues. Sharp and specific — no vague generalities. A kind character may have more strengths than flaws.]', icon: '⚡', color: '#22c55e' },
    { id: 'sec_flaws', name: 'Flaws', description: '[Concise bullet phrases formatted in bullet points of their most notable weaknesses, bad habits, or moral failings. Be honest and specific. A troubled character may have more flaws than strengths.]\n(Note: The split between strengths and flaws does not need to be even. It is perfectly fine to have an uneven split—like having more strengths than flaws, or more flaws than strengths—so long as it authentically reflects the character. However, it can be evenly split if it makes sense.)', icon: '⚠️', color: '#ef4444' }
];

export const MODULE_NAME = 'rpg_tracker';
