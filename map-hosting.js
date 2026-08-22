import { normalizeMapSiteKind } from './dungeon-reality.js';

function resolveHostArea(hostDocument, asset) {
    const area = (hostDocument.areas || []).find(item => item.id === asset.location);
    if (!area) throw new Error(`Hosted asset "${asset.name}" does not occupy a valid district.`);
    return area;
}

/** Canonical Locations-lore path for a peer hosted by a settlement asset. */
export function buildHostedPeerSitePath(hostDocument, asset) {
    const area = resolveHostArea(hostDocument, asset);
    return `${hostDocument.site} :: ${area.name} :: ${asset.name}`;
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

/** Build the canonical compact exit packet from the host district. */
export function buildHostedPeerBrief(hostDocument, asset) {
    const area = resolveHostArea(hostDocument, asset);
    const fact = String(area.geometry?.[0] || '').trim();
    return `Contained in ${hostDocument.site}, ${area.name}.${fact ? ` ${fact}` : ''} Exit returns to ${area.name} in ${hostDocument.site}.`
        .replace(/\s+/g, ' ')
        .trim();
}

/** Stamp a DUNGEON/INTERIOR peer, rejecting settlement hosting and re-hosting. */
export function stampHostedPeerDocument(peerDocument, hostDocument, asset) {
    if (!['DUNGEON', 'INTERIOR'].includes(normalizeMapSiteKind(peerDocument.kind))) {
        throw new Error(`Hosted peer "${peerDocument.site}" must be DUNGEON or INTERIOR.`);
    }
    if (peerDocument.hostSite && peerDocument.hostSite !== hostDocument.site) {
        throw new Error(`Mapped peer "${peerDocument.site}" is already hosted inside "${peerDocument.hostSite}".`);
    }
    const stamped = JSON.parse(JSON.stringify(peerDocument));
    stamped.hostSite = hostDocument.site;
    stamped.hostBrief = buildHostedPeerBrief(hostDocument, asset);
    return stamped;
}
