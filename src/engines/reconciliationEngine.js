/**
 * Reconciliation Engine for accounting balance sheet workbooks.
 *
 * Matches items between two sides (e.g., book records vs bank statement),
 * calculates differences, computes depreciation and employee provisions,
 * and suggests adjusting journal entries.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a value into a Date object. Accepts Date instances and date strings.
 * @param {Date|string} val
 * @returns {Date}
 */
function toDate(val) {
  if (val instanceof Date) return val;
  return new Date(val);
}

/**
 * Return the absolute difference in calendar days between two dates.
 * @param {Date|string} a
 * @param {Date|string} b
 * @returns {number}
 */
function daysBetween(a, b) {
  const msPerDay = 86400000;
  const da = toDate(a);
  const db = toDate(b);
  return Math.round(Math.abs(da - db) / msPerDay);
}

/**
 * Round a number to two decimal places.
 * @param {number} n
 * @returns {number}
 */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Compute the net amount of a row (debit minus credit).
 * @param {{ debit?: number, credit?: number }} row
 * @returns {number}
 */
function netAmount(row) {
  return (row.debit || 0) - (row.credit || 0);
}

// ---------------------------------------------------------------------------
// Recreation-days seniority table (Israeli labor law reference)
// ---------------------------------------------------------------------------

/**
 * Lookup table: years of seniority -> recreation days entitled per year.
 * Based on the standard Israeli seniority brackets.
 */
const RECREATION_DAYS_TABLE = [
  { minYears: 0, maxYears: 1, days: 5 },
  { minYears: 1, maxYears: 2, days: 6 },
  { minYears: 2, maxYears: 3, days: 7 },
  { minYears: 3, maxYears: 4, days: 8 },
  { minYears: 4, maxYears: 5, days: 9 },
  { minYears: 5, maxYears: 6, days: 10 },
  { minYears: 6, maxYears: 7, days: 11 },
  { minYears: 7, maxYears: 8, days: 12 },
  { minYears: 8, maxYears: 9, days: 13 },
  { minYears: 9, maxYears: 10, days: 14 },
  { minYears: 10, maxYears: 15, days: 16 },
  { minYears: 15, maxYears: 20, days: 18 },
  { minYears: 20, maxYears: Infinity, days: 21 },
];

/** Daily recreation pay rate in NIS. */
const RECREATION_DAILY_RATE = 418;

/**
 * Return the number of recreation days for a given seniority in years.
 * @param {number} years - full years of seniority
 * @returns {number}
 */
function recreationDaysForSeniority(years) {
  for (const bracket of RECREATION_DAYS_TABLE) {
    if (years >= bracket.minYears && years < bracket.maxYears) {
      return bracket.days;
    }
  }
  // Fallback for very long tenure
  return 21;
}

// ---------------------------------------------------------------------------
// 1. autoMatch
// ---------------------------------------------------------------------------

/**
 * Automatically match rows between book records and external records.
 *
 * Matching strategy (applied in order of priority):
 *   1. Exact amount + date proximity (within `dateWindow` days) — "amount+date"
 *   2. Exact amount only — "amount"
 *
 * Each row is matched at most once.
 *
 * @param {Array<{ id?: any, date?: Date|string, debit?: number, credit?: number }>} bookRows
 * @param {Array<{ id?: any, date?: Date|string, debit?: number, credit?: number }>} externalRows
 * @param {{ dateWindow?: number }} [options={}] - dateWindow defaults to 3 days
 * @returns {{
 *   matched: Array<{ book: object, external: object, matchType: string, סוג_התאמה: string }>,
 *   unmatchedBook: object[],
 *   unmatchedExternal: object[]
 * }}
 */
function autoMatch(bookRows, externalRows, options = {}) {
  const dateWindow = options.dateWindow != null ? options.dateWindow : 3;

  const matchedBookIdx = new Set();
  const matchedExtIdx = new Set();
  const matched = [];

  // --- Pass 1: exact amount + date proximity ---
  for (let bi = 0; bi < bookRows.length; bi++) {
    if (matchedBookIdx.has(bi)) continue;
    const bAmt = netAmount(bookRows[bi]);

    for (let ei = 0; ei < externalRows.length; ei++) {
      if (matchedExtIdx.has(ei)) continue;
      const eAmt = netAmount(externalRows[ei]);

      if (bAmt === eAmt && bookRows[bi].date && externalRows[ei].date) {
        if (daysBetween(bookRows[bi].date, externalRows[ei].date) <= dateWindow) {
          matched.push({
            book: bookRows[bi],
            external: externalRows[ei],
            matchType: 'amount+date',
            'סוג_התאמה': 'סכום+תאריך',
          });
          matchedBookIdx.add(bi);
          matchedExtIdx.add(ei);
          break;
        }
      }
    }
  }

  // --- Pass 2: exact amount only ---
  for (let bi = 0; bi < bookRows.length; bi++) {
    if (matchedBookIdx.has(bi)) continue;
    const bAmt = netAmount(bookRows[bi]);

    for (let ei = 0; ei < externalRows.length; ei++) {
      if (matchedExtIdx.has(ei)) continue;
      const eAmt = netAmount(externalRows[ei]);

      if (bAmt === eAmt) {
        matched.push({
          book: bookRows[bi],
          external: externalRows[ei],
          matchType: 'amount',
          'סוג_התאמה': 'סכום',
        });
        matchedBookIdx.add(bi);
        matchedExtIdx.add(ei);
        break;
      }
    }
  }

  const unmatchedBook = bookRows.filter((_, i) => !matchedBookIdx.has(i));
  const unmatchedExternal = externalRows.filter((_, i) => !matchedExtIdx.has(i));

  return { matched, unmatchedBook, unmatchedExternal };
}

// ---------------------------------------------------------------------------
// 2. calculateReconciliation
// ---------------------------------------------------------------------------

/**
 * Calculate a reconciliation summary given book rows, external rows, and matches.
 *
 * @param {Array<{ debit?: number, credit?: number }>} bookRows
 * @param {Array<{ debit?: number, credit?: number }>} externalRows
 * @param {Array<{ book: object, external: object }>} matches
 * @returns {{
 *   bookTotal: number,
 *   externalTotal: number,
 *   difference: number,
 *   matchedCount: number,
 *   unmatchedBookCount: number,
 *   unmatchedExternalCount: number,
 *   'סה"כ_ספרים': number,
 *   'סה"כ_חיצוני': number,
 *   הפרש: number,
 *   summary: string
 * }}
 */
function calculateReconciliation(bookRows, externalRows, matches) {
  const bookTotal = round2(bookRows.reduce((s, r) => s + netAmount(r), 0));
  const externalTotal = round2(externalRows.reduce((s, r) => s + netAmount(r), 0));
  const difference = round2(bookTotal - externalTotal);

  const matchedCount = matches.length;
  const unmatchedBookCount = bookRows.length - matchedCount;
  const unmatchedExternalCount = externalRows.length - matchedCount;

  const summary =
    `התאמת חשבונות: סה"כ ספרים ${bookTotal}, סה"כ חיצוני ${externalTotal}, ` +
    `הפרש ${difference}. ` +
    `${matchedCount} שורות הותאמו, ` +
    `${unmatchedBookCount} לא הותאמו בספרים, ` +
    `${unmatchedExternalCount} לא הותאמו בחיצוני.`;

  return {
    bookTotal,
    externalTotal,
    difference,
    matchedCount,
    unmatchedBookCount,
    unmatchedExternalCount,
    'סה"כ_ספרים': bookTotal,
    'סה"כ_חיצוני': externalTotal,
    'הפרש': difference,
    summary,
  };
}

// ---------------------------------------------------------------------------
// 3. computeDepreciation
// ---------------------------------------------------------------------------

/**
 * Compute depreciation for a list of fixed assets using straight-line method.
 *
 * The first year is pro-rated based on the number of remaining months
 * (inclusive of the purchase month).
 *
 * @param {Array<{
 *   name: string,
 *   originalCost: number,
 *   purchaseDate: Date|string,
 *   rate: number,
 *   method?: 'straight_line'
 * }>} assets
 * @param {Date|string} [referenceDate=new Date()] - date to compute accumulated depreciation up to
 * @returns {Array<{
 *   name: string,
 *   'שם_נכס': string,
 *   originalCost: number,
 *   annualDepreciation: number,
 *   accumulatedDepreciation: number,
 *   netBookValue: number,
 *   'פחת_שנתי': number,
 *   'פחת_מצטבר': number,
 *   'עלות_מופחתת': number
 * }>}
 */
function computeDepreciation(assets, referenceDate) {
  const refDate = referenceDate ? toDate(referenceDate) : new Date();

  return assets.map((asset) => {
    const { name, originalCost, purchaseDate, rate } = asset;
    // method defaults to straight_line; currently the only supported method
    const annualDep = round2(originalCost * (rate / 100));

    const purchase = toDate(purchaseDate);
    const purchaseYear = purchase.getFullYear();
    const purchaseMonth = purchase.getMonth(); // 0-based

    const refYear = refDate.getFullYear();
    const refMonth = refDate.getMonth();

    let accumulated = 0;

    if (refDate < purchase) {
      // Reference date is before purchase — no depreciation
      accumulated = 0;
    } else if (refYear === purchaseYear) {
      // Same year: pro-rate remaining months (inclusive of purchase month)
      const monthsInYear = 12 - purchaseMonth;
      accumulated = round2(annualDep * (monthsInYear / 12));
    } else {
      // First (partial) year
      const firstYearMonths = 12 - purchaseMonth;
      accumulated = annualDep * (firstYearMonths / 12);

      // Full intermediate years
      const fullYears = refYear - purchaseYear - 1;
      if (fullYears > 0) {
        accumulated += annualDep * fullYears;
      }

      // Current (possibly partial) year — depreciate up to and including refMonth
      const currentYearMonths = refMonth + 1;
      accumulated += annualDep * (currentYearMonths / 12);
    }

    // Accumulated depreciation cannot exceed original cost
    accumulated = round2(Math.min(accumulated, originalCost));
    const nbv = round2(originalCost - accumulated);

    return {
      name,
      'שם_נכס': name,
      originalCost,
      annualDepreciation: annualDep,
      accumulatedDepreciation: accumulated,
      netBookValue: nbv,
      'פחת_שנתי': annualDep,
      'פחת_מצטבר': accumulated,
      'עלות_מופחתת': nbv,
    };
  });
}

// ---------------------------------------------------------------------------
// 4. computeEmployeeProvisions
// ---------------------------------------------------------------------------

/**
 * Compute employee provisions (vacation, recreation, severance) for each employee.
 *
 * Vacation: 12 days/year accrued pro-rata minus days used, valued at daily salary.
 * Recreation: days per seniority table * 418 NIS daily rate, minus days used * rate.
 * Severance: monthly salary * full years of service.
 *
 * @param {Array<{
 *   name: string,
 *   startDate: Date|string,
 *   monthlySalary: number,
 *   vacationDaysUsed?: number,
 *   recreationDaysUsed?: number
 * }>} employees
 * @param {Date|string} [referenceDate=new Date()]
 * @returns {Array<{
 *   name: string,
 *   'שם_עובד': string,
 *   vacationDays: number,
 *   vacationAmount: number,
 *   recreationAmount: number,
 *   severanceAmount: number,
 *   total: number,
 *   'ימי_חופשה': number,
 *   'הפרשת_חופשה': number,
 *   'הפרשת_הבראה': number,
 *   'הפרשת_פיצויים': number,
 *   'סה"כ': number
 * }>}
 */
function computeEmployeeProvisions(employees, referenceDate) {
  const refDate = referenceDate ? toDate(referenceDate) : new Date();

  return employees.map((emp) => {
    const start = toDate(emp.startDate);
    const vacUsed = emp.vacationDaysUsed || 0;
    const recUsed = emp.recreationDaysUsed || 0;

    // Years of service (fractional)
    const msService = refDate - start;
    const yearsService = msService / (365.25 * 86400000);
    const fullYears = Math.floor(yearsService);

    // Daily salary (assuming 22 working days per month)
    const dailySalary = round2(emp.monthlySalary / 22);

    // --- Vacation ---
    const vacationAccrued = round2(12 * yearsService);
    const vacationDays = round2(Math.max(vacationAccrued - vacUsed, 0));
    const vacationAmount = round2(vacationDays * dailySalary);

    // --- Recreation ---
    const entitledRecDays = recreationDaysForSeniority(fullYears);
    const netRecDays = Math.max(entitledRecDays - recUsed, 0);
    const recreationAmount = round2(netRecDays * RECREATION_DAILY_RATE);

    // --- Severance ---
    const severanceAmount = round2(emp.monthlySalary * fullYears);

    const total = round2(vacationAmount + recreationAmount + severanceAmount);

    return {
      name: emp.name,
      'שם_עובד': emp.name,
      vacationDays,
      vacationAmount,
      recreationAmount,
      severanceAmount,
      total,
      'ימי_חופשה': vacationDays,
      'הפרשת_חופשה': vacationAmount,
      'הפרשת_הבראה': recreationAmount,
      'הפרשת_פיצויים': severanceAmount,
      'סה"כ': total,
    };
  });
}

// ---------------------------------------------------------------------------
// 5. suggestAdjustments
// ---------------------------------------------------------------------------

/**
 * Suggest adjusting journal entries based on unmatched reconciliation items.
 *
 * For each unmatched book item a reversing entry is suggested.
 * For each unmatched external item an accrual entry is suggested.
 *
 * @param {{
 *   unmatchedBook?: Array<{ description?: string, debit?: number, credit?: number }>,
 *   unmatchedExternal?: Array<{ description?: string, debit?: number, credit?: number }>
 * }} reconciliation - typically the result of autoMatch
 * @returns {Array<{
 *   debit_account: string,
 *   credit_account: string,
 *   amount: number,
 *   description: string,
 *   'חשבון_חובה': string,
 *   'חשבון_זכות': string,
 *   'סכום': number,
 *   'תיאור': string
 * }>}
 */
function suggestAdjustments(reconciliation) {
  const adjustments = [];

  const unmatchedBook = reconciliation.unmatchedBook || [];
  const unmatchedExternal = reconciliation.unmatchedExternal || [];

  // Book items not found externally — suggest reversing / reclassification
  for (const row of unmatchedBook) {
    const amt = Math.abs(netAmount(row));
    if (amt === 0) continue;

    const desc = row.description || 'פריט ספרים ללא התאמה';
    const isDebit = netAmount(row) > 0;

    adjustments.push({
      debit_account: isDebit ? 'התאמות בנק' : 'הוצאות/נכסים',
      credit_account: isDebit ? 'הוצאות/נכסים' : 'התאמות בנק',
      amount: amt,
      description: `התאמה - ${desc}`,
      'חשבון_חובה': isDebit ? 'התאמות בנק' : 'הוצאות/נכסים',
      'חשבון_זכות': isDebit ? 'הוצאות/נכסים' : 'התאמות בנק',
      'סכום': amt,
      'תיאור': `התאמה - ${desc}`,
    });
  }

  // External items not found in books — suggest accrual entries
  for (const row of unmatchedExternal) {
    const amt = Math.abs(netAmount(row));
    if (amt === 0) continue;

    const desc = row.description || 'פריט חיצוני ללא התאמה';
    const isDebit = netAmount(row) > 0;

    adjustments.push({
      debit_account: isDebit ? 'בנק' : 'הוצאות לשלם',
      credit_account: isDebit ? 'הכנסות לקבל' : 'בנק',
      amount: amt,
      description: `צבירה - ${desc}`,
      'חשבון_חובה': isDebit ? 'בנק' : 'הוצאות לשלם',
      'חשבון_זכות': isDebit ? 'הכנסות לקבל' : 'בנק',
      'סכום': amt,
      'תיאור': `צבירה - ${desc}`,
    });
  }

  return adjustments;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  autoMatch,
  calculateReconciliation,
  computeDepreciation,
  computeEmployeeProvisions,
  suggestAdjustments,
};
