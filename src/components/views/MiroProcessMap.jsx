/**
 * ── MiroProcessMap: Hierarchical Mind Map for Accounting Workflows ──
 *
 * Visual style: Miro-like mind map with:
 * - Central node (שכר / הנה"ח / מאזנים)
 * - Phase branches (שלב 1, 2, 3) radiating outward
 * - Service nodes under each phase
 * - Client task nodes as leaves
 * - Color coding by status (green=done, blue=active, gray=pending, amber=waiting)
 * - Click node → edit task / change status
 * - RTL layout (branches go right-to-left)
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { CheckCircle, Circle, Lock, Clock, AlertTriangle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_STYLES = {
  production_completed: { fill: '#DCFCE7', stroke: '#16A34A', text: '#15803D', label: 'הושלם', icon: '✅' },
  completed: { fill: '#DCFCE7', stroke: '#16A34A', text: '#15803D', label: 'הושלם', icon: '✅' },
  ready_to_broadcast: { fill: '#CCFBF1', stroke: '#0D9488', text: '#0F766E', label: 'מוכן לשידור', icon: '📡' },
  reported_pending_payment: { fill: '#E0E7FF', stroke: '#4F46E5', text: '#3730A3', label: 'ממתין לתשלום', icon: '💰' },
  sent_for_review: { fill: '#F3E8FF', stroke: '#7C3AED', text: '#6D28D9', label: 'הועבר לעיון', icon: '👁️' },
  needs_corrections: { fill: '#FEF3C7', stroke: '#D97706', text: '#92400E', label: 'לתיקון', icon: '⚠️' },
  waiting_for_materials: { fill: '#FEF3C7', stroke: '#D97706', text: '#92400E', label: 'ממתין לחומרים', icon: '⏳' },
  not_started: { fill: '#F3F4F6', stroke: '#9CA3AF', text: '#4B5563', label: 'טרם התחיל', icon: '⭕' },
};

const PHASE_COLORS = ['#00A3E0', '#0D9488', '#6366F1', '#F59E0B', '#7C3AED'];

// Layout constants
const NODE_W = 160;
const NODE_H = 44;
const CENTER_R = 50;
const PHASE_GAP_X = 220;
const SERVICE_GAP_Y = 70;
const CLIENT_GAP_Y = 36;
const CLIENT_OFFSET_X = 200;

export default function MiroProcessMap({
  tasks = [],
  phases = [],
  centerLabel = 'תהליך',
  centerSub = '',
  onEditTask,
  onStatusChange,
}) {
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedSummary, setExpandedSummary] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Build hierarchical layout
  const layout = useMemo(() => {
    if (!phases || phases.length === 0) return { nodes: [], edges: [] };

    const nodes = [];
    const edges = [];
    const centerX = 600;
    const centerY = 400;

    // Center node
    nodes.push({
      id: 'center',
      type: 'center',
      x: centerX,
      y: centerY,
      label: centerLabel,
      sub: centerSub,
    });

    let phaseY = centerY - ((phases.length - 1) * SERVICE_GAP_Y * 1.5) / 2;

    phases.forEach((phase, phaseIdx) => {
      const phaseX = centerX - PHASE_GAP_X;
      const phaseId = `phase_${phaseIdx}`;
      const phaseColor = PHASE_COLORS[phaseIdx % PHASE_COLORS.length];

      // Count tasks in this phase — match by service taskCategories OR direct category/key match
      const allPhaseCategories = (phase.services || []).flatMap(s => s.taskCategories || []);
      const allPhaseKeys = phase.serviceKeys || [];
      const phaseTasks = tasks.filter(t => {
        if (allPhaseCategories.includes(t.category)) return true;
        if (allPhaseKeys.includes(t.category)) return true;
        if (allPhaseKeys.includes(t.service_key)) return true;
        if (allPhaseKeys.includes(t.service_group)) return true;
        return false;
      });
      const completed = phaseTasks.filter(t => t.status === 'production_completed' || t.status === 'completed').length;

      nodes.push({
        id: phaseId,
        type: 'phase',
        x: phaseX,
        y: phaseY,
        label: phase.label,
        color: phaseColor,
        completed,
        total: phaseTasks.length,
      });

      // Edge from center to phase
      edges.push({ from: 'center', to: phaseId, color: phaseColor });

      // Service nodes under this phase
      let serviceY = phaseY - ((phase.services?.length || 1) - 1) * SERVICE_GAP_Y / 2;

      (phase.services || []).forEach((service, svcIdx) => {
        const svcX = phaseX - CLIENT_OFFSET_X;
        const svcId = `svc_${phaseIdx}_${svcIdx}`;

        const svcCats = service.taskCategories || [];
        const svcTasks = tasks.filter(t =>
          svcCats.includes(t.category) || t.service_key === service.key || t.service_group === service.key
        );
        const svcCompleted = svcTasks.filter(t => t.status === 'production_completed' || t.status === 'completed').length;

        nodes.push({
          id: svcId,
          type: 'service',
          x: svcX,
          y: serviceY,
          label: service.label,
          color: phaseColor,
          completed: svcCompleted,
          total: svcTasks.length,
        });

        edges.push({ from: phaseId, to: svcId, color: phaseColor + '60' });

        // Summary node — grouped clients instead of individual task nodes
        if (svcTasks.length > 0) {
          const summaryX = svcX - CLIENT_OFFSET_X;
          const summaryId = `summary_${phaseIdx}_${svcIdx}`;
          const waiting = svcTasks.filter(t => t.status === 'waiting_for_materials').length;
          const notStarted = svcTasks.filter(t => t.status === 'not_started').length;
          const inProgress = svcTasks.filter(t => !['production_completed', 'completed', 'not_started', 'waiting_for_materials'].includes(t.status)).length;

          nodes.push({
            id: summaryId,
            type: 'summary',
            x: summaryX,
            y: serviceY,
            tasks: svcTasks,
            completed: svcCompleted,
            waiting,
            notStarted,
            inProgress,
            total: svcTasks.length,
            color: phaseColor,
          });

          edges.push({ from: svcId, to: summaryId, color: phaseColor + '30' });
        }

        serviceY += Math.max(SERVICE_GAP_Y, svcTasks.length * CLIENT_GAP_Y + 20);
      });

      phaseY += Math.max(SERVICE_GAP_Y * 2, (phase.services?.length || 1) * SERVICE_GAP_Y * 1.5);
    });

    return { nodes, edges };
  }, [tasks, phases, centerLabel, centerSub]);

  // Pan handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('[data-clickable]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.3, Math.min(2, prev - e.deltaY * 0.001)));
  }, []);

  const resetView = useCallback(() => { setZoom(0.85); setPan({ x: 0, y: 0 }); }, []);

  if (layout.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">🗺️</div>
          <p className="text-sm font-medium">אין תהליכים להצגה</p>
          <p className="text-xs mt-1">הזריקי משימות כדי לראות את מפת התהליכים</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-white rounded-xl border overflow-hidden" style={{ height: '70vh', minHeight: '500px' }}>
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-white" onClick={() => setZoom(z => Math.min(2, z + 0.15))}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-white" onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-white" onClick={resetView}>
          <Maximize2 className="w-4 h-4" />
        </Button>
        <span className="text-xs text-gray-400 self-center ms-1">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Selected task panel */}
      {selectedTask && (
        <div className="absolute top-3 right-3 z-20 bg-white rounded-xl shadow-lg border p-3 max-w-[260px]">
          <div className="text-sm font-bold text-slate-800 mb-1">{selectedTask.title}</div>
          <div className="text-xs text-slate-400 mb-2">{selectedTask.client_name}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {['not_started', 'waiting_for_materials', 'ready_to_broadcast', 'production_completed'].map(s => {
              const st = STATUS_STYLES[s];
              return (
                <button key={s}
                  onClick={() => { onStatusChange?.(selectedTask, s); setSelectedTask(null); }}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border transition-all ${selectedTask.status === s ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
                  style={{ borderColor: st.stroke, color: st.text }}>
                  {st.icon} {st.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            {onEditTask && (
              <button onClick={() => { onEditTask(selectedTask); setSelectedTask(null); }}
                className="text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-1">
                ✏️ פתח
              </button>
            )}
            <button onClick={() => setSelectedTask(null)}
              className="text-xs text-gray-400 hover:text-gray-600 rounded-lg px-2 py-1">
              סגור
            </button>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {layout.edges.map((edge, idx) => {
            const fromNode = layout.nodes.find(n => n.id === edge.from);
            const toNode = layout.nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            const x1 = fromNode.type === 'center' ? fromNode.x - CENTER_R : fromNode.x - NODE_W / 2;
            const y1 = fromNode.y;
            const x2 = toNode.x + NODE_W / 2;
            const y2 = toNode.y;
            const cx1 = x1 - 60;
            const cx2 = x2 + 60;
            return (
              <path
                key={idx}
                d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={edge.color}
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Center node */}
          {layout.nodes.filter(n => n.type === 'center').map(node => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={CENTER_R}
                fill="url(#centerGrad)" stroke="#1E3A5F" strokeWidth={3} />
              <text x={node.x} y={node.y - 8} textAnchor="middle" fill="white" fontSize={16} fontWeight="bold">{node.label}</text>
              <text x={node.x} y={node.y + 12} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={11}>{node.sub}</text>
            </g>
          ))}

          {/* Phase nodes */}
          {layout.nodes.filter(n => n.type === 'phase').map(node => (
            <g key={node.id}>
              <rect x={node.x - NODE_W / 2} y={node.y - NODE_H / 2} width={NODE_W} height={NODE_H}
                rx={12} fill={node.color} stroke={node.color} strokeWidth={2} />
              <text x={node.x} y={node.y - 4} textAnchor="middle" fill="white" fontSize={13} fontWeight="bold"
                style={{ paintOrder: 'stroke', stroke: node.color, strokeWidth: 0 }}>
                {node.label}
              </text>
              <text x={node.x} y={node.y + 14} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={11}>
                {node.completed}/{node.total}
              </text>
            </g>
          ))}

          {/* Service nodes */}
          {layout.nodes.filter(n => n.type === 'service').map(node => (
            <g key={node.id}>
              <rect x={node.x - NODE_W / 2} y={node.y - NODE_H / 2} width={NODE_W} height={NODE_H}
                rx={10} fill="white" stroke={node.color} strokeWidth={2} />
              <text x={node.x} y={node.y - 2} textAnchor="middle" fill={node.color} fontSize={12} fontWeight="bold">
                {node.label}
              </text>
              <text x={node.x} y={node.y + 14} textAnchor="middle" fill="#9CA3AF" fontSize={10}>
                {node.completed}/{node.total}
              </text>
            </g>
          ))}

          {/* Summary nodes — grouped clients with status breakdown */}
          {layout.nodes.filter(n => n.type === 'summary').map(node => {
            const isExpanded = expandedSummary === node.id;
            const barW = 140;
            const completedPct = node.total > 0 ? (node.completed / node.total) * barW : 0;
            const inProgressPct = node.total > 0 ? (node.inProgress / node.total) * barW : 0;
            const waitingPct = node.total > 0 ? (node.waiting / node.total) * barW : 0;

            return (
              <g key={node.id} data-clickable="true"
                onClick={() => setExpandedSummary(prev => prev === node.id ? null : node.id)}
                style={{ cursor: 'pointer' }}>
                {/* Summary card */}
                <rect x={node.x - 80} y={node.y - 28} width={160} height={isExpanded ? 56 + node.tasks.length * 22 : 56}
                  rx={10} fill="white" stroke={node.color} strokeWidth={1.5} />
                {/* Status bar */}
                <rect x={node.x - 70} y={node.y - 18} width={completedPct} height={8} rx={4} fill="#16A34A" />
                <rect x={node.x - 70 + completedPct} y={node.y - 18} width={inProgressPct} height={8} rx={0} fill="#2563EB" />
                <rect x={node.x - 70 + completedPct + inProgressPct} y={node.y - 18} width={waitingPct} height={8} rx={0} fill="#D97706" />
                <rect x={node.x - 70 + completedPct + inProgressPct + waitingPct} y={node.y - 18}
                  width={barW - completedPct - inProgressPct - waitingPct} height={8} rx={4} fill="#E5E7EB" />
                {/* Count text */}
                <text x={node.x} y={node.y + 4} textAnchor="middle" fill={node.color} fontSize={12} fontWeight="bold">
                  ✅ {node.completed}  🔵 {node.inProgress}  ⏳ {node.waiting}  ⭕ {node.notStarted}
                </text>
                <text x={node.x} y={node.y + 20} textAnchor="middle" fill="#9CA3AF" fontSize={10}>
                  {node.total} לקוחות — לחצי לפירוט
                </text>
                {/* Expanded: show individual clients */}
                {isExpanded && node.tasks.map((task, ti) => {
                  const st = STATUS_STYLES[task.status] || STATUS_STYLES.not_started;
                  return (
                    <g key={task.id} data-clickable="true" onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}>
                      <rect x={node.x - 75} y={node.y + 30 + ti * 22} width={150} height={20}
                        rx={5} fill={st.fill} stroke={st.stroke} strokeWidth={1} />
                      <text x={node.x - 70 + 16} y={node.y + 44 + ti * 22} fill={st.text} fontSize={10} fontWeight="600">
                        {task.client_name?.length > 18 ? task.client_name.slice(0, 18) + '…' : task.client_name}
                      </text>
                      <text x={node.x - 70 + 4} y={node.y + 44 + ti * 22} fontSize={10}>{st.icon}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Gradient defs */}
          <defs>
            <radialGradient id="centerGrad">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1E3A5F" />
            </radialGradient>
          </defs>
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-white/95 rounded-xl px-3 py-2 shadow-sm border text-[11px]">
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_STYLES).slice(0, 5).map(([key, st]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: st.fill, borderColor: st.stroke }} />
              {st.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
