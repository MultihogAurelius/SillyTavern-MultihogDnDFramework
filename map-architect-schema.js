const AREA_SCHEMA = Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: {
        id: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
        name: { type: 'string', minLength: 1 },
        knowledge: { type: 'string', enum: ['UNREVEALED', 'DISCOVERED', 'VISITED'] },
        geometry: { type: 'array', items: { type: 'string', minLength: 1 } },
        connections: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    to: { type: 'string', minLength: 1 },
                    state: { type: 'string', enum: ['OPEN', 'CLOSED', 'LOCKED', 'BLOCKED', 'DESTROYED', 'UNKNOWN'] },
                    detail: { type: 'string' },
                },
                required: ['to', 'state', 'detail'],
            },
        },
    },
    required: ['id', 'name', 'knowledge', 'geometry', 'connections'],
});

const ASSET_SCHEMA = Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: {
        id: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
        kind: { type: 'string', enum: ['CREATURE', 'GROUP', 'TRAP', 'HAZARD', 'OBJECT', 'BUILDING', 'SUBDUNGEON', 'SUBINTERIOR', 'LOOT', 'BARRIER', 'ALARM', 'EFFECT', 'OTHER'] },
        name: { type: 'string', minLength: 1 },
        location: { type: 'string', minLength: 1 },
        state: {
            type: 'string',
            enum: [
                'ACTIVE', 'ALERT', 'IDLE', 'DORMANT', 'FLEEING', 'LEFT', 'LEAVING', 'CAPTURED',
                'DEAD', 'DESTROYED', 'DISABLED', 'DEACTIVATED', 'DISARMED', 'ARMED', 'TRIGGERED',
                'LOCKED', 'UNLOCKED', 'OPEN', 'CLOSED', 'BLOCKED', 'CLEARED',
                'INTACT', 'DAMAGED', 'TAKEN', 'AVAILABLE', 'EXHAUSTED', 'EXPIRED',
                'DISMISSED', 'REMOVED', 'UNKNOWN',
            ],
        },
        knowledge: { type: 'string', enum: ['UNREVEALED', 'SUSPECTED', 'KNOWN'] },
        detail: { type: 'string' },
        origin: { type: 'string', enum: ['INITIAL_MAP'] },
        behavior: { type: 'string', minLength: 1 },
        route: { type: 'array', items: { type: 'string', minLength: 1 } },
        faction: { type: 'string', minLength: 1 },
        owner: { type: 'string', minLength: 1 },
        duration: { type: 'string', minLength: 1, description: 'Optional absolute in-world temporal boundary.' },
        count: { type: 'integer', minimum: 1, maximum: 99 },
    },
    required: ['id', 'kind', 'name', 'location', 'state', 'knowledge', 'detail', 'origin'],
});

const MAP_IDENTITY_PROPERTIES = Object.freeze({
    version: { type: 'integer', enum: [3] },
    site: { type: 'string', minLength: 1 },
    kind: { type: 'string', enum: ['DUNGEON', 'SETTLEMENT', 'INTERIOR'] },
    threat: { type: 'string', enum: ['NONE', 'LOW', 'MODERATE', 'HIGH', 'DEADLY'] },
});

export const MAP_ARCHITECT_TOPOLOGY_JSON_SCHEMA = Object.freeze({
    name: 'dungeon_map_topology_v3',
    description: 'The complete immutable topology for one private objective map.',
    strict: false,
    returnInvalid: true,
    value: {
        type: 'object',
        additionalProperties: false,
        properties: {
            ...MAP_IDENTITY_PROPERTIES,
            areas: { type: 'array', minItems: 2, items: AREA_SCHEMA },
        },
        required: ['version', 'site', 'kind', 'threat', 'areas'],
    },
});

export const MAP_ARCHITECT_ASSETS_JSON_SCHEMA = Object.freeze({
    name: 'dungeon_map_assets_v3',
    description: 'Initial contents placed into an already locked map topology.',
    strict: false,
    returnInvalid: true,
    value: {
        type: 'object',
        additionalProperties: false,
        properties: {
            assets: { type: 'array', items: ASSET_SCHEMA },
        },
        required: ['assets'],
    },
});

/** Full persistent document contract retained for validation, editing, and tests. */
export const MAP_ARCHITECT_JSON_SCHEMA = Object.freeze({
    name: 'dungeon_map_v3',
    description: 'A complete private objective map for one dungeon, significant interior, or settlement.',
    strict: false,
    returnInvalid: true,
    value: {
        type: 'object',
        additionalProperties: false,
        properties: {
            ...MAP_IDENTITY_PROPERTIES,
            areas: { type: 'array', minItems: 2, items: AREA_SCHEMA },
            assets: { type: 'array', items: ASSET_SCHEMA },
        },
        required: ['version', 'site', 'areas', 'assets'],
    },
});

/** Handshake-only contract: infer CreateAreaMap fields without emitting a map. */
export const MAP_ARCHITECT_BRIEF_JSON_SCHEMA = Object.freeze({
    name: 'map_architect_brief_v1',
    description: 'Handshake fields for one Persistent Map, without the map itself.',
    strict: false,
    returnInvalid: true,
    value: {
        type: 'object',
        additionalProperties: false,
        properties: {
            entrance: { type: 'string', minLength: 1 },
            kind: { type: 'string', enum: ['DUNGEON', 'SETTLEMENT', 'INTERIOR'] },
            scale: { type: 'string', enum: ['SMALL', 'MEDIUM', 'LARGE'] },
            threat: { type: 'string', enum: ['NONE', 'LOW', 'MODERATE', 'HIGH', 'DEADLY'] },
            prompt: { type: 'string', minLength: 1, description: 'Complete private design guidance for generating the map.' },
            brief_description: { type: 'string', minLength: 1, description: 'Brief current description suitable for the Location CORE and any parent-map gateway asset.' },
            keywords: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                maxItems: 5,
                description: 'Optional extra lorebook trigger words besides the locked site name. Do not include the site name.',
            },
        },
        required: ['entrance', 'kind', 'scale', 'threat', 'prompt', 'brief_description'],
    },
});
