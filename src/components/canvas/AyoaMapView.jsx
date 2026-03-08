/**
 * ── AyoaMapView: Organic Mind Map Tree (Directive #5, Lens 1) ──
 *
 * DIRECTIVE #7: Strict Hierarchy & Physics
 *   Root → דיווחין → שירותים → ייצור → גודל
 *   Tapered cubic bezier branches. Absolute SVG coords. No % in paths.
 *
 * DIRECTIVE #10: No pale gray. Bold labels. Deep fills.
 */

import React, { useState, useMemo, useRef, useCallback, useContext, createContext } from 'react';
import { renderNodeShape, buildTaperedBranch } from './AyoaNode';
import { getConnectionProps } from '@/engines/lineStyleEngine';
import { useDesign } from '@/contexts/DesignContext';
import { getActiveBranches } from '@/engines/automationEngine';
import FloatingToolbar from './FloatingToolbar';

const VB_W = 1400, VB_H = 900;
const CX = VB_W / 2, CY = VB_H / 2;

// Default DNA — overridden by Design Engine branchColors at runtime
const DNA_DEFAULTS = {
  P1: '#00A3E0', P2: '#4682B4', P3: '#E91E63', P4: '#FFC107', P5: '#2E7D32',
};

function getCategoryColor(category, branchColors) {
  const c = branchColors || DNA_DEFAULTS;
  if (!category) return c.P3;
  const cat = (category || '').toLowerCase();
  if (cat.includes('שכר') || cat.includes('payroll') || cat.includes('ניכויים') || cat.includes('ביטוח') || cat.includes('מס"ב')) return c.P1;
  if (cat.includes('מע"מ') || cat.includes('vat') || cat.includes('הנה"ח') || cat.includes('bookkeeping') || cat.includes('מקדמות') || cat.includes('התאמות') || cat.includes('מאזנ')) return c.P2;
  if (cat.includes('בית') || cat.includes('אישי') || cat.includes('home') || cat.includes('ארוחות')) return c.P4;
  if (cat.includes('דוח שנתי') || cat.includes('הצהרת הון') || cat.includes('מאזנ')) return c.P5;
  if (cat.includes('admin') || cat.includes('אדמיני') || cat.includes('ייעוץ') || cat.includes('פגישה') || cat.includes('שיווק')) return c.P3;
  return c.P4;
}

export default function AyoaMapView({ tasks = [], centerLabel = 'מרכז', centerSub = '' }) {
  const svgRef = useRef(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });

  // Design engine — global shape & line preferences
  let design = null;
  try { design = useDesign(); } catch { /* not mounted */ }
  const globalShape = design?.shape || 'bubble';
  const globalLineStyle = design?.lineStyle || 'tapered';
  const softShadows = design?.softShadows !== false;
  const branchColors = design?.branchColors || DNA_DEFAULTS;

  // Status Sync: detect which categories have active sub-tasks
  const activeBranches = useMemo(() => getActiveBranches(tasks), [tasks]);

  const { categoryNodes, taskNodes, collectorNodes } = useMemo(() => {
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
      const dnaColor = getCategoryColor(cat, branchColors);
      const cx = CX + Math.cos(angle) * catRadius;
      const cy = CY + Math.sin(angle) * catRadius;

      catNodes.push({
        id: `cat-${ci}`,
        x: cx, y: cy,
        r: 38,
        shape: globalShape,
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
        const ov = design?.getNodeOverride?.(task.id) || {};

        tNodes.push({
          id: task.id,
          x: cx + Math.cos(tAngle) * tRadius + (Math.sin(ti * 1.3) * 20),
          y: cy + Math.sin(tAngle) * tRadius + (Math.cos(ti * 0.9) * 15),
          r,
          shape: ov.shape || globalShape,
          color: ov.color || dnaColor,
          bg: (ov.color || dnaColor) + '12',
          label: task.title || '',
          subLabel: task.client_name || '',
          parentX: cx,
          parentY: cy,
          parentColor: dnaColor,
          parentAngle: angle,
          sticker: design?.stickerMap?.[task.id] || null,
        });
      });
    });

    // MSB Collector nodes — special shared nodes positioned below center
    const collectors = [];
    tasks.forEach((task, ti) => {
      if (!task.is_collector) return;
      const ov = design?.getNodeOverride?.(task.id) || {};
      const collectorColor = ov.color || branchColors.P1 || '#00A3E0';
      collectors.push({
        id: task.id,
        x: CX + (ti % 2 === 0 ? -90 : 90),
        y: CY + 220 + (ti * 50),
        r: 28,
        shape: ov.shape || 'hexagon',
        color: collectorColor,
        bg: collectorColor + '15',
        label: task.title || 'מס"ב',
        subLabel: task.status === 'waiting_for_materials' ? '🔒 ממתין' : task.status === 'not_started' ? 'מוכן' : '',
        isLocked: task.status === 'waiting_for_materials',
        dependency_ids: task.dependency_ids || [],
        sticker: design?.stickerMap?.[task.id] || null,
      });
      // Remove from regular task nodes to avoid duplication
      const idx = tNodes.findIndex(n => n.id === task.id);
      if (idx !== -1) tNodes.splice(idx, 1);
    });

    return { categoryNodes: catNodes, taskNodes: tNodes, collectorNodes: collectors };
  }, [tasks, design?.nodeOverrides, globalShape, branchColors]);

  const allNodes = [...categoryNodes, ...taskNodes, ...collectorNodes];

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
      // Notify Design Engine of selection
      window.dispatchEvent(new CustomEvent('calmplan:node-selected', { detail: { nodeId } }));
    }
    setFocusedNode(prev => prev === nodeId ? null : nodeId);
  }, [allNodes, selectedNode]);

  const handleColorChange = useCallback((color) => {
    if (!selectedNode || !design?.setNodeOverride) return;
    design.setNodeOverride(selectedNode, { color });
  }, [selectedNode, design]);

  const handleShapeChange = useCallback((shape) => {
    if (!selectedNode || !design?.setNodeOverride) return;
    design.setNodeOverride(selectedNode, { shape });
  }, [selectedNode, design]);

  const handleApplyToChildren = useCallback(() => {
    if (!selectedNode || !design?.setNodeOverride) return;
    const parentNode = allNodes.find(n => n.id === selectedNode);
    if (!parentNode || !parentNode.id?.startsWith?.('cat-')) return;
    const parentOv = design?.getNodeOverride?.(selectedNode) || {};
    const childNodes = taskNodes.filter(n => Math.abs(n.parentAngle - parentNode.angle) < 0.01);
    childNodes.forEach(child => {
      design.setNodeOverride(child.id, parentOv);
    });
  }, [selectedNode, allNodes, taskNodes, design]);

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

        {/* Branches: center → categories (uses Design Engine line style) */}
        {categoryNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          const conn = getConnectionProps(
            globalLineStyle, CX, CY, node.x, node.y, node.color,
            isBlurred ? 0.06 : 0.45,
            { startWidth: 8, endWidth: 3, strokeWidth: 3 }
          );
          return (
            <path key={`br-${node.id}`} {...conn.props}
              style={{ transition: 'opacity 0.4s ease' }} />
          );
        })}

        {/* Branches: categories → tasks */}
        {taskNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          const conn = getConnectionProps(
            globalLineStyle, node.parentX, node.parentY, node.x, node.y,
            node.parentColor || node.color,
            isBlurred ? 0.04 : 0.3,
            { startWidth: 4, endWidth: 1, strokeWidth: 2 }
          );
          return (
            <path key={`br-t-${node.id}`} {...conn.props}
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
          const isActive = activeBranches.has(node.label);
          return (
            <g key={node.id}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#map-blur)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}>
              {/* Status Sync: pulsing ring when branch has active sub-tasks */}
              {isActive && !isBlurred && (
                <circle cx={node.x} cy={node.y} r={node.r + 12}
                  fill="none" stroke={node.color} strokeWidth={2} strokeDasharray="8 4">
                  <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="r" values={`${node.r + 12};${node.r + 15};${node.r + 12}`}
                    dur="2s" repeatCount="indefinite" />
                </circle>
              )}
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
              {node.sticker && (
                <text x={node.x + node.r - 3} y={node.y + node.r - 3} textAnchor="middle"
                  fontSize="12" style={{ pointerEvents: 'none' }}>
                  {node.sticker}
                </text>
              )}
            </g>
          );
        })}

        {/* ── MSB Collector nodes — shared multi-parent with converging dashed lines ── */}
        {collectorNodes.map(cNode => {
          const isSelected = selectedNode === cNode.id;
          return (
            <g key={`collector-${cNode.id}`}>
              {/* Converging dependency lines from prerequisite tasks */}
              {cNode.dependency_ids.map(depId => {
                const depNode = taskNodes.find(n => n.id === depId);
                if (!depNode) return null;
                return (
                  <path key={`dep-${depId}-${cNode.id}`}
                    d={`M ${depNode.x} ${depNode.y} C ${depNode.x} ${depNode.y + 50} ${cNode.x} ${cNode.y - 50} ${cNode.x} ${cNode.y}`}
                    fill="none" stroke={cNode.color} strokeWidth={1.5}
                    strokeDasharray="6 4" opacity={0.4}
                    markerEnd="none" />
                );
              })}
              {/* Selection ring */}
              {isSelected && (
                <circle cx={cNode.x} cy={cNode.y} r={cNode.r + 8}
                  fill="none" stroke={cNode.color} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5}>
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${cNode.x} ${cNode.y}`} to={`360 ${cNode.x} ${cNode.y}`}
                    dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Lock pulse for locked collectors */}
              {cNode.isLocked && (
                <circle cx={cNode.x} cy={cNode.y} r={cNode.r + 5}
                  fill="none" stroke="#FF8F00" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.4}>
                  <animate attributeName="opacity" values="0.4;0.15;0.4" dur="3s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Collector node body */}
              <g filter="url(#map-node-shadow)" onClick={(e) => handleNodeClick(e, cNode.id)}
                style={{ cursor: 'pointer' }}>
                {renderNodeShape(cNode.shape, cNode.x, cNode.y, cNode.r, cNode.bg, cNode.color, 2.5)}
                {renderNodeShape(cNode.shape, cNode.x, cNode.y, cNode.r - 3, 'white', 'none', 0)}
              </g>
              <text x={cNode.x} y={cNode.y - 5} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#0F172A"
                style={{ pointerEvents: 'none' }}>
                {cNode.label.substring(0, 16)}
              </text>
              <text x={cNode.x} y={cNode.y + 8} textAnchor="middle" fontSize="8" fontWeight="700" fill={cNode.color}
                style={{ pointerEvents: 'none' }}>
                {cNode.subLabel}
              </text>
              {cNode.sticker && (
                <text x={cNode.x + cNode.r - 3} y={cNode.y + cNode.r - 3} textAnchor="middle"
                  fontSize="12" style={{ pointerEvents: 'none' }}>
                  {cNode.sticker}
                </text>
              )}
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
        onColorChange={handleColorChange}
        onShapeChange={handleShapeChange}
        onApplyToChildren={selectedNodeData?.id?.startsWith?.('cat-') ? handleApplyToChildren : undefined}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
