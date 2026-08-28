import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
    encodeCheckpoint,
    mirrorMetadataFromEnvelope,
    PERSISTENCE_METADATA_KEY,
    validateMirrorState,
} from '../src/state/durable-checkpoint-codec.js';
import {
    MAX_LOCAL_CHECKPOINTS,
    planLocalCheckpointRetention,
} from '../src/state/durable-persistence-storage.js';
import {
    DurablePersistenceManager,
    resetDurablePersistenceForTests,
    selectRecoveryCandidate,
} from '../src/state/durable-persistence.js';

function makeRecord(revision, commitId, parentRevision = revision - 1, parentCommitId = `c${revision - 1}`) {
    return {
        commitId,
        revision,
        createdAt: revision,
        envelope: {
            commitId,
            revision,
            parentRevision,
            parentCommitId,
        },
    };
}

function makeCandidate(source, revision, commitId, parentRevision, parentCommitId, memo = `memo-${revision}`) {
    return {
        source,
        envelope: {
            revision,
            commitId,
            parentRevision,
            parentCommitId,
            payloadChecksum: `sum-${commitId}`,
        },
        state: { currentMemo: memo },
    };
}

function createMemoryLocalStore() {
    const checkpoints = new Map();
    let draft = null;
    let writerId = null;
    let durableFloorRevision = -1;
    return {
        get lastDurableFloorRevision() { return durableFloorRevision; },
        async listCheckpoints() {
            return [...checkpoints.values()]
                .sort((a, b) => b.revision - a.revision || String(b.commitId).localeCompare(String(a.commitId)))
                .map(record => record.envelope);
        },
        async putCheckpoint(envelope, { durableFloorRevision: floor = -1 } = {}) {
            durableFloorRevision = floor;
            checkpoints.set(envelope.commitId, {
                commitId: envelope.commitId,
                revision: envelope.revision,
                createdAt: envelope.createdAt,
                envelope,
            });
            const { drop } = planLocalCheckpointRetention([...checkpoints.values()], {
                durableFloorRevision: floor,
            });
            for (const record of drop) checkpoints.delete(record.commitId);
        },
        async getDraft() { return draft ? { ...draft } : null; },
        async putDraft(next) { draft = { key: 'memo', ...next }; },
        async deleteDraft() { draft = null; },
        async getWriterId() { return writerId; },
        async setWriterId(value) { writerId = value; },
        checkpointCount() { return checkpoints.size; },
        revisions() {
            return [...checkpoints.values()].map(record => record.revision).sort((a, b) => a - b);
        },
    };
}

function createRejectingServerStore() {
    return {
        async readSlot() { return null; },
        async writeSlot() { throw new Error('server unavailable'); },
    };
}

describe('planLocalCheckpointRetention', () => {
    it('keeps the entire unsynced tail above the durable floor so recovery bridges survive', () => {
        const records = [8, 9, 10, 11, 12, 13, 14, 15, 16].map(revision => makeRecord(revision, `c${revision}`));
        const { keep, drop } = planLocalCheckpointRetention(records, {
            maxLocal: 2,
            durableFloorRevision: 10,
        });
        const keptRevisions = keep.map(record => record.revision).sort((a, b) => a - b);
        // Unsynced bridge+tip must survive even when that exceeds maxLocal.
        expect(keptRevisions).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
        expect(drop.map(record => record.revision)).toEqual([8]);
    });

    it('legacy max-5 prune without a floor would orphan the tip from a lagged mirror', () => {
        const records = [10, 11, 12, 13, 14, 15, 16].map(revision => makeRecord(revision, `c${revision}`));
        const obsolete = [...records]
            .sort((left, right) => right.revision - left.revision || String(right.commitId).localeCompare(String(left.commitId)))
            .slice(MAX_LOCAL_CHECKPOINTS);
        expect(obsolete.map(record => record.revision).sort((a, b) => a - b)).toEqual([10, 11]);

        const locals = [12, 13, 14, 15, 16].map(revision => (
            makeCandidate('local', revision, `c${revision}`, revision - 1, `c${revision - 1}`)
        ));
        const winner = selectRecoveryCandidate({
            durableCandidates: [makeCandidate('mirror', 10, 'c10', 9, 'c9')],
            localCandidates: locals,
        });
        expect(winner.envelope.revision).toBe(10);
    });
});

describe('selectRecoveryCandidate with retained unsynced tail', () => {
    it('walks from a lagged durable head to the local tip when bridge commits are kept', () => {
        const locals = [11, 12, 13, 14, 15, 16].map(revision => (
            makeCandidate('local', revision, `c${revision}`, revision - 1, `c${revision - 1}`, `tip-${revision}`)
        ));
        const winner = selectRecoveryCandidate({
            durableCandidates: [makeCandidate('mirror', 10, 'c10', 9, 'c9', 'durable')],
            localCandidates: locals,
        });
        expect(winner.envelope.revision).toBe(16);
        expect(winner.state.currentMemo).toBe('tip-16');
    });
});

describe('DurablePersistenceManager checkpoint safety', () => {
    beforeEach(() => {
        resetDurablePersistenceForTests();
        vi.stubGlobal('Worker', undefined);
    });

    afterEach(() => {
        resetDurablePersistenceForTests();
        vi.unstubAllGlobals();
    });

    it('does not prune unsynced local bridges while the server/mirror floor lags', async () => {
        const localStore = createMemoryLocalStore();
        const settingsRoot = {
            multihog: {
                currentMemo: 'v0',
                settingsVersion: 'test',
            },
        };
        const manager = new DurablePersistenceManager({
            settingsRoot,
            moduleName: 'multihog',
            getRequestHeaders: () => ({}),
            localStore,
            serverStore: createRejectingServerStore(),
        });

        await manager.initialize();
        expect(manager.durableFloorRevision).toBe(0);

        for (let index = 1; index <= 8; index++) {
            manager.markDirty();
            settingsRoot.multihog.currentMemo = `memo-${index}`;
            await manager.checkpoint(settingsRoot.multihog);
        }

        expect(localStore.revisions().length).toBeGreaterThan(MAX_LOCAL_CHECKPOINTS);
        expect(Math.min(...localStore.revisions())).toBeLessThanOrEqual(1);

        const envelopes = await localStore.listCheckpoints();
        const locals = [];
        for (const envelope of envelopes) {
            locals.push({
                source: 'local',
                envelope,
                state: { currentMemo: `recovered-${envelope.revision}` },
            });
        }
        const mirror = makeCandidate('mirror', 0, 'legacy-settings-json', -1, null, 'v0');
        const winner = selectRecoveryCandidate({
            durableCandidates: [mirror],
            localCandidates: locals,
        });
        expect(winner.envelope.revision).toBe(Math.max(...localStore.revisions()));
    });

    it('rebases a newer memo draft instead of deleting it after a stale commit', async () => {
        const localStore = createMemoryLocalStore();
        const settingsRoot = {
            multihog: {
                currentMemo: 'first',
                settingsVersion: 'test',
            },
        };
        const manager = new DurablePersistenceManager({
            settingsRoot,
            moduleName: 'multihog',
            getRequestHeaders: () => ({}),
            chatId: 'chat-1',
            localStore,
            serverStore: createRejectingServerStore(),
        });
        await manager.initialize();
        const baseRevision = manager.head.envelope.revision;
        const baseCommitId = manager.head.envelope.commitId;

        // Commit a frozen snapshot while the live memo (and draft) have already moved on.
        const committedSnapshot = {
            currentMemo: 'first',
            settingsVersion: 'test',
        };
        manager.markDirty();
        await localStore.putDraft({
            chatId: 'chat-1',
            text: 'first then more typing',
            baseRevision,
            baseCommitId,
            createdAt: Date.now(),
        });
        await manager.checkpoint(committedSnapshot);

        const draft = await localStore.getDraft();
        expect(draft).not.toBeNull();
        expect(draft.text).toBe('first then more typing');
        expect(draft.baseRevision).toBe(manager.head.envelope.revision);
        expect(draft.baseCommitId).toBe(manager.head.envelope.commitId);
    });

    it('does not stamp mismatched mirror metadata when live memo moves during encode', async () => {
        const localStore = createMemoryLocalStore();
        const settingsRoot = {
            multihog: {
                currentMemo: 'committed-text',
                settingsVersion: 'test',
            },
        };
        const manager = new DurablePersistenceManager({
            settingsRoot,
            moduleName: 'multihog',
            getRequestHeaders: () => ({}),
            localStore,
            serverStore: createRejectingServerStore(),
        });
        await manager.initialize();

        let releasePut;
        const putGate = new Promise(resolve => { releasePut = resolve; });
        let putWaiting = false;
        const originalPut = localStore.putCheckpoint.bind(localStore);
        localStore.putCheckpoint = async (envelope, options) => {
            putWaiting = true;
            await putGate;
            return originalPut(envelope, options);
        };

        manager.markDirty();
        const pending = manager.checkpoint(settingsRoot.multihog);
        await vi.waitFor(() => expect(putWaiting).toBe(true));
        settingsRoot.multihog.currentMemo = 'committed-text plus extra';
        releasePut();
        await pending;

        // Live object diverged — must not carry the committed snapshot checksum.
        expect(settingsRoot.multihog[PERSISTENCE_METADATA_KEY]).toBeUndefined();
        expect(await validateMirrorState(settingsRoot.multihog)).toBeNull();
        expect(manager.status().dirty).toBe(true);
    });

    it('deletes the draft when the committed snapshot already contains it', async () => {
        const localStore = createMemoryLocalStore();
        const settingsRoot = {
            multihog: {
                currentMemo: 'stable memo',
                settingsVersion: 'test',
            },
        };
        const manager = new DurablePersistenceManager({
            settingsRoot,
            moduleName: 'multihog',
            getRequestHeaders: () => ({}),
            chatId: 'chat-1',
            localStore,
            serverStore: createRejectingServerStore(),
        });
        await manager.initialize();
        await localStore.putDraft({
            chatId: 'chat-1',
            text: 'stable memo',
            baseRevision: manager.head.envelope.revision,
            baseCommitId: manager.head.envelope.commitId,
            createdAt: Date.now(),
        });
        manager.markDirty();
        await manager.checkpoint(settingsRoot.multihog);
        expect(await localStore.getDraft()).toBeNull();
    });
});

describe('mirror metadata helper', () => {
    it('round-trips matching metadata through validateMirrorState', async () => {
        const state = { currentMemo: 'ok', settingsVersion: 'test' };
        const envelope = await encodeCheckpoint(state, {
            revision: 3,
            parentRevision: 2,
            parentCommitId: 'p',
            commitId: 'c',
            writerId: 'w',
            createdAt: 1,
        });
        state[PERSISTENCE_METADATA_KEY] = mirrorMetadataFromEnvelope(envelope);
        const validated = await validateMirrorState(state);
        expect(validated.envelope.revision).toBe(3);
        expect(validated.envelope.commitId).toBe('c');
    });
});
