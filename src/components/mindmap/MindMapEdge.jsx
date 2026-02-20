import React from 'react';
import { motion } from 'framer-motion';

// Animated edge line between two nodes
export function MindMapEdge({ fromNode, toNode, color, isSecondary }) {
  if (!fromNode || !toNode) return null;

  const opacity = isSecondary ? 0.15 : 0.3;
  const strokeWidth = isSecondary ? 1 : 1.5;

  // Calculate shortened line (start from edge of source circle, end at edge of target circle)
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return null;

  const nx = dx / dist;
  const ny = dy / dist;

  const x1 = fromNode.x + nx * (fromNode.radius + 2);
  const y1 = fromNode.y + ny * (fromNode.radius + 2);
  const x2 = toNode.x - nx * (toNode.radius + 2);
  const y2 = toNode.y - ny * (toNode.radius + 2);

  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color || 'rgba(255,255,255,0.2)'}
      strokeWidth={strokeWidth}
      strokeOpacity={opacity}
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: opacity }}
      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
    />
  );
}
