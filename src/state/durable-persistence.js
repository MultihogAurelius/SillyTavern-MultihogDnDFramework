import {
    DURABLE_FORMAT_VERSION,
    PERSISTENCE_METADATA_KEY,
    decodeCheckpoint,
    encodeCheckpoint,
    mirrorMetadataFromEnvelope,
    randomCommitId,
    validateMirrorState,
} from './durable-checkpoint-codec.js';
import {
    createIndexedDbCheckpointStore,
    createServerCheckpointStore,
} from './durable-persistence-storage.js';

const DRAFT_DELAY_MS = 250;
const RETRY_DELAYS_MS = [1000, 5000, 30000];

function sourcePriority(candidate) {
    if (candidate.source === 'server') return 3;
    if (candidate.source === 'mirror') return 2;
    if (candidate.source === 'local') return 1;
    return 0;
}

function compareCandidates(left, right) {
    return right.envelope.revision - left.envelope.revision
        || sourcePriority(right) - sourcePriority(left)
        || String(right.envelope.commitId).localeCompare(String(left.envelope.commitId));
}

export function selectRecoveryCandidate({ durableCandidates = [], localCandidates = [] }) {
    const durable = [...durableCandidates].sort(compareCandidates)[0] || null;
    if (!durable) return [...localCandidates].sort(compareCandidates)[0] || null;

    let head = durable;
    const remaining = [...localCandidates];
    while (true) {
        const children = remaining.filter(candidate => (
            candidate.envelope.parentRevision === head.envelope.revision
            && (candidate.envelope.parentCommitId || null) === (head.envelope.commitId || null)
            && candidate.envelope.revision === head.envelope.revision + 1
        ));
        if (!children.length) break;
        children.sort(compareCandidates);
        head = children[0];
        remaining.splice(remaining.indexOf(head), 1);
    }
    return head;
}

function sameCommit(left, right) {
    return !!left && !!right
        && left.envelope.revision === right.envelope.revision
        && left.envelope.commitId === right.envelope.commitId
        && left.envelope.payloadChecksum === right.envelope.payloadChecksum;
}

function cloneState(state) {
    if (typeof structuredClone === 'function') return structuredClone(state);
    return JSON.parse(JSON.stringify(state));
}

async function encodeInWorker(state, metadata) {
    if (typeof Worker !== 'function') return encodeCheckpoint(state, metadata);
    return new Promise((resolve, reject) => {
        let settled = false;
        const worker = new Worker(new URL('./durable-serializer-worker.js', import.meta.url), { type: 'module' });
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            worker.terminate();
            reject(new Error('Checkpoint serialization worker timed out'));
        }, 60000);
        worker.onmessage = event => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            worker.terminate();
            if (event.data?.error) reject(new Error(event.data.error));
            else resolve(event.data.envelope);
        };
        worker.onerror = event => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            worker.terminate();
            reject(event.error || new Error(event.message || 'Checkpoint serialization worker failed'));
        };
        worker.postMessage({ state, metadata });
    }).catch(error => {
        console.warn('[RPG Tracker] Persistence worker unavailable; using foreground serializer.', error);
        return encodeCheckpoint(state, metadata);
    });
}

async function validateEnvelopeCandidate(envelope, source, slot = null) {
    try {
        const decoded = await decodeCheckpoint(envelope);
        return { ...decoded, source, slot };
    } catch (error) {
        console.warn(`[RPG Tracker] Ignoring invalid ${source} checkpoint${slot ? ` ${slot.toUpperCase()}` : ''}:`, error);
        return null;
    }
}

function syntheticLegacyCandidate(state) {
    return {
        source: 'mirror',
        slot: null,
        state,
        envelope: {
            formatVersion: DURABLE_FORMAT_VERSION,
            revision: 0,
            parentRevision: -1,
            parentCommitId: null,
            commitId: 'legacy-settings-json',
            writerId: 'legacy',
            createdAt: 0,
            committed: true,
            codec: 'mirror',
            payloadChecksum: null,
        },
    };
}

export class DurablePersistenceManager {
    constructor({ settingsRoot, moduleName, getRequestHeaders, chatId = null, localStore, serverStore, onStatus } = {}) {
        this.settingsRoot = settingsRoot;
        this.moduleName = moduleName;
        this.getRequestHeaders = getRequestHeaders;
        this.chatId = chatId;
        this.localStore = localStore || createIndexedDbCheckpointStore();
        this.serverStore = serverStore || createServerCheckpointStore({ getRequestHeaders });
        this.onStatus = typeof onStatus === 'function' ? onStatus : () => {};
        this.writerId = null;
        this.head = null;
        this.serverSlots = { a: null, b: null };
        this.initialized = false;
        this.dirtyGeneration = 0;
        this.safeGeneration = 0;
        this.pendingLocal = 0;
        this.pendingServer = 0;
        this.pendingDraft = false;
        this.localAvailable = true;
        this.serverAvailable = true;
        this.lastError = null;
        this.checkpointQueue = Promise.resolve();
        this.serverQueue = Promise.resolve();
        this.latestEnvelope = null;
        this.draftTimer = null;
        this.draftRequest = null;
        this.retryTimer = null;
        this.retryAttempt = 0;
    }

    get state() {
        return this.settingsRoot?.[this.moduleName] || {};
    }

    set state(value) {
        this.settingsRoot[this.moduleName] = value;
    }

    status() {
        const dirty = this.dirtyGeneration > this.safeGeneration;
        return {
            initialized: this.initialized,
            revision: this.head?.envelope?.revision ?? 0,
            commitId: this.head?.envelope?.commitId || null,
            dirty,
            pendingLocal: this.pendingLocal,
            pendingServer: this.pendingServer,
            pendingDraft: this.pendingDraft,
            localAvailable: this.localAvailable,
            serverAvailable: this.serverAvailable,
            unsafe: dirty && !this.localAvailable && !this.serverAvailable,
            lastError: this.lastError,
        };
    }

    emitStatus() {
        try { this.onStatus(this.status()); } catch (_) { /* UI status must never break persistence */ }
    }

    markDirty() {
        this.dirtyGeneration += 1;
        this.emitStatus();
        return this.dirtyGeneration;
    }

    shouldBlockUnload() {
        const status = this.status();
        return status.dirty || status.pendingLocal > 0 || status.pendingDraft || status.unsafe;
    }

    async initialize() {
        if (this.initialized) return { winner: this.head, needsCheckpoint: false, draftApplied: false };

        let localEnvelopes = [];
        let draft = null;
        try {
            [localEnvelopes, draft, this.writerId] = await Promise.all([
                this.localStore.listCheckpoints(),
                this.localStore.getDraft(),
                this.localStore.getWriterId(),
            ]);
            if (!this.writerId) {
                this.writerId = randomCommitId();
                await this.localStore.setWriterId(this.writerId);
            }
            this.localAvailable = true;
        } catch (error) {
            this.localAvailable = false;
            this.lastError = error;
            this.writerId = randomCommitId();
            console.warn('[RPG Tracker] IndexedDB checkpoint store is unavailable:', error);
        }

        const slotResults = await Promise.all(['a', 'b'].map(async slot => {
            try {
                const envelope = await this.serverStore.readSlot(slot);
                this.serverAvailable = true;
                return envelope ? validateEnvelopeCandidate(envelope, 'server', slot) : null;
            } catch (error) {
                this.serverAvailable = false;
                this.lastError = error;
                console.warn(`[RPG Tracker] Could not read server checkpoint ${slot.toUpperCase()}:`, error);
                return null;
            }
        }));
        const serverCandidates = (await Promise.all(slotResults)).filter(Boolean);
        for (const candidate of serverCandidates) this.serverSlots[candidate.slot] = candidate;

        const locals = (await Promise.all(localEnvelopes.map(envelope => validateEnvelopeCandidate(envelope, 'local')))).filter(Boolean);
        const rawMirror = this.state;
        const validatedMirror = await validateMirrorState(rawMirror);
        const mirrorCandidate = validatedMirror
            ? { ...validatedMirror, source: 'mirror', slot: null }
            : syntheticLegacyCandidate(rawMirror);
        const winner = selectRecoveryCandidate({
            durableCandidates: [...serverCandidates, mirrorCandidate],
            localCandidates: locals,
        }) || mirrorCandidate;

        const mirrorMatches = validatedMirror && sameCommit(winner, { ...validatedMirror, source: 'mirror' });
        if (!mirrorMatches) this.state = cloneState(winner.state);
        this.head = winner;
        this.latestEnvelope = winner.source === 'mirror' && winner.envelope.codec === 'mirror' ? null : winner.envelope;

        let draftApplied = false;
        if (draft
            && Number(draft.baseRevision) === winner.envelope.revision
            && (draft.baseCommitId || null) === (winner.envelope.commitId || null)
            && (!draft.chatId || !this.chatId || draft.chatId === this.chatId)) {
            const state = this.state;
            state.currentMemo = String(draft.text ?? '');
            if (state.chatLinkEnabled && this.chatId && state.chatStates?.[this.chatId]) {
                state.chatStates[this.chatId].currentMemo = state.currentMemo;
            }
            draftApplied = true;
            this.markDirty();
        }

        this.initialized = true;
        this.emitStatus();

        const needsBootstrap = !validatedMirror && !serverCandidates.length && !locals.length;
        if (needsBootstrap) {
            this.markDirty();
            await this.checkpoint(this.state, { reason: 'bootstrap' });
        }

        return {
            winner,
            recovered: !mirrorMatches,
            needsCheckpoint: !mirrorMatches || draftApplied,
            draftApplied,
        };
    }

    checkpoint(state = this.state, options = {}) {
        const generation = this.dirtyGeneration;
        const operation = async () => {
            const parent = this.head?.envelope || {
                revision: 0,
                commitId: 'legacy-settings-json',
            };
            const metadata = {
                revision: parent.revision + 1,
                parentRevision: parent.revision,
                parentCommitId: parent.commitId || null,
                commitId: randomCommitId(),
                writerId: this.writerId || randomCommitId(),
                createdAt: Date.now(),
            };
            const stateSnapshot = cloneState(state);
            this.pendingLocal += 1;
            this.emitStatus();
            const envelope = await encodeInWorker(stateSnapshot, metadata);
            let localDurable = false;
            try {
                await this.localStore.putCheckpoint(envelope);
                this.localAvailable = true;
                localDurable = true;
            } catch (error) {
                this.localAvailable = false;
                this.lastError = error;
                console.error('[RPG Tracker] Could not journal Multihog state in IndexedDB:', error);
            } finally {
                this.pendingLocal = Math.max(0, this.pendingLocal - 1);
            }

            state[PERSISTENCE_METADATA_KEY] = mirrorMetadataFromEnvelope(envelope);
            const candidate = { envelope, state: stateSnapshot, source: 'local', slot: null };
            candidate.state[PERSISTENCE_METADATA_KEY] = mirrorMetadataFromEnvelope(envelope);
            this.head = candidate;
            this.latestEnvelope = envelope;

            const serverPromise = this.queueServerSync(envelope);
            let serverDurable = false;
            if (!localDurable || options.waitForServer) {
                serverDurable = await serverPromise;
            }
            if (localDurable || serverDurable) {
                this.safeGeneration = Math.max(this.safeGeneration, generation);
                try { await this.localStore.deleteDraft(); } catch (_) { /* local store may be unavailable */ }
            } else {
                this.lastError = this.lastError || new Error('No durable checkpoint target accepted the state');
            }
            this.emitStatus();
            return { envelope, localDurable, serverDurable };
        };

        const result = this.checkpointQueue.then(operation, operation);
        this.checkpointQueue = result.catch(() => {});
        return result;
    }

    chooseServerSlot() {
        const a = this.serverSlots.a;
        const b = this.serverSlots.b;
        if (!a) return 'a';
        if (!b) return 'b';
        if (a.envelope.revision !== b.envelope.revision) return a.envelope.revision < b.envelope.revision ? 'a' : 'b';
        return String(a.envelope.commitId).localeCompare(String(b.envelope.commitId)) <= 0 ? 'a' : 'b';
    }

    queueServerSync(envelope) {
        const operation = async () => {
            this.pendingServer += 1;
            this.emitStatus();
            const slot = this.chooseServerSlot();
            try {
                const verifiedEnvelope = await this.serverStore.writeSlot(slot, envelope);
                const candidate = await validateEnvelopeCandidate(verifiedEnvelope, 'server', slot);
                if (!candidate) throw new Error(`Server checkpoint ${slot.toUpperCase()} failed validation`);
                this.serverSlots[slot] = candidate;
                this.serverAvailable = true;
                this.retryAttempt = 0;
                if (this.retryTimer) clearTimeout(this.retryTimer);
                this.retryTimer = null;
                return true;
            } catch (error) {
                this.serverAvailable = false;
                this.lastError = error;
                console.warn('[RPG Tracker] Server checkpoint sync failed; local journal remains authoritative:', error);
                this.scheduleServerRetry();
                return false;
            } finally {
                this.pendingServer = Math.max(0, this.pendingServer - 1);
                this.emitStatus();
            }
        };
        const result = this.serverQueue.then(operation, operation);
        this.serverQueue = result.catch(() => false);
        return result;
    }

    scheduleServerRetry() {
        if (this.retryTimer || !this.latestEnvelope) return;
        const delay = RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)];
        this.retryAttempt += 1;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            void this.queueServerSync(this.latestEnvelope);
        }, delay);
    }

    recordMemoDraft(chatId, text) {
        if (!this.initialized) return;
        this.draftRequest = {
            chatId: chatId || null,
            text: String(text ?? ''),
            baseRevision: this.head?.envelope?.revision ?? 0,
            baseCommitId: this.head?.envelope?.commitId || null,
            createdAt: Date.now(),
        };
        this.pendingDraft = true;
        this.emitStatus();
        if (this.draftTimer) clearTimeout(this.draftTimer);
        this.draftTimer = setTimeout(() => {
            this.draftTimer = null;
            const draft = this.draftRequest;
            void this.localStore.putDraft(draft).then(() => {
                this.localAvailable = true;
            }).catch(error => {
                this.localAvailable = false;
                this.lastError = error;
                console.error('[RPG Tracker] Could not journal memo draft:', error);
            }).finally(() => {
                if (this.draftRequest === draft) this.pendingDraft = false;
                this.emitStatus();
            });
        }, DRAFT_DELAY_MS);
    }

    async flush({ server = false } = {}) {
        if (this.draftTimer && this.draftRequest) {
            clearTimeout(this.draftTimer);
            this.draftTimer = null;
            const draft = this.draftRequest;
            try {
                await this.localStore.putDraft(draft);
                this.localAvailable = true;
            } catch (error) {
                this.localAvailable = false;
                this.lastError = error;
            } finally {
                this.pendingDraft = false;
                this.emitStatus();
            }
        }
        await this.checkpointQueue;
        if (server && this.latestEnvelope) {
            await this.queueServerSync(this.latestEnvelope);
        }
        await this.serverQueue;
    }
}

let singleton = null;

export async function initializeDurablePersistence(options) {
    if (!singleton) singleton = new DurablePersistenceManager(options);
    return singleton.initialize();
}

export function markPersistenceDirty() {
    return singleton?.markDirty() ?? 0;
}

export function checkpointMultihogState(state, options) {
    if (!singleton?.initialized) return Promise.resolve(null);
    return singleton.checkpoint(state, options);
}

export function recordMemoDraft(chatId, text) {
    singleton?.recordMemoDraft(chatId, text);
}

export function flushCheckpoint(options) {
    return singleton?.flush(options) || Promise.resolve();
}

export function getPersistenceStatus() {
    return singleton?.status() || {
        initialized: false,
        revision: 0,
        dirty: false,
        pendingLocal: 0,
        pendingServer: 0,
        pendingDraft: false,
        localAvailable: false,
        serverAvailable: false,
        unsafe: false,
        lastError: null,
    };
}

export function shouldBlockPersistenceUnload() {
    return singleton?.shouldBlockUnload() || false;
}

export function resetDurablePersistenceForTests() {
    if (singleton?.draftTimer) clearTimeout(singleton.draftTimer);
    if (singleton?.retryTimer) clearTimeout(singleton.retryTimer);
    singleton = null;
}
