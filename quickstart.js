import { getSettings } from './state-manager.js';
import {
    getArchetypesForGenre,
    generateQuickStartCharacter,
    generatePersonaBio,
    addPlayerCardToLorebookAgent,
    activateSillyTavernPersona,
} from './character-creator.js';
import { saveSettings, autoApplySysprompt } from './src/app/runtime-bridge.js';
import { pickGenreCharacterName } from './src/state/character-names.js';
import {
    buildInstantActionOpeningMessage,
    buildInstantActionPromptSection,
    extractInstantActionLevel,
    normalizeInstantActionInstructions,
    resolveInstantActionPlayerCardWords,
    resolveInstantActionStartingLevel,
} from './src/state/instant-action-instructions.js';

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
    rootEl.querySelectorAll('.rt-quickstart button, .rt-random-char-btn').forEach((btn) => {
        /** @type {HTMLButtonElement} */ (btn).disabled = disabled;
    });
    rootEl.querySelectorAll('.rt-quickstart input, .rt-quickstart textarea').forEach((field) => {
        /** @type {HTMLInputElement|HTMLTextAreaElement} */ (field).disabled = disabled;
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
 * @param {string} [selectedName]
 * @param {string} [instructionText]
 */
export async function runQuickStart(genre, rootEl = null, selectedName = '', instructionText = '') {
    if (_quickStartRunning) {
        toastr['info']('Quick Start is already running. Please wait.', 'Quick Start');
        return;
    }

    const validGenre = ['fantasy', 'realistic', 'scifi', 'horror'].includes(genre) ? genre : 'fantasy';
    const root = rootEl || /** @type {HTMLElement|null} */ (document.querySelector('.rt-empty'));
    const nameVal = String(selectedName || '').trim();
    const instantActionInstructions = normalizeInstantActionInstructions(instructionText);

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
        const noLevel = s.onboardingLevel === 'none';
        const randomLevel = s.onboardingInstantActionRandomLevel === true;
        const level = resolveInstantActionStartingLevel({
            noLevel,
            randomLevel,
            random: secureRandom,
        });
        const gearTier = s.onboardingGearTier || 'auto';
        const wordCount = resolveInstantActionPlayerCardWords(
            s.onboardingPersonaWords || '150',
            s.onboardingPersonaWordsCustom,
        );
        const genreLabel = GENRE_LABELS[validGenre] || validGenre;
        const setupLevel = extractInstantActionLevel(instantActionInstructions);
        const levelDetail = setupLevel != null
            ? `Lv ${setupLevel} (Initial Setup)`
            : (noLevel ? 'no levels' : `Lv ${level}`);
        const creationDetails = [
            genreLabel,
            instantActionInstructions ? 'custom setup' : className,
            nameVal || 'AI-chosen name',
            levelDetail,
        ].join(' · ');

        setQuickStartStatus(root, `Creating character (${creationDetails})…`);
        const { charName } = await generateQuickStartCharacter({
            genre: validGenre,
            className,
            level,
            gearTier,
            nameVal,
            instantActionInstructions,
        });

        setQuickStartStatus(root, 'Creating Lorebook Agent Player Card…');
        const bio = await generatePersonaBio(
            charName,
            wordCount,
            buildInstantActionPromptSection(instantActionInstructions),
        );
        if (!bio) {
            throw new Error('Persona generation returned empty.');
        }
        const ok = await addPlayerCardToLorebookAgent(charName, bio, wordCount);
        if (!ok) {
            throw new Error('Could not add Player Card — no active chat.');
        }

        setQuickStartStatus(root, 'Creating name-only chat persona…');
        await activateSillyTavernPersona(charName);

        const readyDetail = instantActionInstructions ? 'custom instructions' : className;
        if (s.onboardingSendStarterMessage !== false) {
            setQuickStartStatus(root, 'Starting adventure…');
            sendOutgoingChatMessage(buildInstantActionOpeningMessage(instantActionInstructions));
            setQuickStartStatus(root, `Ready — ${charName} (${readyDetail})`);
        } else {
            setQuickStartStatus(root, `Ready — ${charName} (${readyDetail}). Type your first action.`);
        }
        toastr['success'](`Quick Start ready: ${charName} · ${readyDetail}`, 'Quick Start');
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

    const genreButtons = [...section.querySelectorAll('.rt-quickstart-genre-btn')];
    const rollButton = /** @type {HTMLButtonElement|null} */ (section.querySelector('#rt-quickstart-roll-name'));
    const startButton = /** @type {HTMLButtonElement|null} */ (section.querySelector('#rt-quickstart-begin'));
    const nameInput = /** @type {HTMLInputElement|null} */ (section.querySelector('#rt-quickstart-name'));
    const instructionsInput = /** @type {HTMLTextAreaElement|null} */ (section.querySelector('#rt-quickstart-instructions'));
    const wordCountSelect = /** @type {HTMLSelectElement|null} */ (section.querySelector('#rt-quickstart-persona-words'));
    const wordCountCustom = /** @type {HTMLInputElement|null} */ (section.querySelector('#rt-quickstart-persona-words-custom'));
    const sendStarterCheckbox = /** @type {HTMLInputElement|null} */ (section.querySelector('#rt-quickstart-send-starter'));
    const randomLevelCheckbox = /** @type {HTMLInputElement|null} */ (section.querySelector('#rt-quickstart-random-level'));
    let selectedGenre = '';
    let selectedName = '';

    const persistQuickStartOptions = () => {
        const s = getSettings();
        if (wordCountSelect) s.onboardingPersonaWords = wordCountSelect.value || '150';
        if (wordCountCustom) s.onboardingPersonaWordsCustom = wordCountCustom.value;
        if (wordCountCustom) wordCountCustom.style.display = wordCountSelect?.value === 'other' ? 'block' : 'none';
        if (sendStarterCheckbox) s.onboardingSendStarterMessage = !!sendStarterCheckbox.checked;
        if (randomLevelCheckbox) s.onboardingInstantActionRandomLevel = !!randomLevelCheckbox.checked;
        saveSettings();
    };

    genreButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectedGenre = /** @type {HTMLButtonElement} */ (btn).dataset.genre || 'fantasy';
            genreButtons.forEach((genreButton) => {
                const isSelected = genreButton === btn;
                genreButton.classList.toggle('is-selected', isSelected);
                genreButton.setAttribute('aria-pressed', String(isSelected));
            });
            if (rollButton) rollButton.disabled = false;
            if (startButton) startButton.disabled = false;
            setQuickStartStatus(rootEl, `${GENRE_LABELS[selectedGenre] || selectedGenre} selected — name optional`);
        });
    });

    rollButton?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedGenre) return;
        selectedName = pickGenreCharacterName(selectedGenre);
        if (nameInput) nameInput.value = selectedName;
        if (startButton) startButton.disabled = false;
        setQuickStartStatus(rootEl, 'Name ready — reroll or begin');
    });

    nameInput?.addEventListener('input', () => {
        selectedName = nameInput.value.trim();
        if (selectedName) {
            setQuickStartStatus(rootEl, 'Name ready — edit, reroll, or begin');
        } else if (selectedGenre) {
            setQuickStartStatus(rootEl, 'Name blank — the AI will choose');
        }
    });

    wordCountSelect?.addEventListener('change', persistQuickStartOptions);
    wordCountCustom?.addEventListener('input', persistQuickStartOptions);
    sendStarterCheckbox?.addEventListener('change', persistQuickStartOptions);
    randomLevelCheckbox?.addEventListener('change', persistQuickStartOptions);

    startButton?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedGenre) return;
        persistQuickStartOptions();
        void runQuickStart(selectedGenre, rootEl, selectedName, instructionsInput?.value || '');
    });
}
