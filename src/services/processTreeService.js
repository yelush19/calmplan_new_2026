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

          // v3.4: Remove obsolete nodes (renamed/replaced)
          const OBSOLETE_NODES = ['P1_masav_authorities', 'P1_authorities_payment'];
          const removeObsolete = (nodes) => {
            if (!nodes) return nodes;
            return nodes
              .filter(n => !OBSOLETE_NODES.includes(n.id))
              .map(n => n.children?.length ? { ...n, children: removeObsolete(n.children) } : n);
          };
          for (const [branchId, branch] of Object.entries(merged.branches)) {
            merged.branches[branchId] = { ...branch, children: removeObsolete(branch.children) };
          }
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
 * Ensure MindMap custom_services / overrides are in sync with the current tree.
 * Called on page load to clean up stale entries from previous sessions.
 * Safe to call multiple times — skips if already synced this session.
 */
let _mindMapSyncDone = false;
export async function ensureMindMapSync() {
  if (_mindMapSyncDone) return;
  _mindMapSyncDone = true;
  const { tree } = await loadCompanyTree();
  if (tree) {
    try {
      await syncTreeToMindMap(tree);
      console.log('[ProcessTreeService] ✅ MindMap sync on load complete');
    } catch (err) {
      console.warn('[ProcessTreeService] MindMap sync on load failed:', err);
    }
  }
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
// SHARED SETTINGS SYNC — read/write arbitrary config keys
// ============================================================
// These use the same calmplan_system_config table to store
// service_overrides, custom_services, node_positions, etc.
// This is the SINGLE SOURCE OF TRUTH for settings data.

/**
 * Load a setting value from Supabase (calmplan_system_config table).
 * Handles both column schemas: `config_value` (Entity API) and `data` (direct Supabase).
 * Returns null if not found or Supabase unavailable.
 */
export async function loadSettingFromDb(key) {
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    const { data: rows, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('config_key', key)
      .limit(1);
    if (error) throw error;
    if (rows && rows.length > 0) {
      // Entity API uses config_value, direct Supabase uses data
      return rows[0].config_value ?? rows[0].data ?? null;
    }
    return null;
  } catch (err) {
    console.warn(`[ProcessTreeService] Failed to load setting "${key}":`, err.message);
    return null;
  }
}

/**
 * Save a setting value to Supabase (calmplan_system_config table).
 * Writes to BOTH config_value and data columns for compatibility.
 */
export async function syncSettingToDb(key, value) {
  const supabase = await getSupabase();
  if (!supabase) return;
  try {
    const now = new Date().toISOString();
    const { data: rows } = await supabase
      .from(TABLE)
      .select('id')
      .eq('config_key', key)
      .limit(1);
    const payload = { config_key: key, config_value: value, data: value, updated_date: now, updated_at: now };
    if (rows && rows.length > 0) {
      await supabase.from(TABLE).update(payload).eq('id', rows[0].id);
    } else {
      await supabase.from(TABLE).insert({ id: crypto.randomUUID(), ...payload, created_date: now });
    }
    console.log(`[ProcessTreeService] ✅ Setting "${key}" synced to DB`);
  } catch (err) {
    console.warn(`[ProcessTreeService] Failed to sync setting "${key}":`, err.message);
  }
}

// ============================================================
// GLOBAL TREE EVENT BUS — Single Source of Truth Broadcast
// ============================================================

/**
 * Event name for tree changes. All consumers MUST listen to this.
 * Payload: { tree, configId, source }
 */
export const TREE_CHANGED_EVENT = 'calmplan:tree-changed';

/**
 * Broadcast that the company tree has changed.
 * Every component that displays tree data should listen to this event
 * and re-fetch/re-render accordingly.
 *
 * @param {string} source - Who triggered the change (for logging)
 */
export function broadcastTreeChange(source = 'unknown') {
  console.log(`[ProcessTreeService] 📡 Broadcasting tree change from "${source}"`);
  window.dispatchEvent(new CustomEvent(TREE_CHANGED_EVENT, {
    detail: { tree: _cachedTree, configId: _cachedConfigId, source, timestamp: Date.now() },
  }));
  // Also trigger generic data-synced for pages using useRealtimeRefresh
  window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
    detail: { collection: 'system_config', source },
  }));
}

/**
 * Save the company tree AND broadcast the change globally.
 * This is the ONLY function that should be used for tree writes.
 * All UI components (Architect, MindMap, (+) button) must use this.
 *
 * @param {object} tree - The full tree to persist
 * @param {string|null} configId - Existing config record ID
 * @param {string} source - Who triggered the save (for logging)
 * @returns {{ tree, configId }} — the saved state
 */
export async function saveAndBroadcast(tree, configId, source = 'unknown') {
  const newConfigId = await saveCompanyTree(tree, configId);
  // Sync tree nodes → MindMap custom_services so the visual map reflects tree changes
  try {
    await syncTreeToMindMap(tree);
  } catch (err) {
    console.warn('[ProcessTreeService] MindMap sync failed (non-critical):', err);
  }
  broadcastTreeChange(source);
  return { tree, configId: newConfigId };
}

/**
 * Subscribe to tree changes. Returns an unsubscribe function.
 * Use in useEffect for automatic cleanup.
 *
 * @param {(detail: { tree, configId, source }) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onTreeChange(callback) {
  const handler = (e) => callback(e.detail);
  window.addEventListener(TREE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(TREE_CHANGED_EVENT, handler);
}

/**
 * Clean stale client process_tree entries.
 * Removes nodes/branches that no longer exist in the company tree.
 * Returns a cleaned copy (does NOT mutate the input).
 *
 * @param {object} clientProcessTree - client.process_tree map
 * @param {object} companyTree - The current company tree (from DB)
 * @returns {{ cleaned: object, removedKeys: string[] }}
 */
export function cleanStaleClientNodes(clientProcessTree, companyTree) {
  if (!clientProcessTree || !companyTree?.branches) {
    return { cleaned: clientProcessTree || {}, removedKeys: [] };
  }

  // Build set of all valid node IDs from company tree
  const validIds = new Set();
  const collectIds = (nodes) => {
    for (const n of (nodes || [])) {
      validIds.add(n.id);
      if (n.children?.length) collectIds(n.children);
    }
  };
  // Branch IDs are valid too
  for (const [branchId, branch] of Object.entries(companyTree.branches)) {
    validIds.add(branchId);
    collectIds(branch.children);
  }

  const cleaned = {};
  const removedKeys = [];
  for (const [key, val] of Object.entries(clientProcessTree)) {
    if (validIds.has(key)) {
      cleaned[key] = val;
    } else {
      removedKeys.push(key);
    }
  }

  if (removedKeys.length > 0) {
    console.log(`[ProcessTreeService] 🧹 Cleaned ${removedKeys.length} stale nodes from client tree:`, removedKeys);
  }

  return { cleaned, removedKeys };
}

// ============================================================
// SYNC TREE → MINDMAP CUSTOM SERVICES
// ============================================================

/**
 * Branch-to-dashboard mapping for MindMap integration.
 */
const BRANCH_TO_DASHBOARD = {
  P1: 'payroll',
  P2: 'tax',
  P3: 'admin',
  P4: 'home',
  P5: 'annual_reports',
};

function branchToDashboard(branchId) {
  return BRANCH_TO_DASHBOARD[branchId] || branchId; // P6+ use branchId directly
}

/**
 * Sync the process tree to MindMap's custom_services.
 * For each tree node that does NOT exist in ALL_SERVICES (processTemplates),
 * creates/updates a custom service entry so it appears on the visual map.
 *
 * Also syncs parentId relationships so the MindMap hierarchy matches the tree.
 *
 * @param {object} tree - The company process tree
 */
export async function syncTreeToMindMap(tree) {
  if (!tree?.branches) return;

  // Load existing templates to avoid duplicates
  let ALL_SERVICES = {};
  try {
    const templates = await import('@/config/processTemplates');
    ALL_SERVICES = templates.ALL_SERVICES || {};
  } catch { /* ok */ }

  // Load existing custom services
  let customServices = {};
  try {
    customServices = JSON.parse(localStorage.getItem('calmplan_custom_services') || '{}');
  } catch { /* ok */ }

  // Also load overrides to update parentId for template services
  let overrides = {};
  try {
    overrides = JSON.parse(localStorage.getItem('calmplan_service_overrides') || '{}');
  } catch { /* ok */ }

  let customChanged = false;
  let overridesChanged = false;

  // Collect all tree node keys for deletion detection
  const treeNodeKeys = new Set();

  // Walk tree and sync each node
  const syncNode = (node, branchId, parentNodeId) => {
    const dashboard = branchToDashboard(branchId);
    const serviceKey = node.service_key || node.id;
    treeNodeKeys.add(serviceKey);
    // Also track by node.id in case service_key differs
    if (node.id !== serviceKey) treeNodeKeys.add(node.id);

    if (ALL_SERVICES[serviceKey]) {
      // Template service — update override with correct parentId AND dashboard
      const currentParent = overrides[serviceKey]?.parentId;
      const currentDash = overrides[serviceKey]?.dashboard;
      const correctParent = parentNodeId || branchId;
      const needsUpdate = currentParent !== correctParent || currentDash !== dashboard || overrides[serviceKey]?._hidden;
      if (needsUpdate) {
        overrides[serviceKey] = {
          ...(overrides[serviceKey] || {}),
          parentId: correctParent,
          dashboard,
          _hidden: false, // un-hide if exists in tree
        };
        overridesChanged = true;
      }
    } else {
      // Custom/new node — ensure it exists in custom_services
      const existing = customServices[serviceKey];
      const svc = {
        key: serviceKey,
        label: node.label,
        dashboard,
        parentId: parentNodeId || branchId,
        taskCategories: [serviceKey],
        createCategory: serviceKey,
        steps: (node.steps || []).map(s => ({ key: s.key, label: s.label, icon: s.icon || 'circle' })),
        _source: 'process_tree',
        ...(existing || {}), // preserve any user customizations (positions, nextStepIds, etc.)
        // Always update these from tree:
        label: node.label,
        dashboard,
        parentId: parentNodeId || branchId,
      };
      if (!existing || existing.label !== svc.label || existing.parentId !== svc.parentId || existing.dashboard !== svc.dashboard) {
        customServices[serviceKey] = svc;
        customChanged = true;
      }
    }

    // Recurse into children
    for (const child of (node.children || [])) {
      syncNode(child, branchId, node.service_key || node.id);
    }
  };

  for (const [branchId, branch] of Object.entries(tree.branches)) {
    for (const node of (branch.children || [])) {
      syncNode(node, branchId, null);
    }
  }

  // CLEANUP: Remove custom_services that no longer belong
  for (const [key, svc] of Object.entries(customServices)) {
    // 1. Remove tree-sourced nodes that were deleted from tree
    if (svc._source === 'process_tree' && !treeNodeKeys.has(key)) {
      console.log(`[syncTreeToMindMap] 🧹 Removing deleted tree node "${key}" from custom_services`);
      delete customServices[key];
      customChanged = true;
      continue;
    }
    // 2. Remove custom services whose parentId references a deleted node
    //    (orphan services pointing to a node that no longer exists in the tree)
    if (svc.parentId && !treeNodeKeys.has(svc.parentId) && !['P1','P2','P3','P4','P5'].includes(svc.parentId)
        && !svc.parentId.startsWith('P') /* don't remove P6+ branch refs */) {
      console.log(`[syncTreeToMindMap] 🧹 Removing orphan custom service "${key}" (parent "${svc.parentId}" deleted)`);
      delete customServices[key];
      customChanged = true;
      continue;
    }
    // 3. Remove custom services that duplicate a template service key
    if (ALL_SERVICES[key]) {
      console.log(`[syncTreeToMindMap] 🧹 Removing duplicate custom service "${key}" (exists in templates)`);
      delete customServices[key];
      customChanged = true;
    }
  }

  // CLEANUP: Hide template services that were previously synced by tree but are no longer in it.
  // Only hides templates that have existing overrides (meaning they were managed by tree sync).
  for (const [key] of Object.entries(ALL_SERVICES)) {
    if (treeNodeKeys.has(key)) continue; // still in tree — skip
    if (overrides[key]?._hidden) continue; // already hidden — skip
    // Hide if previously managed by tree sync (has parentId or dashboard override)
    if (overrides[key]?.parentId || overrides[key]?.dashboard) {
      overrides[key] = { ...(overrides[key] || {}), _hidden: true };
      overridesChanged = true;
      console.log(`[syncTreeToMindMap] 🧹 Hiding deleted template service "${key}"`);
    }
  }

  // Persist changes
  if (customChanged) {
    localStorage.setItem('calmplan_custom_services', JSON.stringify(customServices));
    await syncSettingToDb('custom_services', customServices);
    console.log('[ProcessTreeService] ✅ Synced tree nodes → MindMap custom_services');
  }
  if (overridesChanged) {
    localStorage.setItem('calmplan_service_overrides', JSON.stringify(overrides));
    await syncSettingToDb('service_overrides', overrides);
    console.log('[ProcessTreeService] ✅ Synced tree parentIds → MindMap overrides');
  }
}

// ============================================================
// ADD NODE TO COMPANY TREE — from client card or external source
// ============================================================

/**
 * Add a new node to the company tree and save+broadcast.
 * Used when a client card creates a custom process that needs to exist
 * in the system-wide tree.
 *
 * @param {string} branchId - Target branch (e.g., 'P1', 'P2')
 * @param {string} parentNodeId - Parent node ID (null = add to branch root)
 * @param {{ label: string, id?: string }} nodeData - New node definition
 * @param {string} source - Who triggered the add
 * @returns {{ tree, configId, newNodeId }} — saved state + new node ID
 */
export async function addNodeToCompanyTree(branchId, parentNodeId, nodeData, source = 'unknown') {
  const { tree, configId } = await loadCompanyTree();
  if (!tree?.branches?.[branchId]) {
    throw new Error(`Branch "${branchId}" not found in company tree`);
  }

  const newNodeId = nodeData.id || `${branchId}_custom_${Date.now()}`;
  const newNode = {
    id: newNodeId,
    label: nodeData.label,
    service_key: newNodeId,
    is_parent_task: false,
    default_frequency: nodeData.default_frequency || 'monthly',
    frequency_field: null,
    frequency_fallback: null,
    frequency_inherit: !!parentNodeId,
    depends_on: parentNodeId ? [parentNodeId] : [],
    execution: 'sequential',
    is_collector: false,
    children: [],
    steps: [],
    ...(nodeData.extra_fields ? { extra_fields: nodeData.extra_fields } : {}),
  };

  const updatedTree = { ...tree, branches: { ...tree.branches } };
  const branch = { ...updatedTree.branches[branchId] };

  if (parentNodeId) {
    // Add as child of specific parent node (deep)
    const addToParent = (nodes) =>
      nodes.map(n => {
        if (n.id === parentNodeId) {
          return { ...n, children: [...(n.children || []), newNode] };
        }
        if (n.children?.length) {
          return { ...n, children: addToParent(n.children) };
        }
        return n;
      });
    branch.children = addToParent(branch.children);
  } else {
    // Add to branch root
    branch.children = [...(branch.children || []), newNode];
  }

  updatedTree.branches[branchId] = branch;

  const result = await saveAndBroadcast(updatedTree, configId, source);
  return { ...result, newNodeId };
}

/**
 * Update a node's properties in the company tree (DB).
 * Supports updating steps, label, or any other node property.
 * Changes are saved to DB and broadcasted to all consumers.
 *
 * @param {string} nodeId - The node ID to update
 * @param {object} updates - Properties to merge into the node (e.g., { steps, label })
 * @param {string} source - Source identifier for broadcast
 */
export async function updateNodeInCompanyTree(nodeId, updates, source = 'unknown') {
  invalidateTreeCache();
  const { tree, configId } = await loadCompanyTree();
  if (!tree?.branches) throw new Error('Company tree not found');

  const updatedTree = { ...tree, branches: { ...tree.branches } };
  let found = false;

  const updateInChildren = (nodes) =>
    nodes.map(n => {
      if (n.id === nodeId) {
        found = true;
        return { ...n, ...updates };
      }
      if (n.children?.length) {
        return { ...n, children: updateInChildren(n.children) };
      }
      return n;
    });

  for (const [branchId, branch] of Object.entries(updatedTree.branches)) {
    const updated = updateInChildren(branch.children || []);
    updatedTree.branches[branchId] = { ...branch, children: updated };
    if (found) break;
  }

  if (!found) throw new Error(`Node "${nodeId}" not found in company tree`);
  return saveAndBroadcast(updatedTree, configId, source);
}

/**
 * Move a node within the company tree (reorder or reparent).
 * Removes from old location and inserts at new location.
 *
 * @param {string} nodeId - Node to move
 * @param {string} newParentId - New parent node ID (or branch ID for root-level)
 * @param {number|null} insertIndex - Position in parent's children (null = append)
 * @param {string} source - Source identifier for broadcast
 */
export async function moveNodeInCompanyTree(nodeId, newParentId, insertIndex = null, source = 'unknown') {
  invalidateTreeCache();
  const { tree, configId } = await loadCompanyTree();
  if (!tree?.branches) throw new Error('Company tree not found');

  const updatedTree = { ...tree, branches: { ...tree.branches } };

  // Step 1: Extract the node (remove from old location)
  let extractedNode = null;
  const removeFromChildren = (nodes) =>
    nodes.filter(n => {
      if (n.id === nodeId) { extractedNode = n; return false; }
      return true;
    }).map(n => n.children?.length ? { ...n, children: removeFromChildren(n.children) } : n);

  for (const [branchId, branch] of Object.entries(updatedTree.branches)) {
    updatedTree.branches[branchId] = { ...branch, children: removeFromChildren(branch.children || []) };
    if (extractedNode) break;
  }

  if (!extractedNode) throw new Error(`Node "${nodeId}" not found`);

  // Step 2: Insert at new location
  // Check if newParentId is a branch root
  if (updatedTree.branches[newParentId]) {
    const branch = { ...updatedTree.branches[newParentId] };
    const children = [...(branch.children || [])];
    if (insertIndex !== null && insertIndex >= 0) {
      children.splice(insertIndex, 0, extractedNode);
    } else {
      children.push(extractedNode);
    }
    branch.children = children;
    updatedTree.branches[newParentId] = branch;
  } else {
    // Insert under a specific parent node (deep)
    let inserted = false;
    const insertIntoParent = (nodes) =>
      nodes.map(n => {
        if (n.id === newParentId && !inserted) {
          inserted = true;
          const children = [...(n.children || [])];
          if (insertIndex !== null && insertIndex >= 0) {
            children.splice(insertIndex, 0, extractedNode);
          } else {
            children.push(extractedNode);
          }
          return { ...n, children };
        }
        if (n.children?.length) return { ...n, children: insertIntoParent(n.children) };
        return n;
      });

    for (const [branchId, branch] of Object.entries(updatedTree.branches)) {
      updatedTree.branches[branchId] = { ...branch, children: insertIntoParent(branch.children || []) };
      if (inserted) break;
    }

    if (!inserted) throw new Error(`Target parent "${newParentId}" not found`);
  }

  return saveAndBroadcast(updatedTree, configId, source);
}

/**
 * Check which client tree node IDs don't exist in the company tree.
 * Returns the list of orphan node IDs.
 *
 * @param {object} clientProcessTree - client.process_tree map
 * @param {object} companyTree - The current company tree
 * @returns {string[]} orphan node IDs
 */
export function findOrphanClientNodes(clientProcessTree, companyTree) {
  if (!clientProcessTree || !companyTree?.branches) return [];

  const validIds = new Set();
  const collectIds = (nodes) => {
    for (const n of (nodes || [])) {
      validIds.add(n.id);
      if (n.children?.length) collectIds(n.children);
    }
  };
  for (const [branchId, branch] of Object.entries(companyTree.branches)) {
    validIds.add(branchId);
    collectIds(branch.children);
  }

  return Object.keys(clientProcessTree).filter(key => !validIds.has(key));
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
