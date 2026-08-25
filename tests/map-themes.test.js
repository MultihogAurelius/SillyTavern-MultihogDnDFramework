import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    DEFAULT_MAP_THEME,
    FACTORY_MAP_THEME_PRESETS,
    MAP_THEME_FIELDS,
    applyMapThemeToRoot,
    normalizeMapTheme,
    normalizeSavedMapThemePresets,
    resolveMapThemePreset,
} from '../src/state/map-themes.js';

describe('map themes', () => {
    it('debounces picker movement but applies the final change immediately', () => {
        const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(source).toContain('const MAP_THEME_PREVIEW_DELAY_MS = 90;');
        expect(source).toContain('const MAP_THEME_SAVE_DELAY_MS = 240;');
        expect(source).toContain("queueMapThemeColor(key, raw, event.type === 'change');");
        expect(source).toContain('flushPendingMapThemeColors(false);');
        expect(source).toContain('Keep the high-frequency native picker event nearly work-free.');
    });

    it('ships a complete valid palette for every factory theme', () => {
        const keys = MAP_THEME_FIELDS.map(field => field.key);
        expect(new Set(keys).size).toBe(keys.length);
        expect(Object.keys(DEFAULT_MAP_THEME)).toEqual([...keys, 'backgroundImage', 'backgroundImageStrength']);
        expect(DEFAULT_MAP_THEME.creature).toBe('#ffffff');
        expect(DEFAULT_MAP_THEME.group).toBe('#ffffff');
        expect(FACTORY_MAP_THEME_PRESETS.length).toBeGreaterThanOrEqual(5);
        for (const preset of FACTORY_MAP_THEME_PRESETS) {
            expect(Object.keys(preset.theme)).toEqual([...keys, 'backgroundImage', 'backgroundImageStrength']);
            expect(preset.theme.creature).toBe('#ffffff');
            expect(preset.theme.group).toBe('#ffffff');
            keys.forEach(key => expect(preset.theme[key]).toMatch(/^#[0-9a-f]{6}$/i));
            expect(preset.theme.backgroundImage).toBe('');
            expect(preset.theme.backgroundImageStrength).toBe(55);
        }
        const blueWhite = FACTORY_MAP_THEME_PRESETS.find(preset => preset.id === 'factory:blue-white');
        expect(blueWhite?.theme.background).toBe('#f7f7f7');
        expect(blueWhite?.theme.textbox).toBe('#071520');
    });

    it('normalizes colors without retaining unknown theme fields', () => {
        const theme = normalizeMapTheme({
            accent: '#AABBCC',
            route: 'red',
            backgroundImage: 'https://example.com/texture.png',
            backgroundImageStrength: 150,
            surprise: '#123456',
        });
        expect(theme.accent).toBe('#aabbcc');
        expect(theme.route).toBe(DEFAULT_MAP_THEME.route);
        expect(theme.backgroundImage).toBe('https://example.com/texture.png');
        expect(theme.backgroundImageStrength).toBe(100);
        expect(theme).not.toHaveProperty('surprise');
    });

    it('rejects unsafe background image sources', () => {
        expect(normalizeMapTheme({ backgroundImage: 'javascript:alert(1)' }).backgroundImage).toBe('');
        expect(normalizeMapTheme({ backgroundImage: 'data:text/html,bad' }).backgroundImage).toBe('');
        expect(normalizeMapTheme({ backgroundImage: 'data:image/png;base64,AAAA' }).backgroundImage)
            .toBe('data:image/png;base64,AAAA');
    });

    it('normalizes saved presets and rejects prototype keys', () => {
        const source = Object.create(null);
        source.Night = { background: '#010203' };
        source.__proto__ = { background: '#ffffff' };
        const presets = normalizeSavedMapThemePresets(source);
        expect(presets.Night.background).toBe('#010203');
        expect(Object.prototype.hasOwnProperty.call(presets, '__proto__')).toBe(false);
    });

    it('resolves factory and user presets without mutating their source', () => {
        const user = { Lavender: { ...DEFAULT_MAP_THEME, accent: '#aabbcc' } };
        expect(resolveMapThemePreset('factory:ember', user)).toEqual(DEFAULT_MAP_THEME);
        const loaded = resolveMapThemePreset('user:Lavender', user);
        expect(loaded.accent).toBe('#aabbcc');
        loaded.accent = '#000000';
        expect(user.Lavender.accent).toBe('#aabbcc');
        expect(resolveMapThemePreset('missing', user)).toBeNull();
    });

    it('applies both solid and translucent CSS variables to the supplied root', () => {
        const setProperty = vi.fn();
        applyMapThemeToRoot({ ...DEFAULT_MAP_THEME, accent: '#123456' }, { style: { setProperty } });
        expect(setProperty).toHaveBeenCalledWith('--rt-map-accent', '#123456');
        expect(setProperty).toHaveBeenCalledWith('--rt-map-accent-soft', 'rgba(18, 52, 86, 0.28)');
        expect(setProperty).toHaveBeenCalledWith('--rt-map-background', DEFAULT_MAP_THEME.background);
        expect(setProperty).toHaveBeenCalledWith('--rt-map-background-image', 'none');
        expect(setProperty).toHaveBeenCalledWith('--rt-map-background-overlay', 'rgba(12, 12, 12, 0.55)');
        expect(setProperty).toHaveBeenCalledWith('--rt-map-textbox', DEFAULT_MAP_THEME.textbox);
        expect(setProperty).toHaveBeenCalledWith('--rt-map-frame', DEFAULT_MAP_THEME.frame);
        expect(setProperty).toHaveBeenCalledWith('--rt-map-frame-soft', 'rgba(255, 170, 0, 0.35)');
    });

    it('applies a safe background image and its canvas overlay', () => {
        const setProperty = vi.fn();
        applyMapThemeToRoot({
            ...DEFAULT_MAP_THEME,
            backgroundImage: 'https://example.com/map texture.jpg',
            backgroundImageStrength: 25,
        }, { style: { setProperty } });
        expect(setProperty).toHaveBeenCalledWith(
            '--rt-map-background-image',
            'url("https://example.com/map texture.jpg")',
        );
        expect(setProperty).toHaveBeenCalledWith('--rt-map-background-overlay', 'rgba(12, 12, 12, 0.25)');
    });

    it('colors masked asset art through the theme variables', () => {
        const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        expect(style).toContain('.rt-dungeon-graph-node .rt-dungeon-graph-icon-art');
        expect(style).toContain('fill: currentColor;');
        expect(style).toContain('pointer-events: none !important;');
        expect(style).toContain('color: var(--rt-map-creature, #ffffff);');
        expect(style).toContain('color: var(--rt-map-group, #ffffff);');
        expect(style).toContain('color: var(--rt-map-loot, #ffcc4a);');
        expect(style).toContain('border: 1px solid var(--rt-map-frame, #ffaa00);');
        expect(style).toContain('background: var(--rt-map-textbox, #0c0c0c);');
        expect(style).toContain('var(--rt-map-background-image, none);');
        expect(style).toContain('.rt-dungeon-graph-asset-tip:popover-open');
        expect(style).toContain('overflow: visible;');
        expect(style).not.toMatch(/\.rt-dungeon-graph-icon \{[^}]*filter:\s*drop-shadow/);
    });
});
