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

/**
 * Relocate all bubbles belonging to a ring after the ring moves or resizes.
 * Each bubble's position is stored as absolute coords. We compute the relative
 * offset from the OLD ring center, scale by newR/oldR, then apply to the new center.
 *
 * @param {Object} bubbles - { [taskId]: { taskId, cx, cy, ringId } }
 * @param {string} ringId - which ring moved
 * @param {{ cx, cy, r }} oldRing - previous ring state
 * @param {{ cx, cy, r }} newRing - new ring state
 * @returns {Object} updated bubbles map
 */
export function relocateBubblesForRing(bubbles, ringId, oldRing, newRing) {
  const updated = { ...bubbles };
  const scale = oldRing.r > 0 ? newRing.r / oldRing.r : 1;

  for (const [tid, bl] of Object.entries(updated)) {
    if (bl.ringId !== ringId) continue;

    // Offset from old ring center
    const offX = bl.cx - oldRing.cx;
    const offY = bl.cy - oldRing.cy;

    // Scale and translate to new center
    updated[tid] = {
      ...bl,
      cx: newRing.cx + offX * scale,
      cy: newRing.cy + offY * scale,
    };
  }

  return updated;
}

/**
 * Given a list of tasks assigned to a ring, return the top N by priority
 * and a remainder list for overflow display.
 *
 * Priority order: urgent > high > medium > low > none/undefined
 *
 * @param {Array} tasks - tasks assigned to this ring
 * @param {number} maxVisible - how many to show as bubbles (default 3)
 * @returns {{ visible: Array, overflow: Array }}
 */
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export function splitVisibleOverflow(tasks, maxVisible = 3) {
  const sorted = [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 4;
    const pb = PRIORITY_ORDER[b.priority] ?? 4;
    return pa - pb;
  });
  return {
    visible: sorted.slice(0, maxVisible),
    overflow: sorted.slice(maxVisible),
  };
}
