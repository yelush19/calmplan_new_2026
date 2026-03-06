import React, { useState, useMemo } from 'react';
import { getServiceWeight } from '@/config/serviceWeights';

/**
 * CognitiveCapacityHeader — "מד דופק" קיבולת יומית
 *
 * Replaces the static Kanban 3-column header with a dynamic cognitive load graph.
 * Shows stacked bars by complexity tier, and clicking a bar filters the task list.
 *
 * Colors (Zero Gray Policy):
 *   - בורדו (#7B1FA2) = מורכב (cognitiveLoad 3)
 *   - טורקיז (#00838F) = בינוני (cognitiveLoad 2)
 *   - תכלת (#0288D1) = פשוט (cognitiveLoad 1)
 *   - ירוק (#2E7D32) = ננו (cognitiveLoad 0)
 */

const TIER_CONFIG = {
  3: { label: 'מורכב', color: '#7B1FA2', bg: 'bg-purple-100', text: 'text-purple-800', icon: '🧗' },
  2: { label: 'בינוני', color: '#00838F', bg: 'bg-teal-100', text: 'text-teal-800', icon: '📦' },
  1: { label: 'פשוט', color: '#0288D1', bg: 'bg-sky-100', text: 'text-sky-800', icon: '🟢' },
  0: { label: 'ננו', color: '#2E7D32', bg: 'bg-emerald-100', text: 'text-emerald-800', icon: '⚡' },
};

export default function CognitiveCapacityHeader({ tasks = [], onFilterTier }) {
  const [activeTier, setActiveTier] = useState(null);

  const tierData = useMemo(() => {
    const buckets = { 0: [], 1: [], 2: [], 3: [] };

    tasks.forEach(task => {
      if (task.status === 'production_completed') return; // skip completed
      const weight = getServiceWeight(task.category);
      const tier = weight.cognitiveLoad ?? 0;
      const clampedTier = Math.min(3, Math.max(0, tier));
      buckets[clampedTier].push(task);
    });

    const maxCount = Math.max(1, ...Object.values(buckets).map(b => b.length));

    return Object.entries(buckets).map(([tier, tierTasks]) => ({
      tier: parseInt(tier),
      tasks: tierTasks,
      count: tierTasks.length,
      totalMinutes: tierTasks.reduce((sum, t) => {
        const w = getServiceWeight(t.category);
        return sum + (t.estimated_duration || w.duration || 15);
      }, 0),
      pct: Math.round((tierTasks.length / maxCount) * 100),
    })).sort((a, b) => b.tier - a.tier); // מורכב first
  }, [tasks]);

  const totalOpen = tierData.reduce((s, t) => s + t.count, 0);
  const totalMinutes = tierData.reduce((s, t) => s + t.totalMinutes, 0);

  const handleBarClick = (tier) => {
    const newTier = activeTier === tier ? null : tier;
    setActiveTier(newTier);
    onFilterTier?.(newTier);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700">קיבולת יומית</span>
          <span className="text-xs text-slate-400">({totalOpen} פתוחות · {Math.round(totalMinutes / 60)}:{String(totalMinutes % 60).padStart(2, '0')} שעות)</span>
        </div>
        {activeTier !== null && (
          <button
            onClick={() => { setActiveTier(null); onFilterTier?.(null); }}
            className="text-xs text-sky-600 hover:text-sky-800 font-medium"
          >
            הצג הכל ✕
          </button>
        )}
      </div>

      {/* Bar graph */}
      <div className="flex items-end gap-3 h-20">
        {tierData.map(({ tier, count, totalMinutes: mins, pct }) => {
          const cfg = TIER_CONFIG[tier];
          const isActive = activeTier === tier;
          const isDimmed = activeTier !== null && !isActive;
          const barHeight = Math.max(8, pct * 0.7); // scale to 70px max

          return (
            <button
              key={tier}
              onClick={() => handleBarClick(tier)}
              className={`flex-1 flex flex-col items-center gap-1 transition-all duration-200 rounded-lg p-1
                ${isActive ? 'ring-2 ring-offset-1' : ''}
                ${isDimmed ? 'opacity-30' : 'opacity-100'}
                hover:opacity-100`}
              style={{
                ...(isActive ? { ringColor: cfg.color } : {}),
              }}
              title={`${cfg.label}: ${count} משימות, ${mins} דק'`}
            >
              {/* Count label above bar */}
              <span className="text-xs font-bold" style={{ color: cfg.color }}>
                {count > 0 ? count : ''}
              </span>

              {/* The bar */}
              <div
                className="w-full rounded-t-md transition-all duration-300"
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: count > 0 ? cfg.color : '#E0E0E0',
                  minWidth: '40px',
                }}
              />

              {/* Label below bar */}
              <div className="flex items-center gap-0.5">
                <span className="text-[10px]">{cfg.icon}</span>
                <span className="text-[10px] font-medium text-slate-600">{cfg.label}</span>
              </div>

              {/* Minutes */}
              {count > 0 && (
                <span className="text-[9px] text-slate-400">{mins} דק'</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active filter indicator */}
      {activeTier !== null && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: TIER_CONFIG[activeTier].color }}
          >
            {TIER_CONFIG[activeTier].icon} מציג רק: {TIER_CONFIG[activeTier].label}
          </span>
          <span className="text-xs text-slate-400">
            ({tierData.find(t => t.tier === activeTier)?.count || 0} משימות)
          </span>
        </div>
      )}
    </div>
  );
}
