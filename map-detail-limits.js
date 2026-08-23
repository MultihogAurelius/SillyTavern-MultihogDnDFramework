/** Shared budget for durable asset prose stored and repeatedly injected with maps. */
export const MAP_ASSET_DETAIL_MAX_CHARS = 240;

/** Compact without an LLM retry; prefer ending at a word boundary. */
export function compactMapAssetDetail(value, maxLength = MAP_ASSET_DETAIL_MAX_CHARS) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    const prefix = text.slice(0, Math.max(1, maxLength - 1));
    const boundary = prefix.lastIndexOf(' ');
    const cut = boundary >= Math.floor(maxLength * 0.7) ? prefix.slice(0, boundary) : prefix;
    return `${cut.trimEnd()}…`;
}
