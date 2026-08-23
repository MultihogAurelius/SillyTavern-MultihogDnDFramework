/**
 * Text-command opener for Map Architect when the narrator cannot use CreateAreaMap.
 * Native tool calling stays the default; this is an alternative handshake only.
 */

import { normalizeMapSiteKind, normalizeMapSiteThreat, defaultMapSiteThreat } from './dungeon-reality.js';

export const MAP_ARCHITECT_OPENER_TOOL = 'tool';
export const MAP_ARCHITECT_OPENER_TEXT = 'text';

export const CREATE_AREA_MAP_OPEN_TAG = '[CREATE_AREA_MAP]';
export const CREATE_AREA_MAP_CLOSE_TAG = '[/CREATE_AREA_MAP]';

const FENCE_RE = /\[\s*CREATE_AREA_MAP\s*\]([\s\S]*?)\[\s*\/\s*CREATE_AREA_MAP\s*\]/i;
const KEY_LINE_RE = /^\s*[*_`]*\s*(site|site_root|footer_root|footer|root|location|name|entrance|kind|scale|threat|danger|risk|threat_level|premise|include|attach_to_site|attach_to_cell)\s*[*_`]*\s*:\s*(.*)$/i;

/** Shipped dungeon-reality opener bullets used when text mode is live. */
export const MAP_ARCHITECT_TEXT_OPENER_CYOA_CAVEAT = 'When emitting a [CREATE_AREA_MAP] block this turn, CYOA Mode is suspended: do not append <choices>, <button> tags, numbered options, or any other end-of-output choices — even if CYOA instructions say you MUST ALWAYS end with choices. Output the block and STOP. On every other turn, CYOA choices are required as usual.';

export const MAP_ARCHITECT_TEXT_OPENER_RULES = `- When an unmapped site warrants a persistent graph, output a [CREATE_AREA_MAP] ... [/CREATE_AREA_MAP] block and STOP. You may establish the crossing in prose before the block; do not write prose after it. Do not design or emit the hidden map yourself.
- DUNGEON is a high-risk room graph. INTERIOR is a significant lower-risk multi-room site such as a palace, headquarters, monastery, or recurring base. SETTLEMENT is the city/town/village as a whole at district scale.
- You are a soft map editor. A nested map may be attached from anywhere without moving the player or first creating a BUILDING. Add attach_to_site (exact existing parent map) and attach_to_cell (exact existing parent AREA). site is the new child-map name; attach_to_cell is where its gateway belongs. The runtime creates/promotes SUB* and edits inactive parents. Omit both fields for a standalone map or deliberate active-cell shorthand.
- SETTLEMENT, DUNGEON, and INTERIOR maps may host DUNGEON/INTERIOR children, up to three mapped levels total. Never nest a SETTLEMENT. Similar names are distinct: Cellar Crypt is not Cellar Crypt Dungeon.
- Never call CreateAreaMap for a BUILDING that does not warrant a stable room graph, an OBJECT prop, a district, alley, street, wilderness, road, or countryside.
- Wilderness, roads, countryside, and other places between mapped sites are not mapped. Do not emit a map command for travel terrain or the wilds between a city and a dungeon. Narrate those normally without a site map.
- Use these exact field names: site, entrance, kind (DUNGEON, SETTLEMENT, or INTERIOR), scale (SMALL, MEDIUM, or LARGE), threat (NONE, LOW, MODERATE, HIGH, or DEADLY), premise, optional attach_to_site plus attach_to_cell, and optional include. include must be a JSON array of exact existing DUNGEON/INTERIOR names and is allowed only while first creating a SETTLEMENT.
- Scale is geographic size. Threat is site danger (enemy/trap density), never party level. A LARGE LOW ruin can be vast and empty; a SMALL DEADLY vault can be a meat grinder.
[CREATE_AREA_MAP]
site: Cellar Crypt Dungeon
entrance: Crypt Threshold
kind: DUNGEON
scale: SMALL
threat: HIGH
attach_to_site: Malarkey Monument
attach_to_cell: Cellar Crypt
premise: A funerary complex extends beyond the sealed western passage.
[/CREATE_AREA_MAP]
- ${MAP_ARCHITECT_TEXT_OPENER_CYOA_CAVEAT}
- A \`[MAPPED_SITES — INTERNAL]\` block lists every existing peer map. Do not recreate a listed map. A listed SETTLEMENT may still contain an unmapped SUB* asset or a BUILDING deliberately promoted by a DUNGEON/INTERIOR call. DUNGEON_REALITY is attached while the footer matches a mapped site, or for one turn when player input names it exactly.
- If a \`[DUNGEON_REALITY — INTERNAL GM CANON]\` block already exists for that site, its map is attached: do not emit the command again.
- Treat the Map Architect result and subsequent DUNGEON_REALITY blocks as private objective canon. Reveal only what {{user}} can perceive.`;

export function isMapArchitectTextOpener(settings) {
    return String(settings?.mapArchitectOpener || MAP_ARCHITECT_OPENER_TOOL).trim().toLowerCase() === MAP_ARCHITECT_OPENER_TEXT;
}

/** Prepend a map-handshake CYOA exception so "MUST ALWAYS end with choices" cannot win. */
export function applyCyoaMapHandshakeCaveat(cyoaBlock, caveat = MAP_ARCHITECT_TEXT_OPENER_CYOA_CAVEAT) {
    const block = String(cyoaBlock || '');
    if (!block || block.includes('[MAP OPENER EXCEPTION]')) return block;
    return block.replace(
        /^<CYOA_mode>\s*/i,
        `<CYOA_mode>\n[MAP OPENER EXCEPTION]\n${caveat}\n\n`,
    );
}

/** Prepend the text-opener CYOA exception so "MUST ALWAYS end with choices" cannot win. */
export function applyMapArchitectTextOpenerCyoaCaveat(cyoaBlock) {
    return applyCyoaMapHandshakeCaveat(cyoaBlock, MAP_ARCHITECT_TEXT_OPENER_CYOA_CAVEAT);
}

export function normalizeMapArchitectOpener(value) {
    return String(value || '').trim().toLowerCase() === MAP_ARCHITECT_OPENER_TEXT
        ? MAP_ARCHITECT_OPENER_TEXT
        : MAP_ARCHITECT_OPENER_TOOL;
}

/** Radio `name`s that all write `settings.mapArchitectOpener`. Distinct names so each copy can show the current value. */
export const MAP_ARCHITECT_OPENER_RADIO_NAMES = [
    'rpg_map_architect_opener',
    'rpg_map_architect_opener_components',
    'rt_onboarding_map_architect_opener',
];

export function applyMapArchitectOpenerToUi(value) {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
    const opener = normalizeMapArchitectOpener(value);
    MAP_ARCHITECT_OPENER_RADIO_NAMES.forEach((name) => {
        document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
            if (input instanceof HTMLInputElement) input.checked = input.value === opener;
        });
    });
}

/** Show the Components / onboarding opener radios only while Persistent Maps is checked. */
export function syncMapArchitectOpenerNestedVisibility(enabled) {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const on = !!enabled;
    const components = document.getElementById('rpg_map_architect_opener_components');
    if (components) components.style.display = on ? '' : 'none';
    if (typeof document.querySelectorAll !== 'function') return;
    document.querySelectorAll('#rt_onboarding_map_architect_opener_wrap').forEach((wrap) => {
        wrap.style.display = on ? 'flex' : 'none';
    });
}

function pickFirst(...values) {
    for (const value of values) {
        const text = String(value || '').trim();
        if (text) return text;
    }
    return '';
}

function normalizeScale(value) {
    const raw = String(value || '').trim();
    const upper = raw.toUpperCase();
    if (['SMALL', 'MEDIUM', 'LARGE'].includes(upper)) return upper;
    if (/SMALL\s*[-–to/]+\s*MEDIUM/i.test(raw) || /MEDIUM\s*[-–to/]+\s*LARGE/i.test(raw)) return 'MEDIUM';
    if (/\bLARGE\b/i.test(raw)) return 'LARGE';
    if (/\bMEDIUM\b/i.test(raw)) return 'MEDIUM';
    if (/\bSMALL\b/i.test(raw)) return 'SMALL';
    return 'MEDIUM';
}

function normalizeInclude(value) {
    if (Array.isArray(value)) return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
    const source = String(value || '').trim();
    if (!source) return [];
    try {
        const parsed = JSON.parse(source);
        return Array.isArray(parsed) ? normalizeInclude(parsed) : [];
    } catch (_) {
        return [];
    }
}

function inferSiteFromFooter(text) {
    const match = String(text || '').match(/\(Location:\s*([^)]+)\)/i);
    return match ? String(match[1] || '').trim() : '';
}

function normalizeArgs(raw, fallbackText = '') {
    const displayName = String(raw?.name || '').trim();
    const site = pickFirst(
        raw?.site,
        raw?.footer_root,
        raw?.footerRoot,
        raw?.site_root,
        raw?.siteRoot,
        raw?.footer,
        raw?.root,
        raw?.location,
        raw?.name,
        inferSiteFromFooter(fallbackText),
    );
    let premise = String(raw?.premise || '').trim();
    if (displayName && site && displayName.toLowerCase() !== site.toLowerCase()
        && !premise.toLowerCase().includes(displayName.toLowerCase())) {
        premise = premise ? `${displayName}. ${premise}` : displayName;
    }
    const normalized = {
        site,
        entrance: String(raw?.entrance || '').trim(),
        premise,
        kind: normalizeMapSiteKind(raw?.kind),
        scale: normalizeScale(raw?.scale),
        threat: normalizeMapSiteThreat(
            pickFirst(raw?.threat, raw?.danger, raw?.risk, raw?.threat_level, raw?.threatLevel),
            defaultMapSiteThreat(raw?.kind),
        ),
    };
    const include = normalizeInclude(raw?.include);
    if (include.length) normalized.include = include;
    const attachSite = pickFirst(raw?.attachTo?.site, raw?.attach_to_site);
    const attachCell = pickFirst(raw?.attachTo?.cell, raw?.attach_to_cell);
    if (attachSite || attachCell) normalized.attachTo = { site: attachSite, cell: attachCell };
    return normalized;
}

function decodeFenceSource(text) {
    return String(text || '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/&#91;|&lsqb;/gi, '[')
        .replace(/&#93;|&rsqb;/gi, ']');
}

function parseKeyedBody(body, fallbackText = '') {
    const trimmed = String(body || '').trim();
    if (!trimmed) return normalizeArgs({}, fallbackText);
    if (trimmed.startsWith('{')) {
        try {
            return normalizeArgs(JSON.parse(trimmed), fallbackText);
        } catch (_) { /* fall through to keyed lines */ }
    }
    const args = {
        site: '',
        footer_root: '',
        site_root: '',
        footer: '',
        root: '',
        location: '',
        name: '',
        entrance: '',
        kind: '',
        scale: 'MEDIUM',
        premise: '',
        include: '',
        attach_to_site: '',
        attach_to_cell: '',
    };
    let currentKey = null;
    const premiseParts = [];
    for (const line of trimmed.split(/\r?\n/)) {
        const match = line.match(KEY_LINE_RE);
        if (match) {
            currentKey = match[1].toLowerCase();
            const rest = String(match[2] || '');
            if (currentKey === 'premise') premiseParts.push(rest);
            else args[currentKey] = rest.trim();
            continue;
        }
        if (currentKey === 'premise') premiseParts.push(line);
    }
    if (premiseParts.length) args.premise = premiseParts.join('\n').trim();
    return normalizeArgs(args, fallbackText);
}

/**
 * @param {string} text
 * @returns {{ args: { site: string, entrance: string, kind: string, scale: string, threat: string, premise: string }, preamble: string, raw: string } | null}
 */
export function parseCreateAreaMapCommand(text) {
    const original = String(text || '');
    const source = decodeFenceSource(original);
    const match = source.match(FENCE_RE);
    if (!match) return null;
    const args = parseKeyedBody(match[1], source);
    const preamble = source.slice(0, match.index).trim();
    return { args, preamble, raw: match[0] };
}

export function createAreaMapCommandIsComplete(args) {
    return !!(args?.site && args?.entrance && args?.premise && args?.kind);
}

/**
 * Keep prose before the fence; drop the fence and everything after it.
 * Empty leftovers become a zero-width space so SillyTavern continue still has a stub.
 */
export function stripCreateAreaMapCommand(text) {
    const parsed = parseCreateAreaMapCommand(text);
    if (!parsed) return { text: String(text || ''), command: null };
    const kept = parsed.preamble || '\u200b';
    return { text: kept, command: parsed };
}

/** Compact continue brief: DUNGEON_REALITY already carries the map; a second full dump invites CoT recap. */
export function buildMapArchitectContinueBrief(args) {
    const entrance = String(args?.entrance || '').trim() || 'the entrance';
    return `[MAP_ARCHITECT_RESULT — PRIVATE]
The hidden map is attached as DUNGEON_REALITY. Do not recap, inventory, or plan from it.
Write only in-world narration from ${entrance}. Reveal only what the player can perceive from there.
Do not write chain-of-thought, hidden rooms, or another [CREATE_AREA_MAP] block.
[/MAP_ARCHITECT_RESULT]`;
}

/**
 * Visible stub for generate('continue'). Empty/ZWSP + leftover extra.reasoning makes ST
 * continue the previous thinking block into the chat.
 */
export function seedMapArchitectContinueText(strippedText, entrance) {
    const preamble = String(strippedText || '')
        .replace(/\u200b/g, '')
        .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
        .replace(/<thought\b[^>]*>[\s\S]*?<\/thought>/gi, '')
        .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
        .trim();
    if (preamble) return preamble;
    const door = String(entrance || '').trim();
    return door ? `The way through ${door} is open.` : 'The way in is open.';
}

/** Drop model thinking so continue cannot keep generating the prior CoT. */
export function clearAssistantReasoning(message) {
    if (!message) return;
    message.extra = message.extra || {};
    message.extra.reasoning = '';
    delete message.extra.reasoning_duration;
    delete message.extra.reasoning_type;
    delete message.extra.reasoning_signature;
    const swipeInfo = Array.isArray(message.swipe_info) ? message.swipe_info : [];
    const idx = Math.max(0, Math.min(swipeInfo.length - 1, Number(message.swipe_id) || 0));
    if (swipeInfo[idx]?.extra) {
        swipeInfo[idx].extra.reasoning = '';
        delete swipeInfo[idx].extra.reasoning_duration;
        delete swipeInfo[idx].extra.reasoning_type;
        delete swipeInfo[idx].extra.reasoning_signature;
    }
}
