/**
 * Company Process Tree — SEED Definition (V4.0)
 *
 * V4.0 RESTRUCTURE:
 *   - Nodes = services that can be toggled per client
 *   - Steps = workflow actions WITHIN a node (not separate nodes)
 *   - Removed: sub-nodes that were really steps (report/payment/collection children)
 *   - Added: parent grouping nodes (ייצור, דיווחים, סגירה, שירותים נלווים, רשויות)
 *   - P5: children converted to steps (7 steps instead of 7 nodes)
 *   - P4: children converted to steps (already defined in processTemplates)
 *   - P3: ייעוץ renamed to משרד
 *   - Removed: הצהרת הון (not needed)
 *
 * Structure:
 *   Branch (P1–P5) → Parent Tasks → Child Tasks → ...
 *
 * Each node has:
 *   - id, label, service_key, is_parent_task, default_frequency
 *   - frequency_field, frequency_fallback, frequency_inherit
 *   - depends_on, execution, is_collector
 *   - steps: array of { key, label } — workflow steps within this node
 *   - children: array of child nodes (recursive)
 *   - extra_fields, smart_link (optional)
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
    steps: [],
    ...overrides,
  };
}

// ============================================================
// Shared extra_fields
// ============================================================

const PAYMENT_METHOD_FIELD = {
  payment_method: {
    type: 'select',
    label: 'אמצעי תשלום',
    options: [
      { value: 'masav', label: 'מס״ב' },
      { value: 'credit_card', label: 'כרטיס אשראי' },
      { value: 'bank_standing_order', label: 'הו״ק אוטומטית' },
      { value: 'check', label: 'המחאה' },
      { value: 'client_pays', label: 'לקוח' },
      { value: 'payment_plan', label: 'הסדר' },
    ],
    default_value: 'masav',
  },
};

// ============================================================
// P1 — PAYROLL BRANCH
// ============================================================

const P1_BRANCH = {
  id: 'P1',
  label: 'חשבות שכר',
  color_var: '--cp-p1',
  children: [
    // ── הכנת שכר ועד לאישור ──
    node('P1_payroll', 'הכנת שכר ועד לאישור', 'payroll', {
      is_parent_task: true,
      default_frequency: 'monthly',
      frequency_field: 'payroll_frequency',
      steps: [
        { key: 'receive_data',       label: 'קבלת נתונים' },
        { key: 'prepare_payslips',   label: 'הכנת תלושים' },
        { key: 'proofreading',       label: 'הגהה' },
        { key: 'salary_entry',       label: 'קליטת פקודת שכר' },
        { key: 'employee_payments',  label: 'רישום תשלומי עובדים' },
        { key: 'authority_payments', label: 'רישום תשלומי רשויות שכר' },
      ],
    }),

    // ── שירותים נלווים לשכר ──
    node('P1_ancillary', 'שירותים נלווים לשכר', 'payroll_ancillary', {
      is_parent_task: true,
      frequency_inherit: true,
      depends_on: ['P1_payroll'],
      execution: 'parallel',
      steps: [
        { key: 'payslip_sending',  label: 'משלוח תלושים' },
        { key: 'masav_employees',  label: 'מס"ב עובדים' },
        { key: 'masav_social',     label: 'מס"ב סוציאליות' },
      ],
    }),

    // ── רשויות שכר ──
    node('P1_authorities', 'רשויות שכר', 'payroll_authorities', {
      is_parent_task: true,
      default_frequency: 'monthly',
      depends_on: ['P1_payroll'],
      children: [
        node('P1_social_security', 'ביטוח לאומי', 'social_security', {
          default_frequency: 'monthly',
          frequency_field: 'social_security_frequency',
          frequency_fallback: 'payroll_frequency',
          frequency_inherit: true,
          depends_on: ['P1_authorities'],
          extra_fields: { ...PAYMENT_METHOD_FIELD },
          steps: [
            { key: 'report_prep', label: 'הפקת דוח' },
            { key: 'submission',  label: 'דיווח' },
            { key: 'payment',     label: 'תשלום' },
          ],
        }),
        node('P1_deductions', 'ניכויים', 'deductions', {
          default_frequency: 'bimonthly',
          frequency_field: 'deductions_frequency',
          frequency_fallback: 'payroll_frequency',
          depends_on: ['P1_authorities'],
          extra_fields: { ...PAYMENT_METHOD_FIELD },
          steps: [
            { key: 'report_prep', label: 'הפקת דוח' },
            { key: 'submission',  label: 'דיווח' },
            { key: 'payment',     label: 'תשלום' },
          ],
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
    // ── ייצור ──
    node('P2_production', 'ייצור', 'bookkeeping_production', {
      is_parent_task: true,
      default_frequency: 'monthly',
      children: [
        node('P2_bookkeeping', 'הנהלת חשבונות', 'bookkeeping', {
          default_frequency: 'monthly',
          depends_on: ['P2_production'],
          steps: [
            { key: 'income_input',  label: 'קליטת הכנסות' },
            { key: 'expense_input', label: 'קליטת הוצאות' },
          ],
        }),
        node('P2_masav_suppliers', 'מס"ב ספקים', 'masav_suppliers', {
          default_frequency: 'monthly',
          depends_on: ['P2_bookkeeping'],
          execution: 'sequential',
          extra_fields: {
            masav_cycles: {
              type: 'select',
              label: 'מספר סייקלים בחודש',
              options: [
                { value: '1', label: 'סייקל 1 (אמצע חודש - 15)' },
                { value: '2', label: '2 סייקלים (אמצע + סוף חודש - 15, 30)' },
              ],
              default_value: '1',
            },
          },
          cycle_dates: [15, 30],
          steps: [
            { key: 'file_prep',    label: 'הכנת קובץ' },
            { key: 'upload',       label: 'העלאה' },
            { key: 'confirmation', label: 'אישור ביצוע' },
          ],
        }),
      ],
    }),

    // ── דיווחים ──
    node('P2_reporting', 'דיווחים', 'bookkeeping_reporting', {
      is_parent_task: true,
      default_frequency: 'monthly',
      depends_on: ['P2_bookkeeping'],
      children: [
        node('P2_vat', 'מע"מ', 'vat', {
          default_frequency: 'bimonthly',
          frequency_field: 'vat_reporting_frequency',
          depends_on: ['P2_reporting'],
          extra_fields: {
            vat_reporting_method: {
              type: 'select',
              label: 'סוג דיווח',
              options: [
                { value: 'periodic_manual', label: 'תקופתי (המחאה/ידני)', sla_day: 15 },
                { value: 'periodic_digital', label: 'תקופתי (דיגיטלי)', sla_day: 19 },
                { value: 'detailed_874', label: 'דיווח מפורט (874)', sla_day: 23 },
              ],
              default_value: 'periodic_digital',
            },
            ...PAYMENT_METHOD_FIELD,
          },
          steps: [
            { key: 'report_prep', label: 'הפקת דוח' },
            { key: 'submission',  label: 'דיווח' },
            { key: 'payment',     label: 'תשלום' },
          ],
        }),
        node('P2_tax_advances', 'מקדמות מס הכנסה', 'tax_advances', {
          default_frequency: 'bimonthly',
          frequency_field: 'tax_advances_frequency',
          depends_on: ['P2_reporting'],
          extra_fields: { ...PAYMENT_METHOD_FIELD },
          steps: [
            { key: 'report_prep', label: 'הפקת דוח' },
            { key: 'submission',  label: 'דיווח' },
            { key: 'payment',     label: 'תשלום' },
          ],
        }),
      ],
    }),

    // ── סגירה ──
    node('P2_closing', 'סגירה', 'bookkeeping_closing', {
      is_parent_task: true,
      default_frequency: 'monthly',
      depends_on: ['P2_vat'],
      children: [
        node('P2_reconciliation', 'התאמות חשבונות', 'reconciliation', {
          default_frequency: 'monthly',
          depends_on: ['P2_closing'],
          smart_link: 'bank_accounts',
          steps: [
            { key: 'bank_statements',    label: 'קבלת דפי בנק' },
            { key: 'bank_reconciliation', label: 'התאמת בנק' },
            { key: 'cc_reconciliation',   label: 'התאמת כרטיסי אשראי' },
            { key: 'differences',         label: 'טיפול בהפרשים' },
          ],
        }),
        node('P2_pnl', 'רווח והפסד', 'pnl_reports', {
          default_frequency: 'monthly',
          frequency_field: 'pnl_frequency',
          depends_on: ['P2_reconciliation'],
          steps: [
            { key: 'report_generation', label: 'הפקת דוח' },
          ],
        }),
      ],
    }),
  ],
};

// ============================================================
// P3 — ADMIN BRANCH
// ============================================================

const P3_BRANCH = {
  id: 'P3',
  label: 'ניהול ואדמיניסטרציה',
  color_var: '--cp-p3',
  children: [
    node('P3_admin', 'אדמיניסטרציה', 'admin', {
      default_frequency: 'monthly',
      steps: [
        { key: 'task', label: 'ביצוע' },
      ],
    }),
    node('P3_office', 'משרד', 'office', {
      default_frequency: 'monthly',
      steps: [
        { key: 'task', label: 'ביצוע' },
      ],
    }),
  ],
};

// ============================================================
// P5 — ANNUAL REPORTS BRANCH (open for future spec)
// ============================================================

const P5_BRANCH = {
  id: 'P5',
  label: 'דוחות שנתיים',
  color_var: '--cp-p5',
  children: [
    node('P5_annual_reports', 'מאזנים / דוחות שנתיים', 'annual_reports', {
      is_parent_task: true,
      default_frequency: 'yearly',
      depends_on: ['P1_payroll', 'P2_pnl'],
      steps: [
        { key: 'gather_materials',    label: 'איסוף חומרים' },
        { key: 'data_entry',          label: 'קליטת נתונים' },
        { key: 'base_reconciliation', label: 'התאמות יסוד' },
        { key: 'sanity_check',        label: 'בדיקת סבירות' },
        { key: 'review',              label: 'סקירה' },
        { key: 'final_close',         label: 'סגירה' },
        { key: 'submission',          label: 'הגשה' },
      ],
    }),
    node('P5_personal_reports', 'דוחות אישיים', 'personal_reports', {
      is_parent_task: true,
      default_frequency: 'yearly',
      steps: [
        { key: 'gather_materials',    label: 'איסוף חומרים' },
        { key: 'data_entry',          label: 'קליטת נתונים' },
        { key: 'base_reconciliation', label: 'התאמות יסוד' },
        { key: 'sanity_check',        label: 'בדיקת סבירות' },
        { key: 'review',              label: 'סקירה' },
        { key: 'final_close',         label: 'סגירה' },
        { key: 'submission',          label: 'הגשה' },
      ],
    }),
  ],
};

// ============================================================
// P4 — HOME / PERSONAL BRANCH
// Steps only (no child nodes) — steps from processTemplates
// ============================================================

const P4_BRANCH = {
  id: 'P4',
  label: 'בית ואישי',
  color_var: '--cp-p4',
  children: [
    node('P4_meal_planning', 'תכנון ארוחות', 'meal_planning', {
      is_parent_task: true,
      default_frequency: 'daily',
      steps: [
        { key: 'plan_menu',   label: 'תכנון תפריט' },
        { key: 'shopping',    label: 'רשימת קניות' },
        { key: 'preparation', label: 'הכנה' },
      ],
    }),
    node('P4_morning_routine', 'שגרת בוקר', 'morning_routine', {
      is_parent_task: true,
      default_frequency: 'daily',
      steps: [
        { key: 'wake_up',  label: 'קימה' },
        { key: 'exercise', label: 'פעילות גופנית' },
        { key: 'planning', label: 'תכנון יום' },
      ],
    }),
    node('P4_evening_routine', 'שגרת ערב', 'evening_routine', {
      is_parent_task: true,
      default_frequency: 'daily',
      steps: [
        { key: 'review',    label: 'סיכום יום' },
        { key: 'prep_next', label: 'הכנה למחר' },
      ],
    }),
    node('P4_personal_errands', 'סידורים אישיים', 'personal_errands', {
      is_parent_task: true,
      default_frequency: 'weekly',
      steps: [
        { key: 'task', label: 'ביצוע' },
      ],
    }),
    node('P4_home_maintenance', 'תחזוקת בית', 'home_maintenance', {
      is_parent_task: true,
      default_frequency: 'monthly',
      steps: [
        { key: 'identify', label: 'זיהוי משימה' },
        { key: 'execute',  label: 'ביצוע' },
      ],
    }),
  ],
};

// ============================================================
// FULL TREE — SEED
// ============================================================

export const PROCESS_TREE_SEED = {
  version: '4.0',
  branches: {
    P1: P1_BRANCH,
    P2: P2_BRANCH,
    P3: P3_BRANCH,
    P4: P4_BRANCH,
    P5: P5_BRANCH,
  },
};

// ============================================================
// FULL SERVICE — "Magic Button" node list
// Only REAL service nodes (not parent grouping nodes)
// ============================================================

export const FULL_SERVICE_NODES = [
  // P1 Payroll
  'P1_payroll',
  'P1_ancillary',
  'P1_social_security',
  'P1_deductions',
  // P2 Bookkeeping
  'P2_bookkeeping',
  'P2_masav_suppliers',
  'P2_vat',
  'P2_tax_advances',
  'P2_reconciliation',
  'P2_pnl',
  // P5 Annual
  'P5_annual_reports',
];

// ============================================================
// LEGACY NODE ID MAP — for migration from V3.5 to V4.0
// Old node ID → new node ID or null (removed)
// ============================================================

export const LEGACY_NODE_MAP = {
  // P1 — removed sub-nodes (became steps)
  P1_payslip_sending: 'P1_ancillary',       // step of ancillary
  P1_masav_employees: 'P1_ancillary',        // step of ancillary
  P1_masav_social: 'P1_ancillary',           // step of ancillary
  P1_social_security_report: 'P1_social_security',  // step of social_security
  P1_social_security_payment: 'P1_social_security',  // step of social_security
  P1_deductions_report: 'P1_deductions',     // step of deductions
  P1_deductions_payment: 'P1_deductions',    // step of deductions
  // P2 — removed sub-nodes (became steps)
  P2_expense_collection: 'P2_bookkeeping',   // step of bookkeeping
  P2_vat_report: 'P2_vat',                   // step of vat
  P2_vat_payment: 'P2_vat',                  // step of vat
  P2_tax_advances_report: 'P2_tax_advances', // step of tax_advances
  P2_tax_advances_payment: 'P2_tax_advances',// step of tax_advances
  P2_bank_reconciliation: 'P2_reconciliation',   // step of reconciliation
  P2_credit_reconciliation: 'P2_reconciliation', // step of reconciliation
  // P5 — removed sub-nodes (became steps)
  P5_gather_materials: 'P5_annual_reports',
  P5_data_entry: 'P5_annual_reports',
  P5_basic_reconciliation: 'P5_annual_reports',
  P5_reasonableness_check: 'P5_annual_reports',
  P5_review: 'P5_annual_reports',
  P5_closing: 'P5_annual_reports',
  P5_submission: 'P5_annual_reports',
  P5_personal_gather: 'P5_personal_reports',
  P5_personal_data_entry: 'P5_personal_reports',
  P5_personal_reconciliation: 'P5_personal_reports',
  P5_personal_check: 'P5_personal_reports',
  P5_personal_review: 'P5_personal_reports',
  P5_personal_closing: 'P5_personal_reports',
  P5_personal_submission: 'P5_personal_reports',
  // P5 — removed entirely
  P5_capital_statement: null,
  // P3 — renamed
  P3_consulting: 'P3_office',
  // P4 — removed sub-nodes (already steps in processTemplates)
  P4_plan_menu: 'P4_meal_planning',
  P4_shopping: 'P4_meal_planning',
  P4_preparation: 'P4_meal_planning',
  P4_wake_up: 'P4_morning_routine',
  P4_exercise: 'P4_morning_routine',
  P4_planning: 'P4_morning_routine',
  P4_review: 'P4_evening_routine',
  P4_prep_next: 'P4_evening_routine',
  P4_identify: 'P4_home_maintenance',
  P4_execute: 'P4_home_maintenance',
};

// ============================================================
// LEGACY SERVICE KEY MAP — old service_key → new service_key
// For migrating client.service_types
// ============================================================

export const LEGACY_SERVICE_KEY_MAP = {
  payslip_sending: 'payroll_ancillary',
  masav_employees: 'payroll_ancillary',
  masav_social: 'payroll_ancillary',
  consulting: 'office',
  expense_collection: 'bookkeeping',
  vat_report: 'vat',
  vat_payment: 'vat',
  tax_advances_report: 'tax_advances',
  tax_advances_payment: 'tax_advances',
  social_security_report: 'social_security',
  social_security_payment: 'social_security',
  deductions_report: 'deductions',
  deductions_payment: 'deductions',
  bank_reconciliation: 'reconciliation',
  credit_card_reconciliation: 'reconciliation',
  capital_statement: null, // removed
};

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
  const n = findNodeById(tree, nodeId);
  return n?.parent_id || null;
}

export default PROCESS_TREE_SEED;
