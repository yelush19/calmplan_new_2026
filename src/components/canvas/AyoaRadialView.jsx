/**
 * ── AyoaRadialView: 360° Circular Radial Layout (Directive #5, Lens 2) ──
 *
 * DIRECTIVE #7: Strict Hierarchy & Physics
 *   Root → דיווחין (Reports) → שירותים (Services) → ייצור (Production) → גודל (Size)
 *   Uses Sin/Cos math to position nodes PERFECTLY in concentric rings.
 *   Tapered cubic bezier curves (thick at root, thin at leaf).
 *   Absolute SVG coordinates only (NO percentages in paths).
 *   Nodes spread far apart so text is readable.
 *
 * DIRECTIVE #10: Typography & Lights
 *   No pale gray text. Semi-bold/Bold labels. High contrast.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { renderNodeShape, buildTaperedBranch, getDynamicCategoryColor } from './AyoaNode';
import FloatingToolbar from './FloatingToolbar';

const VB = 1000;
const CX = VB / 2, CY = VB / 2;

// Ring radii — concentric hierarchy, well-spaced
const RINGS = {
  center: 55,
  ring1: 180,   // דיווחין / Reports (category level)
  ring2: 320,   // שירותים / Services (task items)
  ring3: 440,   // ייצור / Production status (completed tasks)
};

// Use getDynamicCategoryColor from AyoaNode — respects service dashboard overrides
const getCategoryColor = getDynamicCategoryColor;

const STATUS_GLOW = {
  waiting_for_materials: '#FF8F00',
  not_started: '#546E7A',
  sent_for_review: '#9C27B0',
  needs_corrections: '#E65100',
  production_completed: '#2E7D32',
};

// ── Ring segment (filled arc wedge) ──
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

  const { nodes, ringSegments } = useMemo(() => {
    const catMap = {};
    tasks.forEach(task => {
      const cat = task.category || task.title || 'כללי';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(task);
    });

    const catEntries = Object.entries(catMap);
    const catCount = catEntries.length || 1;
    const angleStep = (2 * Math.PI) / catCount;
    const gap = 0.06;

    const allNodes = [];
    const segments = [];

    catEntries.forEach(([cat, catTasks], ci) => {
      const startAngle = -Math.PI / 2 + ci * angleStep + gap / 2;
      const endAngle = startAngle + angleStep - gap;
      const midAngle = (startAngle + endAngle) / 2;
      const dnaColor = getCategoryColor(cat);

      // Ring 1 wedge (דיווחין)
      segments.push({
        key: `ring1-${ci}`,
        d: describeWedge(CX, CY, RINGS.center + 12, RINGS.ring1, startAngle, endAngle),
        fill: dnaColor + '10',
        stroke: dnaColor + '20',
      });

      // Ring 2 wedge (שירותים)
      segments.push({
        key: `ring2-${ci}`,
        d: describeWedge(CX, CY, RINGS.ring1 + 5, RINGS.ring2 + 20, startAngle, endAngle),
        fill: dnaColor + '06',
        stroke: dnaColor + '10',
      });

      // Ring 3 wedge (ייצור)
      segments.push({
        key: `ring3-${ci}`,
        d: describeWedge(CX, CY, RINGS.ring2 + 25, RINGS.ring3 + 15, startAngle, endAngle),
        fill: dnaColor + '03',
        stroke: dnaColor + '06',
      });

      // Category node (Ring 1)
      const r1x = CX + Math.cos(midAngle) * (RINGS.center + 50);
      const r1y = CY + Math.sin(midAngle) * (RINGS.center + 50);

      allNodes.push({
        id: `cat-${ci}`,
        type: 'category',
        x: r1x, y: r1y,
        r: 30,
        shape: 'bubble',
        color: dnaColor,
        bg: dnaColor + '15',
        label: cat.substring(0, 14),
        subLabel: `${catTasks.length}`,
        angle: midAngle,
      });

      // Task nodes — spread across rings 2-3 using sin/cos
      const maxPerCat = catCount <= 3 ? 10 : catCount <= 6 ? 6 : 4;
      const taskCount = Math.min(catTasks.length, maxPerCat);
      catTasks.slice(0, taskCount).forEach((task, ti) => {
        const status = task.status || 'not_started';
        const isCompleted = status === 'production_completed';

        // Distribute within category angular segment
        const taskAngle = taskCount > 1
          ? startAngle + gap + ((endAngle - startAngle - gap * 2) * ti) / (taskCount - 1)
          : midAngle;

        const taskRing = isCompleted ? RINGS.ring3 : RINGS.ring2 + (ti % 3) * 35;
        const r = 20;
        const ov = overrides[task.id] || {};

        allNodes.push({
          id: task.id,
          type: 'task',
          x: CX + Math.cos(taskAngle) * taskRing,
          y: CY + Math.sin(taskAngle) * taskRing,
          r,
          shape: ov.shape || 'bubble',
          color: ov.color || dnaColor,
          bg: (ov.color || dnaColor) + '12',
          label: task.title || '',
          subLabel: task.client_name || '',
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
    setOverrides(prev => ({ ...prev, [selectedNode]: { ...prev[selectedNode], color } }));
  }, [selectedNode]);

  const handleShapeChange = useCallback((shape) => {
    if (!selectedNode) return;
    setOverrides(prev => ({ ...prev, [selectedNode]: { ...prev[selectedNode], shape } }));
  }, [selectedNode]);

  const handleApplyToChildren = useCallback(() => {
    if (!selectedNode) return;
    const parentNode = nodes.find(n => n.id === selectedNode);
    if (!parentNode || parentNode.type !== 'category') return;
    const parentOv = overrides[selectedNode] || {};
    const childNodes = nodes.filter(n => n.type === 'task' && Math.abs(n.parentAngle - parentNode.angle) < 0.01);
    setOverrides(prev => {
      const next = { ...prev };
      childNodes.forEach(child => {
        next[child.id] = { ...next[child.id], ...parentOv };
      });
      return next;
    });
  }, [selectedNode, nodes, overrides]);

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
        onClick={() => setSelectedNode(null)}
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
          <radialGradient id="center-grad-radial">
            <stop offset="0%" stopColor="#FFC107" />
            <stop offset="70%" stopColor="#FF9800" />
            <stop offset="100%" stopColor="#E65100" />
          </radialGradient>
        </defs>

        {/* Concentric ring guides */}
        {[RINGS.ring1, RINGS.ring2, RINGS.ring3].map((r, i) => (
          <circle key={`guide-${i}`} cx={CX} cy={CY} r={r}
            fill="none" stroke="#E0E0E0" strokeWidth={0.5} strokeDasharray="4 6" opacity={0.35} />
        ))}

        {/* Ring segments (colorful wedges) */}
        {ringSegments.map(seg => (
          <path key={seg.key} d={seg.d} fill={seg.fill} stroke={seg.stroke} strokeWidth={0.8} />
        ))}

        {/* Tapered branches: center → categories */}
        {nodes.filter(n => n.type === 'category').map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <path key={`b-cat-${node.id}`}
              d={buildTaperedBranch(CX, CY, node.x, node.y, 7, 2.5)}
              fill={node.color} opacity={isBlurred ? 0.06 : 0.45}
              style={{ transition: 'opacity 0.4s ease' }} />
          );
        })}

        {/* Tapered branches: categories → tasks */}
        {nodes.filter(n => n.type === 'task').map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          const parentCat = nodes.find(n2 => n2.type === 'category' && Math.abs(n2.angle - node.parentAngle) < 0.01);
          const px = parentCat ? parentCat.x : CX;
          const py = parentCat ? parentCat.y : CY;
          return (
            <path key={`b-task-${node.id}`}
              d={buildTaperedBranch(px, py, node.x, node.y, 4, 1)}
              fill={node.parentColor || node.color}
              opacity={isBlurred ? 0.04 : 0.3}
              style={{ transition: 'opacity 0.4s ease' }} />
          );
        })}

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={RINGS.center + 3} fill="none" stroke="#FFC10730" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={RINGS.center} fill="url(#center-grad-radial)" filter="url(#radial-glow)" />
        <text x={CX} y={CY - 10} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">
          {centerLabel}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="white" fontSize="13" fontWeight="600">
          {centerSub || `${tasks.length} משימות`}
        </text>

        {/* Hierarchy ring labels */}
        <text x={CX + RINGS.ring1 + 8} y={CY - 6} fontSize="9" fill="#1E293B" fontWeight="700">דיווחין</text>
        <text x={CX + RINGS.ring2 + 8} y={CY - 6} fontSize="9" fill="#1E293B" fontWeight="700">שירותים</text>
        <text x={CX + RINGS.ring3 + 8} y={CY - 6} fontSize="8" fill="#334155" fontWeight="700">ייצור</text>

        {/* Category nodes (Ring 1) */}
        {nodes.filter(n => n.type === 'category').map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          return (
            <g key={node.id}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#radial-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}>
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 7}
                  fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="10s" repeatCount="indefinite" />
                </circle>
              )}
              {renderNodeShape('bubble', node.x, node.y, node.r + 2, 'none', node.color + '20')}
              {renderNodeShape('bubble', node.x, node.y, node.r, node.bg, node.color, 2)}
              {renderNodeShape('bubble', node.x, node.y, node.r - 2, 'white', 'none', 0)}
              <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0F172A"
                style={{ pointerEvents: 'none' }}>
                {node.label}
              </text>
              <text x={node.x} y={node.y + 10} textAnchor="middle" fontSize="10" fontWeight="700" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.subLabel} משימות
              </text>
            </g>
          );
        })}

        {/* Task nodes (Ring 2-3) */}
        {nodes.filter(n => n.type === 'task').map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          return (
            <g key={node.id}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#radial-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
                transform: isFocused ? 'scale(1.08)' : 'scale(1)',
                transformOrigin: `${node.x}px ${node.y}px`,
              }}>
              <circle cx={node.x} cy={node.y} r={node.r + 4}
                fill="none" stroke={node.statusGlow || '#546E7A'} strokeWidth={1.2} opacity={0.3} />
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              <g filter="url(#node-shadow)">
                {renderNodeShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2)}
                {renderNodeShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              {/* Directive #10: Bold text, high contrast */}
              <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F172A"
                style={{ pointerEvents: 'none' }}>
                {node.label.substring(0, 16)}
              </text>
              <text x={node.x} y={node.y + 8} textAnchor="middle" fontSize="9" fontWeight="600" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.subLabel ? node.subLabel.substring(0, 14) : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Focus clear button */}
      {focusedNode !== null && (
        <button onClick={() => setFocusedNode(null)}
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-lg border text-xs font-bold hover:bg-gray-50 transition-all"
          style={{ color: '#E91E63' }}>
          ✕ נקה מיקוד
        </button>
      )}

      {/* DNA Legend */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-gray-200">
        {[
          { label: 'P1 שכר', color: DNA.P1 },
          { label: 'P2 הנה"ח', color: DNA.P2 },
          { label: 'P3 ביצוע', color: DNA.P3 },
          { label: 'P4 בית', color: DNA.P4 },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] font-bold" style={{ color: item.color }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* FloatingToolbar (Directive #6) */}
      <FloatingToolbar
        visible={!!selectedNode && !!selectedNodeData}
        x={toolbarPos.x}
        y={toolbarPos.y}
        nodeColor={selectedNodeData?.color}
        nodeShape={selectedNodeData?.shape}
        onColorChange={handleColorChange}
        onShapeChange={handleShapeChange}
        onApplyToChildren={selectedNodeData?.type === 'category' ? handleApplyToChildren : undefined}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
