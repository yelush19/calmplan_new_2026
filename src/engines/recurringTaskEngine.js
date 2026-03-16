/**
 * Recurring Task Generation Engine (V4.3)
 * ========================================
 * Generates tasks from the PROCESS TREE — not hardcoded service groups.
 *
 * ARCHITECTURE:
 *   Company Tree (companyProcessTree.js) defines all nodes + steps + SLA days.
 *   Client Tree (client.process_tree) marks which nodes are enabled + frequency overrides.
 *   This engine walks the tree and creates tasks for each enabled leaf node.
 *
 * RULES:
 *   1. ZERO GHOST DATA — Task created ONLY if client's process_tree has node ENABLED.
 *   2. DETERMINISTIC — No enabled node = 0 tasks. No exceptions.
 *   3. MANUAL TRIGGER ONLY — generateRecurringTasks() is called by a button.
 *   4. FREQUENCY-AWARE — Respects bimonthly/quarterly/semi-annual off-months.
 *   5. SLA-AWARE — Due dates derived from tree node sla_day + tax calendar.
 *   6. STEPS FROM TREE — Process steps come from companyProcessTree, not processTemplates.
 */

import { PROCESS_TREE_SEED, flattenTree, buildNodeMap } from '@/config/companyProcessTree';
import { getDueDateForCategory, TAX_CALENDAR_2026 } from '@/config/taxCalendar2026';
import { resolveFrequency, shouldInjectForMonth } from '@/services/processTreeService';

// Legacy import — only used as fallback for unmigrated clients
import { ALL_SERVICES } from '@/config/processTemplates';

// ============================================================
// CATEGORY → DEADLINE MAPPING
// Maps tree node categories to tax calendar deadline types.
// Nodes with sla_day use that directly; others fall back here.
// ============================================================

const CATEGORY_DEADLINE_MAP = {
  'שכר': 'שכר',
  'הכנת שכר ועד לאישור': 'שכר',
  'משלוח תלושים': 'שכר',
  'מס"ב עובדים': 'שכר',
  'פנסיות וקרנות': 'שכר',
  'מתפעל': 'שכר',
  'טמל + לקוח': 'שכר',
  'רשויות שכר': 'שכר',
  'ביטוח לאומי': 'ביטוח לאומי',
  'ניכויים': 'ניכויים',
  'קליטה להנה"ח': 'שכר',
  'קליטת הכנסות': 'מע"מ',
  'קליטת הוצאות': 'מע"מ',
  'התאמות חשבונות': 'מע"מ',
  'מס"ב ספקים': 'מע"מ',
  'מקדמות מס הכנסה': 'מקדמות מס',
  'מע"מ': 'מע"מ',
  'רווח והפסד': 'דוח רו"ה',
  'מאזנים / דוחות שנתיים': 'דוח שנתי',
  'דוחות אישיים': 'דוח שנתי',
};

// ============================================================
// DYNAMIC SERVICE GROUPS — Built from process tree
// ============================================================

/**
 * Builds service definitions from the company process tree.
 * Each leaf node (non-parent or parent with steps) becomes a service.
 * Parent nodes that are pure grouping (no steps, only children) are skipped
 * as tasks — their children generate the actual tasks.
 *
 * @param {Object} companyTree - The company process tree (PROCESS_TREE_SEED format)
 * @returns {Object} SERVICE_GROUPS keyed by branch (P1, P2, P3, P4, P5)
 */
export function buildServiceGroupsFromTree(companyTree) {
  const tree = companyTree || PROCESS_TREE_SEED;
  const allNodes = flattenTree(tree);
  const nodeMap = buildNodeMap(tree);
  const groups = {};

  for (const node of allNodes) {
    const branchId = node.branch;
    if (!branchId) continue;

    // Skip pure grouping nodes (is_parent_task with children but no steps)
    // These nodes exist only to organize children — not to create tasks.
    // Exception: nodes with steps ARE tasks even if they have children.
    const hasSteps = node.steps && node.steps.length > 0;
    const hasChildren = tree.branches[branchId]?.children?.some(c =>
      c.id === node.id && c.children?.length > 0
    ) || allNodes.some(n => n.parent_id === node.id);

    if (!hasSteps && hasChildren) continue;

    // Skip daily/weekly personal tasks (P4) — they use a separate generator
    if (node.default_frequency === 'daily' || node.default_frequency === 'weekly') continue;

    if (!groups[branchId]) {
      const branchDef = tree.branches[branchId];
      groups[branchId] = {
        key: branchId,
        label: `${branchId} | ${branchDef?.label || branchId}`,
        branch: branchId,
        services: [],
      };
    }

    groups[branchId].services.push({
      key: node.service_key || node.id,
      label: node.label,
      serviceKey: node.service_key,
      treeNodeId: node.id,
      category: node.label,
      branch: branchId,
      frequencyField: node.frequency_field || null,
      defaultFrequency: node.default_frequency || 'monthly',
      sla_day: node.sla_day || null,
      depends_on: node.depends_on || [],
      steps: node.steps || [],
    });
  }

  return groups;
}

// ============================================================
// LEGACY SERVICE_GROUPS — kept for backward compatibility
// Used when companyTree is not passed to generateRecurringTasks
// ============================================================

export const SERVICE_GROUPS = {
  P1: {
    key: 'P1',
    label: 'P1 | חשבות שכר',
    branch: 'P1',
    services: [
      {
        key: 'payroll',
        label: 'שכר',
        serviceKey: 'payroll',
        templateKey: 'payroll',
        category: 'שכר',
        branch: 'P1',
        treeNodeId: 'P1_payroll',
        frequencyField: 'payroll_frequency',
      },
      {
        key: 'social_security',
        label: 'פנסיות וקרנות',
        serviceKey: 'payroll',
        templateKey: 'social_security',
        category: 'ביטוח לאומי — דיווח',
        branch: 'P1',
        treeNodeId: 'P1_social_security',
        frequencyField: 'social_security_frequency',
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
        serviceKey: 'vat_reporting',
        templateKey: 'vat',
        category: 'מע"מ',
        branch: 'P2',
        treeNodeId: 'P2_vat',
        frequencyField: 'vat_reporting_frequency',
      },
      {
        key: 'tax_advances',
        label: 'מקדמות מס',
        serviceKey: 'tax_advances',
        templateKey: 'tax_advances',
        category: 'מקדמות מס',
        branch: 'P2',
        treeNodeId: 'P2_tax_advances',
        frequencyField: 'tax_advances_frequency',
      },
    ],
  },
};

// ============================================================
// DUE DATE RESOLUTION
// ============================================================

/**
 * Resolves the due date for a task from the process tree.
 *
 * Resolution chain:
 *   1. Client's process_tree node extra_fields.sla_override
 *   2. Tree node's sla_day → day X of the following month
 *   3. CATEGORY_DEADLINE_MAP → getDueDateForCategory (tax calendar)
 *   4. Fallback: 19th of following month (online filing default)
 *
 * @param {Object} serviceDef - Service definition (from buildServiceGroupsFromTree)
 * @param {Object} client - Client entity
 * @param {number} reportMonth - 1-12
 * @param {number} reportYear - e.g. 2026
 * @returns {string} YYYY-MM-DD due date
 */
function resolveDueDate(serviceDef, client, reportMonth, reportYear) {
  const pad = (n) => String(n).padStart(2, '0');

  // 1. Client-level SLA override on the specific node
  const clientNode = client?.process_tree?.[serviceDef.treeNodeId];
  const clientSla = clientNode?.sla_override || clientNode?.extra_fields?.sla_override;

  // 2. Tree node's sla_day
  const slaDayRaw = clientSla || serviceDef.sla_day;

  if (slaDayRaw) {
    const slaDay = parseInt(slaDayRaw, 10);
    if (!isNaN(slaDay) && slaDay > 0) {
      // Due dates are in the FOLLOWING month
      let dueMonth = reportMonth + 1;
      let dueYear = reportYear;
      if (dueMonth > 12) { dueMonth = 1; dueYear++; }
      return `${dueYear}-${pad(dueMonth)}-${pad(Math.min(slaDay, 28))}`;
    }
  }

  // 3. Category-based tax calendar lookup
  const categoryKey = CATEGORY_DEADLINE_MAP[serviceDef.category] || serviceDef.category;
  const calendarDate = getDueDateForCategory(categoryKey, client, reportMonth);
  if (calendarDate) return calendarDate;

  // 4. Fallback: 19th of following month
  let dueMonth = reportMonth + 1;
  let dueYear = reportYear;
  if (dueMonth > 12) { dueMonth = 1; dueYear++; }
  return `${dueYear}-${pad(dueMonth)}-19`;
}

// ============================================================
// TASK MODEL
// ============================================================

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

/**
 * Creates a Task entity conforming to the system's data model.
 * Uses process tree steps (V4.3) with fallback to processTemplates.
 */
export function createTaskEntity({ client, serviceDef, reportMonth, reportYear, dueDate, processSteps }) {
  const monthName = MONTH_NAMES[reportMonth - 1];

  // Determine dashboard from branch
  const dashboardMap = { P1: 'payroll', P2: 'tax', P3: 'admin', P4: 'home', P5: 'annual' };

  return {
    // Identity
    title: `${serviceDef.label} - ${client.name} - ${monthName} ${reportYear}`,
    category: serviceDef.category,
    branch: serviceDef.branch || 'P2',
    status: 'not_started',
    priority: 'Medium',

    // Hierarchy metadata
    client_id: client.id || client.entity_number,
    client_name: client.name,
    service_group: serviceDef.key,
    service_key: serviceDef.key,
    tree_node_id: serviceDef.treeNodeId,
    parent_service: dashboardMap[serviceDef.branch] || 'tax',

    // Temporal
    date: dueDate,
    due_date: dueDate,
    report_month: reportMonth,
    report_year: reportYear,
    report_period: `${reportYear}-${String(reportMonth).padStart(2, '0')}`,

    // SLA tracking
    sla_day: serviceDef.sla_day || null,
    depends_on: serviceDef.depends_on || [],

    // Process tracking — steps from tree
    process_steps: processSteps,
    step_count: Object.keys(processSteps).length,

    // Master Task Workflow (payroll only)
    ...(serviceDef.key === 'payroll' || serviceDef.treeNodeId === 'P1_payroll' ? {
      is_master: true,
      workflow_phase: 'phase_a',
      workflow_phase_label: 'שלב א\' | ייצור שכר',
    } : {}),

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
 * PRIMARY: checks process_tree for enabled nodes.
 * FALLBACK: checks service_types[] for legacy clients.
 */
function clientHasService(client, serviceDef) {
  const processTree = client.process_tree || {};
  if (Object.keys(processTree).length > 0) {
    const nodeId = serviceDef.treeNodeId;
    if (nodeId && processTree[nodeId]?.enabled) {
      return true;
    }
    return false;
  }

  // FALLBACK: Legacy service_types[] check
  const types = client.service_types || [];
  return types.includes(serviceDef.serviceKey);
}

/**
 * Determines if the given month is an off-month for this client+service.
 */
function isOffMonth(client, serviceDef, reportMonth, companyTree) {
  let frequency;

  // PRIMARY: Use process tree resolution chain
  if (companyTree && serviceDef.treeNodeId) {
    frequency = resolveFrequency(serviceDef.treeNodeId, client, companyTree);
    return !shouldInjectForMonth(frequency, reportMonth);
  }

  // Tree node default frequency
  if (serviceDef.defaultFrequency) {
    frequency = serviceDef.defaultFrequency;
    if (frequency === 'not_applicable') return true;
    return !shouldInjectForMonth(frequency, reportMonth);
  }

  // FALLBACK: Legacy reporting_info lookup
  frequency = client?.reporting_info?.[serviceDef.frequencyField];
  if (!frequency || frequency === 'monthly' || frequency === 'not_applicable') {
    return frequency === 'not_applicable';
  }

  const monthIndex = reportMonth - 1;
  if (frequency === 'bimonthly') return monthIndex % 2 === 0;
  if (frequency === 'quarterly') return !([2, 5, 8, 11].includes(monthIndex));
  if (frequency === 'semi_annual') return !([5, 11].includes(monthIndex));

  return false;
}

/**
 * Initializes empty process steps from a service definition.
 * V4.3: Uses tree node steps directly.
 * Fallback: Uses ALL_SERVICES templateKey.
 */
function initProcessSteps(serviceDef) {
  // V4.3: Steps from tree definition
  if (serviceDef.steps && serviceDef.steps.length > 0) {
    const steps = {};
    for (const step of serviceDef.steps) {
      steps[step.key] = {
        done: false,
        date: null,
        notes: '',
        label: step.label,
        sla_day: step.sla_day || null,
      };
    }
    return steps;
  }

  // Fallback: Legacy processTemplates
  if (serviceDef.templateKey) {
    const template = ALL_SERVICES[serviceDef.templateKey];
    if (!template?.steps) return {};
    const steps = {};
    for (const step of template.steps) {
      steps[step.key] = { done: false, date: null, notes: '' };
    }
    return steps;
  }

  return {};
}

/**
 * MAIN GENERATION FUNCTION — Manual trigger only.
 *
 * V4.3: Dynamically builds service groups from the company process tree.
 * Each enabled client node generates a task with steps, frequency, and SLA deadline.
 *
 * @param {Object} params
 * @param {Array} params.clients - All client entities
 * @param {number} params.reportMonth - 1-12
 * @param {number} params.reportYear - e.g. 2026
 * @param {Array} [params.existingTasks] - For duplicate detection
 * @param {Object} [params.companyTree] - Company process tree (uses SEED if null)
 * @returns {Object} { clientBreakdown, flatTasks, totalCount, validationReport }
 */
export function generateRecurringTasks({ clients, reportMonth, reportYear, existingTasks = [], companyTree = null }) {
  const activeClients = clients.filter(c => c.status === 'active');

  // V4.3: Build service groups from tree (dynamic) or use legacy groups
  const serviceGroups = companyTree
    ? buildServiceGroupsFromTree(companyTree)
    : SERVICE_GROUPS;

  const clientBreakdown = [];
  const flatTasks = [];
  let totalCount = 0;

  // Build existing task index for duplicate detection
  const existingIndex = new Set(
    existingTasks.map(t => `${t.client_name}|${t.tree_node_id || t.category}|${t.report_period}`)
  );
  // Also index by legacy key
  existingTasks.forEach(t => {
    existingIndex.add(`${t.client_name}|${t.category}|${t.report_period}`);
  });

  for (const client of activeClients) {
    const clientNode = {
      client_name: client.name,
      client_id: client.id || client.entity_number,
      serviceGroups: {},
      taskCount: 0,
    };

    for (const [groupKey, group] of Object.entries(serviceGroups)) {
      const groupNode = {
        label: group.label,
        services: [],
        taskCount: 0,
      };

      for (const serviceDef of group.services) {
        // RULE 1: Does client have this service?
        if (!clientHasService(client, serviceDef)) continue;

        // RULE 2: Is this an off-month?
        if (isOffMonth(client, serviceDef, reportMonth, companyTree)) continue;

        // RULE 3: Duplicate detection (by tree_node_id AND category)
        const period = `${reportYear}-${String(reportMonth).padStart(2, '0')}`;
        const dedupKey1 = `${client.name}|${serviceDef.treeNodeId}|${period}`;
        const dedupKey2 = `${client.name}|${serviceDef.category}|${period}`;
        if (existingIndex.has(dedupKey1) || existingIndex.has(dedupKey2)) continue;

        // Resolve due date from tree SLA → tax calendar → default
        const dueDate = resolveDueDate(serviceDef, client, reportMonth, reportYear);

        // Initialize process steps from tree node
        const processSteps = initProcessSteps(serviceDef);

        // Create task entity
        const task = createTaskEntity({
          client,
          serviceDef,
          reportMonth,
          reportYear,
          dueDate,
          processSteps,
        });

        const serviceNode = {
          key: serviceDef.key,
          label: serviceDef.label,
          category: serviceDef.category,
          treeNodeId: serviceDef.treeNodeId,
          dueDate,
          sla_day: serviceDef.sla_day,
          subTasks: (serviceDef.steps || []).map(s => s.label),
          task,
        };

        groupNode.services.push(serviceNode);
        groupNode.taskCount++;
        flatTasks.push(task);
        existingIndex.add(dedupKey1); // Prevent self-duplication within same run
      }

      if (groupNode.taskCount > 0) {
        clientNode.serviceGroups[groupKey] = groupNode;
        clientNode.taskCount += groupNode.taskCount;
      }
    }

    clientBreakdown.push(clientNode);
    totalCount += clientNode.taskCount;
  }

  const validationReport = {
    activeClientCount: activeClients.length,
    totalTasksGenerated: totalCount,
    reportPeriod: `${reportYear}-${String(reportMonth).padStart(2, '0')}`,
    isValid: totalCount <= 200,
    treeVersion: companyTree?.version || (companyTree ? PROCESS_TREE_SEED.version : 'legacy'),
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
 * V4.3: Uses dynamic service groups from tree.
 */
export function buildServiceMatrix(clients, reportMonth, reportYear, companyTree = null) {
  const activeClients = clients.filter(c => c.status === 'active');

  const serviceGroups = companyTree
    ? buildServiceGroupsFromTree(companyTree)
    : SERVICE_GROUPS;

  // All services in column order (P1 first, then P2, etc.)
  const allServices = Object.values(serviceGroups)
    .sort((a, b) => a.key.localeCompare(b.key))
    .flatMap(g => g.services);

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
      const offMonth = hasService && isOffMonth(client, serviceDef, reportMonth, companyTree);

      if (!hasService) {
        row.cells.push({ status: 'X', subTasks: [], label: 'X' });
      } else if (offMonth) {
        row.cells.push({ status: 'OFF', subTasks: [], label: '—' });
      } else {
        const subTasks = (serviceDef.steps || []).map(s => s.label);
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
