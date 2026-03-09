/**
 * -- AyoaNode: Reusable AYOA-style SVG node shapes --
 * 9 Organic Shapes: Cloud, Bubble, Speech, Diamond, Pill, Star, Capsule, Hexagon, RoundedRect
 * Soft glow halos, DNA-driven colors, absolute SVG coords.
 *
 * Now integrated with DesignContext:
 * - Checks nodeOverrides[nodeId] for per-node shape/color before falling back to props
 * - Renders stickers from stickerMap as emoji overlays
 * - Triggers pulse/glow animation when the node's branch is active
 *
 * Props:
 *   cx, cy     -- center coordinates (SVG viewBox units)
 *   size       -- radius/half-width
 *   shape      -- 'cloud' | 'bubble' | 'speech' | 'diamond' | 'pill' | 'star' | ...
 *   fill       -- background fill color
 *   stroke     -- border stroke color
 *   strokeWidth -- border width (default 2)
 *   glow       -- enable soft glow halo (default true)
 *   glowColor  -- glow color (defaults to stroke)
 *   nodeId     -- unique node identifier for DesignContext overrides & stickers
 *   branchKey  -- branch identifier (P1-P5) for pulse animation
 */

import React from 'react';
import { useDesign } from '@/contexts/DesignContext';

// -- AYOA Hex Bible -- Full Vibrant Spectrum --
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

  // -- New shapes for Design Engine --
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
};

export const SHAPE_KEYS = ['cloud', 'bubble', 'speech', 'diamond', 'pill', 'star', 'capsule', 'hexagon', 'roundedRect'];

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
  nodeId,
  branchKey,
}) {
  const design = useDesign();

  // -- Global Rendering: Check nodeOverrides for this node before using prop defaults --
  const override = nodeId ? design.getNodeOverride?.(nodeId) : null;
  const effectiveShape = override?.shape || shape;
  const effectiveFill = override?.color || fill;
  const sticker = nodeId ? design.stickerMap?.[nodeId] : null;

  // -- Pulse Animation: Glow when branch is active --
  const isActive = branchKey ? design.isBranchActive?.(branchKey) : false;
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
      {renderer(cx, cy, size, effectiveFill, stroke, strokeWidth)}
      {/* Sticker overlay from DesignContext */}
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
 * Now supports optional nodeId for DesignContext override lookups.
 */
export function renderNodeShape(shape, x, y, r, fill, stroke, sw = 2.5, nodeId = null, designCtx = null) {
  // If a designCtx is passed, check for per-node overrides
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
