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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Paperclip, Pencil, Pin, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import TaskFileAttachments from '@/components/tasks/TaskFileAttachments';
import {
  TASK_STATUS_CONFIG,
  STATUS_CONFIG,
  migrateStatus,
  getServiceForTask,
} from '@/config/processTemplates';
import { getDashboardUrlForTask, getDashboardLabelForTask } from '@/utils/taskNavigation';

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
  // Stage 5.10: 'unknown' is no longer a single mega-bucket. Tasks whose
  // raw category doesn't match any known domain are further split by the
  // dashboard they belong to (via processTemplates.getServiceForTask),
  // so the user sees distinct sub-domains on the mind map instead of
  // one undifferentiated 'כללי' blob.
  unknown_admin: 'אדמיניסטרציה',
  unknown_home: 'משימות בית',
  unknown_additional: 'שירותים נוספים',
  unknown_annual_reports: 'דוחות שנתיים',
  unknown_payroll: 'שכר — כללי',
  unknown_tax: 'מס — כללי',
  unknown_misc: 'אחר',
};

// Map a dashboard key (as returned by getServiceForTask(task).dashboard)
// to the corresponding unknown_* sub-bucket.
const DASHBOARD_TO_UNKNOWN_KEY = {
  admin: 'unknown_admin',
  home: 'unknown_home',
  additional: 'unknown_additional',
  annual_reports: 'unknown_annual_reports',
  payroll: 'unknown_payroll',
  tax: 'unknown_tax',
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

// Stage 5.10: resolve the sub-bucket for an 'unknown' task by looking it up
// in ALL_SERVICES via its category. Returns a key like 'unknown_admin' so the
// task lands in a dashboard-aware bucket rather than the catch-all 'כללי'.
// getServiceForTask may return a service whose `dashboard` field is either a
// string or an array — we pick the first string in that case.
function resolveUnknownSubKey(task) {
  const service = getServiceForTask(task);
  if (!service) return 'unknown_misc';
  const dashboard = Array.isArray(service.dashboard)
    ? service.dashboard[0]
    : service.dashboard;
  return DASHBOARD_TO_UNKNOWN_KEY[dashboard] || 'unknown_misc';
}

function groupByServiceDomain(tasks) {
  const groups = new Map();
  const unknownKeys = new Set();
  (tasks || []).forEach((task) => {
    const raw = task.category || task.service_key || task.service_group || '';
    let normalized = normalizeServiceKey(raw);
    if (normalized === 'unknown') {
      if (raw) unknownKeys.add(raw);
      // Stage 5.10: split unknowns by dashboard so "כללי" doesn't collect
      // everything. A task falls through to 'unknown_misc' only if its
      // category also isn't in ALL_SERVICES.taskCategories.
      normalized = resolveUnknownSubKey(task);
    }
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
  // This puts the "most urgent" domain at index 0, which lands at the top
  // of the radial layout below (angle -π/2).
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
  'awaiting_recording',
  'production_completed',
];

// Stage 5.10: radial AYOA-style layout. Each group becomes one circle
// positioned on a ring around a central hub, with a connecting line from
// the hub to the circle's edge ("branch" metaphor). The most-urgent group
// lands at the top (angle = -π/2) and subsequent groups walk clockwise.
// Geometry is fixed (viewBox = 480×340) so the SVG scales cleanly on any
// screen width without the circles colliding or the labels clipping.
const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 340;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const RING_RADIUS = 118; // distance from centre to each group circle
const HUB_RADIUS = 34;   // size of the central hub
const LABEL_OFFSET = 10; // gap between circle edge and its label box

function computeRadialPosition(i, n) {
  // For a single group, park it directly above the hub so the layout
  // doesn't collapse into a zero-angle edge case.
  if (n <= 1) return { cx: CENTER_X, cy: CENTER_Y - RING_RADIUS, angle: -Math.PI / 2 };
  const startAngle = -Math.PI / 2; // 12 o'clock
  const step = (2 * Math.PI) / n;
  const angle = startAngle + i * step;
  return {
    cx: CENTER_X + Math.cos(angle) * RING_RADIUS,
    cy: CENTER_Y + Math.sin(angle) * RING_RADIUS,
    angle,
  };
}

// Solid colors for each status — mirrors the STATUS_PIPELINE palette used in
// PayrollDashboard / PayrollReportsDashboard so the ring is recognisable.
const STATUS_RING_COLORS = {
  waiting_for_materials:    '#F59E0B',
  not_started:              '#94A3B8',
  ready_to_broadcast:       '#0D9488',
  reported_pending_payment: '#4F46E5',
  awaiting_recording:       '#0284C7',
  sent_for_review:          '#7C3AED',
  review_after_corrections: '#8B5CF6',
  needs_corrections:        '#D97706',
  production_completed:     '#16A34A',
};

const STATUS_RING_ORDER = [
  'waiting_for_materials',
  'not_started',
  'needs_corrections',
  'sent_for_review',
  'review_after_corrections',
  'ready_to_broadcast',
  'reported_pending_payment',
  'awaiting_recording',
  'production_completed',
];

function StatusRing({ cx, cy, r, statusBuckets, total }) {
  if (!statusBuckets || !total) return null;
  // Build an ordered list of present statuses with their fraction
  const present = STATUS_RING_ORDER
    .map((s) => ({ status: s, count: statusBuckets[s] || 0 }))
    .filter((b) => b.count > 0);
  if (present.length === 0) return null;

  const RING_OFFSET = 6;        // distance from circle stroke to ring
  const RING_RADIUS = r + RING_OFFSET;
  const STROKE_WIDTH = 3.5;
  const GAP = present.length > 1 ? 0.06 : 0;  // small gap (radians) between segments

  // Single-status fast-path: a clean closed ring (two semicircles).
  if (present.length === 1) {
    return (
      <g style={{ pointerEvents: 'none' }}>
        <circle
          cx={cx}
          cy={cy}
          r={RING_RADIUS}
          fill="none"
          stroke={STATUS_RING_COLORS[present[0].status] || '#CBD5E1'}
          strokeWidth={STROKE_WIDTH}
          strokeOpacity={0.85}
        />
      </g>
    );
  }

  let cursor = -Math.PI / 2;  // start at the top
  const segments = [];
  present.forEach(({ status, count }) => {
    const fraction = count / total;
    const sweep = Math.max(0, fraction * 2 * Math.PI - GAP);
    if (sweep <= 0) return;
    const startA = cursor;
    const endA = cursor + sweep;
    const x1 = cx + Math.cos(startA) * RING_RADIUS;
    const y1 = cy + Math.sin(startA) * RING_RADIUS;
    const x2 = cx + Math.cos(endA) * RING_RADIUS;
    const y2 = cy + Math.sin(endA) * RING_RADIUS;
    const largeArc = sweep > Math.PI ? 1 : 0;
    segments.push(
      <path
        key={status}
        d={`M ${x1} ${y1} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`}
        stroke={STATUS_RING_COLORS[status] || '#CBD5E1'}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        fill="none"
      />
    );
    cursor = endA + GAP;
  });
  return <g style={{ pointerEvents: 'none' }}>{segments}</g>;
}

function AyoaCircle({ cx, cy, r, color, label, count, urgent, angle, onClick, statusBuckets }) {
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  // Label sits just outside the circle along the same radial direction as
  // the circle's own position from the hub. foreignObject lets the browser
  // render Hebrew with native RTL wrapping — no truncation, no manual "…".
  const labelBoxWidth = 92;
  const labelBoxHeight = 34;
  const labelCenterX = cx + Math.cos(angle) * (r + LABEL_OFFSET + labelBoxHeight / 2);
  const labelCenterY = cy + Math.sin(angle) * (r + LABEL_OFFSET + labelBoxHeight / 2);
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
      {/* Status-segmented ring: each arc shows what fraction of the tasks
          in this domain are at a given workflow status. Renders OUTSIDE
          the main circle so the count and label stay legible. */}
      <StatusRing cx={cx} cy={cy} r={r} statusBuckets={statusBuckets} total={count} />
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
      <foreignObject
        x={labelCenterX - labelBoxWidth / 2}
        y={labelCenterY - labelBoxHeight / 2}
        width={labelBoxWidth}
        height={labelBoxHeight}
        style={{ pointerEvents: 'none' }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          dir="rtl"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: 'Heebo, sans-serif',
            fontSize: '11px',
            lineHeight: 1.15,
            color: '#475569',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}
        >
          {label}
        </div>
      </foreignObject>
    </g>
  );
}

// Stage 5.10: AyoaMiniMap can now be driven end-to-end by the parent.
// All handler props are OPTIONAL and backwards-compatible:
//   • onStatusChange(task, newStatus)     — if provided, each drawer row
//       renders a live Status <Select> that persists via the parent.
//   • onEditTask(task)                    — if provided, a pencil button
//       appears that opens the parent's task side panel.
//   • onPaymentDateChange(task, dateStr)  — reserved for future rows that
//       surface payment_due_date inline.
//   • onNote(task)                        — if provided, a pin button is
//       shown so rows can be promoted into sticky notes.
// Without any of those props, the drawer falls back to the read-only
// cards it had in Stage 5.9 — so existing callers stay unaffected.
export default function AyoaMiniMap({
  tasks,
  onGroupClick,
  onStatusChange,
  onEditTask,
  onPaymentDateChange,
  onNote,
  onToggleStep,
}) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState({});
  const navigate = useNavigate();

  // Click on the row body (not on a control) navigates to the task's
  // owning dashboard in table mode. Interactive children
  // (Select, buttons, attachments popover) already stopPropagation,
  // so they don't accidentally trigger this.
  const handleRowClick = (task) => (e) => {
    if (e.target.closest('button, a, [role="combobox"], input, select, textarea, [data-no-row-nav]')) {
      return;
    }
    const url = getDashboardUrlForTask(task, { view: 'table' });
    if (url) navigate(url);
  };

  const toggleStepsExpanded = (taskId) => {
    setExpandedSteps((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

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

  const handleClick = (group) => {
    setSelectedGroup(group);
    if (onGroupClick) onGroupClick(group);
  };

  // Stage 5.10: optimistic local update for inline status changes inside
  // the drawer. We patch selectedGroup.tasks immediately so the card moves
  // to the right status bucket without waiting for the parent to round-trip,
  // THEN let the parent persist via onStatusChange. If the parent refreshes
  // the tasks prop later, it'll overwrite via the next click on a circle.
  const handleRowStatusChange = (task, newStatus) => {
    setSelectedGroup((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === task.id ? { ...t, status: newStatus } : t
            ),
          }
        : prev
    );
    if (onStatusChange) onStatusChange(task, newStatus);
  };

  // Precompute each circle's geometry so the connecting lines can terminate
  // at the CIRCLE's edge (not its centre), which keeps the "branch" look
  // clean for small and large circles alike.
  const totalTasks = groups.reduce((sum, g) => sum + g.tasks.length, 0);
  const placedGroups = groups.map((group, i) => {
    const pos = computeRadialPosition(i, groups.length);
    const r = Math.min(34, Math.max(18, group.tasks.length * 4));
    // Status breakdown for the ring around the circle. Legacy statuses are
    // remapped via migrateStatus so the buckets always match STATUS_RING_COLORS.
    const statusBuckets = {};
    group.tasks.forEach((t) => {
      const s = migrateStatus(t.status) || 'not_started';
      statusBuckets[s] = (statusBuckets[s] || 0) + 1;
    });
    return { ...group, ...pos, r, statusBuckets };
  });

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
        height="auto"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Branches first — rendered under the circles so the circle
            strokes always sit on top of the line ends. */}
        {placedGroups.map((g) => {
          const dx = g.cx - CENTER_X;
          const dy = g.cy - CENTER_Y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          return (
            <line
              key={`branch-${g.normalized_key}`}
              x1={CENTER_X + ux * HUB_RADIUS}
              y1={CENTER_Y + uy * HUB_RADIUS}
              x2={g.cx - ux * g.r}
              y2={g.cy - uy * g.r}
              stroke="#E5E7EB"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}

        {/* Central hub — anchors the mind map and shows today's total. */}
        <g style={{ pointerEvents: 'none' }}>
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={HUB_RADIUS}
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth={1.5}
          />
          <text
            x={CENTER_X}
            y={CENTER_Y - 3}
            textAnchor="middle"
            fontSize={12}
            fontWeight={600}
            fill="#1A2332"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            היום
          </text>
          <text
            x={CENTER_X}
            y={CENTER_Y + 13}
            textAnchor="middle"
            fontSize={11}
            fill="#64748B"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            {totalTasks} משימות
          </text>
        </g>

        {placedGroups.map((group) => (
          <AyoaCircle
            key={group.normalized_key}
            cx={group.cx}
            cy={group.cy}
            r={group.r}
            angle={group.angle}
            color={group.color}
            label={group.label}
            count={group.tasks.length}
            urgent={group.tasks.some((t) => t.priority === 'urgent')}
            statusBuckets={group.statusBuckets}
            onClick={() => handleClick(group)}
          />
        ))}
      </svg>
      {/* Status legend — explains the ring colors so the user can map an arc
          on a circle directly to a workflow stage. Only the statuses that
          actually appear among the visible groups are listed, to keep this
          tight. */}
      {(() => {
        const present = new Set();
        placedGroups.forEach((g) => {
          Object.keys(g.statusBuckets || {}).forEach((s) => present.add(s));
        });
        if (present.size === 0) return null;
        const items = STATUS_RING_ORDER.filter((s) => present.has(s));
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 px-1" style={{ fontSize: '10.5px' }}>
            {items.map((s) => (
              <span key={s} className="inline-flex items-center gap-1" style={{ color: '#64748B' }}>
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: STATUS_RING_COLORS[s],
                  }}
                />
                {STATUS_CONFIG[s]?.label || s}
              </span>
            ))}
          </div>
        );
      })()}

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
                    const taskService = getServiceForTask(task);
                    const taskSteps = taskService?.steps || [];
                    const stepsExpanded = !!expandedSteps[task.id];
                    const navLabel = getDashboardLabelForTask(task);
                    return (
                      <div
                        key={task.id}
                        onClick={handleRowClick(task)}
                        role="link"
                        tabIndex={0}
                        title={`לחיצה על השורה — פתח ב${navLabel} (טבלה)`}
                        className={`p-3 rounded-xl mb-1.5 cursor-pointer hover:ring-2 hover:ring-emerald-200 transition-shadow ${cfg?.color || 'bg-white text-gray-700'}`}
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
                            {/* Stage 5.10: when the parent passes
                                onStatusChange we upgrade the status badge
                                into a live Select — same pattern as the
                                TaskRow in Home.jsx, so the drawer behaves
                                like an inline table view. When the parent
                                doesn't, we fall back to a read-only badge
                                (previous Stage 5.9 behaviour). */}
                            {onStatusChange ? (
                              <Select
                                value={migrateStatus(task.status) || 'not_started'}
                                onValueChange={(newStatus) =>
                                  handleRowStatusChange(task, newStatus)
                                }
                              >
                                <SelectTrigger
                                  className={`h-7 text-[11px] px-2 min-w-[110px] border-0 bg-white/70 ${cfg?.color || ''}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent
                                  style={{ zIndex: 10000 }}
                                >
                                  {Object.entries(TASK_STATUS_CONFIG).map(
                                    ([key, { text }]) => (
                                      <SelectItem
                                        key={key}
                                        value={key}
                                        className="text-xs"
                                      >
                                        {text}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            ) : (
                              cfg && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70">
                                  {cfg.text}
                                </span>
                              )
                            )}
                            {onNote && (
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-amber-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNote(task);
                                }}
                                aria-label="הוסף לפתק"
                                title="הוסף לפתק"
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(() => {
                              const url = getDashboardUrlForTask(task, { view: 'table' });
                              if (!url) return null;
                              return (
                                <Link
                                  to={url}
                                  className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-emerald-700"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`פתח ב${navLabel}`}
                                  title={`פתח ב${navLabel}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              );
                            })()}
                            {onEditTask && (
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-slate-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditTask(task);
                                }}
                                aria-label="ערוך משימה"
                                title="ערוך משימה"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
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
                        {/* Inline step controls — same template as the dashboards
                            so the user can advance a task through its workflow
                            without navigating away. Only shown when the parent
                            wires onToggleStep AND the task has a service template
                            with steps. Collapsed by default to keep the drawer
                            scannable. */}
                        {onToggleStep && taskSteps.length > 0 && (
                          <div className="mt-2" data-no-row-nav>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStepsExpanded(task.id);
                              }}
                              className="text-[11px] font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 text-slate-600 hover:bg-white"
                              title={stepsExpanded ? 'הסתר שלבים' : 'הצג שלבים'}
                            >
                              <span>שלבים</span>
                              <span className="opacity-70">
                                {(() => {
                                  const steps = task.process_steps || {};
                                  const done = taskSteps.filter((s) => steps[s.key]?.done).length;
                                  return `${done}/${taskSteps.length}`;
                                })()}
                              </span>
                            </button>
                            {stepsExpanded && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {taskSteps.map((step) => {
                                  const stepData = (task.process_steps || {})[step.key] || { done: false };
                                  const isDone = !!stepData.done;
                                  return (
                                    <button
                                      key={step.key}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleStep(task, step.key);
                                      }}
                                      className={`text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-full border transition-colors ${
                                        isDone
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                      }`}
                                      title={isDone ? 'בטל סימון' : 'סמן כבוצע'}
                                    >
                                      <span
                                        className={`inline-block w-3 h-3 rounded-sm border ${
                                          isDone ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                                        }`}
                                      />
                                      <span>{step.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
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
