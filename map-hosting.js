import {
    getDungeonMapAttachment,
    normalizeMapSiteKind,
    parseDungeonMapDocument,
    replaceDungeonMapSection,
    serializeDungeonMapDocument,
} from './dungeon-reality.js';

/** Maximum number of mapped documents in one host chain. */
export const MAX_HOSTED_MAP_DEPTH = 3;

function resolveHostArea(hostDocument, asset) {
    const area = (hostDocument.areas || []).find(item => item.id === asset.location);
    if (!area) throw new Error(`Hosted asset "${asset.name}" does not occupy a valid parent-map cell.`);
    return area;
}

/** Canonical Locations-lore path for a peer hosted by an asset in any map cell. */
export function buildHostedPeerSitePath(hostDocument, asset) {
    const area = resolveHostArea(hostDocument, asset);
    return `${hostDocument.site} :: ${area.name} :: ${asset.name}`;
}

/** Reparent a mapped peer root and every descendant Location breadcrumb. */
export function reparentHostedLocationEntries(entries, entry, canonicalSite, requestedSite) {
    const oldLabel = String(entry?.comment || '').trim();
    const nextLabel = String(canonicalSite || '').trim();
    if (!oldLabel || !nextLabel || oldLabel === nextLabel) return false;
    for (const candidate of Object.values(entries || {})) {
        if (!candidate || candidate === entry) continue;
        const label = String(candidate.comment || '').trim();
        if (label.startsWith(`${oldLabel} :: `)) {
            candidate.comment = `${nextLabel}${label.slice(oldLabel.length)}`;
        }
    }
    entry.comment = nextLabel;
    entry.key = [...new Set([
        requestedSite,
        nextLabel,
        ...(Array.isArray(entry.key) ? entry.key : []),
    ].map(value => String(value || '').trim()).filter(Boolean))].slice(0, 6);
    rebaseHostedMapDocuments(entries, oldLabel, nextLabel);
    return true;
}

/** Keep every mapped descendant's runtime-owned host chain aligned after reparenting. */
export function rebaseHostedMapDocuments(entries, oldPrefix, newPrefix) {
    const oldRoot = String(oldPrefix || '').trim();
    const newRoot = String(newPrefix || '').trim();
    if (!oldRoot || !newRoot || oldRoot === newRoot) return false;
    const rebase = value => {
        const text = String(value || '').trim();
        if (text === oldRoot) return newRoot;
        return text.startsWith(`${oldRoot} :: `) ? `${newRoot}${text.slice(oldRoot.length)}` : text;
    };
    let changed = false;
    for (const candidate of Object.values(entries || {})) {
        const attachment = getDungeonMapAttachment(candidate);
        if (!attachment) continue;
        const document = parseDungeonMapDocument(attachment.content, attachment.siteRoot).document;
        const nextSite = rebase(document.site);
        const nextHost = rebase(document.hostSite);
        if (nextSite === document.site && nextHost === String(document.hostSite || '').trim()) continue;
        document.site = nextSite;
        if (nextHost) document.hostSite = nextHost;
        if (document.hostBrief) document.hostBrief = String(document.hostBrief).split(oldRoot).join(newRoot);
        if (document.hostSite && document.hostBrief) {
            candidate.content = ensureHostCoreMirror(candidate.content, document.hostSite, document.hostBrief);
        }
        candidate.content = replaceDungeonMapSection(candidate.content, serializeDungeonMapDocument(document));
        changed = true;
    }
    return changed;
}

/** Mirror runtime-owned host metadata inside an existing CORE block, idempotently. */
export function ensureHostCoreMirror(content, hostSite, hostBrief) {
    const source = String(content || '');
    const hostLines = `Host Site: ${hostSite}\nHost Brief: ${hostBrief}`;
    const core = source.match(/\[CORE\]([\s\S]*?)\[\/CORE\]/i);
    if (!core) return `[CORE]\n${hostLines}\n[/CORE]\n${source}`.trim();
    const cleaned = core[1]
        .replace(/^\s*Host Site:\s*.*(?:\r?\n|$)/gim, '')
        .replace(/^\s*Host Brief:\s*.*(?:\r?\n|$)/gim, '')
        .trim();
    const inner = [cleaned, hostLines].filter(Boolean).join('\n');
    return source.replace(core[0], `[CORE]\n${inner}\n[/CORE]`);
}

/** Build the canonical compact exit packet from the host map cell. */
export function buildHostedPeerBrief(hostDocument, asset) {
    const area = resolveHostArea(hostDocument, asset);
    const fact = String(area.geometry?.[0] || '').trim();
    return `Contained in ${hostDocument.site}, ${area.name}.${fact ? ` ${fact}` : ''} Exit returns to ${area.name} in ${hostDocument.site}.`
        .replace(/\s+/g, ' ')
        .trim();
}

/** Stamp a DUNGEON/INTERIOR peer, rejecting conflicting re-hosts. */
export function stampHostedPeerDocument(peerDocument, hostDocument, asset) {
    if (!['DUNGEON', 'INTERIOR'].includes(normalizeMapSiteKind(peerDocument.kind))) {
        throw new Error(`Hosted peer "${peerDocument.site}" must be DUNGEON or INTERIOR.`);
    }
    if (peerDocument.hostSite && peerDocument.hostSite !== hostDocument.site) {
        throw new Error(`Mapped peer "${peerDocument.site}" is already hosted inside "${peerDocument.hostSite}".`);
    }
    if (!['SETTLEMENT', 'DUNGEON', 'INTERIOR'].includes(normalizeMapSiteKind(hostDocument.kind))) {
        throw new Error(`Host "${hostDocument.site}" is not a supported mapped site.`);
    }
    const stamped = JSON.parse(JSON.stringify(peerDocument));
    stamped.hostSite = hostDocument.site;
    stamped.hostBrief = buildHostedPeerBrief(hostDocument, asset);
    return stamped;
}
