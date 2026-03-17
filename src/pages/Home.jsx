
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
  Plus, CreditCard, Search, Eye, Sun, Moon, Coffee, Heart,
  Map, ArrowRight,
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
import { useBiologicalClock } from "@/contexts/BiologicalClockContext";
import OverdueAlert from "@/components/tasks/OverdueAlert";
import AdvanceWarningPanel from "@/components/calendar/AdvanceWarningPanel";
import BadDayMode from "@/components/tasks/BadDayMode";
import UnifiedAyoaLayout from '@/components/canvas/UnifiedAyoaLayout';
import { calculateCapacity, getTaskFeed, LOAD_COLORS } from '@/engines/capacityEngine';
import { StickyNote } from "@/api/entities";

// ─── Zero-Panic Colors (NO RED) ─────────────────────────────────
const ZERO_PANIC = {
  orange: '#F57C00',
  purple: '#7B1FA2',
  green:  '#2E7D32',
  blue:   '#0288D1',
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return "לילה טוב";
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  if (hour < 21) return "ערב טוב";
  return "לילה טוב";
};

// Calming daily message based on time of day
const getDailyMessage = () => {
  const hour = new Date().getHours();
  if (hour < 8) return "הבוקר שלך — קחי רגע לנשום לפני שמתחילים";
  if (hour < 12) return "שעות שיא — זמן מצוין למשימות שדורשות ריכוז";
  if (hour < 14) return "הפסקת צהריים — אכלת? שתית?";
  if (hour < 17) return "אחר הצהריים — משימות קלות ושיחות";
  if (hour < 21) return "סוף יום — סיכום קצר ותכנון מחר";
  return "זמן לנוח — המשימות יחכו למחר";
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
  const [showFullMap, setShowFullMap] = useState(false);
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { focusMode } = useApp();
  const [stickyNotes, setStickyNotes] = useState([]);

  let design = null;
  try { design = useDesign(); } catch { /* not mounted */ }

  let bioClockZone = null;
  try {
    const bioContext = useBiologicalClock();
    bioClockZone = bioContext?.currentZone;
  } catch { /* not mounted */ }

  const allTasksForCascade = data?.allTasks || [];
  const setAllTasksForCascade = useCallback((updater) => {
    setData(prev => {
      if (!prev) return prev;
      const updated = typeof updater === 'function' ? updater(prev.allTasks) : updater;
      return { ...prev, allTasks: updated };
    });
  }, []);
  const { insights } = useTaskCascade(allTasksForCascade, setAllTasksForCascade, clients);

  useEffect(() => { loadData(); loadStickyNotes(); }, []);
  useRealtimeRefresh(() => { loadData(); loadStickyNotes(); }, ['tasks', 'events', 'clients']);

  const loadStickyNotes = async () => {
    try {
      const notes = await StickyNote.list(null, 100).catch(() => []);
      const sorted = (notes || []).sort((a, b) => {
        const urgencyOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
        const ua = urgencyOrder[a.urgency] ?? 4;
        const ub = urgencyOrder[b.urgency] ?? 4;
        if (ua !== ub) return ua - ub;
        // Pinned first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
      });
      setStickyNotes(sorted.slice(0, 6));
    } catch { /* ignore */ }
  };

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

      // Payment tab: tasks with payment_due_date set, OR completed production awaiting payment step
      const waitingPayment = allTasks.filter(t => {
        // Include tasks explicitly marked with legacy status
        if (t.status === 'reported_waiting_for_payment') return true;
        // Include completed tasks that have a payment_due_date (payment pending)
        if (t.status === 'production_completed' && t.payment_due_date) return true;
        // Include tasks where production is complete but payment step isn't done
        if (t.status === 'production_completed' && t.process_steps) {
          const steps = t.process_steps;
          if (steps.payment && !steps.payment.done) return true;
        }
        return false;
      });

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
        const updatedTask = { ...task, status: newStatus };
        const updateInList = (list) => list.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
        const filterCompleted = (list) => list.filter(t => !(t.id === task.id && newStatus === 'production_completed'));

        // When production completed, check if task should flow to payment tab
        let newPayment = prev.payment.filter(t => t.id !== task.id);
        if (newStatus === 'production_completed') {
          // Add to payment tab if it has a payment step or payment_due_date
          const hasPaymentStep = task.process_steps?.payment && !task.process_steps.payment.done;
          if (hasPaymentStep || task.payment_due_date) {
            newPayment = [...newPayment, updatedTask];
          }
        }

        return {
          ...prev,
          overdue: filterCompleted(updateInList(prev.overdue)),
          today: filterCompleted(updateInList(prev.today)),
          upcoming: filterCompleted(updateInList(prev.upcoming)),
          payment: newPayment,
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

  // ── Top 5 tasks for the calm "מה אפשר לעשות היום" section ──
  // Must be above the early return so hook count is stable across renders
  const calmTasks = useMemo(() => {
    if (!data) return [];
    const merged = [...(data.overdue || []), ...(data.today || [])];
    return sortByPriority(merged).slice(0, 5);
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
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

  // ── Full Map View ──
  if (showFullMap) {
    return (
      <div className="w-full h-full flex-1 flex flex-col">
        {/* Back button */}
        <div className="px-4 pt-3 pb-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullMap(false)}
            className="gap-1.5 text-xs font-semibold text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            חזרה לעמוד הבית
          </Button>
        </div>

        <UnifiedAyoaLayout
          tasks={data.activeTasks}
          allTasks={data.allTasks}
          clients={clients}
          isLoading={isLoading}
          centerLabel="מה אפשר לעשות היום"
          centerSub={`${data.totalActive} משימות`}
          accentColor="#00A3E0"
          onEditTask={setEditingTask}
        />

        {/* Dialogs */}
        <QuickAddTaskDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} onCreated={loadData} />
        <TaskEditDialog task={editingTask} open={!!editingTask} onClose={() => setEditingTask(null)} onSave={handleEditTask} onDelete={handleDeleteTask} />
        <TaskToNoteDialog task={noteTask} open={!!noteTask} onClose={() => setNoteTask(null)} />
        {ConfirmDialogComponent}
      </div>
    );
  }

  // ── Default: Calm Home View ──
  return (
    <div className="w-full h-full flex-1 flex flex-col" style={{ backgroundColor: '#F7F7F7' }}>
      <div className="space-y-4 p-4">

        {/* ═══ 1. Calming Greeting ═══ */}
        <div className="px-4 py-4 rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-700">
                {getGreeting()}{userName ? `, ${userName}` : ''}
              </h2>
              <p className="text-sm text-slate-500 mt-1">{getDailyMessage()}</p>
              {bioClockZone && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-base">{bioClockZone.icon}</span>
                  <span className="text-xs font-medium" style={{ color: bioClockZone.color }}>
                    {bioClockZone.label} · {bioClockZone.description}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                <Link to={createPageUrl("Tasks") + "?tab=active&context=work"} className="flex items-center gap-1 hover:opacity-80">
                  <Briefcase className="w-3 h-3" style={{ color: ZERO_PANIC.blue }} />
                  <span className="text-xs font-bold" style={{ color: ZERO_PANIC.blue }}>{data.workCount}</span>
                </Link>
                <Link to={createPageUrl("Tasks") + "?tab=active&context=home"} className="flex items-center gap-1 hover:opacity-80">
                  <HomeIcon className="w-3 h-3" style={{ color: ZERO_PANIC.green }} />
                  <span className="text-xs font-bold" style={{ color: ZERO_PANIC.green }}>{data.homeCount}</span>
                </Link>
                {data.overdue.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">{data.overdue.length}</span>
                  </div>
                )}
              </div>
              <Button size="sm" onClick={() => setShowQuickAdd(true)} className="bg-[#5A9EB5] hover:bg-[#4A8EA5] text-white gap-1 h-7 text-xs px-3">
                <Plus className="w-3.5 h-3.5" />
                חדש
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] text-slate-400">התקדמות היום</span>
            <div className="flex-1 bg-slate-100 rounded-full h-1 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: '#5A9EB5' }} />
            </div>
            <span className="text-[10px] font-bold text-slate-400">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* ═══ 2. BadDayMode — prominent, right under greeting ═══ */}
        <BadDayMode isActive={badDayActive} onToggle={setBadDayActive} onPostponeTasks={handlePostponeBadDay} />

        {/* ═══ 3. "מה אפשר לעשות היום" — AYOA-style mini-canvas ═══ */}
        <div className="py-6">
          <h3 className="text-sm font-bold text-slate-700 mb-5 px-1 text-center">מה אפשר לעשות היום</h3>
          {calmTasks.length === 0 ? (
            <div className="rounded-2xl py-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
              <EmptyState icon={<Sparkles className="w-10 h-10" style={{ color: '#10B981' }} />} text="אין משימות להיום — כל הכבוד!" />
            </div>
          ) : (() => {
            const positions = computeBubbleLayout(calmTasks.length);
            const canvasH = calmTasks.length <= 2 ? 180 : calmTasks.length <= 3 ? 260 : 310;
            return (
              <div className="relative mx-auto" style={{ maxWidth: 420, height: canvasH }}>
                <AnimatePresence>
                  {calmTasks.map((task, i) => (
                    <CalmBubble
                      key={task.id}
                      task={task}
                      onEdit={setEditingTask}
                      onStatusChange={handleStatusChange}
                      posStyle={positions[i]}
                    />
                  ))}
                </AnimatePresence>
              </div>
            );
          })()}
          {(data.overdue.length + data.today.length) > 5 && (
            <p className="text-[11px] text-slate-400 mt-4 text-center">
              +{(data.overdue.length + data.today.length) - 5} משימות נוספות במפה המלאה
            </p>
          )}
        </div>

        {/* ═══ 4. Sticky Notes — max 3 ═══ */}
        {stickyNotes.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold px-1" style={{ color: '#000000' }}>פתקים דביקים</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {stickyNotes.slice(0, 3).map(note => {
                const urgencyDots = {
                  urgent: '#F59E0B',
                  high:   '#F59E0B',
                  medium: '#6366F1',
                  low:    '#10B981',
                  none:   '#94A3B8',
                };
                const noteDot = urgencyDots[note.urgency] || urgencyDots.none;
                return (
                  <div key={note.id} className="p-2.5 rounded-xl text-sm" style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                  }}>
                    <div className="flex items-start gap-1.5">
                      {note.pinned && <Pin className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate" style={{ color: '#000000' }}>{note.title || 'פתק'}</p>
                        {note.content && <p className="text-[11px] truncate mt-0.5" style={{ color: '#000000' }}>{note.content}</p>}
                      </div>
                      <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: noteDot }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ 5. Soft Alerts ═══ */}
        <div className="space-y-1.5">
          <OverdueAlert tasks={allFocusTasks} />
          <AdvanceWarningPanel />
        </div>

        {/* ═══ 6. "הצג מפה מלאה" button ═══ */}
        <Button
          variant="outline"
          onClick={() => setShowFullMap(true)}
          className="w-full gap-2 py-5 text-sm font-semibold text-slate-600 border-sky-200 hover:bg-sky-50 rounded-xl"
        >
          <Map className="w-4 h-4" style={{ color: ZERO_PANIC.blue }} />
          הצג מפה מלאה
          <span className="text-[11px] text-slate-400 font-normal">({data.totalActive} משימות)</span>
        </Button>

      </div>

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

// ─── AYOA-style bubble — strict visual spec ───
// All bubbles share ONE warm-peach fill. No per-priority color variation.
const BUBBLE_STYLE = { bg: '#FFF7ED', border: '#FED7AA' };

// Compute scattered bubble positions dynamically based on task count
function computeBubbleLayout(count) {
  // Predefined organic layouts for 1–5 items
  const layouts = {
    1: [{ top: '15%', left: '50%', transform: 'translateX(-50%)' }],
    2: [
      { top: '10%', left: '25%' },
      { top: '20%', left: '60%' },
    ],
    3: [
      { top: '0%',  left: '38%' },
      { top: '42%', left: '8%' },
      { top: '38%', left: '62%' },
    ],
    4: [
      { top: '0%',  left: '42%' },
      { top: '30%', left: '5%' },
      { top: '25%', left: '62%' },
      { top: '58%', left: '30%' },
    ],
    5: [
      { top: '0%',  left: '38%' },
      { top: '22%', left: '4%' },
      { top: '18%', left: '65%' },
      { top: '52%', left: '18%' },
      { top: '55%', left: '55%' },
    ],
  };
  return layouts[count] || layouts[5];
}

// Status dot colors — strict palette: emerald / indigo / orange only
const QUICK_STATUSES = [
  { key: 'production_completed',   label: 'הושלם',           dotColor: '#10B981' },
  { key: 'waiting_for_materials',  label: 'ממתין לחומרים',   dotColor: '#6366F1' },
  { key: 'needs_corrections',      label: 'לבצע תיקונים',   dotColor: '#F59E0B' },
  { key: 'not_started',            label: 'לבצע',            dotColor: '#94A3B8' },
];

// Map task status → spec dot color
const STATUS_DOT_COLOR = {
  production_completed:  '#10B981',
  waiting_for_materials: '#6366F1',
  needs_corrections:     '#F59E0B',
  sent_for_review:       '#6366F1',
  not_started:           '#94A3B8',
};


function CalmBubble({ task, onEdit, onStatusChange, posStyle }) {
  const [showStatus, setShowStatus] = useState(false);
  const [fading, setFading] = useState(false);
  const statusCfg = statusConfig[task.status] || statusConfig.not_started;
  const dotColor = STATUS_DOT_COLOR[task.status] || '#94A3B8';

  const handleQuickStatus = (e, newStatus) => {
    e.stopPropagation();
    setShowStatus(false);
    if (newStatus === 'production_completed') {
      setFading(true);
      setTimeout(() => onStatusChange(task, newStatus), 400);
    } else {
      onStatusChange(task, newStatus);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: fading ? 0 : 1, scale: fading ? 0.5 : 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="absolute"
      style={posStyle}
    >
      <button
        onClick={() => onEdit(task)}
        className="relative flex flex-col items-center text-center rounded-full p-4 transition-shadow hover:shadow-lg cursor-pointer"
        style={{
          width: 130,
          height: 130,
          backgroundColor: BUBBLE_STYLE.bg,
          border: `2px solid ${BUBBLE_STYLE.border}`,
        }}
      >
        {/* Title — spec: 15px bold black, max 2 lines */}
        <span className="font-bold leading-tight mt-2 line-clamp-2 max-w-[100px]" style={{ fontSize: 15, color: '#000000' }}>
          {task.title}
        </span>

        {/* Status dot + label — spec: 13px regular black */}
        <span
          className="mt-auto mb-1 flex items-center gap-1.5 hover:bg-white/50 rounded-full px-2 py-0.5 transition-colors"
          onClick={(e) => { e.stopPropagation(); setShowStatus(!showStatus); }}
          title="שנה סטטוס"
        >
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
          <span style={{ fontSize: 13, color: '#000000' }}>{statusCfg.text}</span>
          <ChevronDown className="w-2.5 h-2.5" style={{ color: '#000000' }} />
        </span>
      </button>

      {/* Quick status picker — floats below bubble */}
      <AnimatePresence>
        {showStatus && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-1/2 -translate-x-1/2 z-50 rounded-xl shadow-lg py-1.5 px-1"
            style={{ top: 136, minWidth: 150, backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}
          >
            {QUICK_STATUSES.map(s => (
              <button
                key={s.key}
                onClick={(e) => handleQuickStatus(e, s.key)}
                className={`flex items-center gap-2 w-full text-right px-3 py-1.5 rounded-lg transition-colors ${
                  task.status === s.key ? 'font-bold' : ''
                }`}
                style={{ fontSize: 13, color: '#000000', backgroundColor: task.status === s.key ? '#F7F7F7' : undefined }}
                onMouseEnter={(e) => { if (task.status !== s.key) e.currentTarget.style.backgroundColor = '#F7F7F7'; }}
                onMouseLeave={(e) => { if (task.status !== s.key) e.currentTarget.style.backgroundColor = ''; }}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dotColor }} />
                <span>{s.label}</span>
                {s.key === 'production_completed' && <CheckCircle className="w-3 h-3 mr-auto" style={{ color: '#10B981' }} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
        <Button
          variant="ghost"
          size="sm"
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
          className="text-[11px] text-[#455A64] hover:text-[#000000] flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#F5F5F5] h-auto"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${allExpanded ? 'rotate-180' : ''}`} />
          {allExpanded ? 'כווץ הכל' : 'הרחב הכל'}
        </Button>
      </div>
      {grouped.map(([clientName, clientTasks]) => {
        const isCollapsed = collapsedClients[clientName];
        return (
          <div key={clientName} className="mb-1">
            <Button
              variant="ghost"
              onClick={() => setCollapsedClients(prev => ({ ...prev, [clientName]: !prev[clientName] }))}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#F5F5F5] hover:bg-[#E0E0E0] transition-colors text-start h-auto"
            >
              <ChevronDown className={`w-3.5 h-3.5 text-[#455A64] transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              <span className="text-xs font-bold text-[#000000]">{clientName}</span>
              <span className="text-[11px] text-[#455A64]">({clientTasks.length})</span>
            </Button>
            {!isCollapsed && (
              <div className="space-y-1 mt-1 me-2">
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
  urgent: 'border-e-4 border-e-[#F57C00]',
  high: 'border-e-4 border-e-[#FF8F00]',
  medium: 'border-e-4 border-e-[#FFB300]',
  low: 'border-e-4 border-e-gray-300',
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
      className={`flex items-center gap-3 p-2.5 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${priorityStyles[task.priority] || 'border-e-4 border-e-gray-200'} ${isOverdue ? 'bg-orange-50' : ''} ${isMissingData ? 'opacity-60 border-dashed' : ''}`}
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
          <Button variant="ghost" size="sm" onClick={() => onNote(task)} className="p-1 h-auto rounded hover:bg-amber-100 transition-colors" title="הוסף לפתק דביק">
            <Pin className="w-3.5 h-3.5 text-gray-400 hover:text-amber-600" />
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(task)} className="p-1 h-auto rounded hover:bg-gray-200 transition-colors" title="ערוך משימה">
            <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
          </Button>
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
