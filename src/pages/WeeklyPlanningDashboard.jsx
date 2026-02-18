import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, Clock, CheckCircle, Target,
  Brain, TrendingUp, ChevronLeft, ChevronRight,
  Sparkles, ArrowRight, ChevronDown, ChevronUp, Search, Pencil, Pin, Plus,
  BarChart3, Layers, ArrowLeftRight, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Task } from '@/api/entities';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import TaskToNoteDialog from '@/components/tasks/TaskToNoteDialog';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  format, addDays, startOfWeek, endOfWeek, parseISO,
  startOfDay, isSameDay
} from 'date-fns';
import { he } from 'date-fns/locale';
import { TASK_STATUS_CONFIG as statusConfig } from '@/config/processTemplates';

const WORK_DAYS = [
  { dayIndex: 0, name: 'ראשון', short: 'א' },
  { dayIndex: 1, name: 'שני', short: 'ב' },
  { dayIndex: 2, name: 'שלישי', short: 'ג' },
  { dayIndex: 3, name: 'רביעי', short: 'ד' },
  { dayIndex: 4, name: 'חמישי', short: 'ה' },
];

const MAX_DAILY_TASKS = 5;

const PRIORITY_CONFIG = {
  urgent: { label: 'דחוף', color: 'bg-amber-500 text-white', dot: 'bg-amber-500', order: 0 },
  high: { label: 'גבוה', color: 'bg-orange-400 text-white', dot: 'bg-orange-400', order: 1 },
  medium: { label: 'בינוני', color: 'bg-yellow-400 text-gray-800', dot: 'bg-yellow-400', order: 2 },
  low: { label: 'נמוך', color: 'bg-blue-300 text-white', dot: 'bg-blue-300', order: 3 },
};

const getCategoryLabel = (cat) => {
  const labels = {
    'work_vat_reporting': 'מע"מ', 'work_tax_advances': 'מקדמות', 'work_deductions': 'ניכויים',
    'work_social_security': 'ב"ל', 'work_payroll': 'שכר', 'work_client_management': 'ניהול',
    'מע"מ': 'מע"מ', 'מקדמות מס': 'מקדמות', 'ניכויים': 'ניכויים', 'ביטוח לאומי': 'ב"ל', 'שכר': 'שכר',
  };
  return labels[cat] || cat || 'אחר';
};

const CATEGORY_BAR_COLORS = {
  'מע"מ': 'bg-blue-500', 'מקדמות': 'bg-purple-500', 'ניכויים': 'bg-teal-500',
  'ב"ל': 'bg-rose-500', 'שכר': 'bg-orange-500', 'ניהול': 'bg-sky-500', 'אחר': 'bg-gray-400',
};
const CATEGORY_BADGE_COLORS = {
  'מע"מ': 'bg-blue-100 text-blue-700', 'מקדמות': 'bg-purple-100 text-purple-700',
  'ניכויים': 'bg-teal-100 text-teal-700', 'ב"ל': 'bg-rose-100 text-rose-700',
  'שכר': 'bg-orange-100 text-orange-700', 'ניהול': 'bg-sky-100 text-sky-700',
  'אחר': 'bg-gray-100 text-gray-600',
};

function MiniStatusDropdown({ task, onStatusChange }) {
  const sCfg = statusConfig[task.status] || statusConfig.not_started;
  return (
    <Select value={task.status || 'not_started'} onValueChange={(s) => onStatusChange(task, s)}>
      <SelectTrigger className={`h-6 text-[10px] px-1.5 w-auto min-w-[80px] border-0 ${sCfg.color}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(statusConfig).map(([key, { text }]) => (
          <SelectItem key={key} value={key} className="text-xs">{text}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RescheduleDropdown({ task, weekDays, onReschedule }) {
  return (
    <Select value="" onValueChange={(dayStr) => onReschedule(task, dayStr)}>
      <SelectTrigger className="h-6 text-[10px] px-1.5 w-auto min-w-[50px] border border-gray-200 bg-white">
        <ArrowLeftRight className="w-3 h-3" />
      </SelectTrigger>
      <SelectContent>
        {weekDays.map(wd => (
          <SelectItem key={wd.dateStr} value={wd.dateStr} className="text-xs">
            יום {wd.name} ({format(wd.date, 'dd/MM')})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WorkloadHeatmap({ dailyTasks, weekCategories }) {
  const maxTasks = Math.max(...Object.values(dailyTasks).map(d => d.tasks.length), MAX_DAILY_TASKS);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          מפת עומסים שבועית
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex gap-2 items-end h-32">
          {WORK_DAYS.map(wd => {
            const day = dailyTasks[wd.dayIndex];
            if (!day) return null;
            const taskCount = day.tasks.length;
            const heightPct = maxTasks > 0 ? (taskCount / maxTasks) * 100 : 0;
            const isOverloaded = taskCount > MAX_DAILY_TASKS;
            const completedCount = day.tasks.filter(t => t.status === 'completed').length;
            const completedPct = taskCount > 0 ? (completedCount / taskCount) * 100 : 0;

            // Category breakdown for this day
            const catCounts = {};
            day.tasks.forEach(t => {
              const cat = getCategoryLabel(t.category);
              catCounts[cat] = (catCounts[cat] || 0) + 1;
            });

            return (
              <div key={wd.dayIndex} className="flex-1 flex flex-col items-center gap-1">
                <span className={`text-[10px] font-bold ${isOverloaded ? 'text-amber-600' : 'text-gray-500'}`}>
                  {taskCount}
                </span>
                <div className="w-full relative" style={{ height: '80px' }}>
                  {/* Background bar */}
                  <div className="absolute bottom-0 w-full bg-gray-100 rounded-t-md" style={{ height: '100%' }} />
                  {/* Filled bar - stacked by category */}
                  <div
                    className="absolute bottom-0 w-full rounded-t-md overflow-hidden flex flex-col-reverse"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  >
                    {Object.entries(catCounts).map(([cat, count]) => {
                      const segPct = taskCount > 0 ? (count / taskCount) * 100 : 0;
                      return (
                        <div
                          key={cat}
                          className={`w-full ${CATEGORY_BAR_COLORS[cat] || 'bg-gray-400'}`}
                          style={{ height: `${segPct}%`, minHeight: '2px' }}
                        />
                      );
                    })}
                  </div>
                  {/* Completion overlay */}
                  {completedPct > 0 && completedPct < 100 && (
                    <div
                      className="absolute bottom-0 left-0 w-full border-t-2 border-emerald-500 border-dashed"
                      style={{ bottom: `${(completedPct / 100) * Math.max(heightPct, 4)}%` }}
                    />
                  )}
                  {/* Capacity line */}
                  {maxTasks > 0 && (
                    <div
                      className="absolute left-0 w-full border-t border-red-300 border-dashed"
                      style={{ bottom: `${(MAX_DAILY_TASKS / maxTasks) * 100}%` }}
                    />
                  )}
                </div>
                <div className={`text-[11px] font-bold ${day.isToday ? 'text-emerald-700' : 'text-gray-600'}`}>
                  {wd.short}׳
                </div>
                {day.isToday && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {weekCategories.map(cat => (
            <div key={cat} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_BAR_COLORS[cat] || 'bg-gray-400'}`} />
              <span className="text-[10px] text-gray-500">{cat}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 mr-2">
            <div className="w-4 border-t border-red-300 border-dashed" />
            <span className="text-[10px] text-gray-400">קיבולת ({MAX_DAILY_TASKS})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryWeekSummary({ weekTasks }) {
  const catData = useMemo(() => {
    const counts = {};
    weekTasks.forEach(t => {
      const cat = getCategoryLabel(t.category);
      if (!counts[cat]) counts[cat] = { total: 0, completed: 0 };
      counts[cat].total++;
      if (t.status === 'completed') counts[cat].completed++;
    });
    return Object.entries(counts).sort((a, b) => b[1].total - a[1].total);
  }, [weekTasks]);

  if (catData.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-600" />
          התפלגות לפי סוג עבודה
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-2">
          {catData.map(([cat, data]) => {
            const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className={`px-2 py-0.5 rounded text-[10px] font-medium min-w-[50px] text-center ${CATEGORY_BADGE_COLORS[cat] || 'bg-gray-100 text-gray-600'}`}>
                  {cat}
                </div>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${CATEGORY_BAR_COLORS[cat] || 'bg-gray-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 min-w-[50px] text-left">
                  {data.completed}/{data.total} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function WeeklyPlanningDashboard() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState({});
  const [expandedCompletedDays, setExpandedCompletedDays] = useState({});
  const { confirm, ConfirmDialogComponent } = useConfirm();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allTasks = await Task.list(null, 5000).catch(() => []);
      const nowMs = Date.now();
      const filtered = (allTasks || []).filter(task => {
        const taskDate = task.due_date || task.created_date;
        if (!taskDate) return true;
        const daysSince = Math.floor((nowMs - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24));
        if (task.status === 'completed' && daysSince > 14) return false;
        if (task.status !== 'completed' && daysSince > 21) return false;
        return true;
      });
      setTasks(filtered);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
    setIsLoading(false);
  };

  const today = useMemo(() => startOfDay(new Date()), []);

  const weekStart = useMemo(() => {
    const base = startOfWeek(today, { weekStartsOn: 0 });
    return addDays(base, weekOffset * 7);
  }, [today, weekOffset]);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const { dailyTasks, weekTasks, overdueTasks, stats, weekCategories, weekDaysData } = useMemo(() => {
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');

    let filtered = tasks;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = tasks.filter(t =>
        t.title?.toLowerCase().includes(lower) ||
        t.client_name?.toLowerCase().includes(lower) ||
        t.category?.toLowerCase().includes(lower)
      );
    }

    const weekTasks = filtered.filter(t => {
      const d = t.due_date;
      if (!d || d < weekStartStr || d > weekEndStr) return false;
      if (categoryFilter !== 'all') {
        const cat = getCategoryLabel(t.category);
        if (cat !== categoryFilter) return false;
      }
      return true;
    });

    const overdueTasks = filtered.filter(t => {
      if (t.status === 'completed' || t.status === 'not_relevant') return false;
      const d = t.due_date;
      return d && d < todayStr;
    });

    const daily = {};
    const weekDaysArr = [];
    for (const wd of WORK_DAYS) {
      const dayDate = addDays(weekStart, wd.dayIndex);
      const dayStr = format(dayDate, 'yyyy-MM-dd');
      const dayData = {
        ...wd,
        date: dayDate,
        dateStr: dayStr,
        isToday: isSameDay(dayDate, today),
        isPast: dayDate < today,
        tasks: weekTasks
          .filter(t => t.due_date === dayStr)
          .sort((a, b) => {
            const pa = PRIORITY_CONFIG[a.priority]?.order ?? 9;
            const pb = PRIORITY_CONFIG[b.priority]?.order ?? 9;
            return pa - pb;
          }),
      };
      daily[wd.dayIndex] = dayData;
      weekDaysArr.push(dayData);
    }

    // Unique categories in this week
    const catSet = new Set();
    weekTasks.forEach(t => catSet.add(getCategoryLabel(t.category)));
    const weekCategories = Array.from(catSet).sort();

    const completed = weekTasks.filter(t => t.status === 'completed').length;
    const total = weekTasks.length;

    return {
      dailyTasks: daily,
      weekTasks,
      overdueTasks,
      stats: { total, completed, remaining: total - completed, overdue: overdueTasks.length },
      weekCategories,
      weekDaysData: weekDaysArr,
    };
  }, [tasks, weekStart, weekEnd, today, searchTerm, categoryFilter]);

  // All categories for filter
  const allCategories = useMemo(() => {
    const catSet = new Set();
    tasks.forEach(t => catSet.add(getCategoryLabel(t.category)));
    return Array.from(catSet).sort();
  }, [tasks]);

  const recommendations = useMemo(() => {
    const recs = [];

    if (stats.overdue > 0) {
      recs.push({
        type: 'warning', icon: Clock,
        text: `${stats.overdue} משימות באיחור — כדאי לטפל או לעדכן תאריכים`,
      });
    }

    const overloadedDays = WORK_DAYS.filter(wd => dailyTasks[wd.dayIndex]?.tasks.length > MAX_DAILY_TASKS);
    const emptyDays = WORK_DAYS.filter(wd => {
      const dt = dailyTasks[wd.dayIndex];
      return dt && !dt.isPast && dt.tasks.length === 0;
    });

    if (overloadedDays.length > 0) {
      const dayNames = overloadedDays.map(d => d.name).join(', ');
      const emptyNames = emptyDays.map(d => d.name).join(', ');
      recs.push({
        type: 'balance', icon: ArrowLeftRight,
        text: `ימים עמוסים: ${dayNames}${emptyDays.length > 0 ? ` — אפשר להעביר ל${emptyNames}` : ` — מומלץ לפזר עד ${MAX_DAILY_TASKS} משימות ליום`}`,
      });
    }

    // Category concentration
    const dayCatConcentration = WORK_DAYS.map(wd => {
      const day = dailyTasks[wd.dayIndex];
      if (!day || day.tasks.length < 3) return null;
      const cats = {};
      day.tasks.forEach(t => {
        const c = getCategoryLabel(t.category);
        cats[c] = (cats[c] || 0) + 1;
      });
      const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 3) return { day: wd.name, cat: top[0], count: top[1] };
      return null;
    }).filter(Boolean);

    if (dayCatConcentration.length > 0) {
      const c = dayCatConcentration[0];
      recs.push({
        type: 'tip', icon: Layers,
        text: `יום ${c.day}: ${c.count} משימות ${c.cat} — ריכוז יכול לשפר יעילות, אבל שים לב לעומס`,
      });
    }

    if (stats.total > 0 && stats.completed / stats.total >= 0.7 && weekOffset === 0) {
      recs.push({
        type: 'success', icon: CheckCircle,
        text: `${Math.round((stats.completed / stats.total) * 100)}% מהמשימות הושלמו! כל הכבוד`,
      });
    }

    return recs;
  }, [stats, dailyTasks, weekOffset]);

  const handleStatusChange = useCallback(async (task, newStatus) => {
    try {
      const updateData = { ...task, status: newStatus };
      if (newStatus === 'completed') updateData.completed_date = format(new Date(), 'yyyy-MM-dd');
      await Task.update(task.id, updateData);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updateData } : t));
      syncNotesWithTaskStatus(task.id, newStatus);
    } catch (err) { console.error(err); }
  }, []);

  const handleReschedule = useCallback(async (task, newDateStr) => {
    try {
      await Task.update(task.id, { ...task, due_date: newDateStr });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, due_date: newDateStr } : t));
    } catch (err) { console.error(err); }
  }, []);

  const handleEditTask = async (taskId, updatedData) => {
    try {
      await Task.update(taskId, updatedData);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedData } : t));
    } catch (err) { console.error(err); }
  };

  const handleDeleteTask = async (task) => {
    setEditingTask(null);
    const ok = await confirm({
      title: 'מחיקת משימה',
      description: `האם למחוק את המשימה "${task.title}"?`,
      confirmText: 'מחק',
      cancelText: 'ביטול',
    });
    if (ok) {
      try {
        await Task.delete(task.id);
        setTasks(prev => prev.filter(t => t.id !== task.id));
      } catch (err) { console.error(err); }
    }
  };

  const toggleDay = (dayIndex) => {
    setCollapsedDays(prev => ({ ...prev, [dayIndex]: !prev[dayIndex] }));
  };

  const renderTaskRow = (task) => {
    const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
    const isCompleted = task.status === 'completed';
    const catLabel = getCategoryLabel(task.category);

    return (
      <div
        key={task.id}
        className={`flex items-center gap-2 p-2.5 rounded-lg transition-all group ${
          isCompleted ? 'bg-gray-50 opacity-60' : 'bg-white border border-gray-100 hover:border-gray-200'
        }`}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pri.dot}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {task.client_name && (
              <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{task.client_name}</span>
            )}
          </div>
        </div>
        <Badge className={`text-[9px] px-1.5 py-0 ${CATEGORY_BADGE_COLORS[catLabel] || 'bg-gray-100 text-gray-600'}`}>
          {catLabel}
        </Badge>
        <MiniStatusDropdown task={task} onStatusChange={handleStatusChange} />
        <RescheduleDropdown task={task} weekDays={weekDaysData} onReschedule={handleReschedule} />
        <button
          onClick={() => setNoteTask(task)}
          className="p-1 rounded hover:bg-amber-100 transition-colors opacity-0 group-hover:opacity-100"
          title="הוסף לפתק דביק"
        >
          <Pin className="w-3 h-3 text-gray-400" />
        </button>
        <button
          onClick={() => setEditingTask(task)}
          className="p-1 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100"
          title="ערוך משימה"
        >
          <Pencil className="w-3 h-3 text-gray-400" />
        </button>
      </div>
    );
  };

  const toggleCompletedDay = (dayIndex) => {
    setExpandedCompletedDays(prev => ({ ...prev, [dayIndex]: !prev[dayIndex] }));
  };

  const renderDayTasks = (dayTasks, dayIndex) => {
    const activeTasks = dayTasks.filter(t => t.status !== 'completed');
    const completedTasks = dayTasks.filter(t => t.status === 'completed');
    const showCompleted = !!expandedCompletedDays[dayIndex];

    const renderList = (taskList) => {
      if (!groupByCategory) return taskList.map(renderTaskRow);

      const groups = {};
      taskList.forEach(t => {
        const cat = getCategoryLabel(t.category);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(t);
      });

      return Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([cat, catTasks]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-1 mt-2 first:mt-0">
            <div className={`w-2 h-2 rounded-sm ${CATEGORY_BAR_COLORS[cat] || 'bg-gray-400'}`} />
            <span className="text-[10px] font-semibold text-gray-500">{cat} ({catTasks.length})</span>
          </div>
          {catTasks.map(renderTaskRow)}
        </div>
      ));
    };

    return (
      <>
        {renderList(activeTasks)}
        {completedTasks.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <button
              onClick={(e) => { e.stopPropagation(); toggleCompletedDay(dayIndex); }}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors w-full"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{completedTasks.length} הושלמו</span>
              {showCompleted ? <ChevronUp className="w-3 h-3 mr-auto" /> : <ChevronDown className="w-3 h-3 mr-auto" />}
            </button>
            {showCompleted && (
              <div className="mt-1.5 space-y-1">
                {renderList(completedTasks)}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
            <Brain className="w-8 h-8 text-indigo-600 animate-pulse" />
          </div>
          <p className="text-lg text-gray-500">טוען תכנון שבועי...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">תכנון שבועי</h1>
          <p className="text-base text-gray-500 mt-1">
            {format(weekStart, 'dd/MM')} — {format(weekEnd, 'dd/MM/yyyy', { locale: he })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(p => p - 1)} className="rounded-xl">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant={weekOffset === 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWeekOffset(0)}
            className={`rounded-xl font-bold ${weekOffset === 0 ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
          >
            השבוע
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(p => p + 1)} className="rounded-xl">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setShowQuickAdd(true)} className="gap-1 rounded-xl">
            <Plus className="w-4 h-4" />
            משימה מהירה
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="חיפוש לפי שם לקוח, משימה..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue placeholder="כל הקטגוריות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">כל הקטגוריות</SelectItem>
            {allCategories.map(cat => (
              <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={groupByCategory ? 'default' : 'outline'}
          size="sm"
          onClick={() => setGroupByCategory(!groupByCategory)}
          className="gap-1 text-xs h-9"
        >
          <Layers className="w-3.5 h-3.5" />
          קיבוץ
        </Button>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1 h-9">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'סה"כ משימות', value: stats.total, color: 'text-gray-800', bg: '' },
          { label: 'הושלמו', value: stats.completed, color: 'text-emerald-600', bg: '' },
          { label: 'נותרו', value: stats.remaining, color: 'text-blue-600', bg: '' },
          { label: 'באיחור', value: stats.overdue, color: stats.overdue > 0 ? 'text-amber-600' : 'text-gray-400', bg: stats.overdue > 0 ? 'bg-amber-50' : '' },
        ].map(({ label, value, color, bg }) => (
          <Card key={label} className={`border-0 shadow-sm ${bg}`}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workload Heatmap + Category Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <WorkloadHeatmap dailyTasks={dailyTasks} weekCategories={weekCategories} />
        <CategoryWeekSummary weekTasks={weekTasks} />
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          {recommendations.map((rec, i) => {
            const Icon = rec.icon;
            const bg = rec.type === 'warning' ? 'bg-amber-50 border-amber-200'
              : rec.type === 'success' ? 'bg-emerald-50 border-emerald-200'
              : rec.type === 'balance' ? 'bg-violet-50 border-violet-200'
              : 'bg-sky-50 border-sky-200';
            const textColor = rec.type === 'warning' ? 'text-amber-800'
              : rec.type === 'success' ? 'text-emerald-800'
              : rec.type === 'balance' ? 'text-violet-800'
              : 'text-sky-800';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-xl border ${bg}`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${textColor}`} />
                <p className={`text-sm font-medium ${textColor}`}>{rec.text}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <Card className="border-2 border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleDay('overdue')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                באיחור — דורש טיפול ({overdueTasks.length})
              </CardTitle>
              {collapsedDays['overdue'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </CardHeader>
          {!collapsedDays['overdue'] && (
            <CardContent className="pt-0 space-y-1.5">
              {overdueTasks.slice(0, 15).map(task => {
                const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                const catLabel = getCategoryLabel(task.category);
                return (
                  <div key={task.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-amber-100 group">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pri.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-800">{task.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {task.client_name && <span className="text-[10px] text-gray-400">{task.client_name}</span>}
                        {task.due_date && (
                          <span className="text-[10px] text-amber-600">
                            יעד: {format(parseISO(task.due_date), 'dd/MM', { locale: he })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-[9px] px-1.5 py-0 ${CATEGORY_BADGE_COLORS[catLabel] || 'bg-gray-100 text-gray-600'}`}>
                      {catLabel}
                    </Badge>
                    <MiniStatusDropdown task={task} onStatusChange={handleStatusChange} />
                    <RescheduleDropdown task={task} weekDays={weekDaysData} onReschedule={handleReschedule} />
                    <button onClick={() => setEditingTask(task)} className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                );
              })}
              {overdueTasks.length > 15 && (
                <div className="text-center pt-2">
                  <Link to={`${createPageUrl("Tasks")}?status=not_started`}>
                    <Button variant="outline" size="sm" className="text-amber-700 border-amber-200">
                      +{overdueTasks.length - 15} נוספות — צפה בכל המשימות
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Daily breakdown */}
      <div className="space-y-3">
        {WORK_DAYS.map((wd, idx) => {
          const day = dailyTasks[wd.dayIndex];
          if (!day) return null;
          const taskCount = day.tasks.length;
          const isOverloaded = taskCount > MAX_DAILY_TASKS;
          const completedCount = day.tasks.filter(t => t.status === 'completed').length;
          const activeCount = taskCount - completedCount;
          const isDayCollapsed = !!collapsedDays[wd.dayIndex];

          // Category mini-summary for the day header
          const dayCats = {};
          day.tasks.forEach(t => {
            const c = getCategoryLabel(t.category);
            dayCats[c] = (dayCats[c] || 0) + 1;
          });

          return (
            <motion.div
              key={wd.dayIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Card className={`border-0 shadow-sm overflow-hidden ${day.isToday ? 'ring-2 ring-indigo-400/50' : ''}`}>
                {/* Day header */}
                <div
                  className={`flex items-center justify-between px-4 py-2.5 cursor-pointer ${
                    day.isToday ? 'bg-indigo-50' : day.isPast ? 'bg-gray-50' : 'bg-white'
                  }`}
                  onClick={() => toggleDay(wd.dayIndex)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-base font-bold ${day.isToday ? 'text-indigo-700' : 'text-gray-700'}`}>
                      יום {wd.name}
                    </span>
                    <span className="text-sm text-gray-400">{format(day.date, 'dd/MM')}</span>
                    {day.isToday && <Badge className="bg-indigo-600 text-white text-[10px]">היום</Badge>}
                    {/* Category chips in header */}
                    {taskCount > 0 && (
                      <div className="flex gap-1 mr-2">
                        {Object.entries(dayCats).slice(0, 4).map(([cat, cnt]) => (
                          <span key={cat} className={`text-[9px] px-1.5 py-0 rounded ${CATEGORY_BADGE_COLORS[cat] || 'bg-gray-100 text-gray-500'}`}>
                            {cat} {cnt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Compact capacity */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(MAX_DAILY_TASKS, 7) }, (_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-4 rounded-full ${
                            i < taskCount
                              ? i < completedCount ? 'bg-emerald-400' : isOverloaded ? 'bg-amber-400' : 'bg-indigo-400'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                      {taskCount > MAX_DAILY_TASKS &&
                        Array.from({ length: Math.min(taskCount - MAX_DAILY_TASKS, 3) }, (_, i) => (
                          <div key={`over-${i}`} className="w-1.5 h-4 rounded-full bg-amber-400" />
                        ))
                      }
                    </div>
                    <span className={`text-xs font-bold ${isOverloaded ? 'text-amber-600' : activeCount > 0 ? 'text-gray-500' : 'text-emerald-600'}`}>
                      {completedCount > 0 ? `${completedCount}✓ ` : ''}{activeCount} פעילות
                    </span>
                    {isDayCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Tasks */}
                {!isDayCollapsed && (
                  <CardContent className={`px-4 py-2.5 ${taskCount === 0 ? 'py-4' : ''}`}>
                    {taskCount === 0 ? (
                      <p className="text-sm text-gray-400 text-center">
                        {day.isPast ? 'לא היו משימות' : 'יום פנוי — אפשר להעביר לכאן משימות מימים עמוסים'}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {renderDayTasks(day.tasks, wd.dayIndex)}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-600">התקדמות השבוע</span>
              <span className="text-sm text-gray-400">
                {stats.completed}/{stats.total} ({Math.round((stats.completed / stats.total) * 100)}%)
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(stats.completed / stats.total) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <QuickAddTaskDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onCreated={loadData}
      />
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleEditTask}
        onDelete={handleDeleteTask}
      />
      <TaskToNoteDialog
        task={noteTask}
        open={!!noteTask}
        onClose={() => setNoteTask(null)}
      />
      {ConfirmDialogComponent}
    </div>
  );
}
