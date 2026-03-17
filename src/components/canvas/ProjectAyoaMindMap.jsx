/**
 * ── ProjectAyoaMindMap ──
 * Ayoa-style mind map specifically for the Projects page.
 *
 * Visual style (matching Ayoa reference):
 *   - Large purple center node
 *   - Status categories as colored rounded-rect branch nodes
 *   - Projects as leaf nodes with thick colored organic curves
 *   - Each status branch has its own vibrant color
 *   - Tapered bezier curves (thick→thin), NOT dashed lines
 *   - Click project node → navigate to workbook
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

const VB_W = 1200, VB_H = 800;
const CX = VB_W / 2, CY = VB_H / 2;

/* ── Branch colors per status ── */
const BRANCH_COLORS = {
  planning:       { fill: '#7C3AED', stroke: '#7C3AED', light: '#EDE9FE', label: 'תכנון',    emoji: '📋' },
  in_development: { fill: '#3B82F6', stroke: '#3B82F6', light: '#DBEAFE', label: 'בפיתוח',   emoji: '🔨' },
  testing:        { fill: '#F59E0B', stroke: '#F59E0B', light: '#FEF3C7', label: 'בדיקות',   emoji: '🧪' },
  deployed:       { fill: '#10B981', stroke: '#10B981', light: '#D1FAE5', label: 'באוויר',   emoji: '🚀' },
  maintenance:    { fill: '#EC4899', stroke: '#EC4899', light: '#FCE7F3', label: 'תחזוקה',   emoji: '🔧' },
  archived:       { fill: '#9CA3AF', stroke: '#9CA3AF', light: '#F3F4F6', label: 'ארכיון',   emoji: '📦' },
};

/* ── Organic bezier curve path (thick tapered branch) ── */
function branchPath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Organic curve with control points offset perpendicular
  const cx1 = x1 + dx * 0.4;
  const cy1 = y1 + dy * 0.1;
  const cx2 = x1 + dx * 0.6;
  const cy2 = y2 - dy * 0.1;
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

/* ── Layout engine ── */
function computeLayout(projects) {
  // Group by status
  const groups = {};
  const statusOrder = ['planning', 'in_development', 'testing', 'deployed', 'maintenance', 'archived'];

  statusOrder.forEach(s => { groups[s] = []; });
  projects.forEach(p => {
    const status = p.status || 'planning';
    if (!groups[status]) groups[status] = [];
    groups[status].push(p);
  });

  // Remove empty groups
  const activeStatuses = statusOrder.filter(s => groups[s].length > 0);
  const branchCount = activeStatuses.length;
  if (branchCount === 0) return { branches: [], leaves: [] };

  // Distribute branches evenly around center
  const angleStep = (2 * Math.PI) / Math.max(branchCount, 1);
  const branchRadius = 220;
  const leafBaseRadius = 160;

  const branches = [];
  const leaves = [];

  activeStatuses.forEach((status, bi) => {
    const angle = -Math.PI / 2 + bi * angleStep;
    const bx = CX + Math.cos(angle) * branchRadius;
    const by = CY + Math.sin(angle) * branchRadius;
    const color = BRANCH_COLORS[status] || BRANCH_COLORS.planning;

    branches.push({
      id: `branch-${status}`,
      status,
      x: bx, y: by,
      angle,
      color,
      count: groups[status].length,
    });

    // Leaf nodes fan out from branch
    const leafCount = groups[status].length;
    const maxLeaves = Math.min(leafCount, 8);
    const fanSpread = Math.min(Math.PI * 0.6, angleStep * 0.8);
    const fanStart = angle - fanSpread / 2;

    groups[status].slice(0, maxLeaves).forEach((proj, li) => {
      const leafAngle = maxLeaves > 1
        ? fanStart + (fanSpread * li) / (maxLeaves - 1)
        : angle;
      const radiusJitter = (li % 3) * 25;
      const lr = leafBaseRadius + radiusJitter;
      const lx = bx + Math.cos(leafAngle) * lr;
      const ly = by + Math.sin(leafAngle) * lr;

      leaves.push({
        id: proj.id,
        project: proj,
        x: lx, y: ly,
        parentX: bx, parentY: by,
        status,
        color,
      });
    });
  });

  return { branches, leaves };
}

export default function ProjectAyoaMindMap({ projects = [], onClickProject }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);

  const { branches, leaves } = useMemo(() => computeLayout(projects), [projects]);

  // Zoom handler
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      setZoom(z => Math.min(3, Math.max(0.3, z + (e.deltaY > 0 ? -0.08 : 0.08))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Pan handlers
  const onBgDown = useCallback((e) => {
    if (e.target === svgRef.current || e.target.tagName === 'rect') {
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
    }
  }, [pan]);

  useEffect(() => {
    const move = (e) => {
      if (!panRef.current.active) return;
      setPan({
        x: panRef.current.origX + (e.clientX - panRef.current.startX),
        y: panRef.current.origY + (e.clientY - panRef.current.startY),
      });
    };
    const up = () => { panRef.current.active = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="text-5xl mb-3">🗺️</div>
          <p className="text-sm font-bold text-gray-500">אין פרויקטים להצגה</p>
        </div>
      </div>
    );
  }

  const vbX = (VB_W - VB_W / zoom) / 2 - pan.x / zoom;
  const vbY = (VB_H - VB_H / zoom) / 2 - pan.y / zoom;
  const vbW = VB_W / zoom;
  const vbH = VB_H / zoom;

  return (
    <div ref={containerRef} className="relative w-full" style={{ overflow: 'hidden', minHeight: '550px', background: 'linear-gradient(180deg, #FAFBFF 0%, #F5F3FF08 50%, #FAFBFF 100%)' }}>
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button onClick={resetView}
          className="px-3 py-1.5 rounded-2xl bg-white/90 backdrop-blur shadow-lg border border-purple-100 text-[12px] font-bold text-purple-700 hover:bg-purple-50 transition-all">
          סדר מחדש
        </button>
        <div className="flex items-center gap-1 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-purple-100 px-2 py-1">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}
            className="w-6 h-6 rounded-lg text-sm font-bold hover:bg-purple-50 transition-colors text-purple-600">−</button>
          <span className="text-[11px] font-bold text-purple-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.15))}
            className="w-6 h-6 rounded-lg text-sm font-bold hover:bg-purple-50 transition-colors text-purple-600">+</button>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 bg-white/80 backdrop-blur rounded-2xl px-3 py-1.5 shadow border border-gray-100">
        {Object.entries(BRANCH_COLORS).filter(([k]) => branches.some(b => b.status === k)).map(([status, c]) => (
          <div key={status} className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: c.fill }}>
            <div className="w-3 h-3 rounded-full" style={{ background: c.fill }} />
            {c.label}
          </div>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="w-full h-full"
        style={{ minHeight: '550px', cursor: panRef.current.active ? 'grabbing' : 'grab' }}
        onMouseDown={onBgDown}
      >
        <defs>
          {/* Center glow */}
          <radialGradient id="pm-center-grad">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="60%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#5B21B6" />
          </radialGradient>
          <filter id="pm-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#7C3AED" floodOpacity="0.15" />
          </filter>
          <filter id="pm-leaf-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.06" />
          </filter>
          <filter id="pm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background click target */}
        <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="transparent" />

        {/* ── BRANCHES: Center → Category (thick organic curves) ── */}
        {branches.map(b => (
          <path
            key={`branch-${b.id}`}
            d={branchPath(CX, CY, b.x, b.y)}
            fill="none"
            stroke={b.color.fill}
            strokeWidth={8}
            strokeLinecap="round"
            opacity={0.35}
            style={{ transition: 'opacity 0.3s' }}
          />
        ))}

        {/* ── SUB-BRANCHES: Category → Leaf projects (thinner colored curves) ── */}
        {leaves.map(leaf => (
          <path
            key={`sub-${leaf.id}`}
            d={branchPath(leaf.parentX, leaf.parentY, leaf.x, leaf.y)}
            fill="none"
            stroke={leaf.color.fill}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={hoveredNode === leaf.id ? 0.6 : 0.2}
            style={{ transition: 'opacity 0.3s' }}
          />
        ))}

        {/* ── CENTER NODE ── */}
        <g filter="url(#pm-shadow)">
          <circle cx={CX} cy={CY} r={60} fill="url(#pm-center-grad)" />
          {/* Outer pulse ring */}
          <circle cx={CX} cy={CY} r={68} fill="none" stroke="#A78BFA" strokeWidth={2} opacity={0.3}>
            <animate attributeName="r" values="68;74;68" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.1;0.3" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>
        <text x={CX} y={CY - 10} textAnchor="middle" fill="white" fontSize="20" fontWeight="900"
          style={{ fontFamily: 'system-ui, sans-serif' }}>
          פרויקטים
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="white" fontSize="13" fontWeight="600" opacity={0.9}>
          P6
        </text>
        <text x={CX} y={CY + 28} textAnchor="middle" fill="white" fontSize="10" fontWeight="500" opacity={0.7}>
          {projects.length} פרויקטים
        </text>

        {/* ── CATEGORY BRANCH NODES (rounded rects) ── */}
        {branches.map(b => {
          const w = 120, h = 50, rx = 18;
          return (
            <g key={b.id} style={{ cursor: 'default' }}>
              {/* Colored background rounded rect */}
              <rect
                x={b.x - w / 2} y={b.y - h / 2}
                width={w} height={h}
                rx={rx} ry={rx}
                fill={b.color.light}
                stroke={b.color.fill}
                strokeWidth={2.5}
                filter="url(#pm-leaf-shadow)"
              />
              {/* Status emoji + label */}
              <text x={b.x} y={b.y - 5} textAnchor="middle" fontSize="13" fontWeight="800" fill={b.color.fill}
                style={{ fontFamily: 'system-ui, sans-serif' }}>
                {b.color.emoji} {b.color.label}
              </text>
              <text x={b.x} y={b.y + 13} textAnchor="middle" fontSize="11" fontWeight="600" fill={b.color.fill} opacity={0.7}>
                {b.count} {b.count === 1 ? 'פרויקט' : 'פרויקטים'}
              </text>
            </g>
          );
        })}

        {/* ── LEAF PROJECT NODES (rounded rects, clickable) ── */}
        {leaves.map(leaf => {
          const isHovered = hoveredNode === leaf.id;
          const w = 130, h = 40, rx = 14;
          const name = leaf.project.name || 'פרויקט';
          const displayName = name.length > 14 ? name.substring(0, 13) + '…' : name;

          return (
            <g
              key={leaf.id}
              onClick={(e) => { e.stopPropagation(); onClickProject?.(leaf.project); }}
              onMouseEnter={() => setHoveredNode(leaf.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Hover glow */}
              {isHovered && (
                <rect
                  x={leaf.x - w / 2 - 3} y={leaf.y - h / 2 - 3}
                  width={w + 6} height={h + 6}
                  rx={rx + 2} ry={rx + 2}
                  fill="none"
                  stroke={leaf.color.fill}
                  strokeWidth={2}
                  opacity={0.4}
                />
              )}
              {/* Card background */}
              <rect
                x={leaf.x - w / 2} y={leaf.y - h / 2}
                width={w} height={h}
                rx={rx} ry={rx}
                fill="white"
                stroke={isHovered ? leaf.color.fill : '#E2E8F0'}
                strokeWidth={isHovered ? 2 : 1.5}
                filter="url(#pm-leaf-shadow)"
                style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
              />
              {/* Color dot */}
              <circle
                cx={leaf.x + w / 2 - 14} cy={leaf.y}
                r={4}
                fill={leaf.color.fill}
              />
              {/* Project name */}
              <text
                x={leaf.x - 4} y={leaf.y + 1}
                textAnchor="middle" fontSize="11" fontWeight="700"
                fill={isHovered ? leaf.color.fill : '#1E293B'}
                style={{ fontFamily: 'system-ui, sans-serif', transition: 'fill 0.2s' }}
              >
                {displayName}
              </text>
              {/* Tech stack hint */}
              {leaf.project.tech_stack && (
                <text
                  x={leaf.x - 4} y={leaf.y + 14}
                  textAnchor="middle" fontSize="8" fontWeight="500"
                  fill="#94A3B8"
                >
                  {leaf.project.tech_stack.split(',').slice(0, 2).join(' · ').substring(0, 20)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
