import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    loadPortraitMapsForChat,
    migrateLegacyPortraitMapsToChat,
    portraitWriteMode,
    snapshotPortraitMapsForChat,
} from '../src/state/portrait-chat-scope.js';

describe('per-chat portrait ownership', () => {
    it('keeps identical entity names isolated between chats', () => {
        const settings = {
            chatStates: {},
            customPortraits: { Drazog: 'chat-a-drazog.png' },
            customLocationImages: { Camp: 'chat-a-camp.png' },
        };

        snapshotPortraitMapsForChat(settings, 'chat-a');
        settings.customPortraits = { Drazog: 'chat-b-drazog.png' };
        settings.customLocationImages = {};
        snapshotPortraitMapsForChat(settings, 'chat-b');

        loadPortraitMapsForChat(settings, 'chat-a');
        expect(settings.customPortraits.Drazog).toBe('chat-a-drazog.png');
        expect(settings.customLocationImages.Camp).toBe('chat-a-camp.png');

        loadPortraitMapsForChat(settings, 'chat-b');
        expect(settings.customPortraits.Drazog).toBe('chat-b-drazog.png');
        expect(settings.customLocationImages).toEqual({});
    });

    it('starts an unseen chat with empty maps instead of inheriting the previous chat', () => {
        const settings = {
            chatStates: { existing: { customPortraits: { Alice: 'alice.png' } } },
            customPortraits: { Alice: 'alice.png' },
            customLocationImages: { Town: 'town.png' },
        };

        expect(loadPortraitMapsForChat(settings, 'unseen')).toBe(false);
        expect(settings.customPortraits).toEqual({});
        expect(settings.customLocationImages).toEqual({});
    });

    it('preserves legacy live maps under the active chat exactly once', () => {
        const settings = {
            portraitChatScopeVersion: 0,
            chatStates: {},
            customPortraits: { Legacy: 'legacy.png' },
            customLocationImages: {},
        };

        expect(migrateLegacyPortraitMapsToChat(settings, 'current-chat')).toBe(true);
        expect(settings.chatStates['current-chat'].customPortraits).toEqual({ Legacy: 'legacy.png' });
        settings.customPortraits.Legacy = 'changed.png';
        expect(migrateLegacyPortraitMapsToChat(settings, 'current-chat')).toBe(false);
        expect(settings.chatStates['current-chat'].customPortraits.Legacy).toBe('legacy.png');
    });

    it('routes late Horde/auto-gen writes to the pinned chat partition after a switch', () => {
        expect(portraitWriteMode('chat-a', 'chat-a')).toBe('live');
        expect(portraitWriteMode('chat-b', 'chat-a')).toBe('partition');
        expect(portraitWriteMode(null, 'chat-a')).toBe('partition');
        expect(portraitWriteMode('chat-b', null)).toBe('live');
        expect(portraitWriteMode('chat-b', '')).toBe('live');
    });

    it('wires chat switching, persistence, and renames to the active portrait partition only', () => {
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        const portraitsSource = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');

        expect(indexSource).toContain('snapshotPortraitMapsForChat(s, oldChatId)');
        expect(indexSource).toContain('loadPortraitMapsForChat(s, resolvedId)');
        expect(indexSource).toContain('migrateLegacyPortraitMapsToChat(settings, bootChatId)');
        expect(indexSource).toContain('stopRealtimeLocationGeneration()');
        expect(portraitsSource).toContain('snapshotPortraitMapsForChat(s, getActiveChatId())');
        expect(portraitsSource).toContain('portraitWriteMode(');
        expect(portraitsSource).toContain('{ chatId: passChatId }');
        expect(portraitsSource).toContain('r2: false');
        expect(portraitsSource).not.toContain('part.customPortraits[newKey] = part.customPortraits[oldKey]');
    });
});
