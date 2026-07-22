import { getRuntimeActions, sectionPages } from './runtime-bridge.js';

export function bindRenderedCardEvents(el, memo, isDetachedContext = false, onRefresh = null) {
    const runtime = getRuntimeActions();
    const { applyPortraitData, autoApplySysprompt, bindQuickStartEvents, blockToItems, buildCombatAndSkillScalingHint, buildNpcInstruction, buildOnboardingActiveBlocks, buildOnboardingTimeHint, buildOnboardingXpHint, buildStartingGearHint, createDetachedPanel, extractCharNameFromMemo, fileToDataUrl, generatePersonaBio, getPageSize, getSettings, handleCategorySettings, handleCharacterCreatorGenerate, handleRecolor, loadBenchedExpanded, loadCollapsed, loadDetached, maybeCreateOnboardingPersona, parseMemoBlocks, refreshAgentManifest, refreshNpcManifest, refreshRenderedView, registerDiceFunctionTool, removeArchivedQuest, resolveActivePersonaDescription, saveActiveTab, saveBenchedExpanded, saveCollapsed, saveDetached, saveSettings, scaleImageTo512Square, scheduleAutoApply, sendDirectPrompt, setInitialDateValue, setUse24hTime, setUseDdMmYyFormat, showCharacterRollPanel, showLorebookAgentDocumentation, showNarrativePacingExplanation, showPcImportPanel, showPersonaConfirmOverlay, showPortraitSettingsMenu, showQuestsHardcoreExplanation, showRngExplanation, showSettingsHelpPopup, syncOnboardingPersonaPrefsFromDom, syncOnboardingUI } = runtime;
    const _sectionPages = sectionPages;

    const refresh = onRefresh || refreshRenderedView;

    bindQuickStartEvents(el);

    const otherWaysDrawer = el.querySelector('.rt-onboarding-other-drawer');
    const narratorDrawer = el.querySelector('.rt-onboarding-narrator-drawer');
    if (otherWaysDrawer && narratorDrawer && narratorDrawer.previousElementSibling !== otherWaysDrawer) {
        otherWaysDrawer.insertAdjacentElement('afterend', narratorDrawer);
    }
    el.querySelectorAll('.rt-onboarding-drawer-toggle').forEach(onboardingDrawerToggle => {
        const onboardingDrawer = onboardingDrawerToggle.closest('.rt-onboarding-drawer');
        if (!onboardingDrawer || onboardingDrawerToggle._bound) return;
        onboardingDrawerToggle._bound = true;
        onboardingDrawerToggle.addEventListener('click', () => {
            const isOpen = onboardingDrawer.classList.toggle('is-open');
            onboardingDrawerToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });

    // The onboarding panel is rendered dynamically, after the static settings
    // controls have been bound. Route its CYOA cog through the popup hook instead.
    const onboardingCyoaSettingsBtn = el.querySelector('#rt_onboarding_cyoa_settings_btn');
    if (onboardingCyoaSettingsBtn && !onboardingCyoaSettingsBtn._bound) {
        onboardingCyoaSettingsBtn._bound = true;
        onboardingCyoaSettingsBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            globalThis._rpgOpenCyoaSettings?.();
        });
    }

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

    const bindGearTierSelect = (selectEl) => {
        if (!selectEl || selectEl._gearTierBound) return;
        selectEl._gearTierBound = true;
        selectEl.addEventListener('change', () => {
            getSettings().onboardingGearTier = selectEl.value || 'auto';
            saveSettings();
            syncOnboardingUI();
        });
    };
    bindGearTierSelect(el.querySelector('#rt-onboarding-gear-tier'));
    bindGearTierSelect(el.querySelector('#rt-cr-gear-tier'));

    // Custom Instructions input & persistent preference save
    const customInstructionsInput = el.querySelector('#rt-onboarding-custom-instructions');
    if (customInstructionsInput) {
        customInstructionsInput.addEventListener('input', () => {
            getSettings().onboardingCustomInstructions = customInstructionsInput.value;
            saveSettings();
        });
    }

    // Create Persona (Other ways to begin) — persist + word-count "Other..." toggle
    const onboardingPersonaCb = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-onboarding-persona-cb'));
    if (onboardingPersonaCb) {
        onboardingPersonaCb.addEventListener('change', () => {
            getSettings().onboardingCreatePersona = !!onboardingPersonaCb.checked;
            saveSettings();
        });
    }
    const onboardingPersonaWords = /** @type {HTMLSelectElement|null} */ (el.querySelector('#rt-onboarding-persona-words'));
    const onboardingPersonaWordsCustom = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-onboarding-persona-words-custom'));
    if (onboardingPersonaWords) {
        onboardingPersonaWords.addEventListener('change', () => {
            getSettings().onboardingPersonaWords = onboardingPersonaWords.value || '150';
            if (onboardingPersonaWordsCustom) {
                onboardingPersonaWordsCustom.style.display = onboardingPersonaWords.value === 'other' ? 'inline-block' : 'none';
            }
            saveSettings();
        });
    }
    if (onboardingPersonaWordsCustom) {
        onboardingPersonaWordsCustom.addEventListener('input', () => {
            getSettings().onboardingPersonaWordsCustom = onboardingPersonaWordsCustom.value;
            saveSettings();
        });
    }

    // Time & Date segmented toggles — Character Creator + onboarding drawer
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
    bindDateFormatSeg('rt-cr-date-seg');
    bindDateFormatSeg('rt-onboarding-date-seg');
    bindClockFormatSeg('rt-cr-clock-seg');
    bindClockFormatSeg('rt-onboarding-clock-seg');

    const syncStartDateInput = (input) => {
        input.addEventListener('input', () => setInitialDateValue(input.value.trim(), input));
    };
    const crStartDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-cr-start-date'));
    if (crStartDateInput) syncStartDateInput(crStartDateInput);
    const drawerStartDateInput = /** @type {HTMLInputElement|null} */ (el.querySelector('#rt-onboarding-start-date'));
    if (drawerStartDateInput) syncStartDateInput(drawerStartDateInput);


    // Character Creator / onboarding ? help icons — tap opens popup (hover title still works on desktop)
    if (!el._crHelpDelegated) {
        el._crHelpDelegated = true;
        const helpSelector = '.rt-cr-help-icon[title]';
        const openCrHelp = (icon) => {
            const msg = icon.getAttribute('title');
            if (msg) void showSettingsHelpPopup(msg);
        };
        el.addEventListener('click', (e) => {
            const icon = e.target instanceof Element ? e.target.closest(helpSelector) : null;
            if (!icon || !el.contains(icon)) return;
            e.preventDefault();
            e.stopPropagation();
            openCrHelp(icon);
        });
        el.addEventListener('keydown', (e) => {
            const icon = e.target instanceof Element ? e.target.closest(helpSelector) : null;
            if (!icon || !el.contains(icon)) return;
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            openCrHelp(icon);
        });
    }
    el.querySelectorAll('.rt-cr-help-icon[title]').forEach(icon => {
        icon.setAttribute('role', 'button');
        icon.setAttribute('tabindex', '0');
        icon.setAttribute('aria-label', 'Show help');
    });

    // Character Creator Generate — delegated so clicks survive refreshRenderedView innerHTML swaps
    if (!el._crGenerateDelegated) {
        el._crGenerateDelegated = true;
        el.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement|null} */ (e.target instanceof Element ? e.target.closest('#rt-cr-generate-btn') : null);
            if (!target || /** @type {HTMLButtonElement} */ (target).disabled) return;
            const emptyEl = el.querySelector('.rt-empty');
            if (!emptyEl) return;
            e.preventDefault();
            handleCharacterCreatorGenerate(emptyEl);
        });
    }

    el.querySelectorAll('.rt-random-char-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const archetype = btn.dataset.archetype;
            const levelSelectEl = el.querySelector('#rt-starting-level');
            const level = parseInt(String(levelSelectEl?.value ?? getSettings().onboardingLevel ?? 1), 10) || 1;
            getSettings().onboardingLevel = level;
            const gearTierEl = /** @type {HTMLSelectElement|null} */ (el.querySelector('#rt-onboarding-gear-tier'));
            const gearTier = gearTierEl?.value || getSettings().onboardingGearTier || 'auto';
            getSettings().onboardingGearTier = gearTier;
            saveSettings();

            // char_roll and pc_import just open UI panels — no need to persist or trigger I/O
            if (archetype === 'char_roll') {
                showCharacterRollPanel(el);
                return;
            }
            if (archetype === 'pc_import') {
                showPcImportPanel(el);
                return;
            }

            // Time/date format and initial date are already the single source of truth
            // (kept in sync by setUseDdMmYyFormat/setUseDate24hTime/setInitialDateValue) —
            // just read them directly instead of re-deriving from a specific widget.
            const isCalendar = !!getSettings().useDdMmYyFormat;
            const startDateVal = isCalendar
                ? (getSettings().initialDate && getSettings().initialDate !== 'Day 1' ? getSettings().initialDate : '01/01/2026')
                : 'Day 1';
            const customInstructions = el.querySelector('#rt-onboarding-custom-instructions')?.value.trim() || '';
            // Gate optional blocks on enabled modules
            const _mods = getSettings().modules || {};
            const _hasXp        = !!_mods['xp'];
            const _hasTime      = !!_mods['time'];
            const _hasInventory = !!_mods['inventory'];
            const _hasAbilities = !!_mods['abilities'];
            const _hasSpells    = !!_mods['spells'];

            const levelPrefix = _hasXp
                ? `STARTING LEVEL: ${level} (mandatory — the character MUST be exactly Level ${level}).`
                : `STARTING LEVEL: ${level} (mandatory — the character MUST be exactly Level ${level}; scale/adjust HP, stats, saves, capabilities, and gear (everything a character of that level might have) to Level ${level} accordingly, but do NOT output an [XP] block as it is disabled).`;

            const xpHint = _hasXp ? buildOnboardingXpHint(level) : '';
            const TIME_FORMAT_HINT = _hasTime ? buildOnboardingTimeHint(startDateVal) : '';
            const magicGearHint = buildStartingGearHint(level, getSettings().onboardingGenre || 'fantasy', _hasInventory, gearTier);
            const combatSkillHint = buildCombatAndSkillScalingHint();

            const _activeBlocks = buildOnboardingActiveBlocks(getSettings());
            const _blockListStr  = _activeBlocks.join(', ');
            const _closingTags   = _activeBlocks.map(b => `[/${b}]`).join(', ');

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

            const CHARACTER_FORMAT_HINT = `\n\nCRITICAL TAG WRAPPING RULE: Every block you output MUST be enclosed in matching opening and closing tags. You must output the closing tag for every block (${_closingTags}).\nCRITICAL PARTY RULE: Do NOT output a [PARTY] block under any circumstances unless explicitly instructed.

Use this exact style:
[CHARACTER]
Barnaby "Salt-Eye" Finch (Pirate): 36/36 HP
Combat: BAB: +4 | Ranged (1 attack): +6 | Melee (1 attack): +5
Gear: Cutlass (1d6+2 Slashing) [E], AC: 14 (Leather Jerkin)
Attr: STR 14 (+2), DEX 15 (+2), CON 14 (+2), INT 12 (+1), WIS 10 (+0), CHA 14 (+2)
Saves: Fort +6 | Ref +6 | Will +1
[/CHARACTER]${_hasInventory ? `

[INVENTORY]
Gear:
- 🗡️ [Common] [E] Cutlass (1d6+2 Slashing)
[/INVENTORY]` : ''}${_hasAbilities ? `

[ABILITIES]
- Dirty Fighting
[/ABILITIES]` : ''}`;


            const REALISTIC_HINT = `\n\nCRITICAL REALISM RULE: This is a realistic/non-fantasy setting.
- Do NOT output a [SPELLS] block under any circumstances. Avoid all magic, spells, or magical powers.
- Avoid D&D classes (e.g. do NOT label them as Bard, Rogue, Fighter, Wizard, etc.) and fantasy races. Keep them as a realistic human.
- Use realistic modern/historical currency (e.g. $, USD, GBP, or simple cash/money) instead of GP/SP/CP.
- Wing it and homebrew modern capabilities: adapt attributes, saves, gear, and skills to fit a realistic setting. Keep items, weapons, and tools realistic (no fantasy or magical weapons).
- Firearms: when writing new gear/NPC/loot stats (not mid-scene conversion), damage ~2–3× D&D/PF firearm tables; common sense by type/caliber. Attack bonuses normal — only damage scales.`;

            const SCIFI_HINT = `\n\nCRITICAL SCI-FI RULE: This is a science-fiction setting.
- Do NOT output a [SPELLS] block. Avoid D&D classes and fantasy races.
- Use futuristic sci-fi gear (energy weapons, cybernetics, powered armor, starship equipment) instead of medieval fantasy gear.
- Use a sci-fi currency (e.g. Credits) instead of GP/SP/CP.
- Wing it and homebrew futuristic capabilities: adapt attributes, saves, gear, and skills to fit a sci-fi setting.`;

            const HORROR_HINT = `\n\nCRITICAL HORROR RULE: This is a horror/occult setting.
- Do NOT output a [SPELLS] block; represent any occult rituals or supernatural resistances as entries in [ABILITIES] instead.
- Avoid D&D classes and fantasy races. Keep the character grounded and vulnerable — horror characters are not superheroes.
- Use realistic modern/historical currency instead of GP/SP/CP.
- Wing it and homebrew fitting capabilities: adapt attributes, saves, gear, and skills for a tense horror survival setting.
- Firearms (if any): when writing new gear/NPC/loot stats (not mid-scene conversion), damage ~2–3× D&D/PF firearm tables; common sense by type/caliber. Attack bonuses normal — only damage scales.`;

            const prompts = {
                magic:            `${levelPrefix} Generate a random Level ${level} D&D Magic User (Wizard, Sorcerer, or Warlock). Give them a random fantasy name (do NOT use {{user}}). Output ${_blockListStr} blocks${_hasSpells ? " (using 'Cantrips:' for level 0 spells)" : ''}. Include appropriate${_hasSpells ? ' spells,' : ''} items, and attributes consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${magicGearHint}`,
                melee:            `${levelPrefix} Generate a random Level ${level} D&D Melee Fighter (Fighter, Barbarian, or Paladin). Give them a random fantasy name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on high physical attributes, heavy armor, and signature weapons consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${magicGearHint}`,
                rogue:            `${levelPrefix} Generate a random Level ${level} D&D Rogue or Thief-style character. Give them a random fantasy name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on high Dexterity, stealth-related equipment, and class features consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${magicGearHint}`,
                professional:     `${levelPrefix} Generate a random Level ${level} modern professional/specialist character. Give them a realistic name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on specialized professional skills, modern gear, and attributes consistent with a Level ${level} specialist.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${REALISTIC_HINT}`,
                survivor:         `${levelPrefix} Generate a random Level ${level} survivor character. Give them a realistic name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on physical resilience, survival/scavenged gear, and attributes consistent with a Level ${level} survivor.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${REALISTIC_HINT}`,
                scholar:          `${levelPrefix} Generate a random Level ${level} intellectual/scholar character. Give them a realistic name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on intelligence, knowledge-based traits, research tools/gear, and attributes consistent with an intellectual Level ${level} scholar.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${REALISTIC_HINT}`,
                scifi_pilot:      `${levelPrefix} Generate a random Level ${level} sci-fi pilot/ace character. Give them a realistic or sci-fi-style name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on piloting skills, a signature ship/vehicle callsign, and sidearm/survival gear consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${SCIFI_HINT}`,
                scifi_engineer:   `${levelPrefix} Generate a random Level ${level} sci-fi engineer/technician character. Give them a realistic or sci-fi-style name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on technical skills, tools/gadgets, and gear consistent with a Level ${level} engineer.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${SCIFI_HINT}`,
                scifi_marine:     `${levelPrefix} Generate a random Level ${level} sci-fi combat marine/soldier character. Give them a realistic or sci-fi-style name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on combat training, powered armor or tactical gear, and weaponry consistent with a Level ${level} marine.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${SCIFI_HINT}`,
                horror_investigator: `${levelPrefix} Generate a random Level ${level} horror investigator character. Give them a realistic name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on investigative skills, mundane gear, and a fraying grip on sanity consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${HORROR_HINT}`,
                horror_occultist: `${levelPrefix} Generate a random Level ${level} occultist character with forbidden knowledge. Give them a realistic name (do NOT use {{user}}). Output ${_blockListStr} blocks.${_hasAbilities ? ' Represent any ritual or occult knowledge as entries in [ABILITIES] rather than spells,' : ''} consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${HORROR_HINT}`,
                horror_survivor:  `${levelPrefix} Generate a random Level ${level} horror survivor character. Give them a realistic name (do NOT use {{user}}). Output ${_blockListStr} blocks. Focus on resourcefulness, improvised weapons/tools, and fragile but resilient stats consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${HORROR_HINT}`
            };

            // ── Custom archetype: freeform character based entirely on custom instructions ──
            if (archetype === 'custom') {
                if (!customInstructions) {
                    toastr['warning']('Please enter custom setting/character instructions first.', 'RPG Tracker');
                    return;
                }
                el.querySelectorAll('.rt-random-char-btn').forEach(b => b.disabled = true);
                btn.textContent = labels.custom;
                let customPrompt = `${levelPrefix} Generate a random Level ${level} character based entirely on these custom instructions: "${customInstructions}". Output ${_blockListStr} blocks${_hasSpells ? " (and [SPELLS] if appropriate for the class, using 'Cantrips:' for level 0 spells)" : ''}. Adapt all attributes, skills, saves, descriptions, and gear to match the setting and instructions perfectly.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${magicGearHint}`;
                if (isCalendar) {
                    customPrompt += `\n\nCRITICAL REALISM RULE: This is a realistic/non-fantasy setting. Do NOT output a [SPELLS] block. Use realistic modern/historical currencies instead of GP/SP/CP. Firearms on new gear/NPCs/loot: damage ~2–3× D&D/PF norms by common sense; attack bonuses unchanged (not mid-scene conversion).`;
                }
                try {
                    syncOnboardingPersonaPrefsFromDom(el);
                    await sendDirectPrompt(customPrompt + combatSkillHint);
                    const personaHints = `\n\n--- PLAYER PREFERENCES & HINTS ---\nAdditional: ${customInstructions}\n`;
                    await maybeCreateOnboardingPersona(personaHints);
                } finally {
                    el.querySelectorAll('.rt-random-char-btn').forEach(b => b.disabled = false);
                    btn.textContent = '⚙️ Custom';
                }
                return;
            }

            // ── Persona archetype: derive character from the active SillyTavern persona ──
            if (archetype === 'persona') {
                const persona = await resolveActivePersonaDescription();
                if (!persona) {
                    toastr['warning'](
                        'No persona is set. Set a persona in SillyTavern (User Settings → Personas) and try again.',
                        'RPG Tracker'
                    );
                    return;
                }
                const { name: personaName, description: resolvedPersona } = persona;
                el.querySelectorAll('.rt-random-char-btn').forEach(b => b.disabled = true);
                btn.textContent = labels.persona;
                const nameClause = personaName
                    ? ` The character's name MUST be "${personaName}" (the active persona name).`
                    : '';
                let personaPrompt = `${levelPrefix} Using the following persona description as the basis for the player character, create a Level ${level} character that faithfully embodies this persona.${nameClause} Translate the personality, background, and traits into appropriate stats, class, race, and equipment. Output ${_blockListStr} blocks${_hasSpells ? " (and [SPELLS] if the class is a spellcaster, using 'Cantrips:' for level 0 spells)" : ''}. All attributes and gear should be consistent with Level ${level}.${CHARACTER_FORMAT_HINT}${xpHint}${TIME_FORMAT_HINT}${magicGearHint}\n\nPersona${personaName ? ` — ${personaName}` : ''}:\n${resolvedPersona}`;
                if (customInstructions) {
                    personaPrompt += `\n\nAdditional setting/instruction constraints: ${customInstructions}. Adapt the name, attributes, description, gear, and spells (if any) to match this setting/instruction perfectly.`;
                }
                await sendDirectPrompt(personaPrompt + combatSkillHint);
                return;
            }

            el.querySelectorAll('.rt-random-char-btn').forEach(b => b.disabled = true);
            btn.textContent = labels[archetype] || '🎲 Rolling...';
            let promptText = prompts[archetype];
            if (customInstructions) {
                promptText += `\n\nAdditional setting/instruction constraints: ${customInstructions}. Adapt the name, attributes, description, gear, and spells (if any) to match this setting/instruction perfectly.`;
            }
            try {
                syncOnboardingPersonaPrefsFromDom(el);
                await sendDirectPrompt(promptText + combatSkillHint);
                const personaHints = customInstructions
                    ? `\n\n--- PLAYER PREFERENCES & HINTS ---\nAdditional: ${customInstructions}\n`
                    : '';
                await maybeCreateOnboardingPersona(personaHints);
            } finally {
                el.querySelectorAll('.rt-random-char-btn').forEach(b => b.disabled = false);
            }
        });
    });

    el.querySelectorAll('[data-recolor-id]').forEach(wrap => {
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

    // Lorebook Agent Documentation (settings + onboarding)
    el.querySelectorAll('.rt-lorebook-agent-docs-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showLorebookAgentDocumentation();
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

    // Keep startup controls on the same persistence path as their sidebar counterparts.
    // This intentionally lives here because this renderer can be mounted independently
    // of the sidebar settings panel.
    const syncSettingsAndUI = (mutator) => {
        const settings = getSettings();
        mutator(settings);
        registerDiceFunctionTool();
        saveSettings();
        scheduleAutoApply();
    };

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
                autoSelectRngToolsFromMode(settings);
            });
        });
    });

    el.querySelectorAll('.rt-narrative-pacing-help').forEach(button => {
        if (button._bound) return;
        button._bound = true;
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            showNarrativePacingExplanation();
        });
    });

    const onboardingPacingInputs = el.querySelectorAll('input[name="rt_onboarding_narrative_pacing"]');
    onboardingPacingInputs.forEach(input => {
        const pacing = ['normal', 'high_agency', 'downtime'].includes(s.narrativePacing) ? s.narrativePacing : 'normal';
        input.checked = input.value === pacing;
        input.addEventListener('change', () => {
            if (!input.checked || !['normal', 'high_agency', 'downtime'].includes(input.value)) return;
            syncSettingsAndUI(settings => {
                settings.narrativePacing = input.value;
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
                    if (settingKey === 'party_bench') {
                        if (!settings.modules) settings.modules = {};
                        settings.modules['benched party'] = !!cb.checked;
                        if (cb.checked) settings.modules.party = true;
                    }
                });
            });
        }
    };
    syncOptionalMod('#rt_onboarding_mod_loot', 'loot');
    syncOptionalMod('#rt_onboarding_mod_random_events', 'random_events');
    syncOptionalMod('#rt_onboarding_mod_resting', 'resting');
    syncOptionalMod('#rt_onboarding_mod_party_bench', 'party_bench');
    syncOptionalMod('#rt_onboarding_mod_cyoa_mode', 'CYOA_mode');

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
                    void refreshAgentManifest().catch(() => { });
                }
            }, 1);
        });
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

    el.querySelectorAll('.rt-char-to-persona-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (btn.disabled) return;
            const s = getSettings();
            const memo = s.currentMemo || '';
            if (!/\[CHARACTER\]/i.test(memo)) {
                toastr['warning']('No [CHARACTER] block found in the state memo.', 'RPG Tracker');
                return;
            }
            const charName = extractCharNameFromMemo(memo) || 'My Character';
            const wordsRaw = s.onboardingPersonaWords === 'other'
                ? s.onboardingPersonaWordsCustom
                : (s.onboardingPersonaWords || '150');
            const wordCount = parseInt(String(wordsRaw || '150'), 10) || 150;
            const personaOpts = { chatLookback: 3, preferCharacterBlock: true };
            const extraHints = '\n\nSource: existing [CHARACTER] sheet. Match its stats, class, gear, and traits. Use the last 3 story messages only for voice, relationships, and current situation.';
            const prev = btn.textContent;
            btn.disabled = true;
            btn.textContent = '⏳';
            try {
                toastr['info'](`Generating Lorebook Agent persona for "${charName}"…`, 'RPG Tracker');
                const bio = await generatePersonaBio(charName, wordCount, extraHints, personaOpts);
                if (bio) {
                    showPersonaConfirmOverlay(bio, charName, wordCount, extraHints, personaOpts);
                } else {
                    toastr['warning']('Persona bio generation failed.', 'RPG Tracker');
                }
            } finally {
                btn.disabled = false;
                btn.textContent = prev || '👤';
            }
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

    // ── Tab Mode: tab strip, vitals-strip jump, swipe ──
    //
    // Deliberately NOT touching scrollTop anywhere here. Any programmatic scroll on tab
    // switch (even a "helpful" one) reads as a jarring auto-scroll/bounce, forcing the
    // user to re-locate the content with their eyes every time. Instead, the scrollable
    // area is padded (see .rt-tabmode-wrap / .rt-tabmode-content in style.css) with
    // enough extra room below the content that the browser practically never needs to
    // clamp scrollTop when a shorter tab is selected — so whatever position the user
    // parked the viewport at stays exactly where it is across tab switches.
    el.querySelectorAll('.rt-tab-btn[data-tag]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = btn.dataset.tag;
            if (!tag) return;
            saveActiveTab(tag);
            refresh();
        });
    });

    el.querySelectorAll('.rt-vitals-member[data-jump-tag]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = btn.dataset.jumpTag;
            if (!tag) return;
            saveActiveTab(tag);
            refresh();
        });
    });

    // Benched Party camp-roster chips: click toggles that one member's inline expand
    // (full stat card accordion) — independent of the panel-level collapse above.
    el.querySelectorAll('.rt-benched-chip[data-benched-toggle]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.benchedToggle;
            if (!name) return;
            const expanded = loadBenchedExpanded();
            if (expanded.has(name)) expanded.delete(name); else expanded.add(name);
            saveBenchedExpanded(expanded);
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
    let pillDeselectHandler = runtime.getPillDeselectHandler();
    if (!pillDeselectHandler) {
        pillDeselectHandler = (e) => {
            if (!e.target.closest('.rt-unit-pill')) {
                document.querySelectorAll('.rt-unit-pill.active').forEach(u => u.classList.remove('active'));
            }
        };
        runtime.setPillDeselectHandler(pillDeselectHandler);
        document.addEventListener('click', pillDeselectHandler);
    }

    // ── Portrait drag-drop and click handlers ─────────────────────────────────
    el.querySelectorAll('.rt-entity-portrait-container').forEach(container => {
        const entityName = container.closest('.rt-entity-container')?.dataset?.entityName || '';
        if (!entityName) return;

        const localApply = async (src) => {
            await applyPortraitData(entityName, src);
            refresh();
            void refreshNpcManifest().catch(() => { });
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
