/**
 * ── Design Panel: Global Design Engine UI ──
 *
 * Shape Selection, Color Palette, and Sticker/Icon Library.
 * All changes sync instantly across ALL views via DesignContext.
 * Replaces old 'Shapes' banner — no UI clutter.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Shapes, Sticker, X, RotateCcw, Paintbrush, ChevronDown, ChevronUp } from 'lucide-react';
import { useDesign, MAP_TEMPLATES } from '@/contexts/DesignContext';

// ── Shape Options ──
const SHAPES = [
  { key: 'cloud', label: 'ענן', icon: '☁️', css: 'rounded-[40%]' },
  { key: 'circle', label: 'עיגול', icon: '⭕', css: 'rounded-full' },
  { key: 'star', label: 'כוכב', icon: '⭐', css: 'rounded-lg' },
  { key: 'hexagon', label: 'משושה', icon: '⬡', css: 'rounded-xl' },
  { key: 'bubble', label: 'בועה', icon: '💬', css: 'rounded-2xl' },
  { key: 'diamond', label: 'יהלום', icon: '◆', css: 'rotate-45 rounded-lg' },
  { key: 'capsule', label: 'כמוסה', icon: '💊', css: 'rounded-full' },
  { key: 'roundedRect', label: 'מלבן', icon: '▬', css: 'rounded-lg' },
];

// ── Color Palette ──
const COLORS = [
  { key: '#00A3E0', label: 'תכלת' },
  { key: '#4682B4', label: 'כחול פלדה' },
  { key: '#1565C0', label: 'כחול עמוק' },
  { key: '#7B1FA2', label: 'סגול' },
  { key: '#E91E63', label: 'מגנטה' },
  { key: '#F57C00', label: 'כתום' },
  { key: '#FFC107', label: 'ענבר' },
  { key: '#2E7D32', label: 'ירוק' },
  { key: '#00897B', label: 'טורקיז' },
  { key: '#455A64', label: 'אפור כהה' },
  { key: '#6D4C41', label: 'חום' },
  { key: '#EF4444', label: 'אדום' },
];

// ── Sticker Library (Emojis + conceptual icons) ──
const STICKERS = [
  '⭐', '🔥', '💡', '🎯', '✅', '⚡', '🏠', '💼',
  '📊', '📋', '🔔', '⏰', '🎨', '🛒', '🧹', '🍎',
  '👥', '💰', '📁', '🔒', '🔓', '🚀', '❤️', '⚠️',
  '🎉', '📌', '🏷️', '🔍', '📦', '🌟', '🏆', '💎',
];

export default function DesignPanel({ isOpen, onClose }) {
  const design = useDesign();
  const [activeTab, setActiveTab] = useState('shape'); // shape | color | sticker | template
  const [branchColorOpen, setBranchColorOpen] = useState(false);

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
    } else {
      // No active task — ignore color pick for global
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

  return (
    <AnimatePresence>
      <motion.div
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 w-72 bg-white rounded-3xl shadow-2xl border-2 border-gray-200 overflow-hidden"
        dir="rtl"
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -300, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-blue-50 to-purple-50 border-b">
          <div className="flex items-center gap-2">
            <Paintbrush className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-sm text-gray-800">מנוע עיצוב</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => design.resetToDefaults()}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="איפוס לברירת מחדל"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Active Selection Indicator */}
        {design.activeTaskId && (
          <div className="px-4 py-2 bg-blue-50 border-b flex items-center justify-between">
            <span className="text-xs text-blue-700 font-medium">עיצוב: {design.activeTaskId}</span>
            <button
              onClick={() => design.clearSelection()}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              נקה בחירה
            </button>
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex border-b bg-gray-50">
          {[
            { key: 'shape', icon: <Shapes className="w-4 h-4" />, label: 'צורה' },
            { key: 'color', icon: <Palette className="w-4 h-4" />, label: 'צבע' },
            { key: 'sticker', icon: <Sticker className="w-4 h-4" />, label: 'סטיקר' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {/* Shape Selection */}
          {activeTab === 'shape' && (
            <div>
              <p className="text-xs text-gray-500 mb-3">בחר צורת ברירת מחדל לצמתים:</p>
              <div className="grid grid-cols-4 gap-2">
                {SHAPES.map(shape => (
                  <button
                    key={shape.key}
                    onClick={() => handleShapeSelect(shape.key)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all hover:scale-105 ${
                      design.shape === shape.key
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{shape.icon}</span>
                    <span className="text-[9px] text-gray-600">{shape.label}</span>
                  </button>
                ))}
              </div>

              {/* Line Style */}
              <p className="text-xs text-gray-500 mt-4 mb-2">סגנון קו:</p>
              <div className="flex gap-2">
                {['solid', 'dashed', 'dotted', 'tapered'].map(style => (
                  <button
                    key={style}
                    onClick={() => design.updatePref('lineStyle', style)}
                    className={`flex-1 py-1.5 text-[10px] rounded-lg border transition-all ${
                      design.lineStyle === style
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {style === 'solid' ? 'מלא' : style === 'dashed' ? 'מקווקו' : style === 'dotted' ? 'נקודות' : 'טפרי'}
                  </button>
                ))}
              </div>

              {/* Map Templates */}
              <p className="text-xs text-gray-500 mt-4 mb-2">תבניות מפה:</p>
              <div className="space-y-2">
                {Object.entries(MAP_TEMPLATES).map(([key, tpl]) => (
                  <button
                    key={key}
                    onClick={() => handleTemplateApply(key)}
                    className={`w-full text-right px-3 py-2 rounded-xl border transition-all ${
                      design.mapTemplate === key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xs font-bold text-gray-800">{tpl.label}</span>
                    <p className="text-[9px] text-gray-500 mt-0.5">{tpl.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color Palette */}
          {activeTab === 'color' && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                {design.activeTaskId ? 'בחר צבע לצומת הנבחר:' : 'צבעי ענפים (P1-P5):'}
              </p>

              {!design.activeTaskId && (
                <>
                  {/* Branch Colors */}
                  <div className="space-y-2 mb-4">
                    {['P1', 'P2', 'P3', 'P4', 'P5'].map(branch => (
                      <div key={branch} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-700 w-8">{branch}</span>
                        <div className="flex gap-1 flex-wrap flex-1">
                          {COLORS.map(c => (
                            <button
                              key={c.key}
                              onClick={() => design.setBranchColor(branch, c.key)}
                              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                                design.branchColors?.[branch] === c.key ? 'border-gray-800 scale-110' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: c.key }}
                              title={c.label}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {design.activeTaskId && (
                <div className="grid grid-cols-6 gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => handleColorSelect(c.key)}
                      className="w-10 h-10 rounded-xl border-2 transition-all hover:scale-110 hover:shadow-md"
                      style={{ backgroundColor: c.key, borderColor: 'transparent' }}
                      title={c.label}
                    />
                  ))}
                </div>
              )}

              {/* Theme */}
              <p className="text-xs text-gray-500 mt-4 mb-2">ערכת נושא:</p>
              <div className="flex gap-2">
                {[
                  { key: 'light', label: 'בהיר', icon: '☀️' },
                  { key: 'soft-gray', label: 'אפור רך', icon: '🌤️' },
                  { key: 'dark', label: 'כהה', icon: '🌙' },
                ].map(theme => (
                  <button
                    key={theme.key}
                    onClick={() => design.updatePref('theme', theme.key)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border transition-all ${
                      design.theme === theme.key
                        ? 'border-blue-500 bg-blue-50 font-bold'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span>{theme.icon}</span>
                    <span className="text-[10px]">{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sticker/Icon Library */}
          {activeTab === 'sticker' && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                {design.activeTaskId ? 'הוסף סטיקר לצומת הנבחר:' : 'בחר צומת כדי להוסיף סטיקר'}
              </p>
              <div className="grid grid-cols-8 gap-1.5">
                {STICKERS.map((sticker, i) => (
                  <button
                    key={i}
                    onClick={() => handleStickerSelect(sticker)}
                    disabled={!design.activeTaskId}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all ${
                      design.activeTaskId
                        ? 'hover:bg-blue-50 hover:scale-125 cursor-pointer'
                        : 'opacity-40 cursor-not-allowed'
                    } ${design.stickerMap?.[design.activeTaskId] === sticker ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
                  >
                    {sticker}
                  </button>
                ))}
              </div>
              {design.activeTaskId && design.stickerMap?.[design.activeTaskId] && (
                <button
                  onClick={() => handleStickerSelect('')}
                  className="mt-3 text-xs text-red-500 hover:text-red-700"
                >
                  הסר סטיקר
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer — Glassmorphism & Shadows toggles */}
        <div className="px-4 py-3 border-t bg-gray-50 flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={design.glassmorphism}
              onChange={(e) => design.updatePref('glassmorphism', e.target.checked)}
              className="w-3 h-3 rounded"
            />
            זכוכית
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={design.softShadows}
              onChange={(e) => design.updatePref('softShadows', e.target.checked)}
              className="w-3 h-3 rounded"
            />
            צללים רכים
          </label>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
