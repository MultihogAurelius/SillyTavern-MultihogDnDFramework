import { bookBelongsToPrefix } from './clone-campaign-stack-utils.js';

function cleanPrefix(value) {
    return String(value || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function campaignPrefix(settings, chatId) {
    const part = settings.chatStates?.[chatId];
    if (settings.routerCampaignPrefixOverrideAnchorChatId === chatId && settings.routerCampaignPrefixOverride) {
        return cleanPrefix(settings.routerCampaignPrefixOverride);
    }
    return cleanPrefix(part?.renamedCampaignPrefix || chatId);
}

/**
 * Prefixes claimed by chats other than the deleted one. Includes a live
 * campaign-prefix override whose anchor has no chatStates partition yet —
 * otherwise Shared_* books are offered for purge while that chat still uses them.
 */
function otherClaimedPrefixes(settings, deletedChatId) {
    const prefixes = new Set();
    for (const id of Object.keys(settings?.chatStates || {})) {
        if (id === deletedChatId) continue;
        const prefix = campaignPrefix(settings, id);
        if (prefix) prefixes.add(prefix);
    }
    const override = cleanPrefix(settings?.routerCampaignPrefixOverride);
    if (!override) return prefixes;
    const anchor = String(settings?.routerCampaignPrefixOverrideAnchorChatId || '').trim();
    // Anchored: protect when another chat owns the override.
    // Legacy unanchored: override applies to the active chat — never the deleted one alone.
    if (!anchor || anchor !== deletedChatId) prefixes.add(override);
    return prefixes;
}

/**
 * Only books explicitly recorded for the deleted chat can be offered. A different
 * chat claiming the same book or campaign prefix keeps it out of the purge.
 * The server's current world-info list must be supplied; a failed lookup means
 * no deletion, rather than trusting a potentially stale browser cache.
 */
export function orphanedLorebooksForDeletedChat(settings, chatId, existingNames, protectedNames = []) {
    if (!chatId || !Array.isArray(existingNames)) return [];
    const states = settings?.chatStates || {};
    const recorded = states[chatId]?.campaignBooks;
    if (!Array.isArray(recorded) || !recorded.length) return [];
    const prefix = campaignPrefix(settings, chatId);
    if (!prefix) return [];
    const available = new Set(existingNames);
    const protectedBooks = new Set(protectedNames);
    const otherStates = Object.entries(states).filter(([id]) => id !== chatId);
    const claimedPrefixes = otherClaimedPrefixes(settings, chatId);
    return [...new Set(recorded)].filter(name =>
        typeof name === 'string'
        && available.has(name)
        && !protectedBooks.has(name)
        && bookBelongsToPrefix(name, prefix)
        && !otherStates.some(([, part]) => (part?.campaignBooks || []).includes(name))
        && ![...claimedPrefixes].some(otherPrefix => bookBelongsToPrefix(name, otherPrefix))
    );
}

/** @param {string} chatId @param {object} deps */
export async function offerOrphanedLorebookPurge(chatId, deps) {
    const names = await deps.listNames();
    const candidates = orphanedLorebooksForDeletedChat(deps.getSettings(), chatId, names, await deps.getProtectedNames?.() || []);
    if (!candidates.length) return { offered: [], deleted: [], failed: [] };
    const approved = await deps.confirm(chatId, candidates);
    if (!approved) return { offered: candidates, deleted: [], failed: [] };
    if (deps.canDelete && !await deps.canDelete(chatId)) {
        return { offered: candidates, deleted: [], failed: [] };
    }

    // The popup can remain open while another chat claims a book. Check again
    // against fresh settings and the backend before each irreversible deletion.
    const deleted = [];
    const failed = [];
    for (const name of candidates) {
        try {
            const currentNames = await deps.listNames();
            if (!orphanedLorebooksForDeletedChat(deps.getSettings(), chatId, currentNames, await deps.getProtectedNames?.() || []).includes(name)) continue;
            if (await deps.deleteBook(name)) deleted.push(name);
            else failed.push(name);
        } catch (_) {
            failed.push(name);
        }
    }
    return { offered: candidates, deleted, failed };
}
