function clonePortraitMap(map) {
    return map && typeof map === 'object'
        ? JSON.parse(JSON.stringify(map))
        : {};
}

/**
 * Decide whether a late portrait/location write should touch the live maps.
 * Background image jobs (especially AI Horde) can outlive a chat switch; a pinned
 * passChatId that no longer matches the live chat must write the departing
 * chat's partition only.
 *
 * @param {string|null|undefined} liveChatId
 * @param {string|null|undefined} passChatId
 * @returns {'live'|'partition'}
 */
export function portraitWriteMode(liveChatId, passChatId) {
    if (passChatId == null || String(passChatId).length === 0) return 'live';
    if (liveChatId == null || String(liveChatId).length === 0) return 'partition';
    return String(passChatId) === String(liveChatId) ? 'live' : 'partition';
}

/**
 * Snapshot the live portrait and location-image maps into one chat partition.
 * Portrait ownership is always per-chat, independently of the broader Chat Link toggle.
 */
export function snapshotPortraitMapsForChat(settings, chatId) {
    if (!settings || !chatId) return false;
    if (!settings.chatStates || typeof settings.chatStates !== 'object') settings.chatStates = {};
    const partition = settings.chatStates[chatId] || {};
    partition.customPortraits = clonePortraitMap(settings.customPortraits);
    partition.customLocationImages = clonePortraitMap(settings.customLocationImages);
    settings.chatStates[chatId] = partition;
    return true;
}

/** Replace the live image maps with the selected chat's maps. An unseen chat starts empty. */
export function loadPortraitMapsForChat(settings, chatId) {
    if (!settings || !chatId) return false;
    const partition = settings.chatStates?.[chatId];
    settings.customPortraits = clonePortraitMap(partition?.customPortraits);
    settings.customLocationImages = clonePortraitMap(partition?.customLocationImages);
    return !!partition;
}

/** Preserve legacy top-level maps under the active chat once before strict partition loading. */
export function migrateLegacyPortraitMapsToChat(settings, chatId) {
    if (!settings || !chatId || Number(settings.portraitChatScopeVersion) >= 1) return false;
    if (!settings.chatStates || typeof settings.chatStates !== 'object') settings.chatStates = {};
    const partition = settings.chatStates[chatId] || {};
    if (!Object.prototype.hasOwnProperty.call(partition, 'customPortraits')) {
        partition.customPortraits = clonePortraitMap(settings.customPortraits);
    }
    if (!Object.prototype.hasOwnProperty.call(partition, 'customLocationImages')) {
        partition.customLocationImages = clonePortraitMap(settings.customLocationImages);
    }
    settings.chatStates[chatId] = partition;
    settings.portraitChatScopeVersion = 1;
    return true;
}
