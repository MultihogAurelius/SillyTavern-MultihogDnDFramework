# Multihog D&D Framework

Welcome to Multihog D&D Framework, a simulation-focused AI RPG platform that is highly modular and customizable. Your imagination is the ceiling.

This document is written so a tutorial bot (or a new player) can explain **what the system is**, **how a turn actually runs**, and **how to use each major feature** without inventing behavior.

The D&D setup is the default plug-and-play cartridge. You can scrap the stock system prompt and modules and track whatever you want — fantasy, slice-of-life, modern, sci-fi, or pure homebrew.

---

## The Core Components

1. **The System Prompt** — the brain of the Game Master (GM) / Narrator; game logic lives here.
2. **The State Tracker** — the mechanical “accountant”; keeps HP, inventory, time, combat, and more aligned with the story.
3. **Hybrid RNG** — deterministic dice queues and/or commitment-based tool-call dice so the world has real physics instead of plot armor.
4. **The Lorebook Agent** — the librarian; chronicles NPCs, locations, factions, events, and relationships for long-term memory.
5. **World Progression** — macroscopic off-screen world simulation on an in-world time schedule.

Together they address the four classic LLM-tabletop failures: forgotten inventory/spells, lost long-term context, inevitable player victory, and a static world outside the player’s bubble.

---

## Installation

Packaged releases may lag. Prefer installing from the repo:

1. Open SillyTavern’s extension menu.
2. Choose **Install extension**.
3. Paste this repository’s URL.

Suggested companion: **[Summaryception](https://github.com/Lodactio/Extension-Summaryception)** — context compression that pairs well with Lorebook Agent (rough arc from the summarizer; microscopic records from the agent).

---

## Recommended Models

These are recommendations, not rules.

| Role | Suggestion | Notes |
|------|------------|--------|
| Narrator / GM | MiMo 2.5 Pro or DeepSeek 4 Pro (e.g. via OpenRouter) | Needs **tool calling** if you use Hybrid RNG (tool-call mode). |
| State Tracker + Lorebook Agent | Gemini 3.1 Flash-Lite (or Flash / 3.5 Flash) | Cheap and reliable for extraction / lore passes. |
| Combat narrator (optional) | Gemini 3.5 Flash with thinking Medium | Use **Combat API Override** so combat uses a faster model while `[COMBAT]` is active. |

---

## First-Time Setup

### Narrator character

Create (or load) a SillyTavern character card that acts as the narrator — e.g. “Simulation Engine” or “Game Master.” The framework injects mechanical truth into prompts; the card supplies voice and framing.

The system rejects the traditional ST use of character cards, which are meant for 1-on-1 chats because RP of this kind necessarily introduces lots and lots of characters. Therefore it would make no sense to attribute the GM outputs to any one character. It functions more like a book in format, where there is a "narrator" under which everything happens.

### Enable the framework

Turn the extension on in settings. With **Custom Sysprompt Mode** off, the framework writes its assembled GM prompt into SillyTavern’s **Quick Prompt → Main**. It can back up your previous Main prompt and restore it when the tracker is disabled (if Main prompt backup is enabled).

### Instant Action (fastest path)

On an empty tracker, use Instant Action / Quick Start by genre (**Fantasy**, **Modern**, **Sci-Fi**, **Horror**). The pipeline is sequential:

1. Applies your current Narrator Configuration (settings + sysprompt).
2. Picks a random archetype for that genre and generates a character sheet into the State Tracker.
3. Generates a persona bio, adds a **Player Card** for Lorebook Agent, and activates the SillyTavern persona.
4. Sends the chat message `Begin the adventure`.

You can also use **Character Roll** with explicit name/class/level/gear, or paste an existing sheet into **Raw View**. If formatting doesn’t match what the UI expects, use the tracker’s **💬** button and ask the model to fix it.

### Chat-Linked Mode

On by default. Each chat keeps its own memo, modules, quests, portraits, Lorebook Agent watermarks, World Progression timer, and related campaign data under that chat ID. Switching chats saves the old partition and loads the new one. Campaign lorebook prefix is derived from the chat filename (sanitized) unless overridden. Most people really never have any reason to turn Chat-Linked Mode off, so don't worry about it.

**Scenario Profiles** are a separate feature: named snapshots of memo + modules + campaign-related fields you can save/load manually. They are not a full dump of connection settings or UI preferences.

---

## How a Turn Works

Understanding this loop is more important than memorizing every setting.

### Before the narrator replies (interceptor)

When you send a message, the framework finds the last user message and can prepend:

- `[PLAYER_CHARACTER]` (if linked)
- `[NPC_RELATIONS]`
- An **RNG Queue** block (when Pre-Seeded RNG applies — see Hybrid RNG)
- `### STATE MEMO (DO NOT REPEAT)` — the **previous** turn’s tracked state
- Quest / deadline context
- Active lore / World Report injections (position and depth configurable)
- Optional end-of-output footer reminder

So the GM always sees the last known mechanical truth **before** it writes the next scene.

### After the narrator replies

On generation end (skipped for quiet/impersonate and while a pass is already running), roughly:

1. Keyword scan of the assistant output (when Lorebook Agent keyword systems are active).
2. **State Tracker** pass (throttled by “run every N”; default every turn) — parses the new narrative and updates the memo.
3. **Combat API Override** sync (switch/restore narrator profile if combat started/ended).
4. Dynamic RNG prompt sync (Hybrid mode combat boundary).
5. **World Progression** TIME check (deterministic; see that section).
6. **Lorebook Agent** tick / pass when its “run every N” threshold is met.

Important: the State Tracker runs **after** the reply. The memo injected on the *next* turn is what was updated from the *previous* reply.

`/sendas` does **not** auto-trigger Lorebook Agent; use `/lorebookagent` manually if needed.

---

## The System Prompt

This is the brain of the GM/Narrator. If it is removed (and nothing replaces it), the narrator no longer knows how to run the game.

### Where it lives

- Source templates: `sysprompt.txt` (tool-call / Hybrid RNG) or `sysprompt_legacy.txt` (queue-oriented legacy RNG).
- Assembled into SillyTavern **Quick Prompt → Main** when the tracker is on and Custom Sysprompt Mode is off.
- **System Prompt Control Room** lets you reorder, enable/disable, unlock/edit built-in sections, and add custom library sections (manual or AI wizard).

### Custom Sysprompt Mode

When enabled, the framework **does not** overwrite Quick Prompt Main. Section toggles can still be saved, but auto-apply and combat-driven dynamic RNG prompt rewrites for the main prompt are disabled. Use this when you fully own the narrator prompt yourself.

### Major built-in sections (examples)

The prompt is modular XML-style sections, including among others:

| Area | Example sections |
|------|------------------|
| Identity & dice | `<role>`, `<rng_system>`, `<rng_queue_instructions>` |
| Combat | `<combat>`, `<combat_start>`, `<combat_flow>`, `<damage_logic>`, `<positioning_and_movement>`, `<npc_stat_scaling>`, `<critical_hits_and_dying>` |
| Progression | `<xp_system>`, `<level_up_protocol>`, `<quests>`, `<loot>` |
| Simulation | `<narrative>`, `<world_progression>`, `<resting>`, `<leaving_vs_benching>`, `<bench_ETA_system>`, `<relationship_tracking>` |
| Output contract | `<state_memo>`, `<end_of_output_footer>`, `<CYOA_mode>`, various `<constraints>` |

### Combat rules the GM is taught (summary)

`<combat_start>` — Declare previously-unknown NPC stats (AC, saves, HP, combat line, resistances, etc.), then roll initiative. Caster enemies list spells by level + slots at introduction (e.g. `Cantrips: Fire Bolt; Level 1 (2/2): Magic Missile, Shield`) — never a flat comma list.

`<combat_flow>` — Simulate every NPC each round. Use pre-calculated totals from STATE MEMO (`[CHARACTER]` / `[PARTY]` / `[COMBAT]`) — never re-derive bonuses mid-fight. Martials use Combat line Melee/Ranged values; casters use listed Spell Atk / Spell DC. Slash-separated values (`+X/+Y`) mean one roll per value. State remaining HP after every damage/heal. Buffs/debuffs expire on schedule; state initial duration (e.g. Mage Armor 8h, Heroism 10 turns).

### A note about the stock D&D rules
This system is neither a full version of 5e nor 3.5e. It's rather a hybrid system that streamlines in places. For example, attacks per round are reduced to decrease the GM's cognitive load, ensuring reliability is high. This kind of "cut the corners where it makes sense" design is employed all over the system. For example, combat uses BAB, which is based on 3.5e/Pathfinder, but the LLM may use 5e spells and such. A lot of the system rides on LLMs' vast inherent knowledge about D&D, which enables Multihog to keep the system lean and not define every rule. A big part of the system prompt focuses on constraints, what NOT to allow the player to do, which is a crucial part of keeping the simulation feeling authentic. This is stuff such as resting limits (only every 9 hours by default) and forbidding the player from using items they don't have, etc.


---

## Hybrid RNG

Hybrid RNG is the physics layer. Without it, models tend toward sycophantic success.

### Modes (Narrator Configuration → RNG)

| Mode | Behavior |
|------|----------|
| **Pre-Seeded + Tool Calls** (Hybrid) | Out of combat: `RollTheDice` / `RollTheDiceD100` tools only. **In combat:** RNG Queue only; dice tools are unregistered for that context. |
| **Pre-Seeded Only** | Queue injected every eligible turn; no dice tools. Default in code settings. Recommended with **CYOA**. |
| **No RNG** | Neither queue nor tools. |

### RNG Queue

- Built with cryptographically random values.
- Typical d20 queue: multiple pre-rolled lines for common dice.
- Optional d100 queue (percentage mode).
- Injected into the user message when Pre-Seeded RNG applies (always in Pre-Seeded Only; in Hybrid, primarily when combat is active).

### Tool-call dice (commitment logic)

Non-legacy tool schema requires the narrator to declare **who**, **formula**, and **dc** *before* seeing the result:

- **d20:** success if `total >= dc`.
- **d100:** roll-under; success if `total <= dc` (dc is a percentage).

Legacy dice logic omits DC (vanilla-style tool). The narrator model must support **tool calling** for Hybrid / tool modes.

### Combat detection

Combat is considered active when a non-empty `[COMBAT]…[/COMBAT]` block exists and is not `END_COMBAT`. That gate drives Hybrid’s tool↔queue switch and Combat API Override.

### d100 mode

Enabling d100 tools/queues flips global percentage-style behavior (tool names, queue tags, and sysprompt substitutions). Stock prompt adaptation is basic — customize `<rng_system>` in the Control Room if you lean on d100 heavily.

---

## The State Tracker

The State Tracker (ST) is the accountant of the system. It does **not** invent narrative or own the ruleset; it keeps the GM honest about mechanical state — especially when history is summarized out of the context window.

ST parses the narrative in natural language. Exact string matches are not required; if the information is present and comprehensible, the tracker can record it. Each turn the GM receives a **STATE MEMO** injection on the user message so it always sees the current mechanical picture.

### Modules

ST is built from **modules**. Each module:

1. Owns a UI section in the tracker window.
2. Owns a prompt that tells the tracker what to record.
3. Uses a corresponding `[TAG]` in the memo (e.g. `[COMBAT]`, `[INVENTORY]`).

Adding a template/example inside a module prompt is optional but strongly recommended so output matches the rendering backend.

### Stock modules

#### `[CHARACTER]`

Player core sheet: HP, Combat line (BAB, Melee/Ranged attack totals with attacks-per-round), Base/Total AC, Gear summary, Proficiencies, Attr, Saves, Skills, Traits, Hit Dice, Status.

Total AC is Base AC plus bonuses from `[INVENTORY]` items tagged `[E]`. Melee/Ranged totals on the Combat line are authoritative during fights — the GM should not re-invent them.

#### `[PARTY]`

Active companions (max 5 + `{{user}}`). Same general sheet shape as the player, plus Abilities/Spells lines for casters.

- Add on narration like `(X joins the party.)`
- Permanent remove **only** on exact annotation `*(Left the party: X — reason)*`
- If the roster changes, output the **entire** `[PARTY]` block; if unchanged, omit it.

#### `[BENCHED PARTY]`

Temporary separation while reunion remains plausible. The tracker moves full stat sheets in code — the module outputs commands only:

```
[BENCHED PARTY]
[BENCH] Gareth — stayed at the lodging to rest and study
[/BENCHED PARTY]
```

`[UNBENCH] Name` reunites. Optional `ETA:` timestamps when the story gives a real return time. Brief off-screen absence is **not** a bench. Benched members can appear in World Progression reports.

#### `[COMBAT]`

Active enemies, combat round counter, per-combatant HP, Att/def, saves, abilities, spells (casters), other traits, status. Martial vs caster layouts must not be mixed on one enemy. Tier bands (Minion → Legendary) guide invented stats. End combat with:

```
[COMBAT]END_COMBAT[/COMBAT]
```

Party members never belong inside `[COMBAT]`.

#### `[INVENTORY]`

Two headers: **Gear:** and **Other Items:**

- Every item: thematic emoji + rarity `[Common]`…`[Artifact]` + worth `(~X currency)`
- Magical weapons/armor: suffix naming (`Flame Dagger +1`), never `+1 Flame Dagger`
- Equipped: `[E]` immediately after rarity
- Bare currency under Other Items (💰 coins / 💵 paper)

Example:

```
[INVENTORY]
Gear:
- 🗡️ [Rare] [E] Flame Dagger +1 (1d6+2 Fire, +1 to hit) (~350 GP)
- 🛡️ [Common] Iron Buckler (AC +2) (~15 GP)
Other Items:
- 🧪 [Uncommon] Healing Potion (Restores 2d4+2 HP) (~50 GP)
- 🪢 [Common] Rope, 50 ft (~1 GP)
- 💰 1,200 GP
[/INVENTORY]
```

Worth values can auto-render as coin badges in the UI.

#### `[ABILITIES]` / `[SPELLS]`

Abilities = non-spell class features only. Spells = cantrips + leveled slots `Level N (avail/max): …`. Never mix the two.

#### `[TIME]`

Clock + last long rest. Format variants exist (12h/24h, Day N vs DD/MM/YYYY). Used for:

- Out-of-combat buff decay (delta vs prior memo)
- Distinguishing short rest (~1h) vs long rest
- **World Progression** scheduling (in-world elapsed time)

#### `[XP]`

`Level: X | XP: current/max` whenever XP or level-up is narrated.

#### `[QUESTS]`

Only accepted tasks (not mere offers). Engine archives completed/failed; memo usually holds actives. Fields include `ID`, `STATUS`, `GIVER`, `ACCEPTED`, optional `DEADLINE`, `REWARD` lines, `FRUSTRATION_COEFF` (NPC-given only), `OBJ_ACTIVE` / `OBJ_COMPLETED` / `OBJ_FAILED`, optional `OBJ_TOTAL`. Emergent quests use `TYPE: emergent` and `GIVER: Self @ —`.

Narrator acceptance markers:

- `*(Quest Accepted: Name)*`
- `*(Emergent Quest Active: Name)*`

With Deadlines + Frustration enabled, overdue NPC quests decay giver mood via `FRUSTRATION_COEFF` (≈0.4 patient → 3.0 volatile) instead of hard auto-fail. Without Frustration, deadline expiry can auto-fail.

### Tracker UI essentials

- **Rendered panel** — HP bars, spell pips, status pills, inventory badges, etc.
- **Raw View** — edit memo text directly.
- **💬 Direct Prompt** — talk to the tracker model with the prior memo (and optional recent chat context); bypasses the narrative pipeline; good for corrections and setup.
- **Full Audit** — chunked pass over large chat history to rebuild a complete memo.
- **Rendering Tags Library** — live previews of `((TAG))` markers used in module lines.
- Mobile: open from the wand menu.

### Connection settings

State Tracker can use Main API, a Connection **Profile**, or dedicated Ollama/OpenAI endpoints. Its **Core Prompt** is the tracker system prompt — separate from the narrator Quick Prompt.

**Combat API Override** switches the **main narrator** connection profile (not the State Extractor) while combat is active, then restores the baseline when combat ends.

### Slash command

`/statetracker` (alias `/st`):

- Default / `run` — normal update since last user turn
- `full` / `audit` — full context audit
- `lookback=N` — last N assistant blocks
- `quiet=true` — suppress toast

---

## Rendering Tags

Memo lines can include inline markers that the UI renders. Major families include:

`PILL` / `PILLS`, `BAR` (and HP aliases), `BARREL` (signed +/- bar), `NPC` (freeform NPC cards inside blocks), `XPBAR`, `TEXT`, `BADGE`, `HIGHLIGHT`, `OBJ`, `REWARD`, `DIFFICULTY`, `PROGRESS`, alert styles (`WARNING` / `SUCCESS` / …), currency (`GOLD` / `SILVER` / `DOLLAR` / …), `ROLL`, `CLOCK`, `STARS`, `WEIGHT` / `CAPACITY`, `WEATHER`, `ORBS` / `AP`, `SLOTS`, `PHASE` / `STEP`, `GAUGE` / `METER`, `CHARGE` / `BATTERY`.

Coloring:

- Named suffix on the tag: `((PILLPINK))`, `((BARRED))`
- Or explicit: `((PILL - rebeccapurple))`, `((BAR - #ff6699))`
- Two colors → gradients (or BARREL positive/negative sides)

`((NPC)) Name:` starts a party-style card with freeform follow-up fields; matching Lorebook Agent portraits apply when names match.

---

## The Lorebook Agent

If the State Tracker is the mechanical accountant, the Lorebook Agent (LA) is the librarian for macroscopic narrative memory. It is intended to pair with a summarizer (e.g. Summaryception) that keeps a rough arc; LA fills gaps with timestamped, keyworded entries drawn from recent narrative.

### Attention model (“keyring”)

Native SillyTavern lorebooks are used as the database. Entries default inactive. LA’s attention model:

- **Active** entries: full content visible to the agent.
- **Inactive** entries: title + keywords only (the **keyring** / archive summary) until activated.
- **Max Active** can FIFO-prune to control tokens.

LA is aware of keyword activations inside one container (extension scanner and/or native ST keyword activation, depending on settings).

### How it runs

- Default cadence: every **N** counting generations (commonly 1–3; default often 3).
- Lookback: since last run (recommended), since last user, or fixed count.
- Modes:
  - **Basic (tags):** structured `[[NPC: …]]` / LOC / FAC / QUEST / EVENT markers plus activate/deactivate/delete directives.
  - **Advanced (tools):** ReAct tool loop (`grep_lore`, `inspect_book`, `read_entry`, `commit`, …) until finish / max turns.
- World Skeleton books (`*_Skeleton`) are off-limits to the agent.
- Campaign books use a prefix, e.g. `{prefix}_NPCs`, `_Locations`, `_Factions`, `_Quests`, `_Events`, `_World`, `_Skeleton`.

### Relationships

Optional friendship/affection on NPC cards. Update methods (only one active):

1. **Narrator Regex** (default) — parses annotations like `*(Friendship: Name +X — …)*` / Affection from narrator output.
2. **State Tracker Tags** — tracker emits `[RELATIONS]` command lines; code applies deltas. (Those blocks are stripped before memo merge so they don’t leak into the GM memo.)

Caps default around ±150 (per-chat override possible in Campaign Records).

### Portraits & Visualization

- Portraits via SillyTavern Image Generation **or** Pollinations.ai.
- Auto-gen toggles for linked PC, party, combat enemies, lorebook NPCs, locations.
- **Visualization Mode**: location hero image + present NPC/PC tiles (immersion / realtime scene view).
- Real-time triggers: on location enter/change and/or every N outputs.

### Slash command

`/lorebookagent` (aliases `/lbagent`, `/la`, `/router`):

- Default / `run` — normal pass
- `save [hint]` — save scene to lorebook
- free text — Direct Command (with lookback)
- `quiet=true`, `lookback=N`

LA also has its own **💬** Direct Prompt in the agent panel.

---

## World Progression

World Progression (WP) is the fourth major simulation pillar: a macroscopic backbone so the GM thinks beyond the player’s bubble.

Every X **in-world** hours (default 24), WP injects a World Report into context (stored in `{prefix}_World`, injection every turn while active). Example flavor:

> World  
> [01/06/3029, 08:00 AM] - First Prince Hanse Davion reviews urgent planetary status updates…

### Deterministic trigger

JavaScript checks `[TIME]` in the State Memo after State Tracker updates. The AI writes the report; it does **not** decide whether to generate one. WP requires Lorebook Agent enabled. First successful TIME parse stamps a baseline and does not fire; later elapsed intervals fire reports. Manual **Generate Now** is always available.

### Quick Start Guide

1. **Atmosphere Summary** — write manually or Auto-Generate from recent chat (tone/texture; avoid specific named plot dumps).
2. **Generate Skeleton** — factions, locations, NPCs, conflicts as Day 0 baseline in `{prefix}_Skeleton`. Edit afterward in native lorebook UI for full customization.
3. **Focus Randomization** (recommended) — lottery across skeleton vs organic pools so reports don’t fixate on the player bubble. Active `[PARTY]` is excluded; `[BENCHED PARTY]` members remain eligible.
4. **Generate the First Report** — Generate Now (skeleton-only if early) or wait for the interval (later runs include organic lore).

### Tips

- 24h in-world is a solid default; try shorter/longer intervals.
- Injection position/depth changes how prominently reports sit near recent messages.
- WP is optional but deepens simulation and lets dormant entities resurface.

---

## Quests (player-facing)

Enable the Quests module (and optionally Deadlines / Frustration) in settings. Accepted quests appear in the tracker UI. Difficulty is narrative-only — the system does not soft-cap quest danger to party level; if you accept a dragon hunt at level 2, that is on you.

---

## CYOA Mode

When enabled in narrator configuration, the GM ends turns with numbered courses of action (often with emojis). The extension turns those into clickable chat buttons. Style, slots, and presets live under CYOA settings. Cartridge export can include CYOA config.

**Pre-Seeded Only** RNG is the recommended pairing with CYOA Mode. This is because the rolls are embedded in the choices, for example DC 17. The GM is forced to commit to a roll prior to seeing the next pre-rolled RNG batch. It cannot engage in sycophancy to the player by fitting the DC to the roll it knows beforehand, which is theoretically possible otherwise. CYOA mode closes this door completely, just like RollTheDice calls close it outside of CYOA mode.

Of course, you can use CYOA mode with tool calls, but it's inefficient because the GM will call the tool after every choice with a roll baked in, causing you to incur the input token cost of the existing context. It gives no functional benefit over the pre-seeded RNG with CYOA mode, only causes cost and latency.

---

## Game Systems Wizard & Cartridges

### Game Systems Wizard

Describe a mechanic in plain language (e.g. “reputation system”). The wizard drafts a linked pair:

1. A **GM sysprompt section**
2. A **State Tracker module**

Review both in the forge (edit, regenerate either/both, iterate with feedback, set effect owner), then save as a Game System bundle. No tool-calling required for this flow — it is tag/prompt based.

### Game Cartridges

Export/import a portable setup (`multihog-game-cartridge` format), typically including:

- State Tracker prompts, modules, order, RNG/time-related flags
- CYOA config
- Game Systems + custom fields
- Character sheet section/preset-related data
- Portrait prompt templates/presets
- Lorebook Agent prompts/modules/custom tags
- World Progression report prompt

**Not** included: API connections, most UI preferences, or live per-chat memo/campaign state. A virtual **Stock** cartridge represents factory defaults.

---

## Themes & Appearance

Built-in visual themes: Match ST UI, Hacker, Fantasy, Hologram, Pacific Cove, Cherry Blossom, plus **Custom** via AI Theme Wizard (describe → New / Iterate / Save to library). Optional scenario art behind the tracker panel; separate backdrop options for the detached Lorebook Agent window.

---

## Narrative Components (high level)

Configurable narrator-side behaviors include:

- **Narrative Pacing** modes (e.g. Normal / High-Agency / Downtime)
- **Benched Party** handling (ties into WP eligibility)
- **Relationship Tracking** sections in the GM prompt
- **CYOA** choice presentation
- End-of-output footer reminders so the GM closes turns in the format ST expects

---

## Customization Without D&D

You are not locked to wizards and goblins:

1. Disable or delete stock modules you don’t need.
2. Add custom fields / modules (manually or via wizards).
3. Use Custom Sysprompt Mode or Control Room library entries for a wholly different ruleset.
4. Export the result as a Game Cartridge for reuse.

The framework’s backbone is still **time + memo + optional lore/world layers** — the fiction genre is yours.

---

## Slash Commands (summary)

| Command | Purpose |
|---------|---------|
| `/statetracker` (`/st`) | Manual State Tracker update / full audit |
| `/lorebookagent` (`/lbagent`, `/la`, `/router`) | Manual Lorebook Agent pass / save / direct command |
| `/roll` (`/r`) | Manual dice |

---

## Troubleshooting (quick)

| Symptom | Likely cause / fix |
|---------|-------------------|
| GM ignores inventory/HP | Tracker off, memo empty, or Custom Sysprompt Mode left you without `<state_memo>` guidance — check ST enabled and memo injecting. |
| Dice always favor the player | Enable Pre-Seeded and/or Hybrid tool-call RNG; ensure model supports tools for Hybrid. |
| Combat tools still firing / queue missing | Hybrid switches at `[COMBAT]` boundary; confirm combat block present/ended correctly (`END_COMBAT`). |
| World Reports never appear | WP + Lorebook Agent must be on; `[TIME]` must advance in-world past the interval; first TIME parse only baselines. |
| Lorebook Agent “missed” a `/sendas` scene | Expected — run `/lorebookagent` manually. |
| Wrong campaign data in a new chat | Chat-Linked Mode should isolate chats; if links were removed or disabled, memo restore behavior differs — check Chat-Linked settings. |
| Tracker formatting broken after paste | Use 💬 Direct Prompt: “Reformat this sheet to stock module layout.” |

---

## Mental Model (one paragraph)

The **System Prompt** teaches the narrator how to simulate. **Hybrid RNG** supplies unbiased randomness. The **State Tracker** audits each reply into a memo that is re-injected next turn. The **Lorebook Agent** keeps long-horizon people/places/events available despite summarization. **World Progression** advances the off-screen world on the in-world clock. Everything else — quests, CYOA, portraits, cartridges, themes — is optional depth on that spine.
