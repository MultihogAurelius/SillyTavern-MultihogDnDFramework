import { describe, expect, it, vi } from 'vitest';
import {
    offerOrphanedLorebookPurge,
    orphanedLorebooksForDeletedChat,
} from '../src/features/chat/purge-orphaned-lorebooks.js';

describe('purging lorebooks after chat deletion', () => {
    const books = ['Old_Chat_NPCs', 'Old_Chat_Locations', 'Old_Chat_World', 'Old_Chat_Extra_Memo', 'Another_NPCs'];

    it('offers only existing, recorded books under the deleted chat’s pinned prefix', () => {
        const settings = { chatStates: {
            'Renamed Chat': { renamedCampaignPrefix: 'Old_Chat', campaignBooks: [...books, 'Missing'] },
        } };
        expect(orphanedLorebooksForDeletedChat(settings, 'Renamed Chat', books))
            .toEqual(['Old_Chat_NPCs', 'Old_Chat_Locations', 'Old_Chat_World']);
        expect(orphanedLorebooksForDeletedChat(settings, 'Renamed Chat', books, ['Old_Chat_World']))
            .toEqual(['Old_Chat_NPCs', 'Old_Chat_Locations']);
        expect(orphanedLorebooksForDeletedChat(settings, 'Unknown Chat', books)).toEqual([]);
        expect(orphanedLorebooksForDeletedChat(settings, 'Renamed Chat', null)).toEqual([]);
    });

    it('keeps books claimed by another chat, including by a shared prefix', () => {
        const settings = { chatStates: {
            Old: { campaignBooks: ['Old_NPCs', 'Old_Locations'] },
            Other: { campaignBooks: ['Old_NPCs'] },
            Renamed: { renamedCampaignPrefix: 'Old', campaignBooks: [] },
        } };
        expect(orphanedLorebooksForDeletedChat(settings, 'Old', ['Old_NPCs', 'Old_Locations']))
            .toEqual([]);
    });

    it('keeps books claimed by a prefix override even when the anchor has no chatStates entry', () => {
        const settings = {
            routerCampaignPrefixOverride: 'Shared',
            routerCampaignPrefixOverrideAnchorChatId: 'Chat B',
            chatStates: {
                'Chat A': { renamedCampaignPrefix: 'Shared', campaignBooks: ['Shared_NPCs', 'Shared_Locations'] },
            },
        };
        expect(orphanedLorebooksForDeletedChat(settings, 'Chat A', ['Shared_NPCs', 'Shared_Locations']))
            .toEqual([]);
    });

    it('keeps books under a legacy unanchored override for a different deleted chat', () => {
        const settings = {
            routerCampaignPrefixOverride: 'Shared',
            routerCampaignPrefixOverrideAnchorChatId: '',
            chatStates: {
                'Chat A': { renamedCampaignPrefix: 'Shared', campaignBooks: ['Shared_NPCs'] },
            },
        };
        expect(orphanedLorebooksForDeletedChat(settings, 'Chat A', ['Shared_NPCs'])).toEqual([]);
    });

    it('still offers books when the deleted chat itself owns the override anchor', () => {
        const settings = {
            routerCampaignPrefixOverride: 'Shared',
            routerCampaignPrefixOverrideAnchorChatId: 'Chat A',
            chatStates: {
                'Chat A': { campaignBooks: ['Shared_NPCs', 'Shared_Locations'] },
            },
        };
        expect(orphanedLorebooksForDeletedChat(settings, 'Chat A', ['Shared_NPCs', 'Shared_Locations']))
            .toEqual(['Shared_NPCs', 'Shared_Locations']);
    });

    it('does nothing when the user keeps the lorebooks', async () => {
        const deleteBook = vi.fn();
        const settings = { chatStates: { Old: { campaignBooks: ['Old_NPCs'] } } };
        const result = await offerOrphanedLorebookPurge('Old', {
            listNames: async () => ['Old_NPCs'], getSettings: () => settings,
            confirm: async () => false, deleteBook,
        });
        expect(result.offered).toEqual(['Old_NPCs']);
        expect(deleteBook).not.toHaveBeenCalled();
    });

    it('rechecks that the chat remains deleted after the prompt', async () => {
        const deleteBook = vi.fn();
        const settings = { chatStates: { Old: { campaignBooks: ['Old_NPCs'] } } };
        const result = await offerOrphanedLorebookPurge('Old', {
            listNames: async () => ['Old_NPCs'], getSettings: () => settings,
            confirm: async () => true, canDelete: async () => false, deleteBook,
        });
        expect(result.deleted).toEqual([]);
        expect(deleteBook).not.toHaveBeenCalled();
    });

    it('rechecks ownership after confirmation and reports per-book failures', async () => {
        const settings = { chatStates: { Old: { campaignBooks: ['Old_NPCs', 'Old_World'] } } };
        const deleteBook = vi.fn(async name => name === 'Old_World');
        const result = await offerOrphanedLorebookPurge('Old', {
            listNames: async () => ['Old_NPCs', 'Old_World'], getSettings: () => settings,
            confirm: async () => { settings.chatStates.New = { renamedCampaignPrefix: 'Old_NPCs' }; return true; },
            deleteBook,
        });
        expect(deleteBook).toHaveBeenCalledExactlyOnceWith('Old_World');
        expect(result.deleted).toEqual(['Old_World']);
        expect(result.failed).toEqual([]);
    });
});
