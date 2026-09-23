import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');

function sliceRunRouterPass() {
    const start = routerSource.indexOf('export async function runRouterPass(');
    expect(start).toBeGreaterThan(-1);
    const end = routerSource.indexOf('\nasync function applyAction(', start);
    expect(end).toBeGreaterThan(start);
    return routerSource.slice(start, end);
}

describe('Lorebook Agent chat ownership', () => {
    it('pins passChatId and refuses commits after abort or chat switch', () => {
        const fn = sliceRunRouterPass();
        expect(routerSource).toMatch(/import \{[^}]*\bcreateChatCommitGuard\b[^}]*\} from '\.\/src\/state\/pass-affinity\.js'/);
        expect(fn).toContain('const passChatId = getActiveChatId()');
        expect(fn).toContain('createChatCommitGuard(passChatId, getActiveChatId, { signal: _routerSignal })');
        expect(fn).toContain('async function commitOwnedAction(action)');
        expect(fn).toContain('{ canCommit: ownsChat }');
        expect(fn).toContain("result?.status === 'chat_changed'");
        expect(fn).toContain('assertOwnsChat()');

        // Every commit path goes through the ownership wrapper — no bare applyAction call sites.
        expect(fn).toContain('await commitOwnedAction(cleanupAction)');
        expect(fn).toContain('await commitOwnedAction(args)');
        expect(fn).toContain('await commitOwnedAction(basicAction)');
        expect(fn).toContain('await commitOwnedAction(ordinaryAction)');
        const bareApply = [...fn.matchAll(/await applyAction\(/g)];
        expect(bareApply).toHaveLength(1); // only inside commitOwnedAction
        expect(fn).toContain('await applyAction(action, archiveBooks, currentTime, breadcrumb, isManual, { canCommit: ownsChat })');

        // Post-LLM / post-await windows re-check before watermark and history finalization.
        const watermarkAt = fn.indexOf('persistRouterLastRunWatermark(ctx.chat.length)');
        expect(watermarkAt).toBeGreaterThan(-1);
        expect(fn.lastIndexOf('assertOwnsChat()', watermarkAt)).toBeGreaterThan(-1);
        const finalizeAt = fn.indexOf('await finalizeRouterHistorySnapshot(_routerSnapshotRunId, ownsChat)');
        expect(finalizeAt).toBeGreaterThan(watermarkAt);
        expect(fn.indexOf('assertOwnsChat()', finalizeAt)).toBeGreaterThan(finalizeAt);
    });

    it('aborts the Lorebook Agent before onChatChanged flips the live projection', () => {
        expect(indexSource).toContain('stopRouterPass()');
        const abortMarker = '// Lorebook Agent and World Progression both commit via live prefix';
        const abortAt = indexSource.indexOf(abortMarker);
        expect(abortAt).toBeGreaterThan(-1);
        const stopAt = indexSource.indexOf('stopRouterPass()', abortAt);
        const flipAt = indexSource.indexOf('runtimeState.currentChatId = resolvedId', stopAt);
        expect(stopAt).toBeGreaterThan(-1);
        expect(flipAt).toBeGreaterThan(stopAt);
    });

    it('pins chat ownership for /la save before the LLM await', () => {
        const start = routerSource.indexOf('export async function saveSceneToLorebook(');
        expect(start).toBeGreaterThan(-1);
        const end = routerSource.indexOf('\n/**\n * Fetches a manifest of all campaign-scoped lorebook entries', start);
        expect(end).toBeGreaterThan(start);
        const fn = routerSource.slice(start, end);

        expect(fn).toContain('const passChatId = getActiveChatId()');
        expect(fn).toContain('const prefix = getLivePrefix()');
        const llmAt = fn.indexOf('await sendStateRequest(');
        expect(llmAt).toBeGreaterThan(fn.indexOf('const passChatId'));
        expect(llmAt).toBeGreaterThan(fn.indexOf('const prefix'));
        expect(fn.indexOf('ownsChat()', llmAt)).toBeGreaterThan(llmAt);
        // Must not re-resolve the live prefix after the await (arriving chat).
        const pinPrefixAt = fn.indexOf('const prefix = getLivePrefix()');
        expect(pinPrefixAt).toBeGreaterThan(-1);
        expect(fn.indexOf('getLivePrefix()', llmAt)).toBe(-1);
        expect(fn).toContain('`${prefix}_Chronicle`');
        const addAt = fn.indexOf('await addLorebookEntry(');
        expect(addAt).toBeGreaterThan(llmAt);
        expect(fn.indexOf('ownsChat()', addAt)).toBeGreaterThan(addAt);
        expect(fn.indexOf('settings.activeRouterKeys.push(newId)', addAt))
            .toBeGreaterThan(fn.indexOf('ownsChat()', addAt));
    });

    it('pins campaignBooks, PC seed persistence, purge, and disableManagedEntries to the tracked chat', () => {
        const persistStart = routerSource.indexOf('export async function persistArchitectDungeonMap(');
        const persistMid = routerSource.indexOf('export async function persistManualDungeonMapDocument(', persistStart);
        const persistEnd = routerSource.indexOf('/** True when a Location root with this site name already exists.', persistMid);
        expect(persistStart).toBeGreaterThan(-1);
        expect(persistMid).toBeGreaterThan(persistStart);
        expect(persistEnd).toBeGreaterThan(persistMid);
        const persistBlock = routerSource.slice(persistStart, persistEnd);
        expect(persistBlock).toContain('const chatId = getRouterChatId(ctx) || \'\'');
        expect(persistBlock).not.toMatch(/const chatId = ctx\.chatId/);

        const disableStart = routerSource.indexOf('export async function disableManagedEntries(');
        const disableEnd = routerSource.indexOf('\n/**\n * Removes duplicates and empty strings', disableStart);
        expect(disableStart).toBeGreaterThan(-1);
        expect(disableEnd).toBeGreaterThan(disableStart);
        const disableFn = routerSource.slice(disableStart, disableEnd);
        expect(disableFn).toContain('const chatId = getActiveChatId() || \'\'');
        expect(disableFn).not.toMatch(/const chatId = ctx\.chatId/);

        const purgeStart = routerSource.indexOf('export async function purgeWorldHistoryForChat(');
        const purgeEnd = routerSource.indexOf('\n/**\n * Parses an in-world time string', purgeStart);
        expect(purgeStart).toBeGreaterThan(-1);
        expect(purgeEnd).toBeGreaterThan(purgeStart);
        const purgeFn = routerSource.slice(purgeStart, purgeEnd);
        expect(purgeFn).toContain('const chatId = getActiveChatId() || \'\'');
        expect(purgeFn).not.toMatch(/const chatId = ctx\.chatId/);
    });
});
