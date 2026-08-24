import { runtimeState } from '../../app/runtime-state.js';

/** Wires the Lorebook Agent's World Progression controls and status readout. */
export function wireAgentWorldProgression({
    agentPanel,
    confirmAndPurgeWorldHistory,
    extractCurrentTimeStr,
    formatInWorldTime,
    getSettings,
    parseInWorldTime,
    saveChatState,
    saveSettings,
    syncCampaignPrefixAndWorldsForChat,
}) {
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
                if (runtimeState.currentChatId) {
                    await syncCampaignPrefixAndWorldsForChat(runtimeState.currentChatId, 'toggle-world-progression');
                }
            });
        }

        // ── Agent World Progression status display helper ──
        function updateAgentWorldStatus() {
            const s = getSettings();
            const label = s.worldProgressionLastFiredPeriodLabel || '';
            const mins = label ? (parseInWorldTime(label) ?? -1) : -1;
            const intervalHours = s.worldProgressionIntervalHours || 24;
            const intervalMins = intervalHours * 60;
            function fmtWP(m) {
                return formatInWorldTime(m);
            }
            const lastEl = agentPanel.querySelector('#rt-agent-world-last-fired');
            const nextEl = agentPanel.querySelector('#rt-agent-world-next-fire');
            const badge = agentPanel.querySelector('#rt-agent-world-enabled-badge');
            if (lastEl) lastEl.textContent = label || 'Never';

            let nextMins = -1;
            if (mins >= 0) {
                nextMins = mins + intervalMins;
            } else {
                const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
                const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
                const currentMins = timeStr ? (parseInWorldTime(timeStr) ?? -1) : -1;
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
        runtimeState.updateAgentWorldStatusRef = updateAgentWorldStatus;

        // ── Agent World Interval input ──
        const worldIntervalInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-world-interval'));
        if (worldIntervalInp) {
            worldIntervalInp.addEventListener('input', () => {
                getSettings().worldProgressionIntervalHours = parseInt(worldIntervalInp.value) || 24;
                saveSettings();
                updateAgentWorldStatus();
                $('#rpg_world_progression_interval').val(getSettings().worldProgressionIntervalHours);
                if (typeof runtimeState.updateWorldProgressionLastFiredDisplayRef === 'function') {
                    runtimeState.updateWorldProgressionLastFiredDisplayRef();
                }
            });
        }

        // ── Agent World Locations per report ──
        const worldLocationsInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-world-locations'));
        if (worldLocationsInp) {
            worldLocationsInp.addEventListener('change', () => {
                const s = getSettings();
                s.worldProgressionLocationsPerReport = Math.max(1, Math.min(12, parseInt(worldLocationsInp.value, 10) || 3));
                worldLocationsInp.value = String(s.worldProgressionLocationsPerReport);
                saveSettings();
                $('#rpg_world_progression_locations_per_report').val(s.worldProgressionLocationsPerReport);
            });
        }

        // ── Agent World Fire Now button ──
        const worldFireNowBtn = agentPanel.querySelector('#rt-agent-world-fire-now');
        if (worldFireNowBtn) {
            worldFireNowBtn.addEventListener('click', async () => {
                const { parseInWorldMinutes: piw, runWorldProgressionPass: rwp } = await import('../../../router.js');
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
                const { parseInWorldMinutes: piw, runWorldProgressionPass: rwp } = await import('../../../router.js');
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
                if (s.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
                updateAgentWorldStatus();
                if (typeof runtimeState.updateWorldProgressionLastFiredDisplayRef === 'function') runtimeState.updateWorldProgressionLastFiredDisplayRef();
                toastr['info']('World Progression timeline reset. Next report will start from the current time.', 'World Progression');
            });
        }

        const worldPurgeBtn = agentPanel.querySelector('#rt-agent-world-purge-history');
        if (worldPurgeBtn) {
            worldPurgeBtn.addEventListener('click', () => { void confirmAndPurgeWorldHistory(); });
        }

        // ── Agent World Progression Toggle ──

    return { updateStatus: updateAgentWorldStatus };
}
