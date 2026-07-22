import { getSettings } from './state-manager.js';
import {
    getArchetypesForGenre,
    generateQuickStartCharacter,
    generatePersonaBio,
    addPlayerCardToLorebookAgent,
    activateSillyTavernPersona,
} from './character-creator.js';
import { saveSettings, autoApplySysprompt } from './runtime-bridge.js';

/** @type {boolean} */
let _quickStartRunning = false;

const GENRE_LABELS = {
    fantasy: 'Fantasy',
    realistic: 'Modern',
    scifi: 'Sci-Fi',
    horror: 'Horror',
};

/**
 * @param {Uint32Array} [buf]
 * @returns {number} 0..1
 */
function secureRandom() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / (0xFFFFFFFF + 1);
}

/**
 * @param {string[]} list
 * @returns {string}
 */
function pickRandomArchetype(list) {
    if (!list.length) return 'Fighter';
    const idx = Math.floor(secureRandom() * list.length);
    return list[idx] || list[0];
}

/**
 * @param {HTMLElement|null} rootEl
 * @param {string} text
 */
function setQuickStartStatus(rootEl, text) {
    const status = rootEl?.querySelector('#rt-quickstart-status');
    if (status) status.textContent = text;
}

/**
 * @param {HTMLElement|null} rootEl
 * @param {boolean} disabled
 */
function setQuickStartBusy(rootEl, disabled) {
    if (!rootEl) return;
    rootEl.querySelectorAll('.rt-quickstart-genre-btn, .rt-random-char-btn').forEach((btn) => {
        /** @type {HTMLButtonElement} */ (btn).disabled = disabled;
    });
    const genBtn = /** @type {HTMLButtonElement|null} */ (rootEl.querySelector('#rt-cr-generate-btn'));
    if (genBtn) genBtn.disabled = disabled;
}

/**
 * Apply the player's current Narrator Configuration before Instant Action begins.
 */
async function applyQuickStartConfiguration() {
    saveSettings();
    await autoApplySysprompt(true);

    if (typeof globalThis._rpgRenderAgentModules === 'function') {
        globalThis._rpgRenderAgentModules();
    }
}

/**
 * Send an outgoing user chat message the same way CYOA buttons do.
 * @param {string} text
 */
function sendOutgoingChatMessage(text) {
    const textarea = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('send_textarea'));
    const sendBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('send_but'));
    if (!textarea || !sendBtn) {
        throw new Error('Chat input is not available.');
    }
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    sendBtn.click();
}

/**
 * Full Instant Action pipeline for one genre. Steps are strictly sequential.
 * @param {string} genre
 * @param {HTMLElement|null} [rootEl]
 */
export async function runQuickStart(genre, rootEl = null) {
    if (_quickStartRunning) {
        toastr['info']('Quick Start is already running. Please wait.', 'Quick Start');
        return;
    }

    const validGenre = ['fantasy', 'realistic', 'scifi', 'horror'].includes(genre) ? genre : 'fantasy';
    const root = rootEl || /** @type {HTMLElement|null} */ (document.querySelector('.rt-empty'));

    _quickStartRunning = true;
    setQuickStartBusy(root, true);

    try {
        setQuickStartStatus(root, 'Enabling systems…');
        await applyQuickStartConfiguration();

        const s = getSettings();
        s.onboardingGenre = validGenre;
        saveSettings();

        const archetypes = getArchetypesForGenre(validGenre);
        const className = pickRandomArchetype(archetypes);
        const level = parseInt(String(s.onboardingLevel || 1), 10) || 1;
        const gearTier = s.onboardingGearTier || 'auto';
        const wordCount = parseInt(String(s.onboardingPersonaWords || '150'), 10) || 150;
        const genreLabel = GENRE_LABELS[validGenre] || validGenre;

        setQuickStartStatus(root, `Creating character (${genreLabel} · ${className})…`);
        const { charName } = await generateQuickStartCharacter({
            genre: validGenre,
            className,
            level,
            gearTier,
        });

        setQuickStartStatus(root, 'Creating persona…');
        const bio = await generatePersonaBio(charName, wordCount);
        if (!bio) {
            throw new Error('Persona generation returned empty.');
        }
        const ok = await addPlayerCardToLorebookAgent(charName, bio, wordCount);
        if (!ok) {
            throw new Error('Could not add Player Card — no active chat.');
        }

        setQuickStartStatus(root, 'Activating chat persona…');
        await activateSillyTavernPersona(charName, bio);

        setQuickStartStatus(root, 'Starting adventure…');
        sendOutgoingChatMessage('Begin the adventure');

        setQuickStartStatus(root, `Ready — ${charName} (${className})`);
        toastr['success'](`Quick Start ready: ${charName} · ${className}`, 'Quick Start');
    } catch (err) {
        const msg = err?.message || String(err);
        console.error('[Quick Start]', err);
        setQuickStartStatus(root, 'Ready');
        toastr['error'](`Quick Start failed: ${msg}`, 'Quick Start', { timeOut: 8000 });
    } finally {
        _quickStartRunning = false;
        setQuickStartBusy(root, false);
    }
}

/**
 * Wire Quick Start genre buttons inside an onboarding root.
 * @param {HTMLElement} rootEl
 */
export function bindQuickStartEvents(rootEl) {
    if (!rootEl) return;
    const section = rootEl.querySelector('#rt-quickstart');
    if (!section || /** @type {any} */ (section)._qsBound) return;
    /** @type {any} */ (section)._qsBound = true;

    section.querySelectorAll('.rt-quickstart-genre-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const genre = /** @type {HTMLButtonElement} */ (btn).dataset.genre || 'fantasy';
            void runQuickStart(genre, rootEl);
        });
    });
}
