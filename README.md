# Multihog D&D Framework

*A D&D-based RPG platform/simulation engine for SillyTavern.*

This framework essentially turns SillyTavern into something like AI Dungeon, but with actual mechanics/consequences! Started off as a humble "RPG State Tracker" but has since expanded into a more ambitious game engine, simulation system, and modular RPG framework where you can basically make your own game. Mechanical integrity and simulation depth is key here. This isn't a narrative-first philosophy; it aims for relentless "simulation autism." The backbone of the system is time simulation.

In addition to fantasy, the system works just as well for casual "slice of life" scenarios, modern settings, or anything else imaginable, so you're by no means limited to wizards and goblins. Everything is FULLY customizable and homebrew-friendly, complete with AI wizards, so next to no technical knowledge is required.

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
4. 🌍 **World Progression** - A system that creates daily (or more frequent) reports about NPC/world affairs using existing lore entries as well as an optional world "skeleton" created beforehand. The world moves regardless of you.

Together they solve the four core problems of LLM tabletop RP: the AI forgetting your inventory/spells, the AI forgetting long-term context, you always winning (aka. plot armor), and the world being static outside of the immediate player's bubble. I have high confidence in the system's reliability—you can just play and not worry about tinkering with much of anything.

---

## Highlights

- **20+ Rendering Tags** with universal inline support and live preview library.
- **AI-Powered Configuration** — generate custom fields and sysprompt sections from plain language descriptions.
- **Dual-Engine Physics**: Deterministic queue for instant combat, and interactive tool calls for narrative skill checks.
- **Draggable HUD** with HP bars, spell pips, colored status pills, alert badges, and economy coins.
- **Automatic spell slot tracking** via 🔵 pips in the UI; never worry about remembering how many you have left.
- **Buff/debuff temporal decay** via [TIME] delta tracking; statuses expire automatically over time based on time elapsed.
- **Dynamic enemy scaling** — enemies adapt to quest difficulty and player level contextually.
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
- **AI Portrait Generation** via Pollinations.ai — free, non-profit image generation with full lorebook agent context awareness for accurate character portraits.
- **Inventory Currency Auto-Rendering** — items with a worth value automatically display a styled coin badge (gold, silver, bronze, or dollar) based on the currency type.
- **Character card importing** — import any existing character into the story as an NPC; AI will automatically adapt it to the story, regardless of setting/theme.
- **AI-powered Game Systems Wizard** — Simply describe any mechanic to the wizard in natural language (e.g. "reputation system), and the AI will build the system for you according to the structure of the extension (sysprompt + module.) Iterate, regenerate, or manually edit any block directly within the forge before saving.
- **Life/dating sim-style friendship/affection component.**
- **Export your entire setup as a "Game Cartridge."**
- **d100 (percentage-based rolls) support.**
- **Real-Time Visualization Mode** — Lorebook Agent can be turned into a visual viewer that generates images of the current scene (with adjustable frequency) and displays the portraits of the currently present entities.
- **Instant Action** — Get started by simply pressing one button.
  
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
4. **World Progression Skeleton & Settings:** Optionally, create a "world skeleton" for the World Progression component to inject broader macroscopic content into the context/world in the world reports. Optionally set up the randomizers from the WP settings to determine how much skeleton and organic (Lorebook Agent) content is used in world updates.

## Suggested Companions

- 🧠 **[Summaryception](https://github.com/Lodactio/Extension-Summaryception):** A brilliant summarizer/context compression extension. Also handy for crunching all the combat mechanics of the context into summarized history.

## Don't Care About D&D?

You can scrap the entire system prompt and all the default fields and track your own things completely. The D&D setup is just a plug & play system that works by default. 

## What Model to Use?
Your primary narrator model must support **Tool Calling** for the Hybrid RNG system to work properly, though this is only relevant if you're using tool calls. The extension also works without them (selectable in the settings.)

**MiMo 2.5 Pro** or **DeepSeek 4 Pro**: both are great bang for the buck with high GM output quality. I use MiMo myself through OpenRouter — DeepSeek 4 Pro is another strong pick in the same tier. Try both and see which voice you prefer.

For the State Tracker and Lorebook Agent, I use **Gemini 3.1 Flash-Lite**. It's very inexpensive and handles the job amazingly well. Gemini 3 Flash or 3.5 Flash are of course even better, but I don't think they're needed. Flash-Lite does the job.

If your model thinks too long in combat, enable **Combat API Override** in State Tracker settings — it auto-switches when the `[COMBAT]` tag is active in the tracker and switches back when combat ends. **Gemini 3.5 Flash** is a great choice for this; set thinking to **Medium** so it still thinks a little.

These are recommendations, not rules — experiment. Different models shine for different styles of play.

---

<table border="0">
  <tr>
    <td align="center" valign="bottom">
      <img src="https://github.com/user-attachments/assets/829b233c-19f0-407b-99a8-f58e80573a0a" width="100%" alt="Lorebook Agent" />
      <br>
      <strong>Lorebook Agent</strong>
    </td>
    <td align="center" valign="bottom">
      <img src="https://github.com/user-attachments/assets/de2f7522-e3ff-4153-8a3f-d38ca49ceca7" width="100%" alt="Lorebook Agent" />
      <br>
      <strong>Relationship system within Lorebook Agent</strong>
    </td>
  </tr>
</table>

---

<div align="center">
  <figure>
    <img width="1918" height="982" alt="Screenshot 2026-06-18 195917" src="https://github.com/user-attachments/assets/a9778adb-8bdf-485e-ac96-973613321407" />
  </figure>
</div>

---

## Got a Question or Ideas?
You can find me in the SillyTavern Discord extensions forum. Join the Discord and then head to the sub-forum there: https://discord.gg/sillytavern
