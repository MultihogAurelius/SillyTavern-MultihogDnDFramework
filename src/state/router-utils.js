/**
 * Router state sanitization and timestamp template adjusters.
 */

export function sanitizeRouterState(s) {
    if (!s) return;
    const isGoodId = (id) => typeof id === 'string' && id.includes('::');

    if (Array.isArray(s.activeRouterKeys)) {
        s.activeRouterKeys = s.activeRouterKeys.filter(isGoodId);
    } else {
        s.activeRouterKeys = [];
    }

    if (Array.isArray(s.activeWorldKeys)) {
        s.activeWorldKeys = s.activeWorldKeys.filter(isGoodId);
    } else {
        s.activeWorldKeys = [];
    }

    if (Array.isArray(s.pinnedRouterKeys)) {
        s.pinnedRouterKeys = s.pinnedRouterKeys.filter(isGoodId);
    } else {
        s.pinnedRouterKeys = [];
    }

    if (Array.isArray(s.keywordActivatedKeys)) {
        s.keywordActivatedKeys = s.keywordActivatedKeys.filter(isGoodId);
    } else {
        s.keywordActivatedKeys = [];
    }

    if (Array.isArray(s.routerLog)) {
        s.routerLog = s.routerLog.filter(log => {
            if (!log || typeof log !== 'object') return false;

            if (Array.isArray(log.record)) {
                log.record = log.record.filter(isGoodId);
            } else {
                log.record = [];
            }

            if (Array.isArray(log.activate)) {
                log.activate = log.activate.filter(isGoodId);
            } else {
                log.activate = [];
            }

            if (Array.isArray(log.deactivate)) {
                log.deactivate = log.deactivate.filter(isGoodId);
            } else {
                log.deactivate = [];
            }

            return true;
        });
    } else {
        s.routerLog = [];
    }
}

/**
 * Count of active router keys that are not user-pinned.
 * Pinned entries are excluded from the Lorebook Agent budget so they never
 * trigger BUDGET VIOLATION or eat into the agent's activation slots.
 * @param {string[]} [activeKeys]
 * @param {string[]} [pinnedKeys]
 * @returns {number}
 */
export function computeUnpinnedActiveCount(activeKeys, pinnedKeys) {
    const pinnedSet = new Set(Array.isArray(pinnedKeys) ? pinnedKeys : []);
    return (Array.isArray(activeKeys) ? activeKeys : []).filter(k => !pinnedSet.has(k)).length;
}

/** Structured NPC [CORE] field headers used to infer category when the model omits it. */
const NPC_CORE_FIELD_HINT = /\b(Species|Personality|Brief Background|Habits\s*\/\s*Behaviors|Habits & Behaviors|Strengths|Flaws|Worn Equipment|Combat Profile)\s*:/i;

/** Canonical lorebook suffixes for the stock Lorebook Agent categories. */
const STOCK_ROUTER_CATEGORY_BOOKS = Object.freeze({
    NPC: 'NPCs',
    LOC: 'Locations',
    QUEST: 'Quests',
    FAC: 'Factions',
    EVENT: 'Events',
    WORLD: 'World',
});

/** @param {unknown} value */
function normalizeRouterCategoryTag(value) {
    return String(value || '').trim().toUpperCase();
}

/**
 * Return the lorebook suffix used when routing a category tag.
 * Custom tags intentionally retain the router's legacy naming rule.
 * @param {string} tag
 * @returns {string}
 */
export function getRouterCategoryBookSuffix(tag) {
    const normalized = normalizeRouterCategoryTag(tag);
    if (!normalized) return '';
    return STOCK_ROUTER_CATEGORY_BOOKS[normalized]
        || (normalized.charAt(0) + normalized.slice(1).toLowerCase());
}

/**
 * Categories the Lorebook Agent may use for new records this pass.
 * Disabled stock modules are deliberately excluded; custom tags are always enabled.
 * @param {{routerModules?: Record<string, {enabled?: boolean, tag?: string}>, routerCustomTags?: Array<{tag?: string}>}} settings
 * @returns {string[]}
 */
export function getEnabledRouterCategoryTags(settings = {}) {
    const tags = [];
    const add = (raw) => {
        const tag = normalizeRouterCategoryTag(raw);
        if (tag && !tags.includes(tag)) tags.push(tag);
    };

    for (const module of Object.values(settings.routerModules || {})) {
        if (module?.enabled) add(module.tag);
    }
    for (const custom of (settings.routerCustomTags || [])) {
        add(custom?.tag);
    }
    return tags;
}

/**
 * Build the writable category-to-lorebook map from the current configuration.
 * @param {{routerModules?: Record<string, {enabled?: boolean, tag?: string}>, routerCustomTags?: Array<{tag?: string}>}} settings
 * @returns {Record<string, string>}
 */
export function buildRouterCategoryMap(settings = {}) {
    const map = {};
    for (const tag of getEnabledRouterCategoryTags(settings)) {
        map[tag] = getRouterCategoryBookSuffix(tag);
    }
    return map;
}

/**
 * Infer lorebook category for a commit.record item when the model omitted/misspelled `category`.
 * Conservative: only returns a tag when the signal is strong.
 * @param {{label?: string, content?: string, category?: string, comment?: string}} rec
 * @returns {'NPC'|'LOC'|'EVENT'|null}
 */
export function inferRecordCategory(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const label = String(rec.label || '').trim();
    const content = String(rec.content || '');

    // Hierarchical location paths always route to Locations.
    if (label.includes(' :: ')) return 'LOC';

    // Structured NPC character sheets (Species/Personality/… field headers).
    if (/\[CORE\]/i.test(content) && NPC_CORE_FIELD_HINT.test(content)) return 'NPC';

    // Timestamped event-style labels (without ::, which already returned LOC).
    if (/(?:\[Day\s+\d+|\[\d{1,2}\/\d{1,2}\/\d+)/i.test(label)) return 'EVENT';

    return null;
}

/**
 * Resolve the category tag used for book routing.
 * Prefers an explicit/recognized category, then comment if it matches a known tag, then inference.
 * @param {{label?: string, content?: string, category?: string, comment?: string}} rec
 * @param {string[]} knownTags Uppercase category tags (NPC, LOC, … plus custom)
 * @param {string|null} fallbackTag Unambiguous category to use when the model omitted it
 * @returns {{tag: string|null, inferred: boolean}}
 */
export function resolveRecordCategoryTag(rec, knownTags = [], fallbackTag = null) {
    const tags = (Array.isArray(knownTags) ? knownTags : [])
        .map(t => String(t || '').toUpperCase())
        .filter(Boolean);
    const matchKnown = (raw) => {
        const cat = String(raw || '').toUpperCase().trim();
        if (!cat) return null;
        // Exact match first. Fuzzy "cat includes tag" must never let a shorter
        // custom tag (OR, ME, WO, …) steal an exact later tag such as WORLD or
        // HOMEBREW — Object.keys order puts customs before the WORLD override.
        const exact = tags.find(k => cat === k);
        if (exact) return exact;
        let best = null;
        for (const k of tags) {
            if (cat.includes(k) && (!best || k.length > best.length)) best = k;
        }
        return best;
    };

    const explicit = matchKnown(rec?.category);
    if (explicit) return { tag: explicit, inferred: false };

    const fromComment = matchKnown(rec?.comment);
    if (fromComment) return { tag: fromComment, inferred: false };

    const inferred = inferRecordCategory(rec);
    if (inferred && (!tags.length || tags.includes(inferred))) {
        return { tag: inferred, inferred: true };
    }

    // A custom-only setup commonly has exactly one writable category. If an older
    // customized prompt makes the model omit the field or echo a disabled stock
    // category, routing is still unambiguous and should not produce a warning.
    const fallback = matchKnown(fallbackTag);
    if (fallback) {
        return { tag: fallback, inferred: true };
    }
    return { tag: null, inferred: false };
}

/** Extract canonical [CHARACTER] block from the current memo, if present. */
export function extractCharacterBlock(memo) {
    const match = memo?.match(/\[CHARACTER\]([\s\S]*?)\[\/CHARACTER\]/i);
    return match ? `[CHARACTER]${match[1].trim()}[/CHARACTER]` : null;
}

/** Extract canonical [PARTY] block from the current memo, if present. */
export function extractPartyBlock(memo) {
    const match = memo?.match(/\[PARTY\]([\s\S]*?)\[\/PARTY\]/i);
    return match ? `[PARTY]${match[1].trim()}[/PARTY]` : null;
}

/**
 * True when a core/appearance update target refers to the linked Player Character
 * rather than a lorebook NPC entry.
 * @param {string} id
 * @param {string} [pcName]
 * @returns {boolean}
 */
export function isPcCoreTarget(id, pcName = '') {
    if (!id || typeof id !== 'string') return false;
    const norm = id.trim().toLowerCase();
    if (!norm) return false;
    if (norm === '{{user}}' || norm === 'player' || norm === 'pc' || norm === 'user') return true;
    if (pcName && norm === String(pcName).trim().toLowerCase()) return true;
    return false;
}

/**
 * True for the always-on "Body" visual field (signature/default look, no gear).
 * Also matches the legacy combined "Appearance/Species" header from entries
 * written before the Species/Body/Equipment split, so old data keeps working.
 * Deliberately does NOT match a bare "Species" field — that moved to the
 * manual-only identity bucket alongside Personality/Background/etc.
 * @param {string} field
 */
export function isAppearanceField(field) {
    const n = (field || '').trim().toLowerCase();
    return n.includes('body') || n.includes('appearance');
}

/** True for the always-on "Worn Equipment" (visibly worn/carried gear) field. @param {string} field */
export function isEquipmentField(field) {
    const n = (field || '').trim().toLowerCase();
    return n.includes('equipment') || n.includes('gear') || n.includes('worn');
}

/** True for the static "Species" identity field (manual-only, like Personality). @param {string} field */
export function isSpeciesField(field) {
    const n = (field || '').trim().toLowerCase();
    return n === 'species' || n.startsWith('species ') || n.startsWith('species/') || n.startsWith('species:');
}

/** @param {string} field */
export function isCombatProfileField(field) {
    const n = (field || '').trim().toLowerCase();
    return n.includes('combat');
}

/**
 * Fields eligible for commit.core / [[UPDATE_CORE:...]] this pass.
 * Body and Worn Equipment are never in this list — they belong exclusively to the
 * dedicated appearance/equipment tools. Automatic passes are limited to Combat
 * Profile; Direct Prompt / manual passes unlock the remaining identity fields
 * (including Species, which — unlike Body/Worn Equipment — is never auto-updated).
 * @param {Array<{name?: string}>} coreSections
 * @param {boolean} isManual
 * @returns {string[]}
 */
export function getEligibleCoreFieldNames(coreSections, isManual) {
    const names = (Array.isArray(coreSections) ? coreSections : [])
        .map(s => (s && typeof s.name === 'string' ? s.name : ''))
        .filter(Boolean);
    const withoutVisualFields = names.filter(n => !isAppearanceField(n) && !isEquipmentField(n));
    if (!isManual) {
        const combat = withoutVisualFields.filter(n => isCombatProfileField(n));
        return combat.length ? combat : ['Combat Profile'];
    }
    return withoutVisualFields.length ? withoutVisualFields : names.filter(n => !isAppearanceField(n) && !isEquipmentField(n));
}

/**
 * Resolve field-name aliases used when surgically patching a labeled section.
 * "Body" additionally falls back to the legacy combined "Appearance/Species"
 * header so a Body/appearance update on a pre-split entry patches that header
 * in place instead of creating a duplicate "Body:" line.
 * @param {string} field
 * @param {{ isPc?: boolean }} [opts]
 * @returns {string[]}
 */
export function resolveCoreFieldPatterns(field, opts = {}) {
    const normField = (field || '').trim().toLowerCase();
    if (normField.includes('species')) return ['Species'];
    if (normField.includes('equipment') || normField.includes('gear') || normField.includes('worn')) {
        return ['Worn Equipment', 'Equipment'];
    }
    if (normField.includes('body') || normField.includes('appearance')) {
        return ['Body', 'Appearance/Species', 'Appearance'];
    }
    if (normField.includes('personality')) return ['Personality'];
    if (normField.includes('background')) {
        return opts.isPc ? ['Background', 'Brief Background'] : ['Brief Background', 'Background'];
    }
    if (normField.includes('habit') || normField.includes('behavior')) {
        return opts.isPc
            ? ['Habits & Behaviors', 'Habits/Behaviors', 'Habits', 'Behaviors']
            : ['Habits/Behaviors', 'Habits & Behaviors', 'Habits', 'Behaviors'];
    }
    if (normField.includes('combat')) return ['Combat Profile'];
    if (normField.includes('strength')) return ['Strengths'];
    if (normField.includes('flaw')) return ['Flaws'];
    return [field.trim()];
}

/**
 * Patch (or lazily append) a labeled section inside a flat bio / [CORE] body.
 * @param {string} text
 * @param {string} field
 * @param {string} newContent
 * @param {{ isPc?: boolean, extraHeaders?: string[] }} [opts]
 * @returns {{ ok: boolean, text?: string, error?: string }}
 */
export function patchLabeledSection(text, field, newContent, opts = {}) {
    if (!field || newContent == null || String(newContent).trim() === '') {
        return { ok: false, error: 'Missing field or content' };
    }
    const body = typeof text === 'string' ? text : '';
    const fieldPatterns = resolveCoreFieldPatterns(field, opts);
    const escapedPatterns = fieldPatterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const otherHeaders = [
        'Species',
        'Body', 'Appearance/Species', 'Appearance',
        'Worn Equipment', 'Equipment',
        'Personality',
        'Brief Background', 'Background',
        'Habits/Behaviors', 'Habits & Behaviors', 'Habits', 'Behaviors',
        'Strengths', 'Flaws',
        'Combat Profile',
        'Relationship',
    ];
    for (const h of (opts.extraHeaders || [])) {
        if (h && !otherHeaders.includes(h)) otherHeaders.push(h);
    }
    for (const rawLine of body.split('\n')) {
        const hm = rawLine.trim().match(/^([A-Z][A-Za-z0-9 \/&]+?)\s*:/);
        if (hm) {
            const nm = hm[1].trim();
            if (!otherHeaders.includes(nm)) otherHeaders.push(nm);
        }
    }

    const otherHeadersRegexStr = otherHeaders.map(h => {
        const esc = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (h === 'Background') return '(?<!Brief\\s)Background';
        if (h === 'Behaviors') return '(?<!Habits\\/)(?<!Habits & )(?<!Habits and )Behaviors';
        if (h === 'Appearance') return '(?<!/)Appearance(?!\\/Species)';
        if (h === 'Equipment') return '(?<!Worn\\s)Equipment';
        return esc;
    }).join('|');

    const targetFieldRegex = new RegExp(
        `(?:(${escapedPatterns.join('|')})\\s*:)([\\s\\S]*?)(?=(?:${otherHeadersRegexStr})\\s*:|$)`,
        'i'
    );
    const fieldMatch = body.match(targetFieldRegex);
    const replacementValue = String(newContent).trim();

    if (!fieldMatch) {
        const fieldName = fieldPatterns[0] || field.trim();
        const replacement = `${fieldName}: ${replacementValue}\n`;
        let newBody = body.trimEnd();
        newBody = newBody ? `${newBody}\n${replacement}` : replacement;
        return { ok: true, text: newBody };
    }

    const matchedFieldName = fieldMatch[1];
    const targetSubstring = `${matchedFieldName}:${fieldMatch[2]}`;
    const replacement = `${matchedFieldName}: ${replacementValue}\n`;
    return { ok: true, text: body.replace(targetSubstring, replacement) };
}

function fieldHasColorMarkup(value) {
    const v = String(value || '');
    return /<font\s+color/i.test(v) || /#[0-9a-fA-F]{3,8}\b/.test(v);
}

function stripMarkupToText(value) {
    return String(value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function extractLabeledFieldMap(text) {
    const map = new Map();
    let current = null;
    let buf = [];
    const flush = () => {
        if (current) map.set(current, buf.join('\n').trim());
        buf = [];
    };
    for (const raw of String(text || '').split('\n')) {
        const hm = raw.trim().match(/^([A-Z][A-Za-z0-9 \/&]+?)\s*:(.*)$/);
        if (hm) {
            flush();
            current = hm[1].trim();
            buf = [String(hm[2] || '').trim()];
        } else if (current) {
            buf.push(raw);
        }
    }
    flush();
    return map;
}

function findLabeledFieldValue(map, name) {
    const target = String(name || '').trim().toLowerCase();
    for (const [key, value] of map) {
        if (String(key).trim().toLowerCase() === target) return value;
    }
    return undefined;
}

/**
 * Escape a literal for safe use inside a RegExp.
 * @param {string} value
 */
function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `index` starts a whole-token match of `needle` inside `haystack`.
 * Letter/digit/_ on either side means the match is buried in a longer word
 * (e.g. "red" inside "Fred" / "coloured") and must not be re-wrapped.
 * @param {string} haystack
 * @param {string} needle
 * @param {number} index
 */
function isWholeTokenMatch(haystack, needle, index) {
    if (index < 0 || !needle) return false;
    const before = index > 0 ? haystack[index - 1] : '';
    const after = index + needle.length < haystack.length
        ? haystack[index + needle.length]
        : '';
    const wordish = /[0-9A-Za-z_]/;
    if (before && wordish.test(before)) return false;
    if (after && wordish.test(after)) return false;
    return true;
}

/**
 * Re-wrap plain inner text with `<font color=...>` tags copied from older CORE markup.
 * First whole-token occurrence only, and only when the inner phrase is at least 2 characters.
 * Substring hits inside longer words are skipped so Full Audit cannot corrupt fields
 * (e.g. colored "red" must not rewrite "Fred" or "coloured").
 * @param {string} oldText
 * @param {string} newText
 */
export function restoreFontColorWraps(oldText, newText) {
    let result = String(newText || '');
    const source = String(oldText || '');
    if (!source || !result) return result;
    const re = /<font\s+color\s*=\s*["']?(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)["']?>([\s\S]*?)<\/font>/gi;
    let match;
    while ((match = re.exec(source)) !== null) {
        const full = match[0];
        const inner = stripMarkupToText(match[2]);
        if (inner.length < 2 || result.includes(full)) continue;
        const finder = new RegExp(escapeRegExp(inner), 'g');
        let found = finder.exec(result);
        while (found) {
            if (isWholeTokenMatch(result, inner, found.index)) {
                result = `${result.slice(0, found.index)}${full}${result.slice(found.index + inner.length)}`;
                break;
            }
            found = finder.exec(result);
        }
    }
    return result;
}

/**
 * When the Lorebook Agent re-records an existing NPC and replaces [CORE], Full Audit
 * often copies identity from HTML-stripped chat and drops `<font color>` / hex codes.
 * Restore color-bearing fields (and matching font wraps) from the previous CORE.
 * @param {string} oldCore
 * @param {string} newCore
 * @param {{ extraHeaders?: string[] }} [opts]
 */
export function mergePreservedColorMarkup(oldCore, newCore, opts = {}) {
    const oldText = String(oldCore || '');
    const newText = String(newCore || '');
    if (!oldText || !newText || oldText === newText) return newText;

    const extraHeaders = opts.extraHeaders || [];
    const oldFields = extractLabeledFieldMap(oldText);
    if (oldFields.size === 0) return restoreFontColorWraps(oldText, newText);

    let merged = newText;
    for (const [name, oldVal] of oldFields) {
        if (!fieldHasColorMarkup(oldVal)) continue;
        const newVal = findLabeledFieldValue(extractLabeledFieldMap(merged), name);
        if (!newVal) {
            const patched = patchLabeledSection(merged, name, oldVal, { extraHeaders });
            if (patched.ok) merged = patched.text;
            continue;
        }
        if (fieldHasColorMarkup(newVal)) continue;
        const nextVal = stripMarkupToText(oldVal) === stripMarkupToText(newVal)
            ? oldVal
            : restoreFontColorWraps(oldVal, newVal);
        if (nextVal !== newVal) {
            const patched = patchLabeledSection(merged, name, nextVal, { extraHeaders });
            if (patched.ok) merged = patched.text;
        }
    }
    return merged;
}

/**
 * Strips the [CORE]/[/CORE] bookkeeping markers from a lorebook entry before it
 * reaches the GM/narrator. These tags exist purely so the Lorebook Agent knows
 * which text is protected permanent identity/description vs. append-only
 * chronicle — the narrator has no use for the literal markup and it wastes
 * tokens. The blank line left behind where [/CORE] used to be preserves the
 * visual break between the permanent description and the timestamped history,
 * so the demarcation survives even though the tags themselves are gone.
 * Only ever applied to a display copy — the stored entry.content is untouched,
 * so the agent's own protected-block parsing/enforcement is unaffected.
 * @param {string} content
 * @returns {string}
 */
export function stripCoreMarkersForNarrator(content) {
    if (!content) return content;
    return content
        // [MAP] is routed through Dungeon Reality's location/exact-name injection.
        // Ordinary lore activation must never reveal it out of location.
        .replace(/\[MAP\][\s\S]*?\[\/MAP\]/gi, '')
        .replace(/\[CORE\]\n?/g, '')
        .replace(/\n?\[\/CORE\]\n?/g, '\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Dynamically adjusts timestamp formats (Day X/N vs DD/MM/YYYY and 12h vs 24h) inside prompt instructions.
 * @param {string} prompt
 * @param {object} settings
 * @returns {string}
 */
export function adjustPromptTimestamps(prompt, settings) {
    if (!prompt) return prompt;
    const isCalendar = !!settings.useDdMmYyFormat;
    const is24h = !!settings.use24hTime;

    let result = prompt;

    if (isCalendar) {
        if (is24h) {
            // Target: DD/MM/YYYY, HH:MM (24h)
            result = result
                .replace(/Day ([1-9])/g, '0$1/01/2026')
                .replace(/Day N/g, 'DD/MM/YYYY')
                .replace(/Day X/g, 'DD/MM/YYYY')
                .replace(/Day 0/g, '31/12/2025')
                .replace(/12:15 AM/g, '00:15')
                .replace(/11:52 AM/g, '11:52')
                .replace(/10:00 PM/g, '22:00')
                .replace(/08:00 AM/g, '08:00')
                .replace(/06:00 PM/g, '18:00')
                .replace(/14:00/g, '14:00')
                .replace(/10:42/g, '10:42')
                .replace(/10:44/g, '10:44')
                .replace(/HH:MM AM\/PM/g, 'HH:MM')
                .replace(/HH:MM/g, 'HH:MM');
        } else {
            // Target: DD/MM/YYYY, HH:MM AM/PM (12h)
            result = result
                .replace(/Day ([1-9])/g, '0$1/01/2026')
                .replace(/Day N/g, 'DD/MM/YYYY')
                .replace(/Day X/g, 'DD/MM/YYYY')
                .replace(/Day 0/g, '31/12/2025')
                .replace(/14:00(?!\s*(?:AM|PM)\b)/g, '02:00 PM')
                .replace(/22:00(?!\s*(?:AM|PM)\b)/g, '10:00 PM')
                .replace(/10:42(?!\s*(?:AM|PM)\b)/g, '10:42 AM')
                .replace(/10:44(?!\s*(?:AM|PM)\b)/g, '10:44 AM')
                .replace(/HH:MM/g, 'HH:MM AM/PM')
                .replace(/HH:MM AM\/PM/g, 'HH:MM AM/PM');
        }
    } else {
        if (is24h) {
            // Target: Day N, HH:MM (24h)
            result = result
                .replace(/0([1-9])\/01\/2026/g, 'Day $1')
                .replace(/DD\/MM\/YYYY/g, 'Day N')
                .replace(/31\/12\/2025/g, 'Day 0')
                .replace(/12:15 AM/g, '00:15')
                .replace(/11:52 AM/g, '11:52')
                .replace(/10:00 PM/g, '22:00')
                .replace(/08:00 AM/g, '08:00')
                .replace(/06:00 PM/g, '18:00')
                .replace(/14:00/g, '14:00')
                .replace(/10:42/g, '10:42')
                .replace(/10:44/g, '10:44')
                .replace(/HH:MM AM\/PM/g, 'HH:MM')
                .replace(/HH:MM/g, 'HH:MM');
        } else {
            // Target: Day N, HH:MM AM/PM (12h)
            result = result
                .replace(/0([1-9])\/01\/2026/g, 'Day $1')
                .replace(/DD\/MM\/YYYY/g, 'Day N')
                .replace(/31\/12\/2025/g, 'Day 0')
                .replace(/14:00(?!\s*(?:AM|PM)\b)/g, '02:00 PM')
                .replace(/22:00(?!\s*(?:AM|PM)\b)/g, '10:00 PM')
                .replace(/10:42(?!\s*(?:AM|PM)\b)/g, '10:42 AM')
                .replace(/10:44(?!\s*(?:AM|PM)\b)/g, '10:44 AM')
                .replace(/HH:MM/g, 'HH:MM AM/PM')
                .replace(/HH:MM AM\/PM/g, 'HH:MM AM/PM');
        }
    }

    // Make repeated format toggles idempotent. Older templates can contain
    // "HH:MM AM/PM AM/PM" (or more repetitions) because a broad HH:MM
    // replacement also matched the start of an already-suffixed placeholder.
    // Collapse those legacy forms while producing the requested clock format.
    return is24h
        ? result.replace(/HH:MM(?:\s+AM\/PM)+/g, 'HH:MM')
        : result.replace(/HH:MM(?:\s+AM\/PM)*/g, 'HH:MM AM/PM');
}

/**
 * Iterates through all stored system prompt, modular agent prompt, and stock prompt templates,
 * rewriting their embedded date/time examples to match the newly selected format.
 * @param {object} settings
 */
export function adjustAllStoredTemplatesForTimeFormat(settings) {
    if (settings.routerSystemPromptTemplate) {
        settings.routerSystemPromptTemplate = adjustPromptTimestamps(settings.routerSystemPromptTemplate, settings);
    }
    if (settings.routerModularPromptTemplate) {
        settings.routerModularPromptTemplate = adjustPromptTimestamps(settings.routerModularPromptTemplate, settings);
    }
    if (settings.stockPrompts) {
        for (const [key, val] of Object.entries(settings.stockPrompts)) {
            settings.stockPrompts[key] = adjustPromptTimestamps(val, settings);
        }
    }
}
