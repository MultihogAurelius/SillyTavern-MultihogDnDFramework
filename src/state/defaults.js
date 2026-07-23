/**
 * Factory default settings object + factory reset helpers.
 */

import { DEFAULT_STOCK_PROMPTS } from '../../constants.js';
import { MODULE_NAME } from './schema-sections.js';
import { DEFAULT_MODULES } from './default-modules.js';
import { getDefaultPortraitLocationSystemPrompt } from './portrait-prompts.js';

/**
 * Builds a fresh copy of every settings default. Extracted from getSettings()
 * so it can be reused by getFactoryCartridgePayload() (the "Stock" Game
 * Cartridge) without duplicating this large literal.
 */
export function buildDefaultSettings() {
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
        npcRelationshipUpdateMode: 'regex',
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
RELATIONSHIPS: Never create a relationship section (e.g., [RELATIONSHIPS]) in the memo. When the separate relationship-command instruction is present, report qualifying deltas only through its [RELATIONS] command block.
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
