/**
 * Israeli Tax Calendar for 2026
 * ==============================
 * Practical deadlines (online filing, used by most clients):
 *
 *   - ביטוח לאומי (National Insurance): 15th of following month
 *   - מע"מ תקופתי / ניכויים / מקדמות (VAT/Deductions/Advances): 19th of following month
 *   - מע"מ 874 מפורט (Detailed VAT Report): 23rd of following month
 *
 * Legacy base deadlines (mail filers):
 *   - VAT & Tax Advances: 15th
 *   - Income Tax Deductions: 16th
 *
 * If a deadline falls on a religious rest day (Fri/Sat/Sun),
 * it is pushed to the next Monday.
 *
 * Online filing deadline (19th) is a fixed date and does not shift.
 */

// Helper: get day of week (0=Sun, 1=Mon ... 6=Sat)
function getDayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

// Helper: adjust date to next work day if it falls on Fri/Sat/Sun or holiday
import { adjustForRestDayWithHolidays } from '@/config/israeliHolidays';
function adjustForRestDay(year, month, day) {
  return adjustForRestDayWithHolidays(year, month, day);
}

// Helper: adjust national insurance (only if Saturday → 16th)
function adjustForSaturday(year, month, day) {
  const dow = getDayOfWeek(year, month, day);
  if (dow === 6) return day + 1; // Sat → Sun (16th)
  return day;
}

/**
 * Generate the full 2026 tax calendar.
 * Each entry represents a REPORTING PERIOD (e.g., 'january' = report for January).
 * The due dates are in the FOLLOWING month.
 *
 * Returns an object keyed by period month (1-12) with due dates for each type.
 */
function generateTaxCalendar2026() {
  const calendar = {};
  const year = 2026;

  for (let reportMonth = 1; reportMonth <= 12; reportMonth++) {
    // Due dates are in the following month
    let dueYear = year;
    let dueMonth = reportMonth + 1;
    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear = year + 1;
    }

    // Standard deadlines
    const vatAdvancesDay = adjustForRestDay(dueYear, dueMonth, 15);
    const deductionsDay = adjustForRestDay(dueYear, dueMonth, 16);
    const detailedVatDay = adjustForRestDay(dueYear, dueMonth, 23);
    const nationalInsuranceDay = adjustForSaturday(dueYear, dueMonth, 15);

    // Online filing is always 19th (fixed)
    const onlineFilingDay = 19;

    // Payroll & related — 9th of following month
    const payrollDay = 9;
    // מס"ב סוציאליות — 12th
    const masavSocialDay = 12;
    // מס"ב רשויות / תשלום רשויות — 15th
    const masavAuthoritiesDay = 15;
    // מס"ב ספקים — 15th (תיקון: היה 10, הנכון הוא 15 לחודש)
    const masavSuppliersDay = 15;
    // דיווח למתפעל/טמל — 5th
    const operatorReportDay = 5;
    // הנחיות מס"ב ממתפעל — 1st
    const operatorInstructionsDay = 1;

    // Format as YYYY-MM-DD
    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

    calendar[reportMonth] = {
      reportMonth,
      reportMonthName: HEBREW_MONTH_NAMES[reportMonth - 1],
      dueYear,
      dueMonth,
      // מע"מ ומקדמות - for mail/standard clients
      vatAdvances: formatDate(dueYear, dueMonth, vatAdvancesDay),
      vatAdvancesDay,
      // ניכויים - for mail/standard clients
      deductions: formatDate(dueYear, dueMonth, deductionsDay),
      deductionsDay,
      // דיווח מקוון (online) - for all online filers (default for most clients)
      onlineFiling: formatDate(dueYear, dueMonth, onlineFilingDay),
      onlineFilingDay,
      // דוח מפורט 874 - for detailed VAT reporters
      detailedVat: formatDate(dueYear, dueMonth, detailedVatDay),
      detailedVatDay,
      // ביטוח לאומי
      nationalInsurance: formatDate(dueYear, dueMonth, nationalInsuranceDay),
      nationalInsuranceDay,
      // שכר / מס"ב עובדים / משלוח תלושים
      payroll: formatDate(dueYear, dueMonth, payrollDay),
      payrollDay,
      // מס"ב סוציאליות
      masavSocial: formatDate(dueYear, dueMonth, masavSocialDay),
      masavSocialDay,
      // מס"ב רשויות / תשלום רשויות
      masavAuthorities: formatDate(dueYear, dueMonth, masavAuthoritiesDay),
      masavAuthoritiesDay,
      // מס"ב ספקים
      masavSuppliers: formatDate(dueYear, dueMonth, masavSuppliersDay),
      masavSuppliersDay,
      // דיווח למתפעל/טמל
      operatorReport: formatDate(dueYear, dueMonth, operatorReportDay),
      operatorReportDay,
      // הנחיות מס"ב ממתפעל
      operatorInstructions: formatDate(dueYear, dueMonth, operatorInstructionsDay),
      operatorInstructionsDay,
    };
  }

  return calendar;
}

const HEBREW_MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

// Pre-computed calendar
export const TAX_CALENDAR_2026 = generateTaxCalendar2026();

/**
 * Determine which deadline type applies to a given category and client.
 *
 * Client types:
 * - "874" / מע"מ מפורט clients: Use detailedVat deadline (23rd)
 * - Online filing clients (most): Use onlineFiling deadline (19th)
 * - Mail clients: Use standard vatAdvances (15th) or deductions (16th)
 *
 * @param {string} category - Task category (מע"מ, מקדמות מס, ניכויים, ביטוח לאומי, שכר)
 * @param {object} client - Client object from DB
 * @param {number} reportMonth - The month being reported (1-12)
 * @returns {string} Due date in YYYY-MM-DD format
 */
export function getDueDateForCategory(category, client, reportMonth) {
  const entry = TAX_CALENDAR_2026[reportMonth];
  if (!entry) return null;

  const isDetailedVat = isClient874(client);

  switch (category) {
    // ── שכר ומשכורות — 9 לחודש ──
    case 'שכר':
    case 'מס"ב עובדים':
    case 'משלוח תלושים':
      return entry.payroll;

    // ── מתפעל/טמל — 5 לחודש ──
    case 'מתפעל':
    case 'טמל + לקוח':
    case 'דיווח למתפעל':
    case 'דיווח לטמל':
    case 'מילואים':
      return entry.operatorReport;

    // ── הנחיות מס"ב ממתפעל — 1 לחודש ──
    case 'הנחיות מס"ב ממתפעל':
      return entry.operatorInstructions;

    // ── מס"ב סוציאליות — 12 לחודש ──
    case 'מס"ב סוציאליות':
      return entry.masavSocial;

    // ── מס"ב ספקים — 10 לחודש ──
    case 'מס"ב ספקים':
      return entry.masavSuppliers;

    // ── מס"ב רשויות / תשלום רשויות — 15 לחודש ──
    case 'מס"ב רשויות':
    case 'תשלום רשויות':
      return entry.masavAuthorities;

    // ── ביטוח לאומי — 15 לחודש ──
    case 'ביטוח לאומי':
      return entry.nationalInsurance;

    // ── מע"מ — 19 רגיל, 23 ל-874 ──
    case 'מע"מ':
      if (isDetailedVat) return entry.detailedVat;
      return entry.onlineFiling;

    // ── מע"מ 874 — תמיד 23 ──
    case 'מע"מ 874':
      return entry.detailedVat;

    // ── ניכויים / מקדמות — 19 לחודש (דיגיטלי) ──
    case 'ניכויים':
    case 'מקדמות מס':
      return entry.onlineFiling;

    // ── דוח רו"ה — 19 לחודש ──
    case 'דוח רו"ה':
      return entry.onlineFiling;

    // ── דוח שנתי — 31 למאי ──
    case 'דוח שנתי':
      return `${entry.dueYear}-05-31`;

    default:
      return entry.onlineFiling;
  }
}

/**
 * Check if a client is a "מע"מ מפורט" (874) reporter.
 *
 * Resolution sources (in priority order):
 *   1. Process tree: client.process_tree.P2_vat.vat_reporting_method === 'detailed_874'
 *   2. reporting_info.vat_report_type === '874'
 *   3. deadlines.vat containing "874" (from Monday import)
 *   4. reporting_info.vat_detailed === true
 */
export function isClient874(client) {
  // 1. Process tree — vat_reporting_method on the P2_vat node (V4.0)
  const vatNode = client?.process_tree?.P2_vat;
  if (vatNode?.vat_reporting_method === 'detailed_874') {
    return true;
  }
  if (vatNode?.extra_fields?.vat_reporting_method === 'detailed_874') {
    return true;
  }
  // Legacy fallback: old P2_vat_report node ID
  const vatReportNode = client?.process_tree?.P2_vat_report;
  if (vatReportNode?.vat_reporting_method === 'detailed_874' || vatReportNode?.extra_fields?.vat_reporting_method === 'detailed_874') {
    return true;
  }
  // 2. Explicit vat_report_type field (set in client form)
  if (client?.reporting_info?.vat_report_type === '874') {
    return true;
  }
  // 3. deadlines.vat field (from Monday import)
  if (client?.deadlines?.vat && String(client.deadlines.vat).includes('874')) {
    return true;
  }
  // 4. reporting_info flag
  if (client?.reporting_info?.vat_detailed === true) {
    return true;
  }
  return false;
}

/**
 * Get the bimonthly due date for a category and client.
 * For bimonthly reporters, the report covers 2 months and is due in the
 * month following the period end.
 *
 * @param {string} category - Task category
 * @param {object} client - Client object
 * @param {number} periodEndMonth - The last month of the bimonthly period (2,4,6,8,10,12)
 * @returns {string} Due date in YYYY-MM-DD format
 */
export function getBimonthlyDueDate(category, client, periodEndMonth) {
  // Bimonthly report for period ending in month X is due in month X+1
  return getDueDateForCategory(category, client, periodEndMonth);
}

/**
 * Get a human-readable description of the deadline type for a client.
 */
export function getDeadlineTypeLabel(client) {
  if (isClient874(client)) {
    return 'דוח מפורט (874) - יעד 23 לחודש';
  }
  return 'דיווח מקוון - יעד 19 לחודש';
}

export { HEBREW_MONTH_NAMES };
