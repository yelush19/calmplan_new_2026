import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Paperclip, Check } from 'lucide-react';
import { Task } from '@/api/entities';
import TaskFileAttachments from '@/components/tasks/TaskFileAttachments';
import {
  TASK_STATUS_CONFIG,
  STATUS_CONFIG,
  migrateStatus,
} from '@/config/processTemplates';

// Stage 5.9: the mini-map no longer groups by client. Each circle now
// represents a SERVICE DOMAIN (שכר, מע"מ, ביטוח לאומי, ...) so the
// morning view of Home surfaces workload-by-domain rather than
// workload-by-client. The drawer of a circle lists every task in that
// domain, sub-grouped by status (mirroring GroupedServiceTable in the
// Payroll/Tax dashboards), and supports in-place status + attachments
// edits that reflect immediately in both the drawer and the circle
// counts without closing or re-fetching.
//
// Pure SVG — NO canvas, NO Konva.

// User-specified palette — calming, no red.
const PALETTE = ['#0288D1', '#F57C00', '#2E7D32', '#7B1FA2', '#5A9EB5'];
// Small orange dot marking "has at least one urgent task".
const URGENT_DOT_COLOR = '#F57C00';

// Canonical display labels for service domains. Tasks in this codebase
// store their domain in several different fields and formats (see the
// fallback chain in groupByServiceDomain below, nodeSelection.js:44,
// and recurringTaskEngine.js:287). This map normalises the raw key to a
// single Hebrew label so the circles don't splinter — e.g. 'payroll'
// from recurringTaskEngine and 'שכר' from QuickAddTaskDialog collapse
// into ONE domain called שכר. Unknown values pass through as-is so a
// misspelled or new category still gets its own bucket.
const SERVICE_LABEL_MAP = {
  // Payroll
  payroll: 'שכר',
  work_payroll: 'שכר',
  'שכר': 'שכר',

  // VAT
  vat: 'מע"מ',
  vat_reporting: 'מע"מ',
  work_vat_reporting: 'מע"מ',
  'מע"מ': 'מע"מ',

  // VAT 874 (distinct from regular VAT)
  vat_874: 'מע"מ 874',
  work_vat_874: 'מע"מ 874',
  'מע"מ 874': 'מע"מ 874',

  // Social security
  social_security: 'ביטוח לאומי',
  national_insurance: 'ביטוח לאומי',
  work_social_security: 'ביטוח לאומי',
  'ביטוח לאומי': 'ביטוח לאומי',

  // Bookkeeping
  bookkeeping: 'הנהלת חשבונות',
  work_bookkeeping: 'הנהלת חשבונות',
  'הנהלת חשבונות': 'הנהלת חשבונות',
  'הנה"ח': 'הנהלת חשבונות',

  // Tax advances
  tax_advances: 'מקדמות מס',
  work_tax_advances: 'מקדמות מס',
  'מקדמות מס': 'מקדמות מס',

  // Annual report
  annual_report: 'דו"ח שנתי',
  work_annual_report: 'דו"ח שנתי',
  'דו"ח שנתי': 'דו"ח שנתי',

  // Pensions
  pensions: 'פנסיות',
  'פנסיות': 'פנסיות',

  // Client onboarding
  client_onboarding: 'קליטת לקוח',
  'קליטת לקוח': 'קליטת לקוח',

  // Misc domains that appear in seed data and live tasks
  'ניכויים': 'ניכויים',
  deductions: 'ניכויים',
  'התאמות': 'התאמות',
  reconciliations: 'התאמות',
  'משלוח תלושים': 'משלוח תלושים',
  payslips: 'משלוח תלושים',

  // Final fallback bucket
  'כללי': 'כללי',
};

function normalizeServiceLabel(rawKey) {
  if (!rawKey) return 'כללי';
  return SERVICE_LABEL_MAP[rawKey] || rawKey;
}

function groupByServiceDomain(tasks) {
  const groups = new Map();
  (tasks || []).forEach((task) => {
    // Fallback chain — same order as nodeSelection.js:44. `category`
    // is preferred because it's human-readable in live data, then
    // `service_key` / `service_group` from recurringTaskEngine as the
    // structural fallbacks.
    const rawKey =
      task.category ||
      task.service_key ||
      task.service_group ||
      'כללי';
    const label = normalizeServiceLabel(rawKey);
    if (!groups.has(label)) {
      groups.set(label, { serviceLabel: label, rawKey, tasks: [] });
    }
    groups.get(label).tasks.push(task);
  });

  // Urgent domains first, then by task count. i=0 lands on the right
  // in the RTL layout below — most urgent is the first thing the eye hits.
  const arr = Array.from(groups.values()).sort((a, b) => {
    const aUrgent = a.tasks.some((t) => t.priority === 'urgent') ? 1 : 0;
    const bUrgent = b.tasks.some((t) => t.priority === 'urgent') ? 1 : 0;
    if (aUrgent !== bUrgent) return bUrgent - aUrgent;
    return b.tasks.length - a.tasks.length;
  });

  // Cap at 8 domains — matches the original 8-client cap and keeps the
  // mini-map readable at the 360px minimum viewBox width.
  return arr.slice(0, 8).map((group, i) => ({
    ...group,
    color: PALETTE[i % PALETTE.length],
  }));
}

// Ordered list of statuses offered in the drawer's status picker.
// Matches STATUS_CONFIG in processTemplates.js (7 canonical statuses,
// see processTemplates.js:995 "THE GOLDEN LIST").
const DRAWER_STATUS_OPTIONS = [
  'not_started',
  'waiting_for_materials',
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

export default function AyoaMiniMap({ tasks, onServiceClick }) {
  // Stage 5.9: local mirror of the `tasks` prop. All in-drawer edits
  // (status change, attachments update) flow through `applyTaskUpdate`
  // which rewrites `localTasks` AND `selectedService` immutably, so:
  //   - the drawer reflects the edit immediately (no close, no re-fetch)
  //   - the outer circles' counts/urgency stay accurate, because
  //     `groups` is derived from `localTasks`
  // When the parent (Home) eventually re-fetches and passes a new
  // `tasks` prop, we re-sync via the effect below.
  const [localTasks, setLocalTasks] = useState(() => tasks || []);
  useEffect(() => {
    setLocalTasks(tasks || []);
  }, [tasks]);

  const [selectedService, setSelectedService] = useState(null);

  const groups = useMemo(() => groupByServiceDomain(localTasks), [localTasks]);

  // Stage 5.7.2: sort by canonical status priority (from STATUS_CONFIG)
  // then by due date. Legacy statuses are normalised via migrateStatus so
  // older tasks still group correctly. STATUS_CONFIG priorities (low → high
  // = urgent → done) are: waiting_for_materials=1, not_started=2,
  // sent_for_review/needs_corrections=3, ready_to_broadcast=3.5,
  // reported_pending_payment=4, production_completed=5.
  const drawerTasks = useMemo(() => {
    if (!selectedService) return [];
    const statusPriority = (status) => {
      const normalized = migrateStatus(status);
      return STATUS_CONFIG[normalized]?.priority ?? 99;
    };
    return [...selectedService.tasks].sort((a, b) => {
      const pa = statusPriority(a.status);
      const pb = statusPriority(b.status);
      if (pa !== pb) return pa - pb;
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    });
  }, [selectedService]);

  // Stage 5.9: sub-group the drawer tasks by STATUS. This mirrors the
  // GroupedServiceTable layout used in PayrollDashboard, TaxReportsDashboard
  // and PayrollReportsDashboard — the drawer becomes a compact version of
  // "this service's tasks, bucketed by status" without pulling in the full
  // dashboard table (which needs 12+ handler callbacks, drag-to-reorder,
  // ResizableTable, etc. — see GroupedServiceTable.jsx).
  const drawerTasksByStatus = useMemo(() => {
    if (!selectedService) return {};

    // Stage 5.9: lightweight diagnostic so the live shape of records can be
    // inspected in the browser console if the 'כללי' bucket is non-empty.
    // Safe to remove once real data is confirmed clean.
    if (typeof window !== 'undefined' && drawerTasks.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[AyoaDrawer] selected service:', {
        label: selectedService.serviceLabel,
        rawKey: selectedService.rawKey,
        count: drawerTasks.length,
        sample: drawerTasks.slice(0, 3).map((t) => ({
          title: t.title,
          category: t.category,
          service_key: t.service_key,
          status: t.status,
        })),
      });
    }

    const grouped = {};
    drawerTasks.forEach((task) => {
      const normalized = migrateStatus(task.status) || 'not_started';
      if (!grouped[normalized]) grouped[normalized] = [];
      grouped[normalized].push(task);
    });
    // Keep STATUS_CONFIG priority order (urgent first → done last).
    return Object.fromEntries(
      Object.entries(grouped).sort(([a], [b]) => {
        const pa = STATUS_CONFIG[a]?.priority ?? 99;
        const pb = STATUS_CONFIG[b]?.priority ?? 99;
        return pa - pb;
      })
    );
  }, [drawerTasks, selectedService]);

  // ── REQUIRED PATTERN — dual-sync state update ────────────────────
  // Every in-drawer edit flows through here. It updates BOTH:
  //   (a) localTasks       → keeps circle counts/urgency accurate
  //   (b) selectedService  → keeps the drawer snapshot in sync so the
  //                          currently-open drawer reflects the edit
  //                          immediately without re-mounting or
  //                          re-fetching from the DB.
  // Do NOT rely on re-fetch. Do NOT navigate. Do NOT close the drawer.
  // ──────────────────────────────────────────────────────────────────
  const applyTaskUpdate = useCallback((taskId, changes) => {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...changes } : t))
    );
    setSelectedService((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId ? { ...t, ...changes } : t
            ),
          }
        : prev
    );
  }, []);

  const handleAttachmentsUpdate = useCallback(
    (task, updated) => {
      applyTaskUpdate(task.id, { attachments: updated });
    },
    [applyTaskUpdate]
  );

  const handleStatusChange = useCallback(
    async (task, newStatus) => {
      const previousStatus = task.status;
      // Optimistic update — drawer and circles reflect the new status
      // immediately, before the DB round-trip resolves.
      applyTaskUpdate(task.id, { status: newStatus });
      try {
        await Task.update(task.id, { status: newStatus });
      } catch (err) {
        // Revert on DB failure so we don't lie to the user.
        // eslint-disable-next-line no-console
        console.error('[AyoaDrawer] status update failed, reverting:', err);
        applyTaskUpdate(task.id, { status: previousStatus });
      }
    },
    [applyTaskUpdate]
  );

  if (groups.length === 0) return null;

  // Grow the viewBox with the domain count so 6-8 circles don't collapse
  // into each other. Minimum 360 keeps small counts at a natural size.
  const viewWidth = Math.max(360, (groups.length - 1) * STEP + 60);

  const handleClick = (group) => {
    setSelectedService(group);
    if (onServiceClick) onServiceClick(group);
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
            key={group.serviceLabel}
            cx={calcX(i, groups.length, viewWidth)}
            cy={90}
            r={Math.min(36, Math.max(18, group.tasks.length * 4))}
            color={group.color}
            label={group.serviceLabel}
            count={group.tasks.length}
            urgent={group.tasks.some((t) => t.priority === 'urgent')}
            onClick={() => handleClick(group)}
          />
        ))}
      </svg>

      <Drawer
        open={!!selectedService}
        onOpenChange={(open) => {
          if (!open) setSelectedService(null);
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
              {selectedService?.serviceLabel} · {selectedService?.tasks.length || 0} משימות
            </DrawerTitle>
            <button
              onClick={() => setSelectedService(null)}
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
            {/* Stage 5.9: tasks sub-grouped by status — mirrors the
                GroupedServiceTable layout used by the Payroll/Tax dashboards.
                Status colour is pulled from TASK_STATUS_CONFIG (e.g. amber
                for waiting_for_materials, purple for sent_for_review). Each
                card has:
                  - a clickable status badge (Popover → 7 canonical statuses)
                  - a paperclip Popover wired to TaskFileAttachments
                Both flow through `applyTaskUpdate` so the drawer + circle
                counts update immediately without re-fetching. */}
            {Object.entries(drawerTasksByStatus).map(([statusKey, statusTasks]) => {
              const statusCfg = STATUS_CONFIG[statusKey];
              return (
                <div key={statusKey}>
                  <div className="flex items-center justify-between px-1 py-1.5 mt-2">
                    <span className="text-xs font-bold text-slate-600">
                      {statusCfg?.label || statusKey}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {statusTasks.length} משימות
                    </span>
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
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-semibold truncate">
                              {task.title || 'ללא שם'}
                            </span>
                            {task.client_name && (
                              <span className="text-[11px] text-slate-500 truncate">
                                {task.client_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Status picker — click badge to change status.
                                applyTaskUpdate → dual-sync localTasks + selectedService. */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 hover:bg-white"
                                  aria-label="שנה סטטוס"
                                >
                                  {cfg?.text || task.status || '—'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-48 p-1"
                                style={{ zIndex: 9999 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {DRAWER_STATUS_OPTIONS.map((optKey) => {
                                  const sCfg = STATUS_CONFIG[optKey];
                                  const isCurrent = migrateStatus(task.status) === optKey;
                                  return (
                                    <button
                                      key={optKey}
                                      type="button"
                                      onClick={() => handleStatusChange(task, optKey)}
                                      className={`w-full text-right text-[12px] px-2 py-1.5 rounded hover:bg-slate-100 flex items-center justify-between ${isCurrent ? 'bg-slate-50 font-bold' : ''}`}
                                    >
                                      <span>{sCfg?.label || optKey}</span>
                                      {isCurrent && (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      )}
                                    </button>
                                  );
                                })}
                              </PopoverContent>
                            </Popover>
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
                                  clientId={task.client_id || null}
                                  clientName={task.client_name}
                                  onUpdate={(updated) =>
                                    handleAttachmentsUpdate(task, updated)
                                  }
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
              );
            })}
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
