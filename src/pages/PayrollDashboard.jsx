
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, Client } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import {
  Loader, RefreshCw, Briefcase, ChevronLeft, ChevronRight,
  ArrowRight, Users, X, List, LayoutGrid, Search, GanttChart, Plus, ChevronDown
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
import { processTaskCascade } from '@/engines/taskCascadeEngine';
import { getTaskReportingMonth } from '@/config/automationRules';
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';
import { useAyoaView } from '@/contexts/AyoaViewContext';
import UnifiedAyoaLayout from '@/components/canvas/UnifiedAyoaLayout';
import GanttView from '@/components/views/GanttView';

const payrollDashboardServices = {
  ...PAYROLL_SERVICES,
  ...Object.fromEntries(
    Object.entries(ADDITIONAL_SERVICES).filter(([, s]) => s.dashboard === 'payroll')
  ),
};

const allPayrollCategories = Object.values(payrollDashboardServices).flatMap(s => s.taskCategories);

export default function PayrollDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client') || '';

  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => subMonths(new Date(), 1)); // Default to previous month (reporting month)
  const [viewMode, setViewMode] = useState('kanban');
  const { ayoaView, setAyoaView } = useAyoaView();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [collapsedServices, setCollapsedServices] = useState(new Set());
  const [cognitiveFilter, setCognitiveFilter] = useState(null);
  const { confirm, ConfirmDialogComponent } = useConfirm();

  useEffect(() => { loadData(); }, [selectedMonth]);

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
        Task.list(null, 5000).catch((err) => { console.error('PayrollDashboard Task.list FAILED:', err); return []; }),
        Client.list(null, 500).catch(() => []),
      ]);
      // ══ NO CATEGORY WALL — show ALL tasks, let UI group them ══
      const allRaw = Array.isArray(tasksData) ? tasksData : [];
      console.log('RAW_DATA_CHECK [Payroll]:', allRaw.length, 'tasks — showing ALL');
      setTasks(allRaw);
      setClients(clientsData || []);
      syncCompletedTaskSteps(filtered);
    } catch (error) {
      console.error("Error loading payroll tasks:", error);
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
    if (cognitiveFilter !== null) {
      result = result.filter(t => {
        const w = getServiceWeight(t.category);
        return (w.cognitiveLoad ?? 0) === cognitiveFilter;
      });
    }
    return result;
  }, [tasks, clientFilter, searchTerm, cognitiveFilter]);

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

  // Default all services to collapsed on first load
  useEffect(() => {
    if (sortedServiceKeys.length > 0 && collapsedServices.size === 0) {
      setCollapsedServices(new Set(sortedServiceKeys));
    }
  }, [sortedServiceKeys]);

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
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0, totalSteps, doneSteps, stepsPct: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0 };
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

      await Task.update(task.id, updatePayload);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));

      // Auto-create Phase B+C child tasks when payroll production completes
      if (cascade.tasksToCreate?.length > 0) {
        const createdTasks = [];
        for (const childDef of cascade.tasksToCreate) {
          const created = await Task.create(childDef);
          createdTasks.push(created);
        }
        // Add newly created tasks to local state so they appear immediately
        setTasks(prev => [...prev, ...createdTasks]);
      }

      if (updatePayload.status) syncNotesWithTaskStatus(task.id, updatePayload.status);
    } catch (error) { console.error("Error updating step:", error); }
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
    <div className="p-4 md:p-6 space-y-5 bg-white border border-[#E0E0E0] shadow-xl rounded-[32px]">
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl('ClientsDashboard')}>
          <Button variant="outline" size="sm" className="gap-2 text-slate-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />חזור ללוח לקוחות
          </Button>
        </Link>
        {clientFilter && (
          <Badge className="bg-[#1E3A5F] text-white text-sm px-3 py-1.5 gap-2">
            <Users className="w-3.5 h-3.5" />{clientFilter}
            <button onClick={clearClientFilter} className="hover:bg-[#F5F5F5] rounded-full p-0.5 ml-1"><X className="w-3 h-3" /></button>
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
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">P1 | שכר ודיווחי רשויות</h1>
            <p className="text-slate-500">חודש דיווח: {format(selectedMonth, 'MMMM yyyy', { locale: he })} | שכר, ניכויים, ביטוח לאומי, מס"ב ועוד</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-[#E0E0E0] p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange('prev')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center w-32">
              <div className="text-[10px] text-slate-400 leading-none">חודש דיווח</div>
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
          className="pr-10 h-9"
        />
        </div>
        <div className="flex bg-white rounded-lg p-0.5 shadow-sm border border-[#E0E0E0] text-xs">
          <button onClick={expandAllServices} className="px-2.5 py-1.5 rounded-md text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 font-medium transition-colors whitespace-nowrap">פתח הכל</button>
          <button onClick={collapseAllServices} className="px-2.5 py-1.5 rounded-md text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 font-medium transition-colors whitespace-nowrap">סגור הכל</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-[#F5F5F5] to-white border-[#E0E0E0] shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-slate-700">{stats.total}</div>
            <div className="text-xs text-slate-500">סה"כ תהליכים</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-slate-500">הושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{stats.pct}%</div>
            <div className="text-xs text-slate-500">תהליכים שהושלמו</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-sky-700">{stats.stepsPct}%</div>
            <div className="text-xs text-slate-500">שלבים ({stats.doneSteps}/{stats.totalSteps})</div>
          </CardContent>
        </Card>
      </div>

      {/* Cognitive Capacity Header — "מד דופק" above all views */}
      {!isLoading && tasks.length > 0 && (
        <CognitiveCapacityHeader tasks={tasks} onFilterTier={setCognitiveFilter} />
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : (
        <UnifiedAyoaLayout tasks={filteredTasks} clients={clients} isLoading={isLoading} centerLabel="שכר" centerSub="P1" accentColor="#00A3E0" currentMonth={selectedMonth} onEditTask={setEditingTask}>
        {sortedServiceKeys.length > 0 ? (
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
        )}
        </UnifiedAyoaLayout>
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

