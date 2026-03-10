/**
 * Company Process Tree — SEED Definition (V2.0)
 *
 * This file serves as the INITIAL SEED for the hierarchical process tree.
 * On first load, this is written to SystemConfig (DB).
 * From that point on, the DB version is the source of truth.
 *
 * Structure:
 *   Branch (P1–P5) → Parent Tasks → Child Tasks (Level 1) → Child Tasks (Level 2) → ...
 *
 * Each node has:
 *   - id:                 Unique identifier (convention: BRANCH_serviceKey)
 *   - label:              Hebrew display name
 *   - service_key:        Maps back to processTemplates.js for steps/taskType/categories
 *   - is_parent_task:     True for top-level process tasks (e.g., "ייצור שכר")
 *   - default_frequency:  Default frequency if no client override exists
 *   - frequency_field:    Field name in client.reporting_info (for nodes with independent freq)
 *   - frequency_fallback: Fallback field in client.reporting_info
 *   - frequency_inherit:  If true, inherits frequency from parent node
 *   - depends_on:         Array of node IDs that must complete before this node starts
 *   - execution:          "parallel" | "sequential" — how children execute relative to each other
 *   - is_collector:       AND convergence — waits for ALL depends_on to complete
 *   - children:           Array of child nodes (recursive)
 *
 * P4 (Home/Personal) is excluded — not relevant for client service management.
 */

// ============================================================
// NODE FACTORY — reduces boilerplate
// ============================================================

function node(id, label, service_key, overrides = {}) {
  return {
    id,
    label,
    service_key,
    is_parent_task: false,
    default_frequency: 'monthly',
    frequency_field: null,
    frequency_fallback: null,
    frequency_inherit: false,
    depends_on: [],
    execution: 'sequential',
    is_collector: false,
    children: [],
    ...overrides,
  };
}

// ============================================================
// P1 — PAYROLL BRANCH
// ============================================================

const P1_BRANCH = {
  id: 'P1',
  label: 'חשבות שכר',
  color_var: '--cp-p1',
  children: [
    node('P1_payroll', 'ייצור שכר', 'payroll', {
      is_parent_task: true,
      default_frequency: 'monthly',
      frequency_field: 'payroll_frequency',
      children: [
        node('P1_payslip_sending', 'משלוח תלושים', 'payslip_sending', {
          frequency_inherit: true,
          depends_on: ['P1_payroll'],
          execution: 'parallel',
        }),
        node('P1_masav_employees', 'מס"ב עובדים', 'masav_employees', {
          frequency_inherit: true,
          depends_on: ['P1_payroll'],
          execution: 'parallel',
        }),
        node('P1_social_security', 'ביטוח לאומי', 'social_security', {
          default_frequency: 'monthly',
          frequency_field: 'social_security_frequency',
          frequency_fallback: 'payroll_frequency',
          depends_on: ['P1_payroll'],
          execution: 'parallel',
          children: [
            node('P1_masav_social', 'מס"ב סוציאליות', 'masav_social', {
              frequency_inherit: true,
              depends_on: ['P1_social_security'],
            }),
          ],
        }),
        node('P1_deductions', 'ניכויים', 'deductions', {
          default_frequency: 'monthly',
          frequency_field: 'deductions_frequency',
          frequency_fallback: 'payroll_frequency',
          depends_on: ['P1_payroll'],
          execution: 'parallel',
        }),
        node('P1_masav_authorities', 'מס"ב רשויות', 'masav_authorities', {
          frequency_inherit: true,
          depends_on: ['P1_payroll'],
          execution: 'parallel',
        }),
      ],
    }),
  ],
};

// ============================================================
// P2 — BOOKKEEPING & TAX BRANCH
// ============================================================

const P2_BRANCH = {
  id: 'P2',
  label: 'הנהלת חשבונות ומיסים',
  color_var: '--cp-p2',
  children: [
    node('P2_bookkeeping', 'ייצור הנה"ח', 'bookkeeping', {
      is_parent_task: true,
      default_frequency: 'monthly',
      children: [
        node('P2_vat', 'מע"מ', 'vat', {
          default_frequency: 'bimonthly',
          frequency_field: 'vat_reporting_frequency',
          depends_on: ['P2_bookkeeping'],
          execution: 'parallel',
        }),
        node('P2_tax_advances', 'מקדמות מס הכנסה', 'tax_advances', {
          default_frequency: 'bimonthly',
          frequency_field: 'tax_advances_frequency',
          depends_on: ['P2_bookkeeping'],
          execution: 'parallel',
        }),
        node('P2_pnl', 'דוח רווח והפסד', 'pnl_reports', {
          default_frequency: 'monthly',
          frequency_field: 'pnl_frequency',
          depends_on: ['P2_vat', 'P2_reconciliation'],
          is_collector: true,
        }),
      ],
    }),
    node('P2_reconciliation', 'התאמות חשבונות', 'reconciliation', {
      default_frequency: 'monthly',
      depends_on: ['P2_vat'],
    }),
  ],
};

// ============================================================
// P3 — ADMIN & CONSULTING BRANCH
// ============================================================

const P3_BRANCH = {
  id: 'P3',
  label: 'ניהול ואדמיניסטרציה',
  color_var: '--cp-p3',
  children: [
    node('P3_admin', 'אדמיניסטרציה', 'admin', {
      default_frequency: 'monthly',
    }),
    node('P3_consulting', 'ייעוץ', 'consulting', {
      default_frequency: 'monthly',
    }),
  ],
};

// ============================================================
// P5 — ANNUAL REPORTS BRANCH
// ============================================================

const P5_BRANCH = {
  id: 'P5',
  label: 'דוחות שנתיים',
  color_var: '--cp-p5',
  children: [
    node('P5_annual_reports', 'דוחות שנתיים / מאזנים', 'annual_reports', {
      is_parent_task: true,
      default_frequency: 'yearly',
      depends_on: ['P1_payroll', 'P2_pnl'],
      children: [
        node('P5_capital_statement', 'הצהרת הון', 'capital_statement', {
          default_frequency: 'yearly',
          depends_on: ['P5_annual_reports'],
        }),
      ],
    }),
  ],
};

// ============================================================
// FULL TREE — SEED
// ============================================================

export const PROCESS_TREE_SEED = {
  version: '2.0',
  branches: {
    P1: P1_BRANCH,
    P2: P2_BRANCH,
    P3: P3_BRANCH,
    P5: P5_BRANCH,
  },
};

// ============================================================
// FULL SERVICE — "Magic Button" node list
// ============================================================

export const FULL_SERVICE_NODES = [
  'P1_payroll',
  'P1_payslip_sending',
  'P1_masav_employees',
  'P1_social_security',
  'P1_deductions',
  'P2_bookkeeping',
  'P2_vat',
  'P2_tax_advances',
  'P5_annual_reports',
];

// ============================================================
// TREE UTILITIES — pure helpers, no DB access
// ============================================================

/**
 * Flatten the tree into an array of all nodes (DFS).
 * Each returned node includes a `branch` field and `parent_id`.
 */
export function flattenTree(tree) {
  const result = [];

  function walk(nodes, branchId, parentId) {
    for (const n of nodes) {
      result.push({ ...n, branch: branchId, parent_id: parentId, children: undefined });
      if (n.children?.length) {
        walk(n.children, branchId, n.id);
      }
    }
  }

  for (const [branchId, branch] of Object.entries(tree.branches)) {
    walk(branch.children, branchId, branchId);
  }

  return result;
}

/**
 * Build a lookup map: nodeId → node (with branch & parent_id).
 */
export function buildNodeMap(tree) {
  const flat = flattenTree(tree);
  const map = {};
  for (const n of flat) {
    map[n.id] = n;
  }
  return map;
}

/**
 * Find a node by ID anywhere in the tree. Returns null if not found.
 */
export function findNodeById(tree, nodeId) {
  return buildNodeMap(tree)[nodeId] || null;
}

/**
 * Get all node IDs in the tree.
 */
export function getAllNodeIds(tree) {
  return flattenTree(tree).map(n => n.id);
}

/**
 * Get the parent node ID for a given node.
 */
export function getParentId(tree, nodeId) {
  const node = findNodeById(tree, nodeId);
  return node?.parent_id || null;
}

export default PROCESS_TREE_SEED;
