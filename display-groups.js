import { BLOCK_ICONS, BLOCK_ORDER } from './constants.js';
import { escapeHtml } from './memo-processor.js';
import { getSettings, writeCriticalSettingsBackup, stampCriticalSettingsSynced } from './state-manager.js';
import { refreshRenderedView, saveSettings } from './src/app/runtime-bridge.js';
import {
    DISPLAY_GROUP_EXCLUDED_TAGS,
    normalizeDisplayGroups,
} from './src/features/display-groups.js';

function newDisplayGroupId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function knownDisplayGroupModules(settings) {
    const stock = BLOCK_ORDER
        .filter(tag => !DISPLAY_GROUP_EXCLUDED_TAGS.has(tag))
        .map(tag => ({ tag, icon: BLOCK_ICONS[tag] || '📄', label: tag, kind: 'Stock' }));
    const custom = (settings.customFields || [])
        .map(field => ({
            tag: String(field?.tag || '').toUpperCase(),
            icon: field?.icon || '📄',
            label: field?.label || field?.tag || 'Custom Module',
            kind: field?.origin === 'wizard' ? 'Wizard' : 'Custom',
        }))
        .filter(item => item.tag && !DISPLAY_GROUP_EXCLUDED_TAGS.has(item.tag));
    const seen = new Set();
    return [...stock, ...custom].filter(item => !seen.has(item.tag) && seen.add(item.tag));
}

function persistDisplayGroups(settings) {
    settings.displayGroups = normalizeDisplayGroups(settings.displayGroups);
    // Sync WAL before the async disk write — code-edit reloads cancel ST's save often.
    stampCriticalSettingsSynced(settings, writeCriticalSettingsBackup(settings));
    saveSettings(true);
    refreshRenderedView();
}

export async function openDisplayGroupsManager() {
    const settings = getSettings();
    settings.displayGroups = normalizeDisplayGroups(settings.displayGroups);
    const { Popup, POPUP_RESULT } = SillyTavern.getContext();
    // Assigned when the editor opens. The footer's Done button invokes it so
    // an open edit is never lost merely because the manager is closed.
    let saveOpenEditor = null;

    const html = `
        <div id="rt-display-groups-manager" style="display:flex;flex-direction:column;gap:10px;width:100%;min-width:0;max-height:72vh;box-sizing:border-box;overflow-x:hidden;">
            <div style="padding:9px 10px;border:1px solid rgba(255,190,70,.45);border-radius:7px;background:rgba(255,190,70,.08);font-size:11px;line-height:1.45;box-sizing:border-box;max-width:100%;overflow-wrap:anywhere;">
                Display Groups allow you to visually bundle together related modules without their headers, allowing for a neater, less bulky display. Especially useful in tab mode, so that you don't need an enormous number of tabs for each individual similar module.<br><br>
                Display Groups are global and display-only. They never merge memo blocks, prompts, module activation, scope, or Wizard Game Systems. Disable the master toggle to restore the existing renderer immediately.
            </div>
            <div style="display:none;padding:9px 10px;border:1px solid rgba(255,190,70,.45);border-radius:7px;background:rgba(255,190,70,.08);font-size:11px;line-height:1.45;box-sizing:border-box;max-width:100%;overflow-wrap:anywhere;">
                Display Groups are global and display-only. They never merge memo blocks, prompts, module activation, scope, or Wizard Game Systems. Disable the master toggle to restore the existing renderer immediately.
            </div>
            <div class="rt-display-group-options">
                <label class="rt-display-group-option" title="Turn this off to immediately restore the existing independent module rendering without deleting your groups.">
                    <input id="rt-display-groups-enabled" type="checkbox" ${settings.displayGroupsEnabled ? 'checked' : ''}>
                    <span class="rt-display-group-option-copy"><strong>Enable Display Groups</strong><small>Use your saved groups in the tracker display.</small></span>
                </label>
                <label class="rt-display-group-option" title="When disabled, grouped modules have no separator line or vertical gap between them.">
                    <input id="rt-display-groups-show-gaps" type="checkbox" ${settings.displayGroupsShowGaps === true ? 'checked' : ''}>
                    <span class="rt-display-group-option-copy"><strong>Show gaps between grouped modules</strong><small>Turn off for a completely seamless grouped display.</small></span>
                </label>
            </div>
            <div id="rt-display-groups-list" style="display:flex;flex-direction:column;gap:7px;overflow-y:auto;overflow-x:hidden;min-height:70px;min-width:0;max-width:100%;"></div>
            <button id="rt-display-group-add" class="menu_button interactable" style="width:100%;"><i class="fa-solid fa-plus"></i> Create Display Group</button>
            <div id="rt-display-group-editor" style="display:none;border:1px solid rgba(180,100,255,.35);border-radius:8px;padding:10px;background:rgba(0,0,0,.22);box-sizing:border-box;min-width:0;max-width:100%;overflow-x:hidden;"></div>
        </div>`;

    setTimeout(() => {
        const root = document.getElementById('rt-display-groups-manager');
        const list = document.getElementById('rt-display-groups-list');
        const editor = document.getElementById('rt-display-group-editor');
        if (!root || !list || !editor) return;

        root.querySelector('#rt-display-groups-enabled')?.addEventListener('change', (event) => {
            settings.displayGroupsEnabled = !!event.currentTarget.checked;
            saveSettings(true);
            refreshRenderedView();
            toastr['info'](
                settings.displayGroupsEnabled
                    ? 'Display Groups enabled.'
                    : 'Display Groups disabled. Normal module cards restored.',
                'Display Groups',
            );
        });
        root.querySelector('#rt-display-groups-show-gaps')?.addEventListener('change', (event) => {
            settings.displayGroupsShowGaps = !!event.currentTarget.checked;
            saveSettings(true);
            refreshRenderedView();
        });

        const renderList = () => {
            settings.displayGroups = normalizeDisplayGroups(settings.displayGroups);
            if (!settings.displayGroups.length) {
                list.innerHTML = '<div style="padding:14px;text-align:center;opacity:.58;font-size:11px;border:1px dashed rgba(255,255,255,.16);border-radius:6px;">No Display Groups configured.</div>';
            } else {
                list.innerHTML = settings.displayGroups.map((group, index) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:rgba(255,255,255,.025);box-sizing:border-box;min-width:0;max-width:100%;">
                        <input class="rt-dg-enabled" data-index="${index}" type="checkbox" ${group.enabled ? 'checked' : ''} title="Enable this global Display Group">
                        <span style="font-size:17px;">${escapeHtml(group.icon)}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:12px;font-weight:bold;">${escapeHtml(group.name)}</div>
                            <div style="font:10px/1.35 monospace;opacity:.62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${group.members.map(escapeHtml).join(' · ')}</div>
                        </div>
                        <button class="rt-dg-edit menu_button interactable" data-index="${index}" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="rt-dg-delete menu_button interactable" data-index="${index}" title="Delete" style="color:#ff7777;"><i class="fa-solid fa-trash"></i></button>
                    </div>`).join('');
            }

            list.querySelectorAll('.rt-dg-enabled').forEach(input => input.addEventListener('change', () => {
                const group = settings.displayGroups[Number(input.dataset.index)];
                if (!group) return;
                group.enabled = !!input.checked;
                persistDisplayGroups(settings);
            }));
            list.querySelectorAll('.rt-dg-edit').forEach(button => button.addEventListener('click', () => openEditor(Number(button.dataset.index))));
            list.querySelectorAll('.rt-dg-delete').forEach(button => button.addEventListener('click', () => {
                const index = Number(button.dataset.index);
                const group = settings.displayGroups[index];
                if (!group || !confirm(`Delete Display Group "${group.name}"?\n\nIts modules will not be deleted or disabled.`)) return;
                settings.displayGroups.splice(index, 1);
                persistDisplayGroups(settings);
                renderList();
            }));
        };

        const openEditor = (index = -1) => {
            const existing = index >= 0 ? settings.displayGroups[index] : null;
            const otherClaims = new Map();
            settings.displayGroups.forEach((group, groupIndex) => {
                if (groupIndex === index) return;
                group.members.forEach(tag => otherClaims.set(tag, group.name));
            });
            const modules = knownDisplayGroupModules(settings);
            const knownTags = new Set(modules.map(item => item.tag));
            const unavailable = (existing?.members || []).filter(tag => !knownTags.has(tag));
            // Kept independently from the checklist's DOM order: this is the
            // order in which the group renders its member modules.
            let memberOrder = [...(existing?.members || [])];
            const moduleByTag = new Map(modules.map(item => [item.tag, item]));
            const memberRows = [
                ...modules.map(item => {
                    const claimedBy = otherClaims.get(item.tag);
                    const checked = existing?.members?.includes(item.tag);
                    return `<label style="display:flex;align-items:center;gap:7px;padding:5px 6px;border-radius:4px;opacity:${claimedBy ? '.42' : '1'};cursor:${claimedBy ? 'not-allowed' : 'pointer'};box-sizing:border-box;min-width:0;max-width:100%;">
                        <input class="rt-dg-member" type="checkbox" value="${escapeHtml(item.tag)}" ${checked ? 'checked' : ''} ${claimedBy ? 'disabled' : ''}>
                        <span>${escapeHtml(item.icon)}</span><span style="flex:1;min-width:0;font-size:11px;overflow-wrap:anywhere;">${escapeHtml(item.label)} <code style="opacity:.58;white-space:normal;overflow-wrap:anywhere;">[${escapeHtml(item.tag)}]</code></span>
                        <small style="opacity:.55;flex:0 0 auto;">${claimedBy ? `In ${escapeHtml(claimedBy)}` : item.kind}</small>
                    </label>`;
                }),
                ...unavailable.map(tag => `<label style="display:flex;align-items:center;gap:7px;padding:5px 6px;opacity:.6;box-sizing:border-box;min-width:0;max-width:100%;">
                    <input class="rt-dg-member" type="checkbox" value="${escapeHtml(tag)}" checked>
                    <span>⚠️</span><span style="flex:1;min-width:0;font-size:11px;overflow-wrap:anywhere;"><code style="white-space:normal;overflow-wrap:anywhere;">[${escapeHtml(tag)}]</code></span><small style="flex:0 0 auto;">Unavailable</small>
                </label>`),
            ].join('');

            editor.style.display = 'block';
            editor.innerHTML = `
                <div style="font-size:12px;font-weight:bold;margin-bottom:8px;">${existing ? 'Edit' : 'Create'} Display Group</div>
                <div style="display:flex;gap:6px;margin-bottom:8px;min-width:0;max-width:100%;">
                    <input id="rt-dg-editor-icon" class="text_pole" value="${escapeHtml(existing?.icon || '🗂️')}" style="width:52px;flex:0 0 52px;text-align:center;box-sizing:border-box;" maxlength="16" title="Group icon">
                    <input id="rt-dg-editor-name" class="text_pole" value="${escapeHtml(existing?.name || '')}" style="flex:1;min-width:0;box-sizing:border-box;" maxlength="80" placeholder="Display Group name">
                </div>
                <div style="font-size:10px;opacity:.62;margin-bottom:5px;overflow-wrap:anywhere;">Select modules to render under this shared header. Use the arrows below to choose their order inside the group. Combat, Quests, and Benched Party cannot be grouped.</div>
                <div style="font-size:10px;font-weight:bold;opacity:.72;margin:8px 0 4px;">MODULE ORDER IN THIS GROUP</div>
                <div id="rt-dg-member-order" style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px;min-width:0;"></div>
                <div style="max-height:300px;overflow-y:auto;overflow-x:hidden;border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:3px;box-sizing:border-box;min-width:0;max-width:100%;">${memberRows || '<div style="padding:10px;opacity:.55;">No eligible modules found.</div>'}</div>
                <div style="display:flex;gap:6px;margin-top:9px;min-width:0;max-width:100%;flex-wrap:wrap;">
                    <button id="rt-dg-editor-save" class="menu_button interactable" style="flex:1;background:rgba(0,200,140,.18);border-color:rgba(0,200,140,.45);">Save Display Group</button>
                </div>`;

            const orderContainer = editor.querySelector('#rt-dg-member-order');
            const renderMemberOrder = () => {
                if (!orderContainer) return;
                if (!memberOrder.length) {
                    orderContainer.innerHTML = '<div style="padding:6px 7px;border:1px dashed rgba(255,255,255,.14);border-radius:4px;font-size:10px;opacity:.55;">Select modules below, then arrange them here.</div>';
                    return;
                }
                orderContainer.innerHTML = memberOrder.map((tag, memberIndex) => {
                    const item = moduleByTag.get(tag);
                    const label = item?.label || tag;
                    const icon = item?.icon || '⚠️';
                    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid rgba(255,255,255,.12);border-radius:4px;background:rgba(255,255,255,.025);min-width:0;">
                        <span style="font-size:12px;">${escapeHtml(icon)}</span><span style="flex:1;min-width:0;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(label)} <code style="opacity:.55;">[${escapeHtml(tag)}]</code></span>
                        <button class="rt-dg-member-up menu_button interactable" data-index="${memberIndex}" title="Move up" ${memberIndex === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                        <button class="rt-dg-member-down menu_button interactable" data-index="${memberIndex}" title="Move down" ${memberIndex === memberOrder.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    </div>`;
                }).join('');
                orderContainer.querySelectorAll('.rt-dg-member-up').forEach(button => button.addEventListener('click', () => {
                    const memberIndex = Number(button.dataset.index);
                    [memberOrder[memberIndex - 1], memberOrder[memberIndex]] = [memberOrder[memberIndex], memberOrder[memberIndex - 1]];
                    renderMemberOrder();
                }));
                orderContainer.querySelectorAll('.rt-dg-member-down').forEach(button => button.addEventListener('click', () => {
                    const memberIndex = Number(button.dataset.index);
                    [memberOrder[memberIndex], memberOrder[memberIndex + 1]] = [memberOrder[memberIndex + 1], memberOrder[memberIndex]];
                    renderMemberOrder();
                }));
            };

            editor.querySelectorAll('.rt-dg-member:not(:disabled)').forEach(input => input.addEventListener('change', () => {
                const tag = input.value;
                if (input.checked && !memberOrder.includes(tag)) memberOrder.push(tag);
                if (!input.checked) memberOrder = memberOrder.filter(member => member !== tag);
                renderMemberOrder();
            }));
            renderMemberOrder();

            const saveEditor = () => {
                const name = editor.querySelector('#rt-dg-editor-name')?.value?.trim() || '';
                const icon = editor.querySelector('#rt-dg-editor-icon')?.value?.trim() || '🗂️';
                const selectedTags = new Set([...editor.querySelectorAll('.rt-dg-member:checked:not(:disabled)')].map(input => input.value));
                const members = memberOrder.filter(tag => selectedTags.has(tag));
                if (!name) {
                    toastr['warning']('Give the Display Group a name.', 'Display Groups');
                    return false;
                }
                if (!members.length) {
                    toastr['warning']('Select at least one module.', 'Display Groups');
                    return false;
                }

                const next = { id: existing?.id || newDisplayGroupId(), name, icon, enabled: existing?.enabled !== false, members };
                if (existing) settings.displayGroups[index] = next;
                else settings.displayGroups.push(next);
                persistDisplayGroups(settings);
                editor.style.display = 'none';
                renderList();
                return true;
            };
            saveOpenEditor = () => editor.style.display !== 'none' ? saveEditor() : true;
            editor.querySelector('#rt-dg-editor-save')?.addEventListener('click', saveEditor);
        };

        root.querySelector('#rt-display-group-add')?.addEventListener('click', () => openEditor(-1));
        renderList();
    }, 100);

    await Popup.show.confirm('🗂️ Display Groups', html, {
        okButton: 'Done',
        cancelButton: 'Cancel',
        onClosing: (popup) => {
            if (popup.result !== POPUP_RESULT.AFFIRMATIVE) return true;
            return saveOpenEditor ? saveOpenEditor() : true;
        },
        wider: true,
        allowVerticalScrolling: true,
    });
}
