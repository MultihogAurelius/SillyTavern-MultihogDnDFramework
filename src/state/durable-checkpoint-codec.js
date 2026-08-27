/**
 * Encoding and validation for complete Multihog persistence checkpoints.
 *
 * A checkpoint hashes the exact UTF-8 JSON payload with `_persistence` omitted.
 * Revisions, never timestamps or payload size, decide which state is newer.
 */

export const DURABLE_FORMAT = 'multihog-durable-state';
export const DURABLE_FORMAT_VERSION = 1;
export const PERSISTENCE_METADATA_KEY = '_persistence';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function randomCommitId() {
    return globalThis.crypto?.randomUUID?.()
        || `mh-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function stateWithoutPersistenceMetadata(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return {};
    const { [PERSISTENCE_METADATA_KEY]: _ignored, ...payload } = state;
    return payload;
}

export function bytesToBase64(bytes) {
    const chunkSize = 0x8000;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

export function base64ToBytes(value) {
    const binary = atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

export function utf8ToBase64(value) {
    return bytesToBase64(textEncoder.encode(String(value)));
}

export function base64ToUtf8(value) {
    return textDecoder.decode(base64ToBytes(value));
}

export async function sha256Hex(bytes) {
    if (!globalThis.crypto?.subtle?.digest) {
        throw new Error('WebCrypto SHA-256 is unavailable');
    }
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function gzip(bytes) {
    if (typeof CompressionStream !== 'function') return null;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes) {
    if (typeof DecompressionStream !== 'function') {
        throw new Error('This checkpoint is gzip-compressed, but DecompressionStream is unavailable');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function mirrorMetadataFromEnvelope(envelope) {
    return {
        formatVersion: envelope.formatVersion,
        revision: envelope.revision,
        parentRevision: envelope.parentRevision,
        parentCommitId: envelope.parentCommitId || null,
        commitId: envelope.commitId,
        writerId: envelope.writerId,
        createdAt: envelope.createdAt,
        payloadChecksum: envelope.payloadChecksum,
    };
}

export async function encodeCheckpoint(state, metadata, options = {}) {
    const payloadJson = JSON.stringify(stateWithoutPersistenceMetadata(state));
    const payloadBytes = textEncoder.encode(payloadJson);
    const payloadChecksum = await sha256Hex(payloadBytes);
    const compressed = options.compress === false ? null : await gzip(payloadBytes);
    const useGzip = compressed && compressed.byteLength < payloadBytes.byteLength;
    const storedBytes = useGzip ? compressed : payloadBytes;

    return {
        format: DURABLE_FORMAT,
        formatVersion: DURABLE_FORMAT_VERSION,
        schemaVersion: String(state?.settingsVersion || ''),
        revision: Number(metadata.revision),
        parentRevision: Number(metadata.parentRevision),
        parentCommitId: metadata.parentCommitId || null,
        commitId: String(metadata.commitId),
        writerId: String(metadata.writerId),
        createdAt: Number(metadata.createdAt),
        committed: true,
        codec: useGzip ? 'gzip' : 'identity',
        payloadChecksum,
        payload: bytesToBase64(storedBytes),
    };
}

export function serializeEnvelope(envelope) {
    return JSON.stringify(envelope);
}

export function parseEnvelope(value) {
    if (typeof value === 'string') return JSON.parse(value);
    return value;
}

export async function decodeCheckpoint(value) {
    const envelope = parseEnvelope(value);
    if (!envelope || typeof envelope !== 'object') throw new Error('Checkpoint envelope is missing');
    if (envelope.format !== DURABLE_FORMAT || envelope.formatVersion !== DURABLE_FORMAT_VERSION) {
        throw new Error(`Unsupported checkpoint format: ${envelope.format || 'unknown'} v${envelope.formatVersion ?? '?'}`);
    }
    if (!envelope.committed) throw new Error('Checkpoint is not committed');
    if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 0) throw new Error('Invalid checkpoint revision');
    if (!Number.isSafeInteger(envelope.parentRevision) || envelope.parentRevision < -1) throw new Error('Invalid parent revision');
    if (!envelope.commitId || !envelope.writerId || !envelope.payloadChecksum || !envelope.payload) {
        throw new Error('Checkpoint metadata is incomplete');
    }

    const storedBytes = base64ToBytes(envelope.payload);
    const payloadBytes = envelope.codec === 'gzip'
        ? await gunzip(storedBytes)
        : envelope.codec === 'identity'
            ? storedBytes
            : (() => { throw new Error(`Unsupported checkpoint codec: ${envelope.codec}`); })();
    const checksum = await sha256Hex(payloadBytes);
    if (checksum !== envelope.payloadChecksum) throw new Error('Checkpoint checksum mismatch');
    const state = JSON.parse(textDecoder.decode(payloadBytes));
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Checkpoint payload is not a settings object');
    state[PERSISTENCE_METADATA_KEY] = mirrorMetadataFromEnvelope(envelope);
    return { envelope, state };
}

export async function validateMirrorState(state) {
    const metadata = state?.[PERSISTENCE_METADATA_KEY];
    if (!metadata || typeof metadata !== 'object') return null;
    if (!Number.isSafeInteger(metadata.revision) || metadata.revision < 0 || !metadata.commitId || !metadata.payloadChecksum) {
        return null;
    }
    const payloadBytes = textEncoder.encode(JSON.stringify(stateWithoutPersistenceMetadata(state)));
    const checksum = await sha256Hex(payloadBytes);
    if (checksum !== metadata.payloadChecksum) return null;
    return {
        envelope: {
            format: DURABLE_FORMAT,
            formatVersion: Number(metadata.formatVersion) || DURABLE_FORMAT_VERSION,
            revision: metadata.revision,
            parentRevision: Number.isSafeInteger(metadata.parentRevision) ? metadata.parentRevision : Math.max(-1, metadata.revision - 1),
            parentCommitId: metadata.parentCommitId || null,
            commitId: metadata.commitId,
            writerId: metadata.writerId || 'unknown',
            createdAt: Number(metadata.createdAt) || 0,
            payloadChecksum: metadata.payloadChecksum,
            committed: true,
            codec: 'mirror',
        },
        state,
    };
}

export function checkpointFileDataUrl(envelope) {
    return `data:application/octet-stream;base64,${utf8ToBase64(serializeEnvelope(envelope))}`;
}
