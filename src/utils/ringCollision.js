/**
 * Ring collision detection and resolution utilities.
 *
 * Each ring is { id, cx, cy, r } where cx/cy are center coords and r is radius.
 * MIN_GAP is the minimum pixel gap between ring edges.
 */

export const MIN_GAP = 16;

/**
 * Distance between two ring centers.
 */
export function centerDistance(a, b) {
  const dx = a.cx - b.cx;
  const dy = a.cy - b.cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Gap between two ring edges. Negative = overlapping.
 */
export function edgeGap(a, b) {
  return centerDistance(a, b) - a.r - b.r;
}

/**
 * Check if two rings overlap beyond the allowed gap.
 */
export function isOverlapping(a, b, minGap = MIN_GAP) {
  return edgeGap(a, b) < minGap;
}

/**
 * Resolve collision between a moved ring and all other rings.
 * Returns adjusted { cx, cy } for the moved ring so that it maintains
 * at least `minGap` px from every other ring's edge.
 *
 * Uses iterative push-out: for each overlapping ring, push the moved ring
 * away along the center-to-center axis.
 */
export function resolveCollisions(movedRing, otherRings, minGap = MIN_GAP, bounds = null) {
  let { cx, cy } = movedRing;
  const r = movedRing.r;

  // Up to 5 iterations to resolve cascading pushes
  for (let iter = 0; iter < 5; iter++) {
    let pushed = false;
    for (const other of otherRings) {
      if (other.id === movedRing.id) continue;

      const dx = cx - other.cx;
      const dy = cy - other.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = r + other.r + minGap;

      if (dist < minDist) {
        pushed = true;
        if (dist < 1) {
          // Nearly coincident — push in arbitrary direction
          cx += minDist;
        } else {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          cx += nx * overlap;
          cy += ny * overlap;
        }
      }
    }

    // Clamp to bounds if provided: { width, height }
    if (bounds) {
      cx = Math.max(r, Math.min(bounds.width - r, cx));
      cy = Math.max(r, Math.min(bounds.height - r, cy));
    }

    if (!pushed) break;
  }

  return { cx, cy };
}

/**
 * Clamp a ring's radius so it doesn't fully engulf or escape bounds.
 */
export function clampRadius(radius, minR = 40, maxR = 300) {
  return Math.max(minR, Math.min(maxR, radius));
}
