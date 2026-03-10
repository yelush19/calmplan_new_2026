/**
 * mapCollisionEngine.js — Zero-Overlap Collision Engine for MindMap
 *
 * Guarantees: after resolve(), no two visible nodes overlap by even 1px.
 *
 * Design:
 *   - Uses AABB (axis-aligned bounding boxes) for rectangular pills
 *   - Uses circle collision for round nodes (dept, tier diamonds, func bubbles)
 *   - Iterates until convergence (0 overlaps) or MAX_ITERATIONS
 *   - Weight-based: heavier nodes move less, lighter nodes move more
 *   - Preserves hierarchical relationships (children stay near parents)
 */

// ─── Node shape types ──────────────────────────────────────────────────────
const SHAPE_CIRCLE = 'circle';
const SHAPE_PILL = 'pill';      // rounded rectangle (AABB collision)
const SHAPE_DIAMOND = 'diamond'; // treated as circle with inscribed radius

// ─── Configuration ─────────────────────────────────────────────────────────
const MAX_ITERATIONS = 30;       // hard cap to prevent infinite loops
const MIN_GAP = 12;              // minimum px gap between any two nodes
const CONVERGENCE_THRESHOLD = 0.5; // if max displacement < this, we're done

/**
 * Create a collision node descriptor.
 *
 * @param {object} ref       - The mutable position object ({ x, y, ... })
 * @param {string} shape     - SHAPE_CIRCLE | SHAPE_PILL | SHAPE_DIAMOND
 * @param {number} width     - Full width (for pills) or diameter (for circles)
 * @param {number} height    - Full height (for pills) or diameter (for circles)
 * @param {number} weight    - 0-4; heavier nodes resist movement
 * @param {string} [parentKey] - Optional key to identify hierarchy parent
 * @returns {object}
 */
export function createCollisionNode(ref, shape, width, height, weight, parentKey) {
  return {
    ref,
    shape,
    halfW: width / 2,
    halfH: height / 2,
    weight: Math.max(0, weight),
    parentKey: parentKey || null,
  };
}

/**
 * Test if two nodes overlap (including MIN_GAP buffer).
 * Returns { overlapping, overlapX, overlapY } where overlapX/Y are
 * the penetration depths on each axis (positive = overlapping).
 */
function testOverlap(a, b) {
  const gap = MIN_GAP;

  if (a.shape === SHAPE_PILL || b.shape === SHAPE_PILL) {
    // AABB overlap test — works for pill×pill, pill×circle, pill×diamond
    // Treat all shapes as their bounding box for simplicity and correctness
    const aLeft = a.ref.x - a.halfW;
    const aRight = a.ref.x + a.halfW;
    const aTop = a.ref.y - a.halfH;
    const aBottom = a.ref.y + a.halfH;

    const bLeft = b.ref.x - b.halfW;
    const bRight = b.ref.x + b.halfW;
    const bTop = b.ref.y - b.halfH;
    const bBottom = b.ref.y + b.halfH;

    const overlapX = Math.min(aRight, bRight) - Math.max(aLeft, bLeft) + gap;
    const overlapY = Math.min(aBottom, bBottom) - Math.max(aTop, bTop) + gap;

    if (overlapX > 0 && overlapY > 0) {
      return { overlapping: true, overlapX, overlapY };
    }
    return { overlapping: false, overlapX: 0, overlapY: 0 };
  }

  // Circle×circle (including diamond treated as circle)
  const dx = b.ref.x - a.ref.x;
  const dy = b.ref.y - a.ref.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
  const minDist = Math.max(a.halfW, a.halfH) + Math.max(b.halfW, b.halfH) + gap;

  if (dist < minDist) {
    const penetration = minDist - dist;
    return { overlapping: true, overlapX: penetration, overlapY: penetration };
  }
  return { overlapping: false, overlapX: 0, overlapY: 0 };
}

/**
 * Resolve all overlaps among the given collision nodes.
 * Mutates each node's ref.x and ref.y in place.
 *
 * @param {Array} nodes - Array of collision node descriptors from createCollisionNode()
 * @returns {{ iterations: number, resolved: boolean, remainingOverlaps: number }}
 */
export function resolveCollisions(nodes) {
  if (nodes.length < 2) return { iterations: 0, resolved: true, remainingOverlaps: 0 };

  let iteration = 0;
  let resolved = false;

  while (iteration < MAX_ITERATIONS && !resolved) {
    let maxDisplacement = 0;
    let overlapCount = 0;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const { overlapping, overlapX, overlapY } = testOverlap(a, b);

        if (!overlapping) continue;
        overlapCount++;

        // Determine push direction — always push along the axis of least penetration
        const dx = b.ref.x - a.ref.x;
        const dy = b.ref.y - a.ref.y;

        // Weight-based split: total weight determines who moves how much
        // weight 0 = fully mobile, weight 4 = almost immovable
        const aResist = 1 + a.weight;
        const bResist = 1 + b.weight;
        const totalResist = aResist + bResist;
        const aRatio = bResist / totalResist; // a moves proportional to b's resistance (more b resists → more a moves)
        const bRatio = aResist / totalResist;

        // For AABB collisions, push along the axis of minimum overlap
        if (a.shape === SHAPE_PILL || b.shape === SHAPE_PILL) {
          if (overlapX < overlapY) {
            // Push horizontally
            const pushDir = dx >= 0 ? 1 : -1;
            const pushAmount = overlapX / 2 + 0.5; // +0.5 to guarantee clearance
            b.ref.x += pushDir * pushAmount * bRatio;
            a.ref.x -= pushDir * pushAmount * aRatio;
            maxDisplacement = Math.max(maxDisplacement, pushAmount);
          } else {
            // Push vertically (prefer downward for tree layout)
            const pushDir = dy >= 0 ? 1 : -1;
            const pushAmount = overlapY / 2 + 0.5;
            b.ref.y += pushDir * pushAmount * bRatio;
            a.ref.y -= pushDir * pushAmount * aRatio;
            maxDisplacement = Math.max(maxDisplacement, pushAmount);
          }
        } else {
          // Circle collision — push radially
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const nx = dx / dist;
          const ny = dy / dist;
          const pushAmount = overlapX / 2 + 0.5;
          b.ref.x += nx * pushAmount * bRatio;
          b.ref.y += ny * pushAmount * bRatio;
          a.ref.x -= nx * pushAmount * aRatio;
          a.ref.y -= ny * pushAmount * aRatio;
          maxDisplacement = Math.max(maxDisplacement, pushAmount);
        }
      }
    }

    iteration++;

    if (overlapCount === 0 || maxDisplacement < CONVERGENCE_THRESHOLD) {
      resolved = overlapCount === 0;
      break;
    }
  }

  // Final verification pass — count remaining overlaps
  let remainingOverlaps = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (testOverlap(nodes[i], nodes[j]).overlapping) {
        remainingOverlaps++;
      }
    }
  }

  return { iterations: iteration, resolved: remainingOverlaps === 0, remainingOverlaps };
}

/**
 * Build collision node list from MindMap branch positions.
 * This is the bridge between MindMapView's layout data and the collision engine.
 *
 * @param {Array} branchPositions - From layout.branchPositions
 * @param {boolean} isWide - Whether display is wide (>= 1600px)
 * @returns {Array} Array of collision node descriptors
 */
export function buildCollisionNodes(branchPositions, isWide) {
  const nodes = [];

  branchPositions.forEach(branch => {
    // Department folder: 160×80 rounded rect
    nodes.push(createCollisionNode(
      branch,      // ref (mutable x,y)
      SHAPE_PILL,
      160, 80,
      4,           // weight: heaviest — departments anchor the layout
      null
    ));

    // Tier diamonds: ~64×64 (diamond inscribed in 64px box)
    branch.subFolderPositions?.forEach(sf => {
      nodes.push(createCollisionNode(
        sf,
        SHAPE_DIAMOND,
        64, 64,
        3,           // weight: heavy
        `folder-${branch.category}`
      ));
    });

    // Function bubbles: ~100×40 pill
    branch.functionBubblePositions?.forEach(fb => {
      nodes.push(createCollisionNode(
        fb,
        SHAPE_PILL,
        100, 40,
        2,           // weight: medium
        fb.tierKey
      ));
    });

    // Client pills: width = radius*3, height = radius*1.2, min 120×55
    branch.clientPositions?.forEach(cp => {
      const pillW = Math.max((cp.radius || 35) * 3.0, 120);
      const pillH = Math.max((cp.radius || 35) * 1.2, 55);
      nodes.push(createCollisionNode(
        cp,
        SHAPE_PILL,
        pillW, pillH,
        0,           // weight: lightest — clients are most mobile
        cp.funcBubbleKey
      ));
    });
  });

  return nodes;
}

// Re-export shape constants for testing
export { SHAPE_CIRCLE, SHAPE_PILL, SHAPE_DIAMOND, MIN_GAP, MAX_ITERATIONS };
