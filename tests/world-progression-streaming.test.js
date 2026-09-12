import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');

describe('World Progression request transport', () => {
    it('streams report generation and automatic/manual consolidation requests', () => {
        const streamingCalls = routerSource.match(
            /sendStateRequest\(routerSettings, [^;]+, (?:null|signal), \{ stream: true, debugSource: 'World Progression' \}\)/g,
        ) || [];

        expect(streamingCalls).toHaveLength(3);
    });
});
