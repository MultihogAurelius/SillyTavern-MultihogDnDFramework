/** Stable sysprompt tag. UI copy says Persistent Maps; do not rename this key. */
export const LOCATION_MAPPING_SECTION_TAG = 'dungeon_reality_and_hidden_mapping';

/** Whether a built-in (non-unlocked) base section is currently enabled. */
export function isBaseSectionEnabled(tag, settings) {
    if (tag === 'relationship_tracking') return !!settings.npcRelationshipBars;
    const mods = settings.syspromptModules || {};
    if (tag === 'CYOA_mode') return mods.CYOA_mode === true;
    return mods[tag] !== false;
}

/** Returns the unlocked override that belongs to the current chat/setup. */
export function findActiveUnlockedBaseOverride(library, tag) {
    return (library || []).find(p =>
        p.origin === 'unlocked_base' && p.baseTag === tag && p._chatSetupMember !== false,
    ) || null;
}

/** Whether the section that actually occupies a base slot is currently enabled. */
export function isEffectiveSectionEnabled(tag, settings) {
    const override = findActiveUnlockedBaseOverride(settings.customSyspromptLibrary, tag);
    return override ? !!override.enabled : isBaseSectionEnabled(tag, settings);
}

/**
 * Runtime kill switch for Map Architect, Map Updater, CreateAreaMap, and mapped-site UI.
 * Follows the Components / Control Room enable flag and the master tracker toggle.
 */
export function isLocationMappingEnabled(settings) {
    if (!settings?.enabled) return false;
    return isEffectiveSectionEnabled(LOCATION_MAPPING_SECTION_TAG, settings);
}

/** Keep the Components checkbox and any unlocked override in lockstep. */
export function setLocationMappingEnabled(enabled, settings) {
    if (!settings) return;
    if (!settings.syspromptModules) settings.syspromptModules = {};
    settings.syspromptModules[LOCATION_MAPPING_SECTION_TAG] = !!enabled;
    const override = findActiveUnlockedBaseOverride(settings.customSyspromptLibrary, LOCATION_MAPPING_SECTION_TAG);
    if (override) override.enabled = !!enabled;
}
