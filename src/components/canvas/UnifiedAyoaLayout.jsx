/**
 * ── UnifiedAyoaLayout: The One Wrapper — Every Page Is a Room ──
 *
 * DIRECTIVE #1: One House, Many Rooms.
 * Every page passes its data array to this wrapper. The wrapper draws nodes.
 * Zero items = zero nodes. 50 items = 50 nodes.
 *
 * DIRECTIVE #3: The Data Plumbing.
 *   Step 1: Page fetches data → const pageData = [...]
 *   Step 2: <UnifiedAyoaLayout data={pageData} />
 *   Step 3: Wrapper loops props.data, draws one Node per item.
 *
 * DIRECTIVE #4: The Filtering Bouncer.
 *   The wrapper ONLY shows what belongs on this page.
 *   The center Root Node auto-names to the current page context.
 *
 * DIRECTIVE #5: The 4 Lenses.
 *   Map | Radial | Gantt | Feed (Feed = original data table fallback)
 *
 * DIRECTIVE #8: No legacy view-toggle buttons. This is the ONLY toggle.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AyoaViewToggle from '@/components/canvas/AyoaViewToggle';
import AyoaRadialView from '@/components/canvas/AyoaRadialView';
import AyoaMapView from '@/components/canvas/AyoaMapView';
import AyoaFeedView from '@/components/canvas/AyoaFeedView';
import GanttView from '@/components/views/GanttView';

// ── DNA Branch Colors ──
const DNA_ACCENTS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

/**
 * @param {Object} props
 * @param {Array}  props.data          - The sacred data array. One node per item.
 * @param {Array}  [props.tasks]       - Alias for data (backwards compat)
 * @param {Array}  [props.clients]     - Client entities for Gantt enrichment
 * @param {string} props.centerLabel   - Root node label (auto-matches page context)
 * @param {string} [props.centerSub]   - Root node subtitle (e.g. "P2", "12 משימות")
 * @param {string} [props.accentColor] - DNA accent override
 * @param {string} [props.branch]      - P1 | P2 | P3 | P4 — for color selection
 * @param {Date}   [props.currentMonth]- For Gantt view
 * @param {Function} [props.onEditTask]- Click handler for task editing
 * @param {React.ReactNode} props.children - CRITICAL: The Feed view renders this (original table)
 */
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
  // ── Directive #3: data is the truth. tasks is an alias for backwards compat ──
  const items = data || tasksProp || [];

  // ── LOCAL view state — no global context leaking between pages ──
  const [activeView, setActiveView] = useState('feed'); // feed = children (original content)

  // ── Resolve accent from branch or explicit prop ──
  const accent = accentColor || (branch && DNA_ACCENTS[branch]) || DNA_ACCENTS.P2;

  // ── Directive #4: Auto-subtitle if not provided ──
  const resolvedSub = centerSub || `${items.length} פריטים`;

  // ── Debug log in dev ──
  if (process.env.NODE_ENV === 'development' && items.length > 0) {
    console.log(`[UnifiedAyoaLayout] "${centerLabel}" received ${items.length} items, view: ${activeView}`);
  }

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
  }, []);

  return (
    <div className="space-y-3">
      {/* ── Directive #5: Permanent Top-Bar View Switcher (4 Lenses) ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <AyoaViewToggle
          value={activeView}
          onChange={handleViewChange}
          accentColor={accent}
        />
      </div>

      {/* ── View Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* ── MAP: Organic Ayoa mind map ── */}
          {activeView === 'map' && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white"
              style={{ minHeight: '500px' }}>
              <AyoaMapView
                tasks={items}
                centerLabel={centerLabel}
                centerSub={resolvedSub}
              />
            </div>
          )}

          {/* ── RADIAL: 360° circular layout ── */}
          {activeView === 'radial' && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white"
              style={{ minHeight: '500px' }}>
              <AyoaRadialView
                tasks={items}
                centerLabel={centerLabel}
                centerSub={resolvedSub}
              />
            </div>
          )}

          {/* ── GANTT: Pill-shaped timeline ── */}
          {activeView === 'gantt' && (
            <GanttView
              tasks={items}
              clients={clients}
              currentMonth={currentMonth || new Date()}
              onEditTask={onEditTask}
            />
          )}

          {/* ── FEED (THE FALLBACK): Render original data table (children) ── */}
          {activeView === 'feed' && (
            <div>
              {children || (
                <AyoaFeedView
                  tasks={items}
                  onEditTask={onEditTask}
                />
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
