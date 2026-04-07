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
  isStepComplete,
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
  // P2 — Bookkeeping (monthly recurring: VAT, Advances, P&L)
  'work_bookkeeping': 'P2', 'bookkeeping': 'P2', 'הנה"ח': 'P2',
  'work_vat_reporting': 'P2', 'vat_reporting': 'P2', 'מע"מ': 'P2', 'דיווח מע"מ': 'P2',
  'work_tax_advances': 'P2', 'tax_advances': 'P2', 'מקדמות מס': 'P2', 'מקדמות מס הכנסה': 'P2',
  'pnl_reports': 'P2', 'רווח והפסד': 'P2', 'דוח רווח והפסד': 'P2',
  'work_financial_reports': 'P2',
  'income_collection': 'P2', 'קליטת הכנסות': 'P2',
  'expense_collection': 'P2', 'קליטת הוצאות': 'P2',
  // P3 — Office Management
  'work_additional': 'P3', 'work_extra': 'P3', 'work_other': 'P3',
  'consulting': 'P3', 'ייעוץ': 'P3', 'work_consulting': 'P3',
  'reconciliation': 'P3', 'התאמות': 'P3',
  'מילואים': 'P3', 'work_reserve_claims': 'P3',
  // P4 — Home
  'home': 'P4', 'בית': 'P4',
  // P5 — Annual Reports & Capital Statements
  'work_annual_reports': 'P5', 'annual_reports': 'P5', 'דוח שנתי': 'P5',
  'work_capital_statement': 'P5', 'הצהרת הון': 'P5',
  'work_balance_sheets': 'P5', 'balance_sheets': 'P5', 'מאזנים': 'P5',
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

// Payroll final production step key (closing steps moved to P1_closing)
const PAYROLL_FINAL_STEP = 'proofreading';

// ============================================================
// PAYROLL WORKFLOW PHASES (Master Task Container)
// ============================================================
// Phase A: ייצור שכר — the initial payroll task (3 steps: קבלה, תלושים, הגהה)
// Phase B: דיווחי רשויות — auto-created when Phase A completes
// Phase C: שירותים נלווים — auto-created when Phase A completes
// Closing: קליטה להנה"ח — P1_closing (salary_entry + authority entries)

export const PHASE_B_SERVICES = [
  { serviceKey: 'deductions',        title: 'מ"ה ניכויים' },
  { serviceKey: 'social_security',   title: 'ביטוח לאומי' },
];

export const PHASE_C_SERVICES = [
  { serviceKey: 'payslip_sending',   title: 'משלוח תלושים' },
  { serviceKey: 'payroll_closing',   title: 'קליטה להנה"ח' },
];

// MSB Collector Services — these are multi-parent nodes, NOT children of a single task.
// They collect dependencies from ALL P1 payroll tasks for the same client+month.
export const MSB_COLLECTOR_SERVICES = [
  { serviceKey: 'masav_social',      title: 'מס"ב סוציאליות' },
  { serviceKey: 'masav_employees',   title: 'מס"ב עובדים' },
];

// Combined for backward compat
const POST_PAYROLL_SERVICES = [...PHASE_B_SERVICES, ...PHASE_C_SERVICES, ...MSB_COLLECTOR_SERVICES];

// ============================================================
// SERVICE FILTERING (חוק בל יעבור)
// ============================================================
// Maps cascade serviceKey → process tree node ID.
// Used to filter auto-created tasks: only create if the client
// has the corresponding node enabled in process_tree.
// Falls back to service_types[] for legacy clients.
const CASCADE_SERVICE_TO_TREE_NODE = {
  deductions:          'P1_deductions',
  social_security:     'P1_social_security',
  payslip_sending:     'P1_payslip_sending',  // V4.1: own node
  payroll_closing:     'P1_closing',          // V4.1: closing bridge P1→P2
  masav_social:        'P1_social_benefits',  // V4.1: social benefits node
  masav_employees:     'P1_masav_employees',  // V4.1: own node
  masav_suppliers:     'P2_masav_suppliers',
  authorities_payment: 'P1_authorities',    // V4.0: parent node
  vat_reporting:       'P2_vat',
  tax_advances:        'P2_tax_advances',
  pnl_reports:         'P2_pnl',
};

// Legacy mapping for clients without process_tree
const CASCADE_SERVICE_TO_CLIENT_SERVICE = {
  deductions:          'deductions',
  social_security:     'social_security',
  payslip_sending:     'payslip_sending',
  masav_social:        'masav_social',
  masav_employees:     'masav_employees',
  masav_suppliers:     'masav_suppliers',
  authorities_payment: 'authorities_payment',
  vat_reporting:       'vat_reporting',
  tax_advances:        'tax_advances',
  pnl_reports:         'pnl_reports',
};

/**
 * Filter auto-created tasks based on client's process_tree or service_types[].
 * PRIMARY: process_tree node enabled check.
 * FALLBACK: service_types[] for legacy clients.
 *
 * @param {Object[]} tasksToCreate - Array of task blueprints from cascade
 * @param {string[]} clientServices - client.service_types array (legacy)
 * @param {Object} [clientProcessTree] - client.process_tree object
 * @returns {Object[]} filtered tasks
 */
export function filterByClientServices(tasksToCreate, clientServices, clientProcessTree) {
  const hasProcessTree = clientProcessTree && Object.keys(clientProcessTree).length > 0;

  return tasksToCreate.filter(task => {
    if (hasProcessTree) {
      const nodeId = CASCADE_SERVICE_TO_TREE_NODE[task.serviceKey];
      if (!nodeId) return true;
      return !!clientProcessTree[nodeId]?.enabled;
    }
    // Legacy fallback
    if (!clientServices || clientServices.length === 0) return true;
    const requiredService = CASCADE_SERVICE_TO_CLIENT_SERVICE[task.serviceKey];
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
  const pad = (n) => String(n).padStart(2, '0');
  if (!parentDueDate) {
    // Fallback: 15th of next month from now
    const now = new Date();
    const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const m = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
    return `${y}-${pad(m)}-15`;
  }
  const d = new Date(parentDueDate + 'T12:00:00');
  const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 15);
  return `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-${pad(nextMonth.getDate())}`;
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
  // P&L moved to P2_COLLECTOR_SERVICES — it's a multi-parent convergence node
];

// P2 Collector Services — multi-parent convergence nodes
// P&L requires BOTH מע"מ (VAT) AND התאמות (Reconciliation) to be Done
export const P2_COLLECTOR_SERVICES = [
  { serviceKey: 'pnl_reports', title: 'דוח רווח והפסד', createCategory: 'רווח והפסד' },
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

  // VAT steps: report_prep → submission → payment
  // (income/expenses are dependency nodes P2_income/P2_expenses, not steps on this task)
  const reportPrep = updatedSteps?.report_prep?.done;
  const submission = updatedSteps?.submission?.done;

  // Both דיווח + תשלום done = production_completed (handled by authority evaluator)
  // Submission done only (no payment yet) = reported_pending_payment (handled by authority evaluator)
  // So here we only handle pre-submission logic:

  // Report prep done but not yet submitted
  if (reportPrep && !submission) {
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

  // Check if the P2_income (קליטת הכנסות) task is done for this client
  // income_input is now a separate task (income_collection), not a step on VAT
  const incomeTask = siblingTasks.find(t => {
    const s = getServiceForTask(t);
    return (s?.key === 'income_collection' || s?.key === 'bookkeeping') && t.client_name === task.client_name;
  });

  const incomeDone = incomeTask?.status === 'production_completed' || incomeTask?.status === 'completed';

  // Authority evaluator handles submission+payment → production_completed
  // Here we only handle pre-submission logic:
  if (incomeDone && isStepComplete(updatedSteps?.report_prep) && !isStepComplete(updatedSteps?.submission)) {
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
  // salary_entry, social_security_entry, deductions_entry → moved to P1_closing (payroll_closing)
];

/**
 * Evaluate payroll task status based on sequential step completion.
 *
 * MASTER TASK WORKFLOW:
 *   Phase A (ייצור שכר): 3-step payroll production (קבלת נתונים → הכנת תלושים → הגהה).
 *     V on last step → status becomes 'production_completed' (NOT 'completed').
 *     This triggers creation of Phase B + Phase C tasks.
 *   Phase B (דיווחי רשויות): ניכויים + ביטוח לאומי — auto-created.
 *   Phase C (שירותים נלווים): תלושים + מס"ב — auto-created.
 *   Closing (קליטה להנה"ח): salary_entry + authority entries — P1_closing node.
 *   The master payroll task reaches 'completed' only when ALL child tasks are done.
 *
 * @param {Object} task - The payroll task
 * @param {Object} updatedSteps - The new process_steps
 * @returns {{ status: string, autoCreateTasks?: Object[] } | null}
 */
export function evaluatePayrollStatus(task, updatedSteps) {
  const service = getServiceForTask(task);
  if (!service || service.key !== 'payroll') return null;

  // Count completed steps in order (done OR skipped both count)
  let lastDoneIndex = -1;
  for (let i = 0; i < PAYROLL_STEP_ORDER.length; i++) {
    const stepKey = PAYROLL_STEP_ORDER[i];
    if (isStepComplete(updatedSteps?.[stepKey])) {
      lastDoneIndex = i;
    } else {
      break; // Stop at first incomplete step (sequential)
    }
  }

  const result = {};

  // All 3 production steps done → production_completed (NOT completed)
  // The task stays visible with a "הושלם ייצור" badge.
  // It triggers Phase B + Phase C child tasks + P1_closing.
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
          estimated_duration: svc.serviceKey.startsWith('masav_') ? 15 : undefined,
        };
      });

    // Phase B + C child tasks (single-parent: this payroll task)
    const childTasks = [
      ...buildChildTasks(PHASE_B_SERVICES, 'phase_b', 'שלב ב\' | דיווחי רשויות'),
      ...buildChildTasks(PHASE_C_SERVICES, 'phase_c', 'שלב ג\' | שירותים נלווים'),
    ];

    // MSB Collector tasks — multi-parent: depend on ALL P1 reporting tasks
    // for this client+month. Initially locked (waiting_for_materials).
    const msbCollectors = MSB_COLLECTOR_SERVICES.map(svc => {
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
        status: 'waiting_for_materials',       // LOCKED until all deps done
        branch: 'P1',
        due_date: subDueDate,
        scheduled_start: autoStart || undefined,
        report_month: task.report_month,
        report_year: task.report_year,
        report_period: task.report_period,
        context: 'work',
        is_recurring: true,
        workflow_phase: 'msb_collector',
        workflow_phase_label: 'מס"ב רשויות — אוסף מרכזי',
        // Multi-parent: collect IDs of all Phase B reporting tasks
        dependency_ids: [],                     // Will be populated by useTaskCascade after creation
        is_collector: true,                     // Marks this as a multi-parent collector node
        master_task_id: task.id,
        triggered_by: task.id,
        source: 'payroll_cascade',
        process_steps: processSteps,
        estimated_duration: 15,
      };
    });

    result.autoCreateTasks = [...childTasks, ...msbCollectors];
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
  const doneCount = stepKeys.filter(k => isStepComplete(updatedSteps?.[k])).length;
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
          parent_id: task.id,
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

    const regularTasks = [
      ...buildP2Children(phaseB, 'phase_b', 'שלב ב\' | דיווחי מיסים'),
      ...buildP2Children(phaseC, 'phase_c', 'שלב ג\' | תוצרים'),
    ];

    // P&L Collector — convergence node with AND dependencies on VAT + Reconciliation
    const p2Collectors = P2_COLLECTOR_SERVICES.filter(svc =>
      !existingCategories.has(svc.createCategory)
    ).map(svc => {
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
        status: 'waiting_for_materials',       // LOCKED until VAT + Adjustments done
        branch: 'P2',
        due_date: subDueDate,
        report_month: task.report_month,
        report_year: task.report_year,
        report_period: task.report_period,
        context: 'work',
        is_recurring: true,
        workflow_phase: 'pnl_collector',
        workflow_phase_label: 'דו"ח רוה"ס — ממתין למע"מ + התאמות',
        dependency_ids: [],                     // Populated by useTaskCascade after sibling creation
        is_collector: true,
        master_task_id: task.id,
        triggered_by: task.id,
        source: 'bookkeeping_cascade',
        process_steps: processSteps,
      };
    });

    result.autoCreateTasks = [...regularTasks, ...p2Collectors];

    return result;
  }

  // Some steps done = still open
  if (doneCount > 0) {
    return { status: 'not_started' };
  }

  return null;
}

// ============================================================
// 2b-2. DEPENDENCY ENGINE: Collection → Tax/Advances activation
// ============================================================
// Pre-requisite logic: VAT and Tax Advances tasks only become
// 'Active' (not_started) once their dependency tasks (קליטת הכנסות
// and קליטת הוצאות) are marked as 'Done' (production_completed).

/**
 * Service keys that act as dependencies (pre-requisites).
 * Maps dependent service → required dependency service keys.
 */
export const SERVICE_DEPENDENCIES = {
  // VAT blocked until both income + expense collection are production_completed
  vat:            ['income_collection', 'expense_collection'],
  // VAT 874 same dependencies as regular VAT
  vat_874:        ['income_collection', 'expense_collection'],
  // Tax advances blocked until income collection is production_completed
  tax_advances:   ['income_collection'],
  // P&L convergence: requires BOTH מע"מ (VAT) AND התאמות (Reconciliation) to be Done
  pnl_reports:    ['vat_reporting', 'reconciliation'],
};

/**
 * Get open prerequisite tasks that should be auto-completed when a downstream
 * task is marked as production_completed.
 *
 * Example: VAT → production_completed → returns open [income_collection, expense_collection] tasks
 * Example: payroll_closing → production_completed → returns open child tasks (deductions, social_security, etc.)
 *
 * @param {Object} task - The task being completed
 * @param {Object[]} allTasks - All tasks for the same reporting month
 * @returns {{ prereqs: Object[], children: Object[] }} Open prerequisite tasks + open children
 */
export function getOpenPrerequisitesForCompletion(task, allTasks = []) {
  const service = getServiceForTask(task);
  const serviceKey = service?.key || task.serviceKey;
  const result = { prereqs: [], children: [] };

  // 1. Reverse SERVICE_DEPENDENCIES: if this task has deps, find open ones
  if (serviceKey) {
    const deps = SERVICE_DEPENDENCIES[serviceKey];
    if (deps && deps.length > 0) {
      for (const depKey of deps) {
        const depTask = allTasks.find(t => {
          const s = getServiceForTask(t);
          const tKey = s?.key || t.serviceKey;
          return tKey === depKey && t.client_name === task.client_name;
        });
        if (depTask && depTask.status !== 'production_completed') {
          result.prereqs.push(depTask);
        }
      }
    }
  }

  // 2. Find open child tasks (created by cascade) via parent_id or master_task_id
  const openChildren = allTasks.filter(t =>
    t.id !== task.id &&
    t.client_name === task.client_name &&
    (t.parent_id === task.id || t.master_task_id === task.id) &&
    t.status !== 'production_completed'
  );
  result.children = openChildren;

  return result;
}

// ── Reverse Next-Step AND Logic ──
// Reads service "nextStepIds" from ALL_SERVICES + localStorage overrides/customServices.
// If multiple services point to the same target via nextStepIds, that target requires
// ALL of them to complete (AND condition) — no separate "Prerequisites" field needed.

const LS_OVERRIDES_KEY = 'calmplan_service_overrides';
const LS_CUSTOM_KEY = 'calmplan_custom_services';

/**
 * Build a reverse prerequisite map from nextStepIds.
 * Returns { targetServiceKey → [sourceServiceKey1, sourceServiceKey2, ...] }
 * If a target has multiple sources, it means AND: all must complete to unlock.
 */
export function computeReversePrerequisites() {
  let overrides = {};
  let customServices = {};
  try { overrides = JSON.parse(localStorage.getItem(LS_OVERRIDES_KEY) || '{}'); } catch { /* ignore */ }
  try { customServices = JSON.parse(localStorage.getItem(LS_CUSTOM_KEY) || '{}'); } catch { /* ignore */ }

  // Merge: ALL_SERVICES + overrides + custom
  const merged = {};
  for (const [key, svc] of Object.entries(ALL_SERVICES)) {
    if (overrides[key]?._hidden) continue;
    merged[key] = { ...svc, ...(overrides[key] || {}) };
  }
  for (const [key, svc] of Object.entries(customServices)) {
    if (!ALL_SERVICES[key]) merged[key] = { ...svc };
  }

  // Build reverse map: target → [sources that point to it]
  const reverseMap = {};
  for (const [key, svc] of Object.entries(merged)) {
    const nextIds = svc.nextStepIds || (svc.nextStepId ? [svc.nextStepId] : []);
    for (const targetId of nextIds) {
      if (!reverseMap[targetId]) reverseMap[targetId] = [];
      if (!reverseMap[targetId].includes(key)) {
        reverseMap[targetId].push(key);
      }
    }
  }

  return reverseMap;
}

/**
 * Check if a task's dependencies are satisfied.
 * Returns true if all prerequisite tasks for the same client+month are done.
 *
 * @param {Object} task - The dependent task (e.g., VAT)
 * @param {Object[]} siblingTasks - All tasks for same client + reporting month
 * @returns {boolean}
 */
export function areDependenciesMet(task, siblingTasks = []) {
  // Path 1: Collector nodes with explicit dependency_ids array (AND logic)
  if (task.is_collector && Array.isArray(task.dependency_ids) && task.dependency_ids.length > 0) {
    return task.dependency_ids.every(depId => {
      const depTask = siblingTasks.find(t => t.id === depId);
      return depTask && depTask.status === 'production_completed';
    });
  }

  // Path 2: Service-based dependency lookup via SERVICE_DEPENDENCIES
  const service = getServiceForTask(task);
  // Also check by serviceKey field directly (for cascade-created tasks)
  const serviceKey = service?.key || task.serviceKey;
  if (!serviceKey) return true;

  const deps = SERVICE_DEPENDENCIES[serviceKey];

  // Path 2a: explicit SERVICE_DEPENDENCIES
  if (deps && deps.length > 0) {
    for (const depKey of deps) {
      const depTask = siblingTasks.find(t => {
        const s = getServiceForTask(t);
        const tKey = s?.key || t.serviceKey;
        return tKey === depKey && t.client_name === task.client_name;
      });
      if (!depTask || depTask.status !== 'production_completed') {
        return false;
      }
    }
    return true;
  }

  // Path 3: Reverse next-step AND logic — if multiple services point to this
  // service via nextStepIds, ALL of them must be production_completed
  try {
    const reverseMap = computeReversePrerequisites();
    const reversePrereqs = reverseMap[serviceKey];
    if (reversePrereqs && reversePrereqs.length > 1) {
      // AND condition: all source services must be done
      for (const prereqKey of reversePrereqs) {
        const prereqTask = siblingTasks.find(t => {
          const s = getServiceForTask(t);
          const tKey = s?.key || t.serviceKey;
          return tKey === prereqKey && t.client_name === task.client_name;
        });
        if (!prereqTask || prereqTask.status !== 'production_completed') {
          return false;
        }
      }
    }
  } catch { /* localStorage not available, skip */ }

  return true;
}

/**
 * Get the effective status for a task considering its dependencies.
 * If dependencies aren't met, force status to 'waiting_for_materials'.
 *
 * @param {Object} task - The task to evaluate
 * @param {Object[]} siblingTasks - All tasks for same client + reporting month
 * @returns {string|null} Override status or null if no override needed
 */
export function getDependencyStatus(task, siblingTasks = []) {
  // If task is already completed, don't override
  if (task.status === 'production_completed') return null;

  // Collectors always use areDependenciesMet
  if (task.is_collector) {
    return areDependenciesMet(task, siblingTasks) ? null : 'waiting_for_materials';
  }

  const service = getServiceForTask(task);
  const serviceKey = service?.key || task.serviceKey;
  if (!serviceKey) return null;

  // Check SERVICE_DEPENDENCIES or reverse next-step AND logic
  const deps = SERVICE_DEPENDENCIES[serviceKey];
  let hasPrereqs = deps && deps.length > 0;

  // Also check reverse map for multi-source AND
  if (!hasPrereqs) {
    try {
      const reverseMap = computeReversePrerequisites();
      const reversePrereqs = reverseMap[serviceKey];
      if (reversePrereqs && reversePrereqs.length > 1) hasPrereqs = true;
    } catch { /* ignore */ }
  }

  if (!hasPrereqs) return null;

  if (!areDependenciesMet(task, siblingTasks)) {
    return 'waiting_for_materials';
  }
  return null;
}

/**
 * Get human-readable reasons explaining WHY a task is blocked.
 * Works for both waiting_for_materials (dependency not done) and
 * reported_pending_payment (submitted, awaiting payment).
 *
 * @param {Object} task - The blocked task
 * @param {Object[]} allTasks - All tasks (across all services) for the same reporting month
 * @returns {string[]} e.g. ["קליטת הכנסות"], ["תשלום מע"מ"], ["ממתין לתשלום"]
 */
export function getBlockedByReasons(task, allTasks = []) {
  // --- reported_pending_payment: task itself was submitted, waiting for payment ---
  if (task.status === 'reported_pending_payment') {
    return ['ממתין לתשלום'];
  }

  // --- waiting_for_materials: upstream dependency not done ---
  if (task.status !== 'waiting_for_materials') return [];

  const service = getServiceForTask(task);
  const serviceKey = service?.key || task.serviceKey;
  if (!serviceKey) return [];

  const deps = SERVICE_DEPENDENCIES[serviceKey];
  if (!deps || deps.length === 0) return [];

  const missing = [];
  for (const depKey of deps) {
    const depTask = allTasks.find(t => {
      const s = getServiceForTask(t);
      const tKey = s?.key || t.serviceKey;
      return tKey === depKey && t.client_name === task.client_name;
    });
    if (!depTask || depTask.status !== 'production_completed') {
      const depService = ALL_SERVICES[depKey];
      const label = depService?.label || depKey;
      // More specific: if dep exists but is pending payment, say so
      if (depTask?.status === 'reported_pending_payment') {
        missing.push(`תשלום ${label}`);
      } else {
        missing.push(label);
      }
    }
  }

  return missing;
}

// ============================================================
// 2c. SOCIAL SECURITY CHAIN (מס"ב סוציאליות)
// ============================================================
// Dependency chain:
//   "משלוח קובץ למתפעל" (הושלם) → status: waiting_for_materials (ממתין לקובץ ממתפעל)
//   → "קבלת קובץ ממתפעל" (הושלם) → status: not_started (לבצע)
//   → "הכנת קובץ + העלאה" (הושלם) → status: ready_to_broadcast
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

  const sendToOperator = isStepComplete(updatedSteps?.send_to_operator);
  const receiveFile = isStepComplete(updatedSteps?.receive_file);
  const filePrep = isStepComplete(updatedSteps?.file_prep);
  const upload = isStepComplete(updatedSteps?.upload);
  const sendReceipts = isStepComplete(updatedSteps?.send_receipts);

  // Full chain complete → production_completed
  if (sendReceipts) {
    return { status: 'production_completed' };
  }

  // Upload done → ready to broadcast (awaiting confirmation/receipts)
  if (upload) {
    return { status: 'ready_to_broadcast' };
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
 * Submission without payment → reported_pending_payment (שודר, ממתין לתשלום).
 * Report prep done (no submission yet) → ready_to_broadcast (מוכן לשידור).
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
  const reportPrep = updatedSteps?.report_prep?.done;
  const filePrep = updatedSteps?.file_prep?.done;

  // Both דיווח + תשלום done → production_completed
  if (submission && payment) {
    return { status: 'production_completed' };
  }

  // דיווח done, תשלום pending → שודר, ממתין לתשלום
  if (submission && !payment) {
    return { status: 'reported_pending_payment' };
  }

  // Report prep + file prep done (ready to file) → מוכן לשידור
  if (reportPrep && filePrep) {
    return { status: 'ready_to_broadcast' };
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
      // Generic: all steps complete (done or skipped) = production_completed
      if (service.steps.length > 0) {
        const allDone = service.steps.every(s => isStepComplete(updatedSteps?.[s.key]));
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

  // ── DEPENDENCY ENGINE: Override status if prerequisites not met ──
  const depStatus = getDependencyStatus(task, siblingTasks);
  if (depStatus && !result.statusUpdate) {
    result.statusUpdate = { status: depStatus };
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
  // VAT steps are now report_prep → submission → payment only.
  // income/expenses are dependency tasks (P2_income/P2_expenses), not steps on VAT.
  const vatTasks = byService['vat'] || [];
  const vatReady = vatTasks.filter(t => {
    const steps = t.process_steps || {};
    return !isStepComplete(steps.report_prep) && !isStepComplete(steps.submission) && t.status === 'not_started';
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

  const vatInProgress = vatTasks.filter(t => {
    const steps = t.process_steps || {};
    return isStepComplete(steps.report_prep) && !isStepComplete(steps.submission);
  });
  if (vatInProgress.length > 0) {
    insights.push({
      type: 'progress',
      category: 'vat',
      icon: 'Clock',
      color: 'amber',
      title: `${vatInProgress.length} לקוחות ממתינים לשידור מע"מ`,
      description: vatInProgress.map(t => t.client_name).join(', '),
      count: vatInProgress.length,
      priority: 2,
    });
  }

  // --- Payroll Insights ---
  const payrollTasks = byService['payroll'] || [];
  const inRevision = payrollTasks.filter(t =>
    t.status === 'sent_for_review' || t.status === 'review_after_corrections' || t.status === 'needs_corrections'
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
