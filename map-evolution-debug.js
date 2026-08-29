/**
 * Map Evolution testing ground — time, entities, and independent ticks
 * without playing through a campaign. Logic lives here; the popup UI is
 * src/ui/panel/panel-map-evolution-debug.js.
 */
import {
    getSettings,
    persistMapEvolutionState,
    saveChatState,
} from './state-manager.js';
import { runtimeState } from './src/app/runtime-state.js';
import { saveSettings } from './src/app/runtime-bridge.js';
import {
    extractCurrentTimeStr,
    formatInWorldTime,
    parseInWorldTime,
    replaceMemoCurrentTime,
} from './memo-processor.js';
import {
    MAP_ASSET_KINDS,
    applyDungeonMapTransaction,
    normalizeDungeonLabel,
    normalizeMapSiteKind,
} from './dungeon-reality.js';
import {
    appendEvolutionBacklogEntry,
    appendEvolutionThreads,
    clearEvolutionHistoryForSite,
    describeEvolutionBacklog,
    describeEvolutionMemoryUsage,
    describeEvolutionThreads,
    describeEvolutionTimeWindow,
    MAX_MAP_EVOLUTION_THREADS,
    summarizeEvolutionDigest,
    threadsFromMapTransaction,
    applyTestingGroundWorldState,
    cloneTestingGroundWorldState,
} from './map-evolution-lib.js';
import {
    applyDungeonMapCommit,
    isRouterRunning,
    loadAllMappedSiteContexts,
    restoreCampaignLocationsBook,
    snapshotCampaignLocationsBook,
} from './router.js';
import {
    isMapEvolutionRunning,
    listMappedEvolutionSites,
    runMapEvolutionPass,
} from './map-evolution.js';
import { isMapUpdaterRunning } from './map-updater.js';

export { MAP_ASSET_KINDS, replaceMemoCurrentTime };

/** Last Testing Ground Evolution/simulate pass. In-memory only; closing the popup keeps it until reload. */
let lastTestingGroundPass = null;

export function peekTestingGroundLastPass() {
    if (!lastTestingGroundPass) return null;
    return {
        action: { ...lastTestingGroundPass.action },
        undone: !!lastTestingGroundPass.undone,
        siteRoot: lastTestingGroundPass.action?.siteRoot || '',
    };
}

export function clearTestingGroundLastPass() {
    lastTestingGroundPass = null;
}

export async function snapshotTestingGroundWorld() {
    const world = cloneTestingGroundWorldState(getSettings());
    world.locationsBook = await snapshotCampaignLocationsBook();
    return world;
}

export async function restoreTestingGroundWorld(snapshot) {
    if (!snapshot) return { ok: false, error: 'No snapshot to restore.' };
    if (snapshot.locationsBook) {
        const restored = await restoreCampaignLocationsBook(snapshot.locationsBook);
        if (!restored) return { ok: false, error: 'Could not restore the Locations book.' };
    }
    applyTestingGroundWorldState(snapshot, getSettings());
    persistMapEvolutionState();
    persistMemo(snapshot.memo || getSettings().currentMemo || '');
    if (typeof runtimeState.updateMapEvolutionScheduleDisplayRef === 'function') {
        runtimeState.updateMapEvolutionScheduleDisplayRef();
    }
    return { ok: true };
}

async function captureTestingGroundCheckpoint(action) {
    lastTestingGroundPass = {
        action: { ...action },
        snapshot: await snapshotTestingGroundWorld(),
        undone: false,
    };
    return lastTestingGroundPass;
}

export function currentCampaignTimeLabel(memo = getSettings().currentMemo) {
    const match = String(memo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    return match ? extractCurrentTimeStr(match[1]) : '';
}

export function currentCampaignTimeMinutes(memo = getSettings().currentMemo) {
    const label = currentCampaignTimeLabel(memo);
    const minutes = parseInWorldTime(label);
    return minutes != null && Number.isFinite(minutes) && minutes >= 0 ? minutes : -1;
}

function persistMemo(nextMemo) {
    const settings = getSettings();
    settings.currentMemo = nextMemo;
    const chatId = runtimeState.currentChatId;
    if (settings.chatLinkEnabled && chatId) saveChatState(chatId);
    else void saveSettings();
    if (typeof runtimeState.refreshTrackerViewRef === 'function') {
        runtimeState.refreshTrackerViewRef();
    }
}

export function setCampaignTimeLabel(timeLabel) {
    const label = String(timeLabel || '').trim();
    if (!label) return { ok: false, error: 'Supply an in-world time label.' };
    const minutes = parseInWorldTime(label);
    if (minutes == null || !Number.isFinite(minutes) || minutes < 0) {
        return { ok: false, error: `Could not parse in-world time: ${label}` };
    }
    const formatted = formatInWorldTime(minutes);
    persistMemo(replaceMemoCurrentTime(getSettings().currentMemo || '', formatted));
    return { ok: true, timeLabel: formatted, minutes };
}

export function advanceCampaignTime(deltaMinutes) {
    const delta = Math.floor(Number(deltaMinutes) || 0);
    if (!Number.isFinite(delta) || delta === 0) {
        return { ok: false, error: 'Advance time by a non-zero number of in-world minutes.' };
    }
    const current = currentCampaignTimeMinutes();
    if (current < 0) return { ok: false, error: 'No parseable [TIME] block in the current memo.' };
    const next = Math.max(0, current + delta);
    return setCampaignTimeLabel(formatInWorldTime(next));
}

export async function describeEvolutionSandbox(siteRoot = '') {
    const settings = getSettings();
    const sites = await listMappedEvolutionSites();
    const wanted = normalizeDungeonLabel(siteRoot) || sites.find(site => site.current)?.siteRoot || sites[0]?.siteRoot || '';
    const loaded = wanted ? await loadAllMappedSiteContexts() : null;
    const site = (loaded?.sites || []).find(candidate =>
        normalizeDungeonLabel(candidate.siteRoot) === normalizeDungeonLabel(wanted),
    );
    const timeLabel = currentCampaignTimeLabel();
    const timeWindow = describeEvolutionTimeWindow(
        settings.mapEvolutionLastFiredBySite?.[normalizeDungeonLabel(wanted)],
        timeLabel,
    );
    return {
        timeLabel,
        minutes: currentCampaignTimeMinutes(),
        sites,
        siteRoot: site?.siteRoot || wanted,
        kind: site ? normalizeMapSiteKind(site.document?.kind) : '',
        document: site?.document || null,
        timeWindow,
        backlog: describeEvolutionBacklog(settings.mapEvolutionBacklogBySite, wanted, timeWindow.elapsedMinutes),
        threads: describeEvolutionThreads(settings.mapEvolutionThreadsBySite, wanted, {
            lookback: MAX_MAP_EVOLUTION_THREADS,
        }),
        lastEvolved: settings.mapEvolutionLastFiredBySite?.[normalizeDungeonLabel(wanted)] || 'Never',
        memory: describeEvolutionMemoryUsage(
            settings.mapEvolutionThreadsBySite,
            settings.mapEvolutionBacklogBySite,
            wanted,
            {
                threshold: settings.mapEvolutionCompressThreshold,
                compressEnabled: settings.mapEvolutionCompressEnabled !== false,
            },
        ),
    };
}

function debugOperationId(suffix) {
    const stamp = String(Date.now());
    const slug = String(suffix || 'op').replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'op';
    return `debug-${stamp}-${slug}`.slice(0, 120);
}

async function commitSandboxTransaction(siteRoot, transaction) {
    const loaded = await loadAllMappedSiteContexts();
    const site = (loaded?.sites || []).find(candidate =>
        normalizeDungeonLabel(candidate.siteRoot) === normalizeDungeonLabel(siteRoot),
    );
    if (!site) return { ok: false, error: `No mapped site named ${siteRoot}.` };
    const timeLabel = currentCampaignTimeLabel();
    const validation = applyDungeonMapTransaction(site.document, transaction, { currentTime: timeLabel });
    if (!validation.ok) {
        return {
            ok: false,
            error: (validation.errors || []).map(issue => `${issue.code}: ${issue.hint}`).join('; ') || 'Invalid map transaction.',
            errors: validation.errors,
        };
    }
    const result = await applyDungeonMapCommit(transaction, site, loaded.books, timeLabel, {
        requireActive: false,
    });
    if (!result.ok) {
        return {
            ok: false,
            error: (result.errors || []).map(issue => `${issue.code}: ${issue.hint}`).join('; ') || 'Map commit failed.',
            errors: result.errors,
        };
    }
    const settings = getSettings();
    settings.mapEvolutionThreadsBySite = appendEvolutionThreads(
        settings.mapEvolutionThreadsBySite,
        site.siteRoot,
        threadsFromMapTransaction(transaction, {
            at: timeLabel,
            createdAssets: result.createdAssets || validation.createdAssets || [],
        }),
    );
    const digestLine = summarizeEvolutionDigest(site.siteRoot, transaction);
    if (digestLine) {
        settings.mapEvolutionBacklogBySite = appendEvolutionBacklogEntry(
            settings.mapEvolutionBacklogBySite,
            site.siteRoot,
            {
                kind: 'commit',
                at: timeLabel,
                elapsedMinutes: -1,
                operationId: transaction.operation_id,
                summary: digestLine,
            },
        );
    }
    persistMapEvolutionState();
    if (typeof runtimeState.refreshTrackerViewRef === 'function') {
        runtimeState.refreshTrackerViewRef();
    }
    return { ok: true, result, createdAssets: result.createdAssets || validation.createdAssets || [] };
}

export async function debugAddAsset({
    siteRoot,
    name,
    kind = 'CREATURE',
    location,
    state = 'ACTIVE',
    knowledge = 'UNREVEALED',
    faction = '',
    detail = '',
    count,
    cause,
    actor = '',
} = {}) {
    const causeText = String(cause || '').trim();
    if (!String(name || '').trim()) return { ok: false, error: 'Name is required.' };
    if (!String(location || '').trim()) return { ok: false, error: 'Location (area id) is required.' };
    if (!causeText) return { ok: false, error: 'Cause is required.' };
    const operation = {
        op: 'ADD_ASSET',
        evidence: 'CONFIRMED',
        name: String(name).trim(),
        kind,
        location: String(location).trim(),
        state,
        knowledge,
        detail: String(detail || '').trim(),
        origin: 'DEBUG_SANDBOX',
        cause: causeText,
    };
    const parsedCount = Math.floor(Number(count));
    if (Number.isFinite(parsedCount) && parsedCount >= 1) operation.count = parsedCount;
    if (faction) operation.faction = String(faction).trim();
    if (actor) operation.actor = String(actor).trim();
    if (['DEAD', 'DESTROYED'].includes(String(state).toUpperCase()) && !operation.actor) {
        return { ok: false, error: 'DEAD/DESTROYED requires an actor (party, asset id, or off-map name).' };
    }
    return commitSandboxTransaction(siteRoot, {
        operation_id: debugOperationId(name),
        operations: [operation],
        chronicles: [],
    });
}

export async function debugSetAsset({
    siteRoot,
    assetId,
    state,
    detail,
    count,
    cause,
    actor = '',
    threadStatus = '',
} = {}) {
    const causeText = String(cause || '').trim();
    if (!String(assetId || '').trim()) return { ok: false, error: 'Asset id is required.' };
    if (!causeText) return { ok: false, error: 'Cause is required.' };
    const operation = {
        op: 'SET_ASSET',
        evidence: 'CONFIRMED',
        asset_id: String(assetId).trim(),
        cause: causeText,
    };
    if (state) operation.state = state;
    if (detail != null && detail !== '') operation.detail = String(detail);
    const parsedCount = Math.floor(Number(count));
    if (Number.isFinite(parsedCount) && parsedCount >= 1) operation.count = parsedCount;
    if (actor) operation.actor = String(actor).trim();
    if (threadStatus) operation.thread_status = threadStatus;
    if (['DEAD', 'DESTROYED'].includes(String(state || '').toUpperCase()) && !operation.actor) {
        return { ok: false, error: 'DEAD/DESTROYED requires an actor (party, asset id, or off-map name).' };
    }
    return commitSandboxTransaction(siteRoot, {
        operation_id: debugOperationId(assetId),
        operations: [operation],
        chronicles: [],
    });
}

export function evolutionAgentsBusy() {
    return isRouterRunning() || isMapUpdaterRunning() || isMapEvolutionRunning();
}

export async function debugRunEvolution(siteRoot) {
    if (evolutionAgentsBusy()) return { ok: false, skipped: 'busy', error: 'An agent is already running.' };
    const root = String(siteRoot || '').trim();
    if (!root) return { ok: false, error: 'Pick a mapped site.' };
    await captureTestingGroundCheckpoint({ type: 'evolve', siteRoot: root });
    return runMapEvolutionPass({ trigger: 'manual', isManual: true, siteRoots: [root] });
}

async function runSimulateTicks({
    siteRoot,
    ticks = 1,
    hoursPerTick = 0,
    onTick = null,
} = {}) {
    const root = String(siteRoot || '').trim();
    if (!root) return { ok: false, error: 'Pick a mapped site.' };
    const count = Math.max(1, Math.min(20, Math.floor(Number(ticks) || 1)));
    const hours = Math.max(1, Math.floor(Number(hoursPerTick) || Number(getSettings().mapEvolutionIntervalHours) || 8));
    const results = [];
    for (let index = 0; index < count; index++) {
        if (evolutionAgentsBusy()) {
            return { ok: false, skipped: 'busy', error: 'An agent is already running.', results };
        }
        const advanced = advanceCampaignTime(hours * 60);
        if (!advanced.ok) return { ...advanced, results };
        if (typeof onTick === 'function') {
            onTick({ index, count, timeLabel: advanced.timeLabel, phase: 'time' });
        }
        const evolved = await runMapEvolutionPass({ trigger: 'manual', isManual: true, siteRoots: [root] });
        results.push({ timeLabel: advanced.timeLabel, evolved });
        if (typeof onTick === 'function') {
            onTick({ index, count, timeLabel: advanced.timeLabel, phase: 'evolved', evolved });
        }
        if (evolved?.skipped === 'busy' || evolved?.skipped === 'stopped') {
            return { ok: false, skipped: evolved.skipped, results };
        }
    }
    return { ok: true, ticks: count, hoursPerTick: hours, results };
}

/**
 * Advance in-world time by the configured interval (or a supplied hour count)
 * and run Map Evolution that many times. This is the simulation loop.
 */
export async function debugSimulateTicks({
    siteRoot,
    ticks = 1,
    hoursPerTick = 0,
    onTick = null,
} = {}) {
    const root = String(siteRoot || '').trim();
    if (!root) return { ok: false, error: 'Pick a mapped site.' };
    if (evolutionAgentsBusy()) return { ok: false, skipped: 'busy', error: 'An agent is already running.' };
    const count = Math.max(1, Math.min(20, Math.floor(Number(ticks) || 1)));
    const hours = Math.max(1, Math.floor(Number(hoursPerTick) || Number(getSettings().mapEvolutionIntervalHours) || 8));
    await captureTestingGroundCheckpoint({
        type: 'simulate',
        siteRoot: root,
        ticks: count,
        hoursPerTick: hours,
    });
    return runSimulateTicks({ siteRoot: root, ticks: count, hoursPerTick: hours, onTick });
}

export async function debugUndoLastEvolutionPass() {
    if (!lastTestingGroundPass) return { ok: false, error: 'No Evolution pass to undo. Run one first.' };
    if (lastTestingGroundPass.undone) return { ok: false, error: 'Last pass is already undone. Redo it or run a new one.' };
    if (evolutionAgentsBusy()) return { ok: false, skipped: 'busy', error: 'An agent is already running.' };
    const restored = await restoreTestingGroundWorld(lastTestingGroundPass.snapshot);
    if (!restored.ok) return restored;
    lastTestingGroundPass.undone = true;
    return {
        ok: true,
        undone: true,
        siteRoot: lastTestingGroundPass.action.siteRoot,
        action: { ...lastTestingGroundPass.action },
    };
}

export async function debugRedoLastEvolutionPass({ onTick = null } = {}) {
    if (!lastTestingGroundPass) return { ok: false, error: 'No Evolution pass to redo. Run one first.' };
    if (evolutionAgentsBusy()) return { ok: false, skipped: 'busy', error: 'An agent is already running.' };
    const restored = await restoreTestingGroundWorld(lastTestingGroundPass.snapshot);
    if (!restored.ok) return restored;
    const action = lastTestingGroundPass.action;
    const result = action.type === 'simulate'
        ? await runSimulateTicks({
            siteRoot: action.siteRoot,
            ticks: action.ticks,
            hoursPerTick: action.hoursPerTick,
            onTick,
        })
        : await runMapEvolutionPass({ trigger: 'manual', isManual: true, siteRoots: [action.siteRoot] });
    lastTestingGroundPass.undone = false;
    return { ...result, redone: true, action: { ...action } };
}

/**
 * Wipe this site's Evolution backlog, causal threads, and considered World
 * Report bookkeeping. Map occupancy and Last Evolved clocks stay put.
 */
export function debugClearEvolutionHistory(siteRoot) {
    const root = String(siteRoot || '').trim();
    if (!root) return { ok: false, error: 'Pick a mapped site.' };
    const settings = getSettings();
    const cleared = clearEvolutionHistoryForSite({
        backlogBySite: settings.mapEvolutionBacklogBySite,
        threadsBySite: settings.mapEvolutionThreadsBySite,
        reportApplicationsBySite: settings.mapEvolutionWorldReportApplications,
    }, root);
    if (!cleared.cleared) return { ok: false, error: 'Could not resolve that site.' };
    settings.mapEvolutionBacklogBySite = cleared.backlogBySite;
    settings.mapEvolutionThreadsBySite = cleared.threadsBySite;
    settings.mapEvolutionWorldReportApplications = cleared.reportApplicationsBySite;
    persistMapEvolutionState();
    return { ok: true, siteRoot: root };
}
