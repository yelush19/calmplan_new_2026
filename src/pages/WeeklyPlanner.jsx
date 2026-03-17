import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutGrid,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Plus,
  ChevronRight,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import { Task, Event, Client } from '@/api/entities';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function getWeekDates(offset = 0) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay() + (offset * 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function getStatusColor(status) {
  const colors = {
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return colors[status] || colors.not_started;
}

function getStatusLabel(status) {
  const labels = { completed: 'הושלם', in_progress: 'בביצוע', not_started: 'טרם התחיל', overdue: 'באיחור' };
  return labels[status] || status;
}

export default function WeeklyPlannerPage() {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = getWeekDates(weekOffset);
  const today = formatDate(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [t, e, c] = await Promise.all([
        Task.list('-due_date', 2000),
        Event.list('-start_date', 500),
        Client.list(null, 500),
      ]);
      setTasks(Array.isArray(t) ? t : []);
      setEvents(Array.isArray(e) ? e : []);
      setClients(Array.isArray(c) ? c : []);
    } catch (err) {
      console.error('Failed to load weekly planner data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTasksForDate = useCallback((dateStr) => {
    return tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'not_relevant') return false;
      const dueDate = (t.due_date || '').slice(0, 10);
      return dueDate === dateStr;
    });
  }, [tasks]);

  const getEventsForDate = useCallback((dateStr) => {
    return events.filter(e => {
      const startDate = (e.start_date || '').slice(0, 10);
      return startDate === dateStr;
    });
  }, [events]);

  const getClientName = useCallback((clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || '';
  }, [clients]);

  const weekStats = {
    totalTasks: weekDates.reduce((sum, d) => sum + getTasksForDate(formatDate(d)).length, 0),
    totalEvents: weekDates.reduce((sum, d) => sum + getEventsForDate(formatDate(d)).length, 0),
    overdue: tasks.filter(t => t.due_date && t.due_date.slice(0, 10) < today && t.status !== 'completed' && t.status !== 'not_relevant').length,
    completedThisWeek: tasks.filter(t => {
      if (t.status !== 'completed') return false;
      const cd = t.completed_date || t.updated_date || '';
      return weekDates.some(d => formatDate(d) === cd.slice(0, 10));
    }).length,
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} - ${weekDates[6].toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6" dir="rtl">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-6 h-6 text-[#1E3A5F]" />
          <h1 className="text-xl font-bold text-[#1E3A5F]">תכנון שבועי</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-6 h-6 text-[#1E3A5F] dark:text-white" />
          <div>
            <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white">תכנון שבועי</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{weekLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)} className="w-8 h-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>היום</Button>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)} className="w-8 h-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-xl shadow-sm border dark:bg-gray-900 dark:border-gray-700">
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">משימות השבוע</p>
              <p className="text-lg font-bold dark:text-white">{weekStats.totalTasks}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border dark:bg-gray-900 dark:border-gray-700">
          <CardContent className="p-3 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">אירועים</p>
              <p className="text-lg font-bold dark:text-white">{weekStats.totalEvents}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border dark:bg-gray-900 dark:border-gray-700">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">באיחור</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{weekStats.overdue}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border dark:bg-gray-900 dark:border-gray-700">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">הושלמו השבוע</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{weekStats.completedThisWeek}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map((date, idx) => {
          const dateStr = formatDate(date);
          const dayTasks = getTasksForDate(dateStr);
          const dayEvents = getEventsForDate(dateStr);
          const isToday = dateStr === today;

          return (
            <motion.div
              key={dateStr}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className={`rounded-xl shadow-sm border transition-shadow hover:shadow-md dark:bg-gray-900 dark:border-gray-700 ${
                isToday ? 'ring-2 ring-[#1E3A5F] dark:ring-blue-500' : ''
              }`}>
                <CardHeader className={`p-3 pb-2 ${isToday ? 'bg-[#1E3A5F]/5 dark:bg-blue-900/20' : ''}`}>
                  <div className="text-center">
                    <p className="text-xs font-bold text-[#1E3A5F] dark:text-white">{DAYS[idx]}</p>
                    <p className={`text-lg font-bold ${isToday ? 'text-[#1E3A5F] dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {date.getDate()}
                    </p>
                    {isToday && <Badge className="text-[10px] bg-[#1E3A5F]">היום</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="p-2 space-y-1 min-h-[120px]">
                  {dayEvents.map(event => (
                    <div key={event.id} className="text-[11px] p-1.5 bg-purple-50 dark:bg-purple-900/20 rounded border-s-2 border-purple-500 truncate">
                      <span className="font-medium dark:text-purple-300">{event.title}</span>
                    </div>
                  ))}
                  {dayTasks.map(task => (
                    <div key={task.id} className="text-[11px] p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded border-s-2 border-blue-400 truncate">
                      <span className="dark:text-blue-300">{task.title}</span>
                      {task.client_id && (
                        <span className="text-gray-400 dark:text-gray-500 block truncate">{getClientName(task.client_id)}</span>
                      )}
                    </div>
                  ))}
                  {dayTasks.length === 0 && dayEvents.length === 0 && (
                    <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center pt-4">יום פנוי</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
