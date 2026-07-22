import { BLOCK_ICONS } from './constants.js';
import { canResizePanels, makeDraggable } from './ui-geometry.js';
import { getRuntimeActions } from './runtime-bridge.js';

export function createDetachedPanel(tag) {
    const { getSettings, loadDetached, refreshRenderedView, saveDetached } = getRuntimeActions();

    if (document.getElementById(`rt-detached-panel-${tag}`)) return;

    const customField = (getSettings().customFields || []).find(f => f.tag.toUpperCase() === tag);
    const icon = customField?.icon || BLOCK_ICONS[tag] || '📄';
    const displayName = customField?.label || tag;

    const settings = getSettings();
    const panel = document.createElement('div');
    panel.id = `rt-detached-panel-${tag}`;
    panel.className = `rpg-tracker-panel rpg-tracker-detached-panel rt-detached-panel ${settings.trackerTheme || 'rt-theme-native'}`;
    panel.style.height = '300px'; // default; overridden by saved geometry
    panel.innerHTML = `
            <div class="rpg-tracker-header rt-detached-header">
                <div class="rpg-tracker-header-left">
                    <span>${icon} ${displayName}</span>
                </div>
                <div class="rpg-tracker-header-right">
                    <button class="rpg-tracker-icon-btn rt-reattach-btn" data-tag="${tag}" title="Re-attach">✕</button>
                </div>
            </div>
            <div class="rpg-tracker-content rpg-tracker-detached-body">
                <!-- Content injected here via refreshRenderedView() -->
            </div>
            <div class="rt-resizer-br rt-detached-resizer-br" title="Resize"></div>
            <div class="rt-resizer-bl rt-detached-resizer-bl" title="Resize"></div>
        `;

    document.body.appendChild(panel);

    const header = panel.querySelector('.rt-detached-header');
    if (header instanceof HTMLElement) {
        makeDraggable(panel, header, `rpg_tracker_geometry_${tag}`);
    }

    // Per-tag geometry key (same key used by makeDraggable above)
    const geoKey = `rpg_tracker_geometry_${tag}`;

    // Save helper scoped to this detached panel's key
    const saveDetachedGeo = () => {
        const rect = panel.getBoundingClientRect();
        localStorage.setItem(geoKey, JSON.stringify({
            left: rect.left, top: rect.top,
            width: rect.width, height: rect.height
        }));
    };

    // Wire up the BR resizer (bottom-right: drag right/down)
    const resizerBR = /** @type {HTMLElement} */ (panel.querySelector('.rt-detached-resizer-br'));
    if (resizerBR && canResizePanels()) {
        let startX, startY, startW, startH, startTop, startLeft;
        resizerBR.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            resizerBR.setPointerCapture(e.pointerId);
            const rect = panel.getBoundingClientRect();
            startX = e.clientX; startY = e.clientY;
            startW = rect.width; startH = rect.height;
            startTop = rect.top; startLeft = rect.left;
            panel.style.left = startLeft + 'px'; panel.style.top = startTop + 'px';
            panel.style.right = 'auto'; panel.style.bottom = 'auto';
            panel.style.maxHeight = 'none';
            e.preventDefault(); e.stopPropagation();
        });
        resizerBR.addEventListener('pointermove', (e) => {
            if (!resizerBR.hasPointerCapture(e.pointerId)) return;
            panel.style.width = Math.max(220, startW + (e.clientX - startX)) + 'px';
            panel.style.height = Math.max(120, startH + (e.clientY - startY)) + 'px';
        });
        resizerBR.addEventListener('pointerup', (e) => {
            try { resizerBR.releasePointerCapture(e.pointerId); } catch (_) { }
            saveDetachedGeo();
        });
        resizerBR.addEventListener('pointercancel', (e) => {
            try { resizerBR.releasePointerCapture(e.pointerId); } catch (_) { }
        });
    }

    // Wire up the BL resizer (bottom-left: drag left expands width, down expands height)
    const resizerBL = /** @type {HTMLElement} */ (panel.querySelector('.rt-detached-resizer-bl'));
    if (resizerBL && canResizePanels()) {
        let startX, startY, startW, startH, startTop, startLeft;
        resizerBL.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            resizerBL.setPointerCapture(e.pointerId);
            const rect = panel.getBoundingClientRect();
            startX = e.clientX; startY = e.clientY;
            startW = rect.width; startH = rect.height;
            startTop = rect.top; startLeft = rect.left;
            panel.style.left = startLeft + 'px'; panel.style.top = startTop + 'px';
            panel.style.right = 'auto'; panel.style.bottom = 'auto';
            panel.style.maxHeight = 'none';
            e.preventDefault(); e.stopPropagation();
        });
        resizerBL.addEventListener('pointermove', (e) => {
            if (!resizerBL.hasPointerCapture(e.pointerId)) return;
            const dx = e.clientX - startX;
            const newW = Math.max(220, startW - dx);
            if (newW > 220) {
                panel.style.width = newW + 'px';
                panel.style.left = (startLeft + dx) + 'px';
            }
            panel.style.height = Math.max(120, startH + (e.clientY - startY)) + 'px';
        });
        resizerBL.addEventListener('pointerup', (e) => {
            try { resizerBL.releasePointerCapture(e.pointerId); } catch (_) { }
            saveDetachedGeo();
        });
        resizerBL.addEventListener('pointercancel', (e) => {
            try { resizerBL.releasePointerCapture(e.pointerId); } catch (_) { }
        });
    }

    try {
        const saved = JSON.parse(localStorage.getItem(geoKey));
        if (saved && saved.left !== undefined) {
            // Sanitize coordinates
            const left = Math.max(0, Math.min(window.innerWidth - 50, saved.left));
            const top = Math.max(0, Math.min(window.innerHeight - 50, saved.top));

            panel.style.left = left + 'px'; panel.style.right = 'auto';
            panel.style.top = top + 'px'; panel.style.bottom = 'auto';
            if (saved.width) panel.style.width = saved.width + 'px';
            if (saved.height) panel.style.height = saved.height + 'px';
        } else {
            const mainPanel = document.getElementById('rpg-tracker-panel');
            if (mainPanel) {
                const rect = mainPanel.getBoundingClientRect();
                // spawn adjacent to the main panel if no stored position
                let spawnLeft = rect.left - 270;
                if (spawnLeft < 0) spawnLeft = rect.right + 10;
                panel.style.left = Math.max(10, spawnLeft) + 'px';
                panel.style.top = rect.top + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
            }
        }
    } catch { /* ignore */ }

    panel.querySelector('.rt-reattach-btn').addEventListener('click', () => {
        const detached = loadDetached();
        detached.delete(tag);
        saveDetached(detached);
        panel.remove();
        refreshRenderedView();
    });

    // Trigger an initial render to fill its body
    refreshRenderedView();
}
