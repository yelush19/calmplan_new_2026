import React from 'react';
import { motion } from 'framer-motion';

// ══════════════════════════════════════════════════════════════════
// LAW 2.1: GEOMETRIC CENTER LINES
// ══════════════════════════════════════════════════════════════════
//
// Every SVG line MUST calculate coordinates from the ABSOLUTE CENTER
// of both the source and target nodes.
//
// Formula:  x = pos.x (already center), y = pos.y (already center)
//
// For nodes with width/height (categories, pills):
//   center_x = node.x  (layout engine places x at center)
//   center_y = node.y  (layout engine places y at center)
//
// Lines originate from the heart of the node, NOT corners.
// Lines are rendered BEHIND nodes (in SVG render order).
// ══════════════════════════════════════════════════════════════════

export function MindMapEdge({ fromNode, toNode, color, isSecondary, level }) {
  if (!fromNode || !toNode) return null;

  // LAW 2.1: Geometric center of each node
  // Layout engine already stores x,y as center coordinates
  const fromCx = fromNode.x;
  const fromCy = fromNode.y;
  const toCx = toNode.x;
  const toCy = toNode.y;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return null;

  // Compute collision radius for each node
  const fromR = fromNode.collisionRadius || fromNode.radius || (fromNode.width ? fromNode.width / 2 : 30);
  const toR = toNode.collisionRadius || toNode.radius || (toNode.width ? toNode.width / 2 : 20);

  // Shorten line: start from edge of source, end at edge of target
  const nx = dx / dist;
  const ny = dy / dist;
  const x1 = fromCx + nx * (fromR + 3);
  const y1 = fromCy + ny * (fromR + 3);
  const x2 = toCx - nx * (toR + 3);
  const y2 = toCy - ny * (toR + 3);

  // Verify line won't be negative length (nodes overlapping)
  const lineDist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (lineDist < 2) return null;

  // Style based on level
  const isHubToCategory = level === 'L0-L1';
  const isCategoryToClient = level === 'L1-L2';

  const strokeWidth = isHubToCategory ? 2 : isSecondary ? 0.8 : 1.2;
  const opacity = isHubToCategory ? 0.45 : isSecondary ? 0.12 : 0.3;
  const strokeColor = color || 'rgba(255,255,255,0.2)';
  const dashArray = isSecondary ? '4 3' : 'none';

  return (
    <motion.line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeOpacity={opacity}
      strokeLinecap="round"
      strokeDasharray={dashArray}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: opacity }}
      transition={{
        duration: isHubToCategory ? 0.5 : 0.8,
        ease: 'easeOut',
        delay: isHubToCategory ? 0.1 : 0.3,
      }}
    />
  );
}
