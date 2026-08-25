import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { findMostRecentNarratorMessage, stripCyoaChoiceBlocks } from '../src/state/present-now.js';

describe('findMostRecentNarratorMessage', () => {
    it('skips a trailing user message and keeps the previous narrator output', () => {
        const chat = [
            { is_user: false, mes: 'Megumi waits in the office.' },
            { is_user: true, mes: '*heads to the guidance office*' },
        ];
        expect(findMostRecentNarratorMessage(chat)?.mes).toBe('Megumi waits in the office.');
    });

    it('returns the latest assistant message when that is the tail', () => {
        const chat = [
            { is_user: true, mes: 'I look around.' },
            { is_user: false, mes: 'Darukawa Megumi looks up from her desk.' },
        ];
        expect(findMostRecentNarratorMessage(chat)?.mes).toBe('Darukawa Megumi looks up from her desk.');
    });

    it('skips system, hidden, and summary messages', () => {
        const chat = [
            { is_user: false, mes: 'Keep this narrator beat.' },
            { is_system: true, mes: 'system note' },
            { is_user: false, is_hidden: true, mes: 'hidden swipe' },
            { is_user: false, extra: { is_summary: true }, mes: 'Summary of past events.' },
            { is_user: true, mes: 'continue' },
        ];
        expect(findMostRecentNarratorMessage(chat)?.mes).toBe('Keep this narrator beat.');
    });

    it('returns null when the chat has no narrator output', () => {
        expect(findMostRecentNarratorMessage([{ is_user: true, mes: 'hello' }])).toBeNull();
        expect(findMostRecentNarratorMessage([])).toBeNull();
        expect(findMostRecentNarratorMessage(null)).toBeNull();
    });
});

describe('stripCyoaChoiceBlocks', () => {
    const choiceBlock = `<choices>
<button>1. 🧤 Wrap your hands in thick hide from your pack, speak "Nul-Zund," and lift the Ember-Core with two steady hands — [Performance (+10) DC 14 to invoke the ancestral command word with proper resonance]</button>
<button>2. 🗣️ Call up the chimney to Seraphina and the brothers, reporting the Ember-Core is calm and you're ready to lift it</button>
<button>3. 🔍 Study the black-glass cradle's cracks one final time to ensure lifting the core won't shatter it — [Investigation (+2: Jack of All Trades) DC 12]</button>
<button>4. 🪢 Tie the safety rope around your waist before handling the core, so Torvin can haul you back if anything goes wrong</button>
<button>5. 🎵 Continue the hearth-hymn in a low, sustained drone while reaching for the core, maintaining the calm through the act of lifting</button>
</choices>`;

    it('drops names that appear only inside CYOA choice blocks', () => {
        const narrative = 'The Ember-Core pulses in the cradle. You steady your breath.';
        const stripped = stripCyoaChoiceBlocks(`${narrative}\n${choiceBlock}`);
        expect(stripped).toContain('The Ember-Core pulses in the cradle.');
        expect(stripped).not.toContain('Seraphina');
        expect(stripped).not.toContain('Torvin');
        expect(stripped).not.toContain('<choices>');
        expect(stripped).not.toContain('<button>');
    });

    it('keeps a name that also appears in the narrative prose', () => {
        const narrative = 'Seraphina leans over the flue, waiting for your call.';
        const stripped = stripCyoaChoiceBlocks(`${narrative}\n${choiceBlock}`);
        expect(stripped).toContain('Seraphina leans over the flue');
        expect(stripped).not.toContain('Torvin');
    });

    it('strips leftover button tags when the choices wrapper is missing', () => {
        const stripped = stripCyoaChoiceBlocks(
            'You reach for the core.\n<button>1. Call up to Seraphina</button>\n<button>2. Tie a rope for Torvin</button>',
        );
        expect(stripped).toBe('You reach for the core.');
        expect(stripped).not.toContain('Seraphina');
        expect(stripped).not.toContain('Torvin');
    });
});

describe('Present Now scanner wiring', () => {
    it('reads narrator text via findMostRecentNarratorMessage and does not stop at user turns', () => {
        const router = readFileSync(new URL('../router.js', import.meta.url), 'utf8');
        expect(router).toContain("import { findMostRecentNarratorMessage, stripCyoaChoiceBlocks } from './src/state/present-now.js'");
        expect(router).toContain('findMostRecentNarratorMessage(chat, { includeHidden })');
        expect(router).toContain('stripCyoaChoiceBlocks');
        expect(router).not.toContain('if (msg.is_user) break');
        expect(router).toContain('User messages are never scanned');
    });
});
