/**
 * ── Automation Engine: Sequence, Archive, Status Sync, Cognitive Load ──
 *
 * 5 automation modules:
 *   1. Sequence Engine — auto-unlock tasks when prerequisites complete
 *   2. Auto-Archive — move completed tasks to archive after 24h
 *   3. Status Sync — detect active sub-tasks for parent branch pulse
 *   4. Cognitive Load — compute daily load vs threshold
 *   5. Automation Log — record all automated actions
 *
 * All automations respect the global "automationsPaused" toggle.
 * Log is stored in localStorage for UI display.
 */

import { Task } from '@/api/entities';

const LOG_KEY = 'calmplan_automation_log';
const MAX_LOG_ENTRIES = 200;

// ═══════════════════════════════════════════════
// AUTOMATION LOG
// ═══════════════════════════════════════════════

export function getAutomationLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  } catch { return []; }
}

export function logAutomation(action, details = {}) {
  try {
    const log = getAutomationLog();
    log.unshift({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      action,
      ...details,
      timestamp: new Date().toISOString(),
    });
    // Keep only last N entries
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)));
  } catch { /* ignore */ }
}

export function clearAutomationLog() {
  localStorage.removeItem(LOG_KEY);
}

// ═══════════════════════════════════════════════
// 1. SEQUENCE ENGINE — Auto-Unlock Prerequisites
// ═══════════════════════════════════════════════

/**
 * When a task is marked as done, check if any other task was
 * waiting for it as a prerequisite. If so, "unlock" the dependent task.
 *
 * @param {Object} completedTask — the task that was just completed
 * @param {Object[]} allTasks — all tasks in the system
 * @param {boolean} paused — global automation pause toggle
 * @returns {Object[]} — list of tasks that were unlocked
 */
export async function processSequenceUnlock(completedTask, allTasks, paused = false) {
  if (paused) return [];
  if (completedTask.status !== 'production_completed') return [];

  const unlocked = [];

  // Find tasks that reference this task as a dependency/prerequisite
  const dependents = allTasks.filter(t => {
    if (t.status === 'production_completed') return false;
    // MSB collectors: only unlock via dependency_ids (multi-parent check)
    if (t.is_collector) {
      return Array.isArray(t.dependency_ids) && t.dependency_ids.includes(completedTask.id);
    }
    // Regular tasks: check triggered_by, master_task_id, or dependency_ids
    if (t.master_task_id === completedTask.id) return true;
    if (t.triggered_by === completedTask.id) return true;
    if (Array.isArray(t.dependency_ids) && t.dependency_ids.includes(completedTask.id)) return true;
    // Same client, same month, and was waiting_for_materials
    if (t.client_name === completedTask.client_name &&
        t.reporting_month === completedTask.reporting_month &&
        t.status === 'waiting_for_materials') {
      return true;
    }
    return false;
  });

  for (const dep of dependents) {
    // AND RULE: Check if ALL prerequisites for this task are now met
    const allPrereqsMet = checkAllPrerequisitesMet(dep, allTasks);
    // Unlock tasks that are locked (waiting_for_materials OR not_started with deps)
    const isLocked = dep.status === 'waiting_for_materials' ||
      (dep.status === 'not_started' && Array.isArray(dep.dependency_ids) && dep.dependency_ids.length > 0);
    if (allPrereqsMet && isLocked) {
      try {
        await Task.update(dep.id, { ...dep, status: 'not_started' });
        unlocked.push(dep);
        logAutomation('task_unlocked', {
          taskId: dep.id,
          taskTitle: dep.title,
          unlockedBy: completedTask.title,
          rule: 'AND_GATE',
          prerequisiteCount: dep.dependency_ids?.length || 0,
        });
      } catch { /* skip */ }
    }
  }

  return unlocked;
}

/**
 * AND RULE: Check if ALL prerequisites (dependency_ids) are completed.
 * A task with N prerequisites remains LOCKED until every one is 'production_completed'.
 */
function checkAllPrerequisitesMet(task, allTasks) {
  if (!task.dependency_ids || task.dependency_ids.length === 0) return true;
  return task.dependency_ids.every(depId => {
    const depTask = allTasks.find(t => t.id === depId);
    return depTask && depTask.status === 'production_completed';
  });
}

/**
 * isTaskLocked — UI helper: returns true if a task has unmet prerequisites.
 * Use this to visually lock tasks on kanban/lists/maps.
 */
export function isTaskLocked(task, allTasks) {
  if (!task.dependency_ids || task.dependency_ids.length === 0) return false;
  return !checkAllPrerequisitesMet(task, allTasks);
}

/**
 * getPrerequisiteStatus — returns detailed AND gate state for a task.
 * { locked, total, completed, pending: [{ id, title, status }] }
 */
export function getPrerequisiteStatus(task, allTasks) {
  if (!task.dependency_ids || task.dependency_ids.length === 0) {
    return { locked: false, total: 0, completed: 0, pending: [] };
  }
  const total = task.dependency_ids.length;
  let completed = 0;
  const pending = [];
  for (const depId of task.dependency_ids) {
    const dep = allTasks.find(t => t.id === depId);
    if (dep && dep.status === 'production_completed') {
      completed++;
    } else {
      pending.push({
        id: depId,
        title: dep?.title || depId,
        status: dep?.status || 'unknown',
      });
    }
  }
  return { locked: completed < total, total, completed, pending };
}

/**
 * runConditionalFlowCheck — Scan all tasks and lock/unlock based on AND rule.
 * Called on startup or after batch operations to ensure consistency.
 */
export async function runConditionalFlowCheck(allTasks, paused = false) {
  if (paused) return { locked: 0, unlocked: 0 };
  let locked = 0;
  let unlocked = 0;

  for (const task of allTasks) {
    if (task.status === 'production_completed' || task.context === 'archived') continue;
    if (!task.dependency_ids || task.dependency_ids.length === 0) continue;

    const allMet = checkAllPrerequisitesMet(task, allTasks);

    if (!allMet && task.status === 'not_started') {
      // Lock: set to waiting_for_materials
      try {
        await Task.update(task.id, { ...task, status: 'waiting_for_materials' });
        locked++;
        logAutomation('task_locked_by_and_rule', {
          taskId: task.id, taskTitle: task.title,
          unmetCount: task.dependency_ids.length - task.dependency_ids.filter(id => {
            const d = allTasks.find(t => t.id === id);
            return d && d.status === 'production_completed';
          }).length,
        });
      } catch { /* skip */ }
    } else if (allMet && task.status === 'waiting_for_materials') {
      // Unlock: all prerequisites met
      try {
        await Task.update(task.id, { ...task, status: 'not_started' });
        unlocked++;
        logAutomation('task_unlocked_by_and_rule', {
          taskId: task.id, taskTitle: task.title,
        });
      } catch { /* skip */ }
    }
  }

  return { locked, unlocked };
}

// ═══════════════════════════════════════════════
// 2. AUTO-ARCHIVE — Move completed tasks after 24h
// ═══════════════════════════════════════════════

/**
 * Scan all tasks and archive those completed more than 24h ago.
 * "Archive" = set context to 'archived' (preserves data, hides from active views).
 *
 * @param {Object[]} allTasks
 * @param {boolean} paused
 * @returns {number} — count of archived tasks
 */
export async function processAutoArchive(allTasks, paused = false) {
  if (paused) return 0;

  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  let archived = 0;

  for (const task of allTasks) {
    if (task.status !== 'production_completed') continue;
    if (task.context === 'archived') continue;

    // Check when it was completed (use updated_at or completed_at)
    const completedAt = task.completed_at || task.updated_at;
    if (!completedAt) continue;

    const elapsed = now - new Date(completedAt).getTime();
    if (elapsed >= TWENTY_FOUR_HOURS) {
      try {
        await Task.update(task.id, { ...task, context: 'archived' });
        archived++;
        logAutomation('task_archived', {
          taskId: task.id,
          taskTitle: task.title,
          hoursAfterCompletion: Math.round(elapsed / 3600000),
        });
      } catch { /* skip */ }
    }
  }

  return archived;
}

// ═══════════════════════════════════════════════
// 3. STATUS SYNC — Detect active sub-tasks for parent pulse
// ═══════════════════════════════════════════════

/**
 * Find branches (P1-P5 categories) that have at least one
 * sub-task currently "in_progress" or "needs_corrections".
 * These branches should visually pulse in the MindMap.
 *
 * @param {Object[]} allTasks
 * @returns {Set<string>} — set of active branch categories
 */
export function getActiveBranches(allTasks) {
  const active = new Set();
  const ACTIVE_STATUSES = ['in_progress', 'needs_corrections'];

  for (const task of allTasks) {
    if (ACTIVE_STATUSES.includes(task.status)) {
      if (task.category) active.add(task.category);
      if (task.branch) active.add(task.branch);
    }
  }
  return active;
}

// ═══════════════════════════════════════════════
// 4. COGNITIVE LOAD — Compute daily load vs threshold
// ═══════════════════════════════════════════════

/**
 * Compute total cognitive load (minutes) for today's active tasks.
 *
 * @param {Object[]} todayTasks — tasks due today or in focus
 * @param {number} threshold — max allowed minutes (from settings)
 * @returns {{ total: number, threshold: number, overloaded: boolean, percentage: number }}
 */
export function computeCognitiveLoad(todayTasks, threshold = 480) {
  let total = 0;
  for (const t of todayTasks) {
    if (t.status === 'production_completed' || t.status === 'cancelled') continue;
    total += (t.duration || t.estimated_minutes || 15); // default 15 min per task
  }
  return {
    total,
    threshold,
    overloaded: total > threshold,
    percentage: threshold > 0 ? Math.round((total / threshold) * 100) : 0,
  };
}

// ═══════════════════════════════════════════════
// 5. MASTER RUNNER — Runs all automations (called from useEffect)
// ═══════════════════════════════════════════════

/**
 * Run all background automations. Called once per session or on task changes.
 * Respects the global pause toggle.
 *
 * @param {Object[]} allTasks
 * @param {boolean} paused
 * @returns {{ archived: number, unlockedCount: number }}
 */
export async function runAllAutomations(allTasks, paused = false) {
  if (paused) return { archived: 0, unlockedCount: 0, andRuleLocked: 0, andRuleUnlocked: 0 };

  const archived = await processAutoArchive(allTasks, paused);
  const andResult = await runConditionalFlowCheck(allTasks, paused);

  return {
    archived,
    unlockedCount: andResult.unlocked,
    andRuleLocked: andResult.locked,
    andRuleUnlocked: andResult.unlocked,
  };
}
