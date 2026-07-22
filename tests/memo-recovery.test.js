import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoRecoveryManager, MAX_RECOVERY_CHATS, RECOVERY_STORAGE_KEY } from '../memo-recovery.js';

function makeManager(settings, hooks = {}) {
    return createMemoRecoveryManager({
        getSettings: () => settings,
        saveSettings: hooks.saveSettings || vi.fn(),
        updateUIMemo: hooks.updateUIMemo || vi.fn(),
        refreshRenderedView: hooks.refreshRenderedView || vi.fn(),
        syncMemoView: hooks.syncMemoView || vi.fn(),
        escapeHtml: (value) => String(value),
    });
}

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete globalThis.toastr;
    globalThis.SillyTavern = {
        getContext: () => ({ extensionSettings: {}, chatId: 'vitest-chat' }),
    };
});

describe('memo recovery manager', () => {
    it('snapshots the live memo and retains only the newest bounded set of chats', () => {
        const settings = { currentMemo: 'A durable memo', lastDelta: 'delta', quests: [{ title: 'Quest' }] };
        const manager = makeManager(settings);
        let timestamp = 1_000;
        vi.spyOn(Date, 'now').mockImplementation(() => ++timestamp);

        for (let index = 0; index <= MAX_RECOVERY_CHATS; index++) {
            settings.currentMemo = `Memo ${index}`;
            manager.snapshotMemoToLocalStorage(`chat-${index}`, { force: true });
        }

        const snapshots = JSON.parse(localStorage.getItem(RECOVERY_STORAGE_KEY));
        expect(Object.keys(snapshots)).toHaveLength(MAX_RECOVERY_CHATS);
        expect(snapshots['chat-8']).toMatchObject({
            currentMemo: 'Memo 8',
            lastDelta: 'delta',
            quests: [{ title: 'Quest' }],
        });
    });

    it('does not replace a richer local backup with a shorter memo by default', () => {
        const settings = { currentMemo: 'A longer browser backup', lastDelta: '', quests: [] };
        const manager = makeManager(settings);
        manager.snapshotMemoToLocalStorage('chat-1', { force: true });
        settings.currentMemo = 'short';
        manager.snapshotMemoToLocalStorage('chat-1', { force: true });

        const snapshots = JSON.parse(localStorage.getItem(RECOVERY_STORAGE_KEY));
        expect(snapshots['chat-1'].currentMemo).toBe('A longer browser backup');
    });

    it('restores a selected local backup and refreshes dependent views', async () => {
        const settings = { currentMemo: 'disk memo', lastDelta: 'disk delta', quests: [] };
        const hooks = {
            saveSettings: vi.fn(),
            updateUIMemo: vi.fn(),
            refreshRenderedView: vi.fn(),
            syncMemoView: vi.fn(),
        };
        const manager = makeManager(settings, hooks);
        localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({
            'chat-1': { ts: Date.now(), currentMemo: 'local memo', lastDelta: 'local delta', quests: [{ title: 'Recovered' }] },
        }));
        globalThis.toastr = { success: vi.fn() };
        globalThis.SillyTavern = {
            getContext: () => ({ callGenericPopup: vi.fn().mockResolvedValue(true) }),
        };

        await manager.ensureLocalMemoRecovery('chat-1');

        expect(settings).toMatchObject({
            currentMemo: 'local memo',
            lastDelta: 'local delta',
            quests: [{ title: 'Recovered' }],
        });
        expect(hooks.saveSettings).toHaveBeenCalledWith(true);
        expect(hooks.updateUIMemo).toHaveBeenCalledWith('local memo');
        expect(hooks.refreshRenderedView).toHaveBeenCalledOnce();
        expect(hooks.syncMemoView).toHaveBeenCalledOnce();
        expect(globalThis.toastr.success).toHaveBeenCalledOnce();
    });
});
