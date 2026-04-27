// ============================================================
// Task → Dashboard navigation
// ------------------------------------------------------------
// Resolves the right page (and optional ?service= filter) for a
// given task, based on its category. Used by HOME, AyoaMiniMap
// drawer, search results — anywhere the user can click a task
// and expect to land on the correct working surface.
// ============================================================

import { createPageUrl } from '@/utils';
import { ALL_SERVICES, getServiceForTask } from '@/config/processTemplates';

// Service key → { page, service? }
// Page is the raw page name expected by createPageUrl().
// service is the optional ?service=<key> querystring value.
const SERVICE_TO_DASHBOARD = {
  // Payroll production board
  payroll:              { page: 'PayrollDashboard',         service: 'payroll' },
  payslip_sending:      { page: 'PayrollDashboard' },
  masav_employees:      { page: 'PayrollDashboard' },

  // Payroll reporting board (102)
  social_security:      { page: 'PayrollReportsDashboard',  service: 'social_security' },
  deductions:           { page: 'PayrollReportsDashboard',  service: 'deductions' },
  authorities_payment:  { page: 'PayrollReportsDashboard',  service: 'authorities_payment' },
  reserve_report:       { page: 'PayrollReportsDashboard',  service: 'reserve_report' },
  reserve_claims:       { page: 'PayrollReportsDashboard',  service: 'reserve_report' },
  payroll_closing:      { page: 'PayrollReportsDashboard' },

  // Pensions / additional services
  operator_reporting:   { page: 'AdditionalServicesDashboard' },
  taml_reporting:       { page: 'AdditionalServicesDashboard' },
  social_benefits:      { page: 'AdditionalServicesDashboard' },
  masav_social:         { page: 'AdditionalServicesDashboard' },

  // Tax reports
  vat:                  { page: 'TaxReportsDashboard',      service: 'vat' },
  vat_874:              { page: 'TaxReportsDashboard',      service: 'vat_874' },
  tax_advances:         { page: 'TaxReportsDashboard',      service: 'tax_advances' },

  // Bookkeeping
  bookkeeping:          { page: 'TaxReportsDashboard',      service: 'bookkeeping' },
  income_collection:    { page: 'TaxReportsDashboard' },
  expense_collection:   { page: 'TaxReportsDashboard' },

  // Reconciliation
  reconciliation:       { page: 'Reconciliations' },

  // Periodic / annual
  bituach_leumi_126:    { page: 'PeriodicSummaryReports' },
  deductions_126_wage:  { page: 'PeriodicSummaryReports' },
  balance_sheet:        { page: 'BalanceSheets' },
};

// Hebrew category label → service key (for tasks that don't carry a service key explicitly)
const HEB_CATEGORY_TO_SERVICE = {
  'שכר': 'payroll',
  'משלוח תלושים': 'payslip_sending',
  'מס"ב עובדים': 'masav_employees',
  'מס״ב עובדים': 'masav_employees',
  'ביטוח לאומי': 'social_security',
  'ניכויים': 'deductions',
  'תשלום רשויות': 'authorities_payment',
  'מילואים': 'reserve_report',
  'תביעות מילואים': 'reserve_report',
  'מע"מ': 'vat',
  'מע״מ': 'vat',
  'מע"מ 874': 'vat_874',
  'מע״מ 874': 'vat_874',
  'מקדמות מס': 'tax_advances',
  'הנהלת חשבונות': 'bookkeeping',
  'התאמות חשבונות': 'reconciliation',
  'התאמות': 'reconciliation',
  'קליטת הכנסות': 'income_collection',
  'קליטת הוצאות': 'expense_collection',
  'דוח שנתי': 'balance_sheet',
};

/**
 * Resolve which service key a task belongs to.
 * Tries (in order): explicit task.service_key/serviceKey, getServiceForTask
 * via category, then Hebrew category map, then English work_* prefix.
 */
function resolveServiceKey(task) {
  if (!task) return null;
  if (task.service_key) return task.service_key;
  if (task.serviceKey) return task.serviceKey;

  const svc = getServiceForTask(task);
  if (svc?.key) return svc.key;

  const cat = task.category;
  if (!cat) return null;
  if (HEB_CATEGORY_TO_SERVICE[cat]) return HEB_CATEGORY_TO_SERVICE[cat];

  // Fall back to ALL_SERVICES taskCategories scan
  const found = Object.values(ALL_SERVICES).find((s) =>
    Array.isArray(s.taskCategories) && s.taskCategories.includes(cat)
  );
  return found?.key || null;
}

/**
 * Get the most relevant dashboard URL for a task.
 * Returns a fully-formed URL (createPageUrl + ?service= + task highlight).
 *
 * @param {Object} task - The task object
 * @param {Object} [options]
 * @param {boolean} [options.includeHighlight=true] - Append &highlight=<task.id>
 * @returns {string|null} URL to navigate to, or null if unresolvable
 */
export function getDashboardUrlForTask(task, options = {}) {
  const { includeHighlight = true } = options;
  if (!task) return null;

  // Home (life-side) tasks → Tasks page (no specialized dashboard)
  const ctx = task.context || (task.category?.startsWith('home_') ? 'home' : 'work');
  if (ctx === 'home') {
    return createPageUrl('Tasks') + (includeHighlight ? `?highlight=${encodeURIComponent(task.id)}` : '');
  }

  const serviceKey = resolveServiceKey(task);
  const target = serviceKey ? SERVICE_TO_DASHBOARD[serviceKey] : null;

  if (target) {
    let url = createPageUrl(target.page);
    const params = [];
    if (target.service) params.push(`service=${encodeURIComponent(target.service)}`);
    if (task.client_name) params.push(`client=${encodeURIComponent(task.client_name)}`);
    if (includeHighlight && task.id) params.push(`highlight=${encodeURIComponent(task.id)}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return url;
  }

  // Fallback — Tasks page filtered to this task
  return createPageUrl('Tasks') + (includeHighlight ? `?highlight=${encodeURIComponent(task.id)}` : '');
}

/**
 * Same as getDashboardUrlForTask but returns a friendly label for the destination.
 * Used in tooltips ("פתח ב: דיווחים שוטפים").
 */
export function getDashboardLabelForTask(task) {
  if (!task) return 'משימות';
  const ctx = task.context || (task.category?.startsWith('home_') ? 'home' : 'work');
  if (ctx === 'home') return 'משימות בית';

  const serviceKey = resolveServiceKey(task);
  const target = serviceKey ? SERVICE_TO_DASHBOARD[serviceKey] : null;
  if (!target) return 'משימות';

  const PAGE_LABELS = {
    PayrollDashboard:           'ייצור שכר',
    PayrollReportsDashboard:    'דיווחים שוטפים (102)',
    AdditionalServicesDashboard:'פנסיות וקרנות',
    PeriodicSummaryReports:     'דיווחים תקופתיים',
    TaxReportsDashboard:        'דיווחי מס',
    Reconciliations:            'התאמות חשבונות',
    BalanceSheets:              'מאזנים ודוחות',
    Tasks:                      'משימות',
  };
  return PAGE_LABELS[target.page] || 'משימות';
}
