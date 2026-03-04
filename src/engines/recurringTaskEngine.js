/**
 * Recurring Task Generation Engine
 * ==================================
 * THE source of truth for deterministic, hierarchy-based task generation.
 *
 * ARCHITECTURE (Hierarchy is Law):
 *   Level 0 — Client Node (parent)
 *   Level 1 — Service Group: "Tax" or "Payroll" (child)
 *   Level 2 — Main Service: e.g. "VAT", "Payroll" (grandchild of client)
 *   Level 3 — Sub-tasks / Process Steps: e.g. "קליטת הכנסות", "הכנת תלושים"
 *
 * RULES:
 *   1. ZERO GHOST DATA — A task is created ONLY if the client's service_types
 *      array EXPLICITLY contains the corresponding service key.
 *      No derivation. No auto-linking. If it's not in service_types, it doesn't exist.
 *   2. DETERMINISTIC — No service subscription = 0 tasks. No exceptions.
 *   3. MANUAL TRIGGER ONLY — generateRecurringTasks() is called by a button.
 *      Nothing auto-generates.
 *   4. FREQUENCY-AWARE — Respects bimonthly/quarterly/semi-annual off-months.
 *      Off-month = 0 tasks for that service. Not "not_relevant". Zero.
 *   5. CROSS-REFERENCE VALIDATION — A service is real only when service_types,
 *      reporting_info frequency, deadlines, and tax IDs all agree.
 *      Deadline "לא רלוונטי" overrules an active frequency.
 */

import { TAX_SERVICES, PAYROLL_SERVICES, ALL_SERVICES } from '@/config/processTemplates';
import { getDueDateForCategory, isClient874, isBimonthlyOffMonth } from '@/config/taxCalendar2026';

// ============================================================
// SERVICE GROUP DEFINITIONS
// ============================================================

/**
 * The two top-level service groups that contain all recurring services.
 * Each main service maps to:
 *   - serviceKey: key in client.service_types[]
 *   - templateKey: key in processTemplates (ALL_SERVICES)
 *   - category: Hebrew category name used for task creation
 *   - frequencyField: key in client.reporting_info for frequency lookup
 */
/**
 * SERVICE_GROUPS — Only services that appear EXPLICITLY in client.service_types[].
 *
 * Social Security (ביטוח לאומי) and Deductions (ניכויים) are NOT listed here
 * because they do not appear in any client's service_types array.
 * They are process steps within the Payroll workflow, not standalone tasks.
 *
 * Payroll sub-tasks already include: Social Security filing, Deductions filing,
 * as steps within the payroll process template.
 */
export const SERVICE_GROUPS = {
  P1: {
    key: 'P1',
    label: 'P1 | חשבות שכר',
    branch: 'P1',
    services: [
      {
        key: 'payroll',
        label: 'שכר',
        serviceKey: 'payroll',             // Must exist in client.service_types[]
        templateKey: 'payroll',
        category: 'שכר',
        branch: 'P1',
        frequencyField: 'payroll_frequency',
      },
    ],
  },
  P2: {
    key: 'P2',
    label: 'P2 | הנהלת חשבונות',
    branch: 'P2',
    services: [
      {
        key: 'vat',
        label: 'מע"מ',
        serviceKey: 'vat_reporting',       // Must exist in client.service_types[]
        templateKey: 'vat',                // Key in ALL_SERVICES for process steps
        category: 'מע"מ',                  // Hebrew category for task entity
        branch: 'P2',
        frequencyField: 'vat_reporting_frequency',
      },
      {
        key: 'tax_advances',
        label: 'מקדמות מס',
        serviceKey: 'tax_advances',        // Must exist in client.service_types[]
        templateKey: 'tax_advances',
        category: 'מקדמות מס',
        branch: 'P2',
        frequencyField: 'tax_advances_frequency',
      },
    ],
  },
};

// ============================================================
// TASK MODEL
// ============================================================

/**
 * Creates a Task entity conforming to the system's data model.
 *
 * @param {Object} params
 * @param {Object} params.client - Client entity
 * @param {Object} params.serviceDef - Service definition from SERVICE_GROUPS
 * @param {number} params.reportMonth - 1-12 reporting period month
 * @param {number} params.reportYear - Reporting year (e.g. 2026)
 * @param {string} params.dueDate - YYYY-MM-DD due date
 * @param {Object} params.processSteps - Initialized process steps from template
 * @returns {Object} Task entity ready for persistence
 */
export function createTaskEntity({ client, serviceDef, reportMonth, reportYear, dueDate, processSteps }) {
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  ];

  const template = ALL_SERVICES[serviceDef.templateKey];
  const monthName = monthNames[reportMonth - 1];

  return {
    // Identity
    title: `${serviceDef.label} - ${client.name} - ${monthName} ${reportYear}`,
    category: serviceDef.category,
    branch: serviceDef.branch || 'P2',   // P1=payroll, P2=bookkeeping/tax
    status: 'not_started',
    priority: 'Medium',

    // Hierarchy metadata
    client_id: client.id || client.entity_number,
    client_name: client.name,
    service_group: serviceDef.key,
    service_key: serviceDef.key,
    parent_service: template?.dashboard || 'tax',

    // Temporal
    date: dueDate,
    report_month: reportMonth,
    report_year: reportYear,
    report_period: `${reportYear}-${String(reportMonth).padStart(2, '0')}`,

    // Process tracking
    process_steps: processSteps,
    step_count: Object.keys(processSteps).length,

    // Metadata
    context: 'work',
    is_recurring: true,
    source: 'recurring_generation',
    created_at: new Date().toISOString(),
  };
}

// ============================================================
// CORE ENGINE
// ============================================================

/**
 * Determines if a client is subscribed to a given service.
 * Checks both direct subscription and derived (auto-linked) services.
 *
 * @param {Object} client - Client entity
 * @param {Object} serviceDef - Service definition from SERVICE_GROUPS
 * @returns {boolean}
 */
function clientHasService(client, serviceDef) {
  const types = client.service_types || [];

  // Direct check: does client.service_types contain the serviceKey?
  if (types.includes(serviceDef.serviceKey)) {
    return true;
  }

  return false;
}

/**
 * Determines if the given month is an off-month for this client+service.
 * Off-month = client's frequency for this service skips this month.
 *
 * @param {Object} client
 * @param {Object} serviceDef
 * @param {number} reportMonth - 1-indexed month
 * @returns {boolean} true if this month should be SKIPPED
 */
function isOffMonth(client, serviceDef, reportMonth) {
  const frequency = client?.reporting_info?.[serviceDef.frequencyField];

  if (!frequency || frequency === 'monthly' || frequency === 'not_applicable') {
    // monthly = every month; not_applicable handled by clientHasService returning false
    return frequency === 'not_applicable';
  }

  // 0-indexed month for bimonthly check
  const monthIndex = reportMonth - 1;

  if (frequency === 'bimonthly') {
    // Bimonthly reports on even months (Feb=1, Apr=3, Jun=5, Aug=7, Oct=9, Dec=11)
    // Off-months: Jan(0), Mar(2), May(4), Jul(6), Sep(8), Nov(10)
    return monthIndex % 2 === 0;
  }

  if (frequency === 'quarterly') {
    // Quarterly: months 3, 6, 9, 12 (indices 2, 5, 8, 11)
    return !([2, 5, 8, 11].includes(monthIndex));
  }

  if (frequency === 'semi_annual') {
    // Semi-annual: months 6, 12 (indices 5, 11)
    return !([5, 11].includes(monthIndex));
  }

  return false;
}

/**
 * Initializes empty process steps from a service template.
 *
 * @param {string} templateKey - Key in ALL_SERVICES
 * @returns {Object} Process steps object with all steps set to undone
 */
function initProcessSteps(templateKey) {
  const template = ALL_SERVICES[templateKey];
  if (!template?.steps) return {};

  const steps = {};
  for (const step of template.steps) {
    steps[step.key] = { done: false, date: null, notes: '' };
  }
  return steps;
}

/**
 * MAIN GENERATION FUNCTION — Manual trigger only.
 *
 * Generates recurring tasks for all active clients for a given month/year.
 * Returns a nested structure: Client → Service Group → Tasks with sub-steps.
 *
 * @param {Object} params
 * @param {Array} params.clients - All client entities (will be filtered to active)
 * @param {number} params.reportMonth - 1-12
 * @param {number} params.reportYear - e.g. 2026
 * @param {Array} [params.existingTasks] - Existing tasks for duplicate detection
 * @returns {Object} { clientBreakdown, flatTasks, totalCount, validationReport }
 */
export function generateRecurringTasks({ clients, reportMonth, reportYear, existingTasks = [] }) {
  // GATE 1: Filter to active clients only
  const activeClients = clients.filter(c => c.status === 'active');

  const clientBreakdown = [];
  const flatTasks = [];
  let totalCount = 0;

  // Build existing task index for duplicate detection
  const existingIndex = new Set(
    existingTasks.map(t => `${t.client_name}|${t.category}|${t.report_period}`)
  );

  for (const client of activeClients) {
    const clientNode = {
      client_name: client.name,
      client_id: client.id || client.entity_number,
      serviceGroups: {},
      taskCount: 0,
    };

    for (const [groupKey, group] of Object.entries(SERVICE_GROUPS)) {
      const groupNode = {
        label: group.label,
        services: [],
        taskCount: 0,
      };

      for (const serviceDef of group.services) {
        // RULE 1: Does client have this service?
        const hasService = clientHasService(client, serviceDef);
        if (!hasService) continue;

        // RULE 2: Is this an off-month?
        if (isOffMonth(client, serviceDef, reportMonth)) continue;

        // RULE 3: Duplicate detection
        const dedupKey = `${client.name}|${serviceDef.category}|${reportYear}-${String(reportMonth).padStart(2, '0')}`;
        if (existingIndex.has(dedupKey)) continue;

        // Get due date from tax calendar
        const dueDate = getDueDateForCategory(serviceDef.category, client, reportMonth);

        // Initialize process steps from template
        const processSteps = initProcessSteps(serviceDef.templateKey);
        const template = ALL_SERVICES[serviceDef.templateKey];

        // Create task entity
        const task = createTaskEntity({
          client,
          serviceDef,
          reportMonth,
          reportYear,
          dueDate,
          processSteps,
        });

        // Build service node with sub-tasks visible
        const serviceNode = {
          key: serviceDef.key,
          label: serviceDef.label,
          category: serviceDef.category,
          dueDate,
          subTasks: (template?.steps || []).map(s => s.label),
          task,
        };

        groupNode.services.push(serviceNode);
        groupNode.taskCount++;
        flatTasks.push(task);
      }

      if (groupNode.taskCount > 0) {
        clientNode.serviceGroups[groupKey] = groupNode;
        clientNode.taskCount += groupNode.taskCount;
      }
    }

    clientBreakdown.push(clientNode);
    totalCount += clientNode.taskCount;
  }

  // Validation report
  const validationReport = {
    activeClientCount: activeClients.length,
    totalTasksGenerated: totalCount,
    reportPeriod: `${reportYear}-${String(reportMonth).padStart(2, '0')}`,
    isValid: totalCount <= 80,
    breakdown: clientBreakdown.map(c => ({
      client: c.client_name,
      tasks: c.taskCount,
    })),
  };

  return {
    clientBreakdown,
    flatTasks,
    totalCount,
    validationReport,
  };
}

// ============================================================
// SERVICE MATRIX BUILDER
// ============================================================

/**
 * Builds the Service Matrix Table for display.
 * Rows: Active clients
 * Columns: Main services (VAT, Tax Advances, Payroll, Social Security, Deductions)
 * Cells: List of sub-tasks OR "X" if not subscribed
 *
 * @param {Array} clients - All clients
 * @param {number} reportMonth - 1-12
 * @param {number} reportYear
 * @returns {Object} { headers, rows, totals }
 */
export function buildServiceMatrix(clients, reportMonth, reportYear) {
  const activeClients = clients.filter(c => c.status === 'active');

  // All main services in column order (P1 first, then P2)
  const allServices = [
    ...SERVICE_GROUPS.P1.services,
    ...SERVICE_GROUPS.P2.services,
  ];

  const headers = ['#', 'Client', ...allServices.map(s => s.label), 'Total'];

  const rows = [];
  const columnTotals = new Array(allServices.length).fill(0);
  let grandTotal = 0;

  activeClients.forEach((client, idx) => {
    const row = {
      index: idx + 1,
      clientName: client.name,
      cells: [],
      rowTotal: 0,
    };

    allServices.forEach((serviceDef, colIdx) => {
      const hasService = clientHasService(client, serviceDef);
      const offMonth = hasService && isOffMonth(client, serviceDef, reportMonth);

      if (!hasService) {
        row.cells.push({ status: 'X', subTasks: [], label: 'X' });
      } else if (offMonth) {
        row.cells.push({ status: 'OFF', subTasks: [], label: '—' });
      } else {
        const template = ALL_SERVICES[serviceDef.templateKey];
        const subTasks = (template?.steps || []).map(s => s.label);
        row.cells.push({ status: 'V', subTasks, label: 'V' });
        row.rowTotal++;
        columnTotals[colIdx]++;
        grandTotal++;
      }
    });

    rows.push(row);
  });

  return {
    headers,
    rows,
    columnTotals,
    grandTotal,
    activeClientCount: activeClients.length,
    services: allServices,
  };
}
