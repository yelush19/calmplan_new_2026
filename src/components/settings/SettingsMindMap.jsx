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
  CloudUpload, CheckCircle2, AlertCircle, Loader2, Shield, Save,
} from 'lucide-react';

import { resolveCategoryLabel } from '@/utils/categoryLabels';
import {
  loadCompanyTree, invalidateTreeCache, saveCompanyTree,
  saveAndBroadcast, onTreeChange,
  loadSettingFromDb, syncSettingToDb,
  ensureMindMapSync,
} from '@/services/processTreeService';
import { toast } from '@/components/ui/use-toast';

// ── DNA Colors (P-branch identity) — base set, extended dynamically from DB ──
const BASE_DNA = {
  P1: { color: '#0288D1', label: 'P1 שכר', bg: '#E1F5FE', glow: '#0288D140', dashboard: 'payroll' },
  P2: { color: '#7B1FA2', label: 'P2 הנה"ח', bg: '#F3E5F5', glow: '#7B1FA240', dashboard: 'tax' },
  P3: { color: '#D81B60', label: 'P3 ניהול', bg: '#FCE4EC', glow: '#D81B6040', dashboard: 'admin' },
  P4: { color: '#F9A825', label: 'P4 בית', bg: '#FFF8E1', glow: '#F9A82540', dashboard: 'home' },
  P5: { color: '#2E7D32', label: 'P5 דוחות שנתיים', bg: '#E8F5E9', glow: '#2E7D3240', dashboard: 'annual_reports' },
};

// Dynamic color palette for user-created branches (P6, P7, ...)
const DYNAMIC_COLORS = [
  { color: '#9C27B0', glow: '#9C27B040' },
  { color: '#FF5722', glow: '#FF572240' },
  { color: '#00BCD4', glow: '#00BCD440' },
  { color: '#795548', glow: '#79554840' },
  { color: '#607D8B', glow: '#607D8B40' },
];

function getDashboardBranch(dashboard) {
  if (dashboard === 'payroll') return 'P1';
  if (dashboard === 'tax') return 'P2';
  if (dashboard === 'admin' || dashboard === 'additional') return 'P3';
  if (dashboard === 'home') return 'P4';
  if (dashboard === 'annual_reports') return 'P5';
  // Dynamic branches: dashboard may be set to the branch ID directly (e.g., 'P6')
  if (dashboard?.startsWith('P')) return dashboard;
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
  // Use processTreeService's syncSettingToDb which writes directly to
  // calmplan_system_config table (same table ProcessArchitect uses).
  try {
    await syncSettingToDb(key, data);
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
  const MIN_DIST = 65;
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
  const [positionHistory, setPositionHistory] = useState([]); // undo stack
  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'success' | 'error'
  const [syncResults, setSyncResults] = useState(null);
  const [syncTimestamp, setSyncTimestamp] = useState(null);
  // Shapes palette hidden by default — logic preserved, toggle reveals it
  const [showShapePalette, setShowShapePalette] = useState(false);
  // Collapsible branches: Set of branch IDs (P1, P2...) that are collapsed
  const [collapsedBranches, setCollapsedBranches] = useState(new Set());

  // ── Dynamic DNA: merge BASE_DNA with any extra branches from DB (P6+) ──
  const [dbBranches, setDbBranches] = useState({});
  const [mapDirty, setMapDirty] = useState(false);
  const [mapSaving, setMapSaving] = useState(false);
  const [dbTreeRef, setDbTreeRef] = useState({ tree: null, configId: null });
  const [saveBtnPos, setSaveBtnPos] = useState({ x: 80, y: VB_H - 80 });
  const [saveBtnDrag, setSaveBtnDrag] = useState(null);

  // ── Mount: Reconcile localStorage with Supabase (DB is authority) ──
  // localStorage provides instant initial render (stale-while-revalidate).
  // DB data arrives async and REPLACES any stale localStorage values.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      console.log('[MindMap] 🔄 Reconciling localStorage with DB...');

      // 0) Run tree→MindMap sync to clean up stale/deleted nodes
      await ensureMindMapSync();
      if (cancelled) return;

      // 1) Load overrides from DB (may have been updated by ensureMindMapSync)
      const dbOverrides = await loadSettingFromDb('service_overrides');
      if (cancelled) return;
      if (dbOverrides && typeof dbOverrides === 'object' && Object.keys(dbOverrides).length > 0) {
        setOverrides(dbOverrides);
        localStorage.setItem('calmplan_service_overrides', JSON.stringify(dbOverrides));
        console.log('[MindMap] ✅ Overrides reconciled from DB:', Object.keys(dbOverrides).length, 'entries');
      }
      // 2) Load custom services from DB (may have been cleaned by ensureMindMapSync)
      const dbCustom = await loadSettingFromDb('custom_services');
      if (cancelled) return;
      if (dbCustom && typeof dbCustom === 'object') {
        // DB might have an empty object (all deleted) — that's valid, it means "no customs"
        setCustomServices(dbCustom);
        localStorage.setItem('calmplan_custom_services', JSON.stringify(dbCustom));
        console.log('[MindMap] ✅ Custom services reconciled from DB:', Object.keys(dbCustom).length, 'entries');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Central function to refresh branches from DB
  const refreshBranchesFromDb = useCallback(async () => {
    console.log('[MindMap] 🔄 Refreshing branches from DB...');
    invalidateTreeCache();
    try {
      const { tree, configId } = await loadCompanyTree();
      if (!tree?.branches) return;
      setDbTreeRef({ tree, configId });
      const extra = {};
      let dynIdx = 0;
      for (const [branchId, branch] of Object.entries(tree.branches)) {
        if (!BASE_DNA[branchId]) {
          const palette = DYNAMIC_COLORS[dynIdx % DYNAMIC_COLORS.length];
          extra[branchId] = {
            color: palette.color,
            label: `${branchId} ${branch.label}`,
            bg: palette.color + '15',
            glow: palette.glow,
            dashboard: branchId,
          };
          dynIdx++;
        }
      }
      // INTERSECTION CLEANUP: remove dbBranches that no longer exist in DB
      // (handles P6 deleted from Architect but still showing in MindMap)
      setDbBranches(extra); // replaces entirely — deleted branches disappear
      console.log('[MindMap] ✅ Branches refreshed. Dynamic:', Object.keys(extra));

      // Also clean customServices: remove services whose branch no longer exists
      const validBranches = new Set(Object.keys(tree.branches));
      setCustomServices(prev => {
        const cleaned = {};
        let removed = 0;
        for (const [key, svc] of Object.entries(prev)) {
          const branch = getDashboardBranch(svc.dashboard);
          if (validBranches.has(branch) || BASE_DNA[branch]) {
            cleaned[key] = svc;
          } else {
            removed++;
            console.log(`[MindMap] 🧹 Removed orphan service "${key}" (branch "${branch}" deleted)`);
          }
        }
        if (removed > 0) saveCustomServices(cleaned);
        return cleaned;
      });
    } catch (err) {
      console.warn('[MindMap] Could not refresh branches:', err);
    }
  }, []);

  // Load on mount
  useEffect(() => { refreshBranchesFromDb(); }, [refreshBranchesFromDb]);

  // LISTEN for tree changes from Architect / other sources → auto-refresh
  useEffect(() => {
    const unsub = onTreeChange(async (detail) => {
      console.log(`[MindMap] 📡 Received tree-changed from "${detail.source}" — full refresh...`);
      refreshBranchesFromDb();
      // Also re-reconcile custom services from DB (handles deletions from Architect)
      const dbCustom = await loadSettingFromDb('custom_services');
      if (dbCustom && typeof dbCustom === 'object') {
        setCustomServices(dbCustom);
        localStorage.setItem('calmplan_custom_services', JSON.stringify(dbCustom));
        console.log('[MindMap] ✅ Custom services re-reconciled from DB after tree change');
      }
      const dbOverrides = await loadSettingFromDb('service_overrides');
      if (dbOverrides && typeof dbOverrides === 'object' && Object.keys(dbOverrides).length > 0) {
        setOverrides(dbOverrides);
        localStorage.setItem('calmplan_service_overrides', JSON.stringify(dbOverrides));
      }
    });
    return unsub;
  }, [refreshBranchesFromDb]);

  // Merged DNA: base + dynamic branches
  const DNA = useMemo(() => ({ ...BASE_DNA, ...dbBranches }), [dbBranches]);

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
    // Dynamic angle assignment: spread all branches evenly around the center
    const branchKeys = Object.keys(DNA);
    const rootAngles = {};
    branchKeys.forEach((key, idx) => {
      // Base angles for known branches, dynamic for new ones
      const baseAngles = { P1: -Math.PI * 0.8, P2: -Math.PI * 0.4, P3: 0, P4: Math.PI * 0.4, P5: Math.PI * 0.8 };
      if (baseAngles[key] !== undefined) {
        rootAngles[key] = baseAngles[key];
      } else {
        // Distribute dynamic branches in remaining angular space
        const dynamicKeys = branchKeys.filter(k => !baseAngles[k]);
        const dynIdx = dynamicKeys.indexOf(key);
        const startAngle = Math.PI * 0.9; // start after P5
        const spread = (Math.PI * 0.8) / Math.max(dynamicKeys.length, 1);
        rootAngles[key] = startAngle + dynIdx * spread;
      }
    });
    const rootDist = 180;

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
      const dist = Math.max(60, 110 - depth * 18);
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
          r: Math.max(26, Math.min(42, 22 + (svc.label || '').length * 0.8 - depth * 2)), // adaptive to label length
          nextStepIds: svc.nextStepIds || (svc.nextStepId ? [svc.nextStepId] : []),
          isParallel: svc.isParallel || false,
          _isCustom: !!customServices[svc.key],
          _depth: depth,
        };

        nodes.push(node);
        nodeMap[svc.key] = node;

        // Step nodes — sequential chain layout below the parent service
        if (svc.steps && svc.steps.length > 0) {
          const stepGap = 40;  // spacing between consecutive steps
          // Chain direction: away from center, same direction as parent angle
          const chainAngle = angle;
          const chainCos = Math.cos(chainAngle);
          const chainSin = Math.sin(chainAngle);
          const firstDist = 45; // distance from service to first step

          svc.steps.forEach((step, sti) => {
            const saved = savedPositions[`${svc.key}_step_${sti}`];
            const dist = firstDist + sti * stepGap;
            // Each step links to previous step (chain), first links to service
            const stepParentId = sti === 0 ? svc.key : `${svc.key}_step_${sti - 1}`;

            const stepLabel = step.label || step.key;
            const stepR = Math.max(20, Math.min(35, 16 + stepLabel.length * 0.7));
            const stepNode = {
              id: `${svc.key}_step_${sti}`,
              type: 'step',
              label: stepLabel,
              shape: 'pill',
              color: DNA[branch]?.color || '#999',
              bg: DNA[branch]?.bg || '#f5f5f5',
              x: saved?.x ?? node.x + chainCos * dist,
              y: saved?.y ?? node.y + chainSin * dist,
              parentId: stepParentId,
              r: stepR,
              stepIndex: sti,
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
    const repulsed = applyForceRepulsion(nodes);

    // Filter out nodes belonging to collapsed branches (keep root nodes always visible)
    if (collapsedBranches.size > 0) {
      // Build set of all node IDs that belong to collapsed branches
      const hiddenNodes = new Set();
      const markHidden = (nodeId) => {
        repulsed.forEach(n => {
          if (n.parentId === nodeId && n.type !== 'root') {
            hiddenNodes.add(n.id);
            markHidden(n.id);
          }
        });
      };
      collapsedBranches.forEach(branchId => markHidden(branchId));
      return repulsed.filter(n => !hiddenNodes.has(n.id));
    }

    return repulsed;
  }, [DNA, liveServices, savedPositions, selectedNodeId, customServices, collapsedBranches]);

  // ── Display nodes: layout positions + drag overrides (no re-layout during drag) ──
  const displayNodes = useMemo(() => {
    if (Object.keys(nodePositionOverrides).length === 0) return allNodes;
    return allNodes.map(n => {
      const override = nodePositionOverrides[n.id];
      return override ? { ...n, x: override.x, y: override.y } : n;
    });
  }, [allNodes, nodePositionOverrides]);

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
    setMapDirty(true);
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
    setMapDirty(true);
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
    // Use displayNodes (with overrides) for correct visual position
    const node = displayNodes.find(n => n.id === nodeId);
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
  }, [displayNodes, svgPoint]);

  const handleMouseMove = useCallback((e) => {
    // Save button drag
    if (saveBtnDrag) {
      const pt = svgPoint(e.clientX, e.clientY);
      setSaveBtnPos({ x: Math.max(30, Math.min(VB_W - 30, pt.x - saveBtnDrag.offsetX)), y: Math.max(30, Math.min(VB_H - 30, pt.y - saveBtnDrag.offsetY)) });
      return;
    }
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

      // Get dragged node info for snap checks (from layout, not overrides)
      const draggedNode = allNodes.find(n => n.id === dragState.nodeId);
      const directChildren = allNodes.filter(n => n.parentId === dragState.nodeId);

      setNodePositionOverrides(prev => {
        // Use CURRENT override position to calculate child delta (prevents jumping)
        const currentPos = prev[dragState.nodeId] || { x: draggedNode?.x || dragState.startX, y: draggedNode?.y || dragState.startY };
        const deltaX = newX - currentPos.x;
        const deltaY = newY - currentPos.y;

        const next = { ...prev, [dragState.nodeId]: { x: newX, y: newY } };
        // Move direct children along with parent
        for (const child of directChildren) {
          const childCurrent = prev[child.id] || { x: child.x, y: child.y };
          next[child.id] = {
            x: childCurrent.x + deltaX,
            y: childCurrent.y + deltaY,
          };
        }
        return next;
      });

      // Check magnetic snap for reassignment (directive #6, #9)
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
  }, [dragState, paletteDrag, allNodes, svgPoint, saveBtnDrag]);

  const handleMouseUp = useCallback((e) => {
    // ── Save button drag release ──
    if (saveBtnDrag) { setSaveBtnDrag(null); return; }
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

      // Persist position (including direct children that moved as a group)
      if (dragState.hasMoved) {
        const directChildren = allNodes.filter(n => n.parentId === dragState.nodeId);

        // Save undo snapshot BEFORE persisting
        setSavedPositions(prev => {
          setPositionHistory(h => [...h.slice(-19), { ...prev }]); // keep last 20
          const next = { ...prev, [dragState.nodeId]: { x: finalPos.x, y: finalPos.y } };
          for (const child of directChildren) {
            const childPos = nodePositionOverrides[child.id];
            if (childPos) {
              next[child.id] = { x: childPos.x, y: childPos.y };
            }
          }
          saveNodePositions(next);
          return next;
        });
        // Clear overrides since they're now saved
        setNodePositionOverrides(prev => {
          const next = { ...prev };
          delete next[dragState.nodeId];
          for (const child of directChildren) {
            delete next[child.id];
          }
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
  }, [dragState, paletteDrag, allNodes, magnetTarget, svgPoint, createService, moveService, nodePositionOverrides, saveBtnDrag]);

  // ── Undo position changes (Ctrl+Z) ──
  const handleUndo = useCallback(() => {
    setPositionHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setSavedPositions(last);
      saveNodePositions(last);
      setNodePositionOverrides({});
      return prev.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo]);

  // ── Quick Spawn "+" (directive #7) — Creates a child task/service under the selected node ──
  // Full feedback chain: loading → DB write → toast → force re-render
  const [spawnLoading, setSpawnLoading] = useState(false);
  const spawnLoadingRef = React.useRef(false);
  const handleQuickSpawn = useCallback(async (parentNode, e) => {
    e.stopPropagation();
    if (spawnLoadingRef.current) return; // prevent double-click (ref avoids stale closure)
    spawnLoadingRef.current = true;
    setSpawnLoading(true);

    const branch = parentNode.type === 'root' ? parentNode.id : getDashboardBranch(parentNode.dashboard);
    const dashboard = DNA[branch]?.dashboard || branch; // use branch ID as fallback (not 'admin')
    const parentId = parentNode.id;
    const key = `custom_${Date.now()}`;

    console.log(`[MindMap QuickSpawn] ▶ START: creating node "${key}" under parent "${parentId}" in branch "${branch}" (dashboard: "${dashboard}")`);

    // 1) Create local service (state + localStorage)
    const createdKey = createService({ key, dashboard, label: 'שירות חדש', parentId });
    console.log(`[MindMap QuickSpawn] ✅ Local service created: ${createdKey}`);

    // 2) Position near parent
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 40;
    setSavedPositions(prev => {
      const next = { ...prev, [createdKey]: { x: parentNode.x + Math.cos(angle) * dist, y: parentNode.y + Math.sin(angle) * dist } };
      saveNodePositions(next);
      return next;
    });
    setSelectedNodeId(createdKey);
    setMapDirty(true);

    // 3) Sync to DB process tree (WITH feedback)
    try {
      console.log(`[MindMap QuickSpawn] 🔄 Syncing to DB...`);
      const dbResult = await syncNewNodeToDbTree(branch, createdKey, 'שירות חדש', parentId);
      if (dbResult.success) {
        console.log(`[MindMap QuickSpawn] ✅ DB sync success:`, dbResult);
        toast({ title: 'צומת נוסף בהצלחה', description: `"שירות חדש" נוסף לענף ${branch}` });
      } else {
        console.warn(`[MindMap QuickSpawn] ⚠️ DB sync partial — node saved locally only:`, dbResult.reason);
        toast({ title: 'נשמר מקומית בלבד', description: dbResult.reason, variant: 'destructive' });
      }
    } catch (err) {
      console.error(`[MindMap QuickSpawn] ❌ DB sync FAILED:`, err);
      toast({ title: 'שגיאה בשמירה ל-DB', description: err.message || 'שגיאה לא ידועה', variant: 'destructive' });
      // Rollback: DB is authority — if DB write failed, remove from local state
      setCustomServices(prev => {
        const next = { ...prev };
        delete next[createdKey];
        saveCustomServices(next);
        return next;
      });
      setSelectedNodeId(null);
      console.log(`[MindMap QuickSpawn] 🔄 Rolled back local service "${createdKey}" — DB write failed`);
    }
    spawnLoadingRef.current = false;
    setSpawnLoading(false);
  }, [createService, DNA]);

  // ── Sync a newly-created node into the DB process tree ──
  // Returns { success: boolean, reason?: string } for feedback chain
  const syncNewNodeToDbTree = useCallback(async (branchId, nodeId, label, parentNodeId) => {
    console.log(`[MindMap SyncDB] Loading tree to insert node "${nodeId}" into branch "${branchId}"...`);
    invalidateTreeCache();
    const { tree, configId } = await loadCompanyTree();

    if (!tree) {
      return { success: false, reason: 'לא נמצא עץ תהליכים ב-DB' };
    }

    if (!tree.branches?.[branchId]) {
      console.warn(`[MindMap SyncDB] Branch "${branchId}" not found in DB tree. Available branches:`, Object.keys(tree.branches || {}));
      return { success: false, reason: `ענף ${branchId} לא נמצא ב-DB — יש לשמור אותו קודם מ-Process Architect` };
    }

    const newNode = {
      id: nodeId,
      label,
      service_key: nodeId,
      is_parent_task: false,
      default_frequency: 'monthly',
      frequency_field: null,
      frequency_fallback: null,
      frequency_inherit: false,
      depends_on: parentNodeId && parentNodeId !== branchId ? [parentNodeId] : [],
      execution: 'sequential',
      is_collector: false,
      children: [],
      steps: [],
    };

    // Find the parent node recursively and add as child
    const addToTree = (nodes) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === parentNodeId) {
          nodes[i] = { ...nodes[i], children: [...(nodes[i].children || []), newNode] };
          console.log(`[MindMap SyncDB] ✅ Inserted under parent "${parentNodeId}" in recursive tree`);
          return true;
        }
        if (nodes[i].children?.length && addToTree(nodes[i].children)) return true;
      }
      return false;
    };

    const branch = { ...tree.branches[branchId] };
    const children = [...(branch.children || [])];
    const foundParent = addToTree(children);
    if (!foundParent) {
      // Parent not found in children — add to branch root level
      children.push(newNode);
      console.log(`[MindMap SyncDB] Parent "${parentNodeId}" not found in children — added to branch root`);
    }
    branch.children = children;

    const updatedTree = { ...tree, branches: { ...tree.branches, [branchId]: branch } };
    console.log(`[MindMap SyncDB] Saving updated tree with new node...`, {
      branchId,
      nodeId,
      totalChildren: children.length,
      configId,
    });

    const saved = await saveAndBroadcast(updatedTree, configId, 'MindMap:QuickSpawn');

    // Update local ref so floating save button knows about this
    setDbTreeRef({ tree: updatedTree, configId: saved.configId });

    console.log(`[MindMap SyncDB] ✅ Node "${nodeId}" saved to DB successfully`);
    return { success: true };
  }, []);

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
      // Merge steps from DB tree (ProcessArchitect) if they exist
      let mergedSteps = selectedNode.steps || [];
      if (dbTreeRef.tree?.branches) {
        const findNodeInTree = (nodes, id) => {
          for (const n of (nodes || [])) {
            if (n.id === id || n.service_key === id) return n;
            if (n.children?.length) {
              const found = findNodeInTree(n.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        for (const branch of Object.values(dbTreeRef.tree.branches)) {
          const treeNode = findNodeInTree(branch.children, selectedNodeId);
          if (treeNode?.steps?.length > 0 && mergedSteps.length === 0) {
            // DB tree has steps but local doesn't — use DB tree steps
            mergedSteps = treeNode.steps.map((s, i) => ({
              key: s.key || `step_${i}`,
              label: s.label,
              icon: s.icon || 'check-circle',
              sort_order: i,
              parent_service: selectedNodeId,
            }));
            break;
          }
        }
      }
      onSelectService?.({
        ...selectedNode,
        steps: mergedSteps,
        _crud: { updateService, deleteService, moveService, createService },
        _liveServices: liveServices,
        _allNodes: allNodes,
        _isCustom: !!customServices[selectedNodeId],
      });
    } else {
      onSelectService?.(null);
    }
  }, [selectedNodeId, selectedNode?.type, selectedNode?.parentId, allNodes.length, liveServices, dbTreeRef.tree]);

  // ── Build hierarchy edges (solid tapered branches) ──
  const edges = useMemo(() => {
    const result = [];
    displayNodes.forEach(node => {
      if (node.parentId === 'hub') {
        result.push({ from: { x: CX, y: CY }, to: node, color: node.color, thickness: [8, 3] });
      } else {
        const parent = displayNodes.find(n => n.id === node.parentId);
        if (parent) {
          const thick = node.type === 'step' ? [2.5, 0.8] : [4, 1.5];
          result.push({ from: parent, to: node, color: node.color, thickness: thick });
        }
      }
    });
    return result;
  }, [displayNodes]);

  // ── Build FLOW edges (dashed directional arrows for nextStepId) ──
  const flowEdges = useMemo(() => {
    const result = [];
    displayNodes.forEach(node => {
      if (node.nextStepIds?.length > 0) {
        node.nextStepIds.forEach(targetId => {
          const target = displayNodes.find(n => n.id === targetId);
          if (target) {
            result.push({ from: node, to: target, color: '#1565C0' });
          }
        });
      }
    });
    return result;
  }, [displayNodes]);

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
          <clipPath id="hub-clip"><circle cx={CX} cy={CY} r={50} /></clipPath>
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
          const target = displayNodes.find(n => n.id === magnetTarget);
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

        {/* ── Center Hub — Logo ── */}
        <circle cx={CX} cy={CY} r={55} fill="white" />
        <image
          href={`${window.location.origin}/logo-litay.png`}
          x={CX - 50} y={CY - 50}
          width={100} height={100}
          clipPath="url(#hub-clip)"
          preserveAspectRatio="xMidYMid slice"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <circle cx={CX} cy={CY} r={55} fill="none" stroke="#66BB6A" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={CX} y={CY + 48} textAnchor="middle" fill="#78909C" fontSize="9">{totalServices} שירותים</text>

        {/* ── All Nodes (directive #4: draggable) ── */}
        {displayNodes.map(node => {
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
              {node.type === 'root' && (() => {
                const isCollapsed = collapsedBranches.has(node.id);
                const childCount = displayNodes.filter(n => n.parentId === node.id).length;
                return (
                  <>
                    <text x={node.x} y={node.y - 8} textAnchor="middle" fontSize="14" fontWeight="700" fill="#263238">{node.id}</text>
                    <text x={node.x} y={node.y + 7} textAnchor="middle" fontSize="10" fill={node.color} fontWeight="500">
                      {node.label.replace(node.id + ' ', '')}
                    </text>
                    <text x={node.x} y={node.y + 20} textAnchor="middle" fontSize="8" fill="#90A4AE">
                      {isCollapsed ? `(${childCount} מוסתרים)` : `${childCount} שירותים`}
                    </text>
                    {/* Collapse/Expand toggle button */}
                    <g
                      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollapsedBranches(prev => {
                          const next = new Set(prev);
                          if (next.has(node.id)) next.delete(node.id);
                          else next.add(node.id);
                          return next;
                        });
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle cx={node.x + r + 6} cy={node.y + r + 6} r={9} fill="white" stroke={node.color} strokeWidth={1.5} />
                      <text x={node.x + r + 6} y={node.y + r + 6 + 1} textAnchor="middle" fontSize="12" fontWeight="bold" fill={node.color} style={{ pointerEvents: 'none' }}>
                        {isCollapsed ? '▶' : '▼'}
                      </text>
                    </g>
                  </>
                );
              })()}

              {node.type === 'service' && (() => {
                const label = node.label || '';
                const maxCharsPerLine = Math.max(8, Math.floor(r * 2.2 / 5));
                // Split label into wrapped lines
                const lines = [];
                if (label.length <= maxCharsPerLine) {
                  lines.push(label);
                } else {
                  // Try to split at space boundaries
                  const words = label.split(/\s+/);
                  let currentLine = '';
                  for (const word of words) {
                    if (currentLine && (currentLine + ' ' + word).length > maxCharsPerLine) {
                      lines.push(currentLine);
                      currentLine = word;
                    } else {
                      currentLine = currentLine ? currentLine + ' ' + word : word;
                    }
                  }
                  if (currentLine) lines.push(currentLine);
                  // Cap at 2 lines max
                  if (lines.length > 2) {
                    lines.length = 2;
                    lines[1] = lines[1].substring(0, maxCharsPerLine - 1) + '…';
                  }
                }
                const lineHeight = 11;
                const labelStartY = node.y - (lines.length - 1) * lineHeight / 2 - 4;
                return (
                  <>
                    {lines.map((line, li) => (
                      <text key={li} x={node.x} y={labelStartY + li * lineHeight} textAnchor="middle" fontSize="9" fontWeight="600" fill="#263238">
                        {line}
                      </text>
                    ))}
                    <text x={node.x} y={labelStartY + lines.length * lineHeight} textAnchor="middle" fontSize="7" fill={node.color}>
                      {(node.steps || []).length} שלבים
                    </text>
                    <text x={node.x} y={labelStartY + lines.length * lineHeight + 9} textAnchor="middle" fontSize="6" fill="#90A4AE">
                      {COGNITIVE_LABELS[node.cogLoad || 0]} • {node.weight?.duration || 15}ד׳
                    </text>
                    {node._isCustom && (
                      <circle cx={node.x + r - 4} cy={node.y - r + 4} r={4} fill="#8BC34A" stroke="white" strokeWidth={1} />
                    )}
                    {/* Collapse/Expand toggle for services with children */}
                    {(() => {
                      const childCount = displayNodes.filter(n => n.parentId === node.id).length;
                      if (childCount === 0 && !collapsedBranches.has(node.id)) return null;
                      // Also count hidden children when collapsed
                      const totalChildren = allNodes.filter(n => n.parentId === node.id).length;
                      if (totalChildren === 0) return null;
                      const isCollapsed = collapsedBranches.has(node.id);
                      return (
                        <g
                          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollapsedBranches(prev => {
                              const next = new Set(prev);
                              if (next.has(node.id)) next.delete(node.id);
                              else next.add(node.id);
                              return next;
                            });
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle cx={node.x + r + 5} cy={node.y + r + 5} r={8} fill="white" stroke={node.color} strokeWidth={1.5} />
                          <text x={node.x + r + 5} y={node.y + r + 5 + 1} textAnchor="middle" fontSize="10" fontWeight="bold" fill={node.color} style={{ pointerEvents: 'none' }}>
                            {isCollapsed ? '▶' : '▼'}
                          </text>
                        </g>
                      );
                    })()}
                  </>
                );
              })()}

              {node.type === 'step' && (() => {
                const label = node.label || '';
                const maxChars = 12;
                const lines = [];
                if (label.length <= maxChars) {
                  lines.push(label);
                } else {
                  const words = label.split(/\s+/);
                  let currentLine = '';
                  for (const word of words) {
                    if (currentLine && (currentLine + ' ' + word).length > maxChars) {
                      lines.push(currentLine);
                      currentLine = word;
                    } else {
                      currentLine = currentLine ? currentLine + ' ' + word : word;
                    }
                  }
                  if (currentLine) lines.push(currentLine);
                  if (lines.length > 2) {
                    lines.length = 2;
                    lines[1] = lines[1].substring(0, maxChars - 1) + '…';
                  }
                }
                const startY = node.y - (lines.length * 4);
                return (
                  <>
                    {lines.map((line, li) => (
                      <text key={li} x={node.x} y={startY + li * 9} textAnchor="middle" fontSize="7" fontWeight="500" fill="#37474F">
                        {line}
                      </text>
                    ))}
                    <text x={node.x} y={startY + lines.length * 9} textAnchor="middle" fontSize="6" fill="#90A4AE">{(node.stepIndex || 0) + 1}</text>
                  </>
                );
              })()}

              {/* Quick Spawn "+" button (directive #7) */}
              {(isHovered || isSelected) && !isDragging && node.type !== 'step' && (
                <g
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  onClick={(e) => { e.stopPropagation(); handleQuickSpawn(node, e); }}
                  style={{ cursor: spawnLoading ? 'wait' : 'pointer', opacity: spawnLoading ? 0.5 : 1 }}
                >
                  <circle cx={node.x + r + 8} cy={node.y - r - 8} r={10} fill={spawnLoading ? '#FFC107' : '#8BC34A'} stroke="white" strokeWidth={1.5} />
                  <text x={node.x + r + 8} y={node.y - r - 8 + 1} textAnchor="middle" fontSize={spawnLoading ? 10 : 14} fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>
                    {spawnLoading ? '⏳' : '+'}
                  </text>
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

        {/* ── Draggable Save Circle ── */}
        {mapDirty && (
          <g
            style={{ cursor: saveBtnDrag ? 'grabbing' : 'grab' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const pt = svgPoint(e.clientX, e.clientY);
              setSaveBtnDrag({ offsetX: pt.x - saveBtnPos.x, offsetY: pt.y - saveBtnPos.y });
            }}
            onClick={async (e) => {
              e.stopPropagation();
              if (mapSaving) return;
              setMapSaving(true);
              console.log('[MindMap SaveCircle] ▶ Starting save...');
              try {
                invalidateTreeCache();
                const { tree, configId } = await loadCompanyTree();
                if (!tree) { toast({ title: 'שגיאה', description: 'לא נמצא עץ תהליכים ב-DB', variant: 'destructive' }); setMapSaving(false); return; }
                let merged = { ...tree };
                for (const [key, svc] of Object.entries(customServices)) {
                  if (ALL_SERVICES[key]) continue;
                  const branch = getDashboardBranch(svc.dashboard);
                  if (!merged.branches?.[branch]) continue;
                  const existsInTree = (nodes) => { for (const n of (nodes || [])) { if (n.id === key) return true; if (n.children?.length && existsInTree(n.children)) return true; } return false; };
                  if (!existsInTree(merged.branches[branch].children)) {
                    const brObj = { ...merged.branches[branch] };
                    brObj.children = [...(brObj.children || []), { id: key, label: svc.label || 'שירות חדש', service_key: key, is_parent_task: false, default_frequency: 'monthly', depends_on: svc.parentId && svc.parentId !== branch ? [svc.parentId] : [], execution: 'sequential', children: [], steps: [] }];
                    merged = { ...merged, branches: { ...merged.branches, [branch]: brObj } };
                  }
                }
                const saved = await saveAndBroadcast(merged, configId, 'MindMap:FloatSave');
                setDbTreeRef({ tree: merged, configId: saved.configId });
                setMapDirty(false);
                console.log('[MindMap SaveCircle] ✅ Saved');
                toast({ title: 'נשמר בהצלחה', description: 'כל השינויים נשמרו ל-DB' });
              } catch (err) {
                console.error('[MindMap SaveCircle] ❌ Save failed:', err);
                toast({ title: 'שגיאה בשמירה', description: err.message || 'שגיאה לא ידועה', variant: 'destructive' });
              }
              setMapSaving(false);
            }}
          >
            {/* Circle background */}
            <circle cx={saveBtnPos.x} cy={saveBtnPos.y} r={24}
              fill={mapSaving ? '#FFC107' : '#43A047'} stroke="white" strokeWidth={2.5}
              filter="url(#drag-shadow)"
              style={{ transition: 'fill 0.2s' }}
            />
            {/* Icon or spinner */}
            {mapSaving
              ? <circle cx={saveBtnPos.x} cy={saveBtnPos.y} r="8" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="12 6" style={{ pointerEvents: 'none' }}>
                  <animateTransform attributeName="transform" type="rotate" from={`0 ${saveBtnPos.x} ${saveBtnPos.y}`} to={`360 ${saveBtnPos.x} ${saveBtnPos.y}`} dur="0.8s" repeatCount="indefinite" />
                </circle>
              : <g transform={`translate(${saveBtnPos.x - 7}, ${saveBtnPos.y - 7})`} style={{ pointerEvents: 'none' }}>
                  <path d="M2 1h10l2 2v10H0V1h2zm2 0v4h6V1H4zm1 7h4v5H5V8z" fill="white" />
                </g>
            }
            {/* Label */}
            <text x={saveBtnPos.x} y={saveBtnPos.y + 20} textAnchor="middle" fontSize="7" fontWeight="bold"
              fill={mapSaving ? '#F57F17' : '#2E7D32'} style={{ pointerEvents: 'none' }}>
              {mapSaving ? 'שומר...' : 'שמור'}
            </text>
          </g>
        )}

        {/* ── Undo button ── */}
        {positionHistory.length > 0 && (
          <g style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); handleUndo(); }}>
            <circle cx={saveBtnPos.x + 55} cy={saveBtnPos.y} r={20}
              fill="#5C6BC0" stroke="white" strokeWidth={2}
              filter="url(#drag-shadow)" />
            <g transform={`translate(${saveBtnPos.x + 55 - 7}, ${saveBtnPos.y - 7})`} style={{ pointerEvents: 'none' }}>
              <path d="M7 1C4.2 1 2 3.2 2 6h-2l3 3 3-3H4c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3v2c2.8 0 5-2.2 5-5S9.8 1 7 1z" fill="white" />
            </g>
            <text x={saveBtnPos.x + 55} y={saveBtnPos.y + 17} textAnchor="middle" fontSize="7" fontWeight="bold"
              fill="#3949AB" style={{ pointerEvents: 'none' }}>
              ביטול ({positionHistory.length})
            </text>
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

      {/* Save button moved inside SVG as draggable circle */}

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

              {/* Save to DB button */}
              <button
                onClick={async () => {
                  setMapSaving(true);
                  try {
                    invalidateTreeCache();
                    const { tree, configId: cid } = await loadCompanyTree();
                    if (!tree) throw new Error('No tree in DB');
                    // Update node label in tree if it's a custom service
                    let merged = { ...tree };
                    const svc = liveServices[selectedNodeId];
                    if (svc) {
                      const branch = getDashboardBranch(svc.dashboard);
                      if (merged.branches?.[branch]) {
                        const updateNodeInTree = (nodes) => nodes.map(n => {
                          if (n.id === selectedNodeId) return { ...n, label: svc.label || n.label };
                          if (n.children?.length) return { ...n, children: updateNodeInTree(n.children) };
                          return n;
                        });
                        merged = { ...merged, branches: { ...merged.branches, [branch]: { ...merged.branches[branch], children: updateNodeInTree(merged.branches[branch].children || []) } } };
                      }
                    }
                    // Also merge any missing custom services
                    for (const [key, cs] of Object.entries(customServices)) {
                      if (ALL_SERVICES[key]) continue;
                      const br = getDashboardBranch(cs.dashboard);
                      if (!merged.branches?.[br]) continue;
                      const exists = (nodes) => nodes.some(n => n.id === key || (n.children?.length && exists(n.children)));
                      if (!exists(merged.branches[br].children || [])) {
                        merged.branches[br] = { ...merged.branches[br], children: [...(merged.branches[br].children || []), { id: key, label: cs.label || 'שירות חדש', service_key: key, is_parent_task: false, default_frequency: 'monthly', depends_on: [], execution: 'sequential', children: [], steps: [] }] };
                      }
                    }
                    await saveAndBroadcast(merged, cid, 'MindMap:SidebarSave');
                    setMapDirty(false);
                    toast({ title: 'נשמר ל-DB', description: 'השינויים נשמרו בהצלחה' });
                  } catch (err) {
                    toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
                  }
                  setMapSaving(false);
                }}
                disabled={mapSaving}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-green-50 text-green-600 text-[10px] font-bold hover:bg-green-100 transition-all border border-green-200"
              >
                {mapSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {mapSaving ? 'שומר...' : 'שמור ל-DB'}
              </button>

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
