/**
 * inferClientServices — Smart Auto-Enable Rules
 *
 * Given a client's data (business_info, service_types, tax_info, bank accounts),
 * returns the set of process tree node IDs that should be auto-enabled.
 *
 * Rules (per user specification):
 *   1. שכר (payroll) → P1_authorities + children + P1_closing + P1_payslip_sending
 *   2. מקדמות (tax_advances in tax tab) → P2_income + P2_tax_advances
 *   3. מע"מ (vat_reporting) → P2_income + P2_expenses + P2_vat
 *   4. סוג לקוח = חברה → P2_reconciliation
 *   5. בנק + כרטיסי אשראי → both reconciliation sub-steps enabled
 *
 * This function does NOT modify the client — it returns a recommended process_tree
 * that can be merged with (or replace) the existing one.
 */

/**
 * Infer which process tree nodes should be enabled based on client data.
 *
 * @param {object} client - Client entity with service_types, business_info, tax_info, etc.
 * @param {object[]} bankAccounts - Array of ClientAccount entities for this client
 * @returns {{ nodes: Record<string, {enabled: true}>, reasons: string[] }}
 *   - nodes: map of nodeId → { enabled: true } for all auto-enabled nodes
 *   - reasons: human-readable list of which rules fired (for UI display)
 */
export function inferClientServices(client, bankAccounts = []) {
  const nodes = {};
  const reasons = [];

  const serviceTypes = new Set(client.service_types || []);
  const businessType = client.business_info?.business_type;
  const taxInfo = client.tax_info || {};

  // Helper: enable a node
  const enable = (nodeId) => {
    nodes[nodeId] = { enabled: true };
  };

  // ─────────────────────────────────────────────────
  // RULE 1: שכר → רשויות שכר + קליטה + תלושים
  // If client has payroll service → auto-enable:
  //   P1_payroll (already on), P1_authorities, P1_social_security,
  //   P1_deductions, P1_closing, P1_payslip_sending
  // ─────────────────────────────────────────────────
  if (serviceTypes.has('payroll')) {
    enable('P1_payroll');
    enable('P1_authorities');
    enable('P1_social_security');
    enable('P1_deductions');
    enable('P1_closing');
    enable('P1_payslip_sending');
    reasons.push('שכר → רשויות שכר + קליטה להנה"ח + משלוח תלושים');
  }

  // ─────────────────────────────────────────────────
  // RULE 2: מקדמות מס → קליטת הכנסות + מקדמות
  // Check both service_types AND tax_info for tax_advances
  // ─────────────────────────────────────────────────
  const hasTaxAdvances = serviceTypes.has('tax_advances') ||
    (taxInfo.annual_tax_ids?.tax_advances_id && taxInfo.annual_tax_ids.tax_advances_id !== '');

  if (hasTaxAdvances) {
    enable('P2_income');
    enable('P2_tax_advances');
    reasons.push('מקדמות מס → קליטת הכנסות + מקדמות');
  }

  // ─────────────────────────────────────────────────
  // RULE 3: מע"מ → קליטת הכנסות + הוצאות + מע"מ
  // ─────────────────────────────────────────────────
  if (serviceTypes.has('vat_reporting')) {
    enable('P2_income');
    enable('P2_expenses');
    enable('P2_vat');
    reasons.push('מע"מ → קליטת הכנסות + הוצאות + מע"מ');
  }

  // ─────────────────────────────────────────────────
  // RULE 4: חברה → התאמות חשבונות
  // If business_type is "company" → reconciliation is required
  // ─────────────────────────────────────────────────
  if (businessType === 'company') {
    enable('P2_reconciliation');
    reasons.push('סוג לקוח חברה → התאמות חשבונות');
  }

  // ─────────────────────────────────────────────────
  // RULE 5: בנק + כרטיסי אשראי → שלבי התאמות
  // If client has both bank AND credit_card accounts →
  // enable reconciliation with both sub-steps
  // ─────────────────────────────────────────────────
  const activeAccounts = bankAccounts.filter(a => a.account_status === 'active');
  const hasBankAccount = activeAccounts.some(a => a.account_type === 'bank');
  const hasCreditCard = activeAccounts.some(a => a.account_type === 'credit_card');

  if (hasBankAccount && hasCreditCard) {
    enable('P2_reconciliation');
    reasons.push('בנק + כרטיסי אשראי → התאמות חשבונות (בנק + אשראי)');
  } else if (hasBankAccount) {
    enable('P2_reconciliation');
    reasons.push('חשבון בנק → התאמות חשבונות');
  }

  // ─────────────────────────────────────────────────
  // Additional inferences from service_types
  // ─────────────────────────────────────────────────

  // bookkeeping → income + expenses + reconciliation
  if (serviceTypes.has('bookkeeping')) {
    enable('P2_income');
    enable('P2_expenses');
    enable('P2_reconciliation');
    reasons.push('הנה"ח → קליטת הכנסות + הוצאות + התאמות');
  }

  // pnl_reports → income + expenses + reconciliation + pnl
  if (serviceTypes.has('pnl_reports')) {
    enable('P2_income');
    enable('P2_expenses');
    enable('P2_reconciliation');
    enable('P2_pnl');
    reasons.push('דוח רו"ה → הכנסות + הוצאות + התאמות + רו"ה');
  }

  // annual_reports
  if (serviceTypes.has('annual_reports')) {
    enable('P5_annual_reports');
    reasons.push('דוחות שנתיים → P5');
  }

  // masav_suppliers
  if (serviceTypes.has('masav_suppliers')) {
    enable('P2_masav_suppliers');
    reasons.push('מס"ב ספקים → P2');
  }

  // social_security standalone
  if (serviceTypes.has('social_security') && !serviceTypes.has('payroll')) {
    enable('P1_social_security');
    reasons.push('ביטוח לאומי → P1');
  }

  // deductions standalone
  if (serviceTypes.has('deductions') && !serviceTypes.has('payroll')) {
    enable('P1_deductions');
    reasons.push('ניכויים → P1');
  }

  return { nodes, reasons };
}

/**
 * Merge inferred nodes into an existing client process_tree.
 * Only ADDS nodes that are not already present — never disables existing ones.
 *
 * @param {object} existingTree - Current client process_tree
 * @param {object} inferredNodes - Output of inferClientServices().nodes
 * @returns {{ merged: object, addedCount: number, addedIds: string[] }}
 */
export function mergeInferredNodes(existingTree, inferredNodes) {
  const merged = { ...existingTree };
  const addedIds = [];

  for (const [nodeId, nodeVal] of Object.entries(inferredNodes)) {
    // Only add if not already present or if currently disabled
    if (!merged[nodeId] || !merged[nodeId].enabled) {
      merged[nodeId] = { ...merged[nodeId], ...nodeVal };
      addedIds.push(nodeId);
    }
  }

  return { merged, addedCount: addedIds.length, addedIds };
}
