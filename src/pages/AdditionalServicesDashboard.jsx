
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, Client } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader, RefreshCw, ChevronLeft, ChevronRight, ChevronDown,
  ArrowRight, Users, X, Settings2, List, LayoutGrid, Search, GanttChart, Plus, Network,
  Inbox, PlayCircle, Radio, Send, Eye, FileWarning, CircleCheck, Target, GitBranchPlus
} from 'lucide-react';
import KanbanView from '@/components/tasks/KanbanView';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GroupedServiceTable from '@/components/dashboard/GroupedServiceTable';
import ProjectTimelineView from '@/components/dashboard/ProjectTimelineView';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import TaskToNoteDialog from '@/components/tasks/TaskToNoteDialog';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
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
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';
import DashboardViewToggle from '@/components/dashboard/DashboardViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import MiroProcessMap from '@/components/views/MiroProcessMap';
import TaxWorkbookView from '@/components/dashboard/TaxWorkbookView';
import ClientRecurringTasks from '@/components/clients/ClientRecurringTasks';

// P1 Board 2 — פנסיות וקרנות: מתפעל/טמל + מס"ב סוציאליות + תשלום רשויות
const P1_PAYROLL_EXTRAS = [
  'operator_reporting', 'taml_reporting', 'social_benefits',
  'masav_social', 'authorities_payment',
];

// P2 Bookkeeping extras: supplier MASAV, operator/taml, consulting
// Must match the columns in ClientsDashboard P2 additional services
const P2_BOOKKEEPING_EXTRAS = [
  'masav_suppliers', 'operator_reporting', 'taml_reporting', 'consulting', 'bookkeeping',
];

function getServicesForScope(scope) {
  const keys = scope === 'p2' ? P2_BOOKKEEPING_EXTRAS : P1_PAYROLL_EXTRAS;
  return Object.fromEntries(
    Object.entries(ADDITIONAL_SERVICES).filter(([key]) => keys.includes(key))
  );
}

// Status pipeline for DNA-style KPI cards (ordered by workflow progression)
const STATUS_PIPELINE = [
  { key: 'waiting_for_materials', label: 'ממתין לחומרים',       color: '#F59E0B', bg1: '#fffbeb', bg2: '#fef3c7', Icon: Inbox },
  { key: 'not_started',          label: 'לבצע',                color: '#64748B', bg1: '#f8fafc', bg2: '#f1f5f9', Icon: PlayCircle },
  { key: 'ready_to_broadcast',   label: 'מוכן לשידור',         color: '#0D9488', bg1: '#f0fdfa', bg2: '#ccfbf1', Icon: Radio },
  { key: 'reported_pending_payment', label: 'ממתין לתשלום',     color: '#4F46E5', bg1: '#eef2ff', bg2: '#e0e7ff', Icon: Send },
  { key: 'sent_for_review',      label: 'הועבר לעיון',         color: '#7C3AED', bg1: '#faf5ff', bg2: '#f3e8ff', Icon: Eye },
  { key: 'review_after_corrections', label: 'לעיון לאחר תיקונים', color: '#8B5CF6', bg1: '#f5f3ff', bg2: '#ede9fe', Icon: Eye },
  { key: 'needs_corrections',    label: 'לתיקון',              color: '#D97706', bg1: '#fff7ed', bg2: '#ffedd5', Icon: FileWarning },
  { key: 'production_completed', label: 'הושלם',               color: '#16A34A', bg1: '#f0fdf4', bg2: '#dcfce7', Icon: CircleCheck },
];

const SCOPE_CONFIG = {
  p1: {
    title: 'פנסיות וקרנות',
    subtitle: 'מתפעל, טמל, מס"ב סוציאליות, תשלום רשויות, מילואים',
    gradientFrom: 'from-[#0277BD]',
    gradientTo: 'to-[#01579B]',
    backHref: 'PayrollDashboard',
    backLabel: 'חזור לשכר',
    emptyTitle: 'אין שירותי שכר נוספים לחודש הנבחר',
  },
  p2: {
    title: 'P2 | שירותים נוספים',
    subtitle: 'מס"ב ספקים, דיווח מתפעל/טמל, ייעוץ, הנהלת חשבונות',
    gradientFrom: 'from-[#1E3A5F]',
    gradientTo: 'to-[#2C3E50]',
    backHref: 'ClientsDashboard',
    backLabel: 'חזור להנה"ח',
    emptyTitle: 'אין שירותי הנה"ח נוספים לחודש הנבחר',
  },
};

export default function AdditionalServicesDashboardPage({ scope = 'p1' }) {
  const config = SCOPE_CONFIG[scope] || SCOPE_CONFIG.p1;
  const additionalDashboardServices = useMemo(() => getServicesForScope(scope), [scope]);
  const allAdditionalCategories = useMemo(() => Object.values(additionalDashboardServices).flatMap(s => s.taskCategories), [additionalDashboardServices]);
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client') || '';

  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    try { const s = localStorage.getItem('calmplan_pension_month'); if (s) return new Date(s); } catch {} return subMonths(new Date(), 1);
  });
  useEffect(() => { try { localStorage.setItem('calmplan_pension_month', selectedMonth.toISOString()); } catch {} }, [selectedMonth]);
  const [viewMode, setViewMode] = useState('table'); // Default: table (client prefers spreadsheet view)
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [collapsedServices, setCollapsedServices] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState(null);
  const [showInjectionPanel, setShowInjectionPanel] = useState(false);
  const { confirm, ConfirmDialogComponent } = useConfirm();

  useEffect(() => { loadData(); }, [selectedMonth, allAdditionalCategories]);

  // Live-refresh: listen for cascade events from other pages
  useEffect(() => {
    const handler = () => loadData();
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
        Task.list(null, 5000).catch(() => []),
        Client.list(null, 500).catch(() => []),
      ]);
      // Post-filter: only show tasks belonging to the selected reporting month
      const allRaw = Array.isArray(tasksData) ? tasksData : [];
      const selectedMonthStr = format(selectedMonth, 'yyyy-MM');
      const filtered = allRaw.filter(t => {
        if (!allAdditionalCategories.includes(t.category)) return false;
        return getTaskReportingMonth(t) === selectedMonthStr;
      });
      // DATA SURVIVAL: if month filter kills everything, show all matching category tasks
      if (filtered.length === 0 && allRaw.length > 0) {
        const allCategory = allRaw.filter(t => allAdditionalCategories.includes(t.category));
        setTasks(allCategory);
      } else {
        setTasks(filtered);
      }
      setClients(clientsData || []);
      syncCompletedTaskSteps(filtered);
    } catch (error) {
      console.error("Error loading additional services tasks:", error);
    }
    setIsLoading(false);
  };

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
    if (statusFilter) {
      result = result.filter(t => (t.status || 'not_started') === statusFilter);
    }
    return result;
  }, [tasks, clientFilter, searchTerm, statusFilter]);

  const clearClientFilter = () => {
    searchParams.delete('client');
    setSearchParams(searchParams);
  };

  const serviceData = useMemo(() => {
    const result = {};
    Object.values(additionalDashboardServices).forEach(service => {
      const serviceTasks = filteredTasks.filter(t => service.taskCategories.includes(t.category));
      // Always show all services (even empty) so tabs are always visible
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
    });
    return result;
  }, [filteredTasks, clientByName, additionalDashboardServices]);

  const serviceKeys = useMemo(() => Object.keys(serviceData), [serviceData]);

  // Default all services to collapsed on first load
  useEffect(() => {
    if (serviceKeys.length > 0 && collapsedServices.size === 0) {
      setCollapsedServices(new Set(serviceKeys));
    }
  }, [serviceKeys]);

  const toggleServiceCollapse = useCallback((key) => {
    setCollapsedServices(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const expandAllServices = useCallback(() => setCollapsedServices(new Set()), []);
  const collapseAllServices = useCallback(() => setCollapsedServices(new Set(serviceKeys)), [serviceKeys]);

  const stats = useMemo(() => {
    const relevant = filteredTasks.filter(t => true);
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
    // Status counts for DNA pipeline cards — count unique clients
    const byStatus = {};
    STATUS_PIPELINE.forEach(s => { byStatus[s.key] = 0; });
    const clientsByStatus = {};
    STATUS_PIPELINE.forEach(s => { clientsByStatus[s.key] = new Set(); });
    relevant.forEach(t => {
      const key = t.status || 'not_started';
      if (clientsByStatus[key]) clientsByStatus[key].add(t.client_name);
    });
    Object.keys(byStatus).forEach(k => { byStatus[k] = clientsByStatus[k].size; });
    const allClients = new Set(relevant.map(t => t.client_name));
    return { total: allClients.size, completed, pct: allClients.size > 0 ? Math.round((completed / allClients.size) * 100) : 0, totalSteps, doneSteps, stepsPct: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0, byStatus };
  }, [filteredTasks]);

  const handleToggleStep = useCallback(async (task, stepKey) => {
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = toggleStep(currentSteps, stepKey);
    try {
      const updatedTask = { ...task, process_steps: updatedSteps };
      const allDone = areAllStepsDone(updatedTask);
      const updatePayload = { process_steps: updatedSteps };
      if (allDone && task.status !== 'production_completed') {
        updatePayload.status = 'production_completed';
      }
      await Task.update(task.id, updatePayload);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
      if (updatePayload.status) syncNotesWithTaskStatus(task.id, updatePayload.status);
    } catch (error) { console.error("Error updating step:", error); }
  }, []);

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
      } else if (task.status === 'production_completed' && newStatus === 'not_started') {
        updatePayload.process_steps = markAllStepsUndone(task);
      }
      await Task.update(task.id, updatePayload);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
      syncNotesWithTaskStatus(task.id, newStatus);
    } catch (error) { console.error("Error updating status:", error); }
  }, []);

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
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl(config.backHref)}>
          <Button variant="outline" size="sm" className="gap-2 text-slate-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />{config.backLabel}
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
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} flex items-center justify-center shadow-md`}>
            <Settings2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{config.title}</h1>
            <p className="text-slate-500">חודש: {format(selectedMonth, 'MMMM yyyy', { locale: he })} | {config.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E0E0E0] p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center w-32">
              <div className="text-[12px] text-slate-400 leading-none">חודש</div>
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

      {/* Injection Panel */}
      <AnimatePresence>
        {showInjectionPanel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="border-2 border-orange-200 bg-orange-50/30 rounded-2xl overflow-hidden">
            <ClientRecurringTasks onGenerateComplete={loadData} branchFilter={scope === 'p2' ? 'P2' : 'P1'} categoryFilter={allAdditionalCategories} />
          </motion.div>
        )}
      </AnimatePresence>

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
      </div>

      <DashboardViewToggle value={viewMode} onChange={setViewMode} options={['table', 'workbook', 'miro', 'kanban', 'timeline', 'radial']} />

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

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : Object.keys(serviceData).length > 0 ? (
        viewMode === 'miro' ? (
          <MiroProcessMap
            tasks={filteredTasks}
            centerLabel={scope === 'p2' ? 'שירותים נוספים' : 'פנסיות וקרנות'}
            centerSub={`חודש ${format(selectedMonth, 'MMMM', { locale: he })}`}
            onEditTask={setEditingTask}
            onStatusChange={handleStatusChange}
            phases={Object.values(additionalDashboardServices).map(svc => ({
              label: svc.label,
              serviceKeys: [svc.key, ...(svc.taskCategories || [])],
              services: [svc],
            }))}
          />
        ) : viewMode === 'kanban' ? (
          <KanbanView tasks={filteredTasks} onTaskStatusChange={handleStatusChange} onEditTask={setEditingTask} />
        ) : viewMode === 'timeline' ? (
          <ProjectTimelineView tasks={filteredTasks} month={selectedMonth.getMonth() + 1} year={selectedMonth.getFullYear()} onEdit={setEditingTask} />
        ) : viewMode === 'radial' ? (
          <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '500px' }}>
            <AyoaRadialView tasks={filteredTasks} centerLabel="שירותים נוספים" centerSub="P1" />
          </div>
        ) : viewMode === 'workbook' ? (
          <TaxWorkbookView
            tasks={filteredTasks}
            clients={clients}
            services={additionalDashboardServices}
            onToggleStep={handleToggleStep}
            onStatusChange={handleStatusChange}
            onDateChange={handleDateChange}
            onEdit={setEditingTask}
          />
        ) : viewMode === 'table' ? (
          (() => {
            const serviceEntries = Object.entries(serviceData);
            if (serviceEntries.length === 0) return null;
            return (
              <Tabs defaultValue={serviceEntries[0][0]} className="w-full" dir="rtl">
                <TabsList className="flex gap-1 h-auto p-1.5 rounded-xl bg-slate-100 border mb-3 flex-wrap">
                  {serviceEntries.map(([serviceKey, { service, clientRows }]) => {
                    const completed = clientRows.filter(r => r.task.status === 'production_completed').length;
                    return (
                      <TabsTrigger key={serviceKey} value={serviceKey}
                        className="rounded-lg px-4 py-2 text-sm font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1E3A5F]">
                        {service.label}
                        <span className="ms-1.5 text-xs text-slate-400">({completed}/{clientRows.length})</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {serviceEntries.map(([serviceKey, { service, clientRows }]) => (
                  <TabsContent key={serviceKey} value={serviceKey} className="mt-0">
                    {clientRows.length === 0 ? (
                      <div className="border border-[#E0E0E0] rounded-xl p-8 text-center text-slate-400">
                        <div className="text-3xl mb-2">📭</div>
                        <p className="font-medium">אין משימות עבור {service.label} בחודש הנבחר</p>
                        <p className="text-xs mt-1">הזרק משימות דרך כרטיס הלקוח או הפעל אוטומציות</p>
                      </div>
                    ) : (
                      <div className="border border-[#E0E0E0] rounded-xl overflow-hidden">
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
                          onEdit={setEditingTask}
                          onDelete={handleDeleteTask}
                          onNote={setNoteTask}
                        />
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            );
          })()
        ) : null
      ) : (
        <Card className="p-12 text-center border-[#E0E0E0]">
          <Settings2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">{config.emptyTitle}</h3>
          <p className="text-slate-500">הפעל אוטומציות כדי ליצור משימות חודשיות עבור שירותים נוספים כמו מס"ב, משלוח תלושים ועוד</p>
          <Link to={createPageUrl('AutomationRules')}>
            <Button variant="outline" className="mt-4 gap-2">
              <Settings2 className="w-4 h-4" />
              עבור לאוטומציות
            </Button>
          </Link>
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

