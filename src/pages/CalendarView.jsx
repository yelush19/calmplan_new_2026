import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Calendar as CalendarIcon,
  CheckCircle, Clock, AlertTriangle,
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
  needs_corrections: 'bg-red-100 text-red-700',
  production_completed: 'bg-green-100 text-green-700',
};

const STATUS_LABELS = {
  not_started: 'טרם התחיל',
  waiting_for_materials: 'ממתין לחומרים',
  sent_for_review: 'נשלח לבדיקה',
  needs_corrections: 'דרוש תיקון',
  production_completed: 'הושלם ייצור',
};

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
    <button
      onClick={() => onSelect(dateKey, dayTasks)}
      className={`
        relative min-h-[72px] p-1.5 border rounded-lg text-right transition-colors
        ${isToday ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-300' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}
        ${hasTasks ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      <span className={`text-xs font-medium ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>
        {day}
      </span>
      {hasTasks && (
        <div className="mt-1 space-y-0.5">
          {dayTasks.slice(0, 3).map((t) => (
            <div key={t.id} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOTS[t.priority] || PRIORITY_DOTS.medium}`} />
              <span className="text-[10px] text-gray-700 truncate leading-tight">{t.title}</span>
            </div>
          ))}
          {dayTasks.length > 3 && (
            <span className="text-[10px] text-gray-400">+{dayTasks.length - 3} נוספות</span>
          )}
        </div>
      )}
      {hasUrgent && (
        <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      )}
    </button>
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
      className="w-80 border-r pr-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400">אין משימות ליום זה.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className="border-gray-200">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[t.priority] || PRIORITY_DOTS.medium}`} />
                  <span className="text-sm font-medium text-gray-900 truncate">{t.title}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.client_name && <Badge variant="outline" className="text-[10px]">{t.client_name}</Badge>}
                  {t.category && <Badge variant="outline" className="text-[10px]">{resolveCategoryLabel(t.category)}</Badge>}
                  {t.status && (
                    <Badge className={`text-[10px] ${STATUS_COLORS[t.status] || ''}`}>
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

  useEffect(() => {
    Task.list()
      .then((data) => setTasks(data || []))
      .catch(() => setTasks([]));
  }, []);

  // Group tasks by due_date
  const tasksByDate = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tasks]);

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

  // Stats
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthTasks = tasks.filter((t) => t.due_date?.startsWith(monthPrefix));
  const completedCount = monthTasks.filter((t) => t.status === 'production_completed').length;
  const urgentCount = monthTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-500" />
            תצוגת לוח שנה
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {monthTasks.length} משימות · {completedCount} הושלמו · {urgentCount} דחופות
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
