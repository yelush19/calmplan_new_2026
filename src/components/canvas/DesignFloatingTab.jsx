/**
 * ── DesignFloatingTab: Persistent Draggable FAB ──
 *
 * Floating Action Button for quick design controls across ALL pages (P1-P5).
 * Controls: Typography, Theme, Palette, Shape Selector, Curvature, Line Style.
 * Storage: localStorage (position) + DesignContext (preferences).
 * UI/UX ONLY — no DB schema changes.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, useMotionValue, AnimatePresence } from 'framer-motion';
import {
  Paintbrush, X, Type, Palette, Shapes, Sliders,
  Sun, Moon, CloudMoon, ChevronUp, ChevronDown
} from 'lucide-react';
import { useDesign, MAP_TEMPLATES } from '@/contexts/DesignContext';

const STORAGE_KEY = 'calmplan_drag_design_fab';
const PANEL_STORAGE_KEY = 'calmplan_design_fab_open';

// Font options
const FONTS = [
  { key: 'Heebo', label: 'Heebo' },
  { key: 'Assistant', label: 'Assistant' },
  { key: 'Varela Round', label: 'Varela Round' },
  { key: 'Arial Hebrew', label: 'Arial Hebrew' },
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
  { key: 'tapered', label: 'טפרי' },
  { key: 'solid', label: 'מלא' },
  { key: 'dashed', label: 'מקווקו' },
  { key: 'dotted', label: 'נקודות' },
];

export default function DesignFloatingTab() {
  const design = useDesign();
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(PANEL_STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [activeSection, setActiveSection] = useState(null); // 'type' | 'theme' | 'palette' | 'shape' | 'line'
  const didDrag = useRef(false);

  // Draggable position
  const initPos = React.useMemo(() => {
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
    mx.set(0);
    my.set(0);
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
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
          isOpen
            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
            : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400'
        }`}
        title="מנוע עיצוב • גרור לשינוי מיקום"
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
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-2.5 bg-gradient-to-l from-blue-50 to-purple-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-xs text-gray-800">מנוע עיצוב גלובלי</span>
              </div>
              <span className="text-[9px] text-gray-400">
                {design.mapTemplate ? MAP_TEMPLATES[design.mapTemplate]?.label : ''}
              </span>
            </div>

            {/* Quick Actions Row */}
            <div className="px-3 py-2 flex items-center gap-1 border-b bg-gray-50/50">
              {[
                { key: 'type', icon: Type, label: 'טיפוגרפיה' },
                { key: 'theme', icon: Sun, label: 'ערכת נושא' },
                { key: 'shape', icon: Shapes, label: 'צורות' },
                { key: 'line', icon: Sliders, label: 'קווים' },
                { key: 'palette', icon: Palette, label: 'פלטה' },
              ].map(btn => (
                <button
                  key={btn.key}
                  onClick={() => toggleSection(btn.key)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[9px] font-medium transition-all ${
                    activeSection === btn.key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <btn.icon className="w-3.5 h-3.5" />
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Section Content */}
            <div className="max-h-56 overflow-y-auto">
              {/* Typography Section */}
              {activeSection === 'type' && (
                <div className="p-3 space-y-2">
                  <p className="text-[10px] text-gray-500 font-medium">גופן:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FONTS.map(f => (
                      <button
                        key={f.key}
                        onClick={() => design.updatePref('fontFamily', f.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                          design.fontFamily === f.key
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                        style={{ fontFamily: f.key }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Theme Section */}
              {activeSection === 'theme' && (
                <div className="p-3 space-y-2">
                  <p className="text-[10px] text-gray-500 font-medium">ערכת נושא:</p>
                  <div className="flex gap-2">
                    {THEMES.map(t => (
                      <button
                        key={t.key}
                        onClick={() => design.updatePref('theme', t.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 transition-all ${
                          design.theme === t.key
                            ? 'border-blue-500 bg-blue-50 font-bold'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <t.icon className="w-4 h-4" />
                        <span className="text-[10px]">{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Map Templates */}
                  <p className="text-[10px] text-gray-500 font-medium mt-3">תבנית מפה:</p>
                  <div className="space-y-1.5">
                    {Object.entries(MAP_TEMPLATES).map(([key, tpl]) => (
                      <button
                        key={key}
                        onClick={() => design.applyTemplate(key)}
                        className={`w-full text-right px-3 py-2 rounded-xl border transition-all ${
                          design.mapTemplate === key
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xs font-bold text-gray-800">{tpl.label}</span>
                        <p className="text-[9px] text-gray-500">{tpl.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Shape Section */}
              {activeSection === 'shape' && (
                <div className="p-3 space-y-2">
                  <p className="text-[10px] text-gray-500 font-medium">צורת ברירת מחדל:</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {QUICK_SHAPES.map(s => (
                      <button
                        key={s.key}
                        onClick={() => design.updatePref('shape', s.key)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all text-xs ${
                          design.shape === s.key
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span>{s.icon}</span>
                        <span className="text-[10px]">{s.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Glassmorphism & Shadows */}
                  <div className="flex gap-3 mt-2 pt-2 border-t">
                    <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={design.glassmorphism}
                        onChange={(e) => design.updatePref('glassmorphism', e.target.checked)}
                        className="w-3 h-3 rounded accent-blue-600"
                      />
                      זכוכית
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={design.softShadows}
                        onChange={(e) => design.updatePref('softShadows', e.target.checked)}
                        className="w-3 h-3 rounded accent-blue-600"
                      />
                      צללים רכים
                    </label>
                  </div>
                </div>
              )}

              {/* Line Style Section */}
              {activeSection === 'line' && (
                <div className="p-3 space-y-2">
                  <p className="text-[10px] text-gray-500 font-medium">סגנון קו:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LINE_STYLES.map(ls => (
                      <button
                        key={ls.key}
                        onClick={() => design.updatePref('lineStyle', ls.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                          design.lineStyle === ls.key
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {ls.label}
                      </button>
                    ))}
                  </div>

                  {/* Curvature */}
                  <p className="text-[10px] text-gray-500 font-medium mt-3">קימור:</p>
                  <div className="flex gap-1.5">
                    {CURVATURE_PRESETS.map(cp => (
                      <button
                        key={cp.value}
                        onClick={() => design.updatePref('curvature', cp.value)}
                        className={`flex-1 py-1.5 text-[10px] rounded-lg border transition-all ${
                          Math.abs(design.curvature - cp.value) < 0.05
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {cp.label}
                      </button>
                    ))}
                  </div>

                  {/* Curvature slider for fine control */}
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.05"
                    value={design.curvature}
                    onChange={(e) => design.updatePref('curvature', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-1"
                  />
                </div>
              )}

              {/* Palette Section (Branch Colors) */}
              {activeSection === 'palette' && (
                <div className="p-3 space-y-2">
                  <p className="text-[10px] text-gray-500 font-medium">צבעי ענפים:</p>
                  {['P1', 'P2', 'P3', 'P4', 'P5'].map(branch => (
                    <div key={branch} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-700 w-6">{branch}</span>
                      <div className="flex gap-1 flex-wrap flex-1">
                        {[
                          '#00A3E0', '#4682B4', '#1565C0', '#7B1FA2', '#E91E63',
                          '#F57C00', '#FFC107', '#2E7D32', '#00897B', '#EF4444',
                          '#9C27B0', '#FF6B9D',
                        ].map(color => (
                          <button
                            key={color}
                            onClick={() => design.setBranchColor(branch, color)}
                            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${
                              design.branchColors?.[branch] === color
                                ? 'border-gray-800 scale-110 ring-1 ring-gray-400'
                                : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No section selected — show summary */}
              {!activeSection && (
                <div className="p-3 text-center text-[10px] text-gray-400">
                  בחר קטגוריה למעלה לכוונון עיצוב
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
