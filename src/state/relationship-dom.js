/**
 * DOM helper for relationship tier badges (kept out of pure math module).
 */

import { getFriendshipTier, getAffectionTier, getRelTierBadgeStyle } from './relationship-math.js';

/** Apply tier label + dynamic pill styling to an existing badge element. */
export function applyRelTierBadgeElement(el, type, value, max) {
    if (!el) return;
    const tier = type === 'friendship' ? getFriendshipTier(value, max) : getAffectionTier(value, max);
    el.className = `rt-npc-tier-badge ${type}`;
    el.setAttribute('style', getRelTierBadgeStyle(type, value, max));
    el.title = tier.hint;
    el.textContent = tier.label;
}

/** Minimum gap between consecutive float spawns. */
const REL_FLOAT_STAGGER_MS = 340;
/** Vertical spacing between concurrent float slots. */
const REL_FLOAT_SLOT_Y_PX = 30;
/** Horizontal spacing between concurrent float slots (extends left from right edge). */
const REL_FLOAT_SLOT_X_PX = 16;

/** Next earliest time a new float may appear. */
let _relFloatNextAt = 0;
/** Slot indices currently occupied by live floats. */
const _relFloatActiveSlots = new Set();

/** @returns {number} */
function claimRelFloatSlot() {
    let slot = 0;
    while (_relFloatActiveSlots.has(slot)) slot += 1;
    _relFloatActiveSlots.add(slot);
    return slot;
}

/** @param {number} slot */
function releaseRelFloatSlot(slot) {
    _relFloatActiveSlots.delete(slot);
}

/**
 * Show an RPG-style floating graphic when Friendship/Affection points change.
 * Floats upward and fades out inside the State Tracker panel (right edge).
 * Concurrent awards are staggered in time and spread across vertical/horizontal slots.
 *
 * @param {{ npc: string, field: 'friendship'|'affection', delta: number }} opts
 */
export function showRelationshipFloatFeedback({ npc, field, delta }) {
    if (typeof document === 'undefined' || !delta) return;

    const now = Date.now();
    const delay = Math.max(0, _relFloatNextAt - now);
    _relFloatNextAt = Math.max(now, _relFloatNextAt) + REL_FLOAT_STAGGER_MS;

    window.setTimeout(() => {
        spawnRelationshipFloat({ npc, field, delta });
    }, delay);
}

/**
 * @param {{ npc: string, field: 'friendship'|'affection', delta: number }} opts
 */
function spawnRelationshipFloat({ npc, field, delta }) {
    const host = document.getElementById('rpg-tracker-panel');
    if (!host) return;

    const isFriendship = field === 'friendship';
    const polarity = delta > 0 ? 'positive' : 'negative';
    const sign = delta > 0 ? '+' : '';
    const icon = isFriendship ? '🤝' : '💗';
    const label = isFriendship ? 'Friendship' : 'Affection';

    let layer = host.querySelector('#rt-rel-float-layer');
    if (!layer) {
        // Drop any leftover body-level layer from older builds
        document.getElementById('rt-rel-float-layer')?.remove();
        layer = document.createElement('div');
        layer.id = 'rt-rel-float-layer';
        layer.className = 'rt-rel-float-layer';
        layer.setAttribute('aria-live', 'polite');
        layer.setAttribute('aria-atomic', 'false');
        host.appendChild(layer);
    }

    const slot = claimRelFloatSlot();
    // Positive X = further left from the right edge; Y = higher start within the panel
    const xOffset = (slot % 3) * REL_FLOAT_SLOT_X_PX + (slot >= 3 ? 8 : 0);
    const yOffset = slot * REL_FLOAT_SLOT_Y_PX + ((slot % 2) === 1 ? 10 : 0);

    const el = document.createElement('div');
    el.className = `rt-rel-float rt-rel-float--${isFriendship ? 'friendship' : 'affection'} rt-rel-float--${polarity}`;
    el.setAttribute('role', 'status');
    el.style.setProperty('--rt-rel-float-x', `${xOffset}px`);
    el.style.setProperty('--rt-rel-float-y', `${yOffset}px`);

    const iconEl = document.createElement('span');
    iconEl.className = 'rt-rel-float-icon';
    iconEl.textContent = icon;

    const deltaEl = document.createElement('span');
    deltaEl.className = 'rt-rel-float-delta';
    deltaEl.textContent = `${sign}${delta}`;

    const labelEl = document.createElement('span');
    labelEl.className = 'rt-rel-float-label';
    labelEl.textContent = label;

    const npcEl = document.createElement('span');
    npcEl.className = 'rt-rel-float-npc';
    npcEl.textContent = String(npc || '').trim();

    el.append(iconEl, deltaEl, labelEl);
    if (npcEl.textContent) el.appendChild(npcEl);

    layer.appendChild(el);

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        el.removeEventListener('animationend', cleanup);
        el.remove();
        releaseRelFloatSlot(slot);
        if (layer && !layer.childElementCount) layer.remove();
    };
    el.addEventListener('animationend', cleanup);
    // Fallback if animationend never fires (e.g. reduced-motion / display:none)
    window.setTimeout(cleanup, 3200 + Math.min(slot, 4) * REL_FLOAT_STAGGER_MS);
}
