import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task, Client } from '@/api/entities';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  CheckCircle, Clock, Calendar, User, TrendingUp, ArrowRight,
  RefreshCw, Target, AlertTriangle, BarChart3, Zap, Award,
  ChevronDown, ChevronUp, Activity, Search, Pencil, Trash2, Pin
} from 'lucide-react';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import TaskToNoteDialog from '@/components/tasks/TaskToNoteDialog';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  format, parseISO, isValid, startOfWeek, endOfWeek,
  differenceInDays, isWithinInterval, startOfDay, subWeeks
} from 'date-fns';
import { he } from 'date-fns/locale';

import { TASK_STATUS_CONFIG as statusConfig } from '@/config/processTemplates';

const getCategoryLabel = (cat) => {
  const labels = {
    'work_vat_reporting': 'מע"מ', 'work_tax_advances': 'מקדמות', 'work_deductions': 'ניכויים',
    'work_social_security': 'ב"ל', 'work_payroll': 'שכר', 'work_client_management': 'ניהול',
    'מע"מ': 'מע"מ', 'מקדמות מס': 'מקדמות', 'ניכויים': 'ניכויים', 'ביטוח לאומי': 'ב"ל', 'שכר': 'שכר',
  };
  return labels[cat] || cat || '';
};

function ProgressBar({ value, max, color = 'bg-blue-500', label, sublabel }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{sublabel || `${value}/${max}`}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

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

export default function WeeklySummary() {
  const [isLoading, setIsLoading] = useState(true);
  const [rawTasks, setRawTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [expandedSection, setExpandedSection] = useState('overdue');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const { confirm, ConfirmDialogComponent } = useConfirm();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasks, clientsData] = await Promise.all([
        Task.list(null, 5000).catch(() => []),
        Client.list(null, 500).catch(() => [])
      ]);
      setRawTasks(tasks || []);
      setClients(clientsData || []);
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  const filteredRawTasks = useMemo(() => {
    if (!searchTerm) return rawTasks;
    const lower = searchTerm.toLowerCase();
    return rawTasks.filter(t =>
      t.title?.toLowerCase().includes(lower) ||
      t.client_name?.toLowerCase().includes(lower) ||
      t.category?.toLowerCase().includes(lower)
    );
  }, [rawTasks, searchTerm]);

  const analysis = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    const prevWeekStart = subWeeks(weekStart, 1);
    const prevWeekEnd = subWeeks(weekEnd, 1);
    const nextWeekEnd = new Date(weekEnd);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    const nextWeekStart = new Date(weekEnd);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);

    const active = filteredRawTasks.filter(t => t.status !== 'completed' && t.status !== 'not_relevant');
    const completed = filteredRawTasks.filter(t => t.status === 'completed');

    const overdue = active.filter(task => {
      const d = task.due_date;
      if (!d) return false;
      try { const dd = parseISO(d); dd.setHours(23,59,59,999); return dd < today && differenceInDays(today, dd) <= 21; }
      catch { return false; }
    }).sort((a,b) => new Date(a.due_date) - new Date(b.due_date));

    const completedThisWeek = completed.filter(t => {
      const d = t.completed_date || t.updated_date;
      if (!d) return false;
      try { return isWithinInterval(parseISO(d), { start: weekStart, end: weekEnd }); } catch { return false; }
    });

    const completedPrevWeek = completed.filter(t => {
      const d = t.completed_date || t.updated_date;
      if (!d) return false;
      try { return isWithinInterval(parseISO(d), { start: prevWeekStart, end: prevWeekEnd }); } catch { return false; }
    });

    const failedThisWeek = active.filter(task => {
      const d = task.due_date;
      if (!d) return false;
      try { return isWithinInterval(startOfDay(parseISO(d)), { start: weekStart, end: weekEnd }); } catch { return false; }
    });

    const upcoming = active.filter(task => {
      const d = task.due_date;
      if (!d) return false;
      try { return isWithinInterval(startOfDay(parseISO(d)), { start: nextWeekStart, end: nextWeekEnd }); } catch { return false; }
    }).sort((a,b) => new Date(a.due_date) - new Date(b.due_date));

    // Category breakdown
    const catCounts = {};
    overdue.forEach(t => {
      const cat = getCategoryLabel(t.category) || 'אחר';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const topCategories = Object.entries(catCounts).sort((a,b) => b[1] - a[1]).slice(0, 6);

    // Client breakdown (top 5 by overdue count)
    const clientCounts = {};
    overdue.forEach(t => {
      const cn = t.client_name || 'לא מסווג';
      if (!clientCounts[cn]) clientCounts[cn] = { tasks: [], count: 0, maxDays: 0 };
      const days = differenceInDays(today, parseISO(t.due_date));
      clientCounts[cn].tasks.push({ ...t, daysOverdue: days });
      clientCounts[cn].count++;
      clientCounts[cn].maxDays = Math.max(clientCounts[cn].maxDays, days);
    });
    const topClients = Object.entries(clientCounts).sort((a,b) => b[1].count - a[1].count).slice(0, 8);

    // Status distribution
    const statusDist = {};
    active.forEach(t => {
      const s = t.status || 'not_started';
      statusDist[s] = (statusDist[s] || 0) + 1;
    });

    const weeklyTrend = completedThisWeek.length - completedPrevWeek.length;

    return {
      overdue, completedThisWeek, failedThisWeek, upcoming,
      topCategories, topClients, statusDist,
      activeCount: active.length, completedCount: completedThisWeek.length,
      prevWeekCompleted: completedPrevWeek.length, weeklyTrend,
    };
  }, [filteredRawTasks, clients]);

  const handleStatusChange = async (task, newStatus) => {
    try {
      await Task.update(task.id, { ...task, status: newStatus });
      setRawTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    } catch (err) { console.error(err); }
  };

  const handleEditTask = async (taskId, updatedData) => {
    try {
      await Task.update(taskId, updatedData);
      setRawTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedData } : t));
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
        setRawTasks(prev => prev.filter(t => t.id !== task.id));
      } catch (err) {
        console.error('שגיאה במחיקת משימה:', err);
      }
    }
  };

  const toggleSection = (s) => setExpandedSection(expandedSection === s ? null : s);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const weekLabel = `${format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'dd/MM', { locale: he })} - ${format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'dd/MM', { locale: he })}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">סיכום שבועי</h1>
          <p className="text-sm text-gray-500">שבוע {weekLabel}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
          <RefreshCw className="w-4 h-4" /> רענן
        </Button>
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

      {/* KPI Row - 5 metrics */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { icon: AlertTriangle, label: 'באיחור', value: analysis.overdue.length, color: analysis.overdue.length > 0 ? 'text-amber-600' : 'text-emerald-600', bg: analysis.overdue.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50' },
          { icon: CheckCircle, label: 'הושלמו השבוע', value: analysis.completedCount, color: 'text-emerald-600', bg: 'border-emerald-200 bg-emerald-50' },
          { icon: Clock, label: 'לא הושלמו', value: analysis.failedThisWeek.length, color: analysis.failedThisWeek.length > 0 ? 'text-stone-600' : 'text-gray-400', bg: 'border-stone-200 bg-stone-50' },
          { icon: Target, label: 'שבוע הבא', value: analysis.upcoming.length, color: 'text-sky-600', bg: 'border-sky-200 bg-sky-50' },
          { icon: Activity, label: 'מגמה', value: analysis.weeklyTrend >= 0 ? `+${analysis.weeklyTrend}` : `${analysis.weeklyTrend}`, color: analysis.weeklyTrend >= 0 ? 'text-emerald-600' : 'text-red-600', bg: analysis.weeklyTrend >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50' },
        ].map(({ icon: Icon, label, value, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={`${bg} h-full`}>
              <CardContent className="p-3 text-center">
                <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-500">{label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Left: Status distribution + Category breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              התפלגות סטטוסים
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {Object.entries(analysis.statusDist).sort((a,b) => b[1] - a[1]).map(([status, count]) => {
              const cfg = statusConfig[status];
              if (!cfg) return null;
              return (
                <ProgressBar
                  key={status}
                  label={cfg.text}
                  value={count}
                  max={analysis.activeCount}
                  color={status === 'in_progress' ? 'bg-sky-500' :
                    status === 'not_started' ? 'bg-gray-400' :
                    status === 'waiting_for_materials' ? 'bg-amber-500' :
                    status === 'ready_for_reporting' ? 'bg-teal-500' :
                    status === 'issue' ? 'bg-pink-500' :
                    status === 'waiting_for_approval' ? 'bg-purple-500' :
                    'bg-gray-400'}
                  sublabel={`${count} (${analysis.activeCount > 0 ? Math.round(count/analysis.activeCount*100) : 0}%)`}
                />
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              איחורים לפי קטגוריה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {analysis.topCategories.length === 0 ? (
              <div className="text-center py-4">
                <Award className="w-8 h-8 mx-auto text-emerald-400 mb-1" />
                <p className="text-sm text-gray-500">אין איחורים!</p>
              </div>
            ) : (
              analysis.topCategories.map(([cat, count]) => (
                <ProgressBar
                  key={cat}
                  label={cat}
                  value={count}
                  max={analysis.overdue.length}
                  color="bg-amber-500"
                  sublabel={`${count} משימות`}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue - collapsible, compact, by client */}
      {analysis.topClients.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('overdue')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                דורש טיפול ({analysis.overdue.length})
              </CardTitle>
              {expandedSection === 'overdue' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          {expandedSection === 'overdue' && (
            <CardContent className="space-y-3 pt-0">
              {analysis.topClients.map(([clientName, data]) => (
                <div key={clientName} className="border rounded-lg p-3 bg-amber-50/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-sm">{clientName}</span>
                      <Badge className="bg-amber-100 text-amber-700 text-[10px]">{data.count}</Badge>
                    </div>
                    <span className="text-[10px] text-stone-500">מקס׳ {data.maxDays} ימים</span>
                  </div>
                  <div className="space-y-1">
                    {data.tasks.map(task => (
                      <div key={task.id} className="flex items-center gap-2 p-1.5 rounded bg-white text-xs group">
                        <div className={`w-1.5 h-1.5 rounded-full ${task.daysOverdue > 7 ? 'bg-red-500' : task.daysOverdue > 3 ? 'bg-amber-500' : 'bg-yellow-400'}`} />
                        <span className="flex-1 truncate">{task.title}</span>
                        <button onClick={() => setEditingTask(task)} className="p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity" title="ערוך">
                          <Pencil className="w-3 h-3 text-gray-400" />
                        </button>
                        <MiniStatusDropdown task={task} onStatusChange={handleStatusChange} />
                        <span className="text-gray-400 shrink-0">{task.daysOverdue}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Failed this week - collapsible */}
      {analysis.failedThisWeek.length > 0 && (
        <Card className="border-stone-200">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('failed')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-stone-700">
                <Clock className="w-4 h-4" />
                לא הושלמו השבוע ({analysis.failedThisWeek.length})
              </CardTitle>
              {expandedSection === 'failed' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          {expandedSection === 'failed' && (
            <CardContent className="pt-0">
              <div className="space-y-1">
                {analysis.failedThisWeek.map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded bg-stone-50 text-xs group">
                    <span className="flex-1 font-medium truncate">{task.title}</span>
                    {task.client_name && <span className="text-gray-400 shrink-0">{task.client_name}</span>}
                    <button onClick={() => setNoteTask(task)} className="p-0.5 rounded hover:bg-amber-100 opacity-0 group-hover:opacity-100 transition-opacity" title="הוסף לפתק">
                      <Pin className="w-3 h-3 text-gray-400" />
                    </button>
                    <button onClick={() => setEditingTask(task)} className="p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity" title="ערוך">
                      <Pencil className="w-3 h-3 text-gray-400" />
                    </button>
                    <MiniStatusDropdown task={task} onStatusChange={handleStatusChange} />
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Upcoming - collapsible */}
      {analysis.upcoming.length > 0 && (
        <Card className="border-sky-200">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('upcoming')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-sky-700">
                <Calendar className="w-4 h-4" />
                שבוע הבא ({analysis.upcoming.length})
              </CardTitle>
              {expandedSection === 'upcoming' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          {expandedSection === 'upcoming' && (
            <CardContent className="pt-0">
              <div className="space-y-1">
                {analysis.upcoming.map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded bg-sky-50 text-xs group">
                    <span className="flex-1 font-medium truncate">{task.title}</span>
                    {task.client_name && <span className="text-gray-400 shrink-0">{task.client_name}</span>}
                    <button onClick={() => setNoteTask(task)} className="p-0.5 rounded hover:bg-amber-100 opacity-0 group-hover:opacity-100 transition-opacity" title="הוסף לפתק">
                      <Pin className="w-3 h-3 text-gray-400" />
                    </button>
                    <button onClick={() => setEditingTask(task)} className="p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity" title="ערוך">
                      <Pencil className="w-3 h-3 text-gray-400" />
                    </button>
                    <MiniStatusDropdown task={task} onStatusChange={handleStatusChange} />
                    {task.due_date && (
                      <span className="text-sky-500 shrink-0">{format(parseISO(task.due_date), 'EEE d/M', { locale: he })}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Completed badges - compact */}
      {analysis.completedCount > 0 && (
        <Card className="border-emerald-200">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('completed')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                <CheckCircle className="w-4 h-4" />
                הושלמו השבוע ({analysis.completedCount})
              </CardTitle>
              {expandedSection === 'completed' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          {expandedSection === 'completed' && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-1.5">
                {analysis.completedThisWeek.map(t => (
                  <Badge key={t.id} className="bg-emerald-100 text-emerald-700 text-[10px] py-0.5 px-2">
                    {t.title}
                  </Badge>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to={createPageUrl("Tasks")}>
          <Button variant="outline" className="w-full gap-1">
            <ArrowRight className="w-4 h-4" /> משימות
          </Button>
        </Link>
        <Link to={createPageUrl("ClientManagement")}>
          <Button variant="outline" className="w-full gap-1">
            <ArrowRight className="w-4 h-4" /> לקוחות
          </Button>
        </Link>
      </div>

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
