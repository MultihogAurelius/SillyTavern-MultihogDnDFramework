import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const snapshotStart = indexSource.indexOf('const snapshotPendingStateForNavigation =');
const snapshotEnd = indexSource.indexOf('// Always run activation when Lorebook Agent is live', snapshotStart);
const lifecycleSource = indexSource.slice(snapshotStart, snapshotEnd);

describe('navigation persistence safety', () => {
    it('never writes SillyTavern settings from hide or unload events', () => {
        expect(snapshotStart).toBeGreaterThan(-1);
        expect(snapshotEnd).toBeGreaterThan(snapshotStart);
        expect(lifecycleSource).toContain("saveChatState(chatId, { skipDiskWrite: true })");
        expect(lifecycleSource).not.toMatch(/\.saveSettings(?:Debounced)?\s*\(/);
        expect(lifecycleSource).not.toContain('resolveCoreSaveSettings');
        expect(lifecycleSource).not.toContain('forceDiskCheckpoint');
    });

    it('uses local snapshots for every lifecycle signal', () => {
        expect(lifecycleSource).toContain("snapshotPendingStateForNavigation('visibilityhidden')");
        expect(lifecycleSource).toContain("snapshotPendingStateForNavigation('pagehide')");
        expect(lifecycleSource).toContain("snapshotPendingStateForNavigation('beforeunload')");
        expect(lifecycleSource).toContain('writeCriticalSettingsBackup(s)');
        expect(lifecycleSource).toContain('writeModuleSchemaBackup(chatId)');
    });
});
