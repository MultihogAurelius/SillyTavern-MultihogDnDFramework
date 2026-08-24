import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPanelMarkup } from '../src/ui/panel/panel-markup.js';
import {
    isCyoaEnabled,
    isLorebookAgentRuntimeActive,
    isLocationMappingEnabled,
    LOCATION_MAPPING_SECTION_TAG,
} from '../src/state/section-enabled.js';

const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const hooksSource = readFileSync(new URL('../narrative-hooks.js', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
const panelBuilderSource = readFileSync(new URL('../src/ui/panel/panel-builder.js', import.meta.url), 'utf8');
const companionSource = readFileSync(new URL('../adventure-companion.js', import.meta.url), 'utf8');
const chatLoaderSource = readFileSync(new URL('../src/features/chat/chat-state-loader.js', import.meta.url), 'utf8');

describe('master framework power button', () => {
    it('exposes only one panel power button on the main header', () => {
        const markup = buildPanelMarkup({
            agentPanelCollapsedClass: '',
            settings: {
                enabled: true,
                routerEnabled: true,
                currentMemo: '',
                lastDelta: '',
            },
        });

        expect(markup).toContain('id="rpg-tracker-enable-btn"');
        expect(markup).toContain('Disable Multihog Framework');
        expect(markup).not.toContain('id="rt-agent-router-enable-btn"');
        expect(markup).not.toContain('Enable Lorebook Agent');
        expect(markup).not.toContain('Disable Lorebook Agent');
        expect(panelBuilderSource).not.toContain("queryAgentUi('#rt-agent-router-enable-btn')");
        expect(panelBuilderSource).not.toContain("s.routerEnabled = !s.routerEnabled");
    });

    it('requires both master power and LA preference for Lorebook Agent runtime', () => {
        expect(isLorebookAgentRuntimeActive({
            enabled: true,
            routerEnabled: true,
        })).toBe(true);
        expect(isLorebookAgentRuntimeActive({
            enabled: false,
            routerEnabled: true,
        })).toBe(false);
        expect(isLorebookAgentRuntimeActive({
            enabled: true,
            routerEnabled: false,
        })).toBe(false);
        expect(isLorebookAgentRuntimeActive({
            enabled: false,
            routerEnabled: false,
        })).toBe(false);
    });

    it('keeps CYOA and Persistent Maps dead when master power is off', () => {
        const settings = {
            enabled: false,
            routerEnabled: true,
            syspromptModules: {
                CYOA_mode: true,
                [LOCATION_MAPPING_SECTION_TAG]: true,
            },
        };
        expect(isCyoaEnabled(settings)).toBe(false);
        expect(isLocationMappingEnabled(settings)).toBe(false);
        expect(isLorebookAgentRuntimeActive(settings)).toBe(false);
    });

    it('gates interceptor lore injection and generation-ended LA on the master helper', () => {
        expect(hooksSource).toContain('const routerActive = isLorebookAgentRuntimeActive(settings)');
        expect(hooksSource).toContain('if (isLorebookAgentRuntimeActive(settings) && !settings.routerNativeKeywordActivation && content)');
        expect(hooksSource).toContain('if (isLorebookAgentRuntimeActive(settings) && !skipInjection)');
        expect(hooksSource).toContain('if (isLorebookAgentRuntimeActive(settings) && !settings.routerNativeKeywordActivation)');
        expect(hooksSource).toContain('if (!settings.worldProgressionEnabled || !isLorebookAgentRuntimeActive(settings)) return');
        expect(hooksSource).toContain('if (!isLorebookAgentRuntimeActive(settings))');
        expect(hooksSource).not.toMatch(/const routerActive = !!settings\.routerEnabled/);
    });

    it('gates router pass, keyword scan, and managed-entry disable on the master helper', () => {
        expect(routerSource).toContain('if (!isLorebookAgentRuntimeActive(settings) || _routerRunning) return');
        expect(routerSource).toContain('if (!isLorebookAgentRuntimeActive(settings)) return []');
        expect(routerSource).toContain('if (!isLorebookAgentRuntimeActive(settings)) return');
        expect(companionSource).toContain('if (!isLorebookAgentRuntimeActive(settings))');
        expect(chatLoaderSource).toContain('if (isLorebookAgentRuntimeActive(s))');
    });

    it('restores the backed-up Main prompt and aborts agents when master power turns off', () => {
        expect(indexSource).toContain('async function handleTrackerEnabledChange(settings, enabled)');
        const start = indexSource.indexOf('async function handleTrackerEnabledChange(settings, enabled)');
        const end = indexSource.indexOf('let _autoApplyTimer', start);
        const body = indexSource.slice(start, end);
        expect(body).toContain('restoreTrackedMainSysprompt(settings)');
        expect(body).toContain('stopRouterPass()');
        expect(body).toContain('stopMapUpdaterPass()');
        expect(body).toContain('stopMapEvolutionPass()');
        expect(body).toContain('await autoApplySysprompt(true)');
        expect(body).not.toContain('settings.routerEnabled = false');
    });

    it('dims Lorebook Agent from master power without clearing the LA preference', () => {
        expect(indexSource).toContain('runtimeState.updateAgentPanelDisabledRef()');
        expect(panelBuilderSource).toContain('const agentLive = isLorebookAgentRuntimeActive(s)');
        expect(panelBuilderSource).toContain('sidebarCheck.checked = !!s.routerEnabled');
        expect(indexSource).toContain('isLorebookAgentRuntimeActive(settings) && bootChatId');
        expect(indexSource).toContain('if (!isLorebookAgentRuntimeActive(s2))');
        expect(indexSource).toContain('if (!isLorebookAgentRuntimeActive(s) || (!s.activeRouterKeys?.length && !s.activeWorldKeys?.length))');
    });
});
