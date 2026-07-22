/**
 * Restores the CYOA tags when a chat formatter has rendered them as literal text.
 *
 * Only the two extension-owned tag names are restored, and only when there are at
 * least two complete choices. That keeps normal prose (including an incidental
 * mention of a single `<button>` tag) untouched.
 */
export function restoreEscapedCyoaChoiceMarkup(html) {
    if (typeof html !== 'string' || !html.includes('&lt;')) return html;

    const escapedButton = /&lt;\s*button\s*&gt;[\s\S]*?&lt;\s*\/\s*button\s*&gt;/gi;
    const completeButtons = html.match(escapedButton) || [];
    if (completeButtons.length < 2) return html;

    // Do not decode arbitrary HTML supplied by a model. These two harmless,
    // extension-owned wrapper tags are all we need to turn into DOM buttons.
    return html.replace(/&lt;\s*(\/?)\s*(choices|button)\s*&gt;/gi, '<$1$2>');
}
