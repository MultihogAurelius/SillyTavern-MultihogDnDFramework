import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    cleanupSupersededHistoryFiles,
    hydrateChatHistories,
    hydrateGlobalHistories,
    persistChatHistories,
    persistGlobalHistories,
    removeUnreferencedHistoryFile,
} from '../src/state/history-file-storage.js';

let files;
let registry;
let failUpload;
let diskSettings;

beforeEach(() => {
    files = new Map();
    registry = { attachments: [], disabled_attachments: [] };
    failUpload = false;
    diskSettings = null;
    vi.stubGlobal('SillyTavern', { getContext: () => ({
        extensionSettings: registry,
        getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    }) });
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
        if (url === '/api/files/upload') {
            if (failUpload) return new Response('offline', { status: 503 });
            const { name, data } = JSON.parse(options.body);
            const path = `/user/files/${name}`;
            files.set(path, Uint8Array.from(Buffer.from(data, 'base64')));
            return Response.json({ path });
        }
        if (url === '/api/files/delete') {
            const { path } = JSON.parse(options.body);
            files.delete(path);
            return new Response(null, { status: 200 });
        }
        if (url === '/api/settings/get') {
            return Response.json({ settings: JSON.stringify({ extension_settings: { rpg_tracker: diskSettings } }) });
        }
        if (files.has(url)) return new Response(files.get(url));
        return new Response('missing', { status: 404 });
    }));
});

afterEach(() => vi.unstubAllGlobals());

describe('file-backed histories', () => {
    it('uploads paired histories, omits them from settings, and restores them after reload', async () => {
        const settings = {
            chatStateProjectionOwner: 'A',
            memoHistory: ['latest', 'older'], dungeonMapHistory: [{ map: 1 }, null],
            chatStates: { A: { memoHistory: ['latest', 'older'], dungeonMapHistory: [{ map: 1 }, null] } },
        };
        expect(await persistChatHistories(settings, 'A')).toBe(true);
        const pointer = settings.chatStates.A.historyStorage;
        expect(pointer.url).toMatch(/^\/user\/files\/multihog_history_.*\.json(?:\.gz)?$/);
        expect(registry.attachments.some(entry => entry.url === pointer.url)).toBe(true);
        expect(registry.disabled_attachments).toContain(pointer.url);
        expect(settings.memoHistory).toEqual(['latest', 'older']);
        expect(settings.chatStates.A.memoHistory).toEqual(['latest', 'older']);
        const saved = JSON.parse(JSON.stringify(settings));
        expect(saved.memoHistory).toBeUndefined();
        expect(saved.dungeonMapHistory).toBeUndefined();
        expect(saved.chatStates.A.memoHistory).toBeUndefined();
        expect(await hydrateChatHistories(saved, 'A')).toBe(true);
        expect(saved.chatStates.A.memoHistory).toEqual(['latest', 'older']);
        expect(saved.chatStates.A.dungeonMapHistory).toEqual([{ map: 1 }, null]);
    });

    it('keeps legacy arrays in settings if upload fails', async () => {
        const settings = { chatStateProjectionOwner: 'A', memoHistory: ['memo'], dungeonMapHistory: [null],
            chatStates: { A: { memoHistory: ['memo'], dungeonMapHistory: [null] } } };
        failUpload = true;
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(await persistChatHistories(settings, 'A')).toBe(false);
        expect(JSON.parse(JSON.stringify(settings)).chatStates.A.memoHistory).toEqual(['memo']);
        expect(JSON.parse(JSON.stringify(settings)).memoHistory).toEqual(['memo']);
        errorLog.mockRestore();
    });

    it('gives a branch its own file before either history can change', async () => {
        const settings = { chatStates: { A: { memoHistory: ['source'], dungeonMapHistory: [null] } } };
        await persistChatHistories(settings, 'A');
        const original = settings.chatStates.A.historyStorage.url;
        settings.chatStates.B = { memoHistory: ['source'], dungeonMapHistory: [null],
            historyStorage: { ...settings.chatStates.A.historyStorage } };
        await persistChatHistories(settings, 'B');
        expect(settings.chatStates.B.historyStorage.url).not.toBe(original);
        expect(settings.chatStates.A.historyStorage.url).toBe(original);
    });

    it('only deletes a history file after no chat or global state references it', async () => {
        const settings = { chatStates: { A: { memoHistory: ['memo'], dungeonMapHistory: [null] } } };
        await persistChatHistories(settings, 'A');
        const url = settings.chatStates.A.historyStorage.url;
        expect(await removeUnreferencedHistoryFile(settings, url)).toBe(false);
        delete settings.chatStates.A;
        expect(await removeUnreferencedHistoryFile(settings, url)).toBe(true);
        expect(files.has(url)).toBe(false);
        expect(registry.attachments.some(entry => entry.url === url)).toBe(false);
    });

    it('keeps the old file until settings.json confirms the new pointer', async () => {
        const settings = { chatStates: { A: { memoHistory: ['old'], dungeonMapHistory: [null] } } };
        await persistChatHistories(settings, 'A');
        const oldUrl = settings.chatStates.A.historyStorage.url;
        diskSettings = JSON.parse(JSON.stringify(settings));
        settings.chatStates.A.memoHistory = ['new'];
        await persistChatHistories(settings, 'A');
        const newUrl = settings.chatStates.A.historyStorage.url;
        expect(newUrl).not.toBe(oldUrl);
        expect(await cleanupSupersededHistoryFiles(settings)).toBe(false);
        expect(files.has(oldUrl)).toBe(true);
        diskSettings = JSON.parse(JSON.stringify(settings));
        expect(await cleanupSupersededHistoryFiles(settings)).toBe(true);
        expect(files.has(oldUrl)).toBe(false);
        expect(files.has(newUrl)).toBe(true);
    });

    it('stores global-mode history outside settings and restores it', async () => {
        const settings = { memoHistory: ['global'], dungeonMapHistory: [{ map: 2 }], chatStates: {} };
        expect(await persistGlobalHistories(settings)).toBe(true);
        const saved = JSON.parse(JSON.stringify(settings));
        expect(saved.memoHistory).toBeUndefined();
        saved.memoHistory = [];
        saved.dungeonMapHistory = [];
        expect(await hydrateGlobalHistories(saved)).toBe(true);
        expect(saved.memoHistory).toEqual(['global']);
        expect(saved.dungeonMapHistory).toEqual([{ map: 2 }]);
    });
});
