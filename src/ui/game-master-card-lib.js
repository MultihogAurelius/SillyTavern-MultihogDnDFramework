export const GAME_MASTER_CARD_NAME = 'Game Master';

export function resolveNarratorCardName(name) {
    const trimmed = String(name || '').trim();
    return trimmed || GAME_MASTER_CARD_NAME;
}

export function normalizeCharacterName(name) {
    return String(name || '').trim().toLowerCase();
}

export function findCharacterByName(charList, targetName) {
    const target = normalizeCharacterName(targetName);
    if (!target) return null;
    return (Array.isArray(charList) ? charList : []).find(c => normalizeCharacterName(c?.name) === target) || null;
}

export function buildGameMasterCharacterCreatePayload(name = GAME_MASTER_CARD_NAME) {
    const cardName = resolveNarratorCardName(name);
    return {
        ch_name: cardName,
        description: '',
        first_mes: '',
        personality: '',
        scenario: '',
        mes_example: '',
        creator_notes: '',
        system_prompt: '',
        post_history_instructions: '',
        creator: '',
        character_version: '',
        tags: [],
        talkativeness: '0.5',
        world: '',
        depth_prompt_prompt: '',
        depth_prompt_depth: '4',
        depth_prompt_role: 'system',
        fav: 'false',
        alternate_greetings: [],
        extensions: '{}',
    };
}
