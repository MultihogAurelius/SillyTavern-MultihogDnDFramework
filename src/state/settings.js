/**
 * Live settings accessor, migrations, bar prefs, and campaign prefix helpers.
 * Self-binds into settings-ref so leaf modules can call getSettings() safely.
 */

import { MODULE_NAME, DEFAULT_PC_SECTIONS, DEFAULT_NPC_SECTIONS } from './schema-sections.js';
import { DEFAULT_MODULES } from './default-modules.js';
import { buildDefaultSettings, FACTORY_SETTINGS_VERSION } from './defaults.js';
import { isOlderThan } from './versions.js';
import { buildNpcInstruction, buildLocInstruction, buildFacInstruction } from './module-instructions.js';
import {
    getDefaultPortraitLocationSystemPrompt,
    isShippedPortraitLocationSystemPrompt,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS_V1,
} from './portrait-prompts.js';
import { bindGetSettings } from './settings-ref.js';
import {
    enforceRealtimeVisualizationDisabled,
    setRealtimeVisualizationDisabled,
} from './realtime-visualization-guard.js';
import { migrateChatSetupCatalogs } from './chat-setup.js';
import { LOREBOOK_RUNTIME_FRAGMENT_KEYS } from './lorebook-runtime-fragments.js';
import { DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT } from '../../map-architect-prompt.js';
import { DEFAULT_MAP_UPDATER_SYSTEM_PROMPT } from '../../map-updater-prompt.js';
import { DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT } from '../../map-evolution-prompt.js';

// Re-entrancy guard: some migration blocks below call buildNpcInstruction()/
// buildLocInstruction()/buildFacInstruction(), which themselves call
// getSettings() to read a couple of flags (useDdMmYyFormat, npcRelationshipBars).
// Without this guard, a fresh install (no settingsVersion yet) re-enters
// getSettings() from inside itself before settingsVersion has been bumped,
// re-running the same migration block over and over → infinite recursion /
// stack overflow that hangs the page on load. See CHANGELOG for details.
let _gettingSettings = false;

function promptSignature(value) {
    const source = String(value || '');
    let hash = 0x811c9dc5;
    for (let index = 0; index < source.length; index++) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `${source.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();

    // Re-entrant call from within a migration block (e.g. via one of the
    // instruction builders) — just hand back the in-progress settings object
    // rather than re-running the merge/migration pipeline recursively.
    if (_gettingSettings) {
        return extensionSettings[MODULE_NAME] || (extensionSettings[MODULE_NAME] = {});
    }
    _gettingSettings = true;
    try {
        return getSettingsInternal(extensionSettings);
    } finally {
        _gettingSettings = false;
    }
}

function getSettingsInternal(extensionSettings) {
    const defaults = buildDefaultSettings();

    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = {};
    }

    // Deep merge — fills in missing keys without overwriting existing ones
    for (const [key, value] of Object.entries(defaults)) {
        if (extensionSettings[MODULE_NAME][key] === undefined) {
            extensionSettings[MODULE_NAME][key] = value;
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            if (extensionSettings[MODULE_NAME][key] === undefined) extensionSettings[MODULE_NAME][key] = {};
            for (const [subKey, subValue] of Object.entries(value)) {
                if (extensionSettings[MODULE_NAME][key][subKey] === undefined) {
                    extensionSettings[MODULE_NAME][key][subKey] = subValue;
                }
            }
        }
    }
    
    const s = extensionSettings[MODULE_NAME];

    // Custom tracker definitions are framework configuration, not chat state.
    // Older Chat Link snapshots kept a separate customFields list per chat, so a
    // module created in one chat appeared to vanish when another chat was loaded.
    // Merge those legacy lists once, then leave definitions global going forward.
    if (s.customFieldsGlobalizedVersion !== 1) {
        const fields = Array.isArray(s.customFields) ? s.customFields : [];
        const seenTags = new Set(fields.map(field => String(field?.tag || '').toUpperCase()).filter(Boolean));
        for (const snapshot of Object.values(s.chatStates || {})) {
            if (!snapshot || typeof snapshot !== 'object') continue;
            for (const field of Array.isArray(snapshot.customFields) ? snapshot.customFields : []) {
                const tag = String(field?.tag || '').toUpperCase();
                if (!tag || seenTags.has(tag)) continue;
                fields.push(JSON.parse(JSON.stringify(field)));
                seenTags.add(tag);
            }
            delete snapshot.customFields;
        }
        s.customFields = fields;
        s.customFieldsGlobalizedVersion = 1;
    }

    // Definitions are global library records; chat snapshots retain activation only.
    migrateChatSetupCatalogs(s);

    // Load UI collapse and open/close states from localStorage to prevent expensive saveSettings/disk I/O calls
    if (localStorage.getItem('rpg_tracker_collapsed') !== null) {
        s.trackerCollapsed = localStorage.getItem('rpg_tracker_collapsed') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_collapsed', String(s.trackerCollapsed));
    }
    if (localStorage.getItem('rpg_tracker_agent_collapsed') !== null) {
        s.agentCollapsed = localStorage.getItem('rpg_tracker_agent_collapsed') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_collapsed', String(s.agentCollapsed));
    }
    if (localStorage.getItem('rpg_tracker_agent_keys_collapsed') !== null) {
        s.agentKeysCollapsed = localStorage.getItem('rpg_tracker_agent_keys_collapsed') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_keys_collapsed', String(s.agentKeysCollapsed));
    }
    if (localStorage.getItem('rpg_tracker_rendered_view_active') !== null) {
        s.renderedViewActive = localStorage.getItem('rpg_tracker_rendered_view_active') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_rendered_view_active', String(s.renderedViewActive));
    }
    if (localStorage.getItem('rpg_tracker_agent_settings_open') !== null) {
        s.agentSettingsOpen = localStorage.getItem('rpg_tracker_agent_settings_open') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_settings_open', String(s.agentSettingsOpen));
    }
    if (localStorage.getItem('rpg_tracker_agent_modules_open') !== null) {
        s.agentModulesOpen = localStorage.getItem('rpg_tracker_agent_modules_open') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_modules_open', String(s.agentModulesOpen));
    }
    if (localStorage.getItem('rpg_tracker_agent_console_open') !== null) {
        s.agentConsoleOpen = localStorage.getItem('rpg_tracker_agent_console_open') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_console_open', String(s.agentConsoleOpen));
    }
    if (localStorage.getItem('rpg_tracker_agent_map_evo_open') !== null) {
        s.agentMapEvolutionOpen = localStorage.getItem('rpg_tracker_agent_map_evo_open') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_map_evo_open', String(s.agentMapEvolutionOpen));
    }
    if (localStorage.getItem('rpg_tracker_agent_world_open') !== null) {
        s.agentWorldOpen = localStorage.getItem('rpg_tracker_agent_world_open') === 'true';
    } else {
        localStorage.setItem('rpg_tracker_agent_world_open', String(s.agentWorldOpen));
    }
    if (localStorage.getItem('rpg_tracker_content_mode') !== null) {
        const mode = localStorage.getItem('rpg_tracker_content_mode');
        s.trackerContentMode = mode === 'agent' ? 'agent' : 'tracker';
    } else if (localStorage.getItem('rpg_tracker_agent_visible') === 'true') {
        s.trackerContentMode = 'agent';
        localStorage.setItem('rpg_tracker_content_mode', 'agent');
        localStorage.removeItem('rpg_tracker_agent_visible');
    } else {
        localStorage.setItem('rpg_tracker_content_mode', s.trackerContentMode || 'tracker');
    }

    // ── MIGRATION: CYOA slot type `roll` removed — map to narrative ────────────
    if (Array.isArray(s.cyoaConfig?.slots)) {
        for (const slot of s.cyoaConfig.slots) {
            if (slot?.type === 'roll') slot.type = 'narrative';
        }
    }
    if (s.cyoaConfig?.presets && typeof s.cyoaConfig.presets === 'object') {
        for (const presetSlots of Object.values(s.cyoaConfig.presets)) {
            if (!Array.isArray(presetSlots)) continue;
            for (const slot of presetSlots) {
                if (slot?.type === 'roll') slot.type = 'narrative';
            }
        }
    }
    // Older builds always persisted customPromptText on CYOA save even when the user
    // never opted into a custom prompt — that froze CYOA through Main System Prompt updates.
    // Unless useCustomPrompt is explicitly true, the builder is source of truth.
    if (s.cyoaConfig && s.cyoaConfig.useCustomPrompt !== true && s.cyoaConfig.customPromptText) {
        s.cyoaConfig.customPromptText = '';
    }
    
    // ── MIGRATION: routerModules (v1.8.35+) ───────────────────────────────────

    if (s.routerModules && typeof s.routerModules.npc === 'boolean') {
        const old = s.routerModules;
        s.routerModules = {
            npc: { enabled: !!old.npc, tag: 'NPC', format: 'Name | Description | Keywords', instruction: DEFAULT_MODULES.npc.instruction },
            loc: { enabled: !!old.loc, tag: 'LOC', format: 'Name | Description | Keywords', instruction: 'Named places. Name MUST be the full hierarchical path using " :: " as the separator (e.g. "Khelt :: Rust-Lantern District :: Marrow-Deep Mines Office"). Include each ancestor as a keyword.' },
            fac: { enabled: !!old.fac, tag: 'FAC', format: 'Name | Status | Description | Keywords', instruction: 'Named factions, guilds, organisations. **Status**: short current-state line. **Description**: longer narrative (history, schemes, members). **Keywords**: comma-separated terms.' },
            quest: { enabled: !!old.quest, tag: 'QUEST', format: 'Name | Location | Description | Keywords', instruction: 'ONLY record a quest if the player unambiguously begins to pursue a quest. A quest being mentioned, offered, or entertained by the player is NOT enough.' },
            event: { enabled: !!old.event, tag: 'EVENT', format: 'Name | Details | Keywords', instruction: 'Significant narrative events. Use a SHORT, STABLE Name — no timestamps in the name. Reuse the exact same Name when adding new information.' },
            world: { enabled: !!old.world, tag: 'WORLD', format: 'Name | Details | Keywords', instruction: DEFAULT_MODULES.world.instruction }
        };
    }

    // ── MIGRATION: routerModules.world.enabled → worldProgressionEnabled (v2.x+) ──────
    // The World Progression system is a standalone deterministic pass. If a user had the
    // old module toggle enabled, migrate that intent and disable the legacy module toggle.
    if (s.routerModules?.world?.enabled && !s.worldProgressionEnabled) {
        s.worldProgressionEnabled = true;
        s.routerModules.world.enabled = false;
    }
    // ── MIGRATION: worldEngine* → worldProgression* (v2.x rename) ────────────────────
    if (s.worldEngineEnabled !== undefined && s.worldProgressionEnabled === false) {
        s.worldProgressionEnabled = !!s.worldEngineEnabled;
        delete s.worldEngineEnabled;
    }
    if (s.worldEngineIntervalHours !== undefined) { s.worldProgressionIntervalHours = s.worldEngineIntervalHours; delete s.worldEngineIntervalHours; }
    if (s.worldEngineKeepActive !== undefined) { s.worldProgressionKeepActive = s.worldEngineKeepActive; delete s.worldEngineKeepActive; }
    if (s.worldEngineLastFiredAtMinutes !== undefined) { s.worldProgressionLastFiredAtMinutes = s.worldEngineLastFiredAtMinutes; delete s.worldEngineLastFiredAtMinutes; }
    if (s.worldEngineLastFiredPeriodLabel !== undefined) { s.worldProgressionLastFiredPeriodLabel = s.worldEngineLastFiredPeriodLabel; delete s.worldEngineLastFiredPeriodLabel; }

    // FAC tag: 3-field format -> 4-field (v2.2.3+) so Status and Description are separate prompts to the model
    if (s.routerModules?.fac?.format === 'Name | Description | Keywords') {
        s.routerModules.fac.format = DEFAULT_MODULES.fac.format;
    }

    // Ensure all stock modules have a format field (in case of old saves missing it)
    for (const [key, def] of Object.entries(DEFAULT_MODULES)) {
        if (s.routerModules?.[key] && !s.routerModules[key].format) {
            s.routerModules[key].format = def.format;
        }
    }

    // Ensure all custom tags have a format field
    if (Array.isArray(s.routerCustomTags)) {
        for (const ct of s.routerCustomTags) {
            if (!ct.format) ct.format = 'Name | Description | Keywords';
        }
    }

    // Strip legacy NPC line about State Memo (tracker memo UI is optional / unused in many setups)
    if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
        let ins = s.routerModules.npc.instruction;
        if (/their state lives in the State Memo/i.test(ins)) {
            ins = ins.replace(/\s*[\u2014\u2013-]\s*their state lives in the State Memo\.?\s*/gi, '. ');
            ins = ins.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
            s.routerModules.npc.instruction = ins;
        }
    }

    // Migrate NPC prompt to include appearance recording (v3.5.2 one-time migration)
    if (isOlderThan(s.settingsVersion, '3.5.2')) {
        if (s.routerModules?.npc?.instruction === 'Named characters. Do NOT create an entry for {{user}}. Mention {{user}} in EVENT or QUEST entries as needed.') {
            s.routerModules.npc.instruction = DEFAULT_MODULES.npc.instruction;
        }
        s.settingsVersion = '3.5.2';
    }

    // Migrate NPC prompt to include Friendship/Affection relationship tracking (v3.6.0)
    if (isOlderThan(s.settingsVersion, '3.6.0')) {
        if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
            const ins = s.routerModules.npc.instruction;
            // Only migrate if it doesn't already mention Friendship/Rapport
            if (!ins.includes('Friendship/Rapport')) {
                s.routerModules.npc.instruction = ins.trimEnd() + ' At the end of every NPC entry, always include these two relationship metrics on separate lines:\nFriendship/Rapport: 0/100\nAffection/Interest: 0/100\nThese values CAN be negative (e.g., -45/100) representing hostility or disgust. Range: -100 to 100. Start new NPCs at 0/100 for both. Update as interactions warrant.';
            }
        }
        s.settingsVersion = '3.6.0';
    }

    // Migrate NPC prompt to structured sections format (v3.7.0)
    if (isOlderThan(s.settingsVersion, '3.7.0')) {
        if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
            // Replace wholesale — the new format is significantly different
            s.routerModules.npc.instruction = DEFAULT_MODULES.npc.instruction;
        }
        s.settingsVersion = '3.7.0';
    }

    // Migrate NPC prompt — fix sections-outside-tags issue + remove sentence counts (v3.8.0)
    if (isOlderThan(s.settingsVersion, '3.8.0')) {
        if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
            s.routerModules.npc.instruction = DEFAULT_MODULES.npc.instruction;
        }
        s.settingsVersion = '3.8.0';
    }

    // Migrate NPC prompt — tighter token defaults + conciseness emphasis (v3.9.0)
    if (isOlderThan(s.settingsVersion, '3.9.0')) {
        if (s.routerModules?.npc?.instruction && typeof s.routerModules.npc.instruction === 'string') {
            s.routerModules.npc.instruction = DEFAULT_MODULES.npc.instruction;
        }
        s.settingsVersion = '3.9.0';
    }

    // Migrate NPC prompt — relationship bars off by default + settings-driven instruction (v3.10.0)
    if (isOlderThan(s.settingsVersion, '3.10.0')) {
        // Ensure NPC settings exist with defaults
        if (s.npcMajorTokens === undefined) s.npcMajorTokens = 125;
        if (s.npcMinorTokens === undefined) s.npcMinorTokens = 100;
        if (s.npcRelationshipBars === undefined) s.npcRelationshipBars = false;
        // Rebuild instruction from current settings
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorTokens, s.npcMinorTokens);
        }
        s.settingsVersion = '3.10.0';
    }

    // Migrate NPC system to [CORE] tag, code-owned relationship bars, and delta-based updates (v3.11.0)
    if (isOlderThan(s.settingsVersion, '3.11.0')) {
        // Initialize relationship value store
        if (!s.npcRelationshipValues) s.npcRelationshipValues = {};
        // Force-rebuild NPC instruction to new format
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(
                s.npcMajorTokens ?? 125,
                s.npcMinorTokens ?? 100
            );
        }
        s.settingsVersion = '3.11.0';
    }

    // Migrate NPC limits from tokens to words (v3.12.0)
    if (isOlderThan(s.settingsVersion, '3.12.0')) {
        // Convert old token keys to word keys using approximate conversion (125t→90w, 100t→60w)
        if (s.npcMajorWords === undefined) {
            s.npcMajorWords = s.npcMajorTokens !== undefined ? Math.round(s.npcMajorTokens * 0.72) : 25;
        }
        if (s.npcMinorWords === undefined) {
            s.npcMinorWords = s.npcMinorTokens !== undefined ? Math.round(s.npcMinorTokens * 0.72) : 15;
        }
        // Rebuild instruction with word-based limits
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.settingsVersion = '3.12.0';
    }

    // Migrate NPC limits from total words to per-section word targets (v3.13.0)
    if (isOlderThan(s.settingsVersion, '3.13.0')) {
        // Convert old total word limits (90/60) to reasonable per-section defaults (25/15).
        // Only reset clearly legacy token-era values — NOT arbitrary high word counts.
        // Threshold raised to 1000 so users can freely set values like 200, 300, 400+.
        if (s.npcMajorWords === 90 || s.npcMajorWords > 1000) {
            s.npcMajorWords = 25;
        }
        if (s.npcMinorWords === 60 || s.npcMinorWords > 1000) {
            s.npcMinorWords = 15;
        }
        // Rebuild instruction with new length target wording
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.settingsVersion = '3.13.0';
    }

    // Wrap CORE_FORMAT and CORE LENGTH TARGETS in XML tags (v3.14.0)
    if (isOlderThan(s.settingsVersion, '3.14.0')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.settingsVersion = '3.14.0';
    }

    // Ensure entry starts directly with [CORE] and add relationship editing (v3.15.0)
    if (isOlderThan(s.settingsVersion, '3.15.0')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.settingsVersion = '3.15.0';
    }

    // Enforce {{user}} macro usage and prevent literal "user" or "player" text (v3.16.0)
    if (isOlderThan(s.settingsVersion, '3.16.0')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        s.systemPromptTemplate = defaults.systemPromptTemplate;
        s.settingsVersion = '3.16.0';
    }

    // Reinforce NPC and Event prompts regarding combat granularity and logs (v3.16.13)
    if (isOlderThan(s.settingsVersion, '3.16.13')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        if (s.routerModules?.event) {
            s.routerModules.event.instruction = DEFAULT_MODULES.event.instruction;
        }
        s.routerSystemPromptTemplate = defaults.routerSystemPromptTemplate;
        s.settingsVersion = '3.16.13';
    }

    // Expand NPC relationship delta guidance with situational examples (v3.16.14)
    if (isOlderThan(s.settingsVersion, '3.16.14')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords);
        }
        // Add default settings for Auto-Generate NPC portraits (upstream)
        if (s.portraitAutoGenerateNpcs === undefined) {
            s.portraitAutoGenerateNpcs = false;
        }
        s.settingsVersion = '3.16.14';
    }

    // Reinforce that NPC Description must start directly with [CORE] without timestamp (v3.16.16)
    if (isOlderThan(s.settingsVersion, '3.16.16')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        s.settingsVersion = '3.16.16';
    }

    // Move ongoing relationship tracking from lorebook agent to narrative AI direct parsing (v3.16.17)
    if (isOlderThan(s.settingsVersion, '3.16.17')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        s.settingsVersion = '3.16.17';
    }

    // Force rebuild of NPC instruction to restore length targets that were incorrectly stripped by a previous bug (v3.16.18)
    if (isOlderThan(s.settingsVersion, '3.16.18')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        s.settingsVersion = '3.16.18';
    }

    // Tighten perennial [CORE] guidance — ban plot-tied scene recaps (v3.16.19)
    if (isOlderThan(s.settingsVersion, '3.16.19')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        s.settingsVersion = '3.16.19';
    }

    // Baseline since-last-run watermark after lookback reliability fix (v3.16.20)
    if (isOlderThan(s.settingsVersion, '3.16.20')) {
        s.routerWatermarkBaselinePending = true;
        s.settingsVersion = '3.16.20';
    }

    // NPC portrait card view toggle (v3.16.21)
    if (isOlderThan(s.settingsVersion, '3.16.21')) {
        if (s.npcPortraits === undefined) s.npcPortraits = true;
        if (s.locationImages === undefined) s.locationImages = false;
        if (s.portraitAutoGenerateLocations === undefined) s.portraitAutoGenerateLocations = false;
        s.settingsVersion = '3.16.21';
    }

    // Quest archive UI toggle default (v3.16.22)
    if (isOlderThan(s.settingsVersion, '3.16.22')) {
        if (s.syspromptModules && s.syspromptModules.questsShowArchive === undefined) {
            s.syspromptModules.questsShowArchive = true;
        }
        s.settingsVersion = '3.16.22';
    }

    // LOC module: plain [CORE] without NPC field headers (v4.3.9)
    if (isOlderThan(s.settingsVersion, '4.3.9')) {
        if (s.routerModules?.loc) {
            s.routerModules.loc.instruction = buildLocInstruction();
        }
        s.settingsVersion = '4.3.9';
    }

    // NPC relationship max: global default + per-chat live value (v4.4.0)
    if (isOlderThan(s.settingsVersion, '4.4.0')) {
        if (s.npcRelationshipMaxDefault === undefined) {
            s.npcRelationshipMaxDefault = s.npcRelationshipMax ?? 150;
        }
        if (s.npcRelationshipMax === undefined) {
            s.npcRelationshipMax = s.npcRelationshipMaxDefault;
        }
        s.settingsVersion = '4.4.0';
    }

    // Hardened player safeguard prompts & Faction [CORE] tags (v4.5.0)
    if (isOlderThan(s.settingsVersion, '4.5.0')) {
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
        }
        if (s.routerModules?.loc) {
            s.routerModules.loc.instruction = buildLocInstruction();
        }
        if (s.routerModules?.fac) {
            s.routerModules.fac.instruction = buildFacInstruction();
        }
        s.routerSystemPromptTemplate = defaults.routerSystemPromptTemplate;
        s.routerModularPromptTemplate = defaults.routerModularPromptTemplate;
        s.settingsVersion = '4.5.0';
    }

    // ── MIGRATION: Update system prompts with keywords instructions (v3.2.3+) ──────
    if (s.routerSystemPromptTemplate && !s.routerSystemPromptTemplate.includes('IMPORTANT FOR KEYWORDS')) {
        if (s.routerSystemPromptTemplate.includes('<formatting>')) {
            s.routerSystemPromptTemplate = s.routerSystemPromptTemplate.replace(
                'Correct examples:',
                '- **IMPORTANT FOR KEYWORDS (KEYS):** Always include the entity\'s own name/title (without any timestamps like "Day 1", "Day 2", "12:15 AM", etc.) in the list of keywords. The title itself (stripped of timestamps) is the most reliable trigger, so it must be present as a keyword. For example, if the entry title is "[12:15 AM, Day 2] Defense of Ironbelly\'s Workshop", the keys list MUST include "Defense of Ironbelly\'s Workshop".\n\nCorrect examples:'
            );
        }
    }
    if (s.routerModularPromptTemplate && !s.routerModularPromptTemplate.includes('IMPORTANT FOR KEYWORDS')) {
        if (s.routerModularPromptTemplate.includes('NPC / FAC / QUEST / EVENT labels:')) {
            s.routerModularPromptTemplate = s.routerModularPromptTemplate.replace(
                'NPC / FAC / QUEST / EVENT labels:',
                '**IMPORTANT FOR KEYWORDS:** Always include the entry\'s own title/name (without any timestamps like "Day 1", "Day 2", "12:15 AM", etc.) in the keywords field. The title itself (stripped of timestamps) is the most reliable trigger, so it must be present as a keyword. For example, for a tag representing a "Defense of Ironbelly\'s Workshop" event, the keywords MUST contain "Defense of Ironbelly\'s Workshop".\n\nNPC / FAC / QUEST / EVENT labels:'
            );
        }
    }

    // ── MIGRATION: Ban {{user}}/{{char}} from keywords/keys in existing templates (v3.16.19+) ──────
    if (s.routerSystemPromptTemplate && !s.routerSystemPromptTemplate.includes('DO NOT INCLUDE `{{user}}`')) {
        if (s.routerSystemPromptTemplate.includes('the keys list MUST include "Defense of Ironbelly\'s Workshop".')) {
            s.routerSystemPromptTemplate = s.routerSystemPromptTemplate.replace(
                'the keys list MUST include "Defense of Ironbelly\'s Workshop".',
                'the keys list MUST include "Defense of Ironbelly\'s Workshop".\n- **DO NOT INCLUDE `{{user}}`, `{{char}}`, or general player references** in the keyword list (`keys`). The user/player is present in all events/locations, so including them as a keyword causes false matches and wastes context tokens.'
            );
        }
    }
    if (s.routerModularPromptTemplate && !s.routerModularPromptTemplate.includes('DO NOT INCLUDE `{{user}}`')) {
        if (s.routerModularPromptTemplate.includes('keywords MUST contain "Defense of Ironbelly\'s Workshop".')) {
            s.routerModularPromptTemplate = s.routerModularPromptTemplate.replace(
                'keywords MUST contain "Defense of Ironbelly\'s Workshop".',
                'keywords MUST contain "Defense of Ironbelly\'s Workshop". DO NOT INCLUDE `{{user}}`, `{{char}}`, or general player references in the keywords field — the player is present in all events and locations, so tagging them is redundant and wastes context tokens.'
            );
        }
    }

    // ── MIGRATION: Require explicit category on lorebook record commits (v7.10+) ──────
    if (s.routerSystemPromptTemplate && !s.routerSystemPromptTemplate.includes('REQUIRED category field')) {
        if (s.routerSystemPromptTemplate.includes('<formatting>')) {
            s.routerSystemPromptTemplate = s.routerSystemPromptTemplate.replace(
                'When recording a new entry, keep the lorebook category separate from the entity label.',
                'When recording a new entry, keep the lorebook category separate from the entity label.\n\n- **REQUIRED category field:** Every `record` item MUST use one of the exact values in the runtime **AVAILABLE RECORD CATEGORIES** section. That authoritative list contains the enabled stock modules and all custom tags for the current pass. Disabled stock categories are not available.\n- When LOC is enabled, location labels may use `" :: "` hierarchy and must still set `"category": "LOC"`. When NPC is enabled, NPC people get `"category": "NPC"` with a plain name label (no `::`).'
            );
            if (!s.routerSystemPromptTemplate.includes('MISSING required "category": "NPC"')) {
                s.routerSystemPromptTemplate = s.routerSystemPromptTemplate.replace(
                    'Incorrect examples:',
                    'Incorrect examples:\n\n- {"label": "Lissa", "keys": ["Lissa"], "content": "[CORE]…"} (MISSING required "category": "NPC" — will not land in the NPCs lorebook)\n\n- {"label": "Kalvermoor :: The Ring", "keys": ["The Ring"], "content": "[CORE]…"} (MISSING required "category": "LOC" — `::` nesting is not a category)'
                );
            }
        }
    }
    if (s.routerAgentSharedContextTemplate && !s.routerAgentSharedContextTemplate.includes('only `category` does')) {
        s.routerAgentSharedContextTemplate = s.routerAgentSharedContextTemplate.replace(
            'Locations -> "{{campaignLocBook}}" (etc.)\nLocation hierarchy:',
            'Locations -> "{{campaignLocBook}}" (etc.)\n**Routing:** every new `record` MUST set `"category"` to match the target book above (`NPC` → NPCs book, `LOC` → Locations, etc.). Labels and `::` paths do NOT choose the book — only `category` does.\nLocation hierarchy:'
        );
        s.routerAgentSharedContextTemplate = s.routerAgentSharedContextTemplate.replace(
            'Location hierarchy: use " :: " separator in labels (e.g. "Khelt :: Rust-Lantern District :: The Guilded Anvil").\nInclude the entity name/title itself',
            'Location hierarchy: use " :: " separator in labels (e.g. "Khelt :: Rust-Lantern District :: The Guilded Anvil") together with `"category": "LOC"`.\nNPC people use a plain name label and `"category": "NPC"` (never put people under a `::` path).\nInclude the entity name/title itself'
        );
    }

    // Dungeon persistence ownership: map occupancy belongs to the Map Updater;
    // Lorebook Agent still records NPCs and readable location lore.
    const dungeonOwnershipRule = '**DUNGEON LOCATION OWNERSHIP:** A mapped root Location may contain a private `[MAP]...[/MAP]` section. Never reveal, rewrite, summarize, remove, or quote `[MAP]` into visible lore. Map occupancy (areas, assets, routes, interiors) is maintained by the Map Updater — do not emit `[MAP_COMMIT]`, `commit.map`, inspect_map, or ADD_ASSET. You still record NPCs, factions, quests, events, and readable location lore. Do NOT create or extend an EVENT merely to chronicle ordinary exploration, perception checks, room-by-room combat, or local map mutations. Use EVENT only for a site-scale outcome with lasting historical importance (for example the entire site was cleansed, destroyed, conquered, or changed ownership).';
    if (s.routerModularPromptTemplate && !s.routerModularPromptTemplate.includes('DUNGEON LOCATION OWNERSHIP')) {
        s.routerModularPromptTemplate = s.routerModularPromptTemplate.replace(
            'Example: [[FAC: Iron Syndicate',
            `${dungeonOwnershipRule}\n\nExample: [[FAC: Iron Syndicate`,
        );
    }
    if (s.routerAgentSharedContextTemplate && !s.routerAgentSharedContextTemplate.includes('DUNGEON LOCATION OWNERSHIP')) {
        s.routerAgentSharedContextTemplate = s.routerAgentSharedContextTemplate.replace(
            '## WORLD SKELETON (OFF-LIMITS)',
            `## DUNGEON LOCATION OWNERSHIP\n${dungeonOwnershipRule.replace(/^\*\*DUNGEON LOCATION OWNERSHIP:\*\*\s*/, '')}\n\n## WORLD SKELETON (OFF-LIMITS)`,
        );
    }
    const mapAwarenessRule = 'A mapped root Location may contain a private `[MAP]...[/MAP]` section. Never reveal, rewrite, summarize, remove, or quote `[MAP]` into visible lore. Map occupancy (areas, assets, routes, interiors) is maintained by the Map Updater — do not emit `[MAP_COMMIT]`, `commit.map`, inspect_map, or ADD_ASSET. You still record NPCs, factions, quests, events, and readable location lore. ';
    if (s.routerModularPromptTemplate?.includes('DUNGEON LOCATION OWNERSHIP')
        && !s.routerModularPromptTemplate.includes('Map Updater')) {
        s.routerModularPromptTemplate = s.routerModularPromptTemplate.replace(
            /(?:\*\*DUNGEON LOCATION OWNERSHIP:\*\*\s*)[\s\S]*?(?=\n\nExample: \[\[FAC:)/,
            `${dungeonOwnershipRule}\n\n`,
        );
        if (!s.routerModularPromptTemplate.includes('Map Updater')) {
            s.routerModularPromptTemplate = s.routerModularPromptTemplate.replace(
                '**DUNGEON LOCATION OWNERSHIP:** ',
                `**DUNGEON LOCATION OWNERSHIP:** ${mapAwarenessRule}`,
            );
        }
    }
    if (s.routerAgentSharedContextTemplate?.includes('## DUNGEON LOCATION OWNERSHIP')
        && !s.routerAgentSharedContextTemplate.includes('Map Updater')) {
        s.routerAgentSharedContextTemplate = s.routerAgentSharedContextTemplate.replace(
            /## DUNGEON LOCATION OWNERSHIP\n[\s\S]*?(?=\n## WORLD SKELETON)/,
            `## DUNGEON LOCATION OWNERSHIP\n${mapAwarenessRule}\n`,
        );
    }

    if (s.routerAgentSharedContextTemplate?.includes('use `read_entry` or `grep_lore`, or `activate` it.')) {
        s.routerAgentSharedContextTemplate = s.routerAgentSharedContextTemplate.replace(
            '  - To see its full content first: use `read_entry` or `grep_lore`, or `activate` it.\n- Only use `record` for entities that are BRAND NEW and have never appeared in ACTIVE MEMORY, NEWLY ACTIVATED, or the ARCHIVE INDEX before.',
            '  - To see its full content first: use `read_entry` with the Book::UID from that ARCHIVE INDEX line, or `activate` it. Never grep_lore or inspect_book to check whether a name exists.\n- Only use `record` for entities that are BRAND NEW — names absent from ACTIVE MEMORY, NEWLY ACTIVATED, and ARCHIVE INDEX. Absence means the entry does not exist.',
        );
    }
    if (s.routerBasicSystemPromptTemplate?.includes('Inactive entries — labels and keywords only.')) {
        s.routerBasicSystemPromptTemplate = s.routerBasicSystemPromptTemplate.replace(
            '3. **ARCHIVE INDEX**: Inactive entries — labels and keywords only. You CANNOT see their full biography.',
            '3. **ARCHIVE INDEX**: Complete catalog of inactive entries — Book::UID, labels, and keywords only. You CANNOT see their full biography. If a name is not in ACTIVE MEMORY, NEWLY ACTIVATED, or ARCHIVE INDEX, it does not exist.',
        );
    }

    // ── MIGRATION: Update World Progression System Prompt with Quests/Events rule (v3.4.4+) ──────
    if (s.worldProgressionSystemPrompt && !s.worldProgressionSystemPrompt.includes('QUESTS and EVENTS are historical records')) {
        s.worldProgressionSystemPrompt = s.worldProgressionSystemPrompt.replace(
            '1. Do NOT summarize player actions. Build consequences from them instead — defeated rivals plot revenge, sympathetic contacts cover their tracks, encountered strangers react to what happened.',
            '1. Do NOT summarize player actions. Build consequences from them instead — defeated rivals plot revenge, sympathetic contacts cover their tracks, encountered strangers react to what happened.\n2. QUESTS and EVENTS are historical records for context only — they are NOT simulatable entities. Never generate entries that describe a quest advancing, stalling, succeeding, or failing. If a quest appears in the designated entities block, ignore it entirely.'
        );
        s.worldProgressionSystemPrompt = s.worldProgressionSystemPrompt
            .replace('2. Prioritize named ACTIVE WORLD LORE NPCs.', '3. Prioritize named ACTIVE WORLD LORE NPCs.')
            .replace('3. For NPCs who were physically present', '4. For NPCs who were physically present')
            .replace('4. Format as 15 short entries', '5. Format as 15 short entries')
            .replace('5. Output ONLY the report content.', '6. Output ONLY the report content.')
            .replace('6. Do not simply repeat the same entities', '7. Do not simply repeat the same entities')
            .replace('7. DO NOT write a cumulative report', '8. DO NOT write a cumulative report')
            .replace('8. Cross-category entity bleeding is desirable', '9. Cross-category entity bleeding is desirable')
            .replace('9. You must strictly respect geographical', '10. You must strictly respect geographical')
            .replace('10. Character vectors must take place', '11. Character vectors must take place');
    }
 
    // ── MIGRATION: Update World Progression System Prompt with bullet-pointed and blank line rules ──
    if (s.worldProgressionSystemPrompt && !s.worldProgressionSystemPrompt.includes('Do NOT prefix the lines with the period or time label')) {
        // Replace from original or intermediate form
        s.worldProgressionSystemPrompt = s.worldProgressionSystemPrompt
            .replace(
                '5. Format as 15 short entries, 1 sentence each. Dense, no filler, no markdown.',
                '5. Format as 15 bullet-pointed entries (using "- "), with a blank line (newline) between each world event. Dense, no filler, no markdown. Each entry must be exactly 1 sentence. Do NOT prefix the lines with the period or time label.'
            )
            .replace(
                '5. Format as 15 bullet-pointed entries (using "- [{periodLabel}] Event Description..."), with a blank line (newline) between each world event. Dense, no filler, no markdown. Each entry must be exactly 1 sentence.',
                '5. Format as 15 bullet-pointed entries (using "- "), with a blank line (newline) between each world event. Dense, no filler, no markdown. Each entry must be exactly 1 sentence. Do NOT prefix the lines with the period or time label.'
            );
    }

    // ── MIGRATION: strip global UI prefs out of chatStates (Chat Link clobber fix) ─
    stripChatStateGlobalUiPrefs(s);

    // NOTE: Do NOT sniff-and-replace stockPrompts here on every getSettings().
    // That wiped themed/custom module prompts (e.g. 40k COMBAT). Stock / tracker /
    // sysprompt / agent prompt upgrades run ONLY via the post-update "Prompt Defaults
    // Updated" dialog (or Auto-Update Prompts on Upgrade) — once per fingerprint change.

    // Older releases embedded tracker-storage implementation details into the core
    // prompt. Relationship command handling belongs to the parser, not the model.
    if (s.systemPromptTemplate) {
        const legacyRelationshipDirectives = [
            'NO RELATIONSHIPS: Never track relationships, and never create a relationship section (e.g., [RELATIONSHIPS]). NPC relationships are handled by a separate, dedicated system.',
            'NO RELATIONSHIPS: Never track relationships or reputation, and never create a relationship or reputation section (e.g., [RELATIONSHIPS] or [REPUTATION]). NPC relationships are handled by a separate, dedicated system.',
            'RELATIONSHIPS: Never create a relationship section (e.g., [RELATIONSHIPS]) in the memo. When the separate relationship-command instruction is present, report qualifying deltas only through its [RELATIONS] command block.',
        ];
        for (const directive of legacyRelationshipDirectives) {
            s.systemPromptTemplate = s.systemPromptTemplate.replace(directive, '');
        }
        s.systemPromptTemplate = s.systemPromptTemplate.replace(/\n{3,}/g, '\n\n');
    }

    // Location scene prompt defaults: keep textarea variant aligned with present-NPC toggle (v5.5.6+)
    // 5.5.7 also migrates the original 5.5.0 "establishing shot" factory text.
    if (isOlderThan(s.settingsVersion, '5.5.7')) {
        if (isShippedPortraitLocationSystemPrompt(s.portraitLocationSystemPrompt || '')) {
            s.portraitLocationSystemPrompt = getDefaultPortraitLocationSystemPrompt(!!s.portraitLocationIncludePresentNpcs);
        }
        s.settingsVersion = '5.5.7';
    }

    // 5.5.8: refresh WITH_NPCS factory prompt (minor narrative characters line).
    if (isOlderThan(s.settingsVersion, '5.5.8')) {
        const norm = (v) => (v || '').replace(/\r\n/g, '\n').trim();
        const prompt = norm(s.portraitLocationSystemPrompt);
        if (s.portraitLocationIncludePresentNpcs && (
            prompt === norm(PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS_V1)
            || prompt === norm(PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS)
        )) {
            s.portraitLocationSystemPrompt = PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS;
        }
        s.settingsVersion = '5.5.8';
    }

    if (isOlderThan(s.settingsVersion, '5.5.9')) {
        if (s.portraitRegenerateVisitedLocations === undefined) {
            s.portraitRegenerateVisitedLocations = false;
        }
        s.settingsVersion = '5.5.9';
    }

    // 5.5.10: Real-Time Mode vs Lorebook Locations auto-gen are mutually exclusive.
    // Prefer Real-Time Mode when both were previously enabled (avoids agent overwriting arrival art).
    if (isOlderThan(s.settingsVersion, '5.5.10')) {
        if (s.portraitAutoGenerateSceneView && s.portraitAutoGenerateLocations) {
            s.portraitAutoGenerateLocations = false;
        }
        if (!s.portraitAutoGenerateSceneView) {
            s.portraitRegenerateVisitedLocations = false;
        }
        s.settingsVersion = '5.5.10';
    }

    // 5.5.11: Real-Time Mode forces its companion location portrait options on.
    if (isOlderThan(s.settingsVersion, '5.5.11')) {
        if (s.portraitAutoGenerateSceneView) {
            s.portraitRegenerateVisitedLocations = true;
            s.locationImages = true;
            s.portraitLocationIncludePresentNpcs = true;
            s.portraitAutoGenerateLocations = false;
            if (isShippedPortraitLocationSystemPrompt(s.portraitLocationSystemPrompt || '')) {
                s.portraitLocationSystemPrompt = getDefaultPortraitLocationSystemPrompt(true);
            }
        }
        s.settingsVersion = '5.5.11';
    }

    // 5.5.12: Location images alpha — opt-in only (default off).
    if (isOlderThan(s.settingsVersion, '5.5.12')) {
        s.settingsVersion = '5.5.12';
    }

    // 5.5.13: Real-Time Visualization trigger modes (enter / change / every N outputs).
    if (isOlderThan(s.settingsVersion, '5.5.13')) {
        if (!s.portraitRealtimeTriggerMode) {
            // Preserve prior Real-Time behavior: regenerate on each location change/revisit.
            s.portraitRealtimeTriggerMode = 'location_change';
        }
        if (s.portraitRealtimeEveryNOutputs == null || Number(s.portraitRealtimeEveryNOutputs) < 1) {
            s.portraitRealtimeEveryNOutputs = 1;
        }
        s.settingsVersion = '5.5.13';
    }

    // ── MIGRATION: Auto-fix legacy corrupted PC Core Section colors ────────────────
    // 5.5.15: Fail closed after the Real-Time Visualization retry-loop bug.
    // Upgraded browsers must explicitly opt back in once; the local latch then
    // prevents stale whole-settings saves from resurrecting the mode after F5.
    if (isOlderThan(s.settingsVersion, '5.5.15')) {
        s.portraitAutoGenerateSceneView = false;
        s.portraitRegenerateVisitedLocations = false;
        setRealtimeVisualizationDisabled(true);
        s.settingsVersion = '5.5.15';
    }

    // 5.5.16: stock prompt moved <quests> above <homebrew_and_custom_classes>.
    // Swap those Control Room keys when still in the prior stock relative order.
    if (isOlderThan(s.settingsVersion, '5.5.16')) {
        const questsKey = 'base:quests';
        const homebrewKey = 'base:homebrew_and_custom_classes';
        const swapQuestsHomebrewOrder = (order) => {
            if (!Array.isArray(order)) return;
            const qi = order.indexOf(questsKey);
            const hi = order.indexOf(homebrewKey);
            if (qi === -1 || hi === -1 || hi >= qi) return;
            order[hi] = questsKey;
            order[qi] = homebrewKey;
        };
        swapQuestsHomebrewOrder(s.syspromptSectionOrder);
        for (const snapshot of Object.values(s.chatStates || {})) {
            swapQuestsHomebrewOrder(snapshot?.setup?.syspromptSectionOrder);
        }
        s.settingsVersion = '5.5.16';
    }

    // 5.5.17: remove Barnaby {{example}}, expose runtime fragments, NPC word targets → overall totals.
    if (isOlderThan(s.settingsVersion, '5.5.17')) {
        if (typeof s.routerBasicSystemPromptTemplate === 'string') {
            s.routerBasicSystemPromptTemplate = s.routerBasicSystemPromptTemplate
                .replace(/\n\{\{example\}\}\s*$/u, '')
                .replace(/\{\{example\}\}\s*$/u, '');
        }

        const defaults = buildDefaultSettings();
        for (const key of LOREBOOK_RUNTIME_FRAGMENT_KEYS) {
            if (typeof s[key] !== 'string' || !s[key]) {
                s[key] = String(defaults[key] ?? '');
            }
        }

        const sectionCount = (Array.isArray(s.npcCoreSections) && s.npcCoreSections.length > 0)
            ? s.npcCoreSections.length
            : DEFAULT_NPC_SECTIONS.length;
        const prevMajor = Number(s.npcMajorWords);
        const prevMinor = Number(s.npcMinorWords);
        if (Number.isFinite(prevMajor) && prevMajor > 0) {
            s.npcMajorWords = Math.max(1, Math.min(5000, Math.round(prevMajor * sectionCount)));
        } else {
            s.npcMajorWords = defaults.npcMajorWords;
        }
        if (Number.isFinite(prevMinor) && prevMinor > 0) {
            s.npcMinorWords = Math.max(1, Math.min(5000, Math.round(prevMinor * sectionCount)));
        } else {
            s.npcMinorWords = defaults.npcMinorWords;
        }
        s.npcWordTargetRescaleNotice = {
            fromMajor: Number.isFinite(prevMajor) ? prevMajor : null,
            fromMinor: Number.isFinite(prevMinor) ? prevMinor : null,
            toMajor: s.npcMajorWords,
            toMinor: s.npcMinorWords,
            sectionCount,
        };
        if (s.routerModules?.npc) {
            s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false, s);
        }
        s.settingsVersion = '5.5.17';
    }

    // 8.27.0: strengthen the Map Architect's MODERATE threat wording. Only
    // migrate the untouched shipped default; preserve prompts customized by users.
    if (isOlderThan(s.settingsVersion, '8.27.0')) {
        const previousModerateLine = '  - MODERATE: some occupancy. Hostiles in a minority of rooms. A few traps or hazards on key routes. Safe pauses are possible.';
        const currentModerateLine = '  - MODERATE: moderate occupancy. Hostiles here and there. Some traps and hazards. Safe pauses are not too unlikely.';
        const legacyDefault = DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT.replace(currentModerateLine, previousModerateLine);
        if (s.mapArchitectSystemPrompt === legacyDefault) {
            s.mapArchitectSystemPrompt = DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT;
        }
        s.settingsVersion = '8.27.0';
    }

    // 2026.8.22.1: nested-site taxonomy. Replace only the byte-identical shipped
    // prompts from the preceding release; customized prompts remain untouched.
    if (isOlderThan(s.settingsVersion, '2026.8.22.1')) {
        if (promptSignature(s.mapArchitectSystemPrompt) === '14870:8b5acf86') {
            s.mapArchitectSystemPrompt = DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT;
        }
        if (promptSignature(s.mapUpdaterSystemPrompt) === '9025:d21f2f49') {
            s.mapUpdaterSystemPrompt = DEFAULT_MAP_UPDATER_SYSTEM_PROMPT;
        }
        if (promptSignature(s.mapEvolutionSystemPrompt) === '19340:f2971ff8') {
            s.mapEvolutionSystemPrompt = DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT;
        }
        s.settingsVersion = '2026.8.22.1';
    }

    // 2026.8.22.2: let Map Architect sparingly seed narratively justified
    // settlement peers. Replace only the untouched preceding default.
    if (isOlderThan(s.settingsVersion, '2026.8.22.2')) {
        if (promptSignature(s.mapArchitectSystemPrompt) === '15245:3f89155f') {
            s.mapArchitectSystemPrompt = DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT;
        }
        s.settingsVersion = '2026.8.22.2';
    }

    // 2026.8.22.3: BUILDING containers and first-entry population. Replace
    // only untouched map prompts from the preceding release.
    if (isOlderThan(s.settingsVersion, '2026.8.22.3')) {
        if (promptSignature(s.mapArchitectSystemPrompt) === '15899:9c4786b5') {
            s.mapArchitectSystemPrompt = DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT;
        }
        if (promptSignature(s.mapUpdaterSystemPrompt) === '9171:bc52dc99') {
            s.mapUpdaterSystemPrompt = DEFAULT_MAP_UPDATER_SYSTEM_PROMPT;
        }
        if (promptSignature(s.mapEvolutionSystemPrompt) === '19287:beb4258a') {
            s.mapEvolutionSystemPrompt = DEFAULT_MAP_EVOLUTION_SYSTEM_PROMPT;
        }
        s.settingsVersion = '2026.8.22.3';
    }

    // 2026.8.23.1: keep private Map Architect premise facts from leaking into
    // initial player knowledge. Replace only the untouched preceding default.
    if (isOlderThan(s.settingsVersion, '2026.8.23.1')) {
        if (promptSignature(s.mapArchitectSystemPrompt) === '16167:7d0c5b25') {
            s.mapArchitectSystemPrompt = DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT;
        }
        s.settingsVersion = '2026.8.23.1';
    }

    // 2026.8.23.2: keep known/suspected asset placement consistent with area
    // knowledge. Replace only untouched prompts from the preceding release.
    if (isOlderThan(s.settingsVersion, '2026.8.23.2')) {
        if (promptSignature(s.mapArchitectSystemPrompt) === '16952:206a52ae') {
            s.mapArchitectSystemPrompt = DEFAULT_MAP_ARCHITECT_SYSTEM_PROMPT;
        }
        if (promptSignature(s.mapUpdaterSystemPrompt) === '10260:25eac89f') {
            s.mapUpdaterSystemPrompt = DEFAULT_MAP_UPDATER_SYSTEM_PROMPT;
        }
        s.settingsVersion = '2026.8.23.2';
    }

    // 2026.8.23.4: exterior-relative footer leaves (behind/outside/near…) must
    // not invent BUILDING assets. Replace only untouched Map Updater prompts.
    if (isOlderThan(s.settingsVersion, '2026.8.23.4')) {
        if (
            promptSignature(s.mapUpdaterSystemPrompt) === '10260:25eac89f'
            || promptSignature(s.mapUpdaterSystemPrompt) === '10466:e3dc5fae'
        ) {
            s.mapUpdaterSystemPrompt = DEFAULT_MAP_UPDATER_SYSTEM_PROMPT;
        }
        s.settingsVersion = '2026.8.23.4';
    }

    // 2026.8.24.1: streetscape observation raises UNREVEALED landmark knowledge.
    // Replace only untouched Map Updater prompts from the prior release.
    if (isOlderThan(s.settingsVersion, '2026.8.24.1')) {
        if (promptSignature(s.mapUpdaterSystemPrompt) === '11080:8dacfee2') {
            s.mapUpdaterSystemPrompt = DEFAULT_MAP_UPDATER_SYSTEM_PROMPT;
        }
        s.settingsVersion = '2026.8.24.1';
    }

    // 2026.8.24.2: BUILDING population guidance + first-entry lookback widening.
    // Replace only untouched Map Updater prompts from the prior release.
    if (isOlderThan(s.settingsVersion, '2026.8.24.2')) {
        if (promptSignature(s.mapUpdaterSystemPrompt) === '12407:1e905713') {
            s.mapUpdaterSystemPrompt = DEFAULT_MAP_UPDATER_SYSTEM_PROMPT;
        }
        s.settingsVersion = '2026.8.24.2';
    }

    // 2026.8.24.3: short footer names still match longer BUILDING assets.
    if (isOlderThan(s.settingsVersion, '2026.8.24.3')) {
        if (promptSignature(s.mapUpdaterSystemPrompt) === '13217:81c01304') {
            s.mapUpdaterSystemPrompt = DEFAULT_MAP_UPDATER_SYSTEM_PROMPT;
        }
        s.settingsVersion = '2026.8.24.3';
    }

    // Stamp factory version even when a release has no field rewrites
    // (8.28.0 mapped-site index is prompt/injection only).
    if (isOlderThan(s.settingsVersion, FACTORY_SETTINGS_VERSION)) {
        s.settingsVersion = FACTORY_SETTINGS_VERSION;
    }

    if (s.pcCoreSections && Array.isArray(s.pcCoreSections) && s.pcCoreSections.length === 6) {
        // We check by ID rather than name, because the legacy version might have had "Appearance" instead of "Appearance/Species"
        const idsMatch = s.pcCoreSections.every((sec, idx) => sec.id === DEFAULT_PC_SECTIONS[idx].id);
        const colorsMatch = s.pcCoreSections.every((sec, idx) => sec.color === DEFAULT_PC_SECTIONS[idx].color);
        if (idsMatch && !colorsMatch) {
            s.pcCoreSections.forEach((sec, idx) => {
                sec.color = DEFAULT_PC_SECTIONS[idx].color;
            });
        }
    }

    // Rename CORE field Equipment → Worn Equipment so LA does not treat it as inventory/coins.
    const renameEquipmentSection = (sections) => {
        if (!Array.isArray(sections)) return;
        for (const sec of sections) {
            if (sec?.id === 'sec_equipment' && sec.name === 'Equipment') {
                sec.name = 'Worn Equipment';
            }
        }
    };
    renameEquipmentSection(s.npcCoreSections);
    renameEquipmentSection(s.pcCoreSections);
    for (const presets of [s.npcSectionPresets, s.pcSectionPresets]) {
        if (!presets || typeof presets !== 'object') continue;
        for (const preset of Object.values(presets)) {
            renameEquipmentSection(preset?.sections || preset);
        }
    }

    enforceRealtimeVisualizationDisabled(s);

    // Old shipped default (2500) is too small for a JSON map pass — the output
    // stream is killed. Treat it as unset so existing chats pick up 25000.
    if (Number(s.mapUpdaterMaxTokens) === 2500) s.mapUpdaterMaxTokens = 25000;
    if (Number(s.mapEvolutionMaxTokens) === 2500) s.mapEvolutionMaxTokens = 25000;
    s.mapEvolutionCompressEnabled = s.mapEvolutionCompressEnabled !== false;
    const compressThreshold = Math.floor(Number(s.mapEvolutionCompressThreshold));
    s.mapEvolutionCompressThreshold = Number.isFinite(compressThreshold)
        ? Math.max(500, Math.min(100000, compressThreshold))
        : 10000;
    const narratorCommitTokens = Math.floor(Number(s.mapEvolutionNarratorCommitTokens));
    s.mapEvolutionNarratorCommitTokens = Number.isFinite(narratorCommitTokens)
        ? Math.max(200, Math.min(20000, narratorCommitTokens))
        : 2000;
    // Old shipped default was 0 (no cap). Raise existing 0s once to 6.
    // The flag must NOT live in defaults: seeding it true skipped this for everyone
    // who already had 0 saved. After this flag is persisted, 0 stays a valid choice.
    if (!s.keywordOverflowMigratedTo6) {
        if (Number(s.routerMaxKeywordOverflow) === 0) s.routerMaxKeywordOverflow = 6;
        for (const snapshot of Object.values(s.chatStates || {})) {
            if (!snapshot || typeof snapshot !== 'object') continue;
            if (Number(snapshot.routerMaxKeywordOverflow) === 0) snapshot.routerMaxKeywordOverflow = 6;
        }
        s.keywordOverflowMigratedTo6 = true;
    }

    // Old shipped default was 8. Raise existing 8s once to 12. Same: flag is
    // persisted only after this pass, so it cannot skip the first upgrade.
    if (!s.maxActiveKeysMigratedTo12) {
        if (Number(s.routerMaxActivations) === 8) s.routerMaxActivations = 12;
        for (const snapshot of Object.values(s.chatStates || {})) {
            if (!snapshot || typeof snapshot !== 'object') continue;
            if (Number(snapshot.routerMaxActivations) === 8) snapshot.routerMaxActivations = 12;
        }
        s.maxActiveKeysMigratedTo12 = true;
    }

    // One-time floor so old saved 6000/etc. pick up 25000. After this flag is set,
    // the user can lower the budget again without it bouncing back.
    if (!s.mapArchitectMaxTokensFloored) {
        const architectTokens = Number(s.mapArchitectMaxTokens);
        if (!Number.isFinite(architectTokens) || architectTokens < 25000) s.mapArchitectMaxTokens = 25000;
        s.mapArchitectMaxTokensFloored = true;
    }
    if (!s.mapRuntimeConnectionSeeded) {
        s.mapRuntimeConnectionSource = s.mapArchitectConnectionSource ?? 'default';
        s.mapRuntimeConnectionProfileId = s.mapArchitectConnectionProfileId || '';
        s.mapRuntimeCompletionPresetId = s.mapArchitectCompletionPresetId || '';
        s.mapRuntimeOllamaUrl = s.mapArchitectOllamaUrl || 'http://localhost:11434';
        s.mapRuntimeOllamaModel = s.mapArchitectOllamaModel || '';
        s.mapRuntimeOpenaiUrl = s.mapArchitectOpenaiUrl || '';
        s.mapRuntimeOpenaiKey = s.mapArchitectOpenaiKey || '';
        s.mapRuntimeOpenaiModel = s.mapArchitectOpenaiModel || '';
        s.mapRuntimeConnectionSeeded = true;
    }
    const tickScope = String(s.mapEvolutionTickScope || '').trim().toLowerCase();
    s.mapEvolutionTickScope = ['active', 'count', 'all', 'selected'].includes(tickScope) ? tickScope : 'all';
    const tickCount = Number(s.mapEvolutionTickCount);
    s.mapEvolutionTickCount = Number.isFinite(tickCount) ? Math.max(0, Math.min(50, Math.floor(tickCount))) : 1;
    s.mapEvolutionTickRandomize = s.mapEvolutionTickRandomize !== false;
    if (!Array.isArray(s.mapEvolutionSelectedRoots)) s.mapEvolutionSelectedRoots = [];
    s.mapEvolutionOnSiteIntervalHours = (() => {
        const hours = Math.floor(Number(s.mapEvolutionOnSiteIntervalHours));
        if (!Number.isFinite(hours)) return 8;
        if (hours === 0) return 0;
        return Math.max(1, Math.min(168, hours));
    })();
    if (!s.mapEvolutionIntervalHoursBySite || typeof s.mapEvolutionIntervalHoursBySite !== 'object' || Array.isArray(s.mapEvolutionIntervalHoursBySite)) {
        s.mapEvolutionIntervalHoursBySite = {};
    }
    s.mapEvolutionWorldReportLookback = Math.max(1, Math.min(20, Number(s.mapEvolutionWorldReportLookback) || 5));
    if (!s.mapEvolutionBacklogBySite || typeof s.mapEvolutionBacklogBySite !== 'object' || Array.isArray(s.mapEvolutionBacklogBySite)) {
        s.mapEvolutionBacklogBySite = {};
    }
    if (!s.mapEvolutionThreadsBySite || typeof s.mapEvolutionThreadsBySite !== 'object' || Array.isArray(s.mapEvolutionThreadsBySite)) {
        s.mapEvolutionThreadsBySite = {};
    }
    s.dungeonMapRevealAll = !!s.dungeonMapRevealAll;
    if (!s.mapEvolutionWorldReportApplications || typeof s.mapEvolutionWorldReportApplications !== 'object') {
        s.mapEvolutionWorldReportApplications = {};
    }
    s.worldProgressionLocationsPerReport = Math.max(1, Math.min(12, Number(s.worldProgressionLocationsPerReport) || 3));
    s.worldProgressionLocationRandomize = s.worldProgressionLocationRandomize !== false;
    if (!s.worldProgressionLocationLastAdvanced || typeof s.worldProgressionLocationLastAdvanced !== 'object') {
        s.worldProgressionLocationLastAdvanced = {};
    }

    // Replace only recognizable shipped entity-centric prompts. User-authored
    // prompts remain intact and are still constrained by the runtime contract.
    if (!s.locationCentricWorldProgressionMigrated) {
        const prompt = String(s.worldProgressionSystemPrompt || '');
        if (prompt.includes('Prioritize named ACTIVE WORLD LORE NPCs')
            && prompt.includes('DESIGNATED ENTITIES FOR THIS PERIOD')) {
            s.worldProgressionSystemPrompt = defaults.worldProgressionSystemPrompt;
        }
        s.locationCentricWorldProgressionMigrated = true;
    }

    // Retire the old entity-level World Skeleton. Recognizable shipped prompts
    // move to the macro-only default; custom prompts remain editable but are
    // constrained at runtime and their NPC output is rejected by the parser.
    if (!s.macroOnlyWorldSkeletonMigrated) {
        const prompt = String(s.worldProgressionSkeletonSystemPrompt || '');
        if (prompt.includes('## NPCS')
            && prompt.includes('{npcCount}')
            && prompt.includes('Generate exactly {factionCount} factions')) {
            s.worldProgressionSkeletonSystemPrompt = defaults.worldProgressionSkeletonSystemPrompt;
        }
        const retiredEntityFocusKeys = [
            'worldProgressionSkeletonNPCs',
            'worldProgressionRandomizeNPCs',
            'worldProgressionRandomSkeletonNPCCount',
            'worldProgressionRandomNarrativeNPCCount',
            'worldProgressionRandomizeLocations',
            'worldProgressionRandomSkeletonLocationCount',
            'worldProgressionRandomNarrativeLocationCount',
            'worldProgressionRandomizeFactions',
            'worldProgressionRandomSkeletonFactionCount',
            'worldProgressionRandomNarrativeFactionCount',
            'worldProgressionRandomizeConflicts',
            'worldProgressionRandomConflictCount',
        ];
        const targets = [s, ...Object.values(s.chatStates || {}), ...Object.values(s.profiles || {})];
        for (const target of targets) {
            if (!target || typeof target !== 'object') continue;
            for (const key of retiredEntityFocusKeys) delete target[key];
        }
        s.macroOnlyWorldSkeletonMigrated = true;
    }
    return extensionSettings[MODULE_NAME];
}

// ── Bar color resolver ─────────────────────────────────────────────────────────

/**
 * Returns the CSS background string for a bar element, respecting any
 * user-configured color overrides stored in settings.barColors.
 * @param {string} barId
 * @param {string} defaultBackground
 * @param {number|null} pct
 */
export function getBarBackground(barId, defaultBackground, pct = null) {
    if (!barId) return defaultBackground;
    const s = getSettings();
    const cfg = s.barColors?.[barId];
    if (!cfg) {
        const isHP = barId.endsWith(':HP') || barId.includes(':HPBAR');
        // Only apply automatic pct-based HP coloring when the caller hasn't supplied
        // a custom color (i.e. defaultBackground is the default HP green).
        // Explicit marker colors like ((BARRED)) or ((BARGREEN)) pass their own
        // gradient as defaultBackground — those must NOT be silently overridden.
        const DEFAULT_HP = '#00ffaa';
        if (isHP && pct !== null && (defaultBackground === DEFAULT_HP || defaultBackground == null)) {
            return pct > 60 ? '#00ffaa' : pct > 30 ? '#ffaa00' : '#ff5555';
        }
        return defaultBackground;
    }

    if (typeof cfg === 'string') return cfg; // Legacy support

    switch (cfg.mode) {
        case 'gradient':
            return `linear-gradient(90deg, ${cfg.color}, ${cfg.color2 || cfg.color})`;
        case 'dynamic': {
            const p = pct !== null ? pct : 100;
            return p > 60 ? '#00ffaa' : p > 30 ? '#ffaa00' : '#ff5555';
        }
        case 'solid':
        default:
            return cfg.color;
    }
}

/**
 * Checks if a specific bar is configured to be rendered as a percentage.
 * @param {string} barId
 * @returns {boolean}
 */
export function getBarShowAsPercentage(barId) {
    if (!barId) return false;
    const s = getSettings();
    const cfg = s.barColors?.[barId];
    if (cfg && typeof cfg === 'object') {
        return !!cfg.showAsPercentage;
    }
    return false;
}

/**
 * Checks if value-change feedback is enabled for a specific rendered bar.
 * This lives beside the color/display preferences because all three are
 * configured from the same per-bar popup.
 * @param {string} barId
 * @returns {boolean}
 */
export function getBarAnimateChanges(barId) {
    if (!barId) return false;
    const s = getSettings();
    const cfg = s.barColors?.[barId];
    return !!(cfg && typeof cfg === 'object' && cfg.animateChanges);
}

/**
 * Sanitizes a string into a lorebook-safe campaign prefix (same rules as chat-id derive).
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeCampaignPrefixString(raw) {
    if (!raw) return '';
    return String(raw).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Prefix used for world activation and router: optional user override, else from chat id.
 *
 * When `routerCampaignPrefixOverride` is set, it applies only to the anchored chat
 * (`routerCampaignPrefixOverrideAnchorChatId`). Legacy settings with an override but
 * no anchor keep prior behavior for the active chat only — other chats derive from
 * their own ids so Branch Campaign / cross-chat deactivate cannot share one stack.
 *
 * @param {string} chatId
 * @returns {string}
 */
export function getEffectiveRouterCampaignPrefix(chatId) {
    const s = getSettings();
    const ov = (s.routerCampaignPrefixOverride || '').trim();
    const id = String(chatId || '');
    if (!ov) return sanitizeCampaignPrefixString(id);

    const sanitizedOv = sanitizeCampaignPrefixString(ov);
    const anchor = (s.routerCampaignPrefixOverrideAnchorChatId || '').trim();
    if (anchor) {
        return id && id === anchor ? sanitizedOv : sanitizeCampaignPrefixString(id);
    }

    // Legacy unanchored override: only while evaluating the active chat.
    try {
        const ctx = SillyTavern.getContext();
        const activeId = String(ctx?.getCurrentChatId?.() || ctx?.chatId || '');
        if (id && activeId && id !== activeId) {
            return sanitizeCampaignPrefixString(id);
        }
    } catch (_) { /* fall through */ }

    return sanitizedOv;
}

// ── One-time data migrations ───────────────────────────────────────────────────

/**
 * Migrates custom fields from legacy formats to the current template-based format.
 * Safe to call repeatedly — idempotent.
 */
export function migrateCustomFields() {
    const s = getSettings();

    // Strip placeholder NEW_TAG entries persisted from previous sessions (one-time cleanup at init)
    if (Array.isArray(s.routerCustomTags)) {
        s.routerCustomTags = s.routerCustomTags.filter(t => t.tag && t.tag !== 'NEW_TAG');
    }

    (s.customFields || []).forEach(field => {
        // Migration 1: Convert single renderType to empty rows (old)
        if (field.renderType !== undefined && !field.rows && !field.template) {
            field.rows = [];
            delete field.renderType;
        }
        // Migration 2: Convert rows to template (New)
        if (field.rows && !field.template) {
            const UI_TO_MARKER = {
                'pills': 'PILLS', 'badge': 'BADGE', 'highlight': 'HIGHLIGHT',
                'hp_bar': 'BAR', 'xp_bar': 'XPBAR', 'text': 'TEXT', 'kv': 'TEXT'
            };
            field.template = field.rows.map(row => {
                const marker = UI_TO_MARKER[row.renderType] || 'TEXT';
                const content = row.label || '';
                return `((${marker})) ${content}`;
            }).join('\n').trim();
            delete field.rows;
            delete field.renderType;
        }
    });
}


/**
 * Global UI / connection prefs that must NOT live in chatStates.
 * Chat Link used to snapshot these; loadChatState then overwrote live settings on every
 * F5/code reload with a stale partition — auto-image-gen, immersion, connections, etc.
 * Memo/modules/portraits/WP timers stay per-chat; these stay global.
 */
export const CHAT_STATE_GLOBAL_UI_KEYS = [
    'portraitGeneratorSource',
    'portraitSkipPromptDialog',
    'hideImageGenToasts',
    'portraitAutoGenerateParty',
    'portraitAutoGeneratePlayer',
    'portraitAutoGenerateEnemies',
    'portraitAutoGenerateNpcs',
    'portraitAutoGenerateLocations',
    'portraitAutoGenerateSceneView',
    'portraitRealtimeTriggerMode',
    'portraitRealtimeEveryNOutputs',
    'portraitRegenerateVisitedLocations',
    'portraitLocationIncludePresentNpcs',
    'locationImages',
    'agentImmersionMode',
    'portraitConnectionSource',
    'portraitConnectionProfileId',
    'portraitCompletionPresetId',
    'portraitOllamaUrl',
    'portraitOllamaModel',
    'portraitOpenaiUrl',
    'portraitOpenaiKey',
    'portraitOpenaiModel',
    'keywordOverflowMigratedTo6',
    'maxActiveKeysMigratedTo12',
    'mapArchitectLookback',
    'mapArchitectMaxTokens',
    'mapArchitectMaxTokensFloored',
    'mapArchitectOpener',
    'mapArchitectSystemPrompt',
    'mapArchitectConnectionSource',
    'mapArchitectConnectionProfileId',
    'mapArchitectCompletionPresetId',
    'mapArchitectOllamaUrl',
    'mapArchitectOllamaModel',
    'mapArchitectOpenaiUrl',
    'mapArchitectOpenaiKey',
    'mapArchitectOpenaiModel',
    'mapRuntimeConnectionSource',
    'mapRuntimeConnectionProfileId',
    'mapRuntimeCompletionPresetId',
    'mapRuntimeOllamaUrl',
    'mapRuntimeOllamaModel',
    'mapRuntimeOpenaiUrl',
    'mapRuntimeOpenaiKey',
    'mapRuntimeOpenaiModel',
    'mapRuntimeConnectionSeeded',
    'mapUpdaterEnabled',
    'mapUpdaterRunEvery',
    'mapUpdaterMaxTokens',
    'mapUpdaterSystemPrompt',
    'mapEvolutionEnabled',
    'mapEvolutionIntervalHours',
    'mapEvolutionOnSiteIntervalHours',
    'mapEvolutionMaxTokens',
    'mapEvolutionCompressEnabled',
    'mapEvolutionCompressThreshold',
    'mapEvolutionNarratorCommitTokens',
    'mapEvolutionCompressSystemPrompt',
    'mapEvolutionTickScope',
    'mapEvolutionTickCount',
    'mapEvolutionTickRandomize',
    'mapEvolutionSelectedRoots',
    'mapEvolutionSystemPrompt',
    'worldConnectionSource',
    'worldConnectionProfileId',
    'worldCompletionPresetId',
    'worldOllamaUrl',
    'worldOllamaModel',
    'worldOpenaiUrl',
    'worldOpenaiKey',
    'worldOpenaiModel',
    'gameSystemWizardConnectionSource',
    'gameSystemWizardConnectionProfileId',
    'gameSystemWizardCompletionPresetId',
    'gameSystemWizardOllamaUrl',
    'gameSystemWizardOllamaModel',
    'gameSystemWizardOpenaiUrl',
    'gameSystemWizardOpenaiKey',
    'gameSystemWizardOpenaiModel',
    'gameSystemWizardSystemPrompt',
    'characterCreationConnectionSource',
    'characterCreationConnectionProfileId',
    'characterCreationCompletionPresetId',
    'characterCreationOllamaUrl',
    'characterCreationOllamaModel',
    'characterCreationOpenaiUrl',
    'characterCreationOpenaiKey',
    'characterCreationOpenaiModel',
    // Display Groups are global presentation metadata, never chat state.
    'displayGroupsEnabled',
    'displayGroupsShowGaps',
    'displayGroups',
    // Appearance is global — never chat-linked (defensive; not historically snapshotted)
    'panelBgImage',
    'panelBgImageNight',
    'panelBgOverlayStrength',
    'agentPanelBgImage',
    'agentPanelBgImageNight',
    'agentPanelBgOverlayStrength',
    'dayNightCycleEnabled',
    'xpBarAtBottom',
];

/** Strip global UI keys from every chatStates partition (one-shot hygiene on load/save). */
export function stripChatStateGlobalUiPrefs(settings) {
    const states = settings?.chatStates;
    if (!states || typeof states !== 'object') return false;
    let changed = false;
    for (const part of Object.values(states)) {
        if (!part || typeof part !== 'object') continue;
        for (const key of CHAT_STATE_GLOBAL_UI_KEYS) {
            if (Object.prototype.hasOwnProperty.call(part, key)) {
                delete part[key];
                changed = true;
            }
        }
    }
    return changed;
}

bindGetSettings(getSettings);
