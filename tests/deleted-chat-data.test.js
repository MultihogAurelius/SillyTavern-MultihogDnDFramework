import { beforeEach, describe, expect, it } from 'vitest';
import { existingChatIds, orphanedStoredChatIds, removeDeletedChatData, storedChatIds } from '../src/features/chat/deleted-chat-data.js';
import { COMPANION_BY_CHAT_KEY, MEMO_RECOVERY_KEY } from '../src/features/chat/local-chat-map.js';

describe('deleted chat data cleanup', () => {
    beforeEach(() => localStorage.clear());

    it('finds records across settings and browser-local maps', () => {
        localStorage.setItem(MEMO_RECOVERY_KEY, JSON.stringify({ Deleted: { currentMemo: 'memo' } }));
        const settings = {
            chatStates: { Active: { currentMemo: 'alive' } },
            routerHistory: [{ chatId: 'Deleted', bookSnapshots: {} }],
        };
        expect(storedChatIds(settings)).toEqual(['Active', 'Deleted']);
        expect(existingChatIds([{ file_name: 'Active.jsonl' }, { file_name: 'Group 1.jsonl' }]))
            .toEqual(new Set(['Active', 'Group 1']));
        expect(() => existingChatIds({ error: true })).toThrow();
        expect(orphanedStoredChatIds(settings, new Set(['Active']))).toEqual(['Deleted']);
        expect(() => orphanedStoredChatIds(settings, [])).toThrow();
    });

    it('removes only the deleted chat’s partition, snapshots and local records', () => {
        for (const key of [COMPANION_BY_CHAT_KEY, MEMO_RECOVERY_KEY]) {
            localStorage.setItem(key, JSON.stringify({ Deleted: { text: 'old' }, Active: { text: 'keep' } }));
        }
        const settings = {
            chatStates: {
                Deleted: { currentMemo: 'old', dungeonMapHistory: [{ rooms: 1 }] },
                Active: { currentMemo: 'keep' },
            },
            routerHistory: [{ chatId: 'Deleted' }, { chatId: 'Active' }],
            routerCampaignPrefixOverrideAnchorChatId: 'Deleted',
            routerCampaignPrefixOverride: 'Old_Chat',
        };
        expect(removeDeletedChatData(settings, 'Deleted')).toBe(true);
        expect(settings.chatStates).toEqual({ Active: { currentMemo: 'keep' } });
        expect(settings.routerHistory).toEqual([{ chatId: 'Active' }]);
        expect(settings.routerCampaignPrefixOverride).toBe('');
        for (const key of [COMPANION_BY_CHAT_KEY, MEMO_RECOVERY_KEY]) {
            expect(JSON.parse(localStorage.getItem(key))).toEqual({ Active: { text: 'keep' } });
        }
        expect(removeDeletedChatData(settings, 'Deleted')).toBe(false);
    });
});
