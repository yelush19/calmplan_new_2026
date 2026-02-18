import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar, Clock, CheckCircle, Target,
  Brain, TrendingUp, Users, Briefcase, ChevronLeft, ChevronRight,
  Sparkles, ArrowRight, ChevronDown, ChevronUp, Search, Pencil, Trash2, Pin
} from 'lucide-react';
import { Task, Client } from '@/api/entities';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import TaskToNoteDialog from '@/components/tasks/TaskToNoteDialog';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  format, addDays, startOfWeek, endOfWeek, parseISO, isValid,
  startOfDay, isSameDay
} from 'date-fns';
import { he } from 'date-fns/locale';

// Israeli work days: Sun(0)=ראשון through Thu(4)=חמישי
const WORK_DAYS = [
  { dayIndex: 0, name: 'ראשון', short: 'א' },
  { dayIndex: 1, name: 'שני', short: 'ב' },
  { dayIndex: 2, name: 'שלישי', short: 'ג' },
  { dayIndex: 3, name: 'רביעי', short: 'ד' },
  { dayIndex: 4, name: 'חמישי', short: 'ה' },
];

const MAX_DAILY_TASKS = 5; // ADHD recommendation: no more than 5 tasks/day

const PRIORITY_CONFIG = {
  urgent: { label: 'דחוף', color: 'bg-amber-500 text-white', dot: 'bg-amber-500', order: 0 },
  high: { label: 'גבוה', color: 'bg-orange-400 text-white', dot: 'bg-orange-400', order: 1 },
  medium: { label: 'בינוני', color: 'bg-yellow-400 text-gray-800', dot: 'bg-yellow-400', order: 2 },
  low: { label: 'נמוך', color: 'bg-blue-300 text-white', dot: 'bg-blue-300', order: 3 },
};

function OverdueSection({ tasks }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayTasks = isExpanded ? tasks : tasks.slice(0, 5);

  return (
    <Card className="border-2 border-amber-200 bg-amber-50/50">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-amber-800">
            {tasks.length} משימות ממתינות לטיפול
          </h3>
          <Badge className="bg-amber-200 text-amber-800 text-xs">כדאי לטפל</Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-amber-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-amber-500" />
        )}
      </div>
      <CardContent className="px-5 pb-4 pt-0">
        <div className="space-y-2">
          {displayTasks.map(task => {
            const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white border border-amber-100"
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${pri.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.client_name && (
                      <span className="text-xs text-gray-400">{task.client_name}</span>
                    )}
                    {task.due_date && (
                      <span className="text-xs text-amber-600">
                        יעד: {format(parseISO(task.due_date), 'dd/MM', { locale: he })}
                      </span>
                    )}
                  </div>
                </div>
                <Badge className={`text-xs ${pri.color}`}>{pri.label}</Badge>
              </div>
            );
          })}
        </div>
        {tasks.length > 5 && !isExpanded && (
          <p className="text-center text-xs text-amber-600 mt-3 cursor-pointer" onClick={() => setIsExpanded(true)}>
            +{tasks.length - 5} נוספות...
          </p>
        )}
        <div className="mt-3 flex justify-center">
          <Link to={`${createPageUrl("Tasks")}?status=not_started`}>
            <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 hover:bg-amber-100">
              <ArrowRight className="w-4 h-4 ml-1" />
              צפה בכל המשימות
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WeeklyPlanningDashboard() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0=this week, 1=next, -1=prev
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const { confirm, ConfirmDialogComponent } = useConfirm();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allTasks = await Task.list(null, 5000).catch(() => []);
      // Filter out old completed tasks
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
    const base = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
    return addDays(base, weekOffset * 7);
  }, [today, weekOffset]);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  // Tasks grouped by day
  const { dailyTasks, weekTasks, overdueTasks, stats } = useMemo(() => {
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
      return d && d >= weekStartStr && d <= weekEndStr;
    });

    const overdueTasks = filtered.filter(t => {
      if (t.status === 'completed') return false;
      const d = t.due_date;
      return d && d < todayStr;
    });

    // Group by day of week
    const daily = {};
    for (const wd of WORK_DAYS) {
      const dayDate = addDays(weekStart, wd.dayIndex);
      const dayStr = format(dayDate, 'yyyy-MM-dd');
      daily[wd.dayIndex] = {
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
    }

    const completed = weekTasks.filter(t => t.status === 'completed').length;
    const total = weekTasks.length;

    return {
      dailyTasks: daily,
      weekTasks,
      overdueTasks,
      stats: { total, completed, remaining: total - completed, overdue: overdueTasks.length }
    };
  }, [tasks, weekStart, weekEnd, today, searchTerm]);

  // Smart recommendations
  const recommendations = useMemo(() => {
    const recs = [];

    // Overdue
    if (stats.overdue > 0) {
      recs.push({
        type: 'warning',
        icon: Clock,
        text: `${stats.overdue} משימות ממתינות לטיפול — כדאי לטפל או לעדכן תאריכים`,
      });
    }

    // Overloaded days
    const overloadedDays = WORK_DAYS.filter(wd => dailyTasks[wd.dayIndex]?.tasks.length > MAX_DAILY_TASKS);
    if (overloadedDays.length > 0) {
      const dayNames = overloadedDays.map(d => d.name).join(', ');
      recs.push({
        type: 'balance',
        icon: TrendingUp,
        text: `ימים עמוסים מדי (${dayNames}) — מומלץ לפזר עד ${MAX_DAILY_TASKS} משימות ליום`,
      });
    }

    // Empty days with tasks that could be moved
    const emptyWorkDays = WORK_DAYS.filter(wd => {
      const dt = dailyTasks[wd.dayIndex];
      return dt && !dt.isPast && dt.tasks.length === 0;
    });
    const busyWorkDays = WORK_DAYS.filter(wd => {
      const dt = dailyTasks[wd.dayIndex];
      return dt && !dt.isPast && dt.tasks.length > MAX_DAILY_TASKS;
    });
    if (emptyWorkDays.length > 0 && busyWorkDays.length > 0) {
      recs.push({
        type: 'tip',
        icon: Sparkles,
        text: `יום ${emptyWorkDays[0].name} פנוי — אפשר להעביר אליו משימות מימים עמוסים`,
      });
    }

    // Good progress
    if (stats.total > 0 && stats.completed / stats.total >= 0.7 && weekOffset === 0) {
      recs.push({
        type: 'success',
        icon: CheckCircle,
        text: `${Math.round((stats.completed / stats.total) * 100)}% מהמשימות הושלמו! כל הכבוד`,
      });
    }

    return recs;
  }, [stats, dailyTasks, weekOffset]);

  const handleEditTask = async (taskId, updatedData) => {
    try {
      await Task.update(taskId, updatedData);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedData } : t));
    } catch (err) {
      console.error('שגיאה בעדכון משימה:', err);
    }
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
      } catch (err) {
        console.error('שגיאה במחיקת משימה:', err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
            <Brain className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-lg text-gray-500">טוען תכנון שבועי...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header — with week navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">תכנון שבועי</h1>
          <p className="text-base text-gray-500 mt-1">
            {format(weekStart, 'dd/MM')} — {format(weekEnd, 'dd/MM/yyyy', { locale: he })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(p => p - 1)}
            className="rounded-xl"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant={weekOffset === 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWeekOffset(0)}
            className={`rounded-xl font-bold ${weekOffset === 0 ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
          >
            השבוע
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(p => p + 1)}
            className="rounded-xl"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="חיפוש לפי שם לקוח, משימה..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10 h-9"
        />
      </div>

      {/* Stats row — big numbers */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-gray-800">{stats.total}</p>
            <p className="text-sm text-gray-500 mt-1">סה"כ משימות</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-emerald-600">{stats.completed}</p>
            <p className="text-sm text-gray-500 mt-1">הושלמו</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-blue-600">{stats.remaining}</p>
            <p className="text-sm text-gray-500 mt-1">נותרו</p>
          </CardContent>
        </Card>
        <Card className={`border-0 shadow-sm ${stats.overdue > 0 ? 'bg-amber-50' : ''}`}>
          <CardContent className="p-4 text-center">
            <p className={`text-3xl font-black ${stats.overdue > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              {stats.overdue}
            </p>
            <p className="text-sm text-gray-500 mt-1">ממתינים לטיפול</p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          {recommendations.map((rec, i) => {
            const Icon = rec.icon;
            const bg = rec.type === 'warning' ? 'bg-amber-50 border-amber-200'
              : rec.type === 'success' ? 'bg-emerald-50 border-emerald-200'
              : 'bg-sky-50 border-sky-200';
            const textColor = rec.type === 'warning' ? 'text-amber-800'
              : rec.type === 'success' ? 'text-emerald-800'
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

      {/* Overdue tasks drill-down */}
      {overdueTasks.length > 0 && (
        <OverdueSection tasks={overdueTasks} />
      )}

      {/* Daily breakdown */}
      <div className="space-y-4">
        {WORK_DAYS.map((wd, idx) => {
          const day = dailyTasks[wd.dayIndex];
          if (!day) return null;
          const taskCount = day.tasks.length;
          const isOverloaded = taskCount > MAX_DAILY_TASKS;
          const completedCount = day.tasks.filter(t => t.status === 'completed').length;

          return (
            <motion.div
              key={wd.dayIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className={`border-0 shadow-sm overflow-hidden ${day.isToday ? 'ring-2 ring-emerald-400/50' : ''}`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-5 py-3 ${
                  day.isToday
                    ? 'bg-emerald-50'
                    : day.isPast
                      ? 'bg-gray-50'
                      : 'bg-white'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-black ${day.isToday ? 'text-emerald-700' : 'text-gray-700'}`}>
                      יום {wd.name}
                    </span>
                    <span className="text-sm text-gray-400">
                      {format(day.date, 'dd/MM')}
                    </span>
                    {day.isToday && (
                      <Badge className="bg-emerald-600 text-white text-xs">היום</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Capacity indicator */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: MAX_DAILY_TASKS }, (_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-5 rounded-full ${
                            i < taskCount
                              ? isOverloaded ? 'bg-amber-400' : 'bg-emerald-500'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                      {taskCount > MAX_DAILY_TASKS &&
                        Array.from({ length: taskCount - MAX_DAILY_TASKS }, (_, i) => (
                          <div key={`over-${i}`} className="w-2 h-5 rounded-full bg-amber-400" />
                        ))
                      }
                    </div>
                    <span className={`text-sm font-bold ${isOverloaded ? 'text-amber-600' : 'text-gray-500'}`}>
                      {taskCount}/{MAX_DAILY_TASKS}
                    </span>
                  </div>
                </div>

                {/* Tasks */}
                <CardContent className={`px-5 py-3 ${taskCount === 0 ? 'py-4' : ''}`}>
                  {taskCount === 0 ? (
                    <p className="text-sm text-gray-400 text-center">
                      {day.isPast ? 'לא היו משימות' : 'יום פנוי'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {day.tasks.map(task => {
                        const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                        const isCompleted = task.status === 'completed';
                        return (
                          <div
                            key={task.id}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                              isCompleted
                                ? 'bg-gray-50 opacity-50'
                                : 'bg-white border border-gray-100'
                            }`}
                          >
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${pri.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold truncate ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {task.title}
                              </p>
                              {task.client_name && (
                                <p className="text-xs text-gray-400 truncate">{task.client_name}</p>
                              )}
                            </div>
                            <Badge className={`text-xs ${pri.color}`}>{pri.label}</Badge>
                            <button
                              onClick={() => setNoteTask(task)}
                              className="p-1 rounded hover:bg-amber-100 transition-colors opacity-0 group-hover:opacity-100"
                              title="הוסף לפתק דביק"
                            >
                              <Pin className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                            <button
                              onClick={() => setEditingTask(task)}
                              className="p-1 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100"
                              title="ערוך משימה"
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                            {isCompleted && (
                              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar for the week */}
      {stats.total > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-600">התקדמות השבוע</span>
              <span className="text-sm text-gray-400">
                {stats.completed}/{stats.total} ({Math.round((stats.completed / stats.total) * 100)}%)
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(stats.completed / stats.total) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </CardContent>
        </Card>
      )}

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
