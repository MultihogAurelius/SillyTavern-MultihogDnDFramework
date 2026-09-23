import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    isPcCoreTarget,
    isAppearanceField,
    isEquipmentField,
    isSpeciesField,
    patchLabeledSection,
} from '../src/state/router-utils.js';

const routerSource = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
const moduleInstrSource = readFileSync(new URL('../src/state/module-instructions.js', import.meta.url), 'utf8');

describe('isPcCoreTarget sentinel matching', () => {
    it('matches {{user}}, player, pc, user, and the linked PC name', () => {
        expect(isPcCoreTarget('{{user}}')).toBe(true);
        expect(isPcCoreTarget('player')).toBe(true);
        expect(isPcCoreTarget('PC')).toBe(true);
        expect(isPcCoreTarget('user')).toBe(true);
        expect(isPcCoreTarget('Dave Davidson', 'Dave Davidson')).toBe(true);
        expect(isPcCoreTarget('dave davidson', 'Dave Davidson')).toBe(true);
    });

    it('rejects NPC names and empty ids', () => {
        expect(isPcCoreTarget('Schwarzenegev', 'Dave Davidson')).toBe(false);
        expect(isPcCoreTarget('')).toBe(false);
        expect(isPcCoreTarget(null)).toBe(false);
        expect(isPcCoreTarget('Campaign_NPCs::3', 'Dave')).toBe(false);
    });
});

describe('PC Body/Worn Equipment bio patching', () => {
    it('patches Body in a flat PC bio string', () => {
        const bio = 'Species: Human.\nBody: Tall human with short dark hair.\nEquipment: Leather jacket.\nPersonality: Stoic.\nBackground: Ex-soldier.\n';
        const result = patchLabeledSection(bio, 'Body', 'Tall human with a fresh scar across the left cheek.', { isPc: true });
        expect(result.ok).toBe(true);
        expect(result.text).toContain('Body: Tall human with a fresh scar across the left cheek.');
        expect(result.text).toContain('Species: Human.');
        expect(result.text).toContain('Equipment: Leather jacket.');
        expect(result.text).toContain('Personality: Stoic.');
        expect(result.text).toContain('Background: Ex-soldier.');
    });

    it('patches legacy Equipment header in place without renaming it', () => {
        const bio = 'Species: Human.\nBody: Tall human with short dark hair.\nEquipment: Leather jacket.\nPersonality: Stoic.\n';
        const result = patchLabeledSection(bio, 'Worn Equipment', 'Steel breastplate and a longsword.', { isPc: true });
        expect(result.ok).toBe(true);
        expect(result.text).toContain('Equipment: Steel breastplate and a longsword.');
        expect(result.text).toContain('Body: Tall human with short dark hair.');
        expect(result.text).not.toMatch(/Worn Equipment:/);
    });

    it('appends Worn Equipment when no equipment header exists', () => {
        const bio = 'Personality: Curious.\n';
        const result = patchLabeledSection(bio, 'Worn Equipment', 'Travel cloak and staff.', { isPc: true });
        expect(result.ok).toBe(true);
        expect(result.text).toMatch(/Worn Equipment:\s*Travel cloak and staff\./);
        expect(result.text).toContain('Personality: Curious.');
    });

    it('lazily appends Body when missing', () => {
        const bio = 'Personality: Curious.\n';
        const result = patchLabeledSection(bio, 'Body', 'Elf with silver hair.', { isPc: true });
        expect(result.ok).toBe(true);
        expect(result.text).toMatch(/Body:\s*Elf with silver hair\./);
        expect(result.text).toContain('Personality: Curious.');
    });

    it('a Body update on a legacy (pre-split) entry patches the old combined header in place', () => {
        const bio = 'Appearance/Species: Tall human with short dark hair.\nPersonality: Stoic.\n';
        const result = patchLabeledSection(bio, 'Body', 'Tall human with a fresh scar across the left cheek.', { isPc: true });
        expect(result.ok).toBe(true);
        expect(result.text).toContain('Appearance/Species: Tall human with a fresh scar across the left cheek.');
        expect(result.text).not.toMatch(/\bBody:/);
    });

    it('isAppearanceField recognizes Body/legacy-Appearance aliases but not bare Species', () => {
        expect(isAppearanceField('Body')).toBe(true);
        expect(isAppearanceField('Appearance/Species')).toBe(true);
        expect(isAppearanceField('appearance')).toBe(true);
        expect(isAppearanceField('Species')).toBe(false);
        expect(isAppearanceField('Personality')).toBe(false);
    });

    it('isEquipmentField recognizes Worn Equipment/Equipment/gear/worn aliases', () => {
        expect(isEquipmentField('Equipment')).toBe(true);
        expect(isEquipmentField('Worn Equipment')).toBe(true);
        expect(isEquipmentField('gear')).toBe(true);
        expect(isEquipmentField('Worn Gear')).toBe(true);
        expect(isEquipmentField('Personality')).toBe(false);
    });

    it('isSpeciesField recognizes the standalone Species field only', () => {
        expect(isSpeciesField('Species')).toBe(true);
        expect(isSpeciesField('species')).toBe(true);
        expect(isSpeciesField('Body')).toBe(false);
        expect(isSpeciesField('Appearance/Species')).toBe(false);
    });
});

describe('router.js PC core-update wiring', () => {
    it('detects PC sentinels before lorebook resolution and routes to applyPcCoreUpdate', () => {
        expect(routerSource).toContain('function applyPcCoreUpdate(pc, field, content)');
        expect(routerSource).toContain('if (isPcCoreTarget(id, linkedPcName))');
        expect(routerSource).toContain('const pcResult = applyPcCoreUpdate(linkedPc, field, newContent)');
        expect(routerSource).toContain("PC updates are limited to Body and Worn Equipment");
    });

    it('resolves and persists the linked PC via the tracked chat, not stale ctx.chatId', () => {
        const linkedStart = routerSource.indexOf('function getLinkedPlayerCharacter()');
        const linkedEnd = routerSource.indexOf('\nfunction applyPcCoreUpdate(', linkedStart);
        expect(linkedStart).toBeGreaterThan(-1);
        expect(linkedEnd).toBeGreaterThan(linkedStart);
        const linked = routerSource.slice(linkedStart, linkedEnd);
        expect(linked).toContain('const chatId = getActiveChatId()');
        expect(linked).not.toContain('SillyTavern.getContext()?.chatId');

        const applyStart = routerSource.indexOf('function applyPcCoreUpdate(pc, field, content)');
        const applyEnd = routerSource.indexOf('\n/** Router guidance when ACTIVE COMBAT STATE is injected this turn.', applyStart);
        expect(applyStart).toBeGreaterThan(-1);
        expect(applyEnd).toBeGreaterThan(applyStart);
        const apply = routerSource.slice(applyStart, applyEnd);
        expect(apply).toContain('const chatId = getActiveChatId()');
        expect(apply).toContain('if (chatId) saveChatState(chatId)');
        expect(apply).not.toContain('SillyTavern.getContext()?.chatId');
    });

    it('commit.appearance/commit.equipment schemas accept PC sentinel ids', () => {
        expect(routerSource).toContain('or "{{user}}" / "player" / "pc" / PC name for the Player Character card');
        expect(routerSource).toContain('You may update the Player Character\'s own Body via');
        expect(routerSource).toContain('You may update the Player Character\'s own Worn Equipment via');
        expect(routerSource).toContain('commitProperties.equipment = {');
    });

    it('parses UPDATE_EQUIPMENT tags into action.equipment, mapped to field Worn Equipment', () => {
        expect(routerSource).toContain('const equipRegex = /\\[\\[UPDATE_EQUIPMENT:');
        expect(routerSource).toContain("action.equipment.push({ id, content })");
        expect(routerSource).toContain("...(action.equipment || []).map(item => ({ id: item.id, field: 'Worn Equipment', content: item.content }))");
    });

    it('module instructions allow PC Body/Worn Equipment updates without creating a PC lorebook entry', () => {
        expect(moduleInstrSource).toContain('[[UPDATE_APPEARANCE: {{user}} | new body text]]');
        expect(moduleInstrSource).toContain('[[UPDATE_EQUIPMENT: {{user}} | new worn gear text]]');
        expect(moduleInstrSource).toContain('never create a PC lorebook entry');
    });
});
