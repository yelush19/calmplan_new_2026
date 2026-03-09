/**
 * ── AyoaMapView: Organic Mind Map Tree (Directive #5, Lens 1) ──
 *
 * DIRECTIVE #7: Strict Hierarchy & Physics
 *   Root → דיווחין → שירותים → ייצור → גודל
 *   Tapered cubic bezier branches. Absolute SVG coords. No % in paths.
 *
 * DIRECTIVE #10: No pale gray. Bold labels. Deep fills.
 *
 * Features:
 *   1. Parent-Child Sticky Drag — dragging a category node moves all children
 *   2. Collapse/Expand — toggle (+/-) on branches to save screen space
 *   3. Auto-Layout — reset spacing to prevent overlap
 *   4. Zoom-to-Fit — scroll wheel / pinch zoom with pan
 *   5. Global Selection — selectedNode stored with visual glow highlight
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { renderNodeShape } from './AyoaNode';
import { getConnectionProps } from '@/engines/lineStyleEngine';
import { useDesign } from '@/contexts/DesignContext';
import { getActiveBranches } from '@/engines/automationEngine';
import FloatingToolbar from './FloatingToolbar';

const VB_W = 1400, VB_H = 900;
const CX = VB_W / 2, CY = VB_H / 2;

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

// ── Auto-Layout Engine: compute non-overlapping positions ──
function computeAutoLayout(catEntries, branchColors, globalShape) {
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
      baseX: cx, baseY: cy,
      r: 38,
      shape: globalShape,
      color: dnaColor,
      bg: dnaColor + '12',
      label: cat.substring(0, 16),
      fullLabel: cat,
      subLabel: `${catTasks.length} משימות`,
      angle,
      catIndex: ci,
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

      tNodes.push({
        id: task.id,
        baseX: cx + Math.cos(tAngle) * tRadius + (Math.sin(ti * 1.3) * 20),
        baseY: cy + Math.sin(tAngle) * tRadius + (Math.cos(ti * 0.9) * 15),
        r: 22,
        label: task.title || '',
        subLabel: task.client_name || '',
        parentAngle: angle,
        catIndex: ci,
        taskData: task,
      });
    });
  });

  return { catNodes, tNodes };
}

export default function AyoaMapView({ tasks = [], centerLabel = 'מרכז', centerSub = '' }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });

  // ── Collapse/Expand state: set of collapsed category indices ──
  const [collapsedCats, setCollapsedCats] = useState(new Set());

  // ── Drag state ──
  const [dragOffsets, setDragOffsets] = useState({}); // catIndex → {dx, dy}
  const dragRef = useRef({ active: false, catIndex: null, startX: 0, startY: 0, origDx: 0, origDy: 0 });

  // ── Zoom & Pan state ──
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ active: false, startX: 0, startY: 0, origPanX: 0, origPanY: 0 });

  // Design engine (safe — useDesign returns fallback if outside provider)
  const design = useDesign();
  const globalShape = design.shape || 'bubble';
  const globalLineStyle = design.lineStyle || 'tapered';
  const branchColors = design.branchColors || DNA_DEFAULTS;

  // ── Focus Branch listener: scroll/pan to a specific P-branch (e.g. P4) ──
  useEffect(() => {
    const handler = (e) => {
      const branch = e.detail?.branch;
      if (!branch) return;
      // Find the category node matching this branch and center on it
      const branchLabel = branch === 'P4' ? 'בית' : branch === 'P1' ? 'שכר' : branch === 'P2' ? 'הנה"ח' : branch === 'P3' ? 'ניהול' : branch === 'P5' ? 'דוחות' : branch;
      const targetCat = baseCatNodes.find(n =>
        (n.fullLabel || n.label || '').includes(branchLabel) || (n.fullLabel || n.label || '').toLowerCase().includes(branch.toLowerCase())
      );
      if (targetCat) {
        // Pan so that the target node is centered in the viewport
        setPan({ x: -(targetCat.baseX - VB_W / 2) * zoom, y: -(targetCat.baseY - VB_H / 2) * zoom });
        setFocusedNode(targetCat.id);
      }
    };
    window.addEventListener('calmplan:focus-branch', handler);
    return () => window.removeEventListener('calmplan:focus-branch', handler);
  }, [baseCatNodes, zoom]);

  // Status Sync
  const activeBranches = useMemo(() => getActiveBranches(tasks), [tasks]);

  // ── Build base layout from tasks ──
  const catEntries = useMemo(() => {
    const catMap = {};
    tasks.forEach(task => {
      if (task.is_collector) return; // collectors handled separately
      const cat = task.category || task.title || 'כללי';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(task);
    });
    return Object.entries(catMap);
  }, [tasks]);

  const { baseCatNodes, baseTaskNodes } = useMemo(() => {
    const layout = computeAutoLayout(catEntries, branchColors, globalShape);
    return { baseCatNodes: layout.catNodes, baseTaskNodes: layout.tNodes };
  }, [catEntries, branchColors, globalShape]);

  // ── Apply drag offsets + design overrides to produce final positioned nodes ──
  const { categoryNodes, taskNodes, collectorNodes } = useMemo(() => {
    const catNodes = baseCatNodes.map(node => {
      const offset = dragOffsets[node.catIndex] || { dx: 0, dy: 0 };
      return {
        ...node,
        x: node.baseX + offset.dx,
        y: node.baseY + offset.dy,
      };
    });

    const tNodes = baseTaskNodes.map(node => {
      const offset = dragOffsets[node.catIndex] || { dx: 0, dy: 0 };
      const ov = design?.getNodeOverride?.(node.id) || {};
      const parentCat = catNodes.find(c => c.catIndex === node.catIndex);
      const dnaColor = parentCat?.color || '#64748B';
      return {
        ...node,
        x: node.baseX + offset.dx,
        y: node.baseY + offset.dy,
        shape: ov.shape || globalShape,
        color: ov.color || dnaColor,
        bg: (ov.color || dnaColor) + '12',
        parentX: parentCat?.x || CX,
        parentY: parentCat?.y || CY,
        parentColor: dnaColor,
        sticker: design?.stickerMap?.[node.id] || null,
      };
    });

    // Collector nodes
    const collectors = [];
    let collectorIdx = 0;
    tasks.forEach(task => {
      if (!task.is_collector) return;
      const ov = design?.getNodeOverride?.(task.id) || {};
      const collectorColor = ov.color || branchColors.P1 || '#00A3E0';
      collectors.push({
        id: task.id,
        x: CX + (collectorIdx % 2 === 0 ? -90 : 90),
        y: CY + 220 + (collectorIdx * 50),
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
      collectorIdx++;
    });

    // Filter out collector duplicates from task nodes
    const collectorIds = new Set(collectors.map(c => c.id));
    const filteredTasks = tNodes.filter(n => !collectorIds.has(n.id));

    return { categoryNodes: catNodes, taskNodes: filteredTasks, collectorNodes: collectors };
  }, [baseCatNodes, baseTaskNodes, dragOffsets, design?.nodeOverrides, design?.stickerMap, globalShape, branchColors, tasks]);

  const allNodes = useMemo(() =>
    [...categoryNodes, ...taskNodes, ...collectorNodes],
    [categoryNodes, taskNodes, collectorNodes]
  );

  // ── Visible nodes (respect collapse) ──
  const visibleTaskNodes = useMemo(() =>
    taskNodes.filter(n => !collapsedCats.has(n.catIndex)),
    [taskNodes, collapsedCats]
  );

  // ── Zoom wheel handler ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom(prev => Math.min(3, Math.max(0.3, prev + delta)));
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, []);

  // ── SVG coordinate conversion ──
  const screenToSVG = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = VB_W / rect.width;
    const scaleY = VB_H / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  // ── Drag handlers (parent-child sticky movement) ──
  const handleDragStart = useCallback((e, catIndex) => {
    e.stopPropagation();
    e.preventDefault();
    const svgPt = screenToSVG(e.clientX, e.clientY);
    const offset = dragOffsets[catIndex] || { dx: 0, dy: 0 };
    dragRef.current = { active: true, catIndex, startX: svgPt.x, startY: svgPt.y, origDx: offset.dx, origDy: offset.dy };
  }, [dragOffsets, screenToSVG]);

  const handleMouseMove = useCallback((e) => {
    // Pan handling
    if (panRef.current.active) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({ x: panRef.current.origPanX + dx, y: panRef.current.origPanY + dy });
      return;
    }
    // Drag handling
    if (!dragRef.current.active) return;
    const svgPt = screenToSVG(e.clientX, e.clientY);
    const dx = svgPt.x - dragRef.current.startX;
    const dy = svgPt.y - dragRef.current.startY;
    setDragOffsets(prev => ({
      ...prev,
      [dragRef.current.catIndex]: {
        dx: dragRef.current.origDx + dx,
        dy: dragRef.current.origDy + dy,
      },
    }));
  }, [screenToSVG]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
    panRef.current.active = false;
  }, []);

  // ── Pan (middle-click or background drag) ──
  const handleBgMouseDown = useCallback((e) => {
    // Only pan on background click (not on nodes)
    if (e.button === 1 || (e.button === 0 && e.target === svgRef.current)) {
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, origPanX: pan.x, origPanY: pan.y };
    }
  }, [pan]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Collapse/Expand toggle ──
  const toggleCollapse = useCallback((catIndex, e) => {
    e.stopPropagation();
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(catIndex)) next.delete(catIndex);
      else next.add(catIndex);
      return next;
    });
  }, []);

  // ── Auto-Layout: reset all drag offsets ──
  const handleAutoLayout = useCallback(() => {
    setDragOffsets({});
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // ── Zoom-to-Fit: compute bounding box and scale ──
  const handleZoomToFit = useCallback(() => {
    if (allNodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allNodes.forEach(n => {
      const r = n.r || 30;
      minX = Math.min(minX, n.x - r);
      minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r);
      maxY = Math.max(maxY, n.y + r);
    });
    const contentW = maxX - minX + 100;
    const contentH = maxY - minY + 100;
    const fitZoom = Math.min(VB_W / contentW, VB_H / contentH, 2);
    setZoom(Math.max(0.3, fitZoom));
    setPan({ x: 0, y: 0 });
  }, [allNodes]);

  // ── Node click handler ──
  const handleNodeClick = useCallback((e, nodeId) => {
    e.stopPropagation();
    if (dragRef.current.active) return; // ignore if dragging
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return;
    const scaleX = rect.width / VB_W;
    const scaleY = rect.height / VB_H;
    const screenX = rect.left + node.x * scaleX * zoom + pan.x;
    const screenY = rect.top + node.y * scaleY * zoom + pan.y;

    if (selectedNode === nodeId) {
      setSelectedNode(null);
    } else {
      setSelectedNode(nodeId);
      setToolbarPos({ x: screenX, y: screenY });
      // Notify Design Engine of selection
      window.dispatchEvent(new CustomEvent('calmplan:node-selected', { detail: { nodeId } }));
    }
    setFocusedNode(prev => prev === nodeId ? null : nodeId);
  }, [allNodes, selectedNode, zoom, pan]);

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
    const childNodes = taskNodes.filter(n => n.catIndex === parentNode.catIndex);
    childNodes.forEach(child => {
      design.setNodeOverride(child.id, parentOv);
    });
  }, [selectedNode, allNodes, taskNodes, design]);

  const selectedNodeData = allNodes.find(n => n.id === selectedNode);

  // Computed viewBox for zoom
  const vbX = (VB_W - VB_W / zoom) / 2 - pan.x / zoom;
  const vbY = (VB_H - VB_H / zoom) / 2 - pan.y / zoom;
  const vbW = VB_W / zoom;
  const vbH = VB_H / zoom;

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ overflow: 'hidden' }}>
      {/* ── Control Bar: Auto-Layout, Zoom-to-Fit, Zoom level ── */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button onClick={handleAutoLayout}
          className="px-3 py-1.5 rounded-xl bg-white shadow-lg border text-[10px] font-bold hover:bg-gray-50 transition-all"
          style={{ borderColor: '#E2E8F0', color: '#475569' }}
          title="סידור אוטומטי">
          סדר מחדש
        </button>
        <button onClick={handleZoomToFit}
          className="px-3 py-1.5 rounded-xl bg-white shadow-lg border text-[10px] font-bold hover:bg-gray-50 transition-all"
          style={{ borderColor: '#E2E8F0', color: '#475569' }}
          title="התאם לגודל">
          התאם תצוגה
        </button>
        <div className="flex items-center gap-1 bg-white rounded-xl shadow-lg border px-2 py-1" style={{ borderColor: '#E2E8F0' }}>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}
            className="w-6 h-6 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors text-gray-600">-</button>
          <span className="text-[10px] font-bold text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.15))}
            className="w-6 h-6 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors text-gray-600">+</button>
        </div>
      </div>

      <svg ref={svgRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)', cursor: panRef.current.active ? 'grabbing' : 'grab' }}
        onMouseDown={handleBgMouseDown}
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
          <filter id="sel-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#E91E63" floodOpacity="0.35" />
          </filter>
          <radialGradient id="map-center-grad">
            <stop offset="0%" stopColor="#FFC107" />
            <stop offset="70%" stopColor="#FF9800" />
            <stop offset="100%" stopColor="#E65100" />
          </radialGradient>
        </defs>

        {/* Branches: center → categories */}
        {categoryNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          const conn = getConnectionProps(
            globalLineStyle, CX, CY, node.x, node.y, node.color,
            isBlurred ? 0.06 : 0.45,
            { startWidth: 8, endWidth: 3, strokeWidth: 3 }
          );
          return <path key={`br-${node.id}`} {...conn.props} style={{ transition: 'opacity 0.4s ease' }} />;
        })}

        {/* Branches: categories → tasks (hidden if collapsed) */}
        {visibleTaskNodes.map(node => {
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          const conn = getConnectionProps(
            globalLineStyle, node.parentX, node.parentY, node.x, node.y,
            node.parentColor || node.color,
            isBlurred ? 0.04 : 0.3,
            { startWidth: 4, endWidth: 1, strokeWidth: 2 }
          );
          return <path key={`br-t-${node.id}`} {...conn.props} style={{ transition: 'opacity 0.4s ease' }} />;
        })}

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={52} fill="url(#map-center-grad)" filter="url(#map-glow)" />
        <text x={CX} y={CY - 8} textAnchor="middle" fill="white" fontSize="18" fontWeight="800">{centerLabel}</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="white" fontSize="12" fontWeight="600">
          {centerSub || `${tasks.length} משימות`}
        </text>

        {/* Category nodes (always visible) */}
        {categoryNodes.map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          const isActive = activeBranches.has(node.label) || activeBranches.has(node.fullLabel);
          const isCollapsed = collapsedCats.has(node.catIndex);
          return (
            <g key={node.id}
              onMouseDown={(e) => { if (e.button === 0) handleDragStart(e, node.catIndex); }}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'grab',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#map-blur)' : isSelected ? 'url(#sel-glow)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}>
              {/* Status Sync: pulsing ring */}
              {isActive && !isBlurred && (
                <circle cx={node.x} cy={node.y} r={node.r + 12}
                  fill="none" stroke={node.color} strokeWidth={2} strokeDasharray="8 4">
                  <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Selection glow ring */}
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke={node.color} strokeWidth={2.5} opacity={0.7}>
                  <animate attributeName="opacity" values="0.7;0.4;0.7" dur="1.5s" repeatCount="indefinite" />
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
              {/* ── Collapse/Expand toggle ── */}
              <g onClick={(e) => toggleCollapse(node.catIndex, e)} style={{ cursor: 'pointer' }}>
                <circle cx={node.x + node.r - 2} cy={node.y - node.r + 2} r={9}
                  fill="white" stroke={node.color} strokeWidth={1.5} />
                <text x={node.x + node.r - 2} y={node.y - node.r + 6}
                  textAnchor="middle" fontSize="12" fontWeight="900" fill={node.color}
                  style={{ pointerEvents: 'none' }}>
                  {isCollapsed ? '+' : '−'}
                </text>
              </g>
            </g>
          );
        })}

        {/* Task nodes (hidden if parent collapsed) */}
        {visibleTaskNodes.map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          return (
            <g key={node.id}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'filter 0.4s ease, opacity 0.4s ease',
                filter: isBlurred ? 'url(#map-blur)' : isSelected ? 'url(#sel-glow)' : 'none',
                opacity: isBlurred ? 0.25 : 1,
              }}>
              {/* Selection glow ring */}
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 7}
                  fill="none" stroke={node.color} strokeWidth={2} opacity={0.6}>
                  <animate attributeName="opacity" values="0.6;0.3;0.6" dur="1.5s" repeatCount="indefinite" />
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

        {/* ── Collector nodes ── */}
        {collectorNodes.map(cNode => {
          const isSelected = selectedNode === cNode.id;
          return (
            <g key={`collector-${cNode.id}`}>
              {/* Converging dependency lines */}
              {cNode.dependency_ids.map(depId => {
                const depNode = taskNodes.find(n => n.id === depId);
                if (!depNode) return null;
                return (
                  <path key={`dep-${depId}-${cNode.id}`}
                    d={`M ${depNode.x} ${depNode.y} C ${depNode.x} ${depNode.y + 50} ${cNode.x} ${cNode.y - 50} ${cNode.x} ${cNode.y}`}
                    fill="none" stroke={cNode.color} strokeWidth={1.5}
                    strokeDasharray="6 4" opacity={0.4} />
                );
              })}
              {/* Selection glow */}
              {isSelected && (
                <circle cx={cNode.x} cy={cNode.y} r={cNode.r + 8}
                  fill="none" stroke={cNode.color} strokeWidth={2} opacity={0.6}>
                  <animate attributeName="opacity" values="0.6;0.3;0.6" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Lock pulse */}
              {cNode.isLocked && (
                <circle cx={cNode.x} cy={cNode.y} r={cNode.r + 5}
                  fill="none" stroke="#FF8F00" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.4}>
                  <animate attributeName="opacity" values="0.4;0.15;0.4" dur="3s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Collector body */}
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

      {/* ── Clear focus button ── */}
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
