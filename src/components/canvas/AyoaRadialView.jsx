/**
 * ── AyoaRadialView: Ayoa-style Radial Ring Mind Map ──
 * Concentric rings radiating from center.
 * Hierarchy: Center → Ring 1 (דיווחין) → Ring 2 (שירותים) → Ring 3 (ייצור) → Ring 4 (גודל)
 *
 * Visual: Like the Ayoa "Radial Maps" — colorful arc segments per category,
 * with tapered organic branches, cloud/bubble shapes, focus blur.
 *
 * SVG uses ABSOLUTE coordinates only (viewBox 0 0 1000 1000).
 * NO percentages in SVG path d attributes.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { getServiceWeight } from '@/config/serviceWeights';
import { LOAD_COLORS } from '@/engines/capacityEngine';
import { buildTaperedBranch } from './AyoaNode';
import FloatingToolbar from './FloatingToolbar';

const VB = 1000;
const CX = VB / 2, CY = VB / 2;

// Ring radii — concentric hierarchy
const RINGS = {
  center: 55,
  ring1: 155,   // דיווחין / Reports
  ring2: 275,   // שירותים / Services
  ring3: 390,   // ייצור / Production status
};

// DNA Palette
const DNA = {
  P1: '#00A3E0', // Sky Blue
  P2: '#B2AC88', // Sage Green
  P3: '#E91E63', // Vibrant Magenta
  P4: '#FFC107', // Sunset Yellow
};

// Category → DNA color mapping
function getCategoryColor(category) {
  if (!category) return DNA.P3;
  const cat = (category || '').toLowerCase();
  if (cat.includes('שכר') || cat.includes('payroll') || cat.includes('ניכויים') || cat.includes('ביטוח') || cat.includes('מס"ב')) return DNA.P1;
  if (cat.includes('מע"מ') || cat.includes('vat') || cat.includes('הנה"ח') || cat.includes('bookkeeping') || cat.includes('מקדמות') || cat.includes('התאמות') || cat.includes('מאזנ')) return DNA.P2;
  if (cat.includes('admin') || cat.includes('אדמיני') || cat.includes('ייעוץ') || cat.includes('פגישה') || cat.includes('שיווק')) return DNA.P3;
  return DNA.P4;
}

// Status → ring 3 glow
const STATUS_GLOW = {
  waiting_for_materials: '#FF8F00',
  not_started: '#546E7A',
  sent_for_review: '#9C27B0',
  needs_corrections: '#E65100',
  production_completed: '#2E7D32',
};

function shapeForLoad(load) {
  if (load >= 3) return 'cloud';
  if (load >= 2) return 'bubble';
  return 'bubble';
}

// ── Organic shape renderers (absolute coords, no %) ──
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

// ── Ring segment (filled arc wedge, absolute coords) ──
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

export default function AyoaRadialView({ tasks = [], centerLabel = 'מרכז', centerSub = '' }) {
  const svgRef = useRef(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState({});

  // ── Build hierarchical layout ──
  const { nodes, ringSegments } = useMemo(() => {
    // Group tasks by category
    const catMap = {};
    tasks.forEach(task => {
      const cat = task.category || 'כללי';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(task);
    });

    const catEntries = Object.entries(catMap);
    const catCount = catEntries.length || 1;
    const angleStep = (2 * Math.PI) / catCount;
    const gap = 0.04; // gap between segments

    const allNodes = [];
    const segments = [];

    catEntries.forEach(([cat, catTasks], ci) => {
      const startAngle = -Math.PI / 2 + ci * angleStep + gap / 2;
      const endAngle = startAngle + angleStep - gap;
      const midAngle = (startAngle + endAngle) / 2;
      const dnaColor = getCategoryColor(cat);

      // Ring 1: Category arc segment (דיווחין level)
      segments.push({
        key: `ring1-${ci}`,
        d: describeWedge(CX, CY, RINGS.center + 10, RINGS.ring1, startAngle, endAngle),
        fill: dnaColor + '12',
        stroke: dnaColor + '25',
      });

      // Ring 1 label node
      const r1x = CX + Math.cos(midAngle) * (RINGS.center + 40);
      const r1y = CY + Math.sin(midAngle) * (RINGS.center + 40);

      allNodes.push({
        id: `cat-${ci}`,
        type: 'category',
        x: r1x, y: r1y,
        r: 28,
        shape: 'bubble',
        color: dnaColor,
        bg: dnaColor + '18',
        label: cat.substring(0, 12),
        subLabel: `${catTasks.length}`,
        angle: midAngle,
      });

      // Ring 2: Service arc segment
      segments.push({
        key: `ring2-${ci}`,
        d: describeWedge(CX, CY, RINGS.ring1 + 5, RINGS.ring2 + 20, startAngle, endAngle),
        fill: dnaColor + '06',
        stroke: dnaColor + '12',
      });

      // Ring 3: Production zone arc
      segments.push({
        key: `ring3-${ci}`,
        d: describeWedge(CX, CY, RINGS.ring2 + 25, RINGS.ring3 + 15, startAngle, endAngle),
        fill: dnaColor + '04',
        stroke: dnaColor + '08',
      });

      // Individual task nodes spread across rings 2-3
      const taskCount = Math.min(catTasks.length, 8);
      catTasks.slice(0, taskCount).forEach((task, ti) => {
        const sw = getServiceWeight(task.category);
        const load = typeof task.cognitive_load === 'number' ? task.cognitive_load : sw.cognitiveLoad;
        const lc = LOAD_COLORS[Math.min(3, Math.max(0, load))] || LOAD_COLORS[0];

        // Distribute tasks within the category's angular segment
        const taskAngle = taskCount > 1
          ? startAngle + ((endAngle - startAngle) * ti) / (taskCount - 1)
          : midAngle;

        const status = task.status || 'not_started';
        const isCompleted = status === 'production_completed';
        const taskRing = isCompleted ? RINGS.ring3 : RINGS.ring2 + (ti % 2) * 35;

        const r = load >= 3 ? 30 : load >= 2 ? 25 : load >= 1 ? 22 : 18;
        const ov = overrides[task.id] || {};

        allNodes.push({
          id: task.id,
          type: 'task',
          x: CX + Math.cos(taskAngle) * taskRing,
          y: CY + Math.sin(taskAngle) * taskRing,
          r,
          shape: ov.shape || shapeForLoad(load),
          color: ov.color || lc.color,
          bg: (ov.color || lc.color) + '15',
          label: task.title || '',
          subLabel: task.client_name || '',
          load,
          duration: sw.duration,
          loadLabel: lc.label,
          angle: taskAngle,
          parentAngle: midAngle,
          parentColor: dnaColor,
          statusGlow: STATUS_GLOW[status] || '#546E7A',
        });
      });
    });

    return { nodes: allNodes, ringSegments: segments };
  }, [tasks, overrides]);

  const handleNodeClick = useCallback((e, nodeId) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const scaleX = rect.width / VB;
    const scaleY = rect.height / VB;
    const screenX = rect.left + node.x * scaleX;
    const screenY = rect.top + node.y * scaleY;

    if (selectedNode === nodeId) {
      setSelectedNode(null);
    } else {
      setSelectedNode(nodeId);
      setToolbarPos({ x: screenX, y: screenY });
    }
    setFocusedNode(prev => prev === nodeId ? null : nodeId);
  }, [nodes, selectedNode]);

  const handleColorChange = useCallback((color) => {
    if (!selectedNode) return;
    setOverrides(prev => ({
      ...prev,
      [selectedNode]: { ...prev[selectedNode], color }
    }));
  }, [selectedNode]);

  const handleShapeChange = useCallback((shape) => {
    if (!selectedNode) return;
    setOverrides(prev => ({
      ...prev,
      [selectedNode]: { ...prev[selectedNode], shape }
    }));
  }, [selectedNode]);

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
        onClick={() => { setSelectedNode(null); }}
      >
        <defs>
          <filter id="radial-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#E91E63" floodOpacity="0.2" />
          </filter>
          <filter id="radial-blur">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
          </filter>
          {/* Center gradient — warm Ayoa orange */}
          <radialGradient id="center-grad-radial">
            <stop offset="0%" stopColor="#FFC107" />
            <stop offset="70%" stopColor="#FF9800" />
            <stop offset="100%" stopColor="#E65100" />
          </radialGradient>
        </defs>

        {/* ── Concentric ring guides (subtle) ── */}
        {[RINGS.ring1, RINGS.ring2, RINGS.ring3].map((r, i) => (
          <circle key={`guide-${i}`} cx={CX} cy={CY} r={r}
            fill="none" stroke="#E0E0E0" strokeWidth={0.5} strokeDasharray="4 6" opacity={0.4} />
        ))}

        {/* ── Ring segments (colorful wedges like Ayoa radial) ── */}
        {ringSegments.map(seg => (
          <path key={seg.key} d={seg.d} fill={seg.fill} stroke={seg.stroke} strokeWidth={0.8} />
        ))}

        {/* ── Tapered branches from center to category nodes ── */}
        {nodes.filter(n => n.type === 'category').map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <path
              key={`branch-cat-${node.id}`}
              d={buildTaperedBranch(CX, CY, node.x, node.y, 7, 2.5)}
              fill={node.color}
              opacity={isBlurred ? 0.06 : 0.5}
              style={{ transition: 'opacity 0.4s ease' }}
            />
          );
        })}

        {/* ── Tapered branches from categories to task nodes ── */}
        {nodes.filter(n => n.type === 'task').map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          const parentCat = nodes.find(n2 => n2.type === 'category' && Math.abs(n2.angle - node.parentAngle) < 0.01);
          const px = parentCat ? parentCat.x : CX;
          const py = parentCat ? parentCat.y : CY;
          return (
            <path
              key={`branch-task-${node.id}`}
              d={buildTaperedBranch(px, py, node.x, node.y, 4, 1)}
              fill={node.parentColor || node.color}
              opacity={isBlurred ? 0.04 : 0.35}
              style={{ transition: 'opacity 0.4s ease' }}
            />
          );
        })}

        {/* ── Center hub (Ayoa-style warm gradient) ── */}
        <circle cx={CX} cy={CY} r={RINGS.center + 3} fill="none" stroke="#FFC10730" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={RINGS.center} fill="url(#center-grad-radial)" filter="url(#radial-glow)" />
        <text x={CX} y={CY - 10} textAnchor="middle" fill="white" fontSize="17" fontWeight="bold">
          {centerLabel}
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="12">
          {centerSub || `${tasks.length} משימות`}
        </text>

        {/* ── Ring labels (hierarchy names) ── */}
        <text x={CX + RINGS.ring1 + 8} y={CY - 6} fontSize="8" fill="#9E9E9E" fontWeight="500">דיווחין</text>
        <text x={CX + RINGS.ring2 + 8} y={CY - 6} fontSize="8" fill="#BDBDBD" fontWeight="500">שירותים</text>
        <text x={CX + RINGS.ring3 + 8} y={CY - 6} fontSize="7" fill="#E0E0E0" fontWeight="500">ייצור</text>

        {/* ── Category nodes (Ring 1) ── */}
        {nodes.filter(n => n.type === 'category').map(node => {
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
                filter: isBlurred ? 'url(#radial-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}
            >
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 7}
                  fill="none" stroke={node.color} strokeWidth={1.5}
                  strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="10s" repeatCount="indefinite" />
                </circle>
              )}
              {renderShape('bubble', node.x, node.y, node.r + 2, 'none', node.color + '20')}
              {renderShape('bubble', node.x, node.y, node.r, node.bg, node.color, 2)}
              {renderShape('bubble', node.x, node.y, node.r - 2, 'white', 'none', 0)}
              <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#263238"
                style={{ pointerEvents: 'none' }}>
                {node.label}
              </text>
              <text x={node.x} y={node.y + 10} textAnchor="middle" fontSize="9" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.subLabel} משימות
              </text>
            </g>
          );
        })}

        {/* ── Task nodes (Ring 2-3) ── */}
        {nodes.filter(n => n.type === 'task').map(node => {
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
                filter: isBlurred ? 'url(#radial-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
                transform: isFocused ? 'scale(1.08)' : 'scale(1)',
                transformOrigin: `${node.x}px ${node.y}px`,
              }}
            >
              {/* Status glow ring */}
              <circle cx={node.x} cy={node.y} r={node.r + 4}
                fill="none" stroke={node.statusGlow || '#546E7A'} strokeWidth={1.2} opacity={0.3} />

              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke={node.color} strokeWidth={1.5}
                  strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Shape with shadow */}
              <g filter="url(#node-shadow)">
                {renderShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2)}
                {renderShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              {/* Labels */}
              <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="9" fontWeight="600" fill="#263238"
                style={{ pointerEvents: 'none' }}>
                {node.label.substring(0, 14)}
              </text>
              <text x={node.x} y={node.y + 7} textAnchor="middle" fontSize="8" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.loadLabel} • {node.duration}דק׳
              </text>
              {node.subLabel && (
                <text x={node.x} y={node.y + 18} textAnchor="middle" fontSize="7" fill="#90A4AE"
                  style={{ pointerEvents: 'none' }}>
                  {node.subLabel.substring(0, 12)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Focus Blur clear */}
      {focusedNode !== null && (
        <button
          onClick={() => setFocusedNode(null)}
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-lg border text-xs font-medium hover:bg-gray-50 transition-all"
          style={{ color: '#E91E63' }}
        >
          ✕ נקה מיקוד
        </button>
      )}

      {/* DNA Legend */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm border border-gray-100">
        {[
          { label: 'P1 שכר', color: DNA.P1 },
          { label: 'P2 הנה"ח', color: DNA.P2 },
          { label: 'P3 ביצוע', color: DNA.P3 },
          { label: 'P4 בית', color: DNA.P4 },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[9px] font-medium" style={{ color: item.color }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Floating Design Toolbar */}
      <FloatingToolbar
        visible={!!selectedNode && !!selectedNodeData && selectedNodeData.type === 'task'}
        x={toolbarPos.x}
        y={toolbarPos.y}
        nodeColor={selectedNodeData?.color}
        nodeShape={selectedNodeData?.shape}
        onColorChange={handleColorChange}
        onShapeChange={handleShapeChange}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
