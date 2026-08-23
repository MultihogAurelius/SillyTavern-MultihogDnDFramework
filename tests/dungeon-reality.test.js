import { describe, expect, it } from 'vitest';
import {
    applyDungeonMapTransaction,
    buildDungeonRealityInjection,
    buildMappedSitesInjection,
    listMappedSiteSummaries,
    buildDungeonMapCommitSchema,
    attachDungeonMapToLocationEntry,
    buildDungeonSitesFromLocationEntries,
    collectDungeonMapCandidates,
    dungeonLabelIdentitiesMatch,
    dungeonLabelsMatch,
    extractDungeonMapSection,
    extractFooterLocation,
    extractHiddenDungeonDeltaBlocks,
    extractHiddenDungeonMapBlocks,
    findLatestDungeonLocation,
    formatDungeonMapForNarrator,
    formatDungeonMapForPlayer,
    formatDungeonMapForUpdater,
    formatDungeonMapForEvolution,
    getSiteRootFromLocation,
    locationContainsSiteRoot,
    looksLikeDungeonSite,
    mapSiteMatchesLiveFooter,
    mapSiteFooterMismatchHint,
    migrateDungeonMapAttachmentToContent,
    migrateDungeonMapSectionToStructured,
    normalizeDungeonMapDocument,
    defaultMapSiteThreat,
    normalizeMapSiteThreat,
    MAP_SITE_KINDS,
    MAP_SITE_THREATS,
    MAP_ASSET_KINDS,
    parseDungeonMapDocument,
    parseEditableDungeonMapJson,
    serializeDungeonMapDocument,
    coerceAssetState,
    isPlayCanonLockedState,
    parseDungeonDeltaBlock,
    reconcileDungeonMapAreaKnowledge,
    reconcileAssetAreaKnowledge,
    resolveActiveDungeonSite,
    resolveCurrentMapPlacement,
    resolveAssetEffectiveArea,
    resolveBuildingPopulationTarget,
    settlementAbsorptionMatchesCurrentPeer,
    listContainedMapAssets,
    resolveMentionedDungeonSites,
    stripCapturedDungeonMapBlocks,
    stripDungeonRealityBlocksFromPrompt,
    stripDungeonMapSection,
    detachDungeonMapFromLocationEntry,
    syncDungeonRealityState,
    canonicalizeReciprocalConnectionDetails,
    validateDungeonMapArchitecture,
} from '../dungeon-reality.js';

const connectedArchitectMap = {
    version: 3,
    site: 'Abbey Undercroft',
    areas: [
        {
            id: 'cellar-landing',
            name: 'Cellar Landing',
            knowledge: 'VISITED',
            geometry: ['A low flagstone landing.'],
            connections: [{ to: 'crypt-passage', state: 'LOCKED', detail: 'Iron-banded door between the landing and passage.' }],
        },
        {
            id: 'crypt-passage',
            name: 'Crypt Passage',
            knowledge: 'UNREVEALED',
            geometry: ['A barrel-vaulted corridor.'],
            connections: [{ to: 'cellar-landing', state: 'LOCKED', detail: 'Iron-banded door between the landing and passage.' }],
        },
    ],
    assets: [{
        id: 'listening-ghoul',
        kind: 'CREATURE',
        name: 'Listening Ghoul',
        location: 'crypt-passage',
        state: 'ACTIVE',
        knowledge: 'UNREVEALED',
        detail: 'Waits behind a fallen arch.',
        origin: 'INITIAL_MAP',
    }],
};

function linearArchitectMap(site, kind, count, asset = null) {
    const areas = Array.from({ length: count }, (_, index) => ({
        id: `room-${index + 1}`,
        name: index === 0 ? 'Entrance' : `Room ${index + 1}`,
        knowledge: index === 0 ? 'VISITED' : 'UNREVEALED',
        geometry: [`Geometry fact ${index + 1}.`],
        connections: [],
    }));
    for (let index = 0; index < areas.length - 1; index++) {
        const detail = `Passage between room ${index + 1} and room ${index + 2}.`;
        areas[index].connections.push({ to: areas[index + 1].id, state: 'OPEN', detail });
        areas[index + 1].connections.push({ to: areas[index].id, state: 'OPEN', detail });
    }
    return {
        version: 3,
        site,
        kind,
        areas,
        assets: asset ? [{
            id: 'named-asset',
            name: 'Named Asset',
            location: 'room-1',
            state: 'ACTIVE',
            knowledge: 'KNOWN',
            detail: 'A durable fact.',
            origin: 'INITIAL_MAP',
            ...asset,
        }] : [],
    };
}

describe('Map Architect validation', () => {
    it('accepts a connected graph even when its entrance route is locked', () => {
        const result = validateDungeonMapArchitecture(connectedArchitectMap, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        });
        expect(result.valid).toBe(true);
        expect(result.document.areas).toHaveLength(2);
        expect(result.document.threat).toBe('HIGH');
    });

    it('creates explicit offsite child maps without claiming any area was visited', () => {
        const offsite = structuredClone(connectedArchitectMap);
        offsite.areas[0].knowledge = 'UNREVEALED';
        const accepted = validateDungeonMapArchitecture(offsite, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
            entranceKnowledge: 'UNREVEALED',
        });
        expect(accepted.valid).toBe(true);
        const leakedVisit = structuredClone(offsite);
        leakedVisit.areas[1].knowledge = 'VISITED';
        const rejected = validateDungeonMapArchitecture(leakedVisit, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
            entranceKnowledge: 'UNREVEALED',
        });
        expect(rejected.errors.some(error => error.code === 'OFFSITE_AREA_VISITED')).toBe(true);
    });

    it('requires initial known/suspected assets to respect the locked area knowledge', () => {
        const raw = {
            version: 3,
            site: 'Hollow Creek',
            kind: 'SETTLEMENT',
            areas: [
                { id: 'east-outskirts', name: 'East Outskirts', knowledge: 'VISITED', geometry: [], connections: [{ to: 'main-street', state: 'OPEN', detail: 'Two-lane road' }] },
                { id: 'main-street', name: 'Main Street', knowledge: 'UNREVEALED', geometry: [], connections: [{ to: 'east-outskirts', state: 'OPEN', detail: 'Two-lane road' }] },
            ],
            assets: [
                { id: 'general-store', kind: 'BUILDING', name: 'General Store', location: 'main-street', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' },
                { id: 'wanderers', kind: 'GROUP', name: 'Main Street Undead', location: 'general-store', state: 'ACTIVE', knowledge: 'SUSPECTED', detail: '', origin: 'INITIAL_MAP' },
            ],
        };

        const normalized = normalizeDungeonMapDocument(raw);
        expect(normalized.areas.find(area => area.id === 'main-street')?.knowledge).toBe('DISCOVERED');
        normalized.areas[1].knowledge = 'UNREVEALED';
        expect(reconcileAssetAreaKnowledge(normalized).areas[1].knowledge).toBe('DISCOVERED');

        const architectRaw = structuredClone(raw);
        architectRaw.assets[1].location = 'main-street';
        const architect = validateDungeonMapArchitecture(architectRaw, {
            site: 'Hollow Creek', entrance: 'East Outskirts', kind: 'SETTLEMENT',
        });
        expect(architect.valid).toBe(false);
        expect(architect.errors.some(error => error.code === 'ASSET_KNOWLEDGE_AREA_MISMATCH')).toBe(true);

        architectRaw.areas[1].knowledge = 'DISCOVERED';
        const correctedArchitect = validateDungeonMapArchitecture(architectRaw, {
            site: 'Hollow Creek', entrance: 'East Outskirts', kind: 'SETTLEMENT',
        });
        expect(correctedArchitect.valid).toBe(true);

        const updated = applyDungeonMapTransaction({ ...structuredClone(raw), assets: [] }, {
            operation_id: 'hollow-creek-store-spotted',
            operations: [{
                op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'General Store', kind: 'BUILDING',
                location: 'main-street', state: 'ACTIVE', knowledge: 'KNOWN', cause: 'Spotted from the outskirts.',
            }],
        });
        expect(updated.ok).toBe(true);
        expect(updated.document.areas.find(area => area.id === 'main-street')?.knowledge).toBe('DISCOVERED');
    });

    it('stamps requested threat onto a valid map and rejects a mismatched threat', () => {
        const stamped = validateDungeonMapArchitecture(connectedArchitectMap, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
            threat: 'LOW',
        });
        expect(stamped.valid).toBe(true);
        expect(stamped.document.threat).toBe('LOW');

        const mismatched = structuredClone(connectedArchitectMap);
        mismatched.threat = 'DEADLY';
        const rejected = validateDungeonMapArchitecture(mismatched, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
            threat: 'LOW',
        });
        expect(rejected.valid).toBe(false);
        expect(rejected.errors.some(error => error.code === 'THREAT_MISMATCH')).toBe(true);
    });

    it('keeps NONE distinct from LOW threat', () => {
        expect(MAP_SITE_THREATS).toEqual(['NONE', 'LOW', 'MODERATE', 'HIGH', 'DEADLY']);
        expect(normalizeMapSiteThreat('NONE')).toBe('NONE');
        expect(normalizeMapSiteThreat('safe')).toBe('NONE');
        expect(normalizeMapSiteThreat('peaceful')).toBe('NONE');
        expect(normalizeMapSiteThreat('LOW')).toBe('LOW');
        expect(normalizeMapSiteThreat('mild')).toBe('LOW');

        const none = structuredClone(connectedArchitectMap);
        none.threat = 'NONE';
        const result = validateDungeonMapArchitecture(none, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
            threat: 'NONE',
        });
        expect(result.valid).toBe(true);
        expect(result.document.threat).toBe('NONE');
    });

    it('supports INTERIOR/NONE contracts and uses dungeon room-scale bounds', () => {
        expect(MAP_SITE_KINDS).toEqual(['DUNGEON', 'SETTLEMENT', 'INTERIOR']);
        expect(MAP_ASSET_KINDS).toEqual(expect.arrayContaining(['OBJECT', 'BUILDING', 'SUBDUNGEON', 'SUBINTERIOR']));
        expect(defaultMapSiteThreat('DUNGEON')).toBe('HIGH');
        expect(defaultMapSiteThreat('SETTLEMENT')).toBe('MODERATE');
        expect(defaultMapSiteThreat('INTERIOR')).toBe('LOW');

        const tooSmall = validateDungeonMapArchitecture(linearArchitectMap('Guild Hall', 'INTERIOR', 6), {
            site: 'Guild Hall', entrance: 'Entrance', kind: 'INTERIOR', scale: 'MEDIUM', threat: 'LOW',
        });
        expect(tooSmall.valid).toBe(false);
        expect(tooSmall.errors.some(error => error.code === 'SCALE_AREA_COUNT')).toBe(true);

        const roomScale = validateDungeonMapArchitecture(linearArchitectMap('Guild Hall', 'INTERIOR', 7), {
            site: 'Guild Hall', entrance: 'Entrance', kind: 'INTERIOR', scale: 'MEDIUM', threat: 'NONE',
        });
        expect(roomScale.valid).toBe(true);
        expect(roomScale.document).toMatchObject({ kind: 'INTERIOR', threat: 'NONE' });
    });

    it('requires paired host fields and forbids hosted settlements', () => {
        const incomplete = { ...structuredClone(connectedArchitectMap), kind: 'INTERIOR', hostSite: 'Rustport' };
        const incompleteResult = validateDungeonMapArchitecture(incomplete, {
            site: 'Abbey Undercroft', entrance: 'Cellar Landing', kind: 'INTERIOR',
        });
        expect(incompleteResult.errors.some(error => error.code === 'INCOMPLETE_HOST')).toBe(true);

        const hostedSettlement = {
            ...structuredClone(connectedArchitectMap),
            kind: 'SETTLEMENT',
            hostSite: 'Greater Rustport',
            hostBrief: 'Contained in Greater Rustport.',
        };
        const settlementResult = validateDungeonMapArchitecture(hostedSettlement, {
            site: 'Abbey Undercroft', entrance: 'Cellar Landing', kind: 'SETTLEMENT',
        });
        expect(settlementResult.errors.some(error => error.code === 'HOSTED_SETTLEMENT')).toBe(true);
    });

    it('keeps BUILDING settlement-only and reserves room-map SUB* insertion for runtime attachment', () => {
        const rejected = validateDungeonMapArchitecture(
            linearArchitectMap('Guild Hall', 'INTERIOR', 2, { kind: 'BUILDING' }),
            { site: 'Guild Hall', entrance: 'Entrance', kind: 'INTERIOR' },
        );
        expect(rejected.errors.some(error => error.code === 'ASSET_KIND_NOT_ALLOWED')).toBe(true);
        for (const assetKind of ['SUBDUNGEON', 'SUBINTERIOR']) {
            const accepted = validateDungeonMapArchitecture(
                linearArchitectMap('Guild Hall', 'INTERIOR', 2, { kind: assetKind }),
                { site: 'Guild Hall', entrance: 'Entrance', kind: 'INTERIOR' },
            );
            expect(accepted.errors.some(error => error.code === 'ASSET_KIND_NOT_ALLOWED')).toBe(false);
            expect(accepted.errors.some(error => error.code === 'RUNTIME_OWNED_GATEWAY')).toBe(true);
        }
        const objectMap = validateDungeonMapArchitecture(
            linearArchitectMap('Guild Hall', 'INTERIOR', 2, { kind: 'OBJECT' }),
            { site: 'Guild Hall', entrance: 'Entrance', kind: 'INTERIOR' },
        );
        expect(objectMap.valid).toBe(true);

        const settlement = validateDungeonMapArchitecture(
            linearArchitectMap('Rustport', 'SETTLEMENT', 2, { kind: 'BUILDING' }),
            { site: 'Rustport', entrance: 'Entrance', kind: 'SETTLEMENT' },
        );
        expect(settlement.valid).toBe(true);
    });

    it('rejects active trap, hazard, and alarm assets at NONE threat', () => {
        const none = structuredClone(connectedArchitectMap);
        none.threat = 'NONE';
        none.assets.push({
            id: 'armed-snare',
            kind: 'TRAP',
            name: 'Armed Snare',
            location: 'cellar-landing',
            state: 'ARMED',
            knowledge: 'UNREVEALED',
            detail: 'A live snare.',
            origin: 'INITIAL_MAP',
        });
        const rejected = validateDungeonMapArchitecture(none, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
            threat: 'NONE',
        });
        expect(rejected.valid).toBe(false);
        expect(rejected.errors.some(error => error.code === 'NONE_THREAT_ACTIVE_DANGER')).toBe(true);

        none.assets.at(-1).state = 'DEACTIVATED';
        expect(validateDungeonMapArchitecture(none, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
            threat: 'NONE',
        }).valid).toBe(true);
    });

    it('copies the first-seen route detail onto a reciprocal pair so directional paraphrases do not fail the map', () => {
        const directional = structuredClone(connectedArchitectMap);
        directional.areas[0].connections[0].detail = 'A low, braced crawlway passes eastward through fractured masonry into the ossuary.';
        directional.areas[1].connections[0].detail = 'A low, braced crawlway passes westward through fractured masonry into the chamber.';
        expect(validateDungeonMapArchitecture(directional, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        }).valid).toBe(false);

        canonicalizeReciprocalConnectionDetails(directional.areas);
        const result = validateDungeonMapArchitecture(directional, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        });
        expect(result.valid).toBe(true);
        expect(directional.areas[0].connections[0].detail).toBe(directional.areas[1].connections[0].detail);
        expect(directional.areas[0].connections[0].detail).toContain('eastward');
    });

    it('mirrors a valid missing reverse passage before strict validation', () => {
        const oneWay = structuredClone(connectedArchitectMap);
        oneWay.areas[1].connections = [];
        expect(validateDungeonMapArchitecture(oneWay, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        }).errors.some(error => error.code === 'MISSING_RECIPROCAL_CONNECTION')).toBe(true);

        canonicalizeReciprocalConnectionDetails(oneWay.areas);

        expect(oneWay.areas[1].connections).toEqual([{
            to: 'cellar-landing',
            state: 'LOCKED',
            detail: 'Iron-banded door between the landing and passage.',
        }]);
        expect(validateDungeonMapArchitecture(oneWay, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        }).valid).toBe(true);
    });

    it('does not auto-resolve conflicting reciprocal states', () => {
        const conflicting = structuredClone(connectedArchitectMap);
        conflicting.areas[1].connections[0].state = 'OPEN';

        canonicalizeReciprocalConnectionDetails(conflicting.areas);

        expect(conflicting.areas[0].connections[0].state).toBe('LOCKED');
        expect(conflicting.areas[1].connections[0].state).toBe('OPEN');
        expect(validateDungeonMapArchitecture(conflicting, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        }).errors.some(error => error.code === 'CONNECTION_STATE_MISMATCH')).toBe(true);
    });

    it('rejects omitted reverse passages and orphaned areas with correction hints', () => {
        const broken = structuredClone(connectedArchitectMap);
        broken.areas[1].connections = [];
        const result = validateDungeonMapArchitecture(broken, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.map(error => error.code)).toEqual(expect.arrayContaining([
            'AREA_WITHOUT_CONNECTION',
            'MISSING_RECIPROCAL_CONNECTION',
        ]));
    });

    it('rejects unknown asset locations before persistence', () => {
        const broken = structuredClone(connectedArchitectMap);
        broken.assets[0].location = 'missing-room';
        const result = validateDungeonMapArchitecture(broken, { site: 'Abbey Undercroft', entrance: 'Cellar Landing' });
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.code === 'UNKNOWN_ASSET_LOCATION')).toBe(true);
    });

    it('treats a translated English site title as a miss against a live Russian footer', () => {
        const footer = 'Андермаунтина, шестой уровень, Кладовая запчастей';
        expect(locationContainsSiteRoot(footer, 'Undermountain Level 6 — The Grinding Halls')).toBe(false);
        expect(mapSiteMatchesLiveFooter('Undermountain Level 6 — The Grinding Halls', footer)).toBe(false);
        expect(locationContainsSiteRoot(footer, 'шестой уровень')).toBe(true);
        expect(locationContainsSiteRoot(footer, 'Кладовая запчастей')).toBe(true);
        expect(mapSiteMatchesLiveFooter('шестой уровень', footer)).toBe(true);
        expect(mapSiteMatchesLiveFooter('Ashgate Maintenance Tunnels', 'Kuzne, Ashgate Maintenance Tunnels, Junction Chamber Theta')).toBe(true);
        expect(mapSiteMatchesLiveFooter('Invented Title', '')).toBe(true);
        expect(mapSiteFooterMismatchHint('Undermountain Level 6 — The Grinding Halls', footer)).toContain('Never translate');
    });

    it('keeps structural suffix names distinct while tolerating same-word-count typos', () => {
        expect(dungeonLabelsMatch('Cellar Crypt', 'Cellar Crypt Dungeon')).toBe(true);
        expect(dungeonLabelIdentitiesMatch('Cellar Crypt', 'Cellar Crypt Dungeon')).toBe(false);
        expect(dungeonLabelIdentitiesMatch('Cellar Crypt Dungeon', 'Cellar Crypt Dungeom')).toBe(true);
        expect(locationContainsSiteRoot(
            'Malarkey Monument, Cellar Crypt, Cellar Crypt Dungeon',
            'Malarkey Monument :: Cellar Crypt :: Cellar Crypt Dungeon',
        )).toBe(true);
        expect(locationContainsSiteRoot('Malarkey Monument, Cellar Crypt', 'Cellar Crypt Dungeon')).toBe(false);
        const placement = resolveCurrentMapPlacement({
            version: 3,
            site: 'Malarkey Monument',
            kind: 'INTERIOR',
            areas: [{ id: 'cellar-crypt', name: 'Cellar Crypt', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{
                id: 'cellar-crypt-gateway',
                kind: 'SUBDUNGEON',
                name: 'Cellar Crypt',
                location: 'cellar-crypt',
                state: 'ACTIVE',
                knowledge: 'KNOWN',
                detail: '',
                origin: 'NARRATOR_ESTABLISHED',
            }],
        }, 'Malarkey Monument, Cellar Crypt, Cellar Crypt Dungeon');
        expect(placement.area?.name).toBe('Cellar Crypt');
        expect(placement.interiorAsset).toBeNull();
    });

    it('accepts real pack counts and rejects zero or one-member groups', () => {
        const withCount = structuredClone(connectedArchitectMap);
        withCount.assets[0].kind = 'GROUP';
        withCount.assets[0].name = 'Listening Ghoul Pack';
        withCount.assets[0].count = 4;
        const accepted = validateDungeonMapArchitecture(withCount, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        });
        expect(accepted.valid).toBe(true);
        expect(accepted.document.assets[0].count).toBe(4);

        const zero = structuredClone(withCount);
        zero.assets[0].count = 0;
        const rejected = validateDungeonMapArchitecture(zero, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        });
        expect(rejected.valid).toBe(false);
        expect(rejected.errors.some(error => error.code === 'INVALID_COUNT')).toBe(true);

        const singletonGroup = structuredClone(withCount);
        singletonGroup.assets[0].name = 'Company Cook';
        singletonGroup.assets[0].count = 1;
        const singletonRejected = validateDungeonMapArchitecture(singletonGroup, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        });
        expect(singletonRejected.valid).toBe(false);
        expect(singletonRejected.errors.some(error => error.code === 'GROUP_COUNT_TOO_SMALL')).toBe(true);
    });

    it('uses district-scale area counts for SETTLEMENT maps and stamps kind', () => {
        const names = ['Gate', 'Market', 'Docks', 'Temple Ward', 'Old Town', 'Keep'];
        const areas = names.map((name, index) => {
            const id = name.toLowerCase().replace(/\s+/g, '-');
            const other = names.filter((_, otherIndex) => otherIndex !== index).map(label => ({
                to: label.toLowerCase().replace(/\s+/g, '-'),
                state: 'OPEN',
                detail: 'Street',
            }));
            return {
                id,
                name,
                knowledge: index === 0 ? 'VISITED' : 'UNREVEALED',
                geometry: [`The ${name} district.`],
                connections: other.slice(0, 1),
            };
        });
        areas.forEach((area, index) => {
            const target = areas[(index + 1) % areas.length];
            area.connections = [{ to: target.id, state: 'OPEN', detail: 'Main road' }];
        });
        areas.forEach((area, index) => {
            const source = areas[(index + areas.length - 1) % areas.length];
            if (!area.connections.some(connection => connection.to === source.id)) {
                area.connections.push({ to: source.id, state: 'OPEN', detail: 'Main road' });
            }
        });
        const settlement = {
            version: 3,
            site: 'Riverford',
            kind: 'SETTLEMENT',
            areas,
            assets: [],
        };
        const result = validateDungeonMapArchitecture(settlement, {
            site: 'Riverford',
            entrance: 'Gate',
            scale: 'MEDIUM',
            kind: 'SETTLEMENT',
        });
        expect(result.valid).toBe(true);
        expect(result.document.kind).toBe('SETTLEMENT');
        expect(result.document.threat).toBe('MODERATE');
        expect(result.document.areas).toHaveLength(6);

        const tooSmall = structuredClone(settlement);
        tooSmall.areas = settlement.areas.slice(0, 4);
        tooSmall.areas.forEach((area) => {
            area.connections = area.connections.filter(connection => tooSmall.areas.some(candidate => candidate.id === connection.to));
        });
        expect(validateDungeonMapArchitecture(tooSmall, {
            site: 'Riverford',
            entrance: 'Gate',
            scale: 'MEDIUM',
            kind: 'SETTLEMENT',
        }).errors.some(error => error.code === 'SCALE_AREA_COUNT')).toBe(true);
    });

    it('tells the narrator that settlement maps are district-scale', () => {
        const injection = buildDungeonRealityInjection({
            siteRoot: 'Riverford',
            mapChunks: [JSON.stringify({
                version: 3,
                site: 'Riverford',
                kind: 'SETTLEMENT',
                areas: [
                    { id: 'gate', name: 'Gate', knowledge: 'VISITED', geometry: ['A timber palisade gate.'], connections: [{ to: 'market', state: 'OPEN', detail: 'Cobbled road' }] },
                    { id: 'market', name: 'Market', knowledge: 'DISCOVERED', geometry: ['Open stalls around a well.'], connections: [{ to: 'gate', state: 'OPEN', detail: 'Cobbled road' }] },
                ],
                assets: [],
            })],
            locationEntries: [],
            statusLog: [],
        }, 'Riverford, Gate');
        expect(injection).toContain('district-scale settlement canon');
        expect(injection).toContain('invent granular interiors');
        expect(injection).toContain('name it in the Location footer');
        expect(injection).toContain('Map kind: SETTLEMENT (district-scale)');
        expect(injection).not.toContain('room-scale interior canon');
    });

    it('renders INTERIOR as lower-risk room-scale canon rather than dungeon canon', () => {
        const injection = buildDungeonRealityInjection({
            siteRoot: 'Guild Headquarters',
            mapChunks: [JSON.stringify({
                version: 3,
                site: 'Guild Headquarters',
                kind: 'INTERIOR',
                threat: 'LOW',
                areas: [{ id: 'reception', name: 'Reception Hall', knowledge: 'VISITED', geometry: ['A broad public hall.'], connections: [] }],
                assets: [],
            })],
            locationEntries: [],
            statusLog: [],
        }, 'Guild Headquarters, Reception Hall');
        expect(injection).toContain('room-scale canon for a significant interior');
        expect(injection).toContain('Map kind: INTERIOR (room-scale significant interior)');
        expect(injection).toContain('Site threat is LOW');
        expect(injection).not.toContain('room-scale dungeon canon');
    });

    it('tells the narrator that site threat governs occupancy, not party level', () => {
        const injection = buildDungeonRealityInjection({
            siteRoot: 'Abbey Undercroft',
            mapChunks: [JSON.stringify({
                version: 3,
                site: 'Abbey Undercroft',
                kind: 'DUNGEON',
                threat: 'LOW',
                areas: [
                    { id: 'landing', name: 'Cellar Landing', knowledge: 'VISITED', geometry: ['A stone landing.'], connections: [{ to: 'crypt', state: 'OPEN', detail: 'A stair' }] },
                    { id: 'crypt', name: 'Crypt', knowledge: 'DISCOVERED', geometry: ['A dusty crypt.'], connections: [{ to: 'landing', state: 'OPEN', detail: 'A stair' }] },
                ],
                assets: [],
            })],
            locationEntries: [],
            statusLog: [],
        }, 'Abbey Undercroft, Cellar Landing');
        expect(injection).toContain('Site threat is LOW');
        expect(injection).toContain('not party level');
        expect(injection).toContain('Site threat: LOW');
    });

    it('tells the narrator not to invent danger for a NONE-threat map', () => {
        const none = structuredClone(connectedArchitectMap);
        none.threat = 'NONE';
        const rendered = formatDungeonMapForNarrator(none);
        expect(rendered).toContain('Site threat: NONE');
        expect(rendered).toContain('Do not invent active hostile occupancy, armed traps, dangerous hazards, or violent conflict');
    });
});

function assistant(mes, extra = {}) {
    return { is_user: false, is_system: false, mes, ...extra };
}

describe('Dungeon Reality persistence', () => {
    it('extracts hidden blocks and binds them to the footer site root', () => {
        const text = `<div hidden>
Dungeon Site: Crypt of Whispers
Area: Guard Post - East
Two guards watch the lower door.
</div>

The stair exhales cold air.

*(Status: 10/10) | (XP: 0/300) | (Location: Crypt of Whispers, Hall of Echoes)*`;

        expect(extractHiddenDungeonMapBlocks(text)).toHaveLength(1);
        expect(extractFooterLocation(text)).toBe('Crypt of Whispers, Hall of Echoes');
        expect(getSiteRootFromLocation(extractFooterLocation(text))).toBe('Crypt of Whispers');

        const result = syncDungeonRealityState(null, [assistant(text, { swipe_id: 2 })]);
        expect(result.changed).toBe(true);
        expect(result.capturedChunks).toBe(1);
        expect(result.errors).toEqual([]);
        expect(result.state.sites['crypt of whispers']).toMatchObject({
            siteRoot: 'Crypt of Whispers',
            capturedAt: {
                messageIndex: 0,
                swipeId: 2,
                footerSnapshot: 'Crypt of Whispers, Hall of Echoes',
            },
            statusLog: [],
        });
    });

    it('accepts malformed model closing tags and stores a hidden root [MAP] section', () => {
        const text = `<div hidden data-dungeon-map>
Dungeon Site: Varnholde Crypts
Area: Main Chamber
A desecrated altar.
</div hidden>
*(Location: Varnholde Crypts, Main Chamber)*`;
        const collected = collectDungeonMapCandidates([assistant(text)]);
        expect(collected.errors).toEqual([]);
        expect(collected.maps).toHaveLength(1);
        expect(collected.maps[0].siteRoot).toBe('Varnholde Crypts');

        const root = { comment: 'Varnholde Crypts', content: '[CORE]A crypt.[/CORE]' };
        expect(attachDungeonMapToLocationEntry(root, collected.maps[0])).toBe(true);
        expect(attachDungeonMapToLocationEntry(root, { ...collected.maps[0], content: 'replacement' })).toBe(false);
        const stored = parseDungeonMapDocument(extractDungeonMapSection(root.content)).document;
        expect(stored).toMatchObject({
            version: 3,
            site: 'Varnholde Crypts',
            areas: [{ id: 'main-chamber', name: 'Main Chamber' }],
        });
        expect(stored.areas[0].geometry).toContain('A desecrated altar.');
        expect(stripDungeonMapSection(root.content)).toBe('[CORE]A crypt.[/CORE]');
        expect(root.extensions?.multihogDungeonMap).toBeUndefined();
        expect(detachDungeonMapFromLocationEntry(root)).toBe(true);
        expect(extractDungeonMapSection(root.content)).toBe('');
        expect(root.content).toBe('[CORE]A crypt.[/CORE]');
        expect(detachDungeonMapFromLocationEntry(root)).toBe(false);
    });

    it('migrates the earlier private-extension attachment into normal lore content', () => {
        const root = {
            comment: 'Varnholde Crypts',
            content: '[CORE]A crypt.[/CORE]',
            extensions: {
                multihogDungeonMap: {
                    siteRoot: 'Varnholde Crypts',
                    content: 'Dungeon Site: Varnholde Crypts\nArea: Reliquary\nA pale shade waits.',
                },
            },
        };
        expect(migrateDungeonMapAttachmentToContent(root)).toBe(true);
        expect(extractDungeonMapSection(root.content)).toContain('A pale shade waits.');
        expect(root.extensions.multihogDungeonMap).toBeUndefined();
    });

    it('migrates prose maps into structured geometry and movable assets without losing facts', () => {
        const root = {
            comment: 'Abbey Undercroft',
            content: `[CORE]A mapped site.[/CORE]\n\n[MAP]\nDungeon Site: Abbey Undercroft

Area: Crypt Passage - East
- 10-foot-wide corridor with a collapsed arch.
- One ghoul crouches behind the collapsed arch.
- North wall: rotten tapestry conceals Ossuary Behind Rotten Tapestry.

Area: Ossuary Behind Rotten Tapestry
- Three ossuary boxes rest on a stone shelf.
[/MAP]`,
        };
        expect(migrateDungeonMapSectionToStructured(root)).toBe(true);
        const map = parseDungeonMapDocument(extractDungeonMapSection(root.content)).document;
        expect(map.version).toBe(3);
        expect(map.areas.map(area => area.id)).toEqual(['crypt-passage-east', 'ossuary-behind-rotten-tapestry']);
        expect(map.areas[0].geometry).toContain('10-foot-wide corridor with a collapsed arch.');
        expect(map.areas[0].connections).toContainEqual({ to: 'ossuary-behind-rotten-tapestry', state: 'OPEN', detail: '' });
        expect(map.assets).toContainEqual(expect.objectContaining({
            id: 'ghoul',
            kind: 'CREATURE',
            location: 'crypt-passage-east',
            state: 'ACTIVE',
        }));
    });

    it('renders structured maps as compact prose with visible assets and deduplicated routes', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [
                { id: 'landing', name: 'Cellar Landing', knowledge: 'VISITED', geometry: ['Low oak beams cross the ceiling.'], connections: [{ to: 'crypt', state: 'OPEN', detail: 'Iron-banded door' }] },
                { id: 'crypt', name: 'Crypt Passage', knowledge: 'DISCOVERED', geometry: ['A collapsed arch provides cover.'], connections: [{ to: 'landing', state: 'OPEN', detail: 'Iron-banded door' }] },
            ],
            assets: [
                { id: 'ghoul', kind: 'CREATURE', name: 'Crypt Ghoul', location: 'crypt', state: 'DESTROYED', knowledge: 'KNOWN', detail: 'Smoldering remains beneath the arch.', origin: 'INITIAL_MAP' },
                { id: 'crawling-dead-pack', kind: 'GROUP', name: 'Crawling Dead Pack', location: 'crypt', state: 'ACTIVE', knowledge: 'KNOWN', detail: 'A knot of lesser corpses.', origin: 'INITIAL_MAP', count: 6 },
            ],
        };
        const raw = JSON.stringify(map, null, 2);
        const readable = formatDungeonMapForNarrator(map);
        expect(readable).toContain('Area: Cellar Landing [VISITED]');
        expect(readable).toContain('Cellar Landing <-> Crypt Passage [OPEN] — Iron-banded door');
        expect(readable.match(/Cellar Landing <-> Crypt Passage/g)).toHaveLength(1);
        expect(readable).toContain('Crypt Ghoul [CREATURE / DESTROYED / KNOWN] — Smoldering remains beneath the arch.');
        expect(readable).toContain('Crawling Dead Pack ×6 [GROUP / ACTIVE / KNOWN]');
        expect(readable).toContain('Count: 6');
        expect(readable).not.toContain('"version"');
        expect(readable.length).toBeLessThan(raw.length * 0.7);
    });

    it('renders a player-facing map that hides unrevealed rooms and assets', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            kind: 'DUNGEON',
            threat: 'DEADLY',
            areas: [
                { id: 'landing', name: 'Cellar Landing', knowledge: 'VISITED', geometry: ['Low oak beams cross the ceiling.'], connections: [{ to: 'crypt', state: 'OPEN', detail: 'Iron-banded door' }, { to: 'vault', state: 'LOCKED', detail: 'Sealed glyph door' }] },
                { id: 'crypt', name: 'Crypt Passage', knowledge: 'DISCOVERED', geometry: ['A collapsed arch provides cover.'], connections: [{ to: 'landing', state: 'OPEN', detail: 'Iron-banded door' }] },
                { id: 'vault', name: 'Secret Vault', knowledge: 'UNREVEALED', geometry: ['Gold-lined shelves.'], connections: [{ to: 'landing', state: 'LOCKED', detail: 'Sealed glyph door' }] },
            ],
            assets: [
                { id: 'lantern', kind: 'OBJECT', name: 'Sooty Lantern', location: 'landing', state: 'ACTIVE', knowledge: 'KNOWN', detail: 'Hangs by the door.', origin: 'INITIAL_MAP' },
                { id: 'ghoul', kind: 'CREATURE', name: 'Crypt Ghoul', location: 'crypt', state: 'DESTROYED', knowledge: 'KNOWN', detail: 'Smoldering remains.', origin: 'INITIAL_MAP' },
                { id: 'trap', kind: 'TRAP', name: 'Glyph Lock', location: 'vault', state: 'ACTIVE', knowledge: 'UNREVEALED', detail: 'Explodes on touch.', origin: 'INITIAL_MAP' },
            ],
        };
        const readable = formatDungeonMapForPlayer(map, 'Abbey Undercroft, Cellar Landing');
        expect(readable).toContain('You are here: Cellar Landing');
        expect(readable).toContain('Area: Cellar Landing [VISITED] (you are here)');
        expect(readable).toContain('Sooty Lantern');
        expect(readable).toContain('Area: Crypt Passage [DISCOVERED]');
        expect(readable).toContain('- Seen from outside; interior not yet revealed.');
        expect(readable).toContain('-> Unexplored [LOCKED]');
        expect(readable).not.toContain('Crypt Ghoul');
        expect(readable).not.toContain('Secret Vault');
        expect(readable).not.toContain('Glyph Lock');
        expect(readable).not.toContain('Gold-lined shelves');
        expect(readable).not.toContain('Explodes on touch');
        expect(readable).not.toContain('Smoldering remains');
        expect(readable).not.toContain('A collapsed arch provides cover');
        expect(readable).not.toContain('Site threat');
        expect(readable).not.toContain('DEADLY');
    });

    it('uses explicit child chronicles once when establishing current state from a legacy map', () => {
        const root = {
            comment: 'Abbey Undercroft',
            content: '[CORE]A mapped site.[/CORE]\n[MAP]\nDungeon Site: Abbey Undercroft\nArea: Crypt Passage - East\n- One ghoul crouches behind the arch.\n[/MAP]',
        };
        const entries = {
            0: root,
            1: {
                comment: 'Abbey Undercroft :: Crypt Passage - East',
                content: '[CORE]A stone corridor.[/CORE]\n[Day 1, 08:33 AM] The ghoul was destroyed by a point-blank Guiding Bolt.',
            },
        };
        expect(reconcileDungeonMapAreaKnowledge(root, entries)).toBe(true);
        const map = parseDungeonMapDocument(extractDungeonMapSection(root.content)).document;
        expect(map.areas[0].knowledge).toBe('VISITED');
        expect(map.assets[0]).toMatchObject({ state: 'DESTROYED', knowledge: 'KNOWN' });
        expect(map.assets[0].detail).toContain('destroyed by a point-blank Guiding Bolt');

        // Once structured, historical inference does not overwrite newer map truth.
        map.assets[0].state = 'ACTIVE';
        root.content = root.content.replace(/\[MAP\][\s\S]*?\[\/MAP\]/, `[MAP]\n${JSON.stringify(map)}\n[/MAP]`);
        expect(reconcileDungeonMapAreaKnowledge(root, entries)).toBe(false);
        expect(parseDungeonMapDocument(extractDungeonMapSection(root.content)).document.assets[0].state).toBe('ACTIVE');
    });

    it('applies validated asset movement/current-state updates and resolves chronicles', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [
                { id: 'crypt-passage', name: 'Crypt Passage', knowledge: 'VISITED', geometry: [], connections: [{ to: 'cellar', state: 'OPEN', detail: '' }] },
                { id: 'cellar', name: 'Cellar Landing', knowledge: 'VISITED', geometry: [], connections: [{ to: 'crypt-passage', state: 'OPEN', detail: '' }] },
            ],
            assets: [
                { id: 'crypt-ghoul', kind: 'CREATURE', name: 'Crypt Ghoul', location: 'crypt-passage', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP', behavior: 'On alarm, move toward the cellar.' },
            ],
        };
        const moved = applyDungeonMapTransaction(map, {
            operation_id: 'day1-0832-ghoul-moves',
            operations: [{ op: 'MOVE_ASSET', evidence: 'AUTONOMOUS', asset_id: 'crypt-ghoul', from: 'crypt-passage', to: 'cellar', state: 'ALERT', cause: 'Moved toward the cellar on alarm.' }],
            chronicles: [],
        });
        expect(moved.ok).toBe(true);
        expect(moved.document.assets[0]).toMatchObject({ location: 'cellar', state: 'ALERT' });
        expect(map.assets[0].location).toBe('crypt-passage');

        const destroyed = applyDungeonMapTransaction(moved.document, {
            operation_id: 'day1-0833-ghoul-destroyed',
            operations: [{ op: 'SET_ASSET', evidence: 'CONFIRMED', asset_id: 'crypt-ghoul', state: 'DESTROYED', knowledge: 'KNOWN', detail: 'Smoldering remains on the landing.', cause: 'Killed by the party on the landing.', actor: 'party' }],
            chronicles: [{ area_id: 'cellar', text: 'The crypt ghoul was destroyed.' }],
        });
        expect(destroyed.ok).toBe(true);
        expect(destroyed.document.assets[0].state).toBe('DESTROYED');
        expect(destroyed.document.assets[0]).toMatchObject({
            actor: 'party',
            cause: 'Killed by the party on the landing.',
        });
        expect(destroyed.document.areas.find(area => area.id === 'cellar').knowledge).toBe('VISITED');
        expect(destroyed.chronicles).toEqual([{ areaId: 'cellar', areaName: 'Cellar Landing', text: 'The crypt ghoul was destroyed.' }]);
    });

    it('marks a chronicled area visited in the pure transaction result', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [{ id: 'cellar', name: 'Cellar Landing', knowledge: 'UNREVEALED', geometry: [], connections: [] }],
            assets: [],
        };
        const applied = applyDungeonMapTransaction(map, {
            operation_id: 'day1-0813-enter-cellar',
            operations: [{ op: 'SET_AREA', evidence: 'CONFIRMED', area_id: 'cellar', geometry_append: ['Loose stones were braced.'], cause: 'The party braced the loose stones.' }],
            chronicles: [{ area_id: 'cellar', text: 'The party entered the cellar and braced its loose stones.' }],
        });
        expect(applied.ok).toBe(true);
        expect(applied.document.areas[0].knowledge).toBe('VISITED');
        expect(map.areas[0].knowledge).toBe('UNREVEALED');
    });

    it('rejects settlement-only asset kinds in map transactions outside a settlement', () => {
        const map = {
            version: 3,
            site: 'Guild Hall',
            kind: 'INTERIOR',
            threat: 'LOW',
            areas: [{ id: 'foyer', name: 'Foyer', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [],
        };
        const result = applyDungeonMapTransaction(map, {
            operation_id: 'day1-0814-invalid-building',
            operations: [{
                op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Inner Shop', kind: 'BUILDING',
                location: 'foyer', state: 'ACTIVE', knowledge: 'KNOWN', cause: 'The shop was established in play.',
            }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some(error => error.code === 'ASSET_KIND_NOT_ALLOWED')).toBe(true);
        expect(map.assets).toEqual([]);

        const settlement = { ...map, site: 'Rustport', kind: 'SETTLEMENT' };
        const oldAliasWrite = applyDungeonMapTransaction(settlement, {
            operation_id: 'day1-0815-old-interior-alias',
            operations: [{
                op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Old Alias Shop', kind: 'INTERIOR',
                location: 'foyer', state: 'ACTIVE', knowledge: 'KNOWN', cause: 'Established in play.',
            }],
        });
        expect(oldAliasWrite.ok).toBe(false);
        expect(oldAliasWrite.errors.some(error => error.code === 'INVALID_ENUM')).toBe(true);
    });

    it('reserves SUB* gateway creation and structural edits for CreateAreaMap', () => {
        const map = {
            version: 3,
            site: 'Malarkey Monument',
            kind: 'INTERIOR',
            areas: [{ id: 'cellar-crypt', name: 'Cellar Crypt', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{
                id: 'crypt-dungeon', kind: 'SUBDUNGEON', name: 'Cellar Crypt Dungeon', location: 'cellar-crypt',
                state: 'ACTIVE', knowledge: 'UNREVEALED', detail: 'A hosted peer gateway.', origin: 'NARRATOR_ESTABLISHED',
            }],
        };
        const added = applyDungeonMapTransaction(map, {
            operation_id: 'day1-invalid-sub-add',
            operations: [{
                op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Lower Vault', kind: 'SUBDUNGEON',
                location: 'cellar-crypt', state: 'ACTIVE', knowledge: 'UNREVEALED', cause: 'A new nested map was proposed.',
            }],
        });
        expect(added.errors.some(error => error.code === 'RUNTIME_OWNED_GATEWAY')).toBe(true);
        const moved = applyDungeonMapTransaction(map, {
            operation_id: 'day1-invalid-sub-move',
            operations: [{ op: 'MOVE_ASSET', evidence: 'CONFIRMED', asset_id: 'crypt-dungeon', to: 'cellar-crypt', cause: 'Attempted gateway move.' }],
        });
        expect(moved.errors.some(error => error.code === 'RUNTIME_OWNED_GATEWAY')).toBe(true);
        const revealed = applyDungeonMapTransaction(map, {
            operation_id: 'day1-sub-revealed',
            operations: [{ op: 'SET_ASSET', evidence: 'CONFIRMED', asset_id: 'crypt-dungeon', knowledge: 'KNOWN', detail: 'The entrance is now known.', cause: 'The party discovered the entrance.' }],
        });
        expect(revealed.ok).toBe(true);
        expect(revealed.document.assets[0].knowledge).toBe('KNOWN');
    });

    it('requires blocked geometry to be changed before an asset traverses it', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [
                { id: 'vault', name: 'Vault', knowledge: 'VISITED', geometry: [], connections: [{ to: 'sanctum', state: 'LOCKED', detail: 'Iron gate' }] },
                { id: 'sanctum', name: 'Sanctum', knowledge: 'UNREVEALED', geometry: [], connections: [{ to: 'vault', state: 'LOCKED', detail: 'Iron gate' }] },
            ],
            assets: [{ id: 'wight', kind: 'CREATURE', name: 'Wight', location: 'sanctum', state: 'ACTIVE', knowledge: 'UNREVEALED', detail: '', origin: 'INITIAL_MAP' }],
        };
        const blocked = applyDungeonMapTransaction(map, {
            operation_id: 'day1-0900-invalid-gate-move',
            operations: [{ op: 'MOVE_ASSET', evidence: 'CONFIRMED', asset_id: 'wight', to: 'vault' }],
        });
        expect(blocked.ok).toBe(false);
        expect(blocked.errors[0].code).toBe('CONNECTION_NOT_TRAVERSABLE');

        const openedThenMoved = applyDungeonMapTransaction(map, {
            operation_id: 'day1-0900-open-gate-move',
            operations: [
                { op: 'SET_CONNECTION', evidence: 'CONFIRMED', from: 'sanctum', to: 'vault', state: 'OPEN', cause: 'The iron gate was forced open.' },
                { op: 'MOVE_ASSET', evidence: 'CONFIRMED', asset_id: 'wight', to: 'vault', cause: 'The wight crossed the opened gate.' },
            ],
        });
        expect(openedThenMoved.ok).toBe(true);
        expect(openedThenMoved.document.assets[0].location).toBe('vault');
    });

    it('rejects semantic map errors with precise retry guidance and no partial mutation', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [{ id: 'crypt-passage', name: 'Crypt Passage', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{ id: 'crypt-ghoul', kind: 'CREATURE', name: 'Crypt Ghoul', location: 'crypt-passage', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' }],
        };
        const failed = applyDungeonMapTransaction(map, {
            operation_id: 'day1-0834-bad-move',
            operations: [{ op: 'MOVE_ASSET', evidence: 'CONFIRMED', asset_id: 'crypt-ghoul', from: 'wrong-room', to: 'missing-room' }],
        });
        expect(failed.ok).toBe(false);
        expect(failed.retryable).toBe(true);
        expect(failed.errors.map(error => error.code)).toContain('AREA_NOT_FOUND');
        expect(map.assets[0].location).toBe('crypt-passage');

        const autonomous = applyDungeonMapTransaction(map, {
            operation_id: 'day1-0834-unprompted-alert',
            operations: [{ op: 'SET_ASSET', evidence: 'AUTONOMOUS', asset_id: 'crypt-ghoul', state: 'ALERT' }],
        });
        expect(autonomous.ok).toBe(false);
        expect(autonomous.errors[0]).toMatchObject({ code: 'AUTONOMY_NOT_ALLOWED' });
    });

    it('rejects likely duplicate new enemies unless distinctness is explicit', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [{ id: 'crypt', name: 'Crypt', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{ id: 'crypt-ghoul', kind: 'CREATURE', name: 'Crypt Ghoul', location: 'crypt', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' }],
        };
        const duplicate = applyDungeonMapTransaction(map, {
            operation_id: 'day1-0835-ghoul',
            operations: [{ op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Crypt Ghoul', kind: 'CREATURE', location: 'crypt', state: 'ACTIVE', knowledge: 'KNOWN' }],
        });
        expect(duplicate.ok).toBe(false);
        expect(duplicate.errors[0]).toMatchObject({ code: 'POSSIBLE_DUPLICATE_ASSET' });
        expect(duplicate.errors[0].candidates[0].id).toBe('crypt-ghoul');
    });

    it('creates stable IDs for narrator-resolved temporary assets', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [{ id: 'crypt', name: 'Crypt', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [],
        };
        const added = applyDungeonMapTransaction(map, {
            operation_id: 'day1-0840-summoned-spirit',
            operations: [{
                op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Summoned Spirit', kind: 'CREATURE',
                location: 'crypt', state: 'ACTIVE', knowledge: 'KNOWN', origin: 'PLAYER_RESOLVED',
                owner: 'Silvan Starweaver', duration: '10 minutes',
                cause: 'Summoned by Silvan Starweaver.',
            }],
        });
        expect(added.ok).toBe(true);
        expect(added.createdAssets).toEqual([{ id: 'summoned-spirit', name: 'Summoned Spirit' }]);
        expect(added.document.assets[0]).toMatchObject({
            id: 'summoned-spirit', owner: 'Silvan Starweaver', duration: '10 minutes', origin: 'PLAYER_RESOLVED',
        });
    });

    it('clears a processed absolute asset boundary without retaining an empty duration', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [{ id: 'crypt', name: 'Crypt', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{
                id: 'delayed-alarm', kind: 'ALARM', name: 'Delayed Alarm', location: 'crypt',
                state: 'ARMED', knowledge: 'KNOWN', detail: 'Rings when its delay elapses.',
                duration: 'Until Day 2, 4:40 AM', origin: 'INITIAL_MAP',
            }],
        };
        const applied = applyDungeonMapTransaction(map, {
            operation_id: 'day2-0440-delayed-alarm',
            operations: [{
                op: 'SET_ASSET', evidence: 'CONFIRMED', asset_id: 'delayed-alarm',
                state: 'TRIGGERED', duration: '', detail: 'The alarm is ringing.',
                cause: 'Its stored Day 2, 4:40 AM boundary was reached.',
            }],
        }, { currentTime: 'Day 2, 4:40 AM' });
        expect(applied.ok).toBe(true);
        expect(applied.document.assets[0]).toMatchObject({ state: 'TRIGGERED', detail: 'The alarm is ringing.' });
        expect(applied.document.assets[0]).not.toHaveProperty('duration');
    });

    it('defaults omitted map evidence to CONFIRMED and coerces NPC kind to CREATURE', () => {
        const map = {
            version: 3,
            site: 'Morrowfen',
            kind: 'SETTLEMENT',
            areas: [{ id: 'shrine-quarter', name: 'Shrine Quarter', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{ id: 'shrine-ossuary-keepers', kind: 'GROUP', name: 'Keepers of the Drowned Stone', location: 'shrine-quarter', state: 'ACTIVE', knowledge: 'UNREVEALED', detail: '', origin: 'INITIAL_MAP' }],
        };
        const added = applyDungeonMapTransaction(map, {
            operation_id: 'morrowfen-shrine-chapel-entry',
            operations: [
                {
                    op: 'ADD_ASSET', name: 'Chapel of the Drowned Stone', kind: 'OBJECT',
                    location: 'shrine-quarter', state: 'ACTIVE', knowledge: 'KNOWN',
                    detail: 'Dry stone chapel with reed mats.',
                    cause: 'The party entered this chapel.',
                },
                {
                    op: 'ADD_ASSET', name: 'Odran', kind: 'NPC',
                    location: 'shrine-quarter', state: 'ACTIVE', knowledge: 'KNOWN',
                    detail: 'Elderly gray-hooded priest in the chapel.',
                    distinct_from: [],
                    cause: 'Encountered tending the chapel.',
                },
            ],
            chronicles: [{ area_id: 'shrine-quarter', text: 'Entered the Chapel of the Drowned Stone.' }],
        });
        expect(added.ok).toBe(true);
        expect(added.createdAssets).toEqual([
            { id: 'chapel-of-the-drowned-stone', name: 'Chapel of the Drowned Stone' },
            { id: 'odran', name: 'Odran' },
        ]);
        expect(added.document.assets.find(asset => asset.id === 'chapel-of-the-drowned-stone')).toMatchObject({
            kind: 'OBJECT', knowledge: 'KNOWN', origin: 'NARRATOR_ESTABLISHED',
        });
        expect(added.document.assets.find(asset => asset.id === 'odran')).toMatchObject({
            kind: 'CREATURE', knowledge: 'KNOWN', origin: 'NARRATOR_ESTABLISHED',
        });
    });

    it('accepts type/asset-wrapped ADD_ASSET operations', () => {
        const map = {
            version: 3,
            site: 'Morrowfen',
            areas: [{ id: 'shrine-quarter', name: 'Shrine Quarter', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [],
        };
        const applied = applyDungeonMapTransaction(map, {
            operation_id: 'day1-1557-chapel-drowned-stone',
            operations: [
                {
                    type: 'ADD_ASSET',
                    asset: {
                        kind: 'OBJECT',
                        name: 'Chapel of the Drowned Stone',
                        location: 'shrine-quarter',
                        state: 'ACTIVE',
                        knowledge: 'KNOWN',
                        detail: 'Narrow stone sanctuary tucked behind iron votive screens.',
                        cause: 'The party entered this chapel.',
                    },
                },
                {
                    type: 'ADD_ASSET',
                    asset: {
                        kind: 'CREATURE',
                        name: 'Priest Odran',
                        location: 'shrine-quarter',
                        state: 'ACTIVE',
                        knowledge: 'KNOWN',
                        detail: 'Elderly gray-hooded priest tending the chapel.',
                        cause: 'Encountered tending the chapel.',
                    },
                },
            ],
            chronicles: [{ area_id: 'shrine-quarter', text: 'Entered the Chapel of the Drowned Stone and met Priest Odran.' }],
        });
        expect(applied.ok).toBe(true);
        expect(applied.document.assets.map(asset => asset.name)).toEqual([
            'Chapel of the Drowned Stone',
            'Priest Odran',
        ]);
        expect(applied.document.assets[0]).toMatchObject({ kind: 'OBJECT', location: 'shrine-quarter', knowledge: 'KNOWN' });
        expect(applied.document.assets[1]).toMatchObject({ kind: 'CREATURE', location: 'shrine-quarter' });
    });

    it('accepts chronicle.area as an alias for area_id', () => {
        const map = {
            version: 3,
            site: 'Morrowfen',
            areas: [{ id: 'shrine-quarter', name: 'Shrine Quarter', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [],
        };
        const applied = applyDungeonMapTransaction(map, {
            operation_id: 'day1-1557-chapel-drowned-stone',
            operations: [{
                op: 'ADD_ASSET', kind: 'OBJECT', name: 'Chapel of the Drowned Stone',
                location: 'shrine-quarter', state: 'ACTIVE', knowledge: 'KNOWN',
                cause: 'The party entered this chapel.',
            }],
            chronicles: [{ area: 'shrine-quarter', text: 'Entered the Chapel of the Drowned Stone and received shelter from Odran.' }],
        });
        expect(applied.ok).toBe(true);
        expect(applied.chronicles).toEqual([{
            areaId: 'shrine-quarter',
            areaName: 'Shrine Quarter',
            text: 'Entered the Chapel of the Drowned Stone and received shelter from Odran.',
        }]);
    });

    it('ships a strict conditional map commit schema', () => {
        const schema = buildDungeonMapCommitSchema();
        expect(schema.additionalProperties).toBe(false);
        expect(schema.required).toEqual(['operation_id', 'operations']);
        expect(schema.properties.operations.items.oneOf).toHaveLength(7);
        expect(schema.properties.operations.items.oneOf.every(item => item.additionalProperties === false)).toBe(true);
        expect(schema.description).toContain('Do not include transient combat poses');
        const setAsset = schema.properties.operations.items.oneOf.find(item => item.properties.op.enum.includes('SET_ASSET'));
        expect(setAsset.required).toContain('cause');
        expect(setAsset.properties.actor).toBeDefined();
        expect(setAsset.properties.count).toMatchObject({ type: 'integer', minimum: 1, maximum: 99 });
        expect(setAsset.properties.detail.description).toContain('Never HP, targeting, mid-round poses');
        expect(schema.properties.chronicles.description).toContain('Not turn-by-turn combat choreography');
    });

    it('formats a compact occupancy snapshot for the Map Updater', () => {
        const snapshot = formatDungeonMapForUpdater({
            version: 3,
            site: 'Abbey Undercroft',
            kind: 'DUNGEON',
            areas: [{
                id: 'cellar-landing',
                name: 'Cellar Landing',
                knowledge: 'VISITED',
                geometry: ['A damp stair landing.'],
                connections: [{ to: 'crypt-passage-east', state: 'OPEN' }],
            }],
            assets: [{
                id: 'crypt-ghoul',
                kind: 'CREATURE',
                name: 'Crypt Ghoul',
                location: 'cellar-landing',
                state: 'DESTROYED',
                knowledge: 'KNOWN',
                actor: 'party',
                cause: 'Killed by the party on the landing.',
                changed_at: 'Day 1, 16:02',
            }, {
                id: 'crawling-dead-pack',
                kind: 'GROUP',
                name: 'Crawling Dead Pack',
                location: 'cellar-landing',
                state: 'ACTIVE',
                knowledge: 'KNOWN',
                count: 6,
            }],
        }, 'Abbey Undercroft, Cellar Landing');
        expect(snapshot).toContain('KIND: DUNGEON');
        expect(snapshot).toContain('cellar-landing | Cellar Landing | VISITED');
        expect(snapshot).toContain('crypt-ghoul | CREATURE | Crypt Ghoul');
        expect(snapshot).toContain('actor=party');
        expect(snapshot).toContain('cause=Killed by the party on the landing.');
        expect(snapshot).toContain('since=Day 1, 16:02');
        expect(snapshot).toContain('count=6');
        expect(snapshot).toContain('A damp stair landing.');
    });

    it('lists living occupants for Map Evolution and flags same-room crowding', () => {
        const snapshot = formatDungeonMapForEvolution({
            version: 3,
            site: 'Abbey Undercroft',
            kind: 'DUNGEON',
            areas: [
                { id: 'ossuary', name: 'Ossuary', knowledge: 'UNREVEALED', geometry: [], connections: [] },
                { id: 'gallery', name: 'Gallery', knowledge: 'UNREVEALED', geometry: [], connections: [] },
            ],
            assets: [
                { id: 'outer-bandit-crew', kind: 'GROUP', name: 'Marsh Road Bandit Crew', location: 'ossuary', state: 'ACTIVE', knowledge: 'UNREVEALED', count: 5, origin: 'MAP_EVOLUTION' },
                { id: 'flood-passage-vermin', kind: 'GROUP', name: 'Giant Marsh Rats', location: 'ossuary', state: 'ACTIVE', knowledge: 'UNREVEALED', count: 4, origin: 'INITIAL_MAP' },
                { id: 'upper-crypt-skeletal-guardians', kind: 'GROUP', name: 'Skeletal Crypt Guardians', location: 'gallery', state: 'ACTIVE', knowledge: 'UNREVEALED', count: 8, origin: 'INITIAL_MAP' },
                { id: 'crypt-ghoul', kind: 'CREATURE', name: 'Crypt Ghoul', location: 'ossuary', state: 'DESTROYED', knowledge: 'KNOWN', origin: 'INITIAL_MAP' },
                { id: 'bandit-hideout-supplies', kind: 'OBJECT', name: 'Bandit Hideout Supplies', location: 'ossuary', state: 'ACTIVE', knowledge: 'UNREVEALED', origin: 'MAP_EVOLUTION' },
            ],
        });
        expect(snapshot).toContain('## LIVING OCCUPANTS');
        expect(snapshot).toContain('several may act in this one transaction');
        expect(snapshot).toContain('same-room means they share a space');
        expect(snapshot).toContain('Do not assume they are enemies');
        expect(snapshot).not.toContain('competing groups that should interact');
        expect(snapshot).toContain('outer-bandit-crew | GROUP | Marsh Road Bandit Crew | loc=ossuary | ACTIVE | count=5 | same-room=flood-passage-vermin');
        expect(snapshot).toContain('flood-passage-vermin | GROUP | Giant Marsh Rats | loc=ossuary | ACTIVE | count=4 | same-room=outer-bandit-crew');
        expect(snapshot).toContain('upper-crypt-skeletal-guardians | GROUP | Skeletal Crypt Guardians | loc=gallery | ACTIVE | count=8');
        expect(snapshot).not.toMatch(/## LIVING OCCUPANTS[\s\S]*crypt-ghoul/);
        expect(snapshot).not.toMatch(/## LIVING OCCUPANTS[\s\S]*bandit-hideout-supplies/);
        expect(snapshot).not.toContain('same-room=upper-crypt-skeletal-guardians');
    });

    it('assembles an attached root map with descendant Lorebook Agent location state', () => {
        const entries = {
            0: {
                comment: 'Varnholde Crypts',
                content: '[CORE]A mapped crypt.[/CORE]\n\n[MAP]\nDungeon Site: Varnholde Crypts\nArea: Main Chamber\nA desecrated altar.\n[/MAP]',
            },
            1: {
                comment: 'Varnholde Crypts :: Main Chamber',
                content: '[CORE]A stone chamber.[/CORE]\n[Day 1, 08:05] The altar was scorched.',
            },
            2: { comment: 'Oakbridge :: Market', content: '[CORE]A market.[/CORE]' },
        };
        const state = { version: 3, sites: buildDungeonSitesFromLocationEntries(entries, 'Campaign_Locations') };
        const site = resolveActiveDungeonSite(state, 'Varnholde Crypts, Main Chamber');
        expect(site.entryId).toBe('Campaign_Locations::0');
        expect(site.locationEntries.map(row => row.label)).toEqual([
            'Varnholde Crypts',
            'Varnholde Crypts :: Main Chamber',
        ]);
        const injection = buildDungeonRealityInjection(site, 'Varnholde Crypts, Main Chamber');
        expect(injection).toContain('The altar was scorched.');
        expect(injection.match(/A desecrated altar\./g)).toHaveLength(1);
        expect(injection).not.toContain('A stone chamber.');
        expect(injection).not.toContain('A mapped crypt.');
        expect(injection).not.toContain('A market.');
        expect(resolveActiveDungeonSite(state, 'Oakbridge, Market')).toBeNull();
    });

    it('merges follow-up chunks without rewriting or duplicating the skeleton', () => {
        const first = assistant(`<div hidden>Dungeon Site: The Sunken Keep\nArea: Gatehouse\nA barred gate.</div>\n*(Location: The Sunken Keep, Gatehouse)*`);
        const followUp = assistant(`<div hidden>Dungeon Site: The Sunken Keep\nArea: Lower Cistern\nA submerged bell alarm.</div>\n*(Location: The Sunken Keep, Lower Cistern)*`);

        const initial = syncDungeonRealityState(null, [first]);
        const merged = syncDungeonRealityState(initial.state, [first, followUp]);
        const repeated = syncDungeonRealityState(merged.state, [first, followUp]);

        expect(merged.state.sites['sunken keep'].mapChunks).toEqual([
            'Dungeon Site: The Sunken Keep\nArea: Gatehouse\nA barred gate.',
            'Dungeon Site: The Sunken Keep\nArea: Lower Cistern\nA submerged bell alarm.',
        ]);
        expect(repeated.changed).toBe(false);
        expect(repeated.capturedChunks).toBe(0);
    });

    it('parses explicit mutation/addition cues without treating them as map chunks', () => {
        const text = `<div hidden data-dungeon-delta>
Dungeon Site: The Sunken Keep
Mutation: Gatehouse | cleared; alarm bell disabled
Addition: Smuggler Niche - Gatehouse | behind loose stone; contains an oilskin ledger
</div>`;
        expect(extractHiddenDungeonMapBlocks(text)).toEqual([]);
        expect(extractHiddenDungeonDeltaBlocks(text)).toHaveLength(1);
        expect(parseDungeonDeltaBlock(extractHiddenDungeonDeltaBlocks(text)[0])).toEqual({
            siteRoot: 'The Sunken Keep',
            entries: [
                { type: 'mutation', label: 'Gatehouse', state: 'cleared; alarm bell disabled' },
                { type: 'addition', label: 'Smuggler Niche - Gatehouse', detail: 'behind loose stone; contains an oilskin ledger' },
            ],
            errors: [],
        });
    });

    it('appends selected-response deltas once and preserves their capture provenance', () => {
        const map = assistant('<div hidden>Dungeon Site: The Sunken Keep\nArea: Gatehouse\nA barred gate.</div>\n*(Location: The Sunken Keep, Gatehouse)*');
        const change = assistant(`<div hidden data-dungeon-delta>
Dungeon Site: The Sunken Keep
Mutation: Gatehouse | cleared
Addition: Smuggler Niche - Gatehouse | behind loose stone
</div>
The last guard falls and a loose stone reveals a niche.
*(Location: The Sunken Keep, Gatehouse)*`, { swipe_id: 3, send_date: 1234 });

        const captured = syncDungeonRealityState(null, [map, change]);
        const repeated = syncDungeonRealityState(captured.state, [map, change]);
        const log = captured.state.sites['sunken keep'].statusLog;

        expect(captured.capturedDeltas).toBe(2);
        expect(log).toHaveLength(2);
        expect(log[0]).toMatchObject({
            type: 'mutation',
            label: 'Gatehouse',
            state: 'cleared',
            at: { messageIndex: 1, swipeId: 3, sentAt: 1234 },
        });
        expect(log[1]).toMatchObject({
            type: 'addition',
            label: 'Smuggler Niche - Gatehouse',
            detail: 'behind loose stone',
        });
        expect(repeated.changed).toBe(false);
        expect(repeated.capturedDeltas).toBe(0);

        const reoccupied = assistant('<div hidden data-dungeon-delta>Dungeon Site: The Sunken Keep\nMutation: Gatehouse | reoccupied</div>\n*(Location: The Sunken Keep, Gatehouse)*');
        const clearedAgain = assistant('<div hidden data-dungeon-delta>Dungeon Site: The Sunken Keep\nMutation: Gatehouse | cleared</div>\n*(Location: The Sunken Keep, Gatehouse)*');
        const cycled = syncDungeonRealityState(captured.state, [map, change, reoccupied, clearedAgain]);
        expect(cycled.state.sites['sunken keep'].statusLog.map(entry => entry.state || entry.detail)).toEqual([
            'cleared',
            'behind loose stone',
            'reoccupied',
            'cleared',
        ]);
    });

    it('rejects deltas without an immutable site map and reports marker/footer conflicts', () => {
        const orphan = syncDungeonRealityState(null, [
            assistant('<div hidden data-dungeon-delta>Dungeon Site: Ember Mine\nMutation: Lift | disabled</div>\n*(Location: Ember Mine, Lift)*'),
        ]);
        expect(orphan.state).toBeNull();
        expect(orphan.errors.join(' ')).toContain('no captured immutable map exists');

        const conflict = syncDungeonRealityState(null, [
            assistant('<div hidden>Dungeon Site: Ember Mine\nArea: Lift\nFrayed cable.</div>\n*(Location: Blackglass Vault, Lift)*'),
        ]);
        expect(conflict.state).toBeNull();
        expect(conflict.errors.join(' ')).toContain('conflicts with footer site');
    });

    it('falls back to the explicit Dungeon Site marker when a map footer is malformed', () => {
        const result = syncDungeonRealityState(null, [
            assistant('<div hidden>Dungeon Site: Blackglass Vault\nArea: Entry Lock\nPoison needle.</div>'),
        ]);
        expect(result.errors).toEqual([]);
        expect(result.state.sites['blackglass vault'].mapChunks).toHaveLength(1);
    });

    it('binds a structured JSON map by its site field when no footer is available', () => {
        const body = JSON.stringify({
            version: 3,
            site: 'Blackglass Vault',
            areas: [{ id: 'entry-lock', name: 'Entry Lock', knowledge: 'UNREVEALED', geometry: ['A poison needle.'], connections: [] }],
            assets: [],
        });
        const collected = collectDungeonMapCandidates([assistant(`<div hidden data-dungeon-map>${body}</div>`)]);
        expect(collected.errors).toEqual([]);
        expect(collected.maps[0].siteRoot).toBe('Blackglass Vault');
    });

    it('keeps uncaptured hidden HTML when no site binding can be derived', () => {
        const raw = '<div hidden>Unlabeled secret material</div>';
        const result = syncDungeonRealityState(null, [assistant(raw)]);
        expect(result.state).toBeNull();
        expect(result.errors).toHaveLength(1);
        expect(stripCapturedDungeonMapBlocks(raw, result.state)).toBe(raw);
    });

    it('activates at site-root level, tolerates light drift, and stops after leaving', () => {
        const result = syncDungeonRealityState(null, [
            assistant('<div hidden>Dungeon Site: The Crypt of Whispers\nArea: Antechamber\nA pit trap.</div>\n*(Location: The Crypt of Whispers, Antechamber)*'),
        ]);

        expect(dungeonLabelsMatch('The Crypt of Whispers', 'Crypt of Whisper')).toBe(true);
        expect(resolveActiveDungeonSite(result.state, 'Crypt of Whisper, Lower Halls')?.siteRoot)
            .toBe('The Crypt of Whispers');
        expect(resolveActiveDungeonSite(result.state, 'Oakbridge, Market Square')).toBeNull();
        expect(resolveActiveDungeonSite(result.state, 'Forest Near the Crypt of Whispers')).toBeNull();
        expect(resolveActiveDungeonSite(result.state, 'The Crypt of Whispers')).toBeTruthy();
        expect(dungeonLabelsMatch('Forest Near the Crypt of Whispers', 'The Crypt of Whispers')).toBe(false);
        expect(resolveActiveDungeonSite(result.state, 'Whispering Woods, Crypt of Whispers')?.siteRoot)
            .toBe('The Crypt of Whispers');
        expect(resolveActiveDungeonSite(result.state, 'Whispering Woods, Crypt of Whispers, Antechamber')?.siteRoot)
            .toBe('The Crypt of Whispers');
        expect(looksLikeDungeonSite('Whispering Woods, Forgotten Tomb')).toBe(true);
    });

    it('prefers a nested mapped dungeon over a mapped outer region', () => {
        const entries = {
            0: {
                comment: 'Whispering Woods',
                content: '[CORE]A mapped forest.[/CORE]\n[MAP]\nDungeon Site: Whispering Woods\nArea: Trailhead\nA deer path.\n[/MAP]',
            },
            1: {
                comment: 'Forgotten Tomb',
                content: '[CORE]A mapped tomb.[/CORE]\n[MAP]\nDungeon Site: Forgotten Tomb\nArea: Antechamber\nA sealed door.\n[/MAP]',
            },
        };
        const state = { version: 3, sites: buildDungeonSitesFromLocationEntries(entries, 'Campaign_Locations') };
        expect(resolveActiveDungeonSite(state, 'Whispering Woods, Trailhead')?.siteRoot).toBe('Whispering Woods');
        expect(resolveActiveDungeonSite(state, 'Whispering Woods, Forgotten Tomb')?.siteRoot).toBe('Forgotten Tomb');
        expect(resolveActiveDungeonSite(state, 'Forest Near the Forgotten Tomb')).toBeNull();
    });

    it('resolves hosted peers by their complete lore hierarchy without colliding on duplicate leaf names', () => {
        const settlementEntry = (site, district) => ({
            comment: site,
            content: `[CORE]Settlement map.[/CORE]\n[MAP]\n${JSON.stringify({
                version: 3,
                site,
                kind: 'SETTLEMENT',
                threat: 'MODERATE',
                areas: [{ id: 'district', name: district, knowledge: 'VISITED', geometry: [], connections: [] }],
                assets: [],
            })}\n[/MAP]`,
        });
        const mapEntry = (site, hostSite) => ({
            comment: site,
            content: `[CORE]Hosted map.[/CORE]\n[MAP]\n${JSON.stringify({
                version: 3,
                site,
                kind: 'DUNGEON',
                threat: 'HIGH',
                hostSite,
                hostBrief: `Contained in ${hostSite}. Exit returns there.`,
                areas: [{ id: 'entry', name: 'Entry', knowledge: 'VISITED', geometry: [], connections: [] }],
                assets: [],
            })}\n[/MAP]`,
        });
        const entries = {
            0: settlementEntry('Ashford', 'North Residential Streets'),
            1: mapEntry('Ashford :: North Residential Streets :: Residential House', 'Ashford'),
            2: settlementEntry('Blackwater', 'South Ward'),
            3: mapEntry('Blackwater :: South Ward :: Residential House', 'Blackwater'),
        };
        const state = { version: 3, sites: buildDungeonSitesFromLocationEntries(entries, 'Campaign_Locations') };

        expect(locationContainsSiteRoot(
            'Ashford, North Residential Streets, Residential House, Entry',
            'Ashford :: North Residential Streets :: Residential House',
        )).toBe(true);
        expect(locationContainsSiteRoot(
            'Blackwater, South Ward, Residential House',
            'Ashford :: North Residential Streets :: Residential House',
        )).toBe(false);
        expect(resolveActiveDungeonSite(state, 'Ashford, North Residential Streets, Residential House, Entry')?.siteRoot)
            .toBe('Ashford :: North Residential Streets :: Residential House');
        expect(resolveActiveDungeonSite(state, 'Blackwater, South Ward, Residential House, Entry')?.siteRoot)
            .toBe('Blackwater :: South Ward :: Residential House');
        expect(resolveActiveDungeonSite(state, 'Ashford, North Residential Streets')?.siteRoot).toBe('Ashford');
    });

    it('authorizes settlement creation only when absorption includes the active standalone peer', () => {
        const activeFooter = 'Floodway Sewers, Treatment Grate';
        const sewerManifest = [{ site: 'Floodway Sewers', kind: 'DUNGEON', assetKind: 'SUBDUNGEON' }];

        expect(settlementAbsorptionMatchesCurrentPeer('SETTLEMENT', activeFooter, sewerManifest)).toBe(true);
        expect(settlementAbsorptionMatchesCurrentPeer('DUNGEON', activeFooter, sewerManifest)).toBe(false);
        expect(settlementAbsorptionMatchesCurrentPeer('SETTLEMENT', activeFooter, [
            { site: 'Old Abbey', kind: 'INTERIOR', assetKind: 'SUBINTERIOR' },
        ])).toBe(false);
        expect(settlementAbsorptionMatchesCurrentPeer('SETTLEMENT', '', sewerManifest)).toBe(false);
    });

    it('resolves maps from exact canonical location-name mentions only', () => {
        const state = {
            version: 3,
            sites: {
                ember: { siteRoot: 'Ember Mine', entryId: 'Campaign_Locations::7', mapChunks: ['map'] },
                crypt: { siteRoot: "Saint Oren's Crypt", entryId: 'Campaign_Locations::8', mapChunks: ['map'] },
            },
        };

        expect(resolveMentionedDungeonSites(state, 'We should travel to Ember Mine next.').map(site => site.siteRoot))
            .toEqual(['Ember Mine']);
        expect(resolveMentionedDungeonSites(state, 'Ask about ember mine, then decide.').map(site => site.siteRoot))
            .toEqual(['Ember Mine']);
        expect(resolveMentionedDungeonSites(state, 'We are near the Ember Mines.')).toEqual([]);
        expect(resolveMentionedDungeonSites(state, 'The ember-mining guild can help.')).toEqual([]);
        expect(resolveMentionedDungeonSites(state, "Go to Saint Oren's Crypt!").map(site => site.siteRoot))
            .toEqual(["Saint Oren's Crypt"]);
        expect(resolveMentionedDungeonSites(state, "Go to Oren's Crypt.")).toEqual([]);
    });

    it('marks an off-site exact-name map injection without claiming the party is there', () => {
        const injection = buildDungeonRealityInjection({
            siteRoot: 'Ember Mine',
            mapChunks: ['Dungeon Site: Ember Mine\nArea: Lift\nFrayed cable.'],
            locationEntries: [],
            statusLog: [],
        }, 'Oakbridge, Market', { referencedByName: true });

        expect(injection).toContain('Site: Ember Mine');
        expect(injection).toContain('Current footer location: Oakbridge, Market');
        expect(injection).toContain('exact mapped-location name in the current player input');
    });

    it('strips only captured map blocks and builds an internal canon injection', () => {
        const captured = 'Dungeon Site: Ember Mine\nArea: Lift\nThe cable is frayed.';
        const uncaptured = 'Unrelated hidden UI payload';
        const result = syncDungeonRealityState(null, [
            assistant(`<div hidden>${captured}</div>\n*(Location: Ember Mine, Lift)*`),
        ]);
        const mixed = `<div hidden>${captured}</div>visible<div hidden>${uncaptured}</div>`;
        const stripped = stripCapturedDungeonMapBlocks(mixed, result.state);
        expect(stripped).not.toContain(captured);
        expect(stripped).toContain(uncaptured);

        const site = resolveActiveDungeonSite(result.state, 'Ember Mine, Lower Shaft');
        site.statusLog.push({ type: 'mutation', label: 'Lift', state: 'disabled' });
        const injection = buildDungeonRealityInjection(site, 'Ember Mine, Lower Shaft');
        expect(injection).toContain('[DUNGEON_REALITY — INTERNAL GM CANON]');
        expect(injection).toContain('Dungeon Site: Ember Mine');
        expect(injection).toContain('Area: Lift [UNREVEALED]');
        expect(injection).toContain('The cable is frayed.');
        expect(injection).toContain('MUTATION — Lift: disabled');
        expect(injection).toContain('Do not treat it as a menu of allowed actions');
        expect(injection).toContain('resolved story events override stale positions/states');
        expect(injection).toContain('room-scale dungeon canon');
        expect(injection).toContain('you may add a room or incidental feature');
        expect(injection).toContain('Cause / Actor / Since');
        expect(injection).toContain('Recent site activity');
        expect(injection).not.toContain('### Recent site activity');
        expect(injection).not.toContain('do not invent missing rooms');
        expect(injection).not.toContain('current operational snapshot');
    });

    it('never sends stored structured JSON to the narrator', () => {
        const raw = JSON.stringify({
            version: 3,
            site: 'Blackglass Vault',
            areas: [{ id: 'entry', name: 'Entry Lock', knowledge: 'VISITED', geometry: ['A narrow stone lock chamber.'], connections: [] }],
            assets: [{ id: 'needle', kind: 'TRAP', name: 'Poison Needle', location: 'entry', state: 'ARMED', knowledge: 'SUSPECTED', detail: 'Set inside the lock.', origin: 'INITIAL_MAP' }],
        }, null, 2);
        const injection = buildDungeonRealityInjection({
            siteRoot: 'Blackglass Vault',
            mapChunks: [raw],
            locationEntries: [],
            statusLog: [],
        }, 'Blackglass Vault, Entry Lock');
        expect(injection).toContain('Poison Needle [TRAP / ARMED / SUSPECTED]');
        expect(injection).not.toContain('"version"');
        expect(injection).not.toContain('"assets"');
        expect(injection.length).toBeLessThan(raw.length + 1200);
    });

    it('includes per-asset coupling and a compact activity briefing without the ledger', () => {
        const map = {
            version: 3,
            site: 'Ossuary',
            areas: [{ id: 'nave', name: 'Nave', knowledge: 'VISITED', geometry: ['Ash on the flagstones.'], connections: [] }],
            assets: [{
                id: 'chapel-latch',
                kind: 'OBJECT',
                name: 'Chapel Latch',
                location: 'nave',
                state: 'ACTIVE',
                knowledge: 'KNOWN',
                detail: 'Barred from the inside.',
                origin: 'INITIAL_MAP',
                actor: 'bandits',
                cause: 'Bandits barred the chapel latch.',
                changed_at: 'Day 1, 08:00',
            }],
        };
        const readable = formatDungeonMapForNarrator(map);
        expect(readable).toContain('Actor: bandits');
        expect(readable).toContain('Cause: Bandits barred the chapel latch.');
        expect(readable).toContain('Since: Day 1, 08:00');

        const activity = [
            'Use this to understand why occupancy looks this way.',
            'Open causal threads (latest per subject):',
            '- Day 1, 08:00 — OPEN chapel-latch by bandits: Bandits barred the chapel latch.',
        ].join('\n');
        const injection = buildDungeonRealityInjection({
            siteRoot: 'Ossuary',
            mapChunks: [JSON.stringify(map)],
            locationEntries: [],
            statusLog: [],
        }, 'Ossuary, Nave', { activityText: activity });
        expect(injection).toContain('### Recent site activity');
        expect(injection).toContain('OPEN chapel-latch by bandits');
        expect(injection).toContain('Actor: bandits');
        expect(injection).not.toContain('"changed_at"');
        expect(injection).not.toContain('"subjectId"');
    });

    it('strips a valid captured delta cue but keeps malformed or uncaptured cues', () => {
        const map = assistant('<div hidden>Dungeon Site: Ember Mine\nArea: Lift\nFrayed cable.</div>\n*(Location: Ember Mine, Lift)*');
        const deltaBody = 'Dungeon Site: Ember Mine\nMutation: Lift | disabled';
        const delta = assistant(`<div hidden data-dungeon-delta>${deltaBody}</div>\n*(Location: Ember Mine, Lift)*`);
        const captured = syncDungeonRealityState(null, [map, delta]);

        expect(stripCapturedDungeonMapBlocks(delta.mes, captured.state)).not.toContain(deltaBody);
        const malformed = '<div hidden data-dungeon-delta>Dungeon Site: Ember Mine\nLift changed somehow</div>';
        expect(stripCapturedDungeonMapBlocks(malformed, captured.state)).toBe(malformed);
        const uncaptured = '<div hidden data-dungeon-delta>Dungeon Site: Ember Mine\nMutation: Lift | repaired</div>';
        expect(stripCapturedDungeonMapBlocks(uncaptured, captured.state)).toBe(uncaptured);
    });

    it('removes all hidden map and delta blocks when the component is disabled', () => {
        const storedEntry = {
            comment: 'Ember Mine',
            content: '[CORE]\nA mapped mine.\n[/CORE]\n\n[MAP]\n{"version":3,"site":"Ember Mine","areas":[],"assets":[]}\n[/MAP]',
        };
        const storedContentBefore = storedEntry.content;
        const prompt = [
            {
                role: 'assistant',
                mes: '<div hidden data-dungeon-map>{"version":3,"site":"Ember Mine"}</div>Visible map prose',
            },
            {
                role: 'assistant',
                content: [{ type: 'text', text: '<div hidden data-dungeon-delta>Dungeon Site: Ember Mine\nMutation: Lift | cleared</div>Keep this' }],
            },
            {
                name: 'Dungeon Reality',
                mes: '[DUNGEON_REALITY — INTERNAL GM CANON]\nSite: Ember Mine\n[/DUNGEON_REALITY]',
            },
            { role: 'system', content: '<div hidden data-other-private>Keep unrelated hidden data</div>' },
        ];

        stripDungeonRealityBlocksFromPrompt(prompt);

        expect(prompt[0].mes).toBe('Visible map prose');
        expect(prompt[1].content[0].text).toBe('Keep this');
        expect(prompt.some(message => message.name === 'Dungeon Reality')).toBe(false);
        expect(prompt.at(-1).content).toContain('data-other-private');
        expect(storedEntry.content).toBe(storedContentBefore);
        expect(extractDungeonMapSection(storedEntry.content)).toContain('"site":"Ember Mine"');
    });

    it('lists existing maps for the narrator without requiring a matching footer', () => {
        expect(buildMappedSitesInjection({})).toContain('[MAPPED_SITES — INTERNAL]');
        expect(buildMappedSitesInjection({})).toContain('- None.');
        expect(buildMappedSitesInjection({})).toContain('CreateAreaMap is allowed');

        const sites = {
            thornbrook: {
                siteRoot: 'Thornbrook',
                mapChunks: [JSON.stringify({ version: 3, site: 'Thornbrook', kind: 'SETTLEMENT', areas: [], assets: [] })],
            },
            ember: {
                siteRoot: 'Ember Mine',
                mapChunks: [JSON.stringify({ version: 3, site: 'Ember Mine', kind: 'DUNGEON', areas: [], assets: [] })],
            },
            incomplete: { siteRoot: 'Ghost Site', mapChunks: [] },
        };
        expect(listMappedSiteSummaries(sites)).toEqual([
            { siteRoot: 'Ember Mine', kind: 'DUNGEON', cells: ['Site Overview'] },
            { siteRoot: 'Thornbrook', kind: 'SETTLEMENT', cells: ['Site Overview'] },
        ]);
        const index = buildMappedSitesInjection(sites);
        expect(index).toContain('- Ember Mine (DUNGEON)');
        expect(index).toContain('- Thornbrook (SETTLEMENT)');
        expect(index).toContain('attachTo.site');
        expect(index).toContain('attachTo.cell choices: Site Overview');
        expect(index).not.toContain('Ghost Site');
        expect(index).not.toContain('"version"');
    });

    it('annotates hosted peers and injects their deterministic exit context', () => {
        const hostedDocument = {
            version: 3,
            site: 'Rustport :: Dock Ward :: Flooded Sewers',
            kind: 'DUNGEON',
            threat: 'HIGH',
            hostSite: 'Rustport',
            hostBrief: 'Contained in Rustport, Dock Ward. Warehouse piers stink of brine. Exit returns to Dock Ward in Rustport.',
            areas: [{ id: 'grate', name: 'Treatment Grate', knowledge: 'VISITED', geometry: ['A corroded grate.'], connections: [] }],
            assets: [],
        };
        const sites = {
            sewers: { siteRoot: hostedDocument.site, mapChunks: [JSON.stringify(hostedDocument)] },
        };
        expect(listMappedSiteSummaries(sites)).toEqual([
            { siteRoot: hostedDocument.site, kind: 'DUNGEON', hostSite: 'Rustport', cells: ['Treatment Grate'] },
        ]);
        expect(buildMappedSitesInjection(sites)).toContain(`- ${hostedDocument.site} (DUNGEON; inside Rustport)`);

        const injection = buildDungeonRealityInjection({
            siteRoot: hostedDocument.site,
            mapChunks: [JSON.stringify(hostedDocument)],
            locationEntries: [],
            statusLog: [],
        }, 'Rustport, Dock Ward, Flooded Sewers, Treatment Grate');
        expect(injection).toContain('Contained in: Rustport');
        expect(injection).toContain(`Host brief: ${hostedDocument.hostBrief}`);
        expect(injection).toContain('Rustport, Dock Ward, Flooded Sewers, <Exact Current Map Area>');
        expect(injection).not.toContain('FOOTER CORRECTION REQUIRED');

        const incompleteFooter = buildDungeonRealityInjection({
            siteRoot: hostedDocument.site,
            mapChunks: [JSON.stringify(hostedDocument)],
            locationEntries: [],
            statusLog: [],
        }, 'Rustport, Dock Ward, Flooded Sewers');
        expect(incompleteFooter).toContain('FOOTER CORRECTION REQUIRED');
        expect(incompleteFooter).toContain('omits the party\'s room/area');

        const legacyLeafDocument = { ...hostedDocument, site: 'Residential House' };
        const legacyIncompleteFooter = buildDungeonRealityInjection({
            siteRoot: 'Residential House',
            mapChunks: [JSON.stringify(legacyLeafDocument)],
            locationEntries: [],
            statusLog: [],
        }, 'Ashford, North Residential Streets, Residential House');
        expect(legacyIncompleteFooter).toContain(
            'Ashford, North Residential Streets, Residential House, <Exact Current Map Area>',
        );
        expect(legacyIncompleteFooter).toContain('FOOTER CORRECTION REQUIRED');
    });

    it('highlights new structured settlement interiors and legacy OBJECT buildings without migration', () => {
        const base = {
            version: 3,
            site: 'Rustport',
            kind: 'SETTLEMENT',
            areas: [{ id: 'dock-ward', name: 'Dock Ward', knowledge: 'VISITED', geometry: ['Warehouse piers.'], connections: [] }],
            assets: [],
        };
        for (const kind of ['BUILDING', 'SUBDUNGEON', 'SUBINTERIOR', 'OBJECT']) {
            const document = structuredClone(base);
            document.assets.push({
                id: `site-${kind.toLowerCase()}`,
                kind,
                name: 'Gilded Tankard',
                location: 'dock-ward',
                state: 'ACTIVE',
                knowledge: 'KNOWN',
                detail: 'Occupies the ward.',
                origin: 'INITIAL_MAP',
            });
            const placement = resolveCurrentMapPlacement(document, 'Rustport, Dock Ward, Gilded Tankard');
            expect(placement.area?.id).toBe('dock-ward');
            expect(placement.interiorAsset?.kind).toBe(kind);
        }
    });

    it('keeps exterior-relative footer leaves on the district and binds inside-of leaves to the landmark', () => {
        const map = normalizeDungeonMapDocument({
            version: 3,
            site: 'Hollow Creek',
            kind: 'SETTLEMENT',
            areas: [{ id: 'main-street', name: 'Main Street', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{
                id: 'hollow-creek-general-store',
                kind: 'BUILDING',
                name: 'Hollow Creek General Store',
                location: 'main-street',
                state: 'ACTIVE',
                knowledge: 'KNOWN',
                notEntered: true,
            }],
        });

        const behind = resolveCurrentMapPlacement(map, 'Hollow Creek, East Outskirts → Main Street, behind the general store');
        expect(behind.area?.id).toBe('main-street');
        expect(behind.interiorAsset).toBeNull();
        expect(behind.unmatchedInterior).toBe('');
        expect(resolveBuildingPopulationTarget(map, 'Hollow Creek, East Outskirts → Main Street, behind the general store')).toBeNull();

        const inside = resolveCurrentMapPlacement(map, 'Hollow Creek, Main Street, inside the general store');
        expect(inside.area?.id).toBe('main-street');
        expect(inside.interiorAsset?.id).toBe('hollow-creek-general-store');
        expect(inside.unmatchedInterior).toBe('');
        expect(resolveBuildingPopulationTarget(map, 'Hollow Creek, Main Street, inside the general store')?.building?.id).toBe('hollow-creek-general-store');

        const shortFooter = resolveCurrentMapPlacement(map, 'Hollow Creek, Main Street, General Store');
        expect(shortFooter.area?.id).toBe('main-street');
        expect(shortFooter.interiorAsset?.id).toBe('hollow-creek-general-store');
        expect(shortFooter.unmatchedInterior).toBe('');
        expect(resolveBuildingPopulationTarget(map, 'Hollow Creek, Main Street, General Store')?.building?.id).toBe('hollow-creek-general-store');
    });

    it('preserves peaceful legacy DUNGEON maps without reclassification', () => {
        const legacy = normalizeDungeonMapDocument({
            version: 3,
            site: 'Old Safehouse',
            kind: 'DUNGEON',
            threat: 'NONE',
            areas: [{ id: 'foyer', name: 'Foyer', knowledge: 'VISITED', geometry: ['A quiet foyer.'], connections: [] }],
            assets: [],
        }, 'Old Safehouse');
        expect(legacy).toMatchObject({ kind: 'DUNGEON', threat: 'NONE' });

        const oldStructuralAlias = normalizeDungeonMapDocument({
            version: 3,
            site: 'Old Town',
            kind: 'SETTLEMENT',
            areas: [{ id: 'market', name: 'Market', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{
                id: 'old-inn', kind: 'INTERIOR', name: 'Old Inn', location: 'market', state: 'ACTIVE',
                knowledge: 'KNOWN', detail: 'A legacy structure.', origin: 'INITIAL_MAP',
            }],
        }, 'Old Town');
        expect(oldStructuralAlias.assets[0].kind).toBe('BUILDING');
    });

    it('strips a mapped-sites index from the prompt copy when Persistent Maps is off', () => {
        const prompt = [
            {
                name: 'Dungeon Reality',
                mes: '[MAPPED_SITES — INTERNAL]\n- Thornbrook (SETTLEMENT)\n[/MAPPED_SITES]\n',
            },
            {
                role: 'system',
                content: 'Keep this. [MAPPED_SITES — INTERNAL]\n- Ember Mine (DUNGEON)\n[/MAPPED_SITES]',
            },
        ];
        stripDungeonRealityBlocksFromPrompt(prompt);
        expect(prompt.some(message => /MAPPED_SITES/i.test(JSON.stringify(message)))).toBe(false);
    });

    it('uses the latest narrator footer and diagnoses obvious high-risk roots', () => {
        const chat = [
            assistant('*(Location: Oakbridge, Market)*'),
            { is_user: true, mes: 'I travel.' },
            assistant('*(Location: Ashen Catacombs, Entry Stair)*'),
        ];
        expect(findLatestDungeonLocation(chat)).toBe('Ashen Catacombs, Entry Stair');
        expect(looksLikeDungeonSite(findLatestDungeonLocation(chat))).toBe(true);
        expect(looksLikeDungeonSite('Oakbridge, Market')).toBe(false);
    });

    it('defaults EVOLVED ADD_ASSET origin to MAP_EVOLUTION and rejects revival, bubble mutation, and SET_AREA knowledge', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [
                { id: 'crypt-passage', name: 'Crypt Passage', knowledge: 'VISITED', geometry: ['Damp stone.'], connections: [{ to: 'ossuary', state: 'OPEN', detail: '' }] },
                { id: 'ossuary', name: 'Ossuary', knowledge: 'UNREVEALED', geometry: [], connections: [{ to: 'crypt-passage', state: 'OPEN', detail: '' }] },
            ],
            assets: [
                { id: 'crypt-ghoul', kind: 'CREATURE', name: 'Crypt Ghoul', location: 'crypt-passage', state: 'DESTROYED', knowledge: 'KNOWN', detail: 'Smoldering remains.', origin: 'INITIAL_MAP' },
            ],
        };

        const added = applyDungeonMapTransaction(map, {
            operation_id: 'evo-day2-0800-ashen-patrol',
            operations: [{
                op: 'ADD_ASSET', evidence: 'EVOLVED', name: 'Ashen Skeleton Patrol', kind: 'GROUP',
                location: 'ossuary', state: 'ACTIVE', knowledge: 'UNREVEALED',
                distinct_from: ['crypt-ghoul'],
                cause: 'Moved into the emptied ossuary after the ghoul fell.',
            }],
        });
        expect(added.ok).toBe(true);
        expect(added.document.assets.find(asset => asset.id === 'ashen-skeleton-patrol')).toMatchObject({
            origin: 'MAP_EVOLUTION', knowledge: 'UNREVEALED', location: 'ossuary',
        });

        const revived = applyDungeonMapTransaction(map, {
            operation_id: 'evo-day2-0800-revive-ghoul',
            operations: [{ op: 'SET_ASSET', evidence: 'EVOLVED', asset_id: 'crypt-ghoul', state: 'ACTIVE' }],
        });
        expect(revived.ok).toBe(false);
        expect(revived.errors[0]).toMatchObject({ code: 'PLAY_CANON_LOCKED' });

        const autonomousAdd = applyDungeonMapTransaction(map, {
            operation_id: 'day2-0800-autonomous-add',
            operations: [{
                op: 'ADD_ASSET', evidence: 'AUTONOMOUS', name: 'Wandering Shade', kind: 'CREATURE',
                location: 'ossuary', state: 'ACTIVE', knowledge: 'UNREVEALED',
            }],
        });
        expect(autonomousAdd.ok).toBe(false);
        expect(autonomousAdd.errors[0]).toMatchObject({ code: 'AUTONOMY_NOT_ALLOWED' });

        const frozen = applyDungeonMapTransaction(map, {
            operation_id: 'evo-day2-0800-bubble',
            operations: [{ op: 'SET_ASSET', evidence: 'EVOLVED', asset_id: 'crypt-ghoul', detail: 'Should not change in the player bubble.' }],
        }, { frozenAreaIds: ['crypt-passage'] });
        expect(frozen.ok).toBe(false);
        expect(frozen.errors[0]).toMatchObject({ code: 'PLAYER_BUBBLE_FROZEN' });

        const knowledgeChange = applyDungeonMapTransaction(map, {
            operation_id: 'evo-day2-0800-reveal-ossuary',
            operations: [{ op: 'SET_AREA', evidence: 'EVOLVED', area_id: 'ossuary', knowledge: 'DISCOVERED' }],
        });
        expect(knowledgeChange.ok).toBe(false);
        expect(knowledgeChange.errors[0]).toMatchObject({ code: 'EVOLUTION_SET_AREA_LIMITED' });

        const geometry = applyDungeonMapTransaction(map, {
            operation_id: 'evo-day2-0800-barricade',
            operations: [{ op: 'SET_AREA', evidence: 'EVOLVED', area_id: 'ossuary', geometry_append: ['A collapsed shelf of bone now blocks the alcove.'], cause: 'A bone shelf collapsed after scavengers rummaged the alcove.' }],
        });
        expect(geometry.ok).toBe(true);
        expect(geometry.document.areas.find(area => area.id === 'ossuary').geometry).toContain('A collapsed shelf of bone now blocks the alcove.');
    });

    it('requires cause on material changes and actor on DESTROYED, and stamps changed_at', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [
                { id: 'crypt', name: 'Crypt', knowledge: 'VISITED', geometry: [], connections: [{ to: 'ossuary', state: 'OPEN', detail: '' }] },
                { id: 'ossuary', name: 'Ossuary', knowledge: 'UNREVEALED', geometry: [], connections: [{ to: 'crypt', state: 'OPEN', detail: '' }] },
            ],
            assets: [
                { id: 'ash-wight', kind: 'CREATURE', name: 'Ash Wight', location: 'ossuary', state: 'ACTIVE', knowledge: 'UNREVEALED', detail: '', origin: 'INITIAL_MAP' },
                { id: 'salt-road-delvers', kind: 'GROUP', name: 'Salt-Road Delvers', location: 'crypt', state: 'ACTIVE', knowledge: 'UNREVEALED', detail: '', origin: 'MAP_EVOLUTION' },
            ],
        };
        const missingCause = applyDungeonMapTransaction(map, {
            operation_id: 'evo-missing-cause',
            operations: [{ op: 'SET_ASSET', evidence: 'EVOLVED', asset_id: 'ash-wight', state: 'ALERT' }],
        });
        expect(missingCause.ok).toBe(false);
        expect(missingCause.errors[0].code).toBe('MISSING_CAUSE');

        const missingActor = applyDungeonMapTransaction(map, {
            operation_id: 'evo-missing-killer',
            operations: [{ op: 'SET_ASSET', evidence: 'EVOLVED', asset_id: 'ash-wight', state: 'DESTROYED', cause: 'Killed during a fight over spoils.' }],
        });
        expect(missingActor.ok).toBe(false);
        expect(missingActor.errors[0].code).toBe('MISSING_ACTOR');

        const killed = applyDungeonMapTransaction(map, {
            operation_id: 'evo-third-party-kill',
            operations: [{
                op: 'SET_ASSET', evidence: 'EVOLVED', asset_id: 'ash-wight', state: 'DESTROYED',
                detail: 'Broken remains after a brief fight over spoils.',
                cause: 'Killed by Salt-Road Delvers over ossuary spoils.',
                actor: 'salt-road-delvers',
            }],
        }, { currentTime: 'Day 3, 08:00' });
        expect(killed.ok).toBe(true);
        expect(killed.document.assets.find(asset => asset.id === 'ash-wight')).toMatchObject({
            state: 'DESTROYED',
            actor: 'salt-road-delvers',
            cause: 'Killed by Salt-Road Delvers over ossuary spoils.',
            changed_at: 'Day 3, 08:00',
        });
    });

    it('stores pack count on ADD_ASSET and SET_ASSET, and rejects count 0', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [{ id: 'crypt', name: 'Crypt', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [],
        };
        const added = applyDungeonMapTransaction(map, {
            operation_id: 'day1-1540-pack',
            operations: [{
                op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Crawling Dead Pack', kind: 'GROUP',
                location: 'crypt', state: 'ACTIVE', knowledge: 'KNOWN', count: 6,
                cause: 'The party encountered this pack in the crypt.',
            }],
        });
        expect(added.ok).toBe(true);
        expect(added.document.assets[0]).toMatchObject({ kind: 'GROUP', count: 6 });

        const thinned = applyDungeonMapTransaction(added.document, {
            operation_id: 'day1-1610-pack-thinned',
            operations: [{
                op: 'SET_ASSET', evidence: 'CONFIRMED', asset_id: 'crawling-dead-pack', count: 2,
                cause: 'The party destroyed four of the pack.', actor: 'party',
            }],
        });
        expect(thinned.ok).toBe(true);
        expect(thinned.document.assets[0].count).toBe(2);

        const zero = applyDungeonMapTransaction(added.document, {
            operation_id: 'day1-1611-pack-zero',
            operations: [{
                op: 'SET_ASSET', evidence: 'CONFIRMED', asset_id: 'crawling-dead-pack', count: 0,
                cause: 'None remain.',
            }],
        });
        expect(zero.ok).toBe(false);
        expect(zero.errors[0].code).toBe('INVALID_COUNT');
    });

    it('stores DEACTIVATED as the canonical neutralized-mechanism state', () => {
        expect(coerceAssetState('DISARMED')).toBe('DEACTIVATED');
        expect(coerceAssetState('inactive')).toBe('DEACTIVATED');
        expect(coerceAssetState('PACIFIED')).toBe('DEACTIVATED');
        expect(isPlayCanonLockedState('DISARMED')).toBe(true);
        expect(isPlayCanonLockedState('DEACTIVATED')).toBe(true);

        const document = normalizeDungeonMapDocument({
            version: 3,
            site: 'Abbey Undercroft',
            areas: [{ id: 'entry', name: 'Entry', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{
                id: 'needle', kind: 'TRAP', name: 'Poison Needle', location: 'entry',
                state: 'DISARMED', knowledge: 'KNOWN', detail: 'Pins folded back.', origin: 'INITIAL_MAP',
            }],
        });
        expect(document.assets[0].state).toBe('DEACTIVATED');

        const withDisarmed = {
            ...connectedArchitectMap,
            assets: [{
                ...connectedArchitectMap.assets[0],
                id: 'glyph',
                kind: 'TRAP',
                name: 'Scorching Glyph',
                state: 'DISARMED',
            }],
        };
        const accepted = validateDungeonMapArchitecture(withDisarmed, {
            site: 'Abbey Undercroft',
            entrance: 'Cellar Landing',
        });
        expect(accepted.valid).toBe(true);
        expect(accepted.document.assets.find(asset => asset.id === 'glyph').state).toBe('DEACTIVATED');

        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [{ id: 'entry', name: 'Entry', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{
                id: 'needle', kind: 'TRAP', name: 'Poison Needle', location: 'entry',
                state: 'ARMED', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP',
            }],
        };
        const disarmed = applyDungeonMapTransaction(map, {
            operation_id: 'day1-1600-needle-off',
            operations: [{
                op: 'SET_ASSET', evidence: 'CONFIRMED', asset_id: 'needle', state: 'DISARMED',
                knowledge: 'KNOWN', cause: 'The party folded the needle back.', actor: 'party',
            }],
        });
        expect(disarmed.ok).toBe(true);
        expect(disarmed.document.assets[0].state).toBe('DEACTIVATED');

        const revived = applyDungeonMapTransaction(disarmed.document, {
            operation_id: 'evo-day2-0800-rearm',
            operations: [{ op: 'SET_ASSET', evidence: 'EVOLVED', asset_id: 'needle', state: 'ARMED', cause: 'Should not rearm.' }],
        });
        expect(revived.ok).toBe(false);
        expect(revived.errors[0]).toMatchObject({ code: 'PLAY_CANON_LOCKED' });
    });

    it('supports the closed BUILDING and carried-inventory containment relations', () => {
        const settlement = normalizeDungeonMapDocument({
            version: 3,
            site: 'Ashford',
            kind: 'SETTLEMENT',
            areas: [{ id: 'north-streets', name: 'North Residential Streets', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{ id: 'house', kind: 'BUILDING', name: 'Residential House', location: 'north-streets', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' }],
        });
        expect(settlement.assets[0].notEntered).toBe(true);

        const populated = applyDungeonMapTransaction(settlement, {
            operation_id: 'day2-house-populated',
            operations: [
                { op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Caretaker', kind: 'CREATURE', location: 'house', state: 'ACTIVE', knowledge: 'KNOWN', cause: 'Met inside the house.' },
                { op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Brass Key', kind: 'LOOT', location: 'Caretaker', state: 'AVAILABLE', knowledge: 'SUSPECTED', cause: 'The caretaker was rumored to carry it.' },
                { op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Cellar Snare', kind: 'TRAP', location: 'house', state: 'ARMED', knowledge: 'UNREVEALED', cause: 'It was established inside the house.' },
                { op: 'SET_ASSET', evidence: 'CONFIRMED', asset_id: 'house', notEntered: false, cause: 'First entry resolved the house.' },
            ],
        });
        expect(populated.ok).toBe(true);
        expect(listContainedMapAssets(populated.document, 'house').map(asset => asset.kind)).toEqual(['CREATURE', 'TRAP']);
        expect(resolveAssetEffectiveArea(populated.document, 'brass-key')?.id).toBe('north-streets');
        expect(populated.document.assets.find(asset => asset.id === 'house')?.notEntered).toBe(false);

        const forbidden = applyDungeonMapTransaction(settlement, {
            operation_id: 'day2-illegal-container',
            operations: [{ op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Hidden Guard', kind: 'CREATURE', location: 'house', state: 'ACTIVE', knowledge: 'KNOWN', cause: 'Test.' },
                { op: 'ADD_ASSET', evidence: 'CONFIRMED', name: 'Guard Within Guard', kind: 'CREATURE', location: 'Hidden Guard', state: 'ACTIVE', knowledge: 'KNOWN', cause: 'Test.' }],
        });
        expect(forbidden.ok).toBe(false);
        expect(forbidden.errors.some(error => error.code === 'LOCATION_NOT_ALLOWED')).toBe(true);
    });

    it('moves container descendants by effective placement and preserves them off-map on removal', () => {
        const map = normalizeDungeonMapDocument({
            version: 3, site: 'Ashford', kind: 'SETTLEMENT',
            areas: [
                { id: 'north', name: 'North', knowledge: 'VISITED', geometry: [], connections: [{ to: 'south', state: 'OPEN', detail: '' }] },
                { id: 'south', name: 'South', knowledge: 'VISITED', geometry: [], connections: [{ to: 'north', state: 'OPEN', detail: '' }] },
            ],
            assets: [
                { id: 'porter', kind: 'CREATURE', name: 'Porter', location: 'north', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' },
                { id: 'parcel', kind: 'OBJECT', name: 'Parcel', location: 'porter', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' },
            ],
        });
        const moved = applyDungeonMapTransaction(map, { operation_id: 'porter-south', operations: [{ op: 'MOVE_ASSET', evidence: 'CONFIRMED', asset_id: 'porter', from: 'north', to: 'south', cause: 'Walked south.' }] });
        expect(moved.ok).toBe(true);
        expect(moved.document.assets.find(asset => asset.id === 'parcel')?.location).toBe('porter');
        expect(resolveAssetEffectiveArea(moved.document, 'parcel')?.id).toBe('south');
        const removed = applyDungeonMapTransaction(moved.document, { operation_id: 'porter-left', operations: [{ op: 'REMOVE_ASSET', evidence: 'CONFIRMED', asset_id: 'porter', cause: 'Left the site.' }] });
        expect(removed.ok).toBe(true);
        expect(removed.document.assets.find(asset => asset.id === 'porter')).toBeUndefined();
        expect(removed.document.assets.find(asset => asset.id === 'parcel')).toBeUndefined();
        expect(resolveAssetEffectiveArea(removed.document, 'parcel')).toBeNull();
    });

    it('REMOVE_ASSET deletes the asset record and contained children from the map', () => {
        const map = normalizeDungeonMapDocument({
            version: 3, site: 'Test', kind: 'DUNGEON',
            areas: [{ id: 'hall', name: 'Hall', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [
                { id: 'clutter-chair', kind: 'OBJECT', name: 'Tipped Chair', location: 'hall', state: 'ACTIVE', knowledge: 'KNOWN', origin: 'INITIAL_MAP' },
            ],
        });
        const removed = applyDungeonMapTransaction(map, {
            operation_id: 'clutter-removed',
            operations: [{ op: 'REMOVE_ASSET', evidence: 'CONFIRMED', asset_id: 'clutter-chair', cause: 'Mistaken ambient clutter.' }],
        });
        expect(removed.ok).toBe(true);
        expect(removed.document.assets).toHaveLength(0);
        expect(formatDungeonMapForNarrator(removed.document)).not.toContain('Tipped Chair');
    });

    it('detects pending BUILDING entry and requires Evolution population to clear it atomically', () => {
        const map = normalizeDungeonMapDocument({
            version: 3, site: 'Ashford', kind: 'SETTLEMENT',
            areas: [{ id: 'north', name: 'North Residential Streets', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [{ id: 'house', kind: 'BUILDING', name: 'Residential House', location: 'north', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' }],
        });
        expect(resolveBuildingPopulationTarget(map, 'Ashford, North Residential Streets, Residential House')?.building?.id).toBe('house');
        expect(resolveBuildingPopulationTarget(map, 'Ashford, North Residential Streets')).toBeNull();

        const incomplete = applyDungeonMapTransaction(map, {
            operation_id: 'evo-house-caretaker',
            operations: [{ op: 'ADD_ASSET', evidence: 'EVOLVED', name: 'Caretaker', kind: 'CREATURE', location: 'house', state: 'ACTIVE', knowledge: 'UNREVEALED', cause: 'Moved into the empty house.' }],
        });
        expect(incomplete.ok).toBe(false);
        expect(incomplete.errors.some(error => error.code === 'BUILDING_POPULATION_NOT_RESOLVED')).toBe(true);

        const complete = applyDungeonMapTransaction(map, {
            operation_id: 'evo-house-caretaker-complete',
            operations: [
                { op: 'ADD_ASSET', evidence: 'EVOLVED', name: 'Caretaker', kind: 'CREATURE', location: 'house', state: 'ACTIVE', knowledge: 'UNREVEALED', cause: 'Moved into the empty house.' },
                { op: 'SET_ASSET', evidence: 'EVOLVED', asset_id: 'house', notEntered: false, cause: 'The house acquired stable off-screen occupancy.' },
            ],
        });
        expect(complete.ok).toBe(true);
    });

    it('parses editable inspector JSON and rejects site mismatches', () => {
        const json = serializeDungeonMapDocument(connectedArchitectMap);
        const parsed = parseEditableDungeonMapJson(json, 'Abbey Undercroft');
        expect(parsed.ok).toBe(true);
        expect(parsed.document.site).toBe('Abbey Undercroft');
        expect(parsed.document.areas.length).toBeGreaterThan(0);

        const fenced = parseEditableDungeonMapJson('```json\n' + json + '\n```', 'Abbey Undercroft');
        expect(fenced.ok).toBe(true);

        const wrongSite = parseEditableDungeonMapJson(json, 'Other Site');
        expect(wrongSite.ok).toBe(false);
        expect(wrongSite.errors[0]).toContain('site must stay');

        const broken = parseEditableDungeonMapJson('{bad', 'Abbey Undercroft');
        expect(broken.ok).toBe(false);
        expect(broken.errors.length).toBeGreaterThan(0);

        const withAsset = parseEditableDungeonMapJson(
            serializeDungeonMapDocument({
                ...connectedArchitectMap,
                assets: [
                    ...connectedArchitectMap.assets,
                    {
                        id: 'new-rat',
                        kind: 'CREATURE',
                        name: 'Cellar Rat',
                        location: 'cellar-landing',
                        state: 'ACTIVE',
                        knowledge: 'KNOWN',
                        detail: 'Added via JSON.',
                        origin: 'INITIAL_MAP',
                    },
                ],
            }),
            'Abbey Undercroft',
        );
        expect(withAsset.ok).toBe(true);
        expect(withAsset.document.assets.some(asset => asset.id === 'new-rat')).toBe(true);

        const invalidBuilding = parseEditableDungeonMapJson(JSON.stringify({
            ...connectedArchitectMap,
            kind: 'INTERIOR',
            assets: [{
                id: 'shop', kind: 'BUILDING', name: 'Shop', location: 'cellar-landing',
                state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP',
            }],
        }), 'Abbey Undercroft');
        expect(invalidBuilding.ok).toBe(false);
        expect(invalidBuilding.errors.some(error => error.includes('allowed only on SETTLEMENT'))).toBe(true);

        const incompleteHost = parseEditableDungeonMapJson(JSON.stringify({
            ...connectedArchitectMap,
            kind: 'INTERIOR',
            hostSite: 'Rustport',
        }), 'Abbey Undercroft');
        expect(incompleteHost.ok).toBe(false);
        expect(incompleteHost.errors.some(error => error.includes('hostSite and hostBrief'))).toBe(true);

        const rejectedOldAliasWrite = parseEditableDungeonMapJson(JSON.stringify({
            ...connectedArchitectMap,
            kind: 'SETTLEMENT',
            assets: [{
                id: 'old-alias', kind: 'INTERIOR', name: 'Old Alias', location: 'cellar-landing',
                state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP',
            }],
        }), 'Abbey Undercroft');
        expect(rejectedOldAliasWrite.ok).toBe(false);
        expect(rejectedOldAliasWrite.errors.some(error => error.includes('asset kind must be one of'))).toBe(true);
    });
});
