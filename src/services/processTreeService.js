/**
 * Process Tree Service — DB Adapter
 *
 * "Read from DB, Seed from Config" pattern:
 *   1. loadCompanyTree() — reads from SystemConfig (DB).
 *      If not found, writes SEED to DB and returns it.
 *   2. saveCompanyTree() — persists updated tree to DB.
 *   3. resolveFrequency() — walks the inheritance chain for a client+node.
 *
 * This service does NOT touch any existing engines or UI.
 * It is a standalone adapter layer between the Process Tree and the DB.
 */

import {
  PROCESS_TREE_SEED,
  FULL_SERVICE_NODES,
  buildNodeMap,
  flattenTree,
} from '@/config/companyProcessTree';

// ============================================================
// DB ACCESS — Direct Supabase on calmplan_system_config table
// ============================================================
//
// The SystemConfig entity writes to the generic `app_data` table,
// but the dedicated `calmplan_system_config` table is where the
// user expects to see config data. We bypass the entity layer
// and write directly to the dedicated table.

const TABLE = 'calmplan_system_config';
const CONFIG_KEY = 'company_process_tree';

/** Lazy import of the raw Supabase client */
let _supabase = null;
async function getSupabase() {
  if (!_supabase) {
    const { supabase, isSupabaseAvailable } = await import('@/api/supabaseClient');
    if (!isSupabaseAvailable()) {
      console.warn('[ProcessTreeService] Supabase not available — using seed only');
      return null;
    }
    _supabase = supabase;
  }
  return _supabase;
}

// ============================================================
// COMPANY TREE — load / save
// ============================================================

/** In-memory cache to avoid repeated DB reads within a session */
let _cachedTree = null;
let _cachedConfigId = null;

/**
 * Load the company process tree from DB (calmplan_system_config table).
 * Falls back to SEED on first run (and writes it to DB).
 *
 * @returns {{ tree: object, configId: string|null }}
 */
export async function loadCompanyTree() {
  // Return cache if available
  if (_cachedTree) {
    return { tree: _cachedTree, configId: _cachedConfigId };
  }

  const supabase = await getSupabase();

  if (supabase) {
    try {
      // Read from dedicated table
      const { data: rows, error: readErr } = await supabase
        .from(TABLE)
        .select('*')
        .eq('config_key', CONFIG_KEY)
        .limit(1);

      if (readErr) {
        console.error('[ProcessTreeService] DB read error:', readErr);
        throw readErr;
      }

      if (rows && rows.length > 0 && rows[0].data?.tree) {
        const dbTree = rows[0].data.tree;
        const dbVersion = dbTree.version || '1.0';
        const seedVersion = PROCESS_TREE_SEED.version || '2.0';

        // If DB version is behind the seed, merge new branches/nodes into existing tree
        if (dbVersion < seedVersion) {
          console.log(`[ProcessTreeService] Upgrading tree ${dbVersion} → ${seedVersion}`);
          const merged = { ...dbTree, version: seedVersion };
          // Merge seed branches: add missing branches AND update existing ones with new children
          for (const [branchId, seedBranch] of Object.entries(PROCESS_TREE_SEED.branches)) {
            if (!merged.branches[branchId]) {
              // Brand new branch — add it whole
              merged.branches[branchId] = seedBranch;
            } else {
              // Existing branch — merge new children that don't exist yet
              const existingIds = new Set();
              const collectIds = (nodes) => {
                for (const n of (nodes || [])) {
                  existingIds.add(n.id);
                  if (n.children?.length) collectIds(n.children);
                }
              };
              collectIds(merged.branches[branchId].children);

              // Deep-merge: add missing children from seed into existing branch
              const mergeChildren = (existing, seedChildren) => {
                const result = [...existing];
                for (const seedChild of seedChildren) {
                  if (!existingIds.has(seedChild.id)) {
                    result.push(seedChild);
                  } else {
                    // Node exists — check if seed has new children to merge
                    const idx = result.findIndex(n => n.id === seedChild.id);
                    if (idx >= 0 && seedChild.children?.length) {
                      result[idx] = {
                        ...result[idx],
                        children: mergeChildren(result[idx].children || [], seedChild.children),
                      };
                    }
                  }
                }
                return result;
              };

              merged.branches[branchId] = {
                ...merged.branches[branchId],
                children: mergeChildren(
                  merged.branches[branchId].children || [],
                  seedBranch.children || []
                ),
              };
            }
          }
          // Persist the upgrade
          const { error: upErr } = await supabase
            .from(TABLE)
            .update({ data: { tree: merged }, updated_date: new Date().toISOString() })
            .eq('id', rows[0].id);
          if (upErr) console.warn('[ProcessTreeService] Version upgrade write failed:', upErr);

          _cachedTree = merged;
          _cachedConfigId = rows[0].id;
          return { tree: _cachedTree, configId: _cachedConfigId };
        }

        _cachedTree = dbTree;
        _cachedConfigId = rows[0].id;
        console.log('[ProcessTreeService] ✅ Loaded tree from DB, configId:', _cachedConfigId);
        return { tree: _cachedTree, configId: _cachedConfigId };
      }

      // First run — seed to DB
      console.log('[ProcessTreeService] No tree in DB — seeding...');
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const { data: inserted, error: insertErr } = await supabase
        .from(TABLE)
        .insert({
          id,
          config_key: CONFIG_KEY,
          data: { tree: PROCESS_TREE_SEED },
          created_date: now,
          updated_date: now,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[ProcessTreeService] DB insert error:', insertErr);
        throw insertErr;
      }

      _cachedTree = PROCESS_TREE_SEED;
      _cachedConfigId = inserted.id;
      console.log('[ProcessTreeService] ✅ Seeded tree to DB, configId:', _cachedConfigId);
      return { tree: _cachedTree, configId: _cachedConfigId };
    } catch (err) {
      console.error('[ProcessTreeService] DB error, falling back to seed:', err);
    }
  }

  // Fallback: return seed without persisting
  _cachedTree = PROCESS_TREE_SEED;
  return { tree: _cachedTree, configId: null };
}

/**
 * Save the company process tree to DB.
 * Updates the existing config record or creates a new one.
 *
 * @param {object} tree - The full tree object to persist
 * @param {string|null} configId - Existing config record ID (from loadCompanyTree)
 * @returns {string|null} configId
 */
export async function saveCompanyTree(tree, configId) {
  const supabase = await getSupabase();
  if (!supabase) {
    console.warn('[ProcessTreeService] Cannot save — Supabase not available');
    return null;
  }

  try {
    const now = new Date().toISOString();

    if (configId) {
      const { error } = await supabase
        .from(TABLE)
        .update({ data: { tree }, updated_date: now })
        .eq('id', configId);

      if (error) throw error;
    } else {
      const id = crypto.randomUUID();
      const { data: inserted, error } = await supabase
        .from(TABLE)
        .insert({
          id,
          config_key: CONFIG_KEY,
          data: { tree },
          created_date: now,
          updated_date: now,
        })
        .select()
        .single();

      if (error) throw error;
      configId = inserted.id;
    }

    // Update cache
    _cachedTree = tree;
    _cachedConfigId = configId;
    return configId;
  } catch (err) {
    console.error('[ProcessTreeService] Error saving tree:', err);
    throw err;
  }
}

/**
 * Invalidate the in-memory cache (e.g., after external DB changes).
 */
export function invalidateTreeCache() {
  _cachedTree = null;
  _cachedConfigId = null;
}

// ============================================================
// FREQUENCY RESOLUTION
// ============================================================

/**
 * Resolve the effective frequency for a node in a client's process tree.
 *
 * Resolution chain:
 *   1. Client override:   client.process_tree[nodeId].frequency
 *   2. Reporting info:    client.reporting_info[node.frequency_field]
 *   3. Fallback field:    client.reporting_info[node.frequency_fallback]
 *   4. Parent inherit:    if node.frequency_inherit → recurse to parent
 *   5. Default:           node.default_frequency from company tree
 *
 * @param {string} nodeId - The tree node ID
 * @param {object} client - Client entity (with process_tree, reporting_info)
 * @param {object} companyTree - The company process tree
 * @returns {string} frequency value (e.g., 'monthly', 'bimonthly', 'not_applicable')
 */
export function resolveFrequency(nodeId, client, companyTree) {
  const nodeMap = buildNodeMap(companyTree);
  const reportingInfo = client?.reporting_info || {};
  const clientTree = client?.process_tree || {};

  function resolve(nId, visited) {
    // Guard against circular references
    if (visited.has(nId)) return 'monthly';
    visited.add(nId);

    const nodeConfig = nodeMap[nId];
    if (!nodeConfig) return 'monthly';

    // 1. Client-level override
    const clientOverride = clientTree[nId]?.frequency;
    if (clientOverride && clientOverride !== 'inherit') {
      return clientOverride;
    }

    // 2. Client reporting_info — frequency_field
    if (nodeConfig.frequency_field) {
      const fromReporting = reportingInfo[nodeConfig.frequency_field];
      if (fromReporting && fromReporting !== 'not_applicable') {
        return fromReporting;
      }
      // If reporting says not_applicable, honor it
      if (fromReporting === 'not_applicable') {
        return 'not_applicable';
      }
    }

    // 3. Client reporting_info — frequency_fallback
    if (nodeConfig.frequency_fallback) {
      const fromFallback = reportingInfo[nodeConfig.frequency_fallback];
      if (fromFallback && fromFallback !== 'not_applicable') {
        return fromFallback;
      }
      if (fromFallback === 'not_applicable') {
        return 'not_applicable';
      }
    }

    // 4. Inherit from parent
    if (nodeConfig.frequency_inherit && nodeConfig.parent_id) {
      return resolve(nodeConfig.parent_id, visited);
    }

    // 5. Default from tree definition
    return nodeConfig.default_frequency || 'monthly';
  }

  return resolve(nodeId, new Set());
}

// ============================================================
// FREQUENCY CHECK — should a task be injected this month?
// ============================================================

/**
 * Check if a node should generate a task for a given month.
 *
 * @param {string} frequency - resolved frequency
 * @param {number} month - 1-indexed month (1=Jan, 12=Dec)
 * @returns {boolean}
 */
export function shouldInjectForMonth(frequency, month) {
  switch (frequency) {
    case 'not_applicable':
      return false;
    case 'monthly':
      return true;
    case 'bimonthly':
      // Even months: 2,4,6,8,10,12
      return month % 2 === 0;
    case 'quarterly':
      // 3,6,9,12
      return month % 3 === 0;
    case 'semi_annual':
      // 6,12
      return month === 6 || month === 12;
    case 'yearly':
      // Once per year — handled by annual engine, always eligible
      return true;
    default:
      return true;
  }
}

// ============================================================
// CLIENT PROCESS TREE HELPERS
// ============================================================

/**
 * Check if a node is enabled for a client.
 *
 * @param {object} clientProcessTree - client.process_tree map
 * @param {string} nodeId - node ID to check
 * @returns {boolean}
 */
export function isNodeEnabled(clientProcessTree, nodeId) {
  return clientProcessTree?.[nodeId]?.enabled === true;
}

/**
 * Get all enabled node IDs for a client.
 *
 * @param {object} clientProcessTree - client.process_tree map
 * @returns {string[]}
 */
export function getEnabledNodeIds(clientProcessTree) {
  if (!clientProcessTree) return [];
  return Object.entries(clientProcessTree)
    .filter(([, val]) => val?.enabled === true)
    .map(([key]) => key);
}

/**
 * Apply "Full Service" magic — enables all FULL_SERVICE_NODES.
 * Preserves existing overrides (frequency, sla_days) on nodes that are already configured.
 *
 * @param {object} currentTree - client.process_tree (may be empty or partial)
 * @returns {object} updated process_tree
 */
export function applyFullService(currentTree = {}) {
  const result = { ...currentTree };
  for (const nodeId of FULL_SERVICE_NODES) {
    result[nodeId] = {
      ...result[nodeId],
      enabled: true,
    };
  }
  return result;
}

/**
 * Toggle a node's enabled state. Also handles parent/child cascading:
 *   - Enabling a child auto-enables its parent (you can't have a child without a parent)
 *   - Disabling a parent auto-disables all its children
 *
 * @param {object} clientTree - client.process_tree
 * @param {string} nodeId - node to toggle
 * @param {boolean} enabled - new state
 * @param {object} companyTree - the company tree (for hierarchy lookup)
 * @returns {object} updated process_tree
 */
export function toggleNode(clientTree, nodeId, enabled, companyTree) {
  const result = { ...clientTree };
  const nodeMap = buildNodeMap(companyTree);

  // Set the target node
  result[nodeId] = { ...result[nodeId], enabled };

  if (enabled) {
    // Auto-enable all ancestors
    let current = nodeMap[nodeId];
    while (current?.parent_id && nodeMap[current.parent_id]) {
      const parentId = current.parent_id;
      // Don't override branch-level IDs (P1, P2, etc.)
      if (nodeMap[parentId]) {
        result[parentId] = { ...result[parentId], enabled: true };
      }
      current = nodeMap[parentId];
    }
  } else {
    // Auto-disable all descendants
    const allNodes = flattenTree(companyTree);
    const toDisable = new Set([nodeId]);
    // BFS: find all descendants
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of allNodes) {
        if (!toDisable.has(n.id) && toDisable.has(n.parent_id)) {
          toDisable.add(n.id);
          changed = true;
        }
      }
    }
    for (const id of toDisable) {
      result[id] = { ...result[id], enabled: false };
    }
  }

  return result;
}
