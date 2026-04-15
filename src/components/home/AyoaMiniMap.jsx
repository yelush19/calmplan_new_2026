import React, { useState, useMemo } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Paperclip } from 'lucide-react';
import TaskFileAttachments from '@/components/tasks/TaskFileAttachments';
import {
  TASK_STATUS_CONFIG,
  STATUS_CONFIG,
  migrateStatus,
} from '@/config/processTemplates';

// Phase 2: compact SVG "mind-map" overview of today's active clients.
// Pure SVG — NO canvas, NO Konva. Clicking a circle opens a Drawer with
// that client's tasks (no navigation away from Home).

// User-specified palette — calming, no red.
const PALETTE = ['#0288D1', '#F57C00', '#2E7D32', '#7B1FA2', '#5A9EB5'];
// Small orange dot marking "has at least one urgent task".
const URGENT_DOT_COLOR = '#F57C00';

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

// Fixed circle-to-circle step so gaps don't collapse when the client count
// grows. The viewBox width is computed from `total` below, so circles land
// inside the SVG with breathing room instead of clipping the edges.
// STEP must stay >= max-circle-diameter + small gap. With r_max=36 (below)
// the diameter is 72, so STEP=78 leaves a 6px gap between neighbours.
const STEP = 78;

function calcX(i, total, viewWidth = 360) {
  // RTL layout: i=0 (most urgent) sits at the right. We center the row
  // inside viewWidth so a small count (1-3) isn't pinned hard to the right.
  if (total <= 1) return viewWidth / 2;
  const usedWidth = (total - 1) * STEP;
  const startRight = viewWidth - (viewWidth - usedWidth) / 2;
  return startRight - i * STEP;
}

function AyoaCircle({ cx, cy, r, color, label, count, urgent, onClick }) {
  const labelText = label.length > 6 ? `${label.slice(0, 6)}…` : label;
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
        y={cy + r + 14}
        textAnchor="middle"
        fontSize={11}
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

  // Stage 5.7.2: sort by canonical status priority (from STATUS_CONFIG)
  // then by due date. Legacy statuses are normalized via migrateStatus so
  // older tasks still group correctly. STATUS_CONFIG priorities (low → high
  // = urgent → done) are: waiting_for_materials=1, not_started=2,
  // sent_for_review/needs_corrections=3, ready_to_broadcast=3.5,
  // reported_pending_payment=4, production_completed=5.
  const drawerTasks = useMemo(() => {
    if (!selectedGroup) return [];
    const statusPriority = (status) => {
      const normalized = migrateStatus(status);
      return STATUS_CONFIG[normalized]?.priority ?? 99;
    };
    return [...selectedGroup.tasks].sort((a, b) => {
      const pa = statusPriority(a.status);
      const pb = statusPriority(b.status);
      if (pa !== pb) return pa - pb;
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    });
  }, [selectedGroup]);

  // Stage 5.8: group drawer tasks by category (service/domain) so the
  // drawer is organised "תחומים ללקוח" rather than a flat status list.
  // Categories with any urgent task are sorted to the top so the most
  // pressing domain is the first thing the user sees when the drawer opens.
  const drawerTasksByCategory = useMemo(() => {
    if (!selectedGroup) return {};
    const grouped = {};
    drawerTasks.forEach((task) => {
      const cat = task.category || 'כללי';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(task);
    });
    return Object.fromEntries(
      Object.entries(grouped).sort(([, a], [, b]) => {
        const aU = a.some((t) => t.priority === 'urgent') ? 0 : 1;
        const bU = b.some((t) => t.priority === 'urgent') ? 0 : 1;
        return aU - bU;
      })
    );
  }, [drawerTasks, selectedGroup]);

  if (groups.length === 0) return null;

  // Grow the viewBox with the client count so 6-8 circles don't collapse
  // into each other. Minimum 360 keeps small counts at a natural size.
  const viewWidth = Math.max(360, (groups.length - 1) * STEP + 60);

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
        viewBox={`0 0 ${viewWidth} 200`}
        dir="rtl"
        style={{ display: 'block', overflow: 'hidden' }}
      >
        {groups.map((group, i) => (
          <AyoaCircle
            key={group.clientName}
            cx={calcX(i, groups.length, viewWidth)}
            cy={90}
            r={Math.min(36, Math.max(18, group.tasks.length * 4))}
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
        {/* Stage 5.8: overflow:visible so the per-task Attachments Popover
            can escape the drawer's rounded clip without getting cut off. */}
        <DrawerContent style={{ overflow: 'visible' }}>
          <DrawerHeader className="relative">
            <DrawerTitle
              className="text-center"
              style={{ fontFamily: 'Heebo, sans-serif', color: '#1A2332' }}
            >
              {selectedGroup?.clientName} · {selectedGroup?.tasks.length || 0} משימות
            </DrawerTitle>
            {/* Stage 5.8: category summary strip — gives immediate
                orientation of the domains this client is currently running. */}
            {Object.keys(drawerTasksByCategory).length > 0 && (
              <div className="text-xs text-slate-400 text-center mt-0.5">
                {Object.keys(drawerTasksByCategory).join(' · ')}
              </div>
            )}
            <button
              onClick={() => setSelectedGroup(null)}
              className="absolute top-3 left-3 text-gray-400 hover:text-gray-700 text-lg font-bold"
              aria-label="סגור"
            >
              ✕
            </button>
          </DrawerHeader>
          <div
            dir="rtl"
            className="px-4 pb-6 max-h-[60vh] overflow-y-auto"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            {/* Stage 5.8: tasks grouped by category instead of a flat list.
                Status colour is pulled from TASK_STATUS_CONFIG (e.g. amber
                for waiting_for_materials, purple for sent_for_review), and
                each card has a paperclip Popover wired to TaskFileAttachments
                so files can be attached/viewed without leaving Home. */}
            {Object.entries(drawerTasksByCategory).map(([cat, catTasks]) => (
              <div key={cat}>
                <div className="flex items-center justify-between px-1 py-1.5 mt-2">
                  <span className="text-xs font-bold text-slate-600">{cat}</span>
                  <span className="text-[11px] text-slate-400">
                    {catTasks.length} משימות
                  </span>
                </div>
                {catTasks.map((task) => {
                  const cfg = TASK_STATUS_CONFIG[migrateStatus(task.status)];
                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-xl mb-1.5 ${cfg?.color || 'bg-white text-gray-700'}`}
                      style={{ border: '1px solid #EEF1F5' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {task.title || 'ללא שם'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {cfg && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70">
                              {cfg.text}
                            </span>
                          )}
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
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-white/60"
                                aria-label="קבצים מצורפים"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Paperclip className="w-3 h-3" />
                                {(task.attachments?.length || 0) > 0 && (
                                  <span>{task.attachments.length}</span>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-72 p-3"
                              style={{ zIndex: 9999 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <TaskFileAttachments
                                taskId={task.id}
                                attachments={task.attachments || []}
                                clientId={
                                  selectedGroup?.clientId || task.client_id || null
                                }
                                clientName={selectedGroup?.clientName}
                                onUpdate={(updated) => {
                                  setSelectedGroup((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          tasks: prev.tasks.map((t) =>
                                            t.id === task.id
                                              ? { ...t, attachments: updated }
                                              : t
                                          ),
                                        }
                                      : prev
                                  );
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      {task.due_date && (
                        <div className="text-[12px] mt-1 opacity-80">
                          {task.due_date}
                        </div>
                      )}
                    </div>
                  );
                })}
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
        </DrawerContent>
      </Drawer>
    </div>
  );
}
