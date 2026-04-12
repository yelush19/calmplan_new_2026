// ═══════════════════════════════════════════════════════════════
// Node Selection Bridge — Stage 5.2
// ═══════════════════════════════════════════════════════════════
//
// Task lists (Home, Tasks, dashboards) emit a selection event.
// Canvases (MindMapView, RadialMindMapView, Ayoa views, DesignContext)
// listen and reveal/highlight the matching node.
//
// Using a window CustomEvent instead of React state because the
// consumer may live in a different route/dialog/portal. One-liner
// helper keeps call sites clean and discoverable.
// ═══════════════════════════════════════════════════════════════

/**
 * Broadcast a node-selection intent.
 *
 * @param {object} payload
 * @param {string} [payload.taskId]    - Task ID (preferred for list → map highlighting)
 * @param {string} [payload.nodeId]    - Tree node id (e.g. P2_vat)
 * @param {string} [payload.serviceKey] - Service key fallback (e.g. "vat")
 * @param {string} [payload.source]    - Originating component — 'task-list' | 'canvas' | ...
 */
export function selectNode(payload = {}) {
  if (typeof window === 'undefined') return;
  const detail = {
    taskId: payload.taskId || null,
    nodeId: payload.nodeId || payload.serviceKey || null,
    serviceKey: payload.serviceKey || null,
    source: payload.source || 'unknown',
    at: Date.now(),
  };
  if (!detail.taskId && !detail.nodeId) return;
  window.dispatchEvent(new CustomEvent('calmplan:node-selected', { detail }));
}

/**
 * Convenience: select by task object. Derives taskId + serviceKey.
 */
export function selectNodeByTask(task, source = 'task-list') {
  if (!task) return;
  selectNode({
    taskId: task.id,
    nodeId: task.service_node_id || task.service_key || null,
    serviceKey: task.service_key || task.category || null,
    source,
  });
}
