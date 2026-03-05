import React, { useMemo, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval, addDays, addMonths, subMonths, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Task } from '@/api/entities';
import { toast } from 'sonner';
import { getScheduledStartForCategory } from '@/config/automationRules';
import { getPayrollTier, getVatEnergyTier, getTaskComplexity } from '@/engines/taskCascadeEngine';
import { getServiceForTask } from '@/config/processTemplates';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

// 5 Golden Statuses
const STATUS_COLORS = {
  waiting_for_materials: 'bg-amber-300',
  not_started:           'bg-slate-300',
  sent_for_review:       'bg-purple-400',
  needs_corrections:     'bg-orange-400',
  production_completed:  'bg-emerald-500',
};

// Estimated work-hours → calendar days mapping
// Quick Win / Nano = 0.5 day, Standard/Small = 1 day, Mid = 2 days, Enterprise/Climb = 3+ days
const TIER_DURATION_DAYS = {
  nano: 1, small: 2, mid: 3, enterprise: 5,
  quick_win: 1, standard: 1, climb: 3,
};

const LANE_HEIGHT = 24; // px per lane
const LANE_GAP = 2;    // px between lanes

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
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aOverdue = a.some(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date());
      const bOverdue = b.some(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date());
      return bOverdue - aOverdue;
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

    // Tier-aware duration: if the task has a known tier, enforce minimum bar width
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
      // Enforce minimum width from tier, but don't shrink manually-set spans
      if (width < tierDays) {
        const newStart = Math.max(0, endDay - tierDays + 1);
        startDay = newStart;
        width = tierDays;
      }
    }

    return {
      left: `${(startDay / daysInMonth) * 100}%`,
      width: `${(width / daysInMonth) * 100}%`,
      startDay,
      durationDays: width,
      tierKey,
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

  return (
    <div className="bg-white rounded-2xl border overflow-x-auto">
      {/* ── Month navigation header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-l from-gray-50 to-white">
        <div className="flex items-center gap-2">
          <button onClick={goToPrevMonth} className="flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 text-xs">
            <ChevronRight className="w-4 h-4" />
            {prevMonthCount > 0 && <span className="text-gray-400">({prevMonthCount})</span>}
          </button>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-bold text-gray-800">
              {format(monthStart, 'MMMM yyyy', { locale: he })}
            </span>
            <span className="text-xs text-gray-400">
              ({monthTasks.length} משימות)
            </span>
          </div>
          <button onClick={goToNextMonth} className="flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 text-xs">
            <ChevronLeft className="w-4 h-4" />
            {nextMonthCount > 0 && <span className="text-gray-400">({nextMonthCount})</span>}
          </button>
        </div>
        {!isCurrentMonth && (
          <button onClick={goToCurrentMonth} className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium transition-colors">
            חזור להיום
          </button>
        )}
      </div>

      {monthTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
          <CalendarDays className="w-8 h-8 text-gray-300" />
          <p className="text-sm">אין משימות בחודש {format(monthStart, 'MMMM', { locale: he })}</p>
          <div className="flex gap-2 mt-2">
            {prevMonthCount > 0 && (
              <button onClick={goToPrevMonth} className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs transition-colors">
                ← {format(subMonths(monthStart, 1), 'MMMM', { locale: he })} ({prevMonthCount})
              </button>
            )}
            {nextMonthCount > 0 && (
              <button onClick={goToNextMonth} className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs transition-colors">
                {format(addMonths(monthStart, 1), 'MMMM', { locale: he })} ({nextMonthCount}) →
              </button>
            )}
          </div>
        </div>
      ) : (
      <>

      {/* Header - days of month */}
      <div className="flex border-b bg-gray-50 sticky top-0 z-10">
        <div className="w-40 shrink-0 p-2 text-sm font-medium text-gray-600 border-l">משימה / לקוח</div>
        <div className="flex-1 flex">
          {days.map(day => {
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            return (
              <div key={day.toISOString()}
                className={`flex-1 text-center text-[10px] p-1 border-l border-gray-100
                  ${day.getDay() === 6 ? 'bg-violet-50' : ''}
                  ${isToday ? 'bg-blue-100 font-bold text-blue-700' : ''}`}>
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rows - clients */}
      {grouped.map(([clientName, clientTasks]) => {
        const { assignment, laneCount } = laneData[clientName] || { assignment: new Map(), laneCount: 1 };
        const rowHeight = laneCount * (LANE_HEIGHT + LANE_GAP) + LANE_GAP;
        return (
          <div key={clientName} className="flex border-b hover:bg-[#F5F5F5] transition-colors">
            <div className="w-40 shrink-0 p-2 text-sm text-gray-700 border-l flex items-center">
              <span className="font-medium truncate">{clientName}</span>
            </div>
            <div
              data-timeline
              className="flex-1 relative"
              style={{ minHeight: `${rowHeight}px` }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {clientTasks.filter(t => t.due_date).map(task => {
                const pos = getTaskPosition(task);
                const lane = assignment.get(task.id) || 0;
                const topPx = LANE_GAP + lane * (LANE_HEIGHT + LANE_GAP);
                const isOverdue = task.status !== 'completed' && task.status !== 'production_completed' && new Date(task.due_date) < new Date();
                const isDragging = draggingTask?.id === task.id;
                const offsetPct = isDragging && dragPreviewDay
                  ? `calc(${pos.left} + ${(dragPreviewDay / daysInMonth) * 100}%)`
                  : pos.left;

                return (
                  <Tooltip key={task.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        onPointerDown={(e) => handlePointerDown(e, task, pos)}
                        className={`absolute rounded-md touch-none
                          ${task.status === 'completed' ? 'cursor-pointer' : 'cursor-pointer active:cursor-grabbing'}
                          ${STATUS_COLORS[task.status] || STATUS_COLORS.not_started}
                          ${isOverdue ? 'ring-2 ring-purple-500 animate-pulse' : ''}
                          ${isDragging ? 'opacity-80 z-20 ring-2 ring-blue-400 shadow-lg' : ''}`}
                        style={{ left: offsetPct, width: pos.width, top: `${topPx}px`, height: `${LANE_HEIGHT}px` }}
                        initial={{ scaleX: 0, originX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.3 }}
                        whileHover={!isDragging ? { y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } : undefined}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="!bg-gray-900 !border-gray-700 !text-white">
                      <p className="font-medium !text-white">{task.title}</p>
                      <p className="text-xs !text-gray-300">
                        {task.category} {task.due_date && `\u2022 ${format(parseISO(task.due_date), 'dd/MM')}`}
                        {pos.tierKey && ` \u2022 ${pos.tierKey}`}
                      </p>
                      {pos.durationDays > 1 && (
                        <p className="text-[10px] !text-gray-400">{pos.durationDays} ימי עבודה</p>
                      )}
                      {(task.reschedule_count || 0) > 0 && (
                        <p className="text-[10px] text-amber-400">נדחה {task.reschedule_count} פעמים {task.reschedule_count > 3 ? '🐌' : ''}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">לחץ לעריכה | גרור לשינוי תאריך</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Today line */}
      {isCurrentMonth && (() => {
        const todayFraction = differenceInDays(new Date(), monthStart) / daysInMonth;
        return (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 pointer-events-none"
            style={{ left: `calc(${todayFraction * 100}% + ${160 * (1 - todayFraction)}px)` }}
          />
        );
      })()}

      {/* Drag preview indicator */}
      {draggingTask && dragPreviewDay !== null && dragPreviewDay !== 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
          {draggingTask.title}: {dragPreviewDay > 0 ? `+${dragPreviewDay}` : dragPreviewDay} ימים → {format(addDays(parseISO(draggingTask.due_date), dragPreviewDay), 'dd/MM')}
        </div>
      )}
      </>
      )}
    </div>
  );
}
