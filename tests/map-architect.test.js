import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMapArchitectResponse } from '../map-architect-parser.js';
import { buildMapArchitectReferenceContext } from '../map-architect-context.js';
import {
    MAP_ARCHITECT_ASSETS_JSON_SCHEMA,
    MAP_ARCHITECT_BRIEF_JSON_SCHEMA,
    MAP_ARCHITECT_JSON_SCHEMA,
    MAP_ARCHITECT_TOPOLOGY_JSON_SCHEMA,
} from '../map-architect-schema.js';
import {
    DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT,
    DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT,
    DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT,
} from '../map-architect-prompt.js';
import { resolveHostedCreationContext } from '../map-hosting-context.js';

function mappedRecord(siteRoot, entryId, kind, areas, hostSite = '') {
    return {
        siteRoot,
        entryId,
        mapChunks: [JSON.stringify({
            version: 3,
            site: siteRoot,
            kind,
            ...(hostSite ? { hostSite, hostBrief: `Contained in ${hostSite}.` } : {}),
            areas,
            assets: [],
        })],
    };
}

describe('Map Architect component', () => {
    it('resolves an explicit offsite AREA attachment on an INTERIOR without a BUILDING', () => {
        const monument = mappedRecord('Malarkey Monument', 'Book::1', 'INTERIOR', [
            { id: 'ritual-workroom', name: 'Ritual Workroom', knowledge: 'VISITED', geometry: [], connections: [] },
            { id: 'cellar-crypt', name: 'Cellar Crypt', knowledge: 'VISITED', geometry: [], connections: [] },
        ]);
        const context = resolveHostedCreationContext(
            { sites: { monument } },
            'Faraway Coast, Harbor',
            {
                site: 'Cellar Crypt Dungeon',
                kind: 'DUNGEON',
                prompt: 'A very detailed funerary complex design with history and encounter guidance.',
                briefDescription: 'A sealed funerary complex.',
                attachTo: { site: 'Malarkey Monument', cell: 'Cellar Crypt' },
            },
        );
        expect(context).toMatchObject({
            hostSite: 'Malarkey Monument',
            hostAreaId: 'cellar-crypt',
            peerSite: 'Malarkey Monument :: Cellar Crypt :: Cellar Crypt Dungeon',
            expectedAssetKind: 'SUBDUNGEON',
            briefDescription: 'A sealed funerary complex.',
            explicit: true,
            peerDepth: 2,
        });
        expect(context.promptContext).toContain('PARENT MAP CELL (LOCKED CONTEXT)');
        expect(context.promptContext).toContain('Target cell: Cellar Crypt [cellar-crypt]');
        expect(context.promptContext).toContain('Do not duplicate parent-cell occupants or props');
        expect(context.topologyPromptContext).toContain('PARENT MAP CELL (LOCKED STRUCTURAL CONTEXT)');
        expect(context.topologyPromptContext).toContain('Target cell: Cellar Crypt [cellar-crypt]');
        expect(context.topologyPromptContext).not.toMatch(/asset/i);
    });

    it('keeps similar attachment cell names distinct and returns exact choices', () => {
        const monument = mappedRecord('Malarkey Monument', 'Book::1', 'INTERIOR', [
            { id: 'cellar-crypt', name: 'Cellar Crypt', knowledge: 'VISITED', geometry: [], connections: [] },
        ]);
        expect(() => resolveHostedCreationContext(
            { sites: { monument } },
            '',
            {
                site: 'Lower Vault',
                kind: 'DUNGEON',
                premise: 'Hidden vault.',
                attachTo: { site: 'Malarkey Monument', cell: 'Cellar Crypt Dungeon' },
            },
        )).toThrow(/Available cells: Cellar Crypt/);
    });

    it('allows three mapped levels and rejects a fourth', () => {
        const root = mappedRecord('Malarkey', 'Book::1', 'SETTLEMENT', [
            { id: 'old-ward', name: 'Old Ward', knowledge: 'VISITED', geometry: [], connections: [] },
        ]);
        const monument = mappedRecord(
            'Malarkey :: Old Ward :: Monument',
            'Book::2',
            'INTERIOR',
            [{ id: 'cellar', name: 'Cellar', knowledge: 'VISITED', geometry: [], connections: [] }],
            'Malarkey',
        );
        const crypt = mappedRecord(
            'Malarkey :: Old Ward :: Monument :: Cellar :: Crypt Dungeon',
            'Book::3',
            'DUNGEON',
            [{ id: 'western-seal', name: 'Western Seal', knowledge: 'VISITED', geometry: [], connections: [] }],
            'Malarkey :: Old Ward :: Monument',
        );
        const sites = { root, monument, crypt };
        expect(resolveHostedCreationContext({ sites: { root, monument } }, '', {
            site: 'Crypt Dungeon',
            kind: 'DUNGEON',
            premise: 'Nested crypt.',
            attachTo: { site: monument.siteRoot, cell: 'Cellar' },
        }).peerDepth).toBe(3);
        expect(() => resolveHostedCreationContext({ sites }, '', {
            site: 'Buried Sanctum',
            kind: 'INTERIOR',
            premise: 'Too deep.',
            attachTo: { site: crypt.siteRoot, cell: 'Western Seal' },
        })).toThrow(/limited to 3 mapped levels/);
    });
    it('builds explicit lorebook and character-card context independently from story lookback', async () => {
        const context = await buildMapArchitectReferenceContext({
            loadWorldInfo: async (name) => name === 'Eldoria Lore'
                ? { entries: { 3: { comment: 'Moon Keep', content: 'An ancient fortress.' } } }
                : null,
        }, {
            lorebookNames: ['Eldoria Lore'],
            characterCards: [{ name: 'Captain Vale', description: 'A scarred royal scout.', personality: 'Cautious.' }],
        });
        expect(context).toContain('USER-SELECTED REFERENCE CONTEXT');
        expect(context).toContain('### LOREBOOK: Eldoria Lore');
        expect(context).toContain('#### Moon Keep');
        expect(context).toContain('### CHARACTER CARD: Captain Vale');
        expect(context).toContain('Personality: Cautious.');
    });

    it('recovers a valid JSON object from a fenced response', () => {
        const result = parseMapArchitectResponse('```json\n{"version":3,"site":"Crypt","areas":[],"assets":[]}\n```');
        expect(result.error).toBeNull();
        expect(result.value.site).toBe('Crypt');
    });

    it('reports malformed JSON so it can be fed into a correction pass', () => {
        const result = parseMapArchitectResponse('{"version":3,"areas":[');
        expect(result.value).toBeNull();
        expect(result.error).toMatch(/incomplete|Invalid JSON/i);
    });

    it('defaults Map Architect max output tokens to 25000 without capping below that', () => {
        const defaults = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');
        const architect = readFileSync(new URL('../map-architect.js', import.meta.url), 'utf8');
        const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        const profiles = readFileSync(new URL('../src/state/profiles.js', import.meta.url), 'utf8');
        const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
        expect(defaults).toContain('mapArchitectMaxTokens: 25000');
        expect(architect).toContain('Number(settings.mapArchitectMaxTokens) || 25000');
        expect(architect).toContain('stream: true');
        expect(index).toContain('settings.mapArchitectMaxTokens ?? 25000');
        expect(index).toContain('Math.min(32000, parseInt(String($(this).val()), 10) || 25000)');
        expect(profiles).toContain('mapArchitectMaxTokens: s.mapArchitectMaxTokens ?? 25000');
        expect(settingsMarkup).toMatch(/id="rpg_map_architect_max_tokens"[^>]*max="32000"/);
        expect(settingsMarkup).toContain('<b>Persistent Maps</b>');
        expect(settingsMarkup).toContain('<b>Map Architect</b>');
        expect(settingsMarkup).not.toContain('<b>Architect Prompt</b>');
        expect(defaults).not.toContain('mapArchitectMaxTokens: 6000');
        expect(index).not.toContain('mapArchitectMaxTokens ?? 6000');
        const settingsSource = readFileSync(new URL('../src/state/settings.js', import.meta.url), 'utf8');
        expect(settingsSource).toContain('mapArchitectMaxTokensFloored');
        expect(settingsSource).toContain('architectTokens < 25000');
        expect(defaults).not.toContain('mapArchitectMaxTokensFloored');
        expect(defaults).not.toContain('keywordOverflowMigratedTo6');
        expect(defaults).not.toContain('maxActiveKeysMigratedTo12');
    });

    it('broadcasts Map Architect lifecycle steps to the Agent Console', () => {
        const architect = readFileSync(new URL('../map-architect.js', import.meta.url), 'utf8');
        expect(architect).toContain("metadata: { source: 'map_architect', ...metadata }");
        expect(architect).toContain("broadcastStep('start', `Initializing Map Architect for ${args.site}...`)");
        expect(architect).toContain("broadcastStep('finish', `Map Architect finished for ${args.site}.`)");
        expect(architect).toContain("broadcastStep('error', describeFailure(error))");
    });

    it('registers a hidden narrator tool and a dedicated connection path', () => {
        const hooks = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
        const architect = readFileSync(new URL('../map-architect.js', import.meta.url), 'utf8');
        const router = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
        expect(hooks).toContain('You are also a soft map editor');
        expect(hooks).toContain('without moving the player and without first creating a BUILDING');
        expect(hooks).toContain('attachTo.site');
        expect(hooks).toContain('attachTo.cell');
        expect(hooks).toContain('Nesting is limited to three mapped levels');
        expect(hooks).toContain('buildMappedSitesInjection');
        expect(architect).not.toContain('mapSiteFooterMismatchHint');
        expect(architect).toContain('copy this exact site name into the Location footer');
        expect(hooks).toContain('does not need to match the current Location footer');
        expect(architect).toContain('Live location footer:');
        expect(router).not.toContain('mapSiteFooterMismatchHint(site, currentLocation)');
        expect(hooks).toContain("unregisterFunctionTool('CreateDungeonMap')");
        expect(hooks).toContain("enum: ['NONE', 'LOW', 'MODERATE', 'HIGH', 'DEADLY']");
        expect(hooks).toContain("enum: ['DUNGEON', 'SETTLEMENT', 'INTERIOR']");
        expect(hooks).toContain("include: { type: 'array'");
        expect(hooks).toContain("attachTo: {");
        expect(hooks).toContain("formatMessage: () => ''");
        expect(hooks).toContain('isMapArchitectTextOpener(settings)');
        expect(hooks).toContain('applyMapArchitectTextOpenerCyoaCaveat');
        expect(hooks).toContain("ctx.generate('continue')");
        expect(hooks).toContain('clearAssistantReasoning(message)');
        expect(hooks).toContain('seedMapArchitectContinueText');
        expect(hooks).toContain('if (args.attachTo)');
        expect(hooks).toContain("completed_offsite_attachment");
        expect(hooks).toContain('buildMapArchitectContinueBrief');
        expect(hooks).toContain('!narrationContinue');
        expect(hooks).toContain('maybeRunMapArchitectTextOpener');
        expect(hooks).toContain('findCreateAreaMapCandidate');
        expect(hooks).toContain('export async function onMapArchitectAssistantMessage');
        expect(hooks).toContain("source: 'generation_ended'");
        expect(hooks).toContain('if (dryRun === true)');
        expect(hooks).toContain('cleanMessageContent(message)');
        expect(hooks).toContain("logMapArchitectTextOpener('running'");
        expect(hooks).toContain("['impersonate', 'quiet']");
        expect(hooks).not.toContain("['swipe', 'regenerate', 'impersonate', 'quiet']");
        const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(index).toContain('onMapArchitectAssistantMessage');
        expect(hooks).toContain('export function syncLocationMappingRuntime()');
        expect(hooks).toContain('stopMapUpdaterPass()');
        expect(hooks).toContain('stopMapEvolutionPass()');
        expect(hooks).toContain('runtimeState.hasActiveDungeonMap = false');
        expect(architect).toContain('MAX_CORRECTION_ATTEMPTS = 2');
        expect(architect).toContain('persistArchitectDungeonMap');
        expect(architect).toContain('requireNew');
        expect(architect).toContain('locationKeys');
        expect(architect).toContain('locationCore');
        expect(architect).toContain('locationRootExists');
        expect(architect).toContain('export async function inferMapArchitectArgs');
        expect(architect).toContain('MAP_ARCHITECT_BRIEF_JSON_SCHEMA');
        expect(architect).toContain('canonicalizeReciprocalConnectionDetails');
        expect(architect).toContain('direction-neutral description of the passage');
        expect(architect).toContain('USER BRIEF');
        expect(architect).toContain('vacuum — do not invent from chat');
        expect(router).toContain('export async function deleteDungeonMapFromLocationEntry');
        expect(router).toContain('export async function locationRootExists');
        expect(router).toContain('locationKeysForNewRoot');
        expect(router).toContain('requireNew');
        expect(router).toContain('detachDungeonMapFromLocationEntry');
        expect(architect).toContain('mapArchitectConnectionSource');
        expect(architect).not.toContain('mapRuntimeConnectionSource');
        expect(architect).toContain("{ jsonSchema: MAP_ARCHITECT_TOPOLOGY_JSON_SCHEMA, stream: true, debugSource: 'Map Architect: Topology' }");
        expect(architect).toContain("{ jsonSchema: MAP_ARCHITECT_ASSETS_JSON_SCHEMA, stream: true, debugSource: 'Map Architect: Assets' }");
        expect(architect).toContain('Topology locked with ${topology.areas.length} areas');
        expect(architect).toContain('persistArchitectDungeonMap(args.site, completedMap');
        expect(architect).toContain('CreateAreaMap');
        expect(architect).toContain('Threat: ${args.threat}');
        expect(architect).toContain('Current in-world time (authoritative): ${currentTime');
        expect(architect).toContain('extractCurrentTimeStr');
        expect(architect).not.toContain('CreateDungeonMap');
        expect(architect).toContain('Generating a location map for');
        expect(architect).toContain('Location map ready for');
        expect(architect).toContain('Location map generation failed for');
        expect(architect).toContain('startMapArchitectToast');
    });

    it('defines the complete structured map response contract', () => {
        expect(MAP_ARCHITECT_TOPOLOGY_JSON_SCHEMA.value.required).toEqual(['version', 'site', 'kind', 'threat', 'areas']);
        expect(MAP_ARCHITECT_TOPOLOGY_JSON_SCHEMA.value.properties).not.toHaveProperty('assets');
        expect(MAP_ARCHITECT_ASSETS_JSON_SCHEMA.value.required).toEqual(['assets']);
        expect(Object.keys(MAP_ARCHITECT_ASSETS_JSON_SCHEMA.value.properties)).toEqual(['assets']);
        expect(MAP_ARCHITECT_JSON_SCHEMA.name).toBe('dungeon_map_v3');
        expect(MAP_ARCHITECT_JSON_SCHEMA.returnInvalid).toBe(true);
        expect(MAP_ARCHITECT_JSON_SCHEMA.value.required).toEqual(['version', 'site', 'areas', 'assets']);
        expect(MAP_ARCHITECT_JSON_SCHEMA.value.properties.areas.items.required).toContain('connections');
        expect(MAP_ARCHITECT_JSON_SCHEMA.value.properties.assets.items.required).toContain('origin');
        expect(MAP_ARCHITECT_JSON_SCHEMA.value.properties.kind.enum).toEqual(['DUNGEON', 'SETTLEMENT', 'INTERIOR']);
        expect(MAP_ARCHITECT_JSON_SCHEMA.value.properties.threat.enum).toEqual(['NONE', 'LOW', 'MODERATE', 'HIGH', 'DEADLY']);
        expect(MAP_ARCHITECT_JSON_SCHEMA.value.properties.assets.items.properties.kind.enum)
            .toEqual(expect.arrayContaining(['OBJECT', 'BUILDING', 'SUBDUNGEON', 'SUBINTERIOR']));
    });

    it('preflights exact include peers and persists absorption/promotion in one book save', () => {
        const architect = readFileSync(new URL('../map-architect.js', import.meta.url), 'utf8');
        const router = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
        const hosting = readFileSync(new URL('../map-hosting.js', import.meta.url), 'utf8');
        const hostingContext = readFileSync(new URL('../map-hosting-context.js', import.meta.url), 'utf8');
        expect(architect).toContain('resolveIncludeManifest(include, current.sites, args.site)');
        expect(architect).toContain('include must name one existing mapped DUNGEON or INTERIOR exactly');
        expect(architect).toContain('INCLUDED EXISTING PEERS (LOCKED)');
        expect(architect).toContain('Create exactly one asset named');
        expect(architect).toContain('resolveHostedCreationContext');
        expect(hostingContext).toContain('peerSite: buildHostedPeerSitePath(hostDocument, hostedAsset)');
        expect(hostingContext).toContain("const expectedAssetKind = args.kind === 'INTERIOR' ? 'SUBINTERIOR' : 'SUBDUNGEON'");
        expect(hostingContext).toContain('MAX_HOSTED_MAP_DEPTH');

        const start = router.indexOf('export async function persistArchitectDungeonMap');
        const end = router.indexOf('export async function persistManualDungeonMapDocument', start);
        const persistence = router.slice(start, end);
        expect(persistence).toContain('promoteHostedPeerAsset');
        expect(persistence).toContain('findArchitectMapEntry');
        expect(persistence).toContain('reparentHostedLocationEntries');
        expect(persistence).toContain('persistedDocument.site = site');
        expect(persistence).toContain('stampHostedPeerDocument');
        expect(persistence).toContain('ensureHostCoreMirror');
        expect(persistence).toContain('Included peer');
        expect(persistence).toContain('const hostedSite = buildHostedPeerSitePath(persistedDocument, matchingAssets[0])');
        expect(persistence).toContain('stamped.site = hostedSite');
        expect(persistence.match(/reparentHostedLocationEntries\(/g)).toHaveLength(2);
        expect(persistence.match(/saveWorldInfoSnapshot\(/g)).toHaveLength(1);
        expect(hosting).toContain('is already hosted inside');
        expect(hosting).toContain('Contained in ${hostDocument.site}, ${area.name}.');
        expect(hosting).toContain('Host Site: ${hostSite}');
        expect(hosting).toContain('Host Brief: ${hostBrief}');
    });

    it('migrates only untouched shipped prompts to the new taxonomy defaults', () => {
        const defaults = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');
        const settings = readFileSync(new URL('../src/state/settings.js', import.meta.url), 'utf8');
        expect(defaults).toContain("FACTORY_SETTINGS_VERSION = '2026.8.64'");
        expect(settings).toContain('promptSignature');
        expect(settings).toContain("'14870:8b5acf86'");
        expect(settings).toContain("'9025:d21f2f49'");
        expect(settings).toContain("'19340:f2971ff8'");
        expect(settings).toContain("'15245:3f89155f'");
        expect(settings).toContain("'15899:9c4786b5'");
        expect(settings).toContain("'9171:bc52dc99'");
        expect(settings).toContain("'19287:beb4258a'");
        expect(settings).toContain("'16167:7d0c5b25'");
        expect(settings).toContain("'16952:206a52ae'");
        expect(settings).toContain("'10260:25eac89f'");
        expect(settings).toContain("'13803:3665a0ba'");
        expect(settings).toContain("'14305:798ad4c6'");
        expect(settings).toContain("'17180:395cfd6b'");
        expect(settings).toContain("'18194:ff193c43'");
        expect(settings).toContain("'16929:720ad8e2'");
        expect(settings).toContain("'19809:21b3adcd'");
        expect(settings).toContain("'18972:6771d6ba'");
        expect(settings).toContain('DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT');
        expect(settings).toContain('DEFAULT_MAP_UPDATER_SYSTEM_PROMPT');
        expect(settings).toContain('DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT');
    });

    it('defines a handshake-only brief contract for Auto map create', () => {
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.name).toBe('map_architect_brief_v1');
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.returnInvalid).toBe(true);
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.value.required).toEqual(['entrance', 'kind', 'scale', 'threat', 'prompt', 'brief_description']);
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.value.properties.kind.enum).toEqual(['DUNGEON', 'SETTLEMENT', 'INTERIOR']);
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.value.properties.scale.enum).toEqual(['SMALL', 'MEDIUM', 'LARGE']);
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.value.properties.keywords.maxItems).toBe(5);
        expect(DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT).toContain('filling only the CreateAreaMap handshake');
        expect(DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT).toContain('You do not design rooms');
        expect(DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT).toContain('USER BRIEF');
        expect(DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT).not.toContain('CREATE ONE PRIVATE MAP');
    });

    it('keeps topology and content placement as strictly separate prompts', () => {
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).toContain('topology specialist');
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).toContain('Every connection must have a reverse connection');
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).toContain('byte-identical detail');
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).toContain('Geometry contains only the architectural envelope and fixed spatial structure');
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).toContain('Never inventory a room inside geometry');
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).toContain('company banner, reception desk, notice board');
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).toContain('if it could reasonably be examined, used, owned, searched, taken, damaged independently');
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).toContain('Familiar-site exception');
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).toContain('SMALL 4-7, MEDIUM 7-12, LARGE 12-20');
        expect(DEFAULT_MAP_ARCHITECT_TOPOLOGY_SYSTEM_PROMPT).not.toMatch(/asset/i);

        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('content-placement specialist');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('do not alter, reproduce, rename, reorder, or add areas or connections');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('functional rooms normally receive at least one meaningful item');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('important rooms usually receive 2-4');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('MEDIUM 16-28');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Do not create a BARRIER merely to duplicate');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Every entry defaults to UNREVEALED');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Never split a real group into identical singleton entries');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('single cook, clerk, guard, servant');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('GROUP must never use count:1');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Until Day 2, 4:40 AM');
        expect(MAP_ARCHITECT_ASSETS_JSON_SCHEMA.value.properties.assets.items.properties.count).toMatchObject({
            type: 'integer', minimum: 1, maximum: 99,
        });
        expect(MAP_ARCHITECT_ASSETS_JSON_SCHEMA.value.properties.assets.items.properties.duration.description)
            .toContain('absolute in-world temporal boundary');
    });
});
