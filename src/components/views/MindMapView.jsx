import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Cloud, Inbox, GripVertical, X, Sparkles } from 'lucide-react';

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
  not_relevant:                    ZERO_PANIC.gray,
};

// Service category branches
const BRANCH_CONFIG = {
  'מע"מ':        { color: '#7C4DFF', icon: '📊' },
  'מקדמות מס':   { color: '#00BCD4', icon: '💰' },
  'שכר':         { color: '#FF9800', icon: '👥' },
  'ביטוח לאומי':  { color: '#4CAF50', icon: '🏛️' },
  'ניכויים':      { color: '#009688', icon: '📋' },
  'הנחש':        { color: '#795548', icon: '📑' },
  'אחר':         { color: '#607D8B', icon: '📁' },
};

// ─── Node Scaling by Complexity ─────────────────────────────────
const SIZE_MAP = { S: 30, M: 50, L: 80 };

function estimateSize(client, tasks) {
  if (client?.size) return client.size;
  const services = client?.service_types?.length || 0;
  const taskCount = tasks.filter(t => t.client_name === client?.name).length;
  if (services >= 4 || taskCount >= 8) return 'L';
  if (services >= 2 || taskCount >= 3) return 'M';
  return 'S';
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

function getClientAggregateColor(clientTasks) {
  if (!clientTasks || clientTasks.length === 0) return ZERO_PANIC.gray;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Priority: overdue > due today > active > done
  const hasOverdue = clientTasks.some(t => {
    if (t.status === 'completed' || t.status === 'not_relevant') return false;
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    due.setHours(23, 59, 59, 999);
    return due < today;
  });
  if (hasOverdue) return ZERO_PANIC.purple;

  const hasDueToday = clientTasks.some(t => {
    if (t.status === 'completed' || t.status === 'not_relevant') return false;
    if (!t.due_date) return false;
    const dueDay = new Date(t.due_date);
    dueDay.setHours(0, 0, 0, 0);
    return dueDay.getTime() === today.getTime();
  });
  if (hasDueToday) return ZERO_PANIC.orange;

  const hasActive = clientTasks.some(t =>
    t.status !== 'completed' && t.status !== 'not_relevant'
  );
  if (hasActive) return ZERO_PANIC.blue;

  return ZERO_PANIC.green;
}

// ─── Main Component ─────────────────────────────────────────────
export default function MindMapView({ tasks, clients, inboxItems = [], onInboxDismiss, focusMode = false }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 700 });

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

    // Build branch data
    const branches = Object.entries(catClientMap).map(([category, clientsObj]) => ({
      category,
      config: BRANCH_CONFIG[category] || BRANCH_CONFIG['אחר'],
      clients: Object.entries(clientsObj).map(([name, clientTasks]) => {
        const client = clients?.find(c => c.name === name);
        const size = estimateSize(client, tasks);
        return {
          name,
          clientId: client?.id,
          size,
          radius: SIZE_MAP[size],
          color: getClientAggregateColor(clientTasks),
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

  // ── Layout Calculation ──
  const layout = useMemo(() => {
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const centerR = 55;
    const branchDistance = Math.min(dimensions.width, dimensions.height) * 0.28;
    const leafDistance = branchDistance * 0.65;

    const angleStep = (2 * Math.PI) / Math.max(branches.length, 1);

    const branchPositions = branches.map((branch, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const bx = cx + Math.cos(angle) * branchDistance;
      const by = cy + Math.sin(angle) * branchDistance;

      // Spread clients around the branch node
      const clientCount = branch.clients.length;
      const clientAngleSpread = Math.min(Math.PI * 0.6, clientCount * 0.35);
      const clientPositions = branch.clients.map((client, j) => {
        const clientAngle = angle + (j - (clientCount - 1) / 2) * (clientAngleSpread / Math.max(clientCount - 1, 1));
        const dist = leafDistance + (j % 2) * 25; // stagger
        return {
          ...client,
          x: bx + Math.cos(clientAngle) * dist,
          y: by + Math.sin(clientAngle) * dist,
          branchX: bx,
          branchY: by,
        };
      });

      return {
        ...branch,
        x: bx,
        y: by,
        angle,
        clientPositions,
      };
    });

    return { cx, cy, centerR, branchPositions };
  }, [branches, dimensions]);

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
      size: client.size,
      color: client.color,
    });
  }, []);

  const handleBranchClick = useCallback((category) => {
    setSelectedBranch(prev => prev === category ? null : category);
  }, []);

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

  return (
    <div ref={containerRef} className="relative w-full min-h-[500px] h-[70vh] max-h-[800px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 via-white to-blue-50/30 border border-gray-200">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
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
        className="absolute z-20 flex flex-col items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl cursor-default select-none"
        style={{
          width: layout.centerR * 2,
          height: layout.centerR * 2,
          left: layout.cx - layout.centerR,
          top: layout.cy - layout.centerR,
        }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <span className="text-sm font-bold leading-tight">היום שלי</span>
        <span className="text-[10px] opacity-80 mt-0.5">{layout.branchPositions.reduce((sum, b) => sum + b.clients.length, 0)} לקוחות</span>
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
            onClick={() => handleBranchClick(branch.category)}
          >
            <span>{branch.config.icon}</span>
            <span>{branch.category}</span>
            <span className="bg-white/25 rounded-full px-1.5 text-[10px]">{branch.clients.length}</span>
          </motion.div>

          {/* ── Client Leaf Nodes ── */}
          {branch.clientPositions.map((client, j) => {
            const isHovered = hoveredNode === client.name;
            const nodeRadius = client.radius;
            const isOverdue = client.overdueTasks > 0;

            return (
              <motion.div
                key={`${branch.category}-${client.name}`}
                className={`absolute z-10 flex items-center justify-center rounded-full border-2 text-white font-medium cursor-pointer select-none
                  ${isOverdue ? 'animate-pulse' : ''}`}
                style={{
                  width: nodeRadius,
                  height: nodeRadius,
                  left: client.x - nodeRadius / 2,
                  top: client.y - nodeRadius / 2,
                  backgroundColor: client.color,
                  borderColor: isHovered ? '#fff' : client.color,
                  fontSize: nodeRadius < 40 ? '8px' : nodeRadius < 60 ? '10px' : '12px',
                  boxShadow: isHovered
                    ? `0 0 20px ${client.color}66, 0 4px 12px rgba(0,0,0,0.2)`
                    : '0 2px 6px rgba(0,0,0,0.12)',
                  opacity: isSpotlit(branch.category) ? 1 : 0.12,
                  transition: 'opacity 0.4s ease-in-out, box-shadow 0.2s ease, border-color 0.2s ease',
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: isSpotlit(branch.category) ? 1 : 0.12,
                  scale: 1,
                }}
                transition={{
                  delay: i * 0.08 + j * 0.04 + 0.2,
                  type: 'spring',
                  stiffness: 180,
                  damping: 14,
                }}
                whileHover={{ scale: 1.3, zIndex: 50 }}
                onMouseEnter={(e) => handleClientHover(client, e.clientX, e.clientY)}
                onMouseLeave={() => { setHoveredNode(null); setTooltip(null); }}
                onDoubleClick={() => handleClientDoubleClick(client)}
                title={`${client.name} (${client.size}) - לחיצה כפולה לפתיחה`}
              >
                {client.name?.substring(0, nodeRadius < 40 ? 2 : 4)}
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
                      strokeWidth={2}
                    />
                    <circle
                      cx={nodeRadius / 2}
                      cy={nodeRadius / 2}
                      r={nodeRadius / 2 - 2}
                      fill="none"
                      stroke="rgba(255,255,255,0.8)"
                      strokeWidth={2}
                      strokeDasharray={`${(client.completedTasks / client.totalTasks) * Math.PI * (nodeRadius - 4)} ${Math.PI * (nodeRadius - 4)}`}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${nodeRadius / 2} ${nodeRadius / 2})`}
                    />
                  </svg>
                )}
              </motion.div>
            );
          })}
        </React.Fragment>
      ))}

      {/* ── Floating Inbox (Parking Lot) ── */}
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

      {/* ── Tooltip ── */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            className="fixed z-[100] bg-white rounded-xl shadow-2xl border border-gray-200 p-3 pointer-events-none"
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
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded">{tooltip.size}</span>
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

      {/* ── Legend ── */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-2">
        {[
          { color: ZERO_PANIC.orange, label: 'להיום' },
          { color: ZERO_PANIC.purple, label: 'באיחור' },
          { color: ZERO_PANIC.blue, label: 'פעיל' },
          { color: ZERO_PANIC.green, label: 'הושלם' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1 text-[10px] text-gray-500">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Size Legend ── */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2 text-[10px] text-gray-400">
        <span>גודל:</span>
        {Object.entries(SIZE_MAP).map(([label, px]) => (
          <div key={label} className="flex items-center gap-0.5">
            <div className="rounded-full bg-gray-300" style={{ width: px / 3, height: px / 3 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Focus Mode Indicator ── */}
      {focusMode && selectedBranch && (
        <motion.div
          className="absolute bottom-4 right-4 z-20 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md border border-gray-200 text-xs text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          🔦 Spotlight: <strong>{selectedBranch}</strong>
          <button
            className="mr-2 text-gray-400 hover:text-gray-700"
            onClick={() => setSelectedBranch(null)}
          >
            ×
          </button>
        </motion.div>
      )}
    </div>
  );
}
