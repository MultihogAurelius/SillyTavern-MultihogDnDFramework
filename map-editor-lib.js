import {
    DUNGEON_MAP_FORMAT_VERSION,
    MAP_AREA_KNOWLEDGE,
    MAP_ASSET_CONTAINER_CHILD_KINDS,
    MAP_ASSET_KINDS,
    MAP_ASSET_KNOWLEDGE,
    MAP_ASSET_STATES,
    MAP_CONNECTION_STATES,
    MAP_SITE_KINDS,
    MAP_SITE_THREATS,
    canAssetKindBeContainedBy,
    coerceAssetState,
    normalizeDungeonMapDocument,
} from './dungeon-reality.js';

export const MAP_EDITOR_PACKAGE_FORMAT = 'multihog_map_package_v1';
export const MAP_EDITOR_PACKAGE_VERSION = 1;
export const MAP_EDITOR_HISTORY_LIMIT = 100;

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SETTLEMENT_ONLY_KINDS = new Set(['BUILDING']);
const RUNTIME_PROVENANCE_FIELDS = ['cause', 'actor', 'changed_at', 'last_location'];

export function cloneMapEditorValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function mapEditorSlug(value, fallback = 'item') {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || fallback;
}

export function allocateMapEditorId(document, name, type = 'area') {
    const source = type === 'asset' ? document?.assets : document?.areas;
    const used = new Set((Array.isArray(source) ? source : []).map(item => String(item?.id || '')));
    const base = mapEditorSlug(name, type);
    if (!used.has(base)) return base;
    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
}

export function createMapEditorDocument({ site = '', kind = 'SETTLEMENT', threat = '', entrance = 'Entrance', hosted = false } = {}) {
    const resolvedKind = MAP_SITE_KINDS.includes(String(kind).toUpperCase()) ? String(kind).toUpperCase() : 'SETTLEMENT';
    const resolvedThreat = MAP_SITE_THREATS.includes(String(threat).toUpperCase())
        ? String(threat).toUpperCase()
        : (resolvedKind === 'DUNGEON' ? 'HIGH' : resolvedKind === 'INTERIOR' ? 'LOW' : 'MODERATE');
    const entranceName = String(entrance || 'Entrance').trim() || 'Entrance';
    return {
        version: DUNGEON_MAP_FORMAT_VERSION,
        site: String(site || '').trim(),
        kind: resolvedKind,
        threat: resolvedThreat,
        areas: [{
            id: mapEditorSlug(entranceName, 'entrance'),
            name: entranceName,
            knowledge: hosted ? 'UNREVEALED' : 'VISITED',
            geometry: [],
            connections: [],
        }],
        assets: [],
    };
}

function issue(code, path, message) {
    return { code, path, message };
}

function nonEmptyString(value) {
    return typeof value === 'string' && !!value.trim();
}

/** Strict validation for GUI/raw drafts. Unlike the legacy parser, it never repairs references. */
export function validateMapEditorDocument(raw, { site = '', originalDocument = null, linkedGatewayIds = [] } = {}) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { valid: false, errors: [issue('INVALID_DOCUMENT', '$', 'Map must be one JSON object.')], document: null };
    }
    const allowedTop = new Set(['version', 'site', 'kind', 'threat', 'hostSite', 'hostBrief', 'areas', 'assets']);
    for (const key of Object.keys(raw)) if (!allowedTop.has(key)) errors.push(issue('UNKNOWN_FIELD', `$.${key}`, `Unsupported map field "${key}".`));
    if (raw.version !== DUNGEON_MAP_FORMAT_VERSION) errors.push(issue('INVALID_VERSION', '$.version', `Version must be ${DUNGEON_MAP_FORMAT_VERSION}.`));
    if (!nonEmptyString(raw.site)) errors.push(issue('MISSING_SITE', '$.site', 'Location name is required.'));
    if (site && String(raw.site || '').trim() !== String(site).trim()) errors.push(issue('SITE_LOCKED', '$.site', `Site identity must remain "${site}".`));
    if (!MAP_SITE_KINDS.includes(raw.kind)) errors.push(issue('INVALID_KIND', '$.kind', `Kind must be ${MAP_SITE_KINDS.join(', ')}.`));
    if (raw.threat != null && !MAP_SITE_THREATS.includes(raw.threat)) errors.push(issue('INVALID_THREAT', '$.threat', `Threat must be ${MAP_SITE_THREATS.join(', ')}.`));
    const hostSite = String(raw.hostSite || '').trim();
    const hostBrief = String(raw.hostBrief || '').trim();
    if (!!hostSite !== !!hostBrief) errors.push(issue('INCOMPLETE_HOST', '$.hostSite', 'hostSite and hostBrief must both be present or both be omitted.'));
    if (raw.kind === 'SETTLEMENT' && (hostSite || hostBrief)) errors.push(issue('HOSTED_SETTLEMENT', '$.hostSite', 'Settlement maps cannot be hosted.'));
    if (originalDocument) {
        if (String(originalDocument.hostSite || '') !== String(raw.hostSite || '') || String(originalDocument.hostBrief || '') !== String(raw.hostBrief || '')) {
            errors.push(issue('HOST_LOCKED', '$.hostSite', 'Host identity is runtime-owned and cannot be edited.'));
        }
    }
    if (!Array.isArray(raw.areas) || raw.areas.length === 0) errors.push(issue('MISSING_AREAS', '$.areas', 'Map must contain at least one area.'));
    if (!Array.isArray(raw.assets)) errors.push(issue('INVALID_ASSETS', '$.assets', 'assets must be an array.'));

    const areas = Array.isArray(raw.areas) ? raw.areas : [];
    const assets = Array.isArray(raw.assets) ? raw.assets : [];
    const areaIds = new Set();
    const areaNames = new Set();
    for (const [index, area] of areas.entries()) {
        const path = `$.areas[${index}]`;
        if (!area || typeof area !== 'object' || Array.isArray(area)) { errors.push(issue('INVALID_AREA', path, 'Area must be an object.')); continue; }
        if (!ID_RE.test(String(area.id || ''))) errors.push(issue('INVALID_AREA_ID', `${path}.id`, 'Area ID must be unique kebab-case.'));
        else if (areaIds.has(area.id)) errors.push(issue('DUPLICATE_AREA_ID', `${path}.id`, `Duplicate area ID "${area.id}".`));
        else areaIds.add(area.id);
        const nameKey = String(area.name || '').trim().toLocaleLowerCase();
        if (!nameKey) errors.push(issue('MISSING_AREA_NAME', `${path}.name`, 'Area name is required.'));
        else if (areaNames.has(nameKey)) errors.push(issue('DUPLICATE_AREA_NAME', `${path}.name`, `Duplicate area name "${area.name}".`));
        else areaNames.add(nameKey);
        if (!MAP_AREA_KNOWLEDGE.includes(area.knowledge)) errors.push(issue('INVALID_AREA_KNOWLEDGE', `${path}.knowledge`, `Knowledge must be ${MAP_AREA_KNOWLEDGE.join(', ')}.`));
        if (!Array.isArray(area.geometry) || area.geometry.some(fact => !nonEmptyString(fact))) errors.push(issue('INVALID_GEOMETRY', `${path}.geometry`, 'Geometry must contain only non-empty strings.'));
        if (!Array.isArray(area.connections)) { errors.push(issue('INVALID_CONNECTIONS', `${path}.connections`, 'Connections must be an array.')); continue; }
        const targets = new Set();
        for (const [connectionIndex, connection] of area.connections.entries()) {
            const connectionPath = `${path}.connections[${connectionIndex}]`;
            if (!connection || typeof connection !== 'object' || Array.isArray(connection)) { errors.push(issue('INVALID_CONNECTION', connectionPath, 'Connection must be an object.')); continue; }
            if (!nonEmptyString(connection.to)) errors.push(issue('MISSING_CONNECTION_TARGET', `${connectionPath}.to`, 'Connection target is required.'));
            else if (connection.to === area.id) errors.push(issue('SELF_CONNECTION', `${connectionPath}.to`, 'An area cannot connect to itself.'));
            else if (targets.has(connection.to)) errors.push(issue('DUPLICATE_CONNECTION', `${connectionPath}.to`, 'Each outgoing target may appear only once.'));
            else targets.add(connection.to);
            if (!MAP_CONNECTION_STATES.includes(connection.state)) errors.push(issue('INVALID_CONNECTION_STATE', `${connectionPath}.state`, `State must be ${MAP_CONNECTION_STATES.join(', ')}.`));
            if (typeof connection.detail !== 'string') errors.push(issue('INVALID_CONNECTION_DETAIL', `${connectionPath}.detail`, 'Detail must be a string.'));
        }
    }
    for (const [areaIndex, area] of areas.entries()) {
        for (const [connectionIndex, connection] of (Array.isArray(area?.connections) ? area.connections : []).entries()) {
            if (!areaIds.has(connection?.to)) errors.push(issue('UNKNOWN_CONNECTION_TARGET', `$.areas[${areaIndex}].connections[${connectionIndex}].to`, `Unknown area "${connection?.to}".`));
        }
    }

    const assetIds = new Set();
    const allIds = new Set(areaIds);
    for (const [index, asset] of assets.entries()) {
        const path = `$.assets[${index}]`;
        if (!asset || typeof asset !== 'object' || Array.isArray(asset)) { errors.push(issue('INVALID_ASSET', path, 'Asset must be an object.')); continue; }
        if (!ID_RE.test(String(asset.id || ''))) errors.push(issue('INVALID_ASSET_ID', `${path}.id`, 'Asset ID must be unique kebab-case.'));
        else if (assetIds.has(asset.id) || allIds.has(asset.id)) errors.push(issue('DUPLICATE_ASSET_ID', `${path}.id`, `Duplicate ID "${asset.id}".`));
        else { assetIds.add(asset.id); allIds.add(asset.id); }
    }
    const assetsById = new Map(assets.map(asset => [asset?.id, asset]));
    for (const [index, asset] of assets.entries()) {
        const path = `$.assets[${index}]`;
        if (!asset || typeof asset !== 'object' || Array.isArray(asset)) continue;
        if (!nonEmptyString(asset.name)) errors.push(issue('MISSING_ASSET_NAME', `${path}.name`, 'Asset name is required.'));
        if (!MAP_ASSET_KINDS.includes(asset.kind)) errors.push(issue('INVALID_ASSET_KIND', `${path}.kind`, `Kind must be ${MAP_ASSET_KINDS.join(', ')}.`));
        if (SETTLEMENT_ONLY_KINDS.has(asset.kind) && raw.kind !== 'SETTLEMENT') errors.push(issue('ASSET_KIND_NOT_ALLOWED', `${path}.kind`, `${asset.kind} is settlement-only.`));
        const state = coerceAssetState(asset.state);
        if (!MAP_ASSET_STATES.includes(state)) errors.push(issue('INVALID_ASSET_STATE', `${path}.state`, `State must be ${MAP_ASSET_STATES.join(', ')}.`));
        if (!MAP_ASSET_KNOWLEDGE.includes(asset.knowledge)) errors.push(issue('INVALID_ASSET_KNOWLEDGE', `${path}.knowledge`, `Knowledge must be ${MAP_ASSET_KNOWLEDGE.join(', ')}.`));
        if (typeof asset.detail !== 'string') errors.push(issue('INVALID_ASSET_DETAIL', `${path}.detail`, 'Detail must be a string.'));
        if (asset.state === 'REMOVED' && asset.location == null) {
            // Removed records may be unplaced.
        } else if (areaIds.has(asset.location)) {
            // Direct area placement.
        } else {
            const parent = assetsById.get(asset.location);
            if (!parent || !canAssetKindBeContainedBy(asset.kind, parent.kind)) errors.push(issue('INVALID_ASSET_LOCATION', `${path}.location`, 'Choose an area or a legal container.'));
        }
        if (asset.route != null && (!Array.isArray(asset.route) || asset.route.some(id => !areaIds.has(id)))) errors.push(issue('INVALID_ASSET_ROUTE', `${path}.route`, 'Routes may contain only existing area IDs.'));
        if (asset.count != null && (!Number.isInteger(asset.count) || asset.count < 1 || asset.count > 99)) errors.push(issue('INVALID_ASSET_COUNT', `${path}.count`, 'Count must be an integer from 1 to 99.'));
        if (asset.notEntered != null && (asset.kind !== 'BUILDING' || typeof asset.notEntered !== 'boolean')) errors.push(issue('INVALID_NOT_ENTERED', `${path}.notEntered`, 'notEntered is a BUILDING-only boolean.'));
    }

    const linked = new Set(linkedGatewayIds);
    if (originalDocument && linked.size) {
        const originalById = new Map((originalDocument.assets || []).map(asset => [asset.id, asset]));
        const currentById = new Map(assets.map(asset => [asset.id, asset]));
        for (const id of linked) {
            const before = originalById.get(id);
            const after = currentById.get(id);
            if (!before || !after) { errors.push(issue('LINKED_GATEWAY_LOCKED', '$.assets', `Linked gateway "${id}" cannot be deleted.`)); continue; }
            for (const field of ['id', 'name', 'kind', 'location']) {
                if (before[field] !== after[field]) errors.push(issue('LINKED_GATEWAY_LOCKED', `$.assets.${id}.${field}`, `Linked gateway ${field} is runtime-owned.`));
            }
        }
    }
    return { valid: errors.length === 0, errors, document: errors.length ? null : cloneMapEditorValue(raw) };
}

export class MapEditorHistory {
    constructor(initial, limit = MAP_EDITOR_HISTORY_LIMIT) {
        this.limit = Math.max(2, Number(limit) || MAP_EDITOR_HISTORY_LIMIT);
        this.stack = [cloneMapEditorValue(initial)];
        this.index = 0;
        this.savedIndex = 0;
    }
    get value() { return cloneMapEditorValue(this.stack[this.index]); }
    get canUndo() { return this.index > 0; }
    get canRedo() { return this.index < this.stack.length - 1; }
    get dirty() { return this.index !== this.savedIndex; }
    push(value) {
        this.stack = this.stack.slice(0, this.index + 1);
        this.stack.push(cloneMapEditorValue(value));
        if (this.stack.length > this.limit) {
            this.stack.shift();
            this.savedIndex -= 1;
        }
        this.index = this.stack.length - 1;
        return this.value;
    }
    undo() { if (this.canUndo) this.index -= 1; return this.value; }
    redo() { if (this.canRedo) this.index += 1; return this.value; }
    markSaved() { this.savedIndex = this.index; }
}

export function areaDeletionBlockers(document, areaId) {
    const area = (document?.areas || []).find(item => item.id === areaId);
    if (!area) return ['Area was not found.'];
    const blockers = [];
    const incoming = (document.areas || []).filter(item => (item.connections || []).some(connection => connection.to === areaId));
    if ((area.connections || []).length || incoming.length) blockers.push('Remove all routes connected to this area.');
    const placed = (document.assets || []).filter(asset => asset.location === areaId);
    if (placed.length) blockers.push(`Move or delete ${placed.length} asset${placed.length === 1 ? '' : 's'} placed here.`);
    return blockers;
}

export function createPortableMapPackage(document, metadata = {}) {
    const map = cloneMapEditorValue(document);
    delete map.hostSite;
    delete map.hostBrief;
    for (const asset of map.assets || []) {
        for (const field of RUNTIME_PROVENANCE_FIELDS) delete asset[field];
    }
    return {
        format: MAP_EDITOR_PACKAGE_FORMAT,
        version: MAP_EDITOR_PACKAGE_VERSION,
        location: {
            suggestedName: String(metadata.suggestedName || map.site || '').trim(),
            core: String(metadata.core || '').trim(),
            keywords: [...new Set((Array.isArray(metadata.keywords) ? metadata.keywords : []).map(value => String(value).trim()).filter(Boolean))],
        },
        map,
    };
}

export function parsePortableMapPackage(value, { site = '' } = {}) {
    let raw = value;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch (error) { return { ok: false, errors: [String(error?.message || error)], package: null }; }
    }
    const wrapped = raw?.format === MAP_EDITOR_PACKAGE_FORMAT;
    if (wrapped && raw.version !== MAP_EDITOR_PACKAGE_VERSION) return { ok: false, errors: [`Unsupported map package version ${raw.version}.`], package: null };
    const map = cloneMapEditorValue(wrapped ? raw.map : raw);
    if (!map || typeof map !== 'object' || Array.isArray(map)) return { ok: false, errors: ['Import must contain a map object.'], package: null };
    delete map.hostSite;
    delete map.hostBrief;
    if (site) map.site = String(site).trim();
    const validation = validateMapEditorDocument(map, { site: site || map.site });
    if (!validation.valid) return { ok: false, errors: validation.errors.map(item => `${item.path}: ${item.message}`), package: null };
    return {
        ok: true,
        errors: [],
        package: {
            format: MAP_EDITOR_PACKAGE_FORMAT,
            version: MAP_EDITOR_PACKAGE_VERSION,
            location: wrapped ? cloneMapEditorValue(raw.location || {}) : { suggestedName: map.site, core: '', keywords: [] },
            map: normalizeDungeonMapDocument(map, map.site),
        },
    };
}

export const MAP_EDITOR_ENUMS = Object.freeze({
    areaKnowledge: MAP_AREA_KNOWLEDGE,
    assetKnowledge: MAP_ASSET_KNOWLEDGE,
    assetKinds: MAP_ASSET_KINDS,
    assetStates: MAP_ASSET_STATES,
    connectionStates: MAP_CONNECTION_STATES,
    siteKinds: MAP_SITE_KINDS,
    siteThreats: MAP_SITE_THREATS,
    containerChildKinds: MAP_ASSET_CONTAINER_CHILD_KINDS,
});
