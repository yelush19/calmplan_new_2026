import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Calendar as CalendarIcon,
  CheckCircle, Clock, AlertTriangle,
  Inbox, PlayCircle, Radio, Send, Eye, FileWarning, CircleCheck, Target,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/api/entities';
import { resolveCategoryLabel } from '@/utils/categoryLabels';

// ── Helpers ──

const DAYS_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  // Week starts on Sunday (0)
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  // Padding before first day
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

const STATUS_COLORS = {
  not_started: 'bg-gray-200 text-gray-700',
  waiting_for_materials: 'bg-yellow-100 text-yellow-800',
  sent_for_review: 'bg-blue-100 text-blue-700',
  ready_to_broadcast: 'bg-teal-100 text-teal-700',
  reported_pending_payment: 'bg-indigo-100 text-indigo-700',
  needs_corrections: 'bg-red-100 text-red-700',
  production_completed: 'bg-green-100 text-green-700',
};

const STATUS_LABELS = {
  not_started: 'טרם התחיל',
  waiting_for_materials: 'ממתין לחומרים',
  sent_for_review: 'הועבר לעיון',
  ready_to_broadcast: 'מוכן לשידור',
  reported_pending_payment: 'שודר, ממתין לתשלום',
  needs_corrections: 'דרוש תיקון',
  production_completed: 'הושלם ייצור',
};

// Status pipeline for DNA-style mini status bar (ordered by workflow progression)
const STATUS_PIPELINE = [
  { key: 'waiting_for_materials', label: 'ממתין לחומרים',       color: '#F59E0B', bg1: '#fffbeb', bg2: '#fef3c7', Icon: Inbox },
  { key: 'not_started',          label: 'לבצע',                color: '#64748B', bg1: '#f8fafc', bg2: '#f1f5f9', Icon: PlayCircle },
  { key: 'ready_to_broadcast',   label: 'מוכן לשידור',         color: '#0D9488', bg1: '#f0fdfa', bg2: '#ccfbf1', Icon: Radio },
  { key: 'reported_pending_payment', label: 'ממתין לתשלום',     color: '#4F46E5', bg1: '#eef2ff', bg2: '#e0e7ff', Icon: Send },
  { key: 'sent_for_review',      label: 'הועבר לעיון',         color: '#7C3AED', bg1: '#faf5ff', bg2: '#f3e8ff', Icon: Eye },
  { key: 'needs_corrections',    label: 'לתיקון',              color: '#EA580C', bg1: '#fff7ed', bg2: '#ffedd5', Icon: FileWarning },
  { key: 'production_completed', label: 'הושלם',               color: '#16A34A', bg1: '#f0fdf4', bg2: '#dcfce7', Icon: CircleCheck },
];

const PRIORITY_DOTS = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-gray-400',
};

// ── Components ──

function DayCell({ day, dateKey, tasks, isToday, onSelect }) {
  const dayTasks = tasks[dateKey] || [];
  const hasTasks = dayTasks.length > 0;
  const hasUrgent = dayTasks.some((t) => t.priority === 'urgent' || t.priority === 'high');

  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(dateKey, dayTasks)}
      className={`
        relative min-h-[72px] p-1.5 border rounded-lg text-end transition-colors dark:border-gray-700 dark:hover:border-gray-600 h-auto flex flex-col items-stretch
        ${isToday ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-300 dark:bg-blue-900/30' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'}
        ${hasTasks ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      <span className={`text-xs font-medium ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
        {day}
      </span>
      {hasTasks && (
        <div className="mt-1 space-y-0.5">
          {dayTasks.slice(0, 3).map((t) => (
            <div key={t.id} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOTS[t.priority] || PRIORITY_DOTS.medium}`} />
              <span className="text-[12px] text-gray-700 dark:text-gray-300 truncate leading-tight">{t.title}</span>
            </div>
          ))}
          {dayTasks.length > 3 && (
            <span className="text-[12px] text-gray-400">+{dayTasks.length - 3} נוספות</span>
          )}
        </div>
      )}
      {hasUrgent && (
        <span className="absolute top-1 start-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      )}
    </Button>
  );
}

function TaskDetailPanel({ dateKey, tasks, onClose }) {
  if (!dateKey) return null;
  const dateObj = new Date(dateKey + 'T00:00:00');
  const label = `${dateObj.getDate()} ${MONTHS_HE[dateObj.getMonth()]}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 border-e pe-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{label}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>&#x2715;</Button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400">אין משימות ליום זה.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className="border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[t.priority] || PRIORITY_DOTS.medium}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.title}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.client_name && <Badge variant="outline" className="text-[12px]">{t.client_name}</Badge>}
                  {t.category && <Badge variant="outline" className="text-[12px]">{resolveCategoryLabel(t.category)}</Badge>}
                  {t.status && (
                    <Badge className={`text-[12px] ${STATUS_COLORS[t.status] || ''}`}>
                      {STATUS_LABELS[t.status] || t.status}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Main ──

export default function CalendarView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);       // null = follow hideCompleted; or a specific status key
  const [hideCompleted, setHideCompleted] = useState(true);      // default ON — hide production_completed

  useEffect(() => {
    Task.list()
      .then((data) => setTasks(data || []))
      .catch(() => setTasks([]));
  }, []);

  // Apply status filtering to tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter) {
      // When a specific status is selected, show only that status (ignore hideCompleted)
      result = result.filter((t) => (t.status || 'not_started') === statusFilter);
    } else if (hideCompleted) {
      // Default: hide production_completed
      result = result.filter((t) => t.status !== 'production_completed');
    }
    return result;
  }, [tasks, statusFilter, hideCompleted]);

  // Group filtered tasks by due_date
  const tasksByDate = useMemo(() => {
    const map = {};
    for (const t of filteredTasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [filteredTasks]);

  const cells = useMemo(() => getMonthGrid(year, month), [year, month]);
  const todayKey = toDateKey(today);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const handleSelect = (dateKey, dayTasks) => {
    setSelectedDate(dateKey);
    setSelectedTasks(dayTasks);
  };

  // Stats — computed from ALL tasks (unfiltered) for the current month
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthTasks = tasks.filter((t) => t.due_date?.startsWith(monthPrefix));
  const completedCount = monthTasks.filter((t) => t.status === 'production_completed').length;
  const urgentCount = monthTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;

  // Filtered month tasks for the summary line
  const filteredMonthTasks = filteredTasks.filter((t) => t.due_date?.startsWith(monthPrefix));

  // Status counts for DNA pipeline (from ALL month tasks)
  const statusCounts = useMemo(() => {
    const counts = {};
    STATUS_PIPELINE.forEach((s) => { counts[s.key] = 0; });
    monthTasks.forEach((t) => {
      const key = t.status || 'not_started';
      if (counts[key] !== undefined) counts[key]++;
    });
    return counts;
  }, [monthTasks]);

  return (
    <div className="p-6 max-w-5xl mx-auto dark:bg-gray-900" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-500" />
            תצוגת לוח שנה
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filteredMonthTasks.length} משימות{statusFilter ? '' : ` · ${completedCount} הושלמו`} · {urgentCount} דחופות
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[140px] text-center">
            {MONTHS_HE[month]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
          >
            היום
          </Button>
        </div>
      </div>

      {/* DNA-style mini status pipeline bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3">
        {/* Total capsule */}
        <div className="rounded-2xl px-3 py-2 flex items-center gap-2 shrink-0 border border-slate-200 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-slate-100">
            <Target className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-center min-w-[28px]">
            <div className="text-base font-black leading-tight text-slate-700">{monthTasks.length}</div>
            <div className="text-[10px] text-slate-400 font-medium leading-tight">סה"כ</div>
          </div>
        </div>

        {STATUS_PIPELINE.map((phase, idx) => {
          const count = statusCounts[phase.key] || 0;
          const pct = monthTasks.length > 0 ? Math.round((count / monthTasks.length) * 100) : 0;
          const Icon = phase.Icon;
          const isActive = statusFilter === phase.key;
          return (
            <React.Fragment key={phase.key}>
              {idx > 0 && (
                <div className="flex items-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                </div>
              )}
              <button
                onClick={() => setStatusFilter((prev) => prev === phase.key ? null : phase.key)}
                className={`rounded-2xl px-3 py-2 flex items-center gap-2 shrink-0 border transition-all cursor-pointer hover:scale-[1.03] ${
                  isActive ? 'ring-2 ring-offset-1 shadow-md' : 'shadow-sm'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${phase.bg1} 0%, ${phase.bg2} 100%)`,
                  borderColor: count > 0 ? phase.color + '30' : '#e2e8f0',
                  ringColor: phase.color,
                  opacity: count === 0 ? 0.5 : 1,
                }}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: phase.color + '15', boxShadow: count > 0 ? `0 0 10px ${phase.color}20` : 'none' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: phase.color }} />
                </div>
                <div className="text-center min-w-[28px]">
                  <div className="text-base font-black leading-tight" style={{ color: count > 0 ? phase.color : '#94a3b8' }}>{count}</div>
                  <div className="text-[11px] text-slate-600 font-bold leading-tight whitespace-nowrap">{phase.label}</div>
                </div>
                {count > 0 && (
                  <div className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ color: phase.color, background: phase.color + '15' }}>
                    {pct}%
                  </div>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Filter controls row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Hide completed toggle */}
        <button
          onClick={() => { setHideCompleted((v) => !v); setStatusFilter(null); }}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            hideCompleted
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
              : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          הצג רק פתוחים
          <span className={`w-2 h-2 rounded-full ${hideCompleted ? 'bg-emerald-500' : 'bg-gray-300'}`} />
        </button>

        {/* Active filter badge */}
        {statusFilter && (
          <Badge
            className="bg-slate-100 text-slate-700 gap-1 px-2.5 py-1 text-xs font-bold cursor-pointer hover:bg-slate-200"
            onClick={() => setStatusFilter(null)}
          >
            סינון: {STATUS_PIPELINE.find((s) => s.key === statusFilter)?.label || statusFilter}
            <span className="mr-1">&#x2715;</span>
          </Badge>
        )}
      </div>

      <div className="flex gap-4">
        {/* Calendar Grid */}
        <div className="flex-1">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_HE.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) =>
              day === null ? (
                <div key={`empty-${i}`} className="min-h-[72px]" />
              ) : (
                <DayCell
                  key={day}
                  day={day}
                  dateKey={`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
                  tasks={tasksByDate}
                  isToday={toDateKey(new Date(year, month, day)) === todayKey}
                  onSelect={handleSelect}
                />
              )
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedDate && (
          <TaskDetailPanel
            dateKey={selectedDate}
            tasks={selectedTasks}
            onClose={() => { setSelectedDate(null); setSelectedTasks([]); }}
          />
        )}
      </div>
    </div>
  );
}
