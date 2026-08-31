/** Dedicated one-shot dungeon/settlement/interior map generation agent. */
import { getSettings } from './state-manager.js';
import { sendStateRequest } from './llm-client.js';
import {
    dungeonSiteRootsMatch,
    findLatestDungeonLocation,
    formatDungeonMapForNarrator,
    getDungeonMessageText,
    normalizeMapSiteKind,
    normalizeMapSiteThreat,
    defaultMapSiteThreat,
    parseDungeonMapDocument,
    stripCapturedDungeonMapsFromPrompt,
    canonicalizeReciprocalConnectionDetails,
    validateDungeonMapArchitecture,
} from './dungeon-reality.js';
import { locationRootExists, persistArchitectDungeonMap, syncDungeonMapsToLocationLorebook } from './router.js';
import {
    DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT,
    DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT,
    DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT,
} from './map-architect-prompt.js';
import { normalizeMapAttachment, resolveHostedCreationContext } from './map-hosting-context.js';
import { parseMapArchitectResponse } from './map-architect-parser.js';
import {
    MAP_ARCHITECT_ASSETS_JSON_SCHEMA,
    MAP_ARCHITECT_BRIEF_JSON_SCHEMA,
    MAP_ARCHITECT_TOPOLOGY_JSON_SCHEMA,
} from './map-architect-schema.js';
import { extractCurrentTimeStr } from './memo-processor.js';
import { isLocationMappingEnabled } from './src/state/section-enabled.js';
import { buildMapArchitectReferenceContext } from './map-architect-context.js';
export { parseMapArchitectResponse } from './map-architect-parser.js';
export { buildMapArchitectReferenceContext } from './map-architect-context.js';

const architectRuns = new Map();
const MAX_CORRECTION_ATTEMPTS = 2;

const architectToasts = new Map();

function broadcastStep(type, content, metadata = {}) {
    document.dispatchEvent(new CustomEvent('rt_lore_agent_step', {
        detail: { type, content, metadata: { source: 'map_architect', ...metadata }, timestamp: Date.now() },
    }));
}

function siteToastLabel(site) {
    return String(site || 'location').trim() || 'location';
}

function startMapArchitectToast(site) {
    const toastrApi = globalThis.toastr;
    if (typeof toastrApi?.info !== 'function') return;
    const key = normalizeKey(site);
    const prior = architectToasts.get(key);
    if (prior && typeof toastrApi.clear === 'function') {
        try { toastrApi.clear(prior); } catch (_) { /* best effort */ }
    }
    try {
        const toast = toastrApi.info(
            `Generating a location map for ${siteToastLabel(site)}...`,
            'Map Architect',
            { timeOut: 0, extendedTimeOut: 0, closeButton: true },
        );
        if (toast) architectToasts.set(key, toast);
        else architectToasts.delete(key);
    } catch (_) { /* notification display is best effort */ }
}

function finishMapArchitectToast(site, succeeded) {
    const toastrApi = globalThis.toastr;
    const key = normalizeKey(site);
    const prior = architectToasts.get(key);
    architectToasts.delete(key);
    if (prior && typeof toastrApi?.clear === 'function') {
        try { toastrApi.clear(prior); } catch (_) { /* best effort */ }
    }
    const method = succeeded ? toastrApi?.success : toastrApi?.error;
    if (typeof method !== 'function') return;
    try {
        method(
            succeeded
                ? `Location map ready for ${siteToastLabel(site)}.`
                : `Location map generation failed for ${siteToastLabel(site)}. See the tool result for details.`,
            'Map Architect',
            { timeOut: succeeded ? 5000 : 10000, extendedTimeOut: succeeded ? 10000 : 20000 },
        );
    } catch (_) { /* notification display is best effort */ }
}

function normalizeKey(value) {
    return String(value || '').trim().toLocaleLowerCase();
}

function roleForMessage(message) {
    if (message?.is_user || String(message?.role || '').toLowerCase() === 'user') return 'PLAYER';
    return 'NARRATOR';
}

function recentStoryContext(ctx, lookback, dungeonState) {
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    if (lookback <= 0) return '';
    const recent = chat.slice(-Math.max(0, lookback)).map(message => ({
        ...message,
        content: Array.isArray(message?.content)
            ? message.content.map(part => (part && typeof part === 'object' ? { ...part } : part))
            : message?.content,
    }));
    stripCapturedDungeonMapsFromPrompt(recent, dungeonState);
    return recent.map(message => {
        const text = getDungeonMessageText(message).trim();
        return text ? `${roleForMessage(message)}: ${text}` : '';
    }).filter(Boolean).join('\n\n');
}

function requestSettings(settings, extra = {}) {
    return {
        connectionSource: settings.mapArchitectConnectionSource || 'default',
        connectionProfileId: settings.mapArchitectConnectionProfileId || '',
        completionPresetId: settings.mapArchitectCompletionPresetId || '',
        ollamaUrl: settings.mapArchitectOllamaUrl || 'http://localhost:11434',
        ollamaModel: settings.mapArchitectOllamaModel || '',
        openaiUrl: settings.mapArchitectOpenaiUrl || '',
        openaiKey: settings.mapArchitectOpenaiKey || '',
        openaiModel: settings.mapArchitectOpenaiModel || '',
        maxTokens: extra.maxTokens ?? Math.max(1000, Number(settings.mapArchitectMaxTokens) || 25000),
        debugMode: !!settings.debugMode,
    };
}

function resolveLookback(settings, override) {
    const fallback = Number(settings?.mapArchitectLookback);
    const configured = override != null && override !== '' ? Number(override) : fallback;
    if (Number.isFinite(configured)) return Math.max(0, Math.min(100, Math.floor(configured)));
    return Number.isFinite(fallback) ? Math.max(0, fallback) : 12;
}

function currentTimeFrom(settings) {
    const memoTimeMatch = settings.currentMemo?.match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    return memoTimeMatch ? extractCurrentTimeStr(memoTimeMatch[1]) : '';
}

function kindBrief(kind) {
    if (kind === 'SETTLEMENT') return 'SETTLEMENT = the city/town/village as a whole, district-scale; ordinary structures are BUILDING assets, while zero to two strongly justified future peer sites may organically be SUBDUNGEON/SUBINTERIOR assets.';
    if (kind === 'INTERIOR') return 'INTERIOR = a significant low-risk multi-room site with a stable room graph.';
    return 'DUNGEON = a high-risk room-scale site; populate rooms fully.';
}

function topologyKindBrief(kind) {
    if (kind === 'SETTLEMENT') return 'SETTLEMENT = the city, town, village, or camp as a district-scale graph.';
    if (kind === 'INTERIOR') return 'INTERIOR = a significant low-risk multi-room site with a stable room graph.';
    return 'DUNGEON = a high-risk room-scale site with a complete hidden interior graph.';
}

function threatBrief(threat, kind) {
    if (normalizeMapSiteKind(kind) === 'SETTLEMENT') {
        return {
            NONE: 'NONE = peaceful civic occupancy with no invented active danger.',
            LOW: 'LOW = sleepy watch and civilian life; not a war zone.',
            MODERATE: 'MODERATE = normal garrison or street crime.',
            HIGH: 'HIGH = occupation, curfews, armed factions in several districts.',
            DEADLY: 'DEADLY = active siege, massacre, or open war in the streets.',
        }[threat] || 'Threat is site danger, not party level.';
    }
    return {
        NONE: 'NONE = no invented active danger.',
        LOW: 'LOW = mostly empty/abandoned; sparse hostiles and traps.',
        MODERATE: 'MODERATE = moderate occupancy; hostiles here and there; some traps and hazards; safe pauses are not too unlikely.',
        HIGH: 'HIGH = frequent hostiles, packs or patrols, traps on multiple routes.',
        DEADLY: 'DEADLY = dense overlapping threats and layered traps; still traversable.',
    }[threat] || 'Threat is site danger, not party level.';
}

function normalizeInclude(value) {
    if (!Array.isArray(value)) return [];
    const names = value.map(item => String(item || '').trim()).filter(Boolean);
    return [...new Set(names)];
}

function legacyBriefDescription(prompt, site) {
    const text = String(prompt || '').replace(/\s+/g, ' ').trim();
    if (!text) return `${site} is a mapped site.`;
    return text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || text;
}

function resolveIncludeManifest(include, sites, hostSite) {
    const manifest = [];
    for (const requested of normalizeInclude(include)) {
        const matches = Object.values(sites || {}).filter(site => String(site?.siteRoot || '').trim() === requested);
        if (matches.length !== 1) {
            throw mapArchitectFailure(`include must name one existing mapped DUNGEON or INTERIOR exactly. Could not resolve "${requested}".`);
        }
        const record = matches[0];
        const document = parseDungeonMapDocument(record.mapChunks?.[0], record.siteRoot).document;
        if (!['DUNGEON', 'INTERIOR'].includes(document.kind)) {
            throw mapArchitectFailure(`Included site "${requested}" is ${document.kind}; only DUNGEON or INTERIOR peers can be absorbed.`);
        }
        if (document.hostSite && document.hostSite !== hostSite) {
            throw mapArchitectFailure(`Included site "${requested}" is already hosted inside "${document.hostSite}" and cannot be re-hosted.`);
        }
        manifest.push({
            site: record.siteRoot,
            kind: document.kind,
            assetKind: document.kind === 'INTERIOR' ? 'SUBINTERIOR' : 'SUBDUNGEON',
            entryId: record.entryId,
        });
    }
    return manifest;
}

function inclusionPrompt(manifest) {
    if (!manifest.length) return '';
    return `\nINCLUDED EXISTING PEERS (LOCKED)\n${manifest.map(item => `- ${item.site}: create exactly one ${item.assetKind} asset with name exactly "${item.site}" and place it in the correct settlement district.`).join('\n')}\nDo not rename, omit, duplicate, or change the kind of an included peer. Runtime will stamp host metadata after validation.\n`;
}

function inclusionValidationErrors(document, manifest) {
    const errors = [];
    for (const item of manifest) {
        const matches = (document.assets || []).filter(asset => asset.name === item.site);
        if (matches.length !== 1) {
            errors.push({ code: 'INCLUDED_PEER_COUNT', path: '$.assets', hint: `Create exactly one asset named "${item.site}" for the included peer.` });
            continue;
        }
        if (matches[0].kind !== item.assetKind) {
            errors.push({ code: 'INCLUDED_PEER_KIND', path: `$.assets[${document.assets.indexOf(matches[0])}].kind`, hint: `Included ${item.kind} "${item.site}" must use asset kind ${item.assetKind}.` });
        }
    }
    return errors;
}

function findExistingArchitectSite(sites, requestedSite, hostContext = null) {
    const records = Object.values(sites || {});
    if (!hostContext) {
        return records.find(record => dungeonSiteRootsMatch(record?.siteRoot, requestedSite));
    }
    const canonical = records.find(record => dungeonSiteRootsMatch(record?.siteRoot, hostContext.peerSite));
    if (canonical) return canonical;
    return records.find(record => {
        if (!record?.mapChunks?.length || !dungeonSiteRootsMatch(record.siteRoot, requestedSite)) return false;
        const document = parseDungeonMapDocument(record.mapChunks[0], record.siteRoot).document;
        return !document.hostSite || document.hostSite === hostContext.hostSite;
    });
}

function topologyUserPrompt(args, context, referenceContext = '', currentLocation = '', hostContext = null, entranceKnowledge = 'VISITED') {
    return `CREATE ONE PRIVATE TOPOLOGY
Exact site root: ${args.site}
Entrance area: ${args.entrance}
Entrance knowledge: ${entranceKnowledge}${entranceKnowledge === 'UNREVEALED' ? ' (offsite structural creation; the party has not entered)' : ''}
Kind: ${args.kind} (${topologyKindBrief(args.kind)})
Scale: ${args.scale}
Threat: ${args.threat}
PRIVATE MAP-GENERATION PROMPT (does not grant player knowledge):
${args.prompt}
Attachment: ${args.attachTo ? `Create offsite and attach beneath map "${args.attachTo.site}" in exact cell "${args.attachTo.cell}". This is a structural edit only; do not move the party or infer that they entered.` : 'No explicit offsite attachment; runtime may use the active mapped cell as shorthand.'}
${hostContext?.topologyPromptContext || ''}
Live location footer: ${currentLocation || '(none yet)'}

LANGUAGE
Copy Exact site root and Entrance area character-for-character. Write every human-readable area name, geometry line, and route detail in that same language and script. Do not translate them into English. JSON keys, kebab-case IDs, and enums stay English.
Write each connection detail once as a direction-neutral description of the passage, then copy that exact string onto the reverse. Do not rewrite it from the other room.

RECENT STORY CONTEXT
${context || '(No additional recent context.)'}

${referenceContext || 'USER-SELECTED REFERENCE CONTEXT\n(none selected)'}

Output only the required JSON object. Follow the ${args.kind} instruction set.`;
}

function topologyCorrectionPrompt(args, context, referenceContext, priorOutput, parseError, errors, attempt, hostContext = null, entranceKnowledge = 'VISITED') {
    const issues = parseError
        ? [{ code: 'INVALID_JSON', path: '$', hint: parseError }]
        : errors.map(({ code, path, hint }) => ({ code, path, hint }));
    return `TOPOLOGY CORRECTION PASS ${attempt}\nYour previous topology was rejected. Return the complete corrected topology object, not a patch.\n\nRequested site: ${args.site}\nRequested entrance: ${args.entrance}\nRequested entrance knowledge: ${entranceKnowledge}\nRequested kind: ${args.kind} (${topologyKindBrief(args.kind)})\nScale: ${args.scale}\nThreat: ${args.threat}\nPRIVATE MAP-GENERATION PROMPT (does not grant player knowledge):\n${args.prompt}\n${hostContext?.topologyPromptContext || ''}\n\nVALIDATION ERRORS\n${JSON.stringify(issues, null, 2)}\n\nPREVIOUS OUTPUT\n${priorOutput}\n\nRECENT STORY CONTEXT\n${context || '(No additional recent context.)'}\n\n${referenceContext || 'USER-SELECTED REFERENCE CONTEXT\n(none selected)'}\n\nOutput only the corrected topology JSON object. Follow the ${args.kind} instruction set.`;
}

function lockedTopologyForPrompt(document) {
    return {
        version: document.version,
        site: document.site,
        kind: document.kind,
        threat: document.threat,
        areas: document.areas,
    };
}

function assetsUserPrompt(args, topology, context, referenceContext = '', currentTime = '', includeManifest = [], hostContext = null) {
    return `POPULATE ONE LOCKED PRIVATE MAP
Exact site root: ${args.site}
Kind: ${args.kind} (${kindBrief(args.kind)})
Scale: ${args.scale}
Threat: ${args.threat} (${threatBrief(args.threat, args.kind)})
PRIVATE MAP-GENERATION PROMPT (does not grant player knowledge):
${args.prompt}
${hostContext?.promptContext || ''}
${inclusionPrompt(includeManifest)}
Current in-world time (authoritative): ${currentTime || 'Unknown'}

LOCKED TOPOLOGY — copy area IDs exactly; do not alter or reproduce this structure in the response:
${JSON.stringify(lockedTopologyForPrompt(topology), null, 2)}

RECENT STORY CONTEXT
${context || '(No additional recent context.)'}

${referenceContext || 'USER-SELECTED REFERENCE CONTEXT\n(none selected)'}

Output exactly {"assets":[...]} and nothing else.`;
}

function assetsCorrectionPrompt(args, topology, context, referenceContext, priorOutput, parseError, errors, attempt, currentTime = '', includeManifest = [], hostContext = null) {
    const issues = parseError
        ? [{ code: 'INVALID_JSON', path: '$', hint: parseError }]
        : errors.map(({ code, path, hint }) => ({ code, path, hint }));
    return `CONTENT CORRECTION PASS ${attempt}\nYour previous placement payload was rejected. Return the complete corrected {"assets":[...]} object, not a patch and not the topology.\n\nRequested site: ${args.site}\nRequested kind: ${args.kind}\nScale: ${args.scale}\nThreat: ${args.threat} (${threatBrief(args.threat, args.kind)})\nPRIVATE MAP-GENERATION PROMPT (does not grant player knowledge):\n${args.prompt}\n${hostContext?.promptContext || ''}\n${inclusionPrompt(includeManifest)}\nCurrent in-world time: ${currentTime || 'Unknown'}\n\nLOCKED TOPOLOGY\n${JSON.stringify(lockedTopologyForPrompt(topology), null, 2)}\n\nVALIDATION ERRORS\n${JSON.stringify(issues, null, 2)}\n\nPREVIOUS OUTPUT\n${priorOutput}\n\nRECENT STORY CONTEXT\n${context || '(No additional recent context.)'}\n\n${referenceContext || 'USER-SELECTED REFERENCE CONTEXT\n(none selected)'}\n\nOutput exactly {"assets":[...]} and nothing else.`;
}

function envelopeErrors(value, allowedKeys, requiredKey, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const errors = Object.keys(value)
        .filter(key => !allowedKeys.includes(key))
        .map(key => ({ code: 'UNKNOWN_FIELD', path: `$.${key}`, hint: `${label} output must not contain "${key}".` }));
    if (!(requiredKey in value)) {
        errors.push({ code: 'MISSING_FIELD', path: `$.${requiredKey}`, hint: `${label} output must contain ${requiredKey}.` });
    }
    return errors;
}

function conciseIssues(issues) {
    return (issues || []).slice(0, 12).map(issue => `${issue.code} at ${issue.path}: ${issue.hint}`).join('; ');
}

function existingResult(siteRecord) {
    const document = parseDungeonMapDocument(siteRecord.mapChunks[0], siteRecord.siteRoot).document;
    return `[MAP_ARCHITECT_RESULT — PRIVATE]\nA map for ${siteRecord.siteRoot} was already attached. Reuse it; do not create or replace it.\n\n${formatDungeonMapForNarrator(document)}\n\nKeep unseen facts private and continue narration from the player-observable entrance.\n[/MAP_ARCHITECT_RESULT]`;
}

function describeFailure(error) {
    const messages = [];
    const seen = new Set();
    let current = error;
    while (current && !seen.has(current)) {
        seen.add(current);
        const message = String(current?.message || current).trim();
        if (message && !messages.includes(message)) messages.push(message);
        current = current?.cause;
    }
    return messages.join(': ') || 'Unknown failure';
}

function mapArchitectFailure(message) {
    return new Error(`[MAP_ARCHITECT_ERROR — PRIVATE]\n${message}\nDo not call CreateAreaMap again in this turn. Preserve the established fiction and retry only after a later player turn.\n[/MAP_ARCHITECT_ERROR]`);
}

async function runMapArchitectOnce(rawArgs) {
    const args = {
        site: String(rawArgs?.site || '').trim(),
        entrance: String(rawArgs?.entrance || '').trim(),
        prompt: String(rawArgs?.prompt || rawArgs?.premise || '').trim(),
        briefDescription: String(rawArgs?.brief_description || rawArgs?.briefDescription || '').trim(),
        kind: normalizeMapSiteKind(rawArgs?.kind),
        scale: String(rawArgs?.scale || 'MEDIUM').trim().toUpperCase(),
        threat: normalizeMapSiteThreat(rawArgs?.threat, defaultMapSiteThreat(rawArgs?.kind)),
        attachTo: normalizeMapAttachment(rawArgs?.attachTo),
    };
    if (!args.site || !args.entrance || !args.prompt) {
        throw mapArchitectFailure('site, entrance, and prompt are required. Establish those facts before a later attempt.');
    }
    if (!args.briefDescription) args.briefDescription = legacyBriefDescription(args.prompt, args.site);
    if (!['SMALL', 'MEDIUM', 'LARGE'].includes(args.scale)) args.scale = 'MEDIUM';

    broadcastStep('start', `Initializing Map Architect for ${args.site}...`);

    const ctx = SillyTavern.getContext();
    const settings = getSettings();
    if (!isLocationMappingEnabled(settings)) {
        throw mapArchitectFailure('Persistent Maps is disabled in Components. No map was generated or saved.');
    }
    const current = await syncDungeonMapsToLocationLorebook(ctx.chat || [], { capture: false });
    if ((current.errors || []).some(error => /no campaign prefix/i.test(String(error)))) {
        throw mapArchitectFailure('No campaign prefix is available, so there is no safe Locations lorebook target. Nothing was generated or saved.');
    }
    const include = normalizeInclude(rawArgs?.include);
    if (include.length && args.kind !== 'SETTLEMENT') {
        throw mapArchitectFailure('include[] is valid only while first creating a SETTLEMENT map.');
    }
    const includeManifest = resolveIncludeManifest(include, current.sites, args.site);
    const currentLocation = findLatestDungeonLocation(ctx.chat || []);
    const hostContext = resolveHostedCreationContext(current, currentLocation, args);
    const entranceKnowledge = hostContext?.explicit ? 'UNREVEALED' : 'VISITED';
    const existing = findExistingArchitectSite(current.sites, args.site, hostContext);
    if (existing?.mapChunks?.length) {
        if (includeManifest.length) {
            throw mapArchitectFailure('include[] cannot modify a SETTLEMENT that already has a stored map.');
        }
        if (rawArgs?.requireNew) {
            throw mapArchitectFailure(`A mapped location named "${args.site}" already exists.`);
        }
        if (hostContext) {
            const existingDocument = parseDungeonMapDocument(existing.mapChunks[0], existing.siteRoot).document;
            const saved = await persistArchitectDungeonMap(args.site, existingDocument, { hostContext });
            const continuation = hostContext.explicit
                ? 'This was an offsite structural edit. Keep the current player location and narration unchanged.'
                : 'Keep unseen facts private and continue narration from the player-observable entrance.';
            broadcastStep('finish', `Linked existing map for ${args.site} inside ${hostContext.hostSite}.`);
            return `[MAP_ARCHITECT_RESULT — PRIVATE]\nThe existing peer map was preserved and linked inside ${hostContext.hostSite}.\n\n${formatDungeonMapForNarrator(saved.document)}\n\n${continuation}\n[/MAP_ARCHITECT_RESULT]`;
        }
        broadcastStep('finish', `Reused existing map for ${args.site}.`);
        return existingResult(existing);
    }
    if (rawArgs?.requireNew && await locationRootExists(args.site)) {
        throw mapArchitectFailure(`A location named "${args.site}" already exists. Use + MAP on that root instead.`);
    }

    const lookback = resolveLookback(settings, rawArgs?.lookback);
    const context = recentStoryContext(ctx, lookback, current);
    const referenceContext = await buildMapArchitectReferenceContext(ctx, rawArgs);
    const currentTime = currentTimeFrom(settings);
    let topologyPrompt = topologyUserPrompt(args, context, referenceContext, currentLocation, hostContext, entranceKnowledge);
    let topology = null;
    let topologyIssues = [];

    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
        if (attempt > 0) broadcastStep('thought', `Topology correction pass ${attempt} for ${args.site}...`);
        else broadcastStep('thought', `Building ${args.kind.toLowerCase()} topology for ${args.site}...`);
        const output = await sendStateRequest(
            requestSettings(settings),
            DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT,
            topologyPrompt,
            null,
            { jsonSchema: MAP_ARCHITECT_TOPOLOGY_JSON_SCHEMA, stream: true, debugSource: 'Map Architect: Topology' },
        );
        const parsed = parseMapArchitectResponse(output);
        if (parsed.value?.areas) canonicalizeReciprocalConnectionDetails(parsed.value.areas);
        const envelope = envelopeErrors(parsed.value, ['version', 'site', 'kind', 'threat', 'areas'], 'areas', 'Topology');
        const candidate = parsed.value && !envelope.length
            ? {
                version: parsed.value.version,
                site: parsed.value.site,
                kind: parsed.value.kind,
                threat: parsed.value.threat,
                areas: parsed.value.areas,
                assets: [],
            }
            : null;
        const validation = candidate
            ? validateDungeonMapArchitecture(candidate, { site: args.site, entrance: args.entrance, entranceKnowledge, scale: args.scale, kind: args.kind, threat: args.threat })
            : { valid: false, errors: [] };
        if (validation.valid) {
            topology = validation.document;
            broadcastStep('result', `Topology locked with ${topology.areas.length} areas for ${args.site}.`);
            break;
        }
        topologyIssues = parsed.error
            ? [{ code: 'INVALID_JSON', path: '$', hint: parsed.error }]
            : [...envelope, ...validation.errors];
        if (attempt < MAX_CORRECTION_ATTEMPTS) {
            topologyPrompt = topologyCorrectionPrompt(args, context, referenceContext, output, parsed.error, topologyIssues, attempt + 1, hostContext, entranceKnowledge);
        }
    }

    if (!topology) {
        const failureMessage = `The architect could not produce a valid connected topology after ${MAX_CORRECTION_ATTEMPTS + 1} attempts. Nothing was saved. Problems: ${conciseIssues(topologyIssues)}`;
        broadcastStep('error', failureMessage);
        throw mapArchitectFailure(failureMessage);
    }

    const placementSystemPrompt = String(settings.mapArchitectSystemPrompt || DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).trim();
    let placementPrompt = assetsUserPrompt(args, topology, context, referenceContext, currentTime, includeManifest, hostContext);
    let completedMap = null;
    let placementIssues = [];

    for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
        if (attempt > 0) broadcastStep('thought', `Content correction pass ${attempt} for ${args.site}...`);
        else broadcastStep('thought', `Populating ${topology.areas.length} locked areas for ${args.site}...`);
        const output = await sendStateRequest(
            requestSettings(settings),
            placementSystemPrompt,
            placementPrompt,
            null,
            { jsonSchema: MAP_ARCHITECT_ASSETS_JSON_SCHEMA, stream: true, debugSource: 'Map Architect: Assets' },
        );
        const parsed = parseMapArchitectResponse(output);
        const envelope = envelopeErrors(parsed.value, ['assets'], 'assets', 'Content placement');
        const candidate = parsed.value && !envelope.length
            ? { ...lockedTopologyForPrompt(topology), assets: parsed.value.assets }
            : null;
        const baseValidation = candidate
            ? validateDungeonMapArchitecture(candidate, { site: args.site, entrance: args.entrance, entranceKnowledge, scale: args.scale, kind: args.kind, threat: args.threat })
            : { valid: false, errors: [] };
        const includeErrors = baseValidation.valid ? inclusionValidationErrors(baseValidation.document, includeManifest) : [];
        if (baseValidation.valid && !includeErrors.length) {
            completedMap = baseValidation.document;
            break;
        }
        placementIssues = parsed.error
            ? [{ code: 'INVALID_JSON', path: '$', hint: parsed.error }]
            : [...envelope, ...baseValidation.errors, ...includeErrors];
        if (attempt < MAX_CORRECTION_ATTEMPTS) {
            placementPrompt = assetsCorrectionPrompt(args, topology, context, referenceContext, output, parsed.error, placementIssues, attempt + 1, currentTime, includeManifest, hostContext);
        }
    }

    if (!completedMap) {
        const failureMessage = `The architect produced valid topology but could not place valid contents after ${MAX_CORRECTION_ATTEMPTS + 1} attempts. Nothing was saved. Problems: ${conciseIssues(placementIssues)}`;
        broadcastStep('error', failureMessage);
        throw mapArchitectFailure(failureMessage);
    }
    if (!isLocationMappingEnabled(getSettings())) {
        throw mapArchitectFailure('Persistent Maps was disabled while the map was being generated. Nothing was saved.');
    }
    const saved = await persistArchitectDungeonMap(args.site, completedMap, {
        requireNew: !!rawArgs?.requireNew,
        locationKeys: rawArgs?.locationKeys,
        locationCore: rawArgs?.locationCore || args.briefDescription,
        includeManifest,
        hostContext,
    });
    const status = saved.existing ? 'A concurrent map already existed and was preserved.' : `Map saved to ${saved.entryId}.`;
    const continuation = hostContext?.explicit
        ? 'This was an offsite structural edit. Do not move the player, change the Location footer, or narrate entry into the new map.'
        : `Continue narration from ${args.entrance}; reveal only what the player can perceive. Once they enter, copy this exact site name into the Location footer: "${args.site}".`;
    broadcastStep('result', status);
    broadcastStep('finish', `Map Architect finished for ${args.site}.`);
    return `[MAP_ARCHITECT_RESULT — PRIVATE]\n${status}\nTreat this as objective current canon. Do not expose unseen facts.\n\n${formatDungeonMapForNarrator(saved.document)}\n\n${continuation}\n[/MAP_ARCHITECT_RESULT]`;
}

/**
 * Lorebook Agent Auto path: one Architect turn fills CreateAreaMap handshake fields.
 * Site is locked; the narrator is not involved.
 */
export async function inferMapArchitectArgs({ site, loreEntry = '', userBrief = '', lookback, lorebookNames = [], characterCards = [] } = {}) {
    const siteRoot = String(site || '').trim();
    if (!siteRoot) throw new Error('Map Architect auto-fill needs a location root.');

    const ctx = SillyTavern.getContext();
    const settings = getSettings();
    if (!isLocationMappingEnabled(settings)) {
        throw new Error('Persistent Maps is disabled in Components. No map brief was filled.');
    }

    const current = await syncDungeonMapsToLocationLorebook(ctx.chat || [], { capture: false });
    if ((current.errors || []).some(error => /no campaign prefix/i.test(String(error)))) {
        throw new Error('No campaign prefix is available, so there is no safe Locations lorebook target.');
    }

    const windowSize = resolveLookback(settings, lookback);
    const context = recentStoryContext(ctx, windowSize, current);
    const referenceContext = await buildMapArchitectReferenceContext(ctx, { lorebookNames, characterCards });
    const lore = String(loreEntry || '').trim() || '(No location lore entry.)';
    const brief = String(userBrief || '').trim() || '(none)';
    const userPrompt = `FILL CREATE_AREA_MAP FIELDS
Exact site root (locked, copy character-for-character): ${siteRoot}

USER BRIEF
${brief}

LOCATION LORE
${lore}

RECENT STORY CONTEXT (${windowSize} messages${windowSize === 0 ? '; vacuum — do not invent from chat' : ''})
${context || '(No additional recent context.)'}

${referenceContext || 'USER-SELECTED REFERENCE CONTEXT\n(none selected)'}

Infer entrance, kind, scale, threat, a complete private generation prompt, a brief description, and optional extra keywords as the GM would before calling CreateAreaMap.
SETTLEMENT = the city/town/village as a whole. DUNGEON = a high-risk room graph. INTERIOR = a significant lower-risk multi-room site such as a palace, headquarters, monastery, safehouse, or recurring base. Ordinary settlement structures with no peer map are not mapped here.
Do not include the locked site name in keywords.
Output only the JSON object.`;

    const output = await sendStateRequest(
        requestSettings(settings, { maxTokens: Math.min(4000, Math.max(1000, Number(settings.mapArchitectMaxTokens) || 25000)) }),
        DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT,
        userPrompt,
        null,
        { jsonSchema: MAP_ARCHITECT_BRIEF_JSON_SCHEMA, stream: true, debugSource: 'Map Architect' },
    );
    const parsed = parseMapArchitectResponse(output);
    if (!parsed.value) {
        throw new Error(parsed.error || 'Map Architect returned no map brief JSON.');
    }

    const kind = normalizeMapSiteKind(parsed.value.kind);
    const entrance = String(parsed.value.entrance || '').trim();
    const prompt = String(parsed.value.prompt || '').trim();
    const briefDescription = String(parsed.value.brief_description || '').trim();
    const scale = String(parsed.value.scale || 'MEDIUM').trim().toUpperCase();
    const threat = normalizeMapSiteThreat(parsed.value.threat, defaultMapSiteThreat(kind));
    if (!entrance || !prompt || !briefDescription) {
        throw new Error('Map Architect returned an incomplete map brief (entrance, prompt, and brief_description are required).');
    }

    const extraKeys = Array.isArray(parsed.value.keywords)
        ? parsed.value.keywords.map(key => String(key || '').trim()).filter(Boolean)
        : [];

    return {
        site: siteRoot,
        entrance,
        kind,
        scale: ['SMALL', 'MEDIUM', 'LARGE'].includes(scale) ? scale : 'MEDIUM',
        threat,
        prompt,
        brief_description: briefDescription,
        keywords: extraKeys,
        lookback: windowSize,
        lorebookNames,
        characterCards,
    };
}

/** Dedupe parallel/repeated tool calls for the same site within one generation. */
export function runMapArchitect(args) {
    const key = normalizeKey([args?.attachTo?.site, args?.attachTo?.cell, args?.site].filter(Boolean).join(' :: '));
    if (architectRuns.has(key)) return architectRuns.get(key);
    startMapArchitectToast(args?.site);
    const run = runMapArchitectOnce(args)
        .then(result => {
            finishMapArchitectToast(args?.site, true);
            return result;
        })
        .catch(error => {
            finishMapArchitectToast(args?.site, false);
            console.error('[RPG Tracker] Map Architect failed:', error);
            broadcastStep('error', describeFailure(error));
            if (/\[MAP_ARCHITECT_(?:ERROR|ATTACHMENT_ERROR)/.test(String(error?.message || ''))) throw error;
            throw mapArchitectFailure(`Map Architect failed before a validated map could be saved: ${describeFailure(error)}`);
        })
        .finally(() => architectRuns.delete(key));
    architectRuns.set(key, run);
    return run;
}
