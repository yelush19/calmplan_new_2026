import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO, isValid, format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { STATUS_CONFIG } from '@/config/processTemplates';
import { Timer, CheckCircle, AlertTriangle } from 'lucide-react';

/**
 * ProjectTimelineView — Gantt-style timeline for dashboard tasks
 * Shows each client task as a bar from scheduled_start → due_date
 */
export default function ProjectTimelineView({ tasks, month, year, onEdit }) {
  // Build the timeline date range (the full month + 5 days padding)
  const timelineRange = useMemo(() => {
    const monthDate = new Date(year, month - 1, 1);
    const start = startOfMonth(monthDate);
    const end = addDays(endOfMonth(monthDate), 5);
    return { start, end, days: eachDayOfInterval({ start, end }) };
  }, [month, year]);

  // Group tasks by service category
  const grouped = useMemo(() => {
    const map = {};
    (tasks || []).forEach(t => {
      if (t.status === 'not_relevant') return;
      const cat = t.category || 'אחר';
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    });
    // Sort each group by due_date
    Object.values(map).forEach(arr => arr.sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date) : new Date('9999-12-31');
      const db = b.due_date ? new Date(b.due_date) : new Date('9999-12-31');
      return da - db;
    }));
    return map;
  }, [tasks]);

  const totalDays = timelineRange.days.length;

  const getBarStyle = (task) => {
    const dueDate = task.due_date ? parseISO(task.due_date) : null;
    const startDate = task.scheduled_start ? parseISO(task.scheduled_start) : null;

    if (!dueDate || !isValid(dueDate)) return null;

    const effectiveStart = startDate && isValid(startDate) ? startDate : addDays(dueDate, -3);
    const dayStart = Math.max(0, differenceInDays(effectiveStart, timelineRange.start));
    const dayEnd = Math.max(dayStart + 1, differenceInDays(dueDate, timelineRange.start) + 1);

    const left = (dayStart / totalDays) * 100;
    const width = Math.max(((dayEnd - dayStart) / totalDays) * 100, 2);

    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  const getBarColor = (task) => {
    if (task.status === 'completed') return 'bg-emerald-400';
    if (task.status === 'reported_waiting_for_payment') return 'bg-yellow-400';

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = task.due_date ? parseISO(task.due_date) : null;
    if (!due || !isValid(due)) return 'bg-gray-300';

    const remaining = differenceInDays(due, today);
    if (remaining < 0) return 'bg-amber-500';
    if (remaining <= 1) return 'bg-amber-400';
    if (remaining <= 3) return 'bg-amber-400';
    return 'bg-blue-400';
  };

  const todayPos = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = differenceInDays(today, timelineRange.start);
    if (d < 0 || d > totalDays) return null;
    return (d / totalDays) * 100;
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-l from-violet-50 to-blue-50 border-b flex items-center gap-2">
        <Timer className="w-5 h-5 text-violet-600" />
        <h3 className="text-sm font-bold text-gray-800">תצוגת פרויקט — ציר זמן</h3>
        <span className="text-xs text-gray-500">
          {format(timelineRange.start, 'MMM yyyy', { locale: he })}
        </span>
      </div>

      {/* Timeline header - day markers */}
      <div className="relative border-b border-gray-100">
        <div className="flex">
          <div className="w-[200px] shrink-0 px-3 py-1.5 text-[10px] text-gray-500 font-medium border-l bg-gray-50">
            משימה / לקוח
          </div>
          <div className="flex-1 relative h-7 bg-gray-50">
            <div className="absolute inset-0 flex">
              {timelineRange.days.map((day, i) => (
                <div
                  key={i}
                  className={`flex-1 text-center text-[8px] py-1.5 border-l border-gray-100 ${
                    isToday(day) ? 'bg-blue-100 font-bold text-blue-700' : day.getDay() === 6 ? 'bg-gray-100 text-gray-400' : 'text-gray-400'
                  }`}
                >
                  {day.getDate()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Task rows grouped by category */}
      <div className="max-h-[500px] overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
        {Object.entries(grouped).map(([category, catTasks]) => (
          <div key={category}>
            {/* Category header */}
            <div className="flex bg-gray-50/80 border-b border-gray-100">
              <div className="w-[200px] shrink-0 px-3 py-1 text-[10px] font-bold text-gray-600 border-l">
                {category}
                <span className="text-gray-400 font-normal mr-1">({catTasks.length})</span>
              </div>
              <div className="flex-1" />
            </div>

            {/* Task bars */}
            {catTasks.map(task => {
              const barStyle = getBarStyle(task);
              const barColor = getBarColor(task);
              const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const due = task.due_date ? parseISO(task.due_date) : null;
              const remaining = due && isValid(due) ? differenceInDays(due, today) : null;

              return (
                <div
                  key={task.id}
                  className="flex border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer group"
                  onClick={() => onEdit?.(task)}
                >
                  {/* Task info */}
                  <div className="w-[200px] shrink-0 px-3 py-1.5 border-l flex items-center gap-1.5 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-gray-800 truncate">
                        {task.client_name || task.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className={`text-[8px] px-1 py-0 h-3.5 ${statusCfg.color}`}>
                          {statusCfg.text}
                        </Badge>
                        {remaining !== null && (
                          <span className={`text-[9px] font-medium ${
                            remaining < 0 ? 'text-amber-600' : remaining <= 1 ? 'text-amber-500' : remaining <= 3 ? 'text-amber-600' : 'text-gray-400'
                          }`}>
                            {remaining < 0 ? `${Math.abs(remaining)}d-` : remaining === 0 ? 'היום' : `${remaining}d`}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    {remaining !== null && remaining < 0 && task.status !== 'completed' && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                  </div>

                  {/* Timeline bar area */}
                  <div className="flex-1 relative py-1.5">
                    {/* Today marker */}
                    {todayPos !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-500 z-10"
                        style={{ left: `${todayPos}%` }}
                      />
                    )}
                    {/* Task bar */}
                    {barStyle && (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full ${barColor} opacity-80 group-hover:opacity-100 transition-opacity shadow-sm`}
                        style={barStyle}
                        title={`${task.client_name || task.title} — ${task.due_date || ''}`}
                      >
                        <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-bold truncate px-1">
                          {task.client_name?.substring(0, 8) || ''}
                        </span>
                      </div>
                    )}
                    {/* Day grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {timelineRange.days.map((day, i) => (
                        <div key={i} className={`flex-1 border-l ${day.getDay() === 6 ? 'border-gray-200' : 'border-gray-50'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-gray-50 border-t flex items-center gap-3 text-[10px] text-gray-500">
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-emerald-400" /> הושלם</div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-blue-400" /> בעבודה</div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-amber-400" /> קרוב לדדליין</div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-amber-500" /> באיחור</div>
        <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-yellow-400" /> ממתין לתשלום</div>
        <div className="flex items-center gap-1 mr-auto"><div className="w-px h-3 bg-blue-500" /> היום</div>
      </div>
    </div>
  );
}
