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

// User-specified palette — calming, no red. Kept as the source of truth
// for the canonical 5 colours so SERVICE_COLOR_MAP below can reference
// them without duplicating hex values.
const PALETTE = ['#0288D1', '#F57C00', '#2E7D32', '#7B1FA2', '#5A9EB5'];
// Small orange dot marking "has at least one urgent task".
const URGENT_DOT_COLOR = '#F57C00';

// Stage 5.9 spec — colour consistency ("דרישת חובה"): every service
// domain must always render in the SAME colour, independent of sort
// order or task count. Previously colours were assigned by sorted
// position (`PALETTE[i % PALETTE.length]`), which meant urgency/count
// changes could repaint a domain — e.g. שכר turning from blue to
// orange when a new urgent task tipped the sort. The map below pins
// each normalised Hebrew label to one palette slot so the eye can
// learn "שכר = blue, מע"מ = orange" etc. and keep that association
// across renders.
//
// The map is keyed by the DISPLAY LABEL (post-normalization) so that
// every raw key that maps to "שכר" inherits the same colour.
const SERVICE_COLOR_MAP = {
  'שכר':              '#0288D1', // blue
  'שכר ורשויות':      '#1565C0', // deeper blue — umbrella for unclassified payroll tasks
  'מע"מ':             '#F57C00', // orange
  'מע"מ 874':         '#E65100', // deep orange — distinguishable from מע"מ
  'ביטוח לאומי':      '#7B1FA2', // purple
  'הנהלת חשבונות':    '#2E7D32', // green (also catches the __umbrella_tax fallback)
  'מקדמות מס':        '#5A9EB5', // steel blue
  'דו"ח שנתי':        '#00796B', // teal (also catches the __umbrella_annual fallback)
  'פנסיות':           '#C2185B', // pink
  'קליטת לקוח':       '#455A64', // slate
  'ניכויים':          '#8D6E63', // brown
  'התאמות':           '#6A1B9A', // deep purple
  'משלוח תלושים':     '#00695C', // dark teal
  'משרד':             '#37474F', // dark slate — umbrella for unclassified admin tasks
  'כללי':             '#9E9E9E', // neutral grey
};

// Resolve a display label to its canonical colour. Unknown labels
// (shouldn't happen after normalization, but defensive) fall back to
// the neutral grey used for 'כללי'.
function colorForService(label) {
  return SERVICE_COLOR_MAP[label] || SERVICE_COLOR_MAP['כללי'];
}

// Canonical display labels for service domains. Tasks in this codebase
// store their domain in several different fields and formats (see the
// fallback chain in resolveRawKey below, nodeSelection.js:44, and
// recurringTaskEngine.js:287). This map normalises the raw key to a
// single Hebrew label so the circles don't splinter — e.g. 'payroll'
// from recurringTaskEngine and 'שכר' from QuickAddTaskDialog collapse
// into ONE domain called שכר.
//
// Stage 5.9 spec: unknown raw keys no longer pass through — they fall
// into the 'כללי' bucket (see normalizeServiceLabel below) AND are
// logged ONCE to the console via loggedUnknownKeys, so the unmapped
// values can be added to this map in a follow-up commit.
//
// Stage 5.9 bug-fix: "כללי" was previously swallowing many tasks that
// had an empty category string but DID carry dashboard-level metadata
// (parent_service / branch) from recurringTaskEngine.js:289. The
// resolveRawKey helper below now routes those tasks into per-dashboard
// umbrella labels (שכר ורשויות / הנהלת חשבונות / משרד / דו"ח שנתי)
// instead of letting them all collapse into 'כללי'. The umbrella
// entries below are keyed with a '__umbrella_' sentinel prefix so it's
// obvious at a glance that they're fallback-synthesised and not raw
// values coming from task.category.
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

  // Bookkeeping (incl. monthly variant requested in Stage 5.9 spec)
  bookkeeping: 'הנהלת חשבונות',
  bookkeeping_monthly: 'הנהלת חשבונות',
  work_bookkeeping: 'הנהלת חשבונות',
  'הנהלת חשבונות': 'הנהלת חשבונות',
  'הנה"ח': 'הנהלת חשבונות',

  // Tax advances
  tax_advances: 'מקדמות מס',
  work_tax_advances: 'מקדמות מס',
  'מקדמות מס': 'מקדמות מס',

  // Annual report (incl. financials variant requested in Stage 5.9 spec)
  annual_report: 'דו"ח שנתי',
  annual_financials: 'דו"ח שנתי',
  work_annual_report: 'דו"ח שנתי',
  'דו"ח שנתי': 'דו"ח שנתי',

  // Pensions
  pensions: 'פנסיות',
  'פנסיות': 'פנסיות',

  // Client onboarding (incl. short + bookkeeping_onboarding variants
  // requested in Stage 5.9 spec)
  client_onboarding: 'קליטת לקוח',
  onboarding: 'קליטת לקוח',
  bookkeeping_onboarding: 'קליטת לקוח',
  'קליטת לקוח': 'קליטת לקוח',

  // Misc domains that appear in seed data and live tasks (incl.
  // 'adjustments' variant requested in Stage 5.9 spec)
  'ניכויים': 'ניכויים',
  deductions: 'ניכויים',
  'התאמות': 'התאמות',
  reconciliations: 'התאמות',
  adjustments: 'התאמות',
  'משלוח תלושים': 'משלוח תלושים',
  payslips: 'משלוח תלושים',

  // Dashboard-level umbrella fallbacks (Stage 5.9 bug-fix).
  // Synthesised by resolveRawKey when a task has no explicit category /
  // service_key / service_group but DOES have parent_service or branch.
  // Prefixed with '__umbrella_' so they don't collide with real raw keys
  // and so they're easy to spot in the diagnostic console log.
  __umbrella_payroll: 'שכר ורשויות',
  __umbrella_tax: 'הנהלת חשבונות', // intentionally merges with explicit 'הנהלת חשבונות'
  __umbrella_admin: 'משרד',
  __umbrella_annual: 'דו"ח שנתי',  // intentionally merges with explicit 'דו"ח שנתי'

  // Final fallback bucket
  'כללי': 'כללי',
};

// Module-level dedup set — we only want to log each unknown raw key
// ONCE per session, not every time groupByServiceDomain re-runs (which
// happens on every edit that mutates localTasks).
const loggedUnknownKeys = new Set();

function normalizeServiceLabel(rawKey) {
  if (!rawKey) return 'כללי';
  // Stage 5.9 spec: unknown values fall back to 'כללי' (not pass-through)
  // so the circles don't get polluted with raw technical keys.
  return SERVICE_LABEL_MAP[rawKey] || 'כללי';
}

// Stage 5.9 bug-fix: resolve a task to a raw key for grouping.
//
// Old behaviour (one-liner): task.category || task.service_key ||
// task.service_group || 'כללי'. That worked for tasks from
// recurringTaskEngine (which sets service_key), but tasks created via
// QuickAddTaskDialog / TaskForm that end up with an empty category
// AND no service_key at all fell straight into 'כללי'. That was most
// of the live data.
//
// New behaviour: after the explicit fields, fall back to the
// DASHBOARD-LEVEL metadata that recurringTaskEngine.js:289 sets on
// every recurring task — `parent_service` ('payroll' / 'tax' / 'admin'
// / 'home' / 'annual') and `branch` ('P1' / 'P2' / 'P3' / 'P4' / 'P5').
// That metadata is enough to salvage the task into a domain-level
// umbrella (שכר ורשויות / הנהלת חשבונות / משרד / דו"ח שנתי) instead of
// leaving it in 'כללי'.
//
// Note on getServiceForTask (processTemplates.js:693): deliberately
// NOT called here, because its very first line is `if (!task?.category)
// return null` — so for the exact case we're trying to salvage (tasks
// with empty category) it always returns null. Calling it would be
// theatre. The MoM diagnosis that general.taskCategories: ['', ...]
// was routing empty-category tasks into 'general' is incorrect for
// this reason — the short-circuit fires first.
//
// Note on task.dashboard (from the MoM diagnosis): this field does
// NOT exist on task records in this codebase. `dashboard` is a field
// on SERVICE definitions in processTemplates.js (see line 7 of that
// file). The real task-level fields that express the same concept are
// `parent_service` and `branch`.
function resolveRawKey(task) {
  // 1. Explicit human-readable category (Hebrew label or English work_* key)
  if (task.category && task.category !== '') return task.category;
  // 2. Structural identifiers set by recurringTaskEngine
  if (task.service_key) return task.service_key;
  if (task.service_group) return task.service_group;
  // 3. Dashboard-level umbrella via parent_service (preferred) or branch
  const ps = task.parent_service;
  const br = task.branch;
  if (ps === 'payroll' || br === 'P1') return '__umbrella_payroll';
  if (ps === 'tax' || br === 'P2') return '__umbrella_tax';
  if (ps === 'admin' || br === 'P3') return '__umbrella_admin';
  if (ps === 'annual' || br === 'P5') return '__umbrella_annual';
  // 4. Genuinely unclassifiable — last-resort bucket
  return 'כללי';
}

function groupByServiceDomain(tasks) {
  const groups = new Map();
  const freshUnknowns = [];

  (tasks || []).forEach((task) => {
    // Stage 5.9 bug-fix: resolveRawKey walks the full fallback chain
    // including parent_service / branch umbrellas, so tasks that used
    // to collapse into 'כללי' now land in a dashboard-level domain.
    const rawKey = resolveRawKey(task);
    const label = normalizeServiceLabel(rawKey);

    // Collect unmapped raw keys so the console can be used to extend
    // SERVICE_LABEL_MAP. We only report each key ONCE per session via
    // the module-level loggedUnknownKeys set — otherwise the log would
    // fire on every state update that rebuilds localTasks.
    // Umbrella keys (__umbrella_*) and the 'כללי' fallback are never
    // "unknown" — they're intentional sentinels.
    if (
      rawKey !== 'כללי' &&
      !rawKey.startsWith('__umbrella_') &&
      !SERVICE_LABEL_MAP[rawKey] &&
      !loggedUnknownKeys.has(rawKey)
    ) {
      loggedUnknownKeys.add(rawKey);
      freshUnknowns.push(rawKey);
    }

    if (!groups.has(label)) {
      groups.set(label, { serviceLabel: label, tasks: [] });
    }
    groups.get(label).tasks.push(task);
  });

  if (typeof window !== 'undefined' && freshUnknowns.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      '[AyoaMiniMap] unmapped service keys (add to SERVICE_LABEL_MAP):',
      freshUnknowns
    );
  }

  // Urgent domains first, then by task count. i=0 lands on the right
  // in the RTL layout below — most urgent is the first thing the eye hits.
  //
  // IMPORTANT: the sort determines POSITION on the map, but NOT the
  // colour. Colour is resolved from SERVICE_COLOR_MAP by label, so
  // 'שכר' stays blue whether it's at position 0 or position 5. This
  // is the Stage 5.9 "colour consistency" hard requirement.
  const arr = Array.from(groups.values()).sort((a, b) => {
    const aUrgent = a.tasks.some((t) => t.priority === 'urgent') ? 1 : 0;
    const bUrgent = b.tasks.some((t) => t.priority === 'urgent') ? 1 : 0;
    if (aUrgent !== bUrgent) return bUrgent - aUrgent;
    return b.tasks.length - a.tasks.length;
  });

  // Cap at 8 domains — matches the original 8-client cap and keeps the
  // mini-map readable at the 360px minimum viewBox width.
  return arr.slice(0, 8).map((group) => ({
    ...group,
    color: colorForService(group.serviceLabel),
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
  // Stage 5.9: trimEnd() so long labels like 'הנהלת חשבונות' don't
  // render as 'הנהלת …' with a visible space before the ellipsis.
  const labelText =
    label.length > 6 ? `${label.slice(0, 6).trimEnd()}…` : label;
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
