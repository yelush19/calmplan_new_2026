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
  { key: 'cloud', label: '\u05e2\u05e0\u05df', icon: '\u2601\ufe0f' },
  { key: 'bubble', label: '\u05d1\u05d5\u05e2\u05d4', icon: '\u26aa' },
  { key: 'star', label: '\u05db\u05d5\u05db\u05d1', icon: '\u2b50' },
  { key: 'hexagon', label: '\u05de\u05e9\u05d5\u05e9\u05d4', icon: '\u2b21' },
  { key: 'speech', label: '\u05d3\u05d9\u05d1\u05d5\u05e8', icon: '\u{1F5E8}\ufe0f' },
  { key: 'diamond', label: '\u05d9\u05d4\u05dc\u05d5\u05dd', icon: '\u25c6' },
  { key: 'capsule', label: '\u05db\u05de\u05d5\u05e1\u05d4', icon: '\u{1F48A}' },
  { key: 'roundedRect', label: '\u05de\u05dc\u05d1\u05df', icon: '\u25ac' },
  { key: 'heart', label: '\u05dc\u05d1', icon: '\u{1F49A}' },
  { key: 'banner', label: '\u05d1\u05d0\u05e0\u05e8', icon: '\u{1F3F3}\ufe0f' },
  { key: 'crown', label: '\u05db\u05ea\u05e8', icon: '\u{1F451}' },
  { key: 'pill', label: '\u05d2\u05dc\u05d5\u05dc\u05d4', icon: '\u{1F48A}' },
];

// -- Color Palette (NO pink, NO red, NO fuchsia) --
const COLORS = [
  { key: '#00A3E0', label: '\u05ea\u05db\u05dc\u05ea' },
  { key: '#4682B4', label: '\u05db\u05d7\u05d5\u05dc \u05e4\u05dc\u05d3\u05d4' },
  { key: '#1565C0', label: '\u05db\u05d7\u05d5\u05dc \u05e2\u05de\u05d5\u05e7' },
  { key: '#0891B2', label: '\u05e6\u05d9\u05d0\u05df' },
  { key: '#6366F1', label: '\u05d0\u05d9\u05e0\u05d3\u05d9\u05d2\u05d5' },
  { key: '#F59E0B', label: '\u05e2\u05e0\u05d1\u05e8' },
  { key: '#FF9800', label: '\u05db\u05ea\u05d5\u05dd' },
  { key: '#2E7D32', label: '\u05d9\u05e8\u05d5\u05e7' },
  { key: '#059669', label: '\u05d0\u05de\u05e8\u05dc\u05d3' },
  { key: '#7C3AED', label: '\u05e1\u05d2\u05d5\u05dc' },
  { key: '#0D9488', label: '\u05d8\u05d9\u05dc' },
  { key: '#D97706', label: '\u05d3\u05d1\u05e9' },
];

// -- Sticker Library (organized by category) --
const STICKER_TABS = [
  {
    label: '\u05e1\u05d8\u05d8\u05d5\u05e1',
    stickers: ['\u2705', '\u23f3', '\u{1F6A7}', '\u26a0\ufe0f', '\u{1F4CB}', '\u{1F512}', '\u{1F50D}', '\u{1F4E4}',
               '\u{1F504}', '\u{1F4E5}', '\u{1F6AB}', '\u2b55'],
  },
  {
    label: '\u05e2\u05d3\u05d9\u05e4\u05d5\u05ea',
    stickers: ['\u{1F525}', '\u26a1', '\u2b50', '\u{1F3AF}', '\u{1F680}', '\u{1F4A1}', '\u{1F4AA}', '\u{1F3C6}',
               '\u{1F31F}', '\u{1F4A5}', '\u2728', '\u{1F4AB}'],
  },
  {
    label: '\u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d5\u05ea',
    stickers: ['\u{1F4BC}', '\u{1F4B0}', '\u{1F4CA}', '\u{1F4C5}', '\u{1F465}', '\u{1F3E2}', '\u{1F4DD}', '\u2699\ufe0f',
               '\u{1F4C1}', '\u{1F4CE}', '\u{1F5C2}\ufe0f', '\u{1F4C8}'],
  },
  {
    label: '\u05e1\u05de\u05dc\u05d9\u05dd',
    stickers: ['\u{1F7E2}', '\u{1F7E1}', '\u{1F7E0}', '\u{1F535}', '\u{1F7E3}', '\u2b1c', '\u2b1b', '\u{1F536}',
               '\u{1F537}', '\u{1F538}', '\u{1F539}', '\u{1F53A}'],
  },
  {
    label: '\u05d0\u05d5\u05d1\u05d9\u05d9\u05e7\u05d8\u05d9\u05dd',
    stickers: ['\u{1F4E6}', '\u{1F4B3}', '\u{1F4B5}', '\u{1F4B8}', '\u{1F3E0}', '\u{1F697}', '\u2708\ufe0f', '\u{1F4F1}',
               '\u{1F4BB}', '\u{1F5A8}\ufe0f', '\u260e\ufe0f', '\u{1F4F7}'],
  },
];

// -- Background options --
const BACKGROUNDS = [
  { key: 'clean', label: '\u05e0\u05e7\u05d9', preview: '#FFFFFF' },
  { key: 'grid', label: '\u05e8\u05e9\u05ea', preview: 'repeating-linear-gradient(0deg, #f0f0f0 0px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #f0f0f0 0px, transparent 1px, transparent 20px)' },
  { key: 'dots', label: '\u05e0\u05e7\u05d5\u05d3\u05d5\u05ea', preview: 'radial-gradient(circle, #ddd 1px, transparent 1px)' },
  { key: 'soft-gradient', label: '\u05d2\u05e8\u05d3\u05d9\u05d0\u05e0\u05d8', preview: 'linear-gradient(135deg, #f5f7fa, #e8ecf0)' },
  { key: 'warm', label: '\u05d7\u05de\u05d9\u05dd', preview: 'linear-gradient(135deg, #fef9ef, #fdf2e9)' },
  { key: 'cool', label: '\u05e7\u05e8\u05d9\u05e8', preview: 'linear-gradient(135deg, #eef2ff, #e0e7ff)' },
];

// -- Animation presets --
const ANIMATIONS = [
  { key: 'none', label: '\u05dc\u05dc\u05d0', description: '\u05d1\u05dc\u05d9 \u05d0\u05e0\u05d9\u05de\u05e6\u05d9\u05d4' },
  { key: 'fade', label: '\u05d3\u05e2\u05d9\u05db\u05d4', description: '\u05db\u05e0\u05d9\u05e1\u05d4 \u05e2\u05dd \u05d3\u05e2\u05d9\u05db\u05d4 \u05e2\u05d3\u05d9\u05e0\u05d4' },
  { key: 'scale', label: '\u05d4\u05ea\u05de\u05d5\u05d3\u05d3\u05d5\u05ea', description: '\u05d4\u05ea\u05de\u05d5\u05d3\u05d3\u05d5\u05ea \u05de\u05d4\u05de\u05e8\u05db\u05d6 \u05d4\u05d7\u05d5\u05e6\u05d4' },
  { key: 'slide', label: '\u05d4\u05d7\u05dc\u05e7\u05d4', description: '\u05d4\u05d7\u05dc\u05e7\u05d4 \u05de\u05d4\u05e6\u05d3' },
  { key: 'bounce', label: '\u05e7\u05e4\u05d9\u05e6\u05d4', description: '\u05db\u05e0\u05d9\u05e1\u05d4 \u05e2\u05dd \u05e7\u05e4\u05d9\u05e6\u05d4' },
  { key: 'stagger', label: '\u05de\u05d3\u05d5\u05e8\u05d2', description: '\u05e6\u05de\u05ea\u05d9\u05dd \u05e0\u05db\u05e0\u05e1\u05d9\u05dd \u05d1\u05e8\u05e6\u05e3' },
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
    { key: 'shape', icon: Shapes, label: '\u05e6\u05d5\u05e8\u05d4' },
    { key: 'color', icon: Palette, label: '\u05e6\u05d1\u05e2' },
    { key: 'sticker', icon: Sticker, label: '\u05e1\u05d8\u05d9\u05e7\u05e8' },
    { key: 'template', icon: Layout, label: '\u05ea\u05d1\u05e0\u05d9\u05ea' },
    { key: 'background', icon: Image, label: '\u05e8\u05e7\u05e2' },
    { key: 'animation', icon: Wand2, label: '\u05d0\u05e0\u05d9\u05de\u05e6\u05d9\u05d4' },
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
            <span className="font-bold text-[14px] text-slate-800">\u05de\u05e0\u05d5\u05e2 \u05e2\u05d9\u05e6\u05d5\u05d1</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => design.resetToDefaults()} className="p-1.5 rounded-full hover:bg-white/80 text-slate-400 hover:text-slate-600 transition-all" title="\u05d0\u05d9\u05e4\u05d5\u05e1">
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
            <span className="text-[12px] text-indigo-700 font-bold">\u05e2\u05d9\u05e6\u05d5\u05d1: {design.activeTaskId}</span>
            <button onClick={() => design.clearSelection()} className="text-[12px] text-indigo-500 hover:text-indigo-700 font-medium">\u05e0\u05e7\u05d4 \u05d1\u05d7\u05d9\u05e8\u05d4</button>
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
                  <p className="text-[12px] text-slate-500 font-medium">\u05de\u05e6\u05d1 \u05de\u05d9\u05dc\u05d5\u05d9:</p>
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => design.updatePref('fillMode', 'filled')}
                      className={`px-3 py-1.5 text-[12px] rounded-md transition-all ${(design.fillMode || 'filled') === 'filled' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'text-slate-500'}`}>\u05de\u05dc\u05d0</button>
                    <button onClick={() => design.updatePref('fillMode', 'border')}
                      className={`px-3 py-1.5 text-[12px] rounded-md transition-all ${design.fillMode === 'border' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'text-slate-500'}`}>\u05e7\u05d5 \u05d1\u05dc\u05d1\u05d3</button>
                  </div>
                </div>
                <p className="text-[12px] text-slate-500 mb-3 font-medium">\u05d1\u05d7\u05e8 \u05e6\u05d5\u05e8\u05d4:</p>
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
                <p className="text-[12px] text-slate-500 mt-4 mb-2 font-medium">\u05e1\u05d2\u05e0\u05d5\u05df \u05e7\u05d5:</p>
                <div className="flex gap-2">
                  {[{ key: 'solid', label: '\u05de\u05dc\u05d0' }, { key: 'dashed', label: '\u05de\u05e7\u05d5\u05d5\u05e7\u05d5' }, { key: 'dotted', label: '\u05e0\u05e7\u05d5\u05d3\u05d5\u05ea' }, { key: 'tapered', label: '\u05d8\u05e4\u05dc\u05d9' }].map(style => (
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
                  {design.activeTaskId ? '\u05d1\u05d7\u05e8 \u05e6\u05d1\u05e2 \u05dc\u05e6\u05d5\u05de\u05ea:' : '\u05e6\u05d1\u05e2\u05d9 \u05e2\u05e0\u05e4\u05d9\u05dd (P1-P5):'}
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
                <p className="text-[12px] text-slate-500 mt-4 mb-2 font-medium">\u05e2\u05e8\u05db\u05ea \u05e0\u05d5\u05e9\u05d0:</p>
                <div className="flex gap-2">
                  {[{ key: 'light', label: '\u05d1\u05d4\u05d9\u05e8', icon: '\u2600\ufe0f' }, { key: 'soft-gray', label: '\u05d0\u05e4\u05d5\u05e8 \u05e8\u05da', icon: '\u{1F324}\ufe0f' }, { key: 'dark', label: '\u05db\u05d4\u05d4', icon: '\u{1F319}' }].map(theme => (
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
                  {design.activeTaskId ? '\u05d4\u05d5\u05e1\u05e3 \u05e1\u05d8\u05d9\u05e7\u05e8 \u05dc\u05e6\u05d5\u05de\u05ea:' : '\u05d1\u05d7\u05e8 \u05e6\u05d5\u05de\u05ea \u05db\u05d3\u05d9 \u05dc\u05d4\u05d5\u05e1\u05d9\u05e3 \u05e1\u05d8\u05d9\u05e7\u05e8'}
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
                  <button onClick={() => handleStickerSelect('')} className="mt-3 text-[12px] text-amber-600 hover:text-amber-700 font-medium">\u05d4\u05e1\u05e8 \u05e1\u05d8\u05d9\u05e7\u05e8</button>
                )}
              </motion.div>
            )}

            {/* Templates */}
            {activeTab === 'template' && (
              <motion.div key="template" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <p className="text-[12px] text-slate-500 mb-2 font-bold">\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea \u05de\u05d4\u05d9\u05e8\u05d5\u05ea:</p>
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
                <p className="text-[12px] text-slate-500 mb-2 font-bold">\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea \u05de\u05e4\u05d4:</p>
                <div className="space-y-1.5">
                  {Object.entries(MAP_TEMPLATES).map(([key, tpl]) => (
                    <motion.button key={key} whileHover={{ x: 4 }} onClick={() => handleTemplateApply(key)}
                      className={`w-full text-right px-3 py-2.5 rounded-xl border-2 transition-all ${design.mapTemplate === key ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{tpl.emoji || '\u{1F5FA}\ufe0f'}</span>
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
                <p className="text-[12px] text-slate-500 mb-3 font-medium">\u05e8\u05e7\u05e2 \u05e7\u05e0\u05d1\u05e1:</p>
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
                <p className="text-[12px] text-slate-500 mb-3 font-medium">\u05d0\u05e0\u05d9\u05de\u05e6\u05d9\u05d5\u05ea \u05db\u05e0\u05d9\u05e1\u05d4:</p>
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
            \u05d6\u05db\u05d5\u05db\u05d9\u05ea
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-600 cursor-pointer font-medium">
            <input type="checkbox" checked={design.softShadows} onChange={(e) => design.updatePref('softShadows', e.target.checked)} className="w-3.5 h-3.5 rounded accent-indigo-600" />
            \u05e6\u05dc\u05dc\u05d9\u05dd \u05e8\u05db\u05d9\u05dd
          </label>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
