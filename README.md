# Fatbody D&D Framework

*A D&D-lite simulation engine for SillyTavern.*

What this framework does is essentially turn SillyTavern into something like AI Dungeon, but with actual mechanics/consequences. Losing or dying is actually a thing. In Big Rigs, you're always WINNER. Not in Fatbody D&D! 

I wasn't satisfied with any of the commercial offerings available (AI Realm, AI Dungeon, Friends & Fables, etc.), so I made my own D&D platform inside SillyTavern. 

**Crucially, the system is input-output, not just some glorified stats collector. Your state info feeds back into the narrative AI.**

---

## 🚀 What's New in v3.0.0

The biggest update yet — a complete overhaul of the rendering engine, AI-assisted configuration tools, and combat balancing.

### 🎨 Universal Inline Rendering Engine
The rendering system has been rebuilt from the ground up. **20+ rendering tags** are now available and work **inline anywhere** — no longer restricted to the start of a line. Use them freely across stock fields, custom fields, and quest logs.

- **Color Bars**: `((BAR))`, `((BARRED))`, `((BARBLUE))`, `((BARGREEN))`, `((BARYELLOW))`, `((BARPURPLE))`, `((BARORANGE))`, `((XPBAR))`
- **Status Pills**: `((PILLS))`, `((PILLRED))`, `((PILLGREEN))`, `((PILLBLUE))` — with optional tooltip descriptions via parentheses (e.g. `Bleeding (1d4 dmg)`)
- **Alert Badges**: `((WARNING))`, `((DANGER))`, `((SUCCESS))`, `((INFO))`, `((BADGE))`
- **Economy Coins**: `((GOLD))`, `((SILVER))`, `((BRONZE))`, `((DOLLAR))`
- **Creative Tags**: `((HEART))`, `((SKULL))`, `((SOUL))`, `((ROLL))`, `((HIGHLIGHT))`
- **Quest Tags**: `((OBJ))`, `((REWARD))`, `((DIFFICULTY))`, `((PROGRESS))`

### 📚 Rendering Tags Library
A new interactive popup accessible from settings that renders **live, pixel-perfect previews** of every available tag using your active theme. No more guessing what a tag looks like — see it exactly as it appears in the tracker.

### 🪄 AI Custom Field Creator
Press **"Add Custom (AI)"** and describe what you want to track in plain language. The AI generates a fully configured field complete with:
- Field name, icon, and tracking instructions
- `FORMAT:` and `EXAMPLE:` sections so the gameplay AI knows exactly how to render it
- Automatic rendering tag selection from the full library
- Full system prompt awareness — if the mechanic already exists in your sysprompt, the AI bases its field off that system

### 🛠️ AI Section Builder
Describe a new game mechanic in plain text and the AI generates a complete XML-tagged sysprompt section. It reads your **entire current system prompt** first to ensure seamless, non-redundant integration. Preview before approving.

### ⚔️ Dynamic Enemy HP Scaling
Enemy difficulty now scales intelligently based on quest context:
- **Very Easy / Easy**: Enemies below or near player level
- **Normal**: Roughly at player level
- **Hard / Very Hard**: Brutal — Hard rewards smart play, Very Hard demands perfection
- **No quest active**: Pure narrative context, no hand-holding

### 🏆 Inventory & Combat Upgrades
- **Rarity Classification**: All inventory items now display `[Common]`, `[Uncommon]`, `[Rare]`, `[Epic]`, `[Legendary]`, or `[Artifact]` tags with emojis and estimated worth
- **Worth Tooltips**: Item value is hidden from display and revealed on hover
- **Legendary NPC Tier**: New world-threat tier with HP 150–500+, AC 19–22, ATK +11 to +15
- **Emergent Quest System**: No more formal NPC acceptance required — pursue a goal through action and it's automatically tracked

### 🔬 State Tracker Full Review Modes
- **Half Review Mode**: Medium-intensity — adjusts prompts to request complete output with balanced token usage
- **Full Review Mode — Aggressive**: Completely rewrites the system prompt to forcefully demand every single field is updated. Nothing gets missed.

---

### The Core Components:

1. 🖥️ **RPG State Tracker** — Extracts and maintains HP, inventory, party, buffs, XP, spells, and more via a dedicated second-pass model. Injects a rolling State Memo back into each prompt to keep the AI (and you) on track.
2. 🎲 **Hybrid RNG System** — A dual-engine approach to tabletop physics. 
   - **RNG Queue (Combat)**: Pre-seeded deterministic dice injected into every turn for high-speed, zero-latency combat resolution, neatly within a single output. Sidesteps the unreliability and massive input token costs of tool chains.
   - **Tool Call RNG (Narrative)**: A proactive AI-driven rolling system for non-combat skill checks. Features a "Waterproof" commitment logic where the AI must declare a DC before seeing the result, preventing narrative sycophancy and cheating.
3. 🤖 **The Lorebook Agent** — A fully autonomous lorebook manager that creates, updates, activates, and deactivates lorebooks for you in the background. Handles the macroscopic consistency of your adventure. Includes cleanup tools, full audit chunking, and an automated World Engine that generates daily background reports for off-screen NPC actions and faction events.

Together they solve the three core problems of LLM tabletop RP: the AI forgetting your inventory/spells, the AI forgetting long-term context, and you always winning (aka. plot armor). I have high confidence in the system's reliability—you can just play and not worry about tinkering with much of anything.

---

## Highlights

- **20+ Rendering Tags** with universal inline support and live preview library.
- **AI-Powered Configuration** — generate custom fields and sysprompt sections from plain language descriptions.
- **Dual-Engine Physics**: Deterministic queue for instant combat, and interactive tool calls for narrative skill checks.
- **Draggable HUD** with HP bars, spell pips, colored status pills, alert badges, and economy coins.
- **Automatic spell slot tracking** via 🔵 pips in the UI; never worry about remembering how many you have left.
- **Buff/debuff temporal decay** via [TIME] delta tracking; statuses expire automatically over time based on time elapsed.
- **Dynamic enemy scaling** — enemies adapt to quest difficulty and player level contextually.
- **Snapshot history + delta log** - easy rollback, and see at a glance what was changed in the state.
- **Auto model-switching** so that you can use a different model for tracking the state.
- **Full-context audit mode** with automatic chunking for massive chat histories.
- **Custom fields, themes, reorderable sections**; track whatever you want beyond the stock fields and customize the visuals to your liking.
- **Automatic D&D wikidot spell links** - look up spells by clicking on them without awkward googling.
- **Mobile support** (open from the wand menu).
- **Talk to the tracker model directly via (💬)**, making editing or adding things easy.
- **Onboarding system** - roll up a random character or describe one to the model.
- **Profile saving** - switch between multiple campaigns without losing your state.
- **Homebrew-friendly** and flexible in general, relying on AI to do a lot of the lifting.
- **Automatic Long-Context Tracking** via the Lorebook Agent with World Engine simulation.

<div align="center">
  <figure>
    <img width="2800" height="auto" alt="image" src="https://github.com/user-attachments/assets/6eb8b2b6-d4f6-4fc8-9d34-988ad03331ba" />
    <figcaption>Yep, things can go wrong!</figcaption>
  </figure>
</div>

## Installation

**The packaged releases will likely not be up to date. I recommend cloning the repo or taking the steps below.**

1. Go to the SillyTavern extension menu.
2. Click on "Install extension" at the top.
3. Enter this repo's URL.

## Usage Guide

1. **Initial Setup:** Use the archetype buttons on the empty tracker to roll a new character, or paste an existing sheet into the "Raw View" (if your sheet doesn't align with what the UI expects, ask the model via 💬 to fix the formatting). Create a character card for your "narrator," such as Simulation Engine that I use. You can also name it something like Game Master.
2. **Auto-Tracking:** As you roleplay, the extension intelligently parses assistant responses. It detects losses of HP, new loot, or combat triggers, stitching together multi-part tool-call responses and running background passes to update the state.
3. **Prompt Injection & Execution:** The State Memo and RNG Queue are injected seamlessly into your outgoing prompt to act as the "source of truth." For narrative actions, the framework dynamically catches and resolves the AI's `RollTheDice` tool calls.
4. **Validation:** Use the Delta Log (δ) to verify changes. If the AI ever makes a mistake, step backwards using the Snapshot Navigation (←/→) to restore a clean state. Not really needed much in my experience, but the option is there.

## Basic Video Walkthrough of the RNG System
https://www.youtube.com/watch?v=1n5x7VBJ0IU

## Suggested Companions

- 🧠 **[Summaryception](https://github.com/Lodactio/Extension-Summaryception):** A brilliant summarizer/context compression extension. Also handy for crunching all the combat mechanics of the context into summarized history.

## Don't Care About D&D?

You can scrap the entire system prompt and all the default fields and track your own things completely. The D&D setup is just a plug & play system that works by default. 

## What Model to Use?
Your primary narrator model must support **Tool Calling** for the Hybrid RNG system to work properly. 

<img width="920" height="246" alt="image" src="https://github.com/user-attachments/assets/f663cb1e-554a-40a2-a25e-f7af62c1a032" />

I like Deepseek 4 a lot so far, though it's still a new model. Gemini 3 is a good all-rounder; very fast and cheap. Sometimes its pace can be a bit much, though. GLM 5.1 is also a solid choice, but it can tend to reason far too long, bogging things down, especially in combat. Experimentation with different models is recommended.

For the state pass, I use Gemini 3.1 Flash Lite or Flash 3 with low reasoning. Very cheap and very good.

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/a0e1c88c-092f-488b-b421-48cabe09e6e2" width="100%" alt="Combat in progress" />
  <br>
  <em>Some combat in progress</em>
</p>

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/bd7debe0-b97d-4aa0-a8ec-49cd0fc527f3" width="500" alt="Lorebook Agent" />
  <br>
  <strong>Lorebook Agent</strong>
</p>

---

## License
MIT

***

*AND YES, IT IS FULLY VIBE-CODED IN ANTIGRAVITY AND CURSOR!*
