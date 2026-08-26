/**
 * Durable dungeon-reality capture and deterministic prompt injection helpers.
 *
 * Hidden maps are persisted as a structured current-state snapshot in a root
 * Location entry. Legacy prose is migrated without depending on the original
 * chat message remaining in context.
 */

// Some models incorrectly emit `</div hidden>`. Accept that legacy/malformed
// closing tag so an otherwise valid hidden map is not silently lost.
const DIV_RE = /<div\b([^>]*)>([\s\S]*?)<\/div(?:\s+hidden)?>/gi;
const LOCATION_RE = /\(Location:\s*([^)]+)\)/gi;
const SITE_MARKER_RE = /^\s*(?:Dungeon\s+)?Site(?:\s+Root)?\s*:\s*(.+?)\s*$/im;
const DELTA_LINE_RE = /^\s*(mutation|addition)\s*:\s*(.+?)\s*\|\s*(.+?)\s*$/i;
const LEADING_ARTICLE_RE = /^(?:the|a|an)\s+/;

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasHiddenAttribute(attributes) {
    return /(?:^|\s)hidden(?:\s|=|$)/i.test(String(attributes || ''));
}

function hasDungeonDeltaAttribute(attributes) {
    return /(?:^|\s)data-dungeon-delta(?:\s|=|$)/i.test(String(attributes || ''));
}

function hasDungeonMapAttribute(attributes) {
    return /(?:^|\s)data-dungeon-map(?:\s|=|$)/i.test(String(attributes || ''));
}

/** Lorebook entry extension field containing the private objective map. */
export const DUNGEON_MAP_EXTENSION_KEY = 'multihogDungeonMap';
export const DUNGEON_MAP_OPERATION_IDS_KEY = 'multihogDungeonMapOperationIds';
export const DUNGEON_MAP_FORMAT_VERSION = 3;
const MAP_SECTION_RE = /\[MAP\]([\s\S]*?)\[\/MAP\]/i;

const AREA_KNOWLEDGE = ['UNREVEALED', 'DISCOVERED', 'VISITED'];
const ASSET_KNOWLEDGE = ['UNREVEALED', 'SUSPECTED', 'KNOWN'];
const ASSET_KINDS = ['CREATURE', 'GROUP', 'TRAP', 'HAZARD', 'OBJECT', 'BUILDING', 'SUBDUNGEON', 'SUBINTERIOR', 'LOOT', 'BARRIER', 'ALARM', 'EFFECT', 'OTHER'];
const SETTLEMENT_ONLY_ASSET_KINDS = ['BUILDING'];
const HOSTED_GATEWAY_ASSET_KINDS = ['SUBDUNGEON', 'SUBINTERIOR'];
const ASSET_CONTAINER_CHILD_KINDS = Object.freeze({
    BUILDING: ['CREATURE', 'GROUP', 'OBJECT', 'LOOT', 'HAZARD', 'TRAP'],
    CREATURE: ['OBJECT', 'LOOT'],
    GROUP: ['OBJECT', 'LOOT'],
});
const ASSET_KIND_ALIASES = {
    NPC: 'CREATURE',
    PERSON: 'CREATURE',
    CHARACTER: 'CREATURE',
    ITEM: 'OBJECT',
    // Legacy maps briefly used INTERIOR as an asset synonym. New maps use
    // BUILDING for an unmapped structure and INTERIOR for a peer map kind.
    INTERIOR: 'BUILDING',
};
const ASSET_STATES = [
    'ACTIVE', 'ALERT', 'IDLE', 'DORMANT', 'FLEEING', 'LEFT', 'CAPTURED',
    'DEAD', 'DESTROYED', 'DISABLED', 'DEACTIVATED', 'ARMED', 'TRIGGERED',
    'LOCKED', 'UNLOCKED', 'OPEN', 'CLOSED', 'BLOCKED', 'CLEARED',
    'INTACT', 'DAMAGED', 'TAKEN', 'AVAILABLE', 'EXHAUSTED', 'EXPIRED',
    'DISMISSED', 'REMOVED', 'UNKNOWN',
];
const ASSET_STATE_ALIASES = {
    DISARMED: 'DEACTIVATED',
    INACTIVE: 'DEACTIVATED',
    PACIFIED: 'DEACTIVATED',
    LEAVING: 'LEFT',
};
/** Still on the map as identity/history, but not occupying a room. */
const OFF_OCCUPANCY_STATES = ['LEFT', 'REMOVED'];
const CONNECTION_STATES = ['OPEN', 'CLOSED', 'LOCKED', 'BLOCKED', 'DESTROYED', 'UNKNOWN'];
const MAP_EVIDENCE = ['CONFIRMED', 'IMPLIED', 'AUTONOMOUS', 'EVOLVED'];
const MAP_OPERATIONS = ['ADD_AREA', 'SET_AREA', 'ADD_ASSET', 'MOVE_ASSET', 'SET_ASSET', 'REMOVE_ASSET', 'SET_CONNECTION'];
const EVOLVED_OPERATIONS = ['ADD_ASSET', 'MOVE_ASSET', 'SET_ASSET', 'REMOVE_ASSET', 'SET_CONNECTION', 'SET_AREA'];
const MAP_THREAD_STATUSES = ['open', 'resolved', 'transformed'];
const KILL_STATES = ['DEAD', 'DESTROYED'];
const CAUSAL_OPERATION_FIELDS = ['cause', 'actor', 'thread_status'];
const MAX_CAUSE_LENGTH = 240;
const MAX_ACTOR_LENGTH = 120;
const MAX_ASSET_COUNT = 99;
/** Outcomes established by play. Map Evolution may not reverse them. */
export const PLAY_CANON_LOCKED_STATES = [
    'DEAD', 'DESTROYED', 'DEACTIVATED', 'TAKEN', 'CLEARED', 'REMOVED', 'EXPIRED', 'DISMISSED',
];
export const MAP_SITE_KINDS = ['DUNGEON', 'SETTLEMENT', 'INTERIOR'];
export const MAP_SITE_THREATS = ['NONE', 'LOW', 'MODERATE', 'HIGH', 'DEADLY'];
export const MAP_KILL_STATES = KILL_STATES;
export const MAP_ASSET_KINDS = ASSET_KINDS;
export const MAP_ASSET_STATES = ASSET_STATES;
export const MAP_ASSET_CONTAINER_CHILD_KINDS = ASSET_CONTAINER_CHILD_KINDS;
export const MAP_AREA_KNOWLEDGE = AREA_KNOWLEDGE;
export const MAP_ASSET_KNOWLEDGE = ASSET_KNOWLEDGE;
export const MAP_CONNECTION_STATES = CONNECTION_STATES;
const ASSET_STATE_INPUT_ENUM = [...ASSET_STATES, ...Object.keys(ASSET_STATE_ALIASES)];

export function isKillState(state) {
    return KILL_STATES.includes(String(state || '').toUpperCase());
}

export function coerceAssetState(value) {
    const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return ASSET_STATE_ALIASES[normalized] || normalized;
}

export function isPlayCanonLockedState(state) {
    return PLAY_CANON_LOCKED_STATES.includes(coerceAssetState(state));
}

/** True when the record should not count as current room occupancy. LEFT keeps cause/actor. */
export function assetOccupiesMap(asset) {
    return !OFF_OCCUPANCY_STATES.includes(coerceAssetState(asset?.state));
}

function normalizeThreadStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    return MAP_THREAD_STATUSES.includes(status) ? status : '';
}

function readCausalCause(operation, path, errors) {
    const cause = String(operation?.cause || '').trim();
    if (!cause) {
        errors.push(mapError('MISSING_CAUSE', `${path}.cause`, operation?.cause, 'Supply a concise in-world cause so later Map Evolution can continue this thread.'));
        return '';
    }
    if (cause.length > MAX_CAUSE_LENGTH) {
        errors.push(mapError('CAUSE_TOO_LONG', `${path}.cause`, cause, `Keep cause to ${MAX_CAUSE_LENGTH} characters.`));
        return cause.slice(0, MAX_CAUSE_LENGTH);
    }
    return cause;
}

function readCausalActor(operation, path, errors, { required = false } = {}) {
    const actor = String(operation?.actor || '').trim();
    if (required && !actor) {
        errors.push(mapError('MISSING_ACTOR', `${path}.actor`, operation?.actor, 'DEAD/DESTROYED requires actor: "party", an existing asset id, or a short off-map name such as a rival pack or collapse.'));
        return '';
    }
    if (actor.length > MAX_ACTOR_LENGTH) {
        errors.push(mapError('ACTOR_TOO_LONG', `${path}.actor`, actor, `Keep actor to ${MAX_ACTOR_LENGTH} characters.`));
        return actor.slice(0, MAX_ACTOR_LENGTH);
    }
    return actor;
}

function readAssetCount(value, path, errors) {
    if (value == null || value === '') return null;
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_ASSET_COUNT) {
        errors.push(mapError('INVALID_COUNT', path, value, `count is living members of this one asset (1-${MAX_ASSET_COUNT}). Packs stay one GROUP with count; use DESTROYED/DEAD instead of 0.`));
        return null;
    }
    return parsed;
}

function applyAssetCount(target, value, path, errors) {
    const count = readAssetCount(value, path, errors);
    if (count != null) target.count = count;
}

function stampCausalFields(target, operation, path, errors, currentTime, { requireActor = false } = {}) {
    if (!target || typeof target !== 'object') return;
    const cause = readCausalCause(operation, path, errors);
    if (cause) target.cause = cause;
    const actor = readCausalActor(operation, path, errors, { required: requireActor });
    if (actor) target.actor = actor;
    else if (requireActor) delete target.actor;
    const stamp = String(currentTime || '').trim();
    if (stamp) target.changed_at = stamp;
}

function mapSlug(value, fallback = 'item') {
    const slug = String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || fallback;
}

function allocateMapId(existingIds, label, fallback) {
    const base = mapSlug(label, fallback);
    let id = base;
    let suffix = 2;
    while (existingIds.has(id)) id = `${base}-${suffix++}`;
    existingIds.add(id);
    return id;
}

function cleanStringList(value) {
    return Array.isArray(value)
        ? value.map(item => String(item || '').trim()).filter(Boolean)
        : [];
}

function enumValue(value, allowed, fallback) {
    const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return allowed.includes(normalized) ? normalized : fallback;
}

function coerceAssetKind(value, { legacyStructuralAlias = true } = {}) {
    const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!legacyStructuralAlias && normalized === 'INTERIOR') return normalized;
    return ASSET_KIND_ALIASES[normalized] || normalized;
}

function coerceMapEvidence(value) {
    if (value == null || value === '') return 'CONFIRMED';
    return value;
}

function defaultAssetOrigin(evidence) {
    if (evidence === 'EVOLVED') return 'MAP_EVOLUTION';
    if (evidence === 'IMPLIED') return 'NARRATOR_IMPLIED';
    return 'NARRATOR_ESTABLISHED';
}

function operationTouchesFrozenArea(working, operation, frozenAreaIds) {
    const frozen = new Set((frozenAreaIds || []).filter(Boolean));
    if (!frozen.size) return false;
    const areaFrozen = (ref) => {
        const area = resolveMapEffectiveArea(working, ref).area;
        return !!(area && frozen.has(area.id));
    };
    if (operation.location && areaFrozen(operation.location)) return true;
    if (operation.to && areaFrozen(operation.to)) return true;
    if (operation.from && areaFrozen(operation.from)) return true;
    if (operation.area_id && areaFrozen(operation.area_id)) return true;
    if (operation.asset_id) {
        const asset = resolveMapAsset(working, operation.asset_id).asset;
        if (asset && frozen.has(resolveAssetEffectiveArea(working, asset)?.id)) return true;
    }
    return false;
}

function normalizeChronicleFields(chronicle) {
    if (!chronicle || typeof chronicle !== 'object' || Array.isArray(chronicle)) return chronicle;
    const next = { ...chronicle };
    if (!next.area_id) {
        const alias = next.area_id || next.areaId || next.area;
        if (alias) next.area_id = alias;
    }
    delete next.area;
    delete next.areaId;
    return next;
}

function normalizeMapOperation(operation) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) return operation;
    const next = { ...operation };
    if (!next.op) {
        const alias = next.type || next.action || next.operation;
        if (alias) next.op = alias;
    }
    delete next.type;
    delete next.action;
    delete next.operation;

    const wrappers = [
        ['asset', 'asset_id'],
        ['area', 'area_id'],
        ['connection', null],
    ];
    for (const [wrapper, idField] of wrappers) {
        const nested = next[wrapper];
        if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue;
        for (const [key, value] of Object.entries(nested)) {
            if (key === 'id' && idField) {
                if (next[idField] == null || next[idField] === '') next[idField] = value;
                continue;
            }
            if (next[key] == null || next[key] === '') next[key] = value;
        }
        delete next[wrapper];
    }
    return next;
}

export function normalizeMapSiteKind(value) {
    return enumValue(value, MAP_SITE_KINDS, 'DUNGEON');
}

/** Site danger for occupancy/traps — independent of party level and of scale (size). */
export function defaultMapSiteThreat(kind) {
    const normalized = normalizeMapSiteKind(kind);
    if (normalized === 'SETTLEMENT') return 'MODERATE';
    if (normalized === 'INTERIOR') return 'LOW';
    return 'HIGH';
}

export function normalizeMapSiteThreat(value, fallback = '') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    const upper = raw.toUpperCase();
    if (MAP_SITE_THREATS.includes(upper)) return upper;
    if (/DEADLY|LETHAL|EXTREME|NIGHTMARE|SUICIDE|TPK/i.test(raw)) return 'DEADLY';
    if (/\bNONE\b|NO[-\s]?THREAT|THREATLESS|HARMLESS|SAFE|PEACEFUL|NON[-\s]?DANGEROUS|NO[-\s]?DANGER/i.test(raw)) return 'NONE';
    if (/\bLOW\b|LIGHT|MILD|ROUTINE|QUIET|SPARSE/i.test(raw)) return 'LOW';
    if (/MODERATE|STANDARD|TYPICAL|NORMAL|AVERAGE/i.test(raw) || /\bMEDIUM\b/.test(upper)) return 'MODERATE';
    if (/\bHIGH\b|DANGEROUS|SERIOUS|HEAVY|HARSH/.test(upper) || /high[-\s]?risk/i.test(raw)) return 'HIGH';
    return fallback;
}

function scaleAreaBounds(scale, kind) {
    const key = String(scale || '').toUpperCase();
    if (normalizeMapSiteKind(kind) === 'SETTLEMENT') {
        return { SMALL: [4, 7], MEDIUM: [6, 10], LARGE: [8, 14] }[key];
    }
    return { SMALL: [4, 7], MEDIUM: [7, 12], LARGE: [12, 20] }[key];
}

function stripJsonFence(value) {
    return String(value || '').trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function tryParseStructuredMap(content) {
    const source = stripJsonFence(content);
    if (!source.startsWith('{')) return null;
    try {
        const parsed = JSON.parse(source);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

function inferLegacyAssetKind(line) {
    const text = String(line || '').toLowerCase();
    if (/\b(?:trap|tripwire|pressure plate|snare|pitfall|poison needle|rune trap)\b/.test(text)) return 'TRAP';
    if (/\b(?:alarm|bell|gong|warning horn)\b/.test(text)) return 'ALARM';
    if (/\b(?:door|gate|portcullis|barricade|barrier|grate)\b/.test(text)
        && /\b(?:locked|barred|chained|sealed|closed|open|ajar|blocked|corroded)\b/.test(text)) return 'BARRIER';
    if (/\b(?:contents?|loot|coins?|\bgp\b|treasure|cache|pouch|reliquary|holy water|gem|key\b)\b/.test(text)) return 'LOOT';
    if (/\b(?:ghouls?|skeletons?|wights?|zombies?|rats?|spiders?|goblins?|orcs?|guards?|cultists?|bandits?|shades?|spirits?|demons?|devils?|beasts?|creatures?|monsters?|undead|enemy|enemies|patrols?)\b/.test(text)) {
        return /\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\b/.test(text) ? 'GROUP' : 'CREATURE';
    }
    if (/\b(?:fire|flood|gas|sludge|unstable|collapse|difficult terrain|necromantic residue)\b/.test(text)) return 'HAZARD';
    return null;
}

function legacyAssetName(line, kind) {
    const clean = String(line || '').replace(/^[-*]\s*/, '').trim();
    if (['CREATURE', 'GROUP'].includes(kind)) {
        const creatureNoun = clean.match(/\b(shadow rats?|crawling claws?|skeleton guards?|ghouls?|skeletons?|wights?|zombies?|rats?|spiders?|goblins?|orcs?|guards?|cultists?|bandits?|shades?|spirits?|demons?|devils?|beasts?|creatures?|monsters?|undead|enemies?|patrols?)\b/i)?.[1];
        if (creatureNoun) return creatureNoun;
    }
    if (kind === 'BARRIER') {
        const barrier = clean.match(/\b((?:(?:heavy|oaken|oak|iron-banded|iron|corroded|rusted|stone|wooden|secret|concealed)\s+){0,3}(?:door|gate|portcullis|barricade|barrier|grate))\b/i)?.[1];
        if (barrier) return barrier;
    }
    if (kind === 'LOOT') {
        const loot = clean.match(/\b((?:(?:rusted|iron|silver|tarnished|copper|bronze|heavy)\s+){0,3}(?:reliquary|key|cache|pouch|treasure|holy water|holy symbol|contents?))\b/i)?.[1];
        if (loot) return loot;
    }
    if (kind === 'HAZARD') {
        const hazard = clean.match(/\b(black sludge|flooded water|black water|necromantic residue|difficult terrain|unstable rubble|gas|fire|flood)\b/i)?.[1];
        if (hazard) return hazard;
    }
    const creature = clean.match(/^(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+|a|an|the)\s+(.+?)(?=\s+(?:stands?|lies?|crouches?|nests?|waits?|guards?|flanks?|patrols?|lurks?|hides?|rests?|hangs?|is|are)\b|[.;]|$)/i);
    if (creature && ['CREATURE', 'GROUP'].includes(kind)) return creature[1].trim().replace(/\b(?:its|their)$/i, '').trim();
    const beforeColon = clean.match(/^([^:]{2,48}):/)?.[1]?.trim();
    if (beforeColon) return beforeColon;
    const words = clean.replace(/[.;].*$/, '').split(/\s+/).slice(0, 7).join(' ');
    return words || kind.toLowerCase();
}

function splitLegacyAssetStatements(line) {
    return String(line || '').split(/;\s+|(?<=[.!?])\s+(?=(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+|a|an|the)\s)/i);
}

function inferLegacyAssetState(kind, line) {
    const text = String(line || '').toLowerCase();
    if (kind === 'TRAP' || kind === 'ALARM') return 'ARMED';
    if (kind === 'LOOT') return 'AVAILABLE';
    if (kind !== 'BARRIER') return 'ACTIVE';
    if (/\b(?:open|ajar)\b/.test(text)) return 'OPEN';
    if (/\b(?:locked|chained|sealed)\b/.test(text)) return 'LOCKED';
    if (/\b(?:blocked)\b/.test(text)) return 'BLOCKED';
    if (/\b(?:barred|closed|shut)\b/.test(text)) return 'CLOSED';
    if (/\b(?:destroyed|broken)\b/.test(text)) return 'DESTROYED';
    return 'UNKNOWN';
}

/** Convert the original prose map format into the mutable v3 geometry/assets model. */
export function convertLegacyDungeonMapToDocument(content, siteFallback = '') {
    const source = String(content || '').trim();
    const site = source.match(SITE_MARKER_RE)?.[1]?.trim() || String(siteFallback || '').trim() || 'Mapped Site';
    const rawAreas = [];
    let current = null;
    for (const rawLine of source.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || SITE_MARKER_RE.test(line)) continue;
        const areaMatch = line.match(/^Area\s*:\s*(.+?)\s*$/i);
        if (areaMatch) {
            current = { name: areaMatch[1].trim(), lines: [] };
            rawAreas.push(current);
            continue;
        }
        if (!current) {
            current = { name: 'Site Overview', lines: [] };
            rawAreas.push(current);
        }
        current.lines.push(line.replace(/^[-*]\s*/, '').trim());
    }
    if (!rawAreas.length) rawAreas.push({ name: 'Site Overview', lines: ['No area details were supplied.'] });

    const areaIds = new Set();
    const areas = rawAreas.map(area => ({
        id: allocateMapId(areaIds, area.name, 'area'),
        name: area.name,
        knowledge: 'UNREVEALED',
        geometry: [],
        connections: [],
    }));
    const assetIds = new Set();
    const assets = [];
    rawAreas.forEach((rawArea, index) => {
        const area = areas[index];
        for (const line of rawArea.lines) {
            const statements = splitLegacyAssetStatements(line);
            let foundAsset = false;
            for (const statement of statements) {
                const kind = inferLegacyAssetKind(statement);
                if (!kind) {
                    if (statements.length > 1) area.geometry.push(statement);
                    continue;
                }
                foundAsset = true;
                const name = legacyAssetName(statement, kind);
                assets.push({
                    id: allocateMapId(assetIds, name, 'asset'),
                    kind,
                    name,
                    location: area.id,
                    state: inferLegacyAssetState(kind, statement),
                    knowledge: 'UNREVEALED',
                    detail: statement,
                    origin: 'INITIAL_MAP',
                });
            }
            if (!foundAsset && statements.length === 1) area.geometry.push(line);
        }
    });

    // Recover explicit prose connections after every stable area label is known.
    rawAreas.forEach((rawArea, index) => {
        const haystack = rawArea.lines.join(' ').toLowerCase();
        for (const target of areas) {
            if (target.id === areas[index].id) continue;
            if (haystack.includes(target.name.toLowerCase())) {
                areas[index].connections.push({ to: target.id, state: 'OPEN', detail: '' });
            }
        }
    });

    return { version: DUNGEON_MAP_FORMAT_VERSION, site, kind: 'DUNGEON', areas, assets };
}

/** Normalize model-authored structured maps and fill safe defaults/IDs. */
export function normalizeDungeonMapDocument(raw, siteFallback = '') {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return convertLegacyDungeonMapToDocument('', siteFallback);
    }
    const site = String(raw.site || raw.siteRoot || siteFallback || '').trim() || 'Mapped Site';
    const areaIds = new Set();
    const areas = (Array.isArray(raw.areas) ? raw.areas : []).map((area, index) => {
        const name = String(area?.name || area?.label || area?.id || `Area ${index + 1}`).trim();
        const proposed = mapSlug(area?.id || name, `area-${index + 1}`);
        const id = areaIds.has(proposed) ? allocateMapId(areaIds, name, 'area') : (areaIds.add(proposed), proposed);
        return {
            id,
            name,
            knowledge: enumValue(area?.knowledge, AREA_KNOWLEDGE, 'UNREVEALED'),
            geometry: cleanStringList(area?.geometry || area?.features || area?.notes),
            connections: [],
        };
    });
    if (!areas.length) {
        areas.push({ id: 'site-overview', name: 'Site Overview', knowledge: 'UNREVEALED', geometry: [], connections: [] });
        areaIds.add('site-overview');
    }
    const resolveArea = (ref) => {
        const rawRef = String(ref || '').trim();
        if (!rawRef) return '';
        const exact = areas.find(area => area.id === rawRef || normalizeDungeonLabel(area.name) === normalizeDungeonLabel(rawRef));
        return exact?.id || '';
    };
    (Array.isArray(raw.areas) ? raw.areas : []).forEach((area, index) => {
        if (!areas[index]) return;
        const connections = Array.isArray(area?.connections) ? area.connections : [];
        for (const connection of connections) {
            const to = resolveArea(typeof connection === 'string' ? connection : connection?.to);
            if (!to || to === areas[index].id || areas[index].connections.some(item => item.to === to)) continue;
            areas[index].connections.push({
                to,
                state: enumValue(connection?.state, CONNECTION_STATES, 'OPEN'),
                detail: typeof connection === 'object' ? String(connection?.detail || '').trim() : '',
            });
        }
    });

    const assetIds = new Set();
    const rawAssets = Array.isArray(raw.assets) ? raw.assets : [];
    const assets = rawAssets.map((asset, index) => {
        const name = String(asset?.name || asset?.label || asset?.id || `Asset ${index + 1}`).trim();
        const proposed = mapSlug(asset?.id || name, `asset-${index + 1}`);
        const id = assetIds.has(proposed) ? allocateMapId(assetIds, name, 'asset') : (assetIds.add(proposed), proposed);
        const state = enumValue(coerceAssetState(asset?.state), ASSET_STATES, 'ACTIVE');
        const normalized = {
            id,
            kind: enumValue(coerceAssetKind(asset?.kind), ASSET_KINDS, 'OTHER'),
            name,
            location: state === 'REMOVED' && asset?.location == null ? null : String(asset?.location || '').trim(),
            state,
            knowledge: enumValue(asset?.knowledge, ASSET_KNOWLEDGE, 'UNREVEALED'),
            detail: String(asset?.detail || asset?.description || '').trim(),
            origin: String(asset?.origin || 'INITIAL_MAP').trim(),
        };
        if (normalized.kind === 'BUILDING') normalized.notEntered = asset?.notEntered === false ? false : true;
        const lastLocation = String(asset?.last_location || '').trim();
        if (lastLocation) normalized.last_location = lastLocation;
        const behavior = String(asset?.behavior || '').trim();
        if (behavior) normalized.behavior = behavior;
        for (const field of ['faction', 'owner', 'duration', 'cause', 'actor', 'changed_at']) {
            const value = String(asset?.[field] || '').trim();
            if (value) normalized[field] = value;
        }
        const count = Math.floor(Number(asset?.count));
        if (Number.isFinite(count) && count >= 1 && count <= MAX_ASSET_COUNT) normalized.count = count;
        const route = cleanStringList(asset?.route).map(resolveArea).filter(Boolean);
        if (route.length) normalized.route = [...new Set(route)];
        return normalized;
    });
    const locationDocument = { areas, assets };
    for (const asset of assets) {
        if (asset.location != null) {
            const target = resolveMapLocationTarget(locationDocument, asset.location, asset.kind);
            asset.location = target.id || areas[0].id;
        }
        if (asset.last_location) {
            const target = resolveMapLocationTarget(locationDocument, asset.last_location, asset.kind);
            if (target.id) asset.last_location = target.id;
            else delete asset.last_location;
        }
    }
    const threat = normalizeMapSiteThreat(raw.threat, '');
    const document = { version: DUNGEON_MAP_FORMAT_VERSION, site, kind: normalizeMapSiteKind(raw.kind), areas, assets };
    if (threat) document.threat = threat;
    const hostSite = String(raw.hostSite || '').trim();
    const hostBrief = String(raw.hostBrief || '').trim();
    if (hostSite && hostBrief) {
        document.hostSite = hostSite;
        document.hostBrief = hostBrief;
    }
    reconcileAssetAreaKnowledge(document);
    return document;
}

function architectureError(code, path, received, hint) {
    return { code, path, received, hint };
}

/**
 * Reciprocal routes are one physical passage. Mirror a valid one-way route onto
 * its target when the reverse is absent. Models also often rewrite detail from
 * each room (eastward vs westward), so copy the first-seen string onto an
 * existing reverse when state already matches. Ambiguous/conflicting topology
 * remains untouched for strict validation.
 */
export function canonicalizeReciprocalConnectionDetails(areas) {
    if (!Array.isArray(areas)) return areas;
    const areaIds = new Map();
    const duplicateAreaIds = new Set();
    for (const area of areas) {
        const id = String(area?.id || '').trim();
        if (!id) continue;
        if (areaIds.has(id)) duplicateAreaIds.add(id);
        else areaIds.set(id, area);
    }
    const seen = new Set();
    for (const area of areas) {
        const from = String(area?.id || '').trim();
        if (!from || duplicateAreaIds.has(from) || !Array.isArray(area?.connections)) continue;
        for (const connection of area.connections) {
            const to = String(connection?.to || '').trim();
            if (!to || to === from || duplicateAreaIds.has(to)) continue;
            const pair = from < to ? `${from}\0${to}` : `${to}\0${from}`;
            if (seen.has(pair)) continue;
            seen.add(pair);
            const target = areaIds.get(to);
            if (!target || !Array.isArray(target.connections)) continue;
            const reverses = target.connections.filter(candidate => String(candidate?.to || '').trim() === from);
            if (reverses.length === 0) {
                if (!CONNECTION_STATES.includes(connection?.state) || typeof connection?.detail !== 'string') continue;
                target.connections.push({
                    to: from,
                    state: connection.state,
                    detail: connection.detail,
                });
                continue;
            }
            if (reverses.length !== 1) continue;
            const reverse = reverses[0];
            if (reverse.state !== connection.state) continue;
            if (String(reverse.detail || '') !== String(connection.detail || '')) {
                reverse.detail = String(connection.detail || '');
            }
        }
    }
    return areas;
}

/**
 * Strictly validate a newly generated map before it becomes campaign canon.
 * Unlike normalizeDungeonMapDocument(), this never repairs missing topology or
 * silently invents IDs: the Map Architect gets actionable errors and retries.
 */
export function validateDungeonMapArchitecture(raw, { site = '', entrance = '', entranceKnowledge = 'VISITED', scale = '', kind = '', threat = '' } = {}) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
            valid: false,
            errors: [architectureError('INVALID_DOCUMENT', '$', raw, 'Output one JSON object with version, site, areas, and assets.')],
            document: null,
        };
    }

    const allowedTop = new Set(['version', 'site', 'kind', 'threat', 'hostSite', 'hostBrief', 'areas', 'assets']);
    for (const key of Object.keys(raw)) {
        if (!allowedTop.has(key)) errors.push(architectureError('UNKNOWN_FIELD', `$.${key}`, raw[key], `Remove unsupported top-level field "${key}".`));
    }
    if (raw.version !== DUNGEON_MAP_FORMAT_VERSION) {
        errors.push(architectureError('INVALID_VERSION', '$.version', raw.version, `Use numeric version ${DUNGEON_MAP_FORMAT_VERSION}.`));
    }
    const rawSite = typeof raw.site === 'string' ? raw.site.trim() : '';
    if (!rawSite) errors.push(architectureError('MISSING_SITE', '$.site', raw.site, 'Supply the exact site root as a non-empty string.'));
    const exactSiteMatches = rawSite.replace(/\s+/g, ' ').toLocaleLowerCase() === String(site || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (site && rawSite && !exactSiteMatches) {
        errors.push(architectureError('SITE_MISMATCH', '$.site', raw.site, `Use the requested site root exactly: "${site}".`));
    }
    const requestedKind = kind ? normalizeMapSiteKind(kind) : '';
    if (raw.kind != null && raw.kind !== '') {
        const rawKind = String(raw.kind || '').trim().toUpperCase();
        if (!MAP_SITE_KINDS.includes(rawKind)) {
            errors.push(architectureError('INVALID_KIND', '$.kind', raw.kind, 'Use DUNGEON, SETTLEMENT, or INTERIOR.'));
        } else if (requestedKind && rawKind !== requestedKind) {
            errors.push(architectureError('KIND_MISMATCH', '$.kind', raw.kind, `Use the requested kind exactly: "${requestedKind}".`));
        }
    }
    const requestedThreat = normalizeMapSiteThreat(threat, '');
    if (raw.threat != null && raw.threat !== '') {
        const rawThreat = String(raw.threat || '').trim().toUpperCase();
        if (!MAP_SITE_THREATS.includes(rawThreat)) {
            errors.push(architectureError('INVALID_THREAT', '$.threat', raw.threat, 'Use NONE, LOW, MODERATE, HIGH, or DEADLY.'));
        } else if (requestedThreat && rawThreat !== requestedThreat) {
            errors.push(architectureError('THREAT_MISMATCH', '$.threat', raw.threat, `Use the requested threat exactly: "${requestedThreat}".`));
        }
    }
    const effectiveThreat = normalizeMapSiteThreat(raw.threat, requestedThreat);
    if (!Array.isArray(raw.areas) || raw.areas.length < 2) {
        errors.push(architectureError('TOO_FEW_AREAS', '$.areas', raw.areas, 'Supply at least two connected areas.'));
    }
    if (!Array.isArray(raw.assets)) {
        errors.push(architectureError('INVALID_ASSETS', '$.assets', raw.assets, 'Supply an assets array; use [] when there are no assets.'));
    }

    const areas = Array.isArray(raw.areas) ? raw.areas : [];
    const resolvedKind = requestedKind || normalizeMapSiteKind(raw.kind);
    const hostSite = typeof raw.hostSite === 'string' ? raw.hostSite.trim() : '';
    const hostBrief = typeof raw.hostBrief === 'string' ? raw.hostBrief.trim() : '';
    if (!!hostSite !== !!hostBrief) {
        errors.push(architectureError('INCOMPLETE_HOST', '$.hostSite', { hostSite: raw.hostSite, hostBrief: raw.hostBrief }, 'hostSite and hostBrief must either both be non-empty strings or both be omitted.'));
    }
    if ((hostSite || hostBrief) && resolvedKind === 'SETTLEMENT') {
        errors.push(architectureError('HOSTED_SETTLEMENT', '$.hostSite', hostSite, 'SETTLEMENT maps cannot be hosted inside another site.'));
    }
    const scaleBounds = scaleAreaBounds(scale, resolvedKind);
    if (scaleBounds && (areas.length < scaleBounds[0] || areas.length > scaleBounds[1])) {
        errors.push(architectureError('SCALE_AREA_COUNT', '$.areas', areas.length, `${resolvedKind} ${String(scale).toUpperCase()} maps require ${scaleBounds[0]}-${scaleBounds[1]} meaningful areas.`));
    }
    const areaIds = new Set();
    const areaNames = new Set();
    const allowedArea = new Set(['id', 'name', 'knowledge', 'geometry', 'connections']);
    const allAreasVisited = areas.length > 0
        && areas.every(area => area && typeof area === 'object' && !Array.isArray(area) && area.knowledge === 'VISITED');
    areas.forEach((area, index) => {
        const path = `$.areas[${index}]`;
        if (!area || typeof area !== 'object' || Array.isArray(area)) {
            errors.push(architectureError('INVALID_AREA', path, area, 'Each area must be a JSON object.'));
            return;
        }
        for (const key of Object.keys(area)) {
            if (!allowedArea.has(key)) errors.push(architectureError('UNKNOWN_FIELD', `${path}.${key}`, area[key], `Remove unsupported area field "${key}".`));
        }
        const id = typeof area.id === 'string' ? area.id.trim() : '';
        const name = typeof area.name === 'string' ? area.name.trim() : '';
        if (!id || mapSlug(id) !== id) errors.push(architectureError('INVALID_AREA_ID', `${path}.id`, area.id, 'Use a non-empty stable kebab-case ID.'));
        else if (areaIds.has(id)) errors.push(architectureError('DUPLICATE_AREA_ID', `${path}.id`, id, 'Every area ID must be unique.'));
        else areaIds.add(id);
        const nameKey = normalizeDungeonLabel(name);
        if (!name) errors.push(architectureError('MISSING_AREA_NAME', `${path}.name`, area.name, 'Supply a short natural area name.'));
        else if (areaNames.has(nameKey)) errors.push(architectureError('DUPLICATE_AREA_NAME', `${path}.name`, name, 'Every area name must be distinguishable.'));
        else areaNames.add(nameKey);
        if (!AREA_KNOWLEDGE.includes(area.knowledge)) errors.push(architectureError('INVALID_AREA_KNOWLEDGE', `${path}.knowledge`, area.knowledge, `Use one of: ${AREA_KNOWLEDGE.join(', ')}.`));
        if (index === 0 && area.knowledge !== entranceKnowledge) errors.push(architectureError('ENTRANCE_KNOWLEDGE_MISMATCH', `${path}.knowledge`, area.knowledge, `The first/entrance area must use requested knowledge ${entranceKnowledge}.`));
        if (index > 0 && area.knowledge === 'VISITED' && !allAreasVisited) {
            errors.push(architectureError('PREMATURELY_VISITED', `${path}.knowledge`, area.knowledge, 'Only the entrance is VISITED on initial creation unless every area is VISITED for a story-established familiar site; otherwise use DISCOVERED or UNREVEALED.'));
        }
        if (entranceKnowledge !== 'VISITED' && area.knowledge === 'VISITED') {
            errors.push(architectureError('OFFSITE_AREA_VISITED', `${path}.knowledge`, area.knowledge, 'Explicit offsite structural creation does not establish that the party visited any child-map area.'));
        }
        if (index === 0 && entrance && name && !dungeonLabelIdentitiesMatch(name, entrance)) {
            errors.push(architectureError('ENTRANCE_MISMATCH', `${path}.name`, name, `The first area must match the requested entrance: "${entrance}".`));
        }
        if (!Array.isArray(area.geometry)) errors.push(architectureError('INVALID_GEOMETRY', `${path}.geometry`, area.geometry, 'Supply an array of durable geometry strings.'));
        else area.geometry.forEach((fact, factIndex) => {
            if (typeof fact !== 'string' || !fact.trim()) errors.push(architectureError('INVALID_GEOMETRY_FACT', `${path}.geometry[${factIndex}]`, fact, 'Geometry facts must be non-empty strings.'));
        });
        if (!Array.isArray(area.connections)) errors.push(architectureError('INVALID_CONNECTIONS', `${path}.connections`, area.connections, 'Supply a connections array.'));
        else if (areas.length > 1 && area.connections.length === 0) errors.push(architectureError('AREA_WITHOUT_CONNECTION', `${path}.connections`, area.connections, 'Every area must have at least one route. Represent inaccessibility with LOCKED or BLOCKED, never by omitting passages.'));
    });

    const graph = new Map([...areaIds].map(id => [id, new Set()]));
    areas.forEach((area, areaIndex) => {
        if (!area || typeof area !== 'object' || !Array.isArray(area.connections)) return;
        const from = String(area.id || '').trim();
        const seenTargets = new Set();
        area.connections.forEach((connection, connectionIndex) => {
            const path = `$.areas[${areaIndex}].connections[${connectionIndex}]`;
            if (!connection || typeof connection !== 'object' || Array.isArray(connection)) {
                errors.push(architectureError('INVALID_CONNECTION', path, connection, 'Each connection must be an object with to, state, and detail.'));
                return;
            }
            for (const key of Object.keys(connection)) {
                if (!['to', 'state', 'detail'].includes(key)) errors.push(architectureError('UNKNOWN_FIELD', `${path}.${key}`, connection[key], `Remove unsupported connection field "${key}".`));
            }
            const to = typeof connection.to === 'string' ? connection.to.trim() : '';
            if (!areaIds.has(to)) errors.push(architectureError('UNKNOWN_CONNECTION_TARGET', `${path}.to`, connection.to, 'Reference an existing area ID.'));
            else if (to === from) errors.push(architectureError('SELF_CONNECTION', `${path}.to`, to, 'Connect to a different area.'));
            else {
                if (seenTargets.has(to)) errors.push(architectureError('DUPLICATE_CONNECTION', `${path}.to`, to, 'List each outgoing route only once.'));
                seenTargets.add(to);
                graph.get(from)?.add(to);
            }
            if (!CONNECTION_STATES.includes(connection.state)) errors.push(architectureError('INVALID_CONNECTION_STATE', `${path}.state`, connection.state, `Use one of: ${CONNECTION_STATES.join(', ')}.`));
            if (typeof connection.detail !== 'string') errors.push(architectureError('INVALID_CONNECTION_DETAIL', `${path}.detail`, connection.detail, 'Supply a concise string; use "" when no detail is needed.'));
        });
    });

    // Routes are physical topology even when CLOSED/LOCKED/BLOCKED. Every route
    // must be reciprocal so an area can never become unreachable by omission.
    areas.forEach((area, areaIndex) => {
        for (const connection of Array.isArray(area?.connections) ? area.connections : []) {
            const targetIndex = areas.findIndex(candidate => candidate?.id === connection?.to);
            if (targetIndex < 0) continue;
            const reverse = (areas[targetIndex].connections || []).find(candidate => candidate?.to === area.id);
            if (!reverse) {
                errors.push(architectureError('MISSING_RECIPROCAL_CONNECTION', `$.areas[${areaIndex}].connections`, connection.to, `Add the reverse connection from "${connection.to}" to "${area.id}" with the same state.`));
            } else if (reverse.state !== connection.state) {
                errors.push(architectureError('CONNECTION_STATE_MISMATCH', `$.areas[${targetIndex}].connections`, reverse.state, `Use ${connection.state} in both directions.`));
            } else if (String(reverse.detail || '') !== String(connection.detail || '')) {
                errors.push(architectureError(
                    'CONNECTION_DETAIL_MISMATCH',
                    `$.areas[${targetIndex}].connections`,
                    reverse.detail,
                    `Copy this exact detail onto both ends: "${connection.detail}". The reverse currently says "${reverse.detail}".`,
                ));
            }
        }
    });
    if (areas[0]?.id && graph.has(areas[0].id)) {
        const reached = new Set([areas[0].id]);
        const queue = [areas[0].id];
        while (queue.length) {
            for (const target of graph.get(queue.shift()) || []) {
                if (!reached.has(target)) { reached.add(target); queue.push(target); }
            }
        }
        for (const area of areas) {
            if (area?.id && !reached.has(area.id)) errors.push(architectureError('UNREACHABLE_AREA', '$.areas', area.id, 'Connect this area to the entrance graph. Use a LOCKED/BLOCKED route when access is initially prevented.'));
        }
    }

    const assetIds = new Set();
    const allowedAsset = new Set(['id', 'kind', 'name', 'location', 'state', 'knowledge', 'detail', 'origin', 'behavior', 'route', 'faction', 'owner', 'duration', 'count', 'cause', 'actor', 'changed_at']);
    for (let index = 0; index < (Array.isArray(raw.assets) ? raw.assets.length : 0); index++) {
        const asset = raw.assets[index];
        const path = `$.assets[${index}]`;
        if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
            errors.push(architectureError('INVALID_ASSET', path, asset, 'Each asset must be a JSON object.'));
            continue;
        }
        for (const key of Object.keys(asset)) {
            if (!allowedAsset.has(key)) errors.push(architectureError('UNKNOWN_FIELD', `${path}.${key}`, asset[key], `Remove unsupported asset field "${key}".`));
        }
        const id = typeof asset.id === 'string' ? asset.id.trim() : '';
        if (!id || mapSlug(id) !== id) errors.push(architectureError('INVALID_ASSET_ID', `${path}.id`, asset.id, 'Use a non-empty stable kebab-case ID.'));
        else if (assetIds.has(id)) errors.push(architectureError('DUPLICATE_ASSET_ID', `${path}.id`, id, 'Every asset ID must be unique.'));
        else assetIds.add(id);
        if (typeof asset.name !== 'string' || !asset.name.trim()) errors.push(architectureError('MISSING_ASSET_NAME', `${path}.name`, asset.name, 'Supply a concise entity name.'));
        if (!ASSET_KINDS.includes(asset.kind)) errors.push(architectureError('INVALID_ASSET_KIND', `${path}.kind`, asset.kind, `Use one of: ${ASSET_KINDS.join(', ')}.`));
        if (SETTLEMENT_ONLY_ASSET_KINDS.includes(asset.kind) && resolvedKind !== 'SETTLEMENT') {
            errors.push(architectureError('ASSET_KIND_NOT_ALLOWED', `${path}.kind`, asset.kind, `${asset.kind} is allowed only on SETTLEMENT maps.`));
        }
        if (HOSTED_GATEWAY_ASSET_KINDS.includes(asset.kind) && resolvedKind !== 'SETTLEMENT') {
            errors.push(architectureError('RUNTIME_OWNED_GATEWAY', `${path}.kind`, asset.kind, `${asset.kind} gateways on DUNGEON/INTERIOR parents are inserted by CreateAreaMap attachment, not invented inside the new map JSON.`));
        }
        const assetState = coerceAssetState(asset.state);
        if (!ASSET_STATES.includes(assetState)) errors.push(architectureError('INVALID_ASSET_STATE', `${path}.state`, asset.state, `Use one of: ${ASSET_STATES.join(', ')}.`));
        const noneSafeThreatStates = ['DORMANT', 'DESTROYED', 'DISABLED', 'DEACTIVATED', 'CLEARED', 'EXPIRED', 'DISMISSED', 'REMOVED', 'LEFT'];
        if (effectiveThreat === 'NONE' && ['TRAP', 'HAZARD', 'ALARM'].includes(asset.kind) && !noneSafeThreatStates.includes(assetState)) {
            errors.push(architectureError('NONE_THREAT_ACTIVE_DANGER', path, asset, 'Threat NONE cannot contain an active trap, hazard, or alarm. Remove it, use a safely inactive state, or request LOW or higher when real danger exists.'));
        }
        if (!ASSET_KNOWLEDGE.includes(asset.knowledge)) errors.push(architectureError('INVALID_ASSET_KNOWLEDGE', `${path}.knowledge`, asset.knowledge, `Use one of: ${ASSET_KNOWLEDGE.join(', ')}.`));
        if (!areaIds.has(asset.location)) errors.push(architectureError('UNKNOWN_ASSET_LOCATION', `${path}.location`, asset.location, 'Place every initial asset in an existing area.'));
        else if (['KNOWN', 'SUSPECTED'].includes(asset.knowledge)) {
            const containingArea = areas.find(area => area?.id === asset.location);
            if (containingArea?.knowledge === 'UNREVEALED') {
                errors.push(architectureError(
                    'ASSET_KNOWLEDGE_AREA_MISMATCH',
                    `${path}.knowledge`,
                    asset.knowledge,
                    'A KNOWN or SUSPECTED initial asset must occupy a DISCOVERED or VISITED area. The locked topology cannot be changed during content placement, so use UNREVEALED here.',
                ));
            }
        }
        if (typeof asset.detail !== 'string') errors.push(architectureError('INVALID_ASSET_DETAIL', `${path}.detail`, asset.detail, 'Supply a concise string; use "" when no detail is needed.'));
        if (asset.origin !== 'INITIAL_MAP') errors.push(architectureError('INVALID_ASSET_ORIGIN', `${path}.origin`, asset.origin, 'Initial Map Architect assets must use origin "INITIAL_MAP".'));
        for (const field of ['behavior', 'faction', 'owner', 'duration', 'cause', 'actor', 'changed_at']) {
            if (asset[field] !== undefined && (typeof asset[field] !== 'string' || !asset[field].trim())) {
                errors.push(architectureError('INVALID_ASSET_METADATA', `${path}.${field}`, asset[field], `Optional ${field} must be a non-empty string when present.`));
            }
        }
        if (asset.count !== undefined) {
            const count = Math.floor(Number(asset.count));
            if (!Number.isFinite(count) || count < 1 || count > MAX_ASSET_COUNT) {
                errors.push(architectureError('INVALID_COUNT', `${path}.count`, asset.count, `count is living members of this one asset (1-${MAX_ASSET_COUNT}). Packs stay one GROUP with count; use DESTROYED/DEAD instead of 0.`));
            } else if (asset.kind === 'GROUP' && count < 2) {
                errors.push(architectureError('GROUP_COUNT_TOO_SMALL', `${path}.count`, asset.count, 'A GROUP must contain at least 2 members. Represent one cook, clerk, guard, servant, animal, construct, or other single being as CREATURE.'));
            }
        }
        if (asset.route !== undefined) {
            if (!Array.isArray(asset.route) || asset.route.some(ref => !areaIds.has(ref))) errors.push(architectureError('INVALID_ASSET_ROUTE', `${path}.route`, asset.route, 'Route must be an array containing only existing area IDs.'));
        }
    }

    const document = errors.length === 0 ? normalizeDungeonMapDocument(raw, site || rawSite) : null;
    if (document && site) document.site = String(site).trim();
    if (document) document.kind = resolvedKind;
    if (document) {
        document.threat = normalizeMapSiteThreat(
            raw.threat,
            requestedThreat || defaultMapSiteThreat(resolvedKind),
        );
    }
    return {
        valid: errors.length === 0,
        errors,
        document,
    };
}

/** Parse either a v3 JSON map or a legacy prose map without losing its facts. */
export function parseDungeonMapDocument(content, siteFallback = '') {
    const structured = tryParseStructuredMap(content);
    if (structured) {
        return { document: normalizeDungeonMapDocument(structured, siteFallback), migrated: Number(structured.version) !== DUNGEON_MAP_FORMAT_VERSION };
    }
    return { document: convertLegacyDungeonMapToDocument(content, siteFallback), migrated: true };
}

export function serializeDungeonMapDocument(document) {
    return JSON.stringify(normalizeDungeonMapDocument(document, document?.site), null, 2);
}

/** Parse user-edited map JSON from the inspector Raw JSON tab. */
export function parseEditableDungeonMapJson(text, siteRoot = '') {
    const source = stripJsonFence(text);
    if (!source) return { ok: false, errors: ['JSON is empty.'], document: null };
    if (!source.startsWith('{')) {
        return { ok: false, errors: ['JSON must be one object starting with {.'], document: null };
    }
    let parsed;
    try {
        parsed = JSON.parse(source);
    } catch (error) {
        return { ok: false, errors: [String(error?.message || error || 'Invalid JSON.')], document: null };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, errors: ['JSON must be one object with version, site, areas, and assets.'], document: null };
    }
    const site = String(siteRoot || '').trim();
    const rawSite = String(parsed.site || '').trim();
    if (site && rawSite && !dungeonSiteRootsMatch(rawSite, site)) {
        return {
            ok: false,
            errors: [`site must stay "${site}". Received "${rawSite}".`],
            document: null,
        };
    }
    const rawKind = String(parsed.kind || '').trim().toUpperCase();
    if (rawKind && !MAP_SITE_KINDS.includes(rawKind)) {
        return { ok: false, errors: [`kind must be one of: ${MAP_SITE_KINDS.join(', ')}.`], document: null };
    }
    const hostSite = String(parsed.hostSite || '').trim();
    const hostBrief = String(parsed.hostBrief || '').trim();
    if (!!hostSite !== !!hostBrief) {
        return { ok: false, errors: ['hostSite and hostBrief must both be present or both be omitted.'], document: null };
    }
    if ((hostSite || hostBrief) && rawKind === 'SETTLEMENT') {
        return { ok: false, errors: ['SETTLEMENT maps cannot have hostSite/hostBrief.'], document: null };
    }
    const invalidAsset = (Array.isArray(parsed.assets) ? parsed.assets : []).find(asset => {
        const assetKind = coerceAssetKind(asset?.kind, { legacyStructuralAlias: false });
        return !ASSET_KINDS.includes(assetKind)
            || (SETTLEMENT_ONLY_ASSET_KINDS.includes(assetKind) && rawKind !== 'SETTLEMENT');
    });
    if (invalidAsset) {
        const assetKind = coerceAssetKind(invalidAsset.kind, { legacyStructuralAlias: false });
        const message = ASSET_KINDS.includes(assetKind)
            ? `${assetKind} assets are allowed only on SETTLEMENT maps.`
            : `asset kind must be one of: ${ASSET_KINDS.join(', ')}.`;
        return { ok: false, errors: [message], document: null };
    }
    const rawAreas = Array.isArray(parsed.areas) ? parsed.areas : [];
    const rawAssets = Array.isArray(parsed.assets) ? parsed.assets : [];
    const findRawContainer = (ref) => {
        const received = String(ref || '').trim();
        const byId = rawAssets.find(asset => String(asset?.id || '').trim() === received);
        if (byId) return byId;
        const byName = rawAssets.filter(asset => normalizeDungeonLabel(asset?.name) === normalizeDungeonLabel(received));
        return byName.length === 1 ? byName[0] : null;
    };
    for (const asset of rawAssets) {
        const assetKind = coerceAssetKind(asset?.kind, { legacyStructuralAlias: false });
        if (asset?.notEntered !== undefined && (assetKind !== 'BUILDING' || typeof asset.notEntered !== 'boolean')) {
            return { ok: false, errors: ['notEntered must be a boolean and is valid only on BUILDING assets.'], document: null };
        }
        if (asset?.location == null && coerceAssetState(asset?.state) === 'REMOVED') continue;
        const area = rawAreas.find(item => String(item?.id || '').trim() === String(asset?.location || '').trim());
        if (area) continue;
        const container = findRawContainer(asset?.location);
        if (!container || !canAssetKindBeContainedBy(assetKind, container.kind)) {
            return { ok: false, errors: [`${asset?.name || asset?.id || 'Asset'} has an invalid area/container location.`], document: null };
        }
    }
    const document = normalizeDungeonMapDocument(parsed, site || rawSite);
    if (!Array.isArray(document.areas) || !document.areas.length) {
        return { ok: false, errors: ['Map must include at least one area.'], document: null };
    }
    if (!Array.isArray(document.assets)) {
        return { ok: false, errors: ['Map must include an assets array.'], document: null };
    }
    if (site) document.site = site;
    return { ok: true, errors: [], document };
}

function mapAssetId(asset) {
    return String(asset?.id || '').trim();
}

function listDirectContainedAssets(assets, parentId, ancestors = new Set()) {
    const id = String(parentId || '').trim();
    if (!id) return [];
    return (assets || []).filter((candidate) => {
        const childId = mapAssetId(candidate);
        if (!childId || ancestors.has(childId)) return false;
        return String(candidate.location || '').trim() === id;
    });
}

function isContainedByOtherAsset(assets, asset) {
    const loc = String(asset?.location || '').trim();
    const id = mapAssetId(asset);
    if (!loc) return false;
    return (assets || []).some((parent) => {
        const parentId = mapAssetId(parent);
        return parentId && parentId === loc && parentId !== id;
    });
}

function formatMapAsset(asset, areasById, depth = 0) {
    const indent = '  '.repeat(depth);
    const tags = [asset.kind, asset.state, asset.knowledge].filter(Boolean).join(' / ');
    const countLabel = Number.isInteger(asset.count) ? ` ×${asset.count}` : '';
    const lines = [`${indent}- ${asset.name}${countLabel} [${tags}]${asset.detail ? ` — ${asset.detail}` : ''}`];
    const metadata = [];
    if (Number.isInteger(asset.count)) metadata.push(`Count: ${asset.count}`);
    if (asset.behavior) metadata.push(`Behavior: ${asset.behavior}`);
    if (asset.route?.length) {
        metadata.push(`Route: ${asset.route.map(id => areasById.get(id)?.name || id).join(' -> ')}`);
    }
    if (asset.faction) metadata.push(`Faction: ${asset.faction}`);
    if (asset.owner) metadata.push(`Owner: ${asset.owner}`);
    if (asset.duration) metadata.push(`Duration: ${asset.duration}`);
    if (asset.actor) metadata.push(`Actor: ${asset.actor}`);
    if (asset.cause) metadata.push(`Cause: ${asset.cause}`);
    if (asset.changed_at) metadata.push(`Since: ${asset.changed_at}`);
    if (asset.origin && asset.origin !== 'INITIAL_MAP') metadata.push(`Origin: ${asset.origin}`);
    if (asset.last_location) metadata.push(`Last location: ${areasById.get(asset.last_location)?.name || asset.last_location}`);
    if (metadata.length) lines.push(`${indent}  ${metadata.join('; ')}`);
    return lines;
}

function formatMapAssetTree(document, asset, areasById, { visible = () => true, depth = 0, ancestors = new Set() } = {}) {
    if (!visible(asset)) return [];
    const id = mapAssetId(asset);
    if (id && ancestors.has(id)) return [];
    const nested = new Set(ancestors);
    if (id) nested.add(id);
    const lines = formatMapAsset(asset, areasById, depth);
    for (const child of listDirectContainedAssets(document.assets, id, nested)) {
        lines.push(...formatMapAssetTree(document, child, areasById, { visible, depth: depth + 1, ancestors: nested }));
    }
    return lines;
}

function formatMapRoutes(document, areasById) {
    const routes = [];
    const seen = new Set();
    for (const area of document.areas) {
        for (const connection of area.connections || []) {
            const target = areasById.get(connection.to);
            if (!target) continue;
            const reverse = (target.connections || []).find(candidate =>
                candidate.to === area.id
                && candidate.state === connection.state
                && String(candidate.detail || '') === String(connection.detail || ''));
            const pairKey = [area.id, target.id].sort().join('|');
            const key = reverse ? `pair:${pairKey}:${connection.state}:${connection.detail || ''}` : `one:${area.id}:${target.id}:${connection.state}:${connection.detail || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const arrow = reverse ? '<->' : '->';
            routes.push(`- ${area.name} ${arrow} ${target.name} [${connection.state}]${connection.detail ? ` — ${connection.detail}` : ''}`);
        }
    }
    return routes;
}

/**
 * Render a structured current map as compact adjudication prose. The stored JSON
 * remains authoritative for Lorebook Agent tools; this representation is for
 * humans and the narrator, where field names/braces/IDs are needless token cost.
 */
export function formatDungeonMapForNarrator(documentOrContent, siteFallback = '') {
    const document = typeof documentOrContent === 'string'
        ? parseDungeonMapDocument(documentOrContent, siteFallback).document
        : normalizeDungeonMapDocument(documentOrContent, siteFallback || documentOrContent?.site);
    const areasById = new Map(document.areas.map(area => [area.id, area]));
    const assetsByArea = new Map(document.areas.map(area => [area.id, []]));
    const unplacedAssets = [];
    for (const asset of document.assets) {
        const bucket = assetOccupiesMap(asset) && asset.location ? assetsByArea.get(asset.location) : null;
        if (bucket) bucket.push(asset);
        else unplacedAssets.push(asset);
    }

    const lines = [`Dungeon Site: ${document.site}`];
    const mapKind = normalizeMapSiteKind(document.kind);
    if (mapKind === 'SETTLEMENT') {
        lines.push('Map kind: SETTLEMENT (district-scale). Invent granular interiors during play if they do not contradict these districts. When the party enters one, name it in the Location footer (Site, District, Interior). Do not open a new map for an alley, shop, or house.');
    } else if (mapKind === 'INTERIOR') {
        lines.push('Map kind: INTERIOR (room-scale significant interior). Prefer this stable room graph; ordinary rooms and incidental features may be added only when play requires them and established facts remain intact. Footer: preserve the full site breadcrumb and end with the exact current map area; hosted paths may exceed three tiers.');
    } else {
        lines.push('Map kind: DUNGEON (room-scale). Prefer this interior; you may add a room if play requires it, so long as it does not contradict established facts. Footer: preserve the full site breadcrumb and end with the exact current map area; hosted paths may exceed three tiers.');
    }
    if (document.threat) {
        lines.push(document.threat === 'NONE'
            ? 'Site threat: NONE. Do not invent active hostile occupancy, armed traps, dangerous hazards, or violent conflict.'
            : `Site threat: ${document.threat}. Enemy, trap, and hazard density follow this site danger — not party level.`);
    }
    const routes = formatMapRoutes(document, areasById);
    if (routes.length) lines.push('', 'Routes:', ...routes);

    for (const area of document.areas) {
        lines.push('', `Area: ${area.name} [${area.knowledge}]`);
        for (const fact of area.geometry) lines.push(`- ${fact}`);
        const assets = assetsByArea.get(area.id) || [];
        if (assets.length) {
            lines.push('Assets:');
            for (const asset of assets) lines.push(...formatMapAssetTree(document, asset, areasById));
        }
    }
    const unplacedRoots = unplacedAssets.filter(asset => !isContainedByOtherAsset(document.assets, asset));
    if (unplacedRoots.length) {
        lines.push('', 'Removed / departed / unplaced assets:');
        for (const asset of unplacedRoots) {
            lines.push(...formatMapAssetTree(document, asset, areasById));
        }
    }
    return lines.join('\n').trim();
}

/**
 * Player-facing map prose for Adventure Companion.
 * Matches Visuals/Map with Reveal all off: visited rooms in full, discovered
 * names only, unrevealed neighbors as Unexplored, and no hidden assets.
 */
export function formatDungeonMapForPlayer(documentOrContent, currentLocation = '') {
    const document = typeof documentOrContent === 'string'
        ? parseDungeonMapDocument(documentOrContent, '').document
        : normalizeDungeonMapDocument(documentOrContent, documentOrContent?.site);
    const areasById = new Map(document.areas.map(area => [area.id, area]));
    const revealedAreas = document.areas.filter(area =>
        area.knowledge === 'VISITED' || area.knowledge === 'DISCOVERED');
    const revealedIds = new Set(revealedAreas.map(area => area.id));
    const placement = resolveCurrentMapPlacement(document, currentLocation);
    const areaLabel = (id) => (revealedIds.has(id) ? (areasById.get(id)?.name || id) : 'Unexplored');
    const isPlayerVisibleAsset = (asset) => {
        const knowledge = String(asset?.knowledge || '').toUpperCase();
        return knowledge === 'KNOWN' || knowledge === 'SUSPECTED';
    };

    const lines = [`Site: ${document.site}`];
    const mapKind = normalizeMapSiteKind(document.kind);
    lines.push(mapKind === 'SETTLEMENT'
        ? 'Kind: SETTLEMENT (district-scale)'
        : mapKind === 'INTERIOR'
            ? 'Kind: INTERIOR (room-scale)'
            : 'Kind: DUNGEON (room-scale)');
    if (placement.area && revealedIds.has(placement.area.id)) {
        const interior = placement.interiorAsset && isPlayerVisibleAsset(placement.interiorAsset)
            ? placement.interiorAsset.name
            : (placement.unmatchedInterior || '');
        lines.push(interior
            ? `You are here: ${placement.area.name} (in ${interior})`
            : `You are here: ${placement.area.name}`);
    } else if (currentLocation) {
        lines.push(`Current location: ${currentLocation}`);
    }

    const routes = [];
    const seen = new Set();
    for (const area of revealedAreas) {
        for (const connection of area.connections || []) {
            const target = areasById.get(connection.to);
            if (!target) continue;
            const pairKey = [area.id, target.id].sort().join('|');
            const key = `${pairKey}:${connection.state}:${connection.detail || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const targetRevealed = revealedIds.has(connection.to);
            const detail = targetRevealed && connection.detail ? ` — ${connection.detail}` : '';
            routes.push(`- ${area.name} -> ${areaLabel(connection.to)} [${connection.state}]${detail}`);
        }
    }
    if (routes.length) lines.push('', 'Known routes:', ...routes);

    for (const area of revealedAreas) {
        const here = placement.area?.id === area.id ? ' (you are here)' : '';
        lines.push('', `Area: ${area.name} [${area.knowledge}]${here}`);
        if (area.knowledge !== 'VISITED') {
            lines.push('- Seen from outside; interior not yet revealed.');
            continue;
        }
        for (const fact of area.geometry) lines.push(`- ${fact}`);
        const assets = document.assets.filter(asset =>
            asset.location === area.id && assetOccupiesMap(asset) && isPlayerVisibleAsset(asset));
        if (assets.length) {
            lines.push('Known occupants / objects:');
            for (const asset of assets) lines.push(...formatMapAssetTree(document, asset, areasById, { visible: isPlayerVisibleAsset }));
        }
    }
    if (!revealedAreas.length) {
        lines.push('', 'No revealed rooms or districts yet.');
    }
    return lines.join('\n').trim();
}

/** Replace only the private map section, retaining [CORE] and visible chronicles. */
export function replaceDungeonMapSection(content, mapBody) {
    const body = String(mapBody || '').trim();
    const source = String(content || '');
    if (MAP_SECTION_RE.test(source)) return source.replace(MAP_SECTION_RE, `[MAP]\n${body}\n[/MAP]`);
    const visible = source.trimEnd();
    return `${visible}${visible ? '\n\n' : ''}[MAP]\n${body}\n[/MAP]`;
}

/** Return the private map body stored in a normal lorebook [MAP] section. */
export function extractDungeonMapSection(content) {
    return String(content || '').match(MAP_SECTION_RE)?.[1]?.trim() || '';
}

/** Remove [MAP] from display/narrator copies while leaving stored content intact. */
export function stripDungeonMapSection(content) {
    return String(content || '')
        .replace(MAP_SECTION_RE, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Return the selected plain-text body for either ST or API message shapes. */
export function getDungeonMessageText(message) {
    if (!message) return '';
    if (typeof message.mes === 'string') return message.mes;
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
        return message.content
            .filter(part => part?.type === 'text' && typeof part.text === 'string')
            .map(part => part.text)
            .join('\n');
    }
    return '';
}

function extractHiddenDivs(text) {
    const blocks = [];
    const source = String(text || '');
    DIV_RE.lastIndex = 0;
    let match;
    while ((match = DIV_RE.exec(source)) !== null) {
        const attributes = String(match[1] || '');
        if (!hasHiddenAttribute(attributes)) continue;
        const body = String(match[2] || '').trim();
        if (!body) continue;
        blocks.push({
            attributes,
            body,
            isMap: hasDungeonMapAttribute(attributes),
            isDelta: hasDungeonDeltaAttribute(attributes),
        });
    }
    return blocks;
}

/** Extract immutable map candidates, excluding explicit status-delta blocks. */
export function extractHiddenDungeonMapBlocks(text) {
    return extractHiddenDivs(text)
        .filter(block => !block.isDelta)
        .map(block => block.body);
}

/** Read a private map attachment from a lorebook Location entry. */
export function getDungeonMapAttachment(entry) {
    const mapSection = extractDungeonMapSection(entry?.content);
    if (mapSection) {
        const parsed = parseDungeonMapDocument(mapSection, String(entry?.comment || '').trim());
        return {
            version: DUNGEON_MAP_FORMAT_VERSION,
            siteRoot: parsed.document.site || String(entry?.comment || '').trim(),
            content: mapSection,
            storage: 'content',
            structured: !parsed.migrated,
        };
    }
    const attachment = entry?.extensions?.[DUNGEON_MAP_EXTENSION_KEY];
    if (!attachment || typeof attachment !== 'object') return null;
    const siteRoot = String(attachment.siteRoot || entry?.comment || '').trim();
    const content = String(attachment.content || '').trim();
    if (!siteRoot || !content) return null;
    return { ...attachment, siteRoot, content, storage: 'legacy-extension' };
}

/** Attach the immutable initial map without replacing an existing attachment. */
export function attachDungeonMapToLocationEntry(entry, map) {
    if (!entry || !map || extractDungeonMapSection(entry.content)) return false;
    const siteRoot = String(map.siteRoot || entry.comment || '').trim();
    const content = String(map.content || '').trim();
    if (!siteRoot || !content) return false;
    const document = parseDungeonMapDocument(content, siteRoot).document;
    const visible = stripDungeonMapSection(entry.content);
    entry.content = `${visible}${visible ? '\n\n' : ''}[MAP]\n${serializeDungeonMapDocument(document)}\n[/MAP]`;
    if (entry.extensions?.[DUNGEON_MAP_EXTENSION_KEY]) {
        delete entry.extensions[DUNGEON_MAP_EXTENSION_KEY];
    }
    return true;
}

/** Strip [MAP] (and any leftover extension blob) while keeping [CORE] and chronicles. */
export function detachDungeonMapFromLocationEntry(entry) {
    if (!entry) return false;
    const hadSection = !!extractDungeonMapSection(entry.content);
    const hadLegacy = !!(entry.extensions && entry.extensions[DUNGEON_MAP_EXTENSION_KEY]);
    const hadOps = !!(entry.extensions && entry.extensions[DUNGEON_MAP_OPERATION_IDS_KEY]);
    if (!hadSection && !hadLegacy && !hadOps) return false;
    if (hadSection) entry.content = stripDungeonMapSection(entry.content);
    if (entry.extensions) {
        delete entry.extensions[DUNGEON_MAP_EXTENSION_KEY];
        delete entry.extensions[DUNGEON_MAP_OPERATION_IDS_KEY];
    }
    return true;
}

/** Upgrade the earlier private-extension representation to normal [MAP] lore. */
export function migrateDungeonMapAttachmentToContent(entry) {
    const legacy = entry?.extensions?.[DUNGEON_MAP_EXTENSION_KEY];
    if (!legacy || typeof legacy !== 'object' || extractDungeonMapSection(entry.content)) return false;
    return attachDungeonMapToLocationEntry(entry, legacy);
}

/** Extract explicit append-only status blocks from a narrator message. */
export function extractHiddenDungeonDeltaBlocks(text) {
    return extractHiddenDivs(text)
        .filter(block => block.isDelta)
        .map(block => block.body);
}

/** Parse the intentionally small, prose-friendly delta cue format. */
export function parseDungeonDeltaBlock(block) {
    const text = String(block || '').trim();
    const siteRoot = text.match(SITE_MARKER_RE)?.[1]?.trim() || '';
    const entries = [];
    const errors = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || SITE_MARKER_RE.test(line)) continue;
        const match = line.match(DELTA_LINE_RE);
        if (!match) {
            errors.push(`unrecognized delta line: "${line}"`);
            continue;
        }
        const type = match[1].toLowerCase();
        const label = match[2].trim();
        const detail = match[3].trim();
        if (!label || !detail) {
            errors.push(`delta line requires both a label and detail: "${line}"`);
            continue;
        }
        entries.push(type === 'addition'
            ? { type, label, detail }
            : { type, label, state: detail });
    }
    if (!entries.length && !errors.length) errors.push('delta block contains no mutation or addition lines');
    return { siteRoot, entries, errors };
}

/** Extract the last status-footer location from a narrator message. */
export function extractFooterLocation(text) {
    const source = String(text || '');
    LOCATION_RE.lastIndex = 0;
    let location = '';
    let match;
    while ((match = LOCATION_RE.exec(source)) !== null) {
        location = String(match[1] || '').trim();
    }
    return location;
}

function splitLocationSegments(location) {
    return String(location || '')
        .split(/\s*(?:::|,|\/|>|›|»|→)\s*/)
        .map(part => part.trim())
        .filter(Boolean);
}

/**
 * Exterior-relative footer leaf: position near a landmark in the district,
 * not a named interior the party has entered.
 * e.g. "behind the general store", "outside the inn", "near the chapel".
 */
const EXTERIOR_RELATIVE_LOCATION_RE = /^(?:behind|beside|besides|near|outside|around|past|across from|in front of|at the (?:back|rear|side|front) of|next to|by|along|beyond|opposite(?:\s+to)?|against)\s+(?:the\s+)?(.+)$/i;

/** Explicit interior phrasing that should resolve to an existing structure name. */
const INTERIOR_OF_LOCATION_RE = /^(?:inside|within|in)\s+(?:the\s+)?(.+)$/i;

const FOOTER_REFERENTIAL_STRUCTURE_KINDS = new Set(['BUILDING', 'OBJECT']);

/** Word-boundary containment for landmark referents ("general store" ⊂ "Hollow Creek General Store"). */
function dungeonLabelContainsMatch(left, right) {
    const a = normalizeDungeonLabel(left);
    const b = normalizeDungeonLabel(right);
    if (!a || !b) return false;
    if (dungeonLabelsMatch(a, b)) return true;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (shorter.length < 8) return false;
    return (` ${longer} `).includes(` ${shorter} `);
}

function classifyFooterInteriorLeaf(label) {
    const text = String(label || '').trim();
    if (!text) return { kind: 'empty', referent: '' };
    const exterior = text.match(EXTERIOR_RELATIVE_LOCATION_RE);
    if (exterior) return { kind: 'exterior_relative', referent: String(exterior[1] || '').trim() };
    const interior = text.match(INTERIOR_OF_LOCATION_RE);
    if (interior) return { kind: 'interior_of', referent: String(interior[1] || '').trim() };
    return { kind: 'named', referent: text };
}

function findSettlementInteriorAsset(map, label) {
    const text = String(label || '').trim();
    if (!text) return null;
    const exact = resolveMapAsset(map, text).asset
        || map.assets.find(asset => dungeonLabelIdentitiesMatch(asset.name, text))
        || null;
    if (exact) return exact;
    return map.assets.find(asset =>
        FOOTER_REFERENTIAL_STRUCTURE_KINDS.has(String(asset.kind || '').toUpperCase())
        && dungeonLabelContainsMatch(asset.name, text)
    ) || null;
}

/**
 * Decide whether a footer leaf after the matched district is a real interior
 * name, an exterior-relative landmark phrase, or an "inside X" phrasing.
 */
function resolveFooterInteriorAgainstMap(map, unmatchedInterior) {
    const classified = classifyFooterInteriorLeaf(unmatchedInterior);
    if (classified.kind === 'empty') {
        return { interiorAsset: null, unmatchedInterior: '' };
    }
    // Outside / behind / near a landmark: stay on the district. Never invent a
    // BUILDING from positional phrasing even when the landmark already exists.
    if (classified.kind === 'exterior_relative') {
        return { interiorAsset: null, unmatchedInterior: '' };
    }
    const interiorAsset = findSettlementInteriorAsset(map, unmatchedInterior)
        || findSettlementInteriorAsset(map, classified.referent);
    if (interiorAsset) {
        return { interiorAsset, unmatchedInterior: '' };
    }
    // "inside the general store" with no matching asset → track the referent name.
    if (classified.kind === 'interior_of') {
        return { interiorAsset: null, unmatchedInterior: classified.referent };
    }
    return { interiorAsset: null, unmatchedInterior };
}

/** Top-level footer segment, used as the stable site binding unit. */
export function getSiteRootFromLocation(location) {
    return splitLocationSegments(location)[0] || '';
}

/** Deepest footer segment, used to highlight the current mapped area. */
export function getLocationLeaf(location) {
    const parts = splitLocationSegments(location);
    return parts.at(-1) || '';
}

/**
 * Bind a location footer to a map area, and optionally to an occupying asset
 * when the leaf is a settlement interior (chapel, inn) rather than a district/room.
 */
export function resolveCurrentMapPlacement(document, currentLocation = '') {
    const map = normalizeDungeonMapDocument(document, document?.site);
    const parts = splitLocationSegments(currentLocation);
    if (!parts.length) return { area: null, interiorAsset: null, unmatchedInterior: '' };

    for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        const area = resolveMapArea(map, part).area;
        if (area) {
            const rawInterior = parts.slice(i + 1).join(', ');
            if (!rawInterior) return { area, interiorAsset: null, unmatchedInterior: '' };
            const resolved = resolveFooterInteriorAgainstMap(map, rawInterior);
            return { area, interiorAsset: resolved.interiorAsset, unmatchedInterior: resolved.unmatchedInterior };
        }
        // Exterior-relative leaves never bind as interiors even if a wrongly
        // named asset exists from a prior bad updater pass.
        if (classifyFooterInteriorLeaf(part).kind === 'exterior_relative') continue;
        const asset = resolveMapAsset(map, part).asset
            || findSettlementInteriorAsset(map, part)
            || null;
        if (asset) {
            const host = resolveAssetEffectiveArea(map, asset);
            return {
                area: host,
                interiorAsset: asset,
                unmatchedInterior: host ? '' : part,
            };
        }
    }
    const leaf = parts.at(-1) || '';
    if (classifyFooterInteriorLeaf(leaf).kind === 'exterior_relative') {
        return { area: null, interiorAsset: null, unmatchedInterior: '' };
    }
    return { area: null, interiorAsset: null, unmatchedInterior: leaf };
}

/** Deterministic first-entry target derived only from the active settlement map and GM footer. */
export function resolveBuildingPopulationTarget(document, currentLocation = '') {
    const map = normalizeDungeonMapDocument(document, document?.site);
    if (normalizeMapSiteKind(map.kind) !== 'SETTLEMENT') return null;
    const placement = resolveCurrentMapPlacement(map, currentLocation);
    if (!placement.area) return null;
    if (placement.interiorAsset?.kind === 'BUILDING' && placement.interiorAsset.notEntered !== false) {
        return {
            building: placement.interiorAsset,
            area: placement.area,
            children: map.assets.filter(asset => asset.location === placement.interiorAsset.id),
            untrackedName: '',
        };
    }
    if (!placement.interiorAsset && placement.unmatchedInterior) {
        return { building: null, area: placement.area, children: [], untrackedName: placement.unmatchedInterior };
    }
    return null;
}

/**
 * Resolve a unique pending BUILDING explicitly referenced by the player's new
 * action. This runs before narration, so it deliberately does not depend on a
 * footer claiming that entry already happened.
 */
export function resolveBuildingIntentPopulationTarget(document, currentLocation = '', playerText = '') {
    const map = normalizeDungeonMapDocument(document, document?.site);
    if (normalizeMapSiteKind(map.kind) !== 'SETTLEMENT') return null;
    const normalizedText = normalizeDungeonLabel(playerText);
    if (!normalizedText) return null;
    const paddedText = ` ${normalizedText} `;
    const siteTokens = new Set(normalizeDungeonLabel(map.site).split(' ').filter(Boolean));
    const pending = map.assets.filter(asset =>
        asset.kind === 'BUILDING'
        && assetOccupiesMap(asset)
        && asset.notEntered !== false
        && resolveAssetEffectiveArea(map, asset));
    const scored = pending.map((building) => {
        const normalizedName = normalizeDungeonLabel(building.name);
        if (!normalizedName) return { building, score: 0 };
        if (paddedText.includes(` ${normalizedName} `)) return { building, score: 1000 + normalizedName.length };
        const nameTokens = normalizedName.split(' ').filter(Boolean);
        const withoutSite = nameTokens.filter(token => !siteTokens.has(token)).join(' ');
        if (withoutSite.length >= 4 && paddedText.includes(` ${withoutSite} `)) {
            return { building, score: 500 + withoutSite.length };
        }
        const distinctive = nameTokens
            .filter(token => token.length >= 5 && !siteTokens.has(token))
            .filter(token => paddedText.includes(` ${token} `));
        return { building, score: distinctive.length ? Math.max(...distinctive.map(token => token.length)) : 0 };
    }).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length || (scored[1] && scored[1].score === scored[0].score)) return null;
    const building = scored[0].building;
    const area = resolveAssetEffectiveArea(map, building);
    if (!area) return null;
    return {
        building,
        area,
        children: map.assets.filter(asset => asset.location === building.id),
        untrackedName: '',
        phase: 'intent',
        playerText: String(playerText || '').trim(),
        previousPlacement: resolveCurrentMapPlacement(map, currentLocation),
    };
}

/** Light normalization for footer drift without introducing opaque IDs. */
export function normalizeDungeonLabel(label) {
    return String(label || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[’'`]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(LEADING_ARTICLE_RE, '');
}

function editDistance(a, b) {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        let diagonal = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const above = row[j];
            row[j] = Math.min(
                row[j] + 1,
                row[j - 1] + 1,
                diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
            diagonal = above;
        }
    }
    return row[b.length];
}

function dungeonLabelEditDistanceMatch(left, right) {
    const a = normalizeDungeonLabel(left);
    const b = normalizeDungeonLabel(right);
    if (!a || !b) return false;
    if (a === b) return true;
    const allowance = Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.12));
    return editDistance(a, b) <= allowance;
}

/**
 * Site-root identity for map activation. Nearby places that mention a mapped
 * site ("Forest Near the Hall of the Ember-Ancestors") must not count as inside it.
 */
export function dungeonSiteRootsMatch(left, right) {
    return dungeonLabelIdentitiesMatch(left, right);
}

function locationPathMatchScore(location, siteRoot) {
    const locationSegments = splitLocationSegments(location);
    const siteSegments = splitLocationSegments(siteRoot);
    if (!locationSegments.length || !siteSegments.length) return null;
    let best = null;
    for (let start = 0; start <= locationSegments.length - siteSegments.length; start++) {
        const matches = siteSegments.every((segment, offset) => dungeonSiteRootsMatch(locationSegments[start + offset], segment));
        if (!matches) continue;
        const score = { depth: siteSegments.length, endIndex: start + siteSegments.length - 1 };
        if (!best || score.depth > best.depth || (score.depth === best.depth && score.endIndex > best.endIndex)) best = score;
    }
    return best;
}

/** True when a footer/lore hierarchy contains this complete mapped-site path. */
export function locationContainsSiteRoot(location, siteRoot) {
    return !!locationPathMatchScore(location, siteRoot);
}

/**
 * A new settlement may be created from inside an initially standalone peer
 * only when its locked absorption manifest includes that active peer.
 */
export function settlementAbsorptionMatchesCurrentPeer(kind, currentLocation, includeManifest = []) {
    if (normalizeMapSiteKind(kind) !== 'SETTLEMENT') return false;
    const location = String(currentLocation || '').trim();
    if (!location || !Array.isArray(includeManifest) || !includeManifest.length) return false;
    return includeManifest.some(item => locationContainsSiteRoot(location, String(item?.site || '').trim()));
}

/**
 * Map activation keys off footer segments. No live footer yet cannot be checked.
 * CreateAreaMap may invent a new site name before that name appears in the footer;
 * activation still requires the later footer to copy the saved site exactly.
 */
export function mapSiteMatchesLiveFooter(site, currentLocation) {
    const location = String(currentLocation || '').trim();
    if (!location) return true;
    return locationContainsSiteRoot(location, site);
}

export function mapSiteFooterMismatchHint(site, currentLocation) {
    return `site must be copied verbatim from a Location footer segment. Live footer: "${currentLocation}". Received: "${site}". Never translate, transliterate, expand, or retitle.`;
}

/** Conservative fuzzy equality for punctuation/article drift and small typos. */
export function dungeonLabelsMatch(left, right) {
    const a = normalizeDungeonLabel(left);
    const b = normalizeDungeonLabel(right);
    if (!a || !b) return false;
    if (dungeonLabelEditDistanceMatch(a, b)) return true;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (shorter.length < 8 || !longer.startsWith(shorter)) return false;
    const next = longer[shorter.length];
    return next === ' ' || (next === 's' && longer.length === shorter.length + 1);
}

/**
 * Structural identity for map sites, areas, assets, and attachment addresses.
 * Unlike dungeonLabelsMatch(), whole-word prefixes are never aliases: adding
 * "Dungeon", "Interior", "Depths", etc. creates a different map cell.
 * Small spelling drift remains acceptable only when both labels have the same
 * number of normalized words.
 */
export function dungeonLabelIdentitiesMatch(left, right) {
    const a = normalizeDungeonLabel(left);
    const b = normalizeDungeonLabel(right);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.split(/\s+/).length !== b.split(/\s+/).length) return false;
    return dungeonLabelEditDistanceMatch(a, b);
}

/** Upgrade a prose/older JSON [MAP] section to the v3 geometry/assets model. */
export function migrateDungeonMapSectionToStructured(entry) {
    const body = extractDungeonMapSection(entry?.content);
    if (!body) return false;
    const parsed = parseDungeonMapDocument(body, String(entry?.comment || '').trim());
    if (!parsed.migrated) return false;
    entry.content = replaceDungeonMapSection(entry.content, serializeDungeonMapDocument(parsed.document));
    return true;
}

/** Mark mapped areas with real child Location records as visited during migration. */
export function reconcileDungeonMapAreaKnowledge(entry, allEntries) {
    const body = extractDungeonMapSection(entry?.content);
    if (!body) return false;
    const parsed = parseDungeonMapDocument(body, String(entry?.comment || '').trim());
    const rootLabel = String(entry?.comment || parsed.document.site || '').trim();
    const wasMigrated = parsed.migrated;
    const children = Object.values(allEntries || {})
        .filter(candidate => candidate && candidate !== entry)
        .filter(candidate => {
            const label = String(candidate.comment || '').trim();
            const segments = splitLocationSegments(label);
            return segments.length > 1 && locationContainsSiteRoot(label, rootLabel);
        });
    let changed = wasMigrated;
    const legacyCoreSentence = `${rootLabel} is a mapped site. Persistent room and area changes are recorded in its child Location entries.`;
    const currentCoreSentence = `${rootLabel} is a mapped site. Its private map stores current objective reality; child Location entries preserve player-observable history.`;
    if (String(entry.content || '').includes(legacyCoreSentence)) {
        entry.content = String(entry.content).replace(legacyCoreSentence, currentCoreSentence);
        changed = true;
    }
    for (const area of parsed.document.areas) {
        const child = children.find(candidate => {
            const leaf = String(candidate.comment || '').split(/\s*::\s*/).filter(Boolean).at(-1);
            const keys = Array.isArray(candidate.key) ? candidate.key : [];
            return dungeonLabelsMatch(leaf, area.name) || keys.some(key => dungeonLabelsMatch(key, area.name));
        });
        if (child && area.knowledge !== 'VISITED') {
            area.knowledge = 'VISITED';
            changed = true;
        }

        // One-time legacy reconciliation: strongly explicit historical outcomes
        // become the initial v3 current state. Never rerun this inference on an
        // already-structured map, because a later validated operation may supersede
        // an older chronicle without rewriting history.
        if (!wasMigrated || !child) continue;
        const visibleContent = stripDungeonMapSection(child.content);
        const history = visibleContent
            .replace(/\[CORE\][\s\S]*?\[\/CORE\]/gi, '')
            .trim();
        for (const asset of parsed.document.assets.filter(candidate => candidate.location === area.id)) {
            const normalizedName = normalizeDungeonLabel(asset.name);
            const distinctiveNoun = normalizedName.split(/\s+/).at(-1) || '';
            const terms = [...new Set([
                normalizedName,
                normalizeDungeonLabel(asset.id),
                distinctiveNoun,
            ].filter(term => term.length >= 4 && !['thing', 'asset', 'other'].includes(term)))];
            const normalizedVisible = normalizeDungeonLabel(visibleContent);
            if (terms.some(term => normalizedVisible.includes(term)) && asset.knowledge !== 'KNOWN') {
                asset.knowledge = 'KNOWN';
                changed = true;
            }
            if (!history) continue;
            const relevantLines = history.split(/\r?\n/).filter(line => {
                const normalized = normalizeDungeonLabel(line);
                return terms.some(term => normalized.includes(term));
            });
            if (!relevantLines.length) continue;
            const latest = relevantLines.at(-1);
            const normalizedLatest = normalizeDungeonLabel(latest);
            const stateRulesByKind = {
                CREATURE: [
                    { re: /\b(?:destroyed|obliterated|slain|killed|dead)\b/, state: 'DESTROYED' },
                    { re: /\b(?:captured|bound|imprisoned)\b/, state: 'CAPTURED' },
                ],
                GROUP: [
                    { re: /\b(?:destroyed|obliterated|slain|killed|dead)\b/, state: 'DESTROYED' },
                    { re: /\b(?:captured|bound|imprisoned)\b/, state: 'CAPTURED' },
                ],
                TRAP: [
                    { re: /\b(?:disarmed|deactivated)\b/, state: 'DEACTIVATED' },
                    { re: /\b(?:triggered|sprung)\b/, state: 'TRIGGERED' },
                    { re: /\b(?:disabled|destroyed)\b/, state: 'DISABLED' },
                ],
                ALARM: [
                    { re: /\b(?:triggered|sounded|raised)\b/, state: 'TRIGGERED' },
                    { re: /\b(?:disarmed|deactivated)\b/, state: 'DEACTIVATED' },
                    { re: /\b(?:disabled|destroyed)\b/, state: 'DISABLED' },
                ],
                BARRIER: [
                    { re: /\b(?:destroyed|smashed|collapsed)\b/, state: 'DESTROYED' },
                    { re: /\b(?:unlocked)\b/, state: 'UNLOCKED' },
                    { re: /\b(?:opened|open)\b/, state: 'OPEN' },
                    { re: /\b(?:blocked)\b/, state: 'BLOCKED' },
                    { re: /\b(?:locked|sealed|chained)\b/, state: 'LOCKED' },
                ],
                LOOT: [
                    { re: /\b(?:taken|recovered|removed|looted)\b/, state: 'TAKEN' },
                    { re: /\b(?:destroyed)\b/, state: 'DESTROYED' },
                ],
                OBJECT: [
                    { re: /\b(?:taken|recovered|removed)\b/, state: 'TAKEN' },
                    { re: /\b(?:destroyed|broken)\b/, state: 'DESTROYED' },
                ],
                HAZARD: [
                    { re: /\b(?:cleared|neutralized)\b/, state: 'CLEARED' },
                    { re: /\b(?:disabled|destroyed)\b/, state: 'DISABLED' },
                ],
                EFFECT: [
                    { re: /\b(?:cleared|dispelled|ended)\b/, state: 'CLEARED' },
                    { re: /\b(?:disabled|destroyed)\b/, state: 'DISABLED' },
                ],
            };
            const stateRules = stateRulesByKind[asset.kind] || [
                { re: /\b(?:destroyed)\b/, state: 'DESTROYED' },
                { re: /\b(?:removed)\b/, state: 'REMOVED' },
            ];
            const inferred = stateRules.find(rule => rule.re.test(normalizedLatest));
            if (!inferred) continue;
            asset.state = inferred.state;
            asset.knowledge = 'KNOWN';
            asset.detail = latest.replace(/^\s*\[[^\]]+\]\s*/, '').trim() || asset.detail;
            changed = true;
        }
    }
    if (changed) entry.content = replaceDungeonMapSection(entry.content, serializeDungeonMapDocument(parsed.document));
    return changed;
}

function mapError(code, path, received, hint, extra = {}) {
    return { code, path, received, hint, ...extra };
}

function unknownKeys(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.keys(value).filter(key => !allowed.includes(key));
}

function resolveMapArea(document, ref) {
    const received = String(ref || '').trim();
    if (!received) return { area: null, candidates: [] };
    const exactId = document.areas.find(area => area.id === received);
    if (exactId) return { area: exactId, candidates: [exactId] };
    const normalized = normalizeDungeonLabel(received);
    const exactNames = document.areas.filter(area => normalizeDungeonLabel(area.name) === normalized);
    if (exactNames.length === 1) return { area: exactNames[0], candidates: exactNames };
    const fuzzy = document.areas.filter(area => dungeonLabelIdentitiesMatch(area.name, received));
    return { area: fuzzy.length === 1 ? fuzzy[0] : null, candidates: fuzzy.length ? fuzzy : exactNames };
}

/** Resolve one structural map area without applying prose prefix/containment aliases. */
export function resolveMapAreaIdentity(document, ref) {
    const map = normalizeDungeonMapDocument(document, document?.site);
    return resolveMapArea(map, ref);
}

function resolveMapAsset(document, ref) {
    const received = String(ref || '').trim();
    if (!received) return { asset: null, candidates: [] };
    const exactId = document.assets.find(asset => asset.id === received);
    if (exactId) return { asset: exactId, candidates: [exactId] };
    const normalized = normalizeDungeonLabel(received);
    const exactNames = document.assets.filter(asset => normalizeDungeonLabel(asset.name) === normalized);
    if (exactNames.length === 1) return { asset: exactNames[0], candidates: exactNames };
    return { asset: null, candidates: exactNames };
}

export function canAssetKindBeContainedBy(childKind, parentKind) {
    return (ASSET_CONTAINER_CHILD_KINDS[String(parentKind || '').toUpperCase()] || [])
        .includes(String(childKind || '').toUpperCase());
}

/** Resolve a direct placement target while enforcing the closed container-kind relation. */
export function resolveMapLocationTarget(document, ref, childKind = '') {
    const areaResult = resolveMapArea(document, ref);
    if (areaResult.area) return { id: areaResult.area.id, area: areaResult.area, container: null, candidates: areaResult.candidates };
    const assetResult = resolveMapAsset(document, ref);
    if (assetResult.asset && canAssetKindBeContainedBy(childKind, assetResult.asset.kind)) {
        return { id: assetResult.asset.id, area: null, container: assetResult.asset, candidates: assetResult.candidates };
    }
    return { id: '', area: null, container: null, candidates: assetResult.candidates, invalidContainer: assetResult.asset || null };
}

/** Follow legal container references to the map area that physically contains an asset. */
export function resolveAssetEffectiveArea(document, assetOrRef) {
    let asset = typeof assetOrRef === 'object' && assetOrRef
        ? assetOrRef
        : resolveMapAsset(document, assetOrRef).asset;
    const seen = new Set();
    while (asset && !seen.has(asset.id)) {
        seen.add(asset.id);
        const area = resolveMapArea(document, asset.location).area;
        if (area) return area;
        asset = resolveMapAsset(document, asset.location).asset;
    }
    return null;
}

/** A located known/suspected asset necessarily reveals its effective map area. */
export function reconcileAssetAreaKnowledge(document) {
    if (!document || !Array.isArray(document.areas) || !Array.isArray(document.assets)) return document;
    for (const asset of document.assets) {
        if (!['KNOWN', 'SUSPECTED'].includes(String(asset?.knowledge || '').toUpperCase())) continue;
        const area = resolveAssetEffectiveArea(document, asset);
        if (area?.knowledge === 'UNREVEALED') area.knowledge = 'DISCOVERED';
    }
    return document;
}

function resolveMapEffectiveArea(document, ref) {
    const direct = resolveMapArea(document, ref);
    if (direct.area) return direct;
    const asset = resolveMapAsset(document, ref).asset;
    const area = asset ? resolveAssetEffectiveArea(document, asset) : null;
    return { area, candidates: area ? [area] : [] };
}

export function listContainedMapAssets(document, containerRef, { recursive = false } = {}) {
    const map = normalizeDungeonMapDocument(document, document?.site);
    const walk = (ref, ancestors) => {
        const container = resolveMapAsset(map, ref).asset;
        if (!container) return [];
        const containerId = mapAssetId(container);
        if (!containerId || ancestors.has(containerId)) return [];
        const nested = new Set(ancestors);
        nested.add(containerId);
        const direct = listDirectContainedAssets(map.assets, containerId, nested);
        if (!recursive) return direct;
        return direct.flatMap(asset => [asset, ...walk(asset.id, nested)]);
    };
    return walk(containerRef, new Set());
}

function collectAssetDeletionIds(document, rootId) {
    const ids = new Set([rootId]);
    for (const contained of listContainedMapAssets(document, rootId, { recursive: true })) {
        ids.add(contained.id);
    }
    return ids;
}

function validateEnumField(value, allowed, path, errors, required = false) {
    if (value == null || value === '') {
        if (required) errors.push(mapError('MISSING_FIELD', path, value, `Supply one of: ${allowed.join(', ')}.`, { allowed }));
        return null;
    }
    const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!allowed.includes(normalized)) {
        errors.push(mapError('INVALID_ENUM', path, value, `Use one of: ${allowed.join(', ')}.`, { allowed }));
        return null;
    }
    return normalized;
}

function requireMapString(value, path, errors) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) errors.push(mapError('MISSING_FIELD', path, value, 'Supply a non-empty string.'));
    return normalized;
}

function validateOperationShape(operation, index, errors) {
    const path = `map.operations[${index}]`;
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        errors.push(mapError('INVALID_OPERATION', path, operation, 'Each operation must be a JSON object.'));
        return null;
    }
    const op = validateEnumField(operation.op, MAP_OPERATIONS, `${path}.op`, errors, true);
    const common = ['op', 'evidence', ...CAUSAL_OPERATION_FIELDS];
    const byOperation = {
        ADD_AREA: ['name', 'knowledge', 'geometry', 'connections'],
        SET_AREA: ['area_id', 'knowledge', 'geometry_append', 'geometry_replace'],
        ADD_ASSET: ['name', 'kind', 'location', 'state', 'knowledge', 'detail', 'origin', 'behavior', 'route', 'faction', 'owner', 'duration', 'count', 'distinct_from'],
        MOVE_ASSET: ['asset_id', 'to', 'from', 'state', 'knowledge', 'detail'],
        SET_ASSET: ['asset_id', 'name', 'state', 'knowledge', 'detail', 'behavior', 'route', 'faction', 'owner', 'duration', 'count', 'notEntered'],
        REMOVE_ASSET: ['asset_id', 'knowledge', 'detail'],
        SET_CONNECTION: ['from', 'to', 'state', 'detail', 'bidirectional'],
    };
    if (op) {
        const extras = unknownKeys(operation, [...common, ...(byOperation[op] || [])]);
        for (const key of extras) {
            errors.push(mapError('UNKNOWN_FIELD', `${path}.${key}`, operation[key], `Remove unsupported field "${key}" from ${op}.`, { allowed: [...common, ...(byOperation[op] || [])] }));
        }
    }
    const evidence = validateEnumField(coerceMapEvidence(operation.evidence), MAP_EVIDENCE, `${path}.evidence`, errors, true);
    return op && evidence ? { op, evidence, path } : null;
}

function addOrUpdateConnection(area, to, state, detail) {
    const existing = area.connections.find(connection => connection.to === to);
    if (existing) {
        existing.state = state;
        existing.detail = detail;
    } else {
        area.connections.push({ to, state, detail });
    }
}

/**
 * Validate and apply a Lorebook Agent map transaction to a cloned document.
 * No caller-owned object is changed when validation fails.
 * @param {object} document
 * @param {object} transaction
 * @param {{ frozenAreaIds?: string[] }} [options]
 */
export function applyDungeonMapTransaction(document, transaction, options = {}) {
    const frozenAreaIds = Array.isArray(options?.frozenAreaIds) ? options.frozenAreaIds : [];
    const currentTime = String(options?.currentTime || '').trim();
    const current = normalizeDungeonMapDocument(clone(document), document?.site);
    const errors = [];
    if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction)) {
        return { ok: false, retryable: true, errors: [mapError('INVALID_MAP_TRANSACTION', 'map', transaction, 'Supply a JSON object with operation_id, operations, and optional chronicles.')] };
    }
    for (const key of unknownKeys(transaction, ['operation_id', 'operations', 'chronicles'])) {
        errors.push(mapError('UNKNOWN_FIELD', `map.${key}`, transaction[key], `Remove unsupported map transaction field "${key}".`, { allowed: ['operation_id', 'operations', 'chronicles'] }));
    }
    const operationId = requireMapString(transaction.operation_id, 'map.operation_id', errors);
    if (operationId && !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/.test(operationId)) {
        errors.push(mapError('INVALID_OPERATION_ID', 'map.operation_id', operationId, 'Use 3-120 characters: letters, numbers, dot, underscore, colon, or hyphen.'));
    }
    if (!Array.isArray(transaction.operations) || !transaction.operations.length) {
        errors.push(mapError('MISSING_OPERATIONS', 'map.operations', transaction.operations, 'Supply at least one map operation.'));
    } else if (transaction.operations.length > 24) {
        errors.push(mapError('TOO_MANY_OPERATIONS', 'map.operations', transaction.operations.length, 'Split the change into at most 24 operations.'));
    }
    if (transaction.chronicles != null && !Array.isArray(transaction.chronicles)) {
        errors.push(mapError('INVALID_CHRONICLES', 'map.chronicles', transaction.chronicles, 'Chronicles must be an array. Omit it for unobserved off-screen changes.'));
    }
    if (errors.length) return { ok: false, retryable: true, errors };

    const working = clone(current);
    const createdAssets = [];
    const createdAreas = [];
    const evolvedPendingBuildingsPopulated = new Set();
    const areaIds = new Set(working.areas.map(area => area.id));
    const assetIds = new Set(working.assets.map(asset => asset.id));

    for (let index = 0; index < transaction.operations.length; index++) {
        const operation = normalizeMapOperation(transaction.operations[index]);
        const shape = validateOperationShape(operation, index, errors);
        if (!shape) continue;
        const { op, evidence, path } = shape;

        if (evidence === 'AUTONOMOUS' && !['MOVE_ASSET', 'SET_ASSET', 'REMOVE_ASSET'].includes(op)) {
            errors.push(mapError('AUTONOMY_NOT_ALLOWED', `${path}.evidence`, evidence, `${op} requires narrator-established CONFIRMED or IMPLIED evidence.`));
            continue;
        }
        if (evidence === 'EVOLVED' && !EVOLVED_OPERATIONS.includes(op)) {
            errors.push(mapError('EVOLUTION_OP_NOT_ALLOWED', `${path}.evidence`, evidence, `${op} is not allowed for Map Evolution. Use ADD_ASSET, MOVE_ASSET, SET_ASSET, REMOVE_ASSET, SET_CONNECTION, or SET_AREA (geometry_append only).`));
            continue;
        }
        if (evidence === 'EVOLVED' && operationTouchesFrozenArea(working, operation, frozenAreaIds)) {
            errors.push(mapError('PLAYER_BUBBLE_FROZEN', path, operation, 'Map Evolution must not mutate the party\'s current area. Change an unrevealed or vacated room instead.'));
            continue;
        }

        if (op === 'ADD_AREA') {
            const name = requireMapString(operation.name, `${path}.name`, errors);
            const knowledge = validateEnumField(operation.knowledge, AREA_KNOWLEDGE, `${path}.knowledge`, errors, true);
            if (!name || !knowledge) continue;
            const duplicates = working.areas.filter(area => dungeonLabelsMatch(area.name, name));
            if (duplicates.length) {
                errors.push(mapError('DUPLICATE_AREA', `${path}.name`, name, 'Use SET_AREA for the existing area.', { candidates: duplicates.map(area => ({ id: area.id, name: area.name })) }));
                continue;
            }
            const area = {
                id: allocateMapId(areaIds, name, 'area'),
                name,
                knowledge,
                geometry: cleanStringList(operation.geometry),
                connections: [],
            };
            working.areas.push(area);
            createdAreas.push({ id: area.id, name: area.name });
            for (const [connectionIndex, connectionRef] of cleanStringList(operation.connections).entries()) {
                const resolved = resolveMapArea(working, connectionRef);
                if (!resolved.area || resolved.area.id === area.id) {
                    errors.push(mapError('AREA_NOT_FOUND', `${path}.connections[${connectionIndex}]`, connectionRef, 'Use an exact existing area ID or label.', { allowed: working.areas.filter(item => item.id !== area.id).map(item => item.id) }));
                    continue;
                }
                addOrUpdateConnection(area, resolved.area.id, 'OPEN', '');
                addOrUpdateConnection(resolved.area, area.id, 'OPEN', '');
            }
            readCausalCause(operation, path, errors);
            continue;
        }

        if (op === 'SET_AREA') {
            const resolved = resolveMapArea(working, operation.area_id);
            if (!resolved.area) {
                errors.push(mapError('AREA_NOT_FOUND', `${path}.area_id`, operation.area_id, 'Use an exact area ID or unambiguous label.', { allowed: working.areas.map(area => area.id), candidates: resolved.candidates.map(area => area.id) }));
                continue;
            }
            const hasMutation = operation.knowledge != null || operation.geometry_append != null || operation.geometry_replace != null;
            if (!hasMutation) {
                errors.push(mapError('EMPTY_OPERATION', path, operation, 'SET_AREA must change knowledge or geometry.'));
                continue;
            }
            if (evidence === 'EVOLVED' && (operation.knowledge != null || operation.geometry_replace != null)) {
                errors.push(mapError('EVOLUTION_SET_AREA_LIMITED', path, operation, 'Map Evolution may only append durable geometry (geometry_append). Do not change area knowledge or replace geometry.'));
                continue;
            }
            if (operation.knowledge != null) {
                const knowledge = validateEnumField(operation.knowledge, AREA_KNOWLEDGE, `${path}.knowledge`, errors);
                if (knowledge) resolved.area.knowledge = knowledge;
            }
            if (operation.geometry_replace != null) {
                if (!Array.isArray(operation.geometry_replace)) errors.push(mapError('INVALID_FIELD', `${path}.geometry_replace`, operation.geometry_replace, 'Use an array of complete current geometry facts.'));
                else resolved.area.geometry = cleanStringList(operation.geometry_replace);
            }
            if (operation.geometry_append != null) {
                if (!Array.isArray(operation.geometry_append)) errors.push(mapError('INVALID_FIELD', `${path}.geometry_append`, operation.geometry_append, 'Use an array of new durable geometry facts.'));
                else {
                    for (const fact of cleanStringList(operation.geometry_append)) {
                        if (!resolved.area.geometry.some(existing => normalizeChunkForComparison(existing) === normalizeChunkForComparison(fact))) resolved.area.geometry.push(fact);
                    }
                }
            }
            readCausalCause(operation, path, errors);
            continue;
        }

        if (op === 'ADD_ASSET') {
            const name = requireMapString(operation.name, `${path}.name`, errors);
            const kind = validateEnumField(coerceAssetKind(operation.kind, { legacyStructuralAlias: false }), ASSET_KINDS, `${path}.kind`, errors, true);
            const state = validateEnumField(coerceAssetState(operation.state), ASSET_STATES, `${path}.state`, errors, true);
            const knowledge = validateEnumField(operation.knowledge, ASSET_KNOWLEDGE, `${path}.knowledge`, errors, true);
            const locationResult = kind ? resolveMapLocationTarget(working, operation.location, kind) : { id: '' };
            if (!locationResult.id) errors.push(mapError(locationResult.invalidContainer ? 'LOCATION_NOT_ALLOWED' : 'AREA_NOT_FOUND', `${path}.location`, operation.location, 'Use an exact area ID, or a container ID whose kind may contain this asset kind.', { allowedAreas: working.areas.map(area => area.id), allowedContainers: working.assets.filter(asset => canAssetKindBeContainedBy(kind, asset.kind)).map(asset => asset.id) }));
            if (kind && SETTLEMENT_ONLY_ASSET_KINDS.includes(kind) && normalizeMapSiteKind(working.kind) !== 'SETTLEMENT') {
                errors.push(mapError('ASSET_KIND_NOT_ALLOWED', `${path}.kind`, kind, `${kind} is allowed only on SETTLEMENT maps.`));
            }
            if (kind && HOSTED_GATEWAY_ASSET_KINDS.includes(kind)) {
                errors.push(mapError('RUNTIME_OWNED_GATEWAY', `${path}.kind`, kind, 'CreateAreaMap is the only operation allowed to create a SUBDUNGEON/SUBINTERIOR gateway.'));
            }
            if (!name || !kind || !state || !knowledge || !locationResult.id
                || HOSTED_GATEWAY_ASSET_KINDS.includes(kind)
                || (SETTLEMENT_ONLY_ASSET_KINDS.includes(kind) && normalizeMapSiteKind(working.kind) !== 'SETTLEMENT')) continue;
            const duplicateCandidates = working.assets.filter(asset => normalizeDungeonLabel(asset.name) === normalizeDungeonLabel(name) && asset.state !== 'REMOVED');
            const distinctFrom = new Set(cleanStringList(operation.distinct_from));
            if (duplicateCandidates.length && duplicateCandidates.some(candidate => !distinctFrom.has(candidate.id))) {
                errors.push(mapError('POSSIBLE_DUPLICATE_ASSET', `${path}.name`, name, 'Use MOVE_ASSET/SET_ASSET if this is an existing entity, or list every candidate ID in distinct_from if it is genuinely new.', { candidates: duplicateCandidates.map(asset => ({ id: asset.id, location: asset.location, state: asset.state })) }));
                continue;
            }
            const asset = {
                id: allocateMapId(assetIds, name, 'asset'),
                kind,
                name,
                location: locationResult.id,
                state,
                knowledge,
                detail: String(operation.detail || '').trim(),
                origin: String(operation.origin || defaultAssetOrigin(evidence)).trim(),
            };
            if (kind === 'BUILDING') asset.notEntered = true;
            if (evidence === 'EVOLVED' && locationResult.container?.kind === 'BUILDING' && locationResult.container.notEntered !== false) {
                evolvedPendingBuildingsPopulated.add(locationResult.container.id);
            }
            const behavior = String(operation.behavior || '').trim();
            if (behavior) asset.behavior = behavior;
            for (const field of ['faction', 'owner', 'duration']) {
                const value = String(operation[field] || '').trim();
                if (value) asset[field] = value;
            }
            applyAssetCount(asset, operation.count, `${path}.count`, errors);
            if (operation.route != null) {
                if (!Array.isArray(operation.route)) errors.push(mapError('INVALID_FIELD', `${path}.route`, operation.route, 'Use an array of exact area IDs or labels.'));
                else {
                    const route = [];
                    for (const [routeIndex, ref] of operation.route.entries()) {
                        const routeArea = resolveMapArea(working, ref);
                        if (!routeArea.area) errors.push(mapError('AREA_NOT_FOUND', `${path}.route[${routeIndex}]`, ref, 'Use an exact area ID or unambiguous label.', { allowed: working.areas.map(area => area.id) }));
                        else route.push(routeArea.area.id);
                    }
                    if (route.length) asset.route = [...new Set(route)];
                }
            }
            working.assets.push(asset);
            createdAssets.push({ id: asset.id, name: asset.name });
            stampCausalFields(asset, operation, path, errors, currentTime, { requireActor: isKillState(state) });
            continue;
        }

        if (['MOVE_ASSET', 'SET_ASSET', 'REMOVE_ASSET'].includes(op)) {
            const assetResult = resolveMapAsset(working, operation.asset_id);
            if (!assetResult.asset) {
                errors.push(mapError('ASSET_NOT_FOUND', `${path}.asset_id`, operation.asset_id, 'Use an exact asset ID from the occupancy snapshot.', { allowed: working.assets.map(asset => asset.id), candidates: assetResult.candidates.map(asset => asset.id) }));
                continue;
            }
            const asset = assetResult.asset;
            const previousState = asset.state;
            if (HOSTED_GATEWAY_ASSET_KINDS.includes(asset.kind)) {
                const forbiddenSetFields = ['name', 'state', 'behavior', 'route', 'faction', 'owner', 'duration', 'count', 'notEntered'];
                const mutatesStructure = op !== 'SET_ASSET' || forbiddenSetFields.some(field => operation[field] !== undefined);
                if (mutatesStructure) {
                    errors.push(mapError('RUNTIME_OWNED_GATEWAY', `${path}.asset_id`, asset.id, 'CreateAreaMap owns gateway identity and placement. Map transactions may only update its knowledge or descriptive detail.'));
                    continue;
                }
            }
            if (evidence === 'AUTONOMOUS' && !asset.behavior && !asset.route?.length) {
                errors.push(mapError('AUTONOMY_NOT_ALLOWED', `${path}.evidence`, evidence, 'Autonomous asset changes require an explicit behavior or route on the existing asset.'));
                continue;
            }
            if (op === 'MOVE_ASSET') {
                if (['DEAD', 'DESTROYED', 'REMOVED', 'EXPIRED', 'DISMISSED', 'LEFT'].includes(asset.state)) {
                    errors.push(mapError('ASSET_CANNOT_MOVE', `${path}.asset_id`, asset.id, `Asset state is ${asset.state}; change its state only if the narrative explicitly re-establishes mobility.`));
                    continue;
                }
                const destination = resolveMapLocationTarget(working, operation.to, asset.kind);
                if (!destination.id) {
                    errors.push(mapError(destination.invalidContainer ? 'LOCATION_NOT_ALLOWED' : 'AREA_NOT_FOUND', `${path}.to`, operation.to, 'Use an exact area ID, or a legal container ID for this asset kind.'));
                    continue;
                }
                if (operation.from != null) {
                    const from = resolveMapLocationTarget(working, operation.from, asset.kind);
                    if (!from.id || from.id !== asset.location) {
                        const actual = working.areas.find(area => area.id === asset.location) || working.assets.find(item => item.id === asset.location);
                        errors.push(mapError('FROM_LOCATION_MISMATCH', `${path}.from`, operation.from, `Retry with the asset's actual current location: ${asset.location}.`, { actual: actual ? { id: actual.id, name: actual.name } : asset.location }));
                        continue;
                    }
                }
                const sourceArea = resolveAssetEffectiveArea(working, asset);
                const destinationArea = destination.area || resolveAssetEffectiveArea(working, destination.container);
                const connection = sourceArea?.id === destinationArea?.id
                    ? { state: 'OPEN' }
                    : sourceArea?.connections?.find(item => item.to === destinationArea?.id);
                if (connection && ['LOCKED', 'BLOCKED', 'DESTROYED'].includes(connection.state)) {
                    errors.push(mapError('CONNECTION_NOT_TRAVERSABLE', `${path}.to`, operation.to, `The mapped connection is ${connection.state}. Apply SET_CONNECTION earlier in the same transaction if the narrative changed it.`));
                    continue;
                }
                if ((evidence === 'AUTONOMOUS' || evidence === 'EVOLVED') && (!connection || ['LOCKED', 'BLOCKED', 'DESTROYED'].includes(connection.state))) {
                    errors.push(mapError('DESTINATION_NOT_CONNECTED', `${path}.to`, operation.to, `${evidence === 'EVOLVED' ? 'Map Evolution' : 'Autonomous'} movement must follow an open mapped connection.`, { allowed: (sourceArea?.connections || []).filter(item => ['OPEN', 'UNKNOWN'].includes(item.state)).map(item => item.to) }));
                    continue;
                }
                if (evidence === 'EVOLVED' && destination.container?.kind === 'BUILDING' && destination.container.notEntered !== false) {
                    evolvedPendingBuildingsPopulated.add(destination.container.id);
                }
                asset.location = destination.id;
                if (operation.state != null) {
                    const state = validateEnumField(coerceAssetState(operation.state), ASSET_STATES, `${path}.state`, errors);
                    if (state) asset.state = state;
                }
                if (operation.knowledge != null) {
                    const knowledge = validateEnumField(operation.knowledge, ASSET_KNOWLEDGE, `${path}.knowledge`, errors);
                    if (knowledge) asset.knowledge = knowledge;
                }
                if (operation.detail != null) asset.detail = String(operation.detail || '').trim();
                stampCausalFields(asset, operation, path, errors, currentTime, {
                    requireActor: isKillState(operation.state) && !isKillState(previousState),
                });
                continue;
            }
            if (op === 'REMOVE_ASSET') {
                readCausalCause(operation, path, errors);
                const toRemove = collectAssetDeletionIds(working, asset.id);
                working.assets = working.assets.filter(item => !toRemove.has(item.id));
                for (const id of toRemove) assetIds.delete(id);
                continue;
            }

            const mutableFields = ['name', 'state', 'knowledge', 'detail', 'behavior', 'route', 'faction', 'owner', 'duration', 'count', 'notEntered', 'cause', 'actor'];
            if (!mutableFields.some(field => operation[field] != null)) {
                errors.push(mapError('EMPTY_OPERATION', path, operation, 'SET_ASSET must change at least one mutable field.'));
                continue;
            }
            if (operation.name != null) asset.name = requireMapString(operation.name, `${path}.name`, errors) || asset.name;
            if (operation.state != null) {
                const state = validateEnumField(coerceAssetState(operation.state), ASSET_STATES, `${path}.state`, errors);
                if (state) {
                    if (evidence === 'EVOLVED' && isPlayCanonLockedState(asset.state) && !isPlayCanonLockedState(state)) {
                        errors.push(mapError('PLAY_CANON_LOCKED', `${path}.state`, state, `Asset state is ${asset.state}. Map Evolution cannot revive play-established outcomes; add a new distinct entity instead.`));
                        continue;
                    }
                    if (state === 'LEFT' && asset.location) asset.last_location = asset.location;
                    asset.state = state;
                }
            }
            if (operation.knowledge != null) {
                const knowledge = validateEnumField(operation.knowledge, ASSET_KNOWLEDGE, `${path}.knowledge`, errors);
                if (knowledge) asset.knowledge = knowledge;
            }
            if (operation.detail != null) asset.detail = String(operation.detail || '').trim();
            if (operation.behavior != null) asset.behavior = String(operation.behavior || '').trim();
            for (const field of ['faction', 'owner', 'duration']) {
                if (operation[field] != null) asset[field] = String(operation[field] || '').trim();
            }
            if (operation.count != null) applyAssetCount(asset, operation.count, `${path}.count`, errors);
            if (operation.notEntered != null) {
                if (asset.kind !== 'BUILDING') errors.push(mapError('FIELD_NOT_ALLOWED', `${path}.notEntered`, operation.notEntered, 'notEntered is valid only on BUILDING assets.'));
                else if (typeof operation.notEntered !== 'boolean') errors.push(mapError('INVALID_FIELD', `${path}.notEntered`, operation.notEntered, 'Use true or false.'));
                else asset.notEntered = operation.notEntered;
            }
            if (operation.route != null) {
                if (!Array.isArray(operation.route)) errors.push(mapError('INVALID_FIELD', `${path}.route`, operation.route, 'Use an array of exact area IDs or labels.'));
                else {
                    const route = [];
                    for (const [routeIndex, ref] of operation.route.entries()) {
                        const routeArea = resolveMapArea(working, ref);
                        if (!routeArea.area) errors.push(mapError('AREA_NOT_FOUND', `${path}.route[${routeIndex}]`, ref, 'Use an exact area ID or unambiguous label.', { allowed: working.areas.map(area => area.id) }));
                        else route.push(routeArea.area.id);
                    }
                    asset.route = [...new Set(route)];
                }
            }
            stampCausalFields(asset, operation, path, errors, currentTime, {
                requireActor: isKillState(operation.state) && !isKillState(previousState),
            });
            continue;
        }

        if (op === 'SET_CONNECTION') {
            const from = resolveMapArea(working, operation.from);
            const to = resolveMapArea(working, operation.to);
            if (!from.area) errors.push(mapError('AREA_NOT_FOUND', `${path}.from`, operation.from, 'Use an exact area ID or unambiguous label.', { allowed: working.areas.map(area => area.id) }));
            if (!to.area) errors.push(mapError('AREA_NOT_FOUND', `${path}.to`, operation.to, 'Use an exact area ID or unambiguous label.', { allowed: working.areas.map(area => area.id) }));
            const state = validateEnumField(operation.state, CONNECTION_STATES, `${path}.state`, errors, true);
            if (!from.area || !to.area || !state) continue;
            if (from.area.id === to.area.id) {
                errors.push(mapError('INVALID_CONNECTION', path, operation, 'A connection must join two different areas.'));
                continue;
            }
            const detail = String(operation.detail || '').trim();
            addOrUpdateConnection(from.area, to.area.id, state, detail);
            if (operation.bidirectional !== false) addOrUpdateConnection(to.area, from.area.id, state, detail);
            readCausalCause(operation, path, errors);
        }
    }

    for (const buildingId of evolvedPendingBuildingsPopulated) {
        const building = working.assets.find(asset => asset.id === buildingId);
        if (building?.notEntered !== false) {
            errors.push(mapError('BUILDING_POPULATION_NOT_RESOLVED', 'map.operations', buildingId, `Evolution added contents to pending BUILDING ${buildingId}; include SET_ASSET notEntered:false for that BUILDING in the same transaction.`));
        }
    }

    const resolvedChronicles = [];
    for (const [index, chronicle] of (transaction.chronicles || []).entries()) {
        const path = `map.chronicles[${index}]`;
        if (!chronicle || typeof chronicle !== 'object' || Array.isArray(chronicle)) {
            errors.push(mapError('INVALID_CHRONICLE', path, chronicle, 'Each chronicle must be a JSON object.'));
            continue;
        }
        const entry = normalizeChronicleFields(chronicle);
        for (const key of unknownKeys(entry, ['area_id', 'text'])) {
            errors.push(mapError('UNKNOWN_FIELD', `${path}.${key}`, entry[key], `Remove unsupported chronicle field "${key}".`, { allowed: ['area_id', 'text'] }));
        }
        const area = resolveMapArea(working, entry.area_id);
        const text = requireMapString(entry.text, `${path}.text`, errors);
        if (!area.area) {
            errors.push(mapError('AREA_NOT_FOUND', `${path}.area_id`, entry.area_id, 'Use the exact area ID whose player-observable history changed.', { allowed: working.areas.map(item => item.id), candidates: area.candidates.map(item => item.id) }));
        } else if (text) {
            // A player-observable chronicle is direct evidence that the area has
            // been visited. Keep this invariant in the pure transaction result so
            // every caller sees the same current map, not only the persistence path.
            area.area.knowledge = 'VISITED';
            resolvedChronicles.push({ areaId: area.area.id, areaName: area.area.name, text });
        }
    }

    if (errors.length) return { ok: false, retryable: true, errors };
    return {
        ok: true,
        retryable: false,
        operationId,
        document: normalizeDungeonMapDocument(working, working.site),
        chronicles: resolvedChronicles,
        createdAssets,
        createdAreas,
    };
}

const ASSET_DETAIL_SCHEMA = {
    type: 'string',
    description: 'Durable occupancy or lasting condition only (what remains, destroyed remains, what is guarded). Numeric remaining members belong in count, not here. Never HP, targeting, mid-round poses, or temporary combat statuses such as frightened/held/prone.',
};

const ASSET_DURATION_SCHEMA = {
    type: 'string',
    description: 'Absolute in-world temporal boundary in the narrative time format, e.g. "Until Day 2, 4:40 AM." Set to an empty string in SET_ASSET after applying the boundary so the timer is cleared.',
};

/** Strict JSON Schema fragment added to commit only while a mapped site is active. */
export function buildDungeonMapCommitSchema() {
    const evidence = { type: 'string', enum: MAP_EVIDENCE };
    const cause = { type: 'string', minLength: 1, maxLength: 240, description: 'Concise in-world reason for this change. Required. For deaths use killed-by, e.g. "Killed by the party on the landing" or "Killed by Salt-Road Delvers over spoils".' };
    const actor = { type: 'string', minLength: 1, maxLength: 120, description: 'Who caused this change: "party", an existing asset id, or a short off-map name. Required when state is DEAD or DESTROYED.' };
    const thread_status = { type: 'string', enum: MAP_THREAD_STATUSES, description: 'open (unfinished plot), resolved (plot ended, including return to baseline), or transformed (plot continues in a new shape). Omission defaults to open — set resolved/transformed explicitly when the plot ends or changes shape.' };
    const operationVariants = [
        {
            type: 'object', additionalProperties: false,
            properties: { op: { type: 'string', enum: ['ADD_AREA'] }, evidence, cause, actor, thread_status, name: { type: 'string' }, knowledge: { type: 'string', enum: AREA_KNOWLEDGE }, geometry: { type: 'array', items: { type: 'string' } }, connections: { type: 'array', items: { type: 'string' } } },
            required: ['op', 'evidence', 'name', 'knowledge', 'cause'],
        },
        {
            type: 'object', additionalProperties: false,
            properties: { op: { type: 'string', enum: ['SET_AREA'] }, evidence, cause, actor, thread_status, area_id: { type: 'string' }, knowledge: { type: 'string', enum: AREA_KNOWLEDGE }, geometry_append: { type: 'array', items: { type: 'string' } }, geometry_replace: { type: 'array', items: { type: 'string' } } },
            required: ['op', 'evidence', 'area_id', 'cause'],
        },
        {
            type: 'object', additionalProperties: false,
            properties: { op: { type: 'string', enum: ['ADD_ASSET'] }, evidence, cause, actor, thread_status, name: { type: 'string' }, kind: { type: 'string', enum: ASSET_KINDS }, location: { type: 'string' }, state: { type: 'string', enum: ASSET_STATE_INPUT_ENUM }, knowledge: { type: 'string', enum: ASSET_KNOWLEDGE }, detail: ASSET_DETAIL_SCHEMA, origin: { type: 'string' }, behavior: { type: 'string' }, route: { type: 'array', items: { type: 'string' } }, faction: { type: 'string' }, owner: { type: 'string' }, duration: ASSET_DURATION_SCHEMA, count: { type: 'integer', minimum: 1, maximum: 99, description: 'Living members of this one asset. Packs, patrols, garrisons, and swarms are one GROUP with count >= 2. Named individuals are CREATURE and omit count or use 1. Never 0 — use DESTROYED/DEAD.' }, distinct_from: { type: 'array', items: { type: 'string' } } },
            required: ['op', 'evidence', 'name', 'kind', 'location', 'state', 'knowledge', 'cause'],
        },
        {
            type: 'object', additionalProperties: false,
            properties: { op: { type: 'string', enum: ['MOVE_ASSET'] }, evidence, cause, actor, thread_status, asset_id: { type: 'string' }, to: { type: 'string' }, from: { type: 'string' }, state: { type: 'string', enum: ASSET_STATE_INPUT_ENUM }, knowledge: { type: 'string', enum: ASSET_KNOWLEDGE }, detail: ASSET_DETAIL_SCHEMA },
            required: ['op', 'evidence', 'asset_id', 'to', 'cause'],
        },
        {
            type: 'object', additionalProperties: false,
            properties: { op: { type: 'string', enum: ['SET_ASSET'] }, evidence, cause, actor, thread_status, asset_id: { type: 'string' }, name: { type: 'string' }, state: { type: 'string', enum: ASSET_STATE_INPUT_ENUM }, knowledge: { type: 'string', enum: ASSET_KNOWLEDGE }, detail: ASSET_DETAIL_SCHEMA, behavior: { type: 'string' }, route: { type: 'array', items: { type: 'string' } }, faction: { type: 'string' }, owner: { type: 'string' }, duration: ASSET_DURATION_SCHEMA, count: { type: 'integer', minimum: 1, maximum: 99, description: 'Updated living members of this one asset. Reduce count for attrition; DESTROYED/DEAD only when none remain. Do not split a pack into singleton CREATUREs.' }, notEntered: { type: 'boolean', description: 'BUILDING-only first-entry population gate. Set false explicitly after successful population or an intentionally empty resolution.' } },
            required: ['op', 'evidence', 'asset_id', 'cause'],
        },
        {
            type: 'object', additionalProperties: false,
            properties: { op: { type: 'string', enum: ['REMOVE_ASSET'] }, evidence, cause, actor, thread_status, asset_id: { type: 'string' }, knowledge: { type: 'string', enum: ASSET_KNOWLEDGE }, detail: ASSET_DETAIL_SCHEMA },
            required: ['op', 'evidence', 'asset_id', 'cause'],
        },
        {
            type: 'object', additionalProperties: false,
            properties: { op: { type: 'string', enum: ['SET_CONNECTION'] }, evidence, cause, actor, thread_status, from: { type: 'string' }, to: { type: 'string' }, state: { type: 'string', enum: CONNECTION_STATES }, detail: { type: 'string' }, bidirectional: { type: 'boolean' } },
            required: ['op', 'evidence', 'from', 'to', 'state', 'cause'],
        },
    ];
    return {
        type: 'object',
        additionalProperties: false,
        description: 'Atomic current-map mutation for the active mapped site. Include only when the narrative established a durable map change (occupancy, destruction, area movement, traps, routes, lasting damage). Do not include transient combat poses, targeting, HP, or temporary statuses. The map and player-observable child Location chronicles save together.',
        properties: {
            operation_id: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$', description: 'Stable idempotency key for this narrative change, e.g. day1-0833-crypt-ghoul-destroyed. Reuse it on a correction retry.' },
            operations: { type: 'array', minItems: 1, maxItems: 24, items: { oneOf: operationVariants } },
            chronicles: {
                type: 'array',
                description: 'Player-observable lasting history only. Omit for hidden/off-screen changes. Not turn-by-turn combat choreography, HP, targeting, or temporary statuses.',
                items: {
                    type: 'object', additionalProperties: false,
                    properties: {
                        area_id: { type: 'string' },
                        text: { type: 'string', description: 'Lasting observable history. Not mid-round poses, targeting, HP, or temporary combat statuses.' },
                    },
                    required: ['area_id', 'text'],
                },
            },
        },
        required: ['operation_id', 'operations'],
    };
}

export function inspectDungeonMap(document, areaRef = '') {
    const map = normalizeDungeonMapDocument(document, document?.site);
    if (!areaRef) return map;
    const resolved = resolveMapArea(map, areaRef);
    if (!resolved.area) return null;
    return {
        site: map.site,
        area: resolved.area,
        assets: map.assets.filter(asset => resolveAssetEffectiveArea(map, asset)?.id === resolved.area.id),
    };
}

export function listDungeonMapAssets(document, filters = {}) {
    const map = normalizeDungeonMapDocument(document, document?.site);
    let assets = map.assets;
    if (filters.area) {
        const resolved = resolveMapArea(map, filters.area);
        if (!resolved.area) return null;
        assets = assets.filter(asset => resolveAssetEffectiveArea(map, asset)?.id === resolved.area.id);
    }
    if (filters.state) assets = assets.filter(asset => asset.state === String(filters.state).toUpperCase());
    if (filters.knowledge) assets = assets.filter(asset => asset.knowledge === String(filters.knowledge).toUpperCase());
    return assets;
}

/**
 * Compact ID-bearing snapshot for the Map Updater. Keeps stable IDs without
 * dumping full geometry for every room on every turn.
 * @param {object} document
 * @param {string} [currentLocation]
 * @param {{ includeCurrentGeometry?: boolean, occupancyHints?: boolean }} [options]
 */
export function formatDungeonMapForUpdater(document, currentLocation = '', options = {}) {
    const includeCurrentGeometry = options.includeCurrentGeometry !== false;
    const occupancyHints = options.occupancyHints !== false;
    const map = normalizeDungeonMapDocument(document, document?.site);
    const kind = normalizeMapSiteKind(map.kind);
    const placement = resolveCurrentMapPlacement(map, currentLocation);
    const currentArea = placement.area;
    const unmatchedInterior = placement.unmatchedInterior;
    const interiorAsset = placement.interiorAsset;
    const areaLines = (map.areas || []).map(area => {
        const routes = (area.connections || []).map(connection => `${connection.to}:${connection.state}`).join(', ') || 'none';
        return `${area.id} | ${area.name} | ${area.knowledge} | ${routes}`;
    });
    const assetDepth = (asset) => {
        let depth = 0;
        const seen = new Set([mapAssetId(asset)].filter(Boolean));
        let parent = map.assets.find(candidate => {
            const parentId = mapAssetId(candidate);
            return parentId && parentId === String(asset.location || '').trim() && parentId !== mapAssetId(asset);
        });
        while (parent && depth < 4) {
            const parentId = mapAssetId(parent);
            if (parentId && seen.has(parentId)) break;
            if (parentId) seen.add(parentId);
            depth++;
            parent = map.assets.find(candidate => {
                const candidateId = mapAssetId(candidate);
                return candidateId && candidateId === String(parent.location || '').trim() && candidateId !== parentId;
            });
        }
        return depth;
    };
    const orderedAssets = [];
    const seenAssets = new Set();
    const appendAsset = (asset) => {
        if (seenAssets.has(asset)) return;
        seenAssets.add(asset);
        orderedAssets.push(asset);
        const id = mapAssetId(asset);
        if (!id) return;
        for (const child of map.assets) {
            if (seenAssets.has(child)) continue;
            if (String(child.location || '').trim() !== id) continue;
            appendAsset(child);
        }
    };
    for (const asset of map.assets.filter(candidate => !isContainedByOtherAsset(map.assets, candidate))) appendAsset(asset);
    const assetLines = orderedAssets.map(asset => {
        const bits = [asset.id, asset.kind, asset.name, `loc=${asset.location}`, asset.state, asset.knowledge];
        if (asset.kind === 'BUILDING') bits.push(`notEntered=${asset.notEntered !== false}`);
        if (Number.isInteger(asset.count)) bits.push(`count=${asset.count}`);
        if (asset.faction) bits.push(`faction=${asset.faction}`);
        if (asset.behavior) bits.push(`behavior=${asset.behavior}`);
        if (Array.isArray(asset.route) && asset.route.length) bits.push(`route=${asset.route.join('>')}`);
        if (asset.actor) bits.push(`actor=${asset.actor}`);
        if (asset.changed_at) bits.push(`since=${asset.changed_at}`);
        if (asset.cause) bits.push(`cause=${asset.cause}`);
        if (asset.detail) bits.push(asset.detail);
        return `${'  '.repeat(assetDepth(asset))}${bits.join(' | ')}`;
    });
    const sections = [
        `KIND: ${kind}`,
        `SITE: ${map.site}`,
        '',
        '## AREAS',
        'id | name | knowledge | routes',
        areaLines.join('\n') || '(none)',
        '',
        '## ASSETS',
        'id | kind | name | location | state | knowledge | notes',
        assetLines.join('\n') || '(none)',
    ];
    if (includeCurrentGeometry) {
        const currentGeometry = currentArea
            ? `${currentArea.id} (${currentArea.name})\n${(currentArea.geometry || []).map(line => `- ${line}`).join('\n') || '- (no geometry)'}`
            : '(Current location did not match an area id/name.)';
        sections.push('', '## CURRENT AREA GEOMETRY', currentGeometry);
    }
    const interiorHint = (occupancyHints && kind === 'SETTLEMENT' && unmatchedInterior && !interiorAsset)
        ? `\n\n## SETTLEMENT BUILDING NOT ON MAP\n"${unmatchedInterior}" is in CURRENT LOCATION but is not an area or settlement asset. ADD_ASSET kind BUILDING, knowledge KNOWN, location = ${currentArea?.id || 'the current district'}. Do not promote it to SUBDUNGEON/SUBINTERIOR; CreateAreaMap owns promotion. Do not output {"noop":true} for this.`
        : '';
    return sections.join('\n') + interiorHint;
}

/** Compact occupancy snapshot for Map Evolution: no occupancy interior hints, no current-room geometry dump. */
export function formatDungeonMapForEvolution(document, currentLocation = '') {
    const snapshot = formatDungeonMapForUpdater(document, currentLocation, {
        includeCurrentGeometry: false,
        occupancyHints: false,
    });
    const living = formatLivingOccupantsForEvolution(document);
    return living ? `${snapshot}\n\n${living}` : snapshot;
}

function formatLivingOccupantsForEvolution(document) {
    const map = normalizeDungeonMapDocument(document, document?.site);
    const inert = new Set([...PLAY_CANON_LOCKED_STATES, 'CAPTURED', 'LEFT']);
    const living = (map.assets || []).filter(asset =>
        (asset.kind === 'CREATURE' || asset.kind === 'GROUP') && !inert.has(asset.state),
    );
    if (!living.length) return '';
    const byLocation = new Map();
    for (const asset of living) {
        const loc = resolveAssetEffectiveArea(map, asset)?.id || '(unplaced)';
        if (!byLocation.has(loc)) byLocation.set(loc, []);
        byLocation.get(loc).push(asset.id);
    }
    const lines = living.map(asset => {
        const bits = [asset.id, asset.kind, asset.name, `loc=${asset.location || '—'}`, asset.state];
        if (Number.isInteger(asset.count)) bits.push(`count=${asset.count}`);
        const effectiveLocation = resolveAssetEffectiveArea(map, asset)?.id || '(unplaced)';
        const roommates = (byLocation.get(effectiveLocation) || []).filter(id => id !== asset.id);
        if (roommates.length) bits.push(`same-room=${roommates.join(',')}`);
        return bits.join(' | ');
    });
    return [
        '## LIVING OCCUPANTS',
        'Consider each independently. Hours elapsed: several may act in this one transaction. One patrol MOVE is not enough when more than one row exists. same-room means they share a space — they may talk, work, pursue a joint project, hang around, ignore each other, or fight. Do not assume they are enemies.',
        'id | kind | name | location | state | notes',
        ...lines,
    ].join('\n');
}

function normalizeChunkForComparison(chunk) {
    return String(chunk || '').replace(/\s+/g, ' ').trim();
}

function createEmptyState() {
    return { version: 2, sites: {} };
}

function normalizeState(state) {
    const next = state && typeof state === 'object' ? clone(state) : createEmptyState();
    next.version = 2;
    if (!next.sites || typeof next.sites !== 'object' || Array.isArray(next.sites)) next.sites = {};
    for (const [key, rawSite] of Object.entries(next.sites)) {
        if (!rawSite || typeof rawSite !== 'object') {
            delete next.sites[key];
            continue;
        }
        rawSite.siteRoot = String(rawSite.siteRoot || key).trim();
        rawSite.mapChunks = Array.isArray(rawSite.mapChunks)
            ? rawSite.mapChunks.map(String).map(value => value.trim()).filter(Boolean)
            : [];
        rawSite.statusLog = Array.isArray(rawSite.statusLog) ? rawSite.statusLog : [];
    }
    return next;
}

function findSiteRecord(state, siteRoot) {
    const exactKey = normalizeDungeonLabel(siteRoot);
    if (state?.sites?.[exactKey]) return { key: exactKey, site: state.sites[exactKey] };
    for (const [key, site] of Object.entries(state?.sites || {})) {
        if (dungeonSiteRootsMatch(site.siteRoot || key, siteRoot)) return { key, site };
    }
    return null;
}

function siteRootFromMapBlock(block) {
    const proseMarker = String(block || '').match(SITE_MARKER_RE)?.[1]?.trim();
    if (proseMarker) return proseMarker;
    return String(tryParseStructuredMap(block)?.site || '').trim();
}

function statusEntryContentSignature(entry) {
    return [
        String(entry?.type || 'mutation').toLowerCase(),
        normalizeDungeonLabel(entry?.label),
        normalizeChunkForComparison(entry?.state || entry?.detail).toLowerCase(),
    ].join('|');
}

function statusEntrySourceSignature(entry) {
    if (entry?.at?.sourceKey) return `source:${entry.at.sourceKey}`;
    if (Number.isInteger(entry?.at?.messageIndex)) {
        return `position:${entry.at.messageIndex}:${entry.at.swipeId ?? 0}:${statusEntryContentSignature(entry)}`;
    }
    return `legacy:${statusEntryContentSignature(entry)}`;
}

function buildDeltaSourceKey(message, messageIndex, blockIndex, entryIndex) {
    const messageKey = message?.send_date != null
        ? `sent:${String(message.send_date)}`
        : `index:${messageIndex}`;
    return `${messageKey}:swipe:${message?.swipe_id ?? 0}:block:${blockIndex}:entry:${entryIndex}`;
}

function isAssistantMessage(message) {
    const role = String(message?.role || message?.Role || '').toLowerCase().trim();
    if (message?.is_user || message?.is_system || role === 'user' || role === 'system') return false;
    if (['assistant', 'ai', 'model'].includes(role)) return true;
    return message?.is_user === false && !message?.is_system;
}

/** Collect valid initial-map candidates from selected narrator messages. */
export function collectDungeonMapCandidates(chat) {
    const maps = [];
    const errors = [];
    for (let messageIndex = 0; messageIndex < (Array.isArray(chat) ? chat.length : 0); messageIndex++) {
        const message = chat[messageIndex];
        if (!isAssistantMessage(message)) continue;
        const text = getDungeonMessageText(message);
        const footerSnapshot = extractFooterLocation(text);
        for (const content of extractHiddenDungeonMapBlocks(text)) {
            const markedRoot = siteRootFromMapBlock(content);
            if (footerSnapshot && markedRoot && !locationContainsSiteRoot(footerSnapshot, markedRoot)) {
                errors.push(`message ${messageIndex} map marker "${markedRoot}" conflicts with footer site "${footerSnapshot}"`);
                continue;
            }
            const siteRoot = markedRoot || getSiteRootFromLocation(footerSnapshot);
            if (!siteRoot) {
                errors.push(`message ${messageIndex} contains a hidden map but no footer location or Dungeon Site marker`);
                continue;
            }
            maps.push({
                siteRoot,
                content,
                capturedAt: {
                    messageIndex,
                    swipeId: message?.swipe_id ?? 0,
                    footerSnapshot,
                    sentAt: message?.send_date ?? null,
                },
            });
        }
    }
    return { maps, errors };
}

/** Build deterministic active-site records from Location lorebook entries. */
export function buildDungeonSitesFromLocationEntries(entries, bookName = '') {
    const rows = Object.entries(entries || {});
    const sites = {};
    for (const [uid, entry] of rows) {
        const attachment = getDungeonMapAttachment(entry);
        if (!attachment) continue;
        const rootLabel = String(entry.comment || attachment.siteRoot).trim();
        const locationEntries = rows
            .filter(([, candidate]) => {
                const label = String(candidate?.comment || '').trim();
                if (!label) return false;
                return locationContainsSiteRoot(label, rootLabel);
            })
            .map(([childUid, candidate]) => ({
                id: bookName ? `${bookName}::${childUid}` : String(childUid),
                label: String(candidate.comment || childUid),
                content: stripDungeonMapSection(candidate.content),
            }));
        sites[normalizeDungeonLabel(rootLabel)] = {
            siteRoot: attachment.siteRoot || rootLabel,
            entryId: bookName ? `${bookName}::${uid}` : String(uid),
            mapChunks: [attachment.content],
            locationEntries,
            statusLog: [],
        };
    }
    return sites;
}

/**
 * Every attached [MAP] in a Locations book, with parsed documents.
 * Used by Map Evolution to select sites without requiring the party to be inside.
 */
export function listMappedSiteDocuments(entries, bookName = '') {
    const records = [];
    for (const [uid, entry] of Object.entries(entries || {})) {
        const body = extractDungeonMapSection(entry?.content);
        if (!body) continue;
        const rootLabel = String(entry.comment || '').trim();
        const parsed = parseDungeonMapDocument(body, rootLabel);
        if (!parsed?.document) continue;
        records.push({
            uid,
            entryId: bookName ? `${bookName}::${uid}` : String(uid),
            siteRoot: parsed.document.site || rootLabel,
            kind: normalizeMapSiteKind(parsed.document.kind),
            document: parsed.document,
        });
    }
    return records;
}

/** Compact name+kind rows for the narrator's always-on mapped-site index. */
export function listMappedSiteSummaries(sites) {
    const rows = [];
    for (const site of Object.values(sites || {})) {
        if (!site?.siteRoot || !Array.isArray(site.mapChunks) || !site.mapChunks.length) continue;
        const parsed = parseDungeonMapDocument(site.mapChunks[0], site.siteRoot).document;
        const row = {
            siteRoot: String(site.siteRoot).trim(),
            kind: normalizeMapSiteKind(parsed?.kind),
        };
        const hostSite = String(parsed?.hostSite || '').trim();
        if (hostSite) row.hostSite = hostSite;
        const cells = (parsed?.areas || []).map(area => String(area?.name || '').trim()).filter(Boolean);
        if (cells.length) row.cells = cells;
        rows.push(row);
    }
    rows.sort((a, b) => a.siteRoot.localeCompare(b.siteRoot, undefined, { sensitivity: 'base' }));
    return rows;
}

/**
 * Always-on index of existing maps. Independent of the live footer and lore keys,
 * so the narrator can skip CreateAreaMap while still approaching a mapped site.
 */
export function buildMappedSitesInjection(sites) {
    const rows = listMappedSiteSummaries(sites);
    const lines = rows.length
        ? rows.map(row => `- ${row.siteRoot} (${row.kind}${row.hostSite ? `; inside ${row.hostSite}` : ''})${row.cells?.length ? `\n  attachTo.cell choices: ${row.cells.join(' | ')}` : ''}`)
        : ['- None.'];
    const guidance = rows.length
        ? 'Every site below already has a private map. Do not recreate one. To attach a new DUNGEON/INTERIOR from anywhere, use attachTo.site = the exact listed map path and attachTo.cell = one exact cell choice printed beneath it. No BUILDING or player movement is required; the runtime creates the SUB* gateway. SETTLEMENT, DUNGEON, and INTERIOR may host children up to three mapped levels; SETTLEMENT itself cannot be nested. DUNGEON_REALITY is attached while the footer matches a mapped site, or for one turn when player input names it exactly.'
        : 'No private maps exist yet. CreateAreaMap is allowed for a new unmapped dungeon, settlement, or significant interior.';
    return `[MAPPED_SITES — INTERNAL]\n${guidance}\n\n${lines.join('\n')}\n[/MAPPED_SITES]\n`;
}

/**
 * Capture selected narrator-message hidden blocks and merge new chunks by site.
 * Existing map chunks are never rewritten.
 */
export function syncDungeonRealityState(existingState, chat) {
    const state = normalizeState(existingState);
    const errors = [];
    let changed = false;
    let capturedChunks = 0;
    let capturedDeltas = 0;

    for (let messageIndex = 0; messageIndex < (Array.isArray(chat) ? chat.length : 0); messageIndex++) {
        const message = chat[messageIndex];
        if (!isAssistantMessage(message)) continue;
        const text = getDungeonMessageText(message);
        const mapBlocks = extractHiddenDungeonMapBlocks(text);
        const deltaBlocks = extractHiddenDungeonDeltaBlocks(text);
        if (!mapBlocks.length && !deltaBlocks.length) continue;

        const footerSnapshot = extractFooterLocation(text);
        for (const block of mapBlocks) {
            const markedRoot = siteRootFromMapBlock(block);
            if (footerSnapshot && markedRoot && !locationContainsSiteRoot(footerSnapshot, markedRoot)) {
                errors.push(`message ${messageIndex} map marker "${markedRoot}" conflicts with footer site "${footerSnapshot}"`);
                continue;
            }
            const siteRoot = markedRoot || getSiteRootFromLocation(footerSnapshot);
            if (!siteRoot) {
                errors.push(`message ${messageIndex} contains a hidden map but no footer location or Dungeon Site marker`);
                continue;
            }

            let record = findSiteRecord(state, siteRoot);
            if (!record) {
                const key = normalizeDungeonLabel(siteRoot);
                state.sites[key] = {
                    siteRoot,
                    capturedAt: {
                        messageIndex,
                        swipeId: message?.swipe_id ?? 0,
                        footerSnapshot,
                        sentAt: message?.send_date ?? null,
                    },
                    mapChunks: [],
                    statusLog: [],
                };
                record = { key, site: state.sites[key] };
                changed = true;
            }

            const comparison = normalizeChunkForComparison(block);
            const duplicate = record.site.mapChunks
                .some(existing => normalizeChunkForComparison(existing) === comparison);
            if (!duplicate) {
                record.site.mapChunks.push(block);
                capturedChunks++;
                changed = true;
            }
        }

        for (const [blockIndex, block] of deltaBlocks.entries()) {
            const parsed = parseDungeonDeltaBlock(block);
            for (const error of parsed.errors) {
                errors.push(`message ${messageIndex} has an invalid dungeon delta: ${error}`);
            }
            if (!parsed.entries.length) continue;

            if (footerSnapshot && parsed.siteRoot && !locationContainsSiteRoot(footerSnapshot, parsed.siteRoot)) {
                errors.push(`message ${messageIndex} delta marker "${parsed.siteRoot}" conflicts with footer site "${footerSnapshot}"`);
                continue;
            }

            const siteRoot = parsed.siteRoot || getSiteRootFromLocation(footerSnapshot);
            if (!siteRoot) {
                errors.push(`message ${messageIndex} contains a dungeon delta but no footer location or Dungeon Site marker`);
                continue;
            }
            const record = findSiteRecord(state, siteRoot);
            if (!record?.site?.mapChunks?.length) {
                errors.push(`message ${messageIndex} contains a dungeon delta for "${siteRoot}" but no captured immutable map exists`);
                continue;
            }

            const existingSignatures = new Set(record.site.statusLog.map(statusEntrySourceSignature));
            for (const [entryIndex, entry] of parsed.entries.entries()) {
                const sourceKey = buildDeltaSourceKey(message, messageIndex, blockIndex, entryIndex);
                const signature = `source:${sourceKey}`;
                if (existingSignatures.has(signature)) continue;
                record.site.statusLog.push({
                    ...entry,
                    at: {
                        messageIndex,
                        swipeId: message?.swipe_id ?? 0,
                        footerSnapshot,
                        sentAt: message?.send_date ?? null,
                        sourceKey,
                    },
                });
                existingSignatures.add(signature);
                capturedDeltas++;
                changed = true;
            }
        }
    }

    return {
        state: existingState || changed ? state : null,
        changed,
        capturedChunks,
        capturedDeltas,
        errors,
    };
}

/** Find the most recent narrator footer location in the transcript. */
export function findLatestDungeonLocation(chat) {
    if (!Array.isArray(chat)) return '';
    for (let index = chat.length - 1; index >= 0; index--) {
        if (!isAssistantMessage(chat[index])) continue;
        const location = extractFooterLocation(getDungeonMessageText(chat[index]));
        if (location) return location;
    }
    return '';
}

/** Resolve the stored site active under the current footer hierarchy. */
export function resolveActiveDungeonSite(state, currentLocation) {
    if (!splitLocationSegments(currentLocation).length || !state?.sites) return null;
    let best = null;
    for (const site of Object.values(state.sites)) {
        const score = locationPathMatchScore(currentLocation, site?.siteRoot);
        if (!score) continue;
        if (!best || score.depth > best.score.depth || (score.depth === best.score.depth && score.endIndex > best.score.endIndex)) {
            best = { site, score };
        }
    }
    return best?.site || null;
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find mapped sites named verbatim in text. Matching is case-insensitive, but
 * otherwise requires the complete canonical site-root label with token
 * boundaries; aliases, fuzzy variants, and partial words do not qualify.
 */
export function resolveMentionedDungeonSites(state, text) {
    const source = String(text || '').normalize('NFC');
    if (!source || !state?.sites) return [];

    const matches = [];
    for (const site of Object.values(state.sites)) {
        const siteRoot = String(site?.siteRoot || '').trim().normalize('NFC');
        if (!siteRoot || !Array.isArray(site?.mapChunks) || !site.mapChunks.length) continue;
        const escaped = escapeRegExp(siteRoot);
        const leftBoundary = /^[\p{L}\p{N}]/u.test(siteRoot) ? '(?:^|[^\\p{L}\\p{N}])' : '';
        const rightBoundary = /[\p{L}\p{N}]$/u.test(siteRoot) ? '(?=$|[^\\p{L}\\p{N}])' : '';
        if (new RegExp(`${leftBoundary}${escaped}${rightBoundary}`, 'iu').test(source)) {
            matches.push(site);
        }
    }
    return matches;
}

/** Compact [MAP] occupancy for State Tracker memoHistory stones. */
export function collectDungeonMapHistorySnapshot(entries, bookName = '') {
    const maps = [];
    for (const [uid, entry] of Object.entries(entries || {})) {
        const map = extractDungeonMapSection(entry?.content);
        if (!map) continue;
        maps.push({
            uid: String(uid),
            comment: String(entry?.comment || ''),
            map,
            operationIds: Array.isArray(entry?.extensions?.[DUNGEON_MAP_OPERATION_IDS_KEY])
                ? clone(entry.extensions[DUNGEON_MAP_OPERATION_IDS_KEY])
                : [],
        });
    }
    return maps.length ? { bookName, maps } : null;
}

/** Write a history snapshot back onto Location entries without touching [CORE]. */
export function applyDungeonMapHistorySnapshotToBook(book, snapshot) {
    if (!book?.entries || !snapshot?.maps?.length) return false;
    let changed = false;
    for (const item of snapshot.maps) {
        const entry = book.entries[item.uid];
        if (!entry) continue;
        const next = replaceDungeonMapSection(entry.content, item.map);
        if (next !== entry.content) {
            entry.content = next;
            changed = true;
        }
        entry.extensions = entry.extensions || {};
        const nextIds = Array.isArray(item.operationIds) ? clone(item.operationIds) : [];
        if (JSON.stringify(entry.extensions[DUNGEON_MAP_OPERATION_IDS_KEY] || []) !== JSON.stringify(nextIds)) {
            entry.extensions[DUNGEON_MAP_OPERATION_IDS_KEY] = nextIds;
            changed = true;
        }
    }
    return changed;
}

/** Resolve the active site from a memo-history map snapshot (view overlay). */
export function resolveDungeonMapFromHistorySnapshot(snapshot, locationText) {
    if (!snapshot?.maps?.length) return null;
    const entries = {};
    for (const item of snapshot.maps) {
        entries[item.uid] = {
            comment: item.comment,
            content: `[MAP]\n${item.map}\n[/MAP]`,
        };
    }
    return resolveDungeonMapForLocation(entries, locationText, snapshot.bookName || '');
}

/** Parse the active site's current map document for a footer/lore location. */
export function resolveDungeonMapForLocation(entries, locationText, bookName = '') {
    const sites = buildDungeonSitesFromLocationEntries(entries, bookName);
    const site = resolveActiveDungeonSite({ version: 3, sites }, locationText);
    if (!site?.mapChunks?.length) return null;
    const parsed = parseDungeonMapDocument(site.mapChunks[0], site.siteRoot);
    return {
        siteRoot: site.siteRoot || parsed.document.site,
        document: parsed.document,
        entryId: site.entryId || '',
    };
}

/** Remove only map/delta blocks whose durable copy is already in the site store. */
export function stripCapturedDungeonMapBlocks(text, state) {
    const storedMaps = new Set();
    for (const site of Object.values(state?.sites || {})) {
        for (const chunk of site?.mapChunks || []) storedMaps.add(normalizeChunkForComparison(chunk));
    }
    const source = String(text || '');
    if (!storedMaps.size) return source;
    const footerSnapshot = extractFooterLocation(source);
    DIV_RE.lastIndex = 0;
    return source.replace(DIV_RE, (full, attributes, rawBody) => {
        if (!hasHiddenAttribute(attributes)) return full;
        const body = String(rawBody || '').trim();
        if (!hasDungeonDeltaAttribute(attributes)) {
            return storedMaps.has(normalizeChunkForComparison(body)) ? '' : full;
        }

        const parsed = parseDungeonDeltaBlock(body);
        if (parsed.errors.length || !parsed.entries.length) return full;
        if (footerSnapshot && parsed.siteRoot && !locationContainsSiteRoot(footerSnapshot, parsed.siteRoot)) return full;
        const record = findSiteRecord(state, parsed.siteRoot || getSiteRootFromLocation(footerSnapshot));
        if (!record) return full;
        const storedDeltas = new Set((record.site.statusLog || []).map(statusEntryContentSignature));
        return parsed.entries.every(entry => storedDeltas.has(statusEntryContentSignature(entry))) ? '' : full;
    });
}

/** Strip captured map HTML from outgoing prompt messages, never from disk chat. */
export function stripCapturedDungeonMapsFromPrompt(chat, state) {
    if (!Array.isArray(chat)) return;
    for (const message of chat) {
        if (typeof message?.mes === 'string') {
            message.mes = stripCapturedDungeonMapBlocks(message.mes, state);
        }
        if (typeof message?.content === 'string') {
            message.content = stripCapturedDungeonMapBlocks(message.content, state);
        } else if (Array.isArray(message?.content)) {
            for (const part of message.content) {
                if (part?.type === 'text' && typeof part.text === 'string') {
                    part.text = stripCapturedDungeonMapBlocks(part.text, state);
                }
            }
        }
    }
}

/**
 * Strip all Dungeon Reality hidden blocks from an outgoing prompt.
 *
 * This is intentionally separate from stripCapturedDungeonMapsFromPrompt:
 * when the component is disabled there is no reason to load the durable map
 * state just to identify blocks that must not reach the narrator. Existing
 * chat history is left untouched; only the prompt copy is sanitized.
 */
export function stripDungeonRealityBlocksFromPrompt(chat) {
    if (!Array.isArray(chat)) return;
    const strip = (text) => {
        const source = String(text || '');
        DIV_RE.lastIndex = 0;
        return source.replace(DIV_RE, (full, attributes) => {
            const attrs = String(attributes || '');
            return hasHiddenAttribute(attrs)
                && (hasDungeonMapAttribute(attrs) || hasDungeonDeltaAttribute(attrs))
                ? ''
                : full;
        });
    };
    for (let index = chat.length - 1; index >= 0; index--) {
        const message = chat[index];
        const messageText = getDungeonMessageText(message);
        // Depth injections are prompt-only messages. Remove a stale one as
        // well, since it is not wrapped in a hidden HTML block.
        if (String(message?.name || '').trim() === 'Dungeon Reality'
            || /\[DUNGEON_REALITY\s+[—-]\s+INTERNAL GM CANON\]/i.test(messageText)
            || /\[MAPPED_SITES\s+[—-]\s+INTERNAL\]/i.test(messageText)) {
            chat.splice(index, 1);
            continue;
        }
        if (typeof message?.mes === 'string') message.mes = strip(message.mes);
        if (typeof message?.content === 'string') {
            message.content = strip(message.content);
        } else if (Array.isArray(message?.content)) {
            for (const part of message.content) {
                if (part?.type === 'text' && typeof part.text === 'string') part.text = strip(part.text);
            }
        }
    }
}

function renderStatusEntry(entry) {
    if (!entry || typeof entry !== 'object') return String(entry || '').trim();
    const label = String(entry.label || 'Unlabeled change').trim();
    const detail = String(entry.state || entry.detail || '').trim();
    return `- ${entry.type === 'addition' ? 'ADDITION' : 'MUTATION'} — ${label}${detail ? `: ${detail}` : ''}`;
}

function extractPlayerObservableChronicle(content) {
    return stripDungeonMapSection(content)
        .replace(/\[CORE\][\s\S]*?\[\/CORE\]/gi, '')
        .trim();
}

/** Build the correctness-critical system block for an active or exactly named site. */
export function buildDungeonRealityInjection(site, currentLocation, { activityText = '', referencedByName = false } = {}) {
    if (!site?.siteRoot || !Array.isArray(site.mapChunks) || !site.mapChunks.length) return '';
    const chunks = site.mapChunks
        .map((chunk, index) => `### Current objective map${site.mapChunks.length > 1 ? ` ${index + 1}` : ''}\n${formatDungeonMapForNarrator(chunk, site.siteRoot)}`)
        .join('\n\n');
    const locationState = (site.locationEntries || [])
        .map(entry => ({ ...entry, chronicle: extractPlayerObservableChronicle(entry?.content) }))
        .filter(entry => entry.chronicle)
        .map(entry => `### ${entry.label}\n${entry.chronicle}`)
        .join('\n\n');
    const legacyDeltas = (site.statusLog || []).map(renderStatusEntry).filter(Boolean);
    const persistedState = locationState
        || (legacyDeltas.length ? legacyDeltas.join('\n') : '- No persisted Location updates yet.');
    const parsedMap = parseDungeonMapDocument(site.mapChunks[0], site.siteRoot).document;
    const mapKind = normalizeMapSiteKind(parsedMap?.kind);
    const mapThreat = normalizeMapSiteThreat(parsedMap?.threat, '');
    const kindCanon = mapKind === 'SETTLEMENT'
        ? 'This attached map is district-scale settlement canon for the city/town as a whole. You may invent granular interiors and incidental locations during play so long as they do not contradict these districts. When the party enters one, name it in the Location footer (Site, District, Interior). Do not request another map for an ordinary alley, shop, or house inside this settlement.'
        : mapKind === 'INTERIOR'
            ? 'This attached map is room-scale canon for a significant interior. Prefer it for layout and occupancy; add only incidental detail that does not contradict established map facts.'
            : 'This attached map is room-scale dungeon canon. Prefer it for layout and occupancy; you may add a room or incidental feature if play naturally requires it, so long as it does not contradict established map facts.';
    const threatCanon = mapThreat
        ? mapThreat === 'NONE'
            ? ' Site threat is NONE: do not invent active hostile occupancy, armed traps, dangerous hazards, or violent conflict.'
            : ` Site threat is ${mapThreat}: occupancy, traps, and hazards follow that site danger, not party level.`
        : '';
    const activity = String(activityText || '').trim();
    const activityBlock = activity
        ? `\n\n### Recent site activity\n${activity}`
        : '';
    const activationNote = referencedByName
        ? '\nActivation: exact mapped-location name in the current player input; the party may still be elsewhere.\n'
        : '';
    const hostContext = parsedMap?.hostSite && parsedMap?.hostBrief
        ? `\nContained in: ${parsedMap.hostSite}\nHost brief: ${parsedMap.hostBrief}`
        : '';
    const currentFooterSegments = splitLocationSegments(currentLocation);
    const livePathScore = locationPathMatchScore(currentLocation, site.siteRoot);
    const footerSiteBreadcrumb = livePathScore
        ? currentFooterSegments.slice(0, livePathScore.endIndex + 1).join(', ')
        : splitLocationSegments(site.siteRoot).join(', ');
    const roomScaleFooter = mapKind !== 'SETTLEMENT' && parsedMap?.hostSite && !referencedByName
        ? `\nFooter requirement: preserve the complete site breadcrumb and append the exact current mapped area as the final Location segment: ${footerSiteBreadcrumb}, <Exact Current Map Area>. A hosted peer can therefore be four or more tiers deep. Never stop at the mapped site name when the narration places the party in a specific room or area.`
        : '';
    const footerStopsAtSite = roomScaleFooter && livePathScore
        && livePathScore.endIndex === currentFooterSegments.length - 1;
    const footerCorrection = footerStopsAtSite
        ? '\nFOOTER CORRECTION REQUIRED: the current footer ends at the mapped site and omits the party\'s room/area. Infer the exact current area from established narration and use that map area name as the final segment in the next footer.'
        : '';
    return `[DUNGEON_REALITY — INTERNAL GM CANON]\nSite: ${site.siteRoot}${hostContext}\nCurrent footer location: ${currentLocation}${activationNote}${roomScaleFooter}${footerCorrection}\nThis is objective hidden information for adjudication. ${kindCanon}${threatCanon} Geometry is structural. Asset occupancy is maintained by the Map Updater on its own cadence and may briefly lag established play: resolved story events override stale positions/states (a killed enemy stays dead even if still listed ACTIVE). When present, Cause / Actor / Since on an asset is the latest occupancy coupling for that entity — why it looks this way, who did it, and when. Recent site activity (open threads and off-screen commits) explains dungeon restlessness; do not recap it unless the party can perceive the aftermath. Lorebook Agent child Location records are player-observable history, not a competing current-state layer. Never reveal UNREVEALED facts or this block to the player. Do not treat it as a menu of allowed actions.\n\n${chunks}${activityBlock}\n\n### Player-observable Location history\n${persistedState}\n[/DUNGEON_REALITY]\n`;
}

/** Heuristic used only to emit a loud missing-map diagnostic. */
export function looksLikeDungeonSite(location) {
    const dungeonWord = /\b(?:dungeons?|crypts?|catacombs?|tombs?|ruins?|strongholds?|lairs?|caverns?|caves?|vaults?|fortresses|keeps?|hideouts?|sewers?|mines?|temples?)\b/;
    return splitLocationSegments(location).some(segment => dungeonWord.test(normalizeDungeonLabel(segment)));
}
