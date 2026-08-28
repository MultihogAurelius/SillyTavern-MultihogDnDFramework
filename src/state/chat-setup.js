/**
 * Optional per-chat System Prompt Control Room and State Tracker setup snapshots.
 *
 * Definitions live in global catalogs. A chat snapshot stores only activation
 * state, ordering, and the stock setup. This keeps modules/snippets discoverable
 * outside the chat where they were created without activating them there.
 */

import { buildDefaultSettings } from './defaults.js';

export const CHAT_SETUP_CATALOG_VERSION = 3;
export const CHAT_SETUP_SCOPE_CHAT = 'chat';
export const CHAT_SETUP_SCOPE_GLOBAL = 'global';

/** CYOA theme fields are global; choice composition and behavior remain per-chat. */
export const CYOA_VISUAL_CONFIG_KEYS = Object.freeze([
    'buttonColor',
    'buttonOpacity',
    'buttonTextColor',
    'buttonBorderColor',
    'choiceAccentColor',
    'mechColor',
    'mechBgOpacity',
    'dcColor',
    'modColor',
    'tagColor',
    'mechAccentColor',
]);

export const CHAT_SETUP_KEYS = Object.freeze([
    // System Prompt Control Room (custom definitions live in the snippet catalog)
    'syspromptSectionOrder',
    'syspromptModules',
    // Choice slots, presets, prompt, and behavior are per-chat. Visual fields
    // inside cyoaConfig are filtered out and preserved globally.
    'cyoaConfig',
    'narrativePacing',
    'npcRelationshipBars',
    'rngEnabled',
    'diceFunctionTool',
    'diceD100Mode',
    'rngToolD20',
    'rngToolD100',
    'rngQueueD20',
    'rngQueueD100',

    // State Tracker model and stock modules
    'systemPromptTemplate',
    'userPromptSuffix',
    'modules',
    'blockOrder',
    'stockPrompts',
    'modulePageSizes',
]);

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stripCyoaVisualConfig(config) {
    const copy = clone(config || {});
    for (const key of CYOA_VISUAL_CONFIG_KEYS) delete copy[key];
    return copy;
}

function getCyoaVisualConfig(config, fallback = {}) {
    const result = {};
    for (const key of CYOA_VISUAL_CONFIG_KEYS) {
        const source = Object.prototype.hasOwnProperty.call(config || {}, key) ? config : fallback;
        if (Object.prototype.hasOwnProperty.call(source || {}, key)) result[key] = clone(source[key]);
    }
    return result;
}

function customFieldKey(item) {
    return String(item?.tag || '').trim().toUpperCase();
}

function snippetKey(item) {
    return String(item?.id || '').trim();
}

function gameSystemKey(item) {
    return String(item?.id || '').trim();
}

function normalizeScope(scope) {
    return scope === CHAT_SETUP_SCOPE_GLOBAL ? CHAT_SETUP_SCOPE_GLOBAL : CHAT_SETUP_SCOPE_CHAT;
}

function normalizeScopeRecord(item) {
    if (!item || typeof item !== 'object') return item;
    item.scope = normalizeScope(item.scope);
    if (item.scope === CHAT_SETUP_SCOPE_GLOBAL && typeof item.globalEnabled !== 'boolean') {
        item.globalEnabled = typeof item.enabled === 'boolean' ? !!item.enabled : false;
    }
    return item;
}

function definitionOnly(item) {
    const copy = clone(item || {});
    normalizeScopeRecord(copy);
    if (copy.scope === CHAT_SETUP_SCOPE_GLOBAL && typeof item?.enabled === 'boolean') {
        copy.globalEnabled = !!item.enabled;
    }
    delete copy.enabled;
    delete copy._chatSetupMember;
    return copy;
}

function mergeCatalog(existing, sources, keyOf, preferExisting = true) {
    const merged = new Map();
    if (!preferExisting) {
        for (const item of Array.isArray(existing) ? existing : []) {
            const key = keyOf(item);
            if (!key) continue;
            merged.set(key, definitionOnly(item));
        }
    }
    for (const source of sources) {
        for (const item of Array.isArray(source) ? source : []) {
            const key = keyOf(item);
            if (!key) continue;
            merged.set(key, { ...(merged.get(key) || {}), ...definitionOnly(item) });
        }
    }
    if (preferExisting) {
        // Existing catalog definitions are authoritative over legacy chat snapshots.
        for (const item of Array.isArray(existing) ? existing : []) {
            const key = keyOf(item);
            if (!key) continue;
            merged.set(key, { ...(merged.get(key) || {}), ...definitionOnly(item) });
        }
    }
    return [...merged.values()];
}

function stateMap(items, keyOf) {
    const states = {};
    for (const item of Array.isArray(items) ? items : []) {
        const key = keyOf(item);
        if (key && normalizeScope(item?.scope) !== CHAT_SETUP_SCOPE_GLOBAL && item._chatSetupMember !== false) {
            states[key] = !!item.enabled;
        }
    }
    return states;
}

function hydrateCatalog(catalog, states, keyOf) {
    return (Array.isArray(catalog) ? catalog : []).map(item => {
        const key = keyOf(item);
        const scope = normalizeScope(item?.scope);
        if (scope === CHAT_SETUP_SCOPE_GLOBAL) {
            return {
                ...clone(item),
                scope,
                enabled: !!item.globalEnabled,
                _chatSetupMember: true,
            };
        }
        const member = Object.prototype.hasOwnProperty.call(states || {}, key);
        return {
            ...clone(item),
            scope,
            enabled: member ? !!states[key] : false,
            _chatSetupMember: member,
        };
    });
}

function findLinkedGameSystem(gameSystems, kind, item) {
    const systems = Array.isArray(gameSystems) ? gameSystems : [];
    if (kind === 'gameSystem') return item || null;
    if (kind === 'customField') {
        const tag = customFieldKey(item);
        return systems.find(gs => String(gs?.customFieldTag || '').trim().toUpperCase() === tag) || null;
    }
    if (kind === 'syspromptSnippet') {
        const id = snippetKey(item);
        return systems.find(gs => String(gs?.syspromptLibraryId || '').trim() === id) || null;
    }
    return null;
}

function findCurrentItem(settings, kind, item) {
    if (kind === 'gameSystem') {
        const key = gameSystemKey(item);
        return (settings?.gameSystems || []).find(candidate => gameSystemKey(candidate) === key) || item;
    }
    if (kind === 'customField') {
        const key = customFieldKey(item);
        return (settings?.customFields || []).find(candidate => customFieldKey(candidate) === key) || item;
    }
    if (kind === 'syspromptSnippet') {
        const key = snippetKey(item);
        return (settings?.customSyspromptLibrary || []).find(candidate => snippetKey(candidate) === key) || item;
    }
    return item;
}

function alignWizardCollectionScopes(gameSystems, snippets, fields, live) {
    for (const gameSystem of Array.isArray(gameSystems) ? gameSystems : []) {
        normalizeScopeRecord(gameSystem);
        const scope = gameSystem.scope;
        const enabled = live ? !!gameSystem.enabled : !!gameSystem.globalEnabled;
        const member = scope === CHAT_SETUP_SCOPE_GLOBAL ? true : gameSystem._chatSetupMember !== false;

        const snippetId = String(gameSystem.syspromptLibraryId || '').trim();
        const fieldTag = String(gameSystem.customFieldTag || '').trim().toUpperCase();
        const snippet = snippetId
            ? (snippets || []).find(item => snippetKey(item) === snippetId)
            : null;
        const field = fieldTag
            ? (fields || []).find(item => customFieldKey(item) === fieldTag)
            : null;

        for (const child of [snippet, field]) {
            if (!child) continue;
            child.scope = scope;
            if (scope === CHAT_SETUP_SCOPE_GLOBAL) child.globalEnabled = enabled;
            if (live) {
                child.enabled = !!gameSystem.enabled;
                child._chatSetupMember = member;
            }
        }
    }
}

function alignWizardScopes(settings) {
    alignWizardCollectionScopes(
        settings?.gameSystemDatabase,
        settings?.syspromptSnippetDatabase,
        settings?.trackerModuleDatabase,
        false,
    );
    alignWizardCollectionScopes(
        settings?.gameSystems,
        settings?.customSyspromptLibrary,
        settings?.customFields,
        true,
    );
}

/**
 * Resolves an item's effective scope. Wizard-created children inherit from
 * their Game System bundle; standalone items own their scope directly.
 */
export function getChatSetupItemScope(settings, kind, item) {
    const owner = findLinkedGameSystem(settings?.gameSystems, kind, item)
        || findLinkedGameSystem(settings?.gameSystemDatabase, kind, item);
    return normalizeScope(owner?.scope ?? item?.scope);
}

/** Returns the linked Game System when an item's scope is inherited. */
export function getChatSetupScopeOwner(settings, kind, item) {
    if (kind === 'gameSystem') return null;
    return findLinkedGameSystem(settings?.gameSystems, kind, item)
        || findLinkedGameSystem(settings?.gameSystemDatabase, kind, item);
}

/**
 * Changes an item's scope without changing its current enabled state. When a
 * Wizard child is passed, the owning Game System remains authoritative.
 */
export function setChatSetupItemScope(settings, kind, item, scope) {
    if (!settings || !item) return CHAT_SETUP_SCOPE_CHAT;
    const normalized = normalizeScope(scope);
    const currentItem = findCurrentItem(settings, kind, item);
    const owner = kind === 'gameSystem'
        ? currentItem
        : (getChatSetupScopeOwner(settings, kind, currentItem) || currentItem);
    owner.scope = normalized;
    owner._chatSetupMember = true;
    if (normalized === CHAT_SETUP_SCOPE_GLOBAL) owner.globalEnabled = !!owner.enabled;
    alignWizardScopes(settings);
    return normalized;
}

/**
 * Applies an enabled state to an item. Wizard children delegate to their bundle,
 * and Global items immediately update the shared catalog-facing state.
 */
export function setChatSetupItemEnabled(settings, kind, item, enabled) {
    if (!settings || !item) return false;
    const currentItem = findCurrentItem(settings, kind, item);
    const owner = kind === 'gameSystem'
        ? currentItem
        : (getChatSetupScopeOwner(settings, kind, currentItem) || currentItem);
    owner.enabled = !!enabled;
    owner._chatSetupMember = true;
    if (normalizeScope(owner.scope) === CHAT_SETUP_SCOPE_GLOBAL) {
        owner.globalEnabled = !!enabled;
    }
    alignWizardScopes(settings);
    return !!enabled;
}

function collectLegacySetupArrays(settings, field) {
    const lists = [];
    for (const snapshot of Object.values(settings?.chatStates || {})) {
        if (Array.isArray(snapshot?.setup?.[field])) lists.push(snapshot.setup[field]);
    }
    return lists;
}

function upgradeLegacySetup(setup) {
    if (!setup || typeof setup !== 'object') return;
    if (!setup.customFieldStates) setup.customFieldStates = stateMap(setup.customFields, customFieldKey);
    if (!setup.syspromptSnippetStates) setup.syspromptSnippetStates = stateMap(setup.customSyspromptLibrary, snippetKey);
    if (!setup.gameSystemStates) setup.gameSystemStates = stateMap(setup.gameSystems, gameSystemKey);
    delete setup.customFields;
    delete setup.customSyspromptLibrary;
    delete setup.gameSystems;
    // Visual theme fields used to ride inside each per-chat CYOA snapshot.
    // Choice composition remains in the partition; only its theme is stripped.
    if (setup.cyoaConfig && typeof setup.cyoaConfig === 'object') {
        setup.cyoaConfig = stripCyoaVisualConfig(setup.cyoaConfig);
    }
    setup.version = 3;
}

/**
 * One-time migration from per-chat definition arrays into global catalogs.
 * The live arrays are then hydrated with every known definition while retaining
 * the current chat's enabled flags.
 */
export function migrateChatSetupCatalogs(settings) {
    if (!settings || Number(settings.chatSetupCatalogVersion) >= CHAT_SETUP_CATALOG_VERSION) return false;

    const currentFieldStates = stateMap(settings.customFields, customFieldKey);
    const currentSnippetStates = stateMap(settings.customSyspromptLibrary, snippetKey);
    const currentGameStates = stateMap(settings.gameSystems, gameSystemKey);

    if (Number(settings.chatSetupCatalogVersion) < 1) {
        settings.trackerModuleDatabase = mergeCatalog(
            settings.trackerModuleDatabase,
            [...collectLegacySetupArrays(settings, 'customFields'), settings.customFields],
            customFieldKey,
        );
        settings.syspromptSnippetDatabase = mergeCatalog(
            settings.syspromptSnippetDatabase,
            [...collectLegacySetupArrays(settings, 'customSyspromptLibrary'), settings.customSyspromptLibrary],
            snippetKey,
        );
        settings.gameSystemDatabase = mergeCatalog(
            settings.gameSystemDatabase,
            [...collectLegacySetupArrays(settings, 'gameSystems'), settings.gameSystems],
            gameSystemKey,
        );
    }

    for (const snapshot of Object.values(settings.chatStates || {})) upgradeLegacySetup(snapshot?.setup);

    for (const collection of [
        settings.trackerModuleDatabase,
        settings.syspromptSnippetDatabase,
        settings.gameSystemDatabase,
        settings.customFields,
        settings.customSyspromptLibrary,
        settings.gameSystems,
    ]) {
        for (const item of Array.isArray(collection) ? collection : []) normalizeScopeRecord(item);
    }
    alignWizardScopes(settings);

    settings.gameSystems = hydrateCatalog(settings.gameSystemDatabase, currentGameStates, gameSystemKey);
    settings.customFields = hydrateCatalog(settings.trackerModuleDatabase, currentFieldStates, customFieldKey);
    settings.customSyspromptLibrary = hydrateCatalog(settings.syspromptSnippetDatabase, currentSnippetStates, snippetKey);
    alignWizardScopes(settings);
    settings.chatSetupCatalogVersion = CHAT_SETUP_CATALOG_VERSION;
    return true;
}

/** Merge newly created or edited live definitions into their global catalogs. */
export function syncChatSetupCatalogs(settings) {
    if (!settings) return false;
    if (Number(settings.chatSetupCatalogVersion) < CHAT_SETUP_CATALOG_VERSION) migrateChatSetupCatalogs(settings);
    alignWizardScopes(settings);
    const fieldStates = stateMap(settings.customFields, customFieldKey);
    const snippetStates = stateMap(settings.customSyspromptLibrary, snippetKey);
    const gameStates = stateMap(settings.gameSystems, gameSystemKey);
    settings.trackerModuleDatabase = mergeCatalog(settings.trackerModuleDatabase, [settings.customFields], customFieldKey, false);
    settings.syspromptSnippetDatabase = mergeCatalog(settings.syspromptSnippetDatabase, [settings.customSyspromptLibrary], snippetKey, false);
    settings.gameSystemDatabase = mergeCatalog(settings.gameSystemDatabase, [settings.gameSystems], gameSystemKey, false);
    alignWizardScopes(settings);
    settings.gameSystems = hydrateCatalog(settings.gameSystemDatabase, gameStates, gameSystemKey);
    settings.customFields = hydrateCatalog(settings.trackerModuleDatabase, fieldStates, customFieldKey);
    settings.customSyspromptLibrary = hydrateCatalog(settings.syspromptSnippetDatabase, snippetStates, snippetKey);
    alignWizardScopes(settings);
    return true;
}

/** Capture the complete chat-lockable setup from live settings. */
export function snapshotChatSetup(settings) {
    syncChatSetupCatalogs(settings);
    const setup = {
        version: 3,
        customFieldStates: stateMap(settings?.customFields, customFieldKey),
        syspromptSnippetStates: stateMap(settings?.customSyspromptLibrary, snippetKey),
        gameSystemStates: stateMap(settings?.gameSystems, gameSystemKey),
    };
    for (const key of CHAT_SETUP_KEYS) {
        setup[key] = key === 'cyoaConfig'
            ? stripCyoaVisualConfig(settings?.cyoaConfig)
            : clone(settings?.[key]);
    }
    return setup;
}

/**
 * Apply a saved setup. Missing fields are filled from factory defaults so old or
 * partial partitions cannot inherit stock configuration from the previous chat.
 * Catalog definitions absent from this chat remain visible but inactive.
 */
export function applyChatSetup(settings, setup) {
    if (!settings || !setup || typeof setup !== 'object') return false;
    if (Number(settings.chatSetupCatalogVersion) < CHAT_SETUP_CATALOG_VERSION) migrateChatSetupCatalogs(settings);
    upgradeLegacySetup(setup);

    const defaults = buildDefaultSettings();
    const globalCyoaVisuals = getCyoaVisualConfig(settings.cyoaConfig, defaults.cyoaConfig);
    for (const key of CHAT_SETUP_KEYS) {
        const value = Object.prototype.hasOwnProperty.call(setup, key) ? setup[key] : defaults[key];
        settings[key] = key === 'cyoaConfig'
            ? { ...stripCyoaVisualConfig(value), ...globalCyoaVisuals }
            : clone(value);
    }

    settings.gameSystems = hydrateCatalog(settings.gameSystemDatabase, setup.gameSystemStates, gameSystemKey);
    settings.customFields = hydrateCatalog(settings.trackerModuleDatabase, setup.customFieldStates, customFieldKey);
    settings.customSyspromptLibrary = hydrateCatalog(settings.syspromptSnippetDatabase, setup.syspromptSnippetStates, snippetKey);
    alignWizardScopes(settings);
    return true;
}

/** Reset only the Control Room / tracker setup; catalog items stay visible and inactive. */
export function resetChatSetupToStock(settings) {
    const defaults = buildDefaultSettings();
    const setup = { version: 3, customFieldStates: {}, syspromptSnippetStates: {}, gameSystemStates: {} };
    for (const key of CHAT_SETUP_KEYS) setup[key] = clone(defaults[key]);
    return applyChatSetup(settings, setup);
}

/**
 * Deactivate chat-bound catalog items for an unseen chat while keeping inherited
 * Narrator / Control Room keys and GLOBAL enablement intact.
 */
export function clearChatBoundActivations(settings) {
    if (!settings) return false;
    const setup = snapshotChatSetup(settings);
    setup.customFieldStates = {};
    setup.syspromptSnippetStates = {};
    setup.gameSystemStates = {};
    return applyChatSetup(settings, setup);
}

/**
 * Permanently remove definitions from the global catalogs and every chat's
 * activation map. Ordinary per-chat deactivation must not call this.
 */
export function removeChatSetupCatalogEntries(settings, {
    customFieldTags = [],
    syspromptIds = [],
    gameSystemIds = [],
} = {}) {
    if (!settings) return;
    const fieldKeys = new Set(customFieldTags.map(tag => String(tag || '').toUpperCase()).filter(Boolean));
    const snippetKeys = new Set(syspromptIds.map(id => String(id || '')).filter(Boolean));
    const systemKeys = new Set(gameSystemIds.map(id => String(id || '')).filter(Boolean));

    settings.trackerModuleDatabase = (settings.trackerModuleDatabase || []).filter(item => !fieldKeys.has(customFieldKey(item)));
    settings.syspromptSnippetDatabase = (settings.syspromptSnippetDatabase || []).filter(item => !snippetKeys.has(snippetKey(item)));
    settings.gameSystemDatabase = (settings.gameSystemDatabase || []).filter(item => !systemKeys.has(gameSystemKey(item)));
    settings.customFields = (settings.customFields || []).filter(item => !fieldKeys.has(customFieldKey(item)));
    settings.customSyspromptLibrary = (settings.customSyspromptLibrary || []).filter(item => !snippetKeys.has(snippetKey(item)));
    settings.gameSystems = (settings.gameSystems || []).filter(item => !systemKeys.has(gameSystemKey(item)));

    for (const snapshot of Object.values(settings.chatStates || {})) {
        const setup = snapshot?.setup;
        if (!setup) continue;
        upgradeLegacySetup(setup);
        for (const key of fieldKeys) delete setup.customFieldStates[key];
        for (const key of snippetKeys) delete setup.syspromptSnippetStates[key];
        for (const key of systemKeys) delete setup.gameSystemStates[key];
        if (Array.isArray(setup.blockOrder)) setup.blockOrder = setup.blockOrder.filter(tag => !fieldKeys.has(String(tag).toUpperCase()));
        if (Array.isArray(setup.syspromptSectionOrder)) {
            setup.syspromptSectionOrder = setup.syspromptSectionOrder.filter(key => !snippetKeys.has(String(key).replace(/^lib:/, '')));
        }
    }
}

/** Stable comparison used by the Chat Link conflict dialog. */
export function chatSetupsMatch(left, right) {
    return JSON.stringify(snapshotChatSetup(left)) === JSON.stringify(right || null);
}
