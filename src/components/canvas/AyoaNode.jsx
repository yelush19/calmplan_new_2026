/**
 * ── AyoaNode: Reusable AYOA-style SVG node shapes ──
 * 6 Organic Shapes: Cloud, Bubble, Speech, Diamond, Pill, Star
 * Soft glow halos, DNA-driven colors, absolute SVG coords.
 *
 * Props:
 *   cx, cy     — center coordinates (SVG viewBox units)
 *   size       — radius/half-width
 *   shape      — 'cloud' | 'bubble' | 'speech' | 'diamond' | 'pill' | 'star'
 *   fill       — background fill color
 *   stroke     — border stroke color
 *   strokeWidth — border width (default 2)
 *   glow       — enable soft glow halo (default true)
 *   glowColor  — glow color (defaults to stroke)
 */

import React from 'react';

// ── AYOA Hex Bible — Full Vibrant Spectrum ──
export const AYOA_PALETTE = {
  magenta:  '#E91E63',
  mustard:  '#FFC107',
  skyBlue:  '#00A3E0',
  sage:     '#B2AC88',
  neonPink: '#FF6B9D',
  lime:     '#8BC34A',
  turquoise:'#00BCD4',
  orange:   '#FF9800',
  purple:   '#9C27B0',
  indigo:   '#7C4DFF',
  lightBlue:'#81D4FA',
  softPink: '#F8BBD0',
  softGreen:'#C5E1A5',
  softGold: '#FFE082',
  liveRed:  '#FF5252',
  steel:    '#4682B4',
  fuchsia:  '#E040FB',
  neonGreen:'#00E676',
  coral:    '#FF6E40',
  mint:     '#1DE9B6',
};

// ── Shape path builders — all return SVG element(s), absolute coords only ──
const SHAPE_RENDERERS = {
  cloud: (cx, cy, r, fill, stroke, sw) => {
    const d = `M ${cx - r * 0.55} ${cy + r * 0.22} ` +
      `C ${cx - r * 0.88} ${cy + r * 0.22} ${cx - r} ${cy - r * 0.11} ${cx - r * 0.77} ${cy - r * 0.39} ` +
      `C ${cx - r * 0.77} ${cy - r * 0.72} ${cx - r * 0.39} ${cy - r * 0.88} ${cx - r * 0.11} ${cy - r * 0.66} ` +
      `C ${cx + r * 0.06} ${cy - r * 0.94} ${cx + r * 0.5} ${cy - r * 0.88} ${cx + r * 0.61} ${cy - r * 0.61} ` +
      `C ${cx + r * 0.94} ${cy - r * 0.55} ${cx + r} ${cy - r * 0.11} ${cx + r * 0.77} ${cy + r * 0.11} ` +
      `C ${cx + r * 0.88} ${cy + r * 0.39} ${cx + r * 0.61} ${cy + r * 0.55} ${cx + r * 0.28} ${cy + r * 0.5} ` +
      `C ${cx + r * 0.11} ${cy + r * 0.66} ${cx - r * 0.28} ${cy + r * 0.61} ${cx - r * 0.55} ${cy + r * 0.22} Z`;
    return <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} />;
  },

  bubble: (cx, cy, r, fill, stroke, sw) => (
    <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.82} fill={fill} stroke={stroke} strokeWidth={sw} />
  ),

  speech: (cx, cy, r, fill, stroke, sw) => {
    // Speech bubble with a small tail at bottom-left
    const d = `M ${cx - r * 0.8} ${cy - r * 0.5}` +
      ` Q ${cx - r * 0.8} ${cy - r * 0.85} ${cx - r * 0.2} ${cy - r * 0.85}` +
      ` L ${cx + r * 0.2} ${cy - r * 0.85}` +
      ` Q ${cx + r * 0.8} ${cy - r * 0.85} ${cx + r * 0.8} ${cy - r * 0.5}` +
      ` L ${cx + r * 0.8} ${cy + r * 0.2}` +
      ` Q ${cx + r * 0.8} ${cy + r * 0.55} ${cx + r * 0.2} ${cy + r * 0.55}` +
      ` L ${cx - r * 0.15} ${cy + r * 0.55}` +
      ` L ${cx - r * 0.45} ${cy + r * 0.88}` +
      ` L ${cx - r * 0.3} ${cy + r * 0.55}` +
      ` L ${cx - r * 0.5} ${cy + r * 0.55}` +
      ` Q ${cx - r * 0.8} ${cy + r * 0.55} ${cx - r * 0.8} ${cy + r * 0.2}` +
      ` Z`;
    return <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  },

  diamond: (cx, cy, r, fill, stroke, sw) => {
    const pts = `${cx},${cy - r} ${cx + r * 0.7},${cy} ${cx},${cy + r} ${cx - r * 0.7},${cy}`;
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  },

  pill: (cx, cy, r, fill, stroke, sw) => (
    <rect x={cx - r} y={cy - r * 0.45} width={r * 2} height={r * 0.9}
      rx={r * 0.45} fill={fill} stroke={stroke} strokeWidth={sw} />
  ),

  star: (cx, cy, r, fill, stroke, sw) => {
    // 5-pointed star
    const points = [];
    for (let i = 0; i < 5; i++) {
      const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const innerAngle = outerAngle + Math.PI / 5;
      points.push(`${cx + r * Math.cos(outerAngle)},${cy + r * Math.sin(outerAngle)}`);
      points.push(`${cx + r * 0.4 * Math.cos(innerAngle)},${cy + r * 0.4 * Math.sin(innerAngle)}`);
    }
    return <polygon points={points.join(' ')} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  },

  circle: (cx, cy, r, fill, stroke, sw) => (
    <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
  ),

  roundedRect: (cx, cy, r, fill, stroke, sw) => (
    <rect x={cx - r} y={cy - r * 0.7} width={r * 2} height={r * 1.4}
      rx={14} fill={fill} stroke={stroke} strokeWidth={sw} />
  ),
};

export const SHAPE_KEYS = ['cloud', 'bubble', 'speech', 'diamond', 'pill', 'star'];

export default function AyoaNode({
  cx, cy, size = 30,
  shape = 'bubble',
  fill = '#E3F2FD',
  stroke = '#4682B4',
  strokeWidth = 2,
  glow = true,
  glowColor,
  onClick,
  style,
  children,
}) {
  const renderer = SHAPE_RENDERERS[shape] || SHAPE_RENDERERS.bubble;
  const gc = glowColor || stroke;

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', ...style }}>
      {glow && (
        <g opacity={0.2}>
          {renderer(cx, cy, size + 5, 'none', gc, 0)}
        </g>
      )}
      {renderer(cx, cy, size, fill, stroke, strokeWidth)}
      {children}
    </g>
  );
}

/**
 * Render a shape at the given position (standalone function for views).
 */
export function renderNodeShape(shape, x, y, r, fill, stroke, sw = 2.5) {
  const renderer = SHAPE_RENDERERS[shape] || SHAPE_RENDERERS.bubble;
  return renderer(x, y, r, fill, stroke, sw);
}

/**
 * Tapered Bezier branch path — thick at base, thin at tip.
 * Returns SVG path d-string. Absolute coords only.
 */
export function buildTaperedBranch(sx, sy, ex, ey, startW = 5, endW = 1.5) {
  const dx = ex - sx, dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cp1x = sx + dx * 0.3 + nx * len * 0.1;
  const cp1y = sy + dy * 0.3 + ny * len * 0.1;
  const cp2x = sx + dx * 0.7 - nx * len * 0.06;
  const cp2y = sy + dy * 0.7 - ny * len * 0.06;
  const sw2 = startW / 2, ew2 = endW / 2;
  return [
    `M ${sx + nx * sw2} ${sy + ny * sw2}`,
    `C ${cp1x + nx * sw2 * 0.8} ${cp1y + ny * sw2 * 0.8} ${cp2x + nx * ew2 * 0.5} ${cp2y + ny * ew2 * 0.5} ${ex + nx * ew2} ${ey + ny * ew2}`,
    `L ${ex - nx * ew2} ${ey - ny * ew2}`,
    `C ${cp2x - nx * ew2 * 0.5} ${cp2y - ny * ew2 * 0.5} ${cp1x - nx * sw2 * 0.8} ${cp1y - ny * sw2 * 0.8} ${sx - nx * sw2} ${sy - ny * sw2}`,
    'Z'
  ].join(' ');
}

// ── DNA Palette for P-branches ──
const DNA_COLORS = {
  P1: '#00A3E0',
  P2: '#B2AC88',
  P3: '#E91E63',
  P4: '#FFC107',
};

const DASHBOARD_TO_BRANCH = {
  payroll: 'P1',
  tax: 'P2',
  admin: 'P3',
  additional: 'P3',
};

/**
 * Dynamic category color resolver.
 * Checks service dashboard overrides FIRST (from SettingsMindMap),
 * then falls back to keyword matching.
 * This ensures that when a service is moved from P1→P2,
 * all its nodes instantly adopt the new branch color.
 */
let _cachedOverrideMap = null;
let _cachedOverrideRaw = null;

function buildOverrideMap() {
  // Check localStorage for service overrides (set by SettingsMindMap)
  let raw = null;
  try { raw = localStorage.getItem('calmplan_service_overrides'); } catch { /* */ }
  // Cache: only rebuild if localStorage changed
  if (raw === _cachedOverrideRaw && _cachedOverrideMap) return _cachedOverrideMap;
  _cachedOverrideRaw = raw;

  const map = {}; // category string → DNA color
  if (!raw) { _cachedOverrideMap = map; return map; }

  try {
    const overrides = JSON.parse(raw);
    // Also need ALL_SERVICES to know each service's taskCategories
    // Import would be circular, so we inline-require the service registry
    const ALL_SERVICES = _getAllServices();
    for (const [serviceKey, ov] of Object.entries(overrides)) {
      if (!ov.dashboard) continue;
      const branch = DASHBOARD_TO_BRANCH[ov.dashboard];
      if (!branch || !DNA_COLORS[branch]) continue;
      const color = DNA_COLORS[branch];
      // Map all taskCategories AND the service label to this color
      const svc = ALL_SERVICES[serviceKey];
      if (svc?.taskCategories) {
        svc.taskCategories.forEach(cat => { map[cat] = color; });
      }
      if (svc?.label) map[svc.label] = color;
      if (svc?.createCategory) map[svc.createCategory] = color;
    }
  } catch { /* corrupt JSON, ignore */ }
  _cachedOverrideMap = map;
  return map;
}

// Lazy service registry loader (avoids circular import)
let _allServicesCache = null;
function _getAllServices() {
  if (_allServicesCache) return _allServicesCache;
  try {
    // Dynamic import not possible in sync context, use the config directly
    const mod = require('@/config/processTemplates');
    _allServicesCache = mod.ALL_SERVICES || {};
  } catch {
    _allServicesCache = {};
  }
  return _allServicesCache;
}

/**
 * Get the DNA color for a category, respecting service dashboard overrides.
 * Use this instead of hardcoded getCategoryColor().
 */
export function getDynamicCategoryColor(category) {
  if (!category) return DNA_COLORS.P3;

  // 1. Check override map first (service moved to a different board)
  const overrideMap = buildOverrideMap();
  if (overrideMap[category]) return overrideMap[category];

  // 2. Fallback: keyword matching (original logic)
  const cat = category.toLowerCase();
  if (cat.includes('שכר') || cat.includes('payroll') || cat.includes('ניכויים') || cat.includes('ביטוח') || cat.includes('מס"ב')) return DNA_COLORS.P1;
  if (cat.includes('מע"מ') || cat.includes('vat') || cat.includes('הנה"ח') || cat.includes('bookkeeping') || cat.includes('מקדמות') || cat.includes('התאמות') || cat.includes('מאזנ')) return DNA_COLORS.P2;
  if (cat.includes('admin') || cat.includes('אדמיני') || cat.includes('ייעוץ') || cat.includes('פגישה') || cat.includes('שיווק')) return DNA_COLORS.P3;
  return DNA_COLORS.P4;
}
