import {
    dungeonLabelIdentitiesMatch,
    dungeonSiteRootsMatch,
    parseDungeonMapDocument,
    resolveActiveDungeonSite,
    resolveCurrentMapPlacement,
    resolveMapAreaIdentity,
} from './dungeon-reality.js';
import { buildHostedPeerSitePath, MAX_HOSTED_MAP_DEPTH } from './map-hosting.js';

export function normalizeMapAttachment(value) {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw attachmentFailure('attachTo must be an object containing exact site and cell strings.');
    }
    const site = String(value.site || '').trim();
    const cell = String(value.cell || '').trim();
    if (!site && !cell) throw attachmentFailure('attachTo requires both site and cell. Omit attachTo entirely for a standalone map.');
    return { site, cell };
}

function attachmentFailure(message) {
    return new Error(`[MAP_ARCHITECT_ATTACHMENT_ERROR — PRIVATE]\n${message}\nCorrect attachTo using the exact names supplied above, then retry CreateAreaMap once. Do not move the player or alter the Location footer.\n[/MAP_ARCHITECT_ATTACHMENT_ERROR]`);
}

function resolveHostChain(record, sites) {
    const chain = [];
    const seen = new Set();
    let cursor = record;
    while (cursor) {
        const key = String(cursor.siteRoot || '').trim();
        if (!key || seen.has(key)) throw attachmentFailure(`The mapped host chain contains a cycle at "${key || '(unnamed site)'}".`);
        seen.add(key);
        chain.push(cursor);
        const document = parseDungeonMapDocument(cursor.mapChunks?.[0], cursor.siteRoot).document;
        const parentSite = String(document.hostSite || '').trim();
        if (!parentSite) break;
        const matches = Object.values(sites || {}).filter(candidate => candidate?.mapChunks?.length
            && dungeonSiteRootsMatch(candidate.siteRoot, parentSite));
        if (matches.length !== 1) {
            throw attachmentFailure(`Could not resolve the direct parent map "${parentSite}" required by "${cursor.siteRoot}".`);
        }
        cursor = matches[0];
    }
    return chain;
}

function buildHostCellPrompt(hostDocument, hostArea) {
    const areasById = new Map((hostDocument.areas || []).map(area => [area.id, area]));
    const routes = (hostArea.connections || []).map(connection => {
        const target = areasById.get(connection.to);
        return `${target?.name || connection.to} (${connection.state})${connection.detail ? ` — ${connection.detail}` : ''}`;
    });
    const assets = (hostDocument.assets || []).filter(asset => asset.location === hostArea.id && asset.state !== 'REMOVED' && asset.state !== 'LEFT');
    return `PARENT MAP CELL (LOCKED CONTEXT)\nParent map: ${hostDocument.site} (${hostDocument.kind})\nTarget cell: ${hostArea.name} [${hostArea.id}]\nCell knowledge: ${hostArea.knowledge}\nGeometry:\n${(hostArea.geometry || []).map(line => `- ${line}`).join('\n') || '- none'}\nParent routes:\n${routes.map(line => `- ${line}`).join('\n') || '- none'}\nExisting parent-cell assets:\n${assets.map(asset => `- ${asset.id}: ${asset.kind} "${asset.name}" (${asset.state}, ${asset.knowledge})${asset.detail ? ` — ${asset.detail}` : ''}`).join('\n') || '- none'}\nThe target cell remains on the parent map and receives the child gateway. The child map begins at its requested entrance. Do not duplicate parent-cell occupants or props inside the child unless the map-generation prompt or recent story explicitly establishes that they crossed the gateway.`;
}

function buildHostTopologyPrompt(hostDocument, hostArea) {
    const areasById = new Map((hostDocument.areas || []).map(area => [area.id, area]));
    const routes = (hostArea.connections || []).map(connection => {
        const target = areasById.get(connection.to);
        return `${target?.name || connection.to} (${connection.state})${connection.detail ? ` — ${connection.detail}` : ''}`;
    });
    return `PARENT MAP CELL (LOCKED STRUCTURAL CONTEXT)\nParent map: ${hostDocument.site} (${hostDocument.kind})\nTarget cell: ${hostArea.name} [${hostArea.id}]\nCell knowledge: ${hostArea.knowledge}\nGeometry:\n${(hostArea.geometry || []).map(line => `- ${line}`).join('\n') || '- none'}\nParent routes:\n${routes.map(line => `- ${line}`).join('\n') || '- none'}\nThe target cell remains on the parent map. The child graph begins at its requested entrance.`;
}

/** Resolve an explicit offsite attachment or the active-map shorthand. */
export function resolveHostedCreationContext(current, currentLocation, args) {
    const attachTo = normalizeMapAttachment(args.attachTo);
    if (!['DUNGEON', 'INTERIOR'].includes(args.kind)) {
        if (attachTo) throw attachmentFailure('attachTo is valid only when creating a DUNGEON or INTERIOR child map. SETTLEMENT maps cannot be nested.');
        return null;
    }
    const records = Object.values(current.sites || {}).filter(record => record?.mapChunks?.length);
    let active = null;
    if (attachTo) {
        if (!attachTo.site || !attachTo.cell) {
            throw attachmentFailure('attachTo requires both site (the existing parent map) and cell (the exact parent area).');
        }
        const matches = records.filter(record => dungeonSiteRootsMatch(record.siteRoot, attachTo.site));
        if (matches.length !== 1) {
            const available = records.map(record => record.siteRoot).filter(Boolean).sort();
            throw attachmentFailure(`Parent map "${attachTo.site}" was not found exactly.${available.length ? ` Available mapped sites: ${available.join(', ')}.` : ' No mapped sites are available.'}`);
        }
        active = matches[0];
    } else {
        if (!currentLocation) return null;
        active = resolveActiveDungeonSite({ version: 3, sites: current.sites || {} }, currentLocation);
        if (!active) return null;
    }
    const hostDocument = parseDungeonMapDocument(active.mapChunks[0], active.siteRoot).document;
    const chain = resolveHostChain(active, current.sites || {});
    if (chain.some(record => dungeonSiteRootsMatch(record.siteRoot, args.site))) {
        throw attachmentFailure(`"${args.site}" is already in the selected host's ancestry and cannot be attached beneath itself.`);
    }
    if (chain.length >= MAX_HOSTED_MAP_DEPTH) {
        throw attachmentFailure(`"${active.siteRoot}" is already map level ${chain.length}. Nested maps are limited to ${MAX_HOSTED_MAP_DEPTH} mapped levels.`);
    }
    const exactAssetMatches = (hostDocument.assets || []).filter(asset =>
        asset.state !== 'REMOVED' && asset.state !== 'LEFT' && dungeonLabelIdentitiesMatch(asset.name, args.site));
    if (exactAssetMatches.length > 1) {
        throw attachmentFailure(`Parent map "${active.siteRoot}" contains more than one active asset named "${args.site}".`);
    }
    const exactAsset = exactAssetMatches[0] || null;
    const expectedAssetKind = args.kind === 'INTERIOR' ? 'SUBINTERIOR' : 'SUBDUNGEON';
    if (exactAsset && !['BUILDING', 'OBJECT', expectedAssetKind].includes(exactAsset.kind)) {
        throw attachmentFailure(`Parent-map asset "${args.site}" is ${exactAsset.kind}; ${args.kind} requires ${expectedAssetKind}.`);
    }
    let hostArea = null;
    if (attachTo) {
        const resolved = resolveMapAreaIdentity(hostDocument, attachTo.cell);
        if (!resolved.area) {
            const available = (hostDocument.areas || []).map(area => area.name).filter(Boolean);
            throw attachmentFailure(`Cell "${attachTo.cell}" was not found exactly in "${active.siteRoot}". Available cells: ${available.join(', ') || '(none)'}.`);
        }
        hostArea = resolved.area;
    } else {
        const placement = resolveCurrentMapPlacement(hostDocument, currentLocation);
        hostArea = exactAsset
            ? hostDocument.areas.find(area => area.id === exactAsset.location)
            : placement.area;
        if (!hostArea) return null;
    }
    if (exactAsset && exactAsset.location !== hostArea.id) {
        const actual = (hostDocument.areas || []).find(area => area.id === exactAsset.location)?.name || exactAsset.location;
        throw attachmentFailure(`Asset "${args.site}" already occupies "${actual}", not requested cell "${hostArea.name}".`);
    }
    const hostedAsset = exactAsset || { name: args.site, location: hostArea.id };
    return {
        hostSite: active.siteRoot,
        hostEntryId: active.entryId,
        hostAreaId: hostArea.id,
        assetName: args.site,
        peerSite: buildHostedPeerSitePath(hostDocument, hostedAsset),
        expectedAssetKind,
        briefDescription: args.briefDescription,
        topologyPromptContext: buildHostTopologyPrompt(hostDocument, hostArea),
        promptContext: buildHostCellPrompt(hostDocument, hostArea),
        explicit: !!attachTo,
        hostDepth: chain.length,
        peerDepth: chain.length + 1,
    };
}
