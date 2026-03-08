/**
 * ── LineStyle Engine: Connection Drawing System ──
 *
 * 4 line styles for mind-map connections:
 *   solid   — Clean professional Bezier
 *   dashed  — Tentative / secondary (dash-array)
 *   dotted  — Subtle / ghost connections
 *   tapered — AYOA signature: thick at parent, thin at child
 *
 * Every style uses Bezier curves (never straight lines).
 * Color automatically inherits from the parent branch.
 */

/**
 * Build a Bezier curve path between two points.
 * Returns a d-string for an SVG <path>.
 * The curve bends perpendicular to the line for organic feel.
 */
export function buildBezierPath(sx, sy, ex, ey, curvature = 0.25) {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular offset for organic curve
  const nx = -dy / len;
  const ny = dx / len;
  const offset = len * curvature;

  const cp1x = sx + dx * 0.3 + nx * offset;
  const cp1y = sy + dy * 0.3 + ny * offset;
  const cp2x = sx + dx * 0.7 - nx * offset * 0.4;
  const cp2y = sy + dy * 0.7 - ny * offset * 0.4;

  return `M ${sx} ${sy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${ex} ${ey}`;
}

/**
 * Build a tapered Bezier branch — thick at parent, thin at child.
 * Returns a closed d-string representing a filled shape (not a stroke).
 */
export function buildTaperedPath(sx, sy, ex, ey, startW = 5, endW = 1.5) {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const cp1x = sx + dx * 0.3 + nx * len * 0.1;
  const cp1y = sy + dy * 0.3 + ny * len * 0.1;
  const cp2x = sx + dx * 0.7 - nx * len * 0.06;
  const cp2y = sy + dy * 0.7 - ny * len * 0.06;

  const sw2 = startW / 2;
  const ew2 = endW / 2;

  return [
    `M ${sx + nx * sw2} ${sy + ny * sw2}`,
    `C ${cp1x + nx * sw2 * 0.8} ${cp1y + ny * sw2 * 0.8} ${cp2x + nx * ew2 * 0.5} ${cp2y + ny * ew2 * 0.5} ${ex + nx * ew2} ${ey + ny * ew2}`,
    `L ${ex - nx * ew2} ${ey - ny * ew2}`,
    `C ${cp2x - nx * ew2 * 0.5} ${cp2y - ny * ew2 * 0.5} ${cp1x - nx * sw2 * 0.8} ${cp1y - ny * sw2 * 0.8} ${sx - nx * sw2} ${sy - ny * sw2}`,
    'Z',
  ].join(' ');
}

/**
 * Render a connection SVG element between parent and child.
 *
 * @param {string} lineStyle   — 'solid' | 'dashed' | 'dotted' | 'tapered'
 * @param {number} sx, sy      — Start (parent) position
 * @param {number} ex, ey      — End (child) position
 * @param {string} color       — Stroke/fill color (inherited from parent branch)
 * @param {number} opacity     — Opacity (default 0.4)
 * @param {object} options     — { startWidth, endWidth, strokeWidth, curvature }
 * @returns {{ element: string, props: object }} — SVG element type + attributes
 */
export function getConnectionProps(lineStyle, sx, sy, ex, ey, color, opacity = 0.4, options = {}) {
  const {
    startWidth = 6,
    endWidth = 1.5,
    strokeWidth = 2.5,
    curvature = 0.2,
  } = options;

  if (lineStyle === 'tapered') {
    return {
      element: 'path',
      props: {
        d: buildTaperedPath(sx, sy, ex, ey, startWidth, endWidth),
        fill: color,
        stroke: 'none',
        opacity,
      },
    };
  }

  // All other styles use a Bezier stroke
  const d = buildBezierPath(sx, sy, ex, ey, curvature);
  const base = {
    d,
    fill: 'none',
    stroke: color,
    strokeWidth,
    opacity,
    strokeLinecap: 'round',
  };

  switch (lineStyle) {
    case 'dashed':
      return { element: 'path', props: { ...base, strokeDasharray: '10 6' } };
    case 'dotted':
      return { element: 'path', props: { ...base, strokeDasharray: '3 5', strokeWidth: strokeWidth * 0.8 } };
    case 'solid':
    default:
      return { element: 'path', props: base };
  }
}

/**
 * Human-readable labels for the UI selector.
 */
export const LINE_STYLE_OPTIONS = [
  { key: 'tapered', label: 'טפל (AYOA)', description: 'קו שמתחיל עבה ונהיה דק' },
  { key: 'solid',   label: 'מלא',         description: 'קו מקצועי חלק' },
  { key: 'dashed',  label: 'מקווקו',      description: 'חיבור משני / זמני' },
  { key: 'dotted',  label: 'מנוקד',       description: 'חיבור עדין / רפאים' },
];

export const SHAPE_OPTIONS = [
  { key: 'cloud',       label: 'ענן' },
  { key: 'bubble',      label: 'בועה' },
  { key: 'capsule',     label: 'כמוסה' },
  { key: 'hexagon',     label: 'משושה' },
  { key: 'star',        label: 'כוכב' },
  { key: 'speech',      label: 'דיבור' },
  { key: 'diamond',     label: 'מעוין' },
  { key: 'pill',        label: 'גלולה' },
  { key: 'roundedRect', label: 'מלבן' },
];
