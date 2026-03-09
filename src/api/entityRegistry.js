/**
 * Entity Registry — Shared mutable singleton that breaks circular imports.
 *
 * CRITICAL: Uses globalThis to guarantee the registry object exists BEFORE
 * any module evaluation, regardless of how the bundler (Vite/Rollup) reorders
 * module initialization in minified production builds.
 *
 * Without globalThis, the `const _registry` export can cause
 * "Cannot access 'O' before initialization" in minified code because
 * the bundler may try to access _registry before this module finishes
 * evaluating.
 *
 * base44Client.js WRITES to this registry after creating entities.
 * entities.js READS from this registry lazily (via Proxy getters).
 */

// Attach to globalThis so it's available even if this module
// hasn't finished evaluating when another module accesses it.
if (!globalThis.__calmplan_registry) {
  globalThis.__calmplan_registry = { entities: null, auth: null };
}

export const _registry = globalThis.__calmplan_registry;
