import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const settingsMarkup = readFileSync(new URL('../settings.html', import.meta.url), 'utf8');

function divDepthAt(marker) {
    const beforeMarker = settingsMarkup.slice(0, settingsMarkup.indexOf(marker));
    const tags = beforeMarker.match(/<\/?div(?:\s[^>]*)?>/g) || [];
    return tags.reduce((depth, tag) => depth + (tag.startsWith('</') ? -1 : 1), 0);
}

describe('General & Visuals settings', () => {
    it('keeps every primary section inside the framework drawer', () => {
        const primaryHeaders = [
            '<b>General & Visuals</b>',
            '<b>Connections &amp; Models</b>',
            '<b>Game Systems & Customization</b>',
            '<b>State Tracker & Modules</b>',
            '<b>Lorebook Agent</b>',
            '<b>Persistent Maps</b>',
            '<b>World Progression</b>',
            '<b>Adventure Companion</b>',
        ];
        const expectedDepth = divDepthAt(primaryHeaders[0]);

        expect(primaryHeaders.map(divDepthAt)).toEqual(primaryHeaders.map(() => expectedDepth));
        expect((settingsMarkup.match(/<div(?:\s|>)/g) || []).length)
            .toBe((settingsMarkup.match(/<\/div>/g) || []).length);
    });

    it('organizes settings into Core & Branching, UI Appearance, and Portraits and Location Images drawers', () => {
        expect(settingsMarkup).toContain('<b>Core &amp; Branching</b>');
        expect(settingsMarkup).toContain('<b>UI Appearance</b>');
        expect(settingsMarkup).toContain('<b>Portraits and Location Images</b>');
    });

    it('can reopen the API setup checklist from Core & Branching Help', () => {
        const generalStart = settingsMarkup.indexOf('<b>General & Visuals</b>');
        const connectionsStart = settingsMarkup.indexOf('<b>Connections &amp; Models</b>');
        const generalMarkup = settingsMarkup.slice(generalStart, connectionsStart);
        expect(generalMarkup).toContain('id="rpg_tracker_api_setup_checklist"');
        expect(generalMarkup).toContain('Anti-Museum Tour');
        expect(generalMarkup).toContain('id="rpg_tracker_game_master_name"');
        expect(generalMarkup).toContain('id="rpg_tracker_create_game_master_card"');
        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(indexSource).toContain('showApiSetupGate');
        expect(indexSource).toContain("$('#rpg_tracker_api_setup_checklist')");
        expect(indexSource).toContain('createOrSelectGameMasterCard');
        expect(indexSource).toContain("$('#rpg_tracker_create_game_master_card')");
    });

    it('links General & Visuals to the canonical Map Themes controls', () => {
        const generalStart = settingsMarkup.indexOf('<b>General & Visuals</b>');
        const connectionsStart = settingsMarkup.indexOf('<b>Connections &amp; Models</b>');
        const generalMarkup = settingsMarkup.slice(generalStart, connectionsStart);
        expect(generalMarkup).toContain('<b>Map Appearance</b>');
        expect(generalMarkup).toContain('id="rpg_open_map_themes"');
        expect(generalMarkup).toContain('managed under Persistent Maps');
    });

    it('places Connections & Models immediately after General & Visuals', () => {
        const general = settingsMarkup.indexOf('<b>General & Visuals</b>');
        const connections = settingsMarkup.indexOf('<b>Connections &amp; Models</b>');
        const gameSystems = settingsMarkup.indexOf('<b>Game Systems & Customization</b>');

        expect(general).toBeGreaterThanOrEqual(0);
        expect(connections).toBeGreaterThan(general);
        expect(gameSystems).toBeGreaterThan(connections);
    });

    it('provides one central slot for every feature connection', () => {
        [
            'rpg_connection_slot_state_tracker',
            'rpg_connection_slot_combat_override',
            'rpg_connection_slot_lorebook_agent',
            'rpg_connection_slot_character_creation',
            'rpg_connection_slot_adventure_companion',
            'rpg_connection_slot_game_system_wizard',
            'rpg_connection_slot_map_architect',
            'rpg_connection_slot_map_runtime',
            'rpg_connection_slot_map_evolution',
            'rpg_connection_slot_world_progression',
            'rpg_connection_slot_portraits',
        ].forEach(id => expect(settingsMarkup).toContain(`id="${id}"`));

        const indexSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
        expect(indexSource).toContain('organizeConnectionSettingsUI();');
        expect(indexSource).toContain('initSettingsOverlay(');
        expect(indexSource).toContain("settings-stub");
        expect(indexSource).toContain("control: '#rpg_tracker_connection_source'");
        expect(indexSource).toContain("control: '#rpg_tracker_router_source'");
        expect(indexSource).toContain("control: '#rpg_adventure_companion_connection_source'");
        expect(indexSource).toContain("control: '#rpg_gs_wizard_connection_source'");
        expect(indexSource).toContain("control: '#rpg_map_architect_connection_source'");
        expect(indexSource).toContain("control: '#rpg_map_runtime_connection_source'");
        expect(indexSource).toContain("control: '#rpg_map_evolution_connection_source'");
        expect(indexSource).toContain("control: '#rpg_world_connection_source'");
        expect(indexSource).toContain("control: '#rpg_portrait_connection_source'");
        expect(indexSource).toContain('I recommend a cheap mid-tier model such as GPT-5.6 Luna, Gemini Flash/Flash-Lite series, or Deepseek V4 Flash latest.');
        expect(indexSource).toContain('Same models work fine here as with the State Tracker.');
        expect(indexSource).toContain('I recommend using a somewhat better model here such as Sonnet 5 or above for more robust and complex systems. Your mileage varies a lot here. Experiment.');
        expect(indexSource).toContain('A lightweight model should do fine.');
        expect(indexSource).not.toContain('Prefer a fast model above all');
        expect(indexSource).toContain("chevron.className = 'inline-drawer-icon fa-solid fa-circle-chevron-down rt-central-connection-chevron'");
        expect(settingsMarkup).toContain('id="rpg_connection_apply_all_box"');
        expect(settingsMarkup).toContain('Apply Connection Setup to All');

        const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        expect(style).toContain('.rpg-tracker-settings .rt-central-connection-header');
        expect(style).toContain('font-size: 0.88em !important;');
        expect(style).toContain('.rt-central-connection-chevron');
        expect(style).toContain('transform: rotate(-90deg) !important;');
        expect(style).toContain('.rt-central-connection-drawer.open');
        expect(style).toContain('transform: rotate(0deg) !important;');
    });

    it('centers the State Tracker utility drawer labels without moving their arrows', () => {
        expect(settingsMarkup).toContain('<b>Connection Settings</b>');
        expect(settingsMarkup).toContain('<b>Combat API Override</b>');
        expect(settingsMarkup).toContain('<b>Core Prompt</b>');
        const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
        expect(style).toContain('.rpg-tracker-settings .rt-centered-drawer-header');
        expect(style).toContain('justify-content: center;');
        expect(style).toContain('right: 14px;');
    });

    it('keeps portrait-specific drawers and the emergency purge within Portraits and Location Images', () => {
        const portraitsStart = settingsMarkup.indexOf('<b>Portraits and Location Images</b>');
        const developerStart = settingsMarkup.indexOf('Developer &amp; Reset');
        const portraitsMarkup = settingsMarkup.slice(portraitsStart, developerStart);

        expect(portraitsMarkup).toContain('<b>Portraits LLM Connection</b>');
        expect(portraitsMarkup).toContain('<b>Portrait and Location Image Styles</b>');
        expect(portraitsMarkup).toContain('<b>Portrait Prompt Templates</b>');
        expect(portraitsMarkup).toContain('id="rpg_portrait_prompt_presets_container"');
        expect(portraitsMarkup).toContain('id="rpg_portrait_prompt_preset_save_btn"');
        expect(portraitsMarkup).toContain('id="rpg_tracker_purge_all_portraits"');
        expect(portraitsMarkup).toContain('id="rpg_tracker_portrait_use_story_lookback"');
        expect(portraitsMarkup).toContain('id="rpg_tracker_portrait_story_lookback"');
        expect(portraitsMarkup.indexOf('Portrait and Location Image Styles'))
            .toBeLessThan(portraitsMarkup.indexOf('<b>Portrait Prompt Templates</b>'));
        expect(portraitsMarkup).not.toContain('<b>Portrait Prompt Presets</b>');
        expect(portraitsMarkup).toContain('load it into the <b>Portrait Prompt Templates</b> below');
        expect(portraitsMarkup).toContain('Save Setup to Library');
    });

    it('mirrors every Adventure Companion option and gives it a dedicated connection', () => {
        const companionStart = settingsMarkup.indexOf('<b>Adventure Companion</b>');
        const companionMarkup = settingsMarkup.slice(companionStart);

        expect(companionMarkup).toContain('Open Adventure Companion with the <b>CHAT</b> button at the top of the State Tracker. It can help with your adventure when <b>TUTORIAL MODE</b> is enabled, getting you to grips with the extension.');
        expect(companionMarkup).toContain('Otherwise, it\'s there if you just feel like chatting about your adventure or brainstorm, etc.');
        expect(companionMarkup).toContain('You can also ask it to make changes in the State Tracker, Lorebook Agent, or Map Updater, and it can take actions for you if you ask it to (by typing messages or making CYOA mode choices for you.)');

        [
            'rpg_adventure_companion_tutorial_mode',
            'rpg_adventure_companion_lookback',
            'rpg_adventure_companion_lookback_all',
            'rpg_adventure_companion_inject_lore',
            'rpg_adventure_companion_inject_memo',
            'rpg_adventure_companion_inject_map',
            'rpg_adventure_companion_connection_source',
            'rpg_adventure_companion_connection_profile',
            'rpg_adventure_companion_ollama_url',
            'rpg_adventure_companion_ollama_model',
            'rpg_adventure_companion_openai_url',
            'rpg_adventure_companion_openai_key',
            'rpg_adventure_companion_openai_model',
            'rpg_adventure_companion_openai_model_manual',
            'rpg_adventure_companion_completion_preset',
        ].forEach((id) => expect(companionMarkup).toContain(`id="${id}"`));
    });

    it('places Persistent Maps directly below Lorebook Agent', () => {
        const agentStart = settingsMarkup.indexOf('<b>Lorebook Agent</b>');
        const mapStart = settingsMarkup.indexOf('<b>Persistent Maps</b>');
        const worldStart = settingsMarkup.indexOf('<b>World Progression</b>');

        expect(agentStart).toBeGreaterThanOrEqual(0);
        expect(mapStart).toBeGreaterThan(agentStart);
        expect(worldStart).toBeGreaterThan(mapStart);
        expect(settingsMarkup.indexOf('<b>Map Architect</b>')).toBeGreaterThan(mapStart);
        expect(settingsMarkup.indexOf('<b>Architect Prompt</b>')).toBeLessThan(0);
    });

    it('places editable map themes at the bottom of Persistent Maps', () => {
        const mapStart = settingsMarkup.indexOf('<b>Persistent Maps</b>');
        const evolutionStart = settingsMarkup.indexOf('<b>Map Evolution</b>', mapStart);
        const themesStart = settingsMarkup.indexOf('<b>Map Themes</b>', mapStart);
        const worldStart = settingsMarkup.indexOf('<b>World Progression</b>');
        const mapMarkup = settingsMarkup.slice(mapStart, worldStart);

        expect(themesStart).toBeGreaterThan(evolutionStart);
        expect(themesStart).toBeLessThan(worldStart);
        expect(mapMarkup).toContain('id="rpg_map_theme_preset"');
        expect(mapMarkup).toContain('id="rpg_map_theme_load"');
        expect(mapMarkup).toContain('id="rpg_map_theme_save"');
        expect(mapMarkup).toContain('id="rpg_map_theme_delete"');
        expect(mapMarkup).toContain('id="rpg_map_theme_colors"');
        expect(mapMarkup).toContain('id="rpg_map_theme_bg_upload"');
        expect(mapMarkup).toContain('id="rpg_map_theme_bg_clear"');
        expect(mapMarkup).toContain('id="rpg_map_theme_bg_url"');
        expect(mapMarkup).toContain('id="rpg_map_theme_bg_overlay"');
    });

    it('places Adventure Companion directly below World Progression', () => {
        const worldStart = settingsMarkup.indexOf('<b>World Progression</b>');
        const companionStart = settingsMarkup.indexOf('<b>Adventure Companion</b>');

        expect(worldStart).toBeGreaterThanOrEqual(0);
        expect(companionStart).toBeGreaterThan(worldStart);
        expect(settingsMarkup.indexOf('<b>Lorebook Agent</b>')).toBeLessThan(worldStart);
    });

    it('places the global custom-bar animation toggle beside the Rendering Tags Library', () => {
        const library = settingsMarkup.indexOf('id="rt_btn_tag_library"');
        const animation = settingsMarkup.indexOf('id="rpg_tracker_animate_all_custom_bars"');
        const moduleExport = settingsMarkup.indexOf('id="rpg_tracker_export_all_modules"');

        expect(library).toBeGreaterThanOrEqual(0);
        expect(animation).toBeLessThan(library);
        expect(animation).toBeLessThan(moduleExport);
        expect(settingsMarkup.slice(animation, library)).toContain('Animate all custom bar changes in State Tracker');
        expect(settingsMarkup).not.toContain('âˆ’value');
    });
});
