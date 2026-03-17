/**
 * -- DesignPanel: Global Design Engine UI (Upgraded) --
 *
 * Tabs: Shape | Color | Sticker | Template | Backgrounds | Animations
 * All changes sync instantly across ALL views via DesignContext.
 * Dynamic, animated, AYOA-inspired.
 *
 * COLOR RULES: No pink, no red, no fuchsia in palette.
 * FONT RULES: Minimum 11px. Clear, readable text.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Shapes, Sticker, X, RotateCcw, Paintbrush,
  Layout, Sparkles, Image, Wand2
} from 'lucide-react';
import { useDesign, MAP_TEMPLATES, DESIGN_PRESETS } from '@/contexts/DesignContext';

// -- Shape Options (12 shapes) --
const SHAPES = [
  { key: 'cloud', label: 'ענן', icon: '☁️' },
  { key: 'bubble', label: 'בועה', icon: '⚪' },
  { key: 'star', label: 'כוכב', icon: '⭐' },
  { key: 'hexagon', label: 'משושה', icon: '⬡' },
  { key: 'speech', label: 'דיבור', icon: '🗨️' },
  { key: 'diamond', label: 'יהלום', icon: '◆' },
  { key: 'capsule', label: 'כמוסה', icon: '💊' },
  { key: 'roundedRect', label: 'מלבן', icon: '▬' },
  { key: 'heart', label: 'לב', icon: '💚' },
  { key: 'banner', label: 'באנר', icon: '🏳️' },
  { key: 'crown', label: 'כתר', icon: '👑' },
  { key: 'pill', label: 'גלולה', icon: '💊' },
];

// -- Color Palette (NO pink, NO red, NO fuchsia) --
const COLORS = [
  { key: '#00A3E0', label: 'תכלת' },
  { key: '#4682B4', label: 'כחול פלדה' },
  { key: '#1565C0', label: 'כחול עמוק' },
  { key: '#0891B2', label: 'ציאן' },
  { key: '#6366F1', label: 'אינדיגו' },
  { key: '#F59E0B', label: 'ענבר' },
  { key: '#FF9800', label: 'כתום' },
  { key: '#2E7D32', label: 'ירוק' },
  { key: '#059669', label: 'אמרלד' },
  { key: '#7C3AED', label: 'סגול' },
  { key: '#0D9488', label: 'טיל' },
  { key: '#D97706', label: 'דבש' },
];

// -- Sticker Library (organized by category) --
const STICKER_TABS = [
  {
    label: 'סטטוס',
    stickers: ['✅', '⏳', '🚧', '⚠️', '📋', '🔒', '🔍', '📤',
               '🔄', '📥', '🚫', '⭕'],
  },
  {
    label: 'עדיפות',
    stickers: ['🔥', '⚡', '⭐', '🎯', '🚀', '💡', '💪', '🏆',
               '🌟', '💥', '✨', '💫'],
  },
  {
    label: 'קטגוריות',
    stickers: ['💼', '💰', '📊', '📅', '👥', '🏢', '📝', '⚙️',
               '📁', '📎', '🗂️', '📈'],
  },
  {
    label: 'סמלים',
    stickers: ['🟢', '🟡', '🟠', '🔵', '🟣', '⬜', '⬛', '🔶',
               '🔷', '🔸', '🔹', '🔺'],
  },
  {
    label: 'אובייקטים',
    stickers: ['📦', '💳', '💵', '💸', '🏠', '🚗', '✈️', '📱',
               '💻', '🖨️', '☎️', '📷'],
  },
];

// -- Background options --
const BACKGROUNDS = [
  { key: 'clean', label: 'נקי', preview: '#FFFFFF' },
  { key: 'grid', label: 'רשת', preview: 'repeating-linear-gradient(0deg, #f0f0f0 0px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #f0f0f0 0px, transparent 1px, transparent 20px)' },
  { key: 'dots', label: 'נקודות', preview: 'radial-gradient(circle, #ddd 1px, transparent 1px)' },
  { key: 'soft-gradient', label: 'גרדיאנט', preview: 'linear-gradient(135deg, #f5f7fa, #e8ecf0)' },
  { key: 'warm', label: 'חמים', preview: 'linear-gradient(135deg, #fef9ef, #fdf2e9)' },
  { key: 'cool', label: 'קריר', preview: 'linear-gradient(135deg, #eef2ff, #e0e7ff)' },
];

// -- Animation presets --
const ANIMATIONS = [
  { key: 'none', label: 'ללא', description: 'בלי אנימציה' },
  { key: 'fade', label: 'דעיכה', description: 'כניסה עם דעיכה עדינה' },
  { key: 'scale', label: 'התמודדות', description: 'התמודדות מהמרכז החוצה' },
  { key: 'slide', label: 'החלקה', description: 'החלקה מהצד' },
  { key: 'bounce', label: 'קפיצה', description: 'כניסה עם קפיצה' },
  { key: 'stagger', label: 'מדורג', description: 'צמתים נכנסים ברצף' },
];

export default function DesignPanel({ isOpen, onClose }) {
  const design = useDesign();
  const [activeTab, setActiveTab] = useState('shape');
  const [activeStickerTab, setActiveStickerTab] = useState(0);

  const handleShapeSelect = useCallback((shapeKey) => {
    if (design.activeTaskId) {
      design.updateTaskStyle({ shape: shapeKey });
    } else {
      design.updatePref('shape', shapeKey);
    }
  }, [design]);

  const handleColorSelect = useCallback((color) => {
    if (design.activeTaskId) {
      design.updateTaskStyle({ color });
    }
  }, [design]);

  const handleStickerSelect = useCallback((sticker) => {
    if (design.activeTaskId) {
      design.updateTaskStyle({ sticker });
    }
  }, [design]);

  const handleTemplateApply = useCallback((templateKey) => {
    design.applyTemplate(templateKey);
  }, [design]);

  if (!isOpen) return null;

  const tabs = [
    { key: 'shape', icon: Shapes, label: 'צורה' },
    { key: 'color', icon: Palette, label: 'צבע' },
    { key: 'sticker', icon: Sticker, label: 'סטיקר' },
    { key: 'template', icon: Layout, label: 'תבנית' },
    { key: 'background', icon: Image, label: 'רקע' },
    { key: 'animation', icon: Wand2, label: 'אנימציה' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-80 bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden"
        dir="rtl"
        initial={{ x: -320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -320, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-indigo-50 to-blue-50 border-b">
          <div className="flex items-center gap-2">
            <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
              <Paintbrush className="w-5 h-5 text-indigo-600" />
            </motion.div>
            <span className="font-bold text-[14px] text-slate-800">מנוע עיצוב</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => design.resetToDefaults()} className="p-1.5 rounded-full hover:bg-white/80 text-slate-400 hover:text-slate-600 transition-all" title="איפוס">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/80 text-slate-400 hover:text-slate-600 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Selection */}
        {design.activeTaskId && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="px-4 py-2 bg-indigo-50 border-b flex items-center justify-between">
            <span className="text-[12px] text-indigo-700 font-bold">עיצוב: {design.activeTaskId}</span>
            <button onClick={() => design.clearSelection()} className="text-[12px] text-indigo-500 hover:text-indigo-700 font-medium">נקה בחירה</button>
          </motion.div>
        )}

        {/* Tab Bar */}
        <div className="flex border-b bg-slate-50 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-1 py-2.5 px-2.5 text-[12px] font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.key ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Shape Selection */}
            {activeTab === 'shape' && (
              <motion.div key="shape" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[12px] text-slate-500 font-medium">מצב מילוי:</p>
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => design.updatePref('fillMode', 'filled')}
                      className={`px-3 py-1.5 text-[12px] rounded-md transition-all ${(design.fillMode || 'filled') === 'filled' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'text-slate-500'}`}>מלא</button>
                    <button onClick={() => design.updatePref('fillMode', 'border')}
                      className={`px-3 py-1.5 text-[12px] rounded-md transition-all ${design.fillMode === 'border' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'text-slate-500'}`}>קו בלבד</button>
                  </div>
                </div>
                <p className="text-[12px] text-slate-500 mb-3 font-medium">בחר צורה:</p>
                <div className="grid grid-cols-4 gap-2">
                  {SHAPES.map((shape, idx) => (
                    <motion.button key={shape.key} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.03 }}
                      onClick={() => handleShapeSelect(shape.key)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${design.shape === shape.key ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
                      <span className="text-xl">{shape.icon}</span>
                      <span className="text-[11px] text-slate-600 font-medium">{shape.label}</span>
                    </motion.button>
                  ))}
                </div>
                <p className="text-[12px] text-slate-500 mt-4 mb-2 font-medium">סגנון קו:</p>
                <div className="flex gap-2">
                  {[{ key: 'solid', label: 'מלא' }, { key: 'dashed', label: 'מקווקו' }, { key: 'dotted', label: 'נקודות' }, { key: 'tapered', label: 'טפלי' }].map(style => (
                    <button key={style.key} onClick={() => design.updatePref('lineStyle', style.key)}
                      className={`flex-1 py-2 text-[12px] rounded-xl border-2 transition-all font-semibold ${design.lineStyle === style.key ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{style.label}</button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Color Palette */}
            {activeTab === 'color' && (
              <motion.div key="color" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <p className="text-[12px] text-slate-500 mb-3 font-medium">
                  {design.activeTaskId ? 'בחר צבע לצומת:' : 'צבעי ענפים (P1-P5):'}
                </p>
                {!design.activeTaskId && (
                  <div className="space-y-2.5 mb-4">
                    {['P1', 'P2', 'P3', 'P4', 'P5'].map(branch => (
                      <div key={branch} className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-slate-700 w-8">{branch}</span>
                        <div className="flex gap-1.5 flex-wrap flex-1">
                          {COLORS.map(c => (
                            <motion.button key={c.key} onClick={() => design.setBranchColor(branch, c.key)} whileHover={{ scale: 1.2 }}
                              className={`w-6 h-6 rounded-full border-2 transition-all ${design.branchColors?.[branch] === c.key ? 'border-slate-800 scale-110 ring-2 ring-slate-300' : 'border-transparent'}`}
                              style={{ backgroundColor: c.key }} title={c.label} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {design.activeTaskId && (
                  <div className="grid grid-cols-6 gap-2">
                    {COLORS.map(c => (
                      <motion.button key={c.key} onClick={() => handleColorSelect(c.key)} whileHover={{ scale: 1.15 }}
                        className="w-10 h-10 rounded-xl border-2 border-transparent transition-all hover:shadow-md" style={{ backgroundColor: c.key }} title={c.label} />
                    ))}
                  </div>
                )}
                <p className="text-[12px] text-slate-500 mt-4 mb-2 font-medium">ערכת נושא:</p>
                <div className="flex gap-2">
                  {[{ key: 'light', label: 'בהיר', icon: '☀️' }, { key: 'soft-gray', label: 'אפור רך', icon: '🌤️' }, { key: 'dark', label: 'כהה', icon: '🌙' }].map(theme => (
                    <button key={theme.key} onClick={() => design.updatePref('theme', theme.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 transition-all ${design.theme === theme.key ? 'border-indigo-500 bg-indigo-50 font-bold' : 'border-slate-200 hover:border-slate-300'}`}>
                      <span>{theme.icon}</span>
                      <span className="text-[12px] font-semibold">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Sticker Library */}
            {activeTab === 'sticker' && (
              <motion.div key="sticker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <p className="text-[12px] text-slate-500 mb-3 font-medium">
                  {design.activeTaskId ? 'הוסף סטיקר לצומת:' : 'בחר צומת כדי להוסיף סטיקר'}
                </p>
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                  {STICKER_TABS.map((cat, idx) => (
                    <button key={idx} onClick={() => setActiveStickerTab(idx)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${activeStickerTab === idx ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-100'}`}>{cat.label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {STICKER_TABS[activeStickerTab]?.stickers.map((sticker, i) => (
                    <motion.button key={i} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                      onClick={() => handleStickerSelect(sticker)} disabled={!design.activeTaskId}
                      whileHover={design.activeTaskId ? { scale: 1.3, rotate: 10 } : {}} whileTap={design.activeTaskId ? { scale: 0.9 } : {}}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl text-xl transition-all ${design.activeTaskId ? 'hover:bg-indigo-50 cursor-pointer' : 'opacity-40 cursor-not-allowed'} ${design.stickerMap?.[design.activeTaskId] === sticker ? 'bg-indigo-100 ring-2 ring-indigo-400' : ''}`}>
                      {sticker}
                    </motion.button>
                  ))}
                </div>
                {design.activeTaskId && design.stickerMap?.[design.activeTaskId] && (
                  <button onClick={() => handleStickerSelect('')} className="mt-3 text-[12px] text-amber-600 hover:text-amber-700 font-medium">הסר סטיקר</button>
                )}
              </motion.div>
            )}

            {/* Templates */}
            {activeTab === 'template' && (
              <motion.div key="template" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <p className="text-[12px] text-slate-500 mb-2 font-bold">תבניות מהירות:</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {Object.entries(DESIGN_PRESETS).map(([key, preset]) => (
                    <motion.button key={key} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        Object.entries(preset).forEach(([k, v]) => {
                          if (['label', 'emoji', 'description'].includes(k)) return;
                          if (k === 'branchColors') { Object.entries(v).forEach(([branch, color]) => design.setBranchColor(branch, color)); }
                          else { design.updatePref(k, v); }
                        });
                      }}
                      className="text-right p-2.5 rounded-xl border-2 border-slate-200 hover:border-indigo-300 transition-all hover:shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span>{preset.emoji}</span>
                        <span className="text-[12px] font-bold text-slate-800">{preset.label}</span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {Object.values(preset.branchColors).map((c, i) => (
                          <div key={i} className="w-3.5 h-3.5 rounded-full" style={{ background: c }} />
                        ))}
                      </div>
                    </motion.button>
                  ))}
                </div>
                <p className="text-[12px] text-slate-500 mb-2 font-bold">תבניות מפה:</p>
                <div className="space-y-1.5">
                  {Object.entries(MAP_TEMPLATES).map(([key, tpl]) => (
                    <motion.button key={key} whileHover={{ x: 4 }} onClick={() => handleTemplateApply(key)}
                      className={`w-full text-right px-3 py-2.5 rounded-xl border-2 transition-all ${design.mapTemplate === key ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{tpl.emoji || '🗺️'}</span>
                        <div>
                          <span className="text-[13px] font-bold text-slate-800">{tpl.label}</span>
                          <p className="text-[11px] text-slate-500">{tpl.description}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Backgrounds */}
            {activeTab === 'background' && (
              <motion.div key="background" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <p className="text-[12px] text-slate-500 mb-3 font-medium">רקע קנבס:</p>
                <div className="grid grid-cols-3 gap-2">
                  {BACKGROUNDS.map(bg => (
                    <motion.button key={bg.key} whileHover={{ scale: 1.05 }} onClick={() => design.updatePref('canvasBackground', bg.key)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${design.canvasBackground === bg.key ? 'border-indigo-500 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="w-full h-10 rounded-lg border border-slate-200" style={{ background: bg.preview }} />
                      <span className="text-[11px] font-semibold text-slate-600">{bg.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Animations */}
            {activeTab === 'animation' && (
              <motion.div key="animation" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <p className="text-[12px] text-slate-500 mb-3 font-medium">אנימציות כניסה:</p>
                <div className="space-y-1.5">
                  {ANIMATIONS.map(anim => (
                    <motion.button key={anim.key} whileHover={{ x: 4 }} onClick={() => design.updatePref('animation', anim.key)}
                      className={`w-full text-right px-3 py-2.5 rounded-xl border-2 transition-all ${(design.animation || 'fade') === anim.key ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <span className="text-[13px] font-bold text-slate-800">{anim.label}</span>
                      <p className="text-[11px] text-slate-500">{anim.description}</p>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-slate-50 flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-[12px] text-slate-600 cursor-pointer font-medium">
            <input type="checkbox" checked={design.glassmorphism} onChange={(e) => design.updatePref('glassmorphism', e.target.checked)} className="w-3.5 h-3.5 rounded accent-indigo-600" />
            זכוכית
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-600 cursor-pointer font-medium">
            <input type="checkbox" checked={design.softShadows} onChange={(e) => design.updatePref('softShadows', e.target.checked)} className="w-3.5 h-3.5 rounded accent-indigo-600" />
            צללים רכים
          </label>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
