# Changelog

All notable changes to the **Multihog D&D Framework** will be documented in this file.

## [5.9.0] - 2026-07-20

### Added
- **Choose Your Own Adventure (CYOA) Engine**: A robust interactive choice system, inspired by Disco Elysium was added to the narrator framework. Click the cog icon next the CYOA component to see the new additions!
  - **Clickable Choices**: Choices are generated as interactive buttons at the end of the AI's response. Clicking a choice instantly sends it as your next chat message.
  - **Dynamic Choice Slots**: Define exactly how many choices the AI should generate and assign specific roles to each (e.g., Narrative, Normal dialogue, Roll Requirements, Trait/Ability checks, or Custom Prefixes like `[Attack]`).
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
- **Model guidance**: Onboarding + README note Combat API Override for slow-thinking GM models (Gemini 3.5 Flash, Medium thinking).

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
- **Onboarding copy**: Updated How It Works, Initial Setup (time/date step), and simplified model recommendations (MiMo 2.5 Pro GM, Gemini 3.1 Flash-Lite for tracker/agent).
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
- **Silent Model/Preset Switching**: Fixed a major regression where background RPG tracker passes would ignore the selected Connection Profile and Generation Settings Preset. The system now correctly routes requests through specific models (like Gemini 3 Flash) with custom sampler overrides (like disabling reasoning) silently and reliably.

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
