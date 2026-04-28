
import React, { useState, useEffect, useCallback, useMemo, Component } from "react";
import { Task, Event, Client } from "@/api/entities";
import { parseISO, format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Briefcase, Home as HomeIcon, Calendar, CheckCircle, Clock,
  Target, AlertTriangle, ChevronDown, Sparkles,
  Plus, CreditCard,
  Map, ArrowRight, X, FileBarChart, Calculator, GitBranch, Zap, TrendingUp,
} from "lucide-react";
import { getActiveTreeTasks } from '@/utils/taskTreeFilter';
import TaskSidePanel from "@/components/tasks/TaskSidePanel";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Pencil, Trash2, Pin, ExternalLink, BookOpen } from "lucide-react";
import { getDashboardUrlForTask, getDashboardLabelForTask } from '@/utils/taskNavigation';
import TaskToNoteDialog from "@/components/tasks/TaskToNoteDialog";
import QuickAddTaskDialog from "@/components/tasks/QuickAddTaskDialog";
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import useRealtimeRefresh from "@/hooks/useRealtimeRefresh";
import useTaskCascade from "@/hooks/useTaskCascade";
import { useApp } from "@/contexts/AppContext";
import { useDesign } from "@/contexts/DesignContext";
import { useBiologicalClock } from "@/contexts/BiologicalClockContext";
// Stage 5.6: FocusMapView import removed — Home no longer embeds a canvas; the
// dedicated /MindMap page (AyoaRadialView — Stage 5.3c) owns that view now.
import OverdueAlert from "@/components/tasks/OverdueAlert";
import MoodCheckerInline from "@/components/home/MoodCheckerInline";
import AdvanceWarningPanel from "@/components/calendar/AdvanceWarningPanel";
import BadDayMode from "@/components/tasks/BadDayMode";
import SmartNudge from "@/components/home/SmartNudge";
import TaskInsights from "@/components/home/TaskInsights";
import AyoaMiniMap from "@/components/home/AyoaMiniMap";
// Stage 5.9: CategoryBreakdown removed — the byCategory tab that rendered it
// is gone from Home (duplicated what AyoaMiniMap already surfaces).
// Stage 5.9: capacityEngine import removed with the dead capacityKPIs useMemo.
import { StickyNote } from "@/api/entities";
import { selectNodeByTask } from '@/lib/nodeSelection';
import { useUndo } from '@/contexts/UndoContext';

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

// Error Boundary to catch React #310 and other render errors
class MapErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.warn('[MapErrorBoundary]', err.message); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl py-6 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <Sparkles className="w-10 h-10 mx-auto mb-2" style={{ color: '#10B981' }} />
          <p className="text-sm text-gray-500">אין משימות להיום — כל הכבוד!</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const FOCUS_TABS = [
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
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [badDayActive, setBadDayActive] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  // Stage 5.7: real toggle state — was a useMemo before, so the section
  // headers had no working onClick. Now each tab can be opened/closed by tap.
  // Stage 5.9: byCategory removed — duplicated AyoaMiniMap and CategoryBreakdown.
  const [openSections, setOpenSections] = useState({
    today: true,
    upcoming: false,
    events: false,
    payment: false,
  });
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { focusMode, filterByEnergy, energyLevel, setEnergyLevel } = useApp();
  const [stickyNotes, setStickyNotes] = useState([]);
  const [currentMood, setCurrentMood] = useState(null);

  // When mood changes, auto-adjust energy level for ADHD support
  const handleMoodChange = useCallback((mood) => {
    setCurrentMood(mood);
    if (!mood) return;
    if (mood <= 4) setEnergyLevel('low');
    else if (mood <= 7) setEnergyLevel('medium');
    // mood >= 8: don't override — let user keep their chosen energy level
  }, [setEnergyLevel]);

  let design = null;
  try { design = useDesign(); } catch { /* not mounted */ }

  // Stage 5.5: undo stack — push entries on destructive/status changes.
  const { pushUndo } = useUndo();

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
      // Active tasks for HOME visualizations (circles, today/upcoming/overdue
      // sections) exclude both fully-completed tasks AND tasks that finished
      // their primary workflow (דיווח+תשלום) and are only awaiting bookkeeping
      // recording — those are surfaced in their own dedicated section so they
      // don't visually compete with tasks that still need real work.
      const activeTasks = allTasks.filter(t => t.status !== 'production_completed' && t.status !== 'awaiting_recording');
      const awaitingRecording = allTasks.filter(t => t.status === 'awaiting_recording');

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

      // Payment tab — exclude ghost tasks (same condition as TaskRow's isMissingData)
      const waitingPayment = allTasks.filter(t => {
        if (!t.due_date || !t.client_size) return false;
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

      const sortedOverdue = sortByPriority(overdue);
      const sortedToday = sortByPriority(todayTasks);
      setData({
        allTasks,
        activeTasks,
        awaitingRecording,
        overdue: sortedOverdue,
        today: sortedToday,
        mergedToday: sortByPriority([...overdue, ...todayTasks]),
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
        completedYesterday: (() => {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return allTasks.filter(t => {
            if (t.status !== 'production_completed') return false;
            const d = t.updated_date || t.due_date;
            if (!d) return false;
            try {
              const parsed = parseISO(d);
              parsed.setHours(0, 0, 0, 0);
              return parsed.getTime() === yesterday.getTime();
            } catch { return false; }
          }).length;
        })(),
      });

    } catch (error) {
      console.error("Error loading home page data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    const previousStatus = task.status;
    try {
      await Task.update(task.id, { status: newStatus });
      // Stage 5.5: allow Ctrl+Z to revert the status change.
      if (previousStatus && previousStatus !== newStatus) {
        pushUndo({
          label: `שינוי סטטוס: ${task.title}`,
          undo: async () => {
            await Task.update(task.id, { status: previousStatus });
            loadData();
            loadStickyNotes();
          },
        });
      }
      syncNotesWithTaskStatus(task.id, newStatus);
      loadStickyNotes();
      if (newStatus === 'production_completed') {
        window.dispatchEvent(new CustomEvent('calmplan:task-completed', { detail: { task } }));
      }
      setData(prev => {
        if (!prev) return prev;
        const updatedTask = { ...task, status: newStatus };
        const updateInList = (list) => list.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
        // Remove this task from active lists when its new status pushes it
        // out of the "things you still need to actively work on" set —
        // covers both production_completed AND awaiting_recording.
        const isLeavingActive = newStatus === 'production_completed' || newStatus === 'awaiting_recording';
        const filterCompleted = (list) => list.filter(t => !(t.id === task.id && isLeavingActive));

        // When production completed, check if task should flow to payment tab
        const shouldMoveToPayment =
          newStatus === 'production_completed' &&
          ((task.process_steps?.payment && !task.process_steps.payment.done) ||
            !!task.payment_due_date);
        let newPayment = prev.payment.filter(t => t.id !== task.id);
        if (shouldMoveToPayment) {
          newPayment = [...newPayment, updatedTask];
        }

        const newOverdue = filterCompleted(updateInList(prev.overdue));
        const newToday = filterCompleted(updateInList(prev.today));
        // Stage 5.10: also refresh the mirrored lists that AyoaMiniMap and
        // any other consumer reads from. allTasks keeps every task with
        // the new status; activeTasks filters out production_completed so
        // the mind-map circle counts immediately reflect the change.
        const newAllTasks = (prev.allTasks || []).map(t =>
          t.id === task.id ? { ...t, status: newStatus } : t
        );
        const newActiveTasks = newAllTasks.filter(t => t.status !== 'production_completed' && t.status !== 'awaiting_recording');
        const newAwaitingRecording = newAllTasks.filter(t => t.status === 'awaiting_recording');
        return {
          ...prev,
          allTasks: newAllTasks,
          activeTasks: newActiveTasks,
          awaitingRecording: newAwaitingRecording,
          overdue: newOverdue,
          today: newToday,
          mergedToday: sortByPriority([...newOverdue, ...newToday]),
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
    // Stage 5.5: capture previous values for undo before overwriting.
    const previousTask = (data?.allTasks || []).find(t => t.id === taskId);
    const changedKeys = Object.keys(updatedData || {});
    const previousValues = {};
    if (previousTask) {
      for (const k of changedKeys) previousValues[k] = previousTask[k];
    }
    try {
      await Task.update(taskId, updatedData);
      if (previousTask && changedKeys.length > 0) {
        pushUndo({
          label: `עריכת משימה: ${previousTask.title || 'ללא שם'}`,
          undo: async () => {
            await Task.update(taskId, previousValues);
            loadData();
            loadStickyNotes();
          },
        });
      }
      loadData();
      loadStickyNotes();
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
      // Stage 5.5: snapshot the task so Ctrl+Z can re-create it.
      // Drop auto-managed fields so we don't fight the backend on recreate.
      const { id, created_date, updated_date, ...taskPayload } = task || {};
      try {
        await Task.delete(task.id);
        pushUndo({
          label: `מחיקת משימה: ${task.title || 'ללא שם'}`,
          undo: async () => {
            try {
              await Task.create(taskPayload);
            } catch (err) {
              console.warn('undo delete-task failed:', err);
            }
            loadData();
            loadStickyNotes();
          },
        });
        loadData();
        loadStickyNotes();
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

  // Stage 5.9: capacityKPIs + calmTasks useMemos removed — neither was
  // rendered anywhere in JSX, and capacityKPIs was the last consumer of
  // capacityEngine, so that import is gone too.

  // ── SmartNudge: pick top insight and convert to gentle nudge ──
  // MUST be before early returns (Rules of Hooks)
  const INSIGHT_ICON_MAP = { FileBarChart, Clock, Calculator, GitBranch, Zap, AlertTriangle, TrendingUp };
  const INSIGHT_COLOR_MAP = { teal: 'blue', amber: 'orange', blue: 'blue', sky: 'blue', emerald: 'green' };
  const smartNudge = useMemo(() => {
    if (!insights || insights.length === 0) return null;
    const top = insights.find(i => i.type !== 'celebration') || insights[0];
    if (!top) return null;
    const IconComp = INSIGHT_ICON_MAP[top.icon] || Sparkles;
    const color = INSIGHT_COLOR_MAP[top.color] || 'blue';
    let message = top.description || '';
    if (top.type === 'action') {
      message = `כשתהיי מוכנה — ${top.title.toLowerCase()}. אפשר לפי הקצב שלך`;
    } else if (top.type === 'warning') {
      message = `יש ${top.count} משימות שכדאי לתת להן תשומת לב כשיהיה לך רגע`;
    } else if (top.type === 'celebration') {
      message = top.description;
    } else {
      message = top.description || top.title;
    }
    return { icon: IconComp, title: top.title, message, color };
  }, [insights]);

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

  // Stage 5.9: filterBySearch + allFocusTasks + getTabContent removed.
  // searchTerm state is gone (there's no <Input> driving it), so every
  // filterBySearch call was a no-op. getTabContent was the old single-tab
  // switch that the 2-column grid replaced.

  const getTabCount = (tabKey) => {
    if (tabKey === 'events') return (data.todayEvents || []).length;
    if (tabKey === 'today') return (data.mergedToday || []).length;
    return (data[tabKey] || []).length;
  };

  const getSectionData = (tabKey) => {
    if (tabKey === 'events') return data.todayEvents || [];
    if (tabKey === 'today') return data.mergedToday || [];
    return data[tabKey] || [];
  };

  const todayTotal = data.today.length + (data.overdue?.length || 0);
  const progress = todayTotal > 0 ? (data.completedToday / (todayTotal + data.completedToday)) * 100 : 0;

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
              {data.completedYesterday > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  <CheckCircle className="w-3 h-3 inline ml-1" style={{ color: '#5A9EB5' }} />
                  אתמול סיימת {data.completedYesterday} משימות.{' '}
                  היום יש {data.today.length + data.overdue.length}
                </p>
              )}
              {bioClockZone && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-base">{bioClockZone.icon}</span>
                  <span className="text-xs font-medium" style={{ color: bioClockZone.color }}>
                    {bioClockZone.label} · {bioClockZone.description}
                  </span>
                </div>
              )}
              <MoodCheckerInline onMoodChange={handleMoodChange} />
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
                {data.awaitingRecording?.length > 0 && (
                  <Link
                    to={createPageUrl("Tasks") + "?status=awaiting_recording"}
                    className="flex items-center gap-1 hover:opacity-80"
                    title="ממתין לרישום בהנה״ש — דיווח+תשלום בוצעו, חסר רק רישום"
                  >
                    <BookOpen className="w-3 h-3" style={{ color: '#0284C7' }} />
                    <span className="text-xs font-bold" style={{ color: '#0284C7' }}>
                      {data.awaitingRecording.length}
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Stage 5.7.3: action button row — replaces both the old standalone
              "מפת חשיבה" link card AND the bottom "הצג מפה מלאה" button.
              "חדש" moves out of the right-cluster so both actions sit
              together in one obvious row. */}
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => setShowQuickAdd(true)}
              className="bg-[#5A9EB5] hover:bg-[#4A8EA5] text-white gap-1 h-7 text-xs px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              חדש
            </Button>
            <Link to={createPageUrl('MindMap')}>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-7 text-xs px-3 border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <Map className="w-3.5 h-3.5" />
                מפת חשיבה
              </Button>
            </Link>
          </div>

          {/* Battery Banner — Stage 5.7.3 (replaces the old 1px progress bar).
              Big completed-today number on the right (RTL), thick coloured bar
              in the middle, total-tasks descriptor on the left. Bar colour
              shifts amber → blue → green as progress climbs. */}
          <div className="flex items-center gap-3 mt-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-base font-black text-slate-700 tabular-nums min-w-[3ch]">
              {data.completedToday}
            </span>
            <div className="flex-1 relative bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: progress >= 80 ? '#10B981' : progress >= 40 ? '#5A9EB5' : '#F59E0B',
                }}
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              מתוך {todayTotal + data.completedToday} משימות
            </span>
          </div>

          {/* Energy level buttons — Stage 5.7.3: bad-day toggle now lives
              inline at the end of this row instead of as a standalone card.
              flex-wrap added so the row can break on narrow screens. */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[13px] text-slate-400">רמת אנרגיה:</span>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: 'full', emoji: '☀️', label: 'מלא', bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
                { key: 'medium', emoji: '☕', label: 'בינוני', bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
                { key: 'low', emoji: '🔋', label: 'נמוך', bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
              ].map(opt => {
                const isActive = energyLevel === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setEnergyLevel(opt.key)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? opt.bg : 'transparent',
                      border: isActive ? `1.5px solid ${opt.border}` : '1.5px solid #E5E7EB',
                      color: isActive ? opt.text : '#64748B',
                      transform: isActive ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
              {/* Stage 5.7.3: bad-day toggle inline */}
              <button
                onClick={() => setBadDayActive(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: badDayActive ? '#FEE2E2' : 'transparent',
                  border: badDayActive ? '1.5px solid #F87171' : '1.5px solid #E5E7EB',
                  color: badDayActive ? '#991B1B' : '#64748B',
                }}
              >
                <span>😮‍💨</span>
                <span>יום קשה?</span>
              </button>
            </div>
          </div>

          {/* BadDayMode card — only when the inline toggle above is active */}
          {badDayActive && (
            <div className="mt-3">
              <BadDayMode isActive={badDayActive} onToggle={setBadDayActive} onPostponeTasks={handlePostponeBadDay} />
            </div>
          )}
        </div>

        {/* ═══ 1.2 Ayoa Mini-Map — service-domain overview (Stage 5.10) ═══
            Handlers are passed down so the drawer can edit status, open the
            side panel, and promote tasks to sticky notes without the user
            having to leave Home. The mini-map still renders its SVG on its
            own; these props just unlock the editable drawer. */}
        <AyoaMiniMap
          tasks={data.activeTasks}
          onStatusChange={handleStatusChange}
          onEditTask={setEditingTask}
          onPaymentDateChange={handlePaymentDateChange}
          onNote={setNoteTask}
        />

        {/* Stage 5.9: standalone CategoryBreakdown removed — it duplicated
            what the AyoaMiniMap + the byCategory tab both already surface.
            Home keeps a single source of truth for "what domains do I have
            today?" — the AyoaMiniMap circles. */}

        {/* ═══ Stage 5.7.3 — 2-column grid below the AyoaMiniMap ═══
            Cuts the page height nearly in half so most of the morning view
            fits in one viewport. On mobile (single col) the right column
            stacks on top so 'היום' is still the first thing seen.
            Right column (RTL first child)  = primary: היום + StickyNotes
                                              + SmartNudge + TaskInsights
            Left column  (RTL second child) = secondary: upcoming/events/
                                              payment + alerts + categories.
            Stage 5.7.3: BadDayMode standalone card removed — now lives
            inline in the greeting. Mind-map link card also removed —
            replaced by the button next to 'חדש'. */}
        <div dir="rtl" className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ─── RIGHT column (visually first in RTL) ─── */}
          <div className="space-y-3">
            {/* Stage 5.9: היום only — the "לפי תחום" byCategory tab was
                removed because it duplicated AyoaMiniMap + CategoryBreakdown. */}
            <div className="space-y-2">
              {FOCUS_TABS.filter(t => t.key === 'today').map(tab => {
                const Icon = tab.icon;
                const items = getSectionData(tab.key);
                const count = getTabCount(tab.key);
                const isOpen = openSections[tab.key];
                const overdueCount = data.overdue?.length || 0;

                return (
                  <div key={tab.key} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                    <button
                      type="button"
                      dir="rtl"
                      onClick={() => setOpenSections(prev => ({ ...prev, [tab.key]: !prev[tab.key] }))}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${tab.color}`} />
                        <span className="text-sm font-semibold text-slate-700">{tab.label}</span>
                        {count > 0 && (
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${tab.badgeColor}`}>
                            {count}
                          </span>
                        )}
                        {overdueCount > 0 && (
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            {overdueCount} באיחור
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3">
                            {/* Stage 5.9: OverdueAlert lives inside the
                                היום section — sky-toned, self-hides when
                                data.overdue is empty, renders the overdue
                                tasks as a gentle header above the list. */}
                            <OverdueAlert tasks={data.overdue} />
                            {items.length === 0 ? (
                              <EmptyState
                                icon={<Sparkles className="w-10 h-10" style={{ color: ZERO_PANIC.green }} />}
                                text="אין משימות להיום - כל הכבוד!"
                              />
                            ) : (
                              (() => {
                                const HOME_MAX_TASKS = 5;
                                const limitedItems = items.slice(0, HOME_MAX_TASKS);
                                const hasMore = items.length > HOME_MAX_TASKS;
                                return (
                                  <>
                                    <TaskList
                                      tasks={limitedItems}
                                      onStatusChange={handleStatusChange}
                                      onPaymentDateChange={handlePaymentDateChange}
                                      onEdit={setEditingTask}
                                      onNote={setNoteTask}
                                      showDeadlineContext
                                    />
                                    <div className="text-[13px] text-slate-500 text-center mt-2">
                                      מוצגות {limitedItems.length} מתוך {items.length}
                                    </div>
                                    {hasMore && (
                                      <Link
                                        to={createPageUrl('Tasks')}
                                        className="flex items-center justify-center gap-1.5 mt-2 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                                      >
                                        הצג הכל ({items.length})
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </Link>
                                    )}
                                  </>
                                );
                              })()
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Sticky Notes — max 4 */}
            {stickyNotes.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold px-1" style={{ color: '#000000' }}>פתקים דביקים</h3>
                <div className="grid grid-cols-2 gap-2">
                  {stickyNotes.slice(0, 4).map(note => {
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

            {/* SmartNudge — one gentle nudge */}
            <SmartNudge nudge={smartNudge} />

            {/* Task Insights — proactive insights from Cascade */}
            <TaskInsights insights={smartNudge ? insights.filter(i => i.title !== smartNudge.title) : insights} />
          </div>

          {/* ─── LEFT column (visually second in RTL) ─── */}
          <div className="space-y-3">
            {/* upcoming / events / payment focus tabs */}
            <div className="space-y-2">
              {FOCUS_TABS.filter(t => t.key !== 'today').map(tab => {
                const Icon = tab.icon;
                const items = getSectionData(tab.key);
                const count = getTabCount(tab.key);
                const isOpen = openSections[tab.key];

                return (
                  <div key={tab.key} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                    <button
                      type="button"
                      dir="rtl"
                      onClick={() => setOpenSections(prev => ({ ...prev, [tab.key]: !prev[tab.key] }))}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${tab.color}`} />
                        <span className="text-sm font-semibold text-slate-700">{tab.label}</span>
                        {count > 0 && (
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${tab.badgeColor}`}>
                            {count}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-3">
                            {tab.key === 'events' ? (
                              items.length === 0 ? (
                                <EmptyState icon={<Calendar className="w-10 h-10 text-purple-300" />} text="אין אירועים היום" />
                              ) : (
                                <div className="space-y-2">
                                  {items.map(event => (
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
                              )
                            ) : (
                              items.length === 0 ? (
                                <EmptyState
                                  icon={tab.key === 'payment' ? <CreditCard className="w-10 h-10 text-yellow-300" /> :
                                        <Clock className="w-10 h-10 text-gray-300" />}
                                  text={tab.key === 'payment' ? 'אין משימות ממתינות לתשלום' :
                                        'אין משימות ל-3 ימים הקרובים'}
                                />
                              ) : (
                                (() => {
                                  const HOME_MAX_TASKS = 5;
                                  const limitedItems = items.slice(0, HOME_MAX_TASKS);
                                  const hasMore = items.length > HOME_MAX_TASKS;
                                  return (
                                    <>
                                      <TaskList
                                        tasks={limitedItems}
                                        onStatusChange={handleStatusChange}
                                        onPaymentDateChange={handlePaymentDateChange}
                                        onEdit={setEditingTask}
                                        onNote={setNoteTask}
                                        showDate={tab.key === 'upcoming'}
                                        showPaymentDate={tab.key === 'payment'}
                                      />
                                      <div className="text-[13px] text-slate-500 text-center mt-2">
                                        מוצגות {limitedItems.length} מתוך {items.length}
                                      </div>
                                      {hasMore && (
                                        <Link
                                          to={createPageUrl('Tasks')}
                                          className="flex items-center justify-center gap-1.5 mt-2 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                          הצג הכל ({items.length})
                                          <ArrowRight className="w-3.5 h-3.5" />
                                        </Link>
                                      )}
                                    </>
                                  );
                                })()
                              )
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Stage 5.9: AdvanceWarningPanel sits at the bottom of the left
                column — 7-day lookahead (calendar days; see the panel for
                the working-days note). The component self-hides when there
                are no upcoming deadlines, so this is free real estate. */}
            <AdvanceWarningPanel />
          </div>
        </div>

        {/* Stage 5.7.3: 'הצג מפה מלאה' button removed — replaced by the
            'מפת חשיבה' Button in the greeting action row. The route still
            exists at /MindMap; the in-page showFullMap branch was unused. */}

      </div>

      {/* Dialogs */}
      <QuickAddTaskDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} onCreated={loadData} />
      <TaskSidePanel task={editingTask} open={!!editingTask} onClose={() => setEditingTask(null)} onSave={handleEditTask} onDelete={handleDeleteTask} />
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

  // Stage 5.2: Hover/focus a row to highlight the matching node in the MindMap
  // (works even when the mind map is open in a separate tab/dialog via window event).
  const handleRowClick = (e) => {
    // Don't hijack clicks on interactive children (select, buttons, inputs)
    if (e.target.closest('button, [role="combobox"], input, select, textarea, a')) return;
    selectNodeByTask(task, 'home-task-list');
  };

  return (
    <div
      onClick={handleRowClick}
      className={`flex items-center gap-3 p-2.5 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${priorityStyles[task.priority] || 'border-e-4 border-e-gray-200'} ${isOverdue ? 'bg-orange-50' : ''} ${isMissingData ? 'opacity-60 border-dashed' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-800 truncate">{task.title}</span>
          {task.priority === 'urgent' && (
            <Badge dir="rtl" style={{ backgroundColor: '#FFF3E0', color: '#E65100' }} className="text-[11px] px-1.5 py-0">דחוף</Badge>
          )}
          {isMissingData && (
            <Badge dir="rtl" className="text-[11px] px-1.5 py-0 bg-gray-100 text-gray-500 border border-dashed border-gray-300">חסר מידע</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.client_name && (
            <span className="text-[11px] text-gray-500 truncate max-w-[120px]">{task.client_name}</span>
          )}
          {task.category && (
            <Badge dir="rtl" variant="outline" className="text-[11px] px-1.5 py-0 h-4">{task.category}</Badge>
          )}
          {task.client_size && (
            <Badge dir="rtl" variant="outline" className="text-[11px] px-1 py-0 h-4 font-bold">{task.client_size}</Badge>
          )}
          {showDeadlineContext && isOverdue && (
            <Badge dir="rtl" style={{ backgroundColor: '#F3E5F5', color: '#7B1FA2' }} className="text-[11px] px-1.5 py-0">
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
            <Badge dir="rtl" className={`text-[11px] px-1.5 py-0 ${paymentDaysLeft <= 0 ? 'bg-purple-100 text-purple-700' : paymentDaysLeft <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {paymentDaysLeft < 0 ? `${Math.abs(paymentDaysLeft)} ימים באיחור תשלום` : paymentDaysLeft === 0 ? 'תשלום היום' : `${paymentDaysLeft} ימים לתשלום`}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(() => {
          const url = getDashboardUrlForTask(task);
          if (!url) return null;
          const label = getDashboardLabelForTask(task);
          return (
            <Link
              to={url}
              onClick={(e) => e.stopPropagation()}
              className="p-1 h-auto rounded hover:bg-emerald-50 transition-colors inline-flex items-center"
              title={`פתח ב${label}`}
              aria-label={`פתח ב${label}`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-emerald-700" />
            </Link>
          );
        })()}
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
