
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Task, Event, Client } from "@/api/entities";
import { parseISO, format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Briefcase, Home as HomeIcon, Calendar, CheckCircle, Clock,
  Target, AlertTriangle, ChevronDown, Sparkles,
  Plus, CreditCard, Search, Eye,
} from "lucide-react";
import { getActiveTreeTasks } from '@/utils/taskTreeFilter';
import TaskEditDialog from "@/components/tasks/TaskEditDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Pencil, Trash2, Pin } from "lucide-react";
import TaskToNoteDialog from "@/components/tasks/TaskToNoteDialog";
import QuickAddTaskDialog from "@/components/tasks/QuickAddTaskDialog";
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import useRealtimeRefresh from "@/hooks/useRealtimeRefresh";
import useTaskCascade from "@/hooks/useTaskCascade";
import { useApp } from "@/contexts/AppContext";
import { useDesign } from "@/contexts/DesignContext";
import OverdueAlert from "@/components/tasks/OverdueAlert";
import AdvanceWarningPanel from "@/components/calendar/AdvanceWarningPanel";
import BadDayMode from "@/components/tasks/BadDayMode";
import UnifiedAyoaLayout from '@/components/canvas/UnifiedAyoaLayout';
import { calculateCapacity, getTaskFeed, LOAD_COLORS } from '@/engines/capacityEngine';

// ─── Zero-Panic Colors (NO RED) ─────────────────────────────────
const ZERO_PANIC = {
  orange: '#F57C00',
  purple: '#7B1FA2',
  green:  '#2E7D32',
  blue:   '#0288D1',
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  return "ערב טוב";
};

function getTaskContext(task) {
  if (task.context === 'work' || task.context === 'home') return task.context;
  const cat = task.category || '';
  if (['מע"מ','מקדמות מס','ניכויים','ביטוח לאומי','שכר'].includes(cat)) return 'work';
  if (cat === 'home' || cat === 'personal') return 'home';
  if (task.client_name) return 'work';
  return 'other';
}

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(a.due_date || 0) - new Date(b.due_date || 0);
  });
}

import { TASK_STATUS_CONFIG as statusConfig } from '@/config/processTemplates';

const FOCUS_TABS = [
  { key: 'overdue', label: 'באיחור', icon: AlertTriangle, color: 'text-[#7B1FA2]', activeBg: 'bg-purple-50 border-purple-300 text-purple-700', badgeColor: 'bg-purple-100 text-purple-700' },
  { key: 'today', label: 'היום', icon: Target, color: 'text-[#F57C00]', activeBg: 'bg-orange-50 border-orange-300 text-orange-700', badgeColor: 'bg-orange-100 text-orange-700' },
  { key: 'upcoming', label: '3 ימים', icon: Clock, color: 'text-gray-600', activeBg: 'bg-gray-50 border-gray-300 text-gray-700', badgeColor: 'bg-gray-100 text-gray-700' },
  { key: 'events', label: 'אירועים', icon: Calendar, color: 'text-purple-600', activeBg: 'bg-purple-50 border-purple-300 text-purple-700', badgeColor: 'bg-purple-100 text-purple-700' },
  { key: 'payment', label: 'ממתין לתשלום', icon: CreditCard, color: 'text-yellow-600', activeBg: 'bg-yellow-50 border-yellow-300 text-yellow-700', badgeColor: 'bg-yellow-100 text-yellow-700' },
];

export default function HomePage() {
  const [data, setData] = useState(null);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState('overdue');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [badDayActive, setBadDayActive] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { focusMode } = useApp();

  let design = null;
  try { design = useDesign(); } catch { /* not mounted */ }

  const allTasksForCascade = data?.allTasks || [];
  const setAllTasksForCascade = useCallback((updater) => {
    setData(prev => {
      if (!prev) return prev;
      const updated = typeof updater === 'function' ? updater(prev.allTasks) : updater;
      return { ...prev, allTasks: updated };
    });
  }, []);
  const { insights } = useTaskCascade(allTasksForCascade, setAllTasksForCascade, clients);

  useEffect(() => { loadData(); }, []);
  useRealtimeRefresh(() => { loadData(); }, ['tasks', 'events', 'clients']);

  const loadData = async () => {
    setIsLoading(true);
    try {
      try {
        const displayName = localStorage.getItem('calmplan_display_name');
        setUserName(displayName || 'לנה');
      } catch { setUserName('לנה'); }

      const [tasksData, eventsData, clientsData] = await Promise.all([
        Task.list(null, 5000).catch(() => []),
        Event.list(null, 500).catch(() => []),
        Client.list(null, 1000).catch(() => []),
      ]);

      setClients(Array.isArray(clientsData) ? clientsData : []);

      const rawTasks = Array.isArray(tasksData) ? tasksData : [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const in3Days = new Date(today);
      in3Days.setDate(in3Days.getDate() + 3);

      const allTasks = rawTasks;
      const activeTasks = allTasks.filter(t => t.status !== 'production_completed');

      const overdue = activeTasks.filter(task => {
        const d = task.due_date;
        if (!d) return false;
        const taskDate = parseISO(d);
        taskDate.setHours(23, 59, 59, 999);
        return taskDate < today;
      });

      const todayTasks = activeTasks.filter(task => {
        const d = task.due_date;
        if (!d) return false;
        const taskDate = parseISO(d);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === today.getTime();
      });

      const upcoming = activeTasks.filter(task => {
        const d = task.due_date;
        if (!d) return false;
        const taskDate = parseISO(d);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate >= tomorrow && taskDate <= in3Days;
      });

      const waitingPayment = activeTasks.filter(t => t.status === 'reported_waiting_for_payment');

      const allEvents = Array.isArray(eventsData) ? eventsData : [];
      const todayEvents = allEvents.filter(event => {
        if (!event.start_date) return false;
        const eventDate = parseISO(event.start_date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === today.getTime();
      });

      const workCount = activeTasks.filter(t => getTaskContext(t) === 'work').length;
      const homeCount = activeTasks.filter(t => getTaskContext(t) === 'home').length;

      setData({
        allTasks,
        activeTasks,
        overdue: sortByPriority(overdue),
        today: sortByPriority(todayTasks),
        upcoming: sortByPriority(upcoming),
        payment: sortByPriority(waitingPayment),
        todayEvents,
        workCount,
        homeCount,
        totalActive: activeTasks.length,
        completedToday: allTasks.filter(t => {
          if (t.status !== 'production_completed') return false;
          const d = t.updated_date || t.due_date;
          if (!d) return false;
          try { return isToday(parseISO(d)); } catch { return false; }
        }).length,
      });

      if (overdue.length > 0) setActiveTab('overdue');
      else if (todayTasks.length > 0) setActiveTab('today');
      else if (upcoming.length > 0) setActiveTab('upcoming');
      else if (todayEvents.length > 0) setActiveTab('events');
      else setActiveTab('today');
    } catch (error) {
      console.error("Error loading home page data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await Task.update(task.id, { status: newStatus });
      syncNotesWithTaskStatus(task.id, newStatus);
      if (newStatus === 'production_completed') {
        window.dispatchEvent(new CustomEvent('calmplan:task-completed', { detail: { task } }));
      }
      setData(prev => {
        if (!prev) return prev;
        const updateInList = (list) => list.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
        const filterCompleted = (list) => list.filter(t => !(t.id === task.id && newStatus === 'production_completed'));
        return {
          ...prev,
          overdue: filterCompleted(updateInList(prev.overdue)),
          today: filterCompleted(updateInList(prev.today)),
          upcoming: filterCompleted(updateInList(prev.upcoming)),
          payment: prev.payment.filter(t => t.id !== task.id),
          completedToday: newStatus === 'production_completed' ? prev.completedToday + 1 : prev.completedToday,
        };
      });
    } catch (err) {
      console.error('שגיאה בעדכון סטטוס:', err);
    }
  };

  const handlePaymentDateChange = async (task, paymentDate) => {
    try {
      await Task.update(task.id, { payment_due_date: paymentDate });
      setData(prev => {
        if (!prev) return prev;
        const updateDate = (list) => list.map(t => t.id === task.id ? { ...t, payment_due_date: paymentDate } : t);
        return { ...prev, overdue: updateDate(prev.overdue), today: updateDate(prev.today), upcoming: updateDate(prev.upcoming), payment: updateDate(prev.payment) };
      });
    } catch (err) {
      console.error('שגיאה בעדכון תאריך תשלום:', err);
    }
  };

  const handleEditTask = async (taskId, updatedData) => {
    try {
      await Task.update(taskId, updatedData);
      loadData();
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
        loadData();
      } catch (err) {
        console.error('שגיאה במחיקת משימה:', err);
      }
    }
  };

  const handlePostponeBadDay = useCallback(async () => {
    const nonUrgent = (data?.activeTasks || []).filter(t =>
      t.priority !== 'urgent' && t.status === 'not_started'
    );
    for (const t of nonUrgent) {
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await Task.update(t.id, { due_date: tomorrow.toISOString().split('T')[0] });
      } catch { /* ignore */ }
    }
  }, [data]);

  // KPI capacity metrics
  const capacityKPIs = useMemo(() => {
    if (!data) return { efficiencyScore: 0, cognitiveLoadMix: {}, totalMinutes: 0, totalTasks: 0, dailyCapacityMinutes: 480, utilizationPercent: 0, loadByPriority: {} };
    return calculateCapacity(data.activeTasks || []);
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-16 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  const filterBySearch = (items, isEvent = false) => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(item =>
      item.title?.toLowerCase().includes(lower) ||
      (!isEvent && item.client_name?.toLowerCase().includes(lower)) ||
      (!isEvent && item.category?.toLowerCase().includes(lower)) ||
      (isEvent && item.description?.toLowerCase().includes(lower))
    );
  };

  const getTabCount = (tabKey) => {
    if (tabKey === 'events') return filterBySearch(data.todayEvents, true).length;
    return filterBySearch(data[tabKey] || []).length;
  };

  const allFocusTasks = filterBySearch([
    ...(data.overdue || []),
    ...(data.today || []),
    ...(data.upcoming || []),
    ...(data.payment || []),
  ]);

  const getTabContent = () => {
    switch (activeTab) {
      case 'overdue': {
        const filtered = filterBySearch(data.overdue);
        return filtered.length === 0 ? (
          <EmptyState icon={<CheckCircle className="w-10 h-10" style={{ color: ZERO_PANIC.green }} />} text="אין משימות באיחור" />
        ) : (
          <TaskList tasks={filtered} onStatusChange={handleStatusChange} onPaymentDateChange={handlePaymentDateChange} onEdit={setEditingTask} onNote={setNoteTask} showDeadlineContext />
        );
      }
      case 'today': {
        const filtered = filterBySearch(data.today);
        return filtered.length === 0 ? (
          <EmptyState icon={<Sparkles className="w-10 h-10" style={{ color: ZERO_PANIC.green }} />} text="אין משימות להיום - כל הכבוד!" />
        ) : (
          <TaskList tasks={filtered} onStatusChange={handleStatusChange} onPaymentDateChange={handlePaymentDateChange} onEdit={setEditingTask} onNote={setNoteTask} showDeadlineContext />
        );
      }
      case 'upcoming': {
        const filtered = filterBySearch(data.upcoming);
        return filtered.length === 0 ? (
          <EmptyState icon={<Clock className="w-10 h-10 text-gray-300" />} text="אין משימות ל-3 ימים הקרובים" />
        ) : (
          <TaskList tasks={filtered} onStatusChange={handleStatusChange} onPaymentDateChange={handlePaymentDateChange} onEdit={setEditingTask} onNote={setNoteTask} showDate />
        );
      }
      case 'events': {
        const filtered = filterBySearch(data.todayEvents, true);
        return filtered.length === 0 ? (
          <EmptyState icon={<Calendar className="w-10 h-10 text-purple-300" />} text="אין אירועים היום" />
        ) : (
          <div className="space-y-2">
            {filtered.map(event => (
              <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-purple-50 border border-purple-100">
                <div className="text-sm font-mono font-semibold text-purple-700 min-w-[50px]">
                  {format(parseISO(event.start_date), 'HH:mm')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-purple-900 truncate">{event.title}</div>
                  {event.description && <div className="text-xs text-purple-600 truncate">{event.description}</div>}
                </div>
              </div>
            ))}
          </div>
        );
      }
      case 'payment': {
        const filtered = filterBySearch(data.payment);
        return filtered.length === 0 ? (
          <EmptyState icon={<CreditCard className="w-10 h-10 text-yellow-300" />} text="אין משימות ממתינות לתשלום" />
        ) : (
          <TaskList tasks={filtered} onStatusChange={handleStatusChange} onPaymentDateChange={handlePaymentDateChange} onEdit={setEditingTask} onNote={setNoteTask} showPaymentDate />
        );
      }
      default:
        return null;
    }
  };

  const todayTotal = data.today.length + (data.overdue?.length || 0);
  const progress = todayTotal > 0 ? (data.completedToday / (todayTotal + data.completedToday)) * 100 : 0;

  return (
    <div className="w-full h-full flex-1 flex flex-col">
      <UnifiedAyoaLayout
        tasks={data.activeTasks}
        allTasks={data.allTasks}
        clients={clients}
        isLoading={isLoading}
        centerLabel="מה לעשות היום"
        centerSub={`${data.totalActive} משימות`}
        accentColor="#00A3E0"
        onEditTask={setEditingTask}
      >
        {/* ═══ CHILDREN: KPI + FOCUS TABS + TASK LIST ═══ */}
        <div className="space-y-3">

          {/* ── KPI Summary Strip ── */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-l from-sky-50 to-white rounded-2xl border border-sky-100">
            {/* Greeting */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800">
                {getGreeting()}{userName ? `, ${userName}` : ''}
              </span>
            </div>

            <div className="w-px h-8 bg-sky-200" />

            {/* Stats row */}
            <div className="flex items-center gap-3">
              <Link to={createPageUrl("Tasks") + "?tab=active&context=work"} className="flex items-center gap-1 hover:opacity-80">
                <Briefcase className="w-3.5 h-3.5" style={{ color: ZERO_PANIC.blue }} />
                <span className="text-sm font-extrabold" style={{ color: ZERO_PANIC.blue }}>{data.workCount}</span>
              </Link>
              <Link to={createPageUrl("Tasks") + "?tab=active&context=home"} className="flex items-center gap-1 hover:opacity-80">
                <HomeIcon className="w-3.5 h-3.5" style={{ color: ZERO_PANIC.green }} />
                <span className="text-sm font-extrabold" style={{ color: ZERO_PANIC.green }}>{data.homeCount}</span>
              </Link>
              {data.overdue.length > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" style={{ color: ZERO_PANIC.orange }} />
                  <span className="text-sm font-extrabold" style={{ color: ZERO_PANIC.orange }}>{data.overdue.length}</span>
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-sky-200" />

            {/* Capacity */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">קיבולת</span>
              <span className="text-sm font-bold text-[#4682B4]">
                {(capacityKPIs.totalMinutes / 60).toFixed(1)}h
              </span>
              <span className="text-[11px] text-gray-400">/ {(capacityKPIs.dailyCapacityMinutes / 60)}h</span>
            </div>

            <div className="w-px h-8 bg-sky-200" />

            {/* Efficiency */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500">יעילות</span>
              <span className="text-sm font-bold" style={{
                color: capacityKPIs.efficiencyScore >= 75 ? '#2E7D32' :
                       capacityKPIs.efficiencyScore >= 50 ? '#F57C00' : '#800000'
              }}>
                {capacityKPIs.efficiencyScore}%
              </span>
            </div>

            {/* Progress */}
            <div className="flex-1 flex items-center gap-2 mr-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${ZERO_PANIC.green}, #43A047)` }} />
              </div>
              <span className="text-[11px] font-bold" style={{ color: ZERO_PANIC.green }}>{Math.round(progress)}%</span>
            </div>

            {/* Quick Add */}
            <Button size="sm" onClick={() => setShowQuickAdd(true)} className="bg-[#00A3E0] hover:bg-[#0288D1] text-white gap-1 h-7 text-xs px-3">
              <Plus className="w-3.5 h-3.5" />
              חדש
            </Button>
          </div>

          {/* ── Alerts ── */}
          <div className="space-y-2">
            <BadDayMode isActive={badDayActive} onToggle={setBadDayActive} onPostponeTasks={handlePostponeBadDay} />
            <OverdueAlert tasks={allFocusTasks} />
            <AdvanceWarningPanel />
          </div>

          {/* ── Focus Tabs + Task List ── */}
          <Card className="overflow-hidden border-sky-100">
            <div className="px-3 pt-2">
              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <Input placeholder="חיפוש משימה, לקוח..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-8 h-7 text-xs" />
              </div>

              {/* Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-100">
                {FOCUS_TABS.map(tab => {
                  const count = getTabCount(tab.key);
                  const isActive = activeTab === tab.key;
                  const Icon = tab.icon;
                  return (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-t-md text-xs font-medium whitespace-nowrap border-b-2 ${isActive ? `${tab.activeBg} border-current` : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>
                      <Icon className={`w-3 h-3 ${isActive ? '' : tab.color}`} />
                      <span>{tab.label}</span>
                      {count > 0 && <Badge className={`text-[11px] px-1 py-0 h-3.5 ${isActive ? tab.badgeColor : 'bg-gray-100 text-gray-500'}`}>{count}</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>

            <CardContent className="pt-2 pb-3 max-h-[60vh] overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.12 }}>
                  {getTabContent()}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* ── Insights strip ── */}
          {insights.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-1 py-1.5">
              {insights.slice(0, 4).map((insight, i) => {
                const colorMap = {
                  teal: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700' },
                  amber: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
                  blue: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
                  emerald: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
                };
                const c = colorMap[insight.color] || colorMap.teal;
                return (
                  <div key={i} className={`${c.bg} border rounded-lg px-3 py-1.5 flex items-center gap-1.5 shrink-0`}>
                    <p className={`text-xs font-medium ${c.text} truncate max-w-[200px]`}>{insight.title}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </UnifiedAyoaLayout>

      {/* Dialogs */}
      <QuickAddTaskDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} onCreated={loadData} />
      <TaskEditDialog task={editingTask} open={!!editingTask} onClose={() => setEditingTask(null)} onSave={handleEditTask} onDelete={handleDeleteTask} />
      <TaskToNoteDialog task={noteTask} open={!!noteTask} onClose={() => setNoteTask(null)} />
      {ConfirmDialogComponent}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-8">
      <div className="mb-2">{icon}</div>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function TaskList({ tasks, onStatusChange, onPaymentDateChange, onEdit, onNote, showDeadlineContext, showDate, showPaymentDate }) {
  const [collapsedClients, setCollapsedClients] = useState({});
  const [allExpanded, setAllExpanded] = useState(false);

  const grouped = useMemo(() => {
    const groups = {};
    tasks.forEach(task => {
      const key = task.client_name || 'ללא לקוח';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [tasks]);

  if (tasks.length <= 5) {
    return (
      <div className="space-y-2">
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} onPaymentDateChange={onPaymentDateChange} onEdit={onEdit} onNote={onNote} showDeadlineContext={showDeadlineContext} showDate={showDate} showPaymentDate={showPaymentDate} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-end mb-1">
        <button
          onClick={() => {
            if (allExpanded) {
              const collapsed = {};
              grouped.forEach(([key]) => { collapsed[key] = true; });
              setCollapsedClients(collapsed);
              setAllExpanded(false);
            } else {
              setCollapsedClients({});
              setAllExpanded(true);
            }
          }}
          className="text-[11px] text-[#455A64] hover:text-[#000000] flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#F5F5F5]"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${allExpanded ? 'rotate-180' : ''}`} />
          {allExpanded ? 'כווץ הכל' : 'הרחב הכל'}
        </button>
      </div>
      {grouped.map(([clientName, clientTasks]) => {
        const isCollapsed = collapsedClients[clientName];
        return (
          <div key={clientName} className="mb-1">
            <button
              onClick={() => setCollapsedClients(prev => ({ ...prev, [clientName]: !prev[clientName] }))}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#F5F5F5] hover:bg-[#E0E0E0] transition-colors text-left"
            >
              <ChevronDown className={`w-3.5 h-3.5 text-[#455A64] transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              <span className="text-xs font-bold text-[#000000]">{clientName}</span>
              <span className="text-[11px] text-[#455A64]">({clientTasks.length})</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-1 mt-1 mr-2">
                {clientTasks.map(task => (
                  <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} onPaymentDateChange={onPaymentDateChange} onEdit={onEdit} onNote={onNote} showDeadlineContext={showDeadlineContext} showDate={showDate} showPaymentDate={showPaymentDate} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const priorityStyles = {
  urgent: 'border-r-4 border-r-[#F57C00]',
  high: 'border-r-4 border-r-[#FF8F00]',
  medium: 'border-r-4 border-r-[#FFB300]',
  low: 'border-r-4 border-r-gray-300',
};

function TaskRow({ task, onStatusChange, onPaymentDateChange, onEdit, onNote, showDeadlineContext, showDate, showPaymentDate }) {
  const ctx = getTaskContext(task);
  const isWork = ctx === 'work';
  const isHome = ctx === 'home';
  const isMissingData = !task.due_date || !task.client_size;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysFromDue = task.due_date ? differenceInDays(today, parseISO(task.due_date)) : 0;
  const isOverdue = daysFromDue > 0;

  const statusCfg = statusConfig[task.status] || statusConfig.not_started;

  const paymentDaysLeft = task.payment_due_date
    ? differenceInDays(parseISO(task.payment_due_date), today)
    : null;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors ${priorityStyles[task.priority] || 'border-r-4 border-r-gray-200'} ${isOverdue ? 'bg-orange-50' : ''} ${isMissingData ? 'opacity-60 border-dashed' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-800 truncate">{task.title}</span>
          {task.priority === 'urgent' && (
            <Badge style={{ backgroundColor: '#FFF3E0', color: '#E65100' }} className="text-[11px] px-1.5 py-0">דחוף</Badge>
          )}
          {isMissingData && (
            <Badge className="text-[11px] px-1.5 py-0 bg-gray-100 text-gray-500 border border-dashed border-gray-300">חסר מידע</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.client_name && (
            <span className="text-[11px] text-gray-500 truncate max-w-[120px]">{task.client_name}</span>
          )}
          {task.category && (
            <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-4">{task.category}</Badge>
          )}
          {task.client_size && (
            <Badge variant="outline" className="text-[11px] px-1 py-0 h-4 font-bold">{task.client_size}</Badge>
          )}
          {showDeadlineContext && isOverdue && (
            <Badge style={{ backgroundColor: '#F3E5F5', color: '#7B1FA2' }} className="text-[11px] px-1.5 py-0">
              {daysFromDue === 1 ? 'אתמול' : `${daysFromDue} ימים באיחור`}
            </Badge>
          )}
          {showDeadlineContext && !isOverdue && task.due_date && (
            <span className="text-[11px] text-gray-400">היום - {format(parseISO(task.due_date), 'd/M')}</span>
          )}
          {showDate && task.due_date && (
            <span className="text-[11px] text-gray-400">
              {isTomorrow(parseISO(task.due_date)) ? 'מחר' : format(parseISO(task.due_date), 'd/M')}
            </span>
          )}
          {showPaymentDate && task.payment_due_date && (
            <Badge className={`text-[11px] px-1.5 py-0 ${paymentDaysLeft <= 0 ? 'bg-purple-100 text-purple-700' : paymentDaysLeft <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {paymentDaysLeft < 0 ? `${Math.abs(paymentDaysLeft)} ימים באיחור תשלום` : paymentDaysLeft === 0 ? 'תשלום היום' : `${paymentDaysLeft} ימים לתשלום`}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onNote && (
          <button onClick={() => onNote(task)} className="p-1 rounded hover:bg-amber-100 transition-colors" title="הוסף לפתק דביק">
            <Pin className="w-3.5 h-3.5 text-gray-400 hover:text-amber-600" />
          </button>
        )}
        {onEdit && (
          <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-gray-200 transition-colors" title="ערוך משימה">
            <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
        {task.status === 'reported_waiting_for_payment' && onPaymentDateChange && (
          <input
            type="date"
            value={task.payment_due_date || ''}
            onChange={(e) => onPaymentDateChange(task, e.target.value)}
            className="h-7 text-[11px] px-1.5 w-[110px] border border-yellow-300 rounded bg-yellow-50 text-yellow-800"
            title="תאריך יעד לתשלום"
          />
        )}
        {onStatusChange && (
          <Select value={task.status || 'not_started'} onValueChange={(newStatus) => onStatusChange(task, newStatus)}>
            <SelectTrigger className={`h-7 text-[11px] px-2 w-auto min-w-[90px] border-0 ${statusCfg.color}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusConfig).map(([key, { text }]) => (
                <SelectItem key={key} value={key} className="text-xs">{text}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isWork ? (
          <Briefcase className="w-3.5 h-3.5" style={{ color: ZERO_PANIC.blue }} />
        ) : isHome ? (
          <HomeIcon className="w-3.5 h-3.5" style={{ color: ZERO_PANIC.green }} />
        ) : null}
      </div>
    </div>
  );
}
