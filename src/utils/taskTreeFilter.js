/**
 * Unified task filter: returns only tasks that belong to the P1-P4 tree
 * and fall within the active period (current + previous month, or active status).
 *
 * This is the SINGLE SOURCE OF TRUTH for task counts across all views:
 * Dashboard, MindMap hub counter, QuickStats widget, Task page stats.
 */

// Map every known category to its P-branch
const CATEGORY_TO_P_BRANCH = {
  // P1 — Payroll
  'שכר': 'P1', 'work_payroll': 'P1',
  'ביטוח לאומי': 'P1', 'work_social_security': 'P1',
  'ניכויים': 'P1', 'work_deductions': 'P1',
  // P2 — Bookkeeping
  'מע"מ': 'P2', 'work_vat_reporting': 'P2',
  'מע"מ 874': 'P2', 'work_vat_874': 'P2',
  'מקדמות מס': 'P2', 'work_tax_advances': 'P2',
  'התאמות': 'P2', 'work_reconciliation': 'P2',
  'הנחש': 'P2', 'הנהלת חשבונות': 'P2', 'work_bookkeeping': 'P2',
  'מאזנים': 'P2',
  // P3 — Office / Admin
  'דוח שנתי': 'P3', 'work_client_management': 'P3', 'work_annual_reports': 'P3',
  'personal': 'P3', 'אחר': 'P3',
  // P4 — Home
  'home': 'P4',
};

const P_BRANCH_LABELS = {
  'P1': 'P1 חשבות שכר',
  'P2': 'P2 הנהלת חשבונות',
  'P3': 'P3 ניהול משרד',
  'P4': 'P4 בית',
};

/**
 * Get the P-branch (P1/P2/P3/P4) for a task based on its category and context.
 * Returns null if the task doesn't belong to any branch (ghost task).
 */
export function getTaskPBranch(task) {
  if (!task) return null;
  const cat = task.category;
  if (cat && CATEGORY_TO_P_BRANCH[cat]) {
    return CATEGORY_TO_P_BRANCH[cat];
  }
  // Fallback: home context → P4, work context → P3 (admin catch-all)
  if (task.context === 'home') return 'P4';
  if (task.context === 'work' || !task.context) return 'P3';
  return null;
}

export function getPBranchLabel(pBranch) {
  return P_BRANCH_LABELS[pBranch] || pBranch || 'לא משויך';
}

/**
 * Filter tasks to active period only:
 * - Current month + previous month (by due_date)
 * - OR active status (no due_date but not completed/irrelevant)
 * - Exclude 31/5 annual ghost tasks
 * - Rule of 31: include tasks within 62-day window (2 full months)
 */
export function filterActivePeriodTasks(tasks) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Previous month
  const prevDate = new Date(currentYear, currentMonth - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();

  // Next month (for payroll tasks that have next-month deadlines)
  const nextDate = new Date(currentYear, currentMonth + 1, 1);
  const nextYear = nextDate.getFullYear();
  const nextMonth = nextDate.getMonth();

  const prevMonthPrefix = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
  const currMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const nextMonthPrefix = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;

  const filtered = (tasks || []).filter(task => {
    // Exclude 31/5 annual ghost tasks
    if (task.due_date?.endsWith('-05-31') && (
      task.title?.includes('דוח שנתי') ||
      task.category === 'work_client_management' ||
      task.category === 'דוח שנתי'
    )) {
      return false;
    }

    const dd = task.due_date;
    if (dd) {
      const monthPrefix = dd.substring(0, 7); // "YYYY-MM"
      // In previous, current, or next month → include (3-month window)
      if (monthPrefix === currMonthPrefix || monthPrefix === prevMonthPrefix || monthPrefix === nextMonthPrefix) return true;
      // Completed tasks outside active window → exclude
      if (task.status === 'production_completed') return false;
      // Wider window: 93 days each direction (3 full months)
      const taskDate = new Date(dd);
      const daysDiff = (taskDate - now) / (1000 * 60 * 60 * 24);
      return daysDiff >= -93 && daysDiff <= 93;
    }

    // No due date: include if active (not completed/irrelevant)
    return task.status !== 'production_completed';
  });

  return filtered;
}

/**
 * The unified filter: P1-P4 tree membership + active period.
 * Use this everywhere you need a canonical task count.
 *
 * ══ DATA SURVIVAL RULE ══
 * NEVER return [] when the input has tasks. If filtering kills
 * everything, bypass and return all valid tasks unfiltered.
 * An "unorganized" screen is always better than an empty one.
 */
export function getActiveTreeTasks(tasks) {
  if (!tasks || tasks.length === 0) return [];

  const activePeriod = filterActivePeriodTasks(tasks);
  const treeTasks = activePeriod.filter(t => getTaskPBranch(t) !== null);

  // DATA SURVIVAL: if tree filter killed everything, return raw tasks
  if (treeTasks.length === 0 && tasks.length > 0) {
    console.warn('[DATA SURVIVAL] getActiveTreeTasks filtered', tasks.length, '→ 0. Returning all tasks.');
    return tasks;
  }

  return treeTasks;
}

export { CATEGORY_TO_P_BRANCH, P_BRANCH_LABELS };
