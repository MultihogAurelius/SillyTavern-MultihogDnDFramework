import { getSettings } from '../../../state-manager.js';
import {
    MAP_ASSET_KINDS,
    advanceCampaignTime,
    currentCampaignTimeLabel,
    debugAddAsset,
    debugClearEvolutionHistory,
    debugRedoLastEvolutionPass,
    debugRunEvolution,
    debugSetAsset,
    debugSimulateTicks,
    debugUndoLastEvolutionPass,
    describeEvolutionSandbox,
    peekTestingGroundLastPass,
    setCampaignTimeLabel,
} from '../../../map-evolution-debug.js';
import { collectEvolutionArcSubjects, describeEvolutionAssetArc, stripEvolutionDigestSitePrefix } from '../../../map-evolution-lib.js';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function optionList(values, selected = '') {
    return values.map(value => {
        const label = typeof value === 'string' ? value : value.label;
        const id = typeof value === 'string' ? value : value.id;
        return `<option value="${escapeHtml(id)}"${id === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
}

function prettyJson(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value ?? '');
    }
}

function formatTokenCount(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return String(n);
}

function renderMemoryBar(memory) {
    const mem = memory || {};
    const closed = formatTokenCount(mem.closedTokens);
    const threshold = formatTokenCount(mem.threshold);
    const over = !!mem.overThreshold;
    const enabled = mem.compressEnabled !== false;
    const status = !enabled
        ? 'Compression off'
        : over
            ? 'At or over threshold — this Evolution pass will compress closed threads after it records'
            : 'Under threshold — closed history is kept verbatim';
    return `
        <div class="rt-map-evo-debug-memory-bar${over ? ' is-over' : ''}${enabled ? '' : ' is-off'}">
            <div class="rt-map-evo-debug-stat">
                <span>Closed-thread tokens</span>
                <strong data-debug="closed-tokens">${escapeHtml(closed)} / ${escapeHtml(threshold)}</strong>
            </div>
            <div class="rt-map-evo-debug-stat">
                <span>Open threads (kept)</span>
                <strong>${escapeHtml(formatTokenCount(mem.openTokens))} tok · ${escapeHtml(String(mem.openCount || 0))}</strong>
            </div>
            <div class="rt-map-evo-debug-stat">
                <span>Backlog</span>
                <strong>${escapeHtml(formatTokenCount(mem.backlogTokens))} tok · ${escapeHtml(String(mem.backlogCount || 0))}</strong>
            </div>
            <div class="rt-map-evo-debug-stat">
                <span>Stored memory total</span>
                <strong>${escapeHtml(formatTokenCount(mem.totalTokens))} tok · ${escapeHtml(String(mem.entryCount || 0))} events${mem.digestCount ? ` · ${escapeHtml(String(mem.digestCount))} digest${mem.digestCount === 1 ? '' : 's'}` : ''}</strong>
            </div>
        </div>
        <p class="rt-map-evo-debug-memory-status">${escapeHtml(status)}</p>
    `;
}

function renderMemoryLedger(memory) {
    const mem = memory || {};
    const threadJson = prettyJson(mem.storedThreads || []);
    const backlogJson = prettyJson(mem.storedBacklog || []);
    const threadText = String(mem.threadText || '').trim() || '(No causal-thread text stored.)';
    const backlogText = String(mem.backlogText || '').trim() || '(No evolution backlog stored.)';
    return `
        <section class="rt-map-evo-debug-memory">
            <div class="rt-map-evo-debug-subtitle">Stored evolution memory</div>
            <p class="rt-map-evo-debug-lead">This is the site ledger as stored. Closed events are what compression measures; DIGEST rows are compressor output; currently open threads stay verbatim.</p>
            <div class="rt-map-evo-debug-memory-grid">
                <section>
                    <div class="rt-map-evo-debug-subtitle">Causal threads (stored JSON)</div>
                    <pre class="rt-map-evo-debug-memory-pre" data-debug="threads-json">${escapeHtml(threadJson)}</pre>
                </section>
                <section>
                    <div class="rt-map-evo-debug-subtitle">Evolution backlog (stored JSON)</div>
                    <pre class="rt-map-evo-debug-memory-pre" data-debug="backlog-json">${escapeHtml(backlogJson)}</pre>
                </section>
            </div>
            <div class="rt-map-evo-debug-subtitle">Causal threads as Evolution reads them</div>
            <pre class="rt-map-evo-debug-memory-pre" data-debug="threads-text">${escapeHtml(threadText)}</pre>
            <div class="rt-map-evo-debug-subtitle">Backlog as Evolution reads it</div>
            <pre class="rt-map-evo-debug-memory-pre" data-debug="backlog-text">${escapeHtml(backlogText)}</pre>
        </section>
    `;
}

function renderThreads(threads) {
    const open = threads?.open || [];
    if (!open.length && !(threads?.entries || []).length) {
        return '<div class="rt-map-evo-debug-empty">No causal threads yet. Kill, wound, or move someone with a cause to start one.</div>';
    }
    const openHtml = open.length
        ? open.map(entry => `<li><span class="rt-map-evo-debug-open">OPEN</span> <code>${escapeHtml(entry.subjectId)}</code>${entry.actor ? ` by ${escapeHtml(entry.actor)}` : ''}: ${escapeHtml(entry.cause)} <time>${escapeHtml(entry.at)}</time></li>`).join('')
        : '<li class="rt-map-evo-debug-empty">No open threads.</li>';
    const recentEntries = [...(threads?.entries || [])].reverse();
    const recent = recentEntries.map(entry => {
        const kind = entry.compressed ? 'compressed' : (entry.status || 'open');
        const label = entry.compressed ? 'DIGEST' : String(entry.status || 'open').toUpperCase();
        const badgeClass = entry.compressed ? 'rt-map-evo-debug-compressed' : `rt-map-evo-debug-${kind}`;
        return `<li><span class="${badgeClass}">${escapeHtml(label)}</span> ${escapeHtml(entry.summary)} <time>${escapeHtml(entry.at)}</time></li>`;
    }).join('');
    const truncated = threads?.truncated
        ? `<div class="rt-map-evo-debug-empty">Older events were dropped at the stored-history cap.</div>`
        : '';
    return `<div class="rt-map-evo-debug-subtitle">Open threads</div><ul class="rt-map-evo-debug-list">${openHtml}</ul>
        <div class="rt-map-evo-debug-subtitle">Attributed events</div><ul class="rt-map-evo-debug-list">${recent || '<li class="rt-map-evo-debug-empty">None.</li>'}</ul>${truncated}`;
}

function renderAssets(document, selectedId = '') {
    const assets = Array.isArray(document?.assets) ? document.assets : [];
    if (!assets.length) return '<div class="rt-map-evo-debug-empty">No assets on this map.</div>';
    return `<ul class="rt-map-evo-debug-list">${assets.map(asset => {
        const cause = asset.cause ? ` — ${escapeHtml(asset.cause)}` : '';
        const actor = asset.actor ? ` by ${escapeHtml(asset.actor)}` : '';
        const since = asset.changed_at ? ` <time>${escapeHtml(asset.changed_at)}</time>` : '';
        const count = Number.isInteger(asset.count) ? ` ×${asset.count}` : '';
        const selected = asset.id === selectedId ? ' is-selected' : '';
        return `<li class="rt-map-evo-debug-asset${selected}" data-debug-arc="${escapeHtml(asset.id)}" title="Follow this asset's arc"><code>${escapeHtml(asset.id)}</code> ${escapeHtml(asset.name)}${count} [${escapeHtml(asset.kind)} / ${escapeHtml(asset.state)} / ${escapeHtml(asset.location || '—')}]${actor}${cause}${since}</li>`;
    }).join('')}</ul>`;
}

function arcSubjectOptions(subjects, selectedId) {
    const blank = [{ id: '', label: 'Select an asset to follow' }, ...subjects.map(subject => {
        const bits = [];
        if (subject.kind) bits.push(subject.kind);
        if (subject.state) bits.push(subject.state);
        if (!subject.onMap) bits.push('off-map');
        if (subject.open) bits.push('OPEN');
        if (subject.eventCount) bits.push(`${subject.eventCount} event${subject.eventCount === 1 ? '' : 's'}`);
        const extra = bits.length ? ` — ${bits.join(' · ')}` : '';
        return { id: subject.id, label: `${subject.name} (${subject.id})${extra}` };
    })];
    return optionList(blank, selectedId);
}

function renderAssetArc(sandbox, selectedId) {
    const storedThreads = sandbox?.memory?.storedThreads || [];
    const storedBacklog = sandbox?.memory?.storedBacklog || [];
    const subjects = collectEvolutionArcSubjects(storedThreads, sandbox?.document);
    if (!subjects.length) {
        return `<section class="rt-map-evo-debug-arc" data-debug="arc">
            <div class="rt-map-evo-debug-subtitle">Asset arc</div>
            <div class="rt-map-evo-debug-empty">No assets or attributed events to follow yet.</div>
        </section>`;
    }
    const chosen = String(selectedId || '').trim();
    const arc = chosen
        ? describeEvolutionAssetArc(storedThreads, chosen, { storedBacklog, document: sandbox?.document })
        : null;
    const occupancy = arc?.asset
        ? `<code>${escapeHtml(arc.asset.id)}</code> ${escapeHtml(arc.asset.name)}${Number.isInteger(arc.asset.count) ? ` ×${arc.asset.count}` : ''} [${escapeHtml(arc.asset.kind)} / ${escapeHtml(arc.asset.state)} / ${escapeHtml(arc.asset.location || '—')}]${arc.open ? ' · <span class="rt-map-evo-debug-open">OPEN</span>' : ''}`
        : chosen
            ? `<code>${escapeHtml(chosen)}</code> is not on the current map.${arc?.open ? ' Thread is still <span class="rt-map-evo-debug-open">OPEN</span>.' : ''}`
            : 'Pick an asset from the list or the dropdown. Only that subject’s events are shown, including when it acted on someone else and DIGEST mentions after compression.';
    const events = (arc?.events || []).map(entry => {
        const kind = entry.compressed ? 'compressed' : (entry.status || 'open');
        const label = entry.compressed ? 'DIGEST' : String(entry.status || 'open').toUpperCase();
        const badgeClass = entry.compressed ? 'rt-map-evo-debug-compressed' : `rt-map-evo-debug-${kind}`;
        const role = entry.role === 'actor' ? 'acted' : entry.role === 'digest' ? 'mentioned' : 'subject';
        return `<li>
            <time>${escapeHtml(entry.at)}</time>
            <span class="${badgeClass}">${escapeHtml(label)}</span>
            <span class="rt-map-evo-debug-arc-role">${escapeHtml(role)}</span>
            ${escapeHtml(stripEvolutionDigestSitePrefix(entry.summary, sandbox?.siteRoot))}
        </li>`;
    }).join('');
    const backlog = (arc?.backlogHits || []).map(entry => (
        `<li><time>${escapeHtml(entry.at)}</time> <span class="rt-map-evo-debug-transformed">BACKLOG</span> ${escapeHtml(stripEvolutionDigestSitePrefix(entry.summary, sandbox?.siteRoot))}</li>`
    )).join('');
    const empty = chosen && !events && !backlog
        ? '<div class="rt-map-evo-debug-empty">No stored events mention this asset yet.</div>'
        : '';
    return `<section class="rt-map-evo-debug-arc" data-debug="arc">
        <div class="rt-map-evo-debug-subtitle">Asset arc</div>
        <p class="rt-map-evo-debug-lead">Follow one asset through occupancy changes. Click an asset on the right, or choose it here.</p>
        <label class="rt-map-evo-debug-site">Follow
            <select data-debug="arc-subject">${arcSubjectOptions(subjects, chosen)}</select>
        </label>
        <div class="rt-map-evo-debug-arc-now">${occupancy}</div>
        ${events ? `<ol class="rt-map-evo-debug-arc-list">${events}</ol>` : ''}
        ${backlog ? `<div class="rt-map-evo-debug-subtitle">Matching Evolution backlog</div><ul class="rt-map-evo-debug-list">${backlog}</ul>` : ''}
        ${empty}
    </section>`;
}

function areaOptions(document) {
    return (document?.areas || []).map(area => ({ id: area.id, label: `${area.name} (${area.id})` }));
}

function assetOptions(document) {
    return (document?.assets || []).map(asset => ({ id: asset.id, label: `${asset.name} [${asset.state}]` }));
}

/**
 * Open the Map Evolution testing ground for simulation and balancing.
 * @param {{ siteRoot?: string }} [options]
 */
export async function openMapEvolutionTestingGround({ siteRoot = '' } = {}) {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx?.callGenericPopup) return;

    const popup = document.createElement('div');
    popup.className = 'rt-map-evo-debug';
    let sandbox = await describeEvolutionSandbox(siteRoot);
    const settings = getSettings();
    let selectedArcId = '';

    const paint = () => {
        const areas = areaOptions(sandbox.document);
        const assets = assetOptions(sandbox.document);
        const lastPass = peekTestingGroundLastPass();
        popup.innerHTML = `
            <div class="rt-map-evo-debug-title"><i class="fa-solid fa-flask"></i> Map Evolution Testing Ground</div>
            <p class="rt-map-evo-debug-lead">Advance time, spawn or kill entities with causes, and run Evolution without playing through the campaign. Changes write to this chat's maps and [TIME] block. After a pass, Undo restores the map, [TIME], Last Evolved, and Evolution memory to immediately before that run so you can Redo the same pass. Clear evolution history before comparing prompts so prior ticks do not bias the next pass.</p>
            <label class="rt-map-evo-debug-site">Site
                <select data-debug="site">${optionList(sandbox.sites.map(site => ({
                    id: site.siteRoot,
                    label: `${site.siteRoot}${site.current ? ' (current)' : ''}`,
                })), sandbox.siteRoot)}</select>
            </label>
            <div class="rt-map-evo-debug-stats">
                <div class="rt-map-evo-debug-stat">
                    <span>In-world time</span>
                    <strong data-debug="time">${escapeHtml(sandbox.timeLabel || 'Unknown')}</strong>
                </div>
                <div class="rt-map-evo-debug-stat">
                    <span>Last evolved</span>
                    <strong>${escapeHtml(sandbox.lastEvolved || 'Never')}</strong>
                </div>
                <div class="rt-map-evo-debug-stat">
                    <span>Elapsed</span>
                    <strong>${escapeHtml(sandbox.timeWindow?.elapsed || 'Unknown')}</strong>
                </div>
            </div>
            ${renderMemoryBar(sandbox.memory)}
            <div class="rt-map-evo-debug-row">
                <input type="text" data-debug="set-time" class="text_pole" placeholder="Set time, e.g. Day 3, 08:00" value="${escapeHtml(currentCampaignTimeLabel())}">
                <button type="button" class="menu_button" data-debug-action="set-time">Set time</button>
                <input type="number" data-debug="hours" class="text_pole" min="1" max="168" value="${escapeHtml(String(settings.mapEvolutionIntervalHours ?? 12))}" title="Hours to advance">
                <button type="button" class="menu_button" data-debug-action="advance-hours">Advance hours</button>
                <button type="button" class="menu_button" data-debug-action="advance-day">+1 day</button>
            </div>
            <div class="rt-map-evo-debug-row">
                <button type="button" class="menu_button" data-debug-action="evolve"><i class="fa-solid fa-wand-magic-sparkles"></i> Evolve this map now</button>
                <input type="number" data-debug="ticks" class="text_pole" min="1" max="20" value="3" title="How many simulate ticks">
                <button type="button" class="menu_button" data-debug-action="simulate"><i class="fa-solid fa-forward"></i> Simulate ticks</button>
                <button type="button" class="menu_button" data-debug-action="undo-pass" title="Restore map, [TIME], Last Evolved, and Evolution memory to immediately before the last Evolve or Simulate run." ${!lastPass || lastPass.undone ? 'disabled' : ''}><i class="fa-solid fa-rotate-left"></i> Undo last pass</button>
                <button type="button" class="menu_button" data-debug-action="redo-pass" title="Restore the pre-pass snapshot, then run that same Evolve or Simulate again." ${!lastPass ? 'disabled' : ''}><i class="fa-solid fa-rotate-right"></i> Redo last pass</button>
                <button type="button" class="menu_button" data-debug-action="clear-history" title="Clears backlog and causal threads for this site. Does not change the map, [TIME], or Last Evolved."><i class="fa-solid fa-eraser"></i> Clear evolution history</button>
            </div>
            <div class="rt-map-evo-debug-status" data-debug="status" role="status"></div>
            <details class="rt-map-evo-debug-form" open>
                <summary>Create entity</summary>
                <div class="rt-map-evo-debug-form-grid">
                    <input type="text" data-debug="add-name" class="text_pole" placeholder="Name">
                    <select data-debug="add-kind">${optionList(MAP_ASSET_KINDS, 'CREATURE')}</select>
                    <select data-debug="add-location">${optionList(areas)}</select>
                    <input type="number" data-debug="add-count" class="text_pole" min="1" max="99" placeholder="Count (packs: 2–99)">
                    <input type="text" data-debug="add-faction" class="text_pole" placeholder="Faction (optional)">
                    <input type="text" data-debug="add-cause" class="text_pole" placeholder="Cause (required)">
                    <input type="text" data-debug="add-actor" class="text_pole" placeholder="Actor (optional)">
                </div>
                <div class="rt-map-evo-debug-row">
                    <button type="button" class="menu_button" data-debug-action="add">Add to map</button>
                </div>
            </details>
            <details class="rt-map-evo-debug-form" open>
                <summary>Kill / change entity</summary>
                <div class="rt-map-evo-debug-form-grid">
                    <select data-debug="set-asset">${optionList(assets)}</select>
                    <select data-debug="set-state">${optionList(['DESTROYED', 'DEAD', 'DEACTIVATED', 'DAMAGED', 'FLEEING', 'LEFT', 'ACTIVE', 'ALERT'], 'DESTROYED')}</select>
                    <input type="number" data-debug="set-count" class="text_pole" min="1" max="99" placeholder="Count (attrition)">
                    <input type="text" data-debug="set-actor" class="text_pole" placeholder='Actor: party, asset id, or "salt-road-delvers"'>
                    <input type="text" data-debug="set-cause" class="text_pole" placeholder="Cause, e.g. Killed by the party">
                </div>
                <div class="rt-map-evo-debug-row">
                    <button type="button" class="menu_button" data-debug-action="set">Apply change</button>
                </div>
            </details>
            <div class="rt-map-evo-debug-columns">
                <section>
                    <div class="rt-map-evo-debug-subtitle">Causal threads</div>
                    <div class="rt-map-evo-debug-pane" data-debug="threads">${renderThreads(sandbox.threads)}</div>
                </section>
                <section>
                    <div class="rt-map-evo-debug-subtitle">Assets</div>
                    <div class="rt-map-evo-debug-pane" data-debug="assets">${renderAssets(sandbox.document, selectedArcId)}</div>
                </section>
            </div>
            ${renderAssetArc(sandbox, selectedArcId)}
            ${renderMemoryLedger(sandbox.memory)}
        `;
        bind();
    };

    const setStatus = (text) => {
        const status = popup.querySelector('[data-debug="status"]');
        if (status) status.textContent = text || '';
    };

    const reload = async (root = popup.querySelector('[data-debug="site"]')?.value || sandbox.siteRoot) => {
        sandbox = await describeEvolutionSandbox(root);
        const subjects = collectEvolutionArcSubjects(sandbox?.memory?.storedThreads || [], sandbox?.document);
        if (selectedArcId && !subjects.some(subject => subject.id === selectedArcId)) selectedArcId = '';
        paint();
    };

    const bind = () => {
        popup.querySelector('[data-debug="site"]')?.addEventListener('change', async (event) => {
            await reload(event.target.value);
        });
        popup.querySelector('[data-debug-action="set-time"]')?.addEventListener('click', async () => {
            const result = setCampaignTimeLabel(popup.querySelector('[data-debug="set-time"]')?.value);
            setStatus(result.ok ? `Time set to ${result.timeLabel}.` : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="advance-hours"]')?.addEventListener('click', async () => {
            const hours = Number(popup.querySelector('[data-debug="hours"]')?.value) || 12;
            const result = advanceCampaignTime(hours * 60);
            setStatus(result.ok ? `Advanced to ${result.timeLabel}.` : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="advance-day"]')?.addEventListener('click', async () => {
            const result = advanceCampaignTime(1440);
            setStatus(result.ok ? `Advanced to ${result.timeLabel}.` : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="evolve"]')?.addEventListener('click', async () => {
            setStatus(`Running Map Evolution for ${sandbox.siteRoot}…`);
            const result = await debugRunEvolution(sandbox.siteRoot);
            if (result?.skipped === 'busy') setStatus('An agent is already running.');
            else if (result?.ok && result?.applied) setStatus(`Evolution applied ${result.applied} material update(s). Undo to rewind that pass.`);
            else if (result?.ok) setStatus('Evolution ran; no material change. Undo to rewind that pass.');
            else setStatus(result?.error || 'Evolution failed.');
            await reload();
        });
        popup.querySelector('[data-debug-action="simulate"]')?.addEventListener('click', async () => {
            const ticks = Number(popup.querySelector('[data-debug="ticks"]')?.value) || 3;
            const hours = Number(popup.querySelector('[data-debug="hours"]')?.value) || Number(getSettings().mapEvolutionIntervalHours) || 12;
            setStatus(`Simulating ${ticks} tick(s) at ${hours}h…`);
            const result = await debugSimulateTicks({
                siteRoot: sandbox.siteRoot,
                ticks,
                hoursPerTick: hours,
                onTick: ({ index, count, timeLabel, phase }) => {
                    setStatus(`Tick ${index + 1}/${count} (${phase}) at ${timeLabel}…`);
                },
            });
            if (!result.ok) setStatus(result.error || 'Simulation stopped.');
            else setStatus(`Simulated ${result.ticks} tick(s) of ${result.hoursPerTick}h. Undo to rewind that run.`);
            await reload();
        });
        popup.querySelector('[data-debug-action="undo-pass"]')?.addEventListener('click', async () => {
            setStatus('Restoring the pre-pass snapshot…');
            const result = await debugUndoLastEvolutionPass();
            if (result?.skipped === 'busy') setStatus('An agent is already running.');
            else if (result.ok) {
                const kind = result.action?.type === 'simulate' ? 'Simulate ticks' : 'Evolve';
                setStatus(`Undid ${kind} on ${result.siteRoot}. Redo to run that same pass again.`);
            } else setStatus(result.error || 'Undo failed.');
            await reload();
        });
        popup.querySelector('[data-debug-action="redo-pass"]')?.addEventListener('click', async () => {
            const prior = peekTestingGroundLastPass();
            const kind = prior?.action?.type === 'simulate' ? 'Simulate ticks' : 'Evolve';
            setStatus(`Redoing ${kind}…`);
            const result = await debugRedoLastEvolutionPass({
                onTick: ({ index, count, timeLabel, phase }) => {
                    setStatus(`Redo tick ${index + 1}/${count} (${phase}) at ${timeLabel}…`);
                },
            });
            if (result?.skipped === 'busy') setStatus('An agent is already running.');
            else if (result?.ok && result?.action?.type === 'simulate') setStatus(`Redid Simulate: ${result.ticks} tick(s) of ${result.hoursPerTick}h.`);
            else if (result?.ok && result?.applied) setStatus(`Redid Evolve: applied ${result.applied} material update(s).`);
            else if (result?.ok) setStatus('Redid Evolve; no material change.');
            else setStatus(result?.error || 'Redo failed.');
            await reload();
        });
        popup.querySelector('[data-debug-action="clear-history"]')?.addEventListener('click', async () => {
            const root = sandbox.siteRoot;
            const confirmed = window.confirm(`Clear evolution backlog and causal threads for "${root}"?\n\nThe map occupancy, [TIME], and Last Evolved clock stay as they are. This only removes prompt history so a later Evolution pass is not biased by ticks from a previous prompt.`);
            if (!confirmed) return;
            const result = debugClearEvolutionHistory(root);
            setStatus(result.ok ? `Cleared evolution history for ${root}.` : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="add"]')?.addEventListener('click', async () => {
            const result = await debugAddAsset({
                siteRoot: sandbox.siteRoot,
                name: popup.querySelector('[data-debug="add-name"]')?.value,
                kind: popup.querySelector('[data-debug="add-kind"]')?.value,
                location: popup.querySelector('[data-debug="add-location"]')?.value,
                count: popup.querySelector('[data-debug="add-count"]')?.value,
                faction: popup.querySelector('[data-debug="add-faction"]')?.value,
                cause: popup.querySelector('[data-debug="add-cause"]')?.value,
                actor: popup.querySelector('[data-debug="add-actor"]')?.value,
            });
            setStatus(result.ok ? 'Entity added.' : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug-action="set"]')?.addEventListener('click', async () => {
            const result = await debugSetAsset({
                siteRoot: sandbox.siteRoot,
                assetId: popup.querySelector('[data-debug="set-asset"]')?.value,
                state: popup.querySelector('[data-debug="set-state"]')?.value,
                count: popup.querySelector('[data-debug="set-count"]')?.value,
                actor: popup.querySelector('[data-debug="set-actor"]')?.value,
                cause: popup.querySelector('[data-debug="set-cause"]')?.value,
            });
            setStatus(result.ok ? 'Entity updated.' : result.error);
            if (result.ok) await reload();
        });
        popup.querySelector('[data-debug="arc-subject"]')?.addEventListener('change', (event) => {
            selectedArcId = String(event.target.value || '').trim();
            paintArc();
        });
        popup.querySelectorAll('[data-debug-arc]').forEach(node => {
            node.addEventListener('click', () => {
                selectedArcId = String(node.getAttribute('data-debug-arc') || '').trim();
                paintArc();
            });
        });
    };

    const paintArc = () => {
        const host = popup.querySelector('[data-debug="arc"]');
        if (host) host.outerHTML = renderAssetArc(sandbox, selectedArcId);
        popup.querySelectorAll('[data-debug-arc]').forEach(node => {
            node.classList.toggle('is-selected', node.getAttribute('data-debug-arc') === selectedArcId);
        });
        popup.querySelector('[data-debug="arc-subject"]')?.addEventListener('change', (event) => {
            selectedArcId = String(event.target.value || '').trim();
            paintArc();
        });
    };

    paint();
    await ctx.callGenericPopup(popup, ctx.POPUP_TYPE?.TEXT ?? 1, '', {
        okButton: 'Close', cancelButton: false, wide: true, large: true,
        allowVerticalScrolling: true,
        leftAlign: true,
    });
}
