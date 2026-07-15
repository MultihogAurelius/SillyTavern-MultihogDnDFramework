const GEOMETRY_KEY = 'rpg_tracker_geometry';
const DELTA_HEIGHT_KEY = 'rpg_tracker_delta_height';

/** Mobile layout breakpoint — matches panel + settings optimizations. */
export function isMobileLayout() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches;
}

/** Panel resize is desktop-only (max-width 800px = mobile layout). */
export function canResizePanels() {
    return !isMobileLayout();
}

/**
 * jQuery show/hide with slide animation on desktop; instant toggle on mobile.
 * @param {JQuery} $el
 * @param {boolean | undefined} show
 */
export function jqueryToggleSlide($el, show) {
    if (!$el?.length) return;
    $el.stop(true, true);
    if (isMobileLayout()) {
        if (show === undefined) $el.toggle();
        else $el.toggle(!!show);
        return;
    }
    if (show === undefined) $el.slideToggle(200);
    else if (show) $el.slideDown(200);
    else $el.slideUp(200);
}

/**
 * @param {HTMLElement} panel
 */
function savePanelGeometry(panel) {
    if (!panel || panel.style.display === 'none') return;
    const rect = panel.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const isCollapsed = panel.classList.contains('rt-panel-collapsed');
    let savedGeo = {};
    try {
        const savedStr = localStorage.getItem(GEOMETRY_KEY);
        if (savedStr) savedGeo = JSON.parse(savedStr) || {};
    } catch { }

    localStorage.setItem(GEOMETRY_KEY, JSON.stringify({
        left: rect.left, top: rect.top,
        width: isCollapsed ? (savedGeo.width || rect.width) : rect.width,
        height: isCollapsed ? (savedGeo.height || rect.height) : rect.height
    }));
}

/**
 * @param {HTMLElement} panel
 */
export function loadPanelGeometry(panel) {
    try {
        const saved = JSON.parse(localStorage.getItem(GEOMETRY_KEY));
        if (!saved) return;

        // Sanitize coordinates to prevent "bricking" off-screen
        const left = saved.left !== undefined ? Math.max(0, Math.min(window.innerWidth - 50, saved.left)) : undefined;
        const top = saved.top !== undefined ? Math.max(0, Math.min(window.innerHeight - 50, saved.top)) : undefined;

        if (left !== undefined) { panel.style.left = left + 'px'; panel.style.right = 'auto'; }
        if (top !== undefined) { panel.style.top = top + 'px'; panel.style.bottom = 'auto'; }
        if (saved.width) panel.style.width = saved.width + 'px';
        // Guard: ignore saved heights that are smaller than a reasonable minimum (e.g. a stale
        // header-only save from before the collapse feature existed). 80px ≈ header + tiny content.
        if (saved.height && saved.height > 80) panel.style.height = saved.height + 'px';
    } catch { /* ignore */ }
}

function saveDeltaHeight(height) {
    localStorage.setItem(DELTA_HEIGHT_KEY, String(height));
}

export function loadDeltaHeight() {
    const v = parseInt(localStorage.getItem(DELTA_HEIGHT_KEY) || '');
    return isNaN(v) ? 120 : Math.max(40, v);
}

/**
 * @param {HTMLElement} panel
 * @param {HTMLElement} handle
 */
export function makeDraggable(panel, handle, customKey = null) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        // Ignore clicks on buttons inside the header
        if (e.target instanceof Element && e.target.closest('button, input, select, textarea')) return;
        isDragging = true;
        handle.setPointerCapture(e.pointerId);
        const rect = panel.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startLeft = rect.left; startTop = rect.top;
        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        e.preventDefault();
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const left = startLeft + (e.clientX - startX);
        const top = startTop + (e.clientY - startY);

        // Constrain to viewport (ensure header stays reachable)
        const boundedLeft = Math.max(0, Math.min(window.innerWidth - 100, left));
        const boundedTop = Math.max(0, Math.min(window.innerHeight - 50, top));

        panel.style.left = boundedLeft + 'px';
        panel.style.top = boundedTop + 'px';
    };

    const onPointerUp = (e) => {
        if (isDragging) {
            isDragging = false;
            try { handle.releasePointerCapture(e.pointerId); } catch(err){}
            if (customKey) {
                const rect = panel.getBoundingClientRect();
                const isCollapsed = panel.classList.contains('rt-panel-collapsed');
                let savedGeo = {};
                try {
                    const savedStr = localStorage.getItem(customKey);
                    if (savedStr) savedGeo = JSON.parse(savedStr) || {};
                } catch { }

                localStorage.setItem(customKey, JSON.stringify({
                    left: rect.left, top: rect.top,
                    width: isCollapsed ? (savedGeo.width || rect.width) : rect.width,
                    height: isCollapsed ? (savedGeo.height || rect.height) : rect.height
                }));
            } else {
                savePanelGeometry(panel);
            }
        }
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', (e) => {
        isDragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch(err){}
    });

    return () => {
        isDragging = false;
        handle.removeEventListener('pointerdown', onPointerDown);
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
    };
}

/**
 * Top-Right corner resizer logic
 * @param {HTMLElement} panel 
 * @param {HTMLElement} handle 
 */
export function makeResizableTR(panel, handle) {
    let startX, startY, startWidth, startHeight, startTop, startLeft;

    handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !canResizePanels()) return;
        handle.setPointerCapture(e.pointerId);
        const rect = panel.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        startTop = rect.top;
        startLeft = rect.left;

        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        e.preventDefault();
        e.stopPropagation();
    });

    handle.addEventListener('pointermove', (e) => {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const newWidth = Math.max(220, startWidth + dx);
        const newHeight = Math.max(200, startHeight - dy);
        const newTop = startTop + dy;

        panel.style.width = newWidth + 'px';
        if (newHeight > 200) {
            panel.style.height = newHeight + 'px';
            panel.style.top = newTop + 'px';
        }
    });

    handle.addEventListener('pointerup', (e) => {
        try { handle.releasePointerCapture(e.pointerId); } catch(err){}
        savePanelGeometry(panel);
    });

    handle.addEventListener('pointercancel', (e) => {
        try { handle.releasePointerCapture(e.pointerId); } catch(err){}
    });
}

/**
 * Bottom-Right corner resizer logic.
 * Same pointer-capture pattern as makeResizableTR.
 * @param {HTMLElement} panel
 * @param {HTMLElement} handle
 */
export function makeResizableBR(panel, handle) {
    let startX, startY, startWidth, startHeight, startTop, startLeft;

    handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !canResizePanels()) return;
        handle.setPointerCapture(e.pointerId);
        const rect = panel.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        startTop = rect.top;
        startLeft = rect.left;

        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.maxHeight = 'none';

        e.preventDefault();
        e.stopPropagation();
    });

    handle.addEventListener('pointermove', (e) => {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        panel.style.width = Math.max(220, startWidth + dx) + 'px';
        panel.style.height = Math.max(200, startHeight + dy) + 'px';
    });

    handle.addEventListener('pointerup', (e) => {
        try { handle.releasePointerCapture(e.pointerId); } catch(err){}
        savePanelGeometry(panel);
    });

    handle.addEventListener('pointercancel', (e) => {
        try { handle.releasePointerCapture(e.pointerId); } catch(err){}
    });
}

/**
 * Bottom-Left corner resizer logic.
 * Same pointer-capture pattern as makeResizableTR.
 * @param {HTMLElement} panel
 * @param {HTMLElement} handle
 */
export function makeResizableBL(panel, handle) {
    let startX, startY, startWidth, startHeight, startTop, startLeft;

    handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !canResizePanels()) return;
        handle.setPointerCapture(e.pointerId);
        const rect = panel.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        startTop = rect.top;
        startLeft = rect.left;

        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.maxHeight = 'none';

        e.preventDefault();
        e.stopPropagation();
    });

    handle.addEventListener('pointermove', (e) => {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const newWidth = Math.max(220, startWidth - dx);
        const newLeft = startLeft + dx;

        if (newWidth > 220) {
            panel.style.width = newWidth + 'px';
            panel.style.left = newLeft + 'px';
        }
        panel.style.height = Math.max(200, startHeight + dy) + 'px';
    });

    handle.addEventListener('pointerup', (e) => {
        try { handle.releasePointerCapture(e.pointerId); } catch(err){}
        savePanelGeometry(panel);
    });

    handle.addEventListener('pointercancel', (e) => {
        try { handle.releasePointerCapture(e.pointerId); } catch(err){}
    });
}

export function setupResizeObserver(panel) {
    // Debounced save on resize.
    // Skip the very first callback — it fires immediately on observe() before
    // the panel's restored geometry (from loadPanelGeometry) has been painted,
    // which would cause it to overwrite the saved position with the CSS default.
    let _resizeTimer;
    let _initialFired = false;
    const ro = new ResizeObserver(() => {
        if (!_initialFired) { _initialFired = true; return; }
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(() => savePanelGeometry(panel), 300);
    });
    ro.observe(panel);
}

export function setupDeltaResize(panel) {
    const handle = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-delta-handle'));
    const deltaEl = /** @type {HTMLElement} */ (panel.querySelector('#rpg-tracker-delta'));
    if (!handle || !deltaEl || !canResizePanels()) return;
    let startY, startH;

    handle.addEventListener('pointerdown', (e) => {
        if (!canResizePanels()) return;
        startY = e.clientY;
        startH = deltaEl.offsetHeight;
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        const newH = Math.max(40, startH - (e.clientY - startY));
        deltaEl.style.height = newH + 'px';
    });

    handle.addEventListener('pointerup', (e) => {
        if (handle.hasPointerCapture(e.pointerId)) {
            saveDeltaHeight(deltaEl.offsetHeight);
        }
    });

    handle.addEventListener('pointercancel', () => { });
}
