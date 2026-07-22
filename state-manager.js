/**
 * state-manager.js — Multihog D&D Framework
 * Game state schema, defaults, persistence, migration, and profile I/O.
 * Owns the single source of truth for all runtime state (currentMemo, quests,
 * modules, chat-linked snapshots, connection settings, etc.).
 * Public barrel: leaf modules live under src/state/; consumers keep importing here.
 *
 * Imports: constants.js, src/state/*
 * Imported by: virtually everything — the root dependency.
 */

import { DEFAULT_STOCK_PROMPTS, BLOCK_ORDER, RT_PROMPTS } from './constants.js';
import { bindGetSettings } from './src/state/settings-ref.js';
import { DEFAULT_NPC_SECTIONS, DEFAULT_PC_SECTIONS, MODULE_NAME } from './src/state/schema-sections.js';
import { getNpcRelationshipMax } from './src/state/relationship-math.js';
import {
    getDefaultPortraitLocationSystemPrompt,
    isShippedPortraitLocationSystemPrompt,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS,
    PORTRAIT_LOCATION_SYSTEM_PROMPT_WITH_NPCS_V1,
} from './src/state/portrait-prompts.js';
import { buildNpcInstruction, buildLocInstruction, buildFacInstruction, rebuildAllModuleInstructions } from './src/state/module-instructions.js';
import { DEFAULT_MODULES } from './src/state/default-modules.js';
import { isOlderThan } from './src/state/versions.js';

export * from './src/state/schema-sections.js';
export * from './src/state/versions.js';
export * from './src/state/relationship-math.js';
export * from './src/state/relationship-dom.js';
export * from './src/state/relationship-prompts.js';
export * from './src/state/portrait-prompts.js';
export * from './src/state/module-instructions.js';
export * from './src/state/default-modules.js';

// Leaf modules call getSettings via settings-ref; bind before any getSettings use.
bindGetSettings(getSettings);

// ── Core settings accessor ─────────────────────────────────────────────────────

/**
 * Returns the live extension settings object, deep-merging defaults for any
 * missing keys. All reads and writes to persistent state go through this.
 * @returns {Record<string, any>}
 */
/**
 * Builds a fresh copy of every settings default. Extracted from getSettings()
 * so it can be reused by getFactoryCartridgePayload() (the "Stock" Game
 * Cartridge) without duplicating this large literal.
 */
function buildDefaultSettings() {
    return {
        currentMemo: "",
        prevMemo1: "",
        prevMemo2: "",
        memoHistory: [],
        lastDelta: "",
        enabled: true,
        trackerCollapsed: false,
        /** Integrated panel content: 'tracker' | 'agent' (card-flip mode when docked). */
        trackerContentMode: 'tracker',
        agentCollapsed: false,
        agentImmersionMode: false,
        agentKeysCollapsed: false,
        agentSettingsOpen: true,
        agentConsoleOpen: true,
        agentModulesOpen: true,
        agentWorldOpen: false,
        dayNightCycleEnabled: false,
        /** Optional State Tracker panel backdrop (data URL or https URL). */
        panelBgImage: '',
        /** Optional night/late-night backdrop for State Tracker; falls back to panelBgImage when empty. */
        panelBgImageNight: '',
        /** 0–100: day/night tint strength over the State Tracker backdrop. */
        panelBgOverlayStrength: 55,
        /** Optional detached Lorebook Agent panel backdrop. */
        agentPanelBgImage: '',
        /** Optional night/late-night backdrop for detached Lorebook Agent. */
        agentPanelBgImageNight: '',
        /** 0–100: overlay strength for detached Lorebook Agent backdrop. */
        agentPanelBgOverlayStrength: 55,
        debugMode: false,
        connectionSource: "default",
        connectionProfileId: "",
        completionPresetId: "",
        renderedViewActive: true,
        panelLayoutMode: 'stack',   // 'stack' = classic vertical stack | 'tabs' = compact tab mode (Character/Combat pinned, rest behind tabs)
        maxTokens: 0,
        fontSize: 14,
        agentFontSize: 13,
        customSysprompt: false,
        /** When true (default), snapshot Quick Prompt Main before the framework overwrites it and restore on tracker disable. */
        mainSyspromptBackupEnabled: true,
        stashedMainSysprompt: '',
        syspromptStashArmed: false,
        rngEnabled: true,
        diceFunctionTool: false,
        enablePortraits: true,
        portraitsFileStorageVersion: 1,
        portraitGeneratorSource: "native",
        portraitSkipPromptDialog: false,
        /** When true, suppress info/success toasts from portrait/location AI auto-generation (errors still show). */
        hideImageGenToasts: false,
        portraitAutoGenerateParty: false,
        portraitAutoGeneratePlayer: false,
        portraitAutoGenerateEnemies: false,
        portraitAutoGenerateNpcs: false,
        portraitAutoGenerateLocations: false,
        /** Real-Time Mode: generate location images only on Scene View arrival (mutually exclusive with portraitAutoGenerateLocations). */
        portraitAutoGenerateSceneView: false,
        /**
         * Real-Time scene-art trigger:
         * - location_enter: generate once when arriving at a place with no image
         * - location_change: regenerate whenever the location path changes (incl. revisits)
         * - every_n_outputs: location_change + also regenerate every N chat outputs
         */
        portraitRealtimeTriggerMode: 'location_change',
        /** Used when portraitRealtimeTriggerMode === 'every_n_outputs' (min 1). */
        portraitRealtimeEveryNOutputs: 1,
        portraitRegenerateVisitedLocations: false,
        portraitLocationIncludePresentNpcs: false,
        pollinationsApiKey: "",
        pollinationsModel: "zimage",
        inventoryWorthMode: "hover",   // 'hover' = worth shown as tooltip only | 'display' = coin badge shown inline
        npcCoreSections: [],
        pcCoreSections: [],
        npcSectionPresets: {},
        pcSectionPresets: {},
        npcMajorWords: 25,
        npcMinorWords: 15,
        npcRelationshipMaxDefault: 150,
        npcRelationshipMax: 150,
        npcPortraits: true,
        locationImages: false,
        npcRelationshipBars: true,
        npcRelationshipToast: true,
        stateTrackerSwipeRollback: true,        // auto-roll back State Tracker memo on swipe           // emit toast notification when relationship values change
        npcRelationshipValues: {},
        npcRelationshipLog: {},      // { [fullId]: [{timestamp,field,delta,newValue,source}] } — capped 50/NPC
        experimentalNpcImport: true,
        ignoreNpcImportLimits: true,
        npcAddAsIsMode: 'ai_review',   // 'literal' = wrap card verbatim in [CORE]; 'ai_review' = minimal world/era fix before adding
        use24hTime: false,
        useDdMmYyFormat: false,
        initialDate: "Day 1",
        onboardingGenre: "fantasy",
        onboardingLevel: 1,
        onboardingGearTier: "auto",
        onboardingCustomInstructions: "",
        onboardingCreatePersona: false,
        onboardingPersonaWords: "150",
        onboardingPersonaWordsCustom: "",
        /** Last Character Creator form values, saved when Generate Character is pressed. */
        characterCreatorDraft: null,
        /** True while the Character Creator inline panel is open on the onboarding screen. */
        characterCreatorPanelOpen: false,
        barColors: {},
        modulePageSizes: {},
        customTheme: null,
        savedThemes: {},
        systemPromptTemplate:
            `You are the State Extractor Model. Your task is to maintain a structured State Memo based on the roleplay narrative.
<core_directives>
IGNORE NARRATIVE FLUFF: Do not track temporary dialogue or actions. Only track persistent state changes.
INTEGRATION: Track all durations stated by the narrative (e.g. 'poisoned for 3 turns'). Decrement by 1 each round in [COMBAT]. For out-of-combat/time-based durations, calculate the delta between the current [TIME] and the [TIME] in the PRIOR MEMO.
CREATION: You MAY create a section that did not exist in the Prior Memo when the narrative warrants it based on your enabled modules.
DELETION: To REMOVE a section entirely, you MUST output: \`[TAG]REMOVED[/TAG]\`.
NO RELATIONSHIPS: Never track relationships, and never create a relationship section (e.g., [RELATIONSHIPS]). NPC relationships are handled by a separate, dedicated system.
</core_directives>

<modules>
You must track the following enabled modules:
{{modulesText}}

NEVER ignore a module.
</modules>

<rules>
1. Read the PRIOR MEMO and the NARRATIVE OUTPUT carefully.
2. Determine which sections changed. Only output sections that actually changed.
3. Use strict [TAG]...[/TAG] structure based on the modules requested above. ALWAYS include the closing tag.
4. Omit unchanged sections entirely. Do NOT output a section if its contents did not change.
5. BLOCK PERSISTENCE: For list-based sections ([PARTY], [INVENTORY], [ABILITIES], [SPELLS], [COMBAT]), if any single item within that section changes, you MUST re-output the ENTIRE section containing all items. Never omit existing members or items unless they are explicitly logically removed.
6. If there are absolutely NO CHANGES to any section, you MUST output exactly: \`NO_CHANGES_DETECTED\`
7. Output ONLY the changed sections (or NO_CHANGES_DETECTED). No preamble, no explanation, no commentary.
</rules>


<list_formatting>
For sections with multiple items ([ABILITIES], [INVENTORY], [SPELLS], [PARTY]):
1. Use a bulleted list with \`-\`.
2. Format: \`- Name (Resource/Max, Effect Description)\`.
3. If no resource tracker is needed, use: \`- Name (Effect Description)\`.
4. The parentheses MUST contain the resource count FIRST, followed by a comma, then the description.
</list_formatting>

<buff_debuff_logic>
Duration Tracking: Record all durations explicitly. Use turns for combat (e.g., for 3 turns) and H:M for narrative time (e.g., 1h 30m).
Restoration Anchors: When a buff or debuff modifies a base statistic (AC, Attributes, etc.), record the base value directly in the respective field—e.g., 'AC 18 (base 13)'.
Status Formatting: Output the buff/debuff in the Status line with its absolute mathematical effect in parentheses. Example: 'Shield (+5 AC, 1 turn)'.
Auto-Reversion: During each State Sync, check if a duration has expired. If it has, use the modifier in the Status line to reverse the math on the base statistic (e.g., subtracting the +5 AC), restore the field, and remove the buff from the list.
Conditional Buffs: For effects without a set time, use event-based anchors. Example: 'Exhaustion (Disadvantage on Ability Checks, until Long Rest)'.
STATUS LABELING: In [CHARACTER], [PARTY], and [COMBAT] blocks, prefix positive status effects (buffs) with \`(+)\` and negative status effects (debuffs) with \`(-)\`. Every status MUST include its effect AND duration in parentheses. Example: \`Status: (+) Heroism (+2 Temp HP per turn, 9 turns), (-) Poisoned (Disadvantage on attacks, 2 turns)\`. Healthy or no effects needs no prefix.
Equipment Incompatibility: When a character equips an item they cannot properly use (wrong proficiency, insufficient Strength, class restriction, etc.), record it as an event-anchored debuff whose parenthetical MUST name the causing item so removal can be inferred when that item loses its [E] tag. Format: \`(-) [Penalty Label] ([effect(s)], while [Item Name] is equipped)\`. Example: \`(-) Armor Non-Proficiency (Disadvantage on Str/Dex checks, arcane spell failure, while Iron Plate Mail is equipped)\`.
</buff_debuff_logic>

<progression_logic>
Update abilities/attributes/HP/etc accordingly, such as an ability's 1d6 bonus increasing to 2d6, etc.
</progression_logic>

<custom_formatting>
You may be asked to use Markers: ((PLS)), ((B)), ((XB)), ((BDG)), ((HGT)). These are for graphical rendering options; use them if instructed but only if instructed in a specific [MODULE].
</custom_formatting>`,
        modules: {
            character: true,
            party: true,
            'benched party': true,
            combat: true,
            inventory: true,
            abilities: true,
            spells: true,
            time: true,
            xp: true,
            quests: true,
        },
        stockPrompts: { ...DEFAULT_STOCK_PROMPTS },
        customFields: [],
        customSyspromptLibrary: [],
        /**
         * System Prompt Control Room — explicit render order for every top-level
         * sysprompt section, mixing built-in tags and customSyspromptLibrary entries.
         * Entries are string keys: "base:<tag>" for one of the fixed built-in
         * sysprompt.txt tags, or "lib:<id>" for a customSyspromptLibrary entry
         * (unlocked_base overrides ride along on their "base:<tag>" slot — they
         * never get their own separate key). Empty array = not yet initialized;
         * normalizeSectionOrder() in game-systems.js lazily seeds/reconciles it.
         */
        syspromptSectionOrder: [],
        /**
         * Game System Wizard bundles — link a customSyspromptLibrary entry and/or a
         * customFields entry as a single manageable unit.
         * Shape: { id, name, icon, enabled, needsTracker,
         *          driverTime: boolean (value auto-ticks each turn from elapsed [TIME]
         *              minutes — a rate x minutes-elapsed formula, e.g. hunger/thirst/fatigue),
         *          driverGmAnnotation: boolean (value changes via GM-declared inline delta
         *              annotations requiring cross-turn narrative judgment, e.g. faction
         *              reputation, trust, sanity),
         *          driverStatedFact: boolean (tracker reads an objective number already
         *              plainly stated in the narrative output each turn, e.g. a stated
         *              damage amount — no judgment or annotation needed),
         *          (one or more drivers may be true at once; at least one must be true
         *              whenever needsTracker is true — see normalizeDrivers() in game-systems.js),
         *          effectOwner: 'tracker'|'gm' (who narrates a crossed threshold),
         *          syspromptLibraryId, customFieldTag, description, createdAt }
         */
        gameSystems: [],
        /**
         * Game Cartridges — named, exportable/importable snapshots of the entire
         * "configuration surface" (system prompt sections/order/toggles, Game
         * Systems, tracker modules, block order, stock prompts, extractor prompt,
         * RNG/format flags). See game-cartridges.js. Shape: { id, name,
         * description, icon, createdAt, updatedAt, format:'multihog-game-cartridge',
         * version:1, payload: <see getFactoryCartridgePayload()> }.
         */
        gameCartridges: [],
        profiles: {},
        activeProfile: "",
        fullViewSections: [],
        blockOrder: ['COMBAT', 'CHARACTER', 'PARTY', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME'],
        legacyDiceNaming: false,
        diceD100Mode: false,
        rngToolD20: false,
        rngToolD100: false,
        rngQueueD20: true,
        rngQueueD100: false,
        closeCount: 0,
        lookbackMessages: 2,
        directPromptContext: 5,
        historyIndex: -1,
        fullAuditMaxTokens: 32000,
        stateTrackerRunEvery: 1,
        ctxWorldInfo: false,
        lorebookFilter: [],
        ollamaUrl: "http://localhost:11434",
        ollamaModel: "",
        openaiUrl: "",
        openaiKey: "",
        openaiModel: "",
        openaiMaxTokens: 0,
        chatLinkEnabled: true,
        chatStates: {},
        quests: [],
        /** Narrator <narrative> pacing mode: normal | high_agency | downtime. */
        narrativePacing: 'normal',
        syspromptModules: {
            loot: true,
            random_events: true,
            resting: true,
            party_bench: true,
            quests: true,
            questsDeadlines: false,
            questsFrustration: false,
            questsShowArchive: true,
            CYOA_mode: true,
        },
        cyoaConfig: {
            useCustomPrompt: false,
            customPromptText: '',
            slots: [
                { type: 'narrative' },
                { type: 'narrative' },
                { type: 'narrative' },
                { type: 'narrative' },
                { type: 'narrative' },
            ],
            presets: {},
            useEmojis: true,
            useXmlTag: true,
            useButtonTags: true,
            buttonColor: '#120a28',
            buttonOpacity: 0.9,
            buttonTextColor: '',
            buttonBorderColor: '',
            choiceAccentColor: '',
            mechColor: '#ffc966',
            mechBgOpacity: 0.14,
            dcColor: '#ff9f6b',
            modColor: '#9fd4ff',
            tagColor: '#c9b0ff',
            mechAccentColor: '',
        },
        routerEnabled: true,
        routerLog: [],
        activeRouterKeys: [],
        activeWorldKeys: [],
        keywordActivatedKeys: [],  // entries activated by keyword scanner — auto-expire when keyword leaves scan window
        routerConnectionSource: "default",
        routerOpenaiUrl: "",
        routerOpenaiKey: "",
        routerOpenaiModel: "",
        routerOllamaUrl: "http://localhost:11434",
        routerOllamaModel: "",
        routerConnectionProfileId: "",
        routerCompletionPresetId: "",
        routerMaxTokens: 0,
        routerMaxTurns: 5,
        routerMaxActivations: 8,
        routerMaxKeywordOverflow: 0,   // 0 = unlimited; N = max extra keyword-activated entries above routerMaxActivations
        routerCampaignPrefix: "",
        routerDefaultPosition: 4,      // Default to 4 (at Depth) for prompt caching protection
        routerDefaultDepth: 4,
        routerDefaultOrder: 100,
        routerDefaultRole: 0,          // 0 = System, 1 = User, 2 = AI
        loreInjectionPosition: 4,
        loreInjectionDepth: 4,
        loreInjectionRole: 0,
        routerCampaignPrefixOverride: "",
        /** ST chat id for which `routerCampaignPrefixOverride` applies; empty = legacy (override only when chatId === active ctx chat id). */
        routerCampaignPrefixOverrideAnchorChatId: "",
        routerLookback: 4,
        routerDirectLookback: 10,
        routerDirectPrompt: "",
        routerBasicMode: false,
        routerNativeKeywordActivation: false,
        routerPaused: false,
        routerRunEvery: 3,
        routerIncludeHidden: false,
        routerSwipeRollback: true,   // undo lorebook pass when swiping away from the generation that triggered it
        routerLookbackSinceLastRun: true,   // default: capture all messages since the last agent run
        routerLookbackSinceLastUser: false,  // alternative: capture since last user message
        routerLastRunChatLength: 0,          // watermark: chat.length when the agent last ran (indexing only, not shown to user)
        routerLastRunAt: 0,                   // epoch ms: when the agent last completed a pass (for display)
        routerWatermarkBaselinePending: false, // one-shot: baseline watermark after lookback fix upgrade
        routerUndockHintShown: false,
        routerPromptForPrefix: false,
        routerModules: JSON.parse(JSON.stringify(DEFAULT_MODULES)),
        routerCustomTags: [],
        routerHistory: [],
        routerCleanupTokenThreshold: 300,
        routerCleanupEvery: 0,
        routerCleanupUseThreshold: true,
        // ── World Progression (deterministic, standalone pass) ────────────────────
        worldProgressionEnabled: false,           // master toggle
        worldProgressionIntervalHours: 24,        // fire every X in-world hours (24 = daily)
        worldProgressionKeepActive: 1,            // rolling window of active reports
        worldProgressionLookback: 20,             // number of recent chat messages to include (0 = disabled)
        worldProgressionHistoryLookback: 0,       // number of historical reports to incorporate (0 = include all)
        worldProgressionInjectionPosition: 4,     // Default to 4 (at Depth)
        worldProgressionInjectionDepth: 3,
        worldProgressionInjectionRole: 0,         // System
        worldProgressionRandomizeNPCs: false,            // toggle to randomize NPC pool
        worldProgressionRandomSkeletonNPCCount: 2,        // skeleton NPCs to spotlight per report
        worldProgressionRandomNarrativeNPCCount: 3,       // narrative NPCs to spotlight per report
        worldProgressionRandomizeLocations: false,        // toggle to randomize locations
        worldProgressionRandomSkeletonLocationCount: 2,   // skeleton locations to spotlight per report
        worldProgressionRandomNarrativeLocationCount: 2,  // narrative locations to spotlight per report
        worldProgressionRandomizeFactions: false,         // toggle to randomize factions
        worldProgressionRandomSkeletonFactionCount: 2,    // skeleton factions to spotlight per report
        worldProgressionRandomNarrativeFactionCount: 2,   // narrative factions to spotlight per report
        worldProgressionRandomizeConflicts: false,        // toggle to randomize conflicts
        worldProgressionRandomConflictCount: 3,           // number of conflicts to incorporate
        worldProgressionSkeletonFactions: 4,       // number of factions in skeleton
        worldProgressionSkeletonLocations: 4,      // number of locations in skeleton
        worldProgressionSkeletonNPCs: 0,           // number of NPCs in skeleton
        worldProgressionSkeletonConflicts: 3,      // number of conflicts in skeleton
        worldProgressionLastFiredAtMinutes: -1,   // last in-world total-minutes at which a report fired
        worldProgressionLastFiredPeriodLabel: '', // label of the last generated period entry
        worldProgressionConsolidateEnabled: false,         // auto-compress backlog when threshold is hit
        worldProgressionConsolidateInterval: 7,            // number of raw reports before consolidation fires
        worldProgressionSystemPrompt: `You are the World Progression Engine — a living simulation of the game world's off-screen activity. Simulate political scheming, faction moves, economic shifts, environmental changes, creature activity, rival actors pursuing independent agendas, weather events, and emergent consequences of prior world state.

The report covers the in-world period: **{periodLabel}**

## RULES
1. Do NOT summarize player actions. Build consequences from them instead — defeated rivals plot revenge, sympathetic contacts cover their tracks, encountered strangers react to what happened.
2. QUESTS and EVENTS are historical records for context only — they are NOT simulatable entities. Never generate entries that describe a quest advancing, stalling, succeeding, or failing. If a quest appears in the designated entities block, ignore it entirely.
3. Prioritize named ACTIVE WORLD LORE NPCs. Every report must include at least 2. These are your highest-value subjects. However, if the ## DESIGNATED ENTITIES FOR THIS PERIOD block is present, you MUST strictly follow it and only change the status, advance the timeline, or create new narrative beats for these designated entities. You are strictly forbidden from changing the status, advancing the timeline, or creating new narrative beats for unauthorized entities. However, you MAY mention them passively as background context if their past, established actions are a direct catalyst for the designated entities.
4. Tracked party members currently in [PARTY] are never eligible for this report — they are with {{user}} right now and are handled upstream, not by this rule. For any OTHER NPC who was physically present with {{user}} during the reporting period, only generate plausible background activity — digital actions, private decisions, private thoughts/opinions, off-screen communications. Do not relocate them.
5. Format as 15 bullet-pointed entries (using "- "), with a blank line (newline) between each world event. Dense, no filler, no markdown. Each entry must be exactly 1 sentence. Do NOT prefix the lines with the period or time label.
6. Output ONLY the report content. No preamble, no tags, no meta-commentary.
7. Do not simply repeat the same entities and always build on the previous report; take interesting entities from the ACTIVE WORLD LORE as well as the SKELETON regardless of whether they were featured in the previous report(s). If designated entities are provided, strictly limit your active scope to those, obeying the passive referencing rule for other entities.
8. DO NOT write a cumulative report, stacking old entries in the same report. Only write new events, not a recap of the previous ones; they are preserved in their own file.
9. Cross-category entity bleeding is desirable; often have designated NPCs, locations, factions, and conflicts collide or influence one another in the same narrative beat rather than treating them as isolated line items. However, only do this when it makes sense.
10. You must strictly respect geographical and logistical boundaries to preserve spatial plausibility; isolated or distant entities cannot physically interact and must instead collide via informational, digital, or financial ripples (e.g., radio tracking, digital alerts, automated network scrapers, or news traveling from afar).
11. Character vectors must take place only at or ripple through the designated locations provided for this period; if an active NPC cannot logically travel to a selected location within this time window, their connection must manifest purely as an off-screen reaction or informational dependency.`,
        // ── World Skeleton ─────────────────────────────────────────────────────────
        worldProgressionSkeletonAtmosphereSummary: '', // single paragraph atmosphere description (required only if not using existing entries context)
        worldProgressionSkeletonAtmosphereLookback: 30, // messages lookback count for atmosphere generation
        worldProgressionSkeletonUseExisting: true, // toggle to feed existing entries context when appending
        worldProgressionExclusionList: '',         // comma-separated list of lore entry titles or keys to exclude from focus randomization
        // NOTE: active [PARTY] members are always, unconditionally excluded from World
        // Progression (see router.js) — no setting needed. [BENCHED PARTY] members are
        // eligible for simulation, also unconditionally.

        worldProgressionSkeletonSystemPrompt: `You are a World Architect. Given a world theme/seed, generate a sparse foundational skeleton for an RPG campaign simulation.

## FACTIONS ({factionCount} total)
Each faction: name, one-sentence nature, one-sentence current tension.

## LOCATIONS ({locationCount} total)  
Each location: name, one-sentence description, one-sentence current state.

## NPCS ({npcCount} total)
Each NPC: name, one-sentence description, one-sentence current state. (Omit/skip this section entirely if the count is 0)

## CONFLICTS ({conflictCount} total)
Each conflict: parties involved, one-sentence current state.

## RULES
- Consistent with provided theme/seed.
- No player character references.
- No placeholder names.
- Maximum 2 sentences per entity. Fragments acceptable.
- Output ONLY the structured content.`,

        routerSystemPromptTemplate: `<basic_instructions>
You are the Researcher Agent, a specialized Dungeon Master's Assistant. Your role is to architect the AI Narrator's memory — keeping the Active Context saturated with the most relevant lore at all times.

You have the authority to browse the campaign's archive, search for relevant history, and update {{campaignRoot}} to reflect new developments.

Do not wait for the Narrator to forget something before you act. If a name, place, or faction is mentioned — even in passing — load it immediately. If the party is moving, pre-load the destination before they arrive.

Make multiple entries per turn if necessary. Thoroughness is your primary virtue.
</basic_instructions>

<context_maximization>
Your goal is to keep the Active Context saturated. Think of it as a stage: it is your job to have every prop, actor, and set piece in place before the scene begins.

- **Saturation Goal:** Keep Active entries as close to MAX as possible at all times. An underloaded context is a failure state.
- **Proactive Loading:** Do not wait for a gap to appear. If a name or location is mentioned, or if the party is about to move, activate the relevant entries immediately.
- **Context Rotation:** When the context is full and new entries are needed, deactivate "Exit Contexts" (rooms left, NPCs departed, resolved threads) to make room for "Entry Contexts" (current room, present NPCs, active quest objective). Treat it as a sliding window, not a hard ceiling.
- **Priority Tiering:** Use this order when deciding what to keep vs. rotate out:
  1. NPCs physically present in the current scene
  2. The current sub-location (room, street, building)
  3. The parent location (district, dungeon, city)
  4. The active objective of the current Quest
  5. Relevant Factions or STATS for present characters
  6. Regional or world lore

If you briefly exceed the budget due to newly activated entries, deactivate the lowest-priority items in the same turn to return within range. It is better to rotate aggressively than to leave the Narrator without context.

Budget violation notices mean you exceeded the limit. When you see one, immediately identify and deactivate the least relevant entries (Exit Contexts first) until you are within budget. List those IDs in the \`deactivate\` field of the same commit call.
</context_maximization>

<player_character_safeguard>
The player character (the user) is the protagonist.
- Do NOT create a lorebook entry (NPC, Location, Faction, etc.) for the player character under any circumstances.
- The player character is the speaker labeled "Player" (and prompt replacement "{{user}}"). In the chat logs, pay close attention to what name(s) or alias(es) the other characters use when addressing or referring to the "Player" (e.g., if they address the Player as "Dave Davidson" or "Dave", then "Dave Davidson" is the player character).
- Under no circumstances should you create an NPC entry for these names/aliases, because they refer to the player.
- Always use the exact macro string \`{{user}}\` when referring to the player. Do NOT write the plain word "user", "player", "Player", or the player's roleplay character name (like "Dave Davidson") in plain text in any entry updates or descriptions.
</player_character_safeguard>

<formatting>
When recording a new entry, keep the lorebook category separate from the entity label.

- Use the "category" field for the type (NPC, LOC, FAC, QUEST, EVENT, or a custom tag).
- Use the "label" field for the entity name only. Do NOT prefix labels with the category tag.
- **IMPORTANT FOR KEYWORDS (KEYS):** Always include the entity's own name/title (without any timestamps like "Day 1", "Day 2", "12:15 AM", etc.) in the list of keywords. The title itself (stripped of timestamps) is the most reliable trigger, so it must be present as a keyword. For example, if the entry title is "[12:15 AM, Day 2] Defense of Ironbelly's Workshop", the keys list MUST include "Defense of Ironbelly's Workshop".
- **DO NOT INCLUDE \`{{user}}\`, \`{{char}}\`, or general player references** in the keyword list (\`keys\`). The user/player is present in all events/locations, so including them as a keyword causes false matches and wastes context tokens.

Correct examples:
- {"label": "Iron Syndicate", "category": "FAC", "keys": ["Iron Syndicate", "faction"]}
- {"label": "Thalric Thorne", "category": "STATS", "keys": ["Thalric Thorne", "stats"]}
- {"label": "[12:15 AM, Day 2] Defense of Ironbelly's Workshop", "category": "EVENT", "keys": ["Defense of Ironbelly's Workshop", "siege", "workshop"]}

Incorrect examples:
- {"label": "FAC: Iron Syndicate", "category": "FAC", "keys": ["faction"]} (missing the entity name keyword)
- {"label": "[12:15 AM, Day 2] Defense of Ironbelly's Workshop", "category": "EVENT", "keys": ["[12:15 AM, Day 2] Defense of Ironbelly's Workshop"]} (includes the timestamp in keyword, which will never trigger reliably)
</formatting>

<quests>
When you log a quest, describe the location and the quest giver in a single paragraph, including details about them that will be relevant to location persistence when {{user}} eventually returns to turn in the quest.
</quests>

<updating_entities>
When an entity (location, NPC, etc.) changes in a meaningful way, update the associated lorebook entry.

Entries are append-only chronicles. Provide ONLY the new information as a timestamped delta (e.g. "[Day 3, 14:00] The forge was destroyed."). Do NOT rewrite or re-summarize the full entry. Do NOT copy, paraphrase, or reconstruct content already present in the existing entry. Only the net-new development belongs in your delta.

EXCEPTION — NPC combat profiles: an NPC's combat stats are NOT a chronicle event and must never be written as a timestamped delta line. Per the COMBAT_PROFILE_PERSISTENCE rule for NPCs, they belong inside [CORE] as a patched identity field, edited in place.

IMPORTANT: Always use the exact macro string \`{{user}}\` when referring to the player. Do NOT write the plain word "user" or "player" in your entry updates.

- **COMBAT GRANULARITY**: Do NOT record granular, turn-by-turn combat status updates (e.g., individual monster HP, turn actions, temporary combat conditions). For long combats, limit updates to the initiation (e.g., when they became hostile and attacked {{user}}), a high-level progress update every ~5 rounds to capture major shifts, and the final macro-level outcome (e.g., the battle resolved, who died/survived/fled).

For locations: the [ID:] stamp at the top of every injected entry gives you the ID to pass to the update tool.
IMPORTANT: Never include the [ID:] line in the content field you write. It is managed automatically — only use the ID value in the "id" field of the update tool.

EVENT entries use this format:
  [Day X, HH:MM] <one-sentence fact>
  [Day X, HH:MM] <next development>
  [Day X, HH:MM] <next development after that, etc>
Each line is a standalone delta. Never write a paragraph. Never reference prior lines.
</updating_entities>

<timestamps>
The current world date/time is visible in the ## NARRATIVE section — look for the status footer in recent messages (e.g. "11:52 AM, Day 1").
When recording an EVENT or any time-sensitive entry, include the timestamp at the beginning of the content.
Example: "[Day 1, 11:52] Character signed the contract with Brodrik."
</timestamps>

<bravery>
Don't be afraid to hit the budget exactly. It's better to lean towards activating too much than too little.
</bravery>`,
        routerModularPromptTemplate: `## FORMAT
Use these tags in your response:
{{formatLines}}

## HIERARCHY CONVENTION (CRITICAL FOR LOCATIONS)
For LOC entries, the Name field MUST be the FULL hierarchical path using " :: " (space, colon, colon, space) as the separator.
The current scene's location stack is shown above as "CURRENT LOCATION". Prepend it to any sub-location you record.

Examples:
  CURRENT LOCATION: Khelt :: Rust-Lantern District
  --> [[LOC: Khelt :: Rust-Lantern District :: Marrow-Deep Mines Office | A squat iron building managing mining contracts. | Marrow-Deep Mines Office, mines, contracts, Khelt, Rust-Lantern]]
  --> [[LOC: Khelt :: Rust-Lantern District :: The Guilded Anvil Tavern | A noisy tavern with a job bulletin board. | The Guilded Anvil Tavern, tavern, jobs, Khelt, Rust-Lantern]]

Also include each ancestor name (Khelt, Rust-Lantern District) as a plain keyword in the Keywords field.
**LOC [CORE]:** When first recording a place, wrap 1–2 permanent sentences in plain \`[CORE] … [/CORE]\`. Do NOT use NPC field headers (Appearance/Species, Personality, etc.).
**IMPORTANT FOR KEYWORDS:** Always include the entry's own title/name (without any timestamps like "Day 1", "Day 2", "12:15 AM", etc.) in the keywords field. The title itself (stripped of timestamps) is the most reliable trigger, so it must be present as a keyword. For example, for a tag representing a "Defense of Ironbelly's Workshop" event, the keywords MUST contain "Defense of Ironbelly's Workshop". DO NOT INCLUDE \`{{user}}\`, \`{{char}}\`, or general player references in the keywords field — the player is present in all events and locations, so tagging them is redundant and wastes context tokens.

NPC / FAC / QUEST / EVENT labels: Name only — NO " :: " hierarchy, NO tag prefix.
Example: [[FAC: Iron Syndicate | ...]]  NOT  [[FAC: Khelt :: Iron Syndicate | ...]]  and  NOT  [[FAC: FAC: Iron Syndicate | ...]]

**FAC [CORE]:** Wrap history, ideology, schemes, and members inside a plain \`[CORE] … [/CORE]\` block in the **Description** field.
**FAC** uses four fields: \`Name | Status | Description | Keywords\`. Put a concise current-state line in **Status** (standing, conflicts, recent changes); put history, ideology, schemes, and members in **Description** (wrapped in \`[CORE] ... [/CORE]\`).`,
        categoryRenderOptions: {},
        combatProfileAutoSwitch: false,
        combatConnectionProfileId: "",
        combatCompletionPresetId: "",
        portraitConnectionSource: "default",
        portraitConnectionProfileId: "",
        portraitCompletionPresetId: "",
        portraitOllamaUrl: "http://localhost:11434",
        portraitOllamaModel: "",
        portraitOpenaiUrl: "",
        portraitOpenaiKey: "",
        portraitOpenaiModel: "",
        portraitPromptWordTarget: 200,
        portraitNpcSystemPrompt: `You are a portrait prompt generator for AI image models. Given an NPC's lorebook description from an RPG campaign, output a single detailed image generation prompt.

Focus on:
- Physical appearance (race, build, facial features, skin color, hair) — draw primarily from the NPC's lorebook entry
- Clothing, armor, equipment visible on the character
- Pose and expression appropriate to the character's personality
- Art style: high-quality fantasy portrait, dramatic lighting, detailed

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- The NPC lorebook entry is your PRIMARY source of truth for this character's appearance.
- Use the narrator card and scene context only for world setting/art style guidance.
- Focus on visual details. Do not include game stats, relationship values, or non-visual information.`,
        portraitCharacterSystemPrompt: `You are a portrait prompt generator for AI image models. Given character context from an RPG game, output a single detailed image generation prompt suitable for an AI image model.

You are provided with the full Lorebook Agent context — all currently active lore entries with their keywords and content — as well as the current game state. Use these to infer accurate visual details about the character, their world, and their situation.

Focus on:
- Physical appearance (race, build, facial features, skin color, hair)
- Clothing, armor, equipment visible on the character
- Pose and expression appropriate to the character's personality
- Art style: high-quality fantasy portrait, dramatic lighting, detailed

Rules:
- Output ONLY the prompt text, nothing else. No preamble, no explanation.
- Keep it under {{wordtarget}} words.
- A user persona is provided for reference. If it does NOT describe the character "{{name}}", ignore it entirely and do not use any of its details in the portrait prompt.
- Focus on visual details. Do not include game stats, abilities, or non-visual information.`,
        portraitLocationSystemPrompt: getDefaultPortraitLocationSystemPrompt(false),
        savedPortraitPromptPresets: {},
        worldConnectionSource: "default",
        worldConnectionProfileId: "",
        worldCompletionPresetId: "",
        worldOllamaUrl: "http://localhost:11434",
        worldOllamaModel: "",
        worldOpenaiUrl: "",
        worldOpenaiKey: "",
        worldOpenaiModel: "",
        gameSystemWizardConnectionSource: "default",
        gameSystemWizardConnectionProfileId: "",
        gameSystemWizardCompletionPresetId: "",
        gameSystemWizardOllamaUrl: "http://localhost:11434",
        gameSystemWizardOllamaModel: "",
        gameSystemWizardOpenaiUrl: "",
        gameSystemWizardOpenaiKey: "",
        gameSystemWizardOpenaiModel: "",
        gameSystemWizardSystemPrompt: "",
        lastResetVersion: "",
        lastSeenPromptDefaultsFingerprint: "",
        /** @type {ReturnType<typeof buildBundledPromptsSnapshot>|null} Last-acked shipped defaults (for upgrade diffs). */
        lastSeenPromptDefaultsSnapshot: null,
        autoResetPromptsOnUpdate: false,
        userPromptSuffix: '## OUTPUT ONLY CHANGED SECTIONS:',
    };
}

/** Latest settings migration version — factory reset skips legacy upgrade paths at or below this. */
export const FACTORY_SETTINGS_VERSION = '5.5.13';

/** Remove extension UI keys from localStorage so a factory reset does not rehydrate stale panel state. */
export function clearExtensionLocalStorageUiState() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('rpg_tracker_')) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
}

/**
 * Replace live extension settings with a pristine factory-default object.
 * @param {Record<string, unknown>} extensionSettings SillyTavern extensionSettings map
 */
export function applyFactoryReset(extensionSettings) {
    const s = JSON.parse(JSON.stringify(buildDefaultSettings()));
    s.settingsVersion = FACTORY_SETTINGS_VERSION;
    s.customPortraits = {};
    s.customLocationImages = {};
    extensionSettings[MODULE_NAME] = s;
}

/** Fast deterministic hash for comparing bundled default prompt content across releases. */
function hashPromptBundle(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) ^ str.charCodeAt(i);
    }
    return (h >>> 0).toString(16);
}

/**
 * Structured snapshot of all factory-shipped prompt defaults.
 * Fingerprint and upgrade-dialog diffs both derive from this object so they cannot drift.
 * @returns {{
 *   sysprompt: { main: string, legacy: string },
 *   tracker: { systemPromptTemplate: string, userPromptSuffix: string, stockPrompts: Record<string, string> },
 *   lorebook: {
 *     routerSystemPromptTemplate: string,
 *     routerModularPromptTemplate: string,
 *     modules: Record<string, { instruction: string, format: string }>
 *   },
 *   world: { worldProgressionSystemPrompt: string, worldProgressionSkeletonSystemPrompt: string }
 * }}
 */
export function buildBundledPromptsSnapshot() {
    const defaults = buildDefaultSettings();
    /** @type {Record<string, { instruction: string, format: string }>} */
    const modules = {};
    for (const [id, def] of Object.entries(DEFAULT_MODULES)) {
        modules[id] = {
            instruction: def.instruction || '',
            format: def.format || '',
        };
    }
    return {
        sysprompt: {
            main: RT_PROMPTS['sysprompt.txt'] || '',
            legacy: RT_PROMPTS['sysprompt_legacy.txt'] || '',
        },
        tracker: {
            systemPromptTemplate: defaults.systemPromptTemplate || '',
            userPromptSuffix: defaults.userPromptSuffix || '',
            stockPrompts: JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS)),
        },
        lorebook: {
            routerSystemPromptTemplate: defaults.routerSystemPromptTemplate || '',
            routerModularPromptTemplate: defaults.routerModularPromptTemplate || '',
            modules,
        },
        world: {
            worldProgressionSystemPrompt: defaults.worldProgressionSystemPrompt || '',
            worldProgressionSkeletonSystemPrompt: defaults.worldProgressionSkeletonSystemPrompt || '',
        },
    };
}

/** Category ids used by the Prompt Defaults Updated dialog. */
export const PROMPT_DEFAULTS_CATEGORIES = /** @type {const} */ ([
    'sysprompt',
    'tracker',
    'lorebook',
    'world',
]);

/** @type {Record<(typeof PROMPT_DEFAULTS_CATEGORIES)[number], string>} */
export const PROMPT_DEFAULTS_CATEGORY_LABELS = {
    sysprompt: 'Main System Prompt',
    tracker: 'State Tracker Prompts',
    lorebook: 'Lorebook Agent Prompts',
    world: 'World Progression Prompts',
};

/**
 * Flatten a snapshot category into labeled text blocks for line-diffing.
 * Sysprompt display prefers the main (dice-tool) prompt; legacy is included under a header.
 * @param {ReturnType<typeof buildBundledPromptsSnapshot>} snap
 * @param {(typeof PROMPT_DEFAULTS_CATEGORIES)[number]} category
 * @returns {{ label: string, text: string }[]}
 */
export function getSnapshotCategoryBlocks(snap, category) {
    if (!snap) return [];
    if (category === 'sysprompt') {
        const blocks = [{ label: 'sysprompt.txt', text: snap.sysprompt?.main || '' }];
        if (snap.sysprompt?.legacy) {
            blocks.push({ label: 'sysprompt_legacy.txt', text: snap.sysprompt.legacy });
        }
        return blocks;
    }
    if (category === 'tracker') {
        const blocks = [
            { label: 'Core State Model', text: snap.tracker?.systemPromptTemplate || '' },
            { label: 'User Prompt Suffix', text: snap.tracker?.userPromptSuffix || '' },
        ];
        const stock = snap.tracker?.stockPrompts || {};
        for (const key of Object.keys(stock).sort()) {
            blocks.push({ label: `Stock: ${key}`, text: stock[key] || '' });
        }
        return blocks;
    }
    if (category === 'lorebook') {
        const blocks = [
            { label: 'Router System Prompt', text: snap.lorebook?.routerSystemPromptTemplate || '' },
            { label: 'Modular Prompt Template', text: snap.lorebook?.routerModularPromptTemplate || '' },
        ];
        const modules = snap.lorebook?.modules || {};
        for (const id of Object.keys(modules).sort()) {
            const m = modules[id] || {};
            blocks.push({ label: `Module ${id} instruction`, text: m.instruction || '' });
            blocks.push({ label: `Module ${id} format`, text: m.format || '' });
        }
        return blocks;
    }
    if (category === 'world') {
        return [
            { label: 'World Progression System', text: snap.world?.worldProgressionSystemPrompt || '' },
            { label: 'Skeleton System Prompt', text: snap.world?.worldProgressionSkeletonSystemPrompt || '' },
        ];
    }
    return [];
}

/**
 * Live user copy for the same category blocks (for impact badges only).
 * @param {Record<string, any>} settings
 * @param {(typeof PROMPT_DEFAULTS_CATEGORIES)[number]} category
 * @param {{ mainSyspromptText?: string }} [opts]
 * @returns {{ label: string, text: string }[]}
 */
export function getLivePromptCategoryBlocks(settings, category, opts = {}) {
    const s = settings || {};
    if (category === 'sysprompt') {
        // Prefer the Quick Prompt Main textarea when provided; customSysprompt means user-owned text.
        const text = opts.mainSyspromptText != null
            ? String(opts.mainSyspromptText)
            : (s.customSysprompt ? '(custom sysprompt — not auto-managed)' : '');
        return [{ label: 'sysprompt.txt', text }];
    }
    if (category === 'tracker') {
        const defaults = buildDefaultSettings();
        const blocks = [
            { label: 'Core State Model', text: s.systemPromptTemplate ?? defaults.systemPromptTemplate ?? '' },
            { label: 'User Prompt Suffix', text: s.userPromptSuffix ?? defaults.userPromptSuffix ?? '' },
        ];
        const stock = s.stockPrompts || {};
        const keys = new Set([...Object.keys(DEFAULT_STOCK_PROMPTS), ...Object.keys(stock)]);
        for (const key of [...keys].sort()) {
            blocks.push({ label: `Stock: ${key}`, text: stock[key] ?? '' });
        }
        return blocks;
    }
    if (category === 'lorebook') {
        const defaults = buildDefaultSettings();
        const blocks = [
            {
                label: 'Router System Prompt',
                text: s.routerSystemPromptTemplate ?? defaults.routerSystemPromptTemplate ?? '',
            },
            {
                label: 'Modular Prompt Template',
                text: s.routerModularPromptTemplate ?? defaults.routerModularPromptTemplate ?? '',
            },
        ];
        const liveMods = s.routerModules || {};
        const ids = new Set([...Object.keys(DEFAULT_MODULES), ...Object.keys(liveMods)]);
        for (const id of [...ids].sort()) {
            const live = liveMods[id] || {};
            const def = DEFAULT_MODULES[id] || {};
            blocks.push({ label: `Module ${id} instruction`, text: live.instruction ?? def.instruction ?? '' });
            blocks.push({ label: `Module ${id} format`, text: live.format ?? def.format ?? '' });
        }
        return blocks;
    }
    if (category === 'world') {
        const defaults = buildDefaultSettings();
        return [
            {
                label: 'World Progression System',
                text: s.worldProgressionSystemPrompt ?? defaults.worldProgressionSystemPrompt ?? '',
            },
            {
                label: 'Skeleton System Prompt',
                text: s.worldProgressionSkeletonSystemPrompt ?? defaults.worldProgressionSkeletonSystemPrompt ?? '',
            },
        ];
    }
    return [];
}

/**
 * @param {{ label: string, text: string }[]} blocks
 * @returns {string}
 */
function joinCategoryBlocks(blocks) {
    return (blocks || []).map((b) => `### ${b.label}\n${b.text ?? ''}`).join('\n\n');
}

/**
 * Impact badge for one category relative to old/new shipped snapshots.
 * @param {ReturnType<typeof buildBundledPromptsSnapshot>|null|undefined} oldSnap
 * @param {ReturnType<typeof buildBundledPromptsSnapshot>} newSnap
 * @param {Record<string, any>} liveSettings
 * @param {(typeof PROMPT_DEFAULTS_CATEGORIES)[number]} category
 * @param {{ mainSyspromptText?: string }} [opts]
 * @returns {'customized'|'matches new'|'matches old'|'unknown'}
 */
export function getPromptCategoryImpactBadge(oldSnap, newSnap, liveSettings, category, opts = {}) {
    if (category === 'sysprompt' && liveSettings?.customSysprompt) {
        return 'customized';
    }
    const liveText = joinCategoryBlocks(getLivePromptCategoryBlocks(liveSettings, category, opts));
    const newText = joinCategoryBlocks(getSnapshotCategoryBlocks(newSnap, category));
    if (liveText === newText) return 'matches new';
    if (oldSnap) {
        const oldText = joinCategoryBlocks(getSnapshotCategoryBlocks(oldSnap, category));
        // For sysprompt, live may only include main (or textarea); compare main-only when possible.
        if (category === 'sysprompt') {
            const liveMain = (opts.mainSyspromptText != null)
                ? String(opts.mainSyspromptText)
                : '';
            if (liveMain && liveMain === (newSnap.sysprompt?.main || '')) return 'matches new';
            if (liveMain && liveMain === (oldSnap.sysprompt?.main || '')) return 'matches old';
            if (liveMain && liveMain === (newSnap.sysprompt?.legacy || '')) return 'matches new';
            if (liveMain && liveMain === (oldSnap.sysprompt?.legacy || '')) return 'matches old';
            if (!liveMain && !liveSettings?.customSysprompt) return 'unknown';
        } else if (liveText === oldText) {
            return 'matches old';
        }
    }
    return 'customized';
}

/**
 * Fingerprint of all factory-shipped prompt defaults. Used to decide whether an
 * extension update warrants the prompt-reset dialog (version bumps alone are not enough).
 * @returns {string}
 */
export function computeBundledPromptsFingerprint() {
    return hashPromptBundle(JSON.stringify(buildBundledPromptsSnapshot()));
}

/**
 * The list of settings fields that make up a Game Cartridge's "payload" —
 * everything that defines how the framework behaves as a game/system, minus
 * connection settings, UI/display prefs, and per-campaign save state
 * (profiles/chatStates/memo). See game-cartridges.js for the save/load/
 * export/import logic that operates on this shape.
 */
const CARTRIDGE_PAYLOAD_KEYS = [
    'customSyspromptLibrary',
    'syspromptSectionOrder',
    'syspromptModules',
    'cyoaConfig',
    'narrativePacing',
    'npcRelationshipBars',
    'rngEnabled',
    'diceFunctionTool',
    'diceD100Mode',
    'rngToolD20',
    'rngToolD100',
    'rngQueueD20',
    'rngQueueD100',
    'use24hTime',
    'useDdMmYyFormat',
    'gameSystems',
    'customFields',
    'blockOrder',
    'modules',
    'stockPrompts',
    'systemPromptTemplate',
    'portraitNpcSystemPrompt',
    'portraitCharacterSystemPrompt',
    'portraitLocationSystemPrompt',
    'portraitPromptWordTarget',
    'savedPortraitPromptPresets',
    'npcCoreSections',
    'pcCoreSections',
    'npcSectionPresets',
    'pcSectionPresets',
    // ── Lorebook Agent (Researcher/Router) ────────────────────────────────
    'routerSystemPromptTemplate',
    'routerModularPromptTemplate',
    'routerModules',
    'routerCustomTags',
    // ── World Progression ──────────────────────────────────────────────────────
    'worldProgressionSystemPrompt',
];

/**
 * Returns a fresh deep clone of the factory-default value for every
 * Game-Cartridge payload field. Used both to build the virtual "Stock"
 * cartridge and to backfill any field missing from an older/partial
 * imported cartridge.
 * @returns {object}
 */
export function getFactoryCartridgePayload() {
    const defaults = buildDefaultSettings();
    const payload = {};
    for (const key of CARTRIDGE_PAYLOAD_KEYS) {
        payload[key] = JSON.parse(JSON.stringify(defaults[key]));
    }
    return payload;
}

/**
 * Logical groups of cartridge payload keys used by the selective load dialog
 * (game-cartridges.js). Each group has a human-readable label, a short
 * description, and the list of payload keys that belong to it. The order here
 * determines the display order in the dialog.
 */
export const CARTRIDGE_PAYLOAD_GROUPS = [
    {
        id: 'stateTracker',
        label: 'State Tracker',
        description: 'Extractor prompt, module toggles, block order, stock prompts, RNG & time-format flags',
        keys: [
            'systemPromptTemplate', 'modules', 'blockOrder', 'stockPrompts',
            'syspromptModules', 'narrativePacing', 'syspromptSectionOrder', 'customSyspromptLibrary',
            'rngEnabled', 'diceFunctionTool', 'diceD100Mode',
            'rngToolD20', 'rngToolD100', 'rngQueueD20', 'rngQueueD100',
            'use24hTime', 'useDdMmYyFormat',
        ],
    },
    {
        id: 'cyoa',
        label: 'CYOA Mode',
        description: 'Choice-slot setup, custom prompt, button appearance, and saved CYOA presets',
        keys: ['cyoaConfig'],
    },
    {
        id: 'gameSystems',
        label: 'Game Systems & Customization & Custom Fields',
        description: 'Custom game systems and custom tracker fields',
        keys: ['gameSystems', 'customFields'],
    },
    {
        id: 'characterSheets',
        label: 'Character Sheets',
        description: 'NPC/PC core sections, section presets, relationship bar toggle',
        keys: ['npcCoreSections', 'pcCoreSections', 'npcSectionPresets', 'pcSectionPresets', 'npcRelationshipBars'],
    },
    {
        id: 'portraits',
        label: 'Portrait Generator',
        description: 'NPC and character portrait prompt templates, word target, saved presets',
        keys: [
            'portraitNpcSystemPrompt', 'portraitCharacterSystemPrompt', 'portraitLocationSystemPrompt',
            'portraitPromptWordTarget', 'savedPortraitPromptPresets',
        ],
    },
    {
        id: 'lorebookAgent',
        label: 'Lorebook Agent',
        description: 'Researcher agent system prompt, modular format prompt, module definitions, custom tags',
        keys: ['routerSystemPromptTemplate', 'routerModularPromptTemplate', 'routerModules', 'routerCustomTags'],
    },
    {
        id: 'worldProgression',
        label: 'World Progression',
        description: 'Report Generation Prompt used by the World Progression Engine',
        keys: ['worldProgressionSystemPrompt'],
    },
];

// compareVersions / isOlderThan — imported (and re-exported) from src/state/versions.js

// Re-entrancy guard: some migration blocks below call buildNpcInstruction()/
// buildLocInstruction()/buildFacInstruction(), which themselves call
// getSettings() to read a couple of flags (useDdMmYyFormat, npcRelationshipBars).
// Without this guard, a fresh install (no settingsVersion yet) re-enters
// getSettings() from inside itself before settingsVersion has been bumped,
// re-running the same migration block over and over → infinite recursion /
// stack overflow that hangs the page on load. See CHANGELOG for details.
let _gettingSettings = false;

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

    // ── MIGRATION: Block RELATIONSHIPS section in State Tracker core prompt ───────
    if (s.systemPromptTemplate) {
        if (s.systemPromptTemplate.includes('Never track relationships or reputation')) {
            s.systemPromptTemplate = s.systemPromptTemplate.replace(
                'NO RELATIONSHIPS: Never track relationships or reputation, and never create a relationship or reputation section (e.g., [RELATIONSHIPS] or [REPUTATION]). NPC relationships are handled by a separate, dedicated system.',
                'NO RELATIONSHIPS: Never track relationships, and never create a relationship section (e.g., [RELATIONSHIPS]). NPC relationships are handled by a separate, dedicated system.'
            );
        }
        if (!s.systemPromptTemplate.includes('NO RELATIONSHIPS')) {
            if (s.systemPromptTemplate.includes('DELETION: To REMOVE a section entirely, you MUST output: `[TAG]REMOVED[/TAG]`.')) {
                s.systemPromptTemplate = s.systemPromptTemplate.replace(
                    'DELETION: To REMOVE a section entirely, you MUST output: `[TAG]REMOVED[/TAG]`.',
                    'DELETION: To REMOVE a section entirely, you MUST output: `[TAG]REMOVED[/TAG]`.\nNO RELATIONSHIPS: Never track relationships, and never create a relationship section (e.g., [RELATIONSHIPS]). NPC relationships are handled by a separate, dedicated system.'
                );
            } else if (s.systemPromptTemplate.includes('DELETION: To REMOVE a section entirely, you MUST output: \\`[TAG]REMOVED[/TAG]\\`.')) {
                s.systemPromptTemplate = s.systemPromptTemplate.replace(
                    'DELETION: To REMOVE a section entirely, you MUST output: \\`[TAG]REMOVED[/TAG]\\`.',
                    'DELETION: To REMOVE a section entirely, you MUST output: \\`[TAG]REMOVED[/TAG]\\`.\nNO RELATIONSHIPS: Never track relationships, and never create a relationship section (e.g., [RELATIONSHIPS]). NPC relationships are handled by a separate, dedicated system.'
                );
            }
        }
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
 * @param {string} chatId
 * @returns {string}
 */
export function getEffectiveRouterCampaignPrefix(chatId) {
    const s = getSettings();
    const ov = (s.routerCampaignPrefixOverride || '').trim();
    if (ov) return sanitizeCampaignPrefixString(ov);
    return sanitizeCampaignPrefixString(chatId || '');
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

// ── Chat-linked state persistence ─────────────────────────────────────────────

/** Active chat id — prefer tracker-tracked id over raw ST context. */
export function getActiveChatId() {
    const ctx = SillyTavern.getContext();
    const tracked = typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : null;
    return tracked || ctx.getCurrentChatId?.() || ctx.chatId || null;
}

/**
 * When Chat Link is on, restore the WP timer label from chatStates if the live
 * field was cleared (e.g. after debounced settings reload) but the partition still has it.
 * @returns {boolean} true if a label was hydrated
 */
export function hydrateWorldProgressionFromChatState() {
    const s = getSettings();
    if (!s.chatLinkEnabled) return false;
    const chatId = getActiveChatId();
    if (!chatId) return false;
    const stored = s.chatStates?.[chatId];
    if (!stored?.worldProgressionLastFiredPeriodLabel) return false;
    if (s.worldProgressionLastFiredPeriodLabel) return false;
    s.worldProgressionLastFiredPeriodLabel = stored.worldProgressionLastFiredPeriodLabel;
    return true;
}

/** Persist the WP timer to the active chat partition or global settings. */
export function persistWorldProgressionTimer() {
    const s = getSettings();
    const chatId = getActiveChatId();
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    } else {
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/** Persist the Lorebook Agent "since last run" chat-length watermark. */
export function persistRouterLastRunWatermark(length) {
    const s = getSettings();
    s.routerLastRunChatLength = length;
    const chatId = getActiveChatId();
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    } else {
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/** Persist the Lorebook Agent "last ran at" timestamp (display only — separate from the indexing watermark). */
export function persistRouterLastRunTimestamp(epochMs = Date.now()) {
    const s = getSettings();
    s.routerLastRunAt = epochMs;
    const chatId = getActiveChatId();
    if (s.chatLinkEnabled && chatId) {
        saveChatState(chatId);
    } else {
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/**
 * Sync localStorage write-ahead log for module schema (customFields / blockOrder / modules).
 * Survives F5 when the async /api/settings/save fetch is cancelled mid-reload (common when
 * editing extension code then refreshing before ST's save completes).
 */
const MODULE_SCHEMA_BACKUP_KEY = 'rpg_tracker_module_schema_backup';
/** Sync tombstones for deleted custom module tags — survives cancelled settings saves even when WAL is missing. */
const DELETED_CUSTOM_TAGS_KEY = 'rpg_tracker_deleted_custom_tags';

/**
 * @returns {string[]}
 */
function readDeletedCustomTagTombstones() {
    try {
        const raw = localStorage.getItem(DELETED_CUSTOM_TAGS_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.map(t => String(t).toUpperCase()).filter(Boolean) : [];
    } catch {
        return [];
    }
}

/**
 * @param {string[]} tags
 */
function writeDeletedCustomTagTombstones(tags) {
    try {
        const uniq = [...new Set((tags || []).map(t => String(t).toUpperCase()).filter(Boolean))];
        if (uniq.length === 0) localStorage.removeItem(DELETED_CUSTOM_TAGS_KEY);
        else localStorage.setItem(DELETED_CUSTOM_TAGS_KEY, JSON.stringify(uniq));
    } catch (err) {
        console.warn('[RPG Tracker] Deleted-custom-tag tombstone write failed:', err);
    }
}

/**
 * Record custom module tags as intentionally deleted (sync localStorage).
 * @param {string|string[]} tags
 */
export function recordDeletedCustomTags(tags) {
    const add = (Array.isArray(tags) ? tags : [tags]).map(t => String(t || '').toUpperCase()).filter(Boolean);
    if (!add.length) return;
    const merged = new Set([...readDeletedCustomTagTombstones(), ...add]);
    writeDeletedCustomTagTombstones([...merged]);
}

/**
 * Clear tombstones when the user intentionally re-adds a custom tag.
 * @param {string|string[]} tags
 */
export function clearDeletedCustomTagTombstones(tags) {
    const remove = new Set((Array.isArray(tags) ? tags : [tags]).map(t => String(t || '').toUpperCase()).filter(Boolean));
    if (!remove.size) return;
    writeDeletedCustomTagTombstones(readDeletedCustomTagTombstones().filter(t => !remove.has(t)));
}

/**
 * Strip tombstoned custom modules from live settings and all chatStates partitions.
 * Call on boot before loadChatState.
 * @returns {boolean} true if anything was removed
 */
export function applyDeletedCustomTagTombstones() {
    const banned = new Set(readDeletedCustomTagTombstones());
    if (!banned.size) return false;
    const s = getSettings();
    let changed = false;

    const stripFields = (fields) => {
        if (!Array.isArray(fields)) return fields;
        const next = fields.filter(f => !banned.has(String(f?.tag || '').toUpperCase()));
        if (next.length !== fields.length) changed = true;
        return next;
    };
    const stripOrder = (order) => {
        if (!Array.isArray(order)) return order;
        const next = order.filter(t => !banned.has(String(t || '').toUpperCase()));
        if (next.length !== order.length) changed = true;
        return next;
    };

    s.customFields = stripFields(s.customFields || []);
    s.blockOrder = stripOrder(s.blockOrder || []);

    if (s.chatStates && typeof s.chatStates === 'object') {
        for (const chatId of Object.keys(s.chatStates)) {
            const part = s.chatStates[chatId];
            if (!part || typeof part !== 'object') continue;
            if (part.customFields) part.customFields = stripFields(part.customFields);
            if (part.blockOrder) part.blockOrder = stripOrder(part.blockOrder);
        }
    }

    return changed;
}

/**
 * @param {string|null|undefined} chatId
 */
export function writeModuleSchemaBackup(chatId) {
    try {
        const s = getSettings();
        const payload = {
            ts: Date.now(),
            chatId: chatId || null,
            customFields: JSON.parse(JSON.stringify(s.customFields || [])),
            blockOrder: JSON.parse(JSON.stringify(s.blockOrder || BLOCK_ORDER)),
            modules: JSON.parse(JSON.stringify(s.modules || {})),
            // Same race as customFields/blockOrder: a reload (code edit, extension
            // update, plain F5) fired before the debounced disk write landed reverts
            // these to whatever was last actually on disk. Mirror them too so edited
            // stock prompts / narrator toggles self-heal on the next boot.
            stockPrompts: JSON.parse(JSON.stringify(s.stockPrompts || {})),
            syspromptModules: JSON.parse(JSON.stringify(s.syspromptModules || {})),
            narrativePacing: s.narrativePacing || 'normal',
            cyoaConfig: JSON.parse(JSON.stringify(s.cyoaConfig || {})),
        };
        localStorage.setItem(MODULE_SCHEMA_BACKUP_KEY, JSON.stringify(payload));
    } catch (err) {
        console.warn('[RPG Tracker] Module schema backup write failed:', err);
    }
}

/**
 * Returns a local configuration backup only when it differs from disk-loaded settings.
 * The caller must ask the user before applying it.
 * @returns {object|null}
 */
export function getPendingModuleSchemaBackup() {
    try {
        const raw = localStorage.getItem(MODULE_SCHEMA_BACKUP_KEY);
        if (!raw) return null;
        const backup = JSON.parse(raw);
        if (!backup || !Array.isArray(backup.customFields) || !Array.isArray(backup.blockOrder)) return null;

        const s = getSettings();
        const liveTags = JSON.stringify((s.customFields || []).map(f => f.tag));
        const backupTags = JSON.stringify(backup.customFields.map(f => f.tag));
        const liveOrder = JSON.stringify(s.blockOrder || []);
        const backupOrder = JSON.stringify(backup.blockOrder);
        const partition = backup.chatId ? s.chatStates?.[backup.chatId] : null;
        const partTags = JSON.stringify((partition?.customFields || []).map(f => f.tag));
        const liveStockPrompts = JSON.stringify(s.stockPrompts || {});
        const backupStockPrompts = JSON.stringify(backup.stockPrompts || {});
        const liveSyspromptModules = JSON.stringify(s.syspromptModules || {});
        const backupSyspromptModules = JSON.stringify(backup.syspromptModules || {});
        const liveNarrativePacing = s.narrativePacing || 'normal';
        const backupNarrativePacing = backup.narrativePacing || 'normal';
        const liveCyoaConfig = JSON.stringify(s.cyoaConfig || {});
        const backupCyoaConfig = JSON.stringify(backup.cyoaConfig || {});
        const alreadyMatched = liveTags === backupTags && liveOrder === backupOrder
            && (!backup.chatId || partTags === backupTags)
            && (!backup.stockPrompts || liveStockPrompts === backupStockPrompts)
            && (!backup.syspromptModules || liveSyspromptModules === backupSyspromptModules)
            && liveNarrativePacing === backupNarrativePacing
            && (!backup.cyoaConfig || liveCyoaConfig === backupCyoaConfig);
        return alreadyMatched ? null : backup;
    } catch (err) {
        console.warn('[RPG Tracker] Module schema backup inspection failed:', err);
        return null;
    }
}

/**
 * Apply a previously inspected local configuration backup only after the user
 * explicitly approves restoring it over disk-loaded settings.
 * @param {string|null|undefined} preferredChatId
 * @param {object|null} backupOverride
 * @returns {boolean} true if a backup was applied
 */
export function applyModuleSchemaBackup(preferredChatId, backupOverride = null) {
    try {
        const backup = backupOverride || getPendingModuleSchemaBackup();
        if (!backup) return false;

        const s = getSettings();
        const backupNarrativePacing = backup.narrativePacing || 'normal';

        // Always restore live schema from the last known-good in-memory snapshot.
        // If the async disk write completed, this matches disk. If it was cancelled on
        // F5, this heals the resurrection of deleted modules from a stale settings.js.
        s.customFields = JSON.parse(JSON.stringify(backup.customFields));
        s.blockOrder = JSON.parse(JSON.stringify(backup.blockOrder));
        if (backup.modules && typeof backup.modules === 'object') {
            s.modules = { ...s.modules, ...JSON.parse(JSON.stringify(backup.modules)) };
        }
        if (backup.stockPrompts && typeof backup.stockPrompts === 'object') {
            s.stockPrompts = { ...s.stockPrompts, ...JSON.parse(JSON.stringify(backup.stockPrompts)) };
        }
        if (backup.syspromptModules && typeof backup.syspromptModules === 'object') {
            s.syspromptModules = { ...s.syspromptModules, ...JSON.parse(JSON.stringify(backup.syspromptModules)) };
        }
        s.narrativePacing = backupNarrativePacing;
        if (backup.cyoaConfig && typeof backup.cyoaConfig === 'object') {
            s.cyoaConfig = JSON.parse(JSON.stringify(backup.cyoaConfig));
        }

        if (backup.chatId) {
            if (!s.chatStates) s.chatStates = {};
            const existing = s.chatStates[backup.chatId] || {};
            s.chatStates[backup.chatId] = {
                ...existing,
                customFields: JSON.parse(JSON.stringify(backup.customFields)),
                blockOrder: JSON.parse(JSON.stringify(backup.blockOrder)),
                modules: backup.modules
                    ? { ...(existing.modules || {}), ...JSON.parse(JSON.stringify(backup.modules)) }
                    : existing.modules,
            };
        }

        // preferredChatId is reserved for callers that only want to heal the active chat;
        // we still repair backup.chatId's partition above so loadChatState sees good data.
        void preferredChatId;

        return true;
    } catch (err) {
        console.warn('[RPG Tracker] Module schema backup apply failed:', err);
        return false;
    }
}

/**
 * Snapshots the current live settings into chatStates[chatId].
 * Pure write — no shared mutable state, no DOM.
 * @param {string} chatId
 * @param {{ skipDiskWrite?: boolean }} [opts]
 */
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
    // Appearance is global — never chat-linked (defensive; not historically snapshotted)
    'panelBgImage',
    'panelBgImageNight',
    'panelBgOverlayStrength',
    'agentPanelBgImage',
    'agentPanelBgImageNight',
    'agentPanelBgOverlayStrength',
    'dayNightCycleEnabled',
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

export function saveChatState(chatId, opts = {}) {
    if (!chatId) return;
    if (typeof globalThis._rpgPortraitMigrationLocked === 'function' && globalThis._rpgPortraitMigrationLocked()) {
        return;
    }
    // Flush pending raw-textarea edits into settings.currentMemo before snapshotting.
    // The flush must NOT call saveChatState/saveSettings (re-entrancy).
    if (typeof globalThis._rpgFlushRawMemoChanges === 'function') {
        globalThis._rpgFlushRawMemoChanges();
    }
    const s = getSettings();
    if (!s.chatStates) s.chatStates = {};
    // This stamp belongs to the specific chat snapshot. The top-level timestamp is
    // shared by every chat, so it cannot safely decide whether this chat's disk memo
    // is newer than a browser-local recovery snapshot.
    const memoPersistedAt = Date.now();
    s.memoPersistedAt = memoPersistedAt;
    // Preserve fields that are written outside the normal save cycle (e.g. campaignBooks)
    const existing = s.chatStates[chatId] || {};
    s.chatStates[chatId] = {
        currentMemo:  s.currentMemo,
        memoPersistedAt,
        memoHistory:  JSON.parse(JSON.stringify(s.memoHistory)),
        lastDelta:    s.lastDelta || '',
        customPortraits: JSON.parse(JSON.stringify(s.customPortraits || {})),
        customLocationImages: JSON.parse(JSON.stringify(s.customLocationImages || {})),
        modules:      JSON.parse(JSON.stringify(s.modules)),
        blockOrder:   JSON.parse(JSON.stringify(s.blockOrder  || BLOCK_ORDER)),
        stockPrompts: snapshotStockPromptsForProfile(s.stockPrompts),
        customFields: JSON.parse(JSON.stringify(s.customFields || [])),
        quests:       JSON.parse(JSON.stringify(s.quests || [])), // persist full array (incl. completed) for cross-session UI display
        historyIndex: s.historyIndex ?? -1,
        activeRouterKeys: JSON.parse(JSON.stringify(s.activeRouterKeys || [])),
        activeWorldKeys:  JSON.parse(JSON.stringify(s.activeWorldKeys || [])),
        keywordActivatedKeys: JSON.parse(JSON.stringify(s.keywordActivatedKeys || [])),
        routerLog:    JSON.parse(JSON.stringify(s.routerLog || [])),
        routerCampaignPrefix: s.routerCampaignPrefix || '',
        routerLookback: s.routerLookback || 4,
        routerLastRunChatLength: s.routerLastRunChatLength ?? 0,
        routerLastRunAt: s.routerLastRunAt ?? 0,
        routerDirectPrompt: s.routerDirectPrompt || '',
        routerDirectLookback: s.routerDirectLookback || 10,
        routerDefaultPosition: s.routerDefaultPosition ?? 4,
        routerDefaultDepth: s.routerDefaultDepth ?? 4,
        routerDefaultOrder: s.routerDefaultOrder ?? 100,
        routerDefaultRole: s.routerDefaultRole ?? 0,
        loreInjectionPosition: s.loreInjectionPosition ?? 4,
        loreInjectionDepth: s.loreInjectionDepth ?? 4,
        loreInjectionRole: s.loreInjectionRole ?? 0,
        worldProgressionLookback: s.worldProgressionLookback ?? 20,
        worldProgressionHistoryLookback: s.worldProgressionHistoryLookback ?? 0,
        worldProgressionInjectionPosition: s.worldProgressionInjectionPosition ?? 4,
        worldProgressionInjectionDepth: s.worldProgressionInjectionDepth ?? 3,
        worldProgressionInjectionRole: s.worldProgressionInjectionRole ?? 0,
        worldProgressionRandomizeNPCs: s.worldProgressionRandomizeNPCs ?? false,
        worldProgressionRandomSkeletonNPCCount: s.worldProgressionRandomSkeletonNPCCount ?? 2,
        worldProgressionRandomNarrativeNPCCount: s.worldProgressionRandomNarrativeNPCCount ?? 3,
        worldProgressionRandomizeLocations: s.worldProgressionRandomizeLocations ?? false,
        worldProgressionRandomSkeletonLocationCount: s.worldProgressionRandomSkeletonLocationCount ?? 2,
        worldProgressionRandomNarrativeLocationCount: s.worldProgressionRandomNarrativeLocationCount ?? 2,
        worldProgressionRandomizeFactions: s.worldProgressionRandomizeFactions ?? false,
        worldProgressionRandomSkeletonFactionCount: s.worldProgressionRandomSkeletonFactionCount ?? 2,
        worldProgressionRandomNarrativeFactionCount: s.worldProgressionRandomNarrativeFactionCount ?? 2,
        worldProgressionRandomizeConflicts: s.worldProgressionRandomizeConflicts ?? false,
        worldProgressionRandomConflictCount: s.worldProgressionRandomConflictCount ?? 3,
        worldProgressionSkeletonFactions: s.worldProgressionSkeletonFactions ?? 4,
        worldProgressionSkeletonLocations: s.worldProgressionSkeletonLocations ?? 4,
        worldProgressionSkeletonNPCs: s.worldProgressionSkeletonNPCs ?? 0,
        worldProgressionSkeletonConflicts: s.worldProgressionSkeletonConflicts ?? 3,
        // World Progression per-chat time tracking
        worldProgressionLastFiredAtMinutes: s.worldProgressionLastFiredAtMinutes ?? -1,
        worldProgressionLastFiredPeriodLabel: s.worldProgressionLastFiredPeriodLabel || '',
        worldProgressionSkeletonAtmosphereSummary: s.worldProgressionSkeletonAtmosphereSummary || '',
        worldProgressionSkeletonAtmosphereLookback: s.worldProgressionSkeletonAtmosphereLookback ?? 30,
        worldProgressionSkeletonUseExisting: s.worldProgressionSkeletonUseExisting ?? true,
        worldProgressionConsolidateEnabled: s.worldProgressionConsolidateEnabled ?? false,
        worldProgressionConsolidateInterval: s.worldProgressionConsolidateInterval ?? 7,
        worldProgressionExclusionList: s.worldProgressionExclusionList || '',

        // Per-chat time/date formatting (24h clock, DD/MM/YYYY vs Day N, initial anchor)
        use24hTime: !!s.use24hTime,
        useDdMmYyFormat: !!s.useDdMmYyFormat,
        initialDate: s.initialDate || 'Day 1',
        npcRelationshipMax: getNpcRelationshipMax(s),

        // Preserve lorebook stack link — written by Link button and router, not by normal state saves
        campaignBooks: existing.campaignBooks || [],

        // Real-Time Mode: last scene location we generated art for (survives F5)
        lastImmersionSceneArtPath: existing.lastImmersionSceneArtPath || null,
        // Chat length at last Real-Time scene-art generation (for every-N-outputs mode)
        lastImmersionSceneArtChatLen: existing.lastImmersionSceneArtChatLen ?? null,

        // Preserve Player Character pseudo-persona which is injected into the chat state
        playerCharacter: existing.playerCharacter,
    };

    // Sync WAL before the async disk write — survives F5 if /api/settings/save is cancelled.
    writeModuleSchemaBackup(chatId);
    // Drop any legacy global-UI keys copied into older partitions.
    stripChatStateGlobalUiPrefs(s);
    
    // Use a synchronous save so data is not lost if the page is closed before
    // a debounced timer fires (the root cause of the PC/state/relationship loss bug).
    // saveChatState is always called with an explicit chatId so there is no
    // cross-chat leakage risk from this call itself.
    // When called from our saveSettings(), skipDiskWrite avoids a duplicate in-flight save.
    if (opts.skipDiskWrite) return;
    const ctx = SillyTavern.getContext();
    if (typeof ctx.saveSettings === 'function') {
        ctx.saveSettings();
    } else if (typeof ctx.saveSettingsDebounced === 'function') {
        ctx.saveSettingsDebounced();
    }
}

// ── Profile I/O ───────────────────────────────────────────────────────────────

/**
 * Deep-clones stock module prompts for profile/chat persistence, merging the
 * live overrides on top of DEFAULT_STOCK_PROMPTS so every variant key
 * (time_24h, time_ddmmyy, etc.) is captured even if only a subset was edited.
 * @param {Record<string, string>|null|undefined} stockPrompts
 * @returns {Record<string, string>}
 */
export function snapshotStockPromptsForProfile(stockPrompts) {
    return {
        ...JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS)),
        ...JSON.parse(JSON.stringify(stockPrompts || {})),
    };
}

/**
 * Restores stock module prompts from a profile snapshot, filling any keys
 * missing in older profiles from current defaults.
 * @param {Record<string, string>|null|undefined} profileStockPrompts
 * @returns {Record<string, string>}
 */
export function loadStockPromptsFromProfile(profileStockPrompts) {
    if (!profileStockPrompts) {
        return JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS));
    }
    return {
        ...JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS)),
        ...JSON.parse(JSON.stringify(profileStockPrompts)),
    };
}

/**
 * Saves the current tracker state into a named profile slot.
 * @param {string} name
 */
export function saveProfile(name) {
    const s = getSettings();
    if (!name) return;
    if (!s.profiles) s.profiles = {};
    s.profiles[name] = {
        currentMemo: s.currentMemo,
        memoHistory: JSON.parse(JSON.stringify(s.memoHistory)),
        modules: JSON.parse(JSON.stringify(s.modules)),
        blockOrder: JSON.parse(JSON.stringify(s.blockOrder || BLOCK_ORDER)),
        stockPrompts: snapshotStockPromptsForProfile(s.stockPrompts),
        modulePageSizes: JSON.parse(JSON.stringify(s.modulePageSizes || {})),
        customFields: JSON.parse(JSON.stringify(s.customFields || [])),
        // quests are derived from currentMemo on load — not persisted separately
        lastDelta: s.lastDelta || '',
        historyIndex: s.historyIndex ?? -1,
        activeRouterKeys: JSON.parse(JSON.stringify(s.activeRouterKeys || [])),
        activeWorldKeys:  JSON.parse(JSON.stringify(s.activeWorldKeys || [])),
        routerLog:    JSON.parse(JSON.stringify(s.routerLog || [])),
        routerCampaignPrefix: s.routerCampaignPrefix || '',
        routerLookback: s.routerLookback || 4,
        routerLastRunChatLength: s.routerLastRunChatLength ?? 0,
        routerLastRunAt: s.routerLastRunAt ?? 0,
        routerDirectPrompt: s.routerDirectPrompt || '',
        routerDefaultPosition: s.routerDefaultPosition ?? 4,
        routerDefaultDepth: s.routerDefaultDepth ?? 4,
        routerDefaultOrder: s.routerDefaultOrder ?? 100,
        routerDefaultRole: s.routerDefaultRole ?? 0,
        loreInjectionPosition: s.loreInjectionPosition ?? 4,
        loreInjectionDepth: s.loreInjectionDepth ?? 4,
        loreInjectionRole: s.loreInjectionRole ?? 0,
        worldProgressionLookback: s.worldProgressionLookback ?? 20,
        worldProgressionHistoryLookback: s.worldProgressionHistoryLookback ?? 0,
        worldProgressionInjectionPosition: s.worldProgressionInjectionPosition ?? 4,
        worldProgressionInjectionDepth: s.worldProgressionInjectionDepth ?? 3,
        worldProgressionInjectionRole: s.worldProgressionInjectionRole ?? 0,
        worldProgressionRandomizeNPCs: s.worldProgressionRandomizeNPCs ?? false,
        worldProgressionRandomSkeletonNPCCount: s.worldProgressionRandomSkeletonNPCCount ?? 2,
        worldProgressionRandomNarrativeNPCCount: s.worldProgressionRandomNarrativeNPCCount ?? 3,
        worldProgressionRandomizeLocations: s.worldProgressionRandomizeLocations ?? false,
        worldProgressionRandomSkeletonLocationCount: s.worldProgressionRandomSkeletonLocationCount ?? 2,
        worldProgressionRandomNarrativeLocationCount: s.worldProgressionRandomNarrativeLocationCount ?? 2,
        worldProgressionRandomizeFactions: s.worldProgressionRandomizeFactions ?? false,
        worldProgressionRandomSkeletonFactionCount: s.worldProgressionRandomSkeletonFactionCount ?? 2,
        worldProgressionRandomNarrativeFactionCount: s.worldProgressionRandomNarrativeFactionCount ?? 2,
        worldProgressionRandomizeConflicts: s.worldProgressionRandomizeConflicts ?? false,
        worldProgressionRandomConflictCount: s.worldProgressionRandomConflictCount ?? 3,
        worldProgressionSkeletonFactions: s.worldProgressionSkeletonFactions ?? 4,
        worldProgressionSkeletonLocations: s.worldProgressionSkeletonLocations ?? 4,
        worldProgressionSkeletonNPCs: s.worldProgressionSkeletonNPCs ?? 0,
        worldProgressionSkeletonConflicts: s.worldProgressionSkeletonConflicts ?? 3,
        worldProgressionLastFiredAtMinutes: s.worldProgressionLastFiredAtMinutes ?? -1,
        worldProgressionLastFiredPeriodLabel: s.worldProgressionLastFiredPeriodLabel || '',
        worldProgressionConsolidateEnabled: s.worldProgressionConsolidateEnabled ?? false,
        worldProgressionConsolidateInterval: s.worldProgressionConsolidateInterval ?? 7,
        worldProgressionSkeletonAtmosphereSummary: s.worldProgressionSkeletonAtmosphereSummary || '',
        worldProgressionSkeletonAtmosphereLookback: s.worldProgressionSkeletonAtmosphereLookback ?? 30,
        worldProgressionSkeletonUseExisting: s.worldProgressionSkeletonUseExisting ?? true,
        worldProgressionExclusionList: s.worldProgressionExclusionList || '',

        portraitGeneratorSource: s.portraitGeneratorSource ?? "native",
        portraitSkipPromptDialog: s.portraitSkipPromptDialog ?? false,
        hideImageGenToasts: s.hideImageGenToasts ?? false,
        portraitAutoGenerateParty: s.portraitAutoGenerateParty ?? false,
        portraitAutoGeneratePlayer: s.portraitAutoGeneratePlayer ?? false,
        portraitAutoGenerateEnemies: s.portraitAutoGenerateEnemies ?? false,
        portraitAutoGenerateNpcs: s.portraitAutoGenerateNpcs ?? false,
        portraitAutoGenerateLocations: s.portraitAutoGenerateLocations ?? false,
        portraitAutoGenerateSceneView: s.portraitAutoGenerateSceneView ?? false,
        portraitRealtimeTriggerMode: s.portraitRealtimeTriggerMode || 'location_change',
        portraitRealtimeEveryNOutputs: Math.max(1, Number(s.portraitRealtimeEveryNOutputs) || 1),
        portraitRegenerateVisitedLocations: s.portraitRegenerateVisitedLocations ?? false,
        locationImages: !!s.locationImages,
        portraitConnectionSource: s.portraitConnectionSource ?? "default",
        portraitConnectionProfileId: s.portraitConnectionProfileId || "",
        portraitCompletionPresetId: s.portraitCompletionPresetId || "",
        portraitOllamaUrl: s.portraitOllamaUrl || "http://localhost:11434",
        portraitOllamaModel: s.portraitOllamaModel || "",
        portraitOpenaiUrl: s.portraitOpenaiUrl || "",
        portraitOpenaiKey: s.portraitOpenaiKey || "",
        portraitOpenaiModel: s.portraitOpenaiModel || "",
        worldConnectionSource: s.worldConnectionSource ?? "default",
        worldConnectionProfileId: s.worldConnectionProfileId || "",
        worldCompletionPresetId: s.worldCompletionPresetId || "",
        worldOllamaUrl: s.worldOllamaUrl || "http://localhost:11434",
        worldOllamaModel: s.worldOllamaModel || "",
        worldOpenaiUrl: s.worldOpenaiUrl || "",
        worldOpenaiKey: s.worldOpenaiKey || "",
        worldOpenaiModel: s.worldOpenaiModel || "",
        gameSystemWizardConnectionSource: s.gameSystemWizardConnectionSource ?? "default",
        gameSystemWizardConnectionProfileId: s.gameSystemWizardConnectionProfileId || "",
        gameSystemWizardCompletionPresetId: s.gameSystemWizardCompletionPresetId || "",
        gameSystemWizardOllamaUrl: s.gameSystemWizardOllamaUrl || "http://localhost:11434",
        gameSystemWizardOllamaModel: s.gameSystemWizardOllamaModel || "",
        gameSystemWizardOpenaiUrl: s.gameSystemWizardOpenaiUrl || "",
        gameSystemWizardOpenaiKey: s.gameSystemWizardOpenaiKey || "",
        gameSystemWizardOpenaiModel: s.gameSystemWizardOpenaiModel || "",
        gameSystemWizardSystemPrompt: s.gameSystemWizardSystemPrompt || "",
    };
    s.activeProfile = name;
    SillyTavern.getContext().saveSettingsDebounced();
}

/**
 * Deletes a named profile slot.
 * @param {string} name
 */
export function deleteProfile(name) {
    const s = getSettings();
    if (!s.profiles?.[name]) return;
    delete s.profiles[name];
    if (s.activeProfile === name) s.activeProfile = '';
    SillyTavern.getContext().saveSettingsDebounced();
}

/**
 * Safely sanitizes router state arrays to prevent crashes from dirty/malformed data.
 * @param {Record<string, any>} s - The settings object to sanitize.
 */
export function sanitizeRouterState(s) {
    if (!s) return;
    const isGoodId = (id) => typeof id === 'string' && id.includes('::');

    if (Array.isArray(s.activeRouterKeys)) {
        s.activeRouterKeys = s.activeRouterKeys.filter(isGoodId);
    } else {
        s.activeRouterKeys = [];
    }

    if (Array.isArray(s.activeWorldKeys)) {
        s.activeWorldKeys = s.activeWorldKeys.filter(isGoodId);
    } else {
        s.activeWorldKeys = [];
    }

    if (Array.isArray(s.keywordActivatedKeys)) {
        s.keywordActivatedKeys = s.keywordActivatedKeys.filter(isGoodId);
    } else {
        s.keywordActivatedKeys = [];
    }

    if (Array.isArray(s.routerLog)) {
        s.routerLog = s.routerLog.filter(log => {
            if (!log || typeof log !== 'object') return false;

            if (Array.isArray(log.record)) {
                log.record = log.record.filter(isGoodId);
            } else {
                log.record = [];
            }

            if (Array.isArray(log.activate)) {
                log.activate = log.activate.filter(isGoodId);
            } else {
                log.activate = [];
            }

            if (Array.isArray(log.deactivate)) {
                log.deactivate = log.deactivate.filter(isGoodId);
            } else {
                log.deactivate = [];
            }

            return true;
        });
    } else {
        s.routerLog = [];
    }
}

/**
 * Dynamically adjusts timestamp formats (Day X/N vs DD/MM/YYYY and 12h vs 24h) inside prompt instructions.
 * @param {string} prompt
 * @param {object} settings
 * @returns {string}
 */
export function adjustPromptTimestamps(prompt, settings) {
    if (!prompt) return prompt;
    const isCalendar = !!settings.useDdMmYyFormat;
    const is24h = !!settings.use24hTime;

    let result = prompt;

    if (isCalendar) {
        if (is24h) {
            // Target: DD/MM/YYYY, HH:MM (24h)
            result = result
                .replace(/Day ([1-9])/g, '0$1/01/2026')
                .replace(/Day N/g, 'DD/MM/YYYY')
                .replace(/Day X/g, 'DD/MM/YYYY')
                .replace(/Day 0/g, '31/12/2025')
                .replace(/12:15 AM/g, '00:15')
                .replace(/11:52 AM/g, '11:52')
                .replace(/10:00 PM/g, '22:00')
                .replace(/08:00 AM/g, '08:00')
                .replace(/06:00 PM/g, '18:00')
                .replace(/14:00/g, '14:00')
                .replace(/10:42/g, '10:42')
                .replace(/10:44/g, '10:44')
                .replace(/HH:MM AM\/PM/g, 'HH:MM')
                .replace(/HH:MM/g, 'HH:MM');
        } else {
            // Target: DD/MM/YYYY, HH:MM AM/PM (12h)
            result = result
                .replace(/Day ([1-9])/g, '0$1/01/2026')
                .replace(/Day N/g, 'DD/MM/YYYY')
                .replace(/Day X/g, 'DD/MM/YYYY')
                .replace(/Day 0/g, '31/12/2025')
                .replace(/14:00/g, '02:00 PM')
                .replace(/22:00/g, '10:00 PM')
                .replace(/10:42/g, '10:42 AM')
                .replace(/10:44/g, '10:44 AM')
                .replace(/HH:MM/g, 'HH:MM AM/PM')
                .replace(/HH:MM AM\/PM/g, 'HH:MM AM/PM');
        }
    } else {
        if (is24h) {
            // Target: Day N, HH:MM (24h)
            result = result
                .replace(/0([1-9])\/01\/2026/g, 'Day $1')
                .replace(/DD\/MM\/YYYY/g, 'Day N')
                .replace(/31\/12\/2025/g, 'Day 0')
                .replace(/12:15 AM/g, '00:15')
                .replace(/11:52 AM/g, '11:52')
                .replace(/10:00 PM/g, '22:00')
                .replace(/08:00 AM/g, '08:00')
                .replace(/06:00 PM/g, '18:00')
                .replace(/14:00/g, '14:00')
                .replace(/10:42/g, '10:42')
                .replace(/10:44/g, '10:44')
                .replace(/HH:MM AM\/PM/g, 'HH:MM')
                .replace(/HH:MM/g, 'HH:MM');
        } else {
            // Target: Day N, HH:MM AM/PM (12h)
            result = result
                .replace(/0([1-9])\/01\/2026/g, 'Day $1')
                .replace(/DD\/MM\/YYYY/g, 'Day N')
                .replace(/31\/12\/2025/g, 'Day 0')
                .replace(/14:00/g, '02:00 PM')
                .replace(/22:00/g, '10:00 PM')
                .replace(/10:42/g, '10:42 AM')
                .replace(/10:44/g, '10:44 AM')
                .replace(/HH:MM/g, 'HH:MM AM/PM')
                .replace(/HH:MM AM\/PM/g, 'HH:MM AM/PM');
        }
    }

    return result;
}

/**
 * Iterates through all stored system prompt, modular agent prompt, and stock prompt templates,
 * rewriting their embedded date/time examples to match the newly selected format.
 * @param {object} settings
 */
export function adjustAllStoredTemplatesForTimeFormat(settings) {
    if (settings.routerSystemPromptTemplate) {
        settings.routerSystemPromptTemplate = adjustPromptTimestamps(settings.routerSystemPromptTemplate, settings);
    }
    if (settings.routerModularPromptTemplate) {
        settings.routerModularPromptTemplate = adjustPromptTimestamps(settings.routerModularPromptTemplate, settings);
    }
    if (settings.stockPrompts) {
        for (const [key, val] of Object.entries(settings.stockPrompts)) {
            settings.stockPrompts[key] = adjustPromptTimestamps(val, settings);
        }
    }
}
