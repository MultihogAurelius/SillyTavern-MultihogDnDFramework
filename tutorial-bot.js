/**
 * tutorial-bot.js — Multihog D&D Framework help chat.
 * Morphs the State Tracker body into a multi-turn instructor chat.
 * Knowledge base: docs/multihogDnDdoc.md. LLM: State Tracker connection.
 */
import { sendAgentTurn } from './llm-client.js';
import { getSettings } from './state-manager.js';
import { runtimeState } from './src/app/runtime-state.js';

const FOLDER_NAME = (function () {
    try {
        const urlObj = new URL(import.meta.url);
        const parts = urlObj.pathname.split('/');
        const idx = parts.indexOf('third-party');
        if (idx !== -1 && idx + 1 < parts.length) {
            return decodeURIComponent(parts[idx + 1]);
        }
    } catch (_) { /* fall through */ }
    return 'SillyTavern-MultihogDnDFramework';
})();

const DOC_URL = `/scripts/extensions/third-party/${FOLDER_NAME}/docs/multihogDnDdoc.md`;
const HISTORY_STORAGE_KEY = 'rpg_tracker_tutorial_chat';

const PERSONA = `You are the Multihog D&D Framework Tutorial Bot — a concise in-app instructor for SillyTavern users.

Rules:
- Answer only questions about Multihog D&D Framework (setup, State Tracker, RNG, Lorebook Agent, World Progression, quests, CYOA, cartridges, UI, slash commands, troubleshooting).
- Treat the DOCUMENTATION block below as your source of truth. Prefer it over guesswork.
- Be brief and practical. Use short steps or bullet lists when explaining how-tos.
- If the docs do not cover something, say you are unsure rather than inventing settings, IDs, or behavior.
- Do not roleplay as the Game Master or invent campaign story. Stay in help mode.
- Do not claim you can change the user's settings or run the tracker for them unless they ask how to do it themselves.`;

/** @type {string|null} */
let _docCache = null;
/** @type {Promise<string>|null} */
let _docPromise = null;

/** @type {Array<{role:'user'|'assistant', content:string}>} */
let _history = loadHistory();

/**
 * @returns {Array<{role:'user'|'assistant', content:string}>}
 */
function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m) => ({ role: m.role, content: m.content }));
    } catch (_) {
        return [];
    }
}

function saveHistory() {
    try {
        if (_history.length === 0) {
            localStorage.removeItem(HISTORY_STORAGE_KEY);
        } else {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(_history));
        }
    } catch (err) {
        console.warn('[Tutorial Bot] Could not persist chat:', err);
    }
}

/** @type {boolean} */
let _tutorialMode = false;
/** @type {boolean} */
let _busy = false;
/** @type {AbortController|null} */
let _abort = null;

/** @type {HTMLElement|null} */
let _panel = null;

/**
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** @type {import('showdown').Converter|null} */
let _mdConverter = null;

/**
 * Fallback markdown → HTML when showdown is unavailable.
 * @param {string} text
 * @returns {string}
 */
function formatBotHtmlFallback(text) {
    const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inList = false;

    const closeList = () => {
        if (inList) {
            out.push('</ul>');
            inList = false;
        }
    };

    const inline = (s) => {
        let t = escapeHtml(s);
        t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
        t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
        return t;
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        const heading = line.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
            closeList();
            const level = heading[1].length;
            out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
            continue;
        }
        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        if (bullet) {
            if (!inList) {
                out.push('<ul>');
                inList = true;
            }
            out.push(`<li>${inline(bullet[1])}</li>`);
            continue;
        }
        if (!line.trim()) {
            closeList();
            continue;
        }
        closeList();
        out.push(`<p>${inline(line.trim())}</p>`);
    }
    closeList();
    return out.join('') || '<p></p>';
}

/**
 * Render assistant markdown to safe HTML (showdown when available).
 * @param {string} text
 * @returns {string}
 */
function formatBotHtml(text) {
    const showdownLib = globalThis.showdown;
    if (showdownLib?.Converter) {
        if (!_mdConverter) {
            _mdConverter = new showdownLib.Converter({
                tables: true,
                strikethrough: true,
                simpleLineBreaks: true,
                disableForced4SpacesIndentedSublists: true,
                literalMidWordUnderscores: true,
            });
        }
        let html = _mdConverter.makeHtml(String(text ?? ''));
        const purify = globalThis.DOMPurify;
        if (purify?.sanitize) {
            html = purify.sanitize(html, {
                USE_PROFILES: { html: true },
            });
        }
        return html;
    }
    return formatBotHtmlFallback(text);
}

async function loadDocumentation() {
    if (_docCache != null) return _docCache;
    if (_docPromise) return _docPromise;
    _docPromise = (async () => {
        try {
            const res = await fetch(DOC_URL, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            _docCache = await res.text();
        } catch (err) {
            console.warn('[Tutorial Bot] Failed to load docs:', err);
            _docCache = '(Documentation file could not be loaded. Answer from general Multihog knowledge and admit uncertainty.)';
        }
        return _docCache;
    })();
    return _docPromise;
}

function buildSystemPrompt(doc) {
    return `${PERSONA}\n\n--- DOCUMENTATION ---\n${doc}\n--- END DOCUMENTATION ---`;
}

export function isTutorialMode() {
    return _tutorialMode;
}

/**
 * Ensure the chat shell exists inside #rt-tutorial-view.
 * @param {HTMLElement} panel
 */
function ensureChatShell(panel) {
    const host = panel.querySelector('#rt-tutorial-view');
    if (!(host instanceof HTMLElement)) return null;
    if (host.dataset.rtTutorialReady === '1') return host;

    host.innerHTML = `
        <div class="rt-tutorial-header">
            <button type="button" class="rpg-tracker-nav-btn rt-tutorial-back" id="rt-tutorial-back" title="Back to State Tracker">← Back</button>
            <span class="rt-tutorial-title">Tutorial Bot</span>
            <button type="button" class="rpg-tracker-nav-btn rt-tutorial-clear" id="rt-tutorial-clear" title="Clear conversation">Clear</button>
        </div>
        <div class="rt-tutorial-messages" id="rt-tutorial-messages" role="log" aria-live="polite"></div>
        <div class="rt-tutorial-composer">
            <textarea class="rt-tutorial-input" id="rt-tutorial-input" rows="2" placeholder="Ask how Multihog works… (Enter to send, Shift+Enter for newline)"></textarea>
            <button type="button" class="rpg-tracker-prompt-send rt-tutorial-send" id="rt-tutorial-send" title="Send">▶</button>
        </div>
    `;
    host.dataset.rtTutorialReady = '1';
    return host;
}

function getMessageEl() {
    return _panel?.querySelector('#rt-tutorial-messages') || null;
}

function renderTranscript() {
    const box = getMessageEl();
    if (!box) return;
    if (_history.length === 0) {
        box.innerHTML = `
            <div class="rt-tutorial-msg rt-tutorial-msg-bot rt-tutorial-welcome">
                <div class="rt-tutorial-msg-label">Tutorial Bot</div>
                <div class="rt-tutorial-msg-body">Ask me anything about Multihog — setup, Instant Action, State Tracker modules, Hybrid RNG, Lorebook Agent, World Progression, quests, CYOA, cartridges, or troubleshooting. I use the built-in documentation as my source of truth.</div>
            </div>`;
        return;
    }
    box.innerHTML = _history.map((m) => {
        const isUser = m.role === 'user';
        const cls = isUser ? 'rt-tutorial-msg-user' : 'rt-tutorial-msg-bot';
        const label = isUser ? 'You' : 'Tutorial Bot';
        const body = isUser ? escapeHtml(m.content).replace(/\n/g, '<br>') : formatBotHtml(m.content);
        return `<div class="rt-tutorial-msg ${cls}"><div class="rt-tutorial-msg-label">${label}</div><div class="rt-tutorial-msg-body">${body}</div></div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

function setBusy(busy) {
    _busy = busy;
    const send = _panel?.querySelector('#rt-tutorial-send');
    const input = _panel?.querySelector('#rt-tutorial-input');
    if (send instanceof HTMLButtonElement) {
        send.disabled = busy;
        send.textContent = busy ? '…' : '▶';
    }
    if (input instanceof HTMLTextAreaElement) input.disabled = busy;
}

/**
 * Keep HELP button chrome in sync and drop sticky mobile focus/hover.
 * @param {boolean} on
 */
function syncHelpButton(on) {
    if (!_panel) return;
    const helpBtn = _panel.querySelector('#rpg-tracker-help-btn');
    if (!(helpBtn instanceof HTMLElement)) return;
    helpBtn.classList.toggle('active', on);
    helpBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    helpBtn.title = on ? 'Exit Tutorial Bot' : 'Tutorial Bot (HELP)';
    // Mobile browsers leave :hover/:focus stuck after tap; blur clears the green chrome.
    if (!on) {
        helpBtn.blur();
    }
}

/**
 * Hide tracker body chrome while tutorial is active; restore on exit.
 * @param {boolean} on
 */
function applyMorph(on) {
    if (!_panel) return;
    const memo = _panel.querySelector('#rpg-tracker-memo');
    const render = _panel.querySelector('#rpg-tracker-render');
    const tutorial = _panel.querySelector('#rt-tutorial-view');
    const delta = _panel.querySelector('#rpg-tracker-delta');
    const promptBar = _panel.querySelector('#rpg-tracker-prompt-bar');
    const trackerPane = _panel.querySelector('#rt-panel-tracker-pane');

    if (on) {
        if (memo instanceof HTMLElement) memo.style.display = 'none';
        if (render instanceof HTMLElement) render.style.display = 'none';
        if (delta instanceof HTMLElement) delta.style.display = 'none';
        if (promptBar instanceof HTMLElement) promptBar.style.display = 'none';
        if (tutorial instanceof HTMLElement) {
            tutorial.style.display = 'flex';
        }
        if (trackerPane instanceof HTMLElement) {
            trackerPane.classList.add('rt-tutorial-mode');
        }
        _panel.classList.add('rt-tutorial-active');
        syncHelpButton(true);
    } else {
        if (tutorial instanceof HTMLElement) tutorial.style.display = 'none';
        if (trackerPane instanceof HTMLElement) {
            trackerPane.classList.remove('rt-tutorial-mode');
        }
        _panel.classList.remove('rt-tutorial-active');
        syncHelpButton(false);

        // Restore memo vs rendered view
        const wantRender = !!runtimeState.renderedViewActive;
        if (memo instanceof HTMLElement) memo.style.display = wantRender ? 'none' : '';
        if (render instanceof HTMLElement) render.style.display = wantRender ? 'block' : 'none';
    }
}

export function exitTutorialMode() {
    if (!_tutorialMode) return;
    if (_abort) {
        try { _abort.abort(); } catch (_) { /* ignore */ }
        _abort = null;
    }
    setBusy(false);
    _tutorialMode = false;
    applyMorph(false);
}

/**
 * Switch panel to tracker tab if needed, then enter tutorial chat.
 */
export function enterTutorialMode() {
    if (!_panel) {
        _panel = /** @type {HTMLElement|null} */ (document.getElementById('rpg-tracker-panel'));
    }
    if (!_panel) {
        toastr['warning']('State Tracker panel is not available yet.', 'Tutorial Bot');
        return;
    }

    ensureChatShell(_panel);

    // Ensure tracker tab (not Lorebook Agent)
    const agentMode = getSettings().trackerContentMode === 'agent'
        && localStorage.getItem('rpg_tracker_agent_detached') !== 'true';
    if (agentMode) {
        const trackerTab = _panel.querySelector('#rt-panel-mode-tracker');
        if (trackerTab instanceof HTMLElement) trackerTab.click();
    }

    // Expand if collapsed
    if (_panel.classList.contains('rt-panel-collapsed')) {
        const collapseBtn = _panel.querySelector('#rpg-tracker-collapse-btn');
        if (collapseBtn instanceof HTMLElement) collapseBtn.click();
    }

    _tutorialMode = true;
    applyMorph(true);
    renderTranscript();
    void loadDocumentation();
    const input = _panel.querySelector('#rt-tutorial-input');
    if (input instanceof HTMLTextAreaElement) {
        setTimeout(() => input.focus(), 50);
    }
}

export function toggleTutorialMode() {
    if (_tutorialMode) exitTutorialMode();
    else enterTutorialMode();
}

/**
 * Show the tracker panel and open tutorial mode (settings entry).
 */
export function openTutorialBot() {
    let panel = document.getElementById('rpg-tracker-panel');
    if (!(panel instanceof HTMLElement)) {
        toastr['warning']('State Tracker panel is not available yet.', 'Tutorial Bot');
        return;
    }
    _panel = panel;

    if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        localStorage.setItem('rpg_tracker_visible', 'true');
    }

    ensureChatShell(panel);
    enterTutorialMode();
}

async function sendMessage() {
    if (!_panel || _busy) return;
    const input = /** @type {HTMLTextAreaElement|null} */ (_panel.querySelector('#rt-tutorial-input'));
    const text = (input?.value || '').trim();
    if (!text) return;

    if (input) input.value = '';
    _history.push({ role: 'user', content: text });
    saveHistory();
    renderTranscript();

    const box = getMessageEl();
    if (box) {
        const pending = document.createElement('div');
        pending.className = 'rt-tutorial-msg rt-tutorial-msg-bot rt-tutorial-pending';
        pending.id = 'rt-tutorial-pending';
        pending.innerHTML = '<div class="rt-tutorial-msg-label">Tutorial Bot</div><div class="rt-tutorial-msg-body">Thinking…</div>';
        box.appendChild(pending);
        box.scrollTop = box.scrollHeight;
    }

    setBusy(true);
    _abort = new AbortController();

    try {
        const doc = await loadDocumentation();
        const systemPrompt = buildSystemPrompt(doc);
        const messages = [
            { role: 'system', content: systemPrompt },
            ..._history.map((m) => ({ role: m.role, content: m.content })),
        ];
        const result = await sendAgentTurn(getSettings(), messages, null, _abort.signal);
        const reply = (result?.content || '').trim() || '(No response from the model.)';
        _history.push({ role: 'assistant', content: reply });
    } catch (err) {
        if (err?.name === 'AbortError') {
            _history.push({ role: 'assistant', content: '(Cancelled.)' });
        } else {
            console.error('[Tutorial Bot]', err);
            const msg = err?.message || String(err);
            _history.push({
                role: 'assistant',
                content: `I could not reach the model. Check State Tracker connection settings.\n\n${msg}`,
            });
            toastr['error']('Tutorial Bot request failed — see chat.', 'Tutorial Bot');
        }
    } finally {
        _abort = null;
        setBusy(false);
        saveHistory();
        _panel?.querySelector('#rt-tutorial-pending')?.remove();
        renderTranscript();
    }
}

function clearChat() {
    if (_busy) return;
    _history = [];
    saveHistory();
    renderTranscript();
}

/**
 * Wire HELP / chat controls on the tracker panel. Call once after panel create.
 * @param {HTMLElement} panel
 */
export function bindTutorialBot(panel) {
    if (!(panel instanceof HTMLElement)) return;
    _panel = panel;
    ensureChatShell(panel);

    const helpBtn = panel.querySelector('#rpg-tracker-help-btn');
    if (helpBtn && !helpBtn.dataset.rtTutorialBound) {
        helpBtn.dataset.rtTutorialBound = '1';
        helpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleTutorialMode();
            // Second tap on mobile can leave sticky :hover; blur after toggle settles.
            if (!isTutorialMode() && helpBtn instanceof HTMLElement) {
                helpBtn.blur();
            }
        });
    }

    const backBtn = panel.querySelector('#rt-tutorial-back');
    if (backBtn && !backBtn.dataset.rtTutorialBound) {
        backBtn.dataset.rtTutorialBound = '1';
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exitTutorialMode();
        });
    }

    const clearBtn = panel.querySelector('#rt-tutorial-clear');
    if (clearBtn && !clearBtn.dataset.rtTutorialBound) {
        clearBtn.dataset.rtTutorialBound = '1';
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearChat();
        });
    }

    const sendBtn = panel.querySelector('#rt-tutorial-send');
    if (sendBtn && !sendBtn.dataset.rtTutorialBound) {
        sendBtn.dataset.rtTutorialBound = '1';
        sendBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            void sendMessage();
        });
    }

    const input = panel.querySelector('#rt-tutorial-input');
    if (input instanceof HTMLTextAreaElement && !input.dataset.rtTutorialBound) {
        input.dataset.rtTutorialBound = '1';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
            }
        });
    }

    // Leaving tracker tab exits tutorial so agent UI is not trapped
    const agentTab = panel.querySelector('#rt-panel-mode-agent');
    if (agentTab && !agentTab.dataset.rtTutorialBound) {
        agentTab.dataset.rtTutorialBound = '1';
        agentTab.addEventListener('click', () => {
            if (_tutorialMode) exitTutorialMode();
        }, true);
    }
}
