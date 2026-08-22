import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatDungeonMapForUpdater, resolveBuildingPopulationTarget } from '../dungeon-reality.js';
import { DEFAULT_MAP_UPDATER_SYSTEM_PROMPT } from '../map-updater-prompt.js';
import { validateBuildingPopulationTransaction } from '../map-updater-lib.js';
import {
    extractPartyMemberNames,
    formatPartyRosterForMapUpdater,
    isPartyMemberAssetName,
    partyNameFromHeader,
} from '../map-updater-lib.js';

describe('Map Updater', () => {
    it('requires an explicit first-entry BUILDING flag clear but permits an intentionally empty result', () => {
        const target = { building: { id: 'house', name: 'House' }, area: { id: 'north' }, children: [], untrackedName: '' };
        expect(validateBuildingPopulationTransaction({ noop: true }, target)[0]?.code).toBe('BUILDING_POPULATION_NOT_RESOLVED');
        expect(validateBuildingPopulationTransaction({
            operation_id: 'house-empty',
            operations: [{ op: 'SET_ASSET', asset_id: 'house', notEntered: false, cause: 'The empty house was entered.' }],
        }, target)).toEqual([]);
    });
    it('treats noop and empty operations as a skip', () => {
        const updater = readFileSync(new URL('../map-updater.js', import.meta.url), 'utf8');
        expect(updater).toContain('if (value.noop === true) return true');
        expect(updater).toContain('return Array.isArray(value.operations) && value.operations.length === 0');
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
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('You do not write NPC biographies');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('KIND: SETTLEMENT');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('ADD_ASSET kind BUILDING');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('OBJECT is props only');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('CreateAreaMap is the sole promotion signal');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('If CURRENT LOCATION names an untracked ordinary structure');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Positional footer tails');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('behind the general store');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('exterior-relative footer phrases');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('"op":"ADD_ASSET"');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('"area_id":"shrine-quarter"');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Never write {"type":"ADD_ASSET","asset":{...}}');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Never ADD_ASSET the player or anyone listed in the supplied [PARTY] names');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('Never ADD_ASSET six identical ghouls');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('TIME MECHANICS');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('set duration to ""');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('stored timestamp plus authoritative current time is sufficient evidence');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('BUILDING is a lightweight container');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('knowledge SUSPECTED');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('A KNOWN or SUSPECTED asset reveals its effective containing area');
        expect(DEFAULT_MAP_UPDATER_SYSTEM_PROMPT).toContain('notEntered:false');
        expect(updater).toContain('Positional tails such as "behind the general store"');
        expect(updater).toContain('Exterior-relative phrasing');
        expect(updater).toContain('formatPartyRosterForMapUpdater');
        expect(updater).toContain('## CURRENT IN-WORLD TIME (AUTHORITATIVE)');
        expect(updater).toContain('initialUserPrompt(loaded, recentStory, memo, currentTime, populationTarget)');
        expect(updater).toContain('FIRST-ENTRY BUILDING POPULATION (MANDATORY THIS PASS)');
        expect(updater).toContain('shouldForceBuildingPopulationPass');
        expect(updater).toContain('PARTY_MEMBER_NOT_AN_ASSET');
        expect(updater).toContain('mapRuntimeConnectionSource');
        expect(updater).not.toContain('mapArchitectConnectionSource');
        expect(updater).toContain('mapUpdaterMaxTokens');
        expect(updater).toContain('Number(settings.mapUpdaterMaxTokens) || 25000');
        const defaults = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');
        expect(defaults).toContain('mapUpdaterMaxTokens: 25000');
        expect(settingsMarkup).toMatch(/id="rpg_map_updater_max_tokens"[^>]*max="32000"/);
        expect(updater).toContain('export async function runMapUpdaterPass({ isManual = false, lookback = null } = {})');
        expect(updater).toContain('if (settings.mapUpdaterEnabled === false && !isManual)');
        expect(updater).toContain('export function resolveMapUpdaterStoryWindow');
        expect(updater).toContain('if (isManual)');
        expect(updater).toContain('recentStoryContext(ctx, settings, { isManual, lookback })');
        expect(hooks).toContain('runMapUpdaterPass');
        expect(hooks).toContain('mapUpdaterRunEvery');
        expect(hooks).toContain('maybeRollbackMapUpdaterForSwipe');
        expect(hooks).toContain('maybeRunMapEvolution');
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
