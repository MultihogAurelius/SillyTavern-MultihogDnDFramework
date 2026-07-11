import { getSettings, saveChatState, DEFAULT_PC_SECTIONS } from './state-manager.js';
import { sendStateRequest } from './llm-client.js';
import { buildOnboardingXpHint } from './constants.js';
import { escapeHtml } from './memo-processor.js';
import { getRequestHeaders } from '../../../../script.js';
import { saveSettings, sendDirectPrompt, refreshAgentManifestNow, refreshRenderedView } from './index.js';
import { openPcSectionEditor } from './ui-editors.js';

const _CR_CLASS_LISTS = {
    fantasy: [
        ['⚔️ Fighter','Fighter'],['🗡️ Rogue','Rogue'],['🧙 Wizard','Wizard'],
        ['🔥 Sorcerer','Sorcerer'],['🌑 Warlock','Warlock'],['🙏 Paladin','Paladin'],
        ['🏹 Ranger','Ranger'],['🐻 Druid','Druid'],['🎵 Bard','Bard'],
        ['☯️ Monk','Monk'],['🛡️ Barbarian','Barbarian'],['🧝 Cleric','Cleric'],
        ['🔮 Artificer','Artificer'],['🩸 Blood Hunter','Blood Hunter'],
        ['🐉 Draconic Bloodline','Draconic Bloodline'],['🌿 Nature Shaman','Nature Shaman'],
        ['🔱 Death Knight','Death Knight'],['🎯 Arcane Archer','Arcane Archer'],
        ['🌟 Celestial Chosen','Celestial Chosen'],['💀 Necromancer','Necromancer'],
    ],
    realistic: [
        ['💼 Detective','Detective'],['🩺 Doctor','Doctor'],['💊 Medic','Medic'],
        ['🔬 Scientist','Scientist'],['🔫 Soldier','Soldier'],['🕵️ Agent','Agent'],
        ['🚑 Paramedic','Paramedic'],['⚖️ Lawyer','Lawyer'],['🔧 Mechanic','Mechanic'],
        ['💻 Hacker','Hacker'],['🎤 Journalist','Journalist'],['🏋️ Athlete','Athlete'],
        ['👮 Officer','Officer'],['🎭 Con Artist','Con Artist'],['📦 Smuggler','Smuggler'],
        ['🧑‍🍳 Chef','Chef'],['💰 Entrepreneur','Entrepreneur'],
        ['📡 Tech Specialist','Tech Specialist'],['🪖 Contractor','Contractor'],
        ['🧠 Psychologist','Psychologist'],
    ],
    scifi: [
        ['🚀 Starship Pilot','Starship Pilot'],['🔫 Space Marine','Space Marine'],
        ['🤖 Cyberneticist','Cyberneticist'],['🌌 Navigator','Navigator'],
        ['🧬 Xenobiologist','Xenobiologist'],['💻 Netrunner','Netrunner'],
        ['⚡ Power Armor Trooper','Power Armor Trooper'],['🛰️ Recon Scout','Recon Scout'],
        ['☢️ Reactor Tech','Reactor Tech'],['🩺 Combat Medic','Combat Medic'],
        ['💀 Bounty Hunter','Bounty Hunter'],['📡 Comms Officer','Comms Officer'],
        ['🔬 Research Scientist','Research Scientist'],['🛠️ Ship Engineer','Ship Engineer'],
        ['🌍 Terraformer','Terraformer'],['🔮 Psyker','Psyker'],
        ['🕵️ Intel Operative','Intel Operative'],['🏴‍☠️ Space Pirate','Space Pirate'],
        ['🧙 Biopunk Shaman','Biopunk Shaman'],['⚖️ Colonial Administrator','Colonial Administrator'],
    ],
    horror: [
        ['🕵️ Paranormal Investigator','Paranormal Investigator'],['📖 Occultist','Occultist'],
        ['🔪 Survivor','Survivor'],['🏥 Traumatized Doctor','Traumatized Doctor'],
        ['👮 Sheriff','Sheriff'],['🎤 Journalist','Journalist'],['🧠 Psychologist','Psychologist'],
        ['🕯️ Cult Escapee','Cult Escapee'],['🔫 Vigilante','Vigilante'],
        ['🧛 Reluctant Monster','Reluctant Monster'],['🌙 Cursed Bloodline','Cursed Bloodline'],
        ['📜 Forbidden Scholar','Forbidden Scholar'],['⛪ Fallen Priest','Fallen Priest'],
        ['🎲 Desperate Gambler','Desperate Gambler'],['🔧 Doomsday Prepper','Doomsday Prepper'],
        ['💀 Ghost Whisperer','Ghost Whisperer'],['🩹 Haunted Soldier','Haunted Soldier'],
        ['🏚️ Urban Explorer','Urban Explorer'],['🔍 Cold Case Detective','Cold Case Detective'],
        ['🌊 Sea-Cursed Sailor','Sea-Cursed Sailor'],
    ],
};
const _CR_CLASS_CONSTANTS = [
    ['📝 Other — type below…','__other__'],
    ['✨ AI decides','__story__'],
];

/** @returns {Record<string, string|number|boolean>} */
export function collectCharacterCreatorDraft(panel) {
    const classSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-class'));
    const wordsSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-persona-words'));
    const wordsCustom = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-cr-persona-words-custom'));
    return {
        name: /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-name'))?.value ?? '',
        gender: /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-gender'))?.value ?? '',
        age: /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-age'))?.value ?? '',
        orientation: /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-orientation'))?.value ?? '',
        species: /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-species'))?.value ?? '',
        ethnicity: /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-ethnicity'))?.value ?? '',
        genre: /** @type {HTMLSelectElement} */ (panel.querySelector('#rt-cr-genre'))?.value ?? '',
        level: /** @type {HTMLSelectElement} */ (panel.querySelector('#rt-cr-level'))?.value ?? '1',
        class: classSelect?.value ?? '__story__',
        classOther: /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-class-other'))?.value ?? '',
        traits: /** @type {HTMLTextAreaElement} */ (panel.querySelector('#rt-cr-traits'))?.value ?? '',
        abilities: /** @type {HTMLTextAreaElement} */ (panel.querySelector('#rt-cr-abilities'))?.value ?? '',
        background: /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-background'))?.value ?? '',
        appearance: /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-appearance'))?.value ?? '',
        additional: /** @type {HTMLTextAreaElement} */ (panel.querySelector('#rt-cr-additional'))?.value ?? '',
        personaEnabled: !!/** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-persona-cb'))?.checked,
        personaWords: wordsSelect?.value ?? '150',
        personaWordsCustom: wordsCustom?.value ?? '',
    };
}

/**
 * @param {HTMLElement} panel
 * @param {object} draft
 * @param {(genre: string) => void} populateClasses
 */
export function applyCharacterCreatorDraft(panel, draft, populateClasses) {
    if (!draft) return;
    const setVal = (sel, val) => { const el = panel.querySelector(sel); if (el) el.value = val ?? ''; };
    setVal('#rt-cr-name', draft.name);
    setVal('#rt-cr-gender', draft.gender);
    setVal('#rt-cr-age', draft.age);
    setVal('#rt-cr-orientation', draft.orientation);
    setVal('#rt-cr-species', draft.species);
    setVal('#rt-cr-ethnicity', draft.ethnicity);
    setVal('#rt-cr-genre', draft.genre ?? '');
    setVal('#rt-cr-level', String(draft.level ?? 1));
    populateClasses(draft.genre ?? '');
    const classSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-class'));
    const classOther = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-cr-class-other'));
    if (classSelect) {
        const classVal = draft.class ?? '__story__';
        if ([...classSelect.options].some(o => o.value === classVal)) {
            classSelect.value = classVal;
        } else {
            classSelect.value = '__story__';
        }
    }
    if (classOther) {
        classOther.value = draft.classOther ?? '';
        classOther.style.display = classSelect?.value === '__other__' ? 'block' : 'none';
    }
    setVal('#rt-cr-traits', draft.traits);
    setVal('#rt-cr-abilities', draft.abilities);
    setVal('#rt-cr-background', draft.background);
    setVal('#rt-cr-appearance', draft.appearance);
    setVal('#rt-cr-additional', draft.additional);
    const personaCb = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-cr-persona-cb'));
    if (personaCb) personaCb.checked = !!draft.personaEnabled;
    const wordsSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-persona-words'));
    const wordsCustom = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-cr-persona-words-custom'));
    if (wordsSelect) wordsSelect.value = draft.personaWords ?? '150';
    if (wordsCustom) {
        wordsCustom.value = draft.personaWordsCustom ?? '';
        wordsCustom.style.display = wordsSelect?.value === 'other' ? 'inline-block' : 'none';
    }
}

/** @param {HTMLElement} panel */
export function saveCharacterCreatorDraft(panel) {
    getSettings().characterCreatorDraft = collectCharacterCreatorDraft(panel);
    saveSettings();
}

/**
 * @param {HTMLElement} panel
 * @param {(genre: string) => void} populateClasses
 */
export function resetCharacterCreatorFields(panel, populateClasses) {
    const s = getSettings();
    getSettings().characterCreatorDraft = null;
    const setVal = (sel, val) => { const el = panel.querySelector(sel); if (el) el.value = val; };
    setVal('#rt-cr-name', '');
    setVal('#rt-cr-gender', '');
    setVal('#rt-cr-age', '');
    setVal('#rt-cr-orientation', '');
    setVal('#rt-cr-species', '');
    setVal('#rt-cr-ethnicity', '');
    setVal('#rt-cr-genre', '');
    setVal('#rt-cr-level', String(s.onboardingLevel || 1));
    populateClasses('');
    const classSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-class'));
    if (classSelect) classSelect.value = '__story__';
    const classOther = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-cr-class-other'));
    if (classOther) { classOther.value = ''; classOther.style.display = 'none'; }
    setVal('#rt-cr-traits', '');
    setVal('#rt-cr-abilities', '');
    setVal('#rt-cr-background', '');
    setVal('#rt-cr-appearance', '');
    setVal('#rt-cr-additional', '');
    const personaCb = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-cr-persona-cb'));
    if (personaCb) personaCb.checked = false;
    const wordsSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-persona-words'));
    const wordsCustom = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-cr-persona-words-custom'));
    if (wordsSelect) wordsSelect.value = '150';
    if (wordsCustom) { wordsCustom.value = ''; wordsCustom.style.display = 'none'; }
    saveSettings();
}

/**
 * Shows the inline Character Roll panel inside the .rt-empty onboarding area.
 * @param {HTMLElement} el - the .rt-empty element
 */
export function showCharacterRollPanel(el) {
    const panel = /** @type {HTMLElement|null} */ (el.querySelector('#rt-char-roll-panel'));
    if (!panel) return;
    const configWrap = /** @type {HTMLElement|null} */ (el.querySelector('.rt-onboarding-config-row')?.parentElement);
    const allBtnGroups = /** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll('.rt-onboarding-buttons'));

    // Hide config + button groups, show panel
    if (configWrap) configWrap.style.display = 'none';
    allBtnGroups.forEach(g => { g.style.display = 'none'; });
    panel.style.display = 'flex';

    const editBtn = panel.querySelector('.rt-edit-pc-sections-btn');
    if (editBtn && !editBtn._bound) {
        editBtn._bound = true;
        editBtn.addEventListener('click', () => openPcSectionEditor());
    }

    const s = getSettings();
    const genreSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-genre'));
    const levelSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-level'));
    const classSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-class'));
    const classOther  = /** @type {HTMLInputElement|null}  */ (panel.querySelector('#rt-cr-class-other'));

    function populateClasses(genre) {
        if (!classSelect) return;
        // Empty genre (None) = only show Story-Fitting + Other; AI decides
        const genreList = genre ? (_CR_CLASS_LISTS[genre] || _CR_CLASS_LISTS.fantasy) : [];
        const list = [...genreList, ..._CR_CLASS_CONSTANTS];
        classSelect.innerHTML = list.map(([label, val]) =>
            `<option value="${escapeHtml(val)}">${escapeHtml(label)}</option>`
        ).join('');
        // Always default to Story-Fitting
        classSelect.value = '__story__';
    }
    populateClasses('');

    const draft = s.characterCreatorDraft;
    if (draft) {
        applyCharacterCreatorDraft(panel, draft, populateClasses);
    } else {
        // Default genre to '' (None — AI decides); do NOT carry over onboardingGenre here
        if (genreSelect) genreSelect.value = '';
        if (levelSelect) levelSelect.value = String(s.onboardingLevel || 1);
    }

    const nameInput = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-cr-name'));
    const randomNameBtn = panel.querySelector('#rt-cr-random-name');
    if (randomNameBtn && nameInput && !randomNameBtn._bound) {
        randomNameBtn._bound = true;
        randomNameBtn.addEventListener('click', () => {
            const firsts = [
                "Aethelgard", "Elysande", "Ilaria", "Lyari", "Mirelia", "Nesta", "Seraphina", "Thalia", "Valerith", "Zephira",
                "Aelrin", "Calandil", "Elessar", "Faelan", "Galdor", "Ithilior", "Lorien", "Sylas", "Thandor", "Zoran",
                "Astrid", "Bregna", "Dagmar", "Freja", "Gunnora", "Hilda", "Kira", "Morgath", "Sigrid", "Yrsa",
                "Bram", "Cormac", "Drogo", "Fenrir", "Garrick", "Haldor", "Kaelen", "Ragnar", "Thorgar", "Wulfric",
                "Belial", "Carmilla", "Drusilla", "Lilith", "Malakor", "Morrigan", "Nox", "Sariel", "Vespera", "Xanthia",
                "Alastor", "Caspian", "Darius", "Kaelen", "Malakai", "Nekros", "Soren", "Valerius", "Vane", "Zarek",
                "Astraea", "Celestia", "Elora", "Isra", "Lunaria", "Nova", "Selene", "Solana", "Talia", "Vega",
                "Aero", "Caelum", "Hyperion", "Orion", "Phobos", "Rigel", "Sirius", "Titan", "Zephyr", "Zion"
            ];
            const lasts = [
                "Blackwood", "Crownguard", "Ironclad", "Kingsley", "Silverglade", "Stormborn", "Thorne", "Valerius", "Winterborne", "Zephyr",
                "Barker", "Clay", "Fletcher", "Miller", "Potter", "Smith", "Tanner", "Weaver", "Wood", "Wright"
            ];
            const first = firsts[Math.floor(Math.random() * firsts.length)];
            const last = lasts[Math.floor(Math.random() * lasts.length)];
            nameInput.value = `${first} ${last}`;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    if (genreSelect && !genreSelect._crBound) {
        genreSelect._crBound = true;
        genreSelect.addEventListener('change', () => {
            populateClasses(genreSelect.value);
            if (classOther) classOther.style.display = 'none';
        });
    }
    if (classSelect && !classSelect._crBound) {
        classSelect._crBound = true;
        classSelect.addEventListener('change', () => {
            if (classOther) classOther.style.display = classSelect.value === '__other__' ? 'block' : 'none';
        });
    }

    const wordsSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-persona-words'));
    const wordsCustom = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-cr-persona-words-custom'));
    if (wordsSelect && !wordsSelect._crBound) {
        wordsSelect._crBound = true;
        wordsSelect.addEventListener('change', () => {
            if (wordsCustom) wordsCustom.style.display = wordsSelect.value === 'other' ? 'inline-block' : 'none';
        });
    }

    const backBtn = panel.querySelector('#rt-char-roll-back');
    if (backBtn && !backBtn._crBound) {
        backBtn._crBound = true;
        backBtn.addEventListener('click', () => {
            panel.style.display = 'none';
            if (configWrap) configWrap.style.display = '';
            const genre = getSettings().onboardingGenre || 'fantasy';
            allBtnGroups.forEach(g => {
                g.style.display = g.classList.contains(`rt-${genre}-buttons`) ? 'flex' : 'none';
            });
        });
    }

    const resetBtn = panel.querySelector('#rt-cr-reset-btn');
    if (resetBtn && !resetBtn._crBound) {
        resetBtn._crBound = true;
        resetBtn.addEventListener('click', () => resetCharacterCreatorFields(panel, populateClasses));
    }

    const genBtn = panel.querySelector('#rt-cr-generate-btn');
    if (genBtn && !genBtn._crBound) {
        genBtn._crBound = true;
        genBtn.addEventListener('click', () => { void handleCharRollGenerate(el, panel); });
    }

    // --- Presets ---
    const presetSelect  = panel.querySelector('#rt-cr-preset-select');
    const loadPresetBtn = panel.querySelector('#rt-cr-preset-load-btn');
    const delPresetBtn  = panel.querySelector('#rt-cr-preset-delete-btn');
    const savePresetBtn = panel.querySelector('#rt-cr-preset-save-btn');

    function renderPresetPills() {
        if (!presetSelect) return;
        const saved = presetSelect.value; // preserve selection if possible
        presetSelect.innerHTML = '<option value="">— Select preset —</option>';
        const presets = (getSettings().characterCreatorPresets || []);
        presets.forEach((preset) => {
            const opt = document.createElement('option');
            opt.value = preset.id;
            opt.textContent = preset.name;
            presetSelect.appendChild(opt);
        });
        // Restore selection if it still exists
        if (saved && presetSelect.querySelector(`option[value="${saved}"]`)) {
            presetSelect.value = saved;
        }
    }

    renderPresetPills();

    if (loadPresetBtn && !loadPresetBtn._crBound) {
        loadPresetBtn._crBound = true;
        loadPresetBtn.addEventListener('click', () => {
            const id = presetSelect?.value;
            if (!id) return;
            const preset = (getSettings().characterCreatorPresets || []).find(p => p.id === id);
            if (!preset) return;
            applyCharacterCreatorDraft(panel, preset.data, populateClasses);
            toastr['success'](`Preset "${preset.name}" loaded.`, 'Character Creator');
        });
    }

    if (delPresetBtn && !delPresetBtn._crBound) {
        delPresetBtn._crBound = true;
        delPresetBtn.addEventListener('click', () => {
            const id = presetSelect?.value;
            if (!id) return;
            const st = getSettings();
            const preset = (st.characterCreatorPresets || []).find(p => p.id === id);
            if (!preset) return;
            st.characterCreatorPresets = st.characterCreatorPresets.filter(p => p.id !== id);
            saveSettings();
            renderPresetPills();
            toastr['info'](`Preset "${preset.name}" deleted.`, 'Character Creator');
        });
    }

    if (savePresetBtn && !savePresetBtn._crBound) {
        savePresetBtn._crBound = true;
        savePresetBtn.addEventListener('click', async () => {
            const { Popup } = SillyTavern.getContext();
            let presetName = null;
            if (Popup?.show?.input) {
                presetName = await Popup.show.input('Character Creator', 'Name this preset:', 'My Preset');
            } else {
                presetName = prompt('Name this preset:');
            }
            if (!presetName || !presetName.trim()) return;
            const draft = collectCharacterCreatorDraft(panel);
            const st = getSettings();
            if (!st.characterCreatorPresets) st.characterCreatorPresets = [];
            const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            st.characterCreatorPresets.push({
                id: newId,
                name: presetName.trim(),
                data: draft,
            });
            saveSettings();
            renderPresetPills();
            if (presetSelect) presetSelect.value = newId;
            toastr['success'](`Preset "${presetName.trim()}" saved!`, 'Character Creator');
        });
    }
}


async function handleCharRollGenerate(el, panel) {
    saveCharacterCreatorDraft(panel);

    const s = getSettings();
    const nameVal        = /** @type {HTMLInputElement}   */ (panel.querySelector('#rt-cr-name'))?.value.trim()        || '';
    const genderVal      = /** @type {HTMLInputElement}   */ (panel.querySelector('#rt-cr-gender'))?.value.trim()      || '';
    const ageVal         = /** @type {HTMLInputElement}   */ (panel.querySelector('#rt-cr-age'))?.value.trim()         || '';
    const orientationVal = /** @type {HTMLInputElement}   */ (panel.querySelector('#rt-cr-orientation'))?.value.trim() || '';
    const speciesVal     = /** @type {HTMLInputElement}   */ (panel.querySelector('#rt-cr-species'))?.value.trim()     || '';
    const ethnicityVal   = /** @type {HTMLInputElement}   */ (panel.querySelector('#rt-cr-ethnicity'))?.value.trim()   || '';
    const genre          = /** @type {HTMLSelectElement}  */ (panel.querySelector('#rt-cr-genre'))?.value              || s.onboardingGenre || 'fantasy';
    const level          = parseInt(/** @type {HTMLSelectElement} */ (panel.querySelector('#rt-cr-level'))?.value      || String(s.onboardingLevel || 1), 10) || 1;
    const classSelect    = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-cr-class'));
    let   classRaw       = classSelect?.value || '__story__';
    let   classOtherVal  = /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-class-other'))?.value.trim()   || '';
    const traitsVal      = /** @type {HTMLTextAreaElement}*/ (panel.querySelector('#rt-cr-traits'))?.value.trim()       || '';
    const abilitiesVal   = /** @type {HTMLTextAreaElement}*/ (panel.querySelector('#rt-cr-abilities'))?.value.trim()    || '';
    const backgroundVal  = /** @type {HTMLInputElement}   */ (panel.querySelector('#rt-cr-background'))?.value.trim()  || '';
    const appearanceVal  = /** @type {HTMLInputElement}   */ (panel.querySelector('#rt-cr-appearance'))?.value.trim()  || '';
    const additionalVal  = /** @type {HTMLTextAreaElement}*/ (panel.querySelector('#rt-cr-additional'))?.value.trim()   || '';
    const personaCb      = /** @type {HTMLInputElement}   */ (panel.querySelector('#rt-cr-persona-cb'));
    const wantPersona    = !!personaCb?.checked;
    const wordsSelectEl  = /** @type {HTMLSelectElement} */ (panel.querySelector('#rt-cr-persona-words'));
    const wordsCustomEl  = /** @type {HTMLInputElement} */ (panel.querySelector('#rt-cr-persona-words-custom'));
    const wordsRaw       = wordsSelectEl?.value === 'other' ? wordsCustomEl?.value : wordsSelectEl?.value;
    const wordCount      = parseInt(wordsRaw || '150', 10) || 150;

    const isStoryFitting = classRaw === '__story__';
    const isOther        = classRaw === '__other__';
    const ctx2 = SillyTavern.getContext();
    const charId = ctx2.characterId;
    const card = charId !== undefined ? ctx2.characters?.[charId] : null;
    const cardSnippet = card ? `\nActive Card: ${(card.name || '')} — ${(card.description || '')}` : '';

    let classLine = '';
    if (isStoryFitting) {
        classLine = `Class: (choose a class that fits the current story, setting, and card naturally — be creative)`;
    } else if (isOther && classOtherVal) {
        classLine = `Class: ${classOtherVal}`;
    } else if (!isOther && !isStoryFitting && classRaw) {
        classLine = `Class: ${classRaw}`;
    } else {
        classLine = `Class: (invent a class fitting the setting and era — do NOT use fantasy D&D class names in non-fantasy contexts)`;
    }

    let extraHints = '';
    if (nameVal || genderVal || ageVal || orientationVal || speciesVal || ethnicityVal || traitsVal || backgroundVal || appearanceVal || additionalVal) {
        extraHints = `\n\n--- PLAYER PREFERENCES & HINTS ---\n` +
                     (nameVal ? `Name: ${nameVal}\n` : '') +
                     (genderVal ? `Gender: ${genderVal}\n` : '') +
                     (ageVal ? `Age: ${ageVal}\n` : '') +
                     (orientationVal ? `Orientation: ${orientationVal}\n` : '') +
                     (speciesVal ? `Species: ${speciesVal}\n` : '') +
                     (ethnicityVal ? `Ethnicity: ${ethnicityVal}\n` : '') +
                     (traitsVal ? `Traits: ${traitsVal}\n` : '') +
                     (appearanceVal ? `Appearance Hints: ${appearanceVal}\n` : '') +
                     (backgroundVal ? `Background Hints: ${backgroundVal}\n` : '') +
                     (additionalVal ? `Additional: ${additionalVal}\n` : '');
    }

    const isCalendar = !!s.useDdMmYyFormat;
    const startDateVal = isCalendar
        ? (s.initialDate && s.initialDate !== 'Day 1' ? s.initialDate : '01/01/2026')
        : 'Day 1';
    const initRestVal = isCalendar ? startDateVal : 'Day 0';
    const levelPrefix = `STARTING LEVEL: ${level} (mandatory — the character MUST be exactly Level ${level}).`;
    const xpHint = buildOnboardingXpHint(level);
    const CHARACTER_FORMAT_HINT = `\n\nCRITICAL TAG WRAPPING RULE: Every block you output MUST be enclosed in matching opening and closing tags (e.g. [/CHARACTER], [/INVENTORY], [/ABILITIES], [/SPELLS], [/XP], [/TIME]).`;
    const TIME_FORMAT_HINT = `\n\n[TIME]\nLast Rest: 12:00 AM, ${initRestVal}\nCurrent Time: 08:00 AM, ${startDateVal}\n[/TIME]`;

    const SETTING_HINTS = {
        realistic: `\n\nCRITICAL REALISM RULE: This is a realistic/non-fantasy setting. Do NOT output a [SPELLS] block. Avoid fantasy classes and races. Use realistic currency (e.g. $, USD, GBP). Gear and weapons must be realistic.`,
        scifi: `\n\nCRITICAL SCI-FI RULE: Science-fiction setting. No [SPELLS] block. No fantasy classes or races. Use Credits or equivalent currency. Gear should be futuristic.`,
        horror: `\n\nCRITICAL HORROR RULE: Horror setting. No [SPELLS] block — occult abilities go in [ABILITIES]. No fantasy classes or races. Use realistic currency. Characters are grounded and vulnerable.`,
        fantasy: '',
    };
    const settingHint = SETTING_HINTS[genre] || '';

    const f = (val, fallback) => val || fallback;
    const prompt = `${levelPrefix}

Design a complete player character that fits naturally into the current scenario, card, and recent chat history. Be authentic to the setting, era, and tone.

--- PLAYER PREFERENCES ---
Name:         ${f(nameVal, '(invent a creative, setting-appropriate name — NEVER use "User", "Unknown", or any placeholder)')}
Gender:       ${f(genderVal, '(your choice)')}
Age:          ${f(ageVal, '(your choice)')}
Orientation:  ${f(orientationVal, '(your choice)')}
Species:      ${f(speciesVal, '(your choice)')}
Ethnicity:    ${f(ethnicityVal, '(your choice)')}
${classLine}
Traits:       ${f(traitsVal, '(invent 2–3 distinctive traits)')}
Level:        ${level}
Abilities:    ${f(abilitiesVal, '(generate fitting, creative abilities)')}
Background:   ${f(backgroundVal, '(invent a brief origin)')}
Appearance:   ${f(appearanceVal, '(invent a memorable appearance)')}
${additionalVal ? `Additional:   ${additionalVal}` : ''}
${cardSnippet ? `\n--- CHARACTER CARD CONTEXT ---${cardSnippet}` : ''}

--- REQUIREMENTS ---
• Fill every blank field above with creative, setting-appropriate content. No field may be empty, "Unknown", "N/A", or a placeholder.
• The name must be original and fitting. NEVER write "User" or any variation.
• Output every currently active state-memo field (custom and default). Only include [SPELLS] if the class genuinely uses magic.
• ${isOther || isStoryFitting ? 'Invent the most fitting class for the setting and context.' : `Use the chosen class "${classRaw}" exactly as given — do not rename or substitute it.`}
• If the setting is non-fantasy and no class was specified, create a class that feels natural to the world — not a fantasy D&D class name.
• All stats, gear, saves, and XP must be consistent with Level ${level}.
${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${settingHint}`;

    el.querySelectorAll('.rt-random-char-btn').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });
    const genBtn = /** @type {HTMLButtonElement|null} */ (panel.querySelector('#rt-cr-generate-btn'));
    if (genBtn) { genBtn.disabled = true; genBtn.textContent = '🎲 Generating...'; }

    await sendDirectPrompt(prompt);

    if (genBtn) { genBtn.disabled = false; genBtn.textContent = '🎲 Generate Character'; }
    el.querySelectorAll('.rt-random-char-btn').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = false; });

    if (wantPersona) {
        const s2 = getSettings();
        const extractedName = extractCharNameFromMemo(s2.currentMemo);
        const charName = extractedName || nameVal || 'My Character';
        const finalExtraHints = extraHints + (cardSnippet ? `\n\n--- CHARACTER CARD CONTEXT ---${cardSnippet}` : '');
        const bio = await generatePersonaBio(charName, wordCount, finalExtraHints);
        if (bio) showPersonaConfirmOverlay(bio, charName, wordCount, extraHints);
    }
}

export async function generatePersonaBio(charName, wordCount, extraHints = '') {
    const s = getSettings();
    const rawMemo = s.currentMemo || '';
    const cleanMemo = rawMemo.replace(/<\/?memo>/gi, '').replace(/<[^>]+>/g, ' ').trim();

    const coreSections = s.pcCoreSections && Array.isArray(s.pcCoreSections) && s.pcCoreSections.length > 0 ? s.pcCoreSections : DEFAULT_PC_SECTIONS;
    const sectionsTemplate = coreSections.map(sec => `${sec.name}:\n${sec.description}`).join('\n\n');

    const systemPrompt = `You are a persona writer for a roleplay system. Based on the character state card provided, write a persona description for ${charName || 'this character'} in third person.${extraHints}

You MUST use this exact section format — each section on its own line with the label followed by a colon:

${sectionsTemplate}

Rules:
- Use the exact section headers shown above. Do not add extra sections or merge them.
- CRITICAL: Do NOT blindly copy the formatting or sections of other characters found in ACTIVE MEMORY or the character card. You MUST strictly use ONLY the sections instructed above and ignore any other sections.
- Total word count across all sections: approximately ${wordCount} words.
- Write in third person (he/she/they).
- Keep the prose grounded and natural. Avoid purple prose, excessive em-dashes, or clichés (e.g. "deliberate step", "breath hitched").
- Do not include a preamble, title, or closing statement. Output ONLY the six sections.
- CRITICAL: You MUST faithfully and explicitly incorporate ALL provided traits, background hints, species, gender, and appearance hints from the character card and the PLAYER PREFERENCES. Do not ignore user-provided details.
- CRITICAL: Never output template macro strings such as {{char}}, {{user}}, or any other {{...}} placeholders. Always replace them with the actual character's name or a fitting proper name.`;

    const { chat } = SillyTavern.getContext();
    let chatLog = '';
    if (chat && chat.length > 0) {
        const numMsgs = s.directPromptContext > 0 ? s.directPromptContext : 15;
        const recentChat = chat.slice(-numMsgs);
        chatLog = `## NARRATIVE HISTORY (Last ${recentChat.length} messages)\n` +
            recentChat.map(m => {
                const name = m.is_user ? 'Player' : (m.name || 'Narrator');
                return `${name}: ${m.mes || m.content || ''}`;
            }).join('\n\n');
    }

    const userPrompt = `CHARACTER CARD:\n${cleanMemo}\n\n${chatLog}\n\nWrite the persona description for ${charName || 'this character'}.\nIMPORTANT REMINDER: The total word count across all sections MUST be approximately ${wordCount} words!`;
    try {
        const result = await sendStateRequest(s, systemPrompt, userPrompt);
        return (result || '').trim() || null;
    } catch (e) {
        toastr['warning']('Persona bio generation failed.', 'Character Creator');
        return null;
    }
}

async function uploadDefaultPersonaAvatar(url, avatarId, refreshAvatars) {
    const fetchResult = await fetch(url);
    const blob = await fetchResult.blob();
    const file = new File([blob], 'avatar.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('overwrite_name', avatarId);

    const response = await fetch('/api/avatars/upload', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        cache: 'no-cache',
        body: formData,
    });
    if (!response.ok) {
        throw new Error(`Failed to upload persona avatar: ${response.statusText}`);
    }
    const data = await response.json();
    await refreshAvatars(true, data?.path || avatarId);
}

async function injectAsSillyTavernPersona(name, description) {
    const [
        { initPersona, setUserAvatar, getUserAvatars, setPersonaDescription, user_avatar, persona_description_positions },
        { findPersona },
        { power_user },
        { default_user_avatar },
    ] = await Promise.all([
        import('../../../personas.js'),
        import('../../../utils.js'),
        import('../../../power-user.js'),
        import('../../../../script.js'),
    ]);

    const trimmedName = name.trim() || 'My Character';
    const existing = findPersona({ name: trimmedName, preferCurrentPersona: false, quiet: true });

    let avatarId;
    if (existing) {
        avatarId = existing.avatar;
        if (!power_user.persona_descriptions[avatarId]) {
            power_user.persona_descriptions[avatarId] = {
                description: '',
                position: persona_description_positions.IN_PROMPT,
                depth: 4,
                role: 0,
                lorebook: '',
                connections: [],
                title: '',
            };
        }
        power_user.persona_descriptions[avatarId].description = description;
        if (user_avatar === avatarId) {
            power_user.persona_description = description;
        }
    } else {
        avatarId = `${Date.now()}-${trimmedName.replace(/[^a-zA-Z0-9]/g, '')}.png`;
        await initPersona(avatarId, trimmedName, description, '');
        await uploadDefaultPersonaAvatar(default_user_avatar, avatarId, getUserAvatars);
    }

    await setUserAvatar(avatarId);
    setPersonaDescription();
    SillyTavern.getContext().saveSettingsDebounced();
    await getUserAvatars(true, avatarId);
    return avatarId;
}

export function showPersonaConfirmOverlay(bioText, charName, wordCount, extraHints = '') {
    const existing = document.getElementById('rt-persona-confirm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rt-persona-confirm-overlay';
    overlay.className = 'rt-charpicker-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--black80a,#1a1a2e);border:1px solid rgba(120,80,220,0.5);border-radius:8px;padding:18px;max-width:520px;width:90%;max-height:80vh;display:flex;flex-direction:column;gap:10px;overflow:hidden;';
    box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <b style="color:var(--rt-accent,#a78bfa);font-size:1em;">🎭 Persona Preview — ${escapeHtml(charName)}</b>
            <button id="rt-pco-close" style="background:none;border:none;color:inherit;font-size:1.1em;cursor:pointer;opacity:0.6;">✕</button>
        </div>
        <small style="opacity:0.6;line-height:1.3;">Edit the bio below, then Accept to auto-create in SillyTavern, or copy it to paste manually.</small>
        <textarea id="rt-pco-bio" style="flex:1;min-height:180px;max-height:300px;resize:vertical;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:8px;color:inherit;font-size:0.88em;line-height:1.6;">${escapeHtml(bioText)}</textarea>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <button id="rt-pco-add-pc" title="Recommended: Adds this character as the Player entry in the Lorebook Agent for this chat. It will automatically load whenever you open this chat." style="width:100%;padding:12px;background:rgba(0,180,255,0.25);border:2px solid #00b4ff;border-radius:6px;color:inherit;cursor:pointer;font-weight:bold;font-size:1.1em;box-shadow:0 4px 12px rgba(0,180,255,0.15);transition:all 0.2s ease;">👤 Add as Player into Lorebook Agent</button>
            
            <div style="display:flex;gap:8px;">
                <button id="rt-pco-regen" style="flex:1;padding:8px;background:rgba(120,80,220,0.18);border:1px solid rgba(120,80,220,0.6);border-radius:4px;color:inherit;cursor:pointer;">🔄 Regenerate</button>
                <button id="rt-pco-copy" style="flex:1;padding:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:inherit;cursor:pointer;">📋 Copy Bio</button>
            </div>

            <div style="text-align:center;margin-top:4px;">
                <button id="rt-pco-accept" title="Creates a new SillyTavern persona (or updates an existing one with the same name), selects it, and optionally locks it to this chat." style="background:none;border:none;color:var(--SmartThemeEmColor, rgba(255,255,255,0.5));text-decoration:underline;cursor:pointer;font-size:0.85em;padding:4px;">Inject as Current Persona (Native SillyTavern logic)</button>
            </div>
        </div>`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.querySelector('#rt-pco-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // ── Copy Bio button ──────────────────────────────────────────────────────
    overlay.querySelector('#rt-pco-copy').addEventListener('click', async () => {
        const bio = /** @type {HTMLTextAreaElement} */ (overlay.querySelector('#rt-pco-bio')).value.trim();
        try {
            await navigator.clipboard.writeText(bio);
            const btn = /** @type {HTMLButtonElement} */ (overlay.querySelector('#rt-pco-copy'));
            btn.textContent = '✅ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy Bio'; }, 1800);
        } catch (_) {
            toastr['info']('Could not access clipboard — please select and copy manually.', 'Character Creator');
        }
    });

    // ── Accept button ────────────────────────────────────────────────────────
    overlay.querySelector('#rt-pco-accept').addEventListener('click', async () => {
        const finalBio = /** @type {HTMLTextAreaElement} */ (overlay.querySelector('#rt-pco-bio')).value.trim();
        const ctx = SillyTavern.getContext();
        const safeName = charName.replace(/['"\\]/g, '').trim() || 'My Character';
        const acceptBtn = /** @type {HTMLButtonElement} */ (overlay.querySelector('#rt-pco-accept'));
        acceptBtn.disabled = true;
        acceptBtn.textContent = '⏳ Creating...';

        try {
            await injectAsSillyTavernPersona(safeName, finalBio);

            try {
                if (typeof ctx.executeSlashCommandsWithOptions === 'function') {
                    await ctx.executeSlashCommandsWithOptions('/persona-lock').catch(() => {});
                }
            } catch (_) {}

            toastr['success'](`Persona "${safeName}" saved and selected. Check User Settings → Personas to confirm.`, 'Character Creator');
        } catch (e) {
            try { await navigator.clipboard.writeText(finalBio); } catch (_) {}
            toastr['warning'](
                `Could not auto-create persona. Bio copied to clipboard — go to User Settings → Personas, create "${safeName}", and paste the description.`,
                'Character Creator', { timeOut: 8000 }
            );
        }
        overlay.remove();
     });
 
     // ── Add as Player into Lorebook Agent ────────────────────────────────────
     overlay.querySelector('#rt-pco-add-pc').addEventListener('click', async () => {
         const finalBio = /** @type {HTMLTextAreaElement} */ (overlay.querySelector('#rt-pco-bio')).value.trim();
         const safeName = charName.replace(/['"\\]/g, '').trim() || 'My Character';
         
         const s = getSettings();
         if (!s.chatStates) s.chatStates = {};
         const currentChatId = SillyTavern.getContext().chatId;
         if (currentChatId) {
             if (!s.chatStates[currentChatId]) s.chatStates[currentChatId] = {};
             s.chatStates[currentChatId].playerCharacter = {
                 name: safeName,
                 bio: finalBio,
                 wordCount: wordCount || 100,
                 timestamp: Date.now()
             };
             saveChatState(currentChatId);
             
             await refreshAgentManifestNow();
             
             toastr['success'](`"${safeName}" added as Player in Lorebook Agent.`, 'Character Creator');
         } else {
             toastr['error']('No active chat found to link the Player Character.', 'Character Creator');
         }
         overlay.remove();
     });
 
     // ── Regenerate button ────────────────────────────────────────────────────
     overlay.querySelector('#rt-pco-regen').addEventListener('click', async () => {
         const regenBtn = /** @type {HTMLButtonElement} */ (overlay.querySelector('#rt-pco-regen'));
         regenBtn.disabled = true;
         regenBtn.textContent = '⏳ Regenerating...';
         const newBio = await generatePersonaBio(charName, wordCount, extraHints);
         if (newBio) {
             /** @type {HTMLTextAreaElement} */ (overlay.querySelector('#rt-pco-bio')).value = newBio;
         } else {
             toastr['warning']('Regeneration failed. Please try again.', 'Character Creator');
         }
         regenBtn.disabled = false;
         regenBtn.textContent = '🔄 Regenerate';
     });
}

function extractCharNameFromMemo(memo) {
    if (!memo) return '';
    const charBlock = memo.match(/\[CHARACTER\]([\s\S]*?)\[\/CHARACTER\]/i);
    if (charBlock) {
        const firstLine = charBlock[1].replace(/<[^>]+>/g, '').trim().split('\n')[0].trim();
        const m = firstLine.match(/^([^(:\[\n]{2,50}?)(?:\s*\(|\s*:)/);
        if (m) {
            const candidate = m[1].trim();
            if (candidate && !/^(character|unknown|user|name)$/i.test(candidate)) return candidate;
        }
    }
    const nameField = memo.match(/(?:^|\n)\s*(?:Name|Character Name)\s*[:\|]\s*([^\n\|\[<]{2,60})/im);
    if (nameField) {
        const candidate = nameField[1].replace(/<[^>]+>/g, '').trim();
        if (candidate && !/^(character|unknown|user)$/i.test(candidate)) return candidate;
    }
    return '';
}

// ── PC Import Panel ──────────────────────────────────────────────────────────

/**
 * Shows the PC Import inline panel within the onboarding container.
 * @param {HTMLElement} el — the onboarding container element
 */
export function showPcImportPanel(el) {
    const panel = /** @type {HTMLElement|null} */ (el.querySelector('#rt-pc-import-panel'));
    if (!panel) return;
    const configWrap = /** @type {HTMLElement|null} */ (el.querySelector('.rt-onboarding-config-row')?.parentElement);
    const allBtnGroups = /** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll('.rt-onboarding-buttons'));

    // Save original display states so back restores only the correct genre group
    const savedDisplays = Array.from(allBtnGroups).map(g => g.style.display);
    const savedConfigDisplay = configWrap ? configWrap.style.display : '';

    // Hide config + genre button groups, show the PC import panel
    if (configWrap) configWrap.style.display = 'none';
    allBtnGroups.forEach(g => { g.style.display = 'none'; });
    panel.style.display = 'flex';

    const editBtn = panel.querySelector('.rt-edit-pc-sections-btn');
    if (editBtn && !editBtn._bound) {
        editBtn._bound = true;
        editBtn.addEventListener('click', () => openPcSectionEditor());
    }

    // Back button — restore exactly what was hidden, not a blank reset
    const backBtn = panel.querySelector('#rt-pc-import-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            panel.style.display = 'none';
            if (configWrap) configWrap.style.display = savedConfigDisplay;
            allBtnGroups.forEach((g, i) => { g.style.display = savedDisplays[i]; });
        }, { once: true });
    }

    const listEl = /** @type {HTMLElement|null} */ (panel.querySelector('#rt-pc-import-list'));
    const searchEl = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-pc-import-search'));
    const wordSelect = /** @type {HTMLSelectElement|null} */ (panel.querySelector('#rt-pc-import-wordselect'));
    const wordInput = /** @type {HTMLInputElement|null} */ (panel.querySelector('#rt-pc-import-wordcount'));
    if (!listEl) return;

    if (wordSelect && wordInput) {
        // Toggle the custom number input based on dropdown selection
        wordSelect.addEventListener('change', () => {
            if (wordSelect.value === 'custom') {
                wordInput.style.display = 'block';
                wordInput.focus();
            } else {
                wordInput.style.display = 'none';
            }
        });
    }

    const ctx = SillyTavern.getContext();
    const allChars = (ctx.characters || []).filter(c => c.name);
    let currentFilter = '';
    let displayCount = 10;

    const renderPcList = () => {
        listEl.innerHTML = '';
        const filtered = currentFilter
            ? allChars.filter(c => c.name.toLowerCase().includes(currentFilter.toLowerCase()))
            : allChars;
        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="color:rgba(255,255,255,0.35);font-size:11px;padding:6px;">No characters found.</div>';
            return;
        }
        const visible = filtered.slice(0, displayCount);
        for (const char of visible) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:5px;padding:5px 7px;';

            // Avatar
            const avatarEl = document.createElement('div');
            avatarEl.style.cssText = 'width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,0.1);';
            if (char.avatar && char.avatar !== 'none') {
                const img = document.createElement('img');
                img.src = `/characters/${encodeURIComponent(char.avatar)}`;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                img.loading = 'lazy';
                img.onerror = () => { img.replaceWith(Object.assign(document.createElement('div'), { style: 'display:flex;align-items:center;justify-content:center;height:100%;font-size:16px;', textContent: '👤' })); };
                avatarEl.appendChild(img);
            } else {
                avatarEl.style.display = 'flex'; avatarEl.style.alignItems = 'center'; avatarEl.style.justifyContent = 'center';
                avatarEl.style.fontSize = '16px'; avatarEl.textContent = '👤';
            }

            // Info
            const info = document.createElement('div');
            info.style.cssText = 'flex:1;min-width:0;';
            const nameEl = document.createElement('div');
            nameEl.style.cssText = 'font-size:12px;font-weight:bold;color:rgba(255,255,255,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            nameEl.textContent = char.name;
            const descEl = document.createElement('div');
            descEl.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            descEl.textContent = (char.description || char.personality || 'No description').substring(0, 80);
            info.appendChild(nameEl);
            info.appendChild(descEl);

            // Buttons
            const btns = document.createElement('div');
            btns.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex-shrink:0;';

            const fitBtn = document.createElement('button');
            fitBtn.textContent = '🤖 Fit into Story';
            fitBtn.title = 'Full AI adaptation: character is rewritten to fit the current campaign setting.';
            fitBtn.style.cssText = 'font-size:10px;padding:3px 7px;background:rgba(0,180,100,0.2);border:1px solid rgba(0,180,100,0.5);border-radius:4px;color:inherit;cursor:pointer;white-space:nowrap;';

            const addAsIsBtn = document.createElement('button');
            addAsIsBtn.textContent = '📋 Add as is';
            addAsIsBtn.title = 'Minimal AI review: only fixes logical world/era impossibilities. Original writing preserved.';
            addAsIsBtn.style.cssText = 'font-size:10px;padding:3px 7px;background:rgba(120,80,220,0.2);border:1px solid rgba(120,80,220,0.5);border-radius:4px;color:inherit;cursor:pointer;white-space:nowrap;';

            const handleImport = async (mode) => {
                addAsIsBtn.disabled = true; fitBtn.disabled = true;
                addAsIsBtn.textContent = '⏳'; fitBtn.textContent = '⏳';
                try {
                    await importPcFromCard(char, mode, el);
                } catch (err) {
                    toastr['error'](`Import failed: ${String(err.message || err).substring(0, 120)}`, 'PC Import');
                } finally {
                    addAsIsBtn.disabled = false; fitBtn.disabled = false;
                    addAsIsBtn.textContent = '📋 Add as is'; fitBtn.textContent = '🤖 Fit into Story';
                }
            };
            fitBtn.addEventListener('click', () => handleImport('full'));
            addAsIsBtn.addEventListener('click', () => handleImport('minimal'));

            btns.appendChild(fitBtn);
            btns.appendChild(addAsIsBtn);
            row.appendChild(avatarEl);
            row.appendChild(info);
            row.appendChild(btns);
            listEl.appendChild(row);
        }
        if (visible.length < filtered.length) {
            const more = document.createElement('div');
            more.style.cssText = 'text-align:center;font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;padding:4px;';
            more.textContent = `Show more (${visible.length} of ${filtered.length})`;
            more.addEventListener('click', () => { displayCount += 10; renderPcList(); });
            listEl.appendChild(more);
        }
    };

    if (searchEl) {
        let searchTimeout = null;
        searchEl.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => { currentFilter = searchEl.value.trim(); displayCount = 10; renderPcList(); }, 200);
        });
    }
    renderPcList();
}

/**
 * Imports a character card as a Player Character.
 * Step 1: Sends a state memo prompt via sendDirectPrompt to populate tracker blocks.
 * Step 2: Generates a persona bio via generatePcImportBio and shows the confirm overlay.
 * @param {object} charCard
 * @param {'minimal'|'full'} mode
 * @param {HTMLElement} el — onboarding container (for re-enabling buttons on failure)
 */
async function importPcFromCard(charCard, mode, el) {
    const s = getSettings();
    const ctx = SillyTavern.getContext();
    const name = charCard.name || 'Unnamed';

    // Read word count synchronously from the DOM before any async operations 
    // potentially trigger a chat re-render and orphan the element
    const wordSelectEl = /** @type {HTMLSelectElement|null} */ (el.querySelector('#rt-pc-import-wordselect'));
    const wordCountEl = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-pc-import-wordcount'));
    
    let wordCountStr = wordSelectEl?.value || 'same'; // Default to first option
    if (wordCountStr === 'custom') {
        wordCountStr = String(Math.max(50, Math.min(5000, parseInt(wordCountEl?.value || '150', 10) || 150)));
    }

    // Gather world context
    const contextLines = [];
    contextLines.push(`CHARACTER CARD:\nName: ${name}\nDescription: ${(charCard.description || '')}\nPersonality: ${(charCard.personality || '')}`);
    if (s.currentMemo) contextLines.push(`CURRENT GAME STATE:\n${s.currentMemo}`);
    if (ctx.chat && Array.isArray(ctx.chat)) {
        const msgs = ctx.chat.filter(m => !m.is_system && m.mes?.trim()).slice(-8);
        if (msgs.length > 0) contextLines.push(`RECENT CHAT:\n${msgs.map(m => `${m.name || (m.is_user ? 'User' : 'Character')}: ${m.mes}`).join('\n\n').substring(0, 3000)}`);
    }
    try {
        const charData = ctx.characters?.[ctx.characterId];
        if (charData?.description) contextLines.push(`NARRATOR/WORLD CARD:\n${charData.description}`);
    } catch (_) {}
    const worldCtx = contextLines.join('\n\n---\n\n');

    // --- Step 1: State Memo ---
    const memoPromptMinimal = `You are a state tracker assistant. Translate this character card into state tracker format for the player character.

RULES:
- Preserve ALL values, stats, abilities, and inventory EXACTLY as written in the card.
- Only adjust specific terminology that would be a hard logical impossibility in the current setting (e.g. "smartphone" in a medieval world).
- Output [CHARACTER], [INVENTORY], [ABILITIES], [SPELLS] (if the class uses magic), [XP], and [TIME] blocks.
- Do NOT invent stats or equipment not present on the card.
- Use the existing system prompt's block format.

${worldCtx}`;

    const memoPromptFull = `You are a state tracker assistant. Adapt this character card to the current campaign setting and translate it into state tracker format for the player character.

RULES:
- Fit the character's class, gear, backstory, and abilities naturally into the current world.
- Rename anachronistic equipment or references to setting-appropriate equivalents.
- Output [CHARACTER], [INVENTORY], [ABILITIES], [SPELLS] (if the class uses magic), [XP], and [TIME] blocks.
- Use the existing system prompt's block format.
- CRITICAL: Never output template macro strings such as {{char}}, {{user}}, or any other {{...}} placeholders. Always replace them with the actual character's name or a fitting proper name.

${worldCtx}`;

    const memoPrompt = mode === 'minimal' ? memoPromptMinimal : memoPromptFull;

    toastr['info'](`Importing "${name}" as PC… generating state memo.`, 'PC Import');
    el.querySelectorAll('.rt-random-char-btn').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = true; });

    await sendDirectPrompt(memoPrompt);

    // Sync the card's avatar as the PC portrait globally so both the State Tracker
    // and Campaign Records immediately reflect the newly imported character's image.
    if (charCard.avatar && charCard.avatar !== 'none') {
        if (!s.customPortraits) s.customPortraits = {};
        const avatarUrl = `/characters/${encodeURIComponent(charCard.avatar)}`;
        const safeName = name.replace(/['"\\]/g, '').trim() || 'My Character';
        s.customPortraits['CHARACTER'] = avatarUrl;
        s.customPortraits['PC'] = avatarUrl;
        s.customPortraits[safeName] = avatarUrl;
        
        // Also map the AI-generated clean name (if any) from the new state memo,
        // so the State Tracker can match the portrait even if the AI changed the name.
        const extractedName = extractCharNameFromMemo(s.currentMemo);
        if (extractedName && extractedName !== safeName) {
            s.customPortraits[extractedName] = avatarUrl;
        }
        
        const currentChatId = SillyTavern.getContext().chatId;
        if (currentChatId && typeof saveChatState === 'function') {
            saveChatState(currentChatId);
        }
        
        // Force an immediate synchronous re-render of the State Tracker 
        // now that the customPortraits object has the PC avatar.
        if (typeof refreshRenderedView === 'function') {
            refreshRenderedView();
        }
        document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));
    }

    el.querySelectorAll('.rt-random-char-btn').forEach(b => { /** @type {HTMLButtonElement} */ (b).disabled = false; });

    // --- Step 2: Persona Bio ---
    toastr['info'](`Generating persona bio for "${name}"…`, 'PC Import');
    
    const bio = await generatePcImportBio(charCard, mode, wordCountStr);
    if (bio) {
        showPersonaConfirmOverlay(bio, name, wordCountStr === 'same' ? 150 : parseInt(wordCountStr, 10), '');
    } else {
        toastr['warning']('State memo sent, but persona bio generation failed. You can set up the PC persona manually.', 'PC Import');
    }
}

/**
 * Generates a persona bio from a character card directly (not from the state memo).
 * @param {object} charCard
 * @param {'minimal'|'full'} mode
 * @param {number} wordCount
 * @returns {Promise<string|null>}
 */
async function generatePcImportBio(charCard, mode, wordCount) {
    const s = getSettings();
    const ctx = SillyTavern.getContext();
    const name = charCard.name || 'Unnamed';

    // Build card text — {{char}} replaced with actual name; no artificial size cap
    const replaceCharMacro = (s) => s.replace(/\{\{char\}\}/gi, name).replace(/\{\{Char\}\}/g, name);
    const descText = replaceCharMacro((charCard.description || '').trim());
    const persText = replaceCharMacro((charCard.personality || '').trim());
    const cardText = [
        `Name: ${name}`,
        descText  ? `Description:\n${descText}`  : '',
        persText  ? `Personality:\n${persText}`  : '',
    ].filter(Boolean).join('\n\n');

    // World/narrator hint — reference only, never to be copied into the bio
    let worldHint = '';
    try {
        const charData = ctx.characters?.[ctx.characterId];
        if (charData?.description) worldHint = charData.description.trim();
    } catch (_) {}

    if (mode === 'minimal') {
        // Minimal mode: copy the card's writing as faithfully as possible.
        // The AI's job is like copy-paste with ONLY surgical era/world fixes.
        // No section format is imposed — preserve the card's own structure and voice.
        const systemPrompt = `You are a persona transcription assistant. Your ONLY job is to copy the provided character card text into the persona field with the absolute minimum number of changes.

RULES — read carefully:
- Copy the original text almost verbatim. Think of yourself as a copy-paste tool, not a writer.
- The ONLY changes you are allowed to make are:
  a) Hard logical impossibilities caused by a world or era mismatch (e.g. "smartphone" in a medieval world, "spaceship" in a historical setting).
  b) Replace every literal occurrence of {{char}} or {{Char}} in the text with the character's actual name: ${name}. This is mandatory.
- Do NOT restructure, reformat, reorder, or expand anything.
- Do NOT add new sentences, new details, or your own creative additions.
- If the card fits the setting fine (other than the {{char}} substitution), output it almost completely unchanged.
- Your output MUST start with exactly this line and nothing before it: \`Personality:\` — then the transcribed card text on the next line. Do NOT add any other section headers beyond this one.
- No preamble, no commentary, no closing remarks.
- CRITICAL: The world reference below is provided ONLY so you can spot era/world conflicts. Do NOT copy or include any text from it in your output.`;

        const worldSection = worldHint
            ? `\n\n--- WORLD REFERENCE (do NOT copy — for conflict-checking only) ---\n${worldHint}\n--- END WORLD REFERENCE ---`
            : '';
        const userPrompt = `CARD TO TRANSCRIBE:\n${cardText}${worldSection}\n\nOutput the transcribed persona text now.`;

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
            toastr['error'](`Bio generation failed: ${String(err.message || err).substring(0, 120)}`, 'PC Import');
            return null;
        }
    }

    // Full mode: structured section bio adapted to the campaign setting
    const coreSections = s.pcCoreSections && Array.isArray(s.pcCoreSections) && s.pcCoreSections.length > 0 ? s.pcCoreSections : DEFAULT_PC_SECTIONS;
    const sectionsTemplate = coreSections.map(sec => `${sec.name}:\n${sec.description}`).join('\n\n');

    const systemPrompt = `You are a persona writer for a roleplay system. Based on the provided character card, write a persona description for ${name} in third person.

Rewrite the bio as if this character were native to the current campaign setting. Actively adapt and integrate their appearance, background, and mannerisms so they feel like a natural part of the world's lore and ongoing story.

You MUST use this exact section format — each section on its own line with the label followed by a colon:

${sectionsTemplate}

Rules:
- Use the exact section headers shown above. Do not add extra sections or merge them.
- CRITICAL: Do NOT blindly copy the formatting or sections of other characters found in ACTIVE MEMORY or the original character card. You MUST strictly use ONLY the sections instructed above and ignore any other sections.
${wordCount === 'same' 
    ? '- MATCH LENGTH: Aim to make your output approximately the same length/word count as the original character card.'
    : `- Total word count across all sections: approximately ${wordCount} words.`}
- Write in third person (he/she/they).
- Keep prose grounded and natural. Avoid purple prose.
- Do not include a preamble, title, or closing statement. Output ONLY the six sections.
- Faithfully incorporate all provided traits, species, gender, and appearance from the card.
- CRITICAL: The world reference below is for setting context only — do NOT copy text from it.
- CRITICAL: Never output template macro strings such as {{char}}, {{user}}, or any other {{...}} placeholders. Always replace them with the actual character's name or a fitting proper name.`;

    const worldSection = worldHint
        ? `\n\n--- WORLD/CAMPAIGN REFERENCE (context only — do NOT copy) ---\n${worldHint}\n--- END WORLD REFERENCE ---`
        : '';
    const userPrompt = `CHARACTER CARD:\n${cardText}${worldSection}\n\nWrite the persona description for ${name}.`;


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
        toastr['error'](`Bio generation failed: ${String(err.message || err).substring(0, 120)}`, 'PC Import');
        return null;
    }
}
