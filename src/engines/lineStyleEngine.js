/**
 * -- LineStyle Engine: Connection Drawing System --
 *
 * 4 line styles for mind-map connections:
 *   solid   -- Clean professional Bezier
 *   dashed  -- Tentative / secondary (dash-array)
 *   dotted  -- Subtle / ghost connections
 *   tapered -- AYOA signature: thick at parent, thin at child
 *
 * Every style uses Bezier curves (never straight lines).
 * Color automatically inherits from the parent branch.
 *
 * DB Bridge: Per-connection overrides via nodeOverrides take priority
 * over the global lineStyle, enabling unique styles per connection.
 */

/**
 * Build a Bezier curve path between two points.
 * Returns a d-string for an SVG <path>.
 * The curve bends perpendicular to the line for organic feel.
 *
 * @param {number} curvature - 0 = straight, 0.5 = very organic. Linked to DesignContext.curvature.
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
 * Build a tapered Bezier branch -- thick at parent, thin at child.
 * Returns a closed d-string representing a filled shape (not a stroke).
 *
 * Now supports an optional dashPattern for "Dashed Tapered" lines.
 * When dashPattern is provided, returns an object with both the filled
 * tapered path AND a center-line stroke with the dash pattern applied,
 * enabling dashed/dotted tapered connections.
 *
 * @param {number} sx, sy - Start (parent) position
 * @param {number} ex, ey - End (child) position
 * @param {number} startW  - Width at parent (default 5)
 * @param {number} endW    - Width at child (default 1.5)
 * @param {object} opts    - { dashPattern, curvature }
 * @returns {string|object} - d-string, or { fillPath, strokePath, dashPattern } when dashed
 */
export function buildTaperedPath(sx, sy, ex, ey, startW = 5, endW = 1.5, opts = {}) {
  const { dashPattern = null, curvature = 0.1 } = opts;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const cp1x = sx + dx * 0.3 + nx * len * curvature;
  const cp1y = sy + dy * 0.3 + ny * len * curvature;
  const cp2x = sx + dx * 0.7 - nx * len * curvature * 0.6;
  const cp2y = sy + dy * 0.7 - ny * len * curvature * 0.6;

  const sw2 = startW / 2;
  const ew2 = endW / 2;

  const fillPath = [
    `M ${sx + nx * sw2} ${sy + ny * sw2}`,
    `C ${cp1x + nx * sw2 * 0.8} ${cp1y + ny * sw2 * 0.8} ${cp2x + nx * ew2 * 0.5} ${cp2y + ny * ew2 * 0.5} ${ex + nx * ew2} ${ey + ny * ew2}`,
    `L ${ex - nx * ew2} ${ey - ny * ew2}`,
    `C ${cp2x - nx * ew2 * 0.5} ${cp2y - ny * ew2 * 0.5} ${cp1x - nx * sw2 * 0.8} ${cp1y - ny * sw2 * 0.8} ${sx - nx * sw2} ${sy - ny * sw2}`,
    'Z',
  ].join(' ');

  // If a dash pattern is requested, also produce a center-line stroke path
  if (dashPattern) {
    const strokePath = `M ${sx} ${sy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${ex} ${ey}`;
    return { fillPath, strokePath, dashPattern };
  }

  return fillPath;
}

/**
 * Render a connection SVG element between parent and child.
 *
 * DB Bridge: If options.connectionOverrides is provided (from nodeOverrides
 * in the database), it overrides the global lineStyle for this specific
 * connection. This allows per-connection styling saved in the DB.
 *
 * @param {string} lineStyle   - 'solid' | 'dashed' | 'dotted' | 'tapered'
 * @param {number} sx, sy      - Start (parent) position
 * @param {number} ex, ey      - End (child) position
 * @param {string} color       - Stroke/fill color (inherited from parent branch)
 * @param {number} opacity     - Opacity (default 0.4)
 * @param {object} options     - { startWidth, endWidth, strokeWidth, curvature, connectionOverrides }
 *   connectionOverrides: { lineStyle, color, opacity } - per-connection DB overrides
 * @returns {{ element: string, props: object }|{ elements: Array }} - SVG element type + attributes
 */
export function getConnectionProps(lineStyle, sx, sy, ex, ey, color, opacity = 0.4, options = {}) {
  const {
    startWidth = 6,
    endWidth = 1.5,
    strokeWidth = 2.5,
    curvature = 0.2,
    connectionOverrides = null,
  } = options;

  // -- DB Bridge: Per-connection overrides take priority over global lineStyle --
  const effectiveStyle = connectionOverrides?.lineStyle || lineStyle;
  const effectiveColor = connectionOverrides?.color || color;
  const effectiveOpacity = connectionOverrides?.opacity ?? opacity;

  if (effectiveStyle === 'tapered') {
    const result = buildTaperedPath(sx, sy, ex, ey, startWidth, endWidth, { curvature });
    // Plain tapered (no dash)
    if (typeof result === 'string') {
      return {
        element: 'path',
        props: {
          d: result,
          fill: effectiveColor,
          stroke: 'none',
          opacity: effectiveOpacity,
        },
      };
    }
    // Dashed tapered - should not happen from plain 'tapered', but handle it
    return buildDashedTaperedResult(result, effectiveColor, effectiveOpacity);
  }

  // -- Dashed Tapered: compound style for tapered + dash pattern --
  if (effectiveStyle === 'tapered-dashed' || effectiveStyle === 'tapered-dotted') {
    const dashPattern = effectiveStyle === 'tapered-dashed' ? '10 6' : '3 5';
    const result = buildTaperedPath(sx, sy, ex, ey, startWidth, endWidth, {
      dashPattern,
      curvature,
    });
    if (typeof result === 'object' && result.fillPath) {
      return buildDashedTaperedResult(result, effectiveColor, effectiveOpacity, strokeWidth);
    }
    // Fallback if result is string
    return {
      element: 'path',
      props: { d: result, fill: effectiveColor, stroke: 'none', opacity: effectiveOpacity },
    };
  }

  // All other styles use a Bezier stroke
  const d = buildBezierPath(sx, sy, ex, ey, curvature);
  const base = {
    d,
    fill: 'none',
    stroke: effectiveColor,
    strokeWidth,
    opacity: effectiveOpacity,
    strokeLinecap: 'round',
  };

  switch (effectiveStyle) {
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
 * Build result for a dashed tapered connection.
 * Returns a multi-element result: a faint filled tapered shape + a dashed center stroke.
 */
function buildDashedTaperedResult(result, color, opacity, strokeWidth = 2) {
  return {
    elements: [
      {
        element: 'path',
        props: {
          d: result.fillPath,
          fill: color,
          stroke: 'none',
          opacity: opacity * 0.25,
        },
      },
      {
        element: 'path',
        props: {
          d: result.strokePath,
          fill: 'none',
          stroke: color,
          strokeWidth,
          strokeDasharray: result.dashPattern,
          strokeLinecap: 'round',
          opacity,
        },
      },
    ],
  };
}

/**
 * Human-readable labels for the UI selector.
 */
export const LINE_STYLE_OPTIONS = [
  { key: 'tapered', label: 'טפל (AYOA)', description: 'קו שמתחיל עבה ונהיה דק' },
  { key: 'solid',   label: 'מלא',         description: 'קו מקצועי חלק' },
  { key: 'dashed',  label: 'מקווקו',      description: 'חיבור משני / זמני' },
  { key: 'dotted',  label: 'מנוקד',       description: 'חיבור עדין / רפאים' },
  { key: 'tapered-dashed', label: 'טפל מקווקו', description: 'עבה→דק עם קווקו' },
  { key: 'tapered-dotted', label: 'טפל מנוקד',  description: 'עבה→דק עם נקודות' },
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
