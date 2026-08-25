import { describe, expect, it } from 'vitest';
import {
    buildDungeonMapGraph,
    layoutDungeonMapGraph,
    renderDungeonMapEmbedHtml,
    renderDungeonMapGraphSvg,
    renderDungeonMapReadableHtml,
    resolveDungeonGraphCurrentArea,
} from '../dungeon-map-graph.js';
import { collectAreaAssetIcons, MAP_ICON_MAX, MAP_ICON_SIZE, mapAssetIconMood, mapAssetIconToken, renderAreaAssetIconsSvg, renderDungeonGraphAssetTipHtml, renderDungeonGraphOverflowTipHtml } from '../dungeon-map-icons.js';
import { getLocationLeaf, resolveCurrentMapPlacement, resolveDungeonMapForLocation } from '../dungeon-reality.js';

const midExplorationMap = {
    version: 3,
    site: 'Abbey Undercroft',
    areas: [
        {
            id: 'cellar-landing',
            name: 'Cellar Landing',
            knowledge: 'VISITED',
            geometry: ['Low oak beams.'],
            connections: [
                { to: 'crypt-passage', state: 'OPEN', detail: 'Iron-banded door' },
                { to: 'flooded-vault', state: 'LOCKED', detail: 'Sealed grate' },
            ],
        },
        {
            id: 'crypt-passage',
            name: 'Crypt Passage',
            knowledge: 'VISITED',
            geometry: ['A collapsed arch.'],
            connections: [
                { to: 'cellar-landing', state: 'OPEN', detail: 'Iron-banded door' },
                { to: 'ossuary', state: 'OPEN', detail: 'Rotten tapestry' },
            ],
        },
        {
            id: 'flooded-vault',
            name: 'Flooded Vault',
            knowledge: 'DISCOVERED',
            geometry: ['Black water.'],
            connections: [
                { to: 'cellar-landing', state: 'LOCKED', detail: 'Sealed grate' },
                { to: 'reliquary', state: 'OPEN', detail: 'Submerged arch' },
            ],
        },
        {
            id: 'ossuary',
            name: 'Ossuary',
            knowledge: 'UNREVEALED',
            geometry: ['Stacked bones.'],
            connections: [
                { to: 'crypt-passage', state: 'OPEN', detail: 'Rotten tapestry' },
            ],
        },
        {
            id: 'reliquary',
            name: 'Reliquary',
            knowledge: 'UNREVEALED',
            geometry: ['A stone casket.'],
            connections: [
                { to: 'flooded-vault', state: 'OPEN', detail: 'Submerged arch' },
                { to: 'inner-sanctum', state: 'OPEN', detail: 'Hidden stair' },
            ],
        },
        {
            id: 'inner-sanctum',
            name: 'Inner Sanctum',
            knowledge: 'UNREVEALED',
            geometry: ['A forbidden altar.'],
            connections: [
                { to: 'reliquary', state: 'OPEN', detail: 'Hidden stair' },
            ],
        },
    ],
    assets: [
        {
            id: 'lantern',
            kind: 'OBJECT',
            name: 'Rusted lantern',
            location: 'cellar-landing',
            state: 'PRESENT',
            knowledge: 'KNOWN',
            detail: 'Still warm.',
            origin: 'INITIAL_MAP',
        },
        {
            id: 'ossuary-wight',
            kind: 'CREATURE',
            name: 'Ossuary wight',
            location: 'ossuary',
            state: 'ACTIVE',
            knowledge: 'UNREVEALED',
            detail: 'Bone dust in the air.',
            origin: 'INITIAL_MAP',
        },
        {
            id: 'casket-needle',
            kind: 'HAZARD',
            name: 'Casket needle',
            location: 'reliquary',
            state: 'ACTIVE',
            knowledge: 'UNREVEALED',
            detail: 'A poison pin.',
            origin: 'INITIAL_MAP',
        },
    ],
};

const morrowfenMap = {
    version: 3,
    site: 'Morrowfen',
    kind: 'SETTLEMENT',
    areas: [
        {
            id: 'lantern-gate',
            name: 'Lantern Gate',
            knowledge: 'VISITED',
            geometry: ['A fortified double-arch granite bridge.'],
            connections: [{ to: 'plank-market', state: 'OPEN', detail: 'A wooden rampway.' }],
        },
        {
            id: 'plank-market',
            name: 'Plank Market',
            knowledge: 'VISITED',
            geometry: ['Boardwalks over marsh water.'],
            connections: [
                { to: 'lantern-gate', state: 'OPEN', detail: 'A wooden rampway.' },
                { to: 'shrine-quarter', state: 'OPEN', detail: 'A stone-paved ramp.' },
            ],
        },
        {
            id: 'shrine-quarter',
            name: 'Shrine Quarter',
            knowledge: 'VISITED',
            geometry: ['An elevated terrace of chapels.'],
            connections: [{ to: 'plank-market', state: 'OPEN', detail: 'A stone-paved ramp.' }],
        },
    ],
    assets: [
        {
            id: 'chapel-of-the-drowned-stone',
            kind: 'OBJECT',
            name: 'Chapel of the Drowned Stone',
            location: 'shrine-quarter',
            state: 'PRESENT',
            knowledge: 'KNOWN',
            detail: 'A low stone chapel.',
            origin: 'PLAY',
        },
    ],
};

describe('dungeon map graph', () => {
    it('reads the deepest location segment as the current-area leaf', () => {
        expect(getLocationLeaf('Abbey Undercroft, Cellar Landing')).toBe('Cellar Landing');
        expect(getLocationLeaf('Abbey Undercroft :: Flooded Vault')).toBe('Flooded Vault');
    });

    it('hides unrevealed rooms except unlabeled fog stubs next to known areas', () => {
        const graph = buildDungeonMapGraph(midExplorationMap, {
            playerFacing: true,
            currentLocation: 'Abbey Undercroft, Crypt Passage',
        });
        const byId = Object.fromEntries(graph.nodes.map(node => [node.id, node]));
        expect(byId['cellar-landing']).toMatchObject({ revealed: true, fog: false, knowledge: 'VISITED' });
        expect(byId['crypt-passage']).toMatchObject({ revealed: true, current: true });
        expect(byId['flooded-vault']).toMatchObject({ revealed: true, knowledge: 'DISCOVERED' });
        expect(byId.ossuary).toMatchObject({ fog: true, revealed: false });
        expect(byId.reliquary).toMatchObject({ fog: true, revealed: false });
        expect(byId['inner-sanctum']).toBeUndefined();
        expect(graph.nodes).toHaveLength(5);
    });

    it('does not leak unrevealed names into the player-facing SVG', () => {
        const graph = buildDungeonMapGraph(midExplorationMap, {
            playerFacing: true,
            currentLocation: 'Abbey Undercroft, Cellar Landing',
        });
        const svg = renderDungeonMapGraphSvg(graph, { compact: true, siteRoot: 'Abbey Undercroft' });
        expect(svg).toContain('Cellar Landing');
        expect(svg).toContain('Crypt Passage');
        expect(svg).toContain('Flooded Vault');
        expect(svg).toContain('rt-dungeon-graph-node-current');
        expect(svg).not.toContain('Ossuary');
        expect(svg).not.toContain('ossuary');
        expect(svg).not.toContain('Reliquary');
        expect(svg).not.toContain('reliquary');
        expect(svg).not.toContain('Inner Sanctum');
        expect(svg).not.toContain('inner-sanctum');
        expect(svg).toContain('data-fog="1"');
    });

    it('keeps the full graph when playerFacing is off', () => {
        const graph = buildDungeonMapGraph(midExplorationMap, { playerFacing: false });
        expect(graph.nodes.map(node => node.id)).toEqual(expect.arrayContaining([
            'cellar-landing', 'ossuary', 'inner-sanctum',
        ]));
        expect(graph.nodes.every(node => node.revealed && !node.fog)).toBe(true);
    });

    it('lays out ranks from the entrance and keeps reciprocal routes as one edge', () => {
        const graph = buildDungeonMapGraph(midExplorationMap, { playerFacing: true });
        const layout = layoutDungeonMapGraph(graph, { compact: true });
        const landing = layout.nodes.find(node => node.id === 'cellar-landing');
        const crypt = layout.nodes.find(node => node.id === 'crypt-passage');
        expect(landing.x).toBeLessThan(crypt.x);
        expect(layout.edges.filter(edge =>
            (edge.from === 'cellar-landing' && edge.to === 'crypt-passage')
            || (edge.from === 'crypt-passage' && edge.to === 'cellar-landing')
        )).toHaveLength(1);
    });

    it('clips connection lines to node borders so they do not cross labels', () => {
        const graph = buildDungeonMapGraph(midExplorationMap, { playerFacing: true });
        const layout = layoutDungeonMapGraph(graph, { compact: true });
        const byId = Object.fromEntries(layout.nodes.map(node => [node.id, node]));
        const pointInsideNode = (x, y, node, inset = 0.75) => {
            if (node.fog) {
                return Math.hypot(x - node.cx, y - node.cy) < node.width / 2 - inset;
            }
            return x > node.x + inset
                && x < node.x + node.width - inset
                && y > node.y + inset
                && y < node.y + node.height - inset;
        };
        expect(layout.edges.length).toBeGreaterThan(0);
        for (const edge of layout.edges) {
            const from = byId[edge.from];
            const to = byId[edge.to];
            expect(pointInsideNode(edge.x1, edge.y1, from)).toBe(false);
            expect(pointInsideNode(edge.x1, edge.y1, to)).toBe(false);
            expect(pointInsideNode(edge.x2, edge.y2, from)).toBe(false);
            expect(pointInsideNode(edge.x2, edge.y2, to)).toBe(false);
            expect(Math.hypot(edge.x1 - from.cx, edge.y1 - from.cy))
                .toBeLessThan(Math.hypot(edge.x1 - to.cx, edge.y1 - to.cy));
            expect(Math.hypot(edge.x2 - to.cx, edge.y2 - to.cy))
                .toBeLessThan(Math.hypot(edge.x2 - from.cx, edge.y2 - from.cy));
        }
        const landing = byId['cellar-landing'];
        const crypt = byId['crypt-passage'];
        const corridor = layout.edges.find(edge =>
            (edge.from === 'cellar-landing' && edge.to === 'crypt-passage')
            || (edge.from === 'crypt-passage' && edge.to === 'cellar-landing'));
        const left = corridor.from === 'cellar-landing' ? corridor.x1 : corridor.x2;
        const right = corridor.from === 'cellar-landing' ? corridor.x2 : corridor.x1;
        expect(left).toBeGreaterThanOrEqual(landing.x + landing.width);
        expect(right).toBeLessThanOrEqual(crypt.x);
    });

    it('marks the current area from a footer location', () => {
        expect(resolveDungeonGraphCurrentArea(midExplorationMap, 'Abbey Undercroft, Flooded Vault'))
            .toBe('flooded-vault');
    });

    it('highlights the host district when the footer leaf is an occupying interior, not the entrance', () => {
        const location = 'Morrowfen, Shrine Quarter, Chapel of the Drowned Stone';
        expect(resolveDungeonGraphCurrentArea(morrowfenMap, location)).toBe('shrine-quarter');
        expect(resolveDungeonGraphCurrentArea(morrowfenMap, 'Chapel of the Drowned Stone')).toBe('shrine-quarter');
        const placement = resolveCurrentMapPlacement(morrowfenMap, location);
        expect(placement.area?.id).toBe('shrine-quarter');
        expect(placement.interiorAsset?.name).toBe('Chapel of the Drowned Stone');
        const graph = buildDungeonMapGraph(morrowfenMap, { playerFacing: true, currentLocation: location });
        const byId = Object.fromEntries(graph.nodes.map(node => [node.id, node]));
        expect(byId['shrine-quarter'].current).toBe(true);
        expect(byId['lantern-gate'].current).toBe(false);
        expect(graph.currentInteriorName).toBe('Chapel of the Drowned Stone');
        const svg = renderDungeonMapGraphSvg(graph, { compact: true, siteRoot: 'Morrowfen' });
        expect(svg).toContain('aria-label="Shrine Quarter (in Chapel of the Drowned Stone)"');
    });

    it('still highlights the parent district when the interior is not yet an asset', () => {
        const withoutChapel = { ...morrowfenMap, assets: [] };
        expect(resolveDungeonGraphCurrentArea(
            withoutChapel,
            'Morrowfen, Shrine Quarter, Chapel of the Drowned Stone',
        )).toBe('shrine-quarter');
        expect(resolveDungeonGraphCurrentArea(morrowfenMap, 'Morrowfen')).toBe('');
        expect(resolveDungeonGraphCurrentArea(morrowfenMap, '')).toBe('');
    });

    it('resolves a lorebook map attachment for the active footer site', () => {
        const root = {
            comment: 'Abbey Undercroft',
            content: `[CORE]Mapped.[/CORE]\n[MAP]\n${JSON.stringify(midExplorationMap)}\n[/MAP]`,
        };
        const resolved = resolveDungeonMapForLocation({ 0: root }, 'Abbey Undercroft, Crypt Passage', 'Campaign_Locations');
        expect(resolved.siteRoot).toBe('Abbey Undercroft');
        expect(resolved.document.areas).toHaveLength(6);
    });

    it('renders a pop-out placeholder instead of the compact graph when detached', () => {
        const graph = buildDungeonMapGraph(midExplorationMap, { playerFacing: true });
        const html = renderDungeonMapEmbedHtml(graph, { detached: true });
        expect(html).toContain('separate window');
        expect(html).toContain('rt-dungeon-map-reattach');
        expect(html).toContain('rt-dungeon-map-details');
        expect(html).toContain('Map Details');
        expect(html).not.toContain('rt-dungeon-alpha-tag');
        expect(html).not.toContain('rt-dungeon-graph-svg');
    });

    it('offers a site-details button on the compact Visuals/Map embed', () => {
        const graph = buildDungeonMapGraph(midExplorationMap, { playerFacing: true });
        const html = renderDungeonMapEmbedHtml(graph, { detached: false });
        expect(html).toContain('rt-dungeon-map-details');
        expect(html).toContain('Map Details');
        expect(html).toContain('rt-map-updater-direct-panel');
        expect(html).toContain('rt-map-updater-direct-bar');
        expect(html).toContain('rt-map-updater-direct-run');
        expect(html).not.toContain('rt-map-updater-run');
        expect(html).not.toContain('rt-dungeon-alpha-tag');
        expect(html).toContain('rt-dungeon-graph-scroll');
    });

    it('hides unrevealed rooms, interiors, and assets in the player-facing inspector', () => {
        const html = renderDungeonMapReadableHtml(midExplorationMap, { revealAll: false });
        expect(html).toContain('Cellar Landing');
        expect(html).toContain('Flooded Vault');
        expect(html).toContain('Rusted lantern');
        expect(html).toContain('Unexplored');
        expect(html).toContain('Rotten tapestry');
        expect(html).toContain('Not yet entered.');
        expect(html).not.toContain('Ossuary');
        expect(html).not.toContain('Reliquary');
        expect(html).not.toContain('Inner Sanctum');
        expect(html).not.toContain('Stacked bones');
        expect(html).not.toContain('Black water');
        expect(html).not.toContain('Ossuary wight');
        expect(html).not.toContain('Casket needle');
        expect(html).not.toContain('forbidden altar');
    });

    it('shows the full GM inspector when revealAll is on', () => {
        const html = renderDungeonMapReadableHtml(midExplorationMap, { revealAll: true });
        expect(html).toContain('Ossuary');
        expect(html).toContain('Reliquary');
        expect(html).toContain('Inner Sanctum');
        expect(html).toContain('Stacked bones');
        expect(html).toContain('Black water');
        expect(html).toContain('Ossuary wight');
        expect(html).toContain('Casket needle');
    });

    it('maps trap moods onto ARMED vs DEACTIVATED icon tokens', () => {
        expect(mapAssetIconMood('TRAP', 'ARMED')).toBe('ARMED');
        expect(mapAssetIconMood('TRAP', 'ACTIVE')).toBe('ARMED');
        expect(mapAssetIconMood('TRAP', 'DEACTIVATED')).toBe('DEACTIVATED');
        expect(mapAssetIconMood('TRAP', 'DISABLED')).toBe('DEACTIVATED');
        expect(mapAssetIconMood('TRAP', 'TRIGGERED')).toBe('TRIGGERED');
        expect(mapAssetIconToken({ kind: 'TRAP', state: 'ACTIVE' })).toBe('TRAP_ARMED');
        expect(mapAssetIconToken({ kind: 'TRAP', state: 'DEACTIVATED' })).toBe('TRAP_DEACTIVATED');
        expect(mapAssetIconToken({ kind: 'CREATURE', state: 'ACTIVE' })).toBe('CREATURE_LIVE');
        expect(mapAssetIconToken({ kind: 'CREATURE', state: 'DEAD' })).toBe('CREATURE_DEAD');
    });

    it('renders known asset icons under room labels and hides unrevealed ones', () => {
        const map = {
            version: 3,
            site: 'Abbey Undercroft',
            areas: [
                {
                    id: 'cellar-landing',
                    name: 'Cellar Landing',
                    knowledge: 'VISITED',
                    geometry: ['Low oak beams.'],
                    connections: [{ to: 'crypt-passage', state: 'OPEN', detail: 'Iron-banded door' }],
                },
                {
                    id: 'crypt-passage',
                    name: 'Crypt Passage',
                    knowledge: 'VISITED',
                    geometry: ['A collapsed arch.'],
                    connections: [
                        { to: 'cellar-landing', state: 'OPEN', detail: 'Iron-banded door' },
                        { to: 'ossuary', state: 'OPEN', detail: 'Rotten tapestry' },
                    ],
                },
                {
                    id: 'ossuary',
                    name: 'Ossuary',
                    knowledge: 'UNREVEALED',
                    geometry: ['Stacked bones.'],
                    connections: [{ to: 'crypt-passage', state: 'OPEN', detail: 'Rotten tapestry' }],
                },
            ],
            assets: [
                {
                    id: 'scorching-glyph',
                    kind: 'TRAP',
                    name: 'Scorching Glyph',
                    location: 'cellar-landing',
                    state: 'ARMED',
                    knowledge: 'KNOWN',
                    detail: 'Heat-rune on the threshold.',
                    origin: 'INITIAL_MAP',
                },
                {
                    id: 'folded-needle',
                    kind: 'TRAP',
                    name: 'Folded Needle',
                    location: 'crypt-passage',
                    state: 'DEACTIVATED',
                    knowledge: 'KNOWN',
                    detail: 'Pins folded back.',
                    origin: 'INITIAL_MAP',
                },
                {
                    id: 'hidden-wight',
                    kind: 'CREATURE',
                    name: 'Ossuary wight',
                    location: 'ossuary',
                    state: 'ACTIVE',
                    knowledge: 'UNREVEALED',
                    detail: 'Bone dust in the air.',
                    origin: 'INITIAL_MAP',
                },
                {
                    id: 'suspected-plate',
                    kind: 'TRAP',
                    name: 'Pressure Plate',
                    location: 'crypt-passage',
                    state: 'ARMED',
                    knowledge: 'SUSPECTED',
                    detail: 'The flagstone sits proud.',
                    origin: 'INITIAL_MAP',
                },
            ],
        };
        expect(collectAreaAssetIcons(map.assets, 'cellar-landing', { playerFacing: true }).map(icon => icon.token))
            .toEqual(['TRAP_ARMED']);
        expect(collectAreaAssetIcons(map.assets, 'ossuary', { playerFacing: true })).toEqual([]);
        expect(collectAreaAssetIcons(map.assets, 'ossuary', { playerFacing: false }).map(icon => icon.token))
            .toEqual(['CREATURE_LIVE']);

        const playerGraph = buildDungeonMapGraph(map, { playerFacing: true, currentLocation: 'Abbey Undercroft, Cellar Landing' });
        const byId = Object.fromEntries(playerGraph.nodes.map(node => [node.id, node]));
        expect(byId['cellar-landing'].icons.map(icon => icon.token)).toEqual(['TRAP_ARMED']);
        expect(byId['crypt-passage'].icons.map(icon => icon.token)).toEqual(['TRAP_DEACTIVATED', 'TRAP_ARMED']);
        expect(byId.ossuary.icons).toEqual([]);

        const playerSvg = renderDungeonMapGraphSvg(playerGraph, { compact: true, siteRoot: 'Abbey Undercroft' });
        expect(playerSvg).toContain('data-icon="TRAP_ARMED"');
        expect(playerSvg).toContain('data-icon="TRAP_DEACTIVATED"');
        expect(playerSvg).toContain('data-asset-name="Scorching Glyph"');
        expect(playerSvg).toContain('data-asset-state="ARMED"');
        expect(playerSvg).toContain('rt-dungeon-graph-icon-trap');
        expect(playerSvg).toContain('rt-dungeon-graph-icon-art');
        expect(playerSvg).toContain('fill="currentColor"');
        expect(playerSvg).not.toContain('mask-image:url(');
        expect(playerSvg).not.toContain('style="');
        expect(playerSvg).not.toMatch(/rt-dungeon-graph-node[^>]*>\s*<title>/);
        expect(playerSvg).not.toMatch(/rt-dungeon-graph-icon[\s\S]*?<title>/);
        expect(playerSvg).not.toContain('data-icon="CREATURE_LIVE"');
        expect(playerSvg).not.toContain('Ossuary wight');

        const layout = layoutDungeonMapGraph(playerGraph, { compact: true });
        const landing = layout.nodes.find(node => node.id === 'cellar-landing');
        const fog = layout.nodes.find(node => node.id === 'ossuary');
        expect(landing.height).toBeGreaterThan(36);
        expect(landing.iconY - landing.labelY).toBeCloseTo(13 / 2 + 3 + 16.9 / 2);
        expect(playerSvg).toContain(`scale(${MAP_ICON_SIZE.compact / 12})`);
        expect(fog.height).toBe(18);

        const gmGraph = buildDungeonMapGraph(map, { playerFacing: false });
        const gmSvg = renderDungeonMapGraphSvg(gmGraph, { compact: false });
        expect(gmSvg).toContain('data-icon="CREATURE_LIVE"');
        expect(gmSvg).toContain('rt-dungeon-graph-icon-creature');
        expect(gmSvg).toContain('rt-dungeon-graph-icon-unrevealed');
    });

    it('renders an inspector-matching asset hover card', () => {
        const html = renderDungeonGraphAssetTipHtml({
            name: 'Scorching Glyph',
            kind: 'TRAP',
            state: 'ARMED',
            knowledge: 'KNOWN',
            detail: 'Heat-rune on the threshold.',
        });
        expect(html).toContain('Scorching Glyph');
        expect(html).toContain('rt-dungeon-map-tag');
        expect(html).toContain('TRAP');
        expect(html).toContain('ARMED');
        expect(html).toContain('KNOWN');
        expect(html).toContain('Heat-rune on the threshold.');
        expect(renderDungeonGraphAssetTipHtml({ name: 'Pack', kind: 'GROUP', count: 6 })).toContain('×6');
    });

    it('caps visible node icons and embeds overflow assets for hover tips', () => {
        const icons = Array.from({ length: 8 }, (_, index) => ({
            token: 'CREATURE_LIVE',
            kind: 'CREATURE',
            mood: 'LIVE',
            knowledge: 'KNOWN',
            state: 'ACTIVE',
            name: `Occupant ${index + 1}`,
            detail: `Detail ${index + 1}`,
            count: null,
        }));
        const svg = renderAreaAssetIconsSvg(icons, { cx: 70, y: 30, compact: true });
        expect(MAP_ICON_MAX.compact).toBe(5);
        expect(svg.match(/data-icon="/g)).toHaveLength(5);
        expect(svg).toContain('rt-dungeon-graph-icon-overflow');
        expect(svg).toContain('+3');
        expect(svg).toContain('data-overflow-assets');
        expect(svg).toContain('Occupant 6');
        expect(svg).not.toContain('data-asset-name="Occupant 6"');

        const overflowHtml = renderDungeonGraphOverflowTipHtml(icons.slice(MAP_ICON_MAX.compact));
        expect(overflowHtml).toContain('Occupant 6');
        expect(overflowHtml).toContain('Occupant 8');
        expect(overflowHtml).toContain('rt-dungeon-graph-overflow-tip-item');
        expect(overflowHtml.match(/rt-dungeon-graph-asset-tip-head/g)).toHaveLength(3);
    });

    it('renders knowledge-filtered BUILDING contents beneath the container and on its district node', () => {
        const map = {
            version: 3, site: 'Ashford', kind: 'SETTLEMENT',
            areas: [{ id: 'north', name: 'North Residential Streets', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [
                { id: 'house', kind: 'BUILDING', name: 'Residential House', location: 'north', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP', notEntered: false },
                { id: 'caretaker', kind: 'CREATURE', name: 'Caretaker', location: 'house', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'NARRATOR_ESTABLISHED' },
                { id: 'rumored-cache', kind: 'LOOT', name: 'Rumored Cache', location: 'house', state: 'AVAILABLE', knowledge: 'SUSPECTED', detail: '', origin: 'NARRATOR_ESTABLISHED' },
                { id: 'hidden-snare', kind: 'TRAP', name: 'Hidden Snare', location: 'house', state: 'ARMED', knowledge: 'UNREVEALED', detail: '', origin: 'NARRATOR_ESTABLISHED' },
            ],
        };
        const html = renderDungeonMapReadableHtml(map, { revealAll: false });
        expect(html.indexOf('Caretaker')).toBeGreaterThan(html.indexOf('Residential House'));
        expect(html).toContain('Rumored Cache');
        expect(html).not.toContain('Hidden Snare');
        const graph = buildDungeonMapGraph(map, { playerFacing: true, currentLocation: 'Ashford, North Residential Streets, Residential House' });
        expect(graph.nodes[0].icons.map(icon => icon.kind)).toEqual(['CREATURE', 'BUILDING', 'LOOT']);
        expect(graph.currentInteriorName).toBe('Residential House');
    });

    it('does not recurse forever when asset containment loops', () => {
        const map = {
            version: 3, site: 'Loop Site', kind: 'DUNGEON',
            areas: [{ id: 'hall', name: 'Hall', knowledge: 'VISITED', geometry: [], connections: [] }],
            assets: [
                { kind: 'OBJECT', name: 'Nameless A', location: 'hall', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' },
                { kind: 'OBJECT', name: 'Nameless B', location: 'hall', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' },
                { id: 'hall', kind: 'GROUP', name: 'Hall Pack', location: 'hall', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' },
                { id: 'alpha', kind: 'CREATURE', name: 'Alpha', location: 'hall', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' },
                { id: 'beta', kind: 'CREATURE', name: 'Beta', location: 'alpha', state: 'ACTIVE', knowledge: 'KNOWN', detail: '', origin: 'INITIAL_MAP' },
            ],
        };
        const html = renderDungeonMapReadableHtml(map, { revealAll: true });
        expect(html).toContain('Nameless A');
        expect(html).toContain('Nameless B');
        expect(html).toContain('Hall Pack');
        expect(html).toContain('Alpha');
        expect(html).toContain('Beta');
        expect(html.indexOf('Beta')).toBeGreaterThan(html.indexOf('Alpha'));
    });
});
