/**
 * Process Templates Configuration
 *
 * Defines all service categories and their process steps.
 * Each service has a template of steps that can be tracked per task.
 *
 * dashboard: 'tax' | 'payroll' - which dashboard this belongs to
 * taskCategories: array of category keys that map to this service (Hebrew + English)
 * steps: ordered array of process steps with key, label, and optional config
 */

// ============================================================
// TAX-RELATED SERVICES
// ============================================================

export const TAX_SERVICES = {
  vat: {
    key: 'vat',
    label: 'מע"מ',
    dashboard: 'tax',
    taskType: 'authority',  // Authority task → gets דיווח + תשלום sub-tasks
    taskCategories: ['מע"מ', 'work_vat_reporting'],
    createCategory: 'מע"מ',
    steps: [
      { key: 'income_input',   label: 'קליטת הכנסות',  icon: 'download' },
      { key: 'expense_input',  label: 'קליטת הוצאות',  icon: 'download', allowMultiple: true },
      { key: 'report_prep',    label: 'הכנת דו"ח',     icon: 'file-text' },
      { key: 'submission',     label: 'דיווח',          icon: 'send' },
      { key: 'payment',        label: 'תשלום',          icon: 'landmark' },
    ],
  },

  tax_advances: {
    key: 'tax_advances',
    label: 'מקדמות מס הכנסה',
    dashboard: 'tax',
    taskType: 'authority',  // Authority task → gets דיווח + תשלום sub-tasks
    taskCategories: ['מקדמות מס', 'work_tax_advances'],
    createCategory: 'מקדמות מס',
    steps: [
      { key: 'calculation',  label: 'חישוב מקדמות', icon: 'calculator' },
      { key: 'submission',   label: 'דיווח',         icon: 'send' },
      { key: 'payment',      label: 'תשלום',         icon: 'landmark' },
    ],
  },

  vat_874: {
    key: 'vat_874',
    label: 'מע"מ 874',
    dashboard: 'tax',
    taskCategories: ['מע"מ 874', 'work_vat_874'],
    createCategory: 'מע"מ 874',
    steps: [
      { key: 'data_export',  label: 'הפקת נתונים',  icon: 'database' },
      { key: 'report_prep',  label: 'הכנת דו"ח 874', icon: 'file-text' },
      { key: 'submission',   label: 'שידור',          icon: 'send' },
    ],
  },
};

// ============================================================
// PAYROLL-RELATED SERVICES
// ============================================================

export const PAYROLL_SERVICES = {
  payroll: {
    key: 'payroll',
    label: 'שכר',
    dashboard: 'payroll',
    taskType: 'linear',  // Linear task — no דיווח/תשלום sub-tasks
    taskCategories: ['שכר', 'work_payroll'],
    createCategory: 'שכר',
    steps: [
      { key: 'receive_data',            label: 'קבלת נתונים',              icon: 'inbox' },
      { key: 'prepare_payslips',        label: 'הכנת תלושים',              icon: 'file-text' },
      { key: 'proofreading',            label: 'הגהה',                     icon: 'eye' },
      { key: 'salary_entry',            label: 'קליטת פקודת שכר',          icon: 'calculator' },
      { key: 'employee_payments',       label: 'רישום תשלומי עובדים',      icon: 'landmark' },
      { key: 'authority_payments',      label: 'רישום תשלומי רשויות שכר',  icon: 'send' },
    ],
  },

  social_security: {
    key: 'social_security',
    label: 'ביטוח לאומי',
    dashboard: 'payroll',
    taskType: 'authority',  // Authority task → gets דיווח + תשלום sub-tasks
    taskCategories: ['ביטוח לאומי', 'work_social_security'],
    createCategory: 'ביטוח לאומי',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'submission',   label: 'דיווח',       icon: 'send' },
      { key: 'payment',      label: 'תשלום',       icon: 'landmark' },
    ],
  },

  deductions: {
    key: 'deductions',
    label: 'ניכויים',
    dashboard: 'payroll',
    taskType: 'authority',  // Authority task → gets דיווח + תשלום sub-tasks
    taskCategories: ['ניכויים', 'work_deductions'],
    createCategory: 'ניכויים',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'submission',   label: 'דיווח',       icon: 'send' },
      { key: 'payment',      label: 'תשלום',       icon: 'landmark' },
    ],
  },
};

// ============================================================
// ADDITIONAL SERVICES (can be added to either dashboard)
// ============================================================

export const ADDITIONAL_SERVICES = {
  bookkeeping: {
    key: 'bookkeeping',
    label: 'הנהלת חשבונות',
    dashboard: 'tax',
    taskCategories: ['הנהלת חשבונות', 'work_bookkeeping'],
    createCategory: 'הנהלת חשבונות',
    steps: [
      { key: 'income_input',   label: 'קליטת הכנסות',  icon: 'download' },
      { key: 'expense_input',  label: 'קליטת הוצאות',  icon: 'download', allowMultiple: true },
      { key: 'reconciliation', label: 'התאמות',         icon: 'check-square' },
    ],
  },

  reconciliation: {
    key: 'reconciliation',
    label: 'התאמות חשבונות',
    dashboard: 'tax',
    taskCategories: ['התאמות', 'work_reconciliation'],
    createCategory: 'התאמות',
    supportsComplexity: true,
    steps: [
      { key: 'bank_statements', label: 'קבלת דפי בנק',     icon: 'file-down' },
      { key: 'reconcile',       label: 'ביצוע התאמה',       icon: 'check-square' },
      { key: 'differences',     label: 'טיפול בהפרשים',    icon: 'alert-triangle' },
    ],
    // Extended steps for High complexity clients (multiple accounts)
    highComplexitySteps: [
      { key: 'bank_statements',      label: 'קבלת דפי בנק',           icon: 'file-down' },
      { key: 'reconcile_primary',    label: 'התאמה - חשבון ראשי',     icon: 'check-square' },
      { key: 'reconcile_secondary',  label: 'התאמה - חשבונות נוספים', icon: 'check-square' },
      { key: 'cross_check',          label: 'בדיקת סבירות צולבת',     icon: 'eye' },
      { key: 'differences',          label: 'טיפול בהפרשים',          icon: 'alert-triangle' },
      { key: 'final_review',         label: 'סקירה סופית',            icon: 'check-circle' },
    ],
  },

  annual_reports: {
    key: 'annual_reports',
    label: 'דוחות שנתיים / מאזנים',
    dashboard: 'tax',
    taskCategories: ['דוח שנתי', 'work_annual_reports'],
    createCategory: 'דוח שנתי',
    supportsComplexity: true,
    steps: [
      { key: 'gather_materials', label: 'איסוף חומרים',  icon: 'inbox' },
      { key: 'report_prep',      label: 'הכנת דו"ח',     icon: 'file-text' },
      { key: 'review',           label: 'עיון ובדיקה',   icon: 'eye' },
      { key: 'submission',       label: 'הגשה',           icon: 'send' },
    ],
    // Extended steps for High complexity balance sheets
    highComplexitySteps: [
      { key: 'gather_materials',   label: 'איסוף חומרים',         icon: 'inbox' },
      { key: 'data_entry',         label: 'קליטת נתונים',         icon: 'download' },
      { key: 'base_reconciliation', label: 'התאמות יסוד',         icon: 'check-square' },
      { key: 'sanity_check',       label: 'בדיקת סבירות',        icon: 'eye' },
      { key: 'review',             label: 'סקירה',               icon: 'eye' },
      { key: 'final_close',        label: 'סגירה',               icon: 'check-circle' },
      { key: 'submission',         label: 'הגשה',                icon: 'send' },
    ],
  },

  authorities_payment: {
    key: 'authorities_payment',
    label: 'תשלום רשויות',
    dashboard: 'payroll',
    taskCategories: ['תשלום רשויות', 'work_authorities_payment'],
    createCategory: 'תשלום רשויות',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'payment',      label: 'תשלום',       icon: 'landmark' },
    ],
  },

  reserve_claims: {
    key: 'reserve_claims',
    label: 'תביעות מילואים',
    dashboard: 'payroll',
    taskCategories: ['מילואים', 'work_reserve_claims'],
    createCategory: 'מילואים',
    steps: [
      { key: 'claim_prep',     label: 'הכנת תביעה',       icon: 'file-text' },
      { key: 'claim_submit',   label: 'הגשה לביט"ל',      icon: 'send' },
      { key: 'pending_funds',  label: 'ממתין לכספים',     icon: 'clock',  autoStatus: 'pending_external' },
      { key: 'follow_up',      label: 'עדכון בשכר',       icon: 'check-circle' },
    ],
  },

  social_benefits: {
    key: 'social_benefits',
    label: 'הנחיות מס"ב ממתפעל',
    dashboard: 'payroll',
    taskCategories: ['הנחיות מס"ב ממתפעל', 'סוציאליות', 'work_social_benefits'],
    createCategory: 'הנחיות מס"ב ממתפעל',
    steps: [
      { key: 'receive_instructions', label: 'קבלת הנחיות',  icon: 'inbox',         nextStepIds: ['execution', 'notify_client'] },
      { key: 'execution',            label: 'ביצוע',         icon: 'check-circle',  nextStepIds: ['confirmation'] },
      { key: 'notify_client',        label: 'עדכון לקוח',    icon: 'phone',         nextStepIds: ['confirmation'] },
      { key: 'confirmation',         label: 'אישור סיום',    icon: 'check-circle',  nextStepIds: [] },
    ],
  },

  masav_employees: {
    key: 'masav_employees',
    label: 'מס"ב עובדים',
    dashboard: 'payroll',
    taskType: 'linear',  // Linear task — no דיווח/תשלום sub-tasks
    taskCategories: ['מס"ב עובדים', 'work_masav'],
    createCategory: 'מס"ב עובדים',
    steps: [
      { key: 'file_prep',    label: 'הכנת קובץ',   icon: 'file-text' },
      { key: 'upload',       label: 'העלאה',        icon: 'upload' },
      { key: 'confirmation', label: 'אישור ביצוע',  icon: 'check-circle' },
    ],
  },

  consulting: {
    key: 'consulting',
    label: 'ייעוץ',
    dashboard: 'tax',
    taskCategories: ['ייעוץ', 'work_consulting'],
    createCategory: 'ייעוץ',
    steps: [
      { key: 'consultation',  label: 'ביצוע ייעוץ',   icon: 'message-square' },
      { key: 'summary',       label: 'סיכום ותיעוד',   icon: 'file-text' },
    ],
  },

  admin: {
    key: 'admin',
    label: 'אדמיניסטרציה',
    dashboard: 'admin',
    taskCategories: ['אדמיניסטרציה', 'work_admin'],
    createCategory: 'אדמיניסטרציה',
    steps: [
      { key: 'task',  label: 'ביצוע',  icon: 'check-circle' },
    ],
  },

  marketing_followup: {
    key: 'marketing_followup',
    label: 'מעקב שיווק',
    dashboard: 'admin',
    taskCategories: ['מעקב שיווק', 'work_marketing'],
    createCategory: 'מעקב שיווק',
    steps: [
      { key: 'contact',   label: 'יצירת קשר',  icon: 'phone' },
      { key: 'follow_up', label: 'מעקב',        icon: 'clock' },
    ],
  },

  client_callback: {
    key: 'client_callback',
    label: 'לחזור ללקוח',
    dashboard: 'admin',
    taskCategories: ['לחזור ללקוח', 'work_callback'],
    createCategory: 'לחזור ללקוח',
    steps: [
      { key: 'call',  label: 'ביצוע שיחה',  icon: 'phone' },
    ],
  },

  meeting: {
    key: 'meeting',
    label: 'פגישה',
    dashboard: 'admin',
    taskCategories: ['פגישה', 'work_meeting'],
    createCategory: 'פגישה',
    steps: [
      { key: 'schedule',  label: 'תיאום',    icon: 'calendar' },
      { key: 'execute',   label: 'ביצוע',    icon: 'check-circle' },
    ],
  },

  general: {
    key: 'general',
    label: 'כללי',
    dashboard: 'admin',
    taskCategories: ['כללי', 'work_general', ''],
    createCategory: 'כללי',
    steps: [
      { key: 'task',  label: 'ביצוע',  icon: 'check-circle' },
    ],
  },

  masav_social: {
    key: 'masav_social',
    label: 'מס"ב סוציאליות',
    dashboard: 'payroll',
    taskType: 'linear',  // Linear task — full chain encoded as steps
    sequentialSteps: true, // ENFORCE: each step requires previous step to be done
    taskCategories: ['מס"ב סוציאליות', 'work_masav_social'],
    createCategory: 'מס"ב סוציאליות',
    // Social Security Chain (ENFORCED LINEAR):
    // 1. send_to_operator(הושלם) → status: waiting_for_materials (ממתין לקובץ ממתפעל)
    // 2. receive_file(הושלם) → status: not_started (לבצע - הזנת קובץ משנה)
    // 3. file_prep + upload(הושלם) → status: sent_for_review
    // 4. send_receipts(הושלם) → status: production_completed (פותח משלוח אסמכתאות)
    steps: [
      { key: 'send_to_operator', label: 'משלוח קובץ למתפעל', icon: 'send' },
      { key: 'receive_file',     label: 'קבלת קובץ ממתפעל',  icon: 'inbox',       requiresPrev: true },
      { key: 'file_prep',        label: 'הכנת קובץ מס"ב',    icon: 'file-text',   requiresPrev: true },
      { key: 'upload',           label: 'העלאה',              icon: 'upload',      requiresPrev: true },
      { key: 'send_receipts',    label: 'משלוח אסמכתאות',     icon: 'check-circle', requiresPrev: true },
    ],
  },

  masav_authorities: {
    key: 'masav_authorities',
    label: 'מס"ב רשויות',
    dashboard: 'payroll',
    taskCategories: ['מס"ב רשויות', 'work_masav_authorities'],
    createCategory: 'מס"ב רשויות',
    steps: [
      { key: 'file_prep',    label: 'הכנת קובץ',   icon: 'file-text' },
      { key: 'upload',       label: 'העלאה',        icon: 'upload' },
      { key: 'confirmation', label: 'אישור ביצוע',  icon: 'check-circle' },
    ],
  },

  masav_suppliers: {
    key: 'masav_suppliers',
    label: 'מס"ב ספקים',
    dashboard: 'payroll',
    taskCategories: ['מס"ב ספקים', 'work_masav_suppliers'],
    createCategory: 'מס"ב ספקים',
    steps: [
      { key: 'file_prep',    label: 'הכנת קובץ',   icon: 'file-text' },
      { key: 'upload',       label: 'העלאה',        icon: 'upload' },
      { key: 'confirmation', label: 'אישור ביצוע',  icon: 'check-circle' },
    ],
  },

  operator_reporting: {
    key: 'operator_reporting',
    label: 'דיווח למתפעל',
    dashboard: 'additional',
    taskCategories: ['דיווח למתפעל', 'work_operator_reporting'],
    createCategory: 'דיווח למתפעל',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'submission',   label: 'שליחה',       icon: 'send' },
    ],
  },

  taml_reporting: {
    key: 'taml_reporting',
    label: 'דיווח לטמל',
    dashboard: 'additional',
    taskCategories: ['דיווח לטמל', 'work_taml_reporting'],
    createCategory: 'דיווח לטמל',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'submission',   label: 'שליחה',       icon: 'send' },
    ],
  },

  payslip_sending: {
    key: 'payslip_sending',
    label: 'משלוח תלושים',
    dashboard: 'payroll',
    taskType: 'linear',  // Linear task — no דיווח/תשלום sub-tasks
    taskCategories: ['משלוח תלושים', 'work_payslip_sending'],
    createCategory: 'משלוח תלושים',
    steps: [
      { key: 'generate',  label: 'הפקת תלושים',  icon: 'file-output' },
      { key: 'send',      label: 'שליחה',         icon: 'send' },
    ],
  },
};

// ============================================================
// COMBINED & HELPERS
// ============================================================

export const ALL_SERVICES = {
  ...TAX_SERVICES,
  ...PAYROLL_SERVICES,
  ...ADDITIONAL_SERVICES,
};

/**
 * Get all services that belong to a specific dashboard
 */
export function getServicesByDashboard(dashboardType) {
  return Object.values(ALL_SERVICES).filter(s => s.dashboard === dashboardType);
}

/**
 * Find which service a task belongs to, based on its category
 */
export function getServiceForTask(task) {
  if (!task?.category) return null;
  return Object.values(ALL_SERVICES).find(service =>
    service.taskCategories.includes(task.category)
  );
}

/**
 * Check if a task is an "authority" task (gets דיווח + תשלום sub-tasks).
 * Authority tasks: מע"מ, מקדמות מס, ביטוח לאומי, ניכויים.
 * All others (שכר, מס"ב, תלושים) are linear — no sub-tasks.
 */
export function isAuthorityTask(task) {
  const service = getServiceForTask(task);
  return service?.taskType === 'authority';
}

/**
 * Get the "דיווח" + "תשלום" sub-steps for authority tasks only.
 * Returns empty array for linear/non-authority tasks.
 */
export function getAuthoritySubSteps(task) {
  const service = getServiceForTask(task);
  if (service?.taskType !== 'authority') return [];
  return (service.steps || []).filter(s => s.key === 'submission' || s.key === 'payment');
}

/**
 * Get the default steps for a given service key
 */
export function getStepsForService(serviceKey) {
  return ALL_SERVICES[serviceKey]?.steps || [];
}

/**
 * Get all task categories that belong to a dashboard type
 */
export function getCategoriesForDashboard(dashboardType) {
  const services = getServicesByDashboard(dashboardType);
  return services.flatMap(s => s.taskCategories);
}

/**
 * Initialize process_steps for a task based on its service template.
 * Returns existing steps if already set, or empty defaults from template.
 * For services with supportsComplexity, uses highComplexitySteps when task.complexity === 'high'.
 */
export function getTaskProcessSteps(task) {
  const service = getServiceForTask(task);
  if (!service) return {};

  // Choose steps based on task complexity
  const useHighComplexity = service.supportsComplexity && task?.complexity === 'high' && service.highComplexitySteps;
  const templateSteps = useHighComplexity ? service.highComplexitySteps : service.steps;

  const existingSteps = task.process_steps || {};
  const result = {};

  for (const step of templateSteps) {
    result[step.key] = existingSteps[step.key] || { done: false, date: null, notes: '' };
  }

  return result;
}

/**
 * Get the step template for a task, accounting for complexity.
 */
export function getStepsForTask(task) {
  const service = getServiceForTask(task);
  if (!service) return [];

  if (service.supportsComplexity && task?.complexity === 'high' && service.highComplexitySteps) {
    return service.highComplexitySteps;
  }
  return service.steps;
}

/**
 * Check if a step is locked (cannot be toggled) due to sequential enforcement.
 * For services with sequentialSteps=true, a step is locked unless all previous steps are done.
 *
 * @param {Object} task - Task entity
 * @param {string} stepKey - The step key to check
 * @returns {boolean} true if the step is locked
 */
export function isStepLocked(task, stepKey) {
  const service = getServiceForTask(task);
  if (!service?.sequentialSteps) return false;

  const steps = service.steps || [];
  const currentSteps = task.process_steps || {};
  const stepIndex = steps.findIndex(s => s.key === stepKey);
  if (stepIndex <= 0) return false; // First step is never locked

  // Check if ALL previous steps are done
  for (let i = 0; i < stepIndex; i++) {
    if (!currentSteps[steps[i].key]?.done) return true;
  }
  return false;
}

/**
 * Toggle a step's done state and auto-set date
 */
export function toggleStep(currentSteps, stepKey) {
  const step = currentSteps[stepKey] || { done: false, date: null, notes: '' };
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return {
    ...currentSteps,
    [stepKey]: {
      ...step,
      done: !step.done,
      date: !step.done ? now : null, // set date when marking done, clear when unmarking
    },
  };
}

/**
 * Calculate completion percentage for a task's process steps
 */
export function getStepCompletionPercent(task) {
  const templateSteps = getStepsForTask(task);
  if (!templateSteps.length) return 0;

  const steps = task.process_steps || {};
  const doneSteps = templateSteps.filter(s => steps[s.key]?.done).length;
  return Math.round((doneSteps / templateSteps.length) * 100);
}

// ============================================================
// BIMONTHLY HELPERS
// ============================================================

// Map service/column keys to client reporting_info frequency fields
const FREQUENCY_FIELD_MAP = {
  vat: 'vat_reporting_frequency',
  tax_advances: 'tax_advances_frequency',
  deductions: 'deductions_frequency',
  social_security: 'social_security_frequency',
};

/**
 * Check if a given month is an off-month for bimonthly reporting.
 * Bimonthly reports cover pairs: Jan-Feb, Mar-Apr, May-Jun, etc.
 * Reports are filed on even months (Feb, Apr, Jun, Aug, Oct, Dec).
 * Odd months (Jan, Mar, May, Jul, Sep, Nov) are off-months → "לא רלוונטי".
 *
 * @param {Object} client - Client entity with reporting_info
 * @param {string} serviceKey - Service key (vat, tax_advances, deductions)
 * @param {Date|number} month - Date object or 0-indexed month number
 * @returns {boolean} true if this is an off-month for the client's bimonthly reporting
 */
export function isBimonthlyOffMonth(client, serviceKey, month) {
  const field = FREQUENCY_FIELD_MAP[serviceKey];
  if (!field) return false;

  const frequency = client?.reporting_info?.[field];
  if (frequency !== 'bimonthly') return false;

  const monthIndex = month instanceof Date ? month.getMonth() : month;
  // Off months: Jan(0), Mar(2), May(4), Jul(6), Sep(8), Nov(10) = even 0-indexed
  return monthIndex % 2 === 0;
}

/**
 * Mark ALL steps as done for a task (used when status → completed)
 * Returns the updated process_steps object
 */
export function markAllStepsDone(task) {
  const templateSteps = getStepsForTask(task);
  if (!templateSteps.length) return task.process_steps || {};

  const now = new Date().toISOString().split('T')[0];
  const existingSteps = task.process_steps || {};
  const result = {};

  for (const step of templateSteps) {
    const existing = existingSteps[step.key] || {};
    result[step.key] = {
      done: true,
      date: existing.date || now,
      notes: existing.notes || '',
    };
  }

  return result;
}

/**
 * Mark ALL steps as undone for a task (used when reverting from completed)
 * Returns the updated process_steps object
 */
export function markAllStepsUndone(task) {
  const templateSteps = getStepsForTask(task);
  if (!templateSteps.length) return task.process_steps || {};

  const existingSteps = task.process_steps || {};
  const result = {};

  for (const step of templateSteps) {
    const existing = existingSteps[step.key] || {};
    result[step.key] = {
      done: false,
      date: null,
      notes: existing.notes || '',
    };
  }

  return result;
}

/**
 * Check if ALL steps are done for a task
 */
export function areAllStepsDone(task) {
  const templateSteps = getStepsForTask(task);
  if (!templateSteps.length) return false;

  const steps = task.process_steps || {};
  return templateSteps.every(s => steps[s.key]?.done);
}

// ============================================================
// THE GOLDEN LIST — 5 exclusive workflow statuses
// ============================================================
// Safe migration: old statuses are mapped (not deleted) to preserve data.
// The trigger: "הושלם ייצור" is the ONLY status that fires cascade creation.

export const STATUS_CONFIG = {
  waiting_for_materials:  { label: 'ממתין לחומרים',  bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-200',   priority: 1 },
  not_started:            { label: 'לבצע',           bg: 'bg-slate-200',   text: 'text-slate-800',   border: 'border-slate-300',   priority: 2 },
  sent_for_review:        { label: 'הועבר לעיון',    bg: 'bg-purple-200',  text: 'text-purple-800',  border: 'border-purple-300',  priority: 3 },
  needs_corrections:      { label: 'לבצע תיקונים',   bg: 'bg-orange-200',  text: 'text-orange-800',  border: 'border-orange-300',  priority: 3 },
  production_completed:   { label: 'הושלם ייצור',    bg: 'bg-emerald-400', text: 'text-white',       border: 'border-emerald-500', priority: 5 },
};

export const TASK_STATUS_CONFIG = {
  waiting_for_materials:  { text: 'ממתין לחומרים',  color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  not_started:            { text: 'לבצע',           color: 'bg-slate-100 text-slate-700',     dot: 'bg-slate-400' },
  sent_for_review:        { text: 'הועבר לעיון',    color: 'bg-purple-100 text-purple-700',   dot: 'bg-purple-500' },
  needs_corrections:      { text: 'לבצע תיקונים',   color: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500' },
  production_completed:   { text: 'הושלם ייצור',    color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

// ============================================================
// SAFE STATUS MIGRATION MAP — old status → new status
// No data is deleted. Existing tasks with legacy statuses get remapped.
// ============================================================
export const STATUS_MIGRATION_MAP = {
  // Direct mappings
  waiting_for_materials:         'waiting_for_materials',
  not_started:                   'not_started',
  production_completed:          'production_completed',
  // "בעבודה" / active → "לבצע"
  in_progress:                   'not_started',
  remaining_completions:         'not_started',
  // "הושלם" / 100% → "הושלם ייצור"
  completed:                     'production_completed',
  // "לבדיקה" → "הועבר לעיון"
  waiting_for_approval:          'sent_for_review',
  // All others → "לבצע"
  postponed:                     'not_started',
  issue:                         'needs_corrections',
  ready_for_reporting:           'not_started',
  reported_waiting_for_payment:  'not_started',
  pending_external:              'not_started',
  waiting_on_client:             'waiting_for_materials',
  not_relevant:                  'production_completed',
};

/**
 * Normalize any legacy status to one of the 5 golden statuses.
 * Safe: returns the status as-is if already valid.
 */
export function migrateStatus(status) {
  if (STATUS_CONFIG[status]) return status;
  return STATUS_MIGRATION_MAP[status] || 'not_started';
}

// ============================================================
// MULTI-FLOW: nextStepIds support
// ============================================================

/**
 * Get the next step IDs for a given step within a service.
 * If the step has explicit nextStepIds, returns that array.
 * Otherwise falls back to the implicit next step (index + 1) for linear flows.
 * Returns empty array if it's the last step.
 */
export function getNextStepIds(serviceKey, stepKey) {
  const service = ALL_SERVICES[serviceKey];
  if (!service?.steps) return [];
  const step = service.steps.find(s => s.key === stepKey);
  if (step?.nextStepIds) return step.nextStepIds;
  // Fallback: implicit linear ordering
  const idx = service.steps.findIndex(s => s.key === stepKey);
  if (idx < 0 || idx >= service.steps.length - 1) return [];
  return [service.steps[idx + 1].key];
}

/**
 * Build a full flow graph (adjacency list) for a service.
 * Returns { [stepKey]: string[] } — each key maps to its nextStepIds.
 */
export function getServiceFlowGraph(serviceKey) {
  const service = ALL_SERVICES[serviceKey];
  if (!service?.steps) return {};
  const graph = {};
  service.steps.forEach((step, idx) => {
    if (step.nextStepIds) {
      graph[step.key] = step.nextStepIds;
    } else {
      // Linear fallback
      graph[step.key] = idx < service.steps.length - 1 ? [service.steps[idx + 1].key] : [];
    }
  });
  return graph;
}
