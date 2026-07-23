import { runtimeState } from '../../app/runtime-state.js';
import { createRouterViewRenderer } from './panel-router-view.js';
import { wireAgentWorldProgression } from './panel-world-progression.js';
import { wireAgentActivity } from './panel-agent-activity.js';
import { buildPanelMarkup } from './panel-markup.js';
import { createSceneViewController } from './panel-scene-view.js';

/** Builds and wires the tracker panel. Dependencies stay explicit to avoid entry-module cycles. */
export function createPanel(dependencies) {
    const {
        DEFAULT_MODULES,
        DEFAULT_NPC_SECTIONS,
        DEFAULT_PC_SECTIONS,
        activateCampaignBooks,
        applyLocationImageData,
        applyLocationImageSetting,
        applyNpcPortraitSetting,
        applyPanelBackgroundToDom,
        applyPortraitData,
        applyQuestSyncAndStripMemo,
        applyRelTierBadgeElement,
        autoGenerateEnemyPortraits,
        autoGeneratePartyPortraits,
        buildImmersionSceneState,
        buildLocationPath,
        buildNpcInstruction,
        canResizePanels,
        checkAndTriggerAutoGenerations,
        clampRelationshipValue,
        confirmAndPurgeWorldHistory,
        deleteLorebookEntry,
        escapeHtml,
        extractCurrentTimeStr,
        fileToDataUrl,
        formatInWorldTime,
        getLorebookManifest,
        getNarrativeBlocks,
        getNpcRelationshipMax,
        getNpcRelationshipMaxDefault,
        getRequestHeaders,
        getRouterTick,
        getSettings,
        handleTrackerEnabledChange,
        isRouterRunning,
        loadChatState,
        loadDeltaHeight,
        loadLocationEntryByPath,
        loadNpcEntryByKey,
        loadPanelGeometry,
        lookupCustomPortraitSrc,
        makeDraggable,
        makeResizableBL,
        makeResizableBR,
        makeResizableTR,
        maybeAutoGenerateImmersionSceneArt,
        memoForGmContext,
        navigateSnapshot,
        normalizeLocationPath,
        openNpcSectionEditor,
        parseInWorldTime,
        reapplyRouterPass,
        refreshAgentManifestNow,
        refreshAll,
        refreshDayNightCycleFromMemo,
        refreshLorebookAgentViewsNow,
        refreshRenderedView,
        relationshipBarPct,
        removeAllPortraits,
        renamePortraitEntity,
        renderImmersionViewHtml,
        renderLorebookTerminal,
        renderRelTierDetailed,
        renderRelTierRow,
        resolveLocationImageWithMeta,
        resolvePortraitSrcForPlayerCharacter,
        rollbackRouterPass,
        runRealtimeSceneArtCheck,
        runRouterPass,
        runStateModelPass,
        sanitizeLorebookRecordContent,
        saveChatState,
        saveSettings,
        scaleImageTo512Square,
        scaleImageToLandscape,
        sendDirectPrompt,
        sendStateRequest,
        setNpcRelationshipMaxForCurrentChat,
        setupDeltaResize,
        setupResizeObserver,
        showLocationImageSettingsMenu,
        showLorebookAgentDocumentation,
        showPortraitSettingsMenu,
        stopRouterPass,
        syncCampaignPrefixAndWorldsForChat,
        syncMemoView,
        syncRouterPrefixDisplays,
        toggleDebugViewer,
        updateAgentStatusIndicator,
        updateChatLinkUI,
        updateLorebookEntry,
        updatePanelStatus,
    } = dependencies;

    const settings = getSettings();

    // Cleanup any existing detached panels from the body to prevent duplicates on re-init
    document.querySelectorAll('body > .rpg-tracker-detached-panel').forEach(el => el.remove());
    document.querySelector('body > #rpg-tracker-agent')?.remove();

    const agentDetachedOnLoad = localStorage.getItem('rpg_tracker_agent_detached') === 'true';
    const agentModeOnLoad = settings.trackerContentMode === 'agent';
    const mainPanelCollapsedOnLoad = (agentModeOnLoad && !agentDetachedOnLoad)
        ? !!settings.agentCollapsed
        : !!settings.trackerCollapsed;
    const agentPanelCollapsedClass = (agentDetachedOnLoad && settings.agentCollapsed) ? 'rt-panel-collapsed ' : '';

    const panel = document.createElement('div');
    panel.id = 'rpg-tracker-panel';
    panel.className = `rpg-tracker-panel ${mainPanelCollapsedOnLoad ? 'rt-panel-collapsed ' : ''}${settings.trackerTheme || 'rt-theme-native'}`;
    panel.style.setProperty('--rt-base-size', (settings.fontSize || 13) + 'px');
    panel.innerHTML = buildPanelMarkup({ settings, agentPanelCollapsedClass });

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
    if (canResizePanels() && resizerTR instanceof HTMLElement) {
        makeResizableTR(/** @type {HTMLElement} */(panel), resizerTR);
    }

    // State tracker bottom-right resizer (created via JS for guaranteed rendering)
    const resizerBR = document.createElement('div');
    resizerBR.id = 'rt-resizer-br';
    resizerBR.className = 'rt-resizer-br';
    resizerBR.title = 'Resize from bottom-right';
    panel.appendChild(resizerBR);
    if (canResizePanels()) {
        makeResizableBR(/** @type {HTMLElement} */(panel), resizerBR);
    }

    // State tracker bottom-left resizer
    const resizerBL = document.createElement('div');
    resizerBL.id = 'rt-resizer-bl';
    resizerBL.className = 'rt-resizer-bl';
    resizerBL.title = 'Resize from bottom-left';
    panel.appendChild(resizerBL);
    if (canResizePanels()) {
        makeResizableBL(/** @type {HTMLElement} */(panel), resizerBL);
    }

    // Agent panel bottom-right resizer
    // Must use the agent geometry key — default savePanelGeometry writes the tracker key
    // and would snap the State Tracker onto the agent after resize + F5.
    const AGENT_GEO_KEY = 'rpg_tracker_geometry_lorebook_agent';
    const agentPanelEl = /** @type {HTMLElement} */(panel.querySelector('#rpg-tracker-agent'));
    const agentResizerBR = panel.querySelector('#rt-agent-resizer-br');
    if (canResizePanels() && agentResizerBR instanceof HTMLElement && agentPanelEl) {
        makeResizableBR(agentPanelEl, agentResizerBR, AGENT_GEO_KEY);
    }

    // Agent panel bottom-left resizer
    const agentResizerBL = panel.querySelector('#rt-agent-resizer-bl');
    if (canResizePanels() && agentResizerBL instanceof HTMLElement && agentPanelEl) {
        makeResizableBL(agentPanelEl, agentResizerBL, AGENT_GEO_KEY);
    }

    const stopBtn = panel.querySelector('#rpg-tracker-stop-btn');
    if (stopBtn) {
        stopBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // 1. Abort the state update controller (kills fetch/Ollama/OpenAI)
            if (runtimeState.stateController) {
                runtimeState.stateController.abort();
                runtimeState.stateController = null;
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
            void handleTrackerEnabledChange(s, !s.enabled);
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

            if (turningOn && runtimeState.currentChatId) {
                const saved = s.chatStates?.[runtimeState.currentChatId];
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
                        loadChatState(runtimeState.currentChatId);
                        toastr['success']('Chat Link ON — restored saved state.', 'RPG Tracker');
                    } else if (choice === POPUP_RESULT.NEGATIVE) {
                        // User wants to Overwrite
                        if (saved.currentMemo) {
                            s.memoHistory.unshift(saved.currentMemo);
                            if (s.memoHistory.length > 50) s.memoHistory.length = 50;
                        }
                        saveChatState(runtimeState.currentChatId);
                        toastr['success']('Chat Link ON — current state saved to chat.', 'RPG Tracker');
                    } else {
                        // User closed the modal or hit escape — cancel the toggle
                        return;
                    }
                } else {
                    // No conflict or chat was empty
                    saveChatState(runtimeState.currentChatId);
                    toastr['success']('Chat Link ON — state bound to this chat.', 'RPG Tracker');
                }
            } else if (turningOn) {
                // Normal lock (empty or new chat)
                if (runtimeState.currentChatId) {
                    const found = loadChatState(runtimeState.currentChatId);
                    if (!found) saveChatState(runtimeState.currentChatId);
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
    const agentPanel = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-agent'));
    agentPanel.style.setProperty('--rt-base-size', (settings.agentFontSize || 13) + 'px');
    const agentCloseBtn = /** @type {HTMLElement} */ (document.getElementById('rpg-tracker-agent-close'));

    runtimeState.renderRouterUI = createRouterViewRenderer({
        agentPanel,
        escapeHtml,
        extractCurrentTimeStr,
        formatInWorldTime,
        getSettings,
        parseInWorldTime,
        saveSettings,
    })

    // Assigned below when the agent panel is wired. Declared here so
    // nav handlers outside the wiring block can always call it safely.
    let refreshManifest = async (_source = 'uninitialized') => { };
    let _manifestRenderGen = 0;
    /** When true, refreshManifest runs catalog handler init while Scene View stays visible. */
    let _manifestBypassImmersion = false;
    const areAgentCharacterDetailHandlersReady = () => {
        const s = getSettings();
        const needsPcHandler = runtimeState.currentChatId && s.chatStates?.[runtimeState.currentChatId]?.playerCharacter;
        return typeof globalThis._rpgAgentOpenNpcDetail === 'function'
            && typeof globalThis._rpgAgentParseRelationship === 'function'
            && (!needsPcHandler || typeof globalThis._rpgAgentOpenPcDetail === 'function');
    };
    let updateAgentBtnUI = () => { };

    const isAgentDetachedForCollapse = () => localStorage.getItem('rpg_tracker_agent_detached') === 'true';

    function applyPanelCollapseUi() {
        const s = getSettings();
        const detached = isAgentDetachedForCollapse();
        const integratedAgent = s.trackerContentMode === 'agent' && !detached;

        if (integratedAgent) {
            panel.classList.toggle('rt-panel-collapsed', !!s.agentCollapsed);
            agentPanel.classList.remove('rt-panel-collapsed');
        } else if (detached) {
            panel.classList.toggle('rt-panel-collapsed', !!s.trackerCollapsed);
            agentPanel.classList.toggle('rt-panel-collapsed', !!s.agentCollapsed);
        } else {
            panel.classList.toggle('rt-panel-collapsed', !!s.trackerCollapsed);
            if (agentPanel.classList.contains('rt-agent-integrated')) {
                agentPanel.classList.remove('rt-panel-collapsed');
            }
        }

        const trackerIcon = panel.querySelector('#rpg-tracker-collapse-btn i');
        if (trackerIcon) {
            trackerIcon.className = s.trackerCollapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
        }
        const agentIcon = panel.querySelector('#rt-agent-router-collapse-btn i')
            || agentPanel.querySelector('#rt-agent-router-collapse-btn i');
        if (agentIcon) {
            agentIcon.className = s.agentCollapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
        }
    }

    if (agentPanel && agentCloseBtn) {
        const isAgentDetached = () => localStorage.getItem('rpg_tracker_agent_detached') === 'true';
        /** Header controls live on #rt-header-face-agent (main panel or detached agent header). */
        const queryAgentUi = (sel) => agentPanel.querySelector(sel) || panel.querySelector(sel);

        const agentWorldProgression = wireAgentWorldProgression({
            agentPanel,
            confirmAndPurgeWorldHistory,
            extractCurrentTimeStr,
            formatInWorldTime,
            getSettings,
            parseInWorldTime,
            saveChatState,
            saveSettings,
            syncCampaignPrefixAndWorldsForChat,
        });
        const updateAgentWorldStatus = agentWorldProgression.updateStatus;

        agentCloseBtn.addEventListener('click', () => {
            if (isAgentDetached()) {
                agentPanel.style.display = 'none';
                updateAgentBtnUI();
                return;
            }
            applyPanelContentMode('tracker');
        });
        const helpBtn = agentPanel.querySelector('#rt-agent-help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                showLorebookAgentDocumentation();
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
            const agentEnableBtn = /** @type {HTMLElement|null} */ (queryAgentUi('#rt-agent-router-enable-btn'));
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
            applyPanelCollapseUi();
        };

        const agentCollapseBtn = queryAgentUi('#rt-agent-router-collapse-btn');
        if (agentCollapseBtn) {
            agentCollapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleAgentCollapse();
            });
        }

        const agentHeaderFace = panel.querySelector('#rt-header-face-agent');
        if (agentHeaderFace) {
            agentHeaderFace.addEventListener('dblclick', (e) => {
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
        const agentEnableBtn = queryAgentUi('#rt-agent-router-enable-btn');
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
                const oldLabel = item.label;
                const newLabel = titleInp.value;
                const rawKeys = keysInp.value.split(',').map(k => k.trim()).filter(Boolean);
                const ok = await updateLorebookEntry(item.id, {
                    content: contentArea.value,
                    key: rawKeys,
                    comment: newLabel,
                });
                if (ok) {
                    if (oldLabel !== newLabel) {
                        await renamePortraitEntity(oldLabel, newLabel);
                    }
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

        const sceneView = createSceneViewController({
            agentPanel,
            buildImmersionSceneState,
            getSettings,
            loadLocationEntryByPath,
            loadNpcEntryByKey,
            maybeAutoGenerateImmersionSceneArt,
            renderImmersionViewHtml,
            runRealtimeSceneArtCheck,
            showLocationImageSettingsMenu,
        });
        const syncAgentImmersionUi = sceneView.syncAgentImmersionUi;

        refreshManifest = async (source = 'auto') => {
            const s = getSettings();
            if (s.agentImmersionMode && !_manifestBypassImmersion) {
                if (!areAgentCharacterDetailHandlersReady()) {
                    _manifestBypassImmersion = true;
                    try {
                        await refreshManifest(source);
                    } finally {
                        _manifestBypassImmersion = false;
                    }
                }
                await runtimeState.refreshImmersionView();
                return;
            }

            const list = agentPanel.querySelector('#rt-agent-manifest-list');
            if (!list) return;

            const gen = ++_manifestRenderGen;
            list.innerHTML = '';
            // Helper: escape HTML to prevent XSS and rendering issues
            const escapeHtml = (unsafe) => (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

            // Helper: parse NPC/PC content into structured sections for the detail popup
            const parseNpcSections = (content, isPC = false) => {
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
                const customSecs = isPC ? (getSettings().pcCoreSections || DEFAULT_PC_SECTIONS) : (getSettings().npcCoreSections || DEFAULT_NPC_SECTIONS);
                const escRgx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const customNames = customSecs.map(s => escRgx(s.name.trim())).join('|');
                // Background must not match inside "Brief Background:" (zero-width splitter would
                // insert a newline before "Background", leaving a stray "Brief" under Personality).
                const legacyNames = 'Appearance\\/Species|Appearance|Personality|Brief Background|(?<!Brief\\s)Background|Habits(?:\\/|\\s*&\\s*|\\s+and\\s+)Behaviors|Habits|(?<!Habits\\/)(?<!Habits & )(?<!Habits and )Behaviors|Strengths|Flaws|Relationship with\\s*\\{\\{user\\}\\}|(?<!Friendship\\/)(?<!Affection\\/)Relationship';

                // Discover any lazily-appended fields (e.g. "Combat Profile:") not in the known sets
                const knownNamesForScan = new Set(customSecs.map(s => s.name.trim().toLowerCase()));
                const legacySet = new Set(['appearance/species','appearance','personality','brief background','background','habits/behaviors','habits','behaviors','strengths','flaws','relationship']);
                const discoveredNames = [];
                for (const rawLine of coreContent.split('\n')) {
                    const hm = rawLine.trim().match(/^([A-Z][A-Za-z0-9 \/&]+?)\s*:/);
                    if (hm) {
                        const nm = hm[1].trim();
                        const nmLc = nm.toLowerCase();
                        if (!knownNamesForScan.has(nmLc) && !legacySet.has(nmLc)) {
                            discoveredNames.push(escRgx(nm));
                        }
                    }
                }
                const extraNames = discoveredNames.length ? discoveredNames.join('|') : '';
                const allNamesPattern = [customNames, extraNames, legacyNames].filter(Boolean).join('|');
                const sectionMarkers = new RegExp(`(?=(?:${allNamesPattern})\\s*:)`, 'gi');

                const normalizedCore = coreContent.replace(sectionMarkers, '\n');
                const coreLines = normalizedCore.split('\n');
                let currentSection = 'General';

                const allNamesPatternStart = [customNames, extraNames, 'Appearance\\/Species|Appearance|Personality|Brief Background|(?<!Brief\\s)Background|Habits(?:\\/|\\s*&\\s*|\\s+and\\s+)Behaviors|Habits|(?<!Habits\\/)(?<!Habits & )(?<!Habits and )Behaviors|Strengths|Flaws|Relationship with\\s*\\{\\{user\\}\\}|Relationship'].filter(Boolean).join('|');
                const sectionPattern = new RegExp(`^(${allNamesPatternStart})\\s*:`, 'i');

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
                'Strengths': '⚡', 'Flaws': '⚠️',
            };

            const renderSectionsHtml = (rawContent, isPC = false) => {
                const parsed = parseNpcSections(rawContent, isPC);
                const customSecs = isPC ? (getSettings().pcCoreSections || DEFAULT_PC_SECTIONS) : (getSettings().npcCoreSections || DEFAULT_NPC_SECTIONS);
                let html = '';
                const coreEntries = Object.entries(parsed.core);
                if (coreEntries.length > 0) {
                    html += `<div style="font-size:11px;font-weight:bold;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;">🛡️ Core Identity</div>`;
                    for (const [name, lines] of coreEntries) {
                        const config = customSecs.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
                        const icon = config ? config.icon : (sectionIcons[name] || '📋');
                        const sectionColor = config ? config.color : (
                            (name === 'Appearance/Species' || name === 'Appearance') ? '#d4a940' :
                                name === 'Personality' ? '#8b5cf6' :
                                    name === 'Brief Background' ? '#3b82f6' :
                                        name.includes('Habit') || name.includes('Behavior') ? '#10b981' :
                                            name === 'Strengths' ? '#22c55e' :
                                                name === 'Flaws' ? '#ef4444' :
                                                    'var(--SmartThemeEmColor, var(--SmartThemeBodyColorTextMuted, rgba(128,128,128,0.5)))'
                        );
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
                if (runtimeState.currentChatId && s.chatStates?.[runtimeState.currentChatId]?.playerCharacter) {
                    const pc = s.chatStates[runtimeState.currentChatId].playerCharacter;

                    let desc = '';
                    if (pc.bio) {
                        const cleanBio = pc.bio.replace(/\[\/?CORE\]/gi, '');
                        desc = cleanBio.split('\n').map(l => l.trim()).filter(l => l && !/^\[ID:/i.test(l)).slice(0, 2).join(' ').substring(0, 260);
                    }
                    const portraitSrc = resolvePortraitSrcForPlayerCharacter(s, pc.name);

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
                        const popupPortraitSrc = resolvePortraitSrcForPlayerCharacter(s, pc.name);
                        const hidePortrait = s.npcPortraits === false;
                        const popupPortraitEl = popupPortraitSrc
                            ? `<img src="${escapeHtml(popupPortraitSrc)}" style="width:100%;height:auto;aspect-ratio:1;object-fit:cover;border-radius:12px;border:2px solid rgba(120,80,220,0.5);box-shadow:0 4px 20px rgba(0,0,0,0.4);" alt="${escapeHtml(pc.name)}">`
                            : `<div style="width:100%;aspect-ratio:1;border-radius:12px;background:var(--SmartThemeBorderColor, rgba(128,128,128,0.1));border:2px solid rgba(120,80,220,0.3);display:flex;align-items:center;justify-content:center;font-size:64px;opacity:0.25;color:var(--SmartThemeBodyColor, inherit);">👤</div>`;

                        const popupDom = document.createElement('div');
                        popupDom.style.cssText = 'width:100%;box-sizing:border-box;padding:24px;text-align:left;font-family:var(--rt-font, system-ui, sans-serif);color:var(--SmartThemeBodyColor, inherit);max-height:85vh;overflow-y:auto;';

                        const sectionsInitialHtml = renderSectionsHtml(pc.bio, true) || '<div style="font-size:14px;color:var(--SmartThemeBodyColor, inherit);opacity:0.5;font-style:italic;padding:16px 0;">No structured sections found.</div>';

                        popupDom.innerHTML = `
                            <div style="display:flex;gap:24px;margin-bottom:20px;align-items:flex-start;flex-wrap:wrap;">
                                ${hidePortrait ? '' : `<div style="flex-shrink:0;width:280px;">${popupPortraitEl}</div>`}
                                <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px;">
                                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                                        <div style="font-size:24px;font-weight:bold;color:#c4b5fd;line-height:1.2;">${escapeHtml(pc.name)}</div>
                                        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
                                            <button class="rt-npc-popup-edit-btn menu_button" style="flex-shrink:0;font-size:12px;padding:4px 12px;white-space:nowrap;">✏️ Edit Text</button>
                                            <button class="rt-npc-popup-ai-edit-btn menu_button" style="flex-shrink:0;font-size:12px;padding:4px 12px;white-space:nowrap;background:rgba(120,80,220,0.15);border-color:rgba(120,80,220,0.5);color:#c4b5fd;">✨ Edit with AI</button>
                                        </div>
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
                                <div class="rt-npc-popup-ai-edit" style="display:none;flex-direction:column;gap:10px;">
                                    <div style="font-size:11px;font-weight:bold;color:rgba(120,80,220,0.9);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">✨ AI Edit Request</div>
                                    <textarea class="rt-npc-popup-ai-instructions" spellcheck="true" placeholder="Describe what you want changed or iterated on… e.g. 'Make the background more tied to the ongoing war' or 'Give her a more cynical personality'" style="width:100%;min-height:90px;box-sizing:border-box;background:var(--SmartThemeBlurTintColor, rgba(0,0,0,0.3));color:var(--SmartThemeBodyColor, inherit);border:1px solid rgba(120,80,220,0.5);border-radius:8px;padding:12px;font-family:inherit;font-size:13px;line-height:1.6;resize:vertical;"></textarea>
                                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                                        <button class="rt-npc-popup-ai-cancel-btn menu_button" style="font-size:12px;padding:5px 14px;">Cancel</button>
                                        <button class="rt-npc-popup-ai-generate-btn menu_button" style="font-size:12px;padding:5px 18px;background:rgba(120,80,220,0.2);border-color:rgba(120,80,220,0.5);color:#c4b5fd;font-weight:bold;">✨ Generate</button>
                                    </div>
                                    <div class="rt-npc-popup-ai-preview" style="display:none;flex-direction:column;gap:8px;">
                                        <div style="font-size:11px;font-weight:bold;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;">Preview — Review before applying</div>
                                        <textarea class="rt-npc-popup-ai-preview-text" spellcheck="false" style="width:100%;min-height:320px;box-sizing:border-box;background:rgba(0,0,0,0.35);color:var(--SmartThemeBodyColor, inherit);border:1px solid rgba(120,80,220,0.3);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;line-height:1.6;resize:vertical;"></textarea>
                                        <div style="display:flex;gap:8px;justify-content:flex-end;">
                                            <button class="rt-npc-popup-ai-regen-btn menu_button" style="font-size:12px;padding:5px 14px;">🔄 Regenerate</button>
                                            <button class="rt-npc-popup-ai-apply-btn menu_button" style="font-size:12px;padding:5px 18px;background:rgba(0,200,140,0.15);border-color:rgba(0,200,140,0.5);color:#00c88c;font-weight:bold;">✅ Apply</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;

                        const viewPane = popupDom.querySelector('.rt-npc-popup-view');
                        const editPane = popupDom.querySelector('.rt-npc-popup-edit');
                        const aiEditPane = popupDom.querySelector('.rt-npc-popup-ai-edit');
                        const textarea = /** @type {HTMLTextAreaElement} */ (popupDom.querySelector('.rt-npc-popup-textarea'));
                        const editBtn = popupDom.querySelector('.rt-npc-popup-edit-btn');
                        const aiEditBtn = popupDom.querySelector('.rt-npc-popup-ai-edit-btn');
                        const cancelBtn = popupDom.querySelector('.rt-npc-popup-cancel-btn');
                        const saveBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-save-btn'));
                        const sectionsDiv = popupDom.querySelector('.rt-npc-popup-sections');
                        const aiInstructionsEl = /** @type {HTMLTextAreaElement} */ (popupDom.querySelector('.rt-npc-popup-ai-instructions'));
                        const aiCancelBtn = popupDom.querySelector('.rt-npc-popup-ai-cancel-btn');
                        const aiGenerateBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-ai-generate-btn'));
                        const aiPreviewPane = popupDom.querySelector('.rt-npc-popup-ai-preview');
                        const aiPreviewText = /** @type {HTMLTextAreaElement} */ (popupDom.querySelector('.rt-npc-popup-ai-preview-text'));
                        const aiRegenBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-ai-regen-btn'));
                        const aiApplyBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-ai-apply-btn'));

                        const showPane = (pane) => {
                            viewPane.style.display = 'none';
                            editPane.style.display = 'none';
                            aiEditPane.style.display = 'none';
                            if (pane) pane.style.display = 'flex';
                        };

                        const startEdit = () => {
                            textarea.value = pc.bio || '';
                            showPane(editPane);
                            textarea.focus();
                        };

                        editBtn.addEventListener('click', startEdit);

                        cancelBtn.addEventListener('click', () => showPane(viewPane));

                        saveBtn.addEventListener('click', async () => {
                            pc.bio = textarea.value;
                            if (typeof saveChatState === 'function') saveChatState(runtimeState.currentChatId);
                            const newHtml = renderSectionsHtml(pc.bio, true) || `<div style="font-size:14px;color:var(--SmartThemeBodyColor, inherit);opacity:0.5;font-style:italic;padding:16px 0;">No structured sections found.</div>`;
                            sectionsDiv.innerHTML = newHtml;
                            showPane(viewPane);
                            if (typeof refreshAgentManifestNow === 'function') refreshAgentManifestNow();
                            // @ts-ignore
                            if (typeof toastr !== 'undefined') toastr.success('Player Character saved.', 'Campaign Records');
                        });

                        // ── AI Edit ────────────────────────────────────────────
                        aiEditBtn.addEventListener('click', () => {
                            aiPreviewPane.style.display = 'none';
                            aiInstructionsEl.value = '';
                            showPane(aiEditPane);
                            aiInstructionsEl.focus();
                        });

                        aiCancelBtn.addEventListener('click', () => showPane(viewPane));

                        const runAiEdit = async () => {
                            const instructions = aiInstructionsEl.value.trim();
                            if (!instructions) { toastr['warning']('Please describe what you want changed.', 'Edit with AI'); return; }
                            aiGenerateBtn.disabled = true; aiRegenBtn.disabled = true;
                            aiGenerateBtn.textContent = '⏳ Generating…';
                            const curSettings = getSettings();
                            const aiSettings = {
                                connectionSource: curSettings.routerConnectionSource ?? 'default',
                                connectionProfileId: curSettings.routerConnectionProfileId || '',
                                completionPresetId: curSettings.routerCompletionPresetId || '',
                                ollamaUrl: curSettings.routerOllamaUrl || 'http://localhost:11434',
                                ollamaModel: curSettings.routerOllamaModel || '',
                                openaiUrl: curSettings.routerOpenaiUrl || '',
                                openaiKey: curSettings.routerOpenaiKey || '',
                                openaiModel: curSettings.routerOpenaiModel || '',
                                maxTokens: curSettings.routerMaxTokens || 0,
                                debugMode: curSettings.debugMode,
                            };
                            const sysPrompt = `You are a persona editor for a roleplay system. The user wants to make specific changes to an existing character persona. Output the ENTIRE revised persona with the requested changes applied — keep everything else identical. Do not add preambles or commentary. Output only the revised persona text.`;
                            const userMsg = `CURRENT PERSONA:\n${pc.bio || ''}\n\nREQUESTED CHANGES:\n${instructions}\n\nOutput the full revised persona now.`;
                            try {
                                const result = await sendStateRequest(aiSettings, sysPrompt, userMsg);
                                const trimmed = (result || '').trim();
                                if (trimmed) {
                                    aiPreviewText.value = trimmed;
                                    aiPreviewPane.style.display = 'flex';
                                } else {
                                    toastr['warning']('AI returned an empty result. Please try again.', 'Edit with AI');
                                }
                            } catch (err) {
                                toastr['error'](`AI edit failed: ${String(err.message || err).substring(0, 120)}`, 'Edit with AI');
                            }
                            aiGenerateBtn.disabled = false; aiRegenBtn.disabled = false;
                            aiGenerateBtn.textContent = '✨ Generate';
                        };

                        aiGenerateBtn.addEventListener('click', runAiEdit);
                        aiRegenBtn.addEventListener('click', runAiEdit);

                        aiApplyBtn.addEventListener('click', async () => {
                            pc.bio = aiPreviewText.value;
                            if (typeof saveChatState === 'function') saveChatState(runtimeState.currentChatId);
                            const newHtml = renderSectionsHtml(pc.bio, true) || `<div style="font-size:14px;color:var(--SmartThemeBodyColor, inherit);opacity:0.5;font-style:italic;padding:16px 0;">No structured sections found.</div>`;
                            sectionsDiv.innerHTML = newHtml;
                            showPane(viewPane);
                            if (typeof refreshAgentManifestNow === 'function') refreshAgentManifestNow();
                            // @ts-ignore
                            if (typeof toastr !== 'undefined') toastr.success('Player Character updated via AI.', 'Campaign Records');
                        });

                        if (startInEditMode) startEdit();

                        const popupOpts = { okButton: 'Close', cancelButton: false, wide: true, large: true };
                        await ctx.callGenericPopup(popupDom, ctx.POPUP_TYPE?.TEXT ?? 1, '', popupOpts);
                        // Close while Edit Text is open should persist (Cancel discards; Close keeps).
                        if (editPane.style.display !== 'none' && textarea.value !== (pc.bio || '')) {
                            pc.bio = textarea.value;
                            if (typeof saveChatState === 'function') saveChatState(runtimeState.currentChatId);
                            if (typeof refreshAgentManifestNow === 'function') refreshAgentManifestNow();
                            // @ts-ignore
                            if (typeof toastr !== 'undefined') toastr.success('Player Character saved.', 'Campaign Records');
                        }
                    };
                    globalThis._rpgAgentOpenPcDetail = openPcPopup;

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
                                delete s.chatStates[runtimeState.currentChatId].playerCharacter;
                                if (typeof saveChatState === 'function') saveChatState(runtimeState.currentChatId);
                                if (typeof refreshAgentManifestNow === 'function') await refreshAgentManifestNow();
                            }
                        });
                    }

                    list.appendChild(pcDiv);
                }

                const forceFullRefresh = source === 'manual-button' || source === 'layout-toggle';
                const loadingDiv = document.createElement('div');
                loadingDiv.id = 'rt-agent-manifest-loading';
                loadingDiv.style.cssText = 'text-align: center; opacity: 0.5; font-size: 0.769em; padding: 10px;';
                loadingDiv.innerHTML = 'Loading...';
                list.appendChild(loadingDiv);

                // ── DECOUPLED LOREBOOK RENDER ──
                // Let the browser paint the PC card and "Loading..." immediately.
                const lorebookRenderTask = async () => {
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
                            const layoutS = getSettings();
                            const isNpcBook = displayNameLower === 'npcs' || displayNameLower === 'npc' ||
                                bookNameLowerFull.endsWith('_npcs') || bookNameLowerFull.endsWith('_npc');
                            const useNpcCardView = isNpcBook && layoutS.npcPortraits !== false;

                            const isLocBook = displayNameLower === 'locations' || displayNameLower === 'location' ||
                                bookNameLowerFull.endsWith('_locations') || bookNameLowerFull.endsWith('_location');
                            const useLocImageView = isLocBook && !!layoutS.locationImages;

                            const isWorldBook = displayNameLower === 'world' ||
                                bookNameLowerFull.endsWith('_world');

                            const folder = document.createElement('div');
                            folder.style.cssText = 'flex-shrink: 0; margin-bottom: 2px;';

                            const folderHdr = document.createElement('div');
                            folderHdr.style.cssText = 'display:flex; align-items:center; gap:6px; padding:5px 6px; cursor:pointer; border-radius:4px; background:rgba(255,255,255,0.04);';
                            if (useNpcCardView) folderHdr.classList.add('rt-npc-folder-hdr');
                            if (useLocImageView) folderHdr.classList.add('rt-loc-folder-hdr');
                            folderHdr.innerHTML = `
                            ${useNpcCardView ? '<span class="rt-npc-folder-icon">👤</span>' : ''}
                            ${useLocImageView ? '<span class="rt-loc-folder-icon">🗺️</span>' : ''}
                            ${isWorldBook ? '<span class="rt-world-folder-icon">🌍</span>' : ''}
                            <span class="rt-mf-icon" style="font-size:9px; opacity:0.5; width:10px; flex-shrink:0; font-family:monospace;">${isOpen ? '▼' : '▶'}</span>
                            <span style="font-weight:bold; font-size:11px; flex:1; color:var(--rt-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(displayName)}</span>
                            <span style="font-size:9px; opacity:0.45; color:var(--rt-text-muted); flex-shrink:0;">${activeCount}/${items.length} (${totalTokens}t)</span>
                            ${isNpcBook ? '<button class="rt-npc-settings-btn" title="NPC Settings" style="background:none;border:none;cursor:pointer;font-size:11px;opacity:0.5;padding:0;margin:0;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;color:var(--rt-text-muted);flex-shrink:0;line-height:1;" onclick="event.stopPropagation()">⚙️</button>' : ''}
                            ${isLocBook ? '<button class="rt-loc-settings-btn" title="Location Settings" style="background:none;border:none;cursor:pointer;font-size:11px;opacity:0.5;padding:0;margin:0;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;color:var(--rt-text-muted);flex-shrink:0;line-height:1;" onclick="event.stopPropagation()">⚙️</button>' : ''}
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
                                        <label style="font-size:12px;color:rgba(255,255,255,0.7);flex:1;">Show Relationship Float Feedback</label>
                                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" id="rt-npc-rel-toast" ${curS.npcRelationshipToast !== false ? 'checked' : ''}
                                                style="width:16px;height:16px;accent-color:#d4a940;cursor:pointer;">
                                            <span style="font-size:11px;color:rgba(255,255,255,0.5);">${curS.npcRelationshipToast !== false ? 'Enabled' : 'Disabled'}</span>
                                        </label>
                                    </div>
                                    <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:14px;">Shows a floating Friendship/Affection graphic that rises and fades when those values change.</div>

                                    <div style="margin-bottom:14px;">
                                        <label style="font-size:12px;color:rgba(255,255,255,0.7);display:block;margin-bottom:4px;">"Add as is" Import Mode</label>
                                        <div style="display:flex;flex-direction:column;gap:5px;">
                                            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;" title="Wraps the card's raw content in [CORE][/CORE] tags exactly as written. No AI involvement.">
                                                <input type="radio" name="rt-npc-add-as-is-mode" value="literal" ${(curS.npcAddAsIsMode ?? 'ai_review') === 'literal' ? 'checked' : ''}
                                                    style="margin-top:3px;accent-color:#d4a940;cursor:pointer;">
                                                <span style="font-size:11px;color:rgba(255,255,255,0.75);"><b>Literal</b> — wraps the card verbatim in [CORE][/CORE]. No AI.</span>
                                            </label>
                                            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;" title="Sends the card to AI for a minimal logical review. Only corrects world/era conflicts. Original writing is preserved as completely as possible.">
                                                <input type="radio" name="rt-npc-add-as-is-mode" value="ai_review" ${(curS.npcAddAsIsMode ?? 'ai_review') === 'ai_review' ? 'checked' : ''}
                                                    style="margin-top:3px;accent-color:#d4a940;cursor:pointer;">
                                                <span style="font-size:11px;color:rgba(255,255,255,0.75);"><b>AI Review</b> — minimal fix pass for era/world conflicts only. Original writing preserved.</span>
                                            </label>
                                        </div>
                                        <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:4px;">Controls what happens when you click "+ Add as is" on a character card.</div>
                                    </div>

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
                                    
                                    <button id="rt-btn-edit-npc-sections-inline" style="width:100%;background:rgba(180, 100, 255, 0.15);border:1px solid rgba(180, 100, 255, 0.4);color:white;border-radius:6px;padding:8px 10px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;transition:background 0.2s;">
                                        <i class="fa-solid fa-puzzle-piece"></i> Edit NPC Sections
                                    </button>
                                </div>`;

                                        let newRel = curS.npcRelationshipBars ?? false;
                                        let newIgnoreLimits = curS.ignoreNpcImportLimits ?? false;
                                        let newRelToast = curS.npcRelationshipToast !== false;
                                        let newNpcPortraits = curS.npcPortraits !== false;
                                        let newAddAsIsMode = curS.npcAddAsIsMode ?? 'ai_review';
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
                                            // Wire up the add-as-is mode radio buttons
                                            document.querySelectorAll('input[name="rt-npc-add-as-is-mode"]').forEach(radio => {
                                                radio.addEventListener('change', () => {
                                                    if (radio.checked) newAddAsIsMode = radio.value;
                                                });
                                            });
                                            const editNpcBtn = document.getElementById('rt-btn-edit-npc-sections-inline');
                                            if (editNpcBtn) {
                                                editNpcBtn.addEventListener('click', () => {
                                                    openNpcSectionEditor();
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
                                            updS.npcAddAsIsMode = newAddAsIsMode;
                                            setNpcRelationshipMaxForCurrentChat(finalRelMax);
                                            updS.npcRelationshipBars = newRel;
                                            updS.npcRelationshipToast = newRelToast;
                                            applyNpcPortraitSetting(updS, newNpcPortraits);
                                            $('#rpg_tracker_npc_portraits').prop('checked', newNpcPortraits);
                                            $('#rpg_tracker_npc_rel_toast').prop('checked', newRelToast);

                                            // Update the main settings panel inputs if present
                                            $('#rpg_tracker_npc_major_words').val(finalMajor);
                                            $('#rpg_tracker_npc_minor_words').val(finalMinor);
                                            $('#rpg_tracker_npc_rel_bars').prop('checked', newRel);
                                            $('#rpg_sysprompt_mod_npc_rel_bars').prop('checked', newRel);
                                            const onbRel = document.getElementById('rt_onboarding_mod_npc_rel_bars');
                                            if (onbRel) onbRel.checked = newRel;
                                            $('#rpg_tracker_ignore_npc_limits').prop('checked', newIgnoreLimits);
                                            // Sync Add as Is mode to main settings panel radios
                                            $(`input[name="rpg_npc_add_as_is_mode_main"][value="${newAddAsIsMode}"]`).prop('checked', true);

                                            // Rebuild the NPC instruction from settings
                                            if (updS.routerModules?.npc) {
                                                updS.routerModules.npc.instruction = buildNpcInstruction(finalMajor, finalMinor, false); // ignoreLimits only applies at import-time, not stored globally
                                            }

                                            saveSettings();
                                            toastr['success']('NPC settings saved.', 'NPC Settings');
                                            if (typeof globalThis._rpgRenderAgentModules === 'function') {
                                                globalThis._rpgRenderAgentModules();
                                            }
                                            await refreshLorebookAgentViewsNow({ forceLayoutRefresh: true });
                                        }
                                    });
                                }
                            }

                            // Location settings gear button handler
                            if (isLocBook) {
                                const locSettingsBtn = folderHdr.querySelector('.rt-loc-settings-btn');
                                if (locSettingsBtn) {
                                    locSettingsBtn.addEventListener('click', async (e) => {
                                        e.stopPropagation();
                                        const ctx = SillyTavern.getContext();
                                        if (!ctx.callGenericPopup) return;
                                        const curS = getSettings();
                                        const popupHtml = `<div style="padding:16px;width:320px;text-align:left;font-family:var(--rt-font, system-ui, sans-serif);">
                                    <div style="font-size:16px;font-weight:bold;color:#5eb8d4;margin-bottom:16px;">⚙️ Location Settings</div>
                                    <div style="margin-bottom:6px;display:flex;align-items:center;gap:10px;">
                                        <label style="font-size:12px;color:rgba(255,255,255,0.7);flex:1;">Show Location Images</label>
                                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                                            <input type="checkbox" id="rt-loc-images" ${!!curS.locationImages ? 'checked' : ''}
                                                style="width:16px;height:16px;accent-color:#5eb8d4;cursor:pointer;">
                                            <span style="font-size:11px;color:rgba(255,255,255,0.5);">${!!curS.locationImages ? 'Enabled' : 'Disabled'}</span>
                                        </label>
                                    </div>
                                    <div style="font-size:10px;color:rgba(255,255,255,0.35);">When disabled, locations use the plain tree list without thumbnails or scene detail popups. Location auto-generation is turned off.</div>
                                </div>`;

                                        let newLocImages = !!curS.locationImages;
                                        setTimeout(() => {
                                            const locEl = document.getElementById('rt-loc-images');
                                            if (locEl) {
                                                locEl.addEventListener('change', () => {
                                                    newLocImages = locEl.checked;
                                                    if (locEl.nextElementSibling) locEl.nextElementSibling.textContent = newLocImages ? 'Enabled' : 'Disabled';
                                                });
                                            }
                                        }, 0);

                                        const result = await ctx.callGenericPopup(popupHtml, ctx.POPUP_TYPE?.CONFIRM ?? 3, '', {
                                            okButton: 'Save', cancelButton: 'Cancel', wide: false,
                                        });

                                        if (result) {
                                            const updS = getSettings();
                                            applyLocationImageSetting(updS, newLocImages);
                                            saveSettings();
                                            toastr['success']('Location settings saved.', 'Location Settings');
                                            await refreshLorebookAgentViewsNow({ forceLayoutRefresh: true });
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
                                        affection: rel?.affection ?? 0,
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
                                        <input type="number" id="rt-npc-detail-${type}-input" min="-${relMax}" max="${relMax}" step="1" value="${clamped}"
                                            aria-label="${label} value" style="width:52px;box-sizing:border-box;font-size:14px;font-weight:bold;text-align:right;color:${valColor};font-family:monospace;background:rgba(0,0,0,.18);border:1px solid var(--SmartThemeBorderColor, rgba(128,128,128,.35));border-radius:4px;padding:2px 4px;">
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

                                    const portraitSrc = lookupCustomPortraitSrc(s, item.label);
                                    const hidePortrait = s.npcPortraits === false;

                                    // Full-size portrait at native stored resolution, with the same
                                    // click-to-generate/manage overlay used on the small NPC card thumbnails.
                                    const renderNpcPopupPortraitInner = (src) => {
                                        const imgOrPlaceholder = src
                                            ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.label)}">`
                                            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:64px;opacity:0.25;color:var(--SmartThemeBodyColor, inherit);">👤</div>`;
                                        return `${imgOrPlaceholder}<div class="rt-npc-portrait-gen-overlay" title="${src ? 'Manage portrait' : 'Generate portrait'}" style="font-size:32px;">${src ? '⚙️' : '🎨'}</div>`;
                                    };
                                    const portraitEl = `<div class="rt-npc-portrait-wrap rt-npc-popup-portrait-wrap" style="width:100%;height:auto;aspect-ratio:1;border-radius:12px;border:2px solid rgba(212,169,64,0.3);box-shadow:0 4px 20px rgba(0,0,0,0.4);">${renderNpcPopupPortraitInner(portraitSrc)}</div>`;

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
                                            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                + ', ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
                                            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
                                                <button class="rt-npc-popup-edit-btn menu_button" style="flex-shrink:0;font-size:12px;padding:4px 12px;white-space:nowrap;">✏️ Edit Text</button>
                                                <button class="rt-npc-popup-ai-edit-btn menu_button" style="flex-shrink:0;font-size:12px;padding:4px 12px;white-space:nowrap;background:rgba(212,169,64,0.1);border-color:rgba(212,169,64,0.5);color:#d4a940;">✨ Edit with AI</button>
                                            </div>
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
                                    <!-- AI EDIT PANE -->
                                    <div class="rt-npc-popup-ai-edit" style="display:none;flex-direction:column;gap:10px;">
                                        <div style="font-size:11px;font-weight:bold;color:rgba(212,169,64,0.9);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;">✨ AI Edit Request</div>
                                        <textarea class="rt-npc-popup-ai-instructions" spellcheck="true" placeholder="Describe what you want changed or iterated on… e.g. 'Make her backstory more tragic' or 'Add a rivalry with the player character'" style="width:100%;min-height:90px;box-sizing:border-box;background:var(--SmartThemeBlurTintColor, rgba(0,0,0,0.3));color:var(--SmartThemeBodyColor, inherit);border:1px solid rgba(212,169,64,0.5);border-radius:8px;padding:12px;font-family:inherit;font-size:13px;line-height:1.6;resize:vertical;"></textarea>
                                        <div style="display:flex;gap:8px;justify-content:flex-end;">
                                            <button class="rt-npc-popup-ai-cancel-btn menu_button" style="font-size:12px;padding:5px 14px;">Cancel</button>
                                            <button class="rt-npc-popup-ai-generate-btn menu_button" style="font-size:12px;padding:5px 18px;background:rgba(212,169,64,0.15);border-color:rgba(212,169,64,0.5);color:#d4a940;font-weight:bold;">✨ Generate</button>
                                        </div>
                                        <div class="rt-npc-popup-ai-preview" style="display:none;flex-direction:column;gap:8px;">
                                            <div style="font-size:11px;font-weight:bold;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;">Preview — Review before applying</div>
                                            <textarea class="rt-npc-popup-ai-preview-text" spellcheck="false" style="width:100%;min-height:320px;box-sizing:border-box;background:rgba(0,0,0,0.35);color:var(--SmartThemeBodyColor, inherit);border:1px solid rgba(212,169,64,0.3);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;line-height:1.6;resize:vertical;"></textarea>
                                            <div style="display:flex;gap:8px;justify-content:flex-end;">
                                                <button class="rt-npc-popup-ai-regen-btn menu_button" style="font-size:12px;padding:5px 14px;">🔄 Regenerate</button>
                                                <button class="rt-npc-popup-ai-apply-btn menu_button" style="font-size:12px;padding:5px 18px;background:rgba(0,200,140,0.15);border-color:rgba(0,200,140,0.5);color:#00c88c;font-weight:bold;">✅ Apply</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ${relLogHtml}
                            `;



                                    // Wire up in-popup edit/save/cancel
                                    const viewPane = popupDom.querySelector('.rt-npc-popup-view');
                                    const editPane = popupDom.querySelector('.rt-npc-popup-edit');
                                    const aiEditPane = popupDom.querySelector('.rt-npc-popup-ai-edit');
                                    const sectionsDiv = popupDom.querySelector('.rt-npc-popup-sections');
                                    const textarea = /** @type {HTMLTextAreaElement} */ (popupDom.querySelector('.rt-npc-popup-textarea'));
                                    const editBtn = popupDom.querySelector('.rt-npc-popup-edit-btn');
                                    const aiEditBtn = popupDom.querySelector('.rt-npc-popup-ai-edit-btn');
                                    const cancelBtn = popupDom.querySelector('.rt-npc-popup-cancel-btn');
                                    const saveBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-save-btn'));
                                    const aiInstructionsEl = /** @type {HTMLTextAreaElement} */ (popupDom.querySelector('.rt-npc-popup-ai-instructions'));
                                    const aiCancelBtn = popupDom.querySelector('.rt-npc-popup-ai-cancel-btn');
                                    const aiGenerateBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-ai-generate-btn'));
                                    const aiPreviewPane = popupDom.querySelector('.rt-npc-popup-ai-preview');
                                    const aiPreviewText = /** @type {HTMLTextAreaElement} */ (popupDom.querySelector('.rt-npc-popup-ai-preview-text'));
                                    const aiRegenBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-ai-regen-btn'));
                                    const aiApplyBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-npc-popup-ai-apply-btn'));

                                    // Portrait click/generate overlay — same behavior as the small NPC card thumbnail.
                                    const popupPortraitWrap = popupDom.querySelector('.rt-npc-popup-portrait-wrap');
                                    if (popupPortraitWrap) {
                                        popupPortraitWrap.addEventListener('click', async (e) => {
                                            e.stopPropagation();
                                            const refreshPopupPortrait = () => {
                                                const newSrc = lookupCustomPortraitSrc(getSettings(), item.label);
                                                popupPortraitWrap.innerHTML = renderNpcPopupPortraitInner(newSrc);
                                                if (typeof refreshManifest === 'function') refreshManifest();
                                                if (typeof refreshRenderedView === 'function') refreshRenderedView();
                                            };
                                            await showPortraitSettingsMenu(item.label, refreshPopupPortrait, item.content || '');
                                        });
                                    }

                                    const npcShowPane = (pane) => {
                                        viewPane.style.display = 'none';
                                        editPane.style.display = 'none';
                                        aiEditPane.style.display = 'none';
                                        if (pane) pane.style.display = 'flex';
                                    };

                                    editBtn.addEventListener('click', () => {
                                        textarea.value = item.content || '';
                                        npcShowPane(editPane);
                                        textarea.focus();
                                    });

                                    cancelBtn.addEventListener('click', () => npcShowPane(viewPane));

                                    // ── AI Edit ─────────────────────────────────────────
                                    aiEditBtn.addEventListener('click', () => {
                                        aiPreviewPane.style.display = 'none';
                                        aiInstructionsEl.value = '';
                                        npcShowPane(aiEditPane);
                                        aiInstructionsEl.focus();
                                    });

                                    aiCancelBtn.addEventListener('click', () => npcShowPane(viewPane));

                                    const runNpcAiEdit = async () => {
                                        const instructions = aiInstructionsEl.value.trim();
                                        if (!instructions) { toastr['warning']('Please describe what you want changed.', 'Edit with AI'); return; }
                                        aiGenerateBtn.disabled = true; aiRegenBtn.disabled = true;
                                        aiGenerateBtn.textContent = '⏳ Generating…';
                                        const curSettings = getSettings();
                                        const aiSettings = {
                                            connectionSource: curSettings.routerConnectionSource ?? 'default',
                                            connectionProfileId: curSettings.routerConnectionProfileId || '',
                                            completionPresetId: curSettings.routerCompletionPresetId || '',
                                            ollamaUrl: curSettings.routerOllamaUrl || 'http://localhost:11434',
                                            ollamaModel: curSettings.routerOllamaModel || '',
                                            openaiUrl: curSettings.routerOpenaiUrl || '',
                                            openaiKey: curSettings.routerOpenaiKey || '',
                                            openaiModel: curSettings.routerOpenaiModel || '',
                                            maxTokens: curSettings.routerMaxTokens || 0,
                                            debugMode: curSettings.debugMode,
                                        };
                                        const sysPrompt = `You are a character editor for a roleplay lorebook system. The user wants to make specific changes to an existing NPC entry. Output the ENTIRE revised entry with the requested changes applied — keep the same format and everything else identical. Do not add preambles or commentary. Output only the revised entry text.`;
                                        const userMsg = `CURRENT NPC ENTRY:\n${item.content || ''}\n\nREQUESTED CHANGES:\n${instructions}\n\nOutput the full revised entry now.`;
                                        try {
                                            const result = await sendStateRequest(aiSettings, sysPrompt, userMsg);
                                            const trimmed = (result || '').trim();
                                            if (trimmed) {
                                                aiPreviewText.value = trimmed;
                                                aiPreviewPane.style.display = 'flex';
                                            } else {
                                                toastr['warning']('AI returned an empty result. Please try again.', 'Edit with AI');
                                            }
                                        } catch (err) {
                                            toastr['error'](`AI edit failed: ${String(err.message || err).substring(0, 120)}`, 'Edit with AI');
                                        }
                                        aiGenerateBtn.disabled = false; aiRegenBtn.disabled = false;
                                        aiGenerateBtn.textContent = '✨ Generate';
                                    };

                                    aiGenerateBtn.addEventListener('click', runNpcAiEdit);
                                    aiRegenBtn.addEventListener('click', runNpcAiEdit);

                                    aiApplyBtn.addEventListener('click', async () => {
                                        if (isRouterRunning()) {
                                            // @ts-ignore
                                            toastr.warning('Agent is running — wait for it to finish before saving.', 'Lorebook Agent');
                                            return;
                                        }
                                        aiApplyBtn.disabled = true;
                                        aiApplyBtn.textContent = '…';
                                        const ok = await updateLorebookEntry(item.id, {
                                            content: aiPreviewText.value,
                                            key: item.keys,
                                            comment: item.label,
                                        });
                                        if (ok) {
                                            item.content = aiPreviewText.value;
                                            _dirtyEntries.delete(item.id);
                                            document.dispatchEvent(new CustomEvent('rt_lore_agent_updated'));
                                            await refreshManifest();
                                            const newHtml = renderSectionsHtml(item.content);
                                            sectionsDiv.innerHTML = newHtml || `<div style="font-size:14px;color:var(--SmartThemeBodyColor, inherit);opacity:0.5;font-style:italic;padding:16px 0;">No structured sections found.</div>`;
                                            npcShowPane(viewPane);
                                            // @ts-ignore
                                            toastr.success('NPC entry updated via AI.', 'Lorebook Agent');
                                        } else {
                                            // @ts-ignore
                                            toastr.error('Save failed.', 'Lorebook Agent');
                                        }
                                        aiApplyBtn.disabled = false;
                                        aiApplyBtn.textContent = '✅ Apply';
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
                                        const input = popupDom.querySelector(`#rt-npc-detail-${type}-input`);
                                        const tierEl = popupDom.querySelector(`#rt-npc-detail-${type}-tier`);
                                        if (!slider || !fill || !input) return;

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

                                            input.value = String(val);
                                            input.style.color = val === 0 ? 'var(--SmartThemeEmColor, inherit)' : bgColor;

                                            if (tierEl) tierEl.innerHTML = renderRelTierDetailed(type, val, relMax);
                                        });

                                        slider.addEventListener('change', () => {
                                            const val = clampRelationshipValue(parseInt(slider.value, 10) || 0, getNpcRelationshipMax(s));
                                            slider.value = String(val);
                                            input.value = String(val);
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

                                        input.addEventListener('input', () => {
                                            const typed = Number(input.value);
                                            if (!Number.isFinite(typed)) return;
                                            const val = clampRelationshipValue(Math.trunc(typed), getNpcRelationshipMax(s));
                                            slider.value = String(val);
                                            slider.dispatchEvent(new Event('input'));
                                        });

                                        input.addEventListener('change', () => {
                                            const typed = Number(input.value);
                                            const val = Number.isFinite(typed)
                                                ? clampRelationshipValue(Math.trunc(typed), getNpcRelationshipMax(s))
                                                : originalValue;
                                            input.value = String(val);
                                            slider.value = String(val);
                                            slider.dispatchEvent(new Event('input'));
                                            slider.dispatchEvent(new Event('change'));
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
                                    // Close while Edit Text is open should persist (Cancel discards; Close keeps).
                                    if (editPane.style.display !== 'none' && textarea.value !== (item.content || '')) {
                                        if (!isRouterRunning()) {
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
                                            }
                                        }
                                    }
                                };
                                globalThis._rpgAgentOpenNpcDetail = openNpcDetailPopup;
                                globalThis._rpgAgentParseRelationship = parseRelationship;

                            }

                            // ════════════════════════════════════════════════════════════
                            //  LOCATION HELPERS (tree view + detail popup)
                            // ════════════════════════════════════════════════════════════
                            /** @type {((node: any) => string)|null} */
                            let getLocationPathFromNode = null;
                            /** @type {((content: string) => string)|null} */
                            let getLocationDescription = null;
                            /** @type {((item: any, fullPath: string) => Promise<void>)|null} */
                            let openLocationDetailPopup = null;

                            if (isLocBook) {
                                getLocationPathFromNode = (node) => {
                                    const parts = [];
                                    let curr = node;
                                    while (curr && curr.name) {
                                        parts.unshift(curr.name);
                                        curr = curr.parent;
                                    }
                                    return buildLocationPath(parts);
                                };

                                getLocationDescription = (content) => {
                                    if (!content) return '';
                                    const cleanContent = content.replace(/\[\/?CORE\]/gi, '');
                                    const coreMatch = cleanContent.match(/(?:^|\n)\s*(?:\[CORE\])?\s*([\s\S]*?)(?=\n\s*(?:Atmosphere|Notable Features|History|Connections|Dangers|Resources):|$)/i);
                                    if (coreMatch?.[1]?.trim()) {
                                        return coreMatch[1].trim().substring(0, 260);
                                    }
                                    const lines = cleanContent.split('\n').map(l => l.trim())
                                        .filter(l => l && !/^\[ID:/i.test(l));
                                    return lines.slice(0, 2).join(' ').substring(0, 260);
                                };

                                openLocationDetailPopup = async (item, fullPath) => {
                                    const ctx = SillyTavern.getContext();
                                    if (!ctx.callGenericPopup) return;

                                    const normPath = normalizeLocationPath(fullPath || item.label);
                                    const imageMeta = resolveLocationImageWithMeta(normPath);
                                    const portraitSrc = imageMeta.src;
                                    const hideImage = !s.locationImages;

                                    const renderLocPopupHeroInner = (src) => {
                                        const imgOrPlaceholder = src
                                            ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(normPath)}">`
                                            : `<div class="rt-loc-hero-placeholder">🗺️</div>`;
                                        return `${imgOrPlaceholder}<div class="rt-loc-image-gen-overlay" title="${src ? 'Manage image' : 'Generate image'}" style="font-size:28px;">${src ? '⚙️' : '🎨'}</div>`;
                                    };

                                    const breadcrumb = normPath.split(' :: ').map(seg => escapeHtml(seg)).join(' <span style="opacity:0.45;">›</span> ');
                                    const desc = getLocationDescription ? getLocationDescription(item.content) : '';
                                    const sectionsInitialHtml = renderSectionsHtml(item.content)
                                        || `<div style="font-size:13px;color:var(--SmartThemeBodyColor, inherit);opacity:0.55;font-style:italic;">${escapeHtml(desc) || 'No structured sections found.'}</div>`;

                                    const activeStyle = item.is_active
                                        ? 'background:rgba(0,255,170,0.12);color:#00ffaa;border:1px solid rgba(0,255,170,0.25);'
                                        : 'background:var(--SmartThemeBorderColor, rgba(128,128,128,0.1));color:var(--SmartThemeBodyColor, inherit);opacity:0.65;border:1px solid var(--SmartThemeBorderColor, rgba(128,128,128,0.2));';
                                    const activeLabel = item.is_active ? '● Active' : '○ Inactive';

                                    const popupDom = document.createElement('div');
                                    popupDom.className = 'rt-loc-popup-root';
                                    popupDom.innerHTML = `
                                ${hideImage ? '' : `<div class="rt-loc-popup-hero-wrap">${renderLocPopupHeroInner(portraitSrc)}</div>`}
                                <div class="rt-loc-popup-header">
                                    <div class="rt-loc-popup-breadcrumb">${breadcrumb}</div>
                                    <div class="rt-loc-popup-title-row">
                                        <div class="rt-loc-popup-title">${escapeHtml(normPath.split(' :: ').pop() || normPath)}</div>
                                        <div class="rt-loc-popup-actions">
                                            <button class="rt-loc-popup-edit-btn menu_button" style="font-size:12px;padding:4px 12px;">✏️ Edit Text</button>
                                        </div>
                                    </div>
                                    <span class="rt-loc-popup-status" style="${activeStyle}">${activeLabel}</span>
                                </div>
                                <div class="rt-loc-popup-body">
                                    <div class="rt-loc-popup-view">
                                        <div class="rt-loc-popup-sections">${sectionsInitialHtml}</div>
                                    </div>
                                    <div class="rt-loc-popup-edit" style="display:none;flex-direction:column;gap:10px;">
                                        <textarea class="rt-loc-popup-textarea" spellcheck="false" style="width:100%;min-height:360px;box-sizing:border-box;background:var(--SmartThemeBlurTintColor, rgba(0,0,0,0.3));color:var(--SmartThemeBodyColor, inherit);border:1px solid rgba(94,184,212,0.35);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;line-height:1.6;resize:vertical;"></textarea>
                                        <div style="display:flex;gap:8px;justify-content:flex-end;">
                                            <button class="rt-loc-popup-cancel-btn menu_button" style="font-size:12px;padding:5px 14px;">Cancel</button>
                                            <button class="rt-loc-popup-save-btn menu_button" style="font-size:12px;padding:5px 18px;background:rgba(94,184,212,0.2);border-color:rgba(94,184,212,0.5);color:#5eb8d4;font-weight:bold;">💾 Save</button>
                                        </div>
                                    </div>
                                </div>`;

                                    const heroWrap = popupDom.querySelector('.rt-loc-popup-hero-wrap');
                                    const viewPane = popupDom.querySelector('.rt-loc-popup-view');
                                    const editPane = popupDom.querySelector('.rt-loc-popup-edit');
                                    const textarea = /** @type {HTMLTextAreaElement} */ (popupDom.querySelector('.rt-loc-popup-textarea'));
                                    const editBtn = popupDom.querySelector('.rt-loc-popup-edit-btn');
                                    const cancelBtn = popupDom.querySelector('.rt-loc-popup-cancel-btn');
                                    const saveBtn = /** @type {HTMLButtonElement} */ (popupDom.querySelector('.rt-loc-popup-save-btn'));

                                    if (heroWrap) {
                                        heroWrap.addEventListener('click', async (e) => {
                                            e.stopPropagation();
                                            const refreshPopupHero = () => {
                                                const meta = resolveLocationImageWithMeta(normPath);
                                                heroWrap.innerHTML = renderLocPopupHeroInner(meta.src);
                                                if (typeof refreshManifest === 'function') refreshManifest();
                                            };
                                            await showLocationImageSettingsMenu(normPath, refreshPopupHero, item.content || '');
                                        });
                                    }

                                    if (editBtn && viewPane && editPane && textarea) {
                                        editBtn.addEventListener('click', () => {
                                            textarea.value = item.content || '';
                                            viewPane.style.display = 'none';
                                            editPane.style.display = 'flex';
                                        });
                                        cancelBtn?.addEventListener('click', () => {
                                            editPane.style.display = 'none';
                                            viewPane.style.display = 'block';
                                        });
                                        saveBtn?.addEventListener('click', async () => {
                                            if (isRouterRunning()) {
                                                toastr.warning('Agent is running — wait for it to finish before saving.', 'Lorebook Agent');
                                                return;
                                            }
                                            saveBtn.disabled = true;
                                            const ok = await updateLorebookEntry(item.id, {
                                                content: textarea.value,
                                                key: item.keys,
                                                comment: item.label,
                                            });
                                            if (ok) {
                                                item.content = textarea.value;
                                                editPane.style.display = 'none';
                                                viewPane.style.display = 'block';
                                                const sectionsDiv = popupDom.querySelector('.rt-loc-popup-sections');
                                                if (sectionsDiv) {
                                                    sectionsDiv.innerHTML = renderSectionsHtml(item.content)
                                                        || `<div style="font-size:13px;opacity:0.55;font-style:italic;">${escapeHtml(getLocationDescription(item.content))}</div>`;
                                                }
                                                toastr.success('Location entry saved.', 'Lorebook Agent');
                                                await refreshManifest();
                                            } else {
                                                toastr.error('Save failed.', 'Lorebook Agent');
                                            }
                                            saveBtn.disabled = false;
                                        });
                                    }

                                    await ctx.callGenericPopup(popupDom, ctx.POPUP_TYPE?.TEXT ?? 1, '', {
                                        okButton: 'Close', cancelButton: false, wide: true, large: true,
                                    });
                                };
                                globalThis._rpgAgentOpenLocationDetail = openLocationDetailPopup;
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
                                    const portraitSrc = lookupCustomPortraitSrc(s, item.label);
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
                                                await applyPortraitData(item.label, scaled);
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
                                    let viewLocHtml = '';
                                    let locThumbHtml = '';
                                    let relStatsHtml = '';
                                    let editHtml = '';
                                    let deleteHtml = '';
                                    let locFullPath = '';

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
                                        if (useLocImageView && getLocationPathFromNode) {
                                            locFullPath = getLocationPathFromNode(node);
                                            const imageMeta = resolveLocationImageWithMeta(locFullPath);
                                            const thumbInner = imageMeta.src
                                                ? `<img src="${escapeHtml(imageMeta.src)}" alt="">`
                                                : `<span class="rt-loc-thumb-placeholder">🗺️</span>`;
                                            locThumbHtml = `<div class="rt-loc-thumb-wrap" title="${imageMeta.src ? 'Manage location image' : 'Set location image'}">${thumbInner}</div>`;
                                            viewLocHtml = `<button class="rt-agent-entry-view-loc" data-id="${node.item.id}" style="background:rgba(94,184,212,0.12); border:1px solid rgba(94,184,212,0.35); border-radius:3px; color:#5eb8d4; cursor:pointer; font-size:10px; padding:1px 5px; flex-shrink:0; line-height:1.2;" title="View location detail"><i class="fa-solid fa-map"></i></button>`;
                                        }
                                        cleanHtml = !isWorldBook ? `<button class="rt-agent-entry-clean" data-id="${node.item.id}" style="background:none; border:none; color:#e67e22; cursor:pointer; font-size:9px; padding:1px 3px; flex-shrink:0;" title="Run targeted cleanup for this entry"><i class="fa-solid fa-broom"></i></button>` : '';
                                        editHtml = `<button class="rt-agent-entry-edit" data-id="${node.item.id}" style="background:none; border:none; color:var(--rt-accent); cursor:pointer; font-size:9px; padding:1px 3px; flex-shrink:0;" title="Edit this lore entry"><i class="fa-solid fa-pen-to-square"></i></button>`;
                                        deleteHtml = `<button class="rt-agent-entry-delete" data-id="${node.item.id}" style="background:none; border:none; color:var(--rt-text-muted); cursor:pointer; font-size:9px; padding:1px 3px; flex-shrink:0;" title="Delete entry"><i class="fa-solid fa-trash"></i></button>`;
                                    }

                                    entryHdr.innerHTML = `
                            ${chevronHtml}
                            ${locThumbHtml}
                            ${viewNpcHtml}
                            ${viewLocHtml}
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

                                    const viewLocBtn = entryHdr.querySelector('.rt-agent-entry-view-loc');
                                    if (viewLocBtn && node.item && openLocationDetailPopup && locFullPath) {
                                        viewLocBtn.addEventListener('click', (e) => {
                                            e.stopPropagation();
                                            openLocationDetailPopup(node.item, locFullPath);
                                        });
                                    }

                                    const locThumbWrap = entryHdr.querySelector('.rt-loc-thumb-wrap');
                                    if (locThumbWrap && node.item && locFullPath) {
                                        locThumbWrap.addEventListener('click', async (e) => {
                                            e.stopPropagation();
                                            await showLocationImageSettingsMenu(locFullPath, () => refreshManifest(), node.item.content || '');
                                        });
                                        locThumbWrap.addEventListener('dragover', (ev) => { ev.preventDefault(); locThumbWrap.classList.add('rt-loc-thumb-drag'); });
                                        locThumbWrap.addEventListener('dragleave', () => { locThumbWrap.classList.remove('rt-loc-thumb-drag'); });
                                        locThumbWrap.addEventListener('drop', async (ev) => {
                                            ev.preventDefault();
                                            ev.stopPropagation();
                                            locThumbWrap.classList.remove('rt-loc-thumb-drag');
                                            const file = ev.dataTransfer?.files?.[0];
                                            if (!file || !file.type.startsWith('image/')) return;
                                            try {
                                                const dataUrl = await fileToDataUrl(file);
                                                const scaled = await scaleImageToLandscape(dataUrl);
                                                await applyLocationImageData(locFullPath, scaled);
                                                toastr.success(`Location image applied for ${locFullPath}`, 'Location Image');
                                                await refreshManifest();
                                            } catch (err) {
                                                toastr.error('Failed to apply location image.', 'Location Image');
                                            }
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
                                            if (/** @type {HTMLElement} */ (e.target).closest('.rt-agent-subfolder-toggle, .rt-agent-entry-delete, .rt-agent-entry-clean, .rt-agent-entry-edit, .rt-agent-entry-view-npc, .rt-agent-entry-view-loc, .rt-loc-thumb-wrap')) return;
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
                    } catch (e) {
                        if (gen !== _manifestRenderGen) return;
                        console.error('[RPG Tracker] getLorebookManifest decoupled failed:', e);
                        const existingLoading = list.querySelector('#rt-agent-manifest-loading');
                        if (existingLoading) existingLoading.innerHTML = '<span style="color:#ff5555;">Error loading manifest.</span>';
                    }
                };
                if (_manifestBypassImmersion) {
                    await lorebookRenderTask();
                } else {
                    setTimeout(() => { void lorebookRenderTask(); }, 10);
                }
            } catch (e) {
                if (gen !== _manifestRenderGen) return;
                console.error('[RPG Tracker] refreshManifest failed:', e);
                list.innerHTML = '<div style="text-align: center; color: #ff5555; font-size: 0.769em; padding: 10px;">Error rendering Player Character.</div>';
            }
        };

        runtimeState.refreshAgentManifest = refreshManifest;
        runtimeState.refreshNpcManifest = refreshManifest;

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
                // Literal add: take the card's description field verbatim — the card
                // already has its content figured out. Wrap it in [CORE][/CORE] as-is.
                const parts = ['[CORE]'];
                if (charCard.description) parts.push(charCard.description.substring(0, 3000));
                // Append personality only if it exists as a separate field AND doesn't
                // look like it's already included in the description.
                if (charCard.personality && !charCard.description?.includes(charCard.personality.substring(0, 40))) {
                    parts.push(charCard.personality.substring(0, 1000));
                }
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
            try { bookData = await ctx.loadWorldInfo(bookName); } catch (_) { }
            if (!bookData) {
                try {
                    const res = await fetch('/api/worldinfo/get', {
                        method: 'POST', headers: getRequestHeaders(),
                        body: JSON.stringify({ name: bookName })
                    });
                    if (res.ok) { const d = await res.json(); if (d?.entries) bookData = d; }
                } catch (_) { }
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
                try { await ctx.saveWorldInfo(bookName, bookData); } catch (_) { }
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
                    await applyPortraitData(name, avatarUrl);
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
        /**
         * Applies a minimal AI review to a character card — fixes only logical world/era
         * impossibilities. Preserves original writing as completely as possible.
         * Returns an [[NPC: ...]] string on success, or null on failure.
         * @param {object} charCard
         */
        const minimalReviewNpcWithAI = async (charCard) => {
            const s = getSettings();
            const ctx = SillyTavern.getContext();
            const name = charCard.name || 'Unnamed';

            const contextParts = [];
            contextParts.push(`CHARACTER CARD:\nName: ${name}\nDescription: ${(charCard.description || '').substring(0, 3000)}\nPersonality: ${(charCard.personality || '').substring(0, 1000)}`);
            if (s.currentMemo) contextParts.push(`CURRENT GAME STATE:\n${memoForGmContext(s.currentMemo).substring(0, 2000)}`);
            if (ctx.chat && Array.isArray(ctx.chat)) {
                const msgs = ctx.chat.filter(m => !m.is_system && m.mes?.trim()).slice(-8);
                if (msgs.length > 0) {
                    contextParts.push(`RECENT CHAT (for setting context):\n${msgs.map(m => `${m.name || (m.is_user ? 'User' : 'Character')}: ${m.mes}`).join('\n\n').substring(0, 4000)}`);
                }
            }
            try {
                const charData = ctx.characters?.[ctx.characterId];
                if (charData?.description) contextParts.push(`NARRATOR/WORLD CARD:\n${charData.description.substring(0, 1500)}`);
            } catch (_) { }

            const systemPrompt = `${s.routerSystemPromptTemplate || ''}

---

You are an NPC Minimal Review Agent. Your ONLY job is to fix logical impossibilities caused by world or era mismatches (e.g. a character has a smartphone in a medieval fantasy setting, or uses modern slang in a historical world).

RULES:
- Preserve the original character card writing as faithfully as possible.
- Do NOT restructure, rewrite, or expand the content.
- Do NOT change the character's personality, motivations, backstory, or relationships unless they are logically impossible in this setting.
- ONLY change specific terminology, equipment names, or references that are a hard logical impossibility.
- If the card fits fine or has only minor style mismatches, output it almost entirely unchanged.
- Wrap the full content in a [CORE] and [/CORE] block.
- Your output MUST be strictly formatted as:
  [[NPC: Name | Description | keywords]]
- Output ONLY this single [[NPC: ...]] tag. No preamble or explanation.
- Do NOT use the "|\'" character inside the Description; use newlines to separate internal sections.`;

            const userPrompt = contextParts.join('\n\n---\n\n');
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
                toastr['error'](`AI review failed: ${String(err.message || err).substring(0, 120)}`, 'NPC Import');
                return null;
            }
        };

        const adaptNpcWithAI = async (charCard) => {
            const s = getSettings();
            const ctx = SillyTavern.getContext();
            const name = charCard.name || 'Unnamed';

            // Gather context
            const contextParts = [];

            // Character card data
            contextParts.push(`CHARACTER CARD:\nName: ${name}\nDescription: ${(charCard.description || '')}\nPersonality: ${(charCard.personality || '')}`);

            // Current game state
            if (s.currentMemo) {
                contextParts.push(`CURRENT GAME STATE:\n${memoForGmContext(s.currentMemo)}`);
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
                    contextParts.push(`NARRATOR/WORLD CARD:\n${charData.description}`);
                }
            } catch (_) { }

            // Existing lorebook summaries for setting context
            try {
                if (s.activeRouterKeys?.length > 0) {
                    const summaries = [];
                    const loaded = {};
                    for (const k of s.activeRouterKeys.slice(0, 15)) {
                        const [bk, uid] = k.split('::');
                        if (!loaded[bk]) loaded[bk] = await ctx.loadWorldInfo(bk);
                        const entry = loaded[bk]?.entries?.[uid];
                        if (entry) summaries.push(`[${entry.comment || 'Entry'}]: ${(entry.content || '')}`);
                    }
                    if (summaries.length > 0) {
                        contextParts.push(`ACTIVE LOREBOOK ENTRIES (world context):\n${summaries.join('\n')}`);
                    }
                }
            } catch (_) { }

            const npcInstruction = buildNpcInstruction(s.npcMajorWords || 25, s.npcMinorWords || 15, !!s.ignoreNpcImportLimits);

            const coreSections = s.npcCoreSections && Array.isArray(s.npcCoreSections) && s.npcCoreSections.length > 0 ? s.npcCoreSections : DEFAULT_NPC_SECTIONS;
            const sectionNamesList = coreSections.map(sec => sec.name).join(', ');

            const systemPrompt = `${s.routerSystemPromptTemplate || ''}

---

You are an NPC Adaptation Agent. Given a character card from a different source and the current RPG campaign context, adapt the character to fit naturally into the ongoing story.

<npc_instructions>
${npcInstruction}
</npc_instructions>

Rules:
- If the character is from a different era/genre (e.g., modern character in a medieval fantasy), translate their skills, equipment, backstory, and background to fit the current world setting.
- Preserve the character's core personality, motivations, and distinguishing traits.${s.ignoreNpcImportLimits ? `\n- MATCH LENGTH: Aim to make your output approximately the same length/word count as the original character card.` : ''}
- Write a concise NPC lorebook entry following the exact <npc_instructions> provided above.
- Your output MUST be strictly formatted as a lorebook entry tag. It MUST look EXACTLY like this:
  [[NPC: Name | Description | keywords]]
- Replace "Name" with the character's name.
- Replace "Description" with the full formatted description section. Wrap all the immutable identity sections (${sectionNamesList}) inside a single [CORE] and [/CORE] tag block within the Description. DO NOT include a Relationship field. DO NOT use the "|" character inside the Description; separate the internal sections using newlines.
- CRITICAL: Do NOT blindly copy the formatting or sections of other characters found in ACTIVE MEMORY. You MUST strictly use ONLY the sections instructed below (${sectionNamesList}) and ignore any other sections.
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
                parts.push(`CURRENT GAME STATE:\n${memoForGmContext(s.currentMemo)}`);
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
                    parts.push(`NARRATOR/WORLD CARD:\n${charData.description}`);
                }
            } catch (_) { }
            try {
                if (s.activeRouterKeys?.length > 0) {
                    const summaries = [];
                    const loaded = {};
                    for (const k of s.activeRouterKeys.slice(0, 12)) {
                        const [bk, uid] = k.split('::');
                        if (!loaded[bk]) loaded[bk] = await ctx.loadWorldInfo(bk);
                        const entry = loaded[bk]?.entries?.[uid];
                        if (entry) summaries.push(`[${entry.comment || 'Entry'}]: ${(entry.content || '')}`);
                    }
                    if (summaries.length > 0) {
                        parts.push(`ACTIVE LOREBOOK ENTRIES (world context):\n${summaries.join('\n')}`);
                    }
                }
            } catch (_) { }
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

            const coreSections = s.npcCoreSections && Array.isArray(s.npcCoreSections) && s.npcCoreSections.length > 0 ? s.npcCoreSections : DEFAULT_NPC_SECTIONS;
            const sectionNamesList = coreSections.map(sec => sec.name).join(', ');

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
- Replace "Description" with the full formatted entry. Wrap all immutable identity sections (${sectionNamesList}) inside a single [CORE] and [/CORE] block. DO NOT use "|" inside Description. Use newlines.
- CRITICAL: Do NOT blindly copy the formatting or sections of other characters found in ACTIVE MEMORY. You MUST strictly use ONLY the sections instructed below (${sectionNamesList}) and ignore any other sections.
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

            const coreSections = s.npcCoreSections && Array.isArray(s.npcCoreSections) && s.npcCoreSections.length > 0 ? s.npcCoreSections : DEFAULT_NPC_SECTIONS;
            const sectionNamesList = coreSections.map(sec => sec.name).join(', ');

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
- Replace "Description" with the full formatted entry. Wrap all immutable identity sections (${sectionNamesList}) inside a single [CORE] and [/CORE] block. DO NOT use "|" inside Description. Use newlines.
- CRITICAL: Do NOT blindly copy the formatting or sections of other characters found in ACTIVE MEMORY. You MUST strictly use ONLY the sections instructed below (${sectionNamesList}) and ignore any other sections.
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
        const NPC_CREATOR_OVERLAY_ID = 'rt-npc-creator-overlay';

        const closeNpcCreatorOverlay = () => {
            document.getElementById(NPC_CREATOR_OVERLAY_ID)?.remove();
            delete document.body.dataset.rtNpcCreatorLoading;
        };

        const openNpcCreatorDialog = async (bookName, prefix) => {
            const existingOverlay = document.getElementById(NPC_CREATOR_OVERLAY_ID);
            if (existingOverlay || document.body.dataset.rtNpcCreatorLoading) {
                existingOverlay?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                return;
            }
            document.body.dataset.rtNpcCreatorLoading = '1';
            let overlayAttached = false;

            try {
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
            } catch (_) { }

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
                        description: (c.description || ''),
                        personality: (c.personality || ''),
                        scenario: (c.scenario || ''),
                        first_mes: (c.first_mes || ''),
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
            document.getElementById(NPC_CREATOR_OVERLAY_ID)?.remove();
            const overlay = document.createElement('div');
            overlay.id = NPC_CREATOR_OVERLAY_ID;
            overlay.className = 'rt-charpicker-overlay';

            const popup = document.createElement('div');
            popup.className = 'rt-charpicker-popup';

            const dismissOverlay = () => closeNpcCreatorOverlay();

            // Header
            const header = document.createElement('div');
            header.className = 'rt-charpicker-header';
            header.innerHTML = `<h3>✨ Add NPC to Story</h3>`;
            const closeBtn = document.createElement('button');
            closeBtn.className = 'rt-charpicker-close';
            closeBtn.textContent = '✕';
            closeBtn.addEventListener('click', dismissOverlay);
            header.appendChild(closeBtn);

            // Tab bar
            const tabBar = document.createElement('div');
            tabBar.className = 'rt-npc-creator-tabs';
            const tabDefs = [
                { id: 'card', label: '🗂️ From Card' },
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
            overlay.addEventListener('click', (e) => { if (e.target === overlay) dismissOverlay(); });

            // ── Helper: AI preview + add flow ──────────────────────────────
            const showNpcPreviewAndAdd = async (generatedTag, defaultName, toastLabel, originalAvatar = null) => {
                if (!ctx.callGenericPopup) return;
                const parsed = parseNpcTag(generatedTag);
                const nameToAdd = parsed ? parsed.name : defaultName;

                // Check for duplicate
                let isDuplicate = false;
                let bookData = null;
                try { bookData = await ctx.loadWorldInfo(bookName); } catch (_) { }
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
                    try { finalBookData = await ctx.loadWorldInfo(bookName); } catch (_) { }
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
                        dismissOverlay();
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
                        directBtn.title = getSettings().npcAddAsIsMode === 'ai_review'
                            ? 'AI Review mode: sends card to AI for a minimal logical review before adding (era/world conflicts only).'
                            : 'Literal mode: wraps the card content in [CORE][/CORE] exactly as written. No AI involved.';
                        directBtn.addEventListener('click', async () => {
                            const mode = getSettings().npcAddAsIsMode ?? 'ai_review';
                            directBtn.disabled = true;
                            directBtn.textContent = mode === 'ai_review' ? '⏳ Reviewing...' : '⏳ Adding...';
                            try {
                                if (mode === 'ai_review') {
                                    // Minimal AI review pass — fix only world/era impossibilities
                                    const reviewed = await minimalReviewNpcWithAI(char);
                                    if (!reviewed) { directBtn.disabled = false; directBtn.textContent = '+ Add as is'; return; }
                                    await showNpcPreviewAndAdd(reviewed, char.name, 'NPC Creator', char.avatar);
                                } else {
                                    // Literal — wrap verbatim, no AI
                                    const ok = await createNpcFromCharCard(char, bookName);
                                    if (ok) {
                                        toastr['success'](`Added "${char.name}" as NPC.`, 'NPC Creator');
                                        dismissOverlay();
                                        await refreshManifest();
                                    }
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
                    { id: 'Enemy', icon: '⚔️' },
                    { id: 'Arch Nemesis', icon: '💀' },
                    { id: 'Lover', icon: '❤️' },
                    { id: 'Family Relative', icon: '👨‍👩‍👧' },
                    { id: 'Companion / Ally', icon: '🛡️' },
                    { id: 'Merchant', icon: '🪙' },
                    { id: 'Mysterious Stranger', icon: '🎭' },
                    { id: 'Rival', icon: '🧙' },
                    { id: 'Custom', icon: '✍️' },
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
            overlayAttached = true;
            delete document.body.dataset.rtNpcCreatorLoading;
            } finally {
                if (!overlayAttached) delete document.body.dataset.rtNpcCreatorLoading;
            }
        };

        const refreshBtn = agentPanel.querySelector('#rt-agent-manifest-refresh');
        if (refreshBtn) refreshBtn.addEventListener('click', () => refreshManifest('manual-button'));

        const viewModeSwitch = agentPanel.querySelector('#rt-agent-view-mode-switch');
        if (viewModeSwitch) {
            viewModeSwitch.addEventListener('click', async (e) => {
                const btn = e.target.closest('.rt-agent-view-mode-btn');
                if (!btn || btn.classList.contains('rt-agent-view-mode-btn-active')) return;
                e.stopPropagation();
                const s = getSettings();
                if (btn.id === 'rt-agent-view-mode-visualization' && !s.locationImages) return;
                s.agentImmersionMode = btn.id === 'rt-agent-view-mode-visualization';
                saveSettings(true);
                await refreshLorebookAgentViewsNow({ forceLayoutRefresh: true });
            });
        }
        syncAgentImmersionUi();

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
        globalThis._rpgRenderAgentCustomTags = renderAgentCustomTags;





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

        const agentPromptBtn = queryAgentUi('#rt-agent-prompt-btn');
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
                s.routerLookbackSinceLastRun = mode === 'since_last_run';
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

        const swipeRollbackCheck = /** @type {HTMLInputElement} */ (agentPanel.querySelector('#rt-agent-router-swipe-rollback'));
        if (swipeRollbackCheck) {
            swipeRollbackCheck.addEventListener('change', () => {
                const s = getSettings();
                s.routerSwipeRollback = swipeRollbackCheck.checked;
                $('#rpg_tracker_router_swipe_rollback').prop('checked', s.routerSwipeRollback);
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
        const agentPauseBtn = queryAgentUi('#rt-agent-router-pause-btn');
        const agentPauseBanner = /** @type {HTMLElement} */ (queryAgentUi('#rt-agent-pause-banner'));
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



        const manualRunBtn = queryAgentUi('#rt-agent-router-manual-run');
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

        const agentStopBtn = queryAgentUi('#rt-agent-stop-btn');
        if (agentStopBtn) {
            agentStopBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                stopRouterPass();
            });
        }

        // ── Cleanup dropdown submenu ─────────────────────────────────────────────
        const cleanupBroomBtn = queryAgentUi('#rt-agent-router-cleanup');
        const cleanupDropdown = queryAgentUi('#rt-cleanup-dropdown');
        const cleanupRunBtn = queryAgentUi('#rt-cleanup-run-btn');
        const cleanupSettingsToggle = queryAgentUi('#rt-cleanup-settings-toggle');
        const cleanupSettingsPanel = queryAgentUi('#rt-cleanup-settings-panel');
        const cleanupThresholdInp = /** @type {HTMLInputElement|null} */ (queryAgentUi('#rt-cleanup-threshold-inp'));
        const cleanupEveryInp = /** @type {HTMLInputElement|null} */ (queryAgentUi('#rt-cleanup-every-inp'));
        const cleanupUseThresholdChk = /** @type {HTMLInputElement|null} */ (queryAgentUi('#rt-cleanup-use-threshold-chk'));
        const cleanupThresholdRow = /** @type {HTMLElement|null} */ (queryAgentUi('#rt-cleanup-threshold-row'));
        const cleanupMenuWrap = queryAgentUi('#rt-cleanup-menu-wrap');

        if (cleanupBroomBtn && cleanupDropdown) {
            const closeCleanupDropdown = () => {
                cleanupDropdown.style.display = 'none';
                cleanupDropdown.closest('.rpg-tracker-panel')?.classList.remove('rt-cleanup-menu-open');
            };

            const positionCleanupDropdown = () => {
                const hostPanel = cleanupBroomBtn.closest('.rpg-tracker-panel');
                if (!(hostPanel instanceof HTMLElement)) return;
                if (cleanupDropdown.parentElement !== hostPanel) {
                    hostPanel.appendChild(cleanupDropdown);
                }
                const rect = cleanupBroomBtn.getBoundingClientRect();
                const panelRect = hostPanel.getBoundingClientRect();
                cleanupDropdown.style.top = `${rect.bottom - panelRect.top + 2}px`;
                cleanupDropdown.style.right = `${panelRect.right - rect.right}px`;
                cleanupDropdown.style.left = 'auto';
                cleanupDropdown.style.display = 'block';
                hostPanel.classList.add('rt-cleanup-menu-open');
            };

            // Toggle dropdown on broom click
            cleanupBroomBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = cleanupDropdown.style.display !== 'none';
                if (isOpen) {
                    closeCleanupDropdown();
                } else {
                    positionCleanupDropdown();
                }
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
                const target = /** @type {Node} */ (e.target);
                if (cleanupMenuWrap?.contains(target) || cleanupDropdown.contains(target)) return;
                closeCleanupDropdown();
            });

            // "Run Cleanup" button — existing popup-then-run flow
            if (cleanupRunBtn) {
                cleanupRunBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    closeCleanupDropdown();

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
                    void saveSettings();
                });
            }

            // Interval input → persists immediately
            if (cleanupEveryInp) {
                cleanupEveryInp.addEventListener('change', (e) => {
                    const s = getSettings();
                    const v = parseInt(/** @type {HTMLInputElement} */(e.target).value);
                    s.routerCleanupEvery = isNaN(v) ? 0 : Math.max(0, Math.min(100, v));
                        /** @type {HTMLInputElement} */ (e.target).value = String(s.routerCleanupEvery);
                    void saveSettings();
                });
            }

            // Use-threshold checkbox → dims threshold row and persists
            if (cleanupUseThresholdChk && cleanupThresholdRow) {
                cleanupUseThresholdChk.addEventListener('change', () => {
                    const s = getSettings();
                    s.routerCleanupUseThreshold = cleanupUseThresholdChk.checked;
                    cleanupThresholdRow.style.opacity = cleanupUseThresholdChk.checked ? '1' : '0.35';
                    cleanupThresholdRow.style.pointerEvents = cleanupUseThresholdChk.checked ? 'auto' : 'none';
                    void saveSettings();
                });
            }
        }

        // ── Lorebook Agent Detaching ──
        const detachBtn = /** @type {HTMLElement} */ (queryAgentUi('#rt-agent-router-detach'));
        if (detachBtn) {
            const DETACHED_AGENT_KEY = 'rpg_tracker_agent_detached';
            const GEO_KEY = 'rpg_tracker_geometry_lorebook_agent';
            const isDetached = () => localStorage.getItem(DETACHED_AGENT_KEY) === 'true';
            const isMobileLayout = () => window.matchMedia('(max-width: 800px)').matches;
            const MOBILE_AGENT_HEIGHT = 'calc(100dvh - 44px - 8px - env(safe-area-inset-bottom, 0px))';

            const applyMobileAgentGeometry = () => {
                agentPanel.style.top = '44px';
                agentPanel.style.left = '3vw';
                agentPanel.style.width = '94vw';
                agentPanel.style.height = MOBILE_AGENT_HEIGHT;
                agentPanel.style.maxHeight = MOBILE_AGENT_HEIGHT;
                agentPanel.style.right = 'auto';
            };

            /** @type {(() => void) | null} */
            let destroyAgentDraggable = null;

            const headerFaceAgent = panel.querySelector('#rt-header-face-agent');
            const mainHeader = panel.querySelector('#rpg-tracker-header');
            const agentPane = panel.querySelector('#rt-panel-agent-pane');

            const moveAgentHeaderToDetached = () => {
                let detachedHeader = agentPanel.querySelector('#rt-agent-detached-header');
                if (!detachedHeader) {
                    detachedHeader = document.createElement('div');
                    detachedHeader.id = 'rt-agent-detached-header';
                    detachedHeader.className = 'rpg-tracker-header';
                    detachedHeader.style.cursor = 'default';
                    agentPanel.insertBefore(detachedHeader, agentPanel.firstChild);
                }
                if (headerFaceAgent instanceof HTMLElement && headerFaceAgent.parentElement !== detachedHeader) {
                    headerFaceAgent.classList.add('rt-header-face-active');
                    headerFaceAgent.classList.remove('rt-header-face-inactive');
                    headerFaceAgent.style.display = 'flex';
                    detachedHeader.appendChild(headerFaceAgent);
                }
                return detachedHeader;
            };

            const moveAgentHeaderToIntegrated = () => {
                if (headerFaceAgent instanceof HTMLElement && mainHeader instanceof HTMLElement
                    && headerFaceAgent.parentElement !== mainHeader) {
                    mainHeader.appendChild(headerFaceAgent);
                }
                agentPanel.querySelector('#rt-agent-detached-header')?.remove();
            };

            const applyDetachedState = () => {
                panel.classList.toggle('rt-agent-detached-mode', isDetached());

                if (isDetached()) {
                    agentPanel.classList.remove('rt-agent-integrated');
                    agentPanel.classList.add('rt-detached-panel');
                    const s = getSettings();
                    const showDetached = s.trackerContentMode === 'agent';
                    agentPanel.style.display = showDetached ? 'flex' : 'none';
                    document.body.appendChild(agentPanel);
                    moveAgentHeaderToDetached();
                    syncRouterPrefixDisplays(s.routerCampaignPrefix || '');
                    runtimeState.renderRouterUI();
                    refreshManifest();

                    const detachedHeader = agentPanel.querySelector('#rt-agent-detached-header');
                    if (destroyAgentDraggable) {
                        destroyAgentDraggable();
                        destroyAgentDraggable = null;
                    }
                    if (detachedHeader instanceof HTMLElement) {
                        destroyAgentDraggable = makeDraggable(agentPanel, detachedHeader, GEO_KEY);
                    }
                    detachBtn.innerHTML = '↓';
                    detachBtn.title = 'Re-attach Lorebook Agent';

                    agentPanel.style.position = 'absolute';
                    agentPanel.style.boxShadow = '';
                    agentPanel.style.border = '';

                    if (isMobileLayout()) {
                        applyMobileAgentGeometry();
                    } else {
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
                            agentPanel.style.maxHeight = '';
                            agentPanel.style.right = 'auto';
                        } catch (e) {
                            agentPanel.style.left = '100px';
                            agentPanel.style.top = '100px';
                            agentPanel.style.width = '300px';
                        }
                    }

                    applyPanelContentMode('tracker', { skipPersist: true });
                    applyViewState();
                } else {
                    if (destroyAgentDraggable) {
                        destroyAgentDraggable();
                        destroyAgentDraggable = null;
                    }
                    agentPanel.classList.remove('rt-detached-panel');
                    agentPanel.classList.add('rt-agent-integrated');
                    moveAgentHeaderToIntegrated();

                    const attachParent = agentPane instanceof HTMLElement ? agentPane : panel;
                    attachParent.appendChild(agentPanel);

                    agentPanel.style.position = '';
                    agentPanel.style.left = '';
                    agentPanel.style.top = '';
                    agentPanel.style.right = '';
                    agentPanel.style.width = '';
                    agentPanel.style.height = '';
                    agentPanel.style.maxHeight = '';
                    agentPanel.style.boxShadow = '';
                    agentPanel.style.border = '';

                    detachBtn.innerHTML = '⧉';
                    detachBtn.title = 'Detach Lorebook Agent';

                    applyPanelContentMode(getSettings().trackerContentMode || 'tracker');
                }
                applyPanelBackgroundToDom();
                updateAgentBtnUI();
            };

            detachBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const s = getSettings();
                if (!isDetached()) {
                    s.trackerContentMode = 'agent';
                    localStorage.setItem('rpg_tracker_content_mode', 'agent');
                }
                localStorage.setItem(DETACHED_AGENT_KEY, isDetached() ? 'false' : 'true');
                applyDetachedState();
            });

            // Initial apply
            if (isDetached()) {
                applyDetachedState();
            }

            window.addEventListener('resize', () => {
                if (isDetached() && isMobileLayout()) {
                    applyMobileAgentGeometry();
                }
            });
        }


    }

    // ── Lorebook Agent History Nav (← [LIVE] →) ─────────────────────────
    const agentActivity = wireAgentActivity({
        agentPanel,
        getRouterTick,
        getSettings,
        reapplyRouterPass,
        refreshManifest,
        rollbackRouterPass,
        saveSettings,
    });
    const { syncAgentNav, syncLastRunDisplay, updateUndoLabel } = agentActivity;

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
            runtimeState.loreRedoStack = [];
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
            runtimeState.renderRouterUI();
        });
    }



    updateChatLinkUI();
    updatePanelStatus();

    // Handle manual edits to live memo
    const textarea = panel.querySelector('#rpg-tracker-memo');
    /** True when the raw textarea has edits not yet copied into settings.currentMemo. */
    let _rawMemoDirty = false;

    // Sync textarea → settings only. Never call saveSettings/saveChatState here:
    // saveChatState invokes this flush, and a nested save would recurse forever.
    const flushRawMemoChanges = () => {
        if (!_rawMemoDirty) return;
        _rawMemoDirty = false;
        if (textarea && runtimeState.historyViewIndex === -1) {
            const newText = textarea.value;
            settings.currentMemo = applyQuestSyncAndStripMemo(newText);
            refreshDayNightCycleFromMemo(settings.currentMemo);
        }
    };
    globalThis._rpgFlushRawMemoChanges = flushRawMemoChanges;

    textarea.addEventListener('input', (e) => {
        if (runtimeState.historyViewIndex !== -1) return;
        const newText = /** @type {HTMLTextAreaElement} */ (e.target).value;

        // Update token counter immediately in-place
        panel.querySelector('#rpg-tracker-count').textContent = `~${Math.round(newText.length / 2.62)} tokens`;

        // Day/night tint + badge update live as the user edits (esp. [TIME] changes in Raw view)
        refreshDayNightCycleFromMemo(newText);

        // Persist immediately through the tracker-owned checkpoint service.
        _rawMemoDirty = true;
        settings.currentMemo = applyQuestSyncAndStripMemo(newText);
        _rawMemoDirty = false;
        saveSettings();
        refreshRenderedView();
    });

    // (RNG footer toggles removed; managed via settings.html)

    // View toggle (Raw ↔ Rendered)
    let _viewBtn = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-view-btn'));

    if (settings.renderedViewActive !== undefined) {
        runtimeState.renderedViewActive = settings.renderedViewActive;
    } else {
        runtimeState.renderedViewActive = true;
        settings.renderedViewActive = true;
    }

    function applyPanelContentMode(mode, options = {}) {
        const isAgentDetached = () => localStorage.getItem('rpg_tracker_agent_detached') === 'true';
        const effectiveMode = mode === 'agent' ? 'agent' : 'tracker';
        const s = getSettings();
        s.trackerContentMode = effectiveMode;
        if (!options.skipPersist) {
            localStorage.setItem('rpg_tracker_content_mode', effectiveMode);
            localStorage.removeItem('rpg_tracker_agent_visible');
        }

        const modeTrackerBtn = panel.querySelector('#rt-panel-mode-tracker');
        const modeAgentBtn = panel.querySelector('#rt-panel-mode-agent');
        const trackerPane = panel.querySelector('#rt-panel-tracker-pane');
        const agentPaneEl = panel.querySelector('#rt-panel-agent-pane');
        const headerFaceTracker = panel.querySelector('#rt-header-face-tracker');
        const headerFaceAgent = panel.querySelector('#rt-header-face-agent');

        if (isAgentDetached()) {
            panel.classList.remove('rt-panel-mode-agent');
            if (headerFaceTracker instanceof HTMLElement) headerFaceTracker.style.display = 'flex';
            if (headerFaceAgent instanceof HTMLElement && headerFaceAgent.closest('#rpg-tracker-header')) {
                headerFaceAgent.style.display = 'none';
            }
            if (trackerPane instanceof HTMLElement) trackerPane.style.display = 'flex';
            if (agentPaneEl instanceof HTMLElement) agentPaneEl.style.display = 'none';
            applyViewState();
            updateAgentBtnUI();
            applyPanelCollapseUi();
            return;
        }

        const isAgent = effectiveMode === 'agent';
        panel.classList.toggle('rt-panel-mode-agent', isAgent);

        if (modeTrackerBtn) {
            modeTrackerBtn.classList.toggle('rt-agent-view-mode-btn-active', !isAgent);
            modeTrackerBtn.setAttribute('aria-selected', String(!isAgent));
        }
        if (modeAgentBtn) {
            modeAgentBtn.classList.toggle('rt-agent-view-mode-btn-active', isAgent);
            modeAgentBtn.setAttribute('aria-selected', String(isAgent));
        }

        if (headerFaceTracker instanceof HTMLElement) {
            headerFaceTracker.classList.toggle('rt-header-face-active', !isAgent);
            headerFaceTracker.classList.toggle('rt-header-face-inactive', isAgent);
            headerFaceTracker.style.display = 'flex';
        }
        if (headerFaceAgent instanceof HTMLElement && headerFaceAgent.closest('#rpg-tracker-header')) {
            headerFaceAgent.classList.toggle('rt-header-face-active', isAgent);
            headerFaceAgent.classList.toggle('rt-header-face-inactive', !isAgent);
            headerFaceAgent.style.display = 'flex';
        }

        if (trackerPane instanceof HTMLElement) {
            trackerPane.style.display = isAgent ? 'none' : 'flex';
        }
        if (agentPaneEl instanceof HTMLElement) {
            agentPaneEl.style.display = isAgent ? 'flex' : 'none';
        }
        if (agentPanel) {
            agentPanel.style.display = isAgent ? 'flex' : 'none';
        }

        if (isAgent) {
            syncRouterPrefixDisplays(s.routerCampaignPrefix || '');
            if (typeof globalThis._rpgSyncAgentImmersionUi === 'function') {
                globalThis._rpgSyncAgentImmersionUi();
            }
            if (typeof runtimeState.renderRouterUI === 'function') runtimeState.renderRouterUI();
            void refreshManifest();
        } else {
            applyViewState();
        }
        updateAgentBtnUI();
        applyPanelCollapseUi();
    }

    function applyViewState() {
        const isAgentDetached = () => localStorage.getItem('rpg_tracker_agent_detached') === 'true';
        const s = getSettings();
        if (!isAgentDetached() && s.trackerContentMode === 'agent') {
            updateAgentBtnUI();
            return;
        }

        const taEl = panel.querySelector('#rpg-tracker-memo');
        const rvEl = panel.querySelector('#rpg-tracker-render');
        const viewBtnEl = panel.querySelector('#rpg-tracker-view-btn');
        if (!taEl || !rvEl || !viewBtnEl) return;

        if (runtimeState.renderedViewActive) {
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
        // Always re-apply day/night from the current textarea (covers Raw→Rendered toggles
        // and ensures the tint matches any manual edits flushed just before the switch).
        refreshDayNightCycleFromMemo(taEl.value || settings.currentMemo || '');
        if (typeof updateAgentBtnUI === 'function') {
            updateAgentBtnUI();
        }
    }

    const modeTrackerBtn = panel.querySelector('#rt-panel-mode-tracker');
    const modeAgentBtn = panel.querySelector('#rt-panel-mode-agent');
    if (modeTrackerBtn) {
        modeTrackerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            applyPanelContentMode('tracker');
        });
    }
    if (modeAgentBtn) {
        modeAgentBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = getSettings();
            if (s.trackerCollapsed) {
                s.trackerCollapsed = false;
                localStorage.setItem('rpg_tracker_collapsed', 'false');
                panel.classList.remove('rt-panel-collapsed');
                const colIcon = panel.querySelector('#rpg-tracker-collapse-btn i');
                if (colIcon) colIcon.className = 'fa-solid fa-chevron-up';
            }
            applyPanelContentMode('agent');
        });
    }

    applyPanelContentMode(settings.trackerContentMode || 'tracker', { skipPersist: true });

    applyViewState();

    _viewBtn.addEventListener('click', () => {
        if (typeof flushRawMemoChanges === 'function') flushRawMemoChanges();
        runtimeState.renderedViewActive = !runtimeState.renderedViewActive;
        settings.renderedViewActive = runtimeState.renderedViewActive;
        localStorage.setItem('rpg_tracker_rendered_view_active', String(runtimeState.renderedViewActive));
        saveSettings();
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
            if (typeof refreshManifest === 'function') void refreshManifest().catch(() => { });
        } else if (choice === 1002) {
            await removeAllPortraits(refreshRenderedView);
            if (typeof refreshManifest === 'function') void refreshManifest().catch(() => { });
        } else if (choice === 1003) {
            await autoGenerateEnemyPortraits(refreshRenderedView);
            if (typeof refreshManifest === 'function') void refreshManifest().catch(() => { });
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
        applyPanelCollapseUi();
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
        if (runtimeState.historyViewIndex === -1) return;
        const snapshot = s.memoHistory[runtimeState.historyViewIndex];
        if (snapshot === undefined) return;

        // Simply move the live pointer to this snapshot.
        // The history already contains all states — no need to archive currentMemo here.
        // Direct Prompt and runStateModelPass handle archiving when they produce new states.
        s.currentMemo = snapshot;
        s.historyIndex = runtimeState.historyViewIndex;
        runtimeState.historyViewIndex = -1;
        saveSettings();
        if (s.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
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
            runtimeState.historyViewIndex = -1;
            saveSettings();
            if (settings.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
            syncMemoView();
            const dp = document.getElementById('rpg-tracker-delta-content');
            if (dp) dp.innerHTML = '<span class="delta-empty">Log cleared.</span>';
            toastr['success']("RPG Tracker logic wiped.", "RPG Tracker");
        }
    });

    syncMemoView();

}
