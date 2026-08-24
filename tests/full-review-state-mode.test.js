import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    buildDefaultSettings,
    FULL_REVIEW_STATE_SYSTEM_PROMPT,
    FULL_REVIEW_USER_PROMPT_SUFFIX,
} from '../src/state/defaults.js';

const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const settingsHtml = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');
const companionDoc = readFileSync(new URL('../docs/multihogDnDdoc.md', import.meta.url), 'utf8');

describe('Full Review State Mode', () => {
    it('defaults to off', () => {
        expect(buildDefaultSettings().fullReviewStateMode).toBe(false);
    });

    it('FULL_REVIEW_STATE_SYSTEM_PROMPT forbids NO_CHANGES_DETECTED and the delta-only rules', () => {
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).toContain('{{modulesText}}');
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).toMatch(/NO_CHANGES_DETECTED.*FORBIDDEN/i);
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).not.toMatch(/Only output sections that actually changed/i);
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).not.toMatch(/Omit unchanged sections entirely/i);
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).toMatch(/COMPLETE.*state for every enabled module|complete contents of every enabled module/i);
        // Still carries over the shared mechanics rules unrelated to delta-vs-full behavior.
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).toContain('BLOCK PERSISTENCE');
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).toContain('<buff_debuff_logic>');
    });

    it('never pressures the model into emitting hollow empty tag pairs for inapplicable modules', () => {
        // Regression: an earlier wording ("Do NOT omit any section for any reason") caused
        // weak models to emit e.g. `[PARTY]\n[/PARTY]` for an empty party instead of just
        // leaving the section out, permanently cluttering the persisted memo.
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).not.toContain('Do NOT omit any section for any reason');
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).toMatch(/NEVER output an empty tag pair/i);
        expect(FULL_REVIEW_STATE_SYSTEM_PROMPT).toMatch(/simply leave that section out/i);
    });

    it('runStateModelPass swaps the Core Prompt template wholesale when the toggle is on', () => {
        expect(indexSource).toContain(
            "const coreTemplate = settings.fullReviewStateMode ? FULL_REVIEW_STATE_SYSTEM_PROMPT : settings.systemPromptTemplate;",
        );
        expect(indexSource).toContain('let systemPrompt = coreTemplate.replace(\'{{modulesText}}\', modulesText);');
    });

    it('forces the complete-state user-prompt suffix instead of the delta suffix when on', () => {
        expect(indexSource).toContain('? FULL_REVIEW_USER_PROMPT_SUFFIX');
        expect(FULL_REVIEW_USER_PROMPT_SUFFIX).toBe(
            '## OUTPUT THE COMPLETE, VERIFIED STATE MEMO FOR EVERY ENABLED MODULE:',
        );
    });

    it('imports Full Review prompt constants from state-manager', () => {
        expect(indexSource).toMatch(/import\s*\{[^}]*FULL_REVIEW_STATE_SYSTEM_PROMPT[^}]*\}\s*from\s*'\.\/state-manager\.js'/);
        expect(indexSource).toMatch(/import\s*\{[^}]*FULL_REVIEW_USER_PROMPT_SUFFIX[^}]*\}\s*from\s*'\.\/state-manager\.js'/);
    });

    it('settings.html places Full Review Mode and Connection Settings just below Enable Multihog Framework', () => {
        const enableAt = settingsHtml.indexOf('id="rpg_tracker_enabled"');
        const fullReviewAt = settingsHtml.indexOf('id="rpg_tracker_full_review_mode"');
        const connectionAt = settingsHtml.indexOf('id="rpg_tracker_connection_source"');
        const inventoryAt = settingsHtml.indexOf('id="rpg_inventory_config_block"');
        const corePromptAt = settingsHtml.indexOf('<b>Core Prompt</b>');

        expect(enableAt).toBeGreaterThanOrEqual(0);
        expect(fullReviewAt).toBeGreaterThan(enableAt);
        expect(connectionAt).toBeGreaterThan(fullReviewAt);
        expect(inventoryAt).toBeGreaterThan(connectionAt);
        expect(corePromptAt).toBeGreaterThan(inventoryAt);
        expect(settingsHtml).toContain('(recommended for weaker/local models)');
        expect(settingsHtml).toContain('id="rpg_tracker_full_review_note"');
        // Full Review toggle must not live inside the Core Prompt drawer anymore.
        expect(settingsHtml.slice(corePromptAt, corePromptAt + 800)).not.toContain('id="rpg_tracker_full_review_mode"');
    });

    it('index.js wires the checkbox to show/disable both Core Prompt and User Prompt Suffix while active', () => {
        expect(indexSource).toContain("settings.fullReviewStateMode = !!$(this).prop('checked');");
        expect(indexSource).toContain('corePromptTextarea.prop(\'disabled\', enabled)');
        expect(indexSource).toContain('suffixPromptTextarea.prop(\'disabled\', enabled)');
        expect(indexSource).toContain('suffixPromptTextarea.val(FULL_REVIEW_USER_PROMPT_SUFFIX)');
        expect(indexSource).toContain('corePromptTextarea.val(FULL_REVIEW_STATE_SYSTEM_PROMPT)');
        expect(settingsHtml).toContain('Core Prompt and User Prompt Suffix boxes (further below)');
    });

    it('Adventure Companion doc documents Full Review Mode and recommends it for local models', () => {
        expect(companionDoc).toContain('### Full Review Mode');
        expect(companionDoc).toMatch(/Local \/ weaker State Tracker models/i);
        expect(companionDoc).toMatch(/Gemma/i);
        expect(companionDoc).toContain('proactively recommend enabling **Full Review Mode**');
        expect(companionDoc).toContain('State Tracker (local / smaller)');
        expect(companionDoc).toContain('Modules disappear / drift on a local or small tracker model');
    });
});
