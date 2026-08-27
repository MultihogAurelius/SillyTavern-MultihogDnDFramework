/* Web Worker: keep JSON serialization, SHA-256, and compression off the UI thread. */

const encoder = new TextEncoder();

function bytesToBase64(bytes) {
    const chunkSize = 0x8000;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    return btoa(binary);
}

async function checksum(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

self.onmessage = async event => {
    try {
        const { state, metadata } = event.data || {};
        const { _persistence: _ignored, ...payload } = state || {};
        const payloadBytes = encoder.encode(JSON.stringify(payload));
        const payloadChecksum = await checksum(payloadBytes);
        let storedBytes = payloadBytes;
        let codec = 'identity';
        if (typeof CompressionStream === 'function') {
            const stream = new Blob([payloadBytes]).stream().pipeThrough(new CompressionStream('gzip'));
            const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
            if (compressed.byteLength < payloadBytes.byteLength) {
                storedBytes = compressed;
                codec = 'gzip';
            }
        }
        self.postMessage({
            envelope: {
                format: 'multihog-durable-state',
                formatVersion: 1,
                schemaVersion: String(state?.settingsVersion || ''),
                revision: metadata.revision,
                parentRevision: metadata.parentRevision,
                parentCommitId: metadata.parentCommitId || null,
                commitId: metadata.commitId,
                writerId: metadata.writerId,
                createdAt: metadata.createdAt,
                committed: true,
                codec,
                payloadChecksum,
                payload: bytesToBase64(storedBytes),
            },
        });
    } catch (error) {
        self.postMessage({ error: error?.message || String(error) });
    }
};
