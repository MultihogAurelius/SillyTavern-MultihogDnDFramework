const RECOVERY_STORAGE_KEY = 'rpg_tracker_memo_recovery_v1';
const MAX_RECOVERY_CHATS = 8;

/**
 * Creates the browser-local memo and settings recovery service.
 * Dependencies are injected so this module stays independent of the main UI controller.
 */
export function createMemoRecoveryManager({
    getSettings,
    saveSettings,
    updateUIMemo,
    refreshRenderedView,
    syncMemoView,
    escapeHtml,
}) {
    let recoveryPromptActive = false;
    let bootCheckDone = false;

    function snapshotMemoToLocalStorage(chatId, opts = {}) {
        if (!chatId || recoveryPromptActive) return;
        if (!bootCheckDone && !opts.force) return;
        try {
            const settings = getSettings();
            const memo = settings.currentMemo || '';
            if (!memo.trim()) return;
            let map = {};
            try { map = JSON.parse(localStorage.getItem(RECOVERY_STORAGE_KEY) || '{}') || {}; } catch (_) { map = {}; }
            const existing = map[chatId];
            if (!opts.allowDowngrade && existing?.currentMemo && existing.currentMemo.length > memo.length) {
                console.warn('[RPG Tracker] Refusing to shrink local memo backup', {
                    chatId,
                    localChars: existing.currentMemo.length,
                    incomingChars: memo.length,
                });
                return;
            }
            map[chatId] = {
                ts: Date.now(),
                currentMemo: memo,
                lastDelta: settings.lastDelta || '',
                quests: Array.isArray(settings.quests) ? settings.quests : [],
            };
            const ids = Object.keys(map).sort((a, b) => (map[b]?.ts || 0) - (map[a]?.ts || 0));
            for (const id of ids.slice(MAX_RECOVERY_CHATS)) delete map[id];
            localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(map));
        } catch (err) {
            console.warn('[RPG Tracker] localStorage memo snapshot failed:', err);
        }
    }

    function formatRecoveryTimestamp(ts) {
        const n = Number(ts);
        if (!n || !Number.isFinite(n) || n <= 0) return 'unknown time';
        try {
            const date = new Date(n);
            const absolute = date.toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', second: '2-digit',
            });
            const ageMs = Date.now() - n;
            if (ageMs < 0) return absolute;
            const mins = Math.round(ageMs / 60000);
            if (mins < 1) return `${absolute} (just now)`;
            if (mins < 60) return `${absolute} (~${mins} min ago)`;
            const hours = Math.round(mins / 60);
            if (hours < 48) return `${absolute} (~${hours}h ago)`;
            return `${absolute} (~${Math.round(hours / 24)}d ago)`;
        } catch (_) {
            return 'unknown time';
        }
    }

    async function checkLocalMemoRecovery(chatId) {
        let prompted = false;
        let restored = false;
        try {
            if (!chatId) {
                console.warn('[RPG Tracker] Memo recovery skipped: no chatId yet');
                return;
            }
            let entry = null;
            try {
                const map = JSON.parse(localStorage.getItem(RECOVERY_STORAGE_KEY) || '{}') || {};
                entry = map[chatId] || null;
            } catch (_) { entry = null; }
            if (!entry || !entry.currentMemo || !entry.currentMemo.trim()) {
                console.warn('[RPG Tracker] Memo recovery skipped: no local backup for this chat', { chatId });
                return;
            }
            const settings = getSettings();
            const diskMemo = settings.currentMemo || '';
            if (entry.currentMemo === diskMemo) {
                console.warn('[RPG Tracker] Memo recovery skipped: disk already matches local backup', { chatId, chars: diskMemo.length });
                return;
            }
            const diskChatState = settings.chatStates?.[chatId];
            const diskStamp = diskChatState
                ? (Number(diskChatState.memoPersistedAt) || 0)
                : (Number(settings.memoPersistedAt) || 0);
            const ctx = SillyTavern.getContext();
            if (typeof ctx.callGenericPopup !== 'function') {
                console.warn('[RPG Tracker] Memo recovery skipped: popup API unavailable');
                return;
            }

            prompted = true;
            recoveryPromptActive = true;
            const localWhen = formatRecoveryTimestamp(entry.ts);
            const diskWhen = formatRecoveryTimestamp(diskStamp);
            const diskLabel = diskStamp > 0 ? 'Disk version (this chat)' : 'Disk version (this chat; no saved timestamp)';
            const content = `<div style="text-align:left; line-height:1.45;">
                <p><b>Possible unsaved tracker data found.</b></p>
                <p>This browser has a local copy of the STATE MEMO for this chat that differs from what's currently on disk. This can happen after a cancelled save or when another browser wrote a newer copy. Choose which version to keep.</p>
                <p style="margin:10px 0; padding:8px 10px; background:rgba(255,255,255,0.05); border-radius:6px; font-size:0.95em;">
                    <b>Local backup</b> (this browser)<br>
                    ${entry.currentMemo.length.toLocaleString()} chars · ${escapeHtml(localWhen)}<br><br>
                    <b>${diskLabel}</b><br>
                    ${diskMemo.length.toLocaleString()} chars · ${escapeHtml(diskWhen)}
                </p>
                <p style="margin-top:10px; padding:8px 10px; border-left:3px solid #f0ad4e; background:rgba(240,173,78,0.12); border-radius:4px;"><b>Look behind this dialog</b> (background is left unblurred on purpose). If the tracker / chat UI looks outdated or stale compared to what you just had — click <b>Restore</b>.</p>
                <p>Restore the local backup?</p>
            </div>`;
            const { Popup, POPUP_TYPE } = ctx;
            let result = false;
            if (typeof Popup === 'function') {
                const popup = new Popup(content, POPUP_TYPE?.CONFIRM ?? 1, '', {
                    okButton: 'Restore',
                    cancelButton: 'Keep disk version (keep what\'s visible right now)',
                    leftAlign: true,
                    animation: 'none',
                });
                popup.dlg?.classList.add('rt-recovery-popup');
                result = await popup.show();
            } else {
                result = await ctx.callGenericPopup(content, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', {
                    okButton: 'Restore',
                    cancelButton: 'Keep disk version (keep what\'s visible right now)',
                    leftAlign: true,
                    animation: 'none',
                });
            }
            if (result) {
                settings.currentMemo = entry.currentMemo;
                settings.lastDelta = entry.lastDelta || settings.lastDelta;
                if (Array.isArray(entry.quests)) settings.quests = entry.quests;
                saveSettings(true);
                if (typeof updateUIMemo === 'function') updateUIMemo(settings.currentMemo);
                if (typeof refreshRenderedView === 'function') refreshRenderedView();
                if (typeof syncMemoView === 'function') syncMemoView();
                toastr.success('Local backup restored.', 'RPG Tracker');
                restored = true;
            }
        } catch (err) {
            console.warn('[RPG Tracker] Local memo recovery prompt failed:', err);
        } finally {
            recoveryPromptActive = false;
            if (chatId) {
                bootCheckDone = true;
                if (prompted) snapshotMemoToLocalStorage(chatId, { force: true, allowDowngrade: !restored });
            }
        }
    }

    async function ensureLocalMemoRecovery(chatId) {
        if (bootCheckDone || !chatId) return;
        await checkLocalMemoRecovery(chatId);
        if (!bootCheckDone) bootCheckDone = true;
    }

    async function confirmLocalSettingsRecovery(backup) {
        const ctx = SillyTavern.getContext();
        const localWhen = formatRecoveryTimestamp(backup?.ts);
        const content = `<div style="text-align:left;line-height:1.45;">
            <p><b>Browser configuration differs from settings.json.</b></p>
            <p>This browser has a saved local configuration snapshot from ${escapeHtml(localWhen)} that does not match the disk version. It may be a save that was interrupted—or an older cache from another browser session.</p>
            <p style="margin:10px 0;padding:8px 10px;border-left:3px solid #f0ad4e;background:rgba(240,173,78,0.12);border-radius:4px;">This includes tracker fields, narrator settings, stock prompts, and <b>CYOA settings and presets</b>. Nothing will be restored automatically.</p>
            <p style="margin:10px 0;padding:8px 10px;border-left:3px solid #f0ad4e;background:rgba(240,173,78,0.12);border-radius:4px;"><b>Look behind this dialog</b> (background is left unblurred on purpose). Use the tracker / chat UI you can see to judge whether local looks newer or staler than disk, then choose.</p>
            <p>Restore this browser's local configuration?</p>
        </div>`;
        try {
            const { Popup, POPUP_TYPE } = ctx;
            if (typeof Popup === 'function') {
                const popup = new Popup(content, POPUP_TYPE?.CONFIRM ?? 1, '', {
                    okButton: 'Restore local configuration',
                    cancelButton: 'Keep disk configuration (keep what\'s visible right now)',
                    leftAlign: true,
                    animation: 'none',
                });
                popup.dlg?.classList.add('rt-recovery-popup');
                return !!await popup.show();
            }
            return !!await ctx.callGenericPopup?.(content, ctx.POPUP_TYPE?.CONFIRM ?? 1, '', {
                okButton: 'Restore local configuration',
                cancelButton: 'Keep disk configuration (keep what\'s visible right now)',
                leftAlign: true,
                animation: 'none',
            });
        } catch (err) {
            console.warn('[RPG Tracker] Settings recovery prompt failed:', err);
            return false;
        }
    }

    return {
        snapshotMemoToLocalStorage,
        ensureLocalMemoRecovery,
        confirmLocalSettingsRecovery,
        isBootCheckDone: () => bootCheckDone,
        markBootCheckDone: () => { bootCheckDone = true; },
    };
}

export { RECOVERY_STORAGE_KEY, MAX_RECOVERY_CHATS };
