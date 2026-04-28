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
 * @param {Object} task
 * @returns {string} one of the canonical golden statuses
 */
export function getEffectiveStatus(task) {
  if (!task) return 'not_started';
  const steps = getTaskProcessSteps(task);
  const result = evaluateAuthorityStatus(task, steps);
  if (result?.status) return result.status;
  return migrateStatus(task.status) || 'not_started';
}
