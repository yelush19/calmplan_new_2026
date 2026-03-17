import React, { useState, useMemo } from 'react';
import { getServiceWeight } from '@/config/serviceWeights';

/**
 * CognitiveCapacityHeader — "מד דופק" קיבולת יומית
 *
 * Clean stacked horizontal bar design showing cognitive load tiers.
 * Clicking a bar filters the task list.
 *
 * Colors (Zero Gray Policy):
 *   - בורדו (#800000) = מורכב (cognitiveLoad 3)
 *   - כחול פלדה (#4682B4) = בינוני (cognitiveLoad 2)
 *   - תכלת (#ADD8E6) = פשוט (cognitiveLoad 1)
 *   - ירוק מרווה (#8FBC8F) = ננו (cognitiveLoad 0)
 */

const TIER_CONFIG = {
  3: { label: 'מורכב', color: '#800000', lightBg: '#80000012', icon: '🧗' },
  2: { label: 'בינוני', color: '#4682B4', lightBg: '#4682B412', icon: '📦' },
  1: { label: 'פשוט', color: '#ADD8E6', lightBg: '#ADD8E612', labelColor: '#5B99A8', icon: '🟢' },
  0: { label: 'ננו', color: '#8FBC8F', lightBg: '#8FBC8F12', labelColor: '#5A8A5A', icon: '⚡' },
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
        return sum + w.duration;
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

      {/* Stacked horizontal bars */}
      <div className="flex flex-col gap-1.5">
        {tierData.map(({ tier, count, totalMinutes: mins, pct }) => {
          const cfg = TIER_CONFIG[tier];
          const isActive = activeTier === tier;
          const isDimmed = activeTier !== null && !isActive;
          const textColor = cfg.labelColor || cfg.color;

          return (
            <button
              key={tier}
              onClick={() => handleBarClick(tier)}
              className={`group flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1 transition-all duration-200
                ${isActive ? 'ring-1.5 ring-offset-1' : ''}
                ${isDimmed ? 'opacity-35' : 'opacity-100'}
                hover:opacity-100`}
              style={{
                backgroundColor: isActive ? cfg.lightBg : 'transparent',
                ...(isActive ? { '--tw-ring-color': cfg.color } : {}),
              }}
              title={`${cfg.label}: ${count} משימות, ${mins} דק'`}
            >
              {/* Left: icon + label */}
              <div className="flex items-center gap-1.5 w-20 shrink-0" dir="rtl">
                <span className="text-xs leading-none">{cfg.icon}</span>
                <span className="text-xs font-semibold truncate" style={{ color: textColor }}>
                  {cfg.label}
                </span>
              </div>

              {/* Center: progress bar track */}
              <div
                className="flex-1 h-3 rounded-md overflow-hidden"
                style={{ backgroundColor: count > 0 ? `${cfg.color}15` : '#f1f5f9' }}
              >
                <div
                  className="h-full rounded-md transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(count > 0 ? 4 : 0, pct)}%`,
                    backgroundColor: count > 0 ? cfg.color : 'transparent',
                    boxShadow: count > 0 ? `0 1px 3px ${cfg.color}30` : 'none',
                  }}
                />
              </div>

              {/* Right: count + minutes */}
              <div className="flex items-center gap-1.5 w-24 shrink-0 justify-end" dir="rtl">
                <span
                  className="text-xs font-bold tabular-nums min-w-[1.25rem] text-center"
                  style={{ color: count > 0 ? textColor : '#cbd5e1' }}
                >
                  {count}
                </span>
                {count > 0 && (
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    · {mins} דק׳
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active filter indicator */}
      {activeTier !== null && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold text-white"
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
