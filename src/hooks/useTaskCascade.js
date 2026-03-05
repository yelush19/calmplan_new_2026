/**
 * useTaskCascade - React hook wrapping the cascade engine.
 *
 * Provides:
 * - updateTaskWithCascade(taskId, updates) - updates a task and processes cascading logic
 * - updateStepWithCascade(taskId, stepKey) - toggles a process step and cascades
 * - insights - computed proactive insights for the current task set
 * - getClientNodeState(clientName) - MindMap node state for a client
 *
 * Emits 'calmplan:data-synced' after cascade operations so other pages refresh.
 */

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
  P2_PHASE_B_SERVICES,
  P2_PHASE_C_SERVICES,
} from '@/engines/taskCascadeEngine';

/**
 * Notify other components/pages that data has changed.
 */
function notifyChange(collection = 'tasks') {
  window.dispatchEvent(new CustomEvent('calmplan:data-synced', {
    detail: { collection, type: 'cascade' },
  }));
}

/**
 * @param {Object[]} tasks - The current tasks array (from page state)
 * @param {Function} setTasks - The state setter for tasks
 * @param {Object[]} clients - The current clients array
 */
export default function useTaskCascade(tasks, setTasks, clients = []) {

  /**
   * Update a task and run cascade logic.
   * Handles: status update, auto-create dependent tasks, sibling updates.
   */
  const updateTaskWithCascade = useCallback(async (taskId, updates) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const merged = { ...task, ...updates };
    const steps = merged.process_steps || {};

    // Find sibling tasks (same client + reporting month)
    const siblings = tasks.filter(t =>
      t.client_name === task.client_name &&
      t.reporting_month === task.reporting_month &&
      t.id !== task.id
    );

    // CRITICAL: Run cascade with the ORIGINAL task (pre-merge) so the
    // "already production_completed" guard doesn't block when user directly
    // sets status to production_completed via dropdown.
    const cascadeTask = { ...task, process_steps: steps };

    // Service Filtering: find client and pass service_types + payment method
    const client = clients.find(c => c.name === task.client_name || c.id === task.client_id);
    const cascadeOptions = {
      clientServices: client?.service_types || [],
      clientPaymentMethod: client?.authorities_payment_method || '',
    };
    const cascade = processTaskCascade(cascadeTask, steps, siblings, cascadeOptions);

    // Apply status from cascade if the update didn't already set status
    const finalUpdates = { ...updates };
    if (cascade.statusUpdate && !updates.status) {
      finalUpdates.status = cascade.statusUpdate.status;
    }

    // Direct status change to production_completed: force cascade creation
    // even if processTaskCascade didn't produce autoCreateTasks
    // (because the guard blocked it due to step-based logic not matching)
    const isDirectProduction = updates.status === 'production_completed' &&
      task.status !== 'production_completed';

    // Optimistic update local state
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...finalUpdates } : t
    ));

    // Persist to backend
    try {
      await Task.update(taskId, { ...task, ...finalUpdates });

      // Auto-create triggered tasks from cascade engine
      let tasksToCreate = cascade.tasksToCreate || [];

      // If direct production_completed and cascade didn't produce tasks,
      // manually build Phase B+C tasks based on service type
      if (isDirectProduction && tasksToCreate.length === 0) {
        const service = getServiceForTask(task);
        const subDueDate = getSubTaskDueDate(task.due_date || task.date);
        if (service?.key === 'payroll') {
          const buildChild = (svc, phase, label) => ({
            serviceKey: svc.serviceKey,
            title: `${svc.title} - ${task.client_name}`,
            client_name: task.client_name,
            client_id: task.client_id,
            category: ALL_SERVICES[svc.serviceKey]?.createCategory || svc.title,
            status: 'not_started',
            branch: 'P1',
            due_date: subDueDate,
            report_month: task.report_month,
            report_year: task.report_year,
            context: 'work',
            is_recurring: true,
            workflow_phase: phase,
            master_task_id: task.id,
            triggered_by: task.id,
            source: 'payroll_cascade',
          });
          tasksToCreate = [
            ...PHASE_B_SERVICES.map(s => buildChild(s, 'phase_b', 'שלב ב\'')),
            ...PHASE_C_SERVICES.map(s => buildChild(s, 'phase_c', 'שלב ג\'')),
          ];
        } else if (service?.key === 'bookkeeping') {
          const existingCategories = new Set(siblings.map(t => t.category));
          const buildChild = (svc, phase) => ({
            serviceKey: svc.serviceKey,
            title: `${svc.title} - ${task.client_name}`,
            client_name: task.client_name,
            client_id: task.client_id,
            category: svc.createCategory || svc.title,
            status: 'not_started',
            branch: 'P2',
            due_date: subDueDate,
            report_month: task.report_month,
            report_year: task.report_year,
            context: 'work',
            is_recurring: true,
            workflow_phase: phase,
            master_task_id: task.id,
            triggered_by: task.id,
            source: 'bookkeeping_cascade',
          });
          tasksToCreate = [
            ...P2_PHASE_B_SERVICES.filter(s => !existingCategories.has(s.createCategory)).map(s => buildChild(s, 'phase_b')),
            ...P2_PHASE_C_SERVICES.filter(s => !existingCategories.has(s.createCategory)).map(s => buildChild(s, 'phase_c')),
          ];
        }
        // Service Filtering: apply חוק בל יעבור to manually built tasks too
        if (tasksToCreate.length > 0 && client?.service_types) {
          tasksToCreate = filterByClientServices(tasksToCreate, client.service_types);
        }
      }

      if (tasksToCreate.length > 0) {
        const existingTitles = new Set(tasks.map(t => t.title));

        for (const newTask of tasksToCreate) {
          // Don't create duplicates
          if (existingTitles.has(newTask.title)) continue;

          const created = await Task.create(newTask);
          if (created) {
            setTasks(prev => [...prev, created]);
          }
        }
      }

      notifyChange('tasks');
    } catch (err) {
      console.error('Cascade update failed:', err);
      // Revert optimistic update on failure
      setTasks(prev => prev.map(t =>
        t.id === taskId ? task : t
      ));
    }
  }, [tasks, setTasks]);

  /**
   * Toggle a process step and run cascade logic.
   * This is the main entry point for step-level interactions.
   */
  const updateStepWithCascade = useCallback(async (taskId, stepKey) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Get current steps (initialized from template if needed)
    const currentSteps = getTaskProcessSteps(task);
    const updatedSteps = toggleStep(currentSteps, stepKey);

    // Run the cascade with the new steps
    const siblings = tasks.filter(t =>
      t.client_name === task.client_name &&
      t.reporting_month === task.reporting_month &&
      t.id !== task.id
    );

    const merged = { ...task, process_steps: updatedSteps };

    // Service Filtering: find client and pass service_types + payment method
    const client = clients.find(c => c.name === task.client_name || c.id === task.client_id);
    const cascadeOptions = {
      clientServices: client?.service_types || [],
      clientPaymentMethod: client?.authorities_payment_method || '',
    };
    const cascade = processTaskCascade(merged, updatedSteps, siblings, cascadeOptions);

    const updates = { process_steps: updatedSteps };
    if (cascade.statusUpdate) {
      updates.status = cascade.statusUpdate.status;
    }

    // Optimistic local update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    ));

    // Persist
    try {
      await Task.update(taskId, { ...task, ...updates });

      // Auto-create triggered tasks
      if (cascade.tasksToCreate?.length > 0) {
        const existingTitles = new Set(tasks.map(t => t.title));

        for (const newTask of cascade.tasksToCreate) {
          if (existingTitles.has(newTask.title)) continue;

          const created = await Task.create(newTask);
          if (created) {
            setTasks(prev => [...prev, created]);
          }
        }
      }

      notifyChange('tasks');
    } catch (err) {
      console.error('Step cascade failed:', err);
      setTasks(prev => prev.map(t =>
        t.id === taskId ? task : t
      ));
    }
  }, [tasks, setTasks]);

  /**
   * Computed proactive insights from the current task set.
   */
  const insights = useMemo(() => {
    return computeInsights(tasks, clients);
  }, [tasks, clients]);

  /**
   * Get MindMap node state for a specific client.
   */
  const getClientNodeState = useCallback((clientName) => {
    const clientTasks = tasks.filter(t => t.client_name === clientName);
    return computeClientNodeState(clientName, clientTasks);
  }, [tasks]);

  return {
    updateTaskWithCascade,
    updateStepWithCascade,
    insights,
    getClientNodeState,
  };
}
