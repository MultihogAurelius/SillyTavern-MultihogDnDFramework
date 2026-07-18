/**
 * quests.js — Multihog D&D Framework
 * Quest management and deadline tracking.
 */

import { getSettings } from './state-manager.js';
import { parseQuestsFromMemo, writeQuestsToMemo, parseInWorldTime, isArchivedQuestStatus, questHasEffectiveDeadline, isEmergentQuest } from './memo-processor.js';

/**
 * Unregisters the deprecated LogQuest tool if it was left registered from a prior version.
 */
export function unregisterLogQuestTool() {
    try {
        SillyTavern.getContext().unregisterFunctionTool?.('LogQuest');
    } catch (error) {
        console.warn('[RPG Tracker] Failed to unregister LogQuest tool', error);
    }
}

// ── Time & Math ──────────────────────────────────────────────────────────────

// parseInWorldTime moved to memo-processor.js

/**
 * Computes NPC mood from -1.0 (very pleased) to 1.0+ (very frustrated).
 * Formula: (elapsed/window)^(1/coeff) * 2 - 1
 *
 * At t=0 (quest accepted): always -1  (NPC is pleased you took it)
 * At t=deadline: always 0 (Neutral)
 * Beyond deadline: >0, unbounded (NPC grows increasingly angry)
 *
 * Low coeff (0.4, patient): stays pleased longer, gets mad slowly after deadline.
 * High coeff (3.0, volatile): becomes neutral faster, gets mad quickly after deadline.
 *
 * @param {object} quest
 * @param {string} currentTime
 * @returns {number} Mood value from -1 (pleased) upward (unbounded)
 */
export function computeFrustration(quest, currentTime) {
    if (isEmergentQuest(quest)) return null;
    if (quest.status !== 'active' && quest.status !== 'past deadline') return null;
    if (!questHasEffectiveDeadline(quest)) return null;

    const accepted = parseInWorldTime(quest.accepted_time);
    const current  = parseInWorldTime(currentTime);
    if (!accepted || !current) return null;

    const elapsed = current - accepted;
    if (elapsed <= 0) return -1; // Just accepted — NPC is optimistic

    const coeff = Math.max(0.1, quest.frustration_coefficient ?? 1.0);
    const deadline = parseInWorldTime(quest.deadline_time);
    const window   = deadline - accepted;
    if (window <= 0) return null;

    const ratio = elapsed / window;
    
    if (ratio <= 1.0) {
        // Before or at deadline: -1 (Very Pleased) to 0 (Neutral)
        return Math.pow(ratio, 1 / coeff) - 1;
    } else {
        // After deadline: 0 (Neutral) scaling upwards
        return (ratio - 1) * coeff;
    }
}


// ── State Management ─────────────────────────────────────────────────────────

/**
 * Iterates active quests, auto-failing any that have passed their deadline.
 * Call this BEFORE the state model runs.
 */
export function checkQuestDeadlines() {
    const settings = getSettings();
    const quests = parseQuestsFromMemo(settings.currentMemo);
    if (!quests.length) return;
    
    let changed = false;
    const currentTimeMinutes = parseInWorldTime(settings.currentMemo?.match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i)?.[1]?.trim());
    
    for (const quest of quests) {
        if (quest.status === 'active' && questHasEffectiveDeadline(quest)) {
            const deadlineMinutes = parseInWorldTime(quest.deadline_time);
            if (currentTimeMinutes >= deadlineMinutes && deadlineMinutes > 0) {
                if (quest.auto_fail) {
                    quest.status = 'failed';
                    changed = true;
                    if (settings.debugMode) {
                        console.log(`[RPG Tracker] Quest "${quest.title}" auto-failed (deadline reached).`);
                    }
                }
            }
        }
    }
    
    if (changed) {
        const settings = getSettings();
        for (const quest of quests) {
            if (!isArchivedQuestStatus(quest.status)) continue;
            const list = settings.quests || [];
            const idx = list.findIndex(q => q.id === quest.id);
            if (idx >= 0) list[idx] = quest;
            else list.push(quest);
            settings.quests = list;
        }
        writeQuestsToMemo(settings.quests);
        SillyTavern.getContext().saveSettingsDebounced();
    }
}

/**
 * Generates the plain-text block injected into the narrative model context.
 * Only includes active (and past-deadline) quests.
 */
export function renderQuestsAsPlainText(quests, currentTime) {
    if (!quests || !quests.length) return "";
    
    const settings = getSettings();
    const showDeadlines   = !!settings.syspromptModules?.questsDeadlines;
    const showFrustration = !!settings.syspromptModules?.questsFrustration;

    const relevantQuests = quests.filter(q => q.status === 'active' || q.status === 'past deadline');
    if (relevantQuests.length === 0) return "";
    
    let text = "### ACTIVE QUESTS\n";
    for (const q of relevantQuests) {
        text += `- **${q.title}** (Given by ${q.giver_name} at ${q.giver_location})\n`;

        // Deadline always; NPC mood / frustration only for quests someone expects completed
        if (questHasEffectiveDeadline(q)) {
            let moodInfo = '';
            if (!isEmergentQuest(q)) {
                const frust = computeFrustration(q, currentTime);
                let moodLabel;
                if (frust != null && showFrustration) {
                    if (frust <= -0.5)      moodLabel = 'Very Pleased — NPC is optimistic you will make it';
                    else if (frust <= -0.1) moodLabel = 'Pleased — on schedule';
                    else if (frust <=  0.1) moodLabel = 'Neutral — at deadline';
                    else if (frust <=  0.5) moodLabel = 'Mildly Frustrated — deadline missed';
                    else if (frust <=  1.0) moodLabel = 'Frustrated — deadline missed';
                    else if (frust <=  1.5) moodLabel = 'Very Frustrated — deadline passed long ago';
                    else                    moodLabel = 'Furious — NPC may withdraw the quest entirely';
                } else if (frust != null && showDeadlines) {
                    if (frust <= 0)        moodLabel = 'Ahead of Schedule';
                    else if (frust <= 0.5) moodLabel = 'On Time';
                    else if (frust <= 1.0) moodLabel = 'Near Deadline';
                    else                   moodLabel = 'Overdue';
                }
                if (moodLabel) moodInfo = ` — ${moodLabel}`;
            }
            text += `  Deadline: ${q.deadline_time}${moodInfo}\n`;
        }

        for (const obj of q.objectives) {
            if (obj.status === 'completed') continue;
            const progress = (typeof obj.progress === 'number' && typeof obj.total === 'number')
                ? ` [${obj.progress}/${obj.total}]` : '';
            const optional = obj.required ? '' : ' (Optional)';
            const done = obj.status === 'completed';
            text += `  - [${done ? 'x' : ' '}] ${obj.text}${progress}${optional}\n`;
        }

        if (q.rewards && q.rewards.length) {
            text += `  Rewards: ${q.rewards.join(', ')}\n`;
        }
    }
    return text + "\n";
}


// ── Debug / Test Tool ────────────────────────────────────────────────────────

/**
 * Exposes a global debugging tool in the console.
 * Usage in console: rpgTracker.debugQuests()
 */
export function installQuestDebugTools() {
    globalThis.rpgTracker = globalThis.rpgTracker || {};
    globalThis.rpgTracker.debugQuests = () => {
        console.log("=== Quest System Debug ===");
        const s = getSettings();
        console.log("Active Quests in Settings:", s.quests);
        
        console.log("--- Testing Time Parser ---");
        const t1 = "08:00 AM, Day 1";
        const t2 = "12:00 PM, Day 1";
        const t3 = "06:30 PM, Day 3";
        console.log(`"${t1}" -> ${parseInWorldTime(t1)} mins`);
        console.log(`"${t2}" -> ${parseInWorldTime(t2)} mins`);
        console.log(`"${t3}" -> ${parseInWorldTime(t3)} mins`);

        console.log("--- Testing Frustration Math (Pre-Deadline: Halfway) ---");
        const dummyQuest = {
            status: 'active',
            accepted_time: "08:00 AM, Day 1",
            deadline_time: "08:00 AM, Day 3", // 2 days = 2880 mins window
            frustration_coefficient: 1.0
        };
        const halfwayTime = "08:00 AM, Day 2";
        
        dummyQuest.frustration_coefficient = 0.4;
        console.log(`Coeff 0.4 (Patient), Halfway -> ${computeFrustration(dummyQuest, halfwayTime).toFixed(3)} (expected -0.823)`);
        
        dummyQuest.frustration_coefficient = 1.0;
        console.log(`Coeff 1.0 (Neutral), Halfway -> ${computeFrustration(dummyQuest, halfwayTime).toFixed(3)} (expected -0.500)`);
        
        dummyQuest.frustration_coefficient = 3.0;
        console.log(`Coeff 3.0 (Volatile), Halfway -> ${computeFrustration(dummyQuest, halfwayTime).toFixed(3)} (expected -0.206)`);

        console.log("--- Testing Frustration Math (At Deadline) ---");
        const atDeadline = "08:00 AM, Day 3";
        dummyQuest.frustration_coefficient = 1.0;
        console.log(`Coeff 1.0, At Deadline -> ${computeFrustration(dummyQuest, atDeadline).toFixed(3)} (expected 0.000)`);

        console.log("--- Testing Frustration Math (Post-Deadline: 50% Overtime) ---");
        const overtimeTime = "08:00 AM, Day 4"; // ratio = 1.5
        dummyQuest.frustration_coefficient = 0.4;
        console.log(`Coeff 0.4 (Patient), 50% Over -> ${computeFrustration(dummyQuest, overtimeTime).toFixed(3)} (expected 0.200)`);

        dummyQuest.frustration_coefficient = 1.0;
        console.log(`Coeff 1.0 (Neutral), 50% Over -> ${computeFrustration(dummyQuest, overtimeTime).toFixed(3)} (expected 0.500)`);

        dummyQuest.frustration_coefficient = 3.0;
        console.log(`Coeff 3.0 (Volatile), 50% Over -> ${computeFrustration(dummyQuest, overtimeTime).toFixed(3)} (expected 1.500)`);
        
        console.log("==========================");
    };
}
