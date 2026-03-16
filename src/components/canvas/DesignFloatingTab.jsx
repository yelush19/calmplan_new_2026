/**
 * -- DesignFloatingTab: Power Design Engine FAB --
 *
 * Floating Action Button for quick design controls across ALL pages (P1-P5).
 * Controls: Presets, Typography, Theme, Shape, Line Style, Curvature, Branch Colors.
 * Features: Quick Presets, Undo/Redo history, Save/Load custom themes.
 * Storage: localStorage (position + history) + DesignContext (preferences).
 * UI/UX ONLY -- no DB schema changes.
 *
 * COLOR RULES: No pink, no red, no fuchsia. Solid, readable colors only.
 * FONT RULES: Minimum 11px. No screaming fonts. Clear contrast.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { motion, useMotionValue, AnimatePresence } from 'framer-motion';
import {
  Paintbrush, X, Type, Palette, Shapes, Sliders,
  Sun, Moon, CloudMoon, Undo2, Redo2, Save, Download,
  Sparkles, Layout, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useDesign, MAP_TEMPLATES, DESIGN_PRESETS } from '@/contexts/DesignContext';

const STORAGE_KEY = 'calmplan_drag_design_fab';
const PANEL_STORAGE_KEY = 'calmplan_design_fab_open';
const HISTORY_KEY = 'calmplan_design_history';
const SAVED_THEMES_KEY = 'calmplan_saved_themes';

// Font options -- readable, professional Hebrew fonts
const FONTS = [
  { key: 'Heebo', label: 'Heebo', sample: '\u05d0\u05d1\u05d2' },
  { key: 'Assistant', label: 'Assistant', sample: '\u05d0\u05d1\u05d2' },
  { key: 'Varela Round', label: 'Varela Round', sample: '\u05d0\u05d1\u05d2' },
  { key: 'Arial Hebrew', label: 'Arial Hebrew', sample: '\u05d0\u05d1\u05d2' },
];

// Shape quick-picks
const QUICK_SHAPES = [
  { key: 'bubble', icon: '\u26aa', label: '\u05d1\u05d5\u05e2\u05d4' },
  { key: 'cloud', icon: '\u2601\ufe0f', label: '\u05e2\u05e0\u05df' },
  { key: 'capsule', icon: '\u{1F48A}', label: '\u05db\u05de\u05d5\u05e1\u05d4' },
  { key: 'star', icon: '\u2b50', label: '\u05db\u05d5\u05db\u05d1' },
  { key: 'hexagon', icon: '\u2b21', label: '\u05de\u05e9\u05d5\u05e9\u05d4' },
  { key: 'speech', icon: '\u{1F4AC}', label: '\u05d3\u05d9\u05d1\u05d5\u05e8' },
  { key: 'diamond', icon: '\u25c6', label: '\u05d9\u05d4\u05dc\u05d5\u05dd' },
  { key: 'heart', icon: '\u2764\ufe0f', label: '\u05dc\u05d1' },
  { key: 'roundedRect', icon: '\u25ac', label: '\u05de\u05dc\u05d1\u05df' },
  { key: 'pill', icon: '\u{1F48A}', label: '\u05d2\u05dc\u05d5\u05dc\u05d4' },
  { key: 'banner', icon: '\u{1F3F3}\ufe0f', label: '\u05d1\u05d0\u05e0\u05e8' },
  { key: 'crown', icon: '\u{1F451}', label: '\u05db\u05ea\u05e8' },
];

// Theme options
const THEMES = [
  { key: 'light', icon: Sun, label: '\u05d1\u05d4\u05d9\u05e8', color: '#FFF' },
  { key: 'soft-gray', icon: CloudMoon, label: '\u05d0\u05e4\u05d5\u05e8 \u05e8\u05da', color: '#E8EAEE' },
  { key: 'dark', icon: Moon, label: '\u05db\u05d4\u05d4', color: '#1E293B' },
];

// Curvature presets
const CURVATURE_PRESETS = [
  { value: 0, label: '\u05d9\u05e9\u05e8' },
  { value: 0.12, label: '\u05e2\u05d3\u05d9\u05df' },
  { value: 0.25, label: '\u05d0\u05d5\u05e8\u05d2\u05e0\u05d9' },
  { value: 0.4, label: '\u05d2\u05dc\u05d9' },
];

// Line style options
const LINE_STYLES = [
  { key: 'tapered', label: '\u05d8\u05e4\u05dc\u05d9' },
  { key: 'solid', label: '\u05de\u05dc\u05d0' },
  { key: 'dashed', label: '\u05de\u05e7\u05d5\u05d5\u05e7\u05d5' },
  { key: 'dotted', label: '\u05e0\u05e7\u05d5\u05d3\u05d5\u05ea' },
];

// Branch color palette -- NO pink, NO red, NO fuchsia. Solid professional colors.
const BRANCH_COLORS = [
  '#00A3E0', '#4682B4', '#1565C0', '#0891B2', '#0EA5E9',
  '#2E7D32', '#059669', '#16A34A', '#0D9488', '#06B6D4',
  '#FF9800', '#F59E0B', '#D97706', '#EA580C', '#B45309',
  '#7C3AED', '#6366F1', '#8B5CF6', '#4F46E5', '#6D28D9',
];

// Sticker library -- organized categories
const STICKER_CATEGORIES = [
  {
    label: '\u05e1\u05d8\u05d8\u05d5\u05e1',
    stickers: ['\u2705', '\u23f3', '\u{1F6A7}', '\u26a0\ufe0f', '\u{1F4CB}', '\u{1F512}', '\u{1F50D}', '\u{1F4E4}'],
  },
  {
    label: '\u05e2\u05d3\u05d9\u05e4\u05d5\u05ea',
    stickers: ['\u{1F525}', '\u26a1', '\u2b50', '\u{1F3AF}', '\u{1F680}', '\u{1F4A1}', '\u{1F4AA}', '\u{1F3C6}'],
  },
  {
    label: '\u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d5\u05ea',
    stickers: ['\u{1F4BC}', '\u{1F4B0}', '\u{1F4CA}', '\u{1F4C5}', '\u{1F465}', '\u{1F3E2}', '\u{1F4DD}', '\u2699\ufe0f'],
  },
  {
    label: '\u05e1\u05de\u05dc\u05d9\u05dd',
    stickers: ['\u{1F7E2}', '\u{1F7E1}', '\u{1F7E0}', '\u{1F535}', '\u{1F7E3}', '\u2b1c', '\u2b1b', '\u{1F536}'],
  },
];

// ── Undo/Redo History Manager ──
function useDesignHistory() {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : { past: [], future: [] };
    } catch { return { past: [], future: [] }; }
  });

  const pushState = useCallback((state) => {
    setHistory(prev => {
      const newHistory = {
        past: [...prev.past.slice(-19), state], // Keep last 20 states
        future: [],
      };
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)); } catch {}
      return newHistory;
    });
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return { history, pushState, canUndo, canRedo, setHistory };
}

// ── Saved Themes Manager ──
function useSavedThemes() {
  const [themes, setThemes] = useState(() => {
    try {
      const saved = localStorage.getItem(SAVED_THEMES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const saveTheme = useCallback((name, prefs) => {
    setThemes(prev => {
      const newThemes = [...prev, { name, prefs, id: Date.now() }].slice(-10); // Max 10
      try { localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(newThemes)); } catch {}
      return newThemes;
    });
  }, []);

  const deleteTheme = useCallback((id) => {
    setThemes(prev => {
      const newThemes = prev.filter(t => t.id !== id);
      try { localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(newThemes)); } catch {}
      return newThemes;
    });
  }, []);

  return { themes, saveTheme, deleteTheme };
}

export default function DesignFloatingTab() {
  const design = useDesign();
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(PANEL_STORAGE_KEY) === 'true'; } catch { return false; }
  });
  // Sections: 'presets' | 'type' | 'theme' | 'shape' | 'line' | 'palette' | 'templates' | 'stickers' | 'saved'
  const [activeSection, setActiveSection] = useState(null);
  const didDrag = useRef(false);
  const { history, pushState, canUndo, canRedo, setHistory } = useDesignHistory();
  const { themes: savedThemes, saveTheme, deleteTheme } = useSavedThemes();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Draggable position
  const initPos = useMemo(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) { const p = JSON.parse(s); if (typeof p.x === 'number') return p; }
    } catch {}
    return { x: 0, y: 0 };
  }, []);

  const mx = useMotionValue(initPos.x);
  const my = useMotionValue(initPos.y);

  const handleDragStart = useCallback(() => { didDrag.current = false; }, []);
  const handleDrag = useCallback(() => { didDrag.current = true; }, []);
  const handleDragEnd = useCallback(() => {
    didDrag.current = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: mx.get(), y: my.get() })); } catch {}
  }, [mx, my]);

  const handleDoubleClick = useCallback(() => {
    mx.set(0); my.set(0);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, [mx, my]);

  const togglePanel = useCallback(() => {
    if (didDrag.current) { didDrag.current = false; return; }
    setIsOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(PANEL_STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  const toggleSection = useCallback((section) => {
    setActiveSection(prev => prev === section ? null : section);
  }, []);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const prevState = history.past[history.past.length - 1];
    const currentState = {
      theme: design.theme, shape: design.shape, lineStyle: design.lineStyle,
      curvature: design.curvature, glassmorphism: design.glassmorphism,
      softShadows: design.softShadows, fontFamily: design.fontFamily,
    };
    // Apply previous state
    Object.entries(prevState).forEach(([k, v]) => design.updatePref(k, v));
    setHistory(prev => ({
      past: prev.past.slice(0, -1),
      future: [currentState, ...prev.future],
    }));
  }, [canUndo, history, design, setHistory]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const nextState = history.future[0];
    const currentState = {
      theme: design.theme, shape: design.shape, lineStyle: design.lineStyle,
      curvature: design.curvature, glassmorphism: design.glassmorphism,
      softShadows: design.softShadows, fontFamily: design.fontFamily,
    };
    // Apply next state
    Object.entries(nextState).forEach(([k, v]) => design.updatePref(k, v));
    setHistory(prev => ({
      past: [...prev.past, currentState],
      future: prev.future.slice(1),
    }));
  }, [canRedo, history, design, setHistory]);

  // Wrapped updatePref with undo history
  const updateWithHistory = useCallback((key, value) => {
    pushState({
      theme: design.theme, shape: design.shape, lineStyle: design.lineStyle,
      curvature: design.curvature, glassmorphism: design.glassmorphism,
      softShadows: design.softShadows, fontFamily: design.fontFamily,
    });
    design.updatePref(key, value);
  }, [design, pushState]);

  // Apply preset with history
  const applyPreset = useCallback((presetKey) => {
    const preset = DESIGN_PRESETS[presetKey];
    if (!preset) return;
    pushState({
      theme: design.theme, shape: design.shape, lineStyle: design.lineStyle,
      curvature: design.curvature, glassmorphism: design.glassmorphism,
      softShadows: design.softShadows, fontFamily: design.fontFamily,
    });
    Object.entries(preset).forEach(([k, v]) => {
      if (['label', 'emoji', 'description'].includes(k)) return;
      if (k === 'branchColors') {
        Object.entries(v).forEach(([branch, color]) => design.setBranchColor(branch, color));
      } else {
        design.updatePref(k, v);
      }
    });
  }, [design, pushState]);

  // Save current theme
  const handleSaveTheme = useCallback(() => {
    if (!saveName.trim()) return;
    saveTheme(saveName.trim(), {
      theme: design.theme, shape: design.shape, lineStyle: design.lineStyle,
      curvature: design.curvature, glassmorphism: design.glassmorphism,
      softShadows: design.softShadows, fontFamily: design.fontFamily,
      branchColors: design.branchColors,
    });
    setSaveName('');
    setSaveDialogOpen(false);
  }, [saveName, design, saveTheme]);

  // Load saved theme
  const handleLoadTheme = useCallback((themePrefs) => {
    pushState({
      theme: design.theme, shape: design.shape, lineStyle: design.lineStyle,
      curvature: design.curvature, glassmorphism: design.glassmorphism,
      softShadows: design.softShadows, fontFamily: design.fontFamily,
    });
    Object.entries(themePrefs).forEach(([k, v]) => {
      if (k === 'branchColors') {
        Object.entries(v).forEach(([branch, color]) => design.setBranchColor(branch, color));
      } else {
        design.updatePref(k, v);
      }
    });
  }, [design, pushState]);

  // Quick actions bar
  const quickActions = [
    { key: 'presets', icon: Sparkles, label: '\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea' },
    { key: 'type', icon: Type, label: '\u05d2\u05d5\u05e4\u05df' },
    { key: 'theme', icon: Sun, label: '\u05e2\u05e8\u05db\u05d4' },
    { key: 'shape', icon: Shapes, label: '\u05e6\u05d5\u05e8\u05d5\u05ea' },
    { key: 'line', icon: Sliders, label: '\u05e7\u05d5\u05d5\u05d9\u05dd' },
    { key: 'palette', icon: Palette, label: '\u05e6\u05d1\u05e2\u05d9\u05dd' },
    { key: 'templates', icon: Layout, label: '\u05de\u05e4\u05d5\u05ea' },
  ];

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onDoubleClick={handleDoubleClick}
      style={{ x: mx, y: my }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] cursor-grab active:cursor-grabbing select-none"
      dir="rtl"
    >
      {/* Main FAB Button */}
      <motion.button
        onClick={togglePanel}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
          isOpen
            ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white'
            : 'bg-white text-indigo-600 border-2 border-indigo-200 hover:border-indigo-400'
        }`}
        title="\u05de\u05e0\u05d5\u05e2 \u05e2\u05d9\u05e6\u05d5\u05d1 \u2022 \u05d2\u05e8\u05d5\u05e8 \u05dc\u05e9\u05d9\u05e0\u05d5\u05d9 \u05de\u05d9\u05e7\u05d5\u05dd"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Paintbrush className="w-5 h-5" />}
      </motion.button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[340px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Header with Undo/Redo + Save */}
            <div className="px-4 py-2.5 bg-gradient-to-l from-indigo-50 to-blue-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-[13px] text-slate-800">\u05de\u05e0\u05d5\u05e2 \u05e2\u05d9\u05e6\u05d5\u05d1</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`p-1.5 rounded-lg transition-all ${canUndo ? 'hover:bg-white/80 text-slate-600' : 'text-slate-300 cursor-not-allowed'}`}
                  title="\u05d1\u05d8\u05dc"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={`p-1.5 rounded-lg transition-all ${canRedo ? 'hover:bg-white/80 text-slate-600' : 'text-slate-300 cursor-not-allowed'}`}
                  title="\u05e9\u05d7\u05d6\u05e8"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                <button
                  onClick={() => { setSaveDialogOpen(true); setActiveSection('saved'); }}
                  className="p-1.5 rounded-lg hover:bg-white/80 text-indigo-500 transition-all"
                  title="\u05e9\u05de\u05d5\u05e8 \u05e2\u05e8\u05db\u05d4"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="px-2 py-2 flex items-center gap-0.5 border-b bg-slate-50/50 overflow-x-auto">
              {quickActions.map(btn => (
                <button
                  key={btn.key}
                  onClick={() => toggleSection(btn.key)}
                  className={`flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                    activeSection === btn.key
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <btn.icon className="w-3.5 h-3.5" />
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Section Content */}
            <div className="max-h-64 overflow-y-auto">

              {/* Presets Section */}
              {activeSection === 'presets' && (
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 font-bold">\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea \u05de\u05d5\u05db\u05e0\u05d5\u05ea:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(DESIGN_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className="text-right p-2.5 rounded-xl border-2 transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          borderColor: design.theme === preset.theme && design.shape === preset.shape
                            ? '#6366F1' : '#E2E8F0',
                          background: design.theme === preset.theme && design.shape === preset.shape
                            ? '#EEF2FF' : 'white',
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">{preset.emoji}</span>
                          <span className="text-[12px] font-bold text-slate-800">{preset.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{preset.description}</p>
                        {/* Color preview dots */}
                        <div className="flex gap-1 mt-1.5">
                          {Object.values(preset.branchColors).map((c, i) => (
                            <div key={i} className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ background: c }} />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Typography Section */}
              {activeSection === 'type' && (
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 font-bold">\u05d2\u05d5\u05e4\u05df:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FONTS.map(f => (
                      <button
                        key={f.key}
                        onClick={() => updateWithHistory('fontFamily', f.key)}
                        className={`px-3 py-2 rounded-xl text-[12px] border-2 transition-all ${
                          design.fontFamily === f.key
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                        style={{ fontFamily: f.key }}
                      >
                        <span className="text-[14px]">{f.sample}</span>
                        <span className="block text-[10px] mt-0.5 opacity-70">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Theme Section */}
              {activeSection === 'theme' && (
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 font-bold">\u05e2\u05e8\u05db\u05ea \u05e0\u05d5\u05e9\u05d0:</p>
                  <div className="flex gap-2">
                    {THEMES.map(t => (
                      <button
                        key={t.key}
                        onClick={() => updateWithHistory('theme', t.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 transition-all ${
                          design.theme === t.key
                            ? 'border-indigo-500 bg-indigo-50 font-bold'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <t.icon className="w-4 h-4" />
                        <span className="text-[12px] font-semibold">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Shape Section */}
              {activeSection === 'shape' && (
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 font-bold">\u05e6\u05d5\u05e8\u05ea \u05d1\u05e8\u05d9\u05e8\u05ea \u05de\u05d7\u05d3\u05dc:</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_SHAPES.map(s => (
                      <button
                        key={s.key}
                        onClick={() => updateWithHistory('shape', s.key)}
                        className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 transition-all ${
                          design.shape === s.key
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-lg">{s.icon}</span>
                        <span className="text-[10px] font-semibold">{s.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Glassmorphism & Shadows */}
                  <div className="flex gap-3 mt-2 pt-2 border-t">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={design.glassmorphism}
                        onChange={(e) => updateWithHistory('glassmorphism', e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-indigo-600"
                      />
                      \u05d6\u05db\u05d5\u05db\u05d9\u05ea
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={design.softShadows}
                        onChange={(e) => updateWithHistory('softShadows', e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-indigo-600"
                      />
                      \u05e6\u05dc\u05dc\u05d9\u05dd \u05e8\u05db\u05d9\u05dd
                    </label>
                  </div>
                </div>
              )}

              {/* Line Style Section */}
              {activeSection === 'line' && (
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 font-bold">\u05e1\u05d2\u05e0\u05d5\u05df \u05e7\u05d5:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LINE_STYLES.map(ls => (
                      <button
                        key={ls.key}
                        onClick={() => updateWithHistory('lineStyle', ls.key)}
                        className={`px-3 py-2 rounded-xl text-[12px] border-2 transition-all font-semibold ${
                          design.lineStyle === ls.key
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {ls.label}
                      </button>
                    ))}
                  </div>

                  {/* Curvature */}
                  <p className="text-[11px] text-slate-500 font-bold mt-3">\u05e7\u05d9\u05de\u05d5\u05e8:</p>
                  <div className="flex gap-1.5">
                    {CURVATURE_PRESETS.map(cp => (
                      <button
                        key={cp.value}
                        onClick={() => updateWithHistory('curvature', cp.value)}
                        className={`flex-1 py-2 text-[11px] rounded-xl border-2 transition-all font-semibold ${
                          Math.abs(design.curvature - cp.value) < 0.05
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {cp.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="0" max="0.5" step="0.05"
                    value={design.curvature}
                    onChange={(e) => updateWithHistory('curvature', parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-1"
                  />
                </div>
              )}

              {/* Palette Section (Branch Colors) */}
              {activeSection === 'palette' && (
                <div className="p-3 space-y-2.5">
                  <p className="text-[11px] text-slate-500 font-bold">\u05e6\u05d1\u05e2\u05d9 \u05e2\u05e0\u05e4\u05d9\u05dd:</p>
                  {['P1', 'P2', 'P3', 'P4', 'P5'].map(branch => (
                    <div key={branch} className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-slate-700 w-7">{branch}</span>
                      <div className="flex gap-1 flex-wrap flex-1">
                        {BRANCH_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => design.setBranchColor(branch, color)}
                            className={`w-5.5 h-5.5 rounded-full border-2 transition-transform hover:scale-125 ${
                              design.branchColors?.[branch] === color
                                ? 'border-slate-800 scale-110 ring-2 ring-slate-300'
                                : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color, width: 22, height: 22 }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Stickers section */}
                  <div className="border-t pt-2 mt-3">
                    <p className="text-[11px] text-slate-500 font-bold mb-2">\u05e1\u05d8\u05d9\u05e7\u05e8\u05d9\u05dd:</p>
                    {STICKER_CATEGORIES.map(cat => (
                      <div key={cat.label} className="mb-2">
                        <span className="text-[10px] text-slate-400 font-medium">{cat.label}:</span>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {cat.stickers.map(sticker => (
                            <button
                              key={sticker}
                              onClick={() => design.setSticker(design.activeTaskId, sticker)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all text-lg hover:scale-110"
                              title={`\u05d4\u05d7\u05dc \u05e1\u05d8\u05d9\u05e7\u05e8 ${sticker}`}
                            >
                              {sticker}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Templates Section */}
              {activeSection === 'templates' && (
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 font-bold">\u05ea\u05d1\u05e0\u05d9\u05ea \u05de\u05e4\u05d4:</p>
                  <div className="space-y-1.5">
                    {Object.entries(MAP_TEMPLATES).map(([key, tpl]) => (
                      <button
                        key={key}
                        onClick={() => {
                          pushState({
                            theme: design.theme, shape: design.shape, lineStyle: design.lineStyle,
                            curvature: design.curvature, glassmorphism: design.glassmorphism,
                            softShadows: design.softShadows, fontFamily: design.fontFamily,
                          });
                          design.applyTemplate(key);
                        }}
                        className={`w-full text-right px-3 py-2.5 rounded-xl border-2 transition-all hover:shadow-sm ${
                          design.mapTemplate === key
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{tpl.emoji || '\u{1F5FA}\ufe0f'}</span>
                          <div>
                            <span className="text-[12px] font-bold text-slate-800">{tpl.label}</span>
                            <p className="text-[10px] text-slate-500">{tpl.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Saved Themes Section */}
              {activeSection === 'saved' && (
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 font-bold">\u05e2\u05e8\u05db\u05d5\u05ea \u05e9\u05de\u05d5\u05e8\u05d5\u05ea:</p>

                  {/* Save dialog */}
                  {saveDialogOpen && (
                    <div className="flex gap-1.5 mb-2">
                      <input
                        autoFocus
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTheme()}
                        placeholder="\u05e9\u05dd \u05dc\u05e2\u05e8\u05db\u05d4..."
                        className="flex-1 text-[12px] px-3 py-1.5 rounded-lg border border-slate-300 outline-none focus:border-indigo-400"
                      />
                      <button
                        onClick={handleSaveTheme}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                      >
                        \u05e9\u05de\u05d5\u05e8
                      </button>
                    </div>
                  )}

                  {savedThemes.length === 0 ? (
                    <div className="text-center py-4 text-[12px] text-slate-400">
                      \u05d0\u05d9\u05df \u05e2\u05e8\u05db\u05d5\u05ea \u05e9\u05de\u05d5\u05e8\u05d5\u05ea. \u05dc\u05d7\u05e5 \u05e2\u05dc \u05db\u05e4\u05ea\u05d5\u05e8 \u05d4\u05e9\u05de\u05d9\u05e8\u05d4 \u05db\u05d3\u05d9 \u05dc\u05e9\u05de\u05d5\u05e8 \u05d0\u05ea \u05d4\u05e2\u05e8\u05db\u05d4 \u05d4\u05e0\u05d5\u05db\u05d7\u05d9\u05ea.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {savedThemes.map(theme => (
                        <div key={theme.id} className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all">
                          <button
                            onClick={() => handleLoadTheme(theme.prefs)}
                            className="flex-1 text-right text-[12px] font-bold text-slate-700"
                          >
                            {theme.name}
                          </button>
                          <button
                            onClick={() => deleteTheme(theme.id)}
                            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 text-[11px]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!saveDialogOpen && (
                    <button
                      onClick={() => setSaveDialogOpen(true)}
                      className="w-full py-2 rounded-xl border-2 border-dashed border-slate-300 text-[12px] text-slate-500 font-medium hover:border-indigo-400 hover:text-indigo-500 transition-all"
                    >
                      + \u05e9\u05de\u05d5\u05e8 \u05e2\u05e8\u05db\u05d4 \u05e0\u05d5\u05db\u05d7\u05d9\u05ea
                    </button>
                  )}
                </div>
              )}

              {/* No section selected -- show summary */}
              {!activeSection && (
                <div className="p-4 text-center text-[12px] text-slate-400 space-y-2">
                  <Sparkles className="w-6 h-6 mx-auto text-indigo-300" />
                  <p className="font-medium">\u05d1\u05d7\u05e8 \u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4 \u05dc\u05de\u05e2\u05dc\u05d4 \u05dc\u05db\u05d9\u05d5\u05d5\u05df \u05e2\u05d9\u05e6\u05d5\u05d1</p>
                  <p className="text-[10px]">\u05d0\u05d5 \u05d1\u05d7\u05e8 \u05ea\u05d1\u05e0\u05d9\u05ea \u05de\u05d5\u05db\u05e0\u05d4 \u05dc\u05d4\u05ea\u05d7\u05dc\u05d4 \u05de\u05d4\u05d9\u05e8\u05d4</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
