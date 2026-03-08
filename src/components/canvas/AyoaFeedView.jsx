/**
 * ── AyoaFeedView: Data-agnostic list view ──
 * Uses resolveItem() to extract fields from ANY data shape.
 */

import React from 'react';
import { resolveItems } from './resolveItem';
import { CheckCircle } from 'lucide-react';

const DNA = { P1: '#00A3E0', P2: '#B2AC88', P3: '#E91E63', P4: '#FFC107' };
const PALETTE = [DNA.P1, DNA.P3, DNA.P2, DNA.P4, '#9C27B0', '#00BCD4', '#FF5722', '#4CAF50'];

function getCategoryColor(category, index) {
  if (!category) return PALETTE[index % PALETTE.length];
  const cat = (category || '').toLowerCase();
  if (cat.includes('שכר') || cat.includes('payroll')) return DNA.P1;
  if (cat.includes('מע"מ') || cat.includes('vat') || cat.includes('הנה"ח') || cat.includes('bookkeeping') || cat.includes('התאמות')) return DNA.P2;
  if (cat.includes('admin') || cat.includes('אדמיני') || cat.includes('שיווק')) return DNA.P3;
  return PALETTE[index % PALETTE.length];
}

export default function AyoaFeedView({ tasks = [], onEditTask }) {
  const resolved = resolveItems(tasks);

  if (resolved.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <CheckCircle className="w-8 h-8 mb-2" />
        <p className="text-sm font-medium">אין פריטים להצגה</p>
      </div>
    );
  }

  // Group by category
  const groups = {};
  resolved.forEach((item, i) => {
    const cat = item.category || 'כללי';
    if (!groups[cat]) groups[cat] = { items: [], colorIndex: Object.keys(groups).length };
    groups[cat].items.push({ ...item, originalIndex: i });
  });

  return (
    <div className="space-y-4 p-3">
      {Object.entries(groups).map(([cat, { items, colorIndex }]) => {
        const color = getCategoryColor(cat, colorIndex);
        return (
          <div key={cat}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm font-bold text-[#0F172A]">{cat}</span>
              <span className="text-xs font-semibold" style={{ color }}>{items.length} פריטים</span>
            </div>

            {/* Items */}
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onEditTask?.(item.raw)}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 hover:shadow-md cursor-pointer bg-white transition-all"
                  style={{ borderRight: `4px solid ${color}` }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color + '15' }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#0F172A] truncate">{item.label || '(ללא שם)'}</span>
                      {item.sub && (
                        <span className="text-xs font-medium truncate" style={{ color }}>• {item.sub}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.status && item.status !== 'not_started' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: color + '15', color }}>{item.status}</span>
                      )}
                      {item.date && (
                        <span className="text-[11px] font-medium text-slate-600">{item.date}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
