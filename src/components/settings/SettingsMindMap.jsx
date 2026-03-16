/**
 * SettingsMindMap — AYOA-Style Visual Mind Map (V4.1)
 *
 * Interactive radial SVG mind map:
 * - Hub logo in center
 * - P1–P5 branches radiating outward as colored bubbles
 * - EXPAND/COLLAPSE: click any branch or group node to toggle children
 * - Steps shown as count badge (not separate bubbles)
 * - Clean tapered bezier connections
 * - Sidebar editor with color picker, shape, steps editor
 * - Reads ONLY from DB tree (no processTemplates ghost nodes)
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDesign } from '@/contexts/DesignContext';
import {
  Trash2, Plus, GripVertical, X, ListOrdered,
  Save, Loader2, ChevronDown, ChevronRight, Palette, Shapes,
} from 'lucide-react';
import {
  loadCompanyTree, invalidateTreeCache,
  saveAndBroadcast, onTreeChange,
} from '@/services/processTreeService';
import { toast } from '@/components/ui/use-toast';

// ── DNA Colors ──
const BASE_DNA = {
  P1: { color: '#0288D1', label: 'חשבות שכר', bg: '#E1F5FE', lightBg: '#E1F5FE90' },
  P2: { color: '#7B1FA2', label: 'הנה"ח ומיסים', bg: '#F3E5F5', lightBg: '#F3E5F590' },
  P3: { color: '#D81B60', label: 'ניהול', bg: '#FCE4EC', lightBg: '#FCE4EC90' },
  P4: { color: '#F9A825', label: 'בית ואישי', bg: '#FFF8E1', lightBg: '#FFF8E190' },
  P5: { color: '#2E7D32', label: 'דוחות שנתיים', bg: '#E8F5E9', lightBg: '#E8F5E990' },
};

const DYNAMIC_COLORS = [
  { color: '#9C27B0' }, { color: '#FF5722' }, { color: '#00BCD4' },
  { color: '#795548' }, { color: '#607D8B' },
];

// Color palette for node editor
const COLOR_PALETTE = [
  '#0288D1', '#7B1FA2', '#D81B60', '#F9A825', '#2E7D32',
  '#E53935', '#FF5722', '#00BCD4', '#795548', '#607D8B',
  '#9C27B0', '#1565C0', '#00695C', '#EF6C00', '#AD1457',
];

// Shape options for node editor
const SHAPE_OPTIONS = [
  { key: 'circle', label: 'עיגול' },
  { key: 'rounded_rect', label: 'מלבן מעוגל' },
  { key: 'diamond', label: 'מעוין' },
  { key: 'hexagon', label: 'משושה' },
];

// ── Canvas ──
const VB_W = 1600, VB_H = 1000;
const CX = VB_W / 2, CY = VB_H / 2;

// ── Branch angles (radial layout) ──
const BRANCH_ANGLES = {
  P1: -Math.PI * 0.75,
  P2: -Math.PI * 0.25,
  P3: Math.PI * 0.05,
  P4: Math.PI * 0.55,
  P5: Math.PI * 0.95,
};

// ── Tapered connection (thick at start, thin at end) ──
function taperedPath(x1, y1, x2, y2, w1 = 6, w2 = 2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const curvature = Math.min(30, len * 0.12);
  const cpx = mx - nx * curvature * 2;
  const cpy = my + ny * curvature * 2;
  const hw1 = w1 / 2, hw2 = w2 / 2;
  return `M${x1 + nx * hw1},${y1 + ny * hw1}
    Q${cpx + nx * (hw1 + hw2) / 2},${cpy + ny * (hw1 + hw2) / 2} ${x2 + nx * hw2},${y2 + ny * hw2}
    L${x2 - nx * hw2},${y2 - ny * hw2}
    Q${cpx - nx * (hw1 + hw2) / 2},${cpy - ny * (hw1 + hw2) / 2} ${x1 - nx * hw1},${y1 - ny * hw1}
    Z`;
}

// ── Wrap text for SVG ──
function wrapText(text, maxChars) {
  if (!text || text.length <= maxChars) return [text || ''];
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current && (current + ' ' + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

// ── Count all descendant nodes recursively ──
function countDescendants(node) {
  let count = 0;
  if (node.children) {
    for (const child of node.children) {
      count += 1 + countDescendants(child);
    }
  }
  return count;
}

// ── SVG shape renderer ──
function NodeShape({ x, y, r, shape, fill, stroke, strokeWidth, opacity }) {
  switch (shape) {
    case 'rounded_rect':
      return <rect x={x - r} y={y - r * 0.75} width={r * 2} height={r * 1.5}
        rx={r * 0.3} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
    case 'diamond': {
      const pts = `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
    }
    case 'hexagon': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
      }).join(' ');
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
    }
    default: // circle
      return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
  }
}

// ══════════════════════════════════════════════════════════════
// SortableStepsManager — for sidebar editor
// ══════════════════════════════════════════════════════════════

function SortableStepsManager({ steps, serviceKey, updateService, color }) {
  const commitSteps = useCallback((newSteps) => {
    updateService(serviceKey, { steps: newSteps });
  }, [serviceKey, updateService]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
          <ListOrdered className="w-4 h-4" />
          שלבי תהליך ({steps.length})
        </label>
      </div>
      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={step.key || i}
            className="flex items-center gap-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all"
            style={{ padding: '6px 8px', minHeight: '36px' }}>
            <button className="flex-shrink-0 cursor-grab p-1 rounded hover:bg-gray-200 text-gray-300">
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: color }}>
              {i + 1}
            </span>
            <input type="text" value={step.label || ''} dir="rtl"
              onChange={(e) => {
                const updated = steps.map((s, j) => j === i ? { ...s, label: e.target.value } : s);
                commitSteps(updated);
              }}
              placeholder="שם שלב..."
              className="flex-1 min-w-0 px-2 py-0.5 text-sm bg-transparent border-0 focus:outline-none text-gray-700 font-medium" />
            <button onClick={() => { if (steps.length > 1) commitSteps(steps.filter((_, j) => j !== i)); }}
              className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-red-500">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => commitSteps([...steps, { key: `step_${Date.now()}`, label: '' }])}
        className="w-full mt-2 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border-2 border-dashed border-gray-200 text-xs font-bold text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-all">
        <Plus className="w-3.5 h-3.5" /> הוסף שלב
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function SettingsMindMap({ onSelectService, onConfigChange }) {
  const svgRef = useRef(null);
  const design = useDesign();
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [dbTreeRef, setDbTreeRef] = useState({ tree: null, configId: null });
  const latestTreeRef = useRef(dbTreeRef); // stable ref for save callback
  latestTreeRef.current = dbTreeRef;
  const [dbBranches, setDbBranches] = useState({});
  const [mapSaving, setMapSaving] = useState(false);

  // ── EXPAND/COLLAPSE STATE ──
  // Set of node IDs that are expanded (showing children)
  // By default: branches start expanded, group nodes start collapsed
  const [expandedSet, setExpandedSet] = useState(new Set(['P1', 'P2', 'P3', 'P4', 'P5']));

  const toggleExpand = useCallback((nodeId) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // ── Load tree from DB ──
  const refreshFromDb = useCallback(async () => {
    invalidateTreeCache();
    try {
      const { tree, configId } = await loadCompanyTree();
      if (!tree?.branches) return;
      setDbTreeRef({ tree, configId });
      const extra = {};
      let dynIdx = 0;
      for (const [branchId] of Object.entries(tree.branches)) {
        if (!BASE_DNA[branchId]) {
          const palette = DYNAMIC_COLORS[dynIdx % DYNAMIC_COLORS.length];
          extra[branchId] = { color: palette.color, label: branchId, bg: palette.color + '15', lightBg: palette.color + '10' };
          dynIdx++;
        }
      }
      setDbBranches(extra);
      // Auto-expand dynamic branches
      setExpandedSet(prev => {
        const next = new Set(prev);
        for (const branchId of Object.keys(tree.branches)) {
          next.add(branchId);
        }
        return next;
      });
    } catch (err) {
      console.warn('[MindMap] Load failed:', err);
    }
  }, []);

  useEffect(() => { refreshFromDb(); }, [refreshFromDb]);
  useEffect(() => {
    const unsub = onTreeChange(() => { refreshFromDb(); });
    return unsub;
  }, [refreshFromDb]);

  const DNA = useMemo(() => ({ ...BASE_DNA, ...dbBranches }), [dbBranches]);

  // ── Build nodes & edges — respecting expand/collapse ──
  const { nodes, edges } = useMemo(() => {
    const tree = dbTreeRef.tree;
    if (!tree?.branches) return { nodes: [], edges: [] };

    const allNodes = [];
    const allEdges = [];

    // Hub
    allNodes.push({ id: 'hub', type: 'hub', x: CX, y: CY, r: 50, label: '', color: '#2C3E50' });

    const branchKeys = Object.keys(tree.branches);

    branchKeys.forEach((branchId, branchIdx) => {
      const branch = tree.branches[branchId];
      const dna = DNA[branchId];
      if (!dna) return;

      const angle = BRANCH_ANGLES[branchId] ?? (Math.PI * 0.9 + branchIdx * Math.PI * 0.4);
      const branchDist = 220;
      const bx = CX + Math.cos(angle) * branchDist;
      const by = CY + Math.sin(angle) * branchDist;

      const branchChildCount = (branch.children || []).length;
      const isExpanded = expandedSet.has(branchId);

      allNodes.push({
        id: branchId,
        type: 'branch',
        label: `${branchId}\n${branch.label}`,
        x: bx, y: by, r: 52,
        color: dna.color,
        bg: dna.bg,
        branchId,
        childCount: branchChildCount,
        isExpanded,
        totalDescendants: (branch.children || []).reduce((sum, c) => sum + 1 + countDescendants(c), 0),
      });
      allEdges.push({ from: { x: CX, y: CY }, to: { x: bx, y: by }, color: dna.color, w1: 8, w2: 3 });

      // Only layout children if expanded
      if (!isExpanded) return;

      const children = branch.children || [];
      if (children.length === 0) return;

      const childDist = 160;

      const layoutNode = (node, parentX, parentY, parentAngle, depth, indexInSiblings, siblingCount) => {
        const dist = depth === 1 ? childDist : 120;
        let nodeAngle;
        if (siblingCount === 1) {
          nodeAngle = parentAngle;
        } else {
          const spread = Math.min(Math.PI * 0.8, Math.PI * 0.15 + siblingCount * Math.PI * 0.1);
          const start = parentAngle - spread / 2;
          nodeAngle = start + (spread * indexInSiblings) / Math.max(1, siblingCount - 1);
        }

        const nx = parentX + Math.cos(nodeAngle) * dist;
        const ny = parentY + Math.sin(nodeAngle) * dist;
        const hasChildren = node.children && node.children.length > 0;
        const nodeIsExpanded = expandedSet.has(node.id);
        const stepCount = node.steps?.length || 0;
        const labelLen = (node.label || '').length;
        const r = hasChildren ? 44 : Math.max(34, Math.min(44, 28 + labelLen * 0.6));
        const nodeShape = node._mindmap_shape || 'circle';

        allNodes.push({
          id: node.id,
          type: hasChildren ? 'group' : 'service',
          label: node.label,
          x: nx, y: ny, r,
          color: node._mindmap_color || dna.color,
          bg: dna.bg,
          branchId,
          steps: node.steps || [],
          stepCount,
          frequency: node.default_frequency,
          serviceKey: node.service_key,
          isParent: node.is_parent_task,
          nodeData: node,
          hasChildren,
          isExpanded: nodeIsExpanded,
          childCount: hasChildren ? node.children.length : 0,
          totalDescendants: countDescendants(node),
          shape: nodeShape,
          slaDay: node.sla_day,
        });

        allEdges.push({
          from: { x: parentX, y: parentY },
          to: { x: nx, y: ny },
          color: node._mindmap_color || dna.color,
          w1: depth === 1 ? 5 : 3,
          w2: depth === 1 ? 2 : 1.2,
        });

        // Recurse into children ONLY if expanded
        if (hasChildren && nodeIsExpanded) {
          node.children.forEach((child, ci) => {
            layoutNode(child, nx, ny, nodeAngle, depth + 1, ci, node.children.length);
          });
        }
      };

      children.forEach((child, ci) => {
        layoutNode(child, bx, by, angle, 1, ci, children.length);
      });
    });

    return { nodes: allNodes, edges: allEdges };
  }, [dbTreeRef.tree, DNA, expandedSet]);

  // Find selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  // ── CRUD ──
  const updateService = useCallback((serviceKey, updates) => {
    if (!dbTreeRef.tree) return;
    const updateInTree = (nodes) => nodes.map(n => {
      if (n.id === serviceKey || n.service_key === serviceKey) {
        return { ...n, ...updates };
      }
      if (n.children?.length) return { ...n, children: updateInTree(n.children) };
      return n;
    });

    const newTree = { ...dbTreeRef.tree };
    for (const [branchId, branch] of Object.entries(newTree.branches)) {
      newTree.branches[branchId] = { ...branch, children: updateInTree(branch.children || []) };
    }
    setDbTreeRef(prev => ({ ...prev, tree: newTree }));
    onConfigChange?.({ action: 'update', key: serviceKey, updates });
  }, [dbTreeRef.tree, onConfigChange]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    const current = latestTreeRef.current;
    if (!current.tree) {
      toast({ title: 'שגיאה', description: 'אין עץ לשמירה', variant: 'destructive' });
      return;
    }
    setMapSaving(true);
    try {
      console.log('[MindMap] Saving tree to DB, configId:', current.configId);
      const result = await saveAndBroadcast(current.tree, current.configId, 'MindMap:Save');
      // Update configId if it was created for the first time
      if (result?.configId && result.configId !== current.configId) {
        setDbTreeRef(prev => ({ ...prev, configId: result.configId }));
      }
      toast({ title: 'נשמר', description: 'המפה נשמרה בהצלחה ל-DB' });
    } catch (err) {
      console.error('[MindMap] Save failed:', err);
      toast({ title: 'שגיאה בשמירה', description: err.message, variant: 'destructive' });
    }
    setMapSaving(false);
  }, []);

  const totalServices = nodes.filter(n => n.type === 'service' || n.type === 'group').length;

  return (
    <div className="relative w-full" style={{ minHeight: '700px' }}>
      {/* ══════ SVG Canvas ══════ */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 140px)', minHeight: '680px', userSelect: 'none' }}
        dir="ltr"
      >
        <defs>
          <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.12" />
          </filter>
          <filter id="glow-select" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#4682B4" floodOpacity="0.4" />
          </filter>
          <filter id="glow-hover" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#999" floodOpacity="0.3" />
          </filter>
          <pattern id="dot-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="0.5" fill="#ddd" />
          </pattern>
          <clipPath id="hub-clip"><circle cx={CX} cy={CY} r={45} /></clipPath>
        </defs>

        {/* Background */}
        <rect width={VB_W} height={VB_H} fill="url(#dot-grid)" rx="12" />

        {/* ── Tapered connections ── */}
        {edges.map((edge, i) => (
          <path
            key={`edge-${i}`}
            d={taperedPath(edge.from.x, edge.from.y, edge.to.x, edge.to.y, edge.w1, edge.w2)}
            fill={edge.color}
            opacity={0.35}
          />
        ))}

        {/* ── Hub ── */}
        <circle cx={CX} cy={CY} r={50} fill="white" filter="url(#node-shadow)" />
        <image
          href={`${window.location.origin}/logo-litay.png`}
          x={CX - 45} y={CY - 45} width={90} height={90}
          clipPath="url(#hub-clip)"
          preserveAspectRatio="xMidYMid slice"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <circle cx={CX} cy={CY} r={50} fill="none" stroke="#66BB6A" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={CX} y={CY + 42} textAnchor="middle" fill="#78909C" fontSize="10" fontWeight="600">{totalServices} שירותים</text>

        {/* ── Nodes ── */}
        {nodes.map(node => {
          if (node.type === 'hub') return null;
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          const r = isSelected ? node.r + 3 : isHovered ? node.r + 1 : node.r;
          const canExpand = node.type === 'branch' || node.hasChildren;
          const isCollapsed = canExpand && !node.isExpanded;

          return (
            <g
              key={node.id}
              style={{ cursor: 'pointer' }}
              filter={isSelected ? 'url(#glow-select)' : isHovered ? 'url(#glow-hover)' : 'url(#node-shadow)'}
              onClick={(e) => {
                e.stopPropagation();
                if (canExpand) {
                  toggleExpand(node.id);
                }
                if (node.type !== 'branch') {
                  setSelectedNodeId(node.id);
                  onSelectService?.(node.serviceKey || node.id);
                  design.setActiveTaskId?.(node.id);
                }
              }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={r + 6} fill="none"
                  stroke={node.color} strokeWidth={2} opacity={0.5} strokeDasharray="5 3">
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="12s" repeatCount="indefinite" />
                </circle>
              )}

              {/* ── BRANCH NODE ── */}
              {node.type === 'branch' ? (
                <>
                  <ellipse cx={node.x} cy={node.y} rx={r + 5} ry={r - 5}
                    fill={node.color} opacity={0.15} />
                  <ellipse cx={node.x} cy={node.y} rx={r} ry={r - 8}
                    fill="white" stroke={node.color} strokeWidth={2.5} />
                  <text x={node.x} y={node.y - 8} textAnchor="middle"
                    fill={node.color} fontSize="18" fontWeight="900" fontFamily="system-ui">
                    {node.branchId}
                  </text>
                  <text x={node.x} y={node.y + 10} textAnchor="middle"
                    fill={node.color} fontSize="11" fontWeight="700" fontFamily="system-ui">
                    {dbTreeRef.tree?.branches[node.branchId]?.label || ''}
                  </text>
                  {/* Expand/collapse indicator */}
                  <text x={node.x} y={node.y + 24} textAnchor="middle"
                    fill={node.color} fontSize="9" fontWeight="600" opacity={0.7}>
                    {node.isExpanded ? '▼' : `▶ ${node.totalDescendants}`}
                  </text>
                  {/* Collapsed count badge */}
                  {isCollapsed && (
                    <>
                      <circle cx={node.x + r * 0.7} cy={node.y - r * 0.5} r={12}
                        fill={node.color} />
                      <text x={node.x + r * 0.7} y={node.y - r * 0.5 + 4}
                        textAnchor="middle" fill="white" fontSize="9" fontWeight="800">
                        +{node.totalDescendants}
                      </text>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* ── SERVICE / GROUP NODE ── */}
                  <NodeShape
                    x={node.x} y={node.y} r={r}
                    shape={node.shape || 'circle'}
                    fill="white" stroke={node.color}
                    strokeWidth={node.type === 'group' ? 3 : 2}
                  />

                  {/* Colored accent arc on top */}
                  <path
                    d={`M${node.x - r * 0.7},${node.y - r * 0.7} A${r},${r} 0 0,1 ${node.x + r * 0.7},${node.y - r * 0.7}`}
                    fill="none" stroke={node.color} strokeWidth={3} strokeLinecap="round"
                  />

                  {/* Label */}
                  {(() => {
                    const lines = wrapText(node.label, Math.floor(r / 3.5));
                    const fontSize = r > 40 ? 11 : 10;
                    const startY = node.y - (lines.length - 1) * (fontSize * 0.6);
                    return lines.map((line, li) => (
                      <text key={li} x={node.x} y={startY + li * (fontSize + 2)}
                        textAnchor="middle" fill="#333" fontSize={fontSize}
                        fontWeight="700" fontFamily="system-ui">
                        {line}
                      </text>
                    ));
                  })()}

                  {/* Step count badge */}
                  {node.stepCount > 0 && (
                    <>
                      <circle cx={node.x + r * 0.65} cy={node.y + r * 0.65} r={10}
                        fill={node.color} />
                      <text x={node.x + r * 0.65} y={node.y + r * 0.65 + 3.5}
                        textAnchor="middle" fill="white" fontSize="8" fontWeight="800">
                        {node.stepCount}
                      </text>
                    </>
                  )}

                  {/* SLA day badge */}
                  {node.slaDay && (
                    <>
                      <circle cx={node.x - r * 0.65} cy={node.y + r * 0.65} r={10}
                        fill="#EF5350" />
                      <text x={node.x - r * 0.65} y={node.y + r * 0.65 + 3.5}
                        textAnchor="middle" fill="white" fontSize="7" fontWeight="800">
                        {node.slaDay}
                      </text>
                    </>
                  )}

                  {/* Expand/collapse indicator for group nodes */}
                  {canExpand && (
                    <g>
                      <circle cx={node.x} cy={node.y + r + 10} r={8}
                        fill={node.color} opacity={0.9} />
                      <text x={node.x} y={node.y + r + 13}
                        textAnchor="middle" fill="white" fontSize="8" fontWeight="800">
                        {node.isExpanded ? '−' : `+${node.totalDescendants}`}
                      </text>
                    </g>
                  )}

                  {/* Frequency label */}
                  {node.frequency && node.frequency !== 'monthly' && (
                    <text x={node.x} y={node.y + r - 4} textAnchor="middle"
                      fill={node.color} fontSize="7" fontWeight="600" opacity={0.7}>
                      {node.frequency === 'bimonthly' ? 'דו-חודשי' :
                       node.frequency === 'yearly' ? 'שנתי' :
                       node.frequency === 'daily' ? 'יומי' :
                       node.frequency === 'weekly' ? 'שבועי' : ''}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Save Button ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <button onClick={handleSave} disabled={mapSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 shadow-lg transition-all disabled:opacity-50">
          {mapSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {mapSaving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>

      {/* ── DNA Legend ── */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 border border-gray-200 shadow-sm z-10">
        {Object.entries(DNA).map(([id, dna]) => (
          <div key={id} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dna.color }} />
            <span className="text-[10px] font-bold" style={{ color: dna.color }}>{id}</span>
          </div>
        ))}
      </div>

      {/* ── Expand All / Collapse All buttons ── */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
        <button
          onClick={() => {
            // Expand all: collect all node IDs that have children
            const allExpandable = new Set();
            const tree = dbTreeRef.tree;
            if (!tree?.branches) return;
            for (const [branchId, branch] of Object.entries(tree.branches)) {
              allExpandable.add(branchId);
              const walk = (nodes) => {
                for (const n of nodes) {
                  if (n.children?.length) {
                    allExpandable.add(n.id);
                    walk(n.children);
                  }
                }
              };
              walk(branch.children || []);
            }
            setExpandedSet(allExpandable);
          }}
          className="px-3 py-1.5 rounded-full bg-white/95 border border-gray-200 text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 shadow-sm transition-all"
        >
          פתח הכל
        </button>
        <button
          onClick={() => setExpandedSet(new Set(Object.keys(dbTreeRef.tree?.branches || {})))}
          className="px-3 py-1.5 rounded-full bg-white/95 border border-gray-200 text-xs font-bold text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 shadow-sm transition-all"
        >
          כווץ הכל
        </button>
      </div>

      {/* ══════ Sidebar Editor ══════ */}
      <AnimatePresence>
        {selectedNode && selectedNode.type !== 'branch' && (
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute top-14 left-3 w-80 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-20"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
              style={{ background: `linear-gradient(135deg, ${selectedNode.color}15, ${selectedNode.color}05)` }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedNode.color }} />
                <span className="text-sm font-bold text-gray-800 truncate">{selectedNode.label}</span>
              </div>
              <button onClick={() => setSelectedNodeId(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {/* Name edit */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">שם שירות</label>
                <input type="text" value={selectedNode.label || ''} dir="rtl"
                  onChange={(e) => updateService(selectedNodeId, { label: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none font-medium" />
              </div>

              {/* ── Color Picker ── */}
              <div>
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2">
                  <Palette className="w-3.5 h-3.5" />
                  צבע
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button key={c}
                      onClick={() => updateService(selectedNodeId, { _mindmap_color: c })}
                      className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: selectedNode.color === c ? '#333' : 'transparent',
                        boxShadow: selectedNode.color === c ? '0 0 0 2px white, 0 0 0 4px ' + c : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* ── Shape Selector ── */}
              <div>
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2">
                  <Shapes className="w-3.5 h-3.5" />
                  צורה
                </label>
                <div className="flex gap-2">
                  {SHAPE_OPTIONS.map(({ key, label }) => {
                    const isActive = (selectedNode.shape || 'circle') === key;
                    return (
                      <button key={key}
                        onClick={() => updateService(selectedNodeId, { _mindmap_shape: key })}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all ${
                          isActive
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                        }`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Steps display as badges */}
              {selectedNode.stepCount > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">שלבים ({selectedNode.stepCount})</label>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.steps.map((step, i) => (
                      <span key={step.key || i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border"
                        style={{ backgroundColor: selectedNode.bg, borderColor: selectedNode.color + '30', color: selectedNode.color }}>
                        <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ backgroundColor: selectedNode.color + 'CC' }}>
                          {i + 1}
                        </span>
                        {step.label}
                        {step.sla_day && (
                          <span className="text-[9px] text-red-500 font-bold mr-1">({step.sla_day})</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps editor */}
              <SortableStepsManager
                steps={selectedNode.steps || []}
                serviceKey={selectedNodeId}
                updateService={updateService}
                color={selectedNode.color}
              />

              {/* SLA info */}
              {selectedNode.slaDay && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">{selectedNode.slaDay}</span>
                  <span className="text-xs font-bold text-red-700">דד ליין: {selectedNode.slaDay} לחודש</span>
                </div>
              )}

              {/* Info */}
              <div className="flex items-center gap-3 text-xs text-gray-400 pt-2 border-t border-gray-100">
                <span>{selectedNode.branchId}</span>
                <span>{selectedNode.id}</span>
                {selectedNode.frequency && <span>{selectedNode.frequency}</span>}
              </div>

              {/* Save */}
              <button onClick={handleSave} disabled={mapSaving}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-50 text-green-700 text-sm font-bold hover:bg-green-100 border-2 border-green-200">
                {mapSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {mapSaving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white/90 rounded-xl px-3 py-1.5 border border-gray-200 shadow-sm z-10 font-medium">
        לחץ על ענף כדי לפתוח/לסגור | לחץ על בועה כדי לערוך
      </div>
    </div>
  );
}
