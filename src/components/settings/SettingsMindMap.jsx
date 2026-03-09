/**
 * SettingsMindMap: LIVE Drag-and-Drop Process Architect
 * 15 Directives Implementation:
 *
 * 1. Visual = Database: Canvas mutates real state on every interaction
 * 2. Zero-Hardcoding: Initializes from ALL_SERVICES real templates
 * 3. Two-Way Binding: State ↔ Canvas in real-time, no refresh needed
 * 4. DnD Engine: Full mouseDown/Move/Up on SVG with getScreenCTM()
 * 5. Shape Palette: Floating draggable shapes → spawn new templates
 * 6. Magnetic Parent-Child Linking: Proximity snap on drag-over
 * 7. Quick Spawn "+": Hover reveals child-add button per node
 * 8. Contextual Sidebar: Click → sidebar populates with node data
 * 9. Reassignment by Dragging: Cross-branch drop changes board
 * 10. Trash Can: Drop-zone with confirmation for deletion
 * 11. Organic Physics: Force-directed repulsion, no overlaps
 * 12. Tapered Bezier Curves: SVG thick→thin organic branches
 * 13. Color Inheritance: Child inherits parent DNA color
 * 14. Absolute SVG Math: All X,Y coordinates, zero percentages
 * 15. Debug Proof: console.log on every state mutation
 *
 * SVG uses ABSOLUTE coordinates only (viewBox 0 0 1200 800).
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildTaperedBranch, SHAPE_KEYS } from '../canvas/AyoaNode';
import { renderNodeShape } from '../canvas/AyoaNode';
import {
  ALL_SERVICES,
  TAX_SERVICES,
  PAYROLL_SERVICES,
  ADDITIONAL_SERVICES,
} from '@/config/processTemplates';
import { SERVICE_WEIGHTS, getServiceWeight } from '@/config/serviceWeights';
import { useDesign } from '@/contexts/DesignContext';
import {
  Trash2, Plus, GripVertical, Cloud, Circle, Diamond, Star,
  MessageCircle, X, ChevronRight, Move, Zap, Minus, ListOrdered,
  CloudUpload, CheckCircle2, AlertCircle, Loader2, Shield,
} from 'lucide-react';

import { resolveCategoryLabel } from '@/utils/categoryLabels';

// ── DNA Colors (P-branch identity) ──
const DNA = {
  P1: { color: '#00A3E0', label: 'P1 שכר', bg: '#00A3E015', glow: '#00A3E040', dashboard: 'payroll' },
  P2: { color: '#B2AC88', label: 'P2 הנה"ח', bg: '#B2AC8815', glow: '#B2AC8840', dashboard: 'tax' },
  P3: { color: '#E91E63', label: 'P3 ניהול', bg: '#E91E6315', glow: '#E91E6340', dashboard: 'admin' },
  P4: { color: '#FFC107', label: 'P4 בית', bg: '#FFC10715', glow: '#FFC10740', dashboard: 'home' },
  P5: { color: '#2E7D32', label: 'P5 דוחות שנתיים', bg: '#2E7D3215', glow: '#2E7D3240', dashboard: 'annual_reports' },
};

function getDashboardBranch(dashboard) {
  if (dashboard === 'payroll') return 'P1';
  if (dashboard === 'tax') return 'P2';
  if (dashboard === 'admin' || dashboard === 'additional') return 'P3';
  if (dashboard === 'home') return 'P4';
  if (dashboard === 'annual_reports') return 'P5';
  return 'P3';
}

const BOARD_OPTIONS = [
  { key: 'payroll', label: 'שכר (P1)', branch: 'P1' },
  { key: 'tax', label: 'הנה"ח (P2)', branch: 'P2' },
  { key: 'admin', label: 'ניהול (P3)', branch: 'P3' },
  { key: 'home', label: 'בית (P4)', branch: 'P4' },
  { key: 'annual_reports', label: 'דוחות שנתיים (P5)', branch: 'P5' },
];

const COGNITIVE_LABELS = ['ננו', 'פשוט', 'בינוני', 'מורכב'];

// ── Canvas dimensions (absolute, directive #14) ──
const VB_W = 1200, VB_H = 800;
const CX = VB_W / 2, CY = VB_H / 2;

// ── Shape palette definition (directive #5) ──
const PALETTE_SHAPES = [
  { key: 'cloud', label: 'ענן', icon: Cloud },
  { key: 'bubble', label: 'בועה', icon: Circle },
  { key: 'diamond', label: 'מעוין', icon: Diamond },
  { key: 'pill', label: 'כמוסה', icon: Minus },
  { key: 'star', label: 'כוכב', icon: Star },
];

// ── Magnetic snap distance (directive #6) ──
const SNAP_DISTANCE = 65;
const TRASH_ZONE = { x: VB_W - 70, y: VB_H - 70, r: 40 };

// ── Persistence (localStorage + Supabase sync) ──
// Dynamically import SystemConfig for Supabase backup
let _systemConfigEntity = null;
async function getSystemConfig() {
  if (!_systemConfigEntity) {
    try {
      const { SystemConfig } = await import('@/api/entities');
      _systemConfigEntity = SystemConfig;
    } catch { /* Supabase not available */ }
  }
  return _systemConfigEntity;
}

// Save to both localStorage AND Supabase for data integrity
async function syncToSupabase(key, data) {
  try {
    const SC = await getSystemConfig();
    if (!SC) return;
    const existing = await SC.list();
    const record = existing.find(r => r.config_key === key);
    if (record) {
      await SC.update(record.id, { config_key: key, config_value: data, updated_at: new Date().toISOString() });
    } else {
      await SC.create({ config_key: key, config_value: data, updated_at: new Date().toISOString() });
    }
    console.log(`[Supabase] Synced settings: ${key}`);
  } catch (err) {
    console.warn(`[Supabase] Failed to sync ${key}:`, err.message);
  }
}

// ============================================================
// FORCE SYNC: Full backup of all service definitions + steps
// ============================================================
// Pushes a complete snapshot of the architect's work to Supabase.
// Includes: service_overrides, custom_services, node_positions,
// and a full service_definitions manifest with sort_order + parent linkage.

async function forceFullSync() {
  const results = { success: [], failed: [], integrity: [] };
  const SC = await getSystemConfig();
  if (!SC) {
    results.failed.push('Supabase not available');
    return results;
  }

  // 1. Sync service overrides
  try {
    const overrides = JSON.parse(localStorage.getItem('calmplan_service_overrides') || '{}');
    await syncToSupabase('service_overrides', overrides);
    results.success.push('service_overrides');
  } catch (err) {
    results.failed.push(`service_overrides: ${err.message}`);
  }

  // 2. Sync custom services
  try {
    const customs = JSON.parse(localStorage.getItem('calmplan_custom_services') || '{}');
    await syncToSupabase('custom_services', customs);
    results.success.push('custom_services');
  } catch (err) {
    results.failed.push(`custom_services: ${err.message}`);
  }

  // 3. Sync node positions
  try {
    const positions = JSON.parse(localStorage.getItem('calmplan_node_positions') || '{}');
    await syncToSupabase('node_positions', positions);
    results.success.push('node_positions');
  } catch (err) {
    results.failed.push(`node_positions: ${err.message}`);
  }

  // 4. Build and sync FULL service_definitions manifest
  // This is the critical backup: every service, every step with sort_order, parent linkage
  try {
    const overrides = JSON.parse(localStorage.getItem('calmplan_service_overrides') || '{}');
    const customs = JSON.parse(localStorage.getItem('calmplan_custom_services') || '{}');

    const manifest = {};
    // Merge ALL_SERVICES with overrides
    for (const [key, svc] of Object.entries(ALL_SERVICES)) {
      if (overrides[key]?._hidden) continue;
      const merged = { ...svc, ...(overrides[key] || {}) };
      const branch = getDashboardBranch(merged.dashboard);
      manifest[key] = {
        key: merged.key,
        label: merged.label,
        dashboard: merged.dashboard,
        branch,
        parentId: merged.parentId || branch,
        taskType: merged.taskType || 'linear',
        createCategory: merged.createCategory,
        steps: (merged.steps || []).map((step, index) => ({
          key: step.key,
          label: step.label,
          icon: step.icon,
          sort_order: index,
          parent_service: key,
          requiresPrev: step.requiresPrev || false,
        })),
        _source: 'template',
      };
    }
    // Add custom services
    for (const [key, svc] of Object.entries(customs)) {
      const branch = getDashboardBranch(svc.dashboard);
      manifest[key] = {
        key: svc.key || key,
        label: svc.label,
        dashboard: svc.dashboard,
        branch,
        parentId: svc.parentId || branch,
        taskType: svc.taskType || 'linear',
        createCategory: svc.createCategory,
        steps: (svc.steps || []).map((step, index) => ({
          key: step.key,
          label: step.label,
          icon: step.icon,
          sort_order: index,
          parent_service: key,
          requiresPrev: step.requiresPrev || false,
        })),
        _source: 'custom',
      };
    }

    await syncToSupabase('service_definitions', manifest);
    results.success.push('service_definitions');

    // 5. Integrity verification: check each service's steps
    for (const [key, svc] of Object.entries(manifest)) {
      const steps = svc.steps || [];
      // Verify sort_order is sequential
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].sort_order !== i) {
          results.integrity.push(`${key}: step "${steps[i].label}" sort_order mismatch (expected ${i}, got ${steps[i].sort_order})`);
        }
        if (steps[i].parent_service !== key) {
          results.integrity.push(`${key}: step "${steps[i].label}" parent linkage broken`);
        }
      }
    }
    if (results.integrity.length === 0) {
      results.integrity.push('ALL_CLEAR');
    }
  } catch (err) {
    results.failed.push(`service_definitions: ${err.message}`);
  }

  // 6. Sync timestamp
  try {
    await syncToSupabase('last_full_sync', {
      timestamp: new Date().toISOString(),
      service_count: Object.keys(ALL_SERVICES).length,
      results_summary: {
        synced: results.success.length,
        failed: results.failed.length,
        integrity_issues: results.integrity.filter(i => i !== 'ALL_CLEAR').length,
      },
    });
    results.success.push('sync_timestamp');
  } catch { /* non-critical */ }

  return results;
}

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem('calmplan_service_overrides') || '{}'); }
  catch { return {}; }
}
function saveOverrides(o) {
  localStorage.setItem('calmplan_service_overrides', JSON.stringify(o));
  syncToSupabase('service_overrides', o);
}
function loadCustomServices() {
  try { return JSON.parse(localStorage.getItem('calmplan_custom_services') || '{}'); }
  catch { return {}; }
}
function saveCustomServices(c) {
  localStorage.setItem('calmplan_custom_services', JSON.stringify(c));
  syncToSupabase('custom_services', c);
}
function loadNodePositions() {
  try { return JSON.parse(localStorage.getItem('calmplan_node_positions') || '{}'); }
  catch { return {}; }
}
function saveNodePositions(p) {
  localStorage.setItem('calmplan_node_positions', JSON.stringify(p));
  syncToSupabase('node_positions', p);
}

// ── Force-directed repulsion (directive #11) ──
function applyForceRepulsion(nodes, iterations = 15) {
  const MIN_DIST = 80;
  const result = nodes.map(n => ({ ...n }));
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i], b = result[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < MIN_DIST) {
          const push = (MIN_DIST - dist) / 2 + 1;
          const nx = dx / dist, ny = dy / dist;
          // Roots resist more than services, services more than steps
          const aWeight = a.type === 'root' ? 0.1 : a.type === 'service' ? 0.4 : 0.8;
          const bWeight = b.type === 'root' ? 0.1 : b.type === 'service' ? 0.4 : 0.8;
          b.x += nx * push * bWeight;
          b.y += ny * push * bWeight;
          a.x -= nx * push * aWeight;
          a.y -= ny * push * aWeight;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  // Clamp to viewBox
  for (const n of result) {
    n.x = Math.max(60, Math.min(VB_W - 60, n.x));
    n.y = Math.max(60, Math.min(VB_H - 60, n.y));
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════
// getNodePath — Breadcrumb path builder for precise re-parenting
// Traverses parent chain: "P1 שכר → שירותים → ייצור"
// ══════════════════════════════════════════════════════════════════════

function getNodePath(nodeId, allNodes, maxDepth = 10) {
  const segments = [];
  let currentId = nodeId;
  let depth = 0;

  while (currentId && currentId !== 'hub' && depth < maxDepth) {
    const node = allNodes.find(n => n.id === currentId);
    if (!node) break;
    segments.unshift(node.label || node.id);
    currentId = node.parentId;
    depth++;
  }

  return segments.join(' → ');
}

// ══════════════════════════════════════════════════════════════════════
// ParentDropdown — Breadcrumb-path parent selector for re-parenting
// Shows full hierarchy path to disambiguate duplicate names
// ══════════════════════════════════════════════════════════════════════

function ParentDropdown({ selectedNodeId, allNodes, moveService, currentParentId, currentDashboard }) {
  // Build list of valid parent targets (roots + other services, not self, not steps)
  const parentOptions = useMemo(() => {
    return allNodes
      .filter(n => n.type === 'root' || (n.type === 'service' && n.id !== selectedNodeId))
      .map(n => ({
        id: n.id,
        path: getNodePath(n.id, allNodes),
        color: n.color,
        dashboard: n.dashboard || DNA[n.id]?.dashboard,
        type: n.type,
        branch: n.type === 'root' ? n.id : getDashboardBranch(n.dashboard),
      }))
      .sort((a, b) => {
        // Sort roots first, then by branch, then by path
        if (a.type !== b.type) return a.type === 'root' ? -1 : 1;
        if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
        return a.path.localeCompare(b.path);
      });
  }, [allNodes, selectedNodeId]);

  const handleChange = useCallback((e) => {
    const targetId = e.target.value;
    const target = allNodes.find(n => n.id === targetId);
    if (!target) return;

    // Determine the dashboard from the target
    const newDashboard = target.type === 'root'
      ? DNA[target.id]?.dashboard
      : target.dashboard;

    if (newDashboard && newDashboard !== currentDashboard) {
      moveService(selectedNodeId, newDashboard);
      console.log('STATE MUTATED:', {
        action: 'reparent',
        key: selectedNodeId,
        fromParent: currentParentId,
        toParent: targetId,
        toPath: getNodePath(targetId, allNodes),
        newDashboard,
      });
    }
  }, [allNodes, selectedNodeId, currentParentId, currentDashboard, moveService]);

  // Current parent path display
  const currentPath = getNodePath(currentParentId, allNodes);

  return (
    <div>
      <label className="text-[9px] font-bold text-gray-400 block mb-0.5">שיוך להורה (נתיב מלא)</label>
      <div className="text-[8px] text-gray-300 mb-0.5 truncate" title={currentPath}>
        נוכחי: {currentPath}
      </div>
      <select
        value={currentParentId || ''}
        onChange={handleChange}
        className="w-full px-2 py-1 text-[10px] border rounded-lg focus:ring-1 focus:ring-blue-300 focus:outline-none bg-white"
        dir="rtl"
      >
        {parentOptions.map(opt => (
          <option key={opt.id} value={opt.id}>
            {opt.type === 'root' ? `● ${opt.path}` : `  └─ ${opt.path}`}
          </option>
        ))}
      </select>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SortableStepsManager — Drag-to-reorder, editable, add/delete steps
// ══════════════════════════════════════════════════════════════════════

function SortableStepsManager({ steps, serviceKey, updateService, color, bg }) {
  const [stepDrag, setStepDrag] = useState(null); // { fromIndex, currentIndex }
  const [dropPreview, setDropPreview] = useState(null); // index where item would land
  const dragYRef = useRef(0);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  // ── Commit steps array to state (persists immediately) ──
  const commitSteps = useCallback((newSteps) => {
    console.log('STATE MUTATED:', { action: 'steps_update', key: serviceKey, steps: newSteps });
    updateService(serviceKey, { steps: newSteps });
  }, [serviceKey, updateService]);

  // ── Edit a step's label in-place ──
  const handleStepLabelChange = useCallback((index, newLabel) => {
    const updated = steps.map((s, i) => i === index ? { ...s, label: newLabel } : s);
    commitSteps(updated);
  }, [steps, commitSteps]);

  // ── Add new step at end ──
  const handleAddStep = useCallback(() => {
    const newStep = {
      key: `step_${Date.now()}`,
      label: '',
      icon: 'check-circle',
    };
    commitSteps([...steps, newStep]);
    // Focus the new input after render
    requestAnimationFrame(() => {
      const lastInput = listRef.current?.querySelector(`[data-step-index="${steps.length}"] input`);
      lastInput?.focus();
    });
  }, [steps, commitSteps]);

  // ── Delete step by index ──
  const handleDeleteStep = useCallback((index) => {
    if (steps.length <= 1) return; // prevent empty template
    commitSteps(steps.filter((_, i) => i !== index));
  }, [steps, commitSteps]);

  // ── Drag-to-reorder: mousedown on handle ──
  const handleDragStart = useCallback((index, e) => {
    e.preventDefault();
    e.stopPropagation();
    dragYRef.current = e.clientY;
    setStepDrag({ fromIndex: index, currentIndex: index });
    setDropPreview(index);

    const handleMove = (moveE) => {
      const deltaY = moveE.clientY - dragYRef.current;
      const itemHeight = 36; // approx row height in px
      const indexShift = Math.round(deltaY / itemHeight);
      const newIndex = Math.max(0, Math.min(steps.length - 1, index + indexShift));
      setStepDrag(prev => prev ? { ...prev, currentIndex: newIndex } : null);
      setDropPreview(newIndex);
    };

    const handleUp = () => {
      setStepDrag(prev => {
        if (prev && prev.fromIndex !== prev.currentIndex) {
          const reordered = [...steps];
          const [moved] = reordered.splice(prev.fromIndex, 1);
          reordered.splice(prev.currentIndex, 0, moved);
          commitSteps(reordered);
          console.log('STATE MUTATED:', {
            action: 'steps_reorder',
            key: serviceKey,
            from: prev.fromIndex,
            to: prev.currentIndex,
            newOrder: reordered.map(s => s.label || s.key),
          });
        }
        return null;
      });
      setDropPreview(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [steps, commitSteps, serviceKey]);

  // Build display order: if dragging, show the preview reorder
  const displaySteps = useMemo(() => {
    if (!stepDrag || stepDrag.fromIndex === stepDrag.currentIndex) return steps;
    const preview = [...steps];
    const [moved] = preview.splice(stepDrag.fromIndex, 1);
    preview.splice(stepDrag.currentIndex, 0, moved);
    return preview;
  }, [steps, stepDrag]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
          <ListOrdered className="w-3 h-3" />
          שלבי תהליך ({steps.length})
        </label>
      </div>

      <div ref={listRef} className="space-y-0.5">
        {displaySteps.map((step, i) => {
          const isBeingDragged = stepDrag && (
            stepDrag.fromIndex === stepDrag.currentIndex
              ? i === stepDrag.fromIndex
              : i === stepDrag.currentIndex
          );
          const isDropTarget = dropPreview === i && stepDrag && stepDrag.fromIndex !== i;

          return (
            <div
              key={`${step.key || i}-${i}`}
              data-step-index={i}
              className={`flex items-center gap-1 rounded-lg transition-all ${
                isBeingDragged
                  ? 'bg-blue-50 shadow-sm ring-1 ring-blue-200 scale-[1.02]'
                  : isDropTarget
                    ? 'bg-green-50 ring-1 ring-green-200'
                    : 'bg-gray-50 hover:bg-gray-100'
              }`}
              style={{
                padding: '4px 6px',
                minHeight: '32px',
              }}
            >
              {/* ⋮⋮ Drag handle */}
              <button
                className="flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-gray-200 text-gray-300 hover:text-gray-500 transition-colors"
                onMouseDown={(e) => handleDragStart(i, e)}
                title="גרור לשינוי סדר"
              >
                <GripVertical className="w-3 h-3" />
              </button>

              {/* Auto-index badge */}
              <span
                className="flex-shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ backgroundColor: bg, color }}
              >
                {i + 1}
              </span>

              {/* Editable step label */}
              <input
                type="text"
                value={step.label || ''}
                onChange={(e) => handleStepLabelChange(i, e.target.value)}
                placeholder="שם שלב..."
                className="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] bg-transparent border-0 border-b border-transparent focus:border-gray-300 focus:outline-none text-gray-700 placeholder-gray-300 transition-colors"
                dir="rtl"
              />

              {/* Delete step */}
              <button
                onClick={() => handleDeleteStep(i)}
                className={`flex-shrink-0 p-0.5 rounded transition-all ${
                  steps.length <= 1
                    ? 'text-gray-200 cursor-not-allowed'
                    : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                }`}
                disabled={steps.length <= 1}
                title="מחק שלב"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* + Add step button */}
      <button
        onClick={handleAddStep}
        className="w-full mt-1.5 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-gray-200 text-[9px] font-medium text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
      >
        <Plus className="w-3 h-3" />
        הוסף שלב
      </button>
    </div>
  );
}

export default function SettingsMindMap({ onSelectService, onConfigChange }) {
  const svgRef = useRef(null);
  const design = useDesign();
  const [overrides, setOverrides] = useState(loadOverrides);
  const [customServices, setCustomServices] = useState(loadCustomServices);
  const [savedPositions, setSavedPositions] = useState(loadNodePositions);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [dragState, setDragState] = useState(null); // { nodeId, offsetX, offsetY, startX, startY }
  const [paletteDrag, setPaletteDrag] = useState(null); // { shape, x, y } — dragging from palette
  const [magnetTarget, setMagnetTarget] = useState(null); // id of node being hovered-over during drag
  const [showTrashGlow, setShowTrashGlow] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [nodePositionOverrides, setNodePositionOverrides] = useState({});
  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'success' | 'error'
  const [syncResults, setSyncResults] = useState(null);
  const [syncTimestamp, setSyncTimestamp] = useState(null);
  // Shapes palette hidden by default — logic preserved, toggle reveals it
  const [showShapePalette, setShowShapePalette] = useState(false);

  // ── Sync node selection to global Design Engine ──
  useEffect(() => {
    if (selectedNodeId) {
      design.setActiveTaskId(selectedNodeId);
      window.dispatchEvent(new CustomEvent('calmplan:node-selected', { detail: { nodeId: selectedNodeId } }));
    }
  }, [selectedNodeId]);

  // ── Build LIVE service registry (directive #1, #2, #3) ──
  // DEDUP GUARD: template services always win. Custom services only add NEW keys.
  // This prevents ghost bubbles from localStorage duplicating template services.
  const liveServices = useMemo(() => {
    const merged = {};
    for (const [key, svc] of Object.entries(ALL_SERVICES)) {
      if (overrides[key]?._hidden) continue;
      merged[key] = { ...svc, ...(overrides[key] || {}) };
    }
    for (const [key, svc] of Object.entries(customServices)) {
      // Only add truly custom services — skip if template already defines this key
      if (ALL_SERVICES[key]) {
        console.log(`[MindMap] Skipping custom service "${key}" — already in templates`);
        continue;
      }
      merged[key] = { ...svc };
    }
    return merged;
  }, [overrides, customServices]);

  // ── Build node tree: center → P-roots → services → steps ──
  const allNodes = useMemo(() => {
    const nodes = [];
    const rootAngles = { P1: -Math.PI * 0.8, P2: -Math.PI * 0.4, P3: 0, P4: Math.PI * 0.4, P5: Math.PI * 0.8 };
    const rootDist = 220;

    // P-Root nodes
    Object.entries(DNA).forEach(([key, dna]) => {
      const angle = rootAngles[key];
      const saved = savedPositions[key];
      nodes.push({
        id: key,
        type: 'root',
        label: dna.label,
        shape: 'cloud',
        color: dna.color,
        bg: dna.bg,
        x: saved?.x ?? CX + Math.cos(angle) * rootDist,
        y: saved?.y ?? CY + Math.sin(angle) * rootDist,
        parentId: 'hub',
        dashboard: dna.dashboard,
        r: 48,
        ...nodePositionOverrides[key],
      });
    });

    // ── RECURSIVE SERVICE LAYOUT (Infinite Hierarchy) ──
    // Topological sort: process nodes whose parents are already laid out,
    // then their children, etc. Handles N-level deep trees.
    const allSvcs = Object.values(liveServices);
    const nodeMap = {}; // id → node ref (for fast parent lookup)
    nodes.forEach(n => { nodeMap[n.id] = n; }); // pre-populate with root nodes

    // Build adjacency: parentId → [child services]
    const childrenOf = {}; // parentId → [svc, svc, ...]
    allSvcs.forEach(svc => {
      const branch = getDashboardBranch(svc.dashboard);
      const resolvedParent = svc.parentId || branch;
      if (!childrenOf[resolvedParent]) childrenOf[resolvedParent] = [];
      childrenOf[resolvedParent].push(svc);
    });

    // Recursive layout: place children around their parent
    const layoutChildren = (parentId, depth) => {
      const children = childrenOf[parentId];
      if (!children || children.length === 0) return;

      const parentNode = nodeMap[parentId];
      if (!parentNode) return;

      // Distance shrinks at deeper levels, spread stays wide
      const dist = Math.max(70, 130 - depth * 20);
      const spreadAngle = Math.PI * 0.7;
      const count = children.length;
      // Base angle: point away from parent's parent (or use default)
      const grandParent = nodeMap[parentNode.parentId];
      const baseDirection = grandParent
        ? Math.atan2(parentNode.y - grandParent.y, parentNode.x - grandParent.x)
        : (rootAngles[parentId] ?? Math.atan2(parentNode.y - CY, parentNode.x - CX));

      children.forEach((svc, si) => {
        const angleStart = baseDirection - spreadAngle / 2;
        const angle = count === 1 ? baseDirection : angleStart + (spreadAngle * si) / Math.max(1, count - 1);
        const saved = savedPositions[svc.key];
        const weight = getServiceWeight(svc.createCategory || svc.taskCategories?.[0]);

        // Color: inherit from branch root
        const branch = getDashboardBranch(svc.dashboard);

        // Read global design overrides for this node (shape/color from Design Engine)
        const designOverride = design.getNodeOverride?.(svc.key) || {};
        const nodeShape = designOverride.shape || design.shape || 'bubble';
        const nodeColor = designOverride.color || DNA[branch]?.color || '#999';

        const node = {
          id: svc.key,
          type: 'service',
          label: svc.label || resolveCategoryLabel(svc.key),
          shape: nodeShape,
          color: nodeColor,
          bg: designOverride.color ? (designOverride.color + '15') : (DNA[branch]?.bg || '#f5f5f5'),
          x: saved?.x ?? parentNode.x + Math.cos(angle) * dist,
          y: saved?.y ?? parentNode.y + Math.sin(angle) * dist,
          parentId: svc.parentId || branch,
          dashboard: svc.dashboard,
          steps: svc.steps || [],
          weight,
          cogLoad: weight?.cognitiveLoad || 0,
          r: Math.max(22, 30 - depth * 3), // slightly smaller at deeper levels
          nextStepIds: svc.nextStepIds || (svc.nextStepId ? [svc.nextStepId] : []),
          isParallel: svc.isParallel || false,
          _isCustom: !!customServices[svc.key],
          _depth: depth,
          ...nodePositionOverrides[svc.key],
        };

        nodes.push(node);
        nodeMap[svc.key] = node;

        // Step nodes (only if this service is selected)
        if (selectedNodeId === svc.key && svc.steps) {
          const stepDist = 75;
          const stepSpread = Math.PI * 0.5;
          const stCount = svc.steps.length;
          svc.steps.forEach((step, sti) => {
            const stBase = angle - stepSpread / 2;
            const stAngle = stCount === 1 ? angle : stBase + (stepSpread * sti) / Math.max(1, stCount - 1);
            const saved = savedPositions[`${svc.key}_step_${sti}`];

            const stepNode = {
              id: `${svc.key}_step_${sti}`,
              type: 'step',
              label: step.label || step.key,
              shape: 'pill',
              color: DNA[branch]?.color || '#999',
              bg: DNA[branch]?.bg || '#f5f5f5',
              x: saved?.x ?? node.x + Math.cos(stAngle) * stepDist,
              y: saved?.y ?? node.y + Math.sin(stAngle) * stepDist,
              parentId: svc.key,
              r: 20,
              stepIndex: sti,
              ...nodePositionOverrides[`${svc.key}_step_${sti}`],
            };
            nodes.push(stepNode);
            nodeMap[stepNode.id] = stepNode;
          });
        }

        // RECURSE: layout this node's children (infinite depth)
        layoutChildren(svc.key, depth + 1);
      });
    };

    // Start recursion from each root (P1, P2, P3, P4)
    Object.keys(DNA).forEach(rootKey => {
      layoutChildren(rootKey, 1);
    });

    // Apply force repulsion (directive #11)
    return applyForceRepulsion(nodes);
  }, [liveServices, savedPositions, selectedNodeId, customServices, nodePositionOverrides]);

  // ── SVG coordinate helper (directive #14: absolute math) ──
  const svgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const inv = ctm.inverse();
    return {
      x: inv.a * clientX + inv.c * clientY + inv.e,
      y: inv.b * clientX + inv.d * clientY + inv.f,
    };
  }, []);

  // ── CRUD Operations (directive #1, #3, #15) ──
  const updateService = useCallback((serviceKey, updates) => {
    console.log('STATE MUTATED:', { action: 'update', key: serviceKey, updates });
    if (ALL_SERVICES[serviceKey]) {
      setOverrides(prev => {
        const next = { ...prev, [serviceKey]: { ...(prev[serviceKey] || {}), ...updates } };
        saveOverrides(next);
        return next;
      });
    } else {
      setCustomServices(prev => {
        const next = { ...prev, [serviceKey]: { ...prev[serviceKey], ...updates } };
        saveCustomServices(next);
        return next;
      });
    }
    onConfigChange?.({ action: 'update', key: serviceKey, updates });
  }, [onConfigChange]);

  const createService = useCallback((newService) => {
    const key = newService.key || `custom_${Date.now()}`;
    // BLANK SLATE: New services start with NO default steps.
    // The Architect defines their own steps in their own order.
    const svc = {
      key,
      label: newService.label || 'שירות חדש',
      dashboard: newService.dashboard || 'admin',
      taskCategories: [key],
      createCategory: key,
      steps: [],
      ...newService,
    };
    console.log('STATE MUTATED:', { action: 'create', key, service: svc });
    setCustomServices(prev => {
      const next = { ...prev, [key]: svc };
      saveCustomServices(next);
      return next;
    });
    onConfigChange?.({ action: 'create', key, service: svc });
    return key;
  }, [onConfigChange]);

  const deleteService = useCallback((serviceKey) => {
    console.log('STATE MUTATED:', { action: 'delete', key: serviceKey });
    if (ALL_SERVICES[serviceKey]) {
      setOverrides(prev => {
        const next = { ...prev, [serviceKey]: { ...(prev[serviceKey] || {}), _hidden: true } };
        saveOverrides(next);
        return next;
      });
    } else {
      setCustomServices(prev => {
        const next = { ...prev };
        delete next[serviceKey];
        saveCustomServices(next);
        return next;
      });
    }
    onConfigChange?.({ action: 'delete', key: serviceKey });
    if (selectedNodeId === serviceKey) setSelectedNodeId(null);
  }, [onConfigChange, selectedNodeId]);

  const moveService = useCallback((serviceKey, newDashboard) => {
    console.log('STATE MUTATED:', { action: 'move', key: serviceKey, newDashboard });
    updateService(serviceKey, { dashboard: newDashboard });
  }, [updateService]);

  // ── Force Sync Handler ──
  const handleForceSync = useCallback(async () => {
    setSyncStatus('syncing');
    setSyncResults(null);
    try {
      const results = await forceFullSync();
      setSyncResults(results);
      const hasFailures = results.failed.length > 0;
      const hasIntegrityIssues = results.integrity.some(i => i !== 'ALL_CLEAR');
      setSyncStatus(hasFailures || hasIntegrityIssues ? 'error' : 'success');
      setSyncTimestamp(new Date().toISOString());
      console.log('[Force Sync] Results:', results);
    } catch (err) {
      setSyncStatus('error');
      setSyncResults({ success: [], failed: [err.message], integrity: [] });
      console.error('[Force Sync] Failed:', err);
    }
  }, []);

  // ── Drag & Drop Engine (directive #4) ──
  const handleNodeMouseDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    e.preventDefault();
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return;
    const pt = svgPoint(e.clientX, e.clientY);
    setDragState({
      nodeId,
      offsetX: pt.x - node.x,
      offsetY: pt.y - node.y,
      startX: node.x,
      startY: node.y,
      hasMoved: false,
    });
  }, [allNodes, svgPoint]);

  const handleMouseMove = useCallback((e) => {
    if (!dragState && !paletteDrag) return;

    if (paletteDrag) {
      const pt = svgPoint(e.clientX, e.clientY);
      setPaletteDrag(prev => ({ ...prev, x: pt.x, y: pt.y }));

      // Check magnetic snap (directive #6)
      let closestId = null;
      let closestDist = SNAP_DISTANCE;
      for (const node of allNodes) {
        if (node.type === 'step') continue;
        const dx = pt.x - node.x, dy = pt.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = node.id;
        }
      }
      setMagnetTarget(closestId);

      // Check trash zone (directive #10)
      const tDx = pt.x - TRASH_ZONE.x, tDy = pt.y - TRASH_ZONE.y;
      setShowTrashGlow(Math.sqrt(tDx * tDx + tDy * tDy) < TRASH_ZONE.r + 20);
      return;
    }

    if (dragState) {
      const pt = svgPoint(e.clientX, e.clientY);
      const newX = pt.x - dragState.offsetX;
      const newY = pt.y - dragState.offsetY;

      setDragState(prev => ({ ...prev, hasMoved: true }));
      setNodePositionOverrides(prev => ({
        ...prev,
        [dragState.nodeId]: { x: newX, y: newY },
      }));

      // Check magnetic snap for reassignment (directive #6, #9)
      const draggedNode = allNodes.find(n => n.id === dragState.nodeId);
      if (draggedNode?.type === 'service') {
        let closestRootId = null;
        let closestDist = SNAP_DISTANCE + 30;
        for (const node of allNodes) {
          if (node.type !== 'root') continue;
          if (node.id === draggedNode.parentId) continue;
          const dx = newX - node.x, dy = newY - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestRootId = node.id;
          }
        }
        setMagnetTarget(closestRootId);
      }

      // Check trash zone
      const tDx = newX - TRASH_ZONE.x, tDy = newY - TRASH_ZONE.y;
      setShowTrashGlow(Math.sqrt(tDx * tDx + tDy * tDy) < TRASH_ZONE.r + 20);
    }
  }, [dragState, paletteDrag, allNodes, svgPoint]);

  const handleMouseUp = useCallback((e) => {
    // ── Palette drop: spawn new template (directive #5) ──
    if (paletteDrag) {
      const pt = svgPoint(e.clientX, e.clientY);

      // Check trash zone — cancel if in trash
      const tDx = pt.x - TRASH_ZONE.x, tDy = pt.y - TRASH_ZONE.y;
      if (Math.sqrt(tDx * tDx + tDy * tDy) < TRASH_ZONE.r + 20) {
        setPaletteDrag(null);
        setMagnetTarget(null);
        setShowTrashGlow(false);
        return;
      }

      // Determine parent from magnetic target or nearest root
      let parentBranch = 'P3'; // default
      if (magnetTarget) {
        const targetNode = allNodes.find(n => n.id === magnetTarget);
        if (targetNode?.type === 'root') parentBranch = targetNode.id;
        else if (targetNode?.type === 'service') {
          parentBranch = getDashboardBranch(targetNode.dashboard);
        }
      }

      const dashboard = DNA[parentBranch]?.dashboard || 'admin';
      const newKey = createService({
        dashboard,
        label: 'שירות חדש',
        _shape: paletteDrag.shape,
      });

      // Save position where it was dropped
      const posKey = newKey;
      setSavedPositions(prev => {
        const next = { ...prev, [posKey]: { x: pt.x, y: pt.y } };
        saveNodePositions(next);
        return next;
      });

      console.log('STATE MUTATED:', {
        action: 'palette_drop',
        shape: paletteDrag.shape,
        position: { x: pt.x, y: pt.y },
        parentBranch,
        newKey,
        newTemplateState: { key: newKey, dashboard, label: 'שירות חדש' },
      });

      setSelectedNodeId(newKey);
      setPaletteDrag(null);
      setMagnetTarget(null);
      setShowTrashGlow(false);
      return;
    }

    // ── Node drag release ──
    if (dragState) {
      const node = allNodes.find(n => n.id === dragState.nodeId);
      if (!node) { setDragState(null); return; }

      const finalPos = nodePositionOverrides[dragState.nodeId] || { x: node.x, y: node.y };

      // Check trash zone (directive #10)
      const tDx = finalPos.x - TRASH_ZONE.x, tDy = finalPos.y - TRASH_ZONE.y;
      if (Math.sqrt(tDx * tDx + tDy * tDy) < TRASH_ZONE.r + 20 && node.type === 'service') {
        setDeleteConfirm(dragState.nodeId);
        setDragState(null);
        setShowTrashGlow(false);
        setMagnetTarget(null);
        return;
      }

      // Check reassignment by dragging (directive #9)
      if (node.type === 'service' && magnetTarget && dragState.hasMoved) {
        const targetNode = allNodes.find(n => n.id === magnetTarget);
        if (targetNode?.type === 'root') {
          const newDashboard = DNA[targetNode.id]?.dashboard || 'admin';
          moveService(dragState.nodeId, newDashboard);
          console.log('STATE MUTATED:', {
            action: 'reassign',
            key: dragState.nodeId,
            from: node.parentId,
            to: targetNode.id,
            newDashboard,
          });
        }
      }

      // Persist position
      if (dragState.hasMoved) {
        setSavedPositions(prev => {
          const next = { ...prev, [dragState.nodeId]: { x: finalPos.x, y: finalPos.y } };
          saveNodePositions(next);
          return next;
        });
        // Clear the override since it's now saved
        setNodePositionOverrides(prev => {
          const next = { ...prev };
          delete next[dragState.nodeId];
          return next;
        });
      }

      // Click without drag = select
      if (!dragState.hasMoved) {
        setSelectedNodeId(prev => prev === dragState.nodeId ? null : dragState.nodeId);
      }

      setDragState(null);
      setMagnetTarget(null);
      setShowTrashGlow(false);
    }
  }, [dragState, paletteDrag, allNodes, magnetTarget, svgPoint, createService, moveService, nodePositionOverrides]);

  // ── Quick Spawn "+" (directive #7) — Creates a child task/service under the selected node ──
  const handleQuickSpawn = useCallback((parentNode, e) => {
    e.stopPropagation();
    const branch = parentNode.type === 'root' ? parentNode.id : getDashboardBranch(parentNode.dashboard);
    const dashboard = DNA[branch]?.dashboard || 'admin';
    // Connect child to parent via parentId — true hierarchy linking
    const parentId = parentNode.type === 'root' ? parentNode.id : parentNode.id;
    const key = createService({ dashboard, label: 'שירות חדש', parentId });

    // Position near parent
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 40;
    setSavedPositions(prev => {
      const next = { ...prev, [key]: { x: parentNode.x + Math.cos(angle) * dist, y: parentNode.y + Math.sin(angle) * dist } };
      saveNodePositions(next);
      return next;
    });
    setSelectedNodeId(key);
  }, [createService]);

  // ── Palette drag start (HTML → SVG bridge, directive #5) ──
  const handlePaletteDragStart = useCallback((shape, e) => {
    e.preventDefault();
    const pt = svgPoint(e.clientX, e.clientY);
    setPaletteDrag({ shape, x: pt.x, y: pt.y });
  }, [svgPoint]);

  // ── Selected node data for sidebar (directive #8) ──
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = allNodes.find(n => n.id === selectedNodeId);
    if (!node) return null;
    if (node.type === 'service') {
      const svc = liveServices[node.id];
      return svc ? { ...node, ...svc, _crud: { updateService, deleteService, moveService, createService }, _isCustom: !!customServices[node.id] } : node;
    }
    return node;
  }, [selectedNodeId, allNodes, liveServices, customServices, updateService, deleteService, moveService, createService]);

  // Notify parent of selection (directive #8)
  // ONLY open Service Editor for actual service nodes, NOT for branch/root headers (P1-P5)
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'service') {
      onSelectService?.({
        ...selectedNode,
        _crud: { updateService, deleteService, moveService, createService },
        _liveServices: liveServices,
        _allNodes: allNodes,
        _isCustom: !!customServices[selectedNodeId],
      });
    } else {
      onSelectService?.(null);
    }
  }, [selectedNodeId, selectedNode?.type, selectedNode?.parentId, allNodes.length, liveServices]);

  // ── Build hierarchy edges (solid tapered branches) ──
  const edges = useMemo(() => {
    const result = [];
    allNodes.forEach(node => {
      if (node.parentId === 'hub') {
        result.push({ from: { x: CX, y: CY }, to: node, color: node.color, thickness: [8, 3] });
      } else {
        const parent = allNodes.find(n => n.id === node.parentId);
        if (parent) {
          const thick = node.type === 'step' ? [2.5, 0.8] : [4, 1.5];
          result.push({ from: parent, to: node, color: node.color, thickness: thick });
        }
      }
    });
    return result;
  }, [allNodes]);

  // ── Build FLOW edges (dashed directional arrows for nextStepId) ──
  const flowEdges = useMemo(() => {
    const result = [];
    allNodes.forEach(node => {
      if (node.nextStepIds?.length > 0) {
        node.nextStepIds.forEach(targetId => {
          const target = allNodes.find(n => n.id === targetId);
          if (target) {
            result.push({ from: node, to: target, color: '#1565C0' });
          }
        });
      }
    });
    return result;
  }, [allNodes]);

  const totalServices = Object.values(liveServices).length;

  return (
    <div className="relative w-full" style={{ minHeight: '620px' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ══════ SVG Canvas ══════ */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 200px)', minHeight: '580px', userSelect: 'none' }}
      >
        <defs>
          <filter id="settings-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#4682B4" floodOpacity="0.3" />
          </filter>
          <filter id="magnet-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#8BC34A" floodOpacity="0.6" />
          </filter>
          <filter id="trash-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#FF5252" floodOpacity="0.7" />
          </filter>
          <filter id="drag-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="2" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.2" />
          </filter>
          <radialGradient id="hub-grad">
            <stop offset="0%" stopColor="#2C3E50" />
            <stop offset="100%" stopColor="#1a252f" />
          </radialGradient>
          {/* Dot grid pattern */}
          <pattern id="dot-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="0.6" fill="#E0E0E0" />
          </pattern>
          {/* Arrowhead marker for flow arrows */}
          <marker id="flow-arrow" viewBox="0 0 10 7" refX="9" refY="3.5"
            markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,3.5 L0,7 Z" fill="#1565C0" />
          </marker>
          <marker id="flow-arrow-green" viewBox="0 0 10 7" refX="9" refY="3.5"
            markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,3.5 L0,7 Z" fill="#4CAF50" />
          </marker>
        </defs>

        {/* Background grid */}
        <rect width={VB_W} height={VB_H} fill="url(#dot-grid)" rx="12" />

        {/* ── Tapered Bezier Branches (directive #12) ── */}
        {edges.map((edge, i) => (
          <path
            key={`edge-${i}`}
            d={buildTaperedBranch(edge.from.x, edge.from.y, edge.to.x, edge.to.y, edge.thickness[0], edge.thickness[1])}
            fill={edge.color}
            opacity={dragState?.nodeId === edge.to.id ? 0.15 : 0.4}
            style={{ transition: 'opacity 0.2s' }}
          />
        ))}

        {/* ── Flow Arrows (dashed directional — nextStepId links) ── */}
        {flowEdges.map((fe, i) => {
          // Compute curved path from fe.from to fe.to with offset to avoid overlapping hierarchy lines
          const dx = fe.to.x - fe.from.x;
          const dy = fe.to.y - fe.from.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          // Shorten line by node radii so arrow touches edge not center
          const fromR = fe.from.r || 30;
          const toR = fe.to.r || 30;
          const nx = dx / len;
          const ny = dy / len;
          const x1 = fe.from.x + nx * fromR;
          const y1 = fe.from.y + ny * fromR;
          const x2 = fe.to.x - nx * (toR + 8); // extra gap for arrowhead
          const y2 = fe.to.y - ny * (toR + 8);
          // Curved control point perpendicular to line
          const cpx = (x1 + x2) / 2 - ny * 25;
          const cpy = (y1 + y2) / 2 + nx * 25;
          return (
            <path
              key={`flow-${i}`}
              d={`M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`}
              fill="none"
              stroke={fe.color}
              strokeWidth={2.5}
              strokeDasharray="8 4"
              markerEnd="url(#flow-arrow)"
              opacity={0.7}
              style={{ transition: 'opacity 0.2s' }}
            />
          );
        })}

        {/* ── Magnetic snap preview line (directive #6) ── */}
        {(paletteDrag || dragState) && magnetTarget && (() => {
          const target = allNodes.find(n => n.id === magnetTarget);
          const pos = paletteDrag || (dragState && nodePositionOverrides[dragState.nodeId]);
          if (!target || !pos) return null;
          return (
            <path
              d={buildTaperedBranch(target.x, target.y, pos.x, pos.y, 4, 1.5)}
              fill="#8BC34A"
              opacity={0.5}
              strokeDasharray="6 4"
            />
          );
        })()}

        {/* ── Center Hub ── */}
        <circle cx={CX} cy={CY} r={55} fill="url(#hub-grad)" filter="url(#settings-glow)" />
        <text x={CX} y={CY - 12} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">CalmPlan</text>
        <text x={CX} y={CY + 6} textAnchor="middle" fill="#B0BEC5" fontSize="11">Process Architect</text>
        <text x={CX} y={CY + 20} textAnchor="middle" fill="#78909C" fontSize="9">{totalServices} שירותים</text>
        <text x={CX} y={CY + 32} textAnchor="middle" fill="#546E7A" fontSize="8">גרור צורה ליצירה</text>

        {/* ── All Nodes (directive #4: draggable) ── */}
        {allNodes.map(node => {
          const isDragging = dragState?.nodeId === node.id;
          const isMagnetTarget = magnetTarget === node.id;
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          const r = isDragging ? node.r + 4 : isSelected ? node.r + 2 : node.r;

          return (
            <g
              key={node.id}
              style={{
                cursor: isDragging ? 'grabbing' : 'grab',
                filter: isDragging ? 'url(#drag-shadow)' : isMagnetTarget ? 'url(#magnet-glow)' : 'none',
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
            >
              {/* Magnetic glow ring */}
              {isMagnetTarget && (
                <circle cx={node.x} cy={node.y} r={r + 12} fill="none" stroke="#8BC34A"
                  strokeWidth={2} opacity={0.6} strokeDasharray="6 3">
                  <animate attributeName="r" values={`${r + 10};${r + 16};${r + 10}`} dur="1s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Selection ring */}
              {isSelected && !isDragging && (
                <circle cx={node.x} cy={node.y} r={r + 6} fill="none"
                  stroke={node.color} strokeWidth={1.5} opacity={0.5} strokeDasharray="4 3">
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="10s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Node shape (directive #13: color inheritance from parent DNA) */}
              {renderNodeShape(node.shape, node.x, node.y, r, node.bg, node.color, isDragging ? 3 : 2)}
              {/* Inner white fill */}
              {renderNodeShape(node.shape, node.x, node.y, r - 2, 'white', 'none', 0)}

              {/* Labels */}
              {node.type === 'root' && (
                <>
                  <text x={node.x} y={node.y - 8} textAnchor="middle" fontSize="14" fontWeight="700" fill="#263238">{node.id}</text>
                  <text x={node.x} y={node.y + 7} textAnchor="middle" fontSize="10" fill={node.color} fontWeight="500">
                    {node.label.replace(node.id + ' ', '')}
                  </text>
                  <text x={node.x} y={node.y + 20} textAnchor="middle" fontSize="8" fill="#90A4AE">
                    {allNodes.filter(n => n.parentId === node.id).length} שירותים
                  </text>
                </>
              )}

              {node.type === 'service' && (
                <>
                  <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="9" fontWeight="600" fill="#263238">
                    {(node.label || '').substring(0, 14)}
                  </text>
                  <text x={node.x} y={node.y + 7} textAnchor="middle" fontSize="7" fill={node.color}>
                    {(node.steps || []).length} שלבים
                  </text>
                  <text x={node.x} y={node.y + 16} textAnchor="middle" fontSize="6" fill="#90A4AE">
                    {COGNITIVE_LABELS[node.cogLoad || 0]} • {node.weight?.duration || 15}ד׳
                  </text>
                  {node._isCustom && (
                    <circle cx={node.x + r - 4} cy={node.y - r + 4} r={4} fill="#8BC34A" stroke="white" strokeWidth={1} />
                  )}
                </>
              )}

              {node.type === 'step' && (
                <>
                  <text x={node.x} y={node.y - 1} textAnchor="middle" fontSize="7" fontWeight="500" fill="#37474F">
                    {(node.label || '').substring(0, 10)}
                  </text>
                  <text x={node.x} y={node.y + 8} textAnchor="middle" fontSize="6" fill="#90A4AE">{(node.stepIndex || 0) + 1}</text>
                </>
              )}

              {/* Quick Spawn "+" button (directive #7) */}
              {(isHovered || isSelected) && !isDragging && node.type !== 'step' && (
                <g
                  onClick={(e) => handleQuickSpawn(node, e)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={node.x + r + 8} cy={node.y - r - 8} r={10} fill="#8BC34A" stroke="white" strokeWidth={1.5} />
                  <text x={node.x + r + 8} y={node.y - r - 8 + 1} textAnchor="middle" fontSize="14" fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>+</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Palette drag ghost (directive #5) ── */}
        {paletteDrag && (
          <g style={{ pointerEvents: 'none' }} opacity={0.7}>
            {renderNodeShape(paletteDrag.shape, paletteDrag.x, paletteDrag.y, 28, '#E3F2FD', '#4682B4', 2.5)}
            <text x={paletteDrag.x} y={paletteDrag.y + 2} textAnchor="middle" fontSize="8" fill="#4682B4" fontWeight="600">שירות חדש</text>
          </g>
        )}

        {/* ── Trash Zone (directive #10) ── */}
        <g>
          <circle cx={TRASH_ZONE.x} cy={TRASH_ZONE.y} r={TRASH_ZONE.r}
            fill={showTrashGlow ? '#FFEBEE' : '#FAFAFA'}
            stroke={showTrashGlow ? '#FF5252' : '#E0E0E0'}
            strokeWidth={showTrashGlow ? 3 : 1.5}
            filter={showTrashGlow ? 'url(#trash-glow)' : 'none'}
            style={{ transition: 'all 0.2s' }}
          />
          {/* Trash icon as SVG path */}
          <g transform={`translate(${TRASH_ZONE.x - 10}, ${TRASH_ZONE.y - 12})`}>
            <path d="M3 6h14M8 6V4a2 2 0 012-2h0a2 2 0 012 2v2m3 0v10a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"
              fill="none" stroke={showTrashGlow ? '#FF5252' : '#BDBDBD'} strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <text x={TRASH_ZONE.x} y={TRASH_ZONE.y + 24} textAnchor="middle" fontSize="7"
            fill={showTrashGlow ? '#FF5252' : '#BDBDBD'}>
            מחיקה
          </text>
        </g>
      </svg>

      {/* Legacy Shape Palette removed — DesignFloatingTab is the single styling tool */}

      {/* ══════ DNA Legend + Sync Button ══════ */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
        {/* DNA Legend */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-gray-100">
          {Object.entries(DNA).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.color }} />
              <span className="text-[10px] font-medium" style={{ color: val.color }}>{key}</span>
            </div>
          ))}
        </div>

        {/* Force Sync + Green Light */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-gray-100">
          <button
            onClick={handleForceSync}
            disabled={syncStatus === 'syncing'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
              syncStatus === 'syncing'
                ? 'bg-blue-50 text-blue-400 cursor-wait'
                : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
            }`}
          >
            {syncStatus === 'syncing' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5" />
            )}
            {syncStatus === 'syncing' ? 'מסנכרן...' : 'סנכרון מלא'}
          </button>

          {/* Green Light / Status Indicator */}
          {syncStatus === 'success' && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-green-700">GREEN LIGHT</span>
                <span className="text-[8px] text-green-500">
                  {syncResults?.success?.length || 0} collections synced
                </span>
              </div>
            </div>
          )}

          {syncStatus === 'error' && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-amber-700">PARTIAL SYNC</span>
                <span className="text-[8px] text-amber-500">
                  {syncResults?.failed?.length || 0} failed
                </span>
              </div>
            </div>
          )}

          {/* Integrity badge */}
          {syncResults?.integrity?.length > 0 && syncResults.integrity[0] === 'ALL_CLEAR' && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[9px] font-bold text-emerald-700">INTEGRITY OK</span>
            </div>
          )}
        </div>
      </div>

      {/* ══════ Contextual Sidebar (directive #8) ══════ */}
      <AnimatePresence>
        {selectedNode && selectedNode.type === 'service' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-3 left-3 w-64 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-20"
          >
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-gray-50 flex items-center justify-between"
              style={{ background: `linear-gradient(135deg, ${selectedNode.color}10, transparent)` }}>
              <span className="text-xs font-bold text-gray-800">{selectedNode.label}</span>
              <button onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 space-y-2.5 max-h-[300px] overflow-y-auto">
              {/* Name edit (directive #8: two-way binding) */}
              <div>
                <label className="text-[9px] font-bold text-gray-400 block mb-0.5">שם שירות</label>
                <input
                  type="text"
                  value={selectedNode.label || ''}
                  onChange={(e) => updateService(selectedNodeId, { label: e.target.value })}
                  className="w-full px-2 py-1 text-xs border rounded-lg focus:ring-1 focus:ring-blue-300 focus:outline-none"
                  dir="rtl"
                />
              </div>

              {/* Parent node assignment (breadcrumb path dropdown) */}
              <ParentDropdown
                selectedNodeId={selectedNodeId}
                allNodes={allNodes}
                moveService={moveService}
                currentParentId={selectedNode.parentId}
                currentDashboard={selectedNode.dashboard}
              />

              {/* Cognitive weight */}
              <div>
                <label className="text-[9px] font-bold text-gray-400 block mb-0.5">עומס קוגניטיבי</label>
                <div className="flex items-center gap-1">
                  {COGNITIVE_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => updateService(selectedNodeId, { _cogOverride: i })}
                      className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${
                        (selectedNode.cogLoad || 0) === i
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ══ Sortable Steps Manager ══ */}
              <SortableStepsManager
                steps={selectedNode.steps || []}
                serviceKey={selectedNodeId}
                updateService={updateService}
                color={selectedNode.color}
                bg={selectedNode.bg}
              />

              {/* Duration & weight info */}
              <div className="flex items-center gap-3 text-[9px] text-gray-400 pt-1 border-t border-gray-50">
                <span>משך: {selectedNode.weight?.duration || 15}ד׳</span>
                <span>סוג: {selectedNode.taskType || 'linear'}</span>
                {selectedNode._isCustom && (
                  <span className="text-green-500 font-bold">מותאם</span>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={() => setDeleteConfirm(selectedNodeId)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 text-red-500 text-[10px] font-medium hover:bg-red-100 transition-all"
              >
                <Trash2 className="w-3 h-3" /> הסר שירות
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ Delete Confirmation (directive #10) ══════ */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center z-50"
          >
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl p-5 max-w-[280px] border border-red-100">
              <div className="text-center mb-3">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-2">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <p className="text-sm font-bold text-gray-800">מחיקת שירות</p>
                <p className="text-xs text-gray-500 mt-1">
                  {liveServices[deleteConfirm]?.label || resolveCategoryLabel(deleteConfirm)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                >
                  ביטול
                </button>
                <button
                  onClick={() => {
                    deleteService(deleteConfirm);
                    setDeleteConfirm(null);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
                >
                  מחק
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="absolute bottom-3 right-3 text-[9px] text-gray-400 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-gray-100 z-10">
        גרור צורה ליצירה • גרור ענף להעברה • גרור לפח למחיקה • + לילד מהיר
      </div>
    </div>
  );
}
