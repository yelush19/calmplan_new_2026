/**
 * ── Dependency Engine: Logical AND Rule for Convergence Tasks ──
 *
 * Implements the "AND" Rule:
 * If a task has multiple prerequisites (Next Steps) leading to one Convergence Task,
 * the convergence task remains Locked 🔒 until ALL prerequisites are marked 'Done'
 * (status === 'production_completed').
 *
 * Example: VAT + Bank Adjustments → P&L Report
 *   P&L stays locked until BOTH VAT and Adjustments are production_completed.
 *
 * Data Model:
 *   task.dependencies = ['task_id_1', 'task_id_2']  // prerequisite task IDs
 *   task.is_convergence = true                       // marks this as a convergence task
 */

/**
 * Check if all dependencies of a task are satisfied (all completed)
 * @param {Object} task - The convergence task to check
 * @param {Object[]} allTasks - Full list of tasks
 * @returns {{ locked: boolean, satisfied: string[], pending: string[], total: number }}
 */
export function checkDependencies(task, allTasks) {
  const deps = task?.dependencies || [];
  if (deps.length === 0) {
    return { locked: false, satisfied: [], pending: [], total: 0 };
  }

  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const satisfied = [];
  const pending = [];

  deps.forEach(depId => {
    const depTask = taskMap.get(depId);
    if (depTask && depTask.status === 'production_completed') {
      satisfied.push(depId);
    } else {
      pending.push(depId);
    }
  });

  return {
    locked: pending.length > 0,
    satisfied,
    pending,
    total: deps.length,
  };
}

/**
 * Get lock status for all convergence tasks in a list
 * @param {Object[]} tasks - Full task list
 * @returns {Map<string, { locked, satisfied, pending, total }>}
 */
export function buildDependencyMap(tasks) {
  const map = new Map();
  tasks.forEach(task => {
    if (task.dependencies && task.dependencies.length > 0) {
      map.set(task.id, checkDependencies(task, tasks));
    }
  });
  return map;
}

/**
 * Find all tasks that depend on a given task (reverse lookup)
 * Used to notify downstream tasks when a prerequisite is completed
 * @param {string} taskId - The completed task ID
 * @param {Object[]} allTasks - Full task list
 * @returns {Object[]} Tasks that list taskId as a dependency
 */
export function findDependentTasks(taskId, allTasks) {
  return allTasks.filter(t =>
    t.dependencies && t.dependencies.includes(taskId)
  );
}

/**
 * Auto-unlock convergence tasks when all prerequisites are met
 * Returns list of task IDs that should be unlocked
 * @param {Object[]} tasks - Full task list
 * @returns {string[]} IDs of tasks that are now unlocked
 */
export function getNewlyUnlockedTasks(tasks) {
  const unlocked = [];
  tasks.forEach(task => {
    if (!task.dependencies || task.dependencies.length === 0) return;
    if (task.status === 'production_completed') return; // already done
    const result = checkDependencies(task, tasks);
    if (!result.locked && task._wasLocked) {
      unlocked.push(task.id);
    }
  });
  return unlocked;
}

/**
 * Standard dependency templates for common workflows
 * Used by task generation to auto-create dependency links
 */
export const DEPENDENCY_TEMPLATES = {
  // P&L depends on VAT + Reconciliation
  'profit_and_loss': {
    label: 'רווח והפסד',
    prerequisites: ['vat_monthly', 'bank_reconciliation'],
    description: 'רווח והפסד תלוי בהשלמת מע"מ + התאמות בנק',
  },
  // Annual report depends on all monthly P&Ls
  'annual_report': {
    label: 'דוח שנתי',
    prerequisites: ['profit_and_loss_q1', 'profit_and_loss_q2', 'profit_and_loss_q3', 'profit_and_loss_q4'],
    description: 'דוח שנתי תלוי בהשלמת כל הרבעונים',
  },
  // Payroll submission depends on payroll prep + social security calc
  'payroll_submission': {
    label: 'הגשת שכר',
    prerequisites: ['payroll_prep', 'social_security_calc'],
    description: 'הגשת שכר תלויה בהכנת שכר + חישוב ביטוח לאומי',
  },
};
