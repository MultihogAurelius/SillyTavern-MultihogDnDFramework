import { describe, expect, it } from 'vitest';
import { buildHostedPeerBrief, ensureHostCoreMirror, stampHostedPeerDocument } from '../map-hosting.js';

const host = {
    version: 3,
    site: 'Rustport',
    kind: 'SETTLEMENT',
    areas: [{
        id: 'dock-ward',
        name: 'Dock Ward',
        geometry: ['Warehouse piers smell of brine.'],
        connections: [],
    }],
    assets: [],
};

const asset = {
    id: 'flooded-sewers',
    kind: 'SUBDUNGEON',
    name: 'Flooded Sewers',
    location: 'dock-ward',
};

describe('nested map hosting', () => {
    it('derives the exact deterministic host brief from the first district geometry fact', () => {
        expect(buildHostedPeerBrief(host, asset)).toBe(
            'Contained in Rustport, Dock Ward. Warehouse piers smell of brine. Exit returns to Dock Ward in Rustport.',
        );
    });

    it('mirrors host lines inside CORE idempotently without disturbing other lore', () => {
        const content = '[CORE]\nA hidden sewer network.\n[/CORE]\n[NOTES]\nKeep this.\n[/NOTES]';
        const once = ensureHostCoreMirror(content, 'Rustport', buildHostedPeerBrief(host, asset));
        const twice = ensureHostCoreMirror(once, 'Rustport', buildHostedPeerBrief(host, asset));
        expect(twice).toBe(once);
        expect(once.match(/Host Site:/g)).toHaveLength(1);
        expect(once.match(/Host Brief:/g)).toHaveLength(1);
        expect(once).toContain('A hidden sewer network.');
        expect(once).toContain('[NOTES]\nKeep this.\n[/NOTES]');
    });

    it('stamps DUNGEON/INTERIOR peers and rejects settlements or conflicting re-hosts', () => {
        const peer = { version: 3, site: 'Flooded Sewers', kind: 'DUNGEON', areas: [], assets: [] };
        expect(stampHostedPeerDocument(peer, host, asset)).toMatchObject({
            kind: 'DUNGEON',
            hostSite: 'Rustport',
            hostBrief: buildHostedPeerBrief(host, asset),
        });
        expect(peer.hostSite).toBeUndefined();

        expect(() => stampHostedPeerDocument({ ...peer, kind: 'SETTLEMENT' }, host, asset))
            .toThrow(/must be DUNGEON or INTERIOR/);
        expect(() => stampHostedPeerDocument({ ...peer, hostSite: 'Other City' }, host, asset))
            .toThrow(/already hosted inside "Other City"/);
    });
});
