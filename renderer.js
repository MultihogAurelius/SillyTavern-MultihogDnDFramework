import { getSettings, getBarBackground, getBarShowAsPercentage } from './state-manager.js';
import { lookupCustomPortraitSrc } from './portrait-storage.js';
import { escapeHtml, decodeHtml, highlightParens, highlightNumbers, parseInWorldTime, isRestTimeUnset, formatTimeDiff, isArchivedQuestStatus, questHasEffectiveDeadline, isEmergentQuest } from './memo-processor.js';
import { BLOCK_ICONS, BLOCK_ORDER, PAGE_SIZE, NO_PAGINATE, renderStartingGearTierOptions } from './constants.js';

// ── Renderer module: pure HTML string producers, localStorage helpers ──
// No live DOM mutations. All functions return strings or void (localStorage).

const DEFAULT_HP_COLOR = '#00ffaa';
const DEFAULT_XP_COLOR = 'linear-gradient(90deg, #0088ff, #00d4ff)';

/**
 * Extracts a time-of-day emoji + accent color from any free-form string containing
 * an "HH:MM[ AM/PM]" clock pattern (e.g. a [TIME] block line, or a "Current Time" string).
 * Shared by the TIME card renderer and the Tab Mode footer clock so both stay in sync.
 * @param {string} str
 * @returns {{hour: number, emoji: string, color: string, phase: string}}  hour is -1 and phase is '' when no clock pattern is found
 */
export function getTimeOfDayInfo(str) {
    const m = String(str || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return { hour: -1, emoji: '', color: 'inherit', phase: '' };
    let h = parseInt(m[1], 10);
    if (m[3]) {
        const mer = m[3].toUpperCase();
        if (mer === 'AM' && h === 12) h = 0;
        if (mer === 'PM' && h !== 12) h += 12;
    }
    if (!Number.isFinite(h) || h < 0 || h > 23) return { hour: -1, emoji: '', color: 'inherit', phase: '' };

    const phase =
        h < 5  ? 'lateNight' :
        h < 7  ? 'dawn' :
        h < 12 ? 'morning' :
        h < 14 ? 'midday' :
        h < 18 ? 'afternoon' :
        h < 20 ? 'sunset' :
        'night';
    const emoji =
        h < 5  ? '🌙' : // late night
        h < 7  ? '🌅' : // dawn
        h < 12 ? '☀️' : // morning
        h < 14 ? '🌞' : // midday
        h < 18 ? '🌤️' : // afternoon
        h < 20 ? '🌇' : // sunset
        '🌃';           // night
    const color =
        h < 5  ? '#9999ff' : // late night (cool blue)
        h < 7  ? '#ffccaa' : // dawn (peach)
        h < 12 ? '#ffffbb' : // morning (pale yellow)
        h < 14 ? '#ffffff' : // midday (white)
        h < 18 ? '#fff2cc' : // afternoon (warm cream)
        h < 20 ? '#ffaa55' : // sunset (orange)
        '#7777ee';           // night (indigo)

    return { hour: h, emoji, color, phase };
}

/** Time-of-day phases that show the moon (vs. the sun) in the day/night sky badge. */
const DAYNIGHT_MOON_PHASES = new Set(['lateNight', 'night']);

/**
 * Renders a small pure-CSS "sky" badge (sun or moon, with a starfield at night)
 * reflecting the in-world time of day, for the panel header. Purely decorative —
 * built entirely from CSS (radial-gradient disc + box-shadow star dots), no image
 * assets. Colors/positioning are driven by the `rt-sky-<phase>` class; this
 * function only decides which phase class and markup shape (moon+stars vs sun) to use.
 * @param {string} str - any string containing an "HH:MM[ AM/PM]" pattern (e.g. current [TIME] line)
 * @returns {string} HTML, or '' if no clock pattern was found in `str`
 */
export function renderDayNightBadge(str) {
    const { hour, phase } = getTimeOfDayInfo(str);
    if (hour === -1) return '';

    const isMoon = DAYNIGHT_MOON_PHASES.has(phase);
    const bodyHtml = `<div class="rt-sky-disc"></div>`;
    // Stars only during moon phases — a handful of fixed dots is enough to read as a starfield.
    const starsHtml = isMoon ? `<div class="rt-sky-stars"></div>` : '';

    return `<div class="rt-daynight-badge rt-sky-${phase}" title="In-world time of day: ${escapeHtml(phase.replace(/([A-Z])/g, ' $1').toLowerCase())}">${starsHtml}${bodyHtml}</div>`;
}

    export const STOCK_FIELD_RULES = {
        'combat': 'numbers',
        'gear': 'highlight',
        'attr': 'highlight',
        'attributes': 'highlight',
        'skills': 'pills',
        'key skills': 'pills',
        'saves': 'numbers',
        'status': 'pills',
        'traits': 'pills',
        'abilities': 'pills',
        'other': 'pills',
        'resistances': 'pills',
        'res': 'pills',
        'hd': 'hd_pips',
        'weapon': 'highlight',
        'att/def': 'numbers',
        'primary weapon': 'highlight',
        'spells': 'spell_group',
        'ac': 'text'
    };

    export function renderSubFieldByRule(rule, line, barId = null) {
        const colonIdx = line.indexOf(':');
        // If there's no colon, the whole line is the value (no label)
        const hasLabel = colonIdx !== -1;
        const labelText = hasLabel ? line.substring(0, colonIdx + 1).trim() : '';
        const value     = hasLabel ? line.substring(colonIdx + 1).trim() : line.trim();
        const labelStyle = rule.color ? ` style="color:${rule.color}"` : '';
        const labelHtml  = labelText
            ? `<span class="rt-entity-sub-label"${labelStyle}>${escapeHtmlWithColor(labelText)}</span>`
            : '';

        switch (rule.renderType) {
            case 'pills':
                return `<div class="rt-entity-sub-line rt-units-container">${labelHtml} ${renderPills(value, rule.color)}</div>`;
            case 'badge': {
                const badgeColorStyle = rule.color ? ` style="background:${rule.color}22;border-color:${rule.color}66;color:${rule.color};"` : '';
                return `<div class="rt-entity-sub-line rt-units-container">${labelHtml} <span class="rt-unit-pill no-desc"${badgeColorStyle}><span class="rt-unit-name">${escapeHtmlWithColor(value)}</span></span></div>`;
            }
            case 'highlight': {
                const highlighted = highlightParens(escapeHtmlWithColor(value));
                const wrapped = rule.color ? `<span style="color:${rule.color};">${highlighted}</span>` : highlighted;
                return `<div class="rt-entity-sub-line">${labelHtml} ${wrapped}</div>`;
            }
            case 'numbers':
                return `<div class="rt-entity-sub-line">${labelHtml} ${highlightNumbers(escapeHtmlWithColor(value))}</div>`;
            case 'hp_bar': {
                // Flexible: parses any "X/Y" optionally with extra text e.g. "45/100 (5 temp)"
                const m = value.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
                if (m) {
                    const cur = parseInt(m[1].replace(/,/g, ''), 10);
                    const max = parseInt(m[2].replace(/,/g, ''), 10);
                    const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
                    const extra = value.replace(m[0], '').trim();
                    // Use custom color if set, else fall back to red gradient
                    let barBg = rule.color
                        ? rule.color
                        : 'linear-gradient(90deg,#e74c3c,#c0392b)';
                    if (barId) barBg = getBarBackground(barId, barBg, pct);

                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';

                    const showAsPct = getBarShowAsPercentage(barId);
                    const dispCur = showAsPct ? Math.round(pct) : cur;
                    const dispMax = showAsPct ? 100 : max;

                    return `<div class="rt-entity-sub-line" style="gap:6px;">
                        ${labelHtml}
                        <div class="rt-hp-bar-wrap"${recolorData} style="flex:1; position:relative; height:14px; border-radius:4px; overflow:hidden; background:rgba(255,255,255,0.1);">
                            <div class="rt-hp-bar" style="width:${pct.toFixed(1)}%; height:100%; border-radius:4px; background:${barBg}; transition:width 0.3s;"></div>
                        </div>
                        <span style="font-size:0.82em; opacity:0.85; white-space:nowrap;">${dispCur}/${dispMax}${extra ? ' ' + escapeHtml(extra) : ''}</span>
                    </div>`;
                }
                // Fallback: plain text
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'xp_bar': {
                // Flexible: parses any "X/Y" with optional "Level N" anywhere in value
                const xm = value.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
                const lm = value.match(/level\s*(\d+)/i);
                if (xm) {
                    const cur = parseInt(xm[1].replace(/,/g, ''), 10);
                    const max = parseInt(xm[2].replace(/,/g, ''), 10);
                    const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
                    const levelStr = lm ? `<span style="font-size:0.8em; opacity:0.75;">Lv ${lm[1]}</span> ` : '';
                    let barBg = rule.color ? rule.color : DEFAULT_XP_COLOR;
                    if (barId) barBg = getBarBackground(barId, barBg, pct);

                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';

                    const showAsPct = getBarShowAsPercentage(barId);
                    const dispCur = showAsPct ? Math.round(pct) : xm[1];
                    const dispMax = showAsPct ? 100 : xm[2];

                    return `<div class="rt-entity-sub-line" style="gap:6px;">
                        ${labelHtml}
                        <div class="rt-xp-bar-wrap"${recolorData} style="flex:1; height:12px;">
                            <div class="rt-xp-bar" style="width:${pct.toFixed(1)}%; background:${barBg};"></div>
                        </div>
                        <span style="font-size:0.82em; opacity:0.85; white-space:nowrap;">${levelStr}${dispCur}/${dispMax}</span>
                    </div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'kv':
                return `<div class="rt-card-kv"><span class="rt-card-key">${labelHtml}</span><span class="rt-card-val">${escapeHtmlWithColor(value)}</span></div>`;
            case 'objective': {
                // Objective with checkbox status: ○ (incomplete), ✓/✔ (done), ✗/✘ (failed)
                const isDone = /^[✓✔☑]/.test(value);
                const isFailed = /^[✗✘☒]/.test(value);
                const isIncomplete = /^[○◯◦]/.test(value);
                const cleanVal = value.replace(/^[✓✔☑✗✘☒○◯◦]\s*/, '').trim();
                const statusClass = isDone ? 'rt-obj-done' : isFailed ? 'rt-obj-failed' : 'rt-obj-pending';
                const icon = isDone ? '✓' : isFailed ? '✗' : '○';
                return `<div class="rt-objective ${statusClass}">${labelHtml}<span class="rt-obj-icon">${icon}</span> <span class="rt-obj-text">${escapeHtmlWithColor(cleanVal)}</span></div>`;
            }
            case 'reward': {
                const rewardStyle = rule.color ? ` style="color:${rule.color};border-color:${rule.color}66;"` : '';
                return `<div class="rt-entity-sub-line"><span class="rt-reward-chip"${rewardStyle}>${labelHtml ? labelHtml + ' ' : ''}🎁 ${escapeHtmlWithColor(value)}</span></div>`;
            }
            case 'difficulty': {
                const diffColors = { 'very easy': '#2ecc71', 'easy': '#27ae60', 'medium': '#f1c40f', 'normal': '#f1c40f', 'hard': '#e67e22', 'very hard': '#e74c3c' };
                const diffColor = rule.color || diffColors[value.toLowerCase()] || '#aaa';
                return `<div class="rt-entity-sub-line">${labelHtml}<span class="rt-difficulty-badge" style="background:${diffColor}22; color:${diffColor}; border:1px solid ${diffColor}55;">${escapeHtmlWithColor(value)}</span></div>`;
            }
            case 'progress': {
                const pm = value.match(/(\d+)\s*\/\s*(\d+)/);
                if (pm) {
                    const cur = parseInt(pm[1], 10), max = parseInt(pm[2], 10);
                    const pct = max > 0 ? Math.min(100, (cur / max) * 100) : 0;
                    const extra = value.replace(pm[0], '').trim();
                    let barBg = rule.color ? rule.color : 'linear-gradient(90deg, #00c88c, #00d4ff)';
                    if (barId) barBg = getBarBackground(barId, barBg, pct);
                    
                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';

                    return `<div class="rt-entity-sub-line rt-progress-row">${labelHtml}
                        <div class="rt-progress-bar-wrap"${recolorData}>
                            <div class="rt-progress-bar" style="width:${pct.toFixed(1)}%;background:${barBg};"></div>
                        </div>
                        <span class="rt-progress-label">${cur}/${max}${extra ? ' ' + escapeHtml(extra) : ''}</span>
                    </div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'clock': {
                const pm = value.match(/(\d+)\s*\/\s*(\d+)/);
                if (pm) {
                    const cur = parseInt(pm[1], 10), max = parseInt(pm[2], 10);
                    const pct = max > 0 ? Math.min(100, (cur / max) * 100) : 0;
                    const extra = value.replace(pm[0], '').trim();
                    let barBg = rule.color ? rule.color : 'var(--rt-accent, #00ffaa)';
                    if (barId) barBg = getBarBackground(barId, barBg, pct);
                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';
                    
                    return `<div class="rt-entity-sub-line rt-clock-row">${labelHtml}
                        <div class="rt-clock-icon"${recolorData} style="background: conic-gradient(${barBg} ${pct}%, transparent 0);"></div>
                        <span class="rt-clock-label">${cur}/${max}${extra ? ' ' + escapeHtml(extra) : ''}</span>
                    </div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'stars': {
                const pm = value.match(/(\d+)\s*\/\s*(\d+)/) || value.match(/(\d+)/);
                if (pm) {
                    const cur = parseInt(pm[1], 10);
                    const max = pm[2] ? parseInt(pm[2], 10) : 5;
                    const extra = value.replace(pm[0], '').trim();
                    const filled = Math.min(cur, max);
                    const empty = Math.max(0, max - filled);
                    let barBg = rule.color ? rule.color : '#ffd700';
                    if (barId) barBg = getBarBackground(barId, barBg, max > 0 ? (filled / max) * 100 : 0);
                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';

                    const starsHtml = `<span class="rt-stars-icon" style="color:${barBg};"${recolorData}>${'★'.repeat(filled)}${'☆'.repeat(empty)}</span>`;
                    return `<div class="rt-entity-sub-line rt-stars-row">${labelHtml} ${starsHtml} <span class="rt-stars-label">${extra ? escapeHtml(extra) : ''}</span></div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'weight': {
                const pm = value.match(/(\d+)\s*\/\s*(\d+)/);
                if (pm) {
                    const cur = parseInt(pm[1], 10), max = parseInt(pm[2], 10);
                    const pct = max > 0 ? Math.min(100, (cur / max) * 100) : 0;
                    const extra = value.replace(pm[0], '').trim();
                    let barBg = rule.color ? rule.color : (pct >= 100 ? '#e74c3c' : pct >= 75 ? '#f1c40f' : '#2ecc71');
                    if (barId) barBg = getBarBackground(barId, barBg, pct);
                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';

                    return `<div class="rt-entity-sub-line rt-weight-row">${labelHtml}
                        <span class="rt-weight-icon">⚖️</span>
                        <div class="rt-weight-bar-wrap"${recolorData}>
                            <div class="rt-weight-bar" style="width:${pct.toFixed(1)}%;background:${barBg};"></div>
                        </div>
                        <span class="rt-weight-label">${cur}/${max}${extra ? ' ' + escapeHtml(extra) : ''}</span>
                    </div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ⚖️ ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'weather': {
                let icon = '🌤️';
                const lower = value.toLowerCase();
                if (lower.includes('rain') || lower.includes('storm') || lower.includes('wet')) icon = '🌧️';
                else if (lower.includes('snow') || lower.includes('cold') || lower.includes('ice') || lower.includes('blizzard')) icon = '❄️';
                else if (lower.includes('sun') || lower.includes('hot') || lower.includes('clear')) icon = '☀️';
                else if (lower.includes('cloud') || lower.includes('overcast')) icon = '☁️';
                else if (lower.includes('wind')) icon = '🌬️';
                else if (lower.includes('fog')) icon = '🌫️';
                else if (lower.includes('night') || lower.includes('dark')) icon = '🌙';
                
                return `<div class="rt-entity-sub-line">${labelHtml} <span class="rt-weather-badge">${icon} ${escapeHtmlWithColor(value)}</span></div>`;
            }
            case 'orbs': {
                const pm = value.match(/(\d+)\s*\/\s*(\d+)/);
                if (pm) {
                    const cur = parseInt(pm[1], 10), max = parseInt(pm[2], 10);
                    const extra = value.replace(pm[0], '').trim();
                    let barBg = rule.color ? rule.color : '#3498db';
                    if (barId) barBg = getBarBackground(barId, barBg, max > 0 ? (cur/max)*100 : 0);
                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';
                    
                    let orbsHtml = '';
                    for (let i = 0; i < max; i++) {
                        const isFilled = i < cur;
                        orbsHtml += `<div class="rt-orb ${isFilled ? 'filled' : 'empty'}" style="${isFilled ? `background:${barBg};box-shadow:0 0 5px ${barBg};` : ''}"></div>`;
                    }
                    
                    return `<div class="rt-entity-sub-line rt-orbs-row">${labelHtml}
                        <div class="rt-orbs-container"${recolorData}>${orbsHtml}</div>
                        <span class="rt-orbs-label">${extra ? escapeHtml(extra) : ''}</span>
                    </div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'slots': {
                const pm = value.match(/(\d+)\s*\/\s*(\d+)/);
                if (pm) {
                    const cur = parseInt(pm[1], 10), max = parseInt(pm[2], 10);
                    const extra = value.replace(pm[0], '').trim();
                    let barBg = rule.color ? rule.color : '#aaaaaa';
                    if (barId) barBg = getBarBackground(barId, barBg, max > 0 ? (cur/max)*100 : 0);
                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';
                    
                    let slotsHtml = '';
                    for (let i = 0; i < max; i++) {
                        const isFilled = i < cur;
                        slotsHtml += `<div class="rt-slot ${isFilled ? 'filled' : 'empty'}" style="${isFilled ? `background:${barBg};` : ''}"></div>`;
                    }
                    
                    return `<div class="rt-entity-sub-line rt-slots-row">${labelHtml}
                        <div class="rt-slots-container"${recolorData}>${slotsHtml}</div>
                        <span class="rt-slots-label">${extra ? escapeHtml(extra) : ''}</span>
                    </div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'phase': {
                const pm = value.match(/(\d+)\s*\/\s*(\d+)/);
                if (pm) {
                    const cur = parseInt(pm[1], 10), max = parseInt(pm[2], 10);
                    const extra = value.replace(pm[0], '').trim();
                    let barBg = rule.color ? rule.color : 'var(--rt-accent, #00ffaa)';
                    if (barId) barBg = getBarBackground(barId, barBg, max > 0 ? (cur/max)*100 : 0);
                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';
                    
                    let phaseHtml = '';
                    for (let i = 0; i < max; i++) {
                        const isPast = i < cur - 1;
                        const isCurrent = i === cur - 1;
                        let stateClass = isPast ? 'past' : (isCurrent ? 'current' : 'future');
                        phaseHtml += `<div class="rt-phase-node ${stateClass}" style="${isPast || isCurrent ? `background:${barBg};border-color:${barBg};` : ''}${isCurrent ? `box-shadow:0 0 8px ${barBg};` : ''}"></div>`;
                        if (i < max - 1) {
                            const isLineFilled = i < cur - 1;
                            phaseHtml += `<div class="rt-phase-line ${isLineFilled ? 'filled' : 'empty'}" style="${isLineFilled ? `background:${barBg};` : ''}"></div>`;
                        }
                    }
                    
                    return `<div class="rt-entity-sub-line rt-phase-row">${labelHtml}
                        <div class="rt-phase-container"${recolorData}>${phaseHtml}</div>
                        <span class="rt-phase-label">${cur}/${max}${extra ? ' ' + escapeHtml(extra) : ''}</span>
                    </div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'gauge': {
                const pm = value.match(/(\d+)\s*\/\s*(\d+)/);
                if (pm) {
                    const cur = parseInt(pm[1], 10), max = parseInt(pm[2], 10);
                    const pct = max > 0 ? Math.min(100, (cur / max) * 100) : 0;
                    const extra = value.replace(pm[0], '').trim();
                    let barBg = rule.color ? rule.color : 'linear-gradient(90deg, #2ecc71, #f1c40f, #e74c3c)';
                    if (barId) barBg = getBarBackground(barId, barBg, pct);
                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';
                    
                    const degrees = -90 + (180 * (pct / 100));
                    
                    return `<div class="rt-entity-sub-line rt-gauge-row">${labelHtml}
                        <div class="rt-gauge-wrap"${recolorData}>
                            <div class="rt-gauge-bg" style="background:${barBg};"></div>
                            <div class="rt-gauge-needle" style="transform: rotate(${degrees}deg);"></div>
                        </div>
                        <span class="rt-gauge-label">${cur}/${max}${extra ? ' ' + escapeHtml(extra) : ''}</span>
                    </div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'charge': {
                const pm = value.match(/(\d+)\s*\/\s*(\d+)/);
                if (pm) {
                    const cur = parseInt(pm[1], 10), max = parseInt(pm[2], 10);
                    const pct = max > 0 ? Math.min(100, (cur / max) * 100) : 0;
                    const extra = value.replace(pm[0], '').trim();
                    
                    const isLow = cur <= 1 && max > 1;
                    let barBg = rule.color ? rule.color : (isLow ? '#e74c3c' : '#2ecc71');
                    if (barId) barBg = getBarBackground(barId, barBg, pct);
                    const recolorData = barId ? ` data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" title="Click to recolor"` : '';
                    
                    const chargeHtml = `<div class="rt-battery-wrap ${isLow && cur === 0 ? 'empty-flash' : ''}"${recolorData} style="border-color:${barBg};">
                        <div class="rt-battery-fill" style="width:${pct}%;background:${barBg};"></div>
                        <div class="rt-battery-nub" style="background:${barBg};"></div>
                    </div>`;

                    return `<div class="rt-entity-sub-line rt-charge-row">${labelHtml}
                        ${chargeHtml}
                        <span class="rt-charge-label">${cur}/${max}${extra ? ' ' + escapeHtml(extra) : ''}</span>
                    </div>`;
                }
                return `<div class="rt-entity-sub-line">${labelHtml} ${escapeHtmlWithColor(value)}</div>`;
            }
            case 'pill_colored': {
                // A custom color override replaces the fixed buff/debuff/magic class entirely.
                const pClass = rule.color ? '' : (rule.pillClass || '');
                const colorStyle = rule.color ? ` style="background:${rule.color}1a;border-color:${rule.color}66;color:${rule.color};"` : '';
                const pillHtml = splitSmart(value).map(p => {
                    p = p.trim();
                    const descMatch = p.match(/^(.*?)\s*\((.*?)\)$/);
                    const name = descMatch ? descMatch[1].trim() : p;
                    const desc = descMatch ? descMatch[2].trim() : '';
                    const descHtml = desc ? `<div class="rt-unit-descr">${escapeHtml(desc)}</div>` : '';
                    const titleAttr = desc ? ` title="${escapeHtml(desc)}"` : '';
                    const noDescClass = desc ? '' : ' no-desc';
                    return `<span class="rt-unit-pill ${pClass}${noDescClass}"${colorStyle}${titleAttr}><span class="rt-unit-name">${escapeHtml(name)}</span>${descHtml}</span>`;
                }).join(' ');
                return `<div class="rt-entity-sub-line rt-units-container">${labelHtml} ${pillHtml}</div>`;
            }
            case 'badge_colored': {
                const bColor = rule.color || '#fff';
                return `<div class="rt-entity-sub-line">${labelHtml}<span class="rt-difficulty-badge" style="background:${bColor}22; color:${bColor}; border:1px solid ${bColor}55;">${escapeHtmlWithColor(value)}</span></div>`;
            }
            case 'coin': {
                const cColor = rule.color || '#fff';
                const icon = rule.icon || '🪙';
                return `<div class="rt-entity-sub-line">${labelHtml}<span class="rt-coin-badge" style="color:${cColor}; border-color:${cColor}44;">${icon} ${escapeHtmlWithColor(value)}</span></div>`;
            }
            case 'dice_roll': {
                // value is something like "1d20+5 = 18"
                const diceStyle = rule.color
                    ? `background:${rule.color}22; border:1px solid ${rule.color}66; color:${rule.color};`
                    : 'background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);';
                return `<div class="rt-entity-sub-line">${labelHtml}<span class="rt-dice-roll" style="${diceStyle} padding:2px 6px; border-radius:4px; font-family:monospace; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-dice-d20" style="opacity:0.7"></i> ${escapeHtmlWithColor(value)}</span></div>`;
            }
            case 'text':
            default: {
                const textHtml = escapeHtmlWithColor(value);
                const wrapped = rule.color ? `<span style="color:${rule.color};">${textHtml}</span>` : textHtml;
                return `<div class="rt-entity-sub-line">${labelHtml} ${wrapped}</div>`;
            }
        }
    }

    export function renderHDPips(val) {
        let pipsHtml = escapeHtmlWithColor(val);
        const hm = val.match(/^([^(]+?)\s*(?:\(([\d,]+)\/([\d,]+)\))?$/);
        if (hm && hm[2] && hm[3]) {
            const cur = parseInt(hm[2].replace(/,/g, ''), 10);
            const max = parseInt(hm[3].replace(/,/g, ''), 10);
            pipsHtml = `<span class="rt-hd-label">[ ${escapeHtmlWithColor(hm[1].trim())} ]</span> <span class="rt-hd-pips">${Array.from({ length: max }, (_, i) => `<span class="rt-hd-pip${i < cur ? ' rt-hd-available' : ''}"></span>`).join('')}</span>`;
        }
        return `<div class="rt-entity-sub-line"><span class="rt-entity-sub-label">HD:</span> <span>${pipsHtml}</span></div>`;
    }

    export function renderSpellGroups(val) {
        const isCompound = /\|/.test(val) && /(?:Level\s*\d+|Cantrips?)/i.test(val);
        const groups = isCompound ? val.split(/\s*\|\s*/) : [val];
        let html = '';
        for (const group of groups) {
            const m = group.trim().match(/^(Level\s*\d+|Cantrips?)\s*(?:\((\d+)\/(\d+)[^)]*\))?\s*(?::\s*(.+))?$/i);
            if (!m) continue;
            const [, lbl, availStr, maxStr, spellList] = m;
            const isCantrip = /cantrip/i.test(lbl);
            let pipsHtml = '';
            if (!isCantrip && availStr !== undefined && maxStr !== undefined) {
                const avail = parseInt(availStr, 10), maxSlots = parseInt(maxStr, 10);
                pipsHtml = `<span class="rt-slot-pips">${Array.from({ length: maxSlots }, (_, i) =>
                    `<span class="rt-slot-pip${i < avail ? ' rt-slot-available' : ' rt-slot-used'}"></span>`).join('')}</span>`;
            }
            let spellsHtml = '';
            if (spellList) {
                spellsHtml = spellList.split(',').map(s => {
                    const name = s.trim();
                    const slug = name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-');
                    return `<a href="https://dnd5e.wikidot.com/spell:${slug}" target="_blank" class="rt-spell-name" title="View spell on Wikidot">${escapeHtmlWithColor(name)}</a>`;
                }).join('');
            }
            html += `<div class="rt-spell-row"><span class="rt-spell-level">${escapeHtmlWithColor(lbl.trim())}</span><div class="rt-spell-inline-group"><div class="rt-spell-list">${pipsHtml}${spellsHtml}</div></div></div>`;
        }
        // Party/CHARACTER style matched — return leveled rows.
        if (html) return html;
        // Combat / flat list: Spells: Ray of Sickness (2/2), Fire Bolt (at will) → blue magic pills.
        return `<div class="rt-entity-sub-line rt-units-container"><span class="rt-entity-sub-label">Spells:</span> ${renderPillsAsMagic(val)}</div>`;
    }

    /** Like renderPills, but always uses the blue magic pill style (combat caster spells). */
    const renderPillsAsMagic = (text) => {
        return splitSmart(text).map(t => {
            let displayText = t;
            if (t.startsWith('(+)') || t.startsWith('(+) ')) {
                displayText = t.replace(/^\(\+\)\s*/, '');
            } else if (t.startsWith('(-)') || t.startsWith('(-) ')) {
                displayText = t.replace(/^\(-\)\s*/, '');
            }

            const m = displayText.match(/^(.+?)\s*\((.+)\)$/);
            if (m) {
                const [, name, desc] = m;
                let iconHtml = '';
                const resourceMatch = desc.match(/(\d+)\s*\/\s*(\d+)/);
                if (resourceMatch) {
                    iconHtml = `<span class="rt-unit-icon">${escapeHtmlWithColor(resourceMatch[0])}</span>`;
                }
                return `<span class="rt-unit-pill rt-pill-magic">
                    <span class="rt-unit-name">${escapeHtmlWithColor(name)}</span>
                    ${iconHtml}
                    <span class="rt-unit-descr">(${escapeHtmlWithColor(desc)})</span>
                </span>`;
            }
            return `<span class="rt-unit-pill rt-pill-magic no-desc"><span class="rt-unit-name">${escapeHtmlWithColor(displayText)}</span></span>`;
        }).join('');
    };


    // Shared marker type map used by tokenizeMarkers and tryRenderMarker.
    export const MARKER_TYPE_MAP = {
        PILLS:{ renderType: 'pills', example: 'Status (Hover for details), Condition (Another detail)' }, PLS:{ renderType: 'pills', example: 'Status (Hover for details)', aliasOf: 'PILLS' },
        BAR:{ renderType: 'hp_bar', example: '50/100 (Red HP/Standing)' }, B:{ renderType: 'hp_bar', example: '50/100 (Red HP/Standing)', aliasOf: 'BAR' }, HPBAR:{ renderType: 'hp_bar', example: '50/100 (Red HP/Standing)', aliasOf: 'BAR' }, HPB:{ renderType: 'hp_bar', example: '50/100 (Red HP/Standing)', aliasOf: 'BAR' }, HP: { renderType: 'hp_bar', example: '50/100 (Red HP/Standing)', aliasOf: 'BAR' },
        BARRED:{ renderType: 'hp_bar', color: 'linear-gradient(90deg,#e74c3c,#c0392b)', example: '50/100 (Crimson Blood)' },
        BARBLUE:{ renderType: 'hp_bar', color: 'linear-gradient(90deg,#3498db,#2980b9)', example: '50/100 (Blue Mana/Mana)' },
        BARGREEN:{ renderType: 'hp_bar', color: 'linear-gradient(90deg,#2ecc71,#27ae60)', example: '50/100 (Green Stamina)' },
        BARYELLOW:{ renderType: 'hp_bar', color: 'linear-gradient(90deg,#f1c40f,#f39c12)', example: '50/100 (Yellow Energy)' },
        BARPURPLE:{ renderType: 'hp_bar', color: 'linear-gradient(90deg,#9b59b6,#8e44ad)', example: '50/100 (Purple Void)' },
        BARORANGE:{ renderType: 'hp_bar', color: 'linear-gradient(90deg,#e67e22,#d35400)', example: '50/100 (Orange Heat)' },
        XPBAR:{ renderType: 'xp_bar', example: '450/1000 Level 3 (XP/Progress)' }, XB:{ renderType: 'xp_bar', example: '450/1000 Level 3 (XP/Progress)', aliasOf: 'XPBAR' },
        TEXT:{ renderType: 'text', example: 'Some text (Plain)' },
        BADGE:{ renderType: 'badge', example: 'Neutral (Reputation badge)' }, BDG:{ renderType: 'badge', example: 'Neutral (Reputation badge)', aliasOf: 'BADGE' },
        HIGHLIGHT:{ renderType: 'highlight', example: 'Emphasis (Bright highlight text)' }, HGT:{ renderType: 'highlight', example: 'Emphasis (Bright highlight text)', aliasOf: 'HIGHLIGHT' },
        OBJ:{ renderType: 'objective', example: '✓ Done (Checked quest bullet)' },
        REWARD:{ renderType: 'reward', example: '500 XP (Loot reward badge)' },
        DIFFICULTY:{ renderType: 'difficulty', example: 'Hard (Difficulty star badge)' },
        PROGRESS:{ renderType: 'progress', example: '3/5 (Fraction progress)' },
        PROGRESSRED:{ renderType: 'progress', color: '#e74c3c', example: '3/5 (Red fraction progress)' },
        PROGRESSBLUE:{ renderType: 'progress', color: '#3498db', example: '3/5 (Blue fraction progress)' },
        PROGRESSGREEN:{ renderType: 'progress', color: '#2ecc71', example: '3/5 (Green fraction progress)' },
        PROGRESSYELLOW:{ renderType: 'progress', color: '#f1c40f', example: '3/5 (Yellow fraction progress)' },
        PROGRESSPURPLE:{ renderType: 'progress', color: '#9b59b6', example: '3/5 (Purple fraction progress)' },
        PROGRESSORANGE:{ renderType: 'progress', color: '#e67e22', example: '3/5 (Orange fraction progress)' },
        PROGRESSCYAN:{ renderType: 'progress', color: '#00ffff', example: '3/5 (Cyan fraction progress)' },
        PILLRED:{ renderType: 'pill_colored', pillClass: 'rt-pill-debuff', example: 'Stunned (Cannot take actions)' },
        PILLGREEN:{ renderType: 'pill_colored', pillClass: 'rt-pill-buff', example: 'Focused (Clear minded, no distractions)' },
        PILLBLUE:{ renderType: 'pill_colored', pillClass: 'rt-pill-magic', example: 'Shielded (Absorbs 10 damage)' },
        WARNING:{ renderType: 'badge_colored', color: '#f1c40f', example: 'Caution (Amber badge)' },
        DANGER:{ renderType: 'badge_colored', color: '#e74c3c', example: 'Hostile (Red badge)' },
        SUCCESS:{ renderType: 'badge_colored', color: '#2ecc71', example: 'Active (Green badge)' },
        INFO:{ renderType: 'badge_colored', color: '#3498db', example: 'Role (Blue badge)' },
        GOLD:{ renderType: 'coin', color: '#ffd700', icon: '💰', example: '150 (Gold coins)' },
        SILVER:{ renderType: 'coin', color: '#c0c0c0', icon: '🪙', example: '45 (Silver coins)' },
        BRONZE:{ renderType: 'coin', color: '#cd7f32', icon: '🪙', example: '12 (Bronze coins)' },
        DOLLAR:{ renderType: 'coin', color: '#85bb65', icon: '💵', example: '500 (Paper cash)' },
        HEART:{ renderType: 'coin', color: '#ff4466', icon: '❤️', example: '3 (Lives/Hearts)' },
        SKULL:{ renderType: 'coin', color: '#aaaaaa', icon: '💀', example: '12 (Kills/Deaths)' },
        SOUL:{ renderType: 'coin', color: '#aa88ff', icon: '👻', example: '42 (Souls)' },
        ROLL:{ renderType: 'dice_roll', example: '1d20+5 = 18 (Dice roll badge)' },
        CLOCK:{ renderType: 'clock', example: '4/8 (Guard Alertness)' },
        STARS:{ renderType: 'stars', example: '3/5 (Merchant Favor)' },
        WEIGHT:{ renderType: 'weight', example: '45/50 lbs (Encumbered)' },
        CAPACITY:{ renderType: 'weight', example: '45/50 lbs (Encumbered)', aliasOf: 'WEIGHT' },
        WEATHER:{ renderType: 'weather', example: 'Heavy Rain (Poor Visibility)' },
        ORBS:{ renderType: 'orbs', example: '3/5 (Ki Points)' },
        AP:{ renderType: 'orbs', example: '3/5 (Ki Points)', aliasOf: 'ORBS' },
        SLOTS:{ renderType: 'slots', example: '4/10 (Backpack)' },
        PHASE:{ renderType: 'phase', example: '2/4 (Ritual Summoning)' },
        STEP:{ renderType: 'phase', example: '2/4 (Ritual Summoning)', aliasOf: 'PHASE' },
        GAUGE:{ renderType: 'gauge', example: '75/100 (Party Morale)' },
        METER:{ renderType: 'gauge', example: '75/100 (Party Morale)', aliasOf: 'GAUGE' },
        CHARGE:{ renderType: 'charge', example: '2/5 (Wand of Fireballs)' },
        BATTERY:{ renderType: 'charge', example: '2/5 (Wand of Fireballs)', aliasOf: 'CHARGE' }
    };

    /** Canonical marker keys for UI library / AI hints (excludes shorthand aliases). */
    export function getMarkerLibraryKeys() {
        return Object.keys(MARKER_TYPE_MAP).filter(k => !MARKER_TYPE_MAP[k].aliasOf);
    }

    // Regex that matches the NEXT ((MARKER)) token anywhere in a string.
    // Used iteratively by tokenizeMarkers. Supports an optional inline color
    // override suffix: ((TAG - #HEX)) for a solid color, or
    // ((TAG - #HEX1 #HEX2)) for a two-color gradient (bar-like types only).
    // Restricted to 6-digit #RRGGBB hex: several render paths concatenate an
    // alpha suffix directly onto the color string (e.g. `${color}22`), which
    // only produces valid CSS when the base color is exactly 6 hex digits.
    const HEX_COLOR_PATTERN = '#[0-9a-fA-F]{6}';
    export const MARKER_TOKEN_RE = new RegExp(`\\(\\((${Object.keys(MARKER_TYPE_MAP).join('|')})(?:\\s*-\\s*(${HEX_COLOR_PATTERN})(?:\\s+(${HEX_COLOR_PATTERN}))?)?\\)\\)`, 'i');

    /** Render types whose default color is already a gradient/gradient-friendly bar fill. */
    const GRADIENT_CAPABLE_RENDER_TYPES = new Set(['hp_bar', 'xp_bar', 'progress']);

    /** Strictly validates a 6-digit #RRGGBB hex color to prevent CSS injection and malformed alpha-suffix concatenation. */
    function isValidHexColor(str) {
        return /^#[0-9a-fA-F]{6}$/.test(str || '');
    }

    /**
     * Clones `baseRule` with `color` overridden from a parsed marker color suffix.
     * Two valid colors on a gradient-capable render type (bars/progress) produce a
     * linear-gradient; otherwise only the first color is used (second is ignored).
     * Invalid hex values are ignored entirely, falling back to the base rule's color.
     */
    function applyMarkerColorOverride(baseRule, color1, color2) {
        if (!isValidHexColor(color1)) return baseRule;
        const rule = { ...baseRule };
        if (color2 && isValidHexColor(color2) && GRADIENT_CAPABLE_RENDER_TYPES.has(rule.renderType)) {
            rule.color = `linear-gradient(90deg, ${color1}, ${color2})`;
        } else {
            rule.color = color1;
        }
        return rule;
    }

    /**
     * Splits `line` into an ordered array of segments wherever a ((MARKER))
     * token appears.  Each segment is:
     *   { preText: string, markerType: string, rule: object }
     * where `preText` is the text between the previous marker's end (or the
     * start of the line) and this marker, and the segment's "content" is
     * everything from after this marker up to the next marker (resolved by
     * the caller when building the reconstructed line).
     *
     * Returns [] if no markers are found in the line.
     */
    function tokenizeMarkers(line) {
        const segments = [];
        let remaining = line;

        while (true) {
            const m = MARKER_TOKEN_RE.exec(remaining);
            if (!m) break;

            const preText = remaining.slice(0, m.index).trim();
            const markerType = m[1].toUpperCase();
            const colorArg1 = m[2] || null;
            const colorArg2 = m[3] || null;
            remaining = remaining.slice(m.index + m[0].length).trimStart();

            const baseRule = MARKER_TYPE_MAP[markerType] || { renderType: 'text' };
            const rule = colorArg1 ? applyMarkerColorOverride(baseRule, colorArg1, colorArg2) : baseRule;

            segments.push({ preText, markerType, rule });
        }

        // Assign each segment its content:
        //   segment[i].content = segment[i+1].preText  (text between marker i and marker i+1)
        //   segment[last].content = remaining tail after the last marker
        // IMPORTANT: once a preText is consumed as content for segment[i], clear it on
        // segment[i+1] so renderMarkerSegment doesn't double-prepend it as a label.
        for (let i = 0; i < segments.length; i++) {
            if (i < segments.length - 1) {
                segments[i].content = segments[i + 1].preText;
                segments[i + 1].preText = ''; // consumed — don't re-use as label
            } else {
                segments[i].content = remaining.trim();
            }
        }

        return segments;
    }

    /**
     * Renders one tokenized marker segment into HTML via renderSubFieldByRule.
     * `preText` becomes the label prefix; `content` is the value portion.
     * `rowContext` is an optional string from sibling segments on the same
     * multi-marker row — appended to barId so two bars with the same label on
     * different rows (e.g. two "Charges" bars) get distinct color identities.
     */
    function renderMarkerSegment(seg, tag, entityName, rowContext = '') {
        const { preText, content, rule } = seg;

        // renderSubFieldByRule splits on the first colon to separate label from value.
        // We must reconstruct the line so that split works correctly for every placement
        // of the ((MARKER)) token:
        //
        //   Marker-at-start:  ((GAUGE)) 75/100              → preText="", content="75/100"
        //   Marker-in-middle: [Epic] Sword - ((GAUGE)) 75/100 → preText="[Epic] Sword -", content="75/100"
        //   Marker-at-end:    [Epic] Sword - Durability 75/100 ((GAUGE)) → preText="[Epic] Sword - Durability 75/100", content=""
        //   With colon:       Durability: ((GAUGE)) 75/100   → preText="Durability:", content="75/100"
        let reconstructedContent;
        if (!preText) {
            // ── Marker at start of line — content is everything ──
            reconstructedContent = content.trim();
        } else if (content.trim()) {
            // ── Marker in middle — text on both sides ──
            if (preText.includes(':')) {
                // preText already has colon structure (e.g. "Durability: ((GAUGE)) 75/100")
                reconstructedContent = `${preText} ${content}`.trim();
            } else {
                // No colon — synthesize one so preText becomes the label
                reconstructedContent = `${preText}: ${content}`.trim();
            }
        } else {
            // ── Marker at end of line — content is empty, everything is in preText ──
            if (preText.includes(':')) {
                // Already has colon structure (e.g. "Durability: 75/100 ((GAUGE))")
                reconstructedContent = preText.trim();
            } else {
                // No colon. For progression types, try to split "Label X/Y" into "Label: X/Y"
                // by finding the X/Y numeric pattern.
                const PROGRESSION = new Set(['hp_bar', 'xp_bar', 'progress', 'clock', 'stars', 'weight', 'orbs', 'slots', 'phase', 'gauge', 'charge']);
                const numMatch = PROGRESSION.has(rule.renderType)
                    ? preText.match(/^(.*?)\s+(\d[\d,]*\s*\/\s*\d[\d,]*.*)$/)
                    : null;
                if (numMatch && numMatch[1].trim()) {
                    reconstructedContent = `${numMatch[1].trim()}: ${numMatch[2].trim()}`;
                } else {
                    reconstructedContent = preText.trim();
                }
            }
        }

        let barId = null;
        const progressionTypes = ['hp_bar', 'xp_bar', 'progress', 'clock', 'stars', 'weight', 'orbs', 'slots', 'phase', 'gauge', 'charge'];
        if (progressionTypes.includes(rule.renderType)) {
            const colonIdx = reconstructedContent.indexOf(':');
            const labelText = colonIdx !== -1 ? reconstructedContent.substring(0, colonIdx).trim() : 'Bar';
            // Include rowContext so that identical labels on different multi-marker rows
            // produce distinct barIds (e.g. "Charges" beside "Fireball" vs "Charges" beside "Ice Storm").
            const ctxSuffix = rowContext ? `[${rowContext}]` : '';
            barId = `${tag}:${entityName}:${labelText}${ctxSuffix}`;
        }

        return renderSubFieldByRule(rule, reconstructedContent, barId);
    }


    /**
     * If `line` contains one or more ((MARKER)) tokens, renders it and returns HTML.
     *
     * • Single marker  → same output as before (one wrapped <div>).
     * • Multiple markers → each segment is rendered independently and all are
     *   placed side-by-side inside a <div class="rt-multi-marker-row"> flex row,
     *   with the ((TAG)) token acting as the implicit column separator.
     *
     * Returns null if no marker is present, so callers can fall through to
     * their own renderer. This makes markers work in ALL stock blocks.
     *
     * Example (two columns on one line):
     *   Spells: ((PLS)) Fireball, Magic Missile ((BAR)) Charges: 3/5
     *
     * `lineIdx` is the line's position within its block. It's only used as a
     * barId disambiguator when there's no `entityName` to anchor to (i.e. custom
     * [TAG] blocks and other non-entity blocks) — without it, several unrelated
     * lines that happen to share a label (or have no label at all, defaulting to
     * "Bar") would collapse onto the same barId and recolor together.
     */
    export function tryRenderMarker(line, tag = '', entityName = '', lineIdx = null) {
        const segments = tokenizeMarkers(line);
        if (segments.length === 0) return null;

        const lineAnchor = (!entityName && lineIdx !== null) ? `L${lineIdx}` : '';

        if (segments.length === 1) {
            // Single-marker fast path — identical to the previous behaviour.
            return renderMarkerSegment(segments[0], tag, entityName, lineAnchor);
        }

        // Multi-marker: render each segment and wrap it in a typed cell.
        // Stretchy render types (bars, progress) get flex:1 so they fill remaining
        // space; fixed types (pills, badges, text) take only their natural width.
        const STRETCH_TYPES = new Set(['hp_bar', 'xp_bar', 'progress']);

        // Pre-compute each segment's reconstructed text so we can use sibling content
        // as rowContext to disambiguate same-label bars across different rows.
        const segContents = segments.map(s => (s.preText ? `${s.preText} ${s.content}` : s.content).trim());

        const childrenHtml = segments.map((seg, i) => {
            // rowContext = sibling's content + this segment's index (+ line anchor).
            // The sibling content disambiguates bars across different rows;
            // the index disambiguates multiple identical bars on the SAME row;
            // the line anchor disambiguates across different lines with no entity context.
            const rowContext = `${segContents[i === 0 ? 1 : 0] ?? ''}:${i}${lineAnchor ? ':' + lineAnchor : ''}`;
            const html = renderMarkerSegment(seg, tag, entityName, rowContext);
            const cellClass = STRETCH_TYPES.has(seg.rule.renderType)
                ? 'rt-mmc-cell rt-mmc-cell--stretch'
                : 'rt-mmc-cell';
            return `<div class="${cellClass}">${html}</div>`;
        }).join('');

        return `<div class="rt-multi-marker-row">${childrenHtml}</div>`;
    }

    export function renderLineInEntityContext(tag, line, entityName, rawLine) {
        // 1. Try marker first
        const asMarker = tryRenderMarker(rawLine, tag, entityName);
        if (asMarker) return asMarker;

        const ll = line.toLowerCase();
        const colonIdx = line.indexOf(':');

        // 2. Try known stock keywords
        for (const [key, ruleType] of Object.entries(STOCK_FIELD_RULES)) {
            if (ll.startsWith(key + ':') || ll === key) {
                const val = colonIdx !== -1 ? line.substring(colonIdx + 1).trim() : '';
                if (ruleType === 'hd_pips') return renderHDPips(val);
                if (ruleType === 'spell_group') return renderSpellGroups(val);
                return renderSubFieldByRule({ renderType: ruleType }, line);
            }
        }

        // 3. Fallback: unknown KV pair or plain line (always attached to entity if we are here)
        if (colonIdx !== -1) {
            return renderSubFieldByRule({ renderType: 'highlight' }, line);
        }
        return `<div class="rt-entity-sub-line">${escapeHtmlWithColor(line)}</div>`;
    }

    /**
     * Renders a single line from a custom block (non-built-in tag).
     */
    export function renderCustomBlockLine(tag, line, lineIdx = 0) {
        const asMarker = tryRenderMarker(line, tag, '', lineIdx);
        if (asMarker !== null) return asMarker;

        // Plain kv fallback
        const kv = line.match(/^([^:]+):\s*(.+)$/);
        if (kv) return `<div class="rt-card-kv"><span class="rt-card-key">${escapeHtmlWithColor(kv[1].trim())}:</span><span class="rt-card-val">${escapeHtmlWithColor(kv[2].trim())}</span></div>`;
        return `<div class="rt-card-item">${escapeHtmlWithColor(line.trim())}</div>`;
    }

    /**
     * Strip HTML tags from a memo string, preserving inner text.
     * Used before sending the memo to the AI to avoid token bloat from
     * color markup (<font>, <span>, etc.) that is purely for display.
     * NOTE: ((MARKERS)) like ((PILLS)), ((BAR)), etc. are intentionally
     * preserved so the AI can faithfully echo them back in its output.
     */
    export function stripMemoHtml(text) {
        if (!text) return text;
        // Convert <br> variants to newlines so line structure is preserved
        let stripped = text.replace(/<br\s*\/?>/gi, '\n');
        // Remove all HTML tags, keeping their inner text
        stripped = stripped.replace(/<[^>]+>/g, '');
        return stripped;
    }

    /**
     * Like escapeHtml but allows <font color="#hex"> and <font color="name"> tags through,
     * converting them to safe <span style="color:"> elements.
     * Use this for all AI/user content rendered into tracker cards.
     */
    export function escapeHtmlWithColor(str) {
        if (!str) return '';

        // Rarity tag map (WoW-style item quality)
        const RARITY_COLORS = {
            'poor': '#9d9d9d',
            'common': '#ffffff',
            'uncommon': '#1eff00',
            'rare': '#0070dd',
            'epic': '#a335ee',
            'legendary': '#ff8000',
            'artifact': '#e6cc80',
            'heirloom': '#00ccff'
        };

        // Shared placeholder system — placeholders survive escapeHtml unchanged
        const OPEN = '\x01';
        const CLOSE = '\x02';
        const spans = [];

        // 1. Process [Rarity] tags. They hide the tag and color everything that follows them.
        const rarityRx = /\[(poor|common|uncommon|rare|epic|legendary|artifact|heirloom)\]\s*([\s\S]*)/gi;
        let processed = str.replace(rarityRx, (match, rarity, rest) => {
            const color = RARITY_COLORS[rarity.toLowerCase()];
            // Recursively process 'rest' for any font tags, but skip rarity tags (already handled)
            const safeInner = escapeHtmlWithColor(rest);
            spans.push(`<span style="color:${color}">${safeInner}</span>`);
            return OPEN + (spans.length - 1) + CLOSE;
        });

        // 2. Replace <font color=...>inner</font> tags (author-written color markup).
        //    The inner text is recursively processed so nested tags work correctly.
        const colorRx = /<font\s+color\s*=\s*["']?(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)["']?>([\s\S]*?)<\/font>/gi;
        const tokenized = processed.replace(colorRx, (_, color, inner) => {
            // inner may contain more font tags but NOT rarity tags (already replaced above)
            const safeInner = escapeHtmlWithColor(inner);
            spans.push(`<span style="color:${color}">${safeInner}</span>`);
            return OPEN + (spans.length - 1) + CLOSE;
        });

        // 3. Escape everything that remains, then restore the safe span placeholders.
        return escapeHtml(tokenized).replace(/\x01(\d+)\x02/g, (_, i) => spans[parseInt(i)]);
    }

    const splitSmart = (text) => {
        const res = [];
        let cur = '', depth = 0;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '(') depth++; else if (c === ')') depth--;
            // Do not split on comma if it is between two digits (thousands separator)
            const isDigitSeparator = c === ',' && i > 0 && i < text.length - 1 && /\d/.test(text[i - 1]) && /\d/.test(text[i + 1]);
            if (c === ',' && depth === 0 && !isDigitSeparator) { res.push(cur.trim()); cur = ''; }
            else cur += c;
        }
        if (cur.trim()) res.push(cur.trim());
        return res;
    };

    const renderPills = (text, customColor = null) => {
        const colorStyle = customColor ? ` style="background:${customColor}1a;border-color:${customColor}66;color:${customColor};"` : '';
        return splitSmart(text).map(t => {
            // Detect buff/debuff prefix
            let pillClass = 'rt-unit-pill';
            let displayText = t;
            if (t.startsWith('(+)') || t.startsWith('(+) ')) {
                pillClass += ' rt-pill-buff';
                displayText = t.replace(/^\(\+\)\s*/, '');
            } else if (t.startsWith('(-)') || t.startsWith('(-) ')) {
                pillClass += ' rt-pill-debuff';
                displayText = t.replace(/^\(-\)\s*/, '');
            }

            const m = displayText.match(/^(.+?)\s*\((.+)\)$/);
            if (m) {
                const [, name, desc] = m;

                // Extract resource count if present (e.g., "2/3")
                let iconHtml = '';
                const resourceMatch = desc.match(/(\d+)\s*\/\s*(\d+)/);
                if (resourceMatch) {
                    iconHtml = `<span class="rt-unit-icon">${escapeHtmlWithColor(resourceMatch[0])}</span>`;
                }

                return `<span class="${pillClass}"${colorStyle}>
                    <span class="rt-unit-name">${escapeHtmlWithColor(name)}</span>
                    ${iconHtml}
                    <span class="rt-unit-descr">(${escapeHtmlWithColor(desc)})</span>
                </span>`;
            }
            return `<span class="${pillClass} no-desc"${colorStyle}><span class="rt-unit-name">${escapeHtmlWithColor(displayText)}</span></span>`;
        }).join('');
    };

    /**
     * Renders a single ability line as a structured pill.
     * Splits on the FIRST colon only: everything before is the "name"
     * (may include a resource annotation like "Rage (2/2 per day)"),
     * everything after is the description.  This intentionally does NOT
     * split on commas inside the description (unlike renderPills/splitSmart),
     * so ability text like "Resistance to bludgeoning, piercing, slashing"
     * stays as one contiguous pill description instead of being shattered
     * into multiple pills.
     */
    const renderAbilityLine = (text) => {
        let pillClass = 'rt-unit-pill';
        let displayText = text.trim();

        // Strip buff/debuff prefix markers
        if (displayText.startsWith('(+)') || displayText.startsWith('(+) ')) {
            pillClass += ' rt-pill-buff';
            displayText = displayText.replace(/^\(\+\)\s*/, '');
        } else if (displayText.startsWith('(-)') || displayText.startsWith('(-) ')) {
            pillClass += ' rt-pill-debuff';
            displayText = displayText.replace(/^\(-\)\s*/, '');
        }

        const colonIdx = displayText.indexOf(':');
        if (colonIdx !== -1) {
            const namePart = displayText.substring(0, colonIdx).trim();
            const descPart = displayText.substring(colonIdx + 1).trim();

            // Extract resource count from the name part (e.g. "Rage (2/2 per day)")
            let iconHtml = '';
            const resourceMatch = namePart.match(/(\d+)\s*\/\s*(\d+)/);
            if (resourceMatch) {
                iconHtml = `<span class="rt-unit-icon">${escapeHtmlWithColor(resourceMatch[0])}</span>`;
            }

            if (descPart) {
                return `<div class="rt-entity-sub-line rt-units-container"><span class="${pillClass}">
                    <span class="rt-unit-name">${escapeHtmlWithColor(namePart)}</span>
                    ${iconHtml}
                    <span class="rt-unit-descr">${escapeHtmlWithColor(descPart)}</span>
                </span></div>`;
            }
        }

        // No colon — fall back to a simple no-description pill
        return `<div class="rt-entity-sub-line rt-units-container"><span class="${pillClass} no-desc"><span class="rt-unit-name">${escapeHtmlWithColor(displayText)}</span></span></div>`;
    };


    /**
     * 'BENCHED PARTY' is never rendered as its own section/tab — it's folded into PARTY's
     * own card as a compact camp roster sub-panel (see renderBenchedPartyPanel). It has its
     * own enable toggle + editable prompt (settings.modules['benched party']) but is
     * deliberately NOT in BLOCK_ORDER (constants.js), since BLOCK_ORDER also drives render
     * order here — without stripping it explicitly, it'd fall into the "unlisted tag"
     * fallback below and render as a standalone card. blocks['BENCHED PARTY'] itself is
     * untouched by this — renderSectionCard reads it directly to build the nested panel.
     */
    function stripBenchedPartyTag(tags) {
        return tags.filter(t => t !== 'BENCHED PARTY');
    }

    /**
     * When [BENCHED PARTY] has members but [PARTY] was removed/emptied (everyone benched),
     * synthesize an empty PARTY shell so the PARTY card still renders and hosts the camp
     * roster sub-panel. Only when the benched-party module is enabled.
     * @param {object} blocks
     * @returns {object}
     */
    function ensurePartyShellForBenchedRoster(blocks) {
        const s = getSettings();
        if (s.modules?.['benched party'] === false || s.modules?.party === false) return blocks;

        const benched = blocks['BENCHED PARTY'];
        if (!benched || /^(?:REMOVED|EXPIRED|CLEARED|NONE)$/i.test(benched.trim())) return blocks;

        const party = blocks['PARTY'];
        const partyMissing = party === undefined
            || !String(party).trim()
            || /^(?:REMOVED|EXPIRED|CLEARED|NONE)$/i.test(String(party).trim());

        if (partyMissing) {
            blocks['PARTY'] = '';
        }
        return blocks;
    }

    /**
     * Parse the memo's [TAG]...[/TAG] blocks and return structured object.
     */
    export function parseMemoBlocks(memo) {
        const blocks = {};
        const pattern = /\[([^\]\/][^\]]*)\]([\s\S]*?)\[\/\1\]/gi;
        for (const [, tag, content] of memo.matchAll(pattern)) {
            blocks[tag.trim().toUpperCase()] = content.trim();
        }
        return blocks;
    }

    const COLLAPSE_KEY = 'rpg_tracker_collapsed';
    const DETACHED_KEY = 'rpg_tracker_detached';



    export function getPageSize(tag) {
        const s = getSettings();
        if (s.modulePageSizes && s.modulePageSizes[tag]) {
            return s.modulePageSizes[tag];
        }
        // Fallback to stock defaults
        return tag === 'SPELLS' ? 5 : PAGE_SIZE;
    }

    export function loadCollapsed() {
        try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); }
        catch { return new Set(); }
    }
    export function saveCollapsed(set) {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set]));
    }

    export function loadDetached() {
        try { return new Set(JSON.parse(localStorage.getItem(DETACHED_KEY) || '[]')); }
        catch { return new Set(); }
    }
    export function saveDetached(set) {
        localStorage.setItem(DETACHED_KEY, JSON.stringify([...set]));
    }

    const ACTIVE_TAB_KEY = 'rpg_tracker_active_tab';

    /** Returns the last-selected tab in Tab Mode, or '' if none set yet. */
    export function loadActiveTab() {
        try { return localStorage.getItem(ACTIVE_TAB_KEY) || ''; }
        catch { return ''; }
    }
    export function saveActiveTab(tag) {
        try { localStorage.setItem(ACTIVE_TAB_KEY, tag || ''); }
        catch { /* ignore */ }
    }



// ── Portrait rendering helpers ──────────────────────────────────────────────

/**
 * Returns the inner HTML for the portrait box of an entity.
 * Checks customPortraits (per-chat) first; falls back to a placeholder icon.
 * @param {string} entityName
 * @returns {string}
 */
function renderPortraitHtml(entityName) {
    const s = getSettings();
    const src = lookupCustomPortraitSrc(s, entityName);
    if (src) {
        return `<img class="rt-entity-portrait" src="${escapeHtml(src)}" alt="${escapeHtml(entityName)}" />`;
    }
    return `<i class="fa-solid fa-user-shield rt-entity-portrait-placeholder" aria-hidden="true"></i>`;
}

/**
 * Wraps entity content HTML in a flex container with a portrait box on the left.
 * Returns content unmodified when enablePortraits is false.
 * @param {string} entityName
 * @param {string} contentHtml
 * @returns {string}
 */
function wrapEntityHtml(entityName, contentHtml) {
    if (!getSettings().enablePortraits) return contentHtml;
    return `<div class="rt-entity-container" data-entity-name="${escapeHtml(entityName)}">
        <div class="rt-entity-portrait-container" title="Drop image here or click to set portrait">
            ${renderPortraitHtml(entityName)}
        </div>
        <div class="rt-entity-content">${contentHtml}</div>
    </div>`;
}

/**
 * Helper to parse a currency/worth string to a total value in Copper Pieces (CP).
 * Supports both D&D standard pieces (GP, SP, CP) and generic dollar/euro/pound.
 * @param {string} str 
 * @returns {number}
 */
function parseValueToCopper(str) {
    let totalCp = 0;
    
    // Suffix regex (matching gp, sp, cp, gold, silver, bronze, copper, usd, eur, gbp, dollar, euro, pound, etc.)
    const suffixRx = /([\d,]+(?:\.\d+)?)\s*(gp|sp|cp|gold|silver|bronze|copper|usd|eur|gbp|dollar|euros?|pounds?)\b/gi;
    // Prefix regex (matching $, £, €)
    const prefixRx = /([$£€])\s*([\d,]+(?:\.\d+)?)/gi;

    let match;
    let found = false;

    const cleanNum = (numStr) => parseFloat(numStr.replace(/,/g, ''));

    // Reset regex indices since they are global
    suffixRx.lastIndex = 0;
    prefixRx.lastIndex = 0;

    // Check suffix matches
    while ((match = suffixRx.exec(str)) !== null) {
        found = true;
        const num = cleanNum(match[1]);
        const unit = match[2].toLowerCase();
        if (/\b(gold|gp|usd|eur|gbp|dollar|euro|pound)\b/.test(unit)) {
            totalCp += num * 100;
        } else if (/\b(silver|sp)\b/.test(unit)) {
            totalCp += num * 10;
        } else if (/\b(bronze|copper|cp)\b/.test(unit)) {
            totalCp += num;
        }
    }

    // Check prefix matches
    while ((match = prefixRx.exec(str)) !== null) {
        found = true;
        const num = cleanNum(match[2]);
        totalCp += num * 100;
    }

    return found ? totalCp : 0;
}

/**
 * Helper to detect currency type from a string.
 * @param {string} str
 * @returns {string|null}
 */
function detectCurrency(str) {
    if (/\$|\b(usd|dollars?)\b/i.test(str)) return 'usd';
    if (/€|\b(eur|euros?)\b/i.test(str)) return 'eur';
    if (/£|\b(gbp|pounds?)\b/i.test(str)) return 'gbp';
    if (/\b(gp|sp|cp|gold|silver|bronze|copper)\b/i.test(str)) return 'gp';
    return null;
}

/**
 * Helper to format a Copper Pieces value back to a standard GP, SP, CP string or modern currency representation.
 * @param {number} totalCp 
 * @param {string} detectedCurrency
 * @returns {string}
 */
function formatValueToCurrency(totalCp, detectedCurrency) {
    if (totalCp <= 0) return '';
    const amount = totalCp / 100;
    const formattedAmount = amount.toLocaleString('en-US', {
        minimumFractionDigits: totalCp % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    });
    
    switch (detectedCurrency) {
        case 'usd':
            return `$${formattedAmount}`;
        case 'eur':
            return `€${formattedAmount}`;
        case 'gbp':
            return `£${formattedAmount}`;
        case 'gp':
        default: {
            const gp = Math.floor(totalCp / 100);
            const sp = Math.floor((totalCp % 100) / 10);
            const cp = Math.floor(totalCp % 10);

            const parts = [];
            if (gp > 0) parts.push(`${gp.toLocaleString('en-US')} GP`);
            if (sp > 0) parts.push(`${sp} SP`);
            if (cp > 0) parts.push(`${cp} CP`);

            return parts.join(', ');
        }
    }
}

    export function blockToItems(tag, content, renderTypeOverride = null) {
        const rawLines = content.split('\n').map(l => l.trim()).filter(Boolean);
        const lines = rawLines.map(line => {
            // Strip leading bullet markers (-, *, +, •, en-dash, em-dash)
            // but only if followed by space(s) or a letter (prevents stripping negative numbers like -5)
            return line.replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        });
        let renderType = renderTypeOverride || tag;
        const customField = (getSettings().customFields || []).find(f => f.tag.toUpperCase() === tag);
        if (!renderTypeOverride && customField && customField.renderType) {
            renderType = customField.renderType;
        }

        switch (renderType) {
            case 'COMBAT':
            case 'PARTY':
            case 'BENCHED PARTY':
            case 'CHARACTER': {
                const results = [];
                let lastEntityIdx = -1;
                let currentEntity = '';

                const MARKER_RX = /^\(\((PILLS|BAR|XPBAR|TEXT|BADGE|HIGHLIGHT|HPBAR|PLS|B|XB|HGT|HPB|BDG|HP)\)\)\s*(.*)/i;
                const MARKER_TYPE_MAP = {
                    'PILLS': 'pills', 'PLS': 'pills',
                    'BAR': 'hp_bar', 'B': 'hp_bar',
                    'HPBAR': 'hp_bar', 'HPB': 'hp_bar',
                    'HP': 'hp_bar',
                    'XPBAR': 'xp_bar', 'XB': 'xp_bar',
                    'TEXT': 'text',
                    'BADGE': 'badge', 'BDG': 'badge',
                    'HIGHLIGHT': 'highlight', 'HGT': 'highlight'
                };

                for (let i = 0; i < lines.length; i++) {
                    const rawLine = lines[i];
                    const mm = rawLine.match(MARKER_RX);
                    let markerCode = mm ? mm[1].toUpperCase() : null;
                    const explicitType = mm ? MARKER_TYPE_MAP[markerCode] : null;
                    let line = mm ? mm[2].trim() : rawLine;

                    // Detect inline hp-bar marker: "Entity Name ((BARGREEN)) 12/20"
                    // Uses tokenizeMarkers (the same engine used for sub-field lines) so ALL
                    // color-variant bar markers (BARGREEN, BARRED, BARPURPLE, etc.) work here,
                    // not just the handful in the old hardcoded regex.
                    // Only fires when the marker is NOT at line-start (MARKER_RX already handles that).
                    let inlineEntityName = null;
                    let inlineBarRule = null;
                    if (!mm) {
                        const segs = tokenizeMarkers(rawLine);
                        if (segs.length > 0 && segs[0].preText && segs[0].rule?.renderType === 'hp_bar') {
                            inlineEntityName = segs[0].preText.trim();
                            inlineBarRule    = segs[0].rule;          // carries color, renderType, etc.
                            line = segs[0].content.trim();            // just the value: "12/20" or "HP: 12/20"
                            markerCode = segs[0].markerType;          // e.g. "BARGREEN"
                        }
                    }

                    // 1. Combat Round header
                    if (tag === 'COMBAT' && /Combat Round\s*\d+/i.test(line)) {
                        results.push(`<div class="rt-combat-round">${escapeHtmlWithColor(line)}</div>`);
                        lastEntityIdx = -1;
                        continue;
                    }

                    // 2. Entity anchor: classic "Name: X/Y HP ..." or explicit ((HP)) marker
                    let hpMatch = line.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP\s*[:|,]?\s*(.*)$/i);
                    const isHpMarker = (markerCode === 'HP' || markerCode === 'HPB' || markerCode === 'HPBAR');

                    // If marker is specifically ((HP)), try a more relaxed regex (optional HP suffix)
                    if (!hpMatch && isHpMarker) {
                        hpMatch = line.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?(?:\s*HP)?\s*[:|,]?\s*(.*)$/i);
                    }

                    // Inline-marker fallback: line was rewritten to just the value portion
                    // (e.g. "HP: 20/20" or bare "20/20"). Use a flexible regex that makes the
                    // label prefix ("HP:") optional so both forms parse correctly.
                    if (!hpMatch && inlineEntityName) {
                        hpMatch = line.match(/^(?:(.+?):\s*)?(\d[\d,]*)(?:\/(\d[\d,]*))?(?:\s*HP)?\s*[:|,]?\s*(.*)$/i);
                    }

                    if (hpMatch) {
                        const [, nameRaw, curRaw, maxRaw, rest] = hpMatch;
                        // inlineEntityName takes priority (set when "Name ((BARGREEN)) x/y" format used)
                        const name = (inlineEntityName || nameRaw || '').trim();
                        const cur = Number(curRaw.replace(/,/g, ''));
                        const max = maxRaw ? Number(maxRaw.replace(/,/g, '')) : undefined;
                        const hasMax = max !== undefined;
                        const pct = hasMax ? Math.max(0, Math.min(100, (cur / max) * 100)) : 100;
                        // If an inline color-bar rule was detected (e.g. ((BARGREEN))), use its
                        // color directly — don't override it with the damage-based red/yellow/green.
                        const hpColor = inlineBarRule?.color
                            ? inlineBarRule.color
                            : (!hasMax ? DEFAULT_HP_COLOR : pct > 60 ? DEFAULT_HP_COLOR : pct > 30 ? '#ffaa00' : '#ff5555');
                        const status = (rest || '').trim().replace(/^\|\s*/, '');
                        
                        const showAsPct = getBarShowAsPercentage(`${tag}:${name}:HP`);
                        const dispCur = showAsPct ? Math.round(pct) : curRaw;
                        const dispMax = showAsPct ? 100 : maxRaw;
                        const label = hasMax ? `${dispCur}/${dispMax}` : `${curRaw}`;

                        currentEntity = name;
                        const barId = `${tag}:${currentEntity}:HP`;
                        const barBg = getBarBackground(barId, hpColor, pct);

                        lastEntityIdx = results.length;
                        if (inlineEntityName) {
                            results.push(`<div class="rt-entity-row" style="display:block; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:6px;">
                                <div class="rt-entity-name" style="font-size:1.1em; margin-bottom:6px;">${escapeHtmlWithColor(currentEntity)}</div>
                                <div class="rt-hp-bar-wrap" title="Click to recolor HP" data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}" style="position:relative; height:14px; border-radius:4px; overflow:hidden; background:rgba(255,255,255,0.1); margin-bottom:4px; width:100%;">
                                    <div class="rt-hp-bar" style="width:${pct.toFixed(1)}%; height:100%; border-radius:4px; background:${barBg}; transition:width 0.3s;"></div>
                                </div>
                                <span class="rt-hp-label" style="display:block; font-size:0.82em; opacity:0.85; text-align:left; line-height:1.2;">${label}</span>
                            </div>`);
                        } else {
                            results.push(`<div class="rt-entity-row"><div class="rt-entity-name">${escapeHtmlWithColor(currentEntity)}</div><div class="rt-hp-bar-wrap" title="Click to recolor HP" data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}"><div class="rt-hp-bar" style="width:${pct.toFixed(1)}%;background:${barBg};"></div></div><span class="rt-hp-label">${label}</span></div>`);
                        }

                        if (status) {
                            const parts = status.split('|').map(p => p.trim()).filter(Boolean);
                            let genericInfo = [];
                            for (const part of parts) {
                                if (part.toLowerCase().startsWith('ac:')) {
                                    results[lastEntityIdx] += `<div class="rt-entity-sub-line"><span class="rt-entity-sub-label">AC:</span> ${escapeHtmlWithColor(part.substring(3).trim())}</div>`;
                                } else if (part.toLowerCase().startsWith('saves:')) {
                                    results[lastEntityIdx] += `<div class="rt-entity-sub-line"><span class="rt-entity-sub-label">Saves:</span> ${highlightParens(escapeHtmlWithColor(part.substring(6).trim()))}</div>`;
                                } else if (part.toLowerCase().startsWith('status:')) {
                                    results[lastEntityIdx] += `<div class="rt-entity-sub-line rt-units-container"><span class="rt-entity-sub-label">Status:</span> ${renderPills(part.substring(7).trim())}</div>`;
                                } else if (part.toLowerCase().startsWith('other:') || part.toLowerCase().startsWith('res:')) {
                                    const lbl = part.toLowerCase().startsWith('res:') ? 'Res:' : 'Other:';
                                    const start = part.toLowerCase().startsWith('res:') ? 4 : 6;
                                    results[lastEntityIdx] += `<div class="rt-entity-sub-line rt-units-container"><span class="rt-entity-sub-label">${lbl}</span> ${renderPills(part.substring(start).trim())}</div>`;
                                } else { genericInfo.push(part); }
                            }
                            if (genericInfo.length > 0) {
                                results[lastEntityIdx] += `<div class="rt-entity-sub-line"><span class="rt-entity-sub-label">Info:</span> ${highlightParens(escapeHtmlWithColor(genericInfo.join(' | ')))}</div>`;
                            }
                        }
                        continue;
                    }

                    // 2b. CHARACTER/PARTY plain-name fallback anchor:
                    // If no HP pattern matched and this is a CHARACTER or PARTY block
                    // and we have no active entity yet, treat the first line as the entity name
                    // header (without an HP bar). This decouples portrait rendering from the
                    // strict "Name: X/Y HP" format requirement.
                    if (!hpMatch && (tag === 'CHARACTER' || tag === 'PARTY') && lastEntityIdx === -1) {
                        let entityLabel = line.trim();
                        let restOfHeader = '';
                        const plainNameColonMatch = line.match(/^(.+?):\s*(.*)/);
                        if (plainNameColonMatch) {
                            if (plainNameColonMatch[1].trim().toLowerCase() === 'name') {
                                entityLabel = plainNameColonMatch[2].trim();
                            } else {
                                entityLabel = plainNameColonMatch[1].trim();
                                restOfHeader = plainNameColonMatch[2].trim();
                            }
                        }

                        currentEntity = entityLabel;
                        lastEntityIdx = results.length;

                        // Render as entity-name header with optional rest as a sub-label (e.g. class info)
                        let headerHtml = `<div class="rt-entity-row"><div class="rt-entity-name">${escapeHtmlWithColor(currentEntity)}</div>`;
                        if (restOfHeader) {
                            headerHtml += `<span class="rt-hp-label" style="opacity:0.75; font-size:0.9em;">${escapeHtmlWithColor(restOfHeader)}</span>`;
                        }
                        headerHtml += `</div>`;
                        results.push(headerHtml);
                        continue;
                    }

                    // 3. Sub-field Logic (Sticky Context)

                    if (lastEntityIdx !== -1) {
                        results[lastEntityIdx] += renderLineInEntityContext(tag, line, currentEntity, rawLine);
                    } else {
                        // No active entity: render as a standalone card line
                        results.push(`<div class="rt-card-item">${escapeHtmlWithColor(rawLine)}</div>`);
                    }
                }
                // Wrap each entity's accumulated HTML in portrait container before returning
                return results.map((html, idx) => {
                    // Only wrap entity rows (ones that have the entity-row class start), not round headers
                    if (html.startsWith('<div class="rt-combat-round">')) return html;
                    // Extract entity name from the first rt-entity-name span
                    const nameMatch = html.match(/class="rt-entity-name"[^>]*>([^<]+)</);
                    if (!nameMatch) return html;
                    return wrapEntityHtml(decodeHtml(nameMatch[1].trim()), html);
                });
            }

            case 'TIME': {
                let currentTotalMins = 0;
                let parsedCurrent = false;

                // parseTimeStr removed, using shared parseInWorldTime from memo-processor.js

                for (let line of lines) {
                    if (line.toLowerCase().startsWith('last rest:')) continue;
                    if (!parsedCurrent) {
                        const t = parseInWorldTime(line);
                        if (t !== null) {
                            currentTotalMins = t;
                            parsedCurrent = true;
                        }
                    }
                }

                return lines.map((line, idx) => {
                    if (line.toLowerCase().startsWith('last rest:')) {
                        const restVal = line.substring(line.indexOf(':') + 1).trim();
                        let append = "";
                        if (parsedCurrent && !isRestTimeUnset(restVal)) {
                            const restMins = parseInWorldTime(restVal);
                            if (restMins !== null) {
                                const diff = currentTotalMins - restMins;
                                if (diff >= 0) {
                                    append = `&nbsp;<span style="opacity: 0.7; font-size: 1em;">(${formatTimeDiff(diff, false)})</span>`;
                                }
                            }
                        }
                        return `<div class="rt-card-line"><b>Last Rest:</b>&nbsp;${escapeHtmlWithColor(restVal)}${append}</div>`;
                    }
                    const asMarker = tryRenderMarker(line, tag, '', idx);
                    if (asMarker !== null) return asMarker;
                    const { emoji: lineEmoji, color } = getTimeOfDayInfo(line);
                    const linePrefix = lineEmoji ? `<span class="rt-tod-emoji" style="margin-right:4px;">${lineEmoji}</span>` : '';
                    const content = (color !== 'inherit') 
                        ? `<span style="color: ${color};">${escapeHtmlWithColor(line)}</span>`
                        : escapeHtmlWithColor(line);
                    return `<div class="rt-card-line">${linePrefix}${content}</div>`;
                });
            }
            case 'XP':
                return lines.map((line, idx) => {
                    const asMarker = tryRenderMarker(line, tag, '', idx);
                    if (asMarker !== null) return asMarker;

                    // New format: Total: 1,200 / 2,700 XP (Level 3)
                    let m = line.match(/Total:\s*([\d,]+)\s*\/\s*([\d,]+)\s*XP\s*\(Level\s*(\d+)\)/i);
                    if (m) {
                        const [, curRaw, maxRaw, level] = m;
                        const cur = Number(curRaw.replace(/,/g, ''));
                        const max = Number(maxRaw.replace(/,/g, ''));
                        const pct = Math.max(0, Math.min(100, (cur / max) * 100));
                        const barId = 'XP::XP';
                        const barBg = getBarBackground(barId, 'linear-gradient(90deg, #f39c12, #e67e22)', pct);

                        const showAsPct = getBarShowAsPercentage(barId);
                        const dispCur = showAsPct ? Math.round(pct) : curRaw;
                        const dispMax = showAsPct ? 100 : maxRaw;

                        return `<div class="rt-xp-row">
                            <div class="rt-xp-label"><span>Level ${level}</span><span>XP: ${dispCur} / ${dispMax}</span></div>
                            <div class="rt-xp-bar-wrap" title="Click to recolor XP" data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}">
                                <div class="rt-xp-bar" style="width:${pct.toFixed(1)}%; background:${barBg};"></div>
                            </div>
                        </div>`;
                    }

                    // Legacy format: XP: 1,200/2,700 or Level: 3 | XP: 1,200/2,700
                    m = line.match(/(?:Level:\s*(\d+)\s*\|?\s*)?XP:\s*([\d,]+)\/([\d,]+)/i);
                    if (m) {
                        const [, level, curRaw, maxRaw] = m;
                        const cur = Number(curRaw.replace(/,/g, ''));
                        const max = Number(maxRaw.replace(/,/g, ''));
                        const pct = Math.max(0, Math.min(100, (cur / max) * 100));
                        const levelHtml = level ? `<span>Level ${level}</span>` : '';
                        const barId = 'XP::XP';
                        const barBg = getBarBackground(barId, 'linear-gradient(90deg, #f39c12, #e67e22)', pct);

                        const showAsPct = getBarShowAsPercentage(barId);
                        const dispCur = showAsPct ? Math.round(pct) : curRaw;
                        const dispMax = showAsPct ? 100 : maxRaw;

                        return `<div class="rt-xp-row">
                            <div class="rt-xp-label">${levelHtml}<span>XP: ${dispCur} / ${dispMax}</span></div>
                            <div class="rt-xp-bar-wrap" title="Click to recolor XP" data-recolor-id="${escapeHtml(barId)}" data-recolor-current="${escapeHtml(barBg)}">
                                <div class="rt-xp-bar" style="width:${pct.toFixed(1)}%; background:${barBg};"></div>
                            </div>
                        </div>`;
                    }

                    return `<div class="rt-card-item">${escapeHtmlWithColor(line)}</div>`;
                });
            case 'SPELLS': {
                // Lines: "Level N (avail/max): Spell1, Spell2" or "Cantrips: Spell1, Spell2"
                return lines.map((line, idx) => {
                    const asMarker = tryRenderMarker(line, tag, '', idx);
                    if (asMarker !== null) return asMarker;

                    const m = line.match(/^(Level\s*\d+|Cantrips?)\s*(?:\((\d+)\/(\d+)[^)]*\))?\s*:\s*(.+)$/i);
                    if (!m) return `<div class="rt-card-item">${escapeHtmlWithColor(line)}</div>`;
                    const [, label, availStr, maxStr, spellList] = m;
                    const isCantrip = /cantrip/i.test(label);
                    let pipsHtml = '';
                    if (!isCantrip && availStr !== undefined && maxStr !== undefined) {
                        const avail = parseInt(availStr, 10), max = parseInt(maxStr, 10);
                        const pips = Array.from({ length: max }, (_, i) =>
                            `<span class="rt-slot-pip${i < avail ? ' rt-slot-available' : ' rt-slot-used'}"></span>`
                        ).join('');
                        pipsHtml = `<span class="rt-slot-pips">${pips}</span>`;
                    }
                    const spells = spellList.split(',').map(s => {
                        const name = s.trim();
                        const slug = name.toLowerCase()
                            .replace(/'/g, '')
                            .replace(/[^a-z0-9]+/g, '-');
                        const url = `https://dnd5e.wikidot.com/spell:${slug}`;
                        return `<a href="${url}" target="_blank" class="rt-spell-name" title="View spell on Wikidot">${escapeHtmlWithColor(name)}</a>`;
                    }).join('');
                    return `<div class="rt-spell-row">
                        <span class="rt-spell-level">${escapeHtmlWithColor(label.trim())}</span>
                        <div class="rt-spell-inline-group">
                            <div class="rt-spell-list">${pipsHtml}${spells}</div>
                        </div>
                    </div>`;
                });
            }
            case 'INVENTORY': {
                // Lines with a ((MARKER)) prefix bypass the bullet-list renderer
                const inventoryResults = [];
                const pendingBullets = [];
                let totalCp = 0;
                const currencyCounts = { gp: 0, usd: 0, eur: 0, gbp: 0 };

                const trackCurrency = (val) => {
                    const cur = detectCurrency(val);
                    if (cur) currencyCounts[cur]++;
                };

                const flushBullets = () => {
                    if (!pendingBullets.length) return;

                    // Currency detection map: pattern → { color, icon }
                    const CURRENCY_STYLES = [
                        { rx: /\b(gold|gp)\b/i,                               color: '#ffd700', icon: '💰' },
                        { rx: /\b(dollar|usd|euro|eur|pound|gbp)s?\b|[$£€]/i,  color: '#85bb65', icon: '💵' },
                        { rx: /\b(silver|sp)\b/i,                              color: '#c0c0c0', icon: '🪙' },
                        { rx: /\b(bronze|copper|cp)\b/i,                       color: '#cd7f32', icon: '🪙' },
                    ];

                    // Bare currency item: a line that IS the currency (e.g. "45 GP", "💰 45 GP", "$500", "130 Gold Dragons")
                    // — no parenthesised worth annotation, just a number + currency unit
                    const BARE_CURRENCY_RX = /^[^(]*?(?:([$£€])\s*\d[\d,]*|\d[\d,]*\s*(gp|sp|cp|gold|silver|bronze|copper|dollar|usd|euro|eur|pound|gbp|£|\$|€)(?:\s+[a-z]+){0,2})\s*$/i;

                    const worthMode = getSettings().inventoryWorthMode || 'hover'; // 'hover' | 'display'
                    const worthRx = /\s*\(~([^)]+)\)\s*$|\s*\(Worth:\s*([^)]+)\)\s*$/i;

                    pendingBullets.forEach(i => {
                        // ── Equipped tag: detect [E] and strip from display ──────────────────
                        const equippedRx = /\s*\[E\]\s*/i;
                        const isEquipped = equippedRx.test(i);
                        if (isEquipped) i = i.replace(equippedRx, ' ').trim();
                        const equippedClass = isEquipped ? ' rt-inventory-item--equipped' : '';

                        const worthMatch = i.match(worthRx);
                        let displayText = i;
                        let titleAttr = '';
                        let coinBadge = '';

                        if (worthMatch) {
                            // Item has a (~X GP) or (Worth: X GP) annotation
                            const worthVal = (worthMatch[1] || worthMatch[2]).trim();
                            trackCurrency(worthVal);
                            totalCp += parseValueToCopper(worthVal);
                            displayText = i.replace(worthRx, '').trim();

                            // Extract effect/stats parenthetical: last (...) group before the worth
                            // that looks mechanical (contains at least one digit)
                            const effectRx = /\s*\(([^)~][^)]*)\)\s*$/;
                            const effectMatch = displayText.match(effectRx);
                            let effectVal = '';
                            if (effectMatch && /\d/.test(effectMatch[1])) {
                                effectVal = effectMatch[1].trim();
                                displayText = displayText.replace(effectRx, '').trim();
                            }

                            // Build tooltip combining effect (if any) and worth
                            const tooltipParts = [];
                            if (effectVal) tooltipParts.push(`Effect: ${effectVal}`);
                            tooltipParts.push(`Worth: ${worthVal}`);
                            titleAttr = ` title="${escapeHtml(tooltipParts.join('\n'))}"`;

                            if (worthMode === 'display') {
                                // Show coin badge inline next to item text
                                const matched = CURRENCY_STYLES.find(s => s.rx.test(worthVal));
                                if (matched) {
                                    coinBadge = ` <span class="rt-coin-badge" style="color:${matched.color}; font-weight:bold; background:rgba(255,255,255,0.05); padding:1px 6px; border-radius:10px; border:1px solid ${matched.color}44; font-size:0.85em; margin-left:4px; white-space:nowrap;">${matched.icon} ${escapeHtml(worthVal)}</span>`;
                                }
                            }
                            // In 'hover' mode: worth is tooltip only — no badge
                            inventoryResults.push(`<div class="rt-card-item rt-inventory-item${equippedClass}"${titleAttr}>${escapeHtmlWithColor(displayText)}${coinBadge}</div>`);
                        } else if (BARE_CURRENCY_RX.test(i.trim())) {
                            // This line IS a currency amount (e.g. "45 GP", "💰 45 GP")
                            // Strip any leading bullet dash — safety guard (pendingBullets already strips it,
                            // but comma-split path might not)
                            const cleanText = i.trim().replace(/^\s*[-*]\s*/, '');
                            trackCurrency(cleanText);
                            totalCp += parseValueToCopper(cleanText);
                            const COIN_COLORS = [
                                { rx: /\b(gold|gp)\b/i,                               color: '#ffd700' },
                                { rx: /\b(dollar|usd|euro|eur|pound|gbp)s?\b|[$£€]/i,  color: '#85bb65' },
                                { rx: /\b(silver|sp)\b/i,                              color: '#c0c0c0' },
                                { rx: /\b(bronze|copper|cp)\b/i,                       color: '#cd7f32' },
                            ];
                            const matchedCoin = COIN_COLORS.find(s => s.rx.test(cleanText));
                            if (matchedCoin) {
                                const c = matchedCoin.color;
                                // Same outer wrapper as all other inventory items → keeps bullet • styling
                                // Same badge style as display-mode worth badges → consistent shininess
                                inventoryResults.push(`<div class="rt-card-item rt-inventory-item"><span class="rt-coin-badge" style="color:${c}; font-weight:bold; background:rgba(255,255,255,0.05); padding:1px 6px; border-radius:10px; border:1px solid ${c}44; font-size:0.85em; white-space:nowrap;">${escapeHtmlWithColor(cleanText)}</span></div>`);
                            } else {
                                inventoryResults.push(`<div class="rt-card-item rt-inventory-item">${escapeHtmlWithColor(cleanText)}</div>`);
                            }
                        } else {
                            inventoryResults.push(`<div class="rt-card-item rt-inventory-item${equippedClass}">${escapeHtmlWithColor(displayText)}</div>`);
                        }
                    });
                    pendingBullets.length = 0;
                };

                for (let invIdx = 0; invIdx < lines.length; invIdx++) {
                    const line = lines[invIdx];
                    const asMarker = tryRenderMarker(line, tag, '', invIdx);
                    if (asMarker !== null) {
                        flushBullets();
                        inventoryResults.push(asMarker);
                        continue;
                    }
                    // Section subheader (e.g. "Gear:", "Other Items:") — plain text header line
                    if (/^[A-Za-z][A-Za-z\s]*:\s*$/.test(line.trim())) {
                        flushBullets();
                        const headerText = line.trim().replace(/:$/, '').trim();
                        inventoryResults.push(`<div class="rt-inventory-subheader">${escapeHtml(headerText)}</div>`);
                        continue;
                    }
                    // Original bullet/comma logic
                    if (line.trim().match(/^[-*]\s+/)) {
                        pendingBullets.push(line.trim().replace(/^[-*]\s*/, ''));
                    } else {
                        // Split on commas except when they are between digits (thousands separators) or inside parentheses
                        line.split(/(?<!\d),(?![^(]*\))|,(?!\d)(?![^(]*\))/).map(i => i.trim()).filter(Boolean)
                            .forEach(i => pendingBullets.push(i));
                    }
                }
                flushBullets();

                if (totalCp > 0) {
                    // Find currency with highest count, default to 'gp'
                    let detectedCurrency = 'gp';
                    let maxCount = 0;
                    for (const [cur, count] of Object.entries(currencyCounts)) {
                        if (count > maxCount) {
                            maxCount = count;
                            detectedCurrency = cur;
                        }
                    }
                    inventoryResults.totalValueGP = formatValueToCurrency(totalCp, detectedCurrency);
                    inventoryResults.detectedCurrency = detectedCurrency;
                }
                return inventoryResults;
            }
            case 'ABILITIES': {
                const abilityResults = [];
                for (let abIdx = 0; abIdx < lines.length; abIdx++) {
                    const line = lines[abIdx];
                    const asMarker = tryRenderMarker(line, tag, '', abIdx);
                    if (asMarker !== null) { abilityResults.push(asMarker); continue; }
                    const l = line.trim().replace(/^[-*]\s*/, '');

                    // Format detection: does this line use the "Name: description" format
                    // (colon before any unparenthesised comma) or the old comma-separated
                    // pill format ("Rage (2/2 per day), Reckless Attack, Danger Sense")?
                    //
                    // Walk through the string tracking paren depth; the first character
                    // that is ',' at depth 0 is the "first unparenthesised comma", and
                    // the first ':' at depth 0 is the "first unparenthesised colon".
                    // If the colon comes first (or there is no comma at all), treat the
                    // whole line as a single ability via renderAbilityLine so that commas
                    // inside the description (e.g. "bludgeoning, piercing, slashing")
                    // are not mis-split into separate pills.
                    // If a comma comes first (old format), fall back to renderPills so
                    // that multi-ability single-line entries still work exactly as before.
                    let firstCommaIdx = -1, firstColonIdx = -1, depth = 0;
                    for (let ci = 0; ci < l.length; ci++) {
                        const ch = l[ci];
                        if (ch === '(') depth++;
                        else if (ch === ')') depth--;
                        else if (depth === 0) {
                            if (ch === ',' && firstCommaIdx === -1) firstCommaIdx = ci;
                            if (ch === ':' && firstColonIdx === -1) firstColonIdx = ci;
                        }
                        if (firstCommaIdx !== -1 && firstColonIdx !== -1) break;
                    }

                    const isColonFormat = firstColonIdx !== -1 &&
                        (firstCommaIdx === -1 || firstColonIdx < firstCommaIdx);

                    if (isColonFormat) {
                        abilityResults.push(renderAbilityLine(l));
                    } else {
                        // Old comma-separated pill format — wrap in a container div
                        abilityResults.push(
                            `<div class="rt-entity-sub-line rt-units-container">${renderPills(l)}</div>`
                        );
                    }
                }
                return abilityResults;
            }
            default:
                // Custom blocks: resolve each line via module rows → global rules → kv fallback
                // Pass line index so positional row matching works even without label prefixes
                return lines.map((line, idx) => renderCustomBlockLine(tag, line, idx));
        }
    }

    export function renderMemoAsCards(memo, filterTag, sectionPages) {
        if (!memo || !memo.trim()) {
            const obSettings = getSettings();
            const useDdMmYy = !!obSettings.useDdMmYyFormat;
            const use24h = !!obSettings.use24hTime;
            const onboardingGenre = obSettings.onboardingGenre || 'fantasy';
            const onboardingGearTier = obSettings.onboardingGearTier || 'auto';
            const gearTierOptions = renderStartingGearTierOptions(onboardingGearTier);
            const startDateInputVal = obSettings.initialDate && obSettings.initialDate !== 'Day 1' ? obSettings.initialDate : '01/01/2026';

            return `<div class="rt-empty" style="text-align: left; align-items: flex-start; padding: 12px; gap: 10px; overflow-y: auto;">
                <div style="text-align: center; width: 100%; margin-bottom: 2px; flex-shrink: 0;">
                    <div class="rt-empty-icon" style="font-size: 1.7em; margin-bottom: 0;">📜</div>
                    <div style="font-size: 16px; font-weight: bold; color: var(--rt-text);">Multihog D&D Framework</div>
                </div>

                <div class="rt-onboarding-hero">
                    <button type="button" class="rt-onboarding-hero-btn rt-random-char-btn" data-archetype="char_roll">🎲 Character Creator</button>
                    <div class="rt-onboarding-hero-sub">Build your character step by step — presets, persona bio, and full stat generation.</div>
                </div>

                <div class="rt-onboarding-secondary rt-onboarding-drawer">
                <button type="button" class="rt-onboarding-drawer-toggle" id="rt-onboarding-drawer-toggle" aria-expanded="false" aria-controls="rt-onboarding-drawer-body">
                    <span class="rt-onboarding-drawer-toggle-label">Other ways to begin</span>
                    <span class="rt-onboarding-drawer-chevron" aria-hidden="true">&#9656;</span>
                </button>
                <div class="rt-onboarding-drawer-body" id="rt-onboarding-drawer-body">
                <div class="rt-onboarding-drawer-body-inner">
                <!-- Configuration Grid -->
                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; margin: 4px 0; flex-shrink: 0;">
                    <div class="rt-onboarding-config-row">
                        <div class="rt-onboarding-field">
                            <span class="rt-onboarding-field-label">Level</span>
                            <select id="rt-starting-level" class="text_pole" style="width: auto; min-width: 60px; padding: 2px 4px; font-size: 11px; height: 22px; border-radius: 4px; background: var(--black70a);">
                                ${[...Array(20).keys()].map(i => {
                                    const lvl = i + 1;
                                    const isSel = lvl === parseInt(obSettings.onboardingLevel || '1') ? 'selected' : '';
                                    return `<option value="${lvl}" ${isSel}>Level ${lvl}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div class="rt-onboarding-field">
                            <span class="rt-onboarding-field-label">Genre</span>
                            <select id="rt-onboarding-genre" class="text_pole" style="width: auto; min-width: 90px; padding: 2px 4px; font-size: 11px; height: 22px; border-radius: 4px; background: var(--black70a);">
                                <option value="fantasy" ${onboardingGenre === 'fantasy' ? 'selected' : ''}>⚔️ Fantasy RPG</option>
                                <option value="realistic" ${onboardingGenre === 'realistic' ? 'selected' : ''}>🏙️ Modern / Realistic</option>
                                <option value="scifi" ${onboardingGenre === 'scifi' ? 'selected' : ''}>🚀 Sci-Fi</option>
                                <option value="horror" ${onboardingGenre === 'horror' ? 'selected' : ''}>👻 Horror</option>
                            </select>
                        </div>
                        <div class="rt-onboarding-field">
                            <span class="rt-onboarding-field-label">Gear Tier</span>
                            <select id="rt-onboarding-gear-tier" class="text_pole" title="How well-equipped the generated character should be." style="width: auto; min-width: 110px; padding: 2px 4px; font-size: 11px; height: 22px; border-radius: 4px; background: var(--black70a);">
                                ${gearTierOptions}
                            </select>
                        </div>
                        <div class="rt-onboarding-field">
                            <span class="rt-onboarding-field-label">Time &amp; Date</span>
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <div class="rt-seg-toggle" id="rt-onboarding-date-seg" role="group" title="Choose the calendar format used for [TIME] tracking.">
                                    <button type="button" data-value="day" class="${!useDdMmYy ? 'active' : ''}">Day 1</button>
                                    <button type="button" data-value="date" class="${useDdMmYy ? 'active' : ''}">DD/MM/YYYY</button>
                                </div>
                                <input type="text" id="rt-onboarding-start-date" class="text_pole" value="${startDateInputVal}" placeholder="01/01/2026" style="width: 80px; text-align: center; height: 22px; font-size: 11px; border-radius: 4px; background: var(--black70a); display: ${useDdMmYy ? 'inline-block' : 'none'};" />
                                <div class="rt-seg-toggle" id="rt-onboarding-clock-seg" role="group" title="Choose the clock format used for [TIME] tracking.">
                                    <button type="button" data-value="12" class="${!use24h ? 'active' : ''}">12h</button>
                                    <button type="button" data-value="24" class="${use24h ? 'active' : ''}">24h</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <textarea id="rt-onboarding-custom-instructions" class="text_pole" placeholder="Custom setting/character instructions (e.g. Victorian London, space marine, gritty realism, cyberpunk decker...)" style="width: 100%; min-height: 40px; max-height: 120px; font-size: 11px; padding: 4px 6px; border-radius: 4px; background: var(--black70a); resize: vertical; margin-top: 2px;">${escapeHtml(obSettings.onboardingCustomInstructions || '')}</textarea>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; padding:4px 0 2px; flex-wrap:wrap;">
                        <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:0.88em;">
                            <input type="checkbox" id="rt-onboarding-persona-cb"${obSettings.onboardingCreatePersona ? ' checked' : ''} />
                            <span>Create Persona (Recommended)</span>
                        </label>
                        <span class="rt-cr-help-icon" title="When checked, after generating a character the AI also writes an appearance, personality, habits, and backstory. A preview will appear — you can accept (which auto-creates a new SillyTavern persona locked to this chat) or regenerate just this part without re-rolling the whole character. Does not apply when using an existing Persona.">?</span>
                        <span style="opacity:0.6; font-size:0.8em; margin-left:4px;">Word count:</span>
                        <select id="rt-onboarding-persona-words" class="text_pole" style="width:65px; font-size:11px; height:22px; padding:2px 4px;">
                            ${[100, 150, 200, 300, 400, 500, 750, 1000].map(n => {
                                const sel = String(obSettings.onboardingPersonaWords || '150') === String(n) ? ' selected' : '';
                                return `<option value="${n}"${sel}>${n}</option>`;
                            }).join('')}
                            <option value="other"${obSettings.onboardingPersonaWords === 'other' ? ' selected' : ''}>Other...</option>
                        </select>
                        <input id="rt-onboarding-persona-words-custom" type="number" class="text_pole" value="${escapeHtml(String(obSettings.onboardingPersonaWordsCustom || ''))}" style="display:${obSettings.onboardingPersonaWords === 'other' ? 'inline-block' : 'none'}; width:65px; font-size:11px; height:22px; padding:2px 4px; margin-left:4px;" placeholder="e.g. 800" min="50" max="5000" />
                    </div>
                </div>

                <!-- Archetype Buttons -->
                <div class="rt-onboarding-buttons rt-fantasy-buttons" style="width: 100%; display: ${onboardingGenre === 'fantasy' ? 'flex' : 'none'}; justify-content: center; gap: 4px; margin: 4px 0; flex-shrink: 0; flex-wrap: wrap;">
                    <button class="rt-random-char-btn" data-archetype="persona">🎭 Persona</button>
                    <button class="rt-random-char-btn" data-archetype="custom">⚙️ Custom</button>
                    <button class="rt-random-char-btn rt-pc-import-trigger" data-archetype="pc_import">📥 Import Card</button>
                </div>
                <div class="rt-onboarding-buttons rt-realistic-buttons" style="width: 100%; display: ${onboardingGenre === 'realistic' ? 'flex' : 'none'}; justify-content: center; gap: 4px; margin: 4px 0; flex-shrink: 0; flex-wrap: wrap;">
                    <button class="rt-random-char-btn" data-archetype="persona">🎭 Persona</button>
                    <button class="rt-random-char-btn" data-archetype="custom">⚙️ Custom</button>
                    <button class="rt-random-char-btn rt-pc-import-trigger" data-archetype="pc_import">📥 Import Card</button>
                </div>
                <div class="rt-onboarding-buttons rt-scifi-buttons" style="width: 100%; display: ${onboardingGenre === 'scifi' ? 'flex' : 'none'}; justify-content: center; gap: 4px; margin: 4px 0; flex-shrink: 0; flex-wrap: wrap;">
                    <button class="rt-random-char-btn" data-archetype="persona">🎭 Persona</button>
                    <button class="rt-random-char-btn" data-archetype="custom">⚙️ Custom</button>
                    <button class="rt-random-char-btn rt-pc-import-trigger" data-archetype="pc_import">📥 Import Card</button>
                </div>
                <div class="rt-onboarding-buttons rt-horror-buttons" style="width: 100%; display: ${onboardingGenre === 'horror' ? 'flex' : 'none'}; justify-content: center; gap: 4px; margin: 4px 0; flex-shrink: 0; flex-wrap: wrap;">
                    <button class="rt-random-char-btn" data-archetype="persona">🎭 Persona</button>
                    <button class="rt-random-char-btn" data-archetype="custom">⚙️ Custom</button>
                    <button class="rt-random-char-btn rt-pc-import-trigger" data-archetype="pc_import">📥 Import Card</button>
                </div>
                </div>
                </div>
                </div>

                <!-- PC Import Inline Panel (hidden until 📥 is clicked) -->
                <div id="rt-pc-import-panel" style="display:none; flex-direction:column; gap:7px; width:100%; flex-shrink:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        <button id="rt-pc-import-back" style="background:none; border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:inherit; font-size:0.8em; padding:2px 8px; cursor:pointer; opacity:0.75;">← Back</button>
                        <span style="flex:1; display:flex; align-items:center; gap:6px;">
                            <span style="font-weight:bold; color:var(--rt-accent); font-size:0.95em;">📥 Import Character Card as PC</span>
                            <button class="rt-edit-pc-sections-btn" style="background:none; border:none; color:var(--rt-accent); cursor:pointer; font-size:1.1em; opacity:0.8; padding:0; margin-top:-2px;" title="Edit PC Formatting Sections">⚙️</button>
                        </span>
                    </div>
                    <div style="font-size:10px; color:rgba(255,255,255,0.45); line-height:1.4;"><b>Add as is</b> = AI preserves original writing, fixes only era/world impossibilities · <b>Fit into Story</b> = full adaptation to campaign setting.</div>
                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        <label style="font-size:11px; color:rgba(255,255,255,0.6); white-space:nowrap;">Persona Bio Length</label>
                        <select id="rt-pc-import-wordselect" style="background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:2px 4px; font-size:11px; box-sizing:border-box;">
                            <option value="same">Same as Card</option>
                            <option value="150">Short (~150 words)</option>
                            <option value="300">Medium (~300 words)</option>
                            <option value="500">Long (~500 words)</option>
                            <option value="custom">Custom...</option>
                        </select>
                        <input id="rt-pc-import-wordcount" type="number" value="150" min="50" max="5000" step="25"
                            style="display:none; width:60px; background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:3px 6px; font-size:12px; box-sizing:border-box;">
                        <span style="font-size:10px; color:rgba(255,255,255,0.35);">(Fit into Story only)</span>
                    </div>
                    <input id="rt-pc-import-search" type="text" placeholder="Search characters..." style="width:100%; background:rgba(0,0,0,0.3); color:white; border:1px solid rgba(255,255,255,0.15); border-radius:5px; padding:5px 8px; font-size:12px; box-sizing:border-box;">
                    <div id="rt-pc-import-list" style="display:flex; flex-direction:column; gap:4px; max-height:200px; overflow-y:auto; padding-right:2px;"></div>
                </div>

                <!-- Character Roll Inline Panel (hidden until 🎲 is clicked) -->
                <div id="rt-char-roll-panel" style="display:none; flex-direction:column; gap:7px; width:100%; flex-shrink:0;">
                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        <button id="rt-char-roll-back" style="background:none; border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:inherit; font-size:0.8em; padding:2px 8px; cursor:pointer; opacity:0.75;">← Back</button>
                        <span style="flex:1; display:flex; align-items:center; gap:6px;">
                            <span style="font-weight:bold; color:var(--rt-accent); font-size:0.95em;">🎲 Character Creator</span>
                            <button class="rt-edit-pc-sections-btn" style="background:none; border:none; color:var(--rt-accent); cursor:pointer; font-size:1.1em; opacity:0.8; padding:0; margin-top:-2px;" title="Edit PC Formatting Sections">⚙️</button>
                        </span>
                        <button id="rt-cr-reset-btn" class="rt-cr-reset-btn" style="background:none; border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:inherit; font-size:0.8em; padding:2px 8px; cursor:pointer; opacity:0.75;" title="Clear all fields">🗑 Reset</button>
                    </div>
                    <!-- Presets Bar -->
                    <div id="rt-cr-presets-bar" style="display:flex; align-items:center; gap:5px; padding:4px 0 3px; border-bottom:1px solid rgba(255,255,255,0.08);">
                        <span style="font-size:0.78em; opacity:0.55; white-space:nowrap;">📋 Presets:</span>
                        <select id="rt-cr-preset-select" class="text_pole" style="flex:1; font-size:11px; height:22px; padding:2px 4px;">
                            <option value="">— Select preset —</option>
                        </select>
                        <button id="rt-cr-preset-load-btn" style="background:rgba(120,80,220,0.2); border:1px solid rgba(120,80,220,0.5); border-radius:4px; color:inherit; font-size:0.75em; padding:2px 8px; cursor:pointer; white-space:nowrap; flex-shrink:0;">Load</button>
                        <button id="rt-cr-preset-delete-btn" style="background:rgba(220,50,50,0.12); border:1px solid rgba(220,50,50,0.4); border-radius:4px; color:rgba(255,100,100,0.9); font-size:0.75em; padding:2px 8px; cursor:pointer; white-space:nowrap; flex-shrink:0;">Delete</button>
                        <button id="rt-cr-preset-save-btn" title="Save current fields as a new preset" style="background:none; border:1px solid rgba(120,80,220,0.5); border-radius:4px; color:var(--rt-accent); font-size:0.75em; padding:2px 8px; cursor:pointer; white-space:nowrap; flex-shrink:0;">＋ Save</button>
                    </div>
                    <div class="rt-cr-row">
                        <div class="rt-cr-field">
                            <label class="rt-cr-label" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                                <span>Name</span>
                                <button id="rt-cr-random-name" class="interactable" style="background:none; border:none; color:var(--rt-accent); cursor:pointer; padding:0; margin:0; font-size:1.1em; line-height:1;" title="Roll a random name">🎲</button>
                            </label>
                            <input id="rt-cr-name" class="text_pole rt-cr-input" type="text" placeholder="e.g. Lyra Ashford, Kael Vane…" />
                        </div>
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Gender</label>
                            <input id="rt-cr-gender" class="text_pole rt-cr-input" type="text" placeholder="e.g. Female, Male, Non-binary…" />
                        </div>
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Age</label>
                            <input id="rt-cr-age" class="text_pole rt-cr-input" type="text" placeholder="e.g. 21, young adult…" />
                        </div>
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Orientation</label>
                            <input id="rt-cr-orientation" class="text_pole rt-cr-input" type="text" placeholder="e.g. Straight, Bisexual, Gay…" />
                        </div>
                    </div>
                    <div class="rt-cr-row">
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Species</label>
                            <input id="rt-cr-species" class="text_pole rt-cr-input" type="text" placeholder="e.g. Human, Orc, Goblin…" />
                        </div>
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Ethnicity</label>
                            <input id="rt-cr-ethnicity" class="text_pole rt-cr-input" type="text" placeholder="e.g. Caucasian, Asian, Hispanic…" />
                        </div>
                    </div>
                    <div class="rt-cr-row">
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Genre <span class="rt-cr-help-icon" title="You must select a specific genre to see its related classes in the Class dropdown. Otherwise, only generic classes are shown.">?</span></label>
                            <select id="rt-cr-genre" class="text_pole rt-cr-input">
                                <option value="">✨ None — AI decides from context</option>
                                <option value="fantasy">⚔️ Fantasy RPG</option>
                                <option value="realistic">🏙️ Modern</option>
                                <option value="scifi">🚀 Sci-Fi</option>
                                <option value="horror">👻 Horror</option>
                            </select>
                        </div>
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Level</label>
                            <select id="rt-cr-level" class="text_pole rt-cr-input">
                                ${[...Array(20).keys()].map(i => { const l = i + 1; return `<option value="${l}"${l === parseInt(obSettings.onboardingLevel || '1') ? ' selected' : ''}>Level ${l}</option>`; }).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="rt-cr-row">
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Gear Tier <span class="rt-cr-help-icon" title="How well-equipped the character should be — from mundane starter kit to heroic named gear. Auto scales with level.">?</span></label>
                            <select id="rt-cr-gear-tier" class="text_pole rt-cr-input">
                                ${gearTierOptions}
                            </select>
                        </div>
                    </div>
                    <div class="rt-cr-row rt-cr-time-row">
                        <div class="rt-cr-field" style="width:100%;">
                            <label class="rt-cr-label">Time &amp; Date <span class="rt-cr-help-icon" title="Calendar and clock format for [TIME] tracking in generated memos. Day 1 = narrative day count; DD/MM/YYYY = real calendar dates.">?</span></label>
                            <div class="rt-cr-time-controls">
                                <div class="rt-seg-toggle" id="rt-cr-date-seg" role="group" title="Choose the calendar format used for [TIME] tracking.">
                                    <button type="button" data-value="day" class="${!useDdMmYy ? 'active' : ''}">Day 1</button>
                                    <button type="button" data-value="date" class="${useDdMmYy ? 'active' : ''}">DD/MM/YYYY</button>
                                </div>
                                <input type="text" id="rt-cr-start-date" class="text_pole rt-cr-input" value="${startDateInputVal}" placeholder="01/01/2026" style="width: 92px; text-align: center; display: ${useDdMmYy ? 'inline-block' : 'none'};" />
                                <div class="rt-seg-toggle" id="rt-cr-clock-seg" role="group" title="Choose the clock format used for [TIME] tracking.">
                                    <button type="button" data-value="12" class="${!use24h ? 'active' : ''}">12h</button>
                                    <button type="button" data-value="24" class="${use24h ? 'active' : ''}">24h</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="rt-cr-field" style="width:100%;">
                        <label class="rt-cr-label">Class</label>
                        <select id="rt-cr-class" class="text_pole rt-cr-input" style="width:100%;"></select>
                        <input id="rt-cr-class-other" class="text_pole rt-cr-input" type="text" placeholder="Describe your custom class…" style="display:none; margin-top:3px; width:100%;" />
                    </div>
                    <div class="rt-cr-row">
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Traits</label>
                            <textarea id="rt-cr-traits" class="text_pole rt-cr-input" placeholder="Leave blank — AI invents traits" rows="2" style="resize:vertical;"></textarea>
                        </div>
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Abilities</label>
                            <textarea id="rt-cr-abilities" class="text_pole rt-cr-input" placeholder="Leave blank — AI generates abilities" rows="2" style="resize:vertical;"></textarea>
                        </div>
                    </div>
                    <div class="rt-cr-row">
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Background <span class="rt-cr-help-icon" title="You don't need to write a full backstory. A brief hint guides the AI (e.g. 'grew up on the streets', 'ex-soldier', 'noble exile'). Leave blank and the AI will invent a fitting background.">?</span></label>
                            <input id="rt-cr-background" class="text_pole rt-cr-input" type="text" placeholder="e.g. ex-soldier, raised in the slums…" />
                        </div>
                        <div class="rt-cr-field">
                            <label class="rt-cr-label">Appearance <span class="rt-cr-help-icon" title="Just a hint is enough (e.g. 'tall, red hair, scar on cheek'). Leave blank and the AI will create a full appearance description.">?</span></label>
                            <input id="rt-cr-appearance" class="text_pole rt-cr-input" type="text" placeholder="e.g. tall, dark hair, green eyes…" />
                        </div>
                    </div>
                    <div class="rt-cr-field" style="width:100%;">
                        <label class="rt-cr-label">Additional Info</label>
                        <textarea id="rt-cr-additional" class="text_pole rt-cr-input" placeholder="Extra constraints, setting notes…" rows="2" style="resize:vertical; width:100%;"></textarea>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; padding:4px 0;">
                        <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:0.88em;">
                            <input type="checkbox" id="rt-cr-persona-cb" />
                            <span>Create Persona (Recommended)</span>
                        </label>
                        <span class="rt-cr-help-icon" title="When checked, the AI also generates an appearance, personality, habits, and backstory. A preview will appear — you can accept (which auto-creates a new SillyTavern persona locked to this chat) or regenerate just this part without re-rolling the whole character.">?</span>
                        <span style="opacity:0.6; font-size:0.8em; margin-left:4px;">Word count:</span>
                        <select id="rt-cr-persona-words" class="text_pole" style="width:65px; font-size:11px; height:22px; padding:2px 4px;">
                            <option value="100">100</option>
                            <option value="150" selected>150</option>
                            <option value="200">200</option>
                            <option value="300">300</option>
                            <option value="400">400</option>
                            <option value="500">500</option>
                            <option value="750">750</option>
                            <option value="1000">1000</option>
                            <option value="other">Other...</option>
                        </select>
                        <input id="rt-cr-persona-words-custom" type="number" class="text_pole" style="display:none; width:65px; font-size:11px; height:22px; padding:2px 4px; margin-left:4px;" placeholder="e.g. 800" min="50" max="5000" />
                    </div>
                    <button id="rt-cr-generate-btn" style="width:100%; padding:8px 12px; background:rgba(120,80,220,0.2); border:1px solid rgba(120,80,220,0.6); border-radius:5px; color:var(--rt-text,#eee); font-size:0.92em; font-weight:bold; cursor:pointer; letter-spacing:0.03em;">🎲 Generate Character</button>
                </div>

                <div class="rt-onboarding-divider"><span>How It Works</span></div>

                <div style="font-size: 13px; opacity: 0.9; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; line-height: 1.4;">
                    <div><b style="color: var(--rt-accent);">Auto-Tracking:</b> As you roleplay, the extension intelligently parses assistant responses using natural language. It detects losses of HP, new loot, or combat triggers, running background passes to update the state.</div>

                    <div><b style="color: var(--rt-accent);">Prompt Injection:</b> The State Memo and RNG Queue are injected seamlessly into your outgoing prompt. It acts as the "source of truth," assuring the narrator/GM model accurately sees HP, inventory, and mechanical outcomes. Buffs/debuffs tick down automatically based on in-story real-time passed. It JUST WORKS™!</div>

                    <div><b style="color: var(--rt-accent);">Lorebook Agent 🤖:</b> Open it from the <b>Lorebook Agent</b> tab at the top of the State Tracker panel and preferably detach it from the State Tracker UI. It autonomously manages your lorebook — creating, updating, activating, deactivating, and deleting entries as your story evolves. Click <b>?</b> inside the agent panel for full documentation.</div>

                    <div><b style="color: var(--rt-accent);">World Progression 🌍:</b> Simulates off-screen world activity by generating reports of background events at regular in-world intervals (such as daily). You can seed the simulation with an optional World Skeleton to introduce undiscovered factions, locations, NPCs, and conflicts outside the narrative. It includes Focus Randomization to keep events varied, and Backlog Consolidation to periodically compress older reports and prevent token bloat. Configure these options inside the World Progression section of the Extension Settings menu (accessible via SillyTavern's Extensions panel).</div>
                </div>

                <div class="rt-onboarding-divider"><span>Setup Guide</span></div>

                <div style="font-size: 13px; opacity: 0.9; flex-shrink: 0; line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                    <b style="color: var(--rt-accent); font-size: 14px;">Initial Setup:</b><br><br>
                    1. Set your starting level, genre, and time/date format (Day vs. calendar date, 12h vs. 24h) in the controls above, then use the archetype buttons to roll a new character, or <b>manually describe a character</b> by clicking 💬.<br><br>
                    2. Create a character card for your "narrator" (e.g. Game Master). <b>Leave the card fields empty</b>, as the framework handles all logic via the system prompt.<br><br>
                    3. Toggle the options below — the system prompt is <b>applied automatically</b> whenever you change a setting.<br><br>
                    4. Make sure your Persona in SillyTavern matches the character name in the State Tracker after character creation. You can also describe your character in Persona as normal in SillyTavern.<br><br>
                    5. In SillyTavern, use the <b>Chat Completion API</b> and enable <b>Enable function calling</b> under <b>AI Response Configuration</b>. Otherwise the <b>RollTheDice</b> tool will not work. Alternatively, choose an RNG mode without tool calls in <b>Narrator Configuration</b> below (e.g. <b>Pre-Seeded Only</b> or <b>No RNG</b>).<br><br>
                    <div style="margin-top: 8px;">
                        🪙 <b>Token Optimization:</b> To reduce token costs, especially when in tool use mode, consider using a summarizer such as the <b>Summaryception</b> extension. Summarization combined with <b>Lorebook Agent</b> will guarantee the AI stays on track and keep token costs low.
                    </div>
                    <div style="margin-top: 12px;">
                        🤖 <b>What Model to Use?</b><br><br>
                        <b>MiMo 2.5 Pro</b> or <b>DeepSeek 4 Pro</b>: both are great bang for the buck with high GM output quality. I use MiMo myself through OpenRouter — DeepSeek 4 Pro is another strong pick in the same tier. Try both and see which voice you prefer.<br><br>
                        For the State Tracker and Lorebook Agent, I use <b>Gemini 3.1 Flash-Lite</b>. It's very inexpensive and handles the job amazingly well. Gemini 3 Flash or 3.5 Flash are of course even better, but I don't think they're needed. Flash-Lite does the job.<br><br>
                        If your model thinks too long in combat, enable <b>Combat API Override</b> in State Tracker settings — it auto-switches when the <code>[COMBAT]</code> tag is active in the tracker and switches back when combat ends. <b>Gemini 3.5 Flash</b> is a great choice for this; set thinking to <b>Medium</b> so it still thinks a little.<br><br>
                        These are recommendations, not rules — experiment. Different models shine for different styles of play.
                    </div>
                </div>

                <!-- Narrator Configuration (Salad Bar) -->
                <div style="margin-top: 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 10px; background: rgba(255,255,255,0.03); width: 100%; box-sizing: border-box;">
                    <b style="color: var(--rt-accent); font-size: 14px; display: block; margin-bottom: 6px;">Narrator Configuration</b>
                    <small style="display: block; margin-bottom: 8px; opacity: 0.65; font-style: italic; line-height: 1.3;">Select your preferred modes and components. Changes apply to your system prompt automatically.</small>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
                        <span style="font-size: 0.85em; font-weight: bold; opacity: 0.8;">RNG</span>
                        <button class="rt-rng-help-icon" style="background: none; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: inherit; font-size: 0.72em; opacity: 0.7; padding: 1px 7px; cursor: pointer;" title="Open RNG systems explanation">What are these?</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; padding-left: 5px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="rt_onboarding_rng_mode" value="hybrid" id="rt_onboarding_rng_hybrid" />
                            <span>Pre-Seeded + Tool Calls</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="rt_onboarding_rng_mode" value="legacy" id="rt_onboarding_rng_legacy" />
                            <span>Pre-Seeded Only</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="radio" name="rt_onboarding_rng_mode" value="none" id="rt_onboarding_rng_none" />
                            <span>No RNG (LLM makes up numbers)</span>
                        </label>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">
                        <span style="font-size: 0.85em; font-weight: bold; opacity: 0.8;">Quests</span>
                        <button class="rt-quests-hardcore-help" style="background: none; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: inherit; font-size: 0.72em; opacity: 0.7; padding: 1px 7px; cursor: pointer;" title="Explain hardcore quest mechanics">What are these?</button>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; padding-left: 5px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="rt_onboarding_quests_enabled" />
                            <span>Enable Quests</span>
                        </label>
                        <div id="rt_onboarding_quest_options" style="padding-left: 20px; display: none; flex-direction: column; gap: 4px;">
                            <div style="margin-top: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">
                                <span style="font-size: 0.75em; opacity: 0.6; text-transform: uppercase; font-weight: bold;">Hardcore / Optional</span>
                            </div>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="rt_onboarding_quests_deadlines" />
                                <span>Deadlines</span>
                            </label>
                            <div id="rt_onboarding_quests_frustration_wrap" style="padding-left: 20px; display: none;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="rt_onboarding_quests_frustration" />
                                    <span style="opacity: 0.9;">↳ Frustration (Experimental)</span>
                                </label>
                            </div>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="rt_onboarding_quests_show_archive" checked />
                                <span>Show completed/failed quests</span>
                            </label>
                        </div>
                    </div>

                    <div style="font-size: 0.85em; font-weight: bold; opacity: 0.8; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">Optional Components</div>
                    <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; padding-left: 5px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="rt_onboarding_mod_loot" />
                            <span>🎲 Loot (Roll for Loot Quality)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="rt_onboarding_mod_random_events" />
                            <span>🌍 Random Events (Rolls on time skips and travel)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="rt_onboarding_mod_resting" />
                            <span>💤 Time-Limited Resting and interruption rolls based on location danger</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="rt_onboarding_mod_party_bench" />
                            <span>🏕️ Benched Party (Tracks temporarily separated companions)</span>
                        </label>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="checkbox" id="rt_onboarding_mod_cyoa_mode" />
                            <span>🧭 CYOA Mode (Numbered action choices at end of outputs)</span>
                            <button id="rt_onboarding_cyoa_settings_btn" style="background:none;border:1px solid rgba(255,255,255,0.25);border-radius:4px;color:inherit;font-size:0.75em;padding:1px 6px;cursor:pointer;flex-shrink:0;opacity:0.8;" title="CYOA Settings"><i class="fa-solid fa-gear"></i></button>
                        </div>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="rt_onboarding_mod_npc_rel_bars" />
                            <span>💞 Relationship System (BETA)</span>
                        </label>
                    </div>

                    <button id="rt_onboarding_btn_update_sysprompt" style="width: 100%; margin-top: 10px; padding: 7px 12px; background: rgba(0, 200, 140, 0.18); border: 1px solid #00c88c; border-radius: 4px; color: var(--rt-text, #eee); font-size: 0.88em; cursor: pointer;" title="Writes the system prompt to your Quick Prompt Main box based on the options selected above.">
                        ↑ Apply System Prompt
                    </button>
                </div>
            </div>`;
        }

        const blocks = ensurePartyShellForBenchedRoster(parseMemoBlocks(memo));
        if (Object.keys(blocks).length === 0) {
            return `<div class="rt-empty">No structured blocks found.<br><small>Switch to Raw view to inspect the memo.</small></div>`;
        }

        const s = getSettings();
        const order = stripBenchedPartyTag(s.blockOrder || BLOCK_ORDER);
        const sorted = [
            ...order.filter(k => blocks[k] !== undefined),
            ...stripBenchedPartyTag(Object.keys(blocks).filter(k => !order.includes(k))).sort()
        ];

        const collapsed = loadCollapsed();
        const detached = loadDetached();

        // If filtering by a single tag (detached window context)
        const tagsToRender = filterTag ? [filterTag] : sorted;

        return tagsToRender.map(tag => renderSectionCard(tag, blocks, collapsed, detached, sectionPages, filterTag)).join('');
    }

    /**
     * Renders a single tag's section card (header + body). Extracted from renderMemoAsCards
     * so it can be reused both by the classic stacked view and by the compact Tab Mode view
     * (which pins CHARACTER/COMBAT in full and renders exactly one tab's card at a time).
     * @param {string} tag
     * @param {object} blocks  parsed memo blocks (tag -> raw content)
     * @param {Set<string>} collapsed
     * @param {Set<string>} detached
     * @param {object} sectionPages  mutable pagination state, keyed by tag
     * @param {string|null} filterTag  when set, hides the detach button and skips the detached-placeholder check
     * @returns {string}
     */
    function renderSectionCard(tag, blocks, collapsed, detached, sectionPages, filterTag) {
        if (tag === 'QUESTS') return ''; // Quest log has dedicated high-fidelity renderer, skip standard card
        const content = blocks[tag];
        if (content === undefined && filterTag) {
            return `<div class="rt-empty">Waiting for ${tag} data...</div>`;
        }
        if (content === undefined) return '';

        // If main panel context, filter out detached windows
        if (!filterTag && detached.has(tag)) {
            return `<div class="rt-detached-placeholder" data-tag="${tag}">
                <span class="rt-placeholder-icon">⧉</span> ${tag} is detached
                <button class="rt-reattach-btn-inline" data-tag="${tag}" title="Re-attach">↓</button>
            </div>`;
        }

        const customField = (getSettings().customFields || []).find(f => f.tag.toUpperCase() === tag);
        const icon = customField?.icon || BLOCK_ICONS[tag] || '📄';
        const displayName = customField?.label || tag;
        const items = blockToItems(tag, content);
        const isCollapsed = collapsed.has(tag);

        let totalValueBadge = '';
        if (tag === 'INVENTORY' && items.totalValueGP && getSettings().showTotalInventoryValue !== false) {
            const isModern = ['usd', 'eur', 'gbp'].includes(items.detectedCurrency);
            const badgeColor = isModern ? '#85bb65' : '#ffd700';
            const badgeBg = isModern ? 'rgba(133, 187, 101, 0.08)' : 'rgba(255, 215, 0, 0.08)';
            const badgeBorder = isModern ? 'rgba(133, 187, 101, 0.3)' : 'rgba(255, 215, 0, 0.3)';
            const badgeIcon = isModern ? '💵' : '💰';
            totalValueBadge = `<span class="rt-total-value-badge" style="color: ${badgeColor}; font-weight: bold; background: ${badgeBg}; padding: 2px 8px; border-radius: 12px; border: 1px solid ${badgeBorder}; font-size: 0.85em; white-space: nowrap; text-transform: none; letter-spacing: 0;">${badgeIcon} ${items.totalValueGP}</span>`;
        }

        const renderType = customField?.renderType || tag;
        const isFullView = getSettings().fullViewSections.includes(tag) || NO_PAGINATE.has(renderType);
        const localPageSize = getPageSize(tag);

        const page = isFullView ? 0 : (sectionPages[tag] ?? 0);
        const totalPages = isFullView ? 1 : Math.ceil(items.length / localPageSize);
        const safePage = Math.min(page, Math.max(0, totalPages - 1));
        if (!isFullView) sectionPages[tag] = safePage;

        const pageItems = isFullView ? items : items.slice(safePage * localPageSize, (safePage + 1) * localPageSize);
        const bodyClass = `rt-section-body${renderType === 'ABILITIES' ? ' rt-abilities-body' : ''}`;

        const pagination = totalPages > 1 ? `
            <div class="rt-pagination">
                <button class="rt-page-btn" data-tag="${tag}" data-dir="-1"${safePage === 0 ? ' disabled' : ''}>&#8249;</button>
                <span>${safePage + 1}&thinsp;/&thinsp;${totalPages}</span>
                <button class="rt-page-btn" data-tag="${tag}" data-dir="1"${safePage >= totalPages - 1 ? ' disabled' : ''}>&#8250;</button>
            </div>` : '';

        // Don't show detach button if already in detached context (filterTag provided)
        const detachBtn = !filterTag ? `
            <button class="rt-detach-btn" data-tag="${tag}" title="Detach panel">
                ⧉
            </button>
        ` : '';

        const personaFromCharBtn = tag === 'CHARACTER' ? `
            <button class="rt-char-to-persona-btn" data-tag="CHARACTER" title="Create Lorebook Agent Persona from this CHARACTER (uses sheet + last 3 story messages)">
                👤
            </button>
        ` : '';

        const fullViewBtn = NO_PAGINATE.has(renderType) ? '' : `
            <button class="rt-fullview-btn${isFullView ? ' active' : ''}" data-tag="${tag}" title="${isFullView ? 'Switch to Paged View' : 'Switch to Full List'}">
                ${isFullView ? '📜' : '📑'}
            </button>
        `;

        const renderOptions = getSettings().categoryRenderOptions?.[tag] || {};
        const catStyles = [];
        if (renderOptions.fontSize) catStyles.push(`--rt-cat-font-size: ${(renderOptions.fontSize / 13).toFixed(4)}em`);
        if (renderOptions.italic) catStyles.push(`--rt-cat-font-style: italic`);
        if (renderOptions.bold) catStyles.push(`--rt-cat-font-weight: bold`);
        if (renderOptions.bullets === false) catStyles.push(`--rt-cat-bullet-display: none`);
        if (renderOptions.bulletColor) catStyles.push(`--rt-cat-bullet-color: ${renderOptions.bulletColor}`);
        if (renderOptions.bulletStyle) catStyles.push(`--rt-cat-bullet-style: "${renderOptions.bulletStyle}"`);
        if (renderOptions.fontFamily) catStyles.push(`--rt-cat-font-family: ${renderOptions.fontFamily}`);
        if (renderOptions.textColor && renderOptions.textColor !== 'inherit') catStyles.push(`--rt-cat-text-color: ${renderOptions.textColor}`);
        const catStyleAttr = catStyles.length ? ` style='${catStyles.join('; ')}'` : '';

        // [BENCHED PARTY] is never its own section — it's folded into PARTY's card as a
        // compact camp-roster sub-panel (see stripBenchedPartyTag / renderBenchedPartyPanel).
        let benchedPanelHtml = '';
        if (tag === 'PARTY' && getSettings().modules?.['benched party'] !== false && blocks['BENCHED PARTY'] !== undefined) {
            benchedPanelHtml = renderBenchedPartyPanel(blocks['BENCHED PARTY'], collapsed.has('BENCHED PARTY'), loadBenchedExpanded());
        }

        return `<div class="rt-section-card${isCollapsed ? ' rt-collapsed' : ''}" data-tag="${tag}">
            <div class="rt-section-header" data-tag="${tag}">
                <span>${icon} ${displayName}</span>
                <div class="rt-section-header-right">
                    ${totalValueBadge}
                    ${personaFromCharBtn}
                    ${detachBtn}
                    ${fullViewBtn}
                    <button class="rt-category-settings-btn" data-tag="${tag}" title="Category Rendering Options">
                        <i class="fa-solid fa-cog"></i>
                    </button>
                    <span class="rt-item-count">${items.length} ${items.length === 1 ? 'entry' : 'entries'}</span>
                    <span class="rt-collapse-icon">${isCollapsed ? '&#9656;' : '&#9662;'}</span>
                </div>
            </div>
            <div class="${bodyClass}"${catStyleAttr}>${pageItems.join('')}${pagination}${benchedPanelHtml}</div>
        </div>`;
    }

// ── Tab Mode (compact layout for small screens) ─────────────────────────────
//
// CHARACTER and COMBAT (while active) are pinned above the tab strip in full,
// unmodified detail — reusing renderSectionCard directly. Every other block
// (Inventory, Abilities, Spells, XP, Time, Quests, Party, custom modules)
// becomes a tab; only the active tab's card is rendered into the content pane.
// The tab strip wraps to additional rows when space runs out.

const TABMODE_PINNED_TAGS = ['CHARACTER', 'COMBAT'];

/**
 * Lightweight line scan for "Name: cur/max HP ..." entries in a PARTY block,
 * used only to feed the compact vitals strip. Deliberately simpler than the
 * full blockToItems() entity parser — it only needs name + HP, not the whole
 * rendered card.
 * @param {string} content  raw PARTY block content
 * @returns {{name: string, cur: number, max: number, pct: number}[]}
 */
function extractPartyVitals(content) {
    if (!content) return [];
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];
    for (const rawLine of lines) {
        const line = rawLine.replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        const hpMatch = line.match(/^(.+?):\s*([\d,]+)(?:\/([\d,]+))?\s*HP\s*[:|,]?\s*/i);
        if (!hpMatch) continue;
        const [, nameRaw, curRaw, maxRaw] = hpMatch;
        const name = nameRaw.trim();
        if (!name) continue;
        const cur = Number(curRaw.replace(/,/g, ''));
        const max = maxRaw ? Number(maxRaw.replace(/,/g, '')) : cur;
        const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 100;
        results.push({ name, cur, max, pct });
    }
    return results;
}

/**
 * Renders the compact party-vitals strip (portrait + slim HP ring per member).
 * Returns '' when there's no PARTY block or no parseable HP entries.
 * @param {object} blocks  parsed memo blocks
 * @returns {string}
 */
function renderPartyVitalsStrip(blocks) {
    const content = blocks['PARTY'];
    if (!content) return '';
    const members = extractPartyVitals(content);
    if (!members.length) return '';

    const items = members.map(m => {
        const barId = `PARTY:${m.name}:HP`;
        const showAsPct = getBarShowAsPercentage(barId);
        const dispCur = showAsPct ? Math.round(m.pct) : m.cur;
        const dispMax = showAsPct ? 100 : m.max;
        const ringColor = getBarBackground(barId, DEFAULT_HP_COLOR, m.pct);
        return `<button class="rt-vitals-member" data-jump-tag="PARTY" title="${escapeHtml(m.name)}: ${dispCur}/${dispMax} HP">
            <span class="rt-vitals-portrait-wrap" style="--rt-vitals-ring: ${ringColor}; --rt-vitals-pct: ${m.pct}%;">
                ${renderPortraitHtml(m.name)}
            </span>
            <span class="rt-vitals-name">${escapeHtml(m.name.split(' ')[0])}</span>
        </button>`;
    }).join('');

    return `<div class="rt-vitals-strip" id="rt-party-vitals-strip">${items}</div>`;
}

const BENCHED_EXPANDED_KEY = 'rpg_tracker_benched_expanded';

/** Returns the set of benched member names currently expanded to their full stat card. */
export function loadBenchedExpanded() {
    try { return new Set(JSON.parse(localStorage.getItem(BENCHED_EXPANDED_KEY) || '[]')); }
    catch { return new Set(); }
}
export function saveBenchedExpanded(set) {
    localStorage.setItem(BENCHED_EXPANDED_KEY, JSON.stringify([...set]));
}

/**
 * Lightweight per-member scan for [BENCHED PARTY] content — extracts just the name and
 * Status line (the benching reason/timestamp), for the compact camp-roster chips. Mirrors
 * extractPartyVitals's "simple scan, not the full entity-card parser" approach; the full
 * stat card is only built on demand (via blockToItems) when a chip is expanded.
 * @param {string} content  raw BENCHED PARTY block content
 * @returns {{name: string, status: string}[]}
 */
function extractBenchedRoster(content) {
    if (!content) return [];
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];
    let current = null;
    for (const rawLine of lines) {
        const line = rawLine.replace(/^\s*[-*+•–—](?:\s+|(?=[A-Za-z]))/, '');
        const hpMatch = line.match(/^(.+?):\s*[\d,]+(?:\/[\d,]+)?\s*HP/i);
        if (hpMatch) {
            if (current) results.push(current);
            current = { name: hpMatch[1].trim(), status: '' };
            continue;
        }
        if (!current) {
            const nameOnly = line.replace(/:\s*$/, '').trim();
            if (nameOnly) current = { name: nameOnly, status: '' };
            continue;
        }
        if (/^status:/i.test(line)) {
            current.status = line.replace(/^status:\s*/i, '').trim();
        }
    }
    if (current) results.push(current);
    return results;
}

/**
 * Renders the "camp" sub-panel folded into PARTY's card for benched members — a compact,
 * portrait-based roster of chips (name + reason on hover) that expand inline into the full
 * stat card on click. Deliberately never its own section/tab (see stripBenchedPartyTag).
 * @param {string} benchedContent  raw BENCHED PARTY block content
 * @param {boolean} isPanelCollapsed
 * @param {Set<string>} expandedNames  names currently expanded to their full stat card
 * @returns {string}
 */
function renderBenchedPartyPanel(benchedContent, isPanelCollapsed, expandedNames) {
    const roster = extractBenchedRoster(benchedContent);
    if (!roster.length) return '';

    const fullCardByName = {};
    if (expandedNames.size > 0) {
        blockToItems('BENCHED PARTY', benchedContent).forEach(html => {
            const m = html.match(/class="rt-entity-name"[^>]*>([^<]+)</);
            if (m) fullCardByName[decodeHtml(m[1].trim())] = html;
        });
    }

    const chips = roster.map(({ name, status }) => {
        const isOpen = expandedNames.has(name);
        const tooltip = status ? `${name}: ${status}` : name;
        const chipHtml = `<button class="rt-benched-chip${isOpen ? ' active' : ''}" data-benched-toggle="${escapeHtml(name)}" title="${escapeHtml(tooltip)}">
            <span class="rt-benched-chip-portrait">${renderPortraitHtml(name)}</span>
            <span class="rt-benched-chip-name">${escapeHtml(name.split(' ')[0])}</span>
        </button>`;
        const expandedHtml = isOpen
            ? `<div class="rt-benched-expanded-card">${fullCardByName[name] || ''}</div>`
            : '';
        return chipHtml + expandedHtml;
    }).join('');

    return `<div class="rt-benched-panel${isPanelCollapsed ? ' rt-collapsed' : ''}">
        <div class="rt-section-header rt-benched-panel-header" data-tag="BENCHED PARTY">
            <span>🏕️ Benched <span class="rt-benched-count">${roster.length}</span></span>
            <span class="rt-collapse-icon">${isPanelCollapsed ? '&#9656;' : '&#9662;'}</span>
        </div>
        <div class="rt-benched-chips">${chips}</div>
    </div>`;
}

/**
 * Renders the full Tab Mode view: pinned CHARACTER/COMBAT cards, the party
 * vitals strip, a wrapping tab strip, and a single content pane for the active tab.
 * @param {string} memo
 * @param {object} sectionPages  mutable pagination state, keyed by tag
 * @param {{quests: object[], currentTime: string}|null} questsCtx  quest data, or null if the Quests module is off
 * @returns {string}
 */
export function renderTabModeView(memo, sectionPages, questsCtx = null) {
    if (!memo || !memo.trim()) return renderMemoAsCards(memo, null, sectionPages);

    const blocks = ensurePartyShellForBenchedRoster(parseMemoBlocks(memo));
    if (Object.keys(blocks).length === 0) {
        return `<div class="rt-empty">No structured blocks found.<br><small>Switch to Raw view to inspect the memo.</small></div>`;
    }

    const s = getSettings();
    const order = stripBenchedPartyTag(s.blockOrder || BLOCK_ORDER);
    const sorted = [
        ...order.filter(k => blocks[k] !== undefined),
        ...stripBenchedPartyTag(Object.keys(blocks).filter(k => !order.includes(k))).sort()
    ];

    const collapsed = loadCollapsed();
    const detached = loadDetached();

    const pinnedTags = sorted.filter(t => TABMODE_PINNED_TAGS.includes(t));
    const pinnedHtml = pinnedTags.map(tag => renderSectionCard(tag, blocks, collapsed, detached, sectionPages, null)).join('');
    const vitalsHtml = renderPartyVitalsStrip(blocks);

    let tabTags = sorted.filter(t => !TABMODE_PINNED_TAGS.includes(t));
    if (questsCtx && questsCtx.quests) {
        if (!tabTags.includes('QUESTS')) {
            tabTags.push('QUESTS');
        }
    } else {
        tabTags = tabTags.filter(t => t !== 'QUESTS');
    }

    if (tabTags.length === 0) {
        return `<div class="rt-tabmode-wrap">
            <div class="rt-tabmode-pinned">${pinnedHtml}</div>
            ${vitalsHtml}
            <div class="rt-empty">No additional modules to display.</div>
        </div>`;
    }

    let activeTag = loadActiveTab();
    if (!tabTags.includes(activeTag)) activeTag = tabTags[0];

    const tabMeta = (tag) => {
        if (tag === 'QUESTS') return { icon: BLOCK_ICONS.QUESTS || '📋', label: 'Quests' };
        const customField = (s.customFields || []).find(f => f.tag.toUpperCase() === tag);
        return { icon: customField?.icon || BLOCK_ICONS[tag] || '📄', label: customField?.label || tag };
    };

    const tabBadge = (tag) => {
        if (tag === 'QUESTS') {
            const count = questsCtx?.quests?.length || 0;
            return count > 0 ? `<span class="rt-tab-badge">${count}</span>` : '';
        }
        if (blocks[tag] === undefined) return '';
        const items = blockToItems(tag, blocks[tag]);
        const count = Array.isArray(items) ? items.length : 0;
        let badges = count > 0 ? `<span class="rt-tab-badge">${count}</span>` : '';
        // PARTY's tab carries a secondary badge for its folded-in benched sub-panel count.
        if (tag === 'PARTY' && blocks['BENCHED PARTY'] !== undefined) {
            const benchedCount = extractBenchedRoster(blocks['BENCHED PARTY']).length;
            if (benchedCount > 0) badges += `<span class="rt-tab-badge rt-tab-badge-secondary" title="Benched">🏕️${benchedCount}</span>`;
        }
        return badges;
    };

    const tabBtnHtml = (tag) => {
        const { icon, label } = tabMeta(tag);
        const isActive = tag === activeTag;
        return `<button class="rt-tab-btn${isActive ? ' active' : ''}" data-tag="${tag}" title="${escapeHtml(label)}">
            <span class="rt-tab-icon">${icon}</span>${tabBadge(tag)}
        </button>`;
    };

    const tabStripHtml = `<div class="rt-tab-strip">${tabTags.map(tabBtnHtml).join('')}</div>`;

    const contentHtml = activeTag === 'QUESTS'
        ? renderQuestLog(questsCtx?.quests || [], questsCtx?.currentTime || '', collapsed, detached, 'QUESTS')
        : renderSectionCard(activeTag, blocks, collapsed, detached, sectionPages, activeTag);

    return `<div class="rt-tabmode-wrap" data-tab-order="${tabTags.join(',')}">
        <div class="rt-tabmode-pinned">${pinnedHtml}</div>
        ${vitalsHtml}
        ${tabStripHtml}
        <div class="rt-tabmode-content" data-active-tag="${activeTag}">${contentHtml}</div>
    </div>`;
}

// ── Quest Log Renderer ─────────────────────────────────────────────────────

/**
 * Renders the quest log as a section card, matching the rt-section-card structure
 * so collapse/detach/reattach work identically to other blocks.
 * @param {object[]} quests
 * @param {string} currentTime  in-world time string e.g. "08:00 AM, Day 2"
 * @param {Set<string>} collapsed
 * @param {Set<string>} detached
 * @param {string|null} filterTag  if set, only render if tag === 'QUESTS'
 * @returns {string}
 */
export function renderQuestLog(quests, currentTime, collapsed, detached, filterTag = null) {
    const TAG = 'QUESTS';

    if (filterTag && filterTag !== TAG) return '';

    if (!filterTag && detached.has(TAG)) {
        return `<div class="rt-detached-placeholder" data-tag="${TAG}">
            <span class="rt-placeholder-icon">⧉</span> QUESTS is detached
            <button class="rt-reattach-btn-inline" data-tag="${TAG}" title="Re-attach">↓</button>
        </div>`;
    }

    const allQuests = quests || [];
    const isCollapsed = collapsed.has(TAG);
    const detachBtn = !filterTag ? `<button class="rt-detach-btn" data-tag="${TAG}" title="Detach panel">⧉</button>` : '';

    if (allQuests.length === 0) {
        return `<div class="rt-section-card${isCollapsed ? ' rt-collapsed' : ''}" data-tag="${TAG}">
            <div class="rt-section-header" data-tag="${TAG}">
                <span>📋 QUESTS</span>
                <div class="rt-section-header-right">
                    ${detachBtn}
                    <span class="rt-item-count">0 entries</span>
                    <span class="rt-collapse-icon">${isCollapsed ? '&#9656;' : '&#9662;'}</span>
                </div>
            </div>
            <div class="rt-section-body"><div class="rt-card-line" style="opacity:0.6;">No active quests.</div></div>
        </div>`;
    }

    const settings = getSettings();
    const showFrustration = !!settings.syspromptModules?.questsFrustration;
    const showDeadlines = !!settings.syspromptModules?.questsDeadlines;

    const renderQuestCard = (quest, opts = {}) => {
        const dismissible = !!opts.dismissible;

        const hasDeadline = questHasEffectiveDeadline(quest);
        const emergent = isEmergentQuest(quest);

        const { getQuestMood } = /** @type {any} */ (globalThis.__rpgQuestUtils || {});
        const moodData = hasDeadline && !emergent && typeof getQuestMood === 'function'
            ? getQuestMood(quest, currentTime, showFrustration)
            : { label: '', color: '#00cc77', value: null };

        const frust = moodData.value ?? 0;
        const label = moodData.label;
        const barColor = moodData.color;

        // frust: -1 = very pleased/just accepted, 0 = neutral/halfway, 1 = frustrated at deadline, >1 = overdue
        // Map to a centered display: 50% = neutral, 0% = very pleased, 100% = max frustrated
        // Clamp display to [-1, 2] range (values beyond 2 are "off the chart")
        const displayFrust = Math.max(-1, Math.min(2, frust));
        const scale        = 100 / 3; // -1→0%, 0→33%, 1→67%, 2→100%
        const fillPct      = Math.round((displayFrust + 1) * scale);

        const barTitle = showFrustration && moodData.label
            ? `NPC Mood: ${label} (${frust >= 0 ? '+' : ''}${frust.toFixed(2)})`
            : (hasDeadline && !emergent ? `Time Progress: ${label}` : '');

        // Tick mark at the neutral position (33%) and deadline position (67%)
        // Emergent quests: no NPC expects completion → no mood/frustration bar
        const moodBarHtml = hasDeadline && !emergent ? `
            <div class="rt-quest-mood-bar-wrap" title="${escapeHtml(barTitle)}">
                <div class="rt-quest-mood-bar" style="width:${fillPct}%; background:${barColor};"></div>
                <div class="rt-quest-mood-tick rt-quest-mood-tick-neutral"></div>
                <div class="rt-quest-mood-tick rt-quest-mood-tick-deadline"></div>
            </div>` : '';

        let statusBadgeClass = 'rt-quest-badge-active';
        let statusLabel = 'Active';
        if (quest.status === 'completed') { statusBadgeClass = 'rt-quest-badge-completed'; statusLabel = 'Completed'; }
        if (quest.status === 'past deadline') { statusBadgeClass = 'rt-quest-badge-failed'; statusLabel = 'Past Deadline'; }
        if (quest.status === 'failed')    { statusBadgeClass = 'rt-quest-badge-failed';    statusLabel = 'Failed'; }

        const questIsCompleted = quest.status === 'completed';

        const objectives = (quest.objectives || []).map(obj => {
            const done = obj.status === 'completed' || (questIsCompleted && obj.status !== 'failed');
            const failed = obj.status === 'failed';
            const optLabel = obj.required ? '' : ' <span class="rt-quest-optional">(Optional)</span>';
            let objClass = 'rt-quest-obj';
            if (done) objClass += ' rt-quest-obj-done';
            if (failed) objClass += ' rt-quest-obj-failed';

            // Progress counter (e.g. "4/6", or bare "3" when total is unknown)
            const hasTotal = typeof obj.total === 'number';
            const hasProgress = typeof obj.progress === 'number' && !done && !failed;
            const progressHtml = hasProgress
                ? ` <span class="rt-quest-progress">${obj.progress}${hasTotal ? '/' + obj.total : ''}</span>`
                : '';

            return `<div class="${objClass}">
                <span class="rt-quest-check">${done ? '✓' : (failed ? '✗' : '○')}</span>
                <span>${escapeHtml(obj.text)}${progressHtml}${optLabel}</span>
            </div>`;
        }).join('');

        const rewards = (quest.rewards || []).map(r =>
            `<span class="rt-quest-reward">${escapeHtml(r)}</span>`
        ).join('');

        const currentTotalMins = parseInWorldTime(currentTime);
        const deadlineMins = parseInWorldTime(quest.deadline_time);
        let timeLeftHtml = '';
        if (currentTotalMins != null && deadlineMins != null && currentTotalMins > 0 && deadlineMins > 0) {
            const diff = deadlineMins - currentTotalMins;
            timeLeftHtml = ` <i style="opacity: 0.7; font-size: 0.9em;">(${formatTimeDiff(diff, diff > 0)})</i>`;
        }

        const acceptedMins = parseInWorldTime(quest.accepted_time);
        let acceptedRow = '';
        if (currentTotalMins != null && acceptedMins != null && currentTotalMins > 0 && acceptedMins > 0) {
            const diff = currentTotalMins - acceptedMins;
            acceptedRow = `
                <div class="rt-quest-deadline">
                    <div class="rt-quest-deadline-header">
                        <span class="rt-entity-sub-label">Accepted:</span> ${escapeHtml(quest.accepted_time)} <i style="opacity: 0.7; font-size: 0.9em;">(${formatTimeDiff(diff, false)})</i>
                    </div>
                </div>`;
        }

        const deadlineRow = (hasDeadline && showDeadlines) ? `
            <div class="rt-quest-deadline" style="${acceptedRow ? 'border-top: none; margin-top: 0;' : ''}">
                <div class="rt-quest-deadline-header">
                    <span class="rt-entity-sub-label">Deadline:</span> ${escapeHtml(quest.deadline_time)}${timeLeftHtml}
                    ${showFrustration ? `<span class="rt-quest-mood-label" style="color:${barColor};">${label}</span>` : ''}
                </div>
                ${moodBarHtml}
            </div>` : '';

        const isFailed = quest.status === 'failed' || quest.status === 'past deadline';
        let cardClass = 'rt-quest-card';
        if (quest.status !== 'active') cardClass += ' rt-quest-inactive';
        if (isFailed) cardClass += ' rt-quest-card-failed';

        const dismissBtn = dismissible
            ? `<button type="button" class="rt-quest-dismiss-btn" data-quest-id="${escapeHtml(quest.id)}" title="Remove from log">✕</button>`
            : '';

        return `<div class="${cardClass}" data-quest-id="${escapeHtml(quest.id)}">
            <div class="rt-quest-header">
                <span class="rt-quest-title">${escapeHtml(quest.title)}</span>
                <div class="rt-quest-badges">
                    <span class="rt-quest-badge ${statusBadgeClass}">${statusLabel}</span>
                    ${dismissBtn}
                </div>
            </div>
            <div class="rt-quest-giver">${escapeHtml(quest.giver_name)} · <em>${escapeHtml(quest.giver_location)}</em></div>
            <div class="rt-quest-objectives">${objectives}</div>
            ${rewards ? `<div class="rt-quest-rewards">${rewards}</div>` : ''}
            ${acceptedRow}
            ${deadlineRow}
        </div>`;
    };

    const activeQuests = allQuests.filter(q => !isArchivedQuestStatus(q.status));
    const completedQuests = allQuests.filter(q => String(q.status || '').toLowerCase().trim() === 'completed');
    const failedQuests = allQuests.filter(q => {
        const st = String(q.status || '').toLowerCase().trim();
        return st === 'failed' || st === 'past deadline';
    });

    const activeCardsHtml = activeQuests.map(q => renderQuestCard(q)).join('');
    const completedCardsHtml = completedQuests.map(q => renderQuestCard(q, { dismissible: true })).join('');
    const failedCardsHtml = failedQuests.map(q => renderQuestCard(q, { dismissible: true })).join('');

    let bodyHtml = activeCardsHtml || '<div class="rt-card-line" style="opacity:0.6; padding: 10px;">No active quests.</div>';

    if (completedQuests.length > 0) {
        const isCompletedCollapsed = collapsed.has(TAG + '_COMPLETED');
        bodyHtml += `
        <div class="rt-section-card rt-sub-section${isCompletedCollapsed ? ' rt-collapsed' : ''}" data-tag="${TAG}_COMPLETED" style="margin-top: 10px; background: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.05); border-radius: 6px;">
            <div class="rt-section-header" data-tag="${TAG}_COMPLETED" style="padding: 6px 10px; font-size: 0.9em; background: rgba(0,0,0,0.2); border-top-left-radius: 6px; border-top-right-radius: 6px;">
                <span style="opacity:0.8;">✅ COMPLETED</span>
                <div class="rt-section-header-right">
                    <span class="rt-item-count" style="opacity:0.6;">${completedQuests.length} ${completedQuests.length === 1 ? 'entry' : 'entries'}</span>
                    <span class="rt-collapse-icon" style="opacity:0.6;">${isCompletedCollapsed ? '&#9656;' : '&#9662;'}</span>
                </div>
            </div>
            <div class="rt-section-body" style="padding: 5px;">${completedCardsHtml}</div>
        </div>`;
    }

    if (failedQuests.length > 0) {
        const isFailedCollapsed = collapsed.has(TAG + '_FAILED');
        bodyHtml += `
        <div class="rt-section-card rt-sub-section${isFailedCollapsed ? ' rt-collapsed' : ''}" data-tag="${TAG}_FAILED" style="margin-top: 10px; background: rgba(0,0,0,0.2); border-color: rgba(255,80,80,0.12); border-radius: 6px;">
            <div class="rt-section-header" data-tag="${TAG}_FAILED" style="padding: 6px 10px; font-size: 0.9em; background: rgba(80,0,0,0.15); border-top-left-radius: 6px; border-top-right-radius: 6px;">
                <span style="opacity:0.8;">❌ FAILED</span>
                <div class="rt-section-header-right">
                    <span class="rt-item-count" style="opacity:0.6;">${failedQuests.length} ${failedQuests.length === 1 ? 'entry' : 'entries'}</span>
                    <span class="rt-collapse-icon" style="opacity:0.6;">${isFailedCollapsed ? '&#9656;' : '&#9662;'}</span>
                </div>
            </div>
            <div class="rt-section-body" style="padding: 5px;">${failedCardsHtml}</div>
        </div>`;
    }

    const renderOptions = getSettings().categoryRenderOptions?.[TAG] || {};
    const catStyles = [];
    if (renderOptions.fontSize) catStyles.push(`--rt-cat-font-size: ${(renderOptions.fontSize / 13).toFixed(4)}em`);
    if (renderOptions.italic) catStyles.push(`--rt-cat-font-style: italic`);
    if (renderOptions.bold) catStyles.push(`--rt-cat-font-weight: bold`);
    if (renderOptions.bullets === false) catStyles.push(`--rt-cat-bullet-display: none`);
    if (renderOptions.bulletColor) catStyles.push(`--rt-cat-bullet-color: ${renderOptions.bulletColor}`);
    if (renderOptions.bulletStyle) catStyles.push(`--rt-cat-bullet-style: "${renderOptions.bulletStyle}"`);
    if (renderOptions.fontFamily) catStyles.push(`--rt-cat-font-family: ${renderOptions.fontFamily}`);
    if (renderOptions.textColor && renderOptions.textColor !== 'inherit') catStyles.push(`--rt-cat-text-color: ${renderOptions.textColor}`);
    const catStyleAttr = catStyles.length ? ` style='${catStyles.join('; ')}'` : '';

    return `<div class="rt-section-card${isCollapsed ? ' rt-collapsed' : ''}" data-tag="${TAG}">
        <div class="rt-section-header" data-tag="${TAG}">
            <span>📋 QUESTS</span>
            <div class="rt-section-header-right">
                ${detachBtn}
                <button class="rt-category-settings-btn" data-tag="${TAG}" title="Category Rendering Options">
                    <i class="fa-solid fa-cog"></i>
                </button>
                <span class="rt-item-count">${activeQuests.length} active</span>
                <span class="rt-collapse-icon">${isCollapsed ? '&#9656;' : '&#9662;'}</span>
            </div>
        </div>
        <div class="rt-section-body"${catStyleAttr} style="padding-bottom: 5px;">${bodyHtml}</div>
    </div>`;
}
    /**
     * Renders the Lorebook Agent's thought process into a terminal-like view.
     * @param {object[]} steps
     * @returns {string}
     */
    export function renderLorebookTerminal(steps) {
        if (!steps || steps.length === 0) return '';

        return steps.map(step => {
            const time = new Date(step.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            let icon = 'fa-brain';
            let color = 'var(--rt-custom-text-muted)';
            let title = 'Thought';

            switch (step.type) {
                case 'tool': icon = 'fa-screwdriver-wrench'; color = '#3498db'; title = 'Tool'; break;
                case 'result': icon = 'fa-list-ul'; color = '#9b59b6'; title = 'Result'; break;
                case 'error': icon = 'fa-circle-exclamation'; color = '#e74c3c'; title = 'Error'; break;
                case 'finish': icon = 'fa-circle-check'; color = '#2ecc71'; title = 'Finished'; break;
                case 'start': icon = 'fa-play'; color = '#f1c40f'; title = 'Starting'; break;
            }

            const content = escapeHtml(step.content);
            const metadata = step.metadata || {};

            return `
            <div class="rt-terminal-step" style="margin-bottom: 8px; font-family: var(--rt-custom-font-mono, monospace); font-size: 11px;">
                <div class="rt-terminal-header" style="display: flex; align-items: center; gap: 8px; opacity: 0.8;">
                    <span style="font-size: 9px; opacity: 0.5;">${time}</span>
                    <i class="fa-solid ${icon}" style="color: ${color}; width: 14px; text-align: center;"></i>
                    <b style="color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">${title}</b>
                    ${metadata.time ? `<span style="margin-left: auto; font-size: 10px; opacity: 0.6;">Worked for ${metadata.time}s</span>` : ''}
                </div>
                <div class="rt-terminal-content" style="margin-top: 4px; padding-left: 22px; line-height: 1.4; white-space: pre-wrap; word-break: break-all; color: var(--rt-custom-text);">
                    ${content}
                </div>
            </div>`;
        }).join('');
    }
