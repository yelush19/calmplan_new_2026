/**
 * useTaskCascade - Updated for Design Awareness
 */

import { useCallback, useMemo } from 'react';
import { Task, ServiceCatalog } from '@/api/entities';
import { useDesign } from '@/contexts/DesignContext'; // הוספת הקשר לעיצוב
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

export default function useTaskCascade(tasks, setTasks, clients = []) {
  const design = useDesign(); // גישה להגדרות העיצוב

  const updateTaskWithCascade = useCallback(async (taskId, updates) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // שליפת העיצוב של משימת האם כדי להוריש אותו הלאה
    const parentDesign = {
      color: updates.color || task.color,
      shape: updates.shape || task.shape,
      sticker: updates.sticker || task.sticker
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
    };
    const cascade = processTaskCascade({ ...task, process_steps: steps }, steps, siblings, cascadeOptions);

    const finalUpdates = { ...updates };
    if (cascade.statusUpdate && !updates.status) {
      finalUpdates.status = cascade.statusUpdate.status;
    }

    const isDirectProduction = updates.status === 'production_completed' && task.status !== 'production_completed';

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...finalUpdates } : t));

    try {
      await Task.update(taskId, finalUpdates);

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
            branch: task.branch || 'P1',
            due_date: subDueDate,
            report_month: task.report_month,
            report_year: task.report_year,
            workflow_phase: phase,
            master_task_id: task.id,
            // --- ירושת עיצוב ---
            color: parentDesign.color,
            shape: parentDesign.shape,
            process_steps: templateSteps,
          };
        };

        if (service?.key === 'payroll') {
          tasksToCreate = [
            ...PHASE_B_SERVICES.map(s => buildChild(s, 'phase_b')),
            ...PHASE_C_SERVICES.map(s => buildChild(s, 'phase_c')),
            ...MSB_COLLECTOR_SERVICES.map(s => ({ ...buildChild(s, 'msb_collector'), status: 'waiting_for_materials', is_collector: true }))
          ];
        } else if (service?.key === 'bookkeeping') {
          tasksToCreate = [
            ...P2_PHASE_B_SERVICES.map(s => buildChild(s, 'phase_b')),
            ...P2_PHASE_C_SERVICES.map(s => buildChild(s, 'phase_c')),
            ...P2_COLLECTOR_SERVICES.map(s => ({ ...buildChild(s, 'pnl_collector'), status: 'waiting_for_materials', is_collector: true }))
          ];
        }
      }

      // יצירת המשימות ב-DB
      for (const newTask of tasksToCreate) {
        const created = await Task.create(newTask);
        if (created) {
          setTasks(prev => [...prev, created]);
          // עדכון ה-Cache של העיצוב
          if (created.color || created.shape) {
            design.setNodeOverride(created.id, { color: created.color, shape: created.shape });
          }
        }
      }

      notifyChange('tasks');
    } catch (err) {
      console.error('Cascade update failed:', err);
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
    }
  }, [tasks, setTasks, design, clients]);

  // שאר הפונקציות (updateStepWithCascade, insights, וכו') נשארות דומות
  // עם הוספת ירושת העיצוב במידת הצורך.

  return {
    updateTaskWithCascade,
    updateStepWithCascade,
    insights: useMemo(() => computeInsights(tasks, clients), [tasks, clients]),
    getClientNodeState: useCallback((name) => computeClientNodeState(name, tasks.filter(t => t.client_name === name)), [tasks]),
  };
}
