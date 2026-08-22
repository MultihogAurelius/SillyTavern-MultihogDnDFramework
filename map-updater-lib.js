/**
 * Pure Map Updater helpers: strip [PARTY] to names so occupancy never
 * treats companions as map assets.
 */

const PARTY_FIELD_LINE = /^(Combat|Gear|Proficiencies|Attr|Saves|Skills|Traits|Abilities|Spells|HD|Status)\s*:/i;
const PARTY_HP_HEADER = /:\s*[+-]?[\d,]+(?:\/[\d,]+)?\s*HP\b/i;

function normalizeAssetRef(value) {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function validateBuildingPopulationTransaction(transaction, target) {
    if (!target) return [];
    const operations = Array.isArray(transaction?.operations) ? transaction.operations : [];
    const expected = target.building?.id || target.untrackedName;
    const clear = operations.find(operation =>
        String(operation?.op || '').toUpperCase() === 'SET_ASSET'
        && operation?.notEntered === false
        && normalizeAssetRef(operation.asset_id) === normalizeAssetRef(expected));
    if (clear) return [];
    return [{
        code: 'BUILDING_POPULATION_NOT_RESOLVED',
        path: 'operations',
        hint: `This is the first-entry population pass for "${expected}". Include SET_ASSET with asset_id "${expected}" and notEntered:false in the same transaction, even when the building is intentionally empty.`,
    }];
}

export function extractMemoSection(memo, tag) {
    const source = String(memo || '');
    const open = `[${tag}]`;
    const close = `[/${tag}]`;
    const start = source.toUpperCase().indexOf(open.toUpperCase());
    if (start < 0) return '';
    const innerStart = start + open.length;
    const end = source.toUpperCase().indexOf(close.toUpperCase(), innerStart);
    return (end < 0 ? source.slice(innerStart) : source.slice(innerStart, end)).trim();
}

function stripPartyBullet(line) {
    return String(line || '').replace(/^\s*[-*+•–—]\s*/, '').trim();
}

export function partyNameFromHeader(line) {
    let name = stripPartyBullet(line);
    if (!name) return '';
    const hpCut = name.search(PARTY_HP_HEADER);
    if (hpCut >= 0) name = name.slice(0, hpCut);
    const classCut = name.search(/\s+\([^)]*\)\s*$/);
    if (classCut >= 0) name = name.slice(0, classCut);
    name = name.replace(/:\s*\(\([^)]*\)\)\s*$/g, '');
    name = name.replace(/:+\s*$/, '').trim();
    return name;
}

function isPartyFieldLine(line) {
    return PARTY_FIELD_LINE.test(stripPartyBullet(line));
}

function isPartyMemberHeader(line, expectingHeader) {
    const stripped = stripPartyBullet(line);
    if (!stripped || isPartyFieldLine(stripped)) return false;
    if (PARTY_HP_HEADER.test(stripped)) return true;
    return !!expectingHeader && /^[\p{L}'’.-]/u.test(stripped);
}

/** Split a [PARTY] body on Status: (or the next HP header) and return member names. */
export function extractPartyMemberNames(partyContent) {
    const raw = String(partyContent || '');
    const inner = extractMemoSection(raw, 'PARTY')
        || raw.replace(/^\s*\[PARTY\]/i, '').replace(/\[\/PARTY\]\s*$/i, '').trim();
    if (!inner) return [];

    const names = [];
    const seen = new Set();
    let expectingHeader = true;
    for (const raw of inner.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (/^Status\s*:/i.test(stripPartyBullet(line))) {
            expectingHeader = true;
            continue;
        }
        if (!isPartyMemberHeader(line, expectingHeader)) continue;
        const name = partyNameFromHeader(line);
        const key = name.toLowerCase();
        if (name && !seen.has(key)) {
            seen.add(key);
            names.push(name);
        }
        expectingHeader = false;
    }
    return names;
}

export function formatPartyNamesBlock(names) {
    const rows = (Array.isArray(names) ? names : []).map(name => String(name || '').trim()).filter(Boolean);
    if (!rows.length) return '';
    return `[PARTY]\n${rows.map(name => `- ${name}`).join('\n')}\n[/PARTY]`;
}

export function formatPartyRosterForMapUpdater(memo) {
    return formatPartyNamesBlock(extractPartyMemberNames(extractMemoSection(memo, 'PARTY')));
}

export function isPartyMemberAssetName(assetName, partyNames) {
    const asset = String(assetName || '').trim().toLowerCase();
    if (!asset) return false;
    return (Array.isArray(partyNames) ? partyNames : []).some((raw) => {
        const name = String(raw || '').trim().toLowerCase();
        if (!name) return false;
        return asset === name
            || asset.startsWith(`${name} `)
            || name.startsWith(`${asset} `);
    });
}
