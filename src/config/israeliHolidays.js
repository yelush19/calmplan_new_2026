/**
 * Israeli Holidays 2026 — Single Source of Truth
 * ================================================
 * All holiday data consolidated from 4 separate files.
 * Every component imports from here instead of maintaining its own copy.
 *
 * Data source: LifeSettings.jsx (most complete, verified dates)
 *
 * Future: replace with Hebcal API fetch + local cache fallback.
 */

// ── Complete holiday list for 2026 ──
// Fields: date (YYYY-MM-DD), name (Hebrew), type ('holiday'|'erev'|'chol_hamoed'|'fast')
// isWorkDay: false for holidays/erev, true for chol_hamoed (can work half-day)
const HOLIDAYS_2026 = [
  // פורים
  { date: "2026-03-03", name: "תענית אסתר", type: "erev", isWorkDay: false },
  { date: "2026-03-04", name: "פורים", type: "holiday", isWorkDay: false },
  { date: "2026-03-05", name: "שושן פורים", type: "holiday", isWorkDay: false },
  // פסח
  { date: "2026-04-01", name: "ערב פסח", type: "erev", isWorkDay: false },
  { date: "2026-04-02", name: "פסח א׳", type: "holiday", isWorkDay: false },
  { date: "2026-04-03", name: "חול המועד פסח א׳", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-04-04", name: "חול המועד פסח ב׳", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-04-05", name: "חול המועד פסח ג׳", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-04-06", name: "חול המועד פסח ד׳", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-04-07", name: "חול המועד פסח ה׳", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-04-08", name: "שביעי של פסח", type: "holiday", isWorkDay: false },
  // יום הזיכרון + יום העצמאות
  { date: "2026-04-21", name: "יום הזיכרון", type: "erev", isWorkDay: false },
  { date: "2026-04-22", name: "יום העצמאות", type: "holiday", isWorkDay: false },
  // ל״ג בעומר
  { date: "2026-05-05", name: "ל״ג בעומר", type: "holiday", isWorkDay: false },
  // שבועות
  { date: "2026-05-21", name: "ערב שבועות", type: "erev", isWorkDay: false },
  { date: "2026-05-22", name: "שבועות", type: "holiday", isWorkDay: false },
  // ט׳ באב
  { date: "2026-07-23", name: "ערב ט׳ באב", type: "erev", isWorkDay: false },
  { date: "2026-07-24", name: "ט׳ באב", type: "holiday", isWorkDay: false },
  // ראש השנה
  { date: "2026-09-11", name: "ערב ראש השנה", type: "erev", isWorkDay: false },
  { date: "2026-09-12", name: "ראש השנה א׳", type: "holiday", isWorkDay: false },
  { date: "2026-09-13", name: "ראש השנה ב׳", type: "holiday", isWorkDay: false },
  // צום גדליה
  { date: "2026-09-14", name: "צום גדליה", type: "erev", isWorkDay: false },
  // יום כיפור
  { date: "2026-09-20", name: "ערב יום כיפור", type: "erev", isWorkDay: false },
  { date: "2026-09-21", name: "יום כיפור", type: "holiday", isWorkDay: false },
  // סוכות
  { date: "2026-09-25", name: "ערב סוכות", type: "erev", isWorkDay: false },
  { date: "2026-09-26", name: "סוכות א׳", type: "holiday", isWorkDay: false },
  { date: "2026-09-27", name: "חול המועד סוכות א׳", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-09-28", name: "חול המועד סוכות ב׳", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-09-29", name: "חול המועד סוכות ג׳", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-09-30", name: "חול המועד סוכות ד׳", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-10-01", name: "הושענא רבה", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-10-02", name: "שמיני עצרת", type: "holiday", isWorkDay: false },
  { date: "2026-10-03", name: "שמחת תורה", type: "holiday", isWorkDay: false },
  // חנוכה
  { date: "2026-12-12", name: "חנוכה - נר ראשון", type: "holiday", isWorkDay: false },
  { date: "2026-12-13", name: "חנוכה - נר שני", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-12-14", name: "חנוכה - נר שלישי", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-12-15", name: "חנוכה - נר רביעי", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-12-16", name: "חנוכה - נר חמישי", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-12-17", name: "חנוכה - נר שישי", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-12-18", name: "חנוכה - נר שביעי", type: "chol_hamoed", isWorkDay: true },
  { date: "2026-12-19", name: "חנוכה - נר שמיני", type: "chol_hamoed", isWorkDay: true },
];

// ── Pre-computed lookup structures ──

// Object keyed by date string → { name, type } (for AdvanceWarningPanel, HolidayAnalyzer)
const HOLIDAYS_BY_DATE = {};
for (const h of HOLIDAYS_2026) {
  HOLIDAYS_BY_DATE[h.date] = { name: h.name, type: h.type, isWorkDay: h.isWorkDay };
}

// Set of ALL holiday date strings (for quick boolean checks)
const ALL_HOLIDAY_DATES = new Set(HOLIDAYS_2026.map(h => h.date));

// Set of NON-work-day date strings (holidays + erev, excludes chol hamoed)
const NON_WORK_HOLIDAY_DATES = new Set(
  HOLIDAYS_2026.filter(h => !h.isWorkDay).map(h => h.date)
);

// ── Public API ──

/** Check if a date string (YYYY-MM-DD) falls on any holiday */
export function isHoliday(dateStr) {
  return ALL_HOLIDAY_DATES.has(dateStr);
}

/** Check if a date string is a work day (not Fri/Sat/holiday) */
export function isWorkDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  if (dow === 5 || dow === 6) return false; // Friday/Saturday
  const holiday = HOLIDAYS_BY_DATE[dateStr];
  if (holiday && !holiday.isWorkDay) return false;
  return true;
}

/** Get the holiday name for a date string, or null */
export function getHolidayName(dateStr) {
  return HOLIDAYS_BY_DATE[dateStr]?.name || null;
}

/** Get full holiday info for a date string, or null */
export function getHolidayInfo(dateStr) {
  return HOLIDAYS_BY_DATE[dateStr] || null;
}

/** Get all non-work-day dates for the year as a Set of date strings */
export function getNonWorkDays() {
  return NON_WORK_HOLIDAY_DATES;
}

/**
 * Count N work days before a given date (skipping Fri/Sat/holidays).
 * Returns the date string of the Nth work day before the target.
 * @param {string} dateStr - Target date (YYYY-MM-DD)
 * @param {number} count - Number of work days to go back
 * @returns {string} Date string (YYYY-MM-DD)
 */
export function getWorkDaysBefore(dateStr, count) {
  let d = new Date(dateStr + 'T12:00:00');
  let remaining = count;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    const ds = d.toISOString().slice(0, 10);
    if (isWorkDay(ds)) {
      remaining--;
    }
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Adjust a deadline that falls on a non-work day to the next work day.
 * Skips Fri/Sat AND holidays.
 * @param {number} year
 * @param {number} month (1-12)
 * @param {number} day
 * @returns {number} Adjusted day of month
 */
export function adjustForRestDayWithHolidays(year, month, day) {
  const pad = (n) => String(n).padStart(2, '0');
  let d = new Date(year, month - 1, day);
  // Advance until we land on a work day
  for (let i = 0; i < 14; i++) { // safety limit
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const dow = d.getDay();
    if (dow !== 5 && dow !== 6 && (!HOLIDAYS_BY_DATE[dateStr] || HOLIDAYS_BY_DATE[dateStr].isWorkDay)) {
      return d.getDate();
    }
    d.setDate(d.getDate() + 1);
  }
  return day; // fallback
}

// ── Exports for backward compatibility ──

// Array format (for LifeSettings)
export const HOLIDAYS_LIST = HOLIDAYS_2026;

// Object lookup format (for AdvanceWarningPanel, HolidayAnalyzer)
export const HOLIDAYS_LOOKUP = HOLIDAYS_BY_DATE;

// Set format (for TimeAwareness)
export const HOLIDAY_DATES_SET = ALL_HOLIDAY_DATES;

export default HOLIDAYS_2026;
