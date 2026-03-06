import React, { useMemo, useState, useCallback, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Cloud, Inbox, GripVertical, X, Sparkles, Plus, Calendar, CheckCircle, Edit3, ExternalLink, Maximize2, Minimize2, ZoomIn, ZoomOut, Move, Pencil, ChevronDown, GitBranchPlus, SlidersHorizontal, Star, Trash2, Check, RefreshCw } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Task, Client } from '@/api/entities';
// dedupTasksForMonth, wipeAllTasksForMonth, generateProcessTasks removed — v15 uses deleteAll()
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { TASK_STATUS_CONFIG as statusConfig } from '@/config/processTemplates';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';
import TaskEditDialog from '@/components/tasks/TaskEditDialog';
import { computeComplexityTier, getBubbleRadius, getTierInfo } from '@/lib/complexity';
import { COMPLEXITY_TIERS } from '@/lib/theme-constants';
import { buildCollisionNodes, resolveCollisions } from '@/engines/mapCollisionEngine';

// ─── Zero-Panic Palette (Cyan/Teal — NO RED, NO GRAY) ───────────────────
const ZERO_PANIC = {
  orange:  '#00acc1',  // Cyan for focus (Due Today / Critical)
  purple:  '#008291',  // Teal for importance (Overdue / Late)
  green:   '#2E7D32',  // Done
  blue:    '#008291',  // Teal — Active / In Progress
  gray:    '#455A64',  // Zero Gray Policy: dark slate instead of light gray
  amber:   '#FF8F00',  // Waiting / Issue
  teal:    '#008291',  // Primary teal
  cyan:    '#00acc1',  // Secondary cyan
  indigo:  '#3949AB',  // Ready for Reporting
};

// 5 Golden Statuses — Zero Gray: vivid colors only
const STATUS_TO_COLOR = {
  waiting_for_materials:  ZERO_PANIC.amber,    // ממתין לחומרים — amber
  not_started:            '#1565C0',           // לבצע — vivid blue (Zero Gray)
  sent_for_review:        '#AB47BC',           // הועבר לעיון — purple
  needs_corrections:      '#F97316',           // לבצע תיקונים — orange
  production_completed:   ZERO_PANIC.green,    // הושלם ייצור — bright green
};

// Status labels for bubble display (Iron Rule: must match table exactly)
const STATUS_LABELS = {
  waiting_for_materials:  'ממתין לחומרים',
  not_started:            'לבצע',
  sent_for_review:        'הועבר לעיון',
  needs_corrections:      'לבצע תיקונים',
  production_completed:   'הושלם ייצור',
};

// Priority for worst-status-wins (higher = worse = more urgent)
const STATUS_URGENCY = {
  production_completed:   0,
  not_started:            1,
  sent_for_review:        2,
  needs_corrections:      3,
  waiting_for_materials:  4,
};

function getWorstClientStatus(clientTasks) {
  if (!clientTasks || clientTasks.length === 0) return 'not_started';
  const active = clientTasks.filter(t => t.status !== 'production_completed');
  if (active.length === 0) return 'production_completed';
  return active.reduce((worst, t) => {
    const wp = STATUS_URGENCY[worst] ?? 1;
    const cp = STATUS_URGENCY[t.status] ?? 1;
    return cp > wp ? t.status : worst;
  }, 'production_completed');
}

// Cascade-aware color overrides for client nodes (Zero Gray: no slate/gray)
const NODE_COLOR_MAP = {
  emerald: '#2E7D32',
  blue:    '#1565C0',
  amber:   '#FF8F00',
  teal:    '#00897B',
  sky:     '#0288D1',
  slate:   '#455A64',
};

// ─── P1-P4 Process Tree: 4 branches aligned to sidebar hierarchy ───────────
// Root → Meta-Folder (4 hexagons) → Department → Client Leaves
// ZERO GHOST DATA: No ביטוח לאומי / ניכויים standalone branches
// Only 3 task-generating services: שכר, מע"מ, מקדמות מס
const META_FOLDERS = {
  'P1 חשבות שכר': {
    icon: '👥', color: '#0277BD', label: 'P1 | חשבות שכר',
    departments: ['שכר'],
    complexitySubFolders: true,
  },
  'P2 הנהלת חשבונות': {
    icon: '📊', color: '#00838F', label: 'P2 | הנהלת חשבונות',
    departments: ['מע"מ', 'מקדמות', 'התאמות'],
    complexitySubFolders: true,
  },
  'P3 ניהול משרד': {
    icon: '📁', color: '#546E7A', label: 'P3 | ניהול משרד',
    departments: ['אדמיניסטרציה', 'אחר/טיוטות'],
    complexitySubFolders: true,
  },
  'P4 בית': {
    icon: '🏠', color: '#6D4C41', label: 'P4 | בית',
    departments: ['בית'],
    forceNano: true,
  },
};

// Department folder nodes — only real departments (no ghost SS/Deductions branches)
const BRANCH_CONFIG = {
  'שכר':              { color: '#0277BD', icon: '👥', label: 'שכר' },
  'מע"מ':             { color: '#00838F', icon: '📊', label: 'מע"מ' },
  'מקדמות':           { color: '#00838F', icon: '💰', label: 'מקדמות מס' },
  'התאמות':           { color: '#00695C', icon: '🔄', label: 'התאמות חשבונות' },
  'אדמיניסטרציה':     { color: '#546E7A', icon: '📁', label: 'אדמיניסטרציה' },
  'בית':              { color: '#6D4C41', icon: '🏠', label: 'בית' },
  'אחר/טיוטות':       { color: '#78909C', icon: '📝', label: 'אחר/טיוטות' },
};

// Diamond Standard: 3 tiers with fixed vivid colors (Zero Gray Policy)
// ננו = תכלת (Light Cyan), בינוני = טורקיז חי (Teal), גדול = כחול עמוק (Deep Blue)
const DIAMOND_COLORS = {
  0: '#00acc1',  // ננו — תכלת
  1: '#00838F',  // בינוני — טורקיז חי (Teal)
  2: '#01579B',  // גדול — כחול עמוק
};
const COMPLEXITY_SUB_LABELS = {
  0: { key: 'ננו', icon: '⚡', label: 'ננו', color: DIAMOND_COLORS[0] },
  1: { key: 'בינוני', icon: '📦', label: 'בינוני', color: DIAMOND_COLORS[1] },
  2: { key: 'גדול', icon: '🏢', label: 'גדול', color: DIAMOND_COLORS[2] },
};

// ── FUNCTION BUCKETS: 3 functional sub-categories under each tier diamond ──
const FUNCTION_BUCKETS = {
  production: { key: 'production', label: 'ייצור', icon: '⚙️', color: '#1565C0' },
  reports:    { key: 'reports',    label: 'דיווחים', icon: '📋', color: '#00838F' },
  services:   { key: 'services',   label: 'שירותים', icon: '🔧', color: '#6D4C41' },
};
const FUNCTION_BUCKET_ORDER = ['production', 'reports', 'services'];

// ── CATEGORY → FUNCTION BUCKET: determines which bubble a task belongs to ──
// Iron Rule: ביטוח לאומי / מע"מ / ניכויים → דיווחים (reports)
//            הכנת שכר / ליתאי              → ייצור (production)
//            everything else                → שירותים (services)
const CATEGORY_TO_FUNCTION = {
  // Reports (דיווחים)
  'ביטוח לאומי':       'reports',
  'work_social_security': 'reports',
  'מע"מ':              'reports',
  'work_vat_reporting': 'reports',
  'מע"מ 874':          'reports',
  'work_vat_874':       'reports',
  'ניכויים':           'reports',
  'work_deductions':    'reports',
  'מקדמות מס':         'reports',
  'work_tax_advances':  'reports',
  'תשלום רשויות':      'reports',
  'work_authorities_payment': 'reports',
  'דיווח למתפעל':      'reports',
  'work_operator_reporting': 'reports',
  'דיווח לטמל':        'reports',
  'work_taml_reporting': 'reports',
  // Production (ייצור)
  'שכר':               'production',
  'work_payroll':       'production',
  'הכנת שכר':          'production',
  'ליתאי':             'production',
  'התאמות':            'production',
  'work_reconciliation': 'production',
  'הנהלת חשבונות':     'production',
  'work_bookkeeping':   'production',
  'מאזנים':            'production',
  'מאזן':              'production',
  'דוח שנתי':          'production',
  'work_annual_reports': 'production',
  'רווח והפסד':        'production',
  'work_pnl':           'production',
  // Services (שירותים) — MASAV, consulting, admin, marketing
  'מס"ב סוציאליות':    'services',
  'work_masav_social':  'services',
  'מס"ב רשויות':       'services',
  'work_masav_authorities': 'services',
  'מס"ב ספקים':        'services',
  'work_masav_suppliers': 'services',
  'מס"ב עובדים':       'services',
  'work_masav':         'services',
  'משלוח תלושים':      'services',
  'work_payslip_sending': 'services',
  'סוציאליות':         'services',
  'work_social_benefits': 'services',
  'מילואים':           'services',
  'work_reserve_claims': 'services',
  'הנחיות מס"ב ממתפעל': 'services',
  'ייעוץ':             'services',
  'work_consulting':    'services',
  'מעקב שיווק':        'services',
  'work_marketing':     'services',
  'לחזור ללקוח':       'services',
  'work_callback':      'services',
  'פגישה':             'services',
  'work_meeting':       'services',
  'כללי':              'services',
  'work_general':       'services',
  'אדמיניסטרציה':      'services',
  'work_admin':         'services',
  'work_client_management': 'services',
};

// Map ALL task categories to P1-P4 department keys
// ZERO GHOST DATA: SS/Deductions route to שכר (payroll sub-steps, not standalone)
const CATEGORY_TO_DEPARTMENT = {
  // P1 — Payroll (שכר + sub-steps + MASAV payroll)
  'שכר': 'שכר',
  'work_payroll': 'שכר',
  'ביטוח לאומי': 'שכר',           // payroll sub-step, not standalone
  'work_social_security': 'שכר',   // payroll sub-step, not standalone
  'ניכויים': 'שכר',               // payroll sub-step, not standalone
  'work_deductions': 'שכר',       // payroll sub-step, not standalone
  'מס"ב עובדים': 'שכר',           // MASAV employees → payroll
  'work_masav': 'שכר',
  'מס"ב סוציאליות': 'שכר',        // MASAV social → payroll
  'work_masav_social': 'שכר',
  'סוציאליות': 'שכר',
  'work_social_benefits': 'שכר',
  'משלוח תלושים': 'שכר',          // payslip sending → payroll
  'work_payslip_sending': 'שכר',
  'הנחיות מס"ב ממתפעל': 'שכר',    // operator MASAV instructions → payroll
  // P2 — Bookkeeping (VAT + Advances + Reconciliations + Authorities)
  'מע"מ': 'מע"מ',
  'work_vat_reporting': 'מע"מ',
  'מע"מ 874': 'מע"מ',
  'work_vat_874': 'מע"מ',
  'מקדמות מס': 'מקדמות',
  'work_tax_advances': 'מקדמות',
  'התאמות': 'התאמות',
  'work_reconciliation': 'התאמות',
  'הנחש': 'התאמות',
  'הנהלת חשבונות': 'התאמות',
  'work_bookkeeping': 'התאמות',
  'מאזנים': 'התאמות',             // annual — routes to reconciliation branch
  'מאזן': 'התאמות',
  'דוח שנתי': 'אדמיניסטרציה',     // annual tasks → admin (not monthly recurring)
  'work_annual_reports': 'אדמיניסטרציה',
  'רווח והפסד': 'התאמות',
  'work_pnl': 'התאמות',
  'תשלום רשויות': 'מע"מ',         // authorities payment → VAT/bookkeeping branch
  'work_authorities_payment': 'מע"מ',
  'מס"ב רשויות': 'מע"מ',          // MASAV authorities → bookkeeping
  'work_masav_authorities': 'מע"מ',
  'מס"ב ספקים': 'מע"מ',           // MASAV suppliers → bookkeeping
  'work_masav_suppliers': 'מע"מ',
  'דיווח למתפעל': 'מע"מ',         // operator reporting → bookkeeping
  'work_operator_reporting': 'מע"מ',
  'דיווח לטמל': 'מע"מ',           // TAML reporting → bookkeeping
  'work_taml_reporting': 'מע"מ',
  'מילואים': 'שכר',               // reserve claims → payroll
  'work_reserve_claims': 'שכר',
  // P3 — Office (admin, consulting, marketing, meetings)
  'work_client_management': 'אדמיניסטרציה',
  'personal': 'אדמיניסטרציה',
  'אחר': 'אדמיניסטרציה',
  'אדמיניסטרציה': 'אדמיניסטרציה',
  'work_admin': 'אדמיניסטרציה',
  'ייעוץ': 'אדמיניסטרציה',
  'work_consulting': 'אדמיניסטרציה',
  'מעקב שיווק': 'אדמיניסטרציה',
  'work_marketing': 'אדמיניסטרציה',
  'לחזור ללקוח': 'אדמיניסטרציה',
  'work_callback': 'אדמיניסטרציה',
  'פגישה': 'אדמיניסטרציה',
  'work_meeting': 'אדמיניסטרציה',
  'כללי': 'אדמיניסטרציה',
  'work_general': 'אדמיניסטרציה',
  // P4 — Home
  'home': 'בית',
};

// ─── Node Scaling by Complexity Tier (3:1 ratio from Enterprise to Nano) ──
// Base radius: tier 0 (Nano) = 22px → tier 3 (Complex) = 66px  (3:1)
// Wide screen base: 30px → tier 3 = 90px
const BASE_RADIUS = 28;
const BASE_RADIUS_WIDE = 36;

// Legacy S/M/L kept for tooltip display only
const SIZE_LABELS = { 0: 'ננו', 1: 'פשוט', 2: 'בינוני', 3: 'מורכב' };

/**
 * 3-tier classification for MindMap display:
 *   ננו (0): small clients (< 5 employees, < 20 min/month)
 *   בינוני (1): medium clients (< 15 employees, < 30 min/month)
 *   גדול (2): large/complex clients (15+ employees OR 45+ min/month)
 *
 * Uses computeComplexityTier() from complexity.js which reads:
 *   - client.complexity_level (manual override)
 *   - client.employee_count
 *   - client.business_info.estimated_monthly_hours
 *
 * Falls back to task count if no client data available.
 * Clamps tier 3 (מורכב) → tier 2 (גדול) for 3-tier MindMap display.
 */
function getComplexityTier(client, tasks) {
  if (!client) {
    // No client record — use task count heuristic
    const taskCount = tasks.length;
    return taskCount >= 6 ? 2 : taskCount >= 3 ? 1 : 0;
  }
  // Use the canonical complexity computation from complexity.js
  // (now has smart fallback for clients with no employee/hours data)
  const rawTier = computeComplexityTier(client);
  // Clamp to 0-2 for 3-tier MindMap display (tier 3 → tier 2)
  return Math.min(rawTier, 2);
}

function getNodeRadius(tier, isWide = false) {
  const base = isWide ? BASE_RADIUS_WIDE : BASE_RADIUS;
  return getBubbleRadius(tier, base);
}

function getNodeColor(task) {
  if (!task) return ZERO_PANIC.gray;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (task.status === 'production_completed') return ZERO_PANIC.green;

  // Overdue check
  if (task.due_date) {
    const due = new Date(task.due_date);
    due.setHours(23, 59, 59, 999);
    if (due < today) return ZERO_PANIC.purple;  // Overdue = purple

    // Due today
    const dueDay = new Date(task.due_date);
    dueDay.setHours(0, 0, 0, 0);
    if (dueDay.getTime() === today.getTime()) return ZERO_PANIC.orange;  // Due today = orange
  }

  return STATUS_TO_COLOR[task.status] || ZERO_PANIC.blue || '#455A64';
}

/**
 * Compute the aggregate color and visual state for a client node.
 * Priority: overdue > due today > pending_external > active > all completed
 * Returns { color, shouldPulse, completionRatio }
 */
function getClientAggregateState(clientTasks) {
  if (!clientTasks || clientTasks.length === 0) {
    return { color: '#1565C0', shouldPulse: false, completionRatio: 0, statusRing: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const active = clientTasks.filter(t => t.status !== 'production_completed');
  const completed = active.filter(t => t.status === 'production_completed').length;
  const total = active.length;
  const completionRatio = total > 0 ? completed / total : 0;

  // All completed = green (ADHD Focus: pushed to edges, statusRing 0 = outermost)
  if (total > 0 && completed === total) {
    return { color: ZERO_PANIC.green, shouldPulse: false, completionRatio: 1, statusRing: 0 };
  }

  // Priority: overdue > due today > pending_external > ready_for_reporting > active
  // statusRing: higher = closer to center (ADHD Focus)
  const hasOverdue = clientTasks.some(t => {
    if (t.status === 'production_completed') return false;
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    due.setHours(23, 59, 59, 999);
    return due < today;
  });
  if (hasOverdue) return { color: ZERO_PANIC.purple, shouldPulse: true, completionRatio, statusRing: 4 };

  const hasDueToday = clientTasks.some(t => {
    if (t.status === 'production_completed') return false;
    if (!t.due_date) return false;
    const dueDay = new Date(t.due_date);
    dueDay.setHours(0, 0, 0, 0);
    return dueDay.getTime() === today.getTime();
  });
  if (hasDueToday) return { color: ZERO_PANIC.orange, shouldPulse: false, completionRatio, statusRing: 4 };

  // 5 Golden Statuses priority: waiting_for_materials > needs_corrections > sent_for_review > not_started
  const hasWaiting = clientTasks.some(t => t.status === 'waiting_for_materials');
  if (hasWaiting) return { color: ZERO_PANIC.amber, shouldPulse: false, completionRatio, statusRing: 3 };

  const hasCorrections = clientTasks.some(t => t.status === 'needs_corrections');
  if (hasCorrections) return { color: '#F97316', shouldPulse: false, completionRatio, statusRing: 3 };

  const hasSentForReview = clientTasks.some(t => t.status === 'sent_for_review');
  if (hasSentForReview) return { color: '#AB47BC', shouldPulse: false, completionRatio, statusRing: 2 };

  const hasActive = clientTasks.some(t =>
    t.status !== 'production_completed'
  );
  if (hasActive) return { color: '#1565C0', shouldPulse: false, completionRatio, statusRing: 1 };

  return { color: ZERO_PANIC.green, shouldPulse: false, completionRatio, statusRing: 0 };
}

// Backwards-compatible wrapper
function getClientAggregateColor(clientTasks) {
  return getClientAggregateState(clientTasks).color;
}

// ─── Pan/Zoom Constants ──
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.12;

// ─── Persistence Key (outside component to avoid re-creation) ──
const POSITIONS_STORAGE_KEY = 'mindmap-positions';

// ─── Main Component ─────────────────────────────────────────────
export default function MindMapView({ tasks, clients, inboxItems = [], onInboxDismiss, focusMode = false, onEditTask, onTaskCreated, onStatusChange, focusTaskId = null, focusClientName = null, onFocusHandled }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const spacingMountGuard = useRef(false); // ← prevents spacing effect from wiping localStorage on mount
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 700 });
  const [editPopover, setEditPopover] = useState(null); // { client, x, y }
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [drawerClient, setDrawerClient] = useState(null);
  const [drawerDepartment, setDrawerDepartment] = useState(null); // department context for filtering
  const [drawerQuickAdd, setDrawerQuickAdd] = useState(false); // show QuickAddTaskDialog from drawer
  const [drawerEditTask, setDrawerEditTask] = useState(null); // task being edited via QuickAdd
  const [drawerSubTaskParent, setDrawerSubTaskParent] = useState(null); // for sub-task creation
  const [showDrawerCompleted, setShowDrawerCompleted] = useState(false);

  // ── Error State: Show reconnect when data fetch fails ──
  const [fetchError, setFetchError] = useState(null);
  useEffect(() => {
    // Detect data load failure: if tasks/clients is null/undefined (not empty array) → error
    if (tasks === null || tasks === undefined) {
      setFetchError('לא ניתן לטעון נתונים מהשרת');
    } else {
      setFetchError(null);
    }
  }, [tasks]);

  // ── NUCLEAR RESET v15: TOTAL PURGE — Delete ALL tasks ──
  // User will regenerate via "משימות חוזרות" module manually.
  // This runs ONCE, wipes everything, then the user controls task creation.
  const nuclearRan = useRef(false);
  useEffect(() => {
    const NUCLEAR_KEY = 'calmplan-nuclear-v15-total-purge';
    if (nuclearRan.current) return;
    try { if (localStorage.getItem(NUCLEAR_KEY) === 'true') return; } catch {}
    nuclearRan.current = true;

    (async () => {
      try {
        console.log('[CalmPlan] RESET v15: TOTAL PURGE — deleting ALL tasks...');
        await Task.deleteAll();
        console.log('[CalmPlan] RESET v15: All tasks deleted. Use "משימות חוזרות" to regenerate.');

        try { localStorage.setItem(NUCLEAR_KEY, 'true'); } catch {}
        // Clear stale manual positions since all data is gone
        try { localStorage.removeItem('mindmap-positions'); } catch {}
        window.location.reload();
      } catch (err) {
        console.error('[CalmPlan] Reset v15 error:', err);
        // Fallback: try deleting one by one
        try {
          const allTasks = await Task.list(null, 10000);
          let deleted = 0;
          for (const t of allTasks) {
            try { await Task.delete(t.id); deleted++; } catch {}
          }
          console.log(`[CalmPlan] Fallback purge: deleted ${deleted} tasks`);
          try { localStorage.setItem(NUCLEAR_KEY, 'true'); } catch {}
          try { localStorage.removeItem('mindmap-positions'); } catch {}
          window.location.reload();
        } catch (e2) {
          console.error('[CalmPlan] Fallback purge also failed:', e2);
        }
      }
    })();
  }, []);

  const [focusedClients, setFocusedClients] = useState(new Set());

  // clickTimerRef no longer needed — modal law: every click opens full dialog
  const clickTimerRef = useRef(null); // kept for status-cycle cancel only
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'task'|'client', id, name }

  // ── Viewport Persistence Key ──
  const VIEWPORT_KEY = 'calmplan_map_viewport';

  // ── Pan & Zoom state — restore from localStorage on mount ──
  const [pan, setPan] = useState(() => {
    try {
      const saved = localStorage.getItem(VIEWPORT_KEY);
      if (saved) { const v = JSON.parse(saved); if (typeof v.x === 'number') return { x: v.x, y: v.y }; }
    } catch {}
    return { x: 0, y: 0 };
  });
  const [zoom, setZoom] = useState(() => {
    try {
      const saved = localStorage.getItem(VIEWPORT_KEY);
      if (saved) { const v = JSON.parse(saved); if (typeof v.zoom === 'number') return v.zoom; }
    } catch {}
    return 1;
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoFitDone, setAutoFitDone] = useState(() => {
    try {
      return !!localStorage.getItem(POSITIONS_STORAGE_KEY) || !!localStorage.getItem(VIEWPORT_KEY);
    } catch { return false; }
  });

  // ── Viewport Persistence: save pan+zoom on every change ──
  useEffect(() => {
    try {
      localStorage.setItem(VIEWPORT_KEY, JSON.stringify({ x: pan.x, y: pan.y, zoom }));
    } catch {}
  }, [pan.x, pan.y, zoom]);

  // ── Spacing slider (global distance multiplier) ──
  const [spacingFactor, setSpacingFactor] = useState(1.0);

  // ── Draggable nodes: manual position overrides ──
  // Key: "category-clientName", Value: { x, y }
  // PERSISTENCE: Hydrate from localStorage on mount
  const [manualPositions, setManualPositions] = useState(() => {
    try {
      const saved = localStorage.getItem(POSITIONS_STORAGE_KEY);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch { return {}; }
  });
  const draggingNode = useRef(null); // { key, startX, startY, origX, origY }
  const nodeHasDragged = useRef(false);

  // PERSISTENCE: Save to localStorage on EVERY position change (immediate)
  const savePositionsToStorage = useCallback((positions) => {
    try { localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions)); } catch {}
  }, []);
  useEffect(() => {
    if (Object.keys(manualPositions).length > 0) {
      savePositionsToStorage(manualPositions);
    }
  }, [manualPositions, savePositionsToStorage]);

  // ── PERSISTENCE HYDRATION GUARD (mount-only) ──
  // Force-clear old positions when layout version changes (magnetic clustering update)
  const LAYOUT_VERSION = 'v18-functional-branching'; // bump this to force reset
  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem('mindmap-layout-version');
      if (storedVersion !== LAYOUT_VERSION) {
        // Layout changed — clear stale positions and viewport
        localStorage.removeItem(POSITIONS_STORAGE_KEY);
        localStorage.removeItem(VIEWPORT_KEY);
        localStorage.setItem('mindmap-layout-version', LAYOUT_VERSION);
        setManualPositions({});
        setAutoFitDone(false);
        return; // Skip hydration — start fresh
      }
      const savedPositions = localStorage.getItem(POSITIONS_STORAGE_KEY);
      if (savedPositions) {
        const parsed = JSON.parse(savedPositions);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
          setManualPositions(parsed);
          setAutoFitDone(true);
        }
      }
      const savedViewport = localStorage.getItem(VIEWPORT_KEY);
      if (savedViewport) {
        const v = JSON.parse(savedViewport);
        if (typeof v.x === 'number') setPan({ x: v.x, y: v.y });
        if (typeof v.zoom === 'number') setZoom(v.zoom);
        setAutoFitDone(true);
      }
    } catch {}
  }, []); // mount-only

  // ── Crisis Mode ──
  const [crisisMode, setCrisisMode] = useState(() => localStorage.getItem('mindmap-crisis-mode') === 'true');
  useEffect(() => { localStorage.setItem('mindmap-crisis-mode', String(crisisMode)); }, [crisisMode]);

  // ── STRICT COLLAPSE HIERARCHY ──
  // Level 1 (meta-folders): collapsed by default → click to reveal Level 2/3
  // Level 3 (departments): collapsed by default → click to reveal Level 4 clients
  const MAX_VISIBLE_CHILDREN = 999; // Show ALL clients — no pagination at all
  const [expandedMetaFolders, setExpandedMetaFolders] = useState(new Set());
  const [expandedBranches, setExpandedBranches] = useState(new Set());
  const [expandedFuncBubbles, setExpandedFuncBubbles] = useState(new Set());
  const toggleFuncBubbleExpand = useCallback((fbKey) => {
    setExpandedFuncBubbles(prev => {
      const next = new Set(prev);
      if (next.has(fbKey)) next.delete(fbKey); else next.add(fbKey);
      return next;
    });
  }, []);
  const toggleMetaExpand = useCallback((metaName) => {
    setExpandedMetaFolders(prev => {
      const next = new Set(prev);
      if (next.has(metaName)) next.delete(metaName);
      else next.add(metaName);
      return next;
    });
  }, []);
  const toggleBranchExpand = useCallback((category) => {
    setExpandedBranches(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  // ── Feature 8: Auto-open drawer from search deep-link ──
  const [highlightTaskId, setHighlightTaskId] = useState(null);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(width, 600),
        height: Math.max(height, 500),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Data Processing ──
  const { branches, clientNodes, centerLabel, todayTasks, metaFolders, activeTaskCount } = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const centerLabel = format(today, 'EEEE, d/M', { locale: he });

    // ── TRUTH ENGINE: Filter tasks to CURRENT MONTH ONLY ──
    // This is the root fix: previous versions showed ALL months (558 tasks!)
    // Only show tasks whose due_date falls within the current month
    const currentMonthPrefix = format(today, 'yyyy-MM'); // e.g. "2026-02"
    const catClientMap = {};
    const activeTasks = tasks.filter(t => {
      // No status filtering — all 5 golden statuses are valid
      // MONTH FILTER: Only show tasks WITH a due_date in the current month
      // Tasks without due_date are unscheduled — they do NOT belong on the MindMap
      if (!t.due_date || !t.due_date.startsWith(currentMonthPrefix)) return false;
      if (!crisisMode) return true;
      const dept = CATEGORY_TO_DEPARTMENT[t.category || 'אחר'] || t.category;
      if (dept === 'בית') return t.priority === 'urgent' || t.priority === 'high';
      return t.priority !== 'low';
    });

    // HARD LIMIT: If task count exceeds 70, log warning
    if (activeTasks.length > 70) {
      console.warn(`[CalmPlan] TRUTH ENGINE: ${activeTasks.length} tasks for ${currentMonthPrefix} exceeds 70 limit!`);
    }
    console.log(`[CalmPlan] MindMap rendering ${activeTasks.length} tasks for ${currentMonthPrefix}`);

    // Collect ALL known department names for catch-all check
    const knownDepartments = new Set();
    Object.values(META_FOLDERS).forEach(mf => mf.departments.forEach(d => knownDepartments.add(d)));

    activeTasks.forEach(task => {
      const rawCat = task.category || 'אחר';
      let cat = CATEGORY_TO_DEPARTMENT[rawCat] || rawCat;
      const clientName = task.client_name || 'כללי';
      // No-client tasks → Admin branch
      if (!task.client_name) cat = 'אדמיניסטרציה';
      // MATH AUDIT: If category doesn't map to ANY known department, route to catch-all
      if (!knownDepartments.has(cat) && cat !== 'אדמיניסטרציה') {
        cat = 'אחר/טיוטות';
      }
      if (!catClientMap[cat]) catClientMap[cat] = {};
      if (!catClientMap[cat][clientName]) catClientMap[cat][clientName] = [];
      catClientMap[cat][clientName].push(task);
    });

    // Build branch data with complexity-tier sizing
    const branches = Object.entries(catClientMap).map(([category, clientsObj]) => ({
      category,
      config: BRANCH_CONFIG[category] || BRANCH_CONFIG['אדמיניסטרציה'],
      clients: Object.entries(clientsObj).map(([name, clientTasks]) => {
        const client = clients?.find(c => c.name === name);
        const tier = getComplexityTier(client, clientTasks) || 0;
        const tierInfo = getTierInfo(tier) || { label: 'Unknown', icon: '❓', bubbleScale: 1.0 };
        // Display name: nickname || full name
        const displayName = (client?.nickname || name || '').trim();
        // Top active task for pill display
        const activeTasks = clientTasks.filter(t => t.status !== 'production_completed');
        const topTask = activeTasks[0] || null;
        // Check for waiting_on_client status
        const hasWaitingOnClient = clientTasks.some(t => t.status === 'waiting_on_client');
        // Iron Rule: compute worst status for bubble label sync
        const worstStatus = getWorstClientStatus(clientTasks);
        const worstStatusLabel = STATUS_LABELS[worstStatus] || 'לבצע';
        const worstStatusColor = STATUS_TO_COLOR[worstStatus] || ZERO_PANIC.gray;
        return {
          name,
          displayName,
          nickname: client?.nickname || '',
          clientId: client?.id,
          tier,
          tierLabel: tierInfo.label,
          tierIcon: tierInfo.icon,
          ...getClientAggregateState(clientTasks),
          worstStatus,
          worstStatusLabel,
          worstStatusColor,
          tasks: clientTasks,
          topTask,
          hasWaitingOnClient,
          totalTasks: clientTasks.length,
          completedTasks: clientTasks.filter(t => t.status === 'production_completed').length,
          overdueTasks: clientTasks.filter(t => {
            if (t.status === 'production_completed') return false;
            if (!t.due_date) return false;
            const due = new Date(t.due_date);
            due.setHours(23, 59, 59, 999);
            return due < today;
          }).length,
        };
      }),
    }));

    // ── Assign meta-folder to each branch ──
    branches.forEach(branch => {
      for (const [metaName, meta] of Object.entries(META_FOLDERS)) {
        if (meta.departments.includes(branch.category)) {
          branch.metaFolder = metaName;
          branch.metaConfig = meta;
          break;
        }
      }
      if (!branch.metaFolder) {
        // Unmapped categories → Additional Services (NO pending bucket)
        branch.metaFolder = 'שירותים נוספים';
        branch.metaConfig = META_FOLDERS['שירותים נוספים'];
      }
    });

    // ── NANO SHORTCUT: All clients under 'שירותים נוספים' are forced to Nano ──
    branches.forEach(branch => {
      if (branch.metaConfig?.forceNano) {
        branch.clients.forEach(client => {
          client.tier = 0;
          client.tierLabel = 'ננו';
          client.tierIcon = '⚡';
        });
      }
    });

    // ── COMPLEXITY SUB-GROUPS: 3-tier (ננו/בינוני/גדול) for ALL branches ──
    branches.forEach(branch => {
      if (branch.metaConfig?.complexitySubFolders) {
        // Build tier groups — clamp to 0-2 range
        const tierGroups = {};
        branch.clients.forEach(client => {
          const t = Math.min(client.tier || 0, 2); // clamp to 3-tier max
          client.tier = t; // normalize
          if (!tierGroups[t]) tierGroups[t] = [];
          tierGroups[t].push(client);
        });
        branch.config = { ...branch.config };
        branch.config.subFolders = Object.keys(tierGroups)
          .map(Number)
          .sort()
          .map(t => ({
            key: COMPLEXITY_SUB_LABELS[t]?.key || `tier-${t}`,
            icon: COMPLEXITY_SUB_LABELS[t]?.icon || '📄',
            label: COMPLEXITY_SUB_LABELS[t]?.label || `Tier ${t}`,
            color: COMPLEXITY_SUB_LABELS[t]?.color || '#455A64',
            tier: t,
            clientNames: tierGroups[t].map(c => c.name),
          }));
        branch.clients.forEach(client => {
          const t = client.tier || 0;
          client._complexitySubFolder = COMPLEXITY_SUB_LABELS[t]?.key || `tier-${t}`;
          client._diamondColor = DIAMOND_COLORS[t] || '#455A64';
          // ── FUNCTIONAL BRANCHING: assign client by dominant task category ──
          // Count tasks per function bucket using CATEGORY_TO_FUNCTION mapping
          const bucketCounts = { production: 0, reports: 0, services: 0 };
          (client.tasks || []).forEach(task => {
            const bucket = CATEGORY_TO_FUNCTION[task.category] || 'services';
            bucketCounts[bucket]++;
          });
          // Assign to the bucket with the most tasks (ties → production > reports > services)
          if (bucketCounts.production >= bucketCounts.reports && bucketCounts.production >= bucketCounts.services) {
            client._functionBucket = 'production';
          } else if (bucketCounts.reports >= bucketCounts.services) {
            client._functionBucket = 'reports';
          } else {
            client._functionBucket = 'services';
          }
        });
      }
    });

    // ── Build meta-folder groups (for rendering outer hexagon ring) ──
    const metaGroups = {};
    branches.forEach(branch => {
      const mf = branch.metaFolder;
      if (!metaGroups[mf]) {
        metaGroups[mf] = {
          name: mf,
          config: branch.metaConfig || META_FOLDERS[mf],
          departments: [],
          _uniqueClientNames: new Set(), // track unique names, not sum
          totalClients: 0,
          totalTasks: 0,
        };
      }
      metaGroups[mf].departments.push(branch.category);
      // UNIQUE CLIENT COUNT: same client in שכר + ביטוח לאומי counts as 1, not 2
      branch.clients.forEach(c => metaGroups[mf]._uniqueClientNames.add(c.name));
      metaGroups[mf].totalClients = metaGroups[mf]._uniqueClientNames.size;
      metaGroups[mf].totalTasks += branch.clients.reduce((sum, c) => sum + c.totalTasks, 0);
    });
    // ALWAYS show all 4 P-branches (even if empty) for visual hierarchy stability
    Object.entries(META_FOLDERS).forEach(([name, config]) => {
      if (!metaGroups[name]) {
        metaGroups[name] = {
          name,
          config,
          departments: [],
          _uniqueClientNames: new Set(),
          totalClients: 0,
          totalTasks: 0,
        };
      }
    });
    const metaFolders = Object.values(metaGroups);

    // P1→P2 Sync State: calculate how many P1 payroll tasks are completed
    const p1Payroll = metaGroups['P1 חשבות שכר'];
    const p2Bookkeeping = metaGroups['P2 הנהלת חשבונות'];
    let p1SyncPct = 0;
    if (p1Payroll) {
      const p1Branches = branches.filter(b => b.metaFolder === 'P1 חשבות שכר');
      let p1Total = 0, p1Done = 0;
      p1Branches.forEach(b => b.clients.forEach(c => { p1Total += c.totalTasks; p1Done += c.completedTasks; }));
      p1SyncPct = p1Total > 0 ? Math.round((p1Done / p1Total) * 100) : 0;
    }
    metaFolders.forEach(mf => {
      if (mf.name === 'P2 הנהלת חשבונות') {
        mf.p1SyncPct = p1SyncPct;
        mf.p1SyncReady = p1SyncPct >= 80; // P1 mostly done → P2 can proceed
      }
    });

    // Build flat client nodes for rendering
    const clientNodes = [];
    branches.forEach(branch => {
      branch.clients.forEach(client => {
        clientNodes.push({ ...client, category: branch.category });
      });
    });

    // Today-only: tasks whose due_date is exactly today (for center node)
    const todayTasks = tasks.filter(t => {
      if (t.status === 'production_completed') return false;
      return t.due_date === todayStr;
    });

    return { branches, clientNodes, centerLabel, todayTasks, metaFolders, activeTaskCount: activeTasks.length };
  }, [tasks, clients, crisisMode]);

  // ── Feature 8: Auto-open drawer from search deep-link ──
  useEffect(() => {
    if (!focusClientName || !clientNodes || clientNodes.length === 0) return;
    const clientNode = clientNodes.find(c => c.name === focusClientName);
    if (clientNode) {
      // Delay slightly to let drawer mount
      setTimeout(() => {
        setDrawerClient(clientNode);
        setShowDrawerCompleted(false);
      }, 100);
    }
    if (focusTaskId) {
      setHighlightTaskId(String(focusTaskId));
    }
    onFocusHandled?.();
  }, [focusClientName, focusTaskId, clientNodes]);

  // ── Staleness guard: discard saved positions that drifted too far from computed ──
  // When data changes (clients added/removed), computed positions shift but saved
  // absolute positions remain — causing nodes to appear "lost" far from their parent.
  const STALE_THRESHOLD = 400; // px — if saved pos is >400px from computed, discard it
  const guardPos = (savedPos, computedX, computedY) => {
    if (!savedPos || typeof savedPos.x !== 'number') return { x: computedX, y: computedY };
    const dx = savedPos.x - computedX;
    const dy = savedPos.y - computedY;
    if (dx * dx + dy * dy > STALE_THRESHOLD * STALE_THRESHOLD) return { x: computedX, y: computedY };
    return savedPos;
  };

  // ══════════════════════════════════════════════════════════════
  // LAYOUT: COMPACT GRAPE-CLUSTER — 50% shorter arms, tier sub-nodes
  // Hub → Meta(P1-P4) → Dept → Tier(ננו/בינוני/גדול) → Client mini-fan
  // Group dragging: client pos = tier pos + relative offset (nested coords)
  // ══════════════════════════════════════════════════════════════
  const layout = useMemo(() => {
    const w = Math.max(dimensions.width, 600);
    const h = Math.max(dimensions.height, 400);
    const isWide = w >= 1600;
    const cx = w / 2;
    const cy = h / 2;
    const centerR = isWide ? 55 : 48;

    // Fixed 90° sector angles: P1=top, P2=left, P3=right, P4=bottom
    const SECTOR_ANGLES = {
      'P1 חשבות שכר':       -Math.PI / 2,
      'P2 הנהלת חשבונות':   Math.PI,
      'P3 ניהול משרד':      0,
      'P4 בית':             Math.PI / 2,
    };

    // ─── ANTI-OVERLAP: Generous spacing + downward cascade ───
    const META_DIST = 220;    // center → meta-folder (wide arm)
    const DEPT_DIST = 160;    // meta → department (generous)
    const TIER_DIST = 110;    // department → tier diamond
    const CLIENT_DIST = 90;   // tier diamond → client pill
    const CLIENT_GAP = 55;    // min px between adjacent client pills (prevents overlap)

    let metaFolderPositions = metaFolders.map((mf) => {
      const angle = SECTOR_ANGLES[mf.name] ?? 0;
      const mx = cx + Math.cos(angle) * META_DIST;
      const my = cy + Math.sin(angle) * META_DIST;
      const manualKey = `meta-${mf.name}`;
      const manual = manualPositions[manualKey];
      return { ...mf, x: manual?.x ?? mx, y: manual?.y ?? my, angle };
    });

    // ═══════════════════════════════════════════════════════════
    // GRAPE-CLUSTER LAYOUT:
    //   Hub → Meta-folder → Department → Tier sub-nodes → Client mini-fans
    //   Each tier sub-node is a small bubble (ננו/בינוני/גדול).
    //   Clients are "grape berries" clustered tightly around their tier node.
    // ═══════════════════════════════════════════════════════════

    const branchPositions = branches.map((branch) => {
      const parentMeta = metaFolderPositions.find(m => m.name === branch.metaFolder);
      if (!parentMeta) {
        return { ...branch, x: cx, y: cy, angle: 0, clientPositions: [], subFolderPositions: [] };
      }

      const siblings = branches.filter(b => b.metaFolder === branch.metaFolder);
      const sibIdx = siblings.indexOf(branch);
      const sibCount = siblings.length;

      // ── TOP-DOWN TREE: departments spread HORIZONTALLY below their meta-folder ──
      // All children go BELOW parent (positive Y), spread evenly on X axis
      const deptAngle = Math.PI / 2; // always downward
      const spreadWidth = Math.max(sibCount - 1, 1) * 160; // horizontal spread
      const offsetX = sibCount <= 1 ? 0 : -spreadWidth / 2 + sibIdx * (spreadWidth / (sibCount - 1));

      const bx = parentMeta.x + offsetX;
      const by = parentMeta.y + DEPT_DIST;

      const folderKey = `folder-${branch.category}`;
      const folderPos = manualPositions[folderKey];
      const finalBx = folderPos?.x ?? bx;
      const finalBy = folderPos?.y ?? by;

      // ── TIER SUB-NODES: ננו / בינוני / גדול — horizontal spread BELOW dept ──
      const subFolders = branch.config?.subFolders || [];
      const nTiers = subFolders.length;
      const tierSpreadW = Math.max(nTiers - 1, 1) * 120;

      const subFolderPositions = subFolders.map((sf, ti) => {
        const tierAngle = Math.PI / 2; // always downward
        const tierOffsetX = nTiers <= 1 ? 0 : -tierSpreadW / 2 + ti * (tierSpreadW / (nTiers - 1));
        const tx = finalBx + tierOffsetX;
        const ty = finalBy + TIER_DIST;

        const tierKey = `tier-${branch.category}-${sf.key}`;
        const tierPos = manualPositions[tierKey];
        const guardedTier = guardPos(tierPos, tx, ty);
        return {
          ...sf,
          key: tierKey,
          x: guardedTier.x,
          y: guardedTier.y,
          angle: tierAngle,
          parentX: finalBx,
          parentY: finalBy,
        };
      });

      // ── FUNCTIONAL BRANCHING: Tier Diamond → Function Bubbles → Clients ──
      // Each tier diamond spawns up to 3 function bubbles (ייצור / דיווחים / שירותים)
      // Clients are satellites around their function bubble, NOT directly on the tier diamond.
      const FUNC_DIST = 90;    // tier diamond → function bubble distance (generous)
      const CLIENT_FROM_FUNC = 85; // function bubble → client distance (generous)
      const MIN_BUBBLE_SPACING = 120; // px between bubble centers (repulsion)

      const functionBubblePositions = [];
      const clientPositions = [];

      subFolderPositions.forEach((tierNode) => {
        const tierClients = branch.clients
          .filter(c => c._complexitySubFolder === tierNode.key.replace(`tier-${branch.category}-`, ''))
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));

        if (tierClients.length === 0) return;

        // Group clients by function bucket
        const bucketGroups = {};
        tierClients.forEach(c => {
          const bucket = c._functionBucket || 'production';
          if (!bucketGroups[bucket]) bucketGroups[bucket] = [];
          bucketGroups[bucket].push(c);
        });

        // ALWAYS show all 3 function bubbles (ייצור / דיווחים / שירותים) under every diamond
        // PURE HORIZONTAL SPREAD: bubbles go side by side BELOW their tier diamond
        const activeBuckets = FUNCTION_BUCKET_ORDER;
        const nBuckets = activeBuckets.length;
        const bucketSpreadW = Math.max(nBuckets - 1, 1) * 140;

        activeBuckets.forEach((bucketKey, bi) => {
          const bucketInfo = FUNCTION_BUCKETS[bucketKey];
          const bucketAngle = Math.PI / 2; // always downward
          const bucketOffsetX = nBuckets <= 1 ? 0 : -bucketSpreadW / 2 + bi * (bucketSpreadW / (nBuckets - 1));

          const fbKey = `func-${branch.category}-${tierNode.key}-${bucketKey}`;
          const fbManual = manualPositions[fbKey];
          const computedFbXi = tierNode.x + bucketOffsetX;
          const computedFbYi = tierNode.y + FUNC_DIST;
          const guardedFbI = guardPos(fbManual, computedFbXi, computedFbYi);
          const fbX = guardedFbI.x;
          const fbY = guardedFbI.y;

          functionBubblePositions.push({
            key: fbKey,
            bucketKey,
            label: bucketInfo.label,
            icon: bucketInfo.icon,
            color: bucketInfo.color,
            x: fbX,
            y: fbY,
            angle: bucketAngle,
            tierKey: tierNode.key,
            tierX: tierNode.x,
            tierY: tierNode.y,
            clientCount: (bucketGroups[bucketKey] || []).length,
          });

          // Position clients as compact fan around this function bubble
          // ── GRID LAYOUT: clients in rows BELOW their function bubble ──
          const bucketClients = bucketGroups[bucketKey] || [];
          const n = bucketClients.length;
          if (n === 0) return;
          const COLS = 3; // max 3 clients per row
          const COL_GAP = 110; // horizontal gap between clients
          const ROW_GAP = 65;  // vertical gap between rows

          bucketClients.forEach((client, j) => {
            const nodeRadius = getNodeRadius(client.tier, isWide);
            const clientKey = `${branch.category}-${client.name}`;
            const clientPos = manualPositions[clientKey];

            const row = Math.floor(j / COLS);
            const col = j % COLS;
            const rowCount = Math.min(n - row * COLS, COLS);
            const rowWidth = (rowCount - 1) * COL_GAP;
            const colOffset = -rowWidth / 2 + col * COL_GAP;

            const computedCX = fbX + colOffset;
            const computedCY = fbY + CLIENT_FROM_FUNC + row * ROW_GAP;
            const guardedClient = guardPos(clientPos, computedCX, computedCY);
            const absX = guardedClient.x;
            const absY = guardedClient.y;

            clientPositions.push({
              ...client,
              radius: nodeRadius,
              x: absX,
              y: absY,
              branchX: finalBx,
              branchY: finalBy,
              tierKey: tierNode.key,
              tierX: tierNode.x,
              tierY: tierNode.y,
              funcBubbleKey: fbKey,
              funcBubbleX: fbX,
              funcBubbleY: fbY,
            });
          });
        });
      });

      // Clients not assigned to any tier sub-folder (fallback — grid below dept)
      if (subFolderPositions.length === 0) {
        const sortedClients = [...branch.clients].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));
        const n = sortedClients.length;
        const FCOLS = 3, FCOL_GAP = 110, FROW_GAP = 65;
        sortedClients.forEach((client, j) => {
          const nodeRadius = getNodeRadius(client.tier, isWide);
          const clientKey = `${branch.category}-${client.name}`;
          const clientPos = manualPositions[clientKey];
          const row = Math.floor(j / FCOLS);
          const col = j % FCOLS;
          const rowCount = Math.min(n - row * FCOLS, FCOLS);
          const rowWidth = (rowCount - 1) * FCOL_GAP;
          const colOffset = -rowWidth / 2 + col * FCOL_GAP;
          const computedFbX = finalBx + colOffset;
          const computedFbY = finalBy + CLIENT_FROM_FUNC + row * FROW_GAP;
          const guardedFb = guardPos(clientPos, computedFbX, computedFbY);
          clientPositions.push({
            ...client,
            radius: nodeRadius,
            x: guardedFb.x,
            y: guardedFb.y,
            branchX: finalBx,
            branchY: finalBy,
          });
        });
      }

      return {
        ...branch,
        x: finalBx,
        y: finalBy,
        angle: deptAngle,
        clientPositions,
        subFolderPositions,
        functionBubblePositions,
      };
    });

    // ═══ COLLISION ENGINE: zero-overlap guarantee ═══
    // Uses AABB for pills (rectangular), circle for diamonds/dept nodes.
    // Iterates until convergence — no fixed pass count.
    const collisionNodes = buildCollisionNodes(branchPositions, isWide);
    resolveCollisions(collisionNodes);

    return { cx, cy, centerR, branchPositions, metaFolderPositions, metaSubFolderPositions: [], virtualW: w, virtualH: h, isWide };
  }, [branches, metaFolders, dimensions, spacingFactor, manualPositions, expandedMetaFolders]);

  // ── Draggable center: effective position respects manual drag override ──
  const centerPos = useMemo(() => {
    const manual = manualPositions['center-node'];
    if (manual && typeof manual.x === 'number' && typeof manual.y === 'number') {
      return { x: manual.x, y: manual.y };
    }
    return { x: layout.cx, y: layout.cy };
  }, [layout.cx, layout.cy, manualPositions]);

  // ── Auto-Fit: compute zoom + pan to show all nodes ──
  // Feature 6: Skip auto-fit entirely when user has saved positions or viewport
  const hasSavedPositions = Object.keys(manualPositions).length > 0;
  const hasSavedViewport = (() => { try { return !!localStorage.getItem(VIEWPORT_KEY); } catch { return false; } })();
  useEffect(() => {
    if (autoFitDone || !layout.branchPositions.length) return;
    if (hasSavedPositions || hasSavedViewport) { setAutoFitDone(true); return; }

    // Compute bounding box of all nodes
    let minX = layout.cx, maxX = layout.cx, minY = layout.cy, maxY = layout.cy;

    // Include meta-folder hexagons in bounding box (always visible)
    layout.metaFolderPositions?.forEach(mf => {
      minX = Math.min(minX, mf.x - 70);
      maxX = Math.max(maxX, mf.x + 70);
      minY = Math.min(minY, mf.y - 32);
      maxY = Math.max(maxY, mf.y + 32);
    });
    // Include branch + client nodes only when their parent meta is expanded
    layout.branchPositions.forEach(branch => {
      if (!expandedMetaFolders.has(branch.metaFolder)) return;
      minX = Math.min(minX, branch.x - 60);
      maxX = Math.max(maxX, branch.x + 60);
      minY = Math.min(minY, branch.y - 24);
      maxY = Math.max(maxY, branch.y + 24);
      if (expandedBranches.has(branch.category)) {
        branch.clientPositions.slice(0, MAX_VISIBLE_CHILDREN).forEach(client => {
          const pillHalfW = Math.max((client.radius || 30) * 1.5, 60);
          const pillHalfH = Math.max((client.radius || 30) * 0.6, 28);
          minX = Math.min(minX, client.x - pillHalfW);
          maxX = Math.max(maxX, client.x + pillHalfW);
          minY = Math.min(minY, client.y - pillHalfH);
          maxY = Math.max(maxY, client.y + pillHalfH);
        });
      }
    });

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padding = 30;
    const viewW = dimensions.width - padding * 2;
    const viewH = dimensions.height - padding * 2;

    if (contentW <= 0 || contentH <= 0) return;

    // Since layout already fits in container, fitScale should be near 1.0
    // Cap at 1.0 max to avoid zooming in too much; allow slight shrink if nodes overflow
    const fitScale = Math.min(viewW / contentW, viewH / contentH, 1.0);
    // Floor at 0.7 so it never gets too tiny
    const clampedScale = Math.max(fitScale, 0.7);
    const contentCX = (minX + maxX) / 2;
    const contentCY = (minY + maxY) / 2;
    const fitPanX = dimensions.width / 2 - contentCX * clampedScale;
    const fitPanY = dimensions.height / 2 - contentCY * clampedScale;

    setZoom(clampedScale);
    setPan({ x: fitPanX, y: fitPanY });
    setAutoFitDone(true);
  }, [layout, dimensions, autoFitDone]);

  // Reset auto-fit when tasks change significantly — but NOT if user has saved positions/viewport
  useEffect(() => {
    if (!hasSavedPositions && !hasSavedViewport) setAutoFitDone(false);
  }, [tasks.length, branches.length]);

  // Reset auto-fit + manual positions when spacing changes (NOT on mount!)
  useEffect(() => {
    if (!spacingMountGuard.current) { spacingMountGuard.current = true; return; }
    setAutoFitDone(false);
    setManualPositions({});
    localStorage.removeItem(POSITIONS_STORAGE_KEY);
    localStorage.removeItem(VIEWPORT_KEY);
  }, [spacingFactor]);

  // ── Pan handlers ──
  const handlePointerDown = useCallback((e) => {
    // Don't start panning on interactive elements or when dragging a node
    if (e.target.closest('[data-popover]') || e.target.closest('input') || e.target.closest('button')) return;
    if (e.target.closest('[data-node-draggable]')) return; // node handles its own drag
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.currentTarget.style.cursor = 'grabbing';
  }, [pan]);

  const handlePointerMove = useCallback((e) => {
    // Node dragging takes priority — snapshot ref to avoid null race
    const node = draggingNode.current;
    if (node) {
      const dx = (e.clientX - node.startX) / zoom;
      const dy = (e.clientY - node.startY) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) nodeHasDragged.current = true;

      if (node.isFolder) {
        // Folder drag: move folder + ALL children (no child left behind!)
        setManualPositions(prev => {
          const next = { ...prev, [node.key]: { x: node.origX + dx, y: node.origY + dy } };
          if (node.childPositions) {
            node.childPositions.forEach(child => {
              next[child.key] = { x: child.x + dx, y: child.y + dy };
            });
          }
          return next;
        });
      } else {
        setManualPositions(prev => ({
          ...prev,
          [node.key]: { x: node.origX + dx, y: node.origY + dy },
        }));
      }
      return;
    }
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, [isPanning, zoom]);

  const handlePointerUp = useCallback((e) => {
    if (draggingNode.current) {
      // onNodeDragStop: save positions immediately
      draggingNode.current = null;
      nodeHasDragged.current = false;
      setManualPositions(prev => { savePositionsToStorage(prev); return prev; });
      return;
    }
    setIsPanning(false);
    if (e.currentTarget) e.currentTarget.style.cursor = 'grab';
  }, [savePositionsToStorage]);

  // ── Node drag handlers ──
  const handleNodePointerDown = useCallback((e, nodeKey, currentX, currentY) => {
    e.stopPropagation();
    nodeHasDragged.current = false;
    draggingNode.current = {
      key: nodeKey,
      startX: e.clientX,
      startY: e.clientY,
      origX: currentX,
      origY: currentY,
    };
  }, []);

  const nodeClickTimerRef = useRef(null);
  const handleNodePointerUp = useCallback((e, client, department) => {
    const wasDragging = nodeHasDragged.current;
    draggingNode.current = null;
    nodeHasDragged.current = false;
    if (wasDragging) {
      setManualPositions(prev => { savePositionsToStorage(prev); return prev; });
      return;
    }
    // ── Deep Linking: navigate to relevant page based on function bucket ──
    const bucket = client._functionBucket || 'production';
    const clientId = client.clientId;
    if (clientId) {
      if (bucket === 'production') {
        navigate(`/Tasks?clientId=${clientId}`);
      } else if (bucket === 'reports') {
        // Route to reports dashboard depending on department
        if (department === 'שכר') {
          navigate(`/PayrollReportsDashboard?clientId=${clientId}`);
        } else {
          navigate(`/TaxReportsDashboard?clientId=${clientId}`);
        }
      } else {
        navigate(`/ClientManagement?clientId=${clientId}`);
      }
    } else {
      // Fallback: open drawer if no clientId
      setDrawerClient(client);
      setDrawerDepartment(department || null);
      setEditPopover(null);
      setShowDrawerCompleted(false);
    }
  }, [savePositionsToStorage, navigate]);

  // ── Meta-folder drag handlers: move all sub-folders + department branches + their children ──
  const handleMetaPointerDown = useCallback((e, metaKey, currentX, currentY) => {
    e.stopPropagation();
    nodeHasDragged.current = false;
    const metaName = metaKey.replace('meta-', '');
    // Gather ALL descendant positions: sub-folder circles, department folders, client pills
    const childPositions = [];
    // Sub-folder circles
    layout.metaSubFolderPositions?.forEach(sf => {
      if (sf.metaFolderName === metaName) {
        childPositions.push({ key: `metasub-${sf.metaFolderName}-${sf.key}`, x: sf.x, y: sf.y });
      }
    });
    // Department branches + their tier sub-nodes + client pills
    layout.branchPositions.forEach(branch => {
      if (branch.metaFolder === metaName) {
        childPositions.push({ key: `folder-${branch.category}`, x: branch.x, y: branch.y });
        // Include tier sub-folder nodes
        branch.subFolderPositions?.forEach(sub => {
          childPositions.push({ key: sub.key, x: sub.x, y: sub.y });
        });
        // Include function bubbles
        branch.functionBubblePositions?.forEach(fb => {
          childPositions.push({ key: fb.key, x: fb.x, y: fb.y });
        });
        branch.clientPositions.forEach(cp => {
          childPositions.push({ key: `${branch.category}-${cp.name}`, x: cp.x, y: cp.y });
        });
      }
    });
    draggingNode.current = {
      key: metaKey, startX: e.clientX, startY: e.clientY,
      origX: currentX, origY: currentY, isFolder: true, childPositions,
    };
  }, [layout]);

  // ── Folder drag handlers ──
  const handleFolderPointerDown = useCallback((e, folderKey, currentX, currentY) => {
    e.stopPropagation();
    nodeHasDragged.current = false;
    const category = folderKey.replace('folder-', '');
    const branch = layout.branchPositions.find(b => b.category === category);
    const childPositions = [];
    if (branch) {
      // Include tier sub-folder nodes
      branch.subFolderPositions?.forEach(sub => {
        childPositions.push({ key: sub.key, x: sub.x, y: sub.y });
      });
      // Include function bubbles
      branch.functionBubblePositions?.forEach(fb => {
        childPositions.push({ key: fb.key, x: fb.x, y: fb.y });
      });
      // Include client pills
      branch.clientPositions.forEach(cp => {
        childPositions.push({ key: `${category}-${cp.name}`, x: cp.x, y: cp.y });
      });
    }
    draggingNode.current = {
      key: folderKey, startX: e.clientX, startY: e.clientY,
      origX: currentX, origY: currentY, isFolder: true, childPositions,
    };
  }, [layout]);

  const handleFolderPointerUp = useCallback((e, category) => {
    const wasDragging = nodeHasDragged.current;
    draggingNode.current = null;
    nodeHasDragged.current = false;
    if (!wasDragging) {
      // COLLAPSE/EXPAND: toggle branch children visibility
      toggleBranchExpand(category);
    }
  }, [toggleBranchExpand]);

  const toggleClientFocus = useCallback((clientName, e) => {
    e?.stopPropagation();
    setFocusedClients(prev => {
      const next = new Set(prev);
      next.has(clientName) ? next.delete(clientName) : next.add(clientName);
      return next;
    });
  }, []);

  // ── Zoom handler (mouse wheel) ──
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // Mouse position relative to container
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
    const ratio = newZoom / zoom;

    // Zoom towards mouse position
    setPan(prev => ({
      x: mx - (mx - prev.x) * ratio,
      y: my - (my - prev.y) * ratio,
    }));
    setZoom(newZoom);
  }, [zoom]);

  // Attach wheel handler with passive: false
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Zoom buttons ──
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP * 2);
    const ratio = newZoom / zoom;
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    setPan(prev => ({
      x: cx - (cx - prev.x) * ratio,
      y: cy - (cy - prev.y) * ratio,
    }));
    setZoom(newZoom);
  }, [zoom, dimensions]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP * 2);
    const ratio = newZoom / zoom;
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    setPan(prev => ({
      x: cx - (cx - prev.x) * ratio,
      y: cy - (cy - prev.y) * ratio,
    }));
    setZoom(newZoom);
  }, [zoom, dimensions]);

  // ── Fit-All button ──
  const handleFitAll = useCallback(() => {
    setAutoFitDone(false);
  }, []);

  // ── Fullscreen toggle ──
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    // Re-trigger auto-fit after toggling
    setTimeout(() => setAutoFitDone(false), 100);
  }, []);

  // ESC to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  // ── Handlers ──
  const handleClientDoubleClick = useCallback((client) => {
    // Double-click opens QuickAddTaskDialog for this client
    setDrawerClient(client);
    setDrawerQuickAdd(true);
  }, []);

  const handleClientHover = useCallback((client, x, y) => {
    setHoveredNode(client.name);
    setTooltip({
      x, y,
      name: client.name,
      displayName: client.displayName,
      nickname: client.nickname,
      total: client.totalTasks,
      completed: client.completedTasks,
      overdue: client.overdueTasks,
      tier: client.tier,
      tierLabel: client.tierLabel,
      tierIcon: client.tierIcon,
      color: client.color,
      isFilingReady: client.isFilingReady,
      hasWaitingOnClient: client.hasWaitingOnClient,
      topTaskTitle: client.topTask?.title || '',
    });
  }, []);

  const handleBranchClick = useCallback((category) => {
    setSelectedBranch(prev => prev === category ? null : category);
  }, []);

  // Single-click opens client task drawer
  const handleClientClick = useCallback((client, x, y) => {
    setDrawerClient(client);
    setEditPopover(null);
    setShowDrawerCompleted(false);
  }, []);

  // Quick-add task from popover
  const handleQuickAddTask = useCallback(async () => {
    if (!quickTaskTitle.trim() || !editPopover) return;
    try {
      await Task.create({
        title: quickTaskTitle.trim(),
        client_name: editPopover.name,
        category: editPopover.category || 'אחר',
        status: 'not_started',
        due_date: new Date().toISOString().split('T')[0],
      });
      setQuickTaskTitle('');
      toast.success(`משימה נוספה ל-${editPopover.name}`);
    } catch (err) {
      toast.error('שגיאה בהוספת משימה');
    }
  }, [quickTaskTitle, editPopover]);

  // Close popover on outside click
  useEffect(() => {
    if (!editPopover) return;
    const handler = (e) => {
      if (!e.target.closest('[data-popover]')) setEditPopover(null);
    };
    const timer = setTimeout(() => document.addEventListener('click', handler), 100);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  }, [editPopover]);

  // Determine which branches are spotlighted in focus mode
  const isSpotlit = useCallback((category) => {
    if (!focusMode) return true;
    if (!selectedBranch) return true;
    return category === selectedBranch;
  }, [focusMode, selectedBranch]);

  // ── Error State: Reconnect Screen ──
  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" dir="rtl">
        <div className="p-6 rounded-[32px] bg-white border-2 border-[#B0BEC5] shadow-xl flex flex-col items-center gap-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center">
            <Cloud className="w-8 h-8 text-rose-500" />
          </div>
          <p className="text-lg font-bold text-[#000000]">שגיאת חיבור</p>
          <p className="text-sm text-[#37474F] text-center">{fetchError}</p>
          <button
            onClick={() => { setFetchError(null); window.location.reload(); }}
            className="px-6 py-2.5 rounded-full bg-[#008291] hover:bg-[#006d7a] text-white font-medium text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            התחבר מחדש
          </button>
        </div>
      </div>
    );
  }

  // LAW 3: LOGICAL AUDIT — HARD ABORT if >70 tasks
  if (activeTaskCount > 70) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" dir="rtl">
        <div className="p-8 rounded-3xl bg-red-50 border border-red-200 shadow-xl flex flex-col items-center gap-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl">⛔</div>
          <p className="text-lg font-bold text-red-700">שגיאת נתונים — {activeTaskCount} משימות</p>
          <p className="text-sm text-red-600 text-center">המערכת מותרת עד 70 משימות לחודש. נמצאו {activeTaskCount}.</p>
          <p className="text-xs text-red-500">יש לבצע איפוס משימות.</p>
          <button
            onClick={async () => {
              try {
                localStorage.removeItem('calmplan-nuclear-v10-clean-physics');
                window.location.reload();
              } catch { window.location.reload(); }
            }}
            className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium text-sm shadow-md flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> איפוס ורענון
          </button>
        </div>
      </div>
    );
  }

  if (tasks.length === 0 && inboxItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[#455A64] gap-3">
        <Sparkles className="w-12 h-12 text-[#B0BEC5]" />
        <p className="text-lg font-medium">המפה ריקה</p>
        <p className="text-sm">משימות חדשות יופיעו כאן אוטומטית</p>
      </div>
    );
  }

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-[9999]"
    : "relative w-full h-full";

  // APPLE-INSPIRED: Clean light grey background — NO turquoise soup
  const containerStyle = isFullscreen
    ? { background: '#F9FAFB' }
    : { height: '100%', background: '#F9FAFB' };

  return (
    <div
      ref={containerRef}
      className={`${containerClasses} overflow-hidden select-none`}
      style={{
        ...containerStyle,
        cursor: isPanning ? 'grabbing' : 'grab',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* ── Transformed content layer (pan + zoom applied) ── */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: layout.virtualW,
          height: layout.virtualH,
          position: 'absolute',
          top: 0,
          left: 0,
          willChange: 'transform', // GPU acceleration
        }}
      >
        {/* ── SVG Connection Lines — DISCRETE EDGES between node pairs ──
             Each edge is an independent Source→Target connection.
             Edge 1: Hub → P1/P2/P3/P4 (always visible, thick)
             Edge 2: P-branch → Department (visible when P expanded)
             Edge 3: Department → Client (visible when Dept expanded)
             Each level has distinct color/weight for visual separation. ── */}
        <svg
          width={layout.virtualW}
          height={layout.virtualH}
          className="absolute inset-0 pointer-events-none"
          style={{ overflow: 'visible', zIndex: -1 }}
        >
          <defs>
            {/* Arrow marker — sharp, black, clear */}
            <marker id="edge-arrow" viewBox="0 0 10 8" refX="9" refY="4"
              markerWidth="10" markerHeight="8" orient="auto-start-reverse"
              markerUnits="strokeWidth">
              <path d="M 0 0 L 10 4 L 0 8 z" fill="#000000" />
            </marker>
            {/* Smaller arrow — sharp, black */}
            <marker id="edge-arrow-sm" viewBox="0 0 8 6" refX="7" refY="3"
              markerWidth="8" markerHeight="6" orient="auto-start-reverse"
              markerUnits="strokeWidth">
              <path d="M 0 0 L 8 3 L 0 6 z" fill="#000000" />
            </marker>
          </defs>

          {/* ── EDGE LEVEL 1: "היום שלי" → P1 | P2 | P3 | P4 ──
               Always visible. 4 discrete edges from center hub.
               Thick line with arrow, slight bezier curve. ── */}
          {layout.metaFolderPositions?.map((mf) => {
            const x1 = centerPos.x, y1 = centerPos.y;
            const x2 = mf.x, y2 = mf.y;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            // Shorten line: start 50px from hub center, end 45px before meta-folder center
            const startFrac = 50 / len;
            const endFrac = 45 / len;
            const sx = x1 + dx * startFrac, sy = y1 + dy * startFrac;
            const ex = x2 - dx * endFrac, ey = y2 - dy * endFrac;
            // Slight curve: perpendicular offset = 6% of line length
            const mx = (sx + ex) / 2, my = (sy + ey) / 2;
            const curveAmt = len * 0.06;
            const cpx = mx + (-dy / len) * curveAmt;
            const cpy = my + (dx / len) * curveAmt;
            return (
              <path key={`edge-hub-meta-${mf.name}`}
                d={`M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`}
                fill="none"
                stroke="#000000"
                strokeWidth={2}
                strokeLinecap="round"
                markerEnd="url(#edge-arrow)"
                opacity={0.85} />
            );
          })}

          {/* ── EDGE LEVEL 2.5: Department → Tier Diamond ──
               Visible when P-branch is expanded. Directional arrows from dept to tier diamonds. */}
          {layout.branchPositions.map((branch) => {
            if (!expandedMetaFolders.has(branch.metaFolder)) return null;
            if (!branch.subFolderPositions || branch.subFolderPositions.length === 0) return null;
            return branch.subFolderPositions.map((sub) => {
              const dx = sub.x - branch.x, dy = sub.y - branch.y;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              if (len < 10) return null;
              const sx = branch.x + (dx / len) * 28;
              const sy = branch.y + (dy / len) * 28;
              const ex = sub.x - (dx / len) * 32;
              const ey = sub.y - (dy / len) * 32;
              const mx = (sx + ex) / 2, my = (sy + ey) / 2;
              const curveAmt = len * 0.04;
              const cpx = mx + (-dy / len) * curveAmt;
              const cpy = my + (dx / len) * curveAmt;
              return (
                <path key={`edge-dept-tier-${branch.category}-${sub.key}`}
                  d={`M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`}
                  fill="none"
                  stroke="#000000"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  markerEnd="url(#edge-arrow)"
                  opacity={0.8} />
              );
            });
          })}

          {/* ── EDGE LEVEL 2: P-branch → Department folders ──
               Visible only when the parent P-branch is expanded.
               Directional arrows from meta-folder to department. ── */}
          {layout.branchPositions.map((branch) => {
            if (!expandedMetaFolders.has(branch.metaFolder)) return null;
            const mfPos = layout.metaFolderPositions?.find(m => m.name === branch.metaFolder);
            if (!mfPos) return null;
            const px = mfPos.x, py = mfPos.y;
            const dx = branch.x - px, dy = branch.y - py;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            if (len < 10) return null;
            const sx = px + (dx / len) * 42, sy = py + (dy / len) * 42;
            const ex = branch.x - (dx / len) * 28, ey = branch.y - (dy / len) * 28;
            const mx = (sx + ex) / 2, my = (sy + ey) / 2;
            const curveAmt = len * 0.04;
            const cpx = mx + (-dy / len) * curveAmt;
            const cpy = my + (dx / len) * curveAmt;
            return (
              <path key={`edge-meta-dept-${branch.category}`}
                d={`M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`}
                fill="none"
                stroke="#000000"
                strokeWidth={1.5}
                strokeLinecap="round"
                markerEnd="url(#edge-arrow)"
                opacity={0.8} />
            );
          })}

          {/* ── EDGE LEVEL 3: Tier Diamond → Function Bubbles ──
               Visible when P-branch + department expanded. Arrows from diamond to function bubbles. */}
          {layout.branchPositions.map((branch) => {
            if (!expandedMetaFolders.has(branch.metaFolder)) return null;
            if (!expandedBranches.has(branch.category)) return null;
            if (!branch.functionBubblePositions) return null;
            return (
              <g key={`edges-tier-func-${branch.category}`}>
                {branch.functionBubblePositions.map((fb) => {
                  const dx = fb.x - fb.tierX, dy = fb.y - fb.tierY;
                  const len = Math.sqrt(dx * dx + dy * dy) || 1;
                  if (len < 10) return null;
                  const sx = fb.tierX + (dx / len) * 34;
                  const sy = fb.tierY + (dy / len) * 34;
                  const ex = fb.x - (dx / len) * 22;
                  const ey = fb.y - (dy / len) * 22;
                  const lmx = (sx + ex) / 2, lmy = (sy + ey) / 2;
                  const lca = len * 0.04;
                  const lcpx = lmx + (-dy / len) * lca;
                  const lcpy = lmy + (dx / len) * lca;
                  return (
                    <path key={`edge-tier-func-${fb.key}`}
                      d={`M ${sx} ${sy} Q ${lcpx} ${lcpy} ${ex} ${ey}`}
                      fill="none"
                      stroke="#000000" strokeWidth={1.3} strokeLinecap="round"
                      markerEnd="url(#edge-arrow-sm)"
                      opacity={0.75} />
                  );
                })}
              </g>
            );
          })}

          {/* ── EDGE LEVEL 4: Function Bubble → Client pills ──
               Each arrow goes from function bubble to its client satellites.
               Only visible when function bubble is expanded. */}
          {layout.branchPositions.map((branch) => {
            if (!expandedMetaFolders.has(branch.metaFolder)) return null;
            if (!expandedBranches.has(branch.category)) return null;
            const visibleClients = branch.clientPositions.slice(0, MAX_VISIBLE_CHILDREN).filter(c => expandedFuncBubbles.has(c.funcBubbleKey));
            return (
              <g key={`edges-func-clients-${branch.category}`}>
                {visibleClients.map((client) => {
                  const srcX = client.funcBubbleX ?? client.tierX ?? branch.x;
                  const srcY = client.funcBubbleY ?? client.tierY ?? branch.y;
                  const dx = client.x - srcX, dy = client.y - srcY;
                  const len = Math.sqrt(dx * dx + dy * dy) || 1;
                  if (len < 10) return null;
                  const startPx = 22;
                  const endPx = (client.radius || 22) + 4;
                  const sx = srcX + (dx / len) * startPx;
                  const sy = srcY + (dy / len) * startPx;
                  const ex = client.x - (dx / len) * endPx;
                  const ey = client.y - (dy / len) * endPx;
                  const cmx = (sx + ex) / 2, cmy = (sy + ey) / 2;
                  const cca = len * 0.03;
                  const ccpx = cmx + (-dy / len) * cca;
                  const ccpy = cmy + (dx / len) * cca;
                  return (
                    <path key={`edge-func-to-${branch.category}-${client.name}`}
                      d={`M ${sx} ${sy} Q ${ccpx} ${ccpy} ${ex} ${ey}`}
                      fill="none"
                      stroke="#000000" strokeWidth={1.1} strokeLinecap="round"
                      markerEnd="url(#edge-arrow-sm)"
                      opacity={0.7} />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* ── Center Node: "היום שלי" — draggable, today-only ── */}
        <motion.div
          data-node-draggable
          className="absolute flex flex-col items-center justify-center rounded-full text-white select-none"
          style={{
            width: layout.centerR * 2,
            height: layout.centerR * 2,
            left: centerPos.x - layout.centerR,
            top: centerPos.y - layout.centerR,
            zIndex: 10,
            background: 'linear-gradient(135deg, #1E3A5F, #0F2744)',
            boxShadow: '0 8px 24px #0F274440, 0 2px 8px #00000014',
            cursor: draggingNode.current?.key === 'center-node' ? 'grabbing' : 'grab',
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          onPointerDown={(e) => {
            e.stopPropagation();
            handleNodePointerDown(e, 'center-node', centerPos.x, centerPos.y);
          }}
          onPointerUp={(e) => {
            const wasDragging = nodeHasDragged.current;
            draggingNode.current = null;
            nodeHasDragged.current = false;
            if (wasDragging) {
              setManualPositions(prev => { savePositionsToStorage(prev); return prev; });
            }
          }}
        >
          <span className="font-bold leading-tight text-base">היום שלי</span>
          <span className="mt-0.5 text-xs">{todayTasks.length} משימות להיום</span>
          <span className="text-[11px]">{centerLabel}</span>
        </motion.div>

        {/* ── LAW 3: Level 1 — SOFT-SQUARE Category Containers (Deep Teal, 24px corners, outer glow) ── */}
        {layout.metaFolderPositions?.map((mf, mi) => {
          const isMetaExpanded = expandedMetaFolders.has(mf.name);
          const W = 160, H = 80, CR = 24;
          return (
          <motion.div
            key={`meta-${mf.name}`}
            data-node-draggable
            className="absolute z-10 select-none touch-none"
            style={{
              left: mf.x,
              filter: 'drop-shadow(0 4px 6px #0000001A)',
              top: mf.y,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: mi * 0.06, type: 'spring', stiffness: 200 }}
            whileHover={{ scale: 1.08 }}
            onPointerDown={(e) => handleMetaPointerDown(e, `meta-${mf.name}`, mf.x, mf.y)}
            onPointerUp={(e) => {
              const wasDragging = nodeHasDragged.current;
              draggingNode.current = null;
              nodeHasDragged.current = false;
              if (wasDragging) { setManualPositions(prev => { savePositionsToStorage(prev); return prev; }); }
              else { toggleMetaExpand(mf.name); }
            }}
          >
            <svg width={W + 20} height={H + 20} viewBox={`-10 -10 ${W + 20} ${H + 20}`} style={{ overflow: 'visible' }}>
              {/* Outer border ring */}
              <rect x={-4} y={-4} width={W + 8} height={H + 8}
                rx={CR + 4} ry={CR + 4}
                fill="none" stroke={isMetaExpanded ? '#00897B' : '#B0BEC5'} strokeWidth="1.5" />
              {/* Main body — Deep Teal solid (Zero Gray: no gradient opacity) */}
              <rect x={0} y={0} width={W} height={H}
                rx={CR} ry={CR}
                fill="#004D40"
                stroke={isMetaExpanded ? '#FFFFFF' : '#80CBC4'}
                strokeWidth={isMetaExpanded ? 2.5 : 1.5} />
              {/* +/- Expand indicator */}
              <circle cx={W - 14} cy={14} r={10} fill={isMetaExpanded ? '#00897B' : '#37474F'} stroke="#FFFFFF" strokeWidth={1.5} />
              <text x={W - 14} y={18} textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="700" style={{ pointerEvents: 'none' }}>
                {isMetaExpanded ? '−' : '+'}
              </text>
              {/* Label */}
              <text x={W / 2 + 4} y={H / 2 - 6} textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="700"
                style={{ pointerEvents: 'none' }}>
                {mf.config?.icon || '📂'} {mf.name}
              </text>
              {/* Stats */}
              <text x={W / 2 + 4} y={H / 2 + 12} textAnchor="middle" fill="#B2DFDB" fontSize="10" style={{ pointerEvents: 'none' }}>
                {mf.totalTasks} משימות · {mf.totalClients} לקוחות
              </text>
              {/* P1→P2 Sync indicator: shows on P2 meta-folder */}
              {mf.p1SyncPct != null && (
                <>
                  <rect x={W - 56} y={-12} width={56} height={18} rx={9} ry={9}
                    fill={mf.p1SyncReady ? '#2E7D32' : '#FF8F00'}
                    stroke="#FFFFFF" strokeWidth={1} />
                  <text x={W - 28} y={1} textAnchor="middle" fill="white" fontSize="8" fontWeight="700" style={{ pointerEvents: 'none' }}>
                    {mf.p1SyncReady ? '✓' : '⟳'} P1 {mf.p1SyncPct}%
                  </text>
                </>
              )}
            </svg>
          </motion.div>
          );
        })}

        {/* ── LAW 3: Level 2 — Glass-Morphism Rectangle Sub-Folders ── */}
        {layout.metaSubFolderPositions?.filter(sf => expandedMetaFolders.has(sf.metaFolderName)).map((sf, si) => {
          const SW = 110, SH = 50, SCR = 16;
          return (
          <motion.div
            key={`metasub-${sf.metaFolderName}-${sf.key}`}
            data-node-draggable
            className="absolute z-10 select-none touch-none"
            style={{
              left: sf.x,
              top: sf.y,
              filter: 'drop-shadow(0 4px 6px #0000001A)',
              transform: 'translate(-50%, -50%)',
              cursor: 'grab',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: si * 0.06 + 0.1, type: 'spring', stiffness: 200 }}
            whileHover={{ scale: 1.08 }}
            onPointerDown={(e) => handleNodePointerDown(e, `metasub-${sf.metaFolderName}-${sf.key}`, sf.x, sf.y)}
            onPointerUp={(e) => {
              const wasDragging = nodeHasDragged.current;
              draggingNode.current = null;
              nodeHasDragged.current = false;
              if (wasDragging) setManualPositions(prev => { savePositionsToStorage(prev); return prev; });
            }}
          >
            <svg width={SW + 10} height={SH + 10} viewBox={`-5 -5 ${SW + 10} ${SH + 10}`} style={{ overflow: 'visible' }}>
              {/* Zero Gray: solid white bg, vivid border */}
              <rect x={0} y={0} width={SW} height={SH}
                rx={SCR} ry={SCR}
                fill="#FFFFFF"
                stroke="#00838F"
                strokeWidth={1.5} />
              <text x={SW / 2} y={SH / 2 - 3} textAnchor="middle" fill="#006064" fontSize="11" fontWeight="700" style={{ pointerEvents: 'none' }}>
                {sf.icon} {sf.key}
              </text>
              <text x={SW / 2} y={SH / 2 + 12} textAnchor="middle" fill="#37474F" fontSize="9" style={{ pointerEvents: 'none' }}>
                {sf.departments?.length || 0} קטגוריות
              </text>
            </svg>
          </motion.div>
          );
        })}

        {/* ── LAW 3: Level 2/3 — Glass-Morphism Folder Nodes (Departments) ── */}
        {layout.branchPositions.filter(b => expandedMetaFolders.has(b.metaFolder)).map((branch, i) => {
          const isBranchExpanded = expandedBranches.has(branch.category);
          const FW = 130, FH = 50, FCR = 16;
          return (
          <React.Fragment key={branch.category}>
            {/* Department folder — glass rectangle, click to expand/collapse */}
            <motion.div
              data-node-draggable
              className="absolute z-10 select-none touch-none"
              style={{
                left: branch.x,
                top: branch.y,
                transform: 'translate(-50%, -50%)',
                opacity: isSpotlit(branch.category) ? 1 : 0.15,
                transition: 'opacity 0.4s ease-in-out',
                cursor: draggingNode.current?.key === `folder-${branch.category}` ? 'grabbing' : 'pointer',
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: isSpotlit(branch.category) ? 1 : 0.15, scale: 1 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.06 }}
              onPointerDown={(e) => handleFolderPointerDown(e, `folder-${branch.category}`, branch.x, branch.y)}
              onPointerUp={(e) => handleFolderPointerUp(e, branch.category)}
            >
              <svg width={FW + 10} height={FH + 10} viewBox={`-5 -5 ${FW + 10} ${FH + 10}`} style={{ overflow: 'visible' }}>
                {/* Zero Gray: solid white bg, vivid border */}
                <rect x={0} y={0} width={FW} height={FH}
                  rx={FCR} ry={FCR}
                  fill="#FFFFFF"
                  stroke={isBranchExpanded ? '#00838F' : '#90CAF9'}
                  strokeWidth={isBranchExpanded ? 2 : 1.5} />
                {/* Expand/collapse indicator */}
                <text x="14" y={FH / 2 + 1} textAnchor="middle" fill="#37474F" fontSize="9" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                  {isBranchExpanded ? '▼' : '▶'}
                </text>
                {/* Label */}
                <text x={FW / 2 + 4} y={FH / 2 - 2} textAnchor="middle" fill="#000000" fontSize="11" fontWeight="700" style={{ pointerEvents: 'none' }}>
                  {branch.config.icon} {branch.category}
                </text>
                {/* Count badge */}
                <circle cx={FW - 16} cy={14} r="10" fill="#E3F2FD" stroke="#90CAF9" strokeWidth={1} />
                <text x={FW - 16} y={18} textAnchor="middle" fill="#37474F" fontSize="9" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                  {branch.clients.length}
                </text>
              </svg>
            </motion.div>

            {/* Sub-folder / Category nodes — ONLY when branch is expanded */}
            {isBranchExpanded && branch.subFolderPositions?.map((sub, si) => (
              <motion.div
                key={`sub-${branch.category}-${sub.key}`}
                className="absolute z-10 cursor-pointer select-none mindmap-sparkle-hover"
                style={{
                  left: sub.x,
                  top: sub.y,
                  transform: 'translate(-50%, -50%)',
                  opacity: isSpotlit(branch.category) ? 0.9 : 0.12,
                  transition: 'opacity 0.4s ease-in-out, box-shadow 0.3s ease',
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: isSpotlit(branch.category) ? 0.9 : 0.12, scale: 1 }}
                transition={{ delay: i * 0.08 + si * 0.05 + 0.1, type: 'spring', stiffness: 200 }}
                whileHover={{
                  scale: 1.15,
                  boxShadow: '0 0 25px #00ACC1CC, 0 0 50px #00ACC166',
                  filter: 'brightness(1.2)',
                }}
                data-node-draggable
                onPointerDown={(e) => {
                  // Tier sub-node drag: move this tier + all its client children
                  e.stopPropagation();
                  nodeHasDragged.current = false;
                  const tierKey = sub.key.startsWith('tier-') ? sub.key : `tier-${branch.category}-${sub.key}`;
                  const childPositions = [];
                  // Include function bubbles under this tier
                  branch.functionBubblePositions?.forEach(fb => {
                    if (fb.tierKey === tierKey) {
                      childPositions.push({ key: fb.key, x: fb.x, y: fb.y });
                    }
                  });
                  // Include client pills under this tier
                  branch.clientPositions.forEach(cp => {
                    if (cp.tierKey === tierKey) {
                      childPositions.push({ key: `${branch.category}-${cp.name}`, x: cp.x, y: cp.y });
                    }
                  });
                  draggingNode.current = {
                    key: tierKey, startX: e.clientX, startY: e.clientY,
                    origX: sub.x, origY: sub.y, isFolder: true, childPositions,
                  };
                }}
                onPointerUp={(e) => {
                  const wasDragging = nodeHasDragged.current;
                  draggingNode.current = null;
                  nodeHasDragged.current = false;
                  if (wasDragging) {
                    setManualPositions(prev => { savePositionsToStorage(prev); return prev; });
                    return;
                  }
                  toggleBranchExpand(branch.category);
                }}
              >
                {/* Diamond Standard: Rhombus shape with tier-specific vivid color */}
                <svg width="64" height="64" viewBox="0 0 64 64" style={{ overflow: 'visible' }}>
                  <polygon
                    points="32,2 62,32 32,62 2,32"
                    fill={sub.color || '#00acc1'}
                    stroke="#fff"
                    strokeWidth={2.5}
                  />
                  <text x="32" y="30" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800" style={{ pointerEvents: 'none' }}>
                    {sub.icon}
                  </text>
                  <text x="32" y="44" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" style={{ pointerEvents: 'none' }}>
                    {sub.label || sub.key}
                  </text>
                  {/* +/- collapse button */}
                  <circle cx="54" cy="8" r="8" fill={expandedBranches.has(branch.category) ? '#00897B' : '#37474F'} stroke="#fff" strokeWidth={1.2} />
                  <text x="54" y="12" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" style={{ pointerEvents: 'none' }}>
                    {expandedBranches.has(branch.category) ? '−' : '+'}
                  </text>
                </svg>
              </motion.div>
            ))}

            {/* ── Function Bubbles: ייצור / דיווחים / שירותים — between tier diamonds and clients ── */}
            {isBranchExpanded && branch.functionBubblePositions?.map((fb, fi) => (
              <motion.div
                key={fb.key}
                className="absolute z-10 select-none"
                style={{
                  left: fb.x,
                  top: fb.y,
                  transform: 'translate(-50%, -50%)',
                  opacity: isSpotlit(branch.category) ? 0.95 : 0.15,
                  transition: 'opacity 0.4s ease-in-out',
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: isSpotlit(branch.category) ? 0.95 : 0.15, scale: 1 }}
                transition={{ delay: i * 0.08 + fi * 0.04 + 0.15, type: 'spring', stiffness: 200 }}
                whileHover={{ scale: 1.1 }}
                data-node-draggable
                onPointerDown={(e) => {
                  e.stopPropagation();
                  nodeHasDragged.current = false;
                  const childPositions = [];
                  branch.clientPositions.forEach(cp => {
                    if (cp.funcBubbleKey === fb.key) {
                      childPositions.push({ key: `${branch.category}-${cp.name}`, x: cp.x, y: cp.y });
                    }
                  });
                  draggingNode.current = {
                    key: fb.key, startX: e.clientX, startY: e.clientY,
                    origX: fb.x, origY: fb.y, isFolder: true, childPositions,
                  };
                }}
                onPointerUp={() => {
                  const wasDragging = nodeHasDragged.current;
                  draggingNode.current = null;
                  nodeHasDragged.current = false;
                  if (wasDragging) {
                    setManualPositions(prev => { savePositionsToStorage(prev); return prev; });
                  } else {
                    toggleFuncBubbleExpand(fb.key);
                  }
                }}
              >
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 shadow-md"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: fb.color,
                    minWidth: 70,
                    cursor: 'pointer',
                  }}
                >
                  <span className="text-sm">{fb.icon}</span>
                  <span className="text-xs font-bold" style={{ color: fb.color }}>{fb.label}</span>
                  <span className="text-[9px] font-medium px-1.5 rounded-full" style={{ backgroundColor: fb.color + '20', color: fb.color }}>{fb.clientCount}</span>
                  {/* +/- collapse indicator */}
                  <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                    style={{ backgroundColor: expandedFuncBubbles.has(fb.key) ? '#00897B' : '#37474F', minWidth: 16, minHeight: 16 }}>
                    {expandedFuncBubbles.has(fb.key) ? '−' : '+'}
                  </span>
                </div>
              </motion.div>
            ))}

            {/* ── Client Leaf Nodes — ONLY when branch + function bubble expanded ── */}
            {isBranchExpanded && branch.clientPositions.slice(0, MAX_VISIBLE_CHILDREN).filter(client => expandedFuncBubbles.has(client.funcBubbleKey)).map((client, j) => {
              const isHovered = hoveredNode === client.name;
              const isAllDone = client.completionRatio === 1 && client.totalTasks > 0;
              const isFilingReady = client.isFilingReady;
              const isWaitingOnClient = client.hasWaitingOnClient;
              // Ghost Node: dashed border if no due_date on all tasks
              const isGhost = client.tasks.every(t => !t.due_date);

              // Procrastination detection
              const procrastinatedCount = client.tasks.filter(t => (t.reschedule_count || 0) > 3).length;
              const isFrozen = client.tasks.length > 0 && client.tasks.every(t => (t.reschedule_count || 0) > 5);

              // Level 4 — Complexity glow: high-tier clients get subtle glow + 10% larger
              const isHighComplexity = client.tier >= 3;
              const complexityScale = isHighComplexity ? 1.1 : 1.0;

              // Pill dimensions based on complexity tier
              const pillHeight = Math.max(client.radius * 1.2, 55);
              const pillWidth = Math.max(client.radius * 3.0, 120);
              // Completed: shrink slightly + dim; High complexity: 10% larger
              const finalW = (isAllDone ? pillWidth * 0.85 : pillWidth) * complexityScale;
              const finalH = (isAllDone ? pillHeight * 0.85 : pillHeight) * complexityScale;

              // ── ZERO GRAY POLICY: Black text, white bg, vivid borders ──
              // Diamond Standard: client border inherits tier diamond color
              const diamondColor = client._diamondColor || '#00acc1';
              const statusColor = '#000000'; // Zero Gray: always black text
              const statusBg = isAllDone ? '#E8F5E9' : '#FFFFFF'; // White or light green
              const normalShadow = `0 2px 8px ${diamondColor}33`;
              const hoverGlow = `0 4px 14px ${diamondColor}55`;
              const focusGlow = `0 0 16px ${diamondColor}66`;

              // Top task title (truncated)
              const topTaskTitle = client.topTask?.title || '';
              const truncatedTask = topTaskTitle.length > 18 ? topTaskTitle.substring(0, 16) + '...' : topTaskTitle;

              // Focus state
              const isFocused = focusedClients.has(client.name);

              // Diamond Standard: client border = parent tier diamond color
              // Override for special states (focus, frozen, etc.)
              const borderColor = isFrozen ? '#455A64' : isFocused ? '#06B6D4' : isAllDone ? '#2E7D32' : diamondColor;
              const borderStyle = isFrozen ? 'dashed' : 'solid';
              const borderWidth = isFocused ? 3.5 : 2.5;

              const nodeKey = `${branch.category}-${client.name}`;
              const isDragging = draggingNode.current?.key === nodeKey;

              return (
                <motion.div
                  key={nodeKey}
                  data-node-draggable
                  className={`absolute z-10 flex flex-col items-center justify-center select-none overflow-hidden touch-none
                    ${client.shouldPulse || isFocused ? 'animate-pulse' : ''}`}
                  style={{
                    width: finalW,
                    height: finalH,
                    left: client.x - finalW / 2,
                    top: client.y - finalH / 2,
                    // Zero Gray Policy: solid white bg, no transparency
                    backgroundColor: statusBg,
                    borderColor,
                    borderStyle,
                    borderWidth,
                    borderRadius: finalH / 2,
                    // Zero Gray Policy: black text always
                    color: statusColor,
                    boxShadow: isHovered ? hoverGlow : isFocused ? focusGlow : normalShadow,
                    opacity: isSpotlit(branch.category) ? (isFrozen ? 0.5 : isAllDone ? 0.6 : 1) : 0.15,
                    filter: isFrozen ? 'saturate(0.3)' : 'none',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transition: 'opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.2s ease',
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: isSpotlit(branch.category) ? (isAllDone ? 0.6 : 1) : 0.15,
                    scale: 1,
                  }}
                  transition={{
                    delay: i * 0.08 + j * 0.04 + 0.2,
                    type: 'spring',
                    stiffness: 180,
                    damping: 14,
                  }}
                  whileHover={{ scale: 1.08, zIndex: 50 }}
                  onMouseEnter={(e) => handleClientHover(client, e.clientX, e.clientY)}
                  onMouseLeave={() => { setHoveredNode(null); setTooltip(null); }}
                  onPointerDown={(e) => handleNodePointerDown(e, nodeKey, client.x, client.y)}
                  onPointerUp={(e) => handleNodePointerUp(e, client, branch.category)}
                  onDoubleClick={(e) => {
                    // Modal Law: double-click opens drawer (same as single click)
                    e.stopPropagation();
                    e.preventDefault();
                    setDrawerClient(client);
                    setDrawerDepartment(branch.category);
                    setEditPopover(null);
                    setShowDrawerCompleted(false);
                  }}
                  title={`${client.name} (${client.tierIcon} ${client.tierLabel})${isGhost ? ' [חסר תאריך]' : ''}${isWaitingOnClient ? ' [ממתין ללקוח]' : ''} - לחץ לפתיחת כרטיס`}
                >
                  {/* Feature 7: Hover delete button */}
                  <button
                    className="absolute -bottom-1.5 -left-1.5 flex items-center justify-center rounded-full pointer-events-auto opacity-0 hover:!opacity-100 group-hover:opacity-70 transition-opacity"
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 1px 3px #00000033',
                      border: '1px solid #B0BEC5',
                      display: isHovered ? 'flex' : 'none',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // If client has a single topTask, offer to delete it; otherwise warn
                      if (client.topTask) {
                        setDeleteConfirm({ type: 'task', id: client.topTask.id, name: client.topTask.title });
                      } else {
                        toast.info('אין משימה פעילה למחיקה');
                      }
                    }}
                    title="מחק משימה"
                  >
                    <Trash2 className="w-2.5 h-2.5 text-[#78909C] hover:text-red-500" />
                  </button>

                  {/* Client display name — Zero Gray: black bold text */}
                  <span
                    className="font-bold leading-tight text-center px-2 truncate w-full"
                    style={{
                      fontSize: finalH < 45 ? '10px' : finalH < 55 ? '11px' : '12px',
                      color: '#000000',
                      maxWidth: finalW - 12,
                    }}
                  >
                    {isFrozen && <span title="קפוא - כל המשימות נדחו" style={{ marginInlineEnd: '3px' }}>🧊</span>}
                    {!isFrozen && procrastinatedCount > 0 && <span title={`${procrastinatedCount} משימות נדחו יותר מ-3 פעמים`} style={{ marginInlineEnd: '3px' }}>🐌</span>}
                    {isWaitingOnClient && <span title="ממתין ללקוח" style={{ marginInlineEnd: '3px' }}>⏳</span>}
                    {client.displayName}
                  </span>

                  {/* Iron Rule: Status label — synced with task table, vivid color */}
                  <span
                    className="leading-tight text-center px-1.5 truncate w-full font-bold"
                    style={{
                      fontSize: finalH < 45 ? '7.5px' : '8.5px',
                      color: client.worstStatusColor,
                      maxWidth: finalW - 12,
                      marginTop: '1px',
                    }}
                  >
                    {client.worstStatusLabel}
                  </span>

                  {/* Top task title — Zero Gray: dark text, no fading */}
                  {truncatedTask && (
                    <span
                      className="leading-tight text-center px-2 truncate w-full"
                      style={{
                        fontSize: finalH < 45 ? '7px' : '8px',
                        color: '#37474F',
                        maxWidth: finalW - 12,
                        marginTop: '0px',
                      }}
                    >
                      {truncatedTask}
                    </span>
                  )}

                  {/* Progress bar (thin, at bottom of pill) */}
                  {client.totalTasks > 0 && (
                    <div
                      className="absolute bottom-0 left-0 right-0 pointer-events-none"
                      style={{ height: '3px', borderRadius: '0 0 999px 999px', overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${(client.completedTasks / client.totalTasks) * 100}%`,
                          backgroundColor: diamondColor,
                          borderRadius: '0 0 999px 999px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  )}

                  {/* Task count badge */}
                  {client.totalTasks > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-white font-bold pointer-events-none"
                      style={{
                        width: 20,
                        height: 20,
                        fontSize: '9px',
                        backgroundColor: client.overdueTasks > 0 ? '#D32F2F' : diamondColor,
                        boxShadow: '0 1px 3px #00000040',
                        border: '1.5px solid #FFFFFF',
                      }}
                    >
                      {client.totalTasks - client.completedTasks}
                    </span>
                  )}

                  {/* Focus star toggle */}
                  <button
                    className="absolute -top-1.5 -left-1.5 flex items-center justify-center rounded-full pointer-events-auto"
                    style={{
                      width: 20,
                      height: 20,
                      backgroundColor: isFocused ? '#06B6D4' : '#FFFFFF',
                      boxShadow: '0 1px 3px #00000033',
                      border: isFocused ? '1.5px solid #0891B2' : '1.5px solid #B0BEC5',
                    }}
                    onClick={(e) => toggleClientFocus(client.name, e)}
                    title={isFocused ? 'הסר מפוקוס' : 'סמן כפוקוס'}
                  >
                    <Star className="w-2.5 h-2.5" style={{ color: isFocused ? '#fff' : '#9CA3AF', fill: isFocused ? '#fff' : 'none' }} />
                  </button>
                </motion.div>
              );
            })}

            {/* All clients shown — no overflow button */}
          </React.Fragment>
          );
        })}
      </div>
      {/* ── END transformed content layer ── */}

      {/* ── Floating Inbox (Parking Lot) - outside transform layer ── */}
      {inboxItems.length > 0 && (
        <motion.div
          className="absolute bottom-4 left-4 z-30"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="bg-white rounded-2xl shadow-xl border-2 border-purple-300 p-3 max-w-[240px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                <Cloud className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-sm font-bold text-purple-800">חניה</span>
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded-full">{inboxItems.length}</span>
            </div>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
              {inboxItems.map((item, idx) => (
                <motion.div
                  key={item.id || idx}
                  className="flex items-center gap-2 p-1.5 rounded-lg bg-purple-50 border border-purple-100 text-xs text-purple-800 animate-pulse cursor-grab"
                  draggable
                  whileHover={{ scale: 1.02 }}
                >
                  <GripVertical className="w-3 h-3 text-purple-400 shrink-0" />
                  <span className="truncate flex-1">{item.title}</span>
                  {onInboxDismiss && (
                    <button onClick={() => onInboxDismiss(item)} className="shrink-0 p-0.5 hover:bg-purple-200 rounded">
                      <X className="w-3 h-3 text-purple-400" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Controls Toolbar ── */}
      <div className="absolute top-3 left-3 z-40 flex flex-col gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white shadow-lg border-2 border-[#B0BEC5] text-[#37474F] hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
          title={isFullscreen ? 'יציאה ממסך מלא (Esc)' : 'מסך מלא'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white shadow-lg border-2 border-[#B0BEC5] text-[#37474F] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
          title="הגדל"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white shadow-lg border-2 border-[#B0BEC5] text-[#37474F] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
          title="הקטן"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleFitAll(); }}
          className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white shadow-lg border-2 border-[#B0BEC5] text-[#37474F] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
          title="התאם הכל"
        >
          <Move className="w-4 h-4" />
        </button>
        {/* Zoom level indicator */}
        <div className="flex items-center justify-center h-7 rounded-lg bg-white shadow border-2 border-[#B0BEC5] text-[10px] text-[#37474F] font-medium">
          {Math.round(zoom * 100)}%
        </div>

        {/* Spacing / Distance slider */}
        <div className="mt-2 flex flex-col items-center gap-1 bg-white rounded-[32px] shadow-lg border-2 border-[#B0BEC5] px-2 py-2" onClick={(e) => e.stopPropagation()}>
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#37474F]" />
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={spacingFactor}
            onChange={(e) => setSpacingFactor(parseFloat(e.target.value))}
            className="w-16 h-1 accent-indigo-500 cursor-pointer"
            style={{ writingMode: 'horizontal-tb' }}
            title={`מרווח: ${Math.round(spacingFactor * 100)}%`}
          />
          <span className="text-[9px] text-[#37474F]">{Math.round(spacingFactor * 100)}%</span>
        </div>

        {/* Crisis Mode toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setCrisisMode(prev => !prev); }}
          className={`flex items-center justify-center w-9 h-9 rounded-[32px] shadow-lg border-2 transition-all ${
            crisisMode
              ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
              : 'bg-white text-[#37474F] border-[#B0BEC5] hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
          }`}
          title={crisisMode ? 'מצב חירום פעיל — לחץ לביטול' : 'מצב חירום — סנן משימות לא דחופות'}
        >
          ⚡
        </button>

        {/* Reset manual positions button */}
        {Object.keys(manualPositions).length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setManualPositions({}); setAutoFitDone(false); localStorage.removeItem(POSITIONS_STORAGE_KEY); }}
            className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white shadow-lg border-2 border-[#B0BEC5] text-[#455A64] hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all text-[10px] font-medium"
            title="איפוס מיקומים ידניים"
          >
            ↺
          </button>
        )}
      </div>

      {/* Legends removed — node colors and sizes are self-explanatory via tooltip */}

      {/* ── Crisis Mode Banner ── */}
      {crisisMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-white rounded-full px-4 py-1.5 shadow-lg text-xs font-bold flex items-center gap-2">
          <span>⚡</span>
          <span>מצב חירום — מוצגות רק משימות דחופות</span>
          <button onClick={() => setCrisisMode(false)} className="hover:bg-amber-600 rounded-full p-0.5 ml-1">
            ✕
          </button>
        </div>
      )}

      {/* ── Pan hint (shows briefly on first load) ── */}
      {!autoFitDone && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl border-2 border-[#B0BEC5] px-6 py-4 text-center">
            <Move className="w-8 h-8 text-[#455A64] mx-auto mb-2" />
            <p className="text-sm text-[#000000] font-medium">מחשב תצוגה...</p>
          </div>
        </div>
      )}

      {/* ── Tooltip ── */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            className="fixed z-[10000] bg-white rounded-[32px] shadow-2xl border-2 border-[#455A64] p-3 pointer-events-none"
            style={{
              left: Math.min(tooltip.x + 15, window.innerWidth - 220),
              top: tooltip.y - 10,
            }}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tooltip.color }} />
              <span className="font-bold text-sm text-[#000000]">{tooltip.displayName || tooltip.name}</span>
              {tooltip.nickname && tooltip.nickname !== tooltip.name && (
                <span className="text-[10px] text-[#455A64]">({tooltip.name})</span>
              )}
              <span className="text-[10px] bg-[#E0F2F1] text-[#008291] px-1.5 rounded-full">{tooltip.tierIcon} {tooltip.tierLabel}</span>
              {tooltip.isFilingReady && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded font-semibold">מוכן לדיווח</span>
              )}
              {tooltip.hasWaitingOnClient && (
                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 rounded font-semibold">⏳ ממתין ללקוח</span>
              )}
            </div>
            {tooltip.topTaskTitle && (
              <p className="text-[11px] text-[#37474F] mb-1 truncate max-w-[200px]">📋 {tooltip.topTaskTitle}</p>
            )}
            <div className="flex items-center gap-3 text-[11px] text-[#000000]">
              <span>{tooltip.total} משימות</span>
              <span className="text-green-600">{tooltip.completed} הושלמו</span>
              {tooltip.overdue > 0 && (
                <span style={{ color: ZERO_PANIC.purple }}>{tooltip.overdue} באיחור</span>
              )}
            </div>
            <p className="text-[10px] text-[#455A64] mt-1">גרור להזיז · לחיצה כפולה → לוח העבודה</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Client Task Drawer (Sheet) ── */}
      <Sheet open={!!drawerClient} onOpenChange={(open) => { if (!open) { setDrawerClient(null); setDrawerDepartment(null); setHighlightTaskId(null); } }}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col border-l-2 border-[#B0BEC5] rounded-l-[32px]" dir="rtl" style={{ backgroundColor: '#FFFFFF' }}>
          {drawerClient && (() => {
            // Filter by client name, and optionally by department (P-branch context)
            const allClientTasks = tasks.filter(t => t.client_name === drawerClient.name);
            const clientTasks = drawerDepartment
              ? allClientTasks.filter(t => {
                  const dept = CATEGORY_TO_DEPARTMENT[t.category || 'אחר'] || t.category;
                  return dept === drawerDepartment;
                })
              : allClientTasks;
            const activeTasks = clientTasks.filter(t => t.status !== 'production_completed');
            const completedTasks = clientTasks.filter(t => t.status === 'production_completed');

            // Build parent→children map
            const childMap = {};
            clientTasks.forEach(t => {
              if (t.parent_id) {
                if (!childMap[t.parent_id]) childMap[t.parent_id] = [];
                childMap[t.parent_id].push(t);
              }
            });
            const rootActive = activeTasks.filter(t => !t.parent_id || !clientTasks.some(ct => ct.id === t.parent_id));

            // Zone brain dump: group Home tasks by room/zone
            const isHomeClient = clientTasks.some(t => {
              const dept = CATEGORY_TO_DEPARTMENT[t.category || 'אחר'] || t.category;
              return dept === 'בית' || t.category === 'home';
            });
            const zoneGroups = isHomeClient ? (() => {
              const groups = [];
              const matchedIds = new Set();
              HOME_ZONES.filter(z => z !== 'כללי').forEach(zone => {
                const zoneTasks = rootActive.filter(t => {
                  const text = (t.title + ' ' + (t.notes || '')).toLowerCase();
                  return text.includes(zone);
                });
                if (zoneTasks.length > 0) {
                  groups.push({ zone, tasks: zoneTasks });
                  zoneTasks.forEach(t => matchedIds.add(t.id));
                }
              });
              const unmatched = rootActive.filter(t => !matchedIds.has(t.id));
              if (unmatched.length > 0) groups.push({ zone: 'כללי', tasks: unmatched });
              return groups.length > 0 ? groups : null;
            })() : null;

            // ── Feature 4: Status cycling logic ──
            const STATUS_CYCLE = ['not_started', 'sent_for_review', 'production_completed'];
            const cycleStatus = async (task, e) => {
              e.stopPropagation();
              e.preventDefault();
              const currentIdx = STATUS_CYCLE.indexOf(task.status);
              const nextStatus = STATUS_CYCLE[(Math.max(currentIdx, 0) + 1) % STATUS_CYCLE.length];
              try {
                // Use parent's cascade-aware handler when available
                if (onStatusChange) {
                  await onStatusChange(task, nextStatus);
                } else {
                  await Task.update(task.id, { status: nextStatus });
                }
                toast.success(`${statusConfig[nextStatus]?.text || nextStatus}`);
                if (onTaskCreated) onTaskCreated();
              } catch (err) {
                toast.error('שגיאה בעדכון סטטוס');
              }
            };

            const renderTask = (task, depth = 0) => {
              const sts = statusConfig[task.status] || statusConfig.not_started;
              const children = childMap[task.id] || [];
              const isHighlighted = highlightTaskId && String(highlightTaskId) === String(task.id);

              // Feature 4: Status dot color classes for cycling
              const statusDotStyle = task.status === 'production_completed'
                ? 'bg-emerald-500' : task.status === 'sent_for_review'
                ? 'bg-purple-500' : task.status === 'needs_corrections'
                ? 'bg-orange-500' : task.status === 'waiting_for_materials'
                ? 'bg-amber-500' : 'bg-slate-400';

              return (
                <React.Fragment key={task.id}>
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 bg-white rounded-[24px] shadow-sm mb-2 mx-2 border border-[#E0E0E0] hover:shadow-md transition-all cursor-pointer group ${isHighlighted ? 'ring-2 ring-cyan-500 bg-cyan-50' : ''}`}
                    style={{ paddingRight: `${16 + depth * 20}px` }}
                    onClick={() => {
                      // Modal Law: click opens QuickAdd in edit mode
                      setDrawerEditTask(task);
                    }}
                  >
                    {depth > 0 && <GitBranchPlus className="w-3 h-3 text-violet-400 shrink-0" />}

                    {/* Feature 4: Clickable status toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                        cycleStatus(task, e);
                      }}
                      className={`w-4 h-4 rounded-full shrink-0 border-2 transition-all hover:scale-125 flex items-center justify-center cursor-pointer ${
                        task.status === 'production_completed' ? 'bg-emerald-500 border-emerald-500' :
                        task.status === 'sent_for_review' ? 'bg-purple-500 border-purple-500' :
                        task.status === 'needs_corrections' ? 'bg-orange-500 border-orange-500' :
                        task.status === 'waiting_for_materials' ? 'bg-amber-500 border-amber-500' :
                        'bg-white border-slate-300 hover:border-sky-400'
                      }`}
                      title={`סטטוס: ${sts.text} — לחץ לשנות`}
                    >
                      {task.status === 'production_completed' && <Check className="w-2.5 h-2.5 text-white" />}
                      {task.status === 'sent_for_review' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {/* Modal Law: no inline editing — click row to open full dialog */}
                      <p className="text-sm text-[#000000] truncate">
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-[10px] text-[#455A64]">{format(new Date(task.due_date), 'd/M', { locale: he })}</p>
                      )}
                    </div>
                    <Badge className={`${sts.color} text-[9px] px-1.5 py-0 shrink-0`}>{sts.text}</Badge>
                    {(task.reschedule_count || 0) > 3 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-bold ${(task.reschedule_count || 0) > 5 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        {(task.reschedule_count || 0) > 5 ? '🧊 קפוא' : `🐌 ×${task.reschedule_count}`}
                      </span>
                    )}
                    {/* Feature 5: Add sub-task button → opens full QuickAddTaskDialog with parent pre-filled */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                        setDrawerSubTaskParent(task);
                      }}
                      className="p-1 rounded-[32px] hover:bg-emerald-50 text-[#B0BEC5] hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="הוסף תת-משימה"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Sub-task creation is now handled by QuickAddTaskDialog modal via drawerSubTaskParent */}

                  {children.filter(c => c.status !== 'production_completed').map(child => renderTask(child, depth + 1))}
                </React.Fragment>
              );
            };

            return (
              <>
                {/* Drawer Header */}
                <div className="px-5 pt-5 pb-3 border-b-2 border-[#E0E0E0] bg-white rounded-tr-[32px]">
                  <SheetHeader className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: drawerClient.color }} />
                      <SheetTitle className="text-base">{drawerClient.displayName || drawerClient.name}</SheetTitle>
                      {drawerDepartment && (
                        <span className="text-[10px] bg-[#E0F2F1] text-[#004D40] px-1.5 rounded-full border border-[#80CBC4]">{drawerDepartment}</span>
                      )}
                      <span className="text-[10px] bg-[#E0F2F1] text-[#008291] px-1.5 rounded-full">{drawerClient.tierIcon} {drawerClient.tierLabel}</span>
                      <button
                        onClick={() => toggleClientFocus(drawerClient.name)}
                        className={`p-1 rounded-full transition-colors ${focusedClients.has(drawerClient.name) ? 'bg-cyan-100 text-cyan-600' : 'bg-[#E0F2F1] text-[#455A64] hover:text-cyan-500'}`}
                        title={focusedClients.has(drawerClient.name) ? 'הסר מפוקוס' : 'סמן כפוקוס'}
                      >
                        <Star className="w-3.5 h-3.5" style={{ fill: focusedClients.has(drawerClient.name) ? 'currentColor' : 'none' }} />
                      </button>
                    </div>
                    <SheetDescription className="text-right">
                      <span className="text-xs text-[#37474F]">{activeTasks.length} פעילות · {completedTasks.length} הושלמו</span>
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setDrawerQuickAdd(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[32px] bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      הוסף משימה
                    </button>
                    <button
                      onClick={() => {
                        handleClientDoubleClick(drawerClient);
                        setDrawerClient(null);
                      }}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-[32px] bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      כרטיס לקוח
                    </button>
                  </div>
                </div>

                {/* Active Tasks List */}
                <div className="flex-1 overflow-y-auto px-1 py-2">
                  {rootActive.length === 0 ? (
                    <div className="text-center py-8 text-[#455A64]">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#B0BEC5]" />
                      <p className="text-sm">אין משימות פעילות</p>
                    </div>
                  ) : zoneGroups ? (
                    zoneGroups.map(group => (
                      <div key={group.zone}>
                        <div className="px-4 py-1.5 text-[10px] font-bold text-[#008291] bg-[#E0F2F1] sticky top-0 border-b border-[#B0BEC5]">
                          📍 {group.zone}
                        </div>
                        {group.tasks.map(task => renderTask(task, 0))}
                      </div>
                    ))
                  ) : (
                    rootActive.map(task => renderTask(task, 0))
                  )}

                  {/* Completed tasks — collapsible */}
                  {completedTasks.length > 0 && (
                    <div className="border-t mt-2">
                      <button
                        onClick={() => setShowDrawerCompleted(!showDrawerCompleted)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-[#37474F] hover:bg-[#E0F2F1] transition-colors rounded-[32px] mx-2"
                      >
                        <ChevronDown className={`w-3 h-3 transition-transform ${showDrawerCompleted ? '' : 'rotate-[-90deg]'}`} />
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span>הושלמו ({completedTasks.length})</span>
                      </button>
                      {showDrawerCompleted && completedTasks.map(task => {
                        const sts = statusConfig[task.status] || statusConfig.completed;
                        return (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 px-4 py-2 bg-[#F5F5F5] rounded-[24px] mx-2 mb-1.5 hover:bg-[#EEEEEE] cursor-pointer transition-all"
                            onClick={() => setDrawerEditTask(task)}
                          >
                            <button
                              onClick={(e) => cycleStatus(task, e)}
                              className="w-3.5 h-3.5 rounded-full shrink-0 border-2 bg-emerald-500 border-emerald-500 flex items-center justify-center transition-all hover:scale-125"
                              title="לחץ להחזיר לטרם התחיל"
                            >
                              <Check className="w-2 h-2 text-white" />
                            </button>
                            <p className="text-xs text-[#78909C] flex-1 truncate line-through">{task.title}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ── QuickAddTaskDialog for drawer ── */}
      <QuickAddTaskDialog
        open={drawerQuickAdd}
        onOpenChange={setDrawerQuickAdd}
        defaultClientId={drawerClient?.clientId || null}
        lockedClient={!!drawerClient?.clientId}
        onCreated={() => {
          setDrawerQuickAdd(false);
          onTaskCreated?.();
        }}
      />

      {/* ── QuickAddTaskDialog for sub-task from drawer ── */}
      <QuickAddTaskDialog
        open={!!drawerSubTaskParent}
        onOpenChange={(val) => { if (!val) setDrawerSubTaskParent(null); }}
        defaultParentId={drawerSubTaskParent?.id || null}
        defaultClientId={drawerClient?.clientId || null}
        lockedParent={true}
        lockedClient={!!drawerClient?.clientId}
        onCreated={() => {
          setDrawerSubTaskParent(null);
          onTaskCreated?.();
        }}
      />

      {/* ── TaskEditDialog for editing a task from drawer (uniform across all views) ── */}
      <TaskEditDialog
        task={drawerEditTask}
        open={!!drawerEditTask}
        onClose={() => setDrawerEditTask(null)}
        onSave={async (taskId, updatedData) => {
          try {
            await Task.update(taskId, updatedData);
            setDrawerEditTask(null);
            onTaskCreated?.();
          } catch (err) {
            console.error('שגיאה בעדכון משימה:', err);
          }
        }}
        onDelete={async (task) => {
          try {
            await Task.delete(task.id);
            setDrawerEditTask(null);
            onTaskCreated?.();
          } catch (err) {
            console.error('שגיאה במחיקת משימה:', err);
          }
        }}
        allTasks={tasks}
        onTaskCreated={() => { onTaskCreated?.(); }}
      />

      {/* ── Focus Mode Indicator ── */}
      {focusMode && selectedBranch && (
        <motion.div
          className="absolute bottom-4 right-4 z-30 bg-white rounded-lg px-3 py-1.5 shadow-md border-2 border-[#B0BEC5] text-xs text-[#000000]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Spotlight: <strong>{selectedBranch}</strong>
          <button
            className="mr-2 text-[#455A64] hover:text-[#000000]"
            onClick={() => setSelectedBranch(null)}
          >
            ×
          </button>
        </motion.div>
      )}

      {/* ── Fullscreen exit hint ── */}
      {isFullscreen && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-white rounded-full px-4 py-1.5 shadow-md border-2 border-[#B0BEC5] text-xs text-[#000000]">
          ESC ליציאה ממסך מלא
        </div>
      )}

      {/* ── Feature 7: Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את המשימה?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.name ? `"${deleteConfirm.name}"` : 'המשימה'} תימחק לצמיתות. פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 justify-start">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={async () => {
                if (!deleteConfirm) return;
                try {
                  await Task.delete(deleteConfirm.id);
                  onTaskCreated?.();
                  toast.success('המשימה נמחקה');
                } catch (err) {
                  toast.error('שגיאה במחיקה');
                }
                setDeleteConfirm(null);
              }}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
