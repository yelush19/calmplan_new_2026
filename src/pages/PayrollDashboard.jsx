
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, Client } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader, RefreshCw, Briefcase, ChevronLeft, ChevronRight,
  ArrowRight, Users, X, List, LayoutGrid, Search, GanttChart, Plus, ChevronDown, Trash2,
  Inbox, PlayCircle, Radio, Send, Eye, FileWarning, CircleCheck, Target
} from 'lucide-react';
import KanbanView from '@/components/tasks/KanbanView';
import CognitiveCapacityHeader from '@/components/dashboard/CognitiveCapacityHeader';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GroupedServiceTable from '@/components/dashboard/GroupedServiceTable';
import ProjectTimelineView from '@/components/dashboard/ProjectTimelineView';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import TaskToNoteDialog from '@/components/tasks/TaskToNoteDialog';
import { getServiceWeight } from '@/config/serviceWeights';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  PAYROLL_SERVICES,
  ADDITIONAL_SERVICES,
  STATUS_CONFIG,
  getServiceForTask,
  getTaskProcessSteps,
  toggleStep,
  markAllStepsDone,
  markAllStepsUndone,
  areAllStepsDone,
} from '@/config/processTemplates';
import { processTaskCascade, getOpenPrerequisitesForCompletion } from '@/engines/taskCascadeEngine';
import { getTaskReportingMonth } from '@/config/automationRules';
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';
import GanttView from '@/components/views/GanttView';
import DashboardViewToggle from '@/components/dashboard/DashboardViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import TaxWorkbookView from '@/components/dashboard/TaxWorkbookView';

const payrollDashboardServices = {
  ...PAYROLL_SERVICES,
  ...Object.fromEntries(
    Object.entries(ADDITIONAL_SERVICES).filter(([, s]) => s.dashboard === 'payroll')
  ),
};

const allPayrollCategories = Object.values(payrollDashboardServices).flatMap(s => s.taskCategories);

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

export default function PayrollDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client') || '';

  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1)); // Default to previous month (reporting month)
  const [viewMode, setViewMode] = useState('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [collapsedServices, setCollapsedServices] = useState(new Set());
  const [cognitiveFilter, setCognitiveFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const { confirm, ConfirmDialogComponent } = useConfirm();

  const localUpdateRef = React.useRef(false);

  useEffect(() => { loadData(); }, [selectedMonth]);

  // Live-refresh: listen for cascade events from other pages
  useEffect(() => {
    const handler = (e) => {
      if (localUpdateRef.current) return;
      if (e.detail?.source === 'payroll') return;
      loadData();
    };
    window.addEventListener('calmplan:data-synced', handler);
    return () => window.removeEventListener('calmplan:data-synced', handler);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Due dates are in the DEADLINE month (month after reporting period)
      const deadlineMonth = addMonths(selectedMonth, 1);
      const start = startOfMonth(deadlineMonth);
      const end = endOfMonth(deadlineMonth);
      const reportStart = startOfMonth(selectedMonth);
      const [tasksData, clientsData] = await Promise.all([
        Task.list(null, 5000).catch((err) => { console.error('PayrollDashboard Task.list FAILED:', err); return []; }),
        Client.list(null, 500).catch(() => []),
      ]);
      const allRaw = Array.isArray(tasksData) ? tasksData : [];
      setTasks(allRaw);
      setClients(clientsData || []);
      syncCompletedTaskSteps(allRaw);
    } catch (error) {
      console.error("Error loading payroll tasks:", error);
    }
    setIsLoading(false);
  };

  const syncCompletedTaskSteps = async (tasksList) => {
    for (const task of tasksList) {
      if (task.status === 'production_completed' && !areAllStepsDone(task)) {
        // Status is completed but steps aren't — mark all steps done
        const updatedSteps = markAllStepsDone(task);
        if (Object.keys(updatedSteps).length > 0) {
          await Task.update(task.id, { process_steps: updatedSteps });
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, process_steps: updatedSteps } : t));
        }
      } else if (task.status !== 'production_completed' && areAllStepsDone(task)) {
        // All steps done but status isn't completed — auto-complete
        await Task.update(task.id, { status: 'production_completed' });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'production_completed' } : t));
        syncNotesWithTaskStatus(task.id, 'production_completed');
      }
    }
  };

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
    if (statusFilter) {
      result = result.filter(t => (t.status || 'not_started') === statusFilter);
    }
    return result;
  }, [tasks, clientFilter, searchTerm, cognitiveFilter, statusFilter]);

  const clearClientFilter = () => {
    searchParams.delete('client');
    setSearchParams(searchParams);
  };

  const serviceData = useMemo(() => {
    const result = {};
    Object.values(payrollDashboardServices).forEach(service => {
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

  // Sort service keys: active work first, fully completed last
  const sortedServiceKeys = useMemo(() => {
    return Object.keys(serviceData).sort((a, b) => {
      const aRows = serviceData[a].clientRows;
      const bRows = serviceData[b].clientRows;
      const aActive = aRows.filter(r => r.task.status !== 'production_completed').length;
      const bActive = bRows.filter(r => r.task.status !== 'production_completed').length;
      const aAllDone = aActive === 0;
      const bAllDone = bActive === 0;
      // Fully completed services go to bottom
      if (aAllDone !== bAllDone) return aAllDone ? 1 : -1;
      // Among active services, sort by more active tasks first
      return bActive - aActive;
    });
  }, [serviceData]);

  // Default all services to EXPANDED on first load (user collapses manually)

  const toggleServiceCollapse = useCallback((key) => {
    setCollapsedServices(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const expandAllServices = useCallback(() => setCollapsedServices(new Set()), []);
  const collapseAllServices = useCallback(() => setCollapsedServices(new Set(sortedServiceKeys)), [sortedServiceKeys]);

  const stats = useMemo(() => {
    const relevant = filteredTasks;
    const total = relevant.length;
    const completed = relevant.filter(t => t.status === 'production_completed').length;
    let totalSteps = 0, doneSteps = 0;
    relevant.forEach(task => {
      const service = getServiceForTask(task);
      if (service) {
        const steps = task.process_steps || {};
        totalSteps += service.steps.length;
        doneSteps += service.steps.filter(s => steps[s.key]?.done).length;
      }
    });
    // Status counts for DNA pipeline cards — count TASKS (reports), not just unique clients
    const byStatus = {};
    STATUS_PIPELINE.forEach(s => { byStatus[s.key] = 0; });
    relevant.forEach(t => {
      const key = t.status || 'not_started';
      if (byStatus[key] !== undefined) byStatus[key]++;
    });
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0, totalSteps, doneSteps, stepsPct: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0, byStatus };
  }, [filteredTasks]);

  const handleToggleStep = useCallback(async (task, stepKey) => {
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = toggleStep(currentSteps, stepKey);
    try {
      const updatedTask = { ...task, process_steps: updatedSteps };
      const updatePayload = { process_steps: updatedSteps };

      // Run cascade engine for status transitions
      const cascade = processTaskCascade(updatedTask, updatedSteps, filteredTasks);

      if (cascade.statusUpdate) {
        updatePayload.status = cascade.statusUpdate.status;
      } else {
        // Fallback: all done = production_completed
        const allDone = areAllStepsDone(updatedTask);
        if (allDone && task.status !== 'production_completed') {
          updatePayload.status = 'production_completed';
        }
      }

      // Guard: prevent sync listener from overwriting optimistic state
      localUpdateRef.current = true;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
      await Task.update(task.id, updatePayload);

      // Auto-create Phase B+C child tasks when payroll production completes
      if (cascade.tasksToCreate?.length > 0) {
        const createdTasks = [];
        for (const childDef of cascade.tasksToCreate) {
          const created = await Task.create(childDef);
          createdTasks.push(created);
        }
        setTasks(prev => [...prev, ...createdTasks]);
      }

      if (updatePayload.status) {
        syncNotesWithTaskStatus(task.id, updatePayload.status);
        window.dispatchEvent(new CustomEvent('calmplan:data-synced', { detail: { collection: 'tasks', type: 'step-toggle', source: 'payroll' } }));
      }
      setTimeout(() => { localUpdateRef.current = false; }, 1000);
    } catch (error) {
      console.error("Error updating step:", error);
      localUpdateRef.current = false;
    }
  }, [filteredTasks]);

  const handleDateChange = useCallback(async (task, stepKey, newDate) => {
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = { ...currentSteps, [stepKey]: { ...currentSteps[stepKey], date: newDate } };
    try {
      await Task.update(task.id, { process_steps: updatedSteps });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, process_steps: updatedSteps } : t));
    } catch (error) { console.error("Error updating date:", error); }
  }, []);

  const handleStatusChange = useCallback(async (task, newStatus) => {
    try {
      const updatePayload = { status: newStatus };
      if (newStatus === 'production_completed') {
        updatePayload.process_steps = markAllStepsDone(task);
        if (!task.execution_date) updatePayload.execution_date = new Date().toISOString().split('T')[0];
      } else if (task.status === 'production_completed' && newStatus === 'not_started') {
        updatePayload.process_steps = markAllStepsUndone(task);
      }
      await Task.update(task.id, updatePayload);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
      syncNotesWithTaskStatus(task.id, newStatus);

      // Reverse cascade: offer to complete open prerequisites/children
      if (newStatus === 'production_completed') {
        const { prereqs, children } = getOpenPrerequisitesForCompletion(task, tasks);
        const openTasks = [...prereqs, ...children];
        if (openTasks.length > 0) {
          const names = openTasks.map(t => {
            const svc = getServiceForTask(t);
            return `${t.client_name} — ${svc?.label || t.category}`;
          }).join('\n');
          const shouldComplete = await confirm({
            title: 'עדכון משימות מחייבות',
            message: `המשימות הבאות עדיין פתוחות:\n\n${names}\n\nלעדכן גם אותן כ"הושלם ייצור"?`,
            confirmText: 'כן, עדכן הכל',
            cancelText: 'לא, רק את הנוכחית',
          });
          if (shouldComplete) {
            for (const t of openTasks) {
              const p = { status: 'production_completed', process_steps: markAllStepsDone(t), execution_date: new Date().toISOString().split('T')[0] };
              setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...p } : x));
              await Task.update(t.id, p);
            }
          }
        }
      }

      window.dispatchEvent(new CustomEvent('calmplan:data-synced', { detail: { collection: 'tasks', type: 'status-change' } }));
    } catch (error) { console.error("Error updating status:", error); }
  }, [tasks, confirm]);

  const handleBulkStatusChange = useCallback(async (newStatus) => {
    if (selectedTaskIds.size === 0) return;
    try {
      const updates = [...selectedTaskIds].map(async id => {
        const task = tasks.find(t => t.id === id);
        const updatePayload = { status: newStatus };
        if (newStatus === 'production_completed' && task) updatePayload.process_steps = markAllStepsDone(task);
        else if (newStatus === 'not_started' && task) updatePayload.process_steps = markAllStepsUndone(task);
        await Task.update(id, updatePayload);
        return { id, ...updatePayload };
      });
      const results = await Promise.all(updates);
      setTasks(prev => prev.map(t => {
        const upd = results.find(r => r.id === t.id);
        return upd ? { ...t, ...upd } : t;
      }));
      selectedTaskIds.forEach(id => syncNotesWithTaskStatus(id, newStatus));
      setSelectedTaskIds(new Set());
      setBulkMode(false);
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', { detail: { collection: 'tasks', type: 'bulk-update' } }));
    } catch (error) { console.error("Bulk status update error:", error); }
  }, [selectedTaskIds, tasks]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;
    const ok = await confirm({ title: 'מחיקה מרובה', description: `למחוק ${selectedTaskIds.size} משימות? פעולה בלתי הפיכה!`, confirmText: 'מחק', cancelText: 'ביטול' });
    if (!ok) return;
    try {
      await Promise.all([...selectedTaskIds].map(id => Task.delete(id)));
      setTasks(prev => prev.filter(t => !selectedTaskIds.has(t.id)));
      setSelectedTaskIds(new Set());
      setBulkMode(false);
      window.dispatchEvent(new CustomEvent('calmplan:data-synced', { detail: { collection: 'tasks', type: 'bulk-delete' } }));
    } catch (error) { console.error("Bulk delete error:", error); loadData(); }
  }, [selectedTaskIds, confirm]);

  const exitBulkMode = useCallback(() => { setBulkMode(false); setSelectedTaskIds(new Set()); }, []);

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
    <div className="p-4 md:p-6 space-y-5 bg-white dark:bg-gray-900 border border-[#E0E0E0] dark:border-gray-700 shadow-xl rounded-[32px]">
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl('ClientsDashboard')}>
          <Button variant="outline" size="sm" className="gap-2 text-slate-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />חזור ללוח לקוחות
          </Button>
        </Link>
        {clientFilter && (
          <Badge className="bg-[#1E3A5F] text-white text-sm px-3 py-1.5 gap-2">
            <Users className="w-3.5 h-3.5" />{clientFilter}
            <button onClick={clearClientFilter} className="hover:bg-[#F5F5F5] rounded-full p-0.5 ms-1"><X className="w-3 h-3" /></button>
          </Badge>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E3A5F] to-[#2C3E50] flex items-center justify-center shadow-md">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1E3A5F] dark:text-white">P1 | שכר ודיווחי רשויות</h1>
            <p className="text-slate-500">חודש דיווח: {format(selectedMonth, 'MMMM yyyy', { locale: he })} | שכר, ניכויים, ביטוח לאומי, מס"ב ועוד</p>
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
          <Button onClick={() => setShowQuickAdd(true)} size="sm" className="gap-1 h-9">
            <Plus className="w-4 h-4" />
            משימה מהירה
          </Button>
          <Button onClick={loadData} variant="outline" size="icon" className="h-9 w-9" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </motion.div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="חיפוש לפי שם לקוח, משימה..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pe-10 h-9"
        />
        </div>
        <div className="flex bg-white rounded-lg p-0.5 shadow-sm border border-[#E0E0E0] text-xs">
          <button onClick={expandAllServices} className="px-2.5 py-1.5 rounded-md text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 font-medium transition-colors whitespace-nowrap">פתח הכל</button>
          <button onClick={collapseAllServices} className="px-2.5 py-1.5 rounded-md text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 font-medium transition-colors whitespace-nowrap">סגור הכל</button>
        </div>
        <Button variant="outline" size="sm"
          onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 h-auto ${bulkMode ? 'bg-violet-100 text-violet-700 border-violet-400' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600'}`}>
          {bulkMode ? `ביטול (${selectedTaskIds.size} נבחרו)` : 'עדכון מרובה'}
        </Button>
        {bulkMode && (
          <>
            <Button variant="outline" size="sm"
              onClick={() => setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)))}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 h-auto">
              בחר הכל ({filteredTasks.length})
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => setSelectedTaskIds(new Set())}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 h-auto">
              נקה בחירה
            </Button>
          </>
        )}
      </div>

      {/* Bulk action floating bar */}
      <AnimatePresence>
        {bulkMode && selectedTaskIds.size > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border-2 border-violet-300"
            style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
            <span className="text-sm font-black text-violet-700">{selectedTaskIds.size} נבחרו</span>
            <span className="text-gray-300">|</span>
            <span className="text-xs font-bold text-gray-500">שנה סטטוס:</span>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <Button variant="ghost" size="sm" key={key} onClick={() => handleBulkStatusChange(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 border-transparent hover:border-violet-300 h-auto">
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.bg}`} />
                {cfg.label}
              </Button>
            ))}
            <span className="text-gray-300">|</span>
            <Button variant="ghost" size="sm" onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border-2 border-transparent hover:border-red-300 h-auto">
              <Trash2 className="w-3.5 h-3.5" />
              מחק
            </Button>
            <span className="text-gray-300">|</span>
            <Button variant="ghost" size="sm" onClick={exitBulkMode} className="p-1.5 rounded-lg hover:bg-gray-100 h-auto">
              <X className="w-4 h-4 text-gray-400" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DNA Pipeline Status Cards */}
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {/* Total summary capsule */}
        <div className="rounded-xl px-2 py-1.5 flex items-center gap-1.5 shrink-0 border border-slate-200"
          style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(70,130,180,0.1)' }}>
            <Target className="w-3.5 h-3.5" style={{ color: '#4682B4' }} />
          </div>
          <div className="text-center">
            <div className="text-base leading-tight font-black text-slate-700">{stats.total}</div>
            <div className="text-[9px] text-slate-400 font-medium">לקוחות</div>
          </div>
        </div>

        {/* DNA pipeline — 7 status capsules with connector dots */}
        {STATUS_PIPELINE.map((phase, idx) => {
          const count = stats.byStatus[phase.key] || 0;
          const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
          const Icon = phase.Icon;
          return (
            <React.Fragment key={phase.key}>
              {idx > 0 && (
                <div className="flex items-center shrink-0">
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                </div>
              )}
              <button
                onClick={() => setStatusFilter(prev => prev === phase.key ? null : phase.key)}
                className={`rounded-xl px-2 py-1.5 flex items-center gap-1.5 shrink-0 border transition-all cursor-pointer hover:scale-[1.02] ${
                  statusFilter === phase.key ? 'ring-2 ring-offset-1 shadow-md' : 'shadow-sm'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${phase.bg1} 0%, ${phase.bg2} 100%)`,
                  borderColor: count > 0 ? phase.color + '30' : '#e2e8f0',
                  ringColor: phase.color,
                  opacity: count === 0 ? 0.5 : 1,
                }}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: phase.color + '15' }}>
                  <Icon className="w-3 h-3" style={{ color: phase.color }} />
                </div>
                <div className="text-center min-w-[28px]">
                  <div className="text-base font-black leading-tight" style={{ color: count > 0 ? phase.color : '#94a3b8' }}>{count}</div>
                  <div className="text-[9px] text-slate-600 font-bold leading-tight whitespace-nowrap">{phase.label}</div>
                </div>
                {count > 0 && (
                  <div className="text-[9px] font-bold rounded-full px-1 py-0.5" style={{ color: phase.color, background: phase.color + '15' }}>
                    {pct}%
                  </div>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Cognitive Capacity Header — "מד דופק" above all views */}
      {!isLoading && tasks.length > 0 && (
        <CognitiveCapacityHeader tasks={tasks} onFilterTier={setCognitiveFilter} />
      )}

      <DashboardViewToggle value={viewMode} onChange={setViewMode} options={['table', 'workbook', 'kanban', 'timeline', 'radial']} />

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : viewMode === 'table' ? (
        sortedServiceKeys.length > 0 ? (
          <div className="space-y-4">
            {sortedServiceKeys.map(serviceKey => {
              const { service, clientRows } = serviceData[serviceKey];
              const isCollapsed = collapsedServices.has(serviceKey);
              return (
                <div key={serviceKey} className="border border-[#E0E0E0] rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleServiceCollapse(serviceKey)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-[#FAFBFC] hover:bg-[#F5F5F5] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                      <span className="font-bold text-[#263238]">{service.label}</span>
                      <span className="text-xs text-[#455A64]">{clientRows.length} לקוחות</span>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <GroupedServiceTable
                      service={service}
                      clientRows={clientRows}
                      allTasks={filteredTasks}
                      onToggleStep={handleToggleStep}
                      onDateChange={handleDateChange}
                      onStatusChange={handleStatusChange}
                      onPaymentDateChange={handlePaymentDateChange}
                      onSubTaskChange={handleSubTaskChange}
                      onAttachmentUpdate={handleAttachmentUpdate}
                      getClientIds={getPayrollIds}
                      onEdit={setEditingTask}
                      onDelete={handleDeleteTask}
                      onNote={setNoteTask}
                      bulkMode={bulkMode}
                      selectedTaskIds={selectedTaskIds}
                      onToggleSelect={(ids, add) => {
                        setSelectedTaskIds(prev => {
                          const next = new Set(prev);
                          ids.forEach(id => add ? next.add(id) : next.delete(id));
                          return next;
                        });
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center border-[#E0E0E0]">
            <Briefcase className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">לא נמצאו תהליכי שכר לחודש הנבחר</h3>
            <p className="text-slate-500">נסה לבחור חודש אחר או ליצור משימות חוזרות</p>
          </Card>
        )
      ) : viewMode === 'radial' ? (
        <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '500px' }}>
          <AyoaRadialView tasks={filteredTasks} centerLabel="שכר" centerSub="P1" />
        </div>
      ) : viewMode === 'timeline' ? (
        <ProjectTimelineView tasks={filteredTasks} />
      ) : viewMode === 'workbook' ? (
        <TaxWorkbookView
          tasks={filteredTasks}
          clients={clients}
          services={payrollDashboardServices}
          onToggleStep={handleToggleStep}
          onStatusChange={handleStatusChange}
          onDateChange={handleDateChange}
          onEdit={setEditingTask}
        />
      ) : viewMode === 'kanban' ? (
        <KanbanView tasks={filteredTasks} onStatusChange={handleStatusChange} onEdit={setEditingTask} />
      ) : null}

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

function getPayrollIds(client, serviceKey) {
  if (!client) return [];
  const ids = [];
  const ti = client.tax_info || {};
  const annual = ti.annual_tax_ids || {};

  // Always show entity number
  if (client.entity_number) ids.push({ label: 'ח"פ', value: client.entity_number });

  switch (serviceKey) {
    case 'deductions':
      if (ti.tax_deduction_file_number) ids.push({ label: 'תיק ניכויים', value: ti.tax_deduction_file_number });
      if (annual.deductions_id) ids.push({ label: 'פנקס ניכויים', value: annual.deductions_id });
      break;
    case 'social_security':
      if (ti.social_security_file_number) ids.push({ label: 'תיק ב"ל', value: ti.social_security_file_number });
      if (ti.tax_deduction_file_number) ids.push({ label: 'תיק ניכויים', value: ti.tax_deduction_file_number });
      break;
    default:
      // For payroll - show all related IDs for reporting reference
      if (ti.tax_deduction_file_number) ids.push({ label: 'ניכויים', value: ti.tax_deduction_file_number });
      if (annual.deductions_id) ids.push({ label: 'פנקס ניכויים', value: annual.deductions_id });
      if (ti.social_security_file_number) ids.push({ label: 'ב"ל', value: ti.social_security_file_number });
  }
  return ids;
}

