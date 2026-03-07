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
import {
  Trash2, Plus, GripVertical, Cloud, Circle, Diamond, Star,
  MessageCircle, X, ChevronRight, Move, Zap, Minus, ListOrdered,
} from 'lucide-react';

// ── DNA Colors (P-branch identity) ──
const DNA = {
  P1: { color: '#00A3E0', label: 'P1 שכר', bg: '#00A3E015', glow: '#00A3E040', dashboard: 'payroll' },
  P2: { color: '#B2AC88', label: 'P2 הנה"ח', bg: '#B2AC8815', glow: '#B2AC8840', dashboard: 'tax' },
  P3: { color: '#E91E63', label: 'P3 ביצוע', bg: '#E91E6315', glow: '#E91E6340', dashboard: 'admin' },
  P4: { color: '#FFC107', label: 'P4 בית', bg: '#FFC10715', glow: '#FFC10740', dashboard: 'home' },
};

function getDashboardBranch(dashboard) {
  if (dashboard === 'payroll') return 'P1';
  if (dashboard === 'tax') return 'P2';
  if (dashboard === 'admin' || dashboard === 'additional') return 'P3';
  return 'P4';
}

const BOARD_OPTIONS = [
  { key: 'payroll', label: 'שכר (P1)', branch: 'P1' },
  { key: 'tax', label: 'הנה"ח (P2)', branch: 'P2' },
  { key: 'admin', label: 'ניהול (P3)', branch: 'P3' },
  { key: 'additional', label: 'נוספים (P3)', branch: 'P3' },
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

// ── Persistence ──
function loadOverrides() {
  try { return JSON.parse(localStorage.getItem('calmplan_service_overrides') || '{}'); }
  catch { return {}; }
}
function saveOverrides(o) { localStorage.setItem('calmplan_service_overrides', JSON.stringify(o)); }
function loadCustomServices() {
  try { return JSON.parse(localStorage.getItem('calmplan_custom_services') || '{}'); }
  catch { return {}; }
}
function saveCustomServices(c) { localStorage.setItem('calmplan_custom_services', JSON.stringify(c)); }
function loadNodePositions() {
  try { return JSON.parse(localStorage.getItem('calmplan_node_positions') || '{}'); }
  catch { return {}; }
}
function saveNodePositions(p) { localStorage.setItem('calmplan_node_positions', JSON.stringify(p)); }

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

  // ── Build LIVE service registry (directive #1, #2, #3) ──
  const liveServices = useMemo(() => {
    const merged = {};
    for (const [key, svc] of Object.entries(ALL_SERVICES)) {
      if (overrides[key]?._hidden) continue;
      merged[key] = { ...svc, ...(overrides[key] || {}) };
    }
    for (const [key, svc] of Object.entries(customServices)) {
      merged[key] = { ...svc };
    }
    return merged;
  }, [overrides, customServices]);

  // ── Build node tree: center → P-roots → services → steps ──
  const allNodes = useMemo(() => {
    const nodes = [];
    const rootAngles = { P1: -Math.PI * 0.75, P2: -Math.PI * 0.25, P3: Math.PI * 0.25, P4: Math.PI * 0.75 };
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

    // Service nodes grouped by branch
    const groups = { P1: [], P2: [], P3: [], P4: [] };
    Object.values(liveServices).forEach(svc => {
      const branch = getDashboardBranch(svc.dashboard);
      groups[branch].push(svc);
    });

    Object.entries(groups).forEach(([branch, services]) => {
      const rootNode = nodes.find(n => n.id === branch);
      if (!rootNode) return;
      const serviceDist = 130;
      const spreadAngle = Math.PI * 0.7;
      const count = services.length || 1;

      services.forEach((svc, si) => {
        const baseAngle = rootAngles[branch] - spreadAngle / 2;
        const sAngle = count === 1 ? rootAngles[branch] : baseAngle + (spreadAngle * si) / Math.max(1, count - 1);
        const saved = savedPositions[svc.key];
        const weight = getServiceWeight(svc.createCategory || svc.taskCategories?.[0]);

        nodes.push({
          id: svc.key,
          type: 'service',
          label: svc.label || svc.key,
          shape: 'bubble',
          color: DNA[branch].color,
          bg: DNA[branch].bg,
          x: saved?.x ?? rootNode.x + Math.cos(sAngle) * serviceDist,
          y: saved?.y ?? rootNode.y + Math.sin(sAngle) * serviceDist,
          parentId: branch,
          dashboard: svc.dashboard,
          steps: svc.steps || [],
          weight,
          cogLoad: weight?.cognitiveLoad || 0,
          r: 30,
          _isCustom: !!customServices[svc.key],
          ...nodePositionOverrides[svc.key],
        });

        // Step nodes (only if service is selected)
        if (selectedNodeId === svc.key && svc.steps) {
          const stepDist = 75;
          const stepSpread = Math.PI * 0.5;
          const stCount = svc.steps.length;
          svc.steps.forEach((step, sti) => {
            const stBase = sAngle - stepSpread / 2;
            const stAngle = stCount === 1 ? sAngle : stBase + (stepSpread * sti) / Math.max(1, stCount - 1);
            const svcNode = nodes.find(n => n.id === svc.key);
            const px = svcNode?.x ?? rootNode.x + Math.cos(sAngle) * serviceDist;
            const py = svcNode?.y ?? rootNode.y + Math.sin(sAngle) * serviceDist;
            const saved = savedPositions[`${svc.key}_step_${sti}`];

            nodes.push({
              id: `${svc.key}_step_${sti}`,
              type: 'step',
              label: step.label || step.key,
              shape: 'pill',
              color: DNA[branch].color,
              bg: DNA[branch].bg,
              x: saved?.x ?? px + Math.cos(stAngle) * stepDist,
              y: saved?.y ?? py + Math.sin(stAngle) * stepDist,
              parentId: svc.key,
              r: 20,
              stepIndex: sti,
              ...nodePositionOverrides[`${svc.key}_step_${sti}`],
            });
          });
        }
      });
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
    const svc = {
      key,
      label: newService.label || 'שירות חדש',
      dashboard: newService.dashboard || 'admin',
      taskCategories: [key],
      createCategory: key,
      steps: [{ key: 'task', label: 'ביצוע', icon: 'check-circle' }],
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

  // ── Quick Spawn "+" (directive #7) ──
  const handleQuickSpawn = useCallback((parentNode, e) => {
    e.stopPropagation();
    const branch = parentNode.type === 'root' ? parentNode.id : getDashboardBranch(parentNode.dashboard);
    const dashboard = DNA[branch]?.dashboard || 'admin';
    const key = createService({ dashboard, label: 'שירות חדש' });

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
  }, [selectedNodeId, selectedNode?.type]);

  // ── Build edges for rendering ──
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

      {/* ══════ Shape Palette (directive #5) ══════ */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-2 z-10">
        <div className="text-[9px] font-bold text-gray-400 mb-1.5 px-1 flex items-center gap-1">
          <Zap className="w-3 h-3" /> צורות
        </div>
        <div className="flex flex-col gap-1">
          {PALETTE_SHAPES.map(shape => {
            const Icon = shape.icon;
            return (
              <button
                key={shape.key}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-all cursor-grab active:cursor-grabbing group text-right"
                onMouseDown={(e) => handlePaletteDragStart(shape.key, e)}
                title={`גרור ${shape.label} לקנבס`}
              >
                <Icon className="w-4 h-4 text-[#4682B4] group-hover:text-[#E91E63] transition-colors" />
                <span className="text-[10px] text-gray-600 font-medium">{shape.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════ DNA Legend ══════ */}
      <div className="absolute top-3 right-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-gray-100 z-10">
        {Object.entries(DNA).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.color }} />
            <span className="text-[10px] font-medium" style={{ color: val.color }}>{key}</span>
          </div>
        ))}
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
                  {liveServices[deleteConfirm]?.label || deleteConfirm}
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
