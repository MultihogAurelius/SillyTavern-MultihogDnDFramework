/**
 * Map Evolution — off-screen site simulation with lazy World Report pressure.
 *
 * Separate module from Map Updater occupancy: own prompt, own cadence, same
 * transaction API. Never mixed into the occupancy request.
 */
import { getEffectiveRouterCampaignPrefix, getSettings, hydrateWorldProgressionFromChatState, persistMapEvolutionState } from './state-manager.js';
import { runtimeState } from './src/app/runtime-state.js';
import { sendStateRequest, isCombatActive } from './llm-client.js';
import { extractCurrentTimeStr } from './memo-processor.js';
import {
    applyDungeonMapTransaction,
    formatDungeonMapForEvolution,
    normalizeDungeonLabel,
    normalizeMapSiteKind,
    resolveCurrentMapPlacement,
} from './dungeon-reality.js';
import { isLocationMappingEnabled } from './src/state/section-enabled.js';
import { parseMapArchitectResponse } from './map-architect-parser.js';
import { DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT } from './map-evolution-prompt.js';
import { DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT } from './map-evolution-compress-prompt.js';
import {
    appendEvolutionBacklogEntry,
    appendEvolutionThreads,
    applyCompressedThreadDigests,
    buildReportOutcomeStamps,
    describeEvolutionBacklog,
    describeEvolutionThreads,
    describeEvolutionTimeWindow,
    estimateMapHistoryTokens,
    evolutionIntervalHoursForSettings,
    filterSitesByRoots,
    formatClosedThreadsForCompression,
    formatEvolutionElapsedMinutes,
    formatEvolutionThreadLine,
    isEvolutionNoop,
    normalizeEvolutionTickScope,
    normalizeMapEvolutionCompressThreshold,
    partitionCompressibleThreads,
    stripEvolutionDigestSitePrefix,
    pickSitesForEvolutionTick,
    resolvePlayerBubble,
    siteEvolutionDue,
    storedEvolutionThreads,
    summarizeEvolutionDigest,
    threadsFromMapTransaction,
} from './map-evolution-lib.js';
import {
    applyDungeonMapCommit,
    isRouterRunning,
    loadAllMappedSiteContexts,
    parseInWorldMinutes,
    restoreCampaignLocationsBook,
    snapshotCampaignLocationsBook,
} from './router.js';
import {
    normalizeWorldReportMetadata,
    selectPendingWorldReportsForLocation,
    WORLD_REPORT_METADATA_KEY,
} from './world-progression-lib.js';

export {
    appendEvolutionBacklogEntry,
    appendEvolutionThreads,
    buildReportOutcomeStamps,
    describeEvolutionBacklog,
    describeEvolutionThreads,
    describeEvolutionTimeWindow,
    filterSitesByRoots,
    formatEvolutionElapsedMinutes,
    normalizeEvolutionTickScope,
    pickSitesForEvolutionTick,
    resolvePlayerBubble,
    siteEvolutionDue,
    summarizeEvolutionDigest,
    threadsFromMapTransaction,
};

const MAX_CORRECTION_ATTEMPTS = 2;
const swipeSnapshots = new Map();
let _mapEvolutionRunning = false;
let _mapEvolutionStarting = false;
let _mapEvolutionController = null;

export function isMapEvolutionRunning() {
    return _mapEvolutionRunning;
}

export function stopMapEvolutionPass() {
    if (_mapEvolutionController) {
        _mapEvolutionController.abort();
        _mapEvolutionController = null;
    }
}

function broadcastStep(type, content, metadata = {}) {
    document.dispatchEvent(new CustomEvent('rt_lore_agent_step', {
        detail: { type, content, metadata: { source: 'map_evolution', ...metadata }, timestamp: Date.now() },
    }));
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
        maxTokens: Math.max(1000, Number(settings.mapEvolutionMaxTokens) || 25000),
        debugMode: !!settings.debugMode,
    };
}

function currentTimeFrom(settings) {
    const memoTimeMatch = settings.currentMemo?.match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    return memoTimeMatch ? extractCurrentTimeStr(memoTimeMatch[1]) : '';
}

function lastFiredMinutesForSite(settings, siteRoot) {
    const key = normalizeDungeonLabel(siteRoot);
    const label = settings.mapEvolutionLastFiredBySite?.[key] || '';
    return label ? parseInWorldMinutes(label) : -1;
}

function stampSiteFired(settings, siteRoot, timeLabel) {
    const key = normalizeDungeonLabel(siteRoot);
    if (!settings.mapEvolutionLastFiredBySite || typeof settings.mapEvolutionLastFiredBySite !== 'object') {
        settings.mapEvolutionLastFiredBySite = {};
    }
    settings.mapEvolutionLastFiredBySite[key] = timeLabel;
}

function reportApplicationsForSite(settings, siteRoot) {
    const siteKey = normalizeDungeonLabel(siteRoot);
    if (!settings.mapEvolutionWorldReportApplications || typeof settings.mapEvolutionWorldReportApplications !== 'object') {
        settings.mapEvolutionWorldReportApplications = {};
    }
    if (!settings.mapEvolutionWorldReportApplications[siteKey]
        || typeof settings.mapEvolutionWorldReportApplications[siteKey] !== 'object') {
        settings.mapEvolutionWorldReportApplications[siteKey] = {};
    }
    return settings.mapEvolutionWorldReportApplications[siteKey];
}

async function loadRecentWorldReports(settings, ctx) {
    const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId || ctx.getCurrentChatId?.() || '');
    const worldBookName = prefix ? `${prefix}_World` : 'World';
    let book = null;
    try { book = await ctx.loadWorldInfo(worldBookName); } catch (_) {}
    if (!book?.entries) return [];

    return Object.entries(book.entries)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([uid, entry]) => {
            const label = String(entry?.comment || '').trim();
            const keys = Array.isArray(entry?.key) ? entry.key.map(value => String(value || '').toLowerCase()) : [];
            const hasMetadata = !!entry?.extensions?.[WORLD_REPORT_METADATA_KEY];
            const recognizableLegacyReport = keys.includes('world progression')
                || keys.includes('world report')
                || /^day\s+\d+\b/i.test(label);
            if (!hasMetadata && !recognizableLegacyReport) return null;
            if (/condensed|compressed|merged|summary/i.test(label)
                || /^days?\s+\d+\s*[-–—]\s*\d+/i.test(label)) return null;
            const metadata = normalizeWorldReportMetadata(entry, worldBookName, uid);
            return metadata.reportId
                ? { ...metadata, content: String(entry?.content || '') }
                : null;
        })
        .filter(Boolean);
}

function pendingWorldReportsForSite(reports, siteRoot, settings) {
    const applied = reportApplicationsForSite(settings, siteRoot);
    return selectPendingWorldReportsForLocation(reports, siteRoot, {
        lookback: settings.mapEvolutionWorldReportLookback,
        applied,
    });
}

function formatWorldReportPressures(reports) {
    if (!Array.isArray(reports) || reports.length === 0) {
        return '(No unconsumed World Report pressure applies to this location.)';
    }
    return reports.map(report =>
        `### ${report.periodLabel || 'World Report'} [report_id: ${report.reportId}]\n${report.excerpt}`,
    ).join('\n\n');
}

function formatEvolutionThreads(threads) {
    const openLines = (threads.open || []).map(entry => formatEvolutionThreadLine({ ...entry, status: 'open', compressed: false }));
    const recentLines = (threads.entries || []).map(entry => formatEvolutionThreadLine(entry));
    const open = openLines.length
        ? openLines.join('\n')
        : '(No open causal threads are retained for this site.)';
    const recent = recentLines.length
        ? recentLines.join('\n')
        : '(No attributed map changes are retained as threads yet.)';
    return `Open threads (latest per subject):
${open}
${threads.truncated ? '(Only the most recent bounded portion of the thread ledger is shown.)\n' : ''}Recent attributed events (DIGEST lines are already-compressed closed history; do not treat them as live open plots):
${recent}`;
}

function parseCompressionDigests(raw) {
    const parsed = parseMapArchitectResponse(raw);
    const value = parsed.value;
    if (!value) return { ok: false, error: parsed.error || 'No JSON object was found.' };
    let rows = [];
    if (Array.isArray(value.digests)) rows = value.digests;
    else if (Array.isArray(value)) rows = value;
    else if (typeof value.summary === 'string') rows = [value];
    const digests = rows.map(row => {
        if (typeof row === 'string') return { at: 'Compressed history', summary: row };
        return {
            at: String(row?.at || row?.span || '').trim(),
            summary: String(row?.summary || row?.cause || '').trim(),
        };
    }).filter(row => row.summary);
    if (!digests.length) return { ok: false, error: 'No digests' };
    return { ok: true, digests: digests.slice(0, 6) };
}

async function maybeCompressSiteThreads(settings, siteRoot, signal) {
    if (settings.mapEvolutionCompressEnabled === false) return { skipped: 'disabled' };
    const threshold = normalizeMapEvolutionCompressThreshold(settings.mapEvolutionCompressThreshold);
    const stored = storedEvolutionThreads(settings.mapEvolutionThreadsBySite, siteRoot);
    const { open, closed } = partitionCompressibleThreads(stored);
    if (closed.length < 2) return { skipped: 'too_few_closed' };
    const tokens = estimateMapHistoryTokens(formatClosedThreadsForCompression(closed));
    if (tokens < threshold) return { skipped: 'under_threshold', tokens, threshold };

    const systemPrompt = String(settings.mapEvolutionCompressSystemPrompt || DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT).trim();
    const openText = open.length
        ? open.map(entry => formatEvolutionThreadLine({ ...entry, status: 'open', compressed: false })).join('\n')
        : '(No currently open threads.)';
    const closedText = formatClosedThreadsForCompression(closed);
    const userPrompt = `SITE: ${siteRoot}

OPEN THREADS — keep these verbatim. Do not rewrite, omit, merge, or fold them into digests.
${openText}

CLOSED / RESOLVED / TRANSFORMED EVENTS AND PRIOR DIGESTS — this is the only compressible pool (${tokens} estimated tokens; threshold ${threshold}):
${closedText}

Return JSON only.`;
    const req = {
        ...requestSettings(settings),
        maxTokens: Math.max(1000, Math.min(8000, Number(settings.mapEvolutionMaxTokens) || 4000)),
    };
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        if (signal.aborted) {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            throw abortError;
        }
        broadcastStep('thought', `${siteRoot}: compressing evolution history (${tokens} tokens ≥ ${threshold})...`);
        const output = await sendStateRequest(
            req,
            attempt ? `${systemPrompt}\n\nPrevious output was not valid digest JSON. ${lastError}` : systemPrompt,
            userPrompt,
            signal,
            { stream: true, debugSource: 'Map Evolution' },
        );
        const parsed = parseCompressionDigests(output);
        if (parsed.ok) {
            settings.mapEvolutionThreadsBySite = applyCompressedThreadDigests(
                settings.mapEvolutionThreadsBySite,
                siteRoot,
                parsed.digests,
            );
            broadcastStep('finish', `${siteRoot}: compressed closed-thread history into ${parsed.digests.length} digest${parsed.digests.length === 1 ? '' : 's'}.`);
            return { ok: true, tokens, threshold, digests: parsed.digests.length };
        }
        lastError = parsed.error || 'Invalid JSON';
    }
    console.warn('[RPG Tracker] Map Evolution history compression failed for', siteRoot, lastError);
    broadcastStep('thought', `${siteRoot}: history compression skipped (${lastError}).`);
    return { ok: false, error: lastError };
}

function recordSiteThreads(settings, siteRoot, transaction, createdAssets, at) {
    settings.mapEvolutionThreadsBySite = appendEvolutionThreads(
        settings.mapEvolutionThreadsBySite,
        siteRoot,
        threadsFromMapTransaction(transaction, { at, createdAssets }),
    );
}

function formatEvolutionBacklog(backlog, siteRoot = '') {
    const lines = backlog.entries.map(entry => {
        const outcome = entry.kind === 'commit' ? 'MATERIAL COMMIT' : 'QUIET CHECKPOINT';
        const interval = entry.elapsedMinutes >= 0
            ? formatEvolutionElapsedMinutes(entry.elapsedMinutes)
            : 'Unknown interval';
        const passes = entry.kind === 'quiet' && entry.passes > 1 ? ` across ${entry.passes} passes` : '';
        const operation = entry.operationId ? ` [operation_id: ${entry.operationId}]` : '';
        const summary = stripEvolutionDigestSitePrefix(entry.summary, siteRoot);
        return `- ${entry.at} — ${outcome}${passes}${operation}; accumulated preceding time: ${interval}; ${summary}`;
    });
    const history = lines.length
        ? lines.join('\n')
        : '(No prior Map Evolution checkpoints are retained for this site.)';
    return `Recent trajectory represented, including the current gap: ${backlog.representedElapsed}
Quiet time accumulated since the most recent material commit, including the current gap: ${backlog.quietElapsed}
${backlog.truncated ? '(Only the most recent bounded portion of the trajectory is shown.)\n' : ''}${history}`;
}

function stampReportOutcomes(settings, siteRoot, outcomes, consideredAt) {
    const applied = reportApplicationsForSite(settings, siteRoot);
    for (const outcome of outcomes || []) {
        if (!outcome?.reportId) continue;
        applied[outcome.reportId] = {
            status: outcome.status || 'considered',
            localDigest: outcome.localDigest || '',
            consideredAt: String(consideredAt || '').trim(),
        };
    }
    const reportIds = Object.keys(applied);
    for (const reportId of reportIds.slice(0, Math.max(0, reportIds.length - 50))) {
        delete applied[reportId];
    }
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

function kindPolicy(kind) {
    if (kind === 'SETTLEMENT') {
        return 'SETTLEMENT: district, BUILDING, OBJECT, and occupant change is expected when logical. BUILDING is an ordinary structure; OBJECT is a prop. Never create/promote SUBDUNGEON or SUBINTERIOR—CreateAreaMap owns peer-map promotion. Several districts or groups may change in one tick. Preserve play-established reality.';
    }
    if (kind === 'INTERIOR') {
        return 'INTERIOR: evolve ordinary room-scale occupancy, schedules, projects, access, and wear conservatively. Do not manufacture dungeon danger; respect NONE/LOW threat and established purpose.';
    }
    return 'DUNGEON: restock and new occupants are expected when they make logical and narrative sense. Living CREATURE/GROUP assets may act independently each tick — patrol, forage, rest, fortify, clash, talk, hang around, or pursue an archetype-fitting project — or stay put when that makes sense. Hostile kinds may cooperate or share downtime; same-room is not automatically a fight. Hours elapsed with several living groups may mean several operations, not one patrol MOVE, but idle occupants are allowed. Original factions, rival adventurers, scavengers, wildlife, or anyone the site could attract. Do not revive DESTROYED/DEAD assets.';
}

function triggerHeadline(trigger) {
    if (trigger === 'site_exit') return 'SITE EXIT RESTOCK / DECAY';
    if (trigger === 'manual') return 'MANUAL MAP EVOLUTION';
    return 'INTERVAL RESTLESSNESS';
}

function initialUserPrompt({ site, trigger, worldReports, digest, bubble, currentLocation, partyIsHere, timeWindow, backlog, threads }) {
    const kind = normalizeMapSiteKind(site.document?.kind);
    const bubbleLine = bubble.area
        ? `${bubble.area.id} (${bubble.area.name})${bubble.combatActive ? ' — combat is active' : ''}`
        : '(Party is not inside this site. No freeze.)';
    const reportBlock = formatWorldReportPressures(worldReports);
    const digestBlock = String(digest || '').trim() || '(None yet this period.)';
    return `${triggerHeadline(trigger)}
Exact site root: ${site.siteRoot}
Kind: ${kind}
${kindPolicy(kind)}

## EVOLUTION TIME WINDOW (AUTHORITATIVE)
Last Evolved for this site: ${timeWindow.lastEvolved}
Current in-world time: ${timeWindow.currentTime}
Elapsed since Last Evolved: ${timeWindow.elapsed}
Scale both the amount and the breadth of change to this elapsed duration. Minutes: one local reaction can be enough. Hours with several living CREATURE/GROUP assets: several operations in this one transaction when several occupants would plausibly stir; staying put is valid. Do not use a single asset's patrol commute as the entire result. A manual or site-exit trigger does not imply that a full interval has passed. If elapsed time is unknown, do not invent a long unattended period.

## ACCUMULATED EVOLUTION BACKLOG (THIS SITE)
${formatEvolutionBacklog(backlog, site.siteRoot)}

Judge the latest interval together with this trajectory. A short latest interval limits what happened during that interval, but it does not erase accumulated quiet time or prior developments. Do not choose noop solely because the latest interval is short. Let repeated quiet checkpoints build enough opportunity for a meaningful change, and let prior commits continue, complicate, culminate, resolve, or reverse rather than mechanically repeating them.

## OPEN CAUSAL THREADS (THIS SITE)
${formatEvolutionThreads(threads || { open: [], entries: [] })}

Continue, complicate, culminate, resolve, or transform these threads when plausible. A DESTROYED/DEAD asset with actor is a killed-by fact you may build on. Do not invent a killer for unknown actors. Mark thread_status resolved when this change ends the plot for that subject — including return to baseline (customary patrol, settled vigil, going home to forage after the disturbance is over). Mark transformed when the plot continues in a new shape. Omitted thread_status defaults to open, so set resolved/transformed explicitly. Do not leave restored routine as a new OPEN thread. Do not leave an open thread hanging while the whole tick is an unrelated singleton MOVE.

## PLAYER BUBBLE (FROZEN)
${partyIsHere ? bubbleLine : '(Party is not inside this site. No freeze.)'}
Do not MOVE, ADD, SET, or REMOVE assets in the frozen area. Do not SET_CONNECTION or SET_AREA on it.

## CURRENT LOCATION
${currentLocation || 'Unknown'}

## CURRENT MAP
${formatDungeonMapForEvolution(site.document, partyIsHere ? currentLocation : '')}

## WORLD REPORT PRESSURES
${reportBlock}

These reports are directional prose, not explicit deltas. Decide the best concrete local realization using this map and its current state. A newer pressure may reverse or supersede an older direction while leaving plausible aftermath. If play or the Map Updater already realized a pressure, preserve it and mark that report already_realized_by_play instead of duplicating it.

## PRIOR EVOLUTION THIS PERIOD
${digestBlock}

Output only the required JSON object. Include report_outcomes when World Report pressures are supplied: [{"report_id":"exact supplied id","status":"materialized|already_realized_by_play|considered"}]. Prefer durable change when in-world time has passed, but only if it makes logical and narrative sense for this site. Hours plus several living occupants may yield several operations when several would stir; idle occupants may stay. Use {"noop":true} only when this site would not plausibly stir.`;
}

function correctionPrompt({ site, trigger, worldReports, digest, bubble, currentLocation, partyIsHere, timeWindow, backlog, threads, priorOutput, errors, attempt }) {
    return `CORRECTION PASS ${attempt}
Your previous map evolution was rejected. Return a complete corrected JSON object, not a patch. Reuse the same operation_id unless the error says to mint a new one.

Requested site: ${site.siteRoot}

VALIDATION ERRORS
${formatFailure(errors)}

Field reminder: Every operation needs cause. DEAD/DESTROYED also needs actor ("party", an asset id, or a short off-map name). Packs are one GROUP with count (2-99), not many singleton CREATUREs. SET_ASSET count for attrition. Hours plus several living groups: several operations when several would stir, not one patrol MOVE as the whole result; occupants may stay put. same-room is not automatically a fight; in-place detail and archetype-fitting projects are valid activity. Return to baseline is thread_status resolved, not a new open thread. MOVE_ASSET uses "to" and optional "from", never "location". SET_AREA geometry_append is an array of strings. ADD_ASSET uses "location" for the destination area.

PREVIOUS OUTPUT
${priorOutput}

${initialUserPrompt({ site, trigger, worldReports, digest, bubble, currentLocation, partyIsHere, timeWindow, backlog, threads })}`;
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
    trigger.extra.rpgMapEvolutionRanForSwipe = trigger.swipe_id ?? 0;
    swipeSnapshots.set(swipeSnapshotKey(ctx, trigger), snapshot);
}

export async function maybeRollbackMapEvolutionForSwipe(msg) {
    if (!msg?.extra || msg.extra.rpgMapEvolutionRanForSwipe === undefined) return false;
    const currentSwipeId = msg.swipe_id ?? 0;
    if (msg.extra.rpgMapEvolutionRanForSwipe === currentSwipeId) return false;
    if (getSettings().routerSwipeRollback === false) {
        delete msg.extra.rpgMapEvolutionRanForSwipe;
        return false;
    }
    const ctx = SillyTavern.getContext();
    const snapshot = swipeSnapshots.get(swipeSnapshotKey(ctx, msg, msg.extra.rpgMapEvolutionRanForSwipe));
    delete msg.extra.rpgMapEvolutionRanForSwipe;
    if (!snapshot) return false;
    const restored = await restoreCampaignLocationsBook(snapshot.locationsBook || snapshot, ctx);
    if (restored && snapshot.locationsBook) {
        const settings = getSettings();
        settings.mapEvolutionLastFiredBySite = JSON.parse(JSON.stringify(snapshot.lastFiredBySite || {}));
        settings.mapEvolutionWorldReportApplications = JSON.parse(JSON.stringify(snapshot.reportApplications || {}));
        settings.mapEvolutionBacklogBySite = JSON.parse(JSON.stringify(snapshot.backlogBySite || {}));
        settings.mapEvolutionThreadsBySite = JSON.parse(JSON.stringify(snapshot.threadsBySite || {}));
        persistMapEvolutionState();
    }
    return restored;
}

function activeSiteFrom(loaded, currentLocation) {
    if (!loaded?.sites?.length) return null;
    const here = loaded.sites.find(site =>
        site.siteRoot && currentLocation && normalizeDungeonLabel(currentLocation).includes(normalizeDungeonLabel(site.siteRoot)),
    );
    if (here) return here;
    return loaded.sites.find(site => {
        const placement = resolveCurrentMapPlacement(site.document, currentLocation);
        return !!placement.area;
    }) || null;
}

async function evolveOneSite({
    site,
    books,
    trigger,
    worldReports,
    digest,
    currentLocation,
    currentTime,
    settings,
    signal,
    snapshot,
    ctx,
}) {
    const partyIsHere = !!(currentLocation && (
        normalizeDungeonLabel(currentLocation).includes(normalizeDungeonLabel(site.siteRoot))
        || resolveCurrentMapPlacement(site.document, currentLocation).area
    ));
    const combatActive = partyIsHere && isCombatActive(settings.currentMemo);
    const bubble = partyIsHere
        ? resolvePlayerBubble(site.document, currentLocation, { combatActive })
        : { frozenAreaIds: [], combatActive: false, area: null };
    const frozenAreaIds = bubble.frozenAreaIds;
    const siteKey = normalizeDungeonLabel(site.siteRoot);
    const timeWindow = describeEvolutionTimeWindow(
        settings.mapEvolutionLastFiredBySite?.[siteKey],
        currentTime,
    );
    const backlog = describeEvolutionBacklog(
        settings.mapEvolutionBacklogBySite,
        site.siteRoot,
        timeWindow.elapsedMinutes,
    );
    const threads = describeEvolutionThreads(
        settings.mapEvolutionThreadsBySite,
        site.siteRoot,
    );
    const systemPrompt = `${String(settings.mapEvolutionSystemPrompt || DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).trim()}

AUTHORITATIVE TIME-SCALE CONTRACT
- The supplied Last Evolved timestamp is the scheduler watermark for this exact site.
- Use both the latest elapsed duration and the accumulated per-site Evolution backlog to calibrate amount and breadth: accumulation, decay, arrivals, movement, and how many living groups act. A short latest gap permits only correspondingly small developments within that gap, but repeated short gaps and quiet checkpoints accumulate rather than resetting the site's trajectory.
- Minutes: one local reaction can be enough. Hours with several living CREATURE/GROUP assets: several occupants may act in this same transaction if that is plausible. Independent occupants may all act, but they do not necessarily act if it makes sense for them to stay where they were. Do not spend the whole tick moving a single patrol.
- Co-located groups are not automatically enemies. same-room occupancy may be talk, shared work, a joint project, downtime, or a fight. Hostile kinds may hang around or cooperate on an archetype-fitting project. Continue open threads.
- Do not return noop solely because the latest interval is short. Consider cumulative quiet time and prior commits; a trajectory may continue, complicate, culminate, resolve, or reverse when plausible.
- Manual and site-exit triggers do not imply a standard interval. Never substitute the configured interval for the actual elapsed duration.
- If elapsed time is unknown, remain conservative and do not invent a long unattended period.

AUTHORITATIVE WORLD REPORT CONTRACT
- World Report excerpts are directional macro pressure, never pre-decided map deltas.
- Choose the concrete local realization yourself from the current map state.
- Do not duplicate pressure already realized through play or Map Updater; preserve it and mark already_realized_by_play.
- Newer pressure may reverse, resolve, transform, or supersede an older direction while plausible aftermath remains.
- Return report_outcomes for every supplied report ID. This bookkeeping field is removed before transaction validation.

AUTHORITATIVE CAUSAL THREAD CONTRACT
- Every material operation needs cause. DEAD/DESTROYED also needs actor.
- Open threads are unfinished plots you may continue. Return to baseline (customary patrol, settled vigil, going back to forage after the disturbance ends) is thread_status resolved, not a new open thread.
- Omitted thread_status defaults to open — set resolved or transformed explicitly when the plot ends or changes shape.
- Do not invent a killer when actor is unknown.
- Third-party killing is allowed when it makes logical and narrative sense.`;
    let prompt = initialUserPrompt({
        site, trigger, worldReports, digest, bubble, currentLocation, partyIsHere, timeWindow, backlog, threads,
    });
    let lastIssues = [];
    let lastOutput = '';

    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
        if (signal.aborted) {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            throw abortError;
        }
        if (!isLocationMappingEnabled(getSettings())) {
            stopMapEvolutionPass();
            return { skipped: 'location_mapping_off' };
        }
        if (attempt > 0) broadcastStep('thought', `${site.siteRoot}: correction pass ${attempt}...`);
        else broadcastStep('thought', `${site.siteRoot}: requesting evolution (${trigger})...`);
        const output = await sendStateRequest(requestSettings(settings), systemPrompt, prompt, signal, { stream: true, debugSource: 'Map Evolution' });
        lastOutput = output;
        const parsed = parseMapArchitectResponse(output);
        if (!parsed.value) {
            lastIssues = [{ code: 'INVALID_JSON', path: '$', hint: parsed.error || 'No JSON object was found.' }];
            if (attempt < MAX_CORRECTION_ATTEMPTS) {
                prompt = correctionPrompt({
                    site, trigger, worldReports, digest, bubble, currentLocation, partyIsHere, timeWindow, backlog, threads,
                    priorOutput: output, errors: lastIssues, attempt: attempt + 1,
                });
                continue;
            }
            break;
        }
        if (isEvolutionNoop(parsed.value)) {
            stampTriggerMessage(ctx, snapshot);
            return {
                ok: true,
                noop: true,
                siteRoot: site.siteRoot,
                reportOutcomes: buildReportOutcomeStamps(
                    parsed.value.report_outcomes,
                    worldReports,
                    { noop: true },
                ),
                timeWindow,
            };
        }
        const rawReportOutcomes = parsed.value.report_outcomes;
        const transaction = { ...parsed.value };
        delete transaction.report_outcomes;
        const validation = applyDungeonMapTransaction(site.document, transaction, { frozenAreaIds, currentTime });
        if (!validation.ok) {
            lastIssues = validation.errors || [];
            if (attempt < MAX_CORRECTION_ATTEMPTS) {
                prompt = correctionPrompt({
                    site, trigger, worldReports, digest, bubble, currentLocation, partyIsHere, timeWindow, backlog, threads,
                    priorOutput: output, errors: lastIssues, attempt: attempt + 1,
                });
                continue;
            }
            break;
        }
        const mapResult = await applyDungeonMapCommit(
            transaction,
            site,
            books,
            currentTime,
            { requireActive: false, frozenAreaIds },
        );
        if (!mapResult.ok) {
            lastIssues = mapResult.errors || [{ code: mapResult.code || 'MAP_COMMIT_FAILED', path: 'map', hint: 'Persistence rejected the transaction.' }];
            if (attempt < MAX_CORRECTION_ATTEMPTS && mapResult.retryable !== false) {
                prompt = correctionPrompt({
                    site, trigger, worldReports, digest, bubble, currentLocation, partyIsHere, timeWindow, backlog, threads,
                    priorOutput: output, errors: lastIssues, attempt: attempt + 1,
                });
                continue;
            }
            break;
        }
        if (mapResult.alreadyApplied) {
            broadcastStep('finish', `${site.siteRoot}: already applied.`);
        } else {
            const n = Array.isArray(transaction.operations) ? transaction.operations.length : 0;
            broadcastStep('result', summarizeEvolutionDigest(site.siteRoot, transaction));
            broadcastStep('finish', `${site.siteRoot}: applied ${n} operation${n === 1 ? '' : 's'}.`);
        }
        stampTriggerMessage(ctx, snapshot);
        return {
            ok: true,
            siteRoot: site.siteRoot,
            result: mapResult,
            transaction,
            digestLine: summarizeEvolutionDigest(site.siteRoot, transaction),
            timeWindow,
            reportOutcomes: buildReportOutcomeStamps(
                rawReportOutcomes,
                worldReports,
                { digest: summarizeEvolutionDigest(site.siteRoot, transaction) },
            ),
        };
    }

    const concise = lastIssues.slice(0, 8).map(issue => `${issue.code} at ${issue.path}: ${issue.hint}`).join('; ');
    console.warn('[RPG Tracker] Map Evolution could not apply a valid transaction for', site.siteRoot, concise || lastOutput);
    broadcastStep('error', `${site.siteRoot}: ${concise || 'Validation failure.'}`);
    return { ok: false, siteRoot: site.siteRoot, errors: lastIssues };
}

function resolveSitesForPass(loaded, {
    trigger, isManual, siteRoots, currentLocation, settings, currentMinutes,
}) {
    const sites = loaded.sites || [];
    if (trigger === 'site_exit') {
        const departed = String(settings.mapEvolutionPendingExitRoot || '').trim();
        return sites.filter(site => dungeonRootsEqual(site.siteRoot, departed));
    }
    if (isManual || trigger === 'manual') {
        if (Array.isArray(siteRoots)) {
            return filterSitesByRoots(sites, siteRoots);
        }
        const active = activeSiteFrom(loaded, currentLocation);
        return active ? [active] : [];
    }
    const active = activeSiteFrom(loaded, currentLocation);
    const picked = pickSitesForEvolutionTick(sites, {
        scope: settings.mapEvolutionTickScope,
        count: settings.mapEvolutionTickCount,
        randomize: settings.mapEvolutionTickRandomize !== false,
        selectedRoots: settings.mapEvolutionSelectedRoots,
        currentRoot: active?.siteRoot || '',
        lastFiredMinutesFor: root => lastFiredMinutesForSite(settings, root),
        currentMinutes,
        intervalHours: settings.mapEvolutionIntervalHours,
        intervalHoursFor: evolutionIntervalHoursForSettings(settings, active?.siteRoot || ''),
    });
    return [...picked.baseline, ...picked.due];
}

function dungeonRootsEqual(left, right) {
    const a = normalizeDungeonLabel(left);
    const b = normalizeDungeonLabel(right);
    return !!a && a === b;
}

/**
 * One Map Evolution pass. Sequential per selected site; never dumps every map
 * into a single prompt.
 *
 * @param {{
 *   trigger?: 'interval'|'site_exit'|'manual',
 *   periodLabel?: string,
 *   isManual?: boolean,
 *   siteRoots?: string[],
 * }} [options]
 */
export async function runMapEvolutionPass({
    trigger = 'interval',
    periodLabel = '',
    isManual = false,
    siteRoots = null,
} = {}) {
    hydrateWorldProgressionFromChatState();
    const settings = getSettings();
    if (settings.mapEvolutionEnabled === false && !isManual) return { skipped: 'disabled' };
    if (!isLocationMappingEnabled(settings)) return { skipped: 'location_mapping_off' };
    if (_mapEvolutionRunning || _mapEvolutionStarting || isRouterRunning()) {
        return { skipped: 'busy' };
    }

    const ctx = SillyTavern.getContext();
    _mapEvolutionStarting = true;
    try {
        const loaded = await loadAllMappedSiteContexts();
        if (!loaded?.sites?.length) return { skipped: 'no_maps' };

        const currentLocation = loaded.currentLocation || '';
        const currentTime = periodLabel || currentTimeFrom(settings);
        const currentMinutes = parseInWorldMinutes(currentTime);
        const selected = resolveSitesForPass(loaded, {
            trigger, isManual, siteRoots, currentLocation, settings, currentMinutes,
        });
        if (!selected.length) return { skipped: 'no_matching_sites' };

        const baselineOnly = selected.filter(site => site.stampBaselineOnly);
        const toEvolve = selected.filter(site => !site.stampBaselineOnly);
        if (baselineOnly.length && !toEvolve.length) {
            for (const site of baselineOnly) stampSiteFired(settings, site.siteRoot, currentTime);
            persistMapEvolutionState();
            return { ok: true, baseline: true, sites: baselineOnly.map(site => site.siteRoot) };
        }

        _mapEvolutionRunning = true;
        if (_mapEvolutionController) _mapEvolutionController.abort();
        _mapEvolutionController = new AbortController();
        const signal = _mapEvolutionController.signal;
        document.dispatchEvent(new CustomEvent('rt_map_evolution_status', { detail: { running: true } }));
        broadcastStep('start', `Initializing Map Evolution (${trigger})...`);

        const snapshot = {
            locationsBook: await snapshotCampaignLocationsBook(),
            lastFiredBySite: JSON.parse(JSON.stringify(settings.mapEvolutionLastFiredBySite || {})),
            reportApplications: JSON.parse(JSON.stringify(settings.mapEvolutionWorldReportApplications || {})),
            backlogBySite: JSON.parse(JSON.stringify(settings.mapEvolutionBacklogBySite || {})),
            threadsBySite: JSON.parse(JSON.stringify(settings.mapEvolutionThreadsBySite || {})),
        };
        const digestLines = [];
        const results = [];
        const books = loaded.books;
        const recentWorldReports = await loadRecentWorldReports(settings, ctx);

        for (const site of [...baselineOnly, ...toEvolve]) {
            if (site.stampBaselineOnly) {
                stampSiteFired(settings, site.siteRoot, currentTime);
                continue;
            }
            const siteResult = await evolveOneSite({
                site,
                books,
                trigger,
                worldReports: pendingWorldReportsForSite(recentWorldReports, site.siteRoot, settings),
                digest: digestLines.join('\n'),
                currentLocation,
                currentTime,
                settings,
                signal,
                snapshot,
                ctx,
            });
            results.push(siteResult);
            if (siteResult?.digestLine) digestLines.push(siteResult.digestLine);
            if (siteResult?.ok) {
                settings.mapEvolutionBacklogBySite = appendEvolutionBacklogEntry(
                    settings.mapEvolutionBacklogBySite,
                    site.siteRoot,
                    siteResult.noop
                        ? {
                            kind: 'quiet',
                            at: currentTime,
                            elapsedMinutes: siteResult.timeWindow?.elapsedMinutes,
                            summary: 'Map Evolution considered the site and committed no material change.',
                        }
                        : {
                            kind: 'commit',
                            at: currentTime,
                            elapsedMinutes: siteResult.timeWindow?.elapsedMinutes,
                            operationId: siteResult.transaction?.operation_id,
                            summary: siteResult.digestLine,
                        },
                );
                if (!siteResult.noop && siteResult.transaction) {
                    recordSiteThreads(
                        settings,
                        site.siteRoot,
                        siteResult.transaction,
                        siteResult.result?.createdAssets || [],
                        currentTime,
                    );
                }
                stampSiteFired(settings, site.siteRoot, currentTime);
                stampReportOutcomes(settings, site.siteRoot, siteResult.reportOutcomes, currentTime);
                await maybeCompressSiteThreads(settings, site.siteRoot, signal);
            }
        }

        persistMapEvolutionState();
        if (typeof runtimeState.updateMapEvolutionScheduleDisplayRef === 'function') {
            runtimeState.updateMapEvolutionScheduleDisplayRef();
        }
        const applied = results.filter(row => row?.ok && !row.noop).length;
        const noops = results.filter(row => row?.noop).length;
        const failed = results.filter(row => row && row.ok === false).length;
        broadcastStep('finish', `Map Evolution: ${applied} applied, ${noops} noop, ${failed} failed.`);
        return { ok: failed === 0, results, applied, noops, failed };
    } catch (error) {
        // Finished sites already wrote map commits to the lorebook and stamped
        // Last Evolved / report applications / backlog in memory. Persist that
        // bookkeeping on abort or throw so a later hydrate cannot re-due a site
        // whose map was already mutated.
        try { persistMapEvolutionState(); } catch (_) { /* best-effort */ }
        if (error?.name === 'AbortError') {
            console.log('[RPG Tracker] Map Evolution aborted by user.');
            if (_mapEvolutionRunning) broadcastStep('error', 'Stopped by user.');
            return { skipped: 'stopped' };
        }
        console.error('[RPG Tracker] Map Evolution failed:', error);
        if (_mapEvolutionRunning) broadcastStep('error', String(error?.message || error));
        return { ok: false, error: String(error?.message || error) };
    } finally {
        _mapEvolutionStarting = false;
        if (_mapEvolutionRunning) {
            _mapEvolutionRunning = false;
            _mapEvolutionController = null;
            document.dispatchEvent(new CustomEvent('rt_map_evolution_status', { detail: { running: false } }));
        }
    }
}

/**
 * Interval restlessness for the configured map pool, plus one pass when the party just left a mapped site.
 */
export async function maybeRunMapEvolution() {
    hydrateWorldProgressionFromChatState();
    const settings = getSettings();
    if (settings.mapEvolutionEnabled === false) return { skipped: 'disabled' };
    if (!isLocationMappingEnabled(settings)) return { skipped: 'location_mapping_off' };

    const loaded = await loadAllMappedSiteContexts();
    const currentLocation = loaded?.currentLocation || '';
    const active = loaded ? activeSiteFrom(loaded, currentLocation) : null;
    const currentRoot = active?.siteRoot || '';
    const previousRoot = String(settings.mapEvolutionLastSiteRoot || '').trim();

    let exitResult = null;
    let holdExitBookkeeping = false;
    if (previousRoot && !dungeonRootsEqual(previousRoot, currentRoot)) {
        const already = lastFiredMinutesForSite(settings, previousRoot);
        const now = parseInWorldMinutes(currentTimeFrom(settings));
        if (!(Number.isFinite(already) && already >= 0 && already === now)) {
            settings.mapEvolutionPendingExitRoot = previousRoot;
            exitResult = await runMapEvolutionPass({ trigger: 'site_exit' });
            // Busy/stopped skips must keep the pending exit + lastSiteRoot so a
            // later pass can still fire the site-exit restock/decay contract.
            // Advancing bookkeeping here permanently drops that departure.
            holdExitBookkeeping = exitResult?.skipped === 'busy' || exitResult?.skipped === 'stopped';
        }
        if (!holdExitBookkeeping) settings.mapEvolutionPendingExitRoot = '';
    }
    if (!holdExitBookkeeping) settings.mapEvolutionLastSiteRoot = currentRoot;
    persistMapEvolutionState();

    const scope = normalizeEvolutionTickScope(settings.mapEvolutionTickScope);
    if (!currentRoot && scope === 'active') return exitResult || { skipped: 'no_active_map' };
    const intervalResult = await runMapEvolutionPass({ trigger: 'interval' });
    return { exit: exitResult, interval: intervalResult };
}

/** Compact mapped-site list for settings checklists and the on-demand picker. */
export async function listMappedEvolutionSites() {
    if (!isLocationMappingEnabled(getSettings())) return [];
    const loaded = await loadAllMappedSiteContexts();
    const currentLocation = loaded?.currentLocation || '';
    return (loaded?.sites || []).map(site => {
        const here = !!(currentLocation && (
            normalizeDungeonLabel(currentLocation).includes(normalizeDungeonLabel(site.siteRoot))
            || resolveCurrentMapPlacement(site.document, currentLocation).area
        ));
        return {
            siteRoot: site.siteRoot,
            kind: normalizeMapSiteKind(site.document?.kind),
            hostSite: String(site.document?.hostSite || '').trim(),
            current: here,
        };
    });
}

/** Reload one mapped site after an on-demand Evolution pass. */
export async function loadMappedEvolutionSite(siteRoot) {
    if (!isLocationMappingEnabled(getSettings())) return null;
    const wanted = normalizeDungeonLabel(siteRoot);
    if (!wanted) return null;
    const loaded = await loadAllMappedSiteContexts();
    const site = (loaded?.sites || []).find(candidate => normalizeDungeonLabel(candidate.siteRoot) === wanted);
    if (!site) return null;
    return {
        siteRoot: site.siteRoot,
        kind: normalizeMapSiteKind(site.document?.kind),
        document: site.document,
    };
}
