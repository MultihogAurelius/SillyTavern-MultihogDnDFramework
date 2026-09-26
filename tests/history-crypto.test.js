import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { historyFileId, sha256Hex } from '../src/state/history-crypto.js';

describe('history crypto on insecure LAN origins', () => {
    it('matches SHA-256 for UTF-8 data and padding boundaries', () => {
        for (const text of ['', 'a', '🗺️ Map evolution 日本語', ...[55, 56, 63, 64, 65, 10000]
            .map(length => 'x'.repeat(length))]) {
            const bytes = new TextEncoder().encode(text);
            expect(sha256Hex(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
        }
    });

    it('makes a valid version-4 file ID with getRandomValues when randomUUID is absent', () => {
        const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
        try {
            Object.defineProperty(globalThis, 'crypto', {
                configurable: true, value: { getRandomValues: bytes => {
                    for (let i = 0; i < bytes.length; i++) bytes[i] = i;
                    return bytes;
                } },
            });
            expect(historyFileId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        } finally {
            if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
            else delete globalThis.crypto;
        }
    });
});
