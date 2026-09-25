import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { parseAst } from 'rollup/parseAst';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSettings } from '../src/state/settings.js';
import { createChatStateLoader } from '../src/features/chat/chat-state-loader.js';
import { MODULE_NAME } from '../src/state/schema-sections.js';
import { testExtensionSettings } from './setup.js';
import { isRealtimeVisualizationDisabled, setRealtimeVisualizationDisabled } from '../src/state/realtime-visualization-guard.js';

function cancellationHarness() {
    const source = readFileSync(new URL('../portraits.js', import.meta.url), 'utf8');
    const context = createContext({ setRealtimeVisualizationDisabled });
    runInContext('let realtimeLocationGenerationFailed = false, activeRealtimeLocationAbortController = null;', context);
    for (const name of ['stopRealtimeLocationGeneration', 'resetRealtimeLocationGenerationFailure']) {
        const node = parseAst(source).body.map(n => n.declaration || n).find(n => n.id?.name === name);
        runInContext(source.slice(node.start, node.end), context);
    }
    return context;
}

afterEach(() => {
    delete testExtensionSettings[MODULE_NAME];
    setRealtimeVisualizationDisabled(false);
    vi.unstubAllGlobals();
});

describe('visualization settings on chat switch', () => {
    it('aborts departing work without setting the persistent disable latch', () => {
        const context = cancellationHarness();
        context.resetRealtimeLocationGenerationFailure();
        const controller = new AbortController();
        context.controller = controller;
        runInContext('activeRealtimeLocationAbortController = controller;', context);
        context.stopRealtimeLocationGeneration({ disable: false });
        expect(controller.signal.aborted).toBe(true);
        expect(isRealtimeVisualizationDisabled()).toBe(false);
        expect(runInContext('realtimeLocationGenerationFailed', context)).toBe(false);
    });

    it('keeps explicit stops and failure disabling sticky across chat switches', () => {
        const context = cancellationHarness();
        context.stopRealtimeLocationGeneration();
        context.stopRealtimeLocationGeneration({ disable: false });
        expect(isRealtimeVisualizationDisabled()).toBe(true);
        expect(runInContext('realtimeLocationGenerationFailed', context)).toBe(true);
        context.resetRealtimeLocationGenerationFailure();
        expect(isRealtimeVisualizationDisabled()).toBe(false);
    });

    it('preserves global visualization preferences through A → B → A and settings reload', () => {
        const context = cancellationHarness();
        let s = getSettings();
        context.resetRealtimeLocationGenerationFailure();
        const preferences = {
            portraitAutoGenerateSceneView: true, portraitAutoApplyLocationBackground: true,
            portraitRealtimeTriggerMode: 'location_enter', locationImages: true,
            portraitRealtimeEveryNOutputs: 4,
        };
        Object.assign(s, preferences, { chatStates: { A: { currentMemo: 'A' }, B: { currentMemo: 'B', portraitAutoApplyLocationBackground: false } } });
        const chain = new Proxy({}, { get: (_, key) => key === 'length' ? 0 : () => chain });
        vi.stubGlobal('$', () => chain);
        vi.stubGlobal('document', { getElementById: () => null });
        const deps = Object.fromEntries([
            'applyChatNpcRelMaxSettings', 'applyChatTimeFormatSettings', 'hydrateImmersionSceneArtPath',
            'refreshOrderList', 'resetAutoGenerationTracking', 'sanitizeRouterState',
            'scheduleAgentManifestRefresh', 'scheduleAutoApply', 'scheduleDeferred', 'syncMemoView',
            'syncLocationImageDependentUi', 'syncNpcPortraitDependentUi',
        ].map(name => [name, () => {}]));
        const load = createChatStateLoader({ ...deps, getSettings,
            applyQuestSyncAndStripMemo: memo => memo, isAgentPanelVisible: () => false,
            loadStockPromptsFromProfile: value => value,
        });
        for (const chatId of ['A', 'B', 'A']) {
            context.stopRealtimeLocationGeneration({ disable: false });
            expect(load(chatId)).toBe(true);
            expect(getSettings()).toMatchObject(preferences);
            expect(getSettings().currentMemo).toBe(chatId);
        }
        testExtensionSettings[MODULE_NAME] = JSON.parse(JSON.stringify(s));
        expect(getSettings()).toMatchObject(preferences);
    });
});
