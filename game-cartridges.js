// ─────────────────────────────────────────────────────────────────────────
// Game Cartridges — save/load/export/import the entire "configuration
// surface" of the framework (system prompt sections/order/toggles, Game
// Systems, tracker modules, block order, stock prompts, State Tracker
// extractor prompt, Lorebook Agent prompts & modules, RNG/format flags)
// as named, shareable bundles.
//
// The shipped defaults are exposed as a virtual, non-deletable "Stock"
// cartridge so the framework reads as a moddable platform: Stock is just
// the pack that ships in the box.
// ─────────────────────────────────────────────────────────────────────────

import { getSettings, getFactoryCartridgePayload, CARTRIDGE_PAYLOAD_GROUPS } from './state-manager.js';
import { escapeHtml } from './memo-processor.js';
import { refreshOrderList } from './ui-editors.js';
import {
    saveSettings,
    refreshRenderedView,
    autoApplySysprompt,
} from './src/app/runtime-bridge.js';
import { syncAllNarratorTogglesForUnlockState } from './game-systems.js';

const CARTRIDGE_FORMAT = 'multihog-game-cartridge';
const CARTRIDGE_VERSION = 1;
const GC_POPUP_LARGE = { wide: true, large: true, allowVerticalScrolling: true };
export const STOCK_CARTRIDGE_ID = '__stock__';

// ─────────────────────────────────────────────────────────────────────────
// Small shared helpers
// ─────────────────────────────────────────────────────────────────────────

function sanitizeCartridgeIcon(icon) {
    const trimmed = (icon || '').trim();
    return trimmed ? trimmed.slice(0, 4) : '🎮';
}

function slugify(str) {
    return (str || 'cartridge').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'cartridge';
}

function uniqueCartridgeName(base, settings, excludeId = null) {
    const taken = new Set((settings.gameCartridges || []).filter(c => c.id !== excludeId).map(c => c.name));
    if (!taken.has(base)) return base;
    let counter = 2;
    let candidate = `${base} (${counter})`;
    while (taken.has(candidate)) {
        counter++;
        candidate = `${base} (${counter})`;
    }
    return candidate;
}

function formatCartridgeDate(ts) {
    if (!ts) return '';
    try {
        return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

/** The shipped-defaults configuration, presented as a read-only virtual cartridge. */
function getStockCartridge() {
    return {
        id: STOCK_CARTRIDGE_ID,
        name: 'Stock (Factory Default)',
        description: 'The shipped default configuration — no custom sections, Game Systems, or tracker modules.',
        icon: '📦',
        isStock: true,
        payload: getFactoryCartridgePayload(),
    };
}

// ─────────────────────────────────────────────────────────────────────────
// Payload build / apply — the actual "save state" / "load state" logic
// ─────────────────────────────────────────────────────────────────────────

/**
 * Deep-clones every Game-Cartridge payload field off the live settings
 * object. Falls back to a factory default for any field that's somehow
 * missing (defensive — should not normally happen on live settings).
 * @param {object} settings
 * @returns {object}
 */
export function buildCartridgePayload(settings) {
    const factory = getFactoryCartridgePayload();
    const payload = {};
    for (const key of Object.keys(factory)) {
        const val = settings[key];
        payload[key] = val === undefined ? factory[key] : JSON.parse(JSON.stringify(val));
    }
    return payload;
}

/**
 * Fully replaces every Game-Cartridge payload field on the live settings
 * object with the values from `payload`. Any field missing from `payload`
 * (e.g. an older/partial imported cartridge) is backfilled from the factory
 * defaults so settings never end up partially undefined.
 * @param {object} settings
 * @param {object} payload
 */
export function applyCartridgePayload(settings, payload) {
    const factory = getFactoryCartridgePayload();
    for (const key of Object.keys(factory)) {
        const val = (payload && payload[key] !== undefined) ? payload[key] : factory[key];
        settings[key] = JSON.parse(JSON.stringify(val));
    }
    // Clear the active-preset selection side-channel keys. These are not part of the
    // cartridge payload, so they survive a load untouched — on another machine the stale
    // name may not exist or may refer to a completely different preset. Always reset to
    // "-- No Preset --" and let the user choose/save explicitly.
    delete settings['_activePreset_npcSectionPresets'];
    delete settings['_activePreset_pcSectionPresets'];
}

/**
 * Applies only the keys listed in `keysToApply` from `payload` into live
 * settings. Any key missing from the payload is backfilled from factory
 * defaults. Keys not in `keysToApply` are left completely untouched.
 * Used by the selective load dialog to apply only the groups the user checked.
 * @param {object} settings
 * @param {object} payload
 * @param {string[]} keysToApply
 */
function applyCartridgePayloadKeys(settings, payload, keysToApply) {
    const factory = getFactoryCartridgePayload();
    for (const key of keysToApply) {
        const val = (payload && payload[key] !== undefined) ? payload[key] : factory[key];
        settings[key] = JSON.parse(JSON.stringify(val));
    }
    // Only clear preset side-channel keys if the character-sheet group was applied.
    if (keysToApply.includes('npcSectionPresets')) delete settings['_activePreset_npcSectionPresets'];
    if (keysToApply.includes('pcSectionPresets'))  delete settings['_activePreset_pcSectionPresets'];
}

/**
 * Returns true if any payload key belonging to `groupDef` differs from the
 * corresponding factory default (JSON-stringify deep comparison). Used by the
 * selective load dialog to badge groups as "modified" vs "stock".
 * @param {{keys: string[]}} groupDef
 * @param {object} payload
 * @returns {boolean}
 */
function isGroupChangedFromDefaults(groupDef, payload) {
    const factory = getFactoryCartridgePayload();
    for (const key of groupDef.keys) {
        if (JSON.stringify(payload[key]) !== JSON.stringify(factory[key])) return true;
    }
    return false;
}

// ─────────────────────────────────────────────────────────────────────────
// Create / update / load / delete
// ─────────────────────────────────────────────────────────────────────────

export function createCartridgeFromCurrent(name, description, icon) {
    const settings = getSettings();
    if (!settings.gameCartridges) settings.gameCartridges = [];
    const finalName = uniqueCartridgeName((name || 'My Cartridge').trim() || 'My Cartridge', settings);
    const cartridge = {
        id: Date.now().toString(),
        name: finalName,
        description: (description || '').trim(),
        icon: sanitizeCartridgeIcon(icon),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        format: CARTRIDGE_FORMAT,
        version: CARTRIDGE_VERSION,
        payload: buildCartridgePayload(settings),
    };
    settings.gameCartridges.push(cartridge);
    saveSettings();
    toastr['success'](`Cartridge "${finalName}" saved! 💾`, 'Game Cartridges');
    return cartridge;
}

export function updateCartridgeFromCurrent(cartridge) {
    const settings = getSettings();
    cartridge.payload = buildCartridgePayload(settings);
    cartridge.updatedAt = Date.now();
    saveSettings();
    toastr['success'](`Cartridge "${cartridge.name}" updated! 💾`, 'Game Cartridges');
}

/**
 * Loads a cartridge (or the virtual Stock cartridge) via a selective import
 * dialog. The user chooses which configuration groups to apply; each group is
 * badged as "✏️ modified" or "~ stock ~" vs. factory defaults.
 * Returns true if any groups were applied.
 * @param {{id:string, name:string, payload:object}} cartridge
 * @returns {Promise<boolean>}
 */
export async function loadCartridge(cartridge) {
    const { Popup } = SillyTavern.getContext();

    // Pre-compute modified status for every group so we can render badges.
    const groupStatus = CARTRIDGE_PAYLOAD_GROUPS.map(g => ({
        ...g,
        isModified: isGroupChangedFromDefaults(g, cartridge.payload || {}),
    }));

    // Build the checklist HTML rows.
    const rowsHtml = groupStatus.map(g => {
        const badge = g.isModified
            ? `<span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(255,180,60,0.25); color:#ffcc66; border:1px solid rgba(255,180,60,0.4); white-space:nowrap;">✏️ modified</span>`
            : `<span style="font-size:9px; padding:1px 6px; border-radius:3px; background:rgba(120,120,120,0.25); border:1px solid rgba(120,120,120,0.35); opacity:0.85; white-space:nowrap;">~ stock ~</span>`;
        return `
        <label style="display:flex; align-items:center; gap:10px; padding:9px 10px; border:1px solid rgba(255,255,255,0.08); border-radius:6px; background:rgba(0,0,0,0.15); cursor:pointer;">
            <input type="checkbox" class="rt-gc-load-group-cb" data-group-id="${g.id}" checked
                style="width:15px; height:15px; flex-shrink:0; cursor:pointer; accent-color:#66bb88;">
            <div style="flex:1; min-width:0;">
                <div style="font-size:12px; font-weight:bold; display:flex; align-items:center; gap:6px;">
                    ${escapeHtml(g.label)}
                    ${badge}
                </div>
                <div style="font-size:10px; opacity:0.55; margin-top:2px;">${escapeHtml(g.description)}</div>
            </div>
        </label>`;
    }).join('');

    const content = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%; box-sizing:border-box;">
            <p style="margin:0 0 4px; font-size:12px; opacity:0.75; line-height:1.45;">
                Choose which sections to import from <b>${escapeHtml(cartridge.name)}</b>.
                Only checked sections will replace your current configuration.
                <b style="color:#ffaa55;">✏️ modified</b> means the cartridge differs from factory defaults.
            </p>
            <div id="rt-gc-load-group-list" style="display:flex; flex-direction:column; gap:6px;">
                ${rowsHtml}
            </div>
            <p style="margin:6px 0 0; font-size:10px; opacity:0.45;">
                ⚠️ Checked sections will fully replace your current settings for those areas.
                This cannot be undone unless you first saved your current setup as a cartridge.
            </p>
        </div>`;

    // Keep track of which groups are checked in real-time.
    const checkedGroups = {};
    CARTRIDGE_PAYLOAD_GROUPS.forEach(g => {
        checkedGroups[g.id] = true;
    });

    // Set up listeners in a timeout since the popup DOM generates asynchronously.
    setTimeout(() => {
        const checkboxes = document.querySelectorAll('.rt-gc-load-group-cb');
        checkboxes.forEach(cb => {
            const groupId = cb.getAttribute('data-group-id');
            if (groupId) {
                checkedGroups[groupId] = cb.checked;
                cb.addEventListener('change', () => {
                    checkedGroups[groupId] = cb.checked;
                });
            }
        });
    }, 100);

    const result = await Popup.show.confirm(`🎮 Load Cartridge: ${escapeHtml(cartridge.name)}`, content, {
        okButton: 'Load Selected',
        cancelButton: 'Cancel',
        ...GC_POPUP_LARGE,
    });

    if (!result) return false;

    // Collect keys for all checked groups.
    const keysToApply = [];
    CARTRIDGE_PAYLOAD_GROUPS.forEach(g => {
        if (checkedGroups[g.id]) keysToApply.push(...g.keys);
    });

    if (keysToApply.length === 0) {
        toastr['warning']('No sections selected — nothing was changed.', 'Game Cartridges');
        return false;
    }

    const settings = getSettings();
    applyCartridgePayloadKeys(settings, cartridge.payload, keysToApply);
    saveSettings();
    refreshOrderList();
    syncAllNarratorTogglesForUnlockState();
    refreshRenderedView();
    await autoApplySysprompt(true);
    if (typeof globalThis._rpgSyncSettingsUi === 'function') {
        globalThis._rpgSyncSettingsUi();
    }
    toastr['success'](`Cartridge "${cartridge.name}" loaded! 🎮`, 'Game Cartridges');
    return true;
}

export function deleteCartridgeWithConfirm(cartridge) {
    if (!confirm(`Delete the cartridge "${cartridge.name}"? This cannot be undone.`)) return false;
    const settings = getSettings();
    settings.gameCartridges = (settings.gameCartridges || []).filter(c => c.id !== cartridge.id);
    saveSettings();
    toastr['info'](`Cartridge "${cartridge.name}" deleted.`, 'Game Cartridges');
    return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Export — serialize a cartridge to shareable JSON (copy / .json download)
// ─────────────────────────────────────────────────────────────────────────

function buildCartridgeExportObject(cartridge) {
    return {
        format: CARTRIDGE_FORMAT,
        version: CARTRIDGE_VERSION,
        name: cartridge.name,
        description: cartridge.description || '',
        icon: cartridge.icon || '🎮',
        exportedAt: new Date().toISOString(),
        payload: cartridge.payload,
    };
}

function showCartridgeSharePopup(jsonString, cartridgeName) {
    const { Popup } = SillyTavern.getContext();
    const escaped = jsonString
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const content = `
            <div style="display:flex; flex-direction:column; gap:8px; min-width:360px;">
                <p style="margin:0; font-size:12px; opacity:0.7;">
                    Copy this code and share it anywhere. Others can load it using the <b>Import</b> button in Game Cartridges.
                </p>
                <textarea id="rt_gc_share_blob" readonly rows="14" class="text_pole"
                    style="font-family:monospace; font-size:11px; resize:vertical; width:100%;"
                >${escaped}</textarea>
                <div style="display:flex; gap:8px;">
                    <button id="rt_gc_share_copy" class="menu_button interactable" style="flex:1;">
                        <i class="fa-solid fa-copy"></i> Copy to Clipboard
                    </button>
                    <button id="rt_gc_share_download" class="menu_button interactable" style="flex:1;">
                        <i class="fa-solid fa-file-download"></i> Export .json
                    </button>
                </div>
            </div>
        `;
    Popup.show.confirm(`📤 Export Cartridge: ${escapeHtml(cartridgeName)}`, content, {
        okButton: 'Done',
        cancelButton: false,
    });
    setTimeout(() => {
        const copyBtn = document.getElementById('rt_gc_share_copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(jsonString);
                        toastr['success']('Cartridge code copied to clipboard!', 'Game Cartridges');
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
                        toastr['success']('Cartridge code copied to clipboard!', 'Game Cartridges');
                    } else {
                        throw new Error('execCommand returned false');
                    }
                } catch (err) {
                    console.error('[RPG Tracker] Cartridge clipboard copy failed:', err);
                    toastr['error']('Could not copy automatically. Please select the text manually.', 'Game Cartridges');
                }
            });
        }

        const downloadBtn = document.getElementById('rt_gc_share_download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `multihog_cartridge_${slugify(cartridgeName)}_${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }
    }, 50);
}

export function exportCartridgeToJson(cartridge) {
    const jsonString = JSON.stringify(buildCartridgeExportObject(cartridge), null, 2);
    showCartridgeSharePopup(jsonString, cartridge.name);
}

// ─────────────────────────────────────────────────────────────────────────
// Import — paste or file-load a cartridge JSON blob into the local library
// ─────────────────────────────────────────────────────────────────────────

/** @returns {Promise<string|null>} Raw pasted/loaded text, or null if cancelled. */
async function showCartridgeImportPopup() {
    const { Popup } = SillyTavern.getContext();
    let pastedValue = '';

    // Attach the file input directly to body so the OS file picker doesn't
    // steal focus away from the popup and trigger its "outside click" dismiss.
    const fileInput = /** @type {HTMLInputElement} */ (document.createElement('input'));
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(fileInput);

    const content = `
            <div style="display:flex; flex-direction:column; gap:8px; width:100%; box-sizing:border-box;">
                <p style="margin:0; font-size:12px; opacity:0.7;">
                    Paste a Game Cartridge export code (JSON) below, or load it from a file.
                </p>
                <textarea id="rt_gc_import_blob" rows="12" class="text_pole"
                    style="font-family:monospace; font-size:11px; resize:vertical; width:100%;"
                    placeholder='{"format": "multihog-game-cartridge", ...}'
                ></textarea>
                <button id="rt_gc_import_file_btn" class="menu_button interactable" style="width:100%;">
                    <i class="fa-solid fa-file-upload"></i> Load from File
                </button>
            </div>
        `;

    setTimeout(() => {
        const fileBtn = document.getElementById('rt_gc_import_file_btn');
        const textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_gc_import_blob'));

        if (textarea) {
            textarea.addEventListener('input', () => {
                pastedValue = textarea.value;
            });
        }

        if (fileBtn) {
            fileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });
        }

        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = String(ev.target?.result || '');
                pastedValue = text;
                if (textarea) textarea.value = text;
            };
            reader.readAsText(file);
            fileInput.value = ''; // allow re-selecting same file
        });
    }, 100);

    const result = await Popup.show.confirm('📥 Import Game Cartridge', content, { okButton: 'Import', cancelButton: 'Cancel' });
    document.body.removeChild(fileInput);

    if (!result || !pastedValue.trim()) return null;
    return pastedValue;
}

/**
 * Parses/validates a cartridge JSON blob, backfills any missing payload
 * fields from factory defaults, and stores it as a new entry in
 * settings.gameCartridges (auto-suffixing the name on collision). Offers to
 * load it immediately once saved.
 */
export async function importCartridgeFromJson() {
    const text = await showCartridgeImportPopup();
    if (!text) return;

    let parsed;
    try {
        parsed = JSON.parse(text.trim());
    } catch (err) {
        toastr['error']('Could not parse that as JSON.', 'Game Cartridges');
        return;
    }

    if (!parsed || parsed.format !== CARTRIDGE_FORMAT) {
        toastr['error'](`Not a recognized Game Cartridge (expected format "${CARTRIDGE_FORMAT}").`, 'Game Cartridges');
        return;
    }

    const settings = getSettings();
    if (!settings.gameCartridges) settings.gameCartridges = [];

    const factory = getFactoryCartridgePayload();
    const payload = {};
    for (const key of Object.keys(factory)) {
        payload[key] = (parsed.payload && parsed.payload[key] !== undefined) ? parsed.payload[key] : factory[key];
    }

    const name = uniqueCartridgeName((parsed.name || 'Imported Cartridge').trim() || 'Imported Cartridge', settings);
    const cartridge = {
        id: Date.now().toString(),
        name,
        description: (parsed.description || '').trim(),
        icon: sanitizeCartridgeIcon(parsed.icon),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        format: CARTRIDGE_FORMAT,
        version: CARTRIDGE_VERSION,
        payload,
    };
    settings.gameCartridges.push(cartridge);
    saveSettings();
    toastr['success'](`Cartridge "${name}" imported! ✅`, 'Game Cartridges');

    if (confirm(`Load "${name}" into your current configuration now?`)) {
        await loadCartridge(cartridge);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Name/description/icon editor — shared by "Save Current as New Cartridge"
// and "Rename / Edit Details"
// ─────────────────────────────────────────────────────────────────────────

async function promptCartridgeMeta({ title, okButton, initialName = '', initialDescription = '', initialIcon = '🎮' }) {
    const { Popup } = SillyTavern.getContext();
    const content = `
        <div style="display:flex; flex-direction:column; gap:10px; width:100%; box-sizing:border-box; text-align:left;">
            <div>
                <label style="font-size:11px; opacity:0.8;">Icon (emoji)</label>
                <input id="rt_gc_meta_icon" type="text" class="text_pole" maxlength="4" value="${escapeHtml(initialIcon)}" style="width:70px; text-align:center; font-size:16px;">
            </div>
            <div>
                <label style="font-size:11px; opacity:0.8;">Name</label>
                <input id="rt_gc_meta_name" type="text" class="text_pole" value="${escapeHtml(initialName)}" style="width:100%;">
            </div>
            <div>
                <label style="font-size:11px; opacity:0.8;">Description</label>
                <textarea id="rt_gc_meta_desc" rows="3" class="text_pole" style="width:100%; resize:vertical; font-size:12px;">${escapeHtml(initialDescription)}</textarea>
            </div>
        </div>
    `;

    const values = { name: initialName, description: initialDescription, icon: initialIcon };
    setTimeout(() => {
        const nameEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_gc_meta_name'));
        const descEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('rt_gc_meta_desc'));
        const iconEl = /** @type {HTMLInputElement} */ (document.getElementById('rt_gc_meta_icon'));
        if (nameEl) nameEl.addEventListener('input', () => { values.name = nameEl.value; });
        if (descEl) descEl.addEventListener('input', () => { values.description = descEl.value; });
        if (iconEl) iconEl.addEventListener('input', () => { values.icon = iconEl.value; });
    }, 100);

    const result = await Popup.show.confirm(title, content, { okButton, cancelButton: 'Cancel', wide: true });
    if (!result) return null;
    if (!values.name.trim()) {
        toastr['warning']('Please enter a name for the cartridge.', 'Game Cartridges');
        return null;
    }
    return values;
}

async function createCartridgeViaPrompt() {
    const values = await promptCartridgeMeta({ title: '💾 Save Current as New Cartridge', okButton: 'Save' });
    if (!values) return;
    createCartridgeFromCurrent(values.name, values.description, values.icon);
}

/**
 * Prompt for name/icon/description, then snapshot the live config as a Game Cartridge.
 * Used by Manage Cartridges and by the post-update "Save as Cartridge & Upgrade" path.
 * @param {{ title?: string, okButton?: string, initialName?: string }} [opts]
 * @returns {Promise<object|null>} The saved cartridge, or null if cancelled / invalid name.
 */
export async function promptAndSaveCurrentAsCartridge(opts = {}) {
    const values = await promptCartridgeMeta({
        title: opts.title || '💾 Save Current as New Cartridge',
        okButton: opts.okButton || 'Save',
        initialName: opts.initialName || '',
        initialDescription: opts.initialDescription || '',
        initialIcon: opts.initialIcon || '🎮',
    });
    if (!values) return null;
    return createCartridgeFromCurrent(values.name, values.description, values.icon);
}

async function editCartridgeMeta(cartridge) {
    const settings = getSettings();
    const values = await promptCartridgeMeta({
        title: '✏️ Edit Cartridge Details',
        okButton: 'Save',
        initialName: cartridge.name,
        initialDescription: cartridge.description || '',
        initialIcon: cartridge.icon || '🎮',
    });
    if (!values) return;
    cartridge.name = uniqueCartridgeName(values.name.trim(), settings, cartridge.id);
    cartridge.description = values.description.trim();
    cartridge.icon = sanitizeCartridgeIcon(values.icon);
    cartridge.updatedAt = Date.now();
    saveSettings();
    toastr['success'](`Cartridge "${cartridge.name}" updated.`, 'Game Cartridges');
}

// ─────────────────────────────────────────────────────────────────────────
// Manage Game Cartridges — main popup
// ─────────────────────────────────────────────────────────────────────────

export async function openManageGameCartridges() {
    const { Popup } = SillyTavern.getContext();
    const settings = getSettings();
    if (!settings.gameCartridges) settings.gameCartridges = [];

    const generateListHtml = () => {
        const rows = [getStockCartridge(), ...settings.gameCartridges];
        return '<div style="display:flex; flex-direction:column; gap:8px;">' + rows.map((c, idx) => {
            const isStock = !!c.isStock;
            const realIndex = idx - 1; // -1 for the stock row, which has no real index
            return `
            <div class="rt-gc-item" style="display:flex; align-items:center; gap:10px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; background:rgba(0,0,0,0.2); padding:10px;">
                <div style="font-size:18px; width:26px; text-align:center;">${escapeHtml(c.icon || (isStock ? '📦' : '🎮'))}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:bold; font-size:13px;">${escapeHtml(c.name)}${isStock ? '<span style="font-size:9px; padding:1px 5px; border-radius:3px; margin-left:6px; background:rgba(150,150,150,0.25); opacity:0.85;">FACTORY</span>' : ''}</div>
                    <div style="font-size:10px; opacity:0.6; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(c.description || '')}">${escapeHtml(c.description || '')}</div>
                    ${!isStock && c.updatedAt ? `<div style="font-size:9px; opacity:0.45;">Updated ${formatCartridgeDate(c.updatedAt)}</div>` : ''}
                </div>
                <button class="rt-gc-load menu_button interactable" data-index="${isStock ? 'stock' : realIndex}" style="font-size:11px; padding:2px 10px; white-space:nowrap; background:rgba(80,180,120,0.15); border-color:rgba(80,180,120,0.4);">Load</button>
                ${!isStock ? `
                <button class="rt-gc-rename" data-index="${realIndex}" style="background:none; border:none; color:#88bbff; cursor:pointer; padding:4px;" title="Rename / Edit Details"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="rt-gc-save-current" data-index="${realIndex}" style="background:none; border:none; color:#ffb43c; cursor:pointer; padding:4px;" title="Overwrite with current configuration"><i class="fa-solid fa-floppy-disk"></i></button>
                <button class="rt-gc-export" data-index="${realIndex}" style="background:none; border:none; color:#aaddff; cursor:pointer; padding:4px;" title="Export"><i class="fa-solid fa-file-export"></i></button>
                <button class="rt-gc-delete" data-index="${realIndex}" style="background:none; border:none; color:#ff5555; cursor:pointer; padding:4px;" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                ` : ''}
            </div>
        `;
        }).join('') + '</div>';
    };

    const html = `
        <div id="rt-gc-manage-container" style="display:flex; flex-direction:column; gap:12px; width:100%; box-sizing:border-box; max-height:85vh;">
            <div style="font-size:11px; opacity:0.8; line-height:1.4;">
                Save your entire configuration — system prompt sections, ordering, on/off toggles, Game Systems, tracker modules, block order, stock prompts, and the State Tracker's extractor prompt — as a named <b>Game Cartridge</b>. Export it to share with others, or Import one someone else made. Loading a cartridge <b>fully replaces</b> your current configuration.
            </div>
            <div style="display:flex; gap:6px;">
                <button id="rt_gc_btn_save_new" class="menu_button interactable" style="flex:1; background:rgba(80,180,120,0.15); border-color:rgba(80,180,120,0.4); font-size:11px; padding:4px 8px;">
                    <i class="fa-solid fa-floppy-disk"></i> Save Current as New Cartridge
                </button>
                <button id="rt_gc_btn_import" class="menu_button interactable" style="flex:1; background:rgba(50,150,255,0.15); border-color:rgba(50,150,255,0.4); font-size:11px; padding:4px 8px;">
                    <i class="fa-solid fa-file-import"></i> Import
                </button>
            </div>
            <div id="rt-gc-manage-list-wrap" style="overflow-y:auto; padding-right:10px; flex:1;">
                ${generateListHtml()}
            </div>
        </div>
    `;

    setTimeout(() => {
        const container = document.getElementById('rt-gc-manage-container');
        if (!container) return;

        const bindEvents = () => {
            const wrap = document.getElementById('rt-gc-manage-list-wrap');
            if (!wrap) return;

            wrap.querySelectorAll('.rt-gc-load').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const idx = e.currentTarget.dataset.index;
                    const cartridge = idx === 'stock' ? getStockCartridge() : settings.gameCartridges[parseInt(idx)];
                    if (!cartridge) return;
                    await loadCartridge(cartridge);
                });
            });

            wrap.querySelectorAll('.rt-gc-rename').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    const cartridge = settings.gameCartridges[idx];
                    if (!cartridge) return;
                    await editCartridgeMeta(cartridge);
                    const w = document.getElementById('rt-gc-manage-list-wrap');
                    if (w) { w.innerHTML = generateListHtml(); bindEvents(); }
                });
            });

            wrap.querySelectorAll('.rt-gc-save-current').forEach(el => {
                el.addEventListener('click', async (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    const cartridge = settings.gameCartridges[idx];
                    if (!cartridge) return;
                    if (!confirm(`Overwrite "${cartridge.name}" with your CURRENT configuration? This cannot be undone.`)) return;
                    updateCartridgeFromCurrent(cartridge);
                    const w = document.getElementById('rt-gc-manage-list-wrap');
                    if (w) { w.innerHTML = generateListHtml(); bindEvents(); }
                });
            });

            wrap.querySelectorAll('.rt-gc-export').forEach(el => {
                el.addEventListener('click', (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    const cartridge = settings.gameCartridges[idx];
                    if (!cartridge) return;
                    exportCartridgeToJson(cartridge);
                });
            });

            wrap.querySelectorAll('.rt-gc-delete').forEach(el => {
                el.addEventListener('click', (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    const cartridge = settings.gameCartridges[idx];
                    if (!cartridge) return;
                    const deleted = deleteCartridgeWithConfirm(cartridge);
                    if (!deleted) return;
                    const w = document.getElementById('rt-gc-manage-list-wrap');
                    if (w) { w.innerHTML = generateListHtml(); bindEvents(); }
                });
            });
        };
        bindEvents();

        const saveNewBtn = document.getElementById('rt_gc_btn_save_new');
        if (saveNewBtn) {
            saveNewBtn.addEventListener('click', async () => {
                await createCartridgeViaPrompt();
                const w = document.getElementById('rt-gc-manage-list-wrap');
                if (w) { w.innerHTML = generateListHtml(); bindEvents(); }
            });
        }

        const importBtn = document.getElementById('rt_gc_btn_import');
        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                await importCartridgeFromJson();
                const w = document.getElementById('rt-gc-manage-list-wrap');
                if (w) { w.innerHTML = generateListHtml(); bindEvents(); }
            });
        }
    }, 100);

    await Popup.show.confirm('🎮 Manage Game Cartridges', html, { okButton: 'Close', cancelButton: false, ...GC_POPUP_LARGE });
    if (typeof globalThis._rpgSyncSettingsUi === 'function') {
        globalThis._rpgSyncSettingsUi();
    }
}
