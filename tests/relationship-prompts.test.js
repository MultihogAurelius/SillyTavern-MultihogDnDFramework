import { describe, expect, it } from 'vitest';
import {
    buildRelationshipTrackingSysprompt,
    buildStateTrackerRelationshipCommandInstruction,
    shouldProcessRegexRelationshipUpdates,
} from '../src/state/relationship-prompts.js';

describe('narrator relationship_tracking sysprompt', () => {
    it('interpolates the configured scale instead of a hardcoded ±200', () => {
        const prompt = buildRelationshipTrackingSysprompt(80);
        expect(prompt).toContain('Scale: -80 (deep hostility) to +80 (deep bond)');
        expect(prompt).toContain('clamped to ±80');
        expect(prompt).not.toContain('-200');
        expect(prompt).not.toContain('+200');
        expect(prompt).toContain("Use the NPC's injected permanent profile");
        expect(prompt).toContain('*(Friendship: Horgath the Warrior -7 — showed disrespect toward self-sacrifice)*');
        expect(prompt).toContain('Affection is not necessarily limited to explicitly romantic actions.');
    });
});

describe('State Tracker relationship instruction', () => {
    it('uses the built-in instruction when no custom instruction is configured', () => {
        const instruction = buildStateTrackerRelationshipCommandInstruction(100, false);
        expect(instruction).toContain('RELATIONSHIP DELTA COMMANDS');
        expect(instruction).toContain("intent to award relationship points is clear");
    });

    it('uses a custom instruction and resolves its supported placeholders', () => {
        const prompt = 'Scale: {{max}}. Rule: {{full_audit_rule}}';
        expect(buildStateTrackerRelationshipCommandInstruction(75, true, prompt)).toBe(
            'Scale: 75. Rule: This is a full-history audit, so do not emit a [RELATIONS] block. Do not replay historical relationship changes.',
        );
    });

    it('keeps chat-regex updates active while both agents are paused', () => {
        expect(shouldProcessRegexRelationshipUpdates({
            enabled: true,
            paused: true,
            routerPaused: true,
            npcRelationshipBars: true,
            npcRelationshipUpdateMode: 'regex',
        })).toBe(true);
    });

    it('does not turn tracker-based relationship updates into a paused regex pass', () => {
        expect(shouldProcessRegexRelationshipUpdates({
            enabled: true,
            paused: true,
            routerPaused: true,
            npcRelationshipBars: true,
            npcRelationshipUpdateMode: 'state_tracker',
        })).toBe(false);
    });
});
