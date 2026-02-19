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
} from '@/engines/taskCascadeEngine';
import {
  getServiceForTask,
  getTaskProcessSteps,
  toggleStep,
} from '@/config/processTemplates';

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

    // Run cascade
    const cascade = processTaskCascade(merged, steps, siblings);

    // Apply status from cascade if the update didn't already set status
    const finalUpdates = { ...updates };
    if (cascade.statusUpdate && !updates.status) {
      finalUpdates.status = cascade.statusUpdate.status;
    }

    // Optimistic update local state
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...finalUpdates } : t
    ));

    // Persist to backend
    try {
      await Task.update(taskId, { ...task, ...finalUpdates });

      // Auto-create triggered tasks
      if (cascade.tasksToCreate?.length > 0) {
        const existingTitles = new Set(tasks.map(t => t.title));

        for (const newTask of cascade.tasksToCreate) {
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
    const cascade = processTaskCascade(merged, updatedSteps, siblings);

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
