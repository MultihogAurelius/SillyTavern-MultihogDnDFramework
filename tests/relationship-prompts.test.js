import { describe, expect, it } from 'vitest';
import { buildStateTrackerRelationshipCommandInstruction } from '../src/state/relationship-prompts.js';

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
});
