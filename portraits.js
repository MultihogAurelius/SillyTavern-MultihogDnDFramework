import { getSettings, getActiveChatId, getEffectiveRouterCampaignPrefix } from './state-manager.js';
import { saveSettings } from './index.js';
import { sendStateRequest } from './llm-client.js';
import { parseMemoBlocks } from './renderer.js';
import { escapeHtml, memoForGmContext } from './memo-processor.js';
import { getLorebookManifest, scanRecentOutputForPresentNpcs } from './router.js';
import {
    persistPortraitSrc,
    deletePortraitFile,
    isManagedPortraitPath,
    purgeAllPortraitData,
    countPortraitPathRefs,
    resolvePortraitDisplaySrc,
    normalizeEntityName,
    lookupCustomPortraitSrc,
} from './portrait-storage.js';

/**
 * Portrait/location AI generation toast — info/success can be hidden via settings.
 * @param {'info'|'success'|'warning'|'error'} level
 * @param {string} message
 * @param {string} [title]
 * @param {object} [options] toastr options (e.g. timeOut)
 */
export function imageGenToast(level, message, title = 'RPG Tracker', options) {
    const lvl = String(level || 'info').toLowerCase();
    if (getSettings().hideImageGenToasts && (lvl === 'info' || lvl === 'success')) return;
    const fn = toastr[lvl] || toastr['info'];
    if (options) fn(message, title, options);
    else fn(message, title);
}

// Read an image File as a full-resolution Base64 data URL
export function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) return reject(new Error('Not an image'));
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Preserve portrait image at native resolution (no forced downscale).
 * Name kept for call-site compatibility; previously forced 512×512 JPEG.
 * @param {string} dataUrl
 * @returns {Promise<string>}
 */
export function scaleImageTo512Square(dataUrl) {
    return Promise.resolve(dataUrl);
}

// Re-export portrait key helpers (single source of truth in portrait-storage.js)
export { normalizeEntityName, lookupCustomPortraitSrc } from './portrait-storage.js';

export async function applyPortraitData(entityName, src) {
    const s = getSettings();
    if (!s.customPortraits) s.customPortraits = {};
    const normName = normalizeEntityName(entityName);
    const chatId = getActiveChatId();
    const previous = s.customPortraits[normName];

    if (!src) {
        delete s.customPortraits[normName];
        if (previous && isManagedPortraitPath(previous) && countPortraitPathRefs(s, previous) === 0) {
            await deletePortraitFile(previous);
        }
    } else {
        const stored = await persistPortraitSrc(src, chatId, normName);
        s.customPortraits[normName] = stored;

        // Keep the active chat partition in sync so saveChatState cannot resurrect the old path.
        if (s.chatLinkEnabled && chatId && s.chatStates?.[chatId]?.customPortraits) {
            s.chatStates[chatId].customPortraits[normName] = stored;
        }

        if (previous && previous !== stored && isManagedPortraitPath(previous) && countPortraitPathRefs(s, previous) === 0) {
            await deletePortraitFile(previous);
        }
    }
    // Portrait sets are infrequent, deliberate actions (not rapid keystrokes like the memo
    // textarea) — force an immediate flush instead of risking the 2s debounce window.
    await saveSettings(true);
}

/**
 * Move a portrait map entry when an NPC/character is renamed (portraits are keyed by name).
 * Sync map update only — caller may batch saves.
 * @param {string} oldName
 * @param {string} newName
 * @returns {{ moved: boolean, displaced: string|null, src: string|null }}
 */
function migratePortraitMapKey(oldName, newName) {
    const oldKey = normalizeEntityName(oldName);
    const newKey = normalizeEntityName(newName);
    if (!oldKey || !newKey || oldKey === newKey) {
        return { moved: false, displaced: null, src: null };
    }

    const s = getSettings();
    if (!s.customPortraits) return { moved: false, displaced: null, src: null };
    const src = s.customPortraits[oldKey];
    if (!src) return { moved: false, displaced: null, src: null };

    const displaced = s.customPortraits[newKey] || null;
    s.customPortraits[newKey] = src;
    delete s.customPortraits[oldKey];

    if (s.chatStates && typeof s.chatStates === 'object') {
        for (const chatId of Object.keys(s.chatStates)) {
            const part = s.chatStates[chatId];
            if (!part?.customPortraits || typeof part.customPortraits !== 'object') continue;
            if (part.customPortraits[oldKey]) {
                part.customPortraits[newKey] = part.customPortraits[oldKey];
                delete part.customPortraits[oldKey];
            }
        }
    }

    return { moved: true, displaced: displaced && displaced !== src ? displaced : null, src };
}

/**
 * Move a portrait map entry when an NPC/character is renamed (portraits are keyed by name).
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<boolean>} true if a key was moved
 */
export async function renamePortraitEntity(oldName, newName) {
    const result = migratePortraitMapKey(oldName, newName);
    if (!result.moved) return false;

    const s = getSettings();
    if (result.displaced && isManagedPortraitPath(result.displaced) && countPortraitPathRefs(s, result.displaced) === 0) {
        await deletePortraitFile(result.displaced);
    }

    await saveSettings(true);
    return true;
}

/**
 * Levenshtein edit distance (case-insensitive compare via callers).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function editDistance(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    /** @type {number[]} */
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        /** @type {number[]} */
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        }
        prev = cur;
    }
    return prev[n];
}

/**
 * Pair removed names with added names (memo renames / typo fixes).
 * 1↔1 is always treated as a rename; otherwise greedy fuzzy match.
 * @param {string[]} previous
 * @param {string[]} current
 * @returns {Array<[string, string]>} [oldName, newName] pairs
 */
function matchEntityRenames(previous, current) {
    const prevSet = new Set(previous.map(n => n.toUpperCase()));
    const currSet = new Set(current.map(n => n.toUpperCase()));
    const removed = previous.filter(n => !currSet.has(n.toUpperCase()));
    const added = current.filter(n => !prevSet.has(n.toUpperCase()));
    if (!removed.length || !added.length) return [];

    /** @type {Array<[string, string]>} */
    const pairs = [];

    if (removed.length === 1 && added.length === 1) {
        pairs.push([removed[0], added[0]]);
        return pairs;
    }

    const usedRemoved = new Set();
    for (const newName of added) {
        const newUp = newName.toUpperCase();
        let best = null;
        let bestDist = Infinity;
        for (const oldName of removed) {
            if (usedRemoved.has(oldName.toUpperCase())) continue;
            const oldUp = oldName.toUpperCase();
            const dist = editDistance(oldUp, newUp);
            const maxLen = Math.max(oldUp.length, newUp.length) || 1;
            const threshold = Math.max(2, Math.floor(maxLen / 3));
            if (dist <= threshold && dist < bestDist) {
                bestDist = dist;
                best = oldName;
            }
        }
        if (best) {
            usedRemoved.add(best.toUpperCase());
            pairs.push([best, newName]);
        }
    }
    return pairs;
}

/** @returns {string[]} */
function getBenchedPartyMembers() {
    const s = getSettings();
    if (!s.currentMemo) return [];
    const blocks = parseMemoBlocks(s.currentMemo);
    const block = blocks['BENCHED PARTY'];
    if (!block) return [];
    const members = [];
    for (const line of block.split('\n').map(l => l.trim()).filter(Boolean)) {
        const cleanLine = line.replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        const hpMatch = cleanLine.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP/i);
        if (hpMatch) members.push(hpMatch[1].trim());
    }
    return members;
}

/** @returns {string[]} PARTY + BENCHED PARTY names (display order, may have dupes if mis-filed) */
function getAllRosterNames() {
    return [...getPartyMembers(), ...getBenchedPartyMembers()];
}

/**
 * Last memo entity names seen while the rendered tracker was active.
 * Used to detect in-place renames (Raw View typo fixes) so portraits follow the new name.
 * @type {{ roster: string[], enemies: string[], character: string|null } | null}
 */
let _lastMemoEntitySnapshot = null;

/**
 * If a current entity has no portrait, steal a close orphan key (typo / rename left behind).
 * @param {string[]} names
 * @returns {{ moved: boolean, displaced: string[] }}
 */
function salvageOrphanPortraitKeysForNames(names) {
    const s = getSettings();
    if (!s.customPortraits) return { moved: false, displaced: [] };

    const currentKeys = new Set(
        names.map(n => normalizeEntityName(n).toUpperCase()).filter(Boolean)
    );
    /** Reserved alias keys — never treat as orphan typo sources. */
    const reserved = new Set(['CHARACTER', 'PC', 'PLAYER']);
    let orphanKeys = Object.keys(s.customPortraits).filter(k => {
        const up = k.toUpperCase();
        return !currentKeys.has(up) && !reserved.has(up);
    });
    if (!orphanKeys.length) return { moved: false, displaced: [] };

    let moved = false;
    /** @type {string[]} */
    const displaced = [];
    for (const name of names) {
        const norm = normalizeEntityName(name);
        if (!norm || s.customPortraits[norm]) continue;
        const nameUp = norm.toUpperCase();
        let best = null;
        let bestDist = Infinity;
        for (const orphan of orphanKeys) {
            const dist = editDistance(orphan.toUpperCase(), nameUp);
            const maxLen = Math.max(orphan.length, nameUp.length) || 1;
            const threshold = Math.max(2, Math.floor(maxLen / 3));
            if (dist > 0 && dist <= threshold && dist < bestDist) {
                bestDist = dist;
                best = orphan;
            }
        }
        if (!best) continue;
        const result = migratePortraitMapKey(best, name);
        if (result.moved) {
            moved = true;
            if (result.displaced) displaced.push(result.displaced);
            orphanKeys = orphanKeys.filter(k => k.toUpperCase() !== best.toUpperCase());
            console.log(`[RPG Tracker] Portrait key salvaged for rename: "${best}" → "${name}"`);
        }
    }
    return { moved, displaced };
}

/**
 * Detect State Tracker memo renames and move portrait keys before render / auto-gen.
 * Fixes empty portrait + re-generation when changing one letter in Raw View then returning.
 * @returns {boolean} true if any portrait key was moved
 */
export function reconcileMemoPortraitRenames() {
    const s = getSettings();
    const roster = getAllRosterNames();
    const enemies = getEnemyEntities();
    const character = getPrimaryCharacterBlockName(s) || null;
    const allNames = [
        ...roster,
        ...enemies,
        ...(character ? [character] : []),
    ];

    /** @type {Array<[string, string]>} */
    const pairs = [];
    if (_lastMemoEntitySnapshot) {
        pairs.push(...matchEntityRenames(_lastMemoEntitySnapshot.roster, roster));
        pairs.push(...matchEntityRenames(_lastMemoEntitySnapshot.enemies, enemies));
        if (_lastMemoEntitySnapshot.character && character
            && _lastMemoEntitySnapshot.character.toUpperCase() !== character.toUpperCase()) {
            pairs.push([_lastMemoEntitySnapshot.character, character]);
        }
    }

    /** @type {string[]} */
    const orphanDisplaced = [];
    let moved = false;
    for (const [oldName, newName] of pairs) {
        const result = migratePortraitMapKey(oldName, newName);
        if (result.moved) {
            moved = true;
            if (result.displaced) orphanDisplaced.push(result.displaced);
            console.log(`[RPG Tracker] Portrait key migrated after memo rename: "${oldName}" → "${newName}"`);
        }
        knownEntities.delete(oldName.toUpperCase());
        knownEntities.add(newName.toUpperCase());
    }

    const salvaged = salvageOrphanPortraitKeysForNames(allNames);
    if (salvaged.moved) {
        moved = true;
        orphanDisplaced.push(...salvaged.displaced);
    }

    _lastMemoEntitySnapshot = {
        roster: [...roster],
        enemies: [...enemies],
        character,
    };

    if (moved) {
        for (const path of orphanDisplaced) {
            if (isManagedPortraitPath(path) && countPortraitPathRefs(s, path) === 0) {
                void deletePortraitFile(path);
            }
        }
        void saveSettings(true);
    }
    return moved;
}

// ── Pollinations.ai model list (image-only, sorted cheapest → most expensive) ──
export const POLLINATIONS_IMAGE_MODELS = [
    // Budget
    { id: 'flux',                  label: 'Flux',                       tier: 'Budget' },
    { id: 'zimage',                label: 'ZImage',                     tier: 'Budget' },
    { id: 'qwen-image',            label: 'Qwen Image',                 tier: 'Budget' },
    { id: 'kontext',               label: 'Kontext',                    tier: 'Budget' },
    { id: 'wan-image',             label: 'Wan Image',                  tier: 'Budget' },
    // Standard
    { id: 'wan-image-pro',         label: 'Wan Image Pro',              tier: 'Standard' },
    { id: 'seedream',              label: 'Seedream',                   tier: 'Standard' },
    { id: 'seedream5',             label: 'Seedream 5',                 tier: 'Standard' },
    { id: 'seedream-pro',          label: 'Seedream Pro',               tier: 'Standard' },
    { id: 'klein',                 label: 'Klein',                      tier: 'Standard' },
    { id: 'p-image',               label: 'P-Image',                    tier: 'Standard' },
    { id: 'nova-canvas',           label: 'Nova Canvas',                tier: 'Standard' },
    { id: 'grok-imagine',          label: 'Grok Imagine',               tier: 'Standard' },
    // Premium
    { id: 'nanobanana',            label: 'NanoBanana',                 tier: 'Premium' },
    { id: 'nanobanana-2',          label: 'NanoBanana 2',               tier: 'Premium' },
    { id: 'nanobanana-pro',        label: 'NanoBanana Pro',             tier: 'Premium' },
    { id: 'ideogram-v4-turbo',     label: 'Ideogram v4 Turbo',          tier: 'Premium' },
    { id: 'ideogram-v4-balanced',  label: 'Ideogram v4 Balanced',       tier: 'Premium' },
    { id: 'ideogram-v4-quality',   label: 'Ideogram v4 Quality',        tier: 'Premium' },
    { id: 'gptimage',              label: 'GPT Image',                  tier: 'Premium' },
    { id: 'gptimage-large',        label: 'GPT Image Large',            tier: 'Premium' },
    { id: 'gpt-image-2',           label: 'GPT Image 2',                tier: 'Premium' },
    { id: 'grok-imagine-pro',      label: 'Grok Imagine Pro',           tier: 'Premium' },
];

// ── AI Portrait Prompt Generation ──────────────────────────────────────────────

/** Connection overlay for portrait / location image prompt LLM calls. */
export function getPortraitConnectionSettings(baseSettings) {
    const s = baseSettings || getSettings();
    return {
        connectionSource: s.portraitConnectionSource ?? 'default',
        connectionProfileId: s.portraitConnectionProfileId || '',
        completionPresetId: s.portraitCompletionPresetId || '',
        ollamaUrl: s.portraitOllamaUrl || 'http://localhost:11434',
        ollamaModel: s.portraitOllamaModel || '',
        openaiUrl: s.portraitOpenaiUrl || '',
        openaiKey: s.portraitOpenaiKey || '',
        openaiModel: s.portraitOpenaiModel || '',
        maxTokens: s.maxTokens,
        debugMode: s.debugMode,
    };
}

/**
 * Gathers context and calls the LLM to generate an image prompt for a character.
 * @param {string} entityName
 * @returns {Promise<string>} The generated image prompt text
 */
export async function generatePortraitPrompt(entityName) {
    const s = getSettings();
    const ctx = SillyTavern.getContext();

    // 1. Entity name
    let contextParts = [`Character Name: ${entityName}`];

    // 2. Current memo — find the entity in CHARACTER, PARTY, COMBAT blocks
    if (s.currentMemo) {
        const blocks = parseMemoBlocks(s.currentMemo);
        const relevantTags = ['CHARACTER', 'PARTY', 'COMBAT'];
        for (const tag of relevantTags) {
            const block = blocks[tag];
            if (!block) continue;
            // Check if the entity name appears in this block
            if (block.toUpperCase().includes(entityName.toUpperCase())) {
                contextParts.push(`[${tag}] block (from State Memo):\n${block.trim()}`);
            }
        }
    }

    // 3. Persona — always included, LLM decides if relevant
    try {
        const persona = ctx.substituteParams?.('{{persona}}') || '';
        if (persona.trim()) {
            contextParts.push(`User Persona:\n${persona.trim()}`);
        }
    } catch { /* substituteParams may not exist */ }

    // 4. Character card description
    try {
        const charId = ctx.characterId;
        const charData = ctx.characters?.[charId];
        if (charData?.description) {
            contextParts.push(`Character Card Description:\n${charData.description.substring(0, 2000)}`);
        }
    } catch { /* ignore */ }

    // 5. Active lorebook entries — scan for keyword matches with entityName
    try {
        const worldInfo = ctx.chat_metadata?.world_info;
        if (worldInfo) {
            // Try to get entries from context
            const entries = typeof ctx.getWorldInfoEntries === 'function'
                ? await ctx.getWorldInfoEntries()
                : null;
            if (entries && Array.isArray(entries)) {
                const matchingEntries = entries.filter(entry => {
                    const keys = entry.key || [];
                    const keysArr = Array.isArray(keys) ? keys : [keys];
                    return keysArr.some(k => k && (
                        entityName.toLowerCase().includes(k.toLowerCase()) ||
                        k.toLowerCase().includes(entityName.toLowerCase())
                    ));
                });
                if (matchingEntries.length > 0) {
                    const loreText = matchingEntries.map(e =>
                        `[Lorebook: ${e.comment || e.key?.[0] || 'Entry'}]\n${(e.content || '').substring(0, 800)}`
                    ).join('\n\n');
                    contextParts.push(`Matching Lorebook Entries:\n${loreText}`);
                }
            }
        }
    } catch { /* lorebook access may vary */ }

    // Also check active router keys for lorebook context
    try {
        if (s.activeRouterKeys?.length > 0) {
            const manifest = typeof getLorebookManifest === 'function' ? await getLorebookManifest(true) : null;
            if (manifest) {
                const matchingActive = manifest.filter(entry => {
                    const keys = entry.keys || [];
                    return keys.some(k => k && (
                        entityName.toLowerCase().includes(k.toLowerCase()) ||
                        k.toLowerCase().includes(entityName.toLowerCase())
                    ));
                });
                if (matchingActive.length > 0) {
                    const activeText = matchingActive.map(e =>
                        `[Active Lore: ${e.label || e.category || 'Entry'}]\n${(e.content || '').substring(0, 800)}`
                    ).join('\n\n');
                    contextParts.push(`Active Lorebook Context:\n${activeText}`);
                }
            }
        }
    } catch { /* lorebook manifest may not be available */ }

    // 6. Full Lorebook Agent context — ALL active keys with keywords and content
    try {
        if (s.activeRouterKeys?.length > 0) {
            const agentBooks = {};
            for (const k of s.activeRouterKeys) {
                const [bookName] = k.split('::');
                if (!agentBooks[bookName]) agentBooks[bookName] = await ctx.loadWorldInfo(bookName);
            }
            const agentEntries = [];
            for (const k of s.activeRouterKeys) {
                const [bookName, uid] = k.split('::');
                const entry = agentBooks[bookName]?.entries?.[uid];
                if (entry && entry.content) {
                    const keywords = (entry.key || []).filter(Boolean).join(', ');
                    const label = entry.comment || entry.key?.[0] || uid;
                    agentEntries.push(`[Agent Entry: "${label}" | Keywords: ${keywords || 'none'}]\n${(entry.content || '').substring(0, 600)}`);
                }
            }
            if (agentEntries.length > 0) {
                contextParts.push(`Current Lorebook Agent (All Active Entries):\n${agentEntries.join('\n\n')}`);
            }
        }
    } catch { /* lorebook agent entries may not be loadable */ }

    // 7. Current game state (memo) — full state for rich context
    try {
        if (s.currentMemo) {
            contextParts.push(`Current Game State:\n${memoForGmContext(s.currentMemo).substring(0, 2000)}`);
        }
    } catch { /* ignore */ }

    // 8. Last 5 messages from chat
    try {
        if (ctx.chat && Array.isArray(ctx.chat)) {
            const filteredMsgs = ctx.chat.filter(m => !m.is_system && m.mes && m.mes.trim());
            const lastMsgs = filteredMsgs.slice(-5);
            if (lastMsgs.length > 0) {
                const msgText = lastMsgs.map(m => `${m.name || (m.is_user ? 'User' : 'Character')}: ${m.mes}`).join('\n\n');
                contextParts.push(`Recent Chat Context (Last 5 Messages):\n${msgText.substring(0, 12000)}`);
            }
        }
    } catch { /* ignore */ }

    const systemPrompt = (s.portraitCharacterSystemPrompt || '')
        .replace(/\{\{name\}\}/g, entityName)
        .replace(/\{\{wordtarget\}\}/g, String(s.portraitPromptWordTarget || 200));

    const userPrompt = contextParts.join('\n\n---\n\n');

    const result = await sendStateRequest(getPortraitConnectionSettings(s), systemPrompt, userPrompt);
    return (result || '').trim();
}

/**
 * Generates a portrait prompt specifically for an NPC lorebook entry.
 * Unlike generatePortraitPrompt() which scans CHARACTER/PARTY/COMBAT blocks,
 * this receives the NPC's lorebook entry content directly.
 * @param {string} entityName - The NPC's display name
 * @param {string} npcContent - The full lorebook entry content for this NPC
 * @returns {Promise<string>} The generated image prompt text
 */
export async function generateNpcPortraitPrompt(entityName, npcContent) {
    const s = getSettings();
    const ctx = SillyTavern.getContext();

    let contextParts = [`NPC Name: ${entityName}`];

    // 1. NPC lorebook entry content (primary source)
    if (npcContent && npcContent.trim()) {
        contextParts.push(`NPC Lorebook Entry:\n${npcContent.trim()}`);
    }

    // 2. Persona — for art style context
    try {
        const persona = ctx.substituteParams?.('{{persona}}') || '';
        if (persona.trim()) {
            contextParts.push(`User Persona (for art style context):\n${persona.trim()}`);
        }
    } catch { /* substituteParams may not exist */ }

    // 3. Character card description — for setting/world context
    try {
        const charId = ctx.characterId;
        const charData = ctx.characters?.[charId];
        if (charData?.description) {
            contextParts.push(`Narrator Card Description (for world context):\n${charData.description.substring(0, 1500)}`);
        }
    } catch { /* ignore */ }

    // 4. Last 3 chat messages for scene context
    try {
        if (ctx.chat && Array.isArray(ctx.chat)) {
            const filteredMsgs = ctx.chat.filter(m => !m.is_system && m.mes && m.mes.trim());
            const lastMsgs = filteredMsgs.slice(-3);
            if (lastMsgs.length > 0) {
                const msgText = lastMsgs.map(m => `${m.name || (m.is_user ? 'User' : 'Character')}: ${m.mes}`).join('\n\n');
                contextParts.push(`Recent Scene Context:\n${msgText.substring(0, 4000)}`);
            }
        }
    } catch { /* ignore */ }

    const systemPrompt = (s.portraitNpcSystemPrompt || '')
        .replace(/\{\{name\}\}/g, entityName)
        .replace(/\{\{wordtarget\}\}/g, String(s.portraitPromptWordTarget || 200));

    const userPrompt = contextParts.join('\n\n---\n\n');

    const result = await sendStateRequest(getPortraitConnectionSettings(s), systemPrompt, userPrompt);
    return (result || '').trim();
}


/**
 * Shows the generated prompt in an editable popup with Copy + Generate options.
 * @param {string} prompt
 * @param {string} entityName
 * @param {function} localApply - callback to apply a portrait URL
 * @param {function} refresh - callback to refresh the view
 */
export async function showPortraitPromptPopup(prompt, entityName, localApply, refresh) {
    const ctx = SillyTavern.getContext();
    const s = getSettings();
    if (!ctx.callGenericPopup) return;

    const isNative = s.portraitGeneratorSource === 'native';
    const subText = isNative
        ? 'Edit the prompt below, then copy it or generate directly with the ST Image Generation extension'
        : 'Edit the prompt below, then copy it or generate directly with Pollinations.ai';

    const textareaId = `rt-ai-prompt-${Date.now()}`;
    const skipCheckboxId = `rt-skip-prompt-${Date.now()}`;
    const popupContent = `<div style="padding:10px;min-width:320px;max-width:500px;">
        <b style="display:block;margin-bottom:8px;">🤖 AI Portrait Prompt — ${escapeHtml(entityName)}</b>
        <div style="font-size:0.8em;opacity:0.6;margin-bottom:8px;">${escapeHtml(subText)}</div>
        <textarea id="${textareaId}" style="width:100%;min-height:120px;resize:vertical;font-size:0.9em;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:inherit;box-sizing:border-box;">${escapeHtml(prompt)}</textarea>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8em;margin-top:8px;cursor:pointer;user-select:none;opacity:0.8;">
            <input id="${skipCheckboxId}" type="checkbox" style="margin:0;cursor:pointer;"/>
            Don't show this dialog again (Auto-Generate & Auto-Apply)
        </label>
    </div>`;

    const popupOpts = {
        okButton: isNative ? '🎨 Generate with ST Image Gen' : '🎨 Generate with Pollinations',
        cancelButton: 'Cancel',
        wide: false,
        customButtons: [
            { text: '📋 Copy Prompt', result: 3, classes: ['menu_button'] },
        ],
    };

    let finalPrompt = prompt;
    let skipChecked = false;
    setTimeout(() => {
        const ta = /** @type {HTMLTextAreaElement|null} */ (document.getElementById(textareaId));
        if (ta) {
            ta.addEventListener('input', () => { finalPrompt = ta.value; });
            ta.focus();
            ta.setSelectionRange(ta.value.length, ta.value.length);
        }
        const chk = /** @type {HTMLInputElement|null} */ (document.getElementById(skipCheckboxId));
        if (chk) {
            chk.addEventListener('change', () => { skipChecked = chk.checked; });
        }
    }, 0);

    const result = await ctx.callGenericPopup(popupContent, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', popupOpts);

    if (result === 3) {
        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(finalPrompt);
            toastr['success']('Portrait prompt copied to clipboard.', 'RPG Tracker');
        } catch {
            toastr['warning']('Could not copy to clipboard.', 'RPG Tracker');
        }
    } else if (result) {
        if (skipChecked) {
            s.portraitSkipPromptDialog = true;
            $('#rpg_tracker_portrait_skip_prompt').prop('checked', true);
            saveSettings();
        }
        if (isNative) {
            await generateWithNativeExtension(finalPrompt, entityName, localApply, refresh);
        } else {
            // Generate with Pollinations
            await generateWithPollinations(finalPrompt, entityName, localApply, refresh);
        }
    }
}

/**
 * Direct image generation backend helper. Generates the image based on settings source.
 * @param {string} prompt
 * @param {string} entityName
 * @returns {Promise<string>} data URL or image relative URL
 */
export async function generatePortraitDirect(prompt, entityName) {
    const s = getSettings();
    const isNative = s.portraitGeneratorSource === 'native';

    if (isNative) {
        const { SlashCommandParser } = SillyTavern.getContext();
        const hasImagine = SlashCommandParser && SlashCommandParser.commands && SlashCommandParser.commands['imagine'];
        if (!hasImagine) {
            throw new Error('ST Image Generation extension is not enabled. Please enable it in SillyTavern settings.');
        }
        const parser = new SlashCommandParser();
        const escapedPrompt = prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const command = `/imagine quiet=true gallery=false "${escapedPrompt}"`;
        const closure = parser.parse(command);
        const result = await closure.execute();
        if (result && result.isError) {
            throw new Error(result.errorMessage || 'ST Image Generation execution failed');
        }
        const imageUrl = result && result.pipe;
        if (!imageUrl) {
            throw new Error('No image URL returned from the ST Image Generation extension');
        }
        return imageUrl;
    } else {
        const apiKey = await ensurePollinationsKey();
        if (!apiKey) throw new Error('Pollinations API key is required');

        const currentModel = s.pollinationsModel || 'flux';
 
        const doRequest = async (modelName) => {
            // Do not pass width/height — keep the model's native output resolution.
            const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?key=${apiKey}&model=${modelName}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout
            
            let resp;
            try {
                resp = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
            } catch (err) {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') {
                    throw new Error('Pollinations request timed out after 20 seconds');
                }
                throw err;
            }

            if (!resp.ok) {
                const errText = await resp.text().catch(() => 'Unknown error');
                throw new Error(`Pollinations ${resp.status}: ${errText.substring(0, 300)}`);
            }
            
            const blob = await resp.blob();
            if (!blob || blob.size === 0) {
                throw new Error('Received empty image blob from Pollinations API');
            }
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        resolve(reader.result);
                    } else {
                        reject(new Error('Failed to read image as Base64 string'));
                    }
                };
                reader.onerror = () => reject(new Error('FileReader error while converting image blob'));
                reader.readAsDataURL(blob);
            });
        };

        try {
            return await doRequest(currentModel);
        } catch (err) {
            console.warn(`[RPG Tracker] Generation failed for model "${currentModel}": ${err.message}. Trying fallback models...`);
            
            // If the custom model failed and it wasn't 'flux', try 'flux'
            if (currentModel !== 'flux') {
                try {
                    return await doRequest('flux');
                } catch (fallbackErr) {
                    console.warn(`[RPG Tracker] Fallback to "flux" failed: ${fallbackErr.message}. Trying "turbo"...`);
                }
            }
            
            // Try 'turbo' (highly available SDXL model on Pollinations.ai)
            try {
                return await doRequest('turbo');
            } catch (turboErr) {
                throw new Error(`All model options failed. Original error: ${err.message}`);
            }
        }
    }
}

/**
 * Ensures the user has a Pollinations API key set. If not, shows an entry popup.
 * @returns {Promise<string|null>} The API key, or null if the user cancels
 */
export async function ensurePollinationsKey() {
    const s = getSettings();
    if (s.pollinationsApiKey) return s.pollinationsApiKey;

    const ctx = SillyTavern.getContext();
    if (!ctx.callGenericPopup) return null;

    const inputId = `rt-pollinations-key-${Date.now()}`;
    const popupContent = `<div style="padding:10px;min-width:300px;">
        <b style="display:block;margin-bottom:8px;">🔑 Pollinations API Key Required</b>
        <div style="font-size:0.85em;opacity:0.75;margin-bottom:10px;line-height:1.5;">
            <b>Why Pollinations?</b> Pollinations.ai offers image generation models (like Flux and ZImage) via API keys linked to a GitHub account. It operates on a pay-as-you-go / quest system.
            <br><br>
            All you need is a <b>GitHub account</b> to generate a permanent API key.
            <br><br>
            Get your key at:<br>
            <a href="https://enter.pollinations.ai/#keys" target="_blank" style="color:#7ec8e3;font-weight:bold;">🔗 enter.pollinations.ai/#keys</a>
        </div>
        <input id="${inputId}" type="password" class="text_pole" placeholder="Paste your API key here (sk_… or pk_…)" style="width:100%;box-sizing:border-box;"/>
    </div>`;

    let keyValue = '';
    setTimeout(() => {
        const inp = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));
        if (inp) {
            inp.addEventListener('input', () => { keyValue = inp.value.trim(); });
            inp.focus();
        }
    }, 0);

    const result = await ctx.callGenericPopup(popupContent, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', {
        okButton: 'Save & Continue',
        cancelButton: 'Cancel',
        wide: false,
    });

    if (result && keyValue) {
        s.pollinationsApiKey = keyValue;
        // Also update the settings panel input if visible
        $('#rpg_tracker_pollinations_key').val(keyValue);
        saveSettings();
        return keyValue;
    }
    return null;
}

/**
 * Generates an image via Pollinations.ai and shows the preview/approve popup.
 * @param {string} prompt
 * @param {string} entityName
 * @param {function} localApply
 * @param {function} refresh
 */
export async function generateWithPollinations(prompt, entityName, localApply, refresh) {
    const s = getSettings();
    const ctx = SillyTavern.getContext();
    if (!ctx.callGenericPopup) return;

    let currentModel = s.pollinationsModel || 'flux';

    const showPreview = async (preGeneratedUrl = null) => {
        const modelOptions = POLLINATIONS_IMAGE_MODELS.map(m => {
            const sel = m.id === currentModel ? 'selected' : '';
            return `<option value="${m.id}" ${sel}>${m.label} (${m.tier})</option>`;
        }).join('');

        const selectId = `rt-poll-model-${Date.now()}`;
        const imgId = `rt-poll-img-${Date.now()}`;
        const spinnerId = `rt-poll-spinner-${Date.now()}`;
        const errorId = `rt-poll-error-${Date.now()}`;

        // Fire generation immediately or use pre-generated/cropped URL
        const genPromise = preGeneratedUrl ? Promise.resolve(preGeneratedUrl) : generatePortraitDirect(prompt, entityName);
        genPromise.then(dataUrl => {
            const img = document.getElementById(imgId);
            const spinner = document.getElementById(spinnerId);
            if (img) { img.src = dataUrl; img.style.display = 'block'; }
            if (spinner) spinner.style.display = 'none';
        }).catch(err => {
            const spinner = document.getElementById(spinnerId);
            const errEl = document.getElementById(errorId);
            if (spinner) spinner.style.display = 'none';
            if (errEl) { errEl.textContent = `⚠ ${err.message}`; errEl.style.display = 'block'; }
        });

        const popupContent = `<div style="padding:10px;min-width:320px;max-width:460px;">
            <b style="display:block;margin-bottom:8px;">🖼️ Generated Portrait — ${escapeHtml(entityName)}</b>
            <div style="position:relative;text-align:center;margin-bottom:10px;min-height:200px;">
                <div id="${spinnerId}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:0.9em;opacity:0.6;">
                    <i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Generating image…
                </div>
                <img id="${imgId}" style="max-width:100%;max-height:400px;border-radius:8px;display:none;margin:0 auto;" />
                <div id="${errorId}" style="display:none;color:#ff6b6b;font-size:0.9em;margin-top:10px;"></div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <label style="font-size:0.82em;opacity:0.8;white-space:nowrap;">Model:</label>
                <select id="${selectId}" class="text_pole" style="flex:1;font-size:0.85em;">${modelOptions}</select>
            </div>
            <div style="font-size:0.72em;opacity:0.45;margin-top:2px;">Prompt: ${escapeHtml(prompt.substring(0, 100))}${prompt.length > 100 ? '…' : ''}</div>
        </div>`;

        const popupOpts = {
            okButton: '✅ Apply Portrait', cancelButton: 'Cancel', wide: false,
            customButtons: [
                { text: '🔄 Regenerate', result: 3, classes: ['menu_button'] },
                { text: '✂️ Crop', result: 4, classes: ['menu_button'] }
            ],
        };

        setTimeout(() => {
            const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById(selectId));
            if (sel) sel.addEventListener('change', () => { currentModel = sel.value; s.pollinationsModel = currentModel; saveSettings(); });
        }, 0);

        const result = await ctx.callGenericPopup(popupContent, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', popupOpts);

        if (result === 3) {
            await showPreview(); // Regenerate
        } else if (result === 4) {
            // Crop button clicked
            try {
                const dataUrl = await genPromise;
                const cropped = await ctx.callGenericPopup(
                    'Set the crop position of the portrait',
                    ctx.POPUP_TYPE?.CROP ?? 4,
                    '',
                    { cropImage: dataUrl, cropAspect: 1 }
                );
                if (cropped) {
                    await showPreview(cropped);
                } else {
                    await showPreview(dataUrl);
                }
            } catch (err) {
                toastr['error']('Cannot crop — generation failed: ' + err.message, 'RPG Tracker');
                await showPreview();
            }
        } else if (result) {
            // Wait for generation to finish, then scale and apply directly
            try {
                const dataUrl = await genPromise;
                const finalUrl = dataUrl.startsWith('data:') ? await scaleImageTo512Square(dataUrl) : dataUrl;
                await localApply(finalUrl);
                if (typeof refresh === 'function') refresh();
                imageGenToast('success', `Portrait applied for ${entityName}!`, 'RPG Tracker');
            } catch (err) {
                toastr['error']('Cannot apply — generation failed: ' + err.message, 'RPG Tracker');
            }
        }
    };

    await showPreview();
}

/**
 * Generates an image via the native SillyTavern Image Generation extension and shows a preview/approve popup.
 * @param {string} prompt
 * @param {string} entityName
 * @param {function} localApply
 * @param {function} refresh
 */
export async function generateWithNativeExtension(prompt, entityName, localApply, refresh) {
    const ctx = SillyTavern.getContext();
    if (!ctx.callGenericPopup) return;

    const showPreview = async (preGeneratedUrl = null) => {
        const imgId = `rt-native-img-${Date.now()}`;
        const spinnerId = `rt-native-spinner-${Date.now()}`;
        const errorId = `rt-native-error-${Date.now()}`;

        // Fire generation immediately or use pre-generated/cropped URL
        const genPromise = preGeneratedUrl ? Promise.resolve(preGeneratedUrl) : generatePortraitDirect(prompt, entityName);
        genPromise.then(imageUrl => {
            const img = document.getElementById(imgId);
            const spinner = document.getElementById(spinnerId);
            if (img) { img.src = imageUrl; img.style.display = 'block'; }
            if (spinner) spinner.style.display = 'none';
        }).catch(err => {
            const spinner = document.getElementById(spinnerId);
            const errEl = document.getElementById(errorId);
            if (spinner) spinner.style.display = 'none';
            if (errEl) { errEl.textContent = `⚠ ${err.message}`; errEl.style.display = 'block'; }
        });

        const popupContent = `<div style="padding:10px;min-width:320px;max-width:460px;">
            <b style="display:block;margin-bottom:8px;">🖼️ Generated Portrait — ${escapeHtml(entityName)}</b>
            <div style="position:relative;text-align:center;margin-bottom:10px;min-height:200px;">
                <div id="${spinnerId}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:0.9em;opacity:0.6;">
                    <i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Generating image with native extension…
                </div>
                <img id="${imgId}" style="max-width:100%;max-height:400px;border-radius:8px;display:none;margin:0 auto;" />
                <div id="${errorId}" style="display:none;color:#ff6b6b;font-size:0.9em;margin-top:10px;"></div>
            </div>
            <div style="font-size:0.72em;opacity:0.45;margin-top:2px;">Prompt: ${escapeHtml(prompt.substring(0, 100))}${prompt.length > 100 ? '…' : ''}</div>
        </div>`;

        const popupOpts = {
            okButton: '✅ Apply Portrait', cancelButton: 'Cancel', wide: false,
            customButtons: [
                { text: '🔄 Regenerate', result: 3, classes: ['menu_button'] },
                { text: '✂️ Crop', result: 4, classes: ['menu_button'] }
            ],
        };

        const result = await ctx.callGenericPopup(popupContent, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', popupOpts);

        if (result === 3) {
            await showPreview(); // Regenerate
        } else if (result === 4) {
            // Crop button clicked
            try {
                const imageUrl = await genPromise;
                const cropped = await ctx.callGenericPopup(
                    'Set the crop position of the portrait',
                    ctx.POPUP_TYPE?.CROP ?? 4,
                    '',
                    { cropImage: imageUrl, cropAspect: 1 }
                );
                if (cropped) {
                    await showPreview(cropped);
                } else {
                    await showPreview(imageUrl);
                }
            } catch (err) {
                toastr['error']('Cannot crop — generation failed: ' + err.message, 'RPG Tracker');
                await showPreview();
            }
        } else if (result) {
            // Wait for generation to finish, then scale and apply
            try {
                const imageUrl = await genPromise;
                const finalUrl = imageUrl.startsWith('data:') ? await scaleImageTo512Square(imageUrl) : imageUrl;
                await localApply(finalUrl);
                if (typeof refresh === 'function') refresh();
                imageGenToast('success', `Portrait applied for ${entityName}!`, 'RPG Tracker');
            } catch (err) {
                toastr['error']('Cannot apply — generation failed: ' + err.message, 'RPG Tracker');
            }
        }
    };

    await showPreview();
}

/**
 * Scans the current [CHARACTER] block in state memo for character names.
 * Uses the same HP-line and plain-name parsing as party/enemy scanners.
 * @param {object} [settings]
 * @returns {string[]}
 */
export function getCharacterBlockNames(settings) {
    const s = settings || getSettings();
    if (!s.currentMemo) return [];
    const blocks = parseMemoBlocks(s.currentMemo);
    const charBlock = blocks['CHARACTER'] || '';
    const names = [];
    for (const line of charBlock.split('\n')) {
        const cleanLine = line.trim().replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        if (!cleanLine) continue;
        const hpMatch = cleanLine.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP/i);
        if (hpMatch) {
            names.push(hpMatch[1].trim());
            continue;
        }
        if (names.length === 0) {
            const plainNameColonMatch = cleanLine.match(/^(.+?):\s*(.*)/);
            if (plainNameColonMatch) {
                if (plainNameColonMatch[1].trim().toLowerCase() === 'name') {
                    names.push(plainNameColonMatch[2].trim());
                } else {
                    names.push(plainNameColonMatch[1].trim());
                }
            } else {
                names.push(cleanLine);
            }
        }
    }
    return names.filter(Boolean);
}

/** @param {object} [settings] @returns {string|null} */
export function getPrimaryCharacterBlockName(settings) {
    const names = getCharacterBlockNames(settings);
    return names[0] || null;
}

/**
 * Resolve a portrait for the Lorebook Agent PC card by checking the linked PC name
 * and any [CHARACTER] block name(s) in the state memo (alias / inheritance).
 * @param {object} [settings]
 * @param {string} [pcName]
 * @returns {string} display-ready src or ''
 */
export function resolvePortraitSrcForPlayerCharacter(settings, pcName) {
    const s = settings || getSettings();
    const candidates = [];
    if (pcName) candidates.push(pcName);
    for (const memoName of getCharacterBlockNames(s)) {
        if (!candidates.some(c => normalizeCharacterLabel(c) === normalizeCharacterLabel(memoName))) {
            candidates.push(memoName);
        }
    }
    for (const name of candidates) {
        const src = lookupCustomPortraitSrc(s, name);
        if (src) return src;
    }
    return '';
}

/**
 * Scans the current PARTY block in state memo for member names.
 * @returns {string[]} list of party member names
 */
export function getPartyMembers() {
    const s = getSettings();
    if (!s.currentMemo) return [];
    const blocks = parseMemoBlocks(s.currentMemo);
    const partyBlock = blocks['PARTY'];
    if (!partyBlock) return [];

    const lines = partyBlock.split('\n').map(l => l.trim()).filter(Boolean);
    const partyMembers = [];
    for (const line of lines) {
        // Strip leading bullet markers before parsing
        const cleanLine = line.replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        // Match "Name: X/Y HP"
        const hpMatch = cleanLine.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP/i);
        if (hpMatch) {
            partyMembers.push(hpMatch[1].trim());
        }
    }
    return partyMembers;
}

/**
 * Queue background portrait auto-generation for the [CHARACTER] block name when enabled.
 * @param {object} settings
 * @param {function} refresh
 * @param {{ seedKnownOnly?: boolean }} [opts]
 */
function seedPlayerCharacterKnownEntities(settings) {
    const charName = getPrimaryCharacterBlockName(settings);
    if (charName) knownEntities.add(charName.toUpperCase());
    const pc = getLinkedPlayerCharacter(settings);
    if (pc) knownEntities.add(pc.name.toUpperCase());
}

function triggerPlayerPortraitAutoGenIfNeeded(settings, refresh, opts = {}) {
    if (!settings.portraitAutoGeneratePlayer || settings.enablePortraits === false) return;
    const charName = getPrimaryCharacterBlockName(settings);
    if (!charName) return;
    if (opts.seedKnownOnly) {
        seedPlayerCharacterKnownEntities(settings);
        return;
    }
    seedPlayerCharacterKnownEntities(settings);
    triggerBackgroundPortraitGeneration(charName, refresh);
}

/**
 * Sequentially auto-generates and auto-applies portraits for all party members and the player character.
 * Skips those who already have portraits.
 * @param {function} refresh - callback to refresh the UI
 */
export async function autoGeneratePartyPortraits(refresh) {
    const s = getSettings();
    if (!s.currentMemo) {
        toastr['warning']('No live state memo found.', 'RPG Tracker');
        return;
    }

    const blocks = parseMemoBlocks(s.currentMemo);
    const namesSet = new Set();
    
    // Include player character (from CHARACTER block)
    const charBlock = blocks['CHARACTER'] || '';
    for (const line of charBlock.split('\n')) {
        const cleanLine = line.trim().replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        const hpMatch = cleanLine.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP/i);
        if (hpMatch) namesSet.add(hpMatch[1].trim());
    }

    // Include party members
    const partyBlock = blocks['PARTY'] || '';
    for (const line of partyBlock.split('\n')) {
        const cleanLine = line.trim().replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        const hpMatch = cleanLine.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP/i);
        if (hpMatch) namesSet.add(hpMatch[1].trim());
    }

    const partyMembers = Array.from(namesSet);
    if (partyMembers.length === 0) {
        toastr['warning']('No party members or characters found in the current state memo.', 'RPG Tracker');
        return;
    }

    // Filter out those who already have a portrait
    const toGenerate = partyMembers.filter(name => !hasPortrait(name));
    if (toGenerate.length === 0) {
        imageGenToast('info', 'All party members and characters already have portraits.', 'RPG Tracker');
        return;
    }

    imageGenToast('info', `Starting auto-generation for ${toGenerate.length} party members...`, 'RPG Tracker');
    let successCount = 0;

    for (const name of toGenerate) {
        imageGenToast('info', `Generating for ${name}...`, 'RPG Tracker');
        try {
            const prompt = await generatePortraitPrompt(name);
            const dataUrl = await generatePortraitDirect(prompt, name);
            const scaled = await scaleImageTo512Square(dataUrl);
            await applyPortraitData(name, scaled);
            successCount++;
            if (typeof refresh === 'function') refresh();
        } catch (err) {
            toastr['error'](`Failed for ${name}: ${err.message}`, 'RPG Tracker');
        }
    }

    if (successCount > 0) {
        imageGenToast('success', `Finished! Applied ${successCount} party portraits.`, 'RPG Tracker');
    }
}

/**
 * Sequentially auto-generates and auto-applies portraits for all enemies (COMBAT block).
 * Skips enemies who already have portraits.
 * @param {function} refresh - callback to refresh the UI
 */
export async function autoGenerateEnemyPortraits(refresh) {
    const enemies = getEnemyEntities();
    if (enemies.length === 0) {
        toastr['warning']('No enemies found in the current COMBAT block.', 'RPG Tracker');
        return;
    }

    // Filter out those who already have a portrait
    const toGenerate = enemies.filter(name => !hasPortrait(name));
    if (toGenerate.length === 0) {
        imageGenToast('info', 'All enemies already have portraits.', 'RPG Tracker');
        return;
    }

    imageGenToast('info', `Starting auto-generation for ${toGenerate.length} enemies...`, 'RPG Tracker');
    let successCount = 0;

    for (const name of toGenerate) {
        imageGenToast('info', `Generating for enemy ${name}...`, 'RPG Tracker');
        try {
            const prompt = await generatePortraitPrompt(name);
            const dataUrl = await generatePortraitDirect(prompt, name);
            const scaled = await scaleImageTo512Square(dataUrl);
            await applyPortraitData(name, scaled);
            successCount++;
            if (typeof refresh === 'function') refresh();
        } catch (err) {
            toastr['error'](`Failed for enemy ${name}: ${err.message}`, 'RPG Tracker');
        }
    }

    if (successCount > 0) {
        imageGenToast('success', `Finished! Applied ${successCount} enemy portraits.`, 'RPG Tracker');
    }
}

/**
 * Removes all custom portraits from the settings.
 * @param {function} refresh - callback to refresh the UI
 */
export async function removeAllPortraits(refresh) {
    const s = getSettings();
    await purgeAllPortraitData(s);
    await saveSettings(true);
    toastr['success']('All custom portraits removed (including saved chat copies).', 'RPG Tracker');
    if (typeof refresh === 'function') refresh();
}

// Keep track of names currently generating to avoid duplicate requests
const activeGenerations = new Set();

/**
 * Single shared queue for all auto image gens (portraits + locations).
 * ComfyUI / native image gen cannot handle a combat batch firing in parallel —
 * enqueue jobs and run them one at a time.
 * @type {Array<() => Promise<void>>}
 */
const _imageGenQueue = [];
let _imageGenQueueRunning = false;

async function _drainImageGenQueue() {
    if (_imageGenQueueRunning) return;
    _imageGenQueueRunning = true;
    try {
        while (_imageGenQueue.length > 0) {
            const job = _imageGenQueue.shift();
            try {
                await job();
            } catch (err) {
                console.error('[RPG Tracker] Image gen queue job failed:', err);
            }
        }
    } finally {
        _imageGenQueueRunning = false;
        // A job may have enqueued more work while we were finishing.
        if (_imageGenQueue.length > 0) void _drainImageGenQueue();
    }
}

/** @param {() => Promise<void>} job */
function enqueueImageGen(job) {
    _imageGenQueue.push(job);
    void _drainImageGenQueue();
}

/**
 * Checks if a custom portrait already exists for the given entity name.
 * @param {string} name
 * @returns {boolean}
 */
export function hasPortrait(name) {
    const s = getSettings();
    const normName = normalizeEntityName(name);
    return !!(s.customPortraits && s.customPortraits[normName]);
}

/**
 * Scans the current COMBAT block in state memo for combatants who are not party members or characters.
 * @returns {string[]} list of enemy names
 */
export function getEnemyEntities() {
    const s = getSettings();
    if (!s.currentMemo) return [];
    const blocks = parseMemoBlocks(s.currentMemo);
    
    // Gather all party/character names to exclude
    const excludeNames = new Set();
    const partyMembers = getPartyMembers();
    for (const name of partyMembers) {
        excludeNames.add(name.toUpperCase());
    }
    
    const charBlock = blocks['CHARACTER'] || '';
    for (const line of charBlock.split('\n')) {
        const cleanLine = line.trim().replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        const hpMatch = cleanLine.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP/i);
        if (hpMatch) excludeNames.add(hpMatch[1].trim().toUpperCase());
    }

    const combatBlock = blocks['COMBAT'] || '';
    const lines = combatBlock.split('\n').map(l => l.trim()).filter(Boolean);
    const enemies = [];
    for (const line of lines) {
        if (/Combat Round\s*\d+/i.test(line)) continue;
        const cleanLine = line.replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        const hpMatch = cleanLine.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP/i);
        if (hpMatch) {
            const name = hpMatch[1].trim();
            if (!excludeNames.has(name.toUpperCase())) {
                enemies.push(name);
            }
        }
    }
    return enemies;
}

/**
 * Queues background portrait generation for a name (sequential — one image at a time).
 * Does not block the main execution flow; jobs share a global ComfyUI-safe queue.
 * @param {string} name
 * @param {function} refresh - callback to refresh the UI on success
 */
export function triggerBackgroundPortraitGeneration(name, refresh, npcContent = null) {
    const alreadyHas = hasPortrait(name);
    const alreadyGenerating = activeGenerations.has(name);
    console.log(`[RPG Tracker] triggerBackgroundPortraitGeneration for "${name}". alreadyHasPortrait:`, alreadyHas, `alreadyGenerating:`, alreadyGenerating);
    if (alreadyHas) return;
    if (alreadyGenerating) return;

    activeGenerations.add(name);
    const queuePos = _imageGenQueue.length + (_imageGenQueueRunning ? 1 : 0);
    if (queuePos <= 0) {
        imageGenToast('info', `Auto-generating portrait for ${name}...`, 'RPG Tracker');
    } else {
        imageGenToast('info', `Queued portrait for ${name} (${queuePos} ahead)...`, 'RPG Tracker');
    }

    enqueueImageGen(async () => {
        try {
            console.log(`[RPG Tracker] Generating prompt for "${name}" (NPC content provided: ${!!npcContent})`);
            const prompt = npcContent
                ? await generateNpcPortraitPrompt(name, npcContent)
                : await generatePortraitPrompt(name);
            console.log(`[RPG Tracker] Generated prompt for "${name}":`, prompt);
            if (!prompt) {
                console.warn(`[RPG Tracker] Could not generate prompt for ${name} - no context found.`);
                return;
            }
            console.log(`[RPG Tracker] Calling generatePortraitDirect for "${name}"...`);
            const dataUrl = await generatePortraitDirect(prompt, name);
            console.log(`[RPG Tracker] Successfully received portrait dataUrl for "${name}". Scaling...`);
            const scaled = await scaleImageTo512Square(dataUrl);
            console.log(`[RPG Tracker] Applying portrait data for "${name}"...`);
            await applyPortraitData(name, scaled);
            imageGenToast('success', `Portrait auto-generated and applied for ${name}!`, 'RPG Tracker');
            if (typeof refresh === 'function') {
                console.log(`[RPG Tracker] Triggering UI refresh callback...`);
                refresh();
            }
        } catch (err) {
            console.error(`[RPG Tracker] Background portrait generation failed for ${name}:`, err);
            const errMsg = String(err.message || err);
            const is524 = errMsg.includes('524') || errMsg.includes('timeout') || errMsg.includes('Upstream');
            if (is524) {
                toastr['warning'](
                    `Portrait generation for "${name}" failed: LLM connection timed out (524). The portrait prompt is written by your main LLM model — check your State Tracker connection settings and ensure it is online.`,
                    'RPG Tracker',
                    { timeOut: 8000 }
                );
            } else {
                toastr['error'](`Portrait generation failed for "${name}": ${errMsg.substring(0, 120)}`, 'RPG Tracker');
            }
        } finally {
            activeGenerations.delete(name);
            console.log(`[RPG Tracker] Removed "${name}" from activeGenerations. Remaining:`, Array.from(activeGenerations));
        }
    });
}

// Track entities already in the party/combat to avoid auto-generating on page refresh (F5)
const knownEntities = new Set();
let isFirstCheck = true;

/**
 * Resets the session-known tracking state.
 * Called when switching chats or starting a new session.
 */
export function resetAutoGenerationTracking() {
    console.log('[RPG Tracker] resetAutoGenerationTracking called. Clearing knownEntities and resetting isFirstCheck to true.');
    knownEntities.clear();
    isFirstCheck = true;
    _lastMemoEntitySnapshot = null;
}

/**
 * Force checks auto-generation for all active party members or enemies, bypassing the newly-added check.
 * Used when the user explicitly enables auto-generation options in the settings panel.
 * @param {function} refresh - callback to refresh the UI
 */
export async function forceCheckAutoGenerations(refresh) {
    const s = getSettings();
    console.log('[RPG Tracker] forceCheckAutoGenerations called. Settings enablePortraits:', s.enablePortraits);
    if (s.enablePortraits === false) return;

    if (s.portraitAutoGenerateParty) {
        const party = getPartyMembers();
        console.log('[RPG Tracker] forceCheckAutoGenerations: checking party:', party);
        for (const name of party) {
            knownEntities.add(name.toUpperCase());
            triggerBackgroundPortraitGeneration(name, refresh);
        }
    }

    triggerPlayerPortraitAutoGenIfNeeded(s, refresh);

    if (s.portraitAutoGenerateEnemies) {
        const enemies = getEnemyEntities();
        console.log('[RPG Tracker] forceCheckAutoGenerations: checking enemies:', enemies);
        for (const name of enemies) {
            knownEntities.add(name.toUpperCase());
            triggerBackgroundPortraitGeneration(name, refresh);
        }
    }

    if (s.portraitAutoGenerateNpcs && s.npcPortraits !== false) {
        const ctx = SillyTavern.getContext();
        console.log('[RPG Tracker] forceCheckAutoGenerations: checking NPCs. chatId:', ctx.chatId);
        if (ctx.chatId) {
            const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId);
            const bookName = prefix ? `${prefix}_NPCs` : 'NPCs';
            console.log('[RPG Tracker] forceCheckAutoGenerations: bookName:', bookName);
            try {
                if (typeof ctx.updateWorldInfoList === 'function') {
                    console.log('[RPG Tracker] forceCheckAutoGenerations: updating world info list...');
                    await ctx.updateWorldInfoList();
                }
                const book = await ctx.loadWorldInfo(bookName);
                if (book && book.entries) {
                    const entries = Object.values(book.entries);
                    console.log('[RPG Tracker] forceCheckAutoGenerations: loaded book entries count:', entries.length);
                    for (const entry of entries) {
                        const name = (entry.comment || '').trim();
                        if (name) {
                            console.log('[RPG Tracker] forceCheckAutoGenerations: forcing NPC:', name);
                            knownEntities.add(name.toUpperCase());
                            triggerBackgroundPortraitGeneration(name, refresh, entry.content || '');
                        }
                    }
                } else {
                    console.log('[RPG Tracker] forceCheckAutoGenerations: book not found or empty:', bookName);
                }
            } catch (e) {
                console.error('[RPG Tracker] forceCheckAutoGenerations NPC check error:', e);
            }
        }
    }

    if (s.portraitAutoGenerateLocations && !s.portraitAutoGenerateSceneView && s.locationImages) {
        const locEntries = await loadLocationLorebookEntries();
        for (const entry of locEntries) {
            const path = normalizeLocationPath(entry.label);
            knownEntities.add(`LOC::${path.toUpperCase()}`);
            triggerBackgroundLocationGeneration(path, refresh, entry.content);
        }
    }
}

/**
 * Checks if auto-generation is enabled and triggers it ONLY for newly added entities (not in knownEntities).
 * @param {function} refresh - callback to refresh the UI when done
 */
export async function checkAndTriggerAutoGenerations(refresh) {
    const s = getSettings();
    console.log('[RPG Tracker] checkAndTriggerAutoGenerations invoked. enablePortraits:', s.enablePortraits, 'isFirstCheck:', isFirstCheck);
    if (s.enablePortraits === false) {
        console.log('[RPG Tracker] checkAndTriggerAutoGenerations: enablePortraits is false. Exiting.');
        return;
    }

    // Move portrait keys for in-place memo renames before treating names as "new".
    reconcileMemoPortraitRenames();

    const currentParty = getPartyMembers();
    const currentEnemies = getEnemyEntities();
    console.log('[RPG Tracker] checkAndTriggerAutoGenerations: currentParty:', currentParty, 'currentEnemies:', currentEnemies);

    // Fetch NPCs from lorebook if option enabled
    let npcEntries = [];
    console.log('[RPG Tracker] checkAndTriggerAutoGenerations: portraitAutoGenerateNpcs settings:', s.portraitAutoGenerateNpcs);
    if (s.portraitAutoGenerateNpcs && s.npcPortraits !== false) {
        const ctx = SillyTavern.getContext();
        console.log('[RPG Tracker] checkAndTriggerAutoGenerations: ctx.chatId:', ctx.chatId);
        if (ctx.chatId) {
            const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId);
            const bookName = prefix ? `${prefix}_NPCs` : 'NPCs';
            console.log('[RPG Tracker] checkAndTriggerAutoGenerations: resolving bookName:', bookName);
            try {
                const book = await ctx.loadWorldInfo(bookName);
                if (book && book.entries) {
                    npcEntries = Object.values(book.entries).filter(e => (e.comment || '').trim());
                    console.log('[RPG Tracker] checkAndTriggerAutoGenerations: loaded npcEntries count:', npcEntries.length, npcEntries.map(e => e.comment));
                } else {
                    console.log('[RPG Tracker] checkAndTriggerAutoGenerations: no book or entries found for', bookName);
                }
            } catch (e) {
                console.error('[RPG Tracker] checkAndTriggerAutoGenerations NPC fetch error:', e);
            }
        }
    }

    // On initial startup/F5, record all existing entities as already known without generating anything
    if (isFirstCheck) {
        console.log('[RPG Tracker] checkAndTriggerAutoGenerations: isFirstCheck is true. Registering existing entities to knownEntities Set without generating.');
        isFirstCheck = false;
        for (const name of currentParty) {
            knownEntities.add(name.toUpperCase());
        }
        triggerPlayerPortraitAutoGenIfNeeded(s, refresh, { seedKnownOnly: true });
        for (const name of currentEnemies) {
            knownEntities.add(name.toUpperCase());
        }
        for (const entry of npcEntries) {
            knownEntities.add(entry.comment.trim().toUpperCase());
        }
        await checkAndTriggerLocationAutoGenerations(refresh, { isFirstCheck: true });
        console.log('[RPG Tracker] checkAndTriggerAutoGenerations: knownEntities after first check:', Array.from(knownEntities));
        return;
    }

    console.log('[RPG Tracker] checkAndTriggerAutoGenerations: Checking for new entities against known list:', Array.from(knownEntities));

    if (s.portraitAutoGenerateParty) {
        for (const name of currentParty) {
            const key = name.toUpperCase();
            if (!knownEntities.has(key)) {
                console.log('[RPG Tracker] checkAndTriggerAutoGenerations: New party member detected:', name);
                knownEntities.add(key);
                triggerBackgroundPortraitGeneration(name, refresh);
            } else {
                console.log('[RPG Tracker] checkAndTriggerAutoGenerations: Party member already known:', name);
            }
        }
    } else {
        for (const name of currentParty) {
            knownEntities.add(name.toUpperCase());
        }
    }

    if (s.portraitAutoGeneratePlayer) {
        const charName = getPrimaryCharacterBlockName(s);
        if (charName) {
            const key = charName.toUpperCase();
            if (!knownEntities.has(key)) {
                console.log('[RPG Tracker] checkAndTriggerAutoGenerations: [CHARACTER] block name detected:', charName);
                seedPlayerCharacterKnownEntities(s);
                triggerBackgroundPortraitGeneration(charName, refresh);
            }
        }
    } else {
        seedPlayerCharacterKnownEntities(s);
    }

    if (s.portraitAutoGenerateEnemies) {
        for (const name of currentEnemies) {
            const key = name.toUpperCase();
            if (!knownEntities.has(key)) {
                console.log('[RPG Tracker] checkAndTriggerAutoGenerations: New enemy detected:', name);
                knownEntities.add(key);
                triggerBackgroundPortraitGeneration(name, refresh);
            } else {
                console.log('[RPG Tracker] checkAndTriggerAutoGenerations: Enemy already known:', name);
            }
        }
    } else {
        for (const name of currentEnemies) {
            knownEntities.add(name.toUpperCase());
        }
    }

    if (s.portraitAutoGenerateNpcs && s.npcPortraits !== false) {
        for (const entry of npcEntries) {
            const name = entry.comment.trim();
            if (!hasPortrait(name)) {
                console.log('[RPG Tracker] checkAndTriggerAutoGenerations: NPC has no portrait, triggering generation:', name);
                triggerBackgroundPortraitGeneration(name, refresh, entry.content || '');
            } else {
                console.log('[RPG Tracker] checkAndTriggerAutoGenerations: NPC already has portrait, skipping:', name);
            }
        }
    } else {
        for (const entry of npcEntries) {
            knownEntities.add(entry.comment.trim().toUpperCase());
        }
    }

    await checkAndTriggerLocationAutoGenerations(refresh, { isFirstCheck: false });
}

// ── Location images (hierarchical lore paths) ─────────────────────────────────

/** Normalize a location path to `Segment :: Segment` form. */
export function normalizeLocationPath(path) {
    if (!path) return '';
    return path.split('::').map(p => p.trim()).filter(Boolean).join(' :: ');
}

/** Build a location path from an array of hierarchy segments. */
export function buildLocationPath(parts) {
    if (!Array.isArray(parts)) return normalizeLocationPath(parts);
    return parts.map(p => String(p || '').trim()).filter(Boolean).join(' :: ');
}

/**
 * Resolve a location image for the exact path only (no parent fallback).
 * @param {string} fullPath
 * @returns {{ src: string, resolvedPath: string }}
 */
export function resolveLocationImageWithMeta(fullPath) {
    const s = getSettings();
    const norm = normalizeLocationPath(fullPath);
    const src = s.customLocationImages?.[norm];
    return {
        src: src ? resolvePortraitDisplaySrc(src) : '',
        resolvedPath: norm,
    };
}

/** @param {string} normPath Normalized full path */
export function getAncestorLocationPaths(normPath) {
    const parts = normalizeLocationPath(normPath).split(' :: ').filter(Boolean);
    const ancestors = [];
    for (let i = parts.length - 1; i >= 1; i--) {
        ancestors.push(parts.slice(0, i).join(' :: '));
    }
    return ancestors;
}

/** @param {string} path */
export function resolveLocationImage(path) {
    return resolveLocationImageWithMeta(path).src;
}

/** @param {string} path */
export function hasLocationImage(path) {
    const s = getSettings();
    const norm = normalizeLocationPath(path);
    return !!(s.customLocationImages && s.customLocationImages[norm]);
}

/**
 * @param {string} locationPath Full hierarchical path
 * @param {string|null} src Image URL, data URL, managed path, or null to clear
 */
export async function applyLocationImageData(locationPath, src) {
    const s = getSettings();
    if (!s.customLocationImages) s.customLocationImages = {};
    const normPath = normalizeLocationPath(locationPath);
    const chatId = getActiveChatId();
    const previous = s.customLocationImages[normPath];
    const storageKey = `loc__${normPath}`;

    if (!src) {
        delete s.customLocationImages[normPath];
        if (previous && isManagedPortraitPath(previous) && countPortraitPathRefs(s, previous) === 0) {
            await deletePortraitFile(previous);
        }
    } else {
        const stored = await persistPortraitSrc(src, chatId, storageKey);
        s.customLocationImages[normPath] = stored;

        if (s.chatLinkEnabled && chatId && s.chatStates?.[chatId]?.customLocationImages) {
            s.chatStates[chatId].customLocationImages[normPath] = stored;
        }

        if (previous && previous !== stored && isManagedPortraitPath(previous) && countPortraitPathRefs(s, previous) === 0) {
            await deletePortraitFile(previous);
        }
    }
    await saveSettings(true);
}

/**
 * Pass through location images at native resolution (no forced downscale or re-encode).
 * Name kept for call-site compatibility; previously center-cropped to 16:9 JPEG.
 * @param {string} dataUrl
 * @returns {Promise<string>}
 */
export function scaleImageToLandscape(dataUrl) {
    return Promise.resolve(dataUrl);
}

/**
 * @returns {Promise<Map<string, { content: string }>>}
 */
async function loadLocationLorebookMap() {
    const ctx = SillyTavern.getContext();
    const map = new Map();
    if (!ctx.chatId) return map;

    const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId);
    const bookName = prefix ? `${prefix}_Locations` : 'Locations';
    try {
        if (typeof ctx.updateWorldInfoList === 'function') {
            await ctx.updateWorldInfoList();
        }
        const book = await ctx.loadWorldInfo(bookName);
        if (!book?.entries) return map;
        for (const entry of Object.values(book.entries)) {
            const label = normalizeLocationPath((entry.comment || '').trim());
            if (label) map.set(label, { content: entry.content || '' });
        }
    } catch (err) {
        console.error('[RPG Tracker] loadLocationLorebookMap error:', err);
    }
    return map;
}

/**
 * Last N narrator/assistant chat outputs (excludes user messages).
 * @param {object} ctx
 * @param {number} [count]
 * @returns {string}
 */
function formatRecentNarratorOutputs(ctx, count = 2) {
    if (!ctx?.chat?.length || count <= 0) return '';
    const outputs = [];
    for (let i = ctx.chat.length - 1; i >= 0 && outputs.length < count; i--) {
        const m = ctx.chat[i];
        if (m.is_system || m.is_user) continue;
        const text = (m.mes || m.content || '').trim();
        if (!text) continue;
        outputs.unshift(m);
    }
    if (!outputs.length) return '';
    return outputs.map(m => {
        const name = m.name || 'Narrator';
        const text = (m.mes || m.content || '').trim();
        return `${name}:\n${text}`;
    }).join('\n\n');
}

/**
 * Linked Player Character for the active chat (Campaign Records PC card).
 * @param {object} [settings]
 * @param {object} [ctx]
 * @returns {{ name: string, bio: string }|null}
 */
export function getLinkedPlayerCharacter(settings, ctx) {
    const s = settings || getSettings();
    const c = ctx || SillyTavern.getContext();
    const chatId = c.chatId || (typeof globalThis._rpgCurrentChatId === 'function' ? globalThis._rpgCurrentChatId() : null);
    if (!chatId || !s.chatStates?.[chatId]?.playerCharacter) return null;
    const pc = s.chatStates[chatId].playerCharacter;
    const name = String(pc.name || '').trim();
    if (!name) return null;
    return { name, bio: String(pc.bio || '').trim() };
}

/** @param {string} label */
function normalizeCharacterLabel(label) {
    return String(label || '').replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
}

/**
 * NPCs whose names appear in the most recent narrator output (Present-Now name scanner).
 * First/last name match only — not lorebook key[] keywords. Independent of activeRouterKeys.
 * @param {object} [settings]
 * @returns {Promise<Array<{ label: string, content: string }>>}
 */
async function loadPresentNpcsFromRecentOutput(settings) {
    const matched = await scanRecentOutputForPresentNpcs();
    return matched.map(m => ({ label: m.label, content: m.content || '' }));
}

/**
 * Player Character (always) plus NPCs present in the latest narrator output for location scene prompts.
 * @param {object} [settings]
 * @param {object} [ctx]
 * @returns {Promise<Array<{ label: string, content: string, isPlayerCharacter?: boolean }>>}
 */
async function loadPresentCharactersForLocationPrompt(settings, ctx) {
    const s = settings || getSettings();
    const c = ctx || SillyTavern.getContext();
    /** @type {Array<{ label: string, content: string, isPlayerCharacter?: boolean }>} */
    const present = [];

    const pc = getLinkedPlayerCharacter(s, c);
    if (pc) {
        present.push({
            label: `Player Character: ${pc.name}`,
            content: pc.bio || '(No PC bio — infer appearance from recent narrator output and scene context.)',
            isPlayerCharacter: true,
        });
    }

    if (s.portraitLocationIncludePresentNpcs) {
        // Fresh Present-Now name scan of the latest output — must run here so image
        // generation never uses stale Lorebook Agent active keys or broad key[] matches.
        const npcs = await loadPresentNpcsFromRecentOutput(s);
        const pcNorm = pc ? normalizeCharacterLabel(pc.name) : '';
        for (const npc of npcs) {
            if (pcNorm && normalizeCharacterLabel(npc.label) === pcNorm) continue;
            present.push(npc);
        }
    }

    return present;
}

/**
 * Generates an image prompt for a location lorebook entry.
 * Parent locations in the hierarchy are included as visual continuity guides, not substitutes.
 * @param {string} locationPath
 * @param {string} locContent
 * @returns {Promise<string>}
 */
export async function generateLocationImagePrompt(locationPath, locContent) {
    const s = getSettings();
    const ctx = SillyTavern.getContext();
    const normPath = normalizeLocationPath(locationPath);

    let contextParts = [`Location Path: ${normPath}`];
    if (locContent && locContent.trim()) {
        contextParts.push(`Location Lorebook Entry (PRIMARY — depict this specific place):\n${locContent.trim()}`);
    }

    const loreMap = await loadLocationLorebookMap();
    const ancestors = getAncestorLocationPaths(normPath);
    if (ancestors.length > 0) {
        const parentBlocks = [];
        for (let i = 0; i < ancestors.length; i++) {
            const ancestorPath = ancestors[i];
            const lore = loreMap.get(ancestorPath);
            const hasArt = hasLocationImage(ancestorPath);
            if (!lore?.content && !hasArt) continue;
            const role = i === 0 ? 'Immediate parent' : 'Ancestor';
            let block = `${role}: "${ancestorPath}"`;
            if (lore?.content) {
                block += `\n${lore.content.trim().substring(0, 900)}`;
            }
            if (hasArt) {
                block += `\n(Reference scene art exists for this parent — match its palette, architecture, era, materials, and atmosphere.)`;
            }
            parentBlocks.push(block);
        }
        if (parentBlocks.length > 0) {
            contextParts.push(
                `Parent Location Chain (style/theme guides only — generate a DISTINCT image for "${normPath}", not a duplicate of a parent):\n${parentBlocks.join('\n\n')}`,
            );
        }
    }

    try {
        const narratorBlock = formatRecentNarratorOutputs(ctx, 2);
        if (narratorBlock) {
            contextParts.push(`Recent Narrator Output (last 2 replies — use for mood, staging, and moment):\n${narratorBlock.substring(0, 6000)}`);
        }
    } catch { /* ignore */ }

    try {
        // Present-Now name scan of the latest narrator output — runs here so Characters Present Now
        // is fresh immediately before the image-generation prompt is sent (not after).
        // Matches NPC names only (first/last), not lorebook key[] keywords.
        const presentCharacters = await loadPresentCharactersForLocationPrompt(s, ctx);
        if (presentCharacters.length > 0) {
            const charBlocks = presentCharacters.map(ch =>
                `### ${ch.label}\n${ch.content || '(No lore content — infer appearance from name and scene context.)'}`,
            );
            contextParts.push(
                `Characters Present Now (include in the scene):\n${charBlocks.join('\n\n')}`,
            );
        }
    } catch { /* ignore */ }

    try {
        const persona = ctx.substituteParams?.('{{persona}}') || '';
        if (persona.trim()) {
            contextParts.push(`User Persona (for art style context):\n${persona.trim()}`);
        }
    } catch { /* ignore */ }

    try {
        const charId = ctx.characterId;
        const charData = ctx.characters?.[charId];
        if (charData?.description) {
            contextParts.push(`Narrator Card Description (for world context):\n${charData.description.substring(0, 1500)}`);
        }
    } catch { /* ignore */ }

    const leafName = normPath.split(' :: ').pop() || normPath;
    const systemPrompt = (s.portraitLocationSystemPrompt || '')
        .replace(/\{\{name\}\}/g, leafName)
        .replace(/\{\{path\}\}/g, normPath)
        .replace(/\{\{wordtarget\}\}/g, String(s.portraitPromptWordTarget || 200));

    const userPrompt = contextParts.join('\n\n---\n\n');

    const result = await sendStateRequest(getPortraitConnectionSettings(s), systemPrompt, userPrompt);
    return (result || '').trim();
}

const activeLocationGenerations = new Set();

/** @param {string} locationPath */
export function isLocationImageGenerating(locationPath) {
    const normPath = normalizeLocationPath(locationPath);
    return normPath ? activeLocationGenerations.has(normPath) : false;
}

/**
 * @param {string} locationPath
 * @param {function} refresh
 * @param {string} [locContent]
 * @param {{ forceReplace?: boolean, realtimeArrival?: boolean }} [opts]
 */
export function triggerBackgroundLocationGeneration(locationPath, refresh, locContent = '', opts = {}) {
    const s = getSettings();
    // Real-Time Mode: only Scene View arrival may auto-generate; block Lorebook Agent paths.
    if (s.portraitAutoGenerateSceneView && !opts.realtimeArrival) return;

    const normPath = normalizeLocationPath(locationPath);
    if (!normPath) return;
    const forceReplace = !!opts.forceReplace;
    if (hasLocationImage(normPath) && !forceReplace) return;
    if (activeLocationGenerations.has(normPath)) return;

    activeLocationGenerations.add(normPath);
    const leaf = normPath.split(' :: ').pop() || normPath;
    const isRealtimeArrival = !!opts.realtimeArrival;
    if (!isRealtimeArrival) {
        const queuePos = _imageGenQueue.length + (_imageGenQueueRunning ? 1 : 0);
        if (queuePos <= 0) {
            imageGenToast('info', `${forceReplace ? 'Regenerating' : 'Auto-generating'} location image for ${leaf}...`, 'RPG Tracker');
        } else {
            imageGenToast('info', `Queued location image for ${leaf} (${queuePos} ahead)...`, 'RPG Tracker');
        }
    } else if (typeof refresh === 'function') {
        refresh();
    }

    enqueueImageGen(async () => {
        try {
            // generateLocationImagePrompt runs the Present-Now keyword scanner (latest
            // output only) before building the image prompt — must stay ahead of generatePortraitDirect.
            const prompt = await generateLocationImagePrompt(normPath, locContent);
            if (!prompt) {
                if (isRealtimeArrival && typeof refresh === 'function') refresh();
                return;
            }
            const dataUrl = await generatePortraitDirect(prompt, normPath);
            const scaled = await scaleImageToLandscape(dataUrl);
            await applyLocationImageData(normPath, scaled);
            if (!isRealtimeArrival) {
                imageGenToast('success', `${forceReplace ? 'Location image regenerated' : 'Location image auto-generated'} for ${leaf}!`, 'RPG Tracker');
            }
            if (typeof refresh === 'function') refresh();
        } catch (err) {
            console.error(`[RPG Tracker] Background location image generation failed for ${normPath}:`, err);
            const errMsg = String(err.message || err);
            if (!isRealtimeArrival) {
                toastr['error'](`Location image generation failed for "${leaf}": ${errMsg.substring(0, 120)}`, 'RPG Tracker');
            }
            if (isRealtimeArrival && typeof refresh === 'function') refresh();
        } finally {
            activeLocationGenerations.delete(normPath);
        }
    });
}

/**
 * Load location lorebook entries for auto-generation.
 * @returns {Promise<Array<{label: string, content: string}>>}
 */
async function loadLocationLorebookEntries() {
    const s = getSettings();
    // Real-Time Mode owns location art; skip Lorebook Agent batch generation.
    if (!s.portraitAutoGenerateLocations || s.portraitAutoGenerateSceneView || !s.locationImages) return [];

    const map = await loadLocationLorebookMap();
    return [...map.entries()].map(([label, { content }]) => ({ label, content }));
}

/**
 * @param {function} refresh
 * @param {{ isFirstCheck?: boolean }} [opts]
 */
export async function checkAndTriggerLocationAutoGenerations(refresh, opts = {}) {
    const s = getSettings();
    if (s.enablePortraits === false) return;
    // Real-Time Mode: location images are created on Scene View arrival only.
    if (!s.portraitAutoGenerateLocations || s.portraitAutoGenerateSceneView || !s.locationImages) return;

    const locEntries = await loadLocationLorebookEntries();
    if (opts.isFirstCheck) {
        for (const entry of locEntries) {
            knownEntities.add(`LOC::${normalizeLocationPath(entry.label).toUpperCase()}`);
        }
        return;
    }

    for (const entry of locEntries) {
        const path = normalizeLocationPath(entry.label);
        if (!hasLocationImage(path)) {
            triggerBackgroundLocationGeneration(path, refresh, entry.content);
        }
    }
}
