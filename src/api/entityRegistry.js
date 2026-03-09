/**
 * Entity Registry — Shared mutable object that breaks circular imports.
 *
 * base44Client.js WRITES to this registry after creating entities.
 * entities.js READS from this registry lazily (via Proxy getters).
 *
 * Neither base44Client nor entities import from each other through this file,
 * completely eliminating the TDZ race condition.
 */

export const _registry = {
  entities: null,
  auth: null,
};
