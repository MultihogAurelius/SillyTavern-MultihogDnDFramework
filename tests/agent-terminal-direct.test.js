import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_MAP_EVOLUTION_DIRECT_SYSTEM_PROMPT, selectMapEvolutionSystemPrompt } from '../map-evolution-direct-prompt.js';

describe('agent terminal direct prompts', () => {
    it('moves Lorebook Agent direct prompt into Terminal tabs and removes footer toggle', () => {
        const markup = readFileSync(new URL('../src/ui/panel/panel-markup.js', import.meta.url), 'utf8');
        const builder = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
        const direct = readFileSync(new URL('../src/ui/panel/agent-terminal-direct.js', import.meta.url), 'utf8');
        expect(markup).toContain('Terminal/Direct Prompt');
        expect(markup).toContain('rt-terminal-direct-${tab.id}');
        expect(markup).toContain('rt-terminal-direct-lookback-${tab.id}');
        expect(markup).toContain("state_tracker:");
        expect(markup).toContain("map_evolution:");
        expect(markup).toContain("map_architect:");
        expect(markup).not.toContain('id="rt-agent-prompt-btn"');
        expect(builder).toContain('wireAgentTerminalDirectPrompts');
        expect(builder).not.toContain("queryAgentUi('#rt-agent-prompt-btn')");
        expect(direct).toContain("runRouterPass(combinedNarrative, msg, lookback, true)");
        expect(direct).toContain('directInstruction: msg');
        expect(direct).toContain('inferMapArchitectArgs');
    });

    it('persists per-agent direct prompt drafts', () => {
        const defaults = readFileSync(new URL('../src/state/defaults.js', import.meta.url), 'utf8');
        expect(defaults).toContain("stateTrackerDirectPrompt: ''");
        expect(defaults).toContain("mapEvolutionDirectPrompt: ''");
        expect(defaults).toContain('mapEvolutionDirectLookback: 10');
        expect(defaults).toContain("mapArchitectDirectPrompt: ''");
        expect(defaults).toContain('mapArchitectDirectLookback: 10');
    });
});

describe('map evolution direct prompt', () => {
    it('selects the compact direct prompt only for non-empty instructions', () => {
        expect(DEFAULT_MAP_EVOLUTION_DIRECT_SYSTEM_PROMPT).toContain('Map Evolution Direct Command');
        expect(DEFAULT_MAP_EVOLUTION_DIRECT_SYSTEM_PROMPT).toContain('Never ADD_ASSET with only a bare name');
        expect(selectMapEvolutionSystemPrompt('Move the patrol.', 'NORMAL')).toBe(DEFAULT_MAP_EVOLUTION_DIRECT_SYSTEM_PROMPT);
        expect(selectMapEvolutionSystemPrompt('   ', 'NORMAL')).toBe('NORMAL');
    });

    it('injects directInstruction into Map Evolution passes', () => {
        const evolution = readFileSync(new URL('../map-evolution.js', import.meta.url), 'utf8');
        expect(evolution).toContain('selectMapEvolutionSystemPrompt');
        expect(evolution).toContain('directInstruction = \'\'');
        expect(evolution).toContain('DIRECT INSTRUCTION (THIS PASS ONLY)');
        expect(evolution).toContain('directInstruction: instruction');
    });
});
