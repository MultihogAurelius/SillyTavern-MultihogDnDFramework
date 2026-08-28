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
        expect(html).toContain('data-barrel-direction="negative" style="color:#445566;"');
    });
});

describe('((SLOTS))', () => {
    it('renders decimal values with a proportional partial slot and exact hover value', () => {
        const html = tryRenderMarker('Supply: ((SLOTS)) 1.5/4', 'CUSTOM');

        expect(html).toContain('class="rt-slot partial"');
        expect(html).toContain('class="rt-slot-fill" style="width:50%');
        expect(html).toContain('title="Supply: 1.5/4"');
        expect(html).toContain('aria-label="Supply: 1.5/4"');
    });

    it('accepts fractional values without a leading zero', () => {
        const html = tryRenderMarker('Charge: ((SLOTS)) .25/1', 'CUSTOM');

        expect(html).toContain('class="rt-slot partial"');
        expect(html).toContain('title="Charge: .25/1"');
    });

    it('still renders whole slots as filled or empty pips', () => {
        const html = tryRenderMarker('Arrows: ((SLOTS)) 3/4', 'CUSTOM');
        const filled = html.match(/class="rt-slot filled"/g) || [];
        const empty = html.match(/class="rt-slot empty"/g) || [];

        expect(filled).toHaveLength(3);
        expect(empty).toHaveLength(1);
        expect(html).toContain('class="rt-slot-fill" style="width:100%');
        expect(html).not.toContain('class="rt-slot partial"');
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

    it('colors only the badge value when a colored badge follows a label', () => {
        const html = tryRenderMarker('Status: ((BADGEPINK)) Respected', 'CUSTOM');
        const normalizedHtml = html.toLowerCase();

        expect(html).toContain('<span class="rt-entity-sub-label">Status:</span>');
        expect(normalizedHtml).not.toContain('<span class="rt-entity-sub-label" style="color:pink">');
        expect(normalizedHtml).toContain('color:pink');
        expect(html).toContain('Respected');
    });

    it('colors only the pill value when a colored pill follows a label', () => {
        const html = tryRenderMarker('Status: ((PILLGREEN)) Full', 'CUSTOM');
        const normalizedHtml = html.toLowerCase();

        expect(html).toContain('<span class="rt-entity-sub-label">Status:</span>');
        expect(normalizedHtml).not.toContain('<span class="rt-entity-sub-label" style="color:green">');
        expect(normalizedHtml).toContain('color:green');
        expect(html).toContain('Full');
    });

    it('colors only the BAR fill and marks its color as explicitly chosen', () => {
        const html = tryRenderMarker('Hunger: ((BARBLUE)) 975/1000', 'CHARACTER');
        const normalizedHtml = html.toLowerCase();

        expect(html).toContain('<span class="rt-entity-sub-label">Hunger:</span>');
        expect(normalizedHtml).not.toContain('<span class="rt-entity-sub-label" style="color:blue">');
        expect(normalizedHtml).toContain('background:blue');
        expect(html).toContain('data-recolor-explicit-color="true"');
    });

    it('keeps an inline CHARACTER bar header neutral while preserving its explicit color', () => {
        const html = blockToItems('CHARACTER', 'Hunger: ((BARBLUE)) 975/1000').join('');

        expect(html).toContain('class="rt-entity-name"');
        expect(html).toContain('>Hunger:</div>');
        expect(html.toLowerCase()).toContain('background:blue');
        expect(html).toContain('data-recolor-explicit-color="true"');
    });

    it('keeps separately colored PILLS markers as compact as a normal pill row', () => {
        const html = tryRenderMarker('Status: ((PILLSBLUE)) Respected, ((PILLSGREEN)) Good', 'CUSTOM');

        expect(html).toContain('rt-multi-marker-row--compact-pills');
        expect(html).toContain('Respected');
        expect(html).toContain('Good');
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
