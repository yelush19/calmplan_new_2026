/**
 * Israeli Tax Calendar for 2026
 * ==============================
 * Official dates based on Israeli Tax Authority (רשות המסים) rules:
 *
 * Standard deadlines (per law):
 *   - VAT & Tax Advances (מע"מ ומקדמות): 15th of following month
 *   - Income Tax Deductions (ניכויים): 16th of following month
 *   - Detailed VAT Report (דוח מפורט 874): 23rd of following month
 *   - Online filing (דיווח מקוון): 19th of following month
 *   - National Insurance (ביטוח לאומי): 15th, or 16th if Saturday
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

// Helper: adjust date to next Monday if it falls on Fri(5)/Sat(6)/Sun(0)
function adjustForRestDay(year, month, day) {
  const dow = getDayOfWeek(year, month, day);
  if (dow === 5) return day + 3; // Fri → Mon
  if (dow === 6) return day + 2; // Sat → Mon
  if (dow === 0) return day + 1; // Sun → Mon
  return day;
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
    case 'מע"מ':
      // 874 clients have the detailed VAT deadline (23rd)
      if (isDetailedVat) return entry.detailedVat;
      // Regular clients use online filing deadline (19th) - most file online
      return entry.onlineFiling;

    case 'מקדמות מס':
      // Tax advances follow VAT schedule for online filers
      return entry.onlineFiling;

    case 'ניכויים':
      // Online filers get until the 19th
      return entry.onlineFiling;

    case 'ביטוח לאומי':
      // National insurance: 15th, 16th if Saturday
      return entry.nationalInsurance;

    case 'שכר':
      // Payroll follows the online filing deadline
      return entry.onlineFiling;

    case 'דוח שנתי':
      // Annual report has its own deadline (May 31)
      return `${entry.dueYear}-05-31`;

    default:
      return entry.onlineFiling;
  }
}

/**
 * Check if a client is a "מע"מ מפורט" (874) reporter.
 * This is determined by the deadlines.vat field from Monday containing "874".
 */
export function isClient874(client) {
  // Check deadlines.vat field (from Monday import)
  if (client?.deadlines?.vat && String(client.deadlines.vat).includes('874')) {
    return true;
  }
  // Also check reporting_info for any indicator
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
