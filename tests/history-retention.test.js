import { afterEach, describe, expect, it } from 'vitest';
import { MEMO_HISTORY_LIMIT, trimMemoAndMapHistory, unshiftMemoAndMapHistory } from '../src/state/dungeon-map-history.js';
import { getSettings } from '../src/state/settings.js';
import { MODULE_NAME } from '../src/state/schema-sections.js';
import { testExtensionSettings } from './setup.js';

function history(length = 234, live = 0) {
    return {
        currentMemo: live < 0 ? 'unarchived live' : `memo ${live}`,
        memoHistory: Array.from({ length }, (_, i) => `memo ${i}`),
        dungeonMapHistory: Array.from({ length }, (_, i) => ({ maps: [`map ${i}`] })),
        historyIndex: live,
        playerCharacter: { name: 'Keep me' },
    };
}

afterEach(() => { delete testExtensionSettings[MODULE_NAME]; });

describe('paired history retention', () => {
    it('keeps the newest 25 paired stones while preserving live state', () => {
        const s = history();
        trimMemoAndMapHistory(s);
        expect(s.memoHistory).toEqual(history(25).memoHistory);
        expect(s.dungeonMapHistory).toEqual(history(25).dungeonMapHistory);
        expect(s.currentMemo).toBe('memo 0');
        expect(s.historyIndex).toBe(0);
        expect(s.playerCharacter).toEqual({ name: 'Keep me' });
        const serialized = JSON.stringify(s);
        expect(trimMemoAndMapHistory(s)).toBe(false);
        expect(JSON.stringify(s)).toBe(serialized);
    });

    it.each([1, 24, 25, 233])('preserves LIVE and its map when LIVE starts at %s', live => {
        const s = history(234, live);
        const liveMap = s.dungeonMapHistory[live];
        trimMemoAndMapHistory(s);
        expect(s.memoHistory).toHaveLength(25);
        expect(s.dungeonMapHistory).toHaveLength(25);
        expect(s.historyIndex).toBe(Math.min(live, 24));
        expect(s.memoHistory[s.historyIndex]).toBe(s.currentMemo);
        expect(s.dungeonMapHistory[s.historyIndex]).toBe(liveMap);
        expect(s.memoHistory.slice(0, 24)).toEqual(history(24).memoHistory);
    });

    it('does not invent a LIVE stone when LIVE is outside history', () => {
        const s = history(234, -1);
        trimMemoAndMapHistory(s);
        expect(s.historyIndex).toBe(-1);
        expect(s.currentMemo).toBe('unarchived live');
        expect(s.memoHistory).toEqual(history(25).memoHistory);
    });

    it('pads missing map snapshots without guessing occupancy', () => {
        const s = history(100, 99);
        s.dungeonMapHistory = [{ maps: ['only known map'] }];
        trimMemoAndMapHistory(s);
        expect(s.dungeonMapHistory).toHaveLength(25);
        expect(s.dungeonMapHistory[0]).toEqual({ maps: ['only known map'] });
        expect(s.dungeonMapHistory.slice(1)).toEqual(Array(24).fill(null));
    });

    it('keeps 25 → 25 through repeated ordinary State Tracker commits', () => {
        const s = history(25);
        for (let i = 0; i < 120; i++) {
            unshiftMemoAndMapHistory(s, `turn ${i}`, { maps: [`turn map ${i}`] });
            s.historyIndex = 0;
            s.currentMemo = `turn ${i}`;
            expect(s.memoHistory).toHaveLength(MEMO_HISTORY_LIMIT);
            expect(s.dungeonMapHistory).toHaveLength(MEMO_HISTORY_LIMIT);
        }
        expect(s.memoHistory[0]).toBe('turn 119');
        expect(s.memoHistory[24]).toBe('turn 95');
        expect(s.dungeonMapHistory[24]).toEqual({ maps: ['turn map 95'] });
    });

    it.each([undefined, 1])('cleans live, inactive-chat, and profile histories from retention version %s', previousVersion => {
        testExtensionSettings[MODULE_NAME] = {
            ...history(234, 200),
            memoHistoryRetentionVersion: previousVersion,
            chatStates: { inactive: history(234, 100), previousLimit: history(50, 49), small: history(2) },
            profiles: { saved: history(234, 233) },
        };
        const s = getSettings();
        for (const snapshot of [s, s.chatStates.inactive, s.chatStates.previousLimit, s.profiles.saved]) {
            expect(snapshot.memoHistory).toHaveLength(25);
            expect(snapshot.dungeonMapHistory).toHaveLength(25);
            expect(snapshot.memoHistory[snapshot.historyIndex]).toBe(snapshot.currentMemo);
            expect(snapshot.dungeonMapHistory[snapshot.historyIndex].maps[0])
                .toBe(snapshot.currentMemo.replace('memo', 'map'));
        }
        expect(s.chatStates.small.memoHistory).toHaveLength(2);
        const memoArray = s.memoHistory;
        getSettings();
        expect(s.memoHistory).toBe(memoArray);
        expect(s.memoHistoryRetentionVersion).toBe(2);
    });

    it('repairs legacy object stones before applying retention', () => {
        const s = history(60, 59);
        s.memoHistory.unshift({ label: 'Global Edit (Pre-Link)', memo: 'displaced' });
        testExtensionSettings[MODULE_NAME] = s;
        const loaded = getSettings();
        expect(loaded.memoHistory[0]).toBe('displaced');
        expect(loaded.memoHistory[24]).toBe('memo 59');
        expect(loaded.dungeonMapHistory[24]).toEqual({ maps: ['map 59'] });
        expect(loaded.historyIndex).toBe(24);
    });
});
