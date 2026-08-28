import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    AGENT_CONNECTION_SETUPS,
    applyConnectionSetupToAll,
    findAgentConnectionSetup,
    readConnectionSetup,
    writeConnectionSetup,
} from '../src/state/connection-setups.js';

describe('connection setup apply-to-all', () => {
    it('lists every Multihog agent connection except Combat API Override', () => {
        const keys = AGENT_CONNECTION_SETUPS.map((entry) => entry.key);
        expect(keys).toEqual([
            'state_tracker',
            'lorebook_agent',
            'character_creation',
            'adventure_companion',
            'game_system_wizard',
            'map_architect',
            'map_runtime',
            'map_evolution',
            'world_progression',
            'portraits',
        ]);
        expect(keys).not.toContain('combat_override');
        expect(findAgentConnectionSetup('state_tracker')?.label).toBe('State Tracker');
    });

    it('copies one setup onto every other agent without clearing the source', () => {
        const settings = {
            connectionSource: 'profile',
            connectionProfileId: 'profile-abc',
            completionPresetId: 'preset-1',
            ollamaUrl: 'http://localhost:11434',
            ollamaModel: '',
            openaiUrl: '',
            openaiKey: '',
            openaiModel: '',
            routerConnectionSource: 'default',
            routerConnectionProfileId: '',
            routerCompletionPresetId: '',
            routerOllamaUrl: 'http://localhost:11434',
            routerOllamaModel: '',
            routerOpenaiUrl: '',
            routerOpenaiKey: '',
            routerOpenaiModel: '',
            characterCreationConnectionSource: 'ollama',
            characterCreationConnectionProfileId: '',
            characterCreationCompletionPresetId: '',
            characterCreationOllamaUrl: 'http://localhost:9999',
            characterCreationOllamaModel: 'old',
            characterCreationOpenaiUrl: '',
            characterCreationOpenaiKey: '',
            characterCreationOpenaiModel: '',
            adventureCompanionConnectionSource: 'default',
            adventureCompanionConnectionProfileId: '',
            adventureCompanionCompletionPresetId: '',
            adventureCompanionOllamaUrl: 'http://localhost:11434',
            adventureCompanionOllamaModel: '',
            adventureCompanionOpenaiUrl: '',
            adventureCompanionOpenaiKey: '',
            adventureCompanionOpenaiModel: '',
            gameSystemWizardConnectionSource: 'default',
            gameSystemWizardConnectionProfileId: '',
            gameSystemWizardCompletionPresetId: '',
            gameSystemWizardOllamaUrl: 'http://localhost:11434',
            gameSystemWizardOllamaModel: '',
            gameSystemWizardOpenaiUrl: '',
            gameSystemWizardOpenaiKey: '',
            gameSystemWizardOpenaiModel: '',
            mapArchitectConnectionSource: 'default',
            mapArchitectConnectionProfileId: '',
            mapArchitectCompletionPresetId: '',
            mapArchitectOllamaUrl: 'http://localhost:11434',
            mapArchitectOllamaModel: '',
            mapArchitectOpenaiUrl: '',
            mapArchitectOpenaiKey: '',
            mapArchitectOpenaiModel: '',
            mapRuntimeConnectionSource: 'default',
            mapRuntimeConnectionProfileId: '',
            mapRuntimeCompletionPresetId: '',
            mapRuntimeOllamaUrl: 'http://localhost:11434',
            mapRuntimeOllamaModel: '',
            mapRuntimeOpenaiUrl: '',
            mapRuntimeOpenaiKey: '',
            mapRuntimeOpenaiModel: '',
            mapEvolutionConnectionSource: 'default',
            mapEvolutionConnectionProfileId: '',
            mapEvolutionCompletionPresetId: '',
            mapEvolutionOllamaUrl: 'http://localhost:11434',
            mapEvolutionOllamaModel: '',
            mapEvolutionOpenaiUrl: '',
            mapEvolutionOpenaiKey: '',
            mapEvolutionOpenaiModel: '',
            worldConnectionSource: 'default',
            worldConnectionProfileId: '',
            worldCompletionPresetId: '',
            worldOllamaUrl: 'http://localhost:11434',
            worldOllamaModel: '',
            worldOpenaiUrl: '',
            worldOpenaiKey: '',
            worldOpenaiModel: '',
            portraitConnectionSource: 'default',
            portraitConnectionProfileId: '',
            portraitCompletionPresetId: '',
            portraitOllamaUrl: 'http://localhost:11434',
            portraitOllamaModel: '',
            portraitOpenaiUrl: '',
            portraitOpenaiKey: '',
            portraitOpenaiModel: '',
            combatConnectionProfileId: 'combat-keep',
            combatCompletionPresetId: 'combat-preset-keep',
            combatProfileAutoSwitch: true,
        };

        const result = applyConnectionSetupToAll(settings, 'state_tracker');
        expect(result?.appliedCount).toBe(AGENT_CONNECTION_SETUPS.length - 1);
        expect(result?.sourceLabel).toBe('State Tracker');
        expect(settings.connectionSource).toBe('profile');
        expect(settings.connectionProfileId).toBe('profile-abc');
        expect(settings.routerConnectionSource).toBe('profile');
        expect(settings.routerConnectionProfileId).toBe('profile-abc');
        expect(settings.routerCompletionPresetId).toBe('preset-1');
        expect(settings.characterCreationConnectionSource).toBe('profile');
        expect(settings.characterCreationConnectionProfileId).toBe('profile-abc');
        expect(settings.mapArchitectConnectionSource).toBe('profile');
        expect(settings.portraitCompletionPresetId).toBe('preset-1');
        expect(settings.combatConnectionProfileId).toBe('combat-keep');
        expect(settings.combatCompletionPresetId).toBe('combat-preset-keep');
        expect(settings.combatProfileAutoSwitch).toBe(true);
    });

    it('round-trips read/write for character creation fields', () => {
        const settings = {};
        writeConnectionSetup(settings, 'character_creation', {
            connectionSource: 'openai',
            connectionProfileId: '',
            completionPresetId: 'p1',
            ollamaUrl: 'http://localhost:11434',
            ollamaModel: '',
            openaiUrl: 'https://api.example',
            openaiKey: 'secret',
            openaiModel: 'gpt-test',
        });
        expect(readConnectionSetup(settings, 'character_creation')).toEqual({
            connectionSource: 'openai',
            connectionProfileId: '',
            completionPresetId: 'p1',
            ollamaUrl: 'http://localhost:11434',
            ollamaModel: '',
            openaiUrl: 'https://api.example',
            openaiKey: 'secret',
            openaiModel: 'gpt-test',
        });
    });

    it('exposes Apply to All controls under Connections & Models', () => {
        const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        const connectionsStart = settingsMarkup.indexOf('id="rpg_connections_models_drawer"');
        const connectionsEnd = settingsMarkup.indexOf('<!-- SUB-DRAWER 3: GAME SYSTEMS', connectionsStart);
        const connectionsMarkup = settingsMarkup.slice(connectionsStart, connectionsEnd);

        expect(connectionsMarkup).toContain('id="rpg_connection_apply_all_box"');
        expect(connectionsMarkup).toContain('id="rpg_connection_apply_all_source"');
        expect(connectionsMarkup).toContain('id="rpg_connection_apply_all_btn"');
        expect(connectionsMarkup).toContain('Apply Connection Setup to All');
        expect(connectionsMarkup.indexOf('rpg_connection_slot_portraits'))
            .toBeLessThan(connectionsMarkup.indexOf('rpg_connection_apply_all_box'));
        expect(indexSource).toContain('bindConnectionApplyAllControls()');
        expect(indexSource).toContain('applyConnectionSetupToAll');
    });
});
