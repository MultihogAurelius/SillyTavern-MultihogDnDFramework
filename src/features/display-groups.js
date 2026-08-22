/**
 * Display Groups are global, presentation-only group definitions. They never
 * alter memo blocks, prompts, module activation, or Game System ownership.
 */

export const DISPLAY_GROUP_EXCLUDED_TAGS = new Set([
    'COMBAT',
    'BENCHED PARTY',
    'QUESTS',
]);

const MAX_DISPLAY_GROUPS = 50;
const MAX_GROUP_MEMBERS = 100;

export function normalizeDisplayGroupTag(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_ ]/g, '');
}

export function displayGroupRenderKey(id) {
    const safe = String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    return safe ? `DISPLAY_GROUP_${safe}` : '';
}

/**
 * Defensive normalization. First valid group wins if corrupt settings assign
 * one module to multiple groups; later duplicates are ignored.
 */
export function normalizeDisplayGroups(input) {
    if (!Array.isArray(input)) return [];
    const claimedTags = new Set();
    const seenIds = new Set();
    const result = [];

    for (const raw of input.slice(0, MAX_DISPLAY_GROUPS)) {
        if (!raw || typeof raw !== 'object') continue;
        const id = String(raw.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
        const name = String(raw.name || '').trim().slice(0, 80);
        if (!id || !name || seenIds.has(id)) continue;

        const members = [];
        for (const value of Array.isArray(raw.members) ? raw.members.slice(0, MAX_GROUP_MEMBERS) : []) {
            const tag = normalizeDisplayGroupTag(value);
            if (!tag || DISPLAY_GROUP_EXCLUDED_TAGS.has(tag) || claimedTags.has(tag) || members.includes(tag)) continue;
            members.push(tag);
        }
        if (!members.length) continue;

        seenIds.add(id);
        members.forEach(tag => claimedTags.add(tag));
        result.push({
            id,
            name,
            icon: String(raw.icon || '🗂️').trim().slice(0, 16) || '🗂️',
            enabled: raw.enabled !== false,
            members,
        });
    }

    return result;
}

/**
 * Replaces present member tags with a single virtual host at the earliest
 * member position. With the feature off (or invalid data), the original flat
 * tag sequence is returned byte-for-byte in the same order.
 */
export function buildDisplayGroupRenderPlan(tags, groups, enabled) {
    const safeTags = Array.isArray(tags) ? tags.map(normalizeDisplayGroupTag).filter(Boolean) : [];
    if (!enabled) return safeTags.map(tag => ({ kind: 'module', tag }));

    const normalizedGroups = normalizeDisplayGroups(groups).filter(group => group.enabled);
    if (!normalizedGroups.length) return safeTags.map(tag => ({ kind: 'module', tag }));

    const groupByMember = new Map();
    normalizedGroups.forEach(group => group.members.forEach(tag => groupByMember.set(tag, group)));
    const emittedGroups = new Set();
    const plan = [];

    for (const tag of safeTags) {
        const group = groupByMember.get(tag);
        if (!group) {
            plan.push({ kind: 'module', tag });
            continue;
        }
        if (emittedGroups.has(group.id)) continue;

        // Membership order is deliberately user-configurable in the Display
        // Group editor. Respect it here instead of falling back to the raw
        // module order, while still omitting members absent from this memo.
        const presentMembers = group.members.filter(candidate => safeTags.includes(candidate));
        if (!presentMembers.length) {
            plan.push({ kind: 'module', tag });
            continue;
        }

        const key = displayGroupRenderKey(group.id);
        if (!key) {
            presentMembers.forEach(memberTag => plan.push({ kind: 'module', tag: memberTag }));
            emittedGroups.add(group.id);
            continue;
        }

        plan.push({ kind: 'group', key, group, tags: presentMembers });
        emittedGroups.add(group.id);
    }

    return plan;
}

/** Moves all present group members together by one module-order position. */
export function moveDisplayGroupInOrder(order, members, direction) {
    const safeOrder = Array.isArray(order) ? [...order] : [];
    const memberSet = new Set((members || []).map(normalizeDisplayGroupTag).filter(Boolean));
    const groupMembers = safeOrder.filter(tag => memberSet.has(normalizeDisplayGroupTag(tag)));
    if (!groupMembers.length) return safeOrder;

    const firstIndex = safeOrder.findIndex(tag => memberSet.has(normalizeDisplayGroupTag(tag)));
    const beforeCount = safeOrder.slice(0, firstIndex)
        .filter(tag => !memberSet.has(normalizeDisplayGroupTag(tag))).length;
    const remaining = safeOrder.filter(tag => !memberSet.has(normalizeDisplayGroupTag(tag)));
    const insertAt = direction === 'up'
        ? Math.max(0, beforeCount - 1)
        : Math.min(remaining.length, beforeCount + 1);
    remaining.splice(insertAt, 0, ...groupMembers);
    return remaining;
}
