/**
 * Tag-based relationship-delta commands returned by the State Tracker.
 *
 * Keeping this separate from the memo lets us read explicit State Tracker
 * commands instead of trying to infer values from narrator prose.
 */

/**
 * @typedef {{ type: 'relationship_delta', npc: string, field: 'friendship'|'affection', delta: number, reason?: string }} RelationshipDeltaCommand
 */

/**
 * Removes the optional [RELATIONS] command block from a State Tracker response
 * and returns the remaining memo text plus validated commands. This deliberately
 * uses line/token parsing rather than a relationship regex: only the command
 * block is interpreted, while NPC names remain free-form.
 *
 * @param {string} response
 * @returns {{ memo: string, commands: RelationshipDeltaCommand[] }}
 */
export function extractStateTrackerRelationshipCommands(response) {
    const source = typeof response === 'string' ? response : '';
    const commands = [];

    // Remove every relationship block before memo processing. An unclosed block is
    // deliberately treated as extending to the end of the response: losing a malformed
    // command is safer than leaking command syntax into persisted tracker state.
    const memo = source.replace(/\[RELATIONS\]([\s\S]*?)(?:\[\/RELATIONS\]|$)/gi, (_match, block) => {
        for (const line of block.split('\n')) {
            const command = parseRelationshipCommandLine(line);
            if (command) commands.push(command);
        }
        return '';
    }).trim();

    return { memo, commands };
}

/** @param {string} line @returns {RelationshipDeltaCommand|null} */
function parseRelationshipCommandLine(line) {
    const parts = String(line || '').trim().replaceAll('\t', ' ').split(' ').filter(Boolean);
    if (parts.length < 2) return null;

    const firstToken = parts.shift()?.toLowerCase() || '';
    let field = firstToken;
    let deltaText = '';
    for (const axis of ['friendship', 'affection']) {
        if (firstToken.startsWith(axis) && firstToken !== axis) {
            field = axis;
            deltaText = firstToken.slice(axis.length);
            break;
        }
    }
    if (!deltaText) deltaText = parts.shift() || '';
    const delta = Number(deltaText);
    const npc = parts.join(' ').trim();

    if ((field !== 'friendship' && field !== 'affection') || !Number.isSafeInteger(delta) || delta === 0 || !npc) {
        return null;
    }

    return { type: 'relationship_delta', npc, field, delta };
}
