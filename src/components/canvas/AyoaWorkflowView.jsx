/**
 * ── AyoaWorkflowView: Layered Workflow Board (AYOA-Style) ──
 *
 * Groups tasks by category/status into horizontal swim-lanes.
 * Each lane shows tasks as colored bars with progress indicators.
 * Inspired by AYOA's Workflow view with section grouping + progress bars.
 *
 * UI ONLY — no business logic changes.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronLeft, CheckCircle2, Clock, AlertCircle,
  GripVertical, User, Calendar as CalendarIcon, MoreHorizontal,
  Layers, FolderOpen
} from 'lucide-react';
import { TASK_STATUS_CONFIG } from '@/config/processTemplates';

// ── Status color mapping ──
const STATUS_COLORS = {
  completed: { bg: '#10B981', light: '#D1FAE5', text: '#065F46' },
  production_completed: { bg: '#10B981', light: '#D1FAE5', text: '#065F46' },
  sent_for_review: { bg: '#3B82F6', light: '#DBEAFE', text: '#1E40AF' },
  ready_to_broadcast: { bg: '#0D9488', light: '#CCFBF1', text: '#134E4A' },
  reported_pending_payment: { bg: '#6366F1', light: '#E0E7FF', text: '#3730A3' },
  in_progress: { bg: '#F59E0B', light: '#FEF3C7', text: '#92400E' },
  waiting_for_materials: { bg: '#8B5CF6', light: '#EDE9FE', text: '#5B21B6' },
  needs_corrections: { bg: '#EF4444', light: '#FEE2E2', text: '#991B1B' },
  not_started: { bg: '#94A3B8', light: '#F1F5F9', text: '#475569' },
};

// ── Category colors for swim-lanes ──
const LANE_COLORS = [
  { accent: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  { accent: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  { accent: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  { accent: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  { accent: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
  { accent: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { accent: '#06B6D4', bg: '#ECFEFF', border: '#A5F3FC' },
  { accent: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
];

// ── Grouping modes ──
const GROUP_MODES = [
  { key: 'category', label: 'קטגוריה', icon: FolderOpen },
  { key: 'status', label: 'סטטוס', icon: Layers },
  { key: 'client', label: 'לקוח', icon: User },
];

function getStatusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.not_started;
}

function getProgressPercent(task) {
  if (task.progress != null) return task.progress;
  const status = task.status || 'not_started';
  if (status === 'completed' || status === 'production_completed') return 100;
  if (status === 'reported_pending_payment') return 90;
  if (status === 'ready_to_broadcast') return 80;
  if (status === 'sent_for_review') return 75;
  if (status === 'in_progress') return 50;
  if (status === 'waiting_for_materials') return 30;
  if (status === 'needs_corrections') return 60;
  return 0;
}

function getStatusIcon(status) {
  if (status === 'completed' || status === 'production_completed') return CheckCircle2;
  if (status === 'in_progress' || status === 'sent_for_review' || status === 'ready_to_broadcast' || status === 'reported_pending_payment') return Clock;
  if (status === 'needs_corrections') return AlertCircle;
  return Clock;
}

// ── Single Task Bar ──
function WorkflowTaskBar({ task, onEditTask, index }) {
  const status = task.status || 'not_started';
  const colors = getStatusColor(status);
  const progress = getProgressPercent(task);
  const StatusIcon = getStatusIcon(status);
  const statusConfig = TASK_STATUS_CONFIG?.[status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, type: 'spring', stiffness: 200, damping: 20 }}
      onClick={() => onEditTask?.(task)}
      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all hover:shadow-md"
      style={{
        background: 'white',
        border: `1px solid ${colors.light}`,
      }}
      whileHover={{ scale: 1.01, y: -1 }}
    >
      {/* Drag handle */}
      <div className="opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical className="w-3.5 h-3.5 text-slate-400" />
      </div>

      {/* Status indicator dot */}
      <div className="relative shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: colors.light }}
        >
          <StatusIcon className="w-4 h-4" style={{ color: colors.bg }} />
        </div>
        {progress === 100 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center"
          >
            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
          </motion.div>
        )}
      </div>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800 truncate">{task.title}</span>
          {task.priority === 'high' && (
            <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">דחוף</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {task.client_name && (
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <User className="w-3 h-3" />
              {task.client_name}
            </span>
          )}
          {task.due_date && (
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              {task.due_date}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-24 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-bold" style={{ color: colors.text }}>
            {statusConfig?.text || status}
          </span>
          <span className="text-[12px] font-bold text-slate-500">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: colors.bg }}
          />
        </div>
      </div>

      {/* More button */}
      <button className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-slate-100 transition-all">
        <MoreHorizontal className="w-4 h-4 text-slate-400" />
      </button>
    </motion.div>
  );
}

// ── Swim Lane (Category/Status Group) ──
function WorkflowLane({ title, tasks, laneColor, onEditTask, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const completedCount = tasks.filter(t =>
    t.status === 'completed' || t.status === 'production_completed'
  ).length;
  const totalProgress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + getProgressPercent(t), 0) / tasks.length)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: laneColor.bg,
        border: `1px solid ${laneColor.border}`,
      }}
    >
      {/* Lane Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 transition-all hover:brightness-95"
        style={{ background: laneColor.bg }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4" style={{ color: laneColor.accent }} />
        </motion.div>

        <div
          className="w-2 h-8 rounded-full"
          style={{ background: laneColor.accent }}
        />

        <div className="flex-1 text-right">
          <span className="text-sm font-bold text-slate-800">{title}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-slate-500 font-medium">
              {tasks.length} משימות
            </span>
            <span className="text-[11px] font-medium" style={{ color: laneColor.accent }}>
              {completedCount}/{tasks.length} הושלמו
            </span>
          </div>
        </div>

        {/* Lane progress bar */}
        <div className="w-32 shrink-0">
          <div className="h-2 rounded-full bg-white/60 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${laneColor.accent}, ${laneColor.accent}CC)` }}
            />
          </div>
          <span className="text-[12px] font-bold text-slate-500 mt-0.5 block text-left">
            {totalProgress}%
          </span>
        </div>
      </button>

      {/* Lane Tasks */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5">
              {tasks.map((task, idx) => (
                <WorkflowTaskBar
                  key={task.id || idx}
                  task={task}
                  onEditTask={onEditTask}
                  index={idx}
                />
              ))}
              {tasks.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-400 font-medium">
                  אין משימות בקטגוריה זו
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Workflow View ──
export default function AyoaWorkflowView({ tasks = [], onEditTask }) {
  const [groupBy, setGroupBy] = useState('category');
  const [sortBy, setSortBy] = useState('status'); // status | due_date | priority

  // Group tasks based on selected mode
  const groupedTasks = useMemo(() => {
    const groups = {};

    for (const task of tasks) {
      let key;
      switch (groupBy) {
        case 'status':
          key = task.status || 'not_started';
          break;
        case 'client':
          key = task.client_name || 'ללא לקוח';
          break;
        case 'category':
        default:
          key = task.category || task.service_type || 'כללי';
          break;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }

    // Sort tasks within each group
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (sortBy === 'due_date') {
          return (a.due_date || '').localeCompare(b.due_date || '');
        }
        if (sortBy === 'priority') {
          const p = { high: 0, medium: 1, low: 2 };
          return (p[a.priority] ?? 2) - (p[b.priority] ?? 2);
        }
        // Default: sort by status progress
        return getProgressPercent(b) - getProgressPercent(a);
      });
    }

    return groups;
  }, [tasks, groupBy, sortBy]);

  const groupKeys = Object.keys(groupedTasks);

  // Overall stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t =>
    t.status === 'completed' || t.status === 'production_completed'
  ).length;
  const overallProgress = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Layers className="w-10 h-10 mb-3 text-slate-300" />
        <p className="text-sm font-bold">אין משימות להצגה</p>
        <p className="text-xs text-slate-400 mt-1">הוסף משימות כדי לראות את תצוגת השכבות</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3" dir="rtl">
      {/* Top Bar — Group & Sort Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Group by selector */}
        <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
          {GROUP_MODES.map(mode => {
            const Icon = mode.icon;
            const isActive = groupBy === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => setGroupBy(mode.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white shadow-sm text-blue-700'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Stats summary */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-bold text-slate-700">{completedTasks}/{totalTasks}</span>
            משימות הושלמו
          </div>
          <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 1 }}
              className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-emerald-400"
            />
          </div>
          <span className="text-xs font-bold text-emerald-600">{overallProgress}%</span>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-400 font-medium">מיון:</span>
          {[
            { key: 'status', label: 'סטטוס' },
            { key: 'due_date', label: 'תאריך' },
            { key: 'priority', label: 'עדיפות' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                sortBy === s.key
                  ? 'bg-slate-200 text-slate-800 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Swim Lanes */}
      <div className="space-y-3">
        {groupKeys.map((key, idx) => (
          <WorkflowLane
            key={key}
            title={
              groupBy === 'status' && TASK_STATUS_CONFIG?.[key]
                ? TASK_STATUS_CONFIG[key].text
                : key
            }
            tasks={groupedTasks[key]}
            laneColor={LANE_COLORS[idx % LANE_COLORS.length]}
            onEditTask={onEditTask}
            defaultOpen={idx < 5}
          />
        ))}
      </div>
    </div>
  );
}
