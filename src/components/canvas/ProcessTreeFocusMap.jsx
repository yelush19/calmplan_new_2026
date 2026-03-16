/**
 * ProcessTreeFocusMap — Process Tree as Focus Map (V4.3)
 *
 * Adapts the SettingsMindMap architect layout for FOCUS pages:
 *   - Radial layout with process tree branches (P1-P5)
 *   - Each node shows: label, task count, client names, step progress
 *   - Structured cards (not just circles) with status indicators
 *   - Click nodes to see/link to client tasks
 *   - Tapered bezier connections like the architect map
 *
 * Data flow:
 *   companyTree (DB) → radial layout → overlay tasks per node
 *   tasks matched by: tree_node_id, service_key, or category
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadCompanyTree } from '@/services/processTreeService';
import { flattenTree, PROCESS_TREE_SEED } from '@/config/companyProcessTree';
import { resolveCategoryLabel } from '@/utils/categoryLabels';

const VB_W = 1400, VB_H = 900;
const CX = VB_W / 2, CY = VB_H / 2;

// Branch angles (radial, like SettingsMindMap)
const BRANCH_ANGLES = {
  P1: -Math.PI * 0.7,
  P2: -Math.PI * 0.2,
  P3:  Math.PI * 0.15,
  P4:  Math.PI * 0.6,
  P5:  Math.PI * 0.95,
};

// Branch colors
const BRANCH_DNA = {
  P1: { color: '#0288D1', label: 'חשבות שכר', bg: '#E1F5FE' },
  P2: { color: '#7B1FA2', label: 'הנה"ח ומיסים', bg: '#F3E5F5' },
  P3: { color: '#D81B60', label: 'ניהול', bg: '#FCE4EC' },
  P4: { color: '#F9A825', label: 'בית ואישי', bg: '#FFF8E1' },
  P5: { color: '#2E7D32', label: 'דוחות שנתיים', bg: '#E8F5E9' },
};

// Status colors for task badges
const STATUS_COLORS = {
  not_started: '#1565C0',
  in_progress: '#F57C00',
  waiting_for_materials: '#FF8F00',
  sent_for_review: '#7B1FA2',
  needs_corrections: '#E65100',
  production_completed: '#2E7D32',
  completed: '#1B5E20',
};

// Tapered bezier path (from SettingsMindMap)
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

// Wrap text to multiple lines
function wrapText(text, maxChars = 12) {
  if (!text || text.length <= maxChars) return [text || ''];
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

// Match task to tree node
function matchTaskToNode(task, nodeMap) {
  // 1. Direct tree_node_id match
  if (task.tree_node_id && nodeMap[task.tree_node_id]) return task.tree_node_id;
  // 2. service_key match
  if (task.service_key) {
    for (const [nodeId, node] of Object.entries(nodeMap)) {
      if (node.service_key === task.service_key) return nodeId;
    }
  }
  // 3. Category → label match
  const cat = resolveCategoryLabel(task.category || '').toLowerCase();
  for (const [nodeId, node] of Object.entries(nodeMap)) {
    const nodeLabel = (node.label || '').toLowerCase();
    if (cat && nodeLabel && (cat.includes(nodeLabel) || nodeLabel.includes(cat))) return nodeId;
  }
  // 4. Known category mappings
  const catMap = {
    'שכר': 'P1_payroll', 'payroll': 'P1_payroll',
    'מע"מ': 'P2_vat', 'vat': 'P2_vat',
    'מקדמות': 'P2_tax_advances', 'tax_advances': 'P2_tax_advances',
    'ביטוח לאומי': 'P1_social_security', 'social_security': 'P1_social_security',
    'ניכויים': 'P1_deductions', 'deductions': 'P1_deductions',
    'התאמות': 'P2_reconciliation', 'reconciliation': 'P2_reconciliation',
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

  // Build node map from tree
  const nodeMap = useMemo(() => {
    if (!companyTree) return {};
    const flat = flattenTree(companyTree);
    const map = {};
    for (const n of flat) map[n.id] = n;
    return map;
  }, [companyTree]);

  // Match tasks to tree nodes
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

  // Build layout nodes with positions
  const { displayNodes, displayEdges } = useMemo(() => {
    if (!companyTree?.branches) return { displayNodes: [], displayEdges: [] };

    const nodes = [];
    const edges = [];

    // Center hub
    nodes.push({
      id: 'hub', type: 'hub',
      x: CX, y: CY, r: 50,
      label: centerLabel,
      color: '#1E3A5F',
    });

    const branchEntries = Object.entries(companyTree.branches).filter(([id]) => id !== 'P4');
    const branchCount = branchEntries.length;

    branchEntries.forEach(([branchId, branch], bi) => {
      const dna = BRANCH_DNA[branchId] || { color: '#607D8B', label: branchId, bg: '#ECEFF1' };
      const angle = BRANCH_ANGLES[branchId] ?? (-Math.PI / 2 + bi * (2 * Math.PI / branchCount));
      const branchDist = 200;
      const bx = CX + Math.cos(angle) * branchDist;
      const by = CY + Math.sin(angle) * branchDist;

      // Count tasks in this branch (including children)
      const branchChildren = branch.children || [];
      const allBranchNodeIds = flattenTree({ branches: { [branchId]: branch } }).map(n => n.id);
      const branchTaskCount = allBranchNodeIds.reduce((sum, nid) => sum + (tasksByNode[nid]?.length || 0), 0);

      // Unique clients in this branch
      const branchClients = new Set();
      allBranchNodeIds.forEach(nid => {
        (tasksByNode[nid] || []).forEach(t => { if (t.client_name) branchClients.add(t.client_name); });
      });

      nodes.push({
        id: branchId, type: 'branch',
        x: bx, y: by, r: 40,
        label: dna.label,
        branchId, color: dna.color, bg: dna.bg,
        taskCount: branchTaskCount,
        clientCount: branchClients.size,
        angle,
      });

      edges.push({ from: { x: CX, y: CY }, to: { x: bx, y: by }, color: dna.color, w1: 7, w2: 3 });

      // Child nodes (services) — radial around branch
      if (expandedBranches.has(branchId)) {
        const childDist = 160;
        const childCount = branchChildren.length;
        const spread = Math.min(Math.PI * 0.8, Math.PI * 0.15 + childCount * Math.PI * 0.12);

        branchChildren.forEach((child, ci) => {
          let childAngle;
          if (childCount === 1) {
            childAngle = angle;
          } else {
            const start = angle - spread / 2;
            childAngle = start + (spread * ci) / Math.max(1, childCount - 1);
          }
          const cx_ = bx + Math.cos(childAngle) * childDist;
          const cy_ = by + Math.sin(childAngle) * childDist;

          const nodeTasks = tasksByNode[child.id] || [];
          const steps = child.steps || [];
          const hasSubNodes = child.children && child.children.length > 0;

          // Count tasks from sub-nodes too
          let subTaskCount = nodeTasks.length;
          if (hasSubNodes) {
            const subFlat = [];
            const walkChildren = (ch) => { for (const c of ch) { subFlat.push(c); if (c.children) walkChildren(c.children); } };
            walkChildren(child.children);
            subFlat.forEach(sn => { subTaskCount += (tasksByNode[sn.id]?.length || 0); });
          }

          // Unique clients for this node
          const nodeClients = new Set();
          nodeTasks.forEach(t => { if (t.client_name) nodeClients.add(t.client_name); });

          // Step progress from tasks
          let doneSteps = 0, totalSteps = 0;
          nodeTasks.forEach(t => {
            if (t.process_steps) {
              const stepsObj = t.process_steps;
              Object.values(stepsObj).forEach(s => {
                totalSteps++;
                if (s.done) doneSteps++;
              });
            }
          });

          // Status distribution
          const statusDist = {};
          nodeTasks.forEach(t => {
            const s = t.status || 'not_started';
            statusDist[s] = (statusDist[s] || 0) + 1;
          });

          nodes.push({
            id: child.id, type: 'service',
            x: cx_, y: cy_, r: 32,
            label: child.label,
            branchId, color: dna.color, bg: dna.bg,
            taskCount: subTaskCount,
            clientCount: nodeClients.size,
            stepCount: steps.length,
            doneSteps, totalSteps,
            statusDist,
            sla_day: child.sla_day,
            angle: childAngle,
            tasks: nodeTasks,
          });

          edges.push({ from: { x: bx, y: by }, to: { x: cx_, y: cy_ }, color: dna.color, w1: 4, w2: 1.5 });

          // Sub-nodes (e.g., מתפעל/טמל under סוציאליות)
          if (hasSubNodes && expandedBranches.has(child.id)) {
            const subDist = 110;
            const subCount = child.children.length;
            const subSpread = Math.min(Math.PI * 0.5, Math.PI * 0.1 + subCount * Math.PI * 0.1);

            child.children.forEach((sub, si) => {
              const subAngle = subCount === 1 ? childAngle :
                childAngle - subSpread / 2 + (subSpread * si) / Math.max(1, subCount - 1);
              const sx = cx_ + Math.cos(subAngle) * subDist;
              const sy = cy_ + Math.sin(subAngle) * subDist;
              const subTasks = tasksByNode[sub.id] || [];

              nodes.push({
                id: sub.id, type: 'sub',
                x: sx, y: sy, r: 24,
                label: sub.label,
                branchId, color: dna.color, bg: dna.bg,
                taskCount: subTasks.length,
                stepCount: (sub.steps || []).length,
                sla_day: sub.sla_day,
                tasks: subTasks,
              });

              edges.push({ from: { x: cx_, y: cy_ }, to: { x: sx, y: sy }, color: dna.color, w1: 2.5, w2: 1 });
            });
          }
        });
      }
    });

    return { displayNodes: nodes, displayEdges: edges };
  }, [companyTree, tasksByNode, expandedBranches, centerLabel]);

  const toggleBranch = useCallback((branchId) => {
    setExpandedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  }, []);

  const selectedNode = displayNodes.find(n => n.id === selectedNodeId);
  const totalTasks = tasks.filter(t => t.status !== 'production_completed' && t.status !== 'completed').length;

  if (!companyTree) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[300px]">
        <div className="text-center">
          <div className="text-3xl mb-2">🎯</div>
          <div className="text-sm font-bold text-gray-500">טוען מפת תהליכים...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ backgroundColor: '#FAFBFC' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
        onClick={() => setSelectedNodeId(null)}
      >
        <defs>
          <filter id="ptf-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.1" />
          </filter>
          <filter id="ptf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#FFC107" floodOpacity="0.3" />
          </filter>
          <filter id="ptf-select" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#E91E63" floodOpacity="0.4" />
          </filter>
          <radialGradient id="ptf-center-grad">
            <stop offset="0%" stopColor="#1E3A5F" />
            <stop offset="70%" stopColor="#0D2137" />
            <stop offset="100%" stopColor="#0A1929" />
          </radialGradient>
        </defs>

        {/* Tapered connections */}
        {displayEdges.map((edge, i) => (
          <path key={`edge-${i}`}
            d={taperedPath(edge.from.x, edge.from.y, edge.to.x, edge.to.y, edge.w1, edge.w2)}
            fill={edge.color}
            opacity={0.25}
          />
        ))}

        {/* ── Center Hub ── */}
        <circle cx={CX} cy={CY} r={55} fill="none" stroke="#FFC10730" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={50} fill="url(#ptf-center-grad)" filter="url(#ptf-glow)" />
        <text x={CX} y={CY - 12} textAnchor="middle" fill="white" fontSize="16" fontWeight="900">{centerLabel}</text>
        <text x={CX} y={CY + 6} textAnchor="middle" fill="#FFC107" fontSize="13" fontWeight="700">{totalTasks} משימות</text>
        <text x={CX} y={CY + 22} textAnchor="middle" fill="white" fontSize="10" fontWeight="600" opacity="0.6">
          {Object.keys(BRANCH_DNA).filter(b => b !== 'P4').length} ענפים
        </text>

        {/* ── Branch Nodes ── */}
        {displayNodes.filter(n => n.type === 'branch').map(node => {
          const isHovered = hoveredNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const isExpanded = expandedBranches.has(node.id);
          return (
            <g key={node.id}
              onClick={(e) => { e.stopPropagation(); toggleBranch(node.id); setSelectedNodeId(node.id); }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: 'pointer' }}
            >
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke={node.color} strokeWidth={2} opacity={0.5} strokeDasharray="5 3">
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="12s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Card background */}
              <rect x={node.x - 70} y={node.y - 30} width={140} height={60} rx={12}
                fill="white" stroke={node.color} strokeWidth={isHovered ? 3 : 2}
                filter="url(#ptf-shadow)"
                style={{ transition: 'stroke-width 0.2s' }}
              />
              {/* Color accent bar */}
              <rect x={node.x - 70} y={node.y - 30} width={140} height={8} rx={4}
                fill={node.color} />
              {/* Branch label */}
              <text x={node.x} y={node.y - 6} textAnchor="middle" fontSize="13" fontWeight="900" fill={node.color}>
                {node.branchId} {node.label}
              </text>
              {/* Task count + client count */}
              <text x={node.x} y={node.y + 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#555">
                {node.taskCount} משימות · {node.clientCount} לקוחות
              </text>
              {/* Expand indicator */}
              <circle cx={node.x + 62} cy={node.y - 22} r={9}
                fill={isExpanded ? node.color : 'white'} stroke={node.color} strokeWidth={1.5} />
              <text x={node.x + 62} y={node.y - 18} textAnchor="middle" fontSize="12" fontWeight="900"
                fill={isExpanded ? 'white' : node.color}>
                {isExpanded ? '−' : '+'}
              </text>
            </g>
          );
        })}

        {/* ── Service Nodes (structured cards) ── */}
        {displayNodes.filter(n => n.type === 'service').map(node => {
          const isHovered = hoveredNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const hasTasks = node.taskCount > 0;
          const hasSubNodes = companyTree?.branches?.[node.branchId]?.children?.find(c => c.id === node.id)?.children?.length > 0;
          const lines = wrapText(node.label, 14);
          const cardW = 130, cardH = hasTasks ? 72 : 52;

          return (
            <g key={node.id}
              onClick={(e) => {
                e.stopPropagation();
                if (hasSubNodes) toggleBranch(node.id);
                setSelectedNodeId(node.id);
              }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: 'pointer', opacity: isHovered ? 1 : 0.95 }}
            >
              {isSelected && (
                <rect x={node.x - cardW/2 - 4} y={node.y - cardH/2 - 4} width={cardW + 8} height={cardH + 8} rx={14}
                  fill="none" stroke={node.color} strokeWidth={2} opacity={0.5} strokeDasharray="5 3" />
              )}
              {/* Card body */}
              <rect x={node.x - cardW/2} y={node.y - cardH/2} width={cardW} height={cardH} rx={10}
                fill="white" stroke={hasTasks ? node.color : '#E0E0E0'} strokeWidth={isHovered ? 2.5 : 1.5}
                filter="url(#ptf-shadow)"
              />
              {/* Color left border accent */}
              <rect x={node.x - cardW/2} y={node.y - cardH/2 + 4} width={4} height={cardH - 8} rx={2}
                fill={node.color} />
              {/* Label */}
              {lines.map((line, li) => (
                <text key={li} x={node.x + 4} y={node.y - cardH/2 + 18 + li * 14}
                  textAnchor="middle" fontSize="11" fontWeight="800" fill="#1E293B">
                  {line}
                </text>
              ))}
              {/* Task count badge */}
              {hasTasks && (
                <>
                  <circle cx={node.x + cardW/2 - 12} cy={node.y - cardH/2 + 12} r={10}
                    fill={node.color} />
                  <text x={node.x + cardW/2 - 12} y={node.y - cardH/2 + 16}
                    textAnchor="middle" fontSize="9" fontWeight="900" fill="white">
                    {node.taskCount}
                  </text>
                </>
              )}
              {/* Status mini-bar */}
              {hasTasks && node.statusDist && (
                <g>
                  {(() => {
                    const statuses = Object.entries(node.statusDist);
                    const total = statuses.reduce((s, [, c]) => s + c, 0);
                    const barW = cardW - 20;
                    const barY = node.y + cardH/2 - 14;
                    let offset = 0;
                    return statuses.map(([status, count], si) => {
                      const w = (count / total) * barW;
                      const x = node.x - cardW/2 + 10 + offset;
                      offset += w;
                      return (
                        <rect key={si} x={x} y={barY} width={Math.max(2, w)} height={5} rx={2.5}
                          fill={STATUS_COLORS[status] || '#90A4AE'} />
                      );
                    });
                  })()}
                </g>
              )}
              {/* SLA badge */}
              {node.sla_day && (
                <g>
                  <rect x={node.x - cardW/2 + 6} y={node.y + cardH/2 - 24} width={28} height={14} rx={4}
                    fill="#FFF3E0" stroke="#FF9800" strokeWidth={0.5} />
                  <text x={node.x - cardW/2 + 20} y={node.y + cardH/2 - 14}
                    textAnchor="middle" fontSize="8" fontWeight="800" fill="#E65100">
                    {node.sla_day}
                  </text>
                </g>
              )}
              {/* Step count */}
              {node.stepCount > 0 && (
                <text x={node.x + 4} y={node.y + (hasTasks ? 6 : 10)}
                  textAnchor="middle" fontSize="9" fontWeight="600" fill="#90A4AE">
                  {node.stepCount} שלבים
                  {node.totalSteps > 0 ? ` · ${node.doneSteps}/${node.totalSteps} בוצעו` : ''}
                </text>
              )}
              {/* Expand indicator for sub-nodes */}
              {hasSubNodes && (
                <g>
                  <circle cx={node.x + cardW/2 - 4} cy={node.y + cardH/2 - 4} r={7}
                    fill={expandedBranches.has(node.id) ? node.color : '#E0E0E0'} />
                  <text x={node.x + cardW/2 - 4} y={node.y + cardH/2 - 1}
                    textAnchor="middle" fontSize="10" fontWeight="900"
                    fill={expandedBranches.has(node.id) ? 'white' : '#666'}>
                    {expandedBranches.has(node.id) ? '−' : '+'}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Sub-nodes (smaller cards) ── */}
        {displayNodes.filter(n => n.type === 'sub').map(node => {
          const isHovered = hoveredNodeId === node.id;
          const hasTasks = node.taskCount > 0;
          const lines = wrapText(node.label, 12);
          const cardW = 100, cardH = 40;

          return (
            <g key={node.id}
              onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect x={node.x - cardW/2} y={node.y - cardH/2} width={cardW} height={cardH} rx={8}
                fill={hasTasks ? 'white' : '#F5F5F5'} stroke={hasTasks ? node.color : '#DDD'} strokeWidth={isHovered ? 2 : 1}
                filter="url(#ptf-shadow)" />
              <rect x={node.x - cardW/2} y={node.y - cardH/2 + 3} width={3} height={cardH - 6} rx={1.5}
                fill={node.color} />
              {lines.map((line, li) => (
                <text key={li} x={node.x + 4} y={node.y - 2 + li * 12}
                  textAnchor="middle" fontSize="10" fontWeight="700" fill="#333">
                  {line}
                </text>
              ))}
              {hasTasks && (
                <>
                  <circle cx={node.x + cardW/2 - 8} cy={node.y - cardH/2 + 8} r={7}
                    fill={node.color} />
                  <text x={node.x + cardW/2 - 8} y={node.y - cardH/2 + 11.5}
                    textAnchor="middle" fontSize="8" fontWeight="900" fill="white">
                    {node.taskCount}
                  </text>
                </>
              )}
              {node.sla_day && (
                <text x={node.x - cardW/2 + 14} y={node.y + cardH/2 - 6}
                  textAnchor="middle" fontSize="7" fontWeight="800" fill="#E65100">
                  SLA:{node.sla_day}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Selected Node Detail Panel ── */}
      {selectedNode && selectedNode.tasks && selectedNode.tasks.length > 0 && (
        <div className="absolute top-3 left-3 w-72 bg-white rounded-xl shadow-lg border-2 overflow-hidden z-20"
          style={{ borderColor: selectedNode.color }}>
          <div className="px-3 py-2 text-white font-black text-sm" style={{ backgroundColor: selectedNode.color }}>
            {selectedNode.label} — {selectedNode.tasks.length} משימות
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
            {selectedNode.tasks.map(task => (
              <div key={task.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[task.status] || '#90A4AE' }} />
                  <span className="text-xs font-bold text-gray-800 truncate">{task.title}</span>
                </div>
                {task.client_name && (
                  <div className="text-[10px] text-gray-500 mr-4 mt-0.5">{task.client_name}</div>
                )}
                {task.due_date && (
                  <div className="text-[10px] text-gray-400 mr-4">{task.due_date}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border">
        <div className="text-[10px] font-bold text-gray-600">מפת תהליכים · עץ V4.3</div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(BRANCH_DNA).filter(([id]) => id !== 'P4').map(([id, dna]) => (
            <div key={id} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dna.color }} />
              <span className="text-[9px] font-bold" style={{ color: dna.color }}>{id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
