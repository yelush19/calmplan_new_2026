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
  { key: 'Heebo', label: 'Heebo', sample: 'אבג' },
  { key: 'Assistant', label: 'Assistant', sample: 'אבג' },
  { key: 'Varela Round', label: 'Varela Round', sample: 'אבג' },
  { key: 'Arial Hebrew', label: 'Arial Hebrew', sample: 'אבג' },
];

// Shape quick-picks
const QUICK_SHAPES = [
  { key: 'bubble', icon: '⚪', label: 'בועה' },
  { key: 'cloud', icon: '☁️', label: 'ענן' },
  { key: 'capsule', icon: '💊', label: 'כמוסה' },
  { key: 'star', icon: '⭐', label: 'כוכב' },
  { key: 'hexagon', icon: '⬡', label: 'משושה' },
  { key: 'speech', icon: '💬', label: 'דיבור' },
  { key: 'diamond', icon: '◆', label: 'יהלום' },
  { key: 'heart', icon: '❤️', label: 'לב' },
  { key: 'roundedRect', icon: '▬', label: 'מלבן' },
  { key: 'pill', icon: '💊', label: 'גלולה' },
  { key: 'banner', icon: '🏳️', label: 'באנר' },
  { key: 'crown', icon: '👑', label: 'כתר' },
];

// Theme options
const THEMES = [
  { key: 'light', icon: Sun, label: 'בהיר', color: '#FFF' },
  { key: 'soft-gray', icon: CloudMoon, label: 'אפור רך', color: '#E8EAEE' },
  { key: 'dark', icon: Moon, label: 'כהה', color: '#1E293B' },
];

// Curvature presets
const CURVATURE_PRESETS = [
  { value: 0, label: 'ישר' },
  { value: 0.12, label: 'עדין' },
  { value: 0.25, label: 'אורגני' },
  { value: 0.4, label: 'גלי' },
];

// Line style options
const LINE_STYLES = [
  { key: 'tapered', label: 'טפלי' },
  { key: 'solid', label: 'מלא' },
  { key: 'dashed', label: 'מקווקו' },
  { key: 'dotted', label: 'נקודות' },
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
    label: 'סטטוס',
    stickers: ['✅', '⏳', '🚧', '⚠️', '📋', '🔒', '🔍', '📤'],
  },
  {
    label: 'עדיפות',
    stickers: ['🔥', '⚡', '⭐', '🎯', '🚀', '💡', '💪', '🏆'],
  },
  {
    label: 'קטגוריות',
    stickers: ['💼', '💰', '📊', '📅', '👥', '🏢', '📝', '⚙️'],
  },
  {
    label: 'סמלים',
    stickers: ['🟢', '🟡', '🟠', '🔵', '🟣', '⬜', '⬛', '🔶'],
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

const ONBOARDING_KEY = 'calmplan_design_onboarding_seen';

export default function DesignFloatingTab() {
  const design = useDesign();
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(PANEL_STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem(ONBOARDING_KEY); } catch { return true; }
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
    { key: 'presets', icon: Sparkles, label: 'תבניות' },
    { key: 'type', icon: Type, label: 'גופן' },
    { key: 'theme', icon: Sun, label: 'ערכה' },
    { key: 'shape', icon: Shapes, label: 'צורות' },
    { key: 'line', icon: Sliders, label: 'קווים' },
    { key: 'palette', icon: Palette, label: 'צבעים' },
    { key: 'templates', icon: Layout, label: 'מפות' },
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
        title="מנוע עיצוב • גרור לשינוי מיקום"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Paintbrush className="w-5 h-5" />}
      </motion.button>

      {/* First-visit Onboarding Tooltip */}
      <AnimatePresence>
        {showOnboarding && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 bg-white rounded-2xl shadow-xl border-2 border-indigo-100 p-4 z-50"
          >
            <div className="text-center space-y-2">
              <Paintbrush className="w-8 h-8 text-indigo-500 mx-auto" />
              <h4 className="font-bold text-sm text-slate-800">מנוע עיצוב</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                התאימי את העיצוב שלך בקליק אחד: תבניות מוכנות, צבעים, צורות ומפות.
              </p>
              <div className="flex gap-2 justify-center pt-1">
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch {}
                    togglePanel();
                  }}
                  className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-600 transition-colors"
                >
                  נסי עכשיו
                </button>
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch {}
                  }}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                >
                  אחר כך
                </button>
              </div>
            </div>
            {/* Arrow pointing down */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-2 border-r-2 border-indigo-100 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

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
                <span className="font-bold text-[13px] text-slate-800">מנוע עיצוב</span>
                <button
                  onClick={() => {
                    design.applyTemplate('ayoa-organic');
                    pushState({ theme: design.theme, shape: design.shape, lineStyle: design.lineStyle, curvature: design.curvature });
                  }}
                  className="px-2 py-0.5 bg-indigo-500 text-white rounded-full text-[10px] font-bold hover:bg-indigo-600 transition-colors"
                  title="החלת תבנית מיטבית בקליק אחד"
                >
                  FULL SERVICE
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`p-1.5 rounded-lg transition-all ${canUndo ? 'hover:bg-white/80 text-slate-600' : 'text-slate-300 cursor-not-allowed'}`}
                  title="בטל"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={`p-1.5 rounded-lg transition-all ${canRedo ? 'hover:bg-white/80 text-slate-600' : 'text-slate-300 cursor-not-allowed'}`}
                  title="שחזר"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                <button
                  onClick={() => { setSaveDialogOpen(true); setActiveSection('saved'); }}
                  className="p-1.5 rounded-lg hover:bg-white/80 text-indigo-500 transition-all"
                  title="שמור ערכה"
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
                  <p className="text-[11px] text-slate-500 font-bold">תבניות מוכנות:</p>
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
                  <p className="text-[11px] text-slate-500 font-bold">גופן:</p>
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
                  <p className="text-[11px] text-slate-500 font-bold">ערכת נושא:</p>
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
                  <p className="text-[11px] text-slate-500 font-bold">צורת ברירת מחדל:</p>
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
                      זכוכית
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={design.softShadows}
                        onChange={(e) => updateWithHistory('softShadows', e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-indigo-600"
                      />
                      צללים רכים
                    </label>
                  </div>
                </div>
              )}

              {/* Line Style Section */}
              {activeSection === 'line' && (
                <div className="p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 font-bold">סגנון קו:</p>
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
                  <p className="text-[11px] text-slate-500 font-bold mt-3">קימור:</p>
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
                  <p className="text-[11px] text-slate-500 font-bold">צבעי ענפים:</p>
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
                    <p className="text-[11px] text-slate-500 font-bold mb-2">סטיקרים:</p>
                    {STICKER_CATEGORIES.map(cat => (
                      <div key={cat.label} className="mb-2">
                        <span className="text-[10px] text-slate-400 font-medium">{cat.label}:</span>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {cat.stickers.map(sticker => (
                            <button
                              key={sticker}
                              onClick={() => design.setSticker(design.activeTaskId, sticker)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all text-lg hover:scale-110"
                              title={`החל סטיקר ${sticker}`}
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
                  <p className="text-[11px] text-slate-500 font-bold">תבנית מפה:</p>
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
                          <span className="text-base">{tpl.emoji || '🗺️'}</span>
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
                  <p className="text-[11px] text-slate-500 font-bold">ערכות שמורות:</p>

                  {/* Save dialog */}
                  {saveDialogOpen && (
                    <div className="flex gap-1.5 mb-2">
                      <input
                        autoFocus
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTheme()}
                        placeholder="שם לערכה..."
                        className="flex-1 text-[12px] px-3 py-1.5 rounded-lg border border-slate-300 outline-none focus:border-indigo-400"
                      />
                      <button
                        onClick={handleSaveTheme}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                      >
                        שמור
                      </button>
                    </div>
                  )}

                  {savedThemes.length === 0 ? (
                    <div className="text-center py-4 text-[12px] text-slate-400">
                      אין ערכות שמורות. לחץ על כפתור השמירה כדי לשמור את הערכה הנוכחית.
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
                      + שמור ערכה נוכחית
                    </button>
                  )}
                </div>
              )}

              {/* No section selected -- show summary */}
              {!activeSection && (
                <div className="p-4 text-center text-[12px] text-slate-400 space-y-2">
                  <Sparkles className="w-6 h-6 mx-auto text-indigo-300" />
                  <p className="font-medium">בחר קטגוריה למעלה לכיוון עיצוב</p>
                  <p className="text-[10px]">או בחר תבנית מוכנה להתחלה מהירה</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
