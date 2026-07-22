/**
 * Router state sanitization and timestamp template adjusters.
 */

export function sanitizeRouterState(s) {
    if (!s) return;
    const isGoodId = (id) => typeof id === 'string' && id.includes('::');

    if (Array.isArray(s.activeRouterKeys)) {
        s.activeRouterKeys = s.activeRouterKeys.filter(isGoodId);
    } else {
        s.activeRouterKeys = [];
    }

    if (Array.isArray(s.activeWorldKeys)) {
        s.activeWorldKeys = s.activeWorldKeys.filter(isGoodId);
    } else {
        s.activeWorldKeys = [];
    }

    if (Array.isArray(s.keywordActivatedKeys)) {
        s.keywordActivatedKeys = s.keywordActivatedKeys.filter(isGoodId);
    } else {
        s.keywordActivatedKeys = [];
    }

    if (Array.isArray(s.routerLog)) {
        s.routerLog = s.routerLog.filter(log => {
            if (!log || typeof log !== 'object') return false;

            if (Array.isArray(log.record)) {
                log.record = log.record.filter(isGoodId);
            } else {
                log.record = [];
            }

            if (Array.isArray(log.activate)) {
                log.activate = log.activate.filter(isGoodId);
            } else {
                log.activate = [];
            }

            if (Array.isArray(log.deactivate)) {
                log.deactivate = log.deactivate.filter(isGoodId);
            } else {
                log.deactivate = [];
            }

            return true;
        });
    } else {
        s.routerLog = [];
    }
}

/**
 * Dynamically adjusts timestamp formats (Day X/N vs DD/MM/YYYY and 12h vs 24h) inside prompt instructions.
 * @param {string} prompt
 * @param {object} settings
 * @returns {string}
 */
export function adjustPromptTimestamps(prompt, settings) {
    if (!prompt) return prompt;
    const isCalendar = !!settings.useDdMmYyFormat;
    const is24h = !!settings.use24hTime;

    let result = prompt;

    if (isCalendar) {
        if (is24h) {
            // Target: DD/MM/YYYY, HH:MM (24h)
            result = result
                .replace(/Day ([1-9])/g, '0$1/01/2026')
                .replace(/Day N/g, 'DD/MM/YYYY')
                .replace(/Day X/g, 'DD/MM/YYYY')
                .replace(/Day 0/g, '31/12/2025')
                .replace(/12:15 AM/g, '00:15')
                .replace(/11:52 AM/g, '11:52')
                .replace(/10:00 PM/g, '22:00')
                .replace(/08:00 AM/g, '08:00')
                .replace(/06:00 PM/g, '18:00')
                .replace(/14:00/g, '14:00')
                .replace(/10:42/g, '10:42')
                .replace(/10:44/g, '10:44')
                .replace(/HH:MM AM\/PM/g, 'HH:MM')
                .replace(/HH:MM/g, 'HH:MM');
        } else {
            // Target: DD/MM/YYYY, HH:MM AM/PM (12h)
            result = result
                .replace(/Day ([1-9])/g, '0$1/01/2026')
                .replace(/Day N/g, 'DD/MM/YYYY')
                .replace(/Day X/g, 'DD/MM/YYYY')
                .replace(/Day 0/g, '31/12/2025')
                .replace(/14:00/g, '02:00 PM')
                .replace(/22:00/g, '10:00 PM')
                .replace(/10:42/g, '10:42 AM')
                .replace(/10:44/g, '10:44 AM')
                .replace(/HH:MM/g, 'HH:MM AM/PM')
                .replace(/HH:MM AM\/PM/g, 'HH:MM AM/PM');
        }
    } else {
        if (is24h) {
            // Target: Day N, HH:MM (24h)
            result = result
                .replace(/0([1-9])\/01\/2026/g, 'Day $1')
                .replace(/DD\/MM\/YYYY/g, 'Day N')
                .replace(/31\/12\/2025/g, 'Day 0')
                .replace(/12:15 AM/g, '00:15')
                .replace(/11:52 AM/g, '11:52')
                .replace(/10:00 PM/g, '22:00')
                .replace(/08:00 AM/g, '08:00')
                .replace(/06:00 PM/g, '18:00')
                .replace(/14:00/g, '14:00')
                .replace(/10:42/g, '10:42')
                .replace(/10:44/g, '10:44')
                .replace(/HH:MM AM\/PM/g, 'HH:MM')
                .replace(/HH:MM/g, 'HH:MM');
        } else {
            // Target: Day N, HH:MM AM/PM (12h)
            result = result
                .replace(/0([1-9])\/01\/2026/g, 'Day $1')
                .replace(/DD\/MM\/YYYY/g, 'Day N')
                .replace(/31\/12\/2025/g, 'Day 0')
                .replace(/14:00/g, '02:00 PM')
                .replace(/22:00/g, '10:00 PM')
                .replace(/10:42/g, '10:42 AM')
                .replace(/10:44/g, '10:44 AM')
                .replace(/HH:MM/g, 'HH:MM AM/PM')
                .replace(/HH:MM AM\/PM/g, 'HH:MM AM/PM');
        }
    }

    // Make repeated format toggles idempotent. Older templates can contain
    // "HH:MM AM/PM AM/PM" (or more repetitions) because a broad HH:MM
    // replacement also matched the start of an already-suffixed placeholder.
    // Collapse those legacy forms while producing the requested clock format.
    return is24h
        ? result.replace(/HH:MM(?:\s+AM\/PM)+/g, 'HH:MM')
        : result.replace(/HH:MM(?:\s+AM\/PM)*/g, 'HH:MM AM/PM');
}

/**
 * Iterates through all stored system prompt, modular agent prompt, and stock prompt templates,
 * rewriting their embedded date/time examples to match the newly selected format.
 * @param {object} settings
 */
export function adjustAllStoredTemplatesForTimeFormat(settings) {
    if (settings.routerSystemPromptTemplate) {
        settings.routerSystemPromptTemplate = adjustPromptTimestamps(settings.routerSystemPromptTemplate, settings);
    }
    if (settings.routerModularPromptTemplate) {
        settings.routerModularPromptTemplate = adjustPromptTimestamps(settings.routerModularPromptTemplate, settings);
    }
    if (settings.stockPrompts) {
        for (const [key, val] of Object.entries(settings.stockPrompts)) {
            settings.stockPrompts[key] = adjustPromptTimestamps(val, settings);
        }
    }
}
