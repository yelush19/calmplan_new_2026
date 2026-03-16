/**
 * ── FloatingToolbar: The Design Paintbox (Directive #6) ──
 * z-index: 9999 — always on top.
 * Appears on ANY node click globally.
 *
 * Contains:
 *   - 20 Vibrant Colors (neon pinks, sky blues, lime, magenta...)
 *   - 6 Shapes (Cloud, Organic Bubble, Speech, Rounded Diamond, Pill, Star)
 *   - Typography (Font selectors, size, bold/italic toggles)
 *   - "Apply to Children" button — recursively apply style to sub-nodes
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Cloud, Circle, Diamond, Plus, Palette, Shapes, MessageCircle,
  Star, Type, Bold, Italic, Copy, Heart, Crown, Flag,
  AlignLeft, AlignCenter, AlignRight, Underline,
} from 'lucide-react';

// ── 20 Solid Professional Colors — NO pink, NO red, NO fuchsia ──
const TOOLBAR_COLORS = [
  { color: '#00A3E0', label: '\u05e9\u05de\u05d9\u05d9\u05dd' },
  { color: '#1565C0', label: '\u05db\u05d7\u05d5\u05dc \u05e2\u05de\u05d5\u05e7' },
  { color: '#0891B2', label: '\u05e6\u05d9\u05d0\u05df' },
  { color: '#0EA5E9', label: '\u05ea\u05db\u05dc\u05ea' },
  { color: '#00BCD4', label: '\u05d8\u05d5\u05e8\u05e7\u05d9\u05d6' },
  { color: '#2E7D32', label: '\u05d9\u05e2\u05e8 \u05e2\u05de\u05d5\u05e7' },
  { color: '#059669', label: '\u05d0\u05de\u05e8\u05dc\u05d3' },
  { color: '#16A34A', label: '\u05d9\u05e8\u05d5\u05e7' },
  { color: '#8BC34A', label: '\u05dc\u05d9\u05d9\u05dd' },
  { color: '#0D9488', label: '\u05d8\u05d9\u05dc' },
  { color: '#FF9800', label: '\u05db\u05ea\u05d5\u05dd' },
  { color: '#F59E0B', label: '\u05e2\u05e0\u05d1\u05e8' },
  { color: '#D97706', label: '\u05d3\u05d1\u05e9' },
  { color: '#FFC107', label: '\u05d6\u05d4\u05d1' },
  { color: '#B2AC88', label: '\u05de\u05e8\u05d5\u05d5\u05d4' },
  { color: '#4682B4', label: '\u05e4\u05dc\u05d3\u05d4' },
  { color: '#7C3AED', label: '\u05e1\u05d2\u05d5\u05dc' },
  { color: '#6366F1', label: '\u05d0\u05d9\u05e0\u05d3\u05d9\u05d2\u05d5' },
  { color: '#8B5CF6', label: '\u05dc\u05d1\u05e0\u05d3\u05e8' },
  { color: '#1DE9B6', label: '\u05de\u05e0\u05d8\u05d4' },
];

// ── 6 Organic Shapes ──
const PillIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 20 20" {...props}>
    <rect x="2" y="6" width="16" height="8" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const TOOLBAR_SHAPES = [
  { key: 'cloud',   label: 'ענן',   icon: Cloud },
  { key: 'bubble',  label: 'בועה',  icon: Circle },
  { key: 'speech',  label: 'דיבור', icon: MessageCircle },
  { key: 'diamond', label: 'מעוין', icon: Diamond },
  { key: 'pill',    label: 'כמוסה', icon: PillIcon },
  { key: 'star',    label: 'כוכב',  icon: Star },
  { key: 'heart',   label: 'לב',    icon: Heart },
  { key: 'crown',   label: 'כתר',   icon: Crown },
  { key: 'banner',  label: 'באנר',  icon: Flag },
];

// ── Typography ──
const FONT_OPTIONS = [
  { key: 'Open Sans', label: 'Open Sans' },
  { key: 'Assistant', label: 'Assistant' },
  { key: 'Rubik', label: 'Rubik' },
  { key: 'Heebo', label: 'Heebo' },
];

const FONT_SIZES = [10, 12, 14, 16, 18, 22];

export default function FloatingToolbar({
  visible,
  x = 0,
  y = 0,
  nodeColor,
  nodeShape,
  nodeFont,
  nodeFontSize,
  nodeBold,
  nodeItalic,
  onColorChange,
  onShapeChange,
  onFontChange,
  onFontSizeChange,
  onBoldChange,
  onItalicChange,
  onApplyToChildren,
  onAddBranch,
  onClose,
}) {
  const [activeSection, setActiveSection] = useState('color');

  const sections = [
    { key: 'color', label: '\u05e6\u05d1\u05e2', icon: Palette },
    { key: 'shape', label: '\u05e6\u05d5\u05e8\u05d4', icon: Shapes },
    { key: 'type',  label: '\u05d8\u05e7\u05e1\u05d8', icon: Type },
    { key: 'sticker', label: '\u05e1\u05d8\u05d9\u05e7\u05e8', icon: Star },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.88 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="fixed bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{
            zIndex: 9999,
            left: Math.min(Math.max(x - 130, 10), (typeof window !== 'undefined' ? window.innerWidth : 800) - 280),
            top: Math.max(y - 200, 10),
            minWidth: '260px',
            maxWidth: '300px',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-50"
            style={{ background: `linear-gradient(135deg, ${nodeColor || '#4682B4'}08, transparent)` }}>
            <span className="text-xs font-bold text-slate-800">סגנון ענף</span>
            <div className="flex items-center gap-1">
              {onAddBranch && (
                <button onClick={onAddBranch}
                  className="p-1.5 rounded-lg transition-all hover:bg-gray-100" title="הוסף ענף">
                  <Plus className="w-3.5 h-3.5 text-[#7C3AED]" />
                </button>
              )}
              <button onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Section pills */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-50">
            {sections.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                    activeSection === s.key
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Color Picker — 20 colors, 5 per row */}
          {activeSection === 'color' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 py-2.5">
              <div className="grid grid-cols-5 gap-1.5">
                {TOOLBAR_COLORS.map(c => (
                  <button
                    key={c.color}
                    onClick={() => onColorChange?.(c.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                      nodeColor === c.color ? 'border-slate-800 scale-110 shadow-md' : 'border-white shadow-sm'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.label}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Shape Picker — 9 shapes */}
          {activeSection === 'shape' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 py-2.5">
              <div className="grid grid-cols-3 gap-1.5">
                {TOOLBAR_SHAPES.map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.key}
                      onClick={() => onShapeChange?.(s.key)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${
                        nodeShape === s.key
                          ? 'ring-2 ring-offset-1 bg-slate-50'
                          : 'hover:bg-gray-50'
                      }`}
                      style={nodeShape === s.key ? { '--tw-ring-color': nodeColor || '#4682B4' } : {}}
                      title={s.label}
                    >
                      <Icon className="w-5 h-5" style={{ color: nodeColor || '#4682B4' }} />
                      <span className="text-[9px] font-bold text-slate-700">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Typography Controls */}
          {activeSection === 'type' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 py-2.5 space-y-2.5">
              {/* Font Family */}
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">גופן</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {FONT_OPTIONS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => onFontChange?.(f.key)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                        nodeFont === f.key
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                      style={{ fontFamily: f.key }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Font Size */}
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">גודל</span>
                <div className="flex gap-1 mt-1">
                  {FONT_SIZES.map(size => (
                    <button
                      key={size}
                      onClick={() => onFontSizeChange?.(size)}
                      className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                        nodeFontSize === size
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              {/* Bold / Italic / Underline */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onBoldChange?.(!nodeBold)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    nodeBold ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Bold className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onItalicChange?.(!nodeItalic)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    nodeItalic ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Italic className="w-3 h-3" />
                </button>
                <button
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <Underline className="w-3 h-3" />
                </button>
                <div className="w-px h-5 bg-slate-200 mx-0.5" />
                <button className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all">
                  <AlignRight className="w-3 h-3" />
                </button>
                <button className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all">
                  <AlignCenter className="w-3 h-3" />
                </button>
                <button className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all">
                  <AlignLeft className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Sticker Picker */}
          {activeSection === 'sticker' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 py-2.5">
              <div className="grid grid-cols-8 gap-1">
                {['\u2705', '\u23f3', '\u{1F6A7}', '\u26a0\ufe0f', '\u{1F525}', '\u26a1', '\u2b50', '\u{1F3AF}',
                  '\u{1F680}', '\u{1F4A1}', '\u{1F4AA}', '\u{1F3C6}', '\u{1F4BC}', '\u{1F4B0}', '\u{1F4CA}', '\u{1F4C5}',
                  '\u{1F7E2}', '\u{1F7E1}', '\u{1F7E0}', '\u{1F535}', '\u{1F7E3}', '\u{1F4CB}', '\u{1F512}', '\u{1F50D}',
                ].map((sticker, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.3, rotate: 10 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-base transition-all"
                  >
                    {sticker}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Apply to Children (Directive #6) */}
          {onApplyToChildren && (
            <div className="px-3 pb-2.5 pt-1 border-t border-gray-50 mt-1">
              <button
                onClick={onApplyToChildren}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              >
                <Copy className="w-3.5 h-3.5" />
                \u05d4\u05d7\u05dc \u05e2\u05dc \u05db\u05dc \u05d4\u05d9\u05dc\u05d3\u05d9\u05dd
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
