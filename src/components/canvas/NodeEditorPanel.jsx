/**
 * ── NodeEditorPanel: AYOA-Style Node Detail Sidebar ──
 *
 * Inspired by AYOA's right-side panel (DropTask style).
 * Shows when a node is selected in any map view.
 * Contains: name, progress, planner, importance, urgency, assignees, description, due date.
 *
 * UI ONLY — reads task data from props, calls onUpdate for changes.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, Calendar, Clock, User, Paperclip, MessageCircle,
  Target, Zap, Star, CheckCircle2, AlertTriangle, FileText,
  Bell, Plus, Edit3
} from 'lucide-react';

// ── Planner Options ──
const PLANNER_OPTIONS = [
  { key: 'now', label: 'עכשיו', color: '#EF4444', bg: '#FEE2E2' },
  { key: 'next', label: 'הבא', color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'soon', label: 'בקרוב', color: '#3B82F6', bg: '#DBEAFE' },
];

// ── Importance/Urgency Dots ──
function DotScale({ value = 0, max = 3, onChange, color = '#F59E0B' }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange?.(i + 1 === value ? 0 : i + 1)}
          className="transition-all hover:scale-125"
        >
          <div
            className="w-5 h-5 rounded-full border-2 transition-all"
            style={{
              background: i < value ? color : 'transparent',
              borderColor: i < value ? color : '#CBD5E1',
              boxShadow: i < value ? `0 0 8px ${color}40` : 'none',
            }}
          />
        </button>
      ))}
    </div>
  );
}

// ── Progress Ring ──
function ProgressRing({ progress = 0, size = 56, strokeWidth = 4, color = '#10B981' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-slate-700">{progress}%</span>
      </div>
    </div>
  );
}

export default function NodeEditorPanel({
  task,
  visible = false,
  onClose,
  onUpdate,
  accentColor = '#3B82F6',
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState('');
  const [localProgress, setLocalProgress] = useState(0);
  const [localPlanner, setLocalPlanner] = useState('');
  const [localImportance, setLocalImportance] = useState(0);
  const [localUrgency, setLocalUrgency] = useState(0);
  const [localDescription, setLocalDescription] = useState('');

  // Sync with task prop
  useEffect(() => {
    if (task) {
      setLocalTitle(task.title || '');
      setLocalProgress(task.progress ?? 0);
      setLocalPlanner(task.planner || '');
      setLocalImportance(task.importance || 0);
      setLocalUrgency(task.urgency || 0);
      setLocalDescription(task.description || '');
    }
  }, [task]);

  const handleUpdate = (field, value) => {
    onUpdate?.(task?.id, { [field]: value });
  };

  return (
    <AnimatePresence>
      {visible && task && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/10 z-[9998]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed right-0 top-0 bottom-0 w-[340px] bg-white shadow-2xl z-[9999] overflow-y-auto"
            dir="rtl"
          >
            {/* Header */}
            <div
              className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between"
              style={{ background: `linear-gradient(135deg, ${accentColor}08, white)` }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: accentColor }}
                />
                {editingTitle ? (
                  <input
                    autoFocus
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    onBlur={() => {
                      setEditingTitle(false);
                      handleUpdate('title', localTitle);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingTitle(false);
                        handleUpdate('title', localTitle);
                      }
                    }}
                    className="text-sm font-bold text-slate-800 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 flex-1 outline-none"
                  />
                ) : (
                  <span
                    className="text-sm font-bold text-slate-800 truncate cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => setEditingTitle(true)}
                  >
                    {localTitle || 'ללא שם'}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-all text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Progress Section */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  התקדמות
                </span>
                <ProgressRing progress={localProgress} color={accentColor} />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={localProgress}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setLocalProgress(val);
                  handleUpdate('progress', val);
                }}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer"
                style={{ accentColor }}
              />

              {/* My Planner — Now / Next / Soon */}
              <div>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5" />
                  תכנון
                </span>
                <div className="flex gap-2">
                  {PLANNER_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        const val = localPlanner === opt.key ? '' : opt.key;
                        setLocalPlanner(val);
                        handleUpdate('planner', val);
                      }}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: localPlanner === opt.key ? opt.bg : '#F8FAFC',
                        color: localPlanner === opt.key ? opt.color : '#94A3B8',
                        border: `2px solid ${localPlanner === opt.key ? opt.color : '#E2E8F0'}`,
                        boxShadow: localPlanner === opt.key ? `0 2px 8px ${opt.color}20` : 'none',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Importance */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" />
                  חשיבות
                </span>
                <DotScale
                  value={localImportance}
                  onChange={(v) => {
                    setLocalImportance(v);
                    handleUpdate('importance', v);
                  }}
                  color="#F59E0B"
                />
              </div>

              {/* Urgency */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  דחיפות
                </span>
                <DotScale
                  value={localUrgency}
                  onChange={(v) => {
                    setLocalUrgency(v);
                    handleUpdate('urgency', v);
                  }}
                  color="#EF4444"
                />
              </div>

              <div className="border-t border-slate-100" />

              {/* Assignees */}
              <div>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                  <User className="w-3.5 h-3.5" />
                  מוטלים
                </span>
                <div className="flex items-center gap-2">
                  {task.assignees?.length > 0 ? (
                    task.assignees.map((a, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[12px] font-bold"
                        title={a}
                      >
                        {a.charAt(0)}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">{task.client_name || 'לא שויך'}</span>
                  )}
                  <button className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-400 transition-all">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                  <FileText className="w-3.5 h-3.5" />
                  תיאור
                </span>
                <textarea
                  value={localDescription}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  onBlur={() => handleUpdate('description', localDescription)}
                  placeholder="הוסף תיאור..."
                  className="w-full text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-200 focus:border-blue-300 focus:ring-1 focus:ring-blue-200 outline-none resize-none transition-all"
                  rows={3}
                />
              </div>

              {/* Due Date */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  תאריך יעד
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {task.due_date || 'לא נקבע'}
                  </span>
                  <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-all">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Reminder */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" />
                  תזכורת
                </span>
                <button className="text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors">
                  + הוסף תזכורת
                </button>
              </div>

              <div className="border-t border-slate-100" />

              {/* Attachments */}
              <div>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                  <Paperclip className="w-3.5 h-3.5" />
                  קבצים מצורפים
                </span>
                <button className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 font-medium hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  הוסף קובץ
                </button>
              </div>

              {/* Comments */}
              <div>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                  <MessageCircle className="w-3.5 h-3.5" />
                  הערות
                </span>
                <div className="flex gap-2">
                  <input
                    placeholder="הוסף הערה..."
                    className="flex-1 text-xs bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus:border-blue-300 outline-none transition-all"
                  />
                  <button
                    className="px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:shadow-md"
                    style={{ background: accentColor }}
                  >
                    שלח
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
