/**
 * ── AyoaViewToggle: Shared 4-view mode selector ──
 * Drop into any dashboard to get Map / Radial / Gantt / Feed views.
 */

import React from 'react';
import { Network, Target, BarChart3, List } from 'lucide-react';

export const VIEW_MODES = {
  map:    { label: 'מפה',     icon: Network,  key: 'map' },
  radial: { label: 'רדיאלי', icon: Target,   key: 'radial' },
  gantt:  { label: 'גאנט',   icon: BarChart3, key: 'gantt' },
  feed:   { label: 'רשימה',  icon: List,     key: 'feed' },
};

export default function AyoaViewToggle({ value, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-1 bg-gray-50 rounded-xl p-0.5 ${className}`}>
      {Object.values(VIEW_MODES).map(({ label, icon: Icon, key }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
            value === key
              ? 'bg-white shadow-sm text-[#4682B4] font-bold'
              : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
