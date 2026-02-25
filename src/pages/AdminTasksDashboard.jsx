
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, Client } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import {
  Loader, RefreshCw, ChevronLeft, ChevronRight,
  ArrowRight, Users, X, ClipboardList, List, LayoutGrid, Search, Plus
} from 'lucide-react';
import KanbanView from '@/components/tasks/KanbanView';
import { format, subMonths, addMonths, differenceInDays, parseISO, isValid } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GroupedServiceTable from '@/components/dashboard/GroupedServiceTable';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import TaskToNoteDialog from '@/components/tasks/TaskToNoteDialog';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  ADDITIONAL_SERVICES,
  ALL_SERVICES,
  STATUS_CONFIG,
  getServiceForTask,
  getTaskProcessSteps,
  toggleStep,
  markAllStepsDone,
  markAllStepsUndone,
  areAllStepsDone,
  getCategoriesForDashboard,
} from '@/config/processTemplates';
import { syncNotesWithTaskStatus } from '@/hooks/useAutoReminders';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';

// Admin dashboard services (dashboard: 'admin')
const adminDashboardServices = Object.fromEntries(
  Object.entries(ADDITIONAL_SERVICES).filter(([, s]) => s.dashboard === 'admin')
);

const adminCategories = Object.values(adminDashboardServices).flatMap(s => s.taskCategories);

// All categories that belong to OTHER dashboards (tax, payroll, additional)
const otherDashboardCategories = new Set([
  ...getCategoriesForDashboard('tax'),
  ...getCategoriesForDashboard('payroll'),
  ...getCategoriesForDashboard('additional'),
]);

export default function AdminTasksDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client') || '';

  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [noteTask, setNoteTask] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { confirm, ConfirmDialogComponent } = useConfirm();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksData, clientsData] = await Promise.all([
        Task.list('-due_date', 5000).catch(() => []),
        Client.list(null, 500).catch(() => []),
      ]);

      // Include: admin-category tasks + uncategorized work tasks that don't belong to any other dashboard
      const now = new Date();
      const filtered = (tasksData || []).filter(t => {
        if (!t) return false;
        // Admin-category task
        if (t.category && adminCategories.includes(t.category)) return true;
        // Uncategorized work task (no category or not in any other dashboard)
        if (t.context === 'work' && (!t.category || !otherDashboardCategories.has(t.category))) {
          // Only show recent (last 60 days) or future tasks
          if (t.due_date) {
            const d = parseISO(t.due_date);
            if (isValid(d) && differenceInDays(now, d) > 60) return false;
          }
          return true;
        }
        return false;
      });
      setTasks(filtered);
      setClients(clientsData || []);
    } catch (error) {
      console.error("Error loading admin tasks:", error);
    }
    setIsLoading(false);
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
    return result;
  }, [tasks, clientFilter, searchTerm]);

  const clearClientFilter = () => {
    searchParams.delete('client');
    setSearchParams(searchParams);
  };

  const serviceData = useMemo(() => {
    const result = {};
    // Group by admin services
    Object.values(adminDashboardServices).forEach(service => {
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

    // Catch-all: uncategorized tasks (not matching any known service)
    const uncategorized = filteredTasks.filter(t => !getServiceForTask(t));
    if (uncategorized.length > 0) {
      const generalService = adminDashboardServices.general || {
        key: 'uncategorized', label: 'ללא קטגוריה', steps: [{ key: 'task', label: 'ביצוע' }],
      };
      result['__uncategorized'] = {
        service: generalService,
        clientRows: uncategorized
          .map(task => ({
            clientName: task.client_name || 'ללא לקוח',
            task,
            client: clientByName[task.client_name] || null,
          }))
          .sort((a, b) => a.clientName.localeCompare(b.clientName, 'he')),
      };
    }

    return result;
  }, [filteredTasks, clientByName]);

  const stats = useMemo(() => {
    const relevant = filteredTasks.filter(t => t.status !== 'not_relevant');
    const total = relevant.length;
    const completed = relevant.filter(t => t.status === 'completed').length;
    return {
      total,
      completed,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      pending: relevant.filter(t => t.status === 'not_started').length,
      inProgress: relevant.filter(t => !['not_started', 'completed', 'not_relevant'].includes(t.status)).length,
    };
  }, [filteredTasks]);

  const handleToggleStep = useCallback(async (task, stepKey) => {
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = toggleStep(currentSteps, stepKey);
    try {
      const updatedTask = { ...task, process_steps: updatedSteps };
      const allDone = areAllStepsDone(updatedTask);
      const updatePayload = { process_steps: updatedSteps };
      if (allDone && task.status !== 'completed') {
        updatePayload.status = 'completed';
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
      if (newStatus === 'completed') {
        updatePayload.process_steps = markAllStepsDone(task);
      } else if (task.status === 'completed' && newStatus === 'not_started') {
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
      console.error('Error editing task:', err);
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
        console.error('Error deleting task:', err);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 backdrop-blur-xl bg-white/45 border border-white/20 shadow-xl rounded-[32px]">
      <div className="flex items-center gap-2 flex-wrap">
        <Link to={createPageUrl('Tasks')}>
          <Button variant="outline" size="sm" className="gap-2 text-slate-600 hover:text-emerald-700">
            <ArrowRight className="w-4 h-4" />חזור למשימות
          </Button>
        </Link>
        {clientFilter && (
          <Badge className="bg-[#008291] text-white text-sm px-3 py-1.5 gap-2">
            <Users className="w-3.5 h-3.5" />{clientFilter}
            <button onClick={clearClientFilter} className="hover:bg-white/20 rounded-full p-0.5 ml-1"><X className="w-3 h-3" /></button>
          </Badge>
        )}
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">לוח אדמיניסטרטיבי</h1>
            <p className="text-slate-500">שיווק, מעקב לקוחות, פגישות ומשימות כלליות</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-white rounded-lg border border-white/20 p-0.5">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}>
              <List className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('kanban')}>
              <LayoutGrid className="w-4 h-4" />
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

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="חיפוש לפי שם לקוח, משימה, קטגוריה..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10 h-9"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-white/30 to-white border-white/20 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
            <div className="text-xs text-slate-500">סה"כ משימות</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-xs text-slate-500">ממתינות</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-xs text-slate-500">בתהליך</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-slate-500">הושלמו ({stats.pct}%)</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-12 h-12 animate-spin text-primary" />
        </div>
      ) : Object.keys(serviceData).length > 0 ? (
        viewMode === 'kanban' ? (
          <KanbanView tasks={filteredTasks} onTaskStatusChange={handleStatusChange} onEditTask={setEditingTask} />
        ) : (
          <div className="space-y-6">
            {Object.entries(serviceData).map(([serviceKey, { service, clientRows }]) => (
              <GroupedServiceTable
                key={serviceKey}
                service={service}
                clientRows={clientRows}
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
            ))}
          </div>
        )
      ) : (
        <Card className="p-12 text-center border-white/20">
          <ClipboardList className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">אין משימות אדמיניסטרטיביות</h3>
          <p className="text-slate-500">הוסף משימות כלליות כמו שיווק, מעקב לקוחות, פגישות ועוד</p>
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
