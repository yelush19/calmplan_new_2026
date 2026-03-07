/**
 * ── AyoaDashboardViews: Unified view renderer for all dashboards ──
 * Renders the active AYOA view (Map, Radial, Gantt, Feed) based on context.
 * Drop this into any dashboard with tasks + clients + view mode.
 *
 * Props:
 *   viewMode      - 'map' | 'radial' | 'gantt' | 'feed'
 *   tasks         - Array of task entities
 *   clients       - Array of client entities (for Gantt)
 *   centerLabel   - Center label for Map/Radial
 *   centerSub     - Sub-label for Map/Radial
 *   currentMonth  - Date object for Gantt view
 *   onEditTask    - Callback when user clicks a task
 *   accentColor   - DNA color for this dashboard
 */

import React from 'react';
import AyoaRadialView from './AyoaRadialView';
import AyoaMapView from './AyoaMapView';
import AyoaFeedView from './AyoaFeedView';
import GanttView from '@/components/views/GanttView';

export default function AyoaDashboardViews({
  viewMode = 'radial',
  tasks = [],
  clients = [],
  centerLabel = 'מרכז',
  centerSub = '',
  currentMonth,
  onEditTask,
  accentColor,
}) {
  switch (viewMode) {
    case 'radial':
      return (
        <div className="rounded-2xl overflow-hidden border border-gray-100" style={{ minHeight: '400px' }}>
          <AyoaRadialView
            tasks={tasks}
            centerLabel={centerLabel}
            centerSub={centerSub}
          />
        </div>
      );

    case 'map':
      return (
        <div className="rounded-2xl overflow-hidden border border-gray-100" style={{ minHeight: '400px' }}>
          <AyoaMapView
            tasks={tasks}
            centerLabel={centerLabel}
            centerSub={centerSub}
          />
        </div>
      );

    case 'gantt':
      return (
        <GanttView
          tasks={tasks}
          clients={clients}
          currentMonth={currentMonth || new Date()}
          onEditTask={onEditTask}
        />
      );

    case 'feed':
      return (
        <div className="rounded-2xl border border-gray-100 bg-white" style={{ minHeight: '200px' }}>
          <AyoaFeedView
            tasks={tasks}
            onEditTask={onEditTask}
          />
        </div>
      );

    default:
      return (
        <div className="rounded-2xl overflow-hidden border border-gray-100" style={{ minHeight: '400px' }}>
          <AyoaRadialView
            tasks={tasks}
            centerLabel={centerLabel}
            centerSub={centerSub}
          />
        </div>
      );
  }
}
