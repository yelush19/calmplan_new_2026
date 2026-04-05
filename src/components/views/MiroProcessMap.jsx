/**
 * ── MiroProcessMap V5: Status-based branches ──
 * Center → Status nodes → Client cards
 * Simple and clear: see immediately who needs what
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUSES = [
  { key: 'waiting_for_materials', label: 'ממתין לחומרים', icon: '⏳', color: '#D97706', fill: '#FEF3C7' },
  { key: 'not_started', label: 'לבצע', icon: '⭕', color: '#6B7280', fill: '#F3F4F6' },
  { key: 'sent_for_review', label: 'הועבר לעיון', icon: '👁️', color: '#7C3AED', fill: '#F3E8FF' },
  { key: 'review_after_corrections', label: 'לעיון לאחר תיקונים', icon: '🔄', color: '#8B5CF6', fill: '#EDE9FE' },
  { key: 'needs_corrections', label: 'לתיקון', icon: '⚠️', color: '#D97706', fill: '#FEF3C7' },
  { key: 'ready_to_broadcast', label: 'מוכן לשידור', icon: '📡', color: '#0D9488', fill: '#CCFBF1' },
  { key: 'reported_pending_payment', label: 'שודר, ממתין לתשלום', icon: '💰', color: '#4F46E5', fill: '#E0E7FF' },
  { key: 'production_completed', label: 'הושלם', icon: '✅', color: '#16A34A', fill: '#DCFCE7' },
];

export default function MiroProcessMap({ tasks = [], centerLabel = 'תהליך', centerSub = '', onEditTask, onStatusChange, phases }) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(0.7);
  const [pan, setPan] = useState({ x: 150, y: 30 });
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hideCompleted, setHideCompleted] = useState(true); // Hide completed by default
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

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

  // Group tasks by status
  const filteredTasks = useMemo(() => {
    if (!hideCompleted) return tasks;
    return tasks.filter(t => t.status !== 'production_completed' && t.status !== 'completed');
  }, [tasks, hideCompleted]);

  const statusGroups = useMemo(() => {
    return STATUSES.map(st => {
      const matching = filteredTasks.filter(t => t.status === st.key);
      return { ...st, tasks: matching, count: matching.length };
    }).filter(g => g.count > 0);
  }, [filteredTasks]);

  // Layout
  const { nodes, edges } = useMemo(() => {
    const N = [], E = [];
    const CX = 700, CY = 350;
    N.push({ id: 'c', t: 'center', x: CX, y: CY, label: centerLabel, sub: `${tasks.length} משימות` });

    const totalH = statusGroups.length * 120;
    let sy = CY - totalH / 2 + 60;

    statusGroups.forEach((sg, si) => {
      const sx = CX - 280;
      const statusId = `st_${si}`;
      N.push({ id: statusId, t: 'status', x: sx, y: sy, ...sg });
      E.push({ from: 'c', to: statusId, color: sg.color });

      // Client nodes
      const clientH = sg.tasks.length * 38;
      let cy = sy - clientH / 2 + 19;
      sg.tasks.forEach((task, ti) => {
        const cx = sx - 280;
        const tid = `t_${task.id}`;
        const dueStr = (() => { try { return task.due_date ? new Date(task.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : ''; } catch { return ''; } })();
        N.push({ id: tid, t: 'task', x: cx, y: cy, task, sg, dueStr, label: task.client_name || task.title });
        E.push({ from: statusId, to: tid, color: sg.color + '30' });
        cy += 38;
      });

      sy += Math.max(120, sg.tasks.length * 38 + 60);
    });

    return { nodes: N, edges: E };
  }, [tasks, statusGroups, centerLabel]);

  // Search
  const searchHL = useMemo(() => {
    if (!searchTerm) return null;
    const q = searchTerm.toLowerCase();
    const found = nodes.find(n => n.t === 'task' && n.label?.toLowerCase().includes(q));
    if (found) setPan({ x: -found.x * zoom + 500, y: -found.y * zoom + 300 });
    return found?.id || null;
  }, [searchTerm, nodes, zoom]);

  const bezier = (x1, y1, x2, y2) => `M ${x1} ${y1} C ${x1-80} ${y1}, ${x2+80} ${y2}, ${x2} ${y2}`;

  if (tasks.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400"><div className="text-center"><div className="text-4xl mb-2">🗺️</div><p className="text-sm">אין משימות להצגה</p></div></div>;
  }

  return (
    <div ref={containerRef} className="relative w-full rounded-xl border overflow-hidden" style={{ height: '75vh', minHeight: '500px', background: 'linear-gradient(135deg, #FAFBFE 0%, #F5F7FC 100%)' }}>
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex gap-1 bg-white rounded-xl p-1.5 shadow border">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}><ZoomIn className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}><ZoomOut className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setZoom(0.7); setPan({ x: 150, y: 30 }); }}><Maximize2 className="w-3.5 h-3.5" /></Button>
        <span className="text-[10px] text-gray-400 self-center px-1">{Math.round(zoom * 100)}%</span>
        <div className="border-r mx-1" />
        <Button variant={hideCompleted ? 'default' : 'ghost'} size="sm" className="h-7 text-[10px] px-2"
          onClick={() => setHideCompleted(p => !p)}>
          {hideCompleted ? '✅ הצג הושלמו' : '🙈 הסתר הושלמו'}
        </Button>
      </div>

      {/* Search */}
      <div className="absolute top-3 right-3 z-20 w-52">
        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="🔍 חפש לקוח..." className="h-8 text-xs bg-white shadow border" />
      </div>

      {/* Legend */}
      <div className="absolute top-14 right-3 z-20 bg-white rounded-xl px-3 py-2 shadow border flex gap-2 flex-wrap text-[11px]" style={{ maxWidth: '350px' }}>
        {STATUSES.map(s => (
          <span key={s.key} className="flex items-center gap-1">
            <span>{s.icon}</span>
            <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
          </span>
        ))}
      </div>

      {/* Selected task */}
      {selectedTask && (
        <div className="absolute bottom-3 right-3 z-20 bg-white rounded-xl shadow-lg border p-3 w-[280px]">
          <div className="text-sm font-bold text-slate-800">{selectedTask.title}</div>
          <div className="text-xs text-slate-400 mb-2">{selectedTask.client_name} • {selectedTask.due_date || 'ללא דדליין'}</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {STATUSES.map(s => (
              <button key={s.key} onClick={() => { onStatusChange?.(selectedTask, s.key); setSelectedTask(null); }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedTask.status === s.key ? 'ring-2 ring-offset-1' : 'opacity-40 hover:opacity-100'}`}
                style={{ borderColor: s.color, color: s.color }}>{s.icon} {s.label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {onEditTask && <button onClick={() => { onEditTask(selectedTask); setSelectedTask(null); }} className="text-xs font-bold text-blue-600 hover:bg-blue-50 rounded px-2 py-1">✏️ פתח</button>}
            <button onClick={() => setSelectedTask(null)} className="text-xs text-gray-400 px-2 py-1">✕</button>
          </div>
        </div>
      )}

      {/* SVG */}
      <svg className="w-full h-full" style={{ cursor: 'grab' }} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          <pattern id="dots" width="50" height="50" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="0.7" fill="#D1D5DB" /></pattern>
          <rect x="-500" y="-300" width="4000" height="3000" fill="url(#dots)" />

          {/* Edges */}
          {edges.map((e, i) => {
            const f = nodes.find(n => n.id === e.from);
            const t = nodes.find(n => n.id === e.to);
            if (!f || !t) return null;
            return <path key={i} d={bezier(f.x - 50, f.y, t.x + 110, t.y)} fill="none" stroke={e.color} strokeWidth={2} opacity={0.5} />;
          })}

          {/* Center */}
          {nodes.filter(n => n.t === 'center').map(n => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={55} fill="#1E3A5F" stroke="#0F172A" strokeWidth={3} />
              <text x={n.x} y={n.y - 6} textAnchor="middle" fill="white" fontSize={16} fontWeight="800">{n.label}</text>
              <text x={n.x} y={n.y + 14} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={11}>{n.sub}</text>
            </g>
          ))}

          {/* Status branches */}
          {nodes.filter(n => n.t === 'status').map(n => (
            <g key={n.id}>
              <rect x={n.x - 100} y={n.y - 28} width={200} height={56} rx={16} fill={n.color} />
              <foreignObject x={n.x - 98} y={n.y - 26} width={196} height={52}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white', direction: 'rtl' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>{n.icon} {n.label}</span>
                  <span style={{ fontSize: '12px', opacity: 0.8 }}>{n.count} לקוחות</span>
                </div>
              </foreignObject>
            </g>
          ))}

          {/* Task cards */}
          {nodes.filter(n => n.t === 'task').map(n => {
            const isHL = searchHL === n.id;
            const isSel = selectedTask?.id === n.task?.id;
            return (
              <g key={n.id} data-click="1" onClick={(e) => { e.stopPropagation(); setSelectedTask(n.task); }} style={{ cursor: 'pointer' }}>
                <rect x={n.x - 110} y={n.y - 16} width={220} height={32} rx={10}
                  fill={n.sg.fill} stroke={isHL ? '#1E3A5F' : isSel ? '#2563EB' : n.sg.color}
                  strokeWidth={isHL || isSel ? 3 : 1.5} />
                <foreignObject x={n.x - 108} y={n.y - 14} width={216} height={28}>
                  <div xmlns="http://www.w3.org/1999/xhtml"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 8px', direction: 'rtl', overflow: 'hidden' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: n.sg.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {n.label}
                    </span>
                    <span style={{ fontSize: '10px', color: n.sg.color, opacity: 0.7, marginRight: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {n.dueStr && `📅${n.dueStr}`}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Mini-map */}
      <div className="absolute bottom-3 left-3 w-36 h-24 bg-white/90 rounded-lg border shadow overflow-hidden">
        <svg viewBox="0 0 1400 1000" className="w-full h-full">
          {nodes.map(n => <circle key={n.id} cx={n.x} cy={n.y} r={n.t === 'center' ? 10 : n.t === 'status' ? 7 : 3} fill={n.color || n.sg?.color || '#1E3A5F'} opacity={0.6} />)}
          <rect x={-pan.x / zoom} y={-pan.y / zoom} width={1200 / zoom} height={700 / zoom} fill="none" stroke="#00A3E0" strokeWidth={4} rx={6} />
        </svg>
      </div>
    </div>
  );
}
