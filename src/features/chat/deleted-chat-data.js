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
