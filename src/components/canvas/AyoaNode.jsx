/**
 * -- AyoaNode: Reusable AYOA-style SVG node shapes --
 * 9 Organic Shapes: Cloud, Bubble, Speech, Diamond, Pill, Star, Capsule, Hexagon, RoundedRect
 * Soft glow halos, DNA-driven colors, absolute SVG coords.
 *
 * ARCHITECTURE NOTE: This component is a LEAF module with ZERO context imports.
 * All design data (overrides, stickers, active-branch state) is passed via PROPS
 * from parent views (AyoaMapView, AyoaRadialView, FocusMapView) which own the
 * DesignContext. This prevents circular import chains that cause TDZ crashes:
 *   AyoaMapView → AyoaNode → DesignContext → entities  ← BREAKS MINIFIED BUNDLE
 *
 * Props:
 *   cx, cy         -- center coordinates (SVG viewBox units)
 *   size           -- radius/half-width
 *   shape          -- 'cloud' | 'bubble' | 'speech' | 'diamond' | 'pill' | 'star' | ...
 *   fill           -- background fill color
 *   stroke         -- border stroke color
 *   strokeWidth    -- border width (default 2)
 *   glow           -- enable soft glow halo (default true)
 *   glowColor      -- glow color (defaults to stroke)
 *   sticker        -- emoji sticker overlay (from parent's design.stickerMap)
 *   isActive       -- pulse/glow when branch is active (from parent's design.isBranchActive)
 *   overrideShape  -- per-node shape override (from parent's design.getNodeOverride)
 *   overrideFill   -- per-node color override (from parent's design.getNodeOverride)
 */

import React from 'react';

// -- AYOA Hex Bible -- Full Vibrant Spectrum --
export const AYOA_PALETTE = {
  magenta:  '#6366F1',
  mustard:  '#FFC107',
  skyBlue:  '#00A3E0',
  sage:     '#B2AC88',
  neonPink: '#818CF8',
  lime:     '#8BC34A',
  turquoise:'#00BCD4',
  orange:   '#FF9800',
  purple:   '#9C27B0',
  indigo:   '#7C4DFF',
  lightBlue:'#81D4FA',
  softPink: '#C7D2FE',
  softGreen:'#C5E1A5',
  softGold: '#FFE082',
  liveRed:  '#F59E0B',
  steel:    '#4682B4',
  fuchsia:  '#8B5CF6',
  neonGreen:'#00E676',
  coral:    '#F59E0B',
  mint:     '#1DE9B6',
};

// -- Shape path builders -- all return SVG element(s), absolute coords only --
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

  capsule: (cx, cy, r, fill, stroke, sw) => (
    <rect x={cx - r * 1.2} y={cy - r * 0.5} width={r * 2.4} height={r}
      rx={r * 0.5} fill={fill} stroke={stroke} strokeWidth={sw} />
  ),

  hexagon: (cx, cy, r, fill, stroke, sw) => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  },

  heart: (cx, cy, r, fill, stroke, sw) => {
    const d = `M ${cx} ${cy + r * 0.6}
      C ${cx - r * 0.1} ${cy + r * 0.45} ${cx - r * 0.65} ${cy + r * 0.2} ${cx - r * 0.65} ${cy - r * 0.15}
      C ${cx - r * 0.65} ${cy - r * 0.55} ${cx - r * 0.3} ${cy - r * 0.7} ${cx} ${cy - r * 0.35}
      C ${cx + r * 0.3} ${cy - r * 0.7} ${cx + r * 0.65} ${cy - r * 0.55} ${cx + r * 0.65} ${cy - r * 0.15}
      C ${cx + r * 0.65} ${cy + r * 0.2} ${cx + r * 0.1} ${cy + r * 0.45} ${cx} ${cy + r * 0.6} Z`;
    return <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  },

  banner: (cx, cy, r, fill, stroke, sw) => {
    const w = r * 1.4, h = r * 0.7;
    const d = `M ${cx - w} ${cy - h}
      L ${cx + w} ${cy - h}
      L ${cx + w} ${cy + h * 0.6}
      L ${cx + w * 0.7} ${cy + h * 0.35}
      L ${cx} ${cy + h * 0.6}
      L ${cx - w * 0.7} ${cy + h * 0.35}
      L ${cx - w} ${cy + h * 0.6} Z`;
    return <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  },

  crown: (cx, cy, r, fill, stroke, sw) => {
    const w = r * 0.9, h = r * 0.7;
    const d = `M ${cx - w} ${cy + h * 0.5}
      L ${cx - w} ${cy - h * 0.2}
      L ${cx - w * 0.5} ${cy + h * 0.1}
      L ${cx} ${cy - h * 0.6}
      L ${cx + w * 0.5} ${cy + h * 0.1}
      L ${cx + w} ${cy - h * 0.2}
      L ${cx + w} ${cy + h * 0.5} Z`;
    return <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  },
};

export const SHAPE_KEYS = ['cloud', 'bubble', 'speech', 'diamond', 'pill', 'star', 'capsule', 'hexagon', 'roundedRect', 'heart', 'banner', 'crown'];

// -- Pulse animation keyframes (injected once) --
const PULSE_STYLE_ID = 'ayoa-pulse-keyframes';
function ensurePulseStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes ayoa-pulse {
      0%, 100% { opacity: 0.15; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(1.08); }
    }
    .ayoa-pulse-glow {
      animation: ayoa-pulse 2s ease-in-out infinite;
      transform-origin: center center;
    }
  `;
  document.head.appendChild(style);
}

/**
 * AyoaNode component — pure presentational, NO context imports.
 * Design overrides arrive via props from the parent view.
 */
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
  // Design props — passed down from parent view (which owns DesignContext)
  overrideShape,
  overrideFill,
  sticker,
  isActive = false,
  // Fill/Border toggle: 'filled' = solid fill, 'border' = outline only
  fillMode = 'filled',
}) {
  // Apply per-node overrides (resolved by parent view from DesignContext)
  const effectiveShape = overrideShape || shape;
  const baseFill = overrideFill || fill;
  // Border-only mode: transparent fill, thicker stroke
  const effectiveFill = fillMode === 'border' ? 'none' : baseFill;
  const effectiveStrokeWidth = fillMode === 'border' ? Math.max(strokeWidth, 2.5) : strokeWidth;
  const effectiveStroke = fillMode === 'border' ? (overrideFill || stroke) : stroke;

  if (isActive) ensurePulseStyles();

  const renderer = SHAPE_RENDERERS[effectiveShape] || SHAPE_RENDERERS.bubble;
  const gc = glowColor || stroke;

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', ...style }}>
      {/* Pulse glow ring for active branches */}
      {isActive && (
        <g className="ayoa-pulse-glow" opacity={0.25}>
          {renderer(cx, cy, size + 10, 'none', gc, 3)}
        </g>
      )}
      {/* Standard soft glow halo */}
      {glow && (
        <g opacity={0.2}>
          {renderer(cx, cy, size + 5, 'none', gc, 0)}
        </g>
      )}
      {/* Main shape */}
      {renderer(cx, cy, size, effectiveFill, effectiveStroke, effectiveStrokeWidth)}
      {/* Sticker overlay */}
      {sticker && (
        <text
          x={cx + size * 0.55}
          y={cy - size * 0.55}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.55}
          style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
        >
          {sticker}
        </text>
      )}
      {children}
    </g>
  );
}

/**
 * Render a shape at the given position (standalone function for views).
 * Accepts optional designCtx for per-node override lookups.
 */
export function renderNodeShape(shape, x, y, r, fill, stroke, sw = 2.5, nodeId = null, designCtx = null) {
  let effectiveShape = shape;
  let effectiveFill = fill;
  if (designCtx && nodeId) {
    const override = designCtx.getNodeOverride?.(nodeId);
    if (override?.shape) effectiveShape = override.shape;
    if (override?.color) effectiveFill = override.color;
  }
  const renderer = SHAPE_RENDERERS[effectiveShape] || SHAPE_RENDERERS.bubble;
  return renderer(x, y, r, effectiveFill, stroke, sw);
}

/**
 * Tapered Bezier branch path -- thick at base, thin at tip.
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
