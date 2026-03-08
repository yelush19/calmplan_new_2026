/**
 * ── UnifiedAyoaLayout: Global View Engine Wrapper ──
 *
 * CRITICAL RULE: Children are ALWAYS visible by default.
 * localView = null → show children (original page content).
 * localView = 'map'|'radial'|'gantt'|'feed' → show AYOA visualization.
 *
 * The wrapper is TRANSPARENT by default. It only intercepts rendering
 * when the user explicitly clicks an AYOA view button.
 *
 * Directive #1: One House, Many Rooms.
 * Directive #5: 4 Lenses (Map, Radial, Gantt, Feed) — all opt-in.
 * Directive #6: FloatingToolbar on node click (handled by child views).
 */

import React, { useState, useCallback } from 'react';
import AyoaViewToggle from '@/components/canvas/AyoaViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import AyoaMapView from '@/components/canvas/AyoaMapView';
import AyoaFeedView from '@/components/canvas/AyoaFeedView';
import FocusMapView from '@/components/canvas/FocusMapView';
import GanttView from '@/components/views/GanttView';
import { Table, Loader2 } from 'lucide-react';

const DNA_ACCENTS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

export default function UnifiedAyoaLayout({
  data,
  tasks: tasksProp,
  allTasks: allTasksProp,
  clients = [],
  centerLabel = 'מרכז',
  centerSub = '',
  accentColor,
  branch,
  currentMonth,
  onEditTask,
  isLoading = false,
  children,
}) {
  const tasks = data || tasksProp || [];
  const allTasks = allTasksProp || tasks;

  // null = show children (original content). AYOA views are opt-in only.
  const [localView, setLocalView] = useState(null);

  const accent = accentColor || (branch && DNA_ACCENTS[branch]) || DNA_ACCENTS.P2;
  const isOriginalActive = localView === null;

  const handleViewChange = useCallback((view) => {
    setLocalView(view);
  }, []);

  const showOriginal = useCallback(() => {
    setLocalView(null);
  }, []);

  return (
    <div className="space-y-3">
      {/* ── View Switcher Bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <AyoaViewToggle
          value={localView}
          onChange={handleViewChange}
          accentColor={accent}
        />
        {children && (
          <button
            onClick={showOriginal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
              isOriginalActive
                ? 'bg-white shadow-sm font-bold'
                : 'hover:bg-white/60'
            }`}
            style={isOriginalActive ? {
              color: accent,
              boxShadow: `0 2px 8px ${accent}20`,
            } : {
              color: '#1E293B',
              background: 'linear-gradient(135deg, #F8F9FA, #F0F2F5)',
            }}
          >
            <Table className="w-3.5 h-3.5" />
            טבלה
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {isOriginalActive ? (
        // DEFAULT: Show original page content (children) — untouched, no wrapper
        <>{children}</>
      ) : isLoading ? (
        // Loading state — show spinner while data is fetching
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
          <span className="text-sm font-bold text-slate-600">טוען נתונים...</span>
        </div>
      ) : (
        // AYOA view selected — show visualization
        <>
          {localView === 'focus' && (
            <div className="rounded-2xl overflow-hidden border border-amber-100"
              style={{ minHeight: '450px', background: 'linear-gradient(180deg, #FFFDE7 0%, #FFFFFF 100%)' }}>
              <FocusMapView
                tasks={tasks}
                allTasks={allTasks}
                centerLabel={centerLabel}
                centerSub={centerSub || `${tasks.length} משימות`}
              />
            </div>
          )}

          {localView === 'map' && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white"
              style={{ minHeight: '450px' }}>
              <AyoaMapView
                tasks={tasks}
                centerLabel={centerLabel}
                centerSub={centerSub || `${tasks.length} משימות`}
              />
            </div>
          )}

          {localView === 'radial' && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white"
              style={{ minHeight: '450px' }}>
              <AyoaRadialView
                tasks={tasks}
                centerLabel={centerLabel}
                centerSub={centerSub || `${tasks.length} משימות`}
              />
            </div>
          )}

          {localView === 'gantt' && (
            <GanttView
              tasks={tasks}
              clients={clients}
              currentMonth={currentMonth || new Date()}
              onEditTask={onEditTask}
            />
          )}

          {localView === 'feed' && (
            <AyoaFeedView
              tasks={tasks}
              onEditTask={onEditTask}
            />
          )}
        </>
      )}
    </div>
  );
}
