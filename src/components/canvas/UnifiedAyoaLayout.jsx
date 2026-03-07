/**
 * ── UnifiedAyoaLayout: Global View Engine Wrapper ──
 * Wraps ANY dashboard page with the 4-view switcher (Map, Radial, Gantt, Feed).
 * Provides FloatingToolbar and DNA-colored views automatically.
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
 *     defaultView="radial"        // optional — override default
 *     tableView={<YourTableJSX />} // optional — custom table/kanban to show when not in AYOA mode
 *   >
 *     Your existing page content (shown in "original" mode)
 *   </UnifiedAyoaLayout>
 *
 * The wrapper reads from AyoaViewContext for global state.
 * If no tasks are passed, the AYOA views gracefully show an empty state.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAyoaView } from '@/contexts/AyoaViewContext';
import AyoaViewToggle from '@/components/canvas/AyoaViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import AyoaMapView from '@/components/canvas/AyoaMapView';
import AyoaFeedView from '@/components/canvas/AyoaFeedView';
import GanttView from '@/components/views/GanttView';
import { Network, Target, BarChart3, List, Table } from 'lucide-react';

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
  const { ayoaView, setAyoaView } = useAyoaView();
  const [showOriginal, setShowOriginal] = useState(false);

  // If defaultView is set and we haven't manually changed, use it
  const activeView = ayoaView || defaultView || 'radial';

  const handleViewChange = useCallback((view) => {
    setShowOriginal(false);
    setAyoaView(view);
  }, [setAyoaView]);

  const toggleOriginal = useCallback(() => {
    setShowOriginal(prev => !prev);
  }, []);

  const accent = accentColor || DNA_ACCENTS.P1;

  return (
    <div className="space-y-3">
      {/* ── Sticky View Switcher Bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <AyoaViewToggle
          value={showOriginal ? null : activeView}
          onChange={handleViewChange}
          accentColor={accent}
        />
        {showOriginalToggle && children && (
          <button
            onClick={toggleOriginal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
              showOriginal
                ? 'bg-white shadow-sm font-bold'
                : 'hover:bg-white/60'
            }`}
            style={showOriginal ? {
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
        {showOriginal ? (
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
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeView === 'radial' && (
              <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white"
                style={{ minHeight: '450px' }}>
                <AyoaRadialView
                  tasks={tasks}
                  centerLabel={centerLabel}
                  centerSub={centerSub || `${tasks.length} משימות`}
                />
              </div>
            )}

            {activeView === 'map' && (
              <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white"
                style={{ minHeight: '450px' }}>
                <AyoaMapView
                  tasks={tasks}
                  centerLabel={centerLabel}
                  centerSub={centerSub || `${tasks.length} משימות`}
                />
              </div>
            )}

            {activeView === 'gantt' && (
              <GanttView
                tasks={tasks}
                clients={clients}
                currentMonth={currentMonth || new Date()}
                onEditTask={onEditTask}
              />
            )}

            {activeView === 'feed' && (
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
