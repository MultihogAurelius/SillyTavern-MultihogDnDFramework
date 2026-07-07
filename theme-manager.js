import { getSettings } from './state-manager.js';
import { sendStateRequest } from './llm-client.js';
import { saveSettings, refreshRenderedView } from './index.js';

let themeUndoStack = [];

/**
 * Injects/updates the <style id="rt-custom-theme-style"> tag in <head>
 * to set the --rt-custom-* variables on :root.
 * @param {Record<string,string>|null} vars
 */
export function applyCustomTheme(vars) {
    let tag = document.getElementById('rt-custom-theme-style');
    if (!tag) {
        tag = document.createElement('style');
        tag.id = 'rt-custom-theme-style';
        document.head.appendChild(tag);
    }

    if (!vars) {
        tag.textContent = '';
        return;
    }

    let css = ':root {\n';
    for (const [key, val] of Object.entries(vars)) {
        if (val) css += `  ${key}: ${val} !important;\n`;
    }
    css += '}';
    tag.textContent = css;
}

export async function openThemeWizard(isIteration = false) {
    const settings = getSettings();

    const systemPrompt = `You are a CSS theme designer for a dark-UI RPG tracker panel.
The user will describe a visual theme in plain language. You must output ONLY a valid JSON object with these exact keys and CSS values:

{
  "--rt-custom-bg": "<CSS background value, usually rgba()>",
  "--rt-custom-blur": "<blur() value, e.g. blur(12px)>",
  "--rt-custom-border": "<full CSS border, e.g. 1px solid #rrggbb>",
  "--rt-custom-text": "<primary text color, hex or rgba>",
  "--rt-custom-text-muted": "<secondary/dimmed text color>",
  "--rt-custom-font": "<font-family stack>",
  "--rt-custom-font-mono": "<monospace font-family stack>",
  "--rt-custom-accent": "<main accent/highlight color>",
  "--rt-custom-accent-dim": "<accent color at ~40% opacity, rgba()>",
  "--rt-custom-accent-bg": "<accent color at ~10-15% opacity, rgba()>",
  "--rt-custom-card-border": "<full CSS border for inner cards>",
  "--rt-custom-shadow": "<box-shadow value>",
  "--rt-custom-header-bg": "<header background, usually semi-transparent>",
  "--rt-custom-card-bg": "<card body background, semi-transparent>",
  "--rt-custom-card-header": "<card header background, semi-transparent>"
}

Rules:
- Output ONLY the JSON object. No markdown, no code fences, no explanation.
- All colors must be valid CSS. Prefer rgba() for backgrounds (allow transparency).
- Make the theme visually coherent and beautiful. Lean into the user's description creatively.
- Ensure text colors have sufficient contrast against the background for readability.`;

    const statusEl = document.getElementById('rpg_tracker_theme_wizard_status');
    const generateBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('rpg_tracker_theme_generate'));
    const iterateBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('rpg_tracker_theme_iterate'));

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.style.display = 'block';
        statusEl.style.color = isError ? '#ff7777' : 'inherit';
        statusEl.textContent = msg;
    };

    const promptText = /** @type {HTMLTextAreaElement} */ (document.getElementById('rpg_tracker_theme_prompt'))?.value?.trim();
    if (!promptText) {
        setStatus(isIteration ? '⚠ Please describe the changes you want.' : '⚠ Please describe a theme first.', true);
        return;
    }

    const iterationContext = (isIteration && settings.customTheme)
        ? `\n\nCURRENT THEME STATE (JSON):\n${JSON.stringify(settings.customTheme, null, 2)}\n\nUser wants to CHANGE this theme as follows: ${promptText}`
        : `\n\nUser description: ${promptText}`;

    if (generateBtn) generateBtn.disabled = true;
    if (iterateBtn) iterateBtn.disabled = true;
    setStatus(isIteration ? '⚡ Refining theme.' : '⚡ Generating theme.');

    let raw = '';
    try {
        raw = await sendStateRequest(settings, systemPrompt, iterationContext);
    } catch (err) {
        setStatus(`❌ Request failed: ${err.message}`, true);
        if (generateBtn) generateBtn.disabled = false;
        if (iterateBtn) iterateBtn.disabled = false;
        return;
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        setStatus('❌ AI did not return valid JSON. Try a different prompt or model.', true);
        if (generateBtn) generateBtn.disabled = false;
        if (iterateBtn) iterateBtn.disabled = false;
        return;
    }

    let vars;
    try {
        vars = JSON.parse(jsonMatch[0]);
    } catch (e) {
        setStatus('❌ Failed to parse AI response as JSON.', true);
        if (generateBtn) generateBtn.disabled = false;
        if (iterateBtn) iterateBtn.disabled = false;
        return;
    }

    const expected = [
        '--rt-custom-bg', '--rt-custom-blur', '--rt-custom-border',
        '--rt-custom-text', '--rt-custom-text-muted', '--rt-custom-font',
        '--rt-custom-font-mono', '--rt-custom-accent', '--rt-custom-accent-dim',
        '--rt-custom-accent-bg', '--rt-custom-card-border', '--rt-custom-shadow',
        '--rt-custom-header-bg', '--rt-custom-card-bg', '--rt-custom-card-header',
    ];
    const missing = expected.filter(k => !vars[k]);
    if (missing.length > 3) {
        setStatus(`❌ AI response is missing too many theme keys: ${missing.join(', ')}`, true);
        if (generateBtn) generateBtn.disabled = false;
        if (iterateBtn) iterateBtn.disabled = false;
        return;
    }

    if (settings.customTheme) {
        themeUndoStack.push(JSON.parse(JSON.stringify(settings.customTheme)));
        if (themeUndoStack.length > 20) themeUndoStack.shift();
    }
    settings.customTheme = vars;
    settings.trackerTheme = 'rt-theme-custom';
    saveSettings();
    applyCustomTheme(vars);

    document.querySelectorAll('.rpg-tracker-panel').forEach(p => {
        p.className = p.className.replace(/rt-theme-\S+/g, '').trim() + ' rt-theme-custom';
    });

    const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_theme_select'));
    if (sel) sel.value = 'rt-theme-custom';

    setStatus(isIteration ? '✅ Theme refined!' : '✅ Theme generated!');
    if (generateBtn) generateBtn.disabled = false;
    if (iterateBtn) iterateBtn.disabled = false;
    toastr['success'](isIteration ? 'Theme refined successfully!' : 'New theme generated and applied!', 'Theme Wizard');
    refreshSavedThemesList();
}

export function refreshSavedThemesList() {
    const settings = getSettings();
    const container = document.getElementById('rpg_tracker_saved_themes_container');
    const list = document.getElementById('rpg_tracker_saved_themes_list');
    if (!container || !list) return;

    const entries = Object.entries(settings.savedThemes || {});
    if (entries.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    list.innerHTML = '';

    entries.forEach(([name, vars]) => {
        const row = document.createElement('div');
        row.className = 'flex-container alignitemscenter gap-1';
        row.style.background = 'rgba(255,255,255,0.05)';
        row.style.padding = '4px 8px';
        row.style.borderRadius = '4px';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.style.flex = '1';
        nameSpan.style.fontSize = '0.85em';
        nameSpan.style.cursor = 'pointer';
        nameSpan.className = 'interactable';
        nameSpan.title = 'Click to load this theme';
        nameSpan.addEventListener('click', () => {
            settings.customTheme = JSON.parse(JSON.stringify(vars));
            settings.trackerTheme = 'rt-theme-custom';
            saveSettings();
            applyCustomTheme(settings.customTheme);

            // Update UI
            const sel = /** @type {HTMLSelectElement} */ (document.getElementById('rpg_tracker_theme_select'));
            if (sel) sel.value = 'rt-theme-custom';
            document.querySelectorAll('.rpg-tracker-panel').forEach(p => {
                p.className = p.className.replace(/rt-theme-\S+/g, '').trim() + ' rt-theme-custom';
            });

            const statusEl = document.getElementById('rpg_tracker_theme_wizard_status');
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.color = 'inherit';
                statusEl.textContent = `⚡ Loaded library theme: ${name}`;
            }
        });

        const delBtn = document.createElement('i');
        delBtn.className = 'fa-solid fa-trash-can interactable';
        delBtn.style.fontSize = '0.8em';
        delBtn.style.opacity = '0.5';
        delBtn.title = 'Delete theme';
        delBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete the theme "${name}"?`)) {
                delete settings.savedThemes[name];
                saveSettings();
                refreshSavedThemesList();
                toastr['info'](`Deleted theme: ${name}`, 'Theme Library');
            }
        });

        row.appendChild(nameSpan);
        row.appendChild(delBtn);
        list.appendChild(row);
    });
}

export function handleRecolor(barId, currentBg, targetEl) {
    if (!barId) return;

    document.getElementById('rt-recolor-popup')?.remove();

    const s = getSettings();
    const initialCfg = s.barColors?.[barId] ? JSON.parse(JSON.stringify(s.barColors[barId])) : null;

    let cfg = s.barColors?.[barId];
    if (!cfg) {
        const isHP = barId.endsWith(':HP') || barId.includes(':HPBAR') || barId.endsWith(':HP');
        let color = "#ff0000";
        const hexMatch = currentBg.match(/#[0-9a-fA-F]{3,8}/);
        if (hexMatch) color = hexMatch[0];

        if (isHP) {
            cfg = { mode: 'dynamic', color: '#00ffaa', color2: '#ff5555' };
        } else {
            cfg = { mode: 'solid', color: color };
        }
    } else if (typeof cfg === 'string') {
        cfg = { mode: 'solid', color: cfg };
    }

    const applyLive = () => {
        const ss = getSettings();
        if (!ss.barColors) ss.barColors = {};
        ss.barColors[barId] = { ...cfg };
        saveSettings();
        refreshRenderedView();
    };

    const popup = document.createElement('div');
    popup.id = 'rt-recolor-popup';
    popup.style.cssText = `
            position: fixed; z-index: 999999; background: #252535; border: 1px solid rgba(255,255,255,0.3);
            border-radius: 12px; padding: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.75);
            backdrop-filter: blur(16px); color: #ffffff !important; font-family: sans-serif; width: 240px;
        `;

    const renderContent = () => {
        popup.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="font-size:0.85em; font-weight:bold; opacity:0.8; letter-spacing:0.05em; text-transform:uppercase;">Recolor Bar</div>
                    
                    <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:6px; padding:2px;">
                        <button class="mode-btn" data-mode="solid" style="flex:1; border:none; background:${cfg.mode === 'solid' ? 'rgba(255,255,255,0.15)' : 'transparent'}; color:white; font-size:0.75em; padding:4px; border-radius:4px; cursor:pointer;">Solid</button>
                        <button class="mode-btn" data-mode="gradient" style="flex:1; border:none; background:${cfg.mode === 'gradient' ? 'rgba(255,255,255,0.15)' : 'transparent'}; color:white; font-size:0.75em; padding:4px; border-radius:4px; cursor:pointer;">Gradient</button>
                        <button class="mode-btn" data-mode="dynamic" style="flex:1; border:none; background:${cfg.mode === 'dynamic' ? 'rgba(255,255,255,0.15)' : 'transparent'}; color:white; font-size:0.75em; padding:4px; border-radius:4px; cursor:pointer;">Dynamic</button>
                    </div>

                    <div id="recolor-controls" style="display:flex; align-items:center; gap:10px; min-height:40px;">
                        ${cfg.mode === 'dynamic' ? `
                            <span style="font-size:0.8em; opacity:0.7;">HP-based coloring active</span>
                        ` : `
                            <input id="color1" type="color" value="${cfg.color}" style="width:40px; height:30px; border:1px solid rgba(255,255,255,0.2); border-radius:4px; cursor:pointer; background:rgba(255,255,255,0.1);" />
                            ${cfg.mode === 'gradient' ? `
                                <span style="font-size:1.2em; opacity:0.5;">&rarr;</span>
                                <input id="color2" type="color" value="${cfg.color2 || cfg.color}" style="width:40px; height:30px; border:1px solid rgba(255,255,255,0.2); border-radius:4px; cursor:pointer; background:rgba(255,255,255,0.1);" />
                            ` : ''}
                        `}
                    </div>

                    <div style="display:flex; gap:6px; margin-top:4px;">
                        <button id="recolor-ok" style="flex:1.5; padding:6px; border-radius:6px; border:none; background:var(--rt-accent-bg, #00ffaa); color:#000; font-weight:bold; cursor:pointer; font-size:0.85em;">OK</button>
                        <button id="recolor-cancel" style="flex:1; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:white; cursor:pointer; font-size:0.85em;">Cancel</button>
                        <button id="recolor-reset" style="flex:1; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:white; cursor:pointer; font-size:0.85em;" title="Reset to defaults">Reset</button>
                    </div>
                </div>
            `;

        popup.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                cfg.mode = /** @type {HTMLElement} */ (btn).dataset.mode;
                if (cfg.mode === 'gradient' && !cfg.color2) cfg.color2 = cfg.color;
                applyLive();
                renderContent();
            });
        });

        const c1 = popup.querySelector('#color1');
        const c2 = popup.querySelector('#color2');

        // --- Live preview while dragging: only patch bar color in-place, no re-render ---
        const patchBarColor = () => {
            let bg;
            if (cfg.mode === 'gradient' && cfg.color2) {
                bg = `linear-gradient(90deg,${cfg.color},${cfg.color2})`;
            } else {
                bg = cfg.color;
            }
            // Patch the actual bar fill element directly — O(1), no DOM rebuild.
            document.querySelectorAll(`.rt-hp-bar-wrap[data-recolor-id="${CSS.escape(barId)}"] .rt-hp-bar,
                                       .rt-xp-bar-wrap[data-recolor-id="${CSS.escape(barId)}"] .rt-xp-bar`)
                .forEach(bar => { bar.style.background = bg; });
        };

        if (c1) {
            c1.addEventListener('input', (e) => {
                cfg.color = /** @type {HTMLInputElement} */ (e.target).value;
                patchBarColor();
            });
            c1.addEventListener('change', () => { applyLive(); });
        }
        if (c2) {
            c2.addEventListener('input', (e) => {
                cfg.color2 = /** @type {HTMLInputElement} */ (e.target).value;
                patchBarColor();
            });
            c2.addEventListener('change', () => { applyLive(); });
        }

        popup.querySelector('#recolor-ok').addEventListener('click', () => {
            applyLive();
            popup.remove();
        });

        popup.querySelector('#recolor-cancel').addEventListener('click', () => {
            const ss = getSettings();
            if (initialCfg) ss.barColors[barId] = initialCfg;
            else delete ss.barColors[barId];
            saveSettings();
            refreshRenderedView();
            popup.remove();
        });

        popup.querySelector('#recolor-reset').addEventListener('click', () => {
            const ss = getSettings();
            if (ss.barColors) delete ss.barColors[barId];
            saveSettings();
            refreshRenderedView();
            popup.remove();
        });
    };

    renderContent();
    document.body.appendChild(popup);

    const rect = targetEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - 120;
    let top = rect.top - popup.offsetHeight - 12;
    left = Math.max(8, Math.min(left, window.innerWidth - 248));
    if (top < 8) top = rect.bottom + 12;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    const onOutside = (e) => {
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener('mousedown', onOutside);
        }
    };

    setTimeout(() => document.addEventListener('mousedown', onOutside), 50);
}

export function undoThemeChange(settings) {
    if (themeUndoStack.length === 0) {
        toastr['info']('No steps to undo.', 'Theme Wizard');
        return;
    }
    const prev = themeUndoStack.pop();
    settings.customTheme = prev;
    saveSettings();
    applyCustomTheme(prev);
    const statusEl = document.getElementById('rpg_tracker_theme_wizard_status');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = 'inherit';
        statusEl.textContent = `Undone last change. (${themeUndoStack.length} steps remaining)`;
    }
}
