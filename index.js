import { EXAMPLES, COLOR_EXAMPLES, DEFAULT_STOCK_PROMPTS, RT_PROMPTS, BLOCK_ICONS, BLOCK_ORDER, PAGE_SIZE, NO_PAGINATE, QUESTS_NARRATOR, buildOnboardingXpHint, resolveTimePromptKey, resolveTimePromptDisplayTag } from './constants.js';
import { MODULE_NAME, DEFAULT_MODULES, getSettings, getBarBackground, migrateCustomFields, saveChatState, saveProfile, deleteProfile, getEffectiveRouterCampaignPrefix, sanitizeCampaignPrefixString, buildNpcInstruction, loadStockPromptsFromProfile, getNpcRelationshipMax, getNpcRelationshipMaxDefault, clampRelationshipValue, relationshipBarPct, buildRelationshipTrackingSysprompt, getFriendshipTier, getAffectionTier, getRelTierBadgeStyle, getRelTierDetailedStyle, getRelTierDetailedLabelStyle, applyRelTierBadgeElement, sanitizeRouterState, rebuildAllModuleInstructions, adjustAllStoredTemplatesForTimeFormat } from './state-manager.js';
import { sendStateRequest, fetchOllamaModels, fetchOpenAIModels, testOpenAIConnection, getConnectionProfiles, getCurrentCompletionPreset, setCompletionPreset, syncCombatProfile, resetCombatProfileOverride } from './llm-client.js';
import { getDiceToolName, getDiceCommandName, getDiceCommandAliases, doDiceRoll, registerDiceFunctionTool, registerDiceSlashCommand, installInterceptor, getNarrativeBlocks, onGenerationStarted, onGenerationEnded, ensureRelTagRegex, resetRouterTick, getRouterTick, resetRouterAutoTick, makeRngQueue, buildRngBlock, RNG_QUEUE_LEN, parseAndApplyNarrativeRelTags } from './narrative-hooks.js';
import { deduplicateMemo, mergeMemo, computeDelta, escapeHtml, escapeRegex, highlightParens, cleanToolCallMessage, cleanMessageContent, getLastUserAction, buildLorebookContext, buildModulesInstructionText, buildModuleFormatInstruction, parseQuestsFromMemo, syncQuestsFromMemo, syncQuestsToMemo, writeQuestsToMemo, getQuestMood, extractCurrentTimeStr, stripArchivedQuestsFromMemo, stripCompletedQuestsFromMemo, applyQuestSyncAndStripMemo, isArchivedQuestStatus, removeArchivedQuest, parseInWorldTime, formatInWorldTime, sanitizeLorebookRecordContent } from './memo-processor.js';
import { renderSubFieldByRule, tryRenderMarker, renderCustomBlockLine, stripMemoHtml, escapeHtmlWithColor, parseMemoBlocks, getPageSize, loadCollapsed, saveCollapsed, loadDetached, saveDetached, blockToItems, renderMemoAsCards, renderTabModeView, renderQuestLog, renderLorebookTerminal, loadActiveTab, saveActiveTab, getTimeOfDayInfo } from './renderer.js';
import { unregisterLogQuestTool, checkQuestDeadlines, renderQuestsAsPlainText } from './quests.js';
import { initializeDebugViewer, toggleDebugViewer } from './debug-viewer.js';
import { runRouterPass, rollbackRouterPass, reapplyRouterPass, getLorebookManifest, deleteLorebookEntry, updateLorebookEntry, disableManagedEntries, isRouterRunning, stopRouterPass } from './router.js';
import { getRequestHeaders } from '../../../../script.js';
import { fileToDataUrl, scaleImageTo512Square, applyPortraitData, generatePortraitPrompt, generateNpcPortraitPrompt, showPortraitPromptPopup, generatePortraitDirect, autoGeneratePartyPortraits, removeAllPortraits, checkAndTriggerAutoGenerations, autoGenerateEnemyPortraits, forceCheckAutoGenerations, resetAutoGenerationTracking } from './portraits.js';
import { loadPanelGeometry, loadDeltaHeight, makeDraggable, makeResizableTR, makeResizableBR, makeResizableBL, setupResizeObserver, setupDeltaResize } from './ui-geometry.js';
import { applyCustomTheme, openThemeWizard, refreshSavedThemesList, handleRecolor, undoThemeChange } from './theme-manager.js';
import { showCharacterRollPanel } from './character-creator.js';
import { handleCategorySettings, openCustomFieldEditor, openPromptEditor, refreshOrderList, exportModules, importModulesFromJson } from './ui-editors.js';
import { applyCustomSysprompts, replaceGsSlotMarkers, openGameSystemWizard, openManageGameSystems, openUnlockSectionsMenu, openCustomSyspromptLibrary, resetSyspromptLibrary, runAiSectionBuilder, runManualSectionBuilder, syncAllNarratorTogglesForUnlockState } from './game-systems.js';

export const RENDERING_TAGS_LIBRARY = [
    'Health: ((BAR)) 50/100',
    '((BARRED)) Blood 40/100',
    'Mana: ((BARBLUE)) 80/100',
    '((BARGREEN)) Stamina 20/100',
    '((BARYELLOW)) Energy 60/100',
    'Void: ((BARPURPLE)) 90/100',
    '((BARORANGE)) Heat 30/100',
    'Exp: ((XPBAR)) 450/1000 Level 3',
    'Status: ((PILLS)) Active, Focused (Concentrating)',
    'Debuffs: ((PILLRED)) Bleeding (1d4 dmg), Poisoned',
    '((PILLGREEN)) Buffs (Blessed)',
    'Magic: ((PILLBLUE)) Shielded (Absorbs 10 dmg)',
    'Standing: ((BADGE)) Neutral',
    'Alert: ((WARNING)) Caution',
    '((DANGER)) Hostile',
    '((SUCCESS)) Friendly',
    'Role: ((INFO)) Quest NPC',
    'Wallet: ((GOLD)) 150',
    '((SILVER)) 45',
    'Pocket: ((BRONZE)) 12',
    'Stash: ((DOLLAR)) 500',
    'Kills: ((SKULL)) 12',
    'Lives: ((HEART)) 3',
    'Souls: ((SOUL)) 42',
    'Main Quest: ((OBJ)) ○ Find the artifact',
    'Side Quest: ((OBJ)) ✓ Defeat the bandit leader',
    '((OBJ)) ✗ Save the hostage',
    'Bounty: ((REWARD)) 500 XP',
    'Challenge: ((DIFFICULTY)) Hard',
    'Items: ((PROGRESS)) 3/5 collected',
    'Attack: ((ROLL)) 1d20+5 = 18',
    'Note: ((HIGHLIGHT)) Emphasized text'
];

// Capture the folder name dynamically from the module URL so it works regardless of what the user names the folder
export const FOLDER_NAME = (function () {
    try {
        const urlObj = new URL(import.meta.url);
        const parts = urlObj.pathname.split('/');
        const idx = parts.indexOf('third-party');
        if (idx !== -1 && idx + 1 < parts.length) {
            return decodeURIComponent(parts[idx + 1]);
        }
    } catch (e) { }
    return 'SillyTavern-MultihogDnDFramework';
})();

let _stateModelRunning = false;
let _stateController = null;   // To abort ongoing state updates
let _currentChatId = null;
let _prefixDeriveTimer = null; // Pending CHAT_CHANGED → prefix-derivation timer
/** Set during init BOOTSTRAP so the immediate CHAT_CHANGED does not repeat /world scans. */
let _sessionBootstrapChatId = null;
let _bootstrapSyncPromise = null;
let _pillDeselectHandler = null;
let _tabModeMenuDeselectHandler = null;
let renderRouterUI = null;
globalThis._rpgRenderRouterUI = () => { if (typeof renderRouterUI === 'function') renderRouterUI(); };
/** Rebuilds CAMPAIGN RECORDS; assigned in createPanel when the agent panel is wired. */
let refreshAgentManifest = async () => { };
globalThis._rpgRefreshAgentManifest = async () => { if (typeof refreshAgentManifest === 'function') await refreshAgentManifest(); };
/** Refreshes the NPC card grid; assigned in createPanel so module-level code can call it. */
let refreshNpcManifest = async () => { };

// Combined refresh: updates both the tracker panel and the Lorebook Terminal NPC grid.
// Used as the refresh callback for NPC-aware auto-generation.
const refreshAll = () => {
    refreshRenderedView();
    if (typeof refreshNpcManifest === 'function') {
        void refreshNpcManifest().catch(() => {});
    }
};

/** Compact colored tier badge (e.g. "FRIENDLY") — hint shown as a tooltip. Used in NPC grid cards. */
function renderRelTierBadge(type, value, max) {
    const tier = type === 'friendship' ? getFriendshipTier(value, max) : getAffectionTier(value, max);
    return `<span class="rt-npc-tier-badge ${type}" style="${getRelTierBadgeStyle(type, value, max)}" title="${escapeHtml(tier.hint)}">${escapeHtml(tier.label)}</span>`;
}

/** Row of both tier badges (friendship + affection) for the NPC grid card. */
function renderRelTierRow(friendshipVal, affectionVal, max) {
    return `<div class="rt-npc-tier-row">${renderRelTierBadge('friendship', friendshipVal, max)}${renderRelTierBadge('affection', affectionVal, max)}</div>`;
}

/** Full "Friendship tier: FRIENDLY — genuine warmth..." block with visible hint text. Used in the NPC detail popup. */
function renderRelTierDetailed(type, value, max) {
    const tier = type === 'friendship' ? getFriendshipTier(value, max) : getAffectionTier(value, max);
    const axisLabel = type === 'friendship' ? 'Friendship' : 'Affection';
    return `<div class="rt-npc-tier-detailed ${type}" style="${getRelTierDetailedStyle(type, value, max)}">
        <span class="rt-npc-tier-detailed-label" style="${getRelTierDetailedLabelStyle(type, value, max)}">${axisLabel} tier: ${escapeHtml(tier.label)}</span>
        <span class="rt-npc-tier-detailed-hint">— ${escapeHtml(tier.hint)}</span>
    </div>`;
}

function isAgentPanelVisible() {
    const el = document.getElementById('rpg-tracker-agent');
    return !!el && el.style.display !== 'none';
}

function scheduleDeferred(fn) {
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => { void fn(); }, { timeout: 2500 });
    } else {
        setTimeout(() => { void fn(); }, 0);
    }
}

/** Refresh CAMPAIGN RECORDS only when the Lorebook Agent panel is open (avoids heavy load on F5). */
function scheduleAgentManifestRefresh(force = false) {
    if (!force && !isAgentPanelVisible()) return;
    void refreshAgentManifest().catch(() => {});
}

/** Reload CAMPAIGN RECORDS — safe from settings UI outside createPanel(). */
export async function refreshAgentManifestNow() {
    if (typeof globalThis._rpgRefreshAgentManifest === 'function') {
        await globalThis._rpgRefreshAgentManifest();
    }
}

let updateAgentWorldStatusRef = null;
let updateWorldProgressionLastFiredDisplayRef = null;

/** Last lorebook /world sync diagnostics (JSON-serializable). */
let _loreActivationDebugLast = /** @type {Record<string, any>|null} */ (null);

/**
 * Updates the Lorebook Agent debug <pre> if the panel exists.
 */
function renderLoreActivationDebugPanel() {
    const pre = document.getElementById('rpg_tracker_lore_activation_debug_pre');
    if (!pre) return;
    if (!_loreActivationDebugLast) {
        pre.textContent = '(no data yet — use Capture now in Extension Settings > Lorebook Agent, or switch chats / Activate Books.)';
        return;
    }
    try {
        pre.textContent = JSON.stringify(_loreActivationDebugLast, null, 2);
    } catch (_) {
        pre.textContent = String(_loreActivationDebugLast);
    }
}

function sleepMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST /api/settings/get — returns world_names from JSON (diagnostic + fallback when ST client cache is empty).
 */
async function probeSettingsWorldNamesApi() {
    try {
        const result = await fetch('/api/settings/get', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({}),
        });
        const status = result.status;
        const ok = result.ok;
        let names = [];
        if (ok) {
            try {
                const data = await result.json();
                if (Array.isArray(data?.world_names)) names = [...data.world_names];
            } catch (_) { /* ignore */ }
        }
        return { ok, status, count: names.length, names };
    } catch (e) {
        return { ok: false, status: 0, count: 0, names: [], fetchError: String(e?.message || e) };
    }
}

/**
 * Retries updateWorldInfoList, then compares client getWorldInfoNames vs API world_names.
 * @param {{ maxAttempts?: number, delayMs?: number }} [opts]
 */
async function refreshWorldInfoRegistry(opts = {}) {
    const maxAttempts = opts.maxAttempts ?? 1;
    const delayMs = opts.delayMs ?? 160;
    const ctx = SillyTavern.getContext();
    const attempts = [];
    let clientCount = 0;
    for (let i = 0; i < maxAttempts; i++) {
        let stError = null;
        if (typeof ctx.updateWorldInfoList === 'function') {
            try {
                await ctx.updateWorldInfoList();
            } catch (e) {
                stError = String(e?.message || e);
            }
        } else {
            stError = 'updateWorldInfoList missing';
        }
        let lastNames = [];
        if (typeof ctx.getWorldInfoNames === 'function') {
            try {
                lastNames = ctx.getWorldInfoNames();
            } catch (e) {
                stError = stError || String(e?.message || e);
            }
        }
        clientCount = Array.isArray(lastNames) ? lastNames.length : 0;
        attempts.push({ attempt: i + 1, clientWorldNameCount: clientCount, stError });
        if (clientCount > 0) break;
        if (i < maxAttempts - 1) await sleepMs(delayMs);
    }
    const apiProbe = await probeSettingsWorldNamesApi();
    const usedApiNameFallback = clientCount === 0 && apiProbe.ok && apiProbe.count > 0 && Array.isArray(apiProbe.names) && apiProbe.names.length > 0;
    return {
        clientWorldNameCount: clientCount,
        attempts,
        apiProbe,
        usedApiNameFallback,
    };
}

/**
 * @param {any} ctx
 * @param {{ clientWorldNameCount: number, apiProbe: { ok: boolean, names: string[] }, usedApiNameFallback: boolean }} reg
 */
function resolveAllWorldNames(ctx, reg) {
    if (reg.clientWorldNameCount > 0 && typeof ctx.getWorldInfoNames === 'function') {
        const n = ctx.getWorldInfoNames();
        return Array.isArray(n) ? [...n] : [];
    }
    if (reg.usedApiNameFallback && Array.isArray(reg.apiProbe.names)) return [...reg.apiProbe.names];
    if (typeof ctx.getWorldInfoNames === 'function') {
        const n = ctx.getWorldInfoNames();
        return Array.isArray(n) ? [...n] : [];
    }
    return [];
}

/**
 * @param {string[]} allNames
 * @param {string} currentPrefix
 * @param {string[]} bookNames
 * @param {Record<string, any>} s
 * @returns {{ toDeactivate: string[], otherPrefixes: string[], managedOffCount: number, crossChatMatchCount: number }}
 */
function computeWorldsToDeactivate(allNames, currentPrefix, bookNames, s) {
    const currentSet = new Set(bookNames);
    const allKnownManagedBooks = new Set(
        Object.values(s.chatStates || {}).flatMap(cs => cs.campaignBooks || [])
    );
    const managedOff = [...allKnownManagedBooks].filter(n => !currentSet.has(n));

    const otherPrefixes = [...new Set(
        Object.keys(s.chatStates || {})
            .map(cid => getEffectiveRouterCampaignPrefix(cid))
            .filter(p => p && p !== currentPrefix)
    )];
    const otherSet = new Set(otherPrefixes);
    const crossChatOff = allNames.filter(n =>
        [...otherSet].some(op => bookBelongsToPrefix(n, op))
    );
    const combined = [...managedOff, ...crossChatOff].filter(n => !currentSet.has(n));
    const toDeactivate = [...new Set(combined)];
    const managedSet = new Set(managedOff);
    const crossChatOnlyCount = crossChatOff.filter(n => !managedSet.has(n)).length;
    return {
        toDeactivate,
        otherPrefixes,
        managedOffCount: managedOff.length,
        crossChatMatchCount: crossChatOnlyCount,
    };
}

/**
 * Read-only snapshot of chat id, prefixes, ST APIs, and which books would match (no slash commands).
 * @param {string} source
 * @returns {Promise<Record<string, any>>}
 */
async function readLoreActivationDebugSnapshot(source) {
    const ctx = SillyTavern.getContext();
    const s = getSettings();
    const paramChatId = _currentChatId || ctx.chatId || '';
    const ctxChatId = ctx.chatId || '';
    const derivedFromChatOnly = sanitizeCampaignPrefixString(paramChatId);
    const overrideRaw = (s.routerCampaignPrefixOverride || '').trim();
    const effectivePrefix = getEffectiveRouterCampaignPrefix(paramChatId);
    const storedPrefix = (s.routerCampaignPrefix || '').trim();

    const reg = await refreshWorldInfoRegistry();
    const allNames = resolveAllWorldNames(ctx, reg);

    const matchingEffective = effectivePrefix ? allNames.filter(n => bookBelongsToPrefix(n, effectivePrefix)) : [];
    const matchingForStored = storedPrefix ? allNames.filter(n => bookBelongsToPrefix(n, storedPrefix)) : [];
    const matchingDerivedOnly = derivedFromChatOnly ? allNames.filter(n => bookBelongsToPrefix(n, derivedFromChatOnly)) : [];
    const allKnownManagedBooks = new Set(
        Object.values(s.chatStates || {}).flatMap(cs => cs.campaignBooks || [])
    );
    const toDeactivateForStored = storedPrefix
        ? [...allKnownManagedBooks].filter(n => !matchingForStored.includes(n))
        : [...allKnownManagedBooks];
    return {
        ts: new Date().toISOString(),
        source,
        routerEnabled: !!s.routerEnabled,
        chatLinkEnabled: !!s.chatLinkEnabled,
        paramChatId,
        ctxChatId,
        chatIdMismatch: paramChatId !== ctxChatId,
        overrideRaw: overrideRaw || '(none)',
        derivedFromChatIdOnly: derivedFromChatOnly || '(empty)',
        effectivePrefix: effectivePrefix || '(empty)',
        storedPrefix: storedPrefix || '(empty)',
        bookMatchRule: 'Book matches if name === prefix OR name === prefix + "_" + single segment (no extra underscores in suffix).',
        apis: {
            executeSlashCommandsWithOptions: typeof ctx.executeSlashCommandsWithOptions,
            updateWorldInfoList: typeof ctx.updateWorldInfoList,
            getWorldInfoNames: typeof ctx.getWorldInfoNames,
            addPromptManagerInterceptor: typeof ctx.addPromptManagerInterceptor,
        },
        worldRegistry: reg,
        allWorldNamesCount: allNames.length,
        matchingForEffectivePrefix: matchingEffective,
        matchingForStoredPrefix: matchingForStored,
        matchingForDerivedFromChatOnly: matchingDerivedOnly,
        managedBooksInChatStates: [...allKnownManagedBooks],
        wouldDeactivateForStoredPrefix: toDeactivateForStored,
        priorSlashLog: _loreActivationDebugLast?.slashLog ?? null,
    };
}

/**
 * Re-runs the same prefix + chatStates + /world pipeline as CHAT_CHANGED (debounced handler),
 * without waiting 800ms. For troubleshooting ST worlds not toggling.
 * @param {string} newChatId
 * @param {string} source
 */
async function syncCampaignPrefixAndWorldsForChat(newChatId, source) {
    const s2 = getSettings();
    if (!newChatId) {
        _loreActivationDebugLast = {
            ts: new Date().toISOString(),
            source,
            stopped: 'empty chat id',
        };
        renderLoreActivationDebugPanel();
        return;
    }
    if (!s2.routerEnabled) {
        _loreActivationDebugLast = {
            ts: new Date().toISOString(),
            source,
            newChatId,
            stopped: 'routerDisabled (Lorebook Agent off - no prefix/world sync)',
        };
        renderLoreActivationDebugPanel();
        return;
    }
    const prefix = getEffectiveRouterCampaignPrefix(newChatId);
    if (!prefix) {
        s2.routerCampaignPrefix = '';
        syncRouterPrefixDisplays('');
        void scheduleAgentManifestRefresh();
        _loreActivationDebugLast = {
            ts: new Date().toISOString(),
            source,
            newChatId,
            stopped: 'noPrefixFromChatId (transient rename or empty derive)',
            derivedPrefix: '',
        };
        renderLoreActivationDebugPanel();
        return;
    }
    s2.routerCampaignPrefix = prefix;
    syncRouterPrefixDisplays(prefix);

    const ctx = SillyTavern.getContext();
    const reg = await refreshWorldInfoRegistry();
    const allNames = resolveAllWorldNames(ctx, reg);
    const worldBookName = prefix ? `${prefix}_World` : 'World';
    let matchingBooks = allNames.filter(n => bookBelongsToPrefix(n, prefix));
    if (s2.worldProgressionEnabled) {
        if (allNames.includes(worldBookName) && !matchingBooks.includes(worldBookName)) {
            matchingBooks.push(worldBookName);
        }
        try {
            const worldBook = await ctx.loadWorldInfo(worldBookName);
            if (worldBook?.entries) {
                const sorted = Object.entries(worldBook.entries)
                    .sort(([a], [b]) => Number(a) - Number(b));
                const allWorldIds = sorted.map(([uid]) => `${worldBookName}::${uid}`);
                const keepActive = s2.worldProgressionKeepActive || 1;
                s2.activeWorldKeys = allWorldIds.slice(-keepActive);
            } else {
                s2.activeWorldKeys = [];
            }
        } catch (_) {
            s2.activeWorldKeys = [];
        }
    } else {
        matchingBooks = matchingBooks.filter(n => n !== worldBookName);
        s2.activeWorldKeys = [];
    }

    if (!s2.chatStates) s2.chatStates = {};
    if (!s2.chatStates[newChatId]) s2.chatStates[newChatId] = {};
    s2.chatStates[newChatId].campaignBooks = matchingBooks;
    saveSettings();
    if (s2.chatLinkEnabled && _currentChatId) saveChatState(_currentChatId);
    try {
        await activateCampaignBooks({
            debugSource: source,
            syncMeta: { newChatId, matchingBooksCount: matchingBooks.length },
            registry: reg,
            allNames,
        });
    } catch (e) {
        _loreActivationDebugLast = {
            ...(_loreActivationDebugLast || {}),
            ts: new Date().toISOString(),
            source,
            syncError: String(e?.message || e),
        };
        renderLoreActivationDebugPanel();
    }
    // If ST's in-memory world list was empty but the server had names, run one silent follow-up
    // so updateWorldInfoList can repopulate the client after our /world pass (avoids needing manual resync).
    if (reg.usedApiNameFallback && reg.clientWorldNameCount === 0 && matchingBooks.length > 0 && !String(source).includes('registry-followup')) {
        setTimeout(() => {
            if (newChatId !== _currentChatId) return;
            void syncCampaignPrefixAndWorldsForChat(newChatId, `${source}(registry-followup)`).catch(() => { });
        }, 450);
    }
    void scheduleAgentManifestRefresh();
}

/**
 * Centralized save helper that handles both global settings and
 * the Chat-Linked State for the active chat.
 */
let _saveSettingsTimer = null;
export function saveSettings() {
    // Keep UI synchronization immediate so toggle checkboxes and forms respond instantly
    syncOnboardingUI();

    if (_saveSettingsTimer) clearTimeout(_saveSettingsTimer);
    _saveSettingsTimer = setTimeout(() => {
        _saveSettingsTimer = null;
        const s = getSettings();
        const ctx = SillyTavern.getContext();
        ctx.saveSettingsDebounced();
        const activeChatId = _currentChatId || ctx.chatId;
        if (s.chatLinkEnabled && activeChatId) {
            saveChatState(activeChatId);
        }
    }, 150);
}

/** When NPC portraits are disabled, turn off NPC auto-generation and sync dependent UI. */
function applyNpcPortraitSetting(settings, enabled) {
    settings.npcPortraits = !!enabled;
    if (!settings.npcPortraits) {
        settings.portraitAutoGenerateNpcs = false;
    }
    syncNpcPortraitDependentUi(settings);
}

/** Sync NPC portrait toggle and disable auto-generate-NPCs when portraits are off. */
export function syncNpcPortraitDependentUi(settings) {
    const enabled = settings.npcPortraits !== false;
    $('#rpg_tracker_npc_portraits').prop('checked', enabled);
    const autoNpcCb = $('#rpg_tracker_portrait_auto_npcs');
    if (!enabled) {
        autoNpcCb.prop('checked', false);
    }
    autoNpcCb.prop('disabled', !enabled);
}

/**
 * Sync every time/date format control across the whole extension (Modules &
 * Order pills, Extension Settings checkbox, both onboarding widgets) with the
 * live settings values. This is the single place that pushes state out to the
 * UI, so no surface can ever show a stale or contradicting value.
 * @param {object} s
 */
export function syncTimeFormatSettingsUi(s) {
    const timeDdMmyyCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_time_ddmmyy_toggle'));
    if (timeDdMmyyCb) timeDdMmyyCb.checked = !!s.useDdMmYyFormat;
    const time24hCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_time_24h_toggle'));
    if (time24hCb) time24hCb.checked = !!s.use24hTime;
    $('#rpg_sysprompt_mod_time_ddmmyy').prop('checked', !!s.useDdMmYyFormat);
    syncOnboardingUI();
    if (typeof updateWorldProgressionLastFiredDisplayRef === 'function') {
        updateWorldProgressionLastFiredDisplayRef();
    }
}

/** Persist time/date format fields into the current chat snapshot when chat linking is on. */
function persistChatTimeFormatIfLinked() {
    const s = getSettings();
    if (s.chatLinkEnabled && _currentChatId) saveChatState(_currentChatId);
}

function rebuildNpcInstructionIfNeeded() {
    const s = getSettings();
    if (s.routerModules?.npc) {
        s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
    }
}

/** Apply default or saved per-chat relationship max into live settings. */
function applyChatNpcRelMaxSettings(saved) {
    const s = getSettings();
    s.npcRelationshipMax = saved?.npcRelationshipMax ?? getNpcRelationshipMaxDefault(s);
    rebuildNpcInstructionIfNeeded();
    scheduleAutoApply();
}

function persistChatNpcRelMaxIfLinked() {
    const s = getSettings();
    if (s.chatLinkEnabled && _currentChatId) saveChatState(_currentChatId);
}

/** Update this chat's relationship scale (not the global new-chat default). */
function setNpcRelationshipMaxForCurrentChat(val) {
    const s = getSettings();
    s.npcRelationshipMax = getNpcRelationshipMax({ npcRelationshipMax: val });
    saveSettings();
    persistChatNpcRelMaxIfLinked();
    rebuildNpcInstructionIfNeeded();
    scheduleAutoApply();
}

/** Update the global default applied when opening chats with no saved value. */
function setNpcRelationshipMaxDefault(val) {
    const s = getSettings();
    s.npcRelationshipMaxDefault = getNpcRelationshipMax({ npcRelationshipMax: val });
    saveSettings();
    const defaultEl = document.getElementById('rpg_tracker_npc_rel_max_default');
    if (defaultEl) defaultEl.value = String(s.npcRelationshipMaxDefault);
}

/** Apply default or saved per-chat time/date format settings. */
function applyChatTimeFormatSettings(saved) {
    const s = getSettings();
    s.use24hTime = saved?.use24hTime ?? false;
    s.useDdMmYyFormat = saved?.useDdMmYyFormat ?? false;
    s.initialDate = saved?.initialDate ?? 'Day 1';
    if (s.routerModules?.npc) {
        s.routerModules.npc.instruction = buildNpcInstruction(s.npcMajorWords, s.npcMinorWords, false);
    }
    syncTimeFormatSettingsUi(s);
}

/**
 * Single source-of-truth setter for the Day N vs DD/MM/YYYY calendar format.
 * Every control that toggles this setting (Modules & Order, Extension
 * Settings, both onboarding widgets) MUST call this instead of writing
 * `useDdMmYyFormat` directly, so the value and its dependent UI can never
 * drift apart between the different places it's exposed.
 * @param {boolean} isDate
 */
export function setUseDdMmYyFormat(isDate) {
    const s = getSettings();
    s.useDdMmYyFormat = !!isDate;
    if (isDate) {
        if (s.initialDate === "Day 1" || !s.initialDate) s.initialDate = "01/01/2026";
    } else if (!s.initialDate || s.initialDate === "01/01/2026" || s.initialDate === "01/01/26") {
        s.initialDate = "Day 1";
    }
    rebuildAllModuleInstructions(s);
    adjustAllStoredTemplatesForTimeFormat(s);
    $('#rpg_tracker_router_prompt').val(s.routerSystemPromptTemplate);
    $('#rpg_tracker_router_modular_prompt').val(s.routerModularPromptTemplate);
    refreshOrderList();
    if (typeof globalThis._rpgRenderAgentModules === 'function') {
        globalThis._rpgRenderAgentModules();
    }
    saveSettings();
    persistChatTimeFormatIfLinked();
    syncTimeFormatSettingsUi(s);
    scheduleAutoApply();
}

/**
 * Single source-of-truth setter for the 12h vs 24h clock format.
 * See {@link setUseDdMmYyFormat} for why every toggle must funnel through here.
 * @param {boolean} is24h
 */
export function setUse24hTime(is24h) {
    const s = getSettings();
    s.use24hTime = !!is24h;
    rebuildAllModuleInstructions(s);
    adjustAllStoredTemplatesForTimeFormat(s);
    $('#rpg_tracker_router_prompt').val(s.routerSystemPromptTemplate);
    $('#rpg_tracker_router_modular_prompt').val(s.routerModularPromptTemplate);
    refreshOrderList();
    if (typeof globalThis._rpgRenderAgentModules === 'function') {
        globalThis._rpgRenderAgentModules();
    }
    saveSettings();
    persistChatTimeFormatIfLinked();
    syncTimeFormatSettingsUi(s);
    scheduleAutoApply();
}

/**
 * Single source-of-truth setter for the initial date/day anchor text.
 * Keeps both onboarding text inputs (top widget + Narrator Configuration)
 * in sync without stealing focus from whichever one the user is typing in.
 * @param {string} val
 * @param {HTMLInputElement|null} [sourceInput] - the input the user is typing into; left untouched.
 */
function setInitialDateValue(val, sourceInput = null) {
    getSettings().initialDate = val;
    saveSettings();
    persistChatTimeFormatIfLinked();
    document.querySelectorAll('#rt-onboarding-start-date, #rt_onboarding_initial_date_input').forEach(input => {
        if (input !== sourceInput) /** @type {HTMLInputElement} */ (input).value = val;
    });
}

/**
 * Synchronizes the onboarding UI elements with the current settings state.
 * This is called whenever a setting is saved to ensure both the main sidebar
 * and the tracker's onboarding screen stay perfectly in sync.
 */
function syncOnboardingUI() {
    const s = getSettings();
    const onboarding = document.querySelector('.rt-empty');
    if (!onboarding) return;

    // RNG Mode Sync
    const rngHybrid = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_rng_hybrid'));
    const rngLegacy = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_rng_legacy'));
    const rngNone = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_rng_none'));
    if (rngHybrid && rngLegacy && rngNone) {
        rngHybrid.checked = s.rngEnabled && !!s.diceFunctionTool;
        rngLegacy.checked = s.rngEnabled && !s.diceFunctionTool;
        rngNone.checked = !s.rngEnabled;
    }

    // Quests Enabled Sync
    const questsEnabled = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_enabled'));
    if (questsEnabled) {
        const isEnabled = s.syspromptModules?.quests !== false;
        questsEnabled.checked = isEnabled;
        const optionsDiv = /** @type {HTMLElement|null} */ (onboarding.querySelector('#rt_onboarding_quest_options'));
        if (optionsDiv) optionsDiv.style.display = isEnabled ? 'flex' : 'none';
    }

    // Deadlines Sync
    const deadlines = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_deadlines'));
    if (deadlines) deadlines.checked = !!s.syspromptModules?.questsDeadlines;
    const frustrationWrapOnb = /** @type {HTMLElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_frustration_wrap'));
    if (frustrationWrapOnb) frustrationWrapOnb.style.display = deadlines?.checked ? '' : 'none';

    // Frustration levels Sync
    const frustration = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_frustration'));
    if (frustration) frustration.checked = !!s.syspromptModules?.questsFrustration;

    // Difficulty Sync
    const difficulty = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_difficulty'));
    if (difficulty) difficulty.checked = !!s.syspromptModules?.questsDifficulty;

    const showArchiveOnb = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_quests_show_archive'));
    if (showArchiveOnb) showArchiveOnb.checked = s.syspromptModules?.questsShowArchive !== false;


    // Optional Components Sync
    const mods = { 'loot': '#rt_onboarding_mod_loot', 'random_events': '#rt_onboarding_mod_random_events', 'resting': '#rt_onboarding_mod_resting' };
    for (const [key, id] of Object.entries(mods)) {
        const cb = /** @type {HTMLInputElement|null} */ (onboarding.querySelector(id));
        if (cb) cb.checked = !!s.syspromptModules?.[key];
    }

    // Custom Sysprompt Sync
    const customSyspromptCb = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_custom_sysprompt'));
    if (customSyspromptCb) customSyspromptCb.checked = !!s.customSysprompt;

    // Time & Date format + Initial date/day Sync — all segmented toggles across
    // both onboarding widgets are driven from the same settings values so they
    // can never show a contradicting state.
    syncSegToggle(onboarding.querySelector('#rt_onboarding_time_date_seg'), s.useDdMmYyFormat ? 'date' : 'day');
    syncSegToggle(onboarding.querySelector('#rt_onboarding_time_clock_seg'), s.use24hTime ? '24' : '12');
    syncSegToggle(onboarding.querySelector('#rt-onboarding-date-seg'), s.useDdMmYyFormat ? 'date' : 'day');
    syncSegToggle(onboarding.querySelector('#rt-onboarding-clock-seg'), s.use24hTime ? '24' : '12');

    const initialDateInput = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt_onboarding_initial_date_input'));
    const initialDateLabel = /** @type {HTMLElement|null} */ (onboarding.querySelector('#rt_onboarding_initial_date_label'));
    if (initialDateInput) {
        initialDateInput.value = s.initialDate || (s.useDdMmYyFormat ? '01/01/2026' : 'Day 1');
        if (initialDateLabel) {
            initialDateLabel.textContent = s.useDdMmYyFormat ? 'Initial Date:' : 'Initial Day:';
        }
        initialDateInput.placeholder = s.useDdMmYyFormat ? '01/01/2026' : 'Day 1';
    }

    // Character Creator Start Date Sync (segmented toggle synced above)
    const creatorStartDate = /** @type {HTMLInputElement|null} */ (onboarding.querySelector('#rt-onboarding-start-date'));
    if (creatorStartDate) {
        creatorStartDate.value = s.initialDate && s.initialDate !== 'Day 1' ? s.initialDate : '01/01/2026';
        creatorStartDate.style.display = s.useDdMmYyFormat ? 'inline-block' : 'none';
    }
}

/**
 * Marks the button matching `activeValue` as active within a `.rt-seg-toggle`
 * group and clears the rest. Used to keep every Day/Date and 12h/24h control
 * across the onboarding screen visually in sync with the underlying setting.
 * @param {Element|null} segEl
 * @param {string} activeValue
 */
function syncSegToggle(segEl, activeValue) {
    if (!segEl) return;
    segEl.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === activeValue);
    });
}
// ── Renderer / navigation state ──
let _historyViewIndex = -1;    // -1 = live, 0 = most recent snapshot, higher = older
let _renderedViewActive = false;
export const _sectionPages = {};

// ── Lorebook Agent nav state ──
/** @type {Array<{prePassSnapshot: object, postPassState: object}>} */
let _loreRedoStack = [];  // in-memory; cleared when a new agent pass starts

/**
 * Returns true if `bookName` belongs to the given `prefix`.
 * A book belongs when it is EITHER the prefix itself OR exactly
 * `prefix + '_' + <single-word suffix>` — the suffix must contain
 * no underscores so that "Assistant" never accidentally matches
 * "Assistant_2026_05_13_NPCs" (which belongs to a different, longer prefix).
 * @param {string} bookName
 * @param {string} prefix
 */
function bookBelongsToPrefix(bookName, prefix) {
    if (!prefix) return false;
    if (bookName === prefix) return true;
    const rest = bookName.startsWith(prefix + '_') ? bookName.slice(prefix.length + 1) : null;
    return rest !== null && !rest.includes('_');
}

/**
 * Activates every lorebook that belongs to the current campaign in SillyTavern's
 * world-info system (equivalent to toggling them ON in the World Info panel).
 * Uses the full ST lorebook registry filtered by campaign prefix, so keyless
 * lorebooks that never appear in activeRouterKeys are still caught.
 * @param {{ debugSource?: string, syncMeta?: Record<string, any>, registry?: object, allNames?: string[] }} [opts]
 * @returns {Promise<number>} Count of books turned on.
 */
async function activateCampaignBooks(opts = {}) {
    const debugSource = opts.debugSource || 'activateCampaignBooks';
    const s = getSettings();
    const ctx = SillyTavern.getContext();
    const baseDebug = {
        ts: new Date().toISOString(),
        source: debugSource,
        ctxChatId: ctx.chatId || '',
        trackedChatId: _currentChatId,
        routerEnabled: !!s.routerEnabled,
        syncMeta: opts.syncMeta || null,
    };

    if (typeof ctx.executeSlashCommandsWithOptions !== 'function') {
        _loreActivationDebugLast = {
            ...baseDebug,
            stopped: 'executeSlashCommandsWithOptions missing on SillyTavern context',
            apis: {
                executeSlashCommandsWithOptions: 'undefined',
                updateWorldInfoList: typeof ctx.updateWorldInfoList,
                getWorldInfoNames: typeof ctx.getWorldInfoNames,
            },
        };
        renderLoreActivationDebugPanel();
        return 0;
    }

    const prefix = s.routerCampaignPrefix || '';
    if (!prefix) {
        if (typeof ctx.executeSlashCommandsWithOptions === 'function') {
            const reg = await refreshWorldInfoRegistry();
            const allNames = resolveAllWorldNames(ctx, reg);
            if (allNames.includes('World')) {
                if (s.worldProgressionEnabled) {
                    await ctx.executeSlashCommandsWithOptions('/world state=on silent=true "World"').catch(() => {});
                } else {
                    await ctx.executeSlashCommandsWithOptions('/world state=off silent=true "World"').catch(() => {});
                }
            }
        }
        _loreActivationDebugLast = {
            ...baseDebug,
            stopped: 'no routerCampaignPrefix (derive failed earlier or chat id empty)',
            storedPrefix: '',
        };
        renderLoreActivationDebugPanel();
        return 0;
    }

    const reg = opts.registry || await refreshWorldInfoRegistry();
    const allNames = opts.allNames || resolveAllWorldNames(ctx, reg);

    const worldBookName = prefix ? `${prefix}_World` : 'World';
    let bookNames = allNames.filter(n => bookBelongsToPrefix(n, prefix));
    // Exclude world progression books from native activation.
    bookNames = bookNames.filter(n => {
        const isWorld = n.toLowerCase().endsWith('_world') || n.toLowerCase() === 'world';
        return !isWorld;
    });

    const deact = computeWorldsToDeactivate(allNames, prefix, bookNames, s);
    const toDeactivate = deact.toDeactivate;
    if (allNames.includes(worldBookName) && !toDeactivate.includes(worldBookName)) {
        toDeactivate.push(worldBookName);
    }
    const allKnownManagedBooks = new Set(
        Object.values(s.chatStates || {}).flatMap(cs => cs.campaignBooks || [])
    );

    /** @type {{ cmd: string, ok?: boolean, isError?: boolean, errorMessage?: string, isAborted?: boolean, abortReason?: string, thrown?: string }[]} */
    const slashLog = [];

    const runWorldCmd = async (cmd) => {
        try {
            const result = await ctx.executeSlashCommandsWithOptions(cmd, {
                handleParserErrors: true,
                handleExecutionErrors: true,
            });
            const row = { cmd };
            if (!result) {
                row.ok = true;
                row.note = 'null result';
            } else {
                row.isError = !!result.isError;
                row.errorMessage = result.errorMessage || undefined;
                row.isAborted = !!result.isAborted;
                row.abortReason = result.abortReason || undefined;
                row.ok = !result.isError && !result.isAborted;
            }
            slashLog.push(row);
        } catch (e) {
            slashLog.push({ cmd, ok: false, thrown: String(e?.message || e) });
        }
    };

    for (const name of toDeactivate) {
        await runWorldCmd(`/world state=off silent=true "${name}"`);
    }

    for (const name of bookNames) {
        await runWorldCmd(`/world state=on silent=true "${name}"`);
    }

    _loreActivationDebugLast = {
        ...baseDebug,
        storedPrefix: prefix,
        worldRegistry: reg,
        allWorldNamesCount: allNames.length,
        matchingBookNames: bookNames,
        matchingCount: bookNames.length,
        managedBooksUnion: [...allKnownManagedBooks],
        deactivateDetail: {
            otherChatPrefixes: deact.otherPrefixes,
            managedOffCount: deact.managedOffCount,
            crossChatMatchCount: deact.crossChatMatchCount,
        },
        toDeactivate,
        slashCommandsRun: slashLog.length,
        slashLog,
    };
    renderLoreActivationDebugPanel();
    return bookNames.length;
}

/**
 * Duplicates every lorebook in the current campaign stack under a new prefix.
 * Each book like `OldPrefix_NPCs` becomes `NewPrefix_NPCs`.
 * If the book name IS the prefix (the root book), it becomes `NewPrefix`.
 * @returns {Promise<void>}
 */
async function cloneCampaignStack() {
    const s = getSettings();
    const ctx = SillyTavern.getContext();

    // 1. Determine current prefix
    const currentPrefix = s.routerCampaignPrefix || '';
    if (!currentPrefix) {
        toastr['warning']('No campaign prefix is active. Activate the Lorebook Agent and load a chat first.', 'Clone Stack');
        return;
    }

    // 2. Ask user for the new prefix
    let newPrefixRaw = '';
    try {
        newPrefixRaw = await ctx.Popup.show.input(
            'Clone Lorebook Stack',
            `<p>All lorebooks under prefix <strong>${currentPrefix}</strong> will be duplicated.</p>` +
            `<p>Enter the new prefix for the cloned stack (e.g. <code>Eldoria_Branch1</code>).<br>` +
            `<small>After cloning, create your branch chat using the same name so the framework links automatically.</small></p>`,
            ''
        );
    } catch (_) {
        // User cancelled
        return;
    }

    if (!newPrefixRaw && newPrefixRaw !== 0) return; // cancelled
    const newPrefix = sanitizeCampaignPrefixString(String(newPrefixRaw).trim());
    if (!newPrefix) {
        toastr['warning']('New prefix cannot be empty or contain only special characters.', 'Clone Stack');
        return;
    }
    if (newPrefix === currentPrefix) {
        toastr['warning']('New prefix is the same as the current prefix. Please choose a different name.', 'Clone Stack');
        return;
    }

    // 3. Discover all books that belong to the current prefix
    const reg = await refreshWorldInfoRegistry();
    const allNames = resolveAllWorldNames(ctx, reg);
    const matchingBooks = allNames.filter(n => bookBelongsToPrefix(n, currentPrefix));

    if (matchingBooks.length === 0) {
        toastr['warning'](`No lorebooks found for prefix "${currentPrefix}". Nothing to clone.`, 'Clone Stack');
        return;
    }

    toastr['info'](`Cloning ${matchingBooks.length} lorebook(s) to prefix "${newPrefix}"…`, 'Clone Stack');

    // 4. Clone each book under the new prefix name
    let cloned = 0;
    const errors = [];

    for (const bookName of matchingBooks) {
        // Derive new name: replace the old prefix at the start of the book name
        let newBookName;
        if (bookName === currentPrefix) {
            // Root book: OldPrefix → NewPrefix
            newBookName = newPrefix;
        } else {
            // Suffixed book: OldPrefix_Suffix → NewPrefix_Suffix
            const suffix = bookName.slice(currentPrefix.length); // includes leading '_'
            newBookName = newPrefix + suffix;
        }

        // Load existing book data
        let bookData = null;
        try {
            bookData = await ctx.loadWorldInfo(bookName);
        } catch (e) {
            errors.push(`Failed to load "${bookName}": ${e?.message || e}`);
            continue;
        }

        if (!bookData) {
            errors.push(`Could not read "${bookName}" — skipping.`);
            continue;
        }

        // Deep clone and update name
        const cloneData = JSON.parse(JSON.stringify(bookData));
        cloneData.name = newBookName;

        // Write to disk via the raw API (same pattern as router.js)
        try {
            const res = await fetch('/api/worldinfo/edit', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ name: newBookName, data: cloneData }),
            });
            if (!res.ok) {
                errors.push(`HTTP ${res.status} saving "${newBookName}"`);
                continue;
            }
            // Sync ST in-memory cache
            if (typeof ctx.saveWorldInfo === 'function') {
                try { await ctx.saveWorldInfo(newBookName, cloneData); } catch (_) { /* non-fatal */ }
            }
            cloned++;
        } catch (e) {
            errors.push(`Failed to write "${newBookName}": ${e?.message || e}`);
        }
    }

    // 5. Refresh ST's world-info list so the new books appear immediately
    if (typeof ctx.updateWorldInfoList === 'function') {
        try { await ctx.updateWorldInfoList(); } catch (_) { /* non-fatal */ }
    }

    // 6. Report result
    if (errors.length === 0) {
        toastr['success'](
            `Cloned ${cloned} lorebook${cloned === 1 ? '' : 's'} → prefix "${newPrefix}".\n` +
            `Now create a branch named "${newPrefix}" (or set the prefix override to "${newPrefix}") to link it.`,
            'Clone Stack',
            { timeOut: 8000 }
        );
    } else {
        toastr['warning'](
            `Cloned ${cloned}/${matchingBooks.length} books. Errors:\n${errors.join('\n')}`,
            'Clone Stack',
            { timeOut: 10000 }
        );
    }
}


// ── Chat-Linked State (deferred from state-manager.js — touches DOM + _historyViewIndex) ──

export function refreshQuestPrompt(s) {
    let prompt = DEFAULT_STOCK_PROMPTS.quests;
    if (!s.syspromptModules?.questsDeadlines && !s.syspromptModules?.questsFrustration) {
        prompt = prompt.replace(/  DEADLINE:.*\n/g, '');
        prompt = prompt.replace(/  FRUSTRATION_COEFF:.*\n/g, '');
        prompt = prompt.replace(/  MOOD:.*\n/g, '');
        prompt = prompt.replace(/- DEADLINE \/ FRUSTRATION_COEFF:.*\n/g, '');
        prompt = prompt.replace(/- FRUSTRATION_COEFF:.*\n/g, '');
        prompt = prompt.replace(/- The MOOD field.*\n/g, '');
    } else {
        if (!s.syspromptModules?.questsDeadlines) {
            prompt = prompt.replace(/  DEADLINE:.*\n/g, '');
            prompt = prompt.replace(/- DEADLINE.*\n/g, '');
        }
        if (!s.syspromptModules?.questsFrustration) {
            prompt = prompt.replace(/  FRUSTRATION_COEFF:.*\n/g, '');
            prompt = prompt.replace(/- FRUSTRATION_COEFF:.*\n/g, '');
            prompt = prompt.replace(/  MOOD:.*\n/g, '');
            prompt = prompt.replace(/- The MOOD field.*\n/g, '');
        }
    }
    if (!s.syspromptModules?.questsDifficulty) {
        prompt = prompt.replace(/  DIFFICULTY:.*\n/g, '');
        prompt = prompt.replace(/- For difficulty, use the DIFFICULTY marker.*\n/g, '');
    }
    if (!s.stockPrompts) s.stockPrompts = {};
    s.stockPrompts.quests = prompt;
}

/**
 * Restore a previously saved chat state into the live settings.
 * Returns true if a saved state was found, false if no state existed (clean slate).
 * @param {string} chatId
 * @returns {boolean}
 */
function loadChatState(chatId) {
    if (!chatId) return false;
    resetAutoGenerationTracking();
    const s = getSettings();
    const saved = s.chatStates?.[chatId];
    if (!saved) return false;

    s.currentMemo = saved.currentMemo ?? '';
    s.memoHistory = saved.memoHistory ?? [];
    s.lastDelta = saved.lastDelta ?? '';
    if (saved.modules) s.modules = { ...s.modules, ...saved.modules };
    if (saved.blockOrder) s.blockOrder = JSON.parse(JSON.stringify(saved.blockOrder));
    if (saved.stockPrompts) s.stockPrompts = loadStockPromptsFromProfile(saved.stockPrompts);
    if (saved.customFields) s.customFields = JSON.parse(JSON.stringify(saved.customFields));
    s.customPortraits = JSON.parse(JSON.stringify(saved.customPortraits || {}));
    // Restore persisted quests (incl. completed) so the UI can display them
    s.quests = JSON.parse(JSON.stringify(saved.quests || []));
    s.historyIndex = saved.historyIndex ?? -1;

    s.activeRouterKeys = JSON.parse(JSON.stringify(saved.activeRouterKeys || []));
    s.activeWorldKeys = JSON.parse(JSON.stringify(saved.activeWorldKeys || []));
    s.keywordActivatedKeys = JSON.parse(JSON.stringify(saved.keywordActivatedKeys || []));
    s.routerLog = JSON.parse(JSON.stringify(saved.routerLog || []));
    sanitizeRouterState(s);
    s.routerLookback = saved.routerLookback || 4;
    s.routerLastRunChatLength = saved.routerLastRunChatLength ?? 0;
    s.routerLastRunAt = saved.routerLastRunAt ?? 0;
    s.routerDirectPrompt = saved.routerDirectPrompt || '';
    s.worldProgressionLookback = saved.worldProgressionLookback ?? 20;
    s.worldProgressionHistoryLookback = saved.worldProgressionHistoryLookback ?? 0;
    s.worldProgressionInjectionPosition = saved.worldProgressionInjectionPosition ?? 4;
    s.worldProgressionInjectionDepth = saved.worldProgressionInjectionDepth ?? 4;
    s.worldProgressionInjectionRole = saved.worldProgressionInjectionRole ?? 0;
    s.worldProgressionRandomizeNPCs = saved.worldProgressionRandomizeNPCs ?? false;
    s.worldProgressionRandomSkeletonNPCCount = saved.worldProgressionRandomSkeletonNPCCount ?? 2;
    s.worldProgressionRandomNarrativeNPCCount = saved.worldProgressionRandomNarrativeNPCCount ?? 3;
    s.worldProgressionRandomizeLocations = saved.worldProgressionRandomizeLocations ?? false;
    s.worldProgressionRandomSkeletonLocationCount = saved.worldProgressionRandomSkeletonLocationCount ?? 2;
    s.worldProgressionRandomNarrativeLocationCount = saved.worldProgressionRandomNarrativeLocationCount ?? 2;
    s.worldProgressionRandomizeFactions = saved.worldProgressionRandomizeFactions ?? false;
    s.worldProgressionRandomSkeletonFactionCount = saved.worldProgressionRandomSkeletonFactionCount ?? 2;
    s.worldProgressionRandomNarrativeFactionCount = saved.worldProgressionRandomNarrativeFactionCount ?? 2;
    s.worldProgressionRandomizeConflicts = saved.worldProgressionRandomizeConflicts ?? false;
    s.worldProgressionRandomConflictCount = saved.worldProgressionRandomConflictCount ?? 3;
    s.worldProgressionSkeletonFactions = saved.worldProgressionSkeletonFactions ?? 4;
    s.worldProgressionSkeletonLocations = saved.worldProgressionSkeletonLocations ?? 4;
    s.worldProgressionSkeletonNPCs = saved.worldProgressionSkeletonNPCs ?? 0;
    s.worldProgressionSkeletonConflicts = saved.worldProgressionSkeletonConflicts ?? 3;
    s.worldProgressionSkeletonAtmosphereSummary = saved.worldProgressionSkeletonAtmosphereSummary ?? '';
    s.worldProgressionSkeletonAtmosphereLookback = saved.worldProgressionSkeletonAtmosphereLookback ?? 30;
    s.worldProgressionSkeletonUseExisting = saved.worldProgressionSkeletonUseExisting ?? true;
    s.worldProgressionExclusionList = saved.worldProgressionExclusionList ?? '';
    s.worldProgressionAutoExcludeParty = saved.worldProgressionAutoExcludeParty ?? false;
    s.worldProgressionLastFiredAtMinutes = saved.worldProgressionLastFiredAtMinutes ?? -1;
    s.worldProgressionLastFiredPeriodLabel = saved.worldProgressionLastFiredPeriodLabel || '';
    s.worldProgressionConsolidateEnabled = saved.worldProgressionConsolidateEnabled ?? false;
    s.worldProgressionConsolidateInterval = saved.worldProgressionConsolidateInterval ?? 7;

    s.portraitGeneratorSource = saved.portraitGeneratorSource ?? "native";
    s.portraitSkipPromptDialog = saved.portraitSkipPromptDialog ?? false;
    s.portraitAutoGenerateParty = saved.portraitAutoGenerateParty ?? false;
    s.portraitAutoGenerateEnemies = saved.portraitAutoGenerateEnemies ?? false;
    s.portraitAutoGenerateNpcs = saved.portraitAutoGenerateNpcs ?? false;
    s.portraitConnectionSource = saved.portraitConnectionSource ?? "default";
    s.portraitConnectionProfileId = saved.portraitConnectionProfileId || "";
    s.portraitCompletionPresetId = saved.portraitCompletionPresetId || "";
    s.portraitOllamaUrl = saved.portraitOllamaUrl || "http://localhost:11434";
    s.portraitOllamaModel = saved.portraitOllamaModel || "";
    s.portraitOpenaiUrl = saved.portraitOpenaiUrl || "";
    s.portraitOpenaiKey = saved.portraitOpenaiKey || "";
    s.portraitOpenaiModel = saved.portraitOpenaiModel || "";

    s.worldConnectionSource = saved.worldConnectionSource ?? "default";
    s.worldConnectionProfileId = saved.worldConnectionProfileId || "";
    s.worldCompletionPresetId = saved.worldCompletionPresetId || "";
    s.worldOllamaUrl = saved.worldOllamaUrl || "http://localhost:11434";
    s.worldOllamaModel = saved.worldOllamaModel || "";
    s.worldOpenaiUrl = saved.worldOpenaiUrl || "";
    s.worldOpenaiKey = saved.worldOpenaiKey || "";
    s.worldOpenaiModel = saved.worldOpenaiModel || "";

    s.gameSystemWizardConnectionSource = saved.gameSystemWizardConnectionSource ?? "default";
    s.gameSystemWizardConnectionProfileId = saved.gameSystemWizardConnectionProfileId || "";
    s.gameSystemWizardCompletionPresetId = saved.gameSystemWizardCompletionPresetId || "";
    s.gameSystemWizardOllamaUrl = saved.gameSystemWizardOllamaUrl || "http://localhost:11434";
    s.gameSystemWizardOllamaModel = saved.gameSystemWizardOllamaModel || "";
    s.gameSystemWizardOpenaiUrl = saved.gameSystemWizardOpenaiUrl || "";
    s.gameSystemWizardOpenaiKey = saved.gameSystemWizardOpenaiKey || "";
    s.gameSystemWizardOpenaiModel = saved.gameSystemWizardOpenaiModel || "";

    applyChatTimeFormatSettings(saved);
    applyChatNpcRelMaxSettings(saved);

    // Update settings UI inputs if rendered
    $('#rpg_world_progression_randomize_npcs').prop('checked', !!s.worldProgressionRandomizeNPCs);
    $('#rpg_world_progression_random_skeleton_npc_count').val(s.worldProgressionRandomSkeletonNPCCount ?? 2);
    $('#rpg_world_progression_random_narrative_npc_count').val(s.worldProgressionRandomNarrativeNPCCount ?? 3);
    $('#rpg_world_progression_randomize_locations').prop('checked', !!s.worldProgressionRandomizeLocations);
    $('#rpg_world_progression_random_skeleton_location_count').val(s.worldProgressionRandomSkeletonLocationCount ?? 2);
    $('#rpg_world_progression_random_narrative_location_count').val(s.worldProgressionRandomNarrativeLocationCount ?? 2);
    $('#rpg_world_progression_randomize_factions').prop('checked', !!s.worldProgressionRandomizeFactions);
    $('#rpg_world_progression_random_skeleton_faction_count').val(s.worldProgressionRandomSkeletonFactionCount ?? 2);
    $('#rpg_world_progression_random_narrative_faction_count').val(s.worldProgressionRandomNarrativeFactionCount ?? 2);

    $('#rpg_world_progression_skeleton_factions').val(s.worldProgressionSkeletonFactions ?? 4);
    $('#rpg_world_progression_skeleton_locations').val(s.worldProgressionSkeletonLocations ?? 4);
    $('#rpg_world_progression_skeleton_npcs').val(s.worldProgressionSkeletonNPCs ?? 0);
    $('#rpg_world_progression_skeleton_conflicts').val(s.worldProgressionSkeletonConflicts ?? 3);
    $('#rpg_world_progression_skeleton_atmosphere').val(s.worldProgressionSkeletonAtmosphereSummary);
    $('#rpg_world_progression_skeleton_atmosphere_lookback').val(s.worldProgressionSkeletonAtmosphereLookback);
    $('#rpg_world_progression_skeleton_use_existing').prop('checked', !!s.worldProgressionSkeletonUseExisting);
    $('#rpg_world_progression_exclusion_list').val(s.worldProgressionExclusionList);
    $('#rpg_world_progression_auto_exclude_party').prop('checked', !!s.worldProgressionAutoExcludeParty);

    // Sync portrait connection settings UI
    $('#rpg_portrait_generator_source').val(s.portraitGeneratorSource || 'native');
    $('#rpg_tracker_pollinations_group').toggle((s.portraitGeneratorSource || 'native') === 'pollinations');
    $('#rpg_tracker_portrait_skip_prompt').prop('checked', !!s.portraitSkipPromptDialog);
    $('#rpg_tracker_portrait_auto_party').prop('checked', !!s.portraitAutoGenerateParty);
    $('#rpg_tracker_portrait_auto_enemies').prop('checked', !!s.portraitAutoGenerateEnemies);
    $('#rpg_tracker_portrait_auto_npcs').prop('checked', !!s.portraitAutoGenerateNpcs);
    syncNpcPortraitDependentUi(s);
    $('#rpg_tracker_show_total_value').prop('checked', s.showTotalInventoryValue !== false);
    $('#rpg_tracker_inventory_worth_mode').val(s.inventoryWorthMode || 'hover');
    $('#rpg_portrait_connection_source').val(s.portraitConnectionSource || 'default');
    $('#rpg_portrait_connection_profile').val(s.portraitConnectionProfileId || '');
    $('#rpg_portrait_completion_preset').val(s.portraitCompletionPresetId || '');
    $('#rpg_portrait_ollama_url').val(s.portraitOllamaUrl || 'http://localhost:11434');
    $('#rpg_portrait_ollama_model').val(s.portraitOllamaModel || '');
    $('#rpg_portrait_openai_url').val(s.portraitOpenaiUrl || '');
    $('#rpg_portrait_openai_key').val(s.portraitOpenaiKey || '');
    $('#rpg_portrait_openai_model').val(s.portraitOpenaiModel || '');
    $('#rpg_portrait_openai_model_manual').val(s.portraitOpenaiModel || '');

    // Sync world progression connection settings UI
    $('#rpg_world_connection_source').val(s.worldConnectionSource || 'default');
    $('#rpg_world_connection_profile').val(s.worldConnectionProfileId || '');
    $('#rpg_world_completion_preset').val(s.worldCompletionPresetId || '');
    $('#rpg_world_ollama_url').val(s.worldOllamaUrl || 'http://localhost:11434');
    $('#rpg_world_ollama_model').val(s.worldOllamaModel || '');
    $('#rpg_world_openai_url').val(s.worldOpenaiUrl || '');
    $('#rpg_world_openai_key').val(s.worldOpenaiKey || '');
    $('#rpg_world_openai_model').val(s.worldOpenaiModel || '');
    $('#rpg_world_openai_model_manual').val(s.worldOpenaiModel || '');

    $('#rpg_gs_wizard_connection_source').val(s.gameSystemWizardConnectionSource || 'default');
    $('#rpg_gs_wizard_connection_profile').val(s.gameSystemWizardConnectionProfileId || '');
    $('#rpg_gs_wizard_completion_preset').val(s.gameSystemWizardCompletionPresetId || '');
    $('#rpg_gs_wizard_ollama_url').val(s.gameSystemWizardOllamaUrl || 'http://localhost:11434');
    $('#rpg_gs_wizard_ollama_model').val(s.gameSystemWizardOllamaModel || '');
    $('#rpg_gs_wizard_openai_url').val(s.gameSystemWizardOpenaiUrl || '');
    $('#rpg_gs_wizard_openai_key').val(s.gameSystemWizardOpenaiKey || '');
    $('#rpg_gs_wizard_openai_model').val(s.gameSystemWizardOpenaiModel || '');
    $('#rpg_gs_wizard_openai_model_manual').val(s.gameSystemWizardOpenaiModel || '');

    // Toggle container visibilities
    $('#rpg_portrait_profile_group').toggle(s.portraitConnectionSource === 'profile');
    $('#rpg_portrait_ollama_group').toggle(s.portraitConnectionSource === 'ollama');
    $('#rpg_portrait_openai_group').toggle(s.portraitConnectionSource === 'openai');
    $('#rpg_world_profile_group').toggle(s.worldConnectionSource === 'profile');
    $('#rpg_world_ollama_group').toggle(s.worldConnectionSource === 'ollama');
    $('#rpg_world_openai_group').toggle(s.worldConnectionSource === 'openai');
    $('#rpg_gs_wizard_profile_group').toggle(s.gameSystemWizardConnectionSource === 'profile');
    $('#rpg_gs_wizard_ollama_group').toggle(s.gameSystemWizardConnectionSource === 'ollama');
    $('#rpg_gs_wizard_openai_group').toggle(s.gameSystemWizardConnectionSource === 'openai');

    const wpPosSelect = $('#rpg_world_progression_injection_position');
    const wpPosition = s.worldProgressionInjectionPosition ?? 4;
    const wpRole = s.worldProgressionInjectionRole ?? 0;
    const wpRoleAttr = wpPosition === 4 ? String(wpRole) : '';
    wpPosSelect.find(`option[value="${wpPosition}"][data-role="${wpRoleAttr}"]`).prop('selected', true);

    $('#rpg_world_progression_injection_depth').val(s.worldProgressionInjectionDepth ?? 3);

    if (wpPosition === 4) {
        $('#rpg_world_progression_injection_depth_container').show();
    } else {
        $('#rpg_world_progression_injection_depth_container').hide();
    }

    // Toggle container visibilities
    if (s.worldProgressionRandomizeNPCs) $('#rpg_world_progression_random_npc_count_container').show();
    else $('#rpg_world_progression_random_npc_count_container').hide();
    if (s.worldProgressionRandomizeLocations) $('#rpg_world_progression_random_location_count_container').show();
    else $('#rpg_world_progression_random_location_count_container').hide();
    if (s.worldProgressionRandomizeFactions) $('#rpg_world_progression_random_faction_count_container').show();
    else $('#rpg_world_progression_random_faction_count_container').hide();


    // Sync World Progression timing readouts for this chat
    {
        function _fmtWpMins(totalMins) {
            return formatInWorldTime(totalMins);
        }
        const label = s.worldProgressionLastFiredPeriodLabel || '';
        const labelMins = label ? parseInWorldTime(label) : -1;
        const lastText = label || 'Never';
        $('#rpg_world_progression_last_fired').text(lastText);
        $('#rpg_world_progression_last_report_val').text(lastText);
        const intervalMinutes = (s.worldProgressionIntervalHours || 24) * 60;
        let nextMins = -1;
        if (labelMins >= 0) {
            nextMins = labelMins + intervalMinutes;
        } else {
            const tMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
            const tStr = tMatch ? extractCurrentTimeStr(tMatch[1]) : '';
            const tMins = tStr ? parseInWorldTime(tStr) : -1;
            if (tMins >= 0) nextMins = tMins + intervalMinutes;
        }
        $('#rpg_world_progression_next_report_val').text(nextMins >= 0 ? _fmtWpMins(nextMins) : '—');

        // Sync consolidation fields
        $('#rpg_world_progression_consolidate_enabled').prop('checked', !!s.worldProgressionConsolidateEnabled);
        $('#rpg_world_progression_consolidate_interval').val(s.worldProgressionConsolidateInterval ?? 7);
        if (s.worldProgressionConsolidateEnabled) {
            $('#rpg_world_progression_consolidate_interval_container').show();
        } else {
            $('#rpg_world_progression_consolidate_interval_container').hide();
        }
    }

    // Don't restore routerCampaignPrefix from per-chat saved state — the prefix
    // is fully derivable from the chat ID and must be re-derived live by
    // onChatChanged. Restoring a stale value (e.g. a bare "Assistant" from
    // a previous buggy run) would cause greedy lorebook matching.

    _historyViewIndex = -1;

    // Derive settings.quests from memo and strip archived quests from stored memo text.
    s.currentMemo = applyQuestSyncAndStripMemo(s.currentMemo);

    const dp = document.getElementById('rpg-tracker-delta-content');
    if (dp) dp.innerHTML = s.lastDelta || '<span class="delta-empty">No changes yet.</span>';

    refreshOrderList();
    syncMemoView();
    scheduleAutoApply();

    // Refresh Lorebook Agent UI
    if (typeof renderRouterUI === 'function') {
        renderRouterUI();
    }
    scheduleAgentManifestRefresh();

    // Patch any managed entries that don't yet have disable:true so ST's
    // native keyword scanner cannot inject them on user-message send.
    if (s.routerEnabled) {
        scheduleDeferred(() => {
            disableManagedEntries().catch(e => console.warn('[RPG Tracker] disableManagedEntries on chat change failed:', e));
        });
    }

    if (typeof globalThis._rpgUpdateSkeletonStatus === 'function') {
        globalThis._rpgUpdateSkeletonStatus();
    }

    return true;
}

/**
 * Installs a transient prompt interceptor to inject active lore keys
 * into the main narrator's prompt. This is non-mutating and clean.
 */
/**
 * Updates the persistent SillyTavern extension prompt with the currently active lore.
 * This is the preferred method for older/stable ST versions.
 */
async function refreshExtensionPrompt() {
    const ctx = SillyTavern.getContext();
    const { setExtensionPrompt } = ctx;
    if (typeof setExtensionPrompt !== 'function') return;

    const s = getSettings();
    if (!s.routerEnabled || (!s.activeRouterKeys?.length && !s.activeWorldKeys?.length)) {
        setExtensionPrompt('rpg_tracker_lore', '', 0, 0); // Clear if disabled
        return;
    }

    try {
        let injectedContext = "";
        const books = {};
        for (const k of s.activeRouterKeys) {
            const [bookName] = k.split('::');
            const isWorld = bookName.toLowerCase().endsWith('_world') || bookName.toLowerCase() === 'world';
            if (isWorld) continue;
            if (!books[bookName]) books[bookName] = await ctx.loadWorldInfo(bookName);
        }

        for (const k of s.activeRouterKeys) {
            const [bookName, uid] = k.split('::');
            const isWorld = bookName.toLowerCase().endsWith('_world') || bookName.toLowerCase() === 'world';
            if (isWorld) continue;
            const entry = books[bookName]?.entries?.[uid];
            if (entry && entry.content) {
                injectedContext += `### [${entry.key?.[0] || entry.comment || uid}]\n${entry.content}\n\n`;
            }
        }

        let worldBlock = "";
        if (s.worldProgressionEnabled && s.activeWorldKeys?.length) {
            const worldBooks = {};
            for (const k of s.activeWorldKeys) {
                const [bookName] = k.split('::');
                if (!worldBooks[bookName]) worldBooks[bookName] = await ctx.loadWorldInfo(bookName);
            }
            const sortedKeys = [...s.activeWorldKeys].sort((a, b) => {
                const [, uidA] = a.split('::');
                const [, uidB] = b.split('::');
                return Number(uidA) - Number(uidB);
            });
            for (const k of sortedKeys) {
                const [bookName, uid] = k.split('::');
                const entry = worldBooks[bookName]?.entries?.[uid];
                if (entry && entry.content) {
                    worldBlock += `### [${entry.key?.[0] || entry.comment || 'World Report'}]\n${entry.content}\n\n`;
                }
            }
        }

        if (injectedContext || worldBlock) {
            let routerBlock = "";
            if (injectedContext) {
                routerBlock += `## ROUTER ACTIVE LORE\n${injectedContext.trim()}\n\n`;
            }
            if (worldBlock) {
                routerBlock += `## WORLD PROGRESSION REPORTS\n${worldBlock.trim()}\n\n`;
            }
            routerBlock = routerBlock.trim();
            // Set as an extension prompt using default active lore injection position and depth
            const position = s.loreInjectionPosition ?? 0;
            const depth = s.loreInjectionDepth ?? 0;
            setExtensionPrompt('rpg_tracker_lore', routerBlock, position, depth);
        } else {
            setExtensionPrompt('rpg_tracker_lore', '', 0, 0);
        }
    } catch (e) {
        console.error("[Router Agent] Failed to update extension prompt:", e);
    }
}

function installRouterInterceptor() {
    const ctx = SillyTavern.getContext();
    const { addPromptManagerInterceptor, addChatInterceptor, addInterceptor } = ctx;

    // DISABLED: The addPromptManagerInterceptor path was a SECOND injection that
    // duplicated the work already handled by rpgTrackerInterceptor in narrative-hooks.js
    // (the manifest generate_interceptor). Having both active caused:
    //   1. Double-injection of RNG/MEMO/LORE into the prompt
    //   2. Cache breakage — this path used routerDefaultDepth (sliding), while
    //      narrative-hooks.js uses a fixed depth=1 for prefix-cache protection
    // All injection is now exclusively handled by narrative-hooks.js.
    // Clear any stale extension prompt from previous runs.
    const { setExtensionPrompt } = ctx;
    if (typeof setExtensionPrompt === 'function') {
        setExtensionPrompt('rpg_tracker_lore', '', 0, 0);
    }
    console.debug('[RPG Tracker] Lore injection handled exclusively by rpgTrackerInterceptor (narrative-hooks.js). setExtensionPrompt cleared.');
}

/**
 * Sanitizes a ST chat ID into a filesystem/lorebook-safe prefix.
 * The chat ID is already unique per session, so it's used verbatim
 * with only unsafe characters replaced.
 * @param {string} chatId
 * @returns {string}
 */
function derivePrefixFromChatId(chatId) {
    return sanitizeCampaignPrefixString(chatId);
}

/**
 * Updates the campaign prefix readout in Extension settings and the Lorebook Agent panel.
 * @param {string} [raw] - Prefix string, or empty / whitespace for "—".
 */
function syncRouterPrefixDisplays(raw) {
    const label = (raw && String(raw).trim()) ? String(raw).trim() : '—';
    const settingsEl = document.getElementById('rpg_tracker_router_prefix_display');
    if (settingsEl) settingsEl.textContent = label;
    const agentEl = document.getElementById('rt-agent-router-prefix-display');
    if (agentEl) agentEl.textContent = label;
}

/**
 * Called on CHAT_CHANGED. Saves the departing chat's state,
 * then loads the arriving chat's state — or resets the memo if
 * this is a new/unseen chat (no saved state).
 * @param {string} newChatId
 */
function onChatChanged(newChatId) {
    const s = getSettings();

    const oldChatId = _currentChatId;
    _currentChatId = newChatId || null;

    // Snapshot the departing chat's state BEFORE resetRouterTick mutates shared pools.
    // resetRouterTick(true) zeroes keywordActivatedKeys in-place; if saveChatState ran
    // after that, the yellow-pill keyword state for the departing chat would be lost.
    // Guard matches the later chatLinkEnabled block so we only persist when linking is on.
    if (s.chatLinkEnabled && oldChatId) saveChatState(oldChatId);

    // Reset the run-every tick so the agent fires promptly on the first generation of each chat.
    // Only clear keyword-activated lore when actually switching to a different chat.
    // Same-chat reloads (swipe, regenerate) must preserve the keyword pool.
    const isActualChange = oldChatId !== newChatId;
    resetRouterTick(isActualChange);

    if (isActualChange) {
        void resetCombatProfileOverride(s);
    }

    // Auto-activate and prefix logic run regardless of chatLinkEnabled.
    // Always re-derive the prefix from the chat ID so stale saved data never
    // causes the wrong session's lorebooks to activate.
    const prefix = getEffectiveRouterCampaignPrefix(newChatId);
    s.routerCampaignPrefix = prefix || '';
    syncRouterPrefixDisplays(prefix || '');

    // ── INSTANT UI REFRESH ──
    if (isActualChange) scheduleAgentManifestRefresh(true);

    // ── INSTANT UI REFRESH ──
    // Now that _currentChatId AND routerCampaignPrefix are both correct,
    // fire an immediate manifest refresh. The PC card is already in chatStates
    // memory so it renders in <1ms. force=true bypasses isAgentPanelVisible().


    // F5 / same-chat reload: init BOOTSTRAP already activated lorebooks and loadChatState ran.
    if (!isActualChange) {
        updateChatLinkUI();
        return;
    }

    // Init BOOTSTRAP may have just finished activation for this chat — skip duplicate /world pass.
    if (newChatId && newChatId === _sessionBootstrapChatId) {
        _sessionBootstrapChatId = null;
        updateChatLinkUI();
        return;
    }

    const chatBooks = s.chatStates?.[newChatId]?.campaignBooks;

    if (chatBooks?.length) {
        // Fast Path: This chat has a linked stack already recorded.
        // Swap stacks instantly without the 800ms delay or the slow registry scan.
        if (typeof SillyTavern.getContext().executeSlashCommandsWithOptions === 'function') {
            (async () => {
                const ctx = SillyTavern.getContext();
                // 1. Turn OFF departing chat's books
                const oldBooks = s.chatStates?.[oldChatId]?.campaignBooks || [];
                for (const name of oldBooks) {
                    await ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${name}"`).catch(() => { });
                }
                // Also turn off departing chat's world book explicitly
                const oldPrefix = getEffectiveRouterCampaignPrefix(oldChatId);
                const oldWorldBookName = oldPrefix ? `${oldPrefix}_World` : 'World';
                await ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${oldWorldBookName}"`).catch(() => { });

                // 2. Turn ON arriving chat's books
                for (const name of chatBooks) {
                    await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${name}"`).catch(() => { });
                }
                // Turn ON arriving chat's world book explicitly if World Progression is enabled
                const newWorldBookName = prefix ? `${prefix}_World` : 'World';
                if (s.worldProgressionEnabled) {
                    await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${newWorldBookName}"`).catch(() => { });
                } else {
                    await ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${newWorldBookName}"`).catch(() => { });
                }
                // Re-render folder counts and active dots once the /world transitions complete
                scheduleAgentManifestRefresh(true);
            })();
        }
    } else if (s.routerEnabled && newChatId) {
        // No linked stack yet for the arriving chat.
        // Capture the departing chat's book list NOW (before any async gap).
        const _oldBooksDeferred = s.chatStates?.[oldChatId]?.campaignBooks || [];

        // Helper: turn off the old books using only the known list — no registry scan.
        const _deactivateOldBooks = async () => {
            const _ctx = SillyTavern.getContext();
            if (typeof _ctx.executeSlashCommandsWithOptions !== 'function') return;
            if (_oldBooksDeferred.length) {
                for (const name of _oldBooksDeferred) {
                    await _ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${name}"`).catch(() => { });
                }
            }
            // Also explicitly turn off departing chat's world book
            const oldPrefix = getEffectiveRouterCampaignPrefix(oldChatId);
            const oldWorldBookName = oldPrefix ? `${oldPrefix}_World` : 'World';
            await _ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${oldWorldBookName}"`).catch(() => { });
        };

        // Cancel any pending derivation from a previous CHAT_CHANGED.
        if (_prefixDeriveTimer) clearTimeout(_prefixDeriveTimer);
        _prefixDeriveTimer = setTimeout(async () => {
            _prefixDeriveTimer = null;
            if (newChatId !== _currentChatId) return;

            // If init BOOTSTRAP is still running the registry scan, wait for it instead of duplicating.
            if (_bootstrapSyncPromise) {
                try { await _bootstrapSyncPromise; } catch (_) { }
                if (getSettings().chatStates?.[newChatId]?.campaignBooks?.length) {
                    await _deactivateOldBooks();
                    return;
                }
            }

            // Pass 1 (~800ms): deactivate before the registry scan so books vanish fast.
            await _deactivateOldBooks();

            // Discover if the new chat actually has any linked books (needs registry scan).
            await syncCampaignPrefixAndWorldsForChat(newChatId, 'CHAT_CHANGED(debounced)');

            // Pass 2 (~after scan): ST's deferred world-info state restoration can re-pin
            // globally active books AFTER our first pass. A follow-up sweep catches this
            // without needing another registry scan — just direct /world state=off commands.
            if (newChatId === _currentChatId) {
                await _deactivateOldBooks();
            }
        }, 800);
    }

    if (!s.chatLinkEnabled) {
        // World Progression "last fired" is operational per-chat state and must never bleed
        // between scenarios regardless of chatLinkEnabled. Reset it unconditionally on actual switch.
        if (isActualChange) {
            s.worldProgressionLastFiredAtMinutes = -1;
            s.worldProgressionLastFiredPeriodLabel = '';
            s.quests = [];
            refreshRenderedView();
        }
        updateChatLinkUI();
        return;
    }

    // saveChatState(oldChatId) already called above, before resetRouterTick.

    const found = loadChatState(newChatId);
    if (!found) {
        s.currentMemo = '';
        s.memoHistory = [];
        s.lastDelta = '';
        s.quests = [];
        s.activeRouterKeys = [];
        s.activeWorldKeys = [];
        s.routerLog = [];
        s.worldProgressionLastFiredAtMinutes = -1;
        s.worldProgressionLastFiredPeriodLabel = '';

        applyChatTimeFormatSettings(null);
        applyChatNpcRelMaxSettings(null);
        refreshOrderList();
        scheduleAutoApply();

        _historyViewIndex = -1;

        const dp = document.getElementById('rpg-tracker-delta-content');
        if (dp) dp.innerHTML = '<span class="delta-empty">No changes yet.</span>';

        updateUIMemo('');
        refreshRenderedView();
        if (typeof renderRouterUI === 'function') {
            renderRouterUI();
        }
    }

    scheduleAgentManifestRefresh();
    updateChatLinkUI();

    if (isActualChange) {
        void syncCombatProfile(s.currentMemo, s);
    }
}







/**
 * Syncs the 🔗/🔓 icon in the panel header and the settings checkbox
 * to reflect the current chatLinkEnabled state.
 */
function updateChatLinkUI() {
    const s = getSettings();
    const on = s.chatLinkEnabled;

    const btn = document.getElementById('rpg-tracker-chat-link-btn');
    const footerBtn = document.getElementById('rpg-tracker-chat-link-footer-btn');
    const linkTitle = on
        ? `Chat Link ON — state is bound to the active chat\n(Click to unlock / use global state)`
        : `Chat Link OFF — using global state\n(Click to re-lock to current chat)`;
    const linkLabel = on ? '🔗 Link' : '🔓 Unlinked';

    if (btn) {
        btn.textContent = on ? '🔗' : '🔓';
        btn.title = linkTitle;
    }
    if (footerBtn) {
        footerBtn.textContent = linkLabel;
        footerBtn.title = linkTitle;
    }

    const cb = document.getElementById('rpg_tracker_chat_link_enabled');
    if (cb instanceof HTMLInputElement) cb.checked = on;
}

/**
 * Update the visual status of the panel (active, running, paused, disabled)
 */
function updatePanelStatus() {
    const settings = getSettings();
    const panel = document.getElementById('rpg-tracker-panel');
    const indicator = document.getElementById('rpg-tracker-status');
    const pauseBtn = document.getElementById('rpg-tracker-pause-btn');
    const pauseBanner = document.getElementById('rpg-tracker-pause-banner');
    const enableBtn = /** @type {HTMLElement|null} */ (document.getElementById('rpg-tracker-enable-btn'));

    if (!panel || !indicator || !pauseBtn) return;

    // Keep in-panel power button in sync
    if (enableBtn) {
        enableBtn.style.opacity = settings.enabled ? '' : '0.35';
        enableBtn.title = settings.enabled ? 'Disable State Tracker' : 'Enable State Tracker';
    }
    // Keep settings sidebar checkbox in sync
    const sidebarEnableCheck = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_enabled'));
    if (sidebarEnableCheck) sidebarEnableCheck.checked = !!settings.enabled;

    const agentPanels = document.querySelectorAll('.rpg-tracker-agent-panel');

    if (!settings.enabled) {
        // Fully disabled — transparent panel, no banner
        panel.classList.add('is-disabled');
        panel.classList.remove('is-paused');
        agentPanels.forEach(ap => {
            ap.classList.add('is-disabled');
            const header = ap.querySelector('.rpg-tracker-header');
            if (header) /** @type {HTMLElement} */ (header).style.pointerEvents = 'auto';
        });
        indicator.classList.remove('active');
        // Always keep the header clickable so the user can re-enable (belt-and-suspenders over the CSS rule)
        const header = panel.querySelector('.rpg-tracker-header');
        if (header) /** @type {HTMLElement} */ (header).style.pointerEvents = 'auto';
        pauseBtn.textContent = '▶';
        pauseBtn.title = 'Resume Tracker';
        if (pauseBanner) pauseBanner.textContent = '';
    } else if (settings.paused) {
        // Paused — visible panel, pause banner shown
        panel.classList.remove('is-disabled');
        panel.classList.add('is-paused');
        agentPanels.forEach(ap => {
            ap.classList.remove('is-disabled');
        });
        indicator.classList.add('active');
        pauseBtn.textContent = '▶';
        pauseBtn.title = 'Resume Tracker';
        if (pauseBanner) pauseBanner.textContent = 'TRACKER UPDATES PAUSED';
    } else {
        // Active
        panel.classList.remove('is-disabled');
        panel.classList.remove('is-paused');
        agentPanels.forEach(ap => {
            ap.classList.remove('is-disabled');
        });
        indicator.classList.add('active');
        pauseBtn.textContent = '⏸';
        pauseBtn.title = 'Pause Tracker';
        if (pauseBanner) pauseBanner.textContent = '';
    }

    if (_stateModelRunning) {
        indicator.classList.add('running');
    } else {
        indicator.classList.remove('running');
    }
}

/**
 * The State Model pass: Extract state changes from the narrative.
 * @param {string} narrativeOutput The last narrative message to parse.
 * @param {boolean} isFullContext Whether to perform a long-horizon audit of the entire chat.
 */
async function runStateModelPass(narrativeOutput, isFullContext = false, overrideLookback = null) {
    const settings = getSettings();

    // Deterministic logic: Auto-fail quests past deadline (if not using frustration)
    checkQuestDeadlines();

    const { generateRaw } = SillyTavern.getContext();

    if (!generateRaw) {
        console.error("[RPG Tracker] generateRaw not found in context.");
        return;
    }

    try {
        _stateModelRunning = true;
        updateStatusIndicator('running');

        // Abort previous if any
        if (_stateController) _stateController.abort();
        _stateController = new AbortController();
        const signal = _stateController.signal;

        const modulesText = buildModulesInstructionText(settings);
        let systemPrompt = settings.systemPromptTemplate.replace('{{modulesText}}', modulesText);
        if (settings.useDdMmYyFormat) {
            systemPrompt = systemPrompt
                .replace(/\[Day\s+X,\s+HH:MM\]/g, '[DD/MM/YYYY, HH:MM]')
                .replace(/Day\s+3,\s+14:00/g, '03/01/2026, 14:00')
                .replace(/Day\s+1,\s+11:52/g, '01/01/2026, 11:52')
                .replace(/Day\s+1/g, '01/01/2026')
                .replace(/Day\s+2/g, '02/01/2026')
                .replace(/Day\s+3/g, '03/01/2026')
                .replace(/Day\s+4/g, '04/01/2026')
                .replace(/Day\s+6/g, '06/01/2026')
                .replace(/Day\s+N/g, 'DD/MM/YYYY')
                .replace(/Day\s+X/g, 'DD/MM/YYYY');
        }
        if (isFullContext) {
            systemPrompt = systemPrompt
                .replace(/Only output sections that actually changed/gi, 'Perform a full audit of the narrative history and output the COMPLETE state for all enabled modules')
                .replace(/Omit unchanged sections entirely/gi, 'Do NOT omit any section; output a complete, verified state memo');
        }


        const worldLore = await buildLorebookContext();
        const worldLoreSection = worldLore ? worldLore + '\n\n' : '';

        const { chat } = SillyTavern.getContext();
        let chunks = [];

        if (isFullContext) {
            const maxContextLimit = SillyTavern.getContext().contextSize || settings.fullAuditMaxTokens || 32000;
            const tokenBuffer = 3000;
            const chunkTokenLimit = Math.max(1000, maxContextLimit - tokenBuffer);

            let currentChunk = [];
            let currentTokens = 0;

            for (const m of chat) {
                const name = m.is_user ? 'Player' : (m.name || 'Narrator');
                const content = cleanToolCallMessage(m.mes || m['content'] || '');
                if (content === null) continue;
                const line = `${name}: ${content}`;
                const lineTokens = Math.ceil(line.length / 4);

                if (currentTokens + lineTokens > chunkTokenLimit && currentChunk.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = [];
                    currentTokens = 0;
                }
                currentChunk.push(line);
                currentTokens += lineTokens;
            }
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
            }
        } else {
            const sinceLastUser = settings.lookbackSinceLastUser !== false; // default true
            let startIdx;
            if (sinceLastUser) {
                // Walk backward to find the most recent user message, then include it
                // and everything after it — this captures full turns even when tool calls
                // produce multiple intermediate messages between user and final response.
                startIdx = chat.length - 1;
                while (startIdx > 0 && !chat[startIdx].is_user) {
                    startIdx--;
                }
                // If no user message was found (all-AI chat) fall back to last 2
                if (startIdx === 0 && !chat[0]?.is_user) {
                    startIdx = Math.max(0, chat.length - 2);
                }
            } else {
                const N = overrideLookback !== null ? overrideLookback : (settings.lookbackMessages !== undefined ? settings.lookbackMessages : 2);
                startIdx = Math.max(0, chat.length - N);
            }
            const recentChat = chat.slice(startIdx);
            const chatLogLines = recentChat.map(m => {
                const name = m.is_user ? 'Player' : (m.name || 'Narrator');
                const content = cleanToolCallMessage(m.mes || m['content'] || '');
                if (content === null) return null;
                return `${name}: ${content}`;
            }).filter(line => line !== null);
            chunks.push(chatLogLines);
        }

        let priorMemoText = `## TRACKER STATE 0 (Current)\n${stripMemoHtml(stripCompletedQuestsFromMemo(settings.currentMemo))}\n\n`;
        const historyCount = (settings.trackerHistoryCount || 1) - 1;
        if (historyCount > 0 && settings.memoHistory && settings.memoHistory.length > 0) {
            const historyToInclude = settings.memoHistory.slice(0, historyCount).reverse();
            const historyString = historyToInclude.map((memo, i) => {
                const offset = -(historyToInclude.length - i);
                return `## TRACKER STATE ${offset}\n${stripMemoHtml(stripCompletedQuestsFromMemo(memo))}`;
            }).join('\n\n');
            priorMemoText = historyString + '\n\n' + priorMemoText;
        }

        // ── Per-chunk commit helper ──
        // Treats each chunk result as a full "turn": commits to settings, archives history,
        // updates UI, and saves — so the next chunk sees the committed state.
        function commitChunkResult(merged, previousMemoSnapshot) {
            const delta = computeDelta(previousMemoSnapshot, merged);

            // Linear Stone History Logic
            if (settings.historyIndex !== undefined && settings.historyIndex !== -1) {
                if (settings.debugMode) console.log(`[RPG Tracker] Splicing history at index ${settings.historyIndex} due to new update.`);
                settings.memoHistory = settings.memoHistory.slice(settings.historyIndex);
            }
            if (settings.memoHistory[0] !== previousMemoSnapshot) {
                settings.memoHistory.unshift(previousMemoSnapshot);
            }
            settings.memoHistory.unshift(merged);
            if (settings.memoHistory.length > 1000) settings.memoHistory.length = 1000;
            settings.historyIndex = 0;
            _historyViewIndex = -1;

            // Persist delta and update panel
            settings.lastDelta = delta;
            const deltaPanel = document.getElementById('rpg-tracker-delta-content');
            if (deltaPanel) deltaPanel.innerHTML = delta;

            // Commit to settings
            settings.prevMemo2 = settings.prevMemo1;
            settings.prevMemo1 = previousMemoSnapshot;
            settings.currentMemo = applyQuestSyncAndStripMemo(merged);
            updateUIMemo(settings.currentMemo);
            syncMemoView();
            refreshRenderedView();
            saveSettings();

            if (/LEVEL_UP=true/i.test(merged)) {
                handleLevelUp();
            }

            return delta;
        }

        let lastDelta = '';

        for (let i = 0; i < chunks.length; i++) {
            if (signal.aborted) break;

            // Snapshot the memo BEFORE this chunk processes, so delta/history is per-chunk
            const memoBeforeThisChunk = settings.currentMemo.replace(/<\/?memo>/gi, '').trim();

            if (isFullContext && chunks.length > 1) {
                toastr.info(`Running Full Audit: Chunk ${i + 1} of ${chunks.length}...`, "RPG Tracker", { timeOut: 5000 });
                updateStatusIndicator('running', `Chunk ${i + 1}/${chunks.length}`);
            }

            const chatLog = chunks[i].join('\n\n');
            let userPrompt = "";

            if (isFullContext) {
                // For full audit, always read the LIVE committed memo for the prior
                userPrompt =
                    worldLoreSection +
                    `## PRIOR MEMO\n${stripMemoHtml(stripCompletedQuestsFromMemo(settings.currentMemo)) || '(empty)'}\n\n` +
                    `## NARRATIVE HISTORY (Chunk ${i + 1} of ${chunks.length})\n${chatLog}\n\n` +
                    `## TASK\nAnalyze the narrative chunk provided above. Rebuild the State Memo to ensure every detail is perfectly accurate to this point in the story. Correct any errors or omissions found in the Prior Memo.\n\n` +
                    `## OUTPUT THE COMPLETE VERIFIED STATE MEMO:`;
            } else {
                userPrompt =
                    worldLoreSection +
                    priorMemoText +
                    `## NARRATIVE HISTORY (Last ${chunks[i].length} messages)\n${chatLog}\n\n` +
                    (settings.userPromptSuffix || `## OUTPUT ONLY CHANGED SECTIONS:`);
            }

            const result = await sendStateRequest(settings, systemPrompt, userPrompt);

            if (result && typeof result === 'string') {
                if (settings.debugMode) console.log(`[RPG Tracker] Raw Result (Chunk ${i + 1}):`, result);

                let cleanedOutput = result;
                const memoBlocks = [...result.matchAll(/<memo>([\s\S]*?)<\/memo>/gi)];
                if (memoBlocks.length > 0) {
                    cleanedOutput = memoBlocks[memoBlocks.length - 1][1].trim();
                } else {
                    cleanedOutput = result.replace(/<\/?memo>/gi, '').trim();
                }

                const merged = mergeMemo(memoBeforeThisChunk, cleanedOutput);

                if (settings.debugMode) {
                    console.log(`[RPG Tracker] Memo ${merged !== memoBeforeThisChunk ? 'updated' : 'unchanged'} after chunk ${i + 1}.`);
                }

                // ── FULL COMMIT: treat this chunk as a completed turn ──
                lastDelta = commitChunkResult(merged, memoBeforeThisChunk);

                // Stamp the pre-commit memo snapshot and result on the message for swipe rollback/restore
                if (getSettings().stateTrackerSwipeRollback !== false) {
                    const { chat: _sc } = SillyTavern.getContext();
                    const _lastAi = _sc ? [..._sc].reverse().find(m => !m.is_user) : null;
                    if (_lastAi) {
                        _lastAi.extra = _lastAi.extra || {};
                        const _sid = _lastAi.swipe_id ?? 0;
                        _lastAi.extra.rpgMemoRollback = _lastAi.extra.rpgMemoRollback || {};
                        _lastAi.extra.rpgMemoRollback[_sid] = memoBeforeThisChunk;
                        _lastAi.extra.rpgMemoResult = _lastAi.extra.rpgMemoResult || {};
                        _lastAi.extra.rpgMemoResult[_sid] = merged;
                    }
                }

                if (settings.debugMode) console.log(`[RPG Tracker] Chunk ${i + 1}/${chunks.length} committed.`);
            }
        }

        if (settings.debugMode) console.log("[RPG Tracker] State Model pass complete.");
        return lastDelta;
    } catch (error) {
        if (error.name === 'AbortError') {
            if (settings.debugMode) console.log("[RPG Tracker] State Model pass aborted by user.");
            return;
        }
        console.error("[RPG Tracker] State Model pass failed:", error);
    } finally {
        _stateModelRunning = false;
        _stateController = null;
        updateStatusIndicator('active');
    }
}

// ── Phase-5 bridge: exposes runStateModelPass for narrative-hooks.js/onGenerationEnded ──
// Removed when memo-processor.js is created in Phase 5.
globalThis._rpgRunStateModelPass = runStateModelPass;
globalThis._rpgStateModelRunning = () => _stateModelRunning;
globalThis._rpgCurrentChatId = () => _currentChatId;
globalThis._rpgResetRouterAutoTick = resetRouterAutoTick;
// Expose live prefix derivation for any module that needs the current prefix.
globalThis._rpgGetCurrentPrefix = () => getEffectiveRouterCampaignPrefix(SillyTavern.getContext().chatId || '');
globalThis._rpgUpdateUIMemo = (text) => {
    if (typeof updateUIMemo === 'function') updateUIMemo(text);
    if (typeof syncMemoView === 'function') syncMemoView();
    if (typeof refreshRenderedView === 'function') refreshRenderedView();
};

function handleLevelUp() {
    const { sendSystemMessage } = SillyTavern.getContext();
    toastr['success']("Level Up Detected! System prompt injected.", "RPG Tracker");

    if (sendSystemMessage) {
        sendSystemMessage('generic', "SYSTEM: Level Up Detected! The character has gained a level. Acknowledge this immediately and prompt the user to make their level-up choices or grant them their logical boons.");
    }
}



/**
 * Send a direct instruction to the State Model bypassing the narrative pipeline.
 * Used for initial character setup and manual corrections.
 */
export async function sendDirectPrompt(message) {
    if (_stateModelRunning) {
        toastr['info']('State Model is already running. Please wait.', 'RPG Tracker');
        return;
    }

    const settings = getSettings();
    const { generateRaw } = SillyTavern.getContext();
    if (!generateRaw) return;

    try {
        _stateModelRunning = true;
        updateStatusIndicator('running');

        // Abort previous if any
        if (_stateController) _stateController.abort();
        _stateController = new AbortController();
        const signal = _stateController.signal;
        const worldLore = await buildLorebookContext();
        const worldLoreSection = worldLore ? worldLore + '\n\n' : '';

        const modulesText = buildModulesInstructionText(settings);
        let systemPrompt = settings.systemPromptTemplate.replace('{{modulesText}}', modulesText);
        if (settings.useDdMmYyFormat) {
            systemPrompt = systemPrompt
                .replace(/\[Day\s+X,\s+HH:MM\]/g, '[DD/MM/YYYY, HH:MM]')
                .replace(/Day\s+3,\s+14:00/g, '03/01/2026, 14:00')
                .replace(/Day\s+1,\s+11:52/g, '01/01/2026, 11:52')
                .replace(/Day\s+1/g, '01/01/2026')
                .replace(/Day\s+2/g, '02/01/2026')
                .replace(/Day\s+3/g, '03/01/2026')
                .replace(/Day\s+4/g, '04/01/2026')
                .replace(/Day\s+6/g, '06/01/2026')
                .replace(/Day\s+N/g, 'DD/MM/YYYY')
                .replace(/Day\s+X/g, 'DD/MM/YYYY');
        }

        const sanitizedCurrent = stripMemoHtml(settings.currentMemo.replace(/<\/?memo>/gi, '').trim());

        const { chat } = SillyTavern.getContext();
        const N = settings.directPromptContext !== undefined ? settings.directPromptContext : 5;
        let chatLog = '';
        if (N > 0 && chat && chat.length > 0) {
            const recentChat = chat.slice(-N);
            chatLog = `## NARRATIVE HISTORY (Last ${recentChat.length} messages)\n` +
                recentChat
                    .map(m => {
                        const name = m.is_user ? 'Player' : (m.name || 'Narrator');
                        // Returns null for tool-call messages — excluded from state model context
                        const content = cleanToolCallMessage(m.mes || m['content'] || '');
                        if (content === null) return null;
                        return `${name}: ${content}`;
                    })
                    .filter(line => line !== null)
                    .join('\n\n') + '\n\n';
        }

        const userPrompt =
            worldLoreSection +
            chatLog +
            `## PRIOR MEMO\n${sanitizedCurrent || '(empty — this is the initial setup)'}\n\n` +
            `## USER INSTRUCTION\n${message}\n\n` +
            `## OUTPUT ONLY CHANGED OR NEW SECTIONS:`;

        const result = await sendStateRequest(settings, systemPrompt, userPrompt);

        if (result && typeof result === 'string') {
            let cleanedOutput = result;
            const memoBlocks = [...result.matchAll(/<memo>([\s\S]*?)<\/memo>/gi)];
            if (memoBlocks.length > 0) {
                cleanedOutput = memoBlocks[memoBlocks.length - 1][1].trim();
            } else {
                cleanedOutput = result.replace(/<\/?memo>/gi, '').trim();
            }

            const merged = mergeMemo(sanitizedCurrent, cleanedOutput);

            if (merged !== sanitizedCurrent) {
                const delta = computeDelta(sanitizedCurrent, merged);
                settings.lastDelta = delta;

                // Linear Stone History Logic
                if (settings.historyIndex !== undefined && settings.historyIndex !== -1) {
                    settings.memoHistory = settings.memoHistory.slice(settings.historyIndex);
                }
                if (settings.memoHistory[0] !== sanitizedCurrent) {
                    settings.memoHistory.unshift(sanitizedCurrent);
                }
                settings.memoHistory.unshift(merged);
                if (settings.memoHistory.length > 1000) settings.memoHistory.length = 1000;
                settings.historyIndex = 0;
                _historyViewIndex = -1;

                const dp = document.getElementById('rpg-tracker-delta-content');
                if (dp) dp.innerHTML = delta;

                settings.prevMemo2 = settings.prevMemo1;
                settings.prevMemo1 = sanitizedCurrent;
                settings.currentMemo = merged;

                updateUIMemo(merged);
                syncMemoView();
                refreshRenderedView();
                saveSettings();
                toastr['success']('Tracker updated.', 'RPG Tracker');
            } else {
                toastr['info']('No changes were made.', 'RPG Tracker');
            }
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            if (settings.debugMode) console.log("[RPG Tracker] Direct prompt aborted by user.");
            return;
        }
        console.error('[RPG Tracker] Direct prompt failed:', err);
        toastr['error']('Direct prompt failed. Check console.', 'RPG Tracker');
    } finally {
        _stateModelRunning = false;
        _stateController = null;
        updateStatusIndicator('active');
    }
}




/** Profile system — load a named profile into live settings. */
function loadProfile(name) {
    const s = getSettings();
    const p = s.profiles?.[name];
    if (!p) return;
    s.currentMemo = p.currentMemo ?? '';
    s.memoHistory = p.memoHistory ?? [];
    s.modules = p.modules ? JSON.parse(JSON.stringify(p.modules)) : s.modules;
    s.blockOrder = p.blockOrder ? JSON.parse(JSON.stringify(p.blockOrder)) : s.blockOrder;
    s.stockPrompts = loadStockPromptsFromProfile(p.stockPrompts);
    s.modulePageSizes = p.modulePageSizes ? JSON.parse(JSON.stringify(p.modulePageSizes)) : {};
    s.customFields = p.customFields ? JSON.parse(JSON.stringify(p.customFields)) : [];
    // quests are always derived from currentMemo — never from the profile snapshot
    s.quests = [];
    s.currentMemo = applyQuestSyncAndStripMemo(s.currentMemo);
    s.lastDelta = p.lastDelta ?? '';
    s.routerLookback = p.routerLookback || 4;
    s.routerDirectPrompt = p.routerDirectPrompt || '';
    s.worldProgressionLookback = p.worldProgressionLookback ?? 20;
    s.worldProgressionHistoryLookback = p.worldProgressionHistoryLookback ?? 0;
    s.worldProgressionRandomizeNPCs = p.worldProgressionRandomizeNPCs ?? false;
    s.worldProgressionRandomSkeletonNPCCount = p.worldProgressionRandomSkeletonNPCCount ?? 2;
    s.worldProgressionRandomNarrativeNPCCount = p.worldProgressionRandomNarrativeNPCCount ?? 3;
    s.worldProgressionRandomizeLocations = p.worldProgressionRandomizeLocations ?? false;
    s.worldProgressionRandomSkeletonLocationCount = p.worldProgressionRandomSkeletonLocationCount ?? 2;
    s.worldProgressionRandomNarrativeLocationCount = p.worldProgressionRandomNarrativeLocationCount ?? 2;
    s.worldProgressionRandomizeFactions = p.worldProgressionRandomizeFactions ?? false;
    s.worldProgressionRandomSkeletonFactionCount = p.worldProgressionRandomSkeletonFactionCount ?? 2;
    s.worldProgressionRandomNarrativeFactionCount = p.worldProgressionRandomNarrativeFactionCount ?? 2;
    s.worldProgressionRandomizeConflicts = p.worldProgressionRandomizeConflicts ?? false;
    s.worldProgressionRandomConflictCount = p.worldProgressionRandomConflictCount ?? 3;
    s.worldProgressionSkeletonFactions = p.worldProgressionSkeletonFactions ?? 4;
    s.worldProgressionSkeletonLocations = p.worldProgressionSkeletonLocations ?? 4;
    s.worldProgressionSkeletonNPCs = p.worldProgressionSkeletonNPCs ?? 0;
    s.worldProgressionSkeletonConflicts = p.worldProgressionSkeletonConflicts ?? 3;
    s.worldProgressionLastFiredAtMinutes = p.worldProgressionLastFiredAtMinutes ?? -1;
    s.worldProgressionLastFiredPeriodLabel = p.worldProgressionLastFiredPeriodLabel || '';
    s.worldProgressionExclusionList = p.worldProgressionExclusionList ?? '';
    s.worldProgressionAutoExcludeParty = p.worldProgressionAutoExcludeParty ?? false;

    s.portraitGeneratorSource = p.portraitGeneratorSource ?? "native";
    s.portraitSkipPromptDialog = p.portraitSkipPromptDialog ?? false;
    s.portraitAutoGenerateParty = p.portraitAutoGenerateParty ?? false;
    s.portraitAutoGenerateEnemies = p.portraitAutoGenerateEnemies ?? false;
    s.portraitAutoGenerateNpcs = p.portraitAutoGenerateNpcs ?? false;
    s.portraitConnectionSource = p.portraitConnectionSource ?? "default";
    s.portraitConnectionProfileId = p.portraitConnectionProfileId || "";
    s.portraitCompletionPresetId = p.portraitCompletionPresetId || "";
    s.portraitOllamaUrl = p.portraitOllamaUrl || "http://localhost:11434";
    s.portraitOllamaModel = p.portraitOllamaModel || "";
    s.portraitOpenaiUrl = p.portraitOpenaiUrl || "";
    s.portraitOpenaiKey = p.portraitOpenaiKey || "";
    s.portraitOpenaiModel = p.portraitOpenaiModel || "";

    s.worldConnectionSource = p.worldConnectionSource ?? "default";
    s.worldConnectionProfileId = p.worldConnectionProfileId || "";
    s.worldCompletionPresetId = p.worldCompletionPresetId || "";
    s.worldOllamaUrl = p.worldOllamaUrl || "http://localhost:11434";
    s.worldOllamaModel = p.worldOllamaModel || "";
    s.worldOpenaiUrl = p.worldOpenaiUrl || "";
    s.worldOpenaiKey = p.worldOpenaiKey || "";
    s.worldOpenaiModel = p.worldOpenaiModel || "";

    s.gameSystemWizardConnectionSource = p.gameSystemWizardConnectionSource ?? "default";
    s.gameSystemWizardConnectionProfileId = p.gameSystemWizardConnectionProfileId || "";
    s.gameSystemWizardCompletionPresetId = p.gameSystemWizardCompletionPresetId || "";
    s.gameSystemWizardOllamaUrl = p.gameSystemWizardOllamaUrl || "http://localhost:11434";
    s.gameSystemWizardOllamaModel = p.gameSystemWizardOllamaModel || "";
    s.gameSystemWizardOpenaiUrl = p.gameSystemWizardOpenaiUrl || "";
    s.gameSystemWizardOpenaiKey = p.gameSystemWizardOpenaiKey || "";
    s.gameSystemWizardOpenaiModel = p.gameSystemWizardOpenaiModel || "";

    // Update settings UI inputs if rendered
    $('#rpg_world_progression_randomize_npcs').prop('checked', !!s.worldProgressionRandomizeNPCs);
    $('#rpg_world_progression_random_skeleton_npc_count').val(s.worldProgressionRandomSkeletonNPCCount ?? 2);
    $('#rpg_world_progression_random_narrative_npc_count').val(s.worldProgressionRandomNarrativeNPCCount ?? 3);
    $('#rpg_world_progression_randomize_locations').prop('checked', !!s.worldProgressionRandomizeLocations);
    $('#rpg_world_progression_random_skeleton_location_count').val(s.worldProgressionRandomSkeletonLocationCount ?? 2);
    $('#rpg_world_progression_random_narrative_location_count').val(s.worldProgressionRandomNarrativeLocationCount ?? 2);
    $('#rpg_world_progression_randomize_factions').prop('checked', !!s.worldProgressionRandomizeFactions);
    $('#rpg_world_progression_random_skeleton_faction_count').val(s.worldProgressionRandomSkeletonFactionCount ?? 2);
    $('#rpg_world_progression_random_narrative_faction_count').val(s.worldProgressionRandomNarrativeFactionCount ?? 2);

    $('#rpg_world_progression_skeleton_factions').val(s.worldProgressionSkeletonFactions ?? 4);
    $('#rpg_world_progression_skeleton_locations').val(s.worldProgressionSkeletonLocations ?? 4);
    $('#rpg_world_progression_skeleton_npcs').val(s.worldProgressionSkeletonNPCs ?? 0);
    $('#rpg_world_progression_skeleton_conflicts').val(s.worldProgressionSkeletonConflicts ?? 3);
    $('#rpg_world_progression_exclusion_list').val(s.worldProgressionExclusionList);
    $('#rpg_world_progression_auto_exclude_party').prop('checked', !!s.worldProgressionAutoExcludeParty);

    // Sync portrait connection settings UI
    $('#rpg_portrait_generator_source').val(s.portraitGeneratorSource || 'native');
    $('#rpg_tracker_pollinations_group').toggle((s.portraitGeneratorSource || 'native') === 'pollinations');
    $('#rpg_tracker_portrait_skip_prompt').prop('checked', !!s.portraitSkipPromptDialog);
    $('#rpg_tracker_portrait_auto_party').prop('checked', !!s.portraitAutoGenerateParty);
    $('#rpg_tracker_portrait_auto_enemies').prop('checked', !!s.portraitAutoGenerateEnemies);
    $('#rpg_tracker_portrait_auto_npcs').prop('checked', !!s.portraitAutoGenerateNpcs);
    syncNpcPortraitDependentUi(s);
    $('#rpg_portrait_connection_source').val(s.portraitConnectionSource || 'default');
    $('#rpg_portrait_connection_profile').val(s.portraitConnectionProfileId || '');
    $('#rpg_portrait_completion_preset').val(s.portraitCompletionPresetId || '');
    $('#rpg_portrait_ollama_url').val(s.portraitOllamaUrl || 'http://localhost:11434');
    $('#rpg_portrait_ollama_model').val(s.portraitOllamaModel || '');
    $('#rpg_portrait_openai_url').val(s.portraitOpenaiUrl || '');
    $('#rpg_portrait_openai_key').val(s.portraitOpenaiKey || '');
    $('#rpg_portrait_openai_model').val(s.portraitOpenaiModel || '');
    $('#rpg_portrait_openai_model_manual').val(s.portraitOpenaiModel || '');

    // Sync world progression connection settings UI
    $('#rpg_world_connection_source').val(s.worldConnectionSource || 'default');
    $('#rpg_world_connection_profile').val(s.worldConnectionProfileId || '');
    $('#rpg_world_completion_preset').val(s.worldCompletionPresetId || '');
    $('#rpg_world_ollama_url').val(s.worldOllamaUrl || 'http://localhost:11434');
    $('#rpg_world_ollama_model').val(s.worldOllamaModel || '');
    $('#rpg_world_openai_url').val(s.worldOpenaiUrl || '');
    $('#rpg_world_openai_key').val(s.worldOpenaiKey || '');
    $('#rpg_world_openai_model').val(s.worldOpenaiModel || '');
    $('#rpg_world_openai_model_manual').val(s.worldOpenaiModel || '');

    $('#rpg_gs_wizard_connection_source').val(s.gameSystemWizardConnectionSource || 'default');
    $('#rpg_gs_wizard_connection_profile').val(s.gameSystemWizardConnectionProfileId || '');
    $('#rpg_gs_wizard_completion_preset').val(s.gameSystemWizardCompletionPresetId || '');
    $('#rpg_gs_wizard_ollama_url').val(s.gameSystemWizardOllamaUrl || 'http://localhost:11434');
    $('#rpg_gs_wizard_ollama_model').val(s.gameSystemWizardOllamaModel || '');
    $('#rpg_gs_wizard_openai_url').val(s.gameSystemWizardOpenaiUrl || '');
    $('#rpg_gs_wizard_openai_key').val(s.gameSystemWizardOpenaiKey || '');
    $('#rpg_gs_wizard_openai_model').val(s.gameSystemWizardOpenaiModel || '');
    $('#rpg_gs_wizard_openai_model_manual').val(s.gameSystemWizardOpenaiModel || '');

    // Toggle container visibilities
    $('#rpg_portrait_profile_group').toggle(s.portraitConnectionSource === 'profile');
    $('#rpg_portrait_ollama_group').toggle(s.portraitConnectionSource === 'ollama');
    $('#rpg_portrait_openai_group').toggle(s.portraitConnectionSource === 'openai');
    $('#rpg_world_profile_group').toggle(s.worldConnectionSource === 'profile');
    $('#rpg_world_ollama_group').toggle(s.worldConnectionSource === 'ollama');
    $('#rpg_world_openai_group').toggle(s.worldConnectionSource === 'openai');
    $('#rpg_gs_wizard_profile_group').toggle(s.gameSystemWizardConnectionSource === 'profile');
    $('#rpg_gs_wizard_ollama_group').toggle(s.gameSystemWizardConnectionSource === 'ollama');
    $('#rpg_gs_wizard_openai_group').toggle(s.gameSystemWizardConnectionSource === 'openai');

    // Toggle container visibilities
    if (s.worldProgressionRandomizeNPCs) $('#rpg_world_progression_random_npc_count_container').show();
    else $('#rpg_world_progression_random_npc_count_container').hide();
    if (s.worldProgressionRandomizeLocations) $('#rpg_world_progression_random_location_count_container').show();
    else $('#rpg_world_progression_random_location_count_container').hide();
    if (s.worldProgressionRandomizeFactions) $('#rpg_world_progression_random_faction_count_container').show();
    else $('#rpg_world_progression_random_faction_count_container').hide();

    s.activeProfile = name;
    _historyViewIndex = -1;

    saveSettings();
    // Refresh UI
    refreshOrderList();
    // Refresh delta panel
    const dp = document.getElementById('rpg-tracker-delta-content');
    if (dp) dp.innerHTML = s.lastDelta || '<span class="delta-empty">No changes yet.</span>';
    syncMemoView();
}

function refreshProfileDropdown() {
    const s = getSettings();
    const sel = document.getElementById('rpg_tracker_profile_select');
    if (!sel) return;
    const names = Object.keys(s.profiles || {});
    sel.innerHTML = '<option value="">-- No Profile --</option>' +
        names.map(n => `<option value="${escapeHtml(n)}"${n === s.activeProfile ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('');
}

async function showRngExplanation() {
    const { Popup } = SillyTavern.getContext();
    const card = (icon, title, body) => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; text-align: left;">
                <div style="font-size: 1em; font-weight: bold; margin-bottom: 6px;">${icon} ${title}</div>
                <div style="font-size: 0.9em; line-height: 1.5; opacity: 0.88;">${body}</div>
            </div>`;
    const popupBody = `
            <div style="font-size: 0.9em; line-height: 1.5; max-width: 480px; text-align: left;">
                ${card('🎲', 'Pre-Seeded RNG Queue',
        `Generates a list of pre-rolled dice and injects them directly into the story context. The AI uses the next roll in the queue until it reaches the last one, then wraps about to the start again. Each input injects a fresh set of numbers.<br><br>
                    This is a highly efficient and robust system that works well for both combat and narrative checks. Because it does not require additional tool-calling roundtrips, it reduces token costs, minimizes latency, and is highly reliable due to its reduced structural complexity.<br><br>
                    The only potential weakness is that the AI sees the numbers beforehand, theoretically making it possible for it to 'game' the system by fitting the check to the roll rather than the other way around, but in my experience this never happens. Rolls are failed all the time.<br><br>
                    This potential weakness, however, is completely eliminated in combat because it works on a deterministic, turn-based grid.`
    )}
                ${card('🔧', 'Tool Call RNG',
        `A reactive system where the AI proactively calls a dice tool for a specific narrative action (e.g., picking a lock, persuading a guard). The AI must declare a <b>Difficulty Class (DC)</b> before seeing the result. This ensures it can't "game the system" by lowering the DC to fit a roll or skipping the roll entirely. While Tool Calls guarantee that gaming the roll is technically impossible, they add slightly more latency and structure compared to the queue.`
    )}
                <div style="background: rgba(255,200,50,0.08); border: 1px solid rgba(255,200,50,0.25); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 0.88em; text-align: left;">
                    <b style="color: #ffcc33;">⚠ Important:</b> Tool Call RNG requires <b>"Enable function calling"</b> to be enabled in SillyTavern's AI Response Configuration.
                </div>
                ${card('📋', 'Which system should I use?',
        `<ul style="margin: 4px 0 0 0; padding-left: 20px; text-align: left; list-style-position: outside;">
                        <li style="margin-bottom: 4px;"><b>Pre-Seeded + Tool Calls (recommended):</b> Enables both systems. This is the most robust, hybrid setup.</li>
                        <li><b>Pre-Seeded Only:</b> Queue-only. Use if your model doesn't support function/tool calling or you prefer the simpler setup. It works just as well for the vast majority of cases.</li>
                    </ul>`
    )}
            </div>`;
    await Popup.show.confirm('🎲 RNG Systems Explained', popupBody, { okButton: 'Got it', cancelButton: false });
}

/**
 * Renders and shows the Quests Hardcore systems explanation popup.
 */
async function showQuestsHardcoreExplanation() {
    const { Popup } = SillyTavern.getContext();
    const card = (icon, title, body, sub = false) => `
            <div style="background: rgba(255,255,255,${sub ? '0.03' : '0.05'}); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; text-align: left; ${sub ? 'margin-left: 16px;' : ''}">
                <div style="font-size: 1em; font-weight: bold; margin-bottom: 6px;">${icon} ${title}</div>
                <div style="font-size: 0.9em; line-height: 1.5; opacity: 0.88;">${body}</div>
            </div>`;
    const popupBody = `
            <div style="font-size: 0.9em; line-height: 1.5; max-width: 480px; text-align: left;">
                ${card('⏳', 'Deadlines',
        `Adds time-sensitive constraints to quests. The system prompt instructs NPCs to attach deadlines to tasks they give you. If the deadline passes without turning in the quest, it auto-fails. Forces you to prioritise — you can't just accept every task and grind at your leisure.`
    )}
                ${card('🎭', 'Frustration', `Requires Deadlines. A sub-mode where quests <em>don't</em> auto-fail at the deadline. Instead, each quest giver has an NPC happiness level that starts high and quickly drops the longer you leave it past due. The rate of decline depends on the NPC's personality, which the model infers from their archetype and tone. You can still turn the quest in late — but the reception won't be warm.`, true)}
                ${card('⚔️', 'Difficulty',
        `The model assigns an explicit difficulty rating to each quest (e.g. Easy / Hard / Deadly) rather than leaving it vague. Useful for planning and for AI consistency when calculating rewards or consequences.`
    )}
            </div>`;
    await Popup.show.confirm('📋 Quest Mechanics Explained', popupBody, { okButton: 'Got it', cancelButton: false });
}

async function showComponentsExplanation() {
    const { Popup } = SillyTavern.getContext();
    const card = (icon, title, body) => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; text-align: left;">
                <div style="font-size: 1em; font-weight: bold; margin-bottom: 6px;">${icon} ${title}</div>
                <div style="font-size: 0.9em; line-height: 1.5; opacity: 0.88;">${body}</div>
            </div>`;
    const popupBody = `
            <div style="font-size: 0.9em; line-height: 1.5; max-width: 480px; text-align: left;">
                ${card('🎲', 'Loot',
        `When loot is received, dice rolls are made to determine its quality — whether something is a battered common item or a rare find. Adds meaningful variance to rewards.`
    )}
                ${card('🌍', 'Events',
        `Random events are rolled when time skips or travel occurs. A chance encounter, a weather shift, an ambush — things that happen without the player initiating them. Keeps the world feeling alive.`
    )}
                ${card('💤', 'Resting',
        `Resting is limited to once every 9 hours of in-game time. Prevents exploiting rest as a free heal between every fight, and reflects the reality that you can't just nap on demand.`
    )}
            </div>`;
    await Popup.show.confirm('🧩 Components Explained', popupBody, { okButton: 'Got it', cancelButton: false });
}

async function showPortraitSettingsMenu(entityName, onRefresh, npcContent = null) {
    const refresh = onRefresh || refreshRenderedView;
    const s = getSettings();
    const normName = entityName.replace(/\s*\(.*?\)/g, '').trim();
    const currentSrc = (s.customPortraits || {})[normName] || '';
    const previewHtml = currentSrc
        ? `<img src="${currentSrc}" style="max-width:128px;max-height:128px;border-radius:6px;display:block;margin:0 auto 10px;"/>`
        : `<div style="text-align:center;opacity:0.5;margin-bottom:10px;">No portrait set</div>`;
    const inputId     = `rt-portrait-url-${Date.now()}`;
    const fileId      = `rt-portrait-file-${Date.now()}`;
    const browseBtnId = `rt-portrait-browse-${Date.now()}`;
    const popupContent = `<div style="padding:10px;min-width:270px;">
            <b style="display:block;margin-bottom:8px;">Set Portrait — ${entityName}</b>
            ${previewHtml}
            <label style="display:block;margin-bottom:4px;font-size:0.85em;opacity:0.8;">Image URL (https://…)</label>
            <div style="display:flex;gap:6px;align-items:center;">
                <input id="${inputId}" type="text" class="text_pole" placeholder="Paste an image URL…" value="${currentSrc.startsWith('http') ? currentSrc : ''}" style="flex:1;box-sizing:border-box;"/>
                <button id="${browseBtnId}" class="menu_button" style="white-space:nowrap;flex-shrink:0;">Browse…</button>
            </div>
            <input id="${fileId}" type="file" accept="image/*" style="display:none"/>
            <div style="font-size:0.78em;opacity:0.55;margin-top:5px;">Or drag &amp; drop onto the portrait box / paste (Ctrl+V) anywhere on this screen.</div>
        </div>`;
    const ctx = SillyTavern.getContext();
    if (!ctx.callGenericPopup) { toastr['warning']('Popup API not available.', 'RPG Tracker'); return; }
    const popupOpts = { okButton: 'Apply', cancelButton: 'Cancel', wide: false,
        customButtons: [
            { text: '🤖 AI Generate', result: 4, classes: ['menu_button'] },
        ],
    };
    if (currentSrc) {
        popupOpts.customButtons.push({ text: '✂️ Crop Existing', result: 5, classes: ['menu_button'] });
        popupOpts.customButtons.push({ text: '🗑 Clear Portrait', result: 2, classes: ['menu_button'] });
    }

    const localApply = (src) => {
        applyPortraitData(entityName, src);
        refresh();
        void refreshNpcManifest().catch(() => {});
    };

    let capturedUrl    = currentSrc.startsWith('http') ? currentSrc : '';
    let capturedRawUrl = '';

    const popupPasteHandler = async (ev) => {
        const file = ev.clipboardData?.files?.[0];
        if (file && file.type.startsWith('image/')) {
            ev.preventDefault();
            ev.stopPropagation();
            try {
                capturedRawUrl = await fileToDataUrl(file);
                capturedUrl    = '';
                const urlInput = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));
                if (urlInput) urlInput.value = '(image pasted — click Apply to crop ✔)';
            } catch (err) {
                console.error(err);
                toastr['warning']('Could not read image from clipboard.', 'RPG Tracker');
            }
        }
    };

    setTimeout(() => {
        const fileInput = /** @type {HTMLInputElement|null} */ (document.getElementById(fileId));
        const browseBtn = document.getElementById(browseBtnId);
        const urlInput  = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));

        if (urlInput) {
            urlInput.addEventListener('input', () => {
                capturedUrl    = urlInput.value.trim();
                capturedRawUrl = '';
            });
        }

        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                fileInput.click();
            });
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files?.[0];
                if (!file) return;
                try {
                    capturedRawUrl = await fileToDataUrl(file);
                    capturedUrl    = '';
                    if (urlInput) urlInput.value = '(file selected — click Apply to crop ✔)';
                } catch (err) {
                    console.error(err);
                    toastr['warning']('Could not read image file.', 'RPG Tracker');
                }
            });
        }

        document.addEventListener('paste', popupPasteHandler);
    }, 0);

    const result = await ctx.callGenericPopup(popupContent, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', popupOpts);

    document.removeEventListener('paste', popupPasteHandler);

    if (result === 2) {
        localApply(null);
    } else if (result === 5) {
        try {
            const cropped = await ctx.callGenericPopup(
                'Set the crop position of the portrait',
                ctx.POPUP_TYPE?.CROP ?? 4,
                '',
                { cropImage: currentSrc, cropAspect: 1 }
            );
            if (cropped) {
                const scaled = await scaleImageTo512Square(cropped);
                localApply(scaled);
            }
        } catch (err) {
            console.error(err);
            toastr['warning']('Could not crop existing image.', 'RPG Tracker');
        }
    } else if (result === 4) {
        try {
            if (s.portraitSkipPromptDialog) {
                toastr['info'](`Generating portrait for ${entityName} in background…`, 'RPG Tracker');
                const aiPrompt = npcContent !== null
                    ? await generateNpcPortraitPrompt(entityName, npcContent)
                    : await generatePortraitPrompt(entityName);
                if (!aiPrompt) {
                    toastr['warning']('Could not generate prompt — no context found.', 'RPG Tracker');
                    return;
                }
                toastr['info'](`Generating image for ${entityName}…`, 'RPG Tracker');
                const dataUrl = await generatePortraitDirect(aiPrompt, entityName);
                const scaled = await scaleImageTo512Square(dataUrl);
                localApply(scaled);
                toastr['success'](`Portrait auto-generated and applied for ${entityName}!`, 'RPG Tracker');
            } else {
                toastr['info']('Generating portrait prompt…', 'RPG Tracker');
                const aiPrompt = npcContent !== null
                    ? await generateNpcPortraitPrompt(entityName, npcContent)
                    : await generatePortraitPrompt(entityName);
                if (aiPrompt) {
                    await showPortraitPromptPopup(aiPrompt, entityName, localApply, refresh);
                } else {
                    toastr['warning']('Could not generate prompt — no context found.', 'RPG Tracker');
                }
            }
        } catch (err) {
            console.error('[RPG Tracker] AI portrait error:', err);
            toastr['error']('AI portrait generation failed: ' + (err.message || err), 'RPG Tracker');
        }
    } else if (result) {
        if (capturedRawUrl) {
            try {
                const cropped = await ctx.callGenericPopup(
                    'Set the crop position of the portrait',
                    ctx.POPUP_TYPE?.CROP ?? 4,
                    '',
                    { cropImage: capturedRawUrl, cropAspect: 1 }
                );
                if (cropped) {
                    const scaled = await scaleImageTo512Square(cropped);
                    localApply(scaled);
                }
            } catch (err) {
                console.error(err);
                toastr['warning']('Could not crop image.', 'RPG Tracker');
            }
        } else if (capturedUrl && (capturedUrl.startsWith('data:image/') || /^https?:\/\//i.test(capturedUrl))) {
            localApply(capturedUrl);
        } else if (capturedUrl) {
            toastr['warning']('Please enter a valid https:// URL or use the Browse button.', 'RPG Tracker');
        }
    }
}

export function bindRenderedCardEvents(el, memo, isDetachedContext = false, onRefresh = null) {
    const refresh = onRefresh || refreshRenderedView;

    // Genre tab toggle listener & persistent preference save
    const genreSelect = el.querySelector('#rt-onboarding-genre');
    const genreGroups = {
        fantasy: el.querySelector('.rt-fantasy-buttons'),
        realistic: el.querySelector('.rt-realistic-buttons'),
        scifi: el.querySelector('.rt-scifi-buttons'),
        horror: el.querySelector('.rt-horror-buttons'),
    };
    if (genreSelect) {
        genreSelect.addEventListener('change', () => {
            const val = genreSelect.value;
            getSettings().onboardingGenre = val;
            saveSettings();
            Object.entries(genreGroups).forEach(([key, groupEl]) => {
                if (groupEl) groupEl.style.display = key === val ? 'flex' : 'none';
            });
        });
    }

    // Starting Level change & persistent preference save
    const levelSelect = el.querySelector('#rt-starting-level');
    if (levelSelect) {
        levelSelect.addEventListener('change', () => {
            getSettings().onboardingLevel = parseInt(levelSelect.value) || 1;
            saveSettings();
        });
    }

    // Custom Instructions input & persistent preference save
    const customInstructionsInput = el.querySelector('#rt-onboarding-custom-instructions');
    if (customInstructionsInput) {
        customInstructionsInput.addEventListener('input', () => {
            getSettings().onboardingCustomInstructions = customInstructionsInput.value;
            saveSettings();
        });
    }

    // Time & Date segmented toggles — wired identically in both onboarding
    // widgets (top bar + Narrator Configuration) so they can never diverge.
    // Every click funnels through the shared setUseDdMmYyFormat/setUse24hTime
    // setters, which push the resulting state back out to both widgets.
    const bindDateFormatSeg = (segId) => {
        const segEl = el.querySelector(`#${segId}`);
        if (!segEl) return;
        segEl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => setUseDdMmYyFormat(btn.dataset.value === 'date'));
        });
    };
    const bindClockFormatSeg = (segId) => {
        const segEl = el.querySelector(`#${segId}`);
        if (!segEl) return;
        segEl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => setUse24hTime(btn.dataset.value === '24'));
        });
    };
    bindDateFormatSeg('rt-onboarding-date-seg');
    bindDateFormatSeg('rt_onboarding_time_date_seg');
    bindClockFormatSeg('rt-onboarding-clock-seg');
    bindClockFormatSeg('rt_onboarding_time_clock_seg');

    const startDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-onboarding-start-date'));
    if (startDateInput) {
        startDateInput.addEventListener('input', () => setInitialDateValue(startDateInput.value.trim(), startDateInput));
    }

    el.querySelectorAll('.rt-random-char-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const archetype = btn.dataset.archetype;
            const levelSelectEl = el.querySelector('#rt-starting-level');
            const level = parseInt(String(levelSelectEl?.value ?? getSettings().onboardingLevel ?? 1), 10) || 1;
            getSettings().onboardingLevel = level;

            // char_roll just opens a UI panel — no need to persist or trigger I/O
            if (archetype === 'char_roll') {
                showCharacterRollPanel(el);
                return;
            }

            saveSettings();
            // Time/date format and initial date are already the single source of truth
            // (kept in sync by setUseDdMmYyFormat/setUseDate24hTime/setInitialDateValue) —
            // just read them directly instead of re-deriving from a specific widget.
            const isCalendar = !!getSettings().useDdMmYyFormat;
            const startDateVal = isCalendar
                ? (getSettings().initialDate && getSettings().initialDate !== 'Day 1' ? getSettings().initialDate : '01/01/2026')
                : 'Day 1';
            const customInstructions = el.querySelector('#rt-onboarding-custom-instructions')?.value.trim() || '';
            const levelPrefix = `STARTING LEVEL: ${level} (mandatory — the character MUST be exactly Level ${level}).`;
            const xpHint = buildOnboardingXpHint(level);

            const labels = {
                magic: '✨ Casting...',
                melee: '⚔️ Training...',
                rogue: '🗡️ Sneaking...',
                professional: '💼 Analyzing...',
                survivor: '🏃 Surviving...',
                scholar: '🧠 Researching...',
                scifi_pilot: '🚀 Piloting...',
                scifi_engineer: '🤖 Engineering...',
                scifi_marine: '🔫 Deploying...',
                horror_investigator: '🕵️ Investigating...',
                horror_occultist: '👻 Summoning...',
                horror_survivor: '🔪 Enduring...',
                persona: '🎭 Embodying...',
                custom: '⚙️ Customizing...',
                char_roll: '🎲 Rolling...'
            };

            const CHARACTER_FORMAT_HINT = `\n\nCRITICAL TAG WRAPPING RULE: Every block you output MUST be enclosed in matching opening and closing tags. You must output the closing tag for every block (e.g. [/CHARACTER], [/INVENTORY], [/ABILITIES], [/SPELLS], [/XP], [/TIME]).

Use this exact style:
[CHARACTER]
Barnaby "Salt-Eye" Finch (Pirate): 36/36 HP
Combat: BAB: +4 | Ranged: +6 | Melee: +5
Gear: Cutlass (1d6+2 Slashing) [E], AC: 14 (Leather Jerkin)
Attr: STR 14 (+2), DEX 15 (+2), CON 14 (+2), INT 12 (+1), WIS 10 (+0), CHA 14 (+2)
Saves: Fort +6 | Ref +6 | Will +1
[/CHARACTER]

[INVENTORY]
Gear:
- 🗡️ [Common] [E] Cutlass (1d6+2 Slashing)
[/INVENTORY]

[ABILITIES]
- Dirty Fighting
[/ABILITIES]`;

            const initDateVal = startDateVal;
            const initRestVal = isCalendar ? startDateVal : 'Day 0';
            const TIME_FORMAT_HINT = `\n\n[TIME]\nLast Rest: 12:00 AM, ${initRestVal}\nCurrent Time: 08:00 AM, ${initDateVal}\n[/TIME]`;

            const REALISTIC_HINT = `\n\nCRITICAL REALISM RULE: This is a realistic/non-fantasy setting.
- Do NOT output a [SPELLS] block under any circumstances. Avoid all magic, spells, or magical powers.
- Avoid D&D classes (e.g. do NOT label them as Bard, Rogue, Fighter, Wizard, etc.) and fantasy races. Keep them as a realistic human.
- Use realistic modern/historical currency (e.g. $, USD, GBP, or simple cash/money) instead of GP/SP/CP.
- Wing it and homebrew modern capabilities: adapt attributes, saves, gear, and skills to fit a realistic setting. Keep items, weapons, and tools realistic (no fantasy or magical weapons).`;

            const SCIFI_HINT = `\n\nCRITICAL SCI-FI RULE: This is a science-fiction setting.
- Do NOT output a [SPELLS] block. Avoid D&D classes and fantasy races.
- Use futuristic sci-fi gear (energy weapons, cybernetics, powered armor, starship equipment) instead of medieval fantasy gear.
- Use a sci-fi currency (e.g. Credits) instead of GP/SP/CP.
- Wing it and homebrew futuristic capabilities: adapt attributes, saves, gear, and skills to fit a sci-fi setting.`;

            const HORROR_HINT = `\n\nCRITICAL HORROR RULE: This is a horror/occult setting.
- Do NOT output a [SPELLS] block; represent any occult rituals or supernatural resistances as entries in [ABILITIES] instead.
- Avoid D&D classes and fantasy races. Keep the character grounded and vulnerable — horror characters are not superheroes.
- Use realistic modern/historical currency instead of GP/SP/CP.
- Wing it and homebrew fitting capabilities: adapt attributes, saves, gear, and skills for a tense horror survival setting.`;

            const prompts = {
                magic: `${levelPrefix} Generate a random Level ${level} D&D Magic User (Wizard, Sorcerer, or Warlock). Give them a random fantasy name (do NOT use {{user}}). Output [CHARACTER], [SPELLS], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Include appropriate spells (using 'Cantrips:' for level 0 spells), items, and attributes consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}`,
                melee: `${levelPrefix} Generate a random Level ${level} D&D Melee Fighter (Fighter, Barbarian, or Paladin). Give them a random fantasy name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on high physical attributes, heavy armor, and signature weapons consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}`,
                rogue: `${levelPrefix} Generate a random Level ${level} D&D Rogue or Thief-style character. Give them a random fantasy name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on high Dexterity, stealth-related equipment (thieves' tools, daggers), and class features like Sneak Attack consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}`,
                professional: `${levelPrefix} Generate a random Level ${level} modern professional/specialist character (e.g. detective, agent, scientist, doctor, law enforcement, or investigator). Give them a realistic name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on specialized professional skills, modern gear, and attributes consistent with a Level ${level} specialist.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${REALISTIC_HINT}`,
                survivor: `${levelPrefix} Generate a random Level ${level} survivor character (e.g. survivalist, soldier, athlete, or civilian). Give them a realistic name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on physical resilience, survival/scavenged gear, and attributes consistent with a Level ${level} survivor.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${REALISTIC_HINT}`,
                scholar: `${levelPrefix} Generate a random Level ${level} intellectual/scholar character (e.g. occultist, inventor, academic, hacker, or historian). Give them a realistic name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on intelligence, knowledge-based traits, research tools/gear, and attributes consistent with an intellectual Level ${level} scholar.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${REALISTIC_HINT}`,
                scifi_pilot: `${levelPrefix} Generate a random Level ${level} sci-fi pilot/ace character (starfighter pilot, freighter captain, or mech pilot). Give them a realistic or sci-fi-style name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on piloting skills, a signature ship/vehicle callsign, and sidearm/survival gear consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${SCIFI_HINT}`,
                scifi_engineer: `${levelPrefix} Generate a random Level ${level} sci-fi engineer/technician character (ship engineer, hacker, or robotics specialist). Give them a realistic or sci-fi-style name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on technical skills, tools/gadgets, and gear consistent with a Level ${level} engineer.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${SCIFI_HINT}`,
                scifi_marine: `${levelPrefix} Generate a random Level ${level} sci-fi combat marine/soldier character. Give them a realistic or sci-fi-style name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on combat training, powered armor or tactical gear, and weaponry consistent with a Level ${level} marine.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${SCIFI_HINT}`,
                horror_investigator: `${levelPrefix} Generate a random Level ${level} horror investigator character (detective, paranormal investigator, or journalist chasing the truth). Give them a realistic name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on investigative skills, mundane gear, and a fraying grip on sanity consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${HORROR_HINT}`,
                horror_occultist: `${levelPrefix} Generate a random Level ${level} occultist character with forbidden knowledge (cultist-hunter, occult scholar, or dabbler in the unknown). Give them a realistic name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Represent any ritual or occult knowledge as entries in [ABILITIES] rather than spells, consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${HORROR_HINT}`,
                horror_survivor: `${levelPrefix} Generate a random Level ${level} horror survivor character (ordinary person thrust into a nightmare — final girl/guy archetype, small-town resident, or camp counselor). Give them a realistic name (do NOT use {{user}}). Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks. Focus on resourcefulness, improvised weapons/tools, and fragile but resilient stats consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${HORROR_HINT}`
            };

            // ── Custom archetype: freeform character based entirely on custom instructions ──
            if (archetype === 'custom') {
                if (!customInstructions) {
                    toastr['warning']('Please enter custom setting/character instructions first.', 'RPG Tracker');
                    return;
                }
                el.querySelectorAll('.rt-random-char-btn').forEach(b => b.disabled = true);
                btn.textContent = labels.custom;
                let customPrompt = `${levelPrefix} Generate a random Level ${level} character based entirely on these custom instructions: "${customInstructions}". Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks (and [SPELLS] if appropriate for the class, using 'Cantrips:' for level 0 spells). Adapt all attributes, skills, saves, descriptions, and gear to match the setting and instructions perfectly.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}`;
                if (isCalendar) {
                    customPrompt += `\n\nCRITICAL REALISM RULE: This is a realistic/non-fantasy setting. Do NOT output a [SPELLS] block. Use realistic modern/historical currencies instead of GP/SP/CP.`;
                }
                await sendDirectPrompt(customPrompt);
                return;
            }

            // ── Persona archetype: derive character from the active SillyTavern persona ──
            if (archetype === 'persona') {
                const { substituteParams } = SillyTavern.getContext();
                const resolvedPersona = substituteParams ? substituteParams('{{persona}}').trim() : '';
                if (!resolvedPersona || resolvedPersona === '{{persona}}') {
                    toastr['warning'](
                        'No persona is set. Set a persona in SillyTavern (User Settings → Personas) and try again.',
                        'RPG Tracker'
                    );
                    return;
                }
                el.querySelectorAll('.rt-random-char-btn').forEach(b => b.disabled = true);
                btn.textContent = labels.persona;
                let personaPrompt = `${levelPrefix} Using the following persona description as the basis for the player character, create a Level ${level} character that faithfully embodies this persona. Translate the personality, background, and traits into appropriate stats, class, race, and equipment. Output [CHARACTER], [INVENTORY], [ABILITIES], [XP], and [TIME] blocks (and [SPELLS] if the class is a spellcaster, using 'Cantrips:' for level 0 spells). All attributes and gear should be consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}\n\nPersona:\n${resolvedPersona}`;
                if (customInstructions) {
                    personaPrompt += `\n\nAdditional setting/instruction constraints: ${customInstructions}. Adapt the name, attributes, description, gear, and spells (if any) to match this setting/instruction perfectly.`;
                }
                await sendDirectPrompt(personaPrompt);
                return;
            }

            el.querySelectorAll('.rt-random-char-btn').forEach(b => b.disabled = true);
            btn.textContent = labels[archetype] || '🎲 Rolling...';
            let promptText = prompts[archetype];
            if (customInstructions) {
                promptText += `\n\nAdditional setting/instruction constraints: ${customInstructions}. Adapt the name, attributes, description, gear, and spells (if any) to match this setting/instruction perfectly.`;
            }
            await sendDirectPrompt(promptText);
        });
    });

    el.querySelectorAll('.rt-hp-bar-wrap[data-recolor-id], .rt-xp-bar-wrap[data-recolor-id]').forEach(wrap => {
        wrap.addEventListener('click', (e) => {
            e.stopPropagation();
            handleRecolor(wrap.dataset.recolorId, wrap.dataset.recolorCurrent, wrap);
        });
    });

    // RNG Help Popup Trigger
    el.querySelectorAll('.rt-rng-help-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            showRngExplanation();
        });
    });

    // Hardcore Help Popup Triggers
    el.querySelectorAll('.rt-quests-hardcore-help').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            showQuestsHardcoreExplanation();
        });
    });

    // --- Onboarding Narrator Configuration (Salad Bar Sync) ---
    const s = getSettings();

    // (Local syncSettingsAndUI function removed; using module-scoped syncSettingsAndUI instead)

    // RNG Mode Sync
    const onboardingRngInputs = el.querySelectorAll('input[name="rt_onboarding_rng_mode"]');
    onboardingRngInputs.forEach(input => {
        let expectedValue = 'hybrid';
        if (!s.rngEnabled) {
            expectedValue = 'none';
        } else if (!s.diceFunctionTool) {
            expectedValue = 'legacy';
        }
        input.checked = (input.value === expectedValue);
        input.addEventListener('change', () => {
            syncSettingsAndUI(settings => {
                if (input.value === 'hybrid') {
                    settings.rngEnabled = true;
                    settings.diceFunctionTool = true;
                } else if (input.value === 'legacy') {
                    settings.rngEnabled = true;
                    settings.diceFunctionTool = false;
                } else {
                    settings.rngEnabled = false;
                    settings.diceFunctionTool = false;
                }
            });
        });
    });

    // Quests Enabled Sync
    const onboardingQuestsCb = el.querySelector('#rt_onboarding_quests_enabled');
    if (onboardingQuestsCb) {
        onboardingQuestsCb.checked = s.syspromptModules?.quests !== false;
        const optionsDiv = el.querySelector('#rt_onboarding_quest_options');
        if (optionsDiv) optionsDiv.style.display = onboardingQuestsCb.checked ? 'flex' : 'none';

        onboardingQuestsCb.addEventListener('change', () => {
            const isEnabled = !!onboardingQuestsCb.checked;
            if (optionsDiv) optionsDiv.style.display = isEnabled ? 'flex' : 'none';
            syncSettingsAndUI(settings => {
                if (!settings.syspromptModules) settings.syspromptModules = {};
                settings.syspromptModules.quests = isEnabled;
            });
        });
    }

    // Deadlines Sync
    const onboardingDeadlinesCb = el.querySelector('#rt_onboarding_quests_deadlines');
    const onboardingFrustrationWrap = el.querySelector('#rt_onboarding_quests_frustration_wrap');
    const syncOnboardingFrustrationVisibility = () => {
        if (onboardingFrustrationWrap) onboardingFrustrationWrap.style.display = onboardingDeadlinesCb?.checked ? '' : 'none';
    };
    if (onboardingDeadlinesCb) {
        onboardingDeadlinesCb.checked = !!s.syspromptModules?.questsDeadlines;
        syncOnboardingFrustrationVisibility();
        onboardingDeadlinesCb.addEventListener('change', () => {
            if (!onboardingDeadlinesCb.checked) {
                const fCb = el.querySelector('#rt_onboarding_quests_frustration');
                if (fCb) fCb.checked = false;
                syncSettingsAndUI(settings => {
                    if (!settings.syspromptModules) settings.syspromptModules = {};
                    settings.syspromptModules.questsDeadlines = false;
                    settings.syspromptModules.questsFrustration = false;
                });
            } else {
                syncSettingsAndUI(settings => {
                    if (!settings.syspromptModules) settings.syspromptModules = {};
                    settings.syspromptModules.questsDeadlines = true;
                });
            }
            syncOnboardingFrustrationVisibility();
        });
    }

    // Frustration Levels Sync
    const onboardingFrustrationCb = el.querySelector('#rt_onboarding_quests_frustration');
    if (onboardingFrustrationCb) {
        onboardingFrustrationCb.checked = !!s.syspromptModules?.questsFrustration;
        onboardingFrustrationCb.addEventListener('change', () => {
            syncSettingsAndUI(settings => {
                if (!settings.syspromptModules) settings.syspromptModules = {};
                settings.syspromptModules.questsFrustration = !!onboardingFrustrationCb.checked;
            });
        });
    }

    // Difficulty Sync
    const onboardingDifficultyCb = el.querySelector('#rt_onboarding_quests_difficulty');
    if (onboardingDifficultyCb) {
        onboardingDifficultyCb.checked = !!s.syspromptModules?.questsDifficulty;
        onboardingDifficultyCb.addEventListener('change', () => {
            syncSettingsAndUI(settings => {
                if (!settings.syspromptModules) settings.syspromptModules = {};
                settings.syspromptModules.questsDifficulty = !!onboardingDifficultyCb.checked;
            });
        });
    }

    const onboardingShowArchiveCb = el.querySelector('#rt_onboarding_quests_show_archive');
    if (onboardingShowArchiveCb) {
        onboardingShowArchiveCb.checked = s.syspromptModules?.questsShowArchive !== false;
        onboardingShowArchiveCb.addEventListener('change', () => {
            syncSettingsAndUI(settings => {
                if (!settings.syspromptModules) settings.syspromptModules = {};
                settings.syspromptModules.questsShowArchive = !!onboardingShowArchiveCb.checked;
            });
            refresh();
        });
    }


    // Optional Components Sync
    const syncOptionalMod = (onboardingId, settingKey) => {
        const cb = el.querySelector(onboardingId);
        if (cb) {
            cb.checked = !!s.syspromptModules?.[settingKey];
            cb.addEventListener('change', () => {
                syncSettingsAndUI(settings => {
                    if (!settings.syspromptModules) settings.syspromptModules = {};
                    settings.syspromptModules[settingKey] = !!cb.checked;
                });
            });
        }
    };
    syncOptionalMod('#rt_onboarding_mod_loot', 'loot');
    syncOptionalMod('#rt_onboarding_mod_random_events', 'random_events');
    syncOptionalMod('#rt_onboarding_mod_resting', 'resting');

    // Onboarding Relationship System Sync
    const onboardingRelBarsCb = el.querySelector('#rt_onboarding_mod_npc_rel_bars');
    if (onboardingRelBarsCb) {
        onboardingRelBarsCb.checked = !!s.npcRelationshipBars;
        onboardingRelBarsCb.addEventListener('change', () => {
            syncSettingsAndUI(settings => {
                settings.npcRelationshipBars = !!onboardingRelBarsCb.checked;
                if (settings.routerModules?.npc) {
                    settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
                }
            });
            setTimeout(() => {
                if (typeof globalThis._rpgRenderAgentModules === 'function') {
                    globalThis._rpgRenderAgentModules();
                }
                if (typeof refreshAgentManifest === 'function') {
                    void refreshAgentManifest().catch(() => {});
                }
            }, 1);
        });
    }

    // Custom Sysprompt toggle (onboarding)
    const onboardingCustomSyspromptCb = el.querySelector('#rt_onboarding_custom_sysprompt');
    if (onboardingCustomSyspromptCb) {
        onboardingCustomSyspromptCb.checked = !!getSettings().customSysprompt;
        onboardingCustomSyspromptCb.addEventListener('change', () => {
            syncSettingsAndUI(s => { s.customSysprompt = !!onboardingCustomSyspromptCb.checked; });
        });
    }

    // Time & Date format (Narrator Configuration widget) — segmented toggles are
    // bound above via bindDateFormatSeg/bindClockFormatSeg for both onboarding widgets.
    const onboardingInitialDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt_onboarding_initial_date_input'));
    if (onboardingInitialDateInput) {
        onboardingInitialDateInput.addEventListener('input', () => setInitialDateValue(onboardingInitialDateInput.value.trim(), onboardingInitialDateInput));
    }

    // Apply System Prompt button (onboarding) — same logic as settings panel "Update Main Sysprompt"
    const onboardingBtnApply = el.querySelector('#rt_onboarding_btn_update_sysprompt');
    if (onboardingBtnApply) {
        onboardingBtnApply.addEventListener('click', async () => {
            await autoApplySysprompt(true);
            toastr['success']('System prompt applied! \u2705', 'RPG Tracker');
        });
    }

    el.querySelectorAll('.rt-quest-dismiss-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const questId = btn.getAttribute('data-quest-id');
            if (!questId) return;
            removeArchivedQuest(questId);
            saveSettings();
            refresh();
        });
    });

    el.querySelectorAll('.rt-section-header').forEach(header => {
        // Unbind to prevent duplicate listeners
        const oldHeader = header;
        const newHeader = oldHeader.cloneNode(true);
        oldHeader.parentNode.replaceChild(newHeader, oldHeader);

        newHeader.addEventListener('click', (e) => {
            // Prevent toggle if clicking on a button
            if (e.target.closest('button')) return;
            const tag = newHeader.dataset.tag;
            if (!tag) return;
            const col = loadCollapsed();
            if (col.has(tag)) col.delete(tag); else col.add(tag);
            saveCollapsed(col);
            refresh();
        });
    });

    el.querySelectorAll('.rt-page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = btn.dataset.tag;
            const dir = parseInt(btn.dataset.dir);
            if (!tag) return;
            const curBlocks = parseMemoBlocks(memo);
            const items = blockToItems(tag, curBlocks[tag] ?? '');

            const customField = (getSettings().customFields || []).find(f => f.tag.toUpperCase() === tag);
            const renderType = customField?.renderType || tag;
            const localPageSize = getPageSize(renderType);

            const totalPages = Math.ceil(items.length / localPageSize);
            const cur = _sectionPages[tag] ?? 0;
            _sectionPages[tag] = Math.max(0, Math.min(totalPages - 1, cur + dir));
            refresh();
        });
    });

    el.querySelectorAll('.rt-fullview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = btn.dataset.tag;
            if (!tag) return;
            const s = getSettings();
            const idx = s.fullViewSections.indexOf(tag);
            if (idx === -1) s.fullViewSections.push(tag);
            else s.fullViewSections.splice(idx, 1);
            saveSettings();
            refresh();
        });
    });

    if (!isDetachedContext) {
        el.querySelectorAll('.rt-detach-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = btn.dataset.tag;
                if (!tag) return;
                const detached = loadDetached();
                detached.add(tag);
                saveDetached(detached);
                createDetachedPanel(tag);
                refresh();
            });
        });

        el.querySelectorAll('.rt-reattach-btn-inline').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = btn.dataset.tag;
                if (!tag) return;
                const detached = loadDetached();
                detached.delete(tag);
                saveDetached(detached);
                const panel = document.getElementById(`rt-detached-panel-${tag}`);
                if (panel) panel.remove();
                refresh();
            });
        });
    }

    el.querySelectorAll('.rt-category-settings-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleCategorySettings(btn.dataset.tag, btn);
        });
    });

    // ── Tab Mode: tab strip, overflow "More" menu, vitals-strip jump, swipe ──
    //
    // Deliberately NOT touching scrollTop anywhere here. Any programmatic scroll on tab
    // switch (even a "helpful" one) reads as a jarring auto-scroll/bounce, forcing the
    // user to re-locate the content with their eyes every time. Instead, the scrollable
    // area is padded (see .rt-tabmode-wrap / .rt-tabmode-content in style.css) with
    // enough extra room below the content that the browser practically never needs to
    // clamp scrollTop when a shorter tab is selected — so whatever position the user
    // parked the viewport at stays exactly where it is across tab switches.
    el.querySelectorAll('.rt-tab-btn[data-tag], .rt-tab-more-item[data-tag]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = btn.dataset.tag;
            if (!tag) return;
            saveActiveTab(tag);
            el.querySelector('#rt-tab-more-menu')?.classList.remove('open');
            refresh();
        });
    });

    const tabMoreToggle = el.querySelector('#rt-tab-more-toggle');
    if (tabMoreToggle) {
        tabMoreToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            el.querySelector('#rt-tab-more-menu')?.classList.toggle('open');
        });
    }

    if (!_tabModeMenuDeselectHandler) {
        _tabModeMenuDeselectHandler = (e) => {
            if (!e.target.closest('.rt-tab-more-wrap')) {
                document.querySelectorAll('.rt-tab-more-menu.open').forEach(m => m.classList.remove('open'));
            }
        };
        document.addEventListener('click', _tabModeMenuDeselectHandler);
    }

    el.querySelectorAll('.rt-vitals-member[data-jump-tag]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = btn.dataset.jumpTag;
            if (!tag) return;
            saveActiveTab(tag);
            refresh();
        });
    });

    // Swipe left/right on the active tab's content pane to move to the adjacent tab (touch devices)
    const tabModeWrap = el.querySelector('.rt-tabmode-wrap');
    const tabModeContent = el.querySelector('.rt-tabmode-content');
    if (tabModeWrap && tabModeContent) {
        const tabOrder = (tabModeWrap.dataset.tabOrder || '').split(',').filter(Boolean);
        let touchStartX = 0, touchStartY = 0;
        tabModeContent.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        tabModeContent.addEventListener('touchend', (e) => {
            if (!tabOrder.length) return;
            const touch = e.changedTouches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            // Require a mostly-horizontal swipe of at least 50px to avoid hijacking vertical scrolling
            if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            const activeTag = tabModeContent.dataset.activeTag;
            const idx = tabOrder.indexOf(activeTag);
            if (idx === -1) return;
            const nextIdx = dx < 0 ? Math.min(tabOrder.length - 1, idx + 1) : Math.max(0, idx - 1);
            if (nextIdx === idx) return;
            saveActiveTab(tabOrder[nextIdx]);
            refresh();
        }, { passive: true });
    }

    // Add toggle behavior for Unit Pills (Traits/Abilities)
    el.querySelectorAll('.rt-unit-pill').forEach(unit => {
        unit.addEventListener('click', (e) => {
            e.stopPropagation();
            // Toggle active class to show/hide description
            const wasActive = unit.classList.contains('active');
            // Close others first for a clean experience
            el.querySelectorAll('.rt-unit-pill.active').forEach(u => u.classList.remove('active'));
            if (!wasActive) unit.classList.add('active');
        });
    });

    // Global deselect when clicking anything else
    if (!_pillDeselectHandler) {
        _pillDeselectHandler = (e) => {
            if (!e.target.closest('.rt-unit-pill')) {
                document.querySelectorAll('.rt-unit-pill.active').forEach(u => u.classList.remove('active'));
            }
        };
        document.addEventListener('click', _pillDeselectHandler);
    }

    // ── Portrait drag-drop and click handlers ─────────────────────────────────
    el.querySelectorAll('.rt-entity-portrait-container').forEach(container => {
        const entityName = container.closest('.rt-entity-container')?.dataset?.entityName || '';
        if (!entityName) return;

        const localApply = (src) => {
            applyPortraitData(entityName, src);
            refresh();
            void refreshNpcManifest().catch(() => {});
        };

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.classList.add('dragover');
        });

        container.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            container.classList.remove('dragover');
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            container.classList.remove('dragover');
            const file = e.dataTransfer?.files?.[0];
            if (file && file.type.startsWith('image/')) {
                try {
                    const dataUrl = await fileToDataUrl(file);
                    const ctx = SillyTavern.getContext();
                    const cropped = await ctx.callGenericPopup(
                        'Set the crop position of the portrait',
                        ctx.POPUP_TYPE?.CROP ?? 4,
                        '',
                        { cropImage: dataUrl, cropAspect: 1 }
                    );
                    if (cropped) {
                        const scaled = await scaleImageTo512Square(cropped);
                        localApply(scaled);
                    }
                } catch (err) {
                    console.error(err);
                    toastr['warning']('Could not read or crop image file.', 'RPG Tracker');
                }
                return;
            }
            const url = e.dataTransfer?.getData('text/plain')?.trim();
            if (url && /^https?:\/\//i.test(url)) {
                localApply(url);
            } else {
                toastr['warning']('Drop an image file or drag an image URL from a browser.', 'RPG Tracker');
            }
        });

        container.addEventListener('click', async (e) => {
            e.stopPropagation();
            await showPortraitSettingsMenu(entityName, refresh);
        });

    });
}

/**
 * Quests for UI display: active quests from memo; archived from settings.quests when enabled.
 * @param {string} memoText
 * @returns {any[]}
 */
function getDisplayQuests(memoText) {
    const s = getSettings();
    const showArchive = s.syspromptModules?.questsShowArchive !== false;
    const memoQuests = parseQuestsFromMemo(memoText);
    const activeFromMemo = memoQuests.filter(q => !isArchivedQuestStatus(q.status));

    if (!showArchive) {
        return activeFromMemo;
    }

    const memoIds = new Set(memoQuests.map(q => q.id));
    const archivedFromSettings = (s.quests || []).filter(q =>
        isArchivedQuestStatus(q.status) && !memoIds.has(q.id)
    );
    // Include archived rows still in memo until the next strip pass
    const archivedFromMemo = memoQuests.filter(q => isArchivedQuestStatus(q.status));

    const seen = new Set();
    /** @type {any[]} */
    const deduped = [];
    for (const q of [...activeFromMemo, ...archivedFromMemo, ...archivedFromSettings]) {
        if (!q?.id || seen.has(q.id)) continue;
        seen.add(q.id);
        deduped.push(q);
    }

    if (memoQuests.length > 0 || /\[QUESTS\]/i.test(memoText || '')) {
        return deduped;
    }
    if (_historyViewIndex === -1 && s.quests && s.quests.length > 0) {
        return s.quests;
    }
    return activeFromMemo;
}

export function refreshRenderedView() {
    if (!_renderedViewActive) return;
    const s = getSettings();
    const memo = _historyViewIndex === -1
        ? s.currentMemo
        : (s.memoHistory[_historyViewIndex] ?? '');

    const collapsed = loadCollapsed();
    const detached = loadDetached();

    // Extract world time from THIS snapshot for frustration computation
    const timeMatch = (memo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
    const currentTime = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';

    const el = document.getElementById('rpg-tracker-render');
    if (el) {
        const questsEnabled = s.syspromptModules?.quests !== false && !!(memo && memo.trim());
        let html;

        if (s.panelLayoutMode === 'tabs') {
            const questsCtx = questsEnabled ? { quests: getDisplayQuests(memo), currentTime } : null;
            html = renderTabModeView(memo, _sectionPages, questsCtx);
        } else {
            html = renderMemoAsCards(memo, null, _sectionPages);
            // Append quest log section if module is enabled and we are not on the onboarding screen
            if (questsEnabled) {
                html += renderQuestLog(getDisplayQuests(memo), currentTime, collapsed, detached);
            }
        }

        el.innerHTML = html;
        bindRenderedCardEvents(el, memo, false);

        // Update footer location: try parsing from recent chat status footer first, fallback to memo
        let locText = '';
        const ctx = SillyTavern.getContext();
        if (ctx && ctx.chat && ctx.chat.length) {
            for (let i = ctx.chat.length - 1; i >= 0; i--) {
                const msgContent = ctx.chat[i]?.mes || ctx.chat[i]?.['content'] || '';
                const m = msgContent.match(/\(Location:\s*([^)]+)\)/i);
                if (m) {
                    locText = m[1].trim();
                    break;
                }
            }
        }
        if (!locText) {
            const locMatch = (memo || '').match(/Location:\s*([^)\n]+)/i);
            if (locMatch) locText = locMatch[1].trim();
        }
        const footerLoc = document.getElementById('rt-footer-location');
        if (footerLoc) {
            footerLoc.textContent = locText || 'Unknown Location';
            footerLoc.title = locText ? `Location: ${locText}` : 'Unknown Location';
        }

        // In Tab Mode, surface the current in-world time in the footer so it stays
        // glanceable without needing to open the Time tab.
        const footerTime = document.getElementById('rt-footer-time');
        if (footerTime) {
            if (s.panelLayoutMode === 'tabs' && currentTime) {
                const { emoji, color } = getTimeOfDayInfo(currentTime);
                footerTime.style.display = 'inline-flex';
                footerTime.style.color = color !== 'inherit' ? color : '';
                footerTime.textContent = emoji ? `${emoji} ${currentTime}` : currentTime;
                footerTime.title = `Current Time: ${currentTime}`;
            } else {
                footerTime.style.display = 'none';
            }
        }
    }

    // Update any detached panels
    detached.forEach(tag => {
        const panel = document.getElementById(`rt-detached-panel-${tag}`);
        if (panel) {
            const body = panel.querySelector('.rpg-tracker-detached-body');
            if (body) {
                if (tag === 'QUESTS') {
                    body.innerHTML = renderQuestLog(getDisplayQuests(memo), currentTime, collapsed, detached, 'QUESTS');
                } else {
                    body.innerHTML = renderMemoAsCards(memo, tag, _sectionPages);
                }
                bindRenderedCardEvents(body, memo, true);
            }
        } else {
            // Panel missing, recreate it
            createDetachedPanel(tag);
        }
    });

    if (_historyViewIndex === -1) {
        scheduleDeferred(() => checkAndTriggerAutoGenerations(refreshAll));
    }
}

function createDetachedPanel(tag) {
    if (document.getElementById(`rt-detached-panel-${tag}`)) return;

    const customField = (getSettings().customFields || []).find(f => f.tag.toUpperCase() === tag);
    const icon = customField?.icon || BLOCK_ICONS[tag] || '📄';
    const displayName = customField?.label || tag;

    const settings = getSettings();
    const panel = document.createElement('div');
    panel.id = `rt-detached-panel-${tag}`;
    panel.className = `rpg-tracker-panel rpg-tracker-detached-panel ${settings.trackerTheme || 'rt-theme-native'}`;
    panel.style.height = '300px'; // default; overridden by saved geometry
    panel.innerHTML = `
            <div class="rpg-tracker-header rt-detached-header">
                <div class="rpg-tracker-header-left">
                    <span>${icon} ${displayName}</span>
                </div>
                <div class="rpg-tracker-header-right">
                    <button class="rpg-tracker-icon-btn rt-reattach-btn" data-tag="${tag}" title="Re-attach">✕</button>
                </div>
            </div>
            <div class="rpg-tracker-content rpg-tracker-detached-body">
                <!-- Content injected here via refreshRenderedView() -->
            </div>
            <div class="rt-resizer-br rt-detached-resizer-br" title="Resize"></div>
            <div class="rt-resizer-bl rt-detached-resizer-bl" title="Resize"></div>
        `;

    document.body.appendChild(panel);

    const header = panel.querySelector('.rt-detached-header');
    if (header instanceof HTMLElement) {
        makeDraggable(panel, header, `rpg_tracker_geometry_${tag}`);
    }

    // Per-tag geometry key (same key used by makeDraggable above)
    const geoKey = `rpg_tracker_geometry_${tag}`;

    // Save helper scoped to this detached panel's key
    const saveDetachedGeo = () => {
        const rect = panel.getBoundingClientRect();
        localStorage.setItem(geoKey, JSON.stringify({
            left: rect.left, top: rect.top,
            width: rect.width, height: rect.height
        }));
    };

    // Wire up the BR resizer (bottom-right: drag right/down)
    const resizerBR = /** @type {HTMLElement} */ (panel.querySelector('.rt-detached-resizer-br'));
    if (resizerBR) {
        let startX, startY, startW, startH, startTop, startLeft;
        resizerBR.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            resizerBR.setPointerCapture(e.pointerId);
            const rect = panel.getBoundingClientRect();
            startX = e.clientX; startY = e.clientY;
            startW = rect.width; startH = rect.height;
            startTop = rect.top; startLeft = rect.left;
            panel.style.left = startLeft + 'px'; panel.style.top = startTop + 'px';
            panel.style.right = 'auto'; panel.style.bottom = 'auto';
            panel.style.maxHeight = 'none';
            e.preventDefault(); e.stopPropagation();
        });
        resizerBR.addEventListener('pointermove', (e) => {
            if (!resizerBR.hasPointerCapture(e.pointerId)) return;
            panel.style.width  = Math.max(220, startW + (e.clientX - startX)) + 'px';
            panel.style.height = Math.max(120, startH + (e.clientY - startY)) + 'px';
        });
        resizerBR.addEventListener('pointerup', (e) => {
            try { resizerBR.releasePointerCapture(e.pointerId); } catch(_){}
            saveDetachedGeo();
        });
        resizerBR.addEventListener('pointercancel', (e) => {
            try { resizerBR.releasePointerCapture(e.pointerId); } catch(_){}
        });
    }

    // Wire up the BL resizer (bottom-left: drag left expands width, down expands height)
    const resizerBL = /** @type {HTMLElement} */ (panel.querySelector('.rt-detached-resizer-bl'));
    if (resizerBL) {
        let startX, startY, startW, startH, startTop, startLeft;
        resizerBL.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            resizerBL.setPointerCapture(e.pointerId);
            const rect = panel.getBoundingClientRect();
            startX = e.clientX; startY = e.clientY;
            startW = rect.width; startH = rect.height;
            startTop = rect.top; startLeft = rect.left;
            panel.style.left = startLeft + 'px'; panel.style.top = startTop + 'px';
            panel.style.right = 'auto'; panel.style.bottom = 'auto';
            panel.style.maxHeight = 'none';
            e.preventDefault(); e.stopPropagation();
        });
        resizerBL.addEventListener('pointermove', (e) => {
            if (!resizerBL.hasPointerCapture(e.pointerId)) return;
            const dx = e.clientX - startX;
            const newW = Math.max(220, startW - dx);
            if (newW > 220) {
                panel.style.width = newW + 'px';
                panel.style.left  = (startLeft + dx) + 'px';
            }
            panel.style.height = Math.max(120, startH + (e.clientY - startY)) + 'px';
        });
        resizerBL.addEventListener('pointerup', (e) => {
            try { resizerBL.releasePointerCapture(e.pointerId); } catch(_){}
            saveDetachedGeo();
        });
        resizerBL.addEventListener('pointercancel', (e) => {
            try { resizerBL.releasePointerCapture(e.pointerId); } catch(_){}
        });
    }

    try {
        const saved = JSON.parse(localStorage.getItem(geoKey));
        if (saved && saved.left !== undefined) {
            // Sanitize coordinates
            const left = Math.max(0, Math.min(window.innerWidth - 50, saved.left));
            const top = Math.max(0, Math.min(window.innerHeight - 50, saved.top));

            panel.style.left = left + 'px'; panel.style.right = 'auto';
            panel.style.top = top + 'px'; panel.style.bottom = 'auto';
            if (saved.width)  panel.style.width  = saved.width  + 'px';
            if (saved.height) panel.style.height = saved.height + 'px';
        } else {
            const mainPanel = document.getElementById('rpg-tracker-panel');
            if (mainPanel) {
                const rect = mainPanel.getBoundingClientRect();
                // spawn adjacent to the main panel if no stored position
                let spawnLeft = rect.left - 270;
                if (spawnLeft < 0) spawnLeft = rect.right + 10;
                panel.style.left = Math.max(10, spawnLeft) + 'px';
                panel.style.top = rect.top + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
            }
        }
    } catch { /* ignore */ }

    panel.querySelector('.rt-reattach-btn').addEventListener('click', () => {
        const detached = loadDetached();
        detached.delete(tag);
        saveDetached(detached);
        panel.remove();
        refreshRenderedView();
    });

    // Trigger an initial render to fill its body
    refreshRenderedView();
}





/**
 * UI Implementation
 */
function createPanel() {
    const settings = getSettings();

    // Cleanup any existing detached panels from the body to prevent duplicates on re-init
    document.querySelectorAll('body > .rpg-tracker-detached-panel').forEach(el => el.remove());
    document.querySelector('body > #rpg-tracker-agent')?.remove();

    const panel = document.createElement('div');
    panel.id = 'rpg-tracker-panel';
    panel.className = `rpg-tracker-panel ${settings.trackerCollapsed ? 'rt-panel-collapsed ' : ''}${settings.trackerTheme || 'rt-theme-native'}`;
    panel.style.setProperty('--rt-base-size', (settings.fontSize || 13) + 'px');
    panel.innerHTML = `
            <div class="rt-resizer-tr" id="rt-resizer-tr" title="Resize from top-right"></div>
            <div class="rpg-tracker-header" id="rpg-tracker-header">
                <div class="rpg-tracker-header-left">
                    <span class="rt-header-title-desktop">Multihog D&D Framework</span>
                    <span class="rt-header-title-mobile" style="display: none;">Multihog D&D</span>
                    <div class="rpg-tracker-status-indicator active" id="rpg-tracker-status"></div>
                    <button class="rpg-tracker-stop-btn" id="rpg-tracker-stop-btn" title="Stop Generation" style="display:none;">■</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-chat-link-btn" style="font-size:13px;" title="Chat Link ON">🔗</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-agent-btn" title="Lorebook Agent">🤖</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-prompt-btn" title="Toggle direct prompt">💬</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-view-btn" title="Toggle rendered view">⊞</button>
                </div>
                <div class="rpg-tracker-header-center" id="rpg-tracker-pause-banner"></div>
                <div class="rpg-tracker-header-right">
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-enable-btn" title="${settings.enabled ? 'Disable State Tracker' : 'Enable State Tracker'}" style="${settings.enabled ? '' : 'opacity:0.4;'}" >⏻</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-update-btn" title="Update State Now">🔄</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-pause-btn" title="Pause Tracker">⏸</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-portraits-menu-btn" title="AI Portrait Actions">🖼️</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-debug-btn" title="Context Debugger" style="display:none;">🛠️</button>
                    <button class="rpg-tracker-icon-btn rt-overflow-trigger" id="rt-overflow-btn" title="More actions">⋯</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-collapse-btn" title="Collapse Panel"><i class="fa-solid ${settings.trackerCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-close-btn" title="Hide panel">✕</button>
                </div>
            </div>
            <div class="rpg-tracker-content">
                <textarea class="rpg-tracker-memo-area" id="rpg-tracker-memo">${settings.currentMemo}</textarea>
                <div class="rpg-tracker-render-view" id="rpg-tracker-render" style="display:none;"></div>
            </div>
            <div class="rpg-tracker-delta-resize-handle" id="rpg-tracker-delta-handle" style="display:none;"></div>
            <div class="rpg-tracker-delta-panel" id="rpg-tracker-delta" style="display:none;">
                <div class="rpg-tracker-delta-toolbar">
                    <span class="rpg-tracker-delta-title">Change Log</span>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-delta-clear" title="Clear log">✕</button>
                </div>
                <div id="rpg-tracker-delta-content">${settings.lastDelta || '<span class="delta-empty">No changes yet.</span>'}</div>
            </div>
            <div class="rpg-tracker-panel rpg-tracker-agent-panel ${settings.agentCollapsed ? 'rt-panel-collapsed ' : ''}${settings.trackerTheme || 'rt-theme-native'}" id="rpg-tracker-agent" style="display:none; position: absolute; right: 0; top: 30px; width: 300px; max-height: calc(100% - 30px); z-index: 1000; flex-direction: column; resize: none !important; overflow: hidden !important;">
                <div class="rpg-tracker-header" style="cursor: default;">
                    <span class="rpg-tracker-header-left"><i class="fa-solid fa-robot"></i> <span>Lorebook Agent: Autonomous Librarian</span></span>
                    <div class="rpg-tracker-header-center" id="rt-agent-pause-banner" style="color:#ffa500; font-size:0.7em; font-weight:bold; letter-spacing:0.04em;">${settings.routerPaused ? 'AGENT PAUSED' : ''}</div>
                    <div class="rpg-tracker-header-right">
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-manual-run" title="Run Research Now" style="color: var(--rt-accent);"><i class="fa-solid fa-play"></i></button>
                        <button class="rpg-tracker-stop-btn" id="rt-agent-stop-btn" title="Stop Agent" style="display:none;">■</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-full-audit-panel" title="Run Full Audit (Chunked)" style="color: #ff5555;"><i class="fa-solid fa-book-journal-whills"></i></button>
                         <div id="rt-cleanup-menu-wrap" style="position:relative; display:inline-flex;">
                             <button class="rpg-tracker-icon-btn" id="rt-agent-router-cleanup" title="Cleanup Menu" style="color: #e67e22;"><i class="fa-solid fa-broom"></i></button>
                             <div id="rt-cleanup-dropdown" style="display:none; position:absolute; top:100%; right:0; z-index:9999; background:#131320; border:1px solid rgba(230,126,34,0.35); border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,0.5); min-width:200px; padding:4px 0; margin-top:2px;">
                                 <button id="rt-cleanup-run-btn" style="display:block; width:100%; text-align:left; padding:7px 14px; background:none; border:none; color:var(--rt-text,#e0e0e0); font-size:12px; cursor:pointer; white-space:nowrap;">🧹 Run Cleanup</button>
                                 <div style="height:1px; background:rgba(255,255,255,0.06); margin:2px 0;"></div>
                                 <button id="rt-cleanup-settings-toggle" style="display:block; width:100%; text-align:left; padding:7px 14px; background:none; border:none; color:var(--rt-text,#e0e0e0); font-size:12px; cursor:pointer; white-space:nowrap;">⚙ Cleanup Settings</button>
                                 <div id="rt-cleanup-settings-panel" style="display:none; padding:8px 12px; border-top:1px solid rgba(255,255,255,0.07); margin-top:2px;">
                                     <label style="display:flex; align-items:center; gap:6px; font-size:10px; opacity:0.75; margin-bottom:8px; cursor:pointer; user-select:none;">
                                         <input id="rt-cleanup-use-threshold-chk" type="checkbox" ${settings.routerCleanupUseThreshold !== false ? 'checked' : ''} style="margin:0; cursor:pointer; accent-color:#e67e22;">
                                         Use Token Threshold
                                     </label>
                                     <div id="rt-cleanup-threshold-row" style="transition:opacity 0.15s; opacity:${settings.routerCleanupUseThreshold !== false ? '1' : '0.35'}; pointer-events:${settings.routerCleanupUseThreshold !== false ? 'auto' : 'none'};">
                                         <label style="font-size:10px; opacity:0.6; display:block; margin-bottom:2px;">Token Threshold</label>
                                         <input id="rt-cleanup-threshold-inp" type="text" inputmode="numeric" pattern="[0-9]*" min="50" max="5000" step="50" value="${settings.routerCleanupTokenThreshold || 300}" style="width:100%; background:rgba(0,0,0,0.35); color:var(--rt-text,#e0e0e0); border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:3px 6px; font-size:11px; box-sizing:border-box; margin-bottom:8px;">
                                     </div>
                                     <label style="font-size:10px; opacity:0.6; display:block; margin-bottom:2px;">Auto-Cleanup Every N Turns <span style="opacity:0.45;">(0 = off)</span></label>
                                     <input id="rt-cleanup-every-inp" type="text" inputmode="numeric" pattern="[0-9]*" min="0" max="100" step="1" value="${settings.routerCleanupEvery || 0}" style="width:100%; background:rgba(0,0,0,0.35); color:var(--rt-text,#e0e0e0); border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:3px 6px; font-size:11px; box-sizing:border-box;">
                                 </div>
                             </div>
                         </div>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-enable-btn" title="${settings.routerEnabled ? 'Disable Lorebook Agent' : 'Enable Lorebook Agent'}" style="${settings.routerEnabled ? '' : 'opacity:0.35;'}">⏻</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-pause-btn" title="${settings.routerPaused ? 'Resume Agent (auto-runs paused)' : 'Pause Agent (skip auto-runs)'}" style="${settings.routerPaused ? 'color:#ffa500;' : ''}">${settings.routerPaused ? '▶' : '⏸'}</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-prompt-btn" title="Toggle direct prompt">💬</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-detach" title="Detach Lorebook Agent">⧉</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-collapse-btn" title="Collapse Panel"><i class="fa-solid ${settings.agentCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                        <button class="rpg-tracker-icon-btn" id="rpg-tracker-agent-close" title="Close">✕</button>
                    </div>
                </div>
                <div class="rpg-tracker-content" style="flex: 1; overflow-y: auto; resize: none; padding: 10px; color: var(--rt-text); display: flex; flex-direction: column;">
                    <!-- Quick Settings Collapsible Header -->
                    <div id="rt-agent-settings-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); user-select: none; flex-shrink: 0;">
                        <div style="font-weight: bold; font-size: 0.846em; display: flex; align-items: center; gap: 6px; color: var(--rt-text-muted);">
                            <i class="fa-solid ${settings.agentSettingsOpen !== false ? 'fa-chevron-down' : 'fa-chevron-right'}" id="rt-agent-settings-toggle-icon"></i> Quick Settings
                        </div>
                        <button id="rt-agent-help-btn" style="background: var(--rt-accent-bg); border: 1px solid var(--rt-accent-dim); color: var(--rt-accent); border-radius: 12px; width: 18px; height: 18px; font-size: 0.769em; cursor: pointer; display: flex; align-items: center; justify-content: center; margin: 0; flex-shrink: 0;" title="What is the Lorebook Agent?">?</button>
                    </div>

                    <!-- Quick Settings Drawer -->
                    <div id="rt-agent-settings-drawer" style="display: ${settings.agentSettingsOpen !== false ? 'block' : 'none'}; margin-bottom: 10px; flex-shrink: 0;">
                        <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: pointer; opacity: 0.8; font-size: 0.846em;" title="Use simple text tags [[NPC: Name | Desc]] instead of complex tools. Better for small models.">
                            Basic Mode (tag-based, no tool calls)
                            <input type="checkbox" id="rt-agent-router-basic" ${settings.routerBasicMode ? 'checked' : ''}>
                        </label>

                        <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: pointer; opacity: 0.8; font-size: 0.846em;" title="When enabled, the extension's keyword scanner is fully disabled. SillyTavern's native lorebook keyword system handles all keyword-based entry activation. The agent will not auto-activate or auto-expire entries based on keywords.">
                            Native Keyword Activation
                            <input type="checkbox" id="rt-agent-router-native-kw" ${settings.routerNativeKeywordActivation ? 'checked' : ''}>
                        </label>

                        ${(() => {
                            const mode = settings.routerLookbackSinceLastRun !== false ? 'since_last_run'
                                : settings.routerLookbackSinceLastUser === true ? 'since_last_user' : 'fixed';
                            return `
                        <div style="margin-bottom: 8px;">
                            <div style="font-size: 0.769em; opacity: 0.7; margin-bottom: 4px;">Lookback mode:</div>
                            <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px; cursor: pointer; font-size: 0.769em; opacity: 0.85;" title="Read every message since the last successful agent run — ideal when Run Every > 1.">
                                <input type="radio" name="rt-lookback-mode" id="rt-agent-lookback-mode-run" value="since_last_run" ${mode === 'since_last_run' ? 'checked' : ''}>
                                <span>Since last run</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px; cursor: pointer; font-size: 0.769em; opacity: 0.75;" title="Read from the most recent user message through to the latest AI response.">
                                <input type="radio" name="rt-lookback-mode" id="rt-agent-lookback-mode-user" value="since_last_user" ${mode === 'since_last_user' ? 'checked' : ''}>
                                <span>Since last user message</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 4px; cursor: pointer; font-size: 0.769em; opacity: 0.75;" title="Read a fixed number of recent user turns.">
                                <input type="radio" name="rt-lookback-mode" id="rt-agent-lookback-mode-fixed" value="fixed" ${mode === 'fixed' ? 'checked' : ''}>
                                <span>Fixed turn count:</span>
                            </label>
                            <div id="rt-agent-router-lookback-container" style="display: inline-flex; align-items: center; gap: 6px; margin-left: 20px; transition: opacity 0.2s; ${mode !== 'fixed' ? 'opacity: 0.35; pointer-events: none;' : ''}" title="Read the last N user turns (includes all tool messages in each turn).">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-lookback" value="${settings.routerLookback || 4}" min="1" max="100" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 3px; text-align: center; font-size: 0.769em; padding: 1px;">
                                <span style="font-size: 0.769em; opacity: 0.5;">msgs</span>
                            </div>
                        </div>`;
                        })()}

                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 6px; flex: 1;" title="Run every N messages: 1 = fires every turn (always current, but may create excessive entry granularity). 3+ = fires less often but sees more narrative context, producing more coherent updates. Keyword hits still fire immediately regardless.">
                                <span style="font-size: 0.769em; opacity: 0.7;">Run every:</span>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-run-every" value="${settings.routerRunEvery || 3}" min="1" max="50" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 3px; text-align: center; font-size: 0.769em; padding: 1px;">
                                <span style="font-size: 0.769em; opacity: 0.5;">msgs</span>
                            </div>
                        </div>

                        <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px; cursor: pointer; font-size: 0.769em; opacity: 0.75;" title="Include hidden messages (e.g. messages collapsed by a summarizer) in the agent's lookback window.">
                            <input type="checkbox" id="rt-agent-router-include-hidden" ${settings.routerIncludeHidden ? 'checked' : ''}>
                            <span>Include hidden msgs (summarizer)</span>
                        </label>

                        <div style="display: flex; gap: 8px; margin-bottom: 10px; align-items: flex-end;">
                            <div style="flex: 1;" title="Max Turns: How many Thought/Action loops the agent can perform before timing out (Advanced Mode only).">
                                <div style="margin-bottom: 5px; opacity: 0.8; font-size: 0.846em; color: var(--rt-text-muted);">Max Agent Turns:</div>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-max-turns" value="${settings.routerMaxTurns || 5}" style="width: 100%; background: var(--rt-card-bg); color: var(--rt-text); border: var(--rt-border); border-radius: 4px; padding: 4px; font-size: 0.846em; box-sizing: border-box;">
                            </div>
                            <div style="flex: 1;" title="Max Active Keys: The maximum number of lore entries the agent can keep in Active Memory. Once reached, it must deactivate old entries to add new ones.">
                                <div style="margin-bottom: 5px; opacity: 0.8; font-size: 0.846em; color: var(--rt-text-muted);">Max Active Keys:</div>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-max-activations" value="${settings.routerMaxActivations || 8}" min="1" max="20" style="width: 100%; background: var(--rt-card-bg); color: var(--rt-text); border: var(--rt-border); border-radius: 4px; padding: 4px; font-size: 0.846em; box-sizing: border-box;">
                            </div>
                            <div style="flex: 1;" title="Keyword Overflow Cap: max keyword-triggered entries allowed above Max Active Keys (0 = no cap). When exceeded, the oldest keyword entries are evicted first. Example: Max Active=8, Cap=4 → hard ceiling of 12 total.">
                                <div style="margin-bottom: 5px; opacity: 0.8; font-size: 0.846em; color: var(--rt-text-muted); line-height: 1.2;">Keyword Overflow Cap<br><span style="font-size: 0.75em; opacity: 0.5; font-weight: normal;">(0 = no cap)</span>:</div>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-router-kw-overflow-cap" value="${settings.routerMaxKeywordOverflow ?? 0}" min="0" max="50" style="width: 100%; background: var(--rt-card-bg); color: var(--rt-text); border: var(--rt-border); border-radius: 4px; padding: 4px; font-size: 0.846em; box-sizing: border-box;">
                            </div>
                        </div>
                        


                    </div>

                    <!-- Modular Repertoire Collapsible Header -->
                    <div id="rt-agent-modules-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); user-select: none; flex-shrink: 0;">
                        <div style="font-weight: bold; font-size: 0.846em; display: flex; align-items: center; gap: 6px; color: var(--rt-text-muted);">
                            <i class="fa-solid ${settings.agentModulesOpen !== false ? 'fa-chevron-down' : 'fa-chevron-right'}" id="rt-agent-modules-toggle-icon"></i> Modular Repertoire (Prompt Rules)
                        </div>
                    </div>

                    <!-- Modular Repertoire Drawer -->
                    <div id="rt-agent-modules-drawer" style="display: ${settings.agentModulesOpen !== false ? 'block' : 'none'}; margin-bottom: 10px; flex-shrink: 0;">
                        <div style="margin-bottom: 5px; font-weight: bold; opacity: 0.8; font-size: 0.846em;">Enabled Modules (Stock):</div>
                        <div id="rt-agent-stock-modules-list" style="margin-bottom: 10px;"></div>

                        <div style="margin-bottom: 5px; font-weight: bold; opacity: 0.8; font-size: 0.846em;">Custom Tags:</div>
                        <div id="rt-agent-custom-tags-list"></div>
                        <button id="rt-agent-add-custom-tag" style="width: 100%; background: #333; border: 1px solid #444; color: #ddd; font-size: 0.769em; padding: 2px; border-radius: 3px; cursor: pointer; margin-top: 4px; flex-shrink: 0;">+ Add Custom Tag</button>
                    </div>

                    <!-- Console Collapsible Header -->
                    <div id="rt-agent-console-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); user-select: none; flex-shrink: 0;">
                        <div style="font-weight: bold; font-size: 0.846em; display: flex; align-items: center; gap: 6px; color: var(--rt-text-muted);">
                            <i class="fa-solid ${settings.agentConsoleOpen !== false ? 'fa-chevron-down' : 'fa-chevron-right'}" id="rt-agent-console-toggle-icon"></i> Console
                        </div>
                    </div>

                    <!-- Console Section Drawer -->
                    <div id="rt-agent-console-drawer" style="display: ${settings.agentConsoleOpen !== false ? 'block' : 'none'}; margin-bottom: 10px; flex-shrink: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <div style="font-weight: bold; opacity: 0.8; font-size: 0.846em;">Lorebook Terminal:</div>
                            <button id="rt-agent-router-terminal-clear" style="background: transparent; border: none; color: #ff5555; font-size: 0.692em; cursor: pointer; opacity: 0.7;">Clear</button>
                        </div>
                        <div id="rt-agent-router-terminal" style="background: var(--rt-card-bg); border: var(--rt-border); border-radius: 4px; padding: 8px; min-height: 80px; max-height: 200px; overflow-y: auto; margin-bottom: 10px; font-family: var(--rt-font-mono);">
                            <div style="opacity: 0.4; font-size: 0.769em; font-style: italic; color: var(--rt-text-muted);">Waiting for agent activity...</div>
                        </div>

                        <hr style="border-color: rgba(255,255,255,0.05); margin: 10px 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <div style="font-weight: bold; opacity: 0.8; font-size: 0.846em;">Agent Log History:</div>
                            <button id="rt-agent-router-log-clear" style="background: transparent; border: none; color: #ff5555; font-size: 0.692em; cursor: pointer; opacity: 0.7;">Clear</button>
                        </div>
                        <div id="rt-agent-router-log" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px; max-height: 150px; overflow-y: auto;">
                        </div>
                    </div>

                    <!-- World Progression Collapsible Header -->
                    <div id="rt-agent-world-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); user-select: none; flex-shrink: 0;">
                        <div style="font-weight: bold; font-size: 0.846em; display: flex; align-items: center; gap: 6px; color: var(--rt-text-muted);">
                            <i class="fa-solid ${settings.agentWorldOpen ? 'fa-chevron-down' : 'fa-chevron-right'}" id="rt-agent-world-toggle-icon"></i>
                            🌍 World Progression
                        </div>
                        <span id="rt-agent-world-enabled-badge" style="font-size:0.692em; padding:1px 7px; border-radius:10px; font-weight:bold; cursor:pointer; user-select:none; ${settings.worldProgressionEnabled ? 'background:rgba(52,168,83,0.18); color:#34a853; border:1px solid rgba(52,168,83,0.3);' : 'background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.1);'}" title="Click to toggle World Progression">${settings.worldProgressionEnabled ? 'ON' : 'OFF'}</span>
                    </div>

                    <!-- World Progression Drawer -->
                    <div id="rt-agent-world-drawer" style="display: ${settings.agentWorldOpen ? 'block' : 'none'}; margin-bottom: 10px; flex-shrink: 0;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
                            <div style="background:var(--rt-card-bg); border:var(--rt-border); border-radius:4px; padding:5px 8px;">
                                <div style="font-size:0.692em; opacity:0.5; color:var(--rt-text-muted); margin-bottom:2px;">Last fired</div>
                                <div id="rt-agent-world-last-fired" style="font-size:0.769em; color:var(--rt-text);">—</div>
                            </div>
                            <div style="background:var(--rt-card-bg); border:var(--rt-border); border-radius:4px; padding:5px 8px;">
                                <div style="font-size:0.692em; opacity:0.5; color:var(--rt-text-muted); margin-bottom:2px;">Next fire</div>
                                <div id="rt-agent-world-next-fire" style="font-size:0.769em; color:var(--rt-text);">—</div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                            <span style="font-size:0.769em; opacity:0.7; white-space:nowrap;">Interval:</span>
                            <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-world-interval" value="${settings.worldProgressionIntervalHours || 24}" style="width:50px; background:var(--rt-card-bg); color:var(--rt-text); border:var(--rt-border); border-radius:3px; text-align:center; font-size:0.769em; padding:2px;">
                            <span style="font-size:0.769em; opacity:0.5;">in-world hours</span>
                        </div>
                        <button id="rt-agent-world-fire-now" style="width:100%; background:rgba(52,168,83,0.15); border:1px solid rgba(52,168,83,0.3); color:#34a853; border-radius:4px; padding:5px; font-size:0.769em; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                            <i class="fa-solid fa-globe"></i> Fire Now
                        </button>
                        <button id="rt-agent-world-fire-extra" style="width:100%; background:rgba(0,180,216,0.15); border:1px solid rgba(0,180,216,0.3); color:#00b4d8; border-radius:4px; padding:5px; font-size:0.769em; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; margin-top:5px;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Fire with Extra Instructions
                        </button>
                        <button id="rt-agent-world-reset-timeline" title="Clears the last-fired timestamp so World Progression starts fresh from now" style="width:100%; background:rgba(234,67,53,0.1); border:1px solid rgba(234,67,53,0.25); color:rgba(234,67,53,0.75); border-radius:4px; padding:4px; font-size:0.692em; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; margin-top:5px;">
                            <i class="fa-solid fa-clock-rotate-left"></i> Reset Timeline
                        </button>
                    </div>

                    <div id="rt-agent-keys-toggle" style="display: flex; align-items: center; gap: 6px; margin-bottom: 5px; flex-shrink: 0; cursor: pointer; user-select: none;">
                        <div style="font-weight: bold; opacity: 0.8; font-size: 0.846em; display: flex; align-items: center; gap: 4px;">
                            <span id="rt-agent-keys-chevron" style="display: inline-block; width: 10px; transition: transform 0.2s; font-size: 0.9em; opacity: 0.7;"><i class="fa-solid fa-chevron-down"></i></span>
                            Active Lore Keys:
                            <span id="rt-agent-active-tokens" style="font-weight: normal; opacity: 0.55; color: var(--rt-text-muted); font-size: 0.95em;">(0t)</span>
                        </div>
                        <button id="rt-agent-keys-refresh" title="Refresh active keys from disk" style="background: none; border: none; color: var(--rt-accent); font-size: 0.769em; cursor: pointer; opacity: 0.6; padding: 0;" ><i class="fa-solid fa-arrows-rotate"></i></button>
                    </div>
                    <div id="rt-agent-router-active-keys" style="margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; flex-shrink: 0;">
                    </div>

                    <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; display: flex; flex-direction: column; flex: 1; min-height: 200px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-shrink: 0;">
                            <div style="font-weight: bold; opacity: 0.8; font-size: 0.846em;">CAMPAIGN RECORDS</div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <button class="rpg-tracker-icon-btn" id="rt-agent-activate-books" title="Activate campaign lorebooks now" style="font-size: 0.769em; opacity: 0.5;"><i class="fa-solid fa-book-open"></i></button>
                                <button class="rpg-tracker-icon-btn" id="rt-agent-manifest-refresh" title="Refresh Manifest" style="font-size: 0.769em; opacity: 0.5;"><i class="fa-solid fa-arrows-rotate"></i></button>
                            </div>
                        </div>
                        <div id="rt-agent-manifest-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                            <div style="text-align: center; opacity: 0.5; font-size: 0.769em; padding: 10px;">Click refresh to load lore...</div>
                        </div>
                    </div>
                </div>
                <div class="rpg-tracker-prompt-bar" id="rt-agent-prompt-bar" style="display:none; border-top: var(--rt-border); box-sizing: border-box;">
                    <textarea class="rpg-tracker-prompt-input" id="rt-agent-prompt-input" rows="2" placeholder="Instruct the agent model… (Enter to send, Shift+Enter for newline)">${settings.routerDirectPrompt || ''}</textarea>
                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: flex-end;">
                        <div class="rt-prompt-ctx-control" style="font-size: 0.692em; display: flex; flex-direction: column; align-items: center; gap: 0;" title="Direct lookback: last N chat messages (user and assistant) for this manual run.">
                            <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-agent-prompt-context-val" value="${settings.routerDirectLookback || 10}" min="1" max="100" style="width: 28px; height: 16px; font-size: 0.692em; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 3px; text-align: center; padding: 0;">
                            <span style="opacity: 0.5; font-size: 8px; line-height: 1;">msg</span>
                        </div>
                        <button class="rpg-tracker-prompt-send" id="rt-agent-prompt-send" title="Run command">▶</button>
                    </div>
                </div>
                <div class="rpg-tracker-footer" id="rt-agent-footer">
                    <div id="rt-agent-last-run" style="text-align: center; font-size: 0.8em; opacity: 0.65; color: var(--rt-text-muted); padding: 2px 0 4px; line-height: 1.3; flex-shrink: 0;"></div>
                    <div class="rpg-tracker-nav">
                        <button class="rpg-tracker-nav-btn" id="rt-agent-nav-back" title="Undo last lorebook pass">←</button>
                        <span class="rpg-tracker-nav-label" id="rt-agent-nav-label">[ LIVE ]</span>
                        <button class="rpg-tracker-nav-btn" id="rt-agent-nav-fwd" title="Redo lorebook pass">→</button>
                    </div>
                </div>
                <div class="rt-resizer-br" id="rt-agent-resizer-br" title="Resize from bottom-right"></div>
                <div class="rt-resizer-bl" id="rt-agent-resizer-bl" title="Resize from bottom-left"></div>
            </div>
            <div class="rpg-tracker-prompt-bar" id="rpg-tracker-prompt-bar" style="display:none;">
                <textarea class="rpg-tracker-prompt-input" id="rpg-tracker-prompt-input" rows="2" placeholder="Instruct the tracker model… (Enter to send, Shift+Enter for newline)"></textarea>
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: flex-end;">
                    <div class="rt-prompt-ctx-control" style="font-size: 0.692em; display: flex; flex-direction: column; align-items: center; gap: 0;" title="Context: number of recent messages to include">
                        <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt-prompt-context-val" value="${settings.directPromptContext || 5}" min="0" max="50" style="width: 28px; height: 16px; font-size: 0.692em; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 3px; text-align: center; padding: 0;">
                        <span style="opacity: 0.5; font-size: 8px; line-height: 1;">msg</span>
                    </div>
                    <button class="rpg-tracker-prompt-send" id="rpg-tracker-prompt-send" title="Send instruction">▶</button>
                </div>
            </div>
            <div class="rpg-tracker-footer" id="rt-main-footer">
                <div class="rt-mobile-top-row">
                    <button class="rt-footer-toggle-btn" id="rt-footer-expand-btn" title="Toggle Settings Drawer"><i class="fa-solid fa-chevron-up"></i></button>
                    <div class="rpg-tracker-nav">
                        <button class="rpg-tracker-nav-btn" id="rpg-tracker-nav-back" title="View previous snapshot">←</button>
                        <span class="rpg-tracker-nav-label" id="rpg-tracker-nav-label">Live</span>
                        <button class="rpg-tracker-nav-btn" id="rpg-tracker-nav-fwd" title="View next snapshot">→</button>
                    </div>
                </div>
                <div class="flex-container gap-1 alignitemscenter rt-rng-footer-group" style="display:none;">
                    <!-- Removed inline RNG toggles, now located in extension settings -->
                </div>
                <div class="rt-footer-center-group" id="rt-footer-center-group" style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                    <div id="rt-footer-time" style="display: none; font-size: 0.769em; color: var(--rt-accent); white-space: nowrap; flex-shrink: 0; opacity: 0.9; cursor: help;" title="Current in-world time"></div>
                    <div id="rt-footer-location" style="font-size: 0.769em; color: var(--rt-accent); flex: 1; min-width: 0; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.9; cursor: help;" title="Current Location (Main, Sub)"></div>
                </div>
                <div class="flex-container gap-1 alignitemscenter rt-utility-footer-group">
                    <button class="rpg-tracker-nav-btn" id="rpg-tracker-chat-link-footer-btn" title="Chat Link ON" style="padding: 1px 8px; font-size: 0.85em;">🔗 Link</button>
                    <span id="rpg-tracker-count">~${Math.round(settings.currentMemo.length / 2.62)} tokens</span>
                    <button class="rpg-tracker-nav-btn" id="rpg-tracker-delta-btn" title="Toggle change log" style="padding: 1px 5px; font-size: 0.692em; opacity: 0.8; margin-left: 5px;">δ</button>
                    <button class="rpg-tracker-nav-btn" id="rpg-tracker-memo-clear" style="padding: 1px 5px; font-size: 0.692em; opacity: 0.8; margin-left: 5px;" title="Clear memo and history">CLEAR</button>
                </div>
            </div>
        `;

    document.body.appendChild(panel);

    const header = panel.querySelector('#rpg-tracker-header');
    if (header instanceof HTMLElement) {
        makeDraggable(/** @type {HTMLElement} */(panel), header);
    }
    loadPanelGeometry(/** @type {HTMLElement} */(panel));

    const isTrackerVisible = localStorage.getItem('rpg_tracker_visible') !== 'false';
    if (!isTrackerVisible) {
        panel.style.display = 'none';
    }
    // Start the resize observer AFTER geometry is restored so the initial
    // ResizeObserver callback doesn't immediately overwrite the restored position.
    setupResizeObserver(/** @type {HTMLElement} */(panel));

    const resizerTR = panel.querySelector('#rt-resizer-tr');
    if (resizerTR instanceof HTMLElement) {
        makeResizableTR(/** @type {HTMLElement} */(panel), resizerTR);
    }

    // State tracker bottom-right resizer (created via JS for guaranteed rendering)
    const resizerBR = document.createElement('div');
    resizerBR.id = 'rt-resizer-br';
    resizerBR.className = 'rt-resizer-br';
    resizerBR.title = 'Resize from bottom-right';
    panel.appendChild(resizerBR);
    makeResizableBR(/** @type {HTMLElement} */(panel), resizerBR);

    // State tracker bottom-left resizer
    const resizerBL = document.createElement('div');
    resizerBL.id = 'rt-resizer-bl';
    resizerBL.className = 'rt-resizer-bl';
    resizerBL.title = 'Resize from bottom-left';
    panel.appendChild(resizerBL);
    makeResizableBL(/** @type {HTMLElement} */(panel), resizerBL);

    // Agent panel bottom-right resizer
    const agentPanelEl = /** @type {HTMLElement} */(panel.querySelector('#rpg-tracker-agent'));
    const agentResizerBR = panel.querySelector('#rt-agent-resizer-br');
    if (agentResizerBR instanceof HTMLElement && agentPanelEl) {
        makeResizableBR(agentPanelEl, agentResizerBR);
    }

    // Agent panel bottom-left resizer
    const agentResizerBL = panel.querySelector('#rt-agent-resizer-bl');
    if (agentResizerBL instanceof HTMLElement && agentPanelEl) {
        makeResizableBL(agentPanelEl, agentResizerBL);
    }

    const stopBtn = panel.querySelector('#rpg-tracker-stop-btn');
    if (stopBtn) {
        stopBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // 1. Abort the state update controller (kills fetch/Ollama/OpenAI)
            if (_stateController) {
                _stateController.abort();
                _stateController = null;
            }
            // 2. Stop SillyTavern generation (kills internal ST requests)
            const { stopGeneration } = SillyTavern.getContext();
            if (stopGeneration) stopGeneration();
        });
    }

    const enableBtn = panel.querySelector('#rpg-tracker-enable-btn');
    if (enableBtn) {
        enableBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = getSettings();
            s.enabled = !s.enabled;
            saveSettings();
            updatePanelStatus();
            if (s.enabled) {
                scheduleAutoApply();
            }
        });
    }

    const pauseBtn = panel.querySelector('#rpg-tracker-pause-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = getSettings();
            // Pause button only toggles the paused state, not the enabled state
            s.paused = !s.paused;
            saveSettings();
            updatePanelStatus();
        });
    }

    // ── Chat Link Toggle ──
    const chatLinkBtn = panel.querySelector('#rpg-tracker-chat-link-btn');
    if (chatLinkBtn) {
        chatLinkBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const { Popup, POPUP_RESULT } = SillyTavern.getContext();
            const s = getSettings();
            const turningOn = !s.chatLinkEnabled;

            if (turningOn && _currentChatId) {
                const saved = s.chatStates?.[_currentChatId];
                const liveContent = (s.currentMemo || '').trim();
                const savedContent = (saved?.currentMemo || '').trim();

                const liveKeys = s.activeRouterKeys || [];
                const savedKeys = saved?.activeRouterKeys || [];
                const keysChanged = JSON.stringify(liveKeys.sort()) !== JSON.stringify(savedKeys.sort());

                // Show conflict if EITHER content or keys are different
                const hasConflict = (savedContent && liveContent && liveContent !== savedContent) || (savedKeys.length > 0 && liveKeys.length > 0 && keysChanged);

                if (hasConflict) {
                    const body = `
                            <div style="text-align: left;">
                                <p><b>Conflict Detected:</b> This chat has a saved state (memo or lore keys), but your current session is not empty.</p>
                                <p style="font-size: 0.9em; opacity: 0.8; margin-top: 10px;">
                                    <b>RESTORE:</b> Use the chat's saved state. (Current session moved to history)<br>
                                    <b>OVERWRITE:</b> Keep current session and save it to this chat. (Old chat data moved to history)
                                </p>
                            </div>`;

                    const choice = await Popup.show.confirm('⚠️ Chat Link Conflict', body, {
                        okButton: 'RESTORE',
                        cancelButton: 'OVERWRITE',
                        customButtons: [
                            {
                                text: 'CANCEL',
                                result: POPUP_RESULT.CANCELLED,
                                appendAtEnd: true,
                            }
                        ],
                    });

                    if (choice === POPUP_RESULT.AFFIRMATIVE) {
                        // User wants to Restore
                        if (s.currentMemo) {
                            saved.memoHistory = saved.memoHistory || [];
                            saved.memoHistory.unshift({
                                memo: s.currentMemo,
                                delta: s.lastDelta,
                                timestamp: Date.now(),
                                label: 'Global Edit (Pre-Link)'
                            });
                            if (saved.memoHistory.length > 50) saved.memoHistory.length = 50;
                        }
                        loadChatState(_currentChatId);
                        toastr['success']('Chat Link ON — restored saved state.', 'RPG Tracker');
                    } else if (choice === POPUP_RESULT.NEGATIVE) {
                        // User wants to Overwrite
                        if (saved.currentMemo) {
                            s.memoHistory.unshift(saved.currentMemo);
                            if (s.memoHistory.length > 50) s.memoHistory.length = 50;
                        }
                        saveChatState(_currentChatId);
                        toastr['success']('Chat Link ON — current state saved to chat.', 'RPG Tracker');
                    } else {
                        // User closed the modal or hit escape — cancel the toggle
                        return;
                    }
                } else {
                    // No conflict or chat was empty
                    saveChatState(_currentChatId);
                    toastr['success']('Chat Link ON — state bound to this chat.', 'RPG Tracker');
                }
            } else if (turningOn) {
                // Normal lock (empty or new chat)
                if (_currentChatId) {
                    const found = loadChatState(_currentChatId);
                    if (!found) saveChatState(_currentChatId);
                }
                toastr['success']('Chat Link ON', 'RPG Tracker');
            } else {
                toastr['info']('Chat Link OFF — using global state.', 'RPG Tracker');
            }

            s.chatLinkEnabled = turningOn;
            saveSettings();
            updateChatLinkUI();
        });
    }

    const chatLinkFooterBtn = panel.querySelector('#rpg-tracker-chat-link-footer-btn');
    if (chatLinkFooterBtn && chatLinkBtn) {
        chatLinkFooterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatLinkBtn.click();
        });
    }

    // ── Router Agent UI ──
    const agentBtn = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-agent-btn'));
    const agentPanel = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-agent'));
    agentPanel.style.setProperty('--rt-base-size', (settings.agentFontSize || 13) + 'px');
    const agentCloseBtn = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-agent-close'));

    renderRouterUI = async function () {
        const s = getSettings();
        const keysContainer = agentPanel.querySelector('#rt-agent-router-active-keys');
        const logContainer = agentPanel.querySelector('#rt-agent-router-log');
        if (!keysContainer || !logContainer) return;

        keysContainer.style.display = s.agentKeysCollapsed ? 'none' : 'flex';
        const chevron = agentPanel.querySelector('#rt-agent-keys-chevron');
        if (chevron) {
            chevron.style.transform = s.agentKeysCollapsed ? 'rotate(-90deg)' : '';
        }

        const ctx = SillyTavern.getContext();
        const books = {};
        const activeKeys = s.activeRouterKeys || [];

        // Collect needed lorebooks to minimize loads
        const neededBooks = new Set();
        for (const k of activeKeys) {
            const parts = k.split('::');
            if (parts.length > 1) neededBooks.add(parts[0]);
        }

        const bookLoads = await Promise.all([...neededBooks].map(async (bookName) => {
            try {
                return [bookName, await ctx.loadWorldInfo(bookName)];
            } catch (_) {
                return [bookName, null];
            }
        }));
        for (const [bookName, book] of bookLoads) {
            if (book) books[bookName] = book;
        }

        // Calculate total active tokens
        let activeTokens = 0;
        for (const k of activeKeys) {
            const [bookName, uid] = k.split('::');
            const entry = books[bookName]?.entries?.[uid];
            if (entry) {
                activeTokens += Math.round((entry.content || '').length / 4);
            }
        }
        const activeTokensEl = agentPanel.querySelector('#rt-agent-active-tokens');
        if (activeTokensEl) {
            activeTokensEl.textContent = `(${activeTokens}t)`;
        }

        // Use keywordActivatedKeys (persistent pool) for yellow pill coloring.
        // lastKeywordTriggeredKeys only covers the most recent scan pass and resets immediately.
        const keywordTriggeredSet = new Set(s.keywordActivatedKeys || []);

        keysContainer.innerHTML = activeKeys.map(k => {
            const [bookName, uid] = k.split('::');
            const entry = books[bookName]?.entries?.[uid];

            const shortBook = bookName.split('_').pop() || bookName;
            let label = `${shortBook}/${uid}`;
            let title = "No entry found.";
            if (entry) {
                label = entry.comment || (entry.key?.[0]) || uid;
                title = `[${bookName}] ${entry.key?.join(', ')}\n\n${(entry.content || '').substring(0, 500)}${entry.content?.length > 500 ? '...' : ''}`;
            }

            const isKeywordTriggered = keywordTriggeredSet.has(k);
            const pillBg = isKeywordTriggered ? 'rgba(58, 46, 14, 0.9)' : 'rgba(42, 42, 53, 0.8)';
            const pillBorder = isKeywordTriggered ? '1px solid rgba(210, 160, 40, 0.6)' : '1px solid rgba(255,255,255,0.1)';
            const tooltipPrefix = isKeywordTriggered ? '⌂ Keyword-triggered this turn\n\n' : '';

            return `<span class="rt-router-pill" style="background: ${pillBg}; padding: 2px 8px; border-radius: 12px; font-size: 0.769em; border: ${pillBorder}; display: inline-flex; align-items: center; gap: 6px; cursor: help; max-width: 120px;" title="${escapeHtml(tooltipPrefix + title)}">
                    ${isKeywordTriggered ? '<span style="color: #d4a028; font-size: 0.9em; flex-shrink: 0;" title="Keyword-triggered this turn">⌂</span>' : ''}
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(label)}</span>
                    <span class="rt-router-kill-key" data-key="${k}" style="cursor:pointer; color: #ff5555; font-weight: bold; padding: 0 2px;" title="Deactivate">✕</span>
                </span>`;
        }).join('') || '<span style="opacity:0.5; font-size:10px;">None</span>';

        logContainer.innerHTML = (s.routerLog || []).map(entry => {
            let diffStr = '';
            if (entry.activate?.length) diffStr += `<span style="color:#55ff55;">+${entry.activate.length}</span> `;
            if (entry.deactivate?.length) diffStr += `<span style="color:#ff5555;">-${entry.deactivate.length}</span> `;
            if (entry.record?.length) diffStr += `<span style="color:#55ccff;" title="Created: ${entry.record.join(', ')}">*${entry.record.length}</span> `;
            if (entry.delete?.length) diffStr += `<span style="color:#ff3333; font-weight: bold;" title="Deleted: ${entry.delete.join(', ')}">✕${entry.delete.length}</span> `;
            if (entry.rewrite?.length) diffStr += `<span style="color:#e67e22; font-weight: bold;" title="Rewritten: ${entry.rewrite.join(', ')}">✎${entry.rewrite.length}</span> `;
            if (entry.consolidate?.length) diffStr += `<span style="color:#9b59b6; font-weight: bold;" title="Consolidated: ${entry.consolidate.join(', ')}">⎘${entry.consolidate.length}</span> `;
            return `<div style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; font-size: 0.769em; margin-bottom: 4px; border-left: 2px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; justify-content: space-between; opacity: 0.7; margin-bottom: 2px; font-weight: bold;">
                        <span>${entry.time}</span>
                        <span>${diffStr}</span>
                    </div>
                    <div style="line-height: 1.3;">${escapeHtml(entry.reason)}</div>
                </div>`;
        }).join('') || '<span style="opacity:0.5; font-size:10px;">No logs yet.</span>';

        // Attach kill handlers
        keysContainer.querySelectorAll('.rt-router-kill-key').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = /** @type {HTMLElement} */ (e.target);
                const key = target.getAttribute('data-key');
                const st = getSettings();
                if (st.activeRouterKeys) {
                    st.activeRouterKeys = st.activeRouterKeys.filter(k => k !== key);
                    if (st.keywordActivatedKeys) {
                        st.keywordActivatedKeys = st.keywordActivatedKeys.filter(k => k !== key);
                    }
                    if (st.lastKeywordTriggeredKeys) {
                        st.lastKeywordTriggeredKeys = st.lastKeywordTriggeredKeys.filter(k => k !== key);
                    }
                    saveSettings();
                    renderRouterUI();
                }
            });
        });

        // Refresh World Progression status display (reads agentPanel from outer scope)
        {
            const wpS = getSettings();
            const wpLabel = wpS.worldProgressionLastFiredPeriodLabel || '';
            const wpMins = wpLabel ? parseInWorldTime(wpLabel) : -1;
            const wpIntervalMins = (wpS.worldProgressionIntervalHours || 24) * 60;
            function _fmtWP(m) {
                return formatInWorldTime(m);
            }
            const wpLastEl = agentPanel.querySelector('#rt-agent-world-last-fired');
            const wpNextEl = agentPanel.querySelector('#rt-agent-world-next-fire');
            const wpBadge  = agentPanel.querySelector('#rt-agent-world-enabled-badge');
            if (wpLastEl) wpLastEl.textContent = wpLabel || 'Never';

            let wpNextMins = -1;
            if (wpMins >= 0) {
                wpNextMins = wpMins + wpIntervalMins;
            } else {
                const tMatch = (wpS.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
                const tStr = tMatch ? extractCurrentTimeStr(tMatch[1]) : '';
                const tMins = tStr ? parseInWorldTime(tStr) : -1;
                if (tMins >= 0) wpNextMins = tMins + wpIntervalMins;
            }
            if (wpNextEl) wpNextEl.textContent = wpNextMins >= 0 ? _fmtWP(wpNextMins) : '—';
            if (wpBadge) {
                wpBadge.textContent = wpS.worldProgressionEnabled ? 'ON' : 'OFF';
                wpBadge.style.cssText = wpS.worldProgressionEnabled
                    ? 'font-size:0.692em; padding:1px 7px; border-radius:10px; font-weight:bold; background:rgba(52,168,83,0.18); color:#34a853; border:1px solid rgba(52,168,83,0.3);'
                    : 'font-size:0.692em; padding:1px 7px; border-radius:10px; font-weight:bold; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.1);';
            }
        }
    }

    // Assigned below when the agent panel is wired. Declared here so
    // nav handlers outside the wiring block can always call it safely.
    let refreshManifest = async (_source = 'uninitialized') => { };
    let _manifestRenderGen = 0;
    let updateAgentBtnUI = () => { };

    if (agentBtn && agentPanel && agentCloseBtn) {
        const isAgentDetached = () => localStorage.getItem('rpg_tracker_agent_detached') === 'true';

        updateAgentBtnUI = () => {
            const isVisible = agentPanel.style.display !== 'none';
            if (isVisible) {
                agentBtn.classList.add('active');
            } else {
                agentBtn.classList.remove('active');
            }
        };

        agentBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = (/** @type {HTMLElement} */ (agentPanel)).style.display === 'none';
            if (isHidden) {
                const s = getSettings();
                (/** @type {HTMLElement} */ (agentPanel)).style.display = 'flex';
                localStorage.setItem('rpg_tracker_agent_visible', 'true');
                // Auto-expand the main tracker if it's collapsed; agent panel is an absolute
                // child, so overflow:hidden on the main panel would clip it otherwise.
                if (s.trackerCollapsed) {
                    s.trackerCollapsed = false;
                    localStorage.setItem('rpg_tracker_collapsed', 'false');
                    panel.classList.remove('rt-panel-collapsed');
                    const colIcon = panel.querySelector('#rpg-tracker-collapse-btn i');
                    if (colIcon) colIcon.className = 'fa-solid fa-chevron-up';
                }

                // Hide Raw/Rendered view if docked
                if (!isAgentDetached()) {
                    const taEl = panel.querySelector('#rpg-tracker-memo');
                    const rvEl = panel.querySelector('#rpg-tracker-render');
                    if (taEl) taEl.style.display = 'none';
                    if (rvEl) rvEl.style.display = 'none';
                }

                syncRouterPrefixDisplays(s.routerCampaignPrefix || '');
                renderRouterUI();
                refreshManifest();

                // Show undock tip once on first launch if docked
                if (!isAgentDetached() && !s.routerUndockHintShown) {
                    s.routerUndockHintShown = true;
                    saveSettings();
                    toastr['info'](
                        'Tip: Click the ⧉ (Detach) button in the Agent header to run the Lorebook Agent as a standalone draggable panel. It is designed to work best when undocked!',
                        'Lorebook Agent',
                        { timeOut: 8000, closeButton: true }
                    );
                }
            } else {
                (/** @type {HTMLElement} */ (agentPanel)).style.display = 'none';
                localStorage.setItem('rpg_tracker_agent_visible', 'false');
                // Restore Raw/Rendered view if docked
                if (!isAgentDetached()) {
                    applyViewState();
                }
            }
            updateAgentBtnUI();
        });
        agentCloseBtn.addEventListener('click', () => {
            (/** @type {HTMLElement} */ (agentPanel)).style.display = 'none';
            localStorage.setItem('rpg_tracker_agent_visible', 'false');
            if (!isAgentDetached()) {
                applyViewState();
            }
            updateAgentBtnUI();
        });
        const helpBtn = agentPanel.querySelector('#rt-agent-help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                const content = `
                        <div style="text-align: left; font-size: 13px; line-height: 1.5; max-height: 65vh; overflow-y: auto; padding-right: 8px;">
                            <h3 style="margin-top: 0; color: var(--rt-custom-accent, #3498db);">The Lorebook Agent</h3>
                            <p>An autonomous narrative librarian. It scans your recent chat, decides what has changed, and writes new or updated entries directly into your SillyTavern lorebooks — no manual data entry needed.</p>

                            <h4 style="margin-bottom: 5px;">⏱️ How Often to Run Lorebook Agent?</h4>
                            <p>By default, the Agent runs every 3 messages, but there are tradeoffs to consider:</p>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Pros of running less often:</b> It can make more coherent entries without excess granularity (though the cleanup tool can retroactively fix this).</li>
                                <li><b>Cons of running less often:</b> Activations will rely more on keywords and might not be quite as pinpoint.</li>
                            </ul>
                            <p style="margin-top:4px;">The recommended range is every <b>1-3</b> messages.</p>

                            <h4 style="margin-bottom: 5px;">🤖 Operating Modes</h4>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Basic Mode (Tags)</b> — The model outputs structured tags the Agent parses directly:<br>
                                    <code style="font-size:11px;">[[NPC: Name | Description | keyword1, keyword2]]</code><br>
                                    Supported types: <code>NPC</code>, <code>LOC</code>, <code>FAC</code>, <code>QUEST</code>, <code>EVENT</code>, plus <code>[[ACTIVATE: name]]</code>, <code>[[DEACTIVATE: name]]</code>, <code>[[DELETE: name]]</code>.<br>
                                    Ideal for smaller/local models (Mistral Small, Gemma, Qwen, etc.).</li>
                                <li style="margin-top:8px;"><b>Advanced Mode (Tools)</b> — Multi-turn ReAct loop: the model reasons (<i>Thought</i>), calls a tool (<i>Action</i>), receives a result (<i>Observation</i>), and repeats until it calls <code>finish</code> or hits Max Turns. Tools include <code>record</code>, <code>update</code>, <code>activate</code>, <code>deactivate</code>, <code>delete</code>, and <code>search</code>. Gemini 3.1 Flash Lite is highly recommended as it is 100% reliable and very low cost. GPT-5x Mini or even Nano can also be good.</li>
                            </ul>

                            <h4 style="margin-bottom: 5px;">🧠 Attention-Based Memory</h4>
                            <p>The Agent sees two tiers of lorebook content:</p>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Active entries</b> — full content is visible in the Agent's context. Keyword-triggered by SillyTavern and managed via <b>Active Lore Keys</b>.</li>
                                <li><b>Inactive entries</b> — listed only by name and keywords (no content). The Agent must activate them first to read or update their body.</li>
                            </ul>
                            <p style="margin-top:4px;"><b>Max Active</b> caps how many entries can be active simultaneously (FIFO pruning keeps token cost predictable).</p>

                            <h4 style="margin-bottom: 5px;">📂 Campaign Records</h4>
                            <p>The Agent writes directly into SillyTavern's native Lorebook system, creating namespaced campaign books for the current story (e.g. <i>Eldoria_NPCs</i>, <i>Eldoria_Locations</i>, <i>Eldoria_Factions</i>). All books for the active campaign are shown here, grouped by type. Click any folder to expand it; click any entry to read its full content. Books are automatically activated and deactivated based on the current chat — no manual action needed. This includes the <b>World Section</b> (<code>{prefix}_World</code>) created by the World Progression engine, which houses off-screen progression reports.</p>

                            <h4 style="margin-bottom: 5px;">🧹 Cleanup & Compression</h4>
                            <p>To keep context sizes optimized, the framework uses a two-fold cleanup system:</p>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Active Key Pruning:</b> When the active entry count exceeds the configured limit, the oldest activated entries are automatically deactivated (pruned) to make room for new ones.</li>
                                <li><b>Archivist Compression:</b> You can trigger a cleanup pass globally (via the broom button in the agent header) or on a targeted entry. The <b>Lorebook Archivist</b> will compress bloated entries and consolidate duplicates to save tokens while keeping unique facts and timelines intact.</li>
                            </ul>
                            <p style="margin-top:4px;"><i>Note: Standard Agent passes and standard cleanup/pruning do not process the World book reports. Those are managed independently via World Progression settings.</i></p>

                            <h4 style="margin-bottom: 5px;">↩ History Navigation</h4>
                            <p>The <b>← [ LIVE ] →</b> bar at the bottom lets you step back through lorebook snapshots and redo steps you've undone — just like the State Tracker's memo history. Each agent pass is snapshotted before it runs (up to 5 saved). A new pass clears the redo stack.</p>

                            <h4 style="margin-bottom: 5px;">🛠️ Modular Repertoire</h4>
                            <p>Toggle which entity types the Agent tracks (NPCs, Locations, Factions, Quests, Events) and add <b>Custom Tags</b> for anything world-specific. Every module's system prompt snippet is editable so you control exactly how the AI records data.</p>

                            <h4 style="margin-bottom: 5px;">🕹️ Controls Reference</h4>
                            <ul style="padding-left: 20px; margin-top: 0;">
                                <li><b>Main Lookback</b>: Messages the Agent scans during automatic post-generation runs.</li>
                                <li><b>Max Turns</b>: Maximum ReAct loop iterations before the Agent is forced to finish (Advanced Mode).</li>
                                <li><b>Max Active</b>: Maximum simultaneously active lore entries.</li>
                                <li><b>Direct Command</b>: Runs a one-off agent pass with a custom instruction and its own lookback window — useful for targeted research or corrections.</li>
                            </ul>
                        </div>
                    `;
                const { Popup } = SillyTavern.getContext();
                Popup.show.confirm('📖 Lorebook Agent Documentation', content, { okButton: 'Got it', cancelButton: false });
            });
        }

        /** Applies/removes is-agent-disabled on the agent panel to match routerEnabled. */
        function updateAgentPanelDisabled() {
            const s = getSettings();
            if (s.routerEnabled) {
                agentPanel.classList.remove('is-agent-disabled');
            } else {
                agentPanel.classList.add('is-agent-disabled');
            }
            // Keep settings sidebar toggle in sync
            const sidebarCheck = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_router_enabled'));
            if (sidebarCheck) sidebarCheck.checked = !!s.routerEnabled;
            // Keep header ⏻ button in sync
            const agentEnableBtn = /** @type {HTMLElement|null} */ (agentPanel.querySelector('#rt-agent-router-enable-btn'));
            if (agentEnableBtn) {
                agentEnableBtn.style.opacity = s.routerEnabled ? '' : '0.35';
                agentEnableBtn.title = s.routerEnabled ? 'Disable Lorebook Agent' : 'Enable Lorebook Agent';
            }
        }

        // Apply on open
        updateAgentPanelDisabled();
        updateAgentWorldStatus();

        // ── Agent collapse/expand ──
        const toggleAgentCollapse = () => {
            const s = getSettings();
            s.agentCollapsed = !s.agentCollapsed;
            localStorage.setItem('rpg_tracker_agent_collapsed', String(s.agentCollapsed));

            if (s.agentCollapsed) {
                agentPanel.classList.add('rt-panel-collapsed');
            } else {
                agentPanel.classList.remove('rt-panel-collapsed');
            }

            const icon = agentPanel.querySelector('#rt-agent-router-collapse-btn i');
            if (icon) {
                icon.className = s.agentCollapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
            }
        };

        const agentCollapseBtn = agentPanel.querySelector('#rt-agent-router-collapse-btn');
        if (agentCollapseBtn) {
            agentCollapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleAgentCollapse();
            });
        }

        const agentHeader = agentPanel.querySelector('.rpg-tracker-header');
        if (agentHeader) {
            agentHeader.addEventListener('dblclick', (e) => {
                if (e.target instanceof Element && e.target.closest('button, input, select, textarea')) return;
                toggleAgentCollapse();
            });
        }

        // ── Agent Quick Settings Toggle ──
        const toggleAgentSettings = () => {
            const s = getSettings();
            s.agentSettingsOpen = !s.agentSettingsOpen;
            localStorage.setItem('rpg_tracker_agent_settings_open', String(s.agentSettingsOpen));

            const drawer = agentPanel.querySelector('#rt-agent-settings-drawer');
            if (drawer) {
                drawer.style.display = s.agentSettingsOpen ? 'block' : 'none';
            }

            const icon = agentPanel.querySelector('#rt-agent-settings-toggle-icon');
            if (icon) {
                icon.className = s.agentSettingsOpen ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right';
            }
        };

        const settingsHeader = agentPanel.querySelector('#rt-agent-settings-header');
        if (settingsHeader) {
            settingsHeader.addEventListener('click', (e) => {
                if (e.target instanceof Element && e.target.closest('#rt-agent-help-btn')) return;
                toggleAgentSettings();
            });
        }

        // ── Agent Modular Repertoire Toggle ──
        const toggleAgentModules = () => {
            const s = getSettings();
            s.agentModulesOpen = !s.agentModulesOpen;
            localStorage.setItem('rpg_tracker_agent_modules_open', String(s.agentModulesOpen));

            const modulesDrawer = agentPanel.querySelector('#rt-agent-modules-drawer');
            if (modulesDrawer) {
                modulesDrawer.style.display = s.agentModulesOpen ? 'block' : 'none';
            }

            const icon = agentPanel.querySelector('#rt-agent-modules-toggle-icon');
            if (icon) {
                icon.className = s.agentModulesOpen ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right';
            }
        };

        const modulesHeader = agentPanel.querySelector('#rt-agent-modules-header');
        if (modulesHeader) {
            modulesHeader.addEventListener('click', () => {
                toggleAgentModules();
            });
        }

        // ── Agent Console Toggle ──
        const toggleAgentConsole = () => {
            const s = getSettings();
            s.agentConsoleOpen = !s.agentConsoleOpen;
            localStorage.setItem('rpg_tracker_agent_console_open', String(s.agentConsoleOpen));

            const consoleSection = agentPanel.querySelector('#rt-agent-console-drawer');
            if (consoleSection) {
                consoleSection.style.display = s.agentConsoleOpen ? 'block' : 'none';
            }

            const icon = agentPanel.querySelector('#rt-agent-console-toggle-icon');
            if (icon) {
                icon.className = s.agentConsoleOpen ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right';
            }
        };

        const consoleHeader = agentPanel.querySelector('#rt-agent-console-header');
        if (consoleHeader) {
            consoleHeader.addEventListener('click', () => {
                toggleAgentConsole();
            });
        }

        // ── Agent World Progression Toggle ──
        const toggleAgentWorld = () => {
            const s = getSettings();
            s.agentWorldOpen = !s.agentWorldOpen;
            localStorage.setItem('rpg_tracker_agent_world_open', String(s.agentWorldOpen));
            const drawer = agentPanel.querySelector('#rt-agent-world-drawer');
            if (drawer) drawer.style.display = s.agentWorldOpen ? 'block' : 'none';
            const icon = agentPanel.querySelector('#rt-agent-world-toggle-icon');
            if (icon) icon.className = s.agentWorldOpen ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right';
        };
        const worldHeader = agentPanel.querySelector('#rt-agent-world-header');
        if (worldHeader) {
            worldHeader.addEventListener('click', (e) => {
                if (e.target instanceof Element && e.target.closest('#rt-agent-world-enabled-badge')) return;
                toggleAgentWorld();
            });
        }

        const badgeEl = agentPanel.querySelector('#rt-agent-world-enabled-badge');
        if (badgeEl) {
            badgeEl.addEventListener('click', async (e) => {
                e.stopPropagation();
                const s = getSettings();
                s.worldProgressionEnabled = !s.worldProgressionEnabled;
                saveSettings();
                updateAgentWorldStatus();
                $('#rpg_world_progression_enabled').prop('checked', s.worldProgressionEnabled);
                if (_currentChatId) {
                    await syncCampaignPrefixAndWorldsForChat(_currentChatId, 'toggle-world-progression');
                }
            });
        }

        // ── Agent World Progression status display helper ──
        function updateAgentWorldStatus() {
            const s = getSettings();
            const label = s.worldProgressionLastFiredPeriodLabel || '';
            const mins = label ? parseInWorldTime(label) : -1;
            const intervalHours = s.worldProgressionIntervalHours || 24;
            const intervalMins = intervalHours * 60;
            function fmtWP(m) {
                return formatInWorldTime(m);
            }
            const lastEl = agentPanel.querySelector('#rt-agent-world-last-fired');
            const nextEl = agentPanel.querySelector('#rt-agent-world-next-fire');
            const badge  = agentPanel.querySelector('#rt-agent-world-enabled-badge');
            if (lastEl) lastEl.textContent = label || 'Never';

            let nextMins = -1;
            if (mins >= 0) {
                nextMins = mins + intervalMins;
            } else {
                const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
                const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
                const currentMins = timeStr ? parseInWorldTime(timeStr) : -1;
                if (currentMins >= 0) {
                    nextMins = currentMins + intervalMins;
                }
            }
            if (nextEl) nextEl.textContent = nextMins >= 0 ? fmtWP(nextMins) : '—';
            if (badge) {
                badge.textContent = s.worldProgressionEnabled ? 'ON' : 'OFF';
                badge.style.cssText = s.worldProgressionEnabled
                    ? 'font-size:0.692em; padding:1px 7px; border-radius:10px; font-weight:bold; cursor:pointer; user-select:none; background:rgba(52,168,83,0.18); color:#34a853; border:1px solid rgba(52,168,83,0.3);'
                    : 'font-size:0.692em; padding:1px 7px; border-radius:10px; font-weight:bold; cursor:pointer; user-select:none; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.1);';
            }
        }
        updateAgentWorldStatusRef = updateAgentWorldStatus;

        // ── Agent World Interval input ──
        const worldIntervalInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-world-interval'));
        if (worldIntervalInp) {
            worldIntervalInp.addEventListener('input', () => {
                getSettings().worldProgressionIntervalHours = parseInt(worldIntervalInp.value) || 24;
                saveSettings();
                updateAgentWorldStatus();
                $('#rpg_world_progression_interval').val(getSettings().worldProgressionIntervalHours);
                if (typeof updateWorldProgressionLastFiredDisplayRef === 'function') {
                    updateWorldProgressionLastFiredDisplayRef();
                }
            });
        }

        // ── Agent World Fire Now button ──
        const worldFireNowBtn = agentPanel.querySelector('#rt-agent-world-fire-now');
        if (worldFireNowBtn) {
            worldFireNowBtn.addEventListener('click', async () => {
                const { parseInWorldMinutes: piw, runWorldProgressionPass: rwp } = await import('./router.js');
                const s = getSettings();
                const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
                const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
                const currentMinutes = piw(timeStr);
                if (currentMinutes < 0) {
                    toastr['warning']('Cannot parse in-world time from State Memo. Make sure the State Tracker has run at least once.', 'World Progression');
                    return;
                }
                const savedLast = s.worldProgressionLastFiredAtMinutes;
                s.worldProgressionLastFiredAtMinutes = -1;
                /** @type {HTMLButtonElement} */ (worldFireNowBtn).disabled = true;
                worldFireNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating…';
                try {
                    await rwp(timeStr, currentMinutes);
                    updateAgentWorldStatus();
                    toastr['success']('World Progression report generated.', 'World Progression');
                } catch (e) {
                    toastr['error'](`World Progression error: ${e.message}`, 'World Progression');
                    s.worldProgressionLastFiredAtMinutes = savedLast;
                } finally {
                    /** @type {HTMLButtonElement} */ (worldFireNowBtn).disabled = false;
                    worldFireNowBtn.innerHTML = '<i class="fa-solid fa-globe"></i> Fire Now';
                }
            });
        }

        // ── Agent World Fire with Extra Instructions button ──
        const worldFireExtraBtn = agentPanel.querySelector('#rt-agent-world-fire-extra');
        if (worldFireExtraBtn) {
            worldFireExtraBtn.addEventListener('click', async () => {
                const { parseInWorldMinutes: piw, runWorldProgressionPass: rwp } = await import('./router.js');
                const s = getSettings();
                const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
                const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
                const currentMinutes = piw(timeStr);
                if (currentMinutes < 0) {
                    toastr['warning']('Cannot parse in-world time from State Memo. Make sure the State Tracker has run at least once.', 'World Progression');
                    return;
                }

                const popupBody = `
                    <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box;">
                        <div style="font-size:13px; opacity:0.9; font-weight:bold;">🌍 Fire with Extra Instructions</div>
                        <div style="font-size:11px; opacity:0.7; line-height:1.4;">
                            Enter extra instructions to append to the World Progression system prompt for this run only (e.g., "make things pick up", "get more chaotic").
                        </div>
                        <textarea id="rt_wp_extra_instructions_agent" rows="4" class="text_pole"
                            style="font-size:12px; resize:vertical; width:100%;"
                            placeholder="e.g. Make the factions more aggressive, increase conflicts, or introduce a major weather event."></textarea>
                    </div>
                `;

                let extraInstructions = '';
                setTimeout(() => {
                    const textarea = document.getElementById('rt_wp_extra_instructions_agent');
                    if (textarea) {
                        textarea.addEventListener('input', () => { extraInstructions = textarea.value.trim(); });
                    }
                }, 100);

                const { Popup } = SillyTavern.getContext();
                const choice = await Popup.show.confirm('World Progression', popupBody, { okButton: 'Fire', cancelButton: 'Cancel' });
                if (!choice) return;

                const savedLast = s.worldProgressionLastFiredAtMinutes;
                s.worldProgressionLastFiredAtMinutes = -1;
                /** @type {HTMLButtonElement} */ (worldFireExtraBtn).disabled = true;
                worldFireExtraBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating…';
                try {
                    await rwp(timeStr, currentMinutes, extraInstructions);
                    updateAgentWorldStatus();
                    toastr['success']('World Progression report generated.', 'World Progression');
                } catch (e) {
                    toastr['error'](`World Progression error: ${e.message}`, 'World Progression');
                    s.worldProgressionLastFiredAtMinutes = savedLast;
                } finally {
                    /** @type {HTMLButtonElement} */ (worldFireExtraBtn).disabled = false;
                    worldFireExtraBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Fire with Extra Instructions';
                }
            });
        }

        // ── Agent World Reset Timeline button ──
        const worldResetBtn = agentPanel.querySelector('#rt-agent-world-reset-timeline');
        if (worldResetBtn) {
            worldResetBtn.addEventListener('click', () => {
                const s = getSettings();
                s.worldProgressionLastFiredAtMinutes = -1;
                s.worldProgressionLastFiredPeriodLabel = '';
                saveSettings();
                if (s.chatLinkEnabled && _currentChatId) saveChatState(_currentChatId);
                updateAgentWorldStatus();
                if (typeof updateWorldProgressionLastFiredDisplayRef === 'function') updateWorldProgressionLastFiredDisplayRef();
                toastr['info']('World Progression timeline reset. Next report will start from the current time.', 'World Progression');
            });
        }

        // ── Agent enable button (header ⏻) ──
        const agentEnableBtn = agentPanel.querySelector('#rt-agent-router-enable-btn');
        if (agentEnableBtn) {
            agentEnableBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const s = getSettings();
                s.routerEnabled = !s.routerEnabled;
                saveSettings();
                updateAgentPanelDisabled();
            });
        }

        const basicCheck = agentPanel.querySelector('#rt-agent-router-basic');
        if (basicCheck) {
            basicCheck.addEventListener('change', (e) => {
                const s = getSettings();
                s.routerBasicMode = (/** @type {HTMLInputElement} */ (e.target)).checked;
                $('#rpg_tracker_router_basic_mode').prop('checked', s.routerBasicMode);
                saveSettings();
            });
        }

        const nativeKwCheck = agentPanel.querySelector('#rt-agent-router-native-kw');
        if (nativeKwCheck) {
            nativeKwCheck.addEventListener('change', (e) => {
                const s = getSettings();
                s.routerNativeKeywordActivation = (/** @type {HTMLInputElement} */ (e.target)).checked;
                $('#rpg_tracker_router_native_keyword_activation').prop('checked', s.routerNativeKeywordActivation);
                saveSettings();
            });
        }

        // Tracks which lorebook folders are open across refreshes
        const _manifestOpenFolders = new Set();
        // Tracks which manifest entry subfolders are open
        const _manifestOpenSubFolders = new Set();
        // Tracks entries that have unsaved edits: id → { content, keys, comment }
        /** @type {Map<string, {content:string, keys:string, comment:string}>} */
        const _dirtyEntries = new Map();
        // Tracks entries whose body is currently expanded
        const _openEntries = new Set();

        /**
         * @param {object} item - manifest row from getLorebookManifest
         * @param {{ stale?: boolean, dirty?: {content:string, keys:string, comment:string} | null, isNpcEntry?: boolean }} [opts]
         */
        const buildEntryBody = (item, entryHdr, opts = {}) => {
            const isNpcEntry = !!opts.isNpcEntry;
            const body = document.createElement('div');
            body.style.cssText = 'display:none; padding:4px 4px 6px 12px; flex-direction:column; gap:5px;';
            body.dataset.entryId = item.id;

            const staleBadge = document.createElement('div');
            staleBadge.className = 'rt-agent-manifest-stale';
            staleBadge.style.cssText = 'display:' + (opts.stale ? 'block' : 'none') + '; font-size:9px; color:#ffa500; font-style:italic;';
            staleBadge.textContent = '⚠ Entry changed externally — save discards external changes or cancel to reload.';
            body.appendChild(staleBadge);

            // ── Read-only view (default when expanded) ─────────────────
            const readPane = document.createElement('div');
            readPane.className = 'rt-agent-manifest-read';
            readPane.style.cssText = 'display:flex; flex-direction:column; gap:4px;';

            const keysRead = document.createElement('div');
            keysRead.style.cssText = 'font-size:9px; opacity:0.55; color:var(--rt-text-muted); font-family:var(--rt-font-mono);';
            keysRead.textContent = '[' + item.keys.join(', ') + ']';

            const coreRead = document.createElement('div');
            coreRead.className = 'rt-agent-core-block';
            coreRead.style.display = 'none';

            const contentRead = document.createElement('div');
            contentRead.className = 'rt-agent-dynamic-block';
            contentRead.style.cssText = 'font-size:10px; opacity:0.88; color:var(--rt-text); line-height:1.45; white-space:pre-wrap; word-break:break-word; overflow-y:auto;';

            const syncReadFromItem = () => {
                keysRead.textContent = '[' + item.keys.join(', ') + ']';
                const raw = item.content || '';
                const coreMatch = raw.match(/\[CORE\]([\s\S]*?)\[\/CORE\]/i);
                const dynamic = sanitizeLorebookRecordContent(
                    raw.replace(/\[CORE\][\s\S]*?\[\/CORE\]/gi, '').trim()
                );

                if (!isNpcEntry && coreMatch) {
                    coreRead.style.display = 'block';
                    coreRead.innerHTML = `<div class="rt-agent-core-label">Permanent</div><div class="rt-agent-core-text">${escapeHtml(coreMatch[1].trim())}</div>`;
                } else {
                    coreRead.style.display = 'none';
                    coreRead.innerHTML = '';
                }

                if (isNpcEntry) {
                    contentRead.textContent = dynamic || '(No campaign history recorded yet)';
                    contentRead.style.display = 'block';
                } else if (dynamic) {
                    contentRead.textContent = dynamic;
                    contentRead.style.display = 'block';
                } else if (coreMatch) {
                    contentRead.style.display = 'none';
                } else {
                    contentRead.textContent = raw || '(Empty)';
                    contentRead.style.display = 'block';
                }
            };
            syncReadFromItem();

            const cleanBtn = entryHdr.querySelector('.rt-agent-entry-clean');
            const editBtn = entryHdr.querySelector('.rt-agent-entry-edit');
            const delBtn = entryHdr.querySelector('.rt-agent-entry-delete');

            readPane.appendChild(keysRead);
            readPane.appendChild(coreRead);
            readPane.appendChild(contentRead);
            body.appendChild(readPane);

            // ── Edit form (hidden until Edit) ─────────────────────────────
            const editPane = document.createElement('div');
            editPane.className = 'rt-agent-manifest-edit';
            editPane.style.cssText = 'display:none; flex-direction:column; gap:5px;';

            const titleRow = document.createElement('div');
            titleRow.style.cssText = 'display:flex; gap:4px; align-items:center;';
            const titleLbl = document.createElement('span');
            titleLbl.style.cssText = 'font-size:9px; opacity:0.5; color:var(--rt-text-muted); flex-shrink:0;';
            titleLbl.textContent = 'Title:';
            const titleInp = document.createElement('input');
            titleInp.type = 'text';
            titleInp.className = 'rt-agent-manifest-inp-title';
            titleInp.value = item.label;
            titleInp.style.cssText = 'flex:1; background:rgba(0,0,0,0.35); color:var(--rt-text); border:1px solid rgba(255,255,255,0.12); border-radius:3px; font-size:9px; padding:2px 5px; min-width:0;';
            titleRow.appendChild(titleLbl);
            titleRow.appendChild(titleInp);
            editPane.appendChild(titleRow);

            const keysRow = document.createElement('div');
            keysRow.style.cssText = 'display:flex; gap:4px; align-items:center;';
            const keysLbl = document.createElement('span');
            keysLbl.style.cssText = 'font-size:9px; opacity:0.5; color:var(--rt-text-muted); flex-shrink:0;';
            keysLbl.textContent = 'Keys:';
            const keysInp = document.createElement('input');
            keysInp.type = 'text';
            keysInp.className = 'rt-agent-manifest-inp-keys';
            keysInp.value = item.keys.join(', ');
            keysInp.placeholder = 'keyword1, keyword2, …';
            keysInp.style.cssText = 'flex:1; background:rgba(0,0,0,0.35); color:var(--rt-text); border:1px solid rgba(255,255,255,0.12); border-radius:3px; font-size:9px; padding:2px 5px; font-family:var(--rt-font-mono); min-width:0;';
            keysRow.appendChild(keysLbl);
            keysRow.appendChild(keysInp);
            editPane.appendChild(keysRow);

            const contentArea = document.createElement('textarea');
            contentArea.className = 'rt-agent-manifest-ta-content';
            contentArea.value = item.content || '';
            contentArea.rows = 5;
            contentArea.style.cssText = 'width:100%; background:rgba(0,0,0,0.35); color:var(--rt-text); border:1px solid rgba(255,255,255,0.12); border-radius:3px; font-size:9px; padding:4px 5px; line-height:1.4; resize:vertical; box-sizing:border-box; font-family:var(--rt-font-mono);';

            const markDirty = () => {
                _dirtyEntries.set(item.id, {
                    content: contentArea.value,
                    keys: keysInp.value,
                    comment: titleInp.value,
                });
            };
            titleInp.addEventListener('input', markDirty);
            keysInp.addEventListener('input', markDirty);
            contentArea.addEventListener('input', markDirty);
            editPane.appendChild(contentArea);

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex; gap:5px; justify-content:flex-end; align-items:center;';

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.style.cssText = 'background:rgba(0,200,140,0.15); border:1px solid rgba(0,200,140,0.4); color:#00c88c; border-radius:3px; font-size:9px; padding:2px 8px; cursor:pointer;';
            saveBtn.textContent = 'Save';
            saveBtn.title = 'Save changes to lorebook';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.style.cssText = 'background:transparent; border:1px solid rgba(255,255,255,0.12); color:var(--rt-text-muted); border-radius:3px; font-size:9px; padding:2px 8px; cursor:pointer;';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.title = 'Close editor and discard unsaved changes';

            actions.appendChild(cancelBtn);
            actions.appendChild(saveBtn);
            editPane.appendChild(actions);
            body.appendChild(editPane);

            // Restore dirty / forced-edit state from refresh
            const d = opts.dirty;
            if (d) {
                if (d.comment !== undefined) titleInp.value = d.comment;
                if (d.keys !== undefined) keysInp.value = d.keys;
                if (d.content !== undefined) contentArea.value = d.content;
                readPane.style.display = 'none';
                editPane.style.display = 'flex';
            }

            if (cleanBtn) {
                cleanBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (isRouterRunning()) {
                        // @ts-ignore
                        toastr.warning('Agent is already running.', 'Lorebook Agent');
                        return;
                    }

                    const { Popup } = SillyTavern.getContext();
                    const promptHtml = `
                            <div style="text-align: left; font-size: 0.9em; line-height: 1.4;">
                                <p>You are triggering a targeted cleanup pass for <b>${escapeHtml(item.label)}</b>.</p>
                                <p style="margin-top: 8px;">Enter custom requirements for this entry's compression (e.g., <i>"Keep the personality section intact"</i> or <i>"Shorten to 3 concise bullet points"</i>):</p>
                                <textarea id="rt-entry-clean-instructions" style="width: 100%; height: 60px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 5px; font-size: 12px; box-sizing: border-box; resize: none; margin-top: 5px;" placeholder="Leave blank for standard compression..."></textarea>
                            </div>
                        `;

                    const choice = await Popup.show.confirm('🧹 Targeted Entry Cleanup', promptHtml, {
                        okButton: 'Clean Entry',
                        cancelButton: 'Cancel'
                    });

                    if (choice) {
                        const textarea = document.getElementById('rt-entry-clean-instructions');
                        const customInstructions = textarea ? textarea.value.trim() : '';

                        const parts = item.id.split('::');
                        if (parts.length >= 2) {
                            const b = parts[0];
                            const u = parts[1];
                            let manualPrompt = `__CLEANUP__::${b}::${u}`;
                            if (customInstructions) {
                                manualPrompt += `::${customInstructions}`;
                            }
                            runRouterPass(null, manualPrompt, null, true);
                        }
                    }
                });
            }

            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    titleInp.value = item.label;
                    keysInp.value = item.keys.join(', ');
                    contentArea.value = item.content || '';
                    const snap = _dirtyEntries.get(item.id);
                    if (snap) {
                        if (snap.comment !== undefined) titleInp.value = snap.comment;
                        if (snap.keys !== undefined) keysInp.value = snap.keys;
                        if (snap.content !== undefined) contentArea.value = snap.content;
                    }
                    readPane.style.display = 'none';
                    editPane.style.display = 'flex';
                });
            }

            saveBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (isRouterRunning()) {
                    // @ts-ignore
                    toastr.warning('Agent is running — wait for it to finish before saving.', 'Lorebook Agent');
                    return;
                }
                saveBtn.disabled = true;
                saveBtn.textContent = '…';
                const rawKeys = keysInp.value.split(',').map(k => k.trim()).filter(Boolean);
                const ok = await updateLorebookEntry(item.id, {
                    content: contentArea.value,
                    key: rawKeys,
                    comment: titleInp.value,
                });
                if (ok) {
                    _dirtyEntries.delete(item.id);
                    staleBadge.style.display = 'none';
                    saveBtn.textContent = 'Save';
                    saveBtn.disabled = false;
                    
                    if (!entryHdr.parentElement) {
                        _openEntries.delete(item.id);
                    }
                    
                    document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));
                    await refreshManifest();
                    // @ts-ignore
                    toastr.success('Entry saved.', 'Lorebook Agent');
                } else {
                    saveBtn.textContent = 'Save';
                    saveBtn.disabled = false;
                    // @ts-ignore
                    toastr.error('Save failed.', 'Lorebook Agent');
                }
            });

            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _dirtyEntries.delete(item.id);
                staleBadge.style.display = 'none';
                titleInp.value = item.label;
                keysInp.value = item.keys.join(', ');
                contentArea.value = item.content || '';
                syncReadFromItem();
                
                readPane.style.display = 'flex';
                editPane.style.display = 'none';
                
                if (!entryHdr.parentElement) {
                    body.style.display = 'none';
                    _openEntries.delete(item.id);
                    const card = body.previousElementSibling;
                    if (card && card.classList.contains('rt-npc-card')) card.classList.remove('open');
                }
            });

            if (delBtn) {
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete lore entry "${item.label}"?`)) {
                        const ok = await deleteLorebookEntry(item.id);
                        if (ok) {
                            _dirtyEntries.delete(item.id);
                            _openEntries.delete(item.id);
                            await refreshManifest();
                            // @ts-ignore
                            toastr.success(`Deleted "${item.label}"`, 'Lorebook Agent');
                        }
                    }
                });
            }

            return body;
        };

        refreshManifest = async (source = 'auto') => {
            const list = agentPanel.querySelector('#rt-agent-manifest-list');
            if (!list) return;

            const gen = ++_manifestRenderGen;
            list.innerHTML = '';
                // Helper: escape HTML to prevent XSS and rendering issues
                const escapeHtml = (unsafe) => (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

                // Helper: parse NPC/PC content into structured sections for the detail popup
                const parseNpcSections = (content) => {
                    const sections = { core: {}, dynamic: [] };
                    if (!content) return sections;

                    // 1. Extract [CORE] ... [/CORE] block
                    let coreContent = '';
                    let dynamicContent = content;

                    const coreMatch = content.match(/\[CORE\]([\s\S]*?)\[\/CORE\]/i);
                    if (coreMatch) {
                        coreContent = coreMatch[1];
                        dynamicContent = content.replace(/\[CORE\][\s\S]*?\[\/CORE\]/gi, '');
                    } else {
                        coreContent = content;
                        dynamicContent = '';
                    }

                    // 2. Parse core sections
                    const sectionMarkers = /(?=(?:Appearance\/Species|Appearance|Personality|Brief Background|Background|Habits(?:\/|\s*&\s*|\s+and\s+)Behaviors|Habits|(?<!Habits\/)(?<!Habits & )(?<!Habits and )Behaviors|Relationship with\s*\{\{user\}\}|(?<!Friendship\/)(?<!Affection\/)Relationship)\s*:)/gi;
                    const normalizedCore = coreContent.replace(sectionMarkers, '\n');
                    const coreLines = normalizedCore.split('\n');
                    let currentSection = 'General';
                    const sectionPattern = /^(Appearance\/Species|Appearance|Personality|Brief Background|Background|Habits(?:\/|\s*&\s*|\s+and\s+)Behaviors|Habits|Behaviors|Relationship with\s*\{\{user\}\}|Relationship)\s*:/i;

                    for (const line of coreLines) {
                        const trimmed = line.trim();
                        if (!trimmed || /^\[ID:/i.test(trimmed) || /^Friendship\/Rapport:/i.test(trimmed) || /^Affection\/Interest:/i.test(trimmed)) continue;
                        const match = trimmed.match(sectionPattern);
                        if (match) {
                            currentSection = match[1].replace(/\s*\{\{user\}\}/, '').replace(/\s+with$/i, '').trim();
                            
                            // Normalize section names for consistent rendering
                            if (/^Habits/i.test(currentSection) && /Behaviors/i.test(currentSection)) {
                                currentSection = 'Habits/Behaviors';
                            } else if (currentSection.toLowerCase() === 'background') {
                                currentSection = 'Brief Background';
                            }
                            
                            const afterColon = trimmed.substring(match[0].length).trim();
                            if (afterColon) {
                                if (!sections.core[currentSection]) sections.core[currentSection] = [];
                                sections.core[currentSection].push(afterColon);
                            }
                        } else {
                            if (!sections.core[currentSection]) sections.core[currentSection] = [];
                            sections.core[currentSection].push(trimmed);
                        }
                    }

                    // 3. Parse dynamic updates
                    const dynamicLines = dynamicContent.split('\n');
                    for (const line of dynamicLines) {
                        const trimmed = line.trim();
                        if (!trimmed || /^\[ID:/i.test(trimmed) || /^Friendship\/Rapport:/i.test(trimmed) || /^Affection\/Interest:/i.test(trimmed)) continue;
                        const timestampOnlyRegex = /^\[[^\]]+\]\s*$/;
                        if (timestampOnlyRegex.test(trimmed)) continue;
                        sections.dynamic.push(trimmed);
                    }
                    return sections;
                };

                const sectionIcons = {
                    'General': '📋', 'Appearance/Species': '👁️', 'Appearance': '👁️', 'Personality': '🧠',
                    'Brief Background': '📜', 'Habits/Behaviors': '🔄', 'Habits': '🔄',
                    'Behaviors': '🔄', 'Relationship': '❤️',
                };

                const renderSectionsHtml = (rawContent) => {
                    const parsed = parseNpcSections(rawContent);
                    let html = '';
                    const coreEntries = Object.entries(parsed.core);
                    if (coreEntries.length > 0) {
                        html += `<div style="font-size:11px;font-weight:bold;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">🛡️ Core Identity</div>`;
                        for (const [name, lines] of coreEntries) {
                            const icon = sectionIcons[name] || '📋';
                            const sectionColor = (name === 'Appearance/Species' || name === 'Appearance') ? '#d4a940' :
                                                 name === 'Personality' ? '#8b5cf6' :
                                                 name === 'Brief Background' ? '#3b82f6' :
                                                 name.includes('Habit') || name.includes('Behavior') ? '#10b981' :
                                                 'var(--SmartThemeEmColor, var(--SmartThemeBodyColorTextMuted, rgba(128,128,128,0.5)))';
                            html += `<div style="margin-bottom:18px;">
                                <div style="font-size:14px;font-weight:bold;color:${sectionColor};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;gap:7px;">
                                    <span style="font-size:16px;">${icon}</span> ${escapeHtml(name)}
                                </div>
                                <div style="font-size:15px;line-height:1.6;color:var(--SmartThemeBodyColor, inherit);border-left:3px solid ${sectionColor}44;margin-left:3px;padding:6px 0 6px 14px;">
                                    ${lines.map(l => escapeHtml(l)).join('<br>')}
                                </div>
                            </div>`;
                        }
                    }
                    if (parsed.dynamic.length > 0) {
                        html += `<div style="font-size:11px;font-weight:bold;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;margin-top:24px;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">📖 Campaign History &amp; Dynamic Lore</div>`;
                        html += `<div style="font-size:14px;line-height:1.6;color:var(--SmartThemeBodyColor, inherit);padding:4px 0 4px 10px;">`;
                        html += parsed.dynamic.map(line => {
                            const match = line.match(/^(\[.+?\])\s*(.*)/);
                            if (match) {
                                return `<div style="margin-bottom:8px;"><span style="color:#d4a940;font-weight:bold;font-family:monospace;font-size:12px;background:rgba(212,169,64,0.1);padding:2px 6px;border-radius:4px;margin-right:6px;">${escapeHtml(match[1])}</span><span>${escapeHtml(match[2])}</span></div>`;
                            }
                            return `<div style="margin-bottom:8px;">${escapeHtml(line)}</div>`;
                        }).join('');
                        html += `</div>`;
                    }
                    return html;
                };



            try {
                const s = getSettings();
                const prefix = (s.routerCampaignPrefix || '').trim();
                // We will check !prefix and return AFTER rendering the Player Character,
                // so that the PC tab renders even if no lorebooks exist.
                // ── Player Character Rendering ──
                if (_currentChatId && s.chatStates?.[_currentChatId]?.playerCharacter) {
                    const pc = s.chatStates[_currentChatId].playerCharacter;
                    
                    let desc = '';
                    if (pc.bio) {
                        const cleanBio = pc.bio.replace(/\[\/?CORE\]/gi, '');
                        desc = cleanBio.split('\n').map(l => l.trim()).filter(l => l && !/^\[ID:/i.test(l)).slice(0, 2).join(' ').substring(0, 260);
                    }
                    const portraitSrc = s.customPortraits?.[pc.name] || '';
                    
                    const pcDiv = document.createElement('div');
                    pcDiv.className = 'rt-npc-card';
                    pcDiv.style.borderLeft = '3px solid #c4b5fd';
                    pcDiv.style.marginBottom = '12px';
                    
                    const portraitHtml = portraitSrc
                        ? `<img src="${escapeHtml(portraitSrc)}" alt="${escapeHtml(pc.name)}">`
                        : `<div class="rt-npc-portrait-placeholder" style="color:#c4b5fd; border-color:rgba(120,80,220,0.5);">👤</div>`;

                    pcDiv.innerHTML = `
                        <div class="rt-npc-portrait-wrap">
                            ${portraitHtml}
                            <div class="rt-npc-portrait-gen-overlay" title="${portraitSrc ? 'Manage portrait' : 'Generate portrait'}">${portraitSrc ? '⚙️' : '🎨'}</div>
                        </div>
                        <div class="rt-npc-info">
                            <div class="rt-npc-name" style="color:#c4b5fd;">${escapeHtml(pc.name)}</div>
                            <div class="rt-npc-desc">${escapeHtml(desc)}</div>
                            <span class="rt-npc-status-badge active" style="background:rgba(120,80,220,0.15);color:#c4b5fd;border:1px solid rgba(120,80,220,0.5);">👤 Player Character</span>
                            <div class="rt-npc-actions">
                                <button class="rt-npc-action-btn rt-npc-view" title="View PC card"><i class="fa-solid fa-address-card"></i> Full PC Card</button>
                                <button class="rt-npc-action-btn rt-npc-edit" title="Edit PC text"><i class="fa-solid fa-pen-to-square"></i></button>
                                <button class="rt-npc-action-btn rt-npc-delete" title="Unlink Player Character"><i class="fa-solid fa-link-slash"></i></button>
                            </div>
                        </div>
                    `;
                    
                    const portraitWrap = pcDiv.querySelector('.rt-npc-portrait-wrap');
                    if (portraitWrap) {
                        portraitWrap.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            if (typeof showPortraitSettingsMenu === 'function') {
                                const refreshBoth = () => {
                                    if (typeof refreshManifest === 'function') refreshManifest();
                                    if (typeof refreshRenderedView === 'function') refreshRenderedView();
                                };
                                await showPortraitSettingsMenu(pc.name, refreshBoth, pc.bio || '');
                            }
                        });
                    }

                    const openPcPopup = async (startInEditMode = false) => {
                        const ctx = SillyTavern.getContext();
                        if (!ctx.callGenericPopup) return;
                        const popupPortraitSrc = s.customPortraits?.[pc.name] || '';
                        const hidePortrait = s.npcPortraits === false;
                        const popupPortraitEl = popupPortraitSrc
                            ? `<img src="${escapeHtml(popupPortraitSrc)}" style="width:100%;height:auto;aspect-ratio:1;object-fit:cover;border-radius:12px;border:2px solid rgba(120,80,220,0.5);box-shadow:0 4px 20px rgba(0,0,0,0.4);" alt="${escapeHtml(pc.name)}">`
                            : `<div style="width:100%;aspect-ratio:1;border-radius:12px;background:var(--SmartThemeBorderColor, rgba(128,128,128,0.1));border:2px solid rgba(120,80,220,0.3);display:flex;align-items:center;justify-content:center;font-size:64px;opacity:0.25;color:var(--SmartThemeBodyColor, inherit);">👤</div>`;
                        
                        const popupDom = document.createElement('div');
                        popupDom.style.cssText = 'width:100%;box-sizing:border-box;padding:24px;text-align:left;font-family:var(--rt-font, system-ui, sans-serif);color:var(--SmartThemeBodyColor, inherit);max-height:85vh;overflow-y:auto;';
                        
                        const sectionsInitialHtml = renderSectionsHtml(pc.bio) || '<div style="font-size:14px;color:var(--SmartThemeBodyColor, inherit);opacity:0.5;font-style:italic;padding:16px 0;">No structured sections found.</div>';
                        
                        popupDom.innerHTML = `
                            <div style="display:flex;gap:24px;margin-bottom:20px;align-items:flex-start;flex-wrap:wrap;">
                                ${hidePortrait ? '' : `<div style="flex-shrink:0;width:280px;">${popupPortraitEl}</div>`}
                                <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px;">
                                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                                        <div style="font-size:24px;font-weight:bold;color:#c4b5fd;line-height:1.2;">${escapeHtml(pc.name)}</div>
                                        <button class="rt-npc-popup-edit-btn menu_button" style="flex-shrink:0;font-size:12px;padding:4px 12px;white-space:nowrap;">✏️ Edit Text</button>
                                    </div>
                                    <span style="font-size:11px;padding:3px 10px;border-radius:10px;font-weight:bold;align-self:flex-start;background:rgba(120,80,220,0.15);color:#c4b5fd;border:1px solid rgba(120,80,220,0.5);">Player Character</span>
                                </div>
                            </div>
                            <div style="border-top:2px solid rgba(120,80,220,0.2);padding-top:18px;">
                                <div class="rt-npc-popup-view">
                                    <div class="rt-npc-popup-sections">${sectionsInitialHtml}</div>
                                </div>
                                <div class="rt-npc-popup-edit" style="display:none;flex-direction:column;gap:10px;">
                                    <div style="font-size:11px;font-weight:bold;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">✏️ Editing Player Character Content</div>
                                    <textarea class="rt-npc-popup-textarea" spellcheck="false" style="width:100%;min-height:420px;box-sizing:border-box;background:var(--SmartThemeBlurTintColor, rgba(0,0,0,0.3));color:var(--SmartThemeBodyColor, inherit);border:1px solid rgba(120,80,220,0.5);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;line-height:1.6;resize:vertical;"></textarea>
                                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                                        <button class="rt-npc-popup-cancel-btn menu_button" style="font-size:12px;padding:5px 14px;">Cancel</button>
                                        <button class="rt-npc-popup-save-btn menu_button" style="font-size:12px;padding:5px 18px;background:rgba(120,80,220,0.2);border-color:rgba(120,80,220,0.5);color:#c4b5fd;font-weight:bold;">💾 Save</button>
                                    </div>
                                </div>
                            </div>
                        `;
                        
                        const viewPane = popupDom.querySelector('.rt-npc-popup-view');
                        const editPane = popupDom.querySelector('.rt-npc-popup-edit');
                        const textarea = /** @type {HTMLTextAreaElement} */ (popupDom.querySelector('.rt-npc-popup-textarea'));
                        const editBtn = popupDom.querySelector('.rt-npc-popup-edit-btn');
                        const cancelBtn = popupDom.querySelector('.rt-npc-popup-cancel-btn');
                        const saveBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-save-btn'));
                        const sectionsDiv = popupDom.querySelector('.rt-npc-popup-sections');
                        
                        const startEdit = () => {
                            textarea.value = pc.bio || '';
                            viewPane.style.display = 'none';
                            editPane.style.display = 'flex';
                            textarea.focus();
                        };
                        
                        editBtn.addEventListener('click', startEdit);
                        
                        cancelBtn.addEventListener('click', () => {
                            editPane.style.display = 'none';
                            viewPane.style.display = 'block';
                        });
                        
                        saveBtn.addEventListener('click', async () => {
                            pc.bio = textarea.value;
                            if (typeof saveChatState === 'function') saveChatState(_currentChatId);
                            
                            const newHtml = renderSectionsHtml(pc.bio) || `<div style="font-size:14px;color:var(--SmartThemeBodyColor, inherit);opacity:0.5;font-style:italic;padding:16px 0;">No structured sections found.</div>`;
                            sectionsDiv.innerHTML = newHtml;
                            
                            editPane.style.display = 'none';
                            viewPane.style.display = 'block';
                            
                            if (typeof refreshAgentManifestNow === 'function') refreshAgentManifestNow();
                            
                            // @ts-ignore
                            if (typeof toastr !== 'undefined') toastr.success('Player Character saved.', 'Campaign Records');
                        });
                        
                        if (startInEditMode) startEdit();
                        
                        const popupOpts = { okButton: 'Close', cancelButton: false, wide: true, large: true };
                        await ctx.callGenericPopup(popupDom, ctx.POPUP_TYPE?.TEXT ?? 1, '', popupOpts);
                    };

                    const viewBtn = pcDiv.querySelector('.rt-npc-view');
                    if (viewBtn) {
                        viewBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            await openPcPopup(false);
                        });
                    }

                    const extEditBtn = pcDiv.querySelector('.rt-npc-edit');
                    if (extEditBtn) {
                        extEditBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            await openPcPopup(true);
                        });
                    }
                    
                    const delBtn = pcDiv.querySelector('.rt-npc-delete');
                    if (delBtn) {
                        delBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            if (confirm('Unlink this Player Character from the current chat?')) {
                                delete s.chatStates[_currentChatId].playerCharacter;
                                if (typeof saveChatState === 'function') saveChatState(_currentChatId);
                                if (typeof refreshAgentManifestNow === 'function') await refreshAgentManifestNow();
                            }
                        });
                    }

                    list.appendChild(pcDiv);
                }

                const forceFullRefresh = source === 'manual-button';
                const loadingDiv = document.createElement('div');
                loadingDiv.id = 'rt-agent-manifest-loading';
                loadingDiv.style.cssText = 'text-align: center; opacity: 0.5; font-size: 0.769em; padding: 10px;';
                loadingDiv.innerHTML = 'Loading...';
                list.appendChild(loadingDiv);

                // ── DECOUPLED LOREBOOK RENDER ──
                // Let the browser paint the PC card and "Loading..." immediately.
                setTimeout(async () => {
                    try {
                        if (gen !== _manifestRenderGen) return;
                        console.time('[RPG Tracker] getLorebookManifest');
                        const manifest = prefix ? await getLorebookManifest(!forceFullRefresh) : [];
                        console.timeEnd('[RPG Tracker] getLorebookManifest');
                        
                        if (gen !== _manifestRenderGen) return;
                        const existingLoading = list.querySelector('#rt-agent-manifest-loading');
                        if (existingLoading) existingLoading.remove();

                // Group entries by lorebook
                /** @type {Map<string, typeof manifest>} */
                const byBook = new Map();
                for (const item of manifest) {
                    if (item.book.endsWith('_Skeleton')) continue;
                    if (!byBook.has(item.book)) byBook.set(item.book, []);
                    byBook.get(item.book).push(item);
                }

                // Ensure NPC book is always represented so the user can add NPCs
                if (prefix) {
                    const npcBookName = `${prefix}_NPCs`;
                    if (!byBook.has(npcBookName)) {
                        byBook.set(npcBookName, []);
                    }
                }

                // list.innerHTML = ''; // DO NOT CLEAR! This wipes the instantly-rendered PC card!

                if (!prefix) {
                    if (gen !== _manifestRenderGen) return;
                    const msg = document.createElement('div');
                    msg.style.cssText = 'text-align: center; opacity: 0.5; font-size: 0.769em; padding: 10px;';
                    msg.innerHTML = 'Set a Campaign Prefix to see records.';
                    list.appendChild(msg);
                    return;
                }

                for (const [bookName, items] of byBook) {
                    if (gen !== _manifestRenderGen) return;
                    // Strip campaign prefix from display name: "Eldoria_Factions" → "Factions"
                    const displayName = prefix && bookName.startsWith(prefix + '_')
                        ? bookName.slice(prefix.length + 1)
                        : bookName;

                    const activeCount = items.filter(i => i.is_active).length;
                    const totalTokens = items.reduce((sum, item) => sum + Math.round((item.content || '').length / 4), 0);
                    const isOpen = _manifestOpenFolders.has(bookName);

                    // ── Detect NPC books ──
                    const bookNameLowerFull = bookName.toLowerCase();
                    const displayNameLower = displayName.toLowerCase();
                    const isNpcBook = displayNameLower === 'npcs' || displayNameLower === 'npc' ||
                                      bookNameLowerFull.endsWith('_npcs') || bookNameLowerFull.endsWith('_npc');
                    const useNpcCardView = isNpcBook && s.npcPortraits !== false;

                    const folder = document.createElement('div');
                    folder.style.cssText = 'flex-shrink: 0; margin-bottom: 2px;';

                    const folderHdr = document.createElement('div');
                    folderHdr.style.cssText = 'display:flex; align-items:center; gap:6px; padding:5px 6px; cursor:pointer; border-radius:4px; background:rgba(255,255,255,0.04);';
                    if (useNpcCardView) folderHdr.classList.add('rt-npc-folder-hdr');
                    folderHdr.innerHTML = `
                            ${useNpcCardView ? '<span class="rt-npc-folder-icon">👤</span>' : ''}
                            <span class="rt-mf-icon" style="font-size:9px; opacity:0.5; width:10px; flex-shrink:0; font-family:monospace;">${isOpen ? '▼' : '▶'}</span>
                            <span style="font-weight:bold; font-size:11px; flex:1; color:var(--rt-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(displayName)}</span>
                            <span style="font-size:9px; opacity:0.45; color:var(--rt-text-muted); flex-shrink:0;">${activeCount}/${items.length} (${totalTokens}t)</span>
                            ${isNpcBook ? '<button class="rt-npc-settings-btn" title="NPC Settings" style="background:none;border:none;cursor:pointer;font-size:11px;opacity:0.5;padding:0;margin:0;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;color:var(--rt-text-muted);flex-shrink:0;line-height:1;" onclick="event.stopPropagation()">⚙️</button>' : ''}
                        `;

                    const folderBody = document.createElement('div');
                    folderBody.style.cssText = `display:${isOpen ? 'flex' : 'none'}; flex-direction:column; ${useNpcCardView ? 'padding:4px 0;' : 'border-left:1px solid rgba(255,255,255,0.07); margin-left:10px; padding-left:6px;'} gap:${useNpcCardView ? '4' : '1'}px; padding-top:3px; padding-bottom:3px;`;

                    folderHdr.addEventListener('click', () => {
                        const opening = folderBody.style.display === 'none';
                        folderBody.style.display = opening ? 'flex' : 'none';
                        folderHdr.querySelector('.rt-mf-icon').textContent = opening ? '▼' : '▶';
                        if (opening) _manifestOpenFolders.add(bookName);
                        else _manifestOpenFolders.delete(bookName);
                    });

                    // NPC settings gear button handler
                    if (isNpcBook) {
                        const settingsBtn = folderHdr.querySelector('.rt-npc-settings-btn');
                        if (settingsBtn) {
                            settingsBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const ctx = SillyTavern.getContext();
                                if (!ctx.callGenericPopup) return;
                                const curS = getSettings();

                                const popupHtml = `<div style="padding:16px;width:320px;text-align:left;font-family:var(--rt-font, system-ui, sans-serif);">
                                    <div style="font-size:16px;font-weight:bold;color:#d4a940;margin-bottom:16px;">⚙️ NPC Settings</div>

                                    <div style="margin-bottom:6px;display:flex;align-items:center;gap:10px;">
                                        <label style="font-size:12px;color:rgba(255,255,255,0.7);flex:1;">Show NPC Portraits</label>
                                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" id="rt-npc-portraits" ${curS.npcPortraits !== false ? 'checked' : ''}
                                                style="width:16px;height:16px;accent-color:#d4a940;cursor:pointer;">
                                            <span style="font-size:11px;color:rgba(255,255,255,0.5);">${curS.npcPortraits !== false ? 'Enabled' : 'Disabled'}</span>
                                        </label>
                                    </div>
                                    <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:14px;">When disabled, NPCs use the compact list view (like Events/Locations) and NPC portrait auto-generation is turned off.</div>

                                    <div style="margin-bottom:14px;">
                                        <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:4px;">Major NPC Section Word Target</label>
                                        <input type="number" id="rt-npc-major-words" value="${curS.npcMajorWords ?? 25}" min="1" max="1000" step="5"
                                            style="width:100%;background:rgba(0,0,0,0.4);color:white;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:6px 10px;font-size:13px;box-sizing:border-box;">
                                        <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px;">Recurring, plot-important NPCs. Default: 25 words per section</div>
                                    </div>

                                    <div style="margin-bottom:14px;">
                                        <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:4px;">Minor NPC Section Word Target</label>
                                        <input type="number" id="rt-npc-minor-words" value="${curS.npcMinorWords ?? 15}" min="1" max="1000" step="5"
                                            style="width:100%;background:rgba(0,0,0,0.4);color:white;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:6px 10px;font-size:13px;box-sizing:border-box;">
                                        <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px;">Shopkeepers, guards, one-off encounters. Default: 15 words per section</div>
                                    </div>

                                    <div style="margin-bottom:6px;display:flex;align-items:center;gap:10px;">
                                        <label style="font-size:12px;color:rgba(255,255,255,0.7);flex:1;">Relationship System (BETA)</label>
                                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" id="rt-npc-rel-bars" ${curS.npcRelationshipBars ? 'checked' : ''}
                                                style="width:16px;height:16px;accent-color:#d4a940;cursor:pointer;">
                                            <span style="font-size:11px;color:rgba(255,255,255,0.5);">${curS.npcRelationshipBars ? 'Enabled' : 'Disabled'}</span>
                                        </label>
                                    </div>
                                    <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:14px;">Shows Friendship/Affection tracking bars on NPC cards and popups. Also adds relationship fields to the AI instruction.</div>

                                     <div style="margin-bottom:6px;display:flex;align-items:center;gap:10px;">
                                         <label style="font-size:12px;color:rgba(255,255,255,0.7);flex:1;">Show Relationship Toast Notifications</label>
                                         <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                                             <input type="checkbox" id="rt-npc-rel-toast" ${curS.npcRelationshipToast !== false ? 'checked' : ''}
                                                 style="width:16px;height:16px;accent-color:#d4a940;cursor:pointer;">
                                             <span style="font-size:11px;color:rgba(255,255,255,0.5);">${curS.npcRelationshipToast !== false ? 'Enabled' : 'Disabled'}</span>
                                         </label>
                                     </div>
                                    <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:14px;">Emits a toast notification in the bottom-right corner when friendship or affection values change.</div>

                                    <div style="margin-bottom:14px;">
                                        <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:4px;">Relationship Max — this chat (± range)</label>
                                        <input type="number" id="rt-npc-rel-max" value="${getNpcRelationshipMax(curS)}" min="10" max="10000" step="10"
                                            style="width:100%;background:rgba(0,0,0,0.4);color:white;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:6px 10px;font-size:13px;box-sizing:border-box;">
                                        <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px;">Per-story scale for this chat only. Friendship/Affection range −N to +N. New chats start from the default in Extension Settings (currently ${getNpcRelationshipMaxDefault(curS)}).</div>
                                    </div>

                                    <div style="margin-bottom:6px;display:flex;align-items:center;gap:10px;">
                                        <label style="font-size:12px;color:rgba(255,255,255,0.7);flex:1;">Ignore Character Limits When Importing Character Cards</label>
                                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" id="rt-ignore-npc-limits" ${curS.ignoreNpcImportLimits ? 'checked' : ''}
                                                style="width:16px;height:16px;accent-color:#d4a940;cursor:pointer;">
                                            <span style="font-size:11px;color:rgba(255,255,255,0.5);">${curS.ignoreNpcImportLimits ? 'Enabled' : 'Disabled'}</span>
                                        </label>
                                    </div>
                                    <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:10px;">Omits the &lt;CORE LENGTH TARGETS&gt; section from the NPC prompt.</div>
                                </div>`;

                                let newRel = curS.npcRelationshipBars ?? false;
                                let newIgnoreLimits = curS.ignoreNpcImportLimits ?? false;
                                let newRelToast = curS.npcRelationshipToast !== false;
                                let newNpcPortraits = curS.npcPortraits !== false;
                                // Track word count values via closure — updated by input events,
                                // read at save time. Initialized to current saved values so
                                // leaving them unchanged correctly preserves the user's setting.
                                let newMajor = curS.npcMajorWords ?? 25;
                                let newMinor = curS.npcMinorWords ?? 15;
                                let newRelMax = getNpcRelationshipMax(curS);

                                setTimeout(() => {
                                    const majorEl = document.getElementById('rt-npc-major-words');
                                    const minorEl = document.getElementById('rt-npc-minor-words');
                                    const relMaxEl = document.getElementById('rt-npc-rel-max');
                                    const relEl = document.getElementById('rt-npc-rel-bars');
                                    const ignoreEl = document.getElementById('rt-ignore-npc-limits');

                                    if (majorEl) {
                                        majorEl.addEventListener('input', () => {
                                            const parsed = parseInt(majorEl.value, 10);
                                            // Only update if it's a real number — don't clobber on
                                            // partial input (e.g. empty field while user is typing)
                                            if (!isNaN(parsed) && parsed > 0) newMajor = parsed;
                                        });
                                    }
                                    if (minorEl) {
                                        minorEl.addEventListener('input', () => {
                                            const parsed = parseInt(minorEl.value, 10);
                                            if (!isNaN(parsed) && parsed > 0) newMinor = parsed;
                                        });
                                    }
                                    if (relMaxEl) {
                                        relMaxEl.addEventListener('input', () => {
                                            const parsed = parseInt(relMaxEl.value, 10);
                                            if (!isNaN(parsed) && parsed >= 10) newRelMax = parsed;
                                        });
                                    }
                                    if (relEl) {
                                        relEl.addEventListener('change', () => {
                                            newRel = relEl.checked;
                                            if (relEl.nextElementSibling) relEl.nextElementSibling.textContent = newRel ? 'Enabled' : 'Disabled';
                                        });
                                    }
                                    if (ignoreEl) {
                                        ignoreEl.addEventListener('change', () => {
                                            newIgnoreLimits = ignoreEl.checked;
                                            if (ignoreEl.nextElementSibling) ignoreEl.nextElementSibling.textContent = newIgnoreLimits ? 'Enabled' : 'Disabled';
                                        });
                                    }
                                    const relToastEl = document.getElementById('rt-npc-rel-toast');
                                    if (relToastEl) {
                                        relToastEl.addEventListener('change', () => {
                                            newRelToast = relToastEl.checked;
                                            if (relToastEl.nextElementSibling) relToastEl.nextElementSibling.textContent = newRelToast ? 'Enabled' : 'Disabled';
                                        });
                                    }
                                    const portraitsEl = document.getElementById('rt-npc-portraits');
                                    if (portraitsEl) {
                                        portraitsEl.addEventListener('change', () => {
                                            newNpcPortraits = portraitsEl.checked;
                                            if (portraitsEl.nextElementSibling) portraitsEl.nextElementSibling.textContent = newNpcPortraits ? 'Enabled' : 'Disabled';
                                        });
                                    }
                                }, 0);

                                const result = await ctx.callGenericPopup(popupHtml, ctx.POPUP_TYPE?.CONFIRM ?? 3, '', {
                                    okButton: 'Save', cancelButton: 'Cancel', wide: false,
                                });

                                if (result) {
                                    const finalMajor = Math.max(1, Math.min(1000, newMajor));
                                    const finalMinor = Math.max(1, Math.min(1000, newMinor));
                                    const finalRelMax = getNpcRelationshipMax({ npcRelationshipMax: newRelMax });

                                    const updS = getSettings();
                                    updS.ignoreNpcImportLimits = newIgnoreLimits;
                                    updS.npcMajorWords = finalMajor;
                                    updS.npcMinorWords = finalMinor;
                                    setNpcRelationshipMaxForCurrentChat(finalRelMax);
                                    updS.npcRelationshipBars = newRel;
                                    updS.npcRelationshipToast = newRelToast;
                                    applyNpcPortraitSetting(updS, newNpcPortraits);
                                    $('#rpg_tracker_npc_rel_toast').prop('checked', newRelToast);

                                    // Update the main settings panel inputs if present
                                    $('#rpg_tracker_npc_major_words').val(finalMajor);
                                    $('#rpg_tracker_npc_minor_words').val(finalMinor);
                                    $('#rpg_tracker_npc_rel_bars').prop('checked', newRel);
                                    $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', newRel);
                                    const onbRel = document.getElementById('rt_onboarding_mod_npc_rel_bars');
                                    if (onbRel) onbRel.checked = newRel;
                                    $('#rpg_tracker_ignore_npc_limits').prop('checked', newIgnoreLimits);

                                    // Rebuild the NPC instruction from settings
                                    if (updS.routerModules?.npc) {
                                        updS.routerModules.npc.instruction = buildNpcInstruction(finalMajor, finalMinor, false); // ignoreLimits only applies at import-time, not stored globally
                                    }

                                    saveSettings();
                                    toastr['success']('NPC settings saved.', 'NPC Settings');
                                    if (typeof globalThis._rpgRenderAgentModules === 'function') {
                                        globalThis._rpgRenderAgentModules();
                                    }
                                    await refreshManifest();
                                }
                            });
                        }
                    }

                    // ════════════════════════════════════════════════════════════
                    //  NPC HELPERS (shared by card grid + compact list)
                    // ════════════════════════════════════════════════════════════
                    /** @type {((item: any, rel: any) => Promise<void>)|null} */
                    let openNpcDetailPopup = null;
                    /** @type {((entryId: string) => { friendship: number, affection: number })|null} */
                    let parseRelationship = null;
                    /** @type {((entryId: string) => string)|null} */
                    let renderCompactRelStats = null;
                    /** @type {((value: number, type: string, entryId: string) => string)|null} */
                    let renderRelBar = null;
                    /** @type {((content: string) => string)|null} */
                    let getNpcDescription = null;

                    if (isNpcBook) {

                        // Helper: parse relationship values — read from code-owned settings, not entry text
                        parseRelationship = (entryId) => {
                            const s = getSettings();
                            const rel = (s.npcRelationshipValues || {})[entryId];
                            return {
                                friendship: rel?.friendship ?? 0,
                                affection:  rel?.affection  ?? 0,
                            };
                        };

                        // Helper: render a dual-direction bar (always renders, even at 0)
                        renderRelBar = (value, type, entryId) => {
                            const relMax = getNpcRelationshipMax();
                            const clamped = clampRelationshipValue(value, relMax);
                            const pct = relationshipBarPct(clamped, relMax);
                            const icon = type === 'friendship' ? '🤝' : '💗';
                            const isPositive = clamped >= 0;
                            const fillClass = isPositive
                                ? `${type}-pos positive`
                                : `${type}-neg negative`;
                            const valClass = type === 'friendship'
                                ? (clamped > 0 ? 'val-positive' : clamped < 0 ? 'val-negative' : 'val-zero')
                                : (clamped > 0 ? 'val-affection-positive' : clamped < 0 ? 'val-affection-negative' : 'val-zero');
                            // Last-delta badge from log
                            const curS = getSettings();
                            const log = (curS.npcRelationshipLog?.[entryId] || []).find(e => e.field === type);
                            // (User requested hiding the visual badge, so we keep this blank)
                            const badgeHtml = ''; 
                            /* log
                                ? (() => {
                                    const badgeColor = log.source === 'manual' ? 'rgba(180,180,180,0.7)' : (log.delta > 0 ? '#4ade80' : '#ef4444');
                                    const sign = log.delta > 0 ? '+' : '';
                                    const label = log.source === 'manual' ? '✋' : '🤖';
                                    return `<span style="font-size:9px;font-weight:bold;color:${badgeColor};margin-left:4px;opacity:0.85;" title="${label} last change: ${sign}${log.delta}">${sign}${log.delta}</span>`;
                                  })()
                                : ''; */
                            return `<div class="rt-npc-bar-row">
                                <span class="rt-npc-bar-icon">${icon}</span>
                                <div class="rt-npc-bar-track">
                                    <div class="rt-npc-bar-center-marker"></div>
                                    <div class="rt-npc-bar-fill ${fillClass}" style="width:${pct}%;"></div>
                                </div>
                                <span class="rt-npc-bar-value ${valClass}">${clamped > 0 ? '+' : ''}${clamped}${badgeHtml}</span>
                            </div>`;
                        };

                        /** Compact friendship/affection labels for the tree list view. */
                        renderCompactRelStats = (entryId) => {
                            if (!getSettings().npcRelationshipBars) return '';
                            const rel = parseRelationship(entryId);
                            const fmtVal = (val, type) => {
                                const relMax = getNpcRelationshipMax();
                                const clamped = clampRelationshipValue(val, relMax);
                                const icon = type === 'friendship' ? '🤝' : '💗';
                                let color = 'rgba(255,255,255,0.45)';
                                if (type === 'friendship') {
                                    color = clamped > 0 ? '#4ade80' : clamped < 0 ? '#ef4444' : 'rgba(255,255,255,0.45)';
                                } else {
                                    color = clamped > 0 ? '#f472b6' : clamped < 0 ? '#a855f7' : 'rgba(255,255,255,0.45)';
                                }
                                const label = type === 'friendship' ? 'Friendship' : 'Affection';
                                return `<span class="rt-agent-entry-rel-${type}" style="font-size:9px;font-family:monospace;color:${color};" title="${label}">${icon}${clamped > 0 ? '+' : ''}${clamped}</span>`;
                            };
                            return `<span class="rt-agent-entry-rel-stats" data-entry-id="${escapeHtml(entryId)}" style="display:inline-flex;align-items:center;gap:5px;margin-left:6px;flex-shrink:0;">${fmtVal(rel.friendship, 'friendship')}${fmtVal(rel.affection, 'affection')}</span>`;
                        };

                        // Helper: get brief synopsis for the card (pulls from Appearance section or first text)
                        getNpcDescription = (content) => {
                            if (!content) return '';
                            // Strip [CORE] and [/CORE] tags before parsing
                            const cleanContent = content.replace(/\[\/?CORE\]/gi, '');
                            // Try to extract Appearance section content first
                            const appMatch = cleanContent.match(/(?:Appearance\/Species|Appearance):\s*(.+?)(?=\s*(?:Personality|Brief Background|Habits|Behaviors|Relationship with|Friendship\/Rapport|Affection\/Interest):|$)/is);
                            if (appMatch && appMatch[1].trim()) {
                                return appMatch[1].trim().substring(0, 260);
                            }
                            // Fallback: first meaningful text
                            const lines = cleanContent.split('\n').map(l => l.trim())
                                .filter(l => l && !/^\[ID:/i.test(l) && !/^Friendship\/Rapport:/i.test(l) && !/^Affection\/Interest:/i.test(l));
                            return lines.slice(0, 2).join(' ').substring(0, 260);
                        };

                        // Helper: Open the full NPC popup
                        openNpcDetailPopup = async (item, rel) => {
                            const ctx = SillyTavern.getContext();
                            if (!ctx.callGenericPopup) return;

                            // Friendship/Affection bars for popup (large version, with editable sliders)
                            const makeBigBar = (val, label, colorPos, colorNeg, icon, type) => {
                                const relMax = getNpcRelationshipMax(s);
                                const clamped = clampRelationshipValue(val, relMax);
                                const pct = relationshipBarPct(clamped, relMax);
                                const isPos = clamped >= 0;
                                const bgColor = isPos ? colorPos : colorNeg;
                                const valColor = clamped === 0 ? 'var(--SmartThemeEmColor, inherit)' : bgColor;
                                return `<div style="margin-bottom:14px;">
                                    <div style="display:grid;grid-template-columns:auto 80px 1fr 40px;align-items:center;column-gap:12px;row-gap:6px;">
                                        <span style="font-size:20px;">${icon}</span>
                                        <span style="font-size:13px;color:var(--SmartThemeBodyColor, inherit);opacity:0.65;font-weight:500;">${label}</span>
                                        <div style="height:12px;background:var(--SmartThemeBorderColor, rgba(128,128,128,0.15));border-radius:6px;position:relative;overflow:hidden;">
                                            <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--SmartThemeBorderColor, rgba(128,128,128,0.25));"></div>
                                            <div id="rt-npc-detail-${type}-fill" style="position:absolute;top:0;bottom:0;border-radius:6px;background:${bgColor};${isPos ? `left:50%;width:${pct}%;` : `right:50%;width:${pct}%;`}transition:width 0.3s ease;"></div>
                                        </div>
                                        <span id="rt-npc-detail-${type}-text" style="font-size:15px;font-weight:bold;text-align:right;color:${valColor};font-family:monospace;">${clamped > 0 ? '+' : ''}${clamped}</span>
                                        <div></div>
                                        <div></div>
                                        <input type="range" id="rt-npc-detail-${type}-slider" min="-${relMax}" max="${relMax}" value="${clamped}" step="1"
                                            style="width:100%;margin:0;accent-color:${bgColor};height:4px;cursor:pointer;outline:none;">
                                        <div></div>
                                    </div>
                                    <div id="rt-npc-detail-${type}-tier">${renderRelTierDetailed(type, clamped, relMax)}</div>
                                </div>`;
                            };

                            const barsHtml = `
                                ${makeBigBar(rel.friendship, 'Friendship', '#4ade80', '#ef4444', '🤝', 'friendship')}
                                ${makeBigBar(rel.affection, 'Affection', '#f472b6', '#a855f7', '💗', 'affection')}
                            `;

                            const normLabel = item.label.replace(/\s*\(.*?\)/g, '').trim();
                            const portraitSrc = s.customPortraits?.[normLabel] || '';
                            const hidePortrait = s.npcPortraits === false;

                            // Full-size portrait (512px stored, display at native res)
                            const portraitEl = portraitSrc
                                ? `<img src="${escapeHtml(portraitSrc)}" style="width:100%;height:auto;aspect-ratio:1;object-fit:cover;border-radius:12px;border:2px solid rgba(212,169,64,0.3);box-shadow:0 4px 20px rgba(0,0,0,0.4);" alt="${escapeHtml(item.label)}">`
                                : `<div style="width:100%;aspect-ratio:1;border-radius:12px;background:var(--SmartThemeBorderColor, rgba(128,128,128,0.1));border:2px solid rgba(212,169,64,0.2);display:flex;align-items:center;justify-content:center;font-size:64px;opacity:0.25;color:var(--SmartThemeBodyColor, inherit);">👤</div>`;

                            // Build popup DOM
                            const popupDom = document.createElement('div');
                            popupDom.style.cssText = 'width:100%;box-sizing:border-box;padding:24px;text-align:left;font-family:var(--rt-font, system-ui, sans-serif);color:var(--SmartThemeBodyColor, inherit);max-height:85vh;overflow-y:auto;';

                            // Pre-build section HTML (avoids nested template literals confusing IDE)
                            const sectionsInitialHtml = renderSectionsHtml(item.content)
                                || '<div style="font-size:14px;color:var(--SmartThemeBodyColor, inherit);opacity:0.5;font-style:italic;padding:16px 0;">No structured sections found. Click Edit Text to add content.</div>';

                            const barsBlockHtml = s.npcRelationshipBars
                                ? '<div style="margin-top:20px;">' + barsHtml + '</div>'
                                : '';

                            const activeStyle = item.is_active
                                ? 'background:rgba(0,255,170,0.12);color:#00ffaa;border:1px solid rgba(0,255,170,0.25);'
                                : 'background:var(--SmartThemeBorderColor, rgba(128,128,128,0.1));color:var(--SmartThemeBodyColor, inherit);opacity:0.65;border:1px solid var(--SmartThemeBorderColor, rgba(128,128,128,0.2));';
                            const activeLabel = item.is_active ? '● Active' : '○ Inactive';

                            // Build relationship history log rows (plain string concatenation)
                            let relLogHtml = '';
                            if (s.npcRelationshipBars) {
                                const logEntries = (s.npcRelationshipLog && s.npcRelationshipLog[item.id] || []).slice(0, 20);
                                let rows = '';
                                for (const e of logEntries) {
                                    const date = new Date(e.timestamp);
                                    const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
                                        + ', ' + date.toLocaleDateString([], {month: 'short', day: 'numeric'});
                                    const sign = e.delta > 0 ? '+' : '';
                                    const deltaColor = e.delta > 0 ? '#4ade80' : '#ef4444';
                                    const srcIcon = e.source === 'manual' ? '✋' : '🤖';
                                    const fieldLabel = e.field === 'friendship' ? '🤝' : '💗';
                                    rows += '<tr>'
                                        + '<td style="font-size:10px;color:var(--SmartThemeBodyColor,inherit);opacity:0.5;padding:3px 8px 3px 0;white-space:nowrap;">' + timeStr + '</td>'
                                        + '<td style="font-size:12px;padding:3px 8px;">' + fieldLabel + '</td>'
                                        + '<td style="font-size:13px;font-weight:bold;color:' + deltaColor + ';font-family:monospace;padding:3px 8px;">' + sign + e.delta + '</td>'
                                        + '<td style="font-size:11px;color:var(--SmartThemeBodyColor,inherit);opacity:0.45;padding:3px 0;">' + srcIcon + ' \u2192 ' + (e.newValue >= 0 ? '+' : '') + e.newValue + '</td>'
                                        + '</tr>';
                                }
                                relLogHtml = '<div class="rt-npc-log-container" style="border-top:2px solid rgba(212,169,64,0.15);padding-top:18px;margin-top:18px;' + (logEntries.length === 0 ? 'display:none;' : '') + '">'
                                    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">'
                                    + '<span style="font-size:11px;font-weight:bold;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;">📊 Relationship History</span>'
                                    + '<button class="rt-npc-log-clear-btn" style="background:transparent;border:none;color:#ff5555;cursor:pointer;font-size:10px;opacity:0.6;padding:0;" title="Clear relationship history">🗑️ Clear Log</button>'
                                    + '</div>'
                                    + '<table class="rt-npc-log-table" style="width:100%;border-collapse:collapse;">' + rows + '</table>'
                                    + '</div>';
                            }

                            popupDom.innerHTML = `
                                <div style="display:flex;gap:24px;margin-bottom:20px;align-items:flex-start;flex-wrap:wrap;">
                                    ${hidePortrait ? '' : `<div style="flex-shrink:0;width:280px;">${portraitEl}</div>`}
                                    <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px;">
                                        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                                            <div style="font-size:24px;font-weight:bold;color:#d4a940;line-height:1.2;">${escapeHtml(item.label)}</div>
                                            <button class="rt-npc-popup-edit-btn menu_button" style="flex-shrink:0;font-size:12px;padding:4px 12px;white-space:nowrap;">✏️ Edit Text</button>
                                        </div>
                                        <span style="font-size:11px;padding:3px 10px;border-radius:10px;font-weight:bold;align-self:flex-start;${activeStyle}">${activeLabel}</span>
                                        ${barsBlockHtml}
                                    </div>
                                </div>
                                <div style="border-top:2px solid rgba(212,169,64,0.15);padding-top:18px;">
                                    <!-- VIEW PANE -->
                                    <div class="rt-npc-popup-view">
                                        <div class="rt-npc-popup-sections">${sectionsInitialHtml}</div>
                                    </div>
                                    <!-- EDIT PANE -->
                                    <div class="rt-npc-popup-edit" style="display:none;flex-direction:column;gap:10px;">
                                        <div style="font-size:11px;font-weight:bold;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">✏️ Editing Raw Entry Content</div>
                                        <textarea class="rt-npc-popup-textarea" spellcheck="false" style="width:100%;min-height:420px;box-sizing:border-box;background:var(--SmartThemeBlurTintColor, rgba(0,0,0,0.3));color:var(--SmartThemeBodyColor, inherit);border:1px solid rgba(212,169,64,0.35);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;line-height:1.6;resize:vertical;"></textarea>
                                        <div style="display:flex;gap:8px;justify-content:flex-end;">
                                            <button class="rt-npc-popup-cancel-btn menu_button" style="font-size:12px;padding:5px 14px;">Cancel</button>
                                            <button class="rt-npc-popup-save-btn menu_button" style="font-size:12px;padding:5px 18px;background:rgba(212,169,64,0.2);border-color:rgba(212,169,64,0.5);color:#d4a940;font-weight:bold;">💾 Save</button>
                                        </div>
                                    </div>
                                </div>
                                ${relLogHtml}
                            `;



                            // Wire up in-popup edit/save/cancel
                            const viewPane = popupDom.querySelector('.rt-npc-popup-view');
                            const editPane = popupDom.querySelector('.rt-npc-popup-edit');
                            const sectionsDiv = popupDom.querySelector('.rt-npc-popup-sections');
                            const textarea = /** @type {HTMLTextAreaElement} */ (popupDom.querySelector('.rt-npc-popup-textarea'));
                            const editBtn = popupDom.querySelector('.rt-npc-popup-edit-btn');
                            const cancelBtn = popupDom.querySelector('.rt-npc-popup-cancel-btn');
                            const saveBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-save-btn'));

                            editBtn.addEventListener('click', () => {
                                textarea.value = item.content || '';
                                viewPane.style.display = 'none';
                                editPane.style.display = 'flex';
                                textarea.focus();
                            });

                            cancelBtn.addEventListener('click', () => {
                                editPane.style.display = 'none';
                                viewPane.style.display = 'block';
                            });

                            const clearLogBtn = popupDom.querySelector('.rt-npc-log-clear-btn');
                            if (clearLogBtn) {
                                clearLogBtn.addEventListener('click', () => {
                                    if (confirm('Clear relationship history log for this NPC? (This cannot be undone)')) {
                                        const cleanS = getSettings();
                                        if (cleanS.npcRelationshipLog) {
                                            delete cleanS.npcRelationshipLog[item.id];
                                            saveSettings();
                                        }
                                        const logContainer = popupDom.querySelector('.rt-npc-log-container');
                                        if (logContainer) logContainer.style.display = 'none';
                                        
                                        // Also clear the badges in the background card UI!
                                        const cardEl = document.querySelector(`.rt-npc-card[data-entry-id="${item.id}"]`);
                                        if (cardEl) {
                                            cardEl.querySelectorAll('.rt-npc-bar-value span').forEach(badge => badge.remove());
                                        }
                                    }
                                });
                            }

                            const bindSlider = (type) => {
                                const slider = popupDom.querySelector(`#rt-npc-detail-${type}-slider`);
                                const fill = popupDom.querySelector(`#rt-npc-detail-${type}-fill`);
                                const text = popupDom.querySelector(`#rt-npc-detail-${type}-text`);
                                const tierEl = popupDom.querySelector(`#rt-npc-detail-${type}-tier`);
                                if (!slider || !fill || !text) return;
                                
                                let originalValue = parseInt(slider.value, 10) || 0;
                                
                                slider.addEventListener('input', () => {
                                    const val = parseInt(slider.value, 10) || 0;
                                    const relMax = getNpcRelationshipMax(s);
                                    const pct = relationshipBarPct(val, relMax);
                                    const isPos = val >= 0;
                                    fill.style.width = pct + '%';
                                    fill.style.left = isPos ? '50%' : 'auto';
                                    fill.style.right = isPos ? 'auto' : '50%';
                                    
                                    const colorPos = type === 'friendship' ? '#4ade80' : '#f472b6';
                                    const colorNeg = type === 'friendship' ? '#ef4444' : '#a855f7';
                                    const bgColor = isPos ? colorPos : colorNeg;
                                    fill.style.background = bgColor;
                                    
                                    text.textContent = (val > 0 ? '+' : '') + val;
                                    text.style.color = val === 0 ? 'var(--SmartThemeEmColor, inherit)' : bgColor;

                                    if (tierEl) tierEl.innerHTML = renderRelTierDetailed(type, val, relMax);
                                });
                                
                                slider.addEventListener('change', () => {
                                    const val = clampRelationshipValue(parseInt(slider.value, 10) || 0, getNpcRelationshipMax(s));
                                    if (val === originalValue) return;
                                    
                                    // Update the setting
                                    if (!s.npcRelationshipValues) s.npcRelationshipValues = {};
                                    if (!s.npcRelationshipValues[item.id]) s.npcRelationshipValues[item.id] = { friendship: 0, affection: 0 };
                                    s.npcRelationshipValues[item.id][type] = val;
                                    saveSettings();
                                    
                                    originalValue = val;
                                    
                                    // Dynamically re-render the NPC card in the background UI
                                    const cardEl = document.querySelector(`.rt-npc-card[data-entry-id="${item.id}"]`);
                                    if (cardEl) {
                                        const bgIsPos = val >= 0;
                                        const bgBarColor = bgIsPos 
                                            ? (type === 'friendship' ? '#4ade80' : '#f472b6')
                                            : (type === 'friendship' ? '#ef4444' : '#a855f7');
                                        
                                        const barFill = cardEl.querySelector(`.rt-npc-bar-fill.${type}-pos, .rt-npc-bar-fill.${type}-neg`);
                                        if (barFill) {
                                            barFill.style.width = relationshipBarPct(val, getNpcRelationshipMax(s)) + '%';
                                            barFill.style.left = bgIsPos ? '50%' : 'auto';
                                            barFill.style.right = bgIsPos ? 'auto' : '50%';
                                            barFill.style.background = bgBarColor;
                                            barFill.className = `rt-npc-bar-fill ${type}-${bgIsPos ? 'pos positive' : 'neg negative'}`;

                                            const rowEl = barFill.closest('.rt-npc-bar-row');
                                            if (rowEl) {
                                                const valText = rowEl.querySelector('.rt-npc-bar-value');
                                                if (valText) {
                                                    if (valText.firstChild && valText.firstChild.nodeType === Node.TEXT_NODE) {
                                                        valText.firstChild.nodeValue = `${val > 0 ? '+' : ''}${val}`;
                                                    } else {
                                                        valText.innerHTML = `${val > 0 ? '+' : ''}${val}`;
                                                    }
                                                    
                                                    const valClass = type === 'friendship'
                                                        ? (val > 0 ? 'val-positive' : val < 0 ? 'val-negative' : 'val-zero')
                                                        : (val > 0 ? 'val-affection-positive' : val < 0 ? 'val-affection-negative' : 'val-zero');
                                                    valText.className = `rt-npc-bar-value ${valClass}`;
                                                }
                                            }
                                        }

                                        const tierBadge = cardEl.querySelector(`.rt-npc-tier-badge.${type}`);
                                        if (tierBadge) applyRelTierBadgeElement(tierBadge, type, val, getNpcRelationshipMax(s));
                                    }
                                });
                            };

                            if (s.npcRelationshipBars) {
                                bindSlider('friendship');
                                bindSlider('affection');
                            }

                            saveBtn.addEventListener('click', async () => {
                                if (isRouterRunning()) {
                                    // @ts-ignore
                                    toastr.warning('Agent is running — wait for it to finish before saving.', 'Lorebook Agent');
                                    return;
                                }
                                saveBtn.disabled = true;
                                saveBtn.textContent = '…';
                                const ok = await updateLorebookEntry(item.id, {
                                    content: textarea.value,
                                    key: item.keys,
                                    comment: item.label,
                                });
                                if (ok) {
                                    item.content = textarea.value;
                                    _dirtyEntries.delete(item.id);
                                    document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));
                                    await refreshManifest();
                                    // @ts-ignore
                                    toastr.success('Entry saved.', 'Lorebook Agent');
                                    const newHtml = renderSectionsHtml(item.content);
                                    sectionsDiv.innerHTML = newHtml || `<div style="font-size:14px;color:var(--SmartThemeBodyColor, inherit);opacity:0.5;font-style:italic;padding:16px 0;">No structured sections found. Click Edit Text to add content.</div>`;
                                    editPane.style.display = 'none';
                                    viewPane.style.display = 'block';
                                } else {
                                    // @ts-ignore
                                    toastr.error('Save failed.', 'Lorebook Agent');
                                }
                                saveBtn.disabled = false;
                                saveBtn.textContent = '💾 Save';
                            });

                            // Show popup with DOM element (upstream approach)

                            const popupOpts = { okButton: 'Close', cancelButton: false, wide: true, large: true };
                            await ctx.callGenericPopup(popupDom, ctx.POPUP_TYPE?.TEXT ?? 1, '', popupOpts);
                        };

                    }

                    // ════════════════════════════════════════════════════════════
                    //  NPC CARD GRID RENDERING
                    // ════════════════════════════════════════════════════════════
                    if (useNpcCardView) {

                        const npcGrid = document.createElement('div');
                        npcGrid.className = 'rt-npc-card-grid';

                        for (const item of items) {
                            const rel = parseRelationship ? parseRelationship(item.id) : { friendship: 0, affection: 0 };
                            const desc = getNpcDescription ? getNpcDescription(item.content) : '';
                            const normLabel = item.label.replace(/\s*\(.*?\)/g, '').trim();
                            const portraitSrc = s.customPortraits?.[normLabel] || '';
                            const isDirty = _dirtyEntries.has(item.id);

                            const card = document.createElement('div');
                            card.className = 'rt-npc-card';
                            card.dataset.entryId = item.id;

                            // Portrait area
                            const portraitHtml = portraitSrc
                                ? `<img src="${escapeHtml(portraitSrc)}" alt="${escapeHtml(item.label)}">`
                                : `<div class="rt-npc-portrait-placeholder">👤</div>`;

                            card.innerHTML = `
                                <div class="rt-npc-portrait-wrap">
                                    ${portraitHtml}
                                    <div class="rt-npc-portrait-gen-overlay" title="${portraitSrc ? 'Manage portrait' : 'Generate portrait'}">${portraitSrc ? '⚙️' : '🎨'}</div>
                                </div>
                                <div class="rt-npc-info">
                                    <div class="rt-npc-name">${escapeHtml(item.label)}${isDirty ? ' <span style="color:#ffa500; font-size:8px;" title="Unsaved edits">●</span>' : ''}</div>
                                    <div class="rt-npc-desc">${escapeHtml(desc)}</div>
                                    <span class="rt-npc-status-badge ${item.is_active ? 'active' : 'inactive'}">${item.is_active ? '● Active' : '○ Inactive'}</span>
                                    ${s.npcRelationshipBars && renderRelBar ? `<div class="rt-npc-bars">
                                        ${renderRelBar(rel.friendship, 'friendship', item.id)}
                                        ${renderRelBar(rel.affection, 'affection', item.id)}
                                    </div>${renderRelTierRow(rel.friendship, rel.affection, getNpcRelationshipMax(s))}` : ''}
                                    <div class="rt-npc-actions">
                                        <button class="rt-npc-action-btn rt-npc-view" data-id="${item.id}" title="View NPC card"><i class="fa-solid fa-address-card"></i> Full NPC Card</button>
                                        <button class="rt-npc-action-btn rt-npc-edit" data-id="${item.id}" title="Edit entry"><i class="fa-solid fa-pen-to-square"></i></button>
                                        <button class="rt-npc-action-btn rt-npc-clean" data-id="${item.id}" title="Cleanup entry"><i class="fa-solid fa-broom"></i></button>
                                        <button class="rt-npc-action-btn rt-npc-delete" data-id="${item.id}" title="Delete entry"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            `;

                            // Entry body (edit pane) — built lazily on first expand to keep manifest snappy
                            let entryBody = null;
                            const dirtySnap = isDirty ? _dirtyEntries.get(item.id) : null;
                            const ensureEntryBody = () => {
                                if (entryBody) return entryBody;
                                const fakeHdr = document.createElement('div');
                                entryBody = buildEntryBody(item, fakeHdr, {
                                    stale: !!isDirty,
                                    dirty: dirtySnap || null,
                                    isNpcEntry: true,
                                });
                                entryBody.classList.add('rt-npc-card-entry');
                                entryBody.style.display = 'none';
                                entryBody.style.marginTop = '6px';
                                entryBody.style.borderTop = '1px solid rgba(212, 169, 64, 0.1)';
                                entryBody.style.paddingTop = '6px';
                                card.appendChild(entryBody);
                                return entryBody;
                            };

                            if (_openEntries.has(item.id)) {
                                ensureEntryBody().style.display = 'flex';
                                card.classList.add('open');
                            }

                            // Click card body → toggle inline view
                            card.addEventListener('click', (e) => {
                                if (/** @type {HTMLElement} */ (e.target).closest('.rt-npc-portrait-wrap, .rt-npc-portrait-gen-overlay, .rt-npc-action-btn, .rt-npc-view, .rt-npc-edit, .rt-npc-clean, .rt-npc-delete, textarea, input, button, select')) return;
                                const body = ensureEntryBody();
                                const opening = body.style.display === 'none';
                                body.style.display = opening ? 'flex' : 'none';
                                if (opening) {
                                    _openEntries.add(item.id);
                                    card.classList.add('open');
                                } else {
                                    _openEntries.delete(item.id);
                                    card.classList.remove('open');
                                }
                            });


                            // Portrait click/generate overlay handlers
                            const portraitWrap = card.querySelector('.rt-npc-portrait-wrap');
                            if (portraitWrap) {
                                portraitWrap.addEventListener('click', async (e) => {
                                    e.stopPropagation();
                                    const refreshBoth = () => {
                                        if (typeof refreshManifest === 'function') refreshManifest();
                                        if (typeof refreshRenderedView === 'function') refreshRenderedView();
                                    };
                                    await showPortraitSettingsMenu(item.label, refreshBoth, item.content || '');
                                });
                            }

                            // Action button handlers
                            const viewBtn = card.querySelector('.rt-npc-view');
                            if (viewBtn) viewBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                openNpcDetailPopup(item, parseRelationship(item.id));
                            });

                            const editBtn = card.querySelector('.rt-npc-edit');
                            if (editBtn) editBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const body = ensureEntryBody();
                                // Always open the entry body
                                body.style.display = 'flex';
                                _openEntries.add(item.id);
                                card.classList.add('open');
                                // Trigger the internal edit mode (switch from readPane to editPane)
                                const internalEditBtn = body.querySelector('.rt-agent-entry-edit');
                                if (internalEditBtn) {
                                    internalEditBtn.click();
                                } else {
                                    // Fallback: directly toggle panes if no internal button
                                    const readPane = body.querySelector('.rt-agent-manifest-read');
                                    const editPane = body.querySelector('.rt-agent-manifest-edit');
                                    if (readPane) readPane.style.display = 'none';
                                    if (editPane) editPane.style.display = 'flex';
                                }
                            });

                            const cleanBtn = card.querySelector('.rt-npc-clean');
                            if (cleanBtn) cleanBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                if (isRouterRunning()) { toastr['warning']('Agent is busy.'); return; }
                                const [bk, uid] = item.id.split('::');
                                await runRouterPass(null, `__CLEANUP__::${bk}::${uid}`, null, true);
                                await refreshManifest();
                            });

                            const delBtn = card.querySelector('.rt-npc-delete');
                            if (delBtn) delBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                if (confirm(`Delete NPC "${item.label}"?`)) {
                                    const ok = await deleteLorebookEntry(item.id);
                                    if (ok) {
                                        _dirtyEntries.delete(item.id);
                                        _openEntries.delete(item.id);
                                        // Clean up code-owned relationship values for this NPC
                                        const delSettings = getSettings();
                                        if (delSettings.npcRelationshipValues) {
                                            delete delSettings.npcRelationshipValues[item.id];
                                        }
                                        await refreshManifest();
                                        toastr['success'](`Deleted "${item.label}"`, 'NPCs');
                                    }
                                }
                            });

                            // Portrait drag-and-drop
                            if (portraitWrap) {
                                portraitWrap.addEventListener('dragover', (e) => { e.preventDefault(); portraitWrap.style.borderColor = '#d4a940'; });
                                portraitWrap.addEventListener('dragleave', () => { portraitWrap.style.borderColor = ''; });
                                portraitWrap.addEventListener('drop', async (e) => {
                                    e.preventDefault();
                                    portraitWrap.style.borderColor = '';
                                    const file = e.dataTransfer?.files?.[0];
                                    if (!file || !file.type.startsWith('image/')) return;
                                    try {
                                        const dataUrl = await fileToDataUrl(file);
                                        const scaled = await scaleImageTo512Square(dataUrl);
                                        applyPortraitData(item.label, scaled);
                                        toastr['success'](`Portrait applied for ${item.label}`, 'NPC Portrait');
                                        await refreshManifest();
                                        refreshRenderedView();
                                    } catch (err) {
                                        toastr['error']('Failed to apply portrait.', 'NPC Portrait');
                                    }
                                });
                            }

                            npcGrid.appendChild(card);
                        }

                        folderBody.appendChild(npcGrid);
                    }

                    // ════════════════════════════════════════════════════════════
                    //  DEFAULT TREE RENDERING (compact view — non-NPC books, or NPCs with portraits off)
                    // ════════════════════════════════════════════════════════════
                    if (!useNpcCardView) {

                    // Define TreeNode class locally
                    class TreeNode {
                        constructor(name, item = null) {
                            this.name = name;
                            this.item = item;
                            /** @type {Map<string, TreeNode>} */
                            this.children = new Map();
                            /** @type {TreeNode|null} */
                            this.parent = null;
                        }
                    }


                    const getNodePath = (node, bookName) => {
                        const parts = [];
                        let curr = node;
                        while (curr && curr.name) {
                            parts.unshift(curr.name);
                            curr = curr.parent;
                        }
                        return bookName + '::' + parts.join('::');
                    };

                    const getEntryParts = (item) => {
                        const bookNameLower = (item.book || '').toLowerCase();
                        const isEventsBook = bookNameLower.includes('events') || bookNameLower.includes('event');
                        
                        if (isEventsBook) {
                            // Check for DD/MM/YY
                            const dateRegex = /\[([^\]]*\b(\d{1,2})\/(\d{1,2})\/(\d+)\b[^\]]*)\](.*)/i;
                            const dateMatch = item.label.match(dateRegex);
                            if (dateMatch) {
                                const dd = dateMatch[2].padStart(2, '0');
                                const mm = dateMatch[3].padStart(2, '0');
                                let yy = dateMatch[4];
                                if (yy.length === 2) yy = '20' + yy;
                                if (yy.length < 4) yy = yy.padStart(4, '0');
                                const dateStr = `${dd}/${mm}/${yy}`;
                                let bracketContent = dateMatch[1]
                                    .replace(new RegExp(`(?:,\\s*)?${dateMatch[2]}\\/${dateMatch[3]}\\/${dateMatch[4]}(?:\\s*,)?`, 'i'), '')
                                    .trim();
                                const title = dateMatch[5].trim();
                                const cleanLabel = bracketContent ? `[${bracketContent}] ${title}` : title;
                                return [dateStr, cleanLabel];
                            }

                            // Check for "[10:40 AM, Day 2] The Uprising" or similar patterns containing Day/D and numbers
                            const dayRegex = /\[([^\]]*(?:Day|D)\s*(\d+)[^\]]*)\](.*)/i;
                            const match = item.label.match(dayRegex);
                            if (match) {
                                const dayStr = `Day ${match[2]}`;
                                let bracketContent = match[1]
                                    .replace(new RegExp(`(?:,\\s*)?(?:Day|D)\\s*${match[2]}(?:\\s*,)?`, 'i'), '')
                                    .trim();
                                const title = match[3].trim();
                                const cleanLabel = bracketContent ? `[${bracketContent}] ${title}` : title;
                                return [dayStr, cleanLabel];
                            }
                        }
                        
                        // Default: split by "::"
                        return item.label.split('::').map(p => p.trim()).filter(Boolean);
                    };

                    const compareNodeKeys = (a, b, bookName) => {
                        const bookNameLower = (bookName || '').toLowerCase();
                        const isEventsBook = bookNameLower.includes('events') || bookNameLower.includes('event');
                        if (isEventsBook) {
                            // Check if keys start with "Day X"
                            const aDayMatch = a.match(/^Day\s+(\d+)/i);
                            const bDayMatch = b.match(/^Day\s+(\d+)/i);
                            if (aDayMatch && bDayMatch) {
                                return parseInt(aDayMatch[1], 10) - parseInt(bDayMatch[1], 10);
                            }
                            if (aDayMatch) return -1;
                            if (bDayMatch) return 1;

                            // Check if keys start with DD/MM/YY
                            const aDateMatch = a.match(/^(\d{1,2})\/(\d{1,2})\/(\d+)$/);
                            const bDateMatch = b.match(/^(\d{1,2})\/(\d{1,2})\/(\d+)$/);
                            if (aDateMatch && bDateMatch) {
                                const aD = parseInt(aDateMatch[1], 10);
                                const aM = parseInt(aDateMatch[2], 10);
                                let aY = parseInt(aDateMatch[3], 10);
                                if (aY < 100) aY += 2000;
                                const bD = parseInt(bDateMatch[1], 10);
                                const bM = parseInt(bDateMatch[2], 10);
                                let bY = parseInt(bDateMatch[3], 10);
                                if (bY < 100) bY += 2000;
                                const aTime = new Date(0, 0, 1);
                                aTime.setFullYear(aY, aM - 1, aD);
                                const bTime = new Date(0, 0, 1);
                                bTime.setFullYear(bY, bM - 1, bD);
                                return aTime.getTime() - bTime.getTime();
                            }
                            if (aDateMatch) return -1;
                            if (bDateMatch) return 1;

                            // Check if keys start with a time bracket like "[10:40 AM]"
                            const timeRegex = /^\[(\d{1,2}):(\d{2})\s*(AM|PM)?\]/i;
                            const aTimeMatch = a.match(timeRegex);
                            const bTimeMatch = b.match(timeRegex);
                            if (aTimeMatch && bTimeMatch) {
                                let aH = parseInt(aTimeMatch[1], 10);
                                let aM = parseInt(aTimeMatch[2], 10);
                                if (aTimeMatch[3]) {
                                    const mer = aTimeMatch[3].toUpperCase();
                                    if (mer === 'AM' && aH === 12) aH = 0;
                                    if (mer === 'PM' && aH !== 12) aH += 12;
                                }
                                let bH = parseInt(bTimeMatch[1], 10);
                                let bM = parseInt(bTimeMatch[2], 10);
                                if (bTimeMatch[3]) {
                                    const mer = bTimeMatch[3].toUpperCase();
                                    if (mer === 'AM' && bH === 12) bH = 0;
                                    if (mer === 'PM' && bH !== 12) bH += 12;
                                }
                                return (aH * 60 + aM) - (bH * 60 + bM);
                            }
                        }
                        
                        // Fallback to alphabetical sort
                        return a.localeCompare(b);
                    };

                    // Build the hierarchy tree for this lorebook
                    const rootNode = new TreeNode('');
                    for (const item of items) {
                        const parts = getEntryParts(item);
                        if (parts.length === 0) continue;
                        
                        let current = rootNode;
                        for (let i = 0; i < parts.length; i++) {
                            const part = parts[i];
                            if (!current.children.has(part)) {
                                const newNode = new TreeNode(part);
                                newNode.parent = current;
                                current.children.set(part, newNode);
                            }
                            current = current.children.get(part);
                            if (i === parts.length - 1) {
                                current.item = item;
                            }
                        }
                    }

                    // Recursive function to render a node
                    const renderNode = (node, parentElement) => {
                        const hasChildren = node.children.size > 0;
                        const nodePath = getNodePath(node, bookName);
                        const isDirty = node.item ? _dirtyEntries.has(node.item.id) : false;
                        
                        const entryEl = document.createElement('div');
                        entryEl.className = 'rt-agent-entry-el';
                        entryEl.style.cssText = 'flex-shrink:0; border-radius:3px;';

                        const entryHdr = document.createElement('div');
                        entryHdr.className = 'rt-agent-entry-hdr';
                        entryHdr.style.cssText = 'display:flex; align-items:center; gap:5px; padding:3px 4px; cursor:pointer; border-radius:3px;';

                        // Chevron toggle
                        let chevronHtml = '';
                        let childrenContainer = null;
                        if (hasChildren) {
                            const isSubOpen = _manifestOpenSubFolders.has(nodePath);
                            chevronHtml = `<span class="rt-agent-subfolder-toggle" style="font-size:9px; opacity:0.5; width:10px; flex-shrink:0; font-family:monospace; text-align:center; cursor:pointer;">${isSubOpen ? '▼' : '▶'}</span>`;
                            
                            childrenContainer = document.createElement('div');
                            childrenContainer.className = 'rt-agent-entry-children';
                            childrenContainer.style.cssText = `display:${isSubOpen ? 'flex' : 'none'}; flex-direction:column; border-left:1px solid rgba(255,255,255,0.07); margin-left:10px; padding-left:6px; gap:1px; padding-top:2px; padding-bottom:2px;`;
                        } else {
                            chevronHtml = `<span style="width:10px; flex-shrink:0;"></span>`;
                        }

                        // Status dot
                        const bookNameLower = (bookName || '').toLowerCase();
                        const isEventsBook = bookNameLower.includes('events') || bookNameLower.includes('event');
                        const isDayNode = isEventsBook && (/^Day\s+\d+$/i.test(node.name) || /^\d{1,2}\/\d{1,2}\/\d+$/.test(node.name));

                        let statusDotHtml = '';
                        if (node.item) {
                            const statusColor = node.item.is_active ? 'var(--rt-accent)' : 'rgba(255,255,255,0.18)';
                            statusDotHtml = `<div style="width:5px; height:5px; border-radius:50%; background:${statusColor}; flex-shrink:0;" title="${node.item.is_active ? 'Active (visible to agent)' : 'Inactive'}"></div>`;
                        } else if (!isDayNode) {
                            statusDotHtml = `<div style="width:5px; height:5px; border-radius:50%; border:1px dashed rgba(255,255,255,0.25); box-sizing:border-box; flex-shrink:0;" title="Virtual parent placeholder (entry not created yet)"></div>`;
                        }

                        // Label style
                        let labelStyle = '';
                        if (node.item) {
                            labelStyle = 'flex:1; font-size:10px; color:var(--rt-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
                        } else if (isDayNode) {
                            labelStyle = 'flex:1; font-size:10px; color:var(--rt-text); font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
                        } else {
                            labelStyle = 'flex:1; font-size:10px; color:var(--rt-text-muted); font-style:italic; opacity:0.6; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
                        }

                        // Tokens and action buttons
                        let tokensHtml = '';
                        let cleanHtml = '';
                        let viewNpcHtml = '';
                        let relStatsHtml = '';
                        let editHtml = '';
                        let deleteHtml = '';

                        const isWorldBook = bookNameLower.endsWith('_world') || bookNameLower === 'world';

                        if (node.item) {
                            const entryTokens = Math.round((node.item.content || '').length / 4);
                            tokensHtml = `<span style="font-size:8px; opacity:0.5; color:var(--rt-text-muted); margin-right:5px; flex-shrink:0; background:rgba(255,255,255,0.06); padding:1px 4px; border-radius:4px;" title="Estimated tokens">${entryTokens}t</span>`;
                            if (isNpcBook) {
                                viewNpcHtml = `<button class="rt-agent-entry-view-npc" data-id="${node.item.id}" style="background:rgba(212,169,64,0.12); border:1px solid rgba(212,169,64,0.35); border-radius:3px; color:#d4a940; cursor:pointer; font-size:10px; padding:1px 5px; flex-shrink:0; line-height:1.2;" title="View NPC CORE card"><i class="fa-solid fa-address-card"></i></button>`;
                                if (s.npcRelationshipBars && renderCompactRelStats) {
                                    relStatsHtml = renderCompactRelStats(node.item.id);
                                }
                            }
                            cleanHtml = !isWorldBook ? `<button class="rt-agent-entry-clean" data-id="${node.item.id}" style="background:none; border:none; color:#e67e22; cursor:pointer; font-size:9px; padding:1px 3px; flex-shrink:0;" title="Run targeted cleanup for this entry"><i class="fa-solid fa-broom"></i></button>` : '';
                            editHtml = `<button class="rt-agent-entry-edit" data-id="${node.item.id}" style="background:none; border:none; color:var(--rt-accent); cursor:pointer; font-size:9px; padding:1px 3px; flex-shrink:0;" title="Edit this lore entry"><i class="fa-solid fa-pen-to-square"></i></button>`;
                            deleteHtml = `<button class="rt-agent-entry-delete" data-id="${node.item.id}" style="background:none; border:none; color:var(--rt-text-muted); cursor:pointer; font-size:9px; padding:1px 3px; flex-shrink:0;" title="Delete entry"><i class="fa-solid fa-trash"></i></button>`;
                        }

                        entryHdr.innerHTML = `
                            ${chevronHtml}
                            ${viewNpcHtml}
                            ${statusDotHtml}
                            <span class="rt-agent-entry-label-span" style="${labelStyle}">${escapeHtml(node.name)}${isDirty ? ' <span style="color:#ffa500; font-size:8px;" title="Unsaved edits">●</span>' : ''}</span>
                            ${relStatsHtml}
                            ${tokensHtml}
                            ${editHtml}
                            ${cleanHtml}
                            ${deleteHtml}
                        `;

                        const viewNpcBtn = entryHdr.querySelector('.rt-agent-entry-view-npc');
                        if (viewNpcBtn && node.item && openNpcDetailPopup && parseRelationship) {
                            viewNpcBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                openNpcDetailPopup(node.item, parseRelationship(node.item.id));
                            });
                        }

                        let entryBody = null;
                        if (node.item) {
                            const dirtySnap = isDirty ? _dirtyEntries.get(node.item.id) : null;
                            entryBody = buildEntryBody(node.item, entryHdr, {
                                stale: !!isDirty,
                                dirty: dirtySnap || null,
                                isNpcEntry: isNpcBook,
                            });
                            if (_openEntries.has(node.item.id)) {
                                entryBody.style.display = 'flex';
                                entryHdr.style.background = 'rgba(255,255,255,0.05)';
                                entryEl.classList.add('open');
                            }
                        }

                        // Event Listeners
                        if (hasChildren) {
                            const toggleBtn = entryHdr.querySelector('.rt-agent-subfolder-toggle');
                            const toggleSubfolder = (e) => {
                                e.stopPropagation();
                                const opening = childrenContainer.style.display === 'none';
                                childrenContainer.style.display = opening ? 'flex' : 'none';
                                if (toggleBtn) {
                                    toggleBtn.textContent = opening ? '▼' : '▶';
                                }
                                if (opening) {
                                    _manifestOpenSubFolders.add(nodePath);
                                } else {
                                    _manifestOpenSubFolders.delete(nodePath);
                                }
                            };
                            if (toggleBtn) {
                                toggleBtn.addEventListener('click', toggleSubfolder);
                            }
                            if (!node.item) {
                                entryHdr.addEventListener('click', toggleSubfolder);
                            }
                        }

                        if (node.item) {
                            entryHdr.addEventListener('click', (e) => {
                                if (/** @type {HTMLElement} */ (e.target).closest('.rt-agent-subfolder-toggle, .rt-agent-entry-delete, .rt-agent-entry-clean, .rt-agent-entry-edit, .rt-agent-entry-view-npc')) return;
                                const opening = entryBody.style.display === 'none';
                                entryBody.style.display = opening ? 'flex' : 'none';
                                entryHdr.style.background = opening ? 'rgba(255,255,255,0.05)' : '';
                                if (opening) {
                                    _openEntries.add(node.item.id);
                                    entryEl.classList.add('open');
                                } else {
                                    _openEntries.delete(node.item.id);
                                    entryEl.classList.remove('open');
                                }
                            });
                        }

                        entryEl.appendChild(entryHdr);
                        if (entryBody) {
                            entryEl.appendChild(entryBody);
                        }
                        if (hasChildren) {
                            entryEl.appendChild(childrenContainer);
                            const sortedKeys = Array.from(node.children.keys()).sort((a, b) => compareNodeKeys(a, b, bookName));
                            for (const key of sortedKeys) {
                                renderNode(node.children.get(key), childrenContainer);
                            }
                        }

                        parentElement.appendChild(entryEl);
                    };

                    // Render tree children under folderBody
                    const sortedRootKeys = Array.from(rootNode.children.keys()).sort((a, b) => compareNodeKeys(a, b, bookName));
                    for (const key of sortedRootKeys) {
                        renderNode(rootNode.children.get(key), folderBody);
                    }

                    } // end !useNpcCardView

                    if (isNpcBook) {
                        const addNpcBtn = document.createElement('div');
                        addNpcBtn.className = 'rt-npc-add-btn';
                        addNpcBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Add NPC to Story';
                        addNpcBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            openNpcCreatorDialog(bookName, prefix);
                        });
                        folderBody.appendChild(addNpcBtn);
                    }

                    folder.appendChild(folderHdr);
                    folder.appendChild(folderBody);
                    list.appendChild(folder);
                }
                    } catch(e) {
                        if (gen !== _manifestRenderGen) return;
                        console.error('[RPG Tracker] getLorebookManifest decoupled failed:', e);
                        const existingLoading = list.querySelector('#rt-agent-manifest-loading');
                        if (existingLoading) existingLoading.innerHTML = '<span style="color:#ff5555;">Error loading manifest.</span>';
                    }
                }, 10);
            } catch (e) {
                if (gen !== _manifestRenderGen) return;
                console.error('[RPG Tracker] refreshManifest failed:', e);
                list.innerHTML = '<div style="text-align: center; color: #ff5555; font-size: 0.769em; padding: 10px;">Error rendering Player Character.</div>';
            }
        };

        refreshAgentManifest = refreshManifest;
        refreshNpcManifest = refreshManifest;

        // ════════════════════════════════════════════════════════════════════
        //  NPC Creator Dialog — Card Import, Freeform, Archetype Generator
        // ════════════════════════════════════════════════════════════════════

        /**
         * Robust helper to parse the [[NPC: Name | Description | Keywords]] format anywhere in the text.
         * @param {string|null} text
         * @returns {{name: string, description: string, keywords: string[]}|null}
         */
        const parseNpcTag = (text) => {
            if (!text) return null;
            const match = text.match(/\[\[NPC:\s*([^|]*?)\s*\|\s*([\s\S]*?)\s*\|\s*([^|]*?)\]\]/i);
            if (!match) return null;
            return {
                name: match[1].trim(),
                description: match[2].trim(),
                keywords: match[3].split(',').map(k => k.trim()).filter(Boolean)
            };
        };

        /**
         * Creates an NPC lorebook entry from a character card.
         * @param {object} charCard - The SillyTavern character card object
         * @param {string} bookName - Target lorebook book name
         * @param {string|null} adaptedContent - If provided, use this instead of raw card data
         */
        const createNpcFromCharCard = async (charCard, bookName, adaptedContent = null) => {
            const ctx = SillyTavern.getContext();
            const s = getSettings();
            let name = charCard.name || 'Unnamed NPC';
            let keys = [name];
            
            const firstName = name.split(/\s+/)[0];
            if (firstName && firstName !== name) keys.push(firstName);

            // Build NPC entry content
            let content;
            if (adaptedContent) {
                const parsed = parseNpcTag(adaptedContent);
                if (parsed) {
                    name = parsed.name;
                    content = parsed.description;
                    // Clean up any stray | separators the AI might have used instead of newlines
                    content = content.replace(/\s*\|\s*(?=(?:Appearance\/Species|Appearance):|Personality:|Brief Background:|Habits\/Behaviors:|Relationship with)/gi, '\n');
                    if (parsed.keywords.length > 0) {
                        keys = parsed.keywords;
                    }
                } else {
                    content = adaptedContent;
                }
            } else {
                // Direct add: use name, description, personality (NOT scenario/first_mes)
                const parts = ['[CORE]'];
                if (charCard.description) parts.push(charCard.description.substring(0, 1500));
                if (charCard.personality) parts.push(`Personality: ${charCard.personality.substring(0, 500)}`);
                parts.push('[/CORE]');
                content = parts.join('\n');
            }

            // Ensure relationship fields are present even in adapted content (only if bars enabled)
            if (s.npcRelationshipBars && adaptedContent && !/Friendship\/Rapport:/i.test(content)) {
                // Legacy: adapted content from old prompt may still include bars text — strip it
                content = content.replace(/\s*Friendship\/Rapport:[^\n]*/gi, '')
                                 .replace(/\s*Affection\/Interest:[^\n]*/gi, '');
            }

            // Ensure the content has a [CORE] wrap around the persistent sections
            if (!/\[CORE\]/i.test(content)) {
                const lines = content.split('\n');
                const coreLines = [];
                const relLines = [];
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (/^Friendship\/Rapport:/i.test(trimmed) || /^Affection\/Interest:/i.test(trimmed)) {
                        // Drop legacy text-based bar lines — values are now code-owned
                        continue;
                    } else if (trimmed || coreLines.length > 0) {
                        coreLines.push(line);
                    }
                }
                while (coreLines.length > 0 && !coreLines[coreLines.length - 1].trim()) {
                    coreLines.pop();
                }
                content = `[CORE]\n${coreLines.join('\n')}\n[/CORE]`;
            }

            // Load or create the book
            let bookData = null;
            try { bookData = await ctx.loadWorldInfo(bookName); } catch (_) {}
            if (!bookData) {
                try {
                    const res = await fetch('/api/worldinfo/get', {
                        method: 'POST', headers: getRequestHeaders(),
                        body: JSON.stringify({ name: bookName })
                    });
                    if (res.ok) { const d = await res.json(); if (d?.entries) bookData = d; }
                } catch (_) {}
            }
            if (!bookData) {
                bookData = { entries: {}, name: bookName, scan_depth: 4, token_budget: 400, recursive: false, extensions: {} };
            }

            // Check for duplicate
            const cleanLabel = name.toLowerCase().trim();
            for (const [, entry] of Object.entries(bookData.entries)) {
                const entryLabel = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
                if (entryLabel === cleanLabel) {
                    toastr['warning'](`NPC "${name}" already exists in this lorebook.`, 'NPC Import');
                    return false;
                }
            }

            // Create new entry
            const uids = Object.keys(bookData.entries).map(Number).filter(n => !isNaN(n));
            const nextUid = uids.length > 0 ? Math.max(...uids) + 1 : 0;
            bookData.entries[nextUid] = {
                uid: nextUid,
                key: keys,
                keysecondary: [],
                comment: name,
                content: content,
                constant: false,
                selective: false, selectiveLogic: 0, addMemo: true,
                order: s.routerDefaultOrder ?? 100,
                position: s.routerDefaultPosition ?? 0,
                disable: !s.routerNativeKeywordActivation,
                probability: 100, useProbability: false,
                depth: s.routerDefaultDepth ?? 4,
                role: (s.routerDefaultPosition === 4) ? (s.routerDefaultRole ?? 0) : null,
                group: '', groupOverride: false, groupWeight: 100,
            };

            // Save via HTTP API
            const saveRes = await fetch('/api/worldinfo/edit', {
                method: 'POST', headers: getRequestHeaders(),
                body: JSON.stringify({ name: bookName, data: bookData })
            });
            if (!saveRes.ok) {
                toastr['error']('Failed to save NPC entry.', 'NPC Import');
                return false;
            }

            // Sync in-memory cache
            if (typeof ctx.saveWorldInfo === 'function') {
                try { await ctx.saveWorldInfo(bookName, bookData); } catch (_) {}
            }

            // Activate the book
            if (typeof ctx.executeSlashCommandsWithOptions === 'function') {
                await new Promise(r => setTimeout(r, 300));
                if (typeof ctx.updateWorldInfoList === 'function') await ctx.updateWorldInfoList();
                await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${bookName}"`);
            }

            // Activate the new entry key
            const fullId = `${bookName}::${nextUid}`;
            if (!s.activeRouterKeys.includes(fullId)) {
                s.activeRouterKeys.push(fullId);
            }

            // Initialise code-owned relationship values for this NPC
            if (!s.npcRelationshipValues) s.npcRelationshipValues = {};
            if (!s.npcRelationshipValues[fullId]) {
                s.npcRelationshipValues[fullId] = { friendship: 0, affection: 0 };
            }

            // Embed avatar as portrait (use URL directly to retain original quality and prevent settings bloat)
            if (charCard.avatar) {
                try {
                    const avatarUrl = `/characters/${encodeURIComponent(charCard.avatar)}`;
                    applyPortraitData(name, avatarUrl);
                } catch (err) {
                    console.warn('[RPG Tracker] Failed to embed character avatar as NPC portrait:', err);
                }
            }

            return true;
        };

        /**
         * Sends character card data + campaign context to the AI for adaptation.
         * Returns the adapted NPC content string.
         * @param {object} charCard
         * @returns {Promise<string|null>}
         */
        const adaptNpcWithAI = async (charCard) => {
            const s = getSettings();
            const ctx = SillyTavern.getContext();
            const name = charCard.name || 'Unnamed';

            // Gather context
            const contextParts = [];

            // Character card data
            contextParts.push(`CHARACTER CARD:\nName: ${name}\nDescription: ${(charCard.description || '').substring(0, 2000)}\nPersonality: ${(charCard.personality || '').substring(0, 500)}`);

            // Current game state
            if (s.currentMemo) {
                contextParts.push(`CURRENT GAME STATE:\n${s.currentMemo.substring(0, 2000)}`);
            }

            // Recent chat
            if (ctx.chat && Array.isArray(ctx.chat)) {
                const msgs = ctx.chat.filter(m => !m.is_system && m.mes?.trim()).slice(-10);
                if (msgs.length > 0) {
                    const msgText = msgs.map(m => `${m.name || (m.is_user ? 'User' : 'Character')}: ${m.mes}`).join('\n\n');
                    contextParts.push(`RECENT CHAT (for setting context):\n${msgText.substring(0, 6000)}`);
                }
            }

            // Narrator card
            try {
                const charData = ctx.characters?.[ctx.characterId];
                if (charData?.description) {
                    contextParts.push(`NARRATOR/WORLD CARD:\n${charData.description.substring(0, 1500)}`);
                }
            } catch (_) {}

            // Existing lorebook summaries for setting context
            try {
                if (s.activeRouterKeys?.length > 0) {
                    const summaries = [];
                    const loaded = {};
                    for (const k of s.activeRouterKeys.slice(0, 15)) {
                        const [bk, uid] = k.split('::');
                        if (!loaded[bk]) loaded[bk] = await ctx.loadWorldInfo(bk);
                        const entry = loaded[bk]?.entries?.[uid];
                        if (entry) summaries.push(`[${entry.comment || 'Entry'}]: ${(entry.content || '').substring(0, 200)}`);
                    }
                    if (summaries.length > 0) {
                        contextParts.push(`ACTIVE LOREBOOK ENTRIES (world context):\n${summaries.join('\n')}`);
                    }
                }
            } catch (_) {}

            const systemPrompt = `${s.routerSystemPromptTemplate || ''}

---

You are an NPC Adaptation Agent. Given a character card from a different source and the current RPG campaign context, adapt the character to fit naturally into the ongoing story.

<npc_instructions>
${s.routerModules?.npc?.instruction || ''}
</npc_instructions>

Rules:
- If the character is from a different era/genre (e.g., modern character in a medieval fantasy), translate their skills, equipment, backstory, and background to fit the current world setting.
- Preserve the character's core personality, motivations, and distinguishing traits.
- Write a concise NPC lorebook entry following the exact <npc_instructions> provided above.
- Your output MUST be strictly formatted as a lorebook entry tag. It MUST look EXACTLY like this:
  [[NPC: Name | Description | keywords]]
- Replace "Name" with the character's name.
- Replace "Description" with the full formatted description section. Wrap all the immutable identity sections (Appearance, Personality, Brief Background, Habits/Behaviors) inside a single [CORE] and [/CORE] tag block within the Description. DO NOT include a Relationship field. DO NOT use the "|" character inside the Description; separate the internal sections using newlines.
- Replace "keywords" with a comma-separated list of keywords including their name.
- Output ONLY this single [[NPC: ...]] string. No preamble, no explanation, no other tags.`;

            const userPrompt = contextParts.join('\n\n---\n\n');

            // Use router connection settings for the AI call
            const aiSettings = {
                connectionSource: s.routerConnectionSource ?? 'default',
                connectionProfileId: s.routerConnectionProfileId || '',
                completionPresetId: s.routerCompletionPresetId || '',
                ollamaUrl: s.routerOllamaUrl || 'http://localhost:11434',
                ollamaModel: s.routerOllamaModel || '',
                openaiUrl: s.routerOpenaiUrl || '',
                openaiKey: s.routerOpenaiKey || '',
                openaiModel: s.routerOpenaiModel || '',
                maxTokens: s.routerMaxTokens || 0,
                debugMode: s.debugMode,
            };

            try {
                const result = await sendStateRequest(aiSettings, systemPrompt, userPrompt);
                return (result || '').trim() || null;
            } catch (err) {
                toastr['error'](`AI adaptation failed: ${String(err.message || err).substring(0, 120)}`, 'NPC Import');
                return null;
            }
        };

        /**
         * Gathers campaign context parts for NPC generation prompts.
         * @returns {string[]}
         */
        const gatherNpcCampaignContext = async () => {
            const s = getSettings();
            const ctx = SillyTavern.getContext();
            const parts = [];
            if (s.currentMemo) {
                parts.push(`CURRENT GAME STATE:\n${s.currentMemo.substring(0, 2000)}`);
            }
            if (ctx.chat && Array.isArray(ctx.chat)) {
                const msgs = ctx.chat.filter(m => !m.is_system && m.mes?.trim()).slice(-8);
                if (msgs.length > 0) {
                    const msgText = msgs.map(m => `${m.name || (m.is_user ? 'User' : 'Character')}: ${m.mes}`).join('\n\n');
                    parts.push(`RECENT CHAT (for setting/tone context):\n${msgText.substring(0, 4000)}`);
                }
            }
            try {
                const charData = ctx.characters?.[ctx.characterId];
                if (charData?.description) {
                    parts.push(`NARRATOR/WORLD CARD:\n${charData.description.substring(0, 1500)}`);
                }
            } catch (_) {}
            try {
                if (s.activeRouterKeys?.length > 0) {
                    const summaries = [];
                    const loaded = {};
                    for (const k of s.activeRouterKeys.slice(0, 12)) {
                        const [bk, uid] = k.split('::');
                        if (!loaded[bk]) loaded[bk] = await ctx.loadWorldInfo(bk);
                        const entry = loaded[bk]?.entries?.[uid];
                        if (entry) summaries.push(`[${entry.comment || 'Entry'}]: ${(entry.content || '').substring(0, 180)}`);
                    }
                    if (summaries.length > 0) {
                        parts.push(`ACTIVE LOREBOOK ENTRIES (world context):\n${summaries.join('\n')}`);
                    }
                }
            } catch (_) {}
            return parts;
        };

        /**
         * Generates NPC from a freeform name + description using AI.
         * @param {string} name - NPC name (may be empty)
         * @param {string} rawDesc - User's free-text description
         * @param {string[]} existingNpcNames - List of existing NPC names to forbid
         * @returns {Promise<string|null>} Lorebook [[NPC: ...]] tag string
         */
        const generateNpcFromFreeform = async (name, rawDesc, existingNpcNames = []) => {
            const s = getSettings();
            const contextParts = await gatherNpcCampaignContext();
            const label = name ? `Name: ${name}\n` : '';
            contextParts.unshift(`USER'S NPC CONCEPT:\n${label}Description: ${rawDesc}`);

            const forbiddenBlock = existingNpcNames.length > 0
                ? `\nForbidden Names (Do NOT use these existing NPC/character names under any circumstances):\n${existingNpcNames.map(n => `- ${n}`).join('\n')}\n`
                : '';

            const systemPrompt = `${s.routerSystemPromptTemplate || ''}

---

You are an NPC Creation Agent. The user has provided a brief concept or description for a new NPC they want to add to the current ongoing campaign.
${forbiddenBlock}
<npc_instructions>
${s.routerModules?.npc?.instruction || ''}
</npc_instructions>

Rules:
- Use the USER'S NPC CONCEPT as your primary source. Expand it into a full, vivid character.
- If no name is provided, create a fitting one for the world setting.
- You MUST NOT use any of the names listed in the Forbidden Names section. If the concept implies a name from this list, modify or create a new unique name.
- Adapt appearance, background and habits to fit naturally into the current campaign setting/tone inferred from context.
- Your output MUST be strictly formatted as a lorebook entry tag:
  [[NPC: Name | Description | keywords]]
- Replace "Name" with the character's name.
- Replace "Description" with the full formatted entry. Wrap all immutable identity sections (Appearance/Species, Personality, Brief Background, Habits/Behaviors) inside a single [CORE] and [/CORE] block. DO NOT use "|" inside Description. Use newlines.
- Replace "keywords" with a comma-separated list including their name.
- Output ONLY this single [[NPC: ...]] tag. No preamble, no explanation.`;

            const aiSettings = {
                connectionSource: s.routerConnectionSource ?? 'default',
                connectionProfileId: s.routerConnectionProfileId || '',
                completionPresetId: s.routerCompletionPresetId || '',
                ollamaUrl: s.routerOllamaUrl || 'http://localhost:11434',
                ollamaModel: s.routerOllamaModel || '',
                openaiUrl: s.routerOpenaiUrl || '',
                openaiKey: s.routerOpenaiKey || '',
                openaiModel: s.routerOpenaiModel || '',
                maxTokens: s.routerMaxTokens || 0,
                debugMode: s.debugMode,
            };
            try {
                const result = await sendStateRequest(aiSettings, systemPrompt, contextParts.join('\n\n---\n\n'));
                return (result || '').trim() || null;
            } catch (err) {
                toastr['error'](`NPC generation failed: ${String(err.message || err).substring(0, 120)}`, 'NPC Creator');
                return null;
            }
        };

        /**
         * Generates NPC from a chosen archetype + optional concept using AI.
         * @param {string} archetype - e.g. "Arch Nemesis"
         * @param {string} name - optional name hint
         * @param {string} concept - optional extra descriptive prompt
         * @param {string[]} existingNpcNames - List of existing NPC names to forbid
         * @returns {Promise<string|null>} Lorebook [[NPC: ...]] tag string
         */
        const generateNpcFromArchetype = async (archetype, name, concept, existingNpcNames = []) => {
            const s = getSettings();
            const contextParts = await gatherNpcCampaignContext();
            const nameLine = name ? `Desired Name: ${name}\n` : '';
            const conceptLine = concept ? `Additional concept: ${concept}\n` : '';
            contextParts.unshift(`ARCHETYPE REQUEST:\nArchetype: ${archetype}\n${nameLine}${conceptLine}`);

            const forbiddenBlock = existingNpcNames.length > 0
                ? `\nForbidden Names (Do NOT use these existing NPC/character names under any circumstances):\n${existingNpcNames.map(n => `- ${n}`).join('\n')}\n`
                : '';

            const systemPrompt = `${s.routerSystemPromptTemplate || ''}

---

You are an NPC Creation Agent. Create a new NPC for the current ongoing campaign fitting the requested archetype.
${forbiddenBlock}
<npc_instructions>
${s.routerModules?.npc?.instruction || ''}
</npc_instructions>

Rules:
- The NPC MUST embody the requested archetype (e.g. a "Lover" should have romantic motivation toward the player; an "Arch Nemesis" should be a credible threat with personal stakes).
- Invent a name suitable for the world if not provided.
- You MUST NOT use any of the names listed in the Forbidden Names section.
- Ground the NPC's appearance, backstory, and habits in the current campaign setting inferred from context.
- Your output MUST be strictly formatted as a lorebook entry tag:
  [[NPC: Name | Description | keywords]]
- Replace "Name" with the character's name.
- Replace "Description" with the full formatted entry. Wrap all immutable identity sections (Appearance/Species, Personality, Brief Background, Habits/Behaviors) inside a single [CORE] and [/CORE] block. DO NOT use "|" inside Description. Use newlines.
- Replace "keywords" with a comma-separated list including their name.
- Output ONLY this single [[NPC: ...]] tag. No preamble, no explanation.`;

            const aiSettings = {
                connectionSource: s.routerConnectionSource ?? 'default',
                connectionProfileId: s.routerConnectionProfileId || '',
                completionPresetId: s.routerCompletionPresetId || '',
                ollamaUrl: s.routerOllamaUrl || 'http://localhost:11434',
                ollamaModel: s.routerOllamaModel || '',
                openaiUrl: s.routerOpenaiUrl || '',
                openaiKey: s.routerOpenaiKey || '',
                openaiModel: s.routerOpenaiModel || '',
                maxTokens: s.routerMaxTokens || 0,
                debugMode: s.debugMode,
            };
            try {
                const result = await sendStateRequest(aiSettings, systemPrompt, contextParts.join('\n\n---\n\n'));
                return (result || '').trim() || null;
            } catch (err) {
                toastr['error'](`NPC generation failed: ${String(err.message || err).substring(0, 120)}`, 'NPC Creator');
                return null;
            }
        };
        const openNpcCreatorDialog = async (bookName, prefix) => {
            const ctx = SillyTavern.getContext();

            // Load target book once to check for existing entries
            let existingNpcNames = [];
            let targetBookData = null;
            try {
                targetBookData = await ctx.loadWorldInfo(bookName);
                if (targetBookData && targetBookData.entries) {
                    existingNpcNames = Object.values(targetBookData.entries)
                        .map(e => (e.comment || '').replace(/^\[.*?\]\s*/i, '').trim())
                        .filter(Boolean);
                }
            } catch (_) {}

            // Fetch character list with timeout to prevent UI hang
            let allChars = [];
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                const res = await fetch('/api/characters/all', {
                    method: 'POST', headers: getRequestHeaders(),
                    body: JSON.stringify({}),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const raw = await res.json();
                    // Strip heavy fields to reduce memory — keep only what we need
                    allChars = (Array.isArray(raw) ? raw : []).map(c => ({
                        name: c.name || '',
                        avatar: c.avatar || '',
                        description: (c.description || '').substring(0, 1500),
                        personality: (c.personality || '').substring(0, 500),
                        scenario: (c.scenario || '').substring(0, 500),
                        first_mes: (c.first_mes || '').substring(0, 500),
                        date_added: c.date_added || 0,
                    }));
                    allChars.sort((a, b) => (b.date_added || 0) - (a.date_added || 0));
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    toastr['error']('Character list request timed out. Try again.', 'NPC Import');
                } else {
                    toastr['error']('Failed to load character cards.', 'NPC Import');
                }
                return;
            }

            // ── Build dialog shell ──────────────────────────────────────────
            const overlay = document.createElement('div');
            overlay.className = 'rt-charpicker-overlay';

            const popup = document.createElement('div');
            popup.className = 'rt-charpicker-popup';
            popup.style.width = '490px';

            // Header
            const header = document.createElement('div');
            header.className = 'rt-charpicker-header';
            header.innerHTML = `<h3>✨ Add NPC to Story</h3>`;
            const closeBtn = document.createElement('button');
            closeBtn.className = 'rt-charpicker-close';
            closeBtn.textContent = '✕';
            closeBtn.addEventListener('click', () => overlay.remove());
            header.appendChild(closeBtn);

            // Tab bar
            const tabBar = document.createElement('div');
            tabBar.className = 'rt-npc-creator-tabs';
            const tabDefs = [
                { id: 'card',      label: '🗂️ From Card' },
                { id: 'freeform', label: '✍️ Freeform' },
                { id: 'archetype', label: '🎭 Archetype' },
            ];
            const tabBtns = {};
            const tabPanels = {};
            for (const { id, label } of tabDefs) {
                const btn = document.createElement('div');
                btn.className = 'rt-npc-creator-tab' + (id === 'card' ? ' active' : '');
                btn.textContent = label;
                btn.dataset.tab = id;
                tabBar.appendChild(btn);
                tabBtns[id] = btn;
                const panel = document.createElement('div');
                panel.className = 'rt-npc-creator-panel' + (id === 'card' ? '' : ' hidden');
                panel.dataset.panel = id;
                tabPanels[id] = panel;
            }
            const switchTab = (id) => {
                for (const [tid, btn] of Object.entries(tabBtns)) {
                    btn.classList.toggle('active', tid === id);
                    tabPanels[tid].classList.toggle('hidden', tid !== id);
                }
            };
            tabBar.addEventListener('click', (e) => {
                const tgt = /** @type {HTMLElement} */ (e.target).closest('[data-tab]');
                if (tgt) switchTab(tgt.dataset.tab);
            });

            popup.appendChild(header);
            popup.appendChild(tabBar);
            for (const { id } of tabDefs) popup.appendChild(tabPanels[id]);
            overlay.appendChild(popup);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

            // ── Helper: AI preview + add flow ──────────────────────────────
            const showNpcPreviewAndAdd = async (generatedTag, defaultName, toastLabel, originalAvatar = null) => {
                if (!ctx.callGenericPopup) return;
                const parsed = parseNpcTag(generatedTag);
                const nameToAdd = parsed ? parsed.name : defaultName;

                // Check for duplicate
                let isDuplicate = false;
                let bookData = null;
                try { bookData = await ctx.loadWorldInfo(bookName); } catch (_) {}
                if (bookData && bookData.entries) {
                    const cleanLabel = nameToAdd.toLowerCase().trim();
                    for (const [, entry] of Object.entries(bookData.entries)) {
                        const entryLabel = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
                        if (entryLabel === cleanLabel) {
                            isDuplicate = true;
                            break;
                        }
                    }
                }

                const taId = `rt-npc-gen-preview-${Date.now()}`;
                const warningHtml = isDuplicate
                    ? `<div style="font-size:0.8em;color:#ff5555;margin-bottom:8px;font-weight:bold;background:rgba(255,0,0,0.1);padding:6px;border-radius:4px;border:1px solid rgba(255,0,0,0.2);">⚠️ An NPC named "${escapeHtml(nameToAdd)}" already exists! Please edit the name inside [[NPC: Name | ...]] before adding.</div>`
                    : `<div style="font-size:0.8em;opacity:0.6;margin-bottom:8px;">Review the AI-generated entry. Edit if needed, then confirm.</div>`;

                const previewHtml = `<div style="padding:10px;min-width:320px;max-width:520px;">
                    <b style="display:block;margin-bottom:8px;">✨ Generated NPC — ${escapeHtml(nameToAdd)}</b>
                    ${warningHtml}
                    <textarea id="${taId}" style="width:100%;min-height:160px;resize:vertical;font-size:0.9em;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:inherit;box-sizing:border-box;">${escapeHtml(generatedTag)}</textarea>
                </div>`;

                let finalContent = generatedTag;
                setTimeout(() => {
                    const ta = document.getElementById(taId);
                    if (ta) { ta.addEventListener('input', () => { finalContent = ta.value; }); ta.focus(); }
                }, 0);
                const result = await ctx.callGenericPopup(previewHtml, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', {
                    okButton: '✅ Add NPC', cancelButton: 'Cancel', wide: false,
                });
                if (result) {
                    const finalParsed = parseNpcTag(finalContent);
                    const finalName = finalParsed ? finalParsed.name : nameToAdd;

                    // Final duplicate verification
                    let finalBookData = null;
                    try { finalBookData = await ctx.loadWorldInfo(bookName); } catch (_) {}
                    if (finalBookData && finalBookData.entries) {
                        const cleanLabel = finalName.toLowerCase().trim();
                        for (const [, entry] of Object.entries(finalBookData.entries)) {
                            const entryLabel = (entry.comment || '').replace(/^\[.*?\]\s*/i, '').toLowerCase().trim();
                            if (entryLabel === cleanLabel) {
                                toastr['warning'](`NPC "${finalName}" already exists. Cannot add duplicate.`, toastLabel);
                                return; // Blocks adding!
                            }
                        }
                    }

                    const fakeCard = { name: finalName, avatar: originalAvatar };
                    const ok = await createNpcFromCharCard(fakeCard, bookName, finalContent);
                    if (ok) {
                        toastr['success'](`Added "${finalName}" as NPC.`, toastLabel);
                        overlay.remove();
                        await refreshManifest();
                    }
                }
            };

            // ── Tab 1: Import from Character Card ──────────────────────────
            {
                const cardPanel = tabPanels['card'];

                const searchInput = document.createElement('input');
                searchInput.className = 'rt-charpicker-search';
                searchInput.type = 'text';
                searchInput.placeholder = '🔍 Search characters by name...';
                searchInput.style.margin = '0 0 8px 0';
                searchInput.style.width = '100%';
                searchInput.style.boxSizing = 'border-box';

                const listContainer = document.createElement('div');
                listContainer.className = 'rt-charpicker-list';
                listContainer.style.padding = '0';

                cardPanel.appendChild(searchInput);
                cardPanel.appendChild(listContainer);

                let currentFilter = '';
                let displayCount = 10;

                const renderList = () => {
                    listContainer.innerHTML = '';
                    const filtered = currentFilter
                        ? allChars.filter(c => (c.name || '').toLowerCase().includes(currentFilter.toLowerCase()))
                        : allChars;

                    if (filtered.length === 0) {
                        listContainer.innerHTML = '<div class="rt-charpicker-empty">No characters match your search.</div>';
                        return;
                    }
                    const visible = filtered.slice(0, displayCount);
                    for (const char of visible) {
                        const item = document.createElement('div');
                        item.className = 'rt-charpicker-item';

                        const avatarDiv = document.createElement('div');
                        avatarDiv.className = 'rt-charpicker-avatar';
                        if (char.avatar && char.avatar !== 'none') {
                            const img = document.createElement('img');
                            img.src = `/characters/${encodeURIComponent(char.avatar)}`;
                            img.loading = 'lazy';
                            img.alt = char.name;
                            img.onerror = () => { img.replaceWith(Object.assign(document.createElement('div'), { className: 'rt-charpicker-avatar-placeholder', textContent: '👤' })); };
                            avatarDiv.appendChild(img);
                        } else {
                            avatarDiv.innerHTML = '<div class="rt-charpicker-avatar-placeholder">👤</div>';
                        }

                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'rt-charpicker-info';
                        const nameEl = document.createElement('div');
                        nameEl.className = 'rt-charpicker-name';
                        nameEl.textContent = char.name || 'Unnamed';
                        const descEl = document.createElement('div');
                        descEl.className = 'rt-charpicker-desc';
                        descEl.textContent = (char.description || char.personality || 'No description').substring(0, 120);
                        infoDiv.appendChild(nameEl);
                        infoDiv.appendChild(descEl);

                        const btnsDiv = document.createElement('div');
                        btnsDiv.className = 'rt-charpicker-btns';

                        const directBtn = document.createElement('button');
                        directBtn.className = 'rt-charpicker-add-btn direct';
                        directBtn.textContent = '+ Add as is';
                        directBtn.addEventListener('click', async () => {
                            directBtn.disabled = true;
                            directBtn.textContent = '⏳ Adding...';
                            try {
                                const ok = await createNpcFromCharCard(char, bookName);
                                if (ok) {
                                    toastr['success'](`Added "${char.name}" as NPC.`, 'NPC Creator');
                                    overlay.remove();
                                    await refreshManifest();
                                }
                            } catch (err) {
                                toastr['error'](`Failed: ${String(err.message || err).substring(0, 100)}`, 'NPC Creator');
                            } finally {
                                directBtn.disabled = false;
                                directBtn.textContent = '+ Add as is';
                            }
                        });

                        const aiBtn = document.createElement('button');
                        aiBtn.className = 'rt-charpicker-add-btn ai-adapt';
                        aiBtn.textContent = '🤖 Fit into Story';
                        aiBtn.addEventListener('click', async () => {
                            aiBtn.disabled = true;
                            aiBtn.textContent = '⏳ Adapting...';
                            try {
                                const adapted = await adaptNpcWithAI(char);
                                if (!adapted) { aiBtn.disabled = false; aiBtn.textContent = '🤖 Fit into Story'; return; }
                                await showNpcPreviewAndAdd(adapted, char.name, 'NPC Creator', char.avatar);
                            } catch (err) {
                                toastr['error'](`Adaptation failed: ${String(err.message || err).substring(0, 100)}`, 'NPC Creator');
                            } finally {
                                aiBtn.disabled = false;
                                aiBtn.textContent = '🤖 Fit into Story';
                            }
                        });

                        btnsDiv.appendChild(aiBtn);
                        btnsDiv.appendChild(directBtn);
                        item.appendChild(avatarDiv);
                        item.appendChild(infoDiv);
                        item.appendChild(btnsDiv);
                        listContainer.appendChild(item);
                    }
                    if (visible.length < filtered.length) {
                        const loadMore = document.createElement('div');
                        loadMore.className = 'rt-charpicker-load-more';
                        loadMore.textContent = `Show more (${visible.length} of ${filtered.length})`;
                        loadMore.addEventListener('click', () => { displayCount += 10; renderList(); });
                        listContainer.appendChild(loadMore);
                    }
                };
                let searchTimeout = null;
                searchInput.addEventListener('input', () => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => { currentFilter = searchInput.value.trim(); displayCount = 10; renderList(); }, 200);
                });
                renderList();
            }

            // ── Tab 2: Freeform Description ────────────────────────────────
            {
                const freeformPanel = tabPanels['freeform'];

                const hintEl = document.createElement('div');
                hintEl.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:8px;line-height:1.5;';
                hintEl.textContent = 'Describe the NPC in your own words. The AI will expand it into a full lorebook entry fitting the current campaign.';
                freeformPanel.appendChild(hintEl);

                const nameLabel = document.createElement('label');
                nameLabel.className = 'rt-npc-form-label';
                nameLabel.textContent = 'Name (optional)';
                const nameInput = document.createElement('input');
                nameInput.className = 'rt-npc-form-input';
                nameInput.type = 'text';
                nameInput.placeholder = 'e.g. Igor, Mira Voss, …';
                nameInput.style.marginBottom = '8px';

                const descLabel = document.createElement('label');
                descLabel.className = 'rt-npc-form-label';
                descLabel.textContent = 'Description / Concept *';
                const descInput = document.createElement('textarea');
                descInput.className = 'rt-npc-form-input';
                descInput.rows = 5;
                descInput.placeholder = 'e.g. A massive bovine warrior, stoic and dry-witted, survivor of the Tether-Break…';
                descInput.style.marginBottom = '4px';

                const genBtn = document.createElement('button');
                genBtn.className = 'rt-npc-generate-btn';
                genBtn.textContent = '🤖 Generate NPC';
                genBtn.addEventListener('click', async () => {
                    const rawDesc = descInput.value.trim();
                    if (!rawDesc) { toastr['warning']('Please enter a description.', 'NPC Creator'); return; }
                    genBtn.disabled = true;
                    genBtn.textContent = '⏳ Generating...';
                    try {
                        const generated = await generateNpcFromFreeform(nameInput.value.trim(), rawDesc, existingNpcNames);
                        if (!generated) return;
                        const nameFallback = nameInput.value.trim() || 'New NPC';
                        await showNpcPreviewAndAdd(generated, nameFallback, 'NPC Creator');
                    } finally {
                        genBtn.disabled = false;
                        genBtn.textContent = '🤖 Generate NPC';
                    }
                });

                freeformPanel.appendChild(nameLabel);
                freeformPanel.appendChild(nameInput);
                freeformPanel.appendChild(descLabel);
                freeformPanel.appendChild(descInput);
                freeformPanel.appendChild(genBtn);
            }

            // ── Tab 3: Archetype Generator ─────────────────────────────────
            {
                const archetypePanel = tabPanels['archetype'];

                const hintEl = document.createElement('div');
                hintEl.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:10px;line-height:1.5;';
                hintEl.textContent = 'Pick a story role below, or type a custom one. The AI will generate a fitting NPC grounded in the current campaign context.';
                archetypePanel.appendChild(hintEl);

                const archetypes = [
                    { id: 'Enemy',              icon: '⚔️' },
                    { id: 'Arch Nemesis',        icon: '💀' },
                    { id: 'Lover',               icon: '❤️' },
                    { id: 'Family Relative',     icon: '👨‍👩‍👧' },
                    { id: 'Companion / Ally',    icon: '🛡️' },
                    { id: 'Merchant',            icon: '🪙' },
                    { id: 'Mysterious Stranger', icon: '🎭' },
                    { id: 'Rival',               icon: '🧙' },
                    { id: 'Custom',              icon: '✍️' },
                ];

                let selectedArchetype = '';
                const grid = document.createElement('div');
                grid.className = 'rt-archetype-grid';
                grid.style.marginBottom = '10px';
                const chipMap = {};
                
                const customLabel = document.createElement('label');
                customLabel.className = 'rt-npc-form-label';
                customLabel.textContent = 'Custom Archetype / Role *';
                customLabel.style.display = 'none';
                
                const customInput = document.createElement('input');
                customInput.className = 'rt-npc-form-input';
                customInput.type = 'text';
                customInput.placeholder = 'e.g. Mentor, Bartender, Guildmaster...';
                customInput.style.marginBottom = '8px';
                customInput.style.display = 'none';

                for (const { id, icon } of archetypes) {
                    const chip = document.createElement('div');
                    chip.className = 'rt-archetype-chip';
                    chip.innerHTML = `<span class="rt-archetype-chip-icon">${icon}</span> ${id}`;
                    chip.addEventListener('click', () => {
                        selectedArchetype = id;
                        
                        if (id === 'Custom') {
                            customLabel.style.display = 'block';
                            customInput.style.display = 'block';
                            customInput.value = '';
                            customInput.focus();
                        } else {
                            customLabel.style.display = 'none';
                            customInput.style.display = 'none';
                            customInput.value = id;
                        }
                        
                        for (const [cid, cel] of Object.entries(chipMap)) {
                            cel.classList.toggle('selected', cid === selectedArchetype);
                        }
                    });
                    grid.appendChild(chip);
                    chipMap[id] = chip;
                }
                
                customInput.addEventListener('input', () => {
                    selectedArchetype = customInput.value.trim();
                });

                archetypePanel.appendChild(grid);
                archetypePanel.appendChild(customLabel);
                archetypePanel.appendChild(customInput);

                const nameLabel = document.createElement('label');
                nameLabel.className = 'rt-npc-form-label';
                nameLabel.textContent = 'Name (optional)';
                const nameInput = document.createElement('input');
                nameInput.className = 'rt-npc-form-input';
                nameInput.type = 'text';
                nameInput.placeholder = 'Leave blank to let the AI choose';
                nameInput.style.marginBottom = '8px';

                const conceptLabel = document.createElement('label');
                conceptLabel.className = 'rt-npc-form-label';
                conceptLabel.textContent = 'Extra concept / prompt (optional)';
                const conceptInput = document.createElement('textarea');
                conceptInput.className = 'rt-npc-form-input';
                conceptInput.rows = 2;
                conceptInput.placeholder = 'e.g. ex-soldier, uses poison daggers, secretly a doppelganger…';
                conceptInput.style.marginBottom = '4px';

                const genBtn = document.createElement('button');
                genBtn.className = 'rt-npc-generate-btn';
                genBtn.textContent = '🤖 Generate NPC';
                genBtn.addEventListener('click', async () => {
                    const role = customInput.value.trim();
                    if (!role) { toastr['warning']('Please select or enter an archetype/role first.', 'NPC Creator'); return; }
                    genBtn.disabled = true;
                    genBtn.textContent = '⏳ Generating...';
                    try {
                        const generated = await generateNpcFromArchetype(
                            role, nameInput.value.trim(), conceptInput.value.trim(), existingNpcNames
                        );
                        if (!generated) return;
                        const nameFallback = nameInput.value.trim() || role;
                        await showNpcPreviewAndAdd(generated, nameFallback, 'NPC Creator');
                    } finally {
                        genBtn.disabled = false;
                        genBtn.textContent = '🤖 Generate NPC';
                    }
                });

                archetypePanel.appendChild(nameLabel);
                archetypePanel.appendChild(nameInput);
                archetypePanel.appendChild(conceptLabel);
                archetypePanel.appendChild(conceptInput);
                archetypePanel.appendChild(genBtn);
            }

            // Add to DOM
            document.body.appendChild(overlay);
        };

        const refreshBtn = agentPanel.querySelector('#rt-agent-manifest-refresh');
        if (refreshBtn) refreshBtn.addEventListener('click', () => refreshManifest('manual-button'));

        const activateBooksBtn = /** @type {HTMLButtonElement|null} */ (agentPanel.querySelector('#rt-agent-activate-books'));
        if (activateBooksBtn) activateBooksBtn.addEventListener('click', async () => {
            activateBooksBtn.disabled = true;
            const origOpacity = activateBooksBtn.style.opacity;
            activateBooksBtn.style.opacity = '1';
            try {
                const count = await activateCampaignBooks({ debugSource: 'manual:agent-activate-books' });
                toastr['success'](`Activated ${count} campaign lorebook${count === 1 ? '' : 's'}.`);
                await refreshManifest('manual-button');
            } catch (e) {
                toastr['error']('Failed to activate campaign lorebooks.');
            } finally {
                activateBooksBtn.disabled = false;
                activateBooksBtn.style.opacity = origOpacity;
            }
        });

        // Initial manifest load is deferred until the Lorebook Agent panel is opened.
        // refreshManifest() runs from the agent toggle handler and manual refresh button.

        /**
         * Shared slot bar: [[TAG: Name | [slot ×]... + | Keywords]]
         * Middle labels are editable + removable; a + button adds a new slot.
         * onFormatChange(newFmt) is called whenever the format string changes.
         */
        const buildSlotBar = (tagName, format, onFormatChange) => {
            const parseSegs = (fmt) => (fmt || 'Name | Description | Keywords').split('|').map(s => s.trim());
            const bar = document.createElement('div');
            bar.style.cssText = 'display:flex; flex-wrap:wrap; align-items:center; gap:2px; margin-bottom:2px; font-family:var(--rt-font-mono);';
            const chipSt = 'padding:1px 6px; border-radius:10px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.32); font-size:0.708em; white-space:nowrap; cursor:default; user-select:none;';
            const pipeSt = 'color:rgba(255,255,255,0.2); font-size:0.708em; padding:0 2px; user-select:none;';
            const brktSt = 'color:rgba(255,255,255,0.18); font-size:0.708em; user-select:none;';
            const inpSt = 'font-size:0.692em; padding:1px 4px; border-radius:10px; background:rgba(0,0,0,0.35); color:var(--rt-text); border:1px solid rgba(255,255,255,0.18); text-align:center; outline:none; min-width:28px; box-sizing:content-box;';
            const rmSt = 'display:inline-flex; align-items:center; justify-content:center; min-width:15px; min-height:15px; margin-left:1px; flex-shrink:0; border-radius:4px; background:rgba(255,80,80,0.12); border:1px solid rgba(255,120,120,0.28); color:#cc8888; font-size:0.72em; font-weight:bold; line-height:1; cursor:pointer; padding:0; box-sizing:border-box;';
            const addSt = 'display:inline-flex; align-items:center; justify-content:center; min-width:15px; min-height:15px; flex-shrink:0; border-radius:4px; background:rgba(0,255,170,0.08); border:1px solid rgba(0,255,170,0.32); color:var(--rt-accent); font-size:0.78em; font-weight:bold; line-height:1; cursor:pointer; padding:0 1px; margin:0 1px; box-sizing:border-box; opacity:0.95;';

            const renderBar = (currentFmt) => {
                bar.innerHTML = '';
                bar.dataset.fmt = currentFmt;
                const segs = parseSegs(currentFmt);
                const fixed0 = segs[0] || 'Name';
                const fixedEnd = segs[segs.length - 1] || 'Keywords';
                const middles = segs.length > 2 ? segs.slice(1, -1) : [];

                const open = document.createElement('span');
                open.style.cssText = brktSt;
                open.textContent = `[[${tagName}: `;
                bar.appendChild(open);

                const chip0 = document.createElement('span');
                chip0.style.cssText = chipSt;
                chip0.title = 'Fixed — always the entry name';
                chip0.textContent = fixed0;
                bar.appendChild(chip0);

                middles.forEach((label, idx) => {
                    const pipe = document.createElement('span');
                    pipe.style.cssText = pipeSt;
                    pipe.textContent = ' |';
                    bar.appendChild(pipe);

                    const wrap = document.createElement('span');
                    wrap.style.cssText = 'display:inline-flex; align-items:center; gap:1px;';

                    const inp = document.createElement('input');
                    inp.type = 'text';
                    inp.value = label;
                    inp.title = 'Rename this slot — the AI fills this section based on its name';
                    inp.style.cssText = inpSt;
                    inp.style.width = Math.max(28, label.length * 7) + 'px';
                    inp.addEventListener('input', () => { inp.style.width = Math.max(28, inp.value.length * 7) + 'px'; });
                    inp.addEventListener('change', () => {
                        const s = parseSegs(bar.dataset.fmt);
                        s[idx + 1] = inp.value.trim() || label;
                        const nf = s.join(' | ');
                        bar.dataset.fmt = nf;
                        onFormatChange(nf);
                    });
                    wrap.appendChild(inp);

                    const rmBtn = document.createElement('button');
                    rmBtn.style.cssText = rmSt;
                    rmBtn.title = 'Remove this slot';
                    rmBtn.textContent = '×';
                    rmBtn.addEventListener('click', () => {
                        const s = parseSegs(bar.dataset.fmt);
                        s.splice(idx + 1, 1);
                        const nf = s.join(' | ');
                        onFormatChange(nf);
                        renderBar(nf);
                    });
                    wrap.appendChild(rmBtn);
                    bar.appendChild(wrap);
                });

                const addBtn = document.createElement('button');
                addBtn.style.cssText = addSt;
                addBtn.title = 'Add a slot';
                addBtn.textContent = '+';
                addBtn.addEventListener('click', () => {
                    const s = parseSegs(bar.dataset.fmt);
                    s.splice(s.length - 1, 0, 'Slot');
                    const nf = s.join(' | ');
                    onFormatChange(nf);
                    renderBar(nf);
                });
                bar.appendChild(addBtn);

                const pipeLast = document.createElement('span');
                pipeLast.style.cssText = pipeSt;
                pipeLast.textContent = ' |';
                bar.appendChild(pipeLast);

                const chipLast = document.createElement('span');
                chipLast.style.cssText = chipSt;
                chipLast.title = 'Fixed — always comma-separated search keywords';
                chipLast.textContent = fixedEnd;
                bar.appendChild(chipLast);

                const close = document.createElement('span');
                close.style.cssText = brktSt;
                close.textContent = ']]';
                bar.appendChild(close);
            };
            renderBar(format);
            return bar;
        };

        const renderAgentModules = () => {
            const s = getSettings();
            const list = agentPanel.querySelector('#rt-agent-stock-modules-list');
            if (!list) return;
            list.innerHTML = '';

            Object.entries(s.routerModules || {}).forEach(([id, config]) => {
                // The 'world' module is now managed by the standalone World Progression panel
                // (Settings → World Progression). Hide it here to avoid confusion.
                if (id === 'world') return;
                const row = document.createElement('div');
                row.style.cssText = 'margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.05);';

                const header = document.createElement('div');
                header.style.cssText = 'display:flex; align-items:center; gap:4px; margin-bottom:3px;';
                header.innerHTML = `
                        <input type="checkbox" class="rt-agent-module-check" ${config.enabled ? 'checked' : ''} style="cursor:pointer; margin:0; flex-shrink:0;">
                        <span style="font-size:0.769em; font-weight:bold; opacity:0.7; flex:1;">${config.tag}</span>
                        <button class="rt-agent-module-reset" style="background:transparent; border:none; color:var(--rt-accent); cursor:pointer; font-size:0.692em; padding:0 4px; opacity:0.5;" title="Reset slots and instruction to default"><i class="fa-solid fa-arrow-rotate-left"></i></button>
                    `;
                header.querySelector('.rt-agent-module-check').addEventListener('change', (e) => {
                    const st = getSettings();
                    st.routerModules[id].enabled = (/** @type {HTMLInputElement} */ (e.target)).checked;
                    saveSettings();
                });
                header.querySelector('.rt-agent-module-reset').addEventListener('click', () => {
                    if (confirm(`Reset ${id.toUpperCase()} module slots and instruction to default?`)) {
                        const st = getSettings();
                        if (DEFAULT_MODULES[id]) {
                            if (id === 'npc') {
                                st.routerModules[id].instruction = buildNpcInstruction(st.npcMajorWords, st.npcMinorWords);
                            } else {
                                st.routerModules[id].instruction = DEFAULT_MODULES[id].instruction;
                            }
                            if (DEFAULT_MODULES[id].format != null) st.routerModules[id].format = DEFAULT_MODULES[id].format;
                            saveSettings();
                            renderAgentModules();
                        }
                    }
                });
                row.appendChild(header);

                row.appendChild(buildSlotBar(config.tag, config.format || 'Name | Description | Keywords', (nf) => {
                    const st = getSettings();
                    st.routerModules[id].format = nf;
                    saveSettings();
                }));

                const inst = document.createElement('textarea');
                inst.value = config.instruction || '';
                inst.rows = 2;
                inst.title = 'Instruction text — guidance about what to write in each slot';
                inst.style.cssText = 'width:100%; background:rgba(0,0,0,0.3); color:var(--rt-text); border:1px solid rgba(255,255,255,0.1); border-radius:3px; font-size:0.692em; padding:2px 4px; box-sizing:border-box; margin-top:2px; resize:vertical !important; min-height:38px; font-family:inherit;';
                inst.addEventListener('change', () => {
                    const st = getSettings();
                    st.routerModules[id].instruction = inst.value;
                    saveSettings();
                });
                row.appendChild(inst);
                list.appendChild(row);
            });
        };
        renderAgentModules();
        globalThis._rpgRenderAgentModules = renderAgentModules;

        const renderAgentCustomTags = () => {
            const s = getSettings();
            const list = agentPanel.querySelector('#rt-agent-custom-tags-list');
            if (!list) return;
            list.innerHTML = '';

            (s.routerCustomTags || []).forEach((tag, idx) => {
                const fmt = tag.format || 'Name | Description | Keywords';
                const row = document.createElement('div');
                row.style.cssText = 'margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.05);';

                const header = document.createElement('div');
                header.style.cssText = 'display:flex; align-items:center; gap:4px; margin-bottom:3px;';

                const tagInp = document.createElement('input');
                tagInp.type = 'text';
                tagInp.value = tag.tag;
                tagInp.placeholder = 'TAG';
                tagInp.style.cssText = 'width:60px; flex-shrink:0; background:rgba(0,0,0,0.3); color:var(--rt-text); border:1px solid rgba(255,255,255,0.1); border-radius:3px; font-size:0.769em; font-weight:bold; padding:1px 4px; box-sizing:border-box;';
                tagInp.addEventListener('change', () => {
                    const st = getSettings();
                    st.routerCustomTags[idx].tag = tagInp.value.toUpperCase();
                    saveSettings();
                });
                header.appendChild(tagInp);

                const spacer = document.createElement('span');
                spacer.style.flex = '1';
                header.appendChild(spacer);

                const delBtn = document.createElement('button');
                delBtn.style.cssText = 'background:#422; color:#f99; border:none; font-size:0.692em; cursor:pointer; padding:1px 6px; border-radius:3px;';
                delBtn.title = 'Delete this custom tag';
                delBtn.textContent = '✕';
                delBtn.addEventListener('click', () => {
                    const st = getSettings();
                    st.routerCustomTags.splice(idx, 1);
                    saveSettings();
                    renderAgentCustomTags();
                });
                header.appendChild(delBtn);
                row.appendChild(header);

                row.appendChild(buildSlotBar(tag.tag || 'CUSTOM', fmt, (nf) => {
                    const st = getSettings();
                    st.routerCustomTags[idx].format = nf;
                    saveSettings();
                }));

                const inst = document.createElement('textarea');
                inst.value = tag.instruction || '';
                inst.rows = 2;
                inst.placeholder = 'Instructions for this tag...';
                inst.title = 'Instruction text — guidance about what to write in each slot';
                inst.style.cssText = 'width:100%; background:rgba(0,0,0,0.3); color:var(--rt-text); border:1px solid rgba(255,255,255,0.1); border-radius:3px; font-size:0.692em; padding:2px 4px; box-sizing:border-box; margin-top:2px; resize:vertical !important; min-height:38px; font-family:inherit;';
                inst.addEventListener('change', () => {
                    const st = getSettings();
                    st.routerCustomTags[idx].instruction = inst.value;
                    saveSettings();
                });
                row.appendChild(inst);
                list.appendChild(row);
            });
        };

        const addTagBtn = agentPanel.querySelector('#rt-agent-add-custom-tag');
        if (addTagBtn) {
            addTagBtn.addEventListener('click', () => {
                const s = getSettings();
                if (!s.routerCustomTags) s.routerCustomTags = [];
                s.routerCustomTags.push({ tag: 'NEW_TAG', instruction: 'New instructions...', format: 'Name | Description | Keywords' });
                saveSettings();
                renderAgentCustomTags();
            });
        }
        renderAgentCustomTags();





        const maxAct = /** @type {HTMLInputElement} */ (agentPanel.querySelector('#rt-agent-router-max-activations'));
        if (maxAct) {
            maxAct.addEventListener('input', () => {
                const s = getSettings();
                s.routerMaxActivations = parseInt(maxAct.value) || 8;
                $('#rpg_tracker_router_max_activations').val(s.routerMaxActivations);
                saveSettings();
            });
        }

        const kwOverflowInp = /** @type {HTMLInputElement} */ (agentPanel.querySelector('#rt-agent-router-kw-overflow-cap'));
        if (kwOverflowInp) {
            kwOverflowInp.addEventListener('input', () => {
                const s = getSettings();
                s.routerMaxKeywordOverflow = parseInt(kwOverflowInp.value) || 0;
                $('#rpg_tracker_router_max_keyword_overflow').val(s.routerMaxKeywordOverflow);
                saveSettings();
            });
        }

        // Prefix is auto-derived from chat id — sync settings + agent footer readouts
        syncRouterPrefixDisplays(settings.routerCampaignPrefix || '');


        const maxTur = /** @type {HTMLInputElement} */ (agentPanel.querySelector('#rt-agent-router-max-turns'));
        if (maxTur) {
            maxTur.addEventListener('input', (e) => {
                const s = getSettings();
                s.routerMaxTurns = parseInt((/** @type {HTMLInputElement} */ (e.target)).value) || 5;
                $('#rpg_tracker_router_max_turns').val(s.routerMaxTurns);
                saveSettings();
            });
        }

        const agentPromptBtn = agentPanel.querySelector('#rt-agent-prompt-btn');
        if (agentPromptBtn) {
            agentPromptBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const btn = /** @type {HTMLElement} */ (e.currentTarget);
                const bar = /** @type {HTMLElement} */ (agentPanel.querySelector('#rt-agent-prompt-bar'));
                const isVisible = bar.style.display !== 'none';
                bar.style.display = isVisible ? 'none' : 'flex';
                btn.classList.toggle('active', !isVisible);
                if (!isVisible) {
                    const input = /** @type {HTMLElement} */ (agentPanel.querySelector('#rt-agent-prompt-input'));
                    if (input) input.focus();
                }
            });
        }

        const agentPromptSend = async () => {
            const input = /** @type {HTMLTextAreaElement} */ (agentPanel.querySelector('#rt-agent-prompt-input'));
            if (!input) return;
            const msg = input.value.trim();
            if (!msg) return;

            const s = getSettings();
            const dlInput = /** @type {HTMLInputElement} */ (agentPanel.querySelector('#rt-agent-prompt-context-val'));
            const lookback = dlInput ? (parseInt(dlInput.value) || 10) : (s.routerDirectLookback || 10);

            input.value = '';
            s.routerDirectPrompt = '';
            saveSettings();

            if (agentPromptBtn) agentPromptBtn.classList.remove('active');
            const bar = /** @type {HTMLElement} */ (agentPanel.querySelector('#rt-agent-prompt-bar'));
            if (bar) bar.style.display = 'none';

            const { chat } = SillyTavern.getContext();
            const combinedNarrative = getNarrativeBlocks(chat, -1, !!s.routerIncludeHidden);
            toastr['info']("Running agent with specific command...");
            await runRouterPass(combinedNarrative, msg, lookback, true);
        };

        const agentPromptSendBtn = agentPanel.querySelector('#rt-agent-prompt-send');
        if (agentPromptSendBtn) {
            agentPromptSendBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await agentPromptSend();
            });
        }

        const agentPromptInput = agentPanel.querySelector('#rt-agent-prompt-input');
        if (agentPromptInput) {
            agentPromptInput.addEventListener('input', (e) => {
                const s = getSettings();
                s.routerDirectPrompt = (/** @type {HTMLTextAreaElement} */ (e.target)).value;
                saveSettings();
            });
            agentPromptInput.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    agentPromptSend();
                }
            });
        }

        const agentPromptContextVal = agentPanel.querySelector('#rt-agent-prompt-context-val');
        if (agentPromptContextVal) {
            agentPromptContextVal.addEventListener('change', (e) => {
                const s = getSettings();
                s.routerDirectLookback = parseInt((/** @type {HTMLInputElement} */ (e.target)).value) || 10;
                saveSettings();
            });
        }

        const lookbackInp = /** @type {HTMLInputElement} */ (agentPanel.querySelector('#rt-agent-router-lookback'));
        if (lookbackInp) {
            lookbackInp.addEventListener('input', (e) => {
                const s = getSettings();
                s.routerLookback = parseInt((/** @type {HTMLInputElement} */ (e.target)).value) || 4;
                $('#rpg_tracker_router_lookback').val(s.routerLookback);
                saveSettings();
            });
        }

        // ── Lookback mode radio group ──
        const lookbackContainer = /** @type {HTMLElement} */ (agentPanel.querySelector('#rt-agent-router-lookback-container'));
        const applyPanelLookbackContainer = (mode) => {
            if (lookbackContainer) {
                const isFixed = mode === 'fixed';
                lookbackContainer.style.opacity = isFixed ? '1' : '0.35';
                lookbackContainer.style.pointerEvents = isFixed ? 'auto' : 'none';
            }
        };
        agentPanel.querySelectorAll('input[name="rt-lookback-mode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const s = getSettings();
                const mode = /** @type {HTMLInputElement} */ (radio).value;
                s.routerLookbackSinceLastRun  = mode === 'since_last_run';
                s.routerLookbackSinceLastUser = mode === 'since_last_user';
                applyPanelLookbackContainer(mode);

                // Sync settings drawer radio group
                const targetId = mode === 'since_last_run' ? 'rpg_tracker_router_lookback_since_last_run'
                    : mode === 'since_last_user' ? 'rpg_tracker_router_lookback_since_last_user'
                    : 'rpg_tracker_router_lookback_fixed';
                const drawerRadio = $(`#${targetId}`);
                if (drawerRadio.length) drawerRadio.prop('checked', true);
                // Apply drawer numeric row state
                const drawerRow = $('#rpg_tracker_router_lookback_numeric_row');
                if (drawerRow.length) {
                    drawerRow.css({ opacity: mode === 'fixed' ? '1' : '0.35', 'pointer-events': mode === 'fixed' ? 'auto' : 'none' });
                }
                saveSettings();
            });
        });


        // ── Include hidden messages ──
        const includeHiddenCheck = /** @type {HTMLInputElement} */ (agentPanel.querySelector('#rt-agent-router-include-hidden'));
        if (includeHiddenCheck) {
            includeHiddenCheck.addEventListener('change', () => {
                const s = getSettings();
                s.routerIncludeHidden = includeHiddenCheck.checked;
                $('#rpg_tracker_router_include_hidden').prop('checked', s.routerIncludeHidden);
                saveSettings();
            });
        }

        // ── Run-every counter ──
        const runEveryInput = /** @type {HTMLInputElement} */ (agentPanel.querySelector('#rt-agent-router-run-every'));
        if (runEveryInput) {
            runEveryInput.addEventListener('input', (e) => {
                const s = getSettings();
                s.routerRunEvery = parseInt((/** @type {HTMLInputElement} */ (e.target)).value) || 3;
                $('#rpg_tracker_router_run_every').val(s.routerRunEvery);
                saveSettings();
            });
        }

        // ── Agent pause button ──
        const agentPauseBtn = agentPanel.querySelector('#rt-agent-router-pause-btn');
        const agentPauseBanner = /** @type {HTMLElement} */ (agentPanel.querySelector('#rt-agent-pause-banner'));
        if (agentPauseBtn) {
            agentPauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const s = getSettings();
                s.routerPaused = !s.routerPaused;
                saveSettings();
                agentPauseBtn.textContent = s.routerPaused ? '▶' : '⏸';
                    /** @type {HTMLElement} */ (agentPauseBtn).title = s.routerPaused
                    ? 'Resume Agent (auto-runs paused)'
                    : 'Pause Agent (skip auto-runs)';
                    /** @type {HTMLElement} */ (agentPauseBtn).style.color = s.routerPaused ? '#ffa500' : '';
                if (agentPauseBanner) agentPauseBanner.textContent = s.routerPaused ? 'AGENT PAUSED' : '';
            });
        }



        const manualRunBtn = agentPanel.querySelector('#rt-agent-router-manual-run');
        if (manualRunBtn) {
            manualRunBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const s = getSettings();
                const { chat } = SillyTavern.getContext();
                const combinedNarrative = getNarrativeBlocks(chat, -1, !!s.routerIncludeHidden);
                toastr['info']("Starting manual research pass...");
                await runRouterPass(combinedNarrative, null, s.routerLookback || 4, true);
            });
        }

        const agentStopBtn = agentPanel.querySelector('#rt-agent-stop-btn');
        if (agentStopBtn) {
            agentStopBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                stopRouterPass();
            });
        }

        // ── Cleanup dropdown submenu ─────────────────────────────────────────────
        const cleanupBroomBtn = agentPanel.querySelector('#rt-agent-router-cleanup');
        const cleanupDropdown = agentPanel.querySelector('#rt-cleanup-dropdown');
        const cleanupRunBtn = agentPanel.querySelector('#rt-cleanup-run-btn');
        const cleanupSettingsToggle = agentPanel.querySelector('#rt-cleanup-settings-toggle');
        const cleanupSettingsPanel = agentPanel.querySelector('#rt-cleanup-settings-panel');
        const cleanupThresholdInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-cleanup-threshold-inp'));
        const cleanupEveryInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-cleanup-every-inp'));
        const cleanupUseThresholdChk = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-cleanup-use-threshold-chk'));
        const cleanupThresholdRow = /** @type {HTMLElement|null} */ (agentPanel.querySelector('#rt-cleanup-threshold-row'));

        if (cleanupBroomBtn && cleanupDropdown) {
            // Toggle dropdown on broom click
            cleanupBroomBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = cleanupDropdown.style.display !== 'none';
                cleanupDropdown.style.display = isOpen ? 'none' : 'block';
            });

            // Stop pointer/mouse/click propagation inside the dropdown (prevents header drag and outside-dismiss),
            // but pass through events on form controls so native spinner/focus behaviour is preserved.
            const _isFormControl = (/** @type {EventTarget|null} */ t) =>
                t instanceof Element && t.closest('input, select, textarea') !== null;
            cleanupDropdown.addEventListener('pointerdown', (e) => { if (!_isFormControl(e.target)) e.stopPropagation(); });
            cleanupDropdown.addEventListener('mousedown', (e) => { if (!_isFormControl(e.target)) e.stopPropagation(); });
            cleanupDropdown.addEventListener('click', (e) => e.stopPropagation());

            // Dismiss dropdown on outside click
            document.addEventListener('click', (e) => {
                if (!cleanupDropdown.parentElement?.contains(/** @type {Node} */(e.target))) {
                    cleanupDropdown.style.display = 'none';
                }
            });

            // "Run Cleanup" button — existing popup-then-run flow
            if (cleanupRunBtn) {
                cleanupRunBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    cleanupDropdown.style.display = 'none';

                    if (isRouterRunning()) {
                        // @ts-ignore
                        toastr.warning('Agent is already running.', 'Lorebook Agent');
                        return;
                    }

                    const { Popup } = SillyTavern.getContext();
                    const s = getSettings();
                    const threshold = s.routerCleanupTokenThreshold || 300;
                    const promptHtml = `
                            <div style="text-align: left; font-size: 0.9em; line-height: 1.4;">
                                <p>You are triggering a <b>Global Cleanup Mode</b> pass to consolidate all bloated lore entries (&gt;${threshold} tokens).</p>
                                <p style="margin-top: 8px;">Enter custom requirements for the global compression (e.g., <i>"Keep background lore detailed but condense quest status"</i>):</p>
                                <textarea id="rt-global-clean-instructions" style="width: 100%; height: 60px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 5px; font-size: 12px; box-sizing: border-box; resize: none; margin-top: 5px;" placeholder="Leave blank for standard cleanup..."></textarea>
                            </div>
                        `;

                    const choice = await Popup.show.confirm('🧹 Global Lorebook Cleanup', promptHtml, {
                        okButton: 'Clean All Bloated',
                        cancelButton: 'Cancel'
                    });

                    if (choice) {
                        const textarea = document.getElementById('rt-global-clean-instructions');
                        const customInstructions = textarea ? textarea.value.trim() : '';
                        let manualPrompt = '__CLEANUP__';
                        if (customInstructions) manualPrompt += `::::${customInstructions}`;
                        toastr['info']('Starting lorebook cleanup mode...', 'Lorebook Agent');
                        await runRouterPass(null, manualPrompt, null, true);
                    }
                });
            }

            // "⚙ Settings" toggle
            if (cleanupSettingsToggle && cleanupSettingsPanel) {
                cleanupSettingsToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = cleanupSettingsPanel.style.display !== 'none';
                    cleanupSettingsPanel.style.display = isOpen ? 'none' : 'block';
                });
            }

            // Threshold input → persists immediately
            if (cleanupThresholdInp) {
                cleanupThresholdInp.addEventListener('change', (e) => {
                    const s = getSettings();
                    const v = parseInt(/** @type {HTMLInputElement} */(e.target).value) || 300;
                    s.routerCleanupTokenThreshold = Math.max(50, Math.min(5000, v));
                        /** @type {HTMLInputElement} */ (e.target).value = String(s.routerCleanupTokenThreshold);
                    SillyTavern.getContext().saveSettingsDebounced();
                });
            }

            // Interval input → persists immediately
            if (cleanupEveryInp) {
                cleanupEveryInp.addEventListener('change', (e) => {
                    const s = getSettings();
                    const v = parseInt(/** @type {HTMLInputElement} */(e.target).value);
                    s.routerCleanupEvery = isNaN(v) ? 0 : Math.max(0, Math.min(100, v));
                        /** @type {HTMLInputElement} */ (e.target).value = String(s.routerCleanupEvery);
                    SillyTavern.getContext().saveSettingsDebounced();
                });
            }

            // Use-threshold checkbox → dims threshold row and persists
            if (cleanupUseThresholdChk && cleanupThresholdRow) {
                cleanupUseThresholdChk.addEventListener('change', () => {
                    const s = getSettings();
                    s.routerCleanupUseThreshold = cleanupUseThresholdChk.checked;
                    cleanupThresholdRow.style.opacity = cleanupUseThresholdChk.checked ? '1' : '0.35';
                    cleanupThresholdRow.style.pointerEvents = cleanupUseThresholdChk.checked ? 'auto' : 'none';
                    SillyTavern.getContext().saveSettingsDebounced();
                });
            }
        }

        // ── Lorebook Agent Detaching ──
        const detachBtn = /** @type {HTMLElement} */ (agentPanel.querySelector('#rt-agent-router-detach'));
        if (detachBtn) {
            const DETACHED_AGENT_KEY = 'rpg_tracker_agent_detached';
            const GEO_KEY = 'rpg_tracker_geometry_lorebook_agent';
            const isDetached = () => localStorage.getItem(DETACHED_AGENT_KEY) === 'true';

            /** @type {(() => void) | null} */
            let destroyAgentDraggable = null;

            const applyDetachedState = () => {
                if (isDetached()) {
                    agentPanel.classList.add('rt-detached-panel');
                    const isAgentVisible = localStorage.getItem('rpg_tracker_agent_visible') !== 'false';
                    agentPanel.style.display = isAgentVisible ? 'flex' : 'none'; // Respect saved visibility
                    document.body.appendChild(agentPanel);
                    syncRouterPrefixDisplays(getSettings().routerCampaignPrefix || '');
                    renderRouterUI(); // Ensure it's populated
                    refreshManifest();
                    const header = agentPanel.querySelector('.rpg-tracker-header');
                    if (header instanceof HTMLElement) {
                        destroyAgentDraggable = makeDraggable(agentPanel, header, GEO_KEY);
                    }
                    detachBtn.innerHTML = '↓';
                    detachBtn.title = 'Re-attach Lorebook Agent';

                    // Reset styling overrides set for docked mode
                    agentPanel.style.position = 'absolute';
                    agentPanel.style.boxShadow = '';
                    agentPanel.style.border = '';

                    // Restore geometry with off-screen protection
                    try {
                        const savedStr = localStorage.getItem(GEO_KEY);
                        const saved = savedStr ? JSON.parse(savedStr) : null;

                        let left = 100;
                        let top = 100;
                        let width = 300;
                        let height = 400;

                        if (saved && typeof saved.left === 'number') {
                            const isOffScreen = (
                                saved.left + 50 > window.innerWidth ||
                                saved.top + 50 > window.innerHeight ||
                                saved.left < -250 ||
                                saved.top < -50
                            );

                            if (!isOffScreen) {
                                left = saved.left;
                                top = saved.top;
                                if (saved.width) width = saved.width;
                                if (saved.height) height = saved.height;
                            }
                        }

                        agentPanel.style.left = left + 'px';
                        agentPanel.style.top = top + 'px';
                        agentPanel.style.width = width + 'px';
                        if (height) agentPanel.style.height = height + 'px';
                        agentPanel.style.right = 'auto';
                    } catch (e) {
                        agentPanel.style.left = '100px';
                        agentPanel.style.top = '100px';
                        agentPanel.style.width = '300px';
                    }

                    // Restore main panel view since agent is now detached
                    applyViewState();
                } else {
                    if (destroyAgentDraggable) {
                        destroyAgentDraggable();
                        destroyAgentDraggable = null;
                    }
                    agentPanel.classList.remove('rt-detached-panel');
                    panel.appendChild(agentPanel);
                    
                    // Style to cover the main panel content area when docked
                    agentPanel.style.left = '0';
                    agentPanel.style.top = '30px';
                    agentPanel.style.right = '0';
                    agentPanel.style.width = '100%';
                    agentPanel.style.height = 'calc(100% - 30px)';
                    agentPanel.style.position = 'absolute';
                    agentPanel.style.boxShadow = 'none';
                    agentPanel.style.border = 'none';
                    
                    detachBtn.innerHTML = '⧉';
                    detachBtn.title = 'Detach Lorebook Agent';

                    // Synchronize visibility of the main panel views
                    const isVisible = agentPanel.style.display !== 'none';
                    if (isVisible) {
                        const taEl = panel.querySelector('#rpg-tracker-memo');
                        const rvEl = panel.querySelector('#rpg-tracker-render');
                        if (taEl) taEl.style.display = 'none';
                        if (rvEl) rvEl.style.display = 'none';
                    } else {
                        applyViewState();
                    }
                }
                updateAgentBtnUI();
            };

            detachBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                localStorage.setItem('rpg_tracker_agent_visible', 'true');
                localStorage.setItem(DETACHED_AGENT_KEY, isDetached() ? 'false' : 'true');
                applyDetachedState();
            });

            // Initial apply
            if (isDetached()) {
                applyDetachedState();
            } else {
                // Ensure docked styles are applied initially
                agentPanel.style.left = '0';
                agentPanel.style.top = '30px';
                agentPanel.style.right = '0';
                agentPanel.style.width = '100%';
                agentPanel.style.height = 'calc(100% - 30px)';
                agentPanel.style.position = 'absolute';
                agentPanel.style.boxShadow = 'none';
                agentPanel.style.border = 'none';
            }
        }


    }

    // ── Lorebook Agent History Nav (← [LIVE] →) ─────────────────────────
    const agentNavBack = /** @type {HTMLButtonElement|null} */ (agentPanel.querySelector('#rt-agent-nav-back'));
    const agentNavFwd = /** @type {HTMLButtonElement|null} */ (agentPanel.querySelector('#rt-agent-nav-fwd'));
    const agentNavLabel = /** @type {HTMLElement|null} */ (agentPanel.querySelector('#rt-agent-nav-label'));

    const syncAgentNav = () => {
        const s = getSettings();
        const histLen = (s.routerHistory || []).length;
        const redoLen = _loreRedoStack.length;
        if (agentNavBack) agentNavBack.disabled = histLen === 0;
        if (agentNavFwd) agentNavFwd.disabled = redoLen === 0;
        if (agentNavLabel) {
            if (redoLen === 0) {
                agentNavLabel.textContent = '[ LIVE ]';
                agentNavLabel.title = 'Lorebook is at current live state';
            } else {
                agentNavLabel.textContent = `[ -${redoLen} ]`;
                agentNavLabel.title = `Rolled back ${redoLen} agent pass${redoLen !== 1 ? 'es' : ''} — use → to redo`;
            }
            agentNavLabel.classList.remove('clickable');
        }
    };

    /** Snapshot the current lorebook state for the books touched by the given history entry. */
    const captureCurrentLoreState = async (histEntry) => {
        const ctx = SillyTavern.getContext();
        const s = getSettings();
        const bookNames = Object.keys(histEntry.bookSnapshots || {});
        const bookSnapshots = {};
        for (const name of bookNames) {
            try {
                const book = await ctx.loadWorldInfo(name);
                if (book) bookSnapshots[name] = JSON.parse(JSON.stringify(book));
            } catch (_) { }
        }
        return {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            activeRouterKeys: JSON.parse(JSON.stringify(s.activeRouterKeys || [])),
            activeWorldKeys: JSON.parse(JSON.stringify(s.activeWorldKeys || [])),
            routerLastRunChatLength: s.routerLastRunChatLength ?? 0,
            bookSnapshots,
        };
    };

    if (agentNavBack) {
        agentNavBack.addEventListener('click', async () => {
            const s = getSettings();
            if (!(s.routerHistory || []).length) return;
            agentNavBack.disabled = true;
            if (agentNavFwd) agentNavFwd.disabled = true;
            const histEntry = s.routerHistory[0];
            const postPassState = await captureCurrentLoreState(histEntry);
            const ok = await rollbackRouterPass(0);
            if (ok) {
                _loreRedoStack.push({ prePassSnapshot: histEntry, postPassState });
            } else {
                toastr['error']('Rollback failed. Check console.', 'Lorebook Agent');
            }
            syncAgentNav();
            await refreshManifest();
        });
    }

    if (agentNavFwd) {
        agentNavFwd.addEventListener('click', async () => {
            if (!_loreRedoStack.length) return;
            if (agentNavBack) agentNavBack.disabled = true;
            agentNavFwd.disabled = true;
            const redoEntry = _loreRedoStack.pop();
            const ok = await reapplyRouterPass(redoEntry.prePassSnapshot, redoEntry.postPassState);
            if (!ok) {
                _loreRedoStack.push(redoEntry);
                toastr['error']('Redo failed. Check console.', 'Lorebook Agent');
            }
            syncAgentNav();
            await refreshManifest();
        });
    }

    // updateUndoLabel kept as alias so existing call-sites still compile
    const updateUndoLabel = syncAgentNav;
    // ── Active Keys Refresh Button & Toggle ────────────────────────────────
    const keysToggleBtn = agentPanel.querySelector('#rt-agent-keys-toggle');
    if (keysToggleBtn) {
        keysToggleBtn.addEventListener('click', (e) => {
            if (e.target.closest('#rt-agent-keys-refresh')) {
                return;
            }
            const s = getSettings();
            s.agentKeysCollapsed = !s.agentKeysCollapsed;
            localStorage.setItem('rpg_tracker_agent_keys_collapsed', String(s.agentKeysCollapsed));

            const keysContainer = agentPanel.querySelector('#rt-agent-router-active-keys');
            const chevron = agentPanel.querySelector('#rt-agent-keys-chevron');
            if (keysContainer) {
                keysContainer.style.display = s.agentKeysCollapsed ? 'none' : 'flex';
            }
            if (chevron) {
                chevron.style.transform = s.agentKeysCollapsed ? 'rotate(-90deg)' : '';
            }
        });
    }

    const keysRefreshBtn = agentPanel.querySelector('#rt-agent-keys-refresh');
    if (keysRefreshBtn) {
        keysRefreshBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            keysRefreshBtn.querySelector('i')?.classList.add('fa-spin');
            const _ctx = SillyTavern.getContext();
            if (typeof _ctx.updateWorldInfoList === 'function') {
                try { await _ctx.updateWorldInfoList(); } catch (_) { }
            }
            await renderRouterUI();
            keysRefreshBtn.querySelector('i')?.classList.remove('fa-spin');
        });
    }

    updateUndoLabel();

    // ── Last Run status display ────────────────────────────────────────────
    const lastRunEl = agentPanel.querySelector('#rt-agent-last-run');
    function formatLastRunRelative(epochMs) {
        if (!epochMs) return 'never';
        const sec = Math.floor((Date.now() - epochMs) / 1000);
        if (sec < 45) return 'just now';
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        return `${Math.floor(hr / 24)}d ago`;
    }
    function syncLastRunDisplay() {
        if (!lastRunEl) return;
        const s = getSettings();
        const runEvery = s.routerRunEvery || 3;
        const tick = getRouterTick();
        const lastRunAt = s.routerLastRunAt || 0;
        const parts = [`Last run: ${formatLastRunRelative(lastRunAt)}`];
        if (runEvery > 1) {
            const nextIn = Math.max(0, runEvery - tick);
            parts.push(`Next in: ${nextIn} msg${nextIn !== 1 ? 's' : ''}`);
        }
        lastRunEl.textContent = parts.join(' · ');
    }
    syncLastRunDisplay();

    document.addEventListener('rt_lore_agent_updated', async () => {
        saveSettings();
        // Flush ST's in-memory lorebook cache before re-rendering so that
        // loadWorldInfo() picks up the entries we just wrote via the HTTP API.
        const _ctx = SillyTavern.getContext();
        if (typeof _ctx.updateWorldInfoList === 'function') {
            try { await _ctx.updateWorldInfoList(); } catch (_) { }
        }
        await renderRouterUI();
        updateUndoLabel();
        syncLastRunDisplay();
    });

    document.addEventListener('rt_generation_tick', () => {
        syncLastRunDisplay();
    });

    // ── Lorebook Terminal Logic ──
    let _routerSteps = [];
    const terminal = agentPanel.querySelector('#rt-agent-router-terminal');
    const terminalClear = agentPanel.querySelector('#rt-agent-router-terminal-clear');
    const logClear = agentPanel.querySelector('#rt-agent-router-log-clear');

    document.addEventListener('rt_lore_agent_step', (e) => {
        const step = (/** @type {CustomEvent} */ (e)).detail;
        console.log('[RPG Tracker] rt_lore_agent_step event received. Type:', step?.type, 'Content:', step?.content, 'Terminal exists:', !!terminal);
        if (!terminal) {
            console.warn('[RPG Tracker] rt_lore_agent_step event ignored because terminal element is null/missing.');
            return;
        }

        if (step.type === 'start') {
            _routerSteps = [];
            _loreRedoStack = [];
            syncAgentNav();
            updateAgentStatusIndicator(true);
        }
        _routerSteps.push(step);

        terminal.innerHTML = renderLorebookTerminal(_routerSteps);
        terminal.scrollTop = terminal.scrollHeight;

        // Refresh Campaign Records after the pass fully completes — at this point
        // all applyAction writes and saveWorldInfo cache-busts are guaranteed done.
        if (step.type === 'finish' || step.type === 'error') {
            console.log(`[RPG Tracker] Lorebook Agent step "${step.type}" matched. Refreshing manifest...`);
            refreshManifest();
            updateAgentStatusIndicator(false);
            if (step.type === 'finish') {
                console.log('[RPG Tracker] Lorebook Agent pass finished. Invoking checkAndTriggerAutoGenerations...');
                checkAndTriggerAutoGenerations(refreshAll);
            }
        }
    });

    if (terminalClear) {
        terminalClear.addEventListener('click', () => {
            _routerSteps = [];
            if (terminal) terminal.innerHTML = '<div style="opacity: 0.4; font-size: 0.769em; font-style: italic;">Waiting for agent activity...</div>';
        });
    }

    if (logClear) {
        logClear.addEventListener('click', () => {
            const s = getSettings();
            s.routerLog = [];
            saveSettings();
            renderRouterUI();
        });
    }



    updateChatLinkUI();
    updatePanelStatus();

    // Handle manual edits to live memo
    const textarea = panel.querySelector('#rpg-tracker-memo');
    let _rawEditDebounce = null;
    textarea.addEventListener('input', (e) => {
        if (_historyViewIndex !== -1) return;
        const newText = /** @type {HTMLTextAreaElement} */ (e.target).value;
        settings.currentMemo = newText;
        settings.currentMemo = applyQuestSyncAndStripMemo(settings.currentMemo);

        panel.querySelector('#rpg-tracker-count').textContent = `~${Math.round(settings.currentMemo.length / 2.62)} tokens`;
        saveSettings();
        // Refresh the rendered view live so changes are visible without toggling modes
        clearTimeout(_rawEditDebounce);
        _rawEditDebounce = setTimeout(refreshRenderedView, 400);
    });

    // (RNG footer toggles removed; managed via settings.html)

    // View toggle (Raw ↔ Rendered)
    let _viewBtn = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-view-btn'));

    if (settings.renderedViewActive !== undefined) {
        _renderedViewActive = settings.renderedViewActive;
    } else {
        _renderedViewActive = true;
        settings.renderedViewActive = true;
    }

    function applyViewState() {
        const isAgentDetached = () => localStorage.getItem('rpg_tracker_agent_detached') === 'true';
        if (!isAgentDetached() && agentPanel && agentPanel.style.display !== 'none') {
            agentPanel.style.display = 'none';
        }

        const taEl = panel.querySelector('#rpg-tracker-memo');
        const rvEl = panel.querySelector('#rpg-tracker-render');
        const viewBtnEl = panel.querySelector('#rpg-tracker-view-btn');
        if (!taEl || !rvEl || !viewBtnEl) return;

        if (_renderedViewActive) {
            taEl.style.display = 'none';
            rvEl.style.display = 'block';
            viewBtnEl.textContent = '≡';
            viewBtnEl.title = 'Switch to Raw view';
            refreshRenderedView();
        } else {
            taEl.style.display = '';
            rvEl.style.display = 'none';
            viewBtnEl.textContent = '⊞';
            viewBtnEl.title = 'Switch to Rendered view';
        }
        if (typeof updateAgentBtnUI === 'function') {
            updateAgentBtnUI();
        }
    }

    applyViewState();

    _viewBtn.addEventListener('click', () => {
        _renderedViewActive = !_renderedViewActive;
        settings.renderedViewActive = _renderedViewActive;
        localStorage.setItem('rpg_tracker_rendered_view_active', String(_renderedViewActive));
        applyViewState();
    });

    // Portraits menu action
    panel.querySelector('#rpg-tracker-portraits-menu-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const ctx = SillyTavern.getContext();
        if (!ctx.callGenericPopup) return;

        const popupContent = `<div style="padding:10px;min-width:260px;">
            <b style="display:block;margin-bottom:8px;">🖼️ AI Portrait Actions</b>
            <div style="font-size:0.85em;opacity:0.8;margin-bottom:12px;">Choose an action to manage or generate portraits for active entities.</div>
        </div>`;

        const popupOpts = {
            okButton: false,
            cancelButton: 'Cancel',
            wide: false,
            customButtons: [
                { text: '✨ Auto-Generate Party Portraits', result: 1001, classes: ['menu_button'] },
                { text: '😈 Auto-Generate Enemy Portraits', result: 1003, classes: ['menu_button'] },
                { text: '🗑 Remove All Portraits', result: 1002, classes: ['menu_button', 'danger'] },
            ],
        };

        const choice = await ctx.callGenericPopup(popupContent, ctx.POPUP_TYPE?.TEXT ?? 1, '', popupOpts);
        if (choice === 1001) {
            await autoGeneratePartyPortraits(refreshRenderedView);
            if (typeof refreshManifest === 'function') void refreshManifest().catch(() => {});
        } else if (choice === 1002) {
            removeAllPortraits(refreshRenderedView);
            if (typeof refreshManifest === 'function') void refreshManifest().catch(() => {});
        } else if (choice === 1003) {
            await autoGenerateEnemyPortraits(refreshRenderedView);
            if (typeof refreshManifest === 'function') void refreshManifest().catch(() => {});
        }
    });

    // Delta toggle — also shows/hides the resize handle
    panel.querySelector('#rpg-tracker-delta-btn').addEventListener('click', () => {
        const deltaEl = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-delta'));
        const handleEl = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-delta-handle'));
        const isVisible = deltaEl.style.display !== 'none';
        deltaEl.style.display = isVisible ? 'none' : 'flex';
        handleEl.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            const h = loadDeltaHeight();
            deltaEl.style.height = h + 'px';
        }
    });

    // Delta clear button
    panel.querySelector('#rpg-tracker-delta-clear').addEventListener('click', () => {
        settings.lastDelta = '';
        const dp = document.getElementById('rpg-tracker-delta-content');
        if (dp) dp.innerHTML = '<span class="delta-empty">Log cleared.</span>';
        saveSettings();
    });

    // Delta resize handle drag
    setupDeltaResize(/** @type {HTMLElement} */(panel));

    // Collapse panel
    const toggleTrackerCollapse = () => {
        const s = getSettings();
        s.trackerCollapsed = !s.trackerCollapsed;
        localStorage.setItem('rpg_tracker_collapsed', String(s.trackerCollapsed));

        if (s.trackerCollapsed) {
            panel.classList.add('rt-panel-collapsed');
        } else {
            panel.classList.remove('rt-panel-collapsed');
        }

        const icon = panel.querySelector('#rpg-tracker-collapse-btn i');
        if (icon) {
            icon.className = s.trackerCollapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
        }
    };

    panel.querySelector('#rpg-tracker-collapse-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTrackerCollapse();
    });

    panel.querySelector('#rpg-tracker-header').addEventListener('dblclick', (e) => {
        if (e.target instanceof Element && e.target.closest('button, input, select, textarea')) return;
        toggleTrackerCollapse();
    });

    // Close panel
    panel.querySelector('#rpg-tracker-close-btn').addEventListener('click', () => {
        panel.style.display = 'none';
        localStorage.setItem('rpg_tracker_visible', 'false');
        settings.closeCount = (settings.closeCount || 0) + 1;
        // Only show toast on the 1st close and every 10th close thereafter
        if (settings.closeCount === 1 || settings.closeCount % 10 === 0) {
            toastr['info']('Tracker hidden. You can reopen it at any time from the Extensions (Wand) Menu.', 'RPG Tracker');
        }
        saveSettings();
    });

    // Context Debugger toggle
    panel.querySelector('#rpg-tracker-debug-btn').addEventListener('click', () => {
        toggleDebugViewer();
    });

    // Direct prompt toggle
    panel.querySelector('#rpg-tracker-prompt-btn').addEventListener('click', (e) => {
        const btn = /** @type {HTMLElement} */ (e.currentTarget);
        const bar = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-prompt-bar'));
        const isVisible = bar.style.display !== 'none';
        bar.style.display = isVisible ? 'none' : 'flex';
        btn.classList.toggle('active', !isVisible);
        if (!isVisible) /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-prompt-input')).focus();
    });

    // Direct prompt send
    const promptSend = async () => {
        const input = /** @type {HTMLTextAreaElement} */ (panel.querySelector('#rpg-tracker-prompt-input'));
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        panel.querySelector('#rpg-tracker-prompt-btn').classList.remove('active');
        const bar = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-prompt-bar'));
        if (bar) bar.style.display = 'none';
        await sendDirectPrompt(msg);
    };
    panel.querySelector('#rpg-tracker-prompt-send').addEventListener('click', promptSend);
    panel.querySelector('#rpg-tracker-prompt-input').addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); promptSend(); }
    });
    panel.querySelector('#rt-prompt-context-val').addEventListener('change', (e) => {
        settings.directPromptContext = parseInt(/** @type {HTMLInputElement} */(e.target).value) || 0;
        saveSettings();
    });

    // Manual update from panel button
    const manualUpdate = async (type = 'regular') => {
        const { chat, Popup } = SillyTavern.getContext();
        let narrative = "";
        let isFullAudit = false;
        let customLookbackN = null;

        if (type === 'regular') {
            narrative = getNarrativeBlocks(chat, -1);
        } else if (type === 'full') {
            isFullAudit = true;
        } else if (type === 'custom') {
            const count = await Popup.show.input("RPG Tracker", "How many messages back should I parse?", "5");
            if (!count || isNaN(parseInt(count))) return;
            customLookbackN = parseInt(count);
            narrative = getNarrativeBlocks(chat, customLookbackN);
        }

        if (type !== 'full' && !narrative) return toastr['info']("No assistant message to parse.", "RPG Tracker");

        toastr['info'](isFullAudit ? "Triggering Full Context Audit..." : "Triggering manual State Update...", "RPG Tracker");
        await runStateModelPass(narrative, isFullAudit, customLookbackN);
    };

    const updateBtn = panel.querySelector('#rpg-tracker-update-btn');
    const updateMenu = document.createElement('div');
    updateMenu.className = 'rt-update-menu';
    updateMenu.style.display = 'none';
    updateMenu.innerHTML = `
            <div class="rt-menu-item" id="rt-update-regular"><b>Regular Update</b><small>Since last user message</small></div>
            <div class="rt-menu-item" id="rt-update-custom"><b>Lookback Update</b><small>Last N messages</small></div>
            <div class="rt-menu-item" id="rt-update-full"><b>Full Context Audit</b><small>Re-examine whole history</small></div>
        `;
    panel.appendChild(updateMenu);

    updateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = updateMenu.style.display !== 'none';

        // Close all other menus possibly
        document.querySelectorAll('.rt-update-menu').forEach(m => /** @type {HTMLElement} */(m).style.display = 'none');

        if (!isVisible) {
            const rect = updateBtn.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            updateMenu.style.top = (rect.bottom - panelRect.top + 5) + 'px';
            if (rect.right < 190) {
                updateMenu.style.left = (rect.left - panelRect.left) + 'px';
                updateMenu.style.right = 'auto';
            } else {
                updateMenu.style.right = (panelRect.right - rect.right) + 'px';
                updateMenu.style.left = 'auto';
            }
            updateMenu.style.display = 'flex';

            const closeMenu = () => {
                updateMenu.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 10);
        }
    });

    updateMenu.querySelector('#rt-update-regular').addEventListener('click', () => manualUpdate('regular'));
    updateMenu.querySelector('#rt-update-custom').addEventListener('click', () => manualUpdate('custom'));
    updateMenu.querySelector('#rt-update-full').addEventListener('click', () => manualUpdate('full'));

    // ── Overflow menu (mobile) ────────────────────────────────────────────────
    const overflowBtn = panel.querySelector('#rt-overflow-btn');
    const overflowMenu = document.createElement('div');
    overflowMenu.className = 'rt-overflow-menu';
    overflowMenu.style.display = 'none';
    overflowMenu.innerHTML = `
        <div class="rt-overflow-section-header">Actions</div>
        <div class="rt-overflow-item" id="rt-ov-enable"><span class="rt-ov-icon">⏻</span><span id="rt-ov-enable-label">Enable / Disable</span></div>
        <div class="rt-overflow-item" id="rt-ov-pause"><span class="rt-ov-icon">⏸</span><span id="rt-ov-pause-label">Pause Tracker</span></div>
        <div class="rt-overflow-item" id="rt-ov-portraits"><span class="rt-ov-icon">🖼️</span><span>Portrait Actions</span></div>
        <div class="rt-overflow-section-header">Update State</div>
        <div class="rt-overflow-item" id="rt-ov-upd-regular"><span class="rt-ov-icon">🔄</span><span>Regular Update</span><small>Since last user message</small></div>
        <div class="rt-overflow-item" id="rt-ov-upd-custom"><span class="rt-ov-icon">🔄</span><span>Lookback Update</span><small>Last N messages</small></div>
        <div class="rt-overflow-item" id="rt-ov-upd-full"><span class="rt-ov-icon">🔄</span><span>Full Context Audit</span><small>Re-examine whole history</small></div>
    `;
    panel.appendChild(overflowMenu);

    overflowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = overflowMenu.style.display !== 'none';
        overflowMenu.style.display = 'none';
        if (!isVisible) {
            const rect = overflowBtn.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            overflowMenu.style.top = (rect.bottom - panelRect.top + 5) + 'px';
            overflowMenu.style.right = (panelRect.right - rect.right) + 'px';
            overflowMenu.style.left = 'auto';
            // Refresh dynamic labels
            const s = getSettings();
            const enableLabel = overflowMenu.querySelector('#rt-ov-enable-label');
            if (enableLabel) enableLabel.textContent = s.enabled ? 'Disable Tracker' : 'Enable Tracker';
            const pauseLabel = overflowMenu.querySelector('#rt-ov-pause-label');
            if (pauseLabel) pauseLabel.textContent = s.trackerPaused ? 'Resume Tracker' : 'Pause Tracker';
            overflowMenu.style.display = 'flex';
            const closeOv = () => { overflowMenu.style.display = 'none'; document.removeEventListener('click', closeOv); };
            setTimeout(() => document.addEventListener('click', closeOv), 10);
        }
    });

    const _ovClose = () => { overflowMenu.style.display = 'none'; };
    overflowMenu.querySelector('#rt-ov-enable').addEventListener('click', () => { _ovClose(); panel.querySelector('#rpg-tracker-enable-btn')?.click(); });
    overflowMenu.querySelector('#rt-ov-pause').addEventListener('click', () => { _ovClose(); panel.querySelector('#rpg-tracker-pause-btn')?.click(); });
    overflowMenu.querySelector('#rt-ov-portraits').addEventListener('click', () => { _ovClose(); panel.querySelector('#rpg-tracker-portraits-menu-btn')?.click(); });
    overflowMenu.querySelector('#rt-ov-upd-regular').addEventListener('click', () => { _ovClose(); manualUpdate('regular'); });
    overflowMenu.querySelector('#rt-ov-upd-custom').addEventListener('click', () => { _ovClose(); manualUpdate('custom'); });
    overflowMenu.querySelector('#rt-ov-upd-full').addEventListener('click', () => { _ovClose(); manualUpdate('full'); });

    // Link the settings button too if it's already rendered
    // For settings button, we'll keep it simple or just trigger regular
    $('#rpg_tracker_btn_update').off('click').on('click', () => manualUpdate('regular'));

    // Snapshot navigation
    panel.querySelector('#rpg-tracker-nav-back').addEventListener('click', () => navigateSnapshot(1));
    panel.querySelector('#rpg-tracker-nav-fwd').addEventListener('click', () => navigateSnapshot(-1));

    // Footer Expand/Collapse (Mobile)
    panel.querySelector('#rt-footer-expand-btn').addEventListener('click', () => {
        const footer = document.getElementById('rt-main-footer');
        if (footer) {
            footer.classList.toggle('rt-footer-expanded');
            const icon = footer.querySelector('#rt-footer-expand-btn i');
            if (icon) {
                if (footer.classList.contains('rt-footer-expanded')) {
                    icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
                } else {
                    icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
                }
            }
        }
    });

    // Restore via label click (Commit)
    panel.querySelector('#rpg-tracker-nav-label').addEventListener('click', () => {
        const s = getSettings();
        if (_historyViewIndex === -1) return;
        const snapshot = s.memoHistory[_historyViewIndex];
        if (snapshot === undefined) return;

        // Simply move the live pointer to this snapshot.
        // The history already contains all states — no need to archive currentMemo here.
        // Direct Prompt and runStateModelPass handle archiving when they produce new states.
        s.currentMemo = snapshot;
        s.historyIndex = _historyViewIndex;
        _historyViewIndex = -1;
        saveSettings();
        syncMemoView();
        toastr['success']('Historical state restored as LIVE.', 'RPG Tracker');
    });

    // Clear memo button
    panel.querySelector('#rpg-tracker-memo-clear').addEventListener('click', () => {
        if (confirm("Are you sure you want to clear the memory history and wipe the tracker?")) {
            settings.currentMemo = "";
            settings.prevMemo1 = "";
            settings.prevMemo2 = "";
            settings.memoHistory = [];
            settings.historyIndex = -1;
            settings.lastDelta = "";
            _historyViewIndex = -1;
            saveSettings();
            syncMemoView();
            const dp = document.getElementById('rpg-tracker-delta-content');
            if (dp) dp.innerHTML = '<span class="delta-empty">Log cleared.</span>';
            toastr['success']("RPG Tracker logic wiped.", "RPG Tracker");
        }
    });

    syncMemoView();
}

function navigateSnapshot(direction) {
    const s = getSettings();
    const L = s.historyIndex === undefined ? -1 : s.historyIndex;
    const maxIndex = s.memoHistory.length - 1;
    const maxPos = L === -1 ? maxIndex + 1 : maxIndex;

    let pos = L === -1
        ? (_historyViewIndex === -1 ? 0 : _historyViewIndex + 1)
        : (_historyViewIndex === -1 ? L : _historyViewIndex);

    pos += direction;

    if (pos < 0) pos = 0;
    if (pos > maxPos) pos = maxPos;

    _historyViewIndex = L === -1
        ? (pos === 0 ? -1 : pos - 1)
        : (pos === L ? -1 : pos);

    syncMemoView();
}

export function syncMemoView() {
    const s = getSettings();
    const textarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('rpg-tracker-memo'));
    const navLabel = document.getElementById('rpg-tracker-nav-label');
    const btnBack = /** @type {HTMLButtonElement|null} */ (document.getElementById('rpg-tracker-nav-back'));
    const btnFwd = /** @type {HTMLButtonElement|null} */ (document.getElementById('rpg-tracker-nav-fwd'));
    const counter = document.getElementById('rpg-tracker-count');
    if (!textarea || !navLabel) return;

    const histLen = s.memoHistory.length;
    const L = s.historyIndex === undefined ? -1 : s.historyIndex;
    const livePos = L === -1 ? 0 : L;
    const currentPos = L === -1
        ? (_historyViewIndex === -1 ? 0 : _historyViewIndex + 1)
        : (_historyViewIndex === -1 ? L : _historyViewIndex);

    const maxPos = L === -1 ? histLen : histLen - 1;

    if (_historyViewIndex === -1) {
        // LIVE stone
        textarea.value = s.currentMemo;
        textarea.readOnly = false;
        navLabel.classList.remove('clickable');
        navLabel.title = 'Current Live State';
    } else {
        // Snapshot stone
        const snapshot = s.memoHistory[_historyViewIndex];
        textarea.value = snapshot ?? '';
        textarea.readOnly = true;
        navLabel.classList.add('clickable');
        navLabel.title = 'Click to RESTORE this state as LIVE';
    }

    const distance = currentPos - livePos;
    if (distance === 0) {
        navLabel.textContent = '[ LIVE ]';
    } else if (distance > 0) {
        navLabel.textContent = `[ -${distance} 🔄 ]`;
    } else {
        navLabel.textContent = `[ +${Math.abs(distance)} 🔄 ]`;
    }

    btnBack.disabled = currentPos >= maxPos;
    btnFwd.disabled = currentPos <= 0;

    if (counter) {
        counter.textContent = `~${Math.round(textarea.value.length / 2.62)} tokens`;
    }

    // Update delta panel: always show the diff that created the currently-viewed state
    const deltaPanel = document.getElementById('rpg-tracker-delta-content');
    if (deltaPanel) {
        let deltaHtml = '';
        const activeIdx = (_historyViewIndex === -1) ? L : _historyViewIndex;

        if (activeIdx === -1) {
            deltaHtml = s.lastDelta || '<span class="delta-empty">No changes yet.</span>';
        } else {
            const current = s.memoHistory[activeIdx];
            const previous = s.memoHistory[activeIdx + 1] || '';
            deltaHtml = computeDelta(previous, current);
        }
        deltaPanel.innerHTML = deltaHtml;
    }

    // Keep settings.quests aligned with the live memo (rollback/restore only updates currentMemo).
    if (_historyViewIndex === -1) {
        const stripped = applyQuestSyncAndStripMemo(s.currentMemo);
        if (stripped !== s.currentMemo) {
            s.currentMemo = stripped;
            updateUIMemo(stripped);
        }
        void syncCombatProfile(s.currentMemo, s);
    }

    refreshRenderedView();
}

function updateUIMemo(text) {
    if (_historyViewIndex !== -1) return; // don't clobber snapshot view
    const textarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('rpg-tracker-memo'));
    if (textarea) textarea.value = text;
    const counter = document.getElementById('rpg-tracker-count');
    if (counter) counter.textContent = `~${Math.round(text.length / 2.62)} tokens`;
}

function updateAgentStatusIndicator(running) {
    const stopBtn = /** @type {HTMLElement} */ (document.getElementById('rt-agent-stop-btn'));
    const playBtn = /** @type {HTMLElement} */ (document.getElementById('rt-agent-router-manual-run'));
    if (stopBtn) stopBtn.style.display = running ? 'flex' : 'none';
    if (playBtn) playBtn.style.opacity = running ? '0.3' : '';
}

export function updateStatusIndicator(state) {
    const indicator = document.getElementById('rpg-tracker-status');
    const stopBtn = /** @type {HTMLElement} */ (document.getElementById('rpg-tracker-stop-btn'));
    if (!indicator) return;

    indicator.className = 'rpg-tracker-status-indicator ' + state;
    if (stopBtn) {
        stopBtn.style.display = (state === 'running') ? 'flex' : 'none';
    }
}

const RENDER_HINTS = {
    CHARACTER: {
        label: 'Entity Rows — HP Bars (Characters)',
        description: 'Each entity is one row with an HP bar. First line: "Name (Race/Class): cur/max HP". Sub-lines: Combat (BAB), Gear, Attr, Saves, Skills, Traits, Abilities, HD, Status.',
        example: 'Korgath Iron-Hide (Dwarven Warrior): 32/32 HP\nCombat: BAB: +2 | Ranged: +3 | Melee: +5\nGear: Volcanic Mace (+1 / 2d6+3), AC: 13 (Furs)\nAttr: STR 16 (+3), DEX 12 (+1), CON 16 (+3), INT 8 (-1), WIS 16 (+3), CHA 6 (-2)\nSaves: Fort +6 | Ref +1 | Will +1\nSkills: Athletics +5, Intimidation +4\nTraits: Darkvision (60 ft)\nAbilities: Second Wind (1/1), Action Surge (1/1)\nHD: d10 (2/2)\nStatus: Healthy'
    },
    COMBAT: {
        label: 'Entity Rows — HP Bars (Enemies)',
        description: 'Same entity-row format as Characters. Optionally starts with a "COMBAT ROUND N" header line. Each enemy: "Name (Type): cur/max HP". Sub-lines: Att/def, Saves, Abilities, Status.',
        example: 'COMBAT ROUND 1\nSkritch (Goblin Minion): 8/8 HP\nAtt/def: Pickaxe (+3 / 1d6+1 P) | Furs (AC: 12)\nSaves: Fort +0, Ref +2, Will +0\nAbilities: Nimble Escape (disengage as bonus action)\nStatus: Healthy\n\nGrak (Goblin Minion): 8/8 HP\nAtt/def: Jagged Stone (+3 / 1d4+1 B) | Furs (AC: 12)\nStatus: Healthy'
    },
    SPELLS: {
        label: 'Spell Pips — Slot Tracker',
        description: 'One line per spell level. Cantrips: comma-separated names. Slots: "Level N (available/max): Spell1, Spell2".',
        example: 'Cantrips: Guidance, Resistance\nLevel 1 (2/2): Cure Wounds, Shield of Faith\nLevel 2 (1/3): Hold Person, Silence'
    },
    INVENTORY: {
        label: 'Bullet Points — Item List',
        description: 'One item per line. Leading "- " dashes are stripped. Supports <font color=...> tags for rarity/class coloring.',
        example: '- <font color=#ff8000>Volcanic Mace (+1 / 2d6+3 Fire)</font>\n- <font color=#a335ee>Cloak of Displacement</font>\n- <font color=#0070dd>Healing Potion (Greater)</font> x2\n- <font color=#1eff00>Iron Buckler (AC +2)</font>\n- <font color=#aaaaaa>Rope (50 ft)</font>\n- 80 gold pieces'
    },
    ABILITIES: {
        label: 'Oval Pills — Trait Tags',
        description: 'Each line becomes a clickable pill. Text in parentheses (e.g. 10/15) is tracked as a resource. Supports <font color=...> tags.',
        example: '- Lay on Hands (10/15, Heal 1 HP per point)\n- Divine Sense (3/4, Detect celestials/fiends/undead)\n- <font color=#ffaa00>Hasted (Double speed, +2 AC)</font>\n- <font color=#ff5555>Poisoned (Disadvantage on attacks)</font>'
    }
};

// Row type options shared by both the custom field editor and the global sub-field rules list
const ROW_TYPE_OPTIONS = [
    ['pills', 'Pills (comma-separated chips)'],
    ['badge', 'Badge (single chip)'],
    ['highlight', 'Highlight (paren emphasis)'],
    ['hp_bar', 'HP Bar (X/Y progress)'],
    ['xp_bar', 'XP Bar (X/Y with optional level)'],
    ['kv', 'Key / Value pair'],
    ['text', 'Plain Text'],
];


/**
 * Rebuilds the system prompt by stripping out XML blocks that are
 * disabled in settings.syspromptModules.
 * @param {string} rawText
 * @returns {string}
 */
/**
 * Fetches the raw (unprocessed) base sysprompt text — either sysprompt.txt or
 * sysprompt_legacy.txt depending on settings — falling back to the bundled
 * RT_PROMPTS copy if the live file can't be fetched.
 * @param {Record<string, any>} [settingsOverride]
 * @returns {Promise<string>}
 */
export async function fetchBaseSyspromptRaw(settingsOverride = null) {
    const s = settingsOverride || getSettings();
    const fileName = s.diceFunctionTool ? 'sysprompt.txt' : 'sysprompt_legacy.txt';
    let content;
    try {
        const response = await fetch(`/scripts/extensions/third-party/${FOLDER_NAME}/${fileName}`);
        if (response.ok) {
            content = await response.text();
        } else {
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (err) {
        console.warn(`[Multihog Framework] fetchBaseSyspromptRaw: could not fetch ${fileName}, using fallback:`, err);
        content = RT_PROMPTS[fileName];
    }
    return content || '';
}

let _autoApplyTimer = null;
export async function autoApplySysprompt(force = false) {
    const s = getSettings();
    if (!force && (!s.enabled || s.customSysprompt)) return;

    const content = await fetchBaseSyspromptRaw(s);
    if (!content) return;

    const built = buildSysprompt(content);
    const mainTextarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('main_prompt_quick_edit_textarea'));
    if (mainTextarea) {
        mainTextarea.value = built;
        mainTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    // Re-layer any custom/unlocked Game Systems sections so they always survive a full rebuild
    // triggered by an unrelated settings change (e.g. toggling 24h time).
    await applyCustomSysprompts();
}

function scheduleAutoApply() {
    const s = getSettings();
    if (!s.enabled || s.customSysprompt) return;
    if (_autoApplyTimer) clearTimeout(_autoApplyTimer);
    _autoApplyTimer = setTimeout(() => { _autoApplyTimer = null; autoApplySysprompt(); }, 400);
}

export function buildSysprompt(rawText) {
    if (!rawText) return "";
    const s = getSettings();
    const mods = s.syspromptModules || {};
    const unlockedBaseTags = new Set(
        (s.customSyspromptLibrary || [])
            .filter(p => p.origin === 'unlocked_base' && p.baseTag)
            .map(p => p.baseTag)
    );

    // 1. Tag-based module stripping and Quest mode swap
    let content = rawText
        .replace(/<(\w[\w_-]*)>([\s\S]*?)<\/\1>/g, (match, tag) => {
            if (mods[tag] === false) {
                // If this tag has been "unlocked" for full customization in Game Systems,
                // leave a slot marker so applyCustomSysprompts() can reinsert the user's
                // override at this exact position instead of losing it or appending it elsewhere.
                return unlockedBaseTags.has(tag) ? `<!--GS_SLOT:${tag}-->` : '';
            }
            if (tag === 'relationship_tracking') {
                if (!s.npcRelationshipBars) return '';
                return `<relationship_tracking>\n${buildRelationshipTrackingSysprompt(getNpcRelationshipMax(s))}\n</relationship_tracking>`;
            }
            if (tag === 'rng_system' && !s.rngEnabled) {
                const contentOnly = match.replace(/<\/?rng_system>/g, '');
                let fallbackText = "To resolve actions, simulate a fair d20 roll internally and maintain all ROLL FORMAT rules.\n\n";
                let matchedFormat = false;
                if (contentOnly.includes('[ROLL FORMAT]')) {
                    const rollFormatMatch = contentOnly.match(/(\[ROLL FORMAT\][\s\S]*?)(?=\n\n\[FALLBACK\]|$)/i);
                    if (rollFormatMatch) {
                        fallbackText += rollFormatMatch[1].trim();
                        matchedFormat = true;
                    }
                } else {
                    const l4 = contentOnly.match(/4\.\s*(Output[\s\S]*?)(?=\n\n\[FALLBACK\]|$)/i);
                    if (l4) {
                        fallbackText += l4[1].replace(/5\.\s*/g, '').trim();
                        matchedFormat = true;
                    }
                }
                if (!matchedFormat) {
                    fallbackText += "Output rolls as `[ROLL: 1d20+Mod vs DC X (Result: Y) -> Outcome]` or `[ROLL: 1d20+Mod (Result: Y) -> Outcome]`.";
                }
                return `<rng_system>\n${fallbackText.trim()}\n</rng_system>`;
            }
            // Inject correct instructions for quests based on legacy mode
            if (tag === 'quests') {
                let instruction = QUESTS_NARRATOR;
                // Strip Mood guidance if Frustration is off
                if (!mods.questsFrustration) {
                    instruction = instruction.replace(/Use the MOOD field.*?\./g, '');
                }
                // Strip Difficulty guidance if Difficulty is off
                if (!mods.questsDifficulty) {
                    instruction = instruction.replace(/the difficulty \(Very Easy to Very Hard\), /g, '');
                    instruction = instruction.replace(/Assign an appropriate difficulty \(Very Easy to Very Hard\) based on the narrative stakes\. /g, '');
                }
                return `<quests>\n${instruction.trim()}\n</quests>`;
            }
            if (tag === 'end_of_output_footer') {
                let footerContent = match;
                if (s.use24hTime) {
                    footerContent = footerContent.replace(/\[HH:MM AM\/PM\]/g, '[HH:MM] (24-hour clock, NO AM/PM)');
                }
                if (s.useDdMmYyFormat) {
                    footerContent = footerContent.replace(/Day\s+\[X\]/g, '[DD/MM/YYYY]');
                }
                return footerContent;
            }
            return match;
        });

    // 2. Inject current module instructions
    const modulesText = buildModulesInstructionText(s);
    content = content.replace("{{modulesText}}", modulesText);

    // 3. Handle Quests Hardcore rules stripping (Narrator guidance)
    if (!mods.questsDeadlines) {
        // Strip deadline assignment rule and auto_fail guidance
        content = content.replace(/- Assign an in-world Deadline.*\n/g, '');
        content = content.replace(/- Set auto_fail to true for quests.*\n/g, '');
        content = content.replace(/- If a duration is given.* Day N.*\n/g, '');
    }
    if (!mods.questsFrustration) {
        // Strip frustration coefficient and mood rules
        content = content.replace(/- Set a frustration_coefficient.*\n/g, '');
        content = content.replace(/ {2}· 0\.4 = Very patient.*\n/g, '');
        content = content.replace(/ {2}· 1\.0 = Normal.*\n/g, '');
        content = content.replace(/ {2}· 3\.0 = Volatile.*\n/g, '');
        content = content.replace(/- The NPC Mood evolves continuously.*\n/g, '');
        // Also strip the 'past deadline' override rule — only applies when Frustration is active
        content = content.replace(/- If a quest is time-sensitive and the deadline passes.*\n/g, '');
    }

    if (!s.rngEnabled) {
        content = content
            .replace(/.*RollTheDice.*\n?/gi, '')
            .replace(/.*RNG_QUEUE v6.0_PROPER.*\n?/gi, '');
    }

    return content
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * Binds a Connection Manager profile dropdown when the element and extension are available.
 * @param {string} selector
 * @param {string} initialProfileId
 * @param {(profileId: string) => void} onProfileIdChange
 * @returns {boolean}
 */
function tryBindConnectionProfileDropdown(selector, initialProfileId, onProfileIdChange) {
    if (!$(selector).length) {
        console.warn(`[RPG Tracker] Connection profile dropdown not found: ${selector}`);
        return false;
    }
    const ctx = SillyTavern.getContext();
    const svc = ctx.ConnectionManagerRequestService;
    const cmDisabled = ctx.extensionSettings?.disabledExtensions?.includes('connection-manager');
    if (!svc?.handleDropdown || cmDisabled) return false;
    try {
        svc.handleDropdown(
            selector,
            initialProfileId || '',
            (profile) => onProfileIdChange(profile?.id || ''),
        );
        return true;
    } catch (e) {
        console.warn(`[RPG Tracker] Could not bind connection profile dropdown ${selector}:`, e);
        return false;
    }
}

/**
 * Initialization
 */
(async function init() {
    // Guard against double-init (e.g. browser serving a cached copy of this script
    // while the fresh copy also loads). Remove any stale panel/settings first.
    document.getElementById('rpg-tracker-panel')?.remove();
    document.querySelectorAll('.rpg-tracker-settings').forEach(el => el.remove());

    const ctx = SillyTavern.getContext();
    const { eventSource, event_types, renderExtensionTemplateAsync } = ctx;
    const pm = ctx.getPresetManager ? ctx.getPresetManager() : null;

    getSettings();
    migrateCustomFields();
    createPanel();

    try {
        // Load Settings UI using the dynamic folder name
        // Use a cache-busting parameter to ensure we get the fresh file from the server
        const html = await renderExtensionTemplateAsync(`third-party/${FOLDER_NAME}`, 'settings', { v: Date.now() });
        // Third-party plugins should go to extensions_settings2 (right column) if available
        if ($('#extensions_settings2').length) {
            $('#extensions_settings2').append(html);
        } else {
            $('#extensions_settings').append(html);
        }

        // Bind drawer toggles ONLY for our own content to avoid global conflicts
        $('.rpg-tracker-settings').on('click', '.inline-drawer-toggle', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const drawer = $(this).closest('.inline-drawer');
            const content = drawer.find('> .inline-drawer-content');
            drawer.toggleClass('open');
            content.stop(true, true).slideToggle(200);
            $(this).find('.inline-drawer-icon').toggleClass('down');
        });

        const settings = getSettings();

        // --- Version Upgrade Prompt Reset Dialog ---
        {
            let currentVersion = '3.8.5'; // Fallback
            try {
                const manifestUrl = new URL('./manifest.json', import.meta.url);
                const response = await fetch(manifestUrl);
                const manifest = await response.json();
                if (manifest && manifest.version) {
                    currentVersion = manifest.version;
                }
            } catch (e) {
                console.warn('[RPG Tracker] Could not fetch manifest.json for version check', e);
            }

            if (!settings.lastResetVersion) {
                // Fresh install - set version silently
                settings.lastResetVersion = currentVersion;
                saveSettings();
            } else if (settings.lastResetVersion !== currentVersion) {
                if (settings.autoResetPromptsOnUpdate) {
                    // Silently reset everything automatically
                    (async () => {
                        const { extensionSettings } = SillyTavern.getContext();
                        const fresh = getSettings();

                        // 1. Main System Prompt
                        fresh.customSysprompt = false;
                        const customSyspromptCb = document.getElementById('rpg_tracker_custom_sysprompt');
                        if (customSyspromptCb) {
                            customSyspromptCb.checked = false;
                            const narratorConfigBlock = document.getElementById('rpg_narrator_config_block');
                            if (narratorConfigBlock) narratorConfigBlock.style.display = '';
                        }
                        await autoApplySysprompt(true);

                        // 2. State Tracker
                        if (extensionSettings[MODULE_NAME]) {
                            delete extensionSettings[MODULE_NAME].systemPromptTemplate;
                            delete extensionSettings[MODULE_NAME].userPromptSuffix;
                        }
                        const sTempTracker = getSettings();
                        sTempTracker.stockPrompts = JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS));
                        const $corePromptEl = $('#rpg_tracker_core_prompt');
                        if ($corePromptEl.length) {
                            $corePromptEl.val(sTempTracker.systemPromptTemplate);
                        }
                        const $suffixPromptEl = $('#rpg_tracker_user_prompt_suffix');
                        if ($suffixPromptEl.length) {
                            $suffixPromptEl.val(sTempTracker.userPromptSuffix);
                        }
                        $('#rpg_tracker_npc_major_words').val(sTempTracker.npcMajorWords ?? 25);
                        $('#rpg_tracker_npc_minor_words').val(sTempTracker.npcMinorWords ?? 15);
                        $('#rpg_tracker_npc_rel_max_default').val(getNpcRelationshipMaxDefault(sTempTracker));
                        $('#rpg_tracker_npc_portraits').prop('checked', sTempTracker.npcPortraits !== false);
                        syncNpcPortraitDependentUi(sTempTracker);
                        $('#rpg_tracker_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                        $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                        $('#rpg_sysprompt_mod_time_ddmmyy').prop('checked', !!sTempTracker.useDdMmYyFormat);
                        $('#rpg_tracker_npc_card_import').prop('checked', !!sTempTracker.experimentalNpcImport);
                        $('#rpg_tracker_ignore_npc_limits').prop('checked', !!sTempTracker.ignoreNpcImportLimits);
                        if (typeof refreshOrderList === 'function') refreshOrderList();

                        // 3. Lorebook Agent
                        if (extensionSettings[MODULE_NAME]) {
                            delete extensionSettings[MODULE_NAME].routerSystemPromptTemplate;
                            delete extensionSettings[MODULE_NAME].routerModularPromptTemplate;
                        }
                        for (const [id, def] of Object.entries(DEFAULT_MODULES)) {
                            if (fresh.routerModules && fresh.routerModules[id]) {
                                if (id === 'npc') {
                                    fresh.routerModules[id].instruction = buildNpcInstruction(fresh.npcMajorWords, fresh.npcMinorWords, false);
                                } else {
                                    fresh.routerModules[id].instruction = def.instruction;
                                }
                                fresh.routerModules[id].format = def.format;
                            }
                        }
                        if (typeof globalThis._rpgRenderAgentModules === 'function') {
                            globalThis._rpgRenderAgentModules();
                        }
                        const sTemp = getSettings();
                        const $promptEl = $('#rpg_tracker_router_prompt');
                        if ($promptEl.length) {
                            $promptEl.val(sTemp.routerSystemPromptTemplate).trigger('input');
                            if (typeof (/** @type {any} */ ($promptEl)).trigger === 'function') {
                                (/** @type {any} */ ($promptEl)).trigger('autosize.resize');
                            }
                        }
                        const $modularEl = $('#rpg_tracker_router_modular_prompt');
                        if ($modularEl.length) {
                            $modularEl.val(sTemp.routerModularPromptTemplate).trigger('input');
                            if (typeof (/** @type {any} */ ($modularEl)).trigger === 'function') {
                                (/** @type {any} */ ($modularEl)).trigger('autosize.resize');
                            }
                        }

                        // 4. World Progression
                        if (extensionSettings[MODULE_NAME]) {
                            delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
                            delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;
                        }
                        const $wpPromptEl = $('#rpg_world_progression_system_prompt');
                        if ($wpPromptEl.length) {
                            $wpPromptEl.val(sTemp.worldProgressionSystemPrompt).trigger('input');
                        }
                        const $wpSkelPromptEl = $('#rpg_world_progression_skeleton_system_prompt');
                        if ($wpSkelPromptEl.length) {
                            $wpSkelPromptEl.val(sTemp.worldProgressionSkeletonSystemPrompt).trigger('input');
                        }

                        fresh.lastResetVersion = currentVersion;
                        saveSettings();
                        toastr['info'](`Prompts auto-updated to version ${currentVersion} defaults.`, 'RPG Tracker');
                        console.log(`[RPG Tracker] Automatically reset all prompts to defaults for version ${currentVersion}.`);
                    })();
                } else {
                    const { Popup } = SillyTavern.getContext();
                    if (Popup && Popup.show && Popup.show.confirm) {
                        // Run asynchronously so main extension init/loading is not blocked
                        (async () => {
                            // Wait a short moment for the UI to be fully drawn
                            await sleepMs(500);

                            const popupHtml = `
                                <div style="display:flex; flex-direction:column; gap:12px; text-align:left; font-size:13px; line-height:1.4; width:100%; box-sizing:border-box;">
                                    <div>A new version of <b>Multihog D&D Framework</b> has been installed (v<b>${escapeHtml(currentVersion)}</b>).</div>
                                    <div>Would you like to reset your custom prompts to the latest default versions? Select the prompts you wish to reset/update:</div>
                                    <div style="margin-left: 10px; display:flex; flex-direction:column; gap:8px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0;">
                                            <input type="checkbox" id="rt-reset-sysprompt" checked style="cursor:pointer;">
                                            <span>Main System Prompt</span>
                                        </label>
                                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0;">
                                            <input type="checkbox" id="rt-reset-tracker" checked style="cursor:pointer;">
                                            <span>State Tracker Prompts</span>
                                        </label>
                                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0;">
                                            <input type="checkbox" id="rt-reset-lorebook" checked style="cursor:pointer;">
                                            <span>Lorebook Agent Prompts</span>
                                        </label>
                                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0;">
                                            <input type="checkbox" id="rt-reset-world" checked style="cursor:pointer;">
                                            <span>World Progression Prompts</span>
                                        </label>
                                    </div>
                                    <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin: 2px 0;">
                                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; font-weight:bold; margin: 0;">
                                        <input type="checkbox" id="rt-reset-all" checked style="cursor:pointer;">
                                        <span>Reset/Update All</span>
                                    </label>
                                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; margin: 0; opacity: 0.85;">
                                        <input type="checkbox" id="rt-reset-always-auto" style="cursor:pointer;">
                                        <span>Always update everything automatically / Don't ask again</span>
                                    </label>
                                </div>
                            `;

                            // Synchronize checkbox toggles in the DOM
                            let sysReset = true;
                            let trackerReset = true;
                            let loreReset = true;
                            let worldReset = true;
                            let alwaysAuto = false;

                            setTimeout(() => {
                                const allCb = document.getElementById('rt-reset-all');
                                const sysCb = document.getElementById('rt-reset-sysprompt');
                                const trackerCb = document.getElementById('rt-reset-tracker');
                                const loreCb = document.getElementById('rt-reset-lorebook');
                                const worldCb = document.getElementById('rt-reset-world');
                                const alwaysCb = document.getElementById('rt-reset-always-auto');
                                const cbs = [sysCb, trackerCb, loreCb, worldCb];

                                if (sysCb) sysCb.addEventListener('change', () => { sysReset = sysCb.checked; });
                                if (trackerCb) trackerCb.addEventListener('change', () => { trackerReset = trackerCb.checked; });
                                if (loreCb) loreCb.addEventListener('change', () => { loreReset = loreCb.checked; });
                                if (worldCb) worldCb.addEventListener('change', () => { worldReset = worldCb.checked; });
                                if (alwaysCb) alwaysCb.addEventListener('change', () => { alwaysAuto = alwaysCb.checked; });

                                if (allCb) {
                                    allCb.addEventListener('change', () => {
                                        const val = allCb.checked;
                                        cbs.forEach(cb => { if (cb) cb.checked = val; });
                                        sysReset = val;
                                        trackerReset = val;
                                        loreReset = val;
                                        worldReset = val;
                                    });
                                }

                                cbs.forEach(cb => {
                                    if (cb) {
                                        cb.addEventListener('change', () => {
                                            if (allCb) {
                                                allCb.checked = cbs.every(c => c && c.checked);
                                            }
                                        });
                                    }
                                });
                            }, 150);

                            const confirmResult = await Popup.show.confirm('✨ Multihog D&D Framework Update', popupHtml, {
                                okButton: 'Yes (Reset Selected)',
                                cancelButton: 'No (Keep Custom)'
                            });

                            const fresh = getSettings();
                            if (alwaysAuto) {
                                fresh.autoResetPromptsOnUpdate = true;
                                const stCb = document.getElementById('rpg_tracker_auto_reset_prompts');
                                if (stCb) stCb.checked = true;
                            }

                            if (confirmResult) {
                                let resetCount = 0;

                                const { extensionSettings } = SillyTavern.getContext();

                                if (sysReset) {
                                    fresh.customSysprompt = false;
                                    const customSyspromptCb = document.getElementById('rpg_tracker_custom_sysprompt');
                                    if (customSyspromptCb) {
                                        customSyspromptCb.checked = false;
                                        const narratorConfigBlock = document.getElementById('rpg_narrator_config_block');
                                        if (narratorConfigBlock) narratorConfigBlock.style.display = '';
                                    }
                                    await autoApplySysprompt(true);
                                    resetCount++;
                                    console.log('[RPG Tracker] Main system prompt reset to defaults.');
                                }

                                if (trackerReset) {
                                    if (extensionSettings[MODULE_NAME]) {
                                        delete extensionSettings[MODULE_NAME].systemPromptTemplate;
                                        delete extensionSettings[MODULE_NAME].userPromptSuffix;
                                    }
                                    const sTempTracker = getSettings();
                                    sTempTracker.stockPrompts = JSON.parse(JSON.stringify(DEFAULT_STOCK_PROMPTS));
                                    const $corePromptEl = $('#rpg_tracker_core_prompt');
                                    if ($corePromptEl.length) {
                                        $corePromptEl.val(sTempTracker.systemPromptTemplate);
                                    }
                                    const $suffixPromptEl = $('#rpg_tracker_user_prompt_suffix');
                                    if ($suffixPromptEl.length) {
                                        $suffixPromptEl.val(sTempTracker.userPromptSuffix);
                                    }
                                    $('#rpg_tracker_npc_major_words').val(sTempTracker.npcMajorWords ?? 25);
                                    $('#rpg_tracker_npc_minor_words').val(sTempTracker.npcMinorWords ?? 15);
                                    $('#rpg_tracker_npc_rel_max_default').val(getNpcRelationshipMaxDefault(sTempTracker));
                                    $('#rpg_tracker_npc_portraits').prop('checked', sTempTracker.npcPortraits !== false);
                                    syncNpcPortraitDependentUi(sTempTracker);
                                    $('#rpg_tracker_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                                    $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!sTempTracker.npcRelationshipBars);
                                    $('#rpg_sysprompt_mod_time_ddmmyy').prop('checked', !!sTempTracker.useDdMmYyFormat);
                                    $('#rpg_tracker_npc_card_import').prop('checked', !!sTempTracker.experimentalNpcImport);
                                    $('#rpg_tracker_ignore_npc_limits').prop('checked', !!sTempTracker.ignoreNpcImportLimits);
                                    if (typeof refreshOrderList === 'function') refreshOrderList();
                                    resetCount++;
                                    console.log('[RPG Tracker] State tracker prompts reset to defaults.');
                                }

                                if (loreReset) {
                                    if (extensionSettings[MODULE_NAME]) {
                                        delete extensionSettings[MODULE_NAME].routerSystemPromptTemplate;
                                        delete extensionSettings[MODULE_NAME].routerModularPromptTemplate;
                                    }
                                    for (const [id, def] of Object.entries(DEFAULT_MODULES)) {
                                        if (fresh.routerModules && fresh.routerModules[id]) {
                                            if (id === 'npc') {
                                                fresh.routerModules[id].instruction = buildNpcInstruction(fresh.npcMajorWords, fresh.npcMinorWords, false);
                                            } else {
                                                fresh.routerModules[id].instruction = def.instruction;
                                            }
                                            fresh.routerModules[id].format = def.format;
                                        }
                                    }
                                    if (typeof globalThis._rpgRenderAgentModules === 'function') {
                                        globalThis._rpgRenderAgentModules();
                                    }
                                    const sTemp = getSettings();
                                    const $promptEl = $('#rpg_tracker_router_prompt');
                                    if ($promptEl.length) {
                                        $promptEl.val(sTemp.routerSystemPromptTemplate).trigger('input');
                                        if (typeof (/** @type {any} */ ($promptEl)).trigger === 'function') {
                                            (/** @type {any} */ ($promptEl)).trigger('autosize.resize');
                                        }
                                    }
                                    const $modularEl = $('#rpg_tracker_router_modular_prompt');
                                    if ($modularEl.length) {
                                        $modularEl.val(sTemp.routerModularPromptTemplate).trigger('input');
                                        if (typeof (/** @type {any} */ ($modularEl)).trigger === 'function') {
                                            (/** @type {any} */ ($modularEl)).trigger('autosize.resize');
                                        }
                                    }
                                    resetCount++;
                                    console.log('[RPG Tracker] Lorebook Agent prompts reset to defaults.');
                                }

                                if (worldReset) {
                                    if (extensionSettings[MODULE_NAME]) {
                                        delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
                                        delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;
                                    }
                                    const sTemp = getSettings();
                                    const $wpPromptEl = $('#rpg_world_progression_system_prompt');
                                    if ($wpPromptEl.length) {
                                        $wpPromptEl.val(sTemp.worldProgressionSystemPrompt).trigger('input');
                                    }
                                    const $wpSkelPromptEl = $('#rpg_world_progression_skeleton_system_prompt');
                                    if ($wpSkelPromptEl.length) {
                                        $wpSkelPromptEl.val(sTemp.worldProgressionSkeletonSystemPrompt).trigger('input');
                                    }
                                    resetCount++;
                                    console.log('[RPG Tracker] World progression prompts reset to defaults.');
                                }

                                fresh.lastResetVersion = currentVersion;
                                saveSettings();

                                if (resetCount > 0) {
                                    toastr['success'](`Successfully reset ${resetCount} prompt category/categories to defaults.`, 'RPG Tracker');
                                } else {
                                    toastr['info']('No prompts were selected for reset.', 'RPG Tracker');
                                }
                            } else {
                                fresh.lastResetVersion = currentVersion;
                                saveSettings();
                                toastr['info']('Custom prompts kept intact.', 'RPG Tracker');
                            }
                        })();
                    }
                }
            }
        }

        // --- Automatic Stock Prompt Synchronization ---
        // Always ensure stockPrompts exists — users without saved settings need defaults
        if (!settings.stockPrompts) settings.stockPrompts = { ...DEFAULT_STOCK_PROMPTS };
        {
            let changed = false;

            // Migrate from deprecated JSON/LogQuest quest mode to plain-text format
            const hasModernPrompt = settings.stockPrompts.quests?.includes('"updates"');
            const hasLegacyPrompt = settings.stockPrompts.quests?.includes('OBJ_ACTIVE')
                || settings.stockPrompts.quests_legacy?.includes('OBJ_ACTIVE');
            if (hasModernPrompt || !hasLegacyPrompt) {
                const migratedPrompt = (settings.stockPrompts.quests_legacy?.includes('OBJ_ACTIVE'))
                    ? settings.stockPrompts.quests_legacy
                    : DEFAULT_STOCK_PROMPTS.quests;
                settings.stockPrompts.quests = migratedPrompt;
                changed = true;
            }
            if (settings.stockPrompts.quests_legacy) {
                delete settings.stockPrompts.quests_legacy;
                changed = true;
            }
            if (settings.questLegacyMode !== undefined) {
                delete settings.questLegacyMode;
                changed = true;
            }

            // Legacy Quests: update if it's missing OBJ_TOTAL
            if (settings.stockPrompts.quests &&
                settings.stockPrompts.quests.includes('OBJ_ACTIVE') &&
                !settings.stockPrompts.quests.includes('OBJ_TOTAL')) {
                settings.stockPrompts.quests = DEFAULT_STOCK_PROMPTS.quests;
                changed = true;
            }

            // Fix "active only" quest prompt that caused models to drop completed quests before sync
            if (settings.stockPrompts.quests?.includes('active** quests only') ||
                settings.stockPrompts.quests?.includes('do not keep archived quests')) {
                refreshQuestPrompt(settings);
                changed = true;
            }

            if (changed) {
                saveSettings();
            }

            unregisterLogQuestTool();

            // Retroactive Log Cleanup: replace generic messages with more descriptive ones
            if (settings.routerLog && settings.routerLog.length > 0) {
                let cleaned = false;
                settings.routerLog.forEach(entry => {
                    if (entry.reason === "Tag-based update.") {
                        entry.reason = "Processed narrative entities (Legacy Log).";
                        cleaned = true;
                    }
                });
                if (cleaned) saveSettings();
            }
        }

        $('#rpg_tracker_enabled').prop('checked', settings.enabled).on('change', function () {
            settings.enabled = !!$(this).prop('checked');
            saveSettings();
            updatePanelStatus();
            if (!settings.enabled) {
                void resetCombatProfileOverride(settings);
            } else {
                scheduleAutoApply();
            }
        });

        $('#rpg_tracker_debug').prop('checked', settings.debugMode).on('change', function () {
            settings.debugMode = !!$(this).prop('checked');
            saveSettings();
        });
        $('#rpg_tracker_auto_reset_prompts').prop('checked', !!settings.autoResetPromptsOnUpdate).on('change', function () {
            settings.autoResetPromptsOnUpdate = !!$(this).prop('checked');
            saveSettings();
        });

        $('#rpg_tracker_enable_portraits').prop('checked', settings.enablePortraits !== false).on('change', function () {
            settings.enablePortraits = !!$(this).prop('checked');
            saveSettings();
            refreshRenderedView();
        });

        $('#rpg_portrait_generator_source').val(settings.portraitGeneratorSource || 'native').on('change', function () {
            settings.portraitGeneratorSource = String($(this).val());
            saveSettings();
            $('#rpg_tracker_pollinations_group').toggle(settings.portraitGeneratorSource === 'pollinations');
        });
        $('#rpg_tracker_pollinations_group').toggle((settings.portraitGeneratorSource || 'native') === 'pollinations');

        $('#rpg_tracker_portrait_skip_prompt').prop('checked', !!settings.portraitSkipPromptDialog).on('change', function () {
            settings.portraitSkipPromptDialog = !!$(this).prop('checked');
            saveSettings();
        });

        $('#rpg_tracker_portrait_auto_party').prop('checked', !!settings.portraitAutoGenerateParty).on('change', function () {
            settings.portraitAutoGenerateParty = !!$(this).prop('checked');
            saveSettings();
            if (settings.portraitAutoGenerateParty) {
                forceCheckAutoGenerations(refreshAll);
            }
        });

        $('#rpg_tracker_portrait_auto_enemies').prop('checked', !!settings.portraitAutoGenerateEnemies).on('change', function () {
            settings.portraitAutoGenerateEnemies = !!$(this).prop('checked');
            saveSettings();
            if (settings.portraitAutoGenerateEnemies) {
                forceCheckAutoGenerations(refreshAll);
            }
        });

        $('#rpg_tracker_portrait_auto_npcs').prop('checked', !!settings.portraitAutoGenerateNpcs).on('change', function () {
            if (settings.npcPortraits === false) return;
            settings.portraitAutoGenerateNpcs = !!$(this).prop('checked');
            saveSettings();
            if (settings.portraitAutoGenerateNpcs) {
                forceCheckAutoGenerations(refreshAll);
            }
        });

        $('#rpg_tracker_pollinations_key').val(settings.pollinationsApiKey || '').on('change', function () {
            settings.pollinationsApiKey = String($(this).val()).trim();
            saveSettings();
        });

        $('#rpg_tracker_inventory_worth_mode').val(settings.inventoryWorthMode || 'hover').on('change', function () {
            settings.inventoryWorthMode = String($(this).val());
            saveSettings();
            refreshRenderedView();
        });

        $('#rpg_tracker_show_total_value').prop('checked', settings.showTotalInventoryValue !== false).on('change', function () {
            settings.showTotalInventoryValue = !!$(this).prop('checked');
            saveSettings();
            refreshRenderedView();
        });

        const combatProfileSelect = $('#rpg_combat_connection_profile');
        const combatProfileGroup = $('#rpg_combat_profile_group');

        function updateCombatProfilePanel() {
            combatProfileGroup.toggle(!!settings.combatProfileAutoSwitch);
        }

        $('#rpg_tracker_combat_profile_auto_switch').prop('checked', !!settings.combatProfileAutoSwitch).on('change', async function () {
            settings.combatProfileAutoSwitch = !!$(this).prop('checked');
            updateCombatProfilePanel();
            saveSettings();
            if (!settings.combatProfileAutoSwitch) {
                await resetCombatProfileOverride(settings);
            } else {
                await syncCombatProfile(settings.currentMemo, settings);
            }
        });
        updateCombatProfilePanel();

        if (!tryBindConnectionProfileDropdown('#rpg_combat_connection_profile', settings.combatConnectionProfileId, (id) => {
            settings.combatConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                combatProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => combatProfileSelect.append($('<option></option>').val(p).text(p)));
                combatProfileSelect.val(settings.combatConnectionProfileId || '');
            });
            combatProfileSelect.on('change', function () {
                settings.combatConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        const combatPresetSelect = $('#rpg_combat_completion_preset');
        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            combatPresetSelect.empty().append('<option value="">-- Use Profile Preset --</option>');
            presets.forEach(p => combatPresetSelect.append($('<option></option>').val(p).text(p)));
            combatPresetSelect.val(settings.combatCompletionPresetId || '');
        } else {
            combatPresetSelect.empty().append('<option value="">-- Use Profile Preset --</option>');
            if (settings.combatCompletionPresetId) {
                combatPresetSelect.append($('<option></option>').val(settings.combatCompletionPresetId).text(settings.combatCompletionPresetId));
                combatPresetSelect.val(settings.combatCompletionPresetId);
            }
        }
        combatPresetSelect.on('change', function () {
            settings.combatCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });

        // RNG Help Popup Trigger (Settings)
        $('.rt-rng-help-icon').on('click', (e) => {
            e.stopPropagation();
            showRngExplanation();
        });

        $('#rpg_tracker_legacy_dice').prop('checked', settings.legacyDiceNaming).on('change', function () {
            settings.legacyDiceNaming = !!$(this).prop('checked');
            saveSettings();
            registerDiceFunctionTool();
            registerDiceSlashCommand();
            toastr['info']("Dice logic updated.", "RPG Tracker");
        });

        $('#rpg_tracker_dice_function_tool').prop('checked', settings.diceFunctionTool).on('change', function () {
            settings.diceFunctionTool = !!$(this).prop('checked');
            saveSettings();
            registerDiceFunctionTool();
        });

        $('#rpg_tracker_chat_link_enabled').on('change', function () {
            const s = getSettings();
            const turningOn = !!$(this).prop('checked');

            // If we're turning it on from the settings menu, just simulate the button click logic
            // but keep it simple here. The panel button is the primary toggle.
            s.chatLinkEnabled = turningOn;
            saveSettings();
            updateChatLinkUI();

            if (turningOn && _currentChatId) {
                const saved = s.chatStates?.[_currentChatId];
                if (saved && saved.currentMemo && s.currentMemo && s.currentMemo !== saved.currentMemo) {
                    // In settings we'll just do the safe silent restore if they checked the box
                    // because async confirms in jQuery 'change' events can be janky.
                    // The panel button handles the explicit decision better.
                    loadChatState(_currentChatId);
                } else {
                    const found = loadChatState(_currentChatId);
                    if (!found) saveChatState(_currentChatId);
                }
            }
        });

        $('#rpg_tracker_clear_chat_states').on('click', function () {
            const s = getSettings();
            const count = Object.keys(s.chatStates || {}).length;
            if (count === 0) return toastr['info']('No saved chat states to clear.', 'RPG Tracker');
            if (confirm(`Clear ALL ${count} saved chat state(s)?\n\nThis removes the auto-saved tracker data for every chat. Your current live state is unaffected.\n\nProceed?`)) {
                s.chatStates = {};
                saveSettings();
                toastr['success'](`Cleared ${count} chat state(s).`, 'RPG Tracker');
            }
        });

        // ─── Event Hooks ───
        eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
        eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
        eventSource.on(event_types.GENERATION_STOPPED, onGenerationEnded);
        if (event_types.MESSAGE_EDITED) eventSource.on(event_types.MESSAGE_EDITED, parseAndApplyNarrativeRelTags);
        if (event_types.MESSAGE_SWIPED) eventSource.on(event_types.MESSAGE_SWIPED, parseAndApplyNarrativeRelTags);

        // Auto-register the visual [REL:] tag hiding regex script
        ensureRelTagRegex();

        // ─── Chat Link ───
        // Bootstrap: restore state for whichever chat is already open (before CHAT_CHANGED can fire).
        sanitizeRouterState(settings);
        const bootChatId = ctx.chatId || ctx.getCurrentChatId?.() || null;
        _currentChatId = bootChatId;
        eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
        if (bootChatId && settings.chatLinkEnabled) {
            loadChatState(bootChatId);
        }
        // Always run activation when routerEnabled — regardless of chatLinkEnabled —
        // so the correct lorebook stack is live from the very first message.
        if (settings.routerEnabled && bootChatId) {
            _sessionBootstrapChatId = bootChatId;
            const bootBooks = settings.chatStates?.[bootChatId]?.campaignBooks;
            if (bootBooks?.length && typeof ctx.executeSlashCommandsWithOptions === 'function') {
                // Fast path: exact book list known — skip the slow registry scan.
                (async () => {
                    for (const name of bootBooks) {
                        await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${name}"`).catch(() => { });
                    }
                    const bootPrefix = getEffectiveRouterCampaignPrefix(bootChatId);
                    const worldBookName = bootPrefix ? `${bootPrefix}_World` : 'World';
                    if (settings.worldProgressionEnabled) {
                        await ctx.executeSlashCommandsWithOptions(`/world state=on silent=true "${worldBookName}"`).catch(() => { });
                    } else {
                        await ctx.executeSlashCommandsWithOptions(`/world state=off silent=true "${worldBookName}"`).catch(() => { });
                    }
                })();
            } else {
                // Fallback for first-time chats where no saved book list exists yet.
                _bootstrapSyncPromise = syncCampaignPrefixAndWorldsForChat(bootChatId, 'BOOTSTRAP')
                    .finally(() => { _bootstrapSyncPromise = null; });
            }
        }

        // ─── Dice System ───
        installInterceptor();
        installRouterInterceptor();

        // Ensure managed lorebook entries have disable:true so ST's native keyword
        // scanner never injects them. Deferred so F5 startup stays responsive.
        const s = getSettings();
        if (s.routerEnabled) {
            scheduleDeferred(() => {
                disableManagedEntries().catch(e => console.warn('[RPG Tracker] disableManagedEntries on init failed:', e));
            });
        }

        registerDiceFunctionTool();
        registerDiceSlashCommand();

        // ─── Quest System ───
        import('./quests.js').then(({ unregisterLogQuestTool, installQuestDebugTools, computeFrustration }) => {
            unregisterLogQuestTool();
            installQuestDebugTools();
            // Expose for renderQuestLog (renderer can't import dynamically)
            // getQuestMood is from memo-processor.js (no circular dep)
            globalThis.__rpgQuestUtils = { computeFrustration, getQuestMood };
        }).catch(e => console.error('[RPG Tracker] quests.js failed to load:', e));

        initializeDebugViewer();

        // Connection Settings
        const sourceSelect = $('#rpg_tracker_connection_source');
        const profileGroup = $('#rpg_tracker_profile_group');
        const profileSelect = $('#rpg_tracker_connection_profile');
        const ollamaGroup = $('#rpg_tracker_ollama_group');
        const openaiGroup = $('#rpg_tracker_openai_group');


        function updateConnectionPanels() {
            const source = sourceSelect.val();
            profileGroup.toggle(source === 'profile');
            ollamaGroup.toggle(source === 'ollama');
            openaiGroup.toggle(source === 'openai');
        }

        sourceSelect.val(settings.connectionSource).on('change', function () {
            settings.connectionSource = $(this).val();
            updateConnectionPanels();
            saveSettings();
        });
        updateConnectionPanels();

        // Ollama
        $('#rpg_tracker_ollama_url').val(settings.ollamaUrl).on('input', function () {
            settings.ollamaUrl = $(this).val();
            saveSettings();
        });
        const ollamaModelSelect = $('#rpg_tracker_ollama_model');
        ollamaModelSelect.val(settings.ollamaModel).on('change', function () {
            settings.ollamaModel = $(this).val();
            saveSettings();
        });

        async function refreshOllamaModelsList() {
            const url = $('#rpg_tracker_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                ollamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    ollamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                ollamaModelSelect.val(settings.ollamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                console.error("[RPG Tracker] Ollama fetch failed:", e);
                toastr['error']("Failed to fetch Ollama models. Check console.");
            }
        }
        $('#rpg_tracker_ollama_refresh').on('click', refreshOllamaModelsList);

        // OpenAI
        $('#rpg_tracker_openai_url').val(settings.openaiUrl).on('input', function () {
            settings.openaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_tracker_openai_key').val(settings.openaiKey).on('input', function () {
            settings.openaiKey = $(this).val();
            saveSettings();
        });

        const openaiModelSelect = $('#rpg_tracker_openai_model');
        const openaiModelManual = $('#rpg_tracker_openai_model_manual');

        // The effective model is: manual input (if filled) > dropdown selection
        function getOpenAIModel() {
            const manual = String(openaiModelManual.val() || '').trim();
            return manual || String(openaiModelSelect.val() || '') || '';
        }

        // Initialize: if saved model isn't in dropdown yet, show it in the manual field
        openaiModelManual.val(settings.openaiModel || '');
        openaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                // Dropdown selected — clear manual, save selection
                openaiModelManual.val('');
                settings.openaiModel = val;
            } else {
                settings.openaiModel = String(openaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        openaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) {
                // Manual overrides dropdown — deselect it visually
                openaiModelSelect.val('');
            }
            settings.openaiModel = manual || openaiModelSelect.val() || '';
            saveSettings();
        });

        async function refreshOpenAIModelsList() {
            const url = $('#rpg_tracker_openai_url').val();
            const key = $('#rpg_tracker_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models from endpoint...");
                const models = await fetchOpenAIModels(url, key);
                openaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) openaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                // Restore saved selection
                const saved = settings.openaiModel;
                if (saved && openaiModelSelect.find(`option[value="${saved}"]`).length) {
                    openaiModelSelect.val(saved);
                    openaiModelManual.val('');
                }
                toastr['success'](`${models.length} model(s) found.`);
            } catch (e) {
                console.error("[RPG Tracker] OpenAI fetch failed:", e);
                // Show a short toast; full details logged to console
                toastr['warning'](
                    "Cannot auto-detect models (CORS). Type the model name manually below, or enable enableCorsProxy: true in ST's config.yaml.",
                    "Model Sniffing Unavailable",
                    { timeOut: 8000 }
                );
            }
        }
        $('#rpg_tracker_openai_refresh').on('click', refreshOpenAIModelsList);

        $('#rpg_tracker_openai_test').on('click', async function () {
            const url = $('#rpg_tracker_openai_url').val();
            const key = $('#rpg_tracker_openai_key').val();
            const model = getOpenAIModel();
            if (!url) return toastr['info']("Enter the Endpoint URL first.");
            if (!model) return toastr['info']("Enter or select a model name first.");
            toastr['info']("Testing OpenAI connection...");
            const result = await testOpenAIConnection(url, key, model);
            if (result.success) {
                toastr['success'](result.message);
                await refreshOpenAIModelsList();
            } else {
                toastr['error'](result.message);
            }
        });



        // ── Portrait Connection Settings UI Bindings ──
        const portraitSourceSelect = $('#rpg_portrait_connection_source');
        const portraitProfileGroup = $('#rpg_portrait_profile_group');
        const portraitProfileSelect = $('#rpg_portrait_connection_profile');
        const portraitOllamaGroup = $('#rpg_portrait_ollama_group');
        const portraitOpenaiGroup = $('#rpg_portrait_openai_group');

        function updatePortraitConnectionPanels() {
            const source = portraitSourceSelect.val();
            portraitProfileGroup.toggle(source === 'profile');
            portraitOllamaGroup.toggle(source === 'ollama');
            portraitOpenaiGroup.toggle(source === 'openai');
        }

        portraitSourceSelect.val(settings.portraitConnectionSource || 'default').on('change', function () {
            settings.portraitConnectionSource = $(this).val();
            updatePortraitConnectionPanels();
            saveSettings();
        });
        updatePortraitConnectionPanels();

        // Ollama URL / Model
        $('#rpg_portrait_ollama_url').val(settings.portraitOllamaUrl || 'http://localhost:11434').on('input', function () {
            settings.portraitOllamaUrl = $(this).val();
            saveSettings();
        });
        const portraitOllamaModelSelect = $('#rpg_portrait_ollama_model');
        portraitOllamaModelSelect.val(settings.portraitOllamaModel).on('change', function () {
            settings.portraitOllamaModel = $(this).val();
            saveSettings();
        });
        $('#rpg_portrait_ollama_refresh').on('click', async function () {
            const url = $('#rpg_portrait_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                portraitOllamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    portraitOllamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                portraitOllamaModelSelect.val(settings.portraitOllamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                toastr['error']("Failed to fetch Ollama models.");
            }
        });

        // OpenAI URL / Key / Model
        $('#rpg_portrait_openai_url').val(settings.portraitOpenaiUrl).on('input', function () {
            settings.portraitOpenaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_portrait_openai_key').val(settings.portraitOpenaiKey).on('input', function () {
            settings.portraitOpenaiKey = $(this).val();
            saveSettings();
        });
        const portraitOpenaiModelSelect = $('#rpg_portrait_openai_model');
        const portraitOpenaiModelManual = $('#rpg_portrait_openai_model_manual');
        portraitOpenaiModelManual.val(settings.portraitOpenaiModel || '');
        portraitOpenaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                portraitOpenaiModelManual.val('');
                settings.portraitOpenaiModel = String(val);
            } else {
                settings.portraitOpenaiModel = String(portraitOpenaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        portraitOpenaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) portraitOpenaiModelSelect.val('');
            settings.portraitOpenaiModel = manual || String(portraitOpenaiModelSelect.val() || '') || '';
            saveSettings();
        });
        $('#rpg_portrait_openai_refresh').on('click', async function () {
            const url = $('#rpg_portrait_openai_url').val();
            const key = $('#rpg_portrait_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models...");
                const models = await fetchOpenAIModels(url, key);
                portraitOpenaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) portraitOpenaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                portraitOpenaiModelSelect.val(settings.portraitOpenaiModel);
                toastr['success']("Models updated.");
            } catch (e) {
                toastr['warning']("Cannot auto-detect models. Type manually.");
            }
        });

        // Profiles / Presets
        const portraitPresetSelect = $('#rpg_portrait_completion_preset');
        if (!tryBindConnectionProfileDropdown('#rpg_portrait_connection_profile', settings.portraitConnectionProfileId, (id) => {
            settings.portraitConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                portraitProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => portraitProfileSelect.append($('<option></option>').val(p).text(p)));
                portraitProfileSelect.val(settings.portraitConnectionProfileId || "");
            });
            portraitProfileSelect.on('change', function () {
                settings.portraitConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            portraitPresetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => portraitPresetSelect.append($('<option></option>').val(p).text(p)));
            portraitPresetSelect.val(settings.portraitCompletionPresetId || '');
        }
        portraitPresetSelect.on('change', function () {
            settings.portraitCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });

        // ── World Progression Connection Settings UI Bindings ──
        const worldSourceSelect = $('#rpg_world_connection_source');
        const worldProfileGroup = $('#rpg_world_profile_group');
        const worldProfileSelect = $('#rpg_world_connection_profile');
        const worldOllamaGroup = $('#rpg_world_ollama_group');
        const worldOpenaiGroup = $('#rpg_world_openai_group');

        function updateWorldConnectionPanels() {
            const source = worldSourceSelect.val();
            worldProfileGroup.toggle(source === 'profile');
            worldOllamaGroup.toggle(source === 'ollama');
            worldOpenaiGroup.toggle(source === 'openai');
        }

        worldSourceSelect.val(settings.worldConnectionSource || 'default').on('change', function () {
            settings.worldConnectionSource = $(this).val();
            updateWorldConnectionPanels();
            saveSettings();
        });
        updateWorldConnectionPanels();

        // Ollama URL / Model
        $('#rpg_world_ollama_url').val(settings.worldOllamaUrl || 'http://localhost:11434').on('input', function () {
            settings.worldOllamaUrl = $(this).val();
            saveSettings();
        });
        const worldOllamaModelSelect = $('#rpg_world_ollama_model');
        worldOllamaModelSelect.val(settings.worldOllamaModel).on('change', function () {
            settings.worldOllamaModel = $(this).val();
            saveSettings();
        });
        $('#rpg_world_ollama_refresh').on('click', async function () {
            const url = $('#rpg_world_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                worldOllamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    worldOllamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                worldOllamaModelSelect.val(settings.worldOllamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                toastr['error']("Failed to fetch Ollama models.");
            }
        });

        // OpenAI URL / Key / Model
        $('#rpg_world_openai_url').val(settings.worldOpenaiUrl).on('input', function () {
            settings.worldOpenaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_world_openai_key').val(settings.worldOpenaiKey).on('input', function () {
            settings.worldOpenaiKey = $(this).val();
            saveSettings();
        });
        const worldOpenaiModelSelect = $('#rpg_world_openai_model');
        const worldOpenaiModelManual = $('#rpg_world_openai_model_manual');
        worldOpenaiModelManual.val(settings.worldOpenaiModel || '');
        worldOpenaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                worldOpenaiModelManual.val('');
                settings.worldOpenaiModel = String(val);
            } else {
                settings.worldOpenaiModel = String(worldOpenaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        worldOpenaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) worldOpenaiModelSelect.val('');
            settings.worldOpenaiModel = manual || String(worldOpenaiModelSelect.val() || '') || '';
            saveSettings();
        });
        $('#rpg_world_openai_refresh').on('click', async function () {
            const url = $('#rpg_world_openai_url').val();
            const key = $('#rpg_world_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models...");
                const models = await fetchOpenAIModels(url, key);
                worldOpenaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) worldOpenaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                worldOpenaiModelSelect.val(settings.worldOpenaiModel);
                toastr['success']("Models updated.");
            } catch (e) {
                toastr['warning']("Cannot auto-detect models. Type manually.");
            }
        });

        // Profiles / Presets
        const worldPresetSelect = $('#rpg_world_completion_preset');
        if (!tryBindConnectionProfileDropdown('#rpg_world_connection_profile', settings.worldConnectionProfileId, (id) => {
            settings.worldConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                worldProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => worldProfileSelect.append($('<option></option>').val(p).text(p)));
                worldProfileSelect.val(settings.worldConnectionProfileId || "");
            });
            worldProfileSelect.on('change', function () {
                settings.worldConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            worldPresetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => worldPresetSelect.append($('<option></option>').val(p).text(p)));
            worldPresetSelect.val(settings.worldCompletionPresetId || '');
        }
        worldPresetSelect.on('change', function () {
            settings.worldCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });

        // ── Game System Wizard Connection Settings UI Bindings ──
        const gsWizardSourceSelect = $('#rpg_gs_wizard_connection_source');
        const gsWizardProfileGroup = $('#rpg_gs_wizard_profile_group');
        const gsWizardProfileSelect = $('#rpg_gs_wizard_connection_profile');
        const gsWizardOllamaGroup = $('#rpg_gs_wizard_ollama_group');
        const gsWizardOpenaiGroup = $('#rpg_gs_wizard_openai_group');

        function updateGsWizardConnectionPanels() {
            const source = gsWizardSourceSelect.val();
            gsWizardProfileGroup.toggle(source === 'profile');
            gsWizardOllamaGroup.toggle(source === 'ollama');
            gsWizardOpenaiGroup.toggle(source === 'openai');
        }

        gsWizardSourceSelect.val(settings.gameSystemWizardConnectionSource || 'default').on('change', function () {
            settings.gameSystemWizardConnectionSource = $(this).val();
            updateGsWizardConnectionPanels();
            saveSettings();
        });
        updateGsWizardConnectionPanels();

        $('#rpg_gs_wizard_ollama_url').val(settings.gameSystemWizardOllamaUrl || 'http://localhost:11434').on('input', function () {
            settings.gameSystemWizardOllamaUrl = $(this).val();
            saveSettings();
        });
        const gsWizardOllamaModelSelect = $('#rpg_gs_wizard_ollama_model');
        gsWizardOllamaModelSelect.val(settings.gameSystemWizardOllamaModel).on('change', function () {
            settings.gameSystemWizardOllamaModel = $(this).val();
            saveSettings();
        });
        $('#rpg_gs_wizard_ollama_refresh').on('click', async function () {
            const url = $('#rpg_gs_wizard_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                gsWizardOllamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    gsWizardOllamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                gsWizardOllamaModelSelect.val(settings.gameSystemWizardOllamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                toastr['error']("Failed to fetch Ollama models.");
            }
        });

        $('#rpg_gs_wizard_openai_url').val(settings.gameSystemWizardOpenaiUrl).on('input', function () {
            settings.gameSystemWizardOpenaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_gs_wizard_openai_key').val(settings.gameSystemWizardOpenaiKey).on('input', function () {
            settings.gameSystemWizardOpenaiKey = $(this).val();
            saveSettings();
        });
        const gsWizardOpenaiModelSelect = $('#rpg_gs_wizard_openai_model');
        const gsWizardOpenaiModelManual = $('#rpg_gs_wizard_openai_model_manual');
        gsWizardOpenaiModelManual.val(settings.gameSystemWizardOpenaiModel || '');
        gsWizardOpenaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                gsWizardOpenaiModelManual.val('');
                settings.gameSystemWizardOpenaiModel = String(val);
            } else {
                settings.gameSystemWizardOpenaiModel = String(gsWizardOpenaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        gsWizardOpenaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) gsWizardOpenaiModelSelect.val('');
            settings.gameSystemWizardOpenaiModel = manual || String(gsWizardOpenaiModelSelect.val() || '') || '';
            saveSettings();
        });
        $('#rpg_gs_wizard_openai_refresh').on('click', async function () {
            const url = $('#rpg_gs_wizard_openai_url').val();
            const key = $('#rpg_gs_wizard_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models...");
                const models = await fetchOpenAIModels(url, key);
                gsWizardOpenaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) gsWizardOpenaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                gsWizardOpenaiModelSelect.val(settings.gameSystemWizardOpenaiModel);
                toastr['success']("Models updated.");
            } catch (e) {
                toastr['warning']("Cannot auto-detect models. Type manually.");
            }
        });

        const gsWizardPresetSelect = $('#rpg_gs_wizard_completion_preset');
        if (!tryBindConnectionProfileDropdown('#rpg_gs_wizard_connection_profile', settings.gameSystemWizardConnectionProfileId, (id) => {
            settings.gameSystemWizardConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                gsWizardProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => gsWizardProfileSelect.append($('<option></option>').val(p).text(p)));
                gsWizardProfileSelect.val(settings.gameSystemWizardConnectionProfileId || "");
            });
            gsWizardProfileSelect.on('change', function () {
                settings.gameSystemWizardConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            gsWizardPresetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => gsWizardPresetSelect.append($('<option></option>').val(p).text(p)));
            gsWizardPresetSelect.val(settings.gameSystemWizardCompletionPresetId || '');
        }
        gsWizardPresetSelect.on('change', function () {
            settings.gameSystemWizardCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });

        // Advanced Options
        const sinceLastUserChk = $('#rpg_tracker_lookback_since_last_user');
        const lookbackNumericRow = $('#rpg_tracker_lookback_numeric_row');
        const lookbackInput = $('#rpg_tracker_lookback_messages');

        const applySinceLastUserUI = (enabled) => {
            lookbackNumericRow.css({ opacity: enabled ? '0.35' : '1', 'pointer-events': enabled ? 'none' : 'auto' });
        };

        if (sinceLastUserChk.length) {
            const isEnabled = settings.lookbackSinceLastUser !== false; // default true
            sinceLastUserChk.prop('checked', isEnabled);
            applySinceLastUserUI(isEnabled);
            sinceLastUserChk.on('change', function () {
                settings.lookbackSinceLastUser = !!$(this).prop('checked');
                applySinceLastUserUI(settings.lookbackSinceLastUser);
                saveSettings();
            });
        }
        if (lookbackInput.length) {
            lookbackInput.val(settings.lookbackMessages !== undefined ? settings.lookbackMessages : 2).on('input', function () {
                settings.lookbackMessages = parseInt(/** @type {string} */($(this).val())) || 2;
                saveSettings();
            });
        }
        const historyCountInput = $('#rpg_tracker_history_count');
        if (historyCountInput.length) {
            historyCountInput.val(settings.trackerHistoryCount !== undefined ? settings.trackerHistoryCount : 1).on('input', function () {
                settings.trackerHistoryCount = parseInt(/** @type {string} */($(this).val())) || 1;
                saveSettings();
            });
        }
        const fullAuditMaxTokensInput = $('#rpg_tracker_full_audit_max_tokens');
        if (fullAuditMaxTokensInput.length) {
            fullAuditMaxTokensInput.val(settings.fullAuditMaxTokens !== undefined ? settings.fullAuditMaxTokens : 32000).on('input', function () {
                settings.fullAuditMaxTokens = parseInt(/** @type {string} */($(this).val())) || 32000;
                saveSettings();
            });
        }
        const stateRunEveryInput = $('#rpg_tracker_state_run_every');
        if (stateRunEveryInput.length) {
            stateRunEveryInput.val(settings.stateTrackerRunEvery !== undefined ? settings.stateTrackerRunEvery : 1).on('input', function () {
                settings.stateTrackerRunEvery = Math.max(1, parseInt(/** @type {string} */($(this).val())) || 1);
                saveSettings();
            });
        }
        const stateSwipeRollbackCb = $('#rpg_tracker_state_swipe_rollback');
        if (stateSwipeRollbackCb.length) {
            stateSwipeRollbackCb.prop('checked', settings.stateTrackerSwipeRollback !== false).on('change', function () {
                settings.stateTrackerSwipeRollback = $(this).prop('checked');
                saveSettings();
            });
        }



        // ── Lorebook Context UI ──
        async function refreshLorebookList() {
            const $container = $('#rpg_tracker_lorebook_list');
            $container.empty();
            const stCtx = SillyTavern.getContext();
            let worldNames = [];
            try {
                worldNames = stCtx.getWorldInfoNames?.() ?? [];

                // If empty, the in-memory world_names may not be populated yet.
                // Force a backend refresh and retry.
                if (!worldNames.length && stCtx.updateWorldInfoList) {
                    if (settings.debugMode) console.log('[RPG Tracker] world_names empty — forcing backend refresh…');
                    await stCtx.updateWorldInfoList();
                    worldNames = stCtx.getWorldInfoNames?.() ?? [];
                }

                // Final fallback: direct backend fetch (covers edge cases and older ST versions)
                if (!worldNames.length) {
                    if (settings.debugMode) console.log('[RPG Tracker] world_names still empty — falling back to direct API fetch…');
                    try {
                        const resp = await fetch('/api/settings/get', {
                            method: 'POST',
                            headers: stCtx.getRequestHeaders(),
                            body: JSON.stringify({}),
                        });
                        if (resp.ok) {
                            const data = await resp.json();
                            worldNames = data.world_names ?? [];
                        }
                    } catch (fetchErr) {
                        console.warn('[RPG Tracker] Direct world_names fetch failed:', fetchErr);
                    }
                }
            } catch (e) {
                console.warn('[RPG Tracker] getWorldInfoNames() failed:', e);
            }

            if (!worldNames || worldNames.length === 0) {
                $container.append('<i style="opacity:0.6;">No lorebooks found.</i>');
                return;
            }

            const currentFilter = settings.lorebookFilter || [];
            const sortedBooks = [...worldNames].sort();

            sortedBooks.forEach(bookName => {
                const isChecked = currentFilter.includes(bookName);
                const $item = $(`<label class="checkbox_label" style="font-size: 0.9em;">
                        <input type="checkbox" data-book="${bookName}" ${isChecked ? 'checked' : ''} />
                        <span>${bookName}</span>
                    </label>`);

                $item.find('input').on('change', function () {
                    const book = $(this).data('book');
                    if (!Array.isArray(settings.lorebookFilter)) settings.lorebookFilter = [];
                    if ($(this).prop('checked')) {
                        if (!settings.lorebookFilter.includes(book)) {
                            settings.lorebookFilter.push(book);
                        }
                    } else {
                        settings.lorebookFilter = settings.lorebookFilter.filter(b => b !== book);
                    }
                    saveSettings();
                });
                $container.append($item);
            });
        }

        $('#rpg_tracker_ctx_worldinfo').prop('checked', settings.ctxWorldInfo ?? false).on('change', async function () {
            settings.ctxWorldInfo = !!$(this).prop('checked');
            if (settings.ctxWorldInfo) await refreshLorebookList();
            $('#rpg_tracker_lorebook_filter_group').toggle(settings.ctxWorldInfo);
            saveSettings();
        }).trigger('change');

        $('#rpg_tracker_lorebook_list_refresh').on('click', async function () {
            await refreshLorebookList();
        });

        // Panel Layout Mode (Stacked vs Tab Mode)
        const layoutModeSeg = document.getElementById('rpg_tracker_layout_mode_seg');
        if (layoutModeSeg) {
            syncSegToggle(layoutModeSeg, settings.panelLayoutMode || 'stack');
            layoutModeSeg.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    settings.panelLayoutMode = btn.dataset.value;
                    saveSettings();
                    syncSegToggle(layoutModeSeg, settings.panelLayoutMode);
                    refreshRenderedView();
                });
            });
        }

        // Theme Select + Wizard
        const themeSelect = $('#rpg_tracker_theme_select');
        themeSelect.val(settings.trackerTheme || 'rt-theme-native');

        const wizardBlock = document.getElementById('rpg_tracker_theme_wizard_block');
        const showHideWizard = (theme) => {
            if (wizardBlock) wizardBlock.style.display = theme === 'rt-theme-custom' ? 'block' : 'none';
        };
        showHideWizard(settings.trackerTheme || 'rt-theme-native');

        // Theme Wizard buttons
        document.getElementById('rpg_tracker_theme_generate')?.addEventListener('click', () => {
            openThemeWizard(false);
        });
        document.getElementById('rpg_tracker_theme_iterate')?.addEventListener('click', () => {
            if (!settings.customTheme) {
                toastr['info']('No custom theme to iterate on. Generating a new one instead.', 'Theme Wizard');
                openThemeWizard(false);
            } else {
                openThemeWizard(true);
            }
        });

        // Restore saved custom theme on settings load
        if (settings.customTheme) applyCustomTheme(settings.customTheme);

        themeSelect.on('change', function () {
            const newTheme = String($(this).val());
            settings.trackerTheme = newTheme;
            saveSettings();
            showHideWizard(newTheme);
            const panel = document.getElementById('rpg-tracker-panel');
            if (panel) {
                const isCollapsed = panel.classList.contains('rt-panel-collapsed');
                panel.className = `rpg-tracker-panel ${isCollapsed ? 'rt-panel-collapsed ' : ''}${newTheme}`;
                if (!settings.enabled) panel.classList.add('is-disabled');
            }
            document.querySelectorAll('.rpg-tracker-detached-panel, .rpg-tracker-agent-panel').forEach(dp => {
                const isCollapsed = dp.classList.contains('rt-panel-collapsed');
                dp.className = dp.classList.contains('rpg-tracker-agent-panel')
                    ? `rpg-tracker-panel rpg-tracker-agent-panel ${isCollapsed ? 'rt-panel-collapsed ' : ''}${newTheme}`
                    : `rpg-tracker-panel rpg-tracker-detached-panel ${isCollapsed ? 'rt-panel-collapsed ' : ''}${newTheme}`;
                if (!settings.enabled) dp.classList.add('is-disabled');
            });
        });

        document.getElementById('rpg_tracker_theme_save')?.addEventListener('click', () => {
            if (!settings.customTheme) {
                toastr['warning']('No custom theme to save. Generate one first!', 'Theme Wizard');
                return;
            }
            const name = prompt('Enter a name for this theme:', 'My Custom Theme');
            if (name && name.trim()) {
                const trimmedName = name.trim();
                if (settings.savedThemes && settings.savedThemes[trimmedName]) {
                    if (!confirm(`A theme named "${trimmedName}" already exists. Overwrite?`)) return;
                }
                if (!settings.savedThemes) settings.savedThemes = {};
                settings.savedThemes[trimmedName] = JSON.parse(JSON.stringify(settings.customTheme));
                saveSettings();
                refreshSavedThemesList();
                toastr['success'](`Saved "${name}" to library.`, 'Theme Library');
            }
        });
        document.getElementById('rpg_tracker_theme_wizard_undo')?.addEventListener('click', () => {
            undoThemeChange(settings);
        });

        refreshSavedThemesList();

        const fontSizeInput = $('#rpg_tracker_font_size');
        const fontSizeVal = $('#rpg_tracker_font_size_val');
        fontSizeInput.val(settings.fontSize || 13);
        if (fontSizeVal.length) fontSizeVal.text((settings.fontSize || 13) + 'px');

        fontSizeInput.on('input', function () {
            const val = parseInt(String($(this).val()));
            if (isNaN(val) || val < 8 || val > 32) return;
            if (fontSizeVal.length) fontSizeVal.text(val + 'px');
            settings.fontSize = val;
            saveSettings();
            updateTrackerFontSize(val);
        });

        const agentFontSizeInput = $('#rpg_agent_font_size');
        const agentFontSizeVal = $('#rpg_agent_font_size_val');
        agentFontSizeInput.val(settings.agentFontSize || 13);
        if (agentFontSizeVal.length) agentFontSizeVal.text((settings.agentFontSize || 13) + 'px');

        agentFontSizeInput.on('input', function () {
            const val = parseInt(String($(this).val()));
            if (isNaN(val) || val < 8 || val > 32) return;
            if (agentFontSizeVal.length) agentFontSizeVal.text(val + 'px');
            settings.agentFontSize = val;
            saveSettings();
            updateAgentFontSize(val);
        });

        // Populate profiles using handleDropdown (fills real internal IDs, not names)
        if (!tryBindConnectionProfileDropdown('#rpg_tracker_connection_profile', settings.connectionProfileId, (id) => {
            settings.connectionProfileId = id;
            saveSettings();
        })) {
            // Fallback for older ST: /profile-list returns names only
            const profiles = await getConnectionProfiles();
            profileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
            profiles.forEach(p => {
                profileSelect.append($('<option></option>').val(p).text(p));
            });
            profileSelect.val(settings.connectionProfileId);
            profileSelect.on('change', function () {
                settings.connectionProfileId = $(this).val();
                saveSettings();
            });
        }

        // Populate presets
        const presetSelect = $('#rpg_tracker_completion_preset');
        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            presetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => {
                presetSelect.append($('<option></option>').val(p).text(p));
            });
            presetSelect.val(settings.completionPresetId || '');
        } else {
            presetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            if (settings.completionPresetId) {
                presetSelect.append($('<option></option>').val(settings.completionPresetId).text(settings.completionPresetId));
                presetSelect.val(settings.completionPresetId);
            }
        }
        presetSelect.on('change', function () {
            settings.completionPresetId = $(this).val();
            saveSettings();
        });

        // Initial order list refresh
        refreshOrderList();

        $('#rpg_tracker_add_custom_field').on('click', function () {
            const settings = getSettings();
            if (!settings.customFields) settings.customFields = [];

            let newTag = 'NEW_FIELD';
            let counter = 1;
            const isTagTaken = (tag) => BLOCK_ORDER.includes(tag) || settings.customFields.some(f => f.tag.toUpperCase() === tag);

            while (isTagTaken(counter === 1 ? newTag : `${newTag}_${counter}`)) {
                counter++;
            }
            if (counter > 1) newTag = `${newTag}_${counter}`;

            settings.customFields.push({
                tag: newTag, label: 'New Field', icon: '📝',
                prompt: '',
                template: EXAMPLES + '\n\n' + COLOR_EXAMPLES,
                enabled: true
            });
            refreshOrderList();
            saveSettings();
        });

        // ── AI Custom Field Creator ──
        $('#rpg_tracker_add_custom_field_ai').on('click', async function () {
            const { Popup, POPUP_TYPE } = SillyTavern.getContext();
            const settings = getSettings();
            if (!settings.customFields) settings.customFields = [];

            const inputContent = `
                    <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box;">
                        <div style="font-size:13px; opacity:0.9; font-weight:bold;">🪄 AI Custom Field Creator</div>
                        <div style="font-size:11px; opacity:0.7; line-height:1.4;">
                            Describe what you want to track in plain language. The AI will generate a field name, icon, prompt instruction, and rendering template.
                        </div>
                        <textarea id="rt_ai_field_desc" rows="4" class="text_pole"
                            style="font-size:12px; resize:vertical; width:100%;"
                            placeholder="Example: A corruption tracker that goes up when the player does evil acts. Show it as a bar out of 100 and list corruption effects as pills."></textarea>
                    </div>
                `;

            let description = '';
            setTimeout(() => {
                const textarea = document.getElementById('rt_ai_field_desc');
                if (textarea) {
                    textarea.addEventListener('input', () => { description = textarea.value.trim(); });
                }
            }, 100);

            const inputResult = await Popup.show.confirm('Describe Your Custom Field', inputContent, { okButton: 'Generate', cancelButton: 'Cancel' });
            if (!inputResult) return;

            if (!description) {
                toastr['warning']('Please describe what you want to track.', 'AI Field Creator');
                return;
            }

            const existingTags = BLOCK_ORDER.concat((settings.customFields || []).map(f => f.tag.toUpperCase()));
            
            let existingFieldsContext = "";
            BLOCK_ORDER.forEach(tag => {
                if (tag === 'QUESTS' && settings.syspromptModules?.quests === false) return;
                if (!settings.modules || settings.modules[tag] !== false) {
                    const modLower = tag === 'TIME' ? resolveTimePromptKey(settings) : tag.toLowerCase();
                    const promptContent = (settings.stockPrompts && settings.stockPrompts[modLower]) 
                        ? settings.stockPrompts[modLower] 
                        : DEFAULT_STOCK_PROMPTS[modLower] || '';
                    existingFieldsContext += `[${tag}] (Stock Module)\nPrompt: ${promptContent}\n\n`;
                }
            });
            if (settings.customFields) {
                settings.customFields.forEach(f => {
                    if (!settings.modules || settings.modules[f.tag.toUpperCase()] !== false) {
                        existingFieldsContext += `[${f.tag}] (Custom Field: ${f.label})\nPrompt: ${f.prompt}\nTemplate: ${f.template}\n\n`;
                    }
                });
            }

            const aiPrompt = `You are a configuration generator for a game state tracker extension.

The user's current system prompt is provided below for reference. If the user's requested tracking field relates to an existing mechanic in this system prompt, base your instructions off that system. If it doesn't, proceed as usual:
<current_prompt>
${document.getElementById('main_prompt_quick_edit_textarea')?.value || settings.systemPromptTemplate || ''}
</current_prompt>

Here are ALL the user's currently enabled tracking fields (both stock and custom), including their exact instructions and formatting. Use these for inspiration on depth and style. Ensure your new field complements them without duplicating functionality. DO NOT use any of these existing Field IDs for your new field:
<existing_fields>
${existingFieldsContext.trim()}
</existing_fields>

The user wants to create a new custom tracking field. Their description:
"${description}"

Available rendering tags (MUST use at least one in the template). Tags can be placed inline (e.g., 'Health: ((BAR)) 50/100'). Pill tags optionally support parenthesis text for descriptions (e.g. 'Status: ((PILLS)) Sleeping (Unconscious)'):
${RENDERING_TAGS_LIBRARY.map(t => '- ' + t).join('\n')}

Return ONLY a valid JSON object with these fields:
{
  "tag": "UPPERCASE_FIELD_ID",
  "label": "Human Readable Label",
  "icon": "single emoji",
  "prompt": "Instruction text telling the AI model what to track and exactly how to format it. MUST include a newline, then a literal 'FORMAT:' section, then a newline, then an 'EXAMPLE:' section.",
  "template": "Example output showing rendering markers. MUST use at least one ((MARKER)) tag. Show realistic example data."
}

RULES:
- 'tag' (the field ID) must be UPPERCASE, no spaces, use underscores
- 'tag' (the field ID) must NOT conflict with any of the field tags listed in <existing_fields>
- NEVER use asterisks (*) anywhere. Do not use them in the tag, prompt, template, or anywhere else. The * symbol is completely BANNED as it breaks rendering. Use ((HIGHLIGHT)) instead if you need emphasis.
- You are ENCOURAGED to use any of the available rendering tags, even if they are used by other fields
- icon must be a single emoji
- prompt should start with 1-3 sentences of clear and specific instructions
- prompt MUST include a newline, then 'FORMAT:', then the required layout with rendering markers
- prompt MUST include a newline, then 'EXAMPLE:', then a realistic made up example of how it should look
- The AI during gameplay only sees 'prompt', it does NOT see 'template'
- template MUST use rendering tags — this is just the UI preview for the user. It should match the EXAMPLE you provided in the prompt.
- Return ONLY the JSON. No explanation, no markdown fences.`;

            toastr['info']('Generating custom field with AI...', 'AI Field Creator', { timeOut: 3000 });
            try {
                const result = await sendStateRequest(settings, 'You are a JSON configuration generator. Return ONLY valid JSON.', aiPrompt);
                if (!result) throw new Error('No response from AI');

                // Extract JSON from the response (handle markdown fences)
                let jsonStr = result.trim();
                const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (fenceMatch) jsonStr = fenceMatch[1].trim();

                const parsed = JSON.parse(jsonStr);
                if (!parsed.tag || !parsed.label || !parsed.icon || !parsed.prompt || !parsed.template) {
                    throw new Error('AI returned incomplete field config');
                }

                // Validate tag doesn't conflict
                const normalTag = parsed.tag.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                if (existingTags.includes(normalTag)) {
                    parsed.tag = normalTag + '_' + Date.now().toString(36).slice(-3).toUpperCase();
                } else {
                    parsed.tag = normalTag;
                }

                // Show preview for approval
                const previewContent = `
                        <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box; max-height:80vh;">
                            <div style="font-size:13px; font-weight:bold;">🪄 AI Generated Custom Field</div>
                            <div style="border: 1px solid rgba(255,255,255,0.15); border-radius:8px; padding:12px; background:rgba(255,255,255,0.03); overflow-y:auto;">
                                <div><b>Tag:</b> [${escapeHtml(parsed.tag)}]</div>
                                <div><b>Label:</b> ${escapeHtml(parsed.icon)} ${escapeHtml(parsed.label)}</div>
                                <div style="margin-top:6px;"><b>AI Prompt:</b></div>
                                <div style="font-size:11px; opacity:0.8; white-space:pre-wrap; padding:6px 8px; background:rgba(0,0,0,0.2); border-radius:4px; margin-top:2px;">${escapeHtml(parsed.prompt)}</div>
                                <div style="margin-top:6px;"><b>Example Template:</b></div>
                                <div style="font-size:11px; opacity:0.8; white-space:pre-wrap; padding:6px 8px; background:rgba(0,0,0,0.2); border-radius:4px; margin-top:2px; font-family:monospace;">${escapeHtml(parsed.template)}</div>
                                <div style="margin-top:12px; font-weight:bold; font-size:12px;">Live Preview:</div>
                                <div id="rt_ai_cfe_preview_view" class="rpg-tracker-render-view" style="margin-top:4px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; background:rgba(0,0,0,0.2); padding:4px;"></div>
                            </div>
                        </div>
                    `;

                setTimeout(() => {
                    const renderView = document.getElementById('rt_ai_cfe_preview_view');
                    if (!renderView) return;

                    const previewTag = parsed.tag;
                    const fakeMemo = `[${previewTag}]\n${parsed.template}\n[/${previewTag}]`;
                    const ghostField = {
                        tag: previewTag,
                        label: parsed.label,
                        icon: parsed.icon,
                        template: parsed.template,
                        prompt: '',
                        enabled: true
                    };
                    const savedCustomFields = settings.customFields;
                    settings.customFields = [...savedCustomFields, ghostField];
                    try {
                        // We use an empty object for pagination state since this is just a quick preview
                        renderView.innerHTML = renderMemoAsCards(fakeMemo, previewTag, {});
                        bindRenderedCardEvents(renderView, fakeMemo, true, null);
                    } finally {
                        settings.customFields = savedCustomFields;
                    }
                }, 150);

                const approved = await Popup.show.confirm('Accept Custom Field?', previewContent);
                if (!approved) {
                    toastr['info']('Custom field creation cancelled.', 'AI Field Creator');
                    return;
                }

                settings.customFields.push({
                    tag: parsed.tag,
                    label: parsed.label,
                    icon: parsed.icon,
                    prompt: parsed.prompt,
                    template: parsed.template,
                    enabled: true
                });
                refreshOrderList();
                saveSettings();
                toastr['success'](`Custom field "${parsed.label}" created!`, 'AI Field Creator');
            } catch (err) {
                console.error('[RPG Tracker] AI Field Creator error:', err);
                toastr['error'](`Failed to create field: ${err.message}`, 'AI Field Creator');
            }
        });

        $('#rpg_tracker_export_all_modules').on('click', () => {
            const s = getSettings();
            if (!s.customFields || s.customFields.length === 0) {
                toastr['info']('No custom modules to export.', 'Multihog Framework');
                return;
            }
            exportModules(s.customFields);
        });

        $('#rpg_tracker_import_modules').on('click', async () => {
            const { Popup } = SillyTavern.getContext();
            let pastedValue = '';

            // Attach the file input directly to body so the OS file picker
            // doesn't steal focus away from the popup and trigger its "outside click" dismiss.
            const fileInput = /** @type {HTMLInputElement} */ (document.createElement('input'));
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
            document.body.appendChild(fileInput);

            const content = `
                    <div style="display:flex; flex-direction:column; gap:8px; width:100%; box-sizing:border-box;">
                        <p style="margin:0; font-size:12px; opacity:0.7;">
                            Paste the module export code (JSON) below or load it from a file.
                        </p>
                        <textarea id="rt_import_blob" rows="12" class="text_pole"
                            style="font-family:monospace; font-size:11px; resize:vertical; width:100%;"
                            placeholder='{"format": "multihog-custom-module", ...}'
                        ></textarea>
                        <button id="rt_import_file_btn" class="menu_button interactable" style="width:100%;">
                            <i class="fa-solid fa-file-upload"></i> Load from File
                        </button>
                    </div>
                `;

            setTimeout(() => {
                const fileBtn = document.getElementById('rt_import_file_btn');
                const textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_import_blob'));

                if (textarea) {
                    textarea.addEventListener('input', () => {
                        pastedValue = textarea.value;
                    });
                }

                if (fileBtn) {
                    fileBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        fileInput.click();
                    });
                }

                fileInput.addEventListener('change', () => {
                    const file = fileInput.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const text = String(ev.target?.result || '');
                        pastedValue = text;
                        if (textarea) textarea.value = text;
                    };
                    reader.readAsText(file);
                    fileInput.value = ''; // allow re-selecting same file
                });
            }, 100);

            const result = await Popup.show.confirm('📥 Import Custom Module(s)', content, { okButton: 'Import', cancelButton: 'Cancel' });
            document.body.removeChild(fileInput);

            if (result && pastedValue.trim()) {
                await importModulesFromJson(pastedValue);
            }
        });

        $('#rpg_tracker_delete_all_custom_modules').on('click', function () {
            const s = getSettings();
            if (!s.customFields || s.customFields.length === 0) return toastr['info']('No custom modules to delete.', 'RPG Tracker');

            if (confirm(`Delete ALL (${s.customFields.length}) custom modules?\n\nThis will also remove their data from the current tracker state. Stock modules (COMBAT, CHARACTER, etc.) will not be touched.\n\nProceed?`)) {
                const customTags = new Set(s.customFields.map(f => f.tag.toUpperCase()));

                // Clear fields
                s.customFields = [];

                // Clean block order
                if (s.blockOrder) {
                    s.blockOrder = s.blockOrder.filter(tag => !customTags.has(tag.toUpperCase()));
                }

                // Clean current memo
                const memoBlocks = parseMemoBlocks(s.currentMemo || '');
                let changed = false;
                for (const tag of customTags) {
                    if (memoBlocks[tag] !== undefined) {
                        delete memoBlocks[tag];
                        changed = true;
                    }
                }

                if (changed) {
                    s.currentMemo = Object.entries(memoBlocks)
                        .map(([k, v]) => `[${k}]\n${v}\n[/${k}]`)
                        .join('\n\n');
                    updateUIMemo(s.currentMemo);
                }

                saveSettings();
                refreshOrderList();
                syncMemoView();
                toastr['success']('All custom modules deleted.', 'RPG Tracker');
            }
        });

        $('#rt_btn_tag_library').on('click', async function () {
            const { Popup } = SillyTavern.getContext();
            const { tryRenderMarker } = await import('./renderer.js');
            
            const escapeHtml = (unsafe) => (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

            const panel = document.getElementById('rpg_tracker_memo_panel');
            const themeClass = panel ? Array.from(panel.classList).find(c => c.startsWith('rt-theme-')) || 'rt-theme-native' : 'rt-theme-native';

            let html = `<div class="rpg-tracker-panel ${themeClass}" style="display:flex; flex-direction:column; gap:8px; max-height:60vh; overflow-y:auto; padding-right:10px; position:relative; top:auto; right:auto; width:100%; height:auto; background:transparent; border:none; box-shadow:none; resize:none;">`;
            for (const item of RENDERING_TAGS_LIBRARY) {
                const rendered = tryRenderMarker(item) || `<i>(Failed to render)</i>`;
                html += `<div style="border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.2);">
                    <div style="font-family:monospace; font-size:11px; opacity:0.8; margin-bottom:6px; color:#ffdd88;">${escapeHtml(item)}</div>
                    <div>${rendered}</div>
                </div>`;
            }
            html += '</div>';

            await Popup.show.confirm('🎨 Rendering Tags Library', html, { okButton: 'Close', cancelButton: false });
        });

        $('#rpg_tracker_core_prompt').val(settings.systemPromptTemplate).on('input', function () {
            settings.systemPromptTemplate = $(this).val();
            saveSettings();
        });

        $('#rpg_tracker_user_prompt_suffix').val(settings.userPromptSuffix || '').on('input', function () {
            settings.userPromptSuffix = $(this).val();
            saveSettings();
        });

        $('#rpg_tracker_btn_reset_prompt').on('click', function () {
            if (!confirm('Reset the State Model prompt and user prompt suffix to the built-in defaults?')) return;
            // Re-read the default from the defaults object by temporarily clearing the stored value
            const { extensionSettings } = SillyTavern.getContext();
            delete extensionSettings[MODULE_NAME].systemPromptTemplate;
            delete extensionSettings[MODULE_NAME].userPromptSuffix;
            const freshSettings = getSettings(); // re-merges defaults
            $('#rpg_tracker_core_prompt').val(freshSettings.systemPromptTemplate);
            $('#rpg_tracker_user_prompt_suffix').val(freshSettings.userPromptSuffix);
            saveSettings();
            toastr['success']('Core prompt and user prompt suffix reset to defaults.', 'RPG Tracker');
        });

        $('#rpg_tracker_btn_update_sysprompt_general').on('click', async function () {
            const fileName = getSettings().diceFunctionTool ? 'sysprompt.txt' : 'sysprompt_legacy.txt';
            let content;
            try {
                const response = await fetch(`/scripts/extensions/third-party/${FOLDER_NAME}/${fileName}`);
                if (response.ok) {
                    content = await response.text();
                } else {
                    throw new Error(`Server returned ${response.status}`);
                }
            } catch (err) {
                console.warn(`[Multihog Framework] Could not fetch ${fileName}, using hardcoded fallback:`, err);
                content = RT_PROMPTS[fileName];
            }

            if (!content) {
                toastr['error'](`Could not load ${fileName}. Main prompt was NOT updated.`, 'RPG Tracker');
                return;
            }

            content = buildSysprompt(content);

            const mainTextarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('main_prompt_quick_edit_textarea'));
            if (mainTextarea) {
                mainTextarea.value = content;
                mainTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
                toastr['success'](`Main sysprompt updated (${getSettings().diceFunctionTool ? 'Normal' : 'Legacy'} mode)! ✅`, 'RPG Tracker');
            } else {
                await navigator.clipboard.writeText(content).catch(() => { });
                toastr['info']('Quick-edit textarea not found. Sysprompt copied to clipboard — paste it manually into your Main prompt.', 'RPG Tracker');
            }
        });

        $('#rpg_tracker_btn_reset_all_prompts').on('click', function () {
            if (!confirm('This will reset the Module Prompts, Active Modules, and Module Order to their factory defaults. Custom modules will be moved to the bottom of the list. Your Core Prompt will not be affected. Proceed?')) return;
            const { extensionSettings } = SillyTavern.getContext();
            delete extensionSettings[MODULE_NAME].stockPrompts;
            delete extensionSettings[MODULE_NAME].blockOrder;
            delete extensionSettings[MODULE_NAME].modules;
            refreshOrderList();
            saveSettings();
            toastr['success']('Stock modules, order, and prompts reset to factory defaults.', 'RPG Tracker');
        });


        // ── Game Systems (Wizard / Manage / Unlock / Advanced library tools) ──
        // Heavy logic lives in game-systems.js; these are thin bindings only.
        $('#rpg_tracker_btn_game_system_wizard').on('click', () => openGameSystemWizard());
        $('#rpg_tracker_btn_manage_game_systems').on('click', () => openManageGameSystems());
        $('#rpg_tracker_btn_unlock_sections').on('click', () => openUnlockSectionsMenu());
        $('#rpg_tracker_btn_sysprompt_library').on('click', () => openCustomSyspromptLibrary());
        $('#rpg_tracker_btn_reset_sysprompt_library').on('click', () => resetSyspromptLibrary());
        $('#rpg_tracker_btn_ai_add_section').on('click', () => runAiSectionBuilder());
        $('#rpg_tracker_btn_manual_add_section').on('click', () => runManualSectionBuilder());

        $('#rpg_tracker_btn_reset_and_apply_sysprompt').on('click', async function () {
            if (!confirm('This will:\n\n1. Reset the Core State Model prompt to built-in default\n2. Reset all Stock Module prompts, Active Modules, and Module Order to factory defaults\n3. Reset all Lorebook Agent prompts and World Progression prompts to factory defaults\n4. Fetch the latest sysprompt.txt and write it directly into your Quick Prompt "Main" box\n5. Automatically re-enable any custom sysprompt sections that were already enabled\n\nYour custom modules will NOT be affected. Proceed?')) return;

            const { extensionSettings } = SillyTavern.getContext();

            // 1. Reset Core prompt and user prompt suffix
            delete extensionSettings[MODULE_NAME].systemPromptTemplate;
            delete extensionSettings[MODULE_NAME].userPromptSuffix;
            const freshSettings = getSettings();
            $('#rpg_tracker_core_prompt').val(freshSettings.systemPromptTemplate);
            $('#rpg_tracker_user_prompt_suffix').val(freshSettings.userPromptSuffix);

            // 2. Reset stock modules, order, active modules
            delete extensionSettings[MODULE_NAME].stockPrompts;
            delete extensionSettings[MODULE_NAME].blockOrder;
            delete extensionSettings[MODULE_NAME].modules;

            // 3. Reset Lorebook Agent prompts and World Progression prompts
            delete extensionSettings[MODULE_NAME].routerSystemPromptTemplate;
            delete extensionSettings[MODULE_NAME].routerModularPromptTemplate;
            delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
            delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;

            // Re-merge defaults
            const finalSettings = getSettings();

            // Update UI elements for Lorebook Agent prompts
            const $routerPrompt = $('#rpg_tracker_router_prompt');
            $routerPrompt.val(finalSettings.routerSystemPromptTemplate);
            if (typeof (/** @type {any} */ ($routerPrompt)).trigger === 'function') {
                (/** @type {any} */ ($routerPrompt)).trigger('autosize.resize');
            }

            const $routerModularPrompt = $('#rpg_tracker_router_modular_prompt');
            $routerModularPrompt.val(finalSettings.routerModularPromptTemplate);
            if (typeof (/** @type {any} */ ($routerModularPrompt)).trigger === 'function') {
                (/** @type {any} */ ($routerModularPrompt)).trigger('autosize.resize');
            }

            // Update UI elements for World Progression prompts
            const $wpPrompt = $('#rpg_world_progression_system_prompt');
            $wpPrompt.val(finalSettings.worldProgressionSystemPrompt);
            if (typeof (/** @type {any} */ ($wpPrompt)).trigger === 'function') {
                (/** @type {any} */ ($wpPrompt)).trigger('autosize.resize');
            }

            // If legacy mode is on, the prompt is applied at runtime by buildModulesInstructionText
            // (no explicit call needed)

            refreshOrderList();
            saveSettings();

            // 4. Fetch sysprompt and apply to ST Quick Prompt "Main"
            const fileName = getSettings().diceFunctionTool ? 'sysprompt.txt' : 'sysprompt_legacy.txt';
            let content;
            try {
                const response = await fetch(`/scripts/extensions/third-party/${FOLDER_NAME}/${fileName}`);
                if (response.ok) {
                    content = await response.text();
                    console.log(`[Multihog Framework] Loaded ${fileName} from live file for auto-apply.`);
                } else {
                    throw new Error(`Server returned ${response.status}`);
                }
            } catch (err) {
                console.warn(`[Multihog Framework] Could not fetch ${fileName}, using hardcoded fallback:`, err);
                content = RT_PROMPTS[fileName];
            }

            if (!content) {
                toastr['error']('Could not load sysprompt.txt. Reset completed but Main prompt was NOT updated.', 'RPG Tracker');
                return;
            }

            content = buildSysprompt(content);

            const mainTextarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('main_prompt_quick_edit_textarea'));
            if (mainTextarea) {
                mainTextarea.value = content;
                // Fire blur to trigger ST's handleQuickEditSave listener
                mainTextarea.dispatchEvent(new Event('blur', { bubbles: true }));

                // 5. Automatically re-apply any custom sysprompt library sections that were already enabled
                await applyCustomSysprompts();

                toastr['success']('All prompts reset & Main sysprompt applied! \u2705', 'RPG Tracker');
            } else {
                // 5. Automatically re-apply any custom sysprompt library sections that were already enabled
                // (unlocked-base overrides are reinserted at their original GS_SLOT position first).
                content = replaceGsSlotMarkers(content, finalSettings);

                const enabledPrompts = (finalSettings.customSyspromptLibrary || []).filter(p => {
                    if (p.origin === 'unlocked_base') return false;
                    if (!p.enabled || !p.content) return false;
                    const trimmed = p.content.trim();
                    if (!trimmed) return false;
                    const emptyTagMatch = trimmed.match(/^<(\w+[\w_-]*)>\s*<\/\1>$/);
                    if (emptyTagMatch) return false;
                    return true;
                });

                const newInjection = enabledPrompts.length > 0
                    ? enabledPrompts.map(p => p.content).join('\n\n')
                    : '';

                if (newInjection) {
                    if (content.includes('<constraints>')) {
                        content = content.replace('<constraints>', `${newInjection}\n\n<constraints>`);
                    } else {
                        content = content.trim() + '\n\n' + newInjection;
                    }
                    content = content.replace(/\n{3,}/g, '\n\n').trim();

                    finalSettings._customLibraryLastInjection = newInjection;
                    saveSettings();
                }

                // Fallback: ST might not be in OpenAI mode, so the quick-edit textarea may not exist.
                // Copy to clipboard as a graceful fallback.
                const ta = document.createElement('textarea');
                ta.value = content;
                ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try {
                    document.execCommand('copy');
                    toastr['warning']('All prompts reset. Quick Prompt "Main" textarea not found. Sysprompt copied to clipboard — paste it manually and enable function calls in the completion preset!', 'RPG Tracker');
                } catch (e) {
                    toastr['warning']('All prompts reset. Quick Prompt "Main" textarea not found and clipboard copy failed. Use the SYSPROMPT button to copy manually.', 'RPG Tracker');
                } finally {
                    document.body.removeChild(ta);
                }
            }
        });

        // ── Sysprompt Section Toggles ──
        const _syspromptModDefs = [
            { key: 'loot', id: 'rpg_sysprompt_mod_loot' },
            { key: 'random_events', id: 'rpg_sysprompt_mod_random_events' },
            { key: 'resting', id: 'rpg_sysprompt_mod_resting' },
            { key: 'quests', id: 'rpg_sysprompt_mod_quests' },
        ];
        _syspromptModDefs.forEach(({ key, id }) => {
            const s = getSettings();
            const val = s.syspromptModules?.[key] ?? true;
            $(`#${id}`).prop('checked', val).on('change', function () {
                const fresh = getSettings();
                if (!fresh.syspromptModules) fresh.syspromptModules = {};
                fresh.syspromptModules[key] = !!$(this).prop('checked');

                if (key === 'quests') {
                    $('#rpg_quests_options').toggle(!!$(this).prop('checked'));
                    refreshOrderList();
                }

                saveSettings();
                scheduleAutoApply();
                refreshRenderedView();
            });

            if (key === 'quests') {
                $('#rpg_quests_options').toggle(val);
            }
        });
        // Disable any toggle whose section is currently unlocked for Game Systems customization.
        syncAllNarratorTogglesForUnlockState();

        // Deadlines Toggle
        const deadlinesCb = /** @type {HTMLInputElement} */ (document.getElementById('rpg_quests_deadlines'));
        const frustrationWrap = document.getElementById('rpg_quests_frustration_wrap');
        const syncFrustrationVisibility = () => {
            if (frustrationWrap) frustrationWrap.style.display = deadlinesCb?.checked ? '' : 'none';
        };
        if (deadlinesCb) {
            deadlinesCb.checked = !!getSettings().syspromptModules?.questsDeadlines;
            syncFrustrationVisibility();
            deadlinesCb.addEventListener('change', function () {
                const fresh = getSettings();
                if (!fresh.syspromptModules) fresh.syspromptModules = {};
                fresh.syspromptModules.questsDeadlines = !!this.checked;
                // If deadlines disabled, also uncheck frustration
                if (!this.checked) {
                    fresh.syspromptModules.questsFrustration = false;
                    const fCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_frustration'));
                    if (fCb) fCb.checked = false;
                }
                syncFrustrationVisibility();
                refreshQuestPrompt(fresh);
                refreshOrderList();
                saveSettings();
                scheduleAutoApply();
                refreshRenderedView();
            });
        }

        // Frustration Toggle
        const frustrationCb = /** @type {HTMLInputElement} */ (document.getElementById('rpg_quests_frustration'));
        if (frustrationCb) {
            frustrationCb.checked = !!getSettings().syspromptModules?.questsFrustration;
            frustrationCb.addEventListener('change', function () {
                const fresh = getSettings();
                if (!fresh.syspromptModules) fresh.syspromptModules = {};
                fresh.syspromptModules.questsFrustration = !!this.checked;
                refreshQuestPrompt(fresh);
                refreshOrderList();
                saveSettings();
                scheduleAutoApply();
                refreshRenderedView();
            });
        }

        // Difficulty Toggle
        const difficultyCb = /** @type {HTMLInputElement} */ (document.getElementById('rpg_quests_difficulty'));
        if (difficultyCb) {
            difficultyCb.checked = !!getSettings().syspromptModules?.questsDifficulty;
            difficultyCb.addEventListener('change', function () {
                const fresh = getSettings();
                if (!fresh.syspromptModules) fresh.syspromptModules = {};
                fresh.syspromptModules.questsDifficulty = !!this.checked;
                refreshQuestPrompt(fresh);
                refreshOrderList();
                saveSettings();
                scheduleAutoApply();
                refreshRenderedView();
            });
        }

        const showArchiveCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_show_archive'));
        if (showArchiveCb) {
            showArchiveCb.checked = getSettings().syspromptModules?.questsShowArchive !== false;
            showArchiveCb.addEventListener('change', function () {
                const fresh = getSettings();
                if (!fresh.syspromptModules) fresh.syspromptModules = {};
                fresh.syspromptModules.questsShowArchive = !!this.checked;
                saveSettings();
                refreshRenderedView();
            });
        }

        // Quests Help Trigger
        $('#rt_quests_hardcore_help').on('click', (e) => {
            e.stopPropagation();
            showQuestsHardcoreExplanation();
        });

        // Components Help Trigger
        $('#rt_components_help').on('click', (e) => {
            e.stopPropagation();
            showComponentsExplanation();
        });



        // Quests Help Trigger
        const rngModeRadios = document.querySelectorAll('input[name="rpg_sysprompt_rng_mode"]');
        if (rngModeRadios.length) {
            const s = getSettings();
            let currentRngMode = 'hybrid';
            if (!s.rngEnabled) {
                currentRngMode = 'none';
            } else if (s.diceFunctionTool === false) {
                currentRngMode = 'legacy';
            }
            $(`input[name="rpg_sysprompt_rng_mode"][value="${currentRngMode}"]`).prop('checked', true);

            $('input[name="rpg_sysprompt_rng_mode"]').on('change', function () {
                const fresh = getSettings();
                const val = $(this).val();
                if (val === 'hybrid') {
                    fresh.rngEnabled = true;
                    fresh.diceFunctionTool = true;
                    registerDiceFunctionTool();
                } else if (val === 'legacy') {
                    fresh.rngEnabled = true;
                    fresh.diceFunctionTool = false;
                    registerDiceFunctionTool();
                } else {
                    fresh.rngEnabled = false;
                    fresh.diceFunctionTool = false;
                    registerDiceFunctionTool();
                }
                saveSettings();
                scheduleAutoApply();
            });
        }

        // Router Agent Settings
        $('#rpg_tracker_router_enabled').prop('checked', settings.routerEnabled).on('change', function () {
            settings.routerEnabled = !!$(this).prop('checked');
            saveSettings();
            // Sync in-panel enable checkbox
            const inPanelCheck = /** @type {HTMLInputElement|null} */ (document.getElementById('rt-agent-router-enable'));
            if (inPanelCheck) inPanelCheck.checked = settings.routerEnabled;
            // Apply disabled state to agent panel
            const ap = document.getElementById('rpg-tracker-agent');
            if (ap) {
                if (settings.routerEnabled) ap.classList.remove('is-agent-disabled');
                else ap.classList.add('is-agent-disabled');
            }
        });

        const routerSourceSelect = $('#rpg_tracker_router_source');
        const routerProfileGroup = $('#rpg_tracker_router_profile_group');
        const routerProfileSelect = $('#rpg_tracker_router_connection_profile');
        const routerOllamaGroup = $('#rpg_tracker_router_ollama_group');
        const routerOpenaiGroup = $('#rpg_tracker_router_openai_group');


        function updateRouterConnectionPanels() {
            const source = routerSourceSelect.val();
            routerProfileGroup.toggle(source === 'profile');
            routerOllamaGroup.toggle(source === 'ollama');
            routerOpenaiGroup.toggle(source === 'openai');
        }

        routerSourceSelect.val(settings.routerConnectionSource || 'default').on('change', function () {
            settings.routerConnectionSource = $(this).val();
            updateRouterConnectionPanels();
            saveSettings();
        });
        setTimeout(updateRouterConnectionPanels, 100); // Ensure DOM is ready for toggle

        // Prefix display: effective value (override or chat id), not only last saved routerCampaignPrefix
        function updateSettingsLorePrefixReadout() {
            const ctx = SillyTavern.getContext();
            const el = document.getElementById('rpg_tracker_router_prefix_display');
            if (el) {
                const eff = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
                el.textContent = eff || '—';
            }
        }
        updateSettingsLorePrefixReadout();

        $('#rpg_tracker_router_prefix_override').val(settings.routerCampaignPrefixOverride || '').on('input', function () {
            settings.routerCampaignPrefixOverride = String($(this).val() || '');
            saveSettings();
            updateSettingsLorePrefixReadout();
        });

        $('#rpg_tracker_activate_books_btn').on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true);
            try {
                const count = await activateCampaignBooks({ debugSource: 'manual:settings-activate-books' });
                toastr['success'](`Activated ${count} campaign lorebook${count === 1 ? '' : 's'}.`);
                await refreshAgentManifestNow();
            } catch (e) {
                toastr['error']('Failed to activate campaign lorebooks.');
            } finally {
                btn.prop('disabled', false);
            }
        });

        $('#rpg_tracker_clone_stack_btn').on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true);
            try {
                await cloneCampaignStack();
            } finally {
                btn.prop('disabled', false);
            }
        });

        $('#rt-agent-router-full-audit, #rt-agent-router-full-audit-panel').on('click', async function () {
            const { Popup } = SillyTavern.getContext();
            const confirmHtml = `
                    <div style="text-align: left; font-size: 0.9em; line-height: 1.5;">
                        <p>You are about to run a <b>Full Audit</b> of the entire chat history through the Lorebook Agent.</p>
                        <p style="margin-top: 8px;">⏳ This may take <b>several minutes</b> depending on the size of your chat. The agent will process the history in chunks, rebuilding and updating your lorebooks sequentially.</p>
                        <p style="margin-top: 8px; color: #ffa500;">⚠️ <b>Do not send messages to the AI while the audit is running.</b></p>
                    </div>
                `;
            const confirmed = await Popup.show.confirm('📚 Lorebook Agent Full Audit', confirmHtml, {
                okButton: 'Start Full Audit',
                cancelButton: 'Cancel'
            });
            if (!confirmed) return;

            const btn = $(this);
            btn.prop('disabled', true);
            // Also disable the other button (settings vs panel)
            $('#rt-agent-router-full-audit, #rt-agent-router-full-audit-panel').prop('disabled', true);
            try {
                const ctx = SillyTavern.getContext();
                const { chat } = ctx;

                const maxContextLimit = ctx.contextSize || settings.fullAuditMaxTokens || 32000;
                const tokenBuffer = 3000;
                const chunkTokenLimit = Math.max(1000, maxContextLimit - tokenBuffer);

                let chunks = [];
                let currentChunk = [];
                let currentTokens = 0;

                for (const m of chat) {
                    const name = m.is_user ? 'Player' : (m.name || 'Narrator');
                    const cleaned = cleanMessageContent(m);
                    if (!cleaned || cleaned.includes('```json\n[') || cleaned.includes('```json\n{')) continue;

                    const line = `${name}: ${cleaned}`;
                    const lineTokens = Math.ceil(line.length / 4);

                    if (currentTokens + lineTokens > chunkTokenLimit && currentChunk.length > 0) {
                        chunks.push(currentChunk);
                        currentChunk = [];
                        currentTokens = 0;
                    }
                    currentChunk.push(line);
                    currentTokens += lineTokens;
                }
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                }

                if (chunks.length === 0) {
                    toastr.info("No chat history to audit.");
                    return;
                }

                console.log(`[RPG Tracker] Agent Full Audit: ${chunks.length} chunk(s) queued.`);

                for (let i = 0; i < chunks.length; i++) {
                    toastr.info(`Agent Full Audit: Chunk ${i + 1} of ${chunks.length}...`, "Lorebook Agent", { timeOut: 8000 });
                    console.log(`[RPG Tracker] Agent Full Audit: Starting chunk ${i + 1}/${chunks.length} (${chunks[i].length} messages)`);

                    // Wait for any lingering router pass to finish (e.g. auto-cleanup from prior chunk)
                    let waitCount = 0;
                    while (isRouterRunning() && waitCount < 60) {
                        await new Promise(r => setTimeout(r, 500));
                        waitCount++;
                    }
                    if (isRouterRunning()) {
                        console.warn(`[RPG Tracker] Agent Full Audit: Chunk ${i + 1} skipped — router still busy after 30s.`);
                        toastr.warning(`Chunk ${i + 1} skipped — agent was still busy.`, "Lorebook Agent");
                        continue;
                    }

                    const overrideChatLog = chunks[i].join('\n\n');
                    const chunkResult = await runRouterPass(null, null, null, true, [], overrideChatLog);
                    console.log(`[RPG Tracker] Agent Full Audit: Chunk ${i + 1}/${chunks.length} finished. Result: ${chunkResult}`);

                    // Yield to the event loop so the UI can repaint with the agent panel updates
                    await new Promise(r => setTimeout(r, 100));
                }

                toastr.success(`Agent Full Audit complete (${chunks.length} chunk${chunks.length > 1 ? 's' : ''}).`, "Lorebook Agent");
            } catch (e) {
                console.error("[RPG Tracker] Agent Full Audit failed:", e);
                toastr.error("Agent Full Audit failed.");
            } finally {
                $('#rt-agent-router-full-audit, #rt-agent-router-full-audit-panel').prop('disabled', false);
            }
        });

        $('#rpg_tracker_lore_debug_capture').on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true);
            try {
                _loreActivationDebugLast = await readLoreActivationDebugSnapshot('manual:capture-settings');
                renderLoreActivationDebugPanel();
                toastr['info']('Lore debug snapshot captured (read-only, no /world commands).');
            } catch (_) {
                toastr['error']('Capture failed.');
            } finally {
                btn.prop('disabled', false);
            }
        });
        $('#rpg_tracker_lore_debug_resync').on('click', async function () {
            const btn = $(this);
            btn.prop('disabled', true);
            try {
                const ctx = SillyTavern.getContext();
                const id = ctx.chatId || _currentChatId || '';
                await syncCampaignPrefixAndWorldsForChat(id, 'manual:re-sync-settings');
                toastr['info']('Re-sync finished; see JSON in Lore activation debug below.');
            } catch (_) {
                toastr['error']('Re-sync failed.');
            } finally {
                btn.prop('disabled', false);
            }
        });

        // Router Ollama
        $('#rpg_tracker_router_ollama_url').val(settings.routerOllamaUrl).on('input', function () {
            settings.routerOllamaUrl = $(this).val();
            saveSettings();
        });
        const routerOllamaModelSelect = $('#rpg_tracker_router_ollama_model');
        routerOllamaModelSelect.val(settings.routerOllamaModel).on('change', function () {
            settings.routerOllamaModel = $(this).val();
            saveSettings();
        });
        $('#rpg_tracker_router_ollama_refresh').on('click', async function () {
            const url = $('#rpg_tracker_router_ollama_url').val();
            if (!url) return toastr['info']("Please enter an Ollama URL first.");
            try {
                toastr['info']("Fetching Ollama models...");
                const models = await fetchOllamaModels(url);
                routerOllamaModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    routerOllamaModelSelect.append($('<option></option>').val(m.name).text(m.name));
                });
                routerOllamaModelSelect.val(settings.routerOllamaModel);
                toastr['success']("Ollama models updated.");
            } catch (e) {
                toastr['error']("Failed to fetch Ollama models.");
            }
        });

        // Router OpenAI
        $('#rpg_tracker_router_openai_url').val(settings.routerOpenaiUrl).on('input', function () {
            settings.routerOpenaiUrl = $(this).val();
            saveSettings();
        });
        $('#rpg_tracker_router_openai_key').val(settings.routerOpenaiKey).on('input', function () {
            settings.routerOpenaiKey = $(this).val();
            saveSettings();
        });
        const routerOpenaiModelSelect = $('#rpg_tracker_router_openai_model');
        const routerOpenaiModelManual = $('#rpg_tracker_router_openai_model_manual');
        routerOpenaiModelManual.val(settings.routerOpenaiModel || '');
        routerOpenaiModelSelect.on('change', function () {
            const val = $(this).val();
            if (val) {
                routerOpenaiModelManual.val('');
                settings.routerOpenaiModel = String(val);
            } else {
                settings.routerOpenaiModel = String(routerOpenaiModelManual.val() || '').trim() || '';
            }
            saveSettings();
        });
        routerOpenaiModelManual.on('input', function () {
            const manual = String($(this).val() || '').trim();
            if (manual) routerOpenaiModelSelect.val('');
            settings.routerOpenaiModel = manual || String(routerOpenaiModelSelect.val() || '') || '';
            saveSettings();
        });
        $('#rpg_tracker_router_openai_refresh').on('click', async function () {
            const url = $('#rpg_tracker_router_openai_url').val();
            const key = $('#rpg_tracker_router_openai_key').val();
            if (!url) return toastr['info']("Please enter an Endpoint URL first.");
            try {
                toastr['info']("Fetching models...");
                const models = await fetchOpenAIModels(url, key);
                routerOpenaiModelSelect.empty().append('<option value="">-- Select Model --</option>');
                models.forEach(m => {
                    const id = typeof m === 'string' ? m : (m.id || m.name);
                    if (id) routerOpenaiModelSelect.append($('<option></option>').val(id).text(id));
                });
                routerOpenaiModelSelect.val(settings.routerOpenaiModel);
                toastr['success']("Models updated.");
            } catch (e) {
                toastr['warning']("Cannot auto-detect models. Type manually.");
            }
        });

        // Router Profiles & Presets Population
        const routerPresetSelect = $('#rpg_tracker_router_completion_preset');
        if (!tryBindConnectionProfileDropdown('#rpg_tracker_router_connection_profile', settings.routerConnectionProfileId, (id) => {
            settings.routerConnectionProfileId = id;
            saveSettings();
        })) {
            getConnectionProfiles().then(profiles => {
                routerProfileSelect.empty().append('<option value="">-- No Profile Selected --</option>');
                profiles.forEach(p => routerProfileSelect.append($('<option></option>').val(p).text(p)));
                routerProfileSelect.val(settings.routerConnectionProfileId || "");
            });
            routerProfileSelect.on('change', function () {
                settings.routerConnectionProfileId = $(this).val();
                saveSettings();
            });
        }

        if (pm && typeof pm.getAllPresets === 'function') {
            const presets = pm.getAllPresets();
            routerPresetSelect.empty().append('<option value="">-- Use Current Settings --</option>');
            presets.forEach(p => routerPresetSelect.append($('<option></option>').val(p).text(p)));
            routerPresetSelect.val(settings.routerCompletionPresetId || '');
        }
        routerPresetSelect.on('change', function () {
            settings.routerCompletionPresetId = String($(this).val() || '');
            saveSettings();
        });


        $('#rpg_tracker_router_basic_mode').prop('checked', settings.routerBasicMode).on('change', function () {
            settings.routerBasicMode = $(this).prop('checked');
            $('#rt-agent-router-basic').prop('checked', settings.routerBasicMode);
            saveSettings();
        });
        $('#rpg_tracker_router_native_keyword_activation').prop('checked', settings.routerNativeKeywordActivation).on('change', function () {
            settings.routerNativeKeywordActivation = $(this).prop('checked');
            $('#rt-agent-router-native-kw').prop('checked', settings.routerNativeKeywordActivation);
            saveSettings();
        });
        $('#rpg_tracker_router_include_hidden').prop('checked', settings.routerIncludeHidden).on('change', function () {
            settings.routerIncludeHidden = $(this).prop('checked');
            $('#rt-agent-router-include-hidden').prop('checked', settings.routerIncludeHidden);
            saveSettings();
        });
        // Lorebook Agent lookback mode — three-option radio group
        const routerLookbackNumericRow = $('#rpg_tracker_router_lookback_numeric_row');
        const applyDrawerLookbackUI = (mode) => {
            const isFixed = mode === 'fixed';
            routerLookbackNumericRow.css({ opacity: isFixed ? '1' : '0.35', 'pointer-events': isFixed ? 'auto' : 'none' });
        };

        // Determine current mode from settings
        const currentLookbackMode = settings.routerLookbackSinceLastRun !== false ? 'since_last_run'
            : settings.routerLookbackSinceLastUser === true ? 'since_last_user' : 'fixed';

        // Init radio selection and numeric row state
        $(`#rpg_tracker_router_lookback_since_last_run`).prop('checked', currentLookbackMode === 'since_last_run');
        $(`#rpg_tracker_router_lookback_since_last_user`).prop('checked', currentLookbackMode === 'since_last_user');
        $(`#rpg_tracker_router_lookback_fixed`).prop('checked', currentLookbackMode === 'fixed');
        applyDrawerLookbackUI(currentLookbackMode);

        $('input[name="router_lookback_mode"]').on('change', function () {
            const mode = String($(this).val());
            settings.routerLookbackSinceLastRun  = mode === 'since_last_run';
            settings.routerLookbackSinceLastUser = mode === 'since_last_user';
            applyDrawerLookbackUI(mode);

            // Sync the agent panel radio group if present
            const panelRadio = $(`#rt-agent-lookback-mode-${mode === 'since_last_run' ? 'run' : mode === 'since_last_user' ? 'user' : 'fixed'}`);
            if (panelRadio.length) panelRadio.prop('checked', true);
            const panelContainer = $('#rt-agent-router-lookback-container');
            if (panelContainer.length) {
                panelContainer.css({ opacity: mode === 'fixed' ? '1' : '0.35', 'pointer-events': mode === 'fixed' ? 'auto' : 'none' });
            }
            saveSettings();
        });

        $('#rpg_tracker_router_lookback').val(settings.routerLookback).on('input', function () {
            settings.routerLookback = parseInt(String($(this).val() || '')) || 4;
            $('#rt-agent-router-lookback').val(settings.routerLookback);
            saveSettings();
        });
        $('#rpg_tracker_router_run_every').val(settings.routerRunEvery || 3).on('input', function () {
            settings.routerRunEvery = parseInt(String($(this).val() || '')) || 3;
            $('#rt-agent-router-run-every').val(settings.routerRunEvery);
            saveSettings();
        });
        $('#rpg_tracker_router_max_turns').val(settings.routerMaxTurns).on('input', function () {
            settings.routerMaxTurns = parseInt(String($(this).val() || '')) || 5;
            $('#rt-agent-router-max-turns').val(settings.routerMaxTurns);
            saveSettings();
        });
        $('#rpg_tracker_router_max_activations').val(settings.routerMaxActivations).on('input', function () {
            settings.routerMaxActivations = parseInt(String($(this).val() || '')) || 8;
            $('#rt-agent-router-max-activations').val(settings.routerMaxActivations);
            saveSettings();
        });
        $('#rpg_tracker_router_max_keyword_overflow').val(settings.routerMaxKeywordOverflow ?? 0).on('input', function () {
            settings.routerMaxKeywordOverflow = parseInt(String($(this).val() || '')) || 0;
            $('#rt-agent-router-kw-overflow-cap').val(settings.routerMaxKeywordOverflow);
            saveSettings();
        });

        // NPC Settings Bindings
        $('#rpg_tracker_npc_portraits').prop('checked', settings.npcPortraits !== false).on('change', async function () {
            applyNpcPortraitSetting(settings, !!$(this).prop('checked'));
            saveSettings();
            await refreshAgentManifestNow();
        });
        syncNpcPortraitDependentUi(settings);

        $('#rpg_tracker_npc_major_words').val(settings.npcMajorWords ?? 25).on('change', function () {
            // Use 'change' instead of 'input' to only save once the user is done editing.
            // Fall back to the current saved value (not a hardcoded default) if the field is empty.
            const raw = parseInt(String($(this).val() || ''), 10);
            const val = isNaN(raw) ? (settings.npcMajorWords ?? 25) : raw;
            settings.npcMajorWords = Math.max(1, Math.min(1000, val));
            $(this).val(settings.npcMajorWords); // update display with clamped value
            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
            }
            saveSettings();
            if (typeof globalThis._rpgRenderAgentModules === 'function') {
                globalThis._rpgRenderAgentModules();
            }
        });
        $('#rpg_tracker_npc_minor_words').val(settings.npcMinorWords ?? 15).on('change', function () {
            const raw = parseInt(String($(this).val() || ''), 10);
            const val = isNaN(raw) ? (settings.npcMinorWords ?? 15) : raw;
            settings.npcMinorWords = Math.max(1, Math.min(1000, val));
            $(this).val(settings.npcMinorWords); // update display with clamped value
            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
            }
            saveSettings();
            if (typeof globalThis._rpgRenderAgentModules === 'function') {
                globalThis._rpgRenderAgentModules();
            }
        });
        const handleRelBarsChange = (val) => {
            settings.npcRelationshipBars = val;
            $('#rpg_tracker_npc_rel_bars').prop('checked', val);
            $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', val);

            const onbRel = document.getElementById('rt_onboarding_mod_npc_rel_bars');
            if (onbRel) onbRel.checked = val;

            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
            }
            saveSettings();
            scheduleAutoApply();
            setTimeout(() => {
                if (typeof globalThis._rpgRenderAgentModules === 'function') {
                    globalThis._rpgRenderAgentModules();
                }
                if (typeof refreshAgentManifest === 'function') {
                    void refreshAgentManifest().catch(() => {});
                }
                refreshRenderedView();
            }, 1);
        };

        $('#rpg_tracker_npc_rel_bars').prop('checked', !!settings.npcRelationshipBars).on('change', function () {
            handleRelBarsChange($(this).prop('checked'));
        });

        $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', !!settings.npcRelationshipBars).on('change', function () {
            handleRelBarsChange($(this).prop('checked'));
        });
        $('#rpg_sysprompt_mod_time_ddmmyy').prop('checked', !!settings.useDdMmYyFormat).on('change', function () {
            setUseDdMmYyFormat(!!$(this).prop('checked'));
        });
        $('#rpg_tracker_npc_rel_toast').prop('checked', settings.npcRelationshipToast !== false).on('change', function () {
            settings.npcRelationshipToast = $(this).prop('checked');
            saveSettings();
        });
        $('#rpg_tracker_npc_rel_max_default').val(getNpcRelationshipMaxDefault(settings)).on('change', function () {
            const raw = parseInt(String($(this).val() || ''), 10);
            const val = isNaN(raw) ? getNpcRelationshipMaxDefault(settings) : raw;
            setNpcRelationshipMaxDefault(val);
        });
        // Note: experimentalNpcImport removed — NPC Creator button is always visible.
        $('#rpg_tracker_ignore_npc_limits').prop('checked', !!settings.ignoreNpcImportLimits).on('change', function () {
            settings.ignoreNpcImportLimits = $(this).prop('checked');
            if (settings.routerModules?.npc) {
                settings.routerModules.npc.instruction = buildNpcInstruction(settings.npcMajorWords, settings.npcMinorWords, false);
            }

            saveSettings();
            if (typeof globalThis._rpgRenderAgentModules === 'function') {
                globalThis._rpgRenderAgentModules();
            }
        });

        // New Entry Settings Bindings
        const defPosSelect = $('#rpg_tracker_router_default_position');
        const defaultPosition = settings.routerDefaultPosition ?? 4;
        const defaultRole = settings.routerDefaultRole ?? 0;
        const roleAttr = defaultPosition === 4 ? String(defaultRole) : '';
        defPosSelect.find(`option[value="${defaultPosition}"][data-role="${roleAttr}"]`).prop('selected', true);

        $('#rpg_tracker_router_default_depth').val(settings.routerDefaultDepth ?? 4);
        $('#rpg_tracker_router_default_order').val(settings.routerDefaultOrder ?? 100);

        function updateDefaultPositionFieldsVisibility() {
            const posVal = parseInt(String(defPosSelect.val() || '4'));
            const depthInpContainer = $('#rpg_tracker_router_default_depth_container');
            if (posVal === 4) {
                depthInpContainer.slideDown(200);
            } else {
                depthInpContainer.slideUp(200);
            }
        }
        updateDefaultPositionFieldsVisibility();

        defPosSelect.on('change', function () {
            const selectedOpt = $(this).find(':selected');
            const pos = parseInt(String(selectedOpt.val() || '4'));
            const roleVal = selectedOpt.data('role');
            settings.routerDefaultPosition = isNaN(pos) ? 4 : pos;
            settings.routerDefaultRole = roleVal !== undefined && roleVal !== '' ? parseInt(String(roleVal)) : 0;
            saveSettings();
            updateDefaultPositionFieldsVisibility();
        });

        $('#rpg_tracker_router_default_depth').on('input', function () {
            settings.routerDefaultDepth = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $('#rpg_tracker_router_default_order').on('input', function () {
            settings.routerDefaultOrder = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        // Active Lore Injection Settings Bindings
        const lorePosSelect = $('#rpg_tracker_lore_injection_position');
        const lorePosition = settings.loreInjectionPosition ?? 4;
        const loreRole = settings.loreInjectionRole ?? 0;
        const loreRoleAttr = lorePosition === 4 ? String(loreRole) : '';
        lorePosSelect.find(`option[value="${lorePosition}"][data-role="${loreRoleAttr}"]`).prop('selected', true);

        $('#rpg_tracker_lore_injection_depth').val(settings.loreInjectionDepth ?? 4);

        function updateLorePositionFieldsVisibility() {
            const posVal = parseInt(String(lorePosSelect.val() || '4'));
            const depthInpContainer = $('#rpg_tracker_lore_injection_depth_container');
            if (posVal === 4) {
                depthInpContainer.slideDown(200);
            } else {
                depthInpContainer.slideUp(200);
            }
        }
        updateLorePositionFieldsVisibility();

        lorePosSelect.on('change', function () {
            const selectedOpt = $(this).find(':selected');
            const pos = parseInt(String(selectedOpt.val() || '4'));
            const roleVal = selectedOpt.data('role');
            settings.loreInjectionPosition = isNaN(pos) ? 4 : pos;
            settings.loreInjectionRole = roleVal !== undefined && roleVal !== '' ? parseInt(String(roleVal)) : 0;
            saveSettings();
            updateLorePositionFieldsVisibility();
        });

        $('#rpg_tracker_lore_injection_depth').on('input', function () {
            settings.loreInjectionDepth = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $('#rpg_tracker_router_prompt').val(settings.routerSystemPromptTemplate).on('input', function () {
            settings.routerSystemPromptTemplate = String($(this).val() || '');
            saveSettings();
        });

        $('#rpg_tracker_router_modular_prompt').val(settings.routerModularPromptTemplate).on('input', function () {
            settings.routerModularPromptTemplate = String($(this).val() || '');
            saveSettings();
        });
        $('#rpg_tracker_router_btn_reset_prompt').on('click', function () {
            if (!confirm('Reset Router Agent prompt to default?')) return;

            // Delete the stored key so getSettings() falls back to the canonical default in state-manager.js
            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].routerSystemPromptTemplate;
            }
            const freshDefault = getSettings().routerSystemPromptTemplate;

            const s = getSettings();
            s.routerSystemPromptTemplate = freshDefault;

            const $el = $('#rpg_tracker_router_prompt');
            $el.val(freshDefault);
            $el.trigger('input');

            if (typeof (/** @type {any} */ ($el)).trigger === 'function') {
                (/** @type {any} */ ($el)).trigger('autosize.resize');
            }

            saveSettings();
            toastr['success']('Router prompt reset to default.', 'RPG Tracker');
        });

        $('#rpg_tracker_router_btn_reset_modular_prompt').on('click', function () {
            if (!confirm('Reset Modular Agent instruction to default?')) return;

            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].routerModularPromptTemplate;
            }
            const freshDefault = getSettings().routerModularPromptTemplate;

            const s = getSettings();
            s.routerModularPromptTemplate = freshDefault;

            const $el = $('#rpg_tracker_router_modular_prompt');
            $el.val(freshDefault);
            $el.trigger('input');

            if (typeof (/** @type {any} */ ($el)).trigger === 'function') {
                (/** @type {any} */ ($el)).trigger('autosize.resize');
            }

            saveSettings();
            toastr['success']('Modular instructions reset to default.', 'RPG Tracker');
        });

        // ── World Progression settings ─────────────────────────────────────────
        const $wpEnabled = $('#rpg_world_progression_enabled');
        const $wpInterval = $('#rpg_world_progression_interval');
        const $wpKeepActive = $('#rpg_world_progression_keep_active');
        const $wpHistoryLookback = $('#rpg_world_progression_history_lookback');
        const $wpRandomizeNPCs = $('#rpg_world_progression_randomize_npcs');
        const $wpRandomSkeletonNPCCount = $('#rpg_world_progression_random_skeleton_npc_count');
        const $wpRandomNarrativeNPCCount = $('#rpg_world_progression_random_narrative_npc_count');
        const $wpRandomNPCCountContainer = $('#rpg_world_progression_random_npc_count_container');
        const $wpRandomizeLocations = $('#rpg_world_progression_randomize_locations');
        const $wpRandomSkeletonLocationCount = $('#rpg_world_progression_random_skeleton_location_count');
        const $wpRandomNarrativeLocationCount = $('#rpg_world_progression_random_narrative_location_count');
        const $wpRandomLocationCountContainer = $('#rpg_world_progression_random_location_count_container');
        const $wpRandomizeFactions = $('#rpg_world_progression_randomize_factions');
        const $wpRandomSkeletonFactionCount = $('#rpg_world_progression_random_skeleton_faction_count');
        const $wpRandomNarrativeFactionCount = $('#rpg_world_progression_random_narrative_faction_count');
        const $wpRandomFactionCountContainer = $('#rpg_world_progression_random_faction_count_container');

        const $wpLookback = $('#rpg_world_progression_lookback');
        const $wpSystemPrompt = $('#rpg_world_progression_system_prompt');
        const $wpResetPrompt = $('#rpg_world_progression_btn_reset_prompt');
        const $wpLastFired = $('#rpg_world_progression_last_fired');
        const $wpLastReportVal = $('#rpg_world_progression_last_report_val');
        const $wpNextReportVal = $('#rpg_world_progression_next_report_val');
        const $wpGenerateNow = $('#rpg_world_progression_generate_now');

        /** Refreshes the "Last generated:" read-only display. */
        function updateWorldProgressionLastFiredDisplay() {
            const s = getSettings();
            const label = s.worldProgressionLastFiredPeriodLabel || '';
            const mins = label ? parseInWorldTime(label) : -1;

            const lastReportText = label || 'Never';
            $wpLastFired.text(lastReportText);
            $wpLastReportVal.text(lastReportText);

            const intervalHours = s.worldProgressionIntervalHours || 24;
            const intervalMinutes = intervalHours * 60;
            
            let nextMins = -1;
            if (mins >= 0) {
                nextMins = mins + intervalMinutes;
            } else {
                const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
                const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
                const currentMins = timeStr ? parseInWorldTime(timeStr) : -1;
                if (currentMins >= 0) {
                    nextMins = currentMins + intervalMinutes;
                }
            }
            $wpNextReportVal.text(nextMins >= 0 ? formatInWorldTime(nextMins) : '—');
            if (typeof updateAgentWorldStatusRef === 'function') {
                updateAgentWorldStatusRef();
            }
        }
        updateWorldProgressionLastFiredDisplayRef = updateWorldProgressionLastFiredDisplay;

        $wpEnabled.prop('checked', !!settings.worldProgressionEnabled).on('change', async function () {
            getSettings().worldProgressionEnabled = !!$(this).prop('checked');
            saveSettings();
            if (typeof updateAgentWorldStatusRef === 'function') {
                updateAgentWorldStatusRef();
            }
            if (_currentChatId) {
                await syncCampaignPrefixAndWorldsForChat(_currentChatId, 'toggle-world-progression');
            }
        });
        $wpInterval.val(settings.worldProgressionIntervalHours || 24).on('input', function () {
            getSettings().worldProgressionIntervalHours = parseInt(String($(this).val() || '')) || 24;
            saveSettings();
            updateWorldProgressionLastFiredDisplay();
        });

        $wpKeepActive.val(settings.worldProgressionKeepActive || 1).on('input', function () {
            getSettings().worldProgressionKeepActive = parseInt(String($(this).val() || '')) || 1;
            saveSettings();
        });
        $wpHistoryLookback.val(settings.worldProgressionHistoryLookback ?? 0).on('input', function () {
            getSettings().worldProgressionHistoryLookback = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        const $wpConsolidateEnabled = $('#rpg_world_progression_consolidate_enabled');
        const $wpConsolidateInterval = $('#rpg_world_progression_consolidate_interval');
        const $wpConsolidateIntervalContainer = $('#rpg_world_progression_consolidate_interval_container');

        function updateConsolidateVisibility() {
            if ($wpConsolidateEnabled.prop('checked')) {
                $wpConsolidateIntervalContainer.show();
            } else {
                $wpConsolidateIntervalContainer.hide();
            }
        }

        $wpConsolidateEnabled.prop('checked', !!settings.worldProgressionConsolidateEnabled).on('change', function () {
            getSettings().worldProgressionConsolidateEnabled = !!$(this).prop('checked');
            saveSettings();
            updateConsolidateVisibility();
        });
        $wpConsolidateInterval.val(settings.worldProgressionConsolidateInterval ?? 7).on('input', function () {
            getSettings().worldProgressionConsolidateInterval = parseInt(String($(this).val() || '')) || 7;
            saveSettings();
        });
        updateConsolidateVisibility();

        function updateRandomizersVisibility() {
            if ($wpRandomizeNPCs.prop('checked')) {
                $wpRandomNPCCountContainer.show();
            } else {
                $wpRandomNPCCountContainer.hide();
            }
            if ($wpRandomizeLocations.prop('checked')) {
                $wpRandomLocationCountContainer.show();
            } else {
                $wpRandomLocationCountContainer.hide();
            }
            if ($wpRandomizeFactions.prop('checked')) {
                $wpRandomFactionCountContainer.show();
            } else {
                $wpRandomFactionCountContainer.hide();
            }

        }

        $wpRandomizeNPCs.prop('checked', !!settings.worldProgressionRandomizeNPCs).on('change', function () {
            getSettings().worldProgressionRandomizeNPCs = !!$(this).prop('checked');
            saveSettings();
            updateRandomizersVisibility();
        });

        $wpRandomSkeletonNPCCount.val(settings.worldProgressionRandomSkeletonNPCCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomSkeletonNPCCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomNarrativeNPCCount.val(settings.worldProgressionRandomNarrativeNPCCount ?? 3).on('input', function () {
            getSettings().worldProgressionRandomNarrativeNPCCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomizeLocations.prop('checked', !!settings.worldProgressionRandomizeLocations).on('change', function () {
            getSettings().worldProgressionRandomizeLocations = !!$(this).prop('checked');
            saveSettings();
            updateRandomizersVisibility();
        });

        $wpRandomSkeletonLocationCount.val(settings.worldProgressionRandomSkeletonLocationCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomSkeletonLocationCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomNarrativeLocationCount.val(settings.worldProgressionRandomNarrativeLocationCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomNarrativeLocationCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomizeFactions.prop('checked', !!settings.worldProgressionRandomizeFactions).on('change', function () {
            getSettings().worldProgressionRandomizeFactions = !!$(this).prop('checked');
            saveSettings();
            updateRandomizersVisibility();
        });

        $wpRandomSkeletonFactionCount.val(settings.worldProgressionRandomSkeletonFactionCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomSkeletonFactionCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpRandomNarrativeFactionCount.val(settings.worldProgressionRandomNarrativeFactionCount ?? 2).on('input', function () {
            getSettings().worldProgressionRandomNarrativeFactionCount = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });



        updateRandomizersVisibility();

        $wpLookback.val(settings.worldProgressionLookback ?? 0).on('input', function () {
            getSettings().worldProgressionLookback = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });
        const $wpExclusionList = $('#rpg_world_progression_exclusion_list');
        $wpExclusionList.val(settings.worldProgressionExclusionList || '').on('input', function () {
            getSettings().worldProgressionExclusionList = String($(this).val() || '');
            saveSettings();
        });
        const $wpAutoExcludeParty = $('#rpg_world_progression_auto_exclude_party');
        $wpAutoExcludeParty.prop('checked', !!settings.worldProgressionAutoExcludeParty).on('change', function () {
            getSettings().worldProgressionAutoExcludeParty = !!$(this).prop('checked');
            saveSettings();
        });
        $wpSystemPrompt.val(settings.worldProgressionSystemPrompt || '').on('input', function () {
            getSettings().worldProgressionSystemPrompt = String($(this).val() || '');
            saveSettings();
        });
        $wpResetPrompt.on('click', function () {
            if (!confirm('Reset World Progression system prompt to default?')) return;
            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].worldProgressionSystemPrompt;
            }
            const freshDefault = getSettings().worldProgressionSystemPrompt;
            getSettings().worldProgressionSystemPrompt = freshDefault;
            $wpSystemPrompt.val(freshDefault);
            saveSettings();
            toastr['success']('World Progression prompt reset to default.', 'World Progression');
        });
        const $wpInjectionPosition = $('#rpg_world_progression_injection_position');
        const $wpInjectionDepth = $('#rpg_world_progression_injection_depth');
        const $wpInjectionDepthContainer = $('#rpg_world_progression_injection_depth_container');

        const wpPositionVal = settings.worldProgressionInjectionPosition ?? 4;
        const wpRoleVal = settings.worldProgressionInjectionRole ?? 0;
        const wpRoleAttrVal = wpPositionVal === 4 ? String(wpRoleVal) : '';
        $wpInjectionPosition.find(`option[value="${wpPositionVal}"][data-role="${wpRoleAttrVal}"]`).prop('selected', true);

        $wpInjectionDepth.val(settings.worldProgressionInjectionDepth ?? 3);

        function updateWpPositionFieldsVisibility() {
            const posVal = parseInt(String($wpInjectionPosition.val() || '4'));
            if (posVal === 4) {
                $wpInjectionDepthContainer.slideDown(200);
            } else {
                $wpInjectionDepthContainer.slideUp(200);
            }
        }
        updateWpPositionFieldsVisibility();

        $wpInjectionPosition.on('change', function () {
            const selectedOpt = $(this).find(':selected');
            const pos = parseInt(String(selectedOpt.val() || '4'));
            const roleVal = selectedOpt.data('role');
            settings.worldProgressionInjectionPosition = isNaN(pos) ? 4 : pos;
            settings.worldProgressionInjectionRole = roleVal !== undefined && roleVal !== '' ? parseInt(String(roleVal)) : 0;
            saveSettings();
            updateWpPositionFieldsVisibility();
        });

        $wpInjectionDepth.on('input', function () {
            settings.worldProgressionInjectionDepth = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        updateWorldProgressionLastFiredDisplay();

        // ── Override Next Report button ──────────────────────────────────────────
        $('#rpg_world_progression_btn_override_next').on('click', function () {
            const s = getSettings();
            const intervalHours = s.worldProgressionIntervalHours || 24;
            const intervalMinutes = intervalHours * 60;
            const currentLastMins = s.worldProgressionLastFiredAtMinutes ?? -1;
            const currentNextMins = currentLastMins >= 0 ? currentLastMins + intervalMinutes : intervalMinutes;

            function fmtHint(totalMins) {
                if (totalMins < 0) return s.useDdMmYyFormat ? '01/01/2026, 08:00 AM' : (s.use24hTime ? 'Day 1, 00:00' : 'Day 1, 12:00 AM');
                return formatInWorldTime(totalMins);
            }

            const acceptedFormats = s.useDdMmYyFormat
                ? 'Accepted formats: "06/01/2026, 08:00 AM", "06/01/2026, 08:00", "06/01/2026"'
                : 'Accepted formats: "Day 6, 08:00 AM", "Day 6, 08:00", "Day 6"';

            const userInput = window.prompt(
                'Enter the in-world time for the NEXT report.\n' + acceptedFormats,
                fmtHint(currentNextMins)
            );
            if (userInput === null) return; // cancelled

            const parsedNextMins = parseInWorldTime(userInput.trim());
            if (parsedNextMins <= 0) {
                const errorFormat = s.useDdMmYyFormat
                    ? 'Could not parse the entered time. Please use a format like "06/01/26, 08:00 AM".'
                    : 'Could not parse the entered time. Please use a format like "Day 6, 08:00 AM".';
                toastr['warning'](errorFormat, 'World Progression');
                return;
            }

            // Back-calculate: set label to what the period-end date would be at nextMins - interval
            const lastFiredMins = parsedNextMins - intervalMinutes;
            s.worldProgressionLastFiredPeriodLabel = formatInWorldTime(lastFiredMins);
            saveSettings();
            updateWorldProgressionLastFiredDisplay();
            toastr['success'](`Next report set to ${fmtHint(parsedNextMins)}.`, 'World Progression');
        });

        $wpGenerateNow.on('click', async function () {
            const { parseInWorldMinutes: piw, runWorldProgressionPass: rwp } = await import('./router.js');
            const s = getSettings();
            const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
            const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
            const currentMinutes = piw(timeStr);
            if (currentMinutes < 0) {
                toastr['warning']('Cannot parse in-world time from State Memo. Make sure the State Tracker has run at least once.', 'World Progression');
                return;
            }
            // Force fire by temporarily clearing lastFiredAtMinutes so it picks up the current period
            const savedLast = s.worldProgressionLastFiredAtMinutes;
            s.worldProgressionLastFiredAtMinutes = -1;
            $wpGenerateNow.prop('disabled', true).text('Generating…');
            try {
                await rwp(timeStr, currentMinutes);
                updateWorldProgressionLastFiredDisplay();
                toastr['success']('World Progression report generated.', 'World Progression');
            } catch (e) {
                toastr['error'](`World Progression error: ${e.message}`, 'World Progression');
                s.worldProgressionLastFiredAtMinutes = savedLast;
            } finally {
                $wpGenerateNow.prop('disabled', false).html('<i class="fa-solid fa-globe"></i> Generate Now (current period)');
            }
        });

        const $wpFireWithInstructions = $('#rpg_world_progression_fire_with_instructions');
        $wpFireWithInstructions.on('click', async function () {
            const { parseInWorldMinutes: piw, runWorldProgressionPass: rwp } = await import('./router.js');
            const s = getSettings();
            const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
            const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
            const currentMinutes = piw(timeStr);
            if (currentMinutes < 0) {
                toastr['warning']('Cannot parse in-world time from State Memo. Make sure the State Tracker has run at least once.', 'World Progression');
                return;
            }

            const popupBody = `
                <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box;">
                    <div style="font-size:13px; opacity:0.9; font-weight:bold;">🌍 Fire with Extra Instructions</div>
                    <div style="font-size:11px; opacity:0.7; line-height:1.4;">
                        Enter extra instructions to append to the World Progression system prompt for this run only (e.g., "make things pick up", "get more chaotic").
                    </div>
                    <textarea id="rt_wp_extra_instructions_settings" rows="4" class="text_pole"
                        style="font-size:12px; resize:vertical; width:100%;"
                        placeholder="e.g. Make the factions more aggressive, increase conflicts, or introduce a major weather event."></textarea>
                </div>
            `;

            let extraInstructions = '';
            setTimeout(() => {
                const textarea = document.getElementById('rt_wp_extra_instructions_settings');
                if (textarea) {
                    textarea.addEventListener('input', () => { extraInstructions = textarea.value.trim(); });
                }
            }, 100);

            const { Popup } = SillyTavern.getContext();
            const choice = await Popup.show.confirm('World Progression', popupBody, { okButton: 'Fire', cancelButton: 'Cancel' });
            if (!choice) return;

            // Force fire by temporarily clearing lastFiredAtMinutes so it picks up the current period
            const savedLast = s.worldProgressionLastFiredAtMinutes;
            s.worldProgressionLastFiredAtMinutes = -1;
            $wpFireWithInstructions.prop('disabled', true).text('Generating…');
            try {
                await rwp(timeStr, currentMinutes, extraInstructions);
                updateWorldProgressionLastFiredDisplay();
                toastr['success']('World Progression report generated.', 'World Progression');
            } catch (e) {
                toastr['error'](`World Progression error: ${e.message}`, 'World Progression');
                s.worldProgressionLastFiredAtMinutes = savedLast;
            } finally {
                $wpFireWithInstructions.prop('disabled', false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> Fire with Extra Instructions');
            }
        });

        // ── World Progression Reset Timeline ──
        const $wpResetTimeline = $('#rpg_world_progression_reset_timeline');
        $wpResetTimeline.on('click', function () {
            const s = getSettings();
            s.worldProgressionLastFiredAtMinutes = -1;
            s.worldProgressionLastFiredPeriodLabel = '';
            saveSettings();
            if (s.chatLinkEnabled && _currentChatId) saveChatState(_currentChatId);
            updateWorldProgressionLastFiredDisplay();
            if (typeof updateAgentWorldStatusRef === 'function') updateAgentWorldStatusRef();
            toastr['info']('World Progression timeline reset. Next report will start from the current time.', 'World Progression');
        });

        const $wpConsolidateCount = $('#rpg_world_progression_consolidate_count');
        const $wpConsolidateNow = $('#rpg_world_progression_btn_consolidate_now');

        $wpConsolidateNow.on('click', async function () {
            const count = parseInt(String($wpConsolidateCount.val() || '')) || 7;
            if (count < 2) {
                toastr['warning']('Please enter a count of at least 2 reports to consolidate.', 'World Progression');
                return;
            }
            if (!confirm(`Are you sure you want to consolidate the oldest ${count} raw reports right now?`)) {
                return;
            }

            const { runWorldProgressionConsolidationPass } = await import('./router.js');
            $wpConsolidateNow.prop('disabled', true).text('Consolidating…');
            try {
                const label = await runWorldProgressionConsolidationPass(count);
                toastr['success'](`Consolidated into "${label}".`, 'World Progression');
            } catch (e) {
                toastr['error'](`Consolidation error: ${e.message}`, 'World Progression');
            } finally {
                $wpConsolidateNow.prop('disabled', false).html('<i class="fa-solid fa-compress"></i> Consolidate Now');
            }
        });

        // ── World Skeleton wiring ───────────────────────────────────────────────
        const $wpSkeletonAtmosphere = $('#rpg_world_progression_skeleton_atmosphere');
        const $wpSkeletonAtmosphereLookback = $('#rpg_world_progression_skeleton_atmosphere_lookback');
        const $wpGenerateAtmosphere = $('#rpg_world_progression_btn_generate_atmosphere');
        const $wpSkeletonUseExisting = $('#rpg_world_progression_skeleton_use_existing');
        const $wpSkeletonFactions = $('#rpg_world_progression_skeleton_factions');
        const $wpSkeletonLocations = $('#rpg_world_progression_skeleton_locations');
        const $wpSkeletonNPCs = $('#rpg_world_progression_skeleton_npcs');
        const $wpSkeletonConflicts = $('#rpg_world_progression_skeleton_conflicts');
        const $wpSkeletonPrompt = $('#rpg_world_progression_skeleton_system_prompt');
        const $wpResetSkeletonPrompt = $('#rpg_world_progression_btn_reset_skeleton_prompt');
        const $wpGenerateSkeleton = $('#rpg_world_progression_btn_generate_skeleton');
        const $wpAddSkeleton = $('#rpg_world_progression_btn_add_skeleton');
        const $wpSkeletonStatus = $('#rpg_world_progression_skeleton_status');

        /** Refreshes the skeleton entry count label from the _Skeleton lorebook. */
        async function updateSkeletonStatus() {
            const ctx = SillyTavern.getContext();
            const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
            const skeletonBookName = prefix ? `${prefix}_Skeleton` : 'World_Skeleton';
            try {
                const book = await ctx.loadWorldInfo(skeletonBookName);
                const entries = book?.entries ? Object.values(book.entries) : [];
                const count = entries.length;

                // Per-category counts for pool display
                const npcCount = entries.filter(e => e.extensions?.rpgCategory === 'NPC').length;
                const locCount = entries.filter(e => e.extensions?.rpgCategory === 'LOC').length;
                const facCount = entries.filter(e => e.extensions?.rpgCategory === 'FAC').length;

                $wpSkeletonStatus.text(count > 0
                    ? `${count} skeleton entries in "${skeletonBookName}" (NPC: ${npcCount}, LOC: ${locCount}, FAC: ${facCount})`
                    : 'No skeleton generated.');

                // Update pool-count spans in the Focus Randomization section
                $('#rpg_world_progression_skeleton_npc_pool_count').text(npcCount);
                $('#rpg_world_progression_skeleton_location_pool_count').text(locCount);
                $('#rpg_world_progression_skeleton_faction_pool_count').text(facCount);
            } catch (_) {
                $wpSkeletonStatus.text('No skeleton generated.');
                $('#rpg_world_progression_skeleton_npc_pool_count').text('0');
                $('#rpg_world_progression_skeleton_location_pool_count').text('0');
                $('#rpg_world_progression_skeleton_faction_pool_count').text('0');
            }
        }


        $wpSkeletonAtmosphere.val(settings.worldProgressionSkeletonAtmosphereSummary || '').on('input', function () {
            getSettings().worldProgressionSkeletonAtmosphereSummary = String($(this).val() || '');
            saveSettings();
        });

        $wpSkeletonAtmosphereLookback.val(settings.worldProgressionSkeletonAtmosphereLookback ?? 30).on('input', function () {
            getSettings().worldProgressionSkeletonAtmosphereLookback = parseInt(String($(this).val() || '')) || 30;
            saveSettings();
        });

        $wpSkeletonUseExisting.prop('checked', !!settings.worldProgressionSkeletonUseExisting).on('change', function () {
            getSettings().worldProgressionSkeletonUseExisting = !!$(this).prop('checked');
            saveSettings();
        });

        $wpGenerateAtmosphere.on('click', async function () {
            const ctx = SillyTavern.getContext();
            if (!ctx.chat || ctx.chat.length === 0) {
                toastr['warning']('No chat history available. Please type some messages first.', 'World Skeleton');
                return;
            }
            const lookback = parseInt(String($wpSkeletonAtmosphereLookback.val() || '')) || 30;
            $wpGenerateAtmosphere.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Generating…');
            try {
                const { runAtmosphereGenerationPass } = await import('./router.js');
                const summary = await runAtmosphereGenerationPass(lookback);
                getSettings().worldProgressionSkeletonAtmosphereSummary = summary;
                $wpSkeletonAtmosphere.val(summary);
                saveSettings();
                toastr['success']('Atmosphere Summary auto-generated successfully.', 'World Skeleton');
            } catch (e) {
                toastr['error'](`Failed to generate Atmosphere Summary: ${e.message}`, 'World Skeleton');
            } finally {
                $wpGenerateAtmosphere.prop('disabled', false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> Auto-Generate');
            }
        });

        $wpSkeletonFactions.val(settings.worldProgressionSkeletonFactions ?? 4).on('input', function () {
            getSettings().worldProgressionSkeletonFactions = parseInt(String($(this).val() || '')) || 4;
            saveSettings();
        });

        $wpSkeletonLocations.val(settings.worldProgressionSkeletonLocations ?? 4).on('input', function () {
            getSettings().worldProgressionSkeletonLocations = parseInt(String($(this).val() || '')) || 4;
            saveSettings();
        });

        $wpSkeletonNPCs.val(settings.worldProgressionSkeletonNPCs ?? 0).on('input', function () {
            getSettings().worldProgressionSkeletonNPCs = parseInt(String($(this).val() || '')) || 0;
            saveSettings();
        });

        $wpSkeletonConflicts.val(settings.worldProgressionSkeletonConflicts ?? 3).on('input', function () {
            getSettings().worldProgressionSkeletonConflicts = parseInt(String($(this).val() || '')) || 3;
            saveSettings();
        });

        $wpSkeletonPrompt.val(settings.worldProgressionSkeletonSystemPrompt || '').on('input', function () {
            getSettings().worldProgressionSkeletonSystemPrompt = String($(this).val() || '');
            saveSettings();
        });

        $wpResetSkeletonPrompt.on('click', function () {
            if (!confirm('Reset World Skeleton system prompt to default?')) return;
            const { extensionSettings } = SillyTavern.getContext();
            if (extensionSettings[MODULE_NAME]) {
                delete extensionSettings[MODULE_NAME].worldProgressionSkeletonSystemPrompt;
            }
            const freshDefault = getSettings().worldProgressionSkeletonSystemPrompt;
            getSettings().worldProgressionSkeletonSystemPrompt = freshDefault;
            $wpSkeletonPrompt.val(freshDefault);
            saveSettings();
            toastr['success']('World Skeleton prompt reset to default.', 'World Skeleton');
        });

        $wpGenerateSkeleton.on('click', async function () {
            const atmosphere = String($wpSkeletonAtmosphere.val() || '').trim();
            if (!atmosphere) {
                toastr['warning']('Please enter an atmosphere summary before generating.', 'World Skeleton');
                return;
            }
            const ctx = SillyTavern.getContext();
            const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
            if (!prefix) {
                toastr['warning']('No campaign prefix set. Set a prefix or open a chat in SillyTavern first.', 'World Skeleton');
                return;
            }
            $wpGenerateSkeleton.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Generating…');
            try {
                const { runSkeletonGenerationPass } = await import('./router.js');
                const count = await runSkeletonGenerationPass(atmosphere, false);
                await updateSkeletonStatus();
                toastr['success'](`World Skeleton generated: ${count} entries created.`, 'World Skeleton');
            } catch (e) {
                toastr['error'](`World Skeleton error: ${e.message}`, 'World Skeleton');
            } finally {
                $wpGenerateSkeleton.prop('disabled', false).html('<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Skeleton');
            }
        });

        $wpAddSkeleton.on('click', async function () {
            const atmosphere = String($wpSkeletonAtmosphere.val() || '').trim();
            const useExisting = !!$wpSkeletonUseExisting.prop('checked');
            if (!useExisting && !atmosphere) {
                toastr['warning']('Please enter an atmosphere summary to provide context if not using existing entries.', 'World Skeleton');
                return;
            }
            const ctx = SillyTavern.getContext();
            const prefix = getEffectiveRouterCampaignPrefix(ctx.chatId || '');
            if (!prefix) {
                toastr['warning']('No campaign prefix set. Set a prefix or open a chat in SillyTavern first.', 'World Skeleton');
                return;
            }
            $wpAddSkeleton.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Adding…');
            try {
                const { runSkeletonGenerationPass } = await import('./router.js');
                const count = await runSkeletonGenerationPass(atmosphere, true, useExisting);
                await updateSkeletonStatus();
                toastr['success'](`World Skeleton updated: ${count} additional entries added.`, 'World Skeleton');
            } catch (e) {
                toastr['error'](`World Skeleton error: ${e.message}`, 'World Skeleton');
            } finally {
                $wpAddSkeleton.prop('disabled', false).html('<i class="fa-solid fa-plus"></i> Add to Skeleton');
            }
        });

        // Populate status on load
        updateSkeletonStatus();
        // Expose globally so router.js auto-generation can trigger a UI refresh
        globalThis._rpgUpdateSkeletonStatus = updateSkeletonStatus;
        // ── End World Progression settings ─────────────────────────────────────


        // Custom Sysprompt Mode toggle
        const customSyspromptCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_custom_sysprompt'));
        const narratorConfigBlock = document.getElementById('rpg_narrator_config_block');
        const syncNarratorBlockVisibility = () => {
            if (narratorConfigBlock) narratorConfigBlock.style.display = customSyspromptCb?.checked ? 'none' : '';
        };
        if (customSyspromptCb) {
            customSyspromptCb.checked = !!getSettings().customSysprompt;
            syncNarratorBlockVisibility();
            customSyspromptCb.addEventListener('change', function () {
                const fresh = getSettings();
                fresh.customSysprompt = !!this.checked;
                saveSettings();
                syncNarratorBlockVisibility();
                if (!fresh.customSysprompt) {
                    autoApplySysprompt();
                }
            });
        }

        $('#rpg_tracker_btn_update').on('click', async function () {
            const { chat } = SillyTavern.getContext();
            if (!chat || chat.length === 0) return toastr['info']("No chat history found.", "RPG Tracker");

            let lastAssistantMsg = "";
            for (let i = chat.length - 1; i >= 0; i--) {
                // Look for any message that isn't the user and isn't empty.
                // We include 'system' messages because some Narrator extensions/prompts
                // might mark their output as system, and we still want to track state from them.
                if (!chat[i].is_user && chat[i].mes && chat[i].mes.trim()) {
                    lastAssistantMsg = chat[i].mes;
                    break;
                }
            }
            if (!lastAssistantMsg) return toastr['info']("No assistant message with content found.", "RPG Tracker");

            toastr['info']("Triggering manual State Update...", "RPG Tracker");
            await runStateModelPass(lastAssistantMsg);
        });

        $('#rpg_tracker_btn_clear').on('click', function () {
            if (confirm("Are you sure you want to clear the memory history and wipe the tracker?")) {
                settings.currentMemo = "";
                settings.prevMemo1 = "";
                settings.prevMemo2 = "";
                settings.memoHistory = [];
                settings.lastDelta = "";
                settings.quests = [];
                settings.historyIndex = -1;
                _historyViewIndex = -1;
                saveSettings();
                updateUIMemo("");
                refreshRenderedView();
                const dp = document.getElementById('rpg-tracker-delta-content');
                if (dp) dp.innerHTML = '<span class="delta-empty">Log cleared.</span>';
                toastr['success']("RPG Tracker logic wiped.", "RPG Tracker");
            }
        });

        $('#rpg_tracker_btn_factory_reset').on('click', function () {
            if (confirm("⚠️ NUCLEAR OPTION ⚠️\n\nThis will wipe EVERYTHING: all custom fields, character history, saved profiles, and prompt changes. The framework will return to v1.1.0 factory defaults.\n\nProceed?")) {
                const { extensionSettings } = SillyTavern.getContext();
                delete extensionSettings[MODULE_NAME];
                // Force re-initialization of defaults
                getSettings();
                saveSettings();
                toastr['success']("Framework has been reset to factory defaults. Reloading in 2 seconds...", "RPG Tracker");
                setTimeout(() => location.reload(), 2000);
            }
        });

        // ── Profile System ──
        refreshProfileDropdown();

        $('#rpg_tracker_profile_save').on('click', function () {
            const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_profile_select'));
            const name = sel.value;
            if (!name) return toastr['info']('No profile selected to overwrite. Use "Save As" for new profiles.', 'RPG Tracker');
            saveProfile(name);
            toastr['success'](`Profile "${name}" overwritten.`, 'RPG Tracker');
        });

        $('#rpg_tracker_profile_save_as').on('click', async function () {
            const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_profile_select'));
            const existing = sel.value;
            const { Popup } = SillyTavern.getContext();

            let name = null;
            if (Popup && Popup.show && Popup.show.input) {
                name = await Popup.show.input('Save Profile', 'Save profile as:', existing || '');
            } else {
                name = prompt('Save profile as:', existing || '');
            }

            name = name?.trim();
            if (!name) return;
            saveProfile(name);
            refreshProfileDropdown();
            toastr['success'](`Profile "${name}" saved.`, 'RPG Tracker');
        });

        $('#rpg_tracker_profile_load').on('click', function () {
            const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_profile_select'));
            const name = sel.value;
            if (!name) return toastr['info']('No profile selected.', 'RPG Tracker');
            loadProfile(name);
            toastr['success'](`Profile "${name}" loaded.`, 'RPG Tracker');
        });

        $('#rpg_tracker_profile_delete').on('click', async function () {
            const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_profile_select'));
            const name = sel.value;
            if (!name) return toastr['info']('No profile selected.', 'RPG Tracker');

            const { Popup, POPUP_RESULT } = SillyTavern.getContext();
            if (Popup && Popup.show && Popup.show.confirm) {
                const confirmResult = await Popup.show.confirm('Delete Profile', `Delete profile "${name}"?`);
                if (confirmResult !== POPUP_RESULT.AFFIRMATIVE) return;
            } else {
                if (!confirm(`Delete profile "${name}"?`)) return;
            }

            deleteProfile(name);
            refreshProfileDropdown();
            toastr['success'](`Profile "${name}" deleted.`, 'RPG Tracker');
        });

    } catch (e) {
        console.error("[RPG Tracker] Failed to build settings UI", e);
    }

    // Add wand button to toggle panel visibility
    addWandButton();

    function updateTrackerFontSize(size) {
        const panel = document.getElementById('rpg-tracker-panel');
        if (!panel) return;
        const s = size || getSettings().fontSize || 13;
        panel.style.setProperty('--rt-base-size', s + 'px');

        // Also update CFE preview if open
        const cfe = document.getElementById('rt_cfe_preview');
        if (cfe) cfe.style.setProperty('--rt-base-size', s + 'px');
    }

    function updateAgentFontSize(size) {
        const s = size || getSettings().agentFontSize || 13;
        // Agent may be embedded in the main panel or detached to body
        for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#rpg-tracker-agent'))) {
            el.style.setProperty('--rt-base-size', s + 'px');
        }
    }

    function addWandButton() {
        const wandContainer = document.getElementById('extensionsMenu');
        if (!wandContainer) return;

        const btn = document.createElement('div');
        btn.id = 'toggle_rpg_tracker_wand_button';
        btn.classList.add('list-group-item', 'flex-container', 'flexGap5');

        btn.innerHTML = `
            <div class="fa-solid fa-clipboard-list extensionsMenuExtensionButton"></div>
            <span>Multihog D&D Framework</span>
        `;

        btn.addEventListener('click', () => {
            const panel = document.getElementById('rpg-tracker-panel');
            if (panel) {
                const isHidden = panel.style.display === 'none';
                panel.style.display = isHidden ? 'flex' : 'none';
                localStorage.setItem('rpg_tracker_visible', isHidden ? 'true' : 'false');
            }
        });

        wandContainer.appendChild(btn);
    }

    // ── Debug harness (safe to leave in — only runs when called manually) ──
    // Usage from DevTools console:
    //   window.rpgDebug.testCleanToolCall(someMessage)
    //   window.rpgDebug.testCleanToolCall()   <- uses last assistant message from chat
    const _dbgWin = /** @type {any} */ (window);
    _dbgWin.rpgDebug = _dbgWin.rpgDebug || {};
    _dbgWin.rpgDebug.testCleanToolCall = function (text) {
        if (text === undefined) {
            // Auto-grab the last non-user message from the current chat
            const { chat } = SillyTavern.getContext();
            const last = chat && [...chat].reverse().find(m => !m.is_user && m['role'] !== 'user');
            text = last ? (last.mes || last['content'] || '') : '';
            if (!text) { console.warn('[rpgDebug] No assistant message found in chat.'); return; }
        }
        const result = cleanToolCallMessage(text);
        const saved = text.length - result.length;
        console.group('%c[rpgDebug] cleanToolCallMessage', 'font-weight:bold;color:#7c4dff');
        console.log('%cINPUT  (%d chars)', 'color:#aaa', text.length, text);
        console.log('%cOUTPUT (%d chars)', 'color:#4caf50', result.length, result);
        console.log(
            saved > 0
                ? `%c✅ Stripped ${saved} chars (~${Math.round(saved / 4)} tokens)`
                : '%c⚠️  Nothing stripped — not a tool-call JSON (original returned unchanged)',
            `font-weight:bold;color:${saved > 0 ? '#4caf50' : '#f44336'}`
        );
        console.groupEnd();
        return result;
    };

})();

/**
 * Renders the debug info into the Agent panel's debug drawer.
 */

