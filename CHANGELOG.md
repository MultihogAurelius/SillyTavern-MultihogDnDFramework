# Changelog

All notable changes to the **Multihog D&D Framework** will be documented in this file.

## [2026.8.30] - 2026-08-30

### Added
- **Portrait Prompt Art-Style Presets**: Portrait Prompt Templates now ship factory art-style presets (Fantasy Default, Anime, Photorealistic, Oil Painting, Comic Book, Watercolor, Dark Fantasy). Click to load a style across NPC/PC, Character/Party/Combat, and Location Scene prompts. User Save Setup library remains available underneath; factory names are reserved. Present-NPC location toggle still swaps only within the active shipped style. Preset list scrolls in its own pane.

## [2026.8.29] - 2026-08-29

### Fixed
- **Control Room cartridge isolation**: Editing or re-locking an unlocked built-in prompt section now targets only the override active in the current setup, instead of an older inactive override retained in another cartridge/chat's shared snippet library.

### Changed
- **Narrator `<narrative>`**: Split NPC autonomy rules into clearer bullets; clarify non-omniscience (established narrative + archetype); guide tone/behavior from the injected permanent profile (identity fields above chronicle lines, since `[CORE]` markers are stripped for the GM).

## [2026.8.27] - 2026-08-27

### Added
- **Tabbed Agent Console**: The Lorebook Agent panel Console drawer now has tabs for State Tracker, Lorebook Agent, Map Updater, Map Evolution, and Map Architect. Each agent keeps its own live terminal feed; Agent Log History remains on the Lorebook Agent tab only.
- **Terminal/Direct Prompt**: Renamed the Console drawer and moved per-agent direct command fields into each terminal tab (including Map Evolution). Removed the Lorebook Agent footer 💬 prompt toggle.

### Fixed
- **Map Updater direct prompt**: Direct-command ADD_ASSET/SET_ASSET operations now require lasting `detail` descriptions, matching routine occupancy updates instead of creating bare-name assets.
- **Offsite Map Attachment**: `CreateAreaMap` now accepts `attachTo.site` plus `attachTo.cell`, allowing the GM to attach a DUNGEON or INTERIOR to an exact AREA on any mapped parent without moving the player or first creating a BUILDING.
- **Three-Level Map Nesting**: SETTLEMENT, DUNGEON, and INTERIOR maps can host DUNGEON/INTERIOR peers up to three mapped documents deep. Parent gateway creation, host stamping, and inactive-parent persistence remain atomic.

### Changed
- **Soft Map Editor Guidance**: native-tool and text-opener instructions now use a short structural-address contract. The mapped-site index prints exact targetable cell names, and attachment errors return exact alternatives for a one-step retry.
- **Offsite Knowledge Safety**: explicit structural attachment no longer implies player movement or visitation; the new child entrance begins UNREVEALED, while active-location creation retains its VISITED entrance behavior.
- **Strict Structural Names**: map sites and areas use identity matching that keeps whole-word extensions distinct, so `Cellar Crypt` and `Cellar Crypt Dungeon` cannot collapse into the same cell while small same-token-count typos remain tolerated.
- **Recursive Gateway Invariant**: SUBDUNGEON and SUBINTERIOR assets are valid on room-scale parent maps, while Map Updater and Map Evolution are explicitly forbidden from creating, moving, renaming, or removing these runtime-owned gateways.

## [2026.8.24.16] - 2026-08-23

### Changed
- **Map Updater Direct Prompt**: direct map commands now use a compact dedicated system/request prompt that performs only the explicit instruction. Routine occupancy, time, building-population, and unrelated PARTY-cleanup guidance stays exclusive to normal Map Updater passes.

## [2026.8.24.15] - 2026-08-23

### Fixed
- **Map Updater site exits**: leaving a mapped site now forces one final targeted occupancy pass so NPCs established as departing with the player can be removed from the old map. Map-to-map transitions clean the departed site before the destination's normal updater cadence.
- **PARTY members on maps**: an existing CREATURE that joins `[PARTY]` must be removed with `REMOVE_ASSET`; prompt guidance and correction validation enforce that PARTY remains outside durable map occupancy.

## [2026.8.24.14] - 2026-08-23

### Added
- **Map Details Map Updater direct prompt**: Direct Prompt on the site inspector targets that map even when it is not the active site (`siteRoot` pass + inspector commit path).

### Changed
- **Map Details direct prompt UI**: labeled Direct Prompt button aligned with Map Entries / Raw JSON; prompt panel opens below that row.

## [2026.8.24.12] - 2026-08-22

### Changed
- **Adventure Companion welcome**: default CHAT greeting now lists Map Updater among the four relay actions.

## [2026.8.24.11] - 2026-08-22

### Added
- **Adventure Companion → Map Updater**: fourth action relays direct map occupancy instructions (same as Lorebook Agent / State Tracker). Persona, tools, fallback tags, and tutorial docs updated.

## [2026.8.24.10] - 2026-08-22

### Changed
- **Visuals/Map toolbar**: removed redundant Map Updater button; run Map Updater from the header play menu (or 💬 direct prompt on the site map).

## [2026.8.24.9] - 2026-08-22

### Changed
- **Map Updater REMOVE_ASSET**: `REMOVE_ASSET` now deletes the asset record (and contained children) from the map. Prompt adds `REMOVE_ASSET` alongside existing `DESTROYED`/`DEAD` guidance — kills still default to remains in-room; purge only when nothing lasting stays or correcting a mistake.

## [2026.8.24.8] - 2026-08-22

### Fixed
- **Visuals/Map Map Updater direct prompt**: compact single-row layout; 💬 toggle now hides/shows the panel (`display:flex` no longer overrides `hidden`).

## [2026.8.24.7] - 2026-08-22

### Added
- **Visuals/Map Map Updater direct prompt**: run Map Updater from the site-map toolbar with optional one-pass instructions and lookback (`Ctx`).

## [2026.8.24.6] - 2026-08-22

### Changed
- **Map Architect familiar sites**: when player-facing story establishes thorough familiarity (home, daily workplace, recurring base), initial maps mark every area `VISITED` and ordinary assets `KNOWN`; hidden surprises stay `UNREVEALED`.

## [2026.8.24.5] - 2026-08-22

### Changed
- **Map Updater BUILDING population**: skip ambient set dressing (tipped chairs, dusty booths, ordinary furniture); add only map-worthy CREATURE/GROUP/LOOT/HAZARD/TRAP/ALARM/BARRIER/interactive OBJECT contents via `ADD_ASSET`, never `SET_ASSET` on invented ids.

## [2026.8.24.4] - 2026-08-22

### Changed
- **Pre-narration BUILDING population**: an explicit player action targeting a pending BUILDING now runs its hidden population pass during `MESSAGE_SENT`, before SillyTavern assembles the narrator prompt. Perception, entry, and danger checks therefore adjudicate pre-existing map reality instead of creating contents afterward.
- **Intent safety**: pre-narration contents begin `UNREVEALED`, cannot write chronicles or assume entry/roll success, and clear the shared population gate atomically. Footer-based first entry remains a retry fallback.

## [2026.8.24.3] - 2026-08-22

### Changed
- **Map Updater footer name drift**: short leaves like `General Store` still count as entry of the matching longer BUILDING (e.g. `Bullion General Store`); clear `notEntered` and populate normally.

## [2026.8.24.2] - 2026-08-22

### Changed
- **Map Updater BUILDING population**: clarified narrative-driven interior contents (creative, setting-fit, not excessive), rumor/known seeding, and child-map wording.
- **First-entry lookback**: FIRST-ENTRY BUILDING POPULATION passes now include at least the last 10 user turns of RECENT STORY (or more when the since-last-run window is wider).

## [2026.8.24.1] - 2026-08-22

### Changed
- **Map Updater streetscape observation**: clearly identified existing UNREVEALED/SUSPECTED BUILDING/OBJECT landmarks become `KNOWN` from outside observation without clearing `notEntered`.

## [2026.8.24] - 2026-08-22

### Changed
- **Status footer**: drop duplicated hosted-child breadcrumb guidance (owned by `<dungeon_reality_and_hidden_mapping>`); ban positional phrasing for unmapped BUILDINGs (`Main Street` or `Main Street, General Store` only when inside).

## [2026.8.23.5] - 2026-08-22

### Changed
- **Status footer location rules**: clarified settlement / hosted-map tier guidance and forbade positional BUILDING phrasing (use the district alone, or `District, Building` only when actually inside).

## [2026.8.23.4] - 2026-08-22

### Fixed
- **Map Updater exterior-relative footers**: phrases like `behind the general store`, `outside the inn`, or `near the chapel` stay on the district and no longer force a new `BUILDING` asset or first-entry population pass. Existing landmarks such as `Hollow Creek General Store` remain the match when the party actually enters (`inside` / named interior).

## [2026.8.23.3] - 2026-08-22

### Changed
- **CYOA roll guidance**: choices need not always include a roll, though any choice *can*; high-stakes / problem-solving should use rolls more, downtime less.
- **Display Groups**: `PARTY` is now an eligible module for display-only grouping (`COMBAT`, `BENCHED PARTY`, and `QUESTS` remain excluded).

## [2026.8.23.2] - 2026-08-23

### Fixed
- **Asset-area knowledge consistency**: any `KNOWN` or `SUSPECTED` asset now automatically raises its effective containing area from `UNREVEALED` to `DISCOVERED`, including assets inside BUILDING or carried-inventory containers. Architect creation, Updater transactions, saved-map normalization, and presentation share the same invariant.

## [2026.8.23.1] - 2026-08-23

### Fixed
- **Map Architect knowledge isolation**: premise and reference facts now define private site reality without making unseen districts, inhabitants, threats, or landmarks `DISCOVERED`, `SUSPECTED`, or `KNOWN`. Only explicit player-facing story context can raise initial knowledge above the entrance defaults.

## [2026.8.23] - 2026-08-23

### Changed
- **Narrator mapping policy**: refreshed the canonical hidden-mapping module for one-map-at-a-time creation, unmapped transition space, standalone-child exit absorption, BUILDING promotion, and lazy BUILDING population. Shipped and embedded prompt copies now stay synchronized with the root source text.

### Fixed
- **Settlement absorption breadcrumbs**: absorbing an existing DUNGEON/INTERIOR now reparents its root and every descendant Location beneath the settlement district while stamping the canonical hosted site and exit context in the same atomic save.
- **Chat rename recovery**: exact rename-reset markers now replace transient destination shells, including browser-local Companion and memo-recovery shells, without overwriting data that existed before the rename.

## [2026.8.22.2] - 2026-08-22

### Fixed
- **Hosted map placement**: promoting a settlement asset now stores or reuses its map at `Settlement :: District :: Asset` instead of creating an unrelated top-level Location. Full-path activation keeps identically named buildings in different settlements distinct.
- **Mapped-area footers**: narrator guidance now requires the exact current room/area after a hosted peer breadcrumb, including four-tier paths such as `Ashford, North Residential Streets, Residential House, Kitchen Passage`; active map canon flags an incomplete site-only footer for correction.

## [2026.8.22.1] - 2026-08-22

### Changed
- **Persistent Maps**: added room-scale `INTERIOR` maps, settlement `BUILDING` / `SUBDUNGEON` / `SUBINTERIOR` assets, creation-time peer absorption, and atomic nested-site promotion with host/exit context. Existing `OBJECT` buildings and peaceful `DUNGEON` maps remain compatible.
- **Map Architect**: settlement generation may now sparingly seed narratively justified `SUBDUNGEON` / `SUBINTERIOR` sites for future mapping, while ordinary structures continue to use `BUILDING`.

## [2026.8.22] - 2026-08-21

### Changed
- **Persistent Maps**: refreshed the GM mapping contract for settlement-first building classification, first-footer naming, and shared entrances/exits.
- **Map Evolution**: the default interval is now 8 in-world hours for both current and other mapped sites.

## [2026.8.21] - 2026-08-21

### Fixed
- **State Tracker profile routing**: completion presets no longer override an OpenRouter connection profile's provider, quantization, fallback, or middle-out routing settings.

## [2026.8.20] - 2026-08-21

### Fixed
- **Player Card approval responsiveness**: adding a generated Player Card no longer waits for a potentially long Campaign Records refresh before confirming the action.

## [2026.8.19] - 2026-08-21

### Fixed
- **Visuals/Map viewport retention**: Map Updater refreshes now preserve the map's horizontal and vertical pan position instead of resetting it to the left edge. The detached map window retains its viewport too.

## [2026.8.14] - 2026-08-20

### Added
- **Time-based map mechanics**: Map Architect, Map Updater, and Map Evolution can now attach absolute in-world timestamps to time-limited assets and resolve their state when those boundaries are reached.
- **Stock module previews**: stock modules now have the same live rendering preview window as custom modules, including preview-box resizing.
- **Game System Wizard prompt selection**: choose which module prompts to inject as rendering templates.
- **Maps Guide**: added a Maps Guide to the Lorebook Agent Locations header.

### Changed
- **Routine map/manifest performance**: routine map and manifest work no longer downloads the entire SillyTavern settings file.

### Fixed
- **Settings and extension-data rollback**: fixed a critical bug where both SillyTavern settings and extension data could sometimes be rolled back.

## [8.36.0] - 2026-08-20

### Added
- **Game System Wizard module formatting examples**: optional checkbox to inject selected existing tracker/GM **prompt instructions** as formatting examples (not live memo values). Per-module picker on the initial and review screens; choices persist.

### Changed
- **Game System Wizard context**: module prompts are no longer sent on every call by default — opt in via the new control.

## [8.35.0] - 2026-08-19

### Added
- **Editable map inspector Raw JSON**: with **Reveal All** on, the Visuals/Map and lorebook MAP inspector Raw JSON tab is a native textarea with **Save JSON**. Validates site lock, normalizes the document, and persists directly to the Location root's private `[MAP]`.

### Changed
- **Map Architect scope tightened**: removed NONE from new map creation handshakes and dropped the standalone-building / peaceful-home mapping exception. DUNGEON is high-risk interiors only; threat choices are LOW through DEADLY. Restored full fantasy syntax examples in the Map Architect system prompt.

## [8.30.3] - 2026-08-19

### Changed
- **Lorebook Agent context ownership**: Agent and Basic prompts now treat keyword / NEWLY ACTIVATED hits as provisional. Narrative relevance is paramount; lazy-pruning to the cap without activating missing higher-priority archive entries is an explicit failure. The live budget banner repeats that on every pass, and overflow text requires swap-in-the-same-commit, not trim-only. Reset stored Lorebook Agent prompts to pick up the wording.

### Fixed
- **Basic Mode deactivate-only commits**: `[[DEACTIVATE: …]]` tags are no longer discarded when they are the only actions in a pass.

## [8.30.2] - 2026-08-19

### Changed
- **Relationship update default**: new installs and unset configs now default to **State Tracker Tags** instead of Narrator Regex. Existing explicit `regex` choices are preserved.

## [8.30.1] - 2026-08-19

### Changed
- **Combat prompt layout**: moved `<ruleset_note>` to the bottom of `<combat>` instead of the top.
- **Combat flow**: NPC simulation line now explicitly says never {{user}}'s actions. Reset a stored narrator Combat section to pick up the wording.

## [8.30.0] - 2026-08-19

### Added
- **Threat NONE**: Persistent Maps now distinguish genuinely safe sites from LOW-threat sites. NONE forbids invented active danger and rejects active trap, hazard, or alarm assets during validation; LOW now means light but real danger. Auto inference, tool/text schemas, map-creation forms, narrator context, and documentation all support the new value. Existing LOW maps remain valid.
- **Opt-in standalone building maps**: an exact named house, shop, inn, headquarters, or recurring player home/base can be deliberately mapped at room scale with the existing DUNGEON enum. Ordinary entry, ownership, lodging, and incidental settlement interiors still do not trigger maps, preventing automatic building-map proliferation.

### Changed
- **Genre-neutral Map Architect examples**: full fantasy maps were replaced with independent cross-genre schema snippets, including socially complex nonhuman characters, so examples no longer anchor map size, topology, theme, or creature morality.
- **Restricted route guidance**: medium and large dungeons normally include a meaningful non-OPEN route, with an isolated reciprocal LOCKED example and guidance for keys, controls, clues, bypasses, and organic seals.

### Fixed
- **Missing reciprocal routes**: valid one-way omissions are mirrored automatically before strict validation, preserving the original state and detail while leaving conflicting or ambiguous topology for correction.

## [8.28.0] - 2026-08-19

### Added
- **Mapped-site index for the narrator**: every Persistent Maps turn injects a compact `[MAPPED_SITES]` list of existing maps (name + kind). It does not depend on the live Location footer or lore keys, so approaching or re-entering Thornbrook (or any already-mapped site) no longer looks unmapped. `DUNGEON_REALITY` is still attached only while the footer matches. Reset a stored narrator Persistent Maps section to pick up the skip rule.

## [8.27.0] - 2026-08-19

### Changed
- **Map Architect moderate threat wording**: MODERATE sites now use stronger occupancy and hazard guidance. Untouched saved defaults are migrated automatically; customized prompts are preserved.

## [8.25.0] - 2026-08-19

### Added
- **Lorebook Agent map delete**: the cyan MAP chip on a mapped Location root now has an **X** that strips only `[MAP]` (CORE and the lore entry stay). Evolution trajectory for that site is cleared.
- **On-demand map from a location root**: unmapped Location roots show a muted **+ MAP**. **Auto** spends one Map Architect turn to fill entrance, kind, scale, threat, and premise from the location lore plus recent story, then generates the private `[MAP]`. **Manual** is the same fields in a small form. A sticky **Generating a location map** toast stays up until success or failure. No narrator turn, no CYOA, no chat injection. The live location footer is not required for this explicit request.
- **Add mapped location**: the Locations header has **Add mapped location** when Persistent Maps is on. **Auto** takes a name, an optional brief, and story lookback (0 = no chat) and fills the rest. **Manual** is name plus map fields; extra keywords are optional. The location name is always added as a keyword. Existing roots still use **+ MAP**.

### Changed
- **Map Architect reciprocal routes**: the prompt now says to write each connection detail once and copy that exact string onto the reverse (no eastward/westward rewrite). Architect also copies the first-seen detail onto matching reverses before validation, so this mismatch no longer burns a correction pass. Reset a stored Map Architect prompt to pick up the wording.

## [8.10.1] - 2026-08-18

### Changed
- **Map scale**: the GM opener now treats SETTLEMENT maps as the city/town as a whole (district-scale). Alleys, houses, shops, rooftops, and streets are not mapped sites. Wilderness, roads, countryside, and other places between maps are not mapped. A building gets a DUNGEON map only when that building itself is a high-risk dungeon, ruin, lair, or trapped complex. The occupancy-lag caution is gone from the narrator Persistent Maps section (Map Updater runs every turn). Reset a stored narrator Persistent Maps section and Map Architect prompt to pick up the wording.

## [8.10.0] - 2026-08-18

### Added
- **Map node occupancy icons**: Visuals/Map room nodes show characteristic kind art under the label for known (and suspected) assets — creature, pack, trap, hazard, alarm, barrier, effect, loot, object (`src/ui/SVG`). Live traps render as `TRAP_ARMED`; a neutralized mechanism renders as `TRAP_DEACTIVATED`. Reveal All still shows unrevealed occupancy as faded icons.

### Changed
- **Visuals/Map orange/black**: room nodes, connectors, and the Visuals/Map tab use the same `#ffaa00` highlight as character-sheet numbers, on near-black fills. The current room is an orange stroke with orange type; the active Visuals/Map toggle is an orange chip with black type. Occupancy art uses a warm amber/gold/bronze set so kinds still read apart without neon fills.
- **Asset state `DEACTIVATED`**: canonical "switched off" state for traps, alarms, and similar mechanisms. `DISARMED`, `INACTIVE`, and `PACIFIED` are accepted aliases and stored as `DEACTIVATED`. Map Evolution cannot reverse it, same as the old `DISARMED` lock. Reset stored Map Architect / Map Evolution prompts to pick up the new wording.

## [8.1.3] - 2026-08-18

### Fixed
- **Main prompt backup**: the original Quick Prompt Main is now snapshotted from Prompt Manager (not only an empty/unhydrated textarea) *before* the framework overwrites it, then mirrored to a browser-local backup that cannot be cancelled by a settings.json save or wiped by turning the tracker/extension off. Disable (⏻) restores that copy even when Quick Prompts is closed, and a later re-enable will not replace a real user backup with the D&D narrator prompt or an empty string.

## [8.1.2] - 2026-08-18

### Changed
- **Map Evolution GM briefing**: material commits are no longer capped at two or three. Settings → Persistent Maps → Map Evolution has a **GM material-commit ceiling** (default 2000 tokens, ~8000 characters) for how much Map Evolution memory — recent material commits for the current site — is transferred to the narrator. Newest complete commits fill that budget; the latest commit is never sliced. Commit summaries no longer repeat the site name — they are only shown inside that site.

## [8.1.1] - 2026-08-17

### Fixed
- **Lorebook Agent hex/font colors**: Full Audit no longer strips `<font color=#RRGGBB>` tags down to plain text. Chat cleaning keeps those tags, re-recorded `[CORE]` blocks restore color-bearing fields, and Direct Prompt JSON with `color="#hex"` is repaired so the commit is not dropped. NPC Full Cards render the font tags as color.

## [8.1.0] - 2026-08-17

### Added
- **Map Evolution LOD timers**: a **Current map** interval beside the existing other-maps interval, plus optional per-map hours on the mapped-site list. Blank inherits; `0` skips automatic ticks for that site. Evolution's prompt and operations are unchanged — presence only chooses the clock. The site list splits **Run now** (checkbox) from **Per-map interval** (optional override); inherit is labeled, not pre-filled as `12`.

## [8.0.10] - 2026-08-17

### Added
- **Site threat** (`LOW`, `MODERATE`, `HIGH`, `DEADLY`) on `CreateAreaMap` and `[CREATE_AREA_MAP]`: occupancy and trap density for Map Architect. Independent of scale (size) and never matched to party level. Dungeons default HIGH; settlements default MODERATE. Existing maps without a threat field keep working.

### Changed
- **Map Architect opener** also appears under Narrator Configuration → Components (and onboarding) when Persistent Maps is enabled, in addition to Settings → Persistent Maps → Map Architect.
- **Text-command opener + CYOA**: the narrator is told not to append CYOA choices on the `[CREATE_AREA_MAP]` command turn; choices resume after the map exists.
- **Text-command opener parsing**: `name` / `footer_root` aliases and prose scales such as "Small-to-medium" are accepted, and a `[CREATE_AREA_MAP]` fence runs Map Architect whenever Persistent Maps is on.

### Fixed
- **Persistent Maps multilingual identity**: `site` must be a verbatim Location footer segment (not a translated/retitled English name). Map Architect is told to write human-readable labels in the campaign language. A new map whose root cannot match the live footer is rejected instead of creating an orphan Location entry.
- **Text-command opener handshake**: `[CREATE_AREA_MAP]` is scanned before State Tracker gates, including regenerate/swipe turns, with `MESSAGE_RECEIVED` and chat-load catch-up so SillyTavern cannot eat the fence before Map Architect runs.
- **Continue-after-map ramble**: leftover assistant reasoning is cleared, the continue stub is a short in-world line instead of an empty/ZWSP resume, and the private continue brief is not a second full map dump.

## [8.0.3] - 2026-08-17

### Added
- **Persistent Maps text-command opener**: Settings → Persistent Maps → Map Architect can use **Text command** instead of `CreateAreaMap` when function calling is unavailable. The narrator emits `[CREATE_AREA_MAP]...[/CREATE_AREA_MAP]` and stops; Map Architect runs, the fence is stripped, and narration continues from the entrance. The tool-call opener remains the default.

## [8.0.2] - 2026-08-17

### Changed
- **Context Debugger** is a wand-menu item (**Multihog Context Debugger**), not a tracker-header button. It logs the last 10 Tracker, Map Architect, and Map Evolution request/response pairs so streamed replies can be inspected without relying on the SillyTavern server console. Prompt and reply blocks start collapsed; expand one, or use the header expand/collapse-all controls. The overlay window is the only scroller.

### Fixed
- **Context Debugger window scroll**: the card list now scrolls inside the overlay. Inner prompt boxes no longer have their own scrollbars, so the mouse wheel is not trapped.

## [8.0.1] - 2026-08-17

### Fixed
- **Long Map Architect / Map Evolution / State Tracker jobs**: those requests now stream so OpenRouter, nano-gpt, and similar gateways cannot idle-cut the HTTP wait at ~60s and then drop a reply the model already finished. There is no Multihog generation timeout setting.

## [8.0.0] - 2026-08-17

### Added
- **NPC/PC Library**: bookmark campaign NPCs and Player Cards into a global library that is not tied to a chat. Cards are role-agnostic: a saved PC can later be an NPC, and vice versa. Packages are `.mnpc.json` files with an optional embedded portrait; the library stores portraits as files, not in settings.json.
- **NPC/PC Manager**: labeled control on the NPCs header in Campaign Records (Library, From Card, Freeform, Archetype). The CHARACTER header control is labeled **Create PC Card**.
- **Library actions**: Full Card, Fit into Story, **Add as is**, **Play as PC** (installs the Player Card and asks the State Tracker to swap `[CHARACTER]`), **Add to Party** (`(Name joins the party.)` Direct Prompt), export, and delete.
- **Library Full Card**: same CORE layout as the campaign card, with a Library badge and keywords. **Edit Text** saves back to the library. Click the portrait to replace, generate, crop, or clear it (library storage only). No relationship bars or AI edit.

### Changed
- Library cards store CORE identity, keywords, and portrait only — not campaign relationship numbers, chronicle, or dynamic lore. Existing library entries are cleaned the next time the Library tab opens.
- Library rows: a square portrait matching the action-stack height, appearance plus personality blurb, and a gold scrollbar matching the Full Card button.

## [7.99.3] - 2026-08-17

### Changed
- **Visuals/Map details control**: the ALPHA note next to Site map is replaced with a labeled **Map Details** button that opens the site inspector.

### Added
- **Testing Ground undo/redo**: after Evolve this map now or Simulate ticks, Undo last pass restores the map, `[TIME]`, Last Evolved clocks, and Evolution memory to immediately before that run. Redo last pass restores that snapshot and runs the same pass again.

## [7.99.2] - 2026-08-17

### Changed
- **Map Evolution thread closures**: return to baseline (customary patrol, settled vigil, going home to forage after a disturbance) is `resolved`, not a new OPEN thread. Omitted `thread_status` still defaults to open, so the prompt now requires setting resolved/transformed explicitly. Custom stored Evolution prompts lag until reset; the per-request causal-thread contract is live immediately.

## [7.99.1] - 2026-08-17

### Changed
- **Map Evolution social life**: co-located groups are not assumed to be enemies. Hostile dungeon occupants may hang around, talk, or cooperate. Occupants may pursue ongoing *projects* that fit their archetype (a bone-ward, a warren shoring, a harvest). In-place `SET_ASSET` detail is real activity. Custom stored Evolution prompts lag until reset or the prompt-defaults dialog; the per-request time-scale contract and Living Occupants snapshot are live immediately.

## [7.99.0] - 2026-08-17

### Changed
- **Onboarding help**: Need Help is its own section with a numbered list — embedded getting-started video, clickable Adventure Companion (opens CHAT), and SillyTavern Discord. How It Works now covers Auto-Tracking through Map Evolution without mixing in help copy.
- **Onboarding Setup Guide**: Initial Setup now starts with Function Calling (Persistent Maps + Hybrid RNG), then connections, empty narrator card, and character creation.

## [7.98.2] - 2026-08-16

### Changed
- **Map Evolution occupancy tempo**: independent occupants may all act, but they do not have to. Staying put is valid when that makes sense. A lone patrol commute as the entire tick is still discouraged. Custom stored Evolution prompts lag until reset or the prompt-defaults dialog; the per-request time-scale contract is live immediately.

## [7.98.1] - 2026-08-16

### Fixed
- **Map Evolution History scrolling**: the site inspector popup now allows vertical scrolling, so the History list is no longer clipped by SillyTavern's `overflow: hidden` dialog body.
- **GM Evolution commits are no longer mid-cut at 600 characters**: material-commit summaries keep every operation in the tick. The narrator briefing prefers fewer complete commits over three truncated ones.

## [7.98.0] - 2026-08-16

### Added
- **Map causality**: every material map operation now requires a concise in-world `cause`. Transitioning an asset into `DEAD` or `DESTROYED` also requires `actor` (`party`, an existing asset id, or a short off-map name). The extension stamps `changed_at` from `[TIME]`. Occupancy `detail` stays the current fact; cause/actor/since are why, who, and when.
- **Causal thread ledger**: attributed map writes become per-site open/resolved/transformed threads (`mapEvolutionThreadsBySite`). Map Evolution receives **OPEN CAUSAL THREADS** so third-party kills, party kills, and occupations can continue as plot rather than disappearing into occupancy notes.
- **GM site-activity briefing**: while inside a mapped site, DUNGEON_REALITY includes a compact Recent site activity block (open causal threads, recent complete material Evolution commits, current DIGEST rows) so occupancy makes sense without dumping the Evolution ledger. Per-asset Cause / Actor / Since remain the latest coupling for that entity.
- **Evolution history compression**: after each Map Evolution pass, closed-thread history is measured (~4 characters per token). If it meets the **user-settable token threshold** (default **10,000**), a second API call compresses resolved/transformed events and prior digests into compact summaries. **Currently open threads stay verbatim.** Settings → Persistent Maps → Map Evolution: enable, threshold, and compression prompt.
- **Asset `count`**: optional living-member integer (1–99) on map assets. Packs, patrols, garrisons, and swarms are one `GROUP` with `count`; named individuals stay `CREATURE`. `SET_ASSET` can reduce or restock count. `0` is invalid — use `DEAD`/`DESTROYED`.
- **Map Evolution Testing Ground**: a sandbox (`map-evolution-debug.js`) for balancing without playing. Advance or set in-world time, spawn or kill entities with cause/actor, evolve one map, or simulate up to 20 ticks. Entry points: Settings → Persistent Maps → Map Evolution, the Lorebook Agent Map Evolution drawer, and the map inspector. Includes asset arcs, a memory inspector, Clear evolution history, and a scrolling threads/assets history.
- **Remembered Reveal All**: the map inspector's Reveal All toggle persists per chat, fully reveals Visuals/Map (not only the inspector lists), and the inspector shows the site graph below Map Entries / Raw JSON.

### Changed
- Map Updater and Map Evolution prompts require cause (and actor on deaths) and prefer one pack asset over many identical singleton creatures. Custom stored copies lag until reset or the prompt-defaults dialog.
- **Map Evolution tempo**: hours elapsed with several living groups should emit several operations in one transaction, not one patrol commute. Co-located competing groups are told to interact. The Evolution snapshot now lists **LIVING OCCUPANTS** (with `same-room=` crowding).
- Evolution now receives the full stored thread ledger (cap raised to 400 events) so the token threshold is the limiter, not a 16-entry prompt slice.

### Fixed
- **Map Evolution History**: the site inspector now reloads occupancy and the Evolution backlog after Testing Ground closes. Sandbox spawn/kill writes are recorded in that backlog, so History matches the map changes made in Testing Ground.
- **Testing Ground history list**: attributed events are no longer capped at the last 8 in the UI. The threads/assets columns grow with the stored history and the popup scrolls, instead of clipping older ticks in a short pane.

## [7.95.4] - 2026-08-16

### Fixed
- **New NPC cards missing from the prompt until Activate / Refresh Manifest**: Add NPC now records the book on `campaignBooks`, writes ST's world-info cache, and persists settings so the next generate can inject the card. Agent-owned lore injects even when Native Keyword Activation is on (or the user message has no extractable text), instead of listing the NPC only in `[NPC_RELATIONS]`. The keyword scanner unions the ownership list with the in-memory registry so a newly created NPCs book is not skipped. A full manifest refresh copies disk-fresh entries back into ST's cache.
- **Present Now empties on user turns**: the Visualization Present Now list scans only the latest narrator/assistant message. Player inputs are skipped so a turn that does not name NPCs no longer clears the tiles between replies.

## [7.95.3] - 2026-08-16

### Changed
- **Tutorial video**: startup page and README now point to the current getting-started video.

## [7.95.2] - 2026-08-16

### Added
- **Buy Me a Coffee**: donation button on the startup page (top right).

## [7.95.1] - 2026-08-16

### Fixed
- **Map Updater party filter**: occupancy now receives a names-only `[PARTY]` roster and is told not to `ADD_ASSET` those people. Matching adds are rejected on correction.

## [7.95.0] - 2026-08-15

### Added
- **Lorebook Agent Map Evolution drawer**: ON/OFF, last/next evolution, interval, maps-per-tick scope, Evolve Now, and Reset Timeline sit above World Progression and stay synced with Settings.
- **World Progression locations-per-report**: the agent drawer can set how many location dossiers each report covers.
- **Persistent Maps + World Progression**: Map Evolution is the compatibility layer. Reports stay location-scale prose; maps realize them lazily. The older “do not use both” warning is retired.

### Changed
- **Map Evolution defaults**: interval is 12 in-world hours; automatic scope is every due mapped site. Map Architect, Map Updater, and Map Evolution output budgets default to 25000 tokens.
- **Map inspector Run Now**: the site-scoped Map Evolution button sits beside Evolution History as a horizontal control.
- **CYOA Mode**: shipped choices must not invent map obstacles (locked doors, traps, barricades) that are not already on an attached site map.
- **Location-centric World Progression**: WP rotates complete readable location dossiers and Wider Currents, strips `[MAP]`, and treats named entities as constraints rather than simulation subjects.
- **Lazy report realization**: World Reports no longer fan out into an immediate all-map Evolution pass.
- **Macro-only World Skeleton**: skeleton generation creates locations, factions, and conflicts only. Legacy skeleton NPC entries remain on disk but are ignored.
- **Per-location Evolution backlog** and **unified map inspector** as previously described in the 7.86 line.

### Fixed
- **Upgrade migrations**: Keyword Overflow 0→6, Max Active Keys 8→12, and Map Architect token flooring are one-time flags that are *not* seeded in defaults, so existing 7.82 chats actually receive them. After that pass, 0 / 8 / a lower token budget remain valid explicit choices.
- **World Progression map isolation**: hidden `[MAP]` JSON cannot enter the WP prompt.
- **Map Evolution time scale**: each site request uses that map's own Last Evolved clock and accumulated backlog.

## [7.86.2] - 2026-08-15

### Fixed
- **Keyword Overflow / Max Active Keys upgrade**: the one-time 0→6 and 8→12 raises now actually run for existing chats. The previous flags were seeded `true` from defaults, so saved 0/8 never changed. After this pass, setting 0 or 8 again is kept.

## [7.86.1] - 2026-08-15

### Changed
- **Persistent Maps (Alpha)**: the Components toggle is renamed from Location Mapping (Alpha). The internal `<dungeon_reality_and_hidden_mapping>` tag is unchanged.
- **Keyword Overflow Cap**: default is now 6 (was 0 / no cap). Existing chats still at 0 are raised once; you can set 0 again afterward for no cap.
- **Max Active Keys**: default is now 12 (was 8). Existing chats still at 8 are raised once; you can set 8 again afterward.

## [7.86.0] - 2026-08-15

### Changed
- **Map Evolution Run now**: the checklist and **Evolve checked maps now** live in their own always-visible section. Interval **Selected maps** still uses those checks for automatic ticks, but you no longer have to pick that option to run evolution manually.
- **Map Evolution MOVE_ASSET schema**: the shipped prompt now shows `to`/`from` (never `location`) and a move example. Correction retries also repeat that field reminder. Reset the Evolution prompt in settings if you still have an older copy.
- **Map Evolution schedule**: Last Evolved / Next Scheduled, Override, and Reset Timeline match World Progression. Next is the soonest per-site interval due; Override stamps every mapped site so the next tick fires at the chosen in-world time.

## [7.85.0] - 2026-08-15

### Changed
- **Persistent Maps settings**: the left-rail section is renamed from Map Architect. Map Architect lookback, tokens, and prompt live in their own nested drawer beside Map Updater and Map Evolution.
- **Map Architect max tokens**: saved values below 25000 are raised once to match Map Updater / Map Evolution. After that one-time floor, you can lower the budget again.
- **Separate map connections**: Map Architect keeps its own connection for the foundation pass. Map Updater and Map Evolution share a second connection so occupancy and off-screen change can use a cheaper model. Existing chats copy the current Architect connection onto that new slot once, then the two can diverge.
- **Map Evolution stance**: off-screen map change is primary. World Progression is optional macro flavor, not a permission gate. Dungeons may restock from rival adventurers, scavengers, or anyone the site could attract — not only the original faction. Settlements may evolve as ordinary civic occupancy or unrest; neither is preferred. Changes must still make logical and narrative sense for the site.

## [7.84.0] - 2026-08-15

### Added
- **Map Evolution on demand and tick scope**: the play-menu Map Evolution item opens a map picker (All / None / Current) and evolves the chosen sites immediately. Interval ticks can stay on the current map, take **N** due maps (0 = all due), evolve **every** due map, or use a **selected** checklist. Randomize is on by default; turn it off to prefer the oldest-due maps. World Progression grounding is unchanged and still follows report mentions, not the tick count.

## [7.83.0] - 2026-08-14

### Added
- **Map Evolution**: a dedicated off-screen map pass (own `.js`, own prompt, own in-world interval) that is never mixed into Map Updater occupancy. After World Progression, it grounds named report outcomes onto matching maps **one site at a time**. Interval restlessness can move/restock entities outside the player bubble; play-established deaths stay dead. Settings live under Map Architect → Map Evolution; the Lorebook Agent play menu has a third item.

### Changed
- **Map Updater / Map Evolution max tokens**: default is now 25000 (same as Map Architect). The old 2500 budget was too small for a JSON map pass and killed the output stream. Saved 2500 values are upgraded automatically; the settings cap is 32000.

## [7.82.0] - 2026-08-14

### Added
- **Adventure Companion site map**: CHAT options and the Adventure Companion settings drawer can inject the currently active player-facing site map (same knowledge fog as Visuals/Map with Reveal all off) so the Companion can discuss exploration. Visited rooms include known contents; discovered names are outside-only; unrevealed rooms, traps, and occupants stay hidden. Injected lore also strips private `[MAP]` JSON.

## [7.80.0] - 2026-08-14

Public release of Location Mapping: dedicated Map Updater, settlement maps, ARCHIVE INDEX existence checks, and a Components kill switch that actually stops architect/updater API calls. See 7.50.14–7.50.30 for the stepwise notes.

## [7.50.30] - 2026-08-14

### Changed
- **Location Mapping (Alpha)**: the Components toggle is renamed from Dungeon Reality Mapping. It covers dungeons, ruins, towns, and cities. The internal `<dungeon_reality_and_hidden_mapping>` tag is unchanged.

### Fixed
- **Location Mapping disable**: turning the Components checkbox off now actually stops the stack — CreateAreaMap unregisters, in-flight Map Updater requests abort, and occupancy API calls are not sent. Unlocking the sysprompt section no longer greys out this kill switch.

## [7.50.29] - 2026-08-14

### Fixed
- **Map Architect "Use Current Settings"**: profile requests with an empty completion-preset override no longer send a bare Custom OpenAI payload (HTTP 404). The live SillyTavern completion preset is used when the connection profile has none, and the live endpoint URL is filled in as a fallback.

## [7.50.28] - 2026-08-14

### Changed
- **Lorebook Agent existence checks**: ARCHIVE INDEX is treated as the complete catalog (now includes Book::UID). The agent is told not to `grep_lore` / `inspect_book` to verify whether a name exists; absence means record it. Concatenated name-dump greps are rejected with that hint.

## [7.50.27] - 2026-08-14

### Fixed
- **Site map current-area highlight**: a footer interior that is an occupying asset (chapel, inn) or a breadcrumb tail above a matching district now highlights the host district. The graph no longer falls back to the entrance when the leaf is not itself an area.

## [7.50.26] - 2026-08-14

### Changed
- **Map Architect prompt examples**: the shipped architect prompt now includes truncated valid DUNGEON and SETTLEMENT JSON (reciprocal routes, LOCKED passages, INITIAL_MAP assets, chapel as a district OBJECT not an area). Reset the Map Architect prompt in settings if you still have an older copy.

## [7.50.25] - 2026-08-14

### Changed
- **Map Updater prompt examples**: the shipped occupancy prompt now includes compact valid JSON for noop, ADD_ASSET (chapel + occupant), and SET_ASSET, plus a note not to use `{type, asset:{...}}`. Reset the Map Updater prompt in settings if you still have an older copy.

## [7.50.24] - 2026-08-14

### Fixed
- **Wrapped ADD_ASSET operations**: Map Updater accepts `{type:"ADD_ASSET", asset:{...}}` and flattens it to `{op, name, kind, ...}` instead of burning correction retries on `type` vs `op` and a nested `asset` object.

## [7.50.23] - 2026-08-14

### Fixed
- **Chronicle `area` alias**: Map Updater chronicles that send `area` instead of `area_id` are accepted instead of forcing a correction retry.

## [7.50.22] - 2026-08-14

### Fixed
- **Manual Map Updater lookback**: Play-button Map Updater runs now use the Lorebook Agent lookback (last N user turns) instead of the since-last-run watermark. After an auto-run on the same turn, a manual pass no longer sends empty RECENT STORY. A settlement footer interior that is not yet an OBJECT asset is called out so the model cannot noop it away.

## [7.50.21] - 2026-08-14

### Changed
- **Map Architect max output tokens** now default to **25000** (UI still clamps 1000–32000). Existing saved values are kept; only new installs and reset-to-default pick up 25000, so long maps are not truncated after the generation cost is already paid.

### Fixed
- **Map Updater Stop + Lorebook Terminal**: occupancy updates now share the Lorebook Agent terminal and Stop button. Stop appears only after an active map is confirmed (auto-ticks outside a mapped site no longer flash it). Cancel aborts the in-flight request. Occupancy finishes still refresh Campaign Records but do not trigger NPC portrait auto-generation.

## [7.50.20] - 2026-08-14

### Changed
- **Run Research Now** on the Lorebook Agent header expands into a choice: **Lorebook Agent** (NPC/location/relationship records) or **Map Updater** (dungeon and town occupancy). Map Updater can be run by hand even when its auto cadence is off.

## [7.50.19] - 2026-08-14

### Changed
- **Map Updater is separate from Lorebook Agent**: Dungeon and settlement occupancy updates no longer ride on the Lorebook Agent pass. A dedicated Map Updater (Map Architect connection, compact JSON, default every turn) maintains `[MAP]`. Lorebook Agent keeps NPC/location/relationship records on its own cadence and no longer receives `inspect_map`, `commit.map`, or `[MAP_COMMIT]`. The agent panel has **Map every:** next to **Run every:**.

## [7.50.18] - 2026-08-14

### Fixed
- **Map commit bounce on omitted evidence**: ADD_ASSET without `evidence` no longer rejects the whole Lorebook Agent commit. Missing evidence defaults to CONFIRMED. `kind: NPC` (and PERSON/CHARACTER) is stored as CREATURE, so a chapel+priest settlement commit can land instead of retrying until the model hangs.

## [7.50.17] - 2026-08-14

### Changed
- **Settlement interiors in the footer**: When the party enters a chapel, inn, shop, or similar invented interior, the GM Location footer must append that building (city, district, interior) instead of stopping at the district.
- **Lorebook Agent settlement interiors**: On SETTLEMENT maps, an interior the party actually enters is recorded as a KNOWN OBJECT asset in that district. The agent uses the latest narration, not only the status footer, so a missing third footer segment no longer skips the chapel.

## [7.50.16] - 2026-08-14

### Fixed
- **Map Architect on Connection Profiles**: CreateAreaMap no longer sends a provider-level JSON schema through Connection Profile / Ollama / OpenAI-compatible connections. Those schemas 404 on many chat-completion backends. Main API already skipped them; the architect still parses and validates the raw JSON itself.

## [7.50.15] - 2026-08-14

### Changed
- **Dungeon map GM leeway**: Room-scale dungeon maps are preferred canon, not a hard ban. The narrator may add a room or incidental feature if play naturally requires it, so long as it does not contradict established map facts.

## [7.50.14] - 2026-08-14

### Changed
- **CreateAreaMap**: The Map Architect tool is now `CreateAreaMap` (was `CreateDungeonMap`). It accepts `kind: DUNGEON` for room-scale interiors or `kind: SETTLEMENT` for district-scale towns and cities. Settlement maps stay macroscopic; the GM may invent granular interiors that do not contradict those districts.

## [7.50.13] - 2026-08-14

### Changed
- **Map Architect hubs**: The architect prompt now says occasional hub/nexus layouts are welcome — one area may have many routes instead of forcing a linear chain.

## [7.50.12] - 2026-08-14

### Changed
- **Map Architect density**: The architect prompt no longer says to skip incidental objects. It now tells the model to populate furnishings, clutter, tools, loot, and hazards on the initial map instead of leaving it sparse for later invention.

## [7.50.11] - 2026-08-14

### Changed
- **Dungeon map lag note**: The narrator now treats established story events as overriding a lagging map (a killed enemy stays dead even if still listed ACTIVE), instead of treating the latest DUNGEON_REALITY occupancy as catch-up truth.

## [7.50.10] - 2026-08-14

### Changed
- **Map Architect settings tab**: Map Architect now has its own left-rail settings section, directly below Lorebook Agent, matching World Progression and Adventure Companion.

## [7.50.9] - 2026-08-14

### Added
- **Settings search**: The floating settings window has a keyword search that filters nested drawers across tabs.

### Changed
- **Dungeon map lag note**: The narrator `<dungeon_reality_and_hidden_mapping>` prompt now says the attached map may lag a few turns behind play due to update frequency.

## [7.50.8] - 2026-08-14

### Fixed
- **Tracker snapshot map rollback**: The State Tracker `[ LIVE ]` arrows now roll dungeon-map occupancy back with the memo. Each tracker snapshot stores the current `[MAP]`; viewing or restoring a previous stone writes that occupancy back, and returning to LIVE restores the map that was live when you started browsing.

## [7.50.7] - 2026-08-14

### Changed
- **Dungeon map combat granularity**: Lorebook Agent map commits now treat `[MAP]` as lasting occupancy, not the current combat beat. Transient targeting, poses, HP, and conditions such as frightened stay in the combat tracker.

## [7.50.6] - 2026-08-14

### Fixed
- **Branch Campaign keeps relationship stats**: Friendship/affection values and their change logs are now saved with the chat, copied onto the branch, and remapped to the cloned lorebook names. A branch no longer resets every NPC to 0.

## [7.50.5] - 2026-08-14

### Changed
- **Companion documentation**: Tutorial Mode's framework doc now covers Dungeon Reality Mapping — Map Architect, `[MAP]` storage, Visuals/Map vs the GM MAP badge, knowledge fog, and function-calling requirements.

### Fixed
- **Visuals/Map on first boot**: The Campaign Records / Visuals/Map switch is probed as soon as the panel is built, so a mapped site can show the tab without turning on location images or Real-Time Visualization.

## [7.50.1] - 2026-08-14

### Changed
- **Draggable site graph**: Dragging the Visuals/Map graph pans the view instead of selecting text. Revealed rooms still open on click.
- **Site details from Visuals/Map**: The list button next to the graph opens the readable map (rooms, geometry, routes, and assets). Unrevealed rooms and assets stay hidden unless **Reveal all** is turned on. The Lorebook MAP badge remains the full GM inspector, including Raw JSON.

## [7.50.0] - 2026-08-14

Dungeon Reality Mapping is **alpha**. The mapped-site loop works in play, but expect sharp edges and keep backups of important chats.

### Added
- **Dedicated Map Architect**: The narrator can call a one-shot private agent with its own prompt, connection profile, model, preset, lookback, and output budget to create dangerous-site maps.
- **Initial-map validation and correction**: New maps are checked for valid JSON, exact site/entrance identity, scale, stable IDs, asset references, reciprocal passage details, and a fully connected physical graph. Invalid output receives up to two correction passes and is never partially saved.
- **Visuals/Map site graph**: While inside a mapped dungeon, Visuals/Map shows a knowledge-filtered node graph (visited rooms named, discovered rooms dim, unrevealed neighbors as unlabeled stubs). It can be popped out into its own window. The Lorebook MAP badge remains the private GM inspector.

### Changed
- **Lightweight narrator contract**: The full map-authoring specification is no longer carried in every GM prompt. A short `CreateDungeonMap` contract replaces it, while the dedicated agent stores validated JSON directly in the root Location entry and returns compact prose to the narrator.
- **Visuals/Map rename**: The Lorebook Agent **Visualization Mode** tab is now **Visuals/Map**. Real-Time Visualization Mode (scene-art generation) keeps its settings name. The Campaign Records / Visuals/Map switch appears when location images are on or the party is inside a mapped site.

### Fixed
- **Site map connectors**: Connection lines now stop at each room’s border instead of running through node labels.
- **Mapped-site activation**: The site map follows whole location segments, so a nested dungeon such as `Whispering Woods, Forgotten Tomb` stays active, while a nearby place that only mentions the site (`Forest Near the Hall of the Ember-Ancestors`) does not.
- **Map Architect progress feedback**: A persistent toast now indicates when a location map is being generated, then reports completion or failure when the tool call ends.
- **Reliable Map Architect tool calls**: Main API map creation now reads the untouched provider response, bypassing both unsupported provider-level JSON schemas (`Bad Request`) and SillyTavern dialogue cleanup (`No message generated`). Connection Profile, Ollama, and direct OpenAI-compatible modes retain structured-output support.
- **No immediate retry loops**: Architect transport, configuration, validation, and persistence failures are now real tool errors. The narrator remains outside the site and must not retry the tool during the same turn.

## [7.25.1] - 2026-08-13

### Fixed
- **Safe campaign cloning**: Clone Stack and Branch Campaign now abort before writing when a destination lorebook already exists, preventing whole-book overwrite and cleanup of pre-existing books.
- **Chat-scoped Lorebook Agent history**: Undo and redo now operate only on the active chat, preserve other chats' history, reject mismatched redo snapshots, and follow safe chat renames.

## [7.25.0] - 2026-08-13

### Changed
- **Optional Instant Action starter message**: A **Send Starter Message?** checkbox sits below Player Card length. It is on by default so Instant Action still opens the campaign automatically; uncheck it if you want to type your own first action.

### Fixed
- **Instant Action honors Initial Setup level and class**: A requested level such as "A level 7 ranger" now overrides the Other Ways level dropdown. The prompt no longer forces `STARTING LEVEL: 6` as mandatory when Initial Setup asked for a different level, and the random archetype is treated as a fallback when a class is specified.

## [7.20.1] - 2026-08-12

### Changed
- **Optional Instant Action names**: A rolled or typed name is no longer required. Leave the name blank and the AI chooses one; the roll button remains available as an option.
- **Instant Action Player Card length**: Quick Start now offers preset and custom word counts from 50–5000 words.

### Fixed
- **Initial Setup reaches the Player Card**: Character details, setting, premise, and tone are now passed to Player Card/persona generation as well as the state memo creator and opening narrator message.

## [7.20.0] - 2026-08-11

### Changed
- **Initial Setup label**: Instant Action guidance is labeled `Initial Setup:` in the character-generation prompt and opening adventure message.

## [7.10.6] - 2026-08-11

### Added
- **Instant Action instructions**: Quick Start now has an optional guidance box for character details, setting, premise, or tone. Specified details override rolled defaults, and the same guidance is included with the opening `Begin the adventure` message so the narrator starts in the requested scenario.

## [7.10.5] - 2026-08-11

### Fixed
- **First-pass Lorebook Agent undo**: The initial generated campaign can now be undone to a true empty baseline, with complete metadata restoration and lossless redo state.
- **Rollback display consistency**: Undo, redo, and manual refresh now read authoritative lorebook data from disk instead of reviving deleted entries from historical logs or SillyTavern's stale cache.

## [7.10.4] - 2026-08-11

### Changed
- **Removed Barnaby few-shot**: The Lorebook Agent Basic Mode no longer injects the hardcoded `{{example}}` / Barnaby sample NPC that was overriding word-target instructions.
- **Editable runtime prompt fragments**: Combat Profile guidance, auto/manual pass restrictions, existing-NPC chronicle nudge, and relationship-section wording are now editable templates (Lorebook Agent → System Prompt → Runtime Prompt Fragments) instead of hardcoded router strings.
- **NPC word targets are overall totals**: Major/Minor NPC targets now mean "exactly N words across the whole [CORE] block" (matching PC framing), not per-section minimums. Existing installs are rescaled by section count (defaults 225 / 135).

## [7.1.52] - 2026-08-09

### Changed
- **Worn Equipment**: Renamed the Lorebook Agent CORE field from Equipment to Worn Equipment (and clarified prompts) so LA treats it as visibly worn/carried gear — not coins, loot piles, or inventory lists. Legacy `Equipment:` headers in existing entries still patch in place.

## [7.1.51] - 2026-08-09

### Fixed
- **CHAT-BOUND Game Systems on new chat**: Unseen chats with Chat Link + Lock Control Room no longer keep previous-chat CHAT-BOUND activations enabled. Catalog items deactivate for the new chat; GLOBAL enablement and inherited Narrator Configuration stay intact.

## [7.1.50] - 2026-08-09

### Added
- **Dungeon Reality Mapping (Experimental)**: New native `<dungeon_reality_and_hidden_mapping>` sysprompt section (below `<constraints>`) that builds a full hidden location map before high-risk exploration and resolves traps, stealth, and enemies against it. Toggleable under Components; on by default.
- **XP rule**: Do not award XP as a consequence of a failed check.

### Changed
- **Settings overlay appearance**: Defaults to Light on first boot.

## [7.1.35] - 2026-08-08

### Added
- **Settings overlay**: Extensions drawer keeps a light Multihog stub with **Open Settings**; full settings open in a floating external window with a left tab rail (General, Connections, Game Systems, State Tracker, Lorebook Agent, World Progression, Adventure Companion). Not a fullscreen takeover — centered/draggable panel with mobile safe-area sizing.
- **Settings window Dark / Light lock**: Appearance toggle at the top of General forces readable locked chrome so ST/tracker themes cannot wash out the settings menu. Defaults to Dark.
- **State Tracker settings shortcut**: Wrench button in the tracker header (left of CHAT) opens the settings overlay.
- **Critical settings WAL**: Browser-local backup for Display Groups and prompt-defaults acknowledgement so cancelled settings saves during reload are less likely to resurrect deleted groups or the upgrade dialog.

### Fixed
- **Prompt defaults fingerprint**: Shipped-default fingerprint no longer reads live user settings (e.g. relationship max / CORE sections) via module getters, which could false-trigger Prompt Defaults Updated.
- **Settings overlay mobile layout**: Panel no longer spawns clipped above the viewport or collapses to a header-only strip.
- **Settings overlay readability**: Strengthened muted/inline-opacity description text in locked Dark/Light chrome.
- **Settings overlay background**: Removed probe for missing `assets/settings-bg.png` (kept SVG gradient only).

## [7.1.2] - 2026-08-08

### Changed
- **World Skeleton prompt**: Adds a procedural NPC naming rule with culture-matched construction and randomized first/last-name root macros so new skeleton NPCs avoid high-frequency placeholder names.

## [7.1.0] - 2026-08-08

### Added
- **Branch Campaign**: One-button pipeline under General & Visuals → Core & Branching that creates a SillyTavern transcript branch, deep-copies all Multihog per-chat data (memo, quests, portraits maps, setup, companion, etc.), clones the lorebook stack under the new chat’s sanitized prefix, then opens the branch — leaving the original chat intact.
- **Chat rename migration**: Listens for SillyTavern `CHAT_RENAMED` and moves Multihog `chatStates` (plus companion / memo-recovery maps) to the new chat file name so renaming a chat no longer looks like an empty campaign.

### Changed
- **Clone Stack**: Uses the shared lorebook clone helper; tip points users at Branch Campaign for the full automated branch.

## [7.0.14] - 2026-08-08

### Added
- **Lorebook Agent System Prompt Editor**: Exposed the stored Basic Mode prompt template and the Agent Mode base/shared-context templates in settings, with mode-aware reset controls. Dynamic request context and tool schemas remain generated at runtime.

### Changed
- **Game System Wizard UI Live Preview**: Added a read-only live rendering of the matching tracker sample block, including progress bars, custom markers, badges, and preview pagination controls. Edit the source block above it to update both the preview and saved template.

### Fixed
- **Lorebook Agent Prompt Updates**: Routed all four Lorebook templates through the normal prompt-fingerprint/update dialog, preserving custom prompts and cartridge backups until the user explicitly applies the update.
- **Lorebook Agent Prompt Runtime**: Dynamic module, relationship, campaign, activation-limit, and combat guidance now expands per request without rewriting stored templates or crossing Basic/Agent editor fields.
- **Lorebook Agent Prompt Whitespace**: Removed empty spacer lines from shipped templates and dynamic insertions.
- **Game System Wizard Preview**: Preview extraction now matches exactly what saving retains instead of rendering unrelated fallback blocks.

## [7.0.13] - 2026-08-08

### Fixed
- **Custom Module Editor**: Save/Delete after alt-tab (or any `saveSettings` → catalog sync) no longer targets an orphaned field object. Renaming a module ID could previously remove the live entry entirely; edits could silently fail to persist.

## [7.0.12] - 2026-08-08

### Changed
- **CYOA prompt**: clarify resource eligibility as >0 (not depleted) in TRACKER STATE 0 (Current).

## [7.0.11] - 2026-08-08

### Changed
- **CYOA prompt**: choices that spend a resource are only eligible when that resource is >0 in TRACKER STATE 0 (Current).

## [7.0.10] - 2026-08-08

### Changed
- **Quests sysprompt**: objectives must be multiple, obtainable, clear immediate goals whose completion can be determined — not long-term vague goals.

## [7.0.3] - 2026-08-08

### Changed
- **RNG explanation**: rewritten RollTheDice vs RNG Queue flow (pros/cons), plus how CYOA/combat close queue foresight — in the Narrator Configuration help popup and `docs/multihogDnDdoc.md`.

## [7.0.2] - 2026-08-08

### Changed
- **XP system**: `<xp_system>` now awards for real consequences (info/threat/option/obstacle/quest), scales to stakes, defaults to award when in doubt, and ties skill-check XP to DC / combat XP to challenge.

## [7.0.1] - 2026-08-08

### Changed
- **State memo inject**: every-turn TRACKER STATE 0 injection now uses a short `<state_memo>` preamble (resource availability / spend guidance) plus `## TRACKER STATE 0 (Current)`, instead of `### STATE MEMO (DO NOT REPEAT)`. Main system prompt `<state_memo>` wording is unchanged.

## [7.0.0] - 2026-08-08

### Changed
- **CYOA injection**: `<CYOA_mode>` is no longer written into Quick Prompt Main. When CYOA is enabled, the built CYOA block is injected every turn into the user-message core (with active narrative pacing tags), immediately above the RNG queue. Prior CYOA/pacing copies are stripped from older user turns first.
- **Narrative pacing tags**: mode instructions are nested as `<high_agency_mode_on>`, `<output_length>`, and `<slice_of_life_mode_on>` inside `<narrative>`, and the active tags are re-injected every turn with CYOA.
- **CYOA prompt**: removed the generic “USER-DEFINED: Use the exact complete choice text…” type line.
- **Prompt Defaults Updated**: fingerprint now includes runtime narrative pacing variants, the live CYOA builder block, and the context-inject contract so interceptor/builder changes surface in the upgrade dialog.

## [6.9.41] - 2026-08-07

### Fixed
- **Lookback Update**: explicit Last N messages (panel / `/statetracker lookback=N`) no longer ignored when “Since last user message” is enabled — that mode still applies to regular auto/manual updates only.

## [6.9.40] - 2026-08-07

### Fixed
- **Visualization Mode location resolve**: footer location text using em/en dashes (e.g. `Elderbough — Orra Venn's Workshop`) now tokenizes like `::` / commas, so hierarchical lore paths match instead of showing a duplicated unresolved label.

## [6.9.35] - 2026-08-07

### Changed
- **Quests sysprompt**: clearer accept/complete/fail markers, broader objectives, and difficulty/emergent-quest guidance.
- **Prompt order**: `<quests>` now sits above `<homebrew_and_custom_classes>`; Control Room order migrates for setups still on the old stock relative order (settings 5.5.16).

## [6.9.34] - 2026-08-07

### Fixed
- **Location Scene Prompt**: Portrait Prompt Library save/load now includes the Location Scene Prompt (and the present-NPC toggle). Previously only NPC/PC and Character/Party/Combat prompts were persisted, so loading a saved setup left Location Scene unchanged/stale.
- **Location Scene Prompt reset**: enabling Real-Time Visualization or toggling "Include Present NPCs" no longer force-overwrites a custom Location Scene Prompt — factory swap only happens when the current text is still a shipped default.

## [6.9.33] - 2026-08-07

### Changed
- **CYOA prompt**: nudge line now reads "Not every looking around needs to be an investigation check, but investigating something specific should be."

## [6.9.32] - 2026-08-07

### Changed
- **CHARACTER module toggle**: `[CHARACTER]` can now be turned off in Modules & Order like other stock modules (UI checkbox, State Tracker schema injection, and character-creation active blocks all respect `modules.character`). Default remains on.

## [6.9.31] - 2026-08-07

### Changed
- **CYOA prompt**: restored to the pre-discipline wording (removed the "DC only on concrete targets / vague scans = NORMAL" rule — it made the model too conservative and encouraged silent rolls without committing DCs in choice text). Matches the v6.9.22 CYOA/sysprompt text.
- **CYOA prompt**: added one soft nudge line — "Not every looking around needs to be an investigation check, but investigating something specific should be."

## [6.9.29] - 2026-08-07

### Changed
- **Unified RollTheDice**: the d20 tool can also handle percentage odds via `formula: "1d100"` + `compare: "lte"` (auto-inferred for pure d100 formulas). Global **d100 Mode** and `RollTheDiceD100` remain for percentage-based rulesets.

### Removed
- Upstream existence-check / risk-scale prompt machinery and the per-turn `EXISTENCE ROLLS (d100)` queue pool (too much prompt weight for the ROI).

## [6.9.28] - 2026-08-06

### Added
- **Species / Body / Equipment CORE split**: Lorebook Agent NPC/PC Core Sections replace the old combined `Appearance/Species` with Species (static), Body (lasting physical look), and Equipment (worn/carried gear). LA can sync PC Body/Equipment; automatic cadence passes may only touch Combat Profile via CORE tools (other identity fields require Direct Prompt). One-shot per-chat `[CHARACTER]` seed grounds first-pass Equipment. Prompt-defaults upgrade UI can reset NPC/PC Core Sections. Card-list synopsis + docs/tests included.

## [6.9.27] - 2026-08-06

### Added
- **Existence checks**: d20 RNG queues now include a short `EXISTENCE ROLLS (d100):` pool (3 values) for upstream "is there something at all?" rolls (traps/hazards, hostile presence, notable finds) before any detection/skill DC. New `<existence_checks>` sysprompt section with category-specific follow-ups (traps held until triggered; missed loot gone forever; enemies contextual, not auto-stealth). CYOA examples gain pure-percentage chance brackets plus a dungeoneering Example 3.

### Changed
- Removed stale embedded `<RNG_constraints>` text that banned queue use for traps/exploration (contradicted Pre-Seeded / existence-check design).

## [6.9.26] - 2026-08-06

### Changed
- **Tutorial docs**: First-Time Setup now recommends wiring Connections & Models to suitable components, and drops the redundant "Enable the framework" subsection.

## [6.9.25] - 2026-08-06

### Added
- **Full Review Mode**: optional State Tracker operating mode (checkbox under Enable State Tracker) that wholesale-replaces the Core Prompt and User Prompt Suffix with a built-in "dump every module with real content" prompt. Recommended for weaker/local models that struggle with delta-only tracking. Custom Core Prompt / suffix are preserved and restored when the toggle is off. Documented in the Adventure Companion tutorial docs as the go-to fix when running Gemma / Mistral Small / Qwen / Llama / Phi as the tracker.

### Fixed
- **Empty `[TAG]…[/TAG]` pairs polluting the memo**: `mergeMemo` now treats hollow empty blocks (e.g. `[PARTY]\n[/PARTY]`) as removals instead of writing them into the persisted memo — a common Full Review failure mode on weak models. The Full Review prompt also no longer forbids omitting inapplicable modules.

## [6.9.24] - 2026-08-05

### Fixed
- **"No message generated" / walled Direct Prompt & Character Creator requests**: the default (generateRaw) connection path now disables SillyTavern's `trimNames` cleanup. Previously, if a raw completion happened to start with `"{{user}}:"` or `"{{char}}:"` (very plausible for a full character sheet whose first line is the generated name — especially once Character Creator's "Create SillyTavern Persona" option sets `{{user}}` to that exact name), ST's core `cleanUpMessage` silently deleted the **entire response**, surfacing as an opaque "No message generated" error and blocking character creation / state updates.

## [6.9.23] - 2026-08-05

### Added
- **Sexual Orientation in Character Creator**: restored next to Age, with a help tip explaining it is needed for the relationship system and CYOA romantic options. Draft/prompt plumbing included.

## [6.9.22] - 2026-08-05

### Fixed
- **Combat Profile dumps whole [COMBAT] block**: Lorebook Agent guidance now requires one combatant's own stat block only — never the `COMBAT ROUND` header, side headers, or sibling combatants — with examples matching the real per-entity format.

### Changed
- **Level-up skill points**: `<level_up_protocol>` now includes `+[2+INT mod, min 1] Skill Pts → +1 each to that many Key Skills (cap: skill bonus ≤ level+3)`.

## [6.9.21] - 2026-08-05

### Added
- **Pin Lorebook Agent entries**: thumbtack pin on tree entries / NPC cards (and green Active Lore Keys pills) permanently activates an entry. Pins are exempt from budget counting, agent deactivation, and keyword auto-expire — handled in JS only, so the agent prompt is unchanged.
- **Modular Repertoire book-name labels**: stock modules now show the real lorebook category (e.g. `Locations (LOC)`) instead of only the prompt tag; custom tags show a live `→ ..._Bookname` preview matching the router's naming rule.

### Changed
- **`[CORE]` markers stripped for the GM/narrator**: lore injected into the narrator prompt no longer includes `[CORE]`/`[/CORE]` bookkeeping tags (a blank line keeps the permanent-vs-chronicle break). Stored lorebook content and the Lorebook Agent's own context still keep the tags.

### Fixed
- **Full NPC Cards broken**: restored the `renderRelTierDetailed` dependency wiring so opening a Full NPC Card no longer throws `ReferenceError`.

## [6.9.20] - 2026-08-05

### Fixed
- **{{user}} still literal in Lorebook Agent tree view**: the default expanded entry view (Permanent description + campaign history lines) used a separate rendering path that the 6.9.16 fix missed — it now also resolves `{{user}}`/`{{char}}` macros for display.

## [6.9.16] - 2026-08-05

### Fixed
- **{{user}} not substituted in read-only views**: the State Tracker sidebar (Character/Party cards, quest log) and the Lorebook Agent panel (NPC/Location summaries and campaign history) now resolve `{{user}}`/`{{char}}` macros for display. Stored memo/lorebook content and edit textareas still keep the raw macro, so renaming a persona doesn't desync history.
- **Redundant class/profession in Lorebook Agent entries**: the Lorebook Agent is now explicitly instructed to write the bare `{{user}}` macro in chronicle/history lines, never followed by a class, profession, title, or parenthetical.

## [6.9.15] - 2026-08-05

### Added
- **Initial campaign time**: Character Creator and Other Ways to Begin now let you set the starting time of day for the first `[TIME]` block (alongside Day 1/DD/MM/YYYY and 12h/24h), with the value persisted per chat and reformatted when the clock toggle changes.

## [6.9.10] - 2026-08-05

### Fixed
- **Character creation formatting**: always inject the live `[CHARACTER]` module schema into the system prompt so creation never free-forms fields when modules are off.
- **Abilities preference leak**: omit the Creator "Abilities" preference line (and hide the UI field) unless the `[ABILITIES]` module is enabled.
- **CHARACTER module toggle**: treat `[CHARACTER]` as mandatory in the Modules list so its schema cannot be silently disabled.

## [6.85.0] - 2026-08-03

### Added
- **Display Groups (BETA)**: globally bundle related tracker modules under a shared display-only header, with Stack and Tab Mode support, a dedicated manager, and safe opt-out behavior.

### Changed
- **State Tracker settings layout**: reorganized Advanced Options, module import/export controls, Display Groups, and custom bar animation settings into clearer drawers and controls.
- **Rendering polish**: centered selected drawer labels, compacted separately colored pill spacing, isolated marker colors from their preceding labels, and aligned custom key/value rows.

## [6.8.0] - 2026-08-03

### Added
- **Game System Wizard UI Live Preview**: generated tracker sample blocks now render through the real tracker renderer while editing, with working pagination and Full List controls for long blocks.
- **Shared Character Creation connection**: Character Creator, Instant Action, and Other Ways to Begin now use one configurable connection setting.

### Changed
- **Wizard preview controls**: persistent Category Rendering Options are hidden from the temporary preview; pagination and full-list mode remain available locally without changing tracker settings.

## [6.7.5] - 2026-08-03

### Changed
- **CYOA prompt context**: retains the four newest `<choices>` blocks (T-1 through T-4), stripping only T-5 and older blocks while preserving all historical choices in the visible chat.

## [6.7.0] - 2026-08-02

### Added
- **World Skeleton lorebook sources**: World Skeleton generation can now use selected existing lorebooks as established source material, with per-chat selection and a strict mode that only creates explicitly mentioned entities.

### Changed
- **Skeleton Source**: replaced the narrow Atmosphere Summary concept with a freeform source field; Auto-Generate remains conservative and produces only a generalized backdrop without named story entities.
- **Character Creator presets**: duplicate names now prompt before overwriting, and confirmed overwrites replace the existing preset instead of creating duplicates.
- **World Progression onboarding**: clarified that an immediate Skeleton-only report can provide useful starting context for a new campaign.

## [6.6.40] - 2026-08-02

### Changed
- **Quest XP scaling**: XP rewards now account for both quest complexity and the task's difficulty for the player character.

## [6.6.35] - 2026-08-02

### Changed
- **Character Creator fields**: removed example placeholders and the Orientation field, including its draft and prompt plumbing.

## [6.6.30] - 2026-08-01

### Changed
- **COMBAT ability examples**: elite enemy abilities now include concrete triggers, effects, save DCs, damage, and `2/2` encounter-use counters; the general format now instructs the model to define these properties.

## [6.6.25] - 2026-08-01

### Changed
- **Narrator Configuration inheritance**: new chats now carry over the configuration from the previously active chat instead of resetting it to factory defaults, while retaining independent per-chat state.
- **High-Agency Mode explanation**: clarified that this mode omits the instruction to lightly expand on the user's actions.

## [6.6.20] - 2026-08-01

### Changed
- **NPC stat scaling prompt**: removed the instruction to always leave a fighting chance, allowing narrative realism to determine outcomes without guaranteed safety margins.

## [6.6.15] - 2026-08-01

### Added
- **Prompt restoration guidance**: onboarding now explains that Multihog auto-applies its system prompt and points to the backup restore control for recovering the previous Main prompt.

## [6.6.10] - 2026-08-01

### Changed
- **Tentative model guidance**: onboarding, Lorebook Agent help, README, documentation, and Adventure Companion now present Gemini Flash-Lite/Flash, Deepseek V4 Flash 0731, and GPT-5.6 Luna as inexpensive, promising options without a firm recommendation.
- **Combat API Override guidance**: explains that the feature lets users switch to a faster model while combat is active, without prescribing a specific model.

## [6.6.8] - 2026-08-01

### Fixed
- **Inventory item names**: bullet-delimited items containing commas (such as `Runekind, Quarterstaff +2`) now render as one item instead of being split across multiple rows. Legacy comma-separated inventory lines remain supported.

## [6.6.5] - 2026-08-01

### Changed
- **CYOA prompt context**: keeps the two newest completed choice blocks (T-1 and T-2) as fresh examples for the AI, while stripping T-3 and older blocks only from the outgoing prompt. All historical choice buttons remain visible and usable in chat.
- **Model guidance**: Gemini 3.5 Flash-Lite is again the suggested default for the State Tracker and Lorebook Agent; Deepseek V4 Flash 0731 and GPT-5.6 Luna are presented as alternatives with their respective tradeoffs. Combat API Override now points to faster models such as Gemini 3.5 Flash or Deepseek Flash.
- **Out-of-range attacks**: the narrator now reports the failed range attempt and asks for another action instead of automatically moving the player closer.

### Tests
- Added regression coverage to keep the standard, legacy, and embedded prompt copies synchronized for the out-of-range attack rule.

## [6.6.0] - 2026-08-01

### Changed
- **State Tracker resource accounting**: the Core Prompt now requires implicit spell-slot and resource changes to be tracked when the narrative clearly spends or grants them.
- **Compact Core Prompt**: removed redundant blank spacer lines without changing prompt structure or instructions.
- **Model recommendation**: GPT-5.6 Luna is now the primary State Tracker, Lorebook Agent, and Combat API Override recommendation; obsolete Gemini and thinking-level recommendations were removed.

### Fixed
- **CYOA mechanics wrapping**: long bracketed mechanics now wrap within choice buttons instead of overflowing the viewport.

## [6.5.90] - 2026-08-01

### Changed
- **COMBAT example clarity**: the elite combatant example now gives Brutal Strike a concrete melee-hit trigger, Fortitude save DC, knockdown effect, and per-combat usage limit.

## [6.5.85] - 2026-08-01

### Changed
- **Prompt accounting guidance**: PARTY and COMBAT prompts now explicitly require accurate spell-slot and ability-use tracking.
- **Authoritative state memo**: clarified that TRACKER STATE 0 is read-only, already accounts for prior events, and must not be reconstructed from earlier narration.
- **RNG queue prompt**: standardized the compact RNG_QUEUE v7.0 block and removed the stray blank line under its tags.

## [6.5.75] - 2026-07-31

### Added
- **Universal custom-bar trickle animations**: opted-in `((BAR))` and `((BARREL))` changes now transfer progressively, with timing scaled to the percentage of the bar changed. Equivalent proportional changes take the same amount of time regardless of the bar's numeric scale.
- **Enabled by default**: universal custom-bar animations are now on by default, while remaining user-toggleable.

## [6.5.35] - 2026-07-30

### Fixed
- **Paused relationship regex updates**: chat-regex Friendship/Affection awards continue to process while the State Tracker or Lorebook Agent is paused, while tracker/LLM relationship commands remain pause-gated.
- **Regression coverage**: automated tests now protect the pause-boundary behavior.

## [6.5.30] - 2026-07-30

### Changed
- **CYOA settings scope**: choice composition and behavior remain per-chat, while visual theme settings are shared globally.

### Fixed
- **CYOA migration**: legacy per-chat snapshots retain their choice setup while no longer overriding the global visual theme.

## [6.5.10] - 2026-07-30

### Added
- **Temporary combat allies**: `[COMBAT]` now supports optional `ENEMIES:` and `ALLIES:` sections with red and blue UI headers.
- **RNG multi-die guidance**: queue prompts now specify how additional matching damage dice consume successive queue lines, including a `2d8` example.

### Fixed
- **Combat section parsing**: `ALLIES:` boundaries no longer get absorbed into the preceding enemy entry, while headerless combat remains backward-compatible.

## [6.5.0] - 2026-07-30

### Added
- **Adventure Companion connections and settings**: Adventure Companion now has its own connection configuration and a mirrored settings drawer, including Tutorial Mode.
- **XP gain animation**: gained XP now visibly trickles from a glowing blue award into the XP bar.
- **Combat defeat presentation**: explicitly defeated combatants remain visually marked until combat ends, with negative HP values supported by combat and party renderers.
- **Onboarding releases link**: the startup screen now links to the GitHub Releases page as the project development blog.
- **SPELLS example**: the stock SPELLS module prompt now demonstrates multi-level spell-slot formatting.

### Changed
- **Adventure Companion mobile behavior**: its header now keeps the standard collapse control available on mobile for quick minimize/maximize access.
- **Relationship award feedback**: Friendship and Affection floaters are larger, last four seconds, and may extend beyond the tracker edge so long NPC names remain visible.
- **Narrator and combat prompts**: refined realistic time-passage, XP, spell, and defeated-combatant instructions.

### Fixed
- **Adventure Companion collapse**: collapsing the Companion no longer flips the tracker view while leaving the Companion header behind.
- **Combat parsing**: negative current HP such as `-4/15 HP` now renders as a structured combatant instead of unformatted text.

## [6.4.3] - 2026-07-29

### Fixed
- **Older mobile WebView initialization**: missing `ResizeObserver` support no longer aborts State Tracker panel setup and leaves a visible but non-interactive panel.

## [6.4.0] - 2026-07-29

### Added
- **Genre-aware character names**: Instant Action and Other Ways to Begin now use genre-specific first-name / surname pools, with reroll controls and editable name fields. The Character Creator random-name button includes the combined library.
- **Discord onboarding help**: the onboarding help card now links directly to the SillyTavern Discord Extensions subforum.

### Changed
- **Character-generation prompts**: Quick Start, Character Creator, Other Ways to Begin, and PC Import now receive active tracker-module instructions without the full State Extractor prompt. Character creation also excludes the COMBAT block.
- **Name selection flow**: users can roll, reroll, type, or edit a name before accepting Instant Action or the Custom onboarding path. Persona and Import Card paths continue to use their source names.
- **Narrator constraints**: added the cheese-and-abuse safeguard to the default and legacy narrator configurations.

### Fixed
- **Instant Action name propagation**: the accepted name is now passed through to character generation instead of being independently re-invented by the model.
- **Wizard module scope guidance**: clicking GLOBAL / CHAT-BOUND on a Wizard-created tracker module now explains that bundle scope is controlled from Manage Game Systems.

## [6.3.60] - 2026-07-29

### Added
- **Shorter Outputs pacing**: Narrator Configuration now includes a dedicated modest-output-length mode, alongside the renamed Normal (no length instructions) option.

## [6.3.53] - 2026-07-29

### Fixed
- **Adventure Companion story lookback**: “All” / lookback count are global prefs again and no longer get overwritten by per-chat or Chat Link companion snapshots on reload.

### Changed
- **Adventure Companion story lookback**: fresh installs default to lookback 5 with “All” off.

### Added
- **Character Creator custom modules**: enabled custom tracker modules now inject their full tracking instructions and templates into character-generation prompts, not just the tag name.

## [6.3.52] - 2026-07-29

### Changed
- **Adventure Companion story lookback**: restored the previous default — new sessions use full chat history (“All” on).

## [6.3.51] - 2026-07-29

### Changed
- **Adventure Companion actions**: hard-limits the Companion to State Tracker commands, Lorebook Agent commands, and acting for the player (chat / CYOA); it must not invent Multihog UI workflows.

## [6.3.50] - 2026-07-28

### Added
- **Global / Chat-bound item scopes**: standalone tracker modules and system-prompt snippets can now share one enabled state across every chat or retain activation separately per chat. Wizard-created modules and snippets inherit one atomic scope from their Game System bundle.
- **Scope bypass mode**: turning off the per-chat Control Room/module lock temporarily carries the current setup between chats without changing saved item scopes.

### Fixed
- **First scope change on new modules**: newly created module rows now persist the first Global / Chat-bound selection immediately, even when catalog synchronization has just replaced the in-memory definition.

## [6.3.0] - 2026-07-28

### Added
- **Per-chat Control Room & Module setups**: an optional setup lock now saves and restores System Prompt Control Room sections, Game Systems, custom/stock State Tracker modules, prompts, ordering, and related toggles per chat. Unseen chats start from stock; temporarily disabling Chat-Linked Mode carries the current setup between chats.
- **Global module & snippet catalogs**: created tracker modules, Game Systems, and system-prompt snippets now remain available across chats. Each chat stores only membership/activation and ordering; definitions from other chats appear in dedicated inactive pools instead of disappearing.
- **Separate Player Card / ST Persona controls**: Character Creator and Other Ways to Begin now independently control the rich Lorebook Agent Player Card and the name-only SillyTavern persona used for the outgoing message header.

### Fixed
- **Instant Action persona duplication**: the matching SillyTavern persona now has an empty description, keeping the rich PC biography exclusively in the Lorebook Agent Player Card.
- **System Prompt section editor wrappers**: editing or appending text to a custom/unlocked section no longer nests another copy of its outer XML tag on every save. The editor now exposes only the section body, and saving repairs previously duplicated matching wrappers without losing their instructions.
- **Custom `[PARTY]` templates**: member headers with inline rendering markers (e.g. `Name: ((BAR)) 100/100 HP`) are recognized again, so merge/hydrate no longer empties the party roster.
- **Benched portrait overlay**: removed the mojibake’d camping badge on individual chips; tent emoji stays on the Benched header only.

### Changed
- **Benched Party icon**: uses ⛺ across State Tracker UI, settings, and badges.

## [6.2.52] - 2026-07-27

### Fixed
- **Settings drawer hierarchy**: restored the Framework drawer’s complete nesting so General & Visuals and all other primary sections share the same layout and toggle behavior.
- **Mobile settings rendering**: removed the collapsed-content optimization that could hide the first nested drawer until interaction.
- **CHAT persistence**: Adventure Companion now restores its open/closed state after a page reload.

## [6.2.50] - 2026-07-27

### Added
- **Adventure Companion actions**: the Companion can now delegate clear player requests to State Tracker or Lorebook Agent, and can submit a player action through chat or CYOA controls.
- **Tutorial Mode**: the Companion can optionally include the learning guide in its context, with a concise explanation available from the new help control.

### Changed
- **Unified Companion**: Tutorial Bot and Adventure Companion are now one Companion experience, with tutorial guidance controlled by the Tutorial Mode setting.
- **Responsive Companion layout**: CHAT can be detached on desktop; mobile always uses the clean floating presentation without dock/undock controls.
- **Natural player-action reactions**: after acting for the player, Companion responds with table-side commentary instead of a mechanical receipt.

## [6.2.34] - 2026-07-27

### Changed
- **Mobile Adventure Companion**: CHAT now always opens in its full-height floating presentation on mobile, with dock/undock controls hidden. Resizing back to desktop restores the normal docked view unless the player had explicitly detached it there.

## [6.2.33] - 2026-07-27

### Changed
- **Organic player-action reactions**: after acting for the player, Adventure Companion now gives a brief entertaining or funny table-side comment instead of echoing a dry `Player Turn: Submitted...` receipt.
- **Single-turn commentary**: the reaction is generated alongside the action itself, avoiding a second Companion request that could compete with the main narrator.

## [6.2.32] - 2026-07-27

### Added
- **Detachable Adventure Companion**: CHAT can be moved into its own draggable, resizable floating panel and reattached without losing its live conversation or request state.
- **Detached CHAT geometry**: desktop position and size are remembered and clamped to the viewport; mobile uses a full-height layout.

## [6.2.31] - 2026-07-27

### Changed
- **Adventure Companion header**: CHAT now displays its name as a styled, non-interactive header rather than a redundant top button.

## [6.2.30] - 2026-07-27

### Changed
- **Free-form actions in CYOA**: Adventure Companion can now type and submit a normal player action even while CYOA mode is active, instead of being limited to pressing a listed choice.

## [6.2.29] - 2026-07-27

### Changed
- **One Adventure Companion**: CHAT no longer separates framework help and story conversation into different bots or histories.
- **Tutorial Mode**: a new toggle injects `docs/multihogDnDdoc.md` into every Adventure Companion request. Its `?` popup explains the extra context and token cost.
- **Unified capabilities**: framework questions, story discussion, State Tracker and Lorebook Agent commands, and acting for the player are all available in the same conversation.

## [6.2.28] - 2026-07-27

### Added
- **Adventure Companion player actions**: when clearly asked to choose or act for the player, the Companion can submit the player's next turn through SillyTavern.
- **CYOA-aware acting**: with CYOA mode active, the Companion receives the currently actionable choices and must select one of their buttons. With CYOA inactive, it composes and submits a normal player chat message.

### Changed
- **Terminal player submissions**: successfully submitting a player turn ends the Companion action loop immediately, avoiding a competing follow-up request while narrator generation begins.

## [6.2.27] - 2026-07-27

### Fixed
- **Connection Manager action feedback**: post-action results now use a profile-compatible conversation role, avoiding `Bad Request` failures caused by inserting a system message after the Companion's action response.
- **Successful action misreported as failure**: if the State Tracker or Lorebook Agent command completes but the optional conversational summary request fails, CHAT now displays the authoritative completed-action receipt instead of claiming the entire operation failed.

## [6.2.26] - 2026-07-27

### Changed
- **Natural Companion action intent**: Adventure Companion no longer expects command-like wording or exact strings. Polite questions, indirect requests, and requests to demonstrate or test an action now count when the user's intent to make a change is clear.
- **Underspecified demos**: the Companion may choose and execute one small, harmless, clearly labeled demo addition instead of explaining how the player should ask again.

## [6.2.25] - 2026-07-27

### Fixed
- **CHAT with detached Lorebook Agent**: Adventure Companion navigation remains visible while the Lorebook Agent is detached.
- **CHAT during Lorebook Agent reattachment**: reattaching no longer switches the main panel underneath CHAT to Lorebook Agent or leaves the CHAT tabs unresponsive.

## [6.2.24] - 2026-07-27

### Added
- **Adventure Companion actions**: explicit player requests can now be forwarded as direct commands to the State Tracker and Lorebook Agent. Native tool calls are used when supported, with a validated tagged fallback for other connection types.
- **Action result reporting**: Companion commands report completed, unchanged, unavailable, busy, cancelled, and failed outcomes instead of assuming an update succeeded.

### Changed
- **Adventure Companion capability instructions**: the embedded persona and framework documentation now explain the two available actions and prohibit turning brainstorming or theories into campaign state.

## [6.2.23] - 2026-07-27

### Fixed
- **Detached Lorebook Agent**: clamp floating panel into the viewport; closing while detached reattaches so State Tracker / Lorebook Agent tabs return.

### Added
- **`/multihogresetui`**: emergency UI rebuild that clears stuck layout state (detached agent, geometry, visibility) and recreates the panels. Aliases: `/rpgresetui`, `/rtresetui`.

## [6.2.21] - 2026-07-26

### Fixed
- **CYOA on ST welcome screen**: no longer wraps or binds SillyTavern’s API Connections / Character Management / Extensions drawer buttons as CYOA choices.

## [6.2.20] - 2026-07-25

### Changed
- **Character creation prompts**: do not invent quests or emit a `[QUESTS]` block unless the player explicitly asks (Character Creator, Other Ways to Begin, Quick Start, and PC Import). `QUESTS` is excluded from onboarding active blocks the same way `PARTY` already was.

## [6.2.12] - 2026-07-25

### Changed
- **CHAT mobile layout**: Adventure Companion chat uses the primary panel area while CHAT is open; Back, options, and Clear share one compact row.
- **CHAT context controls**: moved Story lookback into the options menu and defaulted new CHAT sessions to the full chat history.

## [6.2.11] - 2026-07-24

### Fixed
- **CHAT composer focus**: after sending a message, the input is re-focused when the reply finishes so you don’t have to click it again.

## [6.2.10] - 2026-07-24

### Added
- **Startup “How It Works”**: noticeable tip to open **CHAT** in the State Tracker header and ask the Adventure Companion (knows most of the framework).

### Changed
- **Tutorial docs**: updates to `docs/multihogDnDdoc.md` (Adventure Companion knowledge base).
- **System Prompt Control Room**: section/content editors wrap long lines instead of forcing horizontal scroll.

## [6.2.1] - 2026-07-24

### Changed
- **Abilities module prompt**: use-limited abilities must include remaining/max uses inside the parentheses (e.g. `Silver-Tongued Pivot (…, 1/1 per rest)`).

## [6.2.0] - 2026-07-24

### Changed
- **Lorebook Agent / State Tracker auto-runs**: only fire when the latest assistant speaker is the active `{{char}}`. Other speakers (e.g. `/sendas` announcement names like “System Notifications”) no longer tick run-every or start auto passes. Manual `/lorebookagent` and `/statetracker` are unchanged. When a message has an explicit speaker name, that name wins over avatar matching.

## [6.1.50] - 2026-07-24

### Fixed
- **Adventure Companion Chat Link isolation**: entering an unseen SillyTavern chat no longer copies the previous chat's Companion conversation. New ChatIDs now begin with the default Companion message, while existing per-chat sessions remain intact.

## [6.1.1] - 2026-07-24

### Added
- **Adventure Companion story lookback**: adjustable header control (**Story lookback**) injects the last N SillyTavern chat messages so players can discuss their adventure with the Companion.

### Changed
- **Adventure Companion lookback UI**: moved from the composer to the header, with a clear label.

## [6.1.0] - 2026-07-24

### Added
- **Adventure Companion**: in-panel HELP chat that morphs the State Tracker into a multi-turn instructor. Answers from `docs/multihogDnDdoc.md` via the State Tracker LLM connection. Open from the tracker **HELP** button or **General & Visuals → Adventure Companion (HELP)**. Chat persists across reloads until Clear; replies render Markdown (showdown).
- **Framework documentation**: `docs/multihogDnDdoc.md` (tutorial knowledge base) covering setup, turn flow, RNG, modules, Lorebook Agent, World Progression, and more.

### Changed
- **Chat Link**: removed header/footer icons from the State Tracker panel; toggle and conflict handling live in **General & Visuals** only.
- **Mobile Raw View**: larger tap target for the Raw/Rendered view toggle.

### Fixed
- **Mobile HELP button**: no longer stays green after closing Adventure Companion (sticky touch hover/focus).

## [6.0.85] - 2026-07-24

### Added
- **`/lorebookagent` slash command**: manually invoke a Lorebook Agent pass from STscript (aliases: `/lbagent`, `/la`, `/router`). Useful after `/sendas`, which does not auto-trigger the agent. Supports `quiet=true`, `lookback=N`, `save [hint]`, and Direct Command text.
- **`/statetracker` slash command**: manually invoke a State Tracker update from STscript (alias: `/st`). Supports regular update, `full` audit, `lookback=N`, and `quiet=true`.

### Changed
- **QUEST DIFFICULTY**: clarifies that quests should not be made harder than the narrative/context reasonably supports.
- **Attacks per round**: notes that the STATE MEMO APR lines (`Melee/Ranged X attacks`) are authoritative.

## [6.0.83] - 2026-07-24

### Fixed
- **System Prompt Control Room on mobile**: section scrolling no longer competes with reordering. Swipe anywhere in a row to scroll; long-press and drag the enlarged grip to reorder. The contained list also works on Android browsers that do not support the CSS selector previously used to identify this popup.

## [6.0.82] - 2026-07-24

### Fixed
- **Relationship command leakage**: `[RELATIONS]` blocks are now removed before State Memo merging, including malformed or unclosed blocks.

## [6.0.81] - 2026-07-24

### Fixed
- **CYOA choice rendering**: bracketed mechanics such as DCs and modifiers now decorate immediately after narration ends, without waiting for the State Tracker pass.

## [6.0.80] - 2026-07-24

### Fixed
- **World Skeleton entries**: preserves model-supplied titles when descriptions contain hyphens or metadata such as “Parties involved,” and the default prompt now requires a strict title/content layout.

## [6.0.78] - 2026-07-24

### Fixed
- **Relationship prompt reset**: keeps the Reset to built-in control compact and horizontal.

## [6.0.77] - 2026-07-24

### Changed
- **Relationship-delta recognition**: State Tracker now accepts clear narrator point awards with minor wording, punctuation, capitalization, spacing, or formatting variations.

## [6.0.76] - 2026-07-24

### Added
- **Relationship prompt reset**: the State Tracker relationship-instruction editor now has a Reset to built-in button.

## [6.0.75] - 2026-07-24

### Changed
- **State Tracker relationship instruction**: removes memo-storage implementation details; the tracker is now instructed only on relationship-delta criteria and command syntax.

## [6.0.74] - 2026-07-23

### Added
- **Editable State Tracker relationship instruction**: the Relationship System settings cog now lets users customize the prompt used for State Tracker relationship updates.

## [6.0.73] - 2026-07-23

### Added
- **Portrait popup controls**: adaptive full-size portrait viewing with cursor-anchored zoom, pan clamping, and a wrapper that expands with the image.

## [6.0.72] - 2026-07-23

### Changed
- **Legacy browser recovery**: retained in the source code but disabled. The tracker no longer creates, compares, prompts for, or restores browser-local recovery copies.

## [6.0.71] - 2026-07-23

### Added
- **Relationship update methods**: choose between narrator annotations and State Tracker relationship commands, with dedicated settings and live relationship feedback.

### Fixed
- **Persistence rollback**: removes the unavailable server disk-state endpoint and restores the established SillyTavern save and recovery behavior.

## [6.0.70] - 2026-07-23

### Fixed
- **Emergency rollback release**: restores the proven 6.0.23 persistence behavior so installs affected by the unavailable disk-state endpoint can update normally and retain their existing tracker data.

## [6.0.23] - 2026-07-23

### Changed
- **Rendering Tags Library button**: refreshed the library trigger with an arcane gradient, swatchbook emblem, live-preview subtitle, shimmer hover, and reduced-motion support.

## [6.0.22] - 2026-07-23

### Changed
- **BARREL value color**: the numeric value beside a signed bar now mirrors its active positive or negative bar color, including live recoloring and gradients.

## [6.0.21] - 2026-07-23

### Changed
- **Universal tag colors**: use a named-color suffix with any tag (such as `((PILLPINK))`, `((BARRED))`, or `((PROGRESSGOLDENROD))`) instead of maintaining individual color variants. Exact named or hexadecimal colors remain available through `((TAG - COLOR))`.

## [6.0.20] - 2026-07-23

### Added
- **Freeform NPC tracker cards**: `((NPC)) Name:` now starts a PARTY-style card inside any tracker block, with unrestricted follow-up fields and rendering tags. A matching Lorebook Agent portrait is used automatically, including case-only name differences.
- **Signed rendering bar**: `((BARREL))` renders generic positive/negative values around a centre-zero marker. It accepts both `value/max` and explicit signed ranges such as `value/-max..+max`, without requiring any specific field name.
- **BARREL customization**: click either half of a `((BARREL))` to recolor that direction independently, or set its positive and negative colors inline with `((BARREL - #RRGGBB #RRGGBB))`.
- **Marker tab stops**: place `|x` immediately before a marker to start it at `x%` of the row (including at the beginning of a line), e.g. `((PILLGREEN)) Friendly |50 ((PILLS)) In Love`. The legacy `||` shorthand still creates equal columns.

## [6.0.17] - 2026-07-22

### Changed
- **Settings / memo recovery dialogs**: backdrop stays unblurred so you can judge the live UI; disk buttons clarify they keep what's visible right now.

## [6.0.16] - 2026-07-22

### Fixed
- **Chat Link**: new chats with no saved tracker state now begin cleanly instead of inheriting another chat's memo, quests, or portraits.
- **Prompt injection**: clears a stale legacy Prompt Manager flag so tracker and player-character context continue to reach the model.
- **Settings recovery**: browser and disk mismatches now always ask which copy to keep; CYOA settings and presets are included in the recoverable browser snapshot.

## [6.0.15] - 2026-07-21

### Added
- **CYOA Game Cartridge support**: cartridges can now save and selectively load the complete CYOA setup, including its prompt, appearance, slots, and saved presets.
- **Individual CYOA preset sharing**: export and import one selected preset at a time. Imported presets immediately load into the editor with their type settings and text intact.
- **User-defined CYOA choices**: a choice slot can now specify its complete freeform line.

### Changed
- **CYOA presets**: split Save into Save (update selected preset) and Save As… (create or deliberately overwrite a named preset).

### Fixed
- **Startup CYOA settings cog**: now opens the CYOA settings popup from the dynamically rendered Narrator Configuration drawer.

## [6.0.1] - 2026-07-21

### Added
- **Dynamic hybrid RNG**: Pre-Seeded + Tool Calls now exposes only RollTheDice outside active `[COMBAT]`, then switches to only the RNG Queue in combat. The prompt, queue injection, and function-tool schema switch together.

### Changed
- **Hybrid RNG combat format**: restored the readable strict attack/AC, save/DC, and damage roll presentation.
- **Hybrid loot**: batches the main loot and quality rolls, discarding the quality roll when no loot is found.

## [6.0.05] - 2026-07-21

### Changed
- **Lorebook Agent QUEST prompt**: now records quests only when the player unambiguously begins pursuing them; mentions, offers, and deliberation alone do not qualify. Delivered through Prompt Defaults Updated so customized prompts remain intact.

## [6.0.0] - 2026-07-21

### Changed
- **Narrator Configuration defaults**: new installs enable all optional components, use Normal pacing, and select Pre-Seeded Only RNG by default.
- **Instant Action**: now honors the active Narrator Configuration instead of overriding component and RNG choices.
- **Relationship System**: removed the beta label and clarified that it tracks each NPC's friendship and affection toward the player.
- **Startup header**: replaced the scroll icon with a mirrored fencer-and-shield crest.

## [5.9.99] - 2026-07-21

### Fixed
- **Startup Narrator Configuration**: controls now persist changes, synchronize with the sidebar, and trigger the normal system-prompt update path.

## [5.9.98] - 2026-07-21

### Changed
- **Startup narrator controls**: Narrator Configuration is now a top-level drawer directly beneath **Other Ways to Begin**, with the same pacing selector and explanation available from the main settings.
- **Startup drawers**: refreshed the visual treatment for **Other Ways to Begin** and Narrator Configuration for clearer hierarchy and better visibility.
- **RNG recommendations**: clarified the recommended RNG mode for CYOA and non-CYOA play in both Narrator Configuration views.

## [5.9.97] - 2026-07-21

### Added
- **Narrative pacing**: Narrator Configuration now offers exclusive Normal, High-Agency, and Downtime/Slice of Life modes, each generating its corresponding `<narrative>` instruction block. Includes an in-app explanation dialog.

### Fixed
- **Memo recovery**: recovery timestamps are now stored per chat, preventing a newer save for one chat from suppressing recovery for another. The recovery dialog now displays the same chat-specific timestamp it uses for its decision.

## [5.9.95] - 2026-07-21

### Changed
- **First-turn status footer reminder**: now respects System Prompt Control Room — if `<end_of_output_footer>` is disabled, nothing is injected. When enabled, injects only the live section's format (the part after "with"), including unlocked overrides and Main-prompt transforms.

## [5.9.32] - 2026-07-21

### Fixed
- **Native ST portrait gen (Comfy)**: `/imagine` now passes `extend=false` so Multihog's curated portrait prompt goes straight to the image backend instead of being re-written by a second main-API LLM pass when "Extend free mode prompts" is enabled.
- **CYOA settings popup**: scrollbar for high-zoom compatibility (#26).

## [5.9.3] - 2026-07-20

### Added
- **Instant Action / Quick Start**: one-click genre start on the empty tracker — enables Loot, Events, Resting, Benched Party, CYOA, Relationships + Pre-Seeded Only RNG, RNG-picks an archetype, generates the character sheet, creates a Lorebook Agent Player Card and matching SillyTavern persona (so the chat username matches `[CHARACTER]`), then sends "Begin the adventure". Orchestrated in `quickstart.js` with a strict sequential pipeline.

## [5.9.2] - 2026-07-20 — LEEEROOOOOOY JEEENKIIIINS

### Changed
- **CYOA defaults**: 5 Narrative-Decided choice slots (was 4); dropdown/prompt wording is now **Narrative-Decided**.
- **CYOA prompt**: removed the always-on freeform "Something else?" choice — players can type freely without a dedicated button bloating the list.
- **CYOA settings**: recommends Pre-Seeded RNG (RNG Queue) from Narrator Configuration; RollTheDice mostly adds cost/latency in CYOA because DCs are pre-committed in the choices.

### Added
- **CYOA button appearance**: text colour (or theme default), border, choice stripe, plus bracket highlight colours (mechanics / DC / modifiers / prefix tags / roll accent) with live preview and reset.
- **CYOA mechanical highlights**: `[Persuasion … DC 13]`-style brackets render with distinct colours for DC, modifiers, and tags.

### Fixed
- **CYOA streaming**: empty tiny boxes while choices stream in — button font size no longer collapses inside gap-killing wrappers; incomplete empty buttons stay hidden until they have text; flatten/bind waits until generation ends.
- **CYOA Chromium layout**: multi-button choice blocks no longer leave huge vertical gaps.
- **CYOA custom prompt sticky**: builder is source of truth unless `useCustomPrompt` is explicitly set (older saves always wrote `customPromptText` and blocked shipped refreshes).
- **Prompt defaults**: "Update Changed Prompts" stays visually emphasized; Debug panel button when updates are pending.

## [5.9.0] - 2026-07-20

### Added
- **Choose Your Own Adventure (CYOA) Engine**: A robust interactive choice system, inspired by Disco Elysium was added to the narrator framework. Click the cog icon next the CYOA component to see the new additions!
  - **Clickable Choices**: Choices are generated as interactive buttons at the end of the AI's response. Clicking a choice instantly sends it as your next chat message.
  - **Dynamic Choice Slots**: Define exactly how many choices the AI should generate and assign specific roles to each (e.g., Narrative-Decided, Normal dialogue, Trait/Ability checks, or Custom Prefixes like `[Attack]`).
  - **Customizable Styling**: Fully adjust button colors, opacity, emojis, and XML tag wrapping directly from the settings to match your preferred theme.
  - **CYOA Presets**: Save your favorite choice slot configurations as named presets. Swap between different structural layouts (e.g., a 3-choice narrative setup vs. a 6-choice combat choices menu) with a single click via the auto-loading dropdown menu.

## [5.8.1] - 2026-07-18

### Fixed
- **Memo recovery net**: no longer lets early boot `saveSettings()` overwrite a good `localStorage` backup with a wiped disk memo (which made the restore popup silently skip). Gate snapshots until recovery runs; refuse to shrink richer backups; run recovery earlier and again on first `CHAT_CHANGED`; log skip reasons to the console.

## [5.8.0] - 2026-07-18

### Added
- **Realistic firearms damage (creation-time)**: when writing new PC/NPC/loot/enemy gear stats, scale firearm damage ~2–3× typical D&D/PF tables by common sense (pistol < carbine/rifle < shotgun/LMG); attack bonuses stay normal. Explicitly not a mid-scene conversion rule. In `<homebrew_and_custom_classes>` (main + legacy) and all character-creation paths.

## [5.7.102] - 2026-07-18

### Added
- **Memo recovery net**: mirrors live STATE MEMO / quests / delta into `localStorage` on every save and unload flush. On boot, if disk memo differs from the newer local copy, offers a Restore / Keep disk popup. Mitigates silent memo loss when SillyTavern's non-keepalive settings save is aborted by F5/reload (does not fix core settings rollback for toggles/background/etc.).

## [5.7.101] - 2026-07-18

### Added
- **Dual-wielding**: only path to a 3rd attack per round (offhand at −5, no ability mod on offhand damage unless a trait overrides). Hard cap of 3 APR everywhere; gear-dependent (sheathing offhand removes it).
- Documented in `<attacks_per_round>`, CHARACTER/PARTY ATTACK TOTALS (N=1/2/3), and `[COMBAT]` APR/notation plus Elite Duelist 3-attack example.

## [5.7.96] - 2026-07-18

### Changed
- **Sysprompt refresh**: Optimized main `sysprompt.txt` (hybrid RollTheDice + combat RNG queue); legacy prompt rebuilt from the same base with queue-only RNG (no RollTheDice).
- **`[COMBAT]` stock prompt**: Soldier-tier martial/caster examples, Elite 2-attack demo, APR rule, and explicit Attack/Spell DC tier bands.
- **Prompt transforms**: `random_events` / disabled-RNG fallback extractors updated for the new sysprompt wording.

## [5.7.95] - 2026-07-18

### Added
- **Create Persona** option on Other ways to begin (Custom / quick generate), with tappable mobile help.
- **First-turn footer reminder**: stealth-injects `<end_of_output_footer>` once on each chat's first user message.

### Fixed
- Create Persona overlay after Custom generate (settings survive panel refresh).
## [5.7.94] - 2026-07-18

### Changed
- **APR threshold**: Second attack at BAB +8 (−5), was +10.
- **Model guidance**: Onboarding + README note Combat API Override for slow-thinking GM models (GPT-5.6 Luna).

## [5.7.93] - 2026-07-18

### Changed
- **`[COMBAT]` caster spells**: Party-style `Cantrips` / `Level N (avail/max)` lines; Att/def before Saves in the template order.
- **`<combat_start>`**: Caster enemies must be introduced with spells by level and available slots.

## [5.7.92] - 2026-07-18

### Changed
- **`[COMBAT]` martial vs caster**: Separate Att/def patterns — casters use `Spell Atk` + `Spell DC` + weak backup weapon; martials stay weapon-only.
- **Caster NPC guidance**: Pre-calculated Spell Atk/DC (no improvising); casters should not hoard spell slots in a fight.

## [5.7.91] - 2026-07-18

### Changed
- **`<combat_flow>`**: Pre-calculated attack totals guidance now includes `[COMBAT]` Att/def bonuses, not only `[CHARACTER]`/`[PARTY]`.

## [5.7.90] - 2026-07-18

### Added
- **Combat caster support**: `[COMBAT]` `Spells:` line with remaining uses; flat lists render as blue magic pills. `<combat_start>` asks for spells/slots on caster enemies.

### Fixed
- **Chat Link clobbering global UI**: Auto-image-gen, immersion, connection, and appearance prefs are no longer saved/restored via `chatStates` (stops F5/code-reload resets).

### Changed
- **BASE NPC TIERS**: Label uses Attack (not BAB); spellcaster scaling note added under the tier table.

## [5.7.85] - 2026-07-18

### Added
- **Attacks per round (APR)**: Second attack at BAB +10 (−5), max 2; Combat line uses `Ranged (N attacks)` / `Melee (N attacks)` with optional slash totals.
- **`<attacks_per_round>`**: Dedicated sysprompt block; weapon-proficiencies trimmed to formulas + finesse only.

### Changed
- **NPC `[COMBAT]` format**: Compact `Att/def: Weapon (N attacks, +X / damage)` — no BAB/attribute/finesse rules on enemy blocks.
- **BASE NPC TIERS**: Stretched BAB bands (Boss +11–15, Legendary +16–20+) so labels match martial progression and APR.
- **DC SCALE**: Easy 14 → Near-impossible/expert 33+.

## [5.7.75] - 2026-07-17

### Added
- **Finesse melee guidance**: Documented DEX-based melee attack totals for finesse weapons in `[CHARACTER]`, `[PARTY]`, `[COMBAT]`, and sysprompt `<weapon_proficiencies>`.

### Changed
- **Stock prompt migration**: Existing profiles auto-update character/party/combat prompts when the pre-finesse attack-totals text is still in use.

## [5.7.7] - 2026-07-17

### Added
- **Starting Gear Tier dropdown**: New control in Other Ways to Begin and Character Creator (Auto, Mundane, Low, Standard, Well-equipped, Heroic). Both UIs stay synced via `onboardingGearTier`.
- **Thematic named gear**: Character-creation prompts now encourage evocative proper-name gear (not only generic +N items), with tier-appropriate guidance across all genres.

### Changed
- **`buildStartingGearHint()`**: Replaces level-only magic gear hints; tier selection shapes starting kit quality on every creation path (including Fit into Story import).

## [5.7.6] - 2026-07-17

### Added
- **Combat & skill scaling guide**: Shared `buildCombatAndSkillScalingHint()` now injects BAB progression tiers and conservative skill-bonus rules into every character-creation path (Character Creator, Persona, Custom, archetype presets, and PC Import).

### Changed
- **Combat sysprompt block**: Restructured `<combat>` into tagged sub-sections (`<ruleset_note>`, `<combat_start>`, `<combat_flow>`, `<damage_logic>`, `<positioning_and_movement>`, `<npc_stat_scaling>`, `<npc_profile_persistence>`, `<critical_hits_and_dying>`) in both sysprompts and embedded fallbacks.
- **Ruleset note**: Clarifies the system is a 5e-flavor hybrid with BAB from Pathfinder/D&D 3.5 plus Fort/Ref/Will saves — not full 5e proficiency-bonus math.

## [5.7.5] - 2026-07-17

### Added
- **Hide Image Generation Toasts**: Optional setting under portrait options suppresses progress/success notifications from portrait and location AI auto-generation (errors and warnings still show).

### Fixed
- **Stray "Brief" on NPC cards**: Section parser no longer splits `Brief Background` at `Background`, which had left a lone "Brief" line under Personality.
- **Portraits lost on rename**: Lorebook entry renames (manual Title edit or agent `rename`) now migrate `customPortraits` keys to the new name.
- **Full NPC / PC card Close saves**: Closing the detail popup while **Edit Text** is open now persists changes (Cancel still discards).
- **State Tracker Raw View rename**: Changing a party/enemy/character name in the memo (e.g. one-letter fix) no longer clears the portrait or triggers auto-generation — portrait keys follow the rename.


### Fixed
- **NEW_FIELD still resurrecting after delete**: Deleting a custom module now writes a sync tombstone in localStorage. Boot strips tombstoned tags from live settings and every `chatStates` partition (before and after `loadChatState`). Also fixed `saveSettings` dropping a second save while one was in flight (so deletes no longer lost the WAL write).

## [5.6.86] - 2026-07-17

### Fixed
- **Tracker snaps to Lorebook Agent after resize**: Detached agent BL/BR resizers were saving into the State Tracker geometry key (`rpg_tracker_geometry`). They now write `rpg_tracker_geometry_lorebook_agent` only.

## [5.6.81] - 2026-07-17

### Fixed
- **NEW_FIELD / custom modules resurrect on code-edit F5**: Module schema (`customFields`, `blockOrder`, `modules`) is mirrored to a sync localStorage write-ahead log before the async settings save. Boot reapplies that backup before `loadChatState`, so a cancelled `/api/settings/save` during a quick reload can no longer resurrect deleted custom modules from a stale `settings.js`.

### Changed
- **Custom module add/delete**: Forces an immediate disk save (`saveSettings(true)`) so structural module edits are less likely to be lost on refresh.

## [5.6.76] - 2026-07-17

### Fixed
- **Tracker wipe after ST-Copilot chat edits**: Bare `CHAT_CHANGED` emits (no chat id) are no longer treated as switching to an empty chat. That path had cleared `currentMemo`, memo snapshots, and World Progression timers, then a later save persisted the empty state. Same-chat refreshes now keep live tracker state.
- **F5 hang / syncQuestsFromMemo loop**: Raw-memo flush no longer calls `saveSettings`/`saveChatState` (those callers already persist). Fixes an infinite `saveSettings → saveChatState → flush → saveSettings` recursion introduced when save delays were removed.

### Changed
- **Immediate tracker saves**: Removed the 2s raw-memo and 5s recolor save delays. Edits persist right away (SillyTavern still coalesces disk writes via `saveSettingsDebounced`).

## [5.6.70] - 2026-07-17

### Fixed
- **Present Now false positives**: Agent-created NPCs no longer appear in Visualization Mode from loose first/last-name token matches; newly recorded entries require a full-name hit in the latest narrator message. Scanner uses that single reply only (not the whole turn block).

## [5.6.65] - 2026-07-17

### Added
- **Real-Time Visualization triggers**: Choose scene art on location change or every N outputs (set N to 1 for every narrator reply). Runs on generation end, not only when Visualization Mode is open.

### Changed
- **Location Images settings**: Moved out of the ALPHA drawer into the main Portraits section; Real-Time Visualization Mode is a featured settings card.
- **Portrait and location image resolution**: Uploads and generation no longer force 512×512 downscale or Pollinations size caps.
- **Present Now name scanner**: Case-sensitive matching so tokens like "Big" do not match unrelated words like "big".

## [5.6.60] - 2026-07-17

### Changed
- **Visualization Present Now**: Separate keyword scanner on the latest narrator output only (not Lorebook Agent active keys). Present Now tiles and location scene prompts use it; scan runs immediately before image generation.

## [5.6.55] - 2026-07-17

### Fixed
- **Settings revert on reload**: Flush chat-linked snapshots before disk write on tab hide/unload so code reloads no longer resurrect stale `chatStates` over live custom fields, modules, and memo.

## [5.6.45] - 2026-07-17

### Fixed
- **Character Creator startup memo**: Restores custom fields and all enabled stock modules in generated blocks (regression from Jul 12 module-gating fix). PARTY remains excluded.

## [5.6.35] - 2026-07-17

### Added
- **Detached Lorebook Agent background**: Separate day/night panel images and overlay strength for the detached agent window (Settings → Appearance).

### Changed
- **Night panel backgrounds**: Night image swaps from `[TIME]` during night / late night even when Day/Night Cycle is off; night-only uploads are supported.

## [5.6.3] - 2026-07-17

### Added
- **Panel background image**: Upload scenario art (optional night variant) with overlay strength; day/night cycle tints the scrim over the image.

### Fixed
- **Portrait matching**: Names with quotes (e.g. `Jax "Neon" Vane (Cyber-Drifter)`) now resolve portraits correctly after HTML rendering.

## [5.6.2] - 2026-07-17

### Changed
- **Character Creator**: Level-appropriate magic gear guidance (+1/+2/+3 by tier) for fantasy characters when inventory is enabled.
- **Inventory naming**: Magical weapons use D&D suffix format (`Shadow Longsword +1`, not `+1 Shadow Longsword`).
- **Combat totals**: Melee/Ranged formulas documented in tracker prompts — `BAB + STR/DEX modifier + weapon enhancement bonus` — for [CHARACTER], [PARTY], [COMBAT], and sysprompt weapon-proficiency sections.

## [5.6.1] - 2026-07-17

### Changed
- **`<quests>` narrator sysprompt**: Reorganized into GENERAL and EMERGENT QUESTS sections; added obtainable-objectives guidance; MOOD and FRUSTRATION_COEFF lines only inject when Frustration is enabled.

### Fixed
- **Mobile footer nav**: `Live` / `[ LIVE ]` snapshot nav centered (chevron balanced with spacer).

### Docs
- **Onboarding help**: Lorebook Agent instructions refer to the panel tab instead of the removed robot button.

## [5.6.0] - 2026-07-17

### Added
- **Card-flip panel mode**: State Tracker and Lorebook Agent share one docked panel with a top mode switch; headers swap per mode. Detached Lorebook Agent unchanged.
- **Night footer starfield**: Distinct twinkling stars in State Tracker and Lorebook Agent footers during night phases.

### Changed
- **Footer layout**: Direct prompt (💬) bottom-right in both modes; Lorebook Agent footer mirrors State Tracker (`[ LIVE ]` left, last-run right).
- **Footer location**: Larger glowing location text in both footers, tint follows day/night cycle.
- **Panel mode switch**: Lorebook Agent tab matches State Tracker (plain grey toggle).
- **Mobile Lorebook Agent header**: Detach hidden on mobile; collapse chevron matches State Tracker.
- **QUESTS prompt**: Stricter format rules; deadline only when needed; active quests only in output.

### Fixed
- **Character Creator Generate**: Event delegation + toasts for silent failures; panel reopens after re-render.
- **Player portrait auto-generation**: Targets `[CHARACTER]` block, not duplicate Lorebook PC bio generation.
- **Panel init crash**: `syncAgentImmersionUi` scope fix restores extension settings on load.
- **Lorebook Agent minimize**: Integrated collapse minimizes main panel (header-only), not a blank body.
- **Detached Lorebook Agent header**: Restored thin pre-card-flip header bar.
- **Sun badge glow**: No longer clipped above/below the day/night sun disc.

## [5.5.65] - 2026-07-16

### Fixed
- **Game System Wizard {{user}} macro**: Wizard LLM calls now shield `{{user}}` from SillyTavern `substituteParams()` (which was resolving it to the active persona name before the model saw the prompt). Generated GM/tracker instructions keep the literal `{{user}}` token so they remain valid after persona switches; leaked persona names in output are rewritten on save.

## [5.5.6] - 2026-07-16

### Changed
- **Startup screen**: Character Creator is now a prominent hero button at the top; Persona, Custom, Import Card, and campaign settings live in a collapsible **Other ways to begin** drawer below.
- **Time & Date**: Calendar/clock format controls moved into Character Creator; the same controls also appear in the onboarding drawer so Persona/Custom/Import paths can set them without opening Character Creator. Removed duplicate Time & Date block from Narrator Configuration.
- **Character Creator UX**: **Create Persona (Recommended)** checkbox label and **Add as Player into Lorebook Agent (Recommended)** on the persona preview screen.

## [5.5.5b] - 2026-07-16

### Changed
- **Initial Setup**: Step 5 now instructs users to enable Chat Completion API + **Enable function calling** (for RollTheDice), or pick a non–tool-call RNG mode in Narrator Configuration.

## [5.5.5a] - 2026-07-16

### Fixed
- **Help popups on mobile**: RNG Systems Explained, Quest/Components help, settings `?` help, and Lorebook Agent docs now use scrollable SillyTavern popups (`allowVerticalScrolling`) so long content is readable on small screens.

## [5.5.5] - 2026-07-16

### Changed
- **Party mechanics sysprompt**: Renamed `<party_join_leave>` to `<[PARTY]_mechanics>`; split bench ETA rules into `<bench_ETA_system>` (RollTheDice pre-return task roll in normal mode; RNG Queue d20 pop in legacy).
- **Settings help icons**: `?` tooltips in settings now open on tap/click (mobile-friendly popup) in addition to desktop hover; taps inside checkbox labels no longer toggle the checkbox.

### Fixed
- **Sysprompt section parser**: Top-level tags with bracket prefixes (e.g. `[PARTY]_mechanics`) are parsed correctly; saved `party_join_leave` section-order keys migrate automatically.

## [5.5.4] - 2026-07-16

### Changed
- **BENCHED PARTY prompt**: Bench ETA guidance on `[BENCH]` lines; `[UNBENCH]` only on physical reunion, not when an ETA date passes.
- **Party join/leave sysprompts**: `leaving_vs_benching` task/ETA narrative guidance in normal and legacy prompts; legacy `party_join_leave` aligned with the standard JOINS wording and full leaving-vs-benching block.

### Fixed
- **Real-Time Visualization Mode**: Suppress location image generation toasts; show an in-panel loading spinner on the Visualization Mode hero while scene art generates.
- **World Progression cross-chat leakage**: **Purge World History for this Chat** clears `{prefix}_World` reports and `{prefix}_Skeleton` seed data, resets per-chat timer/active world keys, and clears atmosphere summary; new chats no longer inherit atmosphere or active world keys from prior scenarios.

## [5.5.31] - 2026-07-16

### Changed
- **Lorebook Agent Documentation**: Expanded help popup with Visualization Mode, Location Images ALPHA gating, and Real-Time Visualization Mode. Shared via `showLorebookAgentDocumentation()` from the agent panel **?** button and a new **Lorebook Agent Documentation** button at the top of Lorebook Agent settings.

### Fixed
- **Day/Night Cycle + theme changes**: Switching tracker themes no longer clears day/night phase classes; cycle tint and header badge re-apply immediately without toggling the setting off and on.

## [5.5.20] - 2026-07-16

### Changed
- **Location Images & Visualization ALPHA layout**: Real-Time Visualization Mode has its own separated section in the drawer; standard auto-generation options hide while it is active.
- **Include Present NPCs in Location Scene Prompts**: Moved back to the standard location group (not Real-Time-specific); label capitalization fixed.
- **Real-Time Visualization Mode**: Removed the separate regenerate-on-revisit toggle — revisits always refresh while Real-Time mode is on.

## [5.5.19] - 2026-07-16

### Changed
- **Auto-Generate Locations**: Renamed the Lorebook Locations auto-gen checkbox under Location Images & Visualization ALPHA.

## [5.5.18] - 2026-07-16

### Changed
- **Settings drawer label**: Renamed **Lorebook Locations ALPHA** to **Location Images & Visualization ALPHA**.

## [5.5.17] - 2026-07-16

### Changed
- **Location Images & Visualization ALPHA drawer**: Location image settings (Show Location Images, Lorebook Locations auto-gen, Real-Time Visualization Mode, and related options) are grouped in a collapsible drawer instead of scattered across the portraits section.
- **Lorebook Locations auto-gen**: Enabling Lorebook Locations auto-generation now also turns on Show Location Images and no longer requires the master toggle first.

### Fixed
- **Lorebook Agent panel scroll**: One unified scrollbar for the whole agent body — expanding upper drawers no longer stops scroll at the Campaign Records header.
- **Visualization Mode gating**: Campaign Records / Visualization Mode switch is hidden entirely when Show Location Images is off; the agent panel shows a plain CAMPAIGN RECORDS header like pre-5.5.0.

## [5.5.15] - 2026-07-16

### Fixed
- **Lorebook Agent panel scroll**: Expanding Quick Settings, Console, World Progression, and other drawers no longer clips content with no scrollbar; the agent body scrolls, and Campaign Records keeps a usable minimum height.

## [5.5.1] - 2026-07-16

### Fixed
- **Benched party commands**: `[BENCH]`/`[UNBENCH]` parsing now tolerates leading list bullets (e.g. `- [BENCH] Name — reason`) so bench commands are applied instead of overwriting the roster with literal command text.

## [5.5.0] - 2026-07-16

### Added
- **Location images (Lorebook Agent)**: Hierarchical location tree with per-entry wide 16:9 scene art, drag-and-drop upload, AI generation, and detail popups with breadcrumb paths. Dedicated Location Scene prompt template.
- **Lorebook Agent Visualization Mode**: Scene layout with location hero image and present NPC tiles; segmented **Campaign Records / Visualization Mode** switcher in the agent panel. Click tiles to open full character/location cards.
- **Real-Time Visualization Mode**: Location images generated only on Scene View arrival (current context and characters present). Mutually exclusive with Lorebook Locations auto-generation. Enables regenerate-on-visit, Show Location Images, and Include present NPCs as a locked bundle.
- **Include present NPCs in location scene prompts** (optional): Injects active Lorebook Agent NPC keys into location image prompts; uses last two narrator outputs for scene context.
- **Regenerate visited locations**: Optional fresh hero image on each arrival when Real-Time Visualization Mode is on.

### Changed
- **Location images (alpha)**: Show Location Images is **off by default** — opt in via settings or Real-Time Visualization Mode.
- **Location image inheritance**: Child entries no longer inherit parent art; parent lore guides distinct child generation.
- **Portrait LLM connection**: Portraits LLM Connection is global; NPC and location prompt generation use it instead of the Lorebook Agent connection.
- **Settings layout**: Location Portraits section reorganized; Real-Time Visualization Mode is the primary control.

### Fixed
- **Scene View character clicks**: Open full NPC/PC cards instead of portrait image-gen menu.
- **Real-Time Visualization Mode page refresh**: Reload no longer counts as a new location arrival; last visited path persisted per chat.
- **Lorebook auto-gen vs Real-Time**: Lorebook location background generation is hard-blocked while Real-Time Visualization Mode is on.

## [5.4.95] - 2026-07-15

### Changed
- **`<resting>` prompt**: Clarifies Long Rest 9-hour gate, danger-based interruption rolls for Long/Short Rest, and that a failed roll (< DC) interrupts the rest.

## [5.4.9] - 2026-07-15

### Changed
- **RNG queue v7.0**: Combat pre-roll block now uses numbered lines with labeled dice (`1: d20=17 d4=3 ...`) instead of the v6.0 `queue=[...]` array format. Non-legacy `<rng_system>` now nests queue rules in `<rng_queue_instructions>`. Sysprompt and legacy prompt text updated to match. Removed erroneous space-padding before single-digit d20 values.

## [5.4.7] - 2026-07-15

### Changed
- **Game System Wizard recovery split**: Magnitude guidance for eating/drinking (and similar restorative actions) is GM-only as a rough common-sense ballpark. Tracker recovery applies the stated change, or common sense if no number is given — no duplicated Minor/Moderate/Major lookup table.

## [5.4.6] - 2026-07-15

### Changed
- **Game System Wizard effect-owner examples**: Sustenance reference output is injected at generation time — tracker-owned vs GM-owned threshold effects — matching the current Effect owner selection on Regenerate / Iterate.

## [5.4.5] - 2026-07-15

### Added
- **Game System Wizard prompt editor**: View, edit, copy, and reset the architect system prompt on the initial description screen and the review/iteration screen. Edits apply to in-app Generate, Regenerate, and Iterate; copy the prompt to run the wizard externally (e.g. Gemini).

### Changed
- **Game System Wizard architect prompt**: Appends a full Sustenance (hunger/thirst) output example, clearly marked as illustrative reference only — not a default answer to copy verbatim.
- **Game System Wizard examples**: Sustenance example is no longer baked into the base prompt; it is injected at generation time and switches between `effect_owner="tracker"` and `effect_owner="gm"` variants to match the current Effect owner selection.

## [5.4.4] - 2026-07-15

### Changed
- **Random events + RollTheDice**: `<random_events>` instructs parallel batch rolls (occurrence + type). Tool schema now encourages multiple parallel invocations per turn instead of forbidding them.

## [5.4.3a] - 2026-07-15

### Changed
- **`<quests>` sysprompt**: Formal acceptance uses `*(Quest Accepted—Quest Name Here)*`; emergent goals use `*(Emergent Quest Active—Quest Name Here)*` with the same detail block. Frustration guidance covers formal and emergent quests.

## [5.4.3] - 2026-07-15

### Changed
- **Quest prompts**: Removed emergent-quest auto-tracking from `<quests>`; acceptance now requires {{user}} to clearly take on a task. GM sysprompt assigns `FRUSTRATION_COEFF` and uses engine `MOOD` for questgiver behavior; tracker sets coeff on creation and never outputs `MOOD`.

### Fixed
- **Frustration without deadlines**: MOOD/frustration math no longer runs on quests without a valid deadline; bogus or AI-written `MOOD` lines are stripped when the tracker rewrites `[QUESTS]`.

## [5.4.1] - 2026-07-15

### Changed
- **BENCHED PARTY prompt**: Clarify that permanent [PARTY] removal requires the exact *(Left the party: Name — reason)* string; temporary separations (including {{user}} leaving the scene) use [BENCH], not roster deletion.

## [5.4.0] - 2026-07-15

### Fixed
- **Mobile Lorebook Agent layout**: Detached agent panel fills the viewport; campaign records scroll internally instead of leaving unused space at the bottom. Panel resize is desktop-only.
- **Add NPC to Story dialog (mobile)**: Full-screen modal positioning; prevents off-screen spawn and duplicate overlays while the character list is loading.
- **System Prompt Control Room (mobile)**: Two-line section rows so long tag names and controls no longer overlap; desktop layout unchanged.
- **Mobile settings performance**: Inline drawers use instant show/hide instead of slide animations; collapsed sections skip paint via `content-visibility`.

## [5.3.9] - 2026-07-15

### Fixed
- **Portrait regeneration showed stale image**: Replacing an existing portrait now saves to a new timestamped file so the browser URL changes and the new image displays. Orphaned old files are deleted when no other chat link references them.

## [5.3.8] - 2026-07-15

### Fixed
- **Persona character generation**: Persona button now reads the active avatar's description instead of a stale global cache, so new chats no longer resurrect the first persona ever used when you don't re-click the persona.
- **Chat-Linked Mode**: Settings checkbox now correctly shows on by default on fresh install.

## [5.3.7] - 2026-07-15

### Added
- **Main Prompt Backup**: Automatically snapshots Quick Prompt Main before the framework overwrites it; restored when you click ⏻ on the tracker panel (or uncheck Enable State Tracker). Manual save/restore controls in General & Visuals settings.

## [5.3.2] - 2026-07-14

### Fixed
- **System Prompt Control Room**: Removed nested double scrollbars; only the section list scrolls while the header and toolbar stay pinned.

## [5.3.1] - 2026-07-14

### Changed
- **Tab Mode tab strip**: All module tabs are shown in a wrapping grid that fills each row; overflow "⋯" menu removed.

## [5.3.0] - 2026-07-13

### Changed
- **General & Visuals settings**: Reorganized into Core, Appearance, Module Display, Advanced & Data, and Developer & Reset sections; portrait advanced options collapsed by default.
- **Legacy Dice Logic (Vanilla)**: Moved to Game Systems & Customization → Narrator Configuration → Advanced RNG Settings.
- **System Prompt Control Room**: Custom Sysprompt Mode tucked into a collapsed advanced section at the top of the popup.

### Fixed
- **Custom Sysprompt Mode**: Saving in the Control Room no longer overwrites Quick Prompt Main when the mode is enabled.
- **Edit with AI (stock modules)**: "Apply to Editor" now correctly applies the revised prompt instead of writing `undefined`.

## [5.2.2] - 2026-07-13

### Fixed
- **Character creation XP**: New characters now start at the beginning of the selected level (`XP: 0/max`) instead of maxed-out cumulative XP.
- **Character creation Last Rest**: Initial `[TIME]` block uses `Last Rest: N/A` for brand-new characters who have not taken a Long Rest yet.
- **Last Rest display**: `N/A` and other unset rest values no longer show a bogus relative time (e.g. "8 hours ago").

## [5.2.1] - 2026-07-13

### Changed
- **Day/Night header layout**: Status indicator moved to the left of the title; sun/moon badge is slightly larger and centered between the title area and header icons.
- **Night header starfield**: Night and late-night phases now scatter twinkling stars across the full header bar instead of only around the moon badge.

## [5.2.0] - 2026-07-13

### Added
- **Swipe-safe Lorebook Agent scheduling**: Auto-run on "every N msgs" no longer advances when swiping or regenerating; swiping away from a generation that triggered the agent rolls back lorebook state, rewinds the watermark, and primes the counter to fire on the next real message.
- **Swipe rollback for agent-driven relationships**: `[[REL:]]` deltas from the Lorebook Agent are now recorded per swipe so friendship/affection rollback matches narrative-tag rollback.
- **Scheduler debug instrumentation**: `globalThis._rpgSwipeSchedulerDebug` (`.dump()`, `.snapshot()`, `.log()`, `.togglePanel()`) plus `[RPG Scheduler]` console events when debug mode is on.

### Fixed
- **State Tracker memo swipe rollback**: Memo and relationship swipe trackers no longer share a single marker; memo rollback runs before relationship rollback in the interceptor so both restore correctly.
- **Relationship swipe rollback**: Interceptor no longer wipes `rpgRollbackData` without undoing deltas.

## [5.1.10] - 2026-07-13

### Changed
- **Portrait storage folder**: Renamed from `user/images/rpg_tracker_portraits/` to `user/images/multihogframework_portraits/`. Legacy paths are still recognized for display and purge.

## [5.1.9] - 2026-07-13

Release tag for portrait file-storage work (5.1.6–5.1.8).

## [5.1.8] - 2026-07-13

### Fixed
- **Portrait migration race**: Block `loadChatState` / `saveChatState` while bulk migration runs so async uploads are not overwritten by chat-switch handlers mid-flight. Migrate chat partitions before live state, then re-sync live portraits from the active chat.

## [5.1.7] - 2026-07-13

### Fixed
- **Portrait migration loop on refresh**: Migration now runs after chat state bootstrap, flushes settings synchronously to disk (instead of a debounced save that could be lost on F5), and only shows the success toast once all embedded portraits are actually gone from settings.

## [5.1.6] - 2026-07-13

### Fixed
- **Portrait File Storage**: Custom portraits are no longer stored as base64 inside `settings.json`. New and migrated portraits are saved under `user/images/multihogframework_portraits/` with lightweight path references in settings — preventing settings bloat across many chats and auto-generated portraits.
- **Automatic Portrait Migration**: On load, any legacy embedded base64 portraits (live state and all chat links) are migrated to disk in the background with content deduplication, then settings are re-saved without the image payloads.

### Added
- **Emergency: Purge All Portraits**: Settings button (and improved Remove All Portraits action) deletes managed portrait files on disk and clears portrait maps from the live state and every saved chat link — without touching memos or lorebooks.

## [5.1.5] - 2026-07-13

### Added
- **Day/Night Cycle**: Optional setting that shifts the entire tracker panel's color palette and header sky badge to match the current in-world time parsed from `[TIME]`. Seven phases (late night, dawn, morning, midday, afternoon, sunset, night) override theme CSS variables with smooth crossfades. The header badge is a pure-CSS sun or moon (with twinkling stars at night) — no image assets. Updates live when the user edits time in Raw view or toggles back to Rendered view.

## [5.1.4] - 2026-07-13

### Added
- **Inline Rendering Tag Colors**: Any rendering tag now optionally supports a custom color override directly in the marker, e.g. `((PLS - #E5FFCC))` or `((BADGE - #ff6699))`. Bar-type tags (`((BAR))`, `((XPBAR))`, `((PROGRESS))`) additionally support a two-color gradient: `((BAR - #E5FFCC #003300))`. Colors are strictly validated as 6-digit `#RRGGBB` hex to prevent malformed/unsafe CSS.
- **GM State Memo Formatting Tag Stripper**: Strips all `((...))` rendering markers from the outgoing memo block passed to the GM, leaving clean mechanical data while preserving full visual marker rendering in the player-facing State Tracker panel.
- **Game Cartridges Selective Load Checkbox UI**: Added a checklist dialog when loading a cartridge, allowing users to import only specific groups of settings: State Tracker, Game Systems & Custom Fields, Character Sheets, Portrait Generator, and Lorebook Agent.
- **Lorebook Agent Cartridges Integration**: Added Lorebook Agent prompts (`routerSystemPromptTemplate`, `routerModularPromptTemplate`), modules (`routerModules`), and custom tags (`routerCustomTags`) to the cartridge payload keys, so they are saved and loaded alongside the rest of the configuration.
- **World Progression Prompt Cartridges Integration**: Added the World Progression Report Generation Prompt (`worldProgressionSystemPrompt`) to the cartridge payload. It appears as a dedicated **World Progression** group in the selective load dialog.
- **Lorebook Agent UI Auto-Refresh**: Exposed a re-rendering hook `_rpgRenderAgentCustomTags` to `globalThis`, and wired both custom tags and module lists to refresh in real-time when settings are synced (such as when importing/loading a Game Cartridge).

### Removed
- **Prompt Instruction Cleanup**: Removed the now redundant `- Ignore any formatting data such as ((PLS))` and `- Ignore any formatting data such as ((PILLS))` guidelines from the default system prompts (`constants.js`, `sysprompt.txt`, `sysprompt_legacy.txt`) since formatting markers are now cleanly stripped programmatically on the GM path before injection.

### Changed
- **Simplified GM Marker Stripper**: `memoForGmContext()` now unconditionally removes any `((...))` token in full — no per-tag parsing, no color-suffix special-casing — so new marker syntax (including inline colors) can never leak into GM context.
- **Improved Contrast on Default "Stock" Badges**: Enhanced visual contrast for the `~ stock ~` label badge inside the load checklist dialog by inheriting theme-aware text colors and using adaptive background/borders.

## [4.9.1] - 2026-07-11

### Added
- **Editable Portrait Prompt Templates**: The system prompts used to generate AI image-generation prompts for portraits are no longer hardcoded. Two new editable, resettable prompt templates are available under AI Character Portraits → Portrait Prompt Templates:
  - **NPC / PC Portrait Prompt** — used when generating portraits for NPCs and Player Characters opened from the Lorebook Agent. This prompt already receives the NPC's full lorebook entry verbatim, so you can instruct the AI to prioritize a custom `[CORE]` field (e.g. an "Image Tags"/Danbooru-tags section added via the NPC Section Editor) by referencing it by name.
  - **Character / Party / Combat Portrait Prompt** — used for the main character, party members, and combatants.
  - **Saved Setups**: Save your current pair of prompts (plus the word target below) as a named, reloadable preset (library-style, like Saved Themes), so you can swap between different portrait-prompt styles (e.g. Danbooru-tag-focused vs. natural-language descriptions) without rewriting them each time. Saved setups and the prompt templates themselves now travel with Game Cartridge export/import.
  - **Portrait Prompt Word Target**: The "Keep it under 200 words" instruction in both prompts is now a `{{wordtarget}}` token backed by a new, independent numeric setting (default 200), so the length limit is configurable instead of hardcoded. This is unrelated to the "Major/Minor NPC Section Word Target" fields used for lorebook `[CORE]` sections.
- **NPC/PC Section Editor now included in Game Cartridges**: Your custom Core Identity section layouts (names, descriptions, colors, icons, and ordering for both NPC and PC cards) and their saved presets now travel with Game Cartridge export/import, so a shared cartridge can enforce a specific way of recording characters for that game/system instead of falling back to your locally configured layout.
- **Portrait Generation on the Full NPC Card**: The large portrait shown in the Full NPC Card popup now supports the same click-to-generate/manage overlay as the small NPC card thumbnails in the Lorebook Agent list. Hovering reveals a 🎨/⚙️ icon; clicking opens the portrait settings menu (URL, upload, or AI Generate), and the popup's portrait updates in place immediately after applying, without needing to close and reopen the card.

## [4.9.0] - 2026-07-10

### Added
- **Expanded Relationship Tiers**: Completely overhauled the Friendship and Affection systems, expanding them from 7 to a highly granular 13-tier system. The scale is now perfectly symmetrical, with the "Neutral" zone significantly tightened and multiple new intermediate tiers added (e.g., "Unreceptive/Withdrawn", "Amicable"). This eliminates all previous massive dead zones in early positive and negative relationship progression. All `{{user}}` macro strings have also been cleanly removed from behavioral hints to prevent token/interpolation bugs.
- **NPC Section Editor & PC Section Editor**: Brand new, fully interactive editors for customizing how Character details are tracked! You are no longer stuck with the default sections. You can now easily **add new sections**, **edit existing ones**, **delete them**, and fully reorder them to fit your campaign's unique needs.
  - **Preset Support**: Save your favorite section layouts as presets and load them anytime with a single click. No need to rebuild your sections from scratch for different types of campaigns!
  - **Visual Customization**: Every section now supports choosing a custom color and assigning an emoji. These will be beautifully rendered inside the popup character cards and tracker UI, making your character details pop out perfectly.
- **Character Creator Presets**: The Character Creator now features a persistent Presets system. You can save your currently entered fields (Species, Traits, Class, etc.) as a named preset, then instantly load them later via a dropdown menu to skip repetitive typing for common character archetypes.
- **NPC Strengths & Flaws Sections**: Two new sections — `Strengths` and `Flaws` — are now part of every NPC `[CORE]` block. The AI is instructed to keep them concise (sharp phrases over prose) and use asymmetric counts to reflect character nature (e.g. a villain gets more flaws; a kindly mentor gets more strengths). Both sections are parsed and rendered in the full NPC card UI with distinct icons (⚡ and ⚠️) and colors (green / red).
- **Dual-Mode "Add as is" NPC Import**: The "Add as is" button on character card import now supports two configurable modes, selectable in ⚙️ NPC Settings:
  - **Literal** — Wraps the card's raw description verbatim in `[CORE][/CORE]` tags. No AI is involved. The card's existing writing is treated as canonical.
  - **AI Review** — Sends the card to the AI for a *minimal* fix pass that resolves only hard logical impossibilities (e.g. a smartphone in a medieval setting, modern slang in a historical world). Original prose is preserved as faithfully as possible.
- **📥 Import Card — PC Import Flow**: A new `📥 Import Card` button is now available alongside the existing archetype buttons on the State Tracker startup screen. Clicking it opens an inline character picker with search/filter and per-card action buttons:
  - **📋 Add as is** — Performs a minimal AI review (era/world conflict fixes only) then generates a persona bio from the card.
  - **🤖 Fit into Story** — Fully adapts the character to the current campaign setting before generating a state memo and persona bio.
  - Both modes: (1) send a `sendDirectPrompt` to generate the tracker state memo blocks directly in the chat, then (2) generate a persona bio via the router AI and surface it in the existing Persona Confirm overlay for review and one-click lorebook registration.

- **✨ Edit with AI — Full PC Card & Full NPC Card**: Both the Full PC Card and Full NPC Card popups now include an **"✨ Edit with AI"** button stacked below the existing "✏️ Edit Text" button. Clicking it opens an AI edit pane where you describe the changes you want (e.g. *"Make the background more tied to the ongoing war"*). The AI rewrites the entire character entry with those changes applied, then surfaces a preview textarea. From the preview you can **✅ Apply** the result (persisted to `pc.bio` for the PC, or saved to the lorebook entry for NPCs) or **🔄 Regenerate** for a fresh attempt — all without leaving the popup.

### Changed
- **NPC Import Default Fidelity**: The "Ignore Character Limits When Importing Character Cards" setting is now ON by default. This ensures the AI stays as faithful to the original character card as possible without attempting to truncate or heavily condense their background and personality to fit standard NPC lore budgets.
- **`buildNpcInstruction` / `router.js` field lists**: All NPC-related field enumerations, tool schemas, update instructions, and legacy wrap patterns now include `Strengths` and `Flaws`.
- **NPC section parser / renderer**: `parseNpcSections` and `renderSectionsHtml` now recognize and visually distinguish `Strengths` (green, ⚡) and `Flaws` (red, ⚠️) from the rest of the Core Identity sections.
- **Literal add verbatim limit**: Raised the character card description slice from 1,500 to 3,000 characters for literal adds to avoid silently truncating long cards. Personality is only appended when it is not already embedded in the description.
- **"Fit into Story" Background Adaptation**: The persona bio `Background` section generated when importing a character card via "🤖 Fit into Story" now explicitly adapts the character's backstory to the current campaign setting and world context, rather than grounding it solely in the source card. The overall rewrite instruction was also strengthened to actively integrate the character into the world's lore and ongoing story.

### Fixed
- **PC Import Portrait Sync**: Fixed a bug during "Fit into Story" PC imports where the AI deciding to rename the character (e.g. inventing a surname to a firstname only Card) would break the portrait binding in the State Tracker. The system now extracts the newly generated name from the state memo and maps it back to the original card's avatar.
- **Custom Currency Rendering**: Fixed a bug where custom fantasy currencies containing additional words (e.g. "130 Gold Dragons", "50 Silver Staggs") would fail to render as inline coin badges. The inventory currency parser now correctly captures up to two trailing descriptor words.
- **Abilities Block Rendering**: Fixed a bug where abilities containing multiple commas in their description or using a "Name: Description" format were incorrectly split into separate broken pills. The formatting parser is now less rigid, allowing complex abilities like "Rage (2/2 per day): Advantage on Strength checks/saves" to render perfectly as single, unbroken elements while maintaining backwards compatibility with old comma-separated lists.

## [4.8.9] - 2026-07-10

### Added
- **Colored Progress Variants**: Added a full suite of color-coded variants for the `((PROGRESS))` marker (e.g. `((PROGRESSRED))`, `((PROGRESSBLUE))`, `((PROGRESSGREEN))`) to expand dynamic visual tracking options in the library.
- **Dynamic AI Tag Engine**: The Game Wizard AI now automatically synchronizes with the core renderer library, meaning it instantly understands the visual formatting and contextual meaning of all existing and future progress tag variants when generating new custom tracking modules.
- **Progress Bar Recoloring**: All `((PROGRESS))` markers in the state tracker are now natively clickable. They utilize the same intuitive color-wheel picker as standard bars, allowing players to dynamically override their fill colors on the fly.
- **Nine New Visual Components**: Vastly expanded the rendering engine with 9 entirely new, fully dynamic visual markers:
  - `((CLOCK))` - Blades in the Dark style rotating conic-gradient clocks.
  - `((STARS))` - 5-star rating icons for reputation/quality.
  - `((WEIGHT))` - Encumbrance bars that dynamically shift color at 75% and 100%.
  - `((WEATHER))` - Dynamic weather badges that automatically match string keywords to thematic emoji (e.g. 🌧️, ☀️, ❄️).
  - `((ORBS))` - Glowing resource action points (similar to Ki or spell slots).
  - `((SLOTS))` - Hollow grid slots for tracking discrete inventory capacity.
  - `((PHASE))` - Connected "subway map" style breadcrumb nodes for multi-stage events.
  - `((GAUGE))` - Semi-circle speedometers with a rotating needle for tension/morale tracking.
  - `((CHARGE))` - Segmented battery icons that flash red when depleted.
  *Note: All progression-based tags natively support color-wheel recoloring by clicking them in the state tracker!*

### Fixed
- **Centralized Tag Examples**: Moved all rendering tag example strings directly into the core `MARKER_TYPE_MAP` definition instead of maintaining them in separate UI files. This architectural improvement ensures that whenever a new tag is added to the engine, its AI context and UI preview are automatically defined and synchronized in one place.

## [4.8.7] - 2026-07-10

### Fixed
- **Dice Tool Forced-Failure on Malformed Formula**: Fixed `RollTheDice` silently returning a `0` result (an automatic FAILURE against any DC) when the LLM supplied a formula the parser couldn't understand — e.g. comma-joined duplicate formulas like `"1d20+1,1d20+1"` instead of a single `"1d20+1"`. The tool now recovers from comma-separated formulas by using the first valid segment, and falls back to rolling a plain `1d20` (flagged in the result) instead of ever returning an empty/zero roll. Also tightened the tool's `formula` parameter description to instruct the LLM to pass exactly one dice expression per call.

## [4.8.6] - 2026-07-10

### Fixed
- **Critical: Fresh-Install Hang (Infinite Recursion)**: Fixed a bug where `getSettings()` and the NPC/LOC/FAC instruction builders (`buildNpcInstruction`, `buildLocInstruction`, `buildFacInstruction`) could recurse into each other during the settings-migration pipeline. Each migration block called a builder *before* bumping `settingsVersion`, and the builders called `getSettings()` back to read `useDdMmYyFormat`/`npcRelationshipBars` — so the nested call would see the still-old version, re-enter the same migration block, and call the builder again, looping until the stack overflowed. This only affected brand-new installs (no saved `settingsVersion`) and configs below `4.5.0`, silently freezing SillyTavern on load. Added a re-entrancy guard to `getSettings()` so nested calls return the in-progress settings object instead of restarting the migration pipeline.
- **Version Comparison in Migrations**: Migration gates previously compared `settingsVersion` with plain string comparison (e.g. `'4.10.0' < '4.5.0'` incorrectly evaluates `true`), which would misfire once a double-digit minor/patch version is reached. Replaced with a proper numeric segment-by-segment version comparison.

## [4.8.5] - 2026-07-09

### Added
- **Player NPC Safeguard**: Implemented detailed prompting rules to check chat log dialog and prevent creating duplicate NPC entries for the player's persona or in-character name/alias (e.g. "Dave Davidson").
- **Faction [CORE] Tags**: Standardized Faction (FAC) entries to wrap permanent description text inside `[CORE] ... [/CORE]` tags, matching Location formats.

### Fixed
- **Settings UI Cartridge Sync**: Modified settings UI loading code to immediately re-sync toggles (including RNG settings) when loading a game cartridge or closing the cartridge menu, resolving the need for manual browser refreshes (F5).
- **CORE Tag Auto-Stripping**: Corrected a regular expression filter in the content sanitization function that was accidentally stripping out `[CORE]` and `[/CORE]` tag lines from committed lorebook entries.

## [4.8.0] - 2026-07-09

### Added
- **Full Module Context for Wizard**: The Game System Wizard now receives the complete prompting instructions, templates, and active states of all enabled stock modules, custom fields, and custom GM sections. This enables the AI generator to be fully influenced by existing formatting and rules in the workspace.
- **Complete Tags Library Exposure**: Expanded the wizard's rendering library hints to expose all 30+ available tags, resolving a bug where the AI was unaware of advanced tags like `((PROGRESS))` due to a hardcoded 12-item slice limit.
- **Pill Hygiene Instructions**: Added explicit guidelines to the Game System Wizard and AI Custom Field Creator prompts to prevent the AI from prefixing every item in a list with the `((PILLS))` tag, avoiding visual rendering issues.

## [4.7.0] - 2026-07-09

### Added
- **Game System Wizard Upgrades**: Improved the prompt generation wizard to support compound meters, scaled magnitudes, and natural-language inline delta annotations (e.g., `*(Food eaten: Chocolate Bar. +75 Hunger)*`).
- **UI Feedback for Wizard**: The Game System Wizard button now disables and displays a loading spinner (`Generating...`) while the LLM is generating drafts.
- **Bar Percentage Mode**: Added a "Show as Percentage" option to HP/XP and custom status bars in the recolor popup. When enabled, it displays the value scaled out of 100 (e.g., `50/100`), keeping the backend math identical for AI parsing.
- **Native Portrait Generator Default**: Swapped the default portrait generator from Pollinations.ai to the SillyTavern native Image Generation Extension to bypass the new Pollinations PAYG paywall, and added an informative configuration tooltip.
- **Unlock Base Sections**: Added capability to fully override built-in system prompt sections (e.g. `<combat>`) directly from the settings panel.

### Changed
- **Modular Code Architecture**: Split the monolithic `index.js` into dedicated, domain-specific modules:
  - `game-systems.js`: Core RPG game system logic, template building, and AI wizards.
  - `character-creator.js`: Character creator panel, attributes, and onboarding flow.
  - `theme-manager.js`: UI themes, CSS injection, and the custom bar recolor popup.
  - `ui-editors.js`: Custom fields editor, prompt templates, and imports/exports.
  - `ui-geometry.js`: Resizing math, dragging handlers, and viewport geometry adjustments.

### Fixed
- **State Save Performance**: Solved the UI lag/freeze during typing by debouncing live setting saves by 2000ms, and implemented smart flushing that instantly commits edits before switching views or switching chats.
- **State Leakage**: Fixed cross-chat state leakage in `saveChatState` by using the authoritative `getActiveChatId()` rather than potentially stale event sources.
- **Custom Field Editor Sandbox**:
  - Restored correct synchronous `renderMemoAsCards` preview rendering in the custom fields editor.
  - Fixed page navigation in the testing sandbox live preview.
  - Forced live preview to default to a clean, non-paginated mode.

## [4.6.2] - 2026-07-07

### Fixed
- **Full NPC Card**: Fixed the NPC detail popup failing to open due to missing `portraitSrc`, `hidePortrait`, and `ctx` bindings in `openNpcDetailPopup`.

## [4.6.0] - 2026-07-07

### Added
- **Character Creator**: Introduced a brand new `🎲 Character Creator` button in the starting screen that streamlines character creation!
  - Features intuitive inputs for Name, Gender, Age, Orientation, Species, Ethnicity, Genre, Level, and Class.
  - Automatically seeds the initial framework state with rich, personalized stats and background tags.
  - Remembers your last-used form values when you press **Generate Character**, with a **Reset** button to clear fields.
  - Added a **Create Persona** checkbox that automatically generates a rich background, appearance, habits, and personality for your SillyTavern persona! Features customizable word count targets (ranging from 100 up to 1000+ words).
- **Player in Lorebook Agent**: The Lorebook Agent and State Tracker have been upgraded to officially track and render the player entry.
  - The framework now seamlessly integrates player profile cards directly into the UI, ensuring your character's active narrative state is always synced and accessible.

### Fixed
- **PC & State Persistence**: Fixed a critical bug where the newly created player entry (and the state memo) would disappear if SillyTavern was refreshed immediately after generation or after the framework automatically updated the memo via swipe/AI generation. The framework now forces a synchronous save when modifying chat state partitions, preventing SillyTavern's debounce timer from losing uncommitted data on page unload.
- **Persona Injection**: Fixed **Inject as Current Persona** so it creates or updates a real SillyTavern persona (via native APIs) instead of only filling the transient description textarea.


## [4.5.2] - 2026-07-06

### Fixed
- **System Prompt Injection Safeguards**: 
  - Prevented the extension from automatically writing the D&D system prompt to SillyTavern's prompt editor when the extension is powered off via the panel's power button.
  - Ensured that enabling **Custom Sysprompt Mode** prevents any automatic system prompt injection or overwriting on page refresh (F5) or settings updates, leaving manual buttons (Apply/Reset) as the only way to write the prompt.
  - Toggling the extension back to ON now instantly writes the system prompt.

## [4.5.0] - 2026-07-06

### Added
- **Optimized UI Toggles**: Moved all layout collapse/expand and view state flags (including panels, drawers, console, modular repertoire, world progression, active keys drawer, and Raw View toggle) to browser `localStorage` to completely bypass global settings serialization, resolving the 1-second lag post-click.
- **Mobile UI Enhancements**:
  - Added responsive headers that automatically abbreviate the text to "Multihog D&D" on mobile screens.
  - Repositioned the **Direct Prompt** (💬) and **Raw View** (⊞) action buttons to the top header bar next to **Lorebook Agent** (🤖) for quick access.
  - Enlarged the collapse chevron and added a safety spacing gap on mobile to prevent accidental triggers of the close button.

## [4.4.2] - 2026-07-06

### Changed
- **Hybrid RNG sysprompt**: RollTheDice (out of combat) is now rule #1 with clearer default-state wording; RNG queue reserved for post-initiative combat rounds only.
- **RNG constraints**: Reinforced default-to-tool-call behavior and added tie-breaker when combat vs. non-combat is ambiguous (e.g. initiative transition).

## [4.4.1] - 2026-07-06

### Added
- **Relationship tier badges in UI**: NPC grid cards and detail popup show live Friendship/Affection tier labels (same logic as `[NPC_RELATIONS]`), with intensity-scaled pill colors that grow greener/pinker toward max.

### Changed
- **Tier thresholds rebalanced**: Wider neutral band (25% of max) so early positive values no longer jump to FRIENDLY too quickly.
- **Affection neutral tier**: Renamed from NEUTRAL CURIOSITY to NEUTRAL/NO AFFECTION for clarity.

## [4.4.0] - 2026-07-06

### Added
- **Adjustable NPC relationship scale**: Friendship/Affection max (±N) is configurable per chat when chat linking is enabled, with a separate global default for new chats (Extension Settings + Campaign Records ⚙️ NPC Settings).
- **Dynamic relationship prompts**: Lorebook Agent NPC/`rel` guidelines, router cap hints, `[NPC_RELATIONS]` header, and narrator `<relationship_tracking>` sysprompt block all reflect the active chat's configured range.

### Changed
- **Relationship tiers**: FRIENDLY, HOSTILE, etc. thresholds are proportional to the configured max instead of hardcoded ±25/±60 values.
- **Narrative deltas unchanged**: Tag awards (+5 stays +5); only clamp, bar fill, tiers, and starting-value guidance scale with the range.

## [4.3.9] - 2026-07-06

### Changed
- **LOC [CORE] format**: Lorebook Agent now uses plain `[CORE]` with 1–2 sentences for locations — no NPC field headers (Appearance/Personality/Habits). FAC/QUEST/EVENT explicitly do not use `[CORE]`.
- **Campaign Records rendering**: Non-NPC expanded entries show a styled Permanent block for `[CORE]` content, with timestamped chronicle lines below.

## [4.3.8] - 2026-07-05

### Fixed
- **NPC card expand layout**: Expanded lore entries now stack below the portrait/header row instead of overlapping status badges and relationship bars when NPC portraits are enabled.
- **NPC card synopsis width**: Appearance blurb now uses the full card width and shows up to four lines (was two), with a higher character cap.

## [4.3.7] - 2026-07-05

### Added
- **Onboarding Initial Setup step 4**: Reminder to match SillyTavern Persona name to the State Tracker character after creation.

### Fixed
- **Scenario Profiles stock modules**: Profiles now save and restore stock module prompt edits (all TIME variants), module enable/order, and per-module pagination settings. Chat-linked state uses the same snapshot helpers.

## [4.3.6] - 2026-07-05

### Added
- **Per-chat time/date settings**: 24h clock, Day vs DD/MM/YYYY calendar, and initial date anchor are saved per chat ID when chat linking is enabled.
- **Onboarding layout**: Redesigned top config row with segmented Day/Date and 12h/24h toggles, Sci-Fi and Horror genre templates with matching archetype buttons, and section dividers (How It Works / Setup Guide).

### Changed
- **Time/date UI sync**: All time and date controls (onboarding, Modules & Order pills, Extension Settings) funnel through shared setters so they never show contradictory state.
- **TIME module prompt editor**: Edit/Reset now picks the correct stock prompt variant (`time`, `time_24h`, `time_ddmmyy`, `time_ddmmyy_24h`) based on both clock and calendar toggles.
- **Status footer placement**: `<end_of_output_footer>` moved immediately after `</combat>` in both sysprompt files for higher prompt attention.
- **Onboarding copy**: Updated How It Works, Initial Setup (time/date step), and simplified model recommendations (MiMo 2.5 Pro GM, GPT-5.6 Luna for tracker/agent).
- **Lorebook Agent docs**: Removed obsolete Max Tokens control reference; Campaign Records now explains native Lorebook book creation instead of a separate Campaign Prefix control entry.

## [4.3.5] - 2026-07-05

### Added
- **Quest archive UI**: Completed and failed quests move to separate COMPLETED / FAILED sections; archived entries can be dismissed manually. **Show archived quests** toggle in settings (default on).
- **Edit with AI (Modules)**: **Edit with AI** button in both the stock prompt editor and Custom Module Editor — describe changes in plain language and the AI revises the module with preview/accept flow, same pattern as Add Custom (AI).

### Changed
- **Quest memo cleanup**: Archived quests (completed, failed, past deadline) are synced to settings then stripped from the stored `[QUESTS]` memo automatically; the model no longer needs to omit them.
- **Quest prompt wording**: Restored instructions to keep completed/failed quest entries with updated STATUS so the tracker can archive them before memo strip. Auto-migrates saved prompts that used the over-aggressive “active only” wording.

### Fixed
- **Empty `[QUESTS]` on completion**: State Tracker no longer told to emit an empty quest block when the last active quest completes — preventing lost archive sync.
- **Stock prompt editor pagination**: TIME (24h) module now uses the correct block tag for pagination threshold lookup.

## [4.3.4] - 2026-07-05

### Performance
- **Faster page reload (F5)**: Startup no longer blocks on full lorebook registry scans, duplicate chat-bootstrap work, or Campaign Records rendering while the Lorebook Agent panel is closed.
- **Faster Campaign Records**: Routine manifest refreshes skip disk/registry rescans; the manual ↻ refresh button still performs a full scan to discover newly cloned or external books. Lorebooks load in parallel; NPC inline editors build lazily on first expand.
- **`disableManagedEntries` optimized**: Uses saved campaign book lists where possible, avoids redundant API probes, loads books in parallel, and runs deferred in the background.

### Added
- **Show NPC Portraits toggle**: When disabled, NPCs use the compact list view (like Events/Locations), NPC portrait auto-generation is turned off, and **Add NPC to Story** remains available.
- **Compact NPC list enhancements**: CORE address-card button (left of name), relationship stats (🤝/💗) when Relationship System is enabled, live rel-stat DOM updates without a full manifest reload.
- **Last Run / Next run status**: Lorebook Agent footer shows when the agent last ran (relative time) and a countdown to the next auto-run.
- **Reset Timeline**: New button in the Lorebook Agent panel and Extension Settings to reset World Progression timer state for the current chat.
- **Combat auto-switch**: When `[COMBAT]` is active in the State Tracker memo, switches the main narration Connection Manager profile via `/profile` and restores the baseline when combat ends.
- **Combat completion preset override**: Combat auto-switch can restore a separate chat completion preset alongside the connection profile.

### Changed
- **Renamed setting**: “Enable RPG Tracker” → **Enable State Tracker** in settings and tooltips.
- **Quest system simplified**: LogQuest / tool-based quest mode removed; plain-text `[QUESTS]` blocks are now the only quest path.
- **World Progression timer model**: Label-based timer anchor, fixed epoch handling, conditional narrative injection; “last fired” state is per-chat.
- **[CORE] prompt tightening**: Lorebook Agent instructions now discourage plot-tied scene recaps in permanent NPC identity blocks.
- **World Skeleton isolation**: Skeleton books excluded from agent archive, tools, activation, and Campaign Records manifest.
- **Activate Books**: Refreshes Campaign Records after activation so new books appear without F5.

### Fixed
- **Since-last-run watermark**: Persists per chat, handles swipes/stale indices, restores correctly on undo/redo; auto-run throttle resets after manual agent passes.
- **World Progression persistence**: Timer state saves to chat-linked state, survives reloads, and no longer bleeds between chats; “Next fire” display derives from stored label with memo-time fallback.
- **Character creator XP**: `[XP]` block always included with level-specific thresholds; onboarding level dropdown forwarded correctly for all archetypes (Custom, Persona, etc.).
- **Quest state on rollback & chat switch**: Clears per-chat quest bleed; `settings.quests` resyncs from memo on restore; memo is authoritative over stale completed entries in the UI.
- **NPC manifest refresh**: Fixed scoping bugs when toggling portrait mode; settings toggle now reloads Campaign Records immediately.
- **Onboarding prompt hints**: Opening/closing tags enforced to reduce unclosed block output from the model.
- **`saveSettings` reference** in `narrative-hooks.js`.
- **NPC detail popup**: Removed “(Immutable)” from Core Identity section header.

## [3.8.9] - 2026-07-01

### Fixed
- **NPC Portrait Generation Routing**: Fixed a bug where auto-generating portraits for NPCs incorrectly used the default Portrait AI connection settings instead of the dedicated Lorebook Agent AI connection settings, ensuring context-aware models handle the complex lorebook generation.
- **NPC Word Count Cap**: Raised the internal hard cap for NPC major/minor section word targets from 100 to 1,000 words. Previously, typing a value like `400` in settings would silently clamp and save as `100`, forcing the AI to abbreviate lore. The quick-settings popup and main extension panel now correctly persist custom large limits.

## [3.8.8] - 2026-06-30

### Added
- **Relationship Bars System Rework**: Overhauled the NPC relationship bar system from a cosmetic feature into a functional, AI-driven mechanic. The narrator AI now emits inline annotations (e.g. `*(Affection: Elena +2 — sincere compliment)*`) at the point of interaction and machine tags (`[REL: Name | field | delta]`) at the end of each response. Tags are automatically parsed, deltas applied to the relationship bars (clamped ±100), and the updated values written back to lorebook NPC entries as the persistent campaign database. Context injection (`[NPC_RELATIONS]`) provides the narrator with a live snapshot of current standings for active NPCs only, keeping token usage minimal. System prompt guidance added with calibrated delta examples for both Friendship and Affection.
- **Always Auto-Generate NPCs (Lorebook)**: Introduced a new settings toggle to automatically generate portraits in the background for new or updated NPCs created by the Lorebook Agent, aligning the behavior with existing auto-generation options for Party and Enemies.

## [3.8.6] - 2026-06-28

### Fixed
- **NPC [CORE] Format Reinforcement**: Explicitly instructed the LLM to start NPC description fields directly with `[CORE]` and prohibited any prepended timestamps (e.g. `[Day X, HH:MM] [CORE]`).
- **Improved Lorebook Agent Example**: Refactored the NPC example inside the system prompt in `router.js` to correctly demonstrate starting the description with a `[CORE]` block.
- **Settings Migration**: Added a migration block for settings version `3.16.16` in `state-manager.js` to automatically regenerate the NPC instruction field for upgrading users.

## [3.8.5] - 2026-06-28

### Added
- **24-Hour End of Output Footer**: Configured the system prompt builder (`buildSysprompt`) in `index.js` to dynamically alter the `<end_of_output_footer>` template to direct the LLM to output times in 24-hour format (`HH:MM` instead of `HH:MM AM/PM`) when the 24-hour setting is enabled.
- **LogQuest Tool Format Instructions**: Updated the `LogQuest` function tool description in `quests.js` to dynamically format its deadline time parameters and instructions to match 24-hour clock formats when 24h mode is active.
- **24-Hour Time Format Toggle**: Added a user configuration checkbox ("Use 24-Hour Time Format") in the extension settings menu under the TIME module row.
- **Dynamic Prompt Customization**: Automatically swaps the instruction examples for the `[TIME]` module to the clean 24-hour format prompt variant (`time_24h`) when 24h time is enabled.
- **Time Parsing & Formatting**: Updated the in-world time parser to support optional AM/PM parsing and consolidated all display timing helpers to respect 24-hour format.
- **NPC Creator with Tabbed Dialog**: Added "Add NPC to Story" creator with tabs for card import, freeform, and archetype selection.
- **Custom Archetype Input**: Added a custom archetype input that shows only when the "Custom" chip is selected.
- **Edit Text Button in Full NPC Card**: Added an "✏️ Edit Text" button directly inside the Full NPC Card popup with live refresh of the view pane after saving.
- **Ignore Character Limits When Importing**: Added a setting to omit the `<CORE LENGTH TARGETS>` section from the NPC prompt when importing character cards.
- **Appearance/Species Field**: Renamed Appearance field to Appearance/Species for clarity.
- **Programmatic CORE Block Protection**: Cleanup/consolidate tools now programmatically protect `[CORE]` blocks from modification.
- **Portrait Settings Menu Unconditional**: Portrait settings menu now shows unconditionally on NPC portrait click.

### Fixed
- **Prevent NPC Creator Duplicates**: NPC Creator no longer duplicates existing entries.
- **Panel Position Drift**: Fixed panel position drift on F5 / code reload.


## [3.16.13] - 2026-06-25

### Changed
- **Significant NPC Filtering**: Updated the core NPC instruction template to instruct the model to only record characters who are significant to the campaign (excluding minor nameless NPCs, generic random enemies, or nameless bartenders).
- **Combat Granularity and Summarization Rules**: Reinforced prompts across NPC instructions, event modules, main Researcher Agent update rules, and the Lorebook Archivist cleanup/consolidation rules to forbid granular, turn-by-turn combat status logging (HP updates, condition tracking, minor actions). Instructed models to summarize combat history into macro-level outcomes while explicitly preserving the combat initiation (e.g. who/what attacked {{user}}), progress updates every ~5 rounds for long-running fights, and final resolution.

## [3.16.10] - 2026-06-25

### Added
- **Restored NPC Relationship Bars**: Reverted the removal of the NPC Relationship Bars feature, bringing it back in FULL.


## [3.16.9] - 2026-06-25

### Fixed
- **Character Card Converter Toggle**: Added missing tree render refresh triggers on toggle checkbox state change, ensuring that toggling the setting immediately hides or shows the "Add NPC from Character Card" action button.

## [3.16.7] - 2026-06-25

### Changed
- **Plain Text Action Prompts**: Instructed text-mode agent prompts (both for main research agent and cleanup agent) not to wrap `Action:` or `Thought:` labels in markdown bold/italic tags, reinforcing clean formatting from the model side as well.

## [3.16.6] - 2026-06-25

### Changed
- **Robust Text Action Parsing**: Updated the `parseTextAction` regex to tolerate markdown formatting (bold, italic, list hyphens, or headers, e.g. `**Action:**` or `### Action:`) in the model's text-mode response. This prevents unnecessary nudging retry loops and saves context/API tokens.

## [3.16.0] - 2026-06-24

### Changed
- **{{user}} Macro Reinforcement**: Added explicit rules to `buildNpcInstruction` and the general system prompt (`systemPromptTemplate`'s `updating_entities` block) telling the AI model to always use the exact macro string `{{user}}` when referring to the player character/user, instead of writing "user" or "player" in plain text.

## [3.15.0] - 2026-06-24

### Added
- **Interactive NPC Relationship Editor**: Added sliders to the NPC detail popup (View NPC card) enabling direct, manual adjustments to the Friendship and Affection levels from -100 to +100.
- **Visual Separation of Core Identity and Dynamic History**: Split the parsed NPC description inside the details popup into distinct "Core Identity (Immutable)" and "Campaign History & Dynamic Lore" sections.
- **Styled Timestamps**: Formatted timestamped entries inside the Campaign History section with high-contrast, inline badges.

### Changed
- **Strict CORE Block Guidelines**: Instructed the NPC AI model to start its output directly with the `[CORE]` block and avoid prepending timestamps or dates before the tag.

## [3.14.0] - 2026-06-24

### Changed
- **NPC Lore Identity Prompts**:
  - Rebuilt the NPC generation prompt limits: moved from hard token budgets to section-specific word budget targets.
  - Wrapped `CORE_FORMAT` contract details and `CORE LENGTH TARGETS` settings inside XML tags within the built-in system prompt to guide the LLM's adherence to template layouts and length limits.

## [3.11.4] - 2026-06-24

### Added
- **Apply Sysprompt Button**:
  - Restored the **Apply Sysprompt** button under the Narrator Configuration block in the General & Visuals menu.

## [3.11.3] - 2026-06-24

### Changed
- **Sync with Main (3.8.10)**:
  - Integrated settings drawer restructuring, library reset button, automated prompt application on toggle, and experimental features removal.

## [3.11.2] - 2026-06-24

### Fixed
- **System Prompts Constraints**:
  - Removed `[RNG_QUEUE v6.0_PROPER] is ONLY used in active combat` constraint from `sysprompt_legacy.txt` and its fallback copy in `constants.js` under `<RNG_constraints>`.

## [3.11.1] - 2026-06-24

### Fixed
- **System Prompts Footer**:
  - Restructured `<end_of_output_footer>` to explicitly instruct the narrator to output ONLY {{user}}'s current HP, XP, level, and location, preventing the display of other party members' stats.

## [3.11.0] - 2026-06-24

### Added
- **Protect Persistent NPC Lore Sections**: Implemented wrapping of persistent NPC lore sections (Appearance, Personality, Brief Background, Habits/Behaviors, Relationship) inside `[LORE] ... [/LORE]` tags to protect them from cleanup passes.
- **UI Tag Hiding**: Programmed the UI manifest synopses and structured sections rendering to automatically strip `[LORE]` tags, keeping the presentation clean.
- **Cleanup Tool Lore Protection**: Updated the cleanup agent instructions to strictly preserve `[LORE] ... [/LORE]` blocks unchanged and automatically wrap legacy untagged NPC entries.
- **NPC Inline Quick-View**: Enabled NPC card expansion inline on single-click (matching Location behavior) to easily read full campaign logs and history, adding a new dedicated `View NPC card` button to the card actions overlay for rich details popup access.
- **Relationship Key Normalization**: Resolved a pre-existing layout bug by normalizing the `Relationship with {{user}}` section name to `Relationship`, restoring correct icon and coloring rendering in the UI.

## [3.10.0] - 2026-06-23

NPCs V2.

**Revamped NPC AI Prompts**: The underlying instructions driving NPC generation have been rebuilt from the ground up to ensure the AI adheres strictly to your new token budgets and concisely captures the character's essence without purple prose.

**Revamped NPC Pop Up menu**: The underlying instructions driving NPC generation have been rebuilt from the ground up to ensure the AI adheres strictly to your new token budgets and concisely captures the character's essence without purple prose.

**Add NPC from Character Card (Experimental feature, disabled by default)**: A simple converter that allows inserting any character card you have on your SillyTavern folder into an on-going campaign, with an option to use AI to better fit it into the story. It's disabled by default because letting the Lorebook Agent create genuine NPCs is recommended over this, but is there in case you *really* want to see a card you like in the Multihog framework.

**AI Portrait Generation**: High-quality AI portrait generation is now seamlessly integrated! Instantly generate visual representations of your NPCs and characters to bring your campaign to life.

## [3.8.11] - 2026-06-24

### Added
- **Apply Sysprompt Button**:
  - Restored the **Apply Sysprompt** button under the Narrator Configuration block in the General & Visuals menu.

## [3.8.10] - 2026-06-24

### Removed
- **Outdated Description**:
  - Removed outdated description text in the **Sysprompt Editor** drawer.

## [3.8.9] - 2026-06-24

### Added
- **Library Reset Button**:
  - Added a red reset button (`#rpg_tracker_btn_reset_sysprompt_library`) inside the **Sysprompt Editor** drawer, placed side-by-side with the Custom Sysprompt Library button. This button disables all custom sections in the library and immediately auto-applies the default system prompt template based on active settings.

## [3.8.8] - 2026-06-24

### Removed
- **Apply Sysprompt Button**:
  - Removed the **Apply Sysprompt** button from the main settings (General & Visuals) as well, completely removing manual sysprompt application buttons from the extension UI.

### Changed
- **Auto-Apply on Custom Sysprompt Toggle**:
  - Configured the **Custom Sysprompt Mode** checkbox to immediately re-apply the correct system prompt according to active settings when it is unchecked.

## [3.8.7] - 2026-06-24

### Removed
- **Sysprompt Editor Button**:
  - Removed the duplicate **Apply Sysprompt** button from the **Sysprompt Editor** (SUB-DRAWER 5) completely, leaving it solely under the **Narrator Configuration** block in **General & Visuals**.
  - Renamed the drawer from **Sysprompt Editor & Reset** to **Sysprompt Editor** to reflect the button removals.

## [3.8.6] - 2026-06-24

### Changed
- **Sysprompt Reset Button Relocation**:
  - Moved the **Reset All & Apply** button from under the **Narrator Configuration** block to be positioned directly above the **FACTORY RESET** button at the bottom of the **General & Visuals** sub-drawer.
  - Made the general **Apply Sysprompt** button under the **Narrator Configuration** block full-width.

## [3.8.5] - 2026-06-24

### Removed
- **Experimental Features**:
  - Completely stripped the **Experimental Features** sub-drawer from settings.html.
  - Removed all corresponding Javascript logic, default options, and UI bindings for **Half Review Mode** and **Full Review Mode**.

## [3.8.4] - 2026-06-24

### Changed
- **Sysprompt Button Relocations**:
  - Relocated the **Reset All & Apply** button out of the "Sysprompt Editor & Reset" drawer (SUB-DRAWER 5) and into "General & Visuals" (SUB-DRAWER 1), side-by-side with a duplicate **Apply Sysprompt** button below the Narrator Configuration system prompt builder block.
  - Renamed the SUB-DRAWER 5 section header to "Apply Sysprompt" to match its updated content.

## [3.8.3] - 2026-06-24

### Changed
- **Sysprompt Settings Drawer Restructure**:
  - Renamed the drawer to "Sysprompt Editor & Reset".
  - Moved the AI-Assisted Section Builder and Custom Sysprompt Library sections to the top of the drawer.
  - Consolidated the Normal and Legacy update buttons into a single "Apply Sysprompt" button that dynamically chooses between `sysprompt.txt` and `sysprompt_legacy.txt` based on the user's active RNG settings.

## [3.8.2] - 2026-06-24

### Fixed
- **System Prompts Constraints**:
  - Removed `[RNG_QUEUE v6.0_PROPER] is ONLY used in active combat` constraint from `sysprompt_legacy.txt` and its fallback copy in `constants.js` under `<RNG_constraints>`.
## [3.8.1] - 2026-06-23

### Fixed
- **System Prompts Constraints**:
  - Removed accidental `RollTheDice` tool call reference from `sysprompt_legacy.txt` (and the fallback copy in `constants.js`) under `<RNG_constraints>`.

### Added
- **System Prompts Spatial Constraints**:
  - Added new `<spatial_and_entity_constraints>` sub-block under `<constraints>` in both normal and legacy narrator prompts.

## [3.8.0] - 2026-06-22

### Changed
- **System Prompts Layout Restructure**:
  - Moved the `<constraints>` section from the bottom to near the top, directly below the `<role>` block across narrator prompts (`sysprompt.txt`, `sysprompt_legacy.txt`, and fallback copies in `constants.js`).
  - Absorbed the `<inventory>` rules into the new `<inventory_and_resource_constraints>` block as a sub-category under `<constraints>`.

## [3.7.9] - 2026-06-21

### Added
- **Inventory 2.0 Upgrade**:
  - **[E] Equipped-Item Tagging**: Added support for marking active items as equipped using `[E]` immediately following their rarity tag (e.g., `Gear: Dagger [Common] [E]`). Worn/held items are highlighted in the UI, while untagged items are treated as carried but not worn.
  - **Centralized System Prompts Inventory block**: Created a dedicated `<inventory>` prompt section across all narrator prompts (`sysprompt.txt`, `sysprompt_legacy.txt`, and `constants.js`), housing slot rules, equipment validity, and equipping mechanics.
  - **Equipment Incompatibility & Status Debuffs**: Replaced rigid slot list limitations with a dynamic compatibility rule. The narrator prevents physically impossible equipment, while awkward or incompatible combinations (e.g. wrong class/lack of proficiency/low Strength) are allowed with customized mechanical status debuffs that are explicitly tied to the equipped item and automatically track its removal.
  - **Prompt Clean-up**: Stripped all leaks/references to the external "State Tracker" or "RPG Tracker" from the narrator system prompts. The state tracker's default inventory prompt now focuses solely on recording the `[E]` tag.
- **Interactive Prompt Upgrade Dialog**: Added an upgrade reset prompt popup and settings checkbox ("Auto-Update Prompts on Upgrade") that cleanly prompts users to reset their custom prompt sections to new factory defaults on framework upgrades.
- **RNG Lookback Modes**: Added a "Since Last User Message" default lookback mode for the State Tracker and a "Since Last Run" / "Since Last User Message" mode for the Lorebook Agent.
- **AC instructions**: Embedded Armor Class (AC) calculation details directly in the default `CHARACTER` stock prompt.
- **Second-Attempt Constraint**: Added a second-attempt constraint for failed checks to the narrator system prompts (only allowed if approach/circumstances have changed enough).
- **Thinking / Reasoning Filtering**: Automatically strip thinking and reasoning tags (including JSON blocks) from outgoing LLM chat history.

### Fixed
- **UI Parsing Safe Guards**: Added support in both `renderer.js` and `portraits.js` to parse lines in state blocks (like `[PARTY]` and `[ABILITIES]`) correctly even if they contain leading dash or bullet prefixes.
- **Dialog Branding**: Renamed the RPG Tracker update dialog header to "✨ Multihog D&D Framework Update" to align with the product branding.
- **State Tracker Prompt Auto-Reset**: Fixed a bug where the state tracker core prompt did not reset during upgrades.

## [3.6.4] - 2026-06-18

### Changed
- **Lorebook Agent Direct Prompt Layout**: Removed the Direct Command prompt textarea and direct lookback inputs from the settings drawer. Added a new direct prompt `💬` button to the Lorebook Agent header that mirrors the State Tracker Direct Prompt button.
- **Replicated Prompt Bar**: Appended a dedicated Agent Direct Prompt input bar matching the State Tracker's design directly above the Agent's footer. The box features draft preservation, auto-resizing text area, Enter-to-submit support, lookback messaging limits, and highlights the `💬` icon button when active.

## [3.6.3] - 2026-06-18

### Added
- **One-time Version-based Prompt Upgrade**: Implemented an automated script that resets the Lorebook Agent's system and modular prompts to their updated factory defaults exactly once upon detecting a framework version upgrade. Shows a visual toast notification to inform the user of the successful upgrade without continuously overwriting subsequent user prompt edits.

## [3.6.2] - 2026-06-18

### Fixed
- **Settings Drawer Sync**: Corrected a ReferenceError that occurred when toggling "Enable World Progression" from the main Settings drawer. The settings change handler now correctly communicates with the Agent panel drawer via an established module-level reference.
- **Bidirectional Value Synchronization**: Synchronized interval updates from the Agent panel drawer back to the settings page input field, ensuring that the last and next report times remain fully aligned across both views.

## [3.6.1] - 2026-06-18

### Added
- **Clickable World Progression Status Badge**: Clicking the ON/OFF badge in the Agent panel's World Progression drawer now toggles the enabled state directly. Added stopping of event propagation so it does not toggle the collapsible drawer folder, and styled the cursor to pointer.
- **Badge Status Synchronization**: Wired the status badge to update dynamically upon settings page changes and initial panel load, resolving status desync issues.

## [3.6.0] - 2026-06-18

### Added
- **Hierarchical/Nested Location Display**: Implemented collapsible tree structures for lorebook items using `::` separators in entry labels. Children elements display nested and indented under parent nodes.
- **Virtual Parent Resolution**: Designed tree builder to automatically resolve parent nodes even if they haven't been created yet by the AI (rendered as italicized placeholder nodes). When retroactively created, they instantly transform into real editable entry nodes while preserving child nesting.

## [3.5.9] - 2026-06-18

### Changed
- **Lorebook Agent Action Buttons**: Moved the "Clean" and "Edit" action buttons from the expanded entry pane to the entry header row, alongside the "Delete" button, resolving blank gaps below open entries.
- **Mobile Action Support**: Re-implemented action button visibility using parent container CSS classes (`.open`) instead of JavaScript mouse events. Buttons remain visible at `0.5` opacity when the entry is expanded, allowing mobile users without hover capabilities to interact with them.

## [3.5.8] - 2026-06-18

### Added
- **Undock Hint Notification**: Added a one-time user notification advising the user to undock the Lorebook Agent panel for the best user experience. Toggles persist via settings.

## [3.5.7] - 2026-06-18

### Added
- **Bidirectional Settings Synchronization**: Fully synchronized all 8 "Quick Settings" fields in the Lorebook Agent panel with their respective counterparts in the main extension settings panel. Changes in either location are updated instantly.
- **Agent Core Settings Drawer**: Created a new sub-drawer in the extension settings page specifically for core agent configuration options.

## [3.5.6] - 2026-06-18

### Changed
- **Lorebook Agent Header Navigation**: Moved the Lorebook Agent button to the header-left group (next to Chat Link) for better layout consistency and prominence.
- **Lorebook Agent Active Highlight**: Added a persistent active styling highlight/border glow to the Lorebook Agent button when the agent panel is visible.

## [3.5.5] - 2026-06-18

### Changed
- **Lorebook Agent Docked Mode**: Refactored the Lorebook Agent docked mode to open as a full-size toggled view inside the main tracker panel (replacing the Raw/Rendered content views) instead of an absolute floating tab sidebar. Resolves resize glitches and vanishing issues in docked mode.

## [3.5.4] - 2026-06-18

### Added
- **Collapsible Drawers (Lorebook Agent UI)**: Grouped settings into a collapsible "Quick Settings" drawer, and wrapped the Terminal and Log History into a collapsible "Console" drawer. Toggles persist in user settings.
- **Integrated Title**: Merged the "AUTONOMOUS RESEARCHER" header into the panel header as "Lorebook Agent: Autonomous Librarian".

## [3.5.3] - 2026-06-18

### Removed
- **Redundant Connection Settings**: Removed the "Lorebook Agent Connection" settings drawer from the Lorebook Agent panel to centralize connection management inside the main Settings tab.

### Changed
- **Keyword Overflow Label**: Renamed the "KW Overflow Cap" input field to "Keyword Overflow Cap" and added an explicit inline visual indicator stating "(0 = no cap)".

## [3.5.2] - 2026-06-18

### Changed
- **Lorebook Agent NPC Prompt**: Updated the default NPC prompt instruction to require a short description of the NPC's appearance and vibe in a single sentence when recording them. Included automatic migration of existing configurations matching the legacy default.

## [3.5.1] - 2026-06-18

### Added
- **Keyword Scan Prioritization**: Segregated direct matches (keywords found in the current message) from retroactive matches (keywords in lookback history). Direct matches are moved to the end of the keyword Set, prioritizing them and protecting them from cap eviction.

### Changed
- **World Progression Default Depth**: Changed default World Progression / Report Injection depth from 4 to 3.

## [3.5.0] - 2026-06-16

### Added
- **AI Character Portrait Cropping**: Added image cropping support for AI-generated portraits (from Pollinations or the native ST Image Generation extension) prior to scaling and applying.
- **AI Character Portrait Generation**: Introduced a built-in portrait generation system powered by the Pollinations API. By clicking on any character, party member, or enemy's portrait box in the tracker, you can select "🤖 AI Generate" to instantly create a high-quality visual representation of them based on their description and game state.
- **Portrait Prompt Extended Context**: The AI portrait prompt generator now receives massive context to produce highly accurate portraits. It is injected with: 1) the full Lorebook Agent context (all active entries, keywords, and content), 2) the current game state memo, and 3) the last 5 messages of the chat history to capture immediate actions, injuries, and current outfits.
- **Inventory Currency Auto-Rendering**: Bare currency items in the inventory (e.g. `💰 45 GP` listed as a standalone item — not a worth annotation) now always render with an inline coin badge. Gold/GP → gold coin, Silver/SP → silver coin, Bronze/Copper/CP → bronze coin, Dollar/USD/Euro/Pound → dollar badge. The underlying memo text is never modified.
- **Inventory Item Worth Toggle**: New "Item Worth" dropdown in General & Visuals settings. Controls how `(~X GP)` worth annotations on inventory items are displayed. **Hover** (default): worth is stripped from the visible item and shown as a native tooltip on hover — the original behavior. **Display**: worth is shown as an inline coin badge next to the item in addition to the tooltip. Both modes always render bare currency items (e.g. `45 GP`) with a coin badge.
- **Pollinations "Why?" Tooltip**: Added a comprehensive info tooltip to the Pollinations API Key section explaining why Pollinations was chosen: it was created to preserve free AI access, is a non-profit committed to remaining free forever, offers generous hourly rate limits, only requires a GitHub account for a permanent API key, and supports ~10–20 portraits per hour with the default Flux model.
- **Portrait Resolution Increase**: Increased the internal portrait storage resolution from 128x128 to 512x512. When you click a portrait to view it in full size, it now retains much higher quality and detail instead of appearing pixelated, while still keeping save sizes manageable.
- **ZImage Default Model**: Changed the default Pollinations AI model from Flux to ZImage, which provides excellent portrait framing and aesthetic consistency.

### Changed
- **Pollinations Key Popup**: The first-time API key entry popup now includes the full "Why Pollinations?" explanation with details about the non-profit mission, GitHub-only key requirement, and hourly portrait capacity.

## [3.3.0] - 2026-06-12

### Added
- **Detached Panel Resize Handles**: Injected bottom-left (BL) and bottom-right (BR) resize handles inside detached panels with pointer-tracking and geometry persistence (`rpg_tracker_geometry_${tag}`).

### Fixed
- **Per-Chat Character Portrait System**: 
  - Collapsed character portraits configuration payload (`customPortraits`) into the localized per-chat data structured in `state-manager.js`.
  - Added portrait container and pointer events fixes to enable click-to-replace popup trigger.
  - Corrected customButtons result validation type from string to number (clear/result `2`) to satisfy the SillyTavern Popup API.
  - Captured URL input values before popup DOM teardown.
- **Panel Corner Refinement**: Enforced `overflow: hidden` on `.rpg-tracker-panel` and rounded top-corners on `.rpg-tracker-header` to guarantee perfect clipping of panel children.

## [3.0.0] - 2026-06-06

### Added
- **Half Review Mode** *(Experimental)*: The previous "Full Review Mode" has been renamed to "Half Review Mode." It's a medium-intensity review that uses regex-adjusted prompts to request complete output. Balanced token usage and accuracy.
- **Full Review Mode — Aggressive** *(Experimental)*: A brand-new review mode that **completely rewrites** the State Tracker system prompt to forcefully demand every single field — including all custom fields — is reviewed and output. Enumerates every enabled module by name. Highest token usage but guarantees nothing is missed.
- **Automatic Migration**: Users who had the old Full Review Mode enabled will be automatically migrated to Half Review Mode.
- **Inventory Rarity Classification**: All inventory items now **must** include a rarity tag (`[Common]`, `[Uncommon]`, `[Rare]`, `[Epic]`, `[Legendary]`, `[Artifact]`), a thematic emoji, and an estimated worth in parentheses (e.g. `(~120 GP)`). Currency is not enforced — fits any setting.
- **Inventory Worth Tooltip**: Item worth is stripped from the visible display and shown on hover via a native tooltip. Hover over any inventory item to see its estimated worth.
- **Dynamic Enemy HP Scaling**: Enemy stats are now **context-aware** and scale based on quest difficulty:
  - **Very Easy/Easy**: Enemies below or near player level
  - **Normal**: Enemies roughly at player level
  - **Hard/Very Hard**: Enemies can be brutally strong; Hard is winnable with good play, Very Hard demands perfection
  - **General encounters**: Pure narrative context — no babysitting, no HP-matching
- **Legendary NPC Tier**: Added a new "Legendary — World-threat" tier with HP 150–500+, AC 19–22, ATK +11 to +15.
- **Emergent Quest System**: Quests no longer require formal NPC acceptance. When the player pursues a clear, sustained goal through action, it's automatically treated as an emergent quest and added to the quest tracker.
- **AI Custom Field Creator**: New "Add Custom (AI)" button in the State Tracker settings. Describe what you want to track in plain language and the AI generates a fully configured field with rendering tags, icon, prompt, and template. Now passes the entire comprehensive rendering tags library as context.
- **Sysprompt Editor & Updater**: New top-level settings section with:
  - **Update (Normal)**: Fetches `sysprompt.txt` and writes to Quick Prompt Main
  - **Update (Legacy)**: Fetches `sysprompt_legacy.txt` regardless of current RNG mode
  - **AI Section Builder**: Describe a mechanic and the AI generates a new XML-tagged section. It is fed your entire current sysprompt for seamless integration. Opens a fully interactive popup, previews it, and appends it to your sysprompt on approval.
  - **Reset All & Apply**: Moved here from General & Visuals
- **Universal Inline Rendering Tags**: Layout and marker tags now work inline and no longer need to be the absolute first thing on a line. (e.g. `Health: ((BAR)) 50/100`). Quest-exclusive renderers are now usable **anywhere** — in any stock or custom field:
  - `((OBJ))` — Objective checkbox with status indicators (○/✓/✗)
  - `((REWARD))` — Gold reward badge/chip
  - `((DIFFICULTY))` — Color-coded difficulty badge (green → red)
  - `((PROGRESS))` — Progress counter with animated mini bar
- **15+ New Rendering Tags**: Added colorful variant tags (`((BARRED))`, `((PILLGREEN))`, `((BARYELLOW))`), alert badges (`((WARNING))`, `((DANGER))`, `((SUCCESS))`, `((INFO))`), economy coins (`((GOLD))`, `((SILVER))`, `((BRONZE))`), and dice roll renders (`((ROLL))`).
- **Rendering Tags Library**: New button below the Custom Fields section. Opens a beautiful interactive popup with live visual examples of every single tag rendered directly next to its exact syntax.

### Changed
- **Update Sysprompt button** now always fetches `sysprompt.txt` (Normal mode). Use the new Legacy button for legacy mode.
- **NPC Tiers** expanded with wider HP/stat ranges and the Legendary tier.
- **Quest instructions** now include multi-objective requirements and emergent quest rules in both `sysprompt.txt` and `sysprompt_legacy.txt`.

## [2.6.0] - 2026-05-30

### Added
- **Experimental Features Tab**: New "Experimental Features" settings sub-drawer (with BETA badge) for testing cutting-edge features that may change behavior or increase token usage.
- **Full Review Mode** *(Experimental)*: When enabled, the State Tracker reviews and outputs the **entire** state on each update instead of only changed sections. This prevents models from missing updates to fields like Status, Abilities, Custom Fields, and any field that only updates sporadically and occasionally, etc. The AI, especially smaller models, tend to skip those when instructed to output "only changes." Trade-off: Slightly higher token usage per update.
- **State Tracker Run Frequency**: Added a "Run Every N Messages" setting to the State Tracker's Advanced Options. Set to 1 (default) to run every message, 2 to skip every other, etc. Useful for reducing API costs on fast-moving chats.

### Fixed
- **RNG Queue Not Injecting with Certain Chat Completion and Text Completion Presets**: Fixed a critical bug where the RNG Queue, State Memo, and Quest context were silently dropped when using chat completion presets that format the `content` field as an array of content parts (common with vision/multimodal presets). The interceptor now correctly handles both string and array content formats, and also guards against text completion mode where the chat object is a plain string instead of an array.

## [2.5.2] - 2026-05-26

### Added
- **Full Audit Chunking (State Tracker)**: The State Tracker's Full Audit mode now automatically splits massive chat histories into token-managed chunks and processes them sequentially. Each chunk fully commits its result to settings, updates the UI live, and saves before the next chunk begins — so users can watch the state being reconstructed in real time rather than waiting for the entire audit to finish.
- **Full Audit Chunking (Lorebook Agent)**: Added a new "Full Audit" button (📚) to the Lorebook Agent panel header and settings drawer. When triggered, the entire chat history is chunked and each chunk is fed through a full Lorebook Agent pass. The agent writes lorebook entries per-chunk and the next chunk sees the freshly written entries, enabling massive campaign logs to be fully indexed.
- **Full Audit Max Tokens Setting**: Added a `fullAuditMaxTokens` setting (default: 32,000) in the State Tracker's Advanced Options. This serves as a plug-and-play fallback for context limit detection, ensuring chunking works out of the box without requiring manual configuration.
- **Full Audit Confirmation Popup**: The Lorebook Agent Full Audit button now shows a confirmation dialog before starting, warning that the process may take several minutes and advising not to send messages during the audit.

### Fixed
- **`recentChat` ReferenceError**: Fixed a `ReferenceError: recentChat is not defined` crash in `router.js` by renaming all references to `recentChatString` and adding the `overrideChatLog` parameter to `runRouterPass`.
- **State Tracker audit not saving**: Fixed a critical bug where the State Tracker Full Audit would process all chunks internally but never commit the results to `settings.currentMemo`, causing the UI to remain unchanged after completion.

## [2.5.1] - 2026-05-26

### Fixed
- **Lorebook Agent Data Loss**: Fixed a critical bug where the Lorebook Agent would fail to recognize manually cloned or renamed campaign lorebooks due to stale frontend caches. The agent now explicitly probes the backend server (`/api/worldinfo/get` and `/api/settings/get`) before initializing a new book, completely preventing the accidental overwriting and deletion of existing lorebook files.

## [2.5.0] - 2026-05-26

### Added
- **Automated World Engine**: Implemented a comprehensive "World Engine" simulation block in the Lorebook Agent. The agent now tracks the passage of time and automatically generates missing daily background reports for off-screen NPC actions and faction events, creating a persistent, living world that evolves independently of the player.
- **Editable Modular Agent Instructions**: Exposed all Lorebook Agent formatting rules and module-specific logic (LOC, FAC, WORLD, Custom Tags) into a single, unified text area in the settings UI. Advanced users can now fully customize or rewrite the internal logic and formatting rules of the Lorebook Agent.

### Fixed
- **Tag Parsing Robustness**: Fixed a critical parser bug where multi-line or multi-paragraph entries (like the new verbose WORLD reports) were being truncated. The generic tag parser now safely captures tags spanning across newlines.
- **Legacy Constraints**: Backported the `<world_engine>` narrative constraint to `sysprompt_legacy.txt` to prevent NPCs in legacy mode from spontaneously blurting out background world events that the player shouldn't know about.

## [2.4.2] - 2026-05-18
### Fixed
- **Keyword Scanner Latency**: Eliminated a critical 5-second prompt compilation and message delay by removing the expensive, synchronous `updateWorldInfoList` disk-reindexing call from the scanner's fallback path. The read-only keyword scanner now operates purely in-memory, relying on the already-current registry and an in-memory `routerLog` backup for instant performance.

## [2.4.1] - 2026-05-18

### Fixed
- **Rollback Data Safety**: Patched a critical bug in `rollbackRouterPass` where an empty or missing campaign prefix would fall back to the entire SillyTavern library, deleting or clearing unrelated lorebooks. The deletion step now safely ignores empty scopes when no campaign prefix is active.

## [2.4.0] - 2026-05-17

### Added
- **Lorebook Agent Cleanup Mode**: Implemented a comprehensive cleanup mode pass to consolidate bloated lorebook entries.
  - **Tool-call actions**: Support for `rewrite` (single entry compression) and `consolidate` (many-to-one merge + delete) operations.
  - **Custom directives**: Manual global and per-entry cleanups prompt for custom instructions (e.g. "Preserve history, condense mechanics").
  - **Auto-cleanup settings**: Toggles for automatic background runs every N turns and custom token size thresholds.
  - **Bypassing controls**: Added "Use Token Threshold" checkbox to selectively include or exclude the size barrier.
- **Estimated Token Displays**: Real-time token estimators next to category titles, entry list items, and active keys to monitor budget consumption at a glance.
- **Event Isolation**: Fixed interactive controls getting stuck in draggable panels by selective event propagation filters.

## [2.3.8] - 2026-05-17

### Added
- **Clone Stack**: New "Clone Stack" button in the Lorebook Agent settings. Duplicates every lorebook in the active campaign stack (e.g. `Eldoria_NPCs`, `Eldoria_Locations`) under a new user-specified prefix. Designed to prepare a parallel lorebook set before creating a SillyTavern branch chat — name the branch to match the new prefix and the framework links it automatically.

## [2.3.7] - 2026-05-17

### Added
- **Immersion Mode Collapsibility**: Both the RPG State Tracker and Lorebook Agent panels can now be fully collapsed to their header bars by clicking the header collapse button or double-clicking the header.
- **Auto-Expansion Synergy**: Opening the Lorebook Agent panel automatically expands the main RPG Tracker panel if it is collapsed, preventing child element clipping.

### Changed
- **Mobile UI Spacing Optimization**:
    - Hid the on/off (power) buttons (`⏻`) exclusively on mobile viewports to reclaim precious screen real estate.
    - Vertically enlarged the header bars for a more prominent, premium look on mobile screens.
    - Scaled up the other action buttons and increased icon sizes for highly comfortable touch interactions.

### Fixed
- **Stale Collapsed Heights**: Added min-height guards on startup to prevent restoring a collapsed header height (from stale pre-collapse session geometry) as the default expanded height.
- **High-Specificity CSS Override**: Resolved a CSS clash where a specific ID-based display: block !important rule prevented the Lorebook Agent's content container from collapsing.

## [2.3.6] - 2026-05-16

### Fixed
- **Keyword Persistence**: Corrected an ordering bug in `onChatChanged` where switching chats would wipe the departing chat's keyword-activated lore (yellow pills) before it could be saved.



### Added
- **Atmospheric Time Tracker**: [TIME] block text now dynamically changes color based on the hour of day (Dawn, Midday, Sunset, Night) to match the existing emoji logic.

### Changed
- **UI Modernization & Cleanup**:
    - Removed redundant **Max Tokens** field from all UI sections.
    - Renamed **Max Turns** to **Max Agent Turns** and **Max Active** to **Max Active Keys**.
    - Removed bullet points from [TIME] block card items for a cleaner look.
    - Relocated **Reset Stock Modules** button to the Modules section for better grouping.
    - Renamed reset buttons to **Reset Core Prompt** and **Reset Stock Modules**.
- **Hardened Lorebook Injection**: Implemented a third-pass injection in the narrative interceptor to ensure Agent-owned active entries (grey pills) are correctly included in the AI context.
- **System Prompt Hardening**: Updated the template with a strict "NEVER ignore a module" directive to improve instruction following.
- **Module Optimization**: Removed "Location" from the [TIME] module prompt (now exclusively handled by the status footer).

### Fixed
- **Scenario Profiles**: Restored the missing **Delete** button for scenario profiles.



### Fixed
- **Lorebook deactivation on chat switch**: replaced fragile `_Letters` name-pattern heuristic with an exact lookup against the canonical `campaignBooks` lists stored per chat in `chatStates`. Only books the extension itself recorded as managed are ever deactivated — user-created lorebooks with any name are never touched.

## [2.2.7] - 2026-05-14

### Changed
- **Modular slot bar**: Tuned `+` / `×` controls smaller (~15px, lighter borders) after v2.2.6 overshoot.

## [2.2.6] - 2026-05-14

### Changed
- **Modular slot bar**: Larger, higher-contrast `+` / `×` controls (26px touch targets, bordered pill backgrounds) for add/remove middle slots.

## [2.2.5] - 2026-05-14

### Changed
- **Slot editor: add/remove support** — `+` button adds a new middle slot before Keywords; `×` on any middle slot removes it. Works for both stock modules and custom tags.
- **Custom tags now have a format** — same slot bar UI as stock modules; `format` field added to custom tag objects (migrated on load). The prompt builder and parser both use it.
- **Parser simplified** — FAC and QUEST dedicated branches removed; the generic `first=name, middle=body, last=keywords` branch handles all tags uniformly, including any number of slots.

## [2.2.4] - 2026-05-14

### Changed
- **Modular Repertoire slot editor**: Each stock module row now shows an inline `[[TAG: Name | slot | … | Keywords]]` bar. Middle slot names are editable inputs that steer what the AI writes in each pipe section. Name and Keywords chips are fixed/dimmed. Reset restores both slots and instruction.
- **Generic tag parser**: Middle segments (everything between first and last pipe) are all joined as entry body, so any number of renamed middle slots works automatically for NPC, LOC, EVENT and custom tags.

## [2.2.3] - 2026-05-14

### Changed
- **Basic Mode FAC tag**: Default template is now four fields — `Name | Status | Description | Keywords`. Status is a short current-state line; Description holds the longer narrative. Parser joins both into entry content; old three-field `[[FAC: Name | Description | Keywords]]` tags still work. Existing saves using the previous default `format` string are migrated on load. Module reset now restores both `instruction` and `format`.

## [2.2.2] - 2026-05-14

### Fixed
- **Lorebook Agent panel layout**: Active Lore Keys now use normal document flow on desktop and detached panels (`#rpg-tracker-agent .rpg-tracker-content` block layout + `min-height: 0`), so wrapped pills push the Lorebook Terminal down instead of overlapping it. Removed temporary layout debug instrumentation.

## [2.2.1] - 2026-05-14

### Fixed
- **Keyword scan accumulator**: Keyword-triggered lorebook entries are now accumulated across throttled turns (`routerRunEvery > 1`). Previously entries triggered on skipped turns were silently dropped; now the full set since the last agent run is passed as `NEWLY ACTIVATED THIS TURN` when the agent fires.

## [2.2.0] - 2026-05-14

### Changed
- **Lorebook Agent pipeline**: Managed campaign lorebook entries are stored inactive (`disable: true`) and patched on init/chat switch so SillyTavern’s native keyword activation does not run one turn behind narrator output.
- **Assistant-output keyword scan** (`onGenerationEnded`): Before the State Tracker and Lorebook Agent, the last assistant-side narrative is scanned; inactive entries whose `key[]` match (case-insensitive) are appended to `activeRouterKeys` immediately so the same agent pass sees full bodies.
- **Agent context**: Budget block plus optional overflow instruction; **NEWLY ACTIVATED THIS TURN** for scanner hits; archive index excludes already-active entries; FIFO auto-trim of active keys removed — overflow must be resolved via **deactivate** in **commit**.
- **Prompts**: Built-in agent/basic memory-limit copy and bundled default Lorebook Agent system prompt updated for the new budget and activation model; **Reset Agent Prompt** now restores that canonical default.
- **Defaults / UX**: Lorebook context lookback default **4**; UI labels clarify lookback is **last N chat messages (user/assistant)**; optional visual hint for keyword-triggered active keys for one turn.

## [2.1.6] - 2026-05-13
> ⚠️ **Pre-fucking change that will likely need 2 years of debugging.**
> The lorebook prefix system has been gutted and rebuilt from scratch.
> If something is inexplicably broken, it's probably this.

### Changed
- **Lorebook prefix now derived from the raw chat ID** (`ctx.chatId`) at the moment of use — no more stored setting, no more 800ms timer races, no more stale "Assistant" prefix poisoning everything. The chat ID IS the namespace.
- **Prefix derivation is simple and format-agnostic**: just sanitize the chat ID to alphanumeric+underscores. No regex demanding ST's default `Name - timestamp` format. Renamed chats work. Numeric IDs work. Everything works or at least fails loudly.
- **Strict book matching**: a lorebook belongs to a chat only if its name is exactly `prefix` or `prefix_<SingleAlphaWord>`. No partial prefix matches. "Assistant" no longer reaches across sessions and activates 47 lorebooks.
- **Removed manual Campaign Root UI**: the prefix input, Pick & Activate button, and Link button are gone from the settings panel. Replaced with a read-only display of the auto-derived prefix.
- **`activateCampaignBooks` bails with an empty prefix** instead of activating every lorebook on disk.
- **`loadChatState` no longer restores `routerCampaignPrefix`** from saved state. Stale values from old runs can no longer resurface.
- **Deactivation on chat switch** now happens unconditionally (not only when there are matching books), so switching to a new empty chat correctly clears the previous session's lorebooks.

### Added
- **Apply System Prompt button on the onboarding screen** — same as the one in the settings panel. Previously toggling onboarding options saved settings but never actually applied the prompt.
- **`scheduleAutoApply()` wired into onboarding toggles** so changing RNG mode, quest options, or components on the onboarding screen immediately updates the system prompt.

## [1.10.41] - 2026-05-12
### Added
- **Persona Character Creation**: Added a new `🎭 Persona` archetype option to the startup onboarding screen. This feature resolves the active SillyTavern persona description via macro replacement and feeds it as a direct instruction to generate a custom-tailored D&D character matching the specified persona and starting level.

## [1.8.29] - 2026-05-11
### Added
- **Direct Prompt & Adjustable Lookback**: Added the ability to send direct commands to the Lorebook Agent and adjust the number of recent chat messages (lookback) it analyzes.
- **UI Syncing**: Integrated lookback controls into both the agent panel and the main settings drawer with real-time value synchronization.

### Fixed
- **Lint Fixes**: Resolved HTMLElement property access errors in the agent panel's detachment logic by implementing proper type casting.

## [1.8.28] - 2026-05-10
### Fixed
- **Renderer Stabilization**: Ported the definitive rendering engine from the `main` branch to resolve fragility in character card generation. This introduces "sticky entity" logic where unrecognized lines are gracefully attached to the current card instead of resetting the context, preventing UI disintegration during template modifications.
- **Stock Field Rules**: Ported `STOCK_FIELD_RULES` and specialized renderers for HD Pips and Spell Groups for parity with the stable branch.

## [1.8.27] - 2026-05-10
### Added
- **Lorebook Agent Rebranding**: Rebranded the "Router Agent" to the **Lorebook Agent** to better reflect its role in managing campaign lore and consistency.
- **Detachable Agent Panel**: The Lorebook Agent panel is now detachable. Click the ⧉ icon in the agent header to pop it out into a standalone, draggable window.
- **Resizable Agent UI**: Detached agent panels are now fully resizable. Grab the corner or edges to adjust the workspace to your preference.
- **Geometry Persistence**: The position and dimensions of the detached Lorebook Agent are automatically saved and restored across sessions.
- **Enhanced System Prompt**: Updated the default Lorebook Agent instructions to emphasize location persistence, multi-entry turns, and entity synchronization.
- **Dynamic Variable Support**: Added `{{user}}` as a supported variable in the agent's system prompt, which automatically resolves to the player's name.
- **API Standardization**: Ported the critical `sendStateRequest` fix from `main`, standardizing LLM request construction to prevent API errors on certain SillyTavern builds when using connection profiles.

### Changed
- **Terminal Rebranding**: Renamed the agent's feedback loop to the **Lorebook Terminal**.
- **Internal Event Refactor**: Updated internal event bus to use `rt_lore_agent_*` naming for improved codebase clarity and future-proofing.
- **Agent Icons**: Updated UI icons and tool-tips to match the new Lorebook branding.

## [1.8.26] - 2026-05-10
### Added
- **New Rendering Marker**: Added `((HP))` as a shorthand for creating a character health bar.
- **Sticky Entity Context**: Attribute rows (Attr, Skills, Saves, etc.) now automatically attach to the last rendered character even if separated by narrative text.

### Fixed
- **API Compatibility**: Fixed a silent failure in extension initialization by updating `setExtensionPrompt` calls to support the latest SillyTavern API requirements (4-7 arguments).
- **Rendering Stability**: Resolved syntax errors in `renderer.js` when processing complex character blocks.
- **Sync Fixes**: Synchronized core rendering fixes from `main` into the `feature/quests` branch.

## [1.8.25] - 2026-05-10

**Fix: Renderer Syntax Error**
Resolved a syntax error in the quest renderer introduced in the previous update.

### Fixed
- **Renderer Stability**: Fixed an accidental duplicate closing tag that was causing the script to crash on load.

## [1.8.24] - 2026-05-10

**Optimization: Completed Quest Filtering**
Completed quests are now stripped from the AI context to save tokens, while remaining visible in the UI.

### Added
- **UI Sub-Section**: Completed quests are now visually separated into their own collapsible "✅ COMPLETED" sub-section at the bottom of the quest log.
- **Context Pruning**: The serialization engine now filters out any quest with `STATUS: completed` before injecting the `[QUESTS]` block into the state memo, preventing resolved narrative threads from consuming valuable context window space.
- **State Persistence**: The legacy text block parser was updated to intelligently merge incoming active quests with the locally stored completed quests, ensuring history isn't lost when the AI inevitably echoes back a block missing the completed entries.

## [1.8.23] - 2026-05-10

**Refactor: Mood is Engine-Computed Only**
Reverted AI-MOOD override from 1.8.22. The engine is the exclusive source of truth for NPC mood.

### Changed
- **Source of Truth**: `getQuestMood` is now purely deterministic — MOOD is always calculated from the frustration/deadline engine, never inferred from AI text.
- **Parser Cleanup**: The `MOOD` field is no longer ingested from legacy text blocks. The AI may still write it for human readability, but the engine ignores it.

## [1.8.22] - 2026-05-10

**Fix: Mood Calculation — No-Deadline Quests**
Fixed the root cause of mood desync for deadline-free quests.

### Fixed
- **No-Deadline Baseline**: `computeFrustrationLocal` now returns `-1.0` ("Very Pleased") instead of `0.0` ("Neutral") when a quest has no deadline or `DEADLINE: None`. This ensures that pressure-free quests correctly show a positive NPC emotional state.

## [1.8.21] - 2026-05-10

**Enhancement: RNG Queue Guidance**
Added explicit clarification to the legacy system prompt regarding RNG queue entry consumption.

### Changed
- **Prompt Guidance**: Explicitly stated that the first number in each RNG queue entry represents the d20 result in the legacy system prompt.

## [1.8.20] - 2026-05-10

**Enhancement: Robust Difficulty Parsing**
Improved the difficulty system to allow for non-standard ratings and ensured UI stability.

### Changed
- **Flexible Difficulty**: Removed the strict enum requirement for quest difficulty, allowing the AI to use custom ratings if appropriate.
- **Rendering Fallback**: Added a robust rendering fallback in the quest log. Non-standard difficulty levels now use a neutral theme that remains legible across different visual themes.

## [1.8.19] - 2026-05-10

**Fix: Tool Registration Bug**
Fixed a `ReferenceError` that prevented the `LogQuest` tool from registering correctly when Difficulty was enabled.

### Fixed
- **Initialization Order**: Corrected the order of variable initialization in `quests.js` to ensure the `required` fields array is defined before being modified by the Difficulty logic.

## [1.8.18] - 2026-05-10

**Enhancement: UI Consistency**
Added the "Difficulty" toggle to the main extension settings panel.

### Added
- **Settings Integration**: The Quest Difficulty toggle is now available in both the startup onboarding wizard and the permanent extension settings panel.

## [1.8.17] - 2026-05-10

**Feature: Quest Difficulty Tracking**
Implemented an optional "Difficulty" system for quests, allowing the AI to assign and track challenge levels (Very Easy to Very Hard).

### Added
- **Difficulty Toggle**: New checkbox in the onboarding UI to enable/disable quest difficulty tracking.
- **Legacy Difficulty**: Support for the `DIFFICULTY:` field in legacy text-block quests.
- **Modern Difficulty**: Integrated `difficulty` parameter into the `LogQuest` tool and allowed difficulty updates in the JSON state tracker.
- **Visual Feedback**: Added color-coded difficulty badges to quest cards in the UI (e.g., Green for Easy, Red for Very Hard).

## [1.8.16] - 2026-05-10

**Fix: Hardened "Apply Sysprompt" Logic**
Fixed a bug where clicking "Apply Sysprompt Now" in the onboarding menu could occasionally result in a stale prompt if intermediate toggle events were missed.

### Fixed
- **Atomic Onboarding Apply**: The "Apply" button now performs a full scrape of all UI toggles (Deadlines, Frustration, Quest Mode, RNG Mode) immediately before generating the prompt. This guarantees the resulting sysprompt and module instructions perfectly match the visible UI state.

## [1.8.15] - 2026-05-10

**Enhancement: Legacy Quest Rewards**
Added the `REWARD:` field to the Legacy Quest Mode system instructions, bringing it to feature parity with the Standard (Modern) JSON format.

### Fixed
- **Legacy Quest Rewards**: The `quests_legacy` prompt now explicitly instructs the AI to track promised rewards using the `REWARD:` marker. While the renderer and parser already supported rewards, the instructions were missing, causing the AI to omit them in legacy mode.

## [1.8.14] - 2026-05-10

**Fix: Direct Prompt Consistency**
Fixed a bug where the "Direct Prompt" feature used its own isolated logic for building system instructions, ignoring Quest Legacy mode and other module settings.

### Fixed
- **Centralized Instruction Building**: `sendDirectPrompt` now uses the shared `buildModulesInstructionText` function, ensuring it respects the active Quest format and all other module configurations.

## [1.8.13] - 2026-05-10

**Fix: Legacy Quest Prompt Now Reliably Applied**
Resolved a critical bug where users with Legacy Quest Mode selected would still receive the Modern (JSON delta) quest prompt in the state model.

### Fixed
- **Quest Prompt Selection at Init**: Replaced the fragile runtime swap with a definitive init-time write. The correct quest prompt (Legacy or Modern) is now written directly into `stockPrompts.quests` at startup based on `questLegacyMode`, guaranteeing the state model always receives the right instructions regardless of save state.
- **Missing `stockPrompts` Guard**: Added a null-check to ensure `stockPrompts` is always initialized before the sync block runs, fixing a silent failure for users without saved prompts.

## [1.8.12] - 2026-05-10

**Prompt Routing Diagnostics**
Added internal diagnostics to track quest prompt routing.

### Changed
- **Harden Quest Prompt Routing**: Improved the logic that swaps between Legacy and Modern quest formats to be more robust.
- **Diagnostic Logging**: Added console logs to verify `questLegacyMode` status and prompt type during initialization and runtime.

## [1.8.11] - 2026-05-10

**Lorebook Synchronization & Robust Loading**
This update resolves a race condition where lorebooks would fail to populate in the extension settings.

### Fixed
- **Lorebook Initialization Race Condition**: Implemented a 3-tier fallback for loading world info names. If the in-memory list is empty, the extension now forces a backend refresh and retries, with a final direct API fetch fallback. This ensures lorebooks are always accessible regardless of SillyTavern's initialization timing.

## [1.8.10] - 2026-05-10

**Quest Framework Refinements & Progress Tracking**  
This update overhauls the quest logic to support narrative-driven failures, partial objective progress tracking, and recalibrated NPC emotional modeling.

### Added
- **Objective Progress Tracking**: Added support for quantity-based objectives (e.g., "Collect 6 Mushrooms [4/6]").
    - Visual progress pills in the quest log UI.
    - Automated state merging for partial progress updates.
    - Support for both Modern (JSON) and Legacy (Plain Text) tracking modes.
- **Dynamic Narrator Instructions**: The system prompt now automatically swaps quest instructions based on the active mode (Standard vs. Legacy) and RNG settings.
- **Automatic Prompt Synchronization**: Implemented an "auto-sync" mechanism that updates unmodified stock prompts to the latest version upon extension load.

### Changed
- **Frustration Logic Recalibration**: NPCs now stay in the "Pleased" to "Neutral" range until a deadline is actually missed. Frustration penalties now ramp up exclusively *after* the deadline has passed.
- **Narrative-Driven Failures**: Explicitly authorized the AI to trigger quest failures if an objective becomes narratively impossible (e.g., target death), independent of automated deadline logic.
- **RNG Queue Instructions**: Clarified that the first number in each `[RNG_QUEUE]` entry is the d20 result to eliminate ambiguity during combat.

### Fixed
- **Legacy Prompt Routing**: Fixed a bug where Legacy Mode was stripping instructions from the modern prompt instead of injecting the dedicated legacy prompt.
- **LogQuest Tool Descriptions**: Updated tool documentation to reflect the new post-deadline frustration behavior.

## [1.8.7] - 2026-05-09

### Added
- **Per-Module Pagination Thresholds**: You can now set independent pagination limits for every module (stock and custom).
    - Added "Pagination Threshold" input to the **Custom Module Editor** and **Prompt Editor**.
    - Changes update the UI in real-time as you type, allowing for instant layout fine-tuning.
- **Robust "Linear Stone" History**: 
    - **Dual-State Archiving**: Updates (both narrative and direct) now archive both the *old* and *new* states to history. This ensures that committing to a past state never permanently clobbers your most recent work.
    - **Direct Prompt Persistence**: Fixed a bug where manual tracker updates via direct instructions were lost during history traversal.
    - **Fluid Snapshot Restoration**: Clicking the nav label now restores a past state instantly without a confirmation popup, as the operation is now completely reversible.

### Changed
- **Unified History Depth**: Increased history limit for Direct Prompt updates from 5 to **1000 items** to match the narrative update cycle.
- **UI Responsiveness**: Removed the requirement to save a module configuration to see pagination changes; the tracker now re-renders immediately upon input.

### Fixed
- **Infinite Snapshot Duplicate Bug**: Resolved a logic error where jumping between historical snapshots and the "Live" state would create redundant duplicates of the same state in the history stack.
- **Clear State Pointer Bug**: Fixed a bug where clearing the tracker history didn't reset the internal state pointer, leading to incorrect history slicing on the next update.
- **Empty State Archiving**: Fixed a guard condition that prevented archiving the very first state (empty) into history.
- **Quest Settings Persistence**: Fixed a regression where "Deadlines" and "Frustration Levels" toggles failed to persist across session reloads.


## [1.8.2] - 2026-05-05

**Waterproofing RPG State Persistence**  
This update introduces a deterministic, non-regex JSON cleaner for tool-call metadata and a surgical RNG queue stripper. These optimizations eliminate token bloat caused by redundant tool signatures and metadata, saving approximately 1,500 tokens per dice roll.

### Added
- **Total Tool-Call Bloat Removal**: The State Model now completely excludes mechanics-heavy tool results (signatures, reasoning, parameters) from its context. It relies exclusively on the narrative descriptions that follow a roll, significantly reducing context usage.
- **Surgical RNG Stripping**: Implemented a "waterproof" regex mechanism for stripping `[RNG_QUEUE]` blocks from the user's last action, ensuring AI context remains clean while maintaining 100% stability.
- **Expanded RNG Queue**: Increased the pre-rolled `[RNG_QUEUE]` length from **8** to **12** to provide more headroom for complex combat encounters.

### Changed
- **Unified Versioning**: Synchronized framework version to **1.8.2** across manifest, changelog, and system prompt UI.
- **Context Filtering**: Wired the cleaner into both the automatic `StateModelPass` and the manual `Direct Prompt` pipelines to ensure consistent token savings across all interaction modes.


**Chat-Linked State Persistence**  
This major update introduces per-chat isolation for the RPG State Tracker, allowing for seamless transitions between different campaigns and characters.

### Added
- **Chat-Specific Isolation**: Memos and history are now automatically scoped to the active SillyTavern Chat ID. Switching chats will swap the tracker state instantly.
- **Smart Conflict Resolution**: When linking to a chat that has existing data, a native SillyTavern modal prompts for **RESTORE**, **OVERWRITE**, or **CANCEL**.
- **Automatic History Backup**: Discarded "Global" work is automatically pushed into the chat's history during transitions to prevent data loss.
- **Clean Slate Onboarding**: New chats automatically start with an empty tracker while preserving your custom module configurations.

### Changed
- **Unified Versioning**: Synchronized framework version to **1.8.0** across manifest, changelog, and system prompt UI.
- **Improved Modal Experience**: Replaced generic browser alerts with premium, native SillyTavern popups.

### Fixed
- **State Overwrite Bug**: Resolved an issue where toggling Chat Link could accidentally wipe existing chat data with the current live state.

## [1.7.5] - 2026-05-05

**Waterproof Markers & UI Streamlining**  
This update focuses on "waterproofing" the RPG Marker system and cleaning up the Editor UI for a more professional experience.

### Fixed
- **"Waterproof" Marker System**: Resolved a bug where visual markers like `((PILLS))`, `((BAR))`, and `((XPBAR))` were being stripped from the state data sent to the AI. The system now preserves these markers throughout the entire round-trip, ensuring 100% reliable HUD formatting.
- **ST API Compatibility**: Added support for both `max_tokens` and `max_new_tokens` in the TextCompletionService payload, ensuring stability across different SillyTavern backends.
- **UI Logic Stability**: Fixed a critical `TypeError` in `sendStateRequest` that could occur when switching between connection profiles.
- **General Linting**: Fixed multiple "silent" errors including missing header definitions, incorrect API signatures, and jQuery type-safety issues in both the main extension and the `Summaryception` connection utility.

### Changed
- **Editor UI Refinement**: Removed the "Preview" toggle button from the Custom Field Editor. On supported desktop displays, the **Testing Sandbox** is now permanently visible to provide instant feedback.
- **Version Synchronization**: Incremented framework version to **1.7.5** across the manifest and the internal system prompt footer.

## [1.7.4] - 2026-05-05

**Enhanced Connectivity and UI Refinement**  
A comprehensive upgrade to the external LLM pipeline and settings organization, enabling direct-to-backend connections with robust parameter mapping.

### Added
- **Direct Backend Connectivity**: Introduced the ability to route State Tracking requests directly to **Ollama** or **OpenAI-Compatible** endpoints (like OpenRouter, LM Studio), bypassing SillyTavern's internal profile system for ultra-low-latency background updates.
- **Universal Parameter Mapping**: Implemented a multi-tier fallback system for generation settings. The framework now correctly extracts and maps `temperature`, `top_p`, `frequency_penalty`, and `repetition_penalty` across all SillyTavern preset formats (supporting both TextGen and OpenAI-specific key names).
- **Diagnostic Transparency**: Added high-verbosity browser console logging (Debug Mode) that explicitly outputs the `Applied Preset Data` and final `Parameters` used for each request.

### Changed
- **Settings UI Drawer System**: Refactored the settings panel into an expandable **Drawer** system. 
    - **Connection Settings** and **Advanced Options** now reside in collapsible headers to keep the main menu clean.
    - **Context & Lorebooks** has been promoted to a top-level section for better discoverability.
- **Header Aesthetics**: Updated the extension's main drawer icon and bold styling to match SillyTavern's native visual standards.
- **Layout Optimization**: Optimized button widths (Add Custom Field, Test Connection, Factory Reset) for better responsiveness in narrow sidebars.
- **Combat Tracking**: Updated the default [COMBAT] prompt to include explicit `COMBAT ROUND X` tracking per combatant.

### Fixed
- **Property Name Collision**: Resolved an issue where presets created under OpenAI profiles would fail to apply their temperature settings due to differing property names (e.g., `temp` vs `temp_openai`).
- **Button Alignment**: Fixed vertical squishing and awkward text wrapping on manual action buttons.

## [1.7.1] - 2026-05-04

### Fixed
- **Silent Model/Preset Switching**: Fixed a major regression where background RPG tracker passes would ignore the selected Connection Profile and Generation Settings Preset. The system now correctly routes requests through specific models (like GPT-5.6 Luna) with custom sampler overrides (like disabling reasoning) silently and reliably.

## [1.7.0] - 2026-05-04

**Custom Field Overhaul and Universal Markers**  
A major refactor of the Custom Field Editor and rendering engine, giving users total control over AI instructions while enabling high-fidelity markers (pills, bars) in every stock module.

### Added
- **Universal Marker Support**: `((PILLS))`, `((BAR))`, `((XPBAR))`, `((BADGE))`, and `((HIGHLIGHT))` now work in ALL built-in modules (INVENTORY, ABILITIES, SPELLS, XP, TIME).
- **Decoupled AI Instructions**: The Custom Field Editor now separates the visual template from the AI prompt, allowing for raw, unmanipulated instruction sets.
- **CFE Color Guide**: Added a one-click guide button to the Custom Field Editor to help users quickly implement colored text and rarity tags.
- **CFE Help System**: Added tooltips to the Custom Field Editor to clarify the distinction between UI previews and AI instructions.
- **Instruction Hardening**: Added a new `<custom_formatting>` block to core instructions to better guide the AI on when to use graphical markers.

### Changed
- **Decommissioned Sub-Field Rules**: Removed the legacy global label-mapping system. All rendering is now handled via the more powerful and flexible template system.
- **Renamed Dice Tool**: "Dice Roll (Fatbody)" is now **"Dice Roll (with DC)"** for better transparency.
- **Restored Stock Prompts**: Reverted module prompts to their high-performance legacy versions as requested by the community.
- **UI Typography**: Increased subtext and tooltip font sizes for improved readability.

### Fixed
- **Lookback Update Logic**: Fixed a bug where manual "Lookback Update" was ignored in favor of persistent settings. It now correctly overrides the context window for one-time refreshes.
- **Mobile CFE Stability**: Resolved multiple layout bugs in the Custom Field Editor for mobile devices, including top-clipping, z-index layering issues, and redundant UI elements.

## [1.6.0] - 2026-05-04

**Improved Customization and Advanced Options**  
Significant upgrades to editing custom fields. The formatting is now clear, and there's a live preview window, which makes design a breeze.

### Added
- **Advanced Options Update**: Deep customization for the State Model's intelligence.
- **Precision Lookback Control**: You can now specify exactly how many previous messages (User/Assistant) and how many historical tracker states the model sees when making updates.
- **Lorebook Context Support**: You can now select which specific Lorebooks the tracker is aware of during updates, ensuring it stays consistent with your world info.
- **Enhanced Custom Field Editor**:
    - **Live Preview Window**: Real-time rendering of your tracker blocks while you edit prompts.
    - **Color Support**: Full support for `<font color=#...>...</font>` tags and native WoW-style rarity tags like `[Legendary]`, `[Epic]`, etc., which are now automatically colorized.
    - **Contextual Formatting**: Module prompt examples now use stock fields (like CHARACTER and ABILITIES) to guide better formatting.

### Fixed
- **UI Headers**: Fixed a bug where the preview window would show raw tags like `__PREVIEW__` instead of proper field labels.
- **Live Preview Interactivity**: Pagination and list/page views now work correctly within the live preview window.

## [1.5.5] - 2026-04-29

### Fixed
- **Mobile Prompt Access**: Embedded system prompts directly into the code and implemented an HTTP-compatible clipboard fallback. This ensures the SYSPROMPT button works on mobile/Termux environments where local file fetching and modern clipboard APIs are often restricted.

### Added
- **Full-Screen Mobile Support**: The tracker now expands to cover the screen on mobile, optimizing space.
- **Button Alignment Fixes**: Centered all navigation and RNG buttons, ensuring they align vertically and horizontally.
- **Settings Drawer Refinement**: Polished the collapsible footer to keep settings accessible but out of the way.

### Added
- **Mobile UI Optimization**: Implemented responsive CSS for mobile devices (max-width 600px).
- **Adaptive Footer**: The bottom bar now stacks vertically on mobile, hides the character counter, and uses compact labels to prevent button overlapping and ensure reliable touch targets.

### Changed
- **Initiative System**: Shifted pre-combat initiative rolls from the RNG Queue to the Tool Call system for better narrative integration.
- **Resting Rules**: Reduced the Long Rest cooldown to 9 hours and implemented a d20-based interruption check for resting in dangerous locations.
- **RNG Queue Constraint**: Strictly isolated the RNG Queue to active combat actions only.
- **Prompt Synchronization**: Updated the legacy fallback prompt to maintain parity with the latest system rules.

### Fixed
- **Detached UI Scrolling**: Fixed an issue where undocked panels (Combat, Party, etc.) would not allow internal scrolling.
- **Resize Handle Conflict**: Resolved a bug where grabbing the resize handle on detached windows would trigger the scrollbar track.
- **Content Overflow**: Optimized card layout within detached panels to ensure proper scroll-height calculation for large entity lists.

## [1.5.0] - 2026-04-28

### Added
- **Visual Status System**: Status effects are now color-coded. Buffs (marked with `(+)`) are Emerald Green, and Debuffs (marked with `(-)`) are Crimson Red.
- **Resource Capsule Icons**: Replaced the generic information icon with dynamic resource trackers. If an ability or spell has a usage count (e.g., `2/3`), it is displayed directly in the pill icon.
- **XML-Structured Instructions**: Completely refactored the State Model prompt using semantic XML tagging for vastly improved instruction following and clarity.
- **Enhanced Status Labeling**: Standardized status formatting to ensure both mathematical effects and durations are preserved in the HUD.
- **Dynamic Adaptive Icons**: Pill icons now expand into capsules to support multi-digit resource counts (like `10/10`) with improved typography.

## [1.4.4] - 2026-04-28

### Added
- **Lookback Update Option**: Added a third manual update mode that allows users to specify exactly how many past assistant turns to parse. This is useful for summarizing multi-turn dialogue or complex narrative sequences without a full context audit.

## [1.4.3] - 2026-04-27

### Fixed
- **Interceptor Metadata Integrity**: Refactored the RNG/State interceptor to use in-place modification. This ensures that hidden SillyTavern metadata (like Reasoning/Thinking content) is preserved exactly as the engine expects, preventing 400 errors with models like DeepSeek R1.
- **Enhanced Thinking Stripping**: Expanded the State Model pass filter to automatically strip `<thought>`, `<thinking>`, and `<reasoning>` tags to prevent API validation errors.

## [1.4.2] - 2026-04-27

### Fixed
- **Multi-Part Message Tracking**: Fixed a critical bug where the State Model failed to process narrative text generated *before* a tool call within a single AI turn. The tracker now seamlessly aggregates all assistant message chunks since the last user message.

## [1.4.1] - 2026-04-27

### Changed
- **Settings UI Optimization**: Removed redundant "Dice & Tools" toggles from the settings panel, as they are now handled exclusively by the interactive footer buttons.
- **System Prompt Refinement**: Hardened RNG and combat rules and unified terminology around `[RNG_QUEUE v6.0_PROPER]` across all system prompt versions.

## [1.4.0] - 2026-04-27

### Added
- **Hybrid RNG Architecture**: Introduced a dual-system approach to random number generation.
  - **RNG Queue (Combat)**: Pre-rolled dice for speed and anti-sycophancy in structured play.
  - **Tool Call RNG (Narrative)**: Reactive, AI-driven rolling for skill checks to prevent narrative "cheating."
- **"Waterproof" Narrative Logic**: Mandatory `dc` (Difficulty Class) parameter enforced in the `RollTheDice` tool. The AI must now commit to a difficulty *before* seeing the roll result.
- **Enhanced SYSPROMPT Selector**: Added a multi-version popup menu to the `SYSPROMPT` button, allowing users to choose between the **Modern (Hybrid)** and **Legacy (Queue-only)** system prompts.
- **Dynamic Footer UI**: Completely refactored the footer buttons with an "Accordion Squeeze" responsive design that hides labels/text as the UI box is resized, rather than stacking vertically.
- **Slash Commands**: Added `/roll` and `/r` commands for manual dice rolling via the command bar.

### Fixed
- **Core Stability**: Resolved a critical initialization crash in the UI core caused by a missing API provider in the slash command registration.
- **Responsive Stacking**: Fixed a bug where footer buttons would stack vertically and misalign on narrow screens.

## [1.3.5] - 2026-04-27

### Fixed
- **Tool Calling Compatibility**: Resolved a critical issue where the tracker would interrupt and break SillyTavern's internal tool-calling sequences.
  - Refactored the core event listener from `MESSAGE_RECEIVED` to `GENERATION_ENDED` (and `GENERATION_STOPPED`). The State Model will now patiently wait for the entire AI tool chain to finish before triggering an update, rather than firing in the "gaps" between tool execution steps.

## [1.3.4] - 2026-04-27

### Changed
- **Buff/Debuff Logic Overhaul**: Refactored how temporary effects and stat modifications are tracked.
  - Relocated "restoration anchors" to the stat lines themselves (e.g., `AC 18 (base 13)`), allowing for cleaner status displays.
  - Standardized Status line formatting to focus on absolute mathematical effects (e.g., `Shield (+5 AC, 1 turn)`).
  - Improved Narrator and State Model synergy for automatic buff expiration and stat restoration.

## [1.3.3] - 2026-04-27

### Fixed
- **Mobile Profile Management**: Resolved an issue where saving, loading, or deleting profiles would fail on mobile devices (especially iOS PWAs).
  - Replaced native `prompt()` and `confirm()` calls with SillyTavern's built-in async modal system.
  - Implemented an async event-handling pattern for the Profile UI to support non-blocking user input.
- **RNG UI Tweak**: Integrated the RNG Physics Engine toggle directly into the footer navigation bar as a professional, horizontally-centered pill button with responsive mobile scaling.

## [1.3.2] - 2026-04-26

### Fixed
- **UI Boundary Protection**: Implemented safety checks to prevent the UI from becoming inaccessible if moved or saved off-screen.
  - Added coordinate sanitization to `loadPanelGeometry` and `createDetachedPanel` to ensure the panel always spawns within the visible viewport.
  - Implemented movement constraints in the dragging logic to prevent moving the panel header beyond the browser window edges.

## [1.3.1] - 2026-04-26

### Fixed
- **Custom Field Limit**: Resolved a bug that limited the number of custom fields to two. 
  - Implemented unique tag generation for new fields (e.g., `NEW_FIELD`, `NEW_FIELD_1`).
  - Added real-time tag validation to prevent duplicate or reserved tags (like `XP` or `CHARACTER`).
  - Added an auto-sanitization pass to `refreshOrderList` to automatically fix any existing duplicate tags in user settings.

## [1.3.0] - 2026-04-25

### Added
- **Starting Level Selector**: Added a "Starting Level" dropdown (Levels 1–20) to the initial setup screen. 
- **Dynamic Archetype Generation**: The Magic, Melee, and Rogue archetype buttons now dynamically generate characters consistent with your chosen starting level (including appropriate gear and spells).
- **Advanced D&D 5e Rules**: Updated `sysprompt.txt` with specific tracking for Distance & Range, Opportunity Attacks, and disadvantage on Ranged Spells in melee combat.
- **Archetype Overhaul**: Significantly improved the character generation "wizard".
  - All archetypes (Magic, Melee, Rogue) now consistently generate **[INVENTORY]** and **[ABILITIES]** blocks.
  - Numbered prompts ensure more thematic gear (Thieves' Tools, Signature Weapons) and class features (Sneak Attack).
- **Finalized Onboarding**: Completed the new user walkthrough in the empty state with descriptions and a manual creation guide.

### Changed
- **Ability Pill Formatting**: Updated the stock prompts to enforce the `Ability Name (brief description)` format, ensuring all class features render correctly as interactive UI pills.
- **Onboarding Guidance**: Added a reminder to the startup guide to reset extension prompts and re-copy the system prompt after a framework update.

### Fixed
- **Comma Support**: Updated the parser for HP, XP, and Hit Dice to support numbers with commas (e.g., `100,000`), preventing display failures with high-value stats.
- **UI Alignment**: Centered the level selector dropdown to sit correctly above the archetype selection buttons.

## [1.2.9] - 2026-04-24

### Fixed
- **Factory Reset**: Resolved a race condition where the page would reload before the reset request is finalized in storage. Replaced blocking alert with a non-blocking toast and delayed reload.

## [1.2.8] - 2026-04-24

### Fixed
- **Onboarding UX**: Fixed markdown bolding in the onboarding guide and scaled up all font sizes for better readability.
- **Profile Persistence**: The profile dropdown now correctly remembers the "-- No Profile --" selection across page refreshes.

### Added
- **Guided Creation**: Updated the startup guide to suggest using the manual update icon (💬) for character creation via description.

## [1.2.7] - 2026-04-24

### Added
- **Interactive Onboarding**: Added a comprehensive step-by-step startup guide to the empty tracker state.
  - Numbered walkthrough for initial character setup and prompt configuration.
  - Included a highlighted "Update Alert" warning to notify users when they need to re-copy the system prompt.
  - Redesigned archetype buttons for better visual integration.

## [1.2.6] - 2026-04-24

### Fixed
- **Profile Persistence**: Scenario profiles now correctly save and restore the **Module Order** and **Active Modules** status.
- **Settings UI Sync**: Loading a profile now immediately updates the Module Settings list in the UI to reflect the loaded configuration.

### Changed
- **Enhanced Reset**: The "Reset ALL Prompts" button now also resets the module layout order and re-enables all stock modules to factory defaults.

## [1.2.5] - 2026-04-23

### Added
- **Hit Dice Tracking (HD)**: Added a new `HD` field for Characters and Party members.
  - Renders as high-fidelity gold pips (`[ dX ] 🔵🔵⚪`) to differentiate from blue spell slots.
  - Automatically included in default system prompts.
- **Last Rest Time Engine**: The `[TIME]` section now supports a `Last Rest:` field.
  - The UI dynamically calculates and displays the time elapsed (e.g., "10 hours ago") relative to the current game time.
- **Improved Prompt Clarity**: Refined prompt instructions for Time, Inventory, and HP to be more authoritative and direct.

## [1.2.4] - 2026-04-23

### Added
- **Combat-First Layout**: The `[COMBAT]` section now defaults to the top of the UI for quicker access during encounters.
- **Enhanced Entity Detail**: The `Other:` and `Resistances:` fields in Combat, Character, and Party blocks now utilize the interactive **Unit Pill** system.
  - Descriptions in parentheses now appear as glassmorphism tooltips.
  - Consistent styling across all entity-based data fields.

### Changed
- **Refactored Renderer**: Centralized the pill rendering logic to ensure uniform behavior across all framework sections.

## [1.2.3] - 2026-04-23

### Added
- **Native Auto-Updates**: Enabled native SillyTavern auto-update support. The extension will now automatically notify you of new updates in the UI and can be updated with a single click from the Extensions menu.

### Fixed
- **Standardized Spell UI**: Completely refactored the spell display format across the [PARTY] and [SPELLS] blocks.
  - Spells are now displayed using a low-cognition format (one line per spell level).
  - Fixed a grid-overflow bug in the PARTY UI that caused long spell names to stack vertically or clip.
  - Unified the horizontal-flowing pill layout for all spell levels.

### Changed
- **Manifest Update**: Optimized `manifest.json` for better integration with SillyTavern's third-party extension tracking.

## [2026-04-22] - UI & XP Enhancements

### Added
- **Character Level in XP Section**: Added character level display to the [XP] block, showing both level and experience progress in a single unified UI row.
- **Resource Depletion Logic**: The DM now strictly monitors resource usage. If a player attempts to use an ability or spell with 0 uses remaining, the DM will pause the narrative and request a different action.
- **Combat Field Expansion**: Enemies now track "Other" properties (Resistances, Immunities, Special Traits) with dedicated styling in the HUD.

### Changed
- **XP Block Prompting**: Updated the State Model prompts to ensure level tracking is maintained alongside experience points.
- **Support for Hybrid Formatting**: The UI now supports both `XP: current/max` and `Level: X | XP: current/max` formats for backward compatibility.
- **Interactive Unit Pills**: Standardized the **Traits** and **Abilities** sections into interactive "Unit Pills."
- **Tooltip System 2.0**: Descriptions are now revealed in a glassmorphism hover bubble that does not cause layout shifts (fixing the edge-of-screen "flashing" bug).
- **CSS Iconography**: Replaced distorted unicode characters with perfectly circular, CSS-drawn info icons (ⓘ).
- **Smart Parsing**: Implemented a stack-based parser to correctly handle complex traits and abilities that contain internal commas.
- **Global Deselect**: Clicking any empty space on the tracker now automatically closes any open interactive elements.

## [2026-04-21] - Rebranding & Physics Integration
- **Framework Rebranding**: Renamed from RPG Tracker to **Multihog D&D Framework**.
- **RNG Physics Engine**: Integrated the Prompt Injection RNG system for transparent, physics-based rolling.
- **HUD Controls**: Added "SYSPROMPT" and "RNG" toggle buttons directly to the tracker panel.
- **Optimized Layout**: Reordered sections to prioritize Character and Combat status over meta-stats like XP and Time.
- **Factory Reset**: Added a "Factory Reset" button to the settings panel for easy recovery of default prompts.
# 2026.8.22.3

- Added map-free BUILDING containers with deterministic first-entry population through the normal Map Updater pass, explicit rumor-seeded SUSPECTED contents, and atomic off-screen Evolution population.
- Asset placement now supports the closed containment pairs BUILDING → occupants/objects/loot/hazards/traps and CREATURE/GROUP → carried objects/loot, including effective-area movement, filtering, inspection, and presentation.
- Untouched Map Architect, Map Updater, and Map Evolution prompts migrate to the new container policy while customized prompts remain unchanged.
