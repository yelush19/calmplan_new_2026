// ============================================================
// Reserve Duty Reporting (דיווח מילואים לביטוח לאומי)
// ------------------------------------------------------------
// Reserve duty reports are *not* recurring. They are created
// only when the user explicitly marks "had reserve this month"
// on a given client's payroll production task.
//
// Deadline rule: 3 working days after the social-security (15th)
// report deadline of the month following the reporting month.
// E.g., reporting_month = "2026-02" → deadline = 15 Mar 2026
// + 3 work days (skipping Fri/Sat/holidays). Manually editable.
// ============================================================

import { Task } from '@/api/entities';
import { PAYROLL_SERVICES } from '@/config/processTemplates';
import { getWorkDaysAfter, adjustForRestDayWithHolidays } from '@/config/israeliHolidays';

const RESERVE_CATEGORY = 'מילואים';
const RESERVE_SERVICE_KEY = 'reserve_report';

const HEB_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

/**
 * Compute the reserve-duty report deadline.
 *
 * @param {string} reportingMonth - "YYYY-MM" of the payroll period
 * @returns {string} ISO date "YYYY-MM-DD"
 */
export function computeReserveReportDeadline(reportingMonth) {
  if (!reportingMonth || !/^\d{4}-\d{2}$/.test(reportingMonth)) {
    // Fallback: today + 20 days
    const d = new Date();
    d.setDate(d.getDate() + 20);
    return d.toISOString().slice(0, 10);
  }
  const [y, m] = reportingMonth.split('-').map(Number);
  // Social-security SLA day = 15 of the next month. Adjust if 15 falls on
  // a non-work day (so the anchor itself lands on a work day).
  const deadlineMonth = m === 12 ? 1 : m + 1;
  const deadlineYear = m === 12 ? y + 1 : y;
  const anchorDay = adjustForRestDayWithHolidays(deadlineYear, deadlineMonth, 15);
  const pad = (n) => String(n).padStart(2, '0');
  const anchorIso = `${deadlineYear}-${pad(deadlineMonth)}-${pad(anchorDay)}`;
  return getWorkDaysAfter(anchorIso, 3);
}

/**
 * Build the initial process_steps object for a reserve-duty task,
 * mirroring the pattern used by other payroll services (key → { done, date }).
 */
function buildInitialSteps() {
  const service = PAYROLL_SERVICES[RESERVE_SERVICE_KEY];
  const steps = {};
  if (service?.steps) {
    service.steps.forEach((s) => {
      steps[s.key] = { done: false };
    });
  }
  return steps;
}

/**
 * Find an existing reserve-duty task for a client+reporting_month.
 */
export function findReserveTask(tasks, clientName, reportingMonth) {
  if (!tasks || !clientName || !reportingMonth) return null;
  return tasks.find(
    (t) =>
      t.category === RESERVE_CATEGORY &&
      t.client_name === clientName &&
      t.reporting_month === reportingMonth
  ) || null;
}

/**
 * Create a reserve-duty task for a given client + reporting_month.
 * Idempotent: returns the existing task if one already exists.
 *
 * The task starts in `waiting_for_materials` so it is gated behind
 * payroll production completing (standard AND-gate). Once the parent
 * payroll task is `production_completed`, downstream automations flip
 * it to `not_started` — same pattern as ביטוח לאומי / ניכויים.
 */
export async function createReserveTask({ client, reportingMonth, tasks = [] }) {
  if (!client || !reportingMonth) {
    throw new Error('createReserveTask requires client and reportingMonth');
  }
  const existing = findReserveTask(tasks, client.name, reportingMonth);
  if (existing) return existing;

  const [y, m] = reportingMonth.split('-').map(Number);
  const monthName = HEB_MONTHS[m - 1];
  const dueDate = computeReserveReportDeadline(reportingMonth);

  const payload = {
    title: `דיווח מילואים לב"ל - ${client.name} - ${monthName} ${y}`,
    category: RESERVE_CATEGORY,
    branch: 'P1',
    status: 'waiting_for_materials',
    priority: 'Medium',

    client_id: client.id || client.entity_number || null,
    client_name: client.name,
    service_group: RESERVE_SERVICE_KEY,
    service_key: RESERVE_SERVICE_KEY,
    parent_service: 'payroll',

    date: dueDate,
    due_date: dueDate,
    reporting_month: reportingMonth,
    report_period: reportingMonth,
    report_month: m,
    report_year: y,

    process_steps: buildInitialSteps(),
    depends_on: ['P1_payroll'],

    context: 'work',
    source: 'reserve_duty_toggle',
    created_at: new Date().toISOString(),
  };

  return await Task.create(payload);
}

/**
 * Remove a reserve-duty task — ONLY if it is still unstarted.
 * Returns { removed: bool, reason?: string }.
 */
export async function removeReserveTaskIfUnstarted({ clientName, reportingMonth, tasks }) {
  const existing = findReserveTask(tasks, clientName, reportingMonth);
  if (!existing) return { removed: false, reason: 'not_found' };

  const started =
    (existing.status && existing.status !== 'waiting_for_materials' && existing.status !== 'not_started') ||
    Object.values(existing.process_steps || {}).some((s) => s?.done);
  if (started) {
    return { removed: false, reason: 'already_started', task: existing };
  }

  await Task.delete(existing.id);
  return { removed: true, task: existing };
}
