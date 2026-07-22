/** Produces the static Tracker and Lorebook Agent panel structure. */
export function buildPanelMarkup({ settings, agentPanelCollapsedClass }) {
    return `
            <div class="rt-resizer-tr" id="rt-resizer-tr" title="Resize from top-right"></div>
            <div class="rpg-tracker-header" id="rpg-tracker-header">
                <div class="rt-header-starfield" aria-hidden="true"></div>
                <div class="rt-header-face rt-header-face-active" id="rt-header-face-tracker">
                <div class="rpg-tracker-header-left">
                    <div class="rpg-tracker-status-indicator active" id="rpg-tracker-status"></div>
                    <span class="rt-header-title-desktop">Multihog D&D Framework</span>
                    <span class="rt-header-title-mobile" style="display: none;">Multihog D&D</span>
                    <div id="rt-daynight-badge-slot"></div>
                    <button class="rpg-tracker-stop-btn" id="rpg-tracker-stop-btn" title="Stop Generation" style="display:none;">■</button>
                </div>
                <div class="rpg-tracker-header-center" id="rpg-tracker-pause-banner"></div>
                <div class="rpg-tracker-header-right">
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-chat-link-btn" style="font-size:13px;" title="Chat Link ON">🔗</button>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-view-btn" title="Toggle rendered view">⊞</button>
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
                <div class="rt-header-face rt-header-face-inactive" id="rt-header-face-agent">
                    <div class="rpg-tracker-header-left">
                        <i class="fa-solid fa-robot"></i> <span>Lorebook Agent: Autonomous Librarian</span>
                    </div>
                    <div class="rpg-tracker-header-center" id="rt-agent-pause-banner" style="color:#ffa500; font-size:0.7em; font-weight:bold; letter-spacing:0.04em;">${settings.routerPaused ? 'AGENT PAUSED' : ''}</div>
                    <div class="rpg-tracker-header-right">
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-manual-run" title="Run Research Now" style="color: var(--rt-accent);"><i class="fa-solid fa-play"></i></button>
                        <button class="rpg-tracker-stop-btn" id="rt-agent-stop-btn" title="Stop Agent" style="display:none;">■</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-full-audit-panel" title="Run Full Audit (Chunked)" style="color: #ff5555;"><i class="fa-solid fa-book-journal-whills"></i></button>
                         <div id="rt-cleanup-menu-wrap" style="position:relative; display:inline-flex;">
                             <button class="rpg-tracker-icon-btn" id="rt-agent-router-cleanup" title="Cleanup Menu" style="color: #e67e22;"><i class="fa-solid fa-broom"></i></button>
                             <div id="rt-cleanup-dropdown" class="rt-cleanup-dropdown" style="display:none;">
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
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-detach" title="Detach Lorebook Agent">⧉</button>
                        <button class="rpg-tracker-icon-btn" id="rt-agent-router-collapse-btn" title="Collapse Panel"><i class="fa-solid ${settings.agentCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                        <button class="rpg-tracker-icon-btn" id="rpg-tracker-agent-close" title="Close">✕</button>
                    </div>
                </div>
            </div>
            <div class="rpg-tracker-content">
                <div class="rt-panel-mode-switch-wrap" id="rt-panel-mode-switch-wrap">
                    <div class="rt-agent-view-mode-switch rt-panel-mode-switch" id="rt-panel-mode-switch" role="tablist" aria-label="Panel content mode">
                        <button type="button" id="rt-panel-mode-tracker" class="rt-agent-view-mode-btn rt-agent-view-mode-btn-active" role="tab" aria-selected="true">State Tracker</button>
                        <button type="button" id="rt-panel-mode-agent" class="rt-agent-view-mode-btn" role="tab" aria-selected="false">Lorebook Agent</button>
                    </div>
                </div>
                <div class="rt-panel-mode-pane" id="rt-panel-tracker-pane">
                <textarea class="rpg-tracker-memo-area" id="rpg-tracker-memo">${settings.currentMemo}</textarea>
                <div class="rpg-tracker-render-view" id="rpg-tracker-render" style="display:none;"></div>
                </div>
                <div class="rt-panel-mode-pane" id="rt-panel-agent-pane" style="display:none;">
            <div class="rpg-tracker-panel rpg-tracker-agent-panel rt-agent-integrated ${agentPanelCollapsedClass}${settings.trackerTheme || 'rt-theme-native'}" id="rpg-tracker-agent">
                <div class="rpg-tracker-content" style="flex: 1; min-height: 0; resize: none; padding: 10px; color: var(--rt-text); display: flex; flex-direction: column;">
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

                        <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px; cursor: pointer; font-size: 0.769em; opacity: 0.75;" title="When enabled, swiping away from a generation that triggered the agent undoes that lorebook pass. Swipes never advance the Run Every counter either way.">
                            <input type="checkbox" id="rt-agent-router-swipe-rollback" ${settings.routerSwipeRollback !== false ? 'checked' : ''}>
                            <span>Auto-rollback on swipe</span>
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
                        <button id="rt-agent-world-purge-history" title="Deletes all World Progression reports and skeleton data for this campaign prefix and resets timer state for this chat" style="width:100%; background:rgba(234,67,53,0.14); border:1px solid rgba(234,67,53,0.35); color:rgba(234,67,53,0.9); border-radius:4px; padding:4px; font-size:0.692em; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; margin-top:5px;">
                            <i class="fa-solid fa-trash-can"></i> Purge World History for this Chat
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

                    <div id="rt-agent-campaign-section" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; display: flex; flex-direction: column; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-shrink: 0; gap: 8px;">
                            <div id="rt-agent-campaign-header-title" style="font-weight: bold; opacity: 0.8; font-size: 0.846em; flex: 1; min-width: 0;${settings.locationImages ? ' display: none;' : ''}">CAMPAIGN RECORDS</div>
                            <div class="rt-agent-view-mode-switch" id="rt-agent-view-mode-switch" role="tablist" aria-label="Lorebook view mode"${settings.locationImages ? '' : ' style="display: none;"'}>
                                <button type="button" class="rt-agent-view-mode-btn${settings.agentImmersionMode ? '' : ' rt-agent-view-mode-btn-active'}" id="rt-agent-view-mode-records" role="tab" aria-selected="${settings.agentImmersionMode ? 'false' : 'true'}">Campaign Records</button>
                                <button type="button" class="rt-agent-view-mode-btn rt-agent-view-mode-btn-visualization${settings.agentImmersionMode ? ' rt-agent-view-mode-btn-active' : ''}" id="rt-agent-view-mode-visualization" role="tab" aria-selected="${settings.agentImmersionMode ? 'true' : 'false'}">
                                    <span class="rt-agent-view-mode-glow" aria-hidden="true"></span>
                                    <span class="rt-agent-view-mode-label">Visualization Mode</span>
                                </button>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                <button class="rpg-tracker-icon-btn" id="rt-agent-activate-books" title="Activate campaign lorebooks now" style="font-size: 0.769em; opacity: 0.5;"><i class="fa-solid fa-book-open"></i></button>
                                <button class="rpg-tracker-icon-btn" id="rt-agent-manifest-refresh" title="Refresh Manifest" style="font-size: 0.769em; opacity: 0.5;"><i class="fa-solid fa-arrows-rotate"></i></button>
                            </div>
                        </div>
                        <div id="rt-agent-immersion-view" style="display: ${settings.agentImmersionMode ? 'flex' : 'none'}; flex-direction: column; flex-shrink: 0;"></div>
                        <div id="rt-agent-manifest-list" style="display: ${settings.agentImmersionMode ? 'none' : 'flex'}; flex-direction: column; gap: 6px; flex-shrink: 0;">
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
                    <div class="rt-footer-starfield" aria-hidden="true"></div>
                    <div class="rt-agent-footer-left">
                        <div class="rpg-tracker-nav">
                            <button class="rpg-tracker-nav-btn" id="rt-agent-nav-back" title="Undo last lorebook pass">←</button>
                            <span class="rpg-tracker-nav-label" id="rt-agent-nav-label">[ LIVE ]</span>
                            <button class="rpg-tracker-nav-btn" id="rt-agent-nav-fwd" title="Redo lorebook pass">→</button>
                        </div>
                    </div>
                    <div class="rt-agent-footer-center">
                        <div id="rt-agent-footer-location" class="rt-footer-location-text" title="Current Location (Main, Sub)"></div>
                    </div>
                    <div class="rt-agent-footer-right">
                        <div id="rt-agent-last-run"></div>
                        <button class="rpg-tracker-icon-btn rt-footer-prompt-btn" id="rt-agent-prompt-btn" title="Toggle direct prompt">💬</button>
                    </div>
                </div>
                <div class="rt-resizer-br" id="rt-agent-resizer-br" title="Resize from bottom-right"></div>
                <div class="rt-resizer-bl" id="rt-agent-resizer-bl" title="Resize from bottom-left"></div>
            </div>
                </div>
            </div>
            <div class="rpg-tracker-delta-resize-handle" id="rpg-tracker-delta-handle" style="display:none;"></div>
            <div class="rpg-tracker-delta-panel" id="rpg-tracker-delta" style="display:none;">
                <div class="rpg-tracker-delta-toolbar">
                    <span class="rpg-tracker-delta-title">Change Log</span>
                    <button class="rpg-tracker-icon-btn" id="rpg-tracker-delta-clear" title="Clear log">✕</button>
                </div>
                <div id="rpg-tracker-delta-content">${settings.lastDelta || '<span class="delta-empty">No changes yet.</span>'}</div>
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
                <div class="rt-footer-starfield" aria-hidden="true"></div>
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
                    <div id="rt-footer-location" class="rt-footer-location-text" title="Current Location (Main, Sub)"></div>
                </div>
                <div class="flex-container gap-1 alignitemscenter rt-utility-footer-group">
                    <button class="rpg-tracker-nav-btn" id="rpg-tracker-chat-link-footer-btn" title="Chat Link ON" style="padding: 1px 8px; font-size: 0.85em;">🔗 Link</button>
                    <span id="rpg-tracker-count">~${Math.round(settings.currentMemo.length / 2.62)} tokens</span>
                    <button class="rpg-tracker-nav-btn" id="rpg-tracker-delta-btn" title="Toggle change log" style="padding: 1px 5px; font-size: 0.692em; opacity: 0.8; margin-left: 5px;">δ</button>
                    <button class="rpg-tracker-nav-btn" id="rpg-tracker-memo-clear" style="padding: 1px 5px; font-size: 0.692em; opacity: 0.8; margin-left: 5px;" title="Clear memo and history">CLEAR</button>
                </div>
                <button class="rpg-tracker-icon-btn rt-footer-prompt-btn" id="rpg-tracker-prompt-btn" title="Toggle direct prompt">💬</button>
            </div>
        `;
}
