/**
 * ── AyoaRadialView: Radial/circular mind-map view ──
 * Center = topic/page title, tasks radiate outward in a circle.
 * AYOA-style with tapered Bezier branches, shape gallery, Focus Blur.
 * Includes FloatingToolbar for color/shape customization on click.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { getServiceWeight } from '@/config/serviceWeights';
import { LOAD_COLORS } from '@/engines/capacityEngine';
import { buildTaperedBranch } from './AyoaNode';
import FloatingToolbar from './FloatingToolbar';

const VB = 1000;
const CX = VB / 2, CY = VB / 2;
const RADIUS = 340;

function shapeForLoad(load) {
  if (load >= 3) return 'cloud';
  if (load >= 2) return 'bubble';
  if (load >= 1) return 'circle';
  return 'bubble';
}

function renderShape(shape, x, y, r, fill, stroke) {
  switch (shape) {
    case 'cloud': {
      const d = `M ${x - r * 0.55} ${y + r * 0.22} ` +
        `C ${x - r * 0.88} ${y + r * 0.22} ${x - r} ${y - r * 0.11} ${x - r * 0.77} ${y - r * 0.39} ` +
        `C ${x - r * 0.77} ${y - r * 0.72} ${x - r * 0.39} ${y - r * 0.88} ${x - r * 0.11} ${y - r * 0.66} ` +
        `C ${x + r * 0.06} ${y - r * 0.94} ${x + r * 0.5} ${y - r * 0.88} ${x + r * 0.61} ${y - r * 0.61} ` +
        `C ${x + r * 0.94} ${y - r * 0.55} ${x + r} ${y - r * 0.11} ${x + r * 0.77} ${y + r * 0.11} ` +
        `C ${x + r * 0.88} ${y + r * 0.39} ${x + r * 0.61} ${y + r * 0.55} ${x + r * 0.28} ${y + r * 0.5} ` +
        `C ${x + r * 0.11} ${y + r * 0.66} ${x - r * 0.28} ${y + r * 0.61} ${x - r * 0.55} ${y + r * 0.22} Z`;
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={2.5} />;
    }
    case 'diamond': {
      const pts = `${x},${y - r} ${x + r * 0.7},${y} ${x},${y + r} ${x - r * 0.7},${y}`;
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />;
    }
    case 'bubble':
      return <ellipse cx={x} cy={y} rx={r} ry={r * 0.85} fill={fill} stroke={stroke} strokeWidth={2.5} />;
    default:
      return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={2.5} />;
  }
}

export default function AyoaRadialView({ tasks = [], centerLabel = 'מרכז', centerSub = '' }) {
  const svgRef = useRef(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  // Node overrides: { [nodeId]: { color, shape } }
  const [overrides, setOverrides] = useState({});

  const nodes = useMemo(() => {
    const top = tasks.slice(0, 16);
    const n = top.length || 1;
    const angleStep = (2 * Math.PI) / n;
    return top.map((task, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const sw = getServiceWeight(task.category);
      const load = typeof task.cognitive_load === 'number' ? task.cognitive_load : sw.cognitiveLoad;
      const lc = LOAD_COLORS[Math.min(3, Math.max(0, load))] || LOAD_COLORS[0];
      const r = load >= 3 ? 50 : load >= 2 ? 44 : load >= 1 ? 38 : 32;
      const ov = overrides[task.id] || {};
      return {
        id: task.id,
        x: CX + Math.cos(angle) * RADIUS,
        y: CY + Math.sin(angle) * RADIUS,
        r,
        shape: ov.shape || shapeForLoad(load),
        color: ov.color || lc.color,
        bg: (ov.color || lc.color) + '15',
        label: task.title || '',
        subLabel: task.client_name || '',
        load,
        duration: sw.duration,
        loadLabel: lc.label,
      };
    });
  }, [tasks, overrides]);

  const handleNodeClick = useCallback((e, nodeId) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    // Convert SVG viewBox coords to screen coords
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
      <svg ref={svgRef} viewBox={`0 0 ${VB} ${VB}`} className="w-full h-full" style={{ maxHeight: 'calc(100vh - 180px)' }}
        onClick={() => { setSelectedNode(null); }}>
        <defs>
          <filter id="radial-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#4682B4" floodOpacity="0.25" />
          </filter>
          <filter id="radial-blur">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id="center-grad">
            <stop offset="0%" stopColor="#2C3E50" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2C3E50" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Tapered branches — thick at base, thin at tip */}
        {nodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <path
              key={`branch-${node.id}`}
              d={buildTaperedBranch(CX, CY, node.x, node.y, 5, 1.5)}
              fill={node.color}
              opacity={isBlurred ? 0.08 : 0.55}
              style={{ transition: 'opacity 0.4s ease' }}
            />
          );
        })}

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={65} fill="url(#center-grad)" />
        <circle cx={CX} cy={CY} r={60} fill="#2C3E50" filter="url(#radial-glow)" />
        <text x={CX} y={CY - 8} textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">{centerLabel}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fill="#B0BEC5" fontSize="13">
          {centerSub || `${nodes.length} משימות`}
        </text>

        {/* Nodes with AYOA shapes */}
        {nodes.map(node => {
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
                opacity: isBlurred ? 0.3 : 1,
                transform: isFocused ? 'scale(1.1)' : 'scale(1)',
                transformOrigin: `${node.x}px ${node.y}px`,
              }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke={node.color} strokeWidth={1.5}
                  strokeDasharray="6 4" opacity={0.6}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Glow halo */}
              {renderShape(node.shape, node.x, node.y, node.r + 3, 'none', node.color + '30')}
              {/* Shape */}
              {renderShape(node.shape, node.x, node.y, node.r, node.bg, node.color)}
              {renderShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none')}
              {/* Labels */}
              <text x={node.x} y={node.y - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="#263238"
                style={{ pointerEvents: 'none' }}>
                {node.label.substring(0, 16)}
              </text>
              <text x={node.x} y={node.y + 10} textAnchor="middle" fontSize="10" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.loadLabel} • {node.duration}דק׳
              </text>
              {node.subLabel && (
                <text x={node.x} y={node.y + 24} textAnchor="middle" fontSize="9" fill="#90A4AE"
                  style={{ pointerEvents: 'none' }}>
                  {node.subLabel.substring(0, 14)}
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
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-lg border text-xs font-medium text-[#4682B4] hover:bg-gray-50 transition-all"
        >
          ✕ נקה מיקוד
        </button>
      )}

      {/* Floating Design Toolbar */}
      <FloatingToolbar
        visible={!!selectedNode && !!selectedNodeData}
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
