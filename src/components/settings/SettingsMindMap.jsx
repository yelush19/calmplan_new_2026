/**
 * SettingsMindMap — AYOA-Style Visual Mind Map (V4.0)
 *
 * Clean radial SVG mind map:
 * - Hub logo in center
 * - P1–P5 branches radiating outward as colored bubbles
 * - Child nodes in organized arcs around parent
 * - Steps shown as small chips ON the node (not separate bubbles)
 * - Clean bezier curve connections
 * - Sidebar editor for node details
 * - Reads ONLY from DB tree (no processTemplates ghost nodes)
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ALL_SERVICES,
} from '@/config/processTemplates';
import { useDesign } from '@/contexts/DesignContext';
import {
  Trash2, Plus, GripVertical, X, ListOrdered,
  Save, Loader2,
} from 'lucide-react';
import { resolveCategoryLabel } from '@/utils/categoryLabels';
import {
  loadCompanyTree, invalidateTreeCache,
  saveAndBroadcast, onTreeChange,
  loadSettingFromDb, syncSettingToDb,
  ensureMindMapSync,
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

// ── Canvas ──
const VB_W = 1600, VB_H = 1000;
const CX = VB_W / 2, CY = VB_H / 2;

// ── Branch angles (radial layout) ──
const BRANCH_ANGLES = {
  P1: -Math.PI * 0.75,   // top-left
  P2: -Math.PI * 0.25,   // top-right
  P3: Math.PI * 0.05,    // right
  P4: Math.PI * 0.55,    // bottom-right
  P5: Math.PI * 0.95,    // bottom-left
};

// ── Bezier curve between two points ──
function bezierPath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Control point offset perpendicular to midpoint
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const curvature = Math.min(40, len * 0.15);
  const cpx = mx - (dy / len) * curvature;
  const cpy = my + (dx / len) * curvature;
  return `M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`;
}

// ── Tapered connection (thick at start, thin at end) ──
function taperedPath(x1, y1, x2, y2, w1 = 6, w2 = 2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const curvature = Math.min(30, len * 0.12);
  const cpx = mx - nx * curvature * 2;
  const cpy = my + ny * curvature * 2;
  // Build a tapered shape using two quadratic curves
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
  return lines.slice(0, 2); // max 2 lines
}

// ══════════════════════════════════════════════════════════════
// SortableStepsManager — for sidebar editor
// ══════════════════════════════════════════════════════════════

function SortableStepsManager({ steps, serviceKey, updateService, color, bg }) {
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
  const [dbBranches, setDbBranches] = useState({});
  const [mapSaving, setMapSaving] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [customServices, setCustomServices] = useState({});

  // ── Load tree from DB ──
  const refreshFromDb = useCallback(async () => {
    invalidateTreeCache();
    try {
      const { tree, configId } = await loadCompanyTree();
      if (!tree?.branches) return;
      setDbTreeRef({ tree, configId });
      // Detect dynamic branches
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
    } catch (err) {
      console.warn('[MindMap] Load failed:', err);
    }
  }, []);

  useEffect(() => { refreshFromDb(); }, [refreshFromDb]);

  // Listen for tree changes
  useEffect(() => {
    const unsub = onTreeChange(() => { refreshFromDb(); });
    return unsub;
  }, [refreshFromDb]);

  const DNA = useMemo(() => ({ ...BASE_DNA, ...dbBranches }), [dbBranches]);

  // ── Build ALL nodes for the SVG map from DB tree ONLY ──
  const { nodes, edges } = useMemo(() => {
    const tree = dbTreeRef.tree;
    if (!tree?.branches) return { nodes: [], edges: [] };

    const allNodes = [];
    const allEdges = [];
    const branchKeys = Object.keys(tree.branches);

    // Hub node
    allNodes.push({ id: 'hub', type: 'hub', x: CX, y: CY, r: 50, label: '', color: '#2C3E50' });

    // Position each branch
    branchKeys.forEach((branchId, branchIdx) => {
      const branch = tree.branches[branchId];
      const dna = DNA[branchId];
      if (!dna) return;

      // Branch angle
      const angle = BRANCH_ANGLES[branchId] ??
        (Math.PI * 0.9 + branchIdx * Math.PI * 0.4);
      const branchDist = 220;
      const bx = CX + Math.cos(angle) * branchDist;
      const by = CY + Math.sin(angle) * branchDist;

      // Branch root node
      allNodes.push({
        id: branchId,
        type: 'branch',
        label: `${branchId}\n${branch.label}`,
        x: bx, y: by, r: 52,
        color: dna.color,
        bg: dna.bg,
        branchId,
      });
      allEdges.push({ from: { x: CX, y: CY }, to: { x: bx, y: by }, color: dna.color, w1: 8, w2: 3 });

      // Layout children in a fan around the branch
      const children = branch.children || [];
      if (children.length === 0) return;

      const childDist = 160;
      const fanAngle = Math.min(Math.PI * 0.9, Math.PI * 0.2 + children.length * Math.PI * 0.12);
      const startAngle = angle - fanAngle / 2;

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
        const stepCount = node.steps?.length || 0;
        const labelLen = (node.label || '').length;
        const r = hasChildren ? 44 : Math.max(34, Math.min(44, 28 + labelLen * 0.6));

        allNodes.push({
          id: node.id,
          type: hasChildren ? 'group' : 'service',
          label: node.label,
          x: nx, y: ny, r,
          color: dna.color,
          bg: dna.bg,
          branchId,
          steps: node.steps || [],
          stepCount,
          frequency: node.default_frequency,
          serviceKey: node.service_key,
          isParent: node.is_parent_task,
          nodeData: node,
        });

        allEdges.push({
          from: { x: parentX, y: parentY },
          to: { x: nx, y: ny },
          color: dna.color,
          w1: depth === 1 ? 5 : 3,
          w2: depth === 1 ? 2 : 1.2,
        });

        // Recurse into children
        if (hasChildren) {
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
  }, [dbTreeRef.tree, DNA]);

  // Find selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  // ── CRUD ──
  const updateService = useCallback((serviceKey, updates) => {
    // Update in DB tree
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
    setMapSaving(true);
    try {
      await saveAndBroadcast(dbTreeRef.tree, dbTreeRef.configId, 'MindMap:Save');
      toast({ title: 'נשמר', description: 'המפה נשמרה בהצלחה' });
    } catch (err) {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    }
    setMapSaving(false);
  }, [dbTreeRef]);

  // ── SVG coordinate helper ──
  const svgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const inv = ctm.inverse();
    return { x: inv.a * clientX + inv.c * clientY + inv.e, y: inv.b * clientX + inv.d * clientY + inv.f };
  }, []);

  // Count services
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
          {/* Dot grid */}
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

          return (
            <g
              key={node.id}
              style={{ cursor: 'pointer' }}
              filter={isSelected ? 'url(#glow-select)' : isHovered ? 'url(#glow-hover)' : 'url(#node-shadow)'}
              onClick={() => {
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

              {/* Node shape — AYOA cloud/bubble style */}
              {node.type === 'branch' ? (
                <>
                  {/* Branch root: cloud shape */}
                  <ellipse cx={node.x} cy={node.y} rx={r + 5} ry={r - 5}
                    fill={node.color} opacity={0.15} />
                  <ellipse cx={node.x} cy={node.y} rx={r} ry={r - 8}
                    fill="white" stroke={node.color} strokeWidth={2.5} />
                  {/* Branch ID */}
                  <text x={node.x} y={node.y - 8} textAnchor="middle"
                    fill={node.color} fontSize="18" fontWeight="900" fontFamily="system-ui">
                    {node.branchId}
                  </text>
                  {/* Branch label */}
                  <text x={node.x} y={node.y + 10} textAnchor="middle"
                    fill={node.color} fontSize="11" fontWeight="700" fontFamily="system-ui">
                    {dbTreeRef.tree?.branches[node.branchId]?.label || ''}
                  </text>
                  {/* Child count */}
                  <text x={node.x} y={node.y + 24} textAnchor="middle"
                    fill={node.color} fontSize="9" fontWeight="500" opacity={0.6}>
                    {(dbTreeRef.tree?.branches[node.branchId]?.children || []).length} שירותים
                  </text>
                </>
              ) : (
                <>
                  {/* Service / group node: rounded bubble */}
                  <circle cx={node.x} cy={node.y} r={r}
                    fill="white" stroke={node.color}
                    strokeWidth={node.type === 'group' ? 3 : 2} />

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

                  {/* Parent indicator (small diamond) */}
                  {node.isParent && node.type === 'group' && (
                    <polygon
                      points={`${node.x},${node.y - r - 6} ${node.x + 5},${node.y - r - 1} ${node.x},${node.y - r + 4} ${node.x - 5},${node.y - r - 1}`}
                      fill={node.color} opacity={0.8}
                    />
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

      {/* ══════ Sidebar Editor ══════ */}
      <AnimatePresence>
        {selectedNode && selectedNode.type !== 'branch' && (
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute top-3 left-3 w-80 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-20"
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

            <div className="p-4 space-y-4 max-h-[calc(100vh-260px)] overflow-y-auto">
              {/* Name edit */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">שם שירות</label>
                <input type="text" value={selectedNode.label || ''} dir="rtl"
                  onChange={(e) => updateService(selectedNodeId, { label: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:outline-none font-medium" />
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
                bg={selectedNode.bg}
              />

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
        לחץ על בועה כדי לערוך
      </div>
    </div>
  );
}
