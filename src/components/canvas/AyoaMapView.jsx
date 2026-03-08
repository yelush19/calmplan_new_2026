/**
 * ── AyoaMapView: Mind-map tree view ──
 * DATA-AGNOSTIC: Uses resolveItem() to extract fields from ANY data shape.
 * SVG absolute coordinates only. NO percentages.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { resolveItems } from './resolveItem';
import { buildTaperedBranch } from './AyoaNode';
import FloatingToolbar from './FloatingToolbar';

const VB_W = 1400, VB_H = 900;
const CX = VB_W / 2, CY = VB_H / 2;

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

export default function AyoaMapView({ tasks = [], centerLabel = 'מרכז', centerSub = '' }) {
  const svgRef = useRef(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState({});

  const resolved = useMemo(() => resolveItems(tasks), [tasks]);

  const { categoryNodes, taskNodes } = useMemo(() => {
    if (resolved.length === 0) return { categoryNodes: [], taskNodes: [] };

    const catMap = {};
    resolved.forEach(item => {
      const cat = item.category || 'כללי';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(item);
    });

    const catEntries = Object.entries(catMap);
    const catCount = catEntries.length || 1;
    const angleStep = (2 * Math.PI) / catCount;
    const catRadius = catCount <= 4 ? 280 : catCount <= 8 ? 320 : 360;
    const taskRadiusBase = catCount <= 4 ? 200 : 160;

    const catNodes = [];
    const tNodes = [];

    catEntries.forEach(([cat, catItems], ci) => {
      const angle = -Math.PI / 2 + ci * angleStep;
      const dnaColor = getCategoryColor(cat, ci);
      const cx = CX + Math.cos(angle) * catRadius;
      const cy = CY + Math.sin(angle) * catRadius;

      catNodes.push({ id: `cat-${ci}`, x: cx, y: cy, r: 36, shape: 'bubble', color: dnaColor, bg: dnaColor + '15', label: cat.substring(0, 14), subLabel: `${catItems.length} פריטים`, angle });

      const maxPerCat = catCount <= 3 ? 10 : catCount <= 6 ? 6 : 4;
      const tCount = Math.min(catItems.length, maxPerCat);
      const tAngleSpread = Math.min(Math.PI * 0.7, angleStep * 0.85);
      const tAngleStart = angle - tAngleSpread / 2;

      catItems.slice(0, tCount).forEach((item, ti) => {
        const tAngle = tCount > 1 ? tAngleStart + (tAngleSpread * ti) / (tCount - 1) : angle;
        const rVariation = (ti % 3) * 30;
        const tRadius = taskRadiusBase + rVariation;
        const load = item.cognitiveLoad;
        const r = load >= 3 ? 28 : load >= 2 ? 23 : load >= 1 ? 20 : 17;
        const ov = overrides[item.id] || {};
        const nodeColor = ov.color || dnaColor;

        tNodes.push({
          id: item.id,
          x: cx + Math.cos(tAngle) * tRadius + (Math.sin(ti * 1.3) * 20),
          y: cy + Math.sin(tAngle) * tRadius + (Math.cos(ti * 0.9) * 15),
          r, shape: ov.shape || (load >= 3 ? 'cloud' : 'bubble'),
          color: nodeColor, bg: nodeColor + '15',
          label: item.label || '', subLabel: item.sub || '',
          parentX: cx, parentY: cy, parentColor: dnaColor,
        });
      });
    });

    return { categoryNodes: catNodes, taskNodes: tNodes };
  }, [resolved, overrides]);

  const allNodes = [...categoryNodes, ...taskNodes];

  const handleNodeClick = useCallback((e, nodeId) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return;
    const scaleX = rect.width / VB_W;
    const scaleY = rect.height / VB_H;

    if (selectedNode === nodeId) {
      setSelectedNode(null);
    } else {
      setSelectedNode(nodeId);
      setToolbarPos({ x: rect.left + node.x * scaleX, y: rect.top + node.y * scaleY });
    }
    setFocusedNode(prev => prev === nodeId ? null : nodeId);
  }, [allNodes, selectedNode]);

  const selectedNodeData = allNodes.find(n => n.id === selectedNode);

  if (resolved.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" />
        </svg>
        <p className="text-sm font-medium mt-3">אין נתונים להצגה במפה</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)' }} onClick={() => setSelectedNode(null)}>
        <defs>
          <filter id="map-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#E91E63" floodOpacity="0.2" />
          </filter>
          <filter id="map-blur"><feGaussianBlur stdDeviation="4" /></filter>
          <filter id="map-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
          </filter>
          <radialGradient id="map-center-grad">
            <stop offset="0%" stopColor="#FFC107" /><stop offset="70%" stopColor="#FF9800" /><stop offset="100%" stopColor="#E65100" />
          </radialGradient>
        </defs>

        {/* Branches: center → categories */}
        {categoryNodes.map(node => (
          <path key={`br-${node.id}`} d={buildTaperedBranch(CX, CY, node.x, node.y, 8, 3)}
            fill={node.color} opacity={focusedNode !== null && focusedNode !== node.id ? 0.06 : 0.5}
            style={{ transition: 'opacity 0.4s ease' }} />
        ))}

        {/* Branches: categories → items */}
        {taskNodes.map(node => (
          <path key={`br-t-${node.id}`} d={buildTaperedBranch(node.parentX, node.parentY, node.x, node.y, 4, 1)}
            fill={node.parentColor || node.color} opacity={focusedNode !== null && focusedNode !== node.id ? 0.04 : 0.35}
            style={{ transition: 'opacity 0.4s ease' }} />
        ))}

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={50} fill="url(#map-center-grad)" filter="url(#map-glow)" />
        <text x={CX} y={CY - 8} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">{centerLabel}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="white" fontSize="12" fontWeight="600">{centerSub || `${resolved.length} פריטים`}</text>

        {/* Category nodes */}
        {categoryNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <g key={node.id} onClick={(e) => handleNodeClick(e, node.id)}
              style={{ cursor: 'pointer', transition: 'filter 0.4s, opacity 0.4s', filter: isBlurred ? 'url(#map-blur)' : 'none', opacity: isBlurred ? 0.25 : 1 }}>
              {selectedNode === node.id && (
                <circle cx={node.x} cy={node.y} r={node.r + 8} fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.6}>
                  <animateTransform attributeName="transform" type="rotate" from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`} dur="10s" repeatCount="indefinite" />
                </circle>
              )}
              <g filter="url(#map-node-shadow)">
                {renderShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2.5)}
                {renderShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="12" fontWeight="800" fill="#0F172A" style={{ pointerEvents: 'none' }}>{node.label}</text>
              <text x={node.x} y={node.y + 10} textAnchor="middle" fontSize="10" fontWeight="600" fill={node.color} style={{ pointerEvents: 'none' }}>{node.subLabel}</text>
            </g>
          );
        })}

        {/* Item nodes */}
        {taskNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <g key={node.id} onClick={(e) => handleNodeClick(e, node.id)}
              style={{ cursor: 'pointer', transition: 'filter 0.4s, opacity 0.4s', filter: isBlurred ? 'url(#map-blur)' : 'none', opacity: isBlurred ? 0.25 : 1 }}>
              {selectedNode === node.id && (
                <circle cx={node.x} cy={node.y} r={node.r + 7} fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate" from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`} dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              <g filter="url(#map-node-shadow)">
                {renderShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2)}
                {renderShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F172A" style={{ pointerEvents: 'none' }}>{(node.label || '').substring(0, 14)}</text>
              {node.subLabel && (
                <text x={node.x} y={node.y + 9} textAnchor="middle" fontSize="8" fontWeight="500" fill="#334155" style={{ pointerEvents: 'none' }}>{(node.subLabel || '').substring(0, 14)}</text>
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
        visible={!!selectedNode && !!selectedNodeData && !selectedNodeData?.id?.startsWith?.('cat-')}
        x={toolbarPos.x} y={toolbarPos.y}
        nodeColor={selectedNodeData?.color} nodeShape={selectedNodeData?.shape}
        onColorChange={(color) => selectedNode && setOverrides(prev => ({ ...prev, [selectedNode]: { ...prev[selectedNode], color } }))}
        onShapeChange={(shape) => selectedNode && setOverrides(prev => ({ ...prev, [selectedNode]: { ...prev[selectedNode], shape } }))}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
