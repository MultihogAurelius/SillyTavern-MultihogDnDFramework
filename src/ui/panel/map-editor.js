import { buildDungeonMapGraph, renderDungeonMapGraphSvg } from '../../../dungeon-map-graph.js';
import {
    MAP_EDITOR_ENUMS,
    MapEditorHistory,
    allocateMapEditorId,
    areaDeletionBlockers,
    cloneMapEditorValue,
    createMapEditorDocument,
    createPortableMapPackage,
    parsePortableMapPackage,
    validateMapEditorDocument,
} from '../../../map-editor-lib.js';

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function optionsHtml(values, selected) {
    return values.map(value => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function stringList(value) {
    return String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

function keywordList(value) {
    return [...new Set(String(value || '').split(/[,;\n]/).map(item => item.trim()).filter(Boolean))].slice(0, 6);
}

function selectedItem(document, selection) {
    if (selection.type === 'area') return document.areas.find(area => area.id === selection.id) || null;
    if (selection.type === 'asset') return document.assets.find(asset => asset.id === selection.id) || null;
    if (selection.type === 'connection') {
        const area = document.areas.find(item => item.id === selection.from);
        return area?.connections?.find(connection => connection.to === selection.to) || null;
    }
    return null;
}

function legalAssetLocations(document, asset) {
    const areas = document.areas.map(area => ({ id: area.id, label: area.name }));
    const containers = document.assets
        .filter(candidate => candidate.id !== asset?.id && (MAP_EDITOR_ENUMS.containerChildKinds[candidate.kind] || []).includes(asset?.kind || 'OBJECT'))
        .map(candidate => ({ id: candidate.id, label: `${candidate.name} (${candidate.kind})` }));
    return [...areas, ...containers];
}

function formField(label, control, hint = '') {
    return `<label class="rt-map-editor-field"><span>${label}</span>${control}${hint ? `<small>${hint}</small>` : ''}</label>`;
}

function locationForm(draft, context) {
    const document = draft.document;
    const isExisting = !!context.exists;
    const hostOptions = (context.mappedSites || []).map(site => `<option value="${escapeHtml(site.siteRoot)}"${draft.attachTo?.site === site.siteRoot ? ' selected' : ''}>${escapeHtml(site.siteRoot)} (${escapeHtml(site.kind || '')})</option>`).join('');
    const parent = (context.mappedSites || []).find(site => site.siteRoot === draft.attachTo?.site);
    const areaOptions = (parent?.areas || []).map(area => `<option value="${escapeHtml(area.name)}"${draft.attachTo?.cell === area.name ? ' selected' : ''}>${escapeHtml(area.name)}</option>`).join('');
    const hosted = !!draft.attachTo;
    return `<div class="rt-map-editor-form-grid">
        ${formField('Canonical location', `<input data-field="site" value="${escapeHtml(document.site)}" ${isExisting ? 'disabled' : ''}>`, isExisting ? 'Existing identities are locked. Export/import to create a renamed copy.' : 'Root name only; hosted breadcrumbs are derived automatically.')}
        ${formField('Map kind', `<select data-field="kind">${optionsHtml(MAP_EDITOR_ENUMS.siteKinds, document.kind)}</select>`)}
        ${formField('Threat', `<select data-field="threat">${optionsHtml(MAP_EDITOR_ENUMS.siteThreats, document.threat || 'MODERATE')}</select>`)}
        ${formField('Keywords', `<input data-field="keywords" value="${escapeHtml(draft.keywords.join(', '))}">`, 'The location name is always included; maximum six total.')}
        ${formField('Location CORE / premise', `<textarea data-field="core" rows="7">${escapeHtml(draft.core)}</textarea>`)}
        ${document.hostSite ? formField('Hosted in', `<input value="${escapeHtml(document.hostSite)}" disabled>`, document.hostBrief || 'Runtime-owned host binding.') : ''}
        ${!isExisting ? `<label class="rt-map-editor-check"><input type="checkbox" data-field="hosted"${hosted ? ' checked' : ''}${document.kind === 'SETTLEMENT' ? ' disabled' : ''}> Create inside an existing parent map</label>
        <div class="rt-map-editor-host-fields" ${hosted ? '' : 'hidden'}>
            ${formField('Parent map', `<select data-field="host-site"><option value="">Choose parent…</option>${hostOptions}</select>`)}
            ${formField('Parent area', `<select data-field="host-cell"><option value="">Choose area…</option>${areaOptions}</select>`)}
        </div>` : ''}
    </div>`;
}

function areaForm(document, area) {
    const connections = (area.connections || []).map(connection => {
        const target = document.areas.find(item => item.id === connection.to);
        return `<button type="button" class="rt-map-editor-list-row" data-select-connection="${escapeHtml(area.id)}|${escapeHtml(connection.to)}"><span>${escapeHtml(target?.name || connection.to)}</span><small>${escapeHtml(connection.state)}</small></button>`;
    }).join('') || '<div class="rt-map-editor-empty">No outgoing routes.</div>';
    const targets = document.areas.filter(item => item.id !== area.id).map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    return `<div class="rt-map-editor-form-grid">
        <div class="rt-map-editor-form-title"><span>Area</span><code>${escapeHtml(area.id)}</code></div>
        ${formField('Name', `<input data-area-field="name" value="${escapeHtml(area.name)}">`)}
        ${formField('Knowledge', `<select data-area-field="knowledge">${optionsHtml(MAP_EDITOR_ENUMS.areaKnowledge, area.knowledge)}</select>`)}
        ${formField('Geometry', `<textarea data-area-field="geometry" rows="8">${escapeHtml((area.geometry || []).join('\n'))}</textarea>`, 'One durable structural fact per line.')}
        <div class="rt-map-editor-subsection"><b>Routes</b>${connections}</div>
        <div class="rt-map-editor-inline"><select data-new-connection-target><option value="">Connect to…</option>${targets}</select><button type="button" class="menu_button" data-action="connect">Connect</button></div>
        <button type="button" class="menu_button danger_button" data-action="delete-area">Delete area</button>
    </div>`;
}

function connectionForm(document, selection, connection) {
    const from = document.areas.find(area => area.id === selection.from);
    const to = document.areas.find(area => area.id === selection.to);
    const reverse = to?.connections?.find(item => item.to === from?.id);
    return `<div class="rt-map-editor-form-grid">
        <div class="rt-map-editor-form-title"><span>Route</span><code>${escapeHtml(from?.name)} → ${escapeHtml(to?.name)}</code></div>
        ${formField('State', `<select data-connection-field="state">${optionsHtml(MAP_EDITOR_ENUMS.connectionStates, connection.state)}</select>`)}
        ${formField('Detail', `<textarea data-connection-field="detail" rows="5">${escapeHtml(connection.detail || '')}</textarea>`)}
        <label class="rt-map-editor-check"><input type="checkbox" data-connection-field="bidirectional"${reverse ? ' checked' : ''}> Keep a matching reverse route</label>
        <button type="button" class="menu_button danger_button" data-action="delete-connection">Delete route</button>
    </div>`;
}

function assetForm(document, asset, linked) {
    const locationOptions = legalAssetLocations(document, asset).map(item => `<option value="${escapeHtml(item.id)}"${item.id === asset.location ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
    const routeChecks = document.areas.map(area => `<label class="rt-map-editor-check"><input type="checkbox" data-asset-route="${escapeHtml(area.id)}"${(asset.route || []).includes(area.id) ? ' checked' : ''}> ${escapeHtml(area.name)}</label>`).join('');
    return `<div class="rt-map-editor-form-grid">
        <div class="rt-map-editor-form-title"><span>Asset</span><code>${escapeHtml(asset.id)}</code>${linked ? '<em>Linked gateway</em>' : ''}</div>
        ${formField('Name', `<input data-asset-field="name" value="${escapeHtml(asset.name)}"${linked ? ' disabled' : ''}>`)}
        ${formField('Kind', `<select data-asset-field="kind"${linked ? ' disabled' : ''}>${optionsHtml(MAP_EDITOR_ENUMS.assetKinds.filter(kind => document.kind === 'SETTLEMENT' || kind !== 'BUILDING'), asset.kind)}</select>`)}
        ${formField('Location / container', `<select data-asset-field="location"${linked ? ' disabled' : ''}>${locationOptions}</select>`)}
        ${formField('State', `<select data-asset-field="state">${optionsHtml(MAP_EDITOR_ENUMS.assetStates, asset.state)}</select>`)}
        ${formField('Knowledge', `<select data-asset-field="knowledge">${optionsHtml(MAP_EDITOR_ENUMS.assetKnowledge, asset.knowledge)}</select>`)}
        ${formField('Detail', `<textarea data-asset-field="detail" rows="5">${escapeHtml(asset.detail || '')}</textarea>`)}
        ${formField('Behavior', `<textarea data-asset-field="behavior" rows="3">${escapeHtml(asset.behavior || '')}</textarea>`)}
        ${formField('Faction', `<input data-asset-field="faction" value="${escapeHtml(asset.faction || '')}">`)}
        ${formField('Owner', `<input data-asset-field="owner" value="${escapeHtml(asset.owner || '')}">`)}
        ${formField('Duration', `<input data-asset-field="duration" value="${escapeHtml(asset.duration || '')}">`)}
        ${formField('Count', `<input type="number" min="1" max="99" data-asset-field="count" value="${asset.count ?? ''}">`)}
        ${asset.kind === 'BUILDING' ? `<label class="rt-map-editor-check"><input type="checkbox" data-asset-field="notEntered"${asset.notEntered !== false ? ' checked' : ''}> Awaiting first-entry population</label>` : ''}
        <details><summary>Movement route</summary><div class="rt-map-editor-check-grid">${routeChecks}</div></details>
        <details><summary>Provenance</summary>
            ${formField('Origin', `<input data-asset-field="origin" value="${escapeHtml(asset.origin || '')}">`)}
            ${formField('Cause', `<input data-asset-field="cause" value="${escapeHtml(asset.cause || '')}">`)}
            ${formField('Actor', `<input data-asset-field="actor" value="${escapeHtml(asset.actor || '')}">`)}
            ${formField('Changed at', `<input data-asset-field="changed_at" value="${escapeHtml(asset.changed_at || '')}">`)}
            ${formField('Last location', `<input data-asset-field="last_location" value="${escapeHtml(asset.last_location || '')}">`, 'Advanced recovery metadata; normally leave unchanged.')}
        </details>
        <div class="rt-map-editor-inline"><button type="button" class="menu_button" data-action="duplicate-asset">Duplicate</button><button type="button" class="menu_button danger_button" data-action="delete-asset"${linked ? ' disabled' : ''}>Delete asset</button></div>
    </div>`;
}

function editorShell() {
    return `<div class="rt-map-editor">
        <header class="rt-map-editor-header"><div><h2><i class="fa-solid fa-map-location-dot"></i> Map Editor</h2><span data-editor-subtitle></span></div>
            <div class="rt-map-editor-actions"><button class="menu_button" data-action="undo">Undo</button><button class="menu_button" data-action="redo">Redo</button><button class="menu_button" data-action="copy">Copy JSON</button><button class="menu_button" data-action="download">Download</button><button class="menu_button" data-action="save"><i class="fa-solid fa-floppy-disk"></i> Save Map</button></div>
        </header>
        <div class="rt-map-editor-tabs" role="tablist"><button data-tab="graph" class="active">Graph</button><button data-tab="details">Details</button><button data-tab="json">JSON / Import</button></div>
        <div class="rt-map-editor-status" role="status"></div>
        <section data-panel="graph" class="rt-map-editor-panel active"><div class="rt-map-editor-graph-toolbar"><button class="menu_button" data-action="add-area">+ Area</button><button class="menu_button" data-action="add-asset">+ Asset</button><span><i class="fa-solid fa-circle-nodes"></i> Click an area for actions. Drag between its side sockets to connect areas.</span></div><div class="rt-map-editor-graph-scroll" data-editor-graph></div></section>
        <section data-panel="details" class="rt-map-editor-panel"><aside class="rt-map-editor-nav"><button data-select-location>Location</button><b>Areas</b><div data-area-list></div><b>Assets</b><div data-asset-list></div></aside><main class="rt-map-editor-details" data-editor-form></main></section>
        <section data-panel="json" class="rt-map-editor-panel"><div class="rt-map-editor-json-actions"><button class="menu_button" data-action="apply-json">Apply JSON to draft</button><button class="menu_button" data-action="import-json">Import package / JSON</button><label class="menu_button">Open file<input type="file" accept="application/json,.json" data-import-file hidden></label></div><textarea data-editor-json spellcheck="false"></textarea><label class="rt-map-editor-check"><input type="checkbox" data-import-metadata> Apply imported CORE and keywords</label></section>
    </div>`;
}

function downloadPackage(pkg) {
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${String(pkg.location?.suggestedName || 'multihog-map').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'multihog-map'}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Open the graphical map editor for a new, unmapped, or existing location. */
export async function openMapEditor({ siteRoot = '', document: suppliedDocument = null, core = '', keywords = [] } = {}) {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx?.callGenericPopup) return null;
    const router = await import('../../../router.js');
    const context = await router.loadMapEditorLocation(siteRoot);
    const initialDocument = suppliedDocument || context.document || createMapEditorDocument({ site: siteRoot, kind: 'SETTLEMENT' });
    const initial = {
        document: cloneMapEditorValue(initialDocument),
        core: core || context.core || '',
        keywords: keywords.length ? [...keywords] : [...(context.keywords || [])],
        attachTo: null,
    };
    const history = new MapEditorHistory(initial);
    let draft = history.value;
    let selection = { type: 'location' };
    let tab = 'graph';
    let rawDirty = false;
    let saved = false;
    let nodeMenu = null;
    let connectionPreview = null;
    const root = document.createElement('div');
    root.innerHTML = editorShell();
    const editor = root.firstElementChild;
    const status = editor.querySelector('.rt-map-editor-status');
    const graphHost = editor.querySelector('[data-editor-graph]');
    const formHost = editor.querySelector('[data-editor-form]');
    const raw = editor.querySelector('[data-editor-json]');

    const validation = (candidate = draft) => validateMapEditorDocument(candidate.document, {
        site: context.exists ? context.siteRoot : candidate.document.site,
        originalDocument: context.document,
        linkedGatewayIds: context.linkedGatewayIds,
    });
    const setStatus = (message, kind = '') => { status.textContent = message; status.dataset.kind = kind; };
    const paintValidation = (candidate = draft, validMessage = 'Unsaved changes.') => {
        const result = validation(candidate);
        editor.querySelector('[data-action="save"]').disabled = !result.valid || saved;
        if (!result.valid) {
            setStatus(`${result.errors.length} validation issue${result.errors.length === 1 ? '' : 's'}: ${result.errors[0].path} — ${result.errors[0].message}`, 'error');
        } else if (status.dataset.kind === 'error') {
            setStatus(validMessage);
        }
        return result;
    };
    const push = (next, message = 'Unsaved changes.') => {
        closeNodeMenu();
        draft = history.push(next);
        rawDirty = false;
        setStatus(message);
        paint();
    };
    const mutate = (fn, message) => { const next = cloneMapEditorValue(draft); fn(next); push(next, message); };
    function closeNodeMenu() {
        nodeMenu?.remove();
        nodeMenu = null;
    }
    function openNodeMenu(areaId, event) {
        closeNodeMenu();
        const area = draft.document.areas.find(item => item.id === areaId);
        if (!area) return;
        nodeMenu = document.createElement('div');
        nodeMenu.className = 'rt-map-editor-node-menu';
        nodeMenu.dataset.menuArea = area.id;
        nodeMenu.innerHTML = `<b>${escapeHtml(area.name)}</b>
            <button type="button" data-node-action="edit"><i class="fa-solid fa-pen"></i> Edit area details</button>
            <button type="button" data-node-action="add-asset"><i class="fa-solid fa-diamond"></i> Add asset here</button>
            <button type="button" data-node-action="add-connected"><i class="fa-solid fa-plus"></i> Add connected area</button>
            <div class="rt-map-editor-node-menu-hint"><i class="fa-regular fa-circle-dot"></i> Drag either side socket to another area.</div>
            <button type="button" class="danger" data-node-action="delete"><i class="fa-solid fa-trash"></i> Delete area</button>`;
        editor.appendChild(nodeMenu);
        const bounds = editor.getBoundingClientRect();
        const width = 210;
        const x = Math.max(8, Math.min(bounds.width - width - 8, event.clientX - bounds.left + 10));
        const y = Math.max(8, Math.min(bounds.height - 220, event.clientY - bounds.top + 10));
        nodeMenu.style.left = `${x}px`;
        nodeMenu.style.top = `${y}px`;
    }
    function cleanupConnectionPreview() {
        connectionPreview?.overlay?.remove();
        connectionPreview = null;
        editor.classList.remove('rt-map-editor-connecting');
    }
    function updateConnectionPreview(event) {
        if (!connectionPreview) return;
        const { startX, startY, path } = connectionPreview;
        const endX = event.clientX;
        const endY = event.clientY;
        const bend = Math.max(70, Math.abs(endX - startX) * 0.45);
        const direction = connectionPreview.side === 'left' ? -1 : 1;
        path.setAttribute('d', `M ${startX} ${startY} C ${startX + bend * direction} ${startY}, ${endX - bend * direction} ${endY}, ${endX} ${endY}`);
    }
    function finishConnectionDrag(event) {
        if (!connectionPreview) return;
        const fromId = connectionPreview.areaId;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-port-area]');
        const toId = target?.dataset?.portArea || '';
        cleanupConnectionPreview();
        if (!toId || toId === fromId) {
            setStatus(toId === fromId ? 'Choose a different area.' : 'Connection cancelled.');
            return;
        }
        const fromArea = draft.document.areas.find(area => area.id === fromId);
        if (fromArea?.connections?.some(connection => connection.to === toId)) {
            setStatus('Those areas are already connected.', 'error');
            return;
        }
        mutate(next => {
            const from = next.document.areas.find(area => area.id === fromId);
            const to = next.document.areas.find(area => area.id === toId);
            if (!from || !to) return;
            from.connections.push({ to: to.id, state: 'OPEN', detail: '' });
            if (!to.connections.some(connection => connection.to === from.id)) to.connections.push({ to: from.id, state: 'OPEN', detail: '' });
            selection = { type: 'connection', from: from.id, to: to.id };
        }, 'Areas connected. Click the route to edit its state and description.');
    }
    function startConnectionDrag(port, event) {
        closeNodeMenu();
        cleanupConnectionPreview();
        const rect = port.getBoundingClientRect();
        const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        overlay.classList.add('rt-map-editor-connection-preview');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        overlay.appendChild(path);
        document.body.appendChild(overlay);
        connectionPreview = {
            overlay,
            path,
            areaId: port.dataset.portArea,
            side: port.dataset.portSide,
            startX: rect.left + rect.width / 2,
            startY: rect.top + rect.height / 2,
        };
        editor.classList.add('rt-map-editor-connecting');
        updateConnectionPreview(event);
        const move = moveEvent => updateConnectionPreview(moveEvent);
        const up = upEvent => {
            document.removeEventListener('pointermove', move, true);
            document.removeEventListener('pointerup', up, true);
            document.removeEventListener('pointercancel', cancel, true);
            finishConnectionDrag(upEvent);
        };
        const cancel = () => {
            document.removeEventListener('pointermove', move, true);
            document.removeEventListener('pointerup', up, true);
            document.removeEventListener('pointercancel', cancel, true);
            cleanupConnectionPreview();
        };
        document.addEventListener('pointermove', move, true);
        document.addEventListener('pointerup', up, true);
        document.addEventListener('pointercancel', cancel, true);
    }
    const setTab = next => {
        tab = next;
        editor.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
        editor.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab));
    };
    const renderNav = () => {
        editor.querySelector('[data-area-list]').innerHTML = draft.document.areas.map(area => `<button class="${selection.type === 'area' && selection.id === area.id ? 'active' : ''}" data-select-area="${escapeHtml(area.id)}">${escapeHtml(area.name)}</button>`).join('');
        editor.querySelector('[data-asset-list]').innerHTML = draft.document.assets.map(asset => `<button class="${selection.type === 'asset' && selection.id === asset.id ? 'active' : ''}" data-select-asset="${escapeHtml(asset.id)}"><span>${escapeHtml(asset.name)}</span><small>${escapeHtml(asset.kind)}</small></button>`).join('') || '<div class="rt-map-editor-empty">No assets.</div>';
    };
    const renderForm = () => {
        const item = selectedItem(draft.document, selection);
        if (selection.type === 'area' && item) formHost.innerHTML = areaForm(draft.document, item);
        else if (selection.type === 'asset' && item) formHost.innerHTML = assetForm(draft.document, item, context.linkedGatewayIds.includes(item.id));
        else if (selection.type === 'connection' && item) formHost.innerHTML = connectionForm(draft.document, selection, item);
        else { selection = { type: 'location' }; formHost.innerHTML = locationForm(draft, context); }
    };
    function paint() {
        editor.querySelector('[data-editor-subtitle]').textContent = `${draft.document.site || 'New location'} · ${draft.document.kind}`;
        const graph = buildDungeonMapGraph(draft.document, { playerFacing: false });
        graphHost.innerHTML = renderDungeonMapGraphSvg(graph, { compact: false, siteRoot: draft.document.site, editorPorts: true });
        renderNav();
        renderForm();
        if (!rawDirty) raw.value = JSON.stringify(draft.document, null, 2);
        editor.querySelector('[data-action="undo"]').disabled = !history.canUndo;
        editor.querySelector('[data-action="redo"]').disabled = !history.canRedo;
        paintValidation();
    }

    editor.addEventListener('click', async event => {
        const target = event.target.closest('button, [data-area-id], [data-edge-from]');
        if (!target) return;
        if (event.target.closest('[data-port-area]')) return;
        if (target.dataset.nodeAction) {
            const areaId = target.closest('[data-menu-area]')?.dataset.menuArea;
            if (!areaId) return;
            if (target.dataset.nodeAction === 'edit') {
                selection = { type: 'area', id: areaId };
                closeNodeMenu();
                setTab('details');
                paint();
                return;
            }
            if (target.dataset.nodeAction === 'add-asset') {
                mutate(next => {
                    const name = 'New Asset';
                    const id = allocateMapEditorId(next.document, name, 'asset');
                    next.document.assets.push({ id, kind: 'OBJECT', name, location: areaId, state: 'ACTIVE', knowledge: 'UNREVEALED', detail: '', origin: 'INITIAL_MAP' });
                    selection = { type: 'asset', id };
                }, 'Asset added to area.');
                setTab('details');
                return;
            }
            if (target.dataset.nodeAction === 'add-connected') {
                mutate(next => {
                    const source = next.document.areas.find(area => area.id === areaId);
                    if (!source) return;
                    const name = `Area ${next.document.areas.length + 1}`;
                    const id = allocateMapEditorId(next.document, name, 'area');
                    const added = { id, name, knowledge: 'UNREVEALED', geometry: [], connections: [{ to: source.id, state: 'OPEN', detail: '' }] };
                    source.connections.push({ to: id, state: 'OPEN', detail: '' });
                    next.document.areas.push(added);
                    selection = { type: 'area', id };
                }, 'Connected area added.');
                return;
            }
            if (target.dataset.nodeAction === 'delete') {
                const blockers = areaDeletionBlockers(draft.document, areaId);
                if (blockers.length) { closeNodeMenu(); setStatus(blockers.join(' '), 'error'); return; }
                mutate(next => { next.document.areas = next.document.areas.filter(area => area.id !== areaId); selection = { type: 'location' }; }, 'Area deleted.');
                return;
            }
        }
        if (target.dataset.tab) { setTab(target.dataset.tab); return; }
        if (target.dataset.areaId) { openNodeMenu(target.dataset.areaId, event); return; }
        if (target.dataset.selectArea) { selection = { type: 'area', id: target.dataset.selectArea }; setTab('details'); paint(); return; }
        if (target.dataset.selectAsset) { selection = { type: 'asset', id: target.dataset.selectAsset }; setTab('details'); paint(); return; }
        if (target.hasAttribute('data-select-location')) { selection = { type: 'location' }; paint(); return; }
        if (target.dataset.edgeFrom) { selection = { type: 'connection', from: target.dataset.edgeFrom, to: target.dataset.edgeTo }; setTab('details'); paint(); return; }
        if (target.dataset.selectConnection) { const [from, to] = target.dataset.selectConnection.split('|'); selection = { type: 'connection', from, to }; paint(); return; }
        const action = target.dataset.action;
        if (!action) return;
        if (action === 'undo' || action === 'redo') { draft = action === 'undo' ? history.undo() : history.redo(); rawDirty = false; paint(); return; }
        if (action === 'add-area') {
            mutate(next => { const name = `Area ${next.document.areas.length + 1}`; const id = allocateMapEditorId(next.document, name, 'area'); next.document.areas.push({ id, name, knowledge: 'UNREVEALED', geometry: [], connections: [] }); selection = { type: 'area', id }; }, 'Area added.');
            setTab('details'); return;
        }
        if (action === 'connect') {
            const to = formHost.querySelector('[data-new-connection-target]')?.value;
            if (!to || selection.type !== 'area') return;
            mutate(next => {
                const fromArea = next.document.areas.find(area => area.id === selection.id);
                const toArea = next.document.areas.find(area => area.id === to);
                if (!fromArea || !toArea || fromArea.connections.some(connection => connection.to === to)) return;
                fromArea.connections.push({ to, state: 'OPEN', detail: '' });
                if (!toArea.connections.some(connection => connection.to === fromArea.id)) toArea.connections.push({ to: fromArea.id, state: 'OPEN', detail: '' });
                selection = { type: 'connection', from: fromArea.id, to };
            }, 'Route added.'); return;
        }
        if (action === 'add-asset') {
            mutate(next => { const area = next.document.areas[0]; const name = `New Asset`; const id = allocateMapEditorId(next.document, name, 'asset'); next.document.assets.push({ id, kind: 'OBJECT', name, location: area?.id || '', state: 'ACTIVE', knowledge: 'UNREVEALED', detail: '', origin: 'INITIAL_MAP' }); selection = { type: 'asset', id }; }, 'Asset added.');
            setTab('details'); return;
        }
        if (action === 'delete-area' && selection.type === 'area') {
            const blockers = areaDeletionBlockers(draft.document, selection.id);
            if (blockers.length) { setStatus(blockers.join(' '), 'error'); return; }
            mutate(next => { next.document.areas = next.document.areas.filter(area => area.id !== selection.id); selection = { type: 'location' }; }, 'Area deleted.'); return;
        }
        if (action === 'delete-connection' && selection.type === 'connection') {
            mutate(next => { const from = next.document.areas.find(area => area.id === selection.from); if (from) from.connections = from.connections.filter(connection => connection.to !== selection.to); selection = { type: 'area', id: selection.from }; }, 'Route deleted.'); return;
        }
        if (action === 'duplicate-asset' && selection.type === 'asset') {
            mutate(next => { const source = next.document.assets.find(asset => asset.id === selection.id); if (!source) return; const copy = cloneMapEditorValue(source); copy.name = `${source.name} Copy`; copy.id = allocateMapEditorId(next.document, copy.name, 'asset'); next.document.assets.push(copy); selection = { type: 'asset', id: copy.id }; }, 'Asset duplicated.'); return;
        }
        if (action === 'delete-asset' && selection.type === 'asset') {
            const children = draft.document.assets.filter(asset => asset.location === selection.id);
            if (children.length) { setStatus(`Move or delete ${children.length} contained asset${children.length === 1 ? '' : 's'} first.`, 'error'); return; }
            mutate(next => { next.document.assets = next.document.assets.filter(asset => asset.id !== selection.id); selection = { type: 'location' }; }, 'Asset deleted.'); return;
        }
        if (action === 'apply-json' || action === 'import-json') {
            if (action === 'apply-json') {
                let parsed; try { parsed = JSON.parse(raw.value); } catch (error) { setStatus(String(error.message || error), 'error'); return; }
                const checked = validateMapEditorDocument(parsed, { site: context.exists ? context.siteRoot : parsed.site, originalDocument: context.document, linkedGatewayIds: context.linkedGatewayIds });
                if (!checked.valid) { setStatus(`${checked.errors[0].path}: ${checked.errors[0].message}`, 'error'); return; }
                mutate(next => { next.document = parsed; selection = { type: 'location' }; }, 'Raw JSON applied to draft.'); return;
            }
            const imported = parsePortableMapPackage(raw.value, { site: draft.document.site });
            if (!imported.ok) { setStatus(imported.errors[0], 'error'); return; }
            mutate(next => {
                next.document = imported.package.map;
                if (editor.querySelector('[data-import-metadata]').checked) {
                    next.core = String(imported.package.location?.core || '');
                    next.keywords = [...(imported.package.location?.keywords || [])];
                }
                selection = { type: 'location' };
            }, 'Imported map loaded into draft.'); return;
        }
        const pkg = createPortableMapPackage(draft.document, { suggestedName: draft.document.site, core: draft.core, keywords: draft.keywords });
        if (action === 'copy') { await navigator.clipboard.writeText(JSON.stringify(pkg, null, 2)); setStatus('Portable map JSON copied.'); return; }
        if (action === 'download') { downloadPackage(pkg); setStatus('Portable map downloaded.'); return; }
        if (action === 'save') {
            const checked = validation();
            if (!checked.valid) { setStatus(`${checked.errors[0].path}: ${checked.errors[0].message}`, 'error'); return; }
            target.disabled = true; setStatus('Saving map…');
            try {
                const result = await router.persistMapEditorDocument({ siteRoot: draft.document.site, document: draft.document, core: draft.core, keywords: draft.keywords, expectedMap: context.expectedMap, attachTo: draft.attachTo });
                saved = true; history.markSaved(); setStatus(`Map saved for ${result.document?.site || draft.document.site}.`, 'success');
                globalThis.toastr?.success?.(`Map saved for ${result.document?.site || draft.document.site}.`, 'Map Editor');
                document.dispatchEvent(new CustomEvent('rt_lore_agent_updated', { detail: { source: 'map-editor' } }));
            } catch (error) { setStatus(String(error?.message || error), 'error'); target.disabled = false; }
        }
    });

    editor.addEventListener('pointerdown', event => {
        const port = event.target.closest?.('[data-port-area]');
        if (!port || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        startConnectionDrag(port, event);
    });
    editor.addEventListener('pointerdown', event => {
        if (nodeMenu && !event.target.closest('.rt-map-editor-node-menu') && !event.target.closest('[data-area-id]')) closeNodeMenu();
    });

    editor.addEventListener('input', event => {
        if (event.target === raw) { rawDirty = true; return; }
        if (event.target.dataset.field === 'site') {
            const preview = cloneMapEditorValue(draft);
            preview.document.site = event.target.value.trim();
            editor.querySelector('[data-editor-subtitle]').textContent = `${preview.document.site || 'New location'} · ${preview.document.kind}`;
            paintValidation(preview);
        }
    });
    editor.addEventListener('change', event => {
        const field = event.target.dataset.field;
        if (event.target === raw || event.target.matches('[data-import-file], [data-import-metadata]')) return;
        if (!field && !event.target.dataset.areaField && !event.target.dataset.assetField && !event.target.dataset.connectionField && !event.target.dataset.assetRoute) return;
        const next = cloneMapEditorValue(draft);
        if (field === 'site') next.document.site = event.target.value.trim();
        else if (field === 'kind') { next.document.kind = event.target.value; if (next.document.kind === 'SETTLEMENT') next.attachTo = null; }
        else if (field === 'threat') next.document.threat = event.target.value;
        else if (field === 'core') next.core = event.target.value;
        else if (field === 'keywords') next.keywords = keywordList(event.target.value);
        else if (field === 'hosted') next.attachTo = event.target.checked ? { site: '', cell: '' } : null;
        else if (field === 'host-site') next.attachTo = { site: event.target.value, cell: '' };
        else if (field === 'host-cell') next.attachTo = { ...(next.attachTo || {}), cell: event.target.value };
        else if (selection.type === 'area') {
            const area = next.document.areas.find(item => item.id === selection.id); const key = event.target.dataset.areaField;
            if (area && key === 'name') area.name = event.target.value;
            if (area && key === 'knowledge') area.knowledge = event.target.value;
            if (area && key === 'geometry') area.geometry = stringList(event.target.value);
        } else if (selection.type === 'asset') {
            const asset = next.document.assets.find(item => item.id === selection.id); const key = event.target.dataset.assetField;
            if (asset && key) {
                if (key === 'count') { if (event.target.value) asset.count = Number(event.target.value); else delete asset.count; }
                else if (key === 'notEntered') asset.notEntered = event.target.checked;
                else { asset[key] = event.target.value; if (!asset[key] && !['detail', 'origin'].includes(key)) delete asset[key]; }
            }
            if (asset && event.target.dataset.assetRoute) {
                const routes = new Set(asset.route || []); event.target.checked ? routes.add(event.target.dataset.assetRoute) : routes.delete(event.target.dataset.assetRoute); asset.route = [...routes]; if (!asset.route.length) delete asset.route;
            }
        } else if (selection.type === 'connection') {
            const from = next.document.areas.find(area => area.id === selection.from); const to = next.document.areas.find(area => area.id === selection.to); const connection = from?.connections?.find(item => item.to === selection.to); const key = event.target.dataset.connectionField;
            if (connection && key === 'state') connection.state = event.target.value;
            if (connection && key === 'detail') connection.detail = event.target.value;
            if (connection && key === 'bidirectional') {
                const reverse = to?.connections?.find(item => item.to === selection.from);
                if (event.target.checked && to && !reverse) to.connections.push({ to: selection.from, state: connection.state, detail: connection.detail });
                if (!event.target.checked && to) to.connections = to.connections.filter(item => item.to !== selection.from);
            }
            const reverse = to?.connections?.find(item => item.to === selection.from);
            if (reverse && key !== 'bidirectional') { reverse.state = connection.state; reverse.detail = connection.detail; }
        }
        draft = history.push(next); rawDirty = false; paint();
    });

    editor.querySelector('[data-import-file]').addEventListener('change', async event => {
        const file = event.target.files?.[0]; if (!file) return;
        raw.value = await file.text(); rawDirty = true; setTab('json'); setStatus('File loaded. Click Import package / JSON to add it to the draft.');
    });
    paint();
    return ctx.callGenericPopup(editor, ctx.POPUP_TYPE?.TEXT ?? 1, '', {
        okButton: 'Close editor', cancelButton: false, wide: true, large: true, allowVerticalScrolling: false,
        onClosing: () => {
            closeNodeMenu();
            cleanupConnectionPreview();
            return saved || !history.dirty || globalThis.confirm?.('Discard unsaved map editor changes?');
        },
        onOpen: popup => { popup.dlg.classList.add('rt-map-editor-dialog'); },
    });
}
