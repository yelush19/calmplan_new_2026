/**
 * ── CAPACITY ENGINE ──
 * Calculates KPI metrics from the DNA (serviceWeights.js).
 *
 * ALL durations come from getServiceWeight(). Zero hardcoded defaults.
 * Fallback: 15 minutes (as defined in DNA).
 *
 * Exports:
 *   - calculateCapacity(tasks) → { totalMinutes, cognitiveLoadMix, efficiencyScore, loadByPriority }
 *   - LOAD_COLORS — functional color mapping per cognitive load tier
 */

import { getServiceWeight } from '@/config/serviceWeights';

// ─── Functional Load Colors (Iron Rule) ──────────────────────────────────
export const LOAD_COLORS = {
  3: { color: '#800000', label: 'מורכב',  bg: 'bg-[#800000]', border: 'border-l-4 border-l-[#800000]', textClass: 'text-[#800000]' },
  2: { color: '#4682B4', label: 'בינוני', bg: 'bg-[#4682B4]', border: 'border-l-4 border-l-[#4682B4]', textClass: 'text-[#4682B4]' },
  1: { color: '#ADD8E6', label: 'פשוט',  bg: 'bg-[#ADD8E6]', border: 'border-l-4 border-l-[#ADD8E6]', textClass: 'text-[#5B99A8]' },
  0: { color: '#8FBC8F', label: 'ננו',   bg: 'bg-[#8FBC8F]', border: 'border-l-4 border-l-[#8FBC8F]', textClass: 'text-[#5A8A5A]' },
};

/**
 * Get the duration for a task — DNA only, no hardcoded fallbacks.
 * Priority: task.estimated_time → serviceWeight(category).duration → 15 (DNA default)
 */
function getTaskDuration(task) {
  if (task.estimated_time && task.estimated_time > 0) return task.estimated_time;
  const sw = getServiceWeight(task.category);
  return sw.duration;
}

/**
 * Get the cognitive load tier for a task from DNA.
 */
function getTaskLoad(task) {
  if (typeof task.cognitive_load === 'number') return task.cognitive_load;
  const sw = getServiceWeight(task.category);
  return sw.cognitiveLoad;
}

/**
 * Determine P-priority from task category.
 */
function getTaskPriority(task) {
  const cat = (task.category || '').toLowerCase();
  if (cat.includes('payroll') || cat.includes('שכר') || cat.includes('masav') || cat.includes('מס"ב') || cat.includes('ביטוח') || cat.includes('ניכויים') || cat.includes('סוציאל') || cat.includes('תלושים')) return 'P1';
  if (cat.includes('vat') || cat.includes('מע"מ') || cat.includes('bookkeeping') || cat.includes('הנהלת') || cat.includes('התאמות') || cat.includes('reconcil') || cat.includes('מקדמות') || cat.includes('מאזן') || cat.includes('annual') || cat.includes('רווח')) return 'P2';
  return 'P3';
}

/**
 * Calculate capacity KPIs from an array of tasks.
 *
 * @param {Array} tasks - Task objects (from any source)
 * @param {number} [dailyCapacityMinutes=480] - Working day capacity (8h default)
 * @returns {object} KPI metrics
 */
export function calculateCapacity(tasks, dailyCapacityMinutes = 480) {
  if (!tasks || tasks.length === 0) {
    return {
      totalMinutes: 0,
      dailyCapacityMinutes,
      utilizationPercent: 0,
      cognitiveLoadMix: { 3: 0, 2: 0, 1: 0, 0: 0 },
      efficiencyScore: 0,
      loadByPriority: { P1: 0, P2: 0, P3: 0 },
      completedMinutes: 0,
      taskCount: tasks.length,
    };
  }

  let totalMinutes = 0;
  let completedMinutes = 0;
  const cognitiveLoadMix = { 3: 0, 2: 0, 1: 0, 0: 0 };
  const loadByPriority = { P1: 0, P2: 0, P3: 0 };

  for (const task of tasks) {
    const duration = getTaskDuration(task);
    const load = Math.min(3, Math.max(0, getTaskLoad(task)));
    const priority = getTaskPriority(task);

    totalMinutes += duration;
    cognitiveLoadMix[load] = (cognitiveLoadMix[load] || 0) + 1;
    loadByPriority[priority] = (loadByPriority[priority] || 0) + duration;

    if (task.status === 'production_completed' || task.status === 'done' || task.status === 'completed') {
      completedMinutes += duration;
    }
  }

  const utilizationPercent = dailyCapacityMinutes > 0
    ? Math.round((totalMinutes / dailyCapacityMinutes) * 100)
    : 0;

  const efficiencyScore = totalMinutes > 0
    ? Math.round((completedMinutes / totalMinutes) * 100)
    : 0;

  return {
    totalMinutes,
    dailyCapacityMinutes,
    utilizationPercent,
    cognitiveLoadMix,
    efficiencyScore,
    loadByPriority,
    completedMinutes,
    taskCount: tasks.length,
  };
}

/**
 * Get sorted task list for the Feed, ordered by cognitive load (highest first).
 * Each task gets its load color from LOAD_COLORS.
 */
export function getTaskFeed(tasks) {
  if (!tasks || tasks.length === 0) return [];

  return tasks
    .map(task => ({
      ...task,
      _duration: getTaskDuration(task),
      _load: Math.min(3, Math.max(0, getTaskLoad(task))),
      _priority: getTaskPriority(task),
    }))
    .sort((a, b) => b._load - a._load || b._duration - a._duration)
    .map(task => ({
      ...task,
      _loadColor: LOAD_COLORS[task._load],
    }));
}
