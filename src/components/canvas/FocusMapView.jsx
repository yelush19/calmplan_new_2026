/**
 * ── FocusMapView: Dynamic Daily Action Map ──
 *
 * DISTINCT from the Architect Map (AyoaRadialView/AyoaMapView):
 *   - Architect Map = Full Database, static, all services, cool tones
 *   - Focus Map = Daily Action only, dynamic filtering, warm tones
 *
 * Law 2 Compliance:
 *   1. Dynamic Filtering: ONLY shows tasks whose prerequisites are met
 *   2. Visual Hierarchy: Bubble size scales by Cognitive Load duration
 *   3. Locked tasks shown as ghost outlines (not hidden, but clearly locked)
 *
 * AYOA Aesthetic:
 *   - Warm gradient center (sunrise orange → gold)
 *   - Organic tapered bezier branches
 *   - Pulsing glow on actionable tasks
 *   - Ghost/locked tasks at reduced opacity with lock indicator
 *   - Bubble radius = f(cognitiveLoad) via COMPLEXITY_TIERS.bubbleScale
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { renderNodeShape } from './AyoaNode';
import { getConnectionProps } from '@/engines/lineStyleEngine';
import { useDesign } from '@/contexts/DesignContext';
import { getServiceWeight } from '@/config/serviceWeights';
import { COMPLEXITY_TIERS, LOAD_COLORS } from '@/lib/theme-constants';
import { areDependenciesMet } from '@/engines/taskCascadeEngine';
import { computeCognitiveLoad } from '@/engines/automationEngine';

const VB = 1000;
const CX = VB / 2, CY = VB / 2;

// Default Focus DNA — overridden by Design Engine branchColors
const FOCUS_DNA_DEFAULTS = {
  P1: '#0288D1', P2: '#7B6B43', P3: '#B45309', P4: '#FACC15', P5: '#2E7D32',
};

// Ring radii — tighter than Architect for "actionable focus"
const RINGS = {
  center: 60,
  unlocked: 220,   // Actionable tasks — inner ring (close to center)
  locked: 380,     // Blocked tasks — outer ring (pushed away)
};

// Cognitive load → bubble radius multiplier (Law 2 requirement)
function getCognitiveRadius(task, baseR = 18) {
  const sw = getServiceWeight(task.category);
  const load = typeof task.cognitive_load === 'number' ? task.cognitive_load : sw.cognitiveLoad;
  const tier = Math.min(3, Math.max(0, load));
  const scale = COMPLEXITY_TIERS[tier]?.bubbleScale || 1.0;
  return { r: Math.round(baseR * scale), load, duration: sw.duration, tierLabel: COMPLEXITY_TIERS[tier]?.label || '' };
}

function getCategoryColor(category, branchColors) {
  const c = branchColors || FOCUS_DNA_DEFAULTS;
  if (!category) return c.P3;
  const cat = (category || '').toLowerCase();
  if (cat.includes('שכר') || cat.includes('payroll') || cat.includes('ניכויים') || cat.includes('ביטוח') || cat.includes('מס"ב')) return c.P1;
  if (cat.includes('מע"מ') || cat.includes('vat') || cat.includes('הנה"ח') || cat.includes('bookkeeping') || cat.includes('מקדמות') || cat.includes('התאמות')) return c.P2;
  if (cat.includes('מאזנ') || cat.includes('דוח שנתי') || cat.includes('הצהרת הון')) return c.P5;
  if (cat.includes('home') || cat.includes('ארוחות') || cat.includes('אישי') || cat.includes('בית')) return c.P4;
  return c.P3;
}

const STATUS_COLORS = {
  waiting_for_materials: '#FF8F00',
  not_started: '#1565C0',
  sent_for_review: '#7B1FA2',
  needs_corrections: '#E65100',
  production_completed: '#2E7D32',
};

export default function FocusMapView({
  tasks = [],
  allTasks,
  centerLabel = 'פוקוס יומי',
  centerSub = '',
}) {
  const svgRef = useRef(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Design engine (safe — useDesign returns fallback if outside provider)
  const design = useDesign();
  const globalShape = design.shape || 'bubble';
  const globalLineStyle = design.lineStyle || 'tapered';
  const branchColors = design.branchColors || FOCUS_DNA_DEFAULTS;

  // All sibling tasks for dependency checking — use allTasks if provided, else tasks
  const siblingPool = allTasks || tasks;

  // Guard clause: if no tasks or design not ready, show loading state
  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[300px]">
        <div className="text-center">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm font-bold" style={{ color: 'var(--cp-text-secondary, #64748B)' }}>
            אין משימות להציג
          </div>
        </div>
      </div>
    );
  }

  // Cognitive load alert
  const cogLoadThreshold = design?.cognitiveLoadLimit || 480;
  const cogLoad = useMemo(() => computeCognitiveLoad(tasks, cogLoadThreshold), [tasks, cogLoadThreshold]);

  const { unlockedNodes, lockedNodes, categoryNodes, stats } = useMemo(() => {
    const unlocked = [];
    const locked = [];
    const catMap = {};
    let unlockedCount = 0;
    let lockedCount = 0;
    let totalMinutes = 0;

    // Classify tasks: unlocked (prerequisites met) vs locked (prerequisites NOT met)
    tasks.forEach(task => {
      if (task.status === 'production_completed') return; // Skip completed

      const depsOk = areDependenciesMet(task, siblingPool);
      const { r, load, duration, tierLabel } = getCognitiveRadius(task);
      const ov = design?.getNodeOverride?.(task.id) || {};
      const color = ov.color || getCategoryColor(task.category, branchColors);
      const cat = task.category || 'כללי';

      if (!catMap[cat]) catMap[cat] = { unlocked: 0, locked: 0, color };

      const nodeData = {
        id: task.id,
        label: task.title || '',
        subLabel: task.client_name || '',
        category: cat,
        r,
        color,
        shape: ov.shape || globalShape,
        load,
        duration,
        tierLabel,
        status: task.status || 'not_started',
        statusColor: STATUS_COLORS[task.status] || '#546E7A',
        sticker: design?.stickerMap?.[task.id] || null,
      };

      if (depsOk) {
        unlocked.push(nodeData);
        catMap[cat].unlocked++;
        unlockedCount++;
        totalMinutes += duration;
      } else {
        locked.push(nodeData);
        catMap[cat].locked++;
        lockedCount++;
      }
    });

    // Position unlocked nodes in inner ring — spread by category
    const catEntries = Object.entries(catMap);
    const catCount = catEntries.length || 1;
    const catAngleStep = (2 * Math.PI) / catCount;

    // Build category aggregate nodes
    const catNodes = catEntries.map(([cat, data], ci) => {
      const angle = -Math.PI / 2 + ci * catAngleStep;
      return {
        id: `fcat-${ci}`,
        label: cat.substring(0, 14),
        count: data.unlocked + data.locked,
        unlockedCount: data.unlocked,
        lockedCount: data.locked,
        color: data.color,
        angle,
        x: CX + Math.cos(angle) * (RINGS.center + 55),
        y: CY + Math.sin(angle) * (RINGS.center + 55),
        r: 28,
      };
    });

    // Position unlocked task nodes around their category
    let uIdx = 0;
    catEntries.forEach(([cat, data], ci) => {
      const baseAngle = -Math.PI / 2 + ci * catAngleStep;
      const catUnlocked = unlocked.filter(n => n.category === cat);
      const spread = Math.min(catAngleStep * 0.8, Math.PI * 0.5);

      catUnlocked.forEach((node, ti) => {
        const taskAngle = catUnlocked.length > 1
          ? baseAngle - spread / 2 + (spread * ti) / (catUnlocked.length - 1)
          : baseAngle;
        const jitter = (ti % 3) * 25;
        node.x = CX + Math.cos(taskAngle) * (RINGS.unlocked + jitter);
        node.y = CY + Math.sin(taskAngle) * (RINGS.unlocked + jitter);
        node.parentAngle = baseAngle;
        uIdx++;
      });
    });

    // Position locked task nodes in outer ring — dimmed ghost zone
    catEntries.forEach(([cat, data], ci) => {
      const baseAngle = -Math.PI / 2 + ci * catAngleStep;
      const catLocked = locked.filter(n => n.category === cat);
      const spread = Math.min(catAngleStep * 0.7, Math.PI * 0.4);

      catLocked.forEach((node, ti) => {
        const taskAngle = catLocked.length > 1
          ? baseAngle - spread / 2 + (spread * ti) / (catLocked.length - 1)
          : baseAngle;
        const jitter = (ti % 2) * 20;
        node.x = CX + Math.cos(taskAngle) * (RINGS.locked + jitter);
        node.y = CY + Math.sin(taskAngle) * (RINGS.locked + jitter);
        node.parentAngle = baseAngle;
      });
    });

    return {
      unlockedNodes: unlocked,
      lockedNodes: locked,
      categoryNodes: catNodes,
      stats: { unlockedCount, lockedCount, totalMinutes },
    };
  }, [tasks, siblingPool, design?.nodeOverrides, design?.stickerMap, branchColors, globalShape]);

  const handleNodeClick = useCallback((e, nodeId) => {
    e.stopPropagation();
    setFocusedNode(prev => prev === nodeId ? null : nodeId);
    if (selectedNode === nodeId) {
      setSelectedNode(null);
    } else {
      setSelectedNode(nodeId);
      // Notify Design Engine of selection (global activeTaskId)
      window.dispatchEvent(new CustomEvent('calmplan:node-selected', { detail: { nodeId } }));
    }
  }, [selectedNode]);

  return (
    <div className="relative w-full h-full" style={{
      backgroundColor: 'var(--cp-canvas-bg, #F8F9FA)',
      border: cogLoad.overloaded ? '3px solid #EF4444' : cogLoad.percentage >= 80 ? '2px solid #F59E0B' : 'none',
      borderRadius: cogLoad.percentage >= 80 ? '16px' : undefined,
      transition: 'border 0.4s ease',
    }}>
      {cogLoad.overloaded && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-red-50 border border-red-300 text-red-700 text-xs font-bold shadow-md"
          style={{ animation: 'pulse 2s ease-in-out infinite' }}>
          עומס קוגניטיבי: {cogLoad.total} דק׳ / {cogLoad.threshold} דק׳ ({cogLoad.percentage}%)
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        className="w-full h-full"
        style={{ maxHeight: 'calc(100vh - 180px)' }}
        onClick={() => { setFocusedNode(null); setSelectedNode(null); }}
      >
        <defs>
          {/* Warm center glow — distinct from Architect's cool glow */}
          <radialGradient id="focus-center-grad">
            <stop offset="0%" stopColor="#FFF176" />
            <stop offset="40%" stopColor="#FFC107" />
            <stop offset="80%" stopColor="#FF9800" />
            <stop offset="100%" stopColor="#E65100" />
          </radialGradient>
          <radialGradient id="focus-bg-grad">
            <stop offset="0%" stopColor="#FFFDE7" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#FFF8E1" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <filter id="focus-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#FFC107" floodOpacity="0.35" />
          </filter>
          <filter id="focus-pulse" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#FF9800" floodOpacity="0.4" />
          </filter>
          <filter id="focus-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
          </filter>
          <filter id="focus-locked">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          <filter id="focus-sel-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#6366F1" floodOpacity="0.35" />
          </filter>
          {/* Cognitive load tier gradients */}
          {[0, 1, 2, 3].map(tier => {
            const lc = LOAD_COLORS[tier];
            return (
              <radialGradient key={`tier-${tier}`} id={`tier-grad-${tier}`}>
                <stop offset="0%" stopColor={lc.color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={lc.color} stopOpacity="0.05" />
              </radialGradient>
            );
          })}
        </defs>

        {/* Warm background radial — Focus Map identity */}
        <circle cx={CX} cy={CY} r={VB * 0.48} fill="url(#focus-bg-grad)" />

        {/* Unlocked zone ring guide */}
        <circle cx={CX} cy={CY} r={RINGS.unlocked}
          fill="none" stroke="#FFC10725" strokeWidth={1.5} strokeDasharray="8 6" />

        {/* Locked zone ring guide */}
        <circle cx={CX} cy={CY} r={RINGS.locked}
          fill="none" stroke="#90A4AE20" strokeWidth={1} strokeDasharray="4 8" />

        {/* Zone labels */}
        <text x={CX + RINGS.unlocked + 8} y={CY - 8} fontSize="9" fontWeight="700" fill="#E65100" opacity="0.6">
          אפשר לעשות עכשיו
        </text>
        <text x={CX + RINGS.locked + 8} y={CY - 8} fontSize="8" fontWeight="600" fill="#90A4AE" opacity="0.5">
          ממתין לתנאי קדם
        </text>

        {/* ── Branches: center → categories (uses Design Engine) ── */}
        {categoryNodes.map(node => {
          const conn = getConnectionProps(
            globalLineStyle, CX, CY, node.x, node.y, node.color, 0.35,
            { startWidth: 6, endWidth: 2, strokeWidth: 2.5 }
          );
          return <path key={`br-fcat-${node.id}`} {...conn.props} style={{ transition: 'opacity 0.4s' }} />;
        })}

        {/* ── Branches: categories → unlocked tasks (warm, visible) ── */}
        {unlockedNodes.map(node => {
          const parent = categoryNodes.find(c => Math.abs(c.angle - node.parentAngle) < 0.01);
          const px = parent ? parent.x : CX;
          const py = parent ? parent.y : CY;
          const isBlurred = focusedNode !== null && focusedNode !== node.id;
          const conn = getConnectionProps(
            globalLineStyle, px, py, node.x, node.y, node.color,
            isBlurred ? 0.06 : 0.3,
            { startWidth: 3.5, endWidth: 1, strokeWidth: 2 }
          );
          return <path key={`br-u-${node.id}`} {...conn.props} style={{ transition: 'opacity 0.4s' }} />;
        })}

        {/* ── Branches: categories → locked tasks (gray, faded — always dotted) ── */}
        {lockedNodes.map(node => {
          const parent = categoryNodes.find(c => Math.abs(c.angle - node.parentAngle) < 0.01);
          const px = parent ? parent.x : CX;
          const py = parent ? parent.y : CY;
          const conn = getConnectionProps(
            'dotted', px, py, node.x, node.y, '#B0BEC5', 0.12,
            { strokeWidth: 1.5 }
          );
          return <path key={`br-l-${node.id}`} {...conn.props} style={{ transition: 'opacity 0.4s' }} />;
        })}

        {/* ── Center hub (warm sunrise — Focus identity) ── */}
        <circle cx={CX} cy={CY} r={RINGS.center + 5} fill="none" stroke="#FFC10730" strokeWidth={2.5} />
        <circle cx={CX} cy={CY} r={RINGS.center} fill="url(#focus-center-grad)" filter="url(#focus-glow)">
          <animate attributeName="r" values={`${RINGS.center};${RINGS.center + 2};${RINGS.center}`}
            dur="4s" repeatCount="indefinite" />
        </circle>
        <text x={CX} y={CY - 14} textAnchor="middle" fill="white" fontSize="17" fontWeight="900">
          {centerLabel}
        </text>
        <text x={CX} y={CY + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="700">
          {stats.unlockedCount} משימות פתוחות
        </text>
        <text x={CX} y={CY + 18} textAnchor="middle" fill="#FFFFFF90" fontSize="10" fontWeight="600">
          ~{stats.totalMinutes} דק׳ עבודה
        </text>

        {/* ── Category nodes (uses Design Engine shape) ── */}
        {categoryNodes.map(node => (
          <g key={node.id}>
            {renderNodeShape(globalShape, node.x, node.y, node.r, node.color + '15', node.color, 2)}
            {renderNodeShape(globalShape, node.x, node.y, node.r - 3, 'white', 'none', 0)}
            <text x={node.x} y={node.y - 5} textAnchor="middle" fontSize="10" fontWeight="800" fill="#0F172A"
              style={{ pointerEvents: 'none' }}>
              {node.label}
            </text>
            <text x={node.x} y={node.y + 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={node.color}
              style={{ pointerEvents: 'none' }}>
              {node.unlockedCount > 0 ? `${node.unlockedCount} פעיל` : ''}
              {node.lockedCount > 0 ? ` | ${node.lockedCount} נעול` : ''}
            </text>
          </g>
        ))}

        {/* ── UNLOCKED task nodes (actionable — prominent, pulsing) ── */}
        {unlockedNodes.map(node => {
          const isFocused = focusedNode === node.id;
          const isBlurred = focusedNode !== null && !isFocused;
          const isSelected = selectedNode === node.id;
          const loadColor = LOAD_COLORS[node.load]?.color || '#546E7A';
          return (
            <g key={`u-${node.id}`}
              onClick={(e) => handleNodeClick(e, node.id)}
              style={{
                cursor: 'pointer',
                transition: 'opacity 0.4s, transform 0.3s',
                opacity: isBlurred ? 0.2 : 1,
                transform: isFocused ? 'scale(1.12)' : 'scale(1)',
                transformOrigin: `${node.x}px ${node.y}px`,
              }}>
              {/* Selection glow */}
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={node.r + 8}
                  fill="none" stroke="#6366F1" strokeWidth={2.5} opacity={0.7}>
                  <animate attributeName="opacity" values="0.7;0.3;0.7" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Cognitive load tier ring */}
              <circle cx={node.x} cy={node.y} r={node.r + 5}
                fill={`url(#tier-grad-${node.load})`} stroke={loadColor} strokeWidth={1} opacity={0.4} />
              {/* Status glow pulse */}
              <circle cx={node.x} cy={node.y} r={node.r + 3}
                fill="none" stroke={node.statusColor} strokeWidth={1.5} opacity={0.5}>
                <animate attributeName="opacity" values="0.5;0.2;0.5" dur="3s" repeatCount="indefinite" />
              </circle>
              {/* Main node — shape from Design Engine (per-node or global), size varies by cognitive load */}
              <g filter="url(#focus-shadow)">
                {renderNodeShape(node.shape, node.x, node.y, node.r, node.color + '18', node.color, 2)}
                {renderNodeShape(node.shape, node.x, node.y, node.r - 2, 'white', 'none', 0)}
              </g>
              {/* Duration badge */}
              <circle cx={node.x + node.r - 2} cy={node.y - node.r + 2} r={7}
                fill={loadColor} stroke="white" strokeWidth={1.5} />
              <text x={node.x + node.r - 2} y={node.y - node.r + 5.5} textAnchor="middle"
                fontSize="7" fontWeight="800" fill="white" style={{ pointerEvents: 'none' }}>
                {node.duration}
              </text>
              {/* Labels */}
              <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0F172A"
                style={{ pointerEvents: 'none' }}>
                {node.label.substring(0, 18)}
              </text>
              <text x={node.x} y={node.y + 8} textAnchor="middle" fontSize="8" fontWeight="600" fill={node.color}
                style={{ pointerEvents: 'none' }}>
                {node.subLabel ? node.subLabel.substring(0, 16) : ''}
              </text>
              {/* Tier label below */}
              <text x={node.x} y={node.y + node.r + 12} textAnchor="middle"
                fontSize="7" fontWeight="700" fill={loadColor} opacity={0.7}
                style={{ pointerEvents: 'none' }}>
                {node.tierLabel}
              </text>
              {/* Sticker from Design Engine */}
              {node.sticker && (
                <text x={node.x + node.r - 4} y={node.y + node.r - 4} textAnchor="middle"
                  fontSize="12" style={{ pointerEvents: 'none' }}>
                  {node.sticker}
                </text>
              )}
            </g>
          );
        })}

        {/* ── LOCKED task nodes (prerequisites not met — ghost outlines) ── */}
        {lockedNodes.map(node => (
          <g key={`l-${node.id}`} style={{ opacity: 0.3 }}>
            {/* Dashed outline = locked */}
            <circle cx={node.x} cy={node.y} r={node.r}
              fill="#F5F5F5" stroke="#B0BEC5" strokeWidth={1.5} strokeDasharray="4 3" />
            {/* Lock icon indicator */}
            <text x={node.x} y={node.y - 3} textAnchor="middle" fontSize="10" fill="#90A4AE"
              style={{ pointerEvents: 'none' }}>
              {node.label.substring(0, 14)}
            </text>
            <text x={node.x} y={node.y + 9} textAnchor="middle" fontSize="8" fill="#B0BEC5"
              style={{ pointerEvents: 'none' }}>
              ממתין לתנאי קדם
            </text>
          </g>
        ))}
      </svg>

      {/* Focus clear button */}
      {focusedNode !== null && (
        <button onClick={() => setFocusedNode(null)}
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white shadow-lg border text-xs font-bold hover:bg-gray-50 transition-all"
          style={{ color: '#FF9800' }}>
          ✕ הצג הכל
        </button>
      )}

      {/* Legend — Focus Map identity */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-amber-100">
        <div className="flex items-center gap-2 text-[12px] font-bold text-amber-800">
          <div className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #FFC107, #FF9800)' }} />
          גודל = מורכבות המשימה
        </div>
        <div className="flex items-center gap-3">
          {[0, 1, 2, 3].map(tier => {
            const t = COMPLEXITY_TIERS[tier];
            const lc = LOAD_COLORS[tier];
            return (
              <div key={tier} className="flex items-center gap-1">
                <div className="rounded-full border" style={{
                  width: 6 + tier * 4, height: 6 + tier * 4,
                  borderColor: lc.color, backgroundColor: lc.color + '20',
                }} />
                <span className="text-[11px] font-bold" style={{ color: lc.color }}>{t.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400" /> פעיל
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <div className="w-2 h-2 rounded-full border border-gray-300 border-dashed" /> נעול
          </span>
        </div>
      </div>
    </div>
  );
}
