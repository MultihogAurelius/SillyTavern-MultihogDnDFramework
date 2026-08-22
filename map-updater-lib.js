/**
 * Pure Map Updater helpers: strip [PARTY] to names so occupancy never
 * treats companions as map assets.
 */

const PARTY_FIELD_LINE = /^(Combat|Gear|Proficiencies|Attr|Saves|Skills|Traits|Abilities|Spells|HD|Status)\s*:/i;
const PARTY_HP_HEADER = /:\s*[+-]?[\d,]+(?:\/[\d,]+)?\s*HP\b/i;

/** First-entry BUILDING population needs enough story to invent interior contents. */
export const BUILDING_POPULATION_MIN_LOOKBACK_TURNS = 10;

function normalizeAssetRef(value) {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function findNthUserMessageStartIdx(chat, n = 1) {
    if (!chat?.length || n <= 0) return 0;
    let found = 0;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i]?.is_user) {
            found++;
            if (found >= n) return i;
        }
    }
    return 0;
}

function mapUpdaterLookbackTurns(settings, lookback) {
    const requested = Number(lookback);
    if (Number.isFinite(requested) && requested > 0) return Math.max(1, Math.min(100, requested));
    const router = Number(settings?.routerLookback);
    if (Number.isFinite(router) && router > 0) return Math.max(1, Math.min(100, router));
    const architect = Number(settings?.mapArchitectLookback);
    if (Number.isFinite(architect) && architect > 0) return Math.max(1, Math.min(100, architect));
    return 4;
}

/**
 * Auto-runs use the since-last-run watermark. Manual runs always use lookback.
 * First-entry BUILDING population forces at least BUILDING_POPULATION_MIN_LOOKBACK_TURNS
 * of user-turn history (or more when the watermark already covers a wider span).
 */
export function resolveMapUpdaterStoryWindow(chat, settings, {
    isManual = false,
    lookback = null,
    minLookbackTurns = null,
} = {}) {
    const messages = Array.isArray(chat) ? chat : [];
    const minTurns = Number(minLookbackTurns);
    const hasMinLookback = Number.isFinite(minTurns) && minTurns > 0;
    const turns = Math.max(
        mapUpdaterLookbackTurns(settings, lookback),
        hasMinLookback ? Math.max(1, Math.min(100, Math.floor(minTurns))) : 0,
    );
    const lookbackStart = findNthUserMessageStartIdx(messages, turns);

    if (isManual) {
        return { startIdx: lookbackStart, sinceLastRun: false };
    }

    const lastLen = Number(settings?.mapUpdaterLastRunChatLength) || 0;
    let watermarkStart = null;
    if (lastLen > 0 && lastLen < messages.length) {
        watermarkStart = lastLen;
    } else if (lastLen >= messages.length && messages.length > 0) {
        watermarkStart = messages.length;
    }

    if (hasMinLookback) {
        if (watermarkStart == null) {
            return { startIdx: lookbackStart, sinceLastRun: false };
        }
        return {
            startIdx: Math.min(lookbackStart, watermarkStart),
            sinceLastRun: watermarkStart <= lookbackStart,
        };
    }

    if (watermarkStart != null) {
        return { startIdx: watermarkStart, sinceLastRun: true };
    }
    return { startIdx: lookbackStart, sinceLastRun: false };
}

export function validateBuildingPopulationTransaction(transaction, target) {
    if (!target) return [];
    const operations = Array.isArray(transaction?.operations) ? transaction.operations : [];
    const expected = target.building?.id || target.untrackedName;
    const issues = [];
    const clear = operations.find(operation =>
        String(operation?.op || '').toUpperCase() === 'SET_ASSET'
        && operation?.notEntered === false
        && normalizeAssetRef(operation.asset_id) === normalizeAssetRef(expected));
    if (!clear) {
        issues.push({
            code: 'BUILDING_POPULATION_NOT_RESOLVED',
            path: 'operations',
            hint: `This is a mandatory population pass for "${expected}". Include SET_ASSET with asset_id "${expected}" and notEntered:false in the same transaction, even when the building is intentionally empty.`,
        });
    }
    if (target.phase === 'intent') {
        if (Array.isArray(transaction?.chronicles) && transaction.chronicles.length) {
            issues.push({
                code: 'PRE_NARRATION_CHRONICLE_NOT_ALLOWED',
                path: 'chronicles',
                hint: 'The player has only declared intent. Do not record an outcome or visited-area chronicle before the narrator adjudicates it.',
            });
        }
        operations.forEach((operation, index) => {
            const op = String(operation?.op || '').toUpperCase();
            if (op === 'ADD_ASSET'
                && normalizeAssetRef(operation.location) === normalizeAssetRef(expected)
                && String(operation.knowledge || '').toUpperCase() !== 'UNREVEALED') {
                issues.push({
                    code: 'PRE_NARRATION_ASSET_REVEALED',
                    path: `operations[${index}].knowledge`,
                    hint: 'New contents generated from player intent are objective hidden reality. Use knowledge UNREVEALED; the subsequent narration and Map Updater pass reveal anything actually perceived.',
                });
            }
        });
    }
    return issues;
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
