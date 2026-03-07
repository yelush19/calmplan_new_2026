/**
 * ── FloatingToolbar: AYOA Design Brush for Lena ──
 * Appears when a node is clicked in Map/Radial views.
 * Color picker (DNA 4 colors) + Shape picker (Cloud/Bubble/Diamond) + Add Branch (+).
 * High z-index with smooth entrance animation.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cloud, Circle, Diamond, Plus, Palette, Shapes } from 'lucide-react';

// DNA Colors — the 4 core + accents
const TOOLBAR_COLORS = [
  { color: '#00A3E0', label: 'P1 כחול שמיים' },
  { color: '#B2AC88', label: 'P2 מרווה' },
  { color: '#E91E63', label: 'P3 מג\'נטה' },
  { color: '#FFC107', label: 'P4 שקיעה' },
  { color: '#800000', label: 'בורדו' },
  { color: '#4682B4', label: 'פלדה' },
  { color: '#9C27B0', label: 'סגול' },
  { color: '#ADD8E6', label: 'תכלת' },
];

// Organic shapes only
const TOOLBAR_SHAPES = [
  { key: 'cloud', label: 'ענן', icon: Cloud },
  { key: 'bubble', label: 'בועה', icon: Circle },
  { key: 'diamond', label: 'מעוין', icon: Diamond },
];

export default function FloatingToolbar({
  visible,
  x = 0,
  y = 0,
  nodeColor,
  nodeShape,
  onColorChange,
  onShapeChange,
  onAddBranch,
  onClose,
}) {
  const [activeSection, setActiveSection] = useState('color'); // 'color' | 'shape'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.88 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="fixed z-[100] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{
            left: Math.min(Math.max(x - 110, 10), (typeof window !== 'undefined' ? window.innerWidth : 800) - 240),
            top: Math.max(y - 150, 10),
            minWidth: '220px',
          }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50"
            style={{ background: `linear-gradient(135deg, ${nodeColor || '#4682B4'}08, transparent)` }}>
            <span className="text-[10px] font-bold text-gray-500">סגנון ענף</span>
            <div className="flex items-center gap-1">
              {/* Add Branch button */}
              {onAddBranch && (
                <button
                  onClick={onAddBranch}
                  className="p-1.5 rounded-lg transition-all hover:bg-gray-100"
                  title="הוסף ענף"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E91E63]" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Section toggle pills */}
          <div className="flex items-center gap-1 px-3 py-2">
            <button
              onClick={() => setActiveSection('color')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                activeSection === 'color'
                  ? 'bg-gray-100 text-gray-800'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Palette className="w-3 h-3" />
              צבע
            </button>
            <button
              onClick={() => setActiveSection('shape')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                activeSection === 'shape'
                  ? 'bg-gray-100 text-gray-800'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Shapes className="w-3 h-3" />
              צורה
            </button>
          </div>

          {/* Color Picker */}
          {activeSection === 'color' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 pb-3"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                {TOOLBAR_COLORS.map(c => (
                  <button
                    key={c.color}
                    onClick={() => onColorChange?.(c.color)}
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                      nodeColor === c.color ? 'border-gray-800 scale-110 shadow-md' : 'border-white shadow-sm'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.label}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Shape Picker */}
          {activeSection === 'shape' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 pb-3"
            >
              <div className="flex items-center gap-1.5">
                {TOOLBAR_SHAPES.map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.key}
                      onClick={() => onShapeChange?.(s.key)}
                      className={`flex flex-col items-center gap-0.5 p-2.5 rounded-xl transition-all ${
                        nodeShape === s.key
                          ? 'ring-2 ring-offset-1'
                          : 'hover:bg-gray-50'
                      }`}
                      style={nodeShape === s.key ? {
                        backgroundColor: (nodeColor || '#4682B4') + '10',
                        ringColor: nodeColor || '#4682B4',
                      } : {}}
                      title={s.label}
                    >
                      <Icon className="w-5 h-5" style={{ color: nodeColor || '#4682B4' }} />
                      <span className="text-[8px] text-gray-500">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
