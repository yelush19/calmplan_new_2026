/**
 * ── FloatingToolbar: AYOA Design Brush for Lena ──
 * Appears when a node is clicked in Map/Radial views.
 * Color picker + Shape picker + size slider.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cloud, Circle, Diamond } from 'lucide-react';

const TOOLBAR_COLORS = [
  { color: '#E91E63', label: 'ורוד' },
  { color: '#FFC107', label: 'צהוב' },
  { color: '#00A3E0', label: 'כחול' },
  { color: '#B2AC88', label: 'מרווה' },
  { color: '#800000', label: 'בורדו' },
  { color: '#4682B4', label: 'פלדה' },
  { color: '#9C27B0', label: 'סגול' },
  { color: '#ADD8E6', label: 'תכלת' },
];

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
  onClose,
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          className="fixed z-[100] bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 min-w-[200px]"
          style={{
            left: Math.min(Math.max(x - 100, 10), (typeof window !== 'undefined' ? window.innerWidth : 800) - 220),
            top: Math.max(y - 130, 10),
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 left-2 p-1 rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="text-[10px] font-bold text-gray-400 mb-2">סגנון ענף</div>

          {/* Color Picker */}
          <div className="mb-2">
            <div className="text-[9px] text-gray-400 mb-1">צבע</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {TOOLBAR_COLORS.map(c => (
                <button
                  key={c.color}
                  onClick={() => onColorChange?.(c.color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                    nodeColor === c.color ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Shape Picker */}
          <div>
            <div className="text-[9px] text-gray-400 mb-1">צורה</div>
            <div className="flex items-center gap-1">
              {TOOLBAR_SHAPES.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => onShapeChange?.(s.key)}
                    className={`p-2 rounded-lg transition-all ${
                      nodeShape === s.key ? 'bg-[#4682B4]/10 ring-1 ring-[#4682B4]' : 'hover:bg-gray-50'
                    }`}
                    title={s.label}
                  >
                    <Icon className="w-4 h-4 text-gray-600" />
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
