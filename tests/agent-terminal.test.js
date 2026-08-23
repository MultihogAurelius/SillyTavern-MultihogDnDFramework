import { describe, expect, it } from 'vitest';
import {
    AGENT_TERMINAL_TAB_IDS,
    createEmptyTerminalBuffers,
    isValidTerminalTab,
    renderTerminalPane,
    resolveTerminalSource,
} from '../src/ui/panel/agent-terminal.js';

describe('agent terminal helpers', () => {
    it('routes known metadata sources to terminal tabs', () => {
        expect(resolveTerminalSource({})).toBe('lorebook_agent');
        expect(resolveTerminalSource({ source: 'state_tracker' })).toBe('state_tracker');
        expect(resolveTerminalSource({ source: 'lorebook_agent' })).toBe('lorebook_agent');
        expect(resolveTerminalSource({ source: 'map_updater' })).toBe('map_updater');
        expect(resolveTerminalSource({ source: 'map_evolution' })).toBe('map_evolution');
        expect(resolveTerminalSource({ source: 'map_architect' })).toBe('map_architect');
    });

    it('creates isolated per-source buffers', () => {
        const buffers = createEmptyTerminalBuffers();
        buffers.lorebook_agent.push({ type: 'thought', content: 'Lore step' });
        buffers.map_updater.push({ type: 'start', content: 'Map updater start' });

        expect(buffers.lorebook_agent).toHaveLength(1);
        expect(buffers.map_updater).toHaveLength(1);
        expect(buffers.map_evolution).toHaveLength(0);
        expect(buffers.map_architect).toHaveLength(0);
        expect(buffers.state_tracker).toHaveLength(0);
    });

    it('clears only the targeted source buffer on start', () => {
        const buffers = createEmptyTerminalBuffers();
        buffers.lorebook_agent.push({ type: 'thought', content: 'Keep me' });
        buffers.map_updater.push({ type: 'thought', content: 'Old updater step' });

        const source = resolveTerminalSource({ source: 'map_updater' });
        buffers[source] = [];
        buffers[source].push({ type: 'start', content: 'Initializing Map Updater...' });

        expect(buffers.lorebook_agent).toHaveLength(1);
        expect(buffers.map_updater).toHaveLength(1);
        expect(buffers.map_updater[0].type).toBe('start');
    });

    it('renders empty and populated panes', () => {
        const rendered = renderTerminalPane([], steps => steps.map(step => step.content).join('|'));
        expect(rendered).toBe('');

        const populated = renderTerminalPane([{ content: 'Done' }], steps => steps.map(step => step.content).join('|'));
        expect(populated).toBe('Done');
    });

    it('validates terminal tab ids', () => {
        AGENT_TERMINAL_TAB_IDS.forEach(id => expect(isValidTerminalTab(id)).toBe(true));
        expect(isValidTerminalTab('not_a_tab')).toBe(false);
    });
});
