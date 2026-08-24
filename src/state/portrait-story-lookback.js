/**
 * Recent chat lines for portrait prompt generation.
 * @param {{ chat?: object[] }|null} ctx
 * @param {number} lookback
 * @param {{ maxChars?: number, label?: string }} [options]
 * @returns {string}
 */
export function buildPortraitStoryContext(ctx, lookback, {
    maxChars = 12000,
    label = 'Recent Chat Context',
} = {}) {
    if (!ctx?.chat || !Array.isArray(ctx.chat) || lookback <= 0) return '';
    const filteredMsgs = ctx.chat.filter(m => !m.is_system && m.mes && String(m.mes).trim());
    const lastMsgs = filteredMsgs.slice(-lookback);
    if (!lastMsgs.length) return '';
    const msgText = lastMsgs.map(m => `${m.name || (m.is_user ? 'User' : 'Character')}: ${m.mes}`).join('\n\n');
    return `${label} (Last ${lastMsgs.length} Message${lastMsgs.length === 1 ? '' : 's'}):\n${msgText.substring(0, maxChars)}`;
}

export function portraitStoryLookbackCount(settings) {
    const raw = Number(settings?.portraitStoryLookback);
    if (!Number.isFinite(raw)) return 5;
    return Math.max(0, Math.min(100, Math.trunc(raw)));
}
