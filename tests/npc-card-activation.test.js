import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const hooks = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
const router = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');

describe('NPC card / lore activation after a newly created entry', () => {
    it('injects agent-owned lore even when native keyword activation is on', () => {
        const nativeGate = hooks.indexOf('if (isLorebookAgentRuntimeActive(settings) && !settings.routerNativeKeywordActivation && content)');
        const agentOwned = hooks.indexOf('## ACTIVE LORE (AGENT)');
        expect(nativeGate).toBeGreaterThanOrEqual(0);
        expect(agentOwned).toBeGreaterThan(nativeGate);
        const agentSlice = hooks.slice(nativeGate, agentOwned);
        expect(agentSlice).toContain('Agent-owned entries');
        expect(agentSlice).toContain('settings.routerNativeKeywordActivation');
        expect(agentSlice).toContain('alreadyInjected = settings.routerNativeKeywordActivation');
        expect(hooks).toContain('loreInjections += `\\n## ACTIVE LORE (AGENT)\\n${agentBlock.trim()}\\n`');
    });

    it('does not nest agent-owned injection inside the user-message content gate', () => {
        const start = hooks.indexOf('let triggered = [];');
        const agent = hooks.indexOf('const agentOwned = (settings.activeRouterKeys || [])');
        expect(start).toBeGreaterThanOrEqual(0);
        expect(agent).toBeGreaterThan(start);
        const between = hooks.slice(start, agent);
        expect(between).not.toMatch(/if \(content\) \{[\s\S]*const agentOwned/);
        expect(between).toContain('if (isLorebookAgentRuntimeActive(settings) && !skipInjection)');
    });

    it('records the NPCs book on campaignBooks and persists settings after Add NPC', () => {
        const creatorStart = panel.indexOf('const createNpcFromCharCard = async');
        const creatorEnd = panel.indexOf('const minimalReviewNpcWithAI = async', creatorStart);
        const creator = panel.slice(creatorStart, creatorEnd);
        expect(creator).toContain('rememberCampaignBook(bookName, s)');
        expect(creator).toContain('void saveSettings()');
        expect(creator).toContain('updateWorldInfoCache(bookName, bookData)');
        expect(creator.indexOf('rememberCampaignBook')).toBeLessThan(creator.indexOf('void saveSettings()'));
        expect(creator.indexOf('/world state=on')).toBeGreaterThan(creator.indexOf('updateWorldInfoList'));
        expect(creator).not.toContain('setTimeout(r, 300)');
    });

    it('writes disk-fresh lorebooks back into ST worldInfoCache on a full manifest refresh', () => {
        expect(router).toContain('if (!skipUpdate) await updateWorldInfoCache(n, b)');
        expect(router).toContain('export async function updateWorldInfoCache');
        expect(router).toContain('export function rememberCampaignBook');
        expect(router).toContain('resolveBooksToScan(knownBooks, registryNames, prefix');
    });
});
