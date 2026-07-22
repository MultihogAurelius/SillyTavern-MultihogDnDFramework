/**
 * Mutable UI/controller state shared by the entry module and extracted UI builders.
 * Keeping this in one small module lets large UI units move out without stale copies
 * of chat, history, and callback state.
 */
export const runtimeState = {
    stateModelRunning: false,
    stateController: null,
    currentChatId: null,
    historyViewIndex: -1,
    renderedViewActive: false,
    loreRedoStack: [],
    renderRouterUI: null,
    refreshAgentManifest: async () => {},
    refreshImmersionView: async () => {},
    refreshNpcManifest: async () => {},
    updateAgentWorldStatusRef: null,
    updateWorldProgressionLastFiredDisplayRef: null,
};
