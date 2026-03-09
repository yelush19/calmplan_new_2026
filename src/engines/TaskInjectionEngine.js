/**
 * ── Task Injection Engine ──
 *
 * Auto-injects follow-up / recurring tasks based on service DNA definitions.
 *
 * Usage:
 *   import { processCompletedTask, injectRecurringTasks } from '@/engines/TaskInjectionEngine';
 *
 *   // When a task is marked as production_completed:
 *   await processCompletedTask(completedTask);
 *
 *   // On app startup — inject any due recurring tasks:
 *   await injectRecurringTasks();
 */

import { Task } from '@/api/entities';
import { ALL_SERVICES, getServiceForTask } from '@/config/processTemplates';

// ── Follow-Up Rules ──
// When a task of a certain service completes, optionally inject a follow-up.
// delayDays: how many days after completion to set the new due date.
const FOLLOW_UP_RULES = {
  bank_reconciliation: {
    trigger: 'production_completed',
    delayDays: 7,
    newTitle: (src) => `${src.client_name} — בדיקת סנכרון בנק (מעקב)`,
    newCategory: 'התאמות',
    newBranch: 'P2',
    newPriority: 'medium',
    newDescription: 'מעקב אוטומטי: וידוא שהתאמת הבנק תקינה 7 ימים לאחר השלמה.',
    newTags: ['auto-followup', 'reconciliation'],
  },
  payroll: {
    trigger: 'production_completed',
    delayDays: 30,
    newTitle: (src) => `${src.client_name} — שכר חודשי (חוזר)`,
    newCategory: 'שכר',
    newBranch: 'P1',
    newPriority: 'high',
    newDescription: 'משימה חוזרת: הכנת שכר חודשי.',
    newTags: ['auto-recurring', 'payroll'],
  },
  vat: {
    trigger: 'production_completed',
    delayDays: 30,
    newTitle: (src) => `${src.client_name} — דיווח מע"מ (חודשי)`,
    newCategory: 'מע"מ',
    newBranch: 'P1',
    newPriority: 'high',
    newDescription: 'משימה חוזרת: דיווח מע"מ חודשי.',
    newTags: ['auto-recurring', 'vat'],
  },
  tax_advances: {
    trigger: 'production_completed',
    delayDays: 30,
    newTitle: (src) => `${src.client_name} — מקדמות מס הכנסה (חודשי)`,
    newCategory: 'מקדמות מס',
    newBranch: 'P1',
    newPriority: 'medium',
    newDescription: 'משימה חוזרת: חישוב ודיווח מקדמות.',
    newTags: ['auto-recurring', 'tax-advances'],
  },
};

/**
 * Add any custom follow-up rules at runtime.
 */
export function registerFollowUpRule(serviceKey, rule) {
  FOLLOW_UP_RULES[serviceKey] = rule;
}

/**
 * Get all registered follow-up rules (for display in AutomationPage).
 */
export function getFollowUpRules() {
  return { ...FOLLOW_UP_RULES };
}

// ── Helpers ──

function addDays(dateStr, days) {
  const d = new Date(dateStr || Date.now());
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function taskExists(title, clientName, afterDate) {
  try {
    const existing = await Task.filter({ client_name: clientName });
    return existing.some(
      (t) => t.title === title && t.created_date >= afterDate
    );
  } catch {
    return false;
  }
}

// ── Core API ──

/**
 * Called when a task reaches `production_completed`.
 * Checks follow-up rules and injects a new task if one is defined.
 *
 * @param {Object} completedTask — the task that was just completed
 * @returns {Object|null} the newly created follow-up task, or null
 */
export async function processCompletedTask(completedTask) {
  if (!completedTask) return null;

  const service = getServiceForTask(completedTask);
  if (!service) return null;

  const rule = FOLLOW_UP_RULES[service.key];
  if (!rule) return null;
  if (rule.trigger && completedTask.status !== rule.trigger) return null;

  const newTitle =
    typeof rule.newTitle === 'function'
      ? rule.newTitle(completedTask)
      : rule.newTitle;

  // Avoid duplicates
  const today = new Date().toISOString().slice(0, 10);
  const alreadyExists = await taskExists(newTitle, completedTask.client_name, today);
  if (alreadyExists) {
    console.log(`[TaskInjectionEngine] Follow-up already exists: "${newTitle}"`);
    return null;
  }

  const dueDate = addDays(today, rule.delayDays);

  const newTask = await Task.create({
    title: newTitle,
    description: rule.newDescription || '',
    client_name: completedTask.client_name,
    category: rule.newCategory || completedTask.category,
    branch: rule.newBranch || completedTask.branch,
    priority: rule.newPriority || 'medium',
    status: 'not_started',
    due_date: dueDate,
    tags: [...(rule.newTags || []), 'injected'],
    source_task_id: completedTask.id,
  });

  console.log(`[TaskInjectionEngine] Injected: "${newTitle}" due ${dueDate}`);
  return newTask;
}

/**
 * Scans all recently-completed tasks (last 7 days) and injects any
 * missing follow-ups. Safe to call on every app startup.
 */
export async function injectRecurringTasks() {
  try {
    const allTasks = await Task.list();
    const sevenDaysAgo = addDays(new Date().toISOString(), -7);

    const recentlyCompleted = allTasks.filter(
      (t) =>
        t.status === 'production_completed' &&
        t.updated_date >= sevenDaysAgo
    );

    const results = [];
    for (const task of recentlyCompleted) {
      const result = await processCompletedTask(task);
      if (result) results.push(result);
    }

    if (results.length > 0) {
      console.log(`[TaskInjectionEngine] Startup injection: ${results.length} task(s) created.`);
    }
    return results;
  } catch (err) {
    console.error('[TaskInjectionEngine] Error during recurring injection:', err);
    return [];
  }
}
