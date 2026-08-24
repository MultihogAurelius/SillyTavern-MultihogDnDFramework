/**
 * Shared Multihog agent connection setups (source / profile / ollama / openai / preset).
 * Used by Connections & Models "Apply to All". Combat API Override is intentionally excluded.
 */

/** Canonical snapshot field names shared by every agent-shaped connection. */
export const CONNECTION_SETUP_FIELD_KEYS = [
    'connectionSource',
    'connectionProfileId',
    'completionPresetId',
    'ollamaUrl',
    'ollamaModel',
    'openaiUrl',
    'openaiKey',
    'openaiModel',
];

/**
 * @typedef {{
 *   key: string,
 *   label: string,
 *   settingsKeys: Record<string, string>,
 *   ui: {
 *     source: string,
 *     profile: string,
 *     preset: string,
 *     ollamaUrl: string,
 *     ollamaModel: string,
 *     openaiUrl: string,
 *     openaiKey: string,
 *     openaiModel: string,
 *     openaiManual: string,
 *     profileGroup: string,
 *     ollamaGroup: string,
 *     openaiGroup: string,
 *   },
 * }} AgentConnectionSetupDef
 */

/** @type {AgentConnectionSetupDef[]} */
export const AGENT_CONNECTION_SETUPS = [
    {
        key: 'state_tracker',
        label: 'State Tracker',
        settingsKeys: {
            connectionSource: 'connectionSource',
            connectionProfileId: 'connectionProfileId',
            completionPresetId: 'completionPresetId',
            ollamaUrl: 'ollamaUrl',
            ollamaModel: 'ollamaModel',
            openaiUrl: 'openaiUrl',
            openaiKey: 'openaiKey',
            openaiModel: 'openaiModel',
        },
        ui: {
            source: '#rpg_tracker_connection_source',
            profile: '#rpg_tracker_connection_profile',
            preset: '#rpg_tracker_completion_preset',
            ollamaUrl: '#rpg_tracker_ollama_url',
            ollamaModel: '#rpg_tracker_ollama_model',
            openaiUrl: '#rpg_tracker_openai_url',
            openaiKey: '#rpg_tracker_openai_key',
            openaiModel: '#rpg_tracker_openai_model',
            openaiManual: '#rpg_tracker_openai_model_manual',
            profileGroup: '#rpg_tracker_profile_group',
            ollamaGroup: '#rpg_tracker_ollama_group',
            openaiGroup: '#rpg_tracker_openai_group',
        },
    },
    {
        key: 'lorebook_agent',
        label: 'Lorebook Agent',
        settingsKeys: {
            connectionSource: 'routerConnectionSource',
            connectionProfileId: 'routerConnectionProfileId',
            completionPresetId: 'routerCompletionPresetId',
            ollamaUrl: 'routerOllamaUrl',
            ollamaModel: 'routerOllamaModel',
            openaiUrl: 'routerOpenaiUrl',
            openaiKey: 'routerOpenaiKey',
            openaiModel: 'routerOpenaiModel',
        },
        ui: {
            source: '#rpg_tracker_router_source',
            profile: '#rpg_tracker_router_connection_profile',
            preset: '#rpg_tracker_router_completion_preset',
            ollamaUrl: '#rpg_tracker_router_ollama_url',
            ollamaModel: '#rpg_tracker_router_ollama_model',
            openaiUrl: '#rpg_tracker_router_openai_url',
            openaiKey: '#rpg_tracker_router_openai_key',
            openaiModel: '#rpg_tracker_router_openai_model',
            openaiManual: '#rpg_tracker_router_openai_model_manual',
            profileGroup: '#rpg_tracker_router_profile_group',
            ollamaGroup: '#rpg_tracker_router_ollama_group',
            openaiGroup: '#rpg_tracker_router_openai_group',
        },
    },
    {
        key: 'character_creation',
        label: 'Character Creation & Starting Modes',
        settingsKeys: {
            connectionSource: 'characterCreationConnectionSource',
            connectionProfileId: 'characterCreationConnectionProfileId',
            completionPresetId: 'characterCreationCompletionPresetId',
            ollamaUrl: 'characterCreationOllamaUrl',
            ollamaModel: 'characterCreationOllamaModel',
            openaiUrl: 'characterCreationOpenaiUrl',
            openaiKey: 'characterCreationOpenaiKey',
            openaiModel: 'characterCreationOpenaiModel',
        },
        ui: {
            source: '#rt-character-creation-connection-source',
            profile: '#rt-character-creation-connection-profile',
            preset: '#rt-character-creation-completion-preset',
            ollamaUrl: '#rt-character-creation-ollama-url',
            ollamaModel: '#rt-character-creation-ollama-model',
            openaiUrl: '#rt-character-creation-openai-url',
            openaiKey: '#rt-character-creation-openai-key',
            openaiModel: '#rt-character-creation-openai-model',
            openaiManual: '#rt-character-creation-openai-model-manual',
            profileGroup: '#rt-character-creation-profile-group',
            ollamaGroup: '#rt-character-creation-ollama-group',
            openaiGroup: '#rt-character-creation-openai-group',
        },
    },
    {
        key: 'adventure_companion',
        label: 'Adventure Companion',
        settingsKeys: {
            connectionSource: 'adventureCompanionConnectionSource',
            connectionProfileId: 'adventureCompanionConnectionProfileId',
            completionPresetId: 'adventureCompanionCompletionPresetId',
            ollamaUrl: 'adventureCompanionOllamaUrl',
            ollamaModel: 'adventureCompanionOllamaModel',
            openaiUrl: 'adventureCompanionOpenaiUrl',
            openaiKey: 'adventureCompanionOpenaiKey',
            openaiModel: 'adventureCompanionOpenaiModel',
        },
        ui: {
            source: '#rpg_adventure_companion_connection_source',
            profile: '#rpg_adventure_companion_connection_profile',
            preset: '#rpg_adventure_companion_completion_preset',
            ollamaUrl: '#rpg_adventure_companion_ollama_url',
            ollamaModel: '#rpg_adventure_companion_ollama_model',
            openaiUrl: '#rpg_adventure_companion_openai_url',
            openaiKey: '#rpg_adventure_companion_openai_key',
            openaiModel: '#rpg_adventure_companion_openai_model',
            openaiManual: '#rpg_adventure_companion_openai_model_manual',
            profileGroup: '#rpg_adventure_companion_profile_group',
            ollamaGroup: '#rpg_adventure_companion_ollama_group',
            openaiGroup: '#rpg_adventure_companion_openai_group',
        },
    },
    {
        key: 'game_system_wizard',
        label: 'Game System Wizard',
        settingsKeys: {
            connectionSource: 'gameSystemWizardConnectionSource',
            connectionProfileId: 'gameSystemWizardConnectionProfileId',
            completionPresetId: 'gameSystemWizardCompletionPresetId',
            ollamaUrl: 'gameSystemWizardOllamaUrl',
            ollamaModel: 'gameSystemWizardOllamaModel',
            openaiUrl: 'gameSystemWizardOpenaiUrl',
            openaiKey: 'gameSystemWizardOpenaiKey',
            openaiModel: 'gameSystemWizardOpenaiModel',
        },
        ui: {
            source: '#rpg_gs_wizard_connection_source',
            profile: '#rpg_gs_wizard_connection_profile',
            preset: '#rpg_gs_wizard_completion_preset',
            ollamaUrl: '#rpg_gs_wizard_ollama_url',
            ollamaModel: '#rpg_gs_wizard_ollama_model',
            openaiUrl: '#rpg_gs_wizard_openai_url',
            openaiKey: '#rpg_gs_wizard_openai_key',
            openaiModel: '#rpg_gs_wizard_openai_model',
            openaiManual: '#rpg_gs_wizard_openai_model_manual',
            profileGroup: '#rpg_gs_wizard_profile_group',
            ollamaGroup: '#rpg_gs_wizard_ollama_group',
            openaiGroup: '#rpg_gs_wizard_openai_group',
        },
    },
    {
        key: 'map_architect',
        label: 'Map Architect',
        settingsKeys: {
            connectionSource: 'mapArchitectConnectionSource',
            connectionProfileId: 'mapArchitectConnectionProfileId',
            completionPresetId: 'mapArchitectCompletionPresetId',
            ollamaUrl: 'mapArchitectOllamaUrl',
            ollamaModel: 'mapArchitectOllamaModel',
            openaiUrl: 'mapArchitectOpenaiUrl',
            openaiKey: 'mapArchitectOpenaiKey',
            openaiModel: 'mapArchitectOpenaiModel',
        },
        ui: {
            source: '#rpg_map_architect_connection_source',
            profile: '#rpg_map_architect_connection_profile',
            preset: '#rpg_map_architect_completion_preset',
            ollamaUrl: '#rpg_map_architect_ollama_url',
            ollamaModel: '#rpg_map_architect_ollama_model',
            openaiUrl: '#rpg_map_architect_openai_url',
            openaiKey: '#rpg_map_architect_openai_key',
            openaiModel: '#rpg_map_architect_openai_model',
            openaiManual: '#rpg_map_architect_openai_model_manual',
            profileGroup: '#rpg_map_architect_profile_group',
            ollamaGroup: '#rpg_map_architect_ollama_group',
            openaiGroup: '#rpg_map_architect_openai_group',
        },
    },
    {
        key: 'map_runtime',
        label: 'Map Updater & Evolution',
        settingsKeys: {
            connectionSource: 'mapRuntimeConnectionSource',
            connectionProfileId: 'mapRuntimeConnectionProfileId',
            completionPresetId: 'mapRuntimeCompletionPresetId',
            ollamaUrl: 'mapRuntimeOllamaUrl',
            ollamaModel: 'mapRuntimeOllamaModel',
            openaiUrl: 'mapRuntimeOpenaiUrl',
            openaiKey: 'mapRuntimeOpenaiKey',
            openaiModel: 'mapRuntimeOpenaiModel',
        },
        ui: {
            source: '#rpg_map_runtime_connection_source',
            profile: '#rpg_map_runtime_connection_profile',
            preset: '#rpg_map_runtime_completion_preset',
            ollamaUrl: '#rpg_map_runtime_ollama_url',
            ollamaModel: '#rpg_map_runtime_ollama_model',
            openaiUrl: '#rpg_map_runtime_openai_url',
            openaiKey: '#rpg_map_runtime_openai_key',
            openaiModel: '#rpg_map_runtime_openai_model',
            openaiManual: '#rpg_map_runtime_openai_model_manual',
            profileGroup: '#rpg_map_runtime_profile_group',
            ollamaGroup: '#rpg_map_runtime_ollama_group',
            openaiGroup: '#rpg_map_runtime_openai_group',
        },
    },
    {
        key: 'world_progression',
        label: 'World Progression',
        settingsKeys: {
            connectionSource: 'worldConnectionSource',
            connectionProfileId: 'worldConnectionProfileId',
            completionPresetId: 'worldCompletionPresetId',
            ollamaUrl: 'worldOllamaUrl',
            ollamaModel: 'worldOllamaModel',
            openaiUrl: 'worldOpenaiUrl',
            openaiKey: 'worldOpenaiKey',
            openaiModel: 'worldOpenaiModel',
        },
        ui: {
            source: '#rpg_world_connection_source',
            profile: '#rpg_world_connection_profile',
            preset: '#rpg_world_completion_preset',
            ollamaUrl: '#rpg_world_ollama_url',
            ollamaModel: '#rpg_world_ollama_model',
            openaiUrl: '#rpg_world_openai_url',
            openaiKey: '#rpg_world_openai_key',
            openaiModel: '#rpg_world_openai_model',
            openaiManual: '#rpg_world_openai_model_manual',
            profileGroup: '#rpg_world_profile_group',
            ollamaGroup: '#rpg_world_ollama_group',
            openaiGroup: '#rpg_world_openai_group',
        },
    },
    {
        key: 'portraits',
        label: 'Portrait Generation',
        settingsKeys: {
            connectionSource: 'portraitConnectionSource',
            connectionProfileId: 'portraitConnectionProfileId',
            completionPresetId: 'portraitCompletionPresetId',
            ollamaUrl: 'portraitOllamaUrl',
            ollamaModel: 'portraitOllamaModel',
            openaiUrl: 'portraitOpenaiUrl',
            openaiKey: 'portraitOpenaiKey',
            openaiModel: 'portraitOpenaiModel',
        },
        ui: {
            source: '#rpg_portrait_connection_source',
            profile: '#rpg_portrait_connection_profile',
            preset: '#rpg_portrait_completion_preset',
            ollamaUrl: '#rpg_portrait_ollama_url',
            ollamaModel: '#rpg_portrait_ollama_model',
            openaiUrl: '#rpg_portrait_openai_url',
            openaiKey: '#rpg_portrait_openai_key',
            openaiModel: '#rpg_portrait_openai_model',
            openaiManual: '#rpg_portrait_openai_model_manual',
            profileGroup: '#rpg_portrait_profile_group',
            ollamaGroup: '#rpg_portrait_ollama_group',
            openaiGroup: '#rpg_portrait_openai_group',
        },
    },
];

/** @param {string} key */
export function findAgentConnectionSetup(key) {
    return AGENT_CONNECTION_SETUPS.find((entry) => entry.key === key) || null;
}

/**
 * @param {Record<string, any>} settings
 * @param {string} key
 * @returns {Record<string, string>|null}
 */
export function readConnectionSetup(settings, key) {
    const def = findAgentConnectionSetup(key);
    if (!def || !settings) return null;
    /** @type {Record<string, string>} */
    const snapshot = {};
    for (const field of CONNECTION_SETUP_FIELD_KEYS) {
        const settingsKey = def.settingsKeys[field];
        const raw = settings[settingsKey];
        if (field === 'connectionSource') {
            snapshot[field] = String(raw || 'default');
        } else if (field === 'ollamaUrl') {
            snapshot[field] = String(raw || 'http://localhost:11434');
        } else {
            snapshot[field] = String(raw ?? '');
        }
    }
    return snapshot;
}

/**
 * @param {Record<string, any>} settings
 * @param {string} key
 * @param {Record<string, string>} snapshot
 */
export function writeConnectionSetup(settings, key, snapshot) {
    const def = findAgentConnectionSetup(key);
    if (!def || !settings || !snapshot) return;
    for (const field of CONNECTION_SETUP_FIELD_KEYS) {
        const settingsKey = def.settingsKeys[field];
        if (field === 'connectionSource') {
            settings[settingsKey] = String(snapshot.connectionSource || 'default');
        } else if (field === 'ollamaUrl') {
            settings[settingsKey] = String(snapshot.ollamaUrl || 'http://localhost:11434');
        } else {
            settings[settingsKey] = String(snapshot[field] ?? '');
        }
    }
}

/**
 * Copy one agent connection setup onto every Multihog agent slot.
 * Does not touch Combat API Override.
 *
 * @param {Record<string, any>} settings
 * @param {string} sourceKey
 * @returns {{ sourceKey: string, sourceLabel: string, appliedCount: number, targets: string[] }|null}
 */
export function applyConnectionSetupToAll(settings, sourceKey) {
    const source = findAgentConnectionSetup(sourceKey);
    const snapshot = readConnectionSetup(settings, sourceKey);
    if (!source || !snapshot) return null;

    /** @type {string[]} */
    const targets = [];
    for (const def of AGENT_CONNECTION_SETUPS) {
        if (def.key === sourceKey) continue;
        writeConnectionSetup(settings, def.key, snapshot);
        targets.push(def.key);
    }

    return {
        sourceKey,
        sourceLabel: source.label,
        appliedCount: targets.length,
        targets,
    };
}
