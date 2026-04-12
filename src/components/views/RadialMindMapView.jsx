// ═══════════════════════════════════════════════════════════════
// RadialMindMapView — Stage 5.3
// ═══════════════════════════════════════════════════════════════
//
// A focused, usable radial mind map built on PROCESS_TREE_SEED.
//
// What this fixes (vs. the legacy 3,800-line MindMapView):
//   - Radial layout: 5 branches (P1-P5) around a center node.
//   - Depth > 2 auto-collapsed — click a node to reveal children.
//   - Pan/drag, wheel-zoom, + Zoom In/Out/Reset buttons.
//   - Minimap in the bottom-right (RTL corner) showing viewport box.
//   - Full RTL + Hebrew typography via --cp-font.
//   - DesignContext-aware: branch colors read from --cp-p1..--cp-p5.
//   - Emits + listens to `calmplan:node-selected` so task-list clicks
//     (see src/lib/nodeSelection.js) auto-center on the right node.
//
// Keeps it small on purpose — no clients, no task overlays, no inbox.
// That's what the legacy view is for. This is the "map of the work".
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROCESS_TREE_SEED } from '@/config/companyProcessTree';
import { getBranchVar, getBranchHex } from '@/lib/branchStyles';
import { useDesign } from '@/contexts/DesignContext';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, ChevronDown, ChevronRight } from 'lucide-react';

// ── Layout constants ──────────────────────────────────────────
const CANVAS_SIZE = 2000;                // logical SVG coordinate system
const CENTER = CANVAS_SIZE / 2;
const RING_RADII = [0, 280, 520, 720];   // root, ring1 (branches), ring2, ring3
const ROOT_RADIUS = 72;
const BRANCH_RADIUS = 58;
const CHILD_RADIUS = 42;
const GRANDCHILD_RADIUS = 32;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const WHEEL_ZOOM_STEP = 0.08;
const BUTTON_ZOOM_STEP = 0.2;

// Seed expansion — ring 1 + ring 2 open, deeper collapsed.
function buildInitialExpanded(tree) {
  const open = new Set(['__root__']);
  for (const [branchId, branch] of Object.entries(tree.branches)) {
    open.add(branchId);
    // Do NOT auto-expand ring 2 (children of branches) — keep them collapsed
    // so the user sees a calm overview and opens detail on demand.
  }
  return open;
}

// Flatten the tree into a positioned node graph.
// Each branch gets an angle slice; children fan out within that slice.
function layoutRadial(tree, expanded) {
  const branches = Object.values(tree.branches);
  const total = branches.length || 1;
  const sliceAngle = (Math.PI * 2) / total;
  // Start at 12 o'clock and go clockwise (RTL feels natural this way).
  const startAngle = -Math.PI / 2;

  const nodes = [];
  const edges = [];

  // Root
  nodes.push({
    id: '__root__',
    label: 'CalmPlan',
    depth: 0,
    x: CENTER,
    y: CENTER,
    radius: ROOT_RADIUS,
    color: '#334155',
    hasChildren: true,
    parentId: null,
    branchId: null,
  });

  branches.forEach((branch, i) => {
    const angle = startAngle + sliceAngle * i;
    const bx = CENTER + Math.cos(angle) * RING_RADII[1];
    const by = CENTER + Math.sin(angle) * RING_RADII[1];
    nodes.push({
      id: branch.id,
      label: branch.label,
      depth: 1,
      x: bx,
      y: by,
      radius: BRANCH_RADIUS,
      color: getBranchHex(branch.id),
      colorVar: getBranchVar(branch.id),
      hasChildren: (branch.children || []).length > 0,
      parentId: '__root__',
      branchId: branch.id,
      angle,
    });
    edges.push({ from: '__root__', to: branch.id, branchId: branch.id });

    if (!expanded.has(branch.id)) return;

    // Children ring 2 — fan within this branch's slice
    const kids = branch.children || [];
    const half = sliceAngle * 0.42;
    kids.forEach((kid, ki) => {
      const t = kids.length === 1 ? 0 : (ki / (kids.length - 1)) - 0.5;
      const kAngle = angle + t * 2 * half;
      const kx = CENTER + Math.cos(kAngle) * RING_RADII[2];
      const ky = CENTER + Math.sin(kAngle) * RING_RADII[2];
      nodes.push({
        id: kid.id,
        label: kid.label,
        depth: 2,
        x: kx,
        y: ky,
        radius: CHILD_RADIUS,
        color: getBranchHex(branch.id),
        colorVar: getBranchVar(branch.id),
        hasChildren: (kid.children || []).length > 0,
        parentId: branch.id,
        branchId: branch.id,
        angle: kAngle,
      });
      edges.push({ from: branch.id, to: kid.id, branchId: branch.id });

      if (!expanded.has(kid.id)) return;

      // Grandchildren ring 3
      const grand = kid.children || [];
      const subHalf = (2 * half) / Math.max(kids.length, 1) * 0.4;
      grand.forEach((g, gi) => {
        const gt = grand.length === 1 ? 0 : (gi / (grand.length - 1)) - 0.5;
        const gAngle = kAngle + gt * 2 * subHalf;
        const gx = CENTER + Math.cos(gAngle) * RING_RADII[3];
        const gy = CENTER + Math.sin(gAngle) * RING_RADII[3];
        nodes.push({
          id: g.id,
          label: g.label,
          depth: 3,
          x: gx,
          y: gy,
          radius: GRANDCHILD_RADIUS,
          color: getBranchHex(branch.id),
          colorVar: getBranchVar(branch.id),
          hasChildren: (g.children || []).length > 0,
          parentId: kid.id,
          branchId: branch.id,
          angle: gAngle,
        });
        edges.push({ from: kid.id, to: g.id, branchId: branch.id });
      });
    });
  });

  return { nodes, edges };
}

export default function RadialMindMapView({ className = '', onNodeSelect }) {
  const design = useDesign();
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const [expanded, setExpanded] = useState(() => buildInitialExpanded(PROCESS_TREE_SEED));
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(null); // { startX, startY, panX, panY }
  const [viewport, setViewport] = useState({ w: 1000, h: 700 });

  // Re-run layout whenever expanded state or the tree changes.
  const { nodes, edges } = useMemo(
    () => layoutRadial(PROCESS_TREE_SEED, expanded),
    [expanded]
  );
  const nodeMap = useMemo(() => {
    const m = {};
    for (const n of nodes) m[n.id] = n;
    return m;
  }, [nodes]);

  // Track container size for responsive viewBox.
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setViewport({ w: Math.max(600, width), h: Math.max(500, height) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Listen for external selections (task list → map) ──
  useEffect(() => {
    const handler = (e) => {
      const id = e.detail?.nodeId || e.detail?.serviceKey;
      if (!id) return;
      // Try to resolve to an existing tree node id.
      const target = nodeMap[id] || Object.values(nodeMap).find(n => n.id.endsWith(id));
      if (!target) return;
      setSelectedId(target.id);
      centerOn(target);
    };
    window.addEventListener('calmplan:node-selected', handler);
    return () => window.removeEventListener('calmplan:node-selected', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeMap, viewport.w, viewport.h]);

  // ── Actions ──────────────────────────────────────────────────
  const toggleNode = useCallback((node) => {
    if (!node.hasChildren) return;
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((node) => {
    setSelectedId(node.id);
    toggleNode(node);
    // Broadcast to the rest of the app (task lists can sync selection).
    window.dispatchEvent(new CustomEvent('calmplan:node-selected', {
      detail: { nodeId: node.id, source: 'radial-mindmap' },
    }));
    onNodeSelect?.(node);
  }, [toggleNode, onNodeSelect]);

  function centerOn(target) {
    if (!target) return;
    // Center the target in viewport: pan = viewport_center - target * zoom
    const z = Math.max(zoom, 0.5);
    setZoom(z);
    setPan({
      x: viewport.w / 2 - target.x * z,
      y: viewport.h / 2 - target.y * z,
    });
  }

  const resetView = useCallback(() => {
    // Fit the whole canvas
    const fit = Math.min(viewport.w / CANVAS_SIZE, viewport.h / CANVAS_SIZE) * 0.9;
    setZoom(fit);
    setPan({
      x: (viewport.w - CANVAS_SIZE * fit) / 2,
      y: (viewport.h - CANVAS_SIZE * fit) / 2,
    });
  }, [viewport.w, viewport.h]);

  // Initial fit once we know the viewport size
  useEffect(() => { resetView(); }, [resetView]);

  const zoomBy = useCallback((delta, originX, originY) => {
    setZoom(prevZoom => {
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom + delta));
      if (nextZoom === prevZoom) return prevZoom;
      // Keep the point under the cursor stable while zooming
      if (originX != null && originY != null) {
        setPan(prevPan => {
          const worldX = (originX - prevPan.x) / prevZoom;
          const worldY = (originY - prevPan.y) / prevZoom;
          return {
            x: originX - worldX * nextZoom,
            y: originY - worldY * nextZoom,
          };
        });
      }
      return nextZoom;
    });
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    const ox = rect ? e.clientX - rect.left : viewport.w / 2;
    const oy = rect ? e.clientY - rect.top : viewport.h / 2;
    zoomBy(e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP, ox, oy);
  }, [zoomBy, viewport.w, viewport.h]);

  // Attach wheel handler with {passive:false} so preventDefault works.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    setDragging({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    setPan({ x: dragging.panX + (e.clientX - dragging.startX), y: dragging.panY + (e.clientY - dragging.startY) });
  };
  const onMouseUp = () => setDragging(null);

  return (
    <div
      ref={containerRef}
      dir="rtl"
      className={`relative w-full h-full overflow-hidden bg-white rounded-2xl border border-gray-200 ${className}`}
      style={{ fontFamily: 'var(--cp-font, Heebo, Assistant, sans-serif)' }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewport.w} ${viewport.h}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((e, i) => {
            const a = nodeMap[e.from];
            const b = nodeMap[e.to];
            if (!a || !b) return null;
            const color = e.branchId ? getBranchVar(e.branchId) : '#94A3B8';
            return (
              <line
                key={`edge-${i}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={color}
                strokeOpacity={0.55}
                strokeWidth={Math.max(3, 10 - b.depth * 2)}
                strokeLinecap="round"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const isSelected = selectedId === n.id;
            const isRoot = n.id === '__root__';
            const fill = isRoot ? '#FFFFFF' : '#FFFFFF';
            const stroke = n.colorVar || '#334155';
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                onClick={(ev) => { ev.stopPropagation(); handleNodeClick(n); }}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <circle
                    r={n.radius + 10}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={4}
                    strokeDasharray="6 4"
                    opacity={0.7}
                  />
                )}
                <circle
                  r={n.radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isRoot ? 5 : 4}
                />
                {/* Label */}
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={isRoot ? 22 : n.depth === 1 ? 18 : n.depth === 2 ? 14 : 12}
                  fontWeight={isRoot || n.depth === 1 ? 700 : 600}
                  fill={isRoot ? '#0F172A' : stroke}
                  style={{
                    fontFamily: 'var(--cp-font, Heebo, Assistant, sans-serif)',
                    direction: 'rtl',
                  }}
                >
                  {truncate(n.label, n.depth === 1 ? 14 : n.depth === 2 ? 12 : 10)}
                </text>
                {/* Expand/collapse affordance */}
                {n.hasChildren && !isRoot && (
                  <g transform={`translate(0 ${n.radius - 10})`}>
                    <circle r={9} fill="#FFFFFF" stroke={stroke} strokeWidth={2} />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={12}
                      fontWeight={900}
                      fill={stroke}
                    >
                      {expanded.has(n.id) ? '−' : '+'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Toolbar ── */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(BUTTON_ZOOM_STEP, viewport.w / 2, viewport.h / 2)} title="הגדל">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(-BUTTON_ZOOM_STEP, viewport.w / 2, viewport.h / 2)} title="הקטן">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView} title="איפוס תצוגה">
          <Maximize2 className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-gray-200 mx-0.5" />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[11px]"
          onClick={() => setExpanded(buildInitialExpanded(PROCESS_TREE_SEED))}
          title="סגור הכל"
        >
          סגור הכל
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[11px]"
          onClick={() => {
            const all = new Set(['__root__']);
            for (const [branchId, branch] of Object.entries(PROCESS_TREE_SEED.branches)) {
              all.add(branchId);
              for (const kid of branch.children || []) {
                all.add(kid.id);
                for (const g of kid.children || []) all.add(g.id);
              }
            }
            setExpanded(all);
          }}
          title="פתח הכל"
        >
          פתח הכל
        </Button>
      </div>

      {/* ── Legend (branch colors) ── */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 bg-white rounded-xl border border-gray-200 p-2 shadow-sm">
        {Object.entries(PROCESS_TREE_SEED.branches).map(([branchId, branch]) => (
          <div key={branchId} className="flex items-center gap-2 text-[11px] font-semibold">
            <span
              className="w-3 h-3 rounded-full border border-gray-200"
              style={{ backgroundColor: getBranchVar(branchId) }}
            />
            <span style={{ color: getBranchVar(branchId) }}>{branchId} · {branch.label}</span>
          </div>
        ))}
      </div>

      {/* ── Minimap (bottom-right in RTL visual corner) ── */}
      <Minimap nodes={nodes} edges={edges} zoom={zoom} pan={pan} viewport={viewport} />
    </div>
  );
}

// Truncate Hebrew labels for SVG text — keep the whole word if short.
function truncate(s, maxChars) {
  if (!s) return '';
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 1) + '…';
}

// ── Minimap: renders a tiny version of the tree + a viewport rectangle.
function Minimap({ nodes, edges, zoom, pan, viewport }) {
  const W = 180;
  const H = 140;
  // Fit all nodes into the minimap canvas (with some padding)
  const fit = Math.min(W / CANVAS_SIZE, H / CANVAS_SIZE) * 0.9;
  const offsetX = (W - CANVAS_SIZE * fit) / 2;
  const offsetY = (H - CANVAS_SIZE * fit) / 2;

  // Viewport box (what's currently visible in the main SVG)
  const vbX = (-pan.x / zoom) * fit + offsetX;
  const vbY = (-pan.y / zoom) * fit + offsetY;
  const vbW = (viewport.w / zoom) * fit;
  const vbH = (viewport.h / zoom) * fit;

  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  return (
    <div className="absolute bottom-3 left-3 bg-white rounded-xl border border-gray-200 p-1.5 shadow-sm" style={{ width: W, height: H + 18 }}>
      <div className="text-[10px] text-gray-500 font-semibold mb-1 text-center">מיני-מפה</div>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <rect x={0} y={0} width={W} height={H} fill="#FAFBFC" rx={6} />
        {edges.map((e, i) => {
          const a = nodeMap[e.from];
          const b = nodeMap[e.to];
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={offsetX + a.x * fit} y1={offsetY + a.y * fit}
              x2={offsetX + b.x * fit} y2={offsetY + b.y * fit}
              stroke={e.branchId ? getBranchVar(e.branchId) : '#CBD5E1'}
              strokeWidth={0.8}
              opacity={0.7}
            />
          );
        })}
        {nodes.map((n) => (
          <circle
            key={n.id}
            cx={offsetX + n.x * fit}
            cy={offsetY + n.y * fit}
            r={Math.max(1.5, n.radius * fit * 0.5)}
            fill={n.branchId ? getBranchVar(n.branchId) : '#64748B'}
            opacity={0.9}
          />
        ))}
        {/* Viewport box */}
        <rect
          x={Math.max(0, vbX)}
          y={Math.max(0, vbY)}
          width={Math.min(W, Math.max(2, vbW))}
          height={Math.min(H, Math.max(2, vbH))}
          fill="rgba(20,184,166,0.12)"
          stroke="#0D9488"
          strokeWidth={1.2}
          rx={3}
        />
      </svg>
    </div>
  );
}
