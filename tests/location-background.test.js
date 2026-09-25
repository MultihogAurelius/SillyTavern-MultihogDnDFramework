import { beforeEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({ settings: {}, context: {}, images: {} }));
vi.mock('../state-manager.js', () => ({
    getSettings: () => host.settings,
    getActiveChatId: () => host.trackedChatId ?? host.context?.chatId ?? null,
    getEffectiveRouterCampaignPrefix: (chatId) => host.prefixFor?.(chatId) ?? '',
    saveChatState() {},
}));
vi.mock('../memo-processor.js', () => ({}));
vi.mock('../portraits.js', () => ({
    normalizeLocationPath: path => String(path || '').trim(),
    resolveLocationImageWithMeta: path => ({ src: host.images[path] || '' }),
    applyLocationImageToChatBackground: vi.fn(),
    getLinkedPlayerCharacter: () => null,
    isLocationImageGenerating: () => false,
    hasLocationImage: () => false,
    triggerBackgroundLocationGeneration: vi.fn(),
}));
vi.mock('../portrait-storage.js', () => ({}));
vi.mock('../router.js', () => ({
    isWorldInfoBookKnown: vi.fn(),
    scanRecentOutputForPresentNpcs: vi.fn(),
}));
vi.mock('../dungeon-reality.js', () => ({
    stripDungeonMapSection: (content) => content || '',
    resolveDungeonMapForLocation: () => null,
    resolveDungeonMapFromHistorySnapshot: () => null,
}));
vi.mock('../dungeon-map-graph.js', () => ({}));
vi.mock('../src/ui/panel/dungeon-map-panel.js', () => ({}));
vi.mock('../src/state/section-enabled.js', () => ({ isLocationMappingEnabled: () => false }));
vi.mock('../src/app/runtime-state.js', () => ({ runtimeState: {} }));

import { buildImmersionSceneState, loadAllLocationPaths, loadLocationEntryByPath, maybeAutoGenerateImmersionSceneArt, resetImmersionSceneArtTracking, hydrateImmersionSceneArtPath, runRealtimeSceneArtCheck } from '../immersion.js';
import { applyLocationImageToChatBackground, triggerBackgroundLocationGeneration } from '../portraits.js';
import { invalidateChatCommitGuards } from '../src/state/pass-affinity.js';
import { isWorldInfoBookKnown, scanRecentOutputForPresentNpcs } from '../router.js';

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function setLocation(location, chatId = 'chat') {
    host.context = { chatId, chat: [{ mes: `(Location: ${location})` }] };
}

describe('location background syncing', () => {
    it('does not apply a background while the arriving chat still has the departing projection', async () => {
        host.settings.chatLinkEnabled = true;
        host.settings.chatStateProjectionOwner = 'departing-chat';
        await buildImmersionSceneState();
        expect(applyLocationImageToChatBackground).not.toHaveBeenCalled();
    });

    it('does not apply a background when the memo changes during lorebook loading', async () => {
        host.settings.currentMemo = 'old memo';
        const lookup = deferred();
        isWorldInfoBookKnown.mockReturnValueOnce(lookup.promise);
        const pending = buildImmersionSceneState();
        host.settings.currentMemo = 'new memo';
        lookup.resolve(false);
        await pending;
        expect(applyLocationImageToChatBackground).not.toHaveBeenCalled();
    });

    beforeEach(() => {
        vi.resetAllMocks();
        host.settings = { locationImages: true, portraitAutoApplyLocationBackground: true };
        host.images = { A: 'A.png', B: 'B.png' };
        host.trackedChatId = undefined;
        host.prefixFor = undefined;
        setLocation('A');
        vi.spyOn(SillyTavern, 'getContext').mockImplementation(() => host.context);
        isWorldInfoBookKnown.mockResolvedValue(false);
        scanRecentOutputForPresentNpcs.mockResolvedValue([]);
        resetImmersionSceneArtTracking();
    });

    it('applies the current image when opted in', async () => {
        await buildImmersionSceneState();
        expect(applyLocationImageToChatBackground).toHaveBeenCalledExactlyOnceWith('A.png');
    });

    it.each(['portraitAutoApplyLocationBackground', 'locationImages'])('respects disabled %s', async key => {
        host.settings[key] = false;
        await buildImmersionSceneState();
        await globalThis._rpgSyncCurrentLocationBackground('A');
        expect(applyLocationImageToChatBackground).not.toHaveBeenCalled();
    });

    it('leaves the background alone when the location has no image', async () => {
        host.images = {};
        await buildImmersionSceneState();
        expect(applyLocationImageToChatBackground).not.toHaveBeenCalled();
    });

    it('does not reapply an upload scene after a newer location refresh', async () => {
        const npcs = deferred();
        const scanning = deferred();
        scanRecentOutputForPresentNpcs.mockImplementationOnce(() => {
            scanning.resolve();
            return npcs.promise;
        });
        const uploadSync = globalThis._rpgSyncCurrentLocationBackground('A');
        await scanning.promise;
        setLocation('B');
        await buildImmersionSceneState();
        npcs.resolve([]);
        await uploadSync;
        expect(applyLocationImageToChatBackground.mock.calls).toEqual([['A.png'], ['B.png']]);
    });

    it('discards an older scene whose lorebook lookup finishes last', async () => {
        const lookup = deferred();
        isWorldInfoBookKnown.mockReturnValueOnce(lookup.promise);
        const oldScene = buildImmersionSceneState();
        setLocation('B');
        await buildImmersionSceneState();
        lookup.resolve(false);
        await oldScene;
        expect(applyLocationImageToChatBackground.mock.calls).toEqual([['B.png']]);
    });

    it.each(['location', 'chat'])('discards a pending scene when the %s changes without another refresh', async change => {
        const lookup = deferred();
        isWorldInfoBookKnown.mockReturnValueOnce(lookup.promise);
        const oldScene = buildImmersionSceneState();
        setLocation(change === 'location' ? 'B' : 'A', change === 'chat' ? 'other-chat' : 'chat');
        lookup.resolve(false);
        await oldScene;
        expect(applyLocationImageToChatBackground).not.toHaveBeenCalled();
    });

    it('loads the Locations book for the tracked chat when ctx.chatId is stale', async () => {
        host.trackedChatId = 'B';
        host.settings.currentMemo = 'memo';
        host.context = {
            chatId: 'A',
            chat: [{ mes: '(Location: Market)' }],
            loadWorldInfo: vi.fn(async (bookName) => {
                expect(bookName).toBe('CampaignB_Locations');
                return {
                    entries: {
                        0: { comment: 'Market', content: 'from campaign B' },
                    },
                };
            }),
        };
        host.prefixFor = vi.fn((id) => (id === 'B' ? 'CampaignB' : 'CampaignA'));
        isWorldInfoBookKnown.mockImplementation(async (bookName) => bookName === 'CampaignB_Locations');
        host.images = { Market: 'B-market.png' };

        await buildImmersionSceneState('memo', host.settings, { chatId: 'B' });

        expect(host.prefixFor).toHaveBeenCalledWith('B');
        expect(host.context.loadWorldInfo).toHaveBeenCalledWith('CampaignB_Locations');
        expect(applyLocationImageToChatBackground).toHaveBeenCalledExactlyOnceWith('B-market.png');
    });

    it.each(['paths', 'entry'])('loads tracked campaign location %s while the host id is stale', async kind => {
        host.trackedChatId = 'B';
        host.prefixFor = id => `Campaign${id}`;
        host.context.chatId = 'A';
        host.context.loadWorldInfo = vi.fn(async () => ({ entries: { 0: { comment: 'Market', content: 'B market' } } }));
        isWorldInfoBookKnown.mockResolvedValue(true);
        const result = kind === 'paths' ? await loadAllLocationPaths(host.context, host.settings) : await loadLocationEntryByPath('Market', host.settings);
        expect(host.context.loadWorldInfo).toHaveBeenCalledExactlyOnceWith('CampaignB_Locations');
        expect(result).toBeTruthy();
        expect(JSON.stringify(result)).toContain('Market');
    });

    it('rejects a stale scene pin before changing visit tracking or enqueueing generation', () => {
        Object.assign(host.settings, { portraitAutoGenerateSceneView: true, chatStates: { A: {}, B: {} } });
        host.trackedChatId = 'B';
        const before = JSON.stringify(host.settings);
        const scene = { storagePath: 'A', locationImage: 'A.png' };
        maybeAutoGenerateImmersionSceneArt(scene, () => {}, { chatId: 'A' });
        expect(JSON.stringify(host.settings)).toBe(before);
        expect(triggerBackgroundLocationGeneration).not.toHaveBeenCalled();
        // The rejected call must not consume the active chat's first visit.
        maybeAutoGenerateImmersionSceneArt(scene, () => {}, { chatId: 'B' });
        expect(triggerBackgroundLocationGeneration).toHaveBeenCalledExactlyOnceWith('A', expect.any(Function), '', expect.objectContaining({ chatId: 'B' }));
        expect(host.settings.chatStates.A).toEqual({});
        expect(host.settings.chatStates.B.lastImmersionSceneArtPath).toBe('A');
    });

    it.each(['none', 'switch', 'roundtrip'])('real-time scene generation retains tracked chat ownership through loading: %s', async change => {
        Object.assign(host.settings, { portraitAutoGenerateSceneView: true, currentMemo: 'memo', chatStates: { B: {} } });
        host.trackedChatId = 'B';
        host.prefixFor = id => `Campaign${id}`;
        host.context.chatId = 'A';
        const lookup = deferred();
        isWorldInfoBookKnown.mockReturnValueOnce(lookup.promise);
        const pending = runRealtimeSceneArtCheck();
        if (change !== 'none') {
            invalidateChatCommitGuards();
            host.trackedChatId = change === 'roundtrip' ? 'B' : 'C';
        }
        lookup.resolve(false);
        await pending;
        expect(isWorldInfoBookKnown).toHaveBeenCalledWith('CampaignB_Locations', host.context);
        if (change === 'none') {
            expect(triggerBackgroundLocationGeneration).toHaveBeenCalledWith('A', expect.any(Function), '', expect.objectContaining({ chatId: 'B' }));
            expect(host.settings.chatStates.B.lastImmersionSceneArtPath).toBe('A');
        } else {
            expect(triggerBackgroundLocationGeneration).not.toHaveBeenCalled();
            expect(applyLocationImageToChatBackground).not.toHaveBeenCalled();
            expect(host.settings.chatStates).toEqual({ B: {} });
        }
    });

    it.each(['location_enter', 'location_change', 'every_n_outputs'])('respects %s on revisits and reloads', mode => {
        Object.assign(host.settings, { portraitAutoGenerateSceneView: true, portraitRealtimeTriggerMode: mode });
        const enter = (path, image = '') => maybeAutoGenerateImmersionSceneArt({ storagePath: path, locationImage: image }, () => {});
        enter('Town'); // First visit: all modes create missing art.
        expect(triggerBackgroundLocationGeneration).toHaveBeenCalledTimes(1);
        enter('Town', 'town.png'); // Repeated refresh at the same place.
        expect(triggerBackgroundLocationGeneration).toHaveBeenCalledTimes(1);
        enter('Forest');
        expect(triggerBackgroundLocationGeneration).toHaveBeenCalledTimes(2);
        enter('Town', 'town.png');
        expect(triggerBackgroundLocationGeneration).toHaveBeenCalledTimes(mode === 'location_enter' ? 2 : 3);
        resetImmersionSceneArtTracking();
        hydrateImmersionSceneArtPath('chat');
        enter('Town', 'town.png');
        expect(triggerBackgroundLocationGeneration).toHaveBeenCalledTimes(mode === 'location_enter' ? 2 : 3);
    });

    it.each(['location_enter', 'every_n_outputs'])('only every-N mode regenerates for new outputs (%s)', mode => {
        Object.assign(host.settings, { portraitAutoGenerateSceneView: true, portraitRealtimeTriggerMode: mode, portraitRealtimeEveryNOutputs: 2 });
        hydrateImmersionSceneArtPath('chat');
        const scene = { storagePath: 'Town', locationImage: 'town.png' };
        maybeAutoGenerateImmersionSceneArt(scene, () => {});
        triggerBackgroundLocationGeneration.mockClear();
        host.context.chat.push({ mes: 'one' }, { mes: 'two' });
        maybeAutoGenerateImmersionSceneArt(scene, () => {});
        expect(triggerBackgroundLocationGeneration).toHaveBeenCalledTimes(mode === 'every_n_outputs' ? 1 : 0);
    });
});
