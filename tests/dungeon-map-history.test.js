import { describe, expect, it } from 'vitest';
import {
    applyDungeonMapHistorySnapshotToBook,
    collectDungeonMapHistorySnapshot,
    resolveDungeonMapFromHistorySnapshot,
} from '../dungeon-reality.js';
import {
    ensureDungeonMapHistory,
    getDungeonMapHistoryEntry,
    getLiveHistoryIndex,
    previousMapForHistoryArchive,
    recordLiveDungeonMapSnapshot,
    sliceMemoAndMapHistory,
    syncLiveMemoHistoryAfterSwipe,
    unshiftMemoAndMapHistory,
} from '../src/state/dungeon-map-history.js';

const mappedBook = {
    entries: {
        0: {
            comment: 'Abbey Undercroft',
            content: '[CORE]A mapped site.[/CORE]\n[MAP]\n{"version":3,"site":"Abbey Undercroft","areas":[],"assets":[{"id":"ghoul","kind":"CREATURE","name":"Crypt Ghoul","location":"crypt","state":"ACTIVE","knowledge":"KNOWN","detail":"Waits.","origin":"INITIAL_MAP"}]}\n[/MAP]',
            extensions: { multihogDungeonMapOperationIds: [{ id: 'day1-a', signature: 'sig' }] },
        },
    },
};

describe('dungeon map history snapshots', () => {
    it('collects [MAP] occupancy and operation ids from location entries', () => {
        const snapshot = collectDungeonMapHistorySnapshot(mappedBook.entries, 'Camp_Locations');
        expect(snapshot).toMatchObject({ bookName: 'Camp_Locations' });
        expect(snapshot.maps).toHaveLength(1);
        expect(snapshot.maps[0].uid).toBe('0');
        expect(snapshot.maps[0].map).toContain('"state":"ACTIVE"');
        expect(snapshot.maps[0].operationIds).toEqual([{ id: 'day1-a', signature: 'sig' }]);
    });

    it('restores occupancy without rewriting CORE prose', () => {
        const snapshot = collectDungeonMapHistorySnapshot(mappedBook.entries, 'Camp_Locations');
        snapshot.maps[0].map = snapshot.maps[0].map.replace('ACTIVE', 'DESTROYED');
        const book = structuredClone(mappedBook);
        expect(applyDungeonMapHistorySnapshotToBook(book, snapshot)).toBe(true);
        expect(book.entries[0].content).toContain('[CORE]A mapped site.[/CORE]');
        expect(book.entries[0].content).toContain('"state":"DESTROYED"');
    });

    it('resolves an overlay document from a history snapshot', () => {
        const snapshot = collectDungeonMapHistorySnapshot(mappedBook.entries, 'Camp_Locations');
        const resolved = resolveDungeonMapFromHistorySnapshot(snapshot, 'Abbey Undercroft, Crypt');
        expect(resolved.document.assets[0].state).toBe('ACTIVE');
        expect(resolved.siteRoot).toBe('Abbey Undercroft');
    });

    it('keeps dungeonMapHistory aligned with memoHistory', () => {
        const settings = { memoHistory: [], dungeonMapHistory: [], historyIndex: -1 };
        const first = { bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'one' }] };
        const second = { bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'two' }] };
        unshiftMemoAndMapHistory(settings, 'memo-a', first);
        unshiftMemoAndMapHistory(settings, 'memo-b', second);
        expect(settings.memoHistory).toEqual(['memo-b', 'memo-a']);
        expect(getDungeonMapHistoryEntry(settings, 0).maps[0].map).toBe('two');
        sliceMemoAndMapHistory(settings, 1);
        expect(settings.memoHistory).toEqual(['memo-a']);
        expect(getDungeonMapHistoryEntry(settings, 0).maps[0].map).toBe('one');
    });

    it('resets historyIndex to the post-slice LIVE slot at 0', () => {
        const settings = {
            memoHistory: ['conflict', 'newer', 'live', 'older'],
            dungeonMapHistory: [null, null, { maps: ['live'] }, { maps: ['older'] }],
            historyIndex: 2,
        };
        sliceMemoAndMapHistory(settings, settings.historyIndex);
        expect(settings.memoHistory).toEqual(['live', 'older']);
        expect(settings.dungeonMapHistory).toEqual([{ maps: ['live'] }, { maps: ['older'] }]);
        expect(settings.historyIndex).toBe(0);
        expect(getLiveHistoryIndex(settings)).toBe(0);
    });

    it('pads missing map history for legacy memo stones', () => {
        const settings = { memoHistory: ['a', 'b'], historyIndex: 0 };
        ensureDungeonMapHistory(settings);
        expect(settings.dungeonMapHistory).toEqual([null, null]);
        recordLiveDungeonMapSnapshot(settings, { maps: [{ uid: '0' }] });
        expect(settings.dungeonMapHistory[0]).toEqual({ maps: [{ uid: '0' }] });
        expect(settings.dungeonMapHistory[1]).toBeNull();
    });

    it('updates the LIVE map slot when historyIndex is not 0', () => {
        const settings = {
            memoHistory: ['displaced', 'live'],
            dungeonMapHistory: [null, { bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'old' }] }],
            historyIndex: 1,
        };
        const next = { bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'explored' }] };
        recordLiveDungeonMapSnapshot(settings, next);
        expect(settings.dungeonMapHistory[0]).toBeNull();
        expect(settings.dungeonMapHistory[1]).toEqual(next);
    });

    it.each([-1, 1, 8, 0.5, '0', undefined, null])('does not invent a LIVE map slot for invalid historyIndex %s', historyIndex => {
        const settings = {
            memoHistory: ['older'],
            dungeonMapHistory: [{ bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'older' }] }],
            historyIndex,
        };
        recordLiveDungeonMapSnapshot(settings, { bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'live' }] });
        expect(settings.dungeonMapHistory).toEqual([{ bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'older' }] }]);
    });

    it('resolves LIVE history index including after Chat Link bumps it past 0', () => {
        expect(getLiveHistoryIndex({ memoHistory: ['a', 'b'], historyIndex: 1 })).toBe(1);
        expect(getLiveHistoryIndex({ memoHistory: ['a'], historyIndex: -1 })).toBe(-1);
        expect(getLiveHistoryIndex({ memoHistory: ['a'], historyIndex: 3 })).toBe(-1);
    });

    it('prefers the post-slice LIVE map when archiving after historyIndex > 0', () => {
        const settings = {
            memoHistory: ['live'],
            dungeonMapHistory: [{ bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'stored-live' }] }],
            historyIndex: 1,
        };
        expect(previousMapForHistoryArchive(settings, { maps: [{ uid: '0', map: 'fresh' }] }))
            .toEqual({ bookName: 'Camp_Locations', maps: [{ uid: '0', map: 'stored-live' }] });
        expect(previousMapForHistoryArchive({ historyIndex: -1, dungeonMapHistory: [null] }, 'fresh')).toBe('fresh');
    });

    it('updates the LIVE stone on swipe when historyIndex is not 0', () => {
        const settings = {
            memoHistory: ['archived-conflict', 'live-memo'],
            dungeonMapHistory: [null, { maps: [{ uid: '0', map: 'live' }] }],
            historyIndex: 1,
        };
        syncLiveMemoHistoryAfterSwipe(settings, 'swipe-result', 'base-memo');
        expect(settings.memoHistory).toEqual(['archived-conflict', 'swipe-result']);
        expect(settings.historyIndex).toBe(1);
        expect(settings.dungeonMapHistory[1]).toEqual({ maps: [{ uid: '0', map: 'live' }] });
    });

    it('shifts only the front LIVE stone when reverting a classic historyIndex-0 swipe', () => {
        const settings = {
            memoHistory: ['swipe-result', 'base-memo'],
            dungeonMapHistory: [{ maps: [{ uid: '0', map: 'new' }] }, { maps: [{ uid: '0', map: 'base' }] }],
            historyIndex: 0,
        };
        syncLiveMemoHistoryAfterSwipe(settings, 'base-memo', 'base-memo');
        expect(settings.memoHistory).toEqual(['base-memo']);
        expect(settings.dungeonMapHistory).toEqual([{ maps: [{ uid: '0', map: 'base' }] }]);
    });

    it('does not shift an archived front stone when reverting a non-zero LIVE swipe', () => {
        const settings = {
            memoHistory: ['archived-conflict', 'swipe-result'],
            dungeonMapHistory: [null, { maps: [{ uid: '0', map: 'live' }] }],
            historyIndex: 1,
        };
        syncLiveMemoHistoryAfterSwipe(settings, 'base-memo', 'base-memo');
        expect(settings.memoHistory).toEqual(['archived-conflict', 'base-memo']);
        expect(settings.historyIndex).toBe(1);
        expect(settings.dungeonMapHistory).toEqual([null, null]);
    });

    it.each([0, 1, 2])('restores the paired base map after a swipe with LIVE at %s', historyIndex => {
        const archived = Array.from({ length: historyIndex }, (_, i) => `archive-${i}`);
        const archivedMaps = archived.map(memo => ({ maps: [memo] }));
        const baseMap = { maps: ['base occupancy'] };
        const settings = {
            memoHistory: [...archived, 'result', 'base', 'older'],
            dungeonMapHistory: [...archivedMaps, { maps: ['abandoned occupancy'] }, baseMap, null],
            historyIndex,
        };
        syncLiveMemoHistoryAfterSwipe(settings, 'base', 'base');
        expect(settings.memoHistory).toEqual([...archived, 'base', 'older']);
        expect(settings.dungeonMapHistory).toEqual([...archivedMaps, baseMap, null]);
        expect(settings.historyIndex).toBe(historyIndex);
        expect(getLiveHistoryIndex(settings)).toBe(historyIndex);
        // Repeating the rollback must not delete the base or an unrelated stone.
        syncLiveMemoHistoryAfterSwipe(settings, 'base', 'base');
        expect(settings.memoHistory).toEqual([...archived, 'base', 'older']);
    });

    it.each([[[]], [['unrelated']]])('keeps LIVE valid when its base is missing and older stones are %j', older => {
        const settings = { memoHistory: ['result', ...older], dungeonMapHistory: [{ maps: ['abandoned'] }, ...older.map(() => null)], historyIndex: 0 };
        syncLiveMemoHistoryAfterSwipe(settings, 'base', 'base');
        expect(settings.memoHistory).toEqual(['base', ...older]);
        expect(settings.dungeonMapHistory).toEqual([null, ...older.map(() => null)]);
        expect(getLiveHistoryIndex(settings)).toBe(0);
    });
});
