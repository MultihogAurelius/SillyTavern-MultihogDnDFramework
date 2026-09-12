import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { canCommitPassForChat } from '../src/state/pass-affinity.js';

it('keeps a new request active when an aborted old request finishes after returning to its chat', async () => {
    const source = readFileSync(new URL('../adventure-companion.js', import.meta.url), 'utf8');
    let finishOld, finishNew;
    const old = new Promise(resolve => { finishOld = resolve; });
    const fresh = new Promise(resolve => { finishNew = resolve; });
    let mode = { history: [] };
    const input = { value: 'first' };
    const context = createContext({
        _panel: {}, _busy: false, _abort: null, _prefs: {}, AbortController, canCommitPassForChat,
        resolveActiveChatId: () => 'A', activeModePrefs: () => mode,
        chatUiRoot: () => ({ querySelector: id => id === '#rt-tutorial-input' ? input : null }),
        savePrefs() {}, renderTranscript() {}, getMessageEl: () => null, readLookbackFromUi() {},
        buildActForUserContext: () => '', buildSystemPrompt: () => '',
        runCompanionAgentLoop: vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(fresh),
    });
    context.setBusy = value => { context._busy = value; };
    for (const name of ['sendMessage', 'abortAdventureCompanionInFlight']) {
        const match = source.match(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));
        runInContext(source.slice(match.index, source.indexOf('\n}', match.index) + 2).replace(/^export /, ''), context);
    }
    const pendingOld = context.sendMessage();
    const oldController = context._abort;
    context.abortAdventureCompanionInFlight();
    expect(oldController.signal.aborted).toBe(true);
    expect(context._busy).toBe(false);
    mode = { history: [] }; input.value = 'second';
    const pendingNew = context.sendMessage();
    const newController = context._abort;
    finishOld('stale reply'); await pendingOld;
    expect(context._abort).toBe(newController);
    expect(context._busy).toBe(true);
    expect(mode.history).toEqual([{ role: 'user', content: 'second' }]);
    finishNew('fresh reply'); await pendingNew;
    expect(mode.history[1].content).toBe('fresh reply');
    expect(context._busy).toBe(false);
});
