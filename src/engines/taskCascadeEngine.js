/**
 * Task Cascade Engine
 *
 * The "Nervous System" of CalmPlan.
 * Implements professional state-machine logic for task cascading:
 *
 * 1. Tax/VAT State Machine:
 *    - Income + Expenses done → Ready for Production
 *    - Income done + Advances client → Ready for Filing
 *    - Only one done → Pending Completion (in_progress)
 *
 * 2. Payroll Pipeline (Linear):
 *    Data Entry → Processing → Review → Client Revision → Final Distribution
 *    Post-distribution auto-generates: Social Security, Deductions, Journal Entry, MAsav
 *
 * 3. Relay Tasks (pending_external):
 *    Reserve Duty: Claim Filed → Pending Funds (blue)
 *    Consultants: Data sent → pending_external until reply
 *
 * 4. Proactive Insights:
 *    Computes ADHD-friendly summaries: "3 clients need VAT production"
 */

import {
  TAX_SERVICES,
  PAYROLL_SERVICES,
  ADDITIONAL_SERVICES,
  ALL_SERVICES,
  getServiceForTask,
} from '@/config/processTemplates';

// ============================================================
// CONSTANTS
// ============================================================

// Categories that are "relay" / external-dependent
const RELAY_CATEGORIES = new Set([
  'מילואים', 'work_reserve_claims',
  'ייעוץ', 'work_consulting',
]);

// Categories where pending_external applies after submission
const EXTERNAL_AFTER_SUBMIT = new Set([
  'מילואים', 'work_reserve_claims',
]);

// Consultant-related categories
const CONSULTANT_CATEGORIES = new Set([
  'ייעוץ', 'work_consulting',
]);

// Payroll final distribution step key
const PAYROLL_FINAL_STEP = 'authority_payments';

// Services auto-generated after payroll final distribution
const POST_PAYROLL_SERVICES = [
  { serviceKey: 'social_security', title: 'ביטוח לאומי וניכויים' },
  { serviceKey: 'deductions',      title: 'ניכויים' },
  { serviceKey: 'masav_social',    title: 'מס"ב סוציאליות' },
];

// ============================================================
// PAYROLL COMPLEXITY TIERS
// ============================================================

/**
 * Payroll complexity tiers based on employee count.
 * Determines UI treatment, workflow depth, and ADHD optimizations.
 */
export const PAYROLL_TIERS = {
  nano:       { key: 'nano',       label: 'Nano',       range: [1, 5],    emoji: '⚡', fastTrack: true,  focusMode: false },
  small:      { key: 'small',      label: 'Small',      range: [5, 15],   emoji: '',   fastTrack: false, focusMode: false },
  mid:        { key: 'mid',        label: 'Mid',        range: [15, 30],  emoji: '',   fastTrack: false, focusMode: false },
  enterprise: { key: 'enterprise', label: 'Enterprise', range: [30, 999], emoji: '',   fastTrack: false, focusMode: true  },
};

/**
 * Determine payroll complexity tier based on employee count.
 * Uses client.employee_count or falls back to 'small'.
 *
 * @param {Object} client - Client entity (needs employee_count field)
 * @returns {Object} tier from PAYROLL_TIERS
 */
export function getPayrollTier(client) {
  const count = client?.employee_count || client?.business_info?.employee_count || 0;
  if (count <= 5) return PAYROLL_TIERS.nano;
  if (count <= 15) return PAYROLL_TIERS.small;
  if (count <= 30) return PAYROLL_TIERS.mid;
  return PAYROLL_TIERS.enterprise;
}

/**
 * Determine task complexity level for reconciliations/balance sheets.
 * Uses the task's complexity field or client.complexity_level.
 *
 * @param {Object} task - Task entity
 * @param {Object} client - Client entity
 * @returns {'low'|'medium'|'high'}
 */
export function getTaskComplexity(task, client) {
  if (task?.complexity) return task.complexity;
  if (client?.complexity_level) return client.complexity_level;
  if (client?.business_info?.complexity_level) return client.business_info.complexity_level;
  return 'low';
}

// ============================================================
// VAT ENERGY TIERS (ADHD Optimization)
// ============================================================

/**
 * VAT energy tiers based on estimated_duration.
 * Determines UI treatment and auto-split behavior.
 */
export const VAT_ENERGY_TIERS = {
  quick_win:        { key: 'quick_win',        label: 'Quick Win',          range: [0, 20],  emoji: '⚡', autoSplit: false },
  standard:         { key: 'standard',         label: 'Standard Pomodoro',  range: [20, 45], emoji: '',   autoSplit: false },
  climb:            { key: 'climb',            label: 'The Climb',          range: [45, 999],emoji: '',   autoSplit: true },
};

/**
 * Determine VAT energy tier based on estimated duration.
 *
 * @param {Object} task - Task with estimated_duration (minutes)
 * @returns {Object} tier from VAT_ENERGY_TIERS
 */
export function getVatEnergyTier(task) {
  const duration = task?.estimated_duration || 0;
  if (duration <= 20) return VAT_ENERGY_TIERS.quick_win;
  if (duration <= 45) return VAT_ENERGY_TIERS.standard;
  return VAT_ENERGY_TIERS.climb;
}

/**
 * Generate auto-split sub-tasks for "The Climb" tier (45+ min).
 * Splits a large VAT task into 2-3 batched sub-tasks.
 *
 * @param {Object} task - The VAT task to split
 * @returns {Object[]} sub-tasks array to set on the task
 */
export function generateVatAutoSplit(task) {
  const duration = task?.estimated_duration || 60;
  const sessionLength = 25; // Pomodoro length
  const sessions = Math.ceil(duration / sessionLength);
  const batches = Math.min(sessions, 3); // max 3 sub-tasks

  const subtasks = [];
  for (let i = 0; i < batches; i++) {
    const isLast = i === batches - 1;
    subtasks.push({
      id: `auto_${Date.now()}_${i}`,
      title: isLast ? 'סקירה סופית והגשה' : `אצווה ${i + 1} - קליטת נתונים`,
      done: false,
      priority: 'medium',
    });
  }
  return subtasks;
}

// ============================================================
// 1. TAX / VAT STATE MACHINE
// ============================================================

/**
 * Evaluate VAT task status based on process steps.
 * Returns a suggested status update or null if no change needed.
 *
 * @param {Object} task - The VAT task being updated
 * @param {Object} updatedSteps - The new process_steps after the change
 * @param {Object[]} clientTasks - All tasks for the same client in the same reporting month
 * @returns {{ status: string } | null}
 */
export function evaluateVatStatus(task, updatedSteps) {
  const service = getServiceForTask(task);
  if (!service || service.key !== 'vat') return null;

  const incomeInput = updatedSteps?.income_input?.done;
  const expenseInput = updatedSteps?.expense_input?.done;
  const reportPrep = updatedSteps?.report_prep?.done;
  const submission = updatedSteps?.submission?.done;

  // All done = completed
  if (submission) {
    return { status: 'completed' };
  }

  // Report prep done = ready for reporting (filing)
  if (reportPrep) {
    return { status: 'ready_for_reporting' };
  }

  // Both income + expense done = ready for production
  if (incomeInput && expenseInput) {
    return { status: 'ready_for_reporting' };
  }

  // Only one done = in progress
  if (incomeInput || expenseInput) {
    return { status: 'in_progress' };
  }

  return null;
}

/**
 * Evaluate tax advances status.
 * If the client's income is already entered (VAT income step done),
 * advances can be filed.
 *
 * @param {Object} task - The tax advances task
 * @param {Object} updatedSteps - The new process_steps
 * @param {Object[]} siblingTasks - All tasks for same client+month
 * @returns {{ status: string } | null}
 */
export function evaluateTaxAdvancesStatus(task, updatedSteps, siblingTasks) {
  const service = getServiceForTask(task);
  if (!service || service.key !== 'tax_advances') return null;

  // Check if the VAT income task is done for this client
  const vatTask = siblingTasks.find(t => {
    const s = getServiceForTask(t);
    return s?.key === 'vat' && t.client_name === task.client_name;
  });

  const vatIncomesDone = vatTask?.process_steps?.income_input?.done;

  if (vatIncomesDone && updatedSteps?.calculation?.done) {
    return { status: 'ready_for_reporting' };
  }

  if (updatedSteps?.submission?.done) {
    return { status: 'completed' };
  }

  return null;
}

// ============================================================
// 2. PAYROLL PIPELINE (LINEAR ENGINE)
// ============================================================

/**
 * Ordered payroll steps for sequential enforcement.
 * A step can only be marked done if all previous steps are done.
 */
const PAYROLL_STEP_ORDER = [
  'receive_data',
  'prepare_payslips',
  'proofreading',
  'salary_entry',
  'employee_payments',
  'authority_payments',
];

/**
 * Evaluate payroll task status based on sequential step completion.
 *
 * @param {Object} task - The payroll task
 * @param {Object} updatedSteps - The new process_steps
 * @returns {{ status: string, autoCreateTasks?: Object[] } | null}
 */
export function evaluatePayrollStatus(task, updatedSteps) {
  const service = getServiceForTask(task);
  if (!service || service.key !== 'payroll') return null;

  // Count completed steps in order
  let lastDoneIndex = -1;
  for (let i = 0; i < PAYROLL_STEP_ORDER.length; i++) {
    const stepKey = PAYROLL_STEP_ORDER[i];
    if (updatedSteps?.[stepKey]?.done) {
      lastDoneIndex = i;
    } else {
      break; // Stop at first incomplete step (sequential)
    }
  }

  const result = {};

  // All steps done = final distribution complete
  if (lastDoneIndex === PAYROLL_STEP_ORDER.length - 1) {
    result.status = 'completed';
    // Auto-create post-distribution tasks
    result.autoCreateTasks = POST_PAYROLL_SERVICES.map(svc => ({
      serviceKey: svc.serviceKey,
      title: `${svc.title} - ${task.client_name}`,
      client_name: task.client_name,
      client_id: task.client_id,
      category: ALL_SERVICES[svc.serviceKey]?.createCategory || svc.title,
      status: 'not_started',
      due_date: task.due_date,
      reporting_month: task.reporting_month,
      context: 'work',
      triggered_by: task.id,
    }));
    return result;
  }

  // Proofreading done = in review / waiting for approval
  if (lastDoneIndex >= 2) { // proofreading index = 2
    result.status = 'waiting_for_approval';
    return result;
  }

  // Some steps done = in progress
  if (lastDoneIndex >= 0) {
    result.status = 'in_progress';
    return result;
  }

  return null;
}

// ============================================================
// 3. RELAY / EXTERNAL TASKS
// ============================================================

/**
 * Evaluate if a task should transition to pending_external.
 *
 * Reserve Duty: After claim_submit step → pending_external (waiting for funds)
 * Consultants: After sending data for review → pending_external
 *
 * @param {Object} task - The task being evaluated
 * @param {Object} updatedSteps - The new process_steps
 * @returns {{ status: string } | null}
 */
export function evaluateRelayStatus(task, updatedSteps) {
  if (!task?.category) return null;

  // Reserve Duty: claim submitted → pending_external (waiting for funds)
  if (EXTERNAL_AFTER_SUBMIT.has(task.category)) {
    // New flow: claim_submit → pending_funds (blue) → follow_up (back to action)
    if (updatedSteps?.pending_funds?.done && updatedSteps?.follow_up?.done) {
      return { status: 'completed' };
    }
    if (updatedSteps?.pending_funds?.done || (updatedSteps?.claim_submit?.done && !updatedSteps?.follow_up?.done)) {
      return { status: 'pending_external' };
    }
    if (updatedSteps?.follow_up?.done) {
      return { status: 'completed' };
    }
  }

  // Consultants: consultation done but summary not → pending_external
  if (CONSULTANT_CATEGORIES.has(task.category)) {
    if (updatedSteps?.consultation?.done && !updatedSteps?.summary?.done) {
      return { status: 'pending_external' };
    }
    if (updatedSteps?.summary?.done) {
      return { status: 'completed' };
    }
  }

  return null;
}

// ============================================================
// MASTER CASCADE PROCESSOR
// ============================================================

/**
 * Process a task update through all cascade rules.
 * Returns an object describing all side effects.
 *
 * @param {Object} task - The updated task (with new values)
 * @param {Object} updatedSteps - The task's new process_steps
 * @param {Object[]} siblingTasks - All tasks for same client + reporting month
 * @returns {Object} { statusUpdate, tasksToCreate, tasksToUpdate }
 */
export function processTaskCascade(task, updatedSteps, siblingTasks = []) {
  const result = {
    statusUpdate: null,     // { status: string } or null
    tasksToCreate: [],      // new tasks to auto-generate
    tasksToUpdate: [],      // sibling tasks to modify
  };

  const service = getServiceForTask(task);
  if (!service) return result;

  // Run the appropriate state machine
  let evaluation = null;

  switch (service.key) {
    case 'vat':
      evaluation = evaluateVatStatus(task, updatedSteps);
      break;

    case 'tax_advances':
      evaluation = evaluateTaxAdvancesStatus(task, updatedSteps, siblingTasks);
      break;

    case 'payroll':
      evaluation = evaluatePayrollStatus(task, updatedSteps);
      break;

    case 'reserve_claims':
    case 'consulting':
      evaluation = evaluateRelayStatus(task, updatedSteps);
      break;

    default:
      // Generic: all steps done = completed
      if (service.steps.length > 0) {
        const allDone = service.steps.every(s => updatedSteps?.[s.key]?.done);
        if (allDone) {
          evaluation = { status: 'completed' };
        } else if (service.steps.some(s => updatedSteps?.[s.key]?.done)) {
          evaluation = { status: 'in_progress' };
        }
      }
      break;
  }

  if (evaluation) {
    // Don't downgrade from completed to in_progress
    if (task.status === 'completed' && evaluation.status !== 'completed') {
      // Allow downgrade only if user explicitly changes
    } else {
      result.statusUpdate = { status: evaluation.status };
    }

    if (evaluation.autoCreateTasks) {
      result.tasksToCreate = evaluation.autoCreateTasks;
    }
  }

  return result;
}

// ============================================================
// 4. PROACTIVE INSIGHTS ENGINE
// ============================================================

/**
 * Compute ADHD-friendly proactive insights from a task collection.
 * Returns aggregated summaries instead of raw task lists.
 *
 * @param {Object[]} tasks - All tasks (typically for current month)
 * @param {Object[]} clients - All clients
 * @returns {Object[]} Array of insight objects
 */
export function computeInsights(tasks, clients = []) {
  if (!tasks?.length) return [];

  const now = new Date();
  const insights = [];

  // Group tasks by service key
  const byService = {};
  for (const task of tasks) {
    if (task.status === 'not_relevant' || task.status === 'completed') continue;
    const service = getServiceForTask(task);
    const key = service?.key || 'other';
    if (!byService[key]) byService[key] = [];
    byService[key].push(task);
  }

  // --- VAT Insights ---
  const vatTasks = byService['vat'] || [];
  const vatReady = vatTasks.filter(t => {
    const steps = t.process_steps || {};
    return steps.income_input?.done && steps.expense_input?.done && !steps.submission?.done;
  });
  if (vatReady.length > 0) {
    insights.push({
      type: 'action',
      category: 'vat',
      icon: 'FileBarChart',
      color: 'teal',
      title: `${vatReady.length} לקוחות מוכנים להפקת מע"מ`,
      description: vatReady.map(t => t.client_name).join(', '),
      count: vatReady.length,
      priority: 1,
    });
  }

  const vatPending = vatTasks.filter(t => {
    const steps = t.process_steps || {};
    return (!steps.income_input?.done || !steps.expense_input?.done) && t.status !== 'completed';
  });
  if (vatPending.length > 0) {
    insights.push({
      type: 'progress',
      category: 'vat',
      icon: 'Clock',
      color: 'amber',
      title: `${vatPending.length} לקוחות ממתינים להשלמת קליטה`,
      description: vatPending.map(t => t.client_name).join(', '),
      count: vatPending.length,
      priority: 2,
    });
  }

  // --- Payroll Insights ---
  const payrollTasks = byService['payroll'] || [];
  const inRevision = payrollTasks.filter(t =>
    t.status === 'waiting_for_approval' || t.status === 'remaining_completions'
  );
  if (inRevision.length > 0) {
    insights.push({
      type: 'action',
      category: 'payroll',
      icon: 'Calculator',
      color: 'blue',
      title: `${inRevision.length} תלושי שכר בסבבי תיקון`,
      description: inRevision.map(t => t.client_name).join(', '),
      count: inRevision.length,
      priority: 1,
    });
  }

  // Nano quick-wins (small payroll clients that can be done fast)
  const clientMap = {};
  for (const c of clients) { clientMap[c.name] = c; }
  const nanoPayroll = payrollTasks.filter(t => {
    const client = clientMap[t.client_name];
    return client && getPayrollTier(client).key === 'nano' && t.status !== 'completed';
  });
  if (nanoPayroll.length > 0) {
    insights.push({
      type: 'action',
      category: 'payroll_nano',
      icon: 'Zap',
      color: 'emerald',
      title: `⚡ ${nanoPayroll.length} תלושים קטנים - "שעת כוח"`,
      description: `לקוחות קטנים (1-5 עובדים) שאפשר לסיים ב-10 דק' כל אחד`,
      count: nanoPayroll.length,
      priority: 2,
    });
  }

  // --- Pending External Insights ---
  const pendingExternal = tasks.filter(t => t.status === 'pending_external');
  if (pendingExternal.length > 0) {
    const overWeek = pendingExternal.filter(t => {
      if (!t.updated_date) return false;
      const updated = new Date(t.updated_date);
      return (now - updated) / (1000 * 60 * 60 * 24) > 7;
    });

    insights.push({
      type: overWeek.length > 0 ? 'warning' : 'info',
      category: 'external',
      icon: 'Clock',
      color: 'blue',
      title: `${pendingExternal.length} משימות ממתינות לצד ג'`,
      description: overWeek.length > 0
        ? `${overWeek.length} מחכות מעל 7 ימים!`
        : pendingExternal.map(t => t.client_name).join(', '),
      count: pendingExternal.length,
      priority: overWeek.length > 0 ? 1 : 3,
    });
  }

  // --- Overdue Insights ---
  const overdue = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'not_relevant') return false;
    if (!t.due_date) return false;
    return new Date(t.due_date) < now;
  });
  if (overdue.length > 0) {
    insights.push({
      type: 'warning',
      category: 'overdue',
      icon: 'AlertTriangle',
      color: 'amber',
      title: `${overdue.length} משימות עברו את הדדליין`,
      description: `${overdue.length} משימות דורשות תשומת לב מיידית`,
      count: overdue.length,
      priority: 0,
    });
  }

  // --- Completion Progress ---
  const totalActive = tasks.filter(t =>
    t.status !== 'not_relevant' && t.context === 'work'
  ).length;
  const totalDone = tasks.filter(t =>
    t.status === 'completed' && t.context === 'work'
  ).length;
  if (totalActive > 0) {
    const pct = Math.round((totalDone / totalActive) * 100);
    insights.push({
      type: 'celebration',
      category: 'progress',
      icon: 'TrendingUp',
      color: 'emerald',
      title: `${totalDone}/${totalActive} משימות הושלמו (${pct}%)`,
      description: pct >= 80 ? 'כמעט סיימת את החודש!' : pct >= 50 ? 'חצי מהעבודה מאחורייך!' : 'ממשיכים!',
      count: totalDone,
      priority: 4,
    });
  }

  // Sort by priority (0 = most urgent)
  insights.sort((a, b) => a.priority - b.priority);

  return insights;
}

// ============================================================
// MindMap node status computation (for visual rewards)
// ============================================================

/**
 * Compute the visual state of a client node in the MindMap.
 * Determines color, size change, and animation based on task completion chains.
 *
 * @param {string} clientName - The client name
 * @param {Object[]} clientTasks - All tasks for this client in the current period
 * @returns {Object} { completionRatio, nodeColor, shouldPulse, shouldShrink }
 */
export function computeClientNodeState(clientName, clientTasks) {
  if (!clientTasks?.length) {
    return { completionRatio: 0, nodeColor: 'slate', shouldPulse: false, shouldShrink: false };
  }

  const activeTasks = clientTasks.filter(t =>
    t.status !== 'not_relevant' && t.client_name === clientName
  );
  if (activeTasks.length === 0) {
    return { completionRatio: 1, nodeColor: 'emerald', shouldPulse: false, shouldShrink: true };
  }

  const completed = activeTasks.filter(t => t.status === 'completed').length;
  const pendingExt = activeTasks.filter(t => t.status === 'pending_external').length;
  const overdue = activeTasks.filter(t => {
    if (t.status === 'completed' || t.status === 'not_relevant') return false;
    return t.due_date && new Date(t.due_date) < new Date();
  }).length;

  const ratio = completed / activeTasks.length;

  // Color logic:
  // - All completed → emerald (green-out, shrink)
  // - Has pending_external → blue
  // - Has overdue → amber (pulse)
  // - Partially done → default gradient
  let nodeColor = 'slate';
  let shouldPulse = false;
  let shouldShrink = false;

  if (ratio === 1) {
    nodeColor = 'emerald';
    shouldShrink = true;
  } else if (pendingExt > 0 && overdue === 0) {
    nodeColor = 'blue';
  } else if (overdue > 0) {
    nodeColor = 'amber';
    shouldPulse = true;
  } else if (ratio >= 0.5) {
    nodeColor = 'teal';
  } else if (ratio > 0) {
    nodeColor = 'sky';
  }

  return { completionRatio: ratio, nodeColor, shouldPulse, shouldShrink };
}
