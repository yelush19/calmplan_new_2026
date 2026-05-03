// ============================================================
// Effective task status
// ------------------------------------------------------------
// Some tasks were authored before the awaiting_recording status (and
// the authority cascade) existed, so their persisted task.status field
// is stale (e.g. still "not_started" even though report+submission+payment
// were all toggled). HOME, the AyoaMiniMap, and any consumer that reads
// status for filtering or visual cues should consult this helper so the
// UI reflects what the cascade WOULD say if it ran right now.
//
// Persistence is handled separately by the dashboards' syncCompletedTaskSteps:
// when a stale task is loaded into a dashboard, the cascade-derived status
// is written back to the DB so the next read is already correct.
// ============================================================

import { evaluateAuthorityStatus } from '@/engines/taskCascadeEngine';
import { getTaskProcessSteps, migrateStatus } from '@/config/processTemplates';

/**
 * Returns the status this task SHOULD have, based on its current
 * process_steps. Falls back to the persisted (and migrated) status when
 * the cascade has nothing to say (e.g. non-authority tasks).
 *
 * Optional `client`: if the client's authorities_payment_method is
 * 'client_pays' (the client wires the authority directly), then a task
 * sitting in 'reported_pending_payment' is effectively done from our
 * side — payment is the client's responsibility, not ours. We surface
 * it as production_completed so it drops off the "my tasks" surfaces
 * (Home payment tab, AyoaMiniMap circles), while the underlying record
 * keeps its real status for search/audit.
 *
 * @param {Object} task
 * @param {Object} [client] - the task's owning client, optional
 * @returns {string} one of the canonical golden statuses
 */
export function getEffectiveStatus(task, client = null) {
  if (!task) return 'not_started';
  const steps = getTaskProcessSteps(task);
  const result = evaluateAuthorityStatus(task, steps);
  const baseStatus = result?.status || migrateStatus(task.status) || 'not_started';

  // Client-pays carve-out: payment is on the client, our work is done.
  if (
    client?.authorities_payment_method === 'client_pays' &&
    (baseStatus === 'reported_pending_payment' || task.status === 'reported_waiting_for_payment')
  ) {
    return 'production_completed';
  }
  return baseStatus;
}

/**
 * True when a task's real status is "waiting for payment" but the client
 * is responsible for the payment — i.e. we've handed off and it's no
 * longer on our plate. Useful for filtering the home payment tab
 * without losing the task from search/reports.
 */
export function isClientResponsiblePayment(task, client) {
  if (!task || !client) return false;
  if (client.authorities_payment_method !== 'client_pays') return false;
  return task.status === 'reported_pending_payment' || task.status === 'reported_waiting_for_payment';
}
