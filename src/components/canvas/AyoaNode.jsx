/**
 * ── AyoaNode: Reusable AYOA-style SVG node shapes ──
 * Renders organic shapes (cloud, bubble, diamond, pill, circle, rect)
 * with soft glow halos and DNA-driven colors.
 *
 * Props:
 *   cx, cy     — center coordinates (SVG viewBox units)
 *   size       — radius/half-width
 *   shape      — 'cloud' | 'bubble' | 'diamond' | 'pill' | 'circle' | 'roundedRect'
 *   fill       — background fill color
 *   stroke     — border stroke color
 *   strokeWidth — border width (default 2)
 *   glow       — enable soft glow halo (default true)
 *   glowColor  — glow color (defaults to stroke)
 *   children   — optional inner SVG content
 */

import React from 'react';

// ── AYOA Hex Bible ──
export const AYOA_PALETTE = {
  magenta:  '#E91E63',
  mustard:  '#FFC107',
  skyBlue:  '#00A3E0',
  sage:     '#B2AC88',
  burgundy: '#800000',
  steel:    '#4682B4',
  purple:   '#9C27B0',
  lightBlue:'#ADD8E6',
};

// Shape path builders — all return SVG element(s)
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
    <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.85} fill={fill} stroke={stroke} strokeWidth={sw} />
  ),

  diamond: (cx, cy, r, fill, stroke, sw) => {
    const pts = `${cx},${cy - r} ${cx + r * 0.7},${cy} ${cx},${cy + r} ${cx - r * 0.7},${cy}`;
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  },

  pill: (cx, cy, r, fill, stroke, sw) => (
    <rect x={cx - r} y={cy - r * 0.45} width={r * 2} height={r * 0.9}
      rx={r * 0.45} fill={fill} stroke={stroke} strokeWidth={sw} />
  ),

  circle: (cx, cy, r, fill, stroke, sw) => (
    <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
  ),

  roundedRect: (cx, cy, r, fill, stroke, sw) => (
    <rect x={cx - r} y={cy - r * 0.7} width={r * 2} height={r * 1.4}
      rx={14} fill={fill} stroke={stroke} strokeWidth={sw} />
  ),
};

export const SHAPE_KEYS = Object.keys(SHAPE_RENDERERS);

export default function AyoaNode({
  cx, cy, size = 30,
  shape = 'bubble',
  fill = '#E3F2FD',
  stroke = '#4682B4',
  strokeWidth = 2,
  glow = true,
  glowColor,
  filterId,
  onClick,
  style,
  children,
}) {
  const renderer = SHAPE_RENDERERS[shape] || SHAPE_RENDERERS.bubble;
  const gc = glowColor || stroke;

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', ...style }}>
      {glow && (
        <g opacity={0.25}>
          {renderer(cx, cy, size + 4, 'none', gc, 0)}
          {/* Invisible larger shape for glow effect via filter */}
        </g>
      )}
      {renderer(cx, cy, size, fill, stroke, strokeWidth)}
      {children}
    </g>
  );
}

/**
 * Tapered Bezier branch path — thick at base, thin at tip.
 * Returns SVG path d-string.
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
