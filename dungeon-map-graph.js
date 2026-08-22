/**
 * Knowledge-filtered node graph for Visuals/Map.
 * Player-facing views hide UNREVEALED rooms except as unlabeled fog stubs
 * adjacent to a discovered or visited area.
 */

import {
    normalizeDungeonMapDocument,
    resolveAssetEffectiveArea,
    resolveCurrentMapPlacement,
} from './dungeon-reality.js';
import {
    MAP_NODE_FONT,
    collectAreaAssetIcons,
    mapNodeIconMetrics,
    renderAreaAssetIconsSvg,
} from './dungeon-map-icons.js';

function escapeXml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeHtml(value) {
    return escapeXml(value).replace(/'/g, '&#039;');
}

function truncateLabel(name, max = 18) {
    const text = String(name || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(1, max - 1))}…`;
}

function uniqueConnectionEdges(areas) {
    const edges = [];
    const seen = new Set();
    const areasById = new Map(areas.map(area => [area.id, area]));
    for (const area of areas) {
        for (const connection of area.connections || []) {
            const target = areasById.get(connection.to);
            if (!target) continue;
            const pairKey = [area.id, target.id].sort().join('|');
            const key = `${pairKey}:${connection.state}:${connection.detail || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({
                from: area.id,
                to: target.id,
                state: connection.state || 'OPEN',
                detail: String(connection.detail || '').trim(),
            });
        }
    }
    return edges;
}

/** Match a footer/lore location to an area ID. Interiors that are assets resolve to their host area. */
export function resolveDungeonGraphCurrentArea(document, currentLocation = '') {
    const map = normalizeDungeonMapDocument(document, document?.site);
    return resolveCurrentMapPlacement(map, currentLocation).area?.id || '';
}

/**
 * Convert a v3 map document into a drawable graph.
 * @param {object} document
 * @param {{ playerFacing?: boolean, currentLocation?: string }} [options]
 */
export function buildDungeonMapGraph(document, { playerFacing = true, currentLocation = '' } = {}) {
    const map = normalizeDungeonMapDocument(document, document?.site);
    const currentPlacement = resolveCurrentMapPlacement(map, currentLocation);
    const currentAreaId = currentPlacement.area?.id || '';
    const areasById = new Map(map.areas.map(area => [area.id, area]));
    const known = new Set();
    for (const area of map.areas) {
        if (!playerFacing || area.knowledge === 'VISITED' || area.knowledge === 'DISCOVERED') {
            known.add(area.id);
        }
    }
    const fog = new Set();
    if (playerFacing) {
        for (const id of known) {
            for (const connection of areasById.get(id)?.connections || []) {
                const target = areasById.get(connection.to);
                if (target && !known.has(target.id) && target.knowledge === 'UNREVEALED') {
                    fog.add(target.id);
                }
            }
        }
    }
    const visibleIds = new Set([...known, ...fog]);
    const effectiveAssets = map.assets.map(asset => ({
        ...asset,
        location: resolveAssetEffectiveArea(map, asset)?.id || asset.location,
    }));
    const nodes = map.areas
        .filter(area => visibleIds.has(area.id))
        .map(area => {
            const fogged = fog.has(area.id);
            const icons = fogged
                ? []
                : collectAreaAssetIcons(effectiveAssets, area.id, { playerFacing });
            return {
                id: area.id,
                name: area.name,
                knowledge: area.knowledge,
                fog: fogged,
                revealed: known.has(area.id),
                current: area.id === currentAreaId,
                entrance: map.areas[0]?.id === area.id,
                icons,
            };
        });
    const edges = uniqueConnectionEdges(map.areas).filter(edge =>
        visibleIds.has(edge.from) && visibleIds.has(edge.to));
    return {
        site: map.site,
        currentAreaId,
        currentInteriorName: currentPlacement.interiorAsset?.name || currentPlacement.unmatchedInterior || '',
        nodes,
        edges,
    };
}

function bfsRanks(nodes, edges, rootId) {
    const ids = new Set(nodes.map(node => node.id));
    const adj = new Map(nodes.map(node => [node.id, []]));
    for (const edge of edges) {
        if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
        adj.get(edge.from).push(edge.to);
        adj.get(edge.to).push(edge.from);
    }
    const rank = new Map();
    if (!rootId || !ids.has(rootId)) return rank;
    const queue = [rootId];
    rank.set(rootId, 0);
    while (queue.length) {
        const id = queue.shift();
        for (const next of adj.get(id) || []) {
            if (rank.has(next)) continue;
            rank.set(next, rank.get(id) + 1);
            queue.push(next);
        }
    }
    return rank;
}

/**
 * Layered left-to-right layout from the entrance (or current / first node).
 * @param {{ nodes: object[], edges: object[] }} graph
 * @param {{ compact?: boolean }} [options]
 */
export function layoutDungeonMapGraph(graph, { compact = true } = {}) {
    const nodeWidth = compact ? 140 : 192;
    const nodeHeight = compact ? 36 : 47;
    const iconMetrics = mapNodeIconMetrics(compact);
    const fogSize = compact ? 18 : 22;
    const rankGap = compact ? 56 : 84;
    const nodeGap = compact ? 10 : 16;
    const padding = compact ? 14 : 24;
    const nodes = graph.nodes || [];
    const edges = graph.edges || [];
    const root = nodes.find(node => node.entrance && node.revealed)
        || nodes.find(node => node.current)
        || nodes.find(node => node.revealed)
        || nodes[0];
    const ranks = bfsRanks(nodes, edges, root?.id);
    const layers = new Map();
    let maxRank = 0;
    for (const node of nodes) {
        const rank = ranks.has(node.id) ? ranks.get(node.id) : 0;
        maxRank = Math.max(maxRank, rank);
        if (!layers.has(rank)) layers.set(rank, []);
        layers.get(rank).push(node);
    }
    for (const layer of layers.values()) {
        layer.sort((a, b) => {
            if (a.fog !== b.fog) return a.fog ? 1 : -1;
            return String(a.name).localeCompare(String(b.name));
        });
    }
    const positioned = [];
    const byId = new Map();
    let maxBottom = padding;
    for (const [rank, layer] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
        let y = padding;
        layer.forEach((node) => {
            const width = node.fog ? fogSize : nodeWidth;
            const hasIcons = !node.fog && (node.icons || []).length > 0;
            const height = node.fog ? fogSize : (hasIcons ? iconMetrics.height : nodeHeight);
            const x = padding + rank * (nodeWidth + rankGap) + (nodeWidth - width) / 2;
            const placed = {
                ...node,
                x,
                y,
                width,
                height,
                cx: x + width / 2,
                cy: y + height / 2,
                labelY: hasIcons ? y + iconMetrics.labelYOffset : y + height / 2,
                iconY: hasIcons ? y + iconMetrics.iconYOffset : y + height / 2,
            };
            positioned.push(placed);
            byId.set(node.id, placed);
            maxBottom = Math.max(maxBottom, y + height);
            y += height + nodeGap;
        });
    }
    const width = padding * 2 + (maxRank + 1) * nodeWidth + maxRank * rankGap;
    const height = Math.max(maxBottom + padding, padding * 2 + nodeHeight);
    const laidEdges = edges
        .map(edge => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            if (!from || !to) return null;
            const clipped = clipEdgeToNodeBorders(from, to);
            return {
                ...edge,
                x1: clipped.x1,
                y1: clipped.y1,
                x2: clipped.x2,
                y2: clipped.y2,
            };
        })
        .filter(Boolean);
    return { nodes: positioned, edges: laidEdges, width, height, compact };
}

/** Keep connectors just outside the node stroke so they never cross labels. */
const EDGE_NODE_GAP = 2.5;

function nodeExitPoint(node, towardX, towardY, gap = EDGE_NODE_GAP) {
    const dx = towardX - node.cx;
    const dy = towardY - node.cy;
    const length = Math.hypot(dx, dy);
    if (!length) return { x: node.cx, y: node.cy };
    let t;
    if (node.fog) {
        t = (node.width / 2) / length;
    } else {
        const scaleX = node.width ? Math.abs(dx) / (node.width / 2) : Infinity;
        const scaleY = node.height ? Math.abs(dy) / (node.height / 2) : Infinity;
        const scale = Math.max(scaleX, scaleY);
        t = scale ? 1 / scale : 0;
    }
    const extra = gap / length;
    return {
        x: node.cx + dx * (t + extra),
        y: node.cy + dy * (t + extra),
    };
}

function clipEdgeToNodeBorders(from, to) {
    const start = nodeExitPoint(from, to.cx, to.cy);
    const end = nodeExitPoint(to, from.cx, from.cy);
    const along = (end.x - start.x) * (to.cx - from.cx) + (end.y - start.y) * (to.cy - from.cy);
    if (along > 0) return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    const tightStart = nodeExitPoint(from, to.cx, to.cy, 0);
    const tightEnd = nodeExitPoint(to, from.cx, from.cy, 0);
    return { x1: tightStart.x, y1: tightStart.y, x2: tightEnd.x, y2: tightEnd.y };
}

function nodeClass(node) {
    const parts = ['rt-dungeon-graph-node'];
    if (node.fog) parts.push('rt-dungeon-graph-node-fog');
    else parts.push(`rt-dungeon-graph-node-${String(node.knowledge || '').toLowerCase()}`);
    if (node.current) parts.push('rt-dungeon-graph-node-current');
    if (node.revealed) parts.push('rt-dungeon-graph-node-revealed');
    return parts.join(' ');
}

/**
 * Render a player-facing (or full) graph as inline SVG.
 * @param {object} graph from buildDungeonMapGraph
 * @param {{ compact?: boolean, siteRoot?: string }} [options]
 */
export function renderDungeonMapGraphSvg(graph, { compact = true, siteRoot = '' } = {}) {
    const layout = layoutDungeonMapGraph(graph, { compact });
    if (!layout.nodes.length) {
        return '<div class="rt-dungeon-graph-empty">No revealed rooms yet.</div>';
    }
    const fontSize = compact ? MAP_NODE_FONT.compact : MAP_NODE_FONT.expanded;
    const edges = layout.edges.map(edge => {
        const title = escapeXml([edge.state, edge.detail].filter(Boolean).join(' — '));
        const stateClass = `rt-dungeon-graph-edge rt-dungeon-graph-edge-${String(edge.state || 'OPEN').toLowerCase()}`;
        return `<line class="${stateClass}" x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}"><title>${title}</title></line>`;
    }).join('');
    const nodes = layout.nodes.map(node => {
        const label = node.fog ? '?' : truncateLabel(node.name, compact ? 16 : 22);
        const path = !node.fog && siteRoot
            ? `${siteRoot} :: ${node.name}`
            : '';
        const attrs = [
            `class="${nodeClass(node)}"`,
            node.fog ? 'data-fog="1" aria-hidden="true"' : `data-area-id="${escapeXml(node.id)}" data-area-path="${escapeXml(path)}" role="button" tabindex="0"`,
        ];
        const here = node.current
            ? (graph.currentInteriorName ? ` (in ${graph.currentInteriorName})` : ' (you are here)')
            : '';
        if (!node.fog) attrs.push(`aria-label="${escapeXml(`${node.name}${here}`)}"`);
        const shape = node.fog
            ? `<circle cx="${node.cx}" cy="${node.cy}" r="${node.width / 2}"></circle>`
            : `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="6"></rect>`;
        const textY = node.labelY ?? node.cy;
        const icons = node.fog || !(node.icons || []).length
            ? ''
            : renderAreaAssetIconsSvg(node.icons, { cx: node.cx, y: node.iconY, compact });
        return `<g ${attrs.join(' ')}>${shape}<text x="${node.cx}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}">${escapeXml(label)}</text>${icons}</g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" class="rt-dungeon-graph-svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}" role="img" draggable="false" aria-label="${escapeXml(graph.site || 'Site map')}">${edges}${nodes}</svg>`;
}

/**
 * Compact Visuals/Map embed, or a reattach placeholder when the map is popped out.
 * @param {object} graph
 * @param {{ detached?: boolean, siteRoot?: string }} [options]
 */
export function renderDungeonMapEmbedHtml(graph, { detached = false, siteRoot = '' } = {}) {
    if (!graph?.nodes?.length) return '';
    const site = escapeXml(graph.site || 'Mapped site');
    if (detached) {
        return `<div class="rt-immersion-map rt-immersion-map-popped">
            <div class="rt-immersion-section-label"><span>Site map</span></div>
            <div class="rt-immersion-map-popped-body">
                <span>${site} is open in a separate window.</span>
                <span class="rt-dungeon-map-label-actions">
                    <button type="button" class="rt-dungeon-map-details" title="Open map details" aria-label="Open map details">Map Details</button>
                    <button type="button" class="rt-dungeon-map-reattach rpg-tracker-icon-btn" title="Reattach site map">Reattach</button>
                </span>
            </div>
        </div>`;
    }
    return `<div class="rt-immersion-map">
        <div class="rt-immersion-section-label">
            <span>Site map</span>
            <span class="rt-dungeon-map-label-actions">
                <button type="button" class="rt-dungeon-map-details" title="Open map details" aria-label="Open map details">Map Details</button>
                <button type="button" class="rt-dungeon-map-detach rpg-tracker-icon-btn" title="Open map in a separate window" aria-label="Open map in a separate window">⧉</button>
            </span>
        </div>
        <div class="rt-dungeon-graph-scroll">${renderDungeonMapGraphSvg(graph, { compact: true, siteRoot: siteRoot || graph.site })}</div>
    </div>`;
}

function isPlayerVisibleArea(area) {
    return area?.knowledge === 'VISITED' || area?.knowledge === 'DISCOVERED';
}

function isPlayerVisibleAsset(asset) {
    const knowledge = String(asset?.knowledge || '').toUpperCase();
    return knowledge && knowledge !== 'UNREVEALED';
}

function areaDisplayName(id, revealAll, visibleIds, areasById) {
    if (revealAll || visibleIds.has(id)) {
        return areasById.get(id)?.name || id;
    }
    return 'Unexplored';
}

/**
 * Readable area/asset inspector HTML. When revealAll is false, UNREVEALED
 * rooms and assets are omitted; routes into the fog become "Unexplored".
 * @param {object} mapDocument
 * @param {{ revealAll?: boolean }} [options]
 */
export function renderDungeonMapReadableHtml(mapDocument, { revealAll = true } = {}) {
    const map = normalizeDungeonMapDocument(mapDocument, mapDocument?.site);
    const areas = map.areas;
    const assets = map.assets;
    const visibleAreas = revealAll ? areas : areas.filter(isPlayerVisibleArea);
    const visibleIds = new Set(visibleAreas.map(area => area.id));
    const areasById = new Map(areas.map(area => [area.id, area]));
    const visibleAssets = revealAll ? assets : assets.filter(asset => {
        if (!isPlayerVisibleAsset(asset)) return false;
        if (!asset.location) return true;
        return visibleIds.has(resolveAssetEffectiveArea(map, asset)?.id);
    });
    const renderTag = (value, className = '') => `<span class="rt-dungeon-map-tag ${className}">${escapeHtml(value)}</span>`;
    const renderAsset = (asset) => {
        const metadata = [];
        if (asset.behavior) metadata.push(`<b>Behavior:</b> ${escapeHtml(asset.behavior)}`);
        if (asset.route?.length) {
            metadata.push(`<b>Route:</b> ${asset.route.map(id => escapeHtml(areaDisplayName(id, revealAll, visibleIds, areasById))).join(' &rarr; ')}`);
        }
        if (asset.faction) metadata.push(`<b>Faction:</b> ${escapeHtml(asset.faction)}`);
        if (Number.isInteger(asset.count)) metadata.push(`<b>Count:</b> ${escapeHtml(String(asset.count))}`);
        if (asset.owner) metadata.push(`<b>Owner:</b> ${escapeHtml(asset.owner)}`);
        if (asset.duration) metadata.push(`<b>Duration:</b> ${escapeHtml(asset.duration)}`);
        if (asset.origin && asset.origin !== 'INITIAL_MAP') metadata.push(`<b>Origin:</b> ${escapeHtml(asset.origin)}`);
        if (asset.actor) metadata.push(`<b>Actor:</b> ${escapeHtml(asset.actor)}`);
        if (asset.cause) metadata.push(`<b>Cause:</b> ${escapeHtml(asset.cause)}`);
        if (asset.changed_at) metadata.push(`<b>Since:</b> ${escapeHtml(asset.changed_at)}`);
        if (asset.last_location) {
            metadata.push(`<b>Last location:</b> ${escapeHtml(areaDisplayName(asset.last_location, revealAll, visibleIds, areasById))}`);
        }
        const children = visibleAssets.filter(candidate => candidate.location === asset.id);
        return `<div class="rt-dungeon-map-asset">
                    <div class="rt-dungeon-map-asset-head"><i class="fa-solid fa-diamond"></i><strong>${escapeHtml(asset.name)}</strong>${renderTag(asset.kind)}${renderTag(asset.state, 'rt-dungeon-map-state')}${renderTag(asset.knowledge, 'rt-dungeon-map-knowledge')}</div>
                    ${asset.detail ? `<div class="rt-dungeon-map-asset-detail">${escapeHtml(asset.detail)}</div>` : ''}
                    ${metadata.length ? `<div class="rt-dungeon-map-asset-meta">${metadata.join('<span class="rt-dungeon-map-meta-sep">&bull;</span>')}</div>` : ''}
                    ${children.length ? `<div class="rt-dungeon-map-assets rt-dungeon-map-contained">${children.map(renderAsset).join('')}</div>` : ''}
                </div>`;
    };
    const renderArea = (area) => {
        const areaAssets = visibleAssets.filter(asset => asset.location === area.id);
        const showGeometry = revealAll || area.knowledge === 'VISITED';
        const geometry = showGeometry && area.geometry?.length
            ? `<ul class="rt-dungeon-map-geometry">${area.geometry.map(fact => `<li>${escapeHtml(fact)}</li>`).join('')}</ul>`
            : `<div class="rt-dungeon-map-empty">${showGeometry ? 'No structural notes.' : 'Not yet entered.'}</div>`;
        const connections = (area.connections || []).length
            ? `<div class="rt-dungeon-map-connections"><span class="rt-dungeon-map-section-label">Routes</span>${area.connections.map(connection => {
                const name = areaDisplayName(connection.to, revealAll, visibleIds, areasById);
                const detail = connection.detail || '';
                return `<span class="rt-dungeon-map-route"><i class="fa-solid fa-arrow-right"></i>${escapeHtml(name)}${renderTag(connection.state)}${detail ? `<span class="rt-dungeon-map-route-detail">${escapeHtml(detail)}</span>` : ''}</span>`;
            }).join('')}</div>`
            : '';
        return `<section class="rt-dungeon-map-area">
                    <div class="rt-dungeon-map-area-head"><i class="fa-solid fa-location-dot"></i><strong>${escapeHtml(area.name)}</strong>${renderTag(area.knowledge, 'rt-dungeon-map-knowledge')}</div>
                    <div class="rt-dungeon-map-section-label">Geometry &amp; prose</div>
                    ${geometry}
                    ${connections}
                    ${areaAssets.length ? `<div class="rt-dungeon-map-assets"><span class="rt-dungeon-map-section-label">Assets (${areaAssets.length})</span>${areaAssets.map(renderAsset).join('')}</div>` : ''}
                </section>`;
    };
    const unplaced = visibleAssets.filter(asset => (!asset.location || (!areasById.has(asset.location) && !assets.some(parent => parent.id === asset.location))));
    if (!visibleAreas.length && !unplaced.length) {
        return '<div class="rt-dungeon-map-empty">No revealed rooms yet.</div>';
    }
    return `<div class="rt-dungeon-map-summary">
                    <span>${renderTag(`${visibleAreas.length} areas`)}</span>
                    <span>${renderTag(`${visibleAssets.length} assets`)}</span>
                </div>
                <div class="rt-dungeon-map-area-list">${visibleAreas.map(renderArea).join('')}</div>
                ${unplaced.length ? `<section class="rt-dungeon-map-area rt-dungeon-map-unplaced"><div class="rt-dungeon-map-area-head"><i class="fa-solid fa-box-archive"></i><strong>Removed / unplaced assets</strong></div>${unplaced.map(renderAsset).join('')}</section>` : ''}`;
}
