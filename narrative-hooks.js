/**
 * narrative-hooks.js — Multihog D&D Framework
 * RNG engine, dice tools, chat interceptor, and narrative collector.
 * This file is the primary hook into the SillyTavern chat pipeline:
 * it intercepts outgoing messages to inject context (RNG queue, state memo,
 * quests) and collects incoming AI narrative for the state model pass.
 *
 * Imports: state-manager.js
 * Imported by: index.js (registration)
 *
 * NOTE: runStateModelPass is resolved at call-time via globalThis to avoid a
 * circular import. This will be cleaned up when index.js is split.
 */

import { getSettings, hydrateWorldProgressionFromChatState, persistWorldProgressionTimer, persistRouterLastRunWatermark, persistMapUpdaterLastRunTimestamp, persistMapUpdaterLastRunWatermark, persistMapUpdaterState, getNpcRelationshipMax, clampRelationshipValue, relationshipBarPct, getFriendshipTier, getAffectionTier, applyRelTierBadgeElement, showRelationshipFloatFeedback, saveChatState, getActiveChatId, getRelationshipUpdateMode, RELATIONSHIP_UPDATE_MODES, shouldProcessRegexRelationshipUpdates, stripCoreMarkersForNarrator } from './state-manager.js';
import { syncCombatProfile, isCombatActive } from './llm-client.js';
import { parseQuestsFromMemo, extractCurrentTimeStr, cleanMessageContent, formatInWorldTime, memoForGmContext, stripPromptInjectionsFromUserText, stripCyoaAndPacingInjections } from './memo-processor.js';
import { runRouterPass, saveSceneToLorebook, scanAssistantOutputForKeywords, parseInWorldMinutes, runWorldProgressionPass, updateLorebookEntry, getLorebookManifest, rollbackRouterPass, isRouterRunning, syncDungeonMapsToLocationLorebook } from './router.js';
import { getActiveMapUpdaterSiteRoot, maybeRollbackMapUpdaterForSwipe, runMapUpdaterPass, shouldForceBuildingPopulationPass, stopMapUpdaterPass } from './map-updater.js';
import { maybeRollbackMapEvolutionForSwipe, maybeRunMapEvolution, stopMapEvolutionPass } from './map-evolution.js';
import { formatNarratorSiteActivity } from './map-evolution-lib.js';
import { shiftMemoAndMapHistory } from './src/state/dungeon-map-history.js';
import { logTransaction } from './debug-viewer.js';
import { recordSchedulerEvent } from './swipe-scheduler-debug.js';
import { saveSettings } from './src/app/runtime-bridge.js';
import { runtimeState } from './src/app/runtime-state.js';
import { isPercentFormula, resolveDiceCompare } from './src/state/dice-compare.js';
import { buildCyoaModeBlock, STATE_MEMO_INJECT_PREAMBLE } from './constants.js';
import { isCyoaEnabled, isLorebookAgentRuntimeActive, isLocationMappingEnabled } from './src/state/section-enabled.js';
import { buildNarrativeModeTags, hasInjectableNarrativePacing } from './src/state/narrative-pacing.js';
import {
    buildDungeonRealityInjection,
    buildMappedSitesInjection,
    findLatestDungeonLocation,
    getDungeonMessageText,
    getSiteRootFromLocation,
    looksLikeDungeonSite,
    normalizeDungeonLabel,
    resolveActiveDungeonSite,
    resolveMentionedDungeonSites,
    stripCapturedDungeonMapsFromPrompt,
    stripDungeonRealityBlocksFromPrompt,
} from './dungeon-reality.js';
import { runMapArchitect } from './map-architect.js';
import {
    applyMapArchitectTextOpenerCyoaCaveat,
    buildMapArchitectContinueBrief,
    clearAssistantReasoning,
    createAreaMapCommandIsComplete,
    isMapArchitectTextOpener,
    seedMapArchitectContinueText,
    stripCreateAreaMapCommand,
} from './map-architect-opener.js';
export { isPercentFormula, resolveDiceCompare };

const dungeonMissingMapWarnings = new Set();
let _pendingMapArchitectResult = null;
let _mapArchitectTextOpenerBusy = false;
let _mapArchitectNarrationContinue = false;

/** Keep mapped root lore visible while its root is active or named exactly this turn. */
function syncDungeonLoreAgentActivation(settings, dungeonState, currentLocation, mentionedSites = []) {
    const mappedIds = new Set(Object.values(dungeonState?.sites || {}).map(site => site?.entryId).filter(Boolean));
    const activeSite = resolveActiveDungeonSite(dungeonState, currentLocation);
    const wantedIds = new Set([
        activeSite?.entryId,
        ...mentionedSites.map(site => site?.entryId),
    ].filter(Boolean));
    const pinned = new Set(settings.pinnedRouterKeys || []);
    const before = JSON.stringify({
        active: settings.activeRouterKeys || [],
        keyword: settings.keywordActivatedKeys || [],
    });
    settings.activeRouterKeys = (settings.activeRouterKeys || [])
        .filter(id => !mappedIds.has(id) || wantedIds.has(id) || pinned.has(id));
    for (const wantedId of wantedIds) {
        if (!settings.activeRouterKeys.includes(wantedId)) settings.activeRouterKeys.push(wantedId);
    }
    // Exact map-name mentions are owned by this turn's map layer, not the
    // general keyword pool (which supports aliases and substring hits).
    if (Array.isArray(settings.keywordActivatedKeys)) {
        settings.keywordActivatedKeys = settings.keywordActivatedKeys.filter(id => !mappedIds.has(id));
    }
    const after = JSON.stringify({
        active: settings.activeRouterKeys || [],
        keyword: settings.keywordActivatedKeys || [],
    });
    if (before !== after) void saveSettings();
    return activeSite;
}

/** Write plain text back onto a chat message (string or multimodal content). */
function setChatMessageText(msg, text) {
    if (!msg) return;
    if (typeof msg.content === 'string') {
        msg.content = text;
    } else if (Array.isArray(msg.content)) {
        const nonText = msg.content.filter(p => p && p.type !== 'text');
        msg.content = [{ type: 'text', text }, ...nonText];
    }
    if (typeof msg.mes === 'string' || msg.mes == null) {
        msg.mes = text;
    }
}

/**
 * Strip prior CYOA/pacing from older user turns; recover raw typed text on the
 * current user turn so pacing + CYOA + RNG can be freshly re-injected.
 * @param {object[]} chat
 * @param {number} currentUserIdx
 */
function prepareUserMessagesForContextInject(chat, currentUserIdx) {
    if (!Array.isArray(chat)) return;
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (!m) continue;
        const role = String(m.role || '').toLowerCase();
        const isUser = m.is_user || role === 'user' || role === 'human' || role === 'player';
        if (!isUser) continue;

        const raw = extractTextContent(m);
        if (i === currentUserIdx) {
            setChatMessageText(m, stripPromptInjectionsFromUserText(raw));
        } else {
            const cleaned = stripCyoaAndPacingInjections(raw);
            if (cleaned !== raw) setChatMessageText(m, cleaned);
        }
    }
}

/**
 * Remove leftover CYOA / narrative-pacing tags from the outgoing prompt copy
 * when the State Tracker master toggle is off (do not mutate persisted chat).
 * @param {object[]} chat
 */
function stripLeftoverCyoaAndPacingFromPrompt(chat) {
    if (!Array.isArray(chat)) return;
    for (const m of chat) {
        if (!m) continue;
        const role = String(m.role || '').toLowerCase();
        const isUser = m.is_user || role === 'user' || role === 'human' || role === 'player';
        if (!isUser) continue;
        const raw = extractTextContent(m);
        const cleaned = stripCyoaAndPacingInjections(raw);
        if (cleaned !== raw) setChatMessageText(m, cleaned);
    }
}

/** Resolve ST macros (e.g. {{user}}) in lore text at injection time — storage keeps macros verbatim. */
function substituteLoreMacros(content) {
    if (!content) return '';
    try {
        const substituteParams = SillyTavern.getContext()?.substituteParams;
        return typeof substituteParams === 'function' ? substituteParams(content) : content;
    } catch (_) {
        return content;
    }
}

/**
 * Resolve Control Room / unlocked state for `<end_of_output_footer>`.
 * @param {object} settings
 * @returns {{ enabled: boolean, inner: string }}
 */
function resolveEndOfOutputFooterSection(settings) {
    const library = settings.customSyspromptLibrary || [];
    const override = library.find(p =>
        p.origin === 'unlocked_base'
        && p.baseTag === 'end_of_output_footer'
        && p._chatSetupMember !== false,
    );
    if (override) {
        const raw = String(override.content || '').trim();
        const innerMatch = raw.match(/<end_of_output_footer>([\s\S]*?)<\/end_of_output_footer>/i);
        return { enabled: !!override.enabled, inner: (innerMatch ? innerMatch[1] : raw).trim() };
    }

    const enabled = settings.syspromptModules?.end_of_output_footer !== false;
    if (!enabled) return { enabled: false, inner: '' };

    // Prefer the live Main prompt (already Control-Room-assembled + time-format transforms).
    const mainTa = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('main_prompt_quick_edit_textarea'));
    const mainVal = mainTa?.value || '';
    const liveMatch = mainVal.match(/<end_of_output_footer>([\s\S]*?)<\/end_of_output_footer>/i);
    if (liveMatch) return { enabled: true, inner: liveMatch[1].trim() };

    // Fallback: shipped default body with the same time/date transforms as transformBaseSectionContent.
    let inner = `ALWAYS end every output (even after tool chains) with:
*(Status: [HP]) | (XP: [current]/[next level]) | (Location: [Main, Sub, Sub-sub, etc])*
*Level [X] | [HH:MM AM/PM], Day [X]*
Footer shows ONLY {{user}}'s HP/XP/level/location — never party/NPC status or names.
Location is coarse-to-fine and may be four or more tiers.

- For an unmapped settlement building use Settlement, District, Building.
- Never refer to unmapped BUILDINGs positionally in the footer (e.g. "Main Street, General Store rear loading dock".) Either "Main Street" or "Main Street, General Store" if actually inside.`;
    if (settings.use24hTime) {
        inner = inner.replace(/\[HH:MM AM\/PM\]/g, '[HH:MM] (24-hour clock, NO AM/PM)');
    }
    if (settings.useDdMmYyFormat) {
        inner = inner.replace(/Day\s+\[X\]/g, '[DD/MM/YYYY]');
    }
    return { enabled: true, inner };
}

/**
 * Take only the footer format that follows the first "with" in the section body.
 * @param {string} inner
 * @returns {string}
 */
function extractFooterFormatAfterWith(inner) {
    if (!inner) return '';
    const m = String(inner).match(/\bwith\b\s*:?\s*([\s\S]*)/i);
    return (m ? m[1] : '').trim();
}

/**
 * Stealth end-of-output footer reminder for the first user turn of a chat.
 * Honors System Prompt Control Room enable/disable and uses the live section's
 * format (the part after "with") instead of a hardcoded template.
 * @param {object} settings
 * @returns {string} empty when footer section is disabled or has no format
 */
function buildEndOfOutputFooterReminder(settings) {
    const { enabled, inner } = resolveEndOfOutputFooterSection(settings);
    if (!enabled) return '';

    const afterWith = extractFooterFormatAfterWith(inner);
    if (!afterWith) return '';

    const block = `<end_of_output_footer>
ALWAYS end every output (even after tool chains) with:
${afterWith}
</end_of_output_footer>

`;
    return substituteLoreMacros(block);
}

/** @param {any[]} chat */
function countUserMessagesInChat(chat) {
    if (!Array.isArray(chat)) return 0;
    let n = 0;
    for (const m of chat) {
        if (m?.is_user) {
            n++;
            continue;
        }
        const role = String(m?.role || m?.Role || '').toLowerCase().trim();
        if (role === 'user') n++;
    }
    return n;
}

/** True when this generation is the chat's first user turn (inject footer once). */
function shouldInjectEndOfOutputFooterReminder(chat, content) {
    if (content && content.includes('<end_of_output_footer>')) return false;
    return countUserMessagesInChat(chat) <= 1;
}

// ── Dice naming helpers ────────────────────────────────────────────────────────

export function getDiceToolName() {
    const settings = getSettings();
    return settings.diceD100Mode ? 'RollTheDiceD100' : 'RollTheDice';
}

export function getDiceCommandName() {
    return 'roll';
}

export function getDiceCommandAliases() {
    return ['r'];
}

// ── RNG Engine ─────────────────────────────────────────────────────────────────

export const RNG_QUEUE_LEN = 12;
export const RNG_QUEUE_VERSION = 'v7.0';
export const RNG_QUEUE_TAG_D20 = `[RNG_QUEUE ${RNG_QUEUE_VERSION}]`;
export const RNG_QUEUE_TAG_D100 = `[RNG_QUEUE_d100 ${RNG_QUEUE_VERSION}]`;

export function rollDie(sides) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(4294967296 / sides) * sides;
    let roll;
    do { crypto.getRandomValues(buf); roll = buf[0]; } while (roll >= limit);
    return (roll % sides) + 1;
}

export function makeRngQueue(n, forceD100) {
    const settings = getSettings();
    const d100Mode = forceD100 !== undefined ? !!forceD100 : !!settings.diceD100Mode;
    const len = n !== undefined && n !== RNG_QUEUE_LEN ? n : (d100Mode ? 30 : RNG_QUEUE_LEN);
    const out = [];
    for (let i = 0; i < len; i++) {
        if (d100Mode) {
            out.push({
                d100: rollDie(100),
            });
        } else {
            out.push({
                d20: rollDie(20),
                d4:  rollDie(4),
                d6:  rollDie(6),
                d8:  rollDie(8),
                d10: rollDie(10),
                d12: rollDie(12),
            });
        }
    }
    return out;
}

export function formatRngQueueLine(lineNum, dice, d100Mode = false) {
    if (d100Mode) {
        return `${lineNum}: d100=${dice.d100}`;
    }
    return `${lineNum}: d20=${dice.d20} d4=${dice.d4} d6=${dice.d6} d8=${dice.d8} d10=${dice.d10} d12=${dice.d12}`;
}

export function buildRngBlock(queue, d100Mode = false) {
    const turnId = Date.now();
    const lines = queue.map((dice, i) => formatRngQueueLine(i + 1, dice, d100Mode));
    if (d100Mode) {
        return `${RNG_QUEUE_TAG_D100}\nturn_id=${turnId}\nscope=this_response\n${lines.join('\n')}\n[/RNG_QUEUE_d100]\n\n`;
    }
    return `${RNG_QUEUE_TAG_D20}\nturn_id=${turnId}\nscope=this_response\n${lines.join('\n')}\n[/RNG_QUEUE]\n\n`;
}

// ── Dice rolling ───────────────────────────────────────────────────────────────

/**
 * Rolls a single die-group term (e.g. "2d6kh1", "d20", "3d8dl1") and returns
 * the sum of the kept dice, plus an array of all individual raw rolls.
 * Returns null if the token isn't a valid die-group.
 */
function rollSingleGroup(token) {
    // Matches: optional count, dSides, optional keep/drop op, optional trailing int modifiers
    const regex = /^([1-9]\d*)?d([1-9]\d*)(?:([kd][hl]?)([1-9]\d*))?((?:[+-]\d+)*)$/i;
    const match = token.match(regex);
    if (!match) return null;

    const numDice = match[1] ? parseInt(match[1], 10) : 1;
    const numSides = parseInt(match[2], 10);
    const opType   = match[3] ? match[3].toLowerCase() : null;
    const opCount  = match[4] ? parseInt(match[4], 10) : 0;
    const modifierStr = match[5] || '';

    if (numDice > 100) return null;

    const rolls = [];
    for (let i = 0; i < numDice; i++) rolls.push(rollDie(numSides));

    let keptRolls = [...rolls];
    if (opType && opCount > 0) {
        keptRolls.sort((a, b) => a - b);
        if (opType.startsWith('k')) {
            keptRolls = opType === 'kl'
                ? keptRolls.slice(0, opCount)
                : keptRolls.slice(-opCount);
        } else if (opType.startsWith('d')) {
            keptRolls = opType === 'dh'
                ? keptRolls.slice(0, Math.max(0, numDice - opCount))
                : keptRolls.slice(opCount);
        }
    }

    let modifier = 0;
    const modMatches = modifierStr.match(/[+-]\d+/g);
    if (modMatches) {
        for (const m of modMatches) modifier += parseInt(m, 10);
    }

    return {
        kept: keptRolls.reduce((s, v) => s + v, 0) + modifier,
        rolls,
    };
}

/**
 * Parses and rolls a (possibly compound) dice formula such as:
 *   "1d20+1d4+10"  →  rolls 1d20, rolls 1d4, adds flat 10
 *   "2d6kh1-1"     →  keep-highest-1 of 2d6, subtract 1
 *   "d20+7"        →  simple 1d20 + 7
 *
 * Returns { total: string, rolls: string[] } or null if the formula is invalid.
 * The `rolls` array contains every individual raw die value across all groups,
 * in left-to-right order.
 */
function parseAndRoll(formula) {
    const cleanFormula = formula.replace(/\s+/g, '');

    // Tokenise into signed terms: split on + or - that is NOT inside a die-group's
    // trailing modifier (we re-attach the sign to each token for signed integers).
    // Strategy: split on any + or - that is preceded by a digit (end of a term).
    const tokenRegex = /([+-]?(?:[1-9]\d*)?d[1-9]\d*(?:[kd][hl]?[1-9]\d*)?(?:[+-]\d+)*|[+-]?\d+)/gi;
    const tokens = cleanFormula.match(tokenRegex);

    // Must have at least one token and the whole formula must be covered
    if (!tokens || tokens.join('').replace(/\+/g, '').length !== cleanFormula.replace(/\+/g, '').length) {
        // Fallback: try legacy single-group path for full backwards compat
        return rollSingleGroup(cleanFormula);
    }

    // Need at least one die-group for this to be meaningful
    const hasDie = tokens.some(t => /d/i.test(t));
    if (!hasDie) return null;

    let total = 0;
    const allRolls = [];

    for (const rawToken of tokens) {
        // Determine sign prefix
        const sign   = rawToken.startsWith('-') ? -1 : 1;
        const token  = rawToken.replace(/^[+-]/, '');

        if (/d/i.test(token)) {
            // Die group
            const result = rollSingleGroup(token);
            if (!result) return null;           // malformed — abort entirely
            total += sign * result.kept;
            for (const r of result.rolls) allRolls.push(String(sign < 0 ? -r : r));
        } else {
            // Plain integer
            const n = parseInt(token, 10);
            if (isNaN(n)) return null;
            total += sign * n;
        }
    }

    return {
        total: String(total),
        rolls: allRolls,
    };
}

/**
 * Some callers (usually an LLM tool call) mangle the formula by joining
 * multiple die groups with a comma instead of `+` (e.g. "1d20+1,1d20+1"),
 * often just the same formula repeated. Since the tool only ever returns a
 * single result, we recover by taking the first comma-separated segment
 * that parses as a valid formula, rather than failing the whole roll.
 * Returns the original string unchanged if there's no comma.
 */
function sanitizeFormula(value) {
    if (!value.includes(',')) return value;
    const parts = value.split(',').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
        if (parseAndRoll(part) || (SillyTavern.libs.droll && SillyTavern.libs.droll.validate(part))) {
            return part;
        }
    }
    return parts[0] || value;
}

export async function doDiceRoll(customDiceFormula, quiet = false) {
    const settings = getSettings();
    const d100Mode = !!settings.diceD100Mode;
    const defaultFormula = d100Mode ? '1d100' : '1d20';
    const nullValue = { total: '', rolls: [] };
    let value = typeof customDiceFormula === 'string' ? customDiceFormula.trim() : defaultFormula;

    if (value === 'custom') {
        const { Popup } = SillyTavern.getContext();
        value = await Popup.show.input('Enter the dice formula:<br><i>(for example, <tt>2d6</tt>)</i>', '', 'Roll', { cancelButton: 'Cancel' });
    }

    if (!value) return nullValue;

    value = sanitizeFormula(value);

    // Try custom/advanced parser first
    const customResult = parseAndRoll(value);
    if (customResult) {
        if (!quiet) {
            const context = SillyTavern.getContext();
            context.sendSystemMessage('generic', `${context.name1} rolls a ${value}. The result is: ${customResult.total} (${customResult.rolls.join(', ')})`, { isSmallSys: true });
        }
        return { ...customResult, formula: value };
    }

    // Fall back to standard droll library
    const droll = SillyTavern.libs.droll;
    if (droll) {
        const isValid = droll.validate(value);
        if (isValid) {
            const result = droll.roll(value);
            if (result) {
                if (!quiet) {
                    const context = SillyTavern.getContext();
                    context.sendSystemMessage('generic', `${context.name1} rolls a ${value}. The result is: ${result.total} (${result.rolls.join(', ')})`, { isSmallSys: true });
                }
                return { total: String(result.total), rolls: result.rolls.map(String), formula: value };
            }
        }
    } else {
        toastr['error']('Dice library (droll) not found.');
    }

    // Failsafe: never return empty/zero — that would auto-fail any DC check.
    toastr['warning'](`Invalid dice formula "${value}" — defaulting to ${defaultFormula}.`);
    const fallbackRoll = rollDie(d100Mode ? 100 : 20);
    if (!quiet) {
        const context = SillyTavern.getContext();
        context.sendSystemMessage('generic', `${context.name1} tried to roll an invalid formula ("${value}"), defaulting to ${defaultFormula}. The result is: ${fallbackRoll}`, { isSmallSys: true });
    }
    return { total: String(fallbackRoll), rolls: [String(fallbackRoll)], formula: defaultFormula, invalidFormula: value };
}

// ── Tool & slash command registration ─────────────────────────────────────────

/**
 * Shared RollTheDice / RollTheDiceD100 action body.
 * @param {object} args
 * @param {{ defaultFormula?: string, forceLte?: boolean, isLegacy?: boolean }} [opts]
 */
async function executeDiceToolAction(args, opts = {}) {
    const isLegacy = !!opts.isLegacy;
    const requestedFormula = args?.formula || opts.defaultFormula || (isLegacy ? '1d6' : '1d20');
    const roll = await doDiceRoll(requestedFormula, true);
    const total = parseInt(roll.total) || 0;
    const formula = roll.formula || requestedFormula;
    const invalidNote = roll.invalidFormula
        ? ` (requested formula "${roll.invalidFormula}" was invalid, defaulted to ${formula})`
        : '';

    if (isLegacy) {
        return (args.who
            ? `${args.who} rolls a ${formula}. The result is: ${total}. Individual rolls: ${roll.rolls.join(', ')}`
            : `The result of a ${formula} roll is: ${total}. Individual rolls: ${roll.rolls.join(', ')}`) + invalidNote;
    }

    const dc = Number(args?.dc) || 0;
    const compare = opts.forceLte ? 'lte' : resolveDiceCompare(args?.compare, formula);
    const forStr = args.for ? ` (${args.for})` : ''
    let result = (args.who
        ? `${args.who}${forStr} rolls a ${formula} against DC ${dc}. The result is: ${total}. Individual rolls: ${roll.rolls.join(', ')}`
        : `The result${forStr} of a ${formula} roll against DC ${dc} is: ${total}. Individual rolls: ${roll.rolls.join(', ')}`) + invalidNote;

    if (dc > 0) {
        if (compare === 'lte') {
            const success = total <= dc;
            result += ` (Result: ${total} ≤ ${dc}% → ${success ? 'HIT' : 'MISS'})`;
        } else {
            const success = total >= dc;
            result += ` (Result: ${success ? 'SUCCESS' : 'FAILURE'})`;
        }
    }
    return result;
}

export function registerMapArchitectTool() {
    try {
        const ctx = SillyTavern.getContext();
        const { registerFunctionTool, unregisterFunctionTool } = ctx;
        if (!registerFunctionTool || !unregisterFunctionTool) return;
        unregisterFunctionTool('CreateDungeonMap');
        unregisterFunctionTool('CreateAreaMap');

        const settings = getSettings();
        if (!isLocationMappingEnabled(settings)) return;
        if (isMapArchitectTextOpener(settings)) return;
        registerFunctionTool({
            name: 'CreateAreaMap',
            displayName: 'Map Architect',
            description: 'Create and save one private objective map. You are also a soft map editor: a map may be created and attached from anywhere, without moving the player and without first creating a BUILDING. For a standalone map, omit attachTo. For a nested map, set attachTo.site to the exact existing parent map and attachTo.cell to the exact parent AREA that receives the gateway. site names the new child map; attachTo.cell names where it belongs, so similar names such as Cellar Crypt and Cellar Crypt Dungeon remain different. Example: site="Cellar Crypt Dungeon", attachTo={site:"Malarkey Monument", cell:"Cellar Crypt"}. Request only DUNGEON, INTERIOR, or SETTLEMENT; runtime creates/promotes the appropriate SUB* gateway, canonical path, host metadata, and inactive-parent edit. Explicit attachTo never changes the Location footer or implies entry. Nesting is limited to three mapped levels. If attachTo is omitted while a mapped site is active, runtime may use the active cell as shorthand. Never create placeholder structures, move the party merely to authorize creation, map OBJECT props/wilderness/roads/districts, or call again after success. include[] remains creation-only for a new SETTLEMENT that absorbs exact standalone DUNGEON/INTERIOR peers.',
            parameters: {
                type: 'object',
                properties: {
                    site: { type: 'string', description: 'Exact name of the map being created. This is not the parent map or parent cell. Copy it character-for-character; never translate or retitle it.' },
                    entrance: { type: 'string', description: 'Exact first area inside the new map: a gate, threshold, landing, door, square, or docks. Never translate it. Explicit offsite attachment leaves it UNREVEALED; active-location creation marks it VISITED.' },
                    kind: { type: 'string', enum: ['DUNGEON', 'SETTLEMENT', 'INTERIOR'], description: 'DUNGEON = high-risk room-scale site. INTERIOR = significant lower-risk multi-room site. SETTLEMENT = city/town/village district-scale graph.' },
                    scale: { type: 'string', enum: ['SMALL', 'MEDIUM', 'LARGE'], description: 'Geographic size, not danger. DUNGEON: SMALL 4-7 rooms, MEDIUM 7-12, LARGE 12-20. SETTLEMENT: SMALL 4-7 districts, MEDIUM 6-10, LARGE 8-14.' },
                    threat: { type: 'string', enum: ['NONE', 'LOW', 'MODERATE', 'HIGH', 'DEADLY'], description: 'Site danger for occupancy and trap density. NONE forbids invented active danger. Independent of party level and scale.' },
                    prompt: { type: 'string', description: 'Complete private map-generation guidance: purpose/history, topology, expected inhabitants or danger, tone, and anything that must not be contradicted. This can be detailed. Prompt facts do not by themselves grant player knowledge.' },
                    brief_description: { type: 'string', description: 'Brief current description of the site. This is stored as the parent SUBDUNGEON/SUBINTERIOR gateway detail and may be used for the Location CORE; do not copy the full prompt.' },
                    attachTo: {
                        type: 'object',
                        additionalProperties: false,
                        description: 'Optional structural address for a nested map. Use it from any player location. Omit it only for a standalone map or when deliberately using the active-cell shorthand.',
                        properties: {
                            site: { type: 'string', description: 'Exact canonical name/path of the existing parent map being edited.' },
                            cell: { type: 'string', description: 'Exact existing AREA name on the parent map that receives the new map gateway. No BUILDING or asset is required.' },
                        },
                        required: ['site', 'cell'],
                    },
                    include: { type: 'array', items: { type: 'string' }, description: 'Optional only for first creation of a SETTLEMENT. Exact existing mapped DUNGEON/INTERIOR names to absorb as SUBDUNGEON/SUBINTERIOR peers.' },
                },
                required: ['site', 'entrance', 'kind', 'scale', 'threat', 'prompt', 'brief_description'],
            },
            action: async args => runMapArchitect(args),
            // Map Architect owns one persistent lifecycle toast. Returning no
            // tool-call message prevents SillyTavern from showing a duplicate.
            formatMessage: () => '',
        });
    } catch (error) {
        console.warn('[RPG Tracker] Could not register Map Architect tool:', error);
    }
}

/** Unregister CreateAreaMap and abort Map Updater / Map Evolution when Persistent Maps is off. */
export function syncLocationMappingRuntime() {
    registerMapArchitectTool();
    if (isLocationMappingEnabled(getSettings())) return;
    stopMapUpdaterPass();
    stopMapEvolutionPass();
    if (runtimeState.hasActiveDungeonMap) {
        runtimeState.hasActiveDungeonMap = false;
        globalThis._rpgSyncAgentImmersionUi?.();
        void globalThis._rpgRefreshImmersionView?.();
    }
}

export function registerDiceFunctionTool() {
    try {
        const ctx = SillyTavern.getContext();
        const { registerFunctionTool, unregisterFunctionTool } = ctx;
        if (!registerFunctionTool || !unregisterFunctionTool) return;

        unregisterFunctionTool('RollTheDice');
        unregisterFunctionTool('RollTheDiceD100');
        unregisterFunctionTool('FatbodyRollTheDice');
        unregisterFunctionTool('MultihogRollTheDice');

        const settings = getSettings();
        const isLegacy = settings.legacyDiceNaming;

        // Unified roller: skill/attack DCs (gte) and percentage/existence checks (lte / 1d100).
        // Global d100 Mode still uses RollTheDiceD100 below; it is not removed.
        if (settings.rngToolD20) {
            const baseFormula = '1d20';
            const formulaDescription = `A SINGLE dice formula to roll per invocation, e.g. "${baseFormula}", "1d100", "2d6+3", "${baseFormula}+5". Supports one or more die groups joined by + or - (e.g. "${baseFormula}+1d4+2"), and keep/drop modifiers (e.g. "2d20kh1" for advantage, "2d20kl1" for disadvantage). Provide EXACTLY ONE formula string per call — do NOT comma-separate multiple formulas in one invocation. When several independent rolls are needed, issue multiple parallel RollTheDice invocations in the same turn (e.g. initiative for each combatant, existence check then detection, or random-event occurrence + type). Use formula "1d100" with compare "lte" for percentage / existence checks.`;

            const rollDiceSchema = isLegacy ? {
                type: 'object',
                properties: {
                    who: { type: 'string', description: 'The name of the persona rolling the dice' },
                    formula: { type: 'string', description: formulaDescription.replace(baseFormula, '1d6') },
                },
                required: ['who', 'formula'],
            } : {
                type: 'object',
                properties: {
                    who: { type: 'string', description: 'The name of the persona rolling the dice' },
                    for: { type: 'string', description: 'What is being rolled for, 1-3 words' },
                    formula: { type: 'string', description: formulaDescription },
                    dc: { type: 'number', description: 'For skill/attack checks (compare=gte): Difficulty Class — roll ≥ dc = SUCCESS. For percentage / existence checks (compare=lte or formula 1d100): the trigger % chance — roll ≤ dc = HIT. Always pass the probability directly (e.g. 35 for Dangerous-tier existence). Anchors difficulty BEFORE the roll is made.' },
                    compare: { type: 'string', description: 'Optional. "gte" (default for non-d100 formulas): roll ≥ dc = SUCCESS. "lte" (default for 1d100 / percentage formulas): roll ≤ dc% = HIT. Use lte for existence checks and other percentage odds.' },
                },
                required: ['who', 'for', 'formula', 'dc'],
            };

            registerFunctionTool({
                name: 'RollTheDice',
                displayName: isLegacy ? 'Dice Roll' : 'Dice Roll (with DC)',
                description: 'Rolls dice using the provided formula and returns the numeric result. Use for skill/attack checks (1d20+mod vs DC, compare gte) and percentage / existence checks (1d100 vs %, compare lte). Each invocation takes one formula. For multiple independent rolls, issue parallel invocations in the same turn — never comma-join formulas into one call.',
                parameters: rollDiceSchema,
                action: async (args) => executeDiceToolAction(args, {
                    defaultFormula: isLegacy ? '1d6' : '1d20',
                    isLegacy,
                }),
                formatMessage: () => '',
            });
        }

        // Explicit global d100 Mode / dedicated d100 tool — kept for percentage-based rulesets.
        // Thin alias of the unified roller with forced 1d100 + lte semantics.
        if (settings.rngToolD100) {
            const baseFormula = '1d100';
            const formulaDescription = `A SINGLE dice formula to roll per invocation, e.g. "${baseFormula}", "2d6+3", "${baseFormula}+5". Supports one or more die groups joined by + or - (e.g. "${baseFormula}+1d4+2"), and keep/drop modifiers. Provide EXACTLY ONE formula string per call — do NOT comma-separate multiple formulas in one invocation. When several independent rolls are needed, issue multiple parallel RollTheDiceD100 invocations in the same turn.`;

            const rollDiceSchema = {
                type: 'object',
                properties: {
                    who: { type: 'string', description: 'The name of the persona rolling the dice' },
                    for: { type: 'string', description: 'What is being rolled for, 1-3 words' },
                    formula: { type: 'string', description: formulaDescription },
                    dc: { type: 'number', description: 'The success/trigger percentage chance for this roll (roll-under system). Set this to the actual % probability of success or occurrence (e.g. 83 for an 83% chance to hit/succeed, or 25 for a 25% hazard failure chance). A roll ≤ dc = HIT/SUCCESS/TRIGGER, a roll > dc = MISS/FAILURE/NO-TRIGGER. Do NOT invert the percentage — always pass the probability directly.' },
                },
                required: ['who', 'for', 'formula', 'dc'],
            };

            registerFunctionTool({
                name: 'RollTheDiceD100',
                displayName: 'Dice Roll d100 (with DC)',
                description: 'Rolls a d100 (1-100) using the provided formula and returns the numeric result. Use for percentage-based rulesets (global d100 Mode) and percentage probability checks. Each invocation takes one formula (e.g. "1d100"). For multiple independent rolls, issue parallel invocations in the same turn. The dc parameter is the direct success/trigger percentage (roll ≤ dc = success). In a normal d20 game, prefer RollTheDice with formula "1d100" and compare "lte" instead.',
                parameters: rollDiceSchema,
                action: async (args) => executeDiceToolAction(args, {
                    defaultFormula: '1d100',
                    forceLte: true,
                }),
                formatMessage: () => '',
            });
        }
    } catch (error) {
        console.error('[RPG Tracker] Error registering dice function tools', error);
    }
}

/**
 * Keeps function-tool visibility aligned with managed hybrid RNG context.
 * During combat the queue is the only mechanic, so remove the dice schemas;
 * outside combat restore the user's configured dice tools.
 */
export function syncDiceFunctionToolForRngContext(memo, manageHybrid = false) {
    if (!manageHybrid || !isCombatActive(memo)) {
        registerDiceFunctionTool();
        return;
    }

    try {
        const { unregisterFunctionTool } = SillyTavern.getContext();
        if (!unregisterFunctionTool) return;
        unregisterFunctionTool('RollTheDice');
        unregisterFunctionTool('RollTheDiceD100');
        unregisterFunctionTool('FatbodyRollTheDice');
        unregisterFunctionTool('MultihogRollTheDice');
    } catch (e) {
        console.warn('[RPG Tracker] Failed to unregister combat-disabled dice tools:', e);
    }
}

export function registerDiceSlashCommand() {
    const { SlashCommand, SlashCommandParser, ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } = SillyTavern.getContext();
    if (!SlashCommand || !SlashCommandParser) return;

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: getDiceCommandName(),
        aliases: getDiceCommandAliases(),
        callback: async (args, value) => {
            const quiet = String(args.quiet) === 'true';
            const s = getSettings();
            const defaultFormula = s.diceD100Mode ? '1d100' : (s.legacyDiceNaming ? '1d6' : '1d20');
            const result = await doDiceRoll(String(value || defaultFormula), quiet);
            return result.total;
        },
        helpString: 'Roll the dice.',
        returns: 'roll result',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Do not display the result in chat',
                isRequired: false,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'dice formula, e.g. 2d6',
                isRequired: true,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lorebookagent',
        aliases: ['lbagent', 'la', 'router'],
        callback: async (args, value) => {
            const settings = getSettings();
            const quiet = String(args.quiet) === 'true';
            const raw = String(value || '').trim();
            const lower = raw.toLowerCase();

            if (lower.startsWith('save')) {
                const hint = raw.slice(4).trim();
                await saveSceneToLorebook(hint);
                return 'Scene save requested.';
            }

            if (!isLorebookAgentRuntimeActive(settings)) {
                return 'Lorebook Agent is disabled.';
            }
            if (isRouterRunning()) {
                return 'Lorebook Agent is already running.';
            }

            /** @type {string|null} */
            let manualPrompt = null;
            /** @type {number|null} */
            let lookback = null;

            const lookbackRaw = args.lookback;
            if (lookbackRaw !== undefined && lookbackRaw !== null && String(lookbackRaw).trim() !== '') {
                const parsed = parseInt(String(lookbackRaw), 10);
                if (Number.isFinite(parsed) && parsed >= 1) lookback = parsed;
            }

            if (lower === '' || lower === 'run' || lower === 'research') {
                // null lookback → configured since-last-run / since-last-user / fixed lookback
                manualPrompt = null;
            } else {
                // Any other unnamed text is a Direct Command prompt
                manualPrompt = raw;
                if (lookback === null) lookback = settings.routerDirectLookback || 10;
            }

            const { chat } = SillyTavern.getContext();
            const combinedNarrative = getNarrativeBlocks(chat, -1, !!settings.routerIncludeHidden);
            if (!quiet && typeof toastr !== 'undefined') {
                toastr.info(
                    manualPrompt ? 'Running Lorebook Agent with specific command...' : 'Starting Lorebook Agent pass...',
                    'Lorebook Agent',
                );
            }
            await runRouterPass(combinedNarrative, manualPrompt, lookback, true);
            return manualPrompt ? 'Lorebook Agent command started.' : 'Lorebook Agent pass started.';
        },
        helpString: 'Run the Lorebook Agent (useful after /sendas, which does not auto-trigger it). '
            + 'Aliases: /la, /lbagent, /router. '
            + 'Usage: /lorebookagent | /lorebookagent run | /lorebookagent save [hint] | /lorebookagent &lt;direct command&gt;',
        returns: 'status message',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Suppress the toast notification',
                isRequired: false,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'lookback',
                description: 'Override lookback to N user turns (omit to use Lorebook Agent lookback settings)',
                isRequired: false,
                typeList: [ARGUMENT_TYPE.NUMBER],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'run | research | save [hint] | direct command text (omit to run a normal pass)',
                isRequired: false,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'statetracker',
        aliases: ['st'],
        callback: async (args, value) => {
            const settings = getSettings();
            const quiet = String(args.quiet) === 'true';
            const raw = String(value || '').trim();
            const lower = raw.toLowerCase();

            if (!settings.enabled) {
                return 'State Tracker is disabled.';
            }
            if (typeof globalThis._rpgStateModelRunning === 'function' && globalThis._rpgStateModelRunning()) {
                return 'State Tracker is already running.';
            }
            if (typeof globalThis._rpgRunStateModelPass !== 'function') {
                return 'State Tracker is not ready yet.';
            }

            /** @type {boolean} */
            let isFullAudit = false;
            /** @type {number|null} */
            let customLookbackN = null;

            const lookbackRaw = args.lookback;
            if (lookbackRaw !== undefined && lookbackRaw !== null && String(lookbackRaw).trim() !== '') {
                const parsed = parseInt(String(lookbackRaw), 10);
                if (Number.isFinite(parsed) && parsed >= 1) customLookbackN = parsed;
            }

            if (lower === 'full' || lower === 'audit') {
                isFullAudit = true;
            } else if (lower === '' || lower === 'run' || lower === 'regular' || lower === 'update') {
                // regular: since last user message (customLookbackN stays null unless lookback= was set)
            } else if (/^\d+$/.test(lower)) {
                customLookbackN = parseInt(lower, 10);
            } else if (lower.startsWith('lookback')) {
                const n = parseInt(lower.replace(/^lookback\s*/i, ''), 10);
                if (!Number.isFinite(n) || n < 1) {
                    return 'Usage: /statetracker lookback=N  or  /statetracker lookback N';
                }
                customLookbackN = n;
            } else {
                return 'Usage: /statetracker | /statetracker run | /statetracker full | /statetracker lookback=N';
            }

            const { chat } = SillyTavern.getContext();
            let narrative = '';
            if (isFullAudit) {
                narrative = '';
            } else if (customLookbackN !== null) {
                narrative = getNarrativeBlocks(chat, customLookbackN);
            } else {
                narrative = getNarrativeBlocks(chat, -1);
            }

            if (!isFullAudit && !narrative) {
                return 'No assistant message to parse.';
            }

            if (!quiet && typeof toastr !== 'undefined') {
                toastr.info(
                    isFullAudit ? 'Triggering Full Context Audit...' : 'Triggering manual State Update...',
                    'RPG Tracker',
                );
            }
            await globalThis._rpgRunStateModelPass(narrative, isFullAudit, customLookbackN);
            return isFullAudit ? 'State Tracker full audit started.' : 'State Tracker update started.';
        },
        helpString: 'Run the State Tracker update (useful after /sendas, which does not auto-trigger it). '
            + 'Alias: /st. '
            + 'Usage: /statetracker | /statetracker run | /statetracker full | /statetracker lookback=N',
        returns: 'status message',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Suppress the toast notification',
                isRequired: false,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'lookback',
                description: 'Parse the last N assistant narrative blocks instead of since the last user message',
                isRequired: false,
                typeList: [ARGUMENT_TYPE.NUMBER],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'run | regular | full | audit | lookback N | N (omit for a regular update)',
                isRequired: false,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'multihogresetui',
        aliases: ['rpgresetui', 'rtresetui'],
        callback: async (args) => {
            const quiet = String(args.quiet) === 'true';
            if (typeof globalThis._rpgResetTrackerUi !== 'function') {
                return 'UI reset is not ready yet.';
            }
            return globalThis._rpgResetTrackerUi({ quiet });
        },
        helpString: 'Emergency Multihog UI reset — rebuilds the State Tracker / Lorebook Agent panels and clears stuck layout (detached agent off-screen, missing tabs, hidden panel). Aliases: /rpgresetui, /rtresetui.',
        returns: 'status message',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Suppress the toast notification',
                isRequired: false,
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
            }),
        ],
    }));
}

// ── stripMemoHtml (local copy — canonical version moves to renderer.js in Phase 6) ──
function stripMemoHtml(text) {
    if (!text) return text;
    let stripped = text.replace(/<br\s*\/?>/gi, '\n');
    stripped = stripped.replace(/<[^>]+>/g, '');
    return stripped;
}

// ── Chat interceptor (registered on globalThis for ST manifest hook) ───────────

/**
 * Extracts the text content from a chat message regardless of format.
 * Chat Completion messages may store content as a string or as an array of
 * content parts (e.g. [{type:'text', text:'...'}] for multimodal presets).
 * Text Completion (legacy) messages use `mes` instead of `content`.
 */
function extractTextContent(msg) {
    const raw = msg['content'] ?? msg.mes ?? '';
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) {
        return raw.filter(p => p && p.type === 'text').map(p => p.text || '').join('\n');
    }
    return String(raw);
}

/** Latest explicit player text from the outgoing prompt copy. */
function findLatestPlayerInputText(chat) {
    if (!Array.isArray(chat)) return '';
    for (let index = chat.length - 1; index >= 0; index--) {
        const message = chat[index];
        const role = String(message?.role || message?.Role || '').toLowerCase().trim();
        if (message?.is_user || role === 'user' || role === 'human' || role === 'player') {
            return extractTextContent(message);
        }
    }
    return '';
}

/**
 * Formats a lorebook entry block for injection into the GM/narrator prompt.
 * Automatically prepends any active NPC relationship status values if relationship bars are enabled.
 */
function buildInjectedEntryText(id, entry, settings) {
    let content = stripCoreMarkersForNarrator(substituteLoreMacros(entry.content || ''));
    const rel = settings.npcRelationshipValues?.[id];
    if (rel && settings.npcRelationshipBars) {
        const relMax = getNpcRelationshipMax(settings);
        const friendship = rel.friendship ?? 0;
        const affection = rel.affection ?? 0;
        content = substituteLoreMacros(`Relationship with {{user}}: Friendship: ${friendship}/${relMax}, Affection: ${affection}/${relMax}\n${content}`);
    }
const label = entry.key?.[0] || entry.comment || id.split('::')[1];
    return `### [${label}]\n${content}\n\n`;
}

/**
 * Builds the [NPC_RELATIONS] context block summarising current relationship standings
 * for all active NPC lorebook entries. Injected at the top of each turn's context so
 * the narrator knows where it stands with present characters before writing.
 *
 * Only includes NPCs whose lorebook book name ends with _npcs / _npc (case-insensitive).
 * Returns an empty string if no relevant active entries exist.
 *
 * @param {ReturnType<typeof import('./state-manager.js').getSettings>} settings
 * @returns {Promise<string>}
 */
async function buildNpcRelationsBlock(settings) {
    if (!settings.npcRelationshipBars) {
        return '';
    }

    const relVals = settings.npcRelationshipValues || {};
    const activeKeys = [...(settings.activeRouterKeys || []), ...(settings.activeWorldKeys || [])];
    
    // Always return the placeholder if no keys are active to ensure the AI knows the feature is ON.
    if (!activeKeys.length) {
        return `[NPC_RELATIONS]\nNo established relationships yet.\n[/NPC_RELATIONS]\n\n`;
    }

    const ctx = SillyTavern.getContext();
    const lines = [];
    const bookCache = {};

    for (const id of activeKeys) {
        const [bookName, uid] = id.split('::');
        if (!bookName || !uid) continue;

        if (!bookCache[bookName]) {
            try { bookCache[bookName] = await ctx.loadWorldInfo(bookName); } catch (_) { bookCache[bookName] = null; }
        }
        const entry = bookCache[bookName]?.entries?.[uid];
        if (!entry) continue;

        // Strip any bracketed prefixes from the comment to get a clean display name
        const rawComment = entry.comment || '';
        const displayName = rawComment.replace(/^\[.*?\]\s*/i, '').trim();
        if (!displayName) continue;

        // Only include if they have a relationship tracked (prevents flooding context with non-NPC entries)
        if (!relVals[id]) continue;

        const rel = relVals[id];
        const relMax = getNpcRelationshipMax(settings);
        const f = rel.friendship ?? 0;
        const a = rel.affection ?? 0;
        const fStr = `Friendship ${f >= 0 ? '+' : ''}${f}`;
        const aStr = `Affection ${a >= 0 ? '+' : ''}${a}`;
        const fTier = getFriendshipTier(f, relMax);
        const aTier = getAffectionTier(a, relMax);
        lines.push(`${displayName}: ${fStr}, ${aStr}\n  Friendship tier: ${fTier.label} — ${fTier.hint}\n  Affection tier: ${aTier.label} — ${aTier.hint}`);
    }

    if (!lines.length) {
        return `[NPC_RELATIONS]\nNo established relationships yet.\n[/NPC_RELATIONS]\n\n`;
    }
    
    const relMax = getNpcRelationshipMax(settings);
    const header = substituteLoreMacros(`Current relationship standings between the protagonist and present NPCs. Both axes range from -${relMax} to +${relMax}. Let the tier descriptions below each NPC guide how they behave toward {{user}} this turn.`);

    return `[NPC_RELATIONS]\n${header}\n\n${lines.join('\n\n')}\n[/NPC_RELATIONS]\n\n`;
}

export function installInterceptor() {
    // The former Prompt Manager injection path was removed. Clear any flag left
    // behind by a hot-reloaded older build so this interceptor remains the one
    // authoritative source of tracker and player-character prompt injection.
    delete globalThis._rpgPromptManagerInterceptorActive;
    globalThis.rpgTrackerInterceptor = async function (chat, contextSize, abort, type) {
        const settings = getSettings();
        const dungeonEnabled = isLocationMappingEnabled(settings);

        // The manifest interceptor is the sole injection path.
        const skipInjection = false;

        // ── Swipe rollback: memo, then relationships, then lorebook agent ─────────────
        const _rbCtx = SillyTavern.getContext();
        const _rbChat = _rbCtx?.chat;
        const dungeonChatId = getActiveChatId();
        const replacingLatestNarratorMessage = ['swipe', 'regenerate']
            .includes(String(type || '').toLowerCase());
        let dungeonState = null;
        let dungeonInjection = '';

        // A disabled component must also neutralize hidden map/delta blocks
        // already present in the current prompt copy. Do not mutate the
        // persisted SillyTavern chat; the sanitizer only touches `chat` below.
        if (!dungeonEnabled && Array.isArray(chat)) {
            stripDungeonRealityBlocksFromPrompt(chat);
        }

        // Master power off: strip any leftover CYOA / pacing from the prompt
        // copy so prior injections cannot keep firing while powered down.
        if (!settings.enabled && Array.isArray(chat)) {
            stripLeftoverCyoaAndPacingFromPrompt(chat);
        }

        if (dungeonEnabled && dungeonChatId && Array.isArray(_rbChat)) {
            // A swipe/regeneration rejects the latest selected narrator message,
            // so read existing attachments but do not persist a map from it.
            const capture = await syncDungeonMapsToLocationLorebook(_rbChat, {
                capture: !replacingLatestNarratorMessage,
            });
            dungeonState = { version: 3, sites: capture.sites || {} };
            if (capture.changed) {
                console.info(`[RPG Tracker] Attached ${capture.capturedMaps} dungeon map(s) to root Location lorebook entries.`);
            }
            for (const error of capture.errors || []) {
                console.error(`[RPG Tracker] Dungeon Reality capture failed: ${error}. The map was left in chat context and was not discarded.`);
            }

            const currentLocation = findLatestDungeonLocation(_rbChat);
            const mappedSitesInjection = buildMappedSitesInjection(dungeonState.sites);
            const mentionedSites = resolveMentionedDungeonSites(dungeonState, findLatestPlayerInputText(chat));
            const activeSite = syncDungeonLoreAgentActivation(settings, dungeonState, currentLocation, mentionedSites);
            const sitesToInject = [activeSite, ...mentionedSites]
                .filter((site, index, sites) => site && sites.findIndex(candidate =>
                    (candidate?.entryId || candidate?.siteRoot) === (site.entryId || site.siteRoot)) === index);
            if (sitesToInject.length) {
                dungeonInjection = sitesToInject.map(site => buildDungeonRealityInjection(site, currentLocation, {
                    activityText: formatNarratorSiteActivity(
                        settings.mapEvolutionThreadsBySite,
                        settings.mapEvolutionBacklogBySite,
                        site.siteRoot,
                        { maxTokens: settings.mapEvolutionNarratorCommitTokens },
                    ),
                    referencedByName: site !== activeSite,
                })).filter(Boolean).join('\n\n');
            }
            if (activeSite) {
                dungeonMissingMapWarnings.delete(`${dungeonChatId}::${getSiteRootFromLocation(currentLocation)}`);
            } else if (currentLocation && looksLikeDungeonSite(currentLocation)) {
                const warningKey = `${dungeonChatId}::${getSiteRootFromLocation(currentLocation)}`;
                if (!dungeonMissingMapWarnings.has(warningKey)) {
                    dungeonMissingMapWarnings.add(warningKey);
                    console.error(`[RPG Tracker] Dungeon Reality is enabled and the party appears to be inside "${currentLocation}", but no captured site map is available. Adjudication is missing its objective map until the GM emits a valid <div hidden> map with a footer location.`);
                }
            }
            dungeonInjection = dungeonInjection
                ? `${mappedSitesInjection}\n${dungeonInjection}`
                : mappedSitesInjection;
        }
        const narrationContinue = _mapArchitectNarrationContinue;
        if (_pendingMapArchitectResult) {
            dungeonInjection = dungeonInjection
                ? `${_pendingMapArchitectResult}\n\n${dungeonInjection}`
                : _pendingMapArchitectResult;
            _pendingMapArchitectResult = null;
        }
        if (narrationContinue) _mapArchitectNarrationContinue = false;
        const _rbLastAi = _rbChat ? [..._rbChat].reverse().find(m => !m.is_user && !m.is_system) : null;
        if (_rbLastAi) {
            applyMemoSwipeRollback(_rbLastAi, settings);
            if (settings.npcRelationshipBars) {
                const _relRb = applyRelationshipSwipeRollback(_rbLastAi, settings);
                if (_relRb.anyChanged) refreshRelationshipBarsDOM(settings);
            }
            await maybeRollbackAgentsForSwipe(_rbLastAi, { lorebook: !!settings.routerEnabled });
        }

        if (settings.debugMode) {
            console.group("[RPG Tracker] Interceptor Triggered");
            console.log("Settings Enabled:", settings.enabled);
            console.log("RNG Enabled:", settings.rngEnabled);
            console.log("Payload Chat Type:", Array.isArray(chat) ? 'Array' : typeof chat);
            console.log("Chat Length:", Array.isArray(chat) ? chat.length : 'N/A');
        }

        const routerActive = isLorebookAgentRuntimeActive(settings);
        const cyoaActive = isCyoaEnabled(settings);
        const pacingInject = !!settings.enabled && hasInjectableNarrativePacing(settings.narrativePacing);
        if (!settings.enabled && !routerActive && !cyoaActive && !pacingInject && !dungeonEnabled) {
            if (settings.debugMode) console.groupEnd();
            return;
        }

        if (!Array.isArray(chat)) {
            if (settings.debugMode) {
                console.log("Chat is not an array. Interceptor bailing out.");
                console.groupEnd();
            }
            return;
        }

        // Strip RT_CUSTOM_LIBRARY comment markers from all messages before sending to AI.
        // These markers exist in the textarea for idempotent re-injection management,
        // but should be invisible to the model to avoid skewing attention weights.
        const rtCommentRe = /^[ \t]*<!--\s*RT_CUSTOM_LIBRARY_(START|END)\s*-->[ \t]*\r?\n?/gm;
        for (const m of chat) {
            if (typeof m.content === 'string') {
                m.content = m.content.replace(rtCommentRe, '');
            } else if (Array.isArray(m.content)) {
                for (const part of m.content) {
                    if (part && typeof part.text === 'string') {
                        part.text = part.text.replace(rtCommentRe, '');
                    }
                }
            }
            if (typeof m.mes === 'string') {
                m.mes = m.mes.replace(rtCommentRe, '');
            }
        }

        // The durable store now owns captured hidden maps. Remove only those
        // exact blocks from the outgoing prompt so inactive sites cannot leak
        // into context and active sites have one deterministic source.
        if (dungeonEnabled && dungeonState) {
            stripCapturedDungeonMapsFromPrompt(chat, dungeonState);
        }

        let idx = -1;
        
        // 1. Check for explicit user roles (case insensitive) or ST internal flag
        for (let i = chat.length - 1; i >= 0; i--) {
            if (settings.debugMode) console.log(`Checking message ${i}: role=${chat[i]?.role}, is_user=${chat[i]?.is_user}`);
            const role = String(chat[i]?.role || chat[i]?.Role || '').toLowerCase().trim();
            if (chat[i]?.is_user || role === 'user' || role === 'human' || role === 'player') {
                idx = i;
                break;
            }
        }
        
        // 2. Fallback: Find the last message that isn't from the system or assistant
        if (idx === -1) {
            for (let i = chat.length - 1; i >= 0; i--) {
                const role = String(chat[i]?.role || chat[i]?.Role || '').toLowerCase().trim();
                if (role && role !== 'system' && role !== 'assistant' && role !== 'ai' && role !== 'model') {
                    idx = i;
                    break;
                }
            }
        }
        
        // 3. Absolute desperation fallback: grab the very last message in the array
        if (idx === -1 && chat.length > 0) {
            idx = chat.length - 1;
        }
        
        if (idx === -1) {
            if (settings.debugMode) {
                console.log("No user message found in chat array. Interceptor bailing out.");
                console.groupEnd();
            }
            return;
        }

        const msg = chat[idx];

        // Strip prior CYOA/pacing from older turns; unwrap current turn to raw typed text
        // so pacing + CYOA + RNG can be freshly injected every generation.
        if (!skipInjection) {
            prepareUserMessagesForContextInject(chat, idx);
        }

        const content = extractTextContent(msg);
        let injections = "";     // core: pacing + CYOA + RNG + State Memo + Quests → user msg
        let loreInjections = ""; // lore: keyword/agent entries (configurable depth)
        let wpInjections = "";   // world progression reports (configurable depth)
        const dungeonInjections = dungeonInjection;
        
        if (settings.debugMode) {
            console.log(`Found user message at index ${idx}.`);
            console.log(`Extracted Text Content Length: ${content.length}`);
            console.log(`Content includes RNG tag? ${content.includes(RNG_QUEUE_TAG_D20) || content.includes(RNG_QUEUE_TAG_D100)}`);
            if (skipInjection) console.log("[RPG Tracker] Path 1 active: skipping user-message injection; keyword scan will still run.");
        }

        // Core user-message injection every turn: PC / relations / pacing / CYOA / RNG / memo / quests.
        // CYOA / pacing follow the State Tracker master toggle (same as Persistent Maps).
        if (!skipInjection && (settings.enabled || cyoaActive || pacingInject)) {
            if (settings.enabled) {
                // [PLAYER_CHARACTER] — always injected at the top of the core block
                const curChatId = SillyTavern.getContext().chatId || globalThis._rpgCurrentChatId?.();
                if (curChatId && settings.chatStates?.[curChatId]?.playerCharacter) {
                    const pc = settings.chatStates[curChatId].playerCharacter;
                    injections += `[PLAYER_CHARACTER]\nName: ${pc.name}\n${pc.bio}\n[/PLAYER_CHARACTER]\n\n`;
                    if (settings.debugMode) console.log("Player Character injected.");
                }

                // [NPC_RELATIONS] — before pacing/CYOA/RNG.
                const relBlock = await buildNpcRelationsBlock(settings);
                if (relBlock) injections += relBlock;
            }

            // Every-turn bundle just above RNG: narrative length/pacing → CYOA → (RNG below).
            const bundleParts = [];
            const modeTags = buildNarrativeModeTags(settings.narrativePacing);
            if (modeTags) bundleParts.push(modeTags);
            if (cyoaActive) {
                let cyoaBlock = buildCyoaModeBlock(settings.cyoaConfig || {});
                if (isLocationMappingEnabled(settings) && isMapArchitectTextOpener(settings) && !narrationContinue) {
                    cyoaBlock = applyMapArchitectTextOpenerCyoaCaveat(cyoaBlock);
                }
                bundleParts.push(cyoaBlock);
            }
            if (bundleParts.length) {
                injections += `${bundleParts.join('\n\n')}\n\n`;
                if (settings.debugMode) {
                    console.log('[RPG Tracker] CYOA/pacing bundle injected above RNG (every turn).');
                }
            }

            if (settings.enabled) {
                // Hybrid mode uses live tool calls outside combat and the queue only
                // while [COMBAT] is active. Queue-only mode continues to inject it for
                // every response, preserving its existing behavior.
                const injectRngQueue = settings.rngEnabled
                    && (!settings.diceFunctionTool || isCombatActive(settings.currentMemo));
                if (injectRngQueue) {
                    if (settings.rngQueueD20) {
                        const queue = makeRngQueue(RNG_QUEUE_LEN, false);
                        injections += buildRngBlock(queue, false);
                        if (settings.debugMode) console.log("RNG Queue (d20) generated for injection.");
                    }
                    if (settings.rngQueueD100) {
                        const queue = makeRngQueue(30, true);
                        injections += buildRngBlock(queue, true);
                        if (settings.debugMode) console.log("RNG Queue (d100) generated for injection.");
                    }
                }

                if (settings.currentMemo) {
                    const memoText = stripMemoHtml(memoForGmContext(settings.currentMemo)).trim();
                    injections += `${STATE_MEMO_INJECT_PREAMBLE}\n\n## TRACKER STATE 0 (Current)\n${memoText}\n\n`;
                }

                // Quest deadline check — fires before state model pass, deterministically
                if (settings.syspromptModules?.quests !== false) {
                    const memoQuests = parseQuestsFromMemo(settings.currentMemo);
                    if (memoQuests.length) {
                        const { checkQuestDeadlines, renderQuestsAsPlainText } = await import('./quests.js');
                        checkQuestDeadlines();

                        // Inject active quests as plain text into narrative context
                        const timeMatch = (settings.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
                        const currentTime = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
                        // Re-parse after checkQuestDeadlines may have mutated the memo
                        const freshQuests = parseQuestsFromMemo(settings.currentMemo);
                        const questText = renderQuestsAsPlainText(freshQuests, currentTime);
                        if (questText) injections += questText;
                    }
                }

                // Once per chat: reinforce the status footer on the first user turn only
                // (near the bottom of early context — system prompt alone is often ignored).
                // Honors Control Room: disabled <end_of_output_footer> → no reminder.
                if (shouldInjectEndOfOutputFooterReminder(chat, content)) {
                    const footerReminder = buildEndOfOutputFooterReminder(settings);
                    if (footerReminder) {
                        injections += footerReminder;
                        if (settings.debugMode) console.log('[RPG Tracker] End-of-output footer reminder injected (first user turn).');
                    } else if (settings.debugMode) {
                        console.log('[RPG Tracker] End-of-output footer reminder skipped (disabled or empty format).');
                    }
                }
            }
        }



        // Keyword scan is extension-managed only. Native Keyword Activation leaves
        // matching to SillyTavern. Agent-owned cards still inject below either way —
        // otherwise [NPC_RELATIONS] can list an NPC whose card never appears (ST
        // native WI only injects when the book is selected and keys match).
        let triggered = [];
        if (isLorebookAgentRuntimeActive(settings) && !settings.routerNativeKeywordActivation && content) {
            const t0 = performance.now().toFixed(1);
            console.group(`[RPG|INTERCEPT] rpgTrackerInterceptor keyword pre-scan @ ${t0}ms`);
            console.log('skipInjection (Path 1 active):', skipInjection);
            console.log('activeRouterKeys BEFORE scan:', JSON.stringify(settings.activeRouterKeys || []));
            triggered = await scanAssistantOutputForKeywords(content, { sweepEnabled: false }).catch(() => []);
            console.log('activeRouterKeys AFTER scan:', JSON.stringify(settings.activeRouterKeys || []));
            console.log('newly triggered this scan:', triggered);
            console.log(`scan finished @ ${performance.now().toFixed(1) }ms`);

            if (triggered.length > 0 && typeof globalThis._rpgRenderRouterUI === 'function') {
                globalThis._rpgRenderRouterUI();
            }
            console.groupEnd();
        }

        if (isLorebookAgentRuntimeActive(settings) && !skipInjection) {
            if (!settings.routerNativeKeywordActivation) {
                if (triggered.length > 0) {
                    try {
                        const ctx = SillyTavern.getContext();
                        let loreBlock = '';
                        const bookCache = {};
                        for (const id of triggered) {
                            const [bookName, uid] = id.split('::');
                            if (!bookCache[bookName]) bookCache[bookName] = await ctx.loadWorldInfo(bookName);
                            const entry = bookCache[bookName]?.entries?.[uid];
                            if (entry?.content) {
                                loreBlock += buildInjectedEntryText(id, entry, settings);
                            }
                        }
                        if (loreBlock) {
                            loreInjections += `\n<font color="#d4a028">## NEWLY ACTIVATED LORE (KEYWORD MATCH)</font>\n${loreBlock.trim()}\n`;
                            console.log(`[RPG|INTERCEPT] Same-turn lore injected for ${triggered.length} entries.`);
                        }
                    } catch (e) {
                        console.warn('[RPG Tracker] Same-turn lore injection failed:', e);
                    }
                }

                const triggeredSet = new Set(triggered);
                const persistent = (settings.keywordActivatedKeys || []).filter(id => !triggeredSet.has(id));
                if (persistent.length > 0) {
                    try {
                        const ctx = SillyTavern.getContext();
                        let persistBlock = '';
                        const bookCache = {};
                        for (const id of persistent) {
                            const [bookName, uid] = id.split('::');
                            if (!bookCache[bookName]) bookCache[bookName] = await ctx.loadWorldInfo(bookName);
                            const entry = bookCache[bookName]?.entries?.[uid];
                            if (entry?.content) {
                                persistBlock += buildInjectedEntryText(id, entry, settings);
                            }
                        }
                        if (persistBlock) {
                            loreInjections += `\n<font color="#d4a028">## ACTIVE LORE (KEYWORD)</font>\n${persistBlock.trim()}\n`;
                        }
                    } catch (e) {
                        console.warn('[RPG Tracker] Persistent keyword lore re-injection failed:', e);
                    }
                }
            }

            // Agent-owned entries (not keyword-triggered). Always inject when the
            // router is on — including native keyword mode and empty user messages.
            const alreadyInjected = settings.routerNativeKeywordActivation
                ? new Set()
                : new Set([...triggered, ...(settings.keywordActivatedKeys || [])]);
            const agentOwned = (settings.activeRouterKeys || [])
                .filter(id => !alreadyInjected.has(id))
                .filter(id => {
                    const [bookName] = id.split('::');
                    const isWorld = bookName.toLowerCase().endsWith('_world') || bookName.toLowerCase() === 'world';
                    return !isWorld;
                });
            if (agentOwned.length > 0) {
                try {
                    const ctx = SillyTavern.getContext();
                    let agentBlock = '';
                    const bookCache = {};
                    for (const id of agentOwned) {
                        const [bookName, uid] = id.split('::');
                        if (!bookCache[bookName]) bookCache[bookName] = await ctx.loadWorldInfo(bookName);
                        const entry = bookCache[bookName]?.entries?.[uid];
                        if (entry?.content) {
                            agentBlock += buildInjectedEntryText(id, entry, settings);
                        }
                    }
                    if (agentBlock) {
                        loreInjections += `\n## ACTIVE LORE (AGENT)\n${agentBlock.trim()}\n`;
                    }
                } catch (e) {
                    console.warn('[RPG Tracker] Agent-owned lore injection failed:', e);
                }
            }

            if (settings.worldProgressionEnabled && (settings.activeWorldKeys || []).length > 0) {
                try {
                    const ctx = SillyTavern.getContext();
                    let worldBlock = '';
                    const bookCache = {};
                    const sortedKeys = [...settings.activeWorldKeys].sort((a, b) => {
                        const [, uidA] = a.split('::');
                        const [, uidB] = b.split('::');
                        return Number(uidA) - Number(uidB);
                    });
                    for (const id of sortedKeys) {
                        const [bookName, uid] = id.split('::');
                        if (!bookCache[bookName]) bookCache[bookName] = await ctx.loadWorldInfo(bookName);
                        const entry = bookCache[bookName]?.entries?.[uid];
                        if (entry?.content) {
                            worldBlock += `### [${entry.key?.[0] || entry.comment || 'World Report'}]\n${substituteLoreMacros(entry.content)}\n\n`;
                        }
                    }
                    if (worldBlock) {
                        wpInjections = `\n## WORLD PROGRESSION REPORTS\n${worldBlock.trim()}\n`;
                    }
                } catch (e) {
                    console.warn('[RPG Tracker] World progression injection failed:', e);
                }
            }
        }

        if (settings.debugMode) console.groupEnd();

        if (skipInjection || (!injections && !loreInjections && !wpInjections && !dungeonInjections)) return;

        // ── Injection dispatch ───────────────────────────────────────────────────
        //
        // Two independent streams:
        //
        //  1. CORE (injections): RNG Queue + State Memo + Quests
        //     Always prepended directly into the last user message.
        //     These are turn-critical operative data the model must act on NOW.
        //     Maximum salience — the model's attention is highest on its most
        //     recent input tokens.
        //
        //  2. LORE (loreInjections): Keyword Lore + Agent Lore
        //     Depth-configurable via routerDefaultPosition / routerDefaultDepth.
        //     When position === 4 ("at Depth"): spliced as a dedicated system
        //     message at the configured depth before the user message.
        //     Otherwise: folded into the user message with the core block
        //     (original legacy behaviour, equivalent salience).
        //
        // Cache note: both streams land in the dynamic tail of the context
        // (message[N-1] or adjacent). The prefix cache break point is identical
        // regardless of which stream carries which content.

        const useDepthInjection = settings.loreInjectionPosition === 4;
        const useWpDepthInjection = settings.worldProgressionInjectionPosition === 4;

        // When not using depth injection, fold lore/world progression into the core block so that
        // the user message receives one cohesive injection (original behaviour).
        let coreBlock = injections;
        if (!useDepthInjection && loreInjections) {
            coreBlock += loreInjections;
        }
        if (!useWpDepthInjection && wpInjections) {
            coreBlock += wpInjections;
        }

        // ── 1. Core injection → always into user message ─────────────────────────
        if (coreBlock) {
            const originalContent = extractTextContent(msg).trim();
            const displayContent = originalContent ? originalContent : "[Continue the narrative]";
            const userHeader = `\n### CURRENT USER INPUT\n${displayContent}\n`;

            if (typeof msg.content === 'string') {
                msg.content = coreBlock + userHeader;
                if (settings.debugMode) console.log("[Multihog Framework] Core injection prepended to string msg.content");
            } else if (Array.isArray(msg.content)) {
                const nonTextParts = msg.content.filter(p => p && p.type !== 'text');
                msg.content = [
                    { type: 'text', text: coreBlock + userHeader },
                    ...nonTextParts
                ];
                if (settings.debugMode) console.log("[Multihog Framework] Core injection prepended to array msg.content");
            } else if (typeof msg.mes === 'string') {
                msg.mes = coreBlock + userHeader;
                if (settings.debugMode) console.log("[Multihog Framework] Core injection prepended to msg.mes");
            } else {
                if (settings.debugMode) console.log("[Multihog Framework] Core injection failed — unknown msg structure:", Object.keys(msg));
            }

            if (settings.debugMode) {
                const label = (!useDepthInjection && loreInjections) ? 'Core+Lore (User Msg)' : 'Core (User Msg)';
                logTransaction(label, [{ role: 'user', content: coreBlock }]);
            }
        }

        // ── 2. Lore injection → configurable depth ───────────────────────────────
        // The `chat` array here is SillyTavern's internal format (.mes / .is_user /
        // .name / .extra). Setting extra.type = 'narrator' maps to role:'system'
        // when setOpenAIMessages() converts it to API format.
        if (dungeonInjections) {
            const dungeonDepth = settings.loreInjectionDepth ?? 4;
            const insertIdx = Math.max(0, chat.length - dungeonDepth);
            chat.splice(insertIdx, 0, {
                name: 'Dungeon Reality',
                mes: dungeonInjections,
                is_user: false,
                extra: { type: 'narrator' },
            });
            if (settings.debugMode) {
                console.log(`[Multihog Framework] Dungeon Reality depth injection: spliced at index ${insertIdx} (depth ${dungeonDepth}).`);
                logTransaction('Dungeon Reality (Depth Splice)', [{ role: 'system', content: dungeonInjections }]);
            }
        }

        if (useDepthInjection && loreInjections) {
            const depth = settings.loreInjectionDepth ?? 4;
            const insertIdx = Math.max(0, chat.length - depth);
            const roleVal = settings.loreInjectionRole ?? 0;
            const loreMessage = {
                name: 'RPG Framework',
                mes: loreInjections,
                is_user: roleVal === 1,
                extra: roleVal === 0 ? { type: 'narrator' } : {},
            };
            chat.splice(insertIdx, 0, loreMessage);
            if (settings.debugMode) {
                console.log(`[Multihog Framework] Lore depth injection: spliced at index ${insertIdx} (depth ${depth}), chat now ${chat.length} messages.`);
                const roleName = roleVal === 1 ? 'user' : roleVal === 2 ? 'assistant' : 'system';
                logTransaction('Lore (Depth Splice)', [{ role: roleName, content: loreInjections }]);
            }
        }

        // ── 3. World Progression injection → configurable depth ──────────────────
        if (useWpDepthInjection && wpInjections) {
            const wpDepth = settings.worldProgressionInjectionDepth ?? 4;
            const insertIdx = Math.max(0, chat.length - wpDepth);
            const wpRoleVal = settings.worldProgressionInjectionRole ?? 0;
            const wpMessage = {
                name: 'World Progression',
                mes: wpInjections,
                is_user: wpRoleVal === 1,
                extra: wpRoleVal === 0 ? { type: 'narrator' } : {},
            };
            chat.splice(insertIdx, 0, wpMessage);
            if (settings.debugMode) {
                console.log(`[Multihog Framework] World Progression depth injection: spliced at index ${insertIdx} (depth ${wpDepth}), chat now ${chat.length} messages.`);
                const roleName = wpRoleVal === 1 ? 'user' : wpRoleVal === 2 ? 'assistant' : 'system';
                logTransaction('World Progression (Depth Splice)', [{ role: roleName, content: wpInjections }]);
            }
        }
    };
}

/**
 * Fuzzy-resolves an NPC name from narrative text to a Book::UID.
 * Handles partial matches (e.g. "Holdyn" matches "Ser Holdyn"),
 * bracket-prefix stripping (e.g. "[Active] Elena" → "Elena"),
 * and picks the shortest label that contains the query for precision.
 * @param {string} name - The NPC name from the narrative annotation.
 * @returns {Promise<string|null>} The resolved Book::UID or null.
 */
async function fuzzyResolveNpcName(name) {
    const query = name.toLowerCase().trim();
    if (!query) return null;

    const settings = getSettings();
    const manifest = await getLorebookManifest(true); // skipUpdate=true to prevent massive hard drive scan
    if (!manifest || !manifest.length) return null;

    // Only consider NPC entries (books ending in _npcs or _npc)
    const npcEntries = manifest.filter(e => {
        const bookName = (e.id || '').split('::')[0] || '';
        return /_npcs?$/i.test(bookName);
    });

    let bestMatch = null;
    let bestDiff = Infinity;

    for (const entry of npcEntries) {
        // Strip bracketed prefixes like [Active], [NPC], etc.
        const rawLabel = (entry.comment || entry.label || '').replace(/^\[.*?\]\s*/i, '').trim();
        const labelLower = rawLabel.toLowerCase();

        if (!labelLower) continue;

        // Exact match — return immediately
        if (labelLower === query) return entry.id;

        // Fuzzy: check if query is a substring of the label or vice-versa
        // e.g. "Holdyn" matches "Ser Holdyn", "Elena" matches "Elena Brightforge"
        // Must be at least 3 characters to prevent single-letter or empty strings matching everything
        if (labelLower.length >= 3 && (labelLower.includes(query) || query.includes(labelLower))) {
            // Prefer the match with the smallest length difference to the query
            const diff = Math.abs(labelLower.length - query.length);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestMatch = entry.id;
            }
        }

        // Also check keywords for fuzzy match
        const keys = entry.keys || entry.key || [];
        for (const k of (Array.isArray(keys) ? keys : [keys])) {
            const kLower = String(k).toLowerCase().trim();
            if (!kLower) continue;
            
            if (kLower === query) {
                bestMatch = entry.id;
                break;
            }
            if (kLower.length >= 3 && (kLower.includes(query) || query.includes(kLower))) {
                const diff = Math.abs(kLower.length - query.length);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestMatch = entry.id;
                }
                break;
            }
        }
    }

    return bestMatch;
}

/**
 * Restore the State Tracker memo when the user swipes to a different generation on the
 * last AI message. Uses rpgMemoActiveSwipe (not rpgActiveSwipe) so memo rollback stays
 * independent of the relationship swipe tracker.
 * @returns {{ anyChanged: boolean }}
 */
function applyMemoSwipeRollback(lastAiMsg, settings) {
    let anyChanged = false;
    if (settings.stateTrackerSwipeRollback === false || !lastAiMsg) {
        return { anyChanged };
    }

    lastAiMsg.extra = lastAiMsg.extra || {};
    const swipeId = lastAiMsg.swipe_id ?? 0;
    const prevSwipeId = lastAiMsg.extra.rpgMemoActiveSwipe ?? lastAiMsg.extra.rpgActiveSwipe;

    if (prevSwipeId !== undefined && prevSwipeId !== swipeId) {
        let targetMemo = lastAiMsg.extra.rpgMemoResult?.[swipeId];
        if (typeof targetMemo !== 'string') {
            targetMemo = lastAiMsg.extra.rpgMemoRollback?.[prevSwipeId] || lastAiMsg.extra.rpgMemoRollback?.[swipeId];
        }

        if (typeof targetMemo === 'string') {
            console.log(`[RPG Tracker] State swipe detected (${prevSwipeId}→${swipeId}): restoring memo snapshot.`);
            recordSchedulerEvent('memo_swipe_rollback', { prevSwipeId, swipeId, targetMemoLen: targetMemo.length });
            settings.currentMemo = targetMemo;

            if (Array.isArray(settings.memoHistory)) {
                const baseMemo = lastAiMsg.extra.rpgMemoRollback?.[prevSwipeId] || lastAiMsg.extra.rpgMemoRollback?.[swipeId];
                if (targetMemo === baseMemo) {
                    if (settings.memoHistory[0] !== baseMemo) {
                        shiftMemoAndMapHistory(settings);
                        if (settings.historyIndex !== undefined && settings.historyIndex > 0) settings.historyIndex--;
                    }
                } else {
                    settings.memoHistory[0] = targetMemo;
                }
            }

            if (lastAiMsg.extra.rpgMemoRollback) delete lastAiMsg.extra.rpgMemoRollback[swipeId];

            if (typeof globalThis._rpgUpdateUIMemo === 'function') {
                globalThis._rpgUpdateUIMemo(targetMemo);
            }
            anyChanged = true;
        }
    }

    lastAiMsg.extra.rpgMemoActiveSwipe = swipeId;
    return { anyChanged };
}

/**
 * Undo/re-apply friendship/affection deltas when the user swipes between generations
 * on the last AI message. Shared by MESSAGE_SWIPED and the pre-generation interceptor.
 * @returns {{ anyChanged: boolean, bailEarly: boolean }}
 */
function applyRelationshipSwipeRollback(lastAiMsg, settings) {
    let anyChanged = false;
    if (!settings.npcRelationshipBars || !lastAiMsg) return { anyChanged, bailEarly: false };

    lastAiMsg.extra = lastAiMsg.extra || {};
    const swipeId = lastAiMsg.swipe_id ?? 0;
    const relMax = getNpcRelationshipMax(settings);

    if (Array.isArray(lastAiMsg.extra.rpgProcessedTags)) {
        lastAiMsg.extra.rpgProcessedTags = { [swipeId]: lastAiMsg.extra.rpgProcessedTags };
    } else if (!lastAiMsg.extra.rpgProcessedTags) {
        lastAiMsg.extra.rpgProcessedTags = {};
    }
    lastAiMsg.extra.rpgRollbackData = lastAiMsg.extra.rpgRollbackData || {};

    const alreadyScanned = lastAiMsg.extra.rpgProcessedTags[swipeId] !== undefined;

    if (lastAiMsg.extra.rpgActiveSwipe !== undefined && lastAiMsg.extra.rpgActiveSwipe !== swipeId) {
        const prevSwipeId = lastAiMsg.extra.rpgActiveSwipe;
        console.log(`[RPG Tracker] Relationship swipe change: prev=${prevSwipeId}, current=${swipeId}`);
        recordSchedulerEvent('relationship_swipe_change', { prevSwipeId, swipeId });

        if (lastAiMsg.extra.rpgRollbackData[prevSwipeId]) {
            console.log(`[RPG Tracker] Rolling back previous swipe ${prevSwipeId} relationship allocations.`);
            for (const rb of lastAiMsg.extra.rpgRollbackData[prevSwipeId]) {
                if (settings.npcRelationshipValues && settings.npcRelationshipValues[rb.npcId]) {
                    const current = settings.npcRelationshipValues[rb.npcId][rb.field] ?? 0;
                    if (rb.expectedValue !== undefined && current !== rb.expectedValue) {
                        console.log(`[RPG Tracker] Aborting rollback for ${rb.npcId}: User manually edited slider.`);
                        continue;
                    }
                    settings.npcRelationshipValues[rb.npcId][rb.field] = clampRelationshipValue(current - rb.actualAppliedDelta, relMax);
                }
                if (settings.npcRelationshipLog && Array.isArray(settings.npcRelationshipLog[rb.npcId])) {
                    settings.npcRelationshipLog[rb.npcId] = settings.npcRelationshipLog[rb.npcId].filter(l => l.timestamp !== rb.logTimestamp);
                }
            }
            anyChanged = true;
        }

        if (alreadyScanned) {
            if (lastAiMsg.extra.rpgRollbackData[swipeId]?.length > 0) {
                console.log(`[RPG Tracker] Re-applying saved allocations for swipe ${swipeId}`);
                for (const rb of lastAiMsg.extra.rpgRollbackData[swipeId]) {
                    if (settings.npcRelationshipValues && settings.npcRelationshipValues[rb.npcId]) {
                        const current = settings.npcRelationshipValues[rb.npcId][rb.field] ?? 0;
                        const newValue = clampRelationshipValue(current + rb.actualAppliedDelta, relMax);
                        settings.npcRelationshipValues[rb.npcId][rb.field] = newValue;
                        rb.expectedValue = newValue;
                        rb.newValue = newValue;
                    }
                    if (settings.npcRelationshipLog) {
                        settings.npcRelationshipLog[rb.npcId] = settings.npcRelationshipLog[rb.npcId] || [];
                        const hasLog = settings.npcRelationshipLog[rb.npcId].some(l => l.timestamp === rb.logTimestamp);
                        if (!hasLog) {
                            settings.npcRelationshipLog[rb.npcId].push({
                                timestamp: rb.logTimestamp,
                                field: rb.field,
                                delta: rb.delta,
                                newValue: settings.npcRelationshipValues[rb.npcId][rb.field],
                                source: 'Swipe restore'
                            });
                            if (settings.npcRelationshipLog[rb.npcId].length > 50) {
                                settings.npcRelationshipLog[rb.npcId].shift();
                            }
                        }
                    }
                }
                anyChanged = true;
            }
            lastAiMsg.extra.rpgActiveSwipe = swipeId;
            return { anyChanged, bailEarly: true };
        }

        lastAiMsg.extra.rpgProcessedTags[swipeId] = [];
        lastAiMsg.extra.rpgRollbackData[swipeId] = [];
    }

    lastAiMsg.extra.rpgActiveSwipe = swipeId;
    lastAiMsg.extra.rpgProcessedTags[swipeId] = lastAiMsg.extra.rpgProcessedTags[swipeId] || [];
    lastAiMsg.extra.rpgRollbackData[swipeId] = lastAiMsg.extra.rpgRollbackData[swipeId] || [];

    return { anyChanged, bailEarly: false };
}

/**
 * If the Lorebook Agent's most recent pass ran while `msg` was showing a swipe that is
 * no longer active (i.e. the user swiped away from it), undo that pass and prime the
 * run-every throttle so the agent fires again on the very next generation. This keeps
 * "Run every N msgs" swipe-safe: without it, a discarded swipe's content would still
 * count toward (and advance past) the "since last run" watermark, permanently skipping
 * that segment of the conversation from the agent's view.
 * @param {any} msg - The last AI message, as resolved by the caller.
 */
async function maybeRollbackRouterPassForSwipe(msg) {
    if (!msg?.extra || msg.extra.rpgRouterRanForSwipe === undefined) return;

    const currentSwipeId = msg.swipe_id ?? 0;
    if (msg.extra.rpgRouterRanForSwipe === currentSwipeId) return;

    if (isRouterRunning()) return;

    const settings = getSettings();
    if (settings.routerSwipeRollback === false) {
        recordSchedulerEvent('la_swipe_rollback_skipped', {
            reason: 'setting_disabled',
            fromSwipe: msg.extra.rpgRouterRanForSwipe,
            toSwipe: currentSwipeId,
        });
        clearRouterSwipeMarkers(msg);
        return;
    }

    const runId = msg.extra.rpgRouterRunId;
    const postWm = msg.extra.rpgRouterPostPassWatermark;
    const latest = settings.routerHistory?.[0];

    // Only auto-rollback if this pass is still the most recent one in history.
    let historyIndex = -1;
    if (runId && latest?.runId === runId) {
        historyIndex = 0;
    } else if (!runId && postWm !== undefined && settings.routerLastRunChatLength === postWm) {
        historyIndex = 0; // legacy passes stamped before runId existed
    }

    if (historyIndex < 0) {
        console.log('[RPG Tracker] Lorebook Agent swipe rollback skipped: pass superseded or no matching history entry.');
        recordSchedulerEvent('la_swipe_rollback_skipped', { reason: 'no_history_match', runId, postWm, currentSwipeId });
        clearRouterSwipeMarkers(msg);
        return;
    }

    console.log(`[RPG Tracker] Lorebook Agent pass was based on abandoned swipe ${msg.extra.rpgRouterRanForSwipe}→${currentSwipeId}; rolling back and re-priming run-every.`);
    recordSchedulerEvent('la_swipe_rollback_attempt', { historyIndex, runId, fromSwipe: msg.extra.rpgRouterRanForSwipe, toSwipe: currentSwipeId });
    const ok = await rollbackRouterPass(historyIndex);
    if (ok) {
        clearRouterSwipeMarkers(msg);
        const primeTo = Math.max(0, (settings.routerRunEvery || 1) - 1);
        setRouterAutoTick(primeTo, 'swipe_la_rollback_prime', { runEvery: settings.routerRunEvery || 1 });
        recordSchedulerEvent('la_swipe_rollback_ok', { primedTick: primeTo });
    } else {
        console.warn('[RPG Tracker] Auto-rollback of Lorebook Agent pass failed; markers kept for retry.');
        recordSchedulerEvent('la_swipe_rollback_failed', { historyIndex, runId });
    }
}

async function maybeRollbackAgentsForSwipe(msg, { lorebook = true } = {}) {
    const mapRolled = await maybeRollbackMapUpdaterForSwipe(msg);
    if (mapRolled) {
        const primeTo = Math.max(0, (getSettings().mapUpdaterRunEvery || 1) - 1);
        setMapUpdaterAutoTick(primeTo, 'swipe_map_updater_rollback_prime');
    } else {
        // Occupancy snapshots earlier in the same turn; restoring evolution after
        // occupancy rollback would undo that occupancy restore.
        await maybeRollbackMapEvolutionForSwipe(msg);
    }
    if (lorebook) await maybeRollbackRouterPassForSwipe(msg);
}

function clearRouterSwipeMarkers(msg) {
    if (!msg?.extra) return;
    delete msg.extra.rpgRouterRanForSwipe;
    delete msg.extra.rpgRouterRunId;
    delete msg.extra.rpgRouterPrePassWatermark;
    delete msg.extra.rpgRouterPostPassWatermark;
}

/**
 * Handles memo, relationship, and Lorebook Agent rollback when a message is edited or swiped.
 */
export async function handleRelationshipSwipeChange() {
    if (_rpgIsGenerating) {
        recordSchedulerEvent('rel_tags_skipped', { reason: 'is_generating' });
        return;
    }
    
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const chat = ctx.chat;
    if (!chat || !chat.length) {
        console.log('[RPG Tracker] Relationship swipe handler: ABORT - No chat found.');
        return;
    }

    // Find the last AI message
    let lastAiMsg = null;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user && !chat[i].is_system) {
            lastAiMsg = chat[i];
            break;
        }
    }
    if (!lastAiMsg) {
        console.log('[RPG Tracker] Relationship swipe handler: ABORT - No last AI message found.');
        return;
    }

    if (getRelationshipUpdateMode(settings) === RELATIONSHIP_UPDATE_MODES.REGEX) {
        await applyNarrativeRelationshipRegex(lastAiMsg, settings, ctx);
        await maybeRollbackAgentsForSwipe(lastAiMsg);
        return;
    }
    
    // Relationship commands have their own swipe data.  Do not involve the
    // State Tracker memo rollback here.
    const relSwipeResult = settings.npcRelationshipBars
        ? applyRelationshipSwipeRollback(lastAiMsg, settings)
        : { anyChanged: false };
    await maybeRollbackAgentsForSwipe(lastAiMsg);
    if (relSwipeResult.anyChanged) persistRelationshipCommandChanges(ctx, settings);
    return;

    /*

    const triggerUIUpdate = () => {
        if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
        void saveSettings();
        refreshRelationshipBarsDOM(settings);
        // Force a synchronous chat-state snapshot so relationship deltas and memo
        // changes are not lost if the user closes the page before the debounce fires.
        // Use getActiveChatId() (which defers to _rpgCurrentChatId) — never ctx.chatId
        // directly, which can be stale during MESSAGE_SWIPED/EDITED events and would
        // snapshot the wrong chat's state (the original cross-chat leakage bug).
        if (settings.chatLinkEnabled) {
            const chatId = getActiveChatId();
            if (chatId) saveChatState(chatId);
        }
    };

    const triggerStateOnlyUIUpdate = () => {
        if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
        void saveSettings();
        if (settings.chatLinkEnabled) {
            const chatId = getActiveChatId();
            if (chatId) saveChatState(chatId);
        }
    };

    // If Relationship Bars are disabled, we only handle State Tracker swipe updates
    console.log('[RPG Tracker] Relationship swipe handler: bars enabled:', !!settings.npcRelationshipBars);
    if (!settings.npcRelationshipBars) {
        await maybeRollbackAgentsForSwipe(lastAiMsg);
        if (anyStateChanged) {
            triggerStateOnlyUIUpdate();
        }
        // Save the active swipe marker (relationship uses rpgActiveSwipe; memo uses rpgMemoActiveSwipe)
        lastAiMsg.extra = lastAiMsg.extra || {};
        lastAiMsg.extra.rpgActiveSwipe = lastAiMsg.swipe_id ?? 0;
        lastAiMsg.extra.rpgMemoActiveSwipe = lastAiMsg.swipe_id ?? 0;
        return;
    }

    console.log('[RPG Tracker] parseAndApplyNarrativeRelTags: Found AI message (index ' + chat.indexOf(lastAiMsg) + ') with text length:', lastAiMsg.mes?.length);

    // --- 2. RELATIONSHIP SWIPE ROLLBACK & RESTORE ---
    const relSwipeResult = applyRelationshipSwipeRollback(lastAiMsg, settings);
    anyChanged = relSwipeResult.anyChanged;
    if (relSwipeResult.bailEarly) {
        await maybeRollbackAgentsForSwipe(lastAiMsg);
        if (anyChanged || anyStateChanged) triggerUIUpdate();
        return;
    }

    // --- 2b. LOREBOOK AGENT "RUN EVERY" SWIPE ROLLBACK ---
    await maybeRollbackAgentsForSwipe(lastAiMsg);

    // Relationship deltas are now received from the State Tracker as structured
    // commands. Never inspect narrator prose here.
    if (anyChanged || anyStateChanged) triggerUIUpdate();
    return;

    const swipeId = lastAiMsg.swipe_id ?? 0;
    const relMax = getNpcRelationshipMax(settings);
    const text = cleanMessageContent(lastAiMsg);
    console.log('[RPG Tracker] parseAndApplyNarrativeRelTags: Cleaned text length:', text?.length);
    if (!text) {
        if (anyChanged) triggerUIUpdate();
        return;
    }

    // The narrator regex parser was removed. The State Tracker now emits
    // [RELATIONS] lines, which are parsed by relationship-commands.js.
    let match;
    const matches = [];

    while (false) {
        const rawStr = match[0];
        const field = match[1].toLowerCase();
        const name = match[2].trim();
        const delta = parseInt(match[3], 10);
        console.log(`[RPG Tracker] parseAndApplyNarrativeRelTags: regex matched raw: "${rawStr}" -> field:${field}, name:"${name}", delta:${delta}`);
        if (name && !isNaN(delta) && delta !== 0) {
            matches.push({ rawStr, field, name, delta });
        }
    }

    if (!matches.length) {
        console.log('[RPG Tracker] parseAndApplyNarrativeRelTags: No valid relationship tags found in text.');
        if (anyChanged) triggerUIUpdate();
        return;
    }

    console.log(`[RPG Tracker] Scanning text for relationships... Found ${matches.length} valid matches in swipe ${swipeId}.`);

    // --- 3. DEDUPLICATION AND APPLICATION ---
    for (const m of matches) {
        if (lastAiMsg.extra.rpgProcessedTags[swipeId].includes(m.rawStr)) {
            console.log(`[RPG Tracker] Skipping already processed tag in this swipe: ${m.rawStr}`);
            continue;
        }

        const resolvedId = await fuzzyResolveNpcName(m.name);
        if (!resolvedId) {
            console.warn(`[RPG Tracker] Narrative rel: could not resolve NPC name "${m.name}"`);
            continue;
        }

        if (!settings.npcRelationshipValues) settings.npcRelationshipValues = {};
        if (!settings.npcRelationshipValues[resolvedId]) {
            settings.npcRelationshipValues[resolvedId] = { friendship: 0, affection: 0 };
        }

        const prev = settings.npcRelationshipValues[resolvedId][m.field] ?? 0;
        const newVal = clampRelationshipValue(prev + m.delta, relMax);
        const actualAppliedDelta = newVal - prev;
        settings.npcRelationshipValues[resolvedId][m.field] = newVal;

        if (!settings.npcRelationshipLog) settings.npcRelationshipLog = {};
        if (!Array.isArray(settings.npcRelationshipLog[resolvedId])) settings.npcRelationshipLog[resolvedId] = [];
        
        const logTimestamp = Date.now();
        settings.npcRelationshipLog[resolvedId].unshift({ 
            timestamp: logTimestamp, field: m.field, delta: m.delta, newValue: newVal, source: 'narrative' 
        });
        
        if (settings.npcRelationshipLog[resolvedId].length > 50) {
            settings.npcRelationshipLog[resolvedId].length = 50;
        }

        const sign = m.delta > 0 ? '+' : '';
        const icon = m.field === 'friendship' ? '🤝' : '💗';
        const label = m.field === 'friendship' ? 'Friendship' : 'Affection';
        // @ts-ignore
        if (typeof toastr !== 'undefined' && settings.npcRelationshipToast !== false) toastr.info(`${icon} ${m.name}: ${sign}${m.delta} ${label}`, 'Relationship', { timeOut: 3500, positionClass: 'toast-bottom-right' });
        
        console.log(`[RPG Tracker] Narrative rel applied: ${m.name} → ${resolvedId} | ${m.field} ${sign}${m.delta} → ${newVal} (Actual applied: ${actualAppliedDelta})`);

        // Save rollback data for future swipes
        lastAiMsg.extra.rpgRollbackData[swipeId].push({
            npcId: resolvedId,
            field: m.field,
            actualAppliedDelta: actualAppliedDelta,
            expectedValue: newVal,
            logTimestamp: logTimestamp
        });

        // Mark this specific tag string as processed in the message metadata for THIS swipe
        lastAiMsg.extra.rpgProcessedTags[swipeId].push(m.rawStr);
        anyChanged = true;
    }

    if (anyChanged) {
        triggerUIUpdate();
        void saveSettings();
    }
    */
}


/**
 * Original narrator annotation path: parse relationship deltas directly from
 * the newest AI message and apply them to the code-owned NPC relationship data.
 */
async function applyNarrativeRelationshipRegex(lastAiMsg, settings, ctx) {
    const swipeResult = applyRelationshipSwipeRollback(lastAiMsg, settings);
    if (swipeResult.bailEarly) {
        if (swipeResult.anyChanged) persistRelationshipCommandChanges(ctx, settings);
        return;
    }

    const text = cleanMessageContent(lastAiMsg);
    if (!text) return;

    const swipeId = lastAiMsg.swipe_id ?? 0;
    const relMax = getNpcRelationshipMax(settings);
    const relRegex = /\*?\(\s*(friendship|affection)\s*:\s*(.+?)\s+([+-]?\d+)[^)]*\)\*?/gi;
    let match;
    let anyChanged = swipeResult.anyChanged;

    while ((match = relRegex.exec(text)) !== null) {
        const field = match[1].toLowerCase();
        const npc = match[2].trim();
        const delta = parseInt(match[3], 10);
        const rawTag = match[0];
        if (!npc || !Number.isFinite(delta) || delta === 0) continue;
        if (lastAiMsg.extra.rpgProcessedTags[swipeId].includes(rawTag)) continue;

        const resolvedId = await fuzzyResolveNpcName(npc);
        if (!resolvedId) continue;
        if (!settings.npcRelationshipValues) settings.npcRelationshipValues = {};
        if (!settings.npcRelationshipValues[resolvedId]) settings.npcRelationshipValues[resolvedId] = { friendship: 0, affection: 0 };

        const previousValue = settings.npcRelationshipValues[resolvedId][field] ?? 0;
        const newValue = clampRelationshipValue(previousValue + delta, relMax);
        const actualAppliedDelta = newValue - previousValue;
        settings.npcRelationshipValues[resolvedId][field] = newValue;

        if (!settings.npcRelationshipLog) settings.npcRelationshipLog = {};
        if (!Array.isArray(settings.npcRelationshipLog[resolvedId])) settings.npcRelationshipLog[resolvedId] = [];
        const logTimestamp = Date.now();
        settings.npcRelationshipLog[resolvedId].unshift({ timestamp: logTimestamp, field, delta, newValue, source: 'narrative' });
        if (settings.npcRelationshipLog[resolvedId].length > 50) settings.npcRelationshipLog[resolvedId].length = 50;

        lastAiMsg.extra.rpgRollbackData[swipeId].push({ npcId: resolvedId, field, actualAppliedDelta, expectedValue: newValue, logTimestamp });
        lastAiMsg.extra.rpgProcessedTags[swipeId].push(rawTag);

        if (settings.npcRelationshipToast !== false) {
            showRelationshipFloatFeedback({ npc, field, delta });
        }
        anyChanged = true;
    }

    if (anyChanged) persistRelationshipCommandChanges(ctx, settings);
}

/**
 * Applies the temporary relationship commands emitted by the State Tracker.
 * Commands are not stored; only the existing relationship value rollback record is.
 * @param {Array<{type: string, npc: string, field: 'friendship'|'affection', delta: number}>} commands
 */
export async function applyStateTrackerRelationshipCommands(commands) {
    if (!Array.isArray(commands) || !commands.length) return;

    const settings = getSettings();
    if (!settings.npcRelationshipBars) return;
    const ctx = SillyTavern.getContext();
    const lastAiMsg = [...(ctx.chat || [])].reverse().find(message => !message.is_user && !message.is_system);
    if (!lastAiMsg) return;

    const swipeResult = applyRelationshipSwipeRollback(lastAiMsg, settings);
    if (swipeResult.bailEarly) {
        if (swipeResult.anyChanged) persistRelationshipCommandChanges(ctx, settings);
        return;
    }

    const swipeId = lastAiMsg.swipe_id ?? 0;
    const relMax = getNpcRelationshipMax(settings);
    let anyChanged = swipeResult.anyChanged;

    for (const command of commands) {
        const resolvedId = command.npc.includes('::') ? command.npc : await fuzzyResolveNpcName(command.npc);
        if (!resolvedId) {
            console.warn(`[RPG Tracker] State Tracker relationship command could not resolve NPC "${command.npc}".`);
            continue;
        }

        if (!settings.npcRelationshipValues) settings.npcRelationshipValues = {};
        if (!settings.npcRelationshipValues[resolvedId]) settings.npcRelationshipValues[resolvedId] = { friendship: 0, affection: 0 };

        const previousValue = settings.npcRelationshipValues[resolvedId][command.field] ?? 0;
        const newValue = clampRelationshipValue(previousValue + command.delta, relMax);
        const actualAppliedDelta = newValue - previousValue;
        settings.npcRelationshipValues[resolvedId][command.field] = newValue;

        if (!settings.npcRelationshipLog) settings.npcRelationshipLog = {};
        if (!Array.isArray(settings.npcRelationshipLog[resolvedId])) settings.npcRelationshipLog[resolvedId] = [];
        const logTimestamp = Date.now();
        settings.npcRelationshipLog[resolvedId].unshift({
            timestamp: logTimestamp,
            field: command.field,
            delta: command.delta,
            newValue,
            source: 'state_tracker',
        });
        if (settings.npcRelationshipLog[resolvedId].length > 50) settings.npcRelationshipLog[resolvedId].length = 50;

        lastAiMsg.extra.rpgRollbackData[swipeId].push({
            npcId: resolvedId,
            field: command.field,
            actualAppliedDelta,
            expectedValue: newValue,
            logTimestamp,
        });
        if (settings.npcRelationshipToast !== false) {
            showRelationshipFloatFeedback({ npc: command.npc, field: command.field, delta: command.delta });
        }
        anyChanged = true;
    }

    if (anyChanged) persistRelationshipCommandChanges(ctx, settings);
}

function persistRelationshipCommandChanges(ctx, settings) {
    if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
    void saveSettings();
    refreshRelationshipBarsDOM(settings);
    if (settings.chatLinkEnabled) {
        const chatId = getActiveChatId();
        if (chatId) saveChatState(chatId);
    }
}


/**
 * Lightweight bar-only DOM refresh. Finds every `.rt-npc-card[data-entry-id]` in the
 * Campaign Records panel and surgically re-renders its relationship bar widths and
 * value labels without triggering a full `getLorebookManifest()` reload.
 * Falls back to the heavy `_rpgRefreshAgentManifest` if no cards exist yet.
 */
function refreshRelationshipBarsDOM(settings) {
    if (!settings.npcRelationshipBars) return;

    const relMax = getNpcRelationshipMax(settings);
    const relVals = settings.npcRelationshipValues || {};
    const logData = settings.npcRelationshipLog || {};

    const updateCompactRelColor = (value, type) => {
        const clamped = clampRelationshipValue(value, relMax);
        if (type === 'friendship') {
            return clamped > 0 ? '#4ade80' : clamped < 0 ? '#ef4444' : 'rgba(255,255,255,0.45)';
        }
        return clamped > 0 ? '#f472b6' : clamped < 0 ? '#a855f7' : 'rgba(255,255,255,0.45)';
    };

    // Compact NPC list rows (portraits-off view)
    for (const container of document.querySelectorAll('.rt-agent-entry-rel-stats[data-entry-id]')) {
        const entryId = container.dataset.entryId;
        if (!entryId) continue;
        const rel = relVals[entryId] || { friendship: 0, affection: 0 };
        for (const type of ['friendship', 'affection']) {
            const span = container.querySelector(`.rt-agent-entry-rel-${type}`);
            if (!span) continue;
            const value = clampRelationshipValue(rel[type] ?? 0, relMax);
            span.style.color = updateCompactRelColor(value, type);
            span.textContent = `${type === 'friendship' ? '🤝' : '💗'}${value > 0 ? '+' : ''}${value}`;
        }
    }

    const cards = document.querySelectorAll('.rt-npc-card[data-entry-id]');
    if (!cards.length) {
        if (!document.querySelector('.rt-agent-entry-rel-stats[data-entry-id]') && typeof globalThis._rpgRefreshAgentManifest === 'function') {
            globalThis._rpgRefreshAgentManifest();
        }
        return;
    }

    for (const card of cards) {
        const entryId = card.dataset.entryId;
        if (!entryId) continue;
        
        const rel = relVals[entryId];
        if (!rel) continue;

        const barsContainer = card.querySelector('.rt-npc-bars');
        if (!barsContainer) continue;

        const barRows = barsContainer.querySelectorAll('.rt-npc-bar-row');
        const types = ['friendship', 'affection'];

        for (let i = 0; i < barRows.length && i < types.length; i++) {
            const type = types[i];
            const value = clampRelationshipValue(rel[type] ?? 0, relMax);
            const pct = relationshipBarPct(value, relMax);
            const isPositive = value >= 0;

            // Update fill bar width + classes + inline style overrides
            const fill = barRows[i].querySelector('.rt-npc-bar-fill');
            if (fill) {
                const bgBarColor = isPositive 
                    ? (type === 'friendship' ? '#4ade80' : '#f472b6')
                    : (type === 'friendship' ? '#ef4444' : '#a855f7');

                fill.style.width = `${pct}%`;
                fill.style.left = isPositive ? '50%' : 'auto';
                fill.style.right = isPositive ? 'auto' : '50%';
                fill.style.background = bgBarColor;
                fill.className = `rt-npc-bar-fill ${type}-${isPositive ? 'pos' : 'neg'} ${isPositive ? 'positive' : 'negative'}`;
            }

            // Update value label
            const valSpan = barRows[i].querySelector('.rt-npc-bar-value');
            if (valSpan) {
                const valClass = type === 'friendship'
                    ? (value > 0 ? 'val-positive' : value < 0 ? 'val-negative' : 'val-zero')
                    : (value > 0 ? 'val-affection-positive' : value < 0 ? 'val-affection-negative' : 'val-zero');
                
                // Rebuild badge from log
                const log = (logData[entryId] || []).find(e => e.field === type);
                // (User requested hiding the visual badge, so we comment this out while keeping log logic intact)
                let badgeHtml = ''; /*
                if (log) {
                    const badgeColor = log.source === 'manual' ? 'rgba(180,180,180,0.7)' : (log.delta > 0 ? '#4ade80' : '#ef4444');
                    const sign = log.delta > 0 ? '+' : '';
                    const label = log.source === 'manual' ? '✋' : '🤖';
                    badgeHtml = `<span style="font-size:9px;font-weight:bold;color:${badgeColor};margin-left:4px;opacity:0.85;" title="${label} last change: ${sign}${log.delta}">${sign}${log.delta}</span>`;
                } */

                valSpan.className = `rt-npc-bar-value ${valClass}`;
                valSpan.innerHTML = `${value > 0 ? '+' : ''}${value}${badgeHtml}`;
            }

            // Update tier badge (compact, intensity-scaled color) if present
            const tierBadge = card.querySelector(`.rt-npc-tier-badge.${type}`);
            if (tierBadge) applyRelTierBadgeElement(tierBadge, type, value, relMax);
        }
    }
}

// ── Narrative collector ────────────────────────────────────────────────────────

/**
 * Collects AI narrative blocks from the chat array.
 * @param {any[]} chat
 * @param {number} limit  -1 = all since last user message; N = collect N blocks
 */
export function getNarrativeBlocks(chat, limit = -1, includeHidden = false) {
    if (!chat || chat.length === 0) return "";
    let narrativeBlocks = [];
    let foundCount = 0;

    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        if (limit === -1 && msg.is_user) break;
        if (limit !== -1 && foundCount >= limit) break;
        if (msg.is_system) continue;
        if (!includeHidden && /** @type {any} */ (msg).is_hidden) continue;

        if (msg.extra?.['summary'] || msg.extra?.['is_summary'] || msg.extra?.['summary_data']) continue;

        const mes = cleanMessageContent(msg);
        if (!mes) continue;
        if (mes.startsWith('[Summary') || mes.startsWith('(Summary') || mes.includes('Summary of past events:')) continue;

        if (mes) { narrativeBlocks.unshift(mes); foundCount++; }
    }
    return narrativeBlocks.join('\n\n');
}

// ── Generation-ended handler ───────────────────────────────────────────────────

/** Tracks the type of the last started generation. */
let _lastGenerationType = null;

export let _rpgIsGenerating = false;

/**
 * Latest non-user chat message that could count as an assistant turn.
 * @param {any[]} chat
 * @returns {any|null}
 */
function applyAssistantMessageText(ctx, message, text) {
    message.mes = text;
    if (typeof message.content === 'string') message.content = text;
    if (Array.isArray(message.swipes) && message.swipes.length) {
        const idx = Math.max(0, Math.min(message.swipes.length - 1, Number(message.swipe_id) || 0));
        message.swipes[idx] = text;
    }
    const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
    const index = chat.indexOf(message);
    if (index >= 0 && typeof ctx.updateMessageBlock === 'function') {
        try { ctx.updateMessageBlock(index, message); } catch (_) { /* UI refresh is best effort */ }
    }
    if (typeof ctx.saveChat === 'function') {
        try { void ctx.saveChat(); } catch (_) { /* persistence is best effort */ }
    }
}

function logMapArchitectTextOpener(status, extra = {}) {
    recordSchedulerEvent(`map_architect_text_opener_${status}`, extra);
    console.log(`[RPG Tracker] Map Architect text opener: ${status}`, extra);
}

/**
 * Scan assistant messages after the latest user turn for a [CREATE_AREA_MAP] fence.
 * Tool-call system rows can sit after the stub, so "latest assistant" is not enough.
 */
function findCreateAreaMapCandidate(chat) {
    if (!Array.isArray(chat)) return null;
    let lastUser = -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i]?.is_user) {
            lastUser = i;
            break;
        }
    }
    for (let i = chat.length - 1; i > lastUser; i--) {
        const message = chat[i];
        if (!message || message.is_user || message.extra?.rpgMapArchitectTextOpenerRan) continue;
        const cleaned = cleanMessageContent(message);
        const raw = getDungeonMessageText(message);
        const strippedClean = stripCreateAreaMapCommand(cleaned);
        const strippedRaw = stripCreateAreaMapCommand(raw);
        const stripped = strippedClean.command ? strippedClean : strippedRaw;
        if (stripped.command) return { message, stripped, index: i };
    }
    return null;
}

/**
 * Text-command CreateAreaMap fallback: strip the fence, run Map Architect, continue the narrator.
 * Returns true when the normal ST/LA/updater cadence must be skipped for this generation.
 */
async function maybeRunMapArchitectTextOpener({ chat, settings, currentType, source = 'generation_ended' }) {
    const type = String(currentType || '').toLowerCase();
    const textMode = isMapArchitectTextOpener(settings);
    const mappingOn = isLocationMappingEnabled(settings);
    if (!mappingOn) {
        if (textMode) logMapArchitectTextOpener('skip', { reason: 'persistent_maps_off', source, generationType: type });
        return false;
    }
    if (_mapArchitectTextOpenerBusy) {
        logMapArchitectTextOpener('skip', { reason: 'busy', source, generationType: type });
        return true;
    }
    if (['impersonate', 'quiet'].includes(type)) {
        logMapArchitectTextOpener('skip', { reason: 'generation_type', source, generationType: type });
        return false;
    }

    const candidate = findCreateAreaMapCandidate(chat);
    if (!candidate) {
        const latest = getLatestAssistantCandidate(chat);
        const preview = String(latest?.mes || '').slice(0, 240);
        const fenceMentioned = /CREATE_AREA_MAP/i.test(preview);
        if (textMode || fenceMentioned) {
            logMapArchitectTextOpener('skip', {
                reason: 'no_fence',
                source,
                generationType: type,
                textMode,
                fenceMentioned,
                preview,
            });
        }
        return false;
    }

    const { message, stripped, index } = candidate;
    logMapArchitectTextOpener('fence_found', {
        source,
        generationType: type,
        index,
        site: stripped.command.args?.site || '',
        speaker: message.name || '',
        isSystem: !!message.is_system,
    });

    _mapArchitectTextOpenerBusy = true;
    try {
        message.extra = message.extra || {};
        message.extra.rpgMapArchitectTextOpenerRan = true;
        applyAssistantMessageText(SillyTavern.getContext(), message, stripped.text);

        const args = stripped.command.args;
        if (!createAreaMapCommandIsComplete(args)) {
            logMapArchitectTextOpener('skip', { reason: 'incomplete_command', source, generationType: type, args });
            globalThis.toastr?.error?.(
                'Map Architect text command is missing site, entrance, kind, prompt, or brief_description. Stay outside and try again next turn.',
                'Map Architect',
                { timeOut: 10000 },
            );
            return true;
        }

        const siteLabel = args.site;
        logMapArchitectTextOpener('running', { source, generationType: type, site: siteLabel });
        await runMapArchitect(args);
        clearAssistantReasoning(message);
        if (args.attachTo) {
            _pendingMapArchitectResult = null;
            _mapArchitectNarrationContinue = false;
            logMapArchitectTextOpener('completed_offsite_attachment', { source, generationType: type, site: siteLabel });
            return true;
        }
        applyAssistantMessageText(
            SillyTavern.getContext(),
            message,
            seedMapArchitectContinueText(stripped.text, args.entrance),
        );
        _pendingMapArchitectResult = buildMapArchitectContinueBrief(args);
        _mapArchitectNarrationContinue = true;
        const ctx = SillyTavern.getContext();
        if (typeof ctx.generate !== 'function') {
            console.error('[RPG Tracker] Cannot continue after Map Architect text opener: generate() is unavailable.');
            _pendingMapArchitectResult = null;
            _mapArchitectNarrationContinue = false;
            return true;
        }
        setTimeout(() => {
            void Promise.resolve(ctx.generate('continue')).catch(error => {
                console.error('[RPG Tracker] Continue after Map Architect text opener failed:', error);
                _pendingMapArchitectResult = null;
                _mapArchitectNarrationContinue = false;
            });
        }, 75);
        return true;
    } catch (error) {
        _pendingMapArchitectResult = null;
        _mapArchitectNarrationContinue = false;
        console.error('[RPG Tracker] Map Architect text opener failed:', error);
        return true;
    } finally {
        _mapArchitectTextOpenerBusy = false;
    }
}

/**
 * Backup path when GENERATION_ENDED never emits (ST only emits it if #mes_stop was visible).
 * MESSAGE_RECEIVED still fires after the assistant message is saved.
 */
export async function onMapArchitectAssistantMessage(messageId, type) {
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
    const message = Number.isInteger(messageId) ? chat[messageId] : null;
    if (message?.is_user) return false;
    return maybeRunMapArchitectTextOpener({
        chat,
        settings: getSettings(),
        currentType: type || _lastGenerationType,
        source: 'message_received',
    });
}

function getLatestAssistantCandidate(chat) {
    if (!Array.isArray(chat)) return null;
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (!m || m.is_user) continue;
        if (!String(m.mes || '').trim()) continue;
        return m;
    }
    return null;
}

/**
 * True when the latest assistant-side message is from the active {{char}}.
 * Used to skip auto State Tracker / Lorebook Agent runs for other speakers
 * (e.g. /sendas "System Notifications" announcements that somehow end a generation).
 * Manual /lorebookagent and /statetracker are unaffected.
 * @param {any[]} chat
 * @param {any} ctx SillyTavern.getContext()
 * @returns {boolean}
 */
export function isLatestAssistantFromActiveChar(chat, ctx) {
    const charId = ctx?.characterId ?? ctx?.this_chid;
    const charData = (charId != null && Array.isArray(ctx?.characters))
        ? ctx.characters[charId]
        : null;
    const activeName = String(ctx?.name2 || charData?.name || '').trim();
    const activeAvatar = charData?.avatar ? String(charData.avatar) : '';

    // No resolvable {{char}} — do not block (fail open).
    if (!activeName && !activeAvatar) return true;

    const msg = getLatestAssistantCandidate(chat);
    if (!msg) return false;

    const extraType = String(msg.extra?.type || '').toLowerCase();
    if (msg.is_system || extraType === 'narrator') return false;

    const msgName = String(msg.name || '').trim();
    if (activeName && msgName) {
        // Explicit speaker name wins: a renamed /sendas announcement must not
        // ride through just because it reused {{char}}'s avatar.
        return msgName.toLowerCase() === activeName.toLowerCase();
    }

    const msgAvatar = msg.original_avatar ? String(msg.original_avatar) : '';
    if (activeAvatar && msgAvatar && msgAvatar === activeAvatar) return true;

    return false;
}

/**
 * Fires on GENERATION_STARTED. Stores the type of generation.
 * ST also emits this for prompt-build dry runs — those must not look like a live turn.
 * @param {string} type
 * @param {object} [_options]
 * @param {boolean} [dryRun]
 */
export function onGenerationStarted(type, _options, dryRun) {
    if (dryRun === true) {
        recordSchedulerEvent('generation_started_dry_run', { generationType: type ?? null });
        return;
    }
    _lastGenerationType = type;
    _rpgIsGenerating = true;
    recordSchedulerEvent('generation_started', { generationType: type ?? null });
}

/** Last run-every tick decision (for scheduler debug snapshot). */
let _lastTickDecision = null;

/** In-memory counter: how many generations have fired since the agent last ran. Resets on chat change. */
let _routerAutoTick = 0;
/** Independent cadence counter for the Map Updater. */
let _mapUpdaterAutoTick = 0;

/** @returns {object} Live scheduler internals for debug snapshot. */
export function getRouterSchedulerInternals() {
    return {
        routerAutoTick: _routerAutoTick,
        mapUpdaterAutoTick: _mapUpdaterAutoTick,
        stateTrackerAutoTick: _stateTrackerAutoTick,
        lastGenerationType: _lastGenerationType,
        isGenerating: _rpgIsGenerating,
        pendingKeywordCount: _pendingKeywordTriggered.length,
        lastTickDecision: _lastTickDecision,
    };
}

function setRouterAutoTick(value, reason, meta = {}) {
    const tickBefore = _routerAutoTick;
    _routerAutoTick = value;
    recordSchedulerEvent('router_tick_set', { tickBefore, tickAfter: value, reason, ...meta });
}

function incrementRouterAutoTick(reason, meta = {}) {
    const tickBefore = _routerAutoTick;
    _routerAutoTick++;
    recordSchedulerEvent('router_tick_inc', { tickBefore, tickAfter: _routerAutoTick, reason, ...meta });
    document.dispatchEvent(new CustomEvent('rt_generation_tick'));
}

function setMapUpdaterAutoTick(value, reason, meta = {}) {
    const tickBefore = _mapUpdaterAutoTick;
    _mapUpdaterAutoTick = value;
    recordSchedulerEvent('map_updater_tick_set', { tickBefore, tickAfter: value, reason, ...meta });
}

/** In-memory counter: how many generations have fired since the state tracker last ran. */
let _stateTrackerAutoTick = 0;

/**
 * Accumulates keyword-triggered entry IDs across throttled generations so the
 * agent receives the full set (not just the current turn) when it finally fires.
 * Reset whenever the agent runs or the chat changes.
 */
let _pendingKeywordTriggered = [];

/** Call this whenever the active chat changes so the interval counter and accumulator restart.
 * @param {boolean} [clearKeywordPool] - Pass true only when actually switching to a different chat.
 */
export function resetRouterTick(clearKeywordPool = false) {
    const prevTick = _routerAutoTick;
    _routerAutoTick = 0;
    _mapUpdaterAutoTick = 0;
    _stateTrackerAutoTick = 0;
    _pendingKeywordTriggered = [];
    _lastTickDecision = null;
    recordSchedulerEvent('router_tick_reset', {
        tickBefore: prevTick,
        tickAfter: 0,
        reason: 'chat_change',
        clearKeywordPool,
    });
    // Keyword-activated entries are transient (they expire when the keyword leaves the scan window).
    // Only clear on a real chat change, not on same-chat reloads (swipe, regenerate).
    if (clearKeywordPool) {
        const s = getSettings();
        if (s.keywordActivatedKeys?.length) {
            s.keywordActivatedKeys = [];
        }
        // Reset the "since last run" watermark so the next auto-pass on the new chat
        // doesn't incorrectly skip content using the old chat's position.
        s.routerLastRunChatLength = 0;
        s.mapUpdaterLastRunChatLength = 0;
    }
}

/** Returns how many auto-generations have fired since the Lorebook Agent last ran. */
export function getRouterTick() { return _routerAutoTick; }

/** Returns how many auto-generations have fired since the Map Updater last ran. */
export function getMapUpdaterTick() { return _mapUpdaterAutoTick; }

/** Reset the auto-run throttle counter (e.g. after a manual agent pass). */
export function resetRouterAutoTick(reason = 'manual') {
    const prev = _routerAutoTick;
    _routerAutoTick = 0;
    recordSchedulerEvent('router_tick_reset', { tickBefore: prev, tickAfter: 0, reason });
}

/**
 * Fires on GENERATION_ENDED. Triggers the state model pass.
 * runStateModelPass is resolved via the module import below to avoid
 * a hard circular dep — it will be a direct import once memo-processor.js exists.
 */
export async function onGenerationEnded() {
    _rpgIsGenerating = false;
    // CYOA decoration is independent of tracker state. Finalize it before this
    // handler awaits scanning or a State Tracker model pass.
    try {
        globalThis._rpgFinalizeCyoaNarratorRender?.();
    } catch (error) {
        console.warn('[RPG Tracker] CYOA render finalization failed:', error);
    }
    const settings = getSettings();
    const currentType = _lastGenerationType;
    const ctx = SillyTavern.getContext();
    const { chat } = ctx;

    // Fence handshake beats ST/LA, including while a previous tracker pass is still running
    // and even when the latest row is a tool-call system message.
    if (await maybeRunMapArchitectTextOpener({ chat, settings, currentType, source: 'generation_ended' })) {
        recordSchedulerEvent('generation_ended_aborted', {
            reason: 'map_architect_text_opener',
            generationType: currentType ?? null,
        });
        setTimeout(() => { _lastGenerationType = null; }, 0);
        return;
    }

    const isStateRunning = typeof globalThis._rpgStateModelRunning === 'function' && globalThis._rpgStateModelRunning();
    const routerActive = isLorebookAgentRuntimeActive(settings);
    if ((!settings.enabled && !routerActive) || isStateRunning) {
        recordSchedulerEvent('generation_ended_aborted', {
            reason: (!settings.enabled && !routerActive) ? 'disabled' : 'state_running',
            generationType: currentType ?? null,
        });
        return;
    }

    // Check if the generation was for Impersonation or Quiet tasks.
    // In these cases, the chat history did not actually change.
    recordSchedulerEvent('generation_ended_enter', {
        generationType: currentType ?? null,
        chatLength: SillyTavern.getContext()?.chat?.length ?? 0,
        tickBefore: _routerAutoTick,
    });
    // Reset the tracker after a timeout (next tick) to handle synchronous multi-event triggers (e.g. ENDED + STOPPED)
    setTimeout(() => {
        _lastGenerationType = null;
    }, 0);

    if (currentType === 'impersonate' || currentType === 'quiet') {
        if (settings.debugMode) {
            console.log(`[RPG Tracker] Skipping State Tracker and Researcher passes for generation type: ${currentType}`);
        }
        recordSchedulerEvent('generation_ended_aborted', { reason: 'generation_type', generationType: currentType });
        return;
    }

    // Only auto-run State Tracker / Lorebook Agent when the latest assistant speaker is {{char}}.
    // Fake announcement speakers (e.g. "System Notifications") must not tick run-every or fire passes.
    if (!isLatestAssistantFromActiveChar(chat, ctx)) {
        if (settings.debugMode) {
            const last = getLatestAssistantCandidate(chat);
            console.log('[RPG Tracker] Skipping auto ST/LA — latest speaker is not {{char}}:', last?.name || '(none)');
        }
        recordSchedulerEvent('generation_ended_aborted', {
            reason: 'non_char_speaker',
            generationType: currentType ?? null,
            speaker: getLatestAssistantCandidate(chat)?.name || null,
            activeChar: ctx?.name2 || null,
        });
        return;
    }

    // Persist a newly generated initial map immediately, before the Lorebook
    // Agent pass. Swipe/regenerate outputs are provisional and are captured
    // only after the replacement becomes the selected response.
    if (isLocationMappingEnabled(settings)
        && !['swipe', 'regenerate'].includes(String(currentType || '').toLowerCase())) {
        try {
            const capture = await syncDungeonMapsToLocationLorebook(chat, { capture: true });
            if (capture.changed) {
                console.info(`[RPG Tracker] Attached ${capture.capturedMaps} dungeon map(s) to root Location lorebook entries.`);
            }
            for (const error of capture.errors || []) {
                console.error(`[RPG Tracker] Dungeon Reality capture failed: ${error}.`);
            }
            const state = { version: 3, sites: capture.sites || {} };
            syncDungeonLoreAgentActivation(settings, state, findLatestDungeonLocation(chat));
        } catch (error) {
            console.error('[RPG Tracker] Could not persist the dungeon map to the Locations lorebook:', error);
        }
    }

    const combinedNarrative = getNarrativeBlocks(chat, -1, !!settings.routerIncludeHidden);
    if (!combinedNarrative) {
        recordSchedulerEvent('generation_ended_aborted', { reason: 'no_narrative', generationType: currentType ?? null });
        return;
    }

    // Narrator-regex relationship awards are read directly from chat and do not
    // require either agent to run. Apply them before the shared pause boundary.
    if (shouldProcessRegexRelationshipUpdates(settings)) {
        await handleRelationshipSwipeChange();
    }

    // Pausing still suppresses State Tracker, Lorebook Agent, keyword scanning,
    // world progression, and their tracker-based relationship command path.
    if (settings.paused) {
        recordSchedulerEvent('generation_ended_aborted', {
            reason: 'paused',
            generationType: currentType ?? null,
        });
        return;
    }

    // Real-Time Visualization: scene art every-N / location-change (independent of router throttle).
    // Defer one tick so the new assistant message is in chat before we count outputs.
    setTimeout(() => {
        if (typeof globalThis._rpgCheckRealtimeSceneArt === 'function') {
            void globalThis._rpgCheckRealtimeSceneArt();
        }
    }, 0);

    if (settings.debugMode) console.log("[RPG Tracker] Assistant generation ended. Running keyword scanner...");

    // Step 1: Scan assistant output for entry keywords and activate matches immediately.
    // Must run before the state model pass and on EVERY generation, regardless of throttle,
    // so entries are never one turn behind the narrator even when the agent is skipped.
    // Skipped when routerNativeKeywordActivation is enabled (native ST system handles keywords).
    if (isLorebookAgentRuntimeActive(settings) && !settings.routerNativeKeywordActivation) {
        const thisGenTriggered = await scanAssistantOutputForKeywords(combinedNarrative);
        if (thisGenTriggered.length > 0) {
            // Accumulate across throttled turns — deduplicate so IDs are not repeated.
            const accumulated = new Set([..._pendingKeywordTriggered, ...thisGenTriggered]);
            _pendingKeywordTriggered = [...accumulated];
            if (settings.debugMode) {
                console.log("[RPG Tracker] Keyword scanner activated entries:", thisGenTriggered, "| Pending total:", _pendingKeywordTriggered.length);
            }

            // Trigger UI refresh
            if (typeof globalThis._rpgRenderRouterUI === 'function') {
                globalThis._rpgRenderRouterUI();
            }
        }
    }

    if (settings.enabled) {
        // State Tracker pass — throttled by stateTrackerRunEvery.
        const stateRunEvery = settings.stateTrackerRunEvery || 1;
        _stateTrackerAutoTick++;
        if (_stateTrackerAutoTick >= stateRunEvery) {
            _stateTrackerAutoTick = 0;
            if (settings.debugMode) console.log("[RPG Tracker] Triggering State Model pass...", combinedNarrative);
            if (typeof globalThis._rpgRunStateModelPass === 'function') {
                await globalThis._rpgRunStateModelPass(combinedNarrative);
            }
        } else {
            if (settings.debugMode) console.log(`[RPG Tracker] State Tracker skipped (tick ${_stateTrackerAutoTick}/${stateRunEvery}).`);
        }

        // Step 2b: Combat main-profile auto-switch — check raw memo after State Tracker (or on existing memo if throttled).
        try {
            await syncCombatProfile(getSettings().currentMemo, settings);
        } catch (e) {
            console.warn('[RPG Tracker] Combat profile sync failed:', e);
        }

        try {
            await globalThis._rpgSyncDynamicRngPrompt?.(getSettings().currentMemo, settings);
        } catch (e) {
            console.warn('[RPG Tracker] Dynamic RNG prompt sync failed:', e);
        }

        // Re-check scene art after State Tracker may have updated location in memo.
        if (typeof globalThis._rpgCheckRealtimeSceneArt === 'function') {
            void globalThis._rpgCheckRealtimeSceneArt();
        }
    }

    // Map Updater cadence is independent of Lorebook Agent. It can run every turn
    // while LA stays on a slower record/relationship schedule. Occupancy runs before
    // World Progression / Map Evolution so Evolution cannot move something play just destroyed.
    const countsTowardRunEvery = currentType !== 'swipe' && currentType !== 'regenerate';
    const mapEvery = Math.max(1, Number(settings.mapUpdaterRunEvery) || 1);
    if (countsTowardRunEvery) {
        const mapTickBefore = _mapUpdaterAutoTick;
        _mapUpdaterAutoTick++;
        recordSchedulerEvent('map_updater_tick_inc', {
            tickBefore: mapTickBefore,
            tickAfter: _mapUpdaterAutoTick,
            generationType: currentType ?? null,
        });
        document.dispatchEvent(new CustomEvent('rt_generation_tick'));
    }
    const mapUpdaterAvailable = countsTowardRunEvery
        && settings.mapUpdaterEnabled !== false
        && isLocationMappingEnabled(settings);
    const forceBuildingPopulation = mapUpdaterAvailable && await shouldForceBuildingPopulationPass();
    const shouldTryMapUpdater = mapUpdaterAvailable
        && (_mapUpdaterAutoTick >= mapEvery || forceBuildingPopulation);

    let exitResult = null;
    let holdExitBookkeeping = false;
    let currentRoot = '';
    let exitDeferredWatermark = false;
    if (mapUpdaterAvailable) {
        currentRoot = await getActiveMapUpdaterSiteRoot();
        const previousRoot = String(settings.mapUpdaterLastSiteRoot || '').trim();
        let pendingExitRoot = String(settings.mapUpdaterPendingExitRoot || '').trim();
        const rootsDiffer = normalizeDungeonLabel(previousRoot) !== normalizeDungeonLabel(currentRoot);
        let bookkeepingChanged = false;

        if (!pendingExitRoot && previousRoot && rootsDiffer) {
            pendingExitRoot = previousRoot;
            settings.mapUpdaterPendingExitRoot = previousRoot;
            bookkeepingChanged = true;
        }

        if (pendingExitRoot) {
            exitDeferredWatermark = shouldTryMapUpdater;
            exitResult = await runMapUpdaterPass({
                siteRoot: pendingExitRoot,
                trigger: 'site_exit',
                deferWatermark: exitDeferredWatermark,
            });
            holdExitBookkeeping = exitResult?.skipped === 'busy' || exitResult?.skipped === 'stopped';
            if (!holdExitBookkeeping) {
                settings.mapUpdaterPendingExitRoot = '';
                settings.mapUpdaterLastSiteRoot = currentRoot;
                bookkeepingChanged = true;
            }
            recordSchedulerEvent('map_updater_exit_pass', {
                siteRoot: pendingExitRoot,
                currentRoot: currentRoot || null,
                skipped: exitResult?.skipped || null,
                ok: exitResult?.ok === true,
                noop: exitResult?.noop === true,
                pending: holdExitBookkeeping,
            });
        } else if (normalizeDungeonLabel(previousRoot) !== normalizeDungeonLabel(currentRoot)) {
            settings.mapUpdaterLastSiteRoot = currentRoot;
            bookkeepingChanged = true;
        }

        if (bookkeepingChanged) persistMapUpdaterState();
    }

    let mapResult = null;
    if (shouldTryMapUpdater && !holdExitBookkeeping) {
        const exitStampedSwipe = exitResult?.ok === true && exitResult?.noop !== true;
        mapResult = await runMapUpdaterPass({ stampSwipe: !exitStampedSwipe });
        const skipped = mapResult?.skipped;
        if (exitDeferredWatermark && skipped) {
            persistMapUpdaterLastRunWatermark(ctx.chat?.length || 0);
            persistMapUpdaterLastRunTimestamp();
        }
        if (!skipped || !['no_active_map', 'dungeon_reality_off', 'location_mapping_off', 'disabled', 'busy'].includes(skipped)) {
            setMapUpdaterAutoTick(0, 'map_updater_fire_threshold', { generationType: currentType ?? null, runEvery: mapEvery });
        }
        recordSchedulerEvent('map_updater_pass', {
            skipped: skipped || null,
            ok: mapResult?.ok === true,
            noop: mapResult?.noop === true,
            forcedBuildingPopulation: forceBuildingPopulation,
            afterExit: !!exitResult,
        });
    }

    // World Progression then Map Evolution — TIME is already on the memo; occupancy is current.
    await maybeRunWorldProgression();
    await maybeRunMapEvolution();

    // Step 4: Run-every throttle — only fire the Lorebook Agent every N new turns.
    // Swipe/regenerate generations reuse an existing message slot and must not advance the
    // counter (otherwise swiping through alternatives walks the cycle forward normally).
    // Use a denylist rather than an allowlist: a fresh send may report its type as 'normal',
    // '', or undefined depending on the entry path, but swipes/regens are always explicit.
    // (impersonate/quiet already returned earlier and never reach here.)
    const runEvery = settings.routerRunEvery || 1;
    const tickBefore = _routerAutoTick;

    _lastTickDecision = {
        at: Date.now(),
        generationType: currentType ?? null,
        countsTowardRunEvery,
        tickBefore,
        runEvery,
    };

    recordSchedulerEvent('run_every_eval', {
        generationType: currentType ?? null,
        countsTowardRunEvery,
        tickBefore,
        runEvery,
        nextInIfInc: countsTowardRunEvery ? Math.max(0, runEvery - (tickBefore + 1)) : Math.max(0, runEvery - tickBefore),
    });

    if (countsTowardRunEvery) {
        incrementRouterAutoTick('generation_ended', { generationType: currentType ?? null });
    } else {
        recordSchedulerEvent('router_tick_skipped', {
            generationType: currentType ?? null,
            reason: 'denylist_swipe_or_regenerate',
            tick: _routerAutoTick,
        });
    }

    if (!countsTowardRunEvery || _routerAutoTick < runEvery) {
        _lastTickDecision = { ..._lastTickDecision, action: 'hold', tickAfter: _routerAutoTick };
        recordSchedulerEvent('lore_agent_hold', {
            reason: !countsTowardRunEvery ? 'generation_type_excluded' : 'below_threshold',
            tick: _routerAutoTick,
            runEvery,
        });
        return;
    }

    setRouterAutoTick(0, 'lore_agent_fire_threshold', { generationType: currentType ?? null, runEvery });
    _lastTickDecision = { ..._lastTickDecision, action: 'fire', tickAfter: 0 };

    // Step 5: Lorebook Agent pass — passes the full accumulated set of keyword-triggered IDs
    // from all throttled turns since the last agent run (not just the current generation).
    if (settings.routerWatermarkBaselinePending) {
        settings.routerWatermarkBaselinePending = false;
        persistRouterLastRunWatermark(chat.length);
        recordSchedulerEvent('lore_agent_watermark_baseline', { chatLength: chat.length });
        if (settings.debugMode) {
            console.log('[RPG Tracker] Lorebook Agent watermark baselined at chat.length', chat.length);
        }
        return;
    }
    recordSchedulerEvent('lore_agent_fire', {
        generationType: currentType ?? null,
        chatLength: chat.length,
        pendingKeywords: _pendingKeywordTriggered.length,
    });
    const triggeredForAgent = [..._pendingKeywordTriggered];
    _pendingKeywordTriggered = []; // reset accumulator now that the agent is about to process them
    await runRouterPass(combinedNarrative, null, null, false, triggeredForAgent);

    // Step 6: Re-check World Progression after the Lorebook Agent — an overlapping agent
    // run from a prior generation may have blocked the pre-agent check.
    await maybeRunWorldProgression();
}

// ── World Progression deterministic trigger ─────────────────────────────────────────

/**
 * Checks whether the World Progression system should fire based on the in-world clock
 * stored in settings.currentMemo. Fires at most once per interval, never twice for the
 * same period. Called after every State Tracker pass.
 */
async function maybeRunWorldProgression() {
    const settings = getSettings();
    if (!settings.worldProgressionEnabled || !isLorebookAgentRuntimeActive(settings)) return;
    if (!settings.currentMemo) return;

    // Extract time string from the [TIME] block
    const timeMatch = settings.currentMemo.match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
    const currentMinutes = parseInWorldMinutes(timeStr);
    if (currentMinutes < 0) return; // can't parse time → skip

    hydrateWorldProgressionFromChatState();
    const lastFiredLabel = settings.worldProgressionLastFiredPeriodLabel || '';
    const lastFired = lastFiredLabel ? parseInWorldMinutes(lastFiredLabel) : null;
    const intervalMinutes = (settings.worldProgressionIntervalHours || 24) * 60;

    if (lastFired === null) {
        // Never fired — record current time as start of the first interval, don't fire yet.
        settings.worldProgressionLastFiredPeriodLabel = formatInWorldTime(currentMinutes);
        persistWorldProgressionTimer();
        if (typeof globalThis._rpgRenderRouterUI === 'function') globalThis._rpgRenderRouterUI();
        return;
    }

    const elapsed = currentMinutes - lastFired;
    if (elapsed < intervalMinutes) return;

    // Guard: don't start a World Progression pass while the Lorebook Agent is already running
    if (isRouterRunning()) return;

    await runWorldProgressionPass(timeStr, currentMinutes);
}
