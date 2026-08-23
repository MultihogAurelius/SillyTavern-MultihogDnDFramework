import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createChatStateLoader } from '../src/features/chat/chat-state-loader.js';

describe('chat state loader', () => {
    it('returns a callable loader function', () => {
        expect(typeof createChatStateLoader({})).toBe('function');
    });

    it('re-probes the mapped site after a chat load even if Lorebook Agent is closed', () => {
        const source = readFileSync(new URL('../src/features/chat/chat-state-loader.js', import.meta.url), 'utf8');
        expect(source).toContain('runtimeState.refreshImmersionView');
    });

    it('restores per-chat relationship maps when the partition has them', () => {
        const source = readFileSync(new URL('../src/features/chat/chat-state-loader.js', import.meta.url), 'utf8');
        expect(source).toContain('s.npcRelationshipValues = JSON.parse(JSON.stringify(saved.npcRelationshipValues || {}))');
        expect(source).toContain('s.npcRelationshipLog = JSON.parse(JSON.stringify(saved.npcRelationshipLog || {}))');
        expect(source).toContain("hasOwnProperty.call(saved, 'npcRelationshipValues')");
        expect(source).toContain("hasOwnProperty.call(saved, 'npcRelationshipLog')");
    });

    it('restores Map Updater exit bookkeeping from the active chat partition', () => {
        const source = readFileSync(new URL('../src/features/chat/chat-state-loader.js', import.meta.url), 'utf8');
        expect(source).toContain("s.mapUpdaterLastSiteRoot = saved.mapUpdaterLastSiteRoot || ''");
        expect(source).toContain("s.mapUpdaterPendingExitRoot = saved.mapUpdaterPendingExitRoot || ''");
    });
});
