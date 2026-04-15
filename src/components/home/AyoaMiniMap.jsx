import React, { useState, useMemo } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
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

// Stage 5.9: group tasks by SERVICE DOMAIN instead of by client.
// Sources of truth for raw category strings are messy — Hebrew labels from
// the UI ("שכר"), English keys from templates ("payroll"), legacy keys
// from older data ("work_vat_reporting") — all of which must collapse into
// one of a small set of canonical domain buckets.
const SERVICE_NORMALIZATION = {
  'שכר': 'payroll', 'תלושים': 'payroll', 'קליטת שכר': 'payroll',
  'payroll': 'payroll', 'salary': 'payroll', 'payroll_monthly': 'payroll',
  'מ.ע.ב': 'payroll',
  'פנסיות': 'pensions', 'קרן פנסיה': 'pensions',
  'pensions': 'pensions', 'pension_reporting': 'pensions',
  'מע"מ': 'vat', 'מעמ': 'vat', 'מקדמות מס': 'vat',
  'vat_reporting': 'vat', 'work_vat_reporting': 'vat',
  'הנהלת חשבונות': 'bookkeeping', 'ניכויים': 'bookkeeping',
  'bookkeeping': 'bookkeeping', 'bookkeeping_monthly': 'bookkeeping',
  'דוח שנתי': 'annual_report', 'דו"ח שנתי': 'annual_report',
  'מאזן': 'annual_report', 'annual_report': 'annual_report',
  'annual_financials': 'annual_report',
  'ביטוח לאומי': 'national_insurance', 'בט"ל': 'national_insurance',
  'national_insurance': 'national_insurance',
  'קליטה': 'client_onboarding', 'קליטת לקוח': 'client_onboarding',
  'client_onboarding': 'client_onboarding',
  'bookkeeping_onboarding': 'client_onboarding',
  'התאמות': 'reconciliations', 'reconciliations': 'reconciliations',
  'adjustments': 'reconciliations',
};

const LABEL_MAP = {
  payroll: 'שכר',
  pensions: 'פנסיות',
  vat: 'מע"מ',
  bookkeeping: 'הנהלת ח-ב',
  annual_report: 'דוח שנתי',
  national_insurance: 'ביטוח לאומי',
  client_onboarding: 'קליטת לקוח',
  reconciliations: 'התאמות',
  unknown: 'כללי',
};

function normalizeServiceKey(rawCategory) {
  if (!rawCategory) return 'unknown';
  const trimmed = String(rawCategory).trim();
  if (SERVICE_NORMALIZATION[trimmed]) return SERVICE_NORMALIZATION[trimmed];
  // Loose prefix match so slight variations still hit the right bucket.
  for (const [key, val] of Object.entries(SERVICE_NORMALIZATION)) {
    if (trimmed.startsWith(key) || key.startsWith(trimmed)) return val;
  }
  return 'unknown';
}

function groupByServiceDomain(tasks) {
  const groups = new Map();
  const unknownKeys = new Set();
  (tasks || []).forEach((task) => {
    const raw = task.category || task.service_key || task.service_group || '';
    const normalized = normalizeServiceKey(raw);
    if (normalized === 'unknown' && raw) unknownKeys.add(raw);
    if (!groups.has(normalized)) {
      groups.set(normalized, {
        normalized_key: normalized,
        label: LABEL_MAP[normalized] || 'כללי',
        tasks: [],
      });
    }
    groups.get(normalized).tasks.push(task);
  });
  if (unknownKeys.size > 0) {
    // Dev aid: surface raw keys we don't know so they can be added to
    // SERVICE_NORMALIZATION. Only logs when something falls through.
    console.log('[AyoaMiniMap] Unknown service keys:', [...unknownKeys]);
  }
  // Urgent domains first, then by task count (descending).
  // This puts the "most urgent" domain at index 0, which — because of the
  // RTL x-coordinate math below — lands on the right.
  return Array.from(groups.values())
    .sort((a, b) => {
      const aU = a.tasks.some((t) => t.priority === 'urgent') ? 0 : 1;
      const bU = b.tasks.some((t) => t.priority === 'urgent') ? 0 : 1;
      if (aU !== bU) return aU - bU;
      return b.tasks.length - a.tasks.length;
    })
    .slice(0, 9)
    .map((group, i) => ({ ...group, color: PALETTE[i % PALETTE.length] }));
}

// Stage 5.9: canonical bucket order for the drawer's status groups.
// Legacy/unmapped statuses fall through to the end via migrateStatus.
const STATUS_ORDER = [
  'not_started',
  'waiting_for_materials',
  'in_progress',
  'sent_for_review',
  'needs_corrections',
  'ready_to_broadcast',
  'reported_pending_payment',
  'production_completed',
];

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

  // Stage 5.9: groupByServiceDomain replaces groupByClient. Each circle
  // now represents a WORK DOMAIN (שכר / מע"מ / ביטוח לאומי / ...), not a
  // client — AYOA-style "what kind of work am I doing today", not "who do
  // I need to call". Clicking a circle opens a Drawer with the tasks in
  // that domain, bucketed by status.
  const groups = useMemo(() => groupByServiceDomain(tasks), [tasks]);

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

  // Stage 5.9: since each circle is already one service domain, the
  // drawer groups its tasks by STATUS instead of by category. Buckets
  // follow STATUS_ORDER so the user always reads top-down from "לבצע" to
  // "הושלם ייצור". Legacy statuses are remapped via migrateStatus.
  const drawerTasksByStatus = useMemo(() => {
    if (!selectedGroup) return {};
    const grouped = {};
    drawerTasks.forEach((task) => {
      const s = migrateStatus(task.status) || 'not_started';
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(task);
    });
    return Object.fromEntries(
      STATUS_ORDER.filter((s) => grouped[s]).map((s) => [s, grouped[s]])
    );
  }, [drawerTasks, selectedGroup]);

  // Stage 5.9: unique client names for the drawer sub-title. Preserves
  // first-seen order (which itself is status-priority sorted via
  // drawerTasks), caps at 5 and shows "+N" overflow.
  const drawerClientNames = useMemo(() => {
    if (!selectedGroup) return [];
    const seen = new Set();
    const out = [];
    drawerTasks.forEach((t) => {
      const name = t.client_name || 'ללא לקוח';
      if (!seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    });
    return out;
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
          מפה לפי תחומי שירות
        </h3>
        <span className="text-[12px]" style={{ color: '#9AA5B4' }}>
          {groups.length} תחומים · לחצי על עיגול
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
            key={group.normalized_key}
            cx={calcX(i, groups.length, viewWidth)}
            cy={90}
            r={Math.min(36, Math.max(18, group.tasks.length * 4))}
            color={group.color}
            label={group.label}
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
        {/* Stage 5.8 (JKAj2): overflow:visible so the per-task Attachments
            Popover can escape the drawer's rounded clip without getting cut off. */}
        <DrawerContent style={{ overflow: 'visible' }}>
          <DrawerHeader className="relative">
            {/* Stage 5.9: header describes the DOMAIN (שכר / מע"מ / ...),
                not a client. Subtitle lists up to 5 unique client names with
                "+N" overflow so the user sees who is involved in this domain
                today at a glance. */}
            <DrawerTitle
              className="text-center"
              style={{ fontFamily: 'Heebo, sans-serif', color: '#1A2332' }}
            >
              {selectedGroup?.label || ''} · {selectedGroup?.tasks.length || 0} משימות
            </DrawerTitle>
            {drawerClientNames.length > 0 && (
              <div className="text-xs text-slate-400 text-center mt-0.5">
                {drawerClientNames.slice(0, 5).join(' · ')}
                {drawerClientNames.length > 5 && ` +${drawerClientNames.length - 5}`}
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
            {/* Stage 5.9: tasks bucketed by STATUS (STATUS_ORDER), not by
                category. Bucket header uses TASK_STATUS_CONFIG[s]?.text.
                Each card shows title → client_name → due_date, and keeps
                the paperclip Popover wired to TaskFileAttachments so files
                can be attached/viewed without leaving Home. */}
            {Object.entries(drawerTasksByStatus).map(([status, statusTasks]) => {
              const statusCfg = TASK_STATUS_CONFIG[status];
              return (
                <div key={status} className="mb-3">
                  <div className="text-xs font-bold text-slate-500 mb-1.5 px-1">
                    {statusCfg?.text || status} ({statusTasks.length})
                  </div>
                  {statusTasks.map((task) => {
                    const cfg = TASK_STATUS_CONFIG[migrateStatus(task.status)];
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-xl mb-1.5 ${cfg?.color || 'bg-white text-gray-700'}`}
                        style={{ border: '1px solid #EEF1F5' }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: '#1A2332' }}
                          >
                            {task.title || 'ללא שם'}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
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
                                  className="flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-white/60"
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
                                  clientId={task.client_id || null}
                                  clientName={task.client_name || ''}
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
                        {task.client_name && (
                          <div className="text-[12px] mt-1 opacity-80">
                            {task.client_name}
                          </div>
                        )}
                        {task.due_date && (
                          <div className="text-[11px] mt-0.5 opacity-70">
                            {task.due_date}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {Object.keys(drawerTasksByStatus).length === 0 && (
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
