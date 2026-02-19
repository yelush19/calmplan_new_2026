import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, startOfMonth, endOfMonth, differenceInDays, eachDayOfInterval } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_COLORS = {
  completed: 'bg-emerald-400',
  in_progress: 'bg-sky-400',
  not_started: 'bg-gray-300',
  waiting_for_materials: 'bg-amber-300',
  issue: 'bg-amber-500',
  reported_waiting_for_payment: 'bg-violet-300',
  ready_for_reporting: 'bg-indigo-300',
  waiting_for_approval: 'bg-cyan-300',
  postponed: 'bg-gray-400',
};

const SIZE_HEIGHT = { S: 'h-4', M: 'h-6', L: 'h-8', XL: 'h-10' };

const estimateClientSize = (client, tasks) => {
  if (client?.size) return client.size;
  const services = client?.service_types?.length || 0;
  const taskCount = tasks.filter(t => t.client_name === client?.name).length;
  if (services >= 4 || taskCount >= 8) return 'XL';
  if (services >= 3 || taskCount >= 5) return 'L';
  if (services >= 2 || taskCount >= 3) return 'M';
  return 'S';
};

export default function GanttView({ tasks, clients, currentMonth }) {
  const monthStart = startOfMonth(currentMonth || new Date());
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const grouped = useMemo(() => {
    const groups = {};
    tasks.forEach(task => {
      const key = task.client_name || 'ללא לקוח';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aOverdue = a.some(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date());
      const bOverdue = b.some(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date());
      return bOverdue - aOverdue;
    });
  }, [tasks]);

  const getClientSize = (clientName) => {
    const client = clients?.find(c => c.name === clientName);
    return estimateClientSize(client, tasks);
  };

  const getTaskPosition = (task) => {
    const start = task.scheduled_start ? parseISO(task.scheduled_start) : parseISO(task.due_date);
    const end = parseISO(task.due_date);
    const startDay = Math.max(0, differenceInDays(start, monthStart));
    const endDay = Math.min(daysInMonth - 1, differenceInDays(end, monthStart));
    const width = Math.max(1, endDay - startDay + 1);
    return { left: `${(startDay / daysInMonth) * 100}%`, width: `${(width / daysInMonth) * 100}%` };
  };

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-400">
        <p>אין משימות להצגה בציר הזמן</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border overflow-x-auto">
      {/* Header - days of month */}
      <div className="flex border-b bg-gray-50 sticky top-0 z-10">
        <div className="w-40 shrink-0 p-2 text-sm font-medium text-gray-600 border-l">לקוח</div>
        <div className="flex-1 flex">
          {days.map(day => (
            <div key={day.toISOString()}
              className={`flex-1 text-center text-[10px] p-1 border-l border-gray-100
                ${day.getDay() === 6 ? 'bg-red-50' : ''}`}>
              {format(day, 'd')}
            </div>
          ))}
        </div>
      </div>

      {/* Rows - clients */}
      {grouped.map(([clientName, clientTasks]) => {
        const clientSize = getClientSize(clientName);
        const heightClass = SIZE_HEIGHT[clientSize];
        return (
          <div key={clientName} className="flex border-b hover:bg-gray-50/50 transition-colors">
            <div className="w-40 shrink-0 p-2 text-sm text-gray-700 border-l flex items-center gap-1">
              <span className="font-medium truncate">{clientName}</span>
              <span className="text-[10px] text-gray-400">({clientSize})</span>
            </div>
            <div className="flex-1 relative min-h-[40px]">
              {clientTasks.filter(t => t.due_date).map(task => {
                const pos = getTaskPosition(task);
                const isOverdue = task.status !== 'completed' && new Date(task.due_date) < new Date();
                return (
                  <Tooltip key={task.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        className={`absolute top-1 ${heightClass} rounded-md cursor-pointer
                          ${STATUS_COLORS[task.status] || STATUS_COLORS.not_started}
                          ${isOverdue ? 'ring-2 ring-purple-500 animate-pulse' : ''}`}
                        style={{ left: pos.left, width: pos.width }}
                        initial={{ scaleX: 0, originX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-gray-400">
                        {task.category} {task.due_date && `\u2022 ${format(parseISO(task.due_date), 'dd/MM')}`}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
