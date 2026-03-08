/**
 * ── AyoaRadialView: Ayoa-style Radial Ring Mind Map ──
 * DATA-AGNOSTIC: Uses resolveItem() to extract fields from ANY data shape.
 * SVG uses ABSOLUTE coordinates only (viewBox 0 0 1000 1000).
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { resolveItems } from './resolveItem';
import { buildTaperedBranch } from './AyoaNode';
import FloatingToolbar from './FloatingToolbar';

const VB = 1000;
const CX = VB / 2, CY = VB / 2;

const RINGS = {
  center: 55,
  ring1: 170,
  ring2: 310,
  ring3: 440,
};

// DNA Palette
const DNA = { P1: '#00A3E0', P2: '#B2AC88', P3: '#E91E63', P4: '#FFC107' };
const PALETTE = [DNA.P1, DNA.P3, DNA.P2, DNA.P4, '#9C27B0', '#00BCD4', '#FF5722', '#4CAF50'];

function getCategoryColor(category, index) {
  if (!category) return PALETTE[index % PALETTE.length];
  const cat = (category || '').toLowerCase();
  if (cat.includes('שכר') || cat.includes('payroll') || cat.includes('ניכויים') || cat.includes('ביטוח')) return DNA.P1;
  if (cat.includes('מע"מ') || cat.includes('vat') || cat.includes('הנה"ח') || cat.includes('bookkeeping') || cat.includes('מקדמות') || cat.includes('התאמות') || cat.includes('מאזנ')) return DNA.P2;
  if (cat.includes('admin') || cat.includes('אדמיני') || cat.includes('ייעוץ') || cat.includes('פגישה') || cat.includes('שיווק')) return DNA.P3;
  return PALETTE[index % PALETTE.length];
}

function renderShape(shape, x, y, r, fill, stroke, sw = 2.5) {
  switch (shape) {
    case 'cloud': {
      const d = `M ${x - r * 0.55} ${y + r * 0.22} C ${x - r * 0.88} ${y + r * 0.22} ${x - r} ${y - r * 0.11} ${x - r * 0.77} ${y - r * 0.39} C ${x - r * 0.77} ${y - r * 0.72} ${x - r * 0.39} ${y - r * 0.88} ${x - r * 0.11} ${y - r * 0.66} C ${x + r * 0.06} ${y - r * 0.94} ${x + r * 0.5} ${y - r * 0.88} ${x + r * 0.61} ${y - r * 0.61} C ${x + r * 0.94} ${y - r * 0.55} ${x + r} ${y - r * 0.11} ${x + r * 0.77} ${y + r * 0.11} C ${x + r * 0.88} ${y + r * 0.39} ${x + r * 0.61} ${y + r * 0.55} ${x + r * 0.28} ${y + r * 0.5} C ${x + r * 0.11} ${y + r * 0.66} ${x - r * 0.28} ${y + r * 0.61} ${x - r * 0.55} ${y + r * 0.22} Z`;
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} />;
    }
    case 'bubble':
      return <ellipse cx={x} cy={y} rx={r} ry={r * 0.82} fill={fill} stroke={stroke} strokeWidth={sw} />;
    default:
      return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />;
  }
}

function describeWedge(cx, cy, innerR, outerR, startAngle, endAngle) {
  const innerStart = { x: cx + innerR * Math.cos(startAngle), y: cy + innerR * Math.sin(startAngle) };
  const innerEnd = { x: cx + innerR * Math.cos(endAngle), y: cy + innerR * Math.sin(endAngle) };
  const outerStart = { x: cx + outerR * Math.cos(startAngle), y: cy + outerR * Math.sin(startAngle) };
  const outerEnd = { x: cx + outerR * Math.cos(endAngle), y: cy + outerR * Math.sin(endAngle) };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${innerStart.x} ${innerStart.y}`, `L ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`, 'Z',
  ].join(' ');
}

export default function AyoaRadialView({ tasks = [], centerLabel = 'מרכז', centerSub = '' }) {
  const svgRef = useRef(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState({});

  // ── Resolve data-agnostically ──
  const resolved = useMemo(() => resolveItems(tasks), [tasks]);

  const { nodes, ringSegments } = useMemo(() => {
    if (resolved.length === 0) return { nodes: [], ringSegments: [] };

    // Group by category
    const catMap = {};
    resolved.forEach(item => {
      const cat = item.category || 'כללי';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(item);
    });

    const catEntries = Object.entries(catMap);
    const catCount = catEntries.length || 1;
    const angleStep = (2 * Math.PI) / catCount;
    const gap = 0.04;

    const allNodes = [];
    const segments = [];

    catEntries.forEach(([cat, catItems], ci) => {
      const startAngle = -Math.PI / 2 + ci * angleStep + gap / 2;
      const endAngle = startAngle + angleStep - gap;
      const midAngle = (startAngle + endAngle) / 2;
      const dnaColor = getCategoryColor(cat, ci);

      // Ring wedges
      segments.push({ key: `r1-${ci}`, d: describeWedge(CX, CY, RINGS.center + 10, RINGS.ring1, startAngle, endAngle), fill: dnaColor + '12', stroke: dnaColor + '25' });
      segments.push({ key: `r2-${ci}`, d: describeWedge(CX, CY, RINGS.ring1 + 5, RINGS.ring2 + 20, startAngle, endAngle), fill: dnaColor + '06', stroke: dnaColor + '12' });
      segments.push({ key: `r3-${ci}`, d: describeWedge(CX, CY, RINGS.ring2 + 25, RINGS.ring3 + 15, startAngle, endAngle), fill: dnaColor + '04', stroke: dnaColor + '08' });

      // Category label node
      const r1x = CX + Math.cos(midAngle) * (RINGS.center + 40);
      const r1y = CY + Math.sin(midAngle) * (RINGS.center + 40);
      allNodes.push({
        id: `cat-${ci}`, type: 'category',
        x: r1x, y: r1y, r: 28, shape: 'bubble',
        color: dnaColor, bg: dnaColor + '18',
        label: cat.substring(0, 12), subLabel: `${catItems.length}`,
        angle: midAngle,
      });

      // Item nodes
      const maxPerCat = catCount <= 3 ? 8 : catCount <= 6 ? 5 : 3;
      const itemCount = Math.min(catItems.length, maxPerCat);
      catItems.slice(0, itemCount).forEach((item, ti) => {
        const taskAngle = itemCount > 1
          ? startAngle + ((endAngle - startAngle) * ti) / (itemCount - 1)
          : midAngle;
        const isCompleted = item.status === 'production_completed' || item.status === 'completed' || item.status === 'ready';
        const taskRing = isCompleted ? RINGS.ring3 : RINGS.ring2 + (ti % 2) * 45;
        const load = item.cognitiveLoad;
        const r = load >= 3 ? 26 : load >= 2 ? 22 : load >= 1 ? 19 : 16;
        const ov = overrides[item.id] || {};
        const nodeColor = ov.color || dnaColor;

        allNodes.push({
          id: item.id, type: 'task',
          x: CX + Math.cos(taskAngle) * taskRing,
          y: CY + Math.sin(taskAngle) * taskRing,
          r, shape: ov.shape || (load >= 3 ? 'cloud' : 'bubble'),
          color: nodeColor, bg: nodeColor + '15',
          label: item.label || '', subLabel: item.sub || '',
          angle: taskAngle, parentAngle: midAngle, parentColor: dnaColor,
        });
      });
    });

    return { nodes: allNodes, ringSegments: segments };
  }, [resolved, overrides]);

  const handleNodeClick = useCallback((e, nodeId) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const scaleX = rect.width / VB;
    const scaleY = rect.height / VB;

    if (selectedNode === nodeId) {
      setSelectedNode(null);
    } else {
      setSelectedNode(nodeId);
      setToolbarPos({ x: rect.left + node.x * scaleX, y: rect.top + node.y * scaleY });
    }
    setFocusedNode(prev => prev === nodeId ? null : nodeId);
  }, [nodes, selectedNode]);

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  // Empty state
  if (resolved.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" />
        </svg>
        <p className="text-sm font-medium mt-3">אין נתונים להצגה במפה</p>
        <p className="text-xs text-slate-400 mt-1">הנתונים יופיעו כאן כשיהיו פריטים זמינים</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} viewBox={`0 0 ${VB} ${VB}`} className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
        onClick={() => setSelectedNode(null)}>
        <defs>
          <filter id="radial-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#E91E63" floodOpacity="0.2" />
          </filter>
          <filter id="radial-blur"><feGaussianBlur stdDeviation="4" /></filter>
          <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
          </filter>
          <radialGradient id="center-grad-radial">
            <stop offset="0%" stopColor="#FFC107" /><stop offset="70%" stopColor="#FF9800" /><stop offset="100%" stopColor="#E65100" />
          </radialGradient>
        </defs>

        {/* Ring guides */}
        {[RINGS.ring1, RINGS.ring2, RINGS.ring3].map((r, i) => (
          <circle key={`guide-${i}`} cx={CX} cy={CY} r={r} fill="none" stroke="#E0E0E0" strokeWidth={0.5} strokeDasharray="4 6" opacity={0.4} />
        ))}

        {/* Ring segments */}
        {ringSegments.map(seg => (
          <path key={seg.key} d={seg.d} fill={seg.fill} stroke={seg.stroke} strokeWidth={0.8} />
        ))}

        {/* Branches: center → categories */}
        {nodes.filter(n => n.type === 'category').map(node => (
          <path key={`br-${node.id}`} d={buildTaperedBranch(CX, CY, node.x, node.y, 7, 2.5)}
            fill={node.color} opacity={focusedNode !== null && focusedNode !== node.id ? 0.06 : 0.5}
            style={{ transition: 'opacity 0.4s ease' }} />
        ))}

        {/* Branches: categories → items */}
        {nodes.filter(n => n.type === 'task').map(node => {
          const parent = nodes.find(n2 => n2.type === 'category' && Math.abs(n2.angle - node.parentAngle) < 0.01);
          return (
            <path key={`br-t-${node.id}`} d={buildTaperedBranch(parent?.x || CX, parent?.y || CY, node.x, node.y, 4, 1)}
              fill={node.parentColor || node.color} opacity={focusedNode !== null && focusedNode !== node.id ? 0.04 : 0.35}
              style={{ transition: 'opacity 0.4s ease' }} />
          );
        })}

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={RINGS.center + 3} fill="none" stroke="#FFC10730" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={RINGS.center} fill="url(#center-grad-radial)" filter="url(#radial-glow)" />
        <text x={CX} y={CY - 10} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">{centerLabel}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="white" fontSize="13" fontWeight="600">{centerSub || `${resolved.length} פריטים`}</text>

        {/* Ring labels */}
        <text x={CX + RINGS.ring1 + 8} y={CY - 6} fontSize="9" fill="#64748B" fontWeight="600">קטגוריות</text>
        <text x={CX + RINGS.ring2 + 8} y={CY - 6} fontSize="9" fill="#64748B" fontWeight="600">פריטים</text>

        {/* Category nodes */}
        {nodes.filter(n => n.type === 'category').map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <g key={node.id} onClick={(e) => handleNodeClick(e, node.id)}
              style={{ cursor: 'pointer', transition: 'filter 0.4s, opacity 0.4s', filter: isBlurred ? 'url(#radial-blur)' : 'none', opacity: isBlurred ? 0.25 : 1 }}>
              {selectedNode === node.id && (
                <circle cx={node.x} cy={node.y} r={node.r + 7} fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate" from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`} dur="10s" repeatCount="indefinite" />
                </circle>
              )}
              {renderShape('bubble', node.x, node.y, node.r, node.bg, node.color, 2)}
              {renderShape('bubble', node.x, node.y, node.r - 2, 'white', 'none', 0)}
              <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0F172A" style={{ pointerEvents: 'none' }}>{node.label}</text>
              <text x={node.x} y={node.y + 10} textAnchor="middle" fontSize="10" fontWeight="600" fill={node.color} style={{ pointerEvents: 'none' }}>{node.subLabel} פריטים</text>
            </g>
          );
        })}

        {/* Item nodes */}
        {nodes.filter(n => n.type === 'task').map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <g key={node.id} onClick={(e) => handleNodeClick(e, node.id)}
              style={{ cursor: 'pointer', transition: 'filter 0.4s, opacity 0.4s', filter: isBlurred ? 'url(#radial-blur)' : 'none', opacity: isBlurred ? 0.25 : 1 }}>
              {selectedNode === node.id && (
                <circle cx={node.x} cy={node.y} r={node.r + 8} fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate" from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`} dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              <g filter="url(#node-shadow)">
                {renderShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2)}
                {renderShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F172A" style={{ pointerEvents: 'none' }}>{(node.label || '').substring(0, 14)}</text>
              {node.subLabel && (
                <text x={node.x} y={node.y + 8} textAnchor="middle" fontSize="8" fontWeight="500" fill="#334155" style={{ pointerEvents: 'none' }}>{(node.subLabel || '').substring(0, 14)}</text>
              )}
            </g>
          );
        })}
      </svg>

      {focusedNode !== null && (
        <button onClick={() => setFocusedNode(null)}
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-lg border text-xs font-bold hover:bg-gray-50" style={{ color: '#E91E63' }}>
          ✕ נקה מיקוד
        </button>
      )}

      <FloatingToolbar
        visible={!!selectedNode && !!selectedNodeData && selectedNodeData.type === 'task'}
        x={toolbarPos.x} y={toolbarPos.y}
        nodeColor={selectedNodeData?.color} nodeShape={selectedNodeData?.shape}
        onColorChange={(color) => selectedNode && setOverrides(prev => ({ ...prev, [selectedNode]: { ...prev[selectedNode], color } }))}
        onShapeChange={(shape) => selectedNode && setOverrides(prev => ({ ...prev, [selectedNode]: { ...prev[selectedNode], shape } }))}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
