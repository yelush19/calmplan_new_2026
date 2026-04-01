/**
 * ── MiroProcessMap V3: Full Miro-Style Mind Map ──
 *
 * Features:
 * - Drag & drop nodes with snap-to-grid
 * - Persistent positions (localStorage)
 * - Tooltip on hover (full details)
 * - Animated entry
 * - Mini-map navigation
 * - Search → zoom to node
 * - Status-colored nodes with progress bars
 * - Expandable summary groups
 * - Click → quick status change + edit
 * - No red/fuchsia (ADHD-friendly palette)
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUS = {
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
const STORAGE_KEY = 'calmplan_miro_positions';

function getS(status) { return STATUS[status] || STATUS.not_started; }

export default function MiroProcessMap({ tasks = [], phases = [], centerLabel = 'תהליך', centerSub = '', onEditTask, onStatusChange }) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 100, y: 0 });
  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedNode, setExpandedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dragNode, setDragNode] = useState(null);
  const [savedPositions, setSavedPositions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const dragStart = useRef({ x: 0, y: 0, nx: 0, ny: 0 });

  // Save positions
  const savePos = useCallback((id, x, y) => {
    setSavedPositions(prev => {
      const next = { ...prev, [id]: { x, y } };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Build layout
  const layout = useMemo(() => {
    if (!phases?.length) return { nodes: [], edges: [] };
    const nodes = [];
    const edges = [];
    const cx = 700, cy = 350;

    nodes.push({ id: 'center', type: 'center', x: savedPositions.center?.x || cx, y: savedPositions.center?.y || cy, label: centerLabel, sub: centerSub });

    const totalPhaseH = phases.length * 140;
    let py = cy - totalPhaseH / 2 + 70;

    phases.forEach((phase, pi) => {
      const pid = `p${pi}`;
      const color = PHASE_COLORS[pi % PHASE_COLORS.length];
      const px = cx - 220;

      // Gather all tasks for this phase
      const allCats = (phase.services || []).flatMap(s => s.taskCategories || []);
      const allKeys = phase.serviceKeys || [];
      const phaseTasks = tasks.filter(t => allCats.includes(t.category) || allKeys.includes(t.category) || allKeys.includes(t.service_key));
      const done = phaseTasks.filter(t => t.status === 'production_completed' || t.status === 'completed').length;

      const phaseNode = { id: pid, type: 'phase', x: savedPositions[pid]?.x || px, y: savedPositions[pid]?.y || py, label: phase.label, color, done, total: phaseTasks.length };
      nodes.push(phaseNode);
      edges.push({ from: 'center', to: pid, color });

      // Services
      let sy = py - ((phase.services?.length || 1) - 1) * 60 / 2;
      (phase.services || []).forEach((svc, si) => {
        const sid = `s${pi}_${si}`;
        const sx = px - 200;
        const cats = svc.taskCategories || [];
        const svcTasks = tasks.filter(t => cats.includes(t.category) || t.service_key === svc.key);
        const svcDone = svcTasks.filter(t => t.status === 'production_completed' || t.status === 'completed').length;

        nodes.push({ id: sid, type: 'service', x: savedPositions[sid]?.x || sx, y: savedPositions[sid]?.y || sy, label: svc.label, color, done: svcDone, total: svcTasks.length, tasks: svcTasks });
        edges.push({ from: pid, to: sid, color: color + '50' });
        sy += Math.max(70, svcTasks.length * 8 + 40);
      });

      py += Math.max(140, (phase.services?.length || 1) * 80);
    });

    return { nodes, edges };
  }, [tasks, phases, centerLabel, centerSub, savedPositions]);

  // Search highlight
  const searchMatch = useMemo(() => {
    if (!searchTerm) return null;
    const q = searchTerm.toLowerCase();
    for (const node of layout.nodes) {
      if (node.type === 'service' && node.tasks) {
        const match = node.tasks.find(t => t.client_name?.toLowerCase().includes(q) || t.title?.toLowerCase().includes(q));
        if (match) return { nodeId: node.id, taskId: match.id };
      }
    }
    return null;
  }, [searchTerm, layout.nodes]);

  // Auto-zoom to search result
  useEffect(() => {
    if (searchMatch) {
      const node = layout.nodes.find(n => n.id === searchMatch.nodeId);
      if (node) {
        setPan({ x: -node.x * zoom + 400, y: -node.y * zoom + 300 });
        setExpandedNode(searchMatch.nodeId);
      }
    }
  }, [searchMatch]);

  // Pan
  const onMouseDown = useCallback((e) => {
    if (e.target.closest('[data-clickable]')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);
  const onMouseMove = useCallback((e) => {
    if (dragNode) {
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      const newX = dragStart.current.nx + dx;
      const newY = dragStart.current.ny + dy;
      savePos(dragNode, Math.round(newX / 10) * 10, Math.round(newY / 10) * 10);
      return;
    }
    if (!isPanning.current) return;
    setPan({ x: panStart.current.px + (e.clientX - panStart.current.x), y: panStart.current.py + (e.clientY - panStart.current.y) });
  }, [dragNode, zoom, savePos]);
  const onMouseUp = useCallback(() => { isPanning.current = false; setDragNode(null); }, []);
  const onWheel = useCallback((e) => { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(2.5, z - e.deltaY * 0.001))); }, []);

  const startDrag = useCallback((e, nodeId, nx, ny) => {
    e.stopPropagation();
    setDragNode(nodeId);
    dragStart.current = { x: e.clientX, y: e.clientY, nx, ny };
  }, []);

  const resetView = () => { setZoom(0.8); setPan({ x: 100, y: 0 }); };
  const resetPositions = () => { setSavedPositions({}); try { localStorage.removeItem(STORAGE_KEY); } catch {} };

  // Bezier path
  const bezier = (x1, y1, x2, y2) => {
    const cx1 = x1 - 80, cx2 = x2 + 80;
    return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div ref={containerRef} className="relative w-full bg-gradient-to-br from-slate-50 to-white rounded-xl border overflow-hidden" style={{ height: '75vh', minHeight: '500px' }}>
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex gap-1 bg-white/90 rounded-xl p-1.5 shadow-sm border">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}><ZoomIn className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.3, z - 0.15))}><ZoomOut className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetView}><Maximize2 className="w-3.5 h-3.5" /></Button>
        <span className="text-[10px] text-gray-400 self-center px-1">{Math.round(zoom * 100)}%</span>
        <div className="border-r mx-1" />
        <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={resetPositions}>סדר מחדש</Button>
      </div>

      {/* Search */}
      <div className="absolute top-3 right-3 z-20 w-48">
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="חפש לקוח..."
            className="h-8 text-xs pe-8 bg-white/90 border shadow-sm" />
        </div>
      </div>

      {/* Selected task panel */}
      {selectedTask && (
        <div className="absolute bottom-3 right-3 z-20 bg-white rounded-xl shadow-lg border p-3 max-w-[280px]">
          <div className="text-sm font-bold text-slate-800 mb-0.5">{selectedTask.title}</div>
          <div className="text-xs text-slate-400 mb-2">{selectedTask.client_name} • {selectedTask.due_date || 'ללא דדליין'}</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {['not_started', 'waiting_for_materials', 'ready_to_broadcast', 'production_completed'].map(s => {
              const st = STATUS[s];
              return (
                <button key={s} onClick={() => { onStatusChange?.(selectedTask, s); setSelectedTask(null); }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedTask.status === s ? 'ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100'}`}
                  style={{ borderColor: st.stroke, color: st.text }}>{st.icon} {st.label}</button>
              );
            })}
          </div>
          <div className="flex gap-2">
            {onEditTask && <button onClick={() => { onEditTask(selectedTask); setSelectedTask(null); }} className="text-xs font-bold text-blue-600 hover:bg-blue-50 rounded px-2 py-0.5">✏️ פתח</button>}
            <button onClick={() => setSelectedTask(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-0.5">סגור</button>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {hoveredNode && !selectedTask && !dragNode && (
        <div className="absolute z-30 bg-slate-800 text-white rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none max-w-[220px]"
          style={{ left: 20, bottom: 60 }}>
          <div className="font-bold mb-0.5">{hoveredNode.label || hoveredNode.client_name}</div>
          {hoveredNode.due_date && <div>דדליין: {hoveredNode.due_date}</div>}
          {hoveredNode.status && <div>סטטוס: {getS(hoveredNode.status).label}</div>}
          {hoveredNode.total != null && <div>{hoveredNode.done}/{hoveredNode.total} הושלמו</div>}
        </div>
      )}

      {/* SVG */}
      <svg className="w-full h-full" style={{ cursor: dragNode ? 'grabbing' : isPanning.current ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

          {/* Grid dots */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.5" fill="#CBD5E1" />
          </pattern>
          <rect width="3000" height="2000" x="-500" y="-200" fill="url(#grid)" />

          {/* Edges */}
          {layout.edges.map((e, i) => {
            const f = layout.nodes.find(n => n.id === e.from);
            const t = layout.nodes.find(n => n.id === e.to);
            if (!f || !t) return null;
            return <path key={i} d={bezier(f.x - 50, f.y, t.x + 80, t.y)} fill="none" stroke={e.color} strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />;
          })}

          {/* Center */}
          {layout.nodes.filter(n => n.type === 'center').map(n => (
            <g key={n.id} onMouseDown={e => startDrag(e, n.id, n.x, n.y)} data-clickable="true"
              onMouseEnter={() => setHoveredNode(n)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'move' }}>
              <circle cx={n.x} cy={n.y} r={50} fill="#1E3A5F" stroke="#0F172A" strokeWidth={3}>
                <animate attributeName="r" values="48;52;48" dur="4s" repeatCount="indefinite" />
              </circle>
              <text x={n.x} y={n.y - 6} textAnchor="middle" fill="white" fontSize={15} fontWeight="800" style={{ pointerEvents: 'none' }}>{n.label}</text>
              <text x={n.x} y={n.y + 12} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={11} style={{ pointerEvents: 'none' }}>{n.sub}</text>
            </g>
          ))}

          {/* Phases */}
          {layout.nodes.filter(n => n.type === 'phase').map(n => (
            <g key={n.id} onMouseDown={e => startDrag(e, n.id, n.x, n.y)} data-clickable="true"
              onMouseEnter={() => setHoveredNode(n)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'move' }}>
              <rect x={n.x - 85} y={n.y - 25} width={170} height={50} rx={14} fill={n.color} stroke={n.color} strokeWidth={0}>
                <animate attributeName="opacity" values="0;1" dur="0.5s" fill="freeze" />
              </rect>
              <text x={n.x} y={n.y - 2} textAnchor="middle" fill="white" fontSize={13} fontWeight="700" style={{ pointerEvents: 'none' }}>{n.label}</text>
              <text x={n.x} y={n.y + 16} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={11} style={{ pointerEvents: 'none' }}>
                {n.done}/{n.total} הושלמו
              </text>
            </g>
          ))}

          {/* Services */}
          {layout.nodes.filter(n => n.type === 'service').map(n => {
            const isExpanded = expandedNode === n.id;
            const isSearchHit = searchMatch?.nodeId === n.id;
            const barW = 120;
            const donePct = n.total > 0 ? (n.done / n.total) * barW : 0;

            return (
              <g key={n.id} onMouseDown={e => startDrag(e, n.id, n.x, n.y)} style={{ cursor: 'move' }}>
                {/* Card */}
                <rect x={n.x - 75} y={n.y - 30} width={150} height={isExpanded ? 65 + (n.tasks?.length || 0) * 24 : 60}
                  rx={12} fill="white" stroke={isSearchHit ? '#1E3A5F' : n.color} strokeWidth={isSearchHit ? 3 : 2}>
                  <animate attributeName="opacity" values="0;1" dur="0.6s" fill="freeze" />
                </rect>
                {/* Service name */}
                <text x={n.x} y={n.y - 10} textAnchor="middle" fill={n.color} fontSize={13} fontWeight="700" style={{ pointerEvents: 'none' }}>{n.label}</text>
                {/* Progress bar */}
                <rect x={n.x - 60} y={n.y + 2} width={barW} height={6} rx={3} fill="#E5E7EB" />
                <rect x={n.x - 60} y={n.y + 2} width={donePct} height={6} rx={3} fill={n.color} />
                {/* Count */}
                <text x={n.x} y={n.y + 22} textAnchor="middle" fill="#6B7280" fontSize={10} style={{ pointerEvents: 'none' }}>
                  {n.done}/{n.total} — לחצי לפירוט
                </text>
                {/* Click area */}
                <rect x={n.x - 75} y={n.y - 30} width={150} height={60} fill="transparent" data-clickable="true"
                  onClick={() => setExpandedNode(prev => prev === n.id ? null : n.id)} style={{ cursor: 'pointer' }} />
                {/* Expanded client list */}
                {isExpanded && (n.tasks || []).map((task, ti) => {
                  const st = getS(task.status);
                  const isSearchedTask = searchMatch?.taskId === task.id;
                  return (
                    <g key={task.id} data-clickable="true" onClick={() => setSelectedTask(task)}
                      onMouseEnter={() => setHoveredNode(task)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: 'pointer' }}>
                      <rect x={n.x - 68} y={n.y + 38 + ti * 24} width={136} height={22}
                        rx={6} fill={st.fill} stroke={isSearchedTask ? '#1E3A5F' : st.stroke} strokeWidth={isSearchedTask ? 2.5 : 1} />
                      <text x={n.x - 50} y={n.y + 53 + ti * 24} fill={st.text} fontSize={10} fontWeight="600" style={{ pointerEvents: 'none' }}>
                        {task.client_name?.length > 16 ? task.client_name.slice(0, 16) + '…' : task.client_name}
                      </text>
                      <text x={n.x - 64} y={n.y + 53 + ti * 24} fontSize={10} style={{ pointerEvents: 'none' }}>{st.icon}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          <defs>
            <radialGradient id="cg"><stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="#1E3A5F" /></radialGradient>
          </defs>
        </g>
      </svg>

      {/* Mini-map */}
      <div className="absolute bottom-3 left-3 w-32 h-20 bg-white/90 rounded-lg border shadow-sm overflow-hidden">
        <svg viewBox="0 400 1400 800" className="w-full h-full">
          {layout.nodes.map(n => (
            <circle key={n.id} cx={n.x} cy={n.y}
              r={n.type === 'center' ? 8 : n.type === 'phase' ? 6 : 4}
              fill={n.color || '#1E3A5F'} opacity={0.7} />
          ))}
          {/* Viewport indicator */}
          <rect x={(-pan.x / zoom)} y={(-pan.y / zoom) + 400} width={1200 / zoom} height={600 / zoom}
            fill="none" stroke="#00A3E0" strokeWidth={3} rx={4} />
        </svg>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-white/90 rounded-xl px-3 py-1.5 shadow-sm border text-[10px] flex gap-3 flex-wrap" style={{ maxWidth: '280px' }}>
        {Object.entries(STATUS).filter(([k]) => !['completed'].includes(k)).slice(0, 6).map(([k, st]) => (
          <span key={k} className="flex items-center gap-0.5">
            <span className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: st.fill, borderColor: st.stroke }} />
            {st.label}
          </span>
        ))}
      </div>
    </div>
  );
}
