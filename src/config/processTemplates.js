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
    taskCategories: ['מע"מ', 'work_vat_reporting'],
    createCategory: 'מע"מ',
    steps: [
      { key: 'income_input',   label: 'קליטת הכנסות',  icon: 'download' },
      { key: 'expense_input',  label: 'קליטת הוצאות',  icon: 'download', allowMultiple: true },
      { key: 'report_prep',    label: 'הכנת דו"ח',     icon: 'file-text' },
      { key: 'submission',     label: 'דיווח',          icon: 'send' },
    ],
  },

  tax_advances: {
    key: 'tax_advances',
    label: 'מקדמות מס הכנסה',
    dashboard: 'tax',
    taskCategories: ['מקדמות מס', 'work_tax_advances'],
    createCategory: 'מקדמות מס',
    steps: [
      { key: 'calculation',  label: 'חישוב מקדמות', icon: 'calculator' },
      { key: 'submission',   label: 'דיווח ותשלום',  icon: 'send' },
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
    taskCategories: ['ביטוח לאומי', 'work_social_security'],
    createCategory: 'ביטוח לאומי',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'submission',   label: 'דיווח',       icon: 'send' },
    ],
  },

  deductions: {
    key: 'deductions',
    label: 'ניכויים',
    dashboard: 'payroll',
    taskCategories: ['ניכויים', 'work_deductions'],
    createCategory: 'ניכויים',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'submission',   label: 'דיווח',       icon: 'send' },
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
    steps: [
      { key: 'bank_statements', label: 'קבלת דפי בנק',     icon: 'file-down' },
      { key: 'reconcile',       label: 'ביצוע התאמה',       icon: 'check-square' },
      { key: 'differences',     label: 'טיפול בהפרשים',    icon: 'alert-triangle' },
    ],
  },

  annual_reports: {
    key: 'annual_reports',
    label: 'דוחות שנתיים / מאזנים',
    dashboard: 'tax',
    taskCategories: ['דוח שנתי', 'work_annual_reports'],
    createCategory: 'דוח שנתי',
    steps: [
      { key: 'gather_materials', label: 'איסוף חומרים',  icon: 'inbox' },
      { key: 'report_prep',      label: 'הכנת דו"ח',     icon: 'file-text' },
      { key: 'review',           label: 'עיון ובדיקה',   icon: 'eye' },
      { key: 'submission',       label: 'הגשה',           icon: 'send' },
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
      { key: 'follow_up',      label: 'מעקב טיפול',       icon: 'clock' },
    ],
  },

  social_benefits: {
    key: 'social_benefits',
    label: 'הנחיות מס"ב ממתפעל',
    dashboard: 'payroll',
    taskCategories: ['הנחיות מס"ב ממתפעל', 'סוציאליות', 'work_social_benefits'],
    createCategory: 'הנחיות מס"ב ממתפעל',
    steps: [
      { key: 'receive_instructions', label: 'קבלת הנחיות',  icon: 'inbox' },
      { key: 'execution',            label: 'ביצוע',         icon: 'check-circle' },
    ],
  },

  masav_employees: {
    key: 'masav_employees',
    label: 'מס"ב עובדים',
    dashboard: 'payroll',
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
    dashboard: 'tax',
    taskCategories: ['אדמיניסטרציה', 'work_admin'],
    createCategory: 'אדמיניסטרציה',
    steps: [
      { key: 'task',  label: 'ביצוע',  icon: 'check-circle' },
    ],
  },

  masav_social: {
    key: 'masav_social',
    label: 'מס"ב סוציאליות',
    dashboard: 'payroll',
    taskCategories: ['מס"ב סוציאליות', 'work_masav_social'],
    createCategory: 'מס"ב סוציאליות',
    steps: [
      { key: 'file_prep',    label: 'הכנת קובץ',   icon: 'file-text' },
      { key: 'upload',       label: 'העלאה',        icon: 'upload' },
      { key: 'confirmation', label: 'אישור ביצוע',  icon: 'check-circle' },
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
 */
export function getTaskProcessSteps(task) {
  const service = getServiceForTask(task);
  if (!service) return {};

  const existingSteps = task.process_steps || {};
  const result = {};

  for (const step of service.steps) {
    result[step.key] = existingSteps[step.key] || { done: false, date: null, notes: '' };
  }

  return result;
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
  const service = getServiceForTask(task);
  if (!service) return 0;

  const steps = task.process_steps || {};
  const totalSteps = service.steps.length;
  if (totalSteps === 0) return 100;

  const doneSteps = service.steps.filter(s => steps[s.key]?.done).length;
  return Math.round((doneSteps / totalSteps) * 100);
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
  const service = getServiceForTask(task);
  if (!service) return task.process_steps || {};

  const now = new Date().toISOString().split('T')[0];
  const existingSteps = task.process_steps || {};
  const result = {};

  for (const step of service.steps) {
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
  const service = getServiceForTask(task);
  if (!service) return task.process_steps || {};

  const existingSteps = task.process_steps || {};
  const result = {};

  for (const step of service.steps) {
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
  const service = getServiceForTask(task);
  if (!service) return false;

  const steps = task.process_steps || {};
  return service.steps.length > 0 && service.steps.every(s => steps[s.key]?.done);
}

// Status definitions shared across dashboards
// Dashboard status config (used in process dashboards)
export const STATUS_CONFIG = {
  not_started:                   { label: 'נותרו השלמות',   bg: 'bg-cyan-200',       text: 'text-cyan-800',     border: 'border-cyan-300',    priority: 3 },
  in_progress:                   { label: 'בעבודה',         bg: 'bg-emerald-200',    text: 'text-emerald-900',  border: 'border-emerald-300', priority: 2 },
  completed:                     { label: 'הושלם',          bg: 'bg-emerald-400',    text: 'text-white',        border: 'border-emerald-500', priority: 5 },
  postponed:                     { label: 'נדחה',           bg: 'bg-gray-300',       text: 'text-gray-600',     border: 'border-gray-400',    priority: 4 },
  waiting_for_approval:          { label: 'לבדיקה',         bg: 'bg-amber-200',      text: 'text-amber-900',    border: 'border-amber-300',   priority: 2 },
  waiting_for_materials:         { label: 'ממתין לחומרים',  bg: 'bg-amber-100',      text: 'text-amber-800',    border: 'border-amber-200',   priority: 1 },
  issue:                         { label: 'דורש טיפול',     bg: 'bg-amber-300',      text: 'text-amber-900',    border: 'border-amber-400',   priority: 0 },
  ready_for_reporting:           { label: 'מוכן לדיווח',    bg: 'bg-teal-200',       text: 'text-teal-900',     border: 'border-teal-300',    priority: 3 },
  reported_waiting_for_payment:  { label: 'ממתין לתשלום',   bg: 'bg-sky-200',        text: 'text-sky-900',      border: 'border-sky-300',     priority: 4 },
  not_relevant:                  { label: 'לא רלוונטי',     bg: 'bg-gray-100',       text: 'text-gray-400',     border: 'border-gray-200',    priority: 6 },
};

// Simple badge-style status config (used in task lists/pages)
export const TASK_STATUS_CONFIG = {
  not_started:                   { text: 'נותרו השלמות',     color: 'bg-cyan-100 text-cyan-700',      dot: 'bg-cyan-400' },
  in_progress:                   { text: 'בעבודה',          color: 'bg-sky-100 text-sky-700',         dot: 'bg-sky-500' },
  completed:                     { text: 'הושלם',           color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  postponed:                     { text: 'נדחה',            color: 'bg-neutral-100 text-neutral-600', dot: 'bg-neutral-400' },
  waiting_for_approval:          { text: 'לבדיקה',          color: 'bg-purple-100 text-purple-700',   dot: 'bg-purple-500' },
  waiting_for_materials:         { text: 'ממתין לחומרים',   color: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  issue:                         { text: 'דורש טיפול',      color: 'bg-pink-100 text-pink-700',       dot: 'bg-pink-500' },
  ready_for_reporting:           { text: 'מוכן לדיווח',     color: 'bg-teal-100 text-teal-700',       dot: 'bg-teal-500' },
  reported_waiting_for_payment:  { text: 'ממתין לתשלום',    color: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-500' },
  not_relevant:                  { text: 'לא רלוונטי',      color: 'bg-gray-50 text-gray-400',        dot: 'bg-gray-300' },
};
