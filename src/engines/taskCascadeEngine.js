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

// ============================================================
// PAYROLL WORKFLOW PHASES (Master Task Container)
// ============================================================
// Phase A: ייצור שכר — the initial payroll task (6 steps)
// Phase B: דיווחי רשויות — auto-created when Phase A completes
// Phase C: שירותים נלווים — auto-created when Phase A completes

export const PHASE_B_SERVICES = [
  { serviceKey: 'deductions',        title: 'מ"ה ניכויים' },
  { serviceKey: 'social_security',   title: 'ביטוח לאומי' },
];

export const PHASE_C_SERVICES = [
  { serviceKey: 'payslip_sending',   title: 'משלוח תלושים' },
  { serviceKey: 'masav_social',      title: 'מס"ב סוציאליות' },
  { serviceKey: 'masav_employees',   title: 'מס"ב עובדים' },
];

// Combined for backward compat
const POST_PAYROLL_SERVICES = [...PHASE_B_SERVICES, ...PHASE_C_SERVICES];

// ============================================================
// P2 BOOKKEEPING WORKFLOW PHASES (Mirror of P1 cascade)
// ============================================================
// Phase A: ייצור הנה"ח — bookkeeping production (income + expenses + reconciliation)
// Phase B: דיווחי מיסים — VAT + Tax Advances (triggered when production completes)
// Phase C: תוצרים — P&L reports (triggered when production completes)

export const P2_PHASE_B_SERVICES = [
  { serviceKey: 'vat_reporting',   title: 'דיווח מע"מ',       createCategory: 'מע"מ' },
  { serviceKey: 'tax_advances',    title: 'מקדמות מס הכנסה',  createCategory: 'מקדמות מס' },
];

export const P2_PHASE_C_SERVICES = [
  { serviceKey: 'pnl_reports',     title: 'דוח רווח והפסד',   createCategory: 'רווח והפסד' },
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
 * MASTER TASK WORKFLOW:
 *   Phase A (ייצור שכר): The 6-step payroll production.
 *     V on last step → status becomes 'production_completed' (NOT 'completed').
 *     This triggers creation of Phase B + Phase C tasks.
 *   Phase B (דיווחי רשויות): ניכויים + ביטוח לאומי — auto-created.
 *   Phase C (שירותים נלווים): תלושים + מס"ב — auto-created.
 *   The master payroll task reaches 'completed' only when ALL child tasks are done.
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

  // All 6 production steps done → production_completed (NOT completed)
  // The task stays visible with a "הושלם ייצור" badge.
  // It triggers Phase B + Phase C child tasks.
  if (lastDoneIndex === PAYROLL_STEP_ORDER.length - 1) {
    // Don't re-trigger if already in production_completed or completed
    if (task.status === 'production_completed' || task.status === 'completed') {
      return null;
    }

    result.status = 'production_completed';

    // Build auto-created tasks for Phase B (דיווחי רשויות) and Phase C (שירותים נלווים)
    const buildChildTasks = (services, phase, phaseLabel) =>
      services.map(svc => ({
        serviceKey: svc.serviceKey,
        title: `${svc.title} - ${task.client_name}`,
        client_name: task.client_name,
        client_id: task.client_id,
        category: ALL_SERVICES[svc.serviceKey]?.createCategory || svc.title,
        status: 'not_started',
        branch: 'P1',
        due_date: task.due_date || task.date,
        report_month: task.report_month,
        report_year: task.report_year,
        report_period: task.report_period,
        context: 'work',
        is_recurring: true,
        workflow_phase: phase,
        workflow_phase_label: phaseLabel,
        master_task_id: task.id,
        triggered_by: task.id,
        source: 'payroll_cascade',
      }));

    result.autoCreateTasks = [
      ...buildChildTasks(PHASE_B_SERVICES, 'phase_b', 'שלב ב\' | דיווחי רשויות'),
      ...buildChildTasks(PHASE_C_SERVICES, 'phase_c', 'שלב ג\' | שירותים נלווים'),
    ];
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
// 2b. P2 BOOKKEEPING CASCADE — production → tax reporting + P&L
// ============================================================

/**
 * Evaluate bookkeeping task status based on step completion.
 *
 * P2 WORKFLOW:
 *   Phase A (ייצור הנה"ח): income_input + expense_input + reconciliation steps.
 *     All 3 done → status becomes 'production_completed'.
 *     This triggers creation of Phase B (VAT/advances) + Phase C (P&L) tasks.
 *   The master bookkeeping task reaches 'completed' only when all child tasks are done.
 *
 * @param {Object} task - The bookkeeping task
 * @param {Object} updatedSteps - The new process_steps
 * @param {Object[]} siblingTasks - Sibling tasks for the same client + month
 * @returns {{ status: string, autoCreateTasks?: Object[] } | null}
 */
export function evaluateBookkeepingStatus(task, updatedSteps, siblingTasks = []) {
  const service = getServiceForTask(task);
  if (!service || service.key !== 'bookkeeping') return null;

  const stepKeys = service.steps.map(s => s.key);
  const doneCount = stepKeys.filter(k => updatedSteps?.[k]?.done).length;
  const allDone = doneCount === stepKeys.length;

  if (allDone) {
    // Don't re-trigger if already in production_completed or completed
    if (task.status === 'production_completed' || task.status === 'completed') {
      return null;
    }

    const result = { status: 'production_completed' };

    // Build auto-created tasks for P2 Phase B (tax reporting) and Phase C (P&L)
    const buildP2Children = (services, phase, phaseLabel) =>
      services.map(svc => ({
        serviceKey: svc.serviceKey,
        title: `${svc.title} - ${task.client_name}`,
        client_name: task.client_name,
        client_id: task.client_id,
        category: svc.createCategory || svc.title,
        status: 'not_started',
        branch: 'P2',
        due_date: task.due_date || task.date,
        report_month: task.report_month,
        report_year: task.report_year,
        report_period: task.report_period,
        context: 'work',
        is_recurring: true,
        workflow_phase: phase,
        workflow_phase_label: phaseLabel,
        master_task_id: task.id,
        triggered_by: task.id,
        source: 'bookkeeping_cascade',
      }));

    // Only create tasks for services the client actually has
    // (check sibling tasks: if VAT task already exists, don't create duplicate)
    const existingCategories = new Set(siblingTasks.map(t => t.category));

    const phaseB = P2_PHASE_B_SERVICES.filter(svc =>
      !existingCategories.has(svc.createCategory)
    );
    const phaseC = P2_PHASE_C_SERVICES.filter(svc =>
      !existingCategories.has(svc.createCategory)
    );

    result.autoCreateTasks = [
      ...buildP2Children(phaseB, 'phase_b', 'שלב ב\' | דיווחי מיסים'),
      ...buildP2Children(phaseC, 'phase_c', 'שלב ג\' | תוצרים'),
    ];

    return result;
  }

  // Some steps done = in progress
  if (doneCount > 0) {
    return { status: 'in_progress' };
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

    case 'bookkeeping':
      evaluation = evaluateBookkeepingStatus(task, updatedSteps, siblingTasks);
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
    // Don't downgrade from completed or production_completed
    const isTerminal = task.status === 'completed' || task.status === 'production_completed';
    const evalTerminal = evaluation.status === 'completed' || evaluation.status === 'production_completed';
    if (isTerminal && !evalTerminal) {
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

  // Production-completed payroll tasks (Phase B+C pending)
  const prodCompleted = payrollTasks.filter(t => t.status === 'production_completed');
  if (prodCompleted.length > 0) {
    insights.push({
      type: 'info',
      category: 'payroll_workflow',
      icon: 'GitBranch',
      color: 'sky',
      title: `${prodCompleted.length} לקוחות - ייצור שכר הושלם, ממתינים לדיווחי רשויות`,
      description: prodCompleted.map(t => t.client_name).join(', '),
      count: prodCompleted.length,
      priority: 2,
    });
  }

  // Nano quick-wins (small payroll clients that can be done fast)
  const clientMap = {};
  for (const c of clients) { clientMap[c.name] = c; }
  const nanoPayroll = payrollTasks.filter(t => {
    const client = clientMap[t.client_name];
    return client && getPayrollTier(client).key === 'nano' && t.status !== 'completed' && t.status !== 'production_completed';
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

  const completed = activeTasks.filter(t => t.status === 'completed' || t.status === 'production_completed').length;
  const pendingExt = activeTasks.filter(t => t.status === 'pending_external').length;
  const overdue = activeTasks.filter(t => {
    if (t.status === 'completed' || t.status === 'production_completed' || t.status === 'not_relevant') return false;
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
