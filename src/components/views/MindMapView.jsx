import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Cloud, Inbox, GripVertical, X, Sparkles, Plus, Calendar, CheckCircle, Edit3, ExternalLink, Maximize2, Minimize2, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { Task } from '@/api/entities';
import { toast } from 'sonner';
import { computeComplexityTier, getBubbleRadius, getTierInfo } from '@/lib/complexity';
import { COMPLEXITY_TIERS } from '@/lib/theme-constants';

// ─── Zero-Panic Palette (NO RED) ────────────────────────────────
const ZERO_PANIC = {
  orange:  '#F57C00',  // Due Today / Critical
  purple:  '#7B1FA2',  // Overdue / Late
  green:   '#2E7D32',  // Done
  blue:    '#0288D1',  // Active / In Progress
  gray:    '#90A4AE',  // Not Started
  amber:   '#FF8F00',  // Waiting / Issue
  indigo:  '#3949AB',  // Ready for Reporting
};

const STATUS_TO_COLOR = {
  completed:                       ZERO_PANIC.green,
  in_progress:                     ZERO_PANIC.blue,
  not_started:                     ZERO_PANIC.gray,
  remaining_completions:           ZERO_PANIC.amber,
  postponed:                       ZERO_PANIC.gray,
  waiting_for_approval:            ZERO_PANIC.amber,
  waiting_for_materials:           ZERO_PANIC.amber,
  issue:                           ZERO_PANIC.amber,
  ready_for_reporting:             ZERO_PANIC.indigo,
  reported_waiting_for_payment:    ZERO_PANIC.purple,
  pending_external:                '#1565C0',  // Deep blue - ball is with external party
  not_relevant:                    ZERO_PANIC.gray,
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

// Service category branches – each with distinct color + icon
const BRANCH_CONFIG = {
  'מע"מ':        { color: '#7C4DFF', icon: '📊', label: 'VAT' },
  'מקדמות מס':   { color: '#00BCD4', icon: '💰', label: 'Tax' },
  'שכר':         { color: '#FF9800', icon: '👥', label: 'Payroll' },
  'ביטוח לאומי':  { color: '#4CAF50', icon: '🏛️', label: 'NI' },
  'ניכויים':      { color: '#009688', icon: '📋', label: 'Deduct' },
  'הנחש':        { color: '#795548', icon: '📑', label: 'Hashna' },
  'home':        { color: '#8D6E63', icon: '🏠', label: 'Home' },
  'personal':    { color: '#78909C', icon: '👤', label: 'Personal' },
  'אחר':         { color: '#607D8B', icon: '📁', label: 'Other' },
};

// ─── Node Scaling by Complexity Tier (3:1 ratio from Enterprise to Nano) ──
// Base radius: tier 0 (Nano) = 22px → tier 3 (Complex) = 66px  (3:1)
// Wide screen base: 30px → tier 3 = 90px
const BASE_RADIUS = 22;
const BASE_RADIUS_WIDE = 30;

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

  return STATUS_TO_COLOR[task.status] || ZERO_PANIC.blue;
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

// ─── Main Component ─────────────────────────────────────────────
export default function MindMapView({ tasks, clients, inboxItems = [], onInboxDismiss, focusMode = false }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 700 });
  const [editPopover, setEditPopover] = useState(null); // { client, x, y }
  const [quickTaskTitle, setQuickTaskTitle] = useState('');

  // ── Pan & Zoom state ──
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoFitDone, setAutoFitDone] = useState(false);

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
  const { branches, clientNodes, centerLabel } = useMemo(() => {
    const today = new Date();
    const centerLabel = format(today, 'EEEE, d/M', { locale: he });

    // Group tasks by category → client
    const catClientMap = {};
    const activeTasks = tasks.filter(t => t.status !== 'not_relevant');

    activeTasks.forEach(task => {
      const cat = task.category || 'אחר';
      if (!catClientMap[cat]) catClientMap[cat] = {};
      const clientName = task.client_name || 'ללא לקוח';
      if (!catClientMap[cat][clientName]) catClientMap[cat][clientName] = [];
      catClientMap[cat][clientName].push(task);
    });

    // Build branch data with complexity-tier sizing
    const branches = Object.entries(catClientMap).map(([category, clientsObj]) => ({
      category,
      config: BRANCH_CONFIG[category] || BRANCH_CONFIG['אחר'],
      clients: Object.entries(clientsObj).map(([name, clientTasks]) => {
        const client = clients?.find(c => c.name === name);
        const tier = getComplexityTier(client, clientTasks);
        const tierInfo = getTierInfo(tier);
        return {
          name,
          clientId: client?.id,
          tier,
          tierLabel: tierInfo.label,
          tierIcon: tierInfo.icon,
          ...getClientAggregateState(clientTasks),
          tasks: clientTasks,
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

    // Build flat client nodes for rendering
    const clientNodes = [];
    branches.forEach(branch => {
      branch.clients.forEach(client => {
        clientNodes.push({ ...client, category: branch.category });
      });
    });

    return { branches, clientNodes, centerLabel };
  }, [tasks, clients]);

  // ── Layout Calculation: Container-Aware + Complexity + ADHD Focus + Collision Detection ──
  const layout = useMemo(() => {
    // USE ACTUAL CONTAINER DIMENSIONS — not a virtual oversized canvas
    // This ensures nodes are positioned within the visible viewport at 100% zoom
    const w = Math.max(dimensions.width, 600);
    const h = Math.max(dimensions.height, 400);
    const isWide = w >= 1600;
    const cx = w / 2;
    const cy = h / 2;
    const centerR = isWide ? 55 : 48;

    // Elliptical scaling: fit branches within 80% of actual visible area
    // Use slightly wider horizontal spread since monitors are landscape
    const padX = 80; // padding from edges
    const padY = 60;
    const scaleX = (w - padX * 2) * 0.42;
    const scaleY = (h - padY * 2) * 0.42;
    // Leaf distance: relative to the smaller axis so nodes don't overflow
    const baseLeafDist = Math.min(scaleX, scaleY) * 0.48;

    const angleStep = (2 * Math.PI) / Math.max(branches.length, 1);

    // ─── Phase 1: Position all nodes ───
    const allClientNodes = []; // collect for collision detection

    const branchPositions = branches.map((branch, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const bx = cx + Math.cos(angle) * scaleX;
      const by = cy + Math.sin(angle) * scaleY;

      const clientCount = branch.clients.length;
      const clientAngleSpread = Math.min(Math.PI * 0.65, clientCount * 0.35);

      // Sort clients: filing-ready & urgent first (closer to branch), completed last (pushed out)
      const sortedClients = [...branch.clients].sort((a, b) => (b.statusRing || 0) - (a.statusRing || 0));

      const clientPositions = sortedClients.map((client, j) => {
        const clientAngle = angle + (j - (clientCount - 1) / 2) * (clientAngleSpread / Math.max(clientCount - 1, 1));

        // ADHD Focus: distance from branch based on status
        const statusDistMultiplier = {
          4: 0.82,  // Overdue / Due Today → pull in
          3: 0.88,  // Filing Ready → pull in
          2: 1.0,   // Active → normal
          1: 1.0,   // External → normal
          0: 1.3,   // Completed → push out
        }[client.statusRing || 2] || 1.0;

        const stagger = (j % 2) * Math.min(20, baseLeafDist * 0.15);
        const dist = (baseLeafDist + stagger) * statusDistMultiplier;

        // Complexity-tier based radius (3:1 ratio)
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

      return {
        ...branch,
        x: bx,
        y: by,
        angle,
        clientPositions,
      };
    });

    // ─── Phase 2: Collision Detection & Resolution ───
    const MIN_GAP = 6;
    for (let pass = 0; pass < 5; pass++) {
      let hadCollision = false;
      for (let i = 0; i < allClientNodes.length; i++) {
        for (let j = i + 1; j < allClientNodes.length; j++) {
          const a = allClientNodes[i];
          const b = allClientNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.radius / 2 + b.radius / 2 + MIN_GAP;

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
      if (!hadCollision) break;
    }

    // Sync collision-resolved positions back to branchPositions
    branchPositions.forEach(branch => {
      branch.clientPositions.forEach(cp => {
        const resolved = allClientNodes.find(n => n.name === cp.name && n.category === cp.category);
        if (resolved) {
          cp.x = resolved.x;
          cp.y = resolved.y;
        }
      });
    });

    return { cx, cy, centerR, branchPositions, virtualW: w, virtualH: h, isWide };
  }, [branches, dimensions]);

  // ── Auto-Fit: compute zoom + pan to show all nodes ──
  useEffect(() => {
    if (autoFitDone || !layout.branchPositions.length) return;

    // Compute bounding box of all nodes
    let minX = layout.cx, maxX = layout.cx, minY = layout.cy, maxY = layout.cy;

    layout.branchPositions.forEach(branch => {
      minX = Math.min(minX, branch.x - 30);
      maxX = Math.max(maxX, branch.x + 30);
      minY = Math.min(minY, branch.y - 30);
      maxY = Math.max(maxY, branch.y + 30);
      branch.clientPositions.forEach(client => {
        const r = client.radius || 30;
        minX = Math.min(minX, client.x - r);
        maxX = Math.max(maxX, client.x + r);
        minY = Math.min(minY, client.y - r);
        maxY = Math.max(maxY, client.y + r);
      });
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

  // Reset auto-fit when tasks change significantly
  useEffect(() => {
    setAutoFitDone(false);
  }, [tasks.length, branches.length]);

  // ── Pan handlers ──
  const handlePointerDown = useCallback((e) => {
    // Don't start panning on interactive elements
    if (e.target.closest('[data-popover]') || e.target.closest('input') || e.target.closest('button')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.currentTarget.style.cursor = 'grabbing';
  }, [pan]);

  const handlePointerMove = useCallback((e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, [isPanning]);

  const handlePointerUp = useCallback((e) => {
    setIsPanning(false);
    if (e.currentTarget) e.currentTarget.style.cursor = 'grab';
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
    if (client.clientId) {
      navigate(createPageUrl('ClientManagement') + `?client=${client.clientId}`);
    } else {
      navigate(createPageUrl('Tasks') + `?search=${encodeURIComponent(client.name)}`);
    }
  }, [navigate]);

  const handleClientHover = useCallback((client, x, y) => {
    setHoveredNode(client.name);
    setTooltip({
      x, y,
      name: client.name,
      total: client.totalTasks,
      completed: client.completedTasks,
      overdue: client.overdueTasks,
      tier: client.tier,
      tierLabel: client.tierLabel,
      tierIcon: client.tierIcon,
      color: client.color,
      isFilingReady: client.isFilingReady,
    });
  }, []);

  const handleBranchClick = useCallback((category) => {
    setSelectedBranch(prev => prev === category ? null : category);
  }, []);

  // Single-click opens quick-edit popover
  const handleClientClick = useCallback((client, x, y) => {
    setEditPopover(prev => prev?.name === client.name ? null : { ...client, x, y });
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

  if (tasks.length === 0 && inboxItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400 gap-3">
        <Sparkles className="w-12 h-12 text-gray-300" />
        <p className="text-lg font-medium">המפה ריקה</p>
        <p className="text-sm">משימות חדשות יופיעו כאן אוטומטית</p>
      </div>
    );
  }

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-[9999] bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100"
    : "relative w-full rounded-2xl border border-gray-200";

  // MindMap takes all available vertical space: 180px accounts for compact header + stats strip + card header
  const containerStyle = isFullscreen
    ? { background: 'radial-gradient(ellipse at center, #f8fbff 0%, #f1f5f9 50%, #e8eef5 100%)' }
    : { height: 'calc(100vh - 180px)', minHeight: '420px', background: 'radial-gradient(ellipse at center, #f8fbff 0%, #f1f5f9 50%, #e8eef5 100%)' };

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
        }}
      >
        {/* ── SVG Connection Lines ── */}
        <svg
          width={layout.virtualW}
          height={layout.virtualH}
          className="absolute inset-0 pointer-events-none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Glow filter for hovered nodes */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Shadow filter */}
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* ── Connection Lines ── */}
          {layout.branchPositions.map((branch) => (
            <g key={`lines-${branch.category}`}>
              {/* Center → Branch */}
              <motion.line
                x1={layout.cx} y1={layout.cy}
                x2={branch.x} y2={branch.y}
                stroke={branch.config.color}
                strokeWidth={2.5}
                strokeOpacity={isSpotlit(branch.category) ? 0.4 : 0.08}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
              />
              {/* Branch → Client leaves */}
              {branch.clientPositions.map((client) => (
                <motion.line
                  key={`line-${client.name}`}
                  x1={branch.x} y1={branch.y}
                  x2={client.x} y2={client.y}
                  stroke={client.color}
                  strokeWidth={1.5}
                  strokeOpacity={isSpotlit(branch.category) ? 0.3 : 0.06}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.3, ease: 'easeInOut' }}
                />
              ))}
            </g>
          ))}
        </svg>

        {/* ── Center Node: "היום שלי" ── */}
        <motion.div
          className="absolute z-20 flex flex-col items-center justify-center rounded-full text-white shadow-xl cursor-default select-none"
          style={{
            width: layout.centerR * 2,
            height: layout.centerR * 2,
            left: layout.cx - layout.centerR,
            top: layout.cy - layout.centerR,
            background: 'linear-gradient(135deg, #0288D1, #00897B)',
            boxShadow: '0 4px 20px rgba(2,136,209,0.35), 0 2px 8px rgba(0,0,0,0.15)',
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <span className="font-bold leading-tight text-base">היום שלי</span>
          <span className="opacity-80 mt-0.5 text-xs">{layout.branchPositions.reduce((sum, b) => sum + b.clients.length, 0)} לקוחות</span>
          <span className="opacity-60 text-[11px]">{tasks.filter(t => t.status !== 'completed' && t.status !== 'not_relevant').length} משימות</span>
        </motion.div>

        {/* ── Branch (Category) Nodes ── */}
        {layout.branchPositions.map((branch, i) => (
          <React.Fragment key={branch.category}>
            <motion.div
              className="absolute z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold shadow-lg cursor-pointer select-none"
              style={{
                backgroundColor: branch.config.color,
                left: branch.x,
                top: branch.y,
                transform: 'translate(-50%, -50%)',
                opacity: isSpotlit(branch.category) ? 1 : 0.15,
                transition: 'opacity 0.4s ease-in-out',
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: isSpotlit(branch.category) ? 1 : 0.15, scale: 1 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.1 }}
              onClick={(e) => { e.stopPropagation(); handleBranchClick(branch.category); }}
            >
              <span>{branch.config.icon}</span>
              <span>{branch.category}</span>
              <span className="bg-white/25 rounded-full px-1.5 text-[10px]">{branch.clients.length}</span>
            </motion.div>

            {/* ── Client Leaf Nodes (Complexity-Tier Sized) ── */}
            {branch.clientPositions.map((client, j) => {
              const isHovered = hoveredNode === client.name;
              const isAllDone = client.completionRatio === 1 && client.totalTasks > 0;
              const isFilingReady = client.isFilingReady;
              // Completed: shrink slightly + dim
              const nodeRadius = isAllDone ? Math.max(client.radius * 0.7, 16) : client.radius;
              // Ghost Node: dashed border if no due_date on all tasks
              const isGhost = client.tasks.every(t => !t.due_date);

              // ADHD Focus: Filing-ready gets strong amber glow
              const amberGlow = isFilingReady
                ? `0 0 24px ${ZERO_PANIC.amber}88, 0 0 48px ${ZERO_PANIC.amber}44`
                : '';
              const hoverGlow = `0 0 20px ${client.color}66, 0 4px 12px rgba(0,0,0,0.2)`;
              const normalShadow = isFilingReady
                ? `0 0 16px ${ZERO_PANIC.amber}66, 0 2px 6px rgba(0,0,0,0.12)`
                : '0 2px 6px rgba(0,0,0,0.12)';

              return (
                <motion.div
                  key={`${branch.category}-${client.name}`}
                  className={`absolute z-10 flex items-center justify-center rounded-full border-2 text-white font-medium cursor-pointer select-none
                    ${client.shouldPulse ? 'animate-pulse' : ''}`}
                  style={{
                    width: nodeRadius,
                    height: nodeRadius,
                    left: client.x - nodeRadius / 2,
                    top: client.y - nodeRadius / 2,
                    backgroundColor: isGhost ? 'transparent' : client.color,
                    borderColor: isGhost ? client.color : (isFilingReady ? ZERO_PANIC.amber : (isHovered ? '#fff' : client.color)),
                    borderStyle: isGhost ? 'dashed' : 'solid',
                    borderWidth: isFilingReady ? 3 : 2,
                    color: isGhost ? client.color : '#fff',
                    fontSize: nodeRadius < 30 ? '7px' : nodeRadius < 45 ? '9px' : nodeRadius < 65 ? '11px' : '13px',
                    boxShadow: isHovered ? hoverGlow : normalShadow,
                    opacity: isSpotlit(branch.category) ? (isAllDone ? 0.35 : 1) : 0.12,
                    filter: isAllDone ? 'saturate(0.3) brightness(0.85)' : 'none',
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
                  whileHover={{ scale: 1.25, zIndex: 50 }}
                  onMouseEnter={(e) => handleClientHover(client, e.clientX, e.clientY)}
                  onMouseLeave={() => { setHoveredNode(null); setTooltip(null); }}
                  onClick={(e) => { e.stopPropagation(); handleClientClick(client, e.clientX, e.clientY); }}
                  onDoubleClick={() => handleClientDoubleClick(client)}
                  title={`${client.name} (${client.tierIcon} ${client.tierLabel})${isGhost ? ' [חסר תאריך]' : ''} - לחיצה לעריכה`}
                >
                  {client.name?.substring(0, nodeRadius < 35 ? 2 : nodeRadius < 55 ? 3 : 4)}
                  {/* Completion ring */}
                  {client.totalTasks > 0 && (
                    <svg
                      className="absolute inset-0 pointer-events-none"
                      width={nodeRadius}
                      height={nodeRadius}
                      viewBox={`0 0 ${nodeRadius} ${nodeRadius}`}
                    >
                      <circle
                        cx={nodeRadius / 2}
                        cy={nodeRadius / 2}
                        r={nodeRadius / 2 - 2}
                        fill="none"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth={isFilingReady ? 3 : 2}
                      />
                      <circle
                        cx={nodeRadius / 2}
                        cy={nodeRadius / 2}
                        r={nodeRadius / 2 - 2}
                        fill="none"
                        stroke={isFilingReady ? ZERO_PANIC.amber : 'rgba(255,255,255,0.8)'}
                        strokeWidth={isFilingReady ? 3 : 2}
                        strokeDasharray={`${(client.completedTasks / client.totalTasks) * Math.PI * (nodeRadius - 4)} ${Math.PI * (nodeRadius - 4)}`}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${nodeRadius / 2} ${nodeRadius / 2})`}
                      />
                    </svg>
                  )}
                  {/* Task count badge */}
                  {client.totalTasks > 0 && nodeRadius >= 35 && (
                    <span
                      className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold pointer-events-none"
                      style={{
                        width: nodeRadius >= 50 ? 20 : 16,
                        height: nodeRadius >= 50 ? 20 : 16,
                        fontSize: nodeRadius >= 50 ? '9px' : '8px',
                        backgroundColor: client.overdueTasks > 0 ? ZERO_PANIC.purple : client.color,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }}
                    >
                      {client.totalTasks - client.completedTasks}
                    </span>
                  )}
                  {/* Tier indicator for larger nodes */}
                  {nodeRadius >= 50 && (
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] bg-black/30 rounded-full px-1 pointer-events-none"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {client.tierIcon}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </React.Fragment>
        ))}
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
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
          title={isFullscreen ? 'יציאה ממסך מלא (Esc)' : 'מסך מלא'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
          title="הגדל"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
          title="הקטן"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleFitAll(); }}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
          title="התאם הכל"
        >
          <Move className="w-4 h-4" />
        </button>
        {/* Zoom level indicator */}
        <div className="flex items-center justify-center h-7 rounded-lg bg-white/80 backdrop-blur-sm shadow border border-gray-100 text-[10px] text-gray-500 font-medium">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* ── Legend (stays fixed in viewport) ── */}
      <div className="absolute top-3 right-3 z-30 flex flex-wrap gap-2">
        {[
          { color: ZERO_PANIC.orange, label: 'להיום' },
          { color: ZERO_PANIC.purple, label: 'באיחור' },
          { color: ZERO_PANIC.amber, label: 'מוכן לדיווח', glow: true },
          { color: '#1565C0', label: "צד ג'" },
          { color: ZERO_PANIC.blue, label: 'פעיל' },
          { color: ZERO_PANIC.green, label: 'הושלם' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1 text-[10px] text-gray-500 bg-white/70 backdrop-blur-sm rounded px-1.5 py-0.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{
              backgroundColor: item.color,
              boxShadow: item.glow ? `0 0 6px ${item.color}88` : 'none',
            }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Complexity Tier Legend ── */}
      <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 text-[10px] text-gray-400 bg-white/70 backdrop-blur-sm rounded-lg px-2 py-1">
        <span>מורכבות:</span>
        {Object.entries(COMPLEXITY_TIERS).map(([tier, info]) => {
          const r = getNodeRadius(Number(tier), layout.isWide);
          return (
            <div key={tier} className="flex items-center gap-0.5">
              <div className="rounded-full bg-gray-300" style={{ width: Math.max(r / 3, 6), height: Math.max(r / 3, 6) }} />
              <span>{info.icon} {info.label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Pan hint (shows briefly on first load) ── */}
      {!autoFitDone && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-6 py-4 text-center">
            <Move className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 font-medium">מחשב תצוגה...</p>
          </div>
        </div>
      )}

      {/* ── Tooltip ── */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            className="fixed z-[10000] bg-white rounded-xl shadow-2xl border border-gray-200 p-3 pointer-events-none"
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
              <span className="font-bold text-sm text-gray-800">{tooltip.name}</span>
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded">{tooltip.tierIcon} {tooltip.tierLabel}</span>
              {tooltip.isFilingReady && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded font-semibold">מוכן לדיווח</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-600">
              <span>{tooltip.total} משימות</span>
              <span className="text-green-600">{tooltip.completed} הושלמו</span>
              {tooltip.overdue > 0 && (
                <span style={{ color: ZERO_PANIC.purple }}>{tooltip.overdue} באיחור</span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">לחיצה כפולה → לוח העבודה</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick-Edit Popover ── */}
      <AnimatePresence>
        {editPopover && (
          <motion.div
            data-popover
            className="fixed z-[10000] bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-[280px]"
            style={{
              left: Math.min(editPopover.x + 10, window.innerWidth - 300),
              top: Math.max(editPopover.y - 20, 10),
            }}
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: editPopover.color }} />
                <span className="font-bold text-sm text-gray-800">{editPopover.name}</span>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded">{editPopover.tierIcon} {editPopover.tierLabel}</span>
              </div>
              <button onClick={() => setEditPopover(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Task summary */}
            <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3 pb-3 border-b border-gray-100">
              <span>{editPopover.totalTasks} משימות</span>
              <span className="text-green-600">{editPopover.completedTasks} הושלמו</span>
              {editPopover.overdueTasks > 0 && (
                <span style={{ color: ZERO_PANIC.purple }}>{editPopover.overdueTasks} באיחור</span>
              )}
            </div>

            {/* Quick-add task */}
            <div className="mb-3">
              <div className="flex gap-1.5">
                <input
                  data-popover
                  type="text"
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickAddTask()}
                  placeholder="הוסף משימה מהירה..."
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                <button
                  data-popover
                  onClick={handleQuickAddTask}
                  disabled={!quickTaskTitle.trim()}
                  className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-1.5">
              <button
                data-popover
                onClick={() => {
                  handleClientDoubleClick(editPopover);
                  setEditPopover(null);
                }}
                className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                לוח עבודה
              </button>
              <button
                data-popover
                onClick={() => {
                  navigate(createPageUrl('Tasks') + `?search=${encodeURIComponent(editPopover.name)}`);
                  setEditPopover(null);
                }}
                className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
                כל המשימות
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Focus Mode Indicator ── */}
      {focusMode && selectedBranch && (
        <motion.div
          className="absolute bottom-4 right-4 z-30 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md border border-gray-200 text-xs text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Spotlight: <strong>{selectedBranch}</strong>
          <button
            className="mr-2 text-gray-400 hover:text-gray-700"
            onClick={() => setSelectedBranch(null)}
          >
            ×
          </button>
        </motion.div>
      )}

      {/* ── Fullscreen exit hint ── */}
      {isFullscreen && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-md border border-gray-200 text-xs text-gray-500">
          ESC ליציאה ממסך מלא
        </div>
      )}
    </div>
  );
}
