/**
 * ── MiroProcessMap V6: Service → Status → Clients + Draggable nodes ──
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STS = {
  waiting_for_materials: { label: 'ממתין לחומרים', icon: '⏳', color: '#D97706', fill: '#FEF3C7' },
  not_started: { label: 'לבצע', icon: '⭕', color: '#6B7280', fill: '#F3F4F6' },
  sent_for_review: { label: 'הועבר לעיון', icon: '👁️', color: '#7C3AED', fill: '#F3E8FF' },
  review_after_corrections: { label: 'לעיון אחרי תיקונים', icon: '🔄', color: '#8B5CF6', fill: '#EDE9FE' },
  needs_corrections: { label: 'לתיקון', icon: '⚠️', color: '#D97706', fill: '#FEF3C7' },
  ready_to_broadcast: { label: 'מוכן לשידור', icon: '📡', color: '#0D9488', fill: '#CCFBF1' },
  reported_pending_payment: { label: 'שודר', icon: '💰', color: '#4F46E5', fill: '#E0E7FF' },
  production_completed: { label: 'הושלם', icon: '✅', color: '#16A34A', fill: '#DCFCE7' },
};
const COLORS = ['#00A3E0', '#0D9488', '#6366F1', '#F59E0B', '#7C3AED'];
// Display label overrides for the map (keeps processTemplates intact)
const MIRO_LABEL_OVERRIDE = { 'שכר': 'ייצור והפצה' };
const POS_KEY = 'calmplan_miro_v6_pos';

// Decide font color based on background luminance
function fontForBg(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 160 ? '#FFFFFF' : '#1E293B';
}

export default function MiroProcessMap({ tasks = [], phases = [], centerLabel = 'תהליך', centerSub = '', onEditTask, onStatusChange }) {
  const ref = useRef(null);
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 200, y: 20 });
  const [sel, setSel] = useState(null);
  const [selPos, setSelPos] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState('');
  const [hideOk, setHideOk] = useState(true);
  const [collapsed, setCollapsed] = useState({}); // { nodeId: true } — collapsed branches
  // Per-node drag offsets
  const [offsets, setOffsets] = useState(() => { try { return JSON.parse(localStorage.getItem(POS_KEY) || '{}'); } catch { return {}; } });
  const [dragId, setDragId] = useState(null);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const isPan = useRef(false);
  const panS = useRef({ x: 0, y: 0, px: 0, py: 0 });
  // Popup drag
  const [popDrag, setPopDrag] = useState(false);
  const popDragStart = useRef({ x: 0, y: 0, sx: 0, sy: 0 });

  useEffect(() => { const el = ref.current; if (!el) return; const h = e => { e.preventDefault(); setZoom(z => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001))); }; el.addEventListener('wheel', h, { passive: false }); return () => el.removeEventListener('wheel', h); }, []);
  useEffect(() => { try { localStorage.setItem(POS_KEY, JSON.stringify(offsets)); } catch {} }, [offsets]);

  const onMD = e => { if (e.target.closest('[data-d]')) return; isPan.current = true; panS.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; };

  // Build: center → services → statuses → clients
  const { nodes, edges } = useMemo(() => {
    const N = [], E = [];
    const CX = 800, CY = 400;
    N.push({ id: 'c', t: 'c', bx: CX, by: CY });

    // Collect ALL service categories from phases
    const services = [];
    (phases || []).forEach((ph, pi) => {
      (ph.services || []).forEach(svc => {
        const cats = svc.taskCategories || [];
        const keys = ph.serviceKeys || [];
        const ts = tasks.filter(t => cats.includes(t.category) || keys.includes(t.category) || keys.includes(t.service_key));
        if (ts.length > 0 || !hideOk) services.push({ svc, tasks: ts, color: COLORS[pi % COLORS.length], pi });
      });
    });

    // If no phases provided, group all tasks by category
    if (services.length === 0 && tasks.length > 0) {
      const cats = {};
      tasks.forEach(t => { const c = t.category || 'כללי'; if (!cats[c]) cats[c] = []; cats[c].push(t); });
      Object.entries(cats).forEach(([cat, ts], i) => {
        services.push({ svc: { label: cat, key: cat }, tasks: ts, color: COLORS[i % COLORS.length], pi: i });
      });
    }

    let totalH = 0;
    const svcHeights = services.map(s => {
      const statuses = Object.keys(STS).filter(k => !hideOk || (k !== 'production_completed' && k !== 'completed'));
      const usedStatuses = statuses.filter(k => s.tasks.some(t => t.status === k));
      let h = 0;
      usedStatuses.forEach(k => { h += Math.max(50, s.tasks.filter(t => t.status === k).length * 36 + 30); });
      return Math.max(80, h + 40);
    });
    const totalSH = svcHeights.reduce((a, b) => a + b, 0);

    let sy = CY - totalSH / 2;
    services.forEach((s, si) => {
      const sid = `svc_${si}`;
      const sx = CX - 260;
      const svcH = svcHeights[si];
      N.push({ id: sid, t: 's', bx: sx, by: sy + svcH / 2, label: MIRO_LABEL_OVERRIDE[s.svc.label] || s.svc.label, color: s.color, count: s.tasks.length, done: s.tasks.filter(t => t.status === 'production_completed').length });
      E.push({ from: 'c', to: sid, color: s.color });

      // Group by status
      const statuses = Object.entries(STS).filter(([k]) => !hideOk || (k !== 'production_completed' && k !== 'completed'));
      let sty = sy + 20;
      statuses.forEach(([stKey, stCfg]) => {
        const stTasks = s.tasks.filter(t => t.status === stKey);
        if (stTasks.length === 0) return;
        const stid = `st_${si}_${stKey}`;
        N.push({ id: stid, t: 'st', bx: sx - 220, by: sty + (stTasks.length * 36) / 2, label: stCfg.label, icon: stCfg.icon, color: stCfg.color, fill: stCfg.fill, count: stTasks.length, parentSvc: sid });
        E.push({ from: sid, to: stid, color: stCfg.color + '50' });

        // Client cards
        stTasks.forEach((task, ti) => {
          const tid = `t_${task.id}`;
          const tx = sx - 220 - 250;
          const ty = sty + ti * 36;
          const due = (() => { try { return task.due_date ? new Date(task.due_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) : ''; } catch { return ''; } })();
          N.push({ id: tid, t: 't', bx: tx, by: ty, task, stCfg, due, label: task.client_name || task.title, parentSvc: sid, parentStatus: stid });
          E.push({ from: stid, to: tid, color: stCfg.color + '25' });
        });
        sty += Math.max(50, stTasks.length * 36 + 30);
      });
      sy += svcH + 20;
    });

    return { nodes: N, edges: E };
  }, [tasks, phases, hideOk, centerLabel]);

  // Get child node IDs for group dragging (must be after nodes useMemo)
  const getChildIds = useCallback((parentId) => {
    return nodes.filter(n => n.parentStatus === parentId || n.parentSvc === parentId).map(n => n.id);
  }, [nodes]);

  const onMM = e => {
    if (dragId) {
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      const newOx = (dragStart.current.ox || 0) + dx;
      const newOy = (dragStart.current.oy || 0) + dy;
      setOffsets(p => {
        const updated = { ...p, [dragId]: { x: newOx, y: newOy } };
        const children = dragStart.current.childIds || [];
        children.forEach(cid => {
          const startOff = dragStart.current.childStarts?.[cid] || { x: 0, y: 0 };
          updated[cid] = { x: startOff.x + dx, y: startOff.y + dy };
        });
        return updated;
      });
      return;
    }
    if (isPan.current) setPan({ x: panS.current.px + (e.clientX - panS.current.x), y: panS.current.py + (e.clientY - panS.current.y) });
  };
  const onMU = () => { isPan.current = false; setDragId(null); };
  const startDrag = (e, id) => {
    e.stopPropagation();
    setDragId(id);
    const childIds = getChildIds(id);
    const allChildIds = [...childIds];
    childIds.forEach(cid => { getChildIds(cid).forEach(gcid => { if (!allChildIds.includes(gcid)) allChildIds.push(gcid); }); });
    const childStarts = {};
    allChildIds.forEach(cid => { childStarts[cid] = { x: offsets[cid]?.x || 0, y: offsets[cid]?.y || 0 }; });
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offsets[id]?.x || 0, oy: offsets[id]?.y || 0, childIds: allChildIds, childStarts };
  };

  // Apply offsets
  const getPos = useCallback((n) => ({
    x: n.bx + (offsets[n.id]?.x || 0),
    y: n.by + (offsets[n.id]?.y || 0),
  }), [offsets]);

  const searchHL = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    const f = nodes.find(n => n.t === 't' && n.label?.toLowerCase().includes(q));
    if (f) { const p = getPos(f); setPan({ x: -p.x * zoom + 500, y: -p.y * zoom + 300 }); }
    return f?.id || null;
  }, [search, nodes, zoom, getPos]);

  const bz = (x1, y1, x2, y2) => `M${x1},${y1} C${x1 - 70},${y1} ${x2 + 70},${y2} ${x2},${y2}`;

  if (tasks.length === 0) return <div className="flex items-center justify-center h-64 text-gray-400"><p>🗺️ אין משימות</p></div>;

  return (
    <div ref={ref} className="relative w-full rounded-xl border overflow-hidden" style={{ height: '75vh', minHeight: '500px', background: '#FAFBFE' }}>
      <div className="absolute top-3 left-3 z-20 flex gap-1 bg-white rounded-xl p-1 shadow border text-[10px]">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(3, z + 0.15))}><ZoomIn className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.2, z - 0.15))}><ZoomOut className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setZoom(0.6); setPan({ x: 200, y: 20 }); }}><Maximize2 className="w-3.5 h-3.5" /></Button>
        <span className="self-center px-1 text-gray-400">{Math.round(zoom * 100)}%</span>
        <Button variant={hideOk ? 'default' : 'ghost'} size="sm" className="h-7 px-2 text-[10px]" onClick={() => setHideOk(p => !p)}>{hideOk ? '✅ הצג הושלמו' : '🙈 הסתר'}</Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => { setOffsets({}); try { localStorage.removeItem(POS_KEY); } catch {} }}>סדר מחדש</Button>
      </div>

      <div className="absolute top-3 right-3 z-20 w-48">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 חפש..." className="h-7 text-xs bg-white shadow border" />
      </div>

      {/* Legend */}
      <div className="absolute top-12 right-3 z-20 bg-white/95 rounded-lg px-2 py-1.5 shadow border flex gap-2 flex-wrap text-[10px]" style={{ maxWidth: '320px' }}>
        {Object.values(STS).map(s => <span key={s.label} className="flex items-center gap-0.5"><span>{s.icon}</span><span style={{ color: s.color }}>{s.label}</span></span>)}
      </div>

      {sel && (
        <div
          className="absolute z-20 bg-white rounded-xl shadow-lg border p-3 w-[260px]"
          style={{ left: selPos.x, top: selPos.y, cursor: popDrag ? 'grabbing' : 'grab' }}
          onMouseDown={e => {
            if (e.target.closest('button')) return;
            setPopDrag(true);
            popDragStart.current = { x: e.clientX, y: e.clientY, sx: selPos.x, sy: selPos.y };
            const onMove = ev => setSelPos({ x: popDragStart.current.sx + (ev.clientX - popDragStart.current.x), y: popDragStart.current.sy + (ev.clientY - popDragStart.current.y) });
            const onUp = () => { setPopDrag(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        >
          <div className="flex justify-between items-start mb-1">
            <div className="text-sm font-bold flex-1">{sel.title}</div>
            <button onClick={() => setSel(null)} className="text-gray-400 hover:text-gray-600 mr-1 text-base leading-none">✕</button>
          </div>
          <div className="text-xs text-gray-400 mb-2">{sel.client_name} • {sel.due_date || '-'}</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {Object.entries(STS).map(([k, s]) => (
              <button key={k} onClick={() => { onStatusChange?.(sel, k); setSel(null); }}
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${sel.status === k ? 'ring-2' : 'opacity-40 hover:opacity-100'}`}
                style={{ borderColor: s.color, color: s.color }}>{s.icon}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {onEditTask && <button onClick={() => { onEditTask(sel); setSel(null); }} className="text-xs text-blue-600 font-bold">✏️ פתח</button>}
          </div>
        </div>
      )}

      <svg className="w-full h-full" style={{ cursor: dragId ? 'grabbing' : 'grab' }} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          <pattern id="g" width="50" height="50" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="0.6" fill="#D1D5DB" /></pattern>
          <rect x="-500" y="-300" width="4000" height="3000" fill="url(#g)" />

          {edges.map((e, i) => {
            const f = nodes.find(n => n.id === e.from);
            const t = nodes.find(n => n.id === e.to);
            if (!f || !t) return null;
            // Hide edges to collapsed children
            if (t.parentSvc && collapsed[t.parentSvc]) return null;
            const fp = getPos(f), tp = getPos(t);
            return <path key={i} d={bz(fp.x - 50, fp.y, tp.x + 110, tp.y)} fill="none" stroke={e.color} strokeWidth={2} opacity={0.4} />;
          })}

          {/* Center */}
          {nodes.filter(n => n.t === 'c').map(n => { const p = getPos(n); return (
            <g key={n.id} data-d="1" onMouseDown={e => startDrag(e, n.id)} style={{ cursor: 'move' }}>
              <circle cx={p.x} cy={p.y} r={55} fill="#1E3A5F" stroke="#0F172A" strokeWidth={3} />
              <foreignObject x={p.x - 50} y={p.y - 20} width={100} height={40}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ textAlign: 'center', color: 'white' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800 }}>{centerLabel}</div>
                  <div style={{ fontSize: '10px', opacity: 0.6 }}>{centerSub || `${tasks.length} משימות`}</div>
                </div>
              </foreignObject>
            </g>
          ); })}

          {/* Services */}
          {nodes.filter(n => n.t === 's').map(n => { const p = getPos(n); const isCol = collapsed[n.id]; const fc = fontForBg(n.color); return (
            <g key={n.id} data-d="1" onMouseDown={e => startDrag(e, n.id)} onDoubleClick={() => setCollapsed(prev => ({ ...prev, [n.id]: !prev[n.id] }))} style={{ cursor: 'move' }} title="גרור להזזה, לחיצה כפולה לסגירה/פתיחה">
              <rect x={p.x - 90} y={p.y - 24} width={180} height={48} rx={14} fill={n.color} stroke={isCol ? '#1E3A5F' : 'none'} strokeWidth={isCol ? 2 : 0} strokeDasharray={isCol ? '4 2' : 'none'} />
              <foreignObject x={p.x - 88} y={p.y - 22} width={176} height={44}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ textAlign: 'center', direction: 'rtl' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: fc }}>{n.label}</div>
                  <div style={{ fontSize: '11px', color: fc, opacity: 0.8 }}>{n.done}/{n.count}</div>
                </div>
              </foreignObject>
            </g>
          ); })}

          {/* Status nodes */}
          {nodes.filter(n => n.t === 'st' && !collapsed[n.parentSvc]).map(n => { const p = getPos(n); return (
            <g key={n.id} data-d="1" onMouseDown={e => startDrag(e, n.id)} style={{ cursor: 'move' }}>
              <rect x={p.x - 80} y={p.y - 18} width={160} height={36} rx={10} fill={n.fill} stroke={n.color} strokeWidth={2} />
              <foreignObject x={p.x - 78} y={p.y - 16} width={156} height={32}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', direction: 'rtl', gap: '4px' }}>
                  <span style={{ fontSize: '13px' }}>{n.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: n.color }}>{n.label}</span>
                  <span style={{ fontSize: '10px', color: n.color, opacity: 0.6 }}>({n.count})</span>
                </div>
              </foreignObject>
            </g>
          ); })}

          {/* Clients */}
          {nodes.filter(n => n.t === 't' && !collapsed[n.parentSvc]).map(n => { const p = getPos(n); const isHL = searchHL === n.id; const isSel = sel?.id === n.task?.id; return (
            <g key={n.id} data-d="1" onMouseDown={e => startDrag(e, n.id)} onDoubleClick={(e) => {
              const svgRect = ref.current?.getBoundingClientRect();
              if (svgRect) {
                setSelPos({ x: Math.min(e.clientX - svgRect.left, svgRect.width - 280), y: Math.max(e.clientY - svgRect.top - 120, 10) });
              }
              setSel(n.task);
            }} style={{ cursor: 'move' }} title="גרור להזזה, לחיצה כפולה לעריכה">
              <rect x={p.x - 105} y={p.y - 14} width={210} height={28} rx={8}
                fill={n.stCfg.fill} stroke={isHL ? '#1E3A5F' : isSel ? '#2563EB' : n.stCfg.color}
                strokeWidth={isHL || isSel ? 3 : 1} />
              <foreignObject x={p.x - 103} y={p.y - 13} width={206} height={26}>
                <div xmlns="http://www.w3.org/1999/xhtml"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 6px', direction: 'rtl', overflow: 'hidden' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: n.stCfg.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{n.label}</span>
                  {n.due && <span style={{ fontSize: '11px', fontWeight: 800, color: '#1E293B', flexShrink: 0, marginRight: '4px', background: 'rgba(255,255,255,0.7)', borderRadius: '4px', padding: '0 3px' }}>📅 {n.due}</span>}
                </div>
              </foreignObject>
            </g>
          ); })}
        </g>
      </svg>

      <div className="absolute bottom-3 left-3 w-32 h-20 bg-white/90 rounded-lg border shadow overflow-hidden">
        <svg viewBox="0 0 1600 1200" className="w-full h-full">
          {nodes.map(n => { const p = getPos(n); return <circle key={n.id} cx={p.x} cy={p.y} r={n.t === 'c' ? 10 : n.t === 's' ? 6 : n.t === 'st' ? 4 : 2} fill={n.color || n.stCfg?.color || '#1E3A5F'} opacity={0.5} />; })}
        </svg>
      </div>
    </div>
  );
}
