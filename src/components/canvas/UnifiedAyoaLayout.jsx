/**
 * ── UnifiedAyoaLayout: The One Wrapper ──
 *
 * FIXED: Removed AnimatePresence mode="wait" that was blocking children render.
 * FIXED: Feed view now ALWAYS renders children first, no conditions.
 * ADDED: Debug dump when items array is empty so you always see what arrived.
 */

import React, { useState, useCallback } from 'react';
import AyoaViewToggle from '@/components/canvas/AyoaViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import AyoaMapView from '@/components/canvas/AyoaMapView';
import AyoaFeedView from '@/components/canvas/AyoaFeedView';
import GanttView from '@/components/views/GanttView';

const DNA_ACCENTS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

export default function UnifiedAyoaLayout({
  data,
  tasks: tasksProp,
  clients = [],
  centerLabel = 'מרכז',
  centerSub = '',
  accentColor,
  branch,
  currentMonth,
  onEditTask,
  children,
}) {
  const items = data || tasksProp || [];
  const [activeView, setActiveView] = useState('feed');
  const accent = accentColor || (branch && DNA_ACCENTS[branch]) || DNA_ACCENTS.P2;
  const resolvedSub = centerSub || `${items.length} פריטים`;

  // ── EMERGENCY DEBUG: Log everything ──
  console.log(`[UnifiedAyoaLayout] "${centerLabel}" | items: ${items.length} | activeView: ${activeView} | hasChildren: ${!!children} | childrenType: ${typeof children}`);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
  }, []);

  // ── FEED VIEW: Render children DIRECTLY — no animation wrapper ──
  if (activeView === 'feed') {
    return (
      <div className="space-y-3">
        {/* View Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          <AyoaViewToggle value={activeView} onChange={handleViewChange} accentColor={accent} />
          {/* Debug pill — shows data count */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            data: {items.length} | children: {children ? 'YES' : 'NO'}
          </span>
        </div>

        {/* CHILDREN FIRST — this is your original page content */}
        {children}

        {/* Fallback only if no children passed */}
        {!children && items.length > 0 && (
          <AyoaFeedView tasks={items} onEditTask={onEditTask} />
        )}

        {/* Empty state — only when both children AND items are empty */}
        {!children && items.length === 0 && (
          <div className="p-6 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 text-center">
            <p className="text-lg font-bold text-amber-900">DEBUG: הצינור ריק</p>
            <p className="text-sm text-amber-700 mt-1">
              data/tasks prop: {items.length} items | children prop: {String(!!children)}
            </p>
            <p className="text-xs text-amber-600 mt-2">
              בדוק שהדף שולח data או children ל-UnifiedAyoaLayout
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── NON-FEED VIEWS (Map, Radial, Gantt) ──
  return (
    <div className="space-y-3">
      {/* View Switcher */}
      <div className="flex items-center gap-3 flex-wrap">
        <AyoaViewToggle value={activeView} onChange={handleViewChange} accentColor={accent} />
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
          data: {items.length}
        </span>
      </div>

      {/* Map view */}
      {activeView === 'map' && (
        <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '500px' }}>
          <AyoaMapView tasks={items} centerLabel={centerLabel} centerSub={resolvedSub} />
        </div>
      )}

      {/* Radial view */}
      {activeView === 'radial' && (
        <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '500px' }}>
          <AyoaRadialView tasks={items} centerLabel={centerLabel} centerSub={resolvedSub} />
        </div>
      )}

      {/* Gantt view */}
      {activeView === 'gantt' && (
        <GanttView tasks={items} clients={clients} currentMonth={currentMonth || new Date()} onEditTask={onEditTask} />
      )}
    </div>
  );
}
