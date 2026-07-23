/**
 * state-manager.js — Multihog D&D Framework
 * Public barrel for game state schema, defaults, persistence, migration, and profile I/O.
 * Implementation lives under src/state/; consumers keep importing from this file.
 *
 * Imports: src/state/* (settings.js binds getSettings into settings-ref)
 * Imported by: virtually everything — the root dependency.
 */

export * from './src/state/schema-sections.js';
export * from './src/state/versions.js';
export * from './src/state/relationship-math.js';
export * from './src/state/relationship-dom.js';
export * from './src/state/relationship-prompts.js';
export * from './src/state/relationship-commands.js';
export * from './src/state/portrait-prompts.js';
export * from './src/state/module-instructions.js';
export * from './src/state/default-modules.js';
export * from './src/state/defaults.js';
export * from './src/state/factory-and-diff.js';
export * from './src/state/settings.js';
export * from './src/state/chat-persistence.js';
export * from './src/state/profiles.js';
export * from './src/state/router-utils.js';
