/**
 * Client Migration — service_types[] → process_tree {}
 *
 * Reads the legacy flat service_types[] array and reporting_info,
 * and generates the new hierarchical process_tree map.
 *
 * Rules:
 *   - Only maps nodes for services the client actually has
 *   - Preserves frequency data from reporting_info as node-level overrides
 *   - Does NOT delete service_types[] or reporting_info (backward-compatible)
 *   - Skips clients that already have a process_tree (idempotent)
 *   - full_service is expanded before mapping
 */

import { FULL_SERVICE_NODES } from '@/config/companyProcessTree';

// ============================================================
// MAPPING: service_types[] value → process tree node IDs
// ============================================================

/**
 * Maps each legacy service_types[] value to the tree node IDs it enables.
 * Some services map to a parent + its children (e.g., payroll enables the whole P1 chain).
 */
const SERVICE_TO_NODES = {
  // P1 — Payroll (V4.0 structure)
  payroll: ['P1_payroll', 'P1_ancillary', 'P1_authorities'],
  social_security: ['P1_social_security'],
  deductions: ['P1_deductions'],
  // Legacy keys → map to new parent
  masav_employees: ['P1_ancillary'],
  masav_social: ['P1_ancillary'],
  payslip_sending: ['P1_ancillary'],
  authorities_payment: ['P1_social_security', 'P1_deductions'],

  // P2 — Bookkeeping & Tax (V4.0 structure)
  bookkeeping: ['P2_bookkeeping'],
  bookkeeping_full: ['P2_bookkeeping'],
  vat_reporting: ['P2_vat'],
  tax_advances: ['P2_tax_advances'],
  pnl_reports: ['P2_pnl'],
  reconciliation: ['P2_reconciliation'],
  masav_suppliers: ['P2_masav_suppliers'],

  // P3 — Admin
  admin: ['P3_admin'],
  consulting: ['P3_office'],  // renamed

  // P5 — Annual
  annual_reports: ['P5_annual_reports'],
};

/**
 * Maps tree node IDs to the reporting_info field that holds their frequency.
 * Only nodes with independent frequencies are listed here.
 */
const NODE_FREQUENCY_FIELDS = {
  P1_payroll:          'payroll_frequency',
  P1_social_security:  'social_security_frequency',
  P1_deductions:       'deductions_frequency',
  P2_vat:              'vat_reporting_frequency',
  P2_tax_advances:     'tax_advances_frequency',
  P2_pnl:              'pnl_frequency',
};

// ============================================================
// MIGRATION FUNCTION
// ============================================================

/**
 * Migrate a single client from service_types[] to process_tree.
 *
 * @param {object} client - Client entity
 * @returns {{ process_tree: object, migrated: boolean }}
 *   - process_tree: the generated map (or existing one if already migrated)
 *   - migrated: true if migration was performed, false if skipped
 */
export function migrateClientToProcessTree(client) {
  // Already migrated — skip
  if (client.process_tree && Object.keys(client.process_tree).length > 0) {
    return { process_tree: client.process_tree, migrated: false };
  }

  const serviceTypes = client.service_types || [];
  if (serviceTypes.length === 0) {
    return { process_tree: {}, migrated: true };
  }

  // Step 1: Expand full_service
  const expanded = new Set(serviceTypes);
  if (expanded.has('full_service')) {
    for (const s of ['vat_reporting', 'payroll', 'tax_advances', 'annual_reports', 'social_security', 'deductions']) {
      expanded.add(s);
    }
  }

  // Step 2: Collect all enabled node IDs
  const enabledNodes = new Set();
  for (const serviceKey of expanded) {
    const nodeIds = SERVICE_TO_NODES[serviceKey];
    if (nodeIds) {
      for (const id of nodeIds) {
        enabledNodes.add(id);
      }
    }
  }

  // Step 3: Auto-enable parent nodes (V4.0 hierarchy)
  // P1: payroll → ancillary, authorities; authorities → social_security, deductions
  if (enabledNodes.has('P1_ancillary') || enabledNodes.has('P1_authorities')) enabledNodes.add('P1_payroll');
  if (enabledNodes.has('P1_social_security') || enabledNodes.has('P1_deductions')) {
    enabledNodes.add('P1_authorities');
    enabledNodes.add('P1_payroll');
  }

  // P2: production → bookkeeping, masav_suppliers; reporting → vat, tax_advances; closing → reconciliation, pnl
  if (enabledNodes.has('P2_bookkeeping') || enabledNodes.has('P2_masav_suppliers')) enabledNodes.add('P2_production');
  if (enabledNodes.has('P2_vat') || enabledNodes.has('P2_tax_advances')) {
    enabledNodes.add('P2_reporting');
    enabledNodes.add('P2_bookkeeping');
    enabledNodes.add('P2_production');
  }
  if (enabledNodes.has('P2_reconciliation') || enabledNodes.has('P2_pnl')) {
    enabledNodes.add('P2_closing');
    enabledNodes.add('P2_bookkeeping');
    enabledNodes.add('P2_production');
  }

  // Step 4: Build the process_tree map
  const reportingInfo = client.reporting_info || {};
  const processTree = {};

  for (const nodeId of enabledNodes) {
    const entry = { enabled: true };

    // Copy frequency from reporting_info if this node has an independent frequency
    const freqField = NODE_FREQUENCY_FIELDS[nodeId];
    if (freqField && reportingInfo[freqField]) {
      const freq = reportingInfo[freqField];
      if (freq && freq !== 'not_applicable') {
        entry.frequency = freq;
      }
    }

    // Copy authorities_payment_method to all payment sub-nodes
    if (nodeId.endsWith('_payment') && client.authorities_payment_method) {
      entry.payment_method = client.authorities_payment_method;
    }

    processTree[nodeId] = entry;
  }

  return { process_tree: processTree, migrated: true };
}

/**
 * Batch-migrate all clients. Returns a summary report.
 *
 * @param {object[]} clients - Array of client entities
 * @returns {{ results: Array<{clientId, name, migrated, nodeCount}>, total, migrated, skipped }}
 */
export function batchMigrateClients(clients) {
  const results = [];
  let migrated = 0;
  let skipped = 0;

  for (const client of clients) {
    const { process_tree, migrated: didMigrate } = migrateClientToProcessTree(client);

    results.push({
      clientId: client.id,
      name: client.name,
      migrated: didMigrate,
      nodeCount: Object.keys(process_tree).filter(k => process_tree[k]?.enabled).length,
    });

    if (didMigrate) migrated++;
    else skipped++;
  }

  return {
    results,
    total: clients.length,
    migrated,
    skipped,
  };
}

// ============================================================
// VAT REPORTING METHOD MIGRATION
// ============================================================

/**
 * Maps the legacy authorities_payment_method to VAT reporting method.
 * The payment method determines how VAT is filed and its SLA deadline.
 *
 * Legacy values (from services tab):
 *   masav, credit_card, bank_standing_order → digital filing → periodic_digital (deadline 19)
 *   standing_order, check                  → manual filing  → periodic_manual  (deadline 15)
 *
 * If the client has service_types including '874' or vat_reporting_frequency
 * indicates detailed reporting → detailed_874 (deadline 23)
 */
const PAYMENT_TO_VAT_METHOD = {
  masav: 'periodic_digital',
  credit_card: 'periodic_digital',
  bank_standing_order: 'periodic_digital',
  standing_order: 'periodic_manual',
  check: 'periodic_manual',
};

/**
 * Migrate a client's VAT payment method into the process tree's P2_vat node.
 *
 * @param {object} client - Client entity
 * @returns {{ process_tree: object, vat_method: string|null }}
 */
export function migrateVatReportingMethod(client) {
  const tree = { ...(client.process_tree || {}) };
  const paymentMethod = client.authorities_payment_method;
  const serviceTypes = client.service_types || [];

  // Detect 874 detailed reporting from service types or existing config
  const is874 = serviceTypes.some(s => s.includes('874')) ||
    client.reporting_info?.vat_report_type === '874';

  let vatMethod = null;

  if (is874) {
    vatMethod = 'detailed_874';
  } else if (paymentMethod && PAYMENT_TO_VAT_METHOD[paymentMethod]) {
    vatMethod = PAYMENT_TO_VAT_METHOD[paymentMethod];
  }

  if (vatMethod && tree.P2_vat) {
    tree.P2_vat = {
      ...tree.P2_vat,
      vat_reporting_method: vatMethod,
    };
  }

  return { process_tree: tree, vat_method: vatMethod };
}

/**
 * Batch migrate VAT reporting method for all clients.
 *
 * @param {object[]} clients
 * @returns {{ migrated: number, skipped: number, results: Array }}
 */
export function batchMigrateVatMethod(clients) {
  const results = [];
  let migrated = 0;
  let skipped = 0;

  for (const client of clients) {
    const { process_tree, vat_method } = migrateVatReportingMethod(client);
    if (vat_method) {
      results.push({ clientId: client.id, name: client.name, vat_method });
      migrated++;
    } else {
      skipped++;
    }
  }

  return { results, migrated, skipped, total: clients.length };
}

/**
 * Dry-run migration for a single client — returns a human-readable summary.
 * Useful for debugging and verification in console.
 *
 * @param {object} client - Client entity
 * @returns {string} summary text
 */
export function migrationPreview(client) {
  const { process_tree, migrated } = migrateClientToProcessTree(client);

  if (!migrated) {
    return `[${client.name}] Already migrated — ${Object.keys(client.process_tree).length} nodes`;
  }

  const enabled = Object.entries(process_tree)
    .filter(([, v]) => v.enabled)
    .map(([id, v]) => v.frequency ? `${id} (${v.frequency})` : id);

  return `[${client.name}] → ${enabled.length} nodes: ${enabled.join(', ')}`;
}
