// ─────────────────────────────────────────────────────────────────────────
// Game Systems — Wizard, bundle management, and base-section unlocking.
//
// This module owns everything that used to live under the "Sysprompt Editor"
// drawer in index.js: the Custom Sysprompt Library, the AI/Manual section
// builders, and the section editor popup. It additionally implements:
//   1. Game System Wizard   — one AI call generates a linked GM section +
//                              tracker module pair (tag-based, no tool calls).
//   2. Manage Game Systems  — list/toggle/edit/delete/export those bundles.
//   3. Unlock Base Sections — fully override any built-in sysprompt.txt
//                              section while leaving the rest of the prompt
//                              intact.
// ─────────────────────────────────────────────────────────────────────────

import { getSettings, getNpcRelationshipMax, buildRelationshipTrackingSysprompt, recordDeletedCustomTags, clearDeletedCustomTagTombstones } from './state-manager.js';
import { sendStateRequest, restoreUserMacro } from './llm-client.js';
import { escapeHtml } from './memo-processor.js';
import { refreshOrderList } from './ui-editors.js';
import { QUESTS_NARRATOR, DEFAULT_STOCK_PROMPTS, resolveTimePromptKey, buildCyoaPrompt } from './constants.js';
import { getSortableDelay } from '../../../utils.js';
import { POPUP_RESULT } from '../../../popup.js';
import { openManageGameCartridges } from './game-cartridges.js';
import {
    RENDERING_TAGS_LIBRARY,
    saveSettings,
    refreshRenderedView,
    autoApplySysprompt,
    fetchBaseSyspromptRaw,
} from './index.js';

/** @typedef {{ deferPersistence?: boolean }} SyspromptPersistOptions */

async function persistSyspromptChanges(deferPersistence) {
    if (deferPersistence) return;
    saveSettings();
    await autoApplySysprompt(true);
}

function snapshotControlRoomSettings(settings) {
    return {
        syspromptSectionOrder: JSON.parse(JSON.stringify(settings.syspromptSectionOrder || [])),
        syspromptModules: JSON.parse(JSON.stringify(settings.syspromptModules || {})),
        npcRelationshipBars: settings.npcRelationshipBars,
        customSyspromptLibrary: JSON.parse(JSON.stringify(settings.customSyspromptLibrary || [])),
        gameSystems: JSON.parse(JSON.stringify(settings.gameSystems || [])),
        customFields: JSON.parse(JSON.stringify(settings.customFields || [])),
        blockOrder: JSON.parse(JSON.stringify(settings.blockOrder || [])),
        customSysprompt: settings.customSysprompt,
    };
}

function restoreControlRoomSettings(settings, snapshot) {
    settings.syspromptSectionOrder = snapshot.syspromptSectionOrder;
    settings.syspromptModules = snapshot.syspromptModules;
    settings.npcRelationshipBars = snapshot.npcRelationshipBars;
    settings.customSyspromptLibrary = snapshot.customSyspromptLibrary;
    settings.gameSystems = snapshot.gameSystems;
    settings.customFields = snapshot.customFields;
    settings.blockOrder = snapshot.blockOrder;
    settings.customSysprompt = snapshot.customSysprompt;
}

/** Popup sizing for content-heavy Game Systems dialogs (90% screen, scrollable). */
const GS_POPUP_LARGE = { wide: true, large: true, allowVerticalScrolling: true };
const GS_TEXTAREA_TALL_STYLE = 'width:100%; font-size:11px; font-family:monospace; resize:vertical; min-height:280px;';
const GS_TEXTAREA_EXPORT_STYLE = 'width:100%; font-size:11px; font-family:monospace; resize:vertical; min-height:360px;';
const GS_WIZARD_PROMPT_TEXTAREA_STYLE = 'width:100%; font-size:11px; font-family:monospace; resize:vertical; min-height:180px; max-height:min(40vh, 420px);';

/** @returns {string} Factory default Game System Wizard system prompt. */
export function buildDefaultWizardSystemPrompt() {
    return buildWizardSystemPrompt();
}

/** @param {object} settings @param {string} [overrideText] */
export function getEffectiveWizardSystemPrompt(settings, overrideText) {
    const custom = (overrideText ?? settings?.gameSystemWizardSystemPrompt ?? '').trim();
    return custom || buildWizardSystemPrompt();
}

/** @param {object} settings @param {string} text */
function persistWizardSystemPrompt(settings, text) {
    const trimmed = (text || '').trim();
    const defaultPrompt = buildWizardSystemPrompt();
    settings.gameSystemWizardSystemPrompt = (trimmed && trimmed !== defaultPrompt) ? trimmed : '';
    saveSettings();
}

/** @param {string} textareaId @param {string} promptText */
function buildWizardPromptEditorHtml(textareaId, promptText) {
    return `
        <details style="border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px 10px; background:rgba(0,0,0,0.12);">
            <summary style="cursor:pointer; font-size:11px; font-weight:bold; opacity:0.9;">Wizard system prompt <span style="font-weight:normal; opacity:0.65;">(view / edit / copy for Gemini &amp; other bots)</span></summary>
            <div style="font-size:10px; opacity:0.6; line-height:1.35; margin:8px 0 6px;">
                Base architect instructions (no example block). During Generate / Regenerate / Iterate, a Sustenance example matching the current <b>Effect owner</b> choice is appended automatically. Copy this text for external bots — add the example half that matches your effect-owner mode if you want a full reference.
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px;">
                <button type="button" class="menu_button interactable rt-gs-copy-wizard-prompt" data-target="${textareaId}" style="font-size:11px; padding:3px 10px;">
                    <i class="fa-solid fa-copy"></i> Copy prompt
                </button>
                <button type="button" class="menu_button interactable rt-gs-reset-wizard-prompt" data-target="${textareaId}" style="font-size:11px; padding:3px 10px;">
                    <i class="fa-solid fa-rotate-left"></i> Reset to default
                </button>
            </div>
            <textarea id="${textareaId}" class="text_pole" rows="12" style="${GS_WIZARD_PROMPT_TEXTAREA_STYLE}">${escapeHtml(promptText)}</textarea>
        </details>`;
}

/** @param {object} settings @param {string} textareaId */
function bindWizardPromptEditor(settings, textareaId) {
    document.querySelector(`.rt-gs-copy-wizard-prompt[data-target="${textareaId}"]`)?.addEventListener('click', async () => {
        const ta = document.getElementById(textareaId);
        if (!ta) return;
        try {
            await navigator.clipboard.writeText(ta.value);
            toastr['success']('Wizard system prompt copied.', 'Game System Wizard');
        } catch {
            ta.focus();
            ta.select();
            document.execCommand('copy');
            toastr['success']('Wizard system prompt copied.', 'Game System Wizard');
        }
    });
    document.querySelector(`.rt-gs-reset-wizard-prompt[data-target="${textareaId}"]`)?.addEventListener('click', () => {
        const ta = document.getElementById(textareaId);
        if (!ta) return;
        ta.value = buildWizardSystemPrompt();
        persistWizardSystemPrompt(settings, '');
        toastr['info']('Wizard system prompt reset to default.', 'Game System Wizard');
    });
    const ta = document.getElementById(textareaId);
    ta?.addEventListener('change', () => persistWizardSystemPrompt(settings, ta.value));
    ta?.addEventListener('input', () => persistWizardSystemPrompt(settings, ta.value));
}

/** @param {object} settings @param {string} [overrideText] */
function readWizardSystemPromptFromUi(settings, textareaId) {
    const ta = document.getElementById(textareaId);
    const text = ta?.value?.trim() || '';
    persistWizardSystemPrompt(settings, text);
    return getEffectiveWizardSystemPrompt(settings, text);
}

/** @param {string} basePrompt @param {'tracker'|'gm'} [effectOwner] */
function composeWizardArchitectPrompt(basePrompt, effectOwner = 'tracker') {
    const base = (basePrompt || '').trim();
    const example = buildWizardOutputExample(effectOwner);
    return example ? `${base}\n\n${example}` : base;
}

/** Connection overlay for Game Systems wizard / AI builder LLM calls (separate from main tracker). */
function getGameSystemWizardConnectionSettings(baseSettings) {
    const s = baseSettings || getSettings();
    return {
        connectionSource: s.gameSystemWizardConnectionSource || 'default',
        connectionProfileId: s.gameSystemWizardConnectionProfileId || '',
        completionPresetId: s.gameSystemWizardCompletionPresetId || '',
        ollamaUrl: s.gameSystemWizardOllamaUrl || 'http://localhost:11434',
        ollamaModel: s.gameSystemWizardOllamaModel || '',
        openaiUrl: s.gameSystemWizardOpenaiUrl || '',
        openaiKey: s.gameSystemWizardOpenaiKey || '',
        openaiModel: s.gameSystemWizardOpenaiModel || '',
        maxTokens: s.maxTokens,
        debugMode: s.debugMode,
    };
}

/** Persona / player names that must not be baked into wizard output (use {{user}} instead). */
async function getPlayerMacroReplacementNames() {
    const names = new Set();
    try {
        const script = await import('../../../../script.js');
        if (script.name1?.trim()) names.add(script.name1.trim());
    } catch (_) { /* optional */ }
    try {
        const [{ user_avatar }, { power_user }] = await Promise.all([
            import('../../../personas.js'),
            import('../../../power-user.js'),
        ]);
        const personaName = user_avatar ? (power_user.personas?.[user_avatar] ?? '').trim() : '';
        if (personaName) names.add(personaName);
    } catch (_) { /* optional */ }
    return [...names];
}

function sanitizeWizardMacroContent(content, names = []) {
    return restoreUserMacro(content, names);
}

/** Wizard LLM call — shields {{user}} from ST macro substitution, then restores it in output. */
async function sendWizardStateRequest(settings, systemPrompt, userPrompt, signal = null) {
    const names = await getPlayerMacroReplacementNames();
    const raw = await sendStateRequest(
        getGameSystemWizardConnectionSettings(settings),
        systemPrompt,
        userPrompt,
        signal,
        { preserveUserMacro: true, userMacroNames: names },
    );
    return { raw, names };
}

// ─────────────────────────────────────────────────────────────────────────
// Small shared helpers
// ─────────────────────────────────────────────────────────────────────────

function sanitizeSnakeTag(str) {
    return (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_section';
}

function sanitizeUpperTag(str) {
    return (str || '').toUpperCase().trim().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'CUSTOM';
}

function uniqueTag(base, isTaken) {
    let candidate = base;
    let counter = 1;
    while (isTaken(candidate)) {
        counter++;
        candidate = `${base}_${counter}`;
    }
    return candidate;
}

function parseTagAttributes(attrStr) {
    const attrs = {};
    const re = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(attrStr || ''))) attrs[m[1]] = m[2];
    return attrs;
}

/** Extracts a self-closing tag's attributes, e.g. <meta name="X" .../> */
function extractSelfClosingTag(raw, tagName) {
    const re = new RegExp(`<${tagName}\\b([^>]*?)/?>`, 'i');
    const m = raw.match(re);
    return m ? parseTagAttributes(m[1]) : null;
}

/** Extracts a tag block's attributes + inner content, e.g. <gm_section tag="x">...</gm_section> */
function extractTagBlock(raw, tagName) {
    const re = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const m = raw.match(re);
    if (!m) return null;
    return { attrs: parseTagAttributes(m[1]), content: m[2].trim() };
}

/**
 * If `content` isn't already self-wrapped in `<tag>...</tag>`, wrap it.
 * Handles both fresh AI generation (raw instructions) and round-tripped
 * export/import (already wrapped) uniformly.
 */
function normalizeGmContent(tag, content) {
    const trimmed = (content || '').trim();
    const re = new RegExp(`^<${tag}[^>]*>[\\s\\S]*<\\/${tag}>$`);
    if (re.test(trimmed)) return trimmed;
    return `<${tag}>\n${trimmed}\n</${tag}>`;
}

/** Matches sysprompt section tag names, including bracket-prefixed tags like [PARTY]_mechanics. */
const SYSPROMPT_TAG_NAME = '(?:\\[[^\\]]+\\][\\w_-]*|\\w[\\w_-]*)';

/** Extracts the top-level (non-nested) <tag>...</tag> sections from a raw sysprompt text. */
export function extractTopLevelSections(rawText) {
    const sections = [];
    const re = new RegExp(`<(${SYSPROMPT_TAG_NAME})>([\\s\\S]*?)<\\/\\1>`, 'g');
    let m;
    while ((m = re.exec(rawText || ''))) {
        sections.push({ tag: m[1], content: m[2].trim() });
    }
    return sections;
}

function buildExistingTagsContext(settings) {
    let context = "=== ACTIVE / ENABLED SYSTEMS & TRACKING FIELDS ===\n\n";

    // 1. Stock Modules
    const BLOCK_ORDER = ['CHARACTER', 'PARTY', 'COMBAT', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME', 'QUESTS'];
    BLOCK_ORDER.forEach(tag => {
        if (tag === 'QUESTS' && settings.syspromptModules?.quests === false) return;
        if (!settings.modules || settings.modules[tag] !== false) {
            const modLower = tag === 'TIME' ? resolveTimePromptKey(settings) : tag.toLowerCase();
            const promptContent = (settings.stockPrompts && settings.stockPrompts[modLower]) 
                ? settings.stockPrompts[modLower] 
                : DEFAULT_STOCK_PROMPTS[modLower] || '';
            context += `[${tag}] (Stock Module)\nPrompt:\n${promptContent}\n\n`;
        }
    });

    // 2. Custom Fields / Tracker Modules
    if (settings.customFields && settings.customFields.length > 0) {
        settings.customFields.forEach(f => {
            if (!settings.modules || settings.modules[f.tag.toUpperCase()] !== false) {
                context += `[${f.tag.toUpperCase()}] (Custom Tracker Module: ${f.label})\nPrompt:\n${f.prompt}\nTemplate:\n${f.template}\n\n`;
            }
        });
    }

    // 3. Custom GM Sections
    if (settings.customSyspromptLibrary && settings.customSyspromptLibrary.length > 0) {
        settings.customSyspromptLibrary.forEach(p => {
            if (!isBlankSectionContent(p.content)) {
                context += `<${p.tag}> (Custom GM/Narrator Section)\nInstructions:\n${p.content}\n\n`;
            }
        });
    }

    return context.trim();
}

// ─────────────────────────────────────────────────────────────────────────
// System Prompt Control Room — ordering + row-resolution helpers.
//
// Every top-level sysprompt section (built-in or custom) is addressed by a
// stable string key: "base:<tag>" for one of the fixed sysprompt.txt tags,
// or "lib:<id>" for a customSyspromptLibrary entry. settings.syspromptSectionOrder
// holds the canonical render order of these keys; index.js's buildSysprompt()
// walks that order and resolves each key via getSectionRowDescriptor() below
// to assemble the final prompt in one deterministic pass.
// ─────────────────────────────────────────────────────────────────────────

/** True if `content` is empty or just an empty XML wrapper (e.g. <tag>\n\n</tag>). */
export function isBlankSectionContent(content) {
    const trimmed = (content || '').trim();
    if (!trimmed) return true;
    return new RegExp(`^<(${SYSPROMPT_TAG_NAME})>\\s*<\\/\\1>$`).test(trimmed);
}

/** Narrator Configuration tags whose enabled-state doubles as a base sysprompt toggle. */
const KNOWN_TOGGLE_DEFAULTS = { loot: true, random_events: true, resting: true, party_bench: true, quests: true, CYOA_mode: false };

/** Checkbox ids from the Narrator Configuration panel, keyed by base sysprompt tag. */
const NARRATOR_TOGGLE_IDS = {
    loot: 'rpg_sysprompt_mod_loot',
    random_events: 'rpg_sysprompt_mod_random_events',
    resting: 'rpg_sysprompt_mod_resting',
    party_bench: 'rpg_sysprompt_mod_party_bench',
    quests: 'rpg_sysprompt_mod_quests',
    CYOA_mode: 'rpg_sysprompt_mod_cyoa_mode',
    relationship_tracking: 'rpg_sysprompt_mod_npc_rel_bars',
};

export function isSectionUnlocked(settings, tag) {
    return (settings.customSyspromptLibrary || []).some(p => p.origin === 'unlocked_base' && p.baseTag === tag);
}

/** Whether a built-in (non-unlocked) base section is currently enabled. */
export function isBaseSectionEnabled(tag, settings) {
    if (tag === 'relationship_tracking') return !!settings.npcRelationshipBars;
    const mods = settings.syspromptModules || {};
    if (tag === 'CYOA_mode') return mods.CYOA_mode === true;
    return mods[tag] !== false;
}

/** Enables/disables a built-in base section and keeps the Narrator Configuration UI in sync. */
export function setBaseSectionEnabled(tag, enabled, settings) {
    if (tag === 'relationship_tracking') {
        settings.npcRelationshipBars = enabled;
    } else {
        if (!settings.syspromptModules) settings.syspromptModules = {};
        settings.syspromptModules[tag] = enabled;
    }
    syncNarratorToggleUi(tag, settings);
}

/** Pushes current enabled + unlocked/disabled state into a Narrator Configuration checkbox, if one exists for this tag. */
function syncNarratorToggleUi(tag, settings) {
    const id = NARRATOR_TOGGLE_IDS[tag];
    if (!id) return;
    const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
    if (!el) return;
    const unlocked = isSectionUnlocked(settings, tag);
    el.checked = isBaseSectionEnabled(tag, settings);
    el.disabled = unlocked;
    const label = el.closest('label');
    if (label) label.title = unlocked ? 'Managed in Game Systems (unlocked) — edit it there instead.' : '';
}

/**
 * Syncs every Narrator Configuration checkbox against current settings — disabling
 * ones whose section is unlocked, and reflecting current enabled state for the rest.
 * Call once on settings init, and after any Control Room enable/unlock/re-lock change.
 */
export function syncAllNarratorTogglesForUnlockState() {
    const settings = getSettings();
    Object.keys(NARRATOR_TOGGLE_IDS).forEach(tag => syncNarratorToggleUi(tag, settings));
}

/**
 * Applies the built-in per-tag content transform (relationship_tracking swap,
 * rng_system disabled-fallback text, quests instruction/hardcore-mode stripping,
 * footer time-format) to one base section in isolation. Returns the full
 * `<tag>...<tag>` block, or '' if the transform determines it should be omitted.
 */
export function transformBaseSectionContent(tag, innerContent, settings) {
    const mods = settings.syspromptModules || {};
    const d100Mode = !!settings.diceD100Mode;

    if (tag === 'CYOA_mode') {
        const cfg = settings.cyoaConfig || {};
        const promptText = cfg.customPromptText?.trim() || buildCyoaPrompt(cfg);
        return `<CYOA_mode>\n${promptText}\n</CYOA_mode>`;
    }
    if (tag === 'random_events' && !(settings.rngEnabled && settings.diceFunctionTool)) {
        innerContent = innerContent.replace(/\s*Batch both RollTheDice calls together;[^.]*\./g, '');
    }

    if (tag === 'relationship_tracking') {
        if (!settings.npcRelationshipBars) return '';
        return `<relationship_tracking>\n${buildRelationshipTrackingSysprompt(getNpcRelationshipMax(settings))}\n</relationship_tracking>`;
    }

    if (tag === 'rng_system' && !settings.rngEnabled) {
        const dieWord = d100Mode ? 'd100' : 'd20';
        let fallbackText = `To resolve actions, simulate a fair ${dieWord} roll internally and maintain all ROLL FORMAT rules.\n\n`;
        let matchedFormat = false;
        if (innerContent.includes('ROLL FORMAT')) {
            const rollFormatMatch = innerContent.match(/(ROLL FORMAT[\s\S]*?)(?=\n\[FALLBACK\]|$)/i);
            if (rollFormatMatch) { fallbackText += rollFormatMatch[1].trim(); matchedFormat = true; }
        } else {
            const l4 = innerContent.match(/4\.\s*(Output[\s\S]*?)(?=\n\[FALLBACK\]|$)/i);
            if (l4) { fallbackText += l4[1].replace(/5\.\s*/g, '').trim(); matchedFormat = true; }
        }
        if (!matchedFormat) {
            fallbackText += `Output rolls as \`[ROLL: 1${dieWord}+Mod vs DC X (Result: Y) -> Outcome]\` or \`[ROLL: 1${dieWord}+Mod (Result: Y) -> Outcome]\`.`;
        }
        return `<rng_system>\n${fallbackText.trim()}\n</rng_system>`;
    }

    if (tag === 'quests') {
        let instruction = QUESTS_NARRATOR;
        if (!mods.questsFrustration) {
            instruction = instruction.replace(/ Quest MOOD \(in STATE MEMO, from time pressure \+ FRUSTRATION_COEFF\) should guide questgiver tone for NPC-given quests only\./g, '');
        }
        let result = `<quests>\n${instruction.trim()}\n</quests>`;
        if (!mods.questsDeadlines) {
            result = result.replace(/- Assign an in-world Deadline.*\n/g, '');
            result = result.replace(/- Set auto_fail to true for quests.*\n/g, '');
            result = result.replace(/- If a duration is given.* Day N.*\n/g, '');
        }
        return result;
    }

    if (tag === '[PARTY]_mechanics') {
        let content = innerContent.trim();
        if (mods.party_bench === false) {
            content = content.replace(/\s*<leaving_vs_benching>[\s\S]*?<\/leaving_vs_benching>/i, '').trim();
            content = content.replace(/\s*<bench_ETA_system>[\s\S]*?<\/bench_ETA_system>/i, '').trim();
        }
        return `<[PARTY]_mechanics>\n${content}\n</[PARTY]_mechanics>`;
    }

    if (tag === 'party_bench') {
        return '';
    }

    if (tag === 'end_of_output_footer') {
        let footerContent = `<end_of_output_footer>\n${innerContent.trim()}\n</end_of_output_footer>`;
        if (settings.use24hTime) {
            footerContent = footerContent.replace(/\[HH:MM AM\/PM\]/g, '[HH:MM] (24-hour clock, NO AM/PM)');
        }
        if (settings.useDdMmYyFormat) {
            footerContent = footerContent.replace(/Day\s+\[X\]/g, '[DD/MM/YYYY]');
        }
        return footerContent;
    }

    // Default: wrap inner content in the section tag
    let result = `<${tag}>\n${innerContent.trim()}\n</${tag}>`;

    // ── d100 Mode substitutions ─────────────────────────────────────────────
    // Applied last so they work across all sections (rng_system, constraints, etc.)
    if (d100Mode) {
        result = result
            .replace(/\bRollTheDice\b/g, 'RollTheDiceD100')
            .replace(/\[RNG_QUEUE v7\.0\]/g, '[RNG_QUEUE_d100 v7.0]')
            .replace(/\[\/RNG_QUEUE\]/g, '[/RNG_QUEUE_d100]')
            .replace(/\b1d20\b/g, '1d100')
            .replace(/\bd20\b/gi, 'd100')
            .replace(/(?:The\s+)?first\s+number\s+in\s+each\s+entry\s+is\s+the\s+d100\s+result/gi, 'Each entry in the queue is a d100 result')
            .replace(/(queue\s+length(?:\s+is|:)\s+)12/gi, '$130');
    }

    return result;
}

/**
 * Reconciles settings.syspromptSectionOrder against the live set of base tags and
 * orderable library entries (everything except unlocked_base overrides, which ride
 * along on their base:<tag> slot instead of getting their own order entry). Drops
 * stale keys, appends missing base tags defensively, and inserts any new library
 * entries right before base:constraints (matching the legacy "append before
 * <constraints>" behavior) or at the end if there's no constraints row.
 * Mutates + returns settings.syspromptSectionOrder.
 * @param {object} settings
 * @param {{tag:string, content:string}[]} baseSections - from extractTopLevelSections()
 * @returns {string[]}
 */
export function normalizeSectionOrder(settings, baseSections) {
    if (!Array.isArray(settings.syspromptSectionOrder)) settings.syspromptSectionOrder = [];
    settings.syspromptSectionOrder = settings.syspromptSectionOrder.map(key =>
        key === 'base:party_join_leave' ? 'base:[PARTY]_mechanics' : key,
    );
    (settings.customSyspromptLibrary || []).forEach(p => {
        if (p.baseTag === 'party_join_leave') p.baseTag = '[PARTY]_mechanics';
    });
    const library = settings.customSyspromptLibrary || [];
    const orderableLibKeys = new Set(library.filter(p => p.origin !== 'unlocked_base').map(p => `lib:${p.id}`));
    const baseKeys = baseSections.map(s => `base:${s.tag}`);
    const baseKeySet = new Set(baseKeys);

    let order = settings.syspromptSectionOrder.filter(key => {
        if (key.startsWith('base:')) return baseKeySet.has(key);
        if (key.startsWith('lib:')) return orderableLibKeys.has(key);
        return false;
    });

    baseKeys.forEach(key => {
        if (order.includes(key)) return;
        const fileIdx = baseKeys.indexOf(key);
        let insertAt = order.length;
        for (let i = fileIdx - 1; i >= 0; i--) {
            const earlierPos = order.indexOf(baseKeys[i]);
            if (earlierPos !== -1) {
                insertAt = earlierPos + 1;
                break;
            }
        }
        if (insertAt === order.length) {
            for (let i = fileIdx + 1; i < baseKeys.length; i++) {
                const laterPos = order.indexOf(baseKeys[i]);
                if (laterPos !== -1) {
                    insertAt = laterPos;
                    break;
                }
            }
        }
        order.splice(insertAt, 0, key);
    });

    // Keep CYOA_mode directly above constraints when reconciling saved order.
    const cyoaKey = 'base:CYOA_mode';
    const constraintsKey = 'base:constraints';
    const cyoaIdx = order.indexOf(cyoaKey);
    const constraintsIdxForCyoa = order.indexOf(constraintsKey);
    if (cyoaIdx !== -1 && constraintsIdxForCyoa !== -1 && cyoaIdx > constraintsIdxForCyoa) {
        order.splice(cyoaIdx, 1);
        order.splice(constraintsIdxForCyoa, 0, cyoaKey);
    }

    const newLibKeys = [...orderableLibKeys].filter(key => !order.includes(key));
    if (newLibKeys.length) {
        const constraintsIdx = order.indexOf('base:constraints');
        if (constraintsIdx === -1) {
            order.push(...newLibKeys);
        } else {
            order.splice(constraintsIdx, 0, ...newLibKeys);
        }
    }

    settings.syspromptSectionOrder = order;
    return order;
}

/**
 * Resolves one order key into a display/action descriptor used by both the
 * Control Room UI and buildSysprompt()'s final assembly.
 * @param {string} key - "base:<tag>" or "lib:<id>"
 * @param {object} settings
 * @param {Map<string,string>} baseSectionMap - tag -> raw inner content, from extractTopLevelSections()
 * @returns {null|{key:string, kind:'base'|'unlocked'|'custom'|'wizard', tag:string, libId:(string|null), gameSystemId:(string|null), label:string, description:string, enabled:boolean, content:string}}
 */
export function getSectionRowDescriptor(key, settings, baseSectionMap) {
    const library = settings.customSyspromptLibrary || [];
    if (key.startsWith('base:')) {
        const tag = key.slice(5);
        const override = library.find(p => p.origin === 'unlocked_base' && p.baseTag === tag);
        if (override) {
            return {
                key, kind: 'unlocked', tag,
                libId: override.id,
                gameSystemId: null,
                label: `<${tag}>`,
                description: override.description || `Unlocked override of <${tag}>`,
                enabled: !!override.enabled,
                content: override.content,
            };
        }
        return {
            key, kind: 'base', tag,
            libId: null,
            gameSystemId: null,
            label: `<${tag}>`,
            description: '',
            enabled: isBaseSectionEnabled(tag, settings),
            content: baseSectionMap.get(tag) ?? '',
        };
    }

    const id = key.slice(4);
    const item = library.find(p => p.id === id);
    if (!item) return null;
    if (item.origin === 'wizard') {
        const gs = (settings.gameSystems || []).find(g => g.syspromptLibraryId === id);
        const wizardSubtext = buildWizardControlRoomSubtext(gs, settings);
        return {
            key, kind: 'wizard', tag: item.tag,
            libId: item.id,
            gameSystemId: gs?.id || null,
            icon: item.icon,
            label: `<${item.tag}>`,
            description: wizardSubtext || item.description || '',
            enabled: !!item.enabled,
            content: item.content,
        };
    }
    return {
        key, kind: 'custom', tag: item.tag,
        libId: item.id,
        gameSystemId: null,
        icon: item.icon,
        label: `<${item.tag}>`,
        description: item.description || 'Custom Section',
        enabled: !!item.enabled,
        content: item.content,
    };
}

// ─────────────────────────────────────────────────────────────────────────
// Unified Section Editor (moved from index.js, used by the Advanced tools
// and by Unlock Base Sections)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Show a unified popup for creating or editing a custom sysprompt section.
 * @param {object} opts
 * @param {'ai'|'manual'|'edit'} opts.mode
 * @param {string} [opts.tag]          - Pre-filled tag name (without angle brackets)
 * @param {string} [opts.description]  - Pre-filled label/description text
 * @param {string} [opts.content]      - Pre-filled XML content
 * @param {function} [opts.onRegenerate] - Async fn(desc) -> string; present in 'ai' mode
 * @returns {Promise<{tag:string, description:string, content:string, saveMode:string}|null>}
 */
export async function showSectionEditor({ mode = 'manual', tag = '', description = '', content = '', onRegenerate = null } = {}) {
    const { Popup } = SillyTavern.getContext();

    const titleMap = {
        ai: '✨ Review Generated Section',
        manual: '📝 Add Section Manually',
        edit: '✏️ Edit Section',
    };

    const showSaveOptions = mode !== 'edit';
    const showRegenerate = mode === 'ai';

    const editorHtml = `
        <div id="rt-section-editor" style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box;">
            <div style="display:flex; gap:8px;">
                <div style="flex:1;">
                    <div style="font-size:11px; opacity:0.7; margin-bottom:4px;">Tag Name (snake_case)</div>
                    <input id="rt-se-tag" type="text" class="text_pole" value="${escapeHtml(tag)}"
                        placeholder="e.g. reputation_system"
                        style="width:100%; font-size:12px; font-family:monospace;">
                </div>
                <div style="flex:2;">
                    <div style="font-size:11px; opacity:0.7; margin-bottom:4px;">Label / Description</div>
                    <input id="rt-se-desc" type="text" class="text_pole" value="${escapeHtml(description)}"
                        placeholder="Brief description of this section"
                        style="width:100%; font-size:12px;">
                </div>
            </div>
            <div>
                <div style="font-size:11px; opacity:0.7; margin-bottom:4px;">XML Content — paste or edit freely (outer XML tag is managed automatically)</div>
                <textarea id="rt-se-content" class="text_pole" rows="18"
                    style="width:100%; font-size:11px; font-family:monospace; resize:vertical; white-space:pre; min-height:280px;"
                    placeholder="  Rules go here...\n  - Rule 1\n  - Rule 2"
                    >${escapeHtml(content)}</textarea>
            </div>
            ${showRegenerate ? `<button id="rt-se-regen" class="menu_button interactable" style="background:rgba(180,100,255,0.15); border-color:rgba(180,100,255,0.4); width:100%;"><i class="fa-solid fa-rotate"></i> Regenerate with AI</button>` : ''}
            ${showSaveOptions ? `
            <div style="padding:10px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; background:rgba(0,0,0,0.2);">
                <div style="font-size:11px; font-weight:bold; margin-bottom:6px;">Save Options:</div>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:4px;">
                    <input type="radio" name="rt_se_save_mode" id="rt-se-mode-apply" value="apply" checked style="margin:0;">
                    <span style="font-size:12px;">Save to Library &amp; Apply to Sysprompt</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="radio" name="rt_se_save_mode" id="rt-se-mode-library" value="library" style="margin:0;">
                    <span style="font-size:12px;">Save to Library Only</span>
                </label>
            </div>` : ''}
        </div>
    `;

    let currentTag = tag;
    let currentDesc = description;
    let currentContent = content;
    let currentSaveMode = 'apply';

    // Attach event listeners after DOM is ready
    setTimeout(() => {
        const tagEl = document.getElementById('rt-se-tag');
        const descEl = document.getElementById('rt-se-desc');
        const contentEl = document.getElementById('rt-se-content');

        if (tagEl) {
            tagEl.addEventListener('input', () => { currentTag = tagEl.value; });
        }
        if (descEl) {
            descEl.addEventListener('input', () => { currentDesc = descEl.value; });
        }
        if (contentEl) {
            contentEl.addEventListener('input', () => { currentContent = contentEl.value; });
        }

        // Handle save mode radio buttons
        const saveModeEls = document.querySelectorAll('input[name="rt_se_save_mode"]');
        saveModeEls.forEach(el => {
            el.addEventListener('change', () => {
                const checked = document.querySelector('input[name="rt_se_save_mode"]:checked');
                if (checked) currentSaveMode = checked.value;
            });
        });

        // Attach regen handler
        if (showRegenerate && onRegenerate) {
            const regenBtn = document.getElementById('rt-se-regen');
            if (regenBtn) {
                regenBtn.addEventListener('click', async () => {
                    const currentDescVal = descEl ? descEl.value.trim() : description;
                    regenBtn.disabled = true;
                    regenBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Regenerating...';
                    try {
                        const newContent = await onRegenerate(currentDescVal);
                        if (contentEl) {
                            contentEl.value = newContent;
                            currentContent = newContent;
                        }
                        const extractedTag = newContent.match(/^<(\w+[\w_-]*)/)?.[1];
                        if (extractedTag && tagEl) {
                            if (!tagEl.value.trim()) {
                                tagEl.value = extractedTag;
                                currentTag = extractedTag;
                            }
                        }
                        toastr['success']('Section regenerated!', 'AI Section Builder');
                    } catch (err) {
                        toastr['error'](`Regeneration failed: ${err.message}`, 'AI Section Builder');
                    } finally {
                        regenBtn.disabled = false;
                        regenBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Regenerate with AI';
                    }
                });
            }
        }
    }, 100);

    const confirmed = await Popup.show.confirm(
        titleMap[mode] || '📝 Section Editor',
        editorHtml,
        { okButton: mode === 'edit' ? 'Save Changes' : 'Save Section', cancelButton: 'Cancel', ...GS_POPUP_LARGE }
    );
    if (!confirmed) return null;

    let finalContent = currentContent.trim();
    if (!finalContent) {
        toastr['warning']('Section content cannot be empty.', 'Section Builder');
        return null;
    }
    let finalTag = currentTag.trim().replace(/[^\w_-]/g, '');

    // Robust check to see if content is already wrapped in a root XML tag
    const outerTagRegex = /^<(\w+[\w_-]*)(?:\s+[^>]*)*>([\s\S]*)<\/\1>$/;
    const tagMatch = finalContent.match(outerTagRegex);

    if (tagMatch) {
        const contentTag = tagMatch[1];
        const innerContent = tagMatch[2].trim();

        // If Tag Name field was empty, adopt the tag from the XML content
        if (!finalTag) {
            finalTag = contentTag;
        }

        // Always wrap with finalTag to ensure consistency and prevent mismatch/double-tagging
        finalContent = `<${finalTag}>\n${innerContent}\n</${finalTag}>`;
    } else {
        // Content is not wrapped in XML tags, or has mismatched/multiple sibling tags
        if (!finalTag) {
            finalTag = 'custom_section';
        }
        finalContent = `<${finalTag}>\n${finalContent}\n</${finalTag}>`;
    }

    return {
        tag: finalTag,
        description: currentDesc.trim(),
        content: finalContent,
        saveMode: currentSaveMode,
    };
}

// ─────────────────────────────────────────────────────────────────────────
// Advanced tools (moved from index.js): AI/Manual single-section builders,
// used by the System Prompt Control Room toolbar. Their raw library-list
// popup was absorbed into the Control Room itself.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Removes all plain AI/manually-added custom sections (leaving Game System
 * Wizard bundles and Unlocked Base Sections untouched) and resets the
 * section order so it re-seeds from scratch on next build.
 */
export async function resetSyspromptLibrary(options = {}) {
    const { deferPersistence = false } = options;
    if (!confirm('This will remove all AI-generated / manually-added custom sections (Game Systems and Unlocked Sections are left untouched) and restore the default section order. Proceed?')) return;
    const settings = getSettings();
    settings.customSyspromptLibrary = (settings.customSyspromptLibrary || []).filter(p => p.origin === 'unlocked_base' || p.origin === 'wizard');
    settings.syspromptSectionOrder = [];
    await persistSyspromptChanges(deferPersistence);
    if (!deferPersistence) {
        toastr['success']('Custom sections cleared & section order reset to defaults! 🔄', 'System Prompt Control Room');
    }
}

export async function runAiSectionBuilder(options = {}) {
    const { deferPersistence = false } = options;
    const settings = getSettings();

    const buildAiPrompt = (desc) =>
        `You are a D&D system prompt architect. The user wants a new section added to their existing system prompt.\n\nTheir description: "${desc}"\n\nThe user's current system prompt is provided below for reference so you can seamlessly integrate the new mechanic without duplicating existing rules:\n<current_prompt>\n${document.getElementById('main_prompt_quick_edit_textarea')?.value || settings.systemPromptTemplate || ''}\n</current_prompt>\n\nCreate a new XML-tagged section. Your response MUST:\n1. Start with <tag_name> and end with </tag_name>\n2. Use a unique, descriptive tag name in snake_case (e.g. <reputation_system>, <corruption>, <weather_mechanics>)\n3. Be written in SECOND PERSON (you/your) — direct instructions to the Narrator. Never "The GM must" or third-person references.\n4. Be comprehensive but concise (10-30 lines)\n5. Include specific mechanical rules, not just flavor text\n6. Reference {{user}} for the player character\n\nReturn ONLY the XML section. No explanation, no other text.`;

    const generateSection = async (desc) => {
        const { raw: result, names } = await sendWizardStateRequest(settings, 'You are a D&D system prompt section generator. Return ONLY the XML section.', buildAiPrompt(desc));
        if (!result) throw new Error('No response from AI');
        let section = result.trim();
        const fenceMatch = section.match(/```(?:xml)?\s*([\s\S]*?)```/);
        if (fenceMatch) section = fenceMatch[1].trim();
        if (!section.match(/^<\w+[\w_-]*>/)) throw new Error('AI did not return a valid XML section');
        return sanitizeWizardMacroContent(section, names);
    };

    // Step 1: get description
    const { Popup } = SillyTavern.getContext();
    const inputContent = `
        <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box;">
            <div style="font-size:13px; opacity:0.9; font-weight:bold;">✨ AI Section Builder</div>
            <div style="font-size:11px; opacity:0.7; line-height:1.4;">
                Describe a new system, mechanic, or rule you want added to your D&amp;D system prompt. The AI will generate a properly formatted XML section ready to be appended.
            </div>
            <textarea id="rt_ai_section_desc" rows="4" class="text_pole"
                style="font-size:12px; resize:vertical; width:100%;"
                placeholder="Example: A reputation system where NPCs in different factions track the player's standing."></textarea>
        </div>
    `;

    let description = '';
    setTimeout(() => {
        const ta = document.getElementById('rt_ai_section_desc');
        if (ta) ta.addEventListener('input', () => { description = ta.value.trim(); });
    }, 100);

    const inputResult = await Popup.show.confirm('✨ AI Section Builder', inputContent, { okButton: 'Generate', cancelButton: 'Cancel', wide: true, large: true });
    if (!inputResult) return;

    if (!description) {
        toastr['warning']('Please describe the mechanic/system you want.', 'AI Section Builder');
        return;
    }

    // Step 2: generate
    toastr['info']('Generating section with AI...', 'AI Section Builder', { timeOut: 3000 });
    try {
        const section = await generateSection(description);
        const extractedTag = section.match(/^<(\w+[\w_-]*)/)?.[1] || '';

        // Step 3: show unified editor (ai mode)
        const result = await showSectionEditor({
            mode: 'ai',
            tag: extractedTag,
            description,
            content: section,
            onRegenerate: generateSection,
        });
        if (!result) {
            toastr['info']('Section builder cancelled.', 'AI Section Builder');
            return;
        }

        const newItem = {
            id: Date.now().toString(),
            tag: result.tag,
            content: result.content,
            enabled: result.saveMode === 'apply',
            icon: 'fa-wand-magic-sparkles',
            description: result.description || description,
        };

        settings.customSyspromptLibrary = settings.customSyspromptLibrary || [];
        settings.customSyspromptLibrary.push(newItem);
        await persistSyspromptChanges(deferPersistence);

        if (!deferPersistence) {
            if (result.saveMode === 'apply') {
                toastr['success']('Saved to Library & Applied to Sysprompt! \u2705', 'AI Section Builder');
            } else {
                toastr['success']('Saved to Library! \u2705', 'AI Section Builder');
            }
        }
    } catch (err) {
        console.error('[RPG Tracker] AI Section Builder error:', err);
        toastr['error'](`Failed to generate section: ${err.message}`, 'AI Section Builder');
    }
}

export async function runManualSectionBuilder(options = {}) {
    const { deferPersistence = false } = options;
    const settings = getSettings();
    const result = await showSectionEditor({ mode: 'manual' });
    if (!result) return;

    const newItem = {
        id: Date.now().toString(),
        tag: result.tag,
        content: result.content,
        enabled: result.saveMode === 'apply',
        icon: 'fa-pen-to-square',
        description: result.description || 'Custom Section',
    };

    settings.customSyspromptLibrary = settings.customSyspromptLibrary || [];
    settings.customSyspromptLibrary.push(newItem);
    await persistSyspromptChanges(deferPersistence);

    if (!deferPersistence) {
        if (result.saveMode === 'apply') {
            toastr['success']('Saved to Library & Applied to Sysprompt! \u2705', 'Section Builder');
        } else {
            toastr['success']('Saved to Library! \u2705', 'Section Builder');
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Game System Wizard — single AI call, tag-based schema (no JSON, no tool calls)
// ─────────────────────────────────────────────────────────────────────────

function buildWizardSystemPrompt() {
    const renderingHints = RENDERING_TAGS_LIBRARY.join('\n  - ');
    return `You are a game-system architect for a D&D-style tabletop RPG framework. The user will describe ONE mechanic/system in plain language (e.g. "radiation zones", "a faction reputation system", "hunger and thirst", "a farming sim with crop growth", "a construction skill with build projects"). You must design BOTH halves of it and return ONLY the tags below — no explanation, no markdown fences, no other text.

═══════════════════════════════════════════════════════════════════════════
COMPOUND VS. SINGLE METERS
═══════════════════════════════════════════════════════════════════════════
If the user's description involves multiple distinct or orthogonal attributes (such as "hunger and thirst", "sanity and stress", or "shields and hull"), DO NOT merge them into a single muddy/generic meter (like combining hunger and thirst into "Survival"). Instead, track them as separate fields/bars inside the single <tracker_module> output block.
For compound systems:
- Define distinct sub-values (e.g., Hunger and Thirst) within the instructions.
- Give each sub-value its own passive decay rate (if applicable) and its own threshold tiers.
- In the sample block, output each sub-value as its own line (e.g. - Hunger: ... \n - Thirst: ...).
- Make sure the GM section instructs the Narrator to emit distinct delta annotations for each if using gm_annotation using natural language (e.g., *(Food consumed: Chocolate Bar. +75 Hunger)* or *(Water drank: Canteen. +150 Thirst)*), rather than utilizing ugly backend/variable-style strings. Instruct the Narrator to describe restorative actions clearly (and optionally state approximate recovery amounts) if using time/stated_fact drivers — the tracker applies stated numbers or common sense, and must not duplicate a magnitude table.

═══════════════════════════════════════════════════════════════════════════
SCALED MAGNITUDES — GM owns the guide; tracker does NOT duplicate it
═══════════════════════════════════════════════════════════════════════════
When items/actions restore or nudge a meter (eating, drinking, resting, etc.):
- The magnitude guide lives ONLY in <gm_section>. It is a ROUGH ballpark for the Narrator — primarily instruct common sense based on portion, quality, and context. Optional Minor / Moderate / Major examples with approximate numbers are fine as orientation, but MUST NOT be framed as a rigid lookup table the Narrator must match exactly.
- <tracker_module> must NOT restate that magnitude table. For recovery events, instruct the tracker to: scan the latest narrative output for the relevant action, apply any stated numeric change, and if no number is given use common sense based on the portion described and the meter scale.
- For gm_annotation deltas, the Narrator still emits explicit +N in the annotation; the tracker's job is still "apply the stated delta only" — do not also paste a Minor/Moderate/Major table into the tracker.

═══════════════════════════════════════════════════════════════════════════
PILLS HYGIENE
═══════════════════════════════════════════════════════════════════════════
For comma-separated lists of pills (like ((PILLS)) or ((PILLRED))), place the tag ONLY at the very beginning of the list/line (e.g., 'Status: ((PILLS)) Sleeping, Poisoned'). NEVER repeat the tag on every item in the list (e.g., NEVER write '((PILLS)) Sleeping, ((PILLS)) Poisoned').

═══════════════════════════════════════════════════════════════════════════
DRIVERS — how the tracked value actually changes each turn
═══════════════════════════════════════════════════════════════════════════
There are two separate AI agents: you (the Narrator/GM) see the FULL ongoing conversation; the State Tracker sees ONLY the latest narrative output, but it IS given the current and prior [TIME] values every turn (this framework already computes a [TIME] delta for buff/debuff decay — reuse that exact mechanism here). A mechanic's value can be driven by ONE OR MORE of three independent drivers. Pick whichever combination actually fits — most mechanics need exactly one, don't force everything into a single mold:

⚠ PLACEHOLDER NOTICE: everywhere below you see the literal placeholder text YOUR_TAG (e.g. in *(YOUR_TAG: Target +N — reason)* or [YOUR_TAG]), that is NOT literal output text — it stands for whatever UPPER_SNAKE_CASE tag you pick for <tracker_module tag="...">. Replace every occurrence of YOUR_TAG with that exact same tag in both halves. Example: if you choose tag="REPUTATION", write *(REPUTATION: Target +N — reason)* and [REPUTATION], never the literal word YOUR_TAG or TAG.

DRIVER "time" — the value passively drifts every turn based on elapsed [TIME] minutes (a rate × minutes-elapsed formula), completely independent of narrative judgment. Use for anything that accrues/decays passively with the passage of in-world time: hunger, thirst, fatigue, torch fuel, prolonged environmental exposure.
  → ⚠ ALWAYS STATE THE RATE AS A DIRECT WHOLE NUMBER "PER MINUTE" — NEVER "per 60 minutes" / "per hour": phrasing like "50 units per 60 minutes" forces the tracker to silently divide by 60 before it can even start multiplying (Delta/60 × 50) — an unnecessary extra arithmetic step that adds failure surface for no benefit, since "50 per 60 minutes" and "0.83 per minute" are the exact same rate. Skip the detour: pick the max value and the per-minute rate together as a single clean whole number, then derive time-to-empty from THAT (rate × minutes = max), not the other way around. Worked example: want a full drain to take roughly a long driving session? Pick "1 unit per minute" directly against a max of 1000 → drains in 1000 minutes (~16.7 hours); need it faster, pick "3 units per minute" against the same max 1000 → drains in ~5.6 hours. The formula the tracker executes is then just "rate × Delta" — one multiplication, zero division, zero hidden fractions.
  → ⚠ AVOID THE "STUCK AT FULL" BUG: the tracker has no hidden memory — the ONLY thing that persists between turns is the literal number written in the PRIOR state memo's [YOUR_TAG] block. There is no invisible decimal accumulator. Because you already picked a whole-number-per-minute rate (per the rule above), this bug shouldn't occur — but as a sanity check, if your chosen per-minute rate rounds to less than 1 (e.g. you picked a rate under 1/min), even a handful of in-game minutes per turn will produce a delta the tracker rounds to 0 turn after turn, and the value will appear permanently frozen. FIX: raise the per-minute rate to at least 1, and scale the max value up to match if you want the same overall pacing (e.g. rate 1/min against max 1000 instead of rate 1/min against max 100). Thresholds/tiers scale proportionally with whatever max you land on.
  → gm_section: a short blurb that the system exists, an explicit "do not narrate/invent the passive drain yourself" line, PLUS a ROUGH common-sense magnitude guide for restorative items/actions (eating, drinking, resting, etc.) — ballpark examples only, not a rigid table (see SCALED MAGNITUDES). Prefer describing portions naturally; optional approximate recovery amounts are fine when they help clarity.
  → tracker_module computes the base tick from the [TIME] delta every turn (same convention this framework already uses for buff/debuff decay: "calculate the delta between the current [TIME] and the [TIME] in the PRIOR MEMO"), THEN scans the latest narrative output for restorative actions and applies any stated numeric change — if no number is given, use common sense based on the portion described and the meter scale. Do NOT paste a Minor/Moderate/Major offset table into the tracker. If compound, apply recovery to the correct sub-value. No annotation format is required for this driver.
  → ⚠ DO NOT LET THE NARRATOR NARRATE THE DRAIN ITSELF: passive time-based ticking is silent, invisible arithmetic done entirely by the tracker behind the scenes — it is NOT something that happens "on screen". gm_section must explicitly forbid inventing or describing the numeric drain/decay ("your battery has lost 15% while driving", "you've burned through more fuel than expected") — the Narrator has no way to know the real number and will hallucinate one if not told otherwise. gm_section must instead say, explicitly: do not output or imply specific numeric changes to this meter yourself; a background system computes it; only narrate the vehicle/character's condition based on whatever tier the state memo currently reports.
  → ⚠ KEEP THE FORMULA TO ONE SINGLE RATE — NEVER A MULTI-TERM EQUATION: the tracker is an LLM re-deriving the answer from scratch in plain text every single turn, not a calculator running compiled code — it has no persistent variables, so it cannot reliably juggle several named sub-rates combined algebraically (e.g. "(50 Solar Rate − 20 Engine Rate) × (TimeDelta / 60)" is exactly the kind of thing that silently produces wrong or inconsistent numbers turn after turn). There must be exactly ONE base rate per minute. If a condition changes how fast the value moves (e.g. "drains faster while an event is active", "recovers instead of draining if X"), express it as a plain-language CONDITIONAL OVERRIDE of that same single rate — not as an extra term added into one combined formula. Correct pattern: "Drains at 5 units per minute of elapsed [TIME]. EXCEPTION: while a solar recharge event is active (per the annotation below), it instead GAINS 10 units per minute for that period." Wrong pattern: naming two or more opposing rates (solar rate, engine rate, drain rate, recovery rate, etc.) and asking the tracker to combine them in one arithmetic expression each turn.

DRIVER "gm_annotation" — the value can ONLY change via a judgment call that requires broader story context the single-turn tracker doesn't have: faction alignment, cumulative trust, "how big a deal was this compared to everything else". Use for faction reputation, trust/loyalty, corruption from moral choices, sanity from cumulative horror.
  → gm_section must NOT jump straight to a bare trigger phrase like "only annotate when you judge something significant happened" — that is meaningless without first establishing what "significant" means for THIS specific mechanic. Structure it in two parts: (1) first name and define the actual category of qualifying event in concrete, mechanic-specific terms — what it looks like in the story, roughly how often it plausibly comes up, 1-2 concrete examples (e.g. for a reputation system: "Faction Standing Shifts: when {{user}} performs an action a faction would visibly notice and care about — completing a quest for them, publicly opposing their rivals, breaking a promise to their leader"); (2) only then give the mechanical trigger: emit an inline delta annotation right after that defined moment. The annotation format must read like natural language, NOT like a backend debug/variable string. For example, instead of *(YOUR_TAG_SUB: +N)*, write it like *(Category: Event. +N Metric)* (e.g. *(Friendship: Marcus +10 — saved his life)*, *(Food eaten: Chocolate Bar. +75 Hunger)*, *(Reputation shift: completion of quest. +50 Standing)*). Provide a ROUGH magnitude guide in gm_section only (common sense first; ballpark Minor/Moderate/Major examples optional) and an explicit "do NOT annotate for" list of routine/borderline cases that do NOT qualify.
  → tracker_module scans the latest narrative output for that exact annotation pattern and applies ONLY the stated delta(s). Never invents its own and never duplicates the GM magnitude table.

DRIVER "stated_fact" — the tracker reads an objective number directly out of the plain narrative prose each turn, with zero judgment and no annotation convention needed — e.g. "{{user}} takes 12 damage", "the wound deepens by another inch". Use when the fact is already unambiguous in ordinary narration (numbers that already appear organically, e.g. from a combat mechanic).
  → gm_section needs no special instruction beyond narrating naturally.
  → tracker_module parses the latest narrative output directly for the stated number and applies it.

COMBINING DRIVERS: a mechanic MAY use more than one at once — e.g. radiation exposure could tick from "time" while standing in a hazard zone, AND allow a one-off "gm_annotation" jolt for a distinct narrative event (touching an artifact). Only enable the drivers that are actually needed.

WHICH TO PICK: does the value drift purely from the passage of time? → "time". Does it change only when you judge a scene matters, using context a single turn can't provide? → "gm_annotation". Is the exact number already stated plainly in ordinary narration? → "stated_fact". Don't default to a "safe" fallback — reason about the actual mechanic.

Independently of drivers, also set effect_owner (who narrates what happens once a threshold is crossed):
  effect_owner="tracker" (default) — the tracker owns the threshold table, reports the active tier/effect in its own output; you (the Narrator) treat that as absolute law and react to it next turn (one turn of lag is fine).
  effect_owner="gm" — only when an immediate, same-turn reaction is required (e.g. instant death); the gm_section then owns the threshold/effect logic itself.

═══════════════════════════════════════════════════════════════════════════
VOICE & PERSON — mandatory in generated section content
═══════════════════════════════════════════════════════════════════════════
<gm_section> inner content is read directly by the Narrator model. Write it in SECOND PERSON — but "you/your" means ONLY the Narrator receiving an imperative instruction, NEVER the player character or their possessions:
  ✓ "You track…", "When you narrate…", "You do not output numeric changes yourself…" (imperative → addressed to the Narrator)
  ✓ Refer to the player character and anything they own/experience as "{{user}}" / "{{user}}'s" — e.g. "{{user}}'s vehicle battery", "{{user}}'s hydration level" — NEVER "your battery" or "your hydration".
  ✗ NEVER third person for the Narrator: "The GM must…", "The GM evaluates…", "The GM should…"
  ✗ NEVER blur the two by writing "your" to mean the player's stuff — "Your battery naturally depletes as you travel" is broken: it reads as the Narrator's own battery. Write "{{user}}'s vehicle battery naturally depletes as {{user}} travels" instead (imperative "you" is reserved for telling the Narrator what to DO, not for describing what belongs to the character).

<tracker_module> inner content is read directly by the State Tracker model — write it in SECOND PERSON, as direct instructions to that model (same imperative style as gm_section, but addressed to the tracker, not the Narrator):
  ✓ "You maintain…", "You scan the latest narrative output for…", "Apply the delta to the current total…", "Clamp the value between…"
  ✗ NEVER third person referring to the tracker as some external entity: "The tracker maintains…", "The tracker scans…", "The State Tracker must…", "This module updates…"
  ✗ NEVER "GM's output", "GM's most recent output", "the GM's narration", or any "GM" possessive when describing what to scan/parse — say "narrative output" / "the latest narrative output" instead.
  ✓ When referring to the player character, use {{user}} / {{user}}'s — not "your" meaning the player's possessions (the tracker's "you" is the tracker itself, not {{user}}).

═══════════════════════════════════════════════════════════════════════════
NO REDUNDANT ACCOUNTING — gm_section vs tracker_module must not overlap
═══════════════════════════════════════════════════════════════════════════
When a <tracker_module> exists, the two halves have strictly separate jobs. NEVER duplicate tracker work inside <gm_section>.

<gm_section> — you (Narrator) ONLY:
  • For driver "time": a short blurb the system exists + a ROUGH common-sense magnitude guide for restorative actions (gm_section only — not duplicated in the tracker) + an explicit "do not narrate/invent the passive drain yourself" line. No running-total tracking.
  • For driver "gm_annotation": first define the qualifying event category in concrete terms, THEN emit DELTAS ONLY via inline annotations — placed right after the triggering moment. NOT prose accounting like "{{user}}'s reputation increases by 5" or "you now have 47 standing".
  • For driver "stated_fact": narrate naturally; the number just needs to appear plainly in your prose.
  • Narrate flavor and NPC reactions. If effect_owner="tracker", read the standing/tier from the [YOUR_TAG] block in the state memo and treat it as absolute law — react to it, do NOT recompute it.

<gm_section> — you NEVER (these belong exclusively to the tracker):
  ✗ Track, maintain, or restate running totals or current scores ("{{user}}'s reputation is now X", "keep scores visible in your summary").
  ✗ Reference [YOUR_TAG] or the tracker module as something you "use to update" or "manage" standing — you emit deltas/narrate; the tracker does all math.
  ✗ Own threshold tables, bar values, or tier labels when effect_owner="tracker" — the tracker reports those in the state memo each turn.
  ✗ Perform parallel bookkeeping that duplicates what the tracker module will do.
  ✗ Narrate, hint at, or invent specific numeric amounts for a passively time-ticking ("time" driver) value — that math happens silently in the tracker; you only ever react to the tier it reports.

<tracker_module> — EXCLUSIVELY owns:
  • Running totals, bars, clamping, per-target ledgers.
  • Threshold tables and current tier/standing labels — the TABLE itself lives in your prose instructions as a lookup reference; only the single RESOLVED label for the current value gets output in the [YOUR_TAG] block each turn.
  • Applying whichever driver(s) are active: [TIME]-delta ticking + recovery from narrative ("time" — apply stated change, else common sense; NEVER a duplicated Minor/Moderate/Major table), scanning for delta annotations ("gm_annotation"), and/or parsing stated facts ("stated_fact").

═══════════════════════════════════════════════════════════════════════════
⚠ DO NOT LEAK THE THRESHOLD TABLE INTO THE OUTPUT BLOCK
═══════════════════════════════════════════════════════════════════════════
A threshold/tier table (e.g. "800-1000: Optimal, 400-799: Standard, 100-399: Critical, 0-99: Dead") is REFERENCE MATERIAL that teaches the tracker how to resolve a status label from the current number — it is instructional prose, written OUTSIDE the sample block. It must NEVER be copy-pasted verbatim as literal content inside the sample [YOUR_TAG] ... [/YOUR_TAG] block, because that block IS what gets shown to the user every turn — dumping the whole table there would mean the player sees a static rulebook instead of their actual status.
The sample block must contain ONLY the exact fields that really appear in per-turn output: typically one bar/value line plus ONE resolved status/tier line (e.g. "Status: ((PILL)) Standard") — never the full table, and never a placeholder word that isn't even one of your defined tier names (e.g. "Operational") or a static value disconnected from the sample number shown. The status label in your sample MUST be the CORRECT tier for the sample value you chose (e.g. if your sample bar reads 500/1000 and your table says 400-799 = Standard, the sample Status line must say "Standard", not something else).

═══════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT (exact)
═══════════════════════════════════════════════════════════════════════════
<meta name="Short Display Name" icon="a single emoji" needs_tracker="true or false" driver_time="true or false" driver_gm_annotation="true or false" driver_stated_fact="true or false" effect_owner="tracker or gm"/>
<gm_section tag="snake_case_tag">
...Second-person Narrator instructions (you/your = imperatives to the Narrator only) tailored to whichever driver(s) are active (see above); zero accounting overlap with the tracker; if driver_time="true" include a ROUGH common-sense magnitude guide for restorative actions (gm_section only) AND an explicit "do not narrate the drain yourself" line; if driver_gm_annotation="true" first define the qualifying event category before the trigger format. Refer to the player character and their possessions as {{user}} / {{user}}'s — never "your <possession>".
</gm_section>
<tracker_module tag="UPPERCASE_TAG" label="Display Label" icon="a single emoji">
...Instructions for the State Tracker (second person — "You maintain…", never "The tracker maintains…"): owns ALL totals, bars, thresholds, and tier reporting. If driver_time="true": state the max value, rate formula, and the [TIME]-delta calculation method (same convention as this framework's buff/debuff decay); for recovery, scan narrative for the action and apply the stated change — if no number is given, use common sense (do NOT restate the GM magnitude table). If driver_gm_annotation="true": the exact annotation format to scan narrative output for. If driver_stated_fact="true": what plain-language fact to parse from narrative output. State the threshold/tier table as prose (outside the sample block — see warning above). Then include a sample [UPPERCASE_TAG] ... [/UPPERCASE_TAG] format block — bar/value line(s) plus ONE resolved status line only, no raw table — using rendering markers like:
  - ${renderingHints}
</tracker_module>

RULES:
1. Only include a <tracker_module> block if the mechanic needs persistent numeric/state tracking across turns. Purely narrative rules (no persistent state) should set needs_tracker="false" and OMIT the <tracker_module> block entirely, with all driver_* attrs "false".
2. Enable exactly the driver(s) actually needed — don't enable "gm_annotation" for something that's really just time-based decay, and vice versa.
3. Keep the <gm_section> comprehensive but concise (10-30 lines), always second person, zero accounting overlap with the tracker. Keep the <tracker_module> comprehensive but concise (10-30 lines), also second person (addressing the tracker directly — never "the tracker maintains…"). Keep the <tracker_module> as the sole owner of totals/tiers/bars; never use "GM" when naming the text it scans/parses — use "narrative output".
4. Tag values must be short, unique: snake_case for <gm_section tag="...">, UPPER_SNAKE_CASE for <tracker_module tag="...">. Avoid colliding with the existing tags listed below.
5. Double-check before returning: neither <gm_section> nor <tracker_module> may contain the literal placeholder text "YOUR_TAG" or a bare standalone "TAG" — every annotation format and [BRACKET] reference must use the actual tag you chose (matching <tracker_module tag="...">).
6. If driver_time="true", double-check the rate is stated as a direct whole "X per minute" number (never "per 60 minutes" / "per hour") and is at least 1 — if it's phrased per-hour or rounds under 1/min, fix it (see the "PER MINUTE" and "STUCK AT FULL" warnings above).
7. If driver_gm_annotation="true", double-check the gm_section actually DEFINES the qualifying event category in concrete terms before giving the annotation trigger/format — a bare "only annotate when significant" with no definition of what counts is not acceptable.
8. If driver_time="true", double-check gm_section contains an explicit line telling the Narrator NOT to narrate/invent the numeric drain itself — only to react to the reported tier.
9. Double-check the sample [UPPERCASE_TAG] block does NOT contain the threshold table itself, and that its status line is the tier that actually matches the sample value shown (see warning above).
10. Never write "your <player possession>" (e.g. "your battery", "your hunger") in <gm_section> — always "{{user}}'s <possession>". Reserve bare "you/your" strictly for imperative instructions to the Narrator.
11. If driver_time="true", double-check the formula is exactly ONE rate × minutes-elapsed, with at most a plain-language conditional override — never two or more named sub-rates combined in one algebraic expression (see "ONE SINGLE RATE" warning above).
12. Double-check <tracker_module> inner content is second person (you/your) addressing the tracker directly — never third person ("The tracker maintains…", "The State Tracker must…").
13. If the requested mechanic contains multiple distinct concepts (e.g., hunger and thirst), double-check that you have tracked them as separate bars/fields (e.g., Hunger and Thirst) within the single module block rather than combining them into a single muddy meter. Provide separate decay rates and tiers for each.
14. Double-check magnitude guidance for restorative actions lives ONLY in <gm_section> as a rough common-sense guide — NEVER duplicate a Minor/Moderate/Major offset table inside <tracker_module>. Tracker recovery = apply stated change, else common sense.
15. CRITICAL {{user}} MACRO RULE: {{user}} is a SillyTavern runtime macro — it resolves to whoever the player is when the chat runs. NEVER hardcode the current player's persona name or any example proper name (e.g. "Adam", "Dave") in gm_section or tracker_module output. Always write the literal token {{user}} and {{user}}'s for possessives. Hardcoded names break when the player switches personas.`;
}

/** Shared Sustenance tracker_module body (decay + soft recovery + tiers); effect-owner split is in gm_section + meta. */
function buildWizardSustenanceTrackerModuleBody() {
    return `You maintain Hunger and Thirst as two independent values, 0-1000 each.

Decay: each turn, calculate the delta in minutes between the current [TIME] and the [TIME] in the PRIOR MEMO. Hunger drops 1 unit per minute of that delta; Thirst drops 2 units per minute. Clamp both 0-1000.

Recovery: scan the latest narrative output for {{user}} eating or drinking, and apply the stated change. If no number is given, use common sense based on the portion described and the 0-1000 meter totals. Do not use a fixed Minor/Moderate/Major lookup table.

Hunger tiers: 800-1000 Satiated, 500-799 Fed, 200-499 Peckish, 1-199 Famished, 0 Starving.
Thirst tiers: 800-1000 Hydrated, 500-799 Quenched, 200-499 Thirsty, 1-199 Parched, 0 Dehydrated.`;
}

/** Rough GM-only magnitude guide for Sustenance examples (not a rigid table). */
function buildWizardSustenanceGmRecoveryGuide() {
    return `When {{user}} eats or drinks, narrate the action naturally and use common sense for how much it helps based on portion, quality, and context. The scale below is only a rough ballpark — not a rigid lookup table; adjust freely:
- Minor (snack, jerky, quick sip): around +75
- Moderate (rations, stew, full waterskin draft): around +200
- Major (feast, banquet, long drink from a stream/cask): around +450
Prefer stating an approximate recovery amount when it helps clarity; otherwise describe the meal or drink vividly enough to judge.`;
}

/** @returns {string} Sustenance example with effect_owner="tracker". */
function buildWizardSustenanceExampleTracker() {
    return `<meta name="Sustenance" icon="🍖" needs_tracker="true" driver_time="true" driver_gm_annotation="false" driver_stated_fact="false" effect_owner="tracker"/>
<gm_section tag="sustenance">
You read {{user}}'s current Hunger and Thirst tier directly from the STATE MEMO's [SUSTENANCE] block each turn — that reported tier is absolute law; you never recompute or second-guess it, only react to it one turn behind if needed.

A background system silently ticks both meters down with elapsed time. You do NOT narrate, hint at, or invent the numeric drain yourself — no "{{user}}'s stomach loses 15 hunger" lines. Only narrate condition based on whichever tier the STATE MEMO currently shows.

${buildWizardSustenanceGmRecoveryGuide()}
</gm_section>
<tracker_module tag="SUSTENANCE" label="Sustenance" icon="🍖">
${buildWizardSustenanceTrackerModuleBody()}
(Tiers 500+ have no mechanical effect; 200-499 is minor discomfort; 1-199 imposes disadvantage on physical checks/CON saves; 0 is critical, exhaustion accrues.)

Output every turn:
[SUSTENANCE]
- Hunger: ((BARYELLOW)) 650/1000 (Fed)
- Thirst: ((BARBLUE)) 350/1000 (Thirsty)
Status: ((PILLS)) Fed, ((WARNING)) Thirsty
[/SUSTENANCE]
</tracker_module>`;
}

/** @returns {string} Sustenance example with effect_owner="gm". */
function buildWizardSustenanceExampleGm() {
    return `<meta name="Sustenance" icon="🍖" needs_tracker="true" driver_time="true" driver_gm_annotation="false" driver_stated_fact="false" effect_owner="gm"/>
<gm_section tag="sustenance">
You read {{user}}'s current Hunger and Thirst values from the STATE MEMO's [SUSTENANCE] block each turn. You own the threshold table and mechanical consequences below — when the reported values place {{user}} in a tier with a mechanical effect, narrate that consequence in the same turn; do not wait for a future memo update.

Threshold table (you enforce these; the tracker only reports numbers and tier labels):
Hunger: 800-1000 Satiated, 500-799 Fed, 200-499 Peckish, 1-199 Famished, 0 Starving.
Thirst: 800-1000 Hydrated, 500-799 Quenched, 200-499 Thirsty, 1-199 Parched, 0 Dehydrated.
Mechanical effects you apply same-turn when {{user}} is in the tier:
- 500+: no mechanical effect beyond flavor.
- 200-499 (Peckish/Thirsty): subtle discomfort in narration.
- 1-199 (Famished/Parched): {{user}} has disadvantage on physical checks and CON saves until recovered.
- 0 (Starving/Dehydrated): {{user}} is barely functional; exhaustion accrues until fed/hydrated.

A background system silently ticks both meters down with elapsed time. You do NOT narrate, hint at, or invent the numeric drain yourself — no "{{user}}'s stomach loses 15 hunger" lines.

${buildWizardSustenanceGmRecoveryGuide()}
</gm_section>
<tracker_module tag="SUSTENANCE" label="Sustenance" icon="🍖">
${buildWizardSustenanceTrackerModuleBody()}
Resolve tier labels from the current values for display only — do NOT state mechanical effects here; the gm_section owns same-turn threshold consequences.

Output every turn:
[SUSTENANCE]
- Hunger: ((BARYELLOW)) 650/1000 (Fed)
- Thirst: ((BARBLUE)) 350/1000 (Thirsty)
[/SUSTENANCE]
</tracker_module>`;
}

/**
 * Illustrative Sustenance output appended at generation time based on effect_owner.
 * @param {'tracker'|'gm'} [effectOwner]
 */
function buildWizardOutputExample(effectOwner = 'tracker') {
    const mode = effectOwner === 'gm' ? 'gm' : 'tracker';
    const body = mode === 'gm' ? buildWizardSustenanceExampleGm() : buildWizardSustenanceExampleTracker();
    const modeLabel = mode === 'gm'
        ? 'effect_owner="gm" (GM section owns threshold effects; tracker owns numbers/bars only)'
        : 'effect_owner="tracker" (tracker owns threshold effects in the state memo)';
    return `═══════════════════════════════════════════════════════════════════════════
FULL OUTPUT EXAMPLE (illustrative reference only — NOT a default answer)
═══════════════════════════════════════════════════════════════════════════
This example uses ${modeLabel}. Match that effect-owner split in your output. Study structure, second-person voice, driver split, GM-only rough magnitude guide vs tracker "stated change / common sense" recovery, compound sub-meters, and sample-block hygiene. Do NOT return this example verbatim unless the user's request is literally hunger/thirst sustenance — for any other mechanic, invent fresh tags and content following the same patterns.

${body}`;
}

/**
 * Normalizes an object's driver_* / legacy valueAuthority fields into a
 * guaranteed-non-empty { time, gmAnnotation, statedFact } trio. Accepts both
 * the wizard's parsed camelCase fields (driverTime/driverGmAnnotation/driverStatedFact)
 * and old records that only have a single valueAuthority: 'gm'|'tracker'.
 */
function normalizeDrivers(obj) {
    const time = !!obj?.driverTime;
    const gmAnnotation = !!obj?.driverGmAnnotation;
    const statedFact = !!obj?.driverStatedFact;
    if (!time && !gmAnnotation && !statedFact) {
        if (obj?.valueAuthority === 'tracker') return { time: false, gmAnnotation: false, statedFact: true };
        return { time: false, gmAnnotation: true, statedFact: false };
    }
    return { time, gmAnnotation, statedFact };
}

/** Parses one AI (or exported) response into a normalized draft object. */
export function parseWizardResponse(raw, macroNames = []) {
    const metaAttrs = extractSelfClosingTag(raw, 'meta') || {};
    const gm = extractTagBlock(raw, 'gm_section');
    const tracker = extractTagBlock(raw, 'tracker_module');

    if (!gm && !tracker) {
        throw new Error('AI did not return a valid gm_section or tracker_module block');
    }

    const name = metaAttrs.name || gm?.attrs?.tag || tracker?.attrs?.label || tracker?.attrs?.tag || 'Custom System';
    const gmTag = sanitizeSnakeTag(gm?.attrs?.tag || name);
    const trackerTag = sanitizeUpperTag(tracker?.attrs?.tag || name);

    // Back-compat: older wizard output (or hand-written imports) may still use the
    // single value_authority="gm"|"tracker" attribute instead of the three drivers.
    const drivers = normalizeDrivers({
        driverTime: metaAttrs.driver_time === 'true',
        driverGmAnnotation: metaAttrs.driver_gm_annotation === 'true',
        driverStatedFact: metaAttrs.driver_stated_fact === 'true',
        valueAuthority: metaAttrs.value_authority,
    });

    return {
        name,
        icon: metaAttrs.icon || tracker?.attrs?.icon || '✨',
        needsTracker: metaAttrs.needs_tracker !== 'false' && !!tracker,
        driverTime: drivers.time,
        driverGmAnnotation: drivers.gmAnnotation,
        driverStatedFact: drivers.statedFact,
        effectOwner: metaAttrs.effect_owner === 'gm' ? 'gm' : 'tracker',
        includeGm: !!gm,
        gmTag,
        gmContent: gm ? sanitizeWizardMacroContent(normalizeGmContent(gmTag, gm.content), macroNames) : '',
        trackerTag,
        trackerLabel: tracker?.attrs?.label || name,
        trackerIcon: tracker?.attrs?.icon || metaAttrs.icon || '📄',
        trackerContent: tracker ? sanitizeWizardMacroContent(tracker.content, macroNames) : '',
    };
}

/** One combined AI call that drafts both halves of a new game system. */
async function generateGameSystemDraft(settings, description, systemPrompt, effectOwner = 'tracker') {
    const sp = composeWizardArchitectPrompt(systemPrompt || getEffectiveWizardSystemPrompt(settings), effectOwner);
    const userPrompt = `${buildExistingTagsContext(settings)}\n\nDescribe the mechanic:\n${description}`;
    const { raw, names } = await sendWizardStateRequest(settings, sp, userPrompt);
    if (!raw) throw new Error('No response from AI');
    return parseWizardResponse(raw, names);
}

function buildGmAccountingProhibitions(trackerTag) {
    const tag = sanitizeUpperTag(trackerTag);
    return `ACCOUNTING SPLIT (mandatory when a tracker exists): gm_section = narration only, per whichever driver(s) apply below. Never track totals, restate current scores, keep scores visible in summaries, or reference [${tag}] as something you manage/update. Totals, bars, and tier labels belong exclusively in the tracker_module output.`;
}

/** Builds the driver-specific instruction text for whichever combination of drivers is active. */
function describeDrivers(drivers, trackerTag) {
    const tag = sanitizeUpperTag(trackerTag);
    const parts = [];
    if (drivers?.time) {
        parts.push(`DRIVER "time": the value passively drifts each turn from elapsed [TIME] minutes (rate × minutes-elapsed). ⚠ STATE THE RATE AS A DIRECT WHOLE "X per minute" NUMBER — NEVER "per 60 minutes" / "per hour": that phrasing forces an unnecessary Delta/60 division before the tracker can multiply; "50 per 60 minutes" and "0.83 per minute" are identical, but the per-minute form needs one multiplication and zero division. Pick the max value and a clean whole per-minute rate (≥1) together, then time-to-empty falls out as max/rate (e.g. rate 1/min against max 1000 ≈ 16.7 hours; rate 3/min against the same max ≈ 5.6 hours) — never the reverse. gm_section needs a short blurb + a ROUGH common-sense magnitude guide for restorative actions (ballpark only, not a rigid table — see SCALED MAGNITUDES) + an explicit ban on narrating the passive drain. tracker_module must NOT restate that magnitude table; after applying the [TIME] tick, scan narrative for restorative actions and apply the stated change — if no number is given, use common sense based on portion and meter scale. ⚠ AVOID THE "STUCK AT FULL" BUG: there is no hidden decimal memory — only the literal number written in the prior state memo persists; a whole-number-per-minute rate (per the rule above) avoids this by construction. ⚠ gm_section must explicitly tell the Narrator NOT to narrate/invent the numeric drain amount itself ("your battery has lost 15%" is a hallucination — the Narrator has no way to know the real number); it only reacts to whatever tier the state memo currently reports. ⚠ ONE SINGLE RATE ONLY: the tracker re-derives the number from scratch in plain text every turn, not compiled code — it cannot reliably combine several named sub-rates in one algebraic expression (e.g. "(50 Solar Rate − 20 Engine Rate) × (Delta/60)" is exactly this failure mode and produces unreliable numbers). Use exactly ONE base rate per minute; if a condition changes the pace, express it as a plain conditional override of that same rate ("drains at 1/min; EXCEPTION: gains 3/min instead while a recharge event is active"), never as an extra term folded into one combined formula.`);
    }
    if (drivers?.gmAnnotation) {
        parts.push(`DRIVER "gm_annotation": changing this value requires judgment informed by broader narrative context only you (the Narrator) have. gm_section must NOT jump straight to a bare trigger phrase like "only annotate when something meaningfully relevant happened" — first define, in concrete mechanic-specific terms, what actually qualifies (1-2 examples), THEN give the mechanical trigger: emit ONLY delta annotations right after that defined moment: use natural-language style annotations (e.g. *(Category: Event/Detail. +N Metric)* like *(Food eaten: Chocolate Bar. +75 Hunger)*) rather than ugly backend debug or uppercase snake_case variable strings. tracker_module scans the latest narrative output for that exact annotation and applies ONLY the stated delta(s) — never inventing its own.`);
    }
    if (drivers?.statedFact) {
        parts.push(`DRIVER "stated_fact": the driving number is already plainly stated in ordinary narrative prose (e.g. a directly-stated damage number) — no annotation convention needed. tracker_module parses that plain statement directly from the latest narrative output.`);
    }
    if (!parts.length) {
        parts.push(`No specific driver is configured — default to "gm_annotation" behavior (delta annotations) unless the mechanic clearly calls for time-based ticking or a directly stated fact.`);
    }
    return parts.join('\n');
}

function describeEffectOwner(effectOwner, trackerTag) {
    const tag = sanitizeUpperTag(trackerTag);
    if (effectOwner === 'gm') {
        return `EFFECT OWNER = "gm": you (Narrator) own the threshold table for reacting to this value's tiers — state the actual threshold numbers/tiers in your own instructions. When your narration would plausibly cross one, narrate the consequence immediately, in that same turn — do NOT wait for the tracker to confirm it in a future state memo. Reserve this for effects that cannot tolerate a turn of delay (e.g. instant death). The tracker still owns computing/storing the underlying number (per the drivers above); you are only reacting to thresholds in real time, never recomputing the tracked value itself.`;
    }
    return `EFFECT OWNER = "tracker" (default): the tracker owns the threshold table and reports the current tier/effect in its [${tag}] block; you (Narrator) read that reported tier from the state memo and treat it as absolute law for NPC reactions and narration — do not recompute it yourself. A one-turn lag between crossing a threshold and you narrating it is expected and fine.`;
}

function buildDriverGuidance(drivers, gmTag, trackerTag, effectOwner = 'tracker') {
    const voiceRules = `VOICE: gm_section inner text must be second person (you/your) for imperatives to the Narrator ONLY — never "The GM must…", and never "your <possession>" to mean the player character's stuff (e.g. "your battery" is broken — write "{{user}}'s battery" instead; "you/your" is reserved for telling the Narrator what to DO). tracker_module inner text must ALSO be second person (you/your) addressing the State Tracker directly — never third person ("The tracker maintains…", "The State Tracker must…", "This module updates…"); when scanning/parsing, refer to "narrative output" — never "GM's output" or "GM's narration".`;
    const accountingRules = buildGmAccountingProhibitions(trackerTag);
    const outputHygiene = `TRACKER SAMPLE OUTPUT HYGIENE: a threshold/tier table is reference material for the tracker to look up a status label from — it is instructional prose, NOT literal output. Never paste the full table inside the sample [${sanitizeUpperTag(trackerTag)}] ... [/${sanitizeUpperTag(trackerTag)}] block; that block must show only what really appears each turn (a bar/value line + ONE resolved status line), and that status label must be the tier that actually matches the sample value shown — never a placeholder word that isn't one of the defined tiers, and never a static/disconnected label.`;
    const compoundRules = `COMPOUND METERS: If the mechanic contains distinct/orthogonal sub-concepts (like hunger AND thirst, or shields AND armor), do NOT merge them into one muddy meter. Track them as separate fields/bars inside the single <tracker_module> output block. Give each its own decay and thresholds, and show both bars/statuses in the sample block. Restorative magnitude guidance stays in gm_section only; tracker applies stated change or common sense per sub-value. For gm_annotation, instruct natural-language deltas (e.g., *(Food eaten: Chocolate Bar. +75 Hunger)*) rather than ugly variable strings.`;
    const magnitudeRules = `SCALED MAGNITUDES: Restorative item/action guidance lives ONLY in gm_section as a ROUGH common-sense ballpark (optional Minor/Moderate/Major examples with approximate numbers). Do NOT paste that table into tracker_module. Tracker recovery: apply the stated change from narrative; if no number is given, use common sense based on portion and meter scale.`;
    const pillRules = `PILLS HYGIENE: For comma-separated lists of pills (like ((PILLS)) or ((PILLRED))), place the tag ONLY at the very beginning of the list/line (e.g., 'Status: ((PILLS)) Sleeping, Poisoned'). NEVER repeat the tag on every item in the list (e.g., NEVER write '((PILLS)) Sleeping, ((PILLS)) Poisoned').`;
    return `${voiceRules}\n${accountingRules}\n${outputHygiene}\n${compoundRules}\n${magnitudeRules}\n${pillRules}\n${describeDrivers(drivers, trackerTag)}\n${describeEffectOwner(effectOwner, trackerTag)}`;
}


/** Focused regeneration of just the GM half, keeping the tracker half's current text as context. */
async function regenerateGmSection(settings, description, gmTag, drivers, trackerTag = '', effectOwner = 'tracker', systemPrompt) {
    const base = composeWizardArchitectPrompt(systemPrompt || getEffectiveWizardSystemPrompt(settings), effectOwner);
    const systemPromptFull = `${base}\n\n---\n\nCURRENT TASK: Rewrite ONLY the GM-facing section for the mechanic described below. Return ONLY:\n<gm_section tag="${gmTag}">\n...instructions...\n</gm_section>\nNo explanation, no markdown fences, no other text. Reference {{user}} for the player. Be comprehensive but concise (10-30 lines).\n\nCRITICAL: Inner content must be SECOND PERSON (you/your) — direct instructions to the Narrator. Never write "The GM must" or any third-person reference to the narrator.\n\nCRITICAL: gm_section must NEVER track totals, restate current scores, or duplicate tracker accounting.\n\n${buildDriverGuidance(drivers, gmTag, trackerTag, effectOwner)}`;
    const userPrompt = `${buildExistingTagsContext(settings)}\n\nMechanic description:\n${description}`;
    const { raw, names } = await sendWizardStateRequest(settings, systemPromptFull, userPrompt);
    if (!raw) throw new Error('No response from AI');
    const block = extractTagBlock(raw, 'gm_section');
    if (!block) throw new Error('AI did not return a valid gm_section block');
    return sanitizeWizardMacroContent(normalizeGmContent(sanitizeSnakeTag(block.attrs.tag || gmTag), block.content), names);
}

/** Focused regeneration of just the tracker half. */
async function regenerateTrackerModule(settings, description, trackerTag, drivers, effectOwner = 'tracker', systemPrompt) {
    const renderingHints = RENDERING_TAGS_LIBRARY.join('\n  - ');
    const base = composeWizardArchitectPrompt(systemPrompt || getEffectiveWizardSystemPrompt(settings), effectOwner);
    const systemPromptFull = `${base}\n\n---\n\nCURRENT TASK: Rewrite ONLY the tracker module instructions for the mechanic described below. Return ONLY:\n<tracker_module tag="${trackerTag}" label="Display Label" icon="emoji">\n...instructions, including a sample [${trackerTag}] ... [/${trackerTag}] format block using rendering markers like:\n  - ${renderingHints}\n</tracker_module>\nNo explanation, no markdown fences, no other text.\n\nCRITICAL: Inner content must be SECOND PERSON (you/your) — direct instructions to the State Tracker. Never write "The tracker maintains…", "The State Tracker must…", or any third-person reference to the tracker as an external entity.\n\nCRITICAL: This module EXCLUSIVELY owns running totals, bars, threshold tables, and tier labels — the gm_section must never duplicate this. When scanning for inline annotations, say "narrative output" / "the latest narrative output" — NEVER "GM's output" or "GM's narration".\n\n${buildDriverGuidance(drivers, '', trackerTag, effectOwner)}`;
    const userPrompt = `${buildExistingTagsContext(settings)}\n\nMechanic description:\n${description}`;
    const { raw, names } = await sendWizardStateRequest(settings, systemPromptFull, userPrompt);
    if (!raw) throw new Error('No response from AI');
    const block = extractTagBlock(raw, 'tracker_module');
    if (!block) throw new Error('AI did not return a valid tracker_module block');
    block.content = sanitizeWizardMacroContent(block.content, names);
    return block;
}

/**
 * Regenerates BOTH halves together in a single AI call so they stay fully
 * coherent (matching effect-owner treatment, consistent recovery split) — this is the
 * recommended path whenever drivers or effect_owner have just been changed,
 * since regenerating only one half independently can leave the pair in a
 * mismatched state (e.g. one half still written for the old effect owner).
 */
async function regenerateBothHalves(settings, description, gmTag, trackerTag, drivers, effectOwner = 'tracker', systemPrompt) {
    const renderingHints = RENDERING_TAGS_LIBRARY.join('\n  - ');
    const base = composeWizardArchitectPrompt(systemPrompt || getEffectiveWizardSystemPrompt(settings), effectOwner);
    const systemPromptFull = `${base}\n\n---\n\nCURRENT TASK: Rewrite BOTH halves of the mechanic described below so they are fully coherent with each other. Return ONLY:\n<gm_section tag="${gmTag}">\n...instructions...\n</gm_section>\n<tracker_module tag="${trackerTag}" label="Display Label" icon="emoji">\n...instructions, including a sample [${trackerTag}] ... [/${trackerTag}] format block using rendering markers like:\n  - ${renderingHints}\n</tracker_module>\nNo explanation, no markdown fences, no other text. Reference {{user}} for the player. Be comprehensive but concise (10-30 lines each).\n\nCRITICAL: gm_section inner content must be SECOND PERSON (you/your) — never "The GM must". CRITICAL: tracker_module inner content must ALSO be SECOND PERSON (you/your) addressing the State Tracker directly — never "The tracker maintains…". CRITICAL: gm_section must NEVER track totals, restate current scores, or duplicate tracker accounting — the tracker_module EXCLUSIVELY owns totals, bars, thresholds, and tier labels.\n\n${buildDriverGuidance(drivers, gmTag, trackerTag, effectOwner)}\n\nSince both halves are generated together: magnitude/recovery guidance for restorative actions belongs ONLY in gm_section (rough common-sense guide). Tracker recovery must be "apply stated change, else common sense" — NEVER a duplicated Minor/Moderate/Major table. If effect_owner="gm", threshold numbers live in gm_section; the tracker still reports values/labels without restating mechanical effect prose.`;
    const userPrompt = `${buildExistingTagsContext(settings)}\n\nMechanic description:\n${description}`;
    const { raw, names } = await sendWizardStateRequest(settings, systemPromptFull, userPrompt);
    if (!raw) throw new Error('No response from AI');
    const gm = extractTagBlock(raw, 'gm_section');
    const tracker = extractTagBlock(raw, 'tracker_module');
    if (!gm || !tracker) throw new Error('AI did not return both a gm_section and a tracker_module block');
    return {
        gmContent: sanitizeWizardMacroContent(normalizeGmContent(sanitizeSnakeTag(gm.attrs.tag || gmTag), gm.content), names),
        trackerContent: sanitizeWizardMacroContent(tracker.content, names),
        trackerLabel: tracker.attrs.label || '',
        trackerIcon: tracker.attrs.icon || '',
    };
}

/**
 * Revises the current draft in place using user iteration feedback. Keeps tags
 * and driver/effect-owner settings from the preview UI; only rewrites content.
 */
async function iterateGameSystemDraft(settings, {
    description = '',
    iterationFeedback = '',
    gmTag,
    gmContent,
    includeTracker = true,
    trackerTag,
    trackerContent = '',
    trackerLabel = '',
    drivers,
    effectOwner = 'tracker',
    systemPrompt,
}) {
    const renderingHints = RENDERING_TAGS_LIBRARY.join('\n  - ');
    const tag = sanitizeUpperTag(trackerTag);
    const snakeTag = sanitizeSnakeTag(gmTag);

    let outputFormat = `Return ONLY:\n<gm_section tag="${snakeTag}">\n...revised instructions...\n</gm_section>`;
    if (includeTracker) {
        outputFormat += `\n<tracker_module tag="${tag}" label="Display Label" icon="emoji">\n...revised instructions, including a sample [${tag}] ... [/${tag}] format block using rendering markers like:\n  - ${renderingHints}\n</tracker_module>`;
    }

    const base = composeWizardArchitectPrompt(systemPrompt || getEffectiveWizardSystemPrompt(settings), effectOwner);
    const systemPromptFull = `${base}\n\n---\n\nREVISION MODE: The user already has a draft game system and wants specific revisions — NOT a from-scratch rewrite. ${outputFormat}\nNo explanation, no markdown fences, no other text. Reference {{user}} for the player. Be comprehensive but concise (10-30 lines per half).\n\nCRITICAL: gm_section inner content must be SECOND PERSON (you/your) — never "The GM must". CRITICAL: tracker_module inner content must ALSO be SECOND PERSON (you/your) addressing the State Tracker directly — never "The tracker maintains…". CRITICAL: gm_section must NEVER track totals, restate current scores, or duplicate tracker accounting.\n\n${buildDriverGuidance(drivers, snakeTag, tag, effectOwner)}\n\nITERATION RULES:\n- Preserve everything in the current draft that the user did NOT ask to change.\n- Apply the user's feedback precisely. Magnitude/recovery guides belong only in gm_section; tracker recovery stays "stated change, else common sense" — never duplicate a magnitude table into the tracker. If thresholds or annotation formats change, keep the effect-owner split coherent across halves.\n- Do not rename tags unless the user explicitly asks to.\n- Never output the literal placeholder text "YOUR_TAG" or a bare standalone "TAG" — use the actual tracker tag (${tag}).`;

    let currentDraft = `<gm_section tag="${snakeTag}">\n${gmContent}\n</gm_section>`;
    if (includeTracker && trackerContent.trim()) {
        currentDraft += `\n<tracker_module tag="${tag}" label="${trackerLabel || tag}">\n${trackerContent}\n</tracker_module>`;
    }

    const userPrompt = `${buildExistingTagsContext(settings)}

Original mechanic description:
${description || '(not provided)'}

CURRENT DRAFT (revise this — do not discard and restart unless the feedback requires it):
${currentDraft}

User's iteration feedback (apply these changes):
${iterationFeedback}`;

    const { raw, names } = await sendWizardStateRequest(settings, systemPromptFull, userPrompt);
    if (!raw) throw new Error('No response from AI');

    const gm = extractTagBlock(raw, 'gm_section');
    if (!gm) throw new Error('AI did not return a valid gm_section block');

    const result = {
        gmContent: sanitizeWizardMacroContent(normalizeGmContent(sanitizeSnakeTag(gm.attrs.tag || snakeTag), gm.content), names),
        trackerContent: '',
        trackerLabel: '',
        trackerIcon: '',
    };

    if (includeTracker) {
        const tracker = extractTagBlock(raw, 'tracker_module');
        if (!tracker) throw new Error('AI did not return a valid tracker_module block');
        result.trackerContent = sanitizeWizardMacroContent(tracker.content, names);
        result.trackerLabel = tracker.attrs.label || '';
        result.trackerIcon = tracker.attrs.icon || '';
    }

    return result;
}

/** @returns {Promise<string|null>} User's iteration feedback, or null if cancelled. */
async function promptGameSystemIterationFeedback() {
    const { Popup } = SillyTavern.getContext();
    let feedback = '';

    const inputHtml = `
        <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box; text-align:left;">
            <div style="font-size:11px; opacity:0.75; line-height:1.4;">
                Describe what to change, add, or fix. The AI will revise the current draft in place — tags, drivers, and effect owner stay as configured on the review screen.
            </div>
            <textarea id="rt_gs_iterate_feedback" rows="5" class="text_pole"
                style="font-size:12px; resize:vertical; width:100%;"
                placeholder="Example: Remove the GM delta annotations — thirst should only tick from [TIME], not from narrative judgment. Make the GM section a short blurb plus item restore values only."></textarea>
        </div>
    `;

    setTimeout(() => {
        const ta = document.getElementById('rt_gs_iterate_feedback');
        if (ta) {
            const sync = () => { feedback = ta.value.trim(); };
            sync();
            ta.addEventListener('input', sync);
            ta.addEventListener('change', sync);
            ta.focus();
        }
    }, 100);

    const inputResult = await Popup.show.confirm('✨ Iterate with AI', inputHtml, { okButton: 'Apply Changes', cancelButton: 'Cancel' });
    if (!inputResult) return null;
    if (!feedback) {
        const ta = document.getElementById('rt_gs_iterate_feedback');
        feedback = ta?.value?.trim() || '';
    }
    if (!feedback) {
        toastr['warning']('Please describe what you want changed.', 'Game System Wizard');
        return null;
    }
    return feedback;
}

/**
 * Preview/edit popup for a wizard draft. Lets the user tweak name/icon,
 * toggle whether a tracker module is included, choose who owns threshold
 * effects, edit both content blocks, regenerate either half with AI, or
 * iterate on the full draft with natural-language feedback.
 * @returns {Promise<object|null>}
 */
async function showGameSystemPreview(parsed, { description = '', isEdit = false, allowBack = false } = {}) {
    const { Popup } = SillyTavern.getContext();
    const settings = getSettings();

    let state = {
        name: parsed.name,
        icon: parsed.icon,
        includeGm: parsed.includeGm !== false,
        includeTracker: !!parsed.needsTracker,
        driverTime: !!parsed.driverTime,
        driverGmAnnotation: !!parsed.driverGmAnnotation,
        driverStatedFact: !!parsed.driverStatedFact,
        effectOwner: parsed.effectOwner || 'tracker',
        gmTag: parsed.gmTag,
        gmContent: parsed.gmContent,
        trackerTag: parsed.trackerTag,
        trackerLabel: parsed.trackerLabel,
        trackerIcon: parsed.trackerIcon,
        trackerContent: parsed.trackerContent,
    };

    const html = `
        <div id="rt-gs-preview" style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box; text-align:left;">
            <div style="display:flex; gap:8px;">
                <input id="rt-gs-icon" type="text" class="text_pole" value="${escapeHtml(state.icon)}" style="width:44px; text-align:center;" title="Icon (emoji)">
                <input id="rt-gs-name" type="text" class="text_pole" value="${escapeHtml(state.name)}" style="flex:1;" placeholder="System name">
            </div>

            <label class="checkbox_label" style="font-size:12px;">
                <input type="checkbox" id="rt-gs-include-tracker" ${state.includeTracker ? 'checked' : ''}>
                <span>Needs a tracker module (persistent state tracked every turn)</span>
            </label>

            <div id="rt-gs-driver-row" style="display:${state.includeTracker ? 'flex' : 'none'}; flex-direction:column; gap:8px; padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:6px; border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:11px; font-weight:bold; opacity:0.8;">How does the value change? (pick one or more)</div>
                <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; cursor:pointer;">
                    <input type="checkbox" id="rt-gs-driver-time" ${state.driverTime ? 'checked' : ''} style="margin-top:2px;">
                    <span><b>Auto-ticks over time</b> — drifts automatically each turn based on elapsed [TIME] minutes. Use for hunger, thirst, fatigue, torch fuel.</span>
                </label>
                <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; cursor:pointer;">
                    <input type="checkbox" id="rt-gs-driver-gm" ${state.driverGmAnnotation ? 'checked' : ''} style="margin-top:2px;">
                    <span><b>GM declares deltas</b> — needs narrative judgment only the full-context Narrator can make. Use for faction reputation, trust, sanity.</span>
                </label>
                <label style="display:flex; align-items:flex-start; gap:8px; font-size:12px; cursor:pointer;">
                    <input type="checkbox" id="rt-gs-driver-fact" ${state.driverStatedFact ? 'checked' : ''} style="margin-top:2px;">
                    <span><b>Tracker reads a stated fact</b> — the exact number is already plain in the narration each turn (e.g. a stated damage amount).</span>
                </label>
                <div style="font-size:10px; opacity:0.55; line-height:1.3;">Most mechanics need exactly one. Combine only when genuinely mixed (e.g. radiation ticking from exposure time, plus an occasional GM-judged narrative jolt).</div>
            </div>

            <div id="rt-gs-effect-owner-row" style="display:${state.includeTracker ? 'flex' : 'none'}; flex-direction:column; gap:8px; padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:6px; border:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex; align-items:center; gap:14px;">
                    <span style="font-size:11px; font-weight:bold; opacity:0.8; width:110px;">Effect owner:</span>
                    <label style="display:flex; align-items:center; gap:5px; font-size:12px; cursor:pointer;">
                        <input type="radio" name="rt_gs_effect_owner" value="tracker" ${state.effectOwner === 'tracker' ? 'checked' : ''}> Tracker (effects in state memo)
                    </label>
                    <label style="display:flex; align-items:center; gap:5px; font-size:12px; cursor:pointer;">
                        <input type="radio" name="rt_gs_effect_owner" value="gm" ${state.effectOwner === 'gm' ? 'checked' : ''}> GM section (effects in main sysprompt)
                    </label>
                </div>
                <div style="font-size:10px; opacity:0.55; line-height:1.3;">Changing effect owner rewrites which half owns threshold consequences. Use <b>Regenerate Both</b> after switching — the appended Sustenance example updates to match.</div>
            </div>

            <div id="rt-gs-regen-both-row" style="display:${state.includeTracker ? 'flex' : 'none'}; align-items:center; justify-content:space-between; gap:10px; padding:8px 10px; background:rgba(255,180,60,0.08); border:1px solid rgba(255,180,60,0.3); border-radius:6px;">
                <span style="font-size:11px; opacity:0.8; line-height:1.3;">Changed a driver or the effect owner above? Regenerate both halves together so they don't fall out of sync.</span>
                <button id="rt-gs-regen-both" class="menu_button interactable" style="font-size:11px; padding:4px 10px; white-space:nowrap; background:rgba(255,180,60,0.18); border-color:rgba(255,180,60,0.5);" title="Regenerate both the GM section and tracker module together, using the current drivers/effect owner">
                    <i class="fa-solid fa-arrows-rotate"></i> Regenerate Both
                </button>
            </div>

            <div id="rt-gs-iterate-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 10px; background:rgba(180,100,255,0.08); border:1px solid rgba(180,100,255,0.3); border-radius:6px;">
                <span style="font-size:11px; opacity:0.8; line-height:1.3;">Want specific changes? Tell the AI what to fix — it revises the current draft in place.</span>
                <button id="rt-gs-iterate" class="menu_button interactable" style="font-size:11px; padding:4px 10px; white-space:nowrap; background:rgba(180,100,255,0.18); border-color:rgba(180,100,255,0.5);" title="Describe changes and let AI revise the current GM section and tracker module">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Iterate with AI
                </button>
            </div>

            ${buildWizardPromptEditorHtml('rt-gs-wizard-system-prompt', getEffectiveWizardSystemPrompt(settings))}

            <div style="border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:10px; background:rgba(0,0,0,0.15);">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                    <b style="font-size:12px;">GM Sysprompt Section &lt;<span id="rt-gs-gmtag-label">${escapeHtml(state.gmTag)}</span>&gt;</b>
                    <button id="rt-gs-regen-gm" class="menu_button interactable" style="font-size:11px; padding:2px 8px; background:rgba(180,100,255,0.15); border-color:rgba(180,100,255,0.4);" title="Regenerate this half with AI"><i class="fa-solid fa-rotate"></i> Regenerate</button>
                </div>
                <input id="rt-gs-gmtag" type="text" class="text_pole" value="${escapeHtml(state.gmTag)}" style="width:100%; font-size:11px; font-family:monospace; margin-bottom:6px;" placeholder="snake_case_tag">
                <textarea id="rt-gs-gmcontent" class="text_pole" rows="18" style="${GS_TEXTAREA_TALL_STYLE}">${escapeHtml(state.gmContent)}</textarea>
            </div>

            <div id="rt-gs-tracker-block" style="display:${state.includeTracker ? 'block' : 'none'}; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:10px; background:rgba(0,0,0,0.15);">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                    <b style="font-size:12px;">Tracker Module [<span id="rt-gs-trktag-label">${escapeHtml(state.trackerTag)}</span>]</b>
                    <button id="rt-gs-regen-tracker" class="menu_button interactable" style="font-size:11px; padding:2px 8px; background:rgba(180,100,255,0.15); border-color:rgba(180,100,255,0.4);" title="Regenerate this half with AI"><i class="fa-solid fa-rotate"></i> Regenerate</button>
                </div>
                <div style="display:flex; gap:6px; margin-bottom:6px;">
                    <input id="rt-gs-trkicon" type="text" class="text_pole" value="${escapeHtml(state.trackerIcon)}" style="width:44px; text-align:center;" title="Icon (emoji)">
                    <input id="rt-gs-trktag" type="text" class="text_pole" value="${escapeHtml(state.trackerTag)}" style="width:140px; font-family:monospace;" placeholder="TAG">
                    <input id="rt-gs-trklabel" type="text" class="text_pole" value="${escapeHtml(state.trackerLabel)}" style="flex:1;" placeholder="Display label">
                </div>
                <textarea id="rt-gs-trkcontent" class="text_pole" rows="18" style="${GS_TEXTAREA_TALL_STYLE}">${escapeHtml(state.trackerContent)}</textarea>
            </div>

            <div style="padding:10px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; background:rgba(0,0,0,0.2);">
                <div style="font-size:11px; font-weight:bold; margin-bottom:6px;">Save Options:</div>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:4px;">
                    <input type="radio" name="rt_gs_save_mode" id="rt-gs-mode-apply" value="apply" checked style="margin:0;">
                    <span style="font-size:12px;">Enable &amp; Apply Now</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="radio" name="rt_gs_save_mode" id="rt-gs-mode-disabled" value="disabled" style="margin:0;">
                    <span style="font-size:12px;">Save Disabled (enable later)</span>
                </label>
            </div>
        </div>
    `;

    setTimeout(() => {
        const $id = (id) => document.getElementById(id);
        bindWizardPromptEditor(settings, 'rt-gs-wizard-system-prompt');
        const getWizardSystemPrompt = () => readWizardSystemPromptFromUi(settings, 'rt-gs-wizard-system-prompt');
        $id('rt-gs-icon')?.addEventListener('input', e => { state.icon = e.target.value; });
        $id('rt-gs-name')?.addEventListener('input', e => { state.name = e.target.value; });
        $id('rt-gs-gmtag')?.addEventListener('input', e => { state.gmTag = e.target.value; const lbl = $id('rt-gs-gmtag-label'); if (lbl) lbl.textContent = e.target.value; });
        $id('rt-gs-gmcontent')?.addEventListener('input', e => { state.gmContent = e.target.value; });
        $id('rt-gs-trktag')?.addEventListener('input', e => { state.trackerTag = e.target.value; const lbl = $id('rt-gs-trktag-label'); if (lbl) lbl.textContent = e.target.value; });
        $id('rt-gs-trklabel')?.addEventListener('input', e => { state.trackerLabel = e.target.value; });
        $id('rt-gs-trkicon')?.addEventListener('input', e => { state.trackerIcon = e.target.value; });
        $id('rt-gs-trkcontent')?.addEventListener('input', e => { state.trackerContent = e.target.value; });

        $id('rt-gs-include-tracker')?.addEventListener('change', e => {
            state.includeTracker = !!e.target.checked;
            const trkBlock = $id('rt-gs-tracker-block');
            const driverRow = $id('rt-gs-driver-row');
            const ownerRow = $id('rt-gs-effect-owner-row');
            const bothRow = $id('rt-gs-regen-both-row');
            if (trkBlock) trkBlock.style.display = state.includeTracker ? 'block' : 'none';
            if (driverRow) driverRow.style.display = state.includeTracker ? 'flex' : 'none';
            if (ownerRow) ownerRow.style.display = state.includeTracker ? 'flex' : 'none';
            if (bothRow) bothRow.style.display = state.includeTracker ? 'flex' : 'none';
        });

        $id('rt-gs-driver-time')?.addEventListener('change', e => { state.driverTime = !!e.target.checked; });
        $id('rt-gs-driver-gm')?.addEventListener('change', e => { state.driverGmAnnotation = !!e.target.checked; });
        $id('rt-gs-driver-fact')?.addEventListener('change', e => { state.driverStatedFact = !!e.target.checked; });

        document.querySelectorAll('input[name="rt_gs_effect_owner"]').forEach(el => {
            el.addEventListener('change', () => {
                const checked = document.querySelector('input[name="rt_gs_effect_owner"]:checked');
                if (checked) state.effectOwner = checked.value;
            });
        });
        document.querySelectorAll('input[name="rt_gs_save_mode"]').forEach(el => {
            el.addEventListener('change', () => {
                const checked = document.querySelector('input[name="rt_gs_save_mode"]:checked');
                if (checked) state.saveMode = checked.value;
            });
        });
        state.saveMode = 'apply';

        const regenGmBtn = $id('rt-gs-regen-gm');
        const regenTrkBtn = $id('rt-gs-regen-tracker');
        const regenBothBtn = $id('rt-gs-regen-both');
        const iterateBtn = $id('rt-gs-iterate');

        const setPreviewBusy = (busy) => {
            if (regenGmBtn) regenGmBtn.disabled = busy;
            if (regenTrkBtn) regenTrkBtn.disabled = busy;
            if (regenBothBtn) regenBothBtn.disabled = busy;
            if (iterateBtn) iterateBtn.disabled = busy;
        };

        const applyDraftToPreview = (draft) => {
            state.gmContent = draft.gmContent;
            if (state.includeTracker) {
                state.trackerContent = draft.trackerContent;
                if (draft.trackerLabel) state.trackerLabel = draft.trackerLabel;
                if (draft.trackerIcon) state.trackerIcon = draft.trackerIcon;
            }
            const gmTa = $id('rt-gs-gmcontent');
            if (gmTa) gmTa.value = draft.gmContent;
            const trkTa = $id('rt-gs-trkcontent');
            if (trkTa && state.includeTracker) trkTa.value = draft.trackerContent;
            const lblEl = $id('rt-gs-trklabel');
            if (lblEl && draft.trackerLabel) lblEl.value = draft.trackerLabel;
            const iconEl = $id('rt-gs-trkicon');
            if (iconEl && draft.trackerIcon) iconEl.value = draft.trackerIcon;
        };

        if (regenGmBtn) {
            regenGmBtn.addEventListener('click', async () => {
                regenGmBtn.disabled = true;
                regenGmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const drivers = { time: state.driverTime, gmAnnotation: state.driverGmAnnotation, statedFact: state.driverStatedFact };
                    const content = await regenerateGmSection(settings, description || state.name, sanitizeSnakeTag(state.gmTag), drivers, sanitizeUpperTag(state.trackerTag), state.effectOwner, getWizardSystemPrompt());
                    state.gmContent = content;
                    const ta = $id('rt-gs-gmcontent');
                    if (ta) ta.value = content;
                    toastr['success']('GM section regenerated!', 'Game System Wizard');
                } catch (err) {
                    toastr['error'](`Regeneration failed: ${err.message}`, 'Game System Wizard');
                } finally {
                    regenGmBtn.disabled = false;
                    regenGmBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Regenerate';
                }
            });
        }
        if (regenTrkBtn) {
            regenTrkBtn.addEventListener('click', async () => {
                regenTrkBtn.disabled = true;
                regenTrkBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const drivers = { time: state.driverTime, gmAnnotation: state.driverGmAnnotation, statedFact: state.driverStatedFact };
                    const block = await regenerateTrackerModule(settings, description || state.name, sanitizeUpperTag(state.trackerTag), drivers, state.effectOwner, getWizardSystemPrompt());
                    state.trackerContent = block.content;
                    if (block.attrs.label) state.trackerLabel = block.attrs.label;
                    if (block.attrs.icon) state.trackerIcon = block.attrs.icon;
                    const ta = $id('rt-gs-trkcontent');
                    if (ta) ta.value = block.content;
                    const lblEl = $id('rt-gs-trklabel');
                    if (lblEl && block.attrs.label) lblEl.value = block.attrs.label;
                    const iconEl = $id('rt-gs-trkicon');
                    if (iconEl && block.attrs.icon) iconEl.value = block.attrs.icon;
                    toastr['success']('Tracker module regenerated!', 'Game System Wizard');
                } catch (err) {
                    toastr['error'](`Regeneration failed: ${err.message}`, 'Game System Wizard');
                } finally {
                    regenTrkBtn.disabled = false;
                    regenTrkBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Regenerate';
                }
            });
        }
        if (regenBothBtn) {
            regenBothBtn.addEventListener('click', async () => {
                setPreviewBusy(true);
                regenBothBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Regenerating…';
                try {
                    const drivers = { time: state.driverTime, gmAnnotation: state.driverGmAnnotation, statedFact: state.driverStatedFact };
                    const both = await regenerateBothHalves(settings, description || state.name, sanitizeSnakeTag(state.gmTag), sanitizeUpperTag(state.trackerTag), drivers, state.effectOwner, getWizardSystemPrompt());
                    applyDraftToPreview(both);
                    toastr['success']('Both halves regenerated together!', 'Game System Wizard');
                } catch (err) {
                    toastr['error'](`Regeneration failed: ${err.message}`, 'Game System Wizard');
                } finally {
                    setPreviewBusy(false);
                    regenBothBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Regenerate Both';
                }
            });
        }
        if (iterateBtn) {
            iterateBtn.addEventListener('click', async () => {
                const feedback = await promptGameSystemIterationFeedback();
                if (!feedback) return;

                setPreviewBusy(true);
                const prevLabel = iterateBtn.innerHTML;
                iterateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iterating…';
                try {
                    // Sync any unsaved manual textarea edits before sending to AI.
                    state.gmContent = $id('rt-gs-gmcontent')?.value ?? state.gmContent;
                    state.trackerContent = $id('rt-gs-trkcontent')?.value ?? state.trackerContent;

                    const drivers = { time: state.driverTime, gmAnnotation: state.driverGmAnnotation, statedFact: state.driverStatedFact };
                    const draft = await iterateGameSystemDraft(settings, {
                        description: description || state.name,
                        iterationFeedback: feedback,
                        gmTag: sanitizeSnakeTag(state.gmTag),
                        gmContent: state.gmContent,
                        includeTracker: state.includeTracker,
                        trackerTag: sanitizeUpperTag(state.trackerTag),
                        trackerContent: state.trackerContent,
                        trackerLabel: state.trackerLabel,
                        drivers,
                        effectOwner: state.effectOwner,
                        systemPrompt: getWizardSystemPrompt(),
                    });
                    applyDraftToPreview(draft);
                    toastr['success']('Draft updated from your feedback!', 'Game System Wizard');
                } catch (err) {
                    toastr['error'](`Iteration failed: ${err.message}`, 'Game System Wizard');
                } finally {
                    setPreviewBusy(false);
                    iterateBtn.innerHTML = prevLabel;
                }
            });
        }
    }, 100);

    /** Popup.show.confirm returns 1 = OK, null = Cancel, 2 = first custom button (Back). */
    const GS_PREVIEW_BACK = 2;

    const previewPopupOptions = {
        okButton: isEdit ? 'Save Changes' : 'Create Game System',
        cancelButton: 'Cancel',
        ...GS_POPUP_LARGE,
    };
    if (allowBack) {
        previewPopupOptions.customButtons = [{ text: 'Back', result: GS_PREVIEW_BACK, icon: 'fa-arrow-left' }];
    }

    const popupResult = await Popup.show.confirm(
        isEdit ? '✏️ Edit Game System' : '🧙 Review Generated Game System',
        html,
        previewPopupOptions
    );
    if (popupResult === null) return null;
    if (popupResult === GS_PREVIEW_BACK) return { back: true };
    if (popupResult !== 1) return null;

    if (!state.name.trim()) {
        toastr['warning']('Please give this game system a name.', 'Game System Wizard');
        return null;
    }
    if (!state.gmContent.trim() && !(state.includeTracker && state.trackerContent.trim())) {
        toastr['warning']('At least a GM section or a tracker module must have content.', 'Game System Wizard');
        return null;
    }
    if (state.includeTracker && !state.driverTime && !state.driverGmAnnotation && !state.driverStatedFact) {
        toastr['warning']('Select at least one way the tracked value changes (time, GM deltas, or stated facts).', 'Game System Wizard');
        return null;
    }

    return {
        name: state.name.trim(),
        icon: state.icon.trim() || '✨',
        includeGm: !!state.gmContent.trim(),
        gmTag: sanitizeSnakeTag(state.gmTag),
        gmContent: state.gmContent.trim(),
        includeTracker: state.includeTracker && !!state.trackerContent.trim(),
        trackerTag: sanitizeUpperTag(state.trackerTag),
        trackerLabel: state.trackerLabel.trim() || state.name.trim(),
        trackerIcon: state.trackerIcon.trim() || '📄',
        trackerContent: state.trackerContent.trim(),
        driverTime: state.driverTime,
        driverGmAnnotation: state.driverGmAnnotation,
        driverStatedFact: state.driverStatedFact,
        effectOwner: state.effectOwner,
        saveMode: state.saveMode || 'apply',
        description,
    };
}

/** Writes a wizard result into the linked customSyspromptLibrary/customFields/gameSystems records. */
function saveGameSystemFromPreview(result, existingSystemId = null) {
    const settings = getSettings();
    if (!settings.customSyspromptLibrary) settings.customSyspromptLibrary = [];
    if (!settings.customFields) settings.customFields = [];
    if (!settings.gameSystems) settings.gameSystems = [];

    const enabled = result.saveMode === 'apply';
    const existing = existingSystemId ? settings.gameSystems.find(g => g.id === existingSystemId) : null;

    // ── GM section half ──
    let syspromptLibraryId = existing?.syspromptLibraryId || null;
    if (result.includeGm) {
        const wrapped = normalizeGmContent(result.gmTag, result.gmContent);
        let libItem = syspromptLibraryId ? settings.customSyspromptLibrary.find(p => p.id === syspromptLibraryId) : null;
        if (libItem) {
            libItem.tag = result.gmTag;
            libItem.content = wrapped;
            libItem.description = `Game System: ${result.name}`;
            libItem.enabled = enabled;
        } else {
            const isTaken = (tag) => settings.customSyspromptLibrary.some(p => p.tag === tag);
            const finalTag = uniqueTag(result.gmTag, isTaken);
            libItem = {
                id: Date.now().toString(),
                tag: finalTag,
                content: normalizeGmContent(finalTag, result.gmContent),
                enabled,
                icon: 'fa-hat-wizard',
                description: `Game System: ${result.name}`,
                origin: 'wizard',
            };
            settings.customSyspromptLibrary.push(libItem);
            syspromptLibraryId = libItem.id;
        }
    } else if (syspromptLibraryId) {
        // User unchecked the GM half during edit — drop the linked library entry.
        settings.customSyspromptLibrary = settings.customSyspromptLibrary.filter(p => p.id !== syspromptLibraryId);
        syspromptLibraryId = null;
    }

    // ── Tracker module half ──
    let customFieldTag = existing?.customFieldTag || null;
    if (result.includeTracker) {
        let field = customFieldTag ? settings.customFields.find(f => f.tag.toUpperCase() === customFieldTag) : null;
        if (field) {
            field.label = result.trackerLabel;
            field.icon = result.trackerIcon;
            field.prompt = result.trackerContent;
            field.enabled = enabled;
        } else {
            const isTaken = (tag) => settings.customFields.some(f => f.tag.toUpperCase() === tag) ||
                ['COMBAT', 'CHARACTER', 'PARTY', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME'].includes(tag);
            const finalTag = uniqueTag(result.trackerTag, isTaken);
            field = {
                tag: finalTag,
                label: result.trackerLabel,
                icon: result.trackerIcon,
                prompt: result.trackerContent,
                template: '',
                enabled,
            };
            settings.customFields.push(field);
            customFieldTag = finalTag;
            clearDeletedCustomTagTombstones(finalTag);
        }
    } else if (customFieldTag) {
        // User unchecked the tracker half during edit — drop the linked field + its blockOrder slot.
        settings.customFields = settings.customFields.filter(f => f.tag.toUpperCase() !== customFieldTag);
        if (settings.blockOrder) settings.blockOrder = settings.blockOrder.filter(t => t.toUpperCase() !== customFieldTag);
        recordDeletedCustomTags(customFieldTag);
        customFieldTag = null;
    }

    // ── Bundle record ──
    if (existing) {
        existing.name = result.name;
        existing.icon = result.icon;
        existing.enabled = enabled;
        existing.needsTracker = result.includeTracker;
        existing.driverTime = result.driverTime;
        existing.driverGmAnnotation = result.driverGmAnnotation;
        existing.driverStatedFact = result.driverStatedFact;
        existing.effectOwner = result.effectOwner;
        existing.syspromptLibraryId = syspromptLibraryId;
        existing.customFieldTag = customFieldTag;
        existing.description = result.description || existing.description || '';
    } else {
        settings.gameSystems.push({
            id: Date.now().toString(),
            name: result.name,
            icon: result.icon,
            enabled,
            needsTracker: result.includeTracker,
            driverTime: result.driverTime,
            driverGmAnnotation: result.driverGmAnnotation,
            driverStatedFact: result.driverStatedFact,
            effectOwner: result.effectOwner,
            syspromptLibraryId,
            customFieldTag,
            description: result.description || '',
            createdAt: Date.now(),
        });
    }

    refreshOrderList();
    saveSettings();
    return true;
}

/** Example mechanic descriptions shown as clickable chips in the wizard prompt UI. */
const WIZARD_EXAMPLE_SYSTEMS = [
    {
        label: '🌾 Farming',
        text: 'A farming sim: crop plots with growth stages over in-world time, soil quality, watering/fertilizer needs, harvest yields, and seasonal planting windows.',
    },
    {
        label: '🔨 Construction',
        text: 'A construction skill: track proficiency and project progress for building/repairing structures — XP from practice, material costs, build stages, and quality of finished work.',
    },
    {
        label: '☢ Radiation',
        text: 'Irradiated zones where the player accumulates RADS the longer they stay, with escalating debuffs at higher exposure.',
    },
    {
        label: '🏛 Reputation',
        text: 'A faction reputation system where standing with each major faction shifts based on visible deeds, quests completed for them, and public betrayals.',
    },
    {
        label: '🍖 Hunger & Thirst',
        text: 'Hunger and thirst as separate meters that drain over time; eating and drinking restore them with rough portion-based recovery.',
    },
    {
        label: '🛠 Crafting',
        text: 'A crafting skill tree: recipe unlocks, material quality tiers, success chance by skill level, and durable crafted gear with rarity.',
    },
    {
        label: '⛽ Vehicle Fuel',
        text: 'Vehicle fuel that drains with travel time/distance, refuels at stations or jerry cans, and strands the vehicle when empty.',
    },
    {
        label: '🧠 Sanity',
        text: 'A sanity/stress meter that drops from horror, isolation, or trauma; recovers with rest, safety, or companionship — with escalating mental-break tiers.',
    },
];

function buildWizardExampleChipsHtml() {
    const chips = WIZARD_EXAMPLE_SYSTEMS.map((ex, i) =>
        `<button type="button" class="rt-gs-wizard-example" data-example-idx="${i}" ` +
        `style="font-size:10px; padding:3px 8px; border-radius:12px; border:1px solid rgba(255,255,255,0.18); ` +
        `background:rgba(255,255,255,0.06); color:inherit; cursor:pointer; opacity:0.85; white-space:nowrap;" ` +
        `title="${escapeHtml(ex.text)}">${escapeHtml(ex.label)}</button>`
    ).join('');
    return `
            <div style="font-size:10px; opacity:0.55; margin-top:2px;">Try an example:</div>
            <div id="rt_gs_wizard_examples" style="display:flex; flex-wrap:wrap; gap:5px;">${chips}</div>`;
}

function bindWizardExampleChips(textarea) {
    if (!textarea) return;
    document.querySelectorAll('.rt-gs-wizard-example').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-example-idx') || '-1', 10);
            const ex = WIZARD_EXAMPLE_SYSTEMS[idx];
            if (!ex) return;
            textarea.value = ex.text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.focus();
        });
    });
}

/** @returns {Promise<{description: string, systemPrompt: string}|null>} User's mechanic description + wizard system prompt, or null if cancelled. */
async function promptGameSystemWizardDescription(initialDescription = '') {
    const { Popup } = SillyTavern.getContext();
    const settings = getSettings();
    let description = initialDescription;
    let systemPrompt = getEffectiveWizardSystemPrompt(settings);

    const inputHtml = `
        <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box; text-align:left;">
            <div style="font-size:13px; opacity:0.9; font-weight:bold;">🧙 Game System Wizard</div>
            <div style="font-size:11px; opacity:0.7; line-height:1.4;">
                Describe ONE mechanic or system in plain language. The wizard will draft a matching GM sysprompt section and, if the mechanic needs persistent state, a linked tracker module — both editable before saving.
            </div>
            <textarea id="rt_gs_wizard_desc" rows="4" class="text_pole"
                style="font-size:12px; resize:vertical; width:100%;"
                placeholder="Example: Irradiated zones where the player accumulates RADS the longer they stay, with escalating debuffs at higher exposure.">${escapeHtml(initialDescription)}</textarea>
            ${buildWizardExampleChipsHtml()}
            ${buildWizardPromptEditorHtml('rt_gs_wizard_system_prompt', getEffectiveWizardSystemPrompt(settings))}
        </div>
    `;

    setTimeout(() => {
        bindWizardPromptEditor(settings, 'rt_gs_wizard_system_prompt');
        const ta = document.getElementById('rt_gs_wizard_desc');
        const promptTa = document.getElementById('rt_gs_wizard_system_prompt');
        bindWizardExampleChips(ta);
        if (ta) {
            if (!description) description = ta.value.trim();
            ta.addEventListener('input', () => { description = ta.value.trim(); });
        }
        const syncPrompt = () => {
            systemPrompt = getEffectiveWizardSystemPrompt(settings, promptTa?.value || '');
        };
        syncPrompt();
        promptTa?.addEventListener('input', syncPrompt);
        promptTa?.addEventListener('change', syncPrompt);
    }, 100);

    const inputResult = await Popup.show.confirm('🧙 Game System Wizard', inputHtml, { okButton: 'Generate', cancelButton: 'Cancel', ...GS_POPUP_LARGE });
    if (!inputResult) return null;
    const promptTa = document.getElementById('rt_gs_wizard_system_prompt');
    if (promptTa) {
        persistWizardSystemPrompt(settings, promptTa.value);
        systemPrompt = getEffectiveWizardSystemPrompt(settings, promptTa.value);
    }
    if (!description) {
        const ta = document.getElementById('rt_gs_wizard_desc');
        description = ta?.value?.trim() || '';
    }
    if (!description) {
        toastr['warning']('Please describe the mechanic/system you want.', 'Game System Wizard');
        return null;
    }
    return { description, systemPrompt };
}

/**
 * Opens the Game System Wizard. Pass an existing settings.gameSystems[] entry
 * to edit it in place instead of creating a new one.
 */
export async function openGameSystemWizard(existingSystem = null) {
    const settings = getSettings();

    if (existingSystem) {
        const lib = existingSystem.syspromptLibraryId
            ? (settings.customSyspromptLibrary || []).find(p => p.id === existingSystem.syspromptLibraryId)
            : null;
        const field = existingSystem.customFieldTag
            ? (settings.customFields || []).find(f => f.tag.toUpperCase() === existingSystem.customFieldTag)
            : null;
        const existingDrivers = normalizeDrivers(existingSystem);
        const parsed = {
            name: existingSystem.name,
            icon: existingSystem.icon,
            needsTracker: existingSystem.needsTracker,
            driverTime: existingDrivers.time,
            driverGmAnnotation: existingDrivers.gmAnnotation,
            driverStatedFact: existingDrivers.statedFact,
            effectOwner: existingSystem.effectOwner || 'tracker',
            includeGm: !!lib,
            gmTag: lib?.tag || sanitizeSnakeTag(existingSystem.name),
            gmContent: lib?.content || '',
            trackerTag: field?.tag?.toUpperCase() || sanitizeUpperTag(existingSystem.name),
            trackerLabel: field?.label || existingSystem.name,
            trackerIcon: field?.icon || existingSystem.icon,
            trackerContent: field?.prompt || '',
        };
        const description = existingSystem.description || '';
        const result = await showGameSystemPreview(parsed, { description, isEdit: true });
        if (!result || result.back) return;

        saveGameSystemFromPreview(result, existingSystem.id);
        if (result.saveMode === 'apply') await autoApplySysprompt(true);
        toastr['success'](`Game System "${result.name}" saved! ✅`, 'Game System Wizard');
        return;
    }

    // New system: describe → generate → preview loop (Back returns to describe with text preserved).
    let description = '';
    while (true) {
        const wizardInput = await promptGameSystemWizardDescription(description);
        if (!wizardInput) return;
        description = wizardInput.description;
        const wizardSystemPrompt = wizardInput.systemPrompt;

        toastr['info']('Designing your game system with AI...', 'Game System Wizard', { timeOut: 3000 });
        const $btn = $('#rpg_tracker_btn_game_system_wizard');
        const oldHtml = $btn.html();
        $btn.prop('disabled', true).addClass('loading').html('<i class="fa-solid fa-spinner fa-spin"></i> Generating...');

        let parsed;
        try {
            parsed = await generateGameSystemDraft(settings, description, wizardSystemPrompt);
        } catch (err) {
            console.error('[RPG Tracker] Game System Wizard error:', err);
            toastr['error'](`Failed to generate game system: ${err.message}`, 'Game System Wizard');
            continue;
        } finally {
            $btn.prop('disabled', false).removeClass('loading').html(oldHtml);
        }

        while (true) {
            const result = await showGameSystemPreview(parsed, { description, isEdit: false, allowBack: true });
            if (!result) return;
            if (result.back) break;

            saveGameSystemFromPreview(result, null);
            if (result.saveMode === 'apply') await autoApplySysprompt(true);
            toastr['success'](`Game System "${result.name}" saved! ✅`, 'Game System Wizard');
            return;
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Manage Game Systems — list/toggle/edit/delete/export/import bundles
// ─────────────────────────────────────────────────────────────────────────

function badgeForSystem(gs) {
    const shape = (gs.syspromptLibraryId && gs.customFieldTag) ? 'GM + Tracker' : (gs.customFieldTag ? 'Tracker' : 'GM');
    if (!gs.customFieldTag) return shape;
    const d = normalizeDrivers(gs);
    const labels = [];
    if (d.time) labels.push('auto-tick');
    if (d.gmAnnotation) labels.push('GM deltas');
    if (d.statedFact) labels.push('stated facts');
    return `${shape} · ${labels.join(' + ')}`;
}

/** Serializes a bundle back into the shareable tag-based text blob. */
export function exportGameSystemToText(gs) {
    const settings = getSettings();
    const lib = gs.syspromptLibraryId ? (settings.customSyspromptLibrary || []).find(p => p.id === gs.syspromptLibraryId) : null;
    const field = gs.customFieldTag ? (settings.customFields || []).find(f => f.tag.toUpperCase() === gs.customFieldTag) : null;
    const d = normalizeDrivers(gs);

    let out = `<meta name="${gs.name.replace(/"/g, '&quot;')}" icon="${(gs.icon || '').replace(/"/g, '&quot;')}" needs_tracker="${!!field}" driver_time="${d.time}" driver_gm_annotation="${d.gmAnnotation}" driver_stated_fact="${d.statedFact}" effect_owner="${gs.effectOwner || 'tracker'}"/>\n`;
    if (lib) {
        out += `<gm_section tag="${lib.tag}">\n${lib.content}\n</gm_section>\n`;
    }
    if (field) {
        out += `<tracker_module tag="${field.tag.toUpperCase()}" label="${(field.label || '').replace(/"/g, '&quot;')}" icon="${(field.icon || '').replace(/"/g, '&quot;')}">\n${field.prompt}\n</tracker_module>\n`;
    }
    return out.trim();
}

async function showExportPopup(text) {
    const { Popup } = SillyTavern.getContext();
    const html = `
        <div style="display:flex; flex-direction:column; gap:8px; text-align:left;">
            <div style="font-size:11px; opacity:0.7;">Copy this text to share the Game System, or paste it back in via Import.</div>
            <textarea id="rt-gs-export-text" readonly class="text_pole" rows="20" style="${GS_TEXTAREA_EXPORT_STYLE}">${escapeHtml(text)}</textarea>
        </div>
    `;
    await Popup.show.confirm('📤 Export Game System', html, { okButton: 'Close', cancelButton: false, ...GS_POPUP_LARGE });
}

async function showImportPopup() {
    const { Popup } = SillyTavern.getContext();
    let pasted = '';
    const html = `
        <div style="display:flex; flex-direction:column; gap:8px; text-align:left;">
            <div style="font-size:11px; opacity:0.7;">Paste an exported Game System text blob below.</div>
            <textarea id="rt-gs-import-text" class="text_pole" rows="20" style="${GS_TEXTAREA_EXPORT_STYLE}" placeholder="<meta .../>&#10;<gm_section ...>...&#10;<tracker_module ...>..."></textarea>
        </div>
    `;
    setTimeout(() => {
        const ta = document.getElementById('rt-gs-import-text');
        if (ta) ta.addEventListener('input', e => { pasted = e.target.value; });
    }, 100);
    const ok = await Popup.show.confirm('📥 Import Game System', html, { okButton: 'Preview', cancelButton: 'Cancel', ...GS_POPUP_LARGE });
    return ok ? pasted.trim() : null;
}

export async function importGameSystem() {
    const text = await showImportPopup();
    if (!text) return;
    let parsed;
    try {
        const names = await getPlayerMacroReplacementNames();
        parsed = parseWizardResponse(text, names);
    } catch (err) {
        toastr['error'](`Could not parse import text: ${err.message}`, 'Game Systems');
        return;
    }
    const result = await showGameSystemPreview(parsed, { description: '', isEdit: false });
    if (!result) return;
    saveGameSystemFromPreview(result, null);
    if (result.saveMode === 'apply') await autoApplySysprompt(true);
    toastr['success'](`Game System "${result.name}" imported! ✅`, 'Game Systems');
}

/**
 * Enables/disables a Game System bundle and its linked GM section + tracker
 * module together. Shared by Manage Game Systems and the Control Room's
 * wizard-badged rows so both stay perfectly in sync.
 */
export async function setGameSystemEnabled(gs, enabled, options = {}) {
    const { deferPersistence = false } = options;
    const settings = getSettings();
    gs.enabled = enabled;
    if (gs.syspromptLibraryId) {
        const lib = (settings.customSyspromptLibrary || []).find(p => p.id === gs.syspromptLibraryId);
        if (lib) lib.enabled = enabled;
    }
    if (gs.customFieldTag) {
        const field = (settings.customFields || []).find(f => f.tag.toUpperCase() === gs.customFieldTag);
        if (field) field.enabled = enabled;
    }
    if (deferPersistence) return;
    saveSettings();
    refreshOrderList();
    refreshRenderedView();
    await autoApplySysprompt(true);
}

/**
 * Deletes a Game System bundle (GM section + tracker module + order entry)
 * after user confirmation. Shared by Manage Game Systems and the Control
 * Room's wizard-badged rows. Returns true if the deletion went through.
 */
export async function deleteGameSystemWithConfirm(gs, options = {}) {
    const { deferPersistence = false } = options;
    if (!confirm(`Delete the Game System "${gs.name}"? This removes both its GM section and tracker module. This cannot be undone.`)) return false;
    const settings = getSettings();
    if (gs.syspromptLibraryId) {
        settings.customSyspromptLibrary = (settings.customSyspromptLibrary || []).filter(p => p.id !== gs.syspromptLibraryId);
        if (settings.syspromptSectionOrder) {
            settings.syspromptSectionOrder = settings.syspromptSectionOrder.filter(k => k !== `lib:${gs.syspromptLibraryId}`);
        }
    }
    if (gs.customFieldTag) {
        settings.customFields = (settings.customFields || []).filter(f => f.tag.toUpperCase() !== gs.customFieldTag);
        if (settings.blockOrder) settings.blockOrder = settings.blockOrder.filter(t => t.toUpperCase() !== gs.customFieldTag);
        recordDeletedCustomTags(gs.customFieldTag);
    }
    settings.gameSystems = (settings.gameSystems || []).filter(g => g.id !== gs.id);
    if (deferPersistence) return true;
    saveSettings();
    refreshOrderList();
    refreshRenderedView();
    await autoApplySysprompt(true);
    toastr['info'](`Game System "${gs.name}" deleted.`, 'Game Systems');
    return true;
}

export async function openManageGameSystems() {
    const { Popup } = SillyTavern.getContext();
    const settings = getSettings();
    if (!settings.gameSystems) settings.gameSystems = [];

    const generateListHtml = () => {
        if (settings.gameSystems.length === 0) {
            return `<div style="text-align:center; padding:30px; opacity:0.5; font-style:italic;">No Game Systems yet. Use the Wizard to create one.</div>`;
        }
        return '<div style="display:flex; flex-direction:column; gap:8px;">' + settings.gameSystems.map((gs, index) => `
            <div class="rt-gs-item" data-index="${index}" style="display:flex; align-items:center; gap:10px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; background:rgba(0,0,0,0.2); padding:10px;">
                <div style="font-size:18px; width:26px; text-align:center;">${escapeHtml(gs.icon || '✨')}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; font-size:13px;">${escapeHtml(gs.name)}</div>
                    <div style="font-size:10px; opacity:0.6; text-transform:uppercase; letter-spacing:0.5px;">${badgeForSystem(gs)}</div>
                </div>
                <label class="checkbox_label" style="margin:0; font-size:11px;">
                    <input type="checkbox" class="rt-gs-toggle" data-index="${index}" ${gs.enabled ? 'checked' : ''}>
                    <span>Enable</span>
                </label>
                <button class="rt-gs-edit" data-index="${index}" style="background:none; border:none; color:#88bbff; cursor:pointer; padding:4px;" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="rt-gs-export" data-index="${index}" style="background:none; border:none; color:#aaddff; cursor:pointer; padding:4px;" title="Export"><i class="fa-solid fa-file-export"></i></button>
                <button class="rt-gs-delete" data-index="${index}" style="background:none; border:none; color:#ff5555; cursor:pointer; padding:4px;" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `).join('') + '</div>';
    };

    const html = `
        <div id="rt-gs-manage-container" style="display:flex; flex-direction:column; gap:12px; width:100%; box-sizing:border-box; max-height:85vh;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
                <div style="font-size:11px; opacity:0.8; line-height:1.4;">Manage Game System bundles. Toggling or deleting a bundle affects both its GM section and tracker module together.</div>
                <button id="rt_gs_btn_import" class="menu_button interactable" style="white-space:nowrap; margin-left:10px; font-size:11px; padding:4px 8px;">
                    <i class="fa-solid fa-file-import"></i> Import
                </button>
            </div>
            <div id="rt-gs-manage-list-wrap" style="overflow-y:auto; padding-right:10px; flex:1;">
                ${generateListHtml()}
            </div>
        </div>
    `;

    setTimeout(() => {
        const container = document.getElementById('rt-gs-manage-container');
        if (!container) return;

        const bindEvents = () => {
            const wrap = document.getElementById('rt-gs-manage-list-wrap');
            if (!wrap) return;

            wrap.querySelectorAll('.rt-gs-toggle').forEach(el => {
                el.addEventListener('change', async (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const gs = settings.gameSystems[idx];
                    await setGameSystemEnabled(gs, e.target.checked);
                });
            });

            wrap.querySelectorAll('.rt-gs-edit').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    const gs = settings.gameSystems[idx];
                    await openGameSystemWizard(gs);
                    const w = document.getElementById('rt-gs-manage-list-wrap');
                    if (w) { w.innerHTML = generateListHtml(); bindEvents(); }
                });
            });

            wrap.querySelectorAll('.rt-gs-export').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    const gs = settings.gameSystems[idx];
                    await showExportPopup(exportGameSystemToText(gs));
                });
            });

            wrap.querySelectorAll('.rt-gs-delete').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    const gs = settings.gameSystems[idx];
                    const deleted = await deleteGameSystemWithConfirm(gs);
                    if (!deleted) return;
                    const w = document.getElementById('rt-gs-manage-list-wrap');
                    if (w) { w.innerHTML = generateListHtml(); bindEvents(); }
                });
            });
        };
        bindEvents();

        const importBtn = document.getElementById('rt_gs_btn_import');
        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                await importGameSystem();
                const w = document.getElementById('rt-gs-manage-list-wrap');
                if (w) { w.innerHTML = generateListHtml(); bindEvents(); }
            });
        }
    }, 100);

    await Popup.show.confirm('🧩 Manage Game Systems', html, { okButton: 'Close', cancelButton: false, ...GS_POPUP_LARGE });
}

// ─────────────────────────────────────────────────────────────────────────
// Unlock Base Sections — fully override a built-in sysprompt.txt section
// ─────────────────────────────────────────────────────────────────────────

export async function unlockBaseSection(tag, options = {}) {
    const { deferPersistence = false } = options;
    const settings = getSettings();
    if (isSectionUnlocked(settings, tag)) {
        toastr['info'](`<${tag}> is already unlocked.`, 'Game Systems');
        return;
    }

    let raw;
    try {
        raw = await fetchBaseSyspromptRaw(settings);
    } catch (err) {
        toastr['error']('Could not fetch sysprompt.txt.', 'Game Systems');
        return;
    }
    const sections = extractTopLevelSections(raw);
    const found = sections.find(s => s.tag === tag);
    const seedContent = `<${tag}>\n${(found ? found.content : '').trim()}\n</${tag}>`;

    if (!settings.customSyspromptLibrary) settings.customSyspromptLibrary = [];
    settings.customSyspromptLibrary.push({
        id: Date.now().toString(),
        tag,
        content: seedContent,
        enabled: true,
        icon: 'fa-lock-open',
        description: `Unlocked override of <${tag}>`,
        origin: 'unlocked_base',
        baseTag: tag,
    });

    if (!settings.syspromptModules) settings.syspromptModules = {};
    settings.syspromptModules[tag] = false;

    await persistSyspromptChanges(deferPersistence);
    if (!deferPersistence) {
        syncNarratorToggleUi(tag, settings);
        toastr['success'](`<${tag}> unlocked for customization.`, 'Game Systems');
    }
}

export async function relockBaseSection(tag, options = {}) {
    const { deferPersistence = false } = options;
    const settings = getSettings();
    settings.customSyspromptLibrary = (settings.customSyspromptLibrary || []).filter(p => !(p.origin === 'unlocked_base' && p.baseTag === tag));

    if (!settings.syspromptModules) settings.syspromptModules = {};
    if (tag in KNOWN_TOGGLE_DEFAULTS) {
        settings.syspromptModules[tag] = KNOWN_TOGGLE_DEFAULTS[tag];
    } else {
        delete settings.syspromptModules[tag];
    }

    await persistSyspromptChanges(deferPersistence);
    if (!deferPersistence) {
        syncNarratorToggleUi(tag, settings);
        toastr['success'](`<${tag}> re-locked and restored to default.`, 'Game Systems');
    }
}

export async function editUnlockedSection(tag, options = {}) {
    const { deferPersistence = false } = options;
    const settings = getSettings();
    const item = (settings.customSyspromptLibrary || []).find(p => p.origin === 'unlocked_base' && p.baseTag === tag);
    if (!item) return;

    const generateSection = async (desc) => {
        const systemPrompt = `You are an expert D&D system-prompt editor. Revise the section below based on the user's requested changes. Return ONLY the updated <${tag}>...</${tag}> block — no explanation, no markdown fences. Reference {{user}} for the player character; never hardcode the current persona name.`;
        const userPrompt = `CURRENT CONTENT:\n${item.content}\n\nREQUESTED CHANGES:\n${desc}`;
        const { raw, names } = await sendWizardStateRequest(settings, systemPrompt, userPrompt);
        if (!raw) throw new Error('No response from AI');
        let section = raw.trim();
        const fenceMatch = section.match(/```(?:xml)?\s*([\s\S]*?)```/);
        if (fenceMatch) section = fenceMatch[1].trim();
        return sanitizeWizardMacroContent(normalizeGmContent(tag, section), names);
    };

    const result = await showSectionEditor({
        mode: 'edit',
        tag,
        description: item.description,
        content: item.content,
        onRegenerate: generateSection,
    });
    if (!result) return;

    item.content = normalizeGmContent(tag, result.content);
    item.description = result.description || item.description;
    await persistSyspromptChanges(deferPersistence);
    if (!deferPersistence) {
        toastr['success'](`<${tag}> updated.`, 'Game Systems');
    }
}

// ─────────────────────────────────────────────────────────────────────────
// System Prompt Control Room — unified reorder/toggle/add/unlock popup.
// Replaces "Unlock Base Sections" + "Advanced: Manual Sysprompt Sections"
// with one drag-and-drop-reorderable list of every top-level sysprompt
// section (built-in and custom), with AI Builder / Add Manually / Reset
// folded in as toolbar actions.
// ─────────────────────────────────────────────────────────────────────────

function buildWizardControlRoomSubtext(gs, settings) {
    if (!gs) return '';
    const field = gs.customFieldTag
        ? (settings.customFields || []).find(f => f.tag.toUpperCase() === gs.customFieldTag.toUpperCase())
        : null;
    if (!field) {
        return gs.name ? `Game System: ${gs.name}` : '';
    }
    const trackerName = (field.label || field.tag || gs.name || '').trim();
    let text = `Game System: ${gs.name || trackerName}`;
    if (trackerName && trackerName !== gs.name) {
        text += ` · Tracker: ${trackerName}`;
    }
    return text;
}

function controlRoomRowIcon(row) {
    if (row.kind === 'base') return `<i class="fa-solid fa-lock" style="width:20px; text-align:center; opacity:0.5;"></i>`;
    if (row.kind === 'unlocked') return `<i class="fa-solid fa-lock-open" style="width:20px; text-align:center; color:#ffb43c;"></i>`;
    if (row.kind === 'wizard') return `<div style="font-size:15px; width:20px; text-align:center;">🧙</div>`;
    return `<i class="fa-solid ${row.icon || 'fa-puzzle-piece'}" style="width:20px; text-align:center; color:var(--rt-accent, #5588ff);"></i>`;
}

function controlRoomRowBadge(row) {
    if (row.kind === 'unlocked') {
        return `<span style="font-size:9px; padding:1px 5px; border-radius:3px; margin-left:6px; background:rgba(255,180,60,0.2); color:#ffb43c;" title="Unlocked override of a built-in section">UNLOCKED</span>`;
    }
    if (row.kind === 'wizard') {
        return `<span style="font-size:9px; padding:1px 5px; border-radius:3px; margin-left:6px; background:rgba(180,100,255,0.2); color:#c9a0ff;" title="Created via Game System Wizard — Edit/Delete redirect there to stay in sync with the linked tracker module">WIZARD</span>`;
    }
    return '';
}

function controlRoomRowActions(row) {
    if (row.kind === 'base') {
        return `<button class="rt-cr-unlock menu_button interactable" data-tag="${escapeHtml(row.tag)}" style="font-size:11px; padding:2px 8px; white-space:nowrap; background:rgba(255,180,60,0.15); border-color:rgba(255,180,60,0.4);">Unlock</button>`;
    }
    if (row.kind === 'unlocked') {
        return `
            <button class="rt-cr-edit-unlocked" data-tag="${escapeHtml(row.tag)}" style="background:none; border:none; color:#88bbff; cursor:pointer; padding:4px;" title="Edit override"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="rt-cr-relock menu_button interactable" data-tag="${escapeHtml(row.tag)}" style="font-size:11px; padding:2px 8px; white-space:nowrap;">Re-lock</button>`;
    }
    if (row.kind === 'wizard') {
        return `
            <button class="rt-cr-edit-wizard" data-libid="${escapeHtml(row.libId)}" style="background:none; border:none; color:#88bbff; cursor:pointer; padding:4px;" title="Edit in Game System Wizard"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="rt-cr-delete-wizard" data-libid="${escapeHtml(row.libId)}" style="background:none; border:none; color:#ff5555; cursor:pointer; padding:4px;" title="Delete Game System (removes tracker module too)"><i class="fa-solid fa-trash-can"></i></button>`;
    }
    return `
        <button class="rt-cr-edit-custom" data-libid="${escapeHtml(row.libId)}" style="background:none; border:none; color:#88bbff; cursor:pointer; padding:4px;" title="Edit Section"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="rt-cr-delete-custom" data-libid="${escapeHtml(row.libId)}" style="background:none; border:none; color:#ff5555; cursor:pointer; padding:4px;" title="Delete Section"><i class="fa-solid fa-trash-can"></i></button>`;
}

function renderControlRoomRow(row) {
    return `
        <div class="rt-cr-row" data-key="${escapeHtml(row.key)}" style="opacity:${row.enabled ? '1' : '0.55'};">
            <div class="rt-cr-row-main">
                <i class="fa-solid fa-grip-vertical rt-cr-row-grip" aria-hidden="true"></i>
                <span class="rt-cr-row-icon">${controlRoomRowIcon(row)}</span>
                <div class="rt-cr-row-body">
                    <div class="rt-cr-row-label">${escapeHtml(row.label)}${controlRoomRowBadge(row)}</div>
                    ${row.description ? `<div class="rt-cr-row-desc" title="${escapeHtml(row.description)}">${escapeHtml(row.description)}</div>` : ''}
                </div>
            </div>
            <div class="rt-cr-row-controls">
                <label class="checkbox_label rt-cr-row-enable">
                    <input type="checkbox" class="rt-cr-enable" data-key="${escapeHtml(row.key)}" ${row.enabled ? 'checked' : ''}>
                    <span>Enabled</span>
                </label>
                <div class="rt-cr-row-actions">${controlRoomRowActions(row)}</div>
            </div>
        </div>
    `;
}

export async function openSystemPromptControlRoom() {
    const { Popup } = SillyTavern.getContext();
    const settings = getSettings();
    let initialSnapshot = snapshotControlRoomSettings(settings);
    const deferOpts = { deferPersistence: true };
    const isDirty = () => JSON.stringify(snapshotControlRoomSettings(settings)) !== JSON.stringify(initialSnapshot);

    let raw;
    try {
        raw = await fetchBaseSyspromptRaw(settings);
    } catch (err) {
        toastr['error']('Could not fetch sysprompt.txt.', 'System Prompt Control Room');
        return;
    }
    const baseSections = extractTopLevelSections(raw);
    const baseSectionMap = new Map(baseSections.map(s => [s.tag, s.content]));

    const getRows = () => {
        const order = normalizeSectionOrder(settings, baseSections);
        return order.map(key => getSectionRowDescriptor(key, settings, baseSectionMap)).filter(Boolean);
    };

    const generateListHtml = () => {
        const rows = getRows();
        if (rows.length === 0) {
            return `<div style="text-align:center; padding:30px; opacity:0.5; font-style:italic;">No sections found.</div>`;
        }
        return '<div id="rt-cr-list" style="display:flex; flex-direction:column; gap:8px;">' + rows.map(renderControlRoomRow).join('') + '</div>';
    };

    const html = `
        <div id="rt-cr-container" class="rt-cr-popup-container">
            <div style="font-size:11px; opacity:0.8; line-height:1.4;">
                Drag any row to reorder sections, toggle <b>Enabled</b> to turn it on/off, or use the tools below to unlock a built-in section or add a brand-new one. 🧙 rows are managed by the Game System Wizard — Edit/Delete there keeps the linked tracker module in sync.
                <div style="margin-top:4px; opacity:0.75;">Changes are kept in memory until you click <b>Save</b>.</div>
            </div>
            <details id="rt-cr-custom-sysprompt-details" style="border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 8px;">
                <summary style="font-size: 0.78em; opacity: 0.6; cursor: pointer; outline: none; user-select: none;">Advanced: manage your own system prompt</summary>
                <div style="margin-top: 8px; padding: 8px 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; background: rgba(0,0,0,0.1);">
                    <label class="checkbox_label" style="margin: 0;">
                        <input id="rpg_tracker_custom_sysprompt" type="checkbox" />
                        <span>Custom Sysprompt Mode</span>
                    </label>
                    <small style="display: block; margin-top: 6px; opacity: 0.6; font-size: 10px; line-height: 1.35;">
                        When enabled, the framework will not write to your system prompt. Section order and toggles are still saved, but nothing is applied to Quick Prompt Main until you turn this off.
                    </small>
                </div>
            </details>
            <div class="rt-cr-toolbar">
                <button id="rt_cr_btn_ai_add" class="menu_button interactable rt-cr-toolbar-btn" style="flex:1; background:rgba(180,100,255,0.15); border-color:rgba(180,100,255,0.4); font-size:11px; padding:4px 8px;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> AI Builder
                </button>
                <button id="rt_cr_btn_manual_add" class="menu_button interactable rt-cr-toolbar-btn" style="flex:1; background:rgba(80,180,120,0.15); border-color:rgba(80,180,120,0.4); font-size:11px; padding:4px 8px;">
                    <i class="fa-solid fa-plus"></i> Add Manually
                </button>
                <button id="rt_cr_btn_reset" class="menu_button interactable rt-cr-toolbar-icon-btn" style="width:auto; padding:4px 12px; background:rgba(255,100,100,0.15); border-color:rgba(255,100,100,0.4); font-size:11px;" title="Remove all AI/manually-added sections and reset the order to defaults">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
                <button id="rt_cr_btn_cartridges" class="menu_button interactable rt-cr-toolbar-icon-btn" style="width:auto; padding:4px 12px; background:rgba(100,220,150,0.15); border-color:rgba(100,220,150,0.4); font-size:11px;" title="Save, load, export, or import your entire configuration as a Game Cartridge">
                    <i class="fa-solid fa-compact-disc"></i>
                </button>
            </div>
            <div id="rt-cr-list-wrap" class="rt-cr-list-wrap">
                ${generateListHtml()}
            </div>
        </div>
    `;

    setTimeout(() => {
        const container = document.getElementById('rt-cr-container');
        if (!container) return;

        const customSyspromptCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_custom_sysprompt'));
        const customSyspromptDetails = document.getElementById('rt-cr-custom-sysprompt-details');
        if (customSyspromptCb) {
            customSyspromptCb.checked = !!settings.customSysprompt;
            if (settings.customSysprompt && customSyspromptDetails) customSyspromptDetails.open = true;
            customSyspromptCb.addEventListener('change', function () {
                settings.customSysprompt = !!this.checked;
            });
        }

        const refresh = () => {
            const wrap = document.getElementById('rt-cr-list-wrap');
            if (wrap) wrap.innerHTML = generateListHtml();
            bindEvents();
        };

        const bindEvents = () => {
            const wrap = document.getElementById('rt-cr-list-wrap');
            const list = document.getElementById('rt-cr-list');
            if (!wrap || !list) return;

            // ── Drag-and-drop reorder ──
            const $list = $(list);
            if ($list.sortable('instance') !== undefined) {
                $list.sortable('destroy');
            }
            $list.sortable({
                items: '.rt-cr-row',
                cancel: 'input, textarea, button, select, option, label, a',
                delay: getSortableDelay(),
                start: () => {
                    list.querySelectorAll('.rt-cr-row').forEach(el => { el.style.cursor = 'grabbing'; });
                },
                stop: () => {
                    list.querySelectorAll('.rt-cr-row').forEach(el => { el.style.cursor = 'grab'; });
                    settings.syspromptSectionOrder = Array.from(list.querySelectorAll('.rt-cr-row')).map(el => el.dataset.key);
                },
            });

            // ── Enable/disable toggle ──
            wrap.querySelectorAll('.rt-cr-enable').forEach(el => {
                el.addEventListener('change', async (e) => {
                    const key = e.currentTarget.dataset.key;
                    const row = getSectionRowDescriptor(key, settings, baseSectionMap);
                    if (!row) return;
                    const checked = e.currentTarget.checked;

                    if (row.kind === 'wizard' && row.gameSystemId) {
                        const gs = (settings.gameSystems || []).find(g => g.id === row.gameSystemId);
                        if (gs) {
                            await setGameSystemEnabled(gs, checked, deferOpts);
                            refresh();
                            return;
                        }
                    }

                    if (row.kind === 'base') {
                        if (row.tag === 'relationship_tracking') {
                            settings.npcRelationshipBars = checked;
                        } else {
                            if (!settings.syspromptModules) settings.syspromptModules = {};
                            settings.syspromptModules[row.tag] = checked;
                        }
                    } else {
                        const item = (settings.customSyspromptLibrary || []).find(p => p.id === row.libId);
                        if (item) item.enabled = checked;
                    }
                    refresh();
                });
            });

            // ── Base row: Unlock ──
            wrap.querySelectorAll('.rt-cr-unlock').forEach(el => {
                el.addEventListener('click', async (e) => {
                    await unlockBaseSection(e.currentTarget.dataset.tag, deferOpts);
                    refresh();
                });
            });

            // ── Unlocked row: Edit / Re-lock ──
            wrap.querySelectorAll('.rt-cr-edit-unlocked').forEach(el => {
                el.addEventListener('click', async (e) => {
                    await editUnlockedSection(e.currentTarget.dataset.tag, deferOpts);
                    refresh();
                });
            });
            wrap.querySelectorAll('.rt-cr-relock').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const tag = e.currentTarget.dataset.tag;
                    if (!confirm(`Re-lock <${tag}>? Your custom override will be deleted and the section restored to default.`)) return;
                    await relockBaseSection(tag, deferOpts);
                    refresh();
                });
            });

            // ── Wizard row: Edit / Delete (redirect to Game System Wizard logic) ──
            wrap.querySelectorAll('.rt-cr-edit-wizard').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const libId = e.currentTarget.dataset.libid;
                    const gs = (settings.gameSystems || []).find(g => g.syspromptLibraryId === libId);
                    if (!gs) { toastr['warning']('Could not find the linked Game System. Try Manage Game Systems instead.', 'System Prompt Control Room'); return; }
                    await openGameSystemWizard(gs);
                    refresh();
                });
            });
            wrap.querySelectorAll('.rt-cr-delete-wizard').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const libId = e.currentTarget.dataset.libid;
                    const gs = (settings.gameSystems || []).find(g => g.syspromptLibraryId === libId);
                    if (!gs) { toastr['warning']('Could not find the linked Game System. Try Manage Game Systems instead.', 'System Prompt Control Room'); return; }
                    const deleted = await deleteGameSystemWithConfirm(gs, deferOpts);
                    if (!deleted) return;
                    refresh();
                });
            });

            // ── Custom row: Edit / Delete ──
            wrap.querySelectorAll('.rt-cr-edit-custom').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const libId = e.currentTarget.dataset.libid;
                    const item = (settings.customSyspromptLibrary || []).find(p => p.id === libId);
                    if (!item) return;
                    const result = await showSectionEditor({
                        mode: 'edit',
                        tag: item.tag,
                        description: item.description || '',
                        content: item.content,
                    });
                    if (!result) return;
                    item.tag = result.tag;
                    item.description = result.description;
                    item.content = result.content;
                    refresh();
                });
            });
            wrap.querySelectorAll('.rt-cr-delete-custom').forEach(el => {
                el.addEventListener('click', async (e) => {
                    if (!confirm('Delete this custom section permanently?')) return;
                    const libId = e.currentTarget.dataset.libid;
                    settings.customSyspromptLibrary = (settings.customSyspromptLibrary || []).filter(p => p.id !== libId);
                    if (settings.syspromptSectionOrder) {
                        settings.syspromptSectionOrder = settings.syspromptSectionOrder.filter(k => k !== `lib:${libId}`);
                    }
                    refresh();
                });
            });
        };
        bindEvents();

        const aiBtn = document.getElementById('rt_cr_btn_ai_add');
        if (aiBtn) aiBtn.addEventListener('click', async () => { await runAiSectionBuilder(deferOpts); refresh(); });

        const manualBtn = document.getElementById('rt_cr_btn_manual_add');
        if (manualBtn) manualBtn.addEventListener('click', async () => { await runManualSectionBuilder(deferOpts); refresh(); });

        const resetBtn = document.getElementById('rt_cr_btn_reset');
        if (resetBtn) resetBtn.addEventListener('click', async () => { await resetSyspromptLibrary(deferOpts); refresh(); });

        const cartridgesBtn = document.getElementById('rt_cr_btn_cartridges');
        if (cartridgesBtn) {
            cartridgesBtn.addEventListener('click', async () => {
                if (isDirty()) {
                    toastr['warning']('Save or Cancel your current changes before opening Game Cartridges.', 'System Prompt Control Room');
                    return;
                }
                await openManageGameCartridges();
                // A cartridge Load fully replaces settings outside this popup's normal
                // Save/Cancel deferral — re-baseline so Cancel doesn't revert it.
                initialSnapshot = snapshotControlRoomSettings(settings);
                refresh();
            });
        }
    }, 100);

    const result = await Popup.show.confirm('🎛️ System Prompt Control Room', html, {
        okButton: 'Save',
        cancelButton: 'Cancel',
        onClosing: async (popup) => {
            if (popup.result === POPUP_RESULT.AFFIRMATIVE) return true;
            if (!isDirty()) return true;
            return confirm('Discard unsaved changes to the system prompt sections?');
        },
        wide: true,
        large: true,
        allowVerticalScrolling: false,
    });

    if (result === POPUP_RESULT.AFFIRMATIVE) {
        saveSettings();
        syncAllNarratorTogglesForUnlockState();
        refreshOrderList();
        refreshRenderedView();
        const narratorBlockEl = document.getElementById('rpg_narrator_config_block');
        if (narratorBlockEl) narratorBlockEl.style.display = settings.customSysprompt ? 'none' : '';
        await autoApplySysprompt(true);
        if (settings.customSysprompt) {
            toastr['success']('System prompt sections saved. Quick Prompt Main was left unchanged (Custom Sysprompt Mode).', 'System Prompt Control Room');
        } else {
            toastr['success']('System prompt sections saved.', 'System Prompt Control Room');
        }
        return;
    }

    restoreControlRoomSettings(settings, initialSnapshot);
    syncAllNarratorTogglesForUnlockState();
    const narratorBlockEl = document.getElementById('rpg_narrator_config_block');
    if (narratorBlockEl) narratorBlockEl.style.display = settings.customSysprompt ? 'none' : '';
}
