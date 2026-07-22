import { runtimeState } from './runtime-state.js';

/** Manages the Lorebook Agent Scene View and its Records/Visualization mode UI. */
export function createSceneViewController({
    agentPanel,
    buildImmersionSceneState,
    getSettings,
    loadLocationEntryByPath,
    loadNpcEntryByKey,
    maybeAutoGenerateImmersionSceneArt,
    renderImmersionViewHtml,
    runRealtimeSceneArtCheck,
    showLocationImageSettingsMenu,
}) {
        const bindImmersionViewEvents = () => {
            const root = agentPanel.querySelector('#rt-agent-immersion-view');
            if (!root) return;

            const hero = root.querySelector('.rt-immersion-hero-wrap');
            if (hero) {
                const activateHero = async () => {
                    const path = hero.getAttribute('data-loc-path');
                    const raw = hero.getAttribute('data-loc-raw');
                    if (path) {
                        const item = await loadLocationEntryByPath(path);
                        const opener = globalThis._rpgAgentOpenLocationDetail;
                        if (item && typeof opener === 'function') {
                            await opener(item, path);
                        } else {
                            await showLocationImageSettingsMenu(path, () => runtimeState.refreshImmersionView(), item?.content || '');
                        }
                    } else if (raw) {
                        toastr.info(`No lore match for "${raw}". Add a Locations entry or check the name.`, 'Scene View');
                    }
                };
                hero.addEventListener('click', () => { void activateHero(); });
                hero.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void activateHero();
                    }
                });
            }

            root.querySelectorAll('.rt-immersion-npc-tile').forEach(tile => {
                tile.addEventListener('click', (e) => {
                    e.stopPropagation();
                    void (async () => {
                        if (tile.getAttribute('data-is-pc') === '1') {
                            let opener = globalThis._rpgAgentOpenPcDetail;
                            if (typeof opener !== 'function' && typeof globalThis._rpgRefreshAgentManifest === 'function') {
                                await globalThis._rpgRefreshAgentManifest();
                                opener = globalThis._rpgAgentOpenPcDetail;
                            }
                            if (typeof opener === 'function') {
                                await opener(false);
                            }
                            return;
                        }
                        const entryId = tile.getAttribute('data-npc-entry-id');
                        if (!entryId) return;
                        const item = await loadNpcEntryByKey(entryId);
                        let opener = globalThis._rpgAgentOpenNpcDetail;
                        let parseRel = globalThis._rpgAgentParseRelationship;
                        if (typeof opener !== 'function' || typeof parseRel !== 'function') {
                            if (typeof globalThis._rpgRefreshAgentManifest === 'function') {
                                await globalThis._rpgRefreshAgentManifest();
                            }
                            opener = globalThis._rpgAgentOpenNpcDetail;
                            parseRel = globalThis._rpgAgentParseRelationship;
                        }
                        if (item && typeof opener === 'function' && typeof parseRel === 'function') {
                            await opener(item, parseRel(entryId));
                        }
                    })();
                });
            });
        };

        runtimeState.refreshImmersionView = async () => {
            const s = getSettings();
            try {
                const scene = await buildImmersionSceneState(s.currentMemo, s);
                maybeAutoGenerateImmersionSceneArt(scene, () => { void runtimeState.refreshImmersionView(); });

                if (!s.agentImmersionMode) return;
                const container = agentPanel.querySelector('#rt-agent-immersion-view');
                if (!container || agentPanel.style.display === 'none') return;
                container.innerHTML = renderImmersionViewHtml(scene);
                bindImmersionViewEvents();
            } catch (err) {
                console.error('[RPG Tracker] runtimeState.refreshImmersionView failed:', err);
                const container = agentPanel.querySelector('#rt-agent-immersion-view');
                if (container) {
                    container.innerHTML = '<div style="text-align:center;opacity:0.5;font-size:0.769em;padding:10px;">Failed to load scene view.</div>';
                }
            }
        };
        globalThis._rpgRefreshImmersionView = runtimeState.refreshImmersionView;
        globalThis._rpgCheckRealtimeSceneArt = runRealtimeSceneArtCheck;

        const syncAgentImmersionUi = () => {
            const s = getSettings();
            const immersionEl = agentPanel.querySelector('#rt-agent-immersion-view');
            const manifestEl = agentPanel.querySelector('#rt-agent-manifest-list');
            const recordsBtn = agentPanel.querySelector('#rt-agent-view-mode-records');
            const vizBtn = agentPanel.querySelector('#rt-agent-view-mode-visualization');
            const viewModeSwitch = agentPanel.querySelector('#rt-agent-view-mode-switch');
            const campaignTitle = agentPanel.querySelector('#rt-agent-campaign-header-title');
            const locationsOn = !!s.locationImages;
            let immersion = !!s.agentImmersionMode;

            if (!locationsOn) {
                if (immersion) {
                    s.agentImmersionMode = false;
                    immersion = false;
                }
                if (viewModeSwitch) viewModeSwitch.style.display = 'none';
                if (campaignTitle) campaignTitle.style.display = 'block';
            } else {
                if (viewModeSwitch) viewModeSwitch.style.display = '';
                if (campaignTitle) campaignTitle.style.display = 'none';
            }

            if (immersionEl) immersionEl.style.display = immersion ? 'flex' : 'none';
            if (manifestEl) manifestEl.style.display = immersion ? 'none' : 'flex';
            if (recordsBtn) {
                recordsBtn.classList.toggle('rt-agent-view-mode-btn-active', !immersion);
                recordsBtn.setAttribute('aria-selected', !immersion ? 'true' : 'false');
            }
            if (vizBtn) {
                vizBtn.classList.toggle('rt-agent-view-mode-btn-active', immersion);
                vizBtn.setAttribute('aria-selected', immersion ? 'true' : 'false');
            }
        };
        globalThis._rpgSyncAgentImmersionUi = syncAgentImmersionUi;


    return { syncAgentImmersionUi };
}
