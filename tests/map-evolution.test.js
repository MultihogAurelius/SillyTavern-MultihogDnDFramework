import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT } from '../map-evolution-prompt.js';
import { DEFAULT_MAP_UPDATER_SYSTEM_PROMPT } from '../map-updater-prompt.js';
import {
    appendEvolutionBacklogEntry,
    appendEvolutionThreads,
    applyCompressedThreadDigests,
    annotateEvolutionSitePresence,
    buildReportOutcomeStamps,
    clearEvolutionHistoryForSite,
    collectEvolutionArcSubjects,
    DEFAULT_MAP_EVOLUTION_COMPRESS_THRESHOLD,
    DEFAULT_MAP_EVOLUTION_NARRATOR_COMMIT_TOKENS,
    describeEvolutionAssetArc,
    describeEvolutionBacklog,
    describeEvolutionMemoryUsage,
    describeEvolutionThreads,
    describeEvolutionTimeWindow,
    estimateMapHistoryTokens,
    evolutionHistoryNeedsCompression,
    evolutionIntervalHoursForSettings,
    filterSitesByRoots,
    formatMapEvolutionRecentStory,
    formatNarratorSiteActivity,
    normalizeMapEvolutionCompressThreshold,
    normalizeMapEvolutionLookback,
    normalizeMapEvolutionNarratorCommitTokens,
    partitionCompressibleThreads,
    pickCompleteNarratorCommits,
    pickSitesForEvolutionTick,
    resolvePlayerBubble,
    resolveSiteEvolutionIntervalHours,
    setSiteEvolutionIntervalOverride,
    getSiteEvolutionIntervalOverride,
    siteEvolutionDue,
    stampEvolutionLastFired,
    stripEvolutionDigestSitePrefix,
    summarizeEvolutionDigest,
    summarizeMapEvolutionSchedule,
    threadsFromMapTransaction,
} from '../map-evolution-lib.js';
import { DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT } from '../map-evolution-compress-prompt.js';
import { replaceMemoCurrentTime } from '../memo-processor.js';

const tomb = {
    siteRoot: 'Forgotten Tomb',
    document: {
        site: 'Forgotten Tomb',
        kind: 'DUNGEON',
        areas: [{ id: 'threshold', name: 'Threshold', knowledge: 'VISITED' }],
        assets: [
            { id: 'odran', name: 'Odran', kind: 'CREATURE', state: 'ACTIVE', faction: 'Keepers of the Drowned Stone' },
            { id: 'ash-wight', name: 'Ash Wight', kind: 'CREATURE', state: 'DESTROYED' },
        ],
    },
};
const hall = {
    siteRoot: 'Hall of the Ember-Ancestors',
    document: {
        site: 'Hall of the Ember-Ancestors',
        kind: 'DUNGEON',
        areas: [{ id: 'nave', name: 'Nave', knowledge: 'UNREVEALED' }],
        assets: [],
    },
};
const docks = {
    siteRoot: 'Morrowfen',
    document: {
        site: 'Morrowfen',
        kind: 'SETTLEMENT',
        areas: [{ id: 'docks', name: 'Docks', knowledge: 'VISITED' }],
        assets: [{ id: 'harbor-watch', name: 'Harbor Watch', kind: 'GROUP', state: 'ACTIVE', faction: 'Morrowfen Watch' }],
    },
};

describe('Map Evolution', () => {
    it('treats story lookback 0 as empty rather than the whole chat', () => {
        expect(normalizeMapEvolutionLookback(0)).toBe(0);
        expect(normalizeMapEvolutionLookback(12)).toBe(12);
        expect(normalizeMapEvolutionLookback(999)).toBe(100);
        expect(normalizeMapEvolutionLookback('')).toBe(20);
        const chat = [
            { is_user: true, mes: 'Alpha turn' },
            { is_user: false, mes: 'Narrator one' },
            { is_user: true, mes: 'Beta turn' },
            { is_user: false, mes: 'Narrator two' },
        ];
        expect(formatMapEvolutionRecentStory(chat, { mapEvolutionLookback: 0 })).toBe('');
        expect(formatMapEvolutionRecentStory(chat, { mapEvolutionLookback: 10 }, 0)).toBe('');
        const story = formatMapEvolutionRecentStory(chat, { mapEvolutionLookback: 1 });
        expect(story).toContain('Beta turn');
        expect(story).not.toContain('Alpha turn');
    });

    it('supplies the same global recent story to every due map when lookback > 0', () => {
        const chat = [
            { is_user: true, mes: 'Alpha turn' },
            { is_user: false, mes: 'Narrator one' },
            { is_user: true, mes: 'Beta turn' },
            { is_user: false, mes: 'Narrator two' },
        ];
        const story = formatMapEvolutionRecentStory(chat, { mapEvolutionLookback: 2 });
        expect(story).toContain('Beta turn');
        expect(story).toContain('Narrator two');
        expect(story).toContain('Alpha turn');
    });

    it('ships a dedicated prompt that occupancy never sees', () => {
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('You are Map Evolution');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('evidence "EVOLVED"');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('PLAYER BUBBLE');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('Do not ADD_AREA');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('Local change is the default');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('not a permission gate');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('directional prose, not explicit map deltas');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('report_outcomes');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('already_realized_by_play');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('logical and narrative sense');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('ACCUMULATED EVOLUTION BACKLOG');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('frequent short intervals have not been treated as independent resets');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('CreateAreaMap owns peer-map attachment');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('INTERIOR: evolve room-scale');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('and larger unrest');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('BUILDING may contain CREATURE/GROUP/OBJECT/LOOT/HAZARD/TRAP');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('SET_ASSET notEntered:false');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).not.toMatch(/SETTLEMENT: restlessness/);
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).not.toContain('not chaos by default');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).not.toContain('Do not invent raids');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).not.toContain('own factions');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).not.toContain('WP is primary');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('Prefer durable local change and interesting dynamism over noop whenever in-world time has passed');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('a lone patrol commute as the entire result is usually too little');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('they do not necessarily act if it makes sense for them to stay');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('several operations in ONE transaction');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('Co-located groups are not automatically enemies');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('civilizational activity');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('ongoing *projects*');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('evo-day3-ossuary-bonework');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('Return to baseline is resolved');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('evo-day7-1900-guardians-home');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('"thread_status":"resolved"');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).not.toContain('Co-located competing groups should interact');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('"op":"MOVE_ASSET"');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('Never write MOVE_ASSET with "location"');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('MOVE_ASSET uses to (required)');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('Every operation MUST include cause');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('DEAD or DESTROYED also requires actor');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('Third-party killing is allowed');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('DESTROYED/DEAD/DEACTIVATED/TAKEN/CLEARED/REMOVED');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('ONE GROUP with count');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('"count":4');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('TIME MECHANICS');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('set duration to ""');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('leave it for Map Updater');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('SET_ASSET state LEFT');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('stale ACTIVE occupancy contradicted by RECENT STORY');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).toContain('evo-day2-1600-guide-removed');
        expect(DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT).not.toContain('Leaving this site: SET_ASSET state FLEEING or REMOVE_ASSET');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Every operation MUST include cause');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('ONE GROUP with count');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('"count":5');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('actor: "party"');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).not.toContain('Map Evolution');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).not.toContain('EVOLVED');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).not.toContain('World Report');
    });

    it('summarizes a sequential digest without dumping operations JSON', () => {
        const line = summarizeEvolutionDigest('Forgotten Tomb', {
            operations: [
                { op: 'SET_ASSET', asset_id: 'odran', state: 'LEFT', cause: 'Came to inspect the ossuary, then left.', actor: 'odran' },
                { op: 'SET_ASSET', asset_id: 'ash-wight', state: 'FLEEING', cause: 'Fled after the ossuary pack was destroyed.', actor: 'party' },
                { op: 'REMOVE_ASSET', asset_id: 'clutter-chair', cause: 'Mistaken ambient clutter.' },
            ],
        });
        expect(line).not.toContain('Forgotten Tomb:');
        expect(line).toContain('odran LEFT');
        expect(line).toContain('by odran');
        expect(line).toContain('ash-wight FLEEING');
        expect(line).toContain('by party');
        expect(line).toContain('clutter-chair removed from map');
        expect(line).not.toContain('"op"');

        const many = summarizeEvolutionDigest('Hall', {
            operations: Array.from({ length: 9 }, (_, i) => ({
                op: 'MOVE_ASSET',
                asset_id: `patrol-${i}`,
                to: 'nave',
                cause: `Patrol ${i} answered the alarm.`,
            })),
        });
        expect(many).toContain('patrol-0 moved to nave');
        expect(many).toContain('patrol-8 moved to nave');
    });

    it('does not burn World Report pressure on bare noop without report_outcomes', () => {
        const reports = [
            { reportId: 'World::1' },
            { reportId: 'World::2' },
        ];
        expect(buildReportOutcomeStamps(undefined, reports, { noop: true })).toEqual([]);
        expect(buildReportOutcomeStamps([], reports, { noop: true })).toEqual([]);

        const explicit = buildReportOutcomeStamps(
            [{ report_id: 'World::1', status: 'considered' }],
            reports,
            { noop: true },
        );
        expect(explicit).toEqual([
            { reportId: 'World::1', status: 'considered', localDigest: '' },
            { reportId: 'World::2', status: 'considered', localDigest: '' },
        ]);

        const material = buildReportOutcomeStamps(
            [{ report_id: 'World::1', status: 'materialized' }],
            reports,
            { digest: 'site: moved' },
        );
        expect(material).toEqual([
            { reportId: 'World::1', status: 'materialized', localDigest: 'site: moved' },
            { reportId: 'World::2', status: 'considered', localDigest: 'site: moved' },
        ]);
    });

    it('freezes the current area as the player bubble', () => {
        const bubble = resolvePlayerBubble({
            site: 'Forgotten Tomb',
            areas: [
                { id: 'threshold', name: 'Threshold' },
                { id: 'ossuary', name: 'Ossuary' },
            ],
            assets: [],
        }, 'Forgotten Tomb, Threshold', { combatActive: true });
        expect(bubble.frozenAreaIds).toEqual(['threshold']);
        expect(bubble.combatActive).toBe(true);
        expect(bubble.area.id).toBe('threshold');
    });

    it('treats only the footer site-root as current, not a trail BUILDING named after another map', () => {
        const thornbrook = {
            siteRoot: 'Thornbrook',
            document: {
                version: 3,
                site: 'Thornbrook',
                kind: 'SETTLEMENT',
                areas: [{ id: 'north-road', name: 'North Road', knowledge: 'DISCOVERED', geometry: [], connections: [] }],
                assets: [{
                    id: 'northeast-trail-toward-coldwater-creek',
                    kind: 'BUILDING',
                    name: 'Northeast Trail toward Coldwater Creek',
                    location: 'north-road',
                    state: 'ACTIVE',
                    knowledge: 'KNOWN',
                    notEntered: true,
                }],
            },
        };
        const hall = { siteRoot: 'Hall of the Ember-Ancestors', document: { site: 'Hall of the Ember-Ancestors', kind: 'DUNGEON', areas: [], assets: [] } };
        const coldwater = { siteRoot: 'Coldwater Creek', document: { site: 'Coldwater Creek', kind: 'DUNGEON', areas: [], assets: [] } };
        const annotated = annotateEvolutionSitePresence(
            [hall, thornbrook, coldwater],
            'Coldwater Creek, Central Forge Hall',
        );
        expect(annotated.currentRoot).toBe('Coldwater Creek');
        expect(annotated.sites.filter(site => site.current).map(site => site.siteRoot)).toEqual(['Coldwater Creek']);
        const hoursFor = evolutionIntervalHoursForSettings({
            mapEvolutionIntervalHours: 6,
            mapEvolutionOnSiteIntervalHours: 1,
            mapEvolutionOnSiteIntervalMinutes: 0,
        }, annotated.currentRoot);
        expect(hoursFor('Thornbrook')).toBe(6);
        expect(hoursFor('Hall of the Ember-Ancestors')).toBe(6);
        expect(hoursFor('Coldwater Creek')).toBe(1);
    });

    it('stamps a first-visit baseline and later fires on elapsed in-world hours', () => {
        expect(siteEvolutionDue(null, 8 * 60, 4)).toEqual({ due: false, baseline: true });
        expect(siteEvolutionDue(8 * 60, 8 * 60 + 3 * 60, 4)).toEqual({ due: false, baseline: false });
        expect(siteEvolutionDue(8 * 60, 8 * 60 + 4 * 60, 4)).toEqual({ due: true, baseline: false });
        expect(siteEvolutionDue(8 * 60, 8 * 60 + 29, 0.5)).toEqual({ due: false, baseline: false });
        expect(siteEvolutionDue(8 * 60, 8 * 60 + 30, 0.5)).toEqual({ due: true, baseline: false });
        expect(siteEvolutionDue(8 * 60, 8 * 60 + 48 * 60, 0)).toEqual({ due: false, baseline: false });
        expect(siteEvolutionDue(null, 8 * 60, 0)).toEqual({ due: false, baseline: true });
    });

    it('describes the model time window from this site\'s Last Evolved timestamp', () => {
        expect(describeEvolutionTimeWindow('Day 2, 06:30', 'Day 3, 12:45')).toEqual({
            lastEvolved: 'Day 2, 06:30',
            currentTime: 'Day 3, 12:45',
            elapsedMinutes: 1815,
            elapsed: '1 day, 6 hours, 15 minutes (1815 in-world minutes total)',
        });
        expect(describeEvolutionTimeWindow('', 'Day 3, 12:45')).toEqual({
            lastEvolved: 'Never',
            currentTime: 'Day 3, 12:45',
            elapsedMinutes: -1,
            elapsed: 'Unknown — this site has no Last Evolved baseline.',
        });
        expect(describeEvolutionTimeWindow('Day 4, 00:00', 'Day 3, 12:00').elapsed)
            .toContain('current time precedes Last Evolved');
    });

    it('accumulates frequent quiet checkpoints into one site trajectory', () => {
        let backlog = {};
        backlog = appendEvolutionBacklogEntry(backlog, 'Morrowfen', {
            kind: 'quiet', at: 'Day 2, 08:15', elapsedMinutes: 15,
        });
        backlog = appendEvolutionBacklogEntry(backlog, 'Morrowfen', {
            kind: 'quiet', at: 'Day 2, 08:30', elapsedMinutes: 15,
        });
        const context = describeEvolutionBacklog(backlog, 'Morrowfen', 15);

        expect(context.entries.map(entry => entry.kind)).toEqual(['quiet']);
        expect(context.entries[0].passes).toBe(2);
        expect(context.representedMinutes).toBe(45);
        expect(context.quietMinutes).toBe(45);
        expect(context.quietElapsed).toContain('45 in-world minutes total');
    });

    it('coalesces a long no-op streak without losing accumulated time', () => {
        let backlog = {};
        for (let index = 1; index <= 50; index++) {
            backlog = appendEvolutionBacklogEntry(backlog, 'Morrowfen', {
                kind: 'quiet', at: `tick-${index}`, elapsedMinutes: 2,
            });
        }
        const context = describeEvolutionBacklog(backlog, 'Morrowfen', 2);

        expect(context.entries).toHaveLength(1);
        expect(context.entries[0].passes).toBe(50);
        expect(context.entries[0].elapsedMinutes).toBe(100);
        expect(context.quietMinutes).toBe(102);
    });

    it('resets quiet accumulation at the latest material commit and de-duplicates retries', () => {
        let backlog = {};
        backlog = appendEvolutionBacklogEntry(backlog, 'Morrowfen', {
            kind: 'quiet', at: 'Day 2, 08:15', elapsedMinutes: 15,
        });
        backlog = appendEvolutionBacklogEntry(backlog, 'Morrowfen', {
            kind: 'commit', at: 'Day 2, 08:30', elapsedMinutes: 15,
            operationId: 'evo-morrowfen-watch', summary: 'Morrowfen: harbor-watch changed rotation',
        });
        backlog = appendEvolutionBacklogEntry(backlog, 'Morrowfen', {
            kind: 'commit', at: 'Day 2, 08:30', elapsedMinutes: 15,
            operationId: 'evo-morrowfen-watch', summary: 'duplicate retry',
        });
        backlog = appendEvolutionBacklogEntry(backlog, 'Morrowfen', {
            kind: 'quiet', at: 'Day 2, 08:45', elapsedMinutes: 15,
        });
        const context = describeEvolutionBacklog(backlog, 'Morrowfen', 15);

        expect(context.entries).toHaveLength(3);
        expect(context.representedMinutes).toBe(60);
        expect(context.quietMinutes).toBe(30);
        expect(context.entries[1].summary).toContain('harbor-watch changed rotation');
    });

    it('bounds retained Evolution outcomes per site', () => {
        let backlog = {};
        for (let index = 0; index < 6; index++) {
            backlog = appendEvolutionBacklogEntry(backlog, 'Morrowfen', {
                kind: 'commit', at: `tick-${index}`, elapsedMinutes: 5,
                operationId: `evo-${index}`,
            }, { limit: 3 });
        }
        expect(backlog.morrowfen.map(entry => entry.at)).toEqual(['tick-3', 'tick-4', 'tick-5']);
    });

    it('clears one site evolution history without touching other sites or the original bags', () => {
        const backlog = {
            morrowfen: [{ kind: 'commit', at: 'Day 2, 08:00', elapsedMinutes: 60, operationId: 'evo-1', summary: 'watch' }],
            abbey: [{ kind: 'quiet', at: 'Day 2, 08:00', elapsedMinutes: 15, passes: 1, summary: 'quiet' }],
        };
        const threads = {
            morrowfen: [{ id: 't1', subjectId: 'harbor-watch', status: 'open', cause: 'Rotated.', actor: 'harbor-watch', at: 'Day 2, 08:00', summary: 'rotated' }],
            abbey: [{ id: 't2', subjectId: 'ghoul', status: 'open', cause: 'Killed.', actor: 'party', at: 'Day 1, 16:00', summary: 'killed' }],
        };
        const reports = {
            morrowfen: { 'World::1': { status: 'considered' } },
            abbey: { 'World::2': { status: 'materialized' } },
        };
        const cleared = clearEvolutionHistoryForSite({
            backlogBySite: backlog,
            threadsBySite: threads,
            reportApplicationsBySite: reports,
        }, 'Morrowfen');
        expect(cleared.cleared).toBe(true);
        expect(cleared.backlogBySite.morrowfen).toBeUndefined();
        expect(cleared.backlogBySite.abbey).toEqual(backlog.abbey);
        expect(cleared.threadsBySite.morrowfen).toBeUndefined();
        expect(cleared.threadsBySite.abbey).toEqual(threads.abbey);
        expect(cleared.reportApplicationsBySite.morrowfen).toBeUndefined();
        expect(cleared.reportApplicationsBySite.abbey).toEqual(reports.abbey);
        expect(backlog.morrowfen).toBeDefined();
        expect(clearEvolutionHistoryForSite({ backlogBySite: backlog }, '').cleared).toBe(false);
        expect(clearEvolutionHistoryForSite({ backlogBySite: backlog }, '').backlogBySite.morrowfen).toBeDefined();
    });

    it('derives a killed-by thread and keeps it open until resolved', () => {
        const threads = threadsFromMapTransaction({
            operation_id: 'day1-1602-ghoul-destroyed',
            operations: [{
                op: 'SET_ASSET', asset_id: 'crypt-ghoul', state: 'DESTROYED',
                cause: 'Killed by the party on the landing.', actor: 'party',
            }],
        }, { at: 'Day 1, 16:02' });
        expect(threads).toHaveLength(1);
        expect(threads[0]).toMatchObject({
            actor: 'party',
            subjectId: 'crypt-ghoul',
            status: 'open',
            cause: 'Killed by the party on the landing.',
        });
        expect(threads[0].summary).toContain('DESTROYED by party');

        let bySite = appendEvolutionThreads({}, 'Abbey Undercroft', threads);
        const described = describeEvolutionThreads(bySite, 'Abbey Undercroft');
        expect(described.open).toHaveLength(1);
        expect(described.open[0].actor).toBe('party');

        bySite = appendEvolutionThreads(bySite, 'Abbey Undercroft', [{
            id: 'evo-looters:0',
            at: 'Day 2, 08:00',
            status: 'transformed',
            op: 'ADD_ASSET',
            subjectId: 'crypt-ghoul',
            actor: 'party',
            cause: 'Salt-Road Delvers occupied the emptied ossuary.',
            summary: 'vacuum transformed',
        }]);
        expect(describeEvolutionThreads(bySite, 'Abbey Undercroft').open).toHaveLength(0);
    });

    it('closes a subject when a later return-to-baseline op is resolved', () => {
        let bySite = appendEvolutionThreads({}, 'Baronial Crypt', [{
            id: 'evo-chase:0',
            at: 'Day 7, 11:00 AM',
            status: 'transformed',
            op: 'MOVE_ASSET',
            subjectId: 'upper-crypt-skeletal-guardians',
            actor: 'upper-crypt-skeletal-guardians',
            cause: 'Followed the pursuit downward.',
        }]);
        const homecoming = threadsFromMapTransaction({
            operation_id: 'evo-day7-1900-guardians-home',
            operations: [{
                op: 'MOVE_ASSET',
                asset_id: 'upper-crypt-skeletal-guardians',
                to: 'the-upper-gallery',
                cause: 'No living intruder remained; returned to defensive posts.',
                actor: 'upper-crypt-skeletal-guardians',
                thread_status: 'resolved',
            }],
        }, { at: 'Day 7, 07:00 PM' });
        expect(homecoming[0].status).toBe('resolved');
        bySite = appendEvolutionThreads(bySite, 'Baronial Crypt', homecoming);
        expect(describeEvolutionThreads(bySite, 'Baronial Crypt').open).toHaveLength(0);

        const omitted = threadsFromMapTransaction({
            operation_id: 'evo-omit-status',
            operations: [{
                op: 'MOVE_ASSET',
                asset_id: 'upper-crypt-skeletal-guardians',
                to: 'the-upper-gallery',
                cause: 'Returned to defensive posts.',
                actor: 'upper-crypt-skeletal-guardians',
            }],
        }, { at: 'Day 7, 07:00 PM' });
        expect(omitted[0].status).toBe('open');
    });

    it('does not treat historical OPEN rows as currently open once transformed', () => {
        const stored = [
            { id: 'a:0', at: 'Day 1, 08:00', status: 'open', op: 'SET_ASSET', subjectId: 'chapel-latch', actor: 'bandits', cause: 'Bandits barred the chapel latch.' },
            { id: 'b:0', at: 'Day 1, 12:00', status: 'open', op: 'MOVE_ASSET', subjectId: 'vermin-pack', cause: 'Vermin foraged the nave.' },
            { id: 'c:0', at: 'Day 2, 08:00', status: 'transformed', op: 'SET_ASSET', subjectId: 'vermin-pack', actor: 'skeletal-guardians', cause: 'Guardians drove the vermin into the crypt.' },
            { id: 'd:0', at: 'Day 2, 20:00', status: 'open', op: 'ADD_ASSET', subjectId: 'restless-spirits', actor: 'necromancer', cause: 'The necromancer woke the chapel dead.' },
        ];
        const { open, closed } = partitionCompressibleThreads(stored);
        expect(open.map(entry => entry.subjectId).sort()).toEqual(['chapel-latch', 'restless-spirits']);
        expect(closed.map(entry => entry.subjectId)).toEqual(['vermin-pack', 'vermin-pack']);

        const next = applyCompressedThreadDigests({ ossuary: stored }, 'Ossuary', [{
            at: 'Day 1 – Day 2',
            summary: 'Vermin foraged then were driven into the crypt by skeletal guardians.',
        }]);
        const described = describeEvolutionThreads(next, 'Ossuary');
        expect(described.open.map(entry => entry.subjectId).sort()).toEqual(['chapel-latch', 'restless-spirits']);
        expect(described.entries.filter(entry => entry.compressed)).toHaveLength(1);
        expect(described.entries.some(entry => entry.subjectId === 'vermin-pack')).toBe(false);
    });

    it('defaults the history-compression threshold to 10000 tokens', () => {
        expect(DEFAULT_MAP_EVOLUTION_COMPRESS_THRESHOLD).toBe(10000);
        expect(normalizeMapEvolutionCompressThreshold(undefined)).toBe(10000);
        expect(normalizeMapEvolutionCompressThreshold('10000')).toBe(10000);
        expect(DEFAULT_MAP_EVOLUTION_NARRATOR_COMMIT_TOKENS).toBe(2000);
        expect(normalizeMapEvolutionNarratorCommitTokens(undefined)).toBe(2000);
        expect(normalizeMapEvolutionNarratorCommitTokens('2000')).toBe(2000);
        expect(normalizeMapEvolutionNarratorCommitTokens(50)).toBe(200);
        expect(normalizeMapEvolutionNarratorCommitTokens(99999)).toBe(20000);
        expect(estimateMapHistoryTokens('abcd')).toBe(1);
        expect(evolutionHistoryNeedsCompression({}, 'Ossuary', 10000)).toBe(false);
        const bulky = {};
        bulky.ossuary = Array.from({ length: 400 }, (_, i) => ({
            id: `closed:${i}`,
            at: `Day ${i + 1}, 08:00`,
            status: 'resolved',
            op: 'MOVE_ASSET',
            subjectId: `patrol-${i}`,
            cause: 'The same patrol walked the corridor again, found nothing, and walked back to the gatehouse.',
        }));
        bulky.ossuary.push({
            id: 'open:latch',
            at: 'Day 41, 08:00',
            status: 'open',
            op: 'SET_ASSET',
            subjectId: 'chapel-latch',
            cause: 'The chapel latch is still barred from the inside.',
        });
        expect(evolutionHistoryNeedsCompression(bulky, 'Ossuary', 10000)).toBe(true);
        expect(evolutionHistoryNeedsCompression(bulky, 'Ossuary', 50000)).toBe(false);
    });

    it('exposes stored thread/backlog memory and closed-thread token usage', () => {
        const threadsBySite = {
            ossuary: [
                { id: 'a:0', at: 'Day 1, 08:00', status: 'open', op: 'SET_ASSET', subjectId: 'chapel-latch', cause: 'Bandits barred the chapel latch.' },
                { id: 'b:0', at: 'Day 1, 12:00', status: 'resolved', op: 'SET_ASSET', subjectId: 'vermin-pack', cause: 'Guardians drove the vermin into the crypt.' },
            ],
        };
        const backlogBySite = {
            ossuary: [{
                kind: 'commit',
                at: 'Day 1, 12:00',
                elapsedMinutes: 240,
                operationId: 'evo-1',
                summary: 'Guardians drove vermin into the crypt.',
            }],
        };
        const memory = describeEvolutionMemoryUsage(threadsBySite, backlogBySite, 'Ossuary', { threshold: 10000 });
        expect(memory.threshold).toBe(10000);
        expect(memory.openCount).toBe(1);
        expect(memory.closedCount).toBe(1);
        expect(memory.backlogCount).toBe(1);
        expect(memory.overThreshold).toBe(false);
        expect(memory.storedThreads[0].subjectId).toBe('chapel-latch');
        expect(memory.threadText).toContain('OPEN chapel-latch');
        expect(memory.threadText).toContain('RESOLVED vermin-pack');
        expect(memory.backlogText).toContain('MATERIAL COMMIT');
        expect(memory.closedTokens).toBeGreaterThan(0);
        expect(memory.totalTokens).toBe(memory.threadTokens + memory.backlogTokens);
    });

    it('filters a stored ledger into one asset arc, including actor and digest mentions', () => {
        const stored = [
            { id: 'a:0', at: 'Day 1, 08:00', status: 'open', op: 'ADD_ASSET', subjectId: 'vermin-pack', cause: 'Vermin nested in the nave.' },
            { id: 'b:0', at: 'Day 1, 12:00', status: 'open', op: 'SET_ASSET', subjectId: 'crypt-ghoul', actor: 'vermin-pack', cause: 'The pack worried the ghoul until it fled.' },
            { id: 'c:0', at: 'Day 2, 08:00', status: 'transformed', op: 'SET_ASSET', subjectId: 'vermin-pack', actor: 'skeletal-guardians', cause: 'Guardians drove the vermin into the crypt.' },
            { id: 'd:0', at: 'Day 3, 08:00', status: 'transformed', op: 'DIGEST', compressed: true, cause: 'Vermin-pack foraged, then skeletal-guardians drove them down.', summary: 'Vermin-pack foraged, then skeletal-guardians drove them down.' },
        ];
        const document = {
            assets: [
                { id: 'vermin-pack', name: 'Vermin Pack', kind: 'GROUP', state: 'FLEEING', location: 'crypt' },
                { id: 'crypt-ghoul', name: 'Crypt Ghoul', kind: 'CREATURE', state: 'FLEEING', location: 'nave' },
            ],
        };
        const subjects = collectEvolutionArcSubjects(stored, document);
        expect(subjects.map(row => row.id)).toEqual(['crypt-ghoul', 'vermin-pack', 'skeletal-guardians']);
        const arc = describeEvolutionAssetArc(stored, 'vermin-pack', {
            document,
            storedBacklog: [{ at: 'Day 2, 08:00', kind: 'commit', summary: 'Ossuary: vermin-pack driven into the crypt' }],
        });
        expect(arc.events.map(entry => entry.role)).toEqual(['subject', 'actor', 'subject', 'digest']);
        expect(arc.events[1].subjectId).toBe('crypt-ghoul');
        expect(arc.backlogHits).toHaveLength(1);
        expect(describeEvolutionAssetArc(stored, 'crypt-ghoul', { document }).events).toHaveLength(1);
    });

    it('briefs the narrator with open threads and material commits, not the full ledger', () => {
        expect(formatNarratorSiteActivity({}, {}, 'Ossuary')).toBe('');
        expect(formatNarratorSiteActivity({
            ossuary: [{ id: 'q:0', at: 'Day 1, 08:00', status: 'open', op: 'SET_ASSET', subjectId: 'latch', cause: 'Barred.' }],
        }, {
            ossuary: [{ kind: 'quiet', at: 'Day 1, 08:00', elapsedMinutes: 15, summary: 'Nothing stirred.' }],
        }, 'Ossuary')).toContain('OPEN latch');
        expect(formatNarratorSiteActivity({
            ossuary: [{ id: 'q:0', at: 'Day 1, 08:00', status: 'open', op: 'SET_ASSET', subjectId: 'latch', cause: 'Barred.' }],
        }, {
            ossuary: [{ kind: 'quiet', at: 'Day 1, 08:00', elapsedMinutes: 15, summary: 'Nothing stirred.' }],
        }, 'Ossuary')).not.toContain('Nothing stirred.');

        const threadsBySite = {
            ossuary: [
                { id: 'a:0', at: 'Day 1, 08:00', status: 'open', op: 'SET_ASSET', subjectId: 'chapel-latch', actor: 'bandits', cause: 'Bandits barred the chapel latch.' },
                { id: 'b:0', at: 'Day 1, 12:00', status: 'resolved', op: 'MOVE_ASSET', subjectId: 'vermin-pack', cause: 'Vermin foraged the nave.' },
                { id: 'c:0', at: 'Day 2, 08:00', status: 'transformed', op: 'DIGEST', compressed: true, cause: 'Vermin foraged, then guardians drove them into the crypt.', summary: 'Vermin foraged, then guardians drove them into the crypt.' },
            ],
        };
        const backlogBySite = {
            ossuary: [
                { kind: 'quiet', at: 'Day 1, 16:00', elapsedMinutes: 15, summary: 'Quiet checkpoint.' },
                { kind: 'commit', at: 'Day 2, 08:00', elapsedMinutes: 240, operationId: 'evo-1', summary: 'Guardians drove vermin into the crypt.' },
            ],
        };
        const briefing = formatNarratorSiteActivity(threadsBySite, backlogBySite, 'Ossuary');
        expect(briefing).toContain('OPEN chapel-latch by bandits: Bandits barred the chapel latch.');
        expect(briefing).toContain('Guardians drove vermin into the crypt.');
        expect(briefing).toContain('DIGEST');
        expect(briefing).not.toContain('RESOLVED vermin-pack');
        expect(briefing).not.toContain('Quiet checkpoint.');
        expect(briefing).not.toContain('Vermin foraged the nave.');

        const crowded = {};
        crowded.ossuary = Array.from({ length: 10 }, (_, i) => ({
            id: `open:${i}`,
            at: `Day 1, ${String(8 + i).padStart(2, '0')}:00`,
            status: 'open',
            op: 'SET_ASSET',
            subjectId: `patrol-${i}`,
            cause: `Patrol ${i} is still walking the wall.`,
        }));
        const truncated = formatNarratorSiteActivity(crowded, {}, 'Ossuary');
        expect(truncated).toContain('latest 8 of 10');
        expect(truncated).toContain('OPEN patrol-9');
        expect(truncated).toContain('OPEN patrol-2');
        expect(truncated).not.toContain('OPEN patrol-1');
        expect(truncated).not.toContain('OPEN patrol-0');
    });

    it('feeds the narrator complete Evolution commits under a token ceiling', () => {
        const longCause = 'The Ash-Born continued feeding the forge until the dormant embers woke and the scavengers fled the hearth.';
        const body = `ember-scavengers moved to the-hall-of-echoing-footsteps: Fled from the excavation team after their looting was exposed.; harl moved to the-hall-of-echoing-footsteps: Pursued the fleeing scavengers to reclaim the desecrated haul.; torvin moved to the-hall-of-echoing-footsteps: Joined the pursuit after the scavengers fled toward the threshold.; cinder-lantern-delvers moved to the-hall-of-echoing-footsteps: Investigated the disturbance after hearing movement deeper inside the barrow.; geometry the-forge-of-dormant-embers by the-ash-born: ${longCause}`;
        const storedLegacy = `Hall of the Ember-Ancestors: ${body}`;
        expect(body.length).toBeGreaterThan(600);

        const stored = appendEvolutionBacklogEntry({}, 'Hall of the Ember-Ancestors', {
            kind: 'commit',
            at: '02:35 PM, Day 1',
            elapsedMinutes: -1,
            operationId: 'evo-1',
            summary: storedLegacy,
        });
        expect(stored['hall of the ember ancestors'][0].summary).toBe(storedLegacy);
        expect(stored['hall of the ember ancestors'][0].summary).toContain('dormant embers woke');

        const briefing = formatNarratorSiteActivity({}, stored, 'Hall of the Ember-Ancestors');
        expect(briefing).toContain(body);
        expect(briefing).not.toContain('Hall of the Ember-Ancestors:');
        expect(briefing).not.toMatch(/continued feedi$/m);

        const bulky = 'x'.repeat(3000);
        const lines = pickCompleteNarratorCommits([
            { kind: 'commit', at: 'Day 1, 08:00', summary: `old tick ${bulky}` },
            { kind: 'commit', at: 'Day 1, 12:00', summary: `mid tick ${bulky}` },
            { kind: 'commit', at: 'Day 1, 16:00', summary: `new tick ${bulky}` },
        ], { maxTokens: 2000 });
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('mid tick');
        expect(lines[1]).toContain('new tick');
        expect(lines.join('\n')).not.toContain('old tick');
        expect(lines[0]).toContain(bulky);
        expect(lines[1]).toContain(bulky);

        const manySmall = Array.from({ length: 6 }, (_, i) => ({
            kind: 'commit',
            at: `Day 1, ${String(8 + i).padStart(2, '0')}:00`,
            summary: `tick ${i} patrol moved to nave`,
        }));
        expect(pickCompleteNarratorCommits(manySmall, { maxTokens: 2000 })).toHaveLength(6);

        const huge = 'y'.repeat(12000);
        const oversized = pickCompleteNarratorCommits([
            { kind: 'commit', at: 'Day 1, 08:00', summary: 'old small' },
            { kind: 'commit', at: 'Day 1, 16:00', summary: huge },
        ], { maxTokens: 2000 });
        expect(oversized).toHaveLength(1);
        expect(oversized[0]).toContain(huge);
        expect(oversized[0]).toContain('Day 1, 16:00');

        const cappedBriefing = formatNarratorSiteActivity({}, {
            ossuary: [
                { kind: 'commit', at: 'Day 1, 08:00', summary: `old ${bulky}` },
                { kind: 'commit', at: 'Day 1, 16:00', summary: `new ${bulky}` },
            ],
        }, 'Ossuary', { maxTokens: 800 });
        expect(cappedBriefing).toContain('new ');
        expect(cappedBriefing).not.toContain('old ');
    });

    it('omits the site label from material commits and strips it from stored headers', () => {
        expect(stripEvolutionDigestSitePrefix(
            'Bunker Theta: security-android-patrol ALERT by security-android-patrol: The surviving security routines detected recent movement.',
            'Bunker Theta',
        )).toBe('security-android-patrol ALERT by security-android-patrol: The surviving security routines detected recent movement.');
        expect(stripEvolutionDigestSitePrefix('Hall of records: clerks copied the ledger.', 'Hall')).toBe('Hall of records: clerks copied the ledger.');
        expect(stripEvolutionDigestSitePrefix('patrol moved to nave', 'Ossuary')).toBe('patrol moved to nave');

        const stored = {
            'bunker theta': [{
                kind: 'commit',
                at: 'Day 2, 08:00',
                summary: 'Bunker Theta: security-android-patrol ALERT by security-android-patrol: The surviving security routines detected recent movement near the entrance and shifted from routine patrol to investigation.; maintenance-drone-swarm IDLE by maintenance-drone-swarm: Uneven emergency power has redirected the maintenance system toward stabilizing the junction before resuming broader repairs.',
            }],
        };
        const briefing = formatNarratorSiteActivity({}, stored, 'Bunker Theta');
        expect(briefing).toContain('security-android-patrol ALERT');
        expect(briefing).toContain('maintenance-drone-swarm IDLE');
        expect(briefing).not.toContain('Bunker Theta:');
    });

    it('replaces the current [TIME] line without touching Last Rest', () => {
        const next = replaceMemoCurrentTime('[TIME]\nDay 1, 08:00\nLast Rest: Day 1, 06:00\n[/TIME]', 'Day 2, 20:00');
        expect(next).toContain('Day 2, 20:00');
        expect(next).toContain('Last Rest: Day 1, 06:00');
        expect(next).not.toContain('Day 1, 08:00');
    });

    it('summarizes last/next Evolution times like World Progression', () => {
        expect(summarizeMapEvolutionSchedule({}, { intervalHours: 4, currentMinutes: 8 * 60 })).toEqual({
            lastMins: -1,
            nextMins: 12 * 60,
        });
        expect(summarizeMapEvolutionSchedule({
            hall: 'Day 1, 08:00',
            docks: 'Day 1, 12:00',
        }, { intervalHours: 4, currentMinutes: 16 * 60 })).toEqual({
            lastMins: 12 * 60,
            nextMins: 12 * 60,
        });
        const stamped = stampEvolutionLastFired({}, ['Hall of the Ember-Ancestors', 'Morrowfen'], 'Day 2, 04:00');
        expect(stamped['hall of the ember ancestors']).toBe('Day 2, 04:00');
        expect(stamped.morrowfen).toBe('Day 2, 04:00');
        expect(Object.keys(stamped)).toHaveLength(2);
    });

    it('filters mapped sites by selected roots', () => {
        expect(filterSitesByRoots([tomb, hall, docks], ['Morrowfen']).map(site => site.siteRoot)).toEqual(['Morrowfen']);
        expect(filterSitesByRoots([tomb, hall], [])).toEqual([]);
    });

    it('picks the active site only for the active tick scope', () => {
        const lastFiredMinutesFor = () => 0;
        const picked = pickSitesForEvolutionTick([tomb, hall, docks], {
            scope: 'active',
            currentRoot: 'Forgotten Tomb',
            lastFiredMinutesFor,
            currentMinutes: 8 * 60,
            intervalHours: 4,
        });
        expect(picked.due.map(site => site.siteRoot)).toEqual(['Forgotten Tomb']);
        expect(picked.baseline).toEqual([]);
    });

    it('takes N due maps, or all due when count is 0, without spending slots on baselines', () => {
        const lastFiredMinutesFor = root => ({
            'Forgotten Tomb': -1,
            'Hall of the Ember-Ancestors': 0,
            Morrowfen: 60,
        }[root]);
        const counted = pickSitesForEvolutionTick([tomb, hall, docks], {
            scope: 'count',
            count: 1,
            randomize: false,
            lastFiredMinutesFor,
            currentMinutes: 8 * 60,
            intervalHours: 4,
        });
        expect(counted.baseline.map(site => site.siteRoot)).toEqual(['Forgotten Tomb']);
        expect(counted.due.map(site => site.siteRoot)).toEqual(['Hall of the Ember-Ancestors']);

        const allDue = pickSitesForEvolutionTick([tomb, hall, docks], {
            scope: 'count',
            count: 0,
            randomize: false,
            lastFiredMinutesFor,
            currentMinutes: 8 * 60,
            intervalHours: 4,
        });
        expect(allDue.due.map(site => site.siteRoot)).toEqual(['Hall of the Ember-Ancestors', 'Morrowfen']);
    });

    it('randomizes due maps when asked, otherwise oldest-due first', () => {
        const lastFiredMinutesFor = root => ({
            'Forgotten Tomb': 120,
            'Hall of the Ember-Ancestors': 0,
            Morrowfen: 60,
        }[root]);
        const oldest = pickSitesForEvolutionTick([tomb, hall, docks], {
            scope: 'count',
            count: 2,
            randomize: false,
            lastFiredMinutesFor,
            currentMinutes: 8 * 60,
            intervalHours: 4,
        });
        expect(oldest.due.map(site => site.siteRoot)).toEqual(['Hall of the Ember-Ancestors', 'Morrowfen']);

        const randomized = pickSitesForEvolutionTick([tomb, hall, docks], {
            scope: 'count',
            count: 1,
            randomize: true,
            lastFiredMinutesFor,
            currentMinutes: 8 * 60,
            intervalHours: 4,
            random: () => 0,
        });
        expect(randomized.due).toHaveLength(1);
        expect(['Forgotten Tomb', 'Hall of the Ember-Ancestors', 'Morrowfen']).toContain(randomized.due[0].siteRoot);
    });

    it('evolves only the selected checklist, and nothing when the checklist is empty', () => {
        const lastFiredMinutesFor = () => 0;
        const selected = pickSitesForEvolutionTick([tomb, hall, docks], {
            scope: 'selected',
            count: 0,
            selectedRoots: ['Morrowfen'],
            lastFiredMinutesFor,
            currentMinutes: 8 * 60,
            intervalHours: 4,
        });
        expect(selected.due.map(site => site.siteRoot)).toEqual(['Morrowfen']);

        const empty = pickSitesForEvolutionTick([tomb, hall, docks], {
            scope: 'selected',
            selectedRoots: [],
            lastFiredMinutesFor,
            currentMinutes: 8 * 60,
            intervalHours: 4,
        });
        expect(empty.pool).toEqual([]);
        expect(empty.due).toEqual([]);
        expect(empty.baseline).toEqual([]);
    });

    it('resolves current-map and per-site interval overrides without changing Evolution behavior', () => {
        const options = {
            intervalHours: 12,
            onSiteIntervalHours: 2,
            intervalHoursBySite: { 'Bunker Theta': 4 },
            currentRoot: 'Bunker Theta',
        };
        expect(resolveSiteEvolutionIntervalHours('Bunker Theta', options)).toBe(4);
        expect(resolveSiteEvolutionIntervalHours('Morrowfen', options)).toBe(12);
        expect(resolveSiteEvolutionIntervalHours('Bunker Theta', { ...options, intervalHoursBySite: {} })).toBe(2);
        expect(resolveSiteEvolutionIntervalHours('Morrowfen', { ...options, currentRoot: 'Morrowfen', onSiteIntervalHours: 0 })).toBe(0);
        expect(getSiteEvolutionIntervalOverride({ 'bunker theta': 4 }, 'Bunker Theta')).toBe(4);
        expect(getSiteEvolutionIntervalOverride({}, 'Bunker Theta')).toBeNull();
        expect(setSiteEvolutionIntervalOverride({ 'bunker theta': 4 }, 'Bunker Theta', '')).toEqual({});
        expect(setSiteEvolutionIntervalOverride({}, 'Bunker Theta', 0)).toEqual({ 'bunker theta': 0 });
        expect(resolveSiteEvolutionIntervalHours('Current Site', { currentRoot: 'Current Site' })).toBe(1);
        expect(resolveSiteEvolutionIntervalHours('Current Site', {
            currentRoot: 'Current Site',
            onSiteIntervalHours: 0,
            onSiteIntervalMinutes: 30,
        })).toBe(0.5);
        expect(resolveSiteEvolutionIntervalHours('Current Site', {
            currentRoot: 'Current Site',
            onSiteIntervalHours: 0,
            onSiteIntervalMinutes: 0,
        })).toBe(0);
        expect(resolveSiteEvolutionIntervalHours('Other Site', { currentRoot: 'Current Site' })).toBe(12);
    });

    it('picks due maps from per-site intervals while leaving others waiting', () => {
        const lastFiredMinutesFor = () => 0;
        const picked = pickSitesForEvolutionTick([tomb, hall, docks], {
            scope: 'all',
            currentRoot: 'Forgotten Tomb',
            lastFiredMinutesFor,
            currentMinutes: 3 * 60,
            intervalHours: 12,
            intervalHoursFor: root => resolveSiteEvolutionIntervalHours(root, {
                intervalHours: 12,
                onSiteIntervalHours: 2,
                intervalHoursBySite: { Morrowfen: 0 },
                currentRoot: 'Forgotten Tomb',
            }),
        });
        expect(picked.due.map(site => site.siteRoot)).toEqual(['Forgotten Tomb']);
    });

    it('summarizes next Evolution from the soonest per-site clock', () => {
        expect(summarizeMapEvolutionSchedule({
            hall: 'Day 1, 08:00',
            docks: 'Day 1, 08:00',
        }, {
            intervalHours: 12,
            intervalHoursFor: key => (key === 'hall' ? 2 : 12),
        })).toEqual({
            lastMins: 8 * 60,
            nextMins: 10 * 60,
        });
        expect(summarizeMapEvolutionSchedule({
            hall: 'Day 1, 08:00',
        }, {
            intervalHours: 12,
            intervalHoursFor: () => 0,
            currentMinutes: 16 * 60,
        })).toEqual({
            lastMins: 8 * 60,
            nextMins: -1,
        });
    });

    it('keeps Evolution sequential, occupancy-separate, and wired through the pipeline', () => {
        const evolution = readFileSync(new URL('../map-evolution.js', import.meta.url), 'utf8');
        const updater = readFileSync(new URL('../map-updater.js', import.meta.url), 'utf8');
        const hooks = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
        const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
        const panelMarkup = readFileSync(new URL('../src/ui/panel/panel-markup.js', import.meta.url), 'utf8');
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        const defaultsSource = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');

        expect(evolution).not.toContain("trigger === 'world_progression'");
        expect(evolution).toContain('Hours elapsed with several living groups may mean several operations');
        expect(evolution).toContain('they do not necessarily act if it makes sense for them to stay where they were');
        expect(evolution).toContain('Do not spend the whole tick moving a single patrol');
        expect(evolution).toContain('Co-located groups are not automatically enemies');
        expect(evolution).toContain('archetype-fitting project');
        expect(evolution).toContain('Return to baseline');
        expect(evolution).toContain('Omitted thread_status defaults to open');
        expect(evolution).toContain('directional prose, not explicit deltas');
        expect(evolution).toContain('EVOLUTION TIME WINDOW (AUTHORITATIVE)');
        expect(evolution).toContain('LEVEL OF DETAIL — CURRENT MAP (TACTICAL AND FELT)');
        expect(evolution).toContain('one or two meaningful, causal developments the party could discover soon');
        expect(evolution).toContain('Map Updater owns observed/current-area events');
        expect(evolution).toContain("if (!partyIsHere || onSitePreset === 'standard') return '';");
        expect(evolution).toContain("settings.mapEvolutionOnSitePreset === 'standard' ? 'standard' : 'dynamic'");
        expect(evolution).not.toContain('LEVEL OF DETAIL — OTHER MAP');
        expect(evolution).not.toContain('Evolve this map at lower resolution');
        expect(evolution).toContain('ACCUMULATED EVOLUTION BACKLOG (THIS SITE)');
        expect(evolution).toContain('Do not choose noop solely because the latest interval is short');
        expect(evolution).toContain('settings.mapEvolutionLastFiredBySite?.[siteKey]');
        expect(evolution).toContain('settings.mapEvolutionBacklogBySite');
        expect(evolution).toContain('Never substitute the configured interval for the actual elapsed duration');
        expect(evolution).toContain('pendingWorldReportsForSite');
        expect(evolution).toContain('mapEvolutionWorldReportApplications');
        expect(evolution).toContain('delete transaction.report_outcomes');
        expect(evolution).toContain('siteRoots');
        expect(evolution).toContain('listMappedEvolutionSites');
        expect(evolution).toContain('annotateEvolutionSitePresence');
        expect(evolution).not.toContain('normalizeDungeonLabel(currentLocation).includes(normalizeDungeonLabel(site.siteRoot))');
        expect(evolution).toContain("scope === 'active'");
        expect(evolution).toContain('for (const site of [...baselineOnly, ...toEvolve])');
        expect(evolution).toContain("{ stream: true, debugSource: 'Map Evolution' }");
        expect(evolution).toContain('OPEN CAUSAL THREADS (THIS SITE)');
        expect(evolution).toContain('settings.mapEvolutionThreadsBySite');
        expect(evolution).toContain('Field reminder: Every operation needs cause');
        expect(evolution).not.toContain('groundMapsAfterWorldProgression');
        expect(evolution).toContain('export async function maybeRunMapEvolution');
        expect(evolution).toContain('holdExitBookkeeping');
        expect(evolution).toContain("exitResult?.skipped === 'busy'");
        expect(evolution).toContain('buildReportOutcomeStamps');
        expect(evolution).toContain('persistMapEvolutionState(passChatId)');
        expect(evolution).toContain("skipped: 'chat_changed'");
        expect(evolution).toContain('export async function loadMappedEvolutionSite');
        expect(evolution).toContain("from './map-evolution-lib.js'");
        expect(evolution).not.toContain("from './map-updater.js'");
        expect(evolution).not.toContain('normalizeReportOutcomes');

        expect(updater).toContain('isMapEvolutionRunning()');
        expect(updater).not.toContain('EVOLVED');
        expect(updater).not.toContain('groundMapsAfterWorldProgression');

        expect(hooks).toContain('mapResult = await runMapUpdaterPass');
        expect(hooks.indexOf('mapResult = await runMapUpdaterPass')).toBeLessThan(hooks.indexOf('await maybeRunWorldProgression()'));
        expect(hooks.indexOf('await maybeRunWorldProgression()')).toBeLessThan(hooks.indexOf('await maybeRunMapEvolution()'));
        expect(hooks).not.toContain('groundMapsAfterWorldProgression');
        expect(hooks).toContain('maybeRollbackMapEvolutionForSwipe');
        expect(hooks).toContain('stopMapEvolutionPass()');

        expect(settingsMarkup).toContain('<b>Map Evolution</b>');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_enabled"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_connection_source"');
        expect(settingsMarkup).toContain('Uses the Map Evolution connection');
        expect(settingsMarkup).not.toContain('Map Updater &amp; Evolution');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_interval_hours"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_onsite_interval_hours"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_onsite_interval_minutes"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_onsite_preset"');
        expect(settingsMarkup).toContain('High Dynamism — tactical and soon discoverable');
        expect(settingsMarkup).toContain('Standard — same behavior as background maps');
        expect(defaultsSource).toContain('mapEvolutionIntervalHours: 12');
        expect(defaultsSource).toContain('mapEvolutionConnectionSource: "default"');
        expect(defaultsSource).not.toContain('mapEvolutionConnectionSeeded');
        expect(defaultsSource).toContain('mapEvolutionOnSiteIntervalHours: 1');
        expect(defaultsSource).toContain('mapEvolutionOnSiteIntervalMinutes: 0');
        expect(defaultsSource).toContain("mapEvolutionOnSitePreset: 'dynamic'");
        expect(indexSource).toContain("settings.mapEvolutionOnSitePreset = String($(this).val() || '') === 'standard' ? 'standard' : 'dynamic'");
        expect(settingsMarkup).toContain('<b>Per-map interval</b>');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_site_list_header"');
        expect(panelMarkup).toContain('id="rt-agent-map-evo-onsite-interval"');
        expect(panelMarkup).toContain('id="rt-agent-map-evo-onsite-minutes"');
        expect(evolution).toContain('evolutionIntervalHoursForSettings');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_world_report_lookback"');
        expect(settingsMarkup).toContain('Reports never trigger an immediate map fan-out');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_tick_scope"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_tick_count"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_tick_randomize"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_selected_list"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_evolve_now"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_last_fired"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_next_report_val"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_btn_override_next"');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_testing_ground"');
        expect(settingsMarkup).toContain('<b style="font-size:0.9em; flex:1;">Mapped sites</b>');
        expect(settingsMarkup).toContain('<b>Run now</b> is the checkbox');
        expect(settingsMarkup).toContain('does not enable or disable a per-map timer');
        expect(indexSource).not.toContain("$('#rpg_map_evolution_selected_row').toggle(scope === 'selected')");
        expect(indexSource).toContain("$('#rpg_map_evolution_interval_selected_hint').toggle(scope === 'selected')");
        expect(settingsMarkup).toMatch(/id="rpg_map_evolution_lookback"[^>]*max="100"/);
        expect(settingsMarkup).toMatch(/id="rpg_map_evolution_max_tokens"[^>]*max="32000"/);
        expect(settingsMarkup).toContain('id="rpg_map_evolution_compress_enabled"');
        expect(settingsMarkup).toMatch(/id="rpg_map_evolution_compress_threshold"[^>]*value="10000"/);
        expect(settingsMarkup).toMatch(/id="rpg_map_evolution_narrator_commit_tokens"[^>]*value="2000"/);
        expect(settingsMarkup).toContain('Map Evolution memory');
        expect(settingsMarkup).toContain('transferred to the <b>narrator</b>');
        expect(defaultsSource).toContain('mapEvolutionLookback: 20');
        expect(defaultsSource).toContain('mapEvolutionCompressThreshold: 10000');
        expect(defaultsSource).toContain('mapEvolutionNarratorCommitTokens: 2000');
        expect(indexSource).toContain('rpg_map_evolution_lookback');
        expect(indexSource).toContain('rpg_map_evolution_narrator_commit_tokens');
        expect(hooks).toContain('mapEvolutionNarratorCommitTokens');
        expect(settingsMarkup).toContain('id="rpg_map_evolution_compress_prompt"');
        expect(evolution).toContain('Number(settings.mapEvolutionMaxTokens) || 25000');
        expect(evolution).toContain('formatMapEvolutionRecentStory');
        expect(evolution).toContain('## RECENT STORY');
        expect(evolution).toContain('This block may be empty');
        expect(evolution).toContain('Map Updater runs only on the party\'s current map');
        expect(evolution).toContain('AUTHORITATIVE RECENT STORY CONTRACT');
        expect(evolution).not.toContain('Use this only to ground off-screen change');
        expect(evolution).toContain('lookback = null');
        expect(evolution).toContain('maybeCompressSiteThreads');
        expect(evolution).toContain('mapEvolutionCompressThreshold');
        expect(evolution).toContain('compressing evolution history');
        expect(DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT).toContain('You are Map Evolution History Compression');
        expect(DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT).toContain('Open threads must survive unchanged');
        expect(DEFAULT_MAP_EVOLUTION_COMPRESS_SYSTEM_PROMPT).toContain('do not rewrite them');
        expect(evolution).toContain('mapEvolutionConnectionSource');
        expect(evolution).not.toContain('mapRuntimeConnectionSource');
        expect(evolution).not.toContain('mapArchitectConnectionSource');
        expect(panelMarkup).toContain('id="rt-research-map-evolution"');
        expect(indexSource).toContain('rpg_map_evolution_evolve_now');
        expect(indexSource).toContain('rpg_map_evolution_testing_ground');
        expect(indexSource).toContain('listMappedEvolutionSites');
        expect(indexSource).toContain('mapEvolutionTickScope');
        expect(indexSource).toContain('refreshTrackerViewRef');

        const debug = readFileSync(new URL('../map-evolution-debug.js', import.meta.url), 'utf8');
        const debugUi = readFileSync(new URL('../src/ui/panel/panel-map-evolution-debug.js', import.meta.url), 'utf8');
        const debugCss = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        expect(debug).toContain('export async function debugSimulateTicks');
        expect(debug).toContain('export async function debugUndoLastEvolutionPass');
        expect(debug).toContain('export async function debugRedoLastEvolutionPass');
        expect(debug).toContain('No Evolution pass to undo');
        expect(debug).toContain('snapshotCampaignLocationsBook');
        expect(debug).toContain('restoreCampaignLocationsBook');
        expect(debug).toContain('export function debugClearEvolutionHistory');
        expect(debug).toContain("origin: 'DEBUG_SANDBOX'");
        expect(debug).toContain('appendEvolutionBacklogEntry');
        expect(debug).toContain('summarizeEvolutionDigest');
        expect(debug).toContain('advanceCampaignTime');
        expect(debug).toContain('lookback: MAX_MAP_EVOLUTION_THREADS');
        expect(debug).toContain('describeEvolutionMemoryUsage');
        expect(debugUi).toContain('allowVerticalScrolling: true');
        expect(debugUi).not.toContain('slice(-8)');
        expect(debugUi).toContain('rt-map-evo-debug-compressed');
        expect(debugUi).toContain('DIGEST');
        expect(debugUi).toContain('rt-map-evo-debug-memory-bar');
        expect(debugUi).toContain('Closed-thread tokens');
        expect(debugUi).toContain('Stored evolution memory');
        expect(debugUi).toContain('data-debug="threads-json"');
        expect(debugUi).toContain('data-debug="backlog-json"');
        expect(debugUi).toContain('Causal threads as Evolution reads them');
        expect(debugUi).toContain('Asset arc');
        expect(debugUi).toContain('data-debug="arc-subject"');
        expect(debugUi).toContain('data-debug-arc');
        expect(debugUi).toContain('describeEvolutionAssetArc');
        expect(debugUi).toContain('rt-map-evo-debug-site');
        expect(debugUi).toContain('data-debug-action="clear-history"');
        expect(debugUi).toContain('Clear evolution history');
        expect(debugUi).toContain('data-debug-action="undo-pass"');
        expect(debugUi).toContain('Undo last pass');
        expect(debugUi).toContain('data-debug-action="redo-pass"');
        expect(debugUi).toContain('Redo last pass');
        expect(debugCss).toContain('.rt-map-evo-debug-pane');
        expect(debugCss).not.toContain('max-height: 32vh');
        expect(debugCss).toContain('.rt-map-evo-debug-compressed');
        expect(debugCss).toContain('.rt-map-evo-debug-memory-bar');
        expect(debugCss).toContain('.rt-map-evo-debug-memory-pre');
        expect(debugCss).toContain('.rt-map-evo-debug-arc');
        expect(debugCss).toContain('.rt-map-evo-debug-arc-list');
        expect(panelMarkup).toContain('id="rt-agent-map-evo-testing-ground"');
    });
});
