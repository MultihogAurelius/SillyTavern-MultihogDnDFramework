import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatDungeonMapForUpdater, resolveBuildingIntentPopulationTarget, resolveBuildingPopulationTarget } from '../dungeon-reality.js';
import { DEFAULT_MAP_UPDATER_SYSTEM_PROMPT } from '../map-updater-prompt.js';
import { DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT, selectMapUpdaterSystemPrompt } from '../map-updater-direct-prompt.js';
import { validateBuildingPopulationTransaction, validatePartyMemberRemovalTransaction } from '../map-updater-lib.js';
import {
    extractPartyMemberNames,
    formatPartyRosterForMapUpdater,
    isPartyMemberAssetName,
    partyNameFromHeader,
} from '../map-updater-lib.js';
import {
    BUILDING_POPULATION_MIN_LOOKBACK_TURNS,
    resolveMapUpdaterStoryWindow,
} from '../map-updater-lib.js';

function chatWithUserTurns(count) {
    const chat = [];
    for (let i = 0; i < count; i++) {
        chat.push({ is_user: true, mes: `Player turn ${i + 1}` });
        chat.push({ is_user: false, mes: `Narrator turn ${i + 1}` });
    }
    return chat;
}

describe('Map Updater', () => {
    it('requires an explicit first-entry BUILDING flag clear but permits an intentionally empty result', () => {
        const target = { building: { id: 'house', name: 'House' }, area: { id: 'north' }, children: [], untrackedName: '' };
        expect(validateBuildingPopulationTransaction({ noop: true }, target)[0]?.code).toBe('BUILDING_POPULATION_NOT_RESOLVED');
        expect(validateBuildingPopulationTransaction({
            operation_id: 'house-empty',
            operations: [{ op: 'SET_ASSET', asset_id: 'house', notEntered: false, cause: 'The empty house was entered.' }],
        }, target)).toEqual([]);
    });

    it('resolves a unique pending BUILDING from player intent before the footer enters it', () => {
        const map = {
            version: 3,
            site: 'Bullion',
            kind: 'SETTLEMENT',
            areas: [{ id: 'main-street', name: 'Main Street', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [
                { id: 'bullion-general-store', kind: 'BUILDING', name: 'Bullion General Store', location: 'main-street', state: 'ACTIVE', knowledge: 'KNOWN', notEntered: false },
                { id: 'chapel', kind: 'BUILDING', name: 'Chapel', location: 'main-street', state: 'ACTIVE', knowledge: 'KNOWN', notEntered: true },
            ],
        };
        const target = resolveBuildingIntentPopulationTarget(
            map,
            'Bullion, Main Street, Bullion General Store',
            'We should check out the chapel before daylight.',
        );
        expect(target).toMatchObject({ phase: 'intent', building: { id: 'chapel' }, area: { id: 'main-street' } });
        expect(resolveBuildingIntentPopulationTarget(map, 'Bullion, Main Street', 'Wait here.')).toBeNull();
    });

    it('keeps pre-narration contents hidden and forbids outcome chronicles', () => {
        const target = { phase: 'intent', building: { id: 'chapel' }, area: { id: 'main-street' }, children: [], untrackedName: '' };
        const invalid = validateBuildingPopulationTransaction({
            operations: [
                { op: 'ADD_ASSET', kind: 'CREATURE', name: 'Sleeper', location: 'chapel', knowledge: 'KNOWN' },
                { op: 'SET_ASSET', asset_id: 'chapel', notEntered: false },
            ],
            chronicles: [{ area_id: 'main-street', text: 'Entered the chapel.' }],
        }, target);
        expect(invalid.map(issue => issue.code)).toEqual(expect.arrayContaining([
            'PRE_NARRATION_ASSET_REVEALED',
            'PRE_NARRATION_CHRONICLE_NOT_ALLOWED',
        ]));
        expect(validateBuildingPopulationTransaction({
            operations: [
                { op: 'ADD_ASSET', kind: 'CREATURE', name: 'Sleeper', location: 'chapel', knowledge: 'UNREVEALED' },
                { op: 'SET_ASSET', asset_id: 'chapel', notEntered: false },
            ],
        }, target)).toEqual([]);
    });
    it('treats noop and empty operations as a skip', () => {
        const updater = readFileSync(new URL('../map-updater.js', import.meta.url), 'utf8');
        expect(updater).toContain('if (value.noop === true) return true');
        expect(updater).toContain('return Array.isArray(value.operations) && value.operations.length === 0');
    });

    it('uses a compact direct-command prompt without autonomous updater policy', () => {
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT.length)
            .toBeLessThan(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT.length / 3);
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).toContain('Apply the user\'s explicit instruction');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).toContain('Make only the minimum changes needed');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).toContain('Do not change anything the instruction did not ask to change');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).toContain('REMOVE_ASSET');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).toContain('detail is the lasting on-map description');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).toContain('Never ADD_ASSET with only a bare name');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).toContain('"detail":"A palm-sized leaded-glass seal');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).not.toContain('TIME MECHANICS');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).not.toContain('KIND: SETTLEMENT');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).not.toContain('BUILDING entry and Asset population');
        expect(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT).not.toContain('Streetscape observation');
        expect(selectMapUpdaterSystemPrompt('Remove the chair.', 'NORMAL')).toBe(DEFAULT_MAP_UPDATER_DIRECT_SYSTEM_PROMPT);
        expect(selectMapUpdaterSystemPrompt('   ', 'NORMAL')).toBe('NORMAL');
    });

    it('requires every PARTY-matching CREATURE to be removed while leaving residents and GROUPs alone', () => {
        const map = {
            assets: [
                { id: 'seraphina', kind: 'CREATURE', name: 'Seraphina Nightshade' },
                { id: 'kael', kind: 'CREATURE', name: 'Kael' },
                { id: 'resident', kind: 'CREATURE', name: 'Odran' },
                { id: 'kael-patrol', kind: 'GROUP', name: 'Kael Patrol' },
            ],
        };
        const memo = '[PARTY]\nSeraphina: 42/42 HP\nStatus: Healthy\nKael: 30/30 HP\nStatus: Healthy\n[/PARTY]';

        const noopIssues = validatePartyMemberRemovalTransaction({ noop: true }, map, memo);
        expect(noopIssues).toHaveLength(2);
        expect(noopIssues.every(issue => issue.code === 'PARTY_CREATURE_MUST_BE_REMOVED')).toBe(true);
        expect(noopIssues.map(issue => issue.hint).join('\n')).toContain('seraphina');
        expect(noopIssues.map(issue => issue.hint).join('\n')).toContain('kael');
        expect(noopIssues.map(issue => issue.hint).join('\n')).not.toContain('resident');
        expect(noopIssues.map(issue => issue.hint).join('\n')).not.toContain('kael-patrol');

        expect(validatePartyMemberRemovalTransaction({
            operations: [
                { op: 'REMOVE_ASSET', asset_id: 'seraphina' },
                { op: 'REMOVE_ASSET', asset_id: 'kael' },
            ],
        }, map, memo)).toEqual([]);
    });

    it('widens auto RECENT STORY to at least 10 user turns for first-entry BUILDING population', () => {
        expect(BUILDING_POPULATION_MIN_LOOKBACK_TURNS).toBe(10);
        const chat = chatWithUserTurns(12);
        // Watermark only covers the latest exchange (last 2 messages).
        const settings = { mapUpdaterLastRunChatLength: chat.length - 2, routerLookback: 4 };
        const auto = resolveMapUpdaterStoryWindow(chat, settings, { isManual: false });
        expect(auto).toEqual({ startIdx: chat.length - 2, sinceLastRun: true });

        const population = resolveMapUpdaterStoryWindow(chat, settings, {
            isManual: false,
            minLookbackTurns: BUILDING_POPULATION_MIN_LOOKBACK_TURNS,
        });
        // 10 user turns → start at the 3rd user message (index 4) in a 12-turn chat of pairs.
        expect(population.startIdx).toBe(4);
        expect(population.startIdx).toBeLessThan(auto.startIdx);

        const widerWatermark = resolveMapUpdaterStoryWindow(chat, {
            mapUpdaterLastRunChatLength: 0,
            routerLookback: 4,
        }, {
            isManual: false,
            minLookbackTurns: BUILDING_POPULATION_MIN_LOOKBACK_TURNS,
        });
        // No watermark: fall back to the forced 10-turn lookback.
        expect(widerWatermark.startIdx).toBe(4);
        expect(widerWatermark.sinceLastRun).toBe(false);
    });

    it('formats a compact ID snapshot without dumping every room geometry', () => {
        const snapshot = formatDungeonMapForUpdater({
            version: 3,
            site: 'Morrowfen',
            kind: 'SETTLEMENT',
            areas: [
                {
                    id: 'shrine-quarter',
                    name: 'Shrine Quarter',
                    knowledge: 'VISITED',
                    geometry: ['Narrow lanes of salt-stained stone.'],
                    connections: [{ to: 'docks', state: 'OPEN' }],
                },
                {
                    id: 'docks',
                    name: 'Docks',
                    knowledge: 'DISCOVERED',
                    geometry: ['A long hidden pier description that should not appear unless current.'],
                    connections: [{ to: 'shrine-quarter', state: 'OPEN' }],
                },
            ],
            assets: [
                {
                    id: 'odran',
                    kind: 'CREATURE',
                    name: 'Odran',
                    location: 'shrine-quarter',
                    state: 'ACTIVE',
                    knowledge: 'KNOWN',
                    detail: 'Tends the chapel.',
                },
            ],
        }, 'Morrowfen, Shrine Quarter');

        expect(snapshot).toContain('KIND: SETTLEMENT');
        expect(snapshot).toContain('shrine-quarter | Shrine Quarter | VISITED | docks:OPEN');
        expect(snapshot).toContain('odran | CREATURE | Odran | loc=shrine-quarter');
        expect(snapshot).toContain('Narrow lanes of salt-stained stone.');
        expect(snapshot).not.toContain('long hidden pier description');
    });

    it('flags a settlement building in CURRENT LOCATION that is not yet a BUILDING asset', () => {
        const snapshot = formatDungeonMapForUpdater({
            version: 3,
            site: 'Morrowfen',
            kind: 'SETTLEMENT',
            areas: [{
                id: 'shrine-quarter',
                name: 'Shrine Quarter',
                knowledge: 'VISITED',
                geometry: ['Narrow lanes of salt-stained stone.'],
                connections: [],
            }],
            assets: [],
        }, 'Morrowfen, Shrine Quarter, Chapel of the Drowned Stone');

        expect(snapshot).toContain('shrine-quarter (Shrine Quarter)');
        expect(snapshot).toContain('Narrow lanes of salt-stained stone.');
        expect(snapshot).toContain('SETTLEMENT BUILDING NOT ON MAP');
        expect(snapshot).toContain('ADD_ASSET kind BUILDING');
        expect(snapshot).toContain('CreateAreaMap owns promotion');
        expect(snapshot).toContain('Chapel of the Drowned Stone');
        expect(snapshot).toContain('Do not output {"noop":true} for this.');
        expect(snapshot).not.toContain('(Current location did not match an area id/name.)');
    });

    it('treats a known chapel OBJECT as occupancy of its host district', () => {
        const snapshot = formatDungeonMapForUpdater({
            version: 3,
            site: 'Morrowfen',
            kind: 'SETTLEMENT',
            areas: [{
                id: 'shrine-quarter',
                name: 'Shrine Quarter',
                knowledge: 'VISITED',
                geometry: ['Narrow lanes of salt-stained stone.'],
                connections: [],
            }],
            assets: [{
                id: 'chapel-of-the-drowned-stone',
                kind: 'OBJECT',
                name: 'Chapel of the Drowned Stone',
                location: 'shrine-quarter',
                state: 'PRESENT',
                knowledge: 'KNOWN',
            }],
        }, 'Morrowfen, Shrine Quarter, Chapel of the Drowned Stone');

        expect(snapshot).toContain('shrine-quarter (Shrine Quarter)');
        expect(snapshot).toContain('chapel-of-the-drowned-stone | OBJECT | Chapel of the Drowned Stone');
        expect(snapshot).not.toContain('SETTLEMENT BUILDING NOT ON MAP');
    });

    it('does not invent a BUILDING from an exterior-relative footer leaf behind an existing store', () => {
        const map = {
            version: 3,
            site: 'Hollow Creek',
            kind: 'SETTLEMENT',
            areas: [{
                id: 'main-street',
                name: 'Main Street',
                knowledge: 'VISITED',
                geometry: ['East Outskirts thoroughfare.'],
                connections: [],
            }],
            assets: [{
                id: 'hollow-creek-general-store',
                kind: 'BUILDING',
                name: 'Hollow Creek General Store',
                location: 'main-street',
                state: 'ACTIVE',
                knowledge: 'KNOWN',
                notEntered: true,
            }],
        };
        const footer = 'Hollow Creek, East Outskirts → Main Street, behind the general store';
        const snapshot = formatDungeonMapForUpdater(map, footer);

        expect(snapshot).toContain('main-street (Main Street)');
        expect(snapshot).toContain('hollow-creek-general-store | BUILDING | Hollow Creek General Store');
        expect(snapshot).not.toContain('SETTLEMENT BUILDING NOT ON MAP');
        expect(snapshot).not.toContain('behind the general store');
        expect(resolveBuildingPopulationTarget(map, footer)).toBeNull();
    });

    it('ships a focused occupancy prompt and independent scheduler wiring', () => {
        const updater = readFileSync(new URL('../map-updater.js', import.meta.url), 'utf8');
        const hooks = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
        const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('You do not narrate play');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('KIND: SETTLEMENT');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('ADD_ASSET kind BUILDING');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('OBJECT is props only');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('CreateAreaMap is the sole gateway creation and promotion signal');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('If CURRENT LOCATION names an untracked ordinary structure');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Positional footer tails');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('behind the general store');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('exterior-relative footer phrases');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Streetscape observation');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('newly observed landmarks');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('clearly observed UNREVEALED landmarks become KNOWN without clearing notEntered');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('BUILDING entry and Asset population');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Populate only map-worthy contents');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Do not ADD_ASSET ambient scenery');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('tipped chairs');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('New interior contents use ADD_ASSET');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('The narrator may make mistakes in the footer');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Bullion General Store');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('short footer names still match longer BUILDING assets');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('external combat tracker (not shown to you.)');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('gateways may exist on SETTLEMENT, DUNGEON, or INTERIOR maps');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('REMOVE vs DESTROYED vs LEFT (choose by lasting occupancy and identity)');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Default for kills and destroyed things');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('REMOVE_ASSET is additional, not a substitute for DESTROYED or LEFT');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('SET_ASSET state LEFT when a living CREATURE/GROUP departed');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).not.toContain('NPC left the site permanently');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('"op":"REMOVE_ASSET"');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('"area_id":"shrine-quarter"');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Never write {"type":"ADD_ASSET","asset":{...}}');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Never ADD_ASSET the player or anyone listed in the supplied [PARTY] names');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('If an existing CREATURE asset matches a supplied [PARTY] name, REMOVE_ASSET');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Never ADD_ASSET six identical ghouls');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('TIME MECHANICS');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('set duration to ""');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('stored timestamp plus authoritative current time is sufficient evidence');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('BUILDING is a lightweight container');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('knowledge SUSPECTED');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('A KNOWN or SUSPECTED asset reveals its effective containing area');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('notEntered:false');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('PRE-NARRATION BUILDING INTENT POPULATION');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Every newly generated child is UNREVEALED');
        expect(updater).toContain('Positional tails such as "behind the general store"');
        expect(updater).toContain('SET_ASSET knowledge KNOWN on each match without clearing notEntered');
        expect(updater).toContain('Footer leaves may shorten the asset name');
        expect(updater).toContain('On FIRST-ENTRY / INTENT BUILDING POPULATION, ADD_ASSET only map-worthy');
        expect(updater).toContain('ADD_ASSET only map-worthy CREATURE, GROUP, LOOT, HAZARD, TRAP, ALARM, BARRIER');
        expect(updater).toContain('never ambient set dressing');
        expect(updater).toContain('never SET_ASSET a brand-new invented asset_id');
        expect(updater).toContain('Exterior-relative phrasing');
        expect(updater).toContain('formatPartyRosterForMapUpdater');
        expect(updater).toContain('## CURRENT IN-WORLD TIME (AUTHORITATIVE)');
        expect(updater).toContain('initialUserPrompt(loaded, recentStory, memo, currentTime, populationTarget, instruction, promptOpts)');
        expect(updater).toContain("'FIRST-ENTRY BUILDING POPULATION'");
        expect(updater).toContain('(MANDATORY THIS PASS)');
        expect(updater).toContain('shouldForceBuildingPopulationPass');
        expect(updater).toContain('PARTY_MEMBER_NOT_AN_ASSET');
        expect(updater).toContain('SITE EXIT CLEANUP (MANDATORY REVIEW)');
        expect(updater).toContain('SET_ASSET state LEFT with cause');
        expect(updater).toContain("trigger === 'site_exit'");
        expect(updater).toContain('deferWatermark');
        expect(updater).toContain('mapRuntimeConnectionSource');
        expect(updater).not.toContain('mapArchitectConnectionSource');
        expect(updater).toContain('mapUpdaterMaxTokens');
        expect(updater).toContain('Number(settings.mapUpdaterMaxTokens) || 25000');
        const defaults = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');
        expect(defaults).toContain('mapUpdaterMaxTokens: 25000');
        expect(settingsMarkup).toMatch(/id="rpg_map_updater_max_tokens"[^>]*max="32000"/);
        expect(updater).toContain('siteRoot = null');
        expect(updater).toContain('loadDungeonMapContextForSite');
        expect(updater).toContain('DIRECT INSTRUCTION (THIS PASS ONLY)');
        expect(updater).toContain('selectMapUpdaterSystemPrompt');
        expect(updater).toContain("const directPass = !!instruction");
        expect(updater).toContain('directPass || inspectorPass');
        expect(updater).toContain('DIRECT INSTRUCTION (AUTHORITATIVE SCOPE)');
        expect(updater).toContain('Do not derive extra maintenance work from it');
        expect(updater).toMatch(/directPass\s*\?\s*\[\]/);
        expect(updater).toContain('formatLocationSection(loaded, { inspectorPass, exitPass, previousLocation })');
        expect(updater).toContain('export async function onMapUpdaterUserMessage(messageId)');
        expect(updater).toContain('resolveBuildingIntentPopulationTarget');
        expect(updater).toContain('if (settings.mapUpdaterEnabled === false && !isManual)');
        expect(updater).toContain('resolveMapUpdaterStoryWindow');
        expect(updater).toContain('BUILDING_POPULATION_MIN_LOOKBACK_TURNS');
        expect(updater).toContain('minLookbackTurns: populationTarget ? BUILDING_POPULATION_MIN_LOOKBACK_TURNS : null');
        expect(updater).toContain('RECENT STORY was widened for this population pass');
        const updaterLib = readFileSync(new URL('../map-updater-lib.js', import.meta.url), 'utf8');
        expect(updaterLib).toContain('export function resolveMapUpdaterStoryWindow');
        expect(updaterLib).toContain('export const BUILDING_POPULATION_MIN_LOOKBACK_TURNS = 10');
        expect(updaterLib).toContain('PARTY_CREATURE_MUST_BE_REMOVED');
        expect(hooks).toContain('runMapUpdaterPass');
        expect(hooks).toContain('mapUpdaterRunEvery');
        expect(hooks).toContain('maybeRollbackMapUpdaterForSwipe');
        expect(hooks).toContain('mapUpdaterLastSiteRoot');
        expect(hooks).toContain('mapUpdaterPendingExitRoot');
        expect(hooks).toContain("trigger: 'site_exit'");
        expect(hooks).toContain("exitResult?.skipped === 'busy'");
        expect(hooks).toContain("exitResult?.skipped === 'stopped'");
        expect(hooks).toContain('maybeRunMapEvolution');
        const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(index).toContain('event_types.MESSAGE_SENT, onMapUpdaterUserMessage');
        expect(index).toContain("s.mapUpdaterLastSiteRoot = p.mapUpdaterLastSiteRoot || ''");
        expect(index).toContain("s.mapUpdaterPendingExitRoot = p.mapUpdaterPendingExitRoot || ''");
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).not.toContain('EVOLVED');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).not.toContain('Map Evolution');
        expect(settingsMarkup).toContain('id="rpg_map_updater_run_every"');
        expect(settingsMarkup).toContain('id="rpg_map_updater_enabled"');
        expect(settingsMarkup).toContain('<b>Map Updater</b>');
    });

    it('summarizes occupancy ops compactly for the Lorebook Terminal', () => {
        const updater = readFileSync(new URL('../map-updater.js', import.meta.url), 'utf8');
        expect(updater).toContain('export function summarizeMapUpdaterOperations(transaction)');
        expect(updater).toContain("op === 'SET_CONNECTION'");
        expect(updater).toContain('kind ? ` (${kind})`');
        expect(updater).toContain("broadcastStep('result', summarizeMapUpdaterOperations(parsed.value) || 'Transaction accepted.')");
    });

    it('wires abort, terminal steps, and delayed busy so skip paths stay silent', () => {
        const updater = readFileSync(new URL('../map-updater.js', import.meta.url), 'utf8');
        expect(updater).toContain('export function stopMapUpdaterPass()');
        expect(updater).toContain('new AbortController()');
        expect(updater).toContain('sendStateRequest(requestSettings(settings), systemPrompt, prompt, signal)');
        expect(updater).toContain("source: 'map_updater'");
        expect(updater).toContain("broadcastStep('start', 'Initializing Map Updater...')");
        expect(updater).toContain("broadcastStep('thought', 'Requesting occupancy update...')");
        expect(updater).toContain('Correction pass ${attempt}');
        expect(updater).toContain("broadcastStep('error', 'Stopped by user.')");
        expect(updater).toContain("return { skipped: 'stopped' }");
        expect(updater).toContain("broadcastStep('finish', 'Already applied.')");
        expect(updater).toContain('Applied ${n} operation');
        expect(updater).not.toContain('checkAndTriggerAutoGenerations');
        const loadIdx = updater.indexOf('const loaded = await loadActiveDungeonMapContext()');
        const runningIdx = updater.indexOf('_mapUpdaterRunning = true');
        const startIdx = updater.indexOf("broadcastStep('start', 'Initializing Map Updater...')");
        expect(loadIdx).toBeGreaterThan(-1);
        expect(runningIdx).toBeGreaterThan(loadIdx);
        expect(startIdx).toBeGreaterThan(runningIdx);
        expect(updater.indexOf("skipped: 'no_active_map'")).toBeLessThan(startIdx);
        expect(updater.indexOf("skipped: 'disabled'")).toBeLessThan(startIdx);
        expect(updater.indexOf("skipped: 'location_mapping_off'")).toBeLessThan(startIdx);
        const loopRecheckIdx = updater.indexOf('if (!isLocationMappingEnabled(getSettings()))', startIdx);
        const sendIdx = updater.indexOf('sendStateRequest(requestSettings(settings), systemPrompt, prompt, signal)');
        expect(loopRecheckIdx).toBeGreaterThan(startIdx);
        expect(sendIdx).toBeGreaterThan(loopRecheckIdx);
    });

    it('strips [PARTY] to names only, splitting members on Status', () => {
        const memo = `[TIME]Day 1, 08:00[/TIME]
[PARTY]
- Seraphina (Forest Fey Warden/Healer): 42/42 HP
Combat: BAB: +3 | Ranged (1 attack): +6 | Melee (1 attack): +3 | Base AC: 13 | Total AC: 13
Gear: Thorn-Wrapped Staff (1d6 Bludgeoning) | Simple Sundress (no armor)
Status: Healthy
- Kael (Fighter): 30/30 HP
Combat: BAB: +4
Status: Healthy
[/PARTY]`;
        expect(extractPartyMemberNames(memo)).toEqual(['Seraphina', 'Kael']);
        expect(formatPartyRosterForMapUpdater(memo)).toBe('[PARTY]\n- Seraphina\n- Kael\n[/PARTY]');
        expect(partyNameFromHeader('- Seraphina')).toBe('Seraphina');
        expect(partyNameFromHeader('Elara (Ranger): 26/45 HP')).toBe('Elara');
        expect(isPartyMemberAssetName('Seraphina', ['Seraphina', 'Kael'])).toBe(true);
        expect(isPartyMemberAssetName('Seraphina Nightshade', ['Seraphina'])).toBe(true);
        expect(isPartyMemberAssetName('Odran', ['Seraphina'])).toBe(false);
    });
});
