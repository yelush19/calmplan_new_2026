
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, Client } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import {
  Calculator, Loader, RefreshCw, ChevronLeft, ChevronRight,
  ArrowRight, Users, X, List, LayoutGrid, Search, GanttChart, Plus,
  Zap, Flame, ChevronDown, Network, Target, TrendingUp, Clock, GitBranchPlus,
  CheckSquare, Download, CalendarDays, AlertCircle, Hourglass, CheckCircle2,
  Send, Radio, Eye, FileWarning, CircleCheck, Inbox, PlayCircle
} from 'lucide-react';
import KanbanView from '@/components/tasks/KanbanView';
import CognitiveCapacityHeader from '@/components/dashboard/CognitiveCapacityHeader';
import { getServiceWeight } from '@/config/serviceWeights';
import { LOAD_COLORS } from '@/lib/theme-constants';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GroupedServiceTable from '@/components/dashboard/GroupedServiceTable';
import TaxWorkbookView from '@/components/dashboard/TaxWorkbookView';
import GanttView from '@/components/views/GanttView';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import DashboardViewToggle from '@/components/dashboard/DashboardViewToggle';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import TaskToNoteDialog from '@/components/tasks/TaskToNoteDialog';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  TAX_SERVICES,
  ADDITIONAL_SERVICES,
  STATUS_CONFIG,
  getServiceForTask,
  getTaskProcessSteps,
  toggleStep,
  markAllStepsDone,
  markAllStepsUndone,
  areAllStepsDone,
} from '@/config/processTemplates';
import { getTaskReportingMonth } from '@/config/automationRules';
import { getOpenPrerequisitesForCompletion } from '@/engines/taskCascadeEngine';
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';
import ClientRecurringTasks from '@/components/clients/ClientRecurringTasks';
import { AnimatePresence } from 'framer-motion';

// P2 Tax dashboard: tax services + income/expense collection (prerequisites)
const taxDashboardServices = {
  income_collection: ADDITIONAL_SERVICES.income_collection,
  expense_collection: ADDITIONAL_SERVICES.expense_collection,
  ...TAX_SERVICES,
};

const allTaxCategories = Object.values(taxDashboardServices).flatMap(s => s.taskCategories);

// Only actual reports (authority filings) — NOT data entry (קליטת הכנסות/הוצאות)
const REPORT_ONLY_CATEGORIES = Object.values(TAX_SERVICES).flatMap(s => s.taskCategories);

// Core services get their own table (they have meaningful steps)
const CORE_SERVICES = ['income_collection', 'expense_collection', 'vat', 'tax_advances'];

// Status pipeline for DNA-style KPI cards (ordered by workflow progression)
const STATUS_PIPELINE = [
  { key: 'waiting_for_materials', label: 'ממתין לחומרים',       color: '#F59E0B', bg1: '#fffbeb', bg2: '#fef3c7', Icon: Inbox },
  { key: 'not_started',          label: 'לבצע',                color: '#64748B', bg1: '#f8fafc', bg2: '#f1f5f9', Icon: PlayCircle },
  { key: 'ready_to_broadcast',   label: 'מוכן לשידור',         color: '#0D9488', bg1: '#f0fdfa', bg2: '#ccfbf1', Icon: Radio },
  { key: 'reported_pending_payment', label: 'ממתין לתשלום',     color: '#4F46E5', bg1: '#eef2ff', bg2: '#e0e7ff', Icon: Send },
  { key: 'sent_for_review',      label: 'הועבר לעיון',         color: '#7C3AED', bg1: '#faf5ff', bg2: '#f3e8ff', Icon: Eye },
  { key: 'needs_corrections',    label: 'לתיקון',              color: '#EA580C', bg1: '#fff7ed', bg2: '#ffedd5', Icon: FileWarning },
  { key: 'production_completed', label: 'הושלם',               color: '#16A34A', bg1: '#f0fdf4', bg2: '#dcfce7', Icon: CircleCheck },
];

// Phase detection — reusable for filtering + flow chart
function getTaskPhase(t) {
  const svc = getServiceForTask(t);
  if (!svc) return 'process';
  const steps = getTaskProcessSteps(t);
  if (svc.key === 'income_collection' || svc.key === 'expense_collection') {
    const allDone = svc.steps.every(s => steps[s.key]?.done);
    return allDone ? 'broadcast' : 'collect';
  }
  // Status-aware: formal status takes precedence
  if (t.status === 'production_completed' || t.status === 'reported_pending_payment' || steps.submission?.done) return 'broadcast';
  if (t.status === 'ready_to_broadcast' || steps.report_prep?.done) return 'review';
  return 'process';
}

export default function TaxReportsDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client') || '';

  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1)); // Default to previous month (reporting month)
  const [viewMode, setViewMode] = useState('timeline');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showInjectionPanel, setShowInjectionPanel] = useState(false);
  const [collapsedServices, setCollapsedServices] = useState(new Set());
  const [cognitiveFilter, setCognitiveFilter] = useState(null);
  const [phaseFilter, setPhaseFilter] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [filingSprintActive, setFilingSprintActive] = useState(false);
  const [filingSprintIdx, setFilingSprintIdx] = useState(0);
  const { confirm, ConfirmDialogComponent } = useConfirm();

  // Guard: skip external sync reloads briefly after local updates
  const localUpdateRef = React.useRef(false);

  useEffect(() => { loadData(); }, [selectedMonth]);

  // Live-refresh: listen for cascade events from other pages
  useEffect(() => {
    const handler = (e) => {
      // Skip reload if this page just made a local update (prevent overwriting optimistic state)
      if (localUpdateRef.current) return;
      // Only reload for events from OTHER pages
      const source = e.detail?.source;
      if (source === 'tax-reports') return;
      loadData();
    };
    window.addEventListener('calmplan:data-synced', handler);
    return () => window.removeEventListener('calmplan:data-synced', handler);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Due dates are in the DEADLINE month (month after reporting period)
      // e.g., viewing January reporting → load tasks with due_date in February
      const deadlineMonth = addMonths(selectedMonth, 1);
      const start = startOfMonth(deadlineMonth);
      const end = endOfMonth(deadlineMonth);
      // Also load reporting-month tasks for backward compatibility with old data
      const reportStart = startOfMonth(selectedMonth);
      const [tasksData, clientsData] = await Promise.all([
        Task.filter({
          due_date: { '>=': format(reportStart, 'yyyy-MM-dd'), '<=': format(end, 'yyyy-MM-dd') },
        }).catch(() => []),
        Client.list(null, 500).catch(() => []),
      ]);
      // Post-filter: only show tasks belonging to the selected reporting month
      const selectedMonthStr = format(selectedMonth, 'yyyy-MM');
      const filtered = (tasksData || []).filter(t => {
        if (!allTaxCategories.includes(t.category)) return false;
        return getTaskReportingMonth(t) === selectedMonthStr;
      });
      setTasks(filtered);
      setClients(clientsData || []);

      // Sync: fix completed tasks with unchecked steps
      syncCompletedTaskSteps(filtered);
    } catch (error) {
      console.error("Error loading tax tasks:", error);
    }
    setIsLoading(false);
  };

  // Auto-fix: completed tasks should have all steps marked done
  const syncCompletedTaskSteps = async (tasksList) => {
    for (const task of tasksList) {
      if (task.status === 'production_completed' && !areAllStepsDone(task)) {
        const updatedSteps = markAllStepsDone(task);
        if (Object.keys(updatedSteps).length > 0) {
          await Task.update(task.id, { process_steps: updatedSteps });
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, process_steps: updatedSteps } : t));
        }
      }
    }
  };

  // Lookup client by name for tax IDs
  const clientByName = useMemo(() => {
    const map = {};
    clients.forEach(c => { map[c.name] = c; });
    return map;
  }, [clients]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (clientFilter) {
      result = result.filter(t => t.client_name === clientFilter);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.client_name?.toLowerCase().includes(lower) ||
        t.title?.toLowerCase().includes(lower) ||
        t.category?.toLowerCase().includes(lower)
      );
    }
    if (cognitiveFilter !== null) {
      result = result.filter(t => {
        const w = getServiceWeight(t.category);
        return (w.cognitiveLoad ?? 0) === cognitiveFilter;
      });
    }
    if (phaseFilter) {
      // Support both phase keys (collect/process/review/broadcast) and status keys
      const STATUS_KEYS = STATUS_PIPELINE.map(s => s.key);
      if (STATUS_KEYS.includes(phaseFilter)) {
        result = result.filter(t => (t.status || 'not_started') === phaseFilter);
      } else {
        result = result.filter(t => getTaskPhase(t) === phaseFilter);
      }
    }
    return result;
  }, [tasks, clientFilter, searchTerm, cognitiveFilter, phaseFilter]);

  const clearClientFilter = () => {
    searchParams.delete('client');
    setSearchParams(searchParams);
  };

  // Build data per service: { serviceKey: { service, clientRows: [{clientName, task, client}] } }
  const serviceData = useMemo(() => {
    const result = {};
    Object.values(taxDashboardServices).forEach(service => {
      const serviceTasks = filteredTasks.filter(t => service.taskCategories.includes(t.category));
      if (serviceTasks.length > 0) {
        result[service.key] = {
          service,
          clientRows: serviceTasks
            .map(task => ({
              clientName: task.client_name || 'ללא לקוח',
              task,
              client: clientByName[task.client_name] || null,
            }))
            .sort((a, b) => a.clientName.localeCompare(b.clientName, 'he')),
        };
      }
    });
    return result;
  }, [filteredTasks, clientByName]);

  const serviceKeys = useMemo(() => Object.keys(serviceData), [serviceData]);

  // Default all services to EXPANDED on first load (user collapses manually)

  const toggleServiceCollapse = useCallback((key) => {
    setCollapsedServices(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const expandAllServices = useCallback(() => setCollapsedServices(new Set()), []);
  const collapseAllServices = useCallback(() => setCollapsedServices(new Set(serviceKeys)), [serviceKeys]);

  // Stats — "דיווחים" counts only actual reports (vat, tax_advances, vat_874), not data entry
  const stats = useMemo(() => {
    const reportTasks = filteredTasks.filter(t => REPORT_ONLY_CATEGORIES.includes(t.category));
    const reportTotal = reportTasks.length;
    const reportCompleted = reportTasks.filter(t => t.status === 'production_completed').length;
    let totalSteps = 0, doneSteps = 0;
    filteredTasks.forEach(task => {
      const service = getServiceForTask(task);
      if (service) {
        const steps = task.process_steps || {};
        totalSteps += service.steps.length;
        doneSteps += service.steps.filter(s => steps[s.key]?.done).length;
      }
    });
    // Status counts for DNA pipeline cards — count unique CLIENTS per status
    const byStatus = {};
    STATUS_PIPELINE.forEach(s => { byStatus[s.key] = 0; });
    const clientsByStatus = {};
    STATUS_PIPELINE.forEach(s => { clientsByStatus[s.key] = new Set(); });
    filteredTasks.forEach(t => {
      const key = t.status || 'not_started';
      if (clientsByStatus[key]) clientsByStatus[key].add(t.client_name);
    });
    Object.keys(byStatus).forEach(k => { byStatus[k] = clientsByStatus[k].size; });
    // Total unique clients
    const allClients = new Set(filteredTasks.map(t => t.client_name));
    return {
      total: reportTotal,
      completed: reportCompleted,
      pct: reportTotal > 0 ? Math.round((reportCompleted / reportTotal) * 100) : 0,
      allTasksCount: allClients.size,
      totalSteps,
      doneSteps,
      stepsPct: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0,
      byStatus,
    };
  }, [filteredTasks]);

  // Filing Sprint: tasks that are ready_to_broadcast (ready to file)
  const filingSprintTasks = useMemo(() => {
    return filteredTasks.filter(t => t.status === 'ready_to_broadcast');
  }, [filteredTasks]);

  const canStartFilingSprint = filingSprintTasks.length >= 2;

  const handleFilingSprint = useCallback(async () => {
    if (!filingSprintActive) {
      setFilingSprintActive(true);
      setFilingSprintIdx(0);
      return;
    }
    // Mark current task as completed and advance
    const currentTask = filingSprintTasks[filingSprintIdx];
    if (currentTask) {
      await handleStatusChange(currentTask, 'production_completed');
      if (filingSprintIdx < filingSprintTasks.length - 1) {
        setFilingSprintIdx(prev => prev + 1);
      } else {
        setFilingSprintActive(false);
        setFilingSprintIdx(0);
      }
    }
  }, [filingSprintActive, filingSprintTasks, filingSprintIdx]);

  // ── Dependency map: which services does each collection unlock? ──
  const COLLECTION_UNLOCKS = {
    income_collection: ['מע"מ', 'מע"מ 874', 'מקדמות מס', 'work_vat_reporting', 'work_vat_874', 'work_tax_advances'],
    expense_collection: ['מע"מ', 'מע"מ 874', 'work_vat_reporting', 'work_vat_874'],
  };

  // ── Check if a collection task is "sufficient for reporting" ──
  const isCollectionSufficient = useCallback((task) => {
    const steps = getTaskProcessSteps(task);
    // Either fully done OR "sufficient_for_reporting" step is checked
    return task.status === 'production_completed' ||
           steps?.sufficient_for_reporting?.done === true;
  }, []);

  // ── Sync: when a collection task becomes sufficient/complete, notify dependents ──
  const syncCollectionToDependents = useCallback(async (completedTask, isSufficient) => {
    const service = getServiceForTask(completedTask);
    if (!service) return;
    const unlocks = COLLECTION_UNLOCKS[service.key];
    if (!unlocks) return;

    // Find sibling tasks for same client that depend on this collection
    const dependents = tasks.filter(t =>
      t.id !== completedTask.id &&
      t.client_name === completedTask.client_name &&
      unlocks.includes(t.category)
    );

    for (const dep of dependents) {
      const depService = getServiceForTask(dep);
      if (!depService?.depends_on_nodes) continue;

      // Check if ALL dependencies for this task are satisfied
      // "sufficient" = either production_completed OR sufficient_for_reporting checked
      const allDepsSatisfied = (depService.depends_on_nodes || []).every(nodeId => {
        const nodeToServiceKey = { P2_income: 'income_collection', P2_expenses: 'expense_collection' };
        const depKey = nodeToServiceKey[nodeId];
        if (!depKey) return true;
        if (depKey === service.key) return isSufficient;
        // Check if the other dependency is also sufficient
        const otherTask = tasks.find(t =>
          t.id !== completedTask.id &&
          t.client_name === completedTask.client_name &&
          getServiceForTask(t)?.key === depKey
        );
        return otherTask ? isCollectionSufficient(otherTask) : false;
      });

      if (allDepsSatisfied && isSufficient) {
        // All prerequisites met — move dependent from waiting to ready
        if (dep.status === 'waiting_for_materials') {
          const depPayload = { status: 'not_started' };
          setTasks(prev => prev.map(t => t.id === dep.id ? { ...t, ...depPayload } : t));
          await Task.update(dep.id, depPayload);
        }
      }
    }
  }, [tasks, isCollectionSufficient]);

  const handleToggleStep = useCallback(async (task, stepKey) => {
    const currentSteps = getTaskProcessSteps(task);
    let updatedSteps = toggleStep(currentSteps, stepKey);

    // autoSufficient: toggling zero_income/zero_expenses ON also marks sufficient_for_reporting
    const svc = getServiceForTask(task);
    const stepDef = svc?.steps?.find(s => s.key === stepKey);
    if (stepDef?.autoSufficient && updatedSteps[stepKey]?.done) {
      updatedSteps = {
        ...updatedSteps,
        sufficient_for_reporting: { ...updatedSteps.sufficient_for_reporting, done: true, date: new Date().toISOString() },
      };
    }

    try {
      const updatedTask = { ...task, process_steps: updatedSteps };
      const allDone = areAllStepsDone(updatedTask);
      const updatePayload = { process_steps: updatedSteps };
      if (allDone && task.status !== 'production_completed') {
        updatePayload.status = 'production_completed';
        if (!task.execution_date) {
          updatePayload.execution_date = new Date().toISOString().split('T')[0];
        }
      }
      // Guard: prevent sync listener from overwriting optimistic update
      localUpdateRef.current = true;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
      await Task.update(task.id, updatePayload);
      if (updatePayload.status) syncNotesWithTaskStatus(task.id, updatePayload.status);

      // If a collection task just became sufficient or completed, sync to dependents
      const isAutoSufficient = stepDef?.autoSufficient && updatedSteps[stepKey]?.done;
      if (allDone || stepKey === 'sufficient_for_reporting' || isAutoSufficient) {
        const isSufficient = allDone || updatedSteps?.sufficient_for_reporting?.done;
        await syncCollectionToDependents({ ...task, process_steps: updatedSteps }, isSufficient);
      }

      // Notify other dashboards
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
        detail: { collection: 'tasks', type: 'step-toggle', source: 'tax-reports' }
      }));
      // Release guard after DB write completes
      setTimeout(() => { localUpdateRef.current = false; }, 1000);
    } catch (error) {
      console.error("Error updating step:", error);
      localUpdateRef.current = false;
    }
  }, [tasks, syncCollectionToDependents]);

  const handleDateChange = useCallback(async (task, stepKey, newDate) => {
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = { ...currentSteps, [stepKey]: { ...currentSteps[stepKey], date: newDate } };
    try {
      localUpdateRef.current = true;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, process_steps: updatedSteps } : t));
      await Task.update(task.id, { process_steps: updatedSteps });
      setTimeout(() => { localUpdateRef.current = false; }, 1000);
    } catch (error) {
      console.error("Error updating date:", error);
      localUpdateRef.current = false;
    }
  }, []);

  const handleStatusChange = useCallback(async (task, newStatus, extraData) => {
    try {
      const updatePayload = { status: newStatus };
      if (newStatus === 'production_completed' || newStatus === 'completed') {
        if (!task.execution_date) {
          updatePayload.execution_date = new Date().toISOString().split('T')[0];
        }
      }
      if (newStatus === 'production_completed') {
        updatePayload.process_steps = markAllStepsDone(task);
      } else if (task.status === 'production_completed' && newStatus === 'not_started') {
        updatePayload.process_steps = markAllStepsUndone(task);
        updatePayload.execution_date = '';
      }
      if (extraData) {
        Object.assign(updatePayload, extraData);
      }
      localUpdateRef.current = true;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
      await Task.update(task.id, updatePayload);
      syncNotesWithTaskStatus(task.id, newStatus);

      // If a collection task completed/uncompleted, sync to dependents
      await syncCollectionToDependents(task, newStatus === 'production_completed');

      // ── Reverse cascade: offer to complete open prerequisites ──
      if (newStatus === 'production_completed') {
        const { prereqs } = getOpenPrerequisitesForCompletion(task, tasks);
        if (prereqs.length > 0) {
          const names = prereqs.map(t => {
            const svc = getServiceForTask(t);
            return `${t.client_name} — ${svc?.label || t.category}`;
          }).join('\n');
          const shouldComplete = await confirm({
            title: 'עדכון משימות מחייבות',
            message: `המשימות הבאות עדיין פתוחות ותלויות במשימה שהושלמה:\n\n${names}\n\nלעדכן גם אותן כ"הושלם ייצור"?`,
            confirmText: 'כן, עדכן הכל',
            cancelText: 'לא, רק את הנוכחית',
          });
          if (shouldComplete) {
            for (const prereq of prereqs) {
              const prereqPayload = {
                status: 'production_completed',
                process_steps: markAllStepsDone(prereq),
                execution_date: new Date().toISOString().split('T')[0],
              };
              setTasks(prev => prev.map(t => t.id === prereq.id ? { ...t, ...prereqPayload } : t));
              await Task.update(prereq.id, prereqPayload);
            }
          }
        }
      }

      // Notify other dashboards of the change
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
        detail: { collection: 'tasks', type: 'status-change', source: 'tax-reports' }
      }));
      setTimeout(() => { localUpdateRef.current = false; }, 1000);
    } catch (error) {
      console.error("Error updating status:", error);
      localUpdateRef.current = false;
    }
  }, [syncCollectionToDependents, tasks, confirm]);

  const handlePaymentDateChange = useCallback(async (task, paymentDate) => {
    try {
      await Task.update(task.id, { payment_due_date: paymentDate });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, payment_due_date: paymentDate } : t));
    } catch (error) { console.error("Error updating payment date:", error); }
  }, []);

  const handleSubTaskChange = useCallback(async (task, subTasks) => {
    try {
      await Task.update(task.id, { sub_tasks: subTasks });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, sub_tasks: subTasks } : t));
    } catch (error) { console.error("Error updating sub-tasks:", error); }
  }, []);

  const handleAttachmentUpdate = useCallback((task, attachments) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, attachments } : t));
  }, []);

  const handleEditTask = async (taskId, updatedData) => {
    try {
      await Task.update(taskId, updatedData);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedData } : t));
    } catch (err) {
      console.error('שגיאה בעדכון משימה:', err);
    }
  };

  const handleReorder = useCallback(async (task, newSortOrder) => {
    try {
      localUpdateRef.current = true;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, sort_order: newSortOrder } : t));
      await Task.update(task.id, { sort_order: newSortOrder });
      setTimeout(() => { localUpdateRef.current = false; }, 500);
    } catch (err) {
      console.error('שגיאה בעדכון סדר:', err);
      localUpdateRef.current = false;
    }
  }, []);

  const handleToggleSelect = useCallback((taskIds, selected) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      (Array.isArray(taskIds) ? taskIds : [taskIds]).forEach(id => {
        if (selected) next.add(id); else next.delete(id);
      });
      return next;
    });
  }, []);

  const handleBulkStatusChange = useCallback(async (newStatus) => {
    const ids = [...selectedTaskIds];
    if (!ids.length) return;
    try {
      localUpdateRef.current = true;
      const updates = ids.map(id => Task.update(id, { status: newStatus }));
      await Promise.all(updates);
      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: newStatus } : t));
      setSelectedTaskIds(new Set());
      setBulkMode(false);
      setTimeout(() => { localUpdateRef.current = false; }, 1000);
    } catch (err) {
      console.error('שגיאה בעדכון מרובה:', err);
      localUpdateRef.current = false;
    }
  }, [selectedTaskIds]);

  // CSV Export
  const handleExport = useCallback(() => {
    const header = 'לקוח,קטגוריה,סטטוס,דדליין,חודש דיווח\n';
    const rows = filteredTasks.map(t =>
      `"${t.client_name || ''}","${t.category || ''}","${STATUS_CONFIG[t.status]?.label || t.status}","${t.due_date || ''}","${t.reporting_month || ''}"`
    ).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-reports-${format(selectedMonth, 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredTasks, selectedMonth]);

  const handleDeleteTask = async (task) => {
    setEditingTask(null);
    const ok = await confirm({
      title: 'מחיקת משימה',
      description: `האם למחוק את המשימה "${task.title}" עבור ${task.client_name || ''}?`,
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

  const handleMonthChange = (dir) => {
    setSelectedMonth(c => dir === 'prev' ? subMonths(c, 1) : addMonths(c, 1));
  };

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white border border-[#E0E0E0] shadow-sm rounded-2xl">
      {/* Nav */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl('ClientsDashboard')}>
          <Button variant="outline" size="sm" className="gap-2 text-slate-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />חזור ללוח לקוחות
          </Button>
        </Link>
        {clientFilter && (
          <Badge className="bg-[#4682B4] text-white text-sm px-3 py-1.5 gap-2">
            <Users className="w-3.5 h-3.5" />{clientFilter}
            <button onClick={clearClientFilter} className="hover:bg-[#F5F5F5] rounded-full p-0.5 ms-1"><X className="w-3 h-3" /></button>
          </Badge>
        )}
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E3A5F] to-[#2C3E50] flex items-center justify-center shadow-md">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">דיווחי מיסים</h1>
            <p className="text-slate-500">חודש דיווח: {format(selectedMonth, 'MMMM yyyy', { locale: he })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E0E0E0] p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center w-32">
              <div className="text-[12px] text-slate-400 leading-none">חודש דיווח</div>
              <div className="font-semibold text-sm text-slate-700">
                {format(selectedMonth, 'MMMM yyyy', { locale: he })}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('next')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
          {format(selectedMonth, 'yyyy-MM') !== format(subMonths(new Date(), 1), 'yyyy-MM') && (
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setSelectedMonth(subMonths(new Date(), 1))}>
              <CalendarDays className="w-3.5 h-3.5 me-1" />היום
            </Button>
          )}
          <Button onClick={() => setShowQuickAdd(true)} size="sm" className="gap-1 h-9">
            <Plus className="w-4 h-4" />
            משימה מהירה
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />CSV
          </Button>
          <Button
            variant={bulkMode ? 'default' : 'outline'}
            size="sm"
            className={`h-9 gap-1 ${bulkMode ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
            onClick={() => { setBulkMode(!bulkMode); setSelectedTaskIds(new Set()); }}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {bulkMode ? `נבחרו ${selectedTaskIds.size}` : 'בחירה'}
          </Button>
          <Button
            onClick={() => setShowInjectionPanel(prev => !prev)}
            size="sm"
            className={`h-9 gap-1.5 rounded-xl ${showInjectionPanel ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}
          >
            <GitBranchPlus className="w-3.5 h-3.5" />
            הזרקת משימות
          </Button>
          <Button onClick={loadData} variant="outline" size="icon" className="h-9 w-9" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      {/* KPI + P2 Flow — sticky combined bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm pb-2 -mx-4 px-4 pt-1 border-b border-slate-100 shadow-sm flex gap-3 items-stretch">

      {/* DNA Pipeline Status Cards — left side */}
      <div className="flex items-stretch gap-1.5 overflow-x-auto shrink-0 flex-1 min-w-0">
        {/* Total summary capsule */}
        <div className="rounded-2xl px-3 py-2.5 flex items-center gap-2 shrink-0 border border-slate-200"
          style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(70,130,180,0.1)' }}>
            <Target className="w-4.5 h-4.5" style={{ color: '#4682B4' }} />
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-slate-700">{stats.allTasksCount}</div>
            <div className="text-[10px] text-slate-400 font-medium">לקוחות</div>
          </div>
        </div>

        {/* DNA pipeline — 7 status capsules with connector dots */}
        {STATUS_PIPELINE.map((phase, idx) => {
          const count = stats.byStatus[phase.key] || 0;
          const pct = stats.allTasksCount > 0 ? Math.round((count / stats.allTasksCount) * 100) : 0;
          const Icon = phase.Icon;
          return (
            <React.Fragment key={phase.key}>
              {idx > 0 && (
                <div className="flex items-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                </div>
              )}
              <button
                onClick={() => setPhaseFilter(prev => prev === phase.key ? null : phase.key)}
                className={`rounded-2xl px-3 py-2.5 flex items-center gap-2 shrink-0 border transition-all cursor-pointer hover:scale-[1.03] ${
                  phaseFilter === phase.key ? 'ring-2 ring-offset-1 shadow-md' : 'shadow-sm'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${phase.bg1} 0%, ${phase.bg2} 100%)`,
                  borderColor: count > 0 ? phase.color + '30' : '#e2e8f0',
                  ringColor: phase.color,
                  opacity: count === 0 ? 0.5 : 1,
                }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: phase.color + '15', boxShadow: count > 0 ? `0 0 10px ${phase.color}20` : 'none' }}>
                  <Icon className="w-4 h-4" style={{ color: phase.color }} />
                </div>
                <div className="text-center min-w-[36px]">
                  <div className="text-xl font-black leading-tight" style={{ color: count > 0 ? phase.color : '#94a3b8' }}>{count}</div>
                  <div className="text-[11px] text-slate-600 font-bold leading-tight whitespace-nowrap">{phase.label}</div>
                </div>
                {count > 0 && (
                  <div className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ color: phase.color, background: phase.color + '15' }}>
                    {pct}%
                  </div>
                )}
              </button>
            </React.Fragment>
          );
        })}

        {/* Steps progress mini-card */}
        <div className="flex items-center shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /></div>
        <div className="rounded-2xl px-3 py-2.5 flex items-center gap-2 shrink-0 border border-blue-100"
          style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)' }}>
          <Clock className="w-4 h-4" style={{ color: '#1565C0' }} />
          <div className="text-center">
            <div className="text-lg font-black" style={{ color: '#1565C0' }}>{stats.stepsPct}%</div>
            <div className="text-[10px] text-slate-400 font-medium">שלבים</div>
          </div>
        </div>

        {/* DNA Mix cognitive load */}
        <div className="rounded-2xl px-3 py-2.5 flex items-center gap-2 shrink-0 border border-purple-100"
          style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)' }}>
          <div className="flex items-center gap-0.5">
            {[3, 2, 1, 0].map(tier => {
              const taskCount = filteredTasks.filter(t => {
                const w = getServiceWeight(t.category);
                const tl = t.cognitive_load != null ? t.cognitive_load : (w.cognitiveLoad ?? 0);
                return tl === tier;
              }).length;
              if (!taskCount) return null;
              const lc = LOAD_COLORS[tier];
              return (
                <div key={tier} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: lc.color }}>
                  {taskCount}
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-500 font-bold leading-tight">DNA<br/>Mix</div>
        </div>
      </div>

      {/* P2 Production Flow — compact right side */}
      {!isLoading && filteredTasks.length > 0 && (() => {
        const phases = [
          { key: 'collect', label: 'קליטה', color: '#FF8F00', icon: '📥' },
          { key: 'process', label: 'עיבוד', color: '#4682B4', icon: '⚙️' },
          { key: 'review', label: 'מוכן לשידור', color: '#7B1FA2', icon: '👁️' },
          { key: 'broadcast', label: 'שודר', color: '#2E7D32', icon: '📡' },
        ];
        const phaseCounts = phases.map(p => filteredTasks.filter(t => getTaskPhase(t) === p.key).length);
        return (
          <div className="rounded-xl border border-slate-100 overflow-hidden px-2 py-2 shrink-0"
            style={{ background: 'linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%)', width: '280px' }}>
            <div className="flex items-center gap-1 mb-1">
              <Network className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500">זרימת ייצור P2</span>
            </div>
            <div className="flex items-center gap-0.5">
              {phases.map((phase, idx) => {
                const count = phaseCounts[idx];
                const pct = filteredTasks.length > 0 ? Math.round((count / filteredTasks.length) * 100) : 0;
                return (
                  <button key={phase.key} className="flex-1 text-center cursor-pointer rounded-lg px-1 py-1 transition-all hover:scale-105"
                    onClick={() => setPhaseFilter(prev => prev === phase.key ? null : phase.key)}
                    style={{
                      background: count > 0 ? `${phase.color}10` : 'transparent',
                      outline: phaseFilter === phase.key ? `2px solid ${phase.color}` : 'none',
                      outlineOffset: '-1px',
                    }}>
                    <div className="text-xs">{phase.icon}</div>
                    <div className="text-sm font-black" style={{ color: count > 0 ? phase.color : '#B0BEC5' }}>{count}</div>
                    <div className="text-[9px]" style={{ color: count > 0 ? phase.color + 'AA' : '#ccc' }}>{pct}%</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      </div>{/* end sticky bar */}

      {/* Filing Sprint Banner */}
      {canStartFilingSprint && !filingSprintActive && (
        <Card className="bg-gradient-to-l from-amber-50 to-orange-50 border-amber-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Flame className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-amber-800 text-sm">Filing Sprint זמין!</h3>
                <p className="text-xs text-amber-600">
                  {filingSprintTasks.length} לקוחות מוכנים להגשה - {filingSprintTasks.map(t => t.client_name).join(', ')}
                </p>
              </div>
            </div>
            <Button
              onClick={() => { setFilingSprintActive(true); setFilingSprintIdx(0); }}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 font-bold"
              size="sm"
            >
              <Zap className="w-4 h-4" />
              התחל Filing Sprint
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Filing Sprint */}
      {filingSprintActive && filingSprintTasks.length > 0 && (
        <Card className="bg-gradient-to-l from-amber-100 to-orange-100 border-amber-300 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-amber-800">Filing Sprint</h3>
                <Badge className="bg-amber-200 text-amber-800 text-[12px]">
                  {filingSprintIdx + 1} / {filingSprintTasks.length}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilingSprintActive(false)}
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                <X className="w-3.5 h-3.5 ms-1" />
                סיום Sprint
              </Button>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${((filingSprintIdx) / filingSprintTasks.length) * 100}%` }}
              />
            </div>
            {/* Current task */}
            {filingSprintTasks[filingSprintIdx] && (
              <div className="bg-white rounded-lg p-4 border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{filingSprintTasks[filingSprintIdx].client_name}</div>
                  <div className="text-xs text-slate-500">{filingSprintTasks[filingSprintIdx].title}</div>
                </div>
                <Button
                  onClick={handleFilingSprint}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 font-bold"
                >
                  <Zap className="w-4 h-4" />
                  {filingSprintIdx < filingSprintTasks.length - 1 ? 'הושלם → הבא' : 'הושלם - סיום!'}
                </Button>
              </div>
            )}
            {/* Upcoming queue */}
            {filingSprintTasks.length > filingSprintIdx + 1 && (
              <div className="mt-2 flex items-center gap-1 text-[12px] text-amber-600">
                <span>בתור:</span>
                {filingSprintTasks.slice(filingSprintIdx + 1, filingSprintIdx + 4).map(t => (
                  <Badge key={t.id} className="bg-amber-100 text-amber-700 text-[12px] px-1.5 py-0">{t.client_name}</Badge>
                ))}
                {filingSprintTasks.length > filingSprintIdx + 4 && (
                  <span>+{filingSprintTasks.length - filingSprintIdx - 4} נוספים</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cognitive Capacity Header — "מד דופק" above all views */}
      {!isLoading && tasks.length > 0 && (
        <CognitiveCapacityHeader tasks={tasks} onFilterTier={setCognitiveFilter} />
      )}

      {/* Old P2 flow removed — now inside sticky bar above */}

      {/* Injection Panel */}
      <AnimatePresence>
        {showInjectionPanel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="border-2 border-orange-200 bg-orange-50/30 rounded-2xl overflow-hidden">
            <ClientRecurringTasks onGenerateComplete={loadData} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + controls */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
          <Input
            placeholder="חיפוש לפי שם לקוח, משימה..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pe-10 h-10 rounded-xl border-2 border-blue-200 focus:border-blue-400 bg-white shadow-sm text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <DashboardViewToggle value={viewMode} onChange={setViewMode} options={['table', 'workbook', 'kanban', 'timeline', 'radial']} />
        {phaseFilter && (
          <Badge className="bg-slate-100 text-slate-700 gap-1 px-2.5 py-1 text-xs font-bold cursor-pointer hover:bg-slate-200" onClick={() => setPhaseFilter(null)}>
            סינון: {STATUS_PIPELINE.find(s => s.key === phaseFilter)?.label || (phaseFilter === 'collect' ? 'קליטה' : phaseFilter === 'process' ? 'עיבוד' : phaseFilter === 'review' ? 'מוכן לשידור' : 'שודר')}
            <X className="w-3 h-3" />
          </Badge>
        )}
        {bulkMode && selectedTaskIds.size > 0 && (
          <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5">
            <span className="text-xs font-bold text-violet-700">{selectedTaskIds.size} נבחרו:</span>
            {['not_started', 'ready_to_broadcast', 'reported_pending_payment', 'production_completed'].map(s => (
              <Button key={s} size="sm" variant="outline" className="h-7 text-xs px-2"
                onClick={() => handleBulkStatusChange(s)}>
                {STATUS_CONFIG[s]?.label || s}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : Object.keys(serviceData).length > 0 ? (
        viewMode === 'kanban' ? (
          <KanbanView tasks={filteredTasks} onTaskStatusChange={handleStatusChange} onEditTask={setEditingTask} clients={clients} />
        ) : viewMode === 'timeline' ? (
          <GanttView tasks={filteredTasks} clients={clients} currentMonth={addMonths(selectedMonth, 1)} onEditTask={setEditingTask} />
        ) : viewMode === 'table' ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {Object.entries(serviceData).map(([serviceKey, { service, clientRows }]) => {
              const isCollapsed = collapsedServices.has(serviceKey);
              return (
                <div key={serviceKey} className="border border-[#E0E0E0] rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: isCollapsed ? 'auto' : '520px' }}>
                  <button
                    onClick={() => toggleServiceCollapse(serviceKey)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-[#FAFBFC] hover:bg-[#F5F5F5] transition-colors shrink-0"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                      <span className="font-bold text-[#263238] text-sm">{service.label}</span>
                      <span className="text-xs text-[#455A64]">{clientRows.length} לקוחות</span>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
                      <GroupedServiceTable
                        service={service}
                        clientRows={clientRows}
                        onToggleStep={handleToggleStep}
                        onDateChange={handleDateChange}
                        onStatusChange={handleStatusChange}
                        onPaymentDateChange={handlePaymentDateChange}
                        onSubTaskChange={handleSubTaskChange}
                        onAttachmentUpdate={handleAttachmentUpdate}
                        getClientIds={getTaxIds}
                        onEdit={setEditingTask}
                        onDelete={handleDeleteTask}
                        onNote={setNoteTask}
                        onReorder={handleReorder}
                        bulkMode={bulkMode}
                        selectedTaskIds={selectedTaskIds}
                        onToggleSelect={handleToggleSelect}
                        allTasks={filteredTasks}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : viewMode === 'workbook' ? (
          <TaxWorkbookView
            tasks={filteredTasks}
            clients={clients}
            services={taxDashboardServices}
            onToggleStep={handleToggleStep}
            onStatusChange={handleStatusChange}
            onDateChange={handleDateChange}
            onEdit={setEditingTask}
          />
        ) : viewMode === 'radial' ? (
          <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '500px' }}>
            <AyoaRadialView tasks={filteredTasks} centerLabel="דיווחי מס" centerSub="P2" onEditTask={setEditingTask} />
          </div>
        ) : null
      ) : (
        <Card className="p-12 text-center border-[#E0E0E0]">
          <Calculator className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">אין דיווחי מיסים לחודש הנבחר</h3>
          <p className="text-slate-500">נסה לבחור חודש אחר או ליצור משימות חוזרות</p>
        </Card>
      )}

      <QuickAddTaskDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onCreated={loadData}
        defaultContext="work"
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


// Get relevant tax IDs for a service type
function getTaxIds(client, serviceKey) {
  if (!client) return [];
  const ids = [];
  const ti = client.tax_info || {};
  const annual = ti.annual_tax_ids || {};

  // Always show entity number
  if (client.entity_number) ids.push({ label: 'ח"פ', value: client.entity_number });

  // Always show tax advances ID if client has one (useful across all tax services)
  if (annual.tax_advances_id) ids.push({ label: 'מזהה מקדמות', value: annual.tax_advances_id });

  switch (serviceKey) {
    case 'vat':
    case 'vat_874':
      if (ti.vat_file_number) ids.push({ label: 'תיק מע"מ', value: ti.vat_file_number });
      break;
    case 'tax_advances':
      if (annual.tax_advances_percentage) ids.push({ label: '%', value: annual.tax_advances_percentage });
      break;
    case 'deductions':
      if (ti.tax_deduction_file_number) ids.push({ label: 'תיק ניכויים', value: ti.tax_deduction_file_number });
      if (annual.deductions_id) ids.push({ label: 'פנקס ניכויים', value: annual.deductions_id });
      break;
    default:
      break;
  }
  return ids;
}

