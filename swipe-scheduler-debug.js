/**
 * swipe-scheduler-debug.js — Lorebook Agent run-every counter & swipe-rollback instrumentation.
 *
 * Exposes live state and an event ring-buffer on:
 *   globalThis._rpgSwipeSchedulerDebug
 *
 * Usage (browser console):
 *   _rpgSwipeSchedulerDebug.dump()      — print current snapshot
 *   _rpgSwipeSchedulerDebug.snapshot() — get snapshot object
 *   _rpgSwipeSchedulerDebug.log()       — event history (newest first)
 *   _rpgSwipeSchedulerDebug.togglePanel()
 */

import { getSettings } from './state-manager.js';
import { isRouterRunning } from './router.js';

const MAX_EVENTS = 400;
/** @type {Array<Record<string, unknown>>} */
let eventLog = [];
/** @type {Record<string, Function>} */
let providers = {};
let panel = null;
let panelOpen = false;

/**
 * @param {Record<string, Function>} p
 */
export function registerSwipeSchedulerProviders(p) {
    providers = { ...providers, ...p };
}

/**
 * @param {string} type
 * @param {Record<string, unknown>} [detail]
 */
export function recordSchedulerEvent(type, detail = {}) {
    const entry = {
        ts: new Date().toISOString(),
        t: Date.now(),
        type,
        ...detail,
    };
    eventLog.unshift(entry);
    if (eventLog.length > MAX_EVENTS) eventLog.length = MAX_EVENTS;

    const settings = getSettings();
    if (settings?.debugMode) {
        console.log(`[RPG Scheduler] ${type}`, detail);
    }

    try {
        document.dispatchEvent(new CustomEvent('rt_swipe_scheduler_event', { detail: entry }));
    } catch (_) { /* non-DOM contexts */ }

    if (panelOpen) renderSchedulerPanel();
}

/**
 * Summarize message.extra fields relevant to swipe rollback.
 * @param {any} msg
 */
function summarizeMessageExtra(msg) {
    if (!msg?.extra) return null;
    const e = msg.extra;
    return {
        swipe_id: msg.swipe_id ?? 0,
        rpgMemoActiveSwipe: e.rpgMemoActiveSwipe,
        rpgActiveSwipe: e.rpgActiveSwipe,
        rpgRouterRanForSwipe: e.rpgRouterRanForSwipe,
        rpgRouterRunId: e.rpgRouterRunId,
        rpgRouterPrePassWatermark: e.rpgRouterPrePassWatermark,
        rpgRouterPostPassWatermark: e.rpgRouterPostPassWatermark,
        memoRollbackKeys: e.rpgMemoRollback ? Object.keys(e.rpgMemoRollback) : [],
        memoResultKeys: e.rpgMemoResult ? Object.keys(e.rpgMemoResult) : [],
        relRollbackKeys: e.rpgRollbackData ? Object.keys(e.rpgRollbackData) : [],
        processedTagKeys: e.rpgProcessedTags && !Array.isArray(e.rpgProcessedTags)
            ? Object.keys(e.rpgProcessedTags) : [],
    };
}

/**
 * Build a point-in-time snapshot of everything the scheduler/rollback logic cares about.
 */
export function getSchedulerSnapshot() {
    const settings = getSettings();
    const ctx = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
    const chat = ctx?.chat || [];
    const lastAi = [...chat].reverse().find(m => !m.is_user && !m.is_system);
    const internals = typeof providers.getInternals === 'function' ? providers.getInternals() : {};

    const runEvery = settings.routerRunEvery || 1;
    const tick = internals.routerAutoTick ?? 0;
    const nextIn = runEvery > 1 ? Math.max(0, runEvery - tick) : 0;

    const hist0 = settings.routerHistory?.[0];
    const lastDecision = internals.lastTickDecision || null;

    return {
        capturedAt: new Date().toISOString(),
        counters: {
            routerAutoTick: tick,
            routerRunEvery: runEvery,
            nextInMsgs: nextIn,
            stateTrackerAutoTick: internals.stateTrackerAutoTick ?? null,
            stateTrackerRunEvery: settings.stateTrackerRunEvery || 1,
            pendingKeywordTriggered: internals.pendingKeywordCount ?? 0,
        },
        generation: {
            lastType: internals.lastGenerationType ?? null,
            isGenerating: internals.isGenerating ?? null,
            lastTickDecision: lastDecision,
        },
        flags: {
            routerEnabled: !!settings.routerEnabled,
            routerPaused: !!settings.routerPaused,
            debugMode: !!settings.debugMode,
            npcRelationshipBars: !!settings.npcRelationshipBars,
            stateTrackerSwipeRollback: settings.stateTrackerSwipeRollback !== false,
            routerLookbackSinceLastRun: settings.routerLookbackSinceLastRun !== false,
            routerSwipeRollback: settings.routerSwipeRollback !== false,
            routerWatermarkBaselinePending: !!settings.routerWatermarkBaselinePending,
            isRouterRunning: typeof isRouterRunning === 'function' ? isRouterRunning() : null,
            isStateModelRunning: typeof globalThis._rpgStateModelRunning === 'function'
                ? globalThis._rpgStateModelRunning() : null,
        },
        watermark: {
            routerLastRunChatLength: settings.routerLastRunChatLength ?? 0,
            chatLength: chat.length,
            delta: chat.length - (settings.routerLastRunChatLength ?? 0),
        },
        routerHistoryHead: hist0 ? {
            timestamp: hist0.timestamp,
            runId: hist0.runId,
            routerLastRunChatLength: hist0.routerLastRunChatLength,
            bookCount: Object.keys(hist0.bookSnapshots || {}).length,
        } : null,
        lastAiMessage: lastAi ? {
            index: chat.indexOf(lastAi),
            swipe_id: lastAi.swipe_id ?? 0,
            textLen: lastAi.mes?.length ?? 0,
            extra: summarizeMessageExtra(lastAi),
        } : null,
        recentEvents: eventLog.slice(0, 15).map(e => ({
            ts: e.ts,
            type: e.type,
            ...(e.reason !== undefined ? { reason: e.reason } : {}),
            ...(e.generationType !== undefined ? { generationType: e.generationType } : {}),
            ...(e.countsTowardRunEvery !== undefined ? { countsTowardRunEvery: e.countsTowardRunEvery } : {}),
            ...(e.tickBefore !== undefined ? { tickBefore: e.tickBefore } : {}),
            ...(e.tickAfter !== undefined ? { tickAfter: e.tickAfter } : {}),
        })),
    };
}

/**
 * Pretty-print snapshot to the console.
 */
export function dumpSchedulerState() {
    const snap = getSchedulerSnapshot();
    console.group('[RPG Scheduler] snapshot');
    console.log('counters', snap.counters);
    console.log('generation', snap.generation);
    console.log('flags', snap.flags);
    console.log('watermark', snap.watermark);
    console.log('routerHistoryHead', snap.routerHistoryHead);
    console.log('lastAiMessage', snap.lastAiMessage);
    console.log('recentEvents', snap.recentEvents);
    console.log('full', snap);
    console.groupEnd();
    return snap;
}

/** @returns {Array<Record<string, unknown>>} */
export function getSchedulerEventLog() {
    return [...eventLog];
}

export function clearSchedulerEventLog() {
    eventLog = [];
    if (panelOpen) renderSchedulerPanel();
}

function renderSchedulerPanel() {
    if (!panel) return;
    const snap = getSchedulerSnapshot();
    const pre = panel.querySelector('.rpg-scheduler-pre');
    const logEl = panel.querySelector('.rpg-scheduler-log');
    if (pre) {
        pre.textContent = JSON.stringify(snap, null, 2);
    }
    if (logEl) {
        logEl.innerHTML = eventLog.slice(0, 80).map(e => {
            const line = `[${e.ts}] ${e.type} ${JSON.stringify(
                Object.fromEntries(Object.entries(e).filter(([k]) => !['ts', 't', 'type'].includes(k)))
            )}`;
            return `<div class="rpg-scheduler-log-line">${line.replace(/</g, '&lt;')}</div>`;
        }).join('') || '<div class="rpg-scheduler-log-empty">No events yet.</div>';
    }
}

function ensureSchedulerPanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'rpg-swipe-scheduler-debug';
    panel.className = 'rpg-swipe-scheduler-debug';
    panel.style.cssText = [
        'position:fixed', 'bottom:12px', 'left:12px', 'z-index:10050',
        'width:min(520px,92vw)', 'max-height:min(70vh,600px)',
        'background:rgba(12,14,20,0.96)', 'border:1px solid rgba(255,255,255,0.15)',
        'border-radius:8px', 'color:#e8e8e8', 'font:12px/1.4 monospace',
        'display:none', 'flex-direction:column', 'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
    ].join(';');

    panel.innerHTML = `
        <div class="rpg-scheduler-header" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.1);cursor:move;user-select:none;">
            <span>⏱️ Swipe / Run-Every Scheduler</span>
            <span>
                <button type="button" class="rpg-scheduler-refresh" title="Refresh" style="margin-right:6px;">↻</button>
                <button type="button" class="rpg-scheduler-clear" title="Clear log" style="margin-right:6px;">🧹</button>
                <button type="button" class="rpg-scheduler-close" title="Close">✕</button>
            </span>
        </div>
        <div style="padding:8px 10px;overflow:auto;flex:1 1 auto;">
            <div style="opacity:0.7;margin-bottom:4px;">Snapshot (live)</div>
            <pre class="rpg-scheduler-pre" style="margin:0 0 10px;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto;background:rgba(0,0,0,0.35);padding:8px;border-radius:4px;"></pre>
            <div style="opacity:0.7;margin-bottom:4px;">Event log (newest first)</div>
            <div class="rpg-scheduler-log" style="max-height:200px;overflow:auto;background:rgba(0,0,0,0.25);padding:6px;border-radius:4px;"></div>
        </div>
        <div style="padding:6px 10px;border-top:1px solid rgba(255,255,255,0.08);opacity:0.65;font-size:11px;">
            Console: <code>_rpgSwipeSchedulerDebug.dump()</code>
        </div>
    `;

    document.body.appendChild(panel);

    panel.querySelector('.rpg-scheduler-close')?.addEventListener('click', () => toggleSchedulerPanel(false));
    panel.querySelector('.rpg-scheduler-clear')?.addEventListener('click', () => clearSchedulerEventLog());
    panel.querySelector('.rpg-scheduler-refresh')?.addEventListener('click', () => renderSchedulerPanel());

    document.addEventListener('rt_swipe_scheduler_event', () => {
        if (panelOpen) renderSchedulerPanel();
    });
    document.addEventListener('rt_generation_tick', () => {
        if (panelOpen) renderSchedulerPanel();
    });
    document.addEventListener('rt_lore_agent_updated', () => {
        if (panelOpen) renderSchedulerPanel();
    });

    return panel;
}

/**
 * @param {boolean} [open]
 */
export function toggleSchedulerPanel(open) {
    ensureSchedulerPanel();
    if (open === undefined) panelOpen = !panelOpen;
    else panelOpen = !!open;
    if (!panel) return;
    panel.style.display = panelOpen ? 'flex' : 'none';
    if (panelOpen) renderSchedulerPanel();
}

/**
 * @param {Record<string, Function>} providersIn
 */
export function installSwipeSchedulerDebug(providersIn = {}) {
    registerSwipeSchedulerProviders(providersIn);

    globalThis._rpgSwipeSchedulerDebug = {
        snapshot: getSchedulerSnapshot,
        dump: dumpSchedulerState,
        log: getSchedulerEventLog,
        clear: clearSchedulerEventLog,
        togglePanel: toggleSchedulerPanel,
        open: () => toggleSchedulerPanel(true),
        close: () => toggleSchedulerPanel(false),
    };

    recordSchedulerEvent('debug_installed', {
        hint: 'Call _rpgSwipeSchedulerDebug.dump() or .togglePanel()',
    });

    console.info('[RPG Scheduler] Debug API ready: globalThis._rpgSwipeSchedulerDebug');
}
