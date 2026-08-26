import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canCommitPassForChat } from '../src/state/pass-affinity.js';

const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const narrativeSource = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');

describe('canCommitPassForChat', () => {
    it('allows commit only while the originating chat is still active', () => {
        expect(canCommitPassForChat('Chat A', 'Chat A')).toBe(true);
        expect(canCommitPassForChat('Chat A', 'Chat B')).toBe(false);
    });

    it('rejects aborted passes and missing chat ids', () => {
        expect(canCommitPassForChat('Chat A', 'Chat A', { aborted: true })).toBe(false);
        expect(canCommitPassForChat('', 'Chat A')).toBe(false);
        expect(canCommitPassForChat('Chat A', null)).toBe(false);
        expect(canCommitPassForChat(null, 'Chat A')).toBe(false);
    });
});

describe('State Tracker chat-switch affinity', () => {
    it('aborts in-flight State Tracker work on a real chat switch', () => {
        expect(indexSource).toContain('runtimeState.stateController.abort()');
        expect(indexSource).toMatch(
            /Drop in-flight State Tracker work for the departing chat[\s\S]*runtimeState\.stateController\.abort\(\)/,
        );
    });

    it('guards runStateModelPass commits against a post-await chat switch', () => {
        expect(indexSource).toContain("import { canCommitPassForChat } from './src/state/pass-affinity.js';");
        expect(indexSource).toContain('const passChatId = runtimeState.currentChatId;');
        expect(indexSource).toContain('Stopped because the active chat changed.');
        expect(indexSource).toContain('if (settings.chatLinkEnabled && passChatId) saveChatState(passChatId);');
        expect(indexSource).toMatch(
            /function commitChunkResult\([\s\S]*?canCommitPassForChat\(passChatId, runtimeState\.currentChatId/,
        );
    });

    it('guards sendDirectPrompt commits against a post-await chat switch', () => {
        const directIdx = indexSource.indexOf('export async function sendDirectPrompt');
        expect(directIdx).toBeGreaterThanOrEqual(0);
        const directSlice = indexSource.slice(directIdx, directIdx + 12000);
        expect(directSlice).toContain('const passChatId = runtimeState.currentChatId;');
        expect(directSlice).toContain('canCommitPassForChat(passChatId, runtimeState.currentChatId');
        expect(directSlice).toContain("status: signal.aborted ? 'cancelled' : 'chat_changed'");
        expect(directSlice).toContain('if (settings.chatLinkEnabled && passChatId) saveChatState(passChatId);');
    });

    it('guards State Tracker relationship applies against a post-await chat switch', () => {
        expect(narrativeSource).toContain("import { canCommitPassForChat } from './src/state/pass-affinity.js';");
        const relIdx = narrativeSource.indexOf('export async function applyStateTrackerRelationshipCommands');
        expect(relIdx).toBeGreaterThanOrEqual(0);
        const relSlice = narrativeSource.slice(relIdx, relIdx + 9000);
        expect(relSlice).toContain('options.passChatId ?? runtimeState.currentChatId');
        expect(relSlice).toContain("status: 'chat_changed'");
        expect(relSlice).toContain('persistRelationshipCommandChanges(ctx, settings, passChatId)');
        expect(relSlice).toMatch(
            /await fuzzyResolveNpcName\([\s\S]*?canCommitPassForChat\(passChatId, runtimeState\.currentChatId\)/,
        );

        expect(indexSource).toContain(
            'await applyStateTrackerRelationshipCommands(relationshipCommands, { passChatId })',
        );
        expect(indexSource).toContain("relResult?.status === 'chat_changed'");
    });
});
