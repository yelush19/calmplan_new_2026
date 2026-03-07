/**
 * ── AyoaMapView: Organic Mind Map Tree (Directive #5, Lens 1) ──
 *
 * DIRECTIVE #7: Strict Hierarchy & Physics
 *   Root → דיווחין → שירותים → ייצור → גודל
 *   Tapered cubic bezier branches. Absolute SVG coords. No % in paths.
 *
 * DIRECTIVE #10: No pale gray. Bold labels. Deep fills.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { renderNodeShape, buildTaperedBranch } from './AyoaNode';
import FloatingToolbar from './FloatingToolbar';

const VB_W = 1400, VB_H = 900;
const CX = VB_W / 2, CY = VB_H / 2;

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

export default function AyoaMapView({ tasks = [], centerLabel = 'מרכז', centerSub = '' }) {
  const svgRef = useRef(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState({});

  const { categoryNodes, taskNodes } = useMemo(() => {
    const catMap = {};
    tasks.forEach(task => {
      const cat = task.category || task.title || 'כללי';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(task);
    });

    const catEntries = Object.entries(catMap);
    const catCount = catEntries.length || 1;
    const angleStep = (2 * Math.PI) / catCount;
    const catRadius = catCount <= 4 ? 280 : catCount <= 8 ? 320 : 360;
    const taskRadiusBase = catCount <= 4 ? 200 : 160;

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
        r: 38,
        shape: 'bubble',
        color: dnaColor,
        bg: dnaColor + '12',
        label: cat.substring(0, 16),
        subLabel: `${catTasks.length} משימות`,
        angle,
      });

      const maxPerCat = catCount <= 3 ? 10 : catCount <= 6 ? 6 : 4;
      const tCount = Math.min(catTasks.length, maxPerCat);
      const tAngleSpread = Math.min(Math.PI * 0.7, angleStep * 0.85);
      const tAngleStart = angle - tAngleSpread / 2;

      catTasks.slice(0, tCount).forEach((task, ti) => {
        const tAngle = tCount > 1
          ? tAngleStart + (tAngleSpread * ti) / (tCount - 1)
          : angle;

        const rVariation = (ti % 3) * 35;
        const tRadius = taskRadiusBase + rVariation;
        const r = 22;
        const ov = overrides[task.id] || {};

        tNodes.push({
          id: task.id,
          x: cx + Math.cos(tAngle) * tRadius + (Math.sin(ti * 1.3) * 20),
          y: cy + Math.sin(tAngle) * tRadius + (Math.cos(ti * 0.9) * 15),
          r,
          shape: ov.shape || 'bubble',
          color: ov.color || dnaColor,
          bg: (ov.color || dnaColor) + '12',
          label: task.title || '',
          subLabel: task.client_name || '',
          parentX: cx,
          parentY: cy,
          parentColor: dnaColor,
          parentAngle: angle,
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

  const handleApplyToChildren = useCallback(() => {
    if (!selectedNode) return;
    const parentNode = allNodes.find(n => n.id === selectedNode);
    if (!parentNode || !parentNode.id?.startsWith?.('cat-')) return;
    const parentOv = overrides[selectedNode] || {};
    const childNodes = taskNodes.filter(n => Math.abs(n.parentAngle - parentNode.angle) < 0.01);
    setOverrides(prev => {
      const next = { ...prev };
      childNodes.forEach(child => {
        next[child.id] = { ...next[child.id], ...parentOv };
      });
      return next;
    });
  }, [selectedNode, allNodes, taskNodes, overrides]);

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

        {/* Tapered branches: center → categories */}
        {categoryNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <path key={`br-${node.id}`}
              d={buildTaperedBranch(CX, CY, node.x, node.y, 8, 3)}
              fill={node.color} opacity={isBlurred ? 0.06 : 0.45}
              style={{ transition: 'opacity 0.4s ease' }} />
          );
        })}

        {/* Tapered branches: categories → tasks */}
        {taskNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          return (
            <path key={`br-t-${node.id}`}
              d={buildTaperedBranch(node.parentX, node.parentY, node.x, node.y, 4, 1)}
              fill={node.parentColor || node.color}
              opacity={isBlurred ? 0.04 : 0.3}
              style={{ transition: 'opacity 0.4s ease' }} />
          );
        })}

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={52} fill="url(#map-center-grad)" filter="url(#map-glow)" />
        <text x={CX} y={CY - 8} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">{centerLabel}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="white" fontSize="12" fontWeight="600">
          {centerSub || `${tasks.length} משימות`}
        </text>

        {/* Category nodes */}
        {categoryNodes.map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          return (
            <g key={node.id}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#map-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}>
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="6 4" opacity={0.6}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="10s" repeatCount="indefinite" />
                </circle>
              )}
              <g filter="url(#map-node-shadow)">
                {renderNodeShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2.5)}
                {renderNodeShape(node.shape, node.x, node.y, node.r - 3, 'white', 'none', 0)}
              </g>
              <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="12" fontWeight="800" fill="#0F172A"
                style={{ pointerEvents: 'none' }}>
                {node.label}
              </text>
              <text x={node.x} y={node.y + 10} textAnchor="middle" fontSize="10" fontWeight="700" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.subLabel}
              </text>
            </g>
          );
        })}

        {/* Task nodes */}
        {taskNodes.map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          return (
            <g key={node.id}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#map-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}>
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 7}
                  fill="none" stroke={node.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`}
                    dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              <g filter="url(#map-node-shadow)">
                {renderNodeShape(node.shape, node.x, node.y, node.r, node.bg, node.color, 2)}
                {renderNodeShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0F172A"
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

      {focusedNode !== null && (
        <button onClick={() => setFocusedNode(null)}
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-lg border text-xs font-bold hover:bg-gray-50 transition-all"
          style={{ color: '#E91E63' }}>
          ✕ נקה מיקוד
        </button>
      )}

      <FloatingToolbar
        visible={!!selectedNode && !!selectedNodeData}
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
        onApplyToChildren={selectedNodeData?.id?.startsWith?.('cat-') ? handleApplyToChildren : undefined}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
