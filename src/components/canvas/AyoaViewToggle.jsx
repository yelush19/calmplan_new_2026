/**
 * ── AyoaViewToggle: The 4 Lenses (Directive #5) ──
 * Permanent top-bar switcher: Map | Radial | Gantt | Feed
 * DNA-colored active indicator. Organic pill design.
 * No legacy view-toggle buttons (Directive #8).
 */

import React from 'react';
import { Network, Target, BarChart3, List, Flame, Layers } from 'lucide-react';

export const VIEW_MODES = {
  focus:    { label: 'פוקוס',   icon: Flame,    key: 'focus' },
  map:      { label: 'מפה',     icon: Network,  key: 'map' },
  radial:   { label: 'רדיאלי', icon: Target,   key: 'radial' },
  workflow: { label: 'שכבות',  icon: Layers,   key: 'workflow' },
  gantt:    { label: 'גאנט',   icon: BarChart3, key: 'gantt' },
  feed:     { label: 'רשימה',  icon: List,     key: 'feed' },
};

// DNA accent per view mode
const VIEW_ACCENTS = {
  focus:    '#FF9800',
  map:      '#0891B2',
  radial:   '#00A3E0',
  workflow: '#8B5CF6',
  gantt:    '#B2AC88',
  feed:     '#FFC107',
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isActive ? 'shadow-sm font-bold' : 'hover:bg-white/60'
            }`}
            style={isActive ? {
              background: 'white',
              color: accent,
              boxShadow: `0 2px 8px ${accent}20, 0 1px 3px rgba(0,0,0,0.06)`,
            } : {
              color: '#1E293B',
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
