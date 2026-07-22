import { getSettings } from './state-manager.js';
import { getRuntimeActions } from './runtime-bridge.js';

export function scalePanelBackgroundImage(dataUrl, maxDim = 1280) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
                const scale = maxDim / Math.max(width, height);
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas unsupported'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = dataUrl;
    });
}

/**
 * CSS url() value from a stored image src (data URL or http(s)).
 * @param {string} src
 * @returns {string}
 */
function cssUrlFromImageSrc(src) {
    if (!src || typeof src !== 'string') return 'none';
    const trimmed = src.trim();
    if (!trimmed) return 'none';
    return `url(${JSON.stringify(trimmed)})`;
}

/**
 * @param {object} settings
 * @param {{ dayKey: string, nightKey: string, strengthKey: string }} keys
 */
export function getPanelBgConfig(settings, keys) {
    const dayRaw = String(settings[keys.dayKey] || '').trim();
    const nightRaw = String(settings[keys.nightKey] || '').trim();
    const daySrc = dayRaw || nightRaw;
    const nightSrc = nightRaw || dayRaw;
    const strength = Math.max(0, Math.min(100, parseInt(String(settings[keys.strengthKey] ?? 55), 10) || 0)) / 100;
    return { daySrc, nightSrc, strength, hasImage: !!(dayRaw || nightRaw) };
}

/** @param {HTMLElement} panel */
function applyPanelBackgroundToElement(panel, config) {
    panel.classList.toggle('rt-has-bg-image', config.hasImage);
    if (config.hasImage) {
        panel.style.setProperty('--rt-user-bg-image', cssUrlFromImageSrc(config.daySrc));
        panel.style.setProperty('--rt-user-bg-image-night', cssUrlFromImageSrc(config.nightSrc));
        panel.style.setProperty('--rt-bg-overlay-strength', String(config.strength));
    } else {
        panel.style.removeProperty('--rt-user-bg-image');
        panel.style.removeProperty('--rt-user-bg-image-night');
        panel.style.removeProperty('--rt-bg-overlay-strength');
    }
}

/** @param {HTMLElement} panel */
function clearPanelBackgroundOnElement(panel) {
    panel.classList.remove('rt-has-bg-image');
    panel.style.removeProperty('--rt-user-bg-image');
    panel.style.removeProperty('--rt-user-bg-image-night');
    panel.style.removeProperty('--rt-bg-overlay-strength');
}

export const PANEL_BG_TRACKER_KEYS = { dayKey: 'panelBgImage', nightKey: 'panelBgImageNight', strengthKey: 'panelBgOverlayStrength' };
export const PANEL_BG_AGENT_KEYS = { dayKey: 'agentPanelBgImage', nightKey: 'agentPanelBgImageNight', strengthKey: 'agentPanelBgOverlayStrength' };

/**
 * Applies optional user panel backdrops: State Tracker and detached Lorebook Agent use separate images.
 */
export function applyPanelBackgroundToDom() {
    const settings = getSettings();
    const main = document.getElementById('rpg-tracker-panel');
    if (main instanceof HTMLElement) {
        applyPanelBackgroundToElement(main, getPanelBgConfig(settings, PANEL_BG_TRACKER_KEYS));
    }

    const agent = document.getElementById('rpg-tracker-agent');
    if (agent instanceof HTMLElement) {
        if (agent.classList.contains('rt-detached-panel') && agent.parentElement === document.body) {
            applyPanelBackgroundToElement(agent, getPanelBgConfig(settings, PANEL_BG_AGENT_KEYS));
        } else {
            clearPanelBackgroundOnElement(agent);
        }
    }
}

/**
 * Swaps rt-theme-* on tracker panels without clearing other state classes, then
 * re-applies day/night cycle tint/badge when that feature is enabled.
 * @param {string} [newTheme]
 */
export function applyTrackerThemeToDom(newTheme) {
    const settings = getSettings();
    const theme = newTheme || settings.trackerTheme || 'rt-theme-native';

    const swapThemeOn = (/** @type {HTMLElement} */ el) => {
        Array.from(el.classList).filter(c => c.startsWith('rt-theme-')).forEach(c => el.classList.remove(c));
        el.classList.add(theme);
    };

    const mainPanel = document.getElementById('rpg-tracker-panel');
    if (mainPanel) {
        swapThemeOn(mainPanel);
        mainPanel.classList.toggle('is-disabled', !settings.enabled);
    }

    document.querySelectorAll('.rpg-tracker-detached-panel, .rpg-tracker-agent-panel').forEach(dp => {
        swapThemeOn(dp);
        if (!dp.classList.contains('rpg-tracker-agent-panel')) {
            dp.classList.toggle('is-disabled', !settings.enabled);
        }
    });

    applyPanelBackgroundToDom();
    getRuntimeActions().refreshDayNightCycleFromCurrentMemo();
}
