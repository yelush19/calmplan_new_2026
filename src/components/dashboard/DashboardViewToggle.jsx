import React from 'react';
import { LayoutGrid, GanttChart, List, Circle, Table2, Map, Crosshair, Workflow } from 'lucide-react';

const VIEW_OPTIONS = [
  { key: 'table', label: 'טבלה', icon: List },
  { key: 'workbook', label: 'גיליון', icon: Table2 },
  { key: 'miro', label: 'מפה', icon: Map },
  { key: 'kanban', label: 'קנבן', icon: LayoutGrid },
  { key: 'timeline', label: 'גאנט', icon: GanttChart },
  { key: 'radial', label: 'טבעות', icon: Circle },
  { key: 'focus', label: 'מיקוד', icon: Crosshair },
  { key: 'workflow', label: 'זרימה', icon: Workflow },
];

export default function DashboardViewToggle({ value, onChange, options }) {
  const items = options
    ? VIEW_OPTIONS.filter(o => options.includes(o.key))
    : VIEW_OPTIONS;

  return (
    <div className="flex bg-[#1E3A5F] rounded-xl p-1 shadow-lg text-xs gap-0.5 backdrop-blur-sm">
      {items.map(opt => {
        const Icon = opt.icon;
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              isActive
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
