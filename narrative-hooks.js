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

import { getSettings, hydrateWorldProgressionFromChatState, persistWorldProgressionTimer, persistRouterLastRunWatermark, getNpcRelationshipMax, clampRelationshipValue, relationshipBarPct, getFriendshipTier, getAffectionTier, applyRelTierBadgeElement, saveChatState, getActiveChatId } from './state-manager.js';
import { syncCombatProfile } from './llm-client.js';
import { parseQuestsFromMemo, extractCurrentTimeStr, cleanMessageContent, formatInWorldTime, memoForGmContext } from './memo-processor.js';
import { runRouterPass, saveSceneToLorebook, scanAssistantOutputForKeywords, parseInWorldMinutes, runWorldProgressionPass, updateLorebookEntry, getLorebookManifest } from './router.js';
import { logTransaction } from './debug-viewer.js';

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

// ── Dice naming helpers ────────────────────────────────────────────────────────

export function getDiceToolName() {
    return 'RollTheDice';
}

export function getDiceCommandName() {
    return 'roll';
}

export function getDiceCommandAliases() {
    return ['r'];
}

// ── RNG Engine ─────────────────────────────────────────────────────────────────

export const RNG_QUEUE_LEN = 12;

export function rollDie(sides) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(4294967296 / sides) * sides;
    let roll;
    do { crypto.getRandomValues(buf); roll = buf[0]; } while (roll >= limit);
    return (roll % sides) + 1;
}

export function makeRngQueue(n = RNG_QUEUE_LEN) {
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push({
            d20: rollDie(20),
            d4:  rollDie(4),
            d6:  rollDie(6),
            d8:  rollDie(8),
            d10: rollDie(10),
            d12: rollDie(12),
        });
    }
    return out;
}

export function buildRngBlock(queue) {
    const turnId = Date.now();
    const formattedQueue = queue.map(dice =>
        `${dice.d20}(d4:${dice.d4},d6:${dice.d6},d8:${dice.d8},d10:${dice.d10},d12:${dice.d12})`
    ).join(", ");
    return `[RNG_QUEUE v6.0_PROPER]\nturn_id=${turnId}\nscope=this_response\nqueue=[${formattedQueue}]\n[/RNG_QUEUE]\n\n`;
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
    const nullValue = { total: '', rolls: [] };
    let value = typeof customDiceFormula === 'string' ? customDiceFormula.trim() : '1d20';

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
    toastr['warning'](`Invalid dice formula "${value}" — defaulting to 1d20.`);
    const fallbackRoll = rollDie(20);
    if (!quiet) {
        const context = SillyTavern.getContext();
        context.sendSystemMessage('generic', `${context.name1} tried to roll an invalid formula ("${value}"), defaulting to 1d20. The result is: ${fallbackRoll}`, { isSmallSys: true });
    }
    return { total: String(fallbackRoll), rolls: [String(fallbackRoll)], formula: '1d20', invalidFormula: value };
}

// ── Tool & slash command registration ─────────────────────────────────────────

export function registerDiceFunctionTool() {
    try {
        const ctx = SillyTavern.getContext();
        const { registerFunctionTool, unregisterFunctionTool } = ctx;
        if (!registerFunctionTool || !unregisterFunctionTool) return;

        unregisterFunctionTool('RollTheDice');
        unregisterFunctionTool('FatbodyRollTheDice');
        unregisterFunctionTool('MultihogRollTheDice');

        const settings = getSettings();
        if (!settings.rngEnabled || !settings.diceFunctionTool) return;

        const toolName = getDiceToolName();
        const isLegacy = settings.legacyDiceNaming;

        const formulaDescription = 'A SINGLE dice formula to roll, e.g. "1d20", "2d6+3", "1d20+5". Supports one or more die groups joined by + or - (e.g. "1d20+1d4+2"), and keep/drop modifiers (e.g. "2d20kh1" for advantage, "2d20kl1" for disadvantage). Provide EXACTLY ONE formula string — do NOT separate multiple formulas with commas, and do NOT repeat/duplicate the same formula in one call. If you need more than one roll, call this tool again separately for each roll.';

        const rollDiceSchema = isLegacy ? {
            type: 'object',
            properties: {
                who: { type: 'string', description: 'The name of the persona rolling the dice' },
                formula: { type: 'string', description: formulaDescription.replace('1d20', '1d6') },
            },
            required: ['who', 'formula'],
        } : {
            type: 'object',
            properties: {
                who: { type: 'string', description: 'The name of the persona rolling the dice' },
                formula: { type: 'string', description: formulaDescription },
                dc: { type: 'number', description: 'The Difficulty Class (DC) for this roll. Anchors the difficulty before the roll is made.' },
            },
            required: ['who', 'formula', 'dc'],
        };

        registerFunctionTool({
            name: toolName,
            displayName: isLegacy ? 'Dice Roll' : 'Dice Roll (with DC)',
            description: 'Rolls the dice using the provided formula and returns the numeric result. Use when it is necessary to roll the dice to determine the outcome of an action or when the user requests it. The formula parameter must be a single valid dice expression (e.g. "1d20+3") — never a comma-separated list or multiple repeated formulas.',
            parameters: rollDiceSchema,
            action: async (args) => {
                const requestedFormula = args?.formula || (isLegacy ? '1d6' : '1d20');
                const roll = await doDiceRoll(requestedFormula, true);
                const total = parseInt(roll.total) || 0;
                const formula = roll.formula || requestedFormula;
                const invalidNote = roll.invalidFormula ? ` (requested formula "${roll.invalidFormula}" was invalid, defaulted to ${formula})` : '';

                if (isLegacy) {
                    return (args.who
                        ? `${args.who} rolls a ${formula}. The result is: ${total}. Individual rolls: ${roll.rolls.join(', ')}`
                        : `The result of a ${formula} roll is: ${total}. Individual rolls: ${roll.rolls.join(', ')}`) + invalidNote;
                }

                const dc = Number(args?.dc) || 0;
                let result = (args.who
                    ? `${args.who} rolls a ${formula} against DC ${dc}. The result is: ${total}. Individual rolls: ${roll.rolls.join(', ')}`
                    : `The result of a ${formula} roll against DC ${dc} is: ${total}. Individual rolls: ${roll.rolls.join(', ')}`) + invalidNote;

                if (dc > 0) {
                    result += ` (Result: ${total >= dc ? 'SUCCESS' : 'FAILURE'})`;
                }
                return result;
            },
            formatMessage: () => '',
        });
    } catch (error) {
        console.error('[RPG Tracker] Error registering dice function tool', error);
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
            const result = await doDiceRoll(String(value || (getSettings().legacyDiceNaming ? '1d6' : '1d20')), quiet);
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
        name: 'router',
        callback: async (args, value) => {
            const val = String(value || '').trim().toLowerCase();
            if (val.startsWith('save')) {
                const hint = val.substring(4).trim();
                await saveSceneToLorebook(hint);
                return 'Scene save requested.';
            }
            if (val === 'run' || val === 'research') {
                const { chat } = SillyTavern.getContext();
                const s = getSettings();
                const combinedNarrative = getNarrativeBlocks(chat, -1, !!s.routerIncludeHidden);
                await runRouterPass(combinedNarrative, null, null, true);
                return 'Research pass started.';
            }
            return 'Usage: /router run | /router save [hint]';
        },
        helpString: 'Interact with the Router Agent (e.g. /router save)',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'command (e.g. save)',
                isRequired: true,
                typeList: [ARGUMENT_TYPE.STRING],
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

/**
 * Formats a lorebook entry block for injection into the GM/narrator prompt.
 * Automatically prepends any active NPC relationship status values if relationship bars are enabled.
 */
function buildInjectedEntryText(id, entry, settings) {
    let content = substituteLoreMacros(entry.content || '');
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
    globalThis.rpgTrackerInterceptor = async function (chat, contextSize, abort, type) {
        const settings = getSettings();

        // When addPromptManagerInterceptor (Path 1) is active, we do NOT inject anything
        // into the user message — that would break prefix-cache protection.
        // However, we MUST still run the keyword pre-scan so that newly triggered entries
        // are added to activeRouterKeys before Path 1 reads it to build the API payload.
        // Path 1 fires after this interceptor in the ST pipeline, so a scan here = same-turn lore.
        const skipInjection = !!globalThis._rpgPromptManagerInterceptorActive;

        // ── Swipe rollback: restore memo BEFORE injection ─────────────────────────────
        // Fires synchronously here so the restored memo is used when building the prompt
        // (line ~550), replicating the game state from before the swiped-away generation.
        if (getSettings().stateTrackerSwipeRollback !== false) {
            const _stCtx = SillyTavern.getContext();
            const _stChat = _stCtx?.chat;
            const _stLastAi = _stChat ? [..._stChat].reverse().find(m => !m.is_user) : null;
            if (_stLastAi && _stLastAi.extra) {
                const _curSwipe = _stLastAi.swipe_id ?? 0;
                const _prevSwipe = _stLastAi.extra.rpgActiveSwipe;
                if (_prevSwipe !== undefined && _prevSwipe !== _curSwipe) {
                    const _snap = _stLastAi.extra.rpgMemoRollback?.[_prevSwipe];
                    if (typeof _snap === 'string') {
                        const _s = getSettings();
                        console.log(`[RPG Tracker] Swipe detected (${_prevSwipe}→${_curSwipe}): restoring memo snapshot before injection.`);
                        _s.currentMemo = _snap;
                        // Keep memoHistory consistent: drop the entry written for the old swipe
                        if (Array.isArray(_s.memoHistory) && _s.memoHistory[0] !== _snap) {
                            _s.memoHistory.shift();
                            if (_s.historyIndex !== undefined && _s.historyIndex > 0) _s.historyIndex--;
                        }
                        // Clear the stale snapshot so the new generation can stamp a fresh one
                        if (_stLastAi.extra.rpgMemoRollback) delete _stLastAi.extra.rpgMemoRollback[_curSwipe];
                        // Advance the active swipe marker so this doesn't re-trigger next turn
                        _stLastAi.extra.rpgActiveSwipe = _curSwipe;
                        // Also reset processed-tags for the new swipe (relationship system)
                        if (_stLastAi.extra.rpgProcessedTags) _stLastAi.extra.rpgProcessedTags[_curSwipe] = [];
                        if (_stLastAi.extra.rpgRollbackData) _stLastAi.extra.rpgRollbackData[_curSwipe] = [];
                        // Update memo pane immediately
                        if (typeof globalThis._rpgUpdateUIMemo === 'function') globalThis._rpgUpdateUIMemo(_snap);
                    }
                }
            }
        }

        if (settings.debugMode) {
            console.group("[RPG Tracker] Interceptor Triggered");
            console.log("Settings Enabled:", settings.enabled);
            console.log("RNG Enabled:", settings.rngEnabled);
            console.log("Payload Chat Type:", Array.isArray(chat) ? 'Array' : typeof chat);
            console.log("Chat Length:", Array.isArray(chat) ? chat.length : 'N/A');
        }

        if (!settings.enabled) {
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
        const content = extractTextContent(msg);
        let injections = "";     // core: RNG Queue + State Memo + Quests (always → user msg)
        let loreInjections = ""; // lore: keyword/agent entries (configurable depth)
        let wpInjections = "";   // world progression reports (configurable depth)
        
        if (settings.debugMode) {
            console.log(`Found user message at index ${idx}.`);
            console.log(`Extracted Text Content Length: ${content.length}`);
            console.log(`Content includes RNG tag? ${content.includes("[RNG_QUEUE v6.0_PROPER]")}`);
            if (skipInjection) console.log("[RPG Tracker] Path 1 active: skipping user-message injection; keyword scan will still run.");
        }

        // RNG, State Memo, and Quests are only injected into the user message in Path 2.
        // In Path 1 (addPromptManagerInterceptor), these are built and injected by that interceptor
        // into a dedicated system message at the configured depth, protecting the prefix cache.
        if (!skipInjection) {
            // [PLAYER_CHARACTER] — always injected at the top of the core block
            const curChatId = SillyTavern.getContext().chatId || globalThis._rpgCurrentChatId?.();
            if (curChatId && settings.chatStates?.[curChatId]?.playerCharacter) {
                const pc = settings.chatStates[curChatId].playerCharacter;
                if (!content.includes("[PLAYER_CHARACTER]")) {
                    injections += `[PLAYER_CHARACTER]\nName: ${pc.name}\n${pc.bio}\n[/PLAYER_CHARACTER]\n\n`;
                    if (settings.debugMode) console.log("Player Character injected.");
                }
            }

        // [NPC_RELATIONS] — injected first, before RNG queue, same mechanism as RNG.
            const relBlock = await buildNpcRelationsBlock(settings);
            if (relBlock) injections += relBlock;

            if (settings.rngEnabled && !content.includes("[RNG_QUEUE v6.0_PROPER]")) {
                const queue = makeRngQueue(RNG_QUEUE_LEN);
                injections += buildRngBlock(queue);
                if (settings.debugMode) console.log("RNG Queue generated for injection.");
            }

            if (settings.currentMemo && !content.includes("### STATE MEMO (DO NOT REPEAT)")) {
                const memoText = stripMemoHtml(memoForGmContext(settings.currentMemo)).trim();
                injections += `### STATE MEMO (DO NOT REPEAT)\n${memoText}\n\n`;
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
        }



        // Pre-generation keyword scan.
        // This interceptor (manifest generate_interceptor) fires BEFORE addPromptManagerInterceptor
        // in the ST pipeline. Running the keyword scan here ensures that any entries activated by
        // the current user message land in activeRouterKeys before Path 1 reads it.
        //
        // In Path 1 (skipInjection=true): scan runs, activeRouterKeys is updated, text building
        //   is skipped. Path 1 will pick up all activeRouterKeys (including newly triggered ones)
        //   and inject them as a single system message at the configured depth.
        //
        // In Path 2 (skipInjection=false): scan runs and we also build lore text and inject it
        //   directly into the user message (legacy path for old ST builds).
        //
        // Skipped entirely when routerNativeKeywordActivation is enabled (ST handles keywords).
        if (settings.routerEnabled && !settings.routerNativeKeywordActivation) {
            if (content) {
                const t0 = performance.now().toFixed(1);
                console.group(`[RPG|INTERCEPT] rpgTrackerInterceptor keyword pre-scan @ ${t0}ms`);
                console.log('skipInjection (Path 1 active):', skipInjection);
                console.log('activeRouterKeys BEFORE scan:', JSON.stringify(settings.activeRouterKeys || []));
                const triggered = await scanAssistantOutputForKeywords(content, { sweepEnabled: false }).catch(() => []);
                console.log('activeRouterKeys AFTER scan:', JSON.stringify(settings.activeRouterKeys || []));
                console.log('newly triggered this scan:', triggered);
                console.log(`scan finished @ ${performance.now().toFixed(1) }ms`);

                // Trigger UI refresh so the Agent Panel updates immediately with yellow pills
                if (triggered.length > 0 && typeof globalThis._rpgRenderRouterUI === 'function') {
                    globalThis._rpgRenderRouterUI();
                }

                // In Path 1, the scan above already updated activeRouterKeys.
                // Path 1's addPromptManagerInterceptor will read activeRouterKeys and inject
                // all entries (including the newly triggered ones) at the configured depth.
                // No text building or user-message mutation needed here.
                if (!skipInjection) {
                    // Path 2: build lore text to inject directly into the user message.
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

                    // Persistent keyword-activated entries
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

                    // Agent-owned entries (not keyword-triggered)
                    const alreadyInjected = new Set([...triggered, ...(settings.keywordActivatedKeys || [])]);
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

                // World Progression reports injection
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

            console.groupEnd();
        }
    }

        if (settings.debugMode) console.groupEnd();

        if (skipInjection || (!injections && !loreInjections && !wpInjections)) return;

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
 * Scans the most recent AI message for inline relationship annotations:
 *   (Friendship: Name +X ...) or (Affection: Name -X ...)
 * Parses field, NPC name, and delta, then applies them directly to
 * relationship values in settings. The "reason" portion after the delta is ignored.
 * This replaces the old lorebook-agent-as-middleman approach.
 */
export async function parseAndApplyNarrativeRelTags() {
    if (_rpgIsGenerating) return; // Prevent scanning ghost text or early partial text during stream
    
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const chat = ctx.chat;
    if (!chat || !chat.length) {
        console.log('[RPG Tracker] parseAndApplyNarrativeRelTags: ABORT - No chat found.');
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
        console.log('[RPG Tracker] parseAndApplyNarrativeRelTags: ABORT - No last AI message found.');
        return;
    }
    
    let anyChanged = false;
    let anyStateChanged = false;

    // --- 1. STATE TRACKER SWIPE ROLLBACK & RESTORE ---
    if (settings.stateTrackerSwipeRollback !== false) {
        lastAiMsg.extra = lastAiMsg.extra || {};
        const swipeId = lastAiMsg.swipe_id ?? 0;
        const prevSwipeId = lastAiMsg.extra.rpgActiveSwipe;
        if (prevSwipeId !== undefined && prevSwipeId !== swipeId) {
            // Determine the target memo for the new swipe
            let targetMemo = lastAiMsg.extra.rpgMemoResult?.[swipeId];
            // Fallback to base memo if not processed yet
            if (typeof targetMemo !== 'string') {
                targetMemo = lastAiMsg.extra.rpgMemoRollback?.[prevSwipeId] || lastAiMsg.extra.rpgMemoRollback?.[swipeId];
            }
            
            if (typeof targetMemo === 'string') {
                console.log(`[RPG Tracker] State swipe detected (${prevSwipeId}→${swipeId}): restoring memo snapshot.`);
                settings.currentMemo = targetMemo;
                
                // Keep memoHistory consistent
                if (Array.isArray(settings.memoHistory)) {
                    const baseMemo = lastAiMsg.extra.rpgMemoRollback?.[prevSwipeId] || lastAiMsg.extra.rpgMemoRollback?.[swipeId];
                    if (targetMemo === baseMemo) {
                        if (settings.memoHistory[0] !== baseMemo) {
                            settings.memoHistory.shift();
                            if (settings.historyIndex !== undefined && settings.historyIndex > 0) settings.historyIndex--;
                        }
                    } else {
                        settings.memoHistory[0] = targetMemo;
                    }
                }
                
                // Update UI immediately
                if (typeof globalThis._rpgUpdateUIMemo === 'function') {
                    globalThis._rpgUpdateUIMemo(targetMemo);
                }
                anyStateChanged = true;
            }
        }
    }

    const triggerUIUpdate = () => {
        if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
        ctx.saveSettingsDebounced?.();
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
        ctx.saveSettingsDebounced?.();
        if (settings.chatLinkEnabled) {
            const chatId = getActiveChatId();
            if (chatId) saveChatState(chatId);
        }
    };

    // If Relationship Bars are disabled, we only handle State Tracker swipe updates
    console.log('[RPG Tracker] parseAndApplyNarrativeRelTags: STARTING. Bars enabled:', !!settings.npcRelationshipBars);
    if (!settings.npcRelationshipBars) {
        if (anyStateChanged) {
            triggerStateOnlyUIUpdate();
        }
        // Save the active swipe marker
        lastAiMsg.extra = lastAiMsg.extra || {};
        lastAiMsg.extra.rpgActiveSwipe = lastAiMsg.swipe_id ?? 0;
        return;
    }

    console.log('[RPG Tracker] parseAndApplyNarrativeRelTags: Found AI message (index ' + chat.indexOf(lastAiMsg) + ') with text length:', lastAiMsg.mes?.length);

    const relMax = getNpcRelationshipMax(settings);

    // --- 2. RELATIONSHIP SWIPE ROLLBACK & RESTORE ---
    lastAiMsg.extra = lastAiMsg.extra || {};
    const swipeId = lastAiMsg.swipe_id ?? 0;

    // Convert old array format to object-keyed-by-swipe format if needed
    if (Array.isArray(lastAiMsg.extra.rpgProcessedTags)) {
        lastAiMsg.extra.rpgProcessedTags = { [swipeId]: lastAiMsg.extra.rpgProcessedTags };
    } else if (!lastAiMsg.extra.rpgProcessedTags) {
        lastAiMsg.extra.rpgProcessedTags = {};
    }
    lastAiMsg.extra.rpgRollbackData = lastAiMsg.extra.rpgRollbackData || {};

    const alreadyScanned = lastAiMsg.extra.rpgProcessedTags[swipeId] !== undefined;

    // Detect swipe change and perform rollback / re-application
    if (lastAiMsg.extra.rpgActiveSwipe !== undefined && lastAiMsg.extra.rpgActiveSwipe !== swipeId) {
        const prevSwipeId = lastAiMsg.extra.rpgActiveSwipe;
        console.log(`[RPG Tracker] Relationship swipe change: prev=${prevSwipeId}, current=${swipeId}`);
        
        // Rollback previous swipe
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
        
        // Re-apply current swipe if we have already scanned/processed it
        if (alreadyScanned) {
            if (lastAiMsg.extra.rpgRollbackData[swipeId] && lastAiMsg.extra.rpgRollbackData[swipeId].length > 0) {
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
            if (anyChanged || anyStateChanged) triggerUIUpdate();
            return; // Bail out - we already re-applied the saved deltas for this scanned swipe!
        } else {
            // New/unprocessed swipe: initialize empty arrays
            lastAiMsg.extra.rpgProcessedTags[swipeId] = [];
            lastAiMsg.extra.rpgRollbackData[swipeId] = [];
        }
    }

    lastAiMsg.extra.rpgActiveSwipe = swipeId;
    lastAiMsg.extra.rpgProcessedTags[swipeId] = lastAiMsg.extra.rpgProcessedTags[swipeId] || [];
    lastAiMsg.extra.rpgRollbackData[swipeId] = lastAiMsg.extra.rpgRollbackData[swipeId] || [];

    const text = cleanMessageContent(lastAiMsg);
    console.log('[RPG Tracker] parseAndApplyNarrativeRelTags: Cleaned text length:', text?.length);
    if (!text) {
        if (anyChanged) triggerUIUpdate();
        return;
    }

    // --- 2. EARLY RETURNS (After Rollback) ---
    // Match: (Friendship: Name +X ...) or (Affection: Name -X ...)
    // Also handles the asterisk-wrapped variant: *(Friendship: Name +X ...)*
    // Removed \b because depending on formatting/characters it can fail
    const relRegex = /\*?\(\s*(friendship|affection)\s*:\s*(.+?)\s+([+-]?\d+)[^)]*\)\*?/gi;
    let match;
    const matches = [];

    while ((match = relRegex.exec(text)) !== null) {
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
        SillyTavern.getContext().saveSettingsDebounced?.();
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

/**
 * Ensures a SillyTavern Regex Script exists to visually hide [REL: ...] tags from the
 * rendered chat display. The tag remains in the raw message text (editable by pressing
 * the edit button), so our parser and metadata deduplication continue to work. This
 * only affects the visual render — it replaces the match with an empty string on
 * "AI Output" and "Alter Chat Display" so the user never sees the raw tag in the
 * conversation flow.
 */
export function ensureRelTagRegex() {
    try {
        const ctx = SillyTavern.getContext();
        const extSettings = ctx.extensionSettings;
        if (!extSettings) return;

        // The regex extension stores scripts in extensionSettings.regex
        if (!extSettings.regex) extSettings.regex = [];
        const scripts = extSettings.regex;

        // Legacy [REL:] tag hider (for old messages that may still contain them)
        const SCRIPT_NAME = 'Hide REL Tags [RPG Tracker]';
        if (!scripts.some(s => s.scriptName === SCRIPT_NAME)) {
            scripts.push({
                scriptName: SCRIPT_NAME,
                findRegex: '/\\[REL:\\s*[^\\]]+\\]/g',
                replaceString: '',
                trimStrings: [],
                placement: [
                    1, // AI_OUTPUT
                ],
                disabled: false,
                markdownOnly: false,
                promptOnly: false,
                runOnEdit: true,
                substituteRegex: false,
                minDepth: null,
                maxDepth: null,
            });
            console.log('[RPG Tracker] Registered REL tag hiding regex script.');
        }

        ctx.saveSettingsDebounced?.();
    } catch (e) {
        console.warn('[RPG Tracker] Could not register REL tag regex:', e);
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
 * Fires on GENERATION_STARTED. Stores the type of generation.
 * @param {string} type
 */
export function onGenerationStarted(type) {
    _lastGenerationType = type;
    _rpgIsGenerating = true;
}

/** In-memory counter: how many generations have fired since the agent last ran. Resets on chat change. */
let _routerAutoTick = 0;

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
    _routerAutoTick = 0;
    _stateTrackerAutoTick = 0;
    _pendingKeywordTriggered = [];
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
    }
}

/** Returns how many auto-generations have fired since the Lorebook Agent last ran. */
export function getRouterTick() { return _routerAutoTick; }

/** Reset the auto-run throttle counter (e.g. after a manual agent pass). */
export function resetRouterAutoTick() { _routerAutoTick = 0; }

/**
 * Fires on GENERATION_ENDED. Triggers the state model pass.
 * runStateModelPass is resolved via the module import below to avoid
 * a hard circular dep — it will be a direct import once memo-processor.js exists.
 */
export async function onGenerationEnded() {
    _rpgIsGenerating = false;
    const settings = getSettings();

    const isStateRunning = typeof globalThis._rpgStateModelRunning === 'function' && globalThis._rpgStateModelRunning();
    if (!settings.enabled || settings.paused || isStateRunning) return;

    // Check if the generation was for Impersonation or Quiet tasks.
    // In these cases, the chat history did not actually change.
    const currentType = _lastGenerationType;
    // Reset the tracker after a timeout (next tick) to handle synchronous multi-event triggers (e.g. ENDED + STOPPED)
    setTimeout(() => {
        _lastGenerationType = null;
    }, 0);

    if (currentType === 'impersonate' || currentType === 'quiet') {
        if (settings.debugMode) {
            console.log(`[RPG Tracker] Skipping State Tracker and Researcher passes for generation type: ${currentType}`);
        }
        return;
    }

    const { chat } = SillyTavern.getContext();
    const combinedNarrative = getNarrativeBlocks(chat, -1, !!settings.routerIncludeHidden);
    if (!combinedNarrative) return;

    if (settings.debugMode) console.log("[RPG Tracker] Assistant generation ended. Running keyword scanner...");

    // Step 1: Scan assistant output for entry keywords and activate matches immediately.
    // Must run before the state model pass and on EVERY generation, regardless of throttle,
    // so entries are never one turn behind the narrator even when the agent is skipped.
    // Skipped when routerNativeKeywordActivation is enabled (native ST system handles keywords).
    if (settings.routerEnabled && !settings.routerNativeKeywordActivation) {
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

    // Step 1b: Parse (Friendship/Affection: Name ±X) tags from the narrative AI's output
    // and apply relationship deltas directly — no lorebook agent middleman.
    // Fired in the background without awaiting so the UI "Send" button reappears instantly.
    if (settings.npcRelationshipBars) {
        try {
            parseAndApplyNarrativeRelTags(); // Removed await for speed
        } catch (e) {
            console.warn('[RPG Tracker] Narrative relationship tag parsing failed:', e);
        }
    }

    // Step 2: State Tracker pass — throttled by stateTrackerRunEvery.
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

    // Step 3: World Progression deterministic check — runs AFTER the State Tracker has updated
    // currentMemo, so the [TIME] block reflects the current in-world clock.
    await maybeRunWorldProgression();

    // Step 4: Run-every throttle — only fire the Lorebook Agent every N auto-generations.
    _routerAutoTick++;
    document.dispatchEvent(new CustomEvent('rt_generation_tick'));
    const runEvery = settings.routerRunEvery || 1;
    if (_routerAutoTick < runEvery) return;
    _routerAutoTick = 0;

    // Step 5: Lorebook Agent pass — passes the full accumulated set of keyword-triggered IDs
    // from all throttled turns since the last agent run (not just the current generation).
    if (settings.routerWatermarkBaselinePending) {
        settings.routerWatermarkBaselinePending = false;
        persistRouterLastRunWatermark(chat.length);
        if (settings.debugMode) {
            console.log('[RPG Tracker] Lorebook Agent watermark baselined at chat.length', chat.length);
        }
        return;
    }
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
    if (!settings.worldProgressionEnabled || !settings.routerEnabled) return;
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
    const { isRouterRunning } = await import('./router.js');
    if (isRouterRunning()) return;

    await runWorldProgressionPass(timeStr, currentMinutes);
}
