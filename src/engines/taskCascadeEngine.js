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
 *
 * 5. Service Filtering (בל יעבור):
 *    NEVER create מס"ב/סוציאליות tasks unless service is active in client card.
 */

import {
  TAX_SERVICES,
  PAYROLL_SERVICES,
  ADDITIONAL_SERVICES,
  ALL_SERVICES,
  getServiceForTask,
  getStepsForService,
} from '@/config/processTemplates';
import { getScheduledStartForCategory } from '@/config/automationRules';

// ============================================================
// CONSTANTS
// ============================================================

// Auto P-branch assignment based on task category
const CATEGORY_TO_BRANCH = {
  // P1 — Payroll
  'work_payroll': 'P1', 'payroll': 'P1', 'שכר': 'P1',
  'work_deductions': 'P1', 'deductions': 'P1', 'ניכויים': 'P1', 'מ"ה ניכויים': 'P1',
  'work_social_security': 'P1', 'social_security': 'P1', 'ביטוח לאומי': 'P1',
  'masav_social': 'P1', 'מס"ב סוציאליות': 'P1',
  'masav_employees': 'P1', 'מס"ב עובדים': 'P1',
  'payslip_sending': 'P1', 'משלוח תלושים': 'P1',
  // P2 — Bookkeeping
  'work_bookkeeping': 'P2', 'bookkeeping': 'P2', 'הנה"ח': 'P2',
  'work_vat_reporting': 'P2', 'vat_reporting': 'P2', 'מע"מ': 'P2', 'דיווח מע"מ': 'P2',
  'work_tax_advances': 'P2', 'tax_advances': 'P2', 'מקדמות מס': 'P2', 'מקדמות מס הכנסה': 'P2',
  'pnl_reports': 'P2', 'רווח והפסד': 'P2', 'דוח רווח והפסד': 'P2',
  'work_annual_reports': 'P2', 'annual_reports': 'P2', 'מאזנים': 'P2',
  'work_balance_sheets': 'P2', 'balance_sheets': 'P2',
  'work_financial_reports': 'P2',
  // P3 — Office Management
  'work_additional': 'P3', 'work_extra': 'P3', 'work_other': 'P3',
  'consulting': 'P3', 'ייעוץ': 'P3', 'work_consulting': 'P3',
  'reconciliation': 'P3', 'התאמות': 'P3',
  'מילואים': 'P3', 'work_reserve_claims': 'P3',
};

/**
 * Determine P-branch from task category.
 * Falls back to null if no mapping found.
 */
export function getBranchForCategory(category) {
  if (!category) return null;
  return CATEGORY_TO_BRANCH[category] || null;
}

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
// SERVICE FILTERING (חוק בל יעבור)
// ============================================================
// Maps cascade serviceKey → client.service_types key.
// Used to filter auto-created tasks: only create if the client
// has the corresponding service flagged as active.
const CASCADE_SERVICE_TO_CLIENT_SERVICE = {
  deductions:        'deductions',
  social_security:   'social_security',
  payslip_sending:   'payslip_sending',
  masav_social:      'masav_social',
  masav_employees:   'masav_employees',
  masav_authorities: 'masav_authorities',
  masav_suppliers:   'masav_suppliers',
  authorities_payment: 'authorities_payment',
  vat_reporting:     'vat_reporting',
  tax_advances:      'tax_advances',
  pnl_reports:       'pnl_reports',
};

/**
 * Filter auto-created tasks based on client's active services (service_types[]).
 * חוק בל יעבור: NEVER create a task for a service the client doesn't have.
 *
 * @param {Object[]} tasksToCreate - Array of task blueprints from cascade
 * @param {string[]} clientServices - client.service_types array
 * @returns {Object[]} filtered tasks
 */
export function filterByClientServices(tasksToCreate, clientServices) {
  if (!clientServices || clientServices.length === 0) return tasksToCreate;
  return tasksToCreate.filter(task => {
    const requiredService = CASCADE_SERVICE_TO_CLIENT_SERVICE[task.serviceKey];
    // If no mapping exists, allow the task (it's not service-gated)
    if (!requiredService) return true;
    return clientServices.includes(requiredService);
  });
}

// ============================================================
// DUE DATE HELPER (15th of next month)
// ============================================================

/**
 * Calculate due date for auto-created sub-tasks: 15th of the month AFTER
 * the parent task's due month.
 *
 * @param {string} parentDueDate - YYYY-MM-DD format
 * @returns {string} YYYY-MM-DD (15th of next month)
 */
export function getSubTaskDueDate(parentDueDate) {
  if (!parentDueDate) {
    // Fallback: 15th of next month from now
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    return nextMonth.toISOString().split('T')[0];
  }
  const d = new Date(parentDueDate);
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 15);
  return nextMonth.toISOString().split('T')[0];
}

// ============================================================
// PAYMENT METHOD LABELS (for task description injection)
// ============================================================
const PAYMENT_METHOD_LABELS = {
  masav:                'מס"ב',
  credit_card:          'כרטיס אשראי',
  bank_standing_order:  'הו"ק בנקאית',
  standing_order:       'כתב אישור (כ"א)',
  check:                'המחאה',
};

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
  const payment = updatedSteps?.payment?.done;

  // Both דיווח + תשלום done = production_completed (handled by authority evaluator)
  // Submission done only (no payment yet) = sent_for_review (handled by authority evaluator)
  // So here we only handle pre-submission logic:

  // Report prep done = needs_corrections (data ready, needs review before submission)
  if (reportPrep && !submission) {
    return { status: 'not_started' };
  }

  // Both income + expense done = ready for report prep
  if (incomeInput && expenseInput && !reportPrep) {
    return { status: 'not_started' };
  }

  // Only one done = still open
  if (incomeInput || expenseInput) {
    return { status: 'not_started' };
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

  // Authority evaluator handles submission+payment → production_completed
  // Here we only handle pre-submission logic:
  if (vatIncomesDone && updatedSteps?.calculation?.done && !updatedSteps?.submission?.done) {
    return { status: 'not_started' };
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

    // Due date for sub-tasks: 15th of the month after parent's due date
    const subDueDate = getSubTaskDueDate(task.due_date || task.date);

    // Build auto-created tasks for Phase B (דיווחי רשויות) and Phase C (שירותים נלווים)
    // CRITICAL: Initialize process_steps from templates so sub-tasks show step checkboxes
    const buildChildTasks = (services, phase, phaseLabel) =>
      services.map(svc => {
        // Initialize process_steps from service template
        const templateSteps = getStepsForService(svc.serviceKey);
        const processSteps = {};
        templateSteps.forEach(step => {
          processSteps[step.key] = { done: false, date: null, notes: '' };
        });
        const childCategory = ALL_SERVICES[svc.serviceKey]?.createCategory || svc.title;
        const autoStart = getScheduledStartForCategory(childCategory, subDueDate);
        return {
          serviceKey: svc.serviceKey,
          title: `${svc.title} - ${task.client_name}`,
          client_name: task.client_name,
          client_id: task.client_id,
          category: childCategory,
          status: 'not_started',
          branch: 'P1',
          due_date: subDueDate,
          scheduled_start: autoStart || undefined,
          report_month: task.report_month,
          report_year: task.report_year,
          report_period: task.report_period,
          context: 'work',
          is_recurring: true,
          workflow_phase: phase,
          workflow_phase_label: phaseLabel,
          parent_id: task.id,
          master_task_id: task.id,
          triggered_by: task.id,
          source: 'payroll_cascade',
          process_steps: processSteps,
          estimated_duration: svc.serviceKey === 'masav_employees' ? 15 : undefined,
        };
      });

    result.autoCreateTasks = [
      ...buildChildTasks(PHASE_B_SERVICES, 'phase_b', 'שלב ב\' | דיווחי רשויות'),
      ...buildChildTasks(PHASE_C_SERVICES, 'phase_c', 'שלב ג\' | שירותים נלווים'),
    ];
    return result;
  }

  // Proofreading done = sent for review
  if (lastDoneIndex >= 2) { // proofreading index = 2
    result.status = 'sent_for_review';
    return result;
  }

  // Some steps done = still open task
  if (lastDoneIndex >= 0) {
    result.status = 'not_started';
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

    // Due date for sub-tasks: 15th of the month after parent's due date
    const subDueDate = getSubTaskDueDate(task.due_date || task.date);

    // Build auto-created tasks for P2 Phase B (tax reporting) and Phase C (P&L)
    // CRITICAL: Initialize process_steps from templates so sub-tasks show step checkboxes
    const buildP2Children = (services, phase, phaseLabel) =>
      services.map(svc => {
        const templateSteps = getStepsForService(svc.serviceKey);
        const processSteps = {};
        templateSteps.forEach(step => {
          processSteps[step.key] = { done: false, date: null, notes: '' };
        });
        return {
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
          report_period: task.report_period,
          context: 'work',
          is_recurring: true,
          workflow_phase: phase,
          workflow_phase_label: phaseLabel,
          master_task_id: task.id,
          triggered_by: task.id,
          source: 'bookkeeping_cascade',
          process_steps: processSteps,
        };
      });

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

  // Some steps done = still open
  if (doneCount > 0) {
    return { status: 'not_started' };
  }

  return null;
}

// ============================================================
// 2c. SOCIAL SECURITY CHAIN (מס"ב סוציאליות)
// ============================================================
// Dependency chain:
//   "משלוח קובץ למתפעל" (הושלם) → status: waiting_for_materials (ממתין לקובץ ממתפעל)
//   → "קבלת קובץ ממתפעל" (הושלם) → status: not_started (לבצע)
//   → "הכנת קובץ + העלאה" (הושלם) → status: sent_for_review
//   → "משלוח אסמכתאות" (הושלם) → status: production_completed

/**
 * Evaluate מס"ב סוציאליות task status based on the social security chain.
 *
 * @param {Object} task - The masav_social task
 * @param {Object} updatedSteps - The new process_steps
 * @returns {{ status: string } | null}
 */
export function evaluateMasavSocialStatus(task, updatedSteps) {
  const service = getServiceForTask(task);
  if (!service || service.key !== 'masav_social') return null;

  const sendToOperator = updatedSteps?.send_to_operator?.done;
  const receiveFile = updatedSteps?.receive_file?.done;
  const filePrep = updatedSteps?.file_prep?.done;
  const upload = updatedSteps?.upload?.done;
  const sendReceipts = updatedSteps?.send_receipts?.done;

  // Full chain complete → production_completed
  if (sendReceipts) {
    return { status: 'production_completed' };
  }

  // Upload done → sent for review (awaiting confirmation)
  if (upload) {
    return { status: 'sent_for_review' };
  }

  // File prep done → still in progress (not_started)
  if (filePrep) {
    return { status: 'not_started' };
  }

  // File received from operator → ready to work (לבצע)
  if (receiveFile) {
    return { status: 'not_started' };
  }

  // Sent to operator, waiting for response → waiting_for_materials
  if (sendToOperator && !receiveFile) {
    return { status: 'waiting_for_materials' };
  }

  return null;
}

// ============================================================
// 2d. AUTHORITY TASK EVALUATOR (generic for דיווח + תשלום)
// ============================================================

/**
 * Evaluate authority tasks (מע"מ, מקדמות, בט"ל, ניכויים).
 * These have דיווח (submission) + תשלום (payment) as final sub-steps.
 * Payment step completion → production_completed.
 * Submission without payment → sent_for_review.
 *
 * @param {Object} task - The authority task
 * @param {Object} updatedSteps - The new process_steps
 * @returns {{ status: string } | null}
 */
export function evaluateAuthorityStatus(task, updatedSteps) {
  const service = getServiceForTask(task);
  if (!service || service.taskType !== 'authority') return null;

  const submission = updatedSteps?.submission?.done;
  const payment = updatedSteps?.payment?.done;

  // Both דיווח + תשלום done → production_completed
  if (submission && payment) {
    return { status: 'production_completed' };
  }

  // דיווח done, תשלום pending → sent_for_review
  if (submission && !payment) {
    return { status: 'sent_for_review' };
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

  // Reserve Duty: claim submitted → waiting for materials (external wait)
  if (EXTERNAL_AFTER_SUBMIT.has(task.category)) {
    if (updatedSteps?.pending_funds?.done && updatedSteps?.follow_up?.done) {
      return { status: 'production_completed' };
    }
    if (updatedSteps?.pending_funds?.done || (updatedSteps?.claim_submit?.done && !updatedSteps?.follow_up?.done)) {
      return { status: 'waiting_for_materials' };
    }
    if (updatedSteps?.follow_up?.done) {
      return { status: 'production_completed' };
    }
  }

  // Consultants: consultation done but summary not → waiting for materials
  if (CONSULTANT_CATEGORIES.has(task.category)) {
    if (updatedSteps?.consultation?.done && !updatedSteps?.summary?.done) {
      return { status: 'waiting_for_materials' };
    }
    if (updatedSteps?.summary?.done) {
      return { status: 'production_completed' };
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
 * @param {Object} options - { clientServices?: string[], clientPaymentMethod?: string }
 * @returns {Object} { statusUpdate, tasksToCreate, tasksToUpdate }
 */
export function processTaskCascade(task, updatedSteps, siblingTasks = [], options = {}) {
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
      // VAT is authority type: check authority דיווח+תשלום first, then VAT-specific logic
      evaluation = evaluateAuthorityStatus(task, updatedSteps) || evaluateVatStatus(task, updatedSteps);
      break;

    case 'tax_advances':
      evaluation = evaluateAuthorityStatus(task, updatedSteps) || evaluateTaxAdvancesStatus(task, updatedSteps, siblingTasks);
      break;

    case 'social_security':
    case 'deductions':
      // Authority tasks: דיווח + תשלום sub-steps
      evaluation = evaluateAuthorityStatus(task, updatedSteps);
      break;

    case 'payroll':
      evaluation = evaluatePayrollStatus(task, updatedSteps);
      break;

    case 'bookkeeping':
      evaluation = evaluateBookkeepingStatus(task, updatedSteps, siblingTasks);
      break;

    case 'masav_social':
      // Social Security Chain: full dependency chain evaluation
      evaluation = evaluateMasavSocialStatus(task, updatedSteps);
      break;

    case 'reserve_claims':
    case 'consulting':
      evaluation = evaluateRelayStatus(task, updatedSteps);
      break;

    default:
      // Generic: all steps done = production_completed
      if (service.steps.length > 0) {
        const allDone = service.steps.every(s => updatedSteps?.[s.key]?.done);
        if (allDone) {
          evaluation = { status: 'production_completed' };
        }
      }
      break;
  }

  if (evaluation) {
    // Don't downgrade from production_completed (the terminal trigger status)
    const isTerminal = task.status === 'production_completed';
    const evalTerminal = evaluation.status === 'production_completed';
    if (isTerminal && !evalTerminal) {
      // Already at terminal — don't regress
    } else {
      result.statusUpdate = { status: evaluation.status };
    }

    if (evaluation.autoCreateTasks) {
      result.tasksToCreate = evaluation.autoCreateTasks;
    }
  }

  // ── SERVICE FILTERING (חוק בל יעבור) ──
  // Filter out auto-created tasks for services the client doesn't have
  if (result.tasksToCreate.length > 0 && options.clientServices) {
    result.tasksToCreate = filterByClientServices(result.tasksToCreate, options.clientServices);
  }

  // ── PAYMENT METHOD INJECTION ──
  // Inject אמצעי תשלום רשויות into ALL auto-created task descriptions
  // (not just masav — deductions, social security, etc. all need it)
  if (result.tasksToCreate.length > 0 && options.clientPaymentMethod) {
    const methodLabel = PAYMENT_METHOD_LABELS[options.clientPaymentMethod] || options.clientPaymentMethod;
    result.tasksToCreate = result.tasksToCreate.map(t => ({
      ...t,
      description: `אמצעי תשלום: ${methodLabel}${t.description ? '\n' + t.description : ''}`,
    }));
  }

  // ── AUTO P-BRANCH ASSIGNMENT ──
  // Ensure all cascade-created tasks have a branch assigned based on category
  if (result.tasksToCreate.length > 0) {
    result.tasksToCreate = result.tasksToCreate.map(t => {
      if (t.branch) return t; // already assigned (e.g. payroll/bookkeeping builders)
      const autoBranch = getBranchForCategory(t.category) || getBranchForCategory(t.serviceKey);
      return autoBranch ? { ...t, branch: autoBranch } : t;
    });
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
    if (task.status === 'production_completed') continue;
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
    t.status === 'sent_for_review' || t.status === 'needs_corrections'
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
    return client && getPayrollTier(client).key === 'nano' && t.status !== 'production_completed';
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

  // --- Waiting for Materials Insights ---
  const waitingMaterials = tasks.filter(t => t.status === 'waiting_for_materials');
  if (waitingMaterials.length > 0) {
    insights.push({
      type: 'info',
      category: 'external',
      icon: 'Clock',
      color: 'amber',
      title: `${waitingMaterials.length} משימות ממתינות לחומרים`,
      description: waitingMaterials.map(t => t.client_name).join(', '),
      count: waitingMaterials.length,
      priority: 3,
    });
  }

  // --- Overdue Insights ---
  const overdue = tasks.filter(t => {
    if (t.status === 'production_completed') return false;
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
    t.context === 'work'
  ).length;
  const totalDone = tasks.filter(t =>
    t.status === 'production_completed' && t.context === 'work'
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
    t.client_name === clientName
  );
  if (activeTasks.length === 0) {
    return { completionRatio: 1, nodeColor: 'emerald', shouldPulse: false, shouldShrink: true };
  }

  const completed = activeTasks.filter(t => t.status === 'production_completed').length;
  const waitingMat = activeTasks.filter(t => t.status === 'waiting_for_materials').length;
  const overdue = activeTasks.filter(t => {
    if (t.status === 'production_completed') return false;
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
  } else if (waitingMat > 0 && overdue === 0) {
    nodeColor = 'amber';
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
