import { describe, expect, it } from 'vitest';
import { buildHostedPeerBrief, buildHostedPeerSitePath, ensureHostCoreMirror, reparentHostedLocationEntries, stampHostedPeerDocument } from '../map-hosting.js';

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
    it('derives the canonical nested Locations path from host, district, and exact asset name', () => {
        expect(buildHostedPeerSitePath(host, asset)).toBe('Rustport :: Dock Ward :: Flooded Sewers');
    });

    it('derives the exact deterministic host brief from the first district geometry fact', () => {
        expect(buildHostedPeerBrief(host, asset)).toBe(
            'Contained in Rustport, Dock Ward. Warehouse piers smell of brine. Exit returns to Dock Ward in Rustport.',
        );
    });

    it('reparents an absorbed peer root and all descendant Location breadcrumbs', () => {
        const root = { comment: 'Flooded Sewers', key: ['Flooded Sewers', 'sewer'] };
        const child = { comment: 'Flooded Sewers :: Treatment Grate', key: ['Treatment Grate'] };
        const grandchild = { comment: 'Flooded Sewers :: Treatment Grate :: Pump Room', key: ['Pump Room'] };
        const unrelated = { comment: 'Flooded Sewers Annex', key: ['Flooded Sewers Annex'] };
        const entries = { 1: root, 2: child, 3: grandchild, 4: unrelated };

        expect(reparentHostedLocationEntries(
            entries,
            root,
            'Rustport :: Dock Ward :: Flooded Sewers',
            'Flooded Sewers',
        )).toBe(true);
        expect(root.comment).toBe('Rustport :: Dock Ward :: Flooded Sewers');
        expect(root.key.slice(0, 2)).toEqual(['Flooded Sewers', 'Rustport :: Dock Ward :: Flooded Sewers']);
        expect(child.comment).toBe('Rustport :: Dock Ward :: Flooded Sewers :: Treatment Grate');
        expect(grandchild.comment).toBe('Rustport :: Dock Ward :: Flooded Sewers :: Treatment Grate :: Pump Room');
        expect(unrelated.comment).toBe('Flooded Sewers Annex');
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
