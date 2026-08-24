import { describe, expect, it, beforeEach } from 'vitest';
import { getSettings, hydrateWorldProgressionFromChatState, resolveLiveChatStateOwner, saveChatState, shouldPreserveLiveChatStateOnBoot, snapshotStockPromptsForProfile } from '../state-manager.js';
import { testExtensionSettings } from './setup.js';

describe('saveChatState', () => {
    beforeEach(() => {
        for (const key of Object.keys(testExtensionSettings)) {
            delete testExtensionSettings[key];
        }
    });

    it('preserves substantive live state when the boot chat partition is missing or empty', () => {
        const s = getSettings();
        s.currentMemo = 'Live campaign state';
        s.memoHistory = ['older state'];
        s.memoPersistedAt = 200;
        s.chatStates = {};

        expect(shouldPreserveLiveChatStateOnBoot(s, 'active-chat')).toBe(true);

        s.chatStates['active-chat'] = {
            currentMemo: '',
            memoHistory: [],
            memoPersistedAt: 100,
        };
        expect(shouldPreserveLiveChatStateOnBoot(s, 'active-chat')).toBe(true);
    });

    it('loads a substantive active partition instead of replacing it during boot', () => {
        const s = getSettings();
        s.currentMemo = 'Top-level checkpoint';
        s.memoHistory = [];
        s.memoPersistedAt = 100;
        s.chatStates = {
            'active-chat': {
                currentMemo: 'Saved active campaign',
                memoHistory: ['one', 'two'],
                memoPersistedAt: 200,
            },
        };

        expect(shouldPreserveLiveChatStateOnBoot(s, 'active-chat')).toBe(false);
    });

    it('preserves a newer live snapshot even when the saved partition is equally substantial', () => {
        const s = getSettings();
        s.currentMemo = 'New live campaign state';
        s.memoHistory = ['one'];
        s.memoPersistedAt = 300;
        s.chatStates = {
            'active-chat': {
                currentMemo: 'Older saved campaign state',
                memoHistory: ['one'],
                memoPersistedAt: 200,
            },
        };

        expect(shouldPreserveLiveChatStateOnBoot(s, 'active-chat')).toBe(true);
    });

    it('never preserves a live projection owned by another chat', () => {
        const s = getSettings();
        s.chatStateProjectionOwner = 'other-chat';
        s.currentMemo = 'Other campaign state';
        s.memoPersistedAt = 500;
        s.chatStates = {
            'active-chat': {
                currentMemo: 'Correct active campaign state',
                memoPersistedAt: 100,
            },
        };

        expect(shouldPreserveLiveChatStateOnBoot(s, 'active-chat')).toBe(false);
    });

    it('infers the legacy live owner from an exact snapshot or unique campaign prefix', () => {
        const s = getSettings();
        s.chatStateProjectionOwner = '';
        s.currentMemo = 'Live alpha';
        s.memoPersistedAt = 300;
        s.routerCampaignPrefix = 'Alpha';
        s.chatStates = {
            alpha: { currentMemo: 'Live alpha', memoPersistedAt: 300, routerCampaignPrefix: 'Alpha' },
            beta: { currentMemo: 'Saved beta', memoPersistedAt: 200, routerCampaignPrefix: 'Beta' },
        };

        expect(resolveLiveChatStateOwner(s)).toBe('alpha');

        s.memoPersistedAt = 999;
        s.currentMemo = 'Newer unsnapshotted alpha';
        expect(resolveLiveChatStateOwner(s)).toBe('alpha');
    });

    it('refuses to guess a legacy owner when identity evidence is ambiguous', () => {
        const s = getSettings();
        s.chatStateProjectionOwner = '';
        s.currentMemo = 'Live state';
        s.memoPersistedAt = 300;
        s.routerCampaignPrefix = 'Shared';
        s.chatStates = {
            alpha: { currentMemo: 'Different', memoPersistedAt: 100, routerCampaignPrefix: 'Shared' },
            beta: { currentMemo: 'Different', memoPersistedAt: 200, routerCampaignPrefix: 'Shared' },
        };

        expect(resolveLiveChatStateOwner(s)).toBe('');
    });

    it('snapshots stock prompts via snapshotStockPromptsForProfile without throwing', () => {
        const s = getSettings();
        s.chatLinkEnabled = true;
        s.currentMemo = 'test-memo';
        s.combatDefeatedUi = [{ name: 'Bandit', content: 'Bandit: 0/18 HP\nStatus: Defeated' }];
        s.modules = { character: true };
        s.stockPrompts = { character: 'custom prompt' };

        expect(() => saveChatState('vitest-chat', { skipDiskWrite: true })).not.toThrow();

        const part = getSettings().chatStates['vitest-chat'];
        expect(getSettings().chatStateProjectionOwner).toBe('vitest-chat');
        expect(part.currentMemo).toBe('test-memo');
        expect(part.combatDefeatedUi).toEqual(s.combatDefeatedUi);
        expect(part.combatDefeatedUi).not.toBe(s.combatDefeatedUi);
        expect(part.stockPrompts.character).toBe('custom prompt');
        // merged with defaults — more keys than the one override
        expect(Object.keys(part.stockPrompts).length).toBeGreaterThan(1);
        expect(snapshotStockPromptsForProfile({ character: 'x' }).character).toBe('x');
    });

    it('keeps custom tracker definitions global while preserving legacy chat-linked modules', () => {
        const s = getSettings();
        s.customFields = [];
        delete s.customFieldsGlobalizedVersion;
        s.chatStates = {
            alpha: { customFields: [{ tag: 'ALPHA_TRACKER', label: 'Alpha', enabled: true }] },
            beta: { customFields: [{ tag: 'BETA_TRACKER', label: 'Beta', enabled: true }] },
        };

        const migrated = getSettings();
        expect(migrated.customFields.map(field => field.tag)).toEqual(['ALPHA_TRACKER', 'BETA_TRACKER']);
        expect(migrated.chatStates.alpha.customFields).toBeUndefined();
        expect(migrated.chatStates.beta.customFields).toBeUndefined();

        saveChatState('fresh-chat', { skipDiskWrite: true });
        expect(migrated.chatStates['fresh-chat'].customFields).toBeUndefined();
    });

    it('snapshots NPC relationship values and logs into the chat partition', () => {
        const s = getSettings();
        s.npcRelationshipValues = {
            'Eldoria_NPCs::7': { friendship: 18, affection: -4 },
        };
        s.npcRelationshipLog = {
            'Eldoria_NPCs::7': [{ timestamp: 1, field: 'friendship', delta: 3, newValue: 18, source: 'agent' }],
        };

        saveChatState('rel-chat', { skipDiskWrite: true });

        const part = s.chatStates['rel-chat'];
        expect(part.npcRelationshipValues).toEqual(s.npcRelationshipValues);
        expect(part.npcRelationshipValues).not.toBe(s.npcRelationshipValues);
        expect(part.npcRelationshipLog).toEqual(s.npcRelationshipLog);
        expect(part.npcRelationshipLog).not.toBe(s.npcRelationshipLog);
        expect(part.npcLibrary).toBeUndefined();

        s.npcRelationshipValues['Eldoria_NPCs::7'].friendship = 99;
        expect(part.npcRelationshipValues['Eldoria_NPCs::7'].friendship).toBe(18);
    });

    it('preserves dungeon reality authored directly in the chat partition', () => {
        const s = getSettings();
        s.chatStates['vitest-chat'] = {
            dungeonReality: {
                version: 1,
                sites: {
                    'ember mine': {
                        siteRoot: 'Ember Mine',
                        mapChunks: ['Area: Lift'],
                        statusLog: [],
                    },
                },
            },
        };

        saveChatState('vitest-chat', { skipDiskWrite: true });

        expect(s.chatStates['vitest-chat'].dungeonReality.sites['ember mine'].mapChunks)
            .toEqual(['Area: Lift']);
    });

    it('snapshots World Progression rotation and per-map report consumption independently', () => {
        const s = getSettings();
        s.worldProgressionLocationLastAdvanced = { morrowfen: 'Day 3, 08:00' };
        s.mapEvolutionWorldReportApplications = {
            morrowfen: { 'Campaign_World::7': { status: 'materialized' } },
        };
        s.mapEvolutionBacklogBySite = {
            morrowfen: [{ kind: 'quiet', at: 'Day 3, 08:00', elapsedMinutes: 15 }],
        };
        s.mapEvolutionThreadsBySite = {
            morrowfen: [{ id: 'kill:0', at: 'Day 3, 08:00', status: 'open', cause: 'Killed by the party.', actor: 'party', subjectId: 'ghoul' }],
        };

        saveChatState('world-chat', { skipDiskWrite: true });

        const part = s.chatStates['world-chat'];
        expect(part.worldProgressionLocationLastAdvanced).toEqual(s.worldProgressionLocationLastAdvanced);
        expect(part.mapEvolutionWorldReportApplications).toEqual(s.mapEvolutionWorldReportApplications);
        expect(part.mapEvolutionBacklogBySite).toEqual(s.mapEvolutionBacklogBySite);
        expect(part.mapEvolutionThreadsBySite).toEqual(s.mapEvolutionThreadsBySite);
        expect(part.worldProgressionLocationLastAdvanced).not.toBe(s.worldProgressionLocationLastAdvanced);
        expect(part.mapEvolutionWorldReportApplications).not.toBe(s.mapEvolutionWorldReportApplications);
        expect(part.mapEvolutionBacklogBySite).not.toBe(s.mapEvolutionBacklogBySite);
        expect(part.mapEvolutionThreadsBySite).not.toBe(s.mapEvolutionThreadsBySite);
    });

    it('snapshots Map Updater exit bookkeeping in the chat partition', () => {
        const s = getSettings();
        s.mapUpdaterLastSiteRoot = 'Ember Mine';
        s.mapUpdaterPendingExitRoot = 'Forgotten Tomb';

        saveChatState('map-updater-exit-chat', { skipDiskWrite: true });

        expect(s.chatStates['map-updater-exit-chat']).toMatchObject({
            mapUpdaterLastSiteRoot: 'Ember Mine',
            mapUpdaterPendingExitRoot: 'Forgotten Tomb',
        });
    });

    it('rehydrates World Progression and Map Evolution watermarks from the active chat partition', () => {
        const s = getSettings();
        s.chatLinkEnabled = true;
        s.worldProgressionLastFiredPeriodLabel = '';
        s.worldProgressionLocationLastAdvanced = {};
        s.mapEvolutionLastFiredBySite = {};
        s.mapEvolutionBacklogBySite = {};
        s.mapEvolutionThreadsBySite = {};
        s.mapEvolutionWorldReportApplications = {};
        s.chatStates['vitest-chat'] = {
            worldProgressionLastFiredPeriodLabel: 'Day 3, 08:00',
            worldProgressionLocationLastAdvanced: { morrowfen: 'Day 3, 08:00' },
            mapEvolutionLastFiredBySite: { morrowfen: 'Day 2, 16:00' },
            mapEvolutionBacklogBySite: {
                morrowfen: [{ kind: 'commit', at: 'Day 2, 16:00', operationId: 'evo-watch' }],
            },
            mapEvolutionThreadsBySite: {
                morrowfen: [{ id: 'kill:0', at: 'Day 2, 16:00', status: 'open', cause: 'Killed by the party.', actor: 'party', subjectId: 'ghoul' }],
            },
            mapEvolutionWorldReportApplications: {
                morrowfen: { 'Campaign_World::7': { status: 'materialized' } },
            },
        };

        expect(hydrateWorldProgressionFromChatState()).toBe(true);
        expect(s.worldProgressionLastFiredPeriodLabel).toBe('Day 3, 08:00');
        expect(s.worldProgressionLocationLastAdvanced).toEqual({ morrowfen: 'Day 3, 08:00' });
        expect(s.mapEvolutionLastFiredBySite).toEqual({ morrowfen: 'Day 2, 16:00' });
        expect(s.mapEvolutionBacklogBySite.morrowfen[0].operationId).toBe('evo-watch');
        expect(s.mapEvolutionThreadsBySite.morrowfen[0].actor).toBe('party');
        expect(s.mapEvolutionWorldReportApplications.morrowfen['Campaign_World::7'].status)
            .toBe('materialized');
        expect(s.worldProgressionLocationLastAdvanced)
            .not.toBe(s.chatStates['vitest-chat'].worldProgressionLocationLastAdvanced);
        expect(s.mapEvolutionLastFiredBySite)
            .not.toBe(s.chatStates['vitest-chat'].mapEvolutionLastFiredBySite);
        expect(s.mapEvolutionBacklogBySite)
            .not.toBe(s.chatStates['vitest-chat'].mapEvolutionBacklogBySite);
        expect(s.mapEvolutionThreadsBySite)
            .not.toBe(s.chatStates['vitest-chat'].mapEvolutionThreadsBySite);
        expect(s.mapEvolutionWorldReportApplications)
            .not.toBe(s.chatStates['vitest-chat'].mapEvolutionWorldReportApplications);
    });

    it('snapshots the full Control Room and tracker-module setup only when opted in', () => {
        const s = getSettings();
        s.chatSetupLinkEnabled = true;
        s.customFields = [{ tag: 'REPUTATION', label: 'Reputation', enabled: true }];
        s.customSyspromptLibrary = [{ id: 'law', tag: 'law', content: 'Custom law' }];
        s.syspromptSectionOrder = ['lib:law'];
        s.systemPromptTemplate = 'Per-chat extractor';

        saveChatState('locked-chat', { skipDiskWrite: true });

        const setup = s.chatStates['locked-chat'].setup;
        expect(setup.customFieldStates.REPUTATION).toBe(true);
        expect(setup.syspromptSnippetStates.law).toBe(false);
        expect(setup.syspromptSectionOrder).toEqual(['lib:law']);
        expect(setup.systemPromptTemplate).toBe('Per-chat extractor');
        expect(setup.cyoaConfig.slots).toBeDefined();
        expect(setup.cyoaConfig.presets).toBeDefined();
        expect(setup.cyoaConfig.buttonColor).toBeUndefined();
        expect(setup.cyoaConfig.mechBgOpacity).toBeUndefined();
        expect(s.trackerModuleDatabase[0].tag).toBe('REPUTATION');
        expect(s.syspromptSnippetDatabase[0].content).toBe('Custom law');
    });
});
