/**
 * ProcessTreeFocusMap — Ayoa-Style Mind Map from Logo Hub (V4.3)
 *
 * Same architecture as SettingsMindMap (logo center, radial branches)
 * but adapted for Focus page with:
 *   - Live task counts per node
 *   - Ayoa rectangular card nodes (not circles)
 *   - Status distribution bars
 *   - SLA/deadline badges
 *   - Design editor (colors, connections)
 *   - Dynamic from DB tree
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadCompanyTree } from '@/services/processTreeService';
import { flattenTree, PROCESS_TREE_SEED } from '@/config/companyProcessTree';
import { resolveCategoryLabel } from '@/utils/categoryLabels';

const VB_W = 1600, VB_H = 1000;
const CX = VB_W / 2, CY = VB_H / 2;

const BRANCH_ANGLES = {
  P1: -Math.PI * 0.75,
  P2: -Math.PI * 0.25,
  P3: Math.PI * 0.05,
  P4: Math.PI * 0.55,
  P5: Math.PI * 0.95,
};

const BRANCH_DNA = {
  P1: { color: '#0288D1', bg: '#E1F5FE', label: 'חשבות שכר', emoji: '\uD83D\uDCB0' },
  P2: { color: '#7B1FA2', bg: '#F3E5F5', label: 'הנה"ח ומיסים', emoji: '\uD83D\uDCCA' },
  P3: { color: '#D81B60', bg: '#FCE4EC', label: 'ניהול', emoji: '\uD83D\uDCC1' },
  P4: { color: '#F9A825', bg: '#FFF8E1', label: 'בית ואישי', emoji: '\uD83C\uDFE0' },
  P5: { color: '#2E7D32', bg: '#E8F5E9', label: 'דוחות שנתיים', emoji: '\uD83D\uDCCB' },
};

const STATUS_COLORS = {
  not_started: '#1565C0', in_progress: '#F57C00', waiting_for_materials: '#FF8F00',
  sent_for_review: '#7B1FA2', needs_corrections: '#E65100', production_completed: '#2E7D32',
};

const STATUS_LABELS = {
  not_started: 'לא התחיל', in_progress: 'בתהליך', waiting_for_materials: 'ממתין',
  sent_for_review: 'בבדיקה', needs_corrections: 'תיקון', production_completed: 'הושלם',
};

const COLOR_PALETTE = [
  '#0288D1', '#7B1FA2', '#D81B60', '#F9A825', '#2E7D32',
  '#E53935', '#FF5722', '#00BCD4', '#795548', '#607D8B',
  '#9C27B0', '#1565C0', '#00695C', '#EF6C00', '#AD1457', '#FF9800',
];

// Tapered connection path (from SettingsMindMap)
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

function matchTaskToNode(task, nodeMap) {
  if (task.tree_node_id && nodeMap[task.tree_node_id]) return task.tree_node_id;
  if (task.service_key) {
    for (const [nid, n] of Object.entries(nodeMap)) {
      if (n.service_key === task.service_key) return nid;
    }
  }
  const cat = resolveCategoryLabel(task.category || '').toLowerCase();
  for (const [nid, n] of Object.entries(nodeMap)) {
    const nl = (n.label || '').toLowerCase();
    if (cat && nl && (cat.includes(nl) || nl.includes(cat))) return nid;
  }
  const catMap = {
    'שכר': 'P1_payroll', 'payroll': 'P1_payroll', 'work_payroll': 'P1_payroll',
    'מע"מ': 'P2_vat', 'vat': 'P2_vat', 'work_vat_reporting': 'P2_vat',
    'מקדמות': 'P2_tax_advances', 'work_tax_advances': 'P2_tax_advances',
    'ביטוח לאומי': 'P1_social_security', 'social_security': 'P1_social_security',
    'סוציאליות מתפעל': 'P1_operator', 'work_social_operator': 'P1_operator',
    'סוציאליות טמל': 'P1_taml', 'work_social_taml': 'P1_taml',
    'סוציאליות': 'P1_social_benefits',
    'ניכויים': 'P1_deductions', 'deductions': 'P1_deductions', 'work_deductions': 'P1_deductions',
    'התאמות': 'P2_reconciliation', 'work_reconciliation': 'P2_reconciliation',
    'הכנסות': 'P2_income', 'הוצאות': 'P2_expenses',
    'רוו"ה': 'P2_pnl', 'pnl': 'P2_pnl',
  };
  const rawCat = (task.category || '').toLowerCase();
  for (const [key, nodeId] of Object.entries(catMap)) {
    if (rawCat.includes(key) && nodeMap[nodeId]) return nodeId;
  }
  return null;
}

function countDescendants(node) {
  let count = 0;
  if (node.children) { for (const c of node.children) { count += 1 + countDescendants(c); } }
  return count;
}

export default function ProcessTreeFocusMap({ tasks = [], clients = [], centerLabel = 'הפוקוס שלי', branch: filterBranch }) {
  const svgRef = useRef(null);
  const [companyTree, setCompanyTree] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [expandedSet, setExpandedSet] = useState(new Set(['P1', 'P2', 'P3', 'P4', 'P5']));
  const [showEditor, setShowEditor] = useState(false);
  const [customColors, setCustomColors] = useState({});
  const [customConnections, setCustomConnections] = useState([]);
  const [editingNodeColor, setEditingNodeColor] = useState(null);

  useEffect(() => {
    loadCompanyTree().then(({ tree }) => setCompanyTree(tree)).catch(() => setCompanyTree(PROCESS_TREE_SEED));
  }, []);

  const nodeMap = useMemo(() => {
    if (!companyTree) return {};
    const map = {};
    for (const n of flattenTree(companyTree)) map[n.id] = n;
    return map;
  }, [companyTree]);

  const tasksByNode = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      if (task.status === 'production_completed' || task.status === 'completed') continue;
      const nid = matchTaskToNode(task, nodeMap);
      if (nid) { if (!map[nid]) map[nid] = []; map[nid].push(task); }
    }
    return map;
  }, [tasks, nodeMap]);

  const getColor = (id, fallback) => customColors[id] || fallback;

  const toggleExpand = useCallback((id) => {
    setExpandedSet(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const totalTasks = tasks.filter(t => t.status !== 'production_completed' && t.status !== 'completed').length;
  const today = useMemo(() => {
    const d = new Date();
    const days = ['\u05E8\u05D0\u05E9\u05D5\u05DF', '\u05E9\u05E0\u05D9', '\u05E9\u05DC\u05D9\u05E9\u05D9', '\u05E8\u05D1\u05D9\u05E2\u05D9', '\u05D7\u05DE\u05D9\u05E9\u05D9', '\u05E9\u05D9\u05E9\u05D9', '\u05E9\u05D1\u05EA'];
    return `\u05D9\u05D5\u05DD ${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
  }, []);

  // Build layout: nodes + edges
  const { displayNodes, displayEdges } = useMemo(() => {
    if (!companyTree?.branches) return { displayNodes: [], displayEdges: [] };
    const nodes = [];
    const edges = [];

    const allBranchKeys = Object.keys(companyTree.branches);
    const branchKeys = filterBranch ? allBranchKeys.filter(k => k === filterBranch) : allBranchKeys;

    branchKeys.forEach((branchId, bi) => {
      const branch = companyTree.branches[branchId];
      const dna = BRANCH_DNA[branchId] || BRANCH_DNA.P2;
      const branchColor = getColor(branchId, dna.color);
      const isSingleBranch = branchKeys.length === 1;
      const angle = isSingleBranch ? -Math.PI / 2 : (BRANCH_ANGLES[branchId] ?? (-Math.PI / 2 + bi * (2 * Math.PI / branchKeys.length)));
      const branchDist = isSingleBranch ? 160 : 230;
      const bx = CX + Math.cos(angle) * branchDist;
      const by = CY + Math.sin(angle) * branchDist;

      // Collect tasks for this entire branch
      const allBranchIds = flattenTree({ branches: { [branchId]: branch } }).map(n => n.id);
      const branchTaskCount = allBranchIds.reduce((s, nid) => s + (tasksByNode[nid]?.length || 0), 0);
      const branchClients = new Set();
      allBranchIds.forEach(nid => (tasksByNode[nid] || []).forEach(t => { if (t.client_name) branchClients.add(t.client_name); }));

      nodes.push({
        id: branchId, type: 'branch',
        x: bx, y: by,
        label: dna.label, branchId,
        color: branchColor, bg: dna.bg, emoji: dna.emoji,
        taskCount: branchTaskCount,
        clientCount: branchClients.size,
        isExpanded: expandedSet.has(branchId),
        totalDescendants: (branch.children || []).reduce((s, c) => s + 1 + countDescendants(c), 0),
      });
      edges.push({ from: { x: CX, y: CY }, to: { x: bx, y: by }, color: branchColor, w1: 9, w2: 3.5 });

      if (!expandedSet.has(branchId)) return;

      const children = branch.children || [];
      const childDist = 165;

      const layoutNode = (node, px, py, pAngle, depth, idx, sibCount, parentId) => {
        const dist = depth === 1 ? childDist : 125;
        let nodeAngle;
        if (sibCount === 1) { nodeAngle = pAngle; }
        else {
          const spread = Math.min(Math.PI * 0.85, Math.PI * 0.15 + sibCount * Math.PI * 0.11);
          nodeAngle = pAngle - spread / 2 + (spread * idx) / Math.max(1, sibCount - 1);
        }
        const nx = px + Math.cos(nodeAngle) * dist;
        const ny = py + Math.sin(nodeAngle) * dist;
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedSet.has(node.id);
        const nodeTasks = tasksByNode[node.id] || [];
        const nodeColor = getColor(node.id, branchColor);

        // Count total tasks including children
        let totalNodeTasks = nodeTasks.length;
        if (hasChildren) {
          const walkCount = (ch) => { for (const c of ch) { totalNodeTasks += (tasksByNode[c.id]?.length || 0); if (c.children) walkCount(c.children); } };
          walkCount(node.children);
        }

        const statusDist = {};
        nodeTasks.forEach(t => { const s = t.status || 'not_started'; statusDist[s] = (statusDist[s] || 0) + 1; });

        nodes.push({
          id: node.id, type: hasChildren ? 'group' : 'service',
          x: nx, y: ny,
          label: node.label, branchId,
          color: nodeColor, bg: dna.bg,
          taskCount: totalNodeTasks,
          directTasks: nodeTasks.length,
          tasks: nodeTasks,
          statusDist,
          stepCount: node.steps?.length || 0,
          sla_day: node.sla_day,
          hasChildren, isExpanded,
          totalDescendants: countDescendants(node),
          depends_on: node.depends_on,
        });
        edges.push({
          from: { x: px, y: py }, to: { x: nx, y: ny },
          color: nodeColor,
          w1: depth === 1 ? 5 : 3, w2: depth === 1 ? 2 : 1.2,
          dashed: node.depends_on && node.depends_on.length > 0,
        });

        if (hasChildren && isExpanded) {
          node.children.forEach((child, ci) => {
            layoutNode(child, nx, ny, nodeAngle, depth + 1, ci, node.children.length, node.id);
          });
        }
      };

      children.forEach((child, ci) => {
        layoutNode(child, bx, by, angle, 1, ci, children.length, branchId);
      });
    });

    // Custom connections
    customConnections.forEach(cc => {
      const fromNode = nodes.find(n => n.id === cc.from);
      const toNode = nodes.find(n => n.id === cc.to);
      if (fromNode && toNode) {
        edges.push({ from: { x: fromNode.x, y: fromNode.y }, to: { x: toNode.x, y: toNode.y }, color: '#FF9800', w1: 3, w2: 1.5, custom: true, connId: cc.id });
      }
    });

    return { displayNodes: nodes, displayEdges: edges };
  }, [companyTree, tasksByNode, expandedSet, customColors, customConnections]);

  const selectedNode = displayNodes.find(n => n.id === selectedNodeId);

  if (!companyTree) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px]">
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ minHeight: '500px' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 160px)', minHeight: '480px', userSelect: 'none' }}
        dir="ltr"
        onClick={() => setSelectedNodeId(null)}
      >
        <defs>
          <filter id="ptf-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.12" />
          </filter>
          <filter id="ptf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#4682B4" floodOpacity="0.35" />
          </filter>
          <filter id="ptf-hover" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#999" floodOpacity="0.25" />
          </filter>
          <pattern id="ptf-dots" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="0.5" fill="#ddd" />
          </pattern>
          <clipPath id="ptf-hub-clip"><circle cx={CX} cy={CY} r={52} /></clipPath>
        </defs>

        {/* Background */}
        <rect width={VB_W} height={VB_H} fill="url(#ptf-dots)" rx="12" />

        {/* Tapered connections */}
        {displayEdges.map((edge, i) => (
          <path key={`e-${i}`}
            d={taperedPath(edge.from.x, edge.from.y, edge.to.x, edge.to.y, edge.w1, edge.w2)}
            fill={edge.color}
            opacity={edge.dashed ? 0.2 : 0.35}
            strokeDasharray={edge.dashed ? '6 3' : 'none'}
          />
        ))}

        {/* ═══ Logo Hub (center) ═══ */}
        <circle cx={CX} cy={CY} r={58} fill="white" filter="url(#ptf-shadow)" />
        <image
          href={`${window.location.origin}/logo-litay.png`}
          x={CX - 50} y={CY - 50} width={100} height={100}
          clipPath="url(#ptf-hub-clip)"
          preserveAspectRatio="xMidYMid slice"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <circle cx={CX} cy={CY} r={58} fill="none" stroke="#66BB6A" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={CX} y={CY + 48} textAnchor="middle" fill="#F57C00" fontSize="12" fontWeight="800">
          {totalTasks} {'משימות'}
        </text>
        <text x={CX} y={CY + 62} textAnchor="middle" fill="#78909C" fontSize="9" fontWeight="600">{today}</text>

        {/* ═══ Branch Cards (Ayoa-style filled rectangles) ═══ */}
        {displayNodes.filter(n => n.type === 'branch').map(node => {
          const isHovered = hoveredNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const cardW = 150, cardH = 58;
          return (
            <g key={node.id}
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); setSelectedNodeId(node.id); }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: 'pointer' }}
              filter={isSelected ? 'url(#ptf-glow)' : isHovered ? 'url(#ptf-hover)' : 'url(#ptf-shadow)'}
            >
              {/* Filled rectangle card */}
              <rect x={node.x - cardW/2} y={node.y - cardH/2} width={cardW} height={cardH} rx={14}
                fill={node.color} stroke="white" strokeWidth={2} />
              {/* Emoji */}
              <text x={node.x - cardW/2 + 22} y={node.y + 1} textAnchor="middle" fontSize="16">{node.emoji}</text>
              {/* Label */}
              <text x={node.x + 8} y={node.y - 8} textAnchor="middle" fill="white" fontSize="14" fontWeight="900">
                {node.branchId} {node.label}
              </text>
              {/* Counts */}
              <text x={node.x + 8} y={node.y + 10} textAnchor="middle" fill="white" fontSize="10" fontWeight="700" opacity="0.85">
                {node.taskCount} {'משימות'} {' · '} {node.clientCount} {'לקוחות'}
              </text>
              {/* Expand badge */}
              <circle cx={node.x + cardW/2 - 2} cy={node.y - cardH/2 + 2} r={10}
                fill={node.isExpanded ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)'} />
              <text x={node.x + cardW/2 - 2} y={node.y - cardH/2 + 6} textAnchor="middle"
                fill="white" fontSize="12" fontWeight="900">
                {node.isExpanded ? '\u2212' : '+'}
              </text>
              {/* Collapsed total badge */}
              {!node.isExpanded && node.totalDescendants > 0 && (
                <>
                  <circle cx={node.x + cardW/2 + 4} cy={node.y} r={12} fill="white" stroke={node.color} strokeWidth={2} />
                  <text x={node.x + cardW/2 + 4} y={node.y + 4} textAnchor="middle" fill={node.color} fontSize="9" fontWeight="900">
                    +{node.totalDescendants}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* ═══ Service/Group Cards (Ayoa rectangular pills) ═══ */}
        {displayNodes.filter(n => n.type === 'service' || n.type === 'group').map(node => {
          const isHovered = hoveredNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const hasTasks = node.taskCount > 0;
          const cardW = 130, cardH = hasTasks ? 52 : 40;

          return (
            <g key={node.id}
              onClick={(e) => {
                e.stopPropagation();
                if (node.hasChildren) toggleExpand(node.id);
                setSelectedNodeId(node.id);
              }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: 'pointer' }}
              filter={isSelected ? 'url(#ptf-glow)' : isHovered ? 'url(#ptf-hover)' : 'url(#ptf-shadow)'}
            >
              {/* Card body */}
              <rect x={node.x - cardW/2} y={node.y - cardH/2} width={cardW} height={cardH} rx={cardH/2}
                fill={node.bg} stroke={node.color} strokeWidth={isSelected ? 3 : 1.5} />
              {/* Color accent left bar */}
              <rect x={node.x - cardW/2 + 3} y={node.y - cardH/2 + 6} width={4} height={cardH - 12} rx={2}
                fill={node.color} />
              {/* Label */}
              <text x={node.x + 4} y={node.y - (hasTasks ? 6 : 1)} textAnchor="middle" fill="#333" fontSize="11" fontWeight="800">
                {node.label.length > 15 ? node.label.substring(0, 14) + '\u2026' : node.label}
              </text>
              {/* Meta line: steps + SLA */}
              {(node.stepCount > 0 || node.sla_day) && (
                <text x={node.x + 4} y={node.y + (hasTasks ? 5 : 10)} textAnchor="middle" fill="#999" fontSize="8" fontWeight="600">
                  {node.stepCount > 0 ? `${node.stepCount} \u05E9\u05DC\u05D1\u05D9\u05DD` : ''}
                  {node.stepCount > 0 && node.sla_day ? ' \u00B7 ' : ''}
                  {node.sla_day ? `SLA: ${node.sla_day}` : ''}
                </text>
              )}
              {/* Task count badge */}
              {hasTasks && (
                <>
                  <circle cx={node.x + cardW/2 - 2} cy={node.y - cardH/2 + 2} r={11}
                    fill={node.color} stroke="white" strokeWidth={2} />
                  <text x={node.x + cardW/2 - 2} y={node.y - cardH/2 + 6}
                    textAnchor="middle" fill="white" fontSize="9" fontWeight="900">
                    {node.taskCount}
                  </text>
                </>
              )}
              {/* Status mini-bar */}
              {hasTasks && node.statusDist && Object.keys(node.statusDist).length > 0 && (
                <g>
                  {(() => {
                    const statuses = Object.entries(node.statusDist);
                    const total = statuses.reduce((s, [, c]) => s + c, 0);
                    const barW = cardW - 28;
                    const barY = node.y + cardH/2 - 10;
                    let offset = 0;
                    return statuses.map(([st, count], si) => {
                      const w = (count / total) * barW;
                      const x = node.x - cardW/2 + 14 + offset;
                      offset += w;
                      return <rect key={si} x={x} y={barY} width={Math.max(3, w)} height={4} rx={2} fill={STATUS_COLORS[st] || '#90A4AE'} />;
                    });
                  })()}
                </g>
              )}
              {/* Expand indicator for groups */}
              {node.hasChildren && (
                <>
                  <circle cx={node.x + cardW/2 - 4} cy={node.y + cardH/2 - 4} r={7}
                    fill={node.isExpanded ? node.color : '#E0E0E0'} />
                  <text x={node.x + cardW/2 - 4} y={node.y + cardH/2 - 1} textAnchor="middle"
                    fill={node.isExpanded ? 'white' : '#666'} fontSize="9" fontWeight="900">
                    {node.isExpanded ? '\u25BC' : '\u25B6'}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* ═══ Selected Node Detail Panel ═══ */}
      {selectedNode && selectedNode.tasks && selectedNode.tasks.length > 0 && (
        <div className="absolute top-3 left-3 w-80 bg-white rounded-2xl shadow-2xl border-2 overflow-hidden" style={{ zIndex: 20, borderColor: selectedNode.color }}>
          <div className="px-4 py-2.5 text-white font-black text-sm flex items-center justify-between"
            style={{ backgroundColor: selectedNode.color }}>
            <span>{selectedNode.label}</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs">{selectedNode.tasks.length}</span>
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
            {selectedNode.tasks.map(task => (
              <div key={task.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[task.status] || '#90A4AE' }} />
                  <span className="text-[11px] font-bold text-gray-800 truncate flex-1">{task.title}</span>
                </div>
                <div className="flex items-center gap-2 mr-3 mt-0.5">
                  {task.client_name && <span className="text-[10px] text-gray-500">{task.client_name}</span>}
                  {task.due_date && <span className="text-[10px] text-orange-500 font-medium">{task.due_date}</span>}
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                    style={{ backgroundColor: (STATUS_COLORS[task.status] || '#90A4AE') + '15', color: STATUS_COLORS[task.status] }}>
                    {STATUS_LABELS[task.status] || task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Design Editor ═══ */}
      <button onClick={() => setShowEditor(!showEditor)}
        className="absolute top-3 right-3 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all z-20"
        style={{ backgroundColor: showEditor ? '#E91E63' : 'white', color: showEditor ? 'white' : '#666', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        {showEditor ? 'X \u05E1\u05D2\u05D5\u05E8' : '\u270F\uFE0F \u05E2\u05D5\u05E8\u05DA \u05E2\u05D9\u05E6\u05D5\u05D1'}
      </button>

      {showEditor && (
        <div className="absolute top-12 right-3 w-72 bg-white rounded-2xl shadow-2xl border overflow-hidden" style={{ zIndex: 30 }} dir="rtl">
          <div className="px-4 py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black text-sm">
            עורך עיצוב
          </div>
          <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
            {/* Branch colors */}
            <div>
              <div className="text-[11px] font-bold text-gray-600 mb-1.5">צבעי ענפים</div>
              {Object.entries(BRANCH_DNA).map(([id, dna]) => (
                <div key={id} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-bold w-24" style={{ color: getColor(id, dna.color) }}>{id} {dna.label}</span>
                  <input type="color" value={customColors[id] || dna.color}
                    onChange={(e) => setCustomColors(prev => ({ ...prev, [id]: e.target.value }))}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                  {customColors[id] && (
                    <button onClick={() => setCustomColors(prev => { const n = { ...prev }; delete n[id]; return n; })}
                      className="text-[9px] text-gray-400 hover:text-red-500">איפוס</button>
                  )}
                </div>
              ))}
            </div>

            {/* Node color overrides */}
            <div>
              <div className="text-[11px] font-bold text-gray-600 mb-1.5">צבע צומת</div>
              <div className="flex gap-1 flex-wrap">
                {Object.keys(nodeMap).slice(0, 20).map(nid => {
                  const node = nodeMap[nid];
                  const dna = BRANCH_DNA[node.branch] || BRANCH_DNA.P2;
                  return (
                    <button key={nid}
                      onClick={() => setEditingNodeColor(editingNodeColor === nid ? null : nid)}
                      className="px-2 py-0.5 rounded-lg text-[8px] font-bold"
                      style={{ backgroundColor: editingNodeColor === nid ? getColor(nid, dna.color) : dna.bg, color: editingNodeColor === nid ? 'white' : dna.color }}>
                      {node.label?.substring(0, 6)}
                    </button>
                  );
                })}
              </div>
              {editingNodeColor && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-500">{nodeMap[editingNodeColor]?.label}:</span>
                  {COLOR_PALETTE.map(c => (
                    <button key={c} onClick={() => setCustomColors(prev => ({ ...prev, [editingNodeColor]: c }))}
                      className="w-5 h-5 rounded-full border-2"
                      style={{ backgroundColor: c, borderColor: customColors[editingNodeColor] === c ? '#333' : 'transparent' }} />
                  ))}
                </div>
              )}
            </div>

            {/* Custom connections */}
            <div>
              <div className="text-[11px] font-bold text-gray-600 mb-1.5">חיבורים מותאמים</div>
              {customConnections.map(cc => (
                <div key={cc.id} className="flex items-center gap-2 mb-1 text-[10px]">
                  <span className="text-gray-600">{nodeMap[cc.from]?.label || cc.from} \u2190 {nodeMap[cc.to]?.label || cc.to}</span>
                  <button onClick={() => setCustomConnections(prev => prev.filter(c => c.id !== cc.id))}
                    className="text-red-400 hover:text-red-600 font-bold">X</button>
                </div>
              ))}
              <div className="flex gap-1 mt-1">
                <select id="ptf-cc-from" className="text-[10px] border rounded px-1 py-0.5 flex-1">
                  <option value="">מ...</option>
                  {Object.keys(nodeMap).map(nid => <option key={nid} value={nid}>{nodeMap[nid].label}</option>)}
                </select>
                <select id="ptf-cc-to" className="text-[10px] border rounded px-1 py-0.5 flex-1">
                  <option value="">אל...</option>
                  {Object.keys(nodeMap).map(nid => <option key={nid} value={nid}>{nodeMap[nid].label}</option>)}
                </select>
                <button onClick={() => {
                  const f = document.getElementById('ptf-cc-from')?.value;
                  const t = document.getElementById('ptf-cc-to')?.value;
                  if (f && t && f !== t) setCustomConnections(prev => [...prev, { from: f, to: t, id: `cc-${Date.now()}` }]);
                }} className="px-2 py-0.5 bg-purple-500 text-white rounded text-[10px] font-bold">+</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-xl px-4 py-2 shadow-sm border" style={{ zIndex: 10 }}>
        {Object.entries(BRANCH_DNA).map(([id, dna]) => (
          <div key={id} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: getColor(id, dna.color) }} />
            <span className="text-[9px] font-bold" style={{ color: getColor(id, dna.color) }}>{id}</span>
          </div>
        ))}
        <span className="text-[10px] text-gray-400">V4.3</span>
      </div>
    </div>
  );
}
