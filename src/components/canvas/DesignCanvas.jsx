/**
 * ── DesignCanvas.jsx: AYOA-Style Creative Canvas Engine ──
 * Full creative freedom for Lena — drag nodes, pick shapes/colors,
 * switch grid layouts, and style via floating toolbar.
 *
 * Features:
 * - AYOA color palette (magenta, sky blue, mustard, purple)
 * - SVG shape gallery (cloud, bubble, diamond, pill, circle, rect)
 * - Grid/Layout toggle (Mind Map, Radial, Gantt, Column)
 * - Style Toolbar (floating menu on node click)
 * - Free drag & drop with organic parent linking
 * - Zoom & Blur magnifying glass effect
 * - DNA cognitive load integration
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Shapes, LayoutGrid, ZoomIn, ZoomOut, Plus, Trash2,
  Move, Circle, Square, Diamond, Cloud, Hexagon, Type,
  ChevronDown, X, Eye, EyeOff, Link2, Unlink, Search,
  Grid3X3, Network, BarChart3, Columns,
} from 'lucide-react';
import { getServiceWeight } from '@/config/serviceWeights';
import { LOAD_COLORS } from '@/engines/capacityEngine';

// ── AYOA Color Palette ──
const AYOA_COLORS = {
  personal:  { color: '#E91E63', label: 'אישי',   bg: '#FCE4EC' },
  folders:   { color: '#00A3E0', label: 'תיקיות', bg: '#E0F4FF' },
  tasks:     { color: '#FFC107', label: 'משימות', bg: '#FFF8E1' },
  admin:     { color: '#9C27B0', label: 'ניהול',  bg: '#F3E5F5' },
  burgundy:  { color: '#800000', label: 'דחוף',   bg: '#FFEBEE' },
  steel:     { color: '#4682B4', label: 'עסקי',   bg: '#E3F2FD' },
  sage:      { color: '#8FBC8F', label: 'ירוק',   bg: '#E8F5E9' },
  light:     { color: '#ADD8E6', label: 'קל',     bg: '#E0F7FA' },
};

const COLOR_LIST = Object.values(AYOA_COLORS);

// ── SVG Shape Definitions ──
const SHAPES = {
  cloud: {
    label: 'ענן',
    icon: Cloud,
    render: (cx, cy, r, fill, stroke) => {
      const d = `M ${cx - r * 0.55} ${cy + r * 0.22} ` +
        `C ${cx - r * 0.88} ${cy + r * 0.22} ${cx - r} ${cy - r * 0.11} ${cx - r * 0.77} ${cy - r * 0.39} ` +
        `C ${cx - r * 0.77} ${cy - r * 0.72} ${cx - r * 0.39} ${cy - r * 0.88} ${cx - r * 0.11} ${cy - r * 0.66} ` +
        `C ${cx + r * 0.06} ${cy - r * 0.94} ${cx + r * 0.5} ${cy - r * 0.88} ${cx + r * 0.61} ${cy - r * 0.61} ` +
        `C ${cx + r * 0.94} ${cy - r * 0.55} ${cx + r} ${cy - r * 0.11} ${cx + r * 0.77} ${cy + r * 0.11} ` +
        `C ${cx + r * 0.88} ${cy + r * 0.39} ${cx + r * 0.61} ${cy + r * 0.55} ${cx + r * 0.28} ${cy + r * 0.5} ` +
        `C ${cx + r * 0.11} ${cy + r * 0.66} ${cx - r * 0.28} ${cy + r * 0.61} ${cx - r * 0.55} ${cy + r * 0.22} Z`;
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={2} />;
    }
  },
  bubble: {
    label: 'בועה',
    icon: Circle,
    render: (cx, cy, r, fill, stroke) => (
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.85} fill={fill} stroke={stroke} strokeWidth={2} />
    )
  },
  diamond: {
    label: 'יהלום',
    icon: Diamond,
    render: (cx, cy, r, fill, stroke) => {
      const pts = `${cx},${cy - r} ${cx + r * 0.7},${cy} ${cx},${cy + r} ${cx - r * 0.7},${cy}`;
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={2} rx={8} />;
    }
  },
  pill: {
    label: 'כמוסה',
    icon: () => <div className="w-3 h-1.5 rounded-full border border-current" />,
    render: (cx, cy, r, fill, stroke) => (
      <rect x={cx - r} y={cy - r * 0.45} width={r * 2} height={r * 0.9} rx={r * 0.45} fill={fill} stroke={stroke} strokeWidth={2} />
    )
  },
  circle: {
    label: 'עיגול',
    icon: Circle,
    render: (cx, cy, r, fill, stroke) => (
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={2} />
    )
  },
  roundedRect: {
    label: 'מלבן',
    icon: Square,
    render: (cx, cy, r, fill, stroke) => (
      <rect x={cx - r} y={cy - r * 0.7} width={r * 2} height={r * 1.4} rx={14} fill={fill} stroke={stroke} strokeWidth={2} />
    )
  },
};

const SHAPE_KEYS = Object.keys(SHAPES);

// ── Layout modes ──
const LAYOUTS = {
  mindmap:  { label: 'מפת חשיבה', icon: Network },
  radial:   { label: 'רדיאלי',    icon: Grid3X3 },
  gantt:    { label: 'גאנט',      icon: BarChart3 },
  columns:  { label: 'עמודות',    icon: Columns },
};

// ── Tapered Bezier branch path builder ──
function buildTaperedBranch(sx, sy, ex, ey, startW = 5, endW = 1.5) {
  const dx = ex - sx, dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cp1x = sx + dx * 0.3 + nx * len * 0.1;
  const cp1y = sy + dy * 0.3 + ny * len * 0.1;
  const cp2x = sx + dx * 0.7 - nx * len * 0.06;
  const cp2y = sy + dy * 0.7 - ny * len * 0.06;
  const sw2 = startW / 2, ew2 = endW / 2;
  return [
    `M ${sx + nx * sw2} ${sy + ny * sw2}`,
    `C ${cp1x + nx * sw2 * 0.8} ${cp1y + ny * sw2 * 0.8} ${cp2x + nx * ew2 * 0.5} ${cp2y + ny * ew2 * 0.5} ${ex + nx * ew2} ${ey + ny * ew2}`,
    `L ${ex - nx * ew2} ${ey - ny * ew2}`,
    `C ${cp2x - nx * ew2 * 0.5} ${cp2y - ny * ew2 * 0.5} ${cp1x - nx * sw2 * 0.8} ${cp1y - ny * sw2 * 0.8} ${sx - nx * sw2} ${sy - ny * sw2}`,
    'Z'
  ].join(' ');
}

// ── Assign layout positions ──
function applyLayout(nodes, layout, width, height) {
  const cx = width / 2, cy = height / 2;
  const n = nodes.length || 1;

  return nodes.map((node, i) => {
    let x = node.x, y = node.y;

    if (layout === 'radial') {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const radius = Math.min(width, height) * 0.32;
      x = cx + Math.cos(angle) * radius;
      y = cy + Math.sin(angle) * radius;
    } else if (layout === 'mindmap') {
      // Organic tree: center node, children fan out right/left
      if (i === 0) { x = cx; y = cy; }
      else {
        const side = i % 2 === 0 ? 1 : -1;
        const row = Math.ceil(i / 2);
        const rowCount = Math.ceil((n - 1) / 2);
        x = cx + side * (width * 0.3);
        y = 60 + ((height - 120) * (row - 1)) / Math.max(rowCount - 1, 1);
      }
    } else if (layout === 'gantt') {
      // Horizontal timeline lanes
      x = 80 + ((width - 160) * i) / Math.max(n - 1, 1);
      y = cy;
    } else if (layout === 'columns') {
      // Column grid — 4 columns
      const cols = 4;
      const col = i % cols;
      const row = Math.floor(i / cols);
      x = (width / (cols + 1)) * (col + 1);
      y = 60 + row * 90;
    }

    return { ...node, x, y };
  });
}

// ── Convert task data to canvas nodes ──
function tasksToNodes(tasks) {
  return tasks.slice(0, 20).map((task, i) => {
    const sw = getServiceWeight(task.category);
    const load = typeof task.cognitive_load === 'number' ? task.cognitive_load : sw.cognitiveLoad;
    const lc = LOAD_COLORS[Math.min(3, Math.max(0, load))] || LOAD_COLORS[0];
    // Default shape from cognitive load
    const shapeKey = load >= 3 ? 'cloud' : load >= 2 ? 'roundedRect' : load >= 1 ? 'circle' : 'pill';
    return {
      id: task.id || `node-${i}`,
      label: task.title || `משימה ${i + 1}`,
      subLabel: task.client_name || '',
      x: 0, y: 0,
      shape: shapeKey,
      colorIdx: load >= 3 ? 4 : load >= 2 ? 5 : load >= 1 ? 7 : 6,
      size: load >= 3 ? 40 : load >= 2 ? 35 : load >= 1 ? 30 : 26,
      parentId: null,
      _task: task,
      _load: load,
      _loadColor: lc,
      _duration: sw.duration,
    };
  });
}

// ── Main Component ──
export default function DesignCanvas({ tasks = [], clients = [], onTaskUpdate }) {
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [layout, setLayout] = useState('radial');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarPos, setToolbarPos] = useState(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showBlur, setShowBlur] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkFrom, setLinkFrom] = useState(null);

  const WIDTH = 900, HEIGHT = 600;

  // Initialize nodes from tasks
  useEffect(() => {
    if (tasks.length > 0) {
      const raw = tasksToNodes(tasks);
      const positioned = applyLayout(raw, layout, WIDTH, HEIGHT);
      setNodes(positioned);
    }
  }, [tasks]);

  // Re-layout when layout mode changes
  const switchLayout = useCallback((newLayout) => {
    setLayout(newLayout);
    setNodes(prev => applyLayout(prev, newLayout, WIDTH, HEIGHT));
    setSelectedNode(null);
    setToolbarPos(null);
  }, []);

  // SVG coordinate converter
  const svgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [zoom, pan]);

  // ── Drag handlers ──
  const handleNodeMouseDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    if (linkMode) {
      // Link mode: set parent
      if (linkFrom === null) {
        setLinkFrom(nodeId);
      } else {
        if (linkFrom !== nodeId) {
          setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, parentId: linkFrom } : n));
        }
        setLinkFrom(null);
        setLinkMode(false);
      }
      return;
    }
    const pt = svgPoint(e.clientX, e.clientY);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setDragId(nodeId);
      setDragOffset({ x: pt.x - node.x, y: pt.y - node.y });
    }
  }, [linkMode, linkFrom, nodes, svgPoint]);

  const handleMouseMove = useCallback((e) => {
    if (dragId) {
      const pt = svgPoint(e.clientX, e.clientY);
      setNodes(prev => prev.map(n =>
        n.id === dragId ? { ...n, x: pt.x - dragOffset.x, y: pt.y - dragOffset.y } : n
      ));
    } else if (isPanning && panStart) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [dragId, dragOffset, isPanning, panStart, svgPoint]);

  const handleMouseUp = useCallback(() => {
    setDragId(null);
    setIsPanning(false);
    setPanStart(null);
  }, []);

  const handleSvgMouseDown = useCallback((e) => {
    if (e.target === svgRef.current || e.target.tagName === 'rect') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNode(null);
      setToolbarPos(null);
    }
  }, [pan]);

  // ── Node click → show toolbar ──
  const handleNodeClick = useCallback((e, nodeId) => {
    e.stopPropagation();
    if (dragId) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setSelectedNode(nodeId);
    setFocusedNode(prev => prev === nodeId ? null : nodeId);

    // Position toolbar near node
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      setToolbarPos({
        x: node.x * zoom + pan.x + rect.left,
        y: node.y * zoom + pan.y + rect.top - 60,
      });
    }
  }, [nodes, zoom, pan, dragId]);

  // ── Toolbar actions ──
  const updateNodeProp = useCallback((prop, value) => {
    setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, [prop]: value } : n));
  }, [selectedNode]);

  const deleteNode = useCallback(() => {
    setNodes(prev => prev.filter(n => n.id !== selectedNode).map(n =>
      n.parentId === selectedNode ? { ...n, parentId: null } : n
    ));
    setSelectedNode(null);
    setToolbarPos(null);
  }, [selectedNode]);

  const addNode = useCallback(() => {
    const id = `node-${Date.now()}`;
    const cx = WIDTH / 2 + (Math.random() - 0.5) * 200;
    const cy = HEIGHT / 2 + (Math.random() - 0.5) * 200;
    setNodes(prev => [...prev, {
      id,
      label: 'ענף חדש',
      subLabel: '',
      x: cx, y: cy,
      shape: 'bubble',
      colorIdx: Math.floor(Math.random() * COLOR_LIST.length),
      size: 32,
      parentId: selectedNode || null,
      _task: null,
      _load: 1,
      _loadColor: LOAD_COLORS[1],
      _duration: 15,
    }]);
  }, [selectedNode]);

  // ── Zoom ──
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev + delta)));
  }, []);

  // Build parent→child edges
  const edges = useMemo(() => {
    return nodes
      .filter(n => n.parentId)
      .map(n => {
        const parent = nodes.find(p => p.id === n.parentId);
        if (!parent) return null;
        return { from: parent, to: n, color: COLOR_LIST[n.colorIdx]?.color || '#4682B4' };
      })
      .filter(Boolean);
  }, [nodes]);

  const selectedNodeData = useMemo(() => nodes.find(n => n.id === selectedNode), [nodes, selectedNode]);

  return (
    <div className="relative h-full w-full flex flex-col" dir="rtl">
      {/* ── Top Control Bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 rounded-t-xl shrink-0 flex-wrap">
        {/* Layout Switcher */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
          {Object.entries(LAYOUTS).map(([key, { label, icon: Icon }]) => (
            <button
              key={key}
              onClick={() => switchLayout(key)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                layout === key ? 'bg-white shadow text-[#4682B4] font-bold' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-[10px] text-gray-400 font-mono min-w-[32px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"><ZoomIn className="w-4 h-4" /></button>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* Add Node */}
        <button onClick={addNode}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#E91E63]/10 text-[#E91E63] text-[10px] font-medium hover:bg-[#E91E63]/20 transition-all">
          <Plus className="w-3.5 h-3.5" /> ענף חדש
        </button>

        {/* Link Mode */}
        <button onClick={() => { setLinkMode(!linkMode); setLinkFrom(null); }}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
            linkMode ? 'bg-[#00A3E0]/20 text-[#00A3E0]' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}>
          {linkMode ? <Unlink className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          {linkMode ? 'בטל קישור' : 'קשר ענפים'}
        </button>

        {/* Focus Blur Toggle */}
        <button onClick={() => { setShowBlur(!showBlur); if (!showBlur) setFocusedNode(null); }}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
            showBlur ? 'bg-[#9C27B0]/10 text-[#9C27B0]' : 'bg-gray-50 text-gray-500'
          }`}>
          {showBlur ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          מיקוד
        </button>

        <div className="flex-1" />

        {/* AYOA Color Swatches Preview */}
        <div className="flex items-center gap-1">
          {COLOR_LIST.slice(0, 6).map((c, i) => (
            <div key={i} className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: c.color }} title={c.label} />
          ))}
        </div>
      </div>

      {/* ── SVG Canvas ── */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-gray-50 to-white rounded-b-xl"
        onWheel={handleWheel}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="cursor-grab active:cursor-grabbing"
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` }}
        >
          <defs>
            {/* Glow filters per AYOA color */}
            {COLOR_LIST.map((c, i) => (
              <filter key={`glow-${i}`} id={`canvas-glow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={c.color} floodOpacity="0.3" />
              </filter>
            ))}
            {/* Magnifying glass blur for focus mode */}
            <filter id="focus-blur">
              <feGaussianBlur stdDeviation="5" />
            </filter>
            {/* Subtle canvas grid pattern */}
            <pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="0.5" fill="#E0E0E0" />
            </pattern>
          </defs>

          {/* Grid dots background */}
          <rect width={WIDTH} height={HEIGHT} fill="url(#canvas-grid)" />

          {/* ── Tapered Bezier Branches ── */}
          {edges.map((edge, i) => {
            const isFading = showBlur && focusedNode !== null
              && focusedNode !== edge.from.id && focusedNode !== edge.to.id;
            return (
              <path
                key={`edge-${i}`}
                d={buildTaperedBranch(edge.from.x, edge.from.y, edge.to.x, edge.to.y)}
                fill={edge.color}
                opacity={isFading ? 0.1 : 0.55}
                style={{ transition: 'all 0.4s ease' }}
              />
            );
          })}

          {/* ── Nodes ── */}
          {nodes.map((node) => {
            const shape = SHAPES[node.shape] || SHAPES.bubble;
            const c = COLOR_LIST[node.colorIdx] || COLOR_LIST[0];
            const isSelected = selectedNode === node.id;
            const isFocused = focusedNode === node.id;
            const isBlurred = showBlur && focusedNode !== null && !isFocused;

            return (
              <g
                key={node.id}
                style={{
                  cursor: linkMode ? 'crosshair' : 'pointer',
                  transition: 'filter 0.4s ease, opacity 0.4s ease',
                  filter: isBlurred ? 'url(#focus-blur)' : 'none',
                  opacity: isBlurred ? 0.3 : 1,
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => handleNodeClick(e, node.id)}
              >
                {/* Shape with glow */}
                <g filter={isSelected ? `url(#canvas-glow-${node.colorIdx})` : undefined}>
                  {shape.render(node.x, node.y, node.size, c.bg, c.color)}
                </g>

                {/* Selection ring */}
                {isSelected && (
                  <circle cx={node.x} cy={node.y} r={node.size + 6}
                    fill="none" stroke={c.color} strokeWidth={1.5}
                    strokeDasharray="4 3" opacity={0.6}>
                    <animateTransform attributeName="transform" type="rotate"
                      from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                      dur="8s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Label */}
                <text x={node.x} y={node.y - 3} textAnchor="middle"
                  fontSize="9" fontWeight="600" fill="#263238"
                  style={{ pointerEvents: 'none' }}>
                  {(node.label || '').substring(0, 16)}
                </text>
                {node.subLabel && (
                  <text x={node.x} y={node.y + 9} textAnchor="middle"
                    fontSize="7" fill="#78909C"
                    style={{ pointerEvents: 'none' }}>
                    {node.subLabel.substring(0, 14)}
                  </text>
                )}
                {/* Duration badge */}
                {node._duration && (
                  <text x={node.x} y={node.y + 19} textAnchor="middle"
                    fontSize="7" fill={c.color} fontWeight="500"
                    style={{ pointerEvents: 'none' }}>
                    {node._duration}דק׳
                  </text>
                )}
              </g>
            );
          })}

          {/* Link mode indicator line */}
          {linkMode && linkFrom && (
            <text x={WIDTH / 2} y={20} textAnchor="middle" fontSize="11" fill="#00A3E0" fontWeight="bold">
              לחץ על ענף יעד לקישור
            </text>
          )}
        </svg>

        {/* Focus Blur clear button */}
        {focusedNode !== null && (
          <button
            onClick={() => setFocusedNode(null)}
            className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-lg border text-xs font-medium text-[#4682B4] hover:bg-gray-50 transition-all z-10"
          >
            ✕ נקה מיקוד
          </button>
        )}

        {/* Magnifying glass zoom indicator */}
        {zoom > 1.5 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 shadow text-[10px] text-gray-500">
            <Search className="w-3 h-3" /> זום ×{zoom.toFixed(1)}
          </div>
        )}
      </div>

      {/* ── Floating Style Toolbar ── */}
      <AnimatePresence>
        {selectedNode && selectedNodeData && toolbarPos && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 min-w-[260px]"
            style={{ left: Math.min(toolbarPos.x - 130, window.innerWidth - 280), top: Math.max(toolbarPos.y - 120, 10) }}
          >
            {/* Close */}
            <button onClick={() => { setSelectedNode(null); setToolbarPos(null); }}
              className="absolute top-2 left-2 p-1 rounded-full hover:bg-gray-100 text-gray-400">
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="text-[10px] font-bold text-gray-400 mb-2 flex items-center gap-1">
              <Palette className="w-3 h-3" /> סגנון ענף
            </div>

            {/* Shape Picker */}
            <div className="mb-2">
              <div className="text-[9px] text-gray-400 mb-1">צורה</div>
              <div className="flex items-center gap-1">
                {SHAPE_KEYS.map(key => {
                  const s = SHAPES[key];
                  const Icon = s.icon;
                  const isActive = selectedNodeData.shape === key;
                  return (
                    <button key={key}
                      onClick={() => updateNodeProp('shape', key)}
                      className={`p-1.5 rounded-lg transition-all ${
                        isActive ? 'bg-[#4682B4]/10 ring-1 ring-[#4682B4]' : 'hover:bg-gray-50'
                      }`}
                      title={s.label}>
                      {typeof Icon === 'function' && Icon.$$typeof ? <Icon className="w-4 h-4 text-gray-600" /> : <Icon className="w-4 h-4 text-gray-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Picker */}
            <div className="mb-2">
              <div className="text-[9px] text-gray-400 mb-1">צבע</div>
              <div className="flex items-center gap-1 flex-wrap">
                {COLOR_LIST.map((c, i) => (
                  <button key={i}
                    onClick={() => updateNodeProp('colorIdx', i)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      selectedNodeData.colorIdx === i ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.label} />
                ))}
              </div>
            </div>

            {/* Size Slider */}
            <div className="mb-2">
              <div className="text-[9px] text-gray-400 mb-1">גודל</div>
              <input type="range" min="18" max="60" value={selectedNodeData.size}
                onChange={(e) => updateNodeProp('size', parseInt(e.target.value))}
                className="w-full h-1 accent-[#4682B4]" />
            </div>

            {/* Label Edit */}
            <div className="mb-2">
              <div className="text-[9px] text-gray-400 mb-1">שם</div>
              <input
                type="text"
                value={selectedNodeData.label}
                onChange={(e) => updateNodeProp('label', e.target.value)}
                className="w-full px-2 py-1 text-xs border rounded-lg focus:ring-1 focus:ring-[#4682B4] focus:outline-none"
                dir="rtl"
              />
            </div>

            {/* Task Info (if linked to task) */}
            {selectedNodeData._task && (
              <div className="text-[9px] text-gray-400 border-t pt-1 mt-1 flex items-center gap-2">
                <span style={{ color: selectedNodeData._loadColor?.color }}>●</span>
                {selectedNodeData._loadColor?.label} • {selectedNodeData._duration}דק׳
                {selectedNodeData._task.client_name && ` • ${selectedNodeData._task.client_name}`}
              </div>
            )}

            {/* Delete */}
            <button onClick={deleteNode}
              className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-500 text-[10px] font-medium hover:bg-red-100 transition-all">
              <Trash2 className="w-3 h-3" /> מחק ענף
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
