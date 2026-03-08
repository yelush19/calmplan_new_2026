/**
 * ── UnifiedAyoaLayout: Transparent View Engine Wrapper ──
 *
 * RULE 1: Children are ALWAYS the default view. Zero animation. Zero opacity tricks.
 * RULE 2: AYOA views (radial/map/gantt/feed) are opt-in when user clicks a toggle.
 * RULE 3: This wrapper is DATA-AGNOSTIC. It passes `items` (any array) to AYOA views.
 *         It does NOT care about field names. The views handle detection.
 * RULE 4: NO AnimatePresence, NO motion.div, NO framer-motion. Just a div.
 *
 * Usage:
 *   <UnifiedAyoaLayout items={myDataArray} centerLabel="שכר" accentColor="#00A3E0">
 *     {myOriginalPageContent}
 *   </UnifiedAyoaLayout>
 *
 * The `tasks` prop is an alias for `items` (backward compat).
 */

import React, { useState, useCallback } from 'react';
import AyoaViewToggle from '@/components/canvas/AyoaViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import AyoaMapView from '@/components/canvas/AyoaMapView';
import AyoaFeedView from '@/components/canvas/AyoaFeedView';
import GanttView from '@/components/views/GanttView';
import { Table } from 'lucide-react';

export default function UnifiedAyoaLayout({
  // Data — accepts either `items` or `tasks` (backward compat)
  items,
  tasks,
  clients = [],
  centerLabel = 'מרכז',
  centerSub = '',
  accentColor = '#00A3E0',
  currentMonth,
  onEditTask,
  // Legacy props (ignored, kept for compat)
  defaultView,
  showOriginalToggle = true,
  tableView,
  children,
}) {
  // Merge: prefer explicit `items`, fall back to `tasks`
  const data = items || tasks || [];

  // LOCAL view state — null = show children (original content)
  const [activeView, setActiveView] = useState(null);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
  }, []);

  const handleShowOriginal = useCallback(() => {
    setActiveView(null);
  }, []);

  const isOriginal = activeView === null;

  return (
    <div className="space-y-3">
      {/* ── View Switcher Bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <AyoaViewToggle
          value={activeView}
          onChange={handleViewChange}
          accentColor={accentColor}
        />
        {children && (
          <button
            onClick={handleShowOriginal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isOriginal ? 'bg-white shadow-sm font-bold' : 'hover:bg-white/60'
            }`}
            style={isOriginal ? {
              color: accentColor,
              boxShadow: `0 2px 8px ${accentColor}20`,
            } : {
              color: '#475569',
              background: 'linear-gradient(135deg, #F8F9FA, #F0F2F5)',
            }}
          >
            <Table className="w-3.5 h-3.5" />
            טבלה
          </button>
        )}
      </div>

      {/* ── Content: NO animation, NO opacity tricks, JUST RENDER ── */}
      {isOriginal ? (
        /* DEFAULT: Render children as-is. Zero wrapper interference. */
        <div>{tableView || children}</div>
      ) : (
        <div>
          {activeView === 'radial' && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '450px' }}>
              <AyoaRadialView tasks={data} centerLabel={centerLabel} centerSub={centerSub || `${data.length} פריטים`} />
            </div>
          )}
          {activeView === 'map' && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white" style={{ minHeight: '450px' }}>
              <AyoaMapView tasks={data} centerLabel={centerLabel} centerSub={centerSub || `${data.length} פריטים`} />
            </div>
          )}
          {activeView === 'gantt' && (
            <GanttView tasks={data} clients={clients} currentMonth={currentMonth || new Date()} onEditTask={onEditTask} />
          )}
          {activeView === 'feed' && (
            <div className="rounded-2xl border border-gray-100 bg-white" style={{ minHeight: '200px' }}>
              <AyoaFeedView tasks={data} onEditTask={onEditTask} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
