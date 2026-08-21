import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMapArchitectResponse } from '../map-architect-parser.js';
import { buildMapArchitectReferenceContext } from '../map-architect-context.js';
import { MAP_ARCHITECT_BRIEF_JSON_SCHEMA, MAP_ARCHITECT_JSON_SCHEMA } from '../map-architect-schema.js';
import { DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT, DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT } from '../map-architect-prompt.js';

describe('Map Architect component', () => {
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

    it('registers a hidden narrator tool and a dedicated connection path', () => {
        const hooks = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
        const architect = readFileSync(new URL('../map-architect.js', import.meta.url), 'utf8');
        const router = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
        expect(hooks).toContain('SETTLEMENT is a district graph');
        expect(hooks).toContain('Ordinary shops, inns, houses, and chapels remain BUILDING assets');
        expect(hooks).toContain('Never map OBJECT props, wilderness, roads, or districts');
        expect(hooks).toContain('A listed mapped peer is reused');
        expect(hooks).toContain('buildMappedSitesInjection');
        expect(architect).toContain('mapSiteFooterMismatchHint');
        expect(architect).toContain('Live location footer:');
        expect(router).toContain('mapSiteFooterMismatchHint(site, currentLocation)');
        expect(hooks).toContain("unregisterFunctionTool('CreateDungeonMap')");
        expect(hooks).toContain("enum: ['NONE', 'LOW', 'MODERATE', 'HIGH', 'DEADLY']");
        expect(hooks).toContain("enum: ['DUNGEON', 'SETTLEMENT', 'INTERIOR']");
        expect(hooks).toContain("include: { type: 'array'");
        expect(hooks).toContain('Generating a location map for');
        expect(hooks).toContain('isMapArchitectTextOpener(settings)');
        expect(hooks).toContain('applyMapArchitectTextOpenerCyoaCaveat');
        expect(hooks).toContain("ctx.generate('continue')");
        expect(hooks).toContain('clearAssistantReasoning(message)');
        expect(hooks).toContain('seedMapArchitectContinueText');
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
        expect(architect).toContain('allowOffsite');
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
        expect(architect).toContain("{ jsonSchema: MAP_ARCHITECT_JSON_SCHEMA, stream: true, debugSource: 'Map Architect' }");
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
        expect(architect).toContain('resolveIncludeManifest(include, current.sites, args.site)');
        expect(architect).toContain('include must name one existing mapped DUNGEON or INTERIOR exactly');
        expect(architect).toContain('INCLUDED EXISTING PEERS (LOCKED)');
        expect(architect).toContain('Create exactly one asset named');
        expect(architect).toContain('resolveHostedCreationContext');
        expect(architect).toContain("const expectedAssetKind = args.kind === 'INTERIOR' ? 'SUBINTERIOR' : 'SUBDUNGEON'");

        const start = router.indexOf('export async function persistArchitectDungeonMap');
        const end = router.indexOf('export async function persistManualDungeonMapDocument', start);
        const persistence = router.slice(start, end);
        expect(persistence).toContain('promoteSettlementPeerAsset');
        expect(persistence).toContain('stampHostedPeerDocument');
        expect(persistence).toContain('ensureHostCoreMirror');
        expect(persistence).toContain('Included peer');
        expect(persistence.match(/saveWorldInfoSnapshot\(/g)).toHaveLength(1);
        expect(hosting).toContain('is already hosted inside');
        expect(hosting).toContain('Contained in ${hostDocument.site}, ${area.name}.');
        expect(hosting).toContain('Host Site: ${hostSite}');
        expect(hosting).toContain('Host Brief: ${hostBrief}');
    });

    it('migrates only untouched shipped prompts to the new taxonomy defaults', () => {
        const defaults = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');
        const settings = readFileSync(new URL('../src/state/settings.js', import.meta.url), 'utf8');
        expect(defaults).toContain("FACTORY_SETTINGS_VERSION = '2026.8.22.2'");
        expect(settings).toContain('promptSignature');
        expect(settings).toContain("'14870:8b5acf86'");
        expect(settings).toContain("'9025:d21f2f49'");
        expect(settings).toContain("'19340:f2971ff8'");
        expect(settings).toContain("'15245:3f89155f'");
        expect(settings).toContain('DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT');
        expect(settings).toContain('DEFAULT_MAP_UPDATER_SYSTEM_PROMPT');
        expect(settings).toContain('DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT');
    });

    it('defines a handshake-only brief contract for Auto map create', () => {
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.name).toBe('map_architect_brief_v1');
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.returnInvalid).toBe(true);
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.value.required).toEqual(['entrance', 'kind', 'scale', 'threat', 'premise']);
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.value.properties.kind.enum).toEqual(['DUNGEON', 'SETTLEMENT', 'INTERIOR']);
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.value.properties.scale.enum).toEqual(['SMALL', 'MEDIUM', 'LARGE']);
        expect(MAP_ARCHITECT_BRIEF_JSON_SCHEMA.value.properties.keywords.maxItems).toBe(5);
        expect(DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT).toContain('filling only the CreateAreaMap handshake');
        expect(DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT).toContain('You do not design rooms');
        expect(DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT).toContain('USER BRIEF');
        expect(DEFAULT_MAP_ARCHITECT_BRIEF_SYSTEM_PROMPT).not.toContain('CREATE ONE PRIVATE MAP');
    });

    it('tells the architect to populate incidental objects instead of leaving them for later', () => {
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Write every human-readable string in the same language and script');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Do not translate, transliterate, expand, or retitle them');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('human-readable strings in the campaign language');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Threat is a site fact, never matched to party level');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Scale is size, not danger');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('"threat":"NONE|LOW|MODERATE|HIGH|DEADLY"');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).not.toContain('need not pre-invent');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('copy that exact same string onto the reverse connection');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Never give a reciprocal pair two different detail strings');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Occasional hub/nexus layouts are welcome');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('one area may have many routes');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('KIND: DUNGEON');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('KIND: INTERIOR');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('KIND: SETTLEMENT');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('never an alley, house, shop, rooftop, or street');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Areas are districts, gates, plazas');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Ordinary named structures are BUILDING assets');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Stalls, wells, statues, altars, and other props are OBJECT');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('locked inclusion manifest');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('may organically establish a SUBDUNGEON');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('outside locked inclusions, normally create zero to two SUB* assets total');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Ordinary shops, inns, chapels, homes, and similar structures remain BUILDING');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('exact canonical name of its future peer map');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('INDEPENDENT SCHEMA SNIPPETS');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('orbital science fiction');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('submerged research complex');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('fairy-tale diplomacy');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('near-future city');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).not.toContain('Hall of the Ember-Ancestors');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).not.toContain('Morrowfen');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('a neutralized mechanism is DEACTIVATED');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('"origin":"INITIAL_MAP"');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('"state":"LOCKED"');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Never make a chapel, inn, shop, or house its own settlement area');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Never use kind NPC');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('ONE GROUP asset with optional integer count');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('"count":7');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Never split a pack into many identical CREATURE assets');
        expect(MAP_ARCHITECT_JSON_SCHEMA.value.properties.assets.items.properties.count).toMatchObject({
            type: 'integer', minimum: 1, maximum: 99,
        });
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('TIME MECHANICS');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('duration field as an absolute in-world timestamp');
        expect(DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT).toContain('Until Day 2, 4:40 AM');
        expect(MAP_ARCHITECT_JSON_SCHEMA.value.properties.assets.items.properties.duration.description)
            .toContain('absolute in-world temporal boundary');
    });
});
