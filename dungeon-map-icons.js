/**
 * Characteristic map-node icons for asset kind + operational mood.
 * Kind art lives in src/ui/SVG; overlays mark deactivated / dead states.
 * Knowledge is separate: player-facing views only show KNOWN/SUSPECTED.
 */

const KIND_ORDER = ['CREATURE', 'GROUP', 'SUBDUNGEON', 'SUBINTERIOR', 'BUILDING', 'TRAP', 'HAZARD', 'ALARM', 'BARRIER', 'EFFECT', 'LOOT', 'OBJECT', 'OTHER'];

const GONE_STATES = new Set(['DEAD', 'DESTROYED', 'TAKEN', 'REMOVED']);
const SPENT_STATES = new Set(['TRIGGERED', 'EXHAUSTED', 'EXPIRED', 'CLEARED', 'DISMISSED']);
const OFF_STATES = new Set(['DEACTIVATED', 'DISABLED', 'CLOSED', 'LOCKED', 'BLOCKED', 'CAPTURED', 'DORMANT']);
const LIVE_TRAP_STATES = new Set(['ARMED', 'ACTIVE', 'ALERT', 'IDLE']);
const STRESSED_STATES = new Set(['FLEEING', 'DAMAGED', 'ALERT']);

const KIND_ART = {
    CREATURE: new URL('./src/ui/SVG/man-person.svg', import.meta.url).href,
    GROUP: new URL('./src/ui/SVG/group.svg', import.meta.url).href,
    TRAP: new URL('./src/ui/SVG/trap.svg', import.meta.url).href,
    HAZARD: new URL('./src/ui/SVG/hazard-sign.svg', import.meta.url).href,
    ALARM: new URL('./src/ui/SVG/alarm.svg', import.meta.url).href,
    BARRIER: new URL('./src/ui/SVG/barrier.svg', import.meta.url).href,
    EFFECT: new URL('./src/ui/SVG/effect.svg', import.meta.url).href,
    LOOT: new URL('./src/ui/SVG/open-treasure-chest.svg', import.meta.url).href,
    BUILDING: new URL('./src/ui/SVG/building.svg', import.meta.url).href,
    SUBDUNGEON: new URL('./src/ui/SVG/subdungeon.svg', import.meta.url).href,
    SUBINTERIOR: new URL('./src/ui/SVG/subinterior.svg', import.meta.url).href,
    OBJECT: new URL('./src/ui/SVG/object.svg', import.meta.url).href,
    OTHER: new URL('./src/ui/SVG/other.svg', import.meta.url).href,
};

const SLASH_OVERLAY = '<path d="M2 10.1 L10.1 2" fill="none" stroke="#0b1220" stroke-width="2.5" stroke-linecap="round" pointer-events="none"/><path d="M2 10.1 L10.1 2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" pointer-events="none"/>';
const CROSS_OVERLAY = '<path d="M2.3 2.3 L9.7 9.7 M9.7 2.3 L2.3 9.7" fill="none" stroke="#0b1220" stroke-width="2.4" stroke-linecap="round" pointer-events="none"/><path d="M2.3 2.3 L9.7 9.7 M9.7 2.3 L2.3 9.7" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" pointer-events="none"/>';

export const MAP_ICON_SIZE = { compact: 16.9, expanded: 18.2 };
export const MAP_ICON_GAP = 6;
export const MAP_ICON_MAX = { compact: 5, expanded: 6 };
export const MAP_NODE_FONT = { compact: 13, expanded: 15.6 };

const KIND_ART_STYLE_ID = 'rt-dungeon-graph-kind-art';

/**
 * One shared stylesheet for kind masks instead of per-icon inline mask-image.
 * Inline masks recost every glyph on hover; a single rule per kind stays cached.
 */
export function ensureDungeonMapKindArtStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(KIND_ART_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = KIND_ART_STYLE_ID;
    style.textContent = Object.entries(KIND_ART).map(([kind, href]) => {
        const cls = kind.toLowerCase();
        const url = JSON.stringify(href);
        return `.rt-dungeon-graph-icon-${cls} .rt-dungeon-graph-icon-art{-webkit-mask-image:url(${url});mask-image:url(${url});}`;
    }).join('');
    document.head.appendChild(style);
}

const ICON_STACK = {
    compact: { padTop: 4, gap: 3, padBottom: 3 },
    expanded: { padTop: 5, gap: 3, padBottom: 4 },
};

/** Label/icon packing for a room node that has occupancy glyphs. */
export function mapNodeIconMetrics(compact = true) {
    const key = compact ? 'compact' : 'expanded';
    const icon = MAP_ICON_SIZE[key];
    const font = MAP_NODE_FONT[key];
    const stack = ICON_STACK[key];
    return {
        icon,
        font,
        labelYOffset: stack.padTop + font / 2,
        iconYOffset: stack.padTop + font + stack.gap + icon / 2,
        height: stack.padTop + font + stack.gap + icon + stack.padBottom,
    };
}

function kindRank(kind) {
    const index = KIND_ORDER.indexOf(kind);
    return index === -1 ? KIND_ORDER.length : index;
}

/**
 * Visual mood for a stored kind+state pair.
 * Live traps/alarms collapse ACTIVE and ARMED onto ARMED.
 * Neutralized mechanisms use DEACTIVATED (DISARMED is coerced before this).
 */
export function mapAssetIconMood(kind, state) {
    const type = String(kind || 'OTHER').toUpperCase();
    const status = String(state || 'ACTIVE').toUpperCase();
    if (status === 'DEAD') return 'DEAD';
    if (GONE_STATES.has(status)) return 'DESTROYED';
    if (type === 'TRAP' || type === 'ALARM') {
        if (status === 'TRIGGERED') return 'TRIGGERED';
        if (LIVE_TRAP_STATES.has(status)) return 'ARMED';
        if (OFF_STATES.has(status) || status === 'DEACTIVATED') return 'DEACTIVATED';
    }
    if (SPENT_STATES.has(status)) return 'SPENT';
    if ((type === 'CREATURE' || type === 'GROUP') && STRESSED_STATES.has(status)) return 'STRESSED';
    if (OFF_STATES.has(status)) return 'DEACTIVATED';
    return 'LIVE';
}

export function mapAssetIconToken(asset) {
    const kind = String(asset?.kind || 'OTHER').toUpperCase();
    return `${kind}_${mapAssetIconMood(kind, asset?.state)}`;
}

function isPlayerVisibleAsset(asset) {
    const knowledge = String(asset?.knowledge || '').toUpperCase();
    return knowledge === 'KNOWN' || knowledge === 'SUSPECTED';
}

function isPlacedAsset(asset) {
    if (!asset?.location) return false;
    return String(asset.state || '').toUpperCase() !== 'REMOVED';
}

/**
 * Icons that belong on one room node.
 * @param {object[]} assets
 * @param {string} areaId
 * @param {{ playerFacing?: boolean }} [options]
 */
export function collectAreaAssetIcons(assets, areaId, { playerFacing = true } = {}) {
    const occupying = (Array.isArray(assets) ? assets : []).filter(asset => {
        if (!isPlacedAsset(asset) || asset.location !== areaId) return false;
        if (playerFacing && !isPlayerVisibleAsset(asset)) return false;
        return true;
    });
    occupying.sort((a, b) => {
        const rank = kindRank(a.kind) - kindRank(b.kind);
        if (rank) return rank;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return occupying.map(asset => {
        const knowledge = String(asset.knowledge || 'UNREVEALED').toUpperCase();
        const mood = mapAssetIconMood(asset.kind, asset.state);
        return {
            token: `${String(asset.kind || 'OTHER').toUpperCase()}_${mood}`,
            kind: String(asset.kind || 'OTHER').toUpperCase(),
            mood,
            knowledge,
            state: String(asset.state || '').toUpperCase(),
            name: String(asset.name || '').trim(),
            detail: String(asset.detail || '').trim(),
            count: Number.isInteger(asset.count) ? asset.count : null,
        };
    });
}

function overlayForMood(mood) {
    if (mood === 'DEACTIVATED' || mood === 'SPENT') return SLASH_OVERLAY;
    if (mood === 'DESTROYED' || mood === 'DEAD') return CROSS_OVERLAY;
    return '';
}

function renderOneIcon(icon, x, y, size) {
    const scale = size / 12;
    const knowledgeClass = `rt-dungeon-graph-icon-${String(icon.knowledge || 'known').toLowerCase()}`;
    const classes = [
        'rt-dungeon-graph-icon',
        `rt-dungeon-graph-icon-${icon.kind.toLowerCase()}`,
        `rt-dungeon-graph-icon-${icon.mood.toLowerCase()}`,
        knowledgeClass,
    ].join(' ');
    const count = Number.isInteger(icon.count) ? String(icon.count) : '';
    return `<g class="${classes}" data-icon="${escapeXml(icon.token)}" data-asset-name="${escapeXml(icon.name)}" data-asset-kind="${escapeXml(icon.kind)}" data-asset-state="${escapeXml(icon.state)}" data-asset-knowledge="${escapeXml(icon.knowledge)}" data-asset-detail="${escapeXml(icon.detail || '')}"${count ? ` data-asset-count="${escapeXml(count)}"` : ''} transform="translate(${x},${y}) scale(${scale})" stroke="none">
        <rect class="rt-dungeon-graph-icon-hit" x="0" y="0" width="12" height="12" fill="transparent" pointer-events="all"></rect>
        <rect class="rt-dungeon-graph-icon-art" x="0" y="0" width="12" height="12" fill="currentColor" pointer-events="none"></rect>
        ${overlayForMood(icon.mood)}
    </g>`;
}

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

/**
 * Inspector-matching HTML for the immediate asset hover card.
 * @param {{ name?: string, kind?: string, state?: string, knowledge?: string, detail?: string, count?: string|number|null }} asset
 */
export function renderDungeonGraphAssetTipHtml(asset = {}) {
    const name = String(asset.name || 'Asset').trim() || 'Asset';
    const count = Number.isInteger(Number(asset.count)) && Number(asset.count) > 1
        ? ` ×${Number(asset.count)}`
        : '';
    const tags = [
        { value: asset.kind, className: '' },
        { value: asset.state, className: 'rt-dungeon-map-state' },
        { value: asset.knowledge, className: 'rt-dungeon-map-knowledge' },
    ].filter(tag => tag.value)
        .map(tag => `<span class="rt-dungeon-map-tag ${tag.className}">${escapeHtml(tag.value)}</span>`)
        .join('');
    const detail = String(asset.detail || '').trim();
    return `<div class="rt-dungeon-graph-asset-tip-head"><strong>${escapeHtml(name)}${count}</strong>${tags}</div>${
        detail ? `<div class="rt-dungeon-graph-asset-tip-detail">${escapeHtml(detail)}</div>` : ''
    }`;
}

function serializeOverflowAssets(icons = []) {
    return escapeXml(JSON.stringify(icons.map(icon => ({
        name: icon.name,
        kind: icon.kind,
        state: icon.state,
        knowledge: icon.knowledge,
        detail: icon.detail,
        count: icon.count,
    }))));
}

/** Stacked inspector cards for assets hidden behind a +N overflow badge. */
export function renderDungeonGraphOverflowTipHtml(assets = []) {
    const list = Array.isArray(assets) ? assets : [];
    if (!list.length) return '';
    return `<div class="rt-dungeon-graph-overflow-tip">${
        list.map(asset => `<div class="rt-dungeon-graph-overflow-tip-item">${renderDungeonGraphAssetTipHtml(asset)}</div>`).join('')
    }</div>`;
}

/**
 * Render a centered icon row for a room node.
 * @param {object[]} icons
 * @param {{ cx: number, y: number, compact?: boolean }} options  y is the vertical center of the icon band
 */
export function renderAreaAssetIconsSvg(icons, { cx, y, compact = true } = {}) {
    const list = Array.isArray(icons) ? icons : [];
    if (!list.length) return '';
    const size = compact ? MAP_ICON_SIZE.compact : MAP_ICON_SIZE.expanded;
    const max = compact ? MAP_ICON_MAX.compact : MAP_ICON_MAX.expanded;
    const overflowSize = compact ? 11.7 : 13;
    const shown = list.slice(0, max);
    const overflow = list.length - shown.length;
    const slots = shown.length + (overflow > 0 ? 1 : 0);
    const total = slots * size + (slots - 1) * MAP_ICON_GAP;
    let x = cx - total / 2;
    const top = y - size / 2;
    const parts = shown.map(icon => {
        const svg = renderOneIcon(icon, x, top, size);
        x += size + MAP_ICON_GAP;
        return svg;
    });
    if (overflow > 0) {
        const label = `+${overflow}`;
        const hidden = list.slice(max);
        const slotX = x;
        parts.push(`<g class="rt-dungeon-graph-icon-overflow" data-overflow-assets="${serializeOverflowAssets(hidden)}" transform="translate(${slotX},${top})">
        <rect class="rt-dungeon-graph-icon-overflow-hit" x="0" y="0" width="${size}" height="${size}" fill="transparent" pointer-events="all"></rect>
        <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${overflowSize}" pointer-events="none">${label}</text>
    </g>`);
    }
    return `<g class="rt-dungeon-graph-icons">${parts.join('')}</g>`;
}
