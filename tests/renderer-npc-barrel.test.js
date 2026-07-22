import { describe, expect, it, vi } from 'vitest';

vi.mock('../portrait-storage.js', () => ({
    lookupCustomPortraitSrc: (_settings, name) => String(name).toLowerCase() === 'alice'
        ? '/user/images/lorebook-agent-alice.png'
        : '',
}));

import { blockToItems, getMarkerLibraryKeys, tryRenderMarker } from '../renderer.js';

describe('((BARREL))', () => {
    it('renders signed values from generic labels around a centre zero marker', () => {
        const positive = tryRenderMarker('Trust: ((BARREL)) 38/150', 'NPC');
        const negative = tryRenderMarker('Dread: ((BARREL)) -38/150', 'NPC');

        expect(positive).toContain('rt-barrel-positive');
        expect(positive).toContain('+38/150');
        expect(negative).toContain('rt-barrel-negative');
        expect(negative).toContain('-38/150');
    });

    it('accepts an explicit signed range without depending on a relationship label', () => {
        const html = tryRenderMarker('((BARREL)) Chaos: -12/-50..+50', 'CUSTOM');

        expect(html).toContain('rt-barrel-negative');
        expect(html).toContain('-12/50');
    });

    it('allows independent positive and negative colors through a tag override and click targets', () => {
        const html = tryRenderMarker('Trust: ((BARREL - #112233 #445566)) -38/150', 'NPC');

        expect(html).toContain('data-recolor-id="NPC::Trust:positive"');
        expect(html).toContain('data-recolor-id="NPC::Trust:negative"');
        expect(html).toContain('data-recolor-current="#112233"');
        expect(html).toContain('background:#445566');
    });
});

describe('universal tag colors', () => {
    it('applies named color suffixes dynamically without listing color variants', () => {
        expect(getMarkerLibraryKeys()).toEqual(expect.arrayContaining(['PILL', 'BAR', 'PROGRESS']));
        expect(getMarkerLibraryKeys()).not.toEqual(expect.arrayContaining(['PILLPINK', 'BARRED', 'PROGRESSGREEN']));
        expect(tryRenderMarker('((PILLPINK)) Smitten', 'NPC').toLowerCase()).toContain('color:pink');
        expect(tryRenderMarker('((BARRED)) 12/20', 'NPC').toLowerCase()).toContain('background:red');
        expect(tryRenderMarker('((PROGRESSGOLDENROD)) 3/5', 'NPC').toLowerCase()).toContain('background:goldenrod');
    });

    it('accepts named and hexadecimal colors through the explicit override syntax', () => {
        expect(tryRenderMarker('((PILLS - rebeccapurple)) Smitten', 'NPC')).toContain('color:rebeccapurple');
        expect(tryRenderMarker('((PILL - #ff69b4)) Smitten', 'NPC')).toContain('color:#ff69b4');
    });
});

describe('explicit marker columns', () => {
    it('uses || as an equal-width column separator without rendering the pipes', () => {
        const html = tryRenderMarker('((PILLGREEN)) Friendly || ((PILLS)) In love', 'NPC');

        expect(html).toContain('rt-multi-marker-row--columns');
        expect(html.match(/rt-mmc-cell--column/g)).toHaveLength(2);
        expect(html).not.toContain('||');
    });

    it('uses a numeric |x tab stop anywhere on a line, including the start', () => {
        const row = tryRenderMarker('((PILLGREEN)) Friendly |50 ((PILLPINK)) In love', 'NPC');
        const leading = tryRenderMarker('|12.5 ((PILLPINK)) In love', 'NPC');

        expect(row).toContain('rt-multi-marker-row--tab-stops');
        expect(row).toContain('grid-column:1 / 501;grid-row:1;');
        expect(row).toContain('grid-column:501 / 1001;grid-row:1;');
        expect(row).not.toContain('|50');
        expect(leading).toContain('rt-multi-marker-row--tab-stops');
        expect(leading).toContain('grid-column:126 / 1001;grid-row:1;');
        expect(leading).not.toContain('|12.5');
    });
});

describe('((NPC))', () => {
    it('is listed in the rendering-tag library with the signed bar tag', () => {
        expect(getMarkerLibraryKeys()).toEqual(expect.arrayContaining(['NPC', 'BARREL']));
    });

    it('groups arbitrary following fields into a PARTY-style NPC card', () => {
        const items = blockToItems('NPC', `
((NPC)) Alice:
((BARREL)) Friendship: 38/150 ((BARREL)) Affection: 0/150
Location: Unknown
((NPC)) Bob:
Disposition: Guarded
`);
        const html = items.join('');

        expect(items).toHaveLength(2);
        expect(html).toContain('Alice');
        expect(html).toContain('Bob');
        expect(html).toContain('rt-multi-marker-row');
        expect(html).toContain('Location:');
        expect(html).toContain('Disposition:');
        expect(html).toContain('/user/images/lorebook-agent-alice.png');
    });
});
