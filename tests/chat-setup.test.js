import { describe, expect, it } from 'vitest';
import {
    applyChatSetup,
    buildDefaultSettings,
    clearChatBoundActivations,
    getChatSetupItemScope,
    getChatSetupScopeOwner,
    migrateChatSetupCatalogs,
    removeChatSetupCatalogEntries,
    resetChatSetupToStock,
    setChatSetupItemEnabled,
    setChatSetupItemScope,
    snapshotChatSetup,
    syncChatSetupCatalogs,
} from '../state-manager.js';

describe('per-chat Control Room and tracker setup', () => {
    it('keeps definitions global while activation remains per chat', () => {
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.customSyspromptLibrary = [{ id: 'grim', tag: 'tone', content: 'Grim', enabled: true }];
        settings.syspromptSectionOrder = ['lib:grim', 'narrative'];
        settings.customFields = [{ tag: 'SANITY', label: 'Sanity', enabled: true }];
        settings.modules.combat = false;
        settings.stockPrompts.combat = 'Custom combat';
        const chatA = snapshotChatSetup(settings);

        settings.customSyspromptLibrary[0].enabled = false;
        settings.customFields[0].enabled = false;
        const chatB = snapshotChatSetup(settings);

        expect(applyChatSetup(settings, chatA)).toBe(true);
        expect(settings.customSyspromptLibrary[0].content).toBe('Grim');
        expect(settings.customSyspromptLibrary[0].enabled).toBe(true);
        expect(settings.customFields[0].enabled).toBe(true);
        expect(settings.modules.combat).toBe(false);
        expect(settings.stockPrompts.combat).toBe('Custom combat');

        expect(applyChatSetup(settings, chatB)).toBe(true);
        expect(settings.customSyspromptLibrary[0].content).toBe('Grim');
        expect(settings.customSyspromptLibrary[0].enabled).toBe(false);
        expect(settings.customFields[0].enabled).toBe(false);
    });

    it('keeps CYOA choices per-chat while preserving one global visual theme', () => {
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.cyoaConfig = {
            ...settings.cyoaConfig,
            slots: [{ type: 'custom', text: 'Chat A choice' }],
            presets: { ChatA: [{ type: 'narrative' }] },
            useEmojis: false,
            useButtonTags: true,
            buttonColor: '#123456',
            mechBgOpacity: 0.42,
        };

        const chatA = snapshotChatSetup(settings);
        expect(chatA.cyoaConfig.slots[0].text).toBe('Chat A choice');
        expect(chatA.cyoaConfig.presets).toHaveProperty('ChatA');
        expect(chatA.cyoaConfig.useEmojis).toBe(false);
        expect(chatA.cyoaConfig.useButtonTags).toBe(true);
        expect(chatA.cyoaConfig.buttonColor).toBeUndefined();
        expect(chatA.cyoaConfig.mechBgOpacity).toBeUndefined();

        settings.cyoaConfig.slots = [{ type: 'custom', text: 'Chat B choice' }];
        settings.cyoaConfig.presets = { ChatB: [{ type: 'custom', text: 'B' }] };
        settings.cyoaConfig.useEmojis = true;
        settings.cyoaConfig.useButtonTags = false;
        settings.cyoaConfig.buttonColor = '#abcdef';
        settings.cyoaConfig.mechBgOpacity = 0.77;
        const chatB = snapshotChatSetup(settings);

        expect(applyChatSetup(settings, chatA)).toBe(true);
        expect(settings.cyoaConfig.slots[0].text).toBe('Chat A choice');
        expect(settings.cyoaConfig.presets).toHaveProperty('ChatA');
        expect(settings.cyoaConfig.useEmojis).toBe(false);
        expect(settings.cyoaConfig.useButtonTags).toBe(true);
        expect(settings.cyoaConfig.buttonColor).toBe('#abcdef');
        expect(settings.cyoaConfig.mechBgOpacity).toBe(0.77);

        expect(applyChatSetup(settings, chatB)).toBe(true);
        expect(settings.cyoaConfig.slots[0].text).toBe('Chat B choice');
        expect(settings.cyoaConfig.presets).toHaveProperty('ChatB');
        expect(settings.cyoaConfig.useEmojis).toBe(true);
        expect(settings.cyoaConfig.useButtonTags).toBe(false);
        expect(settings.cyoaConfig.buttonColor).toBe('#abcdef');
        expect(settings.cyoaConfig.mechBgOpacity).toBe(0.77);
    });

    it('migrates visual fields out of legacy per-chat CYOA copies', () => {
        const settings = buildDefaultSettings();
        settings.chatSetupCatalogVersion = 2;
        settings.cyoaConfig.buttonColor = '#abcdef';
        settings.chatStates = {
            alpha: {
                setup: {
                    cyoaConfig: {
                        slots: [{ type: 'custom', text: 'Alpha choice' }],
                        presets: { Alpha: [{ type: 'narrative' }] },
                        buttonColor: '#111111',
                    },
                },
            },
            beta: {
                setup: {
                    cyoaConfig: {
                        slots: [{ type: 'custom', text: 'Beta choice' }],
                        presets: { Beta: [{ type: 'narrative' }] },
                        buttonColor: '#222222',
                    },
                },
            },
        };

        expect(migrateChatSetupCatalogs(settings)).toBe(true);
        expect(settings.chatSetupCatalogVersion).toBe(3);
        expect(settings.cyoaConfig.buttonColor).toBe('#abcdef');
        expect(settings.chatStates.alpha.setup.cyoaConfig.slots[0].text).toBe('Alpha choice');
        expect(settings.chatStates.alpha.setup.cyoaConfig.presets).toHaveProperty('Alpha');
        expect(settings.chatStates.alpha.setup.cyoaConfig.buttonColor).toBeUndefined();
        expect(settings.chatStates.beta.setup.cyoaConfig.slots[0].text).toBe('Beta choice');
        expect(settings.chatStates.beta.setup.cyoaConfig.presets).toHaveProperty('Beta');
        expect(settings.chatStates.beta.setup.cyoaConfig.buttonColor).toBeUndefined();
    });

    it('resets setup fields to stock while keeping catalog items inactive', () => {
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.currentMemo = '[CHARACTER]Keep me[/CHARACTER]';
        settings.customFields = [{ tag: 'SANITY', label: 'Sanity', enabled: true }];
        settings.customSyspromptLibrary = [{ id: 'grim', tag: 'tone', content: 'Grim', enabled: true }];
        settings.modules.combat = false;
        snapshotChatSetup(settings);

        resetChatSetupToStock(settings);

        const defaults = buildDefaultSettings();
        expect(settings.currentMemo).toBe('[CHARACTER]Keep me[/CHARACTER]');
        expect(settings.customFields.map(field => [field.tag, field.enabled])).toEqual([['SANITY', false]]);
        expect(settings.customSyspromptLibrary.map(item => [item.id, item.enabled])).toEqual([['grim', false]]);
        expect(settings.modules).toEqual(defaults.modules);
    });

    it('migrates legacy chat definitions into catalogs and removes them only explicitly', () => {
        const settings = buildDefaultSettings();
        settings.chatStates = {
            alpha: {
                setup: {
                    customFields: [{ tag: 'SANITY', label: 'Sanity', enabled: true }],
                    customSyspromptLibrary: [{ id: 'grim', tag: 'tone', content: 'Grim', enabled: true }],
                    gameSystems: [{ id: 'system-1', name: 'Sanity', enabled: true }],
                },
            },
        };

        expect(migrateChatSetupCatalogs(settings)).toBe(true);
        expect(settings.trackerModuleDatabase.map(item => item.tag)).toEqual(['SANITY']);
        expect(settings.syspromptSnippetDatabase.map(item => item.id)).toEqual(['grim']);
        expect(settings.gameSystemDatabase.map(item => item.id)).toEqual(['system-1']);
        expect(settings.chatStates.alpha.setup.customFieldStates.SANITY).toBe(true);
        expect(settings.chatStates.alpha.setup.customFields).toBeUndefined();

        removeChatSetupCatalogEntries(settings, {
            customFieldTags: ['SANITY'],
            syspromptIds: ['grim'],
            gameSystemIds: ['system-1'],
        });
        expect(settings.trackerModuleDatabase).toEqual([]);
        expect(settings.syspromptSnippetDatabase).toEqual([]);
        expect(settings.gameSystemDatabase).toEqual([]);
        expect(settings.chatStates.alpha.setup.customFieldStates.SANITY).toBeUndefined();
    });

    it('updates catalog definitions when an existing live item is edited', () => {
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.customFields = [{ tag: 'SANITY', label: 'Sanity', prompt: 'Old tracker prompt', enabled: true }];
        settings.customSyspromptLibrary = [{ id: 'grim', tag: 'tone', content: 'Old snippet', enabled: true }];
        syncChatSetupCatalogs(settings);

        settings.customFields[0].prompt = 'Revised tracker prompt';
        settings.customSyspromptLibrary[0].content = 'Revised snippet';
        syncChatSetupCatalogs(settings);

        expect(settings.trackerModuleDatabase[0].prompt).toBe('Revised tracker prompt');
        expect(settings.syspromptSnippetDatabase[0].content).toBe('Revised snippet');
    });

    it('keeps Global activation outside chat snapshots', () => {
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.customFields = [{
            tag: 'WEATHER',
            label: 'Weather',
            enabled: true,
            scope: 'global',
        }];
        settings.customSyspromptLibrary = [{
            id: 'weather-rules',
            tag: 'weather_rules',
            content: 'Track the weather.',
            enabled: true,
            scope: 'global',
        }];

        const chatA = snapshotChatSetup(settings);
        expect(chatA.customFieldStates).not.toHaveProperty('WEATHER');
        expect(chatA.syspromptSnippetStates).not.toHaveProperty('weather-rules');

        setChatSetupItemEnabled(settings, 'customField', settings.customFields[0], false);
        setChatSetupItemEnabled(settings, 'syspromptSnippet', settings.customSyspromptLibrary[0], false);
        syncChatSetupCatalogs(settings);
        expect(applyChatSetup(settings, chatA)).toBe(true);
        expect(settings.customFields[0].enabled).toBe(false);
        expect(settings.customSyspromptLibrary[0].enabled).toBe(false);

        setChatSetupItemEnabled(settings, 'customField', settings.customFields[0], true);
        setChatSetupItemEnabled(settings, 'syspromptSnippet', settings.customSyspromptLibrary[0], true);
        syncChatSetupCatalogs(settings);
        resetChatSetupToStock(settings);
        expect(settings.customFields[0].enabled).toBe(true);
        expect(settings.customSyspromptLibrary[0].enabled).toBe(true);
    });

    it('combines shared Global state with per-chat activation', () => {
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.customFields = [
            { tag: 'SANITY', label: 'Sanity', enabled: true, scope: 'chat' },
            { tag: 'WEATHER', label: 'Weather', enabled: true, scope: 'global' },
        ];
        const chatA = snapshotChatSetup(settings);

        setChatSetupItemEnabled(settings, 'customField', settings.customFields[0], false);
        setChatSetupItemEnabled(settings, 'customField', settings.customFields[1], false);
        snapshotChatSetup(settings);

        applyChatSetup(settings, chatA);
        expect(settings.customFields.find(item => item.tag === 'SANITY')?.enabled).toBe(true);
        expect(settings.customFields.find(item => item.tag === 'WEATHER')?.enabled).toBe(false);
    });

    it('clears chat-bound activations for an unseen chat while keeping GLOBAL and Narrator config', () => {
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.narrativePacing = 'high_agency';
        settings.syspromptModules = { ...settings.syspromptModules, loot: false, CYOA_mode: true };
        settings.gameSystems = [
            {
                id: 'stress-system',
                name: 'Stress',
                enabled: true,
                scope: 'chat',
                customFieldTag: 'STRESS',
                syspromptLibraryId: 'stress-rules',
            },
            {
                id: 'weather-system',
                name: 'Weather',
                enabled: true,
                scope: 'global',
                customFieldTag: 'WEATHER',
                syspromptLibraryId: 'weather-rules',
            },
        ];
        settings.customFields = [
            { tag: 'STRESS', label: 'Stress', enabled: true, scope: 'chat', origin: 'wizard' },
            { tag: 'WEATHER', label: 'Weather', enabled: true, scope: 'global', origin: 'wizard' },
            { tag: 'SANITY', label: 'Sanity', enabled: true, scope: 'chat' },
        ];
        settings.customSyspromptLibrary = [
            { id: 'stress-rules', tag: 'stress_rules', content: 'Apply stress.', enabled: true, scope: 'chat', origin: 'wizard' },
            { id: 'weather-rules', tag: 'weather_rules', content: 'Track weather.', enabled: true, scope: 'global', origin: 'wizard' },
            { id: 'grim', tag: 'tone', content: 'Grim', enabled: true, scope: 'chat' },
        ];
        syncChatSetupCatalogs(settings);

        expect(clearChatBoundActivations(settings)).toBe(true);

        expect(settings.narrativePacing).toBe('high_agency');
        expect(settings.syspromptModules.loot).toBe(false);
        expect(settings.syspromptModules.CYOA_mode).toBe(true);

        expect(settings.gameSystems.find(gs => gs.id === 'stress-system')?.enabled).toBe(false);
        expect(settings.customFields.find(f => f.tag === 'STRESS')?.enabled).toBe(false);
        expect(settings.customSyspromptLibrary.find(s => s.id === 'stress-rules')?.enabled).toBe(false);
        expect(settings.customFields.find(f => f.tag === 'SANITY')?.enabled).toBe(false);
        expect(settings.customSyspromptLibrary.find(s => s.id === 'grim')?.enabled).toBe(false);

        expect(settings.gameSystems.find(gs => gs.id === 'weather-system')?.enabled).toBe(true);
        expect(settings.customFields.find(f => f.tag === 'WEATHER')?.enabled).toBe(true);
        expect(settings.customSyspromptLibrary.find(s => s.id === 'weather-rules')?.enabled).toBe(true);
    });

    it('makes a Wizard Game System authoritative for both linked children', () => {
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.gameSystems = [{
            id: 'stress-system',
            name: 'Stress',
            enabled: true,
            scope: 'global',
            customFieldTag: 'STRESS',
            syspromptLibraryId: 'stress-rules',
        }];
        settings.customFields = [{
            tag: 'STRESS',
            label: 'Stress',
            enabled: false,
            scope: 'chat',
            origin: 'wizard',
        }];
        settings.customSyspromptLibrary = [{
            id: 'stress-rules',
            tag: 'stress_rules',
            content: 'Apply stress.',
            enabled: false,
            scope: 'chat',
            origin: 'wizard',
        }];

        const setup = snapshotChatSetup(settings);
        const gameSystem = settings.gameSystems[0];
        const field = settings.customFields[0];
        const snippet = settings.customSyspromptLibrary[0];
        expect(getChatSetupScopeOwner(settings, 'customField', field)).toBe(gameSystem);
        expect(getChatSetupItemScope(settings, 'customField', field)).toBe('global');
        expect(field.enabled).toBe(true);
        expect(snippet.enabled).toBe(true);
        expect(setup.gameSystemStates).not.toHaveProperty('stress-system');
        expect(setup.customFieldStates).not.toHaveProperty('STRESS');
        expect(setup.syspromptSnippetStates).not.toHaveProperty('stress-rules');

        setChatSetupItemEnabled(settings, 'syspromptSnippet', snippet, false);
        expect(gameSystem.enabled).toBe(false);
        expect(field.enabled).toBe(false);
        expect(snippet.enabled).toBe(false);

        setChatSetupItemScope(settings, 'customField', field, 'chat');
        expect(gameSystem.scope).toBe('chat');
        expect(field.scope).toBe('chat');
        expect(snippet.scope).toBe('chat');
    });

    it('applies the first scope change even when a newly rendered row holds a pre-sync object', () => {
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.customFields = [{
            tag: 'MORALE',
            label: 'Morale',
            enabled: true,
            scope: 'chat',
        }];

        const renderedFieldReference = settings.customFields[0];
        syncChatSetupCatalogs(settings);
        expect(settings.customFields[0]).not.toBe(renderedFieldReference);

        setChatSetupItemScope(settings, 'customField', renderedFieldReference, 'global');
        expect(settings.customFields[0].scope).toBe('global');

        syncChatSetupCatalogs(settings);
        expect(settings.trackerModuleDatabase[0].scope).toBe('global');
        expect(settings.trackerModuleDatabase[0].globalEnabled).toBe(true);
    });

    it('rename after catalog sync must mutate the live field — orphan+remove deletes the module', () => {
        // Reproduces Custom Module Editor + alt-tab: syncChatSetupCatalogs reclones
        // customFields, so a closed-over editor reference becomes an orphan. Mutating
        // the orphan then removeChatSetupCatalogEntries(oldTag) strips the live entry.
        const settings = buildDefaultSettings();
        migrateChatSetupCatalogs(settings);
        settings.customFields = [{
            tag: 'FOO',
            label: 'Foo',
            prompt: 'track foo',
            template: 'Foo: 1',
            enabled: true,
        }];
        settings.blockOrder = ['CHARACTER', 'FOO'];
        syncChatSetupCatalogs(settings);

        const orphan = settings.customFields[0];
        syncChatSetupCatalogs(settings); // alt-tab / saveSettings flush
        expect(settings.customFields[0]).not.toBe(orphan);

        // Broken path (pre-fix): mutate orphan, then prune FOO from live catalogs.
        orphan.tag = 'BAR';
        orphan.prompt = 'revised';
        removeChatSetupCatalogEntries(settings, { customFieldTags: ['FOO'] });
        expect(settings.customFields.map(f => f.tag)).toEqual([]);

        // Correct path: re-resolve by opened tag, rename live object, then prune.
        settings.customFields = [{
            tag: 'FOO',
            label: 'Foo',
            prompt: 'track foo',
            template: 'Foo: 1',
            enabled: true,
        }];
        settings.blockOrder = ['CHARACTER', 'FOO'];
        syncChatSetupCatalogs(settings);
        const openedTag = 'FOO';
        syncChatSetupCatalogs(settings);
        const liveIndex = settings.customFields.findIndex(f => f.tag === openedTag);
        const liveField = settings.customFields[liveIndex];
        liveField.tag = 'BAR';
        liveField.prompt = 'revised';
        removeChatSetupCatalogEntries(settings, { customFieldTags: ['FOO'] });
        expect(settings.customFields.map(f => f.tag)).toEqual(['BAR']);
        expect(settings.customFields[0].prompt).toBe('revised');
        syncChatSetupCatalogs(settings);
        expect(settings.trackerModuleDatabase.map(f => f.tag)).toEqual(['BAR']);
        expect(settings.trackerModuleDatabase[0].prompt).toBe('revised');
    });
});
