import React, { useMemo, useState, useCallback, useRef } from 'react';
import { resolveCategoryLabel } from '@/utils/categoryLabels';
import { motion } from 'framer-motion';
import { format, parseISO, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval, addDays, addMonths, subMonths, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Task } from '@/api/entities';
import { toast } from 'sonner';
import { getScheduledStartForCategory } from '@/config/automationRules';
import { getPayrollTier, getVatEnergyTier, getTaskComplexity } from '@/engines/taskCascadeEngine';
import { getServiceForTask } from '@/config/processTemplates';
import { getServiceWeight } from '@/config/serviceWeights';
import { LOAD_COLORS } from '@/lib/theme-constants';
import { ChevronLeft, ChevronRight, CalendarDays, ArrowRight } from 'lucide-react';

// Service-type color coding for task capsules
const SERVICE_COLORS = {
  'מע"מ': { bg: '#3B82F6', border: '#2563EB', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
  'מע"מ 874': { bg: '#1D4ED8', border: '#1E40AF', gradient: 'linear-gradient(135deg, #1D4ED8, #1E40AF)' },
  'מקדמות מס': { bg: '#F97316', border: '#EA580C', gradient: 'linear-gradient(135deg, #F97316, #EA580C)' },
  'קליטת הכנסות': { bg: '#22C55E', border: '#16A34A', gradient: 'linear-gradient(135deg, #22C55E, #16A34A)' },
  'קליטת הוצאות': { bg: '#EC4899', border: '#DB2777', gradient: 'linear-gradient(135deg, #EC4899, #DB2777)' },
  'התאמות': { bg: '#F59E0B', border: '#D97706', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  'רווח והפסד': { bg: '#8B5CF6', border: '#7C3AED', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
  'שכר': { bg: '#06B6D4', border: '#0891B2', gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)' },
  'ביטוח לאומי': { bg: '#F43F5E', border: '#E11D48', gradient: 'linear-gradient(135deg, #F43F5E, #E11D48)' },
  'ניכויים': { bg: '#EAB308', border: '#CA8A04', gradient: 'linear-gradient(135deg, #EAB308, #CA8A04)' },
  'מס"ב ספקים': { bg: '#14B8A6', border: '#0D9488', gradient: 'linear-gradient(135deg, #14B8A6, #0D9488)' },
};

function getServiceColor(category) {
  return SERVICE_COLORS[category] || { bg: '#4682B4', border: '#1e3a8a', gradient: 'linear-gradient(135deg, #4682B4, #1e3a8a)' };
}

// Full Status Colors — DNA functional colors (no gray, NO TURQUOISE)
const STATUS_COLORS = {
  not_started:           { bg: '#1565C0', border: '#0D47A1', text: '#fff' },
  in_progress:           { bg: '#F57C00', border: '#E65100', text: '#fff' },
  waiting_for_materials: { bg: '#FF8F00', border: '#FF6F00', text: '#fff' },
  sent_for_review:       { bg: '#7B1FA2', border: '#6A1B9A', text: '#fff' },
  needs_corrections:     { bg: '#E65100', border: '#BF360C', text: '#fff' },
  production_completed:  { bg: '#2E7D32', border: '#1B5E20', text: '#fff' },
  completed:             { bg: '#1B5E20', border: '#004D40', text: '#fff' },
};

// Status labels (Hebrew)
const STATUS_LABELS = {
  not_started: 'לבצע',
  in_progress: 'בעבודה',
  waiting_for_materials: 'ממתין לחומרים',
  sent_for_review: 'הועבר לעיון',
  needs_corrections: 'לתיקון',
  production_completed: 'הושלם',
  completed: 'הושלם',
};

// DNA-driven: duration in minutes → calendar days (1 day = 480 min = 8h)
function getDNADurationDays(task) {
  const sw = getServiceWeight(task.category);
  const minutes = (task.estimated_time && task.estimated_time > 0) ? task.estimated_time : sw.duration;
  return Math.max(1, Math.ceil(minutes / 480)); // minimum 1 day
}

// Get cognitive load color for a task from DNA
function getTaskLoadColor(task) {
  const sw = getServiceWeight(task.category);
  const load = typeof task.cognitive_load === 'number' ? task.cognitive_load : sw.cognitiveLoad;
  return LOAD_COLORS[Math.min(3, Math.max(0, load))] || LOAD_COLORS[0];
}

// Check if client balance is unhealthy → burgundy glow
function isClientBalanceUnhealthy(client) {
  if (!client) return false;
  return client.balance_status === 'unhealthy' || client.has_overdue_balance === true;
}

// Estimated work-hours → calendar days mapping (legacy fallback)
const TIER_DURATION_DAYS = {
  nano: 1, small: 2, mid: 3, enterprise: 5,
  quick_win: 1, standard: 1, climb: 3,
};

const LANE_HEIGHT = 40; // px per lane — taller for capsules
const LANE_GAP = 8;     // px between lanes — more breathing room

/**
 * Allocate vertical lanes for overlapping task bars within a client row.
 * Returns a Map<taskId, laneIndex> and the total number of lanes needed.
 */
function allocateLanes(clientTasks, getTaskPosition) {
  const items = clientTasks
    .filter(t => t.due_date)
    .map(t => {
      const pos = getTaskPosition(t);
      return { id: t.id, start: pos.startDay, end: pos.startDay + pos.durationDays - 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const lanes = []; // lanes[i] = end day of last task in that lane
  const assignment = new Map();

  for (const item of items) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      if (item.start > lanes[i]) {
        lanes[i] = item.end;
        assignment.set(item.id, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      assignment.set(item.id, lanes.length);
      lanes.push(item.end);
    }
  }

  return { assignment, laneCount: Math.max(1, lanes.length) };
}

/**
 * Generate a soft shadow matching the DNA load color for capsule glow
 */
function capsuleShadow(loadColor, isHovered = false) {
  const base = `0 2px 8px ${loadColor}40, 0 1px 3px rgba(0,0,0,0.08)`;
  if (isHovered) return `0 6px 20px ${loadColor}50, 0 2px 6px rgba(0,0,0,0.12)`;
  return base;
}

/**
 * Generate cubic bezier SVG path between two points (curved dependency arrow)
 */
function curvedPath(x1Pct, y1, x2Pct, y2) {
  // We use percentage-based coordinates; SVG will interpret them via viewBox
  // Calculate control points for a smooth S-curve
  const midXPct = (x1Pct + x2Pct) / 2;
  return `M ${x1Pct} ${y1} C ${midXPct} ${y1}, ${midXPct} ${y2}, ${x2Pct} ${y2}`;
}

export default function GanttView({ tasks, clients, currentMonth, onEditTask }) {
  const [viewMonth, setViewMonth] = useState(currentMonth || new Date());
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const [draggingTask, setDraggingTask] = useState(null);
  const [dragPreviewDay, setDragPreviewDay] = useState(null);
  const dragStartX = useRef(0);
  const dragStartDay = useRef(0);
  const hasDragged = useRef(false);

  const goToPrevMonth = () => setViewMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setViewMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setViewMonth(new Date());

  // Filter tasks relevant to this month (must be defined BEFORE grouped)
  const monthTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!t.due_date) return false;
      const due = parseISO(t.due_date);
      const start = t.scheduled_start ? parseISO(t.scheduled_start) : due;
      return start <= monthEnd && due >= monthStart;
    });
  }, [tasks, monthStart, monthEnd]);

  const grouped = useMemo(() => {
    const groups = {};
    monthTasks.forEach(task => {
      const key = task.client_name || 'ללא לקוח';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    // Sort clients: manual sort_order first (min across tasks), then overdue, then alphabetical
    return Object.entries(groups).sort(([nameA, a], [nameB, b]) => {
      const minOrderA = Math.min(...a.map(t => t.sort_order ?? Infinity));
      const minOrderB = Math.min(...b.map(t => t.sort_order ?? Infinity));
      if (minOrderA !== minOrderB) return minOrderA - minOrderB;
      const aOverdue = a.some(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date());
      const bOverdue = b.some(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date());
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return nameA.localeCompare(nameB, 'he');
    });
  }, [monthTasks]);

  // Build client lookup for tier computation
  const clientByName = useMemo(() => {
    const map = {};
    (clients || []).forEach(c => { map[c.name] = c; });
    return map;
  }, [clients]);

  const getTaskPosition = (task) => {
    // Use scheduled_start if available, otherwise derive from Settings-driven execution periods
    const derivedStart = task.scheduled_start
      || getScheduledStartForCategory(task.category, task.due_date)
      || task.due_date;
    const start = parseISO(derivedStart);
    const end = parseISO(task.due_date);
    let startDay = Math.max(0, differenceInDays(start, monthStart));
    let endDay = Math.min(daysInMonth - 1, differenceInDays(end, monthStart));
    let width = Math.max(1, endDay - startDay + 1);

    // DNA-driven duration: enforce minimum bar width from serviceWeights
    const dnaDays = getDNADurationDays(task);
    if (width < dnaDays) {
      const newStart = Math.max(0, endDay - dnaDays + 1);
      startDay = newStart;
      width = dnaDays;
    }

    // Legacy tier-aware fallback
    const client = clientByName[task.client_name];
    const service = getServiceForTask(task);
    let tierKey = null;
    if (service?.key === 'payroll' && client) {
      tierKey = getPayrollTier(client).key;
    } else if (service?.key === 'vat') {
      tierKey = getVatEnergyTier(task).key;
    } else if (service?.key === 'reconciliation' || service?.key === 'annual_reports') {
      const complexity = getTaskComplexity(task, client);
      tierKey = complexity === 'high' ? 'climb' : complexity === 'medium' ? 'standard' : 'quick_win';
    }

    if (tierKey && TIER_DURATION_DAYS[tierKey]) {
      const tierDays = TIER_DURATION_DAYS[tierKey];
      if (width < tierDays) {
        const newStart = Math.max(0, endDay - tierDays + 1);
        startDay = newStart;
        width = tierDays;
      }
    }

    // Get cognitive load color from DNA
    const loadColor = getTaskLoadColor(task);

    return {
      left: `${(startDay / daysInMonth) * 100}%`,
      width: `${(width / daysInMonth) * 100}%`,
      startDay,
      durationDays: width,
      tierKey,
      loadColor,
      dnaDays,
    };
  };

  // Pre-compute lane assignments for each client group
  const laneData = useMemo(() => {
    const data = {};
    for (const [clientName, clientTasks] of grouped) {
      data[clientName] = allocateLanes(clientTasks, getTaskPosition);
    }
    return data;
  }, [grouped, clientByName, monthStart, daysInMonth]);

  // ── Drag & Drop: horizontal drag to change due_date ──
  const handlePointerDown = useCallback((e, task, pos) => {
    if (task.status === 'completed') {
      // Completed tasks: just open edit on click
      if (onEditTask) onEditTask(task);
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartX.current = e.clientX;
    dragStartDay.current = pos.startDay;
    hasDragged.current = false;
    setDraggingTask(task);
    setDragPreviewDay(null);
  }, [onEditTask]);

  const handlePointerMove = useCallback((e) => {
    if (!draggingTask) return;
    const timelineEl = e.currentTarget.closest('[data-timeline]');
    if (!timelineEl) return;
    const rect = timelineEl.getBoundingClientRect();
    const dayWidth = rect.width / daysInMonth;
    const dx = e.clientX - dragStartX.current;
    // Mark as dragged if pointer moved more than 5px
    if (Math.abs(dx) > 5) hasDragged.current = true;
    const dayOffset = Math.round(dx / dayWidth);
    if (dayOffset !== 0) {
      setDragPreviewDay(dayOffset);
    } else {
      setDragPreviewDay(null);
    }
  }, [draggingTask, daysInMonth]);

  const handlePointerUp = useCallback(async (e) => {
    if (!draggingTask) return;

    // If pointer didn't move → it's a click → open edit dialog
    if (!hasDragged.current) {
      const task = draggingTask;
      setDraggingTask(null);
      setDragPreviewDay(null);
      if (onEditTask) onEditTask(task);
      return;
    }

    if (dragPreviewDay === null || dragPreviewDay === 0) {
      setDraggingTask(null);
      setDragPreviewDay(null);
      return;
    }

    const task = draggingTask;
    const newDueDate = addDays(parseISO(task.due_date), dragPreviewDay);
    const updates = {
      due_date: format(newDueDate, 'yyyy-MM-dd'),
      reschedule_count: (task.reschedule_count || 0) + 1,
    };

    if (task.scheduled_start) {
      const newStart = addDays(parseISO(task.scheduled_start), dragPreviewDay);
      updates.scheduled_start = format(newStart, 'yyyy-MM-dd');
    }

    try {
      await Task.update(task.id, updates);
      toast.success(`${task.title} → ${format(newDueDate, 'dd/MM')}`);
    } catch {
      toast.error('שגיאה בעדכון תאריך');
    }

    setDraggingTask(null);
    setDragPreviewDay(null);
  }, [draggingTask, dragPreviewDay, onEditTask]);

  const isCurrentMonth = monthStart.getMonth() === new Date().getMonth() && monthStart.getFullYear() === new Date().getFullYear();

  // Count tasks per adjacent months for navigation hints
  const prevMonthCount = useMemo(() => {
    const ps = startOfMonth(subMonths(viewMonth, 1));
    const pe = endOfMonth(ps);
    return tasks.filter(t => t.due_date && parseISO(t.due_date) >= ps && parseISO(t.due_date) <= pe).length;
  }, [tasks, viewMonth]);
  const nextMonthCount = useMemo(() => {
    const ns = startOfMonth(addMonths(viewMonth, 1));
    const ne = endOfMonth(ns);
    return tasks.filter(t => t.due_date && parseISO(t.due_date) >= ns && parseISO(t.due_date) <= ne).length;
  }, [tasks, viewMonth]);

  // Visible service types in current month (for legend)
  const visibleServices = useMemo(() => {
    const seen = new Set();
    monthTasks.forEach(t => { if (t.category) seen.add(t.category); });
    return [...seen].filter(cat => SERVICE_COLORS[cat]);
  }, [monthTasks]);

  // Today marker position
  const todayFraction = isCurrentMonth ? differenceInDays(new Date(), monthStart) / daysInMonth : -1;

  return (
    <div className="bg-white rounded-2xl overflow-x-auto" style={{ border: '1px solid #E8E8E8' }}>
      {/* ── Month navigation header ── */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F0F0F0', background: '#FAFAFA' }}>
        <div className="flex items-center gap-3">
          <button onClick={goToPrevMonth} className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-full hover:bg-white transition-all text-[#555] text-xs" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <ChevronRight className="w-4 h-4" />
            {prevMonthCount > 0 && <span className="text-[#333] font-medium">({prevMonthCount})</span>}
          </button>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" style={{ color: '#4682B4' }} />
            <span className="text-sm font-bold text-[#222]">
              {format(monthStart, 'MMMM yyyy', { locale: he })}
            </span>
            <span className="text-xs text-[#888] font-medium">
              ({monthTasks.length} משימות)
            </span>
          </div>
          <button onClick={goToNextMonth} className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-full hover:bg-white transition-all text-[#555] text-xs" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <ChevronLeft className="w-4 h-4" />
            {nextMonthCount > 0 && <span className="text-[#333] font-medium">({nextMonthCount})</span>}
          </button>
        </div>
        <div className="flex items-center gap-4">
          {/* DNA Load Legend — capsule pills */}
          <div className="flex items-center gap-2">
            {[3, 2, 1, 0].map(tier => {
              const lc = LOAD_COLORS[tier];
              return (
                <div key={tier} className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${lc.color}15`, border: `1px solid ${lc.color}30` }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lc.color, boxShadow: `0 0 4px ${lc.color}60` }} />
                  <span className="text-[12px] font-medium" style={{ color: lc.color }}>{lc.label}</span>
                </div>
              );
            })}
          </div>
          {/* Service color legend */}
          {visibleServices.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap" style={{ borderRight: '1px solid #E8E8E8', paddingRight: '10px', marginRight: '4px' }}>
              {visibleServices.map(cat => {
                const sc = SERVICE_COLORS[cat];
                return (
                  <div key={cat} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: `${sc.bg}12`, border: `1px solid ${sc.bg}25` }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.bg }} />
                    <span className="text-[11px] font-medium" style={{ color: sc.bg }}>{cat}</span>
                  </div>
                );
              })}
            </div>
          )}
          {!isCurrentMonth && (
            <button onClick={goToCurrentMonth} className="px-3 py-1.5 rounded-full text-xs font-medium transition-all" style={{ background: '#4682B415', color: '#4682B4', border: '1px solid #4682B430' }}>
              חזור להיום
            </button>
          )}
        </div>
      </div>

      {monthTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#888] gap-3">
          <CalendarDays className="w-10 h-10 text-[#CCC]" />
          <p className="text-sm font-medium">אין משימות בחודש {format(monthStart, 'MMMM', { locale: he })}</p>
          <div className="flex gap-2 mt-2">
            {prevMonthCount > 0 && (
              <button onClick={goToPrevMonth} className="px-4 py-1.5 rounded-full text-xs transition-all font-medium" style={{ background: '#F5F5F5', color: '#555', border: '1px solid #E0E0E0' }}>
                ← {format(subMonths(monthStart, 1), 'MMMM', { locale: he })} ({prevMonthCount})
              </button>
            )}
            {nextMonthCount > 0 && (
              <button onClick={goToNextMonth} className="px-4 py-1.5 rounded-full text-xs transition-all font-medium" style={{ background: '#F5F5F5', color: '#555', border: '1px solid #E0E0E0' }}>
                {format(addMonths(monthStart, 1), 'MMMM', { locale: he })} ({nextMonthCount}) →
              </button>
            )}
          </div>
        </div>
      ) : (
      <>

      {/* ── Day columns header — minimal grid ── */}
      <div className="flex sticky top-0 z-10" style={{ borderBottom: '1px solid #F0F0F0', background: '#FAFAFA' }}>
        <div className="w-44 shrink-0 py-2 px-3 text-xs font-semibold text-[#888]" style={{ borderLeft: '1px solid #F0F0F0' }}>לקוח</div>
        <div className="flex-1 flex">
          {days.map(day => {
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const isSaturday = day.getDay() === 6;
            return (
              <div key={day.toISOString()}
                className="flex-1 text-center py-2"
                style={{
                  fontSize: '10px',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? '#4682B4' : isSaturday ? '#B0B0B0' : '#999',
                  borderLeft: '1px solid #F8F8F8',
                  background: isToday ? '#4682B408' : 'transparent',
                }}>
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Client rows with floating capsules ── */}
      {grouped.map(([clientName, clientTasks]) => {
        const { assignment, laneCount } = laneData[clientName] || { assignment: new Map(), laneCount: 1 };
        const rowHeight = laneCount * (LANE_HEIGHT + LANE_GAP) + LANE_GAP * 2;
        const client = clientByName[clientName];
        const balanceUnhealthy = isClientBalanceUnhealthy(client);
        // Build dependency chain: tasks sorted by due_date
        const sortedTasks = [...clientTasks].filter(t => t.due_date).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

        return (
          <div key={clientName} className="flex transition-colors" style={{ borderBottom: '1px solid #F5F5F5' }}>
            {/* Client name label */}
            <div className="w-44 shrink-0 py-2 px-3 flex items-center" style={{ borderLeft: '1px solid #F0F0F0' }}>
              <span className="text-sm font-medium text-[#333] truncate">
                {clientName}
              </span>
              {balanceUnhealthy && (
                <span className="mr-1.5 w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: '#800000', boxShadow: '0 0 6px #80000080' }} title="מאזן לא בריא" />
              )}
            </div>

            {/* Timeline area */}
            <div
              data-timeline
              className="flex-1 relative"
              style={{ minHeight: `${rowHeight}px` }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* ── Subtle vertical day guides ── */}
              {days.map((day, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${(i / daysInMonth) * 100}%`,
                    width: '1px',
                    background: day.getDay() === 6 ? '#F0F0F0' : '#F8F8F8',
                  }}
                />
              ))}

              {/* ── Today line (soft) ── */}
              {isCurrentMonth && todayFraction >= 0 && todayFraction <= 1 && (
                <div
                  className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{
                    left: `${todayFraction * 100}%`,
                    width: '2px',
                    background: 'linear-gradient(180deg, #4682B4 0%, #4682B440 100%)',
                    borderRadius: '1px',
                  }}
                />
              )}

              {/* ── Curved dependency arrows (Cubic Bezier) — viewBox coords, no percentages ── */}
              {(() => {
                const svgW = 1000;
                const totalH = Math.max(100, laneCount * (LANE_HEIGHT + LANE_GAP) + LANE_GAP);
                return (
                  <svg className="absolute inset-0 pointer-events-none overflow-visible" width="100%" height="100%" viewBox={`0 0 ${svgW} ${totalH}`} preserveAspectRatio="none" style={{ zIndex: 5 }}>
                    <defs>
                      <marker id="dep-arrow-capsule" viewBox="0 0 8 6" refX="7" refY="3"
                        markerWidth="5" markerHeight="4" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 z" fill="#B0B0B0" />
                      </marker>
                    </defs>
                    {sortedTasks.map((task, idx) => {
                      if (idx === 0) return null;
                      const prevTask = sortedTasks[idx - 1];
                      const prevPos = getTaskPosition(prevTask);
                      const curPos = getTaskPosition(task);
                      const prevLane = assignment.get(prevTask.id) || 0;
                      const curLane = assignment.get(task.id) || 0;
                      // Convert CSS % to viewBox absolute coordinates
                      const prevEndX = (parseFloat(prevPos.left) + parseFloat(prevPos.width)) * svgW / 100;
                      const curStartX = parseFloat(curPos.left) * svgW / 100;
                      if (curStartX <= prevEndX) return null; // overlapping, no arrow
                      const prevTopY = LANE_GAP + prevLane * (LANE_HEIGHT + LANE_GAP) + LANE_HEIGHT / 2;
                      const curTopY = LANE_GAP + curLane * (LANE_HEIGHT + LANE_GAP) + LANE_HEIGHT / 2;

                      // Curved Bezier path — pure numbers
                      const midX = (prevEndX + curStartX) / 2;
                      const pathD = `M ${prevEndX} ${prevTopY} C ${midX} ${prevTopY}, ${midX} ${curTopY}, ${curStartX} ${curTopY}`;

                      return (
                        <path key={`dep-${prevTask.id}-${task.id}`}
                          d={pathD}
                          fill="none"
                          stroke="#C0C0C0"
                          strokeWidth="1.5"
                          strokeDasharray="6 4"
                          markerEnd="url(#dep-arrow-capsule)"
                          opacity="0.6"
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </svg>
                );
              })()}

              {/* ── Floating capsule bars ── */}
              {sortedTasks.map(task => {
                const pos = getTaskPosition(task);
                const lane = assignment.get(task.id) || 0;
                const topPx = LANE_GAP + lane * (LANE_HEIGHT + LANE_GAP);
                const isOverdue = task.status !== 'completed' && task.status !== 'production_completed' && new Date(task.due_date) < new Date();
                const isDragging = draggingTask?.id === task.id;
                const offsetPct = isDragging && dragPreviewDay
                  ? `calc(${pos.left} + ${(dragPreviewDay / daysInMonth) * 100}%)`
                  : pos.left;
                const statusColor = STATUS_COLORS[task.status] || STATUS_COLORS.not_started;
                const svcColor = getServiceColor(task.category);
                const loadColor = pos.loadColor;
                const isCompleted = task.status === 'production_completed' || task.status === 'completed';
                const sw = getServiceWeight(task.category);
                const dnaMinutes = (task.estimated_time && task.estimated_time > 0) ? task.estimated_time : sw.duration;
                const clientObj = clientByName[task.client_name];
                const showBalanceGlow = isClientBalanceUnhealthy(clientObj);

                // Progress: how much of the capsule's timespan has elapsed
                const todayDay = differenceInDays(new Date(), monthStart);
                const progressPct = isCompleted
                  ? 100
                  : todayDay <= pos.startDay
                    ? 0
                    : todayDay >= pos.startDay + pos.durationDays
                      ? 100
                      : Math.round(((todayDay - pos.startDay) / pos.durationDays) * 100);

                return (
                  <Tooltip key={task.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        onPointerDown={(e) => handlePointerDown(e, task, pos)}
                        className={`absolute touch-none overflow-hidden
                          ${task.status === 'completed' ? 'cursor-pointer' : 'cursor-pointer active:cursor-grabbing'}
                          ${isDragging ? 'z-20' : 'z-10'}`}
                        style={{
                          left: offsetPct,
                          width: pos.width,
                          top: `${topPx}px`,
                          height: `${LANE_HEIGHT}px`,
                          borderRadius: '20px',
                          background: svcColor.gradient,
                          borderLeft: `4px solid ${loadColor.color}`,
                          borderRight: `3px solid ${svcColor.border}`,
                          boxShadow: isOverdue
                            ? `0 0 8px rgba(239, 68, 68, 0.6), 0 2px 8px ${loadColor.color}35`
                            : showBalanceGlow
                              ? `0 2px 12px ${loadColor.color}35, 0 0 12px #80000060, 0 1px 3px rgba(0,0,0,0.08)`
                              : isDragging
                                ? `0 8px 24px ${loadColor.color}40, 0 2px 8px rgba(0,0,0,0.15)`
                                : capsuleShadow(loadColor.color),
                          opacity: isDragging ? 0.9 : isCompleted ? 0.7 : 1,
                          ...(isOverdue ? {
                            outline: '2px solid #EF4444',
                            outlineOffset: '1px',
                          } : {}),
                        }}
                        initial={{ scaleX: 0, originX: 0, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        whileHover={!isDragging ? {
                          y: -3,
                          boxShadow: showBalanceGlow
                            ? `0 8px 24px ${loadColor.color}45, 0 0 16px #80000070, 0 2px 8px rgba(0,0,0,0.12)`
                            : capsuleShadow(loadColor.color, true),
                          transition: { duration: 0.2 },
                        } : undefined}
                      >
                        {/* Capsule inner content */}
                        <div className="absolute inset-0 flex items-center px-2.5 gap-1.5 pointer-events-none" style={{ minWidth: 0 }}>
                          {/* Completed checkmark */}
                          {isCompleted && (
                            <span className="flex-shrink-0 text-white text-[11px] leading-none" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>✓</span>
                          )}

                          {/* DNA load indicator dot */}
                          <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{
                            backgroundColor: loadColor.color,
                            boxShadow: `0 0 4px ${loadColor.color}80`,
                          }} />

                          {/* Task title */}
                          {pos.durationDays >= 2 && (
                            <span className="text-[12px] font-semibold text-white truncate leading-tight" style={{
                              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                              letterSpacing: '0.01em',
                            }}>
                              {task.title}
                            </span>
                          )}

                          {/* Duration badge (DNA minutes) — only on wider capsules */}
                          {pos.durationDays >= 3 && (
                            <span className="flex-shrink-0 text-[11px] font-medium rounded-full px-1.5 py-0.5 mr-auto" style={{
                              background: 'rgba(255,255,255,0.25)',
                              color: 'rgba(255,255,255,0.95)',
                              backdropFilter: 'blur(4px)',
                            }}>
                              {dnaMinutes}′
                            </span>
                          )}

                          {/* Balance unhealthy indicator — burgundy glow dot */}
                          {showBalanceGlow && (
                            <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{
                              background: '#800000',
                              boxShadow: '0 0 6px #800000, 0 0 10px #80000080',
                            }} />
                          )}

                          {/* Reschedule count badge */}
                          {(task.reschedule_count || 0) > 0 && (
                            <span className="flex-shrink-0 text-[9px] font-bold rounded-full px-1 leading-none" style={{
                              background: 'rgba(245,158,11,0.85)',
                              color: '#fff',
                              minWidth: '14px',
                              textAlign: 'center',
                              padding: '2px 3px',
                            }}
                              title={`נדחה ${task.reschedule_count} פעמים`}
                            >
                              ↻{task.reschedule_count}
                            </span>
                          )}
                        </div>

                        {/* Date progress fill — shows elapsed time within capsule */}
                        {progressPct > 0 && progressPct < 100 && !isCompleted && (
                          <>
                            {/* Elapsed portion: brighter */}
                            <div className="absolute inset-0 pointer-events-none" style={{
                              borderRadius: '20px',
                              clipPath: `inset(0 ${100 - progressPct}% 0 0)`,
                              background: 'rgba(255,255,255,0.08)',
                            }} />
                            {/* Progress edge marker */}
                            <div className="absolute top-[2px] bottom-[2px] pointer-events-none" style={{
                              left: `${progressPct}%`,
                              width: '2px',
                              background: 'rgba(255,255,255,0.45)',
                              borderRadius: '1px',
                            }} />
                            {/* Remaining portion: slightly dimmed */}
                            <div className="absolute inset-0 pointer-events-none" style={{
                              borderRadius: '20px',
                              clipPath: `inset(0 0 0 ${progressPct}%)`,
                              background: 'rgba(0,0,0,0.12)',
                            }} />
                          </>
                        )}

                        {/* Subtle glass shine overlay */}
                        <div className="absolute inset-0 pointer-events-none" style={{
                          borderRadius: '20px',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
                        }} />
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent
                      className="!border-0 !text-white"
                      style={{
                        background: '#1E1E2E',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        padding: '10px 14px',
                      }}
                    >
                      <p className="font-semibold !text-white text-sm">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: loadColor.color, boxShadow: `0 0 4px ${loadColor.color}80` }} />
                        <span className="text-xs !text-[#B0BEC5]">{loadColor.label}</span>
                        <span className="text-[12px] px-1.5 py-0.5 rounded-full" style={{ background: `${statusColor.bg}30`, color: statusColor.bg }}>
                          {STATUS_LABELS[task.status] || task.status}
                        </span>
                      </div>
                      <p className="text-xs !text-[#90A4AE] mt-1">
                        {resolveCategoryLabel(task.category)} {task.due_date && `\u2022 ${format(parseISO(task.due_date), 'dd/MM')}`}
                        {` \u2022 ${dnaMinutes} דק׳ (DNA)`}
                      </p>
                      {pos.durationDays > 1 && (
                        <p className="text-[12px] !text-[#78909C]">{pos.durationDays} ימי עבודה</p>
                      )}
                      {showBalanceGlow && (
                        <p className="text-[12px] mt-0.5" style={{ color: '#800000' }}>מאזן לקוח לא בריא</p>
                      )}
                      {(task.reschedule_count || 0) > 0 && (
                        <p className="text-[12px] text-amber-400">נדחה {task.reschedule_count} פעמים</p>
                      )}
                      <p className="text-[12px] text-[#607D8B] mt-1 opacity-70">לחץ לעריכה | גרור לשינוי תאריך</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Drag preview indicator — floating capsule style */}
      {draggingTask && dragPreviewDay !== null && dragPreviewDay !== 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 text-white text-xs px-4 py-2 pointer-events-none" style={{
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #4682B4, #4682B4DD)',
          boxShadow: '0 4px 16px rgba(70,130,180,0.4)',
        }}>
          {draggingTask.title}: {dragPreviewDay > 0 ? `+${dragPreviewDay}` : dragPreviewDay} ימים → {format(addDays(parseISO(draggingTask.due_date), dragPreviewDay), 'dd/MM')}
        </div>
      )}
      </>
      )}
    </div>
  );
}
