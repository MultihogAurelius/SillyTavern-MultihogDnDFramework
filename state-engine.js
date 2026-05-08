/**
 * state-engine.js — Fatbody D&D Framework
 * Pure text/logic utilities for memo management and state model context assembly.
 * No DOM access. No module-level side effects.
 *
 * Imports: settings.js, constants.js
 * Imported by: index.js (runStateModelPass, sendDirectPrompt)
 */

import { getSettings } from './settings.js';
import { DEFAULT_STOCK_PROMPTS } from './constants.js';

// ── String utilities ──────────────────────────────────────────────────────────

export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Wraps parenthetical groups in a highlight span. */
export function highlightParens(text) {
    return text.replace(/\(([^)]+)\)/g, '<span class="rt-paren-highlight">($1)</span>');
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

    const tagPattern = /\[([^\]\/][^\]]*)\]([\s\S]*?)\[\/\1\]/gi;
    const matches = [...aiOutput.matchAll(tagPattern)];

    if (matches.length === 0) {
        console.warn("[RPG Tracker] No valid [TAG]...[/TAG] blocks found in model output — treating as no-change. Output was:", aiOutput);
        return currentMemo;
    }

    if (settings.debugMode) console.log(`[RPG Tracker] mergeMemo: found ${matches.length} tag(s):`, matches.map(m => m[1]));

    let memo = currentMemo;

    for (const match of matches) {
        const tag = match[1].trim();
        const newContent = match[2].trim();

        // [QUESTS] block contains JSON — route to quest merger
        if (tag.toUpperCase() === 'QUESTS') {
            mergeQuestUpdates(newContent);
            // Do NOT continue — we want the [QUESTS] block to be replaced/inserted in the memo string
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
    return deduplicateMemo(cleaned);
}

// ── Quest update merge ────────────────────────────────────────────────────────

/**
 * Applies a constrained {"updates":[...]} diff from the state model to settings.quests.
 * Only mutates `status` and `objectives[n].status`. All other fields are locked.
 * Does NOT touch quests with status 'failed'.
 * @param {string} jsonText
 */
export function mergeQuestUpdates(jsonText) {
    const settings = getSettings();
    if (!settings.quests || !settings.quests.length) return;

    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (e) {
        console.warn('[RPG Tracker] mergeQuestUpdates: invalid JSON in [QUESTS] block:', jsonText);
        return;
    }

    const updates = Array.isArray(parsed?.updates) ? parsed.updates : [];
    if (!updates.length) return;

    let changed = false;
    for (const update of updates) {
        const quest = settings.quests.find(q => q.id === update.id);
        if (!quest) continue;
        if (quest.status === 'failed') continue; // locked — script already handled this

        if (update.status && ['active', 'completed'].includes(update.status)) {
            quest.status = update.status;
            changed = true;
        }

        if (Array.isArray(update.objectives)) {
            for (const objUpdate of update.objectives) {
                const obj = quest.objectives.find(o => o.id === objUpdate.id);
                if (!obj) continue;
                if (objUpdate.status && ['active', 'completed', 'failed'].includes(objUpdate.status)) {
                    obj.status = objUpdate.status;
                    changed = true;
                }
            }
        }
    }

    if (changed) {
        if (settings.debugMode) console.log('[RPG Tracker] mergeQuestUpdates: applied quest state changes.');
        SillyTavern.getContext().saveSettingsDebounced();
        // After merging updates, we MUST rebuild the [QUESTS] block in the memo to reflect the new state
        syncQuestsToMemo();
    }
}

/**
 * Rebuilds the [QUESTS] block in settings.currentMemo using the full state in settings.quests.
 * This ensures Raw View and Internal State are always in sync.
 */
export function syncQuestsToMemo() {
    const settings = getSettings();
    if (!settings.quests) return;

    const fullJson = JSON.stringify(settings.quests, null, 2);
    const tag = 'QUESTS';
    const escapedTag = escapeRegex(tag);
    const pattern = new RegExp(`\\s*\\[${escapedTag}\\][\\s\\S]*?\\[\\/${escapedTag}\\]`, 'i');
    const block = `\n\n[${tag}]\n${fullJson}\n[/${tag}]`;

    if (pattern.test(settings.currentMemo)) {
        settings.currentMemo = settings.currentMemo.replace(pattern, block);
    } else {
        settings.currentMemo = (settings.currentMemo + block).trim();
    }
}

/**
 * Parses the [QUESTS] block from a text string and updates settings.quests.
 * Used when the user manually edits the Raw View.
 * @param {string} memoText
 */
export function syncQuestsFromMemo(memoText) {
    const settings = getSettings();
    const match = memoText.match(/\[QUESTS\]([\s\S]*?)\[\/QUESTS\]/i);

    if (!match) {
        // If the block is entirely missing from the memo, clear the internal state
        if (settings.quests && settings.quests.length > 0) {
            settings.quests = [];
            if (settings.debugMode) console.log('[RPG Tracker] syncQuestsFromMemo: quests cleared because [QUESTS] block was removed.');
        }
        return;
    }

    try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
            settings.quests = parsed;
            if (settings.debugMode) console.log('[RPG Tracker] syncQuestsFromMemo: updated internal state from memo edit.');
        }
    } catch (e) {
        // Silently fail or log — user might be mid-edit
        if (settings.debugMode) console.warn('[RPG Tracker] syncQuestsFromMemo: invalid JSON in quest block. Error:', e.message);
    }
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

    raw = raw.replace(/###\s*STATE MEMO[^]*?(?=\n\[RNG_QUEUE|\n###|\n\[(?!RNG_QUEUE)[A-Z]|$)/i, '');
    raw = raw.replace(/\[RNG_QUEUE\s[^\]]*\][\s\S]*?\[\/RNG_QUEUE\][ \t]*\n?/gi, '');
    raw = raw.replace(/\[[A-Z_]+\][\s\S]*?\[\/[A-Z_]+\]/g, '');

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
            let booksToLoad = allowedBooks.length > 0
                ? allowedBooks
                : (await stCtx.getWorldInfoNames() || []);

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
        if (settings.modules[key]) {
            modulesText += `- [${key.toUpperCase()}]: ${prompt}\n`;
        }
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
