import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
    cleanupSupersededHistoryFiles,
    countLegacyHistories,
    holdLegacyHistories,
    hydrateChatHistories,
    hydrateGlobalHistories,
    hydrateProfileHistories,
    migrateLegacyHistories,
    persistChatHistories,
    persistGlobalHistories,
    removeUnreferencedHistoryFile,
} from '../src/state/history-file-storage.js';

let files;
let registry;
let failUpload;
let diskSettings;
let onUpload;

beforeEach(() => {
    files = new Map();
    registry = { attachments: [], disabled_attachments: [] };
    failUpload = false;
    diskSettings = null;
    onUpload = null;
    holdLegacyHistories({ chatLinkEnabled: true, chatStates: {}, profiles: {} });
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
            if (onUpload) onUpload();
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
    it('waits for explicit migration of old histories while new chats use files', async () => {
        const settings = { chatLinkEnabled: true, chatStates: {
            old: { memoHistory: ['old memo'], dungeonMapHistory: [null] },
        } };
        holdLegacyHistories(settings);
        expect(countLegacyHistories(settings)).toBe(1);
        expect(await persistChatHistories(settings, 'old')).toBe(false);
        expect(files.size).toBe(0);
        settings.chatStates.new = { memoHistory: ['new memo'], dungeonMapHistory: [null] };
        expect(await persistChatHistories(settings, 'new')).toBe(true);
        const progress = [];
        expect(await migrateLegacyHistories(settings, p => { progress.push(p); })).toMatchObject({ total: 1, migrated: 1, failed: 0 });
        expect(progress).toHaveLength(1);
        expect(countLegacyHistories(settings)).toBe(0);
        expect(JSON.parse(JSON.stringify(settings)).chatStates.old.memoHistory).toBeUndefined();
    });

    it('keeps a failed legacy upload embedded and held until a later explicit retry', async () => {
        const settings = { chatLinkEnabled: true, chatStates: {
            old: { memoHistory: ['safe'], dungeonMapHistory: [null] },
        } };
        holdLegacyHistories(settings);
        failUpload = true;
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(await migrateLegacyHistories(settings)).toMatchObject({ migrated: 0, failed: 1 });
        expect(JSON.parse(JSON.stringify(settings)).chatStates.old.memoHistory).toEqual(['safe']);
        failUpload = false;
        expect(await persistChatHistories(settings, 'old')).toBe(false);
        expect(await migrateLegacyHistories(settings)).toMatchObject({ migrated: 1, failed: 0 });
        errorLog.mockRestore();
    });

    it('includes global-mode and saved-profile histories in the explicit migration', async () => {
        const settings = { chatLinkEnabled: false, memoHistory: ['global'], dungeonMapHistory: [null],
            mapEvolutionThreadsBySite: { harbor: [{ cause: 'A ship departed.' }] },
            profiles: { preset: { memoHistory: ['profile'], dungeonMapHistory: [null],
                mapEvolutionBacklogBySite: { woods: [{ summary: 'The forest changed.' }] } } }, chatStates: {} };
        holdLegacyHistories(settings);
        expect(countLegacyHistories(settings)).toBe(2);
        expect(await persistGlobalHistories(settings)).toBe(false);
        expect(await migrateLegacyHistories(settings)).toMatchObject({ total: 2, migrated: 2, failed: 0 });
        expect(settings.globalHistoryStorage?.url).toMatch(/^\/user\/files\//);
        expect(settings.profiles.preset.historyStorage?.url).toMatch(/^\/user\/files\//);
        expect(countLegacyHistories(settings)).toBe(0);
        const saved = JSON.parse(JSON.stringify(settings));
        expect(saved.mapEvolutionThreadsBySite).toBeUndefined();
        expect(saved.profiles.preset.mapEvolutionBacklogBySite).toBeUndefined();
        expect(await hydrateGlobalHistories(saved)).toBe(true);
        expect(await hydrateProfileHistories(saved, 'preset')).toBe(true);
        expect(saved.mapEvolutionThreadsBySite.harbor[0].cause).toBe('A ship departed.');
        expect(saved.profiles.preset.mapEvolutionBacklogBySite.woods[0].summary)
            .toBe('The forest changed.');
    });

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

    it('stores evolution-only chat records outside settings and restores them', async () => {
        const evolution = {
            mapEvolutionBacklogBySite: { forest: [{ kind: 'quiet', summary: 'A quiet day.' }] },
            mapEvolutionThreadsBySite: { forest: [{ id: 't1', cause: 'A flood began.' }] },
            mapEvolutionWorldReportApplications: { forest: { report1: { status: 'considered' } } },
        };
        const settings = { chatStateProjectionOwner: 'A', memoHistory: [], dungeonMapHistory: [],
            ...structuredClone(evolution), chatStates: { A: { memoHistory: [], dungeonMapHistory: [],
                ...structuredClone(evolution) } } };
        expect(await persistChatHistories(settings, 'A')).toBe(true);
        const saved = JSON.parse(JSON.stringify(settings));
        for (const key of Object.keys(evolution)) {
            expect(saved[key]).toBeUndefined();
            expect(saved.chatStates.A[key]).toBeUndefined();
        }
        expect(await hydrateChatHistories(saved, 'A')).toBe(true);
        for (const [key, value] of Object.entries(evolution)) expect(saved.chatStates.A[key]).toEqual(value);
    });

    it('migrates evolution records alongside a version-1 history file without losing either', async () => {
        const oldData = { version: 1, memoHistory: ['old memo'], dungeonMapHistory: [{ map: 1 }] };
        const oldJson = JSON.stringify(oldData);
        const oldUrl = '/user/files/multihog_history_legacy.json';
        files.set(oldUrl, Uint8Array.from(Buffer.from(oldJson)));
        const settings = { chatLinkEnabled: true, chatStates: { A: {
            historyStorage: { version: 1, owner: 'A', url: oldUrl,
                sha256: createHash('sha256').update(oldJson).digest('hex') },
            mapEvolutionBacklogBySite: { forest: [{ kind: 'commit', summary: 'The flood spread.' }] },
            mapEvolutionThreadsBySite: { forest: [{ id: 'flood', cause: 'Heavy rain.' }] },
            mapEvolutionWorldReportApplications: { forest: { report1: { status: 'applied' } } },
        } } };
        holdLegacyHistories(settings);
        expect(countLegacyHistories(settings)).toBe(1);
        expect(await persistChatHistories(settings, 'A')).toBe(false);
        expect(await migrateLegacyHistories(settings)).toMatchObject({ total: 1, migrated: 1, failed: 0 });
        const saved = JSON.parse(JSON.stringify(settings));
        expect(saved.chatStates.A.memoHistory).toBeUndefined();
        expect(saved.chatStates.A.mapEvolutionThreadsBySite).toBeUndefined();
        expect(saved.chatStates.A.historyStorage.version).toBe(2);
        expect(await hydrateChatHistories(saved, 'A')).toBe(true);
        expect(saved.chatStates.A.memoHistory).toEqual(oldData.memoHistory);
        expect(saved.chatStates.A.dungeonMapHistory).toEqual(oldData.dungeonMapHistory);
        expect(saved.chatStates.A.mapEvolutionBacklogBySite.forest[0].summary).toBe('The flood spread.');
        expect(saved.chatStates.A.mapEvolutionThreadsBySite.forest[0].cause).toBe('Heavy rain.');
        expect(saved.chatStates.A.mapEvolutionWorldReportApplications.forest.report1.status).toBe('applied');
        expect(files.has(oldUrl)).toBe(true);
    });

    it('keeps evolution records in settings when a new file upload fails', async () => {
        const settings = { chatStates: { A: { memoHistory: [], dungeonMapHistory: [],
            mapEvolutionThreadsBySite: { forest: [{ cause: 'A flood began.' }] } } } };
        failUpload = true;
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(await persistChatHistories(settings, 'A')).toBe(false);
        expect(JSON.parse(JSON.stringify(settings)).chatStates.A.mapEvolutionThreadsBySite.forest[0].cause)
            .toBe('A flood began.');
        errorLog.mockRestore();
    });

    it('retries when evolution changes during an in-flight upload', async () => {
        const settings = { chatStates: { A: { memoHistory: [], dungeonMapHistory: [],
            mapEvolutionThreadsBySite: { forest: [{ cause: 'Before upload.' }] } } } };
        let changed = false;
        onUpload = () => {
            if (changed) return;
            changed = true;
            settings.chatStates.A.mapEvolutionThreadsBySite.forest[0].cause = 'After upload.';
        };
        expect(await persistChatHistories(settings, 'A')).toBe(true);
        expect(files.size).toBe(2);
        const saved = JSON.parse(JSON.stringify(settings));
        expect(await hydrateChatHistories(saved, 'A')).toBe(true);
        expect(saved.chatStates.A.mapEvolutionThreadsBySite.forest[0].cause).toBe('After upload.');
    });
});
