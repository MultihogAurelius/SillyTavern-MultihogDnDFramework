### This extension is now mostly feature-complete. Bug-fixing, balancing, adjusting, etc. continues. Pull requests are appreciated in case you find a bug. I want to get this into a good, solid final state.

---


# Multihog D&D Framework

*A highly customizable and modular RPG platform/simulation engine for SillyTavern.*

Started off as a humble "RPG State Tracker" but has since expanded into a more ambitious game engine, simulation system, and modular RPG platform where you can even make your own RPGs with their own systems and game logic — and all of this can be done through AI prompting via numerous integrated AI wizards/tools.

By default, ships with a plug-and-play "hardcore" setup that can best be described as simulation autism. Actions have consequences, and there is no scaling. The dragon will kick you to the curb even if you're level 2. The core aim and philosophy is to deliver an immersive experience through robust simulation logic, using realistic time passage as the backbone that ties into numerous other systems, and this aforementioned "player-agnosticism/neutrality." Fundamentally it acts as a cohesive RPG framework as well as an anti-sycophancy system.

I know it says "D&D Framework," but in addition to fantasy, the system works just as well for casual "slice of life" scenarios, modern settings, or anything else imaginable, so you're by no means limited to wizards and goblins. Everything is FULLY customizable and homebrew-friendly, complete with AI wizards, so next to no technical knowledge is required.

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/878e437c-e7b4-4140-94b9-f9a14aab1002" width="60%" alt="A basic character sheet" />
  <br>
  <em>A basic character sheet</em>
</p>

---

### The Core Components:

1. 🖥️ **RPG State Tracker** -  Extracts and maintains HP, inventory, party, buffs, XP, spells, and more via a dedicated second-pass model. Injects a rolling State Memo back into each prompt to keep the AI (and you) on track.
2. 🎲 **Hybrid RNG System** - A dual-engine approach to tabletop physics. 
   - RNG Queue: Pre-seeded deterministic dice injected into every turn. Cheaper than using tool calls and very smooth when a lot of rolls are used in sequence such as in combat.
   - Tool Call RNG: Enables a commitment logic where the AI must declare a DC before seeing the result, completely preventing sycophancy.
3. 🤖 **Lorebook Agent** - Automatically creates, activates/deactivates, updates, consolidates, etc, lorebook entries, ensuring long-term memory despite summarization.
4. 🌍 **World Progression** - A location-centric macro simulator that creates daily (or more frequent) prose reports from readable location lore and an optional world skeleton. Reports steer the narrator immediately and are realized lazily by Map Evolution; granular entities and hidden maps remain outside WP authority.
5. 🗺️ **Map Evolution** - Dungeons and settlements evolve autonomously. Enemies may repopulate or set up ambushes, third-party scavengers may enter, etc.

Together they solve the four core problems of LLM tabletop RP: the AI forgetting your inventory/spells, the AI forgetting long-term context, you always winning (aka. plot armor), and the world being static outside of the immediate player's bubble. I have high confidence in the system's reliability—you can just play and not worry about tinkering with much of anything.

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/ea7d9ff2-9c32-4a81-9c28-d4f11a7e26f7" width="60%" alt="Combat in progress" />
  <br>
  <em>What is even Map Evolution? Well, this screenshot illustrates it quite well!</em>
</p>

---

## Highlights

- **Full Mobile support**: Continue on your phone where you left off on desktop.
- **AI-powered effortless creation**: generate entire game systems effortlessly from plain language prompts. AI handles it all.
- **Automatic spell slot tracking**: via 🔵 pips in the UI; never worry about remembering how many you have left.
- **Buff/debuff temporal decay**: via [TIME] delta tracking; statuses expire automatically over time based on time elapsed.
- **CYOA Mode**: Offers you clickable choices for frictionless gameplay. Completely optional, of course.
- **Auto model-switching**: The best models for the task.
- **Party-benching system**: Send your squad on quests; they will automatically eventually return, and their success/failure depends on their aptitude and RNG.
- **Custom fields, AI theme wizard, reorderable sections**; track whatever you want beyond the stock fields and customize the visuals to your liking.
- **Robust character creation options**: Specify detailed character information, a simple description, or just roll a completely random character.
- **Save your RPGs as Game Cartridges**: A complete snapshot of your RPG configuration. Importing and exporting is supported for easy backups or even sharing.
- **Homebrew-friendliness** and flexibility in general, supporting any genre.
- **Autonomous Lorebook Agent** handles your lorebooks completely hands-free, with no configuration necessary.
- **Talk to the models directly via (💬)**, making editing or adding things easy.
- **AI Portrait Generation and Real-Time Visualization Mode**: Portraits for everything, and a visualizer viewport.
- **Character card importing** — import any existing character into the story as an NPC; AI will automatically adapt it to the story, regardless of setting/theme.
- **Life/dating sim-style friendship/affection component**: Build friendships and romance.
- **d100 support** for percentage-based systems/calculations.
- **Adventure Companion**: Learn the framework with an optional Tutorial Mode, discuss your adventure, update campaign state or lore, and even ask it to take your next turn.
- **Efficient Dual-Engine RNG**: Deterministic queue for instant combat; tool calls for narrative skill checks.
- **Detailed Maps**: Granular asset-level maps that constantly evolve and develop their own micro-narratives even when you're not around.

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/8e615285-1eed-4312-98c6-6cb47febaed5" width="100%" alt="Combat in progress" />
  <br>
  <em>Some combat in progress</em>
</p>

---

## Installation

**The packaged releases will likely not be up to date. I recommend cloning the repo or taking the steps below.**

1. Go to the SillyTavern extension menu.
2. Click on "Install extension" at the top.
3. Enter this repo's URL.

## Usage Guide

1. **Initial Setup:** Use the archetype buttons on the empty tracker to roll a new character, or paste an existing sheet into the "Raw View" (if your sheet doesn't align with what the UI expects, ask the model via 💬 to fix the formatting). Create a character card for your "narrator," such as Simulation Engine that I use. You can also name it something like Game Master.
2. **Auto-Tracking:** As you roleplay, the extension intelligently parses assistant responses. It detects losses of HP, new loot, or combat triggers, stitching together multi-part tool-call responses and running background passes to update the state.
3. **Prompt Injection & Execution:** The State Memo and RNG Queue are injected seamlessly into your outgoing prompt to act as the "source of truth." For narrative actions, the framework dynamically catches and resolves the AI's `RollTheDice` tool calls.
4. **World Progression Skeleton & Settings:** Optionally create a macro-only world skeleton of locations, factions, and conflicts. Locations become simulation subjects while factions and conflicts provide wider context; named NPCs are established through play and ordinary lore instead.

### Initial Setup Video Guide

https://www.youtube.com/watch?v=82Lt9pRYFS0

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/368d05be-009b-4f0d-b753-5c3cf8ae7dad" width="60%" alt="Combat in progress" />
  <br>
  <em>Area Maps are Detailed and Dynamic</em>
</p>

---

## A Summarizer is Mandatory

- 🧠 **[Summaryception](https://github.com/Lodactio/Extension-Summaryception):** Get this or an equivalent one that can summarize and hide verbatim messages. The extension is intended to be used with one.

---

<div align="center">
  <figure>
    <img width="1918" height="982" alt="Screenshot 2026-06-18 195917" src="https://github.com/user-attachments/assets/cdd183ac-7a22-470d-8800-9cc9e6ce79d4" />
    <em>World of Warcraft Scenario</em>
  </figure>
</div>

---

## License

Copyright (c) 2026 MultihogAurelius

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](LICENSE) for the full text.
