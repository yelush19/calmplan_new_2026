/**
 * ── AyoaRadialView: 360° Circular Radial Layout (Directive #5, Lens 2) ──
 *
 * DIRECTIVE #7: Strict Hierarchy & Physics
 *   Root → דיווחין (Reports) → שירותים (Services) → ייצור (Production) → גודל (Size)
 *   Uses Sin/Cos math to position nodes PERFECTLY in concentric rings.
 *   Tapered cubic bezier curves (thick at root, thin at leaf).
 *   Absolute SVG coordinates only (NO percentages in paths).
 *   Nodes spread far apart so text is readable.
 *
 * DIRECTIVE #10: Typography & Lights
 *   No pale gray text. Semi-bold/Bold labels. High contrast.
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { renderNodeShape, buildTaperedBranch } from './AyoaNode';
import { getConnectionProps } from '@/engines/lineStyleEngine';
import { useDesign } from '@/contexts/DesignContext';
import { getActiveBranches } from '@/engines/automationEngine';
import { resolveCategoryLabel } from '@/utils/categoryLabels';
import { ServiceCatalog, Task } from '@/api/entities';
import { Plus } from 'lucide-react';
import FloatingToolbar from './FloatingToolbar';

const VB = 1000;
const CX = VB / 2, CY = VB / 2;

// Ring radii — concentric hierarchy, well-spaced
const RINGS = {
  center: 55,
  ring1: 180,   // דיווחין / Reports (category level)
  ring2: 320,   // שירותים / Services (task items)
  ring3: 440,   // ייצור / Production status (completed tasks)
};

// Default DNA — overridden by Design Engine branchColors
const DNA_DEFAULTS = {
  P1: '#00A3E0', P2: '#4682B4', P3: '#F59E0B', P4: '#FACC15', P5: '#2E7D32',
};

function getCategoryColor(category, branchColors) {
  // Try service-specific color first (distinct per service)
  const svcColor = getServiceNodeColor(category);
  if (svcColor) return svcColor;

  // Fallback to branch-level color
  const c = branchColors || DNA_DEFAULTS;
  if (!category) return c.P3;
  const resolved = resolveCategoryLabel(category);
  const cat = (resolved || category || '').toLowerCase();
  if (cat.includes('שכר') || cat.includes('payroll') || cat.includes('ניכויים') || cat.includes('ביטוח') || cat.includes('מס"ב')) return c.P1;
  if (cat.includes('מע"מ') || cat.includes('vat') || cat.includes('הנה"ח') || cat.includes('bookkeeping') || cat.includes('מקדמות') || cat.includes('התאמות') || cat.includes('מאזנ') || cat.includes('רו"ה') || cat.includes('pnl')) return c.P2;
  if (cat.includes('סוציאלי') || cat.includes('פנסיה') || cat.includes('social')) return c.P3;
  if (cat.includes('בית') || cat.includes('אישי') || cat.includes('home') || cat.includes('ארוחות')) return c.P4;
  if (cat.includes('דוח שנתי') || cat.includes('הצהרת הון') || cat.includes('annual')) return c.P5;
  if (cat.includes('admin') || cat.includes('אדמיני') || cat.includes('ייעוץ') || cat.includes('פגישה') || cat.includes('שיווק')) return c.P3;
  return c.P4;
}

// Service-specific colors — distinct per category (not just branch)
const SERVICE_NODE_COLORS = {
  'מע"מ': '#3B82F6',
  'מע"מ 874': '#1D4ED8',
  'מקדמות מס': '#F97316',
  'קליטת הכנסות': '#22C55E',
  'קליטת הוצאות': '#EC4899',
  'התאמות': '#F59E0B',
  'רווח והפסד': '#8B5CF6',
  'שכר': '#06B6D4',
  'ביטוח לאומי': '#F43F5E',
  'ניכויים': '#EAB308',
  'מס"ב ספקים': '#14B8A6',
  'דוח שנתי': '#2E7D32',
  'דוח רו"ה': '#8B5CF6',
};

function getServiceNodeColor(category) {
  if (!category) return null;
  const resolved = (typeof resolveCategoryLabel === 'function')
    ? resolveCategoryLabel(category)
    : category;
  return SERVICE_NODE_COLORS[resolved] || SERVICE_NODE_COLORS[category] || null;
}

const STATUS_GLOW = {
  waiting_for_materials: '#FF8F00',
  not_started: '#546E7A',
  sent_for_review: '#9C27B0',
  ready_to_broadcast: '#0D9488',
  reported_pending_payment: '#6366F1',
  needs_corrections: '#E65100',
  production_completed: '#2E7D32',
};

// ── Ring segment (filled arc wedge) ──
function describeWedge(cx, cy, innerR, outerR, startAngle, endAngle) {
  const innerStart = { x: cx + innerR * Math.cos(startAngle), y: cy + innerR * Math.sin(startAngle) };
  const innerEnd = { x: cx + innerR * Math.cos(endAngle), y: cy + innerR * Math.sin(endAngle) };
  const outerStart = { x: cx + outerR * Math.cos(startAngle), y: cy + outerR * Math.sin(startAngle) };
  const outerEnd = { x: cx + outerR * Math.cos(endAngle), y: cy + outerR * Math.sin(endAngle) };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${innerStart.x} ${innerStart.y}`,
    `L ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export default function AyoaRadialView({ tasks = [], centerLabel = 'מרכז', centerSub = '', onEditTask }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });

  // ── Zoom & Pan state ──
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ active: false, startX: 0, startY: 0, origPanX: 0, origPanY: 0 });

  // ── Drag state (category nodes drag their children) ──
  const [dragOffsets, setDragOffsets] = useState({}); // catIndex → {dx, dy}
  const dragRef = useRef({ active: false, catIndex: null, startX: 0, startY: 0, origDx: 0, origDy: 0 });

  // Design engine (safe — useDesign returns fallback if outside provider)
  const design = useDesign();
  const globalShape = design.shape || 'bubble';
  const globalLineStyle = design.lineStyle || 'tapered';
  const branchColors = design.branchColors || DNA_DEFAULTS;

  // Status Sync: detect which categories have active sub-tasks
  const activeBranches = useMemo(() => getActiveBranches(tasks), [tasks]);

  // ── Zoom wheel handler ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(prev => Math.min(3, Math.max(0.3, prev + delta)));
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, []);

  // ── SVG coordinate conversion (accounts for zoom/pan viewBox) ──
  const screenToSVG = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vbW = VB / zoom;
    const vbH = VB / zoom;
    const vbX = (VB - vbW) / 2 - pan.x / zoom;
    const vbY = (VB - vbH) / 2 - pan.y / zoom;
    return {
      x: vbX + ((clientX - rect.left) / rect.width) * vbW,
      y: vbY + ((clientY - rect.top) / rect.height) * vbH,
    };
  }, [zoom, pan]);

  // ── Drag handlers (parent-child sticky movement) ──
  const handleDragStart = useCallback((e, catIndex) => {
    e.stopPropagation();
    e.preventDefault();
    const svgPt = screenToSVG(e.clientX, e.clientY);
    const offset = dragOffsets[catIndex] || { dx: 0, dy: 0 };
    dragRef.current = { active: true, catIndex, startX: svgPt.x, startY: svgPt.y, origDx: offset.dx, origDy: offset.dy };
  }, [dragOffsets, screenToSVG]);

  // ── Pan (background drag) ──
  const handleBgMouseDown = useCallback((e) => {
    if (e.target.closest('[data-node]')) return;
    if (e.button === 1 || (e.button === 0 && !e.target.closest('[data-node]'))) {
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, origPanX: pan.x, origPanY: pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    // Pan handling
    if (panRef.current.active) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({ x: panRef.current.origPanX + dx, y: panRef.current.origPanY + dy });
      return;
    }
    // Drag handling
    if (!dragRef.current.active) return;
    const svgPt = screenToSVG(e.clientX, e.clientY);
    const dx = svgPt.x - dragRef.current.startX;
    const dy = svgPt.y - dragRef.current.startY;
    setDragOffsets(prev => ({
      ...prev,
      [dragRef.current.catIndex]: {
        dx: dragRef.current.origDx + dx,
        dy: dragRef.current.origDy + dy,
      },
    }));
  }, [screenToSVG]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
    panRef.current.active = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Auto-Layout: reset all drag offsets ──
  const handleAutoLayout = useCallback(() => {
    setDragOffsets({});
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const { nodes, ringSegments } = useMemo(() => {
    const catMap = {};
    tasks.forEach(task => {
      const cat = task.category || task.title || 'כללי';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(task);
    });

    const catEntries = Object.entries(catMap);
    const catCount = catEntries.length || 1;
    const angleStep = (2 * Math.PI) / catCount;
    const gap = 0.06;

    const allNodes = [];
    const segments = [];

    catEntries.forEach(([cat, catTasks], ci) => {
      const startAngle = -Math.PI / 2 + ci * angleStep + gap / 2;
      const endAngle = startAngle + angleStep - gap;
      const midAngle = (startAngle + endAngle) / 2;
      const dnaColor = getCategoryColor(cat, branchColors);

      // Ring 1 wedge (דיווחין) — vibrant fills
      segments.push({
        key: `ring1-${ci}`,
        d: describeWedge(CX, CY, RINGS.center + 12, RINGS.ring1, startAngle, endAngle),
        fill: dnaColor + '20',
        stroke: dnaColor + '40',
      });

      // Ring 2 wedge (שירותים)
      segments.push({
        key: `ring2-${ci}`,
        d: describeWedge(CX, CY, RINGS.ring1 + 5, RINGS.ring2 + 20, startAngle, endAngle),
        fill: dnaColor + '12',
        stroke: dnaColor + '20',
      });

      // Ring 3 wedge (ייצור)
      segments.push({
        key: `ring3-${ci}`,
        d: describeWedge(CX, CY, RINGS.ring2 + 25, RINGS.ring3 + 15, startAngle, endAngle),
        fill: dnaColor + '08',
        stroke: dnaColor + '15',
      });

      // Category node (Ring 1)
      const r1x = CX + Math.cos(midAngle) * (RINGS.center + 50);
      const r1y = CY + Math.sin(midAngle) * (RINGS.center + 50);

      allNodes.push({
        id: `cat-${ci}`,
        type: 'category',
        baseX: r1x, baseY: r1y,
        x: r1x, y: r1y,
        r: 30,
        shape: 'bubble',
        color: dnaColor,
        bg: dnaColor + '30',
        label: resolveCategoryLabel(cat).substring(0, 14),
        subLabel: `${catTasks.length}`,
        angle: midAngle,
        catIndex: ci,
      });

      // Task nodes — spread across rings 2-3 using sin/cos
      const maxPerCat = catCount <= 3 ? 10 : catCount <= 6 ? 6 : 4;
      const taskCount = Math.min(catTasks.length, maxPerCat);
      catTasks.slice(0, taskCount).forEach((task, ti) => {
        const status = task.status || 'not_started';
        const isCompleted = status === 'production_completed';

        // Calculate step progress for arc indicator
        const steps = task.process_steps || {};
        const stepKeys = Object.keys(steps);
        const totalSteps = stepKeys.length || 1;
        const doneSteps = stepKeys.filter(k => steps[k]?.done).length;
        const stepProgress = totalSteps > 0 ? doneSteps / totalSteps : 0;

        // Distribute within category angular segment
        const taskAngle = taskCount > 1
          ? startAngle + gap + ((endAngle - startAngle - gap * 2) * ti) / (taskCount - 1)
          : midAngle;

        const taskRing = isCompleted ? RINGS.ring3 : RINGS.ring2 + (ti % 3) * 35;
        const r = 20;
        const ov = design?.getNodeOverride?.(task.id) || {};

        const taskX = CX + Math.cos(taskAngle) * taskRing;
        const taskY = CY + Math.sin(taskAngle) * taskRing;
        allNodes.push({
          id: task.id,
          type: 'task',
          baseX: taskX, baseY: taskY,
          x: taskX,
          y: taskY,
          r,
          shape: ov.shape || globalShape,
          color: ov.color || dnaColor,
          bg: (ov.color || dnaColor) + '25',
          label: task.title || '',
          subLabel: task.client_name || '',
          angle: taskAngle,
          parentAngle: midAngle,
          parentColor: dnaColor,
          statusGlow: STATUS_GLOW[status] || '#546E7A',
          sticker: design?.stickerMap?.[task.id] || null,
          catIndex: ci,
          stepProgress,
        });
      });
    });

    return { nodes: allNodes, ringSegments: segments };
  }, [tasks, design?.nodeOverrides, design?.stickerMap, branchColors, globalShape]);

  // ── Apply drag offsets to produce final positioned nodes ──
  const positionedNodes = useMemo(() => {
    return nodes.map(node => {
      const offset = dragOffsets[node.catIndex] || { dx: 0, dy: 0 };
      return {
        ...node,
        x: node.baseX + offset.dx,
        y: node.baseY + offset.dy,
      };
    });
  }, [nodes, dragOffsets]);

  // Single click: open editor on task nodes, toggle focus on categories
  const handleNodeClick = useCallback((e, nodeId) => {
    e.stopPropagation();
    if (dragRef.current.active) return;
    if (onEditTask) {
      const task = tasks.find(t => t.id === nodeId);
      if (task) { onEditTask(task); return; }
    }
    setFocusedNode(prev => prev === nodeId ? null : nodeId);
  }, [onEditTask, tasks]);

  // Right-click (context menu) or double-click: open FloatingToolbar
  const handleNodeContextMenu = useCallback((e, nodeId) => {
    e.stopPropagation();
    e.preventDefault();
    if (dragRef.current.active) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const node = positionedNodes.find(n => n.id === nodeId);
    if (!node) return;
    const vbW = VB / zoom;
    const vbH = VB / zoom;
    const vbX = (VB - vbW) / 2 - pan.x / zoom;
    const vbY = (VB - vbH) / 2 - pan.y / zoom;
    const screenX = rect.left + ((node.x - vbX) / vbW) * rect.width;
    const screenY = rect.top + ((node.y - vbY) / vbH) * rect.height;

    if (selectedNode === nodeId) {
      setSelectedNode(null);
    } else {
      setSelectedNode(nodeId);
      setToolbarPos({ x: screenX, y: screenY });
      // Notify Design Engine of selection
      window.dispatchEvent(new CustomEvent('calmplan:node-selected', { detail: { nodeId } }));
    }
  }, [positionedNodes, selectedNode, zoom, pan]);

  const handleColorChange = useCallback(async (color) => {
    if (!selectedNode || !design?.setNodeOverride) return;
    // Optimistic UI update
    design.setNodeOverride(selectedNode, { color });
    // Persist to DB (Task + ServiceCatalog)
    try {
      await Promise.all([
        Task.update(selectedNode, { color }).catch(() => {}),
        ServiceCatalog.filter({ key: selectedNode }).then(results => {
          if (results?.[0]) ServiceCatalog.update(results[0].id, { color });
        }).catch(() => {}),
      ]);
    } catch { /* silent — localStorage is saved via DesignContext */ }
    window.dispatchEvent(new CustomEvent('calmplan:design-changed', { detail: { nodeId: selectedNode, color } }));
  }, [selectedNode, design]);

  const handleShapeChange = useCallback(async (shape) => {
    if (!selectedNode || !design?.setNodeOverride) return;
    design.setNodeOverride(selectedNode, { shape });
    try {
      await Promise.all([
        Task.update(selectedNode, { shape }).catch(() => {}),
        ServiceCatalog.filter({ key: selectedNode }).then(results => {
          if (results?.[0]) ServiceCatalog.update(results[0].id, { shape });
        }).catch(() => {}),
      ]);
    } catch { /* silent */ }
    window.dispatchEvent(new CustomEvent('calmplan:design-changed', { detail: { nodeId: selectedNode, shape } }));
  }, [selectedNode, design]);

  const handleApplyToChildren = useCallback(() => {
    if (!selectedNode || !design?.setNodeOverride) return;
    const parentNode = nodes.find(n => n.id === selectedNode);
    if (!parentNode || parentNode.type !== 'category') return;
    const parentOv = design?.getNodeOverride?.(selectedNode) || {};
    const childNodes = nodes.filter(n => n.type === 'task' && Math.abs(n.parentAngle - parentNode.angle) < 0.01);
    childNodes.forEach(child => {
      design.setNodeOverride(child.id, parentOv);
    });
  }, [selectedNode, nodes, design]);

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  // Guard clause: show loading state when tasks are empty
  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[300px]">
        <div className="text-center">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm font-bold" style={{ color: 'var(--cp-text-secondary, #64748B)' }}>
            טוען מפת ארכיטקט...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ overflow: 'hidden', backgroundColor: 'var(--cp-canvas-bg, #F8F9FA)' }}>
      {/* ── Control Bar: Auto-Layout, Zoom level ── */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button onClick={handleAutoLayout}
          className="px-3 py-1.5 rounded-xl bg-white shadow-lg border text-[12px] font-bold hover:bg-gray-50 transition-all"
          style={{ borderColor: '#E2E8F0', color: '#475569' }}
          title="סידור אוטומטי">
          סדר מחדש
        </button>
        <div className="flex items-center gap-1 bg-white rounded-xl shadow-lg border px-2 py-1" style={{ borderColor: '#E2E8F0' }}>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}
            className="w-6 h-6 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors text-gray-600">-</button>
          <span className="text-[12px] font-bold text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.15))}
            className="w-6 h-6 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors text-gray-600">+</button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${(VB - VB / zoom) / 2 - pan.x / zoom} ${(VB - VB / zoom) / 2 - pan.y / zoom} ${VB / zoom} ${VB / zoom}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)', cursor: panRef.current.active ? 'grabbing' : 'grab' }}
        onMouseDown={handleBgMouseDown}
        onClick={() => setSelectedNode(null)}
      >
        <defs>
          <filter id="radial-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#6366F1" floodOpacity="0.2" />
          </filter>
          <filter id="radial-blur">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
          </filter>
          <radialGradient id="center-grad-radial">
            <stop offset="0%" stopColor="#FFC107" />
            <stop offset="70%" stopColor="#FF9800" />
            <stop offset="100%" stopColor="#E65100" />
          </radialGradient>
        </defs>

        {/* Concentric ring guides */}
        {[RINGS.ring1, RINGS.ring2, RINGS.ring3].map((r, i) => (
          <circle key={`guide-${i}`} cx={CX} cy={CY} r={r}
            fill="none" stroke="#E0E0E0" strokeWidth={0.5} strokeDasharray="4 6" opacity={0.35} />
        ))}

        {/* Ring segments (colorful wedges) */}
        {ringSegments.map(seg => (
          <path key={seg.key} d={seg.d} fill={seg.fill} stroke={seg.stroke} strokeWidth={0.8} />
        ))}

        {/* Branches: center → categories (uses Design Engine line style) */}
        {positionedNodes.filter(n => n.type === 'category').map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          const conn = getConnectionProps(
            globalLineStyle, CX, CY, node.x, node.y, node.color,
            isBlurred ? 0.06 : 0.45,
            { startWidth: 7, endWidth: 2.5, strokeWidth: 3 }
          );
          return (
            <path key={`b-cat-${node.id}`} {...conn.props}
              style={{ transition: 'opacity 0.4s ease' }} />
          );
        })}

        {/* Branches: categories → tasks */}
        {positionedNodes.filter(n => n.type === 'task').map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          const parentCat = positionedNodes.find(n2 => n2.type === 'category' && Math.abs(n2.angle - node.parentAngle) < 0.01);
          const px = parentCat ? parentCat.x : CX;
          const py = parentCat ? parentCat.y : CY;
          const conn = getConnectionProps(
            globalLineStyle, px, py, node.x, node.y,
            node.parentColor || node.color,
            isBlurred ? 0.04 : 0.3,
            { startWidth: 4, endWidth: 1, strokeWidth: 2 }
          );
          return (
            <path key={`b-task-${node.id}`} {...conn.props}
              style={{ transition: 'opacity 0.4s ease' }} />
          );
        })}

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={RINGS.center + 3} fill="none" stroke="#FFC10730" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={RINGS.center} fill="url(#center-grad-radial)" filter="url(#radial-glow)" />
        <text x={CX} y={CY - 10} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">
          {centerLabel}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="white" fontSize="13" fontWeight="600">
          {centerSub || `${tasks.length} משימות`}
        </text>

        {/* Hierarchy ring labels */}
        <text x={CX + RINGS.ring1 + 8} y={CY - 6} fontSize="9" fill="#1E293B" fontWeight="700">דיווחין</text>
        <text x={CX + RINGS.ring2 + 8} y={CY - 6} fontSize="9" fill="#1E293B" fontWeight="700">שירותים</text>
        <text x={CX + RINGS.ring3 + 8} y={CY - 6} fontSize="8" fill="#334155" fontWeight="700">ייצור</text>

        {/* Category nodes (Ring 1) */}
        {positionedNodes.filter(n => n.type === 'category').map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          const isActive = activeBranches.has(node.label) || activeBranches.has(node.branch);
          return (
            <g key={node.id} data-node="true"
              onMouseDown={(e) => { if (e.button === 0) handleDragStart(e, node.catIndex); }}
              onClick={(e) => handleNodeClick(e, node.id)}
              onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
              onDoubleClick={(e) => handleNodeContextMenu(e, node.id)}
              style={{
                cursor: 'grab',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#radial-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}>
              {/* Status Sync: pulsing ring when branch has active sub-tasks */}
              {isActive && !isBlurred && (
                <circle cx={node.x} cy={node.y} r={node.r + 10}
                  fill="none" stroke={node.color} strokeWidth={2} strokeDasharray="8 4">
                  <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="r" values={`${node.r + 10};${node.r + 13};${node.r + 10}`}
                    dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 7}
                  fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="10s" repeatCount="indefinite" />
                </circle>
              )}
              {renderNodeShape(globalShape, node.x, node.y, node.r + 2, 'none', node.color + '20')}
              {renderNodeShape(globalShape, node.x, node.y, node.r, node.bg, node.color, 2)}
              {renderNodeShape(globalShape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0F172A"
                style={{ pointerEvents: 'none' }}>
                {node.label}
              </text>
              <text x={node.x} y={node.y + 10} textAnchor="middle" fontSize="10" fontWeight="700" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.subLabel} משימות
              </text>
            </g>
          );
        })}

        {/* Task nodes (Ring 2-3) */}
        {positionedNodes.filter(n => n.type === 'task').map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          return (
            <g key={node.id} data-node="true"
              onClick={(e) => handleNodeClick(e, node.id)}
              onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
              onDoubleClick={(e) => handleNodeContextMenu(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#radial-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
                transform: isFocused ? 'scale(1.08)' : 'scale(1)',
                transformOrigin: `${node.x}px ${node.y}px`,
              }}>
              {/* Progress arc — shows step completion around the node */}
              {node.stepProgress > 0 && (() => {
                const pr = node.r + 5;
                const circumference = 2 * Math.PI * pr;
                const dashLen = circumference * node.stepProgress;
                return (
                  <circle cx={node.x} cy={node.y} r={pr}
                    fill="none" stroke={node.stepProgress >= 1 ? '#22C55E' : node.color} strokeWidth={2.5}
                    strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${node.x} ${node.y})`}
                    opacity={0.8} />
                );
              })()}
              <circle cx={node.x} cy={node.y} r={node.r + 4}
                fill="none" stroke={node.statusGlow || '#546E7A'} strokeWidth={1.2} opacity={0.3} />
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              <g filter="url(#node-shadow)">
                {renderNodeShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2)}
                {renderNodeShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              {/* Directive #10: Bold text, high contrast */}
              <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F172A"
                style={{ pointerEvents: 'none' }}>
                {node.label.substring(0, 16)}
              </text>
              <text x={node.x} y={node.y + 8} textAnchor="middle" fontSize="9" fontWeight="600" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.subLabel ? node.subLabel.substring(0, 14) : ''}
              </text>
              {node.sticker && (
                <text x={node.x + node.r - 3} y={node.y + node.r - 3} textAnchor="middle"
                  fontSize="12" style={{ pointerEvents: 'none' }}>
                  {node.sticker}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Focus clear button */}
      {focusedNode !== null && (
        <button onClick={() => setFocusedNode(null)}
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-lg border text-xs font-bold hover:bg-gray-50 transition-all"
          style={{ color: '#6366F1' }}>
          ✕ נקה מיקוד
        </button>
      )}

      {/* DNA Legend — Architect Map identity (cool tones, full database) */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-sky-100">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-sky-800">
          <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #00A3E0, #0077B6)' }} />
          מפת ארכיטקט (מסד נתונים מלא)
        </div>
        <div className="flex items-center gap-2">
          {[
            { label: 'P1 שכר', color: DNA_DEFAULTS.P1 },
            { label: 'P2 הנה"ח', color: DNA_DEFAULTS.P2 },
            { label: 'P3 ביצוע', color: DNA_DEFAULTS.P3 },
            { label: 'P4 בית', color: DNA_DEFAULTS.P4 },
            { label: 'P5 דוחות', color: DNA_DEFAULTS.P5 },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[12px] font-bold" style={{ color: item.color }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FloatingToolbar (Directive #6) */}
      <FloatingToolbar
        visible={!!selectedNode && !!selectedNodeData}
        x={toolbarPos.x}
        y={toolbarPos.y}
        nodeColor={selectedNodeData?.color}
        nodeShape={selectedNodeData?.shape}
        onColorChange={handleColorChange}
        onShapeChange={handleShapeChange}
        onApplyToChildren={selectedNodeData?.type === 'category' ? handleApplyToChildren : undefined}
        onClose={() => setSelectedNode(null)}
      />

      {/* Green '+' FAB removed — global FAB in Layout handles quick-add */}
    </div>
  );
}
