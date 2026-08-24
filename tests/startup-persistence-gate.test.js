import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const chatPersistenceSource = readFileSync(new URL('../src/state/chat-persistence.js', import.meta.url), 'utf8');
const chatLoaderSource = readFileSync(new URL('../src/features/chat/chat-state-loader.js', import.meta.url), 'utf8');

describe('startup settings persistence gate', () => {
    it('coalesces saves until the active chat projection is stable', () => {
        const saveStart = indexSource.indexOf('export function saveSettings(force = false, delay = 0)');
        const doSaveStart = indexSource.indexOf('const doSave = async', saveStart);
        const gateCheck = indexSource.indexOf('if (!_settingsPersistenceGateOpen)', saveStart);

        expect(saveStart).toBeGreaterThan(-1);
        expect(gateCheck).toBeGreaterThan(saveStart);
        expect(gateCheck).toBeLessThan(doSaveStart);
        expect(indexSource.slice(gateCheck, doSaveStart)).toContain('_startupSavePending = true');
        expect(indexSource.slice(gateCheck, doSaveStart)).toContain('_startupSavePendingForce');
    });

    it('releases persistence only after both core settings and a real chat projection are ready', () => {
        const bootLoad = indexSource.indexOf('const restoredBootChat = preserveLiveBootState');
        const portraitMigration = indexSource.indexOf('await runPortraitMigrationIfNeeded()', bootLoad);
        const settingsReadyHook = indexSource.indexOf('eventSource.once(event_types.SETTINGS_LOADED', portraitMigration);
        const gateOpen = indexSource.indexOf('void openSettingsPersistenceGate()', portraitMigration);
        const releaseGuard = indexSource.indexOf('if (!_startupCoreSettingsReady || !_startupChatProjectionReady) return', portraitMigration);

        expect(bootLoad).toBeGreaterThan(-1);
        expect(portraitMigration).toBeGreaterThan(bootLoad);
        expect(settingsReadyHook).toBeGreaterThan(portraitMigration);
        expect(gateOpen).toBeGreaterThan(portraitMigration);
        expect(gateOpen).toBeLessThan(settingsReadyHook);
        expect(releaseGuard).toBeGreaterThan(portraitMigration);
        expect(releaseGuard).toBeLessThan(gateOpen);
    });

    it('defers the prompt-default startup action until after the gate opens', () => {
        const assignment = indexSource.indexOf('_runPromptDefaultsStartupAction = _runPromptDefaultsDialog');
        const gateOpen = indexSource.indexOf('void openSettingsPersistenceGate()');
        const invocation = indexSource.indexOf('void action()', gateOpen);

        expect(assignment).toBeGreaterThan(-1);
        expect(gateOpen).toBeGreaterThan(assignment);
        expect(invocation).toBeGreaterThan(gateOpen);
        expect(indexSource.slice(assignment, gateOpen)).not.toContain('void _runPromptDefaultsDialog()');
    });

    it('never lets saveChatState bypass the centralized startup gate', () => {
        const saveStart = chatPersistenceSource.indexOf('export function saveChatState(chatId, opts = {})');
        const saveEnd = chatPersistenceSource.indexOf('\n}', chatPersistenceSource.indexOf('void requestSettingsSave()', saveStart));
        const body = chatPersistenceSource.slice(saveStart, saveEnd);

        expect(saveStart).toBeGreaterThan(-1);
        expect(body).toContain('void requestSettingsSave()');
        expect(body).not.toContain('ctx.saveSettings(');
        expect(body).not.toContain('ctx.saveSettingsDebounced(');
    });

    it('does not reset an absent active partition during boot', () => {
        const bootStart = indexSource.indexOf('if (bootChatId && settings.chatLinkEnabled)');
        const bootEnd = indexSource.indexOf('// Compare the just-loaded', bootStart);
        const body = indexSource.slice(bootStart, bootEnd);

        expect(body).toContain('shouldPreserveLiveChatStateOnBoot(settings, bootChatId)');
        expect(body).toContain("saveChatState(bootChatId, { skipDiskWrite: true })");
        expect(body).not.toContain('resetUnseenChatState(settings)');
    });

    it('treats a late first CHAT_CHANGED as deferred boot before mutating live state', () => {
        const handlerStart = indexSource.indexOf('function onChatChanged(newChatId)');
        const handlerEnd = indexSource.indexOf('\n}', indexSource.indexOf('void syncCombatProfile', handlerStart));
        const body = indexSource.slice(handlerStart, handlerEnd);
        const deferredGuard = body.indexOf('const isDeferredBootAttachment');
        const preserve = body.indexOf('shouldPreserveLiveChatStateOnBoot(s, resolvedId)', deferredGuard);
        const snapshot = body.indexOf("saveChatState(resolvedId, { skipDiskWrite: true })", preserve);
        const firstMutation = body.indexOf('resetRouterTick(true)');
        const projectionReady = body.indexOf('markStartupChatProjectionReady(resolvedId)', firstMutation);
        const save = body.indexOf('saveSettings();', projectionReady);

        expect(deferredGuard).toBeGreaterThan(-1);
        expect(preserve).toBeGreaterThan(deferredGuard);
        expect(snapshot).toBeGreaterThan(preserve);
        expect(snapshot).toBeLessThan(firstMutation);
        expect(projectionReady).toBeGreaterThan(firstMutation);
        expect(save).toBeGreaterThan(projectionReady);
    });

    it('records projection ownership on every save and successful load', () => {
        expect(chatPersistenceSource).toContain('s.chatStateProjectionOwner = chatId;');
        expect(chatLoaderSource).toContain('s.chatStateProjectionOwner = chatId;');
    });
});
