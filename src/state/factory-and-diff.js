/**
 * Bundled prompt snapshots, prompt-diff badges, and factory cartridge payload.
 */

import { DEFAULT_STOCK_PROMPTS, RT_PROMPTS } from '../../constants.js';
import { DEFAULT_MODULES } from './default-modules.js';
import { buildDefaultSettings } from './defaults.js';
import { adjustPromptTimestamps } from './router-utils.js';

function hashPromptBundle(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) ^ str.charCodeAt(i);
    }
    return (h >>> 0).toString(16);
}

/**
 * Shipped-prompt upgrade detection must not depend on a user's selected
 * calendar or clock display. Those preferences intentionally rewrite example
 * timestamps in live/generated templates, but do not constitute a new shipped
 * prompt release. Store and compare the stable Day N / 12-hour representation.
 * @param {any} value
 * @returns {any}
 */
export function normalizeBundledPromptsSnapshot(value) {
    const canonicalFormat = { useDdMmYyFormat: false, use24hTime: false };
    if (typeof value === 'string') {
        // Module builders historically use both "Day X" and "Day N" for the
        // same illustrative placeholder. Calendar conversion normalizes to N,
        // so do the same for the canonical shipped-default representation.
        return adjustPromptTimestamps(value, canonicalFormat).replace(/Day X/g, 'Day N');
    }
    if (Array.isArray(value)) return value.map(normalizeBundledPromptsSnapshot);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [key, normalizeBundledPromptsSnapshot(child)]),
        );
    }
    return value;
}

/**
 * Structured snapshot of all factory-shipped prompt defaults.
 * Fingerprint and upgrade-dialog diffs both derive from this object so they cannot drift.
 * @returns {{
 *   sysprompt: { main: string, legacy: string },
 *   tracker: { systemPromptTemplate: string, userPromptSuffix: string, stockPrompts: Record<string, string> },
 *   lorebook: {
 *     routerSystemPromptTemplate: string,
 *     routerModularPromptTemplate: string,
 *     modules: Record<string, { instruction: string, format: string }>
 *   },
 *   world: { worldProgressionSystemPrompt: string, worldProgressionSkeletonSystemPrompt: string }
 * }}
 */
export function buildBundledPromptsSnapshot() {
    const defaults = buildDefaultSettings();
    /** @type {Record<string, { instruction: string, format: string }>} */
    const modules = {};
    for (const [id, def] of Object.entries(DEFAULT_MODULES)) {
        modules[id] = {
            instruction: def.instruction || '',
            format: def.format || '',
        };
    }
    return normalizeBundledPromptsSnapshot({
        sysprompt: {
            main: RT_PROMPTS['sysprompt.txt'] || '',
            legacy: RT_PROMPTS['sysprompt_legacy.txt'] || '',
        },
        tracker: {
            systemPromptTemplate: defaults.systemPromptTemplate || '',
            userPromptSuffix: defaults.userPromptSuffix || '',
            stockPrompts: JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS)),
        },
        lorebook: {
            routerSystemPromptTemplate: defaults.routerSystemPromptTemplate || '',
            routerModularPromptTemplate: defaults.routerModularPromptTemplate || '',
            modules,
        },
        world: {
            worldProgressionSystemPrompt: defaults.worldProgressionSystemPrompt || '',
            worldProgressionSkeletonSystemPrompt: defaults.worldProgressionSkeletonSystemPrompt || '',
        },
    });
}

/** Category ids used by the Prompt Defaults Updated dialog. */
export const PROMPT_DEFAULTS_CATEGORIES = /** @type {const} */ ([
    'sysprompt',
    'tracker',
    'lorebook',
    'world',
]);

/** @type {Record<(typeof PROMPT_DEFAULTS_CATEGORIES)[number], string>} */
export const PROMPT_DEFAULTS_CATEGORY_LABELS = {
    sysprompt: 'Main System Prompt',
    tracker: 'State Tracker Prompts',
    lorebook: 'Lorebook Agent Prompts',
    world: 'World Progression Prompts',
};

/**
 * Flatten a snapshot category into labeled text blocks for line-diffing.
 * Sysprompt display prefers the main (dice-tool) prompt; legacy is included under a header.
 * @param {ReturnType<typeof buildBundledPromptsSnapshot>} snap
 * @param {(typeof PROMPT_DEFAULTS_CATEGORIES)[number]} category
 * @returns {{ label: string, text: string }[]}
 */
export function getSnapshotCategoryBlocks(snap, category) {
    if (!snap) return [];
    if (category === 'sysprompt') {
        const blocks = [{ label: 'sysprompt.txt', text: snap.sysprompt?.main || '' }];
        if (snap.sysprompt?.legacy) {
            blocks.push({ label: 'sysprompt_legacy.txt', text: snap.sysprompt.legacy });
        }
        return blocks;
    }
    if (category === 'tracker') {
        const blocks = [
            { label: 'Core State Model', text: snap.tracker?.systemPromptTemplate || '' },
            { label: 'User Prompt Suffix', text: snap.tracker?.userPromptSuffix || '' },
        ];
        const stock = snap.tracker?.stockPrompts || {};
        for (const key of Object.keys(stock).sort()) {
            blocks.push({ label: `Stock: ${key}`, text: stock[key] || '' });
        }
        return blocks;
    }
    if (category === 'lorebook') {
        const blocks = [
            { label: 'Router System Prompt', text: snap.lorebook?.routerSystemPromptTemplate || '' },
            { label: 'Modular Prompt Template', text: snap.lorebook?.routerModularPromptTemplate || '' },
        ];
        const modules = snap.lorebook?.modules || {};
        for (const id of Object.keys(modules).sort()) {
            const m = modules[id] || {};
            blocks.push({ label: `Module ${id} instruction`, text: m.instruction || '' });
            blocks.push({ label: `Module ${id} format`, text: m.format || '' });
        }
        return blocks;
    }
    if (category === 'world') {
        return [
            { label: 'World Progression System', text: snap.world?.worldProgressionSystemPrompt || '' },
            { label: 'Skeleton System Prompt', text: snap.world?.worldProgressionSkeletonSystemPrompt || '' },
        ];
    }
    return [];
}

/**
 * Live user copy for the same category blocks (for impact badges only).
 * @param {Record<string, any>} settings
 * @param {(typeof PROMPT_DEFAULTS_CATEGORIES)[number]} category
 * @param {{ mainSyspromptText?: string }} [opts]
 * @returns {{ label: string, text: string }[]}
 */
export function getLivePromptCategoryBlocks(settings, category, opts = {}) {
    const s = settings || {};
    if (category === 'sysprompt') {
        // Prefer the Quick Prompt Main textarea when provided; customSysprompt means user-owned text.
        const text = opts.mainSyspromptText != null
            ? String(opts.mainSyspromptText)
            : (s.customSysprompt ? '(custom sysprompt — not auto-managed)' : '');
        return [{ label: 'sysprompt.txt', text }];
    }
    if (category === 'tracker') {
        const defaults = buildDefaultSettings();
        const blocks = [
            { label: 'Core State Model', text: s.systemPromptTemplate ?? defaults.systemPromptTemplate ?? '' },
            { label: 'User Prompt Suffix', text: s.userPromptSuffix ?? defaults.userPromptSuffix ?? '' },
        ];
        const stock = s.stockPrompts || {};
        const keys = new Set([...Object.keys(DEFAULT_STOCK_PROMPTS), ...Object.keys(stock)]);
        for (const key of [...keys].sort()) {
            blocks.push({ label: `Stock: ${key}`, text: stock[key] ?? '' });
        }
        return blocks;
    }
    if (category === 'lorebook') {
        const defaults = buildDefaultSettings();
        const blocks = [
            {
                label: 'Router System Prompt',
                text: s.routerSystemPromptTemplate ?? defaults.routerSystemPromptTemplate ?? '',
            },
            {
                label: 'Modular Prompt Template',
                text: s.routerModularPromptTemplate ?? defaults.routerModularPromptTemplate ?? '',
            },
        ];
        const liveMods = s.routerModules || {};
        const ids = new Set([...Object.keys(DEFAULT_MODULES), ...Object.keys(liveMods)]);
        for (const id of [...ids].sort()) {
            const live = liveMods[id] || {};
            const def = DEFAULT_MODULES[id] || {};
            blocks.push({ label: `Module ${id} instruction`, text: live.instruction ?? def.instruction ?? '' });
            blocks.push({ label: `Module ${id} format`, text: live.format ?? def.format ?? '' });
        }
        return blocks;
    }
    if (category === 'world') {
        const defaults = buildDefaultSettings();
        return [
            {
                label: 'World Progression System',
                text: s.worldProgressionSystemPrompt ?? defaults.worldProgressionSystemPrompt ?? '',
            },
            {
                label: 'Skeleton System Prompt',
                text: s.worldProgressionSkeletonSystemPrompt ?? defaults.worldProgressionSkeletonSystemPrompt ?? '',
            },
        ];
    }
    return [];
}

/**
 * @param {{ label: string, text: string }[]} blocks
 * @returns {string}
 */
function joinCategoryBlocks(blocks) {
    return (blocks || []).map((b) => `### ${b.label}\n${b.text ?? ''}`).join('\n\n');
}

/**
 * Impact badge for one category relative to old/new shipped snapshots.
 * @param {ReturnType<typeof buildBundledPromptsSnapshot>|null|undefined} oldSnap
 * @param {ReturnType<typeof buildBundledPromptsSnapshot>} newSnap
 * @param {Record<string, any>} liveSettings
 * @param {(typeof PROMPT_DEFAULTS_CATEGORIES)[number]} category
 * @param {{ mainSyspromptText?: string }} [opts]
 * @returns {'customized'|'matches new'|'matches old'|'unknown'}
 */
export function getPromptCategoryImpactBadge(oldSnap, newSnap, liveSettings, category, opts = {}) {
    if (category === 'sysprompt' && liveSettings?.customSysprompt) {
        return 'customized';
    }
    const liveText = joinCategoryBlocks(getLivePromptCategoryBlocks(liveSettings, category, opts));
    const newText = joinCategoryBlocks(getSnapshotCategoryBlocks(newSnap, category));
    if (liveText === newText) return 'matches new';
    if (oldSnap) {
        const oldText = joinCategoryBlocks(getSnapshotCategoryBlocks(oldSnap, category));
        // For sysprompt, live may only include main (or textarea); compare main-only when possible.
        if (category === 'sysprompt') {
            const liveMain = (opts.mainSyspromptText != null)
                ? String(opts.mainSyspromptText)
                : '';
            if (liveMain && liveMain === (newSnap.sysprompt?.main || '')) return 'matches new';
            if (liveMain && liveMain === (oldSnap.sysprompt?.main || '')) return 'matches old';
            if (liveMain && liveMain === (newSnap.sysprompt?.legacy || '')) return 'matches new';
            if (liveMain && liveMain === (oldSnap.sysprompt?.legacy || '')) return 'matches old';
            if (!liveMain && !liveSettings?.customSysprompt) return 'unknown';
        } else if (liveText === oldText) {
            return 'matches old';
        }
    }
    return 'customized';
}

/**
 * Fingerprint of all factory-shipped prompt defaults. Used to decide whether an
 * extension update warrants the prompt-reset dialog (version bumps alone are not enough).
 * @returns {string}
 */
export function computeBundledPromptsFingerprint() {
    return computeBundledPromptsFingerprintForSnapshot(buildBundledPromptsSnapshot());
}

/**
 * Computes a format-neutral fingerprint for either a current or legacy
 * persisted shipped-default snapshot.
 * @param {ReturnType<typeof buildBundledPromptsSnapshot>|Record<string, any>} snapshot
 * @returns {string}
 */
export function computeBundledPromptsFingerprintForSnapshot(snapshot) {
    return hashPromptBundle(JSON.stringify(normalizeBundledPromptsSnapshot(snapshot)));
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
    'cyoaConfig',
    'narrativePacing',
    'npcRelationshipBars',
    'rngEnabled',
    'diceFunctionTool',
    'diceD100Mode',
    'rngToolD20',
    'rngToolD100',
    'rngQueueD20',
    'rngQueueD100',
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
    'portraitLocationSystemPrompt',
    'portraitPromptWordTarget',
    'savedPortraitPromptPresets',
    'npcCoreSections',
    'pcCoreSections',
    'npcSectionPresets',
    'pcSectionPresets',
    // ── Lorebook Agent (Researcher/Router) ────────────────────────────────
    'routerSystemPromptTemplate',
    'routerModularPromptTemplate',
    'routerModules',
    'routerCustomTags',
    // ── World Progression ──────────────────────────────────────────────────────
    'worldProgressionSystemPrompt',
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
 * Logical groups of cartridge payload keys used by the selective load dialog
 * (game-cartridges.js). Each group has a human-readable label, a short
 * description, and the list of payload keys that belong to it. The order here
 * determines the display order in the dialog.
 */
export const CARTRIDGE_PAYLOAD_GROUPS = [
    {
        id: 'stateTracker',
        label: 'State Tracker',
        description: 'Extractor prompt, module toggles, block order, stock prompts, RNG & time-format flags',
        keys: [
            'systemPromptTemplate', 'modules', 'blockOrder', 'stockPrompts',
            'syspromptModules', 'narrativePacing', 'syspromptSectionOrder', 'customSyspromptLibrary',
            'rngEnabled', 'diceFunctionTool', 'diceD100Mode',
            'rngToolD20', 'rngToolD100', 'rngQueueD20', 'rngQueueD100',
            'use24hTime', 'useDdMmYyFormat',
        ],
    },
    {
        id: 'cyoa',
        label: 'CYOA Mode',
        description: 'Choice-slot setup, custom prompt, button appearance, and saved CYOA presets',
        keys: ['cyoaConfig'],
    },
    {
        id: 'gameSystems',
        label: 'Game Systems & Customization & Custom Fields',
        description: 'Custom game systems and custom tracker fields',
        keys: ['gameSystems', 'customFields'],
    },
    {
        id: 'characterSheets',
        label: 'Character Sheets',
        description: 'NPC/PC core sections, section presets, relationship bar toggle',
        keys: ['npcCoreSections', 'pcCoreSections', 'npcSectionPresets', 'pcSectionPresets', 'npcRelationshipBars'],
    },
    {
        id: 'portraits',
        label: 'Portrait Generator',
        description: 'NPC and character portrait prompt templates, word target, saved presets',
        keys: [
            'portraitNpcSystemPrompt', 'portraitCharacterSystemPrompt', 'portraitLocationSystemPrompt',
            'portraitPromptWordTarget', 'savedPortraitPromptPresets',
        ],
    },
    {
        id: 'lorebookAgent',
        label: 'Lorebook Agent',
        description: 'Researcher agent system prompt, modular format prompt, module definitions, custom tags',
        keys: ['routerSystemPromptTemplate', 'routerModularPromptTemplate', 'routerModules', 'routerCustomTags'],
    },
    {
        id: 'worldProgression',
        label: 'World Progression',
        description: 'Report Generation Prompt used by the World Progression Engine',
        keys: ['worldProgressionSystemPrompt'],
    },
];
