/**
 * ── DesignFloatingTab: "Design Anywhere" Persistent Panel ──
 *
 * A draggable floating panel accessible across all P1-P5 pages.
 * Controls:
 *   - Typography (font family toggle)
 *   - Global Theme (Light / Soft Gray / Dark)
 *   - Shape selector (9 shapes — geometry changes on nodes)
 *   - Line Style selector (Solid / Dashed / Dotted / Tapered)
 *   - Glassmorphism toggle
 *   - Soft Shadows toggle
 *   - Map Style Templates (AYOA Organic / MindMap Classic / Minimalist)
 *
 * Persists via DesignContext → localStorage.
 * Draggable via framer-motion. Collapsible to a small FAB.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paintbrush, X, ChevronDown, ChevronUp, Type, Palette,
  Cloud, Circle, Diamond, Star, MessageCircle, Hexagon, RectangleHorizontal,
  Minus, MoreHorizontal, Sparkles, Eye, EyeOff, Sun, Moon, Monitor,
} from 'lucide-react';
import { useDesign, MAP_TEMPLATES } from '@/contexts/DesignContext';
import { LINE_STYLE_OPTIONS, SHAPE_OPTIONS } from '@/engines/lineStyleEngine';

// ── Tiny shape preview icons for the grid ──
const ShapeIcon = ({ shape, size = 24, color = 'currentColor' }) => {
  const s = size;
  const r = s * 0.38;
  const cx = s / 2;
  const cy = s / 2;

  const svgProps = { width: s, height: s, viewBox: `0 0 ${s} ${s}`, style: { display: 'block' } };

  switch (shape) {
    case 'cloud':
      return <Cloud width={s} height={s} style={{ color }} />;
    case 'bubble':
      return (
        <svg {...svgProps}>
          <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.82} fill="none" stroke={color} strokeWidth={1.5} />
        </svg>
      );
    case 'capsule':
      return (
        <svg {...svgProps}>
          <rect x={cx - r * 1.2} y={cy - r * 0.5} width={r * 2.4} height={r}
            rx={r * 0.5} fill="none" stroke={color} strokeWidth={1.5} />
        </svg>
      );
    case 'hexagon':
      return <Hexagon width={s} height={s} style={{ color }} />;
    case 'star':
      return <Star width={s} height={s} style={{ color }} />;
    case 'speech':
      return <MessageCircle width={s} height={s} style={{ color }} />;
    case 'diamond':
      return <Diamond width={s} height={s} style={{ color }} />;
    case 'pill':
      return (
        <svg {...svgProps}>
          <rect x={cx - r} y={cy - r * 0.42} width={r * 2} height={r * 0.84}
            rx={r * 0.42} fill="none" stroke={color} strokeWidth={1.5} />
        </svg>
      );
    case 'roundedRect':
      return <RectangleHorizontal width={s} height={s} style={{ color }} />;
    default:
      return <Circle width={s} height={s} style={{ color }} />;
  }
};

// ── Line style preview ──
const LinePreview = ({ style, color = '#64748B', active = false }) => {
  const w = 48;
  const h = 20;
  const baseProps = { fill: 'none', stroke: color, strokeWidth: active ? 2.5 : 1.8, strokeLinecap: 'round' };

  if (style === 'tapered') {
    // Tapered: filled shape that goes thick→thin
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path d={`M 4 ${h / 2 + 3} C 16 ${h / 2 + 4} 30 ${h / 2 - 2} ${w - 4} ${h / 2} L ${w - 4} ${h / 2} C 30 ${h / 2} 16 ${h / 2 - 2} 4 ${h / 2 - 3} Z`}
          fill={color} opacity={active ? 0.7 : 0.4} />
      </svg>
    );
  }

  const d = `M 4 ${h / 2} C 16 ${h / 2 - 4} 30 ${h / 2 + 4} ${w - 4} ${h / 2}`;
  const extra = style === 'dashed' ? { strokeDasharray: '6 4' }
    : style === 'dotted' ? { strokeDasharray: '2 4' }
    : {};

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} {...baseProps} {...extra} />
    </svg>
  );
};

// ── Font options ──
const FONTS = [
  { key: 'Heebo', label: 'Heebo' },
  { key: 'Assistant', label: 'Assistant' },
  { key: 'Rubik', label: 'Rubik' },
];

// ── Branch Color Engine: P1-P5 definitions ──
const BRANCH_DEFS = [
  { key: 'P1', label: 'P1 שכר' },
  { key: 'P2', label: 'P2 הנה"ח' },
  { key: 'P3', label: 'P3 ניהול' },
  { key: 'P4', label: 'P4 בית / אישי' },
  { key: 'P5', label: 'P5 דוחות שנתיים' },
];

const DEFAULTS_BRANCH_COLORS = {
  P1: '#00A3E0', P2: '#4682B4', P3: '#E91E63', P4: '#FFC107', P5: '#2E7D32',
};

const BRANCH_PALETTE = [
  '#00A3E0', '#0277BD', '#4682B4', '#1E3A5F',
  '#E91E63', '#AD1457', '#FF6B9D', '#F8BBD0',
  '#FFC107', '#FF9800', '#F57F17', '#FFE082',
  '#8BC34A', '#2E7D32', '#00BCD4', '#1DE9B6',
  '#9C27B0', '#7C4DFF', '#FF5252', '#6D4C41',
];

const THEMES = [
  { key: 'light', label: 'בהיר', icon: Sun, color: '#FFC107' },
  { key: 'soft-gray', label: 'אפור רך', icon: Monitor, color: '#94A3B8' },
  { key: 'dark', label: 'כהה', icon: Moon, color: '#334155' },
];

export default function DesignFloatingTab() {
  const design = useDesign();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('colors'); // colors | theme | shapes | lines | templates

  const tabs = useMemo(() => [
    { key: 'colors', label: 'צבעים', icon: Palette },
    { key: 'theme', label: 'ערכת נושא', icon: Sun },
    { key: 'shapes', label: 'צורות', icon: Hexagon },
    { key: 'lines', label: 'קווים', icon: Minus },
    { key: 'templates', label: 'תבניות', icon: Sparkles },
  ], []);

  const handleToggle = useCallback(() => setIsOpen(p => !p), []);

  return (
    <>
      {/* ── FAB Button (always visible) ── */}
      <motion.button
        onClick={handleToggle}
        className="fixed z-[9998] flex items-center gap-2 px-3 py-2.5 rounded-2xl shadow-xl border transition-colors"
        style={{
          bottom: 24,
          left: 24,
          background: isOpen
            ? 'linear-gradient(135deg, #E91E63, #FF6B9D)'
            : 'linear-gradient(135deg, #FFFFFF, #F8FAFC)',
          borderColor: isOpen ? '#E91E63' : '#E2E8F0',
          color: isOpen ? 'white' : '#475569',
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Paintbrush className="w-4 h-4" />
        {!isOpen && <span className="text-[11px] font-bold hidden sm:inline">עיצוב</span>}
        {isOpen && <X className="w-3.5 h-3.5" />}
      </motion.button>

      {/* ── Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed z-[9997] rounded-2xl shadow-2xl border overflow-hidden"
            style={{
              bottom: 72,
              left: 24,
              width: 320,
              maxHeight: 'calc(100vh - 120px)',
              background: 'var(--cp-card-bg, #FFFFFF)',
              borderColor: 'var(--cp-border, #E2E8F0)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{
                borderColor: 'var(--cp-border, #E2E8F0)',
                background: 'linear-gradient(135deg, #E91E6308, #FF6B9D08)',
              }}>
              <div className="flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-[#E91E63]" />
                <span className="text-sm font-bold" style={{ color: 'var(--cp-text, #0F172A)' }}>
                  מנוע עיצוב
                </span>
              </div>
              <button onClick={handleToggle}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex gap-0.5 px-2 py-1.5 border-b overflow-x-auto"
              style={{ borderColor: 'var(--cp-border, #E2E8F0)' }}>
              {tabs.map(t => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-[#E91E63]/10 text-[#E91E63]'
                        : 'hover:bg-gray-50'
                    }`}
                    style={{ color: isActive ? '#E91E63' : 'var(--cp-text-secondary, #64748B)' }}>
                    <Icon className="w-3 h-3" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Content area — scrollable */}
            <div className="overflow-y-auto p-3 space-y-3"
              style={{ maxHeight: 'calc(100vh - 260px)' }}>

              {/* ══ COLORS TAB (Branch Color Engine) ══ */}
              {activeTab === 'colors' && (
                <>
                  <Section label="צבעי ענפים P1-P5">
                    <div className="space-y-2">
                      {BRANCH_DEFS.map(b => {
                        const currentColor = design.getBranchColor(b.key);
                        return (
                          <div key={b.key} className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl border-2 shadow-sm shrink-0 flex items-center justify-center"
                              style={{ borderColor: currentColor, backgroundColor: currentColor + '15' }}>
                              <span className="text-[9px] font-black" style={{ color: currentColor }}>{b.key}</span>
                            </div>
                            <div className="flex-1">
                              <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--cp-text)' }}>
                                {b.label}
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {BRANCH_PALETTE.map(c => (
                                  <button key={c} onClick={() => design.setBranchColor(b.key, c)}
                                    className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-125 ${
                                      currentColor === c ? 'ring-2 ring-offset-1 scale-110' : ''
                                    }`}
                                    style={{
                                      backgroundColor: c,
                                      borderColor: currentColor === c ? c : 'transparent',
                                      ringColor: c,
                                    }}
                                    title={c} />
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                  <button onClick={() => {
                    design.updatePref('branchColors', { ...DEFAULTS_BRANCH_COLORS });
                  }}
                    className="w-full mt-2 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all hover:bg-gray-50"
                    style={{ borderColor: 'var(--cp-border)', color: 'var(--cp-text-secondary)' }}>
                    איפוס צבעי ברירת מחדל
                  </button>
                </>
              )}

              {/* ══ THEME TAB ══ */}
              {activeTab === 'theme' && (
                <>
                  {/* Theme selector */}
                  <Section label="ערכת צבעים">
                    <div className="flex gap-2">
                      {THEMES.map(t => {
                        const Icon = t.icon;
                        const isActive = design.theme === t.key;
                        return (
                          <button key={t.key} onClick={() => design.updatePref('theme', t.key)}
                            className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${
                              isActive ? 'shadow-md scale-105' : 'border-transparent hover:bg-gray-50'
                            }`}
                            style={{
                              borderColor: isActive ? '#E91E63' : 'transparent',
                              background: isActive ? '#E91E6308' : undefined,
                            }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: t.color + '20' }}>
                              <Icon className="w-4 h-4" style={{ color: t.color }} />
                            </div>
                            <span className="text-[10px] font-bold" style={{ color: 'var(--cp-text, #0F172A)' }}>
                              {t.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </Section>

                  {/* Typography */}
                  <Section label="טיפוגרפיה">
                    <div className="flex gap-1.5">
                      {FONTS.map(f => (
                        <button key={f.key} onClick={() => design.updatePref('fontFamily', f.key)}
                          className={`flex-1 px-2 py-2 rounded-xl text-[11px] font-bold transition-all border ${
                            design.fontFamily === f.key
                              ? 'border-[#E91E63] bg-[#E91E63]/5 text-[#E91E63]'
                              : 'border-transparent hover:bg-gray-50'
                          }`}
                          style={{ fontFamily: f.key, color: design.fontFamily === f.key ? '#E91E63' : 'var(--cp-text-secondary)' }}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </Section>

                  {/* Toggles */}
                  <Section label="אפקטים">
                    <div className="space-y-2">
                      <ToggleRow label="זכוכית (Glassmorphism)"
                        active={design.glassmorphism}
                        onChange={() => design.updatePref('glassmorphism', !design.glassmorphism)} />
                      <ToggleRow label="צללים רכים"
                        active={design.softShadows}
                        onChange={() => design.updatePref('softShadows', !design.softShadows)} />
                    </div>
                  </Section>
                </>
              )}

              {/* ══ SHAPES TAB ══ */}
              {activeTab === 'shapes' && (
                <Section label="צורת בועה">
                  <div className="grid grid-cols-3 gap-2">
                    {SHAPE_OPTIONS.map(s => {
                      const isActive = design.shape === s.key;
                      return (
                        <button key={s.key} onClick={() => design.updatePref('shape', s.key)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                            isActive ? 'shadow-md' : 'border-transparent hover:bg-gray-50'
                          }`}
                          style={{
                            borderColor: isActive ? '#00A3E0' : 'transparent',
                            background: isActive ? '#00A3E008' : undefined,
                          }}>
                          <ShapeIcon shape={s.key} size={28}
                            color={isActive ? '#00A3E0' : 'var(--cp-text-secondary, #94A3B8)'} />
                          <span className="text-[9px] font-bold"
                            style={{ color: isActive ? '#00A3E0' : 'var(--cp-text-secondary)' }}>
                            {s.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* ══ LINES TAB ══ */}
              {activeTab === 'lines' && (
                <Section label="סגנון חיבור">
                  <div className="space-y-1.5">
                    {LINE_STYLE_OPTIONS.map(ls => {
                      const isActive = design.lineStyle === ls.key;
                      return (
                        <button key={ls.key} onClick={() => design.updatePref('lineStyle', ls.key)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all ${
                            isActive ? 'shadow-sm' : 'border-transparent hover:bg-gray-50'
                          }`}
                          style={{
                            borderColor: isActive ? '#E91E63' : 'transparent',
                            background: isActive ? '#E91E6308' : undefined,
                          }}>
                          <LinePreview style={ls.key} color={isActive ? '#E91E63' : '#94A3B8'} active={isActive} />
                          <div className="flex-1 text-right">
                            <div className="text-[11px] font-bold"
                              style={{ color: isActive ? '#E91E63' : 'var(--cp-text)' }}>
                              {ls.label}
                            </div>
                            <div className="text-[9px]"
                              style={{ color: 'var(--cp-text-secondary)' }}>
                              {ls.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* ══ TEMPLATES TAB ══ */}
              {activeTab === 'templates' && (
                <Section label="תבניות מפה">
                  <div className="space-y-2">
                    {Object.entries(MAP_TEMPLATES).map(([key, t]) => {
                      const isActive = design.mapTemplate === key;
                      return (
                        <button key={key} onClick={() => design.applyTemplate(key)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-all text-right ${
                            isActive ? 'shadow-md' : 'border-transparent hover:bg-gray-50'
                          }`}
                          style={{
                            borderColor: isActive ? '#E91E63' : 'transparent',
                            background: isActive ? '#E91E6308' : undefined,
                          }}>
                          {/* Mini preview */}
                          <div className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0"
                            style={{
                              borderColor: isActive ? '#E91E63' : 'var(--cp-border)',
                              background: isActive
                                ? 'linear-gradient(135deg, #E91E6310, #FF6B9D10)'
                                : 'var(--cp-bg-secondary)',
                            }}>
                            <ShapeIcon shape={t.shape} size={22}
                              color={isActive ? '#E91E63' : 'var(--cp-text-secondary, #94A3B8)'} />
                          </div>
                          <div className="flex-1">
                            <div className="text-[11px] font-bold flex items-center gap-1.5"
                              style={{ color: isActive ? '#E91E63' : 'var(--cp-text)' }}>
                              {t.label}
                              {isActive && (
                                <span className="text-[8px] bg-[#E91E63] text-white px-1.5 py-0.5 rounded-full">
                                  פעיל
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] mt-0.5"
                              style={{ color: 'var(--cp-text-secondary)' }}>
                              {t.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Reset */}
                  <button onClick={design.resetToDefaults}
                    className="w-full mt-3 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all hover:bg-gray-50"
                    style={{ borderColor: 'var(--cp-border)', color: 'var(--cp-text-secondary)' }}>
                    איפוס ברירת מחדל
                  </button>
                </Section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Small reusable components ──

function Section({ label, children }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider mb-2"
        style={{ color: 'var(--cp-text-secondary, #64748B)' }}>
        {label}
      </h4>
      {children}
    </div>
  );
}

function ToggleRow({ label, active, onChange }) {
  return (
    <button onClick={onChange}
      className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all hover:bg-gray-50">
      <span className="text-[11px] font-semibold" style={{ color: 'var(--cp-text)' }}>{label}</span>
      <div className={`w-9 h-5 rounded-full relative transition-colors ${active ? 'bg-[#E91E63]' : 'bg-gray-300'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
          active ? 'left-[18px]' : 'left-0.5'
        }`} />
      </div>
    </button>
  );
}
