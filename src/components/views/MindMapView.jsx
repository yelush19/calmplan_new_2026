import React, { useMemo, useState, useCallback, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Cloud, Inbox, GripVertical, X, Sparkles, Plus, Calendar, CheckCircle, Edit3, ExternalLink, Maximize2, Minimize2, ZoomIn, ZoomOut, Move, Pencil, ChevronDown, GitBranchPlus, SlidersHorizontal, Star, Trash2, Check, RefreshCw } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Task, Client } from '@/api/entities';
import { dedupTasksForMonth } from '@/api/functions';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { TASK_STATUS_CONFIG as statusConfig } from '@/config/processTemplates';
import QuickAddTaskDialog from '@/components/tasks/QuickAddTaskDialog';
import { computeComplexityTier, getBubbleRadius, getTierInfo } from '@/lib/complexity';
import { COMPLEXITY_TIERS } from '@/lib/theme-constants';

// ─── Zero-Panic Palette (Cyan/Teal — NO RED) ───────────────────
const ZERO_PANIC = {
  orange:  '#00acc1',  // Cyan for focus (Due Today / Critical)
  purple:  '#008291',  // Teal for importance (Overdue / Late)
  green:   '#2E7D32',  // Done
  blue:    '#008291',  // Teal — Active / In Progress
  gray:    '#90A4AE',  // Not Started
  amber:   '#FF8F00',  // Waiting / Issue
  teal:    '#008291',  // Primary teal
  cyan:    '#00acc1',  // Secondary cyan
  indigo:  '#3949AB',  // Ready for Reporting
};

const STATUS_TO_COLOR = {
  completed:                       ZERO_PANIC.green,      // הושלם
  in_progress:                     ZERO_PANIC.blue,       // בעבודה
  not_started:                     ZERO_PANIC.gray,       // טרם התחיל
  remaining_completions:           '#00ACC1',             // נותרו השלמות - cyan
  postponed:                       '#78909C',             // נדחה - blue-gray
  waiting_for_approval:            '#AB47BC',             // לבדיקה - purple
  waiting_for_materials:           ZERO_PANIC.amber,      // ממתין לחומרים
  issue:                           '#E91E63',             // דורש טיפול - pink (attention!)
  ready_for_reporting:             ZERO_PANIC.indigo,     // מוכן לדיווח
  reported_waiting_for_payment:    '#FBC02D',             // ממתין לתשלום - yellow
  waiting_on_client:               '#F59E0B',             // ממתין ללקוח - amber
  pending_external:                '#1565C0',             // מחכה לצד ג' - deep blue
  not_relevant:                    '#B0BEC5',             // לא רלוונטי - light gray
};

// Cascade-aware color overrides for client nodes
const NODE_COLOR_MAP = {
  emerald: '#2E7D32',
  blue:    '#1565C0',
  amber:   '#FF8F00',
  teal:    '#00897B',
  sky:     '#0288D1',
  slate:   '#90A4AE',
};

// ─── HIERARCHY: 4 Business Categories (NO catch-all bucket) ───────────────
// Root → Meta-Folder (4 hexagons) → Department → Client Leaves
// MATH LAW: Sum of all hexagon task counts MUST equal total task count
// After nuclear dedup: 19 clients × ~3 groups = ~57 tasks
const META_FOLDERS = {
  'שכר': {
    icon: '👥', color: '#0277BD', label: 'Payroll',
    departments: ['שכר', 'ביטוח לאומי', 'ניכויים'],
    complexitySubFolders: true,
  },
  'מע"מ ומקדמות': {
    icon: '📊', color: '#00838F', label: 'VAT/Advances',
    departments: ['מע"מ', 'מקדמות'],
    complexitySubFolders: true,
  },
  'מאזנים': {
    icon: '⚖️', color: '#00695C', label: 'Balance Sheets',
    departments: ['התאמות', 'מאזנים', 'דוח שנתי'],
  },
  'שירותים נוספים': {
    icon: '🔧', color: '#546E7A', label: 'Additional Services',
    // Absorbs ALL unmapped categories — NO "pending" bucket
    departments: ['הנהלת חשבונות', 'אדמיניסטרציה', 'בית', 'אחר/טיוטות'],
    forceNano: true,
  },
};

// Department folder nodes
const BRANCH_CONFIG = {
  'שכר':              { color: '#0277BD', icon: '👥', label: 'Payroll' },
  'מע"מ':             { color: '#00838F', icon: '📊', label: 'VAT' },
  'ביטוח לאומי':      { color: '#4527A0', icon: '🏛️', label: 'NI' },
  'ניכויים':          { color: '#4527A0', icon: '📋', label: 'Deduct' },
  'מקדמות':           { color: '#00838F', icon: '💰', label: 'Advances' },
  'התאמות':           { color: '#00695C', icon: '🔄', label: 'Reconcile' },
  'מאזנים':           { color: '#00695C', icon: '⚖️', label: 'Balance' },
  'דוח שנתי':         { color: '#00695C', icon: '📑', label: 'Annual' },
  'הנהלת חשבונות':    { color: '#546E7A', icon: '📒', label: 'Bookkeeping' },
  'אדמיניסטרציה':     { color: '#546E7A', icon: '📁', label: 'Admin' },
  'בית':              { color: '#6D4C41', icon: '🏠', label: 'Home' },
  'ביטוח לאומי דיווח': { color: '#4527A0', icon: '🏛️', label: 'NI Report' },
  'ניכויים דיווח':     { color: '#4527A0', icon: '📋', label: 'Deduct Report' },
  'אחר/טיוטות':        { color: '#78909C', icon: '📝', label: 'Others/Drafts' },
};

// Complexity tier labels for sub-grouping inside Payroll / VAT
const COMPLEXITY_SUB_LABELS = {
  0: { key: 'ננו', icon: '⚡', label: 'Nano' },
  1: { key: 'פשוט', icon: '📄', label: 'Simple' },
  2: { key: 'בינוני', icon: '📦', label: 'Medium' },
  3: { key: 'מורכב', icon: '🏢', label: 'Large' },
};

// Map ALL task categories (Hebrew + work_* English) to department keys
const CATEGORY_TO_DEPARTMENT = {
  // Payroll group
  'שכר': 'שכר',
  'work_payroll': 'שכר',
  // VAT/Advances group
  'מע"מ': 'מע"מ',
  'work_vat_reporting': 'מע"מ',
  'מע"מ 874': 'מע"מ',
  'work_vat_874': 'מע"מ',
  'מקדמות מס': 'מקדמות',
  'work_tax_advances': 'מקדמות',
  // Authority Reports group
  'ביטוח לאומי': 'ביטוח לאומי',
  'work_social_security': 'ביטוח לאומי',
  'ניכויים': 'ניכויים',
  'work_deductions': 'ניכויים',
  // Balance Sheets group
  'התאמות': 'התאמות',
  'work_reconciliation': 'התאמות',
  'מאזנים': 'מאזנים',
  'דוח שנתי': 'דוח שנתי',
  'work_client_management': 'דוח שנתי',
  'work_annual_reports': 'דוח שנתי',
  // Additional Services group
  'הנהלת חשבונות': 'הנהלת חשבונות',
  'work_bookkeeping': 'הנהלת חשבונות',
  'הנחש': 'התאמות',
  'home': 'בית',
  'personal': 'אדמיניסטרציה',
  'אחר': 'אדמיניסטרציה',
};

// ─── Node Scaling by Complexity Tier (3:1 ratio from Enterprise to Nano) ──
// Base radius: tier 0 (Nano) = 22px → tier 3 (Complex) = 66px  (3:1)
// Wide screen base: 30px → tier 3 = 90px
const BASE_RADIUS = 28;
const BASE_RADIUS_WIDE = 36;

// Legacy S/M/L kept for tooltip display only
const SIZE_LABELS = { 0: 'ננו', 1: 'פשוט', 2: 'בינוני', 3: 'מורכב' };

function getComplexityTier(client, tasks) {
  // If client entity available, use full computation (respects manual override)
  if (client) return computeComplexityTier(client);
  // Fallback: estimate from task count when no client entity
  const taskCount = tasks.length;
  if (taskCount >= 8) return 3;
  if (taskCount >= 4) return 2;
  if (taskCount >= 2) return 1;
  return 0;
}

function getNodeRadius(tier, isWide = false) {
  const base = isWide ? BASE_RADIUS_WIDE : BASE_RADIUS;
  return getBubbleRadius(tier, base);
}

function getNodeColor(task) {
  if (!task) return ZERO_PANIC.gray;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (task.status === 'completed') return ZERO_PANIC.green;

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

  return STATUS_TO_COLOR[task.status] || ZERO_PANIC.blue || '#90A4AE';
}

/**
 * Compute the aggregate color and visual state for a client node.
 * Priority: overdue > due today > pending_external > active > all completed
 * Returns { color, shouldPulse, completionRatio }
 */
function getClientAggregateState(clientTasks) {
  if (!clientTasks || clientTasks.length === 0) {
    return { color: ZERO_PANIC.gray, shouldPulse: false, completionRatio: 0, statusRing: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const active = clientTasks.filter(t => t.status !== 'not_relevant');
  const completed = active.filter(t => t.status === 'completed').length;
  const total = active.length;
  const completionRatio = total > 0 ? completed / total : 0;

  // All completed = green (ADHD Focus: pushed to edges, statusRing 0 = outermost)
  if (total > 0 && completed === total) {
    return { color: ZERO_PANIC.green, shouldPulse: false, completionRatio: 1, statusRing: 0 };
  }

  // Priority: overdue > due today > pending_external > ready_for_reporting > active
  // statusRing: higher = closer to center (ADHD Focus)
  const hasOverdue = clientTasks.some(t => {
    if (t.status === 'completed' || t.status === 'not_relevant') return false;
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    due.setHours(23, 59, 59, 999);
    return due < today;
  });
  if (hasOverdue) return { color: ZERO_PANIC.purple, shouldPulse: true, completionRatio, statusRing: 4 };

  const hasDueToday = clientTasks.some(t => {
    if (t.status === 'completed' || t.status === 'not_relevant') return false;
    if (!t.due_date) return false;
    const dueDay = new Date(t.due_date);
    dueDay.setHours(0, 0, 0, 0);
    return dueDay.getTime() === today.getTime();
  });
  if (hasDueToday) return { color: ZERO_PANIC.orange, shouldPulse: false, completionRatio, statusRing: 4 };

  // Pending external = blue (ball is not in Lena's court) - mid ring
  const hasPendingExternal = clientTasks.some(t => t.status === 'pending_external');
  if (hasPendingExternal) return { color: '#1565C0', shouldPulse: false, completionRatio, statusRing: 1 };

  // Ready for reporting = AMBER GLOW (ADHD Focus: pull toward center)
  const hasReadyForReporting = clientTasks.some(t => t.status === 'ready_for_reporting');
  if (hasReadyForReporting) return { color: ZERO_PANIC.amber, shouldPulse: false, completionRatio, isFilingReady: true, statusRing: 3 };

  const hasActive = clientTasks.some(t =>
    t.status !== 'completed' && t.status !== 'not_relevant'
  );
  if (hasActive) return { color: ZERO_PANIC.blue, shouldPulse: false, completionRatio, statusRing: 2 };

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
export default function MindMapView({ tasks, clients, inboxItems = [], onInboxDismiss, focusMode = false, onEditTask, onTaskCreated, focusTaskId = null, focusClientName = null, onFocusHandled }) {
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

  // ── AUTO-DEDUP: Run once on mount to purge duplicate tasks (the 57 rule) ──
  const dedupRan = useRef(false);
  useEffect(() => {
    if (dedupRan.current || !tasks || tasks.length === 0) return;
    dedupRan.current = true;
    dedupTasksForMonth({ year: 2026, month: 2 }).then(res => {
      if (res?.data?.deleted > 0) {
        console.log(`[CalmPlan] Auto-dedup: removed ${res.data.deleted} duplicate tasks`);
        // Trigger reload to reflect cleaned data
        window.location.reload();
      }
    }).catch(() => {});
  }, [tasks]);

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
  const LAYOUT_VERSION = 'v6-nuclear-cleanup'; // bump this to force reset
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
  const MAX_VISIBLE_CHILDREN = 10;
  const [expandedMetaFolders, setExpandedMetaFolders] = useState(new Set());
  const [expandedBranches, setExpandedBranches] = useState(new Set());
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
  const { branches, clientNodes, centerLabel, todayTasks, metaFolders } = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const centerLabel = format(today, 'EEEE, d/M', { locale: he });

    // Group tasks by category → client
    const catClientMap = {};
    const activeTasks = tasks.filter(t => {
      if (t.status === 'not_relevant') return false;
      if (!crisisMode) return true;
      // Crisis mode: keep only urgent/high priority tasks
      const dept = CATEGORY_TO_DEPARTMENT[t.category || 'אחר'] || t.category;
      if (dept === 'בית') return t.priority === 'urgent' || t.priority === 'high';
      return t.priority !== 'low';
    });

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
        const activeTasks = clientTasks.filter(t => t.status !== 'completed' && t.status !== 'not_relevant');
        const topTask = activeTasks[0] || null;
        // Check for waiting_on_client status
        const hasWaitingOnClient = clientTasks.some(t => t.status === 'waiting_on_client');
        return {
          name,
          displayName,
          nickname: client?.nickname || '',
          clientId: client?.id,
          tier,
          tierLabel: tierInfo.label,
          tierIcon: tierInfo.icon,
          ...getClientAggregateState(clientTasks),
          tasks: clientTasks,
          topTask,
          hasWaitingOnClient,
          totalTasks: clientTasks.length,
          completedTasks: clientTasks.filter(t => t.status === 'completed').length,
          overdueTasks: clientTasks.filter(t => {
            if (t.status === 'completed') return false;
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

    // ── COMPLEXITY SUB-GROUPS: Inside Payroll and VAT, group clients by tier ──
    branches.forEach(branch => {
      if (branch.metaConfig?.complexitySubFolders) {
        // Build tier groups from clients in this branch
        const tierGroups = {};
        branch.clients.forEach(client => {
          const t = client.tier || 0;
          if (!tierGroups[t]) tierGroups[t] = [];
          tierGroups[t].push(client);
        });
        // Generate sub-folder entries for each tier that has clients
        branch.config = { ...branch.config }; // clone to avoid mutation
        branch.config.subFolders = Object.keys(tierGroups)
          .map(Number)
          .sort()
          .map(t => ({
            key: COMPLEXITY_SUB_LABELS[t]?.key || `tier-${t}`,
            icon: COMPLEXITY_SUB_LABELS[t]?.icon || '📄',
            label: COMPLEXITY_SUB_LABELS[t]?.label || `Tier ${t}`,
            tier: t,
            clientNames: tierGroups[t].map(c => c.name),
          }));
        // Tag each client with its complexity sub-folder
        branch.clients.forEach(client => {
          const t = client.tier || 0;
          const subLabel = COMPLEXITY_SUB_LABELS[t]?.key || `tier-${t}`;
          client._complexitySubFolder = subLabel;
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
    // Only show meta-folders that have actual tasks (no empty buckets)
    const metaFolders = Object.values(metaGroups);

    // Build flat client nodes for rendering
    const clientNodes = [];
    branches.forEach(branch => {
      branch.clients.forEach(client => {
        clientNodes.push({ ...client, category: branch.category });
      });
    });

    // Today-only: tasks whose due_date is exactly today (for center node)
    const todayTasks = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'not_relevant') return false;
      return t.due_date === todayStr;
    });

    return { branches, clientNodes, centerLabel, todayTasks, metaFolders };
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

  // ── Layout Calculation: RADIAL SYMMETRY + Departments Near Parent Hex + Collision Push ──
  const layout = useMemo(() => {
    const w = Math.max(dimensions.width, 600);
    const h = Math.max(dimensions.height, 400);
    const isWide = w >= 1600;
    const cx = w / 2;
    const cy = h / 2;
    const centerR = isWide ? 55 : 48;

    const padX = 80;
    const padY = 60;
    const scaleX = (w - padX * 2) * 0.22 * spacingFactor;
    const scaleY = (h - padY * 2) * 0.22 * spacingFactor;
    const baseLeafDist = 55;

    // ─── PHASE 0: RADIAL SYMMETRY — Meta-folder hexagons at equal angles FIRST ───
    // Equal angular distribution: 5 hexagons → 72° apart, 4 → 90°, etc.
    // Start from top (-π/2) for visual balance
    const metaCount = metaFolders.length;
    const metaAngleStep = (2 * Math.PI) / Math.max(metaCount, 1);
    // Distance from center: proportional to viewport, min 130px for readability
    const basemetaDist = Math.max(130, Math.min(Math.max(scaleX, scaleY) * 0.65, 200));

    let metaFolderPositions = metaFolders.map((mf, i) => {
      const angle = i * metaAngleStep - Math.PI / 2;
      // TREE-SHIFTING: expanded hexagons push 50px further to make room for children
      const expandBonus = expandedMetaFolders.has(mf.name) ? 50 : 0;
      const finalDist = basemetaDist + expandBonus;
      const mx = cx + Math.cos(angle) * finalDist;
      const my = cy + Math.sin(angle) * finalDist;
      const manualKey = `meta-${mf.name}`;
      const manual = manualPositions[manualKey];
      return {
        ...mf,
        x: manual?.x ?? mx,
        y: manual?.y ?? my,
        angle,
      };
    });

    // ─── COLLISION PUSH between meta-folder hexagons (200px minimum gap) ───
    const META_MIN_GAP = 200;
    for (let pass = 0; pass < 8; pass++) {
      let shifted = false;
      for (let i = 0; i < metaFolderPositions.length; i++) {
        for (let j = i + 1; j < metaFolderPositions.length; j++) {
          const a = metaFolderPositions[i];
          const b = metaFolderPositions[j];
          // Skip if either has manual position
          if (manualPositions[`meta-${a.name}`] || manualPositions[`meta-${b.name}`]) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Expanded hexagons need more space
          const aRadius = expandedMetaFolders.has(a.name) ? 90 : 50;
          const bRadius = expandedMetaFolders.has(b.name) ? 90 : 50;
          const minDist = aRadius + bRadius + META_MIN_GAP;
          if (dist < minDist && dist > 0) {
            shifted = true;
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
          }
        }
      }
      if (!shifted) break;
    }

    // ─── PHASE 1: Position departments around their PARENT hexagon ───
    const allClientNodes = [];
    const deptDist = 90; // departments 90px from their parent hexagon

    const branchPositions = branches.map((branch) => {
      const parentMeta = metaFolderPositions.find(m => m.name === branch.metaFolder);
      if (!parentMeta) {
        return { ...branch, x: cx, y: cy, angle: 0, clientPositions: [], subFolderPositions: null };
      }

      // Find siblings (other departments under same hexagon)
      const siblings = branches.filter(b => b.metaFolder === branch.metaFolder);
      const sibIdx = siblings.indexOf(branch);
      const sibCount = siblings.length;

      // Fan out radially from hexagon in the direction of hexagon from center
      const spreadAngle = sibCount <= 1 ? 0 : Math.PI * 0.7;
      const baseAngle = parentMeta.angle;
      const branchAngle = sibCount <= 1
        ? baseAngle
        : baseAngle + (sibIdx - (sibCount - 1) / 2) * (spreadAngle / Math.max(sibCount - 1, 1));

      const bx = parentMeta.x + Math.cos(branchAngle) * deptDist;
      const by = parentMeta.y + Math.sin(branchAngle) * deptDist;

      // Position client leaf nodes in a RADIAL CIRCLE around department
      // No overlapping — full circle spread when many clients
      const clientCount = branch.clients.length;
      const clientAngleSpread = clientCount <= 3
        ? Math.PI * 0.7
        : Math.min(Math.PI * 1.5, clientCount * 0.55);
      const sortedClients = [...branch.clients].sort((a, b) => (b.statusRing || 0) - (a.statusRing || 0));

      const clientPositions = sortedClients.map((client, j) => {
        const clientAngle = branchAngle + (j - (clientCount - 1) / 2) * (clientAngleSpread / Math.max(clientCount - 1, 1));
        const statusDistMultiplier = {
          4: 0.82, 3: 0.88, 2: 1.0, 1: 1.0, 0: 1.3,
        }[client.statusRing || 2] || 1.0;
        const stagger = (j % 2) * Math.min(20, baseLeafDist * 0.15);
        const dist = (baseLeafDist + stagger) * statusDistMultiplier;
        const nodeRadius = getNodeRadius(client.tier, isWide);

        const node = {
          ...client,
          radius: nodeRadius,
          x: bx + Math.cos(clientAngle) * dist,
          y: by + Math.sin(clientAngle) * dist,
          branchX: bx,
          branchY: by,
        };
        allClientNodes.push(node);
        return node;
      });

      // Complexity sub-folder positions (Payroll/VAT)
      let subFolderPositions = null;
      if (branch.config.subFolders && branch.config.subFolders.length > 0) {
        const subCount = branch.config.subFolders.length;
        const subSpread = Math.PI * 0.5;
        const subDist = Math.min(baseLeafDist * 1.2, 40);
        subFolderPositions = branch.config.subFolders.map((sub, si) => {
          const subAngle = branchAngle + (si - (subCount - 1) / 2) * (subSpread / Math.max(subCount - 1, 1));
          return {
            ...sub,
            x: bx + Math.cos(subAngle) * subDist,
            y: by + Math.sin(subAngle) * subDist,
          };
        });
        clientPositions.forEach(cp => {
          const matchKey = cp._complexitySubFolder || COMPLEXITY_SUB_LABELS[cp.tier || 0]?.key || subFolderPositions[0]?.key;
          const subFolder = subFolderPositions.find(s => s.key === matchKey) || subFolderPositions[0];
          if (subFolder) {
            cp._subFolderX = subFolder.x;
            cp._subFolderY = subFolder.y;
          }
        });
      }

      return {
        ...branch,
        x: bx,
        y: by,
        angle: branchAngle,
        clientPositions,
        subFolderPositions,
      };
    });

    // ─── PHASE 2: Spring Force + Collision Detection for client nodes ───
    const MIN_GAP = 4;
    const SPRING_STRENGTH = 0.3;
    const MAX_PARENT_DIST = 100;
    const getPillHalfWidth = (r) => Math.max(r * 1.2, 45);
    for (let pass = 0; pass < 12; pass++) {
      let hadCollision = false;
      for (let i = 0; i < allClientNodes.length; i++) {
        for (let j = i + 1; j < allClientNodes.length; j++) {
          const a = allClientNodes[i];
          const b = allClientNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = getPillHalfWidth(a.radius) + getPillHalfWidth(b.radius) + MIN_GAP;
          if (dist < minDist && dist > 0) {
            hadCollision = true;
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
          }
        }
      }
      allClientNodes.forEach(node => {
        const dx = node.branchX - node.x;
        const dy = node.branchY - node.y;
        node.x += dx * SPRING_STRENGTH;
        node.y += dy * SPRING_STRENGTH;
        const dx2 = node.x - node.branchX;
        const dy2 = node.y - node.branchY;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (dist2 > MAX_PARENT_DIST) {
          const scale = MAX_PARENT_DIST / dist2;
          node.x = node.branchX + dx2 * scale;
          node.y = node.branchY + dy2 * scale;
        }
      });
      if (!hadCollision) break;
    }

    // Sync collision-resolved positions back
    branchPositions.forEach(branch => {
      branch.clientPositions.forEach(cp => {
        const resolved = allClientNodes.find(n => n.name === cp.name && n.category === cp.category);
        if (resolved) { cp.x = resolved.x; cp.y = resolved.y; }
      });
    });

    // Apply folder manual position overrides
    branchPositions.forEach(branch => {
      const folderKey = `folder-${branch.category}`;
      const folderPos = manualPositions[folderKey];
      if (folderPos && typeof folderPos.x === 'number' && typeof folderPos.y === 'number') {
        const deltaX = folderPos.x - branch.x;
        const deltaY = folderPos.y - branch.y;
        branch.x = folderPos.x;
        branch.y = folderPos.y;
        if (branch.subFolderPositions) {
          branch.subFolderPositions.forEach(sub => { sub.x += deltaX; sub.y += deltaY; });
        }
        branch.clientPositions.forEach(cp => {
          const childKey = `${branch.category}-${cp.name}`;
          if (!manualPositions[childKey]) { cp.x += deltaX; cp.y += deltaY; }
        });
      }
    });

    // Apply client manual position overrides
    branchPositions.forEach(branch => {
      branch.clientPositions.forEach(cp => {
        const key = `${branch.category}-${cp.name}`;
        const pos = manualPositions[key];
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          cp.x = pos.x;
          cp.y = pos.y;
        }
      });
    });

    // ── Level 2: Meta sub-folder positions ──
    const metaSubFolderPositions = [];
    metaFolderPositions.forEach(mfPos => {
      const metaConfig = META_FOLDERS[mfPos.name];
      if (!metaConfig?.subFolders) return;
      metaConfig.subFolders.forEach((sf) => {
        const sfBranches = branchPositions.filter(b => sf.departments.includes(b.category));
        if (sfBranches.length === 0) return;
        const avgX = sfBranches.reduce((s, b) => s + b.x, 0) / sfBranches.length;
        const avgY = sfBranches.reduce((s, b) => s + b.y, 0) / sfBranches.length;
        let sx = mfPos.x * 0.6 + avgX * 0.4;
        let sy = mfPos.y * 0.6 + avgY * 0.4;
        const sfDx = sx - mfPos.x, sfDy = sy - mfPos.y;
        const sfDist = Math.sqrt(sfDx * sfDx + sfDy * sfDy);
        if (sfDist > 60) { const sfScale = 60 / sfDist; sx = mfPos.x + sfDx * sfScale; sy = mfPos.y + sfDy * sfScale; }
        const manualKey = `metasub-${mfPos.name}-${sf.key}`;
        const manual = manualPositions[manualKey];
        metaSubFolderPositions.push({
          ...sf,
          metaFolderName: mfPos.name,
          x: manual?.x ?? sx,
          y: manual?.y ?? sy,
        });
        sfBranches.forEach(b => {
          b._metaSubX = manual?.x ?? sx;
          b._metaSubY = manual?.y ?? sy;
          b._metaSubKey = sf.key;
        });
      });
    });

    return { cx, cy, centerR, branchPositions, metaFolderPositions, metaSubFolderPositions, virtualW: w, virtualH: h, isWide };
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
        // Folder drag: move folder + all children without their own manual override
        setManualPositions(prev => {
          const next = { ...prev, [node.key]: { x: node.origX + dx, y: node.origY + dy } };
          if (node.childPositions) {
            node.childPositions.forEach(child => {
              if (!prev[child.key]) {
                next[child.key] = { x: child.x + dx, y: child.y + dy };
              }
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
  const handleNodePointerUp = useCallback((e, client) => {
    const wasDragging = nodeHasDragged.current;
    draggingNode.current = null;
    nodeHasDragged.current = false;
    if (wasDragging) {
      // onNodeDragStop: save positions immediately to localStorage
      setManualPositions(prev => { savePositionsToStorage(prev); return prev; });
      return;
    }
    // Modal Law: single click opens drawer immediately (no double-click distinction)
    setDrawerClient(client);
    setEditPopover(null);
    setShowDrawerCompleted(false);
  }, [savePositionsToStorage]);

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
    // Department branches + their clients
    layout.branchPositions.forEach(branch => {
      if (branch.metaFolder === metaName) {
        childPositions.push({ key: `folder-${branch.category}`, x: branch.x, y: branch.y });
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
      // Include sub-folder nodes
      branch.subFolderPositions?.forEach(sub => {
        childPositions.push({ key: `sub-${category}-${sub.key}`, x: sub.x, y: sub.y });
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
        <div className="p-6 rounded-[32px] backdrop-blur-2xl bg-white/40 border border-white/20 shadow-2xl flex flex-col items-center gap-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-rose-100/60 flex items-center justify-center">
            <Cloud className="w-8 h-8 text-rose-500" />
          </div>
          <p className="text-lg font-bold text-slate-700">שגיאת חיבור</p>
          <p className="text-sm text-slate-500 text-center">{fetchError}</p>
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

  if (tasks.length === 0 && inboxItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
        <Sparkles className="w-12 h-12 text-slate-300" />
        <p className="text-lg font-medium">המפה ריקה</p>
        <p className="text-sm">משימות חדשות יופיעו כאן אוטומטית</p>
      </div>
    );
  }

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-[9999] bg-gradient-to-br from-white/60 via-blue-50/30 to-white/40"
    : "relative w-full h-full";

  // MindMap fills 100% of parent container — parent controls the height
  const containerStyle = isFullscreen
    ? { background: 'radial-gradient(ellipse at center, #f8fbff 0%, #f8fbff 50%, #f0f7ff 100%)' }
    : { height: '100%', background: 'radial-gradient(ellipse at center, #f8fbff 0%, #f8fbff 50%, #f0f7ff 100%)' };

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
        {/* ── SVG Connection Lines (z-[1]: behind all nodes) ── */}
        <svg
          width={layout.virtualW}
          height={layout.virtualH}
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* ── L0→L1: Center → Meta-Folder hexagons — Deep Teal ── */}
          {layout.metaFolderPositions?.map((mf) => (
            <g key={`meta-lines-${mf.name}`}>
              {zoom < 0.6 ? (
                <line x1={centerPos.x} y1={centerPos.y} x2={mf.x} y2={mf.y}
                  stroke="#006064" strokeWidth={2.5} strokeLinecap="round" strokeOpacity={0.5} />
              ) : (
                <motion.path
                  d={`M ${centerPos.x} ${centerPos.y} L ${mf.x} ${mf.y}`}
                  stroke="#006064" strokeWidth={2.5} strokeLinecap="round" fill="none" strokeOpacity={0.5}
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              )}
            </g>
          ))}

          {/* ── L1→L2: Meta-Folder → Sub-Folder circles — light gray ── */}
          {layout.metaSubFolderPositions?.map((sf) => {
            if (!expandedMetaFolders.has(sf.metaFolderName)) return null;
            const mfPos = layout.metaFolderPositions.find(m => m.name === sf.metaFolderName);
            if (!mfPos) return null;
            return zoom < 0.6 ? (
              <line key={`metasub-line-${sf.metaFolderName}-${sf.key}`}
                x1={mfPos.x} y1={mfPos.y} x2={sf.x} y2={sf.y}
                stroke="#B0BEC5" strokeWidth={1.5} strokeLinecap="round" strokeOpacity={0.5} />
            ) : (
              <motion.path
                key={`metasub-line-${sf.metaFolderName}-${sf.key}`}
                d={`M ${mfPos.x} ${mfPos.y} L ${sf.x} ${sf.y}`}
                stroke="#B0BEC5" strokeWidth={1.5} strokeLinecap="round" fill="none" strokeOpacity={0.5}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: 0.15, ease: 'easeInOut' }}
              />
            );
          })}

          {/* ── L1/L2→L3: Meta/SubFolder → Department branches — light dashed ── */}
          {layout.branchPositions.map((branch) => {
            if (!expandedMetaFolders.has(branch.metaFolder)) return null;
            const parentX = branch._metaSubX || layout.metaFolderPositions?.find(m => m.name === branch.metaFolder)?.x || centerPos.x;
            const parentY = branch._metaSubY || layout.metaFolderPositions?.find(m => m.name === branch.metaFolder)?.y || centerPos.y;
            const opacity = isSpotlit(branch.category) ? 0.5 : 0.1;
            return zoom < 0.6 ? (
              <line key={`dept-line-${branch.category}`}
                x1={parentX} y1={parentY} x2={branch.x} y2={branch.y}
                stroke="#90A4AE" strokeWidth={1.2}
                strokeDasharray="4 3" strokeOpacity={opacity} />
            ) : (
              <motion.path
                key={`dept-line-${branch.category}`}
                d={`M ${parentX} ${parentY} L ${branch.x} ${branch.y}`}
                stroke="#90A4AE" strokeWidth={1.2}
                strokeDasharray="4 3" fill="none" strokeOpacity={opacity}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: 0.25, ease: 'easeInOut' }}
              />
            );
          })}

          {/* ── L3→L3/L4: Department → Sub-folders & Client nodes — subtle gray ── */}
          {layout.branchPositions.map((branch) => {
            if (!expandedMetaFolders.has(branch.metaFolder)) return null;
            if (!expandedBranches.has(branch.category)) return null;
            const visibleClients = branch.clientPositions.slice(0, MAX_VISIBLE_CHILDREN);
            const subOpacity = isSpotlit(branch.category) ? 0.45 : 0.08;
            const clientOpacity = isSpotlit(branch.category) ? 0.35 : 0.06;
            return (
              <g key={`lines-${branch.category}`}>
                {branch.subFolderPositions?.map((sub) => (
                  zoom < 0.6 ? (
                    <line key={`sub-line-${sub.key}`}
                      x1={branch.x} y1={branch.y} x2={sub.x} y2={sub.y}
                      stroke="#B0BEC5" strokeWidth={1} strokeDasharray="3 2" strokeOpacity={subOpacity} />
                  ) : (
                    <motion.path
                      key={`sub-line-${sub.key}`}
                      d={`M ${branch.x} ${branch.y} L ${sub.x} ${sub.y}`}
                      stroke="#B0BEC5" strokeWidth={1} strokeDasharray="3 2" fill="none" strokeOpacity={subOpacity}
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.3, ease: 'easeInOut' }}
                    />
                  )
                ))}
                {visibleClients.map((client) => {
                  const startX = client._subFolderX || branch.x;
                  const startY = client._subFolderY || branch.y;
                  return zoom < 0.6 ? (
                    <line key={`line-${client.name}`}
                      x1={startX} y1={startY} x2={client.x} y2={client.y}
                      stroke="#CFD8DC" strokeWidth={1} strokeOpacity={clientOpacity} />
                  ) : (
                    <motion.path
                      key={`line-${client.name}`}
                      d={`M ${startX} ${startY} L ${client.x} ${client.y}`}
                      stroke="#CFD8DC" strokeWidth={1} fill="none" strokeOpacity={clientOpacity}
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.35, ease: 'easeInOut' }}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* ── Center Node: "היום שלי" — draggable, today-only ── */}
        <motion.div
          data-node-draggable
          className="absolute z-20 flex flex-col items-center justify-center rounded-full text-white shadow-xl select-none"
          style={{
            width: layout.centerR * 2,
            height: layout.centerR * 2,
            left: centerPos.x - layout.centerR,
            top: centerPos.y - layout.centerR,
            background: 'linear-gradient(135deg, #0288D1, #00897B)',
            boxShadow: '0 4px 20px rgba(2,136,209,0.35), 0 2px 8px rgba(0,0,0,0.15)',
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
          <span className="opacity-80 mt-0.5 text-xs">{todayTasks.length} משימות להיום</span>
          <span className="opacity-60 text-[11px]">{centerLabel}</span>
        </motion.div>

        {/* ── META-FOLDER Hexagon Nodes (Level 1 — always visible, click to expand) ── */}
        {layout.metaFolderPositions?.map((mf, mi) => {
          const isMetaExpanded = expandedMetaFolders.has(mf.name);
          return (
          <motion.div
            key={`meta-${mf.name}`}
            data-node-draggable
            className="absolute z-[15] select-none touch-none"
            style={{
              left: mf.x,
              top: mf.y,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: mi * 0.06, type: 'spring', stiffness: 200 }}
            whileHover={{ scale: 1.12 }}
            onPointerDown={(e) => handleMetaPointerDown(e, `meta-${mf.name}`, mf.x, mf.y)}
            onPointerUp={(e) => {
              const wasDragging = nodeHasDragged.current;
              draggingNode.current = null;
              nodeHasDragged.current = false;
              if (wasDragging) { setManualPositions(prev => { savePositionsToStorage(prev); return prev; }); }
              else { toggleMetaExpand(mf.name); }
            }}
          >
            <svg width="150" height="72" viewBox="-5 -4 150 72" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id={`metaGlassGrad-${mi}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <filter id={`hexShadow-${mi}`} x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor={mf.config?.color || '#008291'} floodOpacity="0.35" />
                </filter>
              </defs>
              {/* Hexagon — premium drop-shadow + glass */}
              <polygon
                points="22,0 118,0 140,32 118,64 22,64 0,32"
                fill={mf.config?.color || '#008291'}
                opacity={isMetaExpanded ? 1 : 0.9}
                filter={`url(#hexShadow-${mi})`}
              />
              {/* White border at 0.2 opacity for glass effect */}
              <polygon
                points="22,0 118,0 140,32 118,64 22,64 0,32"
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={isMetaExpanded ? 3 : 2}
              />
              {/* Glass highlight */}
              <polygon
                points="22,0 118,0 140,32 118,64 22,64 0,32"
                fill={`url(#metaGlassGrad-${mi})`}
                opacity={0.3}
              />
              {/* Expand indicator */}
              <text x="16" y="36" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10" style={{ pointerEvents: 'none' }}>
                {isMetaExpanded ? '▼' : '▶'}
              </text>
              <text x="75" y="28" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" style={{ pointerEvents: 'none' }}>
                {mf.config?.icon || '📂'} {mf.name}
              </text>
              <text x="75" y="46" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="10" style={{ pointerEvents: 'none' }}>
                {mf.totalTasks} משימות · {mf.totalClients} לקוחות
              </text>
            </svg>
          </motion.div>
          );
        })}

        {/* ── Level 2: Meta Sub-Folder Circle Nodes — ONLY when parent meta is expanded ── */}
        {layout.metaSubFolderPositions?.filter(sf => expandedMetaFolders.has(sf.metaFolderName)).map((sf, si) => (
          <motion.div
            key={`metasub-${sf.metaFolderName}-${sf.key}`}
            data-node-draggable
            className="absolute z-[12] select-none touch-none"
            style={{
              left: sf.x,
              top: sf.y,
              transform: 'translate(-50%, -50%)',
              cursor: 'grab',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: si * 0.06 + 0.1, type: 'spring', stiffness: 200 }}
            whileHover={{ scale: 1.12 }}
            onPointerDown={(e) => handleNodePointerDown(e, `metasub-${sf.metaFolderName}-${sf.key}`, sf.x, sf.y)}
            onPointerUp={(e) => {
              const wasDragging = nodeHasDragged.current;
              draggingNode.current = null;
              nodeHasDragged.current = false;
              if (wasDragging) setManualPositions(prev => { savePositionsToStorage(prev); return prev; });
            }}
          >
            <svg width="90" height="90" viewBox="0 0 90 90" style={{ overflow: 'visible' }}>
              {/* Level 2 — White-Glass circle, dashed cyan border + white inner border */}
              <circle cx="45" cy="45" r="42" fill="rgba(255,255,255,0.35)" stroke="#00acc1" strokeWidth={1.5} strokeDasharray="6 3" />
              <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
              {/* Glass highlight */}
              <ellipse cx="45" cy="33" rx="24" ry="14" fill="white" opacity={0.2} />
              <text x="45" y="42" textAnchor="middle" fill="#006064" fontSize="11" fontWeight="700" style={{ pointerEvents: 'none' }}>
                {sf.icon} {sf.key}
              </text>
              <text x="45" y="57" textAnchor="middle" fill="#607D8B" fontSize="9" style={{ pointerEvents: 'none' }}>
                {sf.departments?.length || 0} קטגוריות
              </text>
            </svg>
          </motion.div>
        ))}

        {/* ── Branch (Category/Department) Nodes — Level 3: ONLY when parent meta expanded ── */}
        {layout.branchPositions.filter(b => expandedMetaFolders.has(b.metaFolder)).map((branch, i) => {
          const isBranchExpanded = expandedBranches.has(branch.category);
          return (
          <React.Fragment key={branch.category}>
            {/* Category department node — folder-tab, click to expand/collapse */}
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
              whileHover={{ scale: 1.1 }}
              onPointerDown={(e) => handleFolderPointerDown(e, `folder-${branch.category}`, branch.x, branch.y)}
              onPointerUp={(e) => handleFolderPointerUp(e, branch.category)}
            >
              <svg width="120" height="48" viewBox="0 0 120 48" style={{ overflow: 'visible' }}>
                {/* Level 3 — White-Glass folder-tab: bg-white/30, dashed cyan border + white inner border */}
                <path d="M0,10 L0,38 Q0,48 10,48 L110,48 Q120,48 120,38 L120,10 Q120,0 110,0 L44,0 L38,8 L10,8 Q0,8 0,10 Z"
                  fill="rgba(255,255,255,0.35)"
                  stroke={isBranchExpanded ? '#00838F' : '#90CAF9'}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
                {/* White inner border for glass effect */}
                <path d="M2,11 L2,37 Q2,46 11,46 L109,46 Q118,46 118,37 L118,11 Q118,2 109,2 L44,2 L39,9 L11,9 Q2,9 2,11 Z"
                  fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1}
                />
                {/* Glass highlight */}
                <path d="M0,10 L0,38 Q0,48 10,48 L110,48 Q120,48 120,38 L120,10 Q120,0 110,0 L44,0 L38,8 L10,8 Q0,8 0,10 Z"
                  fill="white" opacity={0.15}
                />
                <text x="60" y="32" textAnchor="middle" fill="#37474F" fontSize="11" fontWeight="700" style={{ pointerEvents: 'none' }}>
                  {branch.config.icon} {branch.category}
                </text>
                {/* Count badge */}
                <circle cx="104" cy="14" r="11" fill="rgba(255,255,255,0.5)" stroke="#90CAF9" strokeWidth={1} />
                <text x="104" y="18" textAnchor="middle" fill="#37474F" fontSize="9" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                  {branch.clients.length}
                </text>
                {/* Expand/collapse indicator */}
                <text x="12" y="18" textAnchor="middle" fill="#607D8B" fontSize="9" style={{ pointerEvents: 'none' }}>
                  {isBranchExpanded ? '▼' : '▶'}
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
                  boxShadow: '0 0 25px rgba(0,172,193,0.8), 0 0 50px rgba(0,172,193,0.4)',
                  filter: 'brightness(1.2)',
                }}
                onClick={(e) => { e.stopPropagation(); toggleBranchExpand(branch.category); }}
              >
                <svg width="96" height="38" viewBox="0 0 96 38" style={{ overflow: 'visible' }}>
                  {/* Level 3 — Folder-Tab shape, Dashed Border, bg-white/20, Sparkle on hover */}
                  <path d="M0,8 L0,30 Q0,38 8,38 L88,38 Q96,38 96,30 L96,8 Q96,0 88,0 L36,0 L30,6 L8,6 Q0,6 0,8 Z"
                    fill="rgba(255,255,255,0.20)"
                    stroke="#00acc1"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                  />
                  {/* Shimmer overlay — animated via CSS */}
                  <path d="M0,8 L0,30 Q0,38 8,38 L88,38 Q96,38 96,30 L96,8 Q96,0 88,0 L36,0 L30,6 L8,6 Q0,6 0,8 Z"
                    fill="url(#subFolderShimmer)"
                    opacity={0.25}
                    className="mindmap-shimmer-fill"
                  />
                  <defs>
                    <linearGradient id="subFolderShimmer" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="white" stopOpacity="0" />
                      <stop offset="40%" stopColor="white" stopOpacity="0.8" />
                      <stop offset="60%" stopColor="white" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <text x="48" y="26" textAnchor="middle" fill="#008291" fontSize="10" fontWeight="700" style={{ pointerEvents: 'none' }}>
                    📂 {sub.key}
                  </text>
                </svg>
              </motion.div>
            ))}

            {/* ── Client Leaf Nodes — ONLY when branch is expanded, max 10 visible ── */}
            {isBranchExpanded && branch.clientPositions.slice(0, MAX_VISIBLE_CHILDREN).map((client, j) => {
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

              // ── STATUS-BASED COLORS (The Color Revolution) ──
              // L4 uses STATUS colors ONLY: Green=Done, Teal=InProgress, Glass=ToDo
              const statusColor = isAllDone ? '#2E7D32' : client.statusRing >= 2 ? '#00838F' : '#607D8B';
              const statusBg = isAllDone ? 'rgba(46,125,50,0.08)' : client.statusRing >= 2 ? 'rgba(0,131,143,0.06)' : 'rgba(255,255,255,0.35)';
              const statusGlow = isAllDone
                ? '0 0 12px rgba(46,125,50,0.3)'           // Green
                : client.statusRing >= 2
                  ? '0 0 12px rgba(0,131,143,0.25)'        // Teal
                  : '0 2px 6px rgba(0,0,0,0.06)';          // Glass
              const complexityGlow = isHighComplexity ? ', 0 0 14px rgba(0,131,143,0.2)' : '';
              const hoverGlow = `0 4px 12px rgba(0,0,0,0.12), 0 0 16px ${statusColor}44`;
              const focusGlow = '0 0 16px #06B6D466, 0 0 6px #06B6D444';
              const normalShadow = isFilingReady
                ? `0 0 14px ${ZERO_PANIC.amber}44`
                : statusGlow + complexityGlow;

              // Top task title (truncated)
              const topTaskTitle = client.topTask?.title || '';
              const truncatedTask = topTaskTitle.length > 18 ? topTaskTitle.substring(0, 16) + '...' : topTaskTitle;

              // Focus state
              const isFocused = focusedClients.has(client.name);

              // Border: frozen > focus > waiting > filing-ready > ghost > normal
              // Status-color borders: Done=green, Active=teal, Todo=glass-white
              const statusBorderColor = isAllDone ? 'rgba(46,125,50,0.5)' : client.statusRing >= 2 ? 'rgba(0,131,143,0.4)' : 'rgba(200,210,220,0.5)';
              const borderColor = isFrozen ? '#6B7280' : isFocused ? '#06B6D4' : isWaitingOnClient ? '#f59e0b' : isFilingReady ? ZERO_PANIC.amber : isGhost ? '#90A4AE' : (isHovered ? '#fff' : statusBorderColor);
              const borderStyle = isFrozen ? 'dashed' : isGhost ? 'dashed' : 'solid';
              const borderWidth = isFrozen ? 2.5 : isFocused ? 3.5 : isWaitingOnClient ? 2.5 : isFilingReady ? 3 : 1.5;

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
                    // Level 4 — Status Glass: Done=green-tint, Active=teal-tint, Todo=pure-glass
                    backgroundColor: isGhost ? 'rgba(255,255,255,0.85)' : statusBg,
                    backdropFilter: isGhost ? 'none' : 'blur(12px)',
                    WebkitBackdropFilter: isGhost ? 'none' : 'blur(12px)',
                    borderColor: isGhost ? client.color : borderColor,
                    borderStyle,
                    borderWidth: isFrozen ? borderWidth : isAllDone ? borderWidth : Math.max(borderWidth, 2.5),
                    borderRadius: finalH / 2,
                    // L4: Status-based text color (Green/Teal/Slate)
                    color: statusColor,
                    boxShadow: isHovered ? hoverGlow : isFocused ? focusGlow : normalShadow,
                    opacity: isSpotlit(branch.category) ? (isFrozen ? 0.4 : isAllDone ? 0.35 : 1) : 0.12,
                    filter: isFrozen ? 'saturate(0.15) brightness(0.7)' : isAllDone ? 'saturate(0.3) brightness(0.85)' : 'none',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transition: 'opacity 0.4s ease-in-out, box-shadow 0.3s ease, border-color 0.2s ease, filter 0.4s ease',
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: isSpotlit(branch.category) ? (isAllDone ? 0.35 : 1) : 0.12,
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
                  onPointerUp={(e) => handleNodePointerUp(e, client)}
                  onDoubleClick={(e) => {
                    // Modal Law: double-click opens drawer (same as single click)
                    e.stopPropagation();
                    e.preventDefault();
                    setDrawerClient(client);
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
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      border: '1px solid rgba(0,0,0,0.1)',
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
                    <Trash2 className="w-2.5 h-2.5 text-slate-500 hover:text-red-500" />
                  </button>

                  {/* Client display name — Modal Law: no inline rename */}
                  <span
                    className="font-bold leading-tight text-center px-2 truncate w-full"
                    style={{
                      fontSize: finalH < 45 ? '10px' : finalH < 55 ? '11px' : '12px',
                      textShadow: '0 1px 2px rgba(255,255,255,0.6)',
                      maxWidth: finalW - 12,
                    }}
                  >
                    {isFrozen && <span title="קפוא - כל המשימות נדחו" style={{ marginInlineEnd: '3px' }}>🧊</span>}
                    {!isFrozen && procrastinatedCount > 0 && <span title={`${procrastinatedCount} משימות נדחו יותר מ-3 פעמים`} style={{ marginInlineEnd: '3px' }}>🐌</span>}
                    {isWaitingOnClient && <span title="ממתין ללקוח" style={{ marginInlineEnd: '3px' }}>⏳</span>}
                    {client.displayName}
                  </span>

                  {/* Top task title */}
                  {truncatedTask && (
                    <span
                      className="leading-tight text-center px-2 truncate w-full"
                      style={{
                        fontSize: finalH < 45 ? '8px' : '9px',
                        opacity: isGhost ? 0.7 : 0.75,
                        maxWidth: finalW - 12,
                        marginTop: '1px',
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
                          backgroundColor: isFilingReady ? ZERO_PANIC.amber : client.color,
                          opacity: 0.6,
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
                        backgroundColor: client.overdueTasks > 0 ? ZERO_PANIC.purple : client.color,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        border: '1.5px solid rgba(255,255,255,0.8)',
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
                      backgroundColor: isFocused ? '#06B6D4' : 'rgba(255,255,255,0.85)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      border: isFocused ? '1.5px solid #0891B2' : '1.5px solid rgba(0,0,0,0.1)',
                    }}
                    onClick={(e) => toggleClientFocus(client.name, e)}
                    title={isFocused ? 'הסר מפוקוס' : 'סמן כפוקוס'}
                  >
                    <Star className="w-2.5 h-2.5" style={{ color: isFocused ? '#fff' : '#9CA3AF', fill: isFocused ? '#fff' : 'none' }} />
                  </button>
                </motion.div>
              );
            })}

            {/* ── "+X more" counter node when branch has >10 clients ── */}
            {isBranchExpanded && branch.clientPositions.length > MAX_VISIBLE_CHILDREN && (() => {
              const overflowCount = branch.clientPositions.length - MAX_VISIBLE_CHILDREN;
              // Position the overflow pill near the last visible client
              const lastVisible = branch.clientPositions[MAX_VISIBLE_CHILDREN - 1];
              const overflowX = lastVisible ? lastVisible.x + 40 : branch.x + 80;
              const overflowY = lastVisible ? lastVisible.y + 40 : branch.y + 60;
              return (
                <motion.div
                  className="absolute z-10 flex items-center justify-center select-none"
                  style={{
                    left: overflowX,
                    top: overflowY,
                    transform: 'translate(-50%, -50%)',
                    width: 72,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(0,130,145,0.12)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px dashed #00acc1',
                    cursor: 'pointer',
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 0.85, scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={(e) => { e.stopPropagation(); setDrawerClient(null); toast.info(`${overflowCount} לקוחות נוספים ב${branch.category} — פתח את המגירה`); }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#008291' }}>+{overflowCount} עוד</span>
                </motion.div>
              );
            })()}
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
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-200 p-3 max-w-[240px]">
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
          className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white/90 backdrop-blur-sm shadow-lg border border-white/20 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
          title={isFullscreen ? 'יציאה ממסך מלא (Esc)' : 'מסך מלא'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white/90 backdrop-blur-sm shadow-lg border border-white/20 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
          title="הגדל"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white/90 backdrop-blur-sm shadow-lg border border-white/20 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
          title="הקטן"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleFitAll(); }}
          className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white/90 backdrop-blur-sm shadow-lg border border-white/20 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
          title="התאם הכל"
        >
          <Move className="w-4 h-4" />
        </button>
        {/* Zoom level indicator */}
        <div className="flex items-center justify-center h-7 rounded-lg bg-white/80 backdrop-blur-sm shadow border border-white/20 text-[10px] text-slate-500 font-medium">
          {Math.round(zoom * 100)}%
        </div>

        {/* Spacing / Distance slider */}
        <div className="mt-2 flex flex-col items-center gap-1 bg-white/90 backdrop-blur-sm rounded-[32px] shadow-lg border border-white/20 px-2 py-2" onClick={(e) => e.stopPropagation()}>
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
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
          <span className="text-[9px] text-slate-400">{Math.round(spacingFactor * 100)}%</span>
        </div>

        {/* Crisis Mode toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setCrisisMode(prev => !prev); }}
          className={`flex items-center justify-center w-9 h-9 rounded-[32px] backdrop-blur-sm shadow-lg border transition-all ${
            crisisMode
              ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
              : 'bg-white/90 text-slate-600 border-white/20 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
          }`}
          title={crisisMode ? 'מצב חירום פעיל — לחץ לביטול' : 'מצב חירום — סנן משימות לא דחופות'}
        >
          ⚡
        </button>

        {/* Reset manual positions button */}
        {Object.keys(manualPositions).length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setManualPositions({}); setAutoFitDone(false); localStorage.removeItem(POSITIONS_STORAGE_KEY); }}
            className="flex items-center justify-center w-9 h-9 rounded-[32px] bg-white/90 backdrop-blur-sm shadow-lg border border-white/20 text-slate-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all text-[10px] font-medium"
            title="איפוס מיקומים ידניים"
          >
            ↺
          </button>
        )}
      </div>

      {/* Legends removed — node colors and sizes are self-explanatory via tooltip */}

      {/* ── Crisis Mode Banner ── */}
      {crisisMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-amber-500/90 backdrop-blur-sm text-white rounded-full px-4 py-1.5 shadow-lg text-xs font-bold flex items-center gap-2">
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
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-6 py-4 text-center">
            <Move className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium">מחשב תצוגה...</p>
          </div>
        </div>
      )}

      {/* ── Tooltip ── */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            className="fixed z-[10000] backdrop-blur-xl bg-white/80 rounded-[32px] shadow-2xl border border-white/20 p-3 pointer-events-none"
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
              <span className="font-bold text-sm text-slate-800">{tooltip.displayName || tooltip.name}</span>
              {tooltip.nickname && tooltip.nickname !== tooltip.name && (
                <span className="text-[10px] text-slate-400">({tooltip.name})</span>
              )}
              <span className="text-[10px] bg-white/50 text-[#008291] px-1.5 rounded-full">{tooltip.tierIcon} {tooltip.tierLabel}</span>
              {tooltip.isFilingReady && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded font-semibold">מוכן לדיווח</span>
              )}
              {tooltip.hasWaitingOnClient && (
                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 rounded font-semibold">⏳ ממתין ללקוח</span>
              )}
            </div>
            {tooltip.topTaskTitle && (
              <p className="text-[11px] text-slate-500 mb-1 truncate max-w-[200px]">📋 {tooltip.topTaskTitle}</p>
            )}
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span>{tooltip.total} משימות</span>
              <span className="text-green-600">{tooltip.completed} הושלמו</span>
              {tooltip.overdue > 0 && (
                <span style={{ color: ZERO_PANIC.purple }}>{tooltip.overdue} באיחור</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">גרור להזיז · לחיצה כפולה → לוח העבודה</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Client Task Drawer (Sheet) ── */}
      <Sheet open={!!drawerClient} onOpenChange={(open) => { if (!open) { setDrawerClient(null); setHighlightTaskId(null); } }}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col border-l border-white/20 rounded-l-[32px]" dir="rtl" style={{ backgroundColor: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          {drawerClient && (() => {
            const clientTasks = tasks.filter(t => t.client_name === drawerClient.name);
            const activeTasks = clientTasks.filter(t => t.status !== 'completed' && t.status !== 'not_relevant');
            const completedTasks = clientTasks.filter(t => t.status === 'completed' || t.status === 'not_relevant');

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
            const STATUS_CYCLE = ['not_started', 'in_progress', 'completed'];
            const cycleStatus = async (task, e) => {
              e.stopPropagation();
              e.preventDefault();
              const currentIdx = STATUS_CYCLE.indexOf(task.status);
              // If status not in cycle list, start from not_started
              const nextStatus = STATUS_CYCLE[(Math.max(currentIdx, 0) + 1) % STATUS_CYCLE.length];
              try {
                await Task.update(task.id, { status: nextStatus });
                toast.success(`${statusConfig[nextStatus]?.text || nextStatus}`);
                // Force refresh after successful save
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
              const statusDotStyle = task.status === 'completed'
                ? 'bg-emerald-500' : task.status === 'in_progress'
                ? 'bg-sky-500' : 'bg-[#00acc1]';

              return (
                <React.Fragment key={task.id}>
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 bg-white/70 rounded-[24px] shadow-sm mb-2 mx-2 hover:bg-white/90 hover:shadow-md transition-all cursor-pointer group ${isHighlighted ? 'ring-2 ring-cyan-500 bg-cyan-50/70' : ''}`}
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
                        task.status === 'completed' ? 'bg-emerald-500 border-emerald-500' :
                        task.status === 'in_progress' ? 'bg-sky-500 border-sky-500' :
                        'bg-white border-slate-300 hover:border-sky-400'
                      }`}
                      title={`סטטוס: ${sts.text} — לחץ לשנות`}
                    >
                      {task.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" />}
                      {task.status === 'in_progress' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {/* Modal Law: no inline editing — click row to open full dialog */}
                      <p className="text-sm text-slate-800 truncate">
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-[10px] text-slate-400">{format(new Date(task.due_date), 'd/M', { locale: he })}</p>
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
                      className="p-1 rounded-[32px] hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="הוסף תת-משימה"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Sub-task creation is now handled by QuickAddTaskDialog modal via drawerSubTaskParent */}

                  {children.filter(c => c.status !== 'completed' && c.status !== 'not_relevant').map(child => renderTask(child, depth + 1))}
                </React.Fragment>
              );
            };

            return (
              <>
                {/* Drawer Header */}
                <div className="px-5 pt-5 pb-3 border-b border-white/20 bg-white/40 backdrop-blur-md rounded-tr-[32px]">
                  <SheetHeader className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: drawerClient.color }} />
                      <SheetTitle className="text-base">{drawerClient.displayName || drawerClient.name}</SheetTitle>
                      <span className="text-[10px] bg-white/50 text-[#008291] px-1.5 rounded-full">{drawerClient.tierIcon} {drawerClient.tierLabel}</span>
                      <button
                        onClick={() => toggleClientFocus(drawerClient.name)}
                        className={`p-1 rounded-full transition-colors ${focusedClients.has(drawerClient.name) ? 'bg-cyan-100 text-cyan-600' : 'bg-white/50 text-slate-400 hover:text-cyan-500'}`}
                        title={focusedClients.has(drawerClient.name) ? 'הסר מפוקוס' : 'סמן כפוקוס'}
                      >
                        <Star className="w-3.5 h-3.5" style={{ fill: focusedClients.has(drawerClient.name) ? 'currentColor' : 'none' }} />
                      </button>
                    </div>
                    <SheetDescription className="text-right">
                      <span className="text-xs text-slate-500">{activeTasks.length} פעילות · {completedTasks.length} הושלמו</span>
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
                    <div className="text-center py-8 text-slate-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">אין משימות פעילות</p>
                    </div>
                  ) : zoneGroups ? (
                    zoneGroups.map(group => (
                      <div key={group.zone}>
                        <div className="px-4 py-1.5 text-[10px] font-bold text-[#008291]/60 bg-white/30 backdrop-blur-sm sticky top-0 border-b border-white/20">
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
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-500 hover:bg-white/40 transition-colors rounded-[32px] mx-2"
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
                            className="flex items-center gap-2 px-4 py-2 bg-white/40 rounded-[24px] mx-2 mb-1.5 hover:bg-white/60 cursor-pointer opacity-50 transition-all"
                            onClick={() => setDrawerEditTask(task)}
                          >
                            <button
                              onClick={(e) => cycleStatus(task, e)}
                              className="w-3.5 h-3.5 rounded-full shrink-0 border-2 bg-emerald-500 border-emerald-500 flex items-center justify-center transition-all hover:scale-125"
                              title="לחץ להחזיר לטרם התחיל"
                            >
                              <Check className="w-2 h-2 text-white" />
                            </button>
                            <p className="text-xs text-slate-400 flex-1 truncate line-through">{task.title}</p>
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

      {/* ── QuickAddTaskDialog for editing a task from drawer ── */}
      <QuickAddTaskDialog
        open={!!drawerEditTask}
        onOpenChange={(val) => { if (!val) setDrawerEditTask(null); }}
        taskToEdit={drawerEditTask}
        defaultClientId={drawerEditTask?.client_id || drawerClient?.clientId || null}
        lockedClient={!!drawerEditTask?.client_id}
        onCreated={() => {
          setDrawerEditTask(null);
          onTaskCreated?.();
        }}
      />

      {/* ── Focus Mode Indicator ── */}
      {focusMode && selectedBranch && (
        <motion.div
          className="absolute bottom-4 right-4 z-30 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md border border-white/20 text-xs text-slate-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Spotlight: <strong>{selectedBranch}</strong>
          <button
            className="mr-2 text-slate-400 hover:text-gray-700"
            onClick={() => setSelectedBranch(null)}
          >
            ×
          </button>
        </motion.div>
      )}

      {/* ── Fullscreen exit hint ── */}
      {isFullscreen && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-md border border-white/20 text-xs text-slate-500">
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
