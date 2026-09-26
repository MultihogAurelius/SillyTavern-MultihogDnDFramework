import { COMPANION_BY_CHAT_KEY, MEMO_RECOVERY_KEY, localChatMapIds, removeLocalChatMapEntry } from './local-chat-map.js';

const LOCAL_CHAT_KEYS = [COMPANION_BY_CHAT_KEY, MEMO_RECOVERY_KEY];

/** IDs with Multihog data, including browser-local records without a partition. */
export function storedChatIds(settings) {
    return [...new Set([
        ...Object.keys(settings?.chatStates || {}),
        ...(settings?.routerHistory || []).map(entry => entry?.chatId).filter(Boolean),
        ...LOCAL_CHAT_KEYS.flatMap(localChatMapIds),
    ])];
}

/** SillyTavern's /api/chats/recent returns every existing chat when max is omitted. */
export function existingChatIds(recentChats) {
    if (!Array.isArray(recentChats)) throw new Error('Invalid SillyTavern chat list');
    return new Set(recentChats.map(chat => String(chat?.file_name || '').replace(/\.jsonl$/i, '')).filter(Boolean));
}

/**
 * Normalize POST /api/characters/chats (simple: true) responses.
 * ST returns `{ error: true }` (HTTP 200) when the character has no chats
 * directory yet — common for imported cards never opened. That is "no chats",
 * not a fatal inventory failure.
 * @param {unknown} chats
 * @returns {Array<{ file_id?: string }>}
 */
export function characterChatsListFromApi(chats) {
    if (Array.isArray(chats)) return chats;
    if (chats && typeof chats === 'object' && chats.error === true) return [];
    throw new Error('Invalid character chat list');
}

/** Saved IDs that are absent from a complete SillyTavern chat inventory. */
export function orphanedStoredChatIds(settings, existingIds) {
    if (!(existingIds instanceof Set)) throw new Error('Invalid SillyTavern chat inventory');
    return storedChatIds(settings).filter(id => !existingIds.has(id)).sort();
}

/** Remove every chat-keyed Multihog record for one verified deleted chat. */
export function removeDeletedChatData(settings, chatId) {
    if (!chatId) return false;
    let changed = false;
    if (Object.prototype.hasOwnProperty.call(settings.chatStates || {}, chatId)) {
        delete settings.chatStates[chatId];
        changed = true;
    }
    if (Array.isArray(settings.routerHistory)) {
        const length = settings.routerHistory.length;
        settings.routerHistory = settings.routerHistory.filter(entry => entry?.chatId !== chatId);
        changed = changed || settings.routerHistory.length !== length;
    }
    if (settings.routerCampaignPrefixOverrideAnchorChatId === chatId) {
        settings.routerCampaignPrefixOverrideAnchorChatId = '';
        settings.routerCampaignPrefixOverride = '';
        changed = true;
    }
    for (const key of LOCAL_CHAT_KEYS) changed = removeLocalChatMapEntry(key, chatId) || changed;
    return changed;
}
