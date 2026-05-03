
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
  // Aliased to MapIcon: importing a name `Map` shadows the built-in
  // global Map constructor, and the production minifier collapsed
  // `new Map()` calls onto the icon binding — crashing Home with
  // "TypeError: f$ is not a constructor". Keep the alias forever.
  Map as MapIcon, ArrowRight, X, FileBarChart, Calculator, GitBranch, Zap, TrendingUp,
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

import {
  TASK_STATUS_CONFIG as statusConfig,
  getTaskProcessSteps,
  toggleStep,
  markAllStepsDone,
  areAllStepsDone,
} from '@/config/processTemplates';
import { evaluateAuthorityStatus } from '@/engines/taskCascadeEngine';
import { getEffectiveStatus, isClientResponsiblePayment } from '@/utils/effectiveStatus';

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
      // ── Client-pays lookup map: when a client's authorities_payment_method
      //    is 'client_pays', any task of theirs sitting in 'reported_pending_payment'
      //    is effectively production_completed for us (payment is the client's
      //    responsibility, not ours). Threading the client into getEffectiveStatus
      //    surfaces this so the task drops off Home's active surfaces but is
      //    still searchable in the database. ──
      const clientByName = (() => {
        const m = new Map();
        (Array.isArray(clientsData) ? clientsData : []).forEach(c => { if (c?.name) m.set(c.name, c); });
        return m;
      })();
      const clientFor = (task) => clientByName.get(task.client_name) || null;

      // Active tasks for HOME visualizations (circles, today/upcoming/overdue
      // sections) exclude both fully-completed tasks AND tasks that finished
      // their primary workflow (דיווח+תשלום) and are only awaiting bookkeeping
      // recording — those are surfaced in their own dedicated section so they
      // don't visually compete with tasks that still need real work.
      // Uses getEffectiveStatus so legacy tasks whose persisted status is
      // stale (e.g. submission+payment ticked but task.status still
      // "not_started") are still classified correctly.
      const activeTasks = allTasks.filter(t => {
        const s = getEffectiveStatus(t, clientFor(t));
        return s !== 'production_completed' && s !== 'awaiting_recording';
      });
      const awaitingRecording = allTasks.filter(t => getEffectiveStatus(t, clientFor(t)) === 'awaiting_recording');

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
      // and exclude tasks where the CLIENT is responsible for payment (the
      // authority is paid directly by the client, not us). Those drop off
      // the active list but stay in the DB for search.
      const waitingPayment = allTasks.filter(t => {
        if (!t.due_date || !t.client_size) return false;
        if (isClientResponsiblePayment(t, clientFor(t))) return false;
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

      // Tasks the CLIENT is paying directly. We track count for an awareness
      // chip on the greeting card so the user can find them when needed,
      // but they don't pollute the action lists.
      const clientResponsiblePayment = allTasks.filter(t => isClientResponsiblePayment(t, clientFor(t)));

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
        clientResponsiblePayment,
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
        const newActiveTasks = newAllTasks.filter(t => {
          const s = getEffectiveStatus(t);
          return s !== 'production_completed' && s !== 'awaiting_recording';
        });
        const newAwaitingRecording = newAllTasks.filter(t => getEffectiveStatus(t) === 'awaiting_recording');
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

  // Inline step toggle from the AyoaMiniMap drawer. Matches the cascade
  // semantics used in PayrollReportsDashboard / TaxReportsDashboard so the
  // status flows through ready_to_broadcast → reported_pending_payment →
  // awaiting_recording → production_completed without the user having to
  // open the dashboard for routine ticks.
  const handleToggleStep = async (task, stepKey) => {
    try {
      const currentSteps = getTaskProcessSteps(task);
      const updatedSteps = toggleStep(currentSteps, stepKey);
      const updatedTask = { ...task, process_steps: updatedSteps };
      const allDone = areAllStepsDone(updatedTask);
      const updatePayload = { process_steps: updatedSteps };

      const authorityResult = evaluateAuthorityStatus(updatedTask, updatedSteps);
      if (authorityResult?.status && authorityResult.status !== task.status) {
        updatePayload.status = authorityResult.status;
      } else if (allDone && task.status !== 'production_completed') {
        updatePayload.status = 'production_completed';
      }
      if (updatePayload.status === 'production_completed') {
        updatePayload.process_steps = markAllStepsDone({ ...task, process_steps: updatePayload.process_steps });
      }

      await Task.update(task.id, updatePayload);

      setData(prev => {
        if (!prev) return prev;
        const newAllTasks = (prev.allTasks || []).map(t => t.id === task.id ? { ...t, ...updatePayload } : t);
        const newActive = newAllTasks.filter(t => {
          const s = getEffectiveStatus(t);
          return s !== 'production_completed' && s !== 'awaiting_recording';
        });
        const newAwaitingRec = newAllTasks.filter(t => getEffectiveStatus(t) === 'awaiting_recording');
        const updateInList = (list) => list
          .map(t => t.id === task.id ? { ...t, ...updatePayload } : t)
          .filter(t => !(t.id === task.id && (updatePayload.status === 'production_completed' || updatePayload.status === 'awaiting_recording')));
        return {
          ...prev,
          allTasks: newAllTasks,
          activeTasks: newActive,
          awaitingRecording: newAwaitingRec,
          overdue: updateInList(prev.overdue),
          today: updateInList(prev.today),
          upcoming: updateInList(prev.upcoming),
          payment: prev.payment.map(t => t.id === task.id ? { ...t, ...updatePayload } : t),
        };
      });
      if (updatePayload.status) {
        syncNotesWithTaskStatus(task.id, updatePayload.status);
      }
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', { detail: { collection: 'tasks', type: 'step-toggle', source: 'home' } }));
    } catch (err) {
      console.error('שגיאה בעדכון שלב:', err);
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
  // ADHD-accessibility: tightened paddings & spacings so the morning view
  // fits in one viewport (no scrolling for the primary fold).
  return (
    <div className="w-full h-full flex-1 flex flex-col" style={{ backgroundColor: '#F7F7F7' }}>
      <div className="space-y-2 p-2 md:p-3">

        {/* ═══ 1. Calming Greeting ═══ */}
        <div className="px-3 py-2.5 rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-base font-bold text-slate-700">
                {getGreeting()}{userName ? `, ${userName}` : ''}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{getDailyMessage()}</p>
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
                {data.clientResponsiblePayment?.length > 0 && (
                  <Link
                    to={createPageUrl("Tasks") + "?status=reported_pending_payment"}
                    className="flex items-center gap-1 hover:opacity-80"
                    title="באחריות לקוח — הלקוח משלם ישירות לרשות. מחוץ למשימות שלך, אבל זמין לחיפוש"
                  >
                    <CreditCard className="w-3 h-3" style={{ color: '#9CA3AF' }} />
                    <span className="text-xs font-bold" style={{ color: '#6B7280' }}>
                      {data.clientResponsiblePayment.length}
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
          <div className="flex items-center gap-2 mt-1.5">
            <Button
              size="sm"
              onClick={() => setShowQuickAdd(true)}
              className="bg-[#5A9EB5] hover:bg-[#4A8EA5] text-white gap-1 h-6 text-[11px] px-2.5"
            >
              <Plus className="w-3 h-3" />
              חדש
            </Button>
            <Link to={createPageUrl('MindMap')}>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-6 text-[11px] px-2.5 border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <MapIcon className="w-3 h-3" />
                מפת חשיבה
              </Button>
            </Link>
          </div>

          {/* Battery Banner — Stage 5.7.3 (replaces the old 1px progress bar).
              Big completed-today number on the right (RTL), thick coloured bar
              in the middle, total-tasks descriptor on the left. Bar colour
              shifts amber → blue → green as progress climbs. */}
          <div className="flex items-center gap-2.5 mt-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-sm font-black text-slate-700 tabular-nums min-w-[3ch]">
              {data.completedToday}
            </span>
            <div className="flex-1 relative bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: progress >= 80 ? '#10B981' : progress >= 40 ? '#5A9EB5' : '#F59E0B',
                }}
              />
            </div>
            <span className="text-[11px] text-slate-500 whitespace-nowrap">
              מתוך {todayTotal + data.completedToday} משימות
            </span>
          </div>

          {/* Energy level buttons — Stage 5.7.3: bad-day toggle now lives
              inline at the end of this row instead of as a standalone card.
              flex-wrap added so the row can break on narrow screens. */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
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
            own; these props just unlock the editable drawer.

            ADHD-accessibility: the focus-tab grid that used to live below
            the map (היום / 3 ימים / אירועים / ממתין לתשלום + sticky notes
            + SmartNudge + TaskInsights + AdvanceWarningPanel) was creating
            visual clutter that made it hard to focus on the map. The map
            is now the only thing on Home; future "what to surface" panels
            will land on the SIDE, not below. */}
        <AyoaMiniMap
          tasks={data.activeTasks}
          clients={clients}
          onStatusChange={handleStatusChange}
          onEditTask={setEditingTask}
          onPaymentDateChange={handlePaymentDateChange}
          onNote={setNoteTask}
          onToggleStep={handleToggleStep}
        />

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

// Given a task, return its YYYY-MM "reporting month" — preferring the
// explicit reporting_month field (used by accounting tasks) and falling
// back to the due_date's calendar month. Returns null when neither is set.
function getTaskMonth(task) {
  if (task?.reporting_month) {
    const m = String(task.reporting_month).match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
  }
  if (task?.due_date) {
    const d = String(task.due_date).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(d)) return d;
  }
  return null;
}

const HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
function formatMonthLabel(yyyymm) {
  if (!yyyymm) return 'ללא חודש';
  const [y, mm] = yyyymm.split('-');
  const idx = parseInt(mm, 10) - 1;
  if (idx < 0 || idx > 11) return yyyymm;
  return `${HEBREW_MONTHS[idx]} ${y}`;
}

const CURRENT_MONTH_KEY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// True for "reporting" tasks — recurring authority/payroll/bookkeeping
// work that's tied to a calendar month. These stay in the urgent foreground
// even when their reporting_month has slipped into the past, because a
// past-month report is overdue work, not "old news".
function isReportingTask(task) {
  return !!(task?.is_recurring || task?.source === 'recurring_tasks');
}

// Split tasks into reporting-month sections with a sub-class for past
// non-report work. Display order:
//   1. current month
//   2. past months (oldest first) — REPORT tasks (urgent foreground)
//   3. past months — NON-REPORT tasks (separate, muted section)
//   4. future months (earliest first)
//   5. undated (unknown)
// When everything lands in one section the caller can suppress headers.
function groupTasksByMonth(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];

  // Split past tasks into "urgent past" (reports) and "deferred past" (other)
  // up front, so each visual section has a clear semantic.
  const sections = new Map();  // sectionKey → { kind, month, tasks }
  const pastNonReport = [];
  list.forEach(task => {
    const month = getTaskMonth(task) || 'unknown';
    const isPast = month !== 'unknown' && month < CURRENT_MONTH_KEY;
    if (isPast && !isReportingTask(task)) {
      pastNonReport.push(task);
      return;
    }
    const sectionKey = month;
    if (!sections.has(sectionKey)) sections.set(sectionKey, []);
    sections.get(sectionKey).push(task);
  });

  const monthKeys = [...sections.keys()].sort((a, b) => {
    if (a === b) return 0;
    if (a === 'unknown') return 1;
    if (b === 'unknown') return -1;
    if (a === CURRENT_MONTH_KEY) return -1;
    if (b === CURRENT_MONTH_KEY) return 1;
    const aPast = a < CURRENT_MONTH_KEY;
    const bPast = b < CURRENT_MONTH_KEY;
    if (aPast && !bPast) return -1;  // overdue reports before future
    if (!aPast && bPast) return 1;
    if (aPast && bPast) return a.localeCompare(b);
    return a.localeCompare(b);
  });

  const out = monthKeys.map(month => ({
    key: `month_${month}`,
    month,
    label: month === 'unknown' ? 'ללא תאריך / חודש' : formatMonthLabel(month),
    tasks: sections.get(month),
    isCurrent: month === CURRENT_MONTH_KEY,
    isLeftover: month !== 'unknown' && month < CURRENT_MONTH_KEY,
    isFuture: month !== 'unknown' && month > CURRENT_MONTH_KEY,
    isDeferredPast: false,
  }));

  if (pastNonReport.length > 0) {
    out.push({
      key: 'deferred_past',
      month: 'deferred_past',
      label: 'מעבר — נדחה מחודש קודם (לא דחוף)',
      tasks: pastNonReport,
      isCurrent: false,
      isLeftover: false,
      isFuture: false,
      isDeferredPast: true,
    });
  }
  return out;
}

function TaskList({ tasks, onStatusChange, onPaymentDateChange, onEdit, onNote, showDeadlineContext, showDate, showPaymentDate }) {
  // ADHD-accessibility: when tasks span multiple reporting months
  // (e.g. April imports landing on top of leftover March work), split
  // them into month sections with a clear header so the user can tell
  // "new this month" from "still owed from last month" at a glance.
  const monthSections = useMemo(() => groupTasksByMonth(tasks), [tasks]);
  const multiMonth = monthSections.length > 1;

  if (multiMonth) {
    return (
      <div className="space-y-3">
        {monthSections.map(section => {
          // Section colour palette:
          //   current  → calm green   (foreground priority)
          //   leftover → amber        (overdue reports — still urgent)
          //   future   → soft blue    (preview)
          //   deferred → slate/muted  (past + non-report = not urgent)
          //   unknown  → neutral
          const palette = section.isDeferredPast
            ? { bg: '#F8FAFC', border: '#CBD5E1', text: '#64748B', tag: 'נדחה' }
            : section.isCurrent
              ? { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', tag: 'החודש' }
              : section.isLeftover
                ? { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', tag: 'נשאר מהחודש הקודם' }
                : section.isFuture
                  ? { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', tag: '' }
                  : { bg: '#F1F5F9', border: '#E2E8F0', text: '#475569', tag: '' };
          return (
            <div
              key={section.key || section.month}
              style={{ opacity: section.isDeferredPast ? 0.75 : 1 }}
            >
              <div
                className="flex items-center gap-2 px-2 py-1 rounded-md mb-1"
                style={{ backgroundColor: palette.bg, border: `1px solid ${palette.border}` }}
              >
                <span className="text-[11px] font-bold" style={{ color: palette.text }}>
                  {section.label}
                </span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: palette.text,
                    border: '1px solid currentColor',
                  }}
                >
                  {section.tasks.length}
                </span>
                {palette.tag && (
                  <span className="text-[10px] font-semibold" style={{ color: palette.text }}>
                    {palette.tag}
                  </span>
                )}
              </div>
              <SingleMonthTaskList
                tasks={section.tasks}
                onStatusChange={onStatusChange}
                onPaymentDateChange={onPaymentDateChange}
                onEdit={onEdit}
                onNote={onNote}
                showDeadlineContext={showDeadlineContext}
                showDate={showDate}
                showPaymentDate={showPaymentDate}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <SingleMonthTaskList
      tasks={tasks}
      onStatusChange={onStatusChange}
      onPaymentDateChange={onPaymentDateChange}
      onEdit={onEdit}
      onNote={onNote}
      showDeadlineContext={showDeadlineContext}
      showDate={showDate}
      showPaymentDate={showPaymentDate}
    />
  );
}

// The original TaskList rendering (small list inline, larger list grouped
// by client). Extracted so the month-aware wrapper can render either one
// or many sections without duplicating the per-month UI.
function SingleMonthTaskList({ tasks, onStatusChange, onPaymentDateChange, onEdit, onNote, showDeadlineContext, showDate, showPaymentDate }) {
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
