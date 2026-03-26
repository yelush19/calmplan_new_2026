/**
 * Functions module — CalmPlan DNA Engine
 * All data flows from serviceWeights.js / automationRules.js / taxCalendar2026.js
 * Monday.com integration REMOVED (Kill Monday directive)
 */

import { exportAllData, importAllData, clearAllData } from './base44Client';
import { _registry } from './entityRegistry';

// Lazy accessor via shared registry — no direct base44 import needed
const entities = new Proxy({}, {
  get(_, prop) {
    return _registry.entities?.[prop];
  },
});
import { getDueDateForCategory, isClient874 } from '@/config/taxCalendar2026';
import { getScheduledStartForCategory, DEFAULT_EXECUTION_PERIODS } from '@/config/automationRules';

// ===== Reports Automation =====

// ===== Israeli Accounting Process Definitions =====
//
// Process types and their frequencies (per client):
//   מע"מ          - חודשי / דו-חודשי / לא רלוונטי (from vat_reporting_frequency)
//   מקדמות מס     - חודשי / דו-חודשי / לא רלוונטי (from tax_advances_frequency)
//   שכר           - חודשי / לא רלוונטי (from payroll_frequency)
//   ביטוח לאומי   - רק ללקוחות עם שכר (payroll), חודשי
//   ניכויים       - רק ללקוחות עם שכר (payroll), חודשי או דו-חודשי
//   דוח שנתי      - שנתי, יעד 31 במאי
//
// Only active clients (status === 'active') get tasks.

const PROCESS_TEMPLATES = {
  vat: {
    name: 'דיווח מע"מ',
    category: 'מע"מ',
    frequencyField: 'vat_reporting_frequency',
    dayOfMonth: 19, // online filing; 874 clients get 23 via taxCalendar
    requiresPayroll: false,
  },
  payroll: {
    name: 'דיווח שכר',
    category: 'שכר',
    frequencyField: 'payroll_frequency',
    dayOfMonth: 9, // שכר: דדליין אחרון 9, נורמלי 7
    requiresPayroll: true,
  },
  tax_advances: {
    name: 'מקדמות מס',
    category: 'מקדמות מס',
    frequencyField: 'tax_advances_frequency',
    dayOfMonth: 19, // online filing deadline
    requiresPayroll: false,
  },
  social_security: {
    name: 'ביטוח לאומי',
    category: 'ביטוח לאומי',
    frequencyField: null, // monthly when payroll exists
    dayOfMonth: 15,
    requiresPayroll: true,
    deprecated: true, // Replaced by tree-aware social_operator / social_taml
  },
  social_operator: {
    name: 'פנסיות — מתפעל',
    category: 'פנסיות — מתפעל',
    frequencyField: null,
    dayOfMonth: 15, // מתפעל: עד 13-15 כולל מס"ב
    requiresPayroll: true,
    treeNodeId: 'P1_operator',
  },
  social_taml: {
    name: 'פנסיות — טמל',
    category: 'פנסיות — טמל',
    frequencyField: null,
    dayOfMonth: 15, // טמל: עד 13-15
    requiresPayroll: true,
    treeNodeId: 'P1_taml',
  },
  deductions: {
    name: 'ניכויים במקור',
    category: 'ניכויים',
    frequencyField: null, // monthly or bimonthly, follows payroll
    dayOfMonth: 19, // online filing deadline
    requiresPayroll: true,
  },
  annual_report: {
    name: 'דוח שנתי',
    category: 'דוח שנתי',
    frequencyField: null,
    dayOfMonth: 31,
    dueMonth: 5,
    frequency: 'yearly',
    requiresPayroll: false,
  },
};

// Map client service_types → which process templates apply
// Each service generates only its own template. social_security and deductions
// are explicit services (auto-linked from payroll via automation rules).
const SERVICE_TYPE_TO_TEMPLATES = {
  'vat_reporting': ['vat'],
  'tax_advances': ['tax_advances'],
  'payroll': ['payroll'],
  'social_security': ['social_security'],
  'deductions': ['deductions'],
  'annual_reports': ['annual_report'],
  'full_service': ['vat', 'payroll', 'tax_advances', 'annual_report', 'social_security', 'deductions'],
};

// Bi-monthly period names (due month → period name)
const BIMONTHLY_PERIOD_NAMES = {
  2: 'ינואר-פברואר',
  4: 'מרץ-אפריל',
  6: 'מאי-יוני',
  8: 'יולי-אוגוסט',
  10: 'ספטמבר-אוקטובר',
  12: 'נובמבר-דצמבר',
};

const BIMONTHLY_DUE_MONTHS = [2, 4, 6, 8, 10, 12];

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

/**
 * SERVICE-AWARE FILTER: Check each service by BOTH service_types AND reporting_info frequency.
 * A client only gets a task if:
 *   1. Their service_types includes the relevant service, AND
 *   2. Their reporting_info frequency for that service is NOT 'not_applicable'
 *
 * If frequency field is undefined → treat as 'not_applicable' (strict mode).
 * This prevents blind generation for clients who don't actually use the service.
 */
function clientHasPayroll(client) {
  const services = client.service_types || [];
  const hasPayrollService = services.some(st =>
    st === 'payroll' || st === 'full_service'
  );
  // STRICT: frequency must be explicitly set and not 'not_applicable'
  const payrollFreq = client.reporting_info?.payroll_frequency;
  return hasPayrollService && !!payrollFreq && payrollFreq !== 'not_applicable';
}

/**
 * ULTIMATE SERVICE-GRID LOGIC:
 * Each client has a specific 'Service Profile'. Use this grid:
 *
 * Service Type      | Logic / Frequency           | Target Folder
 * VAT (מע"מ)        | Only if vat_active === true  | Reports / מע"מ
 * Payroll (שכר)     | Only if has_payroll === true  | Payroll / שכר
 * Adjustments (התאמות)| Only if needs_adjustments    | Adjustments / התאמות
 * Balances (מאזנים)  | All 19 active clients        | Balances / מאזנים
 *
 * NO GHOST TASKS: If a client doesn't have a service, DO NOT create a task for it.
 */

/**
 * Check if client has ANY monthly recurring reporting task.
 * Used to determine if a client is "reporting-active" (solid pill) vs
 * "balance-only" (ghosted pill at 60% opacity).
 *
 * STRICT: Only checks explicit service_types[] keys.
 * No derivation. No loose matching via bookkeeping.
 */
export function isReportingActiveClient(client) {
  if (!client || client.status !== 'active' || client.is_deleted === true) return false;

  const services = client.service_types || [];
  const reporting = client.reporting_info || {};

  // STRICT: service key must be explicitly in service_types[]
  const hasVat = services.includes('vat_reporting') &&
    !!reporting.vat_reporting_frequency && reporting.vat_reporting_frequency !== 'not_applicable';

  const hasPayroll = services.includes('payroll') &&
    !!reporting.payroll_frequency && reporting.payroll_frequency !== 'not_applicable';

  const hasTaxAdv = services.includes('tax_advances') &&
    !!reporting.tax_advances_frequency && reporting.tax_advances_frequency !== 'not_applicable';

  return hasPayroll || hasVat || hasTaxAdv;
}

/**
 * Check if a client is active (not deleted, status=active).
 * ALL active clients appear in MindMap (reporting-active=solid, balance-only=ghosted).
 */
export function isActiveClient(client) {
  return client && client.status === 'active' && client.is_deleted !== true;
}

/**
 * SERVICE-AWARE template selection. No more blind generation.
 * Each template requires BOTH:
 *   (a) the service in service_types
 *   (b) the frequency in reporting_info not being 'not_applicable'
 */
/**
 * SERVICE-AWARE template selection — STRICT.
 * ZERO GHOST DATA: service key must be EXPLICITLY in client.service_types[].
 * No derivation. No loose matching (bookkeeping does NOT imply VAT).
 * Social Security and Deductions are explicit services (auto-linked from payroll).
 */
function getClientTemplates(client) {
  const serviceTypes = client.service_types || [];
  if (serviceTypes.length === 0) return [];

  // Expand full_service into constituent services
  const expanded = new Set(serviceTypes);
  if (expanded.has('full_service')) {
    for (const s of ['vat_reporting', 'payroll', 'tax_advances', 'annual_reports', 'social_security', 'deductions']) {
      expanded.add(s);
    }
  }

  const reporting = client.reporting_info || {};
  const templateKeys = [];

  const freqIsActive = (freq) => !!freq && freq !== 'not_applicable';

  if (expanded.has('vat_reporting') && freqIsActive(reporting.vat_reporting_frequency)) {
    templateKeys.push('vat');
  }

  if (expanded.has('tax_advances') && freqIsActive(reporting.tax_advances_frequency)) {
    templateKeys.push('tax_advances');
  }

  if (expanded.has('payroll') && freqIsActive(reporting.payroll_frequency)) {
    templateKeys.push('payroll');
  }

  // Social security: tree-aware — use operator or taml path based on client's process tree
  // The generic 'social_security' template is DEPRECATED (replaced by specific paths)
  if (expanded.has('social_security') && clientHasPayroll(client)) {
    const ssFreq = reporting.social_security_frequency;
    const payrollFreq = reporting.payroll_frequency;
    if (freqIsActive(ssFreq) || freqIsActive(payrollFreq)) {
      const clientTree = client.process_tree || {};
      const hasOperator = clientTree.P1_operator?.enabled;
      const hasTaml = clientTree.P1_taml?.enabled;
      if (hasOperator) {
        templateKeys.push('social_operator');
      } else if (hasTaml) {
        templateKeys.push('social_taml');
      }
      // If neither is enabled in tree, skip — no generic social_security fallback
    }
  }

  // Deductions: requires BOTH explicit service AND payroll service
  if (expanded.has('deductions') && clientHasPayroll(client)) {
    const dedFreq = reporting.deductions_frequency;
    const payrollFreq = reporting.payroll_frequency;
    if (freqIsActive(dedFreq) || freqIsActive(payrollFreq)) {
      templateKeys.push('deductions');
    }
  }

  // Annual Report: Only if explicitly subscribed
  const hasAnnualService = expanded.has('annual_reports');
  if (hasAnnualService) {
    templateKeys.push('annual_report');
  }

  return templateKeys;
}

/**
 * Get client frequency for a template.
 * Returns: 'monthly' | 'bimonthly' | 'not_applicable' | 'yearly'
 */
function getClientFrequency(templateKey, client) {
  const template = PROCESS_TEMPLATES[templateKey];
  if (!template) return 'not_applicable';
  if (template.frequency === 'yearly') return 'yearly';
  if (template.frequencyField) {
    const freq = client.reporting_info?.[template.frequencyField] || 'monthly';
    // No quarterly - only monthly or bimonthly
    if (freq === 'quarterly') return 'bimonthly';
    return freq;
  }
  return 'monthly';
}

/**
 * Check if a process template should run for a given month for a specific client.
 */
function shouldRunForMonth(templateKey, month, client) {
  const freq = getClientFrequency(templateKey, client);
  if (freq === 'not_applicable') return false;
  if (freq === 'yearly') return month === PROCESS_TEMPLATES[templateKey]?.dueMonth;
  if (freq === 'bimonthly') return BIMONTHLY_DUE_MONTHS.includes(month);
  // Semi-annual: task in month 7 (for Jan-Jun) and month 1 (for Jul-Dec)
  if (freq === 'semi_annual') return month === 7 || month === 1;
  return true; // monthly
}

/**
 * Get the description for a report item based on its frequency.
 */
function getReportDescription(templateKey, month, year, client) {
  const template = PROCESS_TEMPLATES[templateKey];
  const freq = getClientFrequency(templateKey, client);

  if (freq === 'yearly') {
    return `דוח שנתי לשנת ${year - 1}`;
  }
  if (freq === 'semi_annual') {
    // Month 7 = report for Jan-Jun, Month 1 = report for Jul-Dec (previous year)
    if (month === 7) return `${template.name} עבור ינואר-יוני ${year}`;
    if (month === 1) return `${template.name} עבור יולי-דצמבר ${year - 1}`;
    return `${template.name} חצי שנתי ${year}`;
  }
  if (freq === 'bimonthly') {
    const periodName = BIMONTHLY_PERIOD_NAMES[month] || '';
    return `${template.name} ${periodName} ${year}`;
  }
  // Monthly - report for previous month
  const reportMonthIdx = month - 2; // e.g. Feb(2) -> Jan index(0)
  const reportMonthName = MONTH_NAMES[reportMonthIdx < 0 ? 11 : reportMonthIdx];
  const reportYear = reportMonthIdx < 0 ? year - 1 : year;
  return `${template.name} ${reportMonthName} ${reportYear}`;
}

// Monday.com integration fully removed. No stubs needed — no active imports remain.

export const exportClientsToExcel = async () => ({ data: { success: false, error: 'Export not available' } });

/**
 * Export active clients with their services and frequencies to CSV.
 * Columns: לקוח | שירות | תדירות
 * Based on the Process Tree (עץ תהליכים) — only enabled nodes are exported.
 * Uses the same frequency resolution chain as processTreeService.
 */
export const exportCustomerServicesCSV = async () => {
  // Dynamic imports to avoid circular dependencies
  const { PROCESS_TREE_SEED, flattenTree, buildNodeMap } = await import('@/config/companyProcessTree');
  const { loadCompanyTree, resolveFrequency } = await import('@/services/processTreeService');

  // Load the company tree (DB version if available, otherwise seed)
  let companyTree;
  try {
    companyTree = await loadCompanyTree();
  } catch {
    companyTree = PROCESS_TREE_SEED;
  }

  const allNodes = flattenTree(companyTree);
  const nodeMap = buildNodeMap(companyTree);

  // Branch labels for context
  const branchLabels = {};
  for (const [branchId, branch] of Object.entries(companyTree.branches)) {
    branchLabels[branchId] = branch.label;
  }

  const FREQ_LABELS = {
    monthly: 'חודשי',
    bimonthly: 'דו-חודשי',
    quarterly: 'רבעוני',
    semi_annual: 'חצי שנתי',
    yearly: 'שנתי',
    daily: 'יומי',
    weekly: 'שבועי',
    not_applicable: 'לא רלוונטי',
  };

  const PAYMENT_METHOD_LABELS = {
    masav: 'מס״ב',
    credit_card: 'כרטיס אשראי',
    bank_standing_order: 'הו״ק בנקאית',
    standing_order: 'כתב אישור (כ״א)',
    check: 'המחאה',
  };

  // Skip P4 (home/personal) — only export business services
  const businessNodes = allNodes.filter(n => n.branch !== 'P4');

  const allClients = await entities.Client.list();
  const activeClients = allClients.filter(c => c.status === 'active' && c.is_deleted !== true);

  const rows = [];
  for (const client of activeClients) {
    const clientTree = client.process_tree || {};
    let hasEnabledNodes = false;

    for (const treeNode of businessNodes) {
      if (!clientTree[treeNode.id]?.enabled) continue;
      hasEnabledNodes = true;

      // Build service label — include extra fields info
      let serviceLabel = treeNode.label;

      // Include extra_fields values in the label (e.g., VAT method, payment method)
      if (treeNode.extra_fields) {
        for (const [fieldKey, fieldDef] of Object.entries(treeNode.extra_fields)) {
          const clientValue = clientTree[treeNode.id]?.[fieldKey];
          if (clientValue && fieldDef.options) {
            const opt = fieldDef.options.find(o => o.value === clientValue);
            if (opt) {
              serviceLabel += ` (${fieldDef.label}: ${opt.label})`;
            }
          }
        }
      }
      // Fallback: legacy authorities_payment_method on client object
      if (treeNode.service_key === 'authorities_payment' && !treeNode.extra_fields?.payment_method) {
        const paymentMethod = client.authorities_payment_method;
        if (paymentMethod) {
          const methodLabel = PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod;
          serviceLabel += ` (אמצעי תשלום: ${methodLabel})`;
        }
      }

      // Resolve frequency using the full inheritance chain
      const rawFreq = resolveFrequency(treeNode.id, client, companyTree);
      const freq = FREQ_LABELS[rawFreq] || rawFreq || '';

      rows.push([client.name, serviceLabel, freq]);
    }

    if (!hasEnabledNodes) {
      rows.push([client.name, '', '']);
    }
  }

  // Sort by client name
  rows.sort((a, b) => a[0].localeCompare(b[0], 'he'));

  const header = 'לקוח,שירות,תדירות';
  const csvRows = rows.map(r =>
    r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')
  );
  const bom = '\uFEFF';
  const csv = bom + header + '\n' + csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = `customer_services_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return { success: true, count: rows.length };
};
/**
 * Export a single client's process tree to CSV.
 * Shows all enabled nodes with hierarchy, frequency, and extra fields.
 */
export const exportClientProcessTreeCSV = async (client) => {
  const { PROCESS_TREE_SEED, flattenTree } = await import('@/config/companyProcessTree');
  const { loadCompanyTree, resolveFrequency } = await import('@/services/processTreeService');

  let companyTree;
  try {
    companyTree = await loadCompanyTree();
    companyTree = companyTree.tree || companyTree;
  } catch {
    companyTree = PROCESS_TREE_SEED;
  }

  const allNodes = flattenTree(companyTree);
  const clientTree = client.process_tree || {};

  const FREQ_LABELS = {
    monthly: 'חודשי', bimonthly: 'דו-חודשי', quarterly: 'רבעוני',
    semi_annual: 'חצי שנתי', yearly: 'שנתי', daily: 'יומי',
    weekly: 'שבועי', not_applicable: 'לא רלוונטי',
  };

  const branchLabels = {};
  for (const [branchId, branch] of Object.entries(companyTree.branches)) {
    branchLabels[branchId] = branch.label;
  }

  const rows = [];
  for (const treeNode of allNodes) {
    if (treeNode.branch === 'P4') continue; // Skip home/personal
    if (!clientTree[treeNode.id]?.enabled) continue;

    const rawFreq = resolveFrequency(treeNode.id, client, companyTree);
    const freq = FREQ_LABELS[rawFreq] || rawFreq || '';

    // Extra fields info
    let extras = '';
    if (treeNode.extra_fields) {
      const parts = [];
      for (const [fieldKey, fieldDef] of Object.entries(treeNode.extra_fields)) {
        const val = clientTree[treeNode.id]?.[fieldKey];
        if (val && fieldDef.options) {
          const opt = fieldDef.options.find(o => o.value === val);
          if (opt) parts.push(`${fieldDef.label}: ${opt.label}`);
        }
      }
      extras = parts.join('; ');
    }

    rows.push([
      branchLabels[treeNode.branch] || treeNode.branch,
      treeNode.label,
      freq,
      extras,
    ]);
  }

  const header = 'ענף,שירות,תדירות,הגדרות נוספות';
  const csvRows = rows.map(r =>
    r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')
  );
  const bom = '\uFEFF';
  const csv = bom + header + '\n' + csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  const safeName = (client.name || 'client').replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_');
  a.download = `process_tree_${safeName}_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return { success: true, count: rows.length };
};

export const importClientsFromExcel = async () => ({ data: { success: false, error: 'Import not available' } });
export const exportClientAccountsTemplate = async () => ({ data: { success: false, error: 'Export not available' } });
export const importClientAccounts = async () => ({ data: { success: false, error: 'Import not available' } });
const PLACEHOLDER_END_KILL_MONDAY = true; // marker

// ===== Task Generation (stubs) =====

export const generateHomeTasks = async () => {
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

export const getWeeklyPlan = async () => {
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

export const createWeeklyPlan = async () => {
  return { data: { success: false, error: 'Not available in standalone mode' } };
};

/**
 * Generate process tasks for clients based on their services.
 * Uses the same template/service mapping as ClientRecurringTasks.jsx.
 * taskType: 'all' | 'mondayReports' | 'balanceSheets' | 'reconciliations'
 */
export const generateProcessTasks = async (params = {}) => {
  const { taskType = 'all' } = params;
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthNum = String(currentMonth).padStart(2, '0');
  const monthPrefix = `${currentYear}-${monthNum}`;

  const TEMPLATE_TO_WORK_CATEGORY = {
    vat: 'work_vat_reporting',
    payroll: 'work_payroll',
    tax_advances: 'work_tax_advances',
    social_operator: 'work_social_operator',
    social_taml: 'work_social_taml',
    deductions: 'work_deductions',
    annual_report: 'work_client_management',
  };

  try {
    // ── LAW 1.1: REPORTING-ACTIVE FILTER ──
    // FORBIDDEN: inactive, deleted, archived, balance-only clients
    // A client is reporting-active ONLY if they have recurring monthly tasks
    const allClients = await entities.Client.list();
    const allActiveClients = allClients.filter(c =>
      c.status === 'active' && c.is_deleted !== true
    );
    // For monthly tasks: use STRICT reporting-active filter
    const activeClients = allActiveClients.filter(c => isReportingActiveClient(c));
    // For annual reports: use broader active filter (all active clients)
    const annualEligibleClients = allActiveClients;

    // ── LAW 1.3: COMPOSITE UNIQUE KEY via Set ──
    // Key = `${client_id}::${task_type}::${period}`
    // We track created keys to prevent any duplicates within this run
    const createdKeys = new Set();

    // Also load existing tasks to prevent duplicates across runs
    const existingTasks = await entities.Task.list();
    const existingForMonth = existingTasks.filter(t =>
      t.due_date && t.due_date.startsWith(monthPrefix)
    );

    // Build existing composite keys
    existingForMonth.forEach(t => {
      const clientKey = t.client_id || t.client_name || '';
      const typeKey = t.category || '';
      createdKeys.add(`${clientKey}::${typeKey}::${monthPrefix}`);
    });

    log.push(`${timestamp()} LAW 1: ${activeClients.length} reporting-active clients (of ${allActiveClients.length} active, ${allClients.length} total), ${existingForMonth.length} existing tasks for ${monthPrefix}`);

    const results = {
      summary: { tasksCreated: 0, legacyRemoved: 0, errors: 0, skippedBalanceOnly: 0 },
      details: []
    };

    // --- Monthly/Periodic Reports ---
    if (taskType === 'all' || taskType === 'mondayReports') {
      log.push(`${timestamp()} Generating periodic report tasks...`);

      for (const client of activeClients) {
        // ── LAW 1.2: SERVICE-AWARE GENERATION ──
        // getClientTemplates checks service_types + reporting_info frequencies
        // Balance-only clients return [] for monthly templates
        const templateKeys = getClientTemplates(client);
        const monthlyTemplates = templateKeys.filter(k => k !== 'annual_report');

        if (monthlyTemplates.length === 0) {
          if ((client.service_types || []).length > 0) {
            results.summary.skippedBalanceOnly++;
          }
          continue;
        }

        log.push(`${timestamp()} ${client.name}: [${monthlyTemplates.join(', ')}]`);

        for (const templateKey of monthlyTemplates) {
          if (!shouldRunForMonth(templateKey, currentMonth, client)) continue;

          const freq = getClientFrequency(templateKey, client);
          if (freq === 'not_applicable' || freq === 'yearly') continue;

          const template = PROCESS_TEMPLATES[templateKey];

          // Enforce frequency constraints per template
          // Skip deprecated generic social_security — tree-aware variants replace it
          if (template.deprecated) continue;
          // Social security variants + payroll = monthly only
          if ((templateKey === 'social_operator' || templateKey === 'social_taml' || templateKey === 'payroll') && freq !== 'monthly') continue;
          // Deductions = monthly or bimonthly only
          if (templateKey === 'deductions' && freq !== 'monthly' && freq !== 'bimonthly') continue;
          const workCategory = TEMPLATE_TO_WORK_CATEGORY[templateKey] || template.category;

          // ── COMPOSITE UNIQUE KEY CHECK ──
          const compositeKey = `${client.id || client.name}::${workCategory}::${monthPrefix}`;
          if (createdKeys.has(compositeKey)) continue;

          // Also check Hebrew category variant
          const hebrewKey = `${client.id || client.name}::${template.category}::${monthPrefix}`;
          if (createdKeys.has(hebrewKey)) continue;

          const description = getReportDescription(templateKey, currentMonth, currentYear, client);
          const title = `${client.name} - ${description}`;
          const calendarDueDate = getDueDateForCategory(template.category, client, currentMonth);
          const taskDueDate = calendarDueDate || `${currentYear}-${monthNum}-19`;

          try {
            const scheduledStart = getScheduledStartForCategory(template.category, taskDueDate);
            await entities.Task.create({
              title,
              category: workCategory,
              client_related: true,
              client_name: client.name,
              client_id: client.id,
              status: 'not_started',
              priority: 'high',
              due_date: taskDueDate,
              scheduled_start: scheduledStart || undefined,
              is_recurring: true,
            });
            createdKeys.add(compositeKey);
            results.summary.tasksCreated++;
          } catch (err) {
            results.summary.errors++;
          }
        }
      }

      // Monday sync removed — DNA is the sole source of truth
    }

    // --- Balance Sheets / Annual Reports ---
    // DISABLED: Annual report tasks (05-31) are NOT auto-generated.
    // They require manual specification within P2 balance sheet workflow.
    // Rule: "אין לייצר משימות ללא אפיון מקדים של תתי-המשימות בתוך העץ"
    if (taskType === 'balanceSheets') {
      log.push(`${timestamp()} Annual report tasks skipped — requires manual P2 workflow`);
    }

    // --- Reconciliations ---
    if (taskType === 'all' || taskType === 'reconciliations') {
      for (const client of activeClients) {
        const clientServices = client.service_types || [];
        if (!clientServices.includes('bookkeeping') &&
            !clientServices.includes('bookkeeping_full') &&
            !clientServices.includes('full_service') &&
            !clientServices.includes('reconciliation')) continue;

        const compositeKey = `${client.id || client.name}::work_reconciliation::${monthPrefix}`;
        if (createdKeys.has(compositeKey)) continue;

        const title = `${client.name} - התאמת חשבונות ${monthNum}/${currentYear}`;
        try {
          const reconDue = `${currentYear}-${monthNum}-25`;
          const scheduledStart = getScheduledStartForCategory('התאמות', reconDue);
          await entities.Task.create({
            title,
            category: 'work_reconciliation',
            client_related: true,
            client_name: client.name,
            client_id: client.id,
            status: 'not_started',
            priority: 'medium',
            due_date: reconDue,
            scheduled_start: scheduledStart || undefined,
            is_recurring: true,
          });
          createdKeys.add(compositeKey);
          results.summary.tasksCreated++;
        } catch (err) {
          results.summary.errors++;
        }
      }
    }

    // ── CATEGORY COUNT AUDIT: Log task breakdown per category ──
    const allTasksNow = await entities.Task.list();
    const febTasks = allTasksNow.filter(t => t.due_date && t.due_date.startsWith(monthPrefix));
    const categoryCounts = {};
    febTasks.forEach(t => {
      const cat = t.category || 'unknown';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    log.push(`${timestamp()} ═══ TASK COUNT PER CATEGORY ═══`);
    Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      log.push(`${timestamp()}   ${cat}: ${count}`);
    });
    log.push(`${timestamp()} ═══ TOTAL: ${febTasks.length} tasks for ${monthPrefix} ═══`);
    log.push(`${timestamp()} Reporting-active clients: ${activeClients.length}, Balance-only skipped: ${results.summary.skippedBalanceOnly}`);

    return {
      data: {
        success: true,
        message: `נוצרו ${results.summary.tasksCreated} משימות חדשות`,
        results,
        categoryCounts,
        totalForMonth: febTasks.length,
        log
      }
    };
  } catch (error) {
    return { data: { success: false, error: error.message, log } };
  }
};

// ===== Cleanup: Remove tasks for Year-end-only clients in 02.2026 =====
export const cleanupYearEndOnlyTasks = async () => {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;
  let deleted = 0;

  try {
    const allClients = await entities.Client.list();
    const allTasks = await entities.Task.list();

    // Identify clients whose ONLY service is annual_reports (year-end only)
    const yearEndOnlyClients = allClients.filter(c => {
      const services = c.service_types || [];
      return services.length > 0 &&
        services.every(st => st === 'annual_reports') &&
        (c.status === 'active' || c.status === 'balance_sheet_only');
    });

    const yearEndClientNames = new Set(yearEndOnlyClients.map(c => c.name));
    log.push(`${timestamp()} נמצאו ${yearEndOnlyClients.length} לקוחות שנתיים בלבד: ${[...yearEndClientNames].join(', ')}`);

    // Find monthly/periodic tasks created for these clients in 02.2026
    const monthlyCategories = new Set([
      'work_vat_reporting', 'work_payroll', 'work_tax_advances',
      'work_social_security', 'work_deductions',
      'מע"מ', 'שכר', 'מקדמות מס', 'ביטוח לאומי', 'ניכויים',
    ]);

    const tasksToDelete = allTasks.filter(t =>
      yearEndClientNames.has(t.client_name) &&
      monthlyCategories.has(t.category) &&
      t.due_date && t.due_date.startsWith('2026-02') &&
      t.status !== 'completed'
    );

    log.push(`${timestamp()} נמצאו ${tasksToDelete.length} משימות חודשיות שנוצרו בטעות`);

    for (const task of tasksToDelete) {
      try {
        await entities.Task.delete(task.id);
        deleted++;
      } catch (err) {
        log.push(`${timestamp()} שגיאה במחיקת "${task.title}": ${err.message}`);
      }
    }

    log.push(`${timestamp()} נמחקו ${deleted} משימות`);
    return { data: { success: true, deleted, log } };
  } catch (error) {
    return { data: { success: false, error: error.message, log } };
  }
};

// ===== P3 GHOST CLEANUP: Delete placeholder/orphan tasks in P3 =====
// Removes tasks that: have no title/empty title, no client, no category,
// or are placeholder stubs that aren't actionable.
export const cleanupP3GhostTasks = async () => {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;
  let deleted = 0;

  try {
    const allTasks = await entities.Task.list();
    const allClients = await entities.Client.list();
    const activeClientNames = new Set(
      allClients.filter(c => c.status === 'active' && !c.is_deleted).map(c => c.name)
    );

    // P3 categories (admin/other) — catch-all for ghost tasks
    const p3Categories = new Set([
      'work_client_management', 'work_annual_reports', 'דוח שנתי',
      'personal', 'אחר', 'כללי', 'work_general', 'work_admin',
      'אדמיניסטרציה', 'לחזור ללקוח', 'work_callback',
      'פגישה', 'work_meeting', 'מעקב שיווק', 'work_marketing',
    ]);

    const ghostTasks = allTasks.filter(task => {
      // Ghost condition 1: No title or empty title
      if (!task.title || task.title.trim() === '') return true;

      // Ghost condition 2: P3 category with no client AND no meaningful content
      const isP3 = p3Categories.has(task.category) ||
        (task.context === 'work' && !task.category);
      if (isP3 && !task.client_name && !task.description && task.status === 'not_started') {
        return true;
      }

      // Ghost condition 3: References a deleted/non-existent client
      if (task.client_name && task.context === 'work' &&
          !activeClientNames.has(task.client_name) &&
          task.status !== 'production_completed') {
        return true;
      }

      // Ghost condition 4: Placeholder titles (generic stubs)
      const placeholderPatterns = [
        /^placeholder/i, /^test\s/i, /^TODO$/i, /^$/,
        /^משימה חדשה$/, /^ללא כותרת$/,
      ];
      if (placeholderPatterns.some(p => p.test(task.title?.trim()))) return true;

      return false;
    });

    log.push(`${timestamp()} נמצאו ${ghostTasks.length} משימות רפאים ב-P3`);

    for (const task of ghostTasks) {
      try {
        await entities.Task.delete(task.id);
        deleted++;
        log.push(`${timestamp()} נמחקה: "${task.title || '(ריק)'}" [${task.category || 'ללא'}]`);
      } catch (err) {
        log.push(`${timestamp()} שגיאה: ${err.message}`);
      }
    }

    log.push(`${timestamp()} סה"כ נמחקו ${deleted} משימות רפאים`);
    return { data: { success: true, deleted, log } };
  } catch (error) {
    return { data: { success: false, error: error.message, log } };
  }
};

// ===== WIPE & RESET: Delete ALL tasks for a given month =====
// LAW 1.3: Nuclear wipe before generation - DELETE FROM tasks WHERE period = 'MM.YYYY'
export const wipeAllTasksForMonth = async (params = {}) => {
  const { year = 2026, month = 2 } = params;
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;
  let deleted = 0;

  try {
    const allTasks = await entities.Task.list();
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

    // Delete ALL tasks for this month - clean slate
    const tasksToDelete = allTasks.filter(t =>
      t.due_date && t.due_date.startsWith(monthPrefix)
    );

    log.push(`${timestamp()} NUCLEAR WIPE: ${tasksToDelete.length} tasks for ${monthPrefix}`);

    // Batch delete for speed
    const deletePromises = tasksToDelete.map(task =>
      entities.Task.delete(task.id).then(() => { deleted++; }).catch(err => {
        log.push(`${timestamp()} Delete error "${task.title}": ${err.message}`);
      })
    );
    await Promise.all(deletePromises);

    log.push(`${timestamp()} Wiped ${deleted} of ${tasksToDelete.length} tasks`);
    return { data: { success: true, deleted, total: tasksToDelete.length, log } };
  } catch (error) {
    return { data: { success: false, error: error.message, log } };
  }
};

// ===== AUDIT PREVIEW: Count expected tasks without creating them =====
export const previewTaskGeneration = async (params = {}) => {
  const { taskType = 'all' } = params;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthNum = String(currentMonth).padStart(2, '0');
  const monthPrefix = `${currentYear}-${monthNum}`;

  try {
    const allClients = await entities.Client.list();
    const activeClients = allClients.filter(c => c.status === 'active');
    const existingTasks = await entities.Task.list();

    const existingForMonth = existingTasks.filter(t =>
      t.due_date && t.due_date.startsWith(monthPrefix)
    );

    const preview = {
      totalClients: activeClients.length,
      existingTasksThisMonth: existingForMonth.length,
      breakdown: { vat: 0, payroll: 0, tax_advances: 0, social_security: 0, deductions: 0, annual_report: 0, reconciliation: 0 },
      totalExpected: 0,
      newTasks: 0,
      alreadyExist: 0,
    };

    if (taskType === 'all' || taskType === 'mondayReports') {
      for (const client of activeClients) {
        const services = client.service_types || [];
        // STRICT: Only pass if client has explicit recurring service
        const hasMonthlyService = services.some(st =>
          st === 'vat_reporting' || st === 'tax_advances' || st === 'payroll' || st === 'full_service'
        );
        if (!hasMonthlyService) continue;

        const templateKeys = getClientTemplates(client);
        for (const templateKey of templateKeys) {
          if (templateKey === 'annual_report' && taskType === 'mondayReports') continue;
          if (!shouldRunForMonth(templateKey, currentMonth, client)) continue;
          const freq = getClientFrequency(templateKey, client);
          if (freq === 'not_applicable' || freq === 'yearly') continue;

          preview.breakdown[templateKey] = (preview.breakdown[templateKey] || 0) + 1;
          preview.totalExpected++;

          const template = PROCESS_TEMPLATES[templateKey];
          const workCategory = TEMPLATE_TO_WORK_CATEGORY[templateKey] || template.category;
          const hebrewCategory = template.category;
          const exists = existingForMonth.some(t => {
            const sameClient = t.client_name === client.name || (client.id && t.client_id === client.id);
            if (!sameClient) return false;
            const sameType = t.category === workCategory || t.category === hebrewCategory;
            return sameType;
          });

          if (exists) preview.alreadyExist++;
          else preview.newTasks++;
        }
      }
    }

    if (taskType === 'all' || taskType === 'reconciliations') {
      for (const client of activeClients) {
        const clientServices = client.service_types || [];
        if (clientServices.length > 0 &&
            !clientServices.includes('bookkeeping') &&
            !clientServices.includes('full_service')) continue;
        preview.breakdown.reconciliation++;
        preview.totalExpected++;

        const title = `${client.name} - התאמת חשבונות ${monthNum}/${currentYear}`;
        const exists = existingForMonth.some(t => t.title === title);
        if (exists) preview.alreadyExist++;
        else preview.newTasks++;
      }
    }

    return {
      data: {
        success: true,
        preview,
        label: `צפויות ${preview.totalExpected} משימות (${preview.newTasks} חדשות, ${preview.alreadyExist} קיימות)`,
      }
    };
  } catch (error) {
    return { data: { success: false, error: error.message } };
  }
};

// ===== Dedup Purge: Remove duplicate tasks for a given month =====
// LAW 1.3: Enforce composite unique key = client_id + task_type + period
export const dedupTasksForMonth = async (params = {}) => {
  const { year = 2026, month = 2 } = params;
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;
  let deleted = 0;

  try {
    // Step 1: Get actual active clients for orphan detection
    const allClients = await entities.Client.list();
    const activeClientNames = new Set(
      allClients
        .filter(c => c.status === 'active' && c.is_deleted !== true)
        .map(c => c.name)
    );

    const allTasks = await entities.Task.list();
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthTasks = allTasks.filter(t => t.due_date && t.due_date.startsWith(monthPrefix));

    log.push(`${timestamp()} ${monthTasks.length} tasks for ${monthPrefix}, ${activeClientNames.size} active clients`);

    // Step 2: Delete orphan tasks (client not in active list)
    const orphans = monthTasks.filter(t =>
      t.client_name && !activeClientNames.has(t.client_name)
    );
    const orphanDeletes = orphans.map(task =>
      entities.Task.delete(task.id).then(() => { deleted++; }).catch(() => {})
    );
    await Promise.all(orphanDeletes);
    if (orphans.length > 0) {
      log.push(`${timestamp()} Deleted ${orphans.length} orphan tasks (inactive clients)`);
    }

    // Step 3: COMPOSITE KEY dedup — client_id + task_type (category) + period
    // Keep oldest, delete newer duplicates
    const survivingTasks = monthTasks.filter(t => !orphans.includes(t));
    const seen = new Map();
    const duplicates = [];

    survivingTasks
      .sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''))
      .forEach(t => {
        const clientKey = t.client_id || t.client_name || '';
        const compositeKey = `${clientKey}::${t.category || ''}::${monthPrefix}`;
        if (!seen.has(compositeKey)) {
          seen.set(compositeKey, t.id);
        } else {
          duplicates.push(t);
        }
      });

    const dupDeletes = duplicates.map(task =>
      entities.Task.delete(task.id).then(() => { deleted++; }).catch(() => {})
    );
    await Promise.all(dupDeletes);
    if (duplicates.length > 0) {
      log.push(`${timestamp()} Deleted ${duplicates.length} duplicates (composite key)`);
    }

    const remaining = monthTasks.length - deleted;
    log.push(`${timestamp()} Total deleted: ${deleted}. Remaining: ${remaining}`);
    return { data: { success: true, deleted, remaining, duplicatesFound: duplicates.length + orphans.length, log } };
  } catch (error) {
    return { data: { success: false, error: error.message, log } };
  }
};

// ===== Seed Data =====

export const seedData = async () => {
  const { default: seedDemoData } = await import('./seedDemoData');
  return seedDemoData();
};

// ===== Backup =====

export const emergencyBackup = async () => {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `litaycalmplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
  return { data: { success: true, message: 'Backup downloaded' } };
};

// ===== Reset =====

export const emergencyReset = async () => {
  if (window.confirm('Are you sure? This will delete ALL data!')) {
    clearAllData();
    window.location.reload();
  }
  return { data: { success: true } };
};

/**
 * Nuclear wipe: delete ALL tasks from BOTH Supabase AND localStorage.
 * Prevents ghost resurrection by clearing both layers simultaneously.
 */
/**
 * DISABLED: Nuclear wipe is locked to prevent accidental data loss.
 * Use the Force Inject + Clear Month Cache in the injection engine instead.
 * To re-enable, set NUCLEAR_ENABLED = true below.
 */
const NUCLEAR_ENABLED = false;

export const nuclearWipeTasks = async () => {
  if (!NUCLEAR_ENABLED) {
    console.warn('[NuclearWipe] BLOCKED — nuclear reset is disabled. Use Force Inject instead.');
    return { data: { success: false, blocked: true, log: ['Nuclear reset is DISABLED. Use Force Inject + Clear Month Cache instead.'] } };
  }

  const log = [];

  // Layer 1: Supabase
  try {
    await entities.Task.deleteAll();
    log.push('Supabase tasks: WIPED');
  } catch (e) {
    log.push(`Supabase error: ${e.message}`);
  }

  // Layer 2: localStorage (belt and suspenders)
  try {
    localStorage.removeItem('calmplan_tasks');
    log.push('localStorage tasks: WIPED');
  } catch (e) {
    log.push(`localStorage error: ${e.message}`);
  }

  // Layer 3: Also clear any other task caches
  try {
    localStorage.removeItem('calmplan_task_sessions');
    localStorage.removeItem('calmplan_weekly_tasks');
    log.push('Task caches: WIPED');
  } catch { /* ignore */ }

  console.log('[NuclearWipe]', log.join(' | '));
  return { data: { success: true, log } };
};

/**
 * Ghost Task Cleanup — identifies and removes orphan tasks from old code generations.
 *
 * A "ghost" task is one that:
 *   1. Has a deprecated/generic category that no longer matches current templates
 *   2. Has no matching tree node in the company process tree
 *   3. Was auto-generated (is_recurring=true) but uses old category naming
 *
 * Returns a preview list (dryRun=true) or actually deletes (dryRun=false).
 */
export const cleanupGhostTasks = async ({ dryRun = true } = {}) => {
  const log = [];
  const timestamp = () => `[${new Date().toLocaleTimeString('he-IL')}]`;

  // Categories that the CURRENT generateProcessTasks produces
  const VALID_CATEGORIES = new Set([
    'work_vat_reporting', 'מע"מ',
    'work_payroll', 'שכר',
    'work_tax_advances', 'מקדמות מס',
    'work_social_operator', 'פנסיות — מתפעל',
    'work_social_taml', 'פנסיות — טמל',
    'work_deductions', 'ניכויים — דיווח',
    'work_client_management', 'דוח שנתי',
  ]);

  // Known deprecated/ghost categories from old code
  const GHOST_CATEGORIES = new Set([
    'סוציאליות',           // old generic — replaced by פנסיות וקרנות
    'סוציאליות מתפעל',     // old — replaced by פנסיות — מתפעל
    'סוציאליות טמל',       // old — replaced by פנסיות — טמל
    'סוציאליות - מתפעל',   // old variant
    'סוציאליות - טמל',     // old variant
    'ביטוח לאומי',         // old generic social_security
    'social_security',      // old English category
  ]);

  try {
    const allTasks = await entities.Task.list();
    const ghostTasks = [];
    const validTasks = [];

    for (const task of allTasks) {
      const cat = (task.category || '').trim();

      // Only check auto-generated recurring tasks
      if (!task.is_recurring) {
        validTasks.push(task);
        continue;
      }

      // Check if category is a known ghost
      if (GHOST_CATEGORIES.has(cat)) {
        ghostTasks.push({
          id: task.id,
          title: task.title,
          category: cat,
          client_name: task.client_name,
          due_date: task.due_date,
          status: task.status,
          reason: `קטגוריה מיושנת: "${cat}"`,
        });
        continue;
      }

      // Check if category is valid
      if (VALID_CATEGORIES.has(cat)) {
        validTasks.push(task);
        continue;
      }

      // Unknown category — flag as potential ghost but don't auto-delete
      validTasks.push(task);
    }

    log.push(`${timestamp()} סה"כ משימות: ${allTasks.length}`);
    log.push(`${timestamp()} רפאים שזוהו: ${ghostTasks.length}`);
    log.push(`${timestamp()} תקינות: ${validTasks.length}`);

    // Group ghosts by category for summary
    const ghostsByCategory = {};
    for (const g of ghostTasks) {
      if (!ghostsByCategory[g.category]) ghostsByCategory[g.category] = [];
      ghostsByCategory[g.category].push(g);
    }

    if (!dryRun && ghostTasks.length > 0) {
      let deleted = 0;
      for (const ghost of ghostTasks) {
        try {
          await entities.Task.delete(ghost.id);
          deleted++;
        } catch (err) {
          log.push(`${timestamp()} שגיאה במחיקת ${ghost.id}: ${err.message}`);
        }
      }
      log.push(`${timestamp()} נמחקו ${deleted} רפאים`);
    }

    return {
      data: {
        success: true,
        dryRun,
        totalTasks: allTasks.length,
        ghostCount: ghostTasks.length,
        ghostTasks: ghostTasks.slice(0, 100), // limit preview to 100
        ghostsByCategory: Object.fromEntries(
          Object.entries(ghostsByCategory).map(([cat, tasks]) => [cat, tasks.length])
        ),
        deletedCount: dryRun ? 0 : ghostTasks.length,
        log,
      },
    };
  } catch (err) {
    return {
      data: {
        success: false,
        error: err.message,
        log,
      },
    };
  }
};

/**
 * Delete ALL sticky notes — bulk cleanup.
 */
export const deleteAllStickyNotes = async () => {
  try {
    const StickyNote = _registry.get('StickyNote');
    if (!StickyNote) return { data: { success: false, error: 'StickyNote entity not found' } };
    const all = await StickyNote.list(null, 5000);
    if (!all?.length) return { data: { success: true, deleted: 0, message: 'אין פתקים דביקים למחיקה' } };
    for (const note of all) {
      await StickyNote.delete(note.id);
    }
    return { data: { success: true, deleted: all.length, message: `נמחקו ${all.length} פתקים דביקים` } };
  } catch (err) {
    return { data: { success: false, error: err.message } };
  }
};

/**
 * Bulk update deadline (due_date) for tasks matching category + report period.
 * Use case: tax authority postpones deadline (e.g., war situation → מע"מ moved to 12.04)
 *
 * @param {Object} params
 * @param {string[]} params.categories - Task categories to match (e.g., ['מע"מ', 'מקדמות מס', 'work_vat_reporting', 'work_tax_advances'])
 * @param {string} params.reportPeriod - Report period to match (e.g., '2026-02' for February 2026)
 * @param {string} params.newDueDate - New due date in YYYY-MM-DD format (e.g., '2026-04-12')
 * @param {boolean} params.dryRun - If true, only preview without changing (default: true)
 */
export const bulkUpdateDeadline = async ({ categories = [], reportPeriod = '', newDueDate = '', dryRun = true } = {}) => {
  try {
    const Task = _registry.get('Task');
    if (!Task) return { data: { success: false, error: 'Task entity not found' } };
    if (!categories.length || !reportPeriod || !newDueDate) {
      return { data: { success: false, error: 'חסרים פרמטרים: categories, reportPeriod, newDueDate' } };
    }

    const allTasks = await Task.list(null, 5000);
    const matching = (allTasks || []).filter(t => {
      if (!t.category || !categories.includes(t.category)) return false;
      // Match by: report_period, OR report_month+year, OR due_date month
      const period = t.report_period || '';
      if (period === reportPeriod) return true;
      // Try report_month + report_year (e.g., month=2, year=2026 → '2026-02')
      if (t.report_month && t.report_year) {
        const composed = `${t.report_year}-${String(t.report_month).padStart(2, '0')}`;
        if (composed === reportPeriod) return true;
      }
      // Fallback: due_date in the FOLLOWING month (Feb tasks have March due dates)
      if (t.due_date) {
        const dueMonth = t.due_date.slice(0, 7); // '2026-03'
        // If reportPeriod is '2026-02', due dates would be '2026-03'
        const [rYear, rMonth] = reportPeriod.split('-').map(Number);
        let nextMonth = rMonth + 1, nextYear = rYear;
        if (nextMonth > 12) { nextMonth = 1; nextYear++; }
        const expectedDueMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
        if (dueMonth === expectedDueMonth) return true;
      }
      return false;
    });

    if (dryRun) {
      // Also show sample non-matching tasks for debugging
      const sampleNonMatch = (allTasks || [])
        .filter(t => categories.includes(t.category))
        .slice(0, 3)
        .map(t => ({ title: t.title?.slice(0, 40), category: t.category, report_period: t.report_period, report_month: t.report_month, due_date: t.due_date }));
      return {
        data: {
          success: true,
          dryRun: true,
          matchCount: matching.length,
          preview: matching.map(t => ({ id: t.id, title: t.title, client: t.client_name, oldDue: t.due_date, newDue: newDueDate })),
          debug: { totalTasks: (allTasks || []).length, categoriesSearched: categories, reportPeriod, sampleCategoryTasks: sampleNonMatch },
          message: matching.length > 0
            ? `נמצאו ${matching.length} משימות שיעודכנו ל-${newDueDate}`
            : `לא נמצאו משימות מתאימות לחודש ${reportPeriod}`,
        },
      };
    }

    let updated = 0;
    for (const task of matching) {
      await Task.update(task.id, { due_date: newDueDate, date: newDueDate });
      updated++;
    }

    return {
      data: {
        success: true,
        updated,
        message: `עודכנו ${updated} משימות — דדליין חדש: ${newDueDate}`,
      },
    };
  } catch (err) {
    return { data: { success: false, error: err.message } };
  }
};
