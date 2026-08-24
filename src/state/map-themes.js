/**
 * Persistent-map presentation themes. These settings never alter [MAP] data.
 */

export const MAP_THEME_FIELDS = Object.freeze([
    { key: 'background', label: 'Canvas', group: 'Map' },
    { key: 'frame', label: 'Frame', group: 'Map' },
    { key: 'node', label: 'Unvisited area', group: 'Areas' },
    { key: 'nodeDiscovered', label: 'Visited area', group: 'Areas' },
    { key: 'nodeFog', label: 'Hidden area', group: 'Areas' },
    { key: 'text', label: 'Area text', group: 'Areas' },
    { key: 'textMuted', label: 'Visited text', group: 'Areas' },
    { key: 'accent', label: 'Current area', group: 'Areas' },
    { key: 'route', label: 'Open route', group: 'Routes' },
    { key: 'routeLocked', label: 'Closed / locked', group: 'Routes' },
    { key: 'routeBlocked', label: 'Blocked / destroyed', group: 'Routes' },
    { key: 'creature', label: 'Creature', group: 'Assets' },
    { key: 'group', label: 'Group', group: 'Assets' },
    { key: 'trap', label: 'Trap', group: 'Assets' },
    { key: 'hazard', label: 'Hazard', group: 'Assets' },
    { key: 'alarm', label: 'Alarm', group: 'Assets' },
    { key: 'barrier', label: 'Barrier', group: 'Assets' },
    { key: 'object', label: 'Object', group: 'Assets' },
    { key: 'loot', label: 'Loot', group: 'Assets' },
    { key: 'effect', label: 'Effect', group: 'Assets' },
    { key: 'other', label: 'Other', group: 'Assets' },
]);

export const DEFAULT_MAP_THEME = Object.freeze({
    background: '#0c0c0c',
    frame: '#ffaa00',
    node: '#161616',
    nodeDiscovered: '#101010',
    nodeFog: '#0a0a0a',
    text: '#f0f0f0',
    textMuted: '#c8c8c8',
    accent: '#ffaa00',
    route: '#ffaa00',
    routeLocked: '#ffaa00',
    routeBlocked: '#ea4335',
    creature: '#ffffff',
    group: '#ffffff',
    trap: '#ff5a2a',
    hazard: '#ffc53d',
    alarm: '#ffaa00',
    barrier: '#e8d5b0',
    object: '#d4a574',
    loot: '#ffcc4a',
    effect: '#ff9a5c',
    other: '#c8925a',
});

function makeTheme(overrides) {
    return Object.freeze({ ...DEFAULT_MAP_THEME, ...overrides });
}

export const FACTORY_MAP_THEME_PRESETS = Object.freeze([
    Object.freeze({ id: 'factory:ember', name: 'Ember', theme: DEFAULT_MAP_THEME }),
    Object.freeze({
        id: 'factory:blueprint',
        name: 'Blueprint',
        theme: makeTheme({
            background: '#071520', frame: '#5cc8ff', node: '#102d42', nodeDiscovered: '#0b2233', nodeFog: '#061019',
            text: '#e7f7ff', textMuted: '#9bc9dc', accent: '#63d4ff', route: '#4eb8e8', routeLocked: '#a7dff5',
            routeBlocked: '#ff6b6b', creature: '#ffffff', group: '#ffffff', trap: '#ff667a', hazard: '#ffd166',
            alarm: '#ffb347', barrier: '#b8d8e8', object: '#80c7e8', loot: '#ffe08a', effect: '#9cafff', other: '#89aec2',
        }),
    }),
    Object.freeze({
        id: 'factory:verdant',
        name: 'Verdant',
        theme: makeTheme({
            background: '#08120d', frame: '#66c27f', node: '#14251a', nodeDiscovered: '#0f1d14', nodeFog: '#060d09',
            text: '#e8f5e9', textMuted: '#a9c9af', accent: '#7ee09a', route: '#61b879', routeLocked: '#c3d6a4',
            routeBlocked: '#e85d5d', creature: '#ffffff', group: '#ffffff', trap: '#e65b4f', hazard: '#eacb64',
            alarm: '#f0a84f', barrier: '#d5d0ad', object: '#b89b72', loot: '#f2d06b', effect: '#83c5be', other: '#91a889',
        }),
    }),
    Object.freeze({
        id: 'factory:parchment',
        name: 'Parchment',
        theme: makeTheme({
            background: '#241b12', frame: '#c99b52', node: '#3a2a1b', nodeDiscovered: '#2e2117', nodeFog: '#1b140e',
            text: '#f4e5c1', textMuted: '#cbb991', accent: '#f0bd61', route: '#bf8b46', routeLocked: '#e0c58b',
            routeBlocked: '#c65345', creature: '#ffffff', group: '#ffffff', trap: '#cf5941', hazard: '#e1b84f',
            alarm: '#d98d3e', barrier: '#d8c7a0', object: '#b89469', loot: '#e6c35c', effect: '#c78f67', other: '#ad8c67',
        }),
    }),
]);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeMapTheme(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const normalized = {};
    for (const { key } of MAP_THEME_FIELDS) {
        const candidate = String(source[key] || '').trim();
        normalized[key] = HEX_COLOR.test(candidate) ? candidate.toLowerCase() : DEFAULT_MAP_THEME[key];
    }
    return normalized;
}

export function normalizeSavedMapThemePresets(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const normalized = {};
    for (const [rawName, theme] of Object.entries(value).slice(0, 100)) {
        const name = String(rawName || '').trim().slice(0, 80);
        if (!name || name === '__proto__' || name === 'constructor' || name === 'prototype') continue;
        normalized[name] = normalizeMapTheme(theme);
    }
    return normalized;
}

export function resolveMapThemePreset(id, savedPresets = {}) {
    const presetId = String(id || '');
    const factory = FACTORY_MAP_THEME_PRESETS.find(preset => preset.id === presetId);
    if (factory) return normalizeMapTheme(factory.theme);
    if (presetId.startsWith('user:')) {
        const name = presetId.slice(5);
        if (Object.prototype.hasOwnProperty.call(savedPresets, name)) return normalizeMapTheme(savedPresets[name]);
    }
    return null;
}

function hexToRgba(hex, alpha) {
    const color = normalizeMapTheme({ background: hex }).background;
    const value = Number.parseInt(color.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Apply a normalized theme to a document root so every open map updates live. */
export function applyMapThemeToRoot(theme, root = globalThis.document?.documentElement) {
    if (!root?.style?.setProperty) return;
    const t = normalizeMapTheme(theme);
    const vars = {
        '--rt-map-background': t.background,
        '--rt-map-background-tooltip': hexToRgba(t.background, 0.96),
        '--rt-map-frame': t.frame,
        '--rt-map-frame-soft': hexToRgba(t.frame, 0.35),
        '--rt-map-node': t.node,
        '--rt-map-node-discovered': t.nodeDiscovered,
        '--rt-map-node-fog': t.nodeFog,
        '--rt-map-text': t.text,
        '--rt-map-text-muted': t.textMuted,
        '--rt-map-accent': t.accent,
        '--rt-map-accent-faint': hexToRgba(t.accent, 0.18),
        '--rt-map-accent-soft': hexToRgba(t.accent, 0.28),
        '--rt-map-accent-medium': hexToRgba(t.accent, 0.55),
        '--rt-map-accent-strong': hexToRgba(t.accent, 0.72),
        '--rt-map-route': hexToRgba(t.route, 0.48),
        '--rt-map-route-locked': hexToRgba(t.routeLocked, 0.72),
        '--rt-map-route-blocked': hexToRgba(t.routeBlocked, 0.55),
        '--rt-map-creature': t.creature,
        '--rt-map-group': t.group,
        '--rt-map-trap': t.trap,
        '--rt-map-hazard': t.hazard,
        '--rt-map-alarm': t.alarm,
        '--rt-map-barrier': t.barrier,
        '--rt-map-object': t.object,
        '--rt-map-loot': t.loot,
        '--rt-map-effect': t.effect,
        '--rt-map-other': t.other,
    };
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}
