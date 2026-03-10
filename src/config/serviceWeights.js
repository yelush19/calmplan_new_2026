/**
 * ── SERVICE WEIGHTS MATRIX ──
 * Maps each service category to its default duration and cognitive load tier.
 * This is the "DNA" that auto-fills TaskEditDialog when a task opens.
 *
 * Duration: minutes (default for the service, before client-tier scaling)
 * Cognitive Load: 0=ננו, 1=פשוט, 2=בינוני, 3=מורכב
 *
 * Priority: client tier > service weight > global default (15 min)
 * If client has a higher tier, the tier's maxMinutes overrides service duration.
 */

export const SERVICE_WEIGHTS = {
  // P1 — Payroll
  'שכר':               { duration: 15, cognitiveLoad: 1, label: 'שכר' },
  'הכנת שכר':          { duration: 15, cognitiveLoad: 1, label: 'הכנת שכר' },
  'work_payroll':       { duration: 15, cognitiveLoad: 1, label: 'Payroll' },
  'ביטוח לאומי':       { duration: 15, cognitiveLoad: 1, label: 'ביטוח לאומי' },
  'work_social_security': { duration: 15, cognitiveLoad: 1, label: 'Social Security' },
  'ניכויים':           { duration: 15, cognitiveLoad: 1, label: 'ניכויים' },
  'work_deductions':    { duration: 15, cognitiveLoad: 1, label: 'Deductions' },

  // MASAV services — all fast (ננו)
  'מס"ב עובדים':       { duration: 15, cognitiveLoad: 0, label: 'מס"ב עובדים' },
  'work_masav':         { duration: 15, cognitiveLoad: 0, label: 'MASAV' },
  'מס"ב סוציאליות':    { duration: 15, cognitiveLoad: 0, label: 'מס"ב סוציאליות' },
  'work_masav_social':  { duration: 15, cognitiveLoad: 0, label: 'MASAV Social' },
  'מס"ב ספקים':        { duration: 15, cognitiveLoad: 0, label: 'מס"ב ספקים' },
  'work_masav_suppliers': { duration: 15, cognitiveLoad: 0, label: 'MASAV Suppliers' },
  'מס"ב רשויות':       { duration: 15, cognitiveLoad: 0, label: 'מס"ב רשויות' },
  'work_masav_authorities': { duration: 15, cognitiveLoad: 0, label: 'MASAV Authorities' },
  'משלוח תלושים':      { duration: 15, cognitiveLoad: 0, label: 'משלוח תלושים' },
  'work_payslip_sending': { duration: 15, cognitiveLoad: 0, label: 'Payslip Sending' },
  'סוציאליות':         { duration: 15, cognitiveLoad: 0, label: 'סוציאליות' },
  'work_social_benefits': { duration: 15, cognitiveLoad: 0, label: 'Social Benefits' },

  // P2 — Bookkeeping & VAT
  'מע"מ':              { duration: 15, cognitiveLoad: 1, label: 'מע"מ' },
  'work_vat_reporting': { duration: 15, cognitiveLoad: 1, label: 'VAT Reporting' },
  'מע"מ 874':          { duration: 15, cognitiveLoad: 0, label: 'מע"מ 874' },
  'work_vat_874':       { duration: 15, cognitiveLoad: 0, label: 'VAT 874' },
  'מקדמות מס':         { duration: 15, cognitiveLoad: 0, label: 'מקדמות מס' },
  'work_tax_advances':  { duration: 15, cognitiveLoad: 0, label: 'Tax Advances' },
  'הנהלת חשבונות':     { duration: 30, cognitiveLoad: 2, label: 'הנהלת חשבונות' },
  'work_bookkeeping':   { duration: 30, cognitiveLoad: 2, label: 'Bookkeeping' },
  'התאמות':            { duration: 30, cognitiveLoad: 2, label: 'התאמות' },
  'work_reconciliation': { duration: 30, cognitiveLoad: 2, label: 'Reconciliation' },
  'תשלום רשויות':      { duration: 15, cognitiveLoad: 1, label: 'תשלום רשויות' },
  'work_authorities_payment': { duration: 15, cognitiveLoad: 1, label: 'Authorities Payment' },

  // Annual / Complex
  'מאזנים':            { duration: 45, cognitiveLoad: 3, label: 'מאזנים' },
  'מאזן':              { duration: 45, cognitiveLoad: 3, label: 'מאזן' },
  'דוח שנתי':          { duration: 45, cognitiveLoad: 3, label: 'דוח שנתי' },
  'work_annual_reports': { duration: 45, cognitiveLoad: 3, label: 'Annual Reports' },
  'רווח והפסד':        { duration: 30, cognitiveLoad: 2, label: 'רווח והפסד' },
  'work_pnl':           { duration: 30, cognitiveLoad: 2, label: 'P&L' },

  // Reporting
  'דיווח למתפעל':      { duration: 15, cognitiveLoad: 0, label: 'דיווח למתפעל' },
  'work_operator_reporting': { duration: 15, cognitiveLoad: 0, label: 'Operator Reporting' },
  'דיווח לטמל':        { duration: 15, cognitiveLoad: 0, label: 'דיווח לטמל' },
  'work_taml_reporting': { duration: 15, cognitiveLoad: 0, label: 'TAML Reporting' },
  'הנחיות מס"ב ממתפעל': { duration: 15, cognitiveLoad: 0, label: 'הנחיות מס"ב ממתפעל' },
  'מילואים':           { duration: 15, cognitiveLoad: 0, label: 'מילואים' },
  'work_reserve_claims': { duration: 15, cognitiveLoad: 0, label: 'Reserve Claims' },

  // P3 — Services / Admin
  'ייעוץ':             { duration: 30, cognitiveLoad: 2, label: 'ייעוץ' },
  'work_consulting':    { duration: 30, cognitiveLoad: 2, label: 'Consulting' },
  'מעקב שיווק':        { duration: 15, cognitiveLoad: 0, label: 'מעקב שיווק' },
  'work_marketing':     { duration: 15, cognitiveLoad: 0, label: 'Marketing' },
  'לחזור ללקוח':       { duration: 15, cognitiveLoad: 0, label: 'לחזור ללקוח' },
  'work_callback':      { duration: 15, cognitiveLoad: 0, label: 'Callback' },
  'פגישה':             { duration: 30, cognitiveLoad: 1, label: 'פגישה' },
  'work_meeting':       { duration: 30, cognitiveLoad: 1, label: 'Meeting' },
  'כללי':              { duration: 15, cognitiveLoad: 0, label: 'כללי' },
  'work_general':       { duration: 15, cognitiveLoad: 0, label: 'General' },
  'אדמיניסטרציה':      { duration: 15, cognitiveLoad: 0, label: 'אדמיניסטרציה' },
  'work_admin':         { duration: 15, cognitiveLoad: 0, label: 'Admin' },
  'work_client_management': { duration: 15, cognitiveLoad: 0, label: 'Client Management' },
};

/**
 * Get service weight for a given category.
 * Returns { duration, cognitiveLoad } or defaults (15 min, tier 0).
 */
export function getServiceWeight(category) {
  return SERVICE_WEIGHTS[category] || { duration: 15, cognitiveLoad: 0, label: category || 'כללי' };
}
