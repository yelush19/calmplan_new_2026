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
import GroupedServiceTable from '@/components/dashboard/GroupedServiceTable';
import {
  TASK_STATUS_CONFIG,
  STATUS_CONFIG,
  migrateStatus,
  getServiceForTask,
} from '@/config/processTemplates';
import { getDashboardUrlForTask, getDashboardLabelForTask } from '@/utils/taskNavigation';
import { getWorkDaysAfter } from '@/config/israeliHolidays';
import { getEffectiveStatus } from '@/utils/effectiveStatus';

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
  'הנהלת חשבונות': 'bookkeeping',
  'bookkeeping': 'bookkeeping', 'bookkeeping_monthly': 'bookkeeping',
  // ניכויים is the monthly tax-deduction report (פאיירול-side authority
  // task), NOT a bookkeeping ledger. Pulling it out of the bookkeeping
  // bucket so it stops getting silently mixed with הנהלת ח-ב.
  'ניכויים': 'deductions', 'deductions': 'deductions',
  'דוח שנתי': 'annual_report', 'דו"ח שנתי': 'annual_report',
  'מאזן': 'annual_report', 'annual_report': 'annual_report',
  'annual_financials': 'annual_report',
  'ביטוח לאומי': 'national_insurance', 'בט"ל': 'national_insurance',
  'national_insurance': 'national_insurance',
  // 'קליטה להנה"ח' is RECORDING completed payroll into bookkeeping
  // ("רישום פקודות") — low-priority follow-up work, NOT real client
  // onboarding. It used to be silently bucketed as `client_onboarding`
  // because the loose prefix-match collapsed `'קליטה'` into the same
  // bucket. Now it's its own bucket and it's marked LOW_PRIORITY below
  // so the home map doesn't paint it red as overdue/urgent.
  'קליטה להנה"ח': 'payroll_recording',
  'קליטה להנה״ח': 'payroll_recording',
  'payroll_closing': 'payroll_recording',
  'bookkeeping_recording': 'payroll_recording',
  // Real onboarding only (NOT the loose 'קליטה' prefix that used to
  // accidentally swallow 'קליטה להנה"ח').
  'קליטת לקוח': 'client_onboarding',
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
  deductions: 'ניכויים',
  // Made the low-priority nature of "קליטה להנה"ח" visible in the label
  // so it can't be mistaken for urgent reporting work at a glance.
  payroll_recording: 'רישום פקודות (לא דחוף)',
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

// Buckets the user explicitly tagged as "nice to have" — work that lands
// here may be technically overdue, but painting it red on the home map
// drowns out actually-urgent reporting work. The map skips the deadline
// halo + urgent-count badge for these buckets and shows a muted label
// so the bucket still appears in counts but doesn't compete for attention.
const LOW_PRIORITY_DOMAINS = new Set(['payroll_recording']);

// Hebrew month names for the per-month chip in the drawer header.
const HEBREW_MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];
function formatHebrewMonth(yyyymm) {
  if (!yyyymm || yyyymm === 'unknown') return yyyymm;
  const [y, mm] = String(yyyymm).split('-');
  const idx = parseInt(mm, 10) - 1;
  if (idx < 0 || idx > 11) return yyyymm;
  return `${HEBREW_MONTH_NAMES[idx]} ${y}`;
}

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
    // ממתין לרישום בהנה"ש (awaiting_recording) is the post-payment phase
    // for authority tasks — by the user's framing, it's the same kind of
    // "follow-up recording" work as קליטה להנה"ח and belongs in the same
    // low-priority circle on the home map (so the act of recording into
    // bookkeeping has a single visual home, regardless of whether the
    // record is a payroll line or a VAT/ניכויים confirmation).
    if (task.status === 'awaiting_recording' || task.status === 'reported_waiting_for_payment_pending_record') {
      const normalized = 'payroll_recording';
      if (!groups.has(normalized)) {
        groups.set(normalized, {
          normalized_key: normalized,
          label: LABEL_MAP[normalized] || 'רישום פקודות',
          tasks: [],
        });
      }
      groups.get(normalized).tasks.push(task);
      return;
    }

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
// Geometry is fixed (viewBox) so the SVG scales cleanly on any
// screen width without the circles colliding or the labels clipping.
// Home is now map-only (no focus-tab grid below) so the map can take
// more vertical space and breathe; the viewBox is widened a bit and the
// ring radius pushed out so labels don't crowd the centre hub.
// Bumped further per user request: more breathing room between the hub
// and the rim, so circles stop crowding each other at 9-domain layouts.
const VIEW_WIDTH = 720;
const VIEW_HEIGHT = 480;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const RING_RADIUS = 180; // distance from centre to each group circle
const HUB_RADIUS = 44;   // size of the central hub
const LABEL_OFFSET = 12; // gap between circle edge and its label box

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
  // ADHD-accessibility: hovering a segment thickens it via CSS (`:hover`)
  // — the segment briefly enlarges so the workflow stage is easier to spot.
  // Implemented with stroke-width transitions, no React state, so this is
  // safe to render dozens of times across the AyoaMiniMap circles.
  if (!statusBuckets || !total) return null;
  // Build an ordered list of present statuses with their fraction
  const present = STATUS_RING_ORDER
    .map((s) => ({ status: s, count: statusBuckets[s] || 0 }))
    .filter((b) => b.count > 0);
  if (present.length === 0) return null;

  const RING_OFFSET = 6;          // distance from circle stroke to ring
  const RING_RADIUS = r + RING_OFFSET;
  const BASE_STROKE = 3.5;
  const HOVER_STROKE = 8;         // thickened width on hover
  const GAP = present.length > 1 ? 0.06 : 0;  // small gap (radians) between segments

  // Single-status fast-path: a clean closed ring (two semicircles).
  if (present.length === 1) {
    const only = present[0];
    const label = STATUS_CONFIG[only.status]?.label || only.status;
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={RING_RADIUS}
          fill="none"
          stroke={STATUS_RING_COLORS[only.status] || '#CBD5E1'}
          strokeWidth={BASE_STROKE}
          strokeOpacity={0.85}
          className="ayoa-status-ring-segment"
          style={{ '--seg-base': `${BASE_STROKE}`, '--seg-hover': `${HOVER_STROKE}`, transition: 'stroke-width 0.15s ease, stroke-opacity 0.15s ease', cursor: 'pointer' }}
        >
          <title>{`${label} — ${only.count} משימות`}</title>
        </circle>
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
    const label = STATUS_CONFIG[status]?.label || status;
    segments.push(
      <path
        key={status}
        d={`M ${x1} ${y1} A ${RING_RADIUS} ${RING_RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`}
        stroke={STATUS_RING_COLORS[status] || '#CBD5E1'}
        strokeWidth={BASE_STROKE}
        strokeLinecap="round"
        fill="none"
        className="ayoa-status-ring-segment"
        style={{ '--seg-base': `${BASE_STROKE}`, '--seg-hover': `${HOVER_STROKE}`, transition: 'stroke-width 0.15s ease', cursor: 'pointer' }}
      >
        <title>{`${label} — ${count} משימות`}</title>
      </path>
    );
    cursor = endA + GAP;
  });
  // No pointerEvents:none here — segments need hover to surface their <title>
  // tooltips. Click bubbles up to the parent <g> so the drawer still opens.
  return <g>{segments}</g>;
}

function AyoaCircle({ cx, cy, r, color, label, count, urgent, angle, onClick, statusBuckets, urgency, urgentCount, lowPriority }) {
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

  const overdueCount = urgency?.overdue || 0;
  const todayCount = urgency?.today || 0;
  const soonCount = urgency?.soon || 0;
  const totalUrgent = urgentCount || 0;
  const hasOverdue = overdueCount > 0;

  // Build a human-readable summary for the urgency tooltip.
  const urgencySummary = (() => {
    if (!totalUrgent) return null;
    const parts = [];
    if (overdueCount) parts.push(`${overdueCount} באיחור`);
    if (todayCount) parts.push(`${todayCount} היום`);
    if (soonCount) parts.push(`${soonCount} ב-3 ימי עבודה הקרובים`);
    return parts.join(' · ');
  })();

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKey}
      aria-label={`${label} — ${count} משימות${urgent ? ', כולל משימה דחופה' : ''}${urgencySummary ? `, ${urgencySummary}` : ''}`}
    >
      {/* Soft halo behind circles that need attention this work-week.
          Red = at least one task is overdue (past its deadline).
          Orange = no overdue but tasks are due in the next 3 working days.
          The halo sits outside the status ring so it doesn't fight the
          per-status color cues.
          Low-priority buckets (e.g. רישום פקודות) skip the halo entirely
          — those tasks are "nice to have" and shouldn't compete with
          actually-urgent reporting work. */}
      {!lowPriority && hasOverdue ? (
        <circle
          cx={cx}
          cy={cy}
          r={r + 12}
          fill="none"
          stroke="#EF4444"
          strokeWidth={2.5}
          strokeOpacity={0.45}
          strokeDasharray="4 3"
          style={{ pointerEvents: 'none' }}
        >
          <title>{`${overdueCount} משימות באיחור${todayCount ? ` · ${todayCount} להיום` : ''}${soonCount ? ` · ${soonCount} ב-3 ימי עבודה הקרובים` : ''}`}</title>
        </circle>
      ) : !lowPriority && (todayCount > 0 || soonCount > 0) ? (
        <circle
          cx={cx}
          cy={cy}
          r={r + 12}
          fill="none"
          stroke="#F97316"
          strokeWidth={2.5}
          strokeOpacity={0.4}
          strokeDasharray="4 3"
          style={{ pointerEvents: 'none' }}
        >
          <title>{`${todayCount ? `${todayCount} להיום` : ''}${todayCount && soonCount ? ' · ' : ''}${soonCount ? `${soonCount} ב-3 ימי עבודה הקרובים` : ''}`.trim()}</title>
        </circle>
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={2}
      >
        <title>
          {`${label} — ${count} משימות${urgencySummary ? `\n${urgencySummary}` : ''}`}
        </title>
      </circle>
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
      {urgent && !lowPriority && (
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
      {/* Compact deadline-urgency badge — top-LEFT corner of the circle
          (top-RIGHT is reserved for the priority=urgent dot). Red filled
          when something is overdue, orange when only "soon" (next 3 working
          days). Number is the total urgent count; hover the badge for the
          detailed breakdown. Suppressed for low-priority buckets. */}
      {!lowPriority && totalUrgent > 0 && (
        <g>
          <circle
            cx={cx - r * 0.7}
            cy={cy - r * 0.7}
            r={Math.max(9, Math.min(11, r * 0.4))}
            fill={hasOverdue ? '#EF4444' : '#F97316'}
            stroke="#FFFFFF"
            strokeWidth={2}
          >
            <title>{`דחוף — ${urgencySummary || ''}`}</title>
          </circle>
          <text
            x={cx - r * 0.7}
            y={cy - r * 0.7 + 3.5}
            textAnchor="middle"
            fontSize={r > 28 ? 11 : 10}
            fontWeight={800}
            fill="#FFFFFF"
            style={{ fontFamily: 'Heebo, sans-serif', pointerEvents: 'none' }}
          >
            {totalUrgent}
          </text>
        </g>
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
  clients = [],
  onGroupClick,
  onStatusChange,
  onEditTask,
  onPaymentDateChange,
  onNote,
  onToggleStep,
  onDateChange,
  onSubTaskChange,
  onAttachmentUpdate,
  // When the map is the page focal point (e.g. /MindMap) the caller can
  // pass a larger maxWidth (or null for "fill"). Default keeps Home tidy.
  maxWidth = '1000px',
  title = 'מפה לפי תחומי שירות',
}) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState({});
  const navigate = useNavigate();

  const clientByName = useMemo(() => {
    const map = {};
    (clients || []).forEach((c) => { if (c?.name) map[c.name] = c; });
    return map;
  }, [clients]);

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
      const s = getEffectiveStatus(task, clientByName[task.client_name] || null);
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(task);
    });
    return Object.fromEntries(
      STATUS_ORDER.filter((s) => grouped[s]).map((s) => [s, grouped[s]])
    );
  }, [drawerTasks, selectedGroup]);

  // Group drawer tasks TWO levels: first by service template, then within
  // each service by reporting_month. The drawer renders one
  // GroupedServiceTable per (service, month) pair with a clear header
  // showing both — so the user can see at a glance "מס\"ב ספקים ·
  // אפריל 2026 (5)" vs "מס\"ב ספקים · מרץ 2026 (3)" instead of one
  // undifferentiated lump labelled by service alone.
  // Display order: current reporting month first, then past months
  // (oldest first → "stuck longest" at top of leftover), then future,
  // then unknown. Inside each section, clients sorted alphabetically.
  const drawerByServiceAndMonth = useMemo(() => {
    if (!selectedGroup) return [];
    const today = new Date();
    const currentRm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // service-key → { service, byMonth: Map<rm, tasks[]> }
    const buckets = new Map();
    drawerTasks.forEach((task) => {
      const svc = getServiceForTask(task);
      const key = svc?.key || 'other';
      if (!buckets.has(key)) {
        buckets.set(key, {
          service: svc || {
            key: 'other',
            label: 'משימות אחרות',
            taskCategories: [],
            steps: [],
            taskType: 'linear',
          },
          byMonth: new Map(),
        });
      }
      const rm = (task.reporting_month && /^\d{4}-\d{2}/.test(task.reporting_month))
        ? task.reporting_month.slice(0, 7)
        : 'unknown';
      const monthMap = buckets.get(key).byMonth;
      if (!monthMap.has(rm)) monthMap.set(rm, []);
      monthMap.get(rm).push(task);
    });

    const sortedSections = [];
    for (const { service, byMonth } of buckets.values()) {
      const monthKeys = [...byMonth.keys()].sort((a, b) => {
        if (a === b) return 0;
        if (a === 'unknown') return 1;
        if (b === 'unknown') return -1;
        if (a === currentRm) return -1;
        if (b === currentRm) return 1;
        const aPast = a < currentRm;
        const bPast = b < currentRm;
        if (aPast && !bPast) return -1;            // overdue before future
        if (!aPast && bPast) return 1;
        if (aPast && bPast) return a.localeCompare(b);  // oldest leftover first
        return a.localeCompare(b);                       // earliest future first
      });
      for (const month of monthKeys) {
        const svcTasks = byMonth.get(month);
        sortedSections.push({
          service,
          month,
          monthLabel: month === 'unknown' ? 'ללא חודש דיווח' : formatHebrewMonth(month),
          isCurrent: month === currentRm,
          isLeftover: month !== 'unknown' && month < currentRm,
          isFuture: month !== 'unknown' && month > currentRm,
          clientRows: svcTasks
            .map((task) => ({
              clientName: task.client_name || 'ללא לקוח',
              task,
              client: clientByName[task.client_name] || null,
            }))
            .sort((a, b) => a.clientName.localeCompare(b.clientName, 'he')),
        });
      }
    }
    return sortedSections;
  }, [drawerTasks, selectedGroup, clientByName]);

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

  // Reporting months represented in the drawer's tasks, with a count per
  // month. Shown in the header so the user immediately knows whether
  // she's looking at one month, two months mixed (typical leftover +
  // current-month case), or "all months". Sorted: current first, then
  // descending by date (newest leftover before oldest).
  const drawerMonthsBreakdown = useMemo(() => {
    if (!selectedGroup) return [];
    const counts = new Map();
    drawerTasks.forEach((t) => {
      const m = (t.reporting_month && /^\d{4}-\d{2}/.test(t.reporting_month))
        ? t.reporting_month.slice(0, 7)
        : 'unknown';
      counts.set(m, (counts.get(m) || 0) + 1);
    });
    const today = new Date();
    const currentRm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return [...counts.entries()]
      .sort(([a], [b]) => {
        if (a === b) return 0;
        if (a === 'unknown') return 1;
        if (b === 'unknown') return -1;
        if (a === currentRm) return -1;
        if (b === currentRm) return 1;
        return b.localeCompare(a);
      })
      .map(([month, count]) => ({ month, count, isCurrent: month === currentRm }));
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
  // Today + the date that is 3 working days ahead (skipping Fri/Sat/holidays).
  // Anything strictly after today and on-or-before this anchor counts as
  // "soon" — i.e. needs attention this work-week.
  const todayStr = new Date().toISOString().slice(0, 10);
  const threeWorkDaysAhead = getWorkDaysAfter(todayStr, 3);

  const totalTasks = groups.reduce((sum, g) => sum + g.tasks.length, 0);
  const placedGroups = groups.map((group, i) => {
    const pos = computeRadialPosition(i, groups.length);
    const r = Math.min(34, Math.max(18, group.tasks.length * 4));
    // Status breakdown for the ring around the circle. Legacy statuses are
    // remapped via migrateStatus so the buckets always match STATUS_RING_COLORS.
    const statusBuckets = {};
    group.tasks.forEach((t) => {
      const s = getEffectiveStatus(t, clientByName[t.client_name] || null);
      statusBuckets[s] = (statusBuckets[s] || 0) + 1;
    });
    // Deadline urgency breakdown. The user can't tell from a status-only ring
    // whether the work is "soon" or "still has 2 weeks", so we surface a
    // separate dot/badge for "needs attention now". Comparison uses ISO
    // YYYY-MM-DD strings (lexicographic = chronological) so we don't need
    // to spin up Date objects per task.
    const urgency = { overdue: 0, today: 0, soon: 0 };  // soon = up to 3 working days ahead
    const lowPriority = LOW_PRIORITY_DOMAINS.has(group.normalized_key);
    if (!lowPriority) {
      group.tasks.forEach((t) => {
        // Skip tasks that have already left the active workflow.
        // Uses effective status so a stale "not_started" task whose steps
        // already say "awaiting_recording" doesn't get flagged as overdue.
        const eff = getEffectiveStatus(t, clientByName[t.client_name] || null);
        if (eff === 'production_completed' || eff === 'awaiting_recording') return;
        const due = (t.due_date || '').slice(0, 10);
        if (!due) return;
        if (due < todayStr) urgency.overdue += 1;
        else if (due === todayStr) urgency.today += 1;
        else if (due <= threeWorkDaysAhead) urgency.soon += 1;
      });
    }
    const urgentCount = urgency.overdue + urgency.today + urgency.soon;
    return { ...group, ...pos, r, statusBuckets, urgency, urgentCount, lowPriority };
  });

  return (
    <div
      dir="rtl"
      className="rounded-2xl"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #EEF1F5',
        padding: '8px 12px',
        fontFamily: 'Heebo, sans-serif',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold" style={{ color: '#1A2332' }}>
          {title}
        </h3>
        <span className="text-[11px]" style={{ color: '#9AA5B4' }}>
          {groups.length} תחומים · לחצי על עיגול
        </span>
      </div>
      {/* Home is map-only, so the map gets the page. maxWidth bumped to
          1000px so on wide screens it stops looking like a small widget
          and reads as the actual focal point. height stays in CSS (not
          the SVG attribute, which only accepts numeric/length values)
          to avoid console warnings. */}
      <svg
        width="100%"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          display: 'block',
          ...(maxWidth ? { maxWidth } : {}),
          margin: '0 auto',
          height: 'auto',
        }}
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
            urgency={group.urgency}
            urgentCount={group.urgentCount}
            lowPriority={group.lowPriority}
            onClick={() => handleClick(group)}
          />
        ))}
      </svg>
      {/* Status + urgency legend — first line explains the OUTER ring colors
          (workflow stage), second line explains the URGENCY badge/halo
          (deadline pressure). Only statuses that actually appear among the
          visible groups are listed in the first row, to keep things tight. */}
      {(() => {
        const present = new Set();
        let anyOverdue = false;
        let anySoon = false;
        placedGroups.forEach((g) => {
          Object.keys(g.statusBuckets || {}).forEach((s) => present.add(s));
          if (g.urgency?.overdue > 0) anyOverdue = true;
          if (g.urgency?.today > 0 || g.urgency?.soon > 0) anySoon = true;
        });
        if (present.size === 0) return null;
        const items = STATUS_RING_ORDER.filter((s) => present.has(s));
        return (
          <div className="mt-2 px-1" style={{ fontSize: '10.5px' }}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
            {(anyOverdue || anySoon) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1" style={{ color: '#64748B' }}>
                {anyOverdue && (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block rounded-full"
                      style={{ width: '8px', height: '8px', backgroundColor: '#EF4444' }}
                    />
                    דחוף — באיחור
                  </span>
                )}
                {anySoon && (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block rounded-full"
                      style={{ width: '8px', height: '8px', backgroundColor: '#F97316' }}
                    />
                    דחוף — היום / 3 ימי עבודה הקרובים
                  </span>
                )}
              </div>
            )}
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
            {/* Per-month breakdown chip row — makes it obvious when a
                drawer is showing multiple months mixed (e.g. April current
                + March leftover). Without this the user couldn't tell
                which month each section belongs to. */}
            {drawerMonthsBreakdown.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 flex-wrap mt-1">
                {drawerMonthsBreakdown.map(({ month, count, isCurrent }) => (
                  <span
                    key={month}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: month === 'unknown'
                        ? '#F1F5F9'
                        : isCurrent ? '#ECFDF5' : '#FEF3C7',
                      color: month === 'unknown'
                        ? '#475569'
                        : isCurrent ? '#065F46' : '#92400E',
                      border: `1px solid ${month === 'unknown' ? '#E2E8F0' : isCurrent ? '#A7F3D0' : '#FCD34D'}`,
                    }}
                  >
                    {month === 'unknown'
                      ? `ללא חודש (${count})`
                      : `${formatHebrewMonth(month)} · ${count}`}
                    {isCurrent ? ' · החודש' : ''}
                  </span>
                ))}
              </div>
            )}
            {drawerClientNames.length > 0 && (
              <div className="text-xs text-slate-400 text-center mt-1">
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
            className="px-4 pb-6 max-h-[80vh] overflow-y-auto"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            {/* Full row UI — same GroupedServiceTable that PayrollReportsDashboard
                / TaxReportsDashboard / PayrollDashboard render in their tab
                bodies. The drawer therefore behaves like a focused mini
                dashboard for the selected service domain: per-step circles,
                inline status select, notes, attachments. The outer wrapper
                mirrors the dashboards' rounded border-card so the drawer
                renders the table identically. */}
            {drawerByServiceAndMonth.map(({ service, month, monthLabel, isCurrent, isLeftover, isFuture, clientRows }) => {
              // Per-section header: service name + reporting month, color-
              // coded by recency. Lets the user instantly tell apart
              // "מס\"ב ספקים · אפריל 2026 (5)" from "מס\"ב ספקים ·
              // מרץ 2026 (3)" without parsing rows.
              const palette = isCurrent
                ? { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', tag: 'החודש' }
                : isLeftover
                  ? { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', tag: 'נשאר מחודש קודם' }
                  : isFuture
                    ? { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', tag: 'עתידי' }
                    : { bg: '#F1F5F9', border: '#E2E8F0', text: '#475569', tag: '' };
              return (
                <div key={`${service.key}__${month}`} className="mb-5">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-t-xl border border-b-0"
                    style={{ backgroundColor: palette.bg, borderColor: palette.border }}
                  >
                    <span className="text-[13px] font-extrabold" style={{ color: palette.text }}>
                      {service.label}
                    </span>
                    <span className="text-[12px]" style={{ color: palette.text, opacity: 0.7 }}>·</span>
                    <span className="text-[13px] font-semibold" style={{ color: palette.text }}>
                      {monthLabel}
                    </span>
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: '#FFFFFF', color: palette.text, border: `1px solid ${palette.border}` }}
                    >
                      {clientRows.length}
                    </span>
                    {palette.tag && (
                      <span className="text-[11px] font-semibold mr-auto" style={{ color: palette.text }}>
                        {palette.tag}
                      </span>
                    )}
                  </div>
                  <div className="border border-t-0 border-[#E0E0E0] rounded-b-xl overflow-hidden">
                    <GroupedServiceTable
                      service={service}
                      clientRows={clientRows}
                      allTasks={tasks}
                      onToggleStep={onToggleStep || (() => {})}
                      onDateChange={onDateChange || (() => {})}
                      onStatusChange={(task, newStatus) => handleRowStatusChange(task, newStatus)}
                      onPaymentDateChange={onPaymentDateChange || (() => {})}
                      onSubTaskChange={onSubTaskChange || (() => {})}
                      onAttachmentUpdate={onAttachmentUpdate || (() => {})}
                      getClientIds={() => []}
                      onEdit={onEditTask || (() => {})}
                      onDelete={null}
                      onNote={onNote || (() => {})}
                      bulkMode={false}
                      selectedTaskIds={new Set()}
                      onToggleSelect={() => {}}
                    />
                  </div>
                </div>
              );
            })}
            {/* Legacy status-grouped fallback view — kept only when nothing
                resolves to a service template (raw home tasks etc.). */}
            {drawerByServiceAndMonth.length === 0 && Object.entries(drawerTasksByStatus).map(([status, statusTasks]) => {
              const statusCfg = TASK_STATUS_CONFIG[status];
              return (
                <div key={status} className="mb-3">
                  <div className="text-xs font-bold text-slate-500 mb-1.5 px-1">
                    {statusCfg?.text || status} ({statusTasks.length})
                  </div>
                  {statusTasks.map((task) => {
                    const cfg = TASK_STATUS_CONFIG[getEffectiveStatus(task)];
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
                                value={getEffectiveStatus(task)}
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
