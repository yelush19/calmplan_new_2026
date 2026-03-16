/**
 * ProcessTreeFocusMap — Ayoa-Style Process Tree Mind Map (V4.3)
 *
 * Premium radial mind map for the Focus page:
 *   - Filled branch cards with DNA colors (P1-P5)
 *   - Organic tapered connections
 *   - Service nodes as structured white cards with color accents
 *   - Task matching, expand/collapse, interactive detail panel
 *   - Built from the company process tree dynamically
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadCompanyTree } from '@/services/processTreeService';
import { flattenTree, PROCESS_TREE_SEED } from '@/config/companyProcessTree';
import { resolveCategoryLabel } from '@/utils/categoryLabels';

const VB_W = 1600, VB_H = 1000;
const CX = VB_W / 2, CY = VB_H / 2;

// Branch radial positions — spread around center
const BRANCH_LAYOUT = {
  P1: { angle: -Math.PI * 0.6, dist: 240, emoji: '\uD83D\uDCB0' },
  P2: { angle: -Math.PI * 0.1, dist: 250, emoji: '\uD83D\uDCCA' },
  P5: { angle: Math.PI * 0.25, dist: 240, emoji: '\uD83D\uDCCB' },
  P3: { angle: Math.PI * 0.55, dist: 220, emoji: '\uD83D\uDCC1' },
  P4: { angle: Math.PI * 0.85, dist: 230, emoji: '\uD83C\uDFE0' },
};

// Branch DNA colors — filled card backgrounds
const BRANCH_DNA = {
  P1: { color: '#0288D1', dark: '#01579B', label: 'חשבות שכר', bg: '#E1F5FE', grad: ['#039BE5', '#0277BD'] },
  P2: { color: '#7B1FA2', dark: '#4A148C', label: 'הנהלת חשבונות', bg: '#F3E5F5', grad: ['#9C27B0', '#6A1B9A'] },
  P3: { color: '#D81B60', dark: '#880E4F', label: 'ניהול משרד', bg: '#FCE4EC', grad: ['#E91E63', '#C2185B'] },
  P4: { color: '#F9A825', dark: '#F57F17', label: 'בית ואישי', bg: '#FFF8E1', grad: ['#FFB300', '#FF8F00'] },
  P5: { color: '#2E7D32', dark: '#1B5E20', label: 'דוחות שנתיים', bg: '#E8F5E9', grad: ['#43A047', '#2E7D32'] },
};

const STATUS_COLORS = {
  not_started: '#1565C0',
  in_progress: '#F57C00',
  waiting_for_materials: '#FF8F00',
  sent_for_review: '#7B1FA2',
  needs_corrections: '#E65100',
  production_completed: '#2E7D32',
  completed: '#1B5E20',
};

const STATUS_LABELS = {
  not_started: 'לא התחיל',
  in_progress: 'בתהליך',
  waiting_for_materials: 'ממתין לחומרים',
  sent_for_review: 'נשלח לבדיקה',
  needs_corrections: 'דרוש תיקון',
  production_completed: 'הושלם',
};

// Organic bezier path between nodes
function organicPath(x1, y1, x2, y2, w1 = 8, w2 = 3) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const curve = Math.min(40, len * 0.15);
  const cpx = mx + nx * curve * 1.5;
  const cpy = my - ny * curve * 1.5;
  const hw1 = w1 / 2, hw2 = w2 / 2;
  return `M${x1 + nx * hw1},${y1 + ny * hw1}
    Q${cpx + nx * (hw1 + hw2) / 2},${cpy + ny * (hw1 + hw2) / 2} ${x2 + nx * hw2},${y2 + ny * hw2}
    L${x2 - nx * hw2},${y2 - ny * hw2}
    Q${cpx - nx * (hw1 + hw2) / 2},${cpy - ny * (hw1 + hw2) / 2} ${x1 - nx * hw1},${y1 - ny * hw1}
    Z`;
}

// Match task to tree node
function matchTaskToNode(task, nodeMap) {
  if (task.tree_node_id && nodeMap[task.tree_node_id]) return task.tree_node_id;
  if (task.service_key) {
    for (const [nodeId, node] of Object.entries(nodeMap)) {
      if (node.service_key === task.service_key) return nodeId;
    }
  }
  const cat = resolveCategoryLabel(task.category || '').toLowerCase();
  for (const [nodeId, node] of Object.entries(nodeMap)) {
    const nodeLabel = (node.label || '').toLowerCase();
    if (cat && nodeLabel && (cat.includes(nodeLabel) || nodeLabel.includes(cat))) return nodeId;
  }
  const catMap = {
    'שכר': 'P1_payroll', 'payroll': 'P1_payroll', 'work_payroll': 'P1_payroll',
    'מע"מ': 'P2_vat', 'vat': 'P2_vat', 'work_vat': 'P2_vat', 'work_vat_reporting': 'P2_vat',
    'מקדמות': 'P2_tax_advances', 'tax_advances': 'P2_tax_advances', 'work_tax_advances': 'P2_tax_advances',
    'ביטוח לאומי': 'P1_social_security', 'social_security': 'P1_social_security',
    'ניכויים': 'P1_deductions', 'deductions': 'P1_deductions',
    'התאמות': 'P2_reconciliation', 'reconciliation': 'P2_reconciliation', 'work_reconciliation': 'P2_reconciliation',
    'הכנסות': 'P2_income', 'הוצאות': 'P2_expenses',
    'רוו"ה': 'P2_pnl', 'pnl': 'P2_pnl',
  };
  const rawCat = (task.category || '').toLowerCase();
  for (const [key, nodeId] of Object.entries(catMap)) {
    if (rawCat.includes(key) && nodeMap[nodeId]) return nodeId;
  }
  return null;
}

export default function ProcessTreeFocusMap({ tasks = [], clients = [], centerLabel = 'הפוקוס שלי' }) {
  const svgRef = useRef(null);
  const [companyTree, setCompanyTree] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [expandedBranches, setExpandedBranches] = useState(new Set(['P1', 'P2', 'P3', 'P4', 'P5']));

  useEffect(() => {
    loadCompanyTree().then(({ tree }) => setCompanyTree(tree)).catch(() => setCompanyTree(PROCESS_TREE_SEED));
  }, []);

  const nodeMap = useMemo(() => {
    if (!companyTree) return {};
    const flat = flattenTree(companyTree);
    const map = {};
    for (const n of flat) map[n.id] = n;
    return map;
  }, [companyTree]);

  const tasksByNode = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      if (task.status === 'production_completed' || task.status === 'completed') continue;
      const nodeId = matchTaskToNode(task, nodeMap);
      if (nodeId) {
        if (!map[nodeId]) map[nodeId] = [];
        map[nodeId].push(task);
      }
    }
    return map;
  }, [tasks, nodeMap]);

  const today = useMemo(() => {
    const d = new Date();
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return `יום ${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
  }, []);

  // Build all display nodes and edges
  const { displayNodes, displayEdges } = useMemo(() => {
    if (!companyTree?.branches) return { displayNodes: [], displayEdges: [] };
    const nodes = [];
    const edges = [];

    // All branches including P4
    const branchEntries = Object.entries(companyTree.branches);

    branchEntries.forEach(([branchId, branch]) => {
      const dna = BRANCH_DNA[branchId] || { color: '#607D8B', dark: '#455A64', label: branchId, bg: '#ECEFF1', grad: ['#607D8B', '#455A64'] };
      const layout = BRANCH_LAYOUT[branchId] || { angle: 0, dist: 220, emoji: '' };
      const bx = CX + Math.cos(layout.angle) * layout.dist;
      const by = CY + Math.sin(layout.angle) * layout.dist;

      const branchChildren = branch.children || [];
      const allBranchNodeIds = flattenTree({ branches: { [branchId]: branch } }).map(n => n.id);
      const branchTaskCount = allBranchNodeIds.reduce((sum, nid) => sum + (tasksByNode[nid]?.length || 0), 0);
      const branchClients = new Set();
      allBranchNodeIds.forEach(nid => {
        (tasksByNode[nid] || []).forEach(t => { if (t.client_name) branchClients.add(t.client_name); });
      });

      nodes.push({
        id: branchId, type: 'branch',
        x: bx, y: by,
        label: dna.label,
        branchId, color: dna.color, dark: dna.dark, bg: dna.bg, grad: dna.grad,
        emoji: layout.emoji,
        taskCount: branchTaskCount,
        clientCount: branchClients.size,
        angle: layout.angle,
      });

      edges.push({ from: { x: CX, y: CY }, to: { x: bx, y: by }, color: dna.color, w1: 10, w2: 4 });

      // Child nodes (services)
      if (expandedBranches.has(branchId)) {
        const childDist = 180;
        const childCount = branchChildren.length;
        const spread = Math.min(Math.PI * 0.9, Math.PI * 0.18 + childCount * Math.PI * 0.13);

        branchChildren.forEach((child, ci) => {
          let childAngle;
          if (childCount === 1) {
            childAngle = layout.angle;
          } else {
            const start = layout.angle - spread / 2;
            childAngle = start + (spread * ci) / Math.max(1, childCount - 1);
          }
          const cx_ = bx + Math.cos(childAngle) * childDist;
          const cy_ = by + Math.sin(childAngle) * childDist;

          const nodeTasks = tasksByNode[child.id] || [];
          const hasSubNodes = child.children && child.children.length > 0;

          let subTaskCount = nodeTasks.length;
          if (hasSubNodes) {
            const walkChildren = (ch) => { for (const c of ch) { subTaskCount += (tasksByNode[c.id]?.length || 0); if (c.children) walkChildren(c.children); } };
            walkChildren(child.children);
          }

          const nodeClients = new Set();
          nodeTasks.forEach(t => { if (t.client_name) nodeClients.add(t.client_name); });

          const statusDist = {};
          nodeTasks.forEach(t => { const s = t.status || 'not_started'; statusDist[s] = (statusDist[s] || 0) + 1; });

          nodes.push({
            id: child.id, type: 'service',
            x: cx_, y: cy_,
            label: child.label,
            branchId, color: dna.color, dark: dna.dark, bg: dna.bg,
            taskCount: subTaskCount,
            clientCount: nodeClients.size,
            stepCount: (child.steps || []).length,
            statusDist,
            sla_day: child.sla_day,
            angle: childAngle,
            tasks: nodeTasks,
            hasSubNodes,
          });

          edges.push({ from: { x: bx, y: by }, to: { x: cx_, y: cy_ }, color: dna.color, w1: 5, w2: 2 });

          // Sub-nodes
          if (hasSubNodes && expandedBranches.has(child.id)) {
            const subDist = 120;
            const subCount = child.children.length;
            const subSpread = Math.min(Math.PI * 0.5, Math.PI * 0.12 + subCount * Math.PI * 0.1);

            child.children.forEach((sub, si) => {
              const subAngle = subCount === 1 ? childAngle :
                childAngle - subSpread / 2 + (subSpread * si) / Math.max(1, subCount - 1);
              const sx = cx_ + Math.cos(subAngle) * subDist;
              const sy = cy_ + Math.sin(subAngle) * subDist;
              const subTasks = tasksByNode[sub.id] || [];

              nodes.push({
                id: sub.id, type: 'sub',
                x: sx, y: sy,
                label: sub.label,
                branchId, color: dna.color, bg: dna.bg,
                taskCount: subTasks.length,
                stepCount: (sub.steps || []).length,
                sla_day: sub.sla_day,
                tasks: subTasks,
              });

              edges.push({ from: { x: cx_, y: cy_ }, to: { x: sx, y: sy }, color: dna.color, w1: 3, w2: 1.2 });
            });
          }
        });
      }
    });

    return { displayNodes: nodes, displayEdges: edges };
  }, [companyTree, tasksByNode, expandedBranches]);

  const toggleBranch = useCallback((branchId) => {
    setExpandedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId); else next.add(branchId);
      return next;
    });
  }, []);

  const selectedNode = displayNodes.find(n => n.id === selectedNodeId);
  const totalTasks = tasks.filter(t => t.status !== 'production_completed' && t.status !== 'completed').length;

  if (!companyTree) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm font-bold text-gray-500">טוען מפת תהליכים...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ minHeight: '500px', background: 'linear-gradient(135deg, #FAFBFC 0%, #F0F4F8 50%, #FAFBFC 100%)' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 160px)' }}
        onClick={() => setSelectedNodeId(null)}
      >
        <defs>
          <filter id="ptf-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#000" floodOpacity="0.12" />
          </filter>
          <filter id="ptf-shadow-lg" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="#000" floodOpacity="0.18" />
          </filter>
          <filter id="ptf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#1E3A5F" floodOpacity="0.35" />
          </filter>
          <radialGradient id="ptf-center-grad">
            <stop offset="0%" stopColor="#1E3A5F" />
            <stop offset="60%" stopColor="#0D2137" />
            <stop offset="100%" stopColor="#091520" />
          </radialGradient>
          <radialGradient id="ptf-center-ring">
            <stop offset="70%" stopColor="transparent" />
            <stop offset="100%" stopColor="#FFC10715" />
          </radialGradient>
          {/* Branch gradients */}
          {Object.entries(BRANCH_DNA).map(([id, dna]) => (
            <linearGradient key={id} id={`ptf-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={dna.grad[0]} />
              <stop offset="100%" stopColor={dna.grad[1]} />
            </linearGradient>
          ))}
        </defs>

        {/* Background subtle rings */}
        <circle cx={CX} cy={CY} r={180} fill="none" stroke="#E0E0E0" strokeWidth={0.5} strokeDasharray="4 8" opacity={0.4} />
        <circle cx={CX} cy={CY} r={380} fill="none" stroke="#E0E0E0" strokeWidth={0.5} strokeDasharray="4 8" opacity={0.3} />

        {/* Organic connections */}
        {displayEdges.map((edge, i) => (
          <path key={`edge-${i}`}
            d={organicPath(edge.from.x, edge.from.y, edge.to.x, edge.to.y, edge.w1, edge.w2)}
            fill={edge.color}
            opacity={0.35}
          />
        ))}

        {/* ═══ Center Hub ═══ */}
        <circle cx={CX} cy={CY} r={72} fill="url(#ptf-center-ring)" />
        <circle cx={CX} cy={CY} r={62} fill="url(#ptf-center-grad)" filter="url(#ptf-glow)" />
        <circle cx={CX} cy={CY} r={62} fill="none" stroke="#FFC107" strokeWidth={2} opacity={0.4} />
        <text x={CX} y={CY - 18} textAnchor="middle" fill="white" fontSize="18" fontWeight="900" fontFamily="system-ui">{centerLabel}</text>
        <text x={CX} y={CY + 2} textAnchor="middle" fill="#FFC107" fontSize="14" fontWeight="800">{totalTasks} משימות להיום</text>
        <text x={CX} y={CY + 20} textAnchor="middle" fill="white" fontSize="11" fontWeight="600" opacity="0.5">{today}</text>

        {/* ═══ Branch Cards (Filled with DNA color) ═══ */}
        {displayNodes.filter(n => n.type === 'branch').map(node => {
          const isHovered = hoveredNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const isExpanded = expandedBranches.has(node.id);
          const cardW = 155, cardH = 65;
          return (
            <g key={node.id}
              onClick={(e) => { e.stopPropagation(); toggleBranch(node.id); setSelectedNodeId(node.id); }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Selection ring */}
              {isSelected && (
                <rect x={node.x - cardW/2 - 5} y={node.y - cardH/2 - 5} width={cardW + 10} height={cardH + 10} rx={18}
                  fill="none" stroke={node.color} strokeWidth={2.5} opacity={0.5} strokeDasharray="6 4">
                  <animate attributeName="stroke-dashoffset" from="0" to="20" dur="3s" repeatCount="indefinite" />
                </rect>
              )}
              {/* Card body — FILLED with branch gradient */}
              <rect x={node.x - cardW/2} y={node.y - cardH/2} width={cardW} height={cardH} rx={14}
                fill={`url(#ptf-grad-${node.branchId})`}
                filter={isHovered ? 'url(#ptf-shadow-lg)' : 'url(#ptf-shadow)'}
                stroke="white" strokeWidth={isHovered ? 2.5 : 1}
                style={{ transition: 'all 0.2s' }}
              />
              {/* Branch emoji */}
              <text x={node.x - cardW/2 + 20} y={node.y - 6} textAnchor="middle" fontSize="20">{node.emoji}</text>
              {/* Branch label */}
              <text x={node.x + 6} y={node.y - 10} textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="system-ui">
                {node.branchId} {node.label}
              </text>
              {/* Task + client count */}
              <text x={node.x + 6} y={node.y + 10} textAnchor="middle" fill="white" fontSize="11" fontWeight="700" opacity="0.9">
                {node.taskCount} משימות · {node.clientCount} לקוחות
              </text>
              {/* Expand/collapse badge */}
              <circle cx={node.x + cardW/2 - 2} cy={node.y - cardH/2 + 2} r={11}
                fill={isExpanded ? 'white' : 'rgba(255,255,255,0.3)'} stroke="white" strokeWidth={1.5} />
              <text x={node.x + cardW/2 - 2} y={node.y - cardH/2 + 6} textAnchor="middle"
                fontSize="14" fontWeight="900" fill={isExpanded ? node.color : 'white'}>
                {isExpanded ? '\u2212' : '+'}
              </text>
            </g>
          );
        })}

        {/* ═══ Service Cards (White with color accent) ═══ */}
        {displayNodes.filter(n => n.type === 'service').map(node => {
          const isHovered = hoveredNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const hasTasks = node.taskCount > 0;
          const cardW = 140, cardH = hasTasks ? 76 : 56;
          const label = node.label;

          return (
            <g key={node.id}
              onClick={(e) => {
                e.stopPropagation();
                if (node.hasSubNodes) toggleBranch(node.id);
                setSelectedNodeId(node.id);
              }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: 'pointer' }}
            >
              {isSelected && (
                <rect x={node.x - cardW/2 - 4} y={node.y - cardH/2 - 4} width={cardW + 8} height={cardH + 8} rx={14}
                  fill="none" stroke={node.color} strokeWidth={2} opacity={0.4} strokeDasharray="5 3" />
              )}
              {/* Card body */}
              <rect x={node.x - cardW/2} y={node.y - cardH/2} width={cardW} height={cardH} rx={12}
                fill="white" stroke={hasTasks ? node.color : '#D0D5DD'}
                strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
                filter="url(#ptf-shadow)"
                style={{ transition: 'all 0.15s' }}
              />
              {/* Color accent — top bar */}
              <rect x={node.x - cardW/2} y={node.y - cardH/2} width={cardW} height={6} rx={3}
                fill={node.color} />
              {/* Label */}
              <text x={node.x} y={node.y - cardH/2 + 24} textAnchor="middle" fontSize="12" fontWeight="800" fill="#1E293B">
                {label.length > 16 ? label.substring(0, 15) + '...' : label}
              </text>
              {/* Step count + SLA */}
              {(node.stepCount > 0 || node.sla_day) && (
                <text x={node.x} y={node.y - cardH/2 + 38} textAnchor="middle" fontSize="9" fontWeight="600" fill="#90A4AE">
                  {node.stepCount > 0 ? `${node.stepCount} שלבים` : ''}
                  {node.stepCount > 0 && node.sla_day ? ' · ' : ''}
                  {node.sla_day ? `SLA: ${node.sla_day}` : ''}
                </text>
              )}
              {/* Task count badge */}
              {hasTasks && (
                <>
                  <circle cx={node.x + cardW/2 - 4} cy={node.y - cardH/2 + 4} r={12}
                    fill={node.color} stroke="white" strokeWidth={2} />
                  <text x={node.x + cardW/2 - 4} y={node.y - cardH/2 + 8}
                    textAnchor="middle" fontSize="10" fontWeight="900" fill="white">
                    {node.taskCount}
                  </text>
                </>
              )}
              {/* Status bar */}
              {hasTasks && node.statusDist && (
                <g>
                  {(() => {
                    const statuses = Object.entries(node.statusDist);
                    const total = statuses.reduce((s, [, c]) => s + c, 0);
                    const barW = cardW - 24;
                    const barY = node.y + cardH/2 - 16;
                    let offset = 0;
                    return statuses.map(([status, count], si) => {
                      const w = (count / total) * barW;
                      const x = node.x - cardW/2 + 12 + offset;
                      offset += w;
                      return (
                        <rect key={si} x={x} y={barY} width={Math.max(3, w)} height={6} rx={3}
                          fill={STATUS_COLORS[status] || '#90A4AE'} />
                      );
                    });
                  })()}
                </g>
              )}
              {/* Expand indicator for sub-nodes */}
              {node.hasSubNodes && (
                <>
                  <circle cx={node.x + cardW/2 - 6} cy={node.y + cardH/2 - 6} r={8}
                    fill={expandedBranches.has(node.id) ? node.color : '#E8E8E8'} stroke="white" strokeWidth={1} />
                  <text x={node.x + cardW/2 - 6} y={node.y + cardH/2 - 3}
                    textAnchor="middle" fontSize="11" fontWeight="900"
                    fill={expandedBranches.has(node.id) ? 'white' : '#666'}>
                    {expandedBranches.has(node.id) ? '\u25BC' : '\u25B6'}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* ═══ Sub-nodes (compact cards) ═══ */}
        {displayNodes.filter(n => n.type === 'sub').map(node => {
          const isHovered = hoveredNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const hasTasks = node.taskCount > 0;
          const cardW = 110, cardH = 42;

          return (
            <g key={node.id}
              onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect x={node.x - cardW/2} y={node.y - cardH/2} width={cardW} height={cardH} rx={10}
                fill={isSelected ? node.bg : 'white'} stroke={hasTasks ? node.color : '#DDD'}
                strokeWidth={isHovered || isSelected ? 2 : 1}
                filter="url(#ptf-shadow)" />
              {/* Color accent left */}
              <rect x={node.x - cardW/2} y={node.y - cardH/2 + 4} width={4} height={cardH - 8} rx={2}
                fill={node.color} />
              <text x={node.x + 2} y={node.y + 1} textAnchor="middle" fontSize="10" fontWeight="700" fill="#333">
                {node.label.length > 14 ? node.label.substring(0, 13) + '...' : node.label}
              </text>
              {hasTasks && (
                <>
                  <circle cx={node.x + cardW/2 - 4} cy={node.y - cardH/2 + 4} r={8}
                    fill={node.color} stroke="white" strokeWidth={1.5} />
                  <text x={node.x + cardW/2 - 4} y={node.y - cardH/2 + 8}
                    textAnchor="middle" fontSize="8" fontWeight="900" fill="white">
                    {node.taskCount}
                  </text>
                </>
              )}
              {node.sla_day && (
                <>
                  <rect x={node.x - cardW/2 + 8} y={node.y + cardH/2 - 18} width={30} height={13} rx={4}
                    fill="#FFF3E0" stroke="#FF9800" strokeWidth={0.5} />
                  <text x={node.x - cardW/2 + 23} y={node.y + cardH/2 - 9}
                    textAnchor="middle" fontSize="7" fontWeight="800" fill="#E65100">
                    SLA:{node.sla_day}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* ═══ Selected Node Detail Panel ═══ */}
      {selectedNode && selectedNode.tasks && selectedNode.tasks.length > 0 && (
        <div className="absolute top-4 left-4 w-80 bg-white rounded-2xl shadow-2xl border overflow-hidden z-20"
          style={{ borderColor: selectedNode.color, borderWidth: '2px' }}>
          <div className="px-4 py-3 text-white font-black text-sm flex items-center justify-between"
            style={{ background: `linear-gradient(135deg, ${selectedNode.color}, ${selectedNode.dark || selectedNode.color})` }}>
            <span>{selectedNode.label}</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs">{selectedNode.tasks.length} משימות</span>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {selectedNode.tasks.map(task => (
              <div key={task.id} className="px-4 py-2.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white"
                    style={{ backgroundColor: STATUS_COLORS[task.status] || '#90A4AE' }} />
                  <span className="text-xs font-bold text-gray-800 truncate flex-1">{task.title}</span>
                </div>
                <div className="flex items-center gap-3 mr-4 mt-1">
                  {task.client_name && (
                    <span className="text-[10px] text-gray-500">{task.client_name}</span>
                  )}
                  {task.due_date && (
                    <span className="text-[10px] text-orange-500 font-medium">{task.due_date}</span>
                  )}
                  {task.status && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                      style={{ backgroundColor: (STATUS_COLORS[task.status] || '#90A4AE') + '15', color: STATUS_COLORS[task.status] }}>
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border">
        <span className="text-[10px] font-bold text-gray-500">V4.3</span>
        {Object.entries(BRANCH_DNA).map(([id, dna]) => (
          <div key={id} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: `linear-gradient(135deg, ${dna.grad[0]}, ${dna.grad[1]})` }} />
            <span className="text-[9px] font-bold" style={{ color: dna.color }}>{id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
