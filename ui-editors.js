import { getSettings, getNpcRelationshipMaxDefault } from './state-manager.js';
import { sendStateRequest } from './llm-client.js';
import { BLOCK_ICONS, BLOCK_ORDER, DEFAULT_STOCK_PROMPTS, PAGE_SIZE, resolveTimePromptKey, resolveTimePromptDisplayTag } from './constants.js';
import { escapeHtml } from './memo-processor.js';
import { toggleDebugViewer } from './debug-viewer.js';
import { makeDraggable } from './ui-geometry.js';
import { 
    saveSettings, 
    refreshRenderedView, 
    setUse24hTime, 
    setUseDdMmYyFormat, 
    updateStatusIndicator,
    syncNpcPortraitDependentUi,
    syncTimeFormatSettingsUi,
    refreshQuestPrompt,
    syncMemoView,
    bindRenderedCardEvents,
    _sectionPages
} from './index.js';
import { renderMemoAsCards, MARKER_TYPE_MAP, getMarkerLibraryKeys } from './renderer.js';

export function handleCategorySettings(tag, targetEl) {
    const existing = document.getElementById('rt-cat-settings-popup');
    if (existing) {
        const oldTag = existing.getAttribute('data-tag');
        existing.remove();
        if (oldTag === tag) return;
    }
    const s = getSettings();
    if (!s.categoryRenderOptions) s.categoryRenderOptions = {};
    if (!s.categoryRenderOptions[tag]) {
        const noBullets = (tag === 'TIME' || tag === 'XP' || tag === 'QUESTS' || tag === 'SPELLS' || tag === 'CHARACTER' || tag === 'PARTY' || tag === 'COMBAT' || tag === 'ABILITIES');
        s.categoryRenderOptions[tag] = {
            fontSize: (tag === 'TIME' || tag === 'INVENTORY') ? 12 : 13,
            italic: false,
            bold: false,
            bullets: !noBullets,
            bulletStyle: tag === 'INVENTORY' ? '▪' : '•',
            bulletColor: 'inherit',
            fontFamily: 'inherit',
            textColor: 'inherit'
        };
    } else if (s.categoryRenderOptions[tag].bullets === undefined) {
        if (tag === 'TIME' || tag === 'XP' || tag === 'QUESTS' || tag === 'SPELLS' || tag === 'CHARACTER' || tag === 'PARTY' || tag === 'COMBAT' || tag === 'ABILITIES') {
            s.categoryRenderOptions[tag].bullets = false;
        } else {
            s.categoryRenderOptions[tag].bullets = true;
        }
    }
    const cfg = s.categoryRenderOptions[tag];
    const initialCfg = JSON.stringify(cfg);

    let applyTimeout = null;
    const applyLive = () => {
        if (applyTimeout) clearTimeout(applyTimeout);
        applyTimeout = setTimeout(() => {
            saveSettings();
            refreshRenderedView();
        }, 50);
    };

    const popup = document.createElement('div');
    popup.id = 'rt-cat-settings-popup';
    popup.setAttribute('data-tag', tag);
    popup.style.cssText = `
            position: fixed; z-index: 999999; background: #252535; border: 1px solid rgba(255,255,255,0.3);
            border-radius: 12px; padding: 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.75);
            backdrop-filter: blur(16px); color: #ffffff !important; font-family: sans-serif; width: 280px;
        `;

    const renderContent = () => {
        const symbols = ['•', '○', '●', '▪', '▫', '▶', '➤', '—', '*', '>', '✓', '⚡'];
        popup.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="font-size:0.85em; font-weight:bold; opacity:0.8; letter-spacing:0.05em; text-transform:uppercase;">${tag} Settings</div>
                    
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <span style="font-size:0.85em; opacity:0.8;">Font Size</span>
                            <span id="rt-cat-fs-val" style="font-size:0.85em; font-weight:bold; color:var(--rt-accent, #00ffaa);">${cfg.fontSize || '13'}</span>
                        </div>
                        <input id="rt-cat-fs" type="range" value="${cfg.fontSize || 13}" min="8" max="24" step="1" style="width:100%; cursor:pointer; accent-color:var(--rt-accent, #00ffaa);">
                    </div>

                    <div style="display:flex; gap:6px;">
                        <button id="rt-cat-bold" style="flex:1; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:${cfg.bold ? 'rgba(255,255,255,0.15)' : 'transparent'}; color:white; cursor:pointer; font-weight:bold;">B</button>
                        <button id="rt-cat-italic" style="flex:1; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:${cfg.italic ? 'rgba(255,255,255,0.15)' : 'transparent'}; color:white; cursor:pointer; font-style:italic;">I</button>
                        ${(tag !== 'QUESTS' && tag !== 'SPELLS' && tag !== 'CHARACTER' && tag !== 'PARTY' && tag !== 'COMBAT' && tag !== 'ABILITIES') ? `<button id="rt-cat-bullets" style="flex:2; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:${cfg.bullets ? 'rgba(255,255,255,0.15)' : 'transparent'}; color:white; cursor:pointer; font-size:0.85em;">${cfg.bullets ? 'Bullets: ON' : 'Bullets: OFF'}</button>` : ''}
                    </div>

                    <div style="display:${(cfg.bullets && tag !== 'QUESTS' && tag !== 'SPELLS' && tag !== 'CHARACTER' && tag !== 'PARTY' && tag !== 'COMBAT' && tag !== 'ABILITIES') ? 'flex' : 'none'}; flex-direction:column; gap:8px;">
                        <div style="font-size:0.75em; opacity:0.6; font-weight:bold; text-transform:uppercase;">Bullet Style</div>
                        <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:4px;">
                            ${symbols.map(s => `
                                <button class="symbol-btn" data-symbol="${s}" style="aspect-ratio:1; border:1px solid ${cfg.bulletStyle === s ? 'var(--rt-accent, #00ffaa)' : 'rgba(255,255,255,0.1)'}; background:${cfg.bulletStyle === s ? 'rgba(0,255,170,0.1)' : 'rgba(0,0,0,0.2)'}; color:white; border-radius:4px; cursor:pointer; font-size:1em;">${s}</button>
                            `).join('')}
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:4px;">
                            <span style="font-size:0.85em; opacity:0.8;">Bullet Color</span>
                            <input id="rt-cat-bullet-color" type="color" value="${cfg.bulletColor === 'inherit' ? '#ffffff' : cfg.bulletColor}" style="width:40px; height:24px; border:none; border-radius:4px; cursor:pointer; background:none;">
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <span style="font-size:0.85em; opacity:0.8;">Font Family</span>
                            <select id="rt-cat-family" style="background:#151525; color:white; border:1px solid rgba(255,255,255,0.2); border-radius:4px; font-size:0.85em; padding:2px 4px;">
                                <option value="inherit" ${cfg.fontFamily === 'inherit' ? 'selected' : ''}>Inherit</option>
                                <option value="sans-serif" ${cfg.fontFamily === 'sans-serif' ? 'selected' : ''}>Sans</option>
                                <option value="serif" ${cfg.fontFamily === 'serif' ? 'selected' : ''}>Serif</option>
                                <option value="monospace" ${cfg.fontFamily === 'monospace' ? 'selected' : ''}>Mono</option>
                            </select>
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:0.85em; opacity:0.8;">Text Color</span>
                                <button id="rt-cat-color-reset" style="font-size:0.7em; background:rgba(255,255,255,0.1); border:none; color:#aaa; border-radius:3px; padding:1px 4px; cursor:pointer;">Reset</button>
                            </div>
                            <input id="rt-cat-text-color" type="color" value="${cfg.textColor === 'inherit' ? '#ffffff' : cfg.textColor}" style="width:40px; height:24px; border:none; border-radius:4px; cursor:pointer; background:none;">
                        </div>
                    </div>

                    <div style="display:flex; gap:6px; margin-top:4px;">
                        <button id="rt-cat-ok" style="flex:1.5; padding:8px; border-radius:6px; border:none; background:var(--rt-accent-bg, #00ffaa); color:#000; font-weight:bold; cursor:pointer; font-size:0.85em;">DONE</button>
                        <button id="rt-cat-reset" style="flex:1; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:white; cursor:pointer; font-size:0.85em;">RESET</button>
                    </div>
                </div>
            `;

        popup.querySelector('#rt-cat-fs').addEventListener('mousedown', (e) => e.stopPropagation());
        popup.querySelector('#rt-cat-fs').addEventListener('input', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            const val = parseInt(target.value);
            cfg.fontSize = val;
            const display = popup.querySelector('#rt-cat-fs-val');
            if (display) display.textContent = val.toString() + 'px';
            applyLive();
        });

        popup.querySelector('#rt-cat-bold').addEventListener('click', () => {
            cfg.bold = !cfg.bold;
            applyLive();
            renderContent();
        });

        popup.querySelector('#rt-cat-italic').addEventListener('click', () => {
            cfg.italic = !cfg.italic;
            applyLive();
            renderContent();
        });

        const bulletsBtn = popup.querySelector('#rt-cat-bullets');
        if (bulletsBtn) {
            bulletsBtn.addEventListener('click', () => {
                cfg.bullets = !cfg.bullets;
                applyLive();
                renderContent();
            });
        }

        popup.querySelectorAll('.symbol-btn').forEach(btn => {
            const el = /** @type {HTMLElement} */ (btn);
            el.addEventListener('click', () => {
                cfg.bulletStyle = el.dataset.symbol;
                applyLive();
                renderContent();
            });
        });

        const colorInp = popup.querySelector('#rt-cat-bullet-color');
        if (colorInp) {
            colorInp.addEventListener('mousedown', (e) => e.stopPropagation());
            colorInp.addEventListener('input', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                cfg.bulletColor = target.value;
                applyLive();
            });
        }

        popup.querySelector('#rt-cat-family').addEventListener('change', (e) => {
            const target = /** @type {HTMLSelectElement} */ (e.target);
            cfg.fontFamily = target.value;
            applyLive();
        });

        const textColorInp = popup.querySelector('#rt-cat-text-color');
        if (textColorInp) {
            textColorInp.addEventListener('mousedown', (e) => e.stopPropagation());
            textColorInp.addEventListener('input', (e) => {
                const target = /** @type {HTMLInputElement} */ (e.target);
                cfg.textColor = target.value;
                applyLive();
            });
        }

        popup.querySelector('#rt-cat-color-reset').addEventListener('click', () => {
            cfg.textColor = 'inherit';
            applyLive();
            renderContent();
        });

        popup.querySelector('#rt-cat-ok').addEventListener('click', () => {
            popup.remove();
        });

        popup.querySelector('#rt-cat-reset').addEventListener('click', () => {
            const noBullets = (tag === 'TIME' || tag === 'XP' || tag === 'QUESTS' || tag === 'SPELLS' || tag === 'CHARACTER' || tag === 'PARTY' || tag === 'COMBAT' || tag === 'ABILITIES');
            cfg.fontSize = (tag === 'TIME' || tag === 'INVENTORY') ? 12 : 13;
            cfg.italic = false;
            cfg.bold = false;
            cfg.bullets = !noBullets;
            cfg.bulletStyle = tag === 'INVENTORY' ? '▪' : '•';
            cfg.bulletColor = 'inherit';
            cfg.fontFamily = 'inherit';
            cfg.textColor = 'inherit';
            applyLive();
            renderContent();
        });
    };

    renderContent();
    document.body.appendChild(popup);

    const rect = targetEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - 140;
    let top = rect.bottom + 10;
    left = Math.max(8, Math.min(left, window.innerWidth - 288));
    if (top + 300 > window.innerHeight) top = rect.top - 300;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    const onOutside = (e) => {
        if (!popup.contains(e.target) && !targetEl.contains(e.target)) {
            popup.remove();
            document.removeEventListener('mouseup', onOutside);
        }
    };
    setTimeout(() => document.addEventListener('mouseup', onOutside), 50);
}

function buildExistingFieldsContextForAi(settings) {
    const stock = ['COMBAT', 'CHARACTER', 'PARTY', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME'].map(t => `[${t}]`);
    const custom = (settings.customFields || []).map(f => `[${f.tag.toUpperCase()}] (${f.label})`);
    return `Currently configured modules/sections:\n- Built-in (Stock):\n  ${stock.join('\n  ')}\n- Custom Modules:\n  ${custom.length ? custom.join('\n  ') : '(none yet)'}`;
}

function parseAiJsonResponse(result) {
    const match = result.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not contain a JSON block');
    return JSON.parse(match[0]);
}

async function showAiCustomModulePreviewPopup(parsed, settings) {
    const { Popup } = SillyTavern.getContext();
    const isEditing = (settings.customFields || []).some(f => f.tag.toUpperCase() === parsed.tag.toUpperCase());
    const actionLabel = isEditing ? 'Overwrite Existing' : 'Create Custom Module';

    const body = `
        <div class="flex-container flexFlowColumn gap-1" style="font-family:sans-serif; text-align:left; max-width:480px;">
            <div style="font-size:0.9em; line-height:1.4; opacity:0.8;">AI generated the following custom module structure. Confirm to apply it to your settings.</div>
            <div class="flex-container gap-1 alignitemscenter" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); margin-top:4px;">
                <span style="font-size:1.6em;">${escapeHtml(parsed.icon || '📄')}</span>
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:1.1em;">${escapeHtml(parsed.label || parsed.tag)}</div>
                    <div style="font-family:monospace; font-size:0.85em; opacity:0.6;">[${escapeHtml(parsed.tag.toUpperCase())}]</div>
                </div>
            </div>
            <div style="font-size:0.8em; font-weight:bold; text-transform:uppercase; margin-top:8px; opacity:0.5;">Prompt Instructions</div>
            <textarea readonly class="text_pole" rows="5" style="font-size:11px; width:100%; resize:vertical; background:rgba(0,0,0,0.1);">${escapeHtml(parsed.prompt)}</textarea>
            
            <div style="font-size:0.8em; font-weight:bold; text-transform:uppercase; margin-top:6px; opacity:0.5;">Sandbox Preview Formatting</div>
            <textarea readonly class="text_pole" rows="3" style="font-family:monospace; font-size:11px; width:100%; resize:vertical; background:rgba(0,0,0,0.1);">${escapeHtml(parsed.template)}</textarea>
        </div>
    `;

    const choice = await Popup.show.confirm('🤖 AI Custom Module Preview', body, {
        okButton: actionLabel,
        cancelButton: 'Discard Revise'
    });
    return choice === 1 ? parsed : null;
}

async function promptForAiModuleEditDescription(moduleLabel) {
    const { Popup } = SillyTavern.getContext();
    const body = `
        <div style="display:flex; flex-direction:column; gap:8px; min-width:360px; text-align:left;">
            <div style="font-size:12px; opacity:0.8; line-height:1.4;">
                Describe the changes you want to make to the <b>${escapeHtml(moduleLabel)}</b> instructions in plain language.
            </div>
            <textarea id="rt_pe_edit_desc" class="text_pole" rows="5" style="width:100%; resize:vertical;" placeholder="Example: Make it also track a progress ratio for quests, showing 'Progress: 2/5 collected'. Add a wallet badge for gold, silver, bronze coins."></textarea>
        </div>
    `;
    const ok = await Popup.show.confirm('🤖 Describe Revision for AI', body, {
        okButton: 'Revise Instructions',
        cancelButton: 'Cancel'
    });
    if (ok !== 1) return null;
    return /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_pe_edit_desc'))?.value?.trim() || null;
}

async function showAiStockPromptPreviewPopup(displayTag, promptText) {
    const { Popup } = SillyTavern.getContext();
    const body = `
        <div class="flex-container flexFlowColumn gap-1" style="font-family:sans-serif; text-align:left; max-width:480px;">
            <div style="font-size:0.9em; line-height:1.4; opacity:0.8;">Review the revised prompt instructions generated by AI. Confirm to apply them to your editor.</div>
            <div style="font-size:0.8em; font-weight:bold; text-transform:uppercase; margin-top:8px; opacity:0.5;">Prompt Instructions</div>
            <textarea readonly class="text_pole" rows="12" style="font-size:11px; width:100%; resize:vertical; background:rgba(0,0,0,0.1);">${escapeHtml(promptText)}</textarea>
        </div>
    `;
    const choice = await Popup.show.confirm(`🤖 AI Prompt Preview [${displayTag}]`, body, {
        okButton: 'Apply to Editor',
        cancelButton: 'Discard Changes'
    });
    return choice === 1 ? promptText : null;
}

function buildAiCustomModuleRules(existingTags, editingTag = null) {
    const filter = editingTag ? existingTags.filter(t => t.toUpperCase() !== editingTag.toUpperCase()) : existingTags;
    const list = filter.map(t => `[${t.toUpperCase()}]`).join(', ');

    const markerExamples = getMarkerLibraryKeys().map(key => {
        const rule = MARKER_TYPE_MAP[key];
        const example = rule.example || 'Example text';
        return `  - ((${key})) ${example}`;
    }).join('\n');

    return `Instructions:
- Output ONLY the JSON block. Do NOT include markdown fences, preambles, or postscripts.
- The tag name must be short, alpha-numeric, uppercase, and UNIQUE. Avoid clashes with existing custom tags: ${list || '(none)'} or stock tags: [COMBAT], [CHARACTER], [PARTY], [INVENTORY], [ABILITIES], [SPELLS], [XP], [TIME].
- Choose a beautiful, fitting single emoji icon.
- Write precise, concise instructions for the tracking model. Explain what state properties/values to increment, decrement, or add.
- Define a realistic, matching sample block template in the "template" key matching your instructions. Use inline rendering tags for visuals:
${markerExamples}`;
}

async function runAiEditCustomModule(settings, field, description) {
    const existingTags = (settings.customFields || []).map(f => f.tag.toUpperCase());
    const rules = buildAiCustomModuleRules(existingTags, field.tag);
    const existingFieldsContext = buildExistingFieldsContextForAi(settings);

    const systemPrompt = `You are a custom plugin/module creator for a state tracking framework. Based on the user's description, write a JSON definition for a custom tracking module.

Output ONLY a single valid JSON block with these exact keys:
{
  "icon": "<single emoji icon>",
  "tag": "<short uppercase alpha-numeric tag, e.g. FACTION>",
  "label": "<display name label, e.g. Faction Standing>",
  "prompt": "<detailed prompt instructions explaining what variables the AI should track, how to update them, and their formatting layout>",
  "template": "<sample output rendering using inline rendering tags>"
}

${rules}`;

    const context = `${existingFieldsContext}

CURRENT STATE:
Icon:  ${field.icon || '📄'}
Tag:   ${field.tag.toUpperCase()}
Label: ${field.label || field.tag}
Prompt:
${field.prompt}
Template:
${field.template}

USER REQUESTED CHANGES:
${description}`;

    const raw = await sendStateRequest(settings, systemPrompt, context);
    const parsed = parseAiJsonResponse(raw);
    return await showAiCustomModulePreviewPopup(parsed, settings);
}

async function runAiEditStockModulePrompt(settings, modKey, blockTag, displayTag, currentPrompt, description) {
    const existingFieldsContext = buildExistingFieldsContextForAi(settings);
    const systemPrompt = `You are an expert system-prompt designer for a RPG tracking system. Your task is to revise the instruction prompt for the stock module [${displayTag}].

Your revision must:
1. Explain what variables to track, when to increment/decrement them, and how to format their values.
2. Rely heavily on the user's requested changes to shape the rules.
3. Keep instructions concise, direct, and authoritative (written for an AI system).
4. Do NOT output any markdown fences, HTML wrapper tags, or code blocks. Output the raw text of the revised instructions ONLY.`;

    const context = `${existingFieldsContext}

CURRENT PROMPT FOR [${displayTag}]:
${currentPrompt}

USER REQUESTED REVISIONS:
${description}`;

    const raw = await sendStateRequest(settings, systemPrompt, context);
    const parsedText = (raw || '').replace(/```[\s\S]*?```/g, '').trim();
    if (!parsedText) return null;
    return await showAiStockPromptPreviewPopup(displayTag, parsedText);
}

function buildRowTypeSelect(selectedVal) {
    const options = [
        ['Text (Plain text)', 'text'],
        ['Text Area (Multi-line)', 'textarea'],
        ['Number Counter', 'number'],
        ['HP Bar (Crimson)', 'hpbar'],
        ['Blue Mana Bar', 'manabar'],
        ['XP Progress Bar (Gold)', 'xpbar'],
        ['Status Pills (Comma-separated)', 'pills'],
        ['Coins Badge (Economy)', 'coins'],
        ['Quest Objectives (List)', 'objectives'],
    ];
    return `<select class="rt-cfe-row-type-select text_pole" style="font-size:12px; height:24px; padding:2px; width:130px;">` +
        options.map(([lbl, val]) => `<option value="${val}"${val === selectedVal ? ' selected' : ''}>${lbl}</option>`).join('') +
        `</select>`;
}

export function openCustomFieldEditor(index) {
    const isSmallScreen = window.innerWidth <= 700;
    const s = getSettings();
    const field = s.customFields[index];
    const overlay = document.createElement('div');
    overlay.id = 'rt_cfe_overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);backdrop-filter:blur(2px);z-index:10000000;display:none;align-items:center;justify-content:center;overflow-y:auto;';

    overlay.innerHTML = `
            <div id="rt_cfe_modal" class="popup shadowBase" style="
                width: min(540px, 94vw);
                height: ${isSmallScreen ? '85vh' : 'auto'};
                max-height: ${isSmallScreen ? '90vh' : '850px'};
                margin: auto;
                display: flex;
                flex-direction: column;
                padding: 0;
                overflow: hidden;
            ">
                <div class="popup-header">
                    <h3 class="margin0" style="font-size:14px; flex:1;">Custom Module Editor</h3>
                    <div id="rt_cfe_close" class="popup-close interactable" title="Close"><i class="fa-solid fa-times"></i></div>
                </div>
                <div class="popup-body flex-container flexFlowColumn gap-1" style="padding:10px 14px; overflow-y:auto; flex:1;">
                    <!-- Identity row -->
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                        <input type="text" id="rt_cfe_icon" class="text_pole" style="width:44px;text-align:center;" title="Icon (emoji)">
                        <input type="text" id="rt_cfe_tag"  class="text_pole" style="width:100px;font-family:monospace;" placeholder="TAG">
                        <input type="text" id="rt_cfe_label" class="text_pole" style="flex:1;min-width:80px;" placeholder="Display label">
                    </div>

                    <!-- Layout Options -->
                    <div style="display:flex; align-items:center; gap:10px; margin-top:4px; padding:2px 4px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:12px; font-weight:bold; opacity:0.8;">Pagination Threshold:</span>
                            <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt_cfe_pagesize" class="text_pole" style="width:50px; height:24px; text-align:center;" min="1" max="99" title="How many items to show before adding page buttons">
                            <span style="font-size:11px; opacity:0.6;">entries</span>
                        </div>
                    </div>

                    <!-- AI Instructions -->
                    <div style="margin-top:12px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                            <i class="fa-solid fa-robot" style="opacity:0.7;"></i>
                            <b style="font-size:12px;">AI Instructions</b>
                        </div>
                        <textarea id="rt_cfe_prompt" class="text_pole" rows="10" style="resize:vertical; width:100%;" placeholder="What should the AI track and in what format? Define the instructions. You can use the box below with the live preview (desktop only for now!) to create and paste a formatting instructions template here.&#10;&#10;Example: Track the Limit Break charge level of the protagonist. Increment Times Used on use; increase level by 1 on each use.&#10;&#10;Format:&#10;[LIMIT BREAK]&#10;((XPBAR)) Limit Break: 10/100 Level 4&#10;Times Used: 3&#10;[/LIMIT BREAK]"></textarea>
                    </div>

                    <!-- Testing Sandbox -->
                    <div style="margin-top:15px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                             <b style="font-size:13px;">Testing Sandbox (desktop only) <i class="fa-solid fa-circle-question" style="opacity:0.5; cursor:help; font-size:11px;" title="This box is ONLY for testing how the UI renders your formatting. Nothing from this box is sent to the AI. You must manually include any formatting examples in the 'AI Instructions' box above."></i></b>
                        </div>
                        <textarea id="rt_cfe_template" class="text_pole" rows="8" style="resize:vertical; width:100%; font-family:monospace; font-size:12px;" placeholder="Example:\n((PILLS)) Skills: Stealth, Deception\nHP: 10/100"></textarea>
                    </div>
                </div>
                <!-- Footer -->
                <div class="popup-footer flex-container gap-1 justifycontentend" style="padding:8px 14px; border-top:1px solid rgba(255,255,255,0.08); flex-shrink:0;">
                    <button id="rt_cfe_delete" class="menu_button interactable" style="color:#ff5555;font-size:12px;"><i class="fa-solid fa-trash"></i> Delete</button>
                    <button id="rt_cfe_export" class="menu_button interactable" style="font-size:12px;margin-right:auto;" title="Export this module as a shareable code"><i class="fa-solid fa-file-export"></i> Export</button>
                    <button id="rt_cfe_edit_ai" class="menu_button interactable" style="font-size:12px; background:rgba(180,100,255,0.15); border-color:rgba(180,100,255,0.4);" title="Describe changes and let AI revise this module"><i class="fa-solid fa-wand-magic-sparkles"></i> Edit with AI</button>
                    <button id="rt_cfe_cancel" class="menu_button interactable" style="font-size:12px;">Cancel</button>
                    <button id="rt_cfe_save" class="menu_button interactable" style="font-size:12px;">Save Changes</button>
                </div>
            </div>
            <!-- Floating preview -->
            <div id="rt_cfe_preview" class="rpg-tracker-panel" style="margin:0;display:none;flex-direction:column;cursor:default;height:auto;min-height:44px;width:300px;position:fixed;">
                <div id="rt_cfe_preview_header" class="rpg-tracker-header" style="cursor:move;user-select:none;font-size:0.75em;opacity:0.7;padding:5px 10px;"><i class="fa-solid fa-grip-lines" style="margin-right:6px;"></i>UI Live Preview</div>
                <div id="rt_cfe_preview_view" class="rpg-tracker-render-view"></div>
            </div>
        `;
    document.body.appendChild(overlay);
    overlay.addEventListener('mousedown', e => e.stopPropagation());
    overlay.addEventListener('click', e => e.stopPropagation());

    const iconEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_cfe_icon'));
    const tagEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_cfe_tag'));
    const labelEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_cfe_label'));
    const promptEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_cfe_prompt'));
    const templateEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_cfe_template'));
    const pageSizeEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_cfe_pagesize'));

    iconEl.value = field.icon || '📄';
    tagEl.value = field.tag.toUpperCase();
    labelEl.value = field.label || field.tag;
    promptEl.value = field.prompt || '';
    templateEl.value = field.template || '';
    pageSizeEl.value = String(s.modulePageSizes?.[field.tag.toUpperCase()] ?? PAGE_SIZE);

    overlay.style.display = 'flex';

    // Preview HUD positioning logic
    let destroyPreviewDraggable = null;
    const previewEl = document.getElementById('rt_cfe_preview');
    if (previewEl && !isSmallScreen) {
        previewEl.style.display = 'flex';
        const modalRect = document.getElementById('rt_cfe_modal').getBoundingClientRect();
        previewEl.style.left = (modalRect.right + 20) + 'px';
        previewEl.style.top = modalRect.top + 'px';
        const previewHeader = document.getElementById('rt_cfe_preview_header');
        if (previewHeader) {
            destroyPreviewDraggable = makeDraggable(previewEl, previewHeader);
        }
    }

    const renderPreviewInto = (targetEl) => {
        const renderView = targetEl || document.getElementById('rt_cfe_preview_view');
        if (!renderView) return;

        const testContent = templateEl.value || 'Nothing in testing sandbox';
        const previewTag = '__PREVIEW__';
        const fakeMemo = `[${previewTag}]\n${testContent}\n[/${previewTag}]`;

        const ghostField = {
            tag: previewTag,
            label: labelEl.value || tagEl.value || 'Preview',
            icon: iconEl.value || '📄',
            template: templateEl.value,
            prompt: '',
            enabled: true
        };
        const savedCustomFields = s.customFields;
        s.customFields = [...savedCustomFields, ghostField];
        if (!s.modulePageSizes) s.modulePageSizes = {};
        const savedPageSize = s.modulePageSizes[previewTag];
        s.modulePageSizes[previewTag] = 99999;
        try {
            renderView.innerHTML = renderMemoAsCards(fakeMemo, previewTag, _sectionPages);
            bindRenderedCardEvents(renderView, fakeMemo, true, () => renderPreviewInto(targetEl));
        } finally {
            s.customFields = savedCustomFields;
            if (savedPageSize === undefined) {
                delete s.modulePageSizes[previewTag];
            } else {
                s.modulePageSizes[previewTag] = savedPageSize;
            }
        }
    };

    const updatePreview = () => renderPreviewInto(null);

    let previewTimer;
    let bgRefreshTimer;
    const schedulePreview = () => {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(updatePreview, 180);
        clearTimeout(bgRefreshTimer);
        bgRefreshTimer = setTimeout(refreshRenderedView, 300);
    };

    templateEl.oninput = schedulePreview;
    iconEl.oninput = schedulePreview;
    labelEl.oninput = schedulePreview;
    tagEl.oninput = schedulePreview;
    updatePreview();

    const close = () => {
        if (destroyPreviewDraggable) destroyPreviewDraggable();
        overlay.remove();
    };

    document.getElementById('rt_cfe_save').onclick = () => {
        const rawTag = tagEl.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (!rawTag) { toastr['warning']('Module Tag cannot be empty.'); return; }
        const rawLabel = labelEl.value.trim();

        const duplicate = s.customFields.some((f, i) => i !== index && f.tag.toUpperCase() === rawTag);
        if (duplicate) {
            toastr['warning'](`A module with tag [${rawTag}] already exists.`);
            return;
        }

        const oldTag = field.tag.toUpperCase();
        field.icon = iconEl.value.trim() || '📄';
        field.tag = rawTag;
        field.label = rawLabel || rawTag;
        field.prompt = promptEl.value;
        field.template = templateEl.value;

        if (!s.modulePageSizes) s.modulePageSizes = {};
        const ps = parseInt(pageSizeEl.value, 10);
        if (!isNaN(ps) && ps >= 1) {
            s.modulePageSizes[rawTag] = ps;
        }

        if (oldTag !== rawTag) {
            if (s.blockOrder) {
                const idx = s.blockOrder.indexOf(oldTag);
                if (idx !== -1) s.blockOrder[idx] = rawTag;
            }
            if (s.modulePageSizes && s.modulePageSizes[oldTag]) {
                s.modulePageSizes[rawTag] = s.modulePageSizes[oldTag];
                delete s.modulePageSizes[oldTag];
            }
            // Migrate any category render options
            if (s.categoryRenderOptions && s.categoryRenderOptions[oldTag]) {
                s.categoryRenderOptions[rawTag] = s.categoryRenderOptions[oldTag];
                delete s.categoryRenderOptions[oldTag];
            }
        }

        saveSettings();
        refreshOrderList();
        refreshRenderedView();
        toastr['success'](`Module "${field.label}" updated.`);
        close();
    };

    document.getElementById('rt_cfe_delete').onclick = () => {
        if (confirm(`Delete the custom module "${field.label || field.tag}"? This cannot be undone.`)) {
            s.customFields.splice(index, 1);
            if (s.blockOrder) {
                s.blockOrder = s.blockOrder.filter(t => t.toUpperCase() !== field.tag.toUpperCase());
            }
            saveSettings();
            refreshOrderList();
            refreshRenderedView();
            toastr['info'](`Module "${field.label}" deleted.`);
            close();
        }
    };

    document.getElementById('rt_cfe_cancel').onclick = close;
    document.getElementById('rt_cfe_close').onclick = close;
    document.getElementById('rpg-tracker-debug-btn').onclick = () => toggleDebugViewer();
    document.getElementById('rt_cfe_export').onclick = () => exportModules([field]);
    document.getElementById('rt_cfe_edit_ai').onclick = async () => {
        const description = await promptForAiModuleEditDescription(`[${field.tag}] ${field.label || field.tag}`);
        if (!description) return;
        try {
            const parsed = await runAiEditCustomModule(s, field, description);
            if (!parsed) return;
            iconEl.value = parsed.icon;
            tagEl.value = parsed.tag;
            labelEl.value = parsed.label;
            promptEl.value = parsed.prompt;
            templateEl.value = parsed.template;
            schedulePreview();
            toastr['success'](`Module "${parsed.label}" revised. Review and click Save Changes.`, 'AI Module Editor');
        } catch (err) {
            console.error('[RPG Tracker] AI Module Editor error:', err);
            toastr['error'](`Failed to edit module: ${err.message}`, 'AI Module Editor');
        }
    };
}

export function openPromptEditor(blockTag, title, currentText, defaultText, onSave, promptModKey) {
    let overlay = document.getElementById('rt_pe_overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'rt_pe_overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        overlay.style.zIndex = '10000000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.innerHTML = `
                <div class="popup shadowBase" style="min-width: 400px; max-width: 600px;">
                    <div class="popup-header">
                        <h3 class="margin0" id="rt_pe_title">Edit Prompt</h3>
                        <div id="rt_pe_close" class="popup-close interactable" title="Close"><i class="fa-solid fa-times"></i></div>
                    </div>
                    <div class="popup-body flex-container flexFlowColumn gap-1" style="padding: 10px;">
                        <!-- Layout Options -->
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:0 4px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:12px; font-weight:bold; opacity:0.8;">Pagination Threshold:</span>
                                <input type="text" inputmode="numeric" pattern="[0-9]*" id="rt_pe_pagesize" class="text_pole" style="width:50px; height:24px; text-align:center;" min="1" max="99" title="How many items to show before adding page buttons">
                                <span style="font-size:11px; opacity:0.6;">entries</span>
                            </div>
                        </div>
                        <textarea id="rt_pe_text" class="text_pole" rows="10" style="width: 100%; resize: vertical;"></textarea>
                        <div class="flex-container gap-1 justifycontentend">
                            <button id="rt_pe_edit_ai" class="menu_button interactable" style="background:rgba(180,100,255,0.15); border-color:rgba(180,100,255,0.4);"><i class="fa-solid fa-wand-magic-sparkles"></i> Edit with AI</button>
                            <button id="rt_pe_reset" class="menu_button interactable" style="margin-right: auto;"><i class="fa-solid fa-arrow-rotate-left"></i> Reset</button>
                            <button id="rt_pe_cancel" class="menu_button interactable">Cancel</button>
                            <button id="rt_pe_save" class="menu_button interactable">Save Changes</button>
                        </div>
                    </div>
                </div>
            `;
        document.body.appendChild(overlay);
    }

    const titleEl = document.getElementById('rt_pe_title');
    const textEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_pe_text'));
    const pageSizeEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_pe_pagesize'));
    const saveBtn = document.getElementById('rt_pe_save');
    const resetBtn = document.getElementById('rt_pe_reset');
    const closeBtn = document.getElementById('rt_pe_close');
    const cancelBtn = document.getElementById('rt_pe_cancel');

    const modKey = promptModKey || blockTag.toLowerCase();
    const s = getSettings();
    pageSizeEl.value = String(s.modulePageSizes?.[blockTag.toUpperCase()] ?? (blockTag.toUpperCase() === 'SPELLS' ? 5 : PAGE_SIZE));
    pageSizeEl.oninput = () => {
        if (!s.modulePageSizes) s.modulePageSizes = {};
        const val = parseInt(String(pageSizeEl.value), 10);
        if (!isNaN(val) && val >= 1) {
            s.modulePageSizes[blockTag.toUpperCase()] = val;
            saveSettings();
            refreshRenderedView();
        }
    };

    const close = () => { overlay.style.display = 'none'; };

    titleEl.textContent = title;
    textEl.value = currentText;
    overlay.style.display = 'flex';

    const saveHandler = () => {
        if (!s.modulePageSizes) s.modulePageSizes = {};
        const ps = parseInt(String(pageSizeEl.value), 10);
        if (!isNaN(ps) && ps >= 1) {
            s.modulePageSizes[blockTag.toUpperCase()] = ps;
        }
        saveSettings();
        onSave(textEl.value);
        close();
    };

    const resetHandler = () => {
        if (confirm("Reset this prompt to the factory default?")) {
            textEl.value = defaultText;
        }
    };

    const editAiHandler = async () => {
        const displayTag = blockTag === 'TIME' ? resolveTimePromptDisplayTag(modKey) : blockTag;
        const description = await promptForAiModuleEditDescription(`[${displayTag}]`);
        if (!description) return;
        try {
            const parsed = await runAiEditStockModulePrompt(s, modKey, blockTag, displayTag, textEl.value, description);
            if (!parsed) return;
            textEl.value = parsed.prompt;
            toastr['success'](`[${displayTag}] prompt revised. Review and click Save Changes.`, 'AI Module Editor');
        } catch (err) {
            console.error('[RPG Tracker] AI Module Editor error:', err);
            toastr['error'](`Failed to edit prompt: ${err.message}`, 'AI Module Editor');
        }
    };

    saveBtn.onclick = saveHandler;
    resetBtn.onclick = resetHandler;
    document.getElementById('rt_pe_edit_ai').onclick = editAiHandler;
    document.getElementById('rt_pe_close').onclick = close;
    document.getElementById('rt_pe_cancel').onclick = close;
}

export function exportModules(fields) {
    if (!fields || fields.length === 0) {
        toastr['warning']('No modules specified to export.', 'Multihog Framework');
        return;
    }
    const cleanFields = fields.map(f => ({
        icon: f.icon,
        tag: f.tag.toUpperCase(),
        label: f.label || f.tag,
        prompt: f.prompt || '',
        template: f.template || '',
    }));
    const exportObj = {
        format: 'multihog-custom-module',
        version: 1,
        exportedAt: new Date().toISOString(),
        modules: cleanFields,
    };
    openShareModal(JSON.stringify(exportObj, null, 2));
}

function openShareModal(jsonString) {
    const { Popup } = SillyTavern.getContext();
    const escaped = jsonString
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const content = `
            <div style="display:flex; flex-direction:column; gap:8px; min-width:360px;">
                <p style="margin:0; font-size:12px; opacity:0.7;">
                    Copy this code and share it anywhere. Others can paste it using the <b>Import</b> button.
                </p>
                <textarea id="rt_share_blob" readonly rows="12" class="text_pole"
                    style="font-family:monospace; font-size:11px; resize:vertical; width:100%;"
                >${escaped}</textarea>
                <div style="display:flex; gap:8px;">
                    <button id="rt_share_copy" class="menu_button interactable" style="flex:1;">
                        <i class="fa-solid fa-copy"></i> Copy to Clipboard
                    </button>
                    <button id="rt_share_download" class="menu_button interactable" style="flex:1;">
                        <i class="fa-solid fa-file-download"></i> Export .json
                    </button>
                </div>
            </div>
        `;
    Popup.show.confirm('📤 Share Custom Module', content, {
        okButton: 'Done',
        cancelButton: false,
    });
    setTimeout(() => {
        const copyBtn = document.getElementById('rt_share_copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(jsonString);
                        toastr['success']('Module code copied to clipboard!', 'Multihog Framework');
                        return;
                    }

                    const ta = document.createElement('textarea');
                    ta.value = jsonString;
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    ta.style.top = '0';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    ta.setSelectionRange(0, 99999);

                    const success = document.execCommand('copy');
                    document.body.removeChild(ta);

                    if (success) {
                        toastr['success']('Module code copied to clipboard!', 'Multihog Framework');
                    } else {
                        throw new Error('execCommand returned false');
                    }
                } catch (err) {
                    console.error('[Multihog Framework] clipboard copy failed:', err);
                    toastr['error']('Could not copy automatically. Please select the text manually.', 'Multihog Framework');
                }
            });
        }

        const downloadBtn = document.getElementById('rt_share_download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `multihog_module_${new Date().getTime()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }
    }, 50);
}

export async function importModulesFromJson(jsonString) {
    const STOCK_TAGS = new Set(['COMBAT', 'CHARACTER', 'PARTY', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME']);

    let parsed;
    try {
        parsed = JSON.parse(jsonString.trim());
    } catch {
        toastr['error']('Invalid JSON. Please paste a valid module export.', 'Multihog Framework');
        return;
    }

    if (parsed?.format !== 'multihog-custom-module' && parsed?.format !== 'fatbody-custom-module' || !Array.isArray(parsed?.modules)) {
        toastr['error']("This doesn't look like a Multihog module export.", 'Multihog Framework');
        return;
    }

    const incoming = parsed.modules.filter(m => {
        if (!m.tag || typeof m.tag !== 'string') return false;
        m.tag = m.tag.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase();
        return m.tag.length > 0;
    });

    if (incoming.length === 0) {
        toastr['warning']('No valid modules found in the export.', 'Multihog Framework');
        return;
    }

    const s = getSettings();
    const existingTags = new Set((s.customFields || []).map(f => f.tag.toUpperCase()));

    const stockConflicts = incoming.filter(m => STOCK_TAGS.has(m.tag));
    if (stockConflicts.length > 0) {
        toastr['error'](
            `Cannot import: [${stockConflicts.map(m => m.tag).join('], [')}] clash with built-in stock modules.`,
            'Multihog Framework'
        );
        return;
    }

    const softConflicts = incoming.filter(m => existingTags.has(m.tag));
    let overwriteConflicts = false;

    if (softConflicts.length > 0) {
        const { Popup } = SillyTavern.getContext();
        const tagList = softConflicts.map(m => `<b>[${m.tag}]</b>`).join(', ');
        const choice = await Popup.show.confirm(
            '⚠️ Import Conflicts',
            `<p>${softConflicts.length} module(s) already exist: ${tagList}</p><p>What would you like to do?</p>`,
            { okButton: 'Overwrite Existing', cancelButton: 'Skip Conflicts' }
        );
        if (choice === null || choice === undefined) return;
        overwriteConflicts = (choice === 1);
    }

    if (!s.blockOrder) s.blockOrder = ['COMBAT', 'CHARACTER', 'PARTY', 'INVENTORY', 'ABILITIES', 'SPELLS', 'XP', 'TIME'];

    let importedCount = 0;
    for (const m of incoming) {
        const isConflict = existingTags.has(m.tag);
        if (isConflict && !overwriteConflicts) continue;

        const newField = {
            icon: m.icon || '📄',
            tag: m.tag,
            label: m.label || m.tag,
            prompt: m.prompt || '',
            template: '',
            enabled: true,
        };

        if (isConflict) {
            const idx = s.customFields.findIndex(f => f.tag.toUpperCase() === m.tag);
            if (idx !== -1) s.customFields[idx] = newField;
        } else {
            s.customFields.push(newField);
            if (!s.blockOrder.includes(m.tag)) s.blockOrder.push(m.tag);
        }
        importedCount++;
    }

    if (importedCount === 0) {
        toastr['info']('No modules were imported (all conflicts were skipped).', 'Multihog Framework');
        return;
    }

    saveSettings();
    refreshOrderList();
    syncMemoView();
    toastr['success'](`Imported ${importedCount} custom module(s).`, 'Multihog Framework');
}

export function syncSettingsAndUI(updateFn) {
    const fresh = getSettings();
    updateFn(fresh);

    const rngHybrid = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_rng_hybrid'));
    const rngLegacy = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_rng_legacy'));
    const rngNone = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_rng_none'));
    const questsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_sysprompt_mod_quests'));
    const deadlinesCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_deadlines'));
    const frustrationCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_frustration'));

    if (rngHybrid && rngLegacy && rngNone) {
        rngHybrid.checked = fresh.rngEnabled && !!fresh.diceFunctionTool;
        rngLegacy.checked = fresh.rngEnabled && !fresh.diceFunctionTool;
        rngNone.checked = !fresh.rngEnabled;
    }
    if (questsCb) questsCb.checked = fresh.syspromptModules?.quests !== false;
    if (deadlinesCb) deadlinesCb.checked = !!fresh.syspromptModules?.questsDeadlines;
    if (frustrationCb) frustrationCb.checked = !!fresh.syspromptModules?.questsFrustration;
    const frustrationWrapEl = /** @type {HTMLElement|null} */ (document.getElementById('rpg_quests_frustration_wrap'));
    if (frustrationWrapEl) frustrationWrapEl.style.display = !!fresh.syspromptModules?.questsDeadlines ? '' : 'none';
    const difficultyCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_difficulty'));
    if (difficultyCb) difficultyCb.checked = !!fresh.syspromptModules?.questsDifficulty;
    const showArchiveCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_quests_show_archive'));
    if (showArchiveCb) showArchiveCb.checked = fresh.syspromptModules?.questsShowArchive !== false;

    const mods = { 'loot': '#rpg_sysprompt_mod_loot', 'random_events': '#rpg_sysprompt_mod_random_events', 'resting': '#rpg_sysprompt_mod_resting' };
    for (const [key, id] of Object.entries(mods)) {
        const cb = /** @type {HTMLInputElement|null} */ (document.getElementById(id.replace('#', '')));
        if (cb) cb.checked = !!fresh.syspromptModules?.[key];
    }

    const relBarsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_npc_rel_bars'));
    if (relBarsCb) relBarsCb.checked = !!fresh.npcRelationshipBars;
    const syspromptRelBarsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_sysprompt_mod_npc_rel_bars'));
    if (syspromptRelBarsCb) syspromptRelBarsCb.checked = !!fresh.npcRelationshipBars;
    const onboardingRelBarsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rt_onboarding_mod_npc_rel_bars'));
    if (onboardingRelBarsCb) onboardingRelBarsCb.checked = !!fresh.npcRelationshipBars;
    const relToastUICb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_npc_rel_toast'));
    if (relToastUICb) relToastUICb.checked = fresh.npcRelationshipToast !== false;
    const relMaxDefaultUICb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_npc_rel_max_default'));
    if (relMaxDefaultUICb) relMaxDefaultUICb.value = String(getNpcRelationshipMaxDefault(fresh));
    const npcPortraitsCb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_npc_portraits'));
    if (npcPortraitsCb) npcPortraitsCb.checked = fresh.npcPortraits !== false;
    syncNpcPortraitDependentUi(fresh);
    const stateSwipeRollbackUICb = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_state_swipe_rollback'));
    if (stateSwipeRollbackUICb) stateSwipeRollbackUICb.checked = fresh.stateTrackerSwipeRollback !== false;

    const customSyspromptEl = /** @type {HTMLInputElement|null} */ (document.getElementById('rpg_tracker_custom_sysprompt'));
    if (customSyspromptEl) customSyspromptEl.checked = !!fresh.customSysprompt;
    syncTimeFormatSettingsUi(fresh);
    const narratorBlockEl = document.getElementById('rpg_narrator_config_block');
    if (narratorBlockEl) narratorBlockEl.style.display = !!fresh.customSysprompt ? 'none' : '';

    saveSettings();

    refreshQuestPrompt(fresh);
    refreshOrderList();
    saveSettings();
    if (!document.querySelector('.rt-empty')) {
        refreshRenderedView();
    }
}

export function refreshOrderList() {
    const s = getSettings();
    const list = document.getElementById('rpg_tracker_order_list');
    if (!list) return;

    list.innerHTML = '';

    const getIcon = (tag) => {
        if (BLOCK_ICONS[tag]) return BLOCK_ICONS[tag];
        const custom = (s.customFields || []).find(f => f.tag.toUpperCase() === tag);
        return custom?.icon || '📄';
    };

    if (!s.blockOrder) s.blockOrder = [...BLOCK_ORDER];

    const seenTags = new Set(BLOCK_ORDER);
    (s.customFields || []).forEach(f => {
        let baseTag = f.tag.toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (!baseTag) baseTag = 'CUSTOM';
        let finalTag = baseTag;
        let counter = 1;
        while (seenTags.has(finalTag)) {
            finalTag = `${baseTag}_${counter++}`;
        }
        if (f.tag !== finalTag) {
            console.log(`[RPG Tracker] Sanitized tag: ${f.tag} -> ${finalTag}`);
            f.tag = finalTag;
        }
        seenTags.add(finalTag);
    });

    const allCustomTags = (s.customFields || []).map(f => f.tag.toUpperCase());
    [...BLOCK_ORDER, ...allCustomTags].forEach(tag => {
        if (!s.blockOrder.includes(tag)) s.blockOrder.push(tag);
    });

    const validCustomTags = new Set(allCustomTags);
    const order = s.blockOrder.filter(tag => {
        const isStock = BLOCK_ORDER.includes(tag);
        if (!isStock && !validCustomTags.has(tag)) return false;
        if (tag === 'QUESTS' && s.syspromptModules?.quests === false) return false;
        return true;
    });
    s.blockOrder = order;

    order.forEach((tag, index) => {
        const isStock = BLOCK_ORDER.includes(tag);
        const customIndex = s.customFields.findIndex(f => f.tag.toUpperCase() === tag);
        const field = isStock ? null : s.customFields[customIndex];

        const isEnabled = isStock ? (s.modules[tag.toLowerCase()] ?? false) : (field?.enabled ?? false);

        const item = document.createElement('div');
        item.className = 'flex-container gap-1 alignitemscenter rt-order-item';
        item.style.padding = '5px';
        item.style.background = isEnabled ? 'var(--black30a)' : 'transparent';
        item.style.opacity = isEnabled ? '1' : '0.6';
        item.style.borderRadius = '4px';
        item.style.border = '1px solid var(--smartThemeBorderColor)';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isEnabled;
        cb.style.margin = '0 5px';
        cb.onchange = () => {
            if (isStock) {
                s.modules[tag.toLowerCase()] = cb.checked;
            } else {
                field.enabled = cb.checked;
            }
            saveSettings();
            refreshOrderList();
            refreshRenderedView();
        };

        const label = document.createElement('span');
        label.style.flex = '1';
        label.style.fontSize = '12px';
        label.style.cursor = 'default';
        label.textContent = `${getIcon(tag)} ${tag}`;

        const btnGroup = document.createElement('div');
        btnGroup.className = 'flex-container gap-1';

        const editBtn = document.createElement('button');
        editBtn.className = 'menu_button interactable rt-order-btn';
        editBtn.style.padding = '2px 6px';
        editBtn.title = isStock ? 'Edit Prompt' : 'Edit Custom Field';
        editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
        editBtn.onclick = () => {
            if (isStock) {
                let mod = tag.toLowerCase();
                let displayTag = tag;
                if (tag === 'TIME') {
                    mod = resolveTimePromptKey(s);
                    displayTag = resolveTimePromptDisplayTag(mod);
                }

                if (!s.stockPrompts) s.stockPrompts = { ...DEFAULT_STOCK_PROMPTS };
                openPromptEditor(
                    tag,
                    `Edit Default [${displayTag}] Prompt`,
                    s.stockPrompts[mod] || DEFAULT_STOCK_PROMPTS[mod],
                    DEFAULT_STOCK_PROMPTS[mod],
                    (newVal) => {
                        s.stockPrompts[mod] = newVal;
                        saveSettings();
                        toastr['success'](`[${displayTag}] prompt updated.`, 'RPG Tracker');
                    },
                    mod
                );
            } else {
                openCustomFieldEditor(customIndex);
            }
        };

        let resetBtn = null;
        if (isStock) {
            resetBtn = document.createElement('button');
            resetBtn.className = 'menu_button interactable rt-order-btn';
            resetBtn.style.padding = '2px 6px';
            resetBtn.title = 'Reset Prompt to Default';
            resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
            resetBtn.onclick = () => {
                let mod = tag.toLowerCase();
                if (tag === 'TIME') mod = resolveTimePromptKey(s);

                if (confirm(`Reset [${tag}] prompt to default? This will lose any custom changes.`)) {
                    if (!s.stockPrompts) s.stockPrompts = { ...DEFAULT_STOCK_PROMPTS };
                    s.stockPrompts[mod] = DEFAULT_STOCK_PROMPTS[mod];
                    saveSettings();
                    toastr['success'](`[${tag}] prompt reset.`, 'RPG Tracker');
                }
            };
        }

        const upBtn = document.createElement('button');
        upBtn.className = 'menu_button interactable rt-order-btn';
        upBtn.style.padding = '2px 6px';
        upBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        upBtn.disabled = index === 0;
        upBtn.onclick = () => {
            const newOrder = [...order];
            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
            s.blockOrder = newOrder;
            saveSettings();
            refreshOrderList();
            refreshRenderedView();
        };

        const downBtn = document.createElement('button');
        downBtn.className = 'menu_button interactable rt-order-btn';
        downBtn.style.padding = '2px 6px';
        downBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
        downBtn.disabled = index === order.length - 1;
        downBtn.onclick = () => {
            const newOrder = [...order];
            [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
            s.blockOrder = newOrder;
            saveSettings();
            refreshOrderList();
            refreshRenderedView();
        };

        item.appendChild(cb);
        item.appendChild(label);

        if (tag === 'TIME' && isStock) {
            const pill = document.createElement('label');
            pill.title = 'Toggle between 12-hour (AM/PM) and 24-hour time format for the [TIME] module prompt and all time displays.';
            pill.style.cssText = 'display:inline-flex; align-items:center; gap:4px; font-size:10px; opacity:0.8; cursor:pointer; user-select:none; margin-right:4px; white-space:nowrap;';

            const cb24h = document.createElement('input');
            cb24h.id = 'rpg_time_24h_toggle';
            cb24h.type = 'checkbox';
            cb24h.checked = !!s.use24hTime;
            cb24h.style.cssText = 'margin:0; cursor:pointer;';
            cb24h.onchange = () => setUse24hTime(cb24h.checked);

            const lbl24h = document.createElement('span');
            lbl24h.textContent = '24h';

            pill.appendChild(cb24h);
            pill.appendChild(lbl24h);
            item.appendChild(pill);

            const pillDate = document.createElement('label');
            pillDate.title = 'Toggle between [Day X] and [DD/MM/YYYY] date format for the time displays and prompts.';
            pillDate.style.cssText = 'display:inline-flex; align-items:center; gap:4px; font-size:10px; opacity:0.8; cursor:pointer; user-select:none; margin-right:4px; white-space:nowrap;';

            const cbDate = document.createElement('input');
            cbDate.id = 'rpg_time_ddmmyy_toggle';
            cbDate.type = 'checkbox';
            cbDate.checked = !!s.useDdMmYyFormat;
            cbDate.style.cssText = 'margin:0; cursor:pointer;';
            cbDate.onchange = () => setUseDdMmYyFormat(cbDate.checked);

            const lblDate = document.createElement('span');
            lblDate.textContent = 'DD/MM/YYYY';

            pillDate.appendChild(cbDate);
            pillDate.appendChild(lblDate);
            item.appendChild(pillDate);
        }

        btnGroup.appendChild(editBtn);
        if (resetBtn) btnGroup.appendChild(resetBtn);
        btnGroup.appendChild(upBtn);
        btnGroup.appendChild(downBtn);
        item.appendChild(btnGroup);
        list.appendChild(item);
    });
}

