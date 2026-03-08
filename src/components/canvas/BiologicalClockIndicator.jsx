/**
 * ── Biological Clock Indicator ──
 *
 * Shows the current biological time zone and progress.
 * Allows manual override and dynamic visibility toggle.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useBiologicalClock } from '@/contexts/BiologicalClockContext';

export default function BiologicalClockIndicator() {
  const {
    currentZone,
    dynamicVisibility,
    toggleDynamicVisibility,
    forceZone,
    manualOverride,
    getZoneProgress,
    TIME_ZONES,
    TIME_ZONE_ORDER,
  } = useBiologicalClock();

  const [expanded, setExpanded] = useState(false);
  const progress = getZoneProgress();

  return (
    <div className="relative" dir="rtl">
      {/* Compact Indicator */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all hover:shadow-md"
        style={{
          borderColor: currentZone.color,
          backgroundColor: `${currentZone.color}15`,
          color: currentZone.color,
        }}
      >
        <span className="text-base">{currentZone.icon}</span>
        <span>{currentZone.label}</span>
        <span className="text-[10px] opacity-70">{currentZone.start}-{currentZone.end}</span>
        {/* Progress bar */}
        <div className="w-12 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${progress * 100}%`, backgroundColor: currentZone.color }}
          />
        </div>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border-2 border-gray-200 z-50 overflow-hidden"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-l from-blue-50 to-purple-50 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">שעון ביולוגי</span>
                <button
                  onClick={toggleDynamicVisibility}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                    dynamicVisibility
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {dynamicVisibility ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {dynamicVisibility ? 'סינון פעיל' : 'הכל גלוי'}
                </button>
              </div>
            </div>

            {/* Time Zones */}
            <div className="p-3 space-y-1.5">
              {TIME_ZONE_ORDER.map(zoneKey => {
                const zone = TIME_ZONES[zoneKey];
                const isActive = currentZone.key === zoneKey;
                const isOverride = manualOverride === zoneKey;

                return (
                  <button
                    key={zoneKey}
                    onClick={() => forceZone(isOverride ? null : zoneKey)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                      isActive
                        ? 'bg-blue-50 border-2 font-bold'
                        : 'hover:bg-gray-50 border-2 border-transparent'
                    }`}
                    style={isActive ? { borderColor: zone.color } : {}}
                  >
                    <span className="text-lg w-6">{zone.icon}</span>
                    <div className="flex-1 text-right">
                      <div className="flex items-center gap-1">
                        <span style={{ color: isActive ? zone.color : '#374151' }}>{zone.label}</span>
                        {isOverride && (
                          <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded">ידני</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">{zone.start} — {zone.end}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {zone.activeBranches.map(b => (
                        <span
                          key={b}
                          className="text-[8px] px-1 py-0.5 rounded bg-gray-100 text-gray-600"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            {manualOverride && (
              <div className="px-4 py-2 border-t bg-amber-50">
                <button
                  onClick={() => forceZone(null)}
                  className="text-xs text-amber-700 hover:text-amber-900 font-medium"
                >
                  חזור למצב אוטומטי
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
