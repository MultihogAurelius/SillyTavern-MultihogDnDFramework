/**
 * memo-processor.js — Multihog D&D Framework
 * Pure text/logic utilities for memo management and state model context assembly.
 * Handles [TAG]...[/TAG] block merging, deduplication, delta computation,
 * lorebook assembly, and quest text serialization.
 * No DOM access. No module-level side effects.
 *
 * Imports: state-manager.js, constants.js
 * Imported by: index.js, renderer.js, quests.js
 */

import { getSettings } from './state-manager.js';
import { DEFAULT_STOCK_PROMPTS, resolveTimePromptKey } from './constants.js';

// ── String utilities ──────────────────────────────────────────────────────────

/**
 * Computes NPC mood from -1.0 (very pleased) to 1.0+ (very frustrated).
 * Duplicated here from quests.js to avoid a circular import.
 * @param {object} quest
 * @param {string} currentTime
 * @returns {number}
 */
function computeFrustrationLocal(quest, currentTime) {
    if (quest.status !== 'active' && quest.status !== 'past deadline') return 0;
    const accepted = parseInWorldTime(quest.accepted_time);
    const current  = parseInWorldTime(currentTime);
    if (!accepted || !current) return 0;

    const elapsed = current - accepted;
    if (elapsed <= 0) return -1; // Just accepted — NPC is optimistic

    const coeff = Math.max(0.1, quest.frustration_coefficient ?? 1.0);

    if (!quest.deadline_time || String(quest.deadline_time).toLowerCase() === 'none') {
        // No deadline: NPC remains neutral regardless of time elapsed
        return 0;
    }

    const deadline = parseInWorldTime(quest.deadline_time);
    const window   = deadline - accepted;
    if (window <= 0) return 1;

    const ratio = elapsed / window;
    
    if (ratio <= 1.0) {
        // Before or at deadline: -1 (Very Pleased) to 0 (Neutral)
        return Math.pow(ratio, 1 / coeff) - 1;
    } else {
        // After deadline: 0 (Neutral) scaling upwards
        return (ratio - 1) * coeff;
    }
}

/**
 * Returns the human-readable mood label and color for a quest.
 * @param {object} quest
 * @param {string} currentTime
 * @param {boolean} showFrustration
 * @returns {{ label: string, color: string, value: number }}
 */
export function getQuestMood(quest, currentTime, showFrustration) {
    const frust = computeFrustrationLocal(quest, currentTime);
    let color = '#00cc77';
    let label = 'Pleased';
    if (showFrustration) {
        if (frust <= -0.5)      { color = '#00cc77'; label = 'Very Pleased'; }
        else if (frust <= -0.1) { color = '#44dd88'; label = 'Pleased'; }
        else if (frust <=  0.1) { color = '#aaaaaa'; label = 'Neutral'; }
        else if (frust <=  0.5) { color = '#ffcc00'; label = 'Mildly Frustrated'; }
        else if (frust <=  1.0) { color = '#ff8800'; label = 'Frustrated'; }
        else if (frust <=  1.5) { color = '#ff4400'; label = 'Very Frustrated'; }
        else                    { color = '#ff1111'; label = 'Furious'; }
    } else {
        if (frust <= 0)         { color = '#00cc77'; label = 'Ahead of Schedule'; }
        else if (frust <= 0.5)  { color = '#ffcc00'; label = 'On Time'; }
        else if (frust <= 1.0)  { color = '#ff8800'; label = 'Near Deadline'; }
        else                    { color = '#ff1111'; label = 'Overdue'; }
    }
    return { label, color, value: frust };
}

export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Strips bare timestamp-only lines and a leading timestamp immediately before [CORE].
 * Used when saving or displaying lorebook record content.
 * @param {string} content
 * @returns {string}
 */
export function sanitizeLorebookRecordContent(content) {
    if (!content) return '';
    let s = content.trim();
    s = s.replace(/^\s*\[[^\]]+\]\s*(?=\[CORE\])/i, '');
    s = s.split('\n')
        .filter(line => {
            const trimmed = line.trim();
            if (/^\[\/?core\]$/i.test(trimmed)) return true;
            return !/^\[[^\]]+\]\s*$/.test(trimmed);
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return s;
}

/** Wraps parenthetical groups in a highlight span. */
export function highlightParens(text) {
    return text.replace(/\(([^)]+)\)/g, '<span class="rt-paren-highlight">($1)</span>');
}

/** Wraps signed numbers or standalone digits in a highlight span, ignoring HTML tags. */
export function highlightNumbers(text) {
    return text.replace(/(<[^>]+>)|([+-]\d+|\b\d+\b)/g, (match, tag, num) => {
        return tag ? tag : `<span class="rt-paren-highlight">${num}</span>`;
    });
}


/**
 * Extracts the current time string from a [TIME] block content.
 * Ignores any 'Last Rest:' lines and strips optional 'Current Time:' prefixes.
 * @param {string} timeBlockContent
 * @returns {string}
 */
export function extractCurrentTimeStr(timeBlockContent) {
    if (!timeBlockContent) return '';
    const lines = timeBlockContent.split('\n').map(l => l.trim()).filter(Boolean);
    const timeLine = lines.find(line => !line.toLowerCase().startsWith('last rest:'));
    if (!timeLine) return '';
    return timeLine.replace(/^(?:current\s+)?time:\s*/i, '').trim();
}

/**
 * Converts in-world time strings to a comparable numeric value (minutes since Day 1/epoch date, 00:00).
 * Expected formats: "08:00 AM, Day 1", "08:00 AM, 01/01/2026", "Day 4", "10:00 PM"
 * @param {string} str 
 * @returns {number}
 */
export function parseInWorldTime(str) {
    if (!str) return 0;
    if (str.includes('\n')) {
        str = extractCurrentTimeStr(str);
    }
    const ddmmyyMatch = str.match(/\b(\d{1,2})\/(\d{1,2})\/(\d+)\b/);
    const dayMatch = str.match(/(?:Day|D)\s*(\d+)/i);
    const timeMatch = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    
    let d = 1;
    if (ddmmyyMatch) {
        const dd = parseInt(ddmmyyMatch[1], 10);
        const mm = parseInt(ddmmyyMatch[2], 10);
        let yy = parseInt(ddmmyyMatch[3], 10);
        if (yy < 100) yy += 2000;

        // Fixed ancient epoch: 0001-01-01 — independent of any user config.
        // All reasonable calendar years (500–9999 AD) map to large positive numbers.
        const dateObj = new Date(0, 0, 1);
        dateObj.setFullYear(yy, mm - 1, dd);
        const epochObj = new Date(0, 0, 1);
        epochObj.setFullYear(1, 0, 1);
        const diffDays = Math.round((dateObj - epochObj) / (1000 * 60 * 60 * 24));
        d = diffDays + 1;
    } else if (dayMatch) {
        d = parseInt(dayMatch[1], 10);
    }
    
    let h = 0, m = 0;
    if (timeMatch) {
        h = parseInt(timeMatch[1], 10);
        m = parseInt(timeMatch[2], 10);
        if (timeMatch[3]) {
            const mer = timeMatch[3].toUpperCase();
            if (mer === 'AM' && h === 12) h = 0;
            if (mer === 'PM' && h !== 12) h += 12;
        }
    }
    
    if (!ddmmyyMatch && !dayMatch && !timeMatch) return 0;
    return (d - 1) * 1440 + h * 60 + m;
}

/**
 * Formats in-world minutes since epoch into a readable string using active settings (12h/24h, Day/Date).
 * @param {number} totalMins
 * @returns {string}
 */
export function formatInWorldTime(totalMins) {
    if (totalMins < 0) return 'Never';
    const settings = getSettings();
    const use24h = !!settings.use24hTime;
    const useDdMmYy = !!settings.useDdMmYyFormat;

    const dayIndex = Math.floor(totalMins / 1440) + 1;
    const remMinutes = totalMins % 1440;
    const h24 = Math.floor(remMinutes / 60);
    const m = remMinutes % 60;

    let dateStr = '';
    if (useDdMmYy) {
        // Fixed ancient epoch: 0001-01-01 — same reference as parseInWorldTime.
        const date = new Date(0, 0, 1);
        date.setFullYear(1, 0, 1 + (dayIndex - 1));
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        let yyyy = String(date.getFullYear());
        if (yyyy.length < 4) yyyy = yyyy.padStart(4, '0');
        dateStr = `${dd}/${mm}/${yyyy}`;
    } else {
        dateStr = `Day ${dayIndex}`;
    }

    let timeStr = '';
    if (use24h) {
        timeStr = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } else {
        const suffix = h24 >= 12 ? 'PM' : 'AM';
        let h12 = h24 % 12;
        if (h12 === 0) h12 = 12;
        timeStr = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
    }

    return `${dateStr}, ${timeStr}`;
}


/**
 * Formats a minute difference into a human-readable "X days Y hours Z minutes" string.
 * @param {number} diffMinutes 
 * @param {boolean} isFuture - If true, returns "X left", else "X ago"
 * @returns {string}
 */
export function formatTimeDiff(diffMinutes, isFuture = false) {
    if (diffMinutes === 0) return isFuture ? "due now" : "just now";
    const absDiff = Math.abs(diffMinutes);
    const dDays = Math.floor(absDiff / 1440);
    const dH = Math.floor((absDiff % 1440) / 60);
    const dM = absDiff % 60;
    
    let parts = [];
    if (dDays > 0) parts.push(`${dDays} day${dDays > 1 ? 's' : ''}`);
    if (dH > 0) parts.push(`${dH} hour${dH > 1 ? 's' : ''}`);
    if (dM > 0) parts.push(`${dM} minute${dM > 1 ? 's' : ''}`);
    
    if (parts.length === 0) return isFuture ? "due now" : "just now";
    
    const timeStr = parts.join(' ');
    return isFuture ? `${timeStr} left` : `${timeStr} ago`;
}

// ── Memo deduplication ────────────────────────────────────────────────────────

/**
 * Sanitizes a memo string to ensure no duplicate [TAG] sections exist.
 * If duplicates are found, the last one in the string is preserved.
 */
export function deduplicateMemo(memo) {
    if (!memo) return "";
    const settings = getSettings();

    const tagRegex = /\[([A-Z_]+)\]/gi;
    const tags = new Set();
    let match;
    while ((match = tagRegex.exec(memo)) !== null) {
        tags.add(match[1].toUpperCase());
    }

    let cleanedMemo = memo;
    for (const tag of tags) {
        const escapedTag = escapeRegex(tag);
        const pattern = new RegExp(`\\[${escapedTag}\\][\\s\\S]*?\\[\\/${escapedTag}\\]`, 'gi');
        const blocks = [...memo.matchAll(pattern)];

        if (blocks.length > 1) {
            if (settings.debugMode) console.warn(`[RPG Tracker] Deduplication: Found ${blocks.length} instances of [${tag}]. Keeping the last one.`);
            cleanedMemo = cleanedMemo.replace(pattern, "---DEDUP_MARKER---");
            const lastBlock = blocks[blocks.length - 1][0];
            const split = cleanedMemo.split("---DEDUP_MARKER---");
            cleanedMemo = split.join("").trim() + "\n\n" + lastBlock;
        }
    }

    return cleanedMemo.replace(/\n{3,}/g, '\n\n').trim();
}

// ── Memo merge ────────────────────────────────────────────────────────────────

/**
 * Merge partial AI output into the existing memo.
 * Finds all [TAG]...[/TAG] blocks in the AI output and replaces the
 * matching section in the current memo. New sections are appended.
 * If the AI output contains no bracket tags at all, the current memo is preserved.
 */
export function mergeMemo(currentMemo, aiOutput) {
    const settings = getSettings();
    const benchCommands = benchCommandsEnabled()
        ? extractBenchCommands(aiOutput)
        : { benches: [], unbenches: [] };

    const tagPattern = /\[([^\]\/][^\]]*)\]([\s\S]*?)\[\/\1\]/gi;
    const matches = [...aiOutput.matchAll(tagPattern)];

    const hasBenchWork = benchCommands.benches.length > 0 || benchCommands.unbenches.length > 0;

    if (matches.length === 0) {
        if (hasBenchWork) {
            if (settings.debugMode) {
                console.log('[RPG Tracker] mergeMemo: no closed [TAG] blocks but [BENCH]/[UNBENCH] found — applying bench splice');
            }
            return hydratePartyRelocationStats(
                currentMemo,
                applyBenchCommands(currentMemo, currentMemo, benchCommands),
            );
        }
        console.warn("[RPG Tracker] No valid [TAG]...[/TAG] blocks found in model output — treating as no-change. Output was:", aiOutput);
        return currentMemo;
    }

    if (settings.debugMode) console.log(`[RPG Tracker] mergeMemo: found ${matches.length} tag(s):`, matches.map(m => m[1]));

    let memo = currentMemo;

    for (const match of matches) {
        const tag = match[1].trim();
        const newContent = match[2].trim();

        if (tag.toUpperCase() === 'BENCHED PARTY' && isBenchCommandOnlyContent(newContent)) {
            if (settings.debugMode) {
                console.log(`[RPG Tracker] mergeMemo: [${tag}] command-only — deferring to applyBenchCommands`);
            }
            continue;
        }

        const isRemoval = /^(?:REMOVED|EXPIRED|CLEARED|NONE|END_COMBAT)$/i.test(newContent);

        const escapedTag = escapeRegex(tag);
        const existingPattern = new RegExp(
            `\\s*\\[${escapedTag}\\][\\s\\S]*?\\[\\/${escapedTag}\\]`,
            'i'
        );

        if (settings.debugMode) {
            console.log(`[RPG Tracker] mergeMemo: processing [${tag}], pattern: ${existingPattern}`);
        }

        if (isRemoval) {
            memo = memo.replace(existingPattern, "").trim();
            if (settings.debugMode) console.log(`[RPG Tracker] mergeMemo: [${tag}] REMOVED`);
        } else {
            const fullBlock = `[${tag}]\n${newContent}\n[/${tag}]`;
            const before = memo;
            memo = memo.replace(existingPattern, () => '\n\n' + fullBlock);
            if (memo !== before) {
                if (settings.debugMode) console.log(`[RPG Tracker] mergeMemo: [${tag}] REPLACED`);
            } else {
                memo = memo.trimEnd() + '\n\n' + fullBlock;
                if (settings.debugMode) console.log(`[RPG Tracker] mergeMemo: [${tag}] APPENDED (new section)`);
            }
        }
    }

    const cleaned = memo.replace(/\n{3,}/g, '\n\n').trim();
    const deduped = deduplicateMemo(cleaned);
    let result = deduped;
    if (benchCommands.benches.length || benchCommands.unbenches.length) {
        result = applyBenchCommands(currentMemo, result, benchCommands);
    }
    return hydratePartyRelocationStats(currentMemo, result);
}

/**
 * Writes a quest array into a [QUESTS] block.
 * If memoText is provided, returns the updated string.
 * Otherwise, updates settings.currentMemo directly.
 * @param {any[]} quests
 * @param {string} [memoText]
 * @returns {string|void}
 */
export function writeQuestsToMemo(quests, memoText = null) {
    const settings = getSettings();
    let target = (memoText !== null) ? memoText : settings.currentMemo;

    const tag = 'QUESTS';
    const escapedTag = escapeRegex(tag);
    const pattern = new RegExp(`\\s*\\[${escapedTag}\\][\\s\\S]*?\\[\\/${escapedTag}\\]`, 'i');
    const blockExists = pattern.test(target);

    // Filter out archived quests to save AI context space
    const activeQuests = quests.filter(q => !isArchivedQuestStatus(q.status));

    // If no active quests, remove the block if present — never insert an empty one
    if (!activeQuests || !activeQuests.length) {
        const result = blockExists ? target.replace(pattern, '').trim() : target;
        if (memoText !== null) return result;
        settings.currentMemo = result;
        return;
    }

    const content = serializeQuestsToText(activeQuests);

    const block = `\n\n[${tag}]\n${content}\n[/${tag}]`;

    let result;
    if (blockExists) {
        result = target.replace(pattern, block);
    } else {
        result = (target + block).trim();
    }

    if (memoText !== null) return result;
    settings.currentMemo = result;
}

/**
 * @deprecated Use writeQuestsToMemo(quests) instead. Kept for backward compat.
 */
export function syncQuestsToMemo() {
    const settings = getSettings();
    writeQuestsToMemo(settings.quests || []);
}

/**
 * Whether a quest status is archived (removed from memo, shown in completed/failed UI).
 * @param {string} [status]
 */
export function isArchivedQuestStatus(status) {
    const s = String(status || '').toLowerCase().trim();
    return s === 'completed' || s === 'failed' || s === 'past deadline';
}

/**
 * Split plain-text [QUESTS] inner content into per-quest blocks (QUEST: … boundaries).
 * @param {string} content
 * @returns {string[]|null} null if not plain-text quest format
 */
function splitQuestTextBlocks(content) {
    if (!content || !/^QUEST:/m.test(content)) return null;
    return content.split(/^(?=QUEST:\s)/m).filter(b => b.trim());
}

/** @param {string} block */
function questTextBlockIsArchived(block) {
    const m = block.match(/^\s*STATUS:\s*(.+)$/im);
    if (!m) return false;
    return isArchivedQuestStatus(m[1].trim());
}

/**
 * Strips archived quests (completed/failed/past deadline) from the [QUESTS] block.
 * Uses QUEST: line boundaries so only individual quest blocks are removed.
 * @param {string} memoText
 * @returns {string}
 */
export function stripArchivedQuestsFromMemo(memoText) {
    if (!memoText) return memoText;
    const questBlockRe = /\[QUESTS\]([\s\S]*?)\[\/QUESTS\]/i;
    const match = memoText.match(questBlockRe);
    if (!match) return memoText;

    const content = match[1].trim();
    const blocks = splitQuestTextBlocks(content);

    if (blocks) {
        const active = blocks.filter(b => !questTextBlockIsArchived(b));
        if (active.length === blocks.length) return memoText;
        const newContent = active.map(b => b.trim()).join('\n\n').trim();
        if (!newContent) {
            return memoText.replace(questBlockRe, '').replace(/\n{3,}/g, '\n\n').trim();
        }
        return memoText.replace(questBlockRe, `[QUESTS]\n${newContent}\n[/QUESTS]`);
    }

    // JSON / tool-call format fallback
    try {
        const parsed = JSON.parse(content);
        const quests = Array.isArray(parsed) ? parsed : (parsed.quests || []);
        const active = quests.filter(q => !isArchivedQuestStatus(q.status));
        if (active.length === quests.length) return memoText;
        if (!active.length) return memoText.replace(questBlockRe, '').replace(/\n{3,}/g, '\n\n').trim();
        return memoText.replace(questBlockRe, `[QUESTS]\n${JSON.stringify(active, null, 2)}\n[/QUESTS]`);
    } catch {
        return memoText;
    }
}

/** @deprecated Use stripArchivedQuestsFromMemo */
export const stripCompletedQuestsFromMemo = stripArchivedQuestsFromMemo;

// ── Benched Party: [BENCH]/[UNBENCH] commands + context compaction ────────────
//
// Tracker emits lean commands; code splices full stat sheets between [PARTY] and
// [BENCHED PARTY]. Full stat sheets live in the persisted memo; LLM context only
// needs name + benching reason while a member stays benched.

const BENCH_CMD_RX = /^\[BENCH\]\s*(.+?)(?:\s*[—–-]\s*(.+))?$/i;
const UNBENCH_CMD_RX = /^\[UNBENCH\]\s*(.+)$/i;

function benchCommandsEnabled() {
    const settings = getSettings();
    return settings.modules?.['benched party'] !== false && settings.modules?.party !== false;
}

/** @returns {{ benches: {name: string, reason: string}[], unbenches: string[] }} */
export function extractBenchCommands(aiOutput) {
    const benches = [];
    const unbenches = [];
    for (const line of (aiOutput || '').split('\n')) {
        const trimmed = line.trim();
        const bench = trimmed.match(BENCH_CMD_RX);
        if (bench) {
            benches.push({ name: bench[1].trim(), reason: (bench[2] || '').trim() });
            continue;
        }
        const unbench = trimmed.match(UNBENCH_CMD_RX);
        if (unbench) unbenches.push(unbench[1].trim());
    }
    return { benches, unbenches };
}

function isBenchCommandOnlyContent(content) {
    if (!content || /^(?:REMOVED|EXPIRED|CLEARED|NONE)$/i.test(content.trim())) return false;
    const lines = content.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return false;
    return lines.every(l => /^\[(?:BENCH|UNBENCH)\]/i.test(l));
}

function resolveMemberEntry(entries, queryName) {
    const q = (queryName || '').trim().toLowerCase();
    if (!q) return null;
    for (const entry of entries) {
        if (memberNameKey(entry.name) === q) return entry;
    }
    for (const entry of entries) {
        const nk = memberNameKey(entry.name);
        if (nk.startsWith(q + ' ') || nk.startsWith(q + '(')) return entry;
        if (entry.name.toLowerCase().startsWith(q)) return entry;
    }
    return null;
}

function rebuildPartyBlockContent(entries) {
    return entries.map(entry => {
        const lines = [...entry.lines];
        if (lines.length && !/^-/.test(lines[0])) lines[0] = `- ${lines[0]}`;
        return lines.join('\n');
    }).join('\n');
}

function removeMemberFromBlock(blockContent, queryName) {
    const entries = splitPartyMemberEntries(blockContent);
    const removed = resolveMemberEntry(entries, queryName);
    if (!removed) return { blockContent, removed: null, empty: false };
    const remaining = entries.filter(e => e !== removed);
    return {
        blockContent: rebuildPartyBlockContent(remaining),
        removed,
        empty: !remaining.length,
    };
}

function setEntryStatus(entry, statusText) {
    const lines = [...entry.lines];
    const idx = lines.findIndex(l => /^status:/i.test(l));
    const newLine = `Status: ${statusText}`;
    if (idx >= 0) lines[idx] = newLine;
    else lines.push(newLine);
    return { name: entry.name, lines };
}

function clearBenchedStatus(entry) {
    const lines = [...entry.lines];
    const idx = lines.findIndex(l => /^status:/i.test(l));
    if (idx >= 0 && /benched\s*\(/i.test(lines[idx])) {
        lines[idx] = 'Status: Healthy';
    }
    return { name: entry.name, lines };
}

function getBenchTimestamp(memo) {
    const timeBlock = parseMemoBlockContent(memo, 'TIME');
    return extractCurrentTimeStr(timeBlock) || '';
}

function blockContentFromMemo(memo, tag) {
    return parseMemoBlockContent(memo, tag) ?? '';
}

function findMemberEntry(blockContent, queryName) {
    if (!blockContent) return null;
    return resolveMemberEntry(splitPartyMemberEntries(blockContent), queryName);
}

function benchedMemberKeys(memo) {
    const content = blockContentFromMemo(memo, 'BENCHED PARTY');
    if (!content || /^(?:REMOVED|EXPIRED|CLEARED|NONE)$/i.test(content.trim())) return new Set();
    return new Set(splitPartyMemberEntries(content).map(e => memberNameKey(e.name)));
}

/** Ensures no member appears in both [PARTY] and [BENCHED PARTY] — benched wins. */
function dedupePartyAgainstBenched(memo) {
    const benchedKeys = benchedMemberKeys(memo);
    if (!benchedKeys.size) return memo;

    const partyContent = blockContentFromMemo(memo, 'PARTY');
    if (!partyContent) return memo;

    const entries = splitPartyMemberEntries(partyContent).filter(
        e => !benchedKeys.has(memberNameKey(e.name)),
    );
    if (!entries.length) return stripMemoBlock(memo, 'PARTY');
    return replaceMemoBlock(memo, 'PARTY', rebuildPartyBlockContent(entries));
}

/**
 * Applies [BENCH]/[UNBENCH] commands by splicing full stat entries between blocks.
 * @param {string} priorMemo
 * @param {string} memo
 * @param {{ benches: {name: string, reason: string}[], unbenches: string[] }} commands
 * @returns {string}
 */
export function applyBenchCommands(priorMemo, memo, commands) {
    if (!commands?.benches?.length && !commands?.unbenches?.length) return memo || '';

    let result = memo || '';
    const timeStr = getBenchTimestamp(result) || getBenchTimestamp(priorMemo);

    for (const { name, reason } of commands.benches) {
        const resultParty = blockContentFromMemo(result, 'PARTY');
        const priorParty = blockContentFromMemo(priorMemo, 'PARTY');
        let removed = null;

        if (findMemberEntry(resultParty, name)) {
            const { blockContent: newParty, removed: r, empty } = removeMemberFromBlock(resultParty, name);
            removed = r;
            if (empty) result = stripMemoBlock(result, 'PARTY');
            else if (r) result = replaceMemoBlock(result, 'PARTY', newParty);
        } else if (priorParty) {
            // Tracker may have already dropped them from a simultaneous [PARTY] output — pull stats from prior memo.
            ({ removed } = removeMemberFromBlock(priorParty, name));
        }

        if (!removed) continue;

        const statusText = reason
            ? `Benched (${timeStr || 'unknown time'}, ${reason})`
            : `Benched (${timeStr || 'unknown time'})`;
        const benchedEntry = setEntryStatus(removed, statusText);

        let benchedContent = blockContentFromMemo(result, 'BENCHED PARTY') || blockContentFromMemo(priorMemo, 'BENCHED PARTY');
        const benchedEntries = splitPartyMemberEntries(benchedContent).filter(
            e => memberNameKey(e.name) !== memberNameKey(benchedEntry.name),
        );
        benchedEntries.push(benchedEntry);
        result = replaceMemoBlock(result, 'BENCHED PARTY', rebuildPartyBlockContent(benchedEntries));
    }

    for (const name of commands.unbenches) {
        const resultBenched = blockContentFromMemo(result, 'BENCHED PARTY');
        const priorBenched = blockContentFromMemo(priorMemo, 'BENCHED PARTY');
        let removed = null;
        let newBenched = resultBenched;

        if (findMemberEntry(resultBenched, name)) {
            const attempt = removeMemberFromBlock(resultBenched, name);
            removed = attempt.removed;
            newBenched = attempt.blockContent;
        } else if (priorBenched) {
            ({ removed, blockContent: newBenched } = removeMemberFromBlock(priorBenched, name));
        }

        if (!removed) continue;

        if (!newBenched || !splitPartyMemberEntries(newBenched).length) result = stripMemoBlock(result, 'BENCHED PARTY');
        else result = replaceMemoBlock(result, 'BENCHED PARTY', newBenched);

        const partyEntry = clearBenchedStatus(removed);
        const resultParty = blockContentFromMemo(result, 'PARTY');

        if (findMemberEntry(resultParty, name)) {
            // Tracker may have already re-added them to [PARTY] — leave roster as-is, hydrate fixes stats.
            continue;
        }

        // Never fall back to priorMemo [PARTY] — a same-turn [BENCH] may have removed members
        // or stripped the block entirely; prior roster would resurrect them as duplicates.
        const partyEntries = splitPartyMemberEntries(resultParty).filter(
            e => memberNameKey(e.name) !== memberNameKey(partyEntry.name),
        );
        partyEntries.push(partyEntry);
        result = replaceMemoBlock(result, 'PARTY', rebuildPartyBlockContent(partyEntries));
    }

    return dedupePartyAgainstBenched(result);
}

function parseMemoBlockContent(memo, tag) {
    const re = new RegExp(`\\[${escapeRegex(tag)}\\]([\\s\\S]*?)\\[\\/${escapeRegex(tag)}\\]`, 'i');
    const m = (memo || '').match(re);
    return m ? m[1].trim() : null;
}

function stripMemoBlock(memo, tag) {
    const re = new RegExp(`\\s*\\[${escapeRegex(tag)}\\][\\s\\S]*?\\[\\/${escapeRegex(tag)}\\]`, 'i');
    return (memo || '').replace(re, '').replace(/\n{3,}/g, '\n\n').trim();
}

function replaceMemoBlock(memo, tag, innerContent) {
    const re = new RegExp(`\\s*\\[${escapeRegex(tag)}\\][\\s\\S]*?\\[\\/${escapeRegex(tag)}\\]`, 'i');
    const block = `[${tag}]\n${innerContent}\n[/${tag}]`;
    if (re.test(memo)) return memo.replace(re, () => '\n\n' + block).replace(/\n{3,}/g, '\n\n').trim();
    return (memo ? memo.trimEnd() + '\n\n' : '') + block;
}

// Member boundary: ONLY a true entity header line (Name (Class): X/Y HP), never a sub-field
// like "Combat:" or "Status:". Sub-field lines are continuations of the current entry.
const PARTY_MEMBER_HEADER_RX = /^\s*[-*+•–—]?(?:\s+)?(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP\b/i;
const PARTY_MEMBER_COMPACT_HEADER_RX = /^\s*[-*+•–—]?(?:\s+)?(.+?):\s*(Benched\s*\([^)]*\)|Benched\b.*)$/i;
const PARTY_SUBFIELD_LABELS = /^(Combat|Gear|Proficiencies|Attr|Saves|Skills|Traits|Abilities|Spells|HD|Status):/i;

function isPartyMemberHeaderLine(line) {
    const trimmed = line.trim().replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
    if (PARTY_SUBFIELD_LABELS.test(trimmed)) return false;
    return PARTY_MEMBER_HEADER_RX.test(trimmed) || PARTY_MEMBER_COMPACT_HEADER_RX.test(trimmed);
}

/** @returns {{name: string, lines: string[]}[]} */
function splitPartyMemberEntries(blockContent) {
    if (!blockContent || /^(?:REMOVED|EXPIRED|CLEARED|NONE)$/i.test(blockContent.trim())) return [];
    const rawLines = blockContent.split('\n');
    const entries = [];
    let currentName = null;
    let currentLines = [];

    const headerName = (line) => {
        const trimmed = line.trim().replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        if (!isPartyMemberHeaderLine(line)) return null;
        const hp = trimmed.match(PARTY_MEMBER_HEADER_RX);
        if (hp) return hp[1].trim();
        const compact = trimmed.match(PARTY_MEMBER_COMPACT_HEADER_RX);
        if (compact) return compact[1].trim();
        return null;
    };

    for (const rawLine of rawLines) {
        if (!rawLine.trim()) continue;
        const name = headerName(rawLine);
        if (name !== null) {
            if (currentName) entries.push({ name: currentName, lines: [...currentLines] });
            currentName = name;
            currentLines = [rawLine.trim().replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '')];
            continue;
        }
        if (currentName) currentLines.push(rawLine.trim());
    }
    if (currentName) entries.push({ name: currentName, lines: [...currentLines] });
    return entries;
}

function entryText(entry) {
    return entry.lines.join('\n');
}

function isFullPartyStatEntry(text) {
    return /Combat:/i.test(text);
}

function memberNameKey(name) {
    return (name || '').trim().toLowerCase();
}

function buildMemberLookup(blockContent) {
    const map = new Map();
    for (const entry of splitPartyMemberEntries(blockContent)) {
        map.set(memberNameKey(entry.name), entry);
    }
    return map;
}

/**
 * Replaces [BENCHED PARTY] full stat entries with compact name + Status lines for LLM
 * context injection only. Never call this on the persisted memo.
 *
 * Gate rule: only the member name (from the HP header line) and the Status: line survive.
 * Combat/Gear/Attr/etc. are discarded entirely — not rewritten, not re-labeled.
 * @param {string} memo
 * @returns {string}
 */
export function compactBenchedPartyForContext(memo) {
    const settings = getSettings();
    if (settings.modules?.['benched party'] === false) {
        return stripMemoBlock(memo, 'BENCHED PARTY');
    }

    const content = parseMemoBlockContent(memo, 'BENCHED PARTY');
    if (!content || /^(?:REMOVED|EXPIRED|CLEARED|NONE)$/i.test(content)) return memo || '';

    const compactLines = [];
    for (const entry of splitPartyMemberEntries(content)) {
        let status = '';
        for (const line of entry.lines) {
            if (/^status:/i.test(line)) {
                status = line.replace(/^status:\s*/i, '').trim();
                break;
            }
        }
        if (!status) {
            const inline = entry.lines[0]?.match(/:\s*(Benched\s*\([^)]*\)|Benched\b.*)$/i);
            status = inline ? inline[1].trim() : 'Benched';
        }
        compactLines.push(`- ${entry.name}: ${status}`);
    }

    if (!compactLines.length) return memo || '';
    return replaceMemoBlock(memo, 'BENCHED PARTY', compactLines.join('\n'));
}

/**
 * After mergeMemo, restore full stat entries when the Tracker only had compact
 * [BENCHED PARTY] context (or emitted a header-only relocation).
 * @param {string} priorMemo
 * @param {string} mergedMemo
 * @returns {string}
 */
export function hydratePartyRelocationStats(priorMemo, mergedMemo) {
    if (!priorMemo || !mergedMemo) return mergedMemo || '';

    const priorParty = buildMemberLookup(parseMemoBlockContent(priorMemo, 'PARTY'));
    const priorBenched = buildMemberLookup(parseMemoBlockContent(priorMemo, 'BENCHED PARTY'));

    let result = mergedMemo;
    for (const tag of ['PARTY', 'BENCHED PARTY']) {
        const content = parseMemoBlockContent(result, tag);
        if (!content) continue;
        if (/^(?:REMOVED|EXPIRED|CLEARED|NONE)$/i.test(content.trim())) continue;

        const hydrated = splitPartyMemberEntries(content).map(entry => {
            const text = entryText(entry);
            if (isFullPartyStatEntry(text)) return entry;

            const key = memberNameKey(entry.name);
            const full = priorBenched.get(key) || priorParty.get(key);
            if (!full || !isFullPartyStatEntry(entryText(full))) return entry;

            const fullLines = [...full.lines];
            if (tag === 'BENCHED PARTY') {
                const statusIdx = fullLines.findIndex(l => /^status:/i.test(l));
                const newStatus = entry.lines.find(l => /^status:/i.test(l))
                    || entry.lines.find(l => /Benched\s*\(/i.test(l));
                if (newStatus) {
                    const statusVal = newStatus.replace(/^status:\s*/i, '').trim();
                    if (statusIdx >= 0) fullLines[statusIdx] = `Status: ${statusVal}`;
                    else fullLines.push(`Status: ${statusVal}`);
                }
            } else if (tag === 'PARTY') {
                const statusIdx = fullLines.findIndex(l => /^status:/i.test(l));
                if (statusIdx >= 0) {
                    const statusLine = fullLines[statusIdx];
                    if (/Benched\s*\(/i.test(statusLine)) {
                        fullLines[statusIdx] = 'Status: Healthy';
                    }
                }
            }
            return { name: entry.name, lines: fullLines };
        });

        const rebuilt = hydrated.map(e => {
            const lines = [...e.lines];
            if (lines.length && !/^-/.test(lines[0])) lines[0] = `- ${lines[0]}`;
            return lines.join('\n');
        }).join('\n');

        result = replaceMemoBlock(result, tag, rebuilt);
    }
    return result;
}

/**
 * Prepares memo text for Tracker LLM context (TRACKER STATE injection).
 * @param {string} memo
 * @returns {string}
 */
export function memoForTrackerContext(memo) {
    return compactBenchedPartyForContext(stripCompletedQuestsFromMemo(memo || ''));
}

/**
 * Prepares memo text for GM narrative context (STATE MEMO injection).
 * @param {string} memo
 * @returns {string}
 */
export function memoForGmContext(memo) {
    const stripped = (memo || '').replace(/\[QUESTS\][\s\S]*?\[\/QUESTS\]/gi, '').trim();
    return compactBenchedPartyForContext(stripped);
}

// ── Legacy quest text format ───────────────────────────────────────────────────

/**
 * Parses the state model's plain-text quest format into settings.quests[].
 * Each quest block starts with "QUEST: <title>" and contains labeled key: value lines.
 * @param {string} text - Content inside [QUESTS]...[/QUESTS]
 * @returns {object[]|null} Array of quest objects, or null on complete parse failure.
 */
export function parseQuestsFromText(text) {
    if (!text || !text.trim()) return [];

    const questBlocks = text.trim().split(/^QUEST:/m);
    const quests = [];

    for (const block of questBlocks) {
        if (!block.trim()) continue;

        const lines = block.split('\n');
        const title = lines[0].trim();
        if (!title) continue;

        /** @param {string} key */
        const getField = (key) => {
            const re = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'mi');
            const m = block.match(re);
            return m ? m[1].trim() : null;
        };

        const rawGiver  = getField('GIVER') || '';
        const giverParts = rawGiver.split(' @ ');
        const giverName = giverParts[0]?.trim() || 'Unknown';
        const giverLoc  = giverParts[1]?.trim() || 'Unknown';

        const rawCoeff = getField('FRUSTRATION_COEFF');
        const coeff = rawCoeff ? parseFloat(rawCoeff) : null;

        // Objectives: OBJ_ACTIVE, OBJ_COMPLETED/OBJ_DONE, or OBJ_FAILED lines
        // Robust: handles both one-per-line and comma-separated objectives on a single line
        const objectives = [];
        const objRe = /^\s*(OBJ_ACTIVE|OBJ_DONE|OBJ_COMPLETED|OBJ_FAILED):\s*(.+)$/gmi;
        // Read OBJ_TOTAL lines into a map keyed by order index for assignment below
        const objTotals = [];
        const objTotalRe = /^\s*OBJ_TOTAL:\s*(\d+)$/gmi;
        let objTotalMatch;
        while ((objTotalMatch = objTotalRe.exec(block)) !== null) {
            objTotals.push(parseInt(objTotalMatch[1], 10));
        }
        let objMatch;
        let objIdx = 0;
        while ((objMatch = objRe.exec(block)) !== null) {
            const tag = objMatch[1].toUpperCase();
            const isDone = (tag === 'OBJ_DONE' || tag === 'OBJ_COMPLETED');
            const isFailed = (tag === 'OBJ_FAILED');
            const rawContent = objMatch[2].trim();

            // Detect comma-separated objectives: "Obj one (required), Obj two (optional)"
            // A comma-separated list will have "(required)" or "(optional)" mid-string
            const hasInlineMarkers = /\)\s*,/.test(rawContent);

            const parts = hasInlineMarkers
                ? rawContent.split(/,\s*(?=\S)/)   // split on ", " boundaries
                : [rawContent];

            for (const part of parts) {
                const p = part.trim();
                if (!p) continue;
                const isOptional = /\(optional\)$/i.test(p);
                // Strip (required)/(optional) suffix
                let objText = p.replace(/\s*\((required|optional)\)\s*$/i, '').trim();
                // Extract inline [progress/total] counter, e.g. "Collect mushrooms [4/6]"
                let progress = undefined;
                let total = objTotals[objIdx] ?? undefined;
                const progressMatch = objText.match(/\[(\d+)\/(\d+)\]\s*$/);
                if (progressMatch) {
                    progress = parseInt(progressMatch[1], 10);
                    total    = parseInt(progressMatch[2], 10);
                    objText  = objText.replace(/\s*\[\d+\/\d+\]\s*$/, '').trim();
                }
                if (!objText) continue;
                const entry = {
                    id:       `obj_${objIdx++}`,
                    text:     objText,
                    required: !isOptional,
                    status:   isDone ? 'completed' : (isFailed ? 'failed' : 'active'),
                };
                if (total != null)    entry.total    = total;
                if (progress != null) entry.progress = progress;
                objectives.push(entry);
            }
        }

        // Rewards: REWARD lines
        const rewards = [];
        const rewardRe = /^\s*REWARD:\s*(.+)$/gmi;
        let rewardMatch;
        while ((rewardMatch = rewardRe.exec(block)) !== null) {
            rewards.push(rewardMatch[1].trim());
        }

        quests.push({
            id:                     getField('ID') || `quest_${Date.now()}_${quests.length}`,
            title,
            status:                 getField('STATUS') || 'active',
            giver_name:             giverName,
            giver_location:         giverLoc,
            accepted_time:          getField('ACCEPTED'),
            deadline_time:          getField('DEADLINE'),
            difficulty:             getField('DIFFICULTY'),
            frustration_coefficient: coeff !== null && !isNaN(coeff) ? coeff : undefined,
            objectives,
            rewards,
        });
    }

    return quests;
}

/**
 * Converts settings.quests[] back to the plain-text format for the Raw View.
 * @param {object[]} quests
 * @returns {string}
 */
export function serializeQuestsToText(quests) {
    if (!quests || !quests.length) return '';

    return quests.map(q => {
        const lines = [`QUEST: ${q.title}`];
        lines.push(`  ID: ${q.id}`);
        lines.push(`  STATUS: ${q.status || 'active'}`);
        lines.push(`  GIVER: ${q.giver_name} @ ${q.giver_location}`);
        if (q.accepted_time)          lines.push(`  ACCEPTED: ${q.accepted_time}`);
        if (q.deadline_time)          lines.push(`  DEADLINE: ${q.deadline_time}`);
        if (q.difficulty)             lines.push(`  DIFFICULTY: ${q.difficulty}`);
        if (q.frustration_coefficient != null)
                                      lines.push(`  FRUSTRATION_COEFF: ${q.frustration_coefficient}`);

        // Inject human-readable mood for the AI narrator
        if (q.status === 'active' || q.status === 'past deadline') {
            const settings = getSettings();
            const showFrustration = !!settings.syspromptModules?.questsFrustration;
            const currentTime = settings.currentMemo?.match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i)?.[1]?.trim() || "";
            const { label } = getQuestMood(q, currentTime, showFrustration);
            lines.push(`  MOOD: ${label}`);
        }
        for (const obj of (q.objectives || [])) {
            let tag = 'OBJ_ACTIVE';
            if (obj.status === 'completed') tag = 'OBJ_COMPLETED';
            else if (obj.status === 'failed') tag = 'OBJ_FAILED';
            
            const suffix = obj.required ? '(required)' : '(optional)';
            const progressStr = (typeof obj.progress === 'number' && typeof obj.total === 'number')
                ? ` [${obj.progress}/${obj.total}]` : '';
            lines.push(`  ${tag}: ${obj.text}${progressStr} ${suffix}`);
            if (obj.total != null) lines.push(`  OBJ_TOTAL: ${obj.total}`);
        }
        for (const r of (q.rewards || [])) {
            lines.push(`  REWARD: ${r}`);
        }
        return lines.join('\n');
    }).join('\n\n');
}

/**
 * Parses the [QUESTS] block from a text string and returns a quest array.
 * Pure function — no side effects.
 * @param {string} memoText
 * @returns {any[]}
 */
export function parseQuestsFromMemo(memoText) {
    const match = (memoText || '').match(/\[QUESTS\]([\s\S]*?)\[\/QUESTS\]/i);
    if (!match) return [];

    const content = match[1].trim();

    // Auto-detect format: plain-text starts with QUEST:
    if (content.startsWith('QUEST:')) {
        return parseQuestsFromText(content);
    } else {
        try {
            const parsed = JSON.parse(content);
            const quests = Array.isArray(parsed) ? parsed : (parsed.quests || []);
            return quests;
        } catch (e) {
            console.warn('[RPG Tracker] parseQuestsFromMemo: Failed to parse [QUESTS] as JSON:', e);
            return [];
        }
    }
}

/**
 * Parses the [QUESTS] block from a text string and updates settings.quests.
 * Used when the user manually edits the Raw View.
 * @param {string} memoText
 */
export function syncQuestsFromMemo(memoText) {
    const settings = getSettings();

    // Safety check: if memoText contains delta updates instead of full quests, do NOT clear active quests.
    const match = (memoText || '').match(/\[QUESTS\]([\s\S]*?)\[\/QUESTS\]/i);
    if (match) {
        const content = match[1].trim();
        if (!content.startsWith('QUEST:')) {
            try {
                const parsed = JSON.parse(content);
                if (parsed && parsed.updates) {
                    return; // delta updates block, ignore syncing to preserve existing state
                }
            } catch (e) {
                // Ignore parse errors here, let parseQuestsFromMemo handle it
            }
        }
    }

    const quests = parseQuestsFromMemo(memoText);
    const existingArchived = (settings.quests || []).filter(q => isArchivedQuestStatus(q.status));

    if (quests.length === 0) {
        const blockMatch = (memoText || '').match(/\[QUESTS\]([\s\S]*?)\[\/QUESTS\]/i);
        if (!blockMatch && settings.quests && settings.quests.length > 0) {
            if (settings.quests.length !== existingArchived.length && settings.debugMode) {
                console.log('[RPG Tracker] syncQuestsFromMemo: active quests cleared because [QUESTS] block was removed.');
            }
            settings.quests = existingArchived;
        } else if (settings.quests && settings.quests.length > 0) {
            settings.quests = existingArchived;
        }
        return;
    }

    // Merge parsed memo quests with archived entries stripped from the memo.
    // Memo wins for any quest id it contains — rollback must not preserve stale archive rows.
    const newIds = new Set(quests.map(q => q.id));
    const merged = quests.filter(q => !isArchivedQuestStatus(q.status));
    for (const eq of existingArchived) {
        if (!newIds.has(eq.id)) {
            merged.push(eq);
        }
    }
    // Also pick up newly archived quests the model still had in the memo this pass
    for (const q of quests) {
        if (isArchivedQuestStatus(q.status)) {
            const idx = merged.findIndex(m => m.id === q.id);
            if (idx >= 0) merged[idx] = q;
            else merged.push(q);
        }
    }

    settings.quests = merged;
    if (settings.debugMode) console.log(`[RPG Tracker] syncQuestsFromMemo: updated internal state with ${merged.length} quest(s).`);
}

/**
 * Syncs settings.quests from memo, then returns memo with archived quests stripped.
 * @param {string} memoText
 * @returns {string}
 */
export function applyQuestSyncAndStripMemo(memoText) {
    syncQuestsFromMemo(memoText);
    return stripArchivedQuestsFromMemo(memoText);
}

/**
 * Removes a completed/failed quest from the archive (settings.quests).
 * @param {string} questId
 */
export function removeArchivedQuest(questId) {
    if (!questId) return;
    const settings = getSettings();
    settings.quests = (settings.quests || []).filter(q => q.id !== questId);
}

// ── Delta display ─────────────────────────────────────────────────────────────

/**
 * Produces an HTML diff string for display in the delta panel.
 */
export function computeDelta(oldMemo, newMemo) {
    if (!oldMemo && !newMemo) return '<span class="delta-empty">No memo yet.</span>';
    if (!oldMemo) return '<span class="delta-added">+ (initial memo created)</span>';

    const oldLines = new Set(oldMemo.split('\n').map(l => l.trim()).filter(Boolean));
    const newLines = new Set(newMemo.split('\n').map(l => l.trim()).filter(Boolean));

    const added   = [...newLines].filter(l => !oldLines.has(l));
    const removed = [...oldLines].filter(l => !newLines.has(l));

    if (added.length === 0 && removed.length === 0) {
        return '<span class="delta-empty">No changes detected.</span>';
    }

    const html = [
        ...removed.map(l => `<div class="delta-removed">- ${escapeHtml(l)}</div>`),
        ...added.map(l   => `<div class="delta-added">+ ${escapeHtml(l)}</div>`),
    ];
    return html.join('');
}

// ── Tool-call message detection ───────────────────────────────────────────────

/**
 * Index of the Nth-most-recent user message (1 = latest user turn), including
 * all assistant/tool messages after it. Returns 0 if fewer than N user messages exist.
 * @param {any[]} chat
 * @param {number} n
 * @returns {number}
 */
export function findNthUserMessageStartIdx(chat, n = 1) {
    if (!chat?.length || n <= 0) return 0;
    let found = 0;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i]?.is_user) {
            found++;
            if (found >= n) return i;
        }
    }
    return 0;
}

/**
 * Formats chat messages from startIdx for Lorebook Agent context.
 * @param {any[]} chat
 * @param {number} startIdx
 * @param {boolean} [includeHidden=false]
 * @param {boolean} [fullIndexCoverage=false] When true (since-last-run), walk every chat slot in range and include all non-system narrative content — tool-call UI shells are still dropped.
 * @returns {string}
 */
export function formatAgentChatLogFromIndex(chat, startIdx, includeHidden = false, fullIndexCoverage = false) {
    if (!chat?.length || startIdx >= chat.length) return '';
    const lines = [];
    for (let i = startIdx; i < chat.length; i++) {
        const msg = chat[i];
        if (msg?.is_system) continue;
        if (!includeHidden && msg?.is_hidden) continue;
        if (msg?.extra?.['summary'] || msg?.extra?.['is_summary'] || msg?.extra?.['summary_data']) continue;

        const raw = msg.mes || msg.content || '';
        const toolStripped = cleanToolCallMessage(raw);
        let content = '';
        if (toolStripped !== null) {
            content = cleanMessageContent({ ...msg, mes: toolStripped, content: toolStripped });
        } else if (fullIndexCoverage) {
            content = cleanMessageContent({ ...msg, mes: raw, content: raw });
        }
        if (!content) continue;
        if (content.startsWith('[Summary') || content.startsWith('(Summary') || content.includes('Summary of past events:')) continue;

        const name = msg.is_user ? 'Player' : (msg.name || 'Narrator');
        lines.push(`${name}: ${content}`);
    }
    return lines.join('\n\n');
}

/**
 * Returns null if the message is a tool-call payload (discard it from context).
 * Returns the original text if it is regular narrative.
 * @param {string} text
 * @returns {string|null}
 */
export function cleanToolCallMessage(text) {
    if (!text) return text;
    const trimmed = text.trim();

    if (trimmed.includes('<code') && trimmed.includes('</code>')) {
        const codeStart   = trimmed.indexOf('<code');
        const contentStart = trimmed.indexOf('>', codeStart);
        const codeEnd     = trimmed.indexOf('</code>', contentStart);
        if (contentStart !== -1 && codeEnd !== -1) {
            const jsonText = trimmed.slice(contentStart + 1, codeEnd).trim();
            try {
                const parsed  = JSON.parse(jsonText);
                const entries = Array.isArray(parsed) ? parsed : [parsed];
                if (entries.some(e => e && (e.name || e.result !== undefined))) {
                    return null;
                }
            } catch { /* not valid JSON inside the code block */ }
        }
    }

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
            const parsed  = JSON.parse(trimmed);
            const entries = Array.isArray(parsed) ? parsed : [parsed];
            if (entries.some(e => e && (e.name || e.result !== undefined))) {
                return null;
            }
        } catch { /* not valid JSON */ }
    }

    return text;
}

/**
 * Cleans a message content string, stripping out tool calls, details, thinking/reasoning blocks,
 * extra metadata, JSON keys, and HTML/XML tags to keep the prompt context clean.
 * @param {any} msg The SillyTavern message object
 * @returns {string} The cleaned message text
 */
export function cleanMessageContent(msg) {
    if (!msg) return '';
    let mes = (msg.mes || msg.content || '').trim();
    if (!mes) return '';

    // Strip tool call & thinking UI (XML-tag-like blocks and their contents)
    mes = mes.replace(/<details\b[^>]*>([\s\S]*?)<\/details>/gi, '');
    mes = mes.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, '');
    mes = mes.replace(/<thought\b[^>]*>([\s\S]*?)<\/thought>/gi, '');
    mes = mes.replace(/<thinking\b[^>]*>([\s\S]*?)<\/thinking>/gi, '');
    mes = mes.replace(/<reasoning\b[^>]*>([\s\S]*?)<\/reasoning>/gi, '');
    mes = mes.replace(/<think\b[^>]*>([\s\S]*?)<\/think>/gi, '');

    // Strip JSON-like reasoning/thought keys and their values
    mes = mes.replace(/"reasoning":\s*"(?:[^"\\]|\\.)*"/gi, '');
    mes = mes.replace(/"thought":\s*"(?:[^"\\]|\\.)*"/gi, '');
    mes = mes.replace(/"thinking":\s*"(?:[^"\\]|\\.)*"/gi, '');

    // If ST stored reasoning/thought in extra and it bled into mes, strip it
    const extraReasoning = msg.extra?.reasoning;
    if (extraReasoning && typeof extraReasoning === 'string' && mes.includes(extraReasoning)) {
        mes = mes.replace(extraReasoning, '');
    }
    const extraThought = msg.extra?.thought;
    if (extraThought && typeof extraThought === 'string' && mes.includes(extraThought)) {
        mes = mes.replace(extraThought, '');
    }

    // Strip any remaining HTML/XML tags
    mes = mes.replace(/<[^>]+>/g, '');

    return mes.trim();
}


// ── User action extraction ────────────────────────────────────────────────────

/**
 * Extracts the last user message from the chat, stripping injected blocks
 * (STATE MEMO, RNG_QUEUE) so only the player's actual typed input remains.
 */
export function getLastUserAction() {
    const { chat } = SillyTavern.getContext();
    if (!chat || chat.length === 0) return '';

    let raw = '';
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i].is_user || chat[i]['role'] === 'user') {
            raw = chat[i].mes || chat[i]['content'] || '';
            break;
        }
    }

    if (!raw) return '';

    if (Array.isArray(raw)) {
        raw = raw.filter(p => p && p.type === 'text').map(p => p.text || '').join('\n');
    } else if (typeof raw !== 'string') {
        raw = String(raw);
    }

    raw = raw.replace(/###\s*STATE MEMO[^]*?(?=\n\[RNG_QUEUE|\n###|\n\[(?!RNG_QUEUE)[A-Z]|$)/i, '');
    raw = raw.replace(/\[RNG_QUEUE\s[^\]]*\][\s\S]*?\[\/RNG_QUEUE\][ \t]*\n?/gi, '');
    raw = raw.replace(/\[[A-Z_]+\][\s\S]*?\[\/[A-Z_]+\]/g, '');
    raw = raw.replace(/###\s*CURRENT USER INPUT[^\n]*\n?/gi, '');
    raw = raw.replace(/\[Continue the narrative\]/gi, '');

    return raw.trim();
}

// ── Lorebook context builder ──────────────────────────────────────────────────

/**
 * Reads active Lorebooks from user settings and assembles them into
 * a context string prepended to the state model user prompt.
 */
export async function buildLorebookContext() {
    const settings = getSettings();
    const stCtx = SillyTavern.getContext();
    const parts = [];

    if (settings.ctxWorldInfo) {
        try {
            const allowedBooks = settings.lorebookFilter || [];
            let booksToLoad = [];

            if (allowedBooks.length > 0) {
                booksToLoad = allowedBooks;
            } else {
                // Try the in-memory list first
                booksToLoad = stCtx.getWorldInfoNames?.() ?? [];

                // If empty, force-refresh from backend and retry
                if (!booksToLoad.length && stCtx.updateWorldInfoList) {
                    await stCtx.updateWorldInfoList();
                    booksToLoad = stCtx.getWorldInfoNames?.() ?? [];
                }

                // Final fallback: direct backend fetch
                if (!booksToLoad.length) {
                    try {
                        const resp = await fetch('/api/settings/get', {
                            method: 'POST',
                            headers: stCtx.getRequestHeaders(),
                            body: JSON.stringify({}),
                        });
                        if (resp.ok) {
                            const data = await resp.json();
                            booksToLoad = data.world_names ?? [];
                        }
                    } catch (fetchErr) {
                        console.warn('[RPG Tracker] Direct world_names fetch failed:', fetchErr);
                    }
                }
            }

            const entries = [];
            for (const bookName of booksToLoad) {
                try {
                    const bookData = await stCtx.loadWorldInfo(bookName);
                    if (!bookData?.entries) continue;
                    for (const entry of Object.values(/** @type {any} */(bookData).entries)) {
                        const e = /** @type {any} */ (entry);
                        if (!e.disable && e.content) entries.push(e.content);
                    }
                } catch (bookErr) {
                    console.warn(`[RPG Tracker] Failed to load lorebook "${bookName}":`, bookErr);
                }
            }

            if (entries.length > 0) {
                const label = allowedBooks.length > 0 ? `Filtered: ${allowedBooks.join(', ')}` : 'All Books';
                parts.push(`## WORLD LORE (${label})\n${entries.join('\n---\n')}`);
            }
        } catch (e) {
            console.warn('[RPG Tracker] Could not inject World Info:', e);
        }
    }

    return parts.join('\n\n');
}

// ── Module instruction builders ───────────────────────────────────────────────

/**
 * Builds the complete modules instruction block for the system prompt.
 */
export function buildModulesInstructionText(settings) {
    let modulesText = "";
    const promptsMap = settings.stockPrompts || DEFAULT_STOCK_PROMPTS;

    modulesText += "### CORE MODULES\n";
    for (const [key, prompt] of Object.entries(promptsMap)) {
        // Never emit helper prompts as their own modules
        if (key === 'time_24h' || key === 'time_ddmmyy' || key === 'time_ddmmyy_24h') continue;

        if (key === 'quests' && settings.syspromptModules?.quests === false) continue;
        if (settings.modules[key]) {
            let p = prompt;

            // ── Dynamic prompt customization for Quests ──────────────────────
            if (key === 'quests') {
                const isDeadlines = !!settings.syspromptModules?.questsDeadlines;
                const isFrustration = !!settings.syspromptModules?.questsFrustration;
                const isDifficulty = !!settings.syspromptModules?.questsDifficulty;
                if (settings.useDdMmYyFormat) {
                    p = p
                        .replace(/Day 1/g, '01/01/2026')
                        .replace(/Day 4/g, '04/01/2026')
                        .replace(/Day N/g, 'DD/MM/YYYY');
                }
                if (!isDeadlines) p = p.replace(/\n\s*DEADLINE:.*?\n/g, '\n');
                if (!isFrustration) p = p.replace(/\n\s*FRUSTRATION_COEFF:.*?\n/g, '\n');
                if (!isDifficulty) {
                    p = p.replace(/\n\s*DIFFICULTY:.*?\n/g, '\n');
                    p = p.replace(/\n- For difficulty, use the DIFFICULTY marker.*\n/g, '\n');
                }
            }

            // ── Dynamic prompt swap for Time Module ─────────────────────────
            if (key === 'time') {
                const timeKey = resolveTimePromptKey(settings);
                if (timeKey !== 'time') {
                    p = promptsMap[timeKey] || DEFAULT_STOCK_PROMPTS[timeKey];
                }
            }

            modulesText += `- [${key.toUpperCase()}]: ${p}\n`;
        }
    }

    // Only inject timing anchor on first turn of new campaign (before [TIME] block exists in memo).
    // Once the State Tracker has written the initial [TIME] block, it manages time itself.
    if (settings.initialDate && !settings.currentMemo?.match(/\[TIME\]/i)) {
        modulesText += `\n### CAMPAIGN TIMING RULES\n- The campaign starting date is ${settings.initialDate}. Ensure the very first [TIME] block and all early timeline entries align with this starting anchor.\n`;
    }

    const enabledCustomFields = (settings.customFields || []).filter(f => f.enabled && f.tag);
    if (enabledCustomFields.length > 0) {
        modulesText += "\n### CUSTOM MODULES\n";
        enabledCustomFields.forEach(f => {
            const instruction = buildModuleFormatInstruction(f);
            if (instruction) {
                modulesText += `- [${f.tag.toUpperCase()}]: ${instruction}\n`;
            }
        });
    }
    return modulesText.trim();
}

export function buildModuleFormatInstruction(field) {
    return field.prompt || '';
}
