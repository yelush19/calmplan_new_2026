/**
 * ── MiroProcessMap V4: Every client is a separate node ──
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
  review_after_corrections: { fill: '#EDE9FE', stroke: '#8B5CF6', text: '#5B21B6', label: 'לעיון לאחר תיקונים', icon: '🔄' },
  needs_corrections: { fill: '#FEF3C7', stroke: '#D97706', text: '#92400E', label: 'לתיקון', icon: '⚠️' },
  waiting_for_materials: { fill: '#FEF3C7', stroke: '#D97706', text: '#92400E', label: 'ממתין לחומרים', icon: '⏳' },
  not_started: { fill: '#F1F5F9', stroke: '#94A3B8', text: '#475569', label: 'טרם התחיל', icon: '⭕' },
};
const COLORS = ['#00A3E0', '#0D9488', '#6366F1', '#F59E0B', '#7C3AED'];
const getS = (s) => STATUS[s] || STATUS.not_started;

export default function MiroProcessMap({ tasks = [], phases = [], centerLabel = 'תהליך', centerSub = '', onEditTask, onStatusChange }) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(0.65);
  const [pan, setPan] = useState({ x: 200, y: 50 });
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // Non-passive wheel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e) => { e.preventDefault(); setZoom(z => Math.max(0.2, Math.min(2.5, z - e.deltaY * 0.001))); };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, []);

  const onMD = (e) => { if (e.target.closest('[data-click]')) return; isPanning.current = true; panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; };
  const onMM = (e) => { if (!isPanning.current) return; setPan({ x: panStart.current.px + (e.clientX - panStart.current.x), y: panStart.current.py + (e.clientY - panStart.current.y) }); };
  const onMU = () => isPanning.current = false;

  // Build layout: center → phases → services → individual clients
  const { nodes, edges } = useMemo(() => {
    const N = [], E = [];
    if (!phases?.length) return { nodes: N, edges: E };
    const CX = 800, CY = 400;
    N.push({ id: 'c', t: 'center', x: CX, y: CY, label: centerLabel, sub: centerSub });

    let totalH = 0;
    // Pre-calculate heights
    const phaseHeights = phases.map((ph) => {
      const svcs = (ph.services || []);
      let h = 0;
      svcs.forEach(svc => {
        const cats = svc.taskCategories || [];
        const keys = ph.serviceKeys || [];
        const count = tasks.filter(t => cats.includes(t.category) || keys.includes(t.category) || keys.includes(t.service_key)).length;
        h += Math.max(60, count * 42 + 50);
      });
      return Math.max(100, h);
    });
    const totalPH = phaseHeights.reduce((s, h) => s + h, 0);

    let py = CY - totalPH / 2;
    phases.forEach((phase, pi) => {
      const color = COLORS[pi % COLORS.length];
      const pId = `p${pi}`;
      const px = CX - 250;
      const phaseH = phaseHeights[pi];

      // Phase tasks
      const allCats = (phase.services || []).flatMap(s => s.taskCategories || []);
      const allKeys = phase.serviceKeys || [];
      const pTasks = tasks.filter(t => allCats.includes(t.category) || allKeys.includes(t.category) || allKeys.includes(t.service_key));
      const pDone = pTasks.filter(t => t.status === 'production_completed' || t.status === 'completed').length;

      N.push({ id: pId, t: 'phase', x: px, y: py + phaseH / 2, label: phase.label, color, done: pDone, total: pTasks.length });
      E.push({ from: 'c', to: pId, color });

      let sy = py + 30;
      (phase.services || []).forEach((svc, si) => {
        const sId = `s${pi}_${si}`;
        const sx = px - 230;
        const cats = svc.taskCategories || [];
        const sTasks = tasks.filter(t => cats.includes(t.category) || t.service_key === svc.key);
        const sDone = sTasks.filter(t => t.status === 'production_completed' || t.status === 'completed').length;

        N.push({ id: sId, t: 'service', x: sx, y: sy + (sTasks.length * 42) / 2, label: svc.label, color, done: sDone, total: sTasks.length });
        E.push({ from: pId, to: sId, color: color + '60' });

        // Individual client nodes
        sTasks.forEach((task, ti) => {
          const tId = `t_${task.id}`;
          const tx = sx - 250;
          const ty = sy + ti * 42;
          const st = getS(task.status);
          // Deadline info
          const dueStr = (() => { try { return task.due_date ? new Date(task.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : ''; } catch { return ''; } })();
          N.push({ id: tId, t: 'task', x: tx, y: ty, task, st, dueStr, label: task.client_name || task.title });
          E.push({ from: sId, to: tId, color: st.stroke + '30' });
        });

        sy += Math.max(60, sTasks.length * 42 + 50);
      });

      py += phaseH + 30;
    });

    return { nodes: N, edges: E };
  }, [tasks, phases, centerLabel, centerSub]);

  // Search
  const searchHighlight = useMemo(() => {
    if (!searchTerm) return null;
    const q = searchTerm.toLowerCase();
    const found = nodes.find(n => n.t === 'task' && (n.label?.toLowerCase().includes(q) || n.task?.title?.toLowerCase().includes(q)));
    if (found) {
      setPan({ x: -found.x * zoom + 500, y: -found.y * zoom + 300 });
      return found.id;
    }
    return null;
  }, [searchTerm, nodes, zoom]);

  const bezier = (x1, y1, x2, y2) => `M ${x1} ${y1} C ${x1 - 80} ${y1}, ${x2 + 80} ${y2}, ${x2} ${y2}`;

  return (
    <div ref={containerRef} className="relative w-full rounded-xl border overflow-hidden" style={{ height: '75vh', minHeight: '500px', background: 'linear-gradient(135deg, #FAFBFE 0%, #F5F7FC 100%)' }}>
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex gap-1 bg-white rounded-xl p-1.5 shadow border">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}><ZoomIn className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}><ZoomOut className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setZoom(0.65); setPan({ x: 200, y: 50 }); }}><Maximize2 className="w-3.5 h-3.5" /></Button>
        <span className="text-[10px] text-gray-400 self-center px-1">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Search */}
      <div className="absolute top-3 right-3 z-20 w-52">
        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="🔍 חפש לקוח..." className="h-8 text-xs bg-white shadow border" />
      </div>

      {/* Legend — always visible top */}
      <div className="absolute top-14 right-3 z-20 bg-white rounded-xl px-3 py-2 shadow border flex gap-3 flex-wrap text-[11px]" style={{ maxWidth: '320px' }}>
        {Object.entries(STATUS).filter(([k]) => !['completed'].includes(k)).map(([k, s]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded border" style={{ backgroundColor: s.fill, borderColor: s.stroke }} />
            <span style={{ color: s.text }}>{s.label}</span>
          </span>
        ))}
      </div>

      {/* Selected task panel */}
      {selectedTask && (
        <div className="absolute bottom-3 right-3 z-20 bg-white rounded-xl shadow-lg border p-3 w-[280px]">
          <div className="text-sm font-bold text-slate-800">{selectedTask.title}</div>
          <div className="text-xs text-slate-400 mb-1">{selectedTask.client_name} • דדליין: {selectedTask.due_date || 'לא נקבע'}</div>
          {selectedTask.notes && <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mb-1">📝 {selectedTask.notes}</div>}
          <div className="flex flex-wrap gap-1 mb-2">
            {['not_started', 'waiting_for_materials', 'sent_for_review', 'review_after_corrections', 'needs_corrections', 'ready_to_broadcast', 'production_completed'].map(s => (
              <button key={s} onClick={() => { onStatusChange?.(selectedTask, s); setSelectedTask(null); }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedTask.status === s ? 'ring-2 ring-offset-1' : 'opacity-50 hover:opacity-100'}`}
                style={{ borderColor: getS(s).stroke, color: getS(s).text }}>{getS(s).icon} {getS(s).label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {onEditTask && <button onClick={() => { onEditTask(selectedTask); setSelectedTask(null); }} className="text-xs font-bold text-blue-600 hover:bg-blue-50 rounded px-2 py-1">✏️ פתח משימה</button>}
            <button onClick={() => setSelectedTask(null)} className="text-xs text-gray-400 px-2 py-1">✕</button>
          </div>
        </div>
      )}

      {/* SVG */}
      <svg className="w-full h-full" style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Grid */}
          <pattern id="dots" width="50" height="50" patternUnits="userSpaceOnUse">
            <circle cx="25" cy="25" r="0.7" fill="#D1D5DB" />
          </pattern>
          <rect x="-500" y="-300" width="4000" height="3000" fill="url(#dots)" />

          {/* Edges — bezier curves */}
          {edges.map((e, i) => {
            const f = nodes.find(n => n.id === e.from);
            const t = nodes.find(n => n.id === e.to);
            if (!f || !t) return null;
            const fx = f.t === 'center' ? f.x - 55 : f.x - 90;
            const tx = t.x + (t.t === 'task' ? 110 : 90);
            return <path key={i} d={bezier(fx, f.y, tx, t.y)} fill="none" stroke={e.color} strokeWidth={2} opacity={0.5} />;
          })}

          {/* CENTER */}
          {nodes.filter(n => n.t === 'center').map(n => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={55} fill="#1E3A5F" stroke="#0F172A" strokeWidth={3} />
              <text x={n.x} y={n.y - 6} textAnchor="middle" fill="white" fontSize={16} fontWeight="800">{n.label}</text>
              <text x={n.x} y={n.y + 14} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={11}>{n.sub}</text>
            </g>
          ))}

          {/* PHASES */}
          {nodes.filter(n => n.t === 'phase').map(n => (
            <g key={n.id}>
              <rect x={n.x - 100} y={n.y - 28} width={200} height={56} rx={16} fill={n.color} />
              <text x={n.x} y={n.y - 4} textAnchor="middle" fill="white" fontSize={14} fontWeight="700">{n.label}</text>
              <text x={n.x} y={n.y + 16} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={12}>{n.done}/{n.total} הושלמו</text>
            </g>
          ))}

          {/* SERVICES */}
          {nodes.filter(n => n.t === 'service').map(n => {
            const pct = n.total > 0 ? (n.done / n.total) * 140 : 0;
            return (
              <g key={n.id}>
                <rect x={n.x - 90} y={n.y - 24} width={180} height={48} rx={12} fill="white" stroke={n.color} strokeWidth={2} />
                <text x={n.x} y={n.y - 2} textAnchor="middle" fill={n.color} fontSize={13} fontWeight="700">{n.label}</text>
                <rect x={n.x - 70} y={n.y + 8} width={140} height={5} rx={2.5} fill="#E5E7EB" />
                <rect x={n.x - 70} y={n.y + 8} width={pct} height={5} rx={2.5} fill={n.color} />
                <text x={n.x + 78} y={n.y + 14} fill="#9CA3AF" fontSize={9} textAnchor="end">{n.done}/{n.total}</text>
              </g>
            );
          })}

          {/* TASK NODES — individual clients */}
          {nodes.filter(n => n.t === 'task').map(n => {
            const isHL = searchHighlight === n.id;
            const isSel = selectedTask?.id === n.task?.id;
            return (
              <g key={n.id} data-click="1" onClick={(e) => { e.stopPropagation(); setSelectedTask(n.task); }} style={{ cursor: 'pointer' }}>
                <rect x={n.x - 110} y={n.y - 17} width={220} height={34} rx={10}
                  fill={n.st.fill} stroke={isHL ? '#1E3A5F' : isSel ? '#2563EB' : n.st.stroke}
                  strokeWidth={isHL || isSel ? 3 : 1.5} />
                {/* Status icon — left side */}
                <text x={n.x - 96} y={n.y + 5} fontSize={14}>{n.st.icon}</text>
                {/* Client name — inside card, after icon */}
                <text x={n.x - 78} y={n.y + 4} fill={n.st.text} fontSize={12} fontWeight="700" style={{ pointerEvents: 'none' }}>
                  {n.label?.length > 20 ? n.label.slice(0, 20) + '…' : n.label}
                </text>
                {/* Deadline — right side inside card */}
                {n.dueStr && (
                  <text x={n.x + 100} y={n.y + 4} textAnchor="end" fill={n.st.text} fontSize={10} fontWeight="500" opacity={0.7} style={{ pointerEvents: 'none' }}>
                    📅 {n.dueStr}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Mini-map */}
      <div className="absolute bottom-3 left-3 w-36 h-24 bg-white/90 rounded-lg border shadow overflow-hidden">
        <svg viewBox="0 0 1600 1200" className="w-full h-full">
          {nodes.map(n => (
            <circle key={n.id} cx={n.x} cy={n.y}
              r={n.t === 'center' ? 12 : n.t === 'phase' ? 8 : n.t === 'service' ? 6 : 3}
              fill={n.color || n.st?.stroke || '#1E3A5F'} opacity={0.6} />
          ))}
          <rect x={-pan.x / zoom} y={-pan.y / zoom} width={1200 / zoom} height={700 / zoom}
            fill="none" stroke="#00A3E0" strokeWidth={4} rx={6} />
        </svg>
      </div>
    </div>
  );
}
