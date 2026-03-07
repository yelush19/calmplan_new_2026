/**
 * ── AyoaMapView: Mind-map tree view with correct hierarchy ──
 * Center node with organic tree branching in all directions.
 * Hierarchy: Root → דיווחין (Reports) → שירותים (Services) → ייצור (Production) → גודל (Size)
 *
 * Tapered Cubic Bezier branches (thick at root, thin at tip).
 * Cloud/Bubble shapes, Focus Blur, FloatingToolbar.
 * SVG absolute coordinates only. NO percentages in d attributes.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { getServiceWeight } from '@/config/serviceWeights';
import { LOAD_COLORS } from '@/engines/capacityEngine';
import { buildTaperedBranch } from './AyoaNode';
import FloatingToolbar from './FloatingToolbar';

const VB_W = 1400, VB_H = 900;
const CX = VB_W / 2, CY = VB_H / 2;

// DNA Palette
const DNA = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

function getCategoryColor(category) {
  if (!category) return DNA.P3;
  const cat = (category || '').toLowerCase();
  if (cat.includes('שכר') || cat.includes('payroll') || cat.includes('ניכויים') || cat.includes('ביטוח') || cat.includes('מס"ב')) return DNA.P1;
  if (cat.includes('מע"מ') || cat.includes('vat') || cat.includes('הנה"ח') || cat.includes('bookkeeping') || cat.includes('מקדמות') || cat.includes('התאמות') || cat.includes('מאזנ')) return DNA.P2;
  if (cat.includes('admin') || cat.includes('אדמיני') || cat.includes('ייעוץ') || cat.includes('פגישה') || cat.includes('שיווק')) return DNA.P3;
  return DNA.P4;
}

function renderShape(shape, x, y, r, fill, stroke, sw = 2.5) {
  switch (shape) {
    case 'cloud': {
      const d = `M ${x - r * 0.55} ${y + r * 0.22} ` +
        `C ${x - r * 0.88} ${y + r * 0.22} ${x - r} ${y - r * 0.11} ${x - r * 0.77} ${y - r * 0.39} ` +
        `C ${x - r * 0.77} ${y - r * 0.72} ${x - r * 0.39} ${y - r * 0.88} ${x - r * 0.11} ${y - r * 0.66} ` +
        `C ${x + r * 0.06} ${y - r * 0.94} ${x + r * 0.5} ${y - r * 0.88} ${x + r * 0.61} ${y - r * 0.61} ` +
        `C ${x + r * 0.94} ${y - r * 0.55} ${x + r} ${y - r * 0.11} ${x + r * 0.77} ${y + r * 0.11} ` +
        `C ${x + r * 0.88} ${y + r * 0.39} ${x + r * 0.61} ${y + r * 0.55} ${x + r * 0.28} ${y + r * 0.5} ` +
        `C ${x + r * 0.11} ${y + r * 0.66} ${x - r * 0.28} ${y + r * 0.61} ${x - r * 0.55} ${y + r * 0.22} Z`;
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} />;
    }
    case 'diamond': {
      const pts = `${x},${y - r} ${x + r * 0.7},${y} ${x},${y + r} ${x - r * 0.7},${y}`;
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
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

  const { categoryNodes, taskNodes } = useMemo(() => {
    // Group tasks by category
    const catMap = {};
    tasks.forEach(task => {
      const cat = task.category || 'כללי';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(task);
    });

    const catEntries = Object.entries(catMap);
    const catCount = catEntries.length || 1;

    // Distribute categories radially around center
    const angleStep = (2 * Math.PI) / catCount;
    // Dynamic radius based on category count to prevent crowding
    const catRadius = catCount <= 4 ? 280 : catCount <= 8 ? 320 : 360;
    const taskRadiusBase = catCount <= 4 ? 200 : 160; // distance from category node

    const catNodes = [];
    const tNodes = [];

    catEntries.forEach(([cat, catTasks], ci) => {
      const angle = -Math.PI / 2 + ci * angleStep;
      const dnaColor = getCategoryColor(cat);
      const cx = CX + Math.cos(angle) * catRadius;
      const cy = CY + Math.sin(angle) * catRadius;

      catNodes.push({
        id: `cat-${ci}`,
        x: cx, y: cy,
        r: 36,
        shape: 'bubble',
        color: dnaColor,
        bg: dnaColor + '15',
        label: cat.substring(0, 14),
        subLabel: `${catTasks.length} משימות`,
        angle,
      });

      // Distribute tasks around this category node (cap to prevent crowding)
      const maxPerCat = catCount <= 3 ? 10 : catCount <= 6 ? 6 : 4;
      const tCount = Math.min(catTasks.length, maxPerCat);
      const tAngleSpread = Math.min(Math.PI * 0.7, angleStep * 0.85);
      const tAngleStart = angle - tAngleSpread / 2;

      catTasks.slice(0, tCount).forEach((task, ti) => {
        const sw = getServiceWeight(task.category);
        const load = typeof task.cognitive_load === 'number' ? task.cognitive_load : sw.cognitiveLoad;
        const lc = LOAD_COLORS[Math.min(3, Math.max(0, load))] || LOAD_COLORS[0];

        const tAngle = tCount > 1
          ? tAngleStart + (tAngleSpread * ti) / (tCount - 1)
          : angle;

        // Vary radius by status/load for depth
        const rVariation = (ti % 3) * 30;
        const tRadius = taskRadiusBase + rVariation;

        const baseShape = load >= 3 ? 'cloud' : load >= 2 ? 'bubble' : 'bubble';
        const r = load >= 3 ? 28 : load >= 2 ? 23 : load >= 1 ? 20 : 17;
        const ov = overrides[task.id] || {};

        tNodes.push({
          id: task.id,
          x: cx + Math.cos(tAngle) * tRadius + (Math.sin(ti * 1.3) * 20),
          y: cy + Math.sin(tAngle) * tRadius + (Math.cos(ti * 0.9) * 15),
          r,
          shape: ov.shape || baseShape,
          color: ov.color || lc.color,
          bg: (ov.color || lc.color) + '15',
          label: task.title || '',
          subLabel: task.client_name || '',
          load,
          loadLabel: lc.label,
          duration: sw.duration,
          parentX: cx,
          parentY: cy,
          parentColor: dnaColor,
        });
      });
    });

    return { categoryNodes: catNodes, taskNodes: tNodes };
  }, [tasks, overrides]);

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
    const screenX = rect.left + node.x * scaleX;
    const screenY = rect.top + node.y * scaleY;

    if (selectedNode === nodeId) {
      setSelectedNode(null);
    } else {
      setSelectedNode(nodeId);
      setToolbarPos({ x: screenX, y: screenY });
    }
    setFocusedNode(prev => prev === nodeId ? null : nodeId);
  }, [allNodes, selectedNode]);

  const selectedNodeData = allNodes.find(n => n.id === selectedNode);

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
        onClick={() => setSelectedNode(null)}>
        <defs>
          <filter id="map-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#E91E63" floodOpacity="0.2" />
          </filter>
          <filter id="map-blur">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="map-node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
          </filter>
          <radialGradient id="map-center-grad">
            <stop offset="0%" stopColor="#FFC107" />
            <stop offset="70%" stopColor="#FF9800" />
            <stop offset="100%" stopColor="#E65100" />
          </radialGradient>
        </defs>

        {/* ── Tapered branches: center → categories ── */}
        {categoryNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <path
              key={`branch-${node.id}`}
              d={buildTaperedBranch(CX, CY, node.x, node.y, 8, 3)}
              fill={node.color}
              opacity={isBlurred ? 0.06 : 0.5}
              style={{ transition: 'opacity 0.4s ease' }}
            />
          );
        })}

        {/* ── Tapered branches: categories → tasks ── */}
        {taskNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <path
              key={`branch-t-${node.id}`}
              d={buildTaperedBranch(node.parentX, node.parentY, node.x, node.y, 4, 1)}
              fill={node.parentColor || node.color}
              opacity={isBlurred ? 0.04 : 0.35}
              style={{ transition: 'opacity 0.4s ease' }}
            />
          );
        })}

        {/* ── Center hub ── */}
        <circle cx={CX} cy={CY} r={50} fill="url(#map-center-grad)" filter="url(#map-glow)" />
        <text x={CX} y={CY - 8} textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">{centerLabel}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="11">
          {centerSub || `${tasks.length} משימות`}
        </text>

        {/* ── Category nodes ── */}
        {categoryNodes.map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          return (
            <g
              key={node.id}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#map-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}
            >
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke={node.color} strokeWidth={1.5}
                  strokeDasharray="6 4" opacity={0.6}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="10s" repeatCount="indefinite" />
                </circle>
              )}
              <g filter="url(#map-node-shadow)">
                {renderShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2.5)}
                {renderShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#263238"
                style={{ pointerEvents: 'none' }}>
                {node.label}
              </text>
              <text x={node.x} y={node.y + 10} textAnchor="middle" fontSize="9" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.subLabel}
              </text>
            </g>
          );
        })}

        {/* ── Task nodes ── */}
        {taskNodes.map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          return (
            <g
              key={node.id}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#map-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}
            >
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 7}
                  fill="none" stroke={node.color} strokeWidth={1.5}
                  strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              <g filter="url(#map-node-shadow)">
                {renderShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2)}
                {renderShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill="#263238"
                style={{ pointerEvents: 'none' }}>
                {node.label.substring(0, 14)}
              </text>
              <text x={node.x} y={node.y + 8} textAnchor="middle" fontSize="8" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.loadLabel} • {node.duration}דק׳
              </text>
              {node.subLabel && (
                <text x={node.x} y={node.y + 20} textAnchor="middle" fontSize="7" fill="#90A4AE"
                  style={{ pointerEvents: 'none' }}>
                  {node.subLabel.substring(0, 12)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {focusedNode !== null && (
        <button
          onClick={() => setFocusedNode(null)}
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-lg border text-xs font-medium hover:bg-gray-50 transition-all"
          style={{ color: '#E91E63' }}
        >
          ✕ נקה מיקוד
        </button>
      )}

      <FloatingToolbar
        visible={!!selectedNode && !!selectedNodeData && !selectedNodeData.id?.startsWith?.('cat-')}
        x={toolbarPos.x}
        y={toolbarPos.y}
        nodeColor={selectedNodeData?.color}
        nodeShape={selectedNodeData?.shape}
        onColorChange={(color) => {
          if (!selectedNode) return;
          setOverrides(prev => ({ ...prev, [selectedNode]: { ...prev[selectedNode], color } }));
        }}
        onShapeChange={(shape) => {
          if (!selectedNode) return;
          setOverrides(prev => ({ ...prev, [selectedNode]: { ...prev[selectedNode], shape } }));
        }}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
