/**
 * ── AyoaViewToggle: Unified 4-view mode selector ──
 * Drop into any dashboard to get Map / Radial / Gantt / Feed views.
 * DNA-colored active indicator, organic pill design.
 */

import React from 'react';
import { Network, Target, BarChart3, List } from 'lucide-react';

export const VIEW_MODES = {
  map:    { label: 'מפה',     icon: Network,  key: 'map' },
  radial: { label: 'רדיאלי', icon: Target,   key: 'radial' },
  gantt:  { label: 'גאנט',   icon: BarChart3, key: 'gantt' },
  feed:   { label: 'רשימה',  icon: List,     key: 'feed' },
};

// DNA accent per view mode
const VIEW_ACCENTS = {
  map:    '#E91E63', // Magenta
  radial: '#00A3E0', // Sky Blue
  gantt:  '#B2AC88', // Sage Green
  feed:   '#FFC107', // Sunset Yellow
};

export default function AyoaViewToggle({ value, onChange, className = '', accentColor }) {
  return (
    <div className={`flex items-center gap-1 rounded-2xl p-1 ${className}`}
      style={{ background: 'linear-gradient(135deg, #F8F9FA, #F0F2F5)' }}>
      {Object.values(VIEW_MODES).map(({ label, icon: Icon, key }) => {
        const isActive = value === key;
        const accent = accentColor || VIEW_ACCENTS[key] || '#4682B4';
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
              isActive ? 'shadow-sm font-bold' : 'hover:bg-white/60'
            }`}
            style={isActive ? {
              background: 'white',
              color: accent,
              boxShadow: `0 2px 8px ${accent}20, 0 1px 3px rgba(0,0,0,0.06)`,
            } : {
              color: '#9E9E9E',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
