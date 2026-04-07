import { useCallback, useMemo } from 'react';
import { Task } from '@/api/entities';
import {
  processTaskCascade,
  computeInsights,
  computeClientNodeState,
  filterByClientServices,
  getSubTaskDueDate,
} from '@/engines/taskCascadeEngine';
import {
  getServiceForTask,
  getTaskProcessSteps,
  toggleStep,
  ALL_SERVICES,
} from '@/config/processTemplates';
import {
  PHASE_B_SERVICES,
  PHASE_C_SERVICES,
  MSB_COLLECTOR_SERVICES,
  P2_PHASE_B_SERVICES,
  P2_PHASE_C_SERVICES,
  P2_COLLECTOR_SERVICES,
} from '@/engines/taskCascadeEngine';
import { processSequenceUnlock } from '@/engines/automationEngine';

function notifyChange(collection = 'tasks') {
  window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
    detail: { collection, type: 'cascade' },
  }));
}

function notifyTaskStarted(task) {
  window.dispatchEvent(new CustomEvent('calmplan:task-started', {
    detail: { task },
  }));
}

export default function useTaskCascade(tasks, setTasks, clients = []) {

  const updateTaskWithCascade = useCallback(async (taskId, updates) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Capture parent design metadata for inheritance
    const parentDesign = {
      color: updates.color || task.color,
      shape: updates.shape || task.shape,
      branch: updates.branch || task.branch
    };

    const merged = { ...task, ...updates };
    const steps = merged.process_steps || {};

    const siblings = tasks.filter(t =>
      t.client_name === task.client_name &&
      t.reporting_month === task.reporting_month &&
      t.id !== task.id
    );

    const client = clients.find(c => c.name === task.client_name || c.id === task.client_id);
    const cascadeOptions = {
      clientServices: client?.service_types || [],
      clientPaymentMethod: client?.authorities_payment_method || '',
      clientReportingInfo: client?.reporting_info || {},
    };
    const cascade = processTaskCascade({ ...task, process_steps: steps }, steps, siblings, cascadeOptions);

    const finalUpdates = { ...updates };
    if (cascade.statusUpdate && !updates.status) {
      finalUpdates.status = cascade.statusUpdate.status;
    }

    const isDirectProduction = updates.status === 'production_completed' &&
      task.status !== 'production_completed';

    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...finalUpdates } : t
    ));

    // Dispatch task-started event for RealityCheck timer
    if (finalUpdates.status === 'in_progress' && task.status !== 'in_progress') {
      notifyTaskStarted({ ...task, ...finalUpdates });
    }

    try {
      await Task.update(taskId, { ...task, ...finalUpdates });

      let tasksToCreate = cascade.tasksToCreate || [];

      if (isDirectProduction && tasksToCreate.length === 0) {
        const service = getServiceForTask(task);
        const subDueDate = getSubTaskDueDate(task.due_date || task.date);
        
        const buildChild = (svc, phase) => {
          const templateSteps = getTaskProcessSteps({ category: ALL_SERVICES[svc.serviceKey]?.createCategory || svc.title });
          return {
            serviceKey: svc.serviceKey,
            title: `${svc.title} - ${task.client_name}`,
            client_name: task.client_name,
            client_id: task.client_id,
            category: ALL_SERVICES[svc.serviceKey]?.createCategory || svc.title,
            status: 'not_started',
            branch: parentDesign.branch || 'P1',
            due_date: subDueDate,
            report_month: task.report_month,
            report_year: task.report_year,
            workflow_phase: phase,
            master_task_id: task.id,
            triggered_by: task.id,
            color: parentDesign.color,
            shape: parentDesign.shape,
            process_steps: templateSteps,
          };
        };

        if (service?.key === 'payroll') {
          tasksToCreate = [
            ...PHASE_B_SERVICES.map(s => buildChild(s, 'phase_b')),
            ...PHASE_C_SERVICES.map(s => buildChild(s, 'phase_c')),
            ...MSB_COLLECTOR_SERVICES.map(s => ({ ...buildChild(s, 'msb_collector'), is_collector: true, status: 'waiting_for_materials' }))
          ];
        } else if (service?.key === 'bookkeeping') {
          tasksToCreate = [
            ...P2_PHASE_B_SERVICES.map(s => buildChild(s, 'phase_b')),
            ...P2_PHASE_C_SERVICES.map(s => buildChild(s, 'phase_c')),
            ...P2_COLLECTOR_SERVICES.map(s => ({ ...buildChild(s, 'pnl_collector'), is_collector: true, status: 'waiting_for_materials' }))
          ];
        }
      }

      if (tasksToCreate.length > 0) {
        const existingTitles = new Set(tasks.map(t => t.title));
        for (const newTask of tasksToCreate) {
          if (existingTitles.has(newTask.title)) continue;
          const created = await Task.create(newTask);
          if (created) {
            setTasks(prev => [...prev, created]);
            // Sync design without circular dependency
            window.dispatchEvent(new CustomEvent('calmplan:design-changed', { 
              detail: { nodeId: created.id, color: created.color, shape: created.shape } 
            }));
          }
        }
      }

      if (finalUpdates.status === 'production_completed') {
        const unlocked = await processSequenceUnlock({ ...task, ...finalUpdates }, tasks);
        if (unlocked.length > 0) {
          setTasks(prev => prev.map(t => {
            const u = unlocked.find(ul => ul.id === t.id);
            return u ? { ...t, status: 'not_started' } : t;
          }));
        }
      }

      notifyChange('tasks');
    } catch (err) {
      console.error('Cascade update failed:', err);
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
    }
  }, [tasks, setTasks, clients]);

  const updateStepWithCascade = useCallback(async (taskId, stepKey) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = toggleStep(currentSteps, stepKey);
    const siblings = tasks.filter(t => t.client_name === task.client_name && t.reporting_month === task.reporting_month && t.id !== task.id);
    
    const client = clients.find(c => c.name === task.client_name || c.id === task.client_id);
    const cascade = processTaskCascade({ ...task, process_steps: updatedSteps }, updatedSteps, siblings, {
      clientServices: client?.service_types || [],
      clientPaymentMethod: client?.authorities_payment_method || '',
      clientReportingInfo: client?.reporting_info || {},
    });

    const updates = { process_steps: updatedSteps };
    if (cascade.statusUpdate) updates.status = cascade.statusUpdate.status;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));

    try {
      await Task.update(taskId, updates);
      if (cascade.tasksToCreate?.length > 0) {
        const existingTitles = new Set(tasks.map(t => t.title));
        for (const newTask of cascade.tasksToCreate) {
          if (existingTitles.has(newTask.title)) continue;
          const created = await Task.create(newTask);
          if (created) setTasks(prev => [...prev, created]);
        }
      }
      notifyChange('tasks');
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
    }
  }, [tasks, setTasks, clients]);

  return {
    updateTaskWithCascade,
    updateStepWithCascade,
    insights: useMemo(() => computeInsights(tasks, clients), [tasks, clients]),
    getClientNodeState: useCallback((name) => computeClientNodeState(name, tasks.filter(t => t.client_name === name)), [tasks]),
  };
}
