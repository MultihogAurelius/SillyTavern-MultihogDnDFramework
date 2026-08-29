/**
 * Pure Map Evolution helpers: scheduled site selection, digest, player bubble, interval due.
 * Kept out of map-evolution.js so filters stay testable without the LLM pass / router.
 */
import { dungeonSiteRootsMatch, normalizeDungeonLabel, pickActiveSiteForLocation, resolveCurrentMapPlacement } from './dungeon-reality.js';
import { findNthUserMessageStartIdx, formatAgentChatLogFromIndex, parseInWorldTime } from './memo-processor.js';

export const DEFAULT_MAP_EVOLUTION_LOOKBACK = 10;

/**
 * Clamp Map Evolution story lookback to 0–100 user turns.
 * 0 means skip recent story entirely (do not treat as "from the start of chat").
 */
export function normalizeMapEvolutionLookback(value, fallback = DEFAULT_MAP_EVOLUTION_LOOKBACK) {
    if (value == null || value === '') return fallback;
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, n));
}

/** Per-run override wins; otherwise the settings Story Lookback. */
export function resolveMapEvolutionLookback(settings, lookback = null) {
    return normalizeMapEvolutionLookback(
        lookback != null && lookback !== '' ? lookback : settings?.mapEvolutionLookback,
        DEFAULT_MAP_EVOLUTION_LOOKBACK,
    );
}

/**
 * Recent play is causal for the current map, and for the site the party just
 * left. Background maps must not receive chat — that makes them player-centric.
 */
export function mapEvolutionRecentStoryApplies({ partyIsHere = false, trigger = 'interval' } = {}) {
    return String(trigger || '') === 'site_exit' || !!partyIsHere;
}

/** Same prompt either way: story text when it applies, otherwise empty. */
export function selectMapEvolutionRecentStory(recentStory, options) {
    return mapEvolutionRecentStoryApplies(options) ? String(recentStory || '') : '';
}

/**
 * Recent chat supplied to Map Evolution. Empty when lookback is 0.
 * @param {any[]} chat
 * @param {object} [settings]
 * @param {number|null} [lookback] Per-run override (Direct Command).
 */
export function formatMapEvolutionRecentStory(chat, settings, lookback = null) {
    const turns = resolveMapEvolutionLookback(settings, lookback);
    const messages = Array.isArray(chat) ? chat : [];
    if (!turns || !messages.length) return '';
    return formatAgentChatLogFromIndex(
        messages,
        findNthUserMessageStartIdx(messages, turns),
        !!settings?.routerIncludeHidden,
        false,
    );
}

export function isEvolutionNoop(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.noop === true) return true;
    return Array.isArray(value.operations) && value.operations.length === 0;
}

/**
 * Build per-report application stamps after a finished site pass.
 *
 * Bare noop (`{"noop":true}` with no report_outcomes) must not consume World
 * Report pressure — otherwise a model that omits bookkeeping permanently drops
 * pending pressures without materializing them. Explicit report_outcomes on a
 * noop (or any material commit) still stamp every supplied report, defaulting
 * missing IDs to `considered`.
 *
 * @param {unknown} rawOutcomes
 * @param {Array<{ reportId: string }>} reports
 * @param {{ noop?: boolean, digest?: string }} [options]
 */
export function buildReportOutcomeStamps(rawOutcomes, reports, { noop = false, digest = '' } = {}) {
    const allowed = new Set(['materialized', 'already_realized_by_play', 'considered']);
    const raw = Array.isArray(rawOutcomes) ? rawOutcomes : [];
    if (noop && raw.length === 0) return [];
    const supplied = new Map(raw
        .map(outcome => [String(outcome?.report_id || '').trim(), String(outcome?.status || '').trim()])
        .filter(([reportId, status]) => reportId && allowed.has(status)));
    return (reports || []).map(report => ({
        reportId: report.reportId,
        status: supplied.get(report.reportId) || 'considered',
        localDigest: String(digest || '').trim(),
    }));
}

function summarizeOperationCause(operation) {
    const actor = String(operation?.actor || '').trim();
    const cause = String(operation?.cause || '').trim();
    if (!actor && !cause) return '';
    if (actor && cause) return ` by ${actor}: ${cause}`;
    if (actor) return ` by ${actor}`;
    return `: ${cause}`;
}

/**
 * Drop a leading "Site Name: " header from a stored Evolution digest.
 * Commits are only shown inside that site, so the label is wasted tokens.
 */
export function stripEvolutionDigestSitePrefix(summary, siteRoot) {
    const text = String(summary || '').trim();
    const root = String(siteRoot || '').trim();
    if (!text || !root) return text;
    const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`^${escaped}\\s*:\\s*`), '');
}

export function summarizeEvolutionDigest(siteRoot, transaction) {
    // siteRoot remains in the signature for call-site compatibility.
    // Digests are only read inside that site, so the name is not prepended.
    void siteRoot;
    if (isEvolutionNoop(transaction)) return '';
    const ops = Array.isArray(transaction?.operations) ? transaction.operations : [];
    const bits = ops.map(operation => {
        const op = String(operation?.op || '').trim();
        const why = summarizeOperationCause(operation);
        if (op === 'MOVE_ASSET') return `${operation.asset_id} moved to ${operation.to}${why}`;
        if (op === 'ADD_ASSET') return `added ${operation.name} in ${operation.location}${why}`;
        if (op === 'SET_ASSET') return `${operation.asset_id} ${operation.state || 'updated'}${why}`;
        if (op === 'REMOVE_ASSET') return `${operation.asset_id} removed from map${why}`;
        if (op === 'SET_CONNECTION') return `route ${operation.from}→${operation.to} ${operation.state}${why}`;
        if (op === 'SET_AREA') return `geometry ${operation.area_id}${why}`;
        return `${op || 'OP'}${why}`;
    });
    return bits.join('; ');
}

export function resolvePlayerBubble(document, currentLocation, { combatActive = false } = {}) {
    const placement = resolveCurrentMapPlacement(document, currentLocation);
    if (!placement.area) return { frozenAreaIds: [], combatActive, area: null };
    return {
        frozenAreaIds: [placement.area.id],
        combatActive: !!combatActive,
        area: placement.area,
    };
}

/**
 * Mark the unique current Evolution site from the footer site-root path.
 * Placement on other maps (a trail BUILDING named after this site, a shared
 * room name) must not also flag those maps current or steal the on-site timer.
 */
export function annotateEvolutionSitePresence(sites, currentLocation) {
    const rows = Array.isArray(sites) ? sites : [];
    const active = pickActiveSiteForLocation(rows, currentLocation);
    const currentRoot = String(active?.siteRoot || '').trim();
    return {
        currentRoot,
        sites: rows.map(site => ({
            ...site,
            current: dungeonSiteRootsMatch(site.siteRoot, currentRoot),
        })),
    };
}

export const MAP_EVOLUTION_INTERVAL_MAX_HOURS = 168;

/**
 * Clamp an Evolution interval. 0 means "never auto-tick" when allowNever is set.
 * Invalid values fall back rather than becoming 0.
 */
export function normalizeEvolutionIntervalHours(value, { allowNever = false, fallback = 12 } = {}) {
    const fallbackHours = Math.max(1, Math.min(MAP_EVOLUTION_INTERVAL_MAX_HOURS, Math.floor(Number(fallback) || 12)));
    if (value == null || value === '') return fallbackHours;
    const hours = Math.floor(Number(value));
    if (!Number.isFinite(hours)) return fallbackHours;
    if (allowNever && hours === 0) return 0;
    if (hours < 1) return fallbackHours;
    return Math.min(MAP_EVOLUTION_INTERVAL_MAX_HOURS, hours);
}

/** Sparse per-site hour overrides. Keys are normalized site roots. 0 = never auto. */
export function normalizeEvolutionIntervalOverrides(raw) {
    const next = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next;
    for (const [siteRoot, value] of Object.entries(raw)) {
        const key = normalizeDungeonLabel(siteRoot);
        if (!key) continue;
        const hours = Math.floor(Number(value));
        if (!Number.isFinite(hours) || hours < 0) continue;
        next[key] = Math.min(MAP_EVOLUTION_INTERVAL_MAX_HOURS, hours);
    }
    return next;
}

export function getSiteEvolutionIntervalOverride(bySite, siteRoot) {
    const key = normalizeDungeonLabel(siteRoot);
    const overrides = normalizeEvolutionIntervalOverrides(bySite);
    return key && Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : null;
}

export function setSiteEvolutionIntervalOverride(bySite, siteRoot, hours) {
    const next = normalizeEvolutionIntervalOverrides(bySite);
    const key = normalizeDungeonLabel(siteRoot);
    if (!key) return next;
    if (hours == null || hours === '') {
        delete next[key];
        return next;
    }
    const parsed = Math.floor(Number(hours));
    if (!Number.isFinite(parsed) || parsed < 0) {
        delete next[key];
        return next;
    }
    next[key] = Math.min(MAP_EVOLUTION_INTERVAL_MAX_HOURS, parsed);
    return next;
}

/**
 * Interval used for one mapped site.
 * Per-site override (including 0) wins. Otherwise current-map hours if the party
 * is there, else the other-maps hours. Presence never changes Evolution's job —
 * only how often this site is due.
 */
export function resolveSiteEvolutionIntervalHours(siteRoot, {
    intervalHours = 12,
    onSiteIntervalHours = 1,
    onSiteIntervalMinutes = 0,
    intervalHoursBySite = {},
    currentRoot = '',
} = {}) {
    const key = normalizeDungeonLabel(siteRoot);
    const overrides = normalizeEvolutionIntervalOverrides(intervalHoursBySite);
    if (key && Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
    const offSite = normalizeEvolutionIntervalHours(intervalHours, { allowNever: false, fallback: 12 });
    const rawOnSiteHours = Number(onSiteIntervalHours);
    const currentHours = Number.isFinite(rawOnSiteHours)
        ? Math.max(0, Math.min(MAP_EVOLUTION_INTERVAL_MAX_HOURS, Math.floor(rawOnSiteHours)))
        : 1;
    const rawOnSiteMinutes = Number(onSiteIntervalMinutes);
    const currentMinutes = Number.isFinite(rawOnSiteMinutes)
        ? Math.max(0, Math.min(59, Math.floor(rawOnSiteMinutes)))
        : 0;
    const onSite = currentHours === 0 && currentMinutes === 0
        ? 0
        : Math.min(MAP_EVOLUTION_INTERVAL_MAX_HOURS, currentHours + currentMinutes / 60);
    return key && key === normalizeDungeonLabel(currentRoot) ? onSite : offSite;
}

export function evolutionIntervalHoursForSettings(settings, currentRoot = '') {
    return (siteRoot) => resolveSiteEvolutionIntervalHours(siteRoot, {
        intervalHours: settings?.mapEvolutionIntervalHours,
        onSiteIntervalHours: settings?.mapEvolutionOnSiteIntervalHours,
        onSiteIntervalMinutes: settings?.mapEvolutionOnSiteIntervalMinutes,
        intervalHoursBySite: settings?.mapEvolutionIntervalHoursBySite,
        currentRoot,
    });
}

/**
 * First visit stamps a baseline and does not fire. Later elapsed intervals fire.
 * intervalHours 0 means never auto-tick after the baseline.
 */
export function siteEvolutionDue(lastMinutes, currentMinutes, intervalHours) {
    if (!Number.isFinite(lastMinutes) || lastMinutes < 0) return { due: false, baseline: true };
    if (!Number.isFinite(currentMinutes) || currentMinutes < 0) return { due: false, baseline: false };
    const hours = Number(intervalHours);
    if (hours === 0) return { due: false, baseline: false };
    const interval = Math.max(1, (Number.isFinite(hours) && hours > 0 ? hours : 4) * 60);
    return { due: (currentMinutes - lastMinutes) >= interval, baseline: false };
}

function parseFiredMinutes(label) {
    const mins = parseInWorldTime(label);
    return mins != null && Number.isFinite(mins) && mins >= 0 ? mins : -1;
}

export function formatEvolutionElapsedMinutes(totalMinutes) {
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return 'Unknown';
    const total = Math.floor(totalMinutes);
    if (total === 0) return '0 in-world minutes';
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const minutes = total % 60;
    const parts = [];
    if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
    if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
    if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
    return `${parts.join(', ')} (${total} in-world minutes total)`;
}

export const MAX_MAP_EVOLUTION_BACKLOG_ENTRIES = 20;
export const MAP_EVOLUTION_BACKLOG_PROMPT_ENTRIES = 10;

function normalizeEvolutionBacklogEntry(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const kind = value.kind === 'commit' ? 'commit' : value.kind === 'quiet' ? 'quiet' : '';
    if (!kind) return null;
    const elapsedValue = Number(value.elapsedMinutes);
    const passesValue = Number(value.passes);
    return {
        kind,
        at: String(value.at || '').trim() || 'Unknown',
        elapsedMinutes: Number.isFinite(elapsedValue) && elapsedValue >= 0 ? Math.floor(elapsedValue) : -1,
        passes: Math.max(1, Math.min(1000000, Math.floor(Number.isFinite(passesValue) ? passesValue : 1))),
        operationId: kind === 'commit' ? String(value.operationId || '').trim().slice(0, 120) : '',
        summary: String(value.summary || '').trim()
            || (kind === 'commit' ? 'A material map change was committed.' : 'No material map change was committed.'),
    };
}

/**
 * Append one successful Map Evolution outcome to a bounded, per-site ledger.
 * Quiet checkpoints are retained because they let frequent short intervals
 * accumulate into a meaningful unattended trajectory. Commit operation IDs are
 * de-duplicated so idempotent transaction retries do not become fake history.
 */
export function appendEvolutionBacklogEntry(backlogBySite, siteRoot, entry, {
    limit = MAX_MAP_EVOLUTION_BACKLOG_ENTRIES,
} = {}) {
    const key = normalizeDungeonLabel(siteRoot);
    const next = { ...(backlogBySite && typeof backlogBySite === 'object' ? backlogBySite : {}) };
    if (!key) return next;
    const prior = (Array.isArray(next[key]) ? next[key] : [])
        .map(normalizeEvolutionBacklogEntry)
        .filter(Boolean);
    const boundedLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || MAX_MAP_EVOLUTION_BACKLOG_ENTRIES)));
    const normalized = normalizeEvolutionBacklogEntry(entry);
    if (!normalized) {
        next[key] = prior.slice(-boundedLimit);
        return next;
    }
    if (normalized.kind === 'commit' && normalized.operationId
        && prior.some(item => item.kind === 'commit' && item.operationId === normalized.operationId)) {
        next[key] = prior.slice(-boundedLimit);
        return next;
    }
    if (normalized.kind === 'quiet' && normalized.elapsedMinutes >= 0
        && prior.at(-1)?.kind === 'quiet' && prior.at(-1).elapsedMinutes >= 0) {
        const previous = prior.at(-1);
        prior[prior.length - 1] = {
            ...normalized,
            elapsedMinutes: previous.elapsedMinutes + normalized.elapsedMinutes,
            passes: previous.passes + normalized.passes,
            summary: `${previous.passes + normalized.passes} consecutive Map Evolution passes committed no material change.`,
        };
        next[key] = prior.slice(-boundedLimit);
        return next;
    }
    next[key] = [...prior, normalized].slice(-boundedLimit);
    return next;
}

/**
 * Drop retained Evolution trajectory for one site so a later pass is not
 * biased by commits made under a previous prompt. Does not touch the map,
 * [TIME], or Last Evolved clocks.
 */
export function clearEvolutionHistoryForSite({
    backlogBySite = {},
    threadsBySite = {},
    reportApplicationsBySite = {},
} = {}, siteRoot) {
    const key = normalizeDungeonLabel(siteRoot);
    const nextBacklog = { ...(backlogBySite && typeof backlogBySite === 'object' && !Array.isArray(backlogBySite) ? backlogBySite : {}) };
    const nextThreads = { ...(threadsBySite && typeof threadsBySite === 'object' && !Array.isArray(threadsBySite) ? threadsBySite : {}) };
    const nextReports = { ...(reportApplicationsBySite && typeof reportApplicationsBySite === 'object' && !Array.isArray(reportApplicationsBySite) ? reportApplicationsBySite : {}) };
    if (key) {
        delete nextBacklog[key];
        delete nextThreads[key];
        delete nextReports[key];
    }
    return {
        backlogBySite: nextBacklog,
        threadsBySite: nextThreads,
        reportApplicationsBySite: nextReports,
        siteKey: key,
        cleared: Boolean(key),
    };
}

/**
 * Build the trajectory supplied to one Map Evolution request. The current gap
 * is included in cumulative and post-commit quiet time even though its outcome
 * has not been recorded yet.
 */
export function describeEvolutionBacklog(backlogBySite, siteRoot, currentElapsedMinutes, {
    lookback = MAP_EVOLUTION_BACKLOG_PROMPT_ENTRIES,
} = {}) {
    const key = normalizeDungeonLabel(siteRoot);
    const normalizedStored = (Array.isArray(backlogBySite?.[key]) ? backlogBySite[key] : [])
        .map(normalizeEvolutionBacklogEntry)
        .filter(Boolean);
    const stored = normalizedStored.slice(-MAX_MAP_EVOLUTION_BACKLOG_ENTRIES);
    const boundedLookback = Math.max(1, Math.min(
        MAX_MAP_EVOLUTION_BACKLOG_ENTRIES,
        Math.floor(Number(lookback) || MAP_EVOLUTION_BACKLOG_PROMPT_ENTRIES),
    ));
    const entries = stored.slice(-boundedLookback);
    const currentValue = Number(currentElapsedMinutes);
    const currentKnown = Number.isFinite(currentValue) && currentValue >= 0;
    const currentMinutes = currentKnown ? Math.floor(currentValue) : -1;
    const knownEntries = stored.filter(entry => entry.elapsedMinutes >= 0);
    const knownEntryMinutes = knownEntries.reduce((sum, entry) => sum + entry.elapsedMinutes, 0);
    const representedMinutes = knownEntryMinutes + (currentKnown ? currentMinutes : 0);
    const representedHasUnknown = !currentKnown || stored.some(entry => entry.elapsedMinutes < 0);
    const representedHasKnown = currentKnown || knownEntries.length > 0;

    let quietMinutes = currentKnown ? currentMinutes : 0;
    let quietHasUnknown = !currentKnown;
    let quietHasKnown = currentKnown;
    for (let index = stored.length - 1; index >= 0; index--) {
        const entry = stored[index];
        if (entry.kind === 'commit') break;
        if (entry.elapsedMinutes >= 0) {
            quietMinutes += entry.elapsedMinutes;
            quietHasKnown = true;
        }
        else quietHasUnknown = true;
    }

    return {
        entries,
        representedMinutes,
        representedElapsed: representedHasKnown
            ? `${representedHasUnknown ? 'At least ' : ''}${formatEvolutionElapsedMinutes(representedMinutes)}`
            : 'Unknown',
        quietMinutes,
        quietElapsed: quietHasKnown
            ? `${quietHasUnknown ? 'At least ' : ''}${formatEvolutionElapsedMinutes(quietMinutes)}`
            : 'Unknown',
        truncated: normalizedStored.length > entries.length,
    };
}

/**
 * Build the authoritative per-site time window supplied to Map Evolution.
 * Last Evolved is the scheduler watermark for this exact map, not the UI's
 * aggregate most-recent timestamp across all maps.
 */
export function describeEvolutionTimeWindow(lastEvolvedLabel, currentTimeLabel) {
    const lastLabel = String(lastEvolvedLabel || '').trim();
    const currentLabel = String(currentTimeLabel || '').trim();
    const lastMinutes = parseFiredMinutes(lastLabel);
    const currentMinutes = parseFiredMinutes(currentLabel);

    if (lastMinutes < 0) {
        return {
            lastEvolved: lastLabel || 'Never',
            currentTime: currentLabel || 'Unknown',
            elapsedMinutes: -1,
            elapsed: 'Unknown — this site has no Last Evolved baseline.',
        };
    }
    if (currentMinutes < 0) {
        return {
            lastEvolved: lastLabel,
            currentTime: currentLabel || 'Unknown',
            elapsedMinutes: -1,
            elapsed: 'Unknown — the current in-world time could not be parsed.',
        };
    }
    if (currentMinutes < lastMinutes) {
        return {
            lastEvolved: lastLabel,
            currentTime: currentLabel,
            elapsedMinutes: -1,
            elapsed: 'Unknown — current time precedes Last Evolved; do not infer accumulated change.',
        };
    }
    const elapsedMinutes = currentMinutes - lastMinutes;
    return {
        lastEvolved: lastLabel,
        currentTime: currentLabel,
        elapsedMinutes,
        elapsed: formatEvolutionElapsedMinutes(elapsedMinutes),
    };
}

/**
 * WP-style last/next readout for Map Evolution's per-site interval clocks.
 * Last = most recent site stamp. Next = soonest last+interval, or current+interval if none.
 */
export function summarizeMapEvolutionSchedule(lastFiredBySite, {
    intervalHours = 4,
    intervalHoursFor = null,
    currentMinutes = -1,
} = {}) {
    const defaultHours = Math.max(1, Number(intervalHours) || 4);
    const hoursFor = typeof intervalHoursFor === 'function'
        ? (key) => {
            const hours = Number(intervalHoursFor(key));
            return Number.isFinite(hours) && hours >= 0 ? hours : defaultHours;
        }
        : () => defaultHours;
    const entries = Object.entries(lastFiredBySite && typeof lastFiredBySite === 'object' ? lastFiredBySite : {})
        .map(([key, label]) => ({ key, mins: parseFiredMinutes(label), hours: hoursFor(key) }))
        .filter(entry => entry.mins >= 0);
    const lastMins = entries.length ? Math.max(...entries.map(entry => entry.mins)) : -1;
    const nextCandidates = entries
        .filter(entry => entry.hours > 0)
        .map(entry => entry.mins + entry.hours * 60);
    let nextMins = -1;
    if (nextCandidates.length) nextMins = Math.min(...nextCandidates);
    else if (!entries.length && Number.isFinite(currentMinutes) && currentMinutes >= 0) {
        const fallback = hoursFor('');
        if (fallback > 0) nextMins = currentMinutes + fallback * 60;
    }
    return { lastMins, nextMins };
}

/** Stamp one last-fired in-world label onto every listed site root. */
export function stampEvolutionLastFired(lastFiredBySite, roots, timeLabel) {
    const next = { ...(lastFiredBySite && typeof lastFiredBySite === 'object' ? lastFiredBySite : {}) };
    const label = String(timeLabel || '').trim();
    for (const root of normalizeEvolutionRootList(roots)) {
        next[normalizeDungeonLabel(root)] = label;
    }
    return next;
}

export const MAP_EVOLUTION_TICK_SCOPES = ['active', 'count', 'all', 'selected'];

export function normalizeEvolutionTickScope(value) {
    const scope = String(value || '').trim().toLowerCase();
    return MAP_EVOLUTION_TICK_SCOPES.includes(scope) ? scope : 'all';
}

export function normalizeEvolutionRootList(roots) {
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(roots) ? roots : []) {
        const label = String(raw || '').trim();
        const key = normalizeDungeonLabel(label);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(label);
    }
    return out;
}

export function siteRootKey(site) {
    return normalizeDungeonLabel(site?.siteRoot || site?.document?.site);
}

export function filterSitesByRoots(sites, roots) {
    const wanted = new Set(normalizeEvolutionRootList(roots).map(root => normalizeDungeonLabel(root)));
    if (!wanted.size) return [];
    return (sites || []).filter(site => wanted.has(siteRootKey(site)));
}

function shuffleCopy(items, random) {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
}

/**
 * Which mapped sites an interval tick should stamp / evolve.
 * Baselines are returned separately so they never consume the per-tick count.
 * count 0 means every due site in the pool.
 */
export function pickSitesForEvolutionTick(sites, {
    scope = 'active',
    count = 1,
    randomize = true,
    selectedRoots = [],
    currentRoot = '',
    lastFiredMinutesFor = () => -1,
    currentMinutes = -1,
    intervalHours = 4,
    intervalHoursFor = null,
    random = Math.random,
} = {}) {
    const normalizedScope = normalizeEvolutionTickScope(scope);
    let pool = Array.isArray(sites) ? [...sites] : [];
    if (normalizedScope === 'active') {
        const key = normalizeDungeonLabel(currentRoot);
        pool = key ? pool.filter(site => siteRootKey(site) === key) : [];
    } else if (normalizedScope === 'selected') {
        pool = filterSitesByRoots(pool, selectedRoots);
    }

    const hoursFor = typeof intervalHoursFor === 'function'
        ? intervalHoursFor
        : () => intervalHours;
    const baseline = [];
    const due = [];
    for (const site of pool) {
        const status = siteEvolutionDue(lastFiredMinutesFor(site.siteRoot), currentMinutes, hoursFor(site.siteRoot));
        if (status.baseline) baseline.push({ ...site, stampBaselineOnly: true });
        else if (status.due) due.push(site);
    }

    if (normalizedScope === 'active' || normalizedScope === 'all') {
        return { baseline, due, pool };
    }

    const takeAll = !Number.isFinite(Number(count)) || Number(count) <= 0;
    if (takeAll) return { baseline, due, pool };

    const limit = Math.max(1, Math.min(50, Number(count) || 1));
    const ordered = randomize
        ? shuffleCopy(due, typeof random === 'function' ? random : Math.random)
        : [...due].sort((left, right) => {
            const delta = lastFiredMinutesFor(left.siteRoot) - lastFiredMinutesFor(right.siteRoot);
            if (delta !== 0) return delta;
            return String(left.siteRoot || '').localeCompare(String(right.siteRoot || ''));
        });
    return { baseline, due: ordered.slice(0, limit), pool };
}

export const MAX_MAP_EVOLUTION_THREADS = 400;
export const MAP_EVOLUTION_THREAD_PROMPT_ENTRIES = 400;
export const MAP_THREAD_STATUSES = ['open', 'resolved', 'transformed'];
export const DEFAULT_MAP_EVOLUTION_COMPRESS_THRESHOLD = 10000;
/** GM/narrator briefing: token ceiling for complete material commits. ~4 chars/token. */
export const DEFAULT_MAP_EVOLUTION_NARRATOR_COMMIT_TOKENS = 2000;

function cloneJson(value, fallback) {
    try {
        return JSON.parse(JSON.stringify(value ?? fallback));
    } catch {
        return fallback;
    }
}

/** Clocks, threads, backlog, and memo for Testing Ground undo/redo. Locations book is snapshotted separately. */
export function cloneTestingGroundWorldState(settings) {
    return {
        lastFiredBySite: cloneJson(settings?.mapEvolutionLastFiredBySite, {}),
        reportApplications: cloneJson(settings?.mapEvolutionWorldReportApplications, {}),
        backlogBySite: cloneJson(settings?.mapEvolutionBacklogBySite, {}),
        threadsBySite: cloneJson(settings?.mapEvolutionThreadsBySite, {}),
        memo: String(settings?.currentMemo || ''),
    };
}

export function applyTestingGroundWorldState(snapshot, settings) {
    if (!snapshot || typeof snapshot !== 'object' || !settings || typeof settings !== 'object') return false;
    settings.mapEvolutionLastFiredBySite = cloneJson(snapshot.lastFiredBySite, {});
    settings.mapEvolutionWorldReportApplications = cloneJson(snapshot.reportApplications, {});
    settings.mapEvolutionBacklogBySite = cloneJson(snapshot.backlogBySite, {});
    settings.mapEvolutionThreadsBySite = cloneJson(snapshot.threadsBySite, {});
    settings.currentMemo = String(snapshot.memo || '');
    return true;
}

function normalizeThreadStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    return MAP_THREAD_STATUSES.includes(status) ? status : 'open';
}

export function normalizeEvolutionThread(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const cause = String(value.cause || '').trim();
    if (!cause) return null;
    return {
        id: String(value.id || '').trim().slice(0, 160),
        at: String(value.at || '').trim() || 'Unknown',
        status: normalizeThreadStatus(value.status),
        op: String(value.op || '').trim().slice(0, 40),
        subjectId: String(value.subjectId || value.subject_id || '').trim().slice(0, 120),
        actor: String(value.actor || '').trim().slice(0, 120),
        cause: cause.slice(0, 240),
        summary: String(value.summary || '').trim().slice(0, 600) || cause.slice(0, 240),
        compressed: !!value.compressed,
    };
}

function threadSubjectFromOperation(operation, createdAssets = []) {
    const op = String(operation?.op || '').trim();
    if (op === 'ADD_ASSET') {
        const name = String(operation.name || '').trim();
        const created = (createdAssets || []).find(asset => String(asset?.name || '').trim() === name);
        return String(created?.id || name).trim();
    }
    if (op === 'SET_CONNECTION') {
        return `${String(operation.from || '').trim()}->${String(operation.to || '').trim()}`;
    }
    if (op === 'SET_AREA' || op === 'ADD_AREA') {
        return String(operation.area_id || operation.name || '').trim();
    }
    return String(operation?.asset_id || '').trim();
}

export function threadsFromMapTransaction(transaction, {
    at = '',
    createdAssets = [],
} = {}) {
    const operationId = String(transaction?.operation_id || 'op').trim() || 'op';
    const ops = Array.isArray(transaction?.operations) ? transaction.operations : [];
    return ops.map((operation, index) => {
        const cause = String(operation?.cause || '').trim();
        if (!cause) return null;
        const op = String(operation?.op || '').trim();
        const subjectId = threadSubjectFromOperation(operation, createdAssets);
        const actor = String(operation?.actor || '').trim();
        const state = String(operation?.state || '').trim();
        const kill = ['DEAD', 'DESTROYED'].includes(state.toUpperCase());
        const summary = kill
            ? `${subjectId || 'asset'} ${state} by ${actor || 'unknown'}: ${cause}`
            : `${op} ${subjectId}${actor ? ` by ${actor}` : ''}: ${cause}`;
        return normalizeEvolutionThread({
            id: `${operationId}:${index}`,
            at,
            status: operation.thread_status,
            op,
            subjectId,
            actor,
            cause,
            summary,
        });
    }).filter(Boolean);
}

export function appendEvolutionThreads(threadsBySite, siteRoot, threads, {
    limit = MAX_MAP_EVOLUTION_THREADS,
} = {}) {
    const key = normalizeDungeonLabel(siteRoot);
    const next = { ...(threadsBySite && typeof threadsBySite === 'object' ? threadsBySite : {}) };
    if (!key) return next;
    const boundedLimit = Math.max(1, Math.min(MAX_MAP_EVOLUTION_THREADS, Math.floor(Number(limit) || MAX_MAP_EVOLUTION_THREADS)));
    let prior = (Array.isArray(next[key]) ? next[key] : []).map(normalizeEvolutionThread).filter(Boolean);
    for (const incoming of (Array.isArray(threads) ? threads : []).map(normalizeEvolutionThread).filter(Boolean)) {
        if (prior.some(item => item.id && incoming.id && item.id === incoming.id)) continue;
        if (incoming.status === 'resolved' || incoming.status === 'transformed') {
            prior = prior.map(item => (
                item.subjectId && incoming.subjectId && item.subjectId === incoming.subjectId && item.status === 'open'
                    ? { ...item, status: incoming.status }
                    : item
            ));
        }
        prior.push(incoming);
    }
    next[key] = prior.slice(-boundedLimit);
    return next;
}

/**
 * Latest thread per subject plus a bounded recent event list for the Evolution prompt.
 */
export function describeEvolutionThreads(threadsBySite, siteRoot, {
    lookback = MAP_EVOLUTION_THREAD_PROMPT_ENTRIES,
} = {}) {
    const key = normalizeDungeonLabel(siteRoot);
    const stored = (Array.isArray(threadsBySite?.[key]) ? threadsBySite[key] : [])
        .map(normalizeEvolutionThread)
        .filter(Boolean);
    const boundedLookback = Math.max(1, Math.min(
        MAX_MAP_EVOLUTION_THREADS,
        Math.floor(Number(lookback) || MAP_EVOLUTION_THREAD_PROMPT_ENTRIES),
    ));
    const entries = stored.slice(-boundedLookback);
    const latestBySubject = new Map();
    for (const entry of stored) {
        if (entry.subjectId) latestBySubject.set(entry.subjectId, entry);
    }
    const open = [...latestBySubject.values()].filter(entry => entry.status === 'open');
    return {
        entries,
        open,
        truncated: stored.length > entries.length,
    };
}

export function formatEvolutionThreadLine(entry) {
    const status = entry?.compressed ? 'DIGEST' : String(entry?.status || 'open').toUpperCase();
    const actor = entry?.actor ? ` by ${entry.actor}` : '';
    return `- ${entry?.at || 'Unknown'} — ${status} ${entry?.subjectId || entry?.op || 'event'}${actor}: ${entry?.cause || ''}`;
}

export function storedEvolutionThreads(threadsBySite, siteRoot) {
    const key = normalizeDungeonLabel(siteRoot);
    return (Array.isArray(threadsBySite?.[key]) ? threadsBySite[key] : [])
        .map(normalizeEvolutionThread)
        .filter(Boolean);
}

function escapeArcToken(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textMentionsArcSubject(text, subjectId, name = '') {
    const hay = String(text || '');
    if (!hay) return false;
    const id = String(subjectId || '').trim();
    if (id && new RegExp(`(^|[^A-Za-z0-9_-])${escapeArcToken(id)}([^A-Za-z0-9_-]|$)`, 'i').test(hay)) return true;
    const label = String(name || '').trim();
    if (label.length >= 3 && new RegExp(`(^|[^A-Za-z0-9_-])${escapeArcToken(label)}([^A-Za-z0-9_-]|$)`, 'i').test(hay)) return true;
    return false;
}

function isConnectionSubject(subjectId) {
    return String(subjectId || '').includes('->');
}

/**
 * Subjects a Testing Ground operator can follow: map assets plus historical
 * thread subjects/actors. Connection ids are omitted.
 */
export function collectEvolutionArcSubjects(storedThreads, document = null) {
    const byId = new Map();
    const upsert = (id, extra = {}) => {
        const key = String(id || '').trim();
        if (!key || isConnectionSubject(key)) return;
        const prior = byId.get(key) || {
            id: key,
            name: key,
            kind: '',
            state: '',
            location: '',
            onMap: false,
            eventCount: 0,
            open: false,
        };
        byId.set(key, { ...prior, ...extra, id: key });
    };
    for (const asset of (Array.isArray(document?.assets) ? document.assets : [])) {
        const id = String(asset?.id || '').trim();
        if (!id) continue;
        upsert(id, {
            name: String(asset.name || id).trim() || id,
            kind: String(asset.kind || '').trim(),
            state: String(asset.state || '').trim(),
            location: String(asset.location || '').trim(),
            onMap: true,
        });
    }
    const stored = (Array.isArray(storedThreads) ? storedThreads : []).map(normalizeEvolutionThread).filter(Boolean);
    const latestBySubject = new Map();
    for (const entry of stored) {
        if (entry.subjectId) {
            upsert(entry.subjectId);
            const row = byId.get(entry.subjectId);
            if (row) {
                row.eventCount += 1;
                latestBySubject.set(entry.subjectId, entry);
            }
        }
        if (entry.actor) {
            upsert(entry.actor);
            const row = byId.get(entry.actor);
            if (row && entry.actor !== entry.subjectId) row.eventCount += 1;
        }
    }
    for (const [subjectId, entry] of latestBySubject) {
        const row = byId.get(subjectId);
        if (row) row.open = entry.status === 'open';
    }
    const rank = row => {
        if (row.onMap && !['DEAD', 'DESTROYED'].includes(String(row.state).toUpperCase())) return 0;
        if (row.onMap) return 1;
        return 2;
    };
    return [...byId.values()].sort((a, b) => {
        const byRank = rank(a) - rank(b);
        if (byRank) return byRank;
        return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
}

/**
 * Chronological arc for one asset: events where it is the subject, the actor,
 * or named in a compressed digest / backlog summary.
 */
export function describeEvolutionAssetArc(storedThreads, subjectId, {
    storedBacklog = [],
    document = null,
} = {}) {
    const id = String(subjectId || '').trim();
    const asset = (Array.isArray(document?.assets) ? document.assets : [])
        .find(item => String(item?.id || '').trim() === id) || null;
    const name = String(asset?.name || '').trim();
    const stored = (Array.isArray(storedThreads) ? storedThreads : []).map(normalizeEvolutionThread).filter(Boolean);
    const events = [];
    for (const entry of stored) {
        let role = '';
        if (entry.subjectId && entry.subjectId === id) role = 'subject';
        else if (entry.actor && entry.actor === id) role = 'actor';
        else if (entry.compressed && textMentionsArcSubject(`${entry.cause} ${entry.summary}`, id, name)) role = 'digest';
        if (!role) continue;
        events.push({ ...entry, role });
    }
    const backlogHits = (Array.isArray(storedBacklog) ? storedBacklog : []).filter(entry => (
        textMentionsArcSubject(`${entry?.summary || ''} ${entry?.operationId || ''}`, id, name)
    ));
    const latestSubject = [...events].reverse().find(entry => entry.role === 'subject') || null;
    return {
        subjectId: id,
        name: name || id,
        asset,
        onMap: !!asset,
        open: latestSubject?.status === 'open',
        events,
        backlogHits,
    };
}

export const NARRATOR_SITE_ACTIVITY_OPEN = 8;
export const NARRATOR_SITE_ACTIVITY_DIGESTS = 3;

function formatNarratorCommitLine(entry, siteRoot = '') {
    return `- ${entry.at} — ${stripEvolutionDigestSitePrefix(entry.summary, siteRoot)}`;
}

/**
 * Newest material commits that fit under a token ceiling without slicing a summary.
 * A long latest tick is kept whole; older ticks are dropped first.
 */
export function pickCompleteNarratorCommits(commits, {
    maxTokens = DEFAULT_MAP_EVOLUTION_NARRATOR_COMMIT_TOKENS,
    siteRoot = '',
} = {}) {
    const rows = (Array.isArray(commits) ? commits : []).filter(entry => entry?.kind === 'commit' && entry.summary);
    const picked = [];
    const tokenCap = normalizeMapEvolutionNarratorCommitTokens(maxTokens);
    for (const entry of [...rows].reverse()) {
        const line = formatNarratorCommitLine(entry, siteRoot);
        const candidate = picked.length ? `${line}\n${picked.join('\n')}` : line;
        if (picked.length && estimateMapHistoryTokens(candidate) > tokenCap) break;
        picked.unshift(line);
    }
    return picked;
}

/**
 * Compact off-screen activity briefing for the narrator. Not the full ledger:
 * open threads, recent material commits, and current DIGEST rows.
 */
export function formatNarratorSiteActivity(threadsBySite, backlogBySite, siteRoot, {
    maxTokens = DEFAULT_MAP_EVOLUTION_NARRATOR_COMMIT_TOKENS,
} = {}) {
    const stored = storedEvolutionThreads(threadsBySite, siteRoot);
    const { open } = partitionCompressibleThreads(stored);
    const shownOpen = open.slice(-NARRATOR_SITE_ACTIVITY_OPEN);
    const openLines = shownOpen.map(entry => (
        formatEvolutionThreadLine({ ...entry, status: 'open', compressed: false })
    ));
    const digestLines = stored
        .filter(entry => entry.compressed)
        .slice(-NARRATOR_SITE_ACTIVITY_DIGESTS)
        .map(formatEvolutionThreadLine);
    const commits = pickCompleteNarratorCommits(storedEvolutionBacklog(backlogBySite, siteRoot), {
        maxTokens,
        siteRoot,
    });
    if (!openLines.length && !digestLines.length && !commits.length) return '';
    const parts = [
        'Use this to understand why occupancy looks this way. Do not recap it to the player unless they can perceive the aftermath.',
    ];
    if (openLines.length) {
        const truncated = open.length > shownOpen.length
            ? ` (latest ${shownOpen.length} of ${open.length})`
            : '';
        parts.push(`Open causal threads (latest per subject)${truncated}:\n${openLines.join('\n')}`);
    } else {
        parts.push('Open causal threads: none currently open.');
    }
    if (commits.length) parts.push(`Recent material Evolution commits:\n${commits.join('\n')}`);
    if (digestLines.length) parts.push(`Compressed history still on the ledger:\n${digestLines.join('\n')}`);
    return parts.join('\n');
}

/**
 * Current open threads (latest-per-subject still open) stay verbatim.
 * Historical OPEN rows that later resolved, plus resolved/transformed/digest
 * events, are the compressible pool.
 */
export function partitionCompressibleThreads(stored) {
    const entries = (Array.isArray(stored) ? stored : []).map(normalizeEvolutionThread).filter(Boolean);
    const lastIndexBySubject = new Map();
    entries.forEach((entry, index) => {
        if (entry.subjectId) lastIndexBySubject.set(entry.subjectId, index);
    });
    const open = [];
    const closed = [];
    entries.forEach((entry, index) => {
        const last = entry.subjectId ? lastIndexBySubject.get(entry.subjectId) : -1;
        if (entry.subjectId && index === last && entry.status === 'open') open.push(entry);
        else closed.push(entry);
    });
    return { open, closed };
}

export function formatClosedThreadsForCompression(closed) {
    return (Array.isArray(closed) ? closed : []).map(formatEvolutionThreadLine).join('\n');
}

/** Same ~4 chars/token heuristic as the lorebook router. */
export function estimateMapHistoryTokens(text) {
    return Math.ceil(String(text || '').length / 4);
}

export function normalizeMapEvolutionCompressThreshold(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return DEFAULT_MAP_EVOLUTION_COMPRESS_THRESHOLD;
    return Math.max(500, Math.min(100000, n));
}

export function normalizeMapEvolutionNarratorCommitTokens(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return DEFAULT_MAP_EVOLUTION_NARRATOR_COMMIT_TOKENS;
    return Math.max(200, Math.min(20000, n));
}

export function closedThreadHistoryTokens(threadsBySite, siteRoot) {
    const { closed } = partitionCompressibleThreads(storedEvolutionThreads(threadsBySite, siteRoot));
    return estimateMapHistoryTokens(formatClosedThreadsForCompression(closed));
}

export function evolutionHistoryNeedsCompression(threadsBySite, siteRoot, threshold) {
    const { closed } = partitionCompressibleThreads(storedEvolutionThreads(threadsBySite, siteRoot));
    if (closed.length < 2) return false;
    return closedThreadHistoryTokens(threadsBySite, siteRoot) >= normalizeMapEvolutionCompressThreshold(threshold);
}

export function storedEvolutionBacklog(backlogBySite, siteRoot) {
    const key = normalizeDungeonLabel(siteRoot);
    return (Array.isArray(backlogBySite?.[key]) ? backlogBySite[key] : [])
        .map(normalizeEvolutionBacklogEntry)
        .filter(Boolean);
}

function formatBacklogMemoryLine(entry, siteRoot = '') {
    const outcome = entry?.kind === 'commit' ? 'MATERIAL COMMIT' : 'QUIET CHECKPOINT';
    const passes = entry?.kind === 'quiet' && entry.passes > 1 ? ` across ${entry.passes} passes` : '';
    const operation = entry?.operationId ? ` [operation_id: ${entry.operationId}]` : '';
    const summary = stripEvolutionDigestSitePrefix(entry?.summary || '', siteRoot);
    return `- ${entry?.at || 'Unknown'} — ${outcome}${passes}${operation}; ${summary}`;
}

/**
 * Token usage and stored records for Testing Ground inspection.
 * Closed-thread tokens are the same quantity compression measures.
 */
export function describeEvolutionMemoryUsage(threadsBySite, backlogBySite, siteRoot, {
    threshold,
    compressEnabled = true,
} = {}) {
    const storedThreads = storedEvolutionThreads(threadsBySite, siteRoot);
    const storedBacklog = storedEvolutionBacklog(backlogBySite, siteRoot);
    const { open, closed } = partitionCompressibleThreads(storedThreads);
    const closedText = formatClosedThreadsForCompression(closed);
    const openText = open.map(entry => formatEvolutionThreadLine({
        ...entry,
        status: 'open',
        compressed: false,
    })).join('\n');
    const threadText = storedThreads.map(formatEvolutionThreadLine).join('\n');
    const backlogText = storedBacklog.map(entry => formatBacklogMemoryLine(entry, siteRoot)).join('\n');
    const closedTokens = estimateMapHistoryTokens(closedText);
    const openTokens = estimateMapHistoryTokens(openText);
    const threadTokens = estimateMapHistoryTokens(threadText);
    const backlogTokens = estimateMapHistoryTokens(backlogText);
    const compressThreshold = normalizeMapEvolutionCompressThreshold(threshold);
    return {
        storedThreads,
        storedBacklog,
        closedText,
        openText,
        threadText,
        backlogText,
        closedTokens,
        openTokens,
        threadTokens,
        backlogTokens,
        totalTokens: threadTokens + backlogTokens,
        threshold: compressThreshold,
        compressEnabled: compressEnabled !== false,
        overThreshold: closed.length >= 2 && closedTokens >= compressThreshold,
        openCount: open.length,
        closedCount: closed.length,
        digestCount: storedThreads.filter(entry => entry.compressed).length,
        entryCount: storedThreads.length,
        backlogCount: storedBacklog.length,
    };
}

export function applyCompressedThreadDigests(threadsBySite, siteRoot, digests) {
    const key = normalizeDungeonLabel(siteRoot);
    const next = { ...(threadsBySite && typeof threadsBySite === 'object' ? threadsBySite : {}) };
    if (!key) return next;
    const { open } = partitionCompressibleThreads(storedEvolutionThreads(next, siteRoot));
    const digestEntries = (Array.isArray(digests) ? digests : []).map((digest, index) => {
        const summary = String(digest?.summary || digest?.cause || '').trim();
        if (!summary) return null;
        const at = String(digest?.at || digest?.span || '').trim() || 'Compressed history';
        return normalizeEvolutionThread({
            id: String(digest?.id || `digest:${index}:${at}`).trim().slice(0, 160),
            at,
            status: 'transformed',
            op: 'DIGEST',
            subjectId: '',
            actor: '',
            cause: summary.slice(0, 240),
            summary: summary.slice(0, 600),
            compressed: true,
        });
    }).filter(Boolean).slice(0, 6);
    if (!digestEntries.length) return next;
    next[key] = [...digestEntries, ...open].slice(-MAX_MAP_EVOLUTION_THREADS);
    return next;
}
