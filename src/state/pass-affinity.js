/**
 * Guard for async agent passes that commit into the shared live settings
 * projection (and optionally a chatStates partition).
 *
 * After a real chat switch, loadChatState projects the arriving chat into the
 * same settings object. A late commit from a pass that started on the departing
 * chat would overwrite the arriving chat's memo/history and persist it.
 *
 * @param {string|null|undefined} passChatId Chat id captured when the pass started.
 * @param {string|null|undefined} currentChatId Live runtime chat id.
 * @param {{ aborted?: boolean }} [opts]
 * @returns {boolean}
 */
export function canCommitPassForChat(passChatId, currentChatId, { aborted = false } = {}) {
    if (aborted) return false;
    if (passChatId == null || String(passChatId).length === 0) return false;
    if (currentChatId == null || String(currentChatId).length === 0) return false;
    return String(passChatId) === String(currentChatId);
}
