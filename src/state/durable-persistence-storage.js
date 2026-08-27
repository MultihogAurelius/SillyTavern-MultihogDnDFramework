import {
    checkpointFileDataUrl,
    decodeCheckpoint,
    parseEnvelope,
    serializeEnvelope,
} from './durable-checkpoint-codec.js';

const DB_NAME = 'multihog-durable-persistence';
const DB_VERSION = 1;
const CHECKPOINT_STORE = 'checkpoints';
const DRAFT_STORE = 'drafts';
const META_STORE = 'meta';
const MAX_LOCAL_CHECKPOINTS = 5;

function requestPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
}

function transactionPromise(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted'));
    });
}

export function createIndexedDbCheckpointStore(indexedDb = globalThis.indexedDB) {
    let databasePromise = null;

    function open() {
        if (!indexedDb?.open) return Promise.reject(new Error('IndexedDB is unavailable'));
        if (databasePromise) return databasePromise;
        databasePromise = new Promise((resolve, reject) => {
            const request = indexedDb.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
                    const store = db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'commitId' });
                    store.createIndex('revision', 'revision');
                }
                if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE, { keyPath: 'key' });
                if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not open IndexedDB'));
            request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab'));
        }).catch(error => {
            databasePromise = null;
            throw error;
        });
        return databasePromise;
    }

    return {
        async listCheckpoints() {
            const db = await open();
            const transaction = db.transaction(CHECKPOINT_STORE, 'readonly');
            const records = await requestPromise(transaction.objectStore(CHECKPOINT_STORE).getAll());
            await transactionPromise(transaction);
            return records
                .sort((left, right) => right.revision - left.revision || String(right.commitId).localeCompare(String(left.commitId)))
                .map(record => record.envelope);
        },

        async putCheckpoint(envelope) {
            const db = await open();
            const transaction = db.transaction(CHECKPOINT_STORE, 'readwrite');
            const store = transaction.objectStore(CHECKPOINT_STORE);
            store.put({
                commitId: envelope.commitId,
                revision: envelope.revision,
                createdAt: envelope.createdAt,
                envelope,
            });
            const records = await requestPromise(store.getAll());
            const obsolete = records
                .sort((left, right) => right.revision - left.revision || String(right.commitId).localeCompare(String(left.commitId)))
                .slice(MAX_LOCAL_CHECKPOINTS);
            for (const record of obsolete) store.delete(record.commitId);
            await transactionPromise(transaction);
        },

        async getDraft() {
            const db = await open();
            const transaction = db.transaction(DRAFT_STORE, 'readonly');
            const record = await requestPromise(transaction.objectStore(DRAFT_STORE).get('memo'));
            await transactionPromise(transaction);
            return record || null;
        },

        async putDraft(draft) {
            const db = await open();
            const transaction = db.transaction(DRAFT_STORE, 'readwrite');
            transaction.objectStore(DRAFT_STORE).put({ key: 'memo', ...draft });
            await transactionPromise(transaction);
        },

        async deleteDraft() {
            const db = await open();
            const transaction = db.transaction(DRAFT_STORE, 'readwrite');
            transaction.objectStore(DRAFT_STORE).delete('memo');
            await transactionPromise(transaction);
        },

        async getWriterId() {
            const db = await open();
            const transaction = db.transaction(META_STORE, 'readonly');
            const record = await requestPromise(transaction.objectStore(META_STORE).get('writerId'));
            await transactionPromise(transaction);
            return record?.value || null;
        },

        async setWriterId(value) {
            const db = await open();
            const transaction = db.transaction(META_STORE, 'readwrite');
            transaction.objectStore(META_STORE).put({ key: 'writerId', value });
            await transactionPromise(transaction);
        },
    };
}

const SLOT_FILES = {
    a: 'multihog_state_a.bin',
    b: 'multihog_state_b.bin',
};

export function createServerCheckpointStore({ fetchFn = globalThis.fetch, getRequestHeaders }) {
    if (typeof fetchFn !== 'function') throw new Error('fetch is unavailable');

    return {
        async readSlot(slot) {
            const filename = SLOT_FILES[slot];
            if (!filename) throw new Error(`Unknown checkpoint slot: ${slot}`);
            const response = await fetchFn(`/user/files/${filename}?v=${Date.now()}-${Math.random()}`, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'same-origin',
            });
            if (response.status === 404) return null;
            if (!response.ok) throw new Error(`Checkpoint ${slot.toUpperCase()} read failed (${response.status})`);
            return parseEnvelope(await response.text());
        },

        async writeSlot(slot, envelope) {
            const filename = SLOT_FILES[slot];
            if (!filename) throw new Error(`Unknown checkpoint slot: ${slot}`);
            const response = await fetchFn('/api/files/upload', {
                method: 'POST',
                headers: getRequestHeaders(),
                credentials: 'same-origin',
                body: JSON.stringify({
                    name: filename,
                    data: checkpointFileDataUrl(envelope),
                }),
            });
            if (!response.ok) throw new Error(`Checkpoint ${slot.toUpperCase()} upload failed (${response.status})`);
            const verified = await this.readSlot(slot);
            const decoded = await decodeCheckpoint(verified);
            if (decoded.envelope.commitId !== envelope.commitId
                || decoded.envelope.revision !== envelope.revision
                || decoded.envelope.payloadChecksum !== envelope.payloadChecksum) {
                throw new Error(`Checkpoint ${slot.toUpperCase()} read-back verification failed`);
            }
            return verified;
        },

        serializeEnvelope,
    };
}

export { MAX_LOCAL_CHECKPOINTS, SLOT_FILES };
