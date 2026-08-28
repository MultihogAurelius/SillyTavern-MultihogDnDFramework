/** Dedicated ongoing dungeon/settlement occupancy updater. */
import {
    getSettings,
    persistMapUpdaterLastRunTimestamp,
    persistMapUpdaterLastRunWatermark,
    persistMapEvolutionState,
} from './state-manager.js';
import { sendStateRequest } from './llm-client.js';
import {
    extractCurrentTimeStr,
    formatAgentChatLogFromIndex,
} from './memo-processor.js';
import {
    applyDungeonMapTransaction,
    extractFooterLocation,
    formatDungeonMapForUpdater,
    getDungeonMessageText,
    locationContainsSiteRoot,
    normalizeDungeonLabel,
    normalizeMapSiteKind,
    resolveBuildingIntentPopulationTarget,
    resolveBuildingPopulationTarget,
} from './dungeon-reality.js';
import { isLocationMappingEnabled } from './src/state/section-enabled.js';
import { parseMapArchitectResponse } from './map-architect-parser.js';
import { DEFAULT_MAP_UPDATER_SYSTEM_PROMPT } from './map-updater-prompt.js';
import { selectMapUpdaterSystemPrompt } from './map-updater-direct-prompt.js';
import {
    BUILDING_POPULATION_MIN_LOOKBACK_TURNS,
    extractPartyMemberNames,
    formatPartyRosterForMapUpdater,
    isPartyMemberAssetName,
    resolveMapUpdaterStoryWindow,
    validateBuildingPopulationTransaction,
    validatePartyMemberRemovalTransaction,
} from './map-updater-lib.js';
import {
    appendEvolutionThreads,
    threadsFromMapTransaction,
} from './map-evolution-lib.js';
import {
    applyActiveDungeonMapCommit,
    applyDungeonMapCommit,
    isRouterRunning,
    loadActiveDungeonMapContext,
    loadDungeonMapContextForSite,
    restoreCampaignLocationsBook,
    snapshotCampaignLocationsBook,
} from './router.js';
import { isMapEvolutionRunning } from './map-evolution.js';

export {
    BUILDING_POPULATION_MIN_LOOKBACK_TURNS,
    resolveMapUpdaterStoryWindow,
} from './map-updater-lib.js';

const MAX_CORRECTION_ATTEMPTS = 2;
const swipeSnapshots = new Map();
let _mapUpdaterRunning = false;
let _mapUpdaterStarting = false;
let _mapUpdaterController = null;

export function isMapUpdaterRunning() {
    return _mapUpdaterRunning;
}

/** Check the post-GM footer without invoking a model; used only to bypass cadence on first entry. */
export async function shouldForceBuildingPopulationPass() {
    if (!isLocationMappingEnabled(getSettings())) return false;
    try {
        const loaded = await loadActiveDungeonMapContext();
        return !!(loaded?.context && resolveBuildingPopulationTarget(loaded.context.document, loaded.currentLocation));
    } catch (error) {
        console.warn('[RPG Tracker] Could not check BUILDING first-entry population:', error);
        return false;
    }
}

/** Resolve the mapped site currently selected by the post-narration footer. */
export async function getActiveMapUpdaterSiteRoot() {
    if (!isLocationMappingEnabled(getSettings())) return '';
    try {
        const loaded = await loadActiveDungeonMapContext();
        return String(loaded?.context?.siteRoot || '').trim();
    } catch (error) {
        console.warn('[RPG Tracker] Could not resolve active Map Updater site:', error);
        return '';
    }
}

/**
 * Aborts the currently-running Map Updater pass, if any.
 * Same Stop control as Lorebook Agent: kills the in-flight LLM request.
 */
export function stopMapUpdaterPass() {
    if (_mapUpdaterController) {
        _mapUpdaterController.abort();
        _mapUpdaterController = null;
    }
}

function broadcastStep(type, content, metadata = {}) {
    document.dispatchEvent(new CustomEvent('rt_lore_agent_step', {
        detail: { type, content, metadata: { source: 'map_updater', ...metadata }, timestamp: Date.now() },
    }));
}

export function summarizeMapUpdaterOperations(transaction) {
    const ops = Array.isArray(transaction?.operations) ? transaction.operations : [];
    return ops.map(operation => {
        const op = String(operation?.op || '').trim() || 'OP';
        if (op === 'SET_CONNECTION') {
            const from = String(operation?.from || '').trim();
            const to = String(operation?.to || '').trim();
            return [op, from && to ? `${from} → ${to}` : (from || to)].filter(Boolean).join(' ');
        }
        const name = String(operation?.name || operation?.asset_id || operation?.area_id || operation?.to || '').trim();
        const kind = String(operation?.kind || '').trim();
        return `${op}${name ? ` ${name}` : ''}${kind ? ` (${kind})` : ''}`;
    }).join('; ');
}

export function isMapUpdaterNoop(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.noop === true) return true;
    return Array.isArray(value.operations) && value.operations.length === 0;
}

function requestSettings(settings) {
    return {
        connectionSource: settings.mapRuntimeConnectionSource || 'default',
        connectionProfileId: settings.mapRuntimeConnectionProfileId || '',
        completionPresetId: settings.mapRuntimeCompletionPresetId || '',
        ollamaUrl: settings.mapRuntimeOllamaUrl || 'http://localhost:11434',
        ollamaModel: settings.mapRuntimeOllamaModel || '',
        openaiUrl: settings.mapRuntimeOpenaiUrl || '',
        openaiKey: settings.mapRuntimeOpenaiKey || '',
        openaiModel: settings.mapRuntimeOpenaiModel || '',
        maxTokens: Math.max(1000, Number(settings.mapUpdaterMaxTokens) || 25000),
        debugMode: !!settings.debugMode,
    };
}

function recentStoryContext(ctx, settings, { isManual = false, lookback = null, minLookbackTurns = null } = {}) {
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    const window = resolveMapUpdaterStoryWindow(chat, settings, { isManual, lookback, minLookbackTurns });
    return formatAgentChatLogFromIndex(chat, window.startIdx, !!settings.routerIncludeHidden, window.sinceLastRun);
}

function currentTimeFrom(settings, recentStory) {
    const timeRegex = /(\d{1,2}:\d{2}\s*(?:AM|PM)?,\s*(?:Day\s*\d+|\d{1,2}\/\d{1,2}\/\d+))/i;
    const narrativeTimeMatch = String(recentStory || '').match(timeRegex);
    const memoTimeMatch = settings.currentMemo?.match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    const cleanMemoTime = memoTimeMatch ? extractCurrentTimeStr(memoTimeMatch[1]) : '';
    return narrativeTimeMatch ? narrativeTimeMatch[1] : cleanMemoTime;
}

function swipeSnapshotKey(ctx, message, swipeId = message?.swipe_id ?? 0) {
    const chatId = ctx.chatId || ctx.getCurrentChatId?.() || '';
    const index = Array.isArray(ctx.chat) ? ctx.chat.indexOf(message) : -1;
    return `${chatId}:${index}:${swipeId}`;
}

function stampTriggerMessage(ctx, snapshot) {
    const trigger = [...(ctx.chat || [])].reverse().find(message => !message?.is_user && !message?.is_system);
    if (!trigger) return;
    trigger.extra = trigger.extra || {};
    trigger.extra.rpgMapUpdaterRanForSwipe = trigger.swipe_id ?? 0;
    swipeSnapshots.set(swipeSnapshotKey(ctx, trigger), snapshot);
}

function formatFailure(errors) {
    return JSON.stringify({
        ok: false,
        retryable: true,
        code: errors?.[0]?.code || 'INVALID_MAP_TRANSACTION',
        errors: errors || [],
        hint: 'Correct only the rejected fields and retry with the same operation_id. Nothing from the rejected commit was written.',
    }, null, 2);
}

function kindRule(kind) {
    if (kind === 'SETTLEMENT') {
        return 'Ordinary settlement structures the party enters are BUILDING assets in the current district. OBJECT is props only. SUBDUNGEON/SUBINTERIOR require explicit narrative establishment, and CreateAreaMap—not Map Updater—owns BUILDING promotion. If CURRENT LOCATION names an untracked ordinary structure, ADD_ASSET kind BUILDING. Positional tails such as "behind the general store" or "outside the inn" stay on the district — never invent a BUILDING from that phrasing. When RECENT STORY clearly identifies existing UNREVEALED BUILDING/OBJECT landmarks from outside, SET_ASSET knowledge KNOWN on each match without clearing notEntered. Footer leaves may shorten the asset name ("General Store" for "Bullion General Store") — still treat that as entry of the matching BUILDING, clear notEntered, and populate normally. On FIRST-ENTRY / INTENT BUILDING POPULATION, ADD_ASSET only map-worthy CREATURE/GROUP/LOOT/HAZARD/TRAP/ALARM/BARRIER/OBJECT contents — never ambient clutter (tipped chairs, dusty booths, ordinary furniture). Named people are CREATURE; unnamed bands are one GROUP with count.';
    }
    return `${kind === 'INTERIOR' ? 'INTERIOR' : 'DUNGEON'} is room-scale. If the party enters a newly invented room the map lacks, ADD_AREA from the narrative.`;
}

function partyRosterSection(memo, { directPass = false } = {}) {
    const roster = formatPartyRosterForMapUpdater(memo);
    if (!roster) return '';
    if (directPass) {
        return `
## PARTY NAMES (REFERENCE ONLY)
Never ADD_ASSET these people. Do not perform unrelated PARTY cleanup unless the DIRECT INSTRUCTION asks for it.
${roster}
`;
    }
    return `
## PARTY (must not exist as assets)
These names are the active party. Never ADD_ASSET them. If the CURRENT MAP already contains a matching CREATURE, REMOVE_ASSET that exact asset now: PARTY members travel in the player bubble and cannot remain durable map occupancy. This invariant applies to CREATURE only, not GROUP.
${roster}
`;
}

function rejectPartyMemberAssets(transaction, memo) {
    const partyNames = extractPartyMemberNames(memo);
    if (!partyNames.length || !transaction || typeof transaction !== 'object') return [];
    const ops = Array.isArray(transaction.operations) ? transaction.operations : [];
    return ops.flatMap((operation, index) => {
        if (String(operation?.op || '').toUpperCase() !== 'ADD_ASSET') return [];
        const name = String(operation?.name || '').trim();
        if (!isPartyMemberAssetName(name, partyNames)) return [];
        return [{
            code: 'PARTY_MEMBER_NOT_AN_ASSET',
            path: `operations[${index}].name`,
            hint: `"${name}" is a [PARTY] member. Do not ADD_ASSET the player or party. Omit this operation.`,
        }];
    });
}

function formatBuildingPopulationBundle(target) {
    if (!target) return '';
    const intentPhase = target.phase === 'intent';
    const identity = target.building
        ? `Building: ${target.building.id} | ${target.building.name}\nDetail: ${target.building.detail || '(none)'}\nOwner: ${target.building.owner || '(none)'}`
        : `Untracked building name: ${target.untrackedName}\nCreate this BUILDING in ${target.area.id} before adding its contents.`;
    const children = target.children.length
        ? target.children.map(asset => `- ${asset.id} | ${asset.kind} | ${asset.name} | ${asset.state} | ${asset.knowledge} | ${asset.detail || ''}`).join('\n')
        : '- None.';
    return `
## ${intentPhase ? 'PRE-NARRATION BUILDING INTENT POPULATION' : 'FIRST-ENTRY BUILDING POPULATION'} (MANDATORY THIS PASS)
${intentPhase
        ? `The player's latest action deliberately targets this BUILDING. Establish its objective hidden contents now, before the narrator adjudicates approach, entry, perception, or danger. The player action is intent only: do not assume entry succeeded, invent a roll outcome, or mark new contents perceived.\nPlayer action: ${target.playerText || '(not supplied)'}`
        : 'The completed GM footer places the party inside this BUILDING for the first unresolved time.'}
District: ${target.area.id} | ${target.area.name}
District geometry: ${(target.area.geometry || [])[0] || '(none)'}
${identity}
Existing contained assets:
${children}

Resolve this lightweight, map-free interior now using the normal flat operations array. RECENT STORY was widened for this population pass so you can ground contents in what was established. ADD_ASSET only map-worthy CREATURE, GROUP, LOOT, HAZARD, TRAP, ALARM, BARRIER, or interactive/scavengable OBJECT contents — never ambient set dressing (tipped chairs, dusty booths, ordinary counters, general mess). New children must be ADD_ASSET with location equal to the exact BUILDING id/name; never SET_ASSET a brand-new invented asset_id. Keep the interior lean and interesting, not excessive (do not pack every house with enemies when the district is already crowded). Reconcile established SUSPECTED contents rather than duplicating them. ${intentPhase ? 'Every newly generated contained asset must be UNREVEALED; only later GM narration can make it KNOWN or SUSPECTED. Do not emit chronicles in this pre-narration pass.' : 'KNOWN requires observation in RECENT STORY; concealed additions are UNREVEALED; an unconfirmed rumor stays SUSPECTED; certain knowledge may be KNOWN.'} An established empty, closed, or abandoned building may add no contents. In every case, explicitly finish with SET_ASSET on the BUILDING using notEntered:false. Do not output noop, ADD_AREA, SUBDUNGEON, SUBINTERIOR, or CreateAreaMap.`;
}

function formatDirectInstructionBlock(directInstruction) {
    const text = String(directInstruction || '').trim();
    if (!text) return '';
    return `\n## DIRECT INSTRUCTION (THIS PASS ONLY)\nFollow this user instruction for this occupancy update. It does not override JSON output rules or the durable-only contract.\n${text}\n`;
}

function previousFooterForSite(chat, siteRoot) {
    let skippedCurrentFooter = false;
    for (let index = (Array.isArray(chat) ? chat.length : 0) - 1; index >= 0; index--) {
        const message = chat[index];
        const role = String(message?.role || '').toLowerCase();
        if (message?.is_user || message?.is_system || role === 'user' || role === 'system') continue;
        const location = extractFooterLocation(getDungeonMessageText(message));
        if (location && !skippedCurrentFooter) {
            skippedCurrentFooter = true;
            continue;
        }
        if (location && locationContainsSiteRoot(location, siteRoot)) return location;
    }
    return siteRoot;
}

function formatLocationSection(loaded, { inspectorPass = false, exitPass = false, previousLocation = '' } = {}) {
    if (exitPass) {
        return `## SITE EXIT CLEANUP (MANDATORY REVIEW)
Departed mapped site: ${loaded.context.siteRoot}
Previous footer location: ${previousLocation || loaded.context.siteRoot}
Current footer location: ${loaded.currentLocation || 'Unknown'}

The latest story moved the player away from this mapped site. Review its CREATURE assets for characters whom RECENT STORY establishes also left the site. If they joined [PARTY], REMOVE_ASSET those exact records. If they departed without joining [PARTY], SET_ASSET state LEFT with cause and destination in detail — keep the record so later Evolution can continue that thread. Do not speculate and do not purge residents merely because the player left. Do not add or move assets on the destination map; this pass owns only cleanup of the departed site.`;
    }
    if (inspectorPass) {
        const footer = loaded.currentLocation || 'Unknown';
        const onSite = footer !== 'Unknown'
            && normalizeDungeonLabel(footer).includes(normalizeDungeonLabel(loaded.context.siteRoot));
        return `## INSPECTOR TARGET SITE
${loaded.context.siteRoot}
This manual pass targets this exact site from Map Details. The party ${onSite ? 'may be here — the footer below can ground BUILDING entry.' : 'is likely elsewhere — ignore footer-based BUILDING first-entry unless RECENT STORY clearly applies to this site.'}

## PARTY FOOTER LOCATION
${footer}
Parsed from the narrator status footer for context only when it matches this site.`;
    }
    return `## CURRENT LOCATION
${loaded.currentLocation || 'Unknown'}
Parsed from the narrator status footer. A more specific named interior on this line is a durable map fact. Exterior-relative phrasing (behind / outside / near / in front of a landmark) is district position only — do not ADD_ASSET a BUILDING for it. If RECENT STORY is empty, still apply CURRENT LOCATION.`;
}

function initialUserPrompt(loaded, recentStory, memo, currentTime, populationTarget = null, directInstruction = '', { inspectorPass = false, exitPass = false, previousLocation = '' } = {}) {
    const instruction = String(directInstruction || '').trim();
    if (instruction) {
        return `DIRECT MAP COMMAND

## DIRECT INSTRUCTION (AUTHORITATIVE SCOPE)
${instruction}

## TARGET MAP
Exact site root: ${loaded.context.siteRoot}
Kind: ${normalizeMapSiteKind(loaded.context.document?.kind)}

## CURRENT MAP
${formatDungeonMapForUpdater(loaded.context.document, '')}
${partyRosterSection(memo, { directPass: true })}
## OPTIONAL INTERPRETIVE CONTEXT
Current footer: ${loaded.currentLocation || 'Unknown'}
Current in-world time: ${currentTime || 'Unknown'}
Recent story:
${recentStory || '(No additional recent context.)'}

Use this context only to resolve references in the DIRECT INSTRUCTION. Do not derive extra maintenance work from it.
Output only the required JSON object.`;
    }
    const kind = normalizeMapSiteKind(loaded.context.document?.kind);
    return `UPDATE THE ATTACHED MAP
Exact site root: ${loaded.context.siteRoot}
Kind: ${kind}
${kindRule(kind)}

${formatLocationSection(loaded, { inspectorPass, exitPass, previousLocation })}
${partyRosterSection(memo)}
## CURRENT IN-WORLD TIME (AUTHORITATIVE)
${currentTime || 'Unknown'}
Compare absolute asset duration timestamps against this value. A met or passed boundary is a durable map fact even when RECENT STORY does not narrate it.

## CURRENT MAP
${formatDungeonMapForUpdater(loaded.context.document, loaded.currentLocation)}
${formatBuildingPopulationBundle(populationTarget)}

## RECENT STORY
${recentStory || '(No additional recent context.)'}
${formatDirectInstructionBlock(directInstruction)}
Output only the required JSON object. Use {"noop":true} when no durable map fact changed.`;
}

function correctionPrompt(loaded, recentStory, priorOutput, errors, attempt, memo, currentTime, populationTarget = null, directInstruction = '', { inspectorPass = false, exitPass = false, previousLocation = '' } = {}) {
    const instruction = String(directInstruction || '').trim();
    if (instruction) {
        return `DIRECT COMMAND CORRECTION PASS ${attempt}
Return one complete corrected JSON object. Reuse the previous operation_id unless the validation error says otherwise.

## DIRECT INSTRUCTION (AUTHORITATIVE SCOPE)
${instruction}

## VALIDATION ERRORS
${formatFailure(errors)}

## PREVIOUS OUTPUT
${priorOutput}

## CURRENT MAP
${formatDungeonMapForUpdater(loaded.context.document, '')}
${partyRosterSection(memo, { directPass: true })}
Optional context: footer=${loaded.currentLocation || 'Unknown'}; time=${currentTime || 'Unknown'}
Recent story:
${recentStory || '(No additional recent context.)'}

Correct only what the errors require while preserving the direct instruction's scope. Output JSON only.`;
    }
    return `CORRECTION PASS ${attempt}
Your previous map update was rejected. Return a complete corrected JSON object, not a patch. Reuse the same operation_id unless the error says to mint a new one.

Requested site: ${loaded.context.siteRoot}

VALIDATION ERRORS
${formatFailure(errors)}

PREVIOUS OUTPUT
${priorOutput}

${formatLocationSection(loaded, { inspectorPass, exitPass, previousLocation })}
${partyRosterSection(memo)}
## CURRENT IN-WORLD TIME (AUTHORITATIVE)
${currentTime || 'Unknown'}

## CURRENT MAP
${formatDungeonMapForUpdater(loaded.context.document, loaded.currentLocation)}
${formatBuildingPopulationBundle(populationTarget)}

## RECENT STORY
${recentStory || '(No additional recent context.)'}
${formatDirectInstructionBlock(directInstruction)}

Output only the corrected JSON object.`;
}

function finishMapUpdater(ctx, snapshot, { applied = false, stampSwipe = true } = {}) {
    persistMapUpdaterLastRunWatermark(ctx.chat?.length || 0);
    persistMapUpdaterLastRunTimestamp();
    if (applied && stampSwipe) stampTriggerMessage(ctx, snapshot);
}

/**
 * Undo a Map Updater write that belonged to an abandoned swipe.
 * @returns {Promise<boolean>}
 */
export async function maybeRollbackMapUpdaterForSwipe(msg) {
    if (!msg?.extra || msg.extra.rpgMapUpdaterRanForSwipe === undefined) return false;
    const currentSwipeId = msg.swipe_id ?? 0;
    if (msg.extra.rpgMapUpdaterRanForSwipe === currentSwipeId) return false;
    if (getSettings().routerSwipeRollback === false) {
        delete msg.extra.rpgMapUpdaterRanForSwipe;
        return false;
    }
    const ctx = SillyTavern.getContext();
    const snapshot = swipeSnapshots.get(swipeSnapshotKey(ctx, msg, msg.extra.rpgMapUpdaterRanForSwipe));
    delete msg.extra.rpgMapUpdaterRanForSwipe;
    if (!snapshot) return false;
    return restoreCampaignLocationsBook(snapshot, ctx);
}

/**
 * One occupancy-maintenance pass for the currently mapped site.
 * Skips when Persistent Maps is off, no map is active, Lorebook Agent is busy, or auto-updates are disabled.
 * @param {{ isManual?: boolean, lookback?: number|null, buildingIntent?: string, directInstruction?: string, siteRoot?: string|null, trigger?: 'normal'|'site_exit', deferWatermark?: boolean, stampSwipe?: boolean }} [options]
 */
export async function runMapUpdaterPass({ isManual = false, lookback = null, buildingIntent = '', directInstruction = '', siteRoot = null, trigger = 'normal', deferWatermark = false, stampSwipe = true } = {}) {
    const settings = getSettings();
    if (settings.mapUpdaterEnabled === false && !isManual) return { skipped: 'disabled' };
    if (!isLocationMappingEnabled(settings)) return { skipped: 'location_mapping_off' };
    if (_mapUpdaterRunning || _mapUpdaterStarting || isRouterRunning() || isMapEvolutionRunning()) return { skipped: 'busy' };

    const ctx = SillyTavern.getContext();
    const requestedSite = String(siteRoot || '').trim();
    const instruction = String(directInstruction || '').trim();
    const directPass = !!instruction;
    const exitPass = trigger === 'site_exit';
    _mapUpdaterStarting = true;
    try {
        let loaded;
        let inspectorPass = false;
        if (requestedSite) {
            const siteLoaded = await loadDungeonMapContextForSite(requestedSite);
            if (!siteLoaded?.context) return { skipped: 'no_such_map' };
            loaded = {
                context: siteLoaded.context,
                books: siteLoaded.books,
                currentLocation: siteLoaded.currentLocation,
            };
            inspectorPass = !siteLoaded.isActiveSite && !exitPass;
        } else {
            const activeLoaded = await loadActiveDungeonMapContext();
            if (!activeLoaded?.context) return { skipped: 'no_active_map' };
            loaded = activeLoaded;
        }
        const populationTarget = directPass || inspectorPass
            ? null
            : buildingIntent
                ? resolveBuildingIntentPopulationTarget(loaded.context.document, loaded.currentLocation, buildingIntent)
                : resolveBuildingPopulationTarget(loaded.context.document, loaded.currentLocation);
        if (buildingIntent && !populationTarget) return { skipped: 'no_building_intent' };
        if (_mapUpdaterRunning || isRouterRunning() || isMapEvolutionRunning()) return { skipped: 'busy' };

        _mapUpdaterRunning = true;
        if (_mapUpdaterController) _mapUpdaterController.abort();
        _mapUpdaterController = new AbortController();
        const signal = _mapUpdaterController.signal;
        document.dispatchEvent(new CustomEvent('rt_map_updater_status', { detail: { running: true } }));
        broadcastStep('start', 'Initializing Map Updater...');

        const kind = normalizeMapSiteKind(loaded.context.document?.kind);
        broadcastStep('thought', `Site: ${loaded.context.siteRoot} (${kind})\nCurrent location: ${loaded.currentLocation || 'Unknown'}`);

        const snapshot = await snapshotCampaignLocationsBook();
        const recentStory = recentStoryContext(ctx, settings, {
            isManual,
            lookback,
            minLookbackTurns: populationTarget ? BUILDING_POPULATION_MIN_LOOKBACK_TURNS : null,
        });
        const memo = settings.currentMemo || '';
        const currentTime = currentTimeFrom(settings, recentStory);
        const systemPrompt = selectMapUpdaterSystemPrompt(
            instruction,
            settings.mapUpdaterSystemPrompt || DEFAULT_MAP_UPDATER_SYSTEM_PROMPT,
        );
        const promptOpts = {
            inspectorPass,
            exitPass,
            previousLocation: exitPass ? previousFooterForSite(ctx.chat, loaded.context.siteRoot) : '',
        };
        let prompt = initialUserPrompt(loaded, recentStory, memo, currentTime, populationTarget, instruction, promptOpts);
        let lastIssues = [];

        for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
            if (signal.aborted) {
                const abortError = new Error('The operation was aborted.');
                abortError.name = 'AbortError';
                throw abortError;
            }
            if (!isLocationMappingEnabled(getSettings())) {
                stopMapUpdaterPass();
                return { skipped: 'location_mapping_off' };
            }
            if (attempt > 0) broadcastStep('thought', `Correction pass ${attempt}...`);
            else broadcastStep('thought', 'Requesting occupancy update...');
            const output = await sendStateRequest(requestSettings(settings), systemPrompt, prompt, signal);
            const parsed = parseMapArchitectResponse(output);
            if (!parsed.value) {
                lastIssues = [{ code: 'INVALID_JSON', path: '$', hint: parsed.error || 'No JSON object was found.' }];
                if (attempt < MAX_CORRECTION_ATTEMPTS) {
                    prompt = correctionPrompt(loaded, recentStory, output, lastIssues, attempt + 1, memo, currentTime, populationTarget, instruction, promptOpts);
                    continue;
                }
                break;
            }
            const partyIssues = rejectPartyMemberAssets(parsed.value, memo);
            if (partyIssues.length) {
                lastIssues = partyIssues;
                if (attempt < MAX_CORRECTION_ATTEMPTS) {
                    prompt = correctionPrompt(loaded, recentStory, output, lastIssues, attempt + 1, memo, currentTime, populationTarget, instruction, promptOpts);
                    continue;
                }
                break;
            }
            const partyRemovalIssues = directPass
                ? []
                : validatePartyMemberRemovalTransaction(parsed.value, loaded.context.document, memo);
            if (partyRemovalIssues.length) {
                lastIssues = partyRemovalIssues;
                if (attempt < MAX_CORRECTION_ATTEMPTS) {
                    prompt = correctionPrompt(loaded, recentStory, output, lastIssues, attempt + 1, memo, currentTime, populationTarget, instruction, promptOpts);
                    continue;
                }
                break;
            }
            if (isMapUpdaterNoop(parsed.value)) {
                const populationIssues = validateBuildingPopulationTransaction(parsed.value, populationTarget);
                if (populationIssues.length) {
                    lastIssues = populationIssues;
                    if (attempt < MAX_CORRECTION_ATTEMPTS) {
                        prompt = correctionPrompt(loaded, recentStory, output, lastIssues, attempt + 1, memo, currentTime, populationTarget, instruction, promptOpts);
                        continue;
                    }
                    break;
                }
                if (!deferWatermark) finishMapUpdater(ctx, snapshot, { applied: false });
                if (settings.debugMode) console.log('[RPG Tracker] Map Updater: noop.');
                broadcastStep('finish', 'Noop — no durable map fact changed.');
                return { ok: true, noop: true };
            }
            const populationIssues = validateBuildingPopulationTransaction(parsed.value, populationTarget);
            if (populationIssues.length) {
                lastIssues = populationIssues;
                if (attempt < MAX_CORRECTION_ATTEMPTS) {
                    prompt = correctionPrompt(loaded, recentStory, output, lastIssues, attempt + 1, memo, currentTime, populationTarget, instruction, promptOpts);
                    continue;
                }
                break;
            }
            const validation = applyDungeonMapTransaction(loaded.context.document, parsed.value, { currentTime });
            if (!validation.ok) {
                lastIssues = validation.errors || [];
                if (attempt < MAX_CORRECTION_ATTEMPTS) {
                    prompt = correctionPrompt(loaded, recentStory, output, lastIssues, attempt + 1, memo, currentTime, populationTarget, instruction, promptOpts);
                    continue;
                }
                break;
            }
            broadcastStep('result', summarizeMapUpdaterOperations(parsed.value) || 'Transaction accepted.');
            const mapResult = requestedSite
                ? await applyDungeonMapCommit(parsed.value, loaded.context, loaded.books, currentTime, { requireActive: false })
                : await applyActiveDungeonMapCommit(parsed.value, loaded.context, loaded.books, currentTime);
            if (!mapResult.ok) {
                lastIssues = mapResult.errors || [{ code: mapResult.code || 'MAP_COMMIT_FAILED', path: 'map', hint: 'Persistence rejected the transaction.' }];
                if (attempt < MAX_CORRECTION_ATTEMPTS && mapResult.retryable !== false) {
                    prompt = correctionPrompt(loaded, recentStory, output, lastIssues, attempt + 1, memo, currentTime, populationTarget, instruction, promptOpts);
                    continue;
                }
                break;
            }
            const shouldStampSwipe = stampSwipe && populationTarget?.phase !== 'intent';
            if (!deferWatermark) {
                finishMapUpdater(ctx, snapshot, { applied: true, stampSwipe: shouldStampSwipe });
            } else if (shouldStampSwipe) {
                stampTriggerMessage(ctx, snapshot);
            }
            if (settings.debugMode) {
                console.log('[RPG Tracker] Map Updater applied', mapResult.operationId || parsed.value.operation_id);
            }
            if (mapResult.alreadyApplied) {
                broadcastStep('finish', 'Already applied.');
            } else {
                const n = Array.isArray(parsed.value.operations) ? parsed.value.operations.length : 0;
                broadcastStep('finish', `Applied ${n} operation${n === 1 ? '' : 's'}.`);
                settings.mapEvolutionThreadsBySite = appendEvolutionThreads(
                    settings.mapEvolutionThreadsBySite,
                    loaded.context.siteRoot,
                    threadsFromMapTransaction(parsed.value, {
                        at: currentTime,
                        createdAssets: mapResult.createdAssets || [],
                    }),
                );
                persistMapEvolutionState();
            }
            return { ok: true, result: mapResult };
        }

        const concise = lastIssues.slice(0, 8).map(issue => `${issue.code} at ${issue.path}: ${issue.hint}`).join('; ');
        console.warn('[RPG Tracker] Map Updater could not apply a valid transaction:', concise || 'unknown error');
        if (!deferWatermark) {
            persistMapUpdaterLastRunWatermark(ctx.chat?.length || 0);
            persistMapUpdaterLastRunTimestamp();
        }
        broadcastStep('error', concise || 'Validation failure.');
        return { ok: false, errors: lastIssues };
    } catch (error) {
        if (error?.name === 'AbortError') {
            console.log('[RPG Tracker] Map Updater aborted by user.');
            if (_mapUpdaterRunning) broadcastStep('error', 'Stopped by user.');
            return { skipped: 'stopped' };
        }
        console.error('[RPG Tracker] Map Updater failed:', error);
        if (_mapUpdaterRunning) broadcastStep('error', String(error?.message || error));
        return { ok: false, error: String(error?.message || error) };
    } finally {
        _mapUpdaterStarting = false;
        if (_mapUpdaterRunning) {
            _mapUpdaterRunning = false;
            _mapUpdaterController = null;
            document.dispatchEvent(new CustomEvent('rt_map_updater_status', { detail: { running: false } }));
        }
    }
}

/**
 * MESSAGE_SENT hook. SillyTavern awaits this event before assembling the main
 * narrator prompt, so a matched BUILDING receives hidden contents first.
 */
export async function onMapUpdaterUserMessage(messageId) {
    const ctx = SillyTavern.getContext();
    const index = Number(messageId);
    if (!Number.isInteger(index) || index !== (ctx.chat?.length || 0) - 1) return { skipped: 'not_latest_user_message' };
    const message = ctx.chat?.[index];
    if (!message?.is_user || message?.is_system) return { skipped: 'not_user_message' };
    const buildingIntent = String(message.mes || '').trim();
    if (!buildingIntent) return { skipped: 'empty_user_message' };
    return runMapUpdaterPass({ buildingIntent });
}
