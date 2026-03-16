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

  // Payroll voucher intake — 5 דק' גג לכל אחד
  'קליטת פקודת שכר':   { duration: 5,  cognitiveLoad: 0, label: 'קליטת פקודת שכר' },
  'work_salary_entry':  { duration: 5,  cognitiveLoad: 0, label: 'Salary Entry' },
  'רישום תשלומי עובדים': { duration: 5, cognitiveLoad: 0, label: 'רישום תשלומי עובדים' },
  'work_employee_payments': { duration: 5, cognitiveLoad: 0, label: 'Employee Payments' },
  'רישום תשלומי פנסיות': { duration: 5, cognitiveLoad: 0, label: 'רישום תשלומי פנסיות' },
  'work_pension_payments': { duration: 5, cognitiveLoad: 0, label: 'Pension Payments' },

  // MASAV services — real-world timings
  'מס"ב עובדים':       { duration: 10, cognitiveLoad: 0, label: 'מס"ב עובדים' },       // 5-10 דק' כולל הודעת ווטסאפ לחותמים
  'work_masav':         { duration: 10, cognitiveLoad: 0, label: 'MASAV' },
  'מס"ב סוציאליות':    { duration: 5,  cognitiveLoad: 0, label: 'מס"ב סוציאליות' },    // 5 דק' לכל שלב
  'work_masav_social':  { duration: 5,  cognitiveLoad: 0, label: 'MASAV Social' },
  'מס"ב ספקים':        { duration: 30, cognitiveLoad: 2, label: 'מס"ב ספקים' },         // 15-45 דק' הכנה תלוי לקוח
  'work_masav_suppliers': { duration: 30, cognitiveLoad: 2, label: 'MASAV Suppliers' },
  'מס"ב רשויות':       { duration: 5,  cognitiveLoad: 0, label: 'מס"ב רשויות' },       // דיווח+תשלום = 3+2 דק'
  'work_masav_authorities': { duration: 5, cognitiveLoad: 0, label: 'MASAV Authorities' },
  'משלוח תלושים':      { duration: 5,  cognitiveLoad: 0, label: 'משלוח תלושים' },       // 5 דק'
  'work_payslip_sending': { duration: 5, cognitiveLoad: 0, label: 'Payslip Sending' },
  'פנסיות וקרנות':     { duration: 15, cognitiveLoad: 0, label: 'פנסיות וקרנות' },
  'work_social_benefits': { duration: 15, cognitiveLoad: 0, label: 'Social Benefits' },

  // P2 — Bookkeeping & VAT
  'מע"מ — הכנה':       { duration: 30, cognitiveLoad: 2, label: 'מע"מ — הכנה' },        // לקוח שצריך הכנת דוח
  'work_vat_prep':      { duration: 30, cognitiveLoad: 2, label: 'VAT Prep' },
  'מע"מ — העלאה':      { duration: 10, cognitiveLoad: 0, label: 'מע"מ — העלאה' },       // העלאה + העברה לחותמים
  'work_vat_upload':    { duration: 10, cognitiveLoad: 0, label: 'VAT Upload' },
  'מע"מ':              { duration: 10, cognitiveLoad: 0, label: 'מע"מ' },               // ברירת מחדל — לקוח מנהל, רק העלאה
  'work_vat_reporting': { duration: 10, cognitiveLoad: 0, label: 'VAT Reporting' },
  'מע"מ 874':          { duration: 5,  cognitiveLoad: 0, label: 'מע"מ 874' },           // דיווח 3 + תשלום 2 דק'
  'work_vat_874':       { duration: 5,  cognitiveLoad: 0, label: 'VAT 874' },
  'מקדמות מס':         { duration: 5,  cognitiveLoad: 0, label: 'מקדמות מס' },          // דיווח 3 + תשלום 2 דק'
  'work_tax_advances':  { duration: 5,  cognitiveLoad: 0, label: 'Tax Advances' },
  'הנהלת חשבונות':     { duration: 30, cognitiveLoad: 2, label: 'הנהלת חשבונות' },
  'work_bookkeeping':   { duration: 30, cognitiveLoad: 2, label: 'Bookkeeping' },
  'התאמות':            { duration: 30, cognitiveLoad: 2, label: 'התאמות' },
  'work_reconciliation': { duration: 30, cognitiveLoad: 2, label: 'Reconciliation' },
  'תשלום רשויות':      { duration: 5,  cognitiveLoad: 0, label: 'תשלום רשויות' },       // דיווח שובר 3 דק' + תשלום 2 דק'
  'work_authorities_payment': { duration: 5, cognitiveLoad: 0, label: 'Authorities Payment' },

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
