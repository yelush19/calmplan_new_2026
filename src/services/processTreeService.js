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
let _lastSyncResult = { updatedCount: 0, errors: [] };

/** Get the result of the last syncCompanyTreeToClients run */
export function getLastSyncResult() { return _lastSyncResult; }

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

        // If DB version is behind the seed, upgrade
        if (dbVersion < seedVersion) {
          console.log(`[ProcessTreeService] Upgrading tree ${dbVersion} → ${seedVersion}`);

          // V4.0 is a FULL RESTRUCTURE — nodes became steps, hierarchy changed.
          // Merging would create duplicates (old V3.5 nodes + new V4.0 nodes).
          // Force-replace with the clean V4.0 SEED.
          // Any user-created branches (P6+) that don't exist in seed are preserved.
          const upgraded = JSON.parse(JSON.stringify(PROCESS_TREE_SEED));

          // Preserve user-created dynamic branches (P6, P7, ...) from old tree
          if (dbTree.branches) {
            for (const [branchId, branch] of Object.entries(dbTree.branches)) {
              if (!upgraded.branches[branchId]) {
                upgraded.branches[branchId] = branch;
                console.log(`[ProcessTreeService] Preserved user branch: ${branchId}`);
              }
            }
          }

          // Persist the upgrade
          const { error: upErr } = await supabase
            .from(TABLE)
            .update({ data: { tree: upgraded }, updated_date: new Date().toISOString() })
            .eq('id', rows[0].id);
          if (upErr) console.warn('[ProcessTreeService] Version upgrade write failed:', upErr);
          else console.log('[ProcessTreeService] V4.0 tree written to DB (full replace)');

          _cachedTree = upgraded;
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
      return rows[0].data ?? rows[0].config_value ?? null;
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
    // Use only columns known to exist: id, config_key, data, created_date, updated_date
    if (rows && rows.length > 0) {
      const { error } = await supabase.from(TABLE)
        .update({ data: value, updated_date: now })
        .eq('id', rows[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(TABLE)
        .insert({ id: crypto.randomUUID(), config_key: key, data: value, created_date: now, updated_date: now });
      if (error) throw error;
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
  // Sync tree structure changes to all clients (auto-enable new children, clean stale)
  let syncResult = { updatedCount: 0, errors: [] };
  try {
    syncResult = await syncCompanyTreeToClients(tree);
  } catch (err) {
    console.error('[ProcessTreeService] Client tree sync failed:', err);
    syncResult = { updatedCount: 0, errors: ['sync-crash'] };
  }
  // Attach sync result to broadcast so UI can show toast
  _lastSyncResult = syncResult;
  broadcastTreeChange(source);
  return { tree, configId: newConfigId };
}

/**
 * Sync company tree structure changes to ALL clients.
 * When the company tree changes (nodes added/moved/deleted):
 *   - New child nodes under an enabled parent → auto-enabled for client
 *   - Deleted nodes → removed from client tree
 *   - Steps changes → inherited automatically (steps live in company tree, not client tree)
 *
 * @param {object} companyTree - The current company tree
 * @returns {{ updatedCount: number }} - how many clients were updated
 */
export async function syncCompanyTreeToClients(companyTree) {
  if (!companyTree?.branches) return { updatedCount: 0 };

  // Lazy-import Client entity to avoid circular deps
  const { Client } = await import('@/api/entities');
  const clients = await Client.list(null, 5000).catch(() => []);
  if (!clients || clients.length === 0) return { updatedCount: 0 };

  // Build a parent→children map from company tree
  const parentChildMap = {};  // parentId → [childId, ...]
  const allNodeIds = new Set();
  const walkTree = (nodes, parentId) => {
    for (const n of (nodes || [])) {
      allNodeIds.add(n.id);
      if (!parentChildMap[parentId]) parentChildMap[parentId] = [];
      parentChildMap[parentId].push(n.id);
      if (n.children?.length) walkTree(n.children, n.id);
    }
  };
  for (const [branchId, branch] of Object.entries(companyTree.branches)) {
    allNodeIds.add(branchId);
    walkTree(branch.children, branchId);
  }

  let updatedCount = 0;
  const errors = [];

  for (const client of clients) {
    const clientTree = client.process_tree;
    // Skip only null/undefined — empty {} is valid (might get new enabled nodes)
    if (clientTree == null) continue;

    let updated = { ...clientTree };
    let changed = false;

    // 1. Auto-enable new children of enabled parents (cascading)
    //    Use a loop to handle multi-level cascading (grandchildren etc.)
    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      for (const [nodeId, nodeState] of Object.entries(updated)) {
        if (!nodeState?.enabled) continue;
        const children = parentChildMap[nodeId] || [];
        for (const childId of children) {
          if (!(childId in updated)) {
            updated[childId] = { enabled: true };
            changed = true;
            foundNew = true;
            console.log(`[syncToClients] "${client.name}": auto-enabled new node "${childId}" (parent "${nodeId}" is enabled)`);
          }
        }
      }
    }

    // 2. Remove stale nodes (exist in client tree but not in company tree)
    for (const nodeId of Object.keys(updated)) {
      if (!allNodeIds.has(nodeId)) {
        delete updated[nodeId];
        changed = true;
        console.log(`[syncToClients] "${client.name}": removed stale node "${nodeId}"`);
      }
    }

    if (changed) {
      try {
        await Client.update(client.id, { process_tree: updated });
        updatedCount++;
      } catch (err) {
        console.error(`[syncToClients] Failed to update client "${client.name}":`, err);
        errors.push(client.name);
      }
    }
  }

  if (updatedCount > 0) {
    console.log(`[ProcessTreeService] ✅ Synced company tree → ${updatedCount} client(s)`);
  }
  if (errors.length > 0) {
    console.error(`[ProcessTreeService] ❌ Failed to sync ${errors.length} client(s):`, errors);
  }

  return { updatedCount, errors };
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
// FULL SERVICE — Enable P1+P2+P5 for ALL clients
// ============================================================

/**
 * Apply FULL_SERVICE to all clients — enables all P1, P2, P5 nodes.
 * Includes parent grouping nodes for proper hierarchy.
 * User can then manually disable what's not needed per client.
 *
 * @returns {{ updatedCount: number, errors: string[] }}
 */
export async function applyFullServiceToAllClients() {
  const { tree } = await loadCompanyTree();
  if (!tree?.branches) return { updatedCount: 0, errors: ['No tree loaded'] };

  // Collect ALL node IDs from P1, P2, P5 branches (including parent grouping nodes)
  const fullServiceNodes = new Set();
  const walkBranch = (nodes) => {
    for (const n of (nodes || [])) {
      fullServiceNodes.add(n.id);
      if (n.children?.length) walkBranch(n.children);
    }
  };
  for (const branchId of ['P1', 'P2', 'P5']) {
    if (tree.branches[branchId]) {
      walkBranch(tree.branches[branchId].children);
    }
  }

  console.log(`[applyFullService] Enabling ${fullServiceNodes.size} nodes:`, [...fullServiceNodes]);

  const { Client } = await import('@/api/entities');
  const clients = await Client.list(null, 5000).catch(() => []);
  if (!clients || clients.length === 0) return { updatedCount: 0, errors: ['No clients found'] };

  let updatedCount = 0;
  const errors = [];

  for (const client of clients) {
    const existing = client.process_tree || {};
    const updated = { ...existing };
    let changed = false;

    for (const nodeId of fullServiceNodes) {
      if (!updated[nodeId]?.enabled) {
        updated[nodeId] = { ...(updated[nodeId] || {}), enabled: true };
        changed = true;
      }
    }

    // Also clean stale nodes
    const { cleaned, removedKeys } = cleanStaleClientNodes(updated, tree);
    if (removedKeys.length > 0) changed = true;

    if (changed) {
      try {
        await Client.update(client.id, { process_tree: cleaned });
        updatedCount++;
      } catch (err) {
        errors.push(client.name);
      }
    }
  }

  console.log(`[applyFullService] Updated ${updatedCount}/${clients.length} clients`);
  return { updatedCount, errors };
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
  invalidateTreeCache();
  const { tree, configId } = await loadCompanyTree();
  if (!tree?.branches?.[branchId]) {
    throw new Error(`Branch "${branchId}" not found in company tree`);
  }

  // VALIDATION: Prevent duplicate labels within same parent
  const label = (nodeData.label || '').trim();
  if (!label) throw new Error('שם הצומת לא יכול להיות ריק');

  const checkDuplicateLabel = (nodes) => {
    for (const n of (nodes || [])) {
      if (n.label === label) return true;
      if (n.children?.length && checkDuplicateLabel(n.children)) return true;
    }
    return false;
  };

  if (parentNodeId) {
    // Check siblings of the target parent
    const findParentChildren = (nodes) => {
      for (const n of (nodes || [])) {
        if (n.id === parentNodeId) return n.children || [];
        if (n.children?.length) {
          const found = findParentChildren(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const siblings = findParentChildren(tree.branches[branchId].children || []);
    if (siblings && siblings.some(s => s.label === label)) {
      throw new Error(`כבר קיים צומת בשם "${label}" תחת אותו הורה`);
    }
  } else {
    // Check root-level siblings
    if ((tree.branches[branchId].children || []).some(s => s.label === label)) {
      throw new Error(`כבר קיים צומת בשם "${label}" בשורש הענף`);
    }
  }

  const newNodeId = nodeData.id || `${branchId}_custom_${Date.now()}`;
  const newNode = {
    id: newNodeId,
    label,
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

  // Step 2: Update depends_on for the moved node and its children
  // The moved node's depends_on should point to its new parent (not branch root)
  const isBranchRoot = !!updatedTree.branches[newParentId];
  const newParentRef = isBranchRoot ? [] : [newParentId];

  // Find the OLD depends_on so we can update children that referenced it
  const oldDependsOn = extractedNode.depends_on || [];

  // Update the extracted node's depends_on
  extractedNode = { ...extractedNode, depends_on: newParentRef };

  // Recursively update children: if a child's depends_on pointed to the OLD parent
  // of the moved node (i.e., the moved node's old depends_on target), update it
  // to point to the moved node itself (preserving the hierarchy)
  const updateChildDependsOn = (node, parentId) => {
    return {
      ...node,
      children: (node.children || []).map(child => {
        const updatedChild = { ...child };
        // If child depends_on references the old parent chain, update to current parent
        if (updatedChild.depends_on?.length > 0) {
          updatedChild.depends_on = updatedChild.depends_on.map(depId => {
            // If this dep pointed to the old parent of the moved subtree, fix it
            if (oldDependsOn.includes(depId)) return parentId;
            return depId;
          });
        }
        // Recurse into grandchildren
        if (updatedChild.children?.length) {
          return updateChildDependsOn(updatedChild, updatedChild.id);
        }
        return updatedChild;
      }),
    };
  };
  extractedNode = updateChildDependsOn(extractedNode, extractedNode.id);

  // Step 3: Insert at new location
  // Check if newParentId is a branch root
  if (isBranchRoot) {
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

  // Step 4: Clean up stale depends_on references across the entire tree
  // Any node in the tree that had depends_on pointing to the moved node
  // but is NOT a child of the moved node should have that reference removed
  const movedSubtreeIds = new Set();
  const collectIds = (n) => { movedSubtreeIds.add(n.id); (n.children || []).forEach(collectIds); };
  collectIds(extractedNode);

  const cleanDependsOnRefs = (nodes) =>
    nodes.map(n => {
      if (movedSubtreeIds.has(n.id)) return n; // skip the moved subtree itself
      const updated = { ...n };
      if (updated.depends_on?.length > 0) {
        updated.depends_on = updated.depends_on.filter(depId => !movedSubtreeIds.has(depId) || depId === nodeId);
      }
      if (updated.children?.length) {
        updated.children = cleanDependsOnRefs(updated.children);
      }
      return updated;
    });

  for (const [branchId, branch] of Object.entries(updatedTree.branches)) {
    updatedTree.branches[branchId] = { ...branch, children: cleanDependsOnRefs(branch.children || []) };
  }

  return saveAndBroadcast(updatedTree, configId, source);
}

/**
 * Delete a node from the company tree (DB).
 * Removes the node and all its children from the tree.
 * Changes are saved to DB and broadcasted.
 *
 * @param {string} nodeId - The node ID to delete
 * @param {string} source - Source identifier for broadcast
 */
export async function deleteNodeFromCompanyTree(nodeId, source = 'unknown') {
  invalidateTreeCache();
  const { tree, configId } = await loadCompanyTree();
  if (!tree?.branches) throw new Error('Company tree not found');

  const updatedTree = { ...tree, branches: { ...tree.branches } };
  let found = false;

  const removeFromChildren = (nodes) =>
    nodes.filter(n => {
      if (n.id === nodeId) { found = true; return false; }
      return true;
    }).map(n => n.children?.length ? { ...n, children: removeFromChildren(n.children) } : n);

  for (const [branchId, branch] of Object.entries(updatedTree.branches)) {
    const updated = removeFromChildren(branch.children || []);
    updatedTree.branches[branchId] = { ...branch, children: updated };
    if (found) break;
  }

  if (!found) throw new Error(`Node "${nodeId}" not found in company tree`);
  return saveAndBroadcast(updatedTree, configId, source);
}

/**
 * Clean up stale depends_on references across the entire company tree.
 * For each node, ensures depends_on only references its direct parent in
 * the tree hierarchy (or is empty for root-level nodes).
 * This fixes orphaned flow edges in the mind map after node moves.
 *
 * @param {string} source - Source identifier for broadcast
 * @returns {Object} { fixedCount }
 */
export async function cleanStaleDependsOn(source = 'unknown') {
  invalidateTreeCache();
  const { tree, configId } = await loadCompanyTree();
  if (!tree?.branches) throw new Error('Company tree not found');

  const updatedTree = { ...tree, branches: { ...tree.branches } };
  let fixedCount = 0;

  const fixDepsInChildren = (nodes, parentId) =>
    nodes.map(n => {
      const correctDeps = parentId ? [parentId] : [];
      const current = n.depends_on || [];
      const needsFix = current.length !== correctDeps.length ||
        current.some((d, i) => d !== correctDeps[i]);
      if (needsFix) {
        fixedCount++;
        console.log(`[cleanStaleDependsOn] Fixed "${n.id}": [${current.join(',')}] → [${correctDeps.join(',')}]`);
      }
      return {
        ...n,
        depends_on: correctDeps,
        children: n.children?.length
          ? fixDepsInChildren(n.children, n.id)
          : n.children,
      };
    });

  for (const [branchId, branch] of Object.entries(updatedTree.branches)) {
    updatedTree.branches[branchId] = {
      ...branch,
      children: fixDepsInChildren(branch.children || [], null),
    };
  }

  if (fixedCount > 0) {
    await saveAndBroadcast(updatedTree, configId, source);
  }
  return { fixedCount };
}

/**
 * Remove duplicate nodes from the company tree.
 * A node is duplicate if another node with the same label exists
 * at the same level under the same parent.
 * Also removes nodes that are nested inside themselves (self-referencing).
 *
 * @param {string} source - Source identifier for broadcast
 * @returns {Object} { removedCount, removedIds }
 */
export async function deduplicateCompanyTree(source = 'unknown') {
  invalidateTreeCache();
  const { tree, configId } = await loadCompanyTree();
  if (!tree?.branches) throw new Error('Company tree not found');

  const updatedTree = { ...tree, branches: { ...tree.branches } };
  const removedIds = [];

  const dedup = (nodes, parentId = null) => {
    const seen = new Set();
    return nodes.filter(n => {
      // Self-reference check: node nested under itself
      if (n.id === parentId) {
        removedIds.push(n.id);
        return false;
      }
      // Duplicate label check at same level
      if (seen.has(n.label)) {
        removedIds.push(n.id);
        return false;
      }
      seen.add(n.label);
      return true;
    }).map(n => {
      if (n.children?.length) {
        return { ...n, children: dedup(n.children, n.id) };
      }
      return n;
    });
  };

  for (const [branchId, branch] of Object.entries(updatedTree.branches)) {
    updatedTree.branches[branchId] = {
      ...branch,
      children: dedup(branch.children || []),
    };
  }

  if (removedIds.length > 0) {
    console.log(`[ProcessTreeService] 🧹 Dedup removed ${removedIds.length} nodes:`, removedIds);
    await saveAndBroadcast(updatedTree, configId, source);
  }

  return { removedCount: removedIds.length, removedIds };
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
    if (!nodeConfig) {
      console.warn(`[resolveFrequency] Node "${nId}" not found in company tree — parent may have been deleted. Falling back to 'monthly'.`);
      return 'monthly';
    }

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
