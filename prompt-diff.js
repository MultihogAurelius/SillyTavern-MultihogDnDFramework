/**
 * Compact line-diff helpers for the Prompt Defaults Updated dialog.
 * No third-party deps — LCS on line arrays with display caps.
 */

/**
 * @typedef {'add'|'del'|'ctx'} DiffLineType
 * @typedef {{ type: DiffLineType, text: string }} DiffLine
 * @typedef {{ lines: DiffLine[], additions: number, deletions: number, truncated: boolean, omitted: number }} DiffResult
 */

const DEFAULT_MAX_CHANGED = 80;
const CONTEXT = 2;
/** Soft cap: above this product, skip full LCS and show a coarse summary. */
const MAX_LCS_CELLS = 2_000_000;

/**
 * @param {string} text
 * @returns {string[]}
 */
function splitLines(text) {
    return String(text ?? '').replace(/\r\n/g, '\n').split('\n');
}

/**
 * LCS-based edit script → ops { type: 'eq'|'ins'|'del', text }.
 * @param {string[]} a
 * @param {string[]} b
 */
function lcsOps(a, b) {
    const n = a.length;
    const m = b.length;
    /** @type {Uint32Array[]} */
    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);

    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] = a[i] === b[j]
                ? dp[i + 1][j + 1] + 1
                : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    /** @type {{ type: 'eq'|'ins'|'del', text: string }[]} */
    const ops = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            ops.push({ type: 'eq', text: a[i] });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push({ type: 'del', text: a[i] });
            i++;
        } else {
            ops.push({ type: 'ins', text: b[j] });
            j++;
        }
    }
    while (i < n) {
        ops.push({ type: 'del', text: a[i++] });
    }
    while (j < m) {
        ops.push({ type: 'ins', text: b[j++] });
    }
    return ops;
}

/**
 * Collapse ops into hunks with limited context around changes, capped by maxChanged lines.
 * @param {string} oldText
 * @param {string} newText
 * @param {{ maxChanged?: number }} [opts]
 * @returns {DiffResult}
 */
export function diffTextLines(oldText, newText, opts = {}) {
    const maxChanged = opts.maxChanged ?? DEFAULT_MAX_CHANGED;
    const a = splitLines(oldText);
    const b = splitLines(newText);

    if (String(oldText ?? '') === String(newText ?? '')) {
        return { lines: [], additions: 0, deletions: 0, truncated: false, omitted: 0 };
    }

    if (a.length * b.length > MAX_LCS_CELLS) {
        return {
            lines: [
                { type: 'del', text: `(${a.length} lines — too large to inline-diff)` },
                { type: 'add', text: `(${b.length} lines — too large to inline-diff)` },
            ],
            additions: b.length,
            deletions: a.length,
            truncated: true,
            omitted: Math.max(0, a.length + b.length - 2),
        };
    }

    const ops = lcsOps(a, b);
    let additions = 0;
    let deletions = 0;
    for (const op of ops) {
        if (op.type === 'ins') additions++;
        else if (op.type === 'del') deletions++;
    }

    const keep = new Array(ops.length).fill(false);
    for (let i = 0; i < ops.length; i++) {
        if (ops[i].type !== 'eq') {
            for (let j = Math.max(0, i - CONTEXT); j <= Math.min(ops.length - 1, i + CONTEXT); j++) {
                keep[j] = true;
            }
        }
    }

    /** @type {DiffLine[]} */
    const lines = [];
    let changedShown = 0;
    let omitted = 0;
    let truncated = false;
    let gap = false;

    for (let i = 0; i < ops.length; i++) {
        if (!keep[i]) {
            gap = true;
            continue;
        }
        if (gap) {
            lines.push({ type: 'ctx', text: '…' });
            gap = false;
        }
        const op = ops[i];
        /** @type {DiffLineType} */
        let type = 'ctx';
        if (op.type === 'ins') type = 'add';
        else if (op.type === 'del') type = 'del';

        if (type !== 'ctx') {
            if (changedShown >= maxChanged) {
                truncated = true;
                omitted++;
                continue;
            }
            changedShown++;
        } else if (truncated && omitted > 0) {
            continue;
        }

        lines.push({ type, text: op.text });
    }

    if (truncated && omitted > 0) {
        lines.push({
            type: 'ctx',
            text: `… (${omitted} more changed line${omitted === 1 ? '' : 's'} omitted)`,
        });
    }

    return { lines, additions, deletions, truncated, omitted };
}

/**
 * @param {DiffResult} diff
 * @returns {boolean}
 */
export function diffHasChanges(diff) {
    return !!(diff && (diff.additions > 0 || diff.deletions > 0));
}
