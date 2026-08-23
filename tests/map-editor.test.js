import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    MAP_EDITOR_PACKAGE_FORMAT,
    MapEditorHistory,
    allocateMapEditorId,
    areaDeletionBlockers,
    createMapEditorDocument,
    createPortableMapPackage,
    parsePortableMapPackage,
    validateMapEditorDocument,
} from '../map-editor-lib.js';

function connectedMap() {
    return {
        version: 3,
        site: 'Copper Vault',
        kind: 'DUNGEON',
        threat: 'HIGH',
        areas: [
            { id: 'entry', name: 'Entry', knowledge: 'VISITED', geometry: ['Stone stairs.'], connections: [{ to: 'hall', state: 'OPEN', detail: 'An arch.' }] },
            { id: 'hall', name: 'Hall', knowledge: 'UNREVEALED', geometry: [], connections: [{ to: 'entry', state: 'OPEN', detail: 'An arch.' }] },
        ],
        assets: [{ id: 'chest', kind: 'OBJECT', name: 'Chest', location: 'hall', state: 'LOCKED', knowledge: 'UNREVEALED', detail: '', origin: 'INITIAL_MAP' }],
    };
}

describe('graphical map editor domain', () => {
    it('creates a valid one-area from-scratch draft and allocates stable IDs', () => {
        const map = createMapEditorDocument({ site: 'New Harbor', kind: 'SETTLEMENT', entrance: 'Market Ward' });
        expect(validateMapEditorDocument(map, { site: 'New Harbor' }).valid).toBe(true);
        expect(allocateMapEditorId(map, 'Market Ward', 'area')).toBe('market-ward-2');
    });

    it('strictly rejects broken references instead of normalizing them', () => {
        const map = connectedMap();
        map.assets[0].location = 'missing';
        map.areas[0].connections[0].to = 'missing';
        const result = validateMapEditorDocument(map, { site: map.site });
        expect(result.valid).toBe(false);
        expect(result.errors.map(error => error.code)).toContain('UNKNOWN_CONNECTION_TARGET');
        expect(result.errors.map(error => error.code)).toContain('INVALID_ASSET_LOCATION');
    });

    it('supports legal containers and blocks deleting occupied/connected areas', () => {
        const map = connectedMap();
        map.kind = 'SETTLEMENT';
        map.assets.push({ id: 'inn', kind: 'BUILDING', name: 'Inn', location: 'hall', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP', notEntered: true });
        map.assets.push({ id: 'keeper', kind: 'CREATURE', name: 'Keeper', location: 'inn', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' });
        expect(validateMapEditorDocument(map, { site: map.site }).valid).toBe(true);
        expect(areaDeletionBlockers(map, 'hall')).toEqual(expect.arrayContaining([expect.stringContaining('routes'), expect.stringContaining('assets')]));
    });

    it('locks host identity and linked gateways on existing maps', () => {
        const original = connectedMap();
        original.hostSite = 'Old City';
        original.hostBrief = 'Contained in Old City.';
        original.assets.push({ id: 'peer', kind: 'SUBDUNGEON', name: 'Deep Mine', location: 'hall', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' });
        const edited = structuredClone(original);
        edited.hostSite = 'New City';
        edited.assets.find(asset => asset.id === 'peer').name = 'Renamed Mine';
        const result = validateMapEditorDocument(edited, { site: original.site, originalDocument: original, linkedGatewayIds: ['peer'] });
        expect(result.errors.map(error => error.code)).toEqual(expect.arrayContaining(['HOST_LOCKED', 'LINKED_GATEWAY_LOCKED']));
    });

    it('keeps bounded undo/redo state and a saved dirty marker', () => {
        const history = new MapEditorHistory({ value: 1 }, 3);
        history.push({ value: 2 });
        history.push({ value: 3 });
        expect(history.dirty).toBe(true);
        expect(history.undo()).toEqual({ value: 2 });
        expect(history.redo()).toEqual({ value: 3 });
        history.markSaved();
        expect(history.dirty).toBe(false);
    });

    it('exports portable metadata, strips runtime binding/provenance, and rebinds imports', () => {
        const map = connectedMap();
        map.hostSite = 'Parent';
        map.hostBrief = 'Hosted.';
        map.assets[0].cause = 'Campaign event';
        map.assets[0].actor = 'party';
        map.assets[0].changed_at = 'Day 4';
        const pkg = createPortableMapPackage(map, { core: 'A reusable vault.', keywords: ['vault'] });
        expect(pkg.format).toBe(MAP_EDITOR_PACKAGE_FORMAT);
        expect(pkg.map.hostSite).toBeUndefined();
        expect(pkg.map.assets[0].cause).toBeUndefined();
        const imported = parsePortableMapPackage(JSON.stringify(pkg), { site: 'Shared Vault' });
        expect(imported.ok).toBe(true);
        expect(imported.package.map.site).toBe('Shared Vault');
        expect(imported.package.location.core).toBe('A reusable vault.');
    });

    it('wires the dedicated GUI, campaign writer, and all entry points', () => {
        const ui = readFileSync(new URL('../src/ui/panel/map-editor.js', import.meta.url), 'utf8');
        const panel = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
        const inspector = readFileSync(new URL('../src/ui/panel/dungeon-map-panel.js', import.meta.url), 'utf8');
        const router = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
        expect(ui).toContain('export async function openMapEditor');
        expect(ui).toContain("event.target.dataset.field === 'site'");
        expect(ui).toContain('paintValidation(preview)');
        expect(ui).toContain('data-edge-from');
        expect(ui).toContain('startConnectionDrag');
        expect(ui).toContain('data-node-action="add-asset"');
        expect(ui).toContain('data-node-action="add-connected"');
        expect(ui).toContain('Import package / JSON');
        expect(panel).toContain('rt-loc-map-editor-btn');
        expect(panel).toContain('rt-dungeon-map-editor-create');
        expect(inspector).toContain('rt-dungeon-map-edit');
        expect(router).toContain('export async function persistMapEditorDocument');
        expect(router).toContain('expectedMap');
        expect(router).toContain('resolveHostedCreationContext');
    });
});
