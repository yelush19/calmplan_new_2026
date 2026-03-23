import React from 'react';
import { LayoutGrid, GanttChart, List, Circle } from 'lucide-react';

const VIEW_OPTIONS = [
  { key: 'table', label: 'טבלה', icon: List },
  { key: 'kanban', label: 'קנבן', icon: LayoutGrid },
  { key: 'timeline', label: 'גאנט', icon: GanttChart },
  { key: 'radial', label: 'טבעות', icon: Circle },
];

export default function DashboardViewToggle({ value, onChange, options }) {
  const items = options
    ? VIEW_OPTIONS.filter(o => options.includes(o.key))
    : VIEW_OPTIONS;

  return (
    <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-200 text-xs gap-0.5">
      {items.map(opt => {
        const Icon = opt.icon;
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              isActive
                ? 'bg-[#1E3A5F] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
