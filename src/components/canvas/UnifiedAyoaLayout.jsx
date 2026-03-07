/**
 * ── UnifiedAyoaLayout: Global View Engine Wrapper ──
 * Wraps ANY dashboard page with the 4-view switcher (Map, Radial, Gantt, Feed).
 * Provides FloatingToolbar and DNA-colored views automatically.
 *
 * CRITICAL RULE: Children (original page content) are ALWAYS the primary view.
 * AYOA visualizations (radial, map, gantt) are SECONDARY opt-in views.
 * The "feed" view falls back to children (original tables/data grids).
 *
 * Usage:
 *   <UnifiedAyoaLayout
 *     tasks={tasks}
 *     clients={clients}
 *     centerLabel="שכר"
 *     centerSub="P1"
 *     accentColor="#00A3E0"
 *     currentMonth={selectedMonth}
 *     onEditTask={handleEdit}
 *   >
 *     Your existing page content (shown in "original" mode)
 *   </UnifiedAyoaLayout>
 *
 * The wrapper reads from AyoaViewContext for global state.
 * If no tasks are passed, the AYOA views gracefully show an empty state.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AyoaViewToggle from '@/components/canvas/AyoaViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import AyoaMapView from '@/components/canvas/AyoaMapView';
import AyoaFeedView from '@/components/canvas/AyoaFeedView';
import GanttView from '@/components/views/GanttView';
import { Table } from 'lucide-react';

// DNA Colors
const DNA_ACCENTS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

export default function UnifiedAyoaLayout({
  tasks = [],
  clients = [],
  centerLabel = 'מרכז',
  centerSub = '',
  accentColor,
  currentMonth,
  onEditTask,
  defaultView,
  showOriginalToggle = true,
  tableView,
  children,
}) {
  // LOCAL state — each page instance manages its own view, no global context leaking
  const [localView, setLocalView] = useState(null); // null = show children (original content)

  // null means "show original content" (children). Only non-null triggers AYOA views.
  const activeAyoaView = localView; // radial | map | gantt | feed | null

  // Debug: verify data is arriving
  if (process.env.NODE_ENV === 'development' && tasks.length > 0) {
    console.log(`[UnifiedAyoaLayout] "${centerLabel}" received ${tasks.length} tasks, view: ${activeAyoaView || 'original (children)'}`);
  }

  const handleViewChange = useCallback((view) => {
    setLocalView(view);
  }, []);

  const showOriginal = useCallback(() => {
    setLocalView(null);
  }, []);

  const accent = accentColor || DNA_ACCENTS.P1;
  const isOriginalActive = activeAyoaView === null;

  return (
    <div className="space-y-3">
      {/* ── Sticky View Switcher Bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <AyoaViewToggle
          value={activeAyoaView}
          onChange={handleViewChange}
          accentColor={accent}
        />
        {showOriginalToggle && children && (
          <button
            onClick={showOriginal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
              isOriginalActive
                ? 'bg-white shadow-sm font-bold'
                : 'hover:bg-white/60'
            }`}
            style={isOriginalActive ? {
              color: accent,
              boxShadow: `0 2px 8px ${accent}20`,
            } : {
              color: '#9E9E9E',
              background: 'linear-gradient(135deg, #F8F9FA, #F0F2F5)',
            }}
          >
            <Table className="w-3.5 h-3.5" />
            טבלה
          </button>
        )}
      </div>

      {/* ── View Content ── */}
      <AnimatePresence mode="wait">
        {isOriginalActive ? (
          /* DEFAULT: Always show original page content (children) */
          <motion.div
            key="original"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tableView || children}
          </motion.div>
        ) : (
          <motion.div
            key={activeAyoaView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeAyoaView === 'radial' && (
              <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white"
                style={{ minHeight: '450px' }}>
                <AyoaRadialView
                  tasks={tasks}
                  centerLabel={centerLabel}
                  centerSub={centerSub || `${tasks.length} משימות`}
                />
              </div>
            )}

            {activeAyoaView === 'map' && (
              <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white"
                style={{ minHeight: '450px' }}>
                <AyoaMapView
                  tasks={tasks}
                  centerLabel={centerLabel}
                  centerSub={centerSub || `${tasks.length} משימות`}
                />
              </div>
            )}

            {activeAyoaView === 'gantt' && (
              <GanttView
                tasks={tasks}
                clients={clients}
                currentMonth={currentMonth || new Date()}
                onEditTask={onEditTask}
              />
            )}

            {activeAyoaView === 'feed' && (
              <div className="rounded-2xl border border-gray-100 bg-white"
                style={{ minHeight: '200px' }}>
                <AyoaFeedView
                  tasks={tasks}
                  onEditTask={onEditTask}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
