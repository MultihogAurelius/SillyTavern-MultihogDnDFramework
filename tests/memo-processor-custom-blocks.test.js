import { describe, expect, it, vi } from 'vitest';

vi.mock('../portrait-storage.js', () => ({
    lookupCustomPortraitSrc: () => '',
}));

import { mergeMemo } from '../memo-processor.js';
import { parseMemoBlocks } from '../renderer.js';

function block(tag, value) {
    return `[${tag}]\n${value}\n[/${tag}]`;
}

describe('mergeMemo custom blocks', () => {
    it.each(['OMENS', 'omens_2', 'OMEN TRACK', 'BLOOD-OATH'])(
        'keeps a single %s block across identical updates and shows the new value',
        (tag) => {
            const precedingBlock = block('WEATHER', 'Clear');
            const unchangedBlock = block(tag, 3);
            const originalMemo = `${precedingBlock}\n\n${unchangedBlock}`;
            let memo = originalMemo;

            for (let turn = 0; turn < 3; turn++) {
                memo = mergeMemo(memo, unchangedBlock);
                expect(memo).toBe(originalMemo);
            }

            memo = mergeMemo(memo, block(tag, 7));

            expect(memo).toBe(`${precedingBlock}\n\n${block(tag, 7)}`);
            expect(parseMemoBlocks(memo)[tag.toUpperCase()]).toBe('7');
        },
    );

    it('retains the first stored value when an unrelated update repairs legacy custom copies', () => {
        const currentBlock = block('omens_2', 7);
        const earlierBlock = block('OMENS_2', 3);
        const originalMemo = [currentBlock, block('WEATHER', 'Clear'), earlierBlock, earlierBlock].join('\n\n');

        const memo = mergeMemo(originalMemo, block('WEATHER', 'Rain'));

        expect(memo.match(/\[omens_2\]/gi)).toHaveLength(1);
        expect(parseMemoBlocks(memo)).toEqual({ OMENS_2: '7', WEATHER: 'Rain' });
    });

    it.each(['REMOVED', ''])('deletes every stored copy with a %j update', (value) => {
        const precedingBlock = block('WEATHER', 'Clear');
        const originalMemo = [precedingBlock, block('BLOOD-OATH', 7), block('blood-oath', 3)].join('\n\n');

        expect(mergeMemo(originalMemo, block('BLOOD-OATH', value))).toBe(precedingBlock);
    });

    it('preserves the last value for untouched alphabetic duplicate blocks', () => {
        const originalMemo = [block('OMENS', 3), block('WEATHER', 'Clear'), block('omens', 7)].join('\n\n');

        const memo = mergeMemo(originalMemo, block('WEATHER', 'Rain'));

        expect(memo.match(/\[omens\]/gi)).toHaveLength(1);
        expect(parseMemoBlocks(memo)).toEqual({ OMENS: '7', WEATHER: 'Rain' });
    });
});
