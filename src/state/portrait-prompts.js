/** Original 5.5.0 location prompt (pre parent-continuity / present-NPC variants). */
export const PORTRAIT_LOCATION_SYSTEM_PROMPT_LEGACY = `You are a location/scene prompt generator for AI image models. Given a place's lorebook description from an RPG campaign, output a single detailed image generation prompt for a wide establishing shot.

Focus on:
- Architecture, terrain, lighting, weather, and atmosphere
- Distinctive landmarks and environmental details from the lore entry
- Time of day and mood appropriate to the description
- Art style: high-quality fantasy landscape, cinematic wide shot, no characters in frame

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- The location lorebook entry is your PRIMARY source of truth.
- Use narrator card and scene context only for world/art-style guidance.
- Do not include game stats, quests, or non-visual information.`;

/** Previous WITH_NPCS factory default (pre minor-narrative-characters line). */
export const PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS_V1 = `You are a location/scene prompt generator for AI image models. Given a place's lorebook description from an RPG campaign, output a single detailed image generation prompt for a wide cinematic shot of "{{name}}" (full path: {{path}}).

Focus on:
- Architecture, terrain, lighting, weather, and atmosphere specific to THIS sub-location
- Distinctive landmarks and environmental details from the target location's lore entry
- Time of day and mood appropriate to the description and recent narrator output
- Art style: high-quality fantasy scene, cinematic wide shot

Characters:
- If a "Characters Present Now" block is provided: include those NPCs naturally in the scene (mid-ground or foreground). Use their lore entries for appearance, clothing, and pose. They should feel placed in the environment, not isolated portrait close-ups.
- If no "Characters Present Now" block is provided: no characters in frame — environment and atmosphere only.

Parent continuity:
- If parent/ancestor location context is provided, treat it as a visual STYLE GUIDE only (palette, building materials, era, cultural aesthetic, weather tone).
- The image must depict the TARGET sub-location as its own distinct place — never reuse or clone a parent's composition.
- Parents with existing reference art: match their look and feel while showing what makes this child location unique.

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- The target location's lorebook entry is your PRIMARY source of truth for the place itself.
- Use narrator output and scene context for moment-to-moment mood and staging.
- Do not include game stats, quests, or non-visual information.`;

/** @typedef {{ id: string, name: string, description: string, wordTarget?: number, portraitArtStyle: string, sceneArtStyle: string }} FactoryPortraitPromptPreset */

export const DEFAULT_PORTRAIT_PROMPT_PRESET_ID = 'fantasy';

/**
 * Factory-shipped Portrait Prompt Template art-style presets.
 * `fantasy` matches the historical Multihog defaults and remains the Reset target.
 * @type {FactoryPortraitPromptPreset[]}
 */
export const FACTORY_PORTRAIT_PROMPT_PRESETS = [
    {
        id: 'fantasy',
        name: 'Fantasy (Default)',
        description: 'High-quality fantasy art with dramatic lighting — the Multihog factory default.',
        wordTarget: 200,
        portraitArtStyle: 'high-quality fantasy portrait, dramatic lighting, detailed',
        sceneArtStyle: 'high-quality fantasy scene, cinematic wide shot',
    },
    {
        id: 'anime',
        name: 'Anime',
        description: 'Clean anime/illustration look with expressive features and vibrant color.',
        wordTarget: 200,
        portraitArtStyle: 'anime style portrait, clean linework, expressive eyes, vibrant color, detailed',
        sceneArtStyle: 'anime style scene, cinematic wide shot, clean linework, vibrant color',
    },
    {
        id: 'photorealistic',
        name: 'Photorealistic',
        description: 'Photographic realism with natural lighting and fine detail.',
        wordTarget: 200,
        portraitArtStyle: 'photorealistic portrait, natural lighting, highly detailed skin and fabric, cinematic',
        sceneArtStyle: 'photorealistic cinematic wide shot, natural lighting, highly detailed environment',
    },
    {
        id: 'oil_painting',
        name: 'Oil Painting',
        description: 'Classical oil-painting look with rich brushwork and museum finish.',
        wordTarget: 200,
        portraitArtStyle: 'classical oil painting portrait, rich brushwork, museum quality, dramatic lighting',
        sceneArtStyle: 'classical oil painting landscape, rich brushwork, museum quality, cinematic wide shot',
    },
    {
        id: 'comic',
        name: 'Comic Book',
        description: 'Bold comic/graphic-novel illustration with strong inks and dynamic shading.',
        wordTarget: 200,
        portraitArtStyle: 'comic book illustration portrait, bold inks, dynamic shading, detailed',
        sceneArtStyle: 'comic book illustration scene, bold inks, dynamic composition, cinematic wide shot',
    },
    {
        id: 'watercolor',
        name: 'Watercolor',
        description: 'Soft watercolor washes with atmospheric edges and delicate color.',
        wordTarget: 200,
        portraitArtStyle: 'soft watercolor portrait, delicate washes, atmospheric, detailed',
        sceneArtStyle: 'soft watercolor landscape, delicate washes, atmospheric, cinematic wide shot',
    },
    {
        id: 'dark_fantasy',
        name: 'Dark Fantasy',
        description: 'Grim, gothic fantasy with muted palette and heavy chiaroscuro.',
        wordTarget: 200,
        portraitArtStyle: 'dark fantasy portrait, grim atmosphere, muted palette, dramatic chiaroscuro, detailed',
        sceneArtStyle: 'dark fantasy scene, grim atmosphere, muted palette, cinematic wide shot',
    },
];

/**
 * @param {string} [id]
 * @returns {FactoryPortraitPromptPreset}
 */
export function getFactoryPortraitPromptPreset(id = DEFAULT_PORTRAIT_PROMPT_PRESET_ID) {
    return FACTORY_PORTRAIT_PROMPT_PRESETS.find((p) => p.id === id)
        || FACTORY_PORTRAIT_PROMPT_PRESETS.find((p) => p.id === DEFAULT_PORTRAIT_PROMPT_PRESET_ID)
        || FACTORY_PORTRAIT_PROMPT_PRESETS[0];
}

/**
 * @param {string} portraitArtStyle
 * @returns {string}
 */
export function buildNpcPortraitSystemPrompt(portraitArtStyle) {
    return `You are a portrait prompt generator for AI image models. Given an NPC's lorebook description from an RPG campaign, output a single detailed image generation prompt.

Focus on:
- Physical appearance (race, build, facial features, skin color, hair) — draw primarily from the NPC's lorebook entry
- Clothing, armor, equipment visible on the character
- Pose and expression appropriate to the character's personality
- Art style: ${portraitArtStyle}

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- The NPC lorebook entry is your PRIMARY source of truth for this character's appearance.
- Use the narrator card and scene context only for world setting/art style guidance.
- Focus on visual details. Do not include game stats, relationship values, or non-visual information.`;
}

/**
 * @param {string} portraitArtStyle
 * @returns {string}
 */
export function buildCharacterPortraitSystemPrompt(portraitArtStyle) {
    return `You are a portrait prompt generator for AI image models. Given character context from an RPG game, output a single detailed image generation prompt suitable for an AI image model.

You are provided with the full Lorebook Agent context — all currently active lore entries with their keywords and content — as well as the current game state. Use these to infer accurate visual details about the character, their world, and their situation.

Focus on:
- Physical appearance (race, build, facial features, skin color, hair)
- Clothing, armor, equipment visible on the character
- Pose and expression appropriate to the character's personality
- Art style: ${portraitArtStyle}

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- A user persona is provided for reference. If it does NOT describe the character "{{name}}", ignore it entirely and do not use any of its details in the portrait prompt.
- Focus on visual details. Do not include game stats, abilities, or non-visual information.`;
}

/**
 * @param {string} sceneArtStyle
 * @param {boolean} [includePresentNpcs]
 * @returns {string}
 */
export function buildLocationPortraitSystemPrompt(sceneArtStyle, includePresentNpcs = false) {
    if (includePresentNpcs) {
        return `You are a location/scene prompt generator for AI image models. Given a place's lorebook description from an RPG campaign, output a single detailed image generation prompt for a wide cinematic shot of "{{name}}" (full path: {{path}}).

Focus on:
- Architecture, terrain, lighting, weather, and atmosphere specific to THIS sub-location
- Distinctive landmarks and environmental details from the target location's lore entry
- Time of day and mood appropriate to the description and recent narrator output
- Art style: ${sceneArtStyle}

Characters:
- The Player Character entry (when provided in "Characters Present Now") is always a primary figure in the scene — never omit them.
- If additional NPC entries are listed in "Characters Present Now": include those NPCs naturally in the scene (mid-ground or foreground). Use their lore entries for appearance, clothing, and pose. They should feel placed in the environment, not isolated portrait close-ups.
- Also incorporate any minor characters who appear in the recent narrator output (bystanders, guards, patrons, crowd figures, etc.) even when they are NOT listed in "Characters Present Now". Infer brief visual details from the narrative and keep them secondary in the composition.
- If there are no characters in "Characters Present Now" and none appear in recent narrator output: no characters in frame — environment and atmosphere only.

Parent continuity:
- If parent/ancestor location context is provided, treat it as a visual STYLE GUIDE only (palette, building materials, era, cultural aesthetic, weather tone).
- The image must depict the TARGET sub-location as its own distinct place — never reuse or clone a parent's composition.
- Parents with existing reference art: match their look and feel while showing what makes this child location unique.

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- The target location's lorebook entry is your PRIMARY source of truth for the place itself.
- Use narrator output and scene context for moment-to-moment mood and staging.
- Do not include game stats, quests, or non-visual information.`;
    }

    return `You are a location/scene prompt generator for AI image models. Given a place's lorebook description from an RPG campaign, output a single detailed image generation prompt for a wide cinematic shot of "{{name}}" (full path: {{path}}).

Focus on:
- Architecture, terrain, lighting, weather, and atmosphere specific to THIS sub-location
- Distinctive landmarks and environmental details from the target location's lore entry
- Time of day and mood appropriate to the description and recent narrator output
- Art style: ${sceneArtStyle}

Scene composition:
- When a Player Character is listed in "Characters Present Now", include them as a primary figure in the scene.
- If no "Characters Present Now" block is provided: no characters in frame — environment and atmosphere only.

Parent continuity:
- If parent/ancestor location context is provided, treat it as a visual STYLE GUIDE only (palette, building materials, era, cultural aesthetic, weather tone).
- The image must depict the TARGET sub-location as its own distinct place — never reuse or clone a parent's composition.
- Parents with existing reference art: match their look and feel while showing what makes this child location unique.

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- The target location's lorebook entry is your PRIMARY source of truth for the place itself.
- Use narrator output and scene context for moment-to-moment mood and staging.
- Do not include game stats, quests, or non-visual information.`;
}

/**
 * @param {string|FactoryPortraitPromptPreset} [presetOrId]
 * @param {boolean} [includePresentNpcs]
 */
export function resolveFactoryPortraitPromptBundle(presetOrId = DEFAULT_PORTRAIT_PROMPT_PRESET_ID, includePresentNpcs = false) {
    const preset = typeof presetOrId === 'string'
        ? getFactoryPortraitPromptPreset(presetOrId)
        : (presetOrId || getFactoryPortraitPromptPreset());
    return {
        id: preset.id,
        name: preset.name,
        wordTarget: preset.wordTarget ?? 200,
        npcSystemPrompt: buildNpcPortraitSystemPrompt(preset.portraitArtStyle),
        characterSystemPrompt: buildCharacterPortraitSystemPrompt(preset.portraitArtStyle),
        locationSystemPrompt: buildLocationPortraitSystemPrompt(preset.sceneArtStyle, includePresentNpcs),
    };
}

/** @returns {string} */
export function getDefaultPortraitNpcSystemPrompt() {
    return resolveFactoryPortraitPromptBundle(DEFAULT_PORTRAIT_PROMPT_PRESET_ID, false).npcSystemPrompt;
}

/** @returns {string} */
export function getDefaultPortraitCharacterSystemPrompt() {
    return resolveFactoryPortraitPromptBundle(DEFAULT_PORTRAIT_PROMPT_PRESET_ID, false).characterSystemPrompt;
}

/**
 * @param {boolean} [includePresentNpcs]
 * @param {string} [presetId]
 * @returns {string}
 */
export function getDefaultPortraitLocationSystemPrompt(includePresentNpcs = false, presetId = DEFAULT_PORTRAIT_PROMPT_PRESET_ID) {
    return resolveFactoryPortraitPromptBundle(presetId, includePresentNpcs).locationSystemPrompt;
}

/** Factory default Location Scene prompt when present-NPC injection is off. */
export const PORTRAIT_LOCATION_SYSTEM_PROMPT_WITHOUT_NPCS = getDefaultPortraitLocationSystemPrompt(false);

/** Factory default Location Scene prompt when present-NPC injection is on. */
export const PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS = getDefaultPortraitLocationSystemPrompt(true);

/** @param {string} text @returns {string} */
function normalizePromptText(text) {
    return (text || '').replace(/\r\n/g, '\n').trim();
}

/**
 * If text matches a shipped factory/legacy location prompt, return that preset id.
 * Legacy fantasy texts map to the default fantasy preset.
 * @param {string} text
 * @returns {string|null}
 */
export function findShippedPortraitLocationPresetId(text) {
    const t = normalizePromptText(text);
    if (!t) return null;

    for (const preset of FACTORY_PORTRAIT_PROMPT_PRESETS) {
        const without = normalizePromptText(buildLocationPortraitSystemPrompt(preset.sceneArtStyle, false));
        const withNpcs = normalizePromptText(buildLocationPortraitSystemPrompt(preset.sceneArtStyle, true));
        if (t === without || t === withNpcs) return preset.id;
    }

    if (
        t === normalizePromptText(PORTRAIT_LOCATION_SYSTEM_PROMPT_LEGACY)
        || t === normalizePromptText(PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS_V1)
    ) {
        return DEFAULT_PORTRAIT_PROMPT_PRESET_ID;
    }

    return null;
}

/**
 * True when the text still matches a shipped factory default (current styles or legacy).
 * Custom edits return false so the toggle does not overwrite them.
 * @param {string} text
 * @returns {boolean}
 */
export function isShippedPortraitLocationSystemPrompt(text) {
    return findShippedPortraitLocationPresetId(text) !== null;
}

/**
 * Reserved factory preset display names (case-insensitive) — user saves may not overwrite these labels.
 * @returns {Set<string>}
 */
export function getFactoryPortraitPromptPresetNameSet() {
    return new Set(FACTORY_PORTRAIT_PROMPT_PRESETS.map((p) => p.name.toLowerCase()));
}
