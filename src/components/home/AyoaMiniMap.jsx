import React, { useState, useMemo } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

// Phase 2: compact SVG "mind-map" overview of today's active clients.
// Pure SVG — NO canvas, NO Konva. Clicking a circle opens a Drawer with
// that client's tasks (no navigation away from Home).

// User-specified palette — calming, no red.
const PALETTE = ['#0288D1', '#F57C00', '#2E7D32', '#7B1FA2', '#5A9EB5'];
// Small orange dot marking "has at least one urgent task".
const URGENT_DOT_COLOR = '#F57C00';

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

function groupByClient(tasks) {
  const groups = new Map();
  (tasks || []).forEach((task) => {
    const key = task.client_name || 'ללא לקוח';
    if (!groups.has(key)) groups.set(key, { clientName: key, tasks: [] });
    groups.get(key).tasks.push(task);
  });

  // Urgent groups first, then by task count (descending).
  // This is what puts the "most urgent" group at index 0, which — because
  // of the RTL x-coordinate math below — lands on the right.
  const arr = Array.from(groups.values()).sort((a, b) => {
    const aUrgent = a.tasks.some((t) => t.priority === 'urgent') ? 1 : 0;
    const bUrgent = b.tasks.some((t) => t.priority === 'urgent') ? 1 : 0;
    if (aUrgent !== bUrgent) return bUrgent - aUrgent;
    return b.tasks.length - a.tasks.length;
  });

  // Cap at 8 so the mini-map stays readable at 360px wide.
  return arr.slice(0, 8).map((group, i) => ({
    ...group,
    color: PALETTE[i % PALETTE.length],
  }));
}

function calcX(i, total, viewWidth = 360, margin = 36) {
  // RTL layout: i=0 (most urgent) sits at the right edge.
  if (total <= 1) return viewWidth / 2;
  const usable = viewWidth - margin * 2;
  const step = usable / (total - 1);
  return viewWidth - margin - i * step;
}

function AyoaCircle({ cx, cy, r, color, label, count, urgent, onClick }) {
  const labelText = label.length > 10 ? `${label.slice(0, 10)}…` : label;
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKey}
      aria-label={`${label} — ${count} משימות${urgent ? ', כולל משימה דחופה' : ''}`}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize={r > 28 ? 16 : 14}
        fontWeight={700}
        fill={color}
        style={{ fontFamily: 'Heebo, sans-serif', pointerEvents: 'none' }}
      >
        {count}
      </text>
      {urgent && (
        <circle
          cx={cx + r * 0.68}
          cy={cy - r * 0.68}
          r={5}
          fill={URGENT_DOT_COLOR}
          stroke="#FFFFFF"
          strokeWidth={1.5}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <text
        x={cx}
        y={cy + r + 16}
        textAnchor="middle"
        fontSize={12}
        fill="#5A6A7A"
        style={{ fontFamily: 'Heebo, sans-serif', pointerEvents: 'none' }}
      >
        {labelText}
      </text>
    </g>
  );
}

export default function AyoaMiniMap({ tasks, onGroupClick }) {
  const [selectedGroup, setSelectedGroup] = useState(null);

  const groups = useMemo(() => groupByClient(tasks), [tasks]);

  const drawerTasks = useMemo(() => {
    if (!selectedGroup) return [];
    return [...selectedGroup.tasks].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    });
  }, [selectedGroup]);

  if (groups.length === 0) return null;

  const handleClick = (group) => {
    setSelectedGroup(group);
    if (onGroupClick) onGroupClick(group);
  };

  return (
    <div
      dir="rtl"
      className="rounded-2xl"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #EEF1F5',
        padding: '12px 16px',
        fontFamily: 'Heebo, sans-serif',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: '#1A2332' }}>
          מפה לפי לקוחות
        </h3>
        <span className="text-[12px]" style={{ color: '#9AA5B4' }}>
          {groups.length} לקוחות · לחצי על עיגול
        </span>
      </div>
      <svg
        width="100%"
        height="200"
        viewBox="0 0 360 200"
        dir="rtl"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {groups.map((group, i) => (
          <AyoaCircle
            key={group.clientName}
            cx={calcX(i, groups.length)}
            cy={90}
            r={Math.min(40, Math.max(20, group.tasks.length * 6))}
            color={group.color}
            label={group.clientName}
            count={group.tasks.length}
            urgent={group.tasks.some((t) => t.priority === 'urgent')}
            onClick={() => handleClick(group)}
          />
        ))}
      </svg>

      <Drawer
        open={!!selectedGroup}
        onOpenChange={(open) => {
          if (!open) setSelectedGroup(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle
              className="text-center"
              style={{ fontFamily: 'Heebo, sans-serif', color: '#1A2332' }}
            >
              {selectedGroup?.clientName} · {selectedGroup?.tasks.length || 0} משימות
            </DrawerTitle>
          </DrawerHeader>
          <div
            dir="rtl"
            className="px-4 pb-6 max-h-[60vh] overflow-y-auto"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            <div className="space-y-2">
              {drawerTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-xl"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #EEF1F5',
                    borderInlineStart: `4px solid ${selectedGroup?.color || '#5B8DB8'}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: '#1A2332' }}
                    >
                      {task.title || 'ללא שם'}
                    </span>
                    {task.priority === 'urgent' && (
                      <span
                        className="font-bold"
                        style={{
                          backgroundColor: '#FDF2EE',
                          color: '#9A3E1E',
                          padding: '2px 10px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                        }}
                      >
                        דחוף
                      </span>
                    )}
                  </div>
                  {(task.category || task.due_date) && (
                    <div
                      className="text-[12px] mt-1"
                      style={{ color: '#5A6A7A' }}
                    >
                      {task.category}
                      {task.category && task.due_date ? ' · ' : ''}
                      {task.due_date}
                    </div>
                  )}
                </div>
              ))}
              {drawerTasks.length === 0 && (
                <div
                  className="text-center py-8 text-sm"
                  style={{ color: '#9AA5B4' }}
                >
                  אין משימות להצגה
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
