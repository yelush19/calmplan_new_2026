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
      { key: 'receive_materials', label: 'קבלת חומרים',          icon: 'inbox' },
      { key: 'payroll_calc',      label: 'חישוב שכר',            icon: 'calculator' },
      { key: 'review',            label: 'העברה לעיון',          icon: 'eye' },
      { key: 'corrections',       label: 'תיקונים ואישור',       icon: 'check-circle' },
      { key: 'masav',             label: 'מס"ב עובדים',          icon: 'landmark' },
      { key: 'payslips',          label: 'הפקת תלושים',          icon: 'file-output' },
      { key: 'send_to_client',    label: 'שליחה ללקוח',          icon: 'send' },
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

  authorities: {
    key: 'authorities',
    label: 'דיווח רשויות',
    dashboard: 'tax',
    taskCategories: ['דיווח רשויות', 'work_authorities'],
    createCategory: 'דיווח רשויות',
    steps: [
      { key: 'report_prep',  label: 'הכנת דו"ח',  icon: 'file-text' },
      { key: 'submission',   label: 'הגשה',        icon: 'send' },
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
    label: 'סוציאליות',
    dashboard: 'payroll',
    taskCategories: ['סוציאליות', 'work_social_benefits'],
    createCategory: 'סוציאליות',
    steps: [
      { key: 'calculation',  label: 'חישוב',   icon: 'calculator' },
      { key: 'execution',    label: 'ביצוע',    icon: 'check-circle' },
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

  client_management: {
    key: 'client_management',
    label: 'ניהול לקוח',
    dashboard: 'tax',
    taskCategories: ['ניהול לקוח', 'work_client_management'],
    createCategory: 'ניהול לקוח',
    steps: [
      { key: 'task',  label: 'ביצוע',  icon: 'check-circle' },
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

// Status definitions shared across dashboards
export const STATUS_CONFIG = {
  not_started:                   { label: 'נותרו השלמות',   bg: 'bg-gray-200',       text: 'text-gray-700',     border: 'border-gray-300',    priority: 3 },
  in_progress:                   { label: 'בעבודה',         bg: 'bg-emerald-200',    text: 'text-emerald-900',  border: 'border-emerald-300', priority: 2 },
  completed:                     { label: 'הושלם',          bg: 'bg-emerald-400',    text: 'text-white',        border: 'border-emerald-500', priority: 5 },
  postponed:                     { label: 'נדחה',           bg: 'bg-gray-300',       text: 'text-gray-600',     border: 'border-gray-400',    priority: 4 },
  waiting_for_approval:          { label: 'לבדיקה',         bg: 'bg-amber-200',      text: 'text-amber-900',    border: 'border-amber-300',   priority: 2 },
  waiting_for_materials:         { label: 'ממתין לחומרים',  bg: 'bg-amber-100',      text: 'text-amber-800',    border: 'border-amber-200',   priority: 1 },
  issue:                         { label: 'דורש טיפול',     bg: 'bg-amber-300',      text: 'text-amber-900',    border: 'border-amber-400',   priority: 0 },
  issues:                        { label: 'דורש טיפול',     bg: 'bg-amber-300',      text: 'text-amber-900',    border: 'border-amber-400',   priority: 0 },
  ready_for_reporting:           { label: 'מוכן לדיווח',    bg: 'bg-teal-200',       text: 'text-teal-900',     border: 'border-teal-300',    priority: 3 },
  reported_waiting_for_payment:  { label: 'ממתין לתשלום',   bg: 'bg-sky-200',        text: 'text-sky-900',      border: 'border-sky-300',     priority: 4 },
  not_relevant:                  { label: 'לא רלוונטי',     bg: 'bg-gray-100',       text: 'text-gray-400',     border: 'border-gray-200',    priority: 6 },
};
