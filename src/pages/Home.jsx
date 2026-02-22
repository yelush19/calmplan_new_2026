
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Task, Event, Client } from "@/api/entities";
import { parseISO, format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Briefcase, Home as HomeIcon, Calendar, CheckCircle, Clock,
  ArrowRight, Target, AlertTriangle, ChevronDown, Sparkles,
  FileBarChart, Brain, Zap, Plus, CreditCard, List, LayoutGrid, Search,
  Network, BarChart3, Eye, EyeOff
} from "lucide-react";
import MindMapView from "../components/views/MindMapView";
import GanttView from "../components/views/GanttView";
import KanbanView from "../components/tasks/KanbanView";
import TaskEditDialog from "@/components/tasks/TaskEditDialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Pencil, Trash2, Pin } from "lucide-react";
import TaskToNoteDialog from "@/components/tasks/TaskToNoteDialog";
import QuickAddTaskDialog from "@/components/tasks/QuickAddTaskDialog";
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import useRealtimeRefresh from "@/hooks/useRealtimeRefresh";
import useTaskCascade from "@/hooks/useTaskCascade";
import { useApp } from "@/contexts/AppContext";

// ─── Draggable panel wrapper (localStorage persist) ─────────
function DraggablePanel({ storageKey, children, className = '', style = {} }) {
  const fullKey = `calmplan_drag_${storageKey}`;
  const didDrag = React.useRef(false);
  const savedPos = React.useRef(() => {
    try {
      const s = localStorage.getItem(fullKey);
      if (s) return JSON.parse(s);
    } catch { /* ignore */ }
    return { x: 0, y: 0 };
  });
  if (typeof savedPos.current === 'function') savedPos.current = savedPos.current();
  const [resetKey, setResetKey] = useState(0);

  const handleDragEnd = useCallback((_, info) => {
    const dist = Math.abs(info.offset.x) + Math.abs(info.offset.y);
    if (dist < 3) { didDrag.current = false; return; }
    didDrag.current = true;
    const prev = savedPos.current;
    const next = { x: prev.x + info.offset.x, y: prev.y + info.offset.y };
    savedPos.current = next;
    try { localStorage.setItem(fullKey, JSON.stringify(next)); } catch { /* ignore */ }
  }, [fullKey]);

  const handleReset = useCallback(() => {
    savedPos.current = { x: 0, y: 0 };
    try { localStorage.removeItem(fullKey); } catch { /* ignore */ }
    setResetKey(k => k + 1);
  }, [fullKey]);

  return (
    <motion.div
      key={resetKey}
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => { didDrag.current = false; }}
      onDrag={() => { didDrag.current = true; }}
      onDragEnd={handleDragEnd}
      initial={savedPos.current}
      onDoubleClick={handleReset}
      className={`cursor-grab active:cursor-grabbing select-none ${className}`}
      style={style}
      title="גרור לשינוי מיקום • לחיצה כפולה לאיפוס"
    >
      {children}
    </motion.div>
  );
}

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
  const [inboxItems, setInboxItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState('overdue');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [focusView, setFocusView] = useState('mindmap'); // Default to mind map
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { focusMode } = useApp();
  // Cascade engine for proactive insights
  const allTasksForCascade = data?.allTasks || [];
  const setAllTasksForCascade = useCallback((updater) => {
    setData(prev => {
      if (!prev) return prev;
      const updated = typeof updater === 'function' ? updater(prev.allTasks) : updater;
      return { ...prev, allTasks: updated };
    });
  }, []);
  const { insights } = useTaskCascade(allTasksForCascade, setAllTasksForCascade, clients);

  // System readiness: count clients missing critical data
  const setupIncomplete = useMemo(() => {
    if (!clients.length) return { missing: 0, total: 0 };
    const active = clients.filter(c => c.status !== 'inactive' && c.status !== 'deleted');
    const missing = active.filter(c => {
      const bi = c.business_info || {};
      const hasEmployees = (bi.employee_count || c.employee_count || 0) > 0;
      const hasComplexity = !!(bi.complexity_level || c.complexity_level);
      const hasVat = (bi.vat_volume || c.vat_volume || 0) > 0;
      return !(hasEmployees && hasComplexity && hasVat);
    }).length;
    return { missing, total: active.length };
  }, [clients]);

  useEffect(() => { loadData(); }, []);

  // Auto-refresh when remote data changes arrive (cross-device sync)
  useRealtimeRefresh(() => { loadData(); }, ['tasks', 'events', 'clients']);

  // Listen for quick capture from desktop app
  useEffect(() => {
    const handler = (e) => {
      const { task } = e.detail || {};
      if (task) {
        setInboxItems(prev => [...prev, task]);
      }
    };
    window.addEventListener('calmplan:inbox-item', handler);
    return () => window.removeEventListener('calmplan:inbox-item', handler);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      try {
        const displayName = localStorage.getItem('calmplan_display_name');
        if (displayName) {
          setUserName(displayName);
        } else {
          setUserName('לנה');
        }
      } catch { setUserName('לנה'); }

      const [tasksData, eventsData, clientsData] = await Promise.all([
        Task.list("-due_date", 5000).catch(() => []),
        Event.list("-start_date", 500).catch(() => []),
        Client.list("name", 1000).catch(() => []),
      ]);

      setClients(Array.isArray(clientsData) ? clientsData : []);

      const rawTasks = Array.isArray(tasksData) ? tasksData : [];
      const nowMs = Date.now();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const in3Days = new Date(today);
      in3Days.setDate(in3Days.getDate() + 3);

      const allTasks = rawTasks.filter(task => {
        const taskDate = task.due_date || task.created_date;
        if (!taskDate) return true;
        const daysSince = Math.floor((nowMs - new Date(taskDate).getTime()) / (1000 * 60 * 60 * 24));
        if (task.status === 'completed' && daysSince > 7) return false;
        if (task.status !== 'completed' && daysSince > 30) return false;
        return true;
      });

      const activeTasks = allTasks.filter(t => t.status !== 'completed' && t.status !== 'not_relevant');

      // Inbox items = tasks with source 'quick-capture' that have no category/client
      const inbox = activeTasks.filter(t =>
        t.source === 'quick-capture' && !t.client_name && !t.category
      );
      setInboxItems(inbox);

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
          if (t.status !== 'completed') return false;
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
      const updatePayload = { status: newStatus };
      await Task.update(task.id, updatePayload);
      syncNotesWithTaskStatus(task.id, newStatus);

      // Dispatch completion event for CompletionFeedback
      if (newStatus === 'completed') {
        window.dispatchEvent(new CustomEvent('calmplan:task-completed', { detail: { task } }));
      }

      setData(prev => {
        if (!prev) return prev;
        const updateInList = (list) => list.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
        const filterCompleted = (list) => list.filter(t => !(t.id === task.id && (newStatus === 'completed' || newStatus === 'not_relevant')));
        return {
          ...prev,
          overdue: filterCompleted(updateInList(prev.overdue)),
          today: filterCompleted(updateInList(prev.today)),
          upcoming: filterCompleted(updateInList(prev.upcoming)),
          payment: newStatus === 'reported_waiting_for_payment'
            ? [...prev.payment, { ...task, status: newStatus }]
            : prev.payment.filter(t => t.id !== task.id),
          completedToday: newStatus === 'completed' ? prev.completedToday + 1 : prev.completedToday,
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

  const handleInboxDismiss = useCallback(async (item) => {
    // Move item out of inbox by assigning it a category
    try {
      await Task.update(item.id, { source: 'assigned', category: 'אחר' });
      setInboxItems(prev => prev.filter(i => i.id !== item.id));
    } catch { /* ignore */ }
  }, []);

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

  // Progress calculation for floating panel
  const todayTotal = data.today.length + (data.overdue?.length || 0);
  const progress = todayTotal > 0 ? (data.completedToday / (todayTotal + data.completedToday)) * 100 : 0;

  return (
    <motion.div
      className="relative w-full"
      style={{ height: 'calc(100vh - 42px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* ═══ MINDMAP VIEW — FULL BLEED, TAKES 100% OF SPACE ═══ */}
      {focusView === 'mindmap' ? (
        <div className="w-full h-full relative">
          <MindMapView
            tasks={data.activeTasks || allFocusTasks}
            clients={clients}
            inboxItems={inboxItems}
            onInboxDismiss={handleInboxDismiss}
            focusMode={focusMode}
          />

          {/* ── FLOATING STATS PANEL (glass, draggable, expandable) ── */}
          <DraggablePanel
            storageKey="stats"
            className="absolute top-2 right-2 z-30"
          >
          <div
            className="flex flex-col rounded-xl border border-gray-200/60 shadow-lg overflow-hidden transition-all duration-300"
            style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', width: statsExpanded ? '220px' : '180px' }}
          >
            {/* Header — always visible, click to expand/collapse */}
            <button
              onClick={() => setStatsExpanded(!statsExpanded)}
              className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">
                  {getGreeting()}{userName ? `, ${userName}` : ''}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${statsExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Compact bar — always visible: key numbers in a row */}
            <div className="flex items-center gap-2 px-3 pb-1.5">
              <Link to={createPageUrl("Tasks") + "?tab=active&context=work"} className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                <Briefcase className="w-3.5 h-3.5" style={{ color: ZERO_PANIC.blue }} />
                <span className="text-sm font-extrabold" style={{ color: ZERO_PANIC.blue }}>{data.workCount}</span>
              </Link>
              <div className="w-px h-4 bg-gray-200" />
              <Link to={createPageUrl("Tasks") + "?tab=active&context=home"} className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                <HomeIcon className="w-3.5 h-3.5" style={{ color: ZERO_PANIC.green }} />
                <span className="text-sm font-extrabold" style={{ color: ZERO_PANIC.green }}>{data.homeCount}</span>
              </Link>
              {data.overdue.length > 0 && (
                <>
                  <div className="w-px h-4 bg-gray-200" />
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" style={{ color: ZERO_PANIC.orange }} />
                    <span className="text-sm font-extrabold" style={{ color: ZERO_PANIC.orange }}>{data.overdue.length}</span>
                  </div>
                </>
              )}
              {/* Progress mini */}
              <div className="flex-1 mx-1">
                <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${ZERO_PANIC.green}, #43A047)` }} />
                </div>
              </div>
              <span className="text-[10px] font-bold" style={{ color: ZERO_PANIC.green }}>{Math.round(progress)}%</span>
            </div>

            {/* Expanded details */}
            <AnimatePresence>
              {statsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-2 pt-1 border-t border-gray-100 flex flex-col gap-1.5">
                    {/* Date */}
                    <div className="text-[10px] text-gray-500 font-medium">
                      {format(new Date(), 'EEEE, d בMMMM yyyy', { locale: he })}
                    </div>

                    {/* Stat rows with stronger colors */}
                    <Link to={createPageUrl("Tasks") + "?tab=active&context=work"}>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer hover:shadow-sm transition-all" style={{ backgroundColor: '#E3F2FD' }}>
                        <Briefcase className="w-4 h-4" style={{ color: '#0277BD' }} />
                        <span className="text-sm font-bold" style={{ color: '#01579B' }}>{data.workCount}</span>
                        <span className="text-xs font-medium" style={{ color: '#0277BD' }}>משימות עבודה</span>
                      </div>
                    </Link>
                    <Link to={createPageUrl("Tasks") + "?tab=active&context=home"}>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer hover:shadow-sm transition-all" style={{ backgroundColor: '#E8F5E9' }}>
                        <HomeIcon className="w-4 h-4" style={{ color: '#2E7D32' }} />
                        <span className="text-sm font-bold" style={{ color: '#1B5E20' }}>{data.homeCount}</span>
                        <span className="text-xs font-medium" style={{ color: '#2E7D32' }}>בית ואישי</span>
                      </div>
                    </Link>
                    {data.overdue.length > 0 && (
                      <div className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ backgroundColor: '#FFF3E0' }}>
                        <Clock className="w-4 h-4" style={{ color: '#E65100' }} />
                        <span className="text-sm font-bold" style={{ color: '#BF360C' }}>{data.overdue.length}</span>
                        <span className="text-xs font-medium" style={{ color: '#E65100' }}>באיחור</span>
                      </div>
                    )}
                    <Link to={createPageUrl("Calendar")}>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer hover:shadow-sm transition-all bg-purple-50">
                        <Calendar className="w-4 h-4 text-purple-700" />
                        <span className="text-sm font-bold text-purple-800">{data.todayEvents.length}</span>
                        <span className="text-xs font-medium text-purple-700">אירועים היום</span>
                      </div>
                    </Link>

                    {/* Completed today */}
                    {data.completedToday > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium" style={{ color: ZERO_PANIC.green }}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        {data.completedToday} הושלמו היום
                      </div>
                    )}

                    {/* Setup warning */}
                    {setupIncomplete.missing > 0 && (
                      <Link to={createPageUrl("SystemReadiness")}>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-300 cursor-pointer hover:bg-amber-100 transition-colors">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span className="text-xs text-amber-800 font-bold">{setupIncomplete.missing} לקוחות חסרי נתונים</span>
                        </div>
                      </Link>
                    )}

                    {/* Quick Add */}
                    <Button size="sm" onClick={() => setShowQuickAdd(true)} className="bg-primary hover:bg-accent text-white gap-1 h-7 text-xs px-3 w-full">
                      <Plus className="w-3.5 h-3.5" />
                      משימה מהירה
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </DraggablePanel>

          {/* ── FLOATING VIEW SWITCHER (top center-left, draggable) ── */}
          <DraggablePanel
            storageKey="switcher"
            className="absolute top-2 left-1/2 -translate-x-1/2 z-30"
          >
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/40 shadow-md"
            style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          >
            <Target className="w-3.5 h-3.5" style={{ color: ZERO_PANIC.blue }} />
            <span className="text-[10px] font-semibold text-gray-600 ml-0.5">מרכז השליטה</span>
            <div className="flex bg-gray-100/80 rounded-md p-0.5 mr-1">
              <Button variant={focusView === 'mindmap' ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5" onClick={() => setFocusView('mindmap')} title="מפת חשיבה">
                <Network className="w-2.5 h-2.5" />
              </Button>
              <Button variant={focusView === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5" onClick={() => setFocusView('kanban')} title="קנבן">
                <LayoutGrid className="w-2.5 h-2.5" />
              </Button>
              <Button variant={focusView === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5" onClick={() => setFocusView('list')} title="רשימה">
                <List className="w-2.5 h-2.5" />
              </Button>
              <Button variant={focusView === 'gantt' ? 'secondary' : 'ghost'} size="icon" className="h-5 w-5" onClick={() => setFocusView('gantt')} title="ציר זמן">
                <BarChart3 className="w-2.5 h-2.5" />
              </Button>
            </div>
            <Link to={createPageUrl("Tasks")}>
              <span className="text-[9px] text-gray-400 hover:text-gray-600 cursor-pointer whitespace-nowrap">כל המשימות →</span>
            </Link>
          </div>
          </DraggablePanel>

          {/* ── FLOATING INSIGHTS (bottom strip, glass, draggable) ── */}
          {insights.length > 0 && (
            <DraggablePanel
              storageKey="insights"
              className="absolute bottom-2 left-2 z-30"
              style={{ right: '220px' }}
            >
            <div
              className="flex gap-1.5 overflow-x-auto px-2 py-1.5 rounded-lg border border-white/40"
              style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            >
              {insights.slice(0, 4).map((insight, i) => {
                const colorMap = {
                  teal: { bg: 'bg-teal-50/80', text: 'text-teal-700', icon: 'text-teal-500' },
                  amber: { bg: 'bg-amber-50/80', text: 'text-amber-700', icon: 'text-amber-500' },
                  blue: { bg: 'bg-blue-50/80', text: 'text-blue-700', icon: 'text-blue-500' },
                  emerald: { bg: 'bg-emerald-50/80', text: 'text-emerald-700', icon: 'text-emerald-500' },
                };
                const c = colorMap[insight.color] || colorMap.teal;
                return (
                  <div key={i} className={`${c.bg} rounded-md px-2 py-0.5 flex items-center gap-1 shrink-0`}>
                    <div className={`${c.icon} flex-shrink-0`}>
                      {insight.type === 'warning' && <AlertTriangle className="w-2.5 h-2.5" />}
                      {insight.type === 'action' && <Zap className="w-2.5 h-2.5" />}
                      {insight.type === 'progress' && <Clock className="w-2.5 h-2.5" />}
                      {insight.type === 'info' && <Eye className="w-2.5 h-2.5" />}
                      {insight.type === 'celebration' && <Sparkles className="w-2.5 h-2.5" />}
                    </div>
                    <p className={`text-[10px] font-medium ${c.text} truncate max-w-[180px]`}>{insight.title}</p>
                  </div>
                );
              })}
            </div>
            </DraggablePanel>
          )}

          {/* ── FLOATING QUICK ACTIONS (bottom right, draggable) ── */}
          <DraggablePanel
            storageKey="quick_actions"
            className="absolute bottom-2 right-2 z-30"
          >
          <div
            className="flex gap-1.5 px-2 py-1.5 rounded-lg border border-white/40"
            style={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            <Link to={createPageUrl("WeeklyPlanningDashboard")}>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-blue-50 cursor-pointer transition-colors">
                <Brain className="w-3 h-3" style={{ color: ZERO_PANIC.blue }} />
                <span className="text-[10px] font-medium" style={{ color: '#1565C0' }}>תכנון</span>
              </div>
            </Link>
            <Link to={createPageUrl("PayrollDashboard")}>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-gray-100 cursor-pointer transition-colors">
                <Briefcase className="w-3 h-3 text-gray-500" />
                <span className="text-[10px] font-medium text-gray-700">שכר</span>
              </div>
            </Link>
            <Link to={createPageUrl("AutomationRules")}>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-orange-50 cursor-pointer transition-colors">
                <Zap className="w-3 h-3" style={{ color: ZERO_PANIC.orange }} />
                <span className="text-[10px] font-medium" style={{ color: '#E65100' }}>אוטומציות</span>
              </div>
            </Link>
          </div>
          </DraggablePanel>
        </div>
      ) : (
        /* ═══ NON-MINDMAP VIEWS — use traditional layout ═══ */
        <div className="h-full flex flex-col p-2 gap-2 overflow-auto">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-0 py-1.5 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Target className="w-4 h-4" style={{ color: ZERO_PANIC.blue }} />
                  <span>מרכז השליטה</span>
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <Button variant={focusView === 'mindmap' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6" onClick={() => setFocusView('mindmap')} title="מפת חשיבה">
                      <Network className="w-3 h-3" />
                    </Button>
                    <Button variant={focusView === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6" onClick={() => setFocusView('kanban')} title="קנבן">
                      <LayoutGrid className="w-3 h-3" />
                    </Button>
                    <Button variant={focusView === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6" onClick={() => setFocusView('list')} title="רשימה">
                      <List className="w-3 h-3" />
                    </Button>
                    <Button variant={focusView === 'gantt' ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6" onClick={() => setFocusView('gantt')} title="ציר זמן">
                      <BarChart3 className="w-3 h-3" />
                    </Button>
                  </div>
                  <Link to={createPageUrl("Tasks")}>
                    <Button variant="ghost" size="sm" className="text-[10px] text-gray-500 gap-0.5 h-6 px-1.5">
                      כל המשימות <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="relative mt-1.5 mb-1">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <Input placeholder="חיפוש..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-8 h-7 text-xs" />
              </div>
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
                      {count > 0 && <Badge className={`text-[9px] px-1 py-0 h-3.5 ${isActive ? tab.badgeColor : 'bg-gray-100 text-gray-500'}`}>{count}</Badge>}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pt-2 pb-2">
              {focusView === 'gantt' ? (
                <div className="relative h-full">
                  <GanttView tasks={allFocusTasks} clients={clients} />
                  <button onClick={() => setFocusView('mindmap')} className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 shadow-md border border-emerald-200 text-emerald-700 text-xs font-medium">
                    <Network className="w-3.5 h-3.5" /><span>חזרה למפה</span>
                  </button>
                </div>
              ) : focusView === 'kanban' ? (
                <KanbanView tasks={allFocusTasks} onTaskStatusChange={handleStatusChange} onDeleteTask={(taskId) => handleDeleteTask({ id: taskId })} onEditTask={handleEditTask} />
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.12 }}>
                    {getTabContent()}
                  </motion.div>
                </AnimatePresence>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Add Task Dialog */}
      <QuickAddTaskDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onCreated={loadData}
      />

      {/* Task Edit Dialog */}
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

      {/* FAB — removed, using Layout global FABs instead */}
    </motion.div>
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
  const [showAll, setShowAll] = useState(false);
  const visibleTasks = showAll ? tasks : tasks.slice(0, 15);

  return (
    <div className="space-y-2">
      {visibleTasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onPaymentDateChange={onPaymentDateChange}
          onEdit={onEdit}
          onNote={onNote}
          showDeadlineContext={showDeadlineContext}
          showDate={showDate}
          showPaymentDate={showPaymentDate}
        />
      ))}
      {tasks.length > 15 && (
        <Button variant="ghost" size="sm" className="w-full text-gray-500" onClick={() => setShowAll(!showAll)}>
          <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? 'הצג פחות' : `עוד ${tasks.length - 15} משימות`}
        </Button>
      )}
    </div>
  );
}

// Zero-Panic priority styles (NO RED)
const priorityStyles = {
  urgent: 'border-r-4 border-r-[#F57C00]',  // Orange, not red
  high: 'border-r-4 border-r-[#FF8F00]',     // Amber
  medium: 'border-r-4 border-r-[#FFB300]',   // Yellow-amber
  low: 'border-r-4 border-r-gray-300',
};

function TaskRow({ task, onStatusChange, onPaymentDateChange, onEdit, onNote, showDeadlineContext, showDate, showPaymentDate }) {
  const ctx = getTaskContext(task);
  const isWork = ctx === 'work';
  const isHome = ctx === 'home';

  // Ghost node: missing due date or complexity
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
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors ${priorityStyles[task.priority] || 'border-r-4 border-r-gray-200'} ${isOverdue ? 'bg-orange-50/30' : ''} ${isMissingData ? 'opacity-60 border-dashed' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-800 truncate">{task.title}</span>
          {task.priority === 'urgent' && (
            <Badge style={{ backgroundColor: '#FFF3E0', color: '#E65100' }} className="text-[10px] px-1.5 py-0">דחוף</Badge>
          )}
          {isMissingData && (
            <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 border border-dashed border-gray-300">חסר מידע</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.client_name && (
            <span className="text-[11px] text-gray-500 truncate max-w-[120px]">{task.client_name}</span>
          )}
          {task.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{task.category}</Badge>
          )}
          {task.client_size && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-bold">{task.client_size}</Badge>
          )}
          {showDeadlineContext && isOverdue && (
            <Badge style={{ backgroundColor: '#F3E5F5', color: '#7B1FA2' }} className="text-[10px] px-1.5 py-0">
              {daysFromDue === 1 ? 'אתמול' : `${daysFromDue} ימים באיחור`}
            </Badge>
          )}
          {showDeadlineContext && !isOverdue && task.due_date && (
            <span className="text-[10px] text-gray-400">היום - {format(parseISO(task.due_date), 'd/M')}</span>
          )}
          {showDate && task.due_date && (
            <span className="text-[10px] text-gray-400">
              {isTomorrow(parseISO(task.due_date)) ? 'מחר' : format(parseISO(task.due_date), 'd/M')}
            </span>
          )}
          {showPaymentDate && task.payment_due_date && (
            <Badge className={`text-[10px] px-1.5 py-0 ${paymentDaysLeft <= 0 ? 'bg-purple-100 text-purple-700' : paymentDaysLeft <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {paymentDaysLeft < 0 ? `${Math.abs(paymentDaysLeft)} ימים באיחור תשלום` : paymentDaysLeft === 0 ? 'תשלום היום' : `${paymentDaysLeft} ימים לתשלום`}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onNote && (
          <button
            onClick={() => onNote(task)}
            className="p-1 rounded hover:bg-amber-100 transition-colors"
            title="הוסף לפתק דביק"
          >
            <Pin className="w-3.5 h-3.5 text-gray-400 hover:text-amber-600" />
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            title="ערוך משימה"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
        {task.status === 'reported_waiting_for_payment' && onPaymentDateChange && (
          <input
            type="date"
            value={task.payment_due_date || ''}
            onChange={(e) => onPaymentDateChange(task, e.target.value)}
            className="h-7 text-[10px] px-1.5 w-[110px] border border-yellow-300 rounded bg-yellow-50 text-yellow-800"
            title="תאריך יעד לתשלום"
          />
        )}
        {onStatusChange && (
          <Select value={task.status || 'not_started'} onValueChange={(newStatus) => onStatusChange(task, newStatus)}>
            <SelectTrigger className={`h-7 text-[10px] px-2 w-auto min-w-[90px] border-0 ${statusCfg.color}`}>
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
