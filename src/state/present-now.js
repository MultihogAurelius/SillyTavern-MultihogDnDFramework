/**
 * Latest narrator/assistant chat message, walking newest-first.
 * User and system messages are skipped so Present Now stays on the last
 * narrator output instead of emptying when the player sends a turn.
 *
 * @param {Array<{ is_user?: boolean, is_system?: boolean, is_hidden?: boolean, extra?: object }>} chat
 * @param {{ includeHidden?: boolean }} [opts]
 * @returns {object|null}
 */
export function findMostRecentNarratorMessage(chat, { includeHidden = false } = {}) {
    if (!Array.isArray(chat) || chat.length === 0) return null;
    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        if (!msg || msg.is_user || msg.is_system) continue;
        if (!includeHidden && msg.is_hidden) continue;
        const extra = msg.extra || {};
        if (extra.summary || extra.is_summary || extra.summary_data) continue;
        return msg;
    }
    return null;
}

const CHOICES_BLOCK_RE = /<choices\b[^>]*>[\s\S]*?<\/choices\s*>/gi;
const ESCAPED_CHOICES_BLOCK_RE = /&lt;\s*choices\b[^&]*&gt;[\s\S]*?&lt;\s*\/\s*choices\s*&gt;/gi;
const CYOA_CHOICES_DIV_RE = /<div\b[^>]*\brt-cyoa-choices\b[^>]*>[\s\S]*?<\/div\s*>/gi;
const BUTTON_BLOCK_RE = /<button\b[^>]*>[\s\S]*?<\/button\s*>/gi;
const ESCAPED_BUTTON_BLOCK_RE = /&lt;\s*button\b[^&]*&gt;[\s\S]*?&lt;\s*\/\s*button\s*&gt;/gi;

/**
 * Remove CYOA choice markup (and its inner text) so Present Now only sees
 * narrative prose. Hypothetical names in choice/button blocks are not scene presence.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripCyoaChoiceBlocks(text) {
    let raw = String(text || '');
    if (!raw) return '';
    raw = raw.replace(CHOICES_BLOCK_RE, '');
    raw = raw.replace(ESCAPED_CHOICES_BLOCK_RE, '');
    raw = raw.replace(CYOA_CHOICES_DIV_RE, '');
    raw = raw.replace(BUTTON_BLOCK_RE, '');
    raw = raw.replace(ESCAPED_BUTTON_BLOCK_RE, '');
    return raw.replace(/\n{3,}/g, '\n\n').trim();
}
