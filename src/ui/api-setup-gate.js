/**
 * First-open API checklist. SillyTavern still defaults to Text Completion and
 * cramped token sliders. This overlay shows live status checkboxes; it is not
 * a hard gate and can always be dismissed.
 */

import { getSettings } from '../state/settings-ref.js';
import { saveSettings } from '../app/runtime-bridge.js';
import { GAME_MASTER_CARD_NAME, resolveNarratorCardName } from './game-master-card-lib.js';

export const CHAT_COMPLETION_API = 'openai';
export const RECOMMENDED_OUTPUT_LENGTH = 100000;

const OVERLAY_ID = 'rt-api-setup-gate';
const PULSE_CLASS = 'rt-api-setup-pulse';
const API_SCREENSHOT = '/scripts/extensions/third-party/SillyTavern-MultihogDnDFramework/assets/st-api-chat-completion.png';

const API_LABELS = {
    openai: 'Chat Completion',
    textgenerationwebui: 'Text Completion',
    novel: 'NovelAI',
    koboldhorde: 'AI Horde',
    kobold: 'KoboldAI Classic',
};

const CHECKLIST_ITEMS = [
    {
        id: 'chatCompletion',
        title: 'Chat Completion is enabled',
        body: 'Text Completion is a legacy API that was relevant before ChatGPT came out. Do not use it.',
        shot: true,
    },
    {
        id: 'functionCalling',
        title: 'Function calling is enabled',
        body: 'This is crucial to use the more effective version of tools in Multihog D&D, though there is a "MacGyver" path available if you absolutely can\'t use tools.',
    },
    {
        id: 'maxContextUnlocked',
        title: 'Maximum context size is unlimited',
        body: 'There is no reason to limit this today, and in fact there are reasons not to. You\'re supposed to use a {{summarizer}}, which hides messages, so your context is never larger than 30k or so anyway. Imposing an artificial context limit does nothing but destroy your cache hits, which means you pay more. Context caps are from an era before people figured out how to summarize context.',
    },
    {
        id: 'outputLength',
        title: 'Output length is set to 100,000',
        body: 'The defaults are extremely low, which make the program completely unusable from the get-go. The model will suddenly stop outputting, and the user is confused. Or worse: an agent is outputting a JSON object and the model hits this pathetic cap, truncating the JSON and giving a schema/syntax error.\n\nThe result is that my extension throws an error and looks broken. However, this is just another bad default.',
    },
];

export function getSillyTavernMainApi() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const fromContext = String(ctx?.mainApi || '').trim();
        if (fromContext) return fromContext;
    } catch (_) { /* context not ready */ }
    if (typeof document === 'undefined') return '';
    return String(document.querySelector('#main_api')?.value || '').trim();
}

export function isChatCompletionApi(api = getSillyTavernMainApi()) {
    return api === CHAT_COMPLETION_API;
}

export function describeMainApi(api = getSillyTavernMainApi()) {
    const id = String(api || '').trim();
    if (!id) return 'not set';
    return API_LABELS[id] || id;
}

export function getChatCompletionSettings() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const settings = ctx?.chatCompletionSettings;
        if (settings && typeof settings === 'object') return settings;
    } catch (_) { /* context not ready */ }
    return null;
}

function readBoolSetting(settings, key, selector) {
    if (settings && typeof settings[key] === 'boolean') return settings[key];
    if (typeof document === 'undefined') return false;
    return !!document.querySelector(selector)?.checked;
}

function readNumberSetting(settings, key, selector) {
    if (settings && Number.isFinite(Number(settings[key]))) return Number(settings[key]);
    if (typeof document === 'undefined') return 0;
    const raw = document.querySelector(selector)?.value;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

export function isFunctionCallingEnabled(settings = getChatCompletionSettings()) {
    return readBoolSetting(settings, 'function_calling', '#openai_function_calling');
}

export function isMaxContextUnlocked(settings = getChatCompletionSettings()) {
    return readBoolSetting(settings, 'max_context_unlocked', '#oai_max_context_unlocked');
}

export function isOutputLengthRecommended(settings = getChatCompletionSettings()) {
    return readNumberSetting(settings, 'openai_max_tokens', '#openai_max_tokens') >= RECOMMENDED_OUTPUT_LENGTH;
}

export function getApiSetupStatuses() {
    const settings = getChatCompletionSettings();
    return {
        chatCompletion: isChatCompletionApi(),
        functionCalling: isFunctionCallingEnabled(settings),
        maxContextUnlocked: isMaxContextUnlocked(settings),
        outputLength: isOutputLengthRecommended(settings),
    };
}

export function shouldShowApiSetupGate(seen) {
    if (seen === true || seen === false) return seen !== true;
    try {
        return getSettings().apiSetupGateSeen !== true;
    } catch (_) {
        return true;
    }
}

function markGateSeen() {
    try {
        const settings = getSettings();
        settings.apiSetupGateSeen = true;
        saveSettings();
    } catch (_) { /* init race */ }
}

function setDomCheckbox(selector, checked) {
    if (typeof document === 'undefined') return false;
    const el = /** @type {HTMLInputElement|null} */ (document.querySelector(selector));
    if (!el) return false;
    const jq = globalThis.$;
    if (jq && typeof jq === 'function') {
        jq(el).prop('checked', checked).trigger('input');
        return !!el.checked === checked;
    }
    el.checked = checked;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return !!el.checked === checked;
}

function setDomNumber(selector, value) {
    if (typeof document === 'undefined') return false;
    const el = /** @type {HTMLInputElement|null} */ (document.querySelector(selector));
    if (!el) return false;
    const max = Number(el.max);
    if (Number.isFinite(max) && max < value) el.max = String(value);
    const jq = globalThis.$;
    if (jq && typeof jq === 'function') {
        jq(el).val(value).trigger('input');
        return Number(el.value) === value;
    }
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return Number(el.value) === value;
}

export function switchSillyTavernToChatCompletion() {
    if (typeof document === 'undefined') return false;
    const select = /** @type {HTMLSelectElement|null} */ (document.querySelector('#main_api'));
    if (!select) return false;
    const option = select.querySelector(`option[value="${CHAT_COMPLETION_API}"]`);
    if (!option) return false;
    const jq = globalThis.$;
    if (jq && typeof jq === 'function') {
        jq(select).val(CHAT_COMPLETION_API).trigger('change');
        return select.value === CHAT_COMPLETION_API;
    }
    if (select.value !== CHAT_COMPLETION_API) {
        select.value = CHAT_COMPLETION_API;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return select.value === CHAT_COMPLETION_API;
}

export function applyRecommendedApiSettings() {
    switchSillyTavernToChatCompletion();
    try {
        const settings = getChatCompletionSettings();
        if (settings) {
            settings.function_calling = true;
            settings.max_context_unlocked = true;
            settings.openai_max_tokens = RECOMMENDED_OUTPUT_LENGTH;
        }
    } catch (_) { /* settings bag not ready */ }
    setDomCheckbox('#openai_function_calling', true);
    setDomCheckbox('#oai_max_context_unlocked', true);
    const applyOutput = () => {
        try {
            const settings = getChatCompletionSettings();
            if (settings) settings.openai_max_tokens = RECOMMENDED_OUTPUT_LENGTH;
        } catch (_) { /* ignore */ }
        setDomNumber('#openai_max_tokens', RECOMMENDED_OUTPUT_LENGTH);
    };
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
        window.setTimeout(applyOutput, 150);
    } else {
        applyOutput();
    }
    return getApiSetupStatuses();
}

export function revealSillyTavernApiDropdown() {
    if (typeof document === 'undefined') return false;
    const select = /** @type {HTMLSelectElement|null} */ (document.querySelector('#main_api'));
    if (!select) return false;
    let node = select.parentElement;
    while (node && node !== document.body) {
        if (node instanceof HTMLElement && node.style.display === 'none') node.style.display = '';
        node = node.parentElement;
    }
    const drawer = select.closest('.drawer-content, .inline-drawer-content, #rm_api_block');
    if (drawer instanceof HTMLElement && drawer.style.display === 'none') drawer.style.display = '';
    select.classList.add(PULSE_CLASS);
    try { select.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { /* ignore */ }
    try { select.focus(); } catch (_) { /* ignore */ }
    window.setTimeout(() => select.classList.remove(PULSE_CLASS), 8000);
    return true;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const SUMMARIZER_LINK = '<a href="https://github.com/Lodactio/Extension-Summaryception" target="_blank" rel="noopener noreferrer">summarizer</a>';

function renderBody(text) {
    return escapeHtml(text)
        .replace(/\n\n/g, '</span><span class="rt-api-setup-item-why">')
        .replace(/\{\{summarizer\}\}/g, SUMMARIZER_LINK);
}

function renderChecklist(statuses) {
    return CHECKLIST_ITEMS.map(item => {
        const ok = !!statuses[item.id];
        const shot = item.shot
            ? `<img class="rt-api-setup-shot" src="${API_SCREENSHOT}" alt="SillyTavern API dropdown with Chat Completion selected">`
            : '';
        return `
            <div class="rt-api-setup-item${ok ? ' is-ok' : ''}">
                <input type="checkbox" disabled ${ok ? 'checked' : ''} aria-label="${escapeHtml(item.title)}">
                <span>
                    <span class="rt-api-setup-item-title">${escapeHtml(item.title)}</span>
                    <span class="rt-api-setup-item-why">${renderBody(item.body)}</span>
                    ${shot}
                </span>
            </div>`;
    }).join('');
}

export function buildOverlayHtml(statuses = getApiSetupStatuses(), options = {}) {
    const doneCount = Object.values(statuses).filter(Boolean).length;
    const narratorCardName = resolveNarratorCardName(options.narratorCardName);
    return `
        <div class="rt-api-setup-card" role="dialog" aria-labelledby="rt-api-setup-title">
            <div class="rt-api-setup-scroll">
            <div class="rt-api-setup-kicker">Anti-Museum Tour</div>
            <h2 id="rt-api-setup-title">SillyTavern API settings to check</h2>
            <p>This menu is a result of months of taking &quot;bug reports&quot; from people and discovering 98% of the time the cause was the defaults of SillyTavern. People get JSON syntax errors and other stuff, and it turns out it&apos;s because ST makes its maximum output length far too low by default.</p>
            <div class="rt-api-setup-list" id="rt-api-setup-list">
                ${renderChecklist(statuses)}
            </div>
            <div class="rt-api-setup-gm-block">
                <div class="rt-api-setup-gm-row">
                    <label class="rt-api-setup-gm-label" for="rt-api-setup-gm-name">Narrator card name</label>
                    <input id="rt-api-setup-gm-name" class="rt-api-setup-gm-name text_pole" type="text" value="${escapeHtml(narratorCardName)}" placeholder="${escapeHtml(GAME_MASTER_CARD_NAME)}" maxlength="120">
                    <button type="button" class="rt-api-setup-create-gm" id="rt-api-setup-create-gm">Create narrator card</button>
                </div>
                <p class="rt-api-setup-gm-note">Multihog doesn&apos;t use a one-on-one chat format but uses a format written like a book, that seamlessly allows for multiple characters. The messages are attributed to a narrator, not a single character.</p>
            </div>
            <div class="rt-api-setup-status ${doneCount === 4 ? 'rt-api-setup-status-ok' : 'rt-api-setup-status-bad'}">
                ${doneCount} / 4 recommended settings are on. Current API: <b>${escapeHtml(describeMainApi())}</b>.
            </div>
            </div>
            <div class="rt-api-setup-actions">
                <button type="button" class="rt-api-setup-apply" id="rt-api-setup-apply">Apply recommended settings</button>
                <button type="button" class="rt-api-setup-show" id="rt-api-setup-show">Highlight the API dropdown</button>
                <button type="button" class="rt-api-setup-continue" id="rt-api-setup-continue">Continue</button>
            </div>
            <p class="rt-api-setup-foot">This screen will not appear automatically after you continue. Reopen it anytime from General &amp; Visuals → Core &amp; Branching → Anti-Museum Tour.</p>
        </div>`;
}

function readNarratorCardNameFromOverlay(overlay) {
    const input = /** @type {HTMLInputElement|null} */ (overlay?.querySelector('#rt-api-setup-gm-name'));
    return resolveNarratorCardName(input?.value);
}

function refreshIfOpen() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    const narratorCardName = readNarratorCardNameFromOverlay(overlay);
    overlay.innerHTML = buildOverlayHtml(getApiSetupStatuses(), { narratorCardName });
    bindOverlayControls(overlay);
}

function bindOverlayControls(overlay) {
    overlay.querySelector('#rt-api-setup-apply')?.addEventListener('click', () => {
        const switched = switchSillyTavernToChatCompletion();
        applyRecommendedApiSettings();
        if (!switched) revealSillyTavernApiDropdown();
        refreshIfOpen();
        if (typeof window !== 'undefined') window.setTimeout(refreshIfOpen, 180);
    });
    overlay.querySelector('#rt-api-setup-show')?.addEventListener('click', () => {
        revealSillyTavernApiDropdown();
    });
    overlay.querySelector('#rt-api-setup-create-gm')?.addEventListener('click', async () => {
        const btn = /** @type {HTMLButtonElement|null} */ (overlay.querySelector('#rt-api-setup-create-gm'));
        const name = readNarratorCardNameFromOverlay(overlay);
        if (btn) btn.disabled = true;
        try {
            const { createOrSelectGameMasterCard } = await import('./game-master-card.js');
            await createOrSelectGameMasterCard({ name });
        } finally {
            if (btn) btn.disabled = false;
        }
    });
    overlay.querySelector('#rt-api-setup-continue')?.addEventListener('click', () => {
        markGateSeen();
        overlay.remove();
    });
}

export function hideApiSetupGate() {
    if (typeof document === 'undefined') return;
    document.getElementById(OVERLAY_ID)?.remove();
}

export function showApiSetupGate() {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'rt-api-setup-gate';
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = buildOverlayHtml(getApiSetupStatuses());
    bindOverlayControls(overlay);
}

export function syncApiSetupGate() {
    if (shouldShowApiSetupGate()) showApiSetupGate();
    else hideApiSetupGate();
}

function bindLiveStatusRefresh() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const eventSource = ctx?.eventSource;
        const eventTypes = ctx?.eventTypes || ctx?.event_types;
        if (eventSource?.on) {
            if (eventTypes?.MAIN_API_CHANGED) eventSource.on(eventTypes.MAIN_API_CHANGED, refreshIfOpen);
            if (eventTypes?.SETTINGS_UPDATED) eventSource.on(eventTypes.SETTINGS_UPDATED, refreshIfOpen);
        }
    } catch (_) { /* ST events not ready */ }
    if (typeof document === 'undefined') return;
    document.addEventListener('change', (event) => {
        if (event.target?.id === 'main_api') refreshIfOpen();
    }, true);
    document.addEventListener('input', (event) => {
        const id = event.target?.id;
        if (id === 'openai_function_calling' || id === 'oai_max_context_unlocked' || id === 'openai_max_tokens') {
            refreshIfOpen();
        }
    }, true);
}

export function installApiSetupGate() {
    if (typeof document === 'undefined') return;
    syncApiSetupGate();
    bindLiveStatusRefresh();
}
